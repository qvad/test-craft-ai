/**
 * HOCON Test Plan API Routes
 *
 * API endpoints for managing HOCON test plans:
 * - Import HOCON files
 * - Export test plans to HOCON
 * - List and search plans
 * - Validate plans
 */

import { randomUUID } from 'crypto';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { hoconParser, validateTestPlan } from './parser.js';
import { TestPlanStorage } from './storage.js';
import type { StoredTestPlan } from './storage.js';
import { logger } from '../../common/logger.js';

const storage = new TestPlanStorage();

interface ImportBody {
  content?: string;       // sent by web frontend
  hoconContent?: string;  // sent by CLI / direct API callers
  format?: 'hocon' | 'json';
  nameOverride?: string;
  tags?: string[];
}

interface ValidateBody {
  hoconContent: string;
  environment?: string;
  variables?: Record<string, string>;
}

interface ListQuery {
  page?: number;
  limit?: number;
  search?: string;
  tags?: string | string[];
  sortBy?: 'name' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

interface ExecuteBody {
  hoconContent: string;
  environment?: string;
  variables?: Record<string, string>;
  parallel?: boolean;
  reportFormats?: string[];
}

/**
 * Maps HOCON type aliases (from user-authored plans) to the canonical NodeType
 * strings expected by the frontend config panel switch.
 */
const HOCON_TYPE_ALIASES: Record<string, string> = {
  'jdbc-sampler': 'jdbc-request',
  'http-sampler': 'http-request',
  'script-node': 'script',
  'script-sampler': 'script',
  'beanshell-sampler': 'script',
  'groovy-sampler': 'script',
  'jsr223-sampler': 'script',
  'thread-group-sampler': 'thread-group',
  'kubernetes-sampler': 'kubernetes-node',
  'k8s-node': 'kubernetes-node',
  'k8s-sampler': 'kubernetes-node',
  'constant-timer-node': 'constant-timer',
};

function normalizeNodeType(raw: string): string {
  const normalized = raw.toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-');
  return HOCON_TYPE_ALIASES[normalized] ?? normalized;
}

/**
 * Recursively flattens a nested HOCON node tree into a flat array compatible with
 * the frontend TreeNode format. HOCON nodes may have `children` as nested objects;
 * this converts them to arrays of ID strings and assigns UUIDs where missing.
 */
function flattenHoconNodes(nodes: any[], parentId: string | null = null): any[] {
  const result: any[] = [];
  nodes.forEach((node: any, index: number) => {
    const nodeId = node.id || randomUUID();
    const nestedChildren: any[] = Array.isArray(node.children)
      ? node.children.filter((c: any) => c !== null && typeof c === 'object')
      : [];
    // Assign IDs to children before recording their IDs in the parent
    nestedChildren.forEach((c: any) => { if (!c.id) c.id = randomUUID(); });
    const childrenIds: string[] = nestedChildren.map((c: any) => c.id as string);

    result.push({
      id: nodeId,
      type: normalizeNodeType(node.type || 'unknown'),
      name: node.name || 'Unnamed',
      parentId,
      children: childrenIds,
      order: index,
      enabled: node.enabled !== false,
      config: node.config || {},
      generatedCode: null,
      validationStatus: 'pending',
      expanded: true,
    });

    if (nestedChildren.length > 0) {
      result.push(...flattenHoconNodes(nestedChildren, nodeId));
    }
  });
  return result;
}

/**
 * Ensures the nodes array has exactly one root node (type: "root") as the first element.
 * If no root node exists, one is created: all top-level nodes become its children.
 */
function ensureRootNode(nodes: any[], planName: string): any[] {
  if (!nodes || nodes.length === 0) return nodes;

  if (nodes.some((n: any) => n.type === 'root')) return nodes;

  const nodeIdSet = new Set(nodes.map((n: any) => n.id));
  // Top-level = no parentId, or parentId references a node not in this list
  const topLevelNodes = nodes.filter(
    (n: any) => !n.parentId || !nodeIdSet.has(n.parentId)
  );
  const topLevelIds = topLevelNodes.map((n: any) => n.id);

  const rootId = randomUUID();

  const rootNode = {
    id: rootId,
    type: 'root',
    name: planName,
    parentId: null,
    children: topLevelIds,
    order: 0,
    enabled: true,
    expanded: true,
    validationStatus: 'pending',
    generatedCode: null,
    config: { type: 'root' },
  };

  // Point former top-level nodes at the new root
  const updatedNodes = nodes.map((n: any) =>
    topLevelIds.includes(n.id) ? { ...n, parentId: rootId } : n
  );

  return [rootNode, ...updatedNodes];
}

export async function hoconRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * Import a HOCON test plan
   */
  fastify.post('/plans/import', async (
    request: FastifyRequest<{ Body: ImportBody }>,
    reply: FastifyReply
  ) => {
    const { content, hoconContent, nameOverride, tags = [] } = request.body;
    const rawContent = content ?? hoconContent;

    if (!rawContent) {
      return reply.status(400).send({ error: 'Missing required field: content or hoconContent' });
    }

    try {
      // Parse the HOCON content using the robust HoconParser
      const parseResult = await hoconParser.parse(rawContent);

      if (parseResult.errors.length > 0) {
        return reply.status(400).send({
          error: 'Failed to parse HOCON',
          details: parseResult.errors.map((e) => e.message).join('; '),
        });
      }

      if (!parseResult.plan.testcraft?.plan) {
        return reply.status(400).send({
          error: 'Invalid HOCON: missing testcraft.plan section',
        });
      }

      const testPlan = parseResult.plan.testcraft.plan;

      // Validate the test plan
      const validation = validateTestPlan(testPlan);
      if (!validation.valid) {
        return reply.status(400).send({
          error: 'Validation failed',
          errors: validation.errors,
          warnings: validation.warnings,
        });
      }

      // Ensure nodes has a root node; inject one if missing
      const normalizedNodes = ensureRootNode(testPlan.nodes || [], testPlan.name);
      testPlan.nodes = normalizedNodes;

      // Save the test plan
      const plan = await storage.save(rawContent, {
        author: nameOverride || testPlan.name,
      });

      logger.info('Test plan imported', {
        planId: plan.id,
        name: plan.name,
        version: plan.version,
        injectedRootNode: normalizedNodes.length > 0 && normalizedNodes[0].type === 'root'
          && !parseResult.plan.testcraft.plan.nodes?.some((n: any) => n.type === 'root'),
      });

      return reply.status(201).send({
        id: plan.id,
        name: plan.name,
        version: plan.version,
        tags: plan.tags,
        nodeCount: normalizedNodes.length,
        createdAt: plan.createdAt,
      });
    } catch (err: any) {
      logger.error('Import failed', { error: err.message });
      return reply.status(400).send({
        error: 'Failed to parse HOCON',
        details: err.message,
      });
    }
  });

