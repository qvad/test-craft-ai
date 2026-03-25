/**
 * Auth Service Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../database/yugabyte-client.js', () => ({
  db: { query: vi.fn() },
}));

vi.mock('../../common/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { authService } from './auth.service.js';
import { db } from '../database/yugabyte-client.js';

const mockDb = vi.mocked(db);

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // Password hashing
  // ============================================================================

  describe('hashPassword / verifyPassword', () => {
    it('produces a hash with a salt separator', async () => {
      const hash = await authService.hashPassword('secret');
      expect(hash).toContain(':');
    });

    it('verifies a correct password', async () => {
      const hash = await authService.hashPassword('correct');
      await expect(authService.verifyPassword('correct', hash)).resolves.toBe(true);
    });

    it('rejects an incorrect password', async () => {
      const hash = await authService.hashPassword('correct');
      await expect(authService.verifyPassword('wrong', hash)).resolves.toBe(false);
    });

    it('returns false for an empty hash', async () => {
      await expect(authService.verifyPassword('any', '')).resolves.toBe(false);
    });

    it('returns false for a hash without a colon separator', async () => {
      await expect(authService.verifyPassword('any', 'noseparator')).resolves.toBe(false);
    });

    it('produces different hashes for the same password (unique salts)', async () => {
      const h1 = await authService.hashPassword('same');
      const h2 = await authService.hashPassword('same');
      expect(h1).not.toBe(h2);
    });
  });

  // ============================================================================
  // JWT generation
  // ============================================================================

  describe('generateJwt', () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      role: 'admin' as const,
      createdAt: new Date(),
    };

    it('returns an access token with three dot-separated parts', () => {
      const { accessToken } = authService.generateJwt(mockUser);
      expect(accessToken.split('.')).toHaveLength(3);
    });

    it('returns a positive expiresIn value', () => {
      const { expiresIn } = authService.generateJwt(mockUser);
      expect(expiresIn).toBeGreaterThan(0);
    });

    it('returns a non-empty refresh token', () => {
      const { refreshToken } = authService.generateJwt(mockUser);
      expect(refreshToken.length).toBeGreaterThan(0);
    });

    it('encodes the correct email in the payload', () => {
      const { accessToken } = authService.generateJwt(mockUser);
      const payload = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64url').toString());
      expect(payload.email).toBe('test@example.com');
    });

    it('encodes the correct role in the payload', () => {
      const { accessToken } = authService.generateJwt(mockUser);
      const payload = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64url').toString());
      expect(payload.role).toBe('admin');
    });
  });

  // ============================================================================
  // getScopesForRole (via cast — private method)
  // ============================================================================

  describe('getScopesForRole', () => {
    const getScopes = (role: string): string[] =>
      (authService as any).getScopesForRole(role);

    it('admin gets read, write, delete, admin scopes', () => {
      expect(getScopes('admin')).toEqual(['read', 'write', 'delete', 'admin']);
    });

    it('user gets read and write scopes', () => {
      expect(getScopes('user')).toEqual(['read', 'write']);
    });

    it('viewer gets only read scope', () => {
      expect(getScopes('viewer')).toEqual(['read']);
    });

    it('unknown role falls back to read only', () => {
      expect(getScopes('unknown')).toEqual(['read']);
    });
  });

  // ============================================================================
  // verifyJwt
  // ============================================================================

  describe('verifyJwt', () => {
    const mockUser = {
      id: 'user-abc',
      email: 'verify@example.com',
      name: 'Verify User',
      role: 'user' as const,
      createdAt: new Date(),
    };

    it('returns invalid for a malformed token', async () => {
      const result = await authService.verifyJwt('not.a.valid.token.here');
      expect(result.valid).toBe(false);
    });

    it('returns invalid for a token with wrong signature', async () => {
      const { accessToken } = authService.generateJwt(mockUser);
      const parts = accessToken.split('.');
      const tampered = `${parts[0]}.${parts[1]}.invalidsignature`;
      const result = await authService.verifyJwt(tampered);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid signature');
    });

    it('returns invalid for an expired token', async () => {
      const { accessToken } = authService.generateJwt(mockUser);
      const parts = accessToken.split('.');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      // Backdate expiry by 2 hours
      payload.exp = Math.floor(Date.now() / 1000) - 7200;
      const newBody = Buffer.from(JSON.stringify(payload)).toString('base64url');
      // Re-sign using the internal sign method
      const sign = (data: string): string => (authService as any).sign(data);
      const newSig = sign(`${parts[0]}.${newBody}`);
      const expiredToken = `${parts[0]}.${newBody}.${newSig}`;
      const result = await authService.verifyJwt(expiredToken);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Token expired');
    });

    it('returns invalid when token is revoked', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ jti: 'some-jti' }], rowCount: 1, fields: [] });

      const { accessToken } = authService.generateJwt(mockUser);
      const result = await authService.verifyJwt(accessToken);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Token revoked');
    });

    it('returns invalid when user is not found', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [], rowCount: 0, fields: [] }) // not revoked
        .mockResolvedValueOnce({ rows: [], rowCount: 0, fields: [] }); // user not found

      const { accessToken } = authService.generateJwt(mockUser);
      const result = await authService.verifyJwt(accessToken);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('User not found');
    });

    it('returns valid with user and scopes for a good token', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [], rowCount: 0, fields: [] })       // not revoked
        .mockResolvedValueOnce({ rows: [mockUser], rowCount: 1, fields: [] }); // user found

      const { accessToken } = authService.generateJwt(mockUser);
      const result = await authService.verifyJwt(accessToken);
      expect(result.valid).toBe(true);
      expect(result.user).toEqual(mockUser);
      expect(result.scopes).toContain('write');
    });
  });

  // ============================================================================
  // verifyApiKey
  // ============================================================================

  describe('verifyApiKey', () => {
    it('rejects keys that do not start with tc_', async () => {
      const result = await authService.verifyApiKey('sk_badkey');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid API key format');
    });

    it('returns invalid when key is not found in DB', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 0, fields: [] });
      const result = await authService.verifyApiKey('tc_' + 'a'.repeat(48));
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid API key');
    });

    it('returns invalid for an expired key', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{
          id: 'key-1',
          user_id: 'user-1',
          scopes: ['read'],
          expires_at: new Date(Date.now() - 10000),
        }],
        rowCount: 1,
        fields: [],
      });
      const result = await authService.verifyApiKey('tc_' + 'b'.repeat(48));
      expect(result.valid).toBe(false);
      expect(result.error).toBe('API key expired');
    });

    it('returns valid with user and scopes for a good key', async () => {
      const user = { id: 'u1', email: 'api@test.com', name: 'API User', role: 'user', createdAt: new Date() };
      mockDb.query
        .mockResolvedValueOnce({
          rows: [{ id: 'key-1', user_id: 'u1', scopes: ['read', 'write'], expires_at: null }],
          rowCount: 1,
          fields: [],
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 0, fields: [] }) // UPDATE last_used_at
        .mockResolvedValueOnce({ rows: [user], rowCount: 1, fields: [] });

      const result = await authService.verifyApiKey('tc_' + 'c'.repeat(48));
      expect(result.valid).toBe(true);
      expect(result.scopes).toEqual(['read', 'write']);
    });
  });

  // ============================================================================
  // revokeApiKey
  // ============================================================================

  describe('revokeApiKey', () => {
    it('returns true when a row was updated', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 1, fields: [] });
      await expect(authService.revokeApiKey('key-1', 'user-1')).resolves.toBe(true);
    });

    it('returns false when no row was updated', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 0, fields: [] });
      await expect(authService.revokeApiKey('key-x', 'user-1')).resolves.toBe(false);
    });
  });

  // ============================================================================
  // authenticateUser
  // ============================================================================

  describe('authenticateUser', () => {
    it('returns invalid credentials when user not found', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 0, fields: [] });
      const result = await authService.authenticateUser('nobody@example.com', 'pass');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid credentials');
    });

    it('returns invalid credentials when password is wrong', async () => {
      const hash = await authService.hashPassword('correct-password');
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: 'u1', email: 'a@b.com', name: 'A', role: 'user', password_hash: hash, created_at: new Date() }],
        rowCount: 1,
        fields: [],
      });
      const result = await authService.authenticateUser('a@b.com', 'wrong-password');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid credentials');
    });

    it('returns valid with user when credentials match', async () => {
      const hash = await authService.hashPassword('good-password');
      const created = new Date();
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: 'u2', email: 'b@c.com', name: 'B', role: 'admin', password_hash: hash, created_at: created }],
        rowCount: 1,
        fields: [],
      });
      const result = await authService.authenticateUser('b@c.com', 'good-password');
      expect(result.valid).toBe(true);
      expect(result.user?.email).toBe('b@c.com');
      expect(result.user?.role).toBe('admin');
    });
  });

  // ============================================================================
  // cleanupExpiredTokens
  // ============================================================================

  describe('cleanupExpiredTokens', () => {
    it('returns the number of deleted rows', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 5, fields: [] });
      await expect(authService.cleanupExpiredTokens()).resolves.toBe(5);
    });

    it('returns 0 when rowCount is null', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: null, fields: [] });
      await expect(authService.cleanupExpiredTokens()).resolves.toBe(0);
    });
  });
});
