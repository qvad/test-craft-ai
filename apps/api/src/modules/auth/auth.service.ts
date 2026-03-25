/**
 * Authentication Service
 * Handles JWT tokens and API key validation using YugabyteDB
 */

import crypto from 'crypto';
import { db } from '../database/yugabyte-client.js';
import { logger } from '../../common/logger.js';
import { config } from '../../config/index.js';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user' | 'viewer';
  createdAt: Date;
}

export interface ApiKey {
  id: string;
  name: string;
  keyHash: string;
  userId: string;
  scopes: string[];
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
}

export interface JwtPayload {
  sub: string;        // User ID
  email: string;
  role: string;
  iat: number;        // Issued at
  exp: number;        // Expiration
  jti: string;        // JWT ID for revocation
}

export interface AuthResult {
  valid: boolean;
  user?: User;
  scopes?: string[];
  error?: string;
}

class AuthService {
  private readonly jwtSecret: string;
  private readonly jwtExpiry: number;
  private initialized = false;

  constructor() {
    this.jwtSecret = config.auth.jwtSecret;
    this.jwtExpiry = config.auth.jwtExpirySeconds;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Create users table
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        password_hash TEXT,
        role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user', 'viewer')),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create API keys table
    await db.query(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        key_prefix TEXT NOT NULL,
        key_hash TEXT NOT NULL,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        scopes TEXT[] DEFAULT ARRAY['read'],
        expires_at TIMESTAMP WITH TIME ZONE,
        last_used_at TIMESTAMP WITH TIME ZONE,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create JWT revocation table (for logout/token invalidation)
    await db.query(`
      CREATE TABLE IF NOT EXISTS revoked_tokens (
        jti TEXT PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        revoked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL
      )
    `);

    // Create sessions table for refresh tokens
    await db.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        refresh_token_hash TEXT NOT NULL,
        user_agent TEXT,
        ip_address TEXT,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create indexes
    await db.query('CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expires ON revoked_tokens(expires_at)');

    this.initialized = true;
    logger.info('Auth schema initialized');
  }

  // ============================================================================
  // Password Hashing
  // ============================================================================

  async hashPassword(password: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const salt = crypto.randomBytes(16).toString('hex');
      crypto.scrypt(password, salt, 64, (err, derivedKey) => {
        if (err) return reject(err);
        resolve(`${salt}:${derivedKey.toString('hex')}`);
      });
    });
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    if (!hash || !hash.includes(':')) {
      return false;
    }
    return new Promise((resolve, reject) => {
      const [salt, key] = hash.split(':');
      crypto.scrypt(password, salt, 64, (err, derivedKey) => {
        if (err) return reject(err);
        resolve(crypto.timingSafeEqual(Buffer.from(key, 'hex'), derivedKey));
      });
    });
  }

  // ============================================================================
  // JWT Token Management
  // ============================================================================

  generateJwt(user: User): { accessToken: string; refreshToken: string; expiresIn: number } {
    const now = Math.floor(Date.now() / 1000);
    const jti = crypto.randomUUID();

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      iat: now,
      exp: now + this.jwtExpiry,
      jti,
    };

    // Simple JWT encoding (for production, use jsonwebtoken library)
    const header = this.base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const body = this.base64UrlEncode(JSON.stringify(payload));
    const signature = this.sign(`${header}.${body}`);
    const accessToken = `${header}.${body}.${signature}`;

    // Generate refresh token
    const refreshToken = crypto.randomBytes(32).toString('hex');

    return {
      accessToken,
      refreshToken,
      expiresIn: this.jwtExpiry,
    };
  }

  async verifyJwt(token: string): Promise<AuthResult> {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return { valid: false, error: 'Invalid token format' };
      }

      const [header, body, signature] = parts;
      const expectedSignature = this.sign(`${header}.${body}`);

      const sigBuf = Buffer.from(signature, 'base64url');
      const expectedSigBuf = Buffer.from(expectedSignature, 'base64url');
      if (sigBuf.length !== expectedSigBuf.length ||
          !crypto.timingSafeEqual(sigBuf, expectedSigBuf)) {
        return { valid: false, error: 'Invalid signature' };
      }

      const payload: JwtPayload = JSON.parse(this.base64UrlDecode(body));
      const now = Math.floor(Date.now() / 1000);

      if (payload.exp < now) {
        return { valid: false, error: 'Token expired' };
      }

      // Check if token is revoked
      const revoked = await db.query<{ jti: string }>(
        'SELECT jti FROM revoked_tokens WHERE jti = $1',
        [payload.jti]
      );

      if (revoked.rows.length > 0) {
        return { valid: false, error: 'Token revoked' };
      }

      // Get user
      const userResult = await db.query<User>(
        'SELECT id, email, name, role, created_at FROM users WHERE id = $1 AND is_active = true',
        [payload.sub]
      );

      if (userResult.rows.length === 0) {
        return { valid: false, error: 'User not found' };
      }

      return {
        valid: true,
        user: userResult.rows[0],
        scopes: this.getScopesForRole(payload.role),
      };
    } catch (error) {
      logger.error({ error }, 'JWT verification failed');
      return { valid: false, error: 'Token verification failed' };
    }
  }

  async revokeToken(jti: string, userId: string, expiresAt: Date): Promise<void> {
    await db.query(
      'INSERT INTO revoked_tokens (jti, user_id, expires_at) VALUES ($1, $2, $3) ON CONFLICT (jti) DO NOTHING',
      [jti, userId, expiresAt]
    );
  }

  // ============================================================================
  // API Key Management
  // ============================================================================

  async generateApiKey(userId: string, name: string, scopes: string[], expiresAt?: Date): Promise<{ key: string; id: string }> {
    const key = `tc_${crypto.randomBytes(24).toString('hex')}`;
    const keyPrefix = key.substring(0, 10);
    const keyHash = crypto.createHash('sha256').update(key).digest('hex');

    const result = await db.query<{ id: string }>(
      `INSERT INTO api_keys (name, key_prefix, key_hash, user_id, scopes, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [name, keyPrefix, keyHash, userId, scopes, expiresAt || null]
    );

    return { key, id: result.rows[0].id };
  }

  async verifyApiKey(key: string): Promise<AuthResult> {
    try {
      if (!key.startsWith('tc_')) {
        return { valid: false, error: 'Invalid API key format' };
      }

      const keyPrefix = key.substring(0, 10);
      const keyHash = crypto.createHash('sha256').update(key).digest('hex');

      const result = await db.query<{
        id: string;
        user_id: string;
        scopes: string[];
        expires_at: Date | null;
      }>(
        `SELECT ak.id, ak.user_id, ak.scopes, ak.expires_at
         FROM api_keys ak
         WHERE ak.key_prefix = $1 AND ak.key_hash = $2 AND ak.is_active = true`,
        [keyPrefix, keyHash]
      );

      if (result.rows.length === 0) {
        return { valid: false, error: 'Invalid API key' };
      }

      const apiKey = result.rows[0];

      if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
        return { valid: false, error: 'API key expired' };
      }

      // Update last used timestamp
      await db.query(
        'UPDATE api_keys SET last_used_at = NOW() WHERE id = $1',
        [apiKey.id]
      );

      // Get user
      const userResult = await db.query<User>(
        'SELECT id, email, name, role, created_at FROM users WHERE id = $1 AND is_active = true',
        [apiKey.user_id]
      );

      if (userResult.rows.length === 0) {
        return { valid: false, error: 'User not found' };
      }

      return {
        valid: true,
        user: userResult.rows[0],
        scopes: apiKey.scopes,
      };
    } catch (error) {
      logger.error({ error }, 'API key verification failed');
      return { valid: false, error: 'API key verification failed' };
    }
  }

  async revokeApiKey(keyId: string, userId: string): Promise<boolean> {
    const result = await db.query(
      'UPDATE api_keys SET is_active = false WHERE id = $1 AND user_id = $2',
      [keyId, userId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  // ============================================================================
  // User Management
  // ============================================================================

  async createUser(email: string, name: string, password: string, role: 'admin' | 'user' | 'viewer' = 'user'): Promise<User> {
    const passwordHash = await this.hashPassword(password);

    const result = await db.query<User>(
      `INSERT INTO users (email, name, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name, role, created_at`,
      [email, name, passwordHash, role]
    );

    return result.rows[0];
  }

  async authenticateUser(email: string, password: string): Promise<AuthResult> {
    const result = await db.query<{ id: string; email: string; name: string; role: string; password_hash: string; created_at: Date }>(
      'SELECT id, email, name, role, password_hash, created_at FROM users WHERE email = $1 AND is_active = true',
      [email]
    );

    if (result.rows.length === 0) {
      return { valid: false, error: 'Invalid credentials' };
    }

    const user = result.rows[0];
    const passwordValid = await this.verifyPassword(password, user.password_hash);

    if (!passwordValid) {
      return { valid: false, error: 'Invalid credentials' };
    }

    return {
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as 'admin' | 'user' | 'viewer',
        createdAt: user.created_at,
      },
    };
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private getScopesForRole(role: string): string[] {
    switch (role) {
      case 'admin':
        return ['read', 'write', 'delete', 'admin'];
      case 'user':
        return ['read', 'write'];
      case 'viewer':
        return ['read'];
      default:
        return ['read'];
    }
  }

  private sign(data: string): string {
    return crypto
      .createHmac('sha256', this.jwtSecret)
      .update(data)
      .digest('base64url');
  }

  private base64UrlEncode(data: string): string {
    return Buffer.from(data).toString('base64url');
  }

  private base64UrlDecode(data: string): string {
    return Buffer.from(data, 'base64url').toString('utf-8');
  }

  // Cleanup expired tokens (should run periodically)
  async cleanupExpiredTokens(): Promise<number> {
    const result = await db.query(
      'DELETE FROM revoked_tokens WHERE expires_at < NOW()'
    );
    return result.rowCount ?? 0;
  }
}

export const authService = new AuthService();
