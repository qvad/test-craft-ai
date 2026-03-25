/**
 * HOCON Parser for TestCraft Test Plans
 *
 * Parses HOCON configuration files into TestCraft test plan objects.
 * Supports:
 * - Comments (# and //)
 * - Multi-line strings (""")
 * - Object/array syntax
 * - Substitutions (${variable})
 * - Includes
 * - Environment variable references (${env.VAR})
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { createRequire } from 'module';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../common/logger.js';
import type {
  HoconTestPlan,
  HoconNode,
  HoconVariable,
  HoconConnection,
} from '@testcraft/shared-types';

const _require = createRequire(import.meta.url);
// hocon-parser is a CommonJS module; import via createRequire so NodeNext ESM can use it.
const hoconParserLib: (text: string) => any = _require('hocon-parser');

export interface ParseOptions {
  basePath?: string;
  environment?: string;
  variables?: Record<string, unknown>;
  resolveIncludes?: boolean;
}

export interface ParseResult {
  plan: HoconTestPlan;
  errors: ParseError[];
  warnings: string[];
  includes: string[];
}

export interface ParseError {
  line?: number;
  column?: number;
  message: string;
}

export class HoconParser {
  private options: ParseOptions;
  private includes: string[] = [];
  private errors: ParseError[] = [];
  private warnings: string[] = [];

  constructor(options: ParseOptions = {}) {
    this.options = {
      basePath: process.cwd(),
      resolveIncludes: true,
      ...options,
    };
  }

  /**
   * Parse HOCON string into test plan
   */
  async parse(content: string): Promise<ParseResult> {
    this.includes = [];
    this.errors = [];
    this.warnings = [];
    return this.parseInternal(content);
  }

  // Preprocess HOCON content to fix hocon-parser library compatibility:
  // 1. Normalize line endings (CRLF -> LF)
  // 2. Strip block comments (slash-star ... star-slash) which the parser doesn't support
  // 3. Convert HOCON fallback syntax "${?VAR} defaultValue" -> "defaultValue"
  //    The hocon-parser treats both ' and " as string delimiters and can't handle unquoted
  //    number defaults after a substitution token, causing "Already met separator" errors.
  private preprocessHocon(content: string): string {
    return content
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Strip /* ... */ block comments — string-aware: skip matches that are inside a quoted
      // string (triple-quoted or double-quoted) so we don't corrupt values like "See /* docs */"
      .replace(/("""[\s\S]*?"""|"(?:[^"\\]|\\.)*")|(\/\*[\s\S]*?\*\/)/g, (_m, str, comment) =>
        comment ? '' : str,
      )
      // Convert bare include directives to key=value form: include "file" → include = "file"
      // This lets the hocon-parser produce include: "file" instead of mangling the key
      .replace(/^(\s*)include\s+("(?:[^"\\]|\\.)*")/gm, '$1include = $2')
      // Convert "${?VAR} "default"" → "default" (quoted string fallback)
      .replace(/\$\{[^}]+\}\s+("(?:[^"\\]|\\.)*")/g, '$1')
      // Convert "${?VAR} number" → number (numeric fallback)
      .replace(/\$\{[^}]+\}\s+([0-9]+(?:\.[0-9]+)?)\b/g, '$1')
      // Convert "${?VAR} true/false" → true/false (boolean fallback)
      .replace(/\$\{[^}]+\}\s+(true|false)\b/g, '$1');
  }

  private async parseInternal(content: string): Promise<ParseResult> {
    try {
      // Step 0: Preprocess to fix parser compatibility issues
      content = this.preprocessHocon(content);

      // Step 1: Shield ${...} placeholders from hocon-parser's internal substitution
      // handler, which turns unresolvable references into null. We replace them with
      // safe string tokens, parse, restore, then let resolveSubstitutions handle them.
      const varTokens: string[] = [];
      const shielded = content.replace(/\$\{([^}]+)\}/g, (match) => {
        const token = `__TCVAR${varTokens.length}__`;
        varTokens.push(match);
        return token;
      });

      // Step 2: Parse HOCON using the hocon-parser library.
      // This handles comments, multi-line strings, unquoted keys/values,
      // object shorthand, arrays, and internal document substitutions.
      let parsed: any;
      try {
        parsed = hoconParserLib(shielded);
      } catch (err) {
        this.errors.push({
          message: `HOCON parse error: ${err instanceof Error ? err.message : 'Unknown error'}`,
        });
        throw new Error('Failed to parse HOCON');
      }

      // Step 3: Restore shielded ${...} placeholders in the parsed object.
      if (varTokens.length > 0) {
        parsed = restoreVarTokens(parsed, varTokens);
      }

      // Step 4: Resolve includes
      if (this.options.resolveIncludes) {
        parsed = await this.resolveIncludes(parsed);
      }

      // Step 5: Resolve substitutions (external variables and ${env.VAR})
      parsed = this.resolveSubstitutions(parsed, this.options.variables || {});

      // Step 6: Apply environment overrides
      if (this.options.environment && parsed.testcraft?.plan?.environments) {
        parsed = this.applyEnvironment(parsed, this.options.environment);
      }

      // Step 7: Generate IDs for nodes
      if (parsed.testcraft?.plan?.nodes) {
        parsed.testcraft.plan.nodes = this.generateNodeIds(parsed.testcraft.plan.nodes);
      }

      // Step 8: Validate structure
      this.validateStructure(parsed);

      return {
        plan: parsed as HoconTestPlan,
        errors: this.errors,
        warnings: this.warnings,
        includes: this.includes,
      };
    } catch (err) {
      this.errors.push({
        message: err instanceof Error ? err.message : 'Unknown parse error',
      });
      return {
        plan: { testcraft: { version: '1.0', plan: { name: 'Error', nodes: [] } } },
        errors: this.errors,
        warnings: this.warnings,
        includes: this.includes,
      };
    }
  }

  /**
   * Parse HOCON file
   */
  async parseFile(filePath: string): Promise<ParseResult> {
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.join(this.options.basePath || process.cwd(), filePath);

    try {
      const content = await fs.readFile(absolutePath, 'utf-8');
      this.options.basePath = path.dirname(absolutePath);
      return this.parse(content);
    } catch (err) {
      this.errors.push({
        message: `Failed to read file: ${filePath}`,
      });
      return {
        plan: { testcraft: { version: '1.0', plan: { name: 'Error', nodes: [] } } },
        errors: this.errors,
        warnings: this.warnings,
        includes: [],
      };
    }
  }

  /**
   * Resolve include directives
   */
  private async resolveIncludes(obj: any): Promise<any> {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return Promise.all(obj.map((item) => this.resolveIncludes(item)));
    }

    const result: any = {};

    for (const [key, value] of Object.entries(obj)) {
      if (key === 'include' && typeof value === 'string') {
        // Handle include directive
        this.includes.push(value);
        const includePath = path.join(this.options.basePath || '', value);
        try {
          const includeContent = await fs.readFile(includePath, 'utf-8');
          const parsed = await this.parseInternal(includeContent);
          Object.assign(result, parsed.plan);
        } catch (err) {
          this.warnings.push(`Failed to include: ${value}`);
        }
      } else {
        result[key] = await this.resolveIncludes(value);
      }
    }

    return result;
  }

  /**
   * Resolve variable substitutions
   */
  private resolveSubstitutions(obj: any, variables: Record<string, unknown>): any {
    if (typeof obj === 'string') {
      // Handle ${variable} and ${env.VAR} substitutions
      return obj.replace(/\$\{([^}]+)\}/g, (match, path) => {
        if (path.startsWith('env.')) {
          const envVar = path.substring(4);
          return process.env[envVar] || match;
        }

        // Resolve from variables
        const parts = path.split('.');
        let value: any = variables;
        for (const part of parts) {
          value = value?.[part];
        }

        return value !== undefined ? String(value) : match;
      });
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.resolveSubstitutions(item, variables));
    }

    if (typeof obj === 'object' && obj !== null) {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.resolveSubstitutions(value, variables);
      }
      return result;
    }

    return obj;
  }

  /**
   * Apply environment-specific overrides
   */
  private applyEnvironment(obj: any, environment: string): any {
    const env = obj.testcraft?.plan?.environments?.[environment];
    if (!env) {
      this.warnings.push(`Environment '${environment}' not found`);
      return obj;
    }

    // Handle inheritance
    if (env.extends) {
      const parentEnv = obj.testcraft.plan.environments[env.extends];
      if (parentEnv) {
        Object.assign(env.variables || {}, parentEnv.variables, env.variables);
      }
    }

    // Merge environment variables
    if (env.variables) {
      obj.testcraft.plan.variables = {
        ...obj.testcraft.plan.variables,
        ...Object.fromEntries(
          Object.entries(env.variables).map(([k, v]) => [
            k,
            { type: 'string', value: v },
          ])
        ),
      };
    }

    // Merge connection overrides
    if (env.connections) {
      for (const [name, overrides] of Object.entries(env.connections)) {
        if (obj.testcraft.plan.connections?.[name]) {
          Object.assign(obj.testcraft.plan.connections[name], overrides);
        }
      }
    }

    return obj;
  }

  /**
   * Generate unique IDs for nodes
   */
  private generateNodeIds(nodes: HoconNode[]): HoconNode[] {
    return nodes.map((node) => {
      const newNode = { ...node };
      if (!newNode.id) {
        newNode.id = uuidv4();
      }
      if (newNode.children) {
        newNode.children = this.generateNodeIds(newNode.children);
      }
      return newNode;
    });
  }

  /**
   * Validate the parsed structure
   */
  private validateStructure(obj: any): void {
    if (!obj.testcraft) {
      this.errors.push({ message: 'Missing root "testcraft" element' });
      return;
    }

    if (!obj.testcraft.version) {
      this.warnings.push('Missing version, defaulting to 1.0');
      obj.testcraft.version = '1.0';
    }

    if (!obj.testcraft.plan) {
      this.errors.push({ message: 'Missing "plan" element' });
      return;
    }

    if (!obj.testcraft.plan.name) {
      this.errors.push({ message: 'Missing plan name' });
    }

    if (!obj.testcraft.plan.nodes || !Array.isArray(obj.testcraft.plan.nodes)) {
      this.errors.push({ message: 'Missing or invalid "nodes" array' });
    }
  }
}

