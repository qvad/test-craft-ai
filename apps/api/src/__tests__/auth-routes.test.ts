/**
 * Vitest suite for auth routes (apps/api/src/modules/auth/routes.ts)
 * Uses fastify.inject() to exercise each route via HTTP simulation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';

// ── Mocks ────────────────────────────────────────────────────────────────────
// Must be declared before any module-under-test imports.

vi.mock('../modules/auth/auth.service.js', () => ({
  authService: {
    authenticateUser: vi.fn(),
    generateJwt: vi.fn(),
    createUser: vi.fn(),
    revokeToken: vi.fn(),
    generateApiKey: vi.fn(),
    revokeApiKey: vi.fn(),
  },
}));

vi.mock('../modules/audit/audit.service.js', () => ({
  auditLog: {
    log: vi.fn().mockResolvedValue('audit-id'),
  },
}));

vi.mock('../modules/database/yugabyte-client.js', () => ({
  db: {
    query: vi.fn(),
  },
}));

// requireRole returns a preHandler; mock it so it simply passes through by default.
// Individual tests can override mockRequireRole to return a blocking handler.
let mockRequireRoleHandler = vi.fn(async (_req: unknown, _reply: unknown) => {});
vi.mock('../modules/auth/auth.plugin.js', () => ({
  requireScope: vi.fn(() => vi.fn()),
  requireRole: vi.fn((..._roles: string[]) => mockRequireRoleHandler),
}));

// ── Imports after mocks ───────────────────────────────────────────────────────
import { authRoutes } from '../modules/auth/routes.js';
import { authService } from '../modules/auth/auth.service.js';
import { auditLog } from '../modules/audit/audit.service.js';
import { db } from '../modules/database/yugabyte-client.js';

const mockAuthService = vi.mocked(authService);
const mockAuditLog = vi.mocked(auditLog);
const mockDb = vi.mocked(db);

// ── Shared test user ──────────────────────────────────────────────────────────
const adminUser = {
  id: 'user-admin-1',
  email: 'admin@test.com',
  name: 'Admin User',
  role: 'admin' as const,
  createdAt: new Date(),
};

const regularUser = {
  id: 'user-reg-1',
  email: 'alice@test.com',
  name: 'Alice',
  role: 'user' as const,
  createdAt: new Date(),
};

const mockTokens = {
  accessToken: 'mock.access.token',
  refreshToken: 'mock-refresh-token',
  expiresIn: 3600,
};

// ── App factory ───────────────────────────────────────────────────────────────
/**
 * Builds a minimal Fastify app with authRoutes registered.
 * When `user` is provided, a preHandler injects it as the authenticated user
 * (simulating what the auth plugin would do in production).
 */
async function buildApp(opts: { user?: typeof adminUser | typeof regularUser } = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  // Provide type augmentation properties expected by route handlers
  app.decorateRequest('user', null);
  app.decorateRequest('scopes', null);
  app.decorateRequest('authMethod', 'none');

  // Convert Zod validation errors to 400 Bad Request (mirrors production behavior)
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({ error: 'Bad Request', issues: error.issues });
    }
    return reply.status(500).send({ error: 'Internal Server Error', message: error.message });
  });

  if (opts.user) {
    const { user } = opts;
    const scopes = user.role === 'admin'
      ? ['read', 'write', 'delete', 'admin']
      : ['read', 'write'];
    app.addHook('preHandler', async (request: any) => {
      request.user = user;
      request.scopes = scopes;
      request.authMethod = 'jwt';
    });
  }

  await app.register(authRoutes);
  await app.ready();
  return app;
}

// ── Reset between tests ───────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  mockAuditLog.log.mockResolvedValue('audit-id');
  mockRequireRoleHandler = vi.fn(async (_req: unknown, _reply: unknown) => {});
});

afterEach(async () => {
  // Fastify instances are lightweight; nothing to tear down explicitly per-test.
});

// =============================================================================
// POST /login
// =============================================================================

