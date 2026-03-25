/**
 * Audit Service Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../database/yugabyte-client.js', () => ({
  db: { query: vi.fn() },
}));

vi.mock('../../common/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { auditLog, logAudit } from './audit.service.js';
import { db } from '../database/yugabyte-client.js';

const mockDb = vi.mocked(db);

describe('AuditService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Skip DB schema initialization in every test
    (auditLog as any).initialized = true;
  });

  // ============================================================================
  // log()
  // ============================================================================

  describe('log()', () => {
    it('inserts a full audit entry and returns the new ID', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'audit-001' }], rowCount: 1, fields: [] });

      const id = await auditLog.log({
        action: 'user.login',
        userId: 'user-456',
        resource: 'auth',
        resourceId: 'session-789',
        details: { ip: '1.2.3.4' },
        result: 'success',
      });

      expect(id).toBe('audit-001');
      expect(mockDb.query).toHaveBeenCalledOnce();

      const [sql, params] = mockDb.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('INSERT INTO audit_logs');
      expect(params[0]).toBe('user.login');       // action
      expect(params[1]).toBe('user-456');          // userId
      expect(params[2]).toBe('auth');              // resource
      expect(params[3]).toBe('session-789');       // resourceId
      expect(JSON.parse(params[4] as string)).toEqual({ ip: '1.2.3.4' }); // details JSON
      expect(params[7]).toBe('success');           // result
    });

    it('uses null for omitted optional fields', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'audit-002' }], rowCount: 1, fields: [] });

      await auditLog.log({ action: 'minimal', resource: 'thing' });

      const [, params] = mockDb.query.mock.calls[0] as [string, unknown[]];
      expect(params[1]).toBeNull();  // userId
      expect(params[3]).toBeNull();  // resourceId
      expect(params[7]).toBe('success'); // result defaults to success
      expect(params[8]).toBeNull();  // errorMessage
    });

    it('defaults result to "success" when not provided', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'x' }], rowCount: 1, fields: [] });
      await auditLog.log({ action: 'test', resource: 'res' });

      const [, params] = mockDb.query.mock.calls[0] as [string, unknown[]];
      expect(params[7]).toBe('success');
    });

    it('truncates userAgent to 500 characters', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'y' }], rowCount: 1, fields: [] });
      const longAgent = 'A'.repeat(600);
      await auditLog.log({ action: 'browse', resource: 'page', userAgent: longAgent });

      const [, params] = mockDb.query.mock.calls[0] as [string, unknown[]];
      expect((params[6] as string).length).toBe(500);
    });

    it('returns empty string and does not throw when DB query fails', async () => {
      mockDb.query.mockRejectedValueOnce(new Error('DB down'));
      await expect(auditLog.log({ action: 'fail', resource: 'thing' })).resolves.toBe('');
    });

    it('serializes an empty details object when details is omitted', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'z' }], rowCount: 1, fields: [] });
      await auditLog.log({ action: 'bare', resource: 'r' });

      const [, params] = mockDb.query.mock.calls[0] as [string, unknown[]];
      expect(JSON.parse(params[4] as string)).toEqual({});
    });
  });

  // ============================================================================
  // logSuccess() / logFailure()
  // ============================================================================

  describe('logSuccess()', () => {
    it('delegates to log() with result="success"', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'ok-1' }], rowCount: 1, fields: [] });
      const id = await auditLog.logSuccess({ action: 'create', resource: 'plan' });
      expect(id).toBe('ok-1');

      const [, params] = mockDb.query.mock.calls[0] as [string, unknown[]];
      expect(params[7]).toBe('success');
    });
  });

  describe('logFailure()', () => {
    it('delegates to log() with result="failure" and errorMessage', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'fail-1' }], rowCount: 1, fields: [] });
      const id = await auditLog.logFailure({ action: 'delete', resource: 'plan' }, 'Not allowed');
      expect(id).toBe('fail-1');

      const [, params] = mockDb.query.mock.calls[0] as [string, unknown[]];
      expect(params[7]).toBe('failure');
      expect(params[8]).toBe('Not allowed');
    });
  });

  // ============================================================================
  // query()
  // ============================================================================

  describe('query()', () => {
    it('returns logs and total for an empty options object', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: '3' }], rowCount: 1, fields: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], rowCount: 3, fields: [] });

      const result = await auditLog.query({});
      expect(result.total).toBe(3);
      expect(result.logs).toHaveLength(3);
    });

    it('applies userId, resource, and action filters', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1, fields: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'r1' }], rowCount: 1, fields: [] });

      await auditLog.query({ userId: 'u1', resource: 'plan', action: 'create' });

      const [countSql, countParams] = mockDb.query.mock.calls[0] as [string, unknown[]];
      expect(countSql).toContain('user_id = $1');
      expect(countSql).toContain('resource = $2');
      expect(countSql).toContain('action LIKE $3');
      expect(countParams).toContain('u1');
      expect(countParams).toContain('plan');
      expect(countParams).toContain('create%');
    });

    it('applies date range filters', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1, fields: [] })
        .mockResolvedValueOnce({ rows: [], rowCount: 0, fields: [] });

      const start = new Date('2025-01-01');
      const end = new Date('2025-12-31');
      await auditLog.query({ startDate: start, endDate: end });

      const [countSql, countParams] = mockDb.query.mock.calls[0] as [string, unknown[]];
      expect(countSql).toContain('timestamp >=');
      expect(countSql).toContain('timestamp <=');
      expect(countParams).toContain(start);
      expect(countParams).toContain(end);
    });

    it('defaults limit to 100 and offset to 0', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1, fields: [] })
        .mockResolvedValueOnce({ rows: [], rowCount: 0, fields: [] });

      await auditLog.query({});
      const [, logsParams] = mockDb.query.mock.calls[1] as [string, unknown[]];
      expect(logsParams).toContain(100);
      expect(logsParams).toContain(0);
    });
  });

  // ============================================================================
  // cleanup()
  // ============================================================================

  describe('cleanup()', () => {
    it('returns the number of deleted rows', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 42, fields: [] });
      await expect(auditLog.cleanup(90)).resolves.toBe(42);
    });

    it('returns 0 when rowCount is null', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: null, fields: [] });
      await expect(auditLog.cleanup()).resolves.toBe(0);
    });

    it('uses a cutoff date approximately retentionDays in the past', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 0, fields: [] });
      const now = Date.now();
      await auditLog.cleanup(30);

      const [, params] = mockDb.query.mock.calls[0] as [string, unknown[]];
      const cutoff = params[0] as Date;
      const diffDays = (now - cutoff.getTime()) / (24 * 60 * 60 * 1000);
      // Allow ±1 day to handle DST and clock differences
      expect(diffDays).toBeGreaterThanOrEqual(29);
      expect(diffDays).toBeLessThanOrEqual(31);
    });
  });

  // ============================================================================
  // logAudit() convenience export
  // ============================================================================

  describe('logAudit()', () => {
    it('delegates to auditLog.log()', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'conv-1' }], rowCount: 1, fields: [] });
      const id = await logAudit({ action: 'export', resource: 'report' });
      expect(id).toBe('conv-1');
    });
  });
});
