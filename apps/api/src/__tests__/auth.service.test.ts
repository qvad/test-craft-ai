/**
 * Vitest suite for AuthService
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock db before importing auth service
vi.mock('../modules/database/yugabyte-client.js', () => ({
  db: {
    query: vi.fn(),
  },
}));

import { authService } from '../modules/auth/auth.service.js';
import { db } from '../modules/database/yugabyte-client.js';

const mockDb = vi.mocked(db);

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.query.mockResolvedValue({ rows: [], rowCount: 0, fields: [] });
});

// ============================================================================
// Password Hashing
// ============================================================================

describe('AuthService.hashPassword / verifyPassword', () => {
  it('produces a hash that contains a colon separator', async () => {
    const hash = await authService.hashPassword('my-password');
    expect(hash).toContain(':');
  });

  it('verifies the correct password', async () => {
    const hash = await authService.hashPassword('correct-password');
    expect(await authService.verifyPassword('correct-password', hash)).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await authService.hashPassword('real-password');
    expect(await authService.verifyPassword('wrong-password', hash)).toBe(false);
  });

  it('handles missing hash gracefully', async () => {
    expect(await authService.verifyPassword('pwd', '')).toBe(false);
  });

  it('handles hash without colon', async () => {
    expect(await authService.verifyPassword('pwd', 'nocolon')).toBe(false);
  });

  it('produces different hashes for the same password (random salt)', async () => {
    const h1 = await authService.hashPassword('same');
    const h2 = await authService.hashPassword('same');
    expect(h1).not.toBe(h2);
  });
});

// ============================================================================
// JWT Generation and Verification
// ============================================================================

describe('AuthService.generateJwt', () => {
  const mockUser = {
    id: 'user-123',
    email: 'alice@example.com',
    name: 'Alice',
    role: 'admin' as const,
    createdAt: new Date(),
  };

  it('returns an accessToken with three dot-separated parts', () => {
    const { accessToken } = authService.generateJwt(mockUser);
    expect(accessToken.split('.')).toHaveLength(3);
  });

  it('returns a refreshToken', () => {
    const { refreshToken } = authService.generateJwt(mockUser);
    expect(refreshToken).toBeTruthy();
    expect(refreshToken.length).toBeGreaterThan(10);
  });

  it('returns a positive expiresIn', () => {
    const { expiresIn } = authService.generateJwt(mockUser);
    expect(expiresIn).toBeGreaterThan(0);
  });

  it('generates different JTI each call', () => {
    const { accessToken: t1 } = authService.generateJwt(mockUser);
    const { accessToken: t2 } = authService.generateJwt(mockUser);
    // Different JTI means different body
    expect(t1).not.toBe(t2);
  });
});

describe('AuthService.verifyJwt', () => {
  const mockUser = {
    id: 'user-456',
    email: 'bob@example.com',
    name: 'Bob',
    role: 'user' as const,
    createdAt: new Date(),
  };

  it('returns invalid for a token with wrong format', async () => {
    const result = await authService.verifyJwt('not.a.valid.token.here');
    expect(result.valid).toBe(false);
  });

  it('returns invalid for a token with bad signature', async () => {
    const { accessToken } = authService.generateJwt(mockUser);
    const parts = accessToken.split('.');
    const tampered = `${parts[0]}.${parts[1]}.invalidsignature`;
    const result = await authService.verifyJwt(tampered);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('signature');
  });

  it('returns valid for a valid token when user exists and not revoked', async () => {
    const { accessToken } = authService.generateJwt(mockUser);
    // Not revoked (empty rows), user found
    mockDb.query
      .mockResolvedValueOnce({ rows: [], rowCount: 0, fields: [] })         // revoked_tokens check
      .mockResolvedValueOnce({ rows: [mockUser], rowCount: 1, fields: [] }); // user lookup

    const result = await authService.verifyJwt(accessToken);
    expect(result.valid).toBe(true);
    expect(result.user).toBeDefined();
  });

  it('returns invalid when token is in revoked list', async () => {
    const { accessToken } = authService.generateJwt(mockUser);
    mockDb.query.mockResolvedValueOnce({
      rows: [{ jti: 'some-jti' }],
      rowCount: 1,
      fields: [],
    });
    const result = await authService.verifyJwt(accessToken);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('revoked');
  });

  it('returns invalid when user not found', async () => {
    const { accessToken } = authService.generateJwt(mockUser);
    mockDb.query
      .mockResolvedValueOnce({ rows: [], rowCount: 0, fields: [] })         // not revoked
      .mockResolvedValueOnce({ rows: [], rowCount: 0, fields: [] });         // user not found

    const result = await authService.verifyJwt(accessToken);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('User not found');
  });
});

// ============================================================================
// Role Scopes
// ============================================================================

describe('AuthService — role scopes', () => {
  const getScopes = (role: string): string[] =>
    (authService as any).getScopesForRole(role);

  it('admin has all scopes including admin', () => {
    expect(getScopes('admin')).toContain('admin');
    expect(getScopes('admin')).toContain('read');
    expect(getScopes('admin')).toContain('write');
    expect(getScopes('admin')).toContain('delete');
  });

  it('user has read and write but not admin or delete', () => {
    const scopes = getScopes('user');
    expect(scopes).toContain('read');
    expect(scopes).toContain('write');
    expect(scopes).not.toContain('admin');
    expect(scopes).not.toContain('delete');
  });

  it('viewer has only read', () => {
    const scopes = getScopes('viewer');
    expect(scopes).toEqual(['read']);
  });

  it('unknown role defaults to read only', () => {
    const scopes = getScopes('superuser');
    expect(scopes).toEqual(['read']);
  });
});

// ============================================================================
// API Key — format validation
// ============================================================================

describe('AuthService.verifyApiKey', () => {
  it('returns invalid for key not starting with tc_', async () => {
    const result = await authService.verifyApiKey('sk-not-a-valid-key');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('format');
  });

  it('returns invalid when api key not found in db', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 0, fields: [] });
    const result = await authService.verifyApiKey('tc_' + 'a'.repeat(48));
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid API key');
  });

  it('returns invalid for expired api key', async () => {
    const expiredDate = new Date(Date.now() - 1000 * 60 * 60); // 1 hour ago
    mockDb.query.mockResolvedValueOnce({
      rows: [{ id: 'key-1', user_id: 'u-1', scopes: ['read'], expires_at: expiredDate }],
      rowCount: 1,
      fields: [],
    });
    const result = await authService.verifyApiKey('tc_' + 'b'.repeat(48));
    expect(result.valid).toBe(false);
    expect(result.error).toContain('expired');
  });

  it('returns valid for a valid non-expired api key', async () => {
    const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24); // 1 day ahead
    const mockUserRow = {
      id: 'u-2',
      email: 'carol@example.com',
      name: 'Carol',
      role: 'user',
      created_at: new Date(),
    };
    mockDb.query
      .mockResolvedValueOnce({
        rows: [{ id: 'key-2', user_id: 'u-2', scopes: ['read', 'write'], expires_at: futureDate }],
        rowCount: 1,
        fields: [],
      })                                                                           // key lookup
      .mockResolvedValueOnce({ rows: [], rowCount: 0, fields: [] })               // update last_used
      .mockResolvedValueOnce({ rows: [mockUserRow], rowCount: 1, fields: [] });   // user lookup

    const result = await authService.verifyApiKey('tc_' + 'c'.repeat(48));
    expect(result.valid).toBe(true);
    expect(result.scopes).toContain('read');
  });
});

// ============================================================================
// revokeApiKey
// ============================================================================

describe('AuthService.revokeApiKey', () => {
  it('returns true when key was revoked', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 1, fields: [] });
    const result = await authService.revokeApiKey('key-id', 'user-id');
    expect(result).toBe(true);
  });

  it('returns false when key was not found', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 0, fields: [] });
    const result = await authService.revokeApiKey('bad-key', 'user-id');
    expect(result).toBe(false);
  });
});

// ============================================================================
// cleanupExpiredTokens
// ============================================================================

describe('AuthService.cleanupExpiredTokens', () => {
  it('returns the number of deleted rows', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 7, fields: [] });
    const count = await authService.cleanupExpiredTokens();
    expect(count).toBe(7);
  });

  it('returns 0 when rowCount is null', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: null, fields: [] });
    const count = await authService.cleanupExpiredTokens();
    expect(count).toBe(0);
  });
});