describe('POST /login', () => {
  it('returns 400 for invalid body (missing fields)', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: '/login', payload: {} });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when email is not a valid email', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST', url: '/login',
      payload: { email: 'not-an-email', password: 'password123' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when password is too short', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST', url: '/login',
      payload: { email: 'test@test.com', password: 'short' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 401 when credentials are invalid', async () => {
    mockAuthService.authenticateUser.mockResolvedValue({ valid: false, error: 'Invalid credentials' });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST', url: '/login',
      payload: { email: 'bad@test.com', password: 'wrongpassword' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ error: 'Unauthorized', message: 'Invalid email or password' });
  });

  it('logs a failed login attempt to audit', async () => {
    mockAuthService.authenticateUser.mockResolvedValue({ valid: false, error: 'Invalid credentials' });
    const app = await buildApp();
    await app.inject({
      method: 'POST', url: '/login',
      payload: { email: 'bad@test.com', password: 'wrongpassword' },
    });
    expect(mockAuditLog.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'auth.login_failed' }));
  });

  it('returns 200 with user and tokens on successful login', async () => {
    mockAuthService.authenticateUser.mockResolvedValue({ valid: true, user: adminUser });
    mockAuthService.generateJwt.mockReturnValue(mockTokens);
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST', url: '/login',
      payload: { email: 'admin@test.com', password: 'password123' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.user).toMatchObject({ id: adminUser.id, email: adminUser.email, role: 'admin' });
    expect(body.accessToken).toBe('mock.access.token');
    expect(body.refreshToken).toBe('mock-refresh-token');
  });

  it('logs a successful login to audit', async () => {
    mockAuthService.authenticateUser.mockResolvedValue({ valid: true, user: adminUser });
    mockAuthService.generateJwt.mockReturnValue(mockTokens);
    const app = await buildApp();
    await app.inject({
      method: 'POST', url: '/login',
      payload: { email: 'admin@test.com', password: 'password123' },
    });
    expect(mockAuditLog.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.login_success', userId: adminUser.id }),
    );
  });
});

// =============================================================================
// POST /register
// =============================================================================

describe('POST /register', () => {
  it('returns 400 for missing fields', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: '/register', payload: {} });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when name is too short', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST', url: '/register',
      payload: { email: 'user@test.com', name: 'A', password: 'password123' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when password is too short', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST', url: '/register',
      payload: { email: 'user@test.com', name: 'Alice', password: 'short' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 201 with user and tokens on successful registration', async () => {
    mockAuthService.createUser.mockResolvedValue(regularUser);
    mockAuthService.generateJwt.mockReturnValue(mockTokens);
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST', url: '/register',
      payload: { email: 'alice@test.com', name: 'Alice', password: 'password123' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.user).toMatchObject({ id: regularUser.id, email: regularUser.email });
    expect(body.accessToken).toBe('mock.access.token');
  });

  it('logs registration to audit', async () => {
    mockAuthService.createUser.mockResolvedValue(regularUser);
    mockAuthService.generateJwt.mockReturnValue(mockTokens);
    const app = await buildApp();
    await app.inject({
      method: 'POST', url: '/register',
      payload: { email: 'alice@test.com', name: 'Alice', password: 'password123' },
    });
    expect(mockAuditLog.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.register', userId: regularUser.id }),
    );
  });

  it('returns 409 on duplicate email (unique constraint violation)', async () => {
    const uniqueError = Object.assign(new Error('duplicate key'), { code: '23505' });
    mockAuthService.createUser.mockRejectedValue(uniqueError);
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST', url: '/register',
      payload: { email: 'existing@test.com', name: 'Alice', password: 'password123' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ error: 'Conflict', message: 'Email already registered' });
  });

  it('re-throws unexpected errors from createUser', async () => {
    mockAuthService.createUser.mockRejectedValue(new Error('DB exploded'));
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST', url: '/register',
      payload: { email: 'new@test.com', name: 'New User', password: 'password123' },
    });
    expect(res.statusCode).toBe(500);
  });
});

// =============================================================================
// POST /refresh
// =============================================================================

describe('POST /refresh', () => {
  it('returns 400 when refreshToken is missing', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: '/refresh', payload: {} });
    expect(res.statusCode).toBe(400);
  });

  it('returns 501 Not Implemented for any valid refresh request', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST', url: '/refresh',
      payload: { refreshToken: 'some-refresh-token' },
    });
    expect(res.statusCode).toBe(501);
    expect(res.json()).toMatchObject({ error: 'Not Implemented' });
  });
});

// =============================================================================
// POST /logout
// =============================================================================

