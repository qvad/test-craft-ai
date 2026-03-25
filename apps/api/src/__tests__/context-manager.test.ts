/**
 * Tests for ExecutionContextManager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ExecutionContextManager,
  createExecutionContext,
  type VariableScope,
} from '../modules/context/context-manager.js';

describe('ExecutionContextManager', () => {
  let ctx: ExecutionContextManager;

  beforeEach(() => {
    ctx = new ExecutionContextManager('exec-001');
  });

  // ============================================================================
  // Variable set/get
  // ============================================================================

  describe('setVariable / getVariable', () => {
    it('stores and retrieves a string variable', () => {
      ctx.setVariable('greeting', 'hello');
      expect(ctx.getVariable('greeting')).toBe('hello');
    });

    it('stores and retrieves a number variable', () => {
      ctx.setVariable('count', 42);
      expect(ctx.getVariable('count')).toBe(42);
    });

    it('stores and retrieves a boolean variable', () => {
      ctx.setVariable('flag', true);
      expect(ctx.getVariable('flag')).toBe(true);
    });

    it('stores and retrieves an object variable', () => {
      const obj = { a: 1, b: 'two' };
      ctx.setVariable('payload', obj);
      expect(ctx.getVariable('payload')).toEqual(obj);
    });

    it('returns undefined for non-existent variable', () => {
      expect(ctx.getVariable('nonexistent')).toBeUndefined();
    });

    it('respects explicit scope on get', () => {
      ctx.setVariable('x', 'plan-value', { scope: 'plan' });
      ctx.setVariable('x', 'global-value', { scope: 'global' });
      expect(ctx.getVariable('x', 'plan')).toBe('plan-value');
      expect(ctx.getVariable('x', 'global')).toBe('global-value');
    });

    it('searches scopes in priority order: node > thread > plan > global', () => {
      ctx.setVariable('x', 'global-value', { scope: 'global' });
      ctx.setVariable('x', 'plan-value', { scope: 'plan' });
      // Without explicit scope, 'plan' should be found before 'global'
      expect(ctx.getVariable('x')).toBe('plan-value');

      ctx.setVariable('x', 'node-value', { scope: 'node' });
      expect(ctx.getVariable('x')).toBe('node-value');
    });

    it('overwrites an existing variable on re-set', () => {
      ctx.setVariable('key', 'v1');
      ctx.setVariable('key', 'v2');
      expect(ctx.getVariable('key')).toBe('v2');
    });
  });

  // ============================================================================
  // hasVariable
  // ============================================================================

  describe('hasVariable', () => {
    it('returns true for existing variable', () => {
      ctx.setVariable('exists', 123);
      expect(ctx.hasVariable('exists')).toBe(true);
    });

    it('returns false for missing variable', () => {
      expect(ctx.hasVariable('missing')).toBe(false);
    });
  });

  // ============================================================================
  // Sensitive variable encryption
  // ============================================================================

  describe('sensitive variable handling', () => {
    it('encrypts sensitive string variables at rest', () => {
      ctx.setVariable('password', 'supersecret', { sensitive: true });
      // Access the raw internal map to confirm value is not plaintext
      const internalVars = (ctx as any).variables as Map<string, any>;
      const entry = internalVars.get('plan:password');
      expect(entry.encrypted).toBe(true);
      expect(entry.value).not.toBe('supersecret');
    });

    it('decrypts sensitive variable transparently on getVariable', () => {
      ctx.setVariable('secret', 'my-secret-value', { sensitive: true });
      expect(ctx.getVariable('secret')).toBe('my-secret-value');
    });

    it('does not encrypt non-string sensitive values', () => {
      ctx.setVariable('count', 99, { sensitive: true });
      expect(ctx.getVariable('count')).toBe(99);
    });
  });

  // ============================================================================
  // getVariablesForScope
  // ============================================================================

  describe('getVariablesForScope', () => {
    it('returns only variables for the requested scope', () => {
      ctx.setVariable('a', 1, { scope: 'plan' });
      ctx.setVariable('b', 2, { scope: 'global' });
      const planVars = ctx.getVariablesForScope('plan');
      expect(planVars).toHaveProperty('a', 1);
      expect(planVars).not.toHaveProperty('b');
    });

    it('masks sensitive variable values when masked=true (default)', () => {
      ctx.setVariable('token', 'abc123', { scope: 'plan', sensitive: true });
      const vars = ctx.getVariablesForScope('plan');
      expect(vars['token']).toBe('********');
    });

    it('returns decrypted sensitive value when masked=false', () => {
      ctx.setVariable('token', 'abc123', { scope: 'plan', sensitive: true });
      const vars = ctx.getVariablesForScope('plan', false);
      expect(vars['token']).toBe('abc123');
    });

    it('returns empty object when no variables in scope', () => {
      expect(ctx.getVariablesForScope('node')).toEqual({});
    });
  });

  // ============================================================================
  // maskSensitiveData
  // ============================================================================

  describe('maskSensitiveData', () => {
    it('masks password in text', () => {
      const masked = ctx.maskSensitiveData('password=supersecret123');
      expect(masked).not.toContain('supersecret123');
      expect(masked).toContain('****');
    });

    it('masks API keys in text', () => {
      const masked = ctx.maskSensitiveData('api_key=sk-abcdefghij1234');
      expect(masked).not.toContain('sk-abcdefghij1234');
    });

    it('masks bearer tokens', () => {
      const masked = ctx.maskSensitiveData('Authorization: Bearer eyJhbGciOiJIUzI1NiJ9');
      expect(masked).not.toContain('eyJhbGciOiJIUzI1NiJ9');
    });

    it('masks known sensitive variable values in text', () => {
      ctx.setVariable('myApiKey', 'sk-very-secret-value-xyz', { sensitive: true });
      const masked = ctx.maskSensitiveData('Using key: sk-very-secret-value-xyz in request');
      expect(masked).not.toContain('sk-very-secret-value-xyz');
    });

    it('passes through non-sensitive text unchanged', () => {
      const text = 'hello world 12345';
      expect(ctx.maskSensitiveData(text)).toBe(text);
    });

    it('masks short (≤4 char) sensitive variable values with ********', () => {
      ctx.setVariable('pin', 'abc', { sensitive: true });
      const masked = ctx.maskSensitiveData('pin is abc here');
      expect(masked).not.toContain('abc');
      expect(masked).toContain('********');
    });

    it('masks non-encrypted sensitive string variable values', () => {
      // Directly set a sensitive var with a non-string value (number) — value won't be encrypted
      ctx.setVariable('numSecret', 42, { sensitive: true });
      // maskSensitiveData should not throw and should leave unrelated text intact
      expect(() => ctx.maskSensitiveData('some text 42')).not.toThrow();
    });

    it('handles corrupted encrypted data in sensitive variable gracefully', () => {
      // Force a corrupted encrypted object into the internal variables map
      const internalVars = (ctx as any).variables as Map<string, any>;
      internalVars.set('plan:broken', {
        name: 'broken',
        value: { encrypted: 'bad-data', iv: 'bad-iv', tag: 'bad-tag' },
        scope: 'plan',
        sensitive: true,
        encrypted: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        type: 'string',
      });
      // Should not throw — catch block is exercised and masking is skipped for this entry
      expect(() => ctx.maskSensitiveData('some text')).not.toThrow();
    });
  });

  // ============================================================================
  // Database connections
  // ============================================================================

  describe('registerConnection / getConnection / getConnectionString', () => {
    const connBase = {
      type: 'postgresql' as const,
      host: 'db.example.com',
      port: 5432,
      database: 'mydb',
      username: 'admin',
      password: 'pass1234',
    };

    it('registers a connection and returns an id', () => {
      const id = ctx.registerConnection(connBase);
      expect(id).toBeTruthy();
      expect(id).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('retrieves connection with decrypted password', () => {
      const id = ctx.registerConnection(connBase);
      const conn = ctx.getConnection(id);
      expect(conn).toBeDefined();
      expect(conn!.password).toBe('pass1234');
      expect(conn!.host).toBe('db.example.com');
    });

    it('returns undefined for unknown connection id', () => {
      expect(ctx.getConnection('nonexistent-id')).toBeUndefined();
    });

    it('also stores connection as a context variable', () => {
      const id = ctx.registerConnection(connBase);
      const varVal = ctx.getVariable(`connection_${id}`);
      expect(varVal).toBeDefined();
      expect(varVal.host).toBe('db.example.com');
      expect(varVal).not.toHaveProperty('password'); // password is not in the variable
    });

    it('builds postgresql connection string', () => {
      const id = ctx.registerConnection(connBase);
      const cs = ctx.getConnectionString(id);
      expect(cs).toBe('postgresql://admin:pass1234@db.example.com:5432/mydb');
    });

    it('builds mysql connection string', () => {
      const id = ctx.registerConnection({ ...connBase, type: 'mysql', database: 'orders' });
      expect(ctx.getConnectionString(id)).toBe('mysql://admin:pass1234@db.example.com:5432/orders');
    });

    it('builds mongodb connection string', () => {
      const id = ctx.registerConnection({ ...connBase, type: 'mongodb' });
      expect(ctx.getConnectionString(id)).toContain('mongodb://');
    });

    it('builds redis connection string without database', () => {
      const id = ctx.registerConnection({ ...connBase, type: 'redis' });
      const cs = ctx.getConnectionString(id);
      expect(cs).toContain('redis://');
      expect(cs).not.toContain('/mydb');
    });

    it('returns undefined connection string for unknown id', () => {
      expect(ctx.getConnectionString('unknown')).toBeUndefined();
    });

    it('builds yugabyte connection string (same scheme as postgresql)', () => {
      const id = ctx.registerConnection({ ...connBase, type: 'yugabyte' });
      expect(ctx.getConnectionString(id)).toMatch(/^postgresql:\/\//);
    });

    it('returns undefined connection string for unknown connection type', () => {
      const id = ctx.registerConnection(connBase);
      // Force an unknown type via internal state
      const internalConns = (ctx as any).connections as Map<string, any>;
      const conn = internalConns.get(id)!;
      internalConns.set(id, { ...conn, type: 'unknown-db' });
      expect(ctx.getConnectionString(id)).toBeUndefined();
    });
  });

  // ============================================================================
  // Logging
  // ============================================================================

  describe('log / getLogs', () => {
    it('stores log entries', () => {
      ctx.log('info', 'test message');
      const logs = ctx.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toContain('test message');
      expect(logs[0].level).toBe('info');
    });

    it('filters logs by minimum level', () => {
      ctx.log('debug', 'debug msg');
      ctx.log('info', 'info msg');
      ctx.log('warn', 'warn msg');
      ctx.log('error', 'error msg');

      const warnAndAbove = ctx.getLogs({ level: 'warn' });
      expect(warnAndAbove).toHaveLength(2);
      expect(warnAndAbove.every(l => l.level === 'warn' || l.level === 'error')).toBe(true);
    });

    it('filters logs by nodeId', () => {
      ctx.log('info', 'node A message', undefined, { nodeId: 'node-a' });
      ctx.log('info', 'node B message', undefined, { nodeId: 'node-b' });
      const nodeLogs = ctx.getLogs({ nodeId: 'node-a' });
      expect(nodeLogs).toHaveLength(1);
      expect(nodeLogs[0].message).toContain('node A');
    });

    it('masks sensitive data in log messages', () => {
      ctx.log('info', 'connecting with password=s3cr3t-value');
      const logs = ctx.getLogs();
      expect(logs[0].message).not.toContain('s3cr3t-value');
    });

    it('attaches nodeId and nodeName metadata', () => {
      ctx.log('info', 'step done', { result: 'ok' }, { nodeId: 'n1', nodeName: 'MyNode' });
      const logs = ctx.getLogs();
      expect(logs[0].nodeId).toBe('n1');
      expect(logs[0].nodeName).toBe('MyNode');
    });

    it('emits a log event', () => {
      const handler = vi.fn();
      ctx.on('log', handler);
      ctx.log('warn', 'event test');
      expect(handler).toHaveBeenCalledOnce();
    });
  });

  // ============================================================================
  // Snapshots
  // ============================================================================

  describe('createSnapshot / restoreSnapshot', () => {
    it('creates a snapshot and returns an id', () => {
      ctx.setVariable('v1', 'before');
      const snapId = ctx.createSnapshot();
      expect(snapId).toBeTruthy();
    });

    it('restores variables from a snapshot', () => {
      ctx.setVariable('v1', 'before');
      const snapId = ctx.createSnapshot();
      ctx.setVariable('v1', 'after');
      expect(ctx.getVariable('v1')).toBe('after');

      const restored = ctx.restoreSnapshot(snapId);
      expect(restored).toBe(true);
      expect(ctx.getVariable('v1')).toBe('before');
    });

    it('returns false for unknown snapshot id', () => {
      expect(ctx.restoreSnapshot('no-such-id')).toBe(false);
    });

    it('multiple snapshots are independent', () => {
      ctx.setVariable('n', 1);
      const snap1 = ctx.createSnapshot();
      ctx.setVariable('n', 2);
      const snap2 = ctx.createSnapshot();

      ctx.restoreSnapshot(snap1);
      expect(ctx.getVariable('n')).toBe(1);

      ctx.restoreSnapshot(snap2);
      expect(ctx.getVariable('n')).toBe(2);
    });
  });

  // ============================================================================
  // Code injection generation
  // ============================================================================

  describe('generateCodeInjection', () => {
    beforeEach(() => {
      ctx.setVariable('host', 'localhost');
      ctx.setVariable('port', 3000);
      ctx.setVariable('debug', true);
    });

    it('generates Python injection with variable assignments', () => {
      const code = ctx.generateCodeInjection('python', ['host', 'port', 'debug']);
      expect(code).toContain('# === TestCraft Context Injection ===');
      expect(code).toContain('host = """localhost"""');
      expect(code).toContain('port = 3000');
      expect(code).toContain('debug = true');
    });

    it('generates JavaScript injection with const declarations', () => {
      const code = ctx.generateCodeInjection('javascript', ['host', 'port']);
      expect(code).toContain('// === TestCraft Context Injection ===');
      expect(code).toContain('const host =');
      expect(code).toContain('const port =');
    });

    it('generates TypeScript injection (same as JavaScript)', () => {
      const code = ctx.generateCodeInjection('typescript', ['host']);
      expect(code).toContain('const host =');
    });

    it('generates Java injection with static final fields', () => {
      const code = ctx.generateCodeInjection('java', ['host', 'port', 'debug']);
      expect(code).toContain('class TestCraftContext');
      expect(code).toContain('public static final String host');
      expect(code).toContain('public static final int port = 3000');
      expect(code).toContain('public static final boolean debug = true');
    });

    it('generates C# injection with static readonly fields', () => {
      const code = ctx.generateCodeInjection('csharp', ['host', 'port', 'debug']);
      expect(code).toContain('public static class TestCraftContext');
      expect(code).toContain('public static readonly string host');
      expect(code).toContain('public static readonly int port = 3000');
    });

    it('generates Go injection with var declarations', () => {
      const code = ctx.generateCodeInjection('go', ['host', 'port', 'debug']);
      expect(code).toContain('var host =');
      expect(code).toContain('var port int = 3000');
      expect(code).toContain('var debug bool = true');
    });

    it('generates Ruby injection with variable assignments', () => {
      const code = ctx.generateCodeInjection('ruby', ['host', 'port']);
      expect(code).toContain('# === TestCraft Context Injection ===');
      expect(code).toContain('host = %q{localhost}');
      expect(code).toContain('port = 3000');
    });

    it('generates generic injection for unknown language', () => {
      const code = ctx.generateCodeInjection('cobol', ['host']);
      expect(code).toContain('__context');
      expect(code).toContain('localhost');
    });

    it('injects connection config when connectionIds provided', () => {
      const id = ctx.registerConnection({
        type: 'postgresql',
        host: 'pg.host',
        port: 5432,
        database: 'mydb',
        username: 'user',
        password: 'pass',
      });
      const code = ctx.generateCodeInjection('python', [], [id]);
      expect(code).toContain('pg.host');
      expect(code).toContain('5432');
    });

    it('skips variables that do not exist in context', () => {
      const code = ctx.generateCodeInjection('python', ['nonexistent']);
      // Should not throw, just skip missing variables
      expect(code).toBeDefined();
      expect(code).not.toContain('nonexistent =');
    });

    it('generates Python injection with object value', () => {
      ctx.setVariable('cfg', { key: 'val' });
      const code = ctx.generateCodeInjection('python', ['cfg']);
      expect(code).toContain('cfg = {"key":"val"}');
    });

    it('generates JavaScript injection with connection config', () => {
      const id = ctx.registerConnection({
        type: 'postgresql',
        host: 'js.host',
        port: 5432,
        database: 'jsdb',
        username: 'user',
        password: 'pass',
      });
      const code = ctx.generateCodeInjection('javascript', [], [id]);
      expect(code).toContain('js.host');
    });

    it('generates Java injection with float and connection config', () => {
      ctx.setVariable('ratio', 3.14);
      const id = ctx.registerConnection({
        type: 'postgresql',
        host: 'java.host',
        port: 5432,
        database: 'jdb',
        username: 'u',
        password: 'p',
      });
      const code = ctx.generateCodeInjection('java', ['ratio'], [id]);
      expect(code).toContain('public static final double ratio = 3.14');
      expect(code).toContain('java.host');
    });

    it('generates C# injection with float and connection config', () => {
      ctx.setVariable('pi', 3.14159);
      const id = ctx.registerConnection({
        type: 'postgresql',
        host: 'cs.host',
        port: 5432,
        database: 'csdb',
        username: 'u',
        password: 'p',
      });
      const code = ctx.generateCodeInjection('csharp', ['pi'], [id]);
      expect(code).toContain('public static readonly double pi = 3.14159');
      expect(code).toContain('cs.host');
    });

    it('generates C# injection via c# alias', () => {
      const code = ctx.generateCodeInjection('c#', ['host']);
      expect(code).toContain('public static class TestCraftContext');
    });

    it('generates Go injection with float and connection config', () => {
      ctx.setVariable('ratio', 2.71);
      const id = ctx.registerConnection({
        type: 'postgresql',
        host: 'go.host',
        port: 5432,
        database: 'godb',
        username: 'u',
        password: 'p',
      });
      const code = ctx.generateCodeInjection('go', ['ratio'], [id]);
      expect(code).toContain('var ratio float64 = 2.71');
      expect(code).toContain('go.host');
    });

    it('generates Ruby injection with object value and connection config', () => {
      ctx.setVariable('opts', { timeout: 30 });
      const id = ctx.registerConnection({
        type: 'postgresql',
        host: 'rb.host',
        port: 5432,
        database: 'rbdb',
        username: 'u',
        password: 'p',
      });
      const code = ctx.generateCodeInjection('ruby', ['opts'], [id]);
      expect(code).toContain('opts = {"timeout":30}');
      expect(code).toContain('rb.host');
    });
  });

  // ============================================================================
  // export
  // ============================================================================

  describe('export', () => {
    it('exports variables with masked sensitive values', () => {
      ctx.setVariable('public', 'visible');
      ctx.setVariable('secret', 'hidden', { sensitive: true });
      const exported = ctx.export();
      const pub = exported.variables.find(v => v.name === 'public');
      const sec = exported.variables.find(v => v.name === 'secret');
      expect(pub?.value).toBe('visible');
      expect(sec?.value).toBe('********');
    });

    it('exports connections without password', () => {
      const id = ctx.registerConnection({
        type: 'postgresql',
        host: 'db.host',
        port: 5432,
        database: 'db',
        username: 'user',
        password: 'secret',
      });
      const exported = ctx.export();
      const conn = exported.connections.find(c => c.id === id);
      expect(conn).toBeDefined();
      expect(conn).not.toHaveProperty('password');
    });

    it('exports logs', () => {
      ctx.log('info', 'exported log');
      const exported = ctx.export();
      expect(exported.logs.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // clear
  // ============================================================================

  describe('clear', () => {
    it('removes all variables, connections, logs, and snapshots', () => {
      ctx.setVariable('x', 1);
      ctx.registerConnection({
        type: 'redis',
        host: 'redis.host',
        port: 6379,
        username: 'u',
        password: 'p',
      });
      ctx.log('info', 'some log');
      ctx.createSnapshot();

      ctx.clear();

      expect(ctx.getVariable('x')).toBeUndefined();
      const exported = ctx.export();
      expect(exported.variables).toHaveLength(0);
      expect(exported.connections).toHaveLength(0);
      expect(exported.logs).toHaveLength(0);
    });
  });

  // ============================================================================
  // createExecutionContext factory
  // ============================================================================

  describe('createExecutionContext', () => {
    it('returns a new ExecutionContextManager instance', () => {
      const c = createExecutionContext('new-exec-id');
      expect(c).toBeInstanceOf(ExecutionContextManager);
    });

    it('creates independent contexts', () => {
      const c1 = createExecutionContext('id-1');
      const c2 = createExecutionContext('id-2');
      c1.setVariable('v', 'from-c1');
      expect(c2.getVariable('v')).toBeUndefined();
    });
  });

  // ============================================================================
  // EventEmitter integration
  // ============================================================================

  describe('EventEmitter', () => {
    it('emits variable:set event when variable is set', () => {
      const handler = vi.fn();
      ctx.on('variable:set', handler);
      ctx.setVariable('y', 'value');
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'y', scope: 'plan', sensitive: false })
      );
    });
  });
});
