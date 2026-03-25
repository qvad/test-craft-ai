/**
 * Execution Context Manager
 *
 * Manages variables, connections, and state across test execution steps.
 * Provides secure handling of sensitive data with encryption and masking.
 */

import * as crypto from 'crypto';
import { EventEmitter } from 'events';

// Encryption key for sensitive data (should be from env in production)
// Accepts any string — hashed to ensure exactly 32 bytes for AES-256
const RAW_ENCRYPTION_KEY = process.env.CONTEXT_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ENCRYPTION_KEY = crypto.createHash('sha256').update(RAW_ENCRYPTION_KEY).digest();
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

export type VariableScope = 'global' | 'plan' | 'node' | 'thread';

export interface ContextVariable {
  name: string;
  value: any;
  scope: VariableScope;
  sensitive: boolean;
  encrypted: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;  // Node ID that created this variable
  type: 'string' | 'number' | 'boolean' | 'object' | 'connection' | 'credential';
}

export interface DatabaseConnection {
  id: string;
  type: 'postgresql' | 'mysql' | 'mongodb' | 'redis' | 'yugabyte';
  host: string;
  port: number;
  database?: string;
  username: string;
  password: string;  // Stored encrypted
  options?: Record<string, any>;
  poolSize?: number;
  timeout?: number;
  createdAt: Date;
}

export interface ContextSnapshot {
  id: string;
  timestamp: Date;
  variables: Map<string, ContextVariable>;
  connections: Map<string, DatabaseConnection>;
}

export interface LogEntry {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  nodeId?: string;
  nodeName?: string;
  message: string;
  data?: any;
  masked?: boolean;
}

export class ExecutionContextManager extends EventEmitter {
  private variables: Map<string, ContextVariable> = new Map();
  private connections: Map<string, DatabaseConnection> = new Map();
  private logs: LogEntry[] = [];
  private sensitivePatterns: RegExp[] = [];
  private executionId: string;
  private snapshots: ContextSnapshot[] = [];

  constructor(executionId: string) {
    super();
    this.executionId = executionId;
    this.initializeSensitivePatterns();
  }