describe('POST /logout', () => {
  it('returns 401 when no user is authenticated', async () => {
    const app = await buildApp(); // no user
    const res = await app.inject({ method: 'POST', url: '/logout', payload: {} });
    expect(res.statusCode).toBe(401);
  });

  it('returns 200 success when authenticated without Bearer token', async () => {
    const app = await buildApp({ user: regularUser });
    const res = await app.inject({ method: 'POST', url: '/logout', payload: {} });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ success: true });
  });

  it('revokes the JWT when a valid Bearer token is supplied', async () => {
    mockAuthService.revokeToken.mockResolvedValue(undefined);
    const app = await buildApp({ user: regularUser });

    // Build a minimal fake JWT payload so the revokeToken path is hit
    const payload = { sub: regularUser.id, jti: 'test-jti-123', exp: Math.floor(Date.now() / 1000) + 3600 };
    const fakeToken = `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.sig`;

    const res = await app.inject({
      method: 'POST', url: '/logout',
      headers: { authorization: `Bearer ${fakeToken}` },
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    expect(mockAuthService.revokeToken).toHaveBeenCalledWith('test-jti-123', regularUser.id, expect.any(Date));
  });

  it('succeeds even when Bearer token payload is malformed', async () => {
    const app = await buildApp({ user: regularUser });
    const res = await app.inject({
      method: 'POST', url: '/logout',
      headers: { authorization: 'Bearer header.!!!bad-base64!!!.sig' },
      payload: {},
    });
    // Parse error is swallowed; should still succeed
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ success: true });
  });

  it('logs logout to audit', async () => {
    const app = await buildApp({ user: regularUser });
    await app.inject({ method: 'POST', url: '/logout', payload: {} });
    expect(mockAuditLog.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.logout', userId: regularUser.id }),
    );
  });
});

// =============================================================================
// GET /me
// =============================================================================

describe('GET /me', () => {
  it('returns 401 when not authenticated', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/me' });
    expect(res.statusCode).toBe(401);
  });

  it('returns user profile for authenticated user', async () => {
    const app = await buildApp({ user: regularUser });
    const res = await app.inject({ method: 'GET', url: '/me' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe(regularUser.id);
    expect(body.email).toBe(regularUser.email);
    expect(body.name).toBe(regularUser.name);
    expect(body.role).toBe('user');
    expect(body.authMethod).toBe('jwt');
  });

  it('includes scopes in the response', async () => {
    const app = await buildApp({ user: adminUser });
    const res = await app.inject({ method: 'GET', url: '/me' });
    const body = res.json();
    expect(body.scopes).toContain('admin');
    expect(body.scopes).toContain('read');
  });
});

// =============================================================================
// GET /api-keys
// =============================================================================

describe('GET /api-keys', () => {
  it('returns 401 when not authenticated', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/api-keys' });
    expect(res.statusCode).toBe(401);
  });

  it('returns empty list when user has no api keys', async () => {
    mockDb.query.mockResolvedValue({ rows: [], rowCount: 0, fields: [] });
    const app = await buildApp({ user: regularUser });
    const res = await app.inject({ method: 'GET', url: '/api-keys' });
    expect(res.statusCode).toBe(200);
    expect(res.json().apiKeys).toEqual([]);
  });

  it('returns mapped api keys list', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        {
          id: 'key-uuid-1',
          name: 'My CI Key',
          key_prefix: 'tc_abcde',
          scopes: ['read', 'write'],
          expires_at: null,
          last_used_at: null,
          created_at: new Date('2024-01-01'),
        },
      ],
      rowCount: 1,
      fields: [],
    });
    const app = await buildApp({ user: regularUser });
    const res = await app.inject({ method: 'GET', url: '/api-keys' });
    expect(res.statusCode).toBe(200);
    const { apiKeys } = res.json();
    expect(apiKeys).toHaveLength(1);
    expect(apiKeys[0].id).toBe('key-uuid-1');
    expect(apiKeys[0].name).toBe('My CI Key');
    expect(apiKeys[0].keyPrefix).toBe('tc_abcde...');
    expect(apiKeys[0].scopes).toEqual(['read', 'write']);
  });
});

// =============================================================================
// POST /api-keys
// =============================================================================