/**
 * Serialize test plan to HOCON format
 */
export class HoconSerializer {
  private indentSize: number;

  constructor(indentSize: number = 2) {
    this.indentSize = indentSize;
  }

  /**
   * Serialize test plan to HOCON string
   */
  serialize(plan: HoconTestPlan): string {
    const lines: string[] = [];

    lines.push('# TestCraft Test Plan');
    lines.push(`# Generated: ${new Date().toISOString()}`);
    lines.push('');
    lines.push('testcraft {');
    lines.push(`  version = "${plan.testcraft.version}"`);
    lines.push('');
    lines.push('  plan {');

    const p = plan.testcraft.plan;

    // Basic info
    lines.push(`    name = "${this.escape(p.name)}"`);
    if (p.description) {
      lines.push(`    description = "${this.escape(p.description)}"`);
    }
    if (p.tags && p.tags.length > 0) {
      lines.push(`    tags = [${p.tags.map((t) => `"${t}"`).join(', ')}]`);
    }
    if (p.author) {
      lines.push(`    author = "${this.escape(p.author)}"`);
    }

    // Settings
    if (p.settings) {
      lines.push('');
      lines.push('    settings {');
      lines.push(...this.serializeObject(p.settings, 6));
      lines.push('    }');
    }

    // Variables
    if (p.variables && Object.keys(p.variables).length > 0) {
      lines.push('');
      lines.push('    variables {');
      for (const [name, variable] of Object.entries(p.variables)) {
        lines.push(`      ${name} {`);
        lines.push(...this.serializeObject(variable, 8));
        lines.push('      }');
      }
      lines.push('    }');
    }

    // Environments
    if (p.environments && Object.keys(p.environments).length > 0) {
      lines.push('');
      lines.push('    environments {');
      for (const [name, env] of Object.entries(p.environments)) {
        lines.push(`      ${name} {`);
        lines.push(...this.serializeObject(env, 8));
        lines.push('      }');
      }
      lines.push('    }');
    }

    // Connections
    if (p.connections && Object.keys(p.connections).length > 0) {
      lines.push('');
      lines.push('    connections {');
      for (const [name, conn] of Object.entries(p.connections)) {
        lines.push(`      ${name} {`);
        lines.push(...this.serializeObject(conn, 8));
        lines.push('      }');
      }
      lines.push('    }');
    }

    // Nodes
    lines.push('');
    lines.push('    nodes = [');
    for (const node of p.nodes) {
      lines.push(...this.serializeNode(node, 6));
    }
    lines.push('    ]');

    lines.push('  }');
    lines.push('}');

    return lines.join('\n');
  }

