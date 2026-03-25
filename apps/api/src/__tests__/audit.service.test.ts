/**
 * Vitest suite for AuditService
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock db before importing audit service
vi.mock('../modules/database/yugabyte-client.js', () => ({
  db: {
    query: vi.fn(),
  },
}));

import { auditLog, logAudit } from '../modules/audit/audit.service.js';
import { db } from '../modules/database/yugabyte-client.js';

const mockDb = vi.mocked(db);

// Force initialized = true to skip DDL in initialize()
beforeEach(() => {
  vi.clearAllMocks();
  (auditLog as any).initialized = true;

  mockDb.query.mockResolvedValue({
    rows: [{ id: 'audit-uuid-123' }],
    rowCount: 1,
    fields: [],
  });
});

describe('AuditService.log', () => {
  it('inserts a row and returns the generated id', async () => {
    const id = await auditLog.log({
      action: 'user.login',
      userId: 'user-abc',
      resource: 'auth',
      result: 'success',
    });
    expect(id).toBe('audit-uuid-123');
  });

  it('passes action as first param', async () => {
    await auditLog.log({ action: 'plan.create', resource: 'plan' });
    const params = (mockDb.query.mock.calls[0] as any[])[1];
    expect(params[0]).toBe('plan.create');
  });

  it('passes null for userId when not provided', async () => {
    await auditLog.log({ action: 'minimal', resource: 'thing' });
    const params = (mockDb.query.mock.calls[0] as any[])[1];
    expect(params[1]).toBeNull();
  });

  it('passes userId when provided', async () => {
    await auditLog.log({ action: 'act', userId: 'u-999', resource: 'r' });
    const params = (mockDb.query.mock.calls[0] as any[])[1];
    expect(params[1]).toBe('u-999');
  });

  it('passes resource as third param', async () => {
    await auditLog.log({ action: 'act', resource: 'execution' });
    const params = (mockDb.query.mock.calls[0] as any[])[1];
    expect(params[2]).toBe('execution');
  });

  it('serializes details as JSON', async () => {
    await auditLog.log({ action: 'a', resource: 'r', details: { foo: 'bar', count: 3 } });
    const params = (mockDb.query.mock.calls[0] as any[])[1];
    const details = JSON.parse(params[4]);
    expect(details.foo).toBe('bar');
    expect(details.count).toBe(3);
  });

  it('uses {} for details when not provided', async () => {
    await auditLog.log({ action: 'a', resource: 'r' });
    const params = (mockDb.query.mock.calls[0] as any[])[1];
    expect(JSON.parse(params[4])).toEqual({});
  });

  it('defaults result to success', async () => {
    await auditLog.log({ action: 'a', resource: 'r' });
    const params = (mockDb.query.mock.calls[0] as any[])[1];
    expect(params[7]).toBe('success');
  });

  it('passes provided result', async () => {
    await auditLog.log({ action: 'a', resource: 'r', result: 'failure' });
    const params = (mockDb.query.mock.calls[0] as any[])[1];
    expect(params[7]).toBe('failure');
  });

  it('passes errorMessage when provided', async () => {
    await auditLog.log({ action: 'a', resource: 'r', errorMessage: 'oops' });
    const params = (mockDb.query.mock.calls[0] as any[])[1];
    expect(params[8]).toBe('oops');
  });

  it('returns empty string and does not throw when db.query fails', async () => {
    mockDb.query.mockRejectedValueOnce(new Error('db down'));
    const id = await auditLog.log({ action: 'a', resource: 'r' });
    expect(id).toBe('');
  });

  it('truncates userAgent to 500 chars', async () => {
    const longAgent = 'A'.repeat(600);
    await auditLog.log({ action: 'a', resource: 'r', userAgent: longAgent });
    const params = (mockDb.query.mock.calls[0] as any[])[1];
    expect(params[6].length).toBe(500);
  });
});

describe('AuditService.logSuccess', () => {
  it('calls log with result=success', async () => {
    const logSpy = vi.spyOn(auditLog, 'log');
    await auditLog.logSuccess({ action: 'read', resource: 'plan' });
    expect(logSpy).toHaveBeenCalledWith(expect.objectContaining({ result: 'success' }));
  });
});

describe('AuditService.logFailure', () => {
  it('calls log with result=failure and errorMessage', async () => {
    const logSpy = vi.spyOn(auditLog, 'log');
    await auditLog.logFailure({ action: 'delete', resource: 'plan' }, 'not authorized');
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({ result: 'failure', errorMessage: 'not authorized' })
    );
  });
});

describe('AuditService.query', () => {
  beforeEach(() => {
    mockDb.query
      .mockResolvedValueOnce({ rows: [{ count: '5' }], rowCount: 1, fields: [] })   // count
      .mockResolvedValueOnce({ rows: [], rowCount: 0, fields: [] });                  // logs
  });

  it('returns total count and empty logs when no results', async () => {
    const result = await auditLog.query({});
    expect(result.total).toBe(5);
    expect(result.logs).toEqual([]);
  });

  it('applies userId filter', async () => {
    await auditLog.query({ userId: 'u-123' });
    const countQuery = (mockDb.query.mock.calls[0] as any[])[0] as string;
    expect(countQuery).toContain('user_id');
  });

  it('applies resource filter', async () => {
    await auditLog.query({ resource: 'plan' });
    const countQuery = (mockDb.query.mock.calls[0] as any[])[0] as string;
    expect(countQuery).toContain('resource');
  });

  it('uses default limit of 100 when not specified', async () => {
    await auditLog.query({});
    const logsQuery = (mockDb.query.mock.calls[1] as any[])[1] as any[];
    // last params are limit + offset
    expect(logsQuery[logsQuery.length - 2]).toBe(100);
    expect(logsQuery[logsQuery.length - 1]).toBe(0);
  });
});

describe('logAudit convenience function', () => {
  it('delegates to auditLog.log', async () => {
    const logSpy = vi.spyOn(auditLog, 'log');
    await logAudit({ action: 'test', resource: 'r' });
    expect(logSpy).toHaveBeenCalledWith({ action: 'test', resource: 'r' });
  });
});

describe('AuditService.initialize', () => {
  it('skips re-initialization when already initialized', async () => {
    (auditLog as any).initialized = true;
    await (auditLog as any).initialize();
    // db.query should NOT be called because it was already initialized
    expect(mockDb.query).not.toHaveBeenCalled();
  });

  it('creates table and indexes on first initialize', async () => {
    (auditLog as any).initialized = false;
    mockDb.query.mockResolvedValue({ rows: [], rowCount: 0, fields: [] });

    await (auditLog as any).initialize();

    expect(mockDb.query).toHaveBeenCalled();
    const firstCall = (mockDb.query.mock.calls[0] as any[])[0] as string;
    expect(firstCall).toContain('audit_logs');
    expect((auditLog as any).initialized).toBe(true);
  });
});