describe('POST /api-keys', () => {
  it('returns 401 when not authenticated', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST', url: '/api-keys',
      payload: { name: 'New Key' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 400 when name is missing', async () => {
    const app = await buildApp({ user: regularUser });
    const res = await app.inject({ method: 'POST', url: '/api-keys', payload: {} });
    expect(res.statusCode).toBe(400);
  });

  it('returns 201 with the new key on success', async () => {
    mockAuthService.generateApiKey.mockResolvedValue({ key: 'tc_newkeyvalue', id: 'new-key-id' });
    const app = await buildApp({ user: regularUser });
    const res = await app.inject({
      method: 'POST', url: '/api-keys',
      payload: { name: 'My New Key' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.id).toBe('new-key-id');
    expect(body.key).toBe('tc_newkeyvalue');
    expect(body.warning).toMatch(/Save this key/i);
  });

  it('uses default scopes [read, write] when none provided', async () => {
    mockAuthService.generateApiKey.mockResolvedValue({ key: 'tc_x', id: 'key-id' });
    const app = await buildApp({ user: regularUser });
    await app.inject({
      method: 'POST', url: '/api-keys',
      payload: { name: 'Key Without Scopes' },
    });
    expect(mockAuthService.generateApiKey).toHaveBeenCalledWith(
      regularUser.id, 'Key Without Scopes', ['read', 'write'], undefined,
    );
  });

  it('passes custom scopes when provided', async () => {
    mockAuthService.generateApiKey.mockResolvedValue({ key: 'tc_y', id: 'key-id-2' });
    const app = await buildApp({ user: regularUser });
    await app.inject({
      method: 'POST', url: '/api-keys',
      payload: { name: 'Read-only Key', scopes: ['read'] },
    });
    expect(mockAuthService.generateApiKey).toHaveBeenCalledWith(
      regularUser.id, 'Read-only Key', ['read'], undefined,
    );
  });

  it('computes expiresAt from expiresInDays', async () => {
    mockAuthService.generateApiKey.mockResolvedValue({ key: 'tc_z', id: 'key-id-3' });
    const before = Date.now();
    const app = await buildApp({ user: regularUser });
    await app.inject({
      method: 'POST', url: '/api-keys',
      payload: { name: 'Expiring Key', expiresInDays: 30 },
    });
    const after = Date.now();
    const callArgs = mockAuthService.generateApiKey.mock.calls[0];
    const expiresAt: Date = callArgs[3] as Date;
    expect(expiresAt).toBeInstanceOf(Date);
    const expectedMs = 30 * 24 * 60 * 60 * 1000;
    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + expectedMs - 100);
    expect(expiresAt.getTime()).toBeLessThanOrEqual(after + expectedMs + 100);
  });

  it('returns 400 when expiresInDays is out of range', async () => {
    const app = await buildApp({ user: regularUser });
    const res = await app.inject({
      method: 'POST', url: '/api-keys',
      payload: { name: 'Bad Expiry', expiresInDays: 400 },
    });
    expect(res.statusCode).toBe(400);
  });

  it('logs api_key.create to audit', async () => {
    mockAuthService.generateApiKey.mockResolvedValue({ key: 'tc_k', id: 'audit-key-id' });
    const app = await buildApp({ user: regularUser });
    await app.inject({
      method: 'POST', url: '/api-keys',
      payload: { name: 'Audit Test Key' },
    });
    expect(mockAuditLog.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'api_key.create', userId: regularUser.id }),
    );
  });
});

// =============================================================================
// DELETE /api-keys/:id
// =============================================================================

describe('DELETE /api-keys/:id', () => {
  it('returns 401 when not authenticated', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'DELETE', url: '/api-keys/some-id' });
    expect(res.statusCode).toBe(401);
  });

  it('returns 404 when key is not found or not owned by user', async () => {
    mockAuthService.revokeApiKey.mockResolvedValue(false);
    const app = await buildApp({ user: regularUser });
    const res = await app.inject({ method: 'DELETE', url: '/api-keys/nonexistent-id' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: 'Not Found' });
  });

  it('returns 200 and logs audit on successful revocation', async () => {
    mockAuthService.revokeApiKey.mockResolvedValue(true);
    const app = await buildApp({ user: regularUser });
    const res = await app.inject({ method: 'DELETE', url: '/api-keys/valid-key-id' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ success: true });
    expect(mockAuthService.revokeApiKey).toHaveBeenCalledWith('valid-key-id', regularUser.id);
    expect(mockAuditLog.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'api_key.revoke', userId: regularUser.id }),
    );
  });
});

// =============================================================================
// GET /users  (admin only)
// =============================================================================

describe('GET /users', () => {
  it('returns 403 when requireRole blocks the request', async () => {
    // Override the mock so requireRole returns a handler that sends 403
    mockRequireRoleHandler = vi.fn(async (_req: any, reply: any) => {
      await reply.status(403).send({ error: 'Forbidden', message: 'Required role: admin' });
    });
    mockDb.query.mockResolvedValue({ rows: [], rowCount: 0, fields: [] });
    const app = await buildApp({ user: regularUser });
    const res = await app.inject({ method: 'GET', url: '/users' });
    expect(res.statusCode).toBe(403);
  });

  it('returns user list when requireRole passes', async () => {
    const dbUsers = [
      { id: 'u-1', email: 'a@test.com', name: 'A', role: 'admin', is_active: true, created_at: new Date(), updated_at: new Date() },
      { id: 'u-2', email: 'b@test.com', name: 'B', role: 'user', is_active: true, created_at: new Date(), updated_at: new Date() },
    ];
    mockDb.query.mockResolvedValue({ rows: dbUsers, rowCount: 2, fields: [] });
    // requireRole passes through (default mock handler)
    const app = await buildApp({ user: adminUser });
    const res = await app.inject({ method: 'GET', url: '/users' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.users).toHaveLength(2);
    expect(body.users[0].email).toBe('a@test.com');
  });
});