  private serializeNode(node: HoconNode, indent: number): string[] {
    const lines: string[] = [];
    const pad = ' '.repeat(indent);

    lines.push(`${pad}{`);

    if (node.id) {
      lines.push(`${pad}  id = "${node.id}"`);
    }
    lines.push(`${pad}  name = "${this.escape(node.name)}"`);
    lines.push(`${pad}  type = "${node.type}"`);

    if (node.enabled === false) {
      lines.push(`${pad}  enabled = false`);
    }
    if (node.description) {
      lines.push(`${pad}  description = "${this.escape(node.description)}"`);
    }
    if (node.timeout) {
      lines.push(`${pad}  timeout = "${node.timeout}"`);
    }
    if (node.retries) {
      lines.push(`${pad}  retries = ${node.retries}`);
    }

    // Config
    if (node.config && Object.keys(node.config).length > 0) {
      lines.push(`${pad}  config {`);
      lines.push(...this.serializeObject(node.config, indent + 4));
      lines.push(`${pad}  }`);
    }

    // AI config
    if (node.ai) {
      lines.push(`${pad}  ai {`);
      lines.push(...this.serializeObject(node.ai, indent + 4));
      lines.push(`${pad}  }`);
    }

    // Children
    if (node.children && node.children.length > 0) {
      lines.push(`${pad}  children = [`);
      for (const child of node.children) {
        lines.push(...this.serializeNode(child, indent + 4));
      }
      lines.push(`${pad}  ]`);
    }

    lines.push(`${pad}}`);

    return lines;
  }