  /**
   * Initialize patterns for sensitive data detection
   */
  private initializeSensitivePatterns(): void {
    this.sensitivePatterns = [
      // Passwords
      /password\s*[=:]\s*['"]?([^'"}\s]+)/gi,
      /pwd\s*[=:]\s*['"]?([^'"}\s]+)/gi,
      // API Keys
      /api[_-]?key\s*[=:]\s*['"]?([^'"}\s]+)/gi,
      /apikey\s*[=:]\s*['"]?([^'"}\s]+)/gi,
      // Tokens
      /token\s*[=:]\s*['"]?([^'"}\s]+)/gi,
      /bearer\s+([^\s'"]+)/gi,
      // Secrets
      /secret\s*[=:]\s*['"]?([^'"}\s]+)/gi,
      // Connection strings
      /postgresql:\/\/[^:]+:([^@]+)@/gi,
      /mysql:\/\/[^:]+:([^@]+)@/gi,
      /mongodb(\+srv)?:\/\/[^:]+:([^@]+)@/gi,
      // Credit cards (basic pattern)
      /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g,
      // SSN
      /\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/g,
    ];
  }

  /**
   * Encrypt sensitive data
   */
  private encrypt(data: string): { encrypted: string; iv: string; tag: string } {
    const iv = crypto.randomBytes(16);
    const key = ENCRYPTION_KEY;
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
    };
  }

  /**
   * Decrypt sensitive data
   */
  private decrypt(encrypted: string, iv: string, tag: string): string {
    const key = ENCRYPTION_KEY;
    const decipher = crypto.createDecipheriv(
      ENCRYPTION_ALGORITHM,
      key,
      Buffer.from(iv, 'hex')
    );
    decipher.setAuthTag(Buffer.from(tag, 'hex'));

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Mask sensitive data in a string
   */
  maskSensitiveData(text: string): string {
    let masked = text;

    // Apply all sensitive patterns
    for (const pattern of this.sensitivePatterns) {
      masked = masked.replace(pattern, (match, group1, group2) => {
        const sensitiveValue = group2 || group1;
        if (sensitiveValue && sensitiveValue.length > 4) {
          return match.replace(sensitiveValue, '****' + sensitiveValue.slice(-4));
        }
        return match.replace(sensitiveValue || match, '********');
      });
    }

    // Mask known sensitive variables
    for (const [name, variable] of this.variables) {
      if (variable.sensitive && variable.value) {
        const valueStr = String(variable.value);
        if (valueStr.length > 4) {
          masked = masked.replace(
            new RegExp(this.escapeRegex(valueStr), 'g'),
            '****' + valueStr.slice(-4)
          );
        } else {
          masked = masked.replace(
            new RegExp(this.escapeRegex(valueStr), 'g'),
            '********'
          );
        }
      }
    }

    return masked;
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Set a variable in the context
   */
  setVariable(
    name: string,
    value: any,
    options: {
      scope?: VariableScope;
      sensitive?: boolean;
      createdBy?: string;
      type?: ContextVariable['type'];
    } = {}
  ): void {
    const {
      scope = 'plan',
      sensitive = false,
      createdBy,
      type = this.inferType(value),
    } = options;

    let storedValue = value;
    let encrypted = false;

    // Encrypt sensitive data
    if (sensitive && typeof value === 'string') {
      const encryptedData = this.encrypt(value);
      storedValue = encryptedData;
      encrypted = true;
    }

    const variable: ContextVariable = {
      name,
      value: storedValue,
      scope,
      sensitive,
      encrypted,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy,
      type,
    };

    this.variables.set(this.getVariableKey(name, scope), variable);
    this.emit('variable:set', { name, scope, sensitive });

    this.log('debug', `Variable set: ${name}`, {
      scope,
      sensitive,
      type,
      createdBy,
    });
  }

  /**
   * Get a variable from the context
   */
  getVariable(name: string, scope?: VariableScope): any {
    // Search in order: node -> plan -> global
    const scopes: VariableScope[] = scope
      ? [scope]
      : ['node', 'thread', 'plan', 'global'];

    for (const s of scopes) {
      const key = this.getVariableKey(name, s);
      const variable = this.variables.get(key);

      if (variable) {
        // Decrypt if encrypted
        if (variable.encrypted && typeof variable.value === 'object') {
          return this.decrypt(
            variable.value.encrypted,
            variable.value.iv,
            variable.value.tag
          );
        }
        return variable.value;
      }
    }

    return undefined;
  }

  /**
   * Check if a variable exists
   */
  hasVariable(name: string, scope?: VariableScope): boolean {
    return this.getVariable(name, scope) !== undefined;
  }

  /**
   * Get all variables for a scope (with masking for sensitive data)
   */
  getVariablesForScope(scope: VariableScope, masked = true): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, variable] of this.variables) {
      if (variable.scope === scope) {
        if (masked && variable.sensitive) {
          result[variable.name] = '********';
        } else if (variable.encrypted) {
          result[variable.name] = this.decrypt(
            variable.value.encrypted,
            variable.value.iv,
            variable.value.tag
          );
        } else {
          result[variable.name] = variable.value;
        }
      }
    }

    return result;
  }

  private getVariableKey(name: string, scope: VariableScope): string {
    return `${scope}:${name}`;
  }

  private inferType(value: any): ContextVariable['type'] {
    if (typeof value === 'string') return 'string';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    return 'object';
  }

  /**
   * Register a database connection
   */
  registerConnection(connection: Omit<DatabaseConnection, 'id' | 'createdAt'>): string {
    const id = crypto.randomUUID();

    // Encrypt password
    const encryptedPassword = this.encrypt(connection.password);

    const dbConnection: DatabaseConnection = {
      ...connection,
      id,
      password: JSON.stringify(encryptedPassword),
      createdAt: new Date(),
    };

    this.connections.set(id, dbConnection);

    // Also set as a context variable for easy access
    this.setVariable(`connection_${id}`, {
      id,
      type: connection.type,
      host: connection.host,
      port: connection.port,
      database: connection.database,
      username: connection.username,
    }, {
      scope: 'plan',
      sensitive: false,
      type: 'connection',
    });

    this.log('info', `Database connection registered: ${id}`, {
      type: connection.type,
      host: connection.host,
      database: connection.database,
    });

    return id;
  }

  /**
   * Get a database connection
   */
  getConnection(id: string): DatabaseConnection | undefined {
    const connection = this.connections.get(id);
    if (!connection) return undefined;

    // Decrypt password for use
    const encryptedPassword = JSON.parse(connection.password);
    const decryptedPassword = this.decrypt(
      encryptedPassword.encrypted,
      encryptedPassword.iv,
      encryptedPassword.tag
    );

    return {
      ...connection,
      password: decryptedPassword,
    };
  }

  /**
   * Get connection string for a database connection
   */
  getConnectionString(id: string): string | undefined {
    const connection = this.getConnection(id);
    if (!connection) return undefined;

    switch (connection.type) {
      case 'postgresql':
      case 'yugabyte':
        return `postgresql://${connection.username}:${connection.password}@${connection.host}:${connection.port}/${connection.database || ''}`;
      case 'mysql':
        return `mysql://${connection.username}:${connection.password}@${connection.host}:${connection.port}/${connection.database || ''}`;
      case 'mongodb':
        return `mongodb://${connection.username}:${connection.password}@${connection.host}:${connection.port}/${connection.database || ''}`;
      case 'redis':
        return `redis://${connection.username}:${connection.password}@${connection.host}:${connection.port}`;
      default:
        return undefined;
    }
  }

  /**
   * Log a message
   */
  log(
    level: LogEntry['level'],
    message: string,
    data?: any,
    options: { nodeId?: string; nodeName?: string } = {}
  ): void {
    // Mask sensitive data in message and data
    const maskedMessage = this.maskSensitiveData(message);
    const maskedData = data ? JSON.parse(
      this.maskSensitiveData(JSON.stringify(data))
    ) : undefined;

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      nodeId: options.nodeId,
      nodeName: options.nodeName,
      message: maskedMessage,
      data: maskedData,
      masked: maskedMessage !== message || JSON.stringify(maskedData) !== JSON.stringify(data),
    };

    this.logs.push(entry);
    this.emit('log', entry);

    // Console output based on level
    const prefix = options.nodeName ? `[${options.nodeName}]` : `[${this.executionId}]`;
    switch (level) {
      case 'debug':
        if (process.env.DEBUG) console.debug(`${prefix} ${maskedMessage}`);
        break;
      case 'info':
        console.info(`${prefix} ${maskedMessage}`);
        break;
      case 'warn':
        console.warn(`${prefix} ${maskedMessage}`);
        break;
      case 'error':
        console.error(`${prefix} ${maskedMessage}`);
        break;
    }
  }

  /**
   * Get all logs
   */
  getLogs(options: { level?: LogEntry['level']; nodeId?: string } = {}): LogEntry[] {
    let filtered = this.logs;

    if (options.level) {
      const levels: LogEntry['level'][] = ['debug', 'info', 'warn', 'error'];
      const minLevel = levels.indexOf(options.level);
      filtered = filtered.filter(log => levels.indexOf(log.level) >= minLevel);
    }

    if (options.nodeId) {
      filtered = filtered.filter(log => log.nodeId === options.nodeId);
    }

    return filtered;
  }

  /**
   * Create a snapshot of the current context
   */
  createSnapshot(): string {
    const snapshot: ContextSnapshot = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      variables: new Map(this.variables),
      connections: new Map(this.connections),
    };

    this.snapshots.push(snapshot);
    return snapshot.id;
  }

  /**
   * Restore context from a snapshot
   */
  restoreSnapshot(snapshotId: string): boolean {
    const snapshot = this.snapshots.find(s => s.id === snapshotId);
    if (!snapshot) return false;

    this.variables = new Map(snapshot.variables);
    this.connections = new Map(snapshot.connections);
    return true;
  }

  /**
   * Generate code injection for a specific language
   */
  generateCodeInjection(
    language: string,
    variableNames: string[],
    connectionIds: string[] = []
  ): string {
    const injections: string[] = [];

    // Get variables to inject
    const varsToInject: Record<string, any> = {};
    for (const name of variableNames) {
      const value = this.getVariable(name);
      if (value !== undefined) {
        varsToInject[name] = value;
      }
    }

    // Get connections to inject
    const connsToInject: Record<string, { host: string; port: number; database?: string; username: string; password: string }> = {};
    for (const id of connectionIds) {
      const conn = this.getConnection(id);
      if (conn) {
        connsToInject[id] = {
          host: conn.host,
          port: conn.port,
          database: conn.database,
          username: conn.username,
          password: conn.password,
        };
      }
    }

    switch (language.toLowerCase()) {
      case 'python':
        return this.generatePythonInjection(varsToInject, connsToInject);
      case 'javascript':
      case 'typescript':
        return this.generateJavaScriptInjection(varsToInject, connsToInject);
      case 'java':
        return this.generateJavaInjection(varsToInject, connsToInject);
      case 'csharp':
      case 'c#':
        return this.generateCSharpInjection(varsToInject, connsToInject);
      case 'go':
        return this.generateGoInjection(varsToInject, connsToInject);
      case 'ruby':
        return this.generateRubyInjection(varsToInject, connsToInject);
      default:
        // Generic JSON format
        return `// Context Variables\nconst __context = ${JSON.stringify(varsToInject, null, 2)};\nconst __connections = ${JSON.stringify(connsToInject, null, 2)};`;
    }
  }

  private generatePythonInjection(
    vars: Record<string, any>,
    connections: Record<string, any>
  ): string {
    const lines: string[] = [
      '# === TestCraft Context Injection ===',
      'import os',
      '',
      '# Context Variables',
    ];

    for (const [name, value] of Object.entries(vars)) {
      if (typeof value === 'string') {
        lines.push(`${name} = """${value.replace(/"""/g, '\\"\\"\\"')}"""`);
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        lines.push(`${name} = ${value}`);
      } else {
        lines.push(`${name} = ${JSON.stringify(value)}`);
      }
    }

    lines.push('', '# Database Connections');
    for (const [id, conn] of Object.entries(connections)) {
      const safeName = id.replace(/-/g, '_');
      lines.push(`${safeName}_config = {`);
      lines.push(`    "host": "${conn.host}",`);
      lines.push(`    "port": ${conn.port},`);
      lines.push(`    "database": "${conn.database || ''}",`);
      lines.push(`    "username": "${conn.username}",`);
      lines.push(`    "password": "${conn.password}",`);
      lines.push(`}`);
      lines.push('');
    }

    lines.push('# === End Context Injection ===', '');
    return lines.join('\n');
  }

  private generateJavaScriptInjection(
    vars: Record<string, any>,
    connections: Record<string, any>
  ): string {
    const lines: string[] = [
      '// === TestCraft Context Injection ===',
      '',
      '// Context Variables',
      `const __testcraft_context = ${JSON.stringify(vars, null, 2)};`,
      '',
      '// Destructure for easy access',
    ];

    for (const name of Object.keys(vars)) {
      lines.push(`const ${name} = __testcraft_context['${name}'];`);
    }

    lines.push('', '// Database Connections');
    lines.push(`const __testcraft_connections = ${JSON.stringify(connections, null, 2)};`);

    for (const [id, conn] of Object.entries(connections)) {
      const safeName = id.replace(/-/g, '_');
      lines.push(`const ${safeName}_config = __testcraft_connections['${id}'];`);
    }

    lines.push('', '// === End Context Injection ===', '');
    return lines.join('\n');
  }

  private generateJavaInjection(
    vars: Record<string, any>,
    connections: Record<string, any>
  ): string {
    const lines: string[] = [
      '// === TestCraft Context Injection ===',
      'import java.util.Map;',
      'import java.util.HashMap;',
      '',
      'class TestCraftContext {',
      '    // Context Variables',
    ];

    for (const [name, value] of Object.entries(vars)) {
      if (typeof value === 'string') {
        lines.push(`    public static final String ${name} = "${value.replace(/"/g, '\\"')}";`);
      } else if (typeof value === 'number') {
        if (Number.isInteger(value)) {
          lines.push(`    public static final int ${name} = ${value};`);
        } else {
          lines.push(`    public static final double ${name} = ${value};`);
        }
      } else if (typeof value === 'boolean') {
        lines.push(`    public static final boolean ${name} = ${value};`);
      }
    }

    lines.push('', '    // Database Connection Configs');
    for (const [id, conn] of Object.entries(connections)) {
      const safeName = id.replace(/-/g, '_');
      lines.push(`    public static Map<String, Object> get_${safeName}_config() {`);
      lines.push(`        Map<String, Object> config = new HashMap<>();`);
      lines.push(`        config.put("host", "${conn.host}");`);
      lines.push(`        config.put("port", ${conn.port});`);
      lines.push(`        config.put("database", "${conn.database || ''}");`);
      lines.push(`        config.put("username", "${conn.username}");`);
      lines.push(`        config.put("password", "${conn.password}");`);
      lines.push(`        return config;`);
      lines.push(`    }`);
    }

    lines.push('}', '// === End Context Injection ===', '');
    return lines.join('\n');
  }

  private generateCSharpInjection(
    vars: Record<string, any>,
    connections: Record<string, any>
  ): string {
    const lines: string[] = [
      '// === TestCraft Context Injection ===',
      'using System;',
      'using System.Collections.Generic;',
      '',
      'public static class TestCraftContext',
      '{',
      '    // Context Variables',
    ];

    for (const [name, value] of Object.entries(vars)) {
      if (typeof value === 'string') {
        lines.push(`    public static readonly string ${name} = @"${value.replace(/"/g, '""')}";`);
      } else if (typeof value === 'number') {
        if (Number.isInteger(value)) {
          lines.push(`    public static readonly int ${name} = ${value};`);
        } else {
          lines.push(`    public static readonly double ${name} = ${value};`);
        }
      } else if (typeof value === 'boolean') {
        lines.push(`    public static readonly bool ${name} = ${value.toString().toLowerCase()};`);
      }
    }

    lines.push('', '    // Database Connection Configs');
    for (const [id, conn] of Object.entries(connections)) {
      const safeName = id.replace(/-/g, '_');
      lines.push(`    public static Dictionary<string, object> Get${safeName}Config() => new()`);
      lines.push(`    {`);
      lines.push(`        ["host"] = "${conn.host}",`);
      lines.push(`        ["port"] = ${conn.port},`);
      lines.push(`        ["database"] = "${conn.database || ''}",`);
      lines.push(`        ["username"] = "${conn.username}",`);
      lines.push(`        ["password"] = "${conn.password}",`);
      lines.push(`    };`);
    }

    lines.push('}', '// === End Context Injection ===', '');
    return lines.join('\n');
  }

  private generateGoInjection(
    vars: Record<string, any>,
    connections: Record<string, any>
  ): string {
    const lines: string[] = [
      '// === TestCraft Context Injection ===',
      '',
      '// Context Variables',
    ];

    for (const [name, value] of Object.entries(vars)) {
      if (typeof value === 'string') {
        // Use double-quoted strings with proper escaping (Go raw strings can't contain backticks)
        const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\t/g, '\\t');
        lines.push(`var ${name} = "${escaped}"`);
      } else if (typeof value === 'number') {
        if (Number.isInteger(value)) {
          lines.push(`var ${name} int = ${value}`);
        } else {
          lines.push(`var ${name} float64 = ${value}`);
        }
      } else if (typeof value === 'boolean') {
        lines.push(`var ${name} bool = ${value}`);
      }
    }

    lines.push('', '// Database Connection Configs');
    lines.push('type DBConfig struct {');
    lines.push('    Host     string');
    lines.push('    Port     int');
    lines.push('    Database string');
    lines.push('    Username string');
    lines.push('    Password string');
    lines.push('}');
    lines.push('');

    for (const [id, conn] of Object.entries(connections)) {
      const safeName = id.replace(/-/g, '_');
      lines.push(`var ${safeName}_config = DBConfig{`);
      lines.push(`    Host:     "${conn.host}",`);
      lines.push(`    Port:     ${conn.port},`);
      lines.push(`    Database: "${conn.database || ''}",`);
      lines.push(`    Username: "${conn.username}",`);
      lines.push(`    Password: "${conn.password}",`);
      lines.push(`}`);
    }

    lines.push('', '// === End Context Injection ===', '');
    return lines.join('\n');
  }

  private generateRubyInjection(
    vars: Record<string, any>,
    connections: Record<string, any>
  ): string {
    const lines: string[] = [
      '# === TestCraft Context Injection ===',
      '',
      '# Context Variables',
    ];

    for (const [name, value] of Object.entries(vars)) {
      if (typeof value === 'string') {
        lines.push(`${name} = %q{${value}}`);
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        lines.push(`${name} = ${value}`);
      } else {
        lines.push(`${name} = ${JSON.stringify(value)}`);
      }
    }

    lines.push('', '# Database Connections');
    for (const [id, conn] of Object.entries(connections)) {
      const safeName = id.replace(/-/g, '_');
      lines.push(`${safeName}_config = {`);
      lines.push(`  host: "${conn.host}",`);
      lines.push(`  port: ${conn.port},`);
      lines.push(`  database: "${conn.database || ''}",`);
      lines.push(`  username: "${conn.username}",`);
      lines.push(`  password: "${conn.password}"`);
      lines.push(`}`);
    }

    lines.push('', '# === End Context Injection ===', '');
    return lines.join('\n');
  }

  /**
   * Export context for serialization
   */
  export(): {
    variables: { name: string; value: any; scope: VariableScope; type: string }[];
    connections: { id: string; type: string; host: string; port: number; database?: string }[];
    logs: LogEntry[];
  } {
    return {
      variables: Array.from(this.variables.values()).map(v => ({
        name: v.name,
        value: v.sensitive ? '********' : (v.encrypted ? '[encrypted]' : v.value),
        scope: v.scope,
        type: v.type,
      })),
      connections: Array.from(this.connections.values()).map(c => ({
        id: c.id,
        type: c.type,
        host: c.host,
        port: c.port,
        database: c.database,
      })),
      logs: this.logs,
    };
  }

  /**
   * Clear all context data
   */
  clear(): void {
    this.variables.clear();
    this.connections.clear();
    this.logs = [];
    this.snapshots = [];
  }
}

/**
 * Factory function to create a new execution context
 */
export function createExecutionContext(executionId: string): ExecutionContextManager {
  return new ExecutionContextManager(executionId);
}
