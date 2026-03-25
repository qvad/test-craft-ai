/**
 * Context Management API Routes
 *
 * API endpoints for managing execution context, variables, and connections.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ExecutionContextManager, createExecutionContext, VariableScope } from './context-manager';
import { logger } from '../../common/logger.js';

// Store active execution contexts
const activeContexts = new Map<string, ExecutionContextManager>();

interface SetVariableBody {
  name: string;
  value: any;
  scope?: VariableScope;
  sensitive?: boolean;
  type?: string;
}

interface RegisterConnectionBody {
  type: 'postgresql' | 'mysql' | 'mongodb' | 'redis' | 'yugabyte';
  host: string;
  port: number;
  database?: string;
  username: string;
  password: string;
  options?: Record<string, any>;
}

interface GenerateCodeInjectionBody {
  language: string;
  variables: string[];
  connectionIds?: string[];
}

export async function contextRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * Create a new execution context
   */
  fastify.post('/executions/:executionId/context', async (
    request: FastifyRequest<{ Params: { executionId: string } }>,
    reply: FastifyReply
  ) => {
    const { executionId } = request.params;

    if (activeContexts.has(executionId)) {
      return reply.status(409).send({
        error: 'Context already exists',
        executionId,
      });
    }

    const context = createExecutionContext(executionId);
    activeContexts.set(executionId, context);

    logger.info('Execution context created', { executionId });

    return reply.status(201).send({
      executionId,
      created: true,
    });
  });

  /**
   * Get execution context status
   */
  fastify.get('/executions/:executionId/context', async (
    request: FastifyRequest<{ Params: { executionId: string } }>,
    reply: FastifyReply
  ) => {
    const { executionId } = request.params;
    const context = activeContexts.get(executionId);

    if (!context) {
      return reply.status(404).send({
        error: 'Context not found',
        executionId,
      });
    }

    return reply.send(context.export());
  });

  /**
   * Set a variable in the context
   */
  fastify.post('/executions/:executionId/context/variables', async (
    request: FastifyRequest<{
      Params: { executionId: string };
      Body: SetVariableBody;
    }>,
    reply: FastifyReply
  ) => {
    const { executionId } = request.params;
    const { name, value, scope, sensitive, type } = request.body;
    const context = activeContexts.get(executionId);

    if (!context) {
      return reply.status(404).send({
        error: 'Context not found',
        executionId,
      });
    }

    context.setVariable(name, value, {
      scope: scope as VariableScope,
      sensitive,
      type: type as any,
    });

    logger.info('Variable set', {
      executionId,
      name,
      scope,
      sensitive,
    });

    return reply.send({
      success: true,
      name,
      scope: scope || 'plan',
    });
  });

  /**
   * Get a variable from the context
   */
  fastify.get('/executions/:executionId/context/variables/:name', async (
    request: FastifyRequest<{
      Params: { executionId: string; name: string };
      Querystring: { scope?: VariableScope };
    }>,
    reply: FastifyReply
  ) => {
    const { executionId, name } = request.params;
    const { scope } = request.query;
    const context = activeContexts.get(executionId);

    if (!context) {
      return reply.status(404).send({
        error: 'Context not found',
        executionId,
      });
    }

    const value = context.getVariable(name, scope);

    if (value === undefined) {
      return reply.status(404).send({
        error: 'Variable not found',
        name,
      });
    }

    return reply.send({
      name,
      value,
    });
  });

  /**
   * Get all variables for a scope
   */
  fastify.get('/executions/:executionId/context/variables', async (
    request: FastifyRequest<{
      Params: { executionId: string };
      Querystring: { scope?: VariableScope; masked?: boolean };
    }>,
    reply: FastifyReply
  ) => {
    const { executionId } = request.params;
    const { scope, masked = true } = request.query;
    const context = activeContexts.get(executionId);

    if (!context) {
      return reply.status(404).send({
        error: 'Context not found',
        executionId,
      });
    }

    if (scope) {
      return reply.send({
        scope,
        variables: context.getVariablesForScope(scope, masked !== false),
      });
    }

    // Return all scopes
    const scopes: VariableScope[] = ['global', 'plan', 'node', 'thread'];
    const result: Record<string, any> = {};

    for (const s of scopes) {
      result[s] = context.getVariablesForScope(s, masked !== false);
    }

    return reply.send(result);
  });

  /**
   * Register a database connection
   */
  fastify.post('/executions/:executionId/context/connections', async (
    request: FastifyRequest<{
      Params: { executionId: string };
      Body: RegisterConnectionBody;
    }>,
    reply: FastifyReply
  ) => {
    const { executionId } = request.params;
    const { type, host, port, database, username, password, options } = request.body;
    const context = activeContexts.get(executionId);

    if (!context) {
      return reply.status(404).send({
        error: 'Context not found',
        executionId,
      });
    }

    const connectionId = context.registerConnection({
      type,
      host,
      port,
      database,
      username,
      password,
      options,
    });

    logger.info('Database connection registered', {
      executionId,
      connectionId,
      type,
      host,
      database,
    });

    return reply.status(201).send({
      connectionId,
      type,
      host,
      port,
      database,
    });
  });

  /**
   * Get a database connection (without password)
   */
  fastify.get('/executions/:executionId/context/connections/:connectionId', async (
    request: FastifyRequest<{
      Params: { executionId: string; connectionId: string };
    }>,
    reply: FastifyReply
  ) => {
    const { executionId, connectionId } = request.params;
    const context = activeContexts.get(executionId);

    if (!context) {
      return reply.status(404).send({
        error: 'Context not found',
        executionId,
      });
    }

    const connection = context.getConnection(connectionId);

    if (!connection) {
      return reply.status(404).send({
        error: 'Connection not found',
        connectionId,
      });
    }

    // Don't expose password
    const { password, ...safeConnection } = connection;

    return reply.send(safeConnection);
  });

  /**
   * Get connection string for a database connection
   */
  fastify.get('/executions/:executionId/context/connections/:connectionId/string', async (
    request: FastifyRequest<{
      Params: { executionId: string; connectionId: string };
    }>,
    reply: FastifyReply
  ) => {
    const { executionId, connectionId } = request.params;
    const context = activeContexts.get(executionId);

    if (!context) {
      return reply.status(404).send({
        error: 'Context not found',
        executionId,
      });
    }

    const connectionString = context.getConnectionString(connectionId);

    if (!connectionString) {
      return reply.status(404).send({
        error: 'Connection not found',
        connectionId,
      });
    }

    return reply.send({
      connectionString,
    });
  });

  /**
   * Generate code injection for a language
   */
  fastify.post('/executions/:executionId/context/code-injection', async (
    request: FastifyRequest<{
      Params: { executionId: string };
      Body: GenerateCodeInjectionBody;
    }>,
    reply: FastifyReply
  ) => {
    const { executionId } = request.params;
    const { language, variables, connectionIds = [] } = request.body;
    const context = activeContexts.get(executionId);

    if (!context) {
      return reply.status(404).send({
        error: 'Context not found',
        executionId,
      });
    }

    const code = context.generateCodeInjection(language, variables, connectionIds);

    return reply.send({
      language,
      code,
    });
  });

  /**
   * Create a context snapshot
   */
  fastify.post('/executions/:executionId/context/snapshots', async (
    request: FastifyRequest<{ Params: { executionId: string } }>,
    reply: FastifyReply
  ) => {
    const { executionId } = request.params;
    const context = activeContexts.get(executionId);

    if (!context) {
      return reply.status(404).send({
        error: 'Context not found',
        executionId,
      });
    }

    const snapshotId = context.createSnapshot();

    return reply.status(201).send({
      snapshotId,
    });
  });

  /**
   * Restore a context snapshot
   */
  fastify.post('/executions/:executionId/context/snapshots/:snapshotId/restore', async (
    request: FastifyRequest<{
      Params: { executionId: string; snapshotId: string };
    }>,
    reply: FastifyReply
  ) => {
    const { executionId, snapshotId } = request.params;
    const context = activeContexts.get(executionId);

    if (!context) {
      return reply.status(404).send({
        error: 'Context not found',
        executionId,
      });
    }

    const success = context.restoreSnapshot(snapshotId);

    if (!success) {
      return reply.status(404).send({
        error: 'Snapshot not found',
        snapshotId,
      });
    }

    return reply.send({
      restored: true,
      snapshotId,
    });
  });

  /**
   * Get execution logs
   */
  fastify.get('/executions/:executionId/context/logs', async (
    request: FastifyRequest<{
      Params: { executionId: string };
      Querystring: {
        level?: string;
        nodeId?: string;
        limit?: number;
      };
    }>,
    reply: FastifyReply
  ) => {
    const { executionId } = request.params;
    const { level, nodeId, limit } = request.query;
    const context = activeContexts.get(executionId);

    if (!context) {
      return reply.status(404).send({
        error: 'Context not found',
        executionId,
      });
    }

    const logs = context.getLogs({
      level: level as any,
      nodeId,
    });

    const limitedLogs = limit ? logs.slice(-limit) : logs;

    return reply.send({
      count: limitedLogs.length,
      logs: limitedLogs,
    });
  });

  /**
   * Delete an execution context
   */
  fastify.delete('/executions/:executionId/context', async (
    request: FastifyRequest<{ Params: { executionId: string } }>,
    reply: FastifyReply
  ) => {
    const { executionId } = request.params;
    const context = activeContexts.get(executionId);

    if (!context) {
      return reply.status(404).send({
        error: 'Context not found',
        executionId,
      });
    }

    context.clear();
    activeContexts.delete(executionId);

    logger.info('Execution context deleted', { executionId });

    return reply.send({
      deleted: true,
      executionId,
    });
  });
}

/**
 * Get context for an execution (for internal use)
 */
export function getExecutionContext(executionId: string): ExecutionContextManager | undefined {
  return activeContexts.get(executionId);
}

/**
 * Create or get context for an execution
 */
export function ensureExecutionContext(executionId: string): ExecutionContextManager {
  let context = activeContexts.get(executionId);
  if (!context) {
    context = createExecutionContext(executionId);
    activeContexts.set(executionId, context);
  }
  return context;
}