  private serializeObject(obj: object, indent: number): string[] {
    const lines: string[] = [];
    const pad = ' '.repeat(indent);

    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined || value === null) continue;

      if (typeof value === 'string') {
        lines.push(`${pad}${key} = "${this.escape(value)}"`);
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        lines.push(`${pad}${key} = ${value}`);
      } else if (Array.isArray(value)) {
        if (value.every((v) => typeof v === 'string')) {
          lines.push(`${pad}${key} = [${value.map((v) => `"${v}"`).join(', ')}]`);
        } else {
          lines.push(`${pad}${key} = [`);
          for (const item of value) {
            if (typeof item === 'object') {
              lines.push(`${pad}  {`);
              lines.push(...this.serializeObject(item as Record<string, unknown>, indent + 4));
              lines.push(`${pad}  }`);
            } else {
              lines.push(`${pad}  ${JSON.stringify(item)}`);
            }
          }
          lines.push(`${pad}]`);
        }
      } else if (typeof value === 'object') {
        lines.push(`${pad}${key} {`);
        lines.push(...this.serializeObject(value as Record<string, unknown>, indent + 2));
        lines.push(`${pad}}`);
      }
    }

    return lines;
  }

  private escape(str: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }
}

/**
 * Recursively restore __TCVARn__ tokens back to their original ${...} placeholders.
 */
function restoreVarTokens(obj: any, tokens: string[]): any {
  if (typeof obj === 'string') {
    return obj.replace(/__TCVAR(\d+)__/g, (_, i) => tokens[parseInt(i, 10)]);
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => restoreVarTokens(item, tokens));
  }
  if (typeof obj === 'object' && obj !== null) {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = restoreVarTokens(value, tokens);
    }
    return result;
  }
  return obj;
}

// Export singleton instances
export const hoconParser = new HoconParser();
export const hoconSerializer = new HoconSerializer();

/**
 * Helper function to parse HOCON content using the hocon-parser library.
 * Returns the parsed object, or a safe fallback on error.
 */
export function parseHocon(content: string, _options?: ParseOptions): any {
  try {
    return hoconParserLib(content);
  } catch {
    return { testcraft: { plan: {} } };
  }
}

/**
 * Helper function to serialize to HOCON
 */
export function serializeToHocon(plan: any): string {
  return hoconSerializer.serialize({ testcraft: { version: '1.0', plan } });
}

/**
 * Helper function to validate a test plan
 */
export function validateTestPlan(plan: any): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!plan) {
    errors.push('Plan is empty');
    return { valid: false, errors, warnings };
  }

  if (!plan.name) {
    errors.push('Missing plan name');
  }

  if (!plan.nodes || !Array.isArray(plan.nodes)) {
    errors.push('Missing or invalid "nodes" array');
  }

  if (!plan.version) {
    warnings.push('Missing version, will default to 1.0');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