  /**
   * Export a test plan to HOCON
   */
  fastify.get('/plans/:id/export', async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    const { id } = request.params;

    const plan = await storage.get(id);
    if (!plan) {
      return reply.status(404).send({
        error: 'Test plan not found',
        id,
      });
    }

    return reply.send({
      id: plan.id,
      name: plan.name,
      version: plan.version,
      hoconContent: plan.hoconContent,
    });
  });

  /**
   * List test plans
   */
  fastify.get('/plans', async (
    request: FastifyRequest<{ Querystring: ListQuery }>,
    reply: FastifyReply
  ) => {
    const {
      page = 1,
      limit = 20,
      search,
      tags,
      sortBy = 'updatedAt',
      sortOrder = 'desc',
    } = request.query;

    // Parse tags
    const tagArray = tags
      ? (Array.isArray(tags) ? tags : tags.split(','))
      : undefined;

    const offset = (page - 1) * limit;

    const result = await storage.list({
      limit,
      offset,
      search,
      tags: tagArray,
    });

    return reply.send({
      items: result.items.map(plan => ({
        id: plan.id,
        name: plan.name,
        description: plan.description,
        version: plan.version,
        tags: plan.tags,
        createdAt: plan.createdAt,
        updatedAt: plan.updatedAt,
      })),
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
    });
  });

  /**
   * Get a test plan by ID
   */
  fastify.get('/plans/:id', async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    const { id } = request.params;

    const plan = await storage.get(id);
    if (!plan) {
      return reply.status(404).send({
        error: 'Test plan not found',
        id,
      });
    }

    let nodes: any[] = [];
    try {
      const parseResult = await hoconParser.parse(plan.hoconContent);
      const rawNodes = parseResult.plan?.testcraft?.plan?.nodes || [];
      const planName = parseResult.plan?.testcraft?.plan?.name || plan.name;
      nodes = ensureRootNode(flattenHoconNodes(rawNodes), planName);
    } catch (err: any) {
      logger.warn('Failed to parse HOCON nodes for plan', { planId: id, error: err.message });
    }

    return reply.send({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      version: plan.version,
      tags: plan.tags,
      hoconContent: plan.hoconContent,
      nodes,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    });
  });

  /**
   * Update a test plan
   */
  fastify.put('/plans/:id', async (
    request: FastifyRequest<{
      Params: { id: string };
      Body: Partial<ImportBody> & { name?: string; description?: string; tags?: string[] };
    }>,
    reply: FastifyReply
  ) => {
    const { id } = request.params;
    const { hoconContent, name, description, tags } = request.body;

    const existing = await storage.get(id);
    if (!existing) {
      return reply.status(404).send({
        error: 'Test plan not found',
        id,
      });
    }

    // Determine the HOCON content to store
    let updatedHocon = hoconContent || existing.hoconContent;

    if (hoconContent) {
      try {
        const parseResult = await hoconParser.parse(hoconContent);
        if (parseResult.errors.length > 0) {
          return reply.status(400).send({
            error: 'Failed to parse HOCON',
            details: parseResult.errors.map((e) => e.message).join('; '),
          });
        }
        if (!parseResult.plan.testcraft?.plan) {
          return reply.status(400).send({
            error: 'Invalid HOCON: missing testcraft.plan section',
          });
        }

        const validation = validateTestPlan(parseResult.plan.testcraft.plan);
        if (!validation.valid) {
          return reply.status(400).send({
            error: 'Validation failed',
            errors: validation.errors,
          });
        }

        updatedHocon = hoconContent;
      } catch (err: any) {
        return reply.status(400).send({
          error: 'Failed to parse HOCON',
          details: err.message,
        });
      }
    } else if (name || description || tags) {
      // If only metadata changed, re-serialize with updated metadata
      // For now, keep the existing HOCON as-is
      updatedHocon = existing.hoconContent;
    }

    const updated = await storage.update(id, updatedHocon, { createVersion: true });

    return reply.send({
      id: updated.id,
      name: updated.name,
      version: updated.version,
      updatedAt: updated.updatedAt,
    });
  });

  /**
   * Delete a test plan
   */
  fastify.delete('/plans/:id', async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    const { id } = request.params;

    const plan = await storage.get(id);
    if (!plan) {
      return reply.status(404).send({
        error: 'Test plan not found',
        id,
      });
    }

    await storage.delete(id);

    logger.info('Test plan deleted', { planId: id, name: plan.name });

    return reply.status(204).send();
  });

  /**
   * Validate a HOCON test plan
   */
  fastify.post('/plans/validate', async (
    request: FastifyRequest<{ Body: ValidateBody }>,
    reply: FastifyReply
  ) => {
    const { hoconContent, environment, variables } = request.body;

    try {
      const parseResult = await hoconParser.parse(hoconContent);

      if (parseResult.errors.length > 0) {
        return reply.status(400).send({
          valid: false,
          errors: parseResult.errors.map((e) => e.message),
        });
      }

      if (!parseResult.plan.testcraft?.plan) {
        return reply.status(400).send({
          valid: false,
          errors: ['Missing testcraft.plan section'],
        });
      }

      const plan = parseResult.plan.testcraft.plan;
      const validation = validateTestPlan(plan);

      // Build execution plan preview
      const executionPlan = {
        name: plan.name,
        description: plan.description,
        environment: environment || 'default',
        nodeCount: plan.nodes?.length || 0,
        nodes: plan.nodes?.map((node: any) => ({
          id: node.id,
          type: node.type,
          name: node.name,
          dependsOn: node.dependsOn || [],
        })) || [],
        estimatedDuration: calculateEstimatedDuration(plan.nodes),
        variables: {
          defined: Object.keys(plan.variables || {}),
          provided: Object.keys(variables || {}),
          missing: findMissingVariables(plan, variables),
        },
        warnings: validation.warnings,
      };

      return reply.send({
        valid: validation.valid,
        errors: validation.errors,
        warnings: validation.warnings,
        executionPlan,
      });
    } catch (err: any) {
      return reply.status(400).send({
        valid: false,
        errors: [`Parse error: ${err.message}`],
      });
    }
  });

  /**
   * Execute a HOCON test plan
   */
  fastify.post('/plans/execute', async (
    request: FastifyRequest<{ Body: ExecuteBody }>,
    reply: FastifyReply
  ) => {
    const { hoconContent, environment, variables, parallel, reportFormats } = request.body;

    try {
      const parseResult = await hoconParser.parse(hoconContent);

      if (parseResult.errors.length > 0) {
        return reply.status(400).send({
          error: 'Failed to parse HOCON',
          details: parseResult.errors.map((e) => e.message).join('; '),
        });
      }

      if (!parseResult.plan.testcraft?.plan) {
        return reply.status(400).send({
          error: 'Invalid HOCON: missing testcraft.plan section',
        });
      }

      const testPlan = parseResult.plan.testcraft.plan;
      const validation = validateTestPlan(testPlan);
      if (!validation.valid) {
        return reply.status(400).send({
          error: 'Validation failed',
          errors: validation.errors,
        });
      }

      // Generate execution ID
      const executionId = `exec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      // TODO: Queue the execution with the orchestrator
      // For now, return the execution ID for tracking

      logger.info('Execution started', {
        executionId,
        planName: testPlan.name,
        environment,
        parallel,
      });

      return reply.status(202).send({
        executionId,
        status: 'queued',
        planName: testPlan.name,
        nodeCount: testPlan.nodes?.length || 0,
        environment: environment || 'default',
        streamUrl: `/api/v1/executions/${executionId}/stream`,
      });
    } catch (err: any) {
      return reply.status(400).send({
        error: 'Failed to execute plan',
        details: err.message,
      });
    }
  });

  /**
   * Clone a test plan
   */
  fastify.post('/plans/:id/clone', async (
    request: FastifyRequest<{
      Params: { id: string };
      Body: { name?: string };
    }>,
    reply: FastifyReply
  ) => {
    const { id } = request.params;
    const { name } = request.body;

    const original = await storage.get(id);
    if (!original) {
      return reply.status(404).send({
        error: 'Test plan not found',
        id,
      });
    }

    const cloned = await storage.save(original.hoconContent);

    return reply.status(201).send({
      id: cloned.id,
      name: cloned.name,
      clonedFrom: original.id,
    });
  });

  /**
   * Get test plan versions/history
   */
  fastify.get('/plans/:id/history', async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    const { id } = request.params;

    const history = await storage.getVersionHistory(id);

    return reply.send({
      planId: id,
      versions: history,
    });
  });

  /**
   * Get available tags
   */
  fastify.get('/plans/tags', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const tags = await storage.getTags();

    return reply.send({
      tags,
    });
  });
}

/**
 * Calculate estimated duration based on nodes
 */
function calculateEstimatedDuration(nodes: any[]): string {
  if (!nodes || nodes.length === 0) return 'unknown';

  let totalMs = 0;

  for (const node of nodes) {
    // Estimate based on node type
    switch (node.type) {
      case 'http-request':
        totalMs += node.config?.timeout || 30000;
        break;
      case 'jdbc-request':
        totalMs += 5000;
        break;
      case 'code-execution':
        totalMs += node.config?.timeout || 60000;
        break;
      case 'ai-test-generator':
      case 'ai-data-generator':
        totalMs += 10000;
        break;
      default:
        totalMs += 1000;
    }
  }

  // Format duration
  if (totalMs < 60000) {
    return `~${Math.ceil(totalMs / 1000)}s`;
  } else if (totalMs < 3600000) {
    return `~${Math.ceil(totalMs / 60000)}m`;
  } else {
    return `~${Math.ceil(totalMs / 3600000)}h`;
  }
}

/**
 * Find missing required variables
 */
function findMissingVariables(plan: any, provided?: Record<string, string>): string[] {
  const missing: string[] = [];
  const providedKeys = new Set(Object.keys(provided || {}));

  // Check for environment variable references
  const hoconStr = JSON.stringify(plan);
  const envRefs = hoconStr.match(/\$\{env\.([^}]+)\}/g) || [];
  const varRefs = hoconStr.match(/\$\{([^}]+)\}/g) || [];

  for (const ref of varRefs) {
    const varName = ref.slice(2, -1);
    // Skip if it's an env reference or a built-in function
    if (varName.startsWith('env.') || varName.startsWith('__')) continue;
    // Skip if it's defined in plan variables
    if (plan.variables && varName in plan.variables) continue;
    // Skip if provided
    if (providedKeys.has(varName)) continue;

    missing.push(varName);
  }

  return [...new Set(missing)];
}
