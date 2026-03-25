/**
 * AI Service Routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { aiService } from './ai-service.js';
import { ragService } from './rag-service.js';
import { logger } from '../../common/logger.js';

// =========================================================================
// SSRF Protection - Block requests to internal/private networks
// =========================================================================

const BLOCKED_IP_PATTERNS = [
  /^127\./,                          // Localhost
  /^10\./,                           // Private Class A
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,  // Private Class B
  /^192\.168\./,                     // Private Class C
  /^169\.254\./,                     // Link-local
  /^0\./,                            // Current network
  /^::1$/,                           // IPv6 localhost
  /^fc00:/i,                         // IPv6 private
  /^fe80:/i,                         // IPv6 link-local
];

const BLOCKED_HOSTNAMES = [
  'localhost',
  'localhost.localdomain',
  '*.local',
  'metadata.google.internal',        // GCP metadata
  '169.254.169.254',                 // Cloud metadata endpoint
  'metadata.google.internal',
];

/**
 * Validate URL is safe for SSRF protection
 * Blocks internal IPs, localhost, and cloud metadata endpoints
 */
function validateExternalUrl(urlString: string): { valid: boolean; error?: string } {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname.toLowerCase();

    // Block non-http(s) protocols
    if (!['http:', 'https:'].includes(url.protocol)) {
      return { valid: false, error: 'Only HTTP/HTTPS protocols are allowed' };
    }

    // Block localhost and local hostnames
    for (const blocked of BLOCKED_HOSTNAMES) {
      if (blocked.startsWith('*')) {
        const suffix = blocked.slice(1);
        if (hostname.endsWith(suffix)) {
          return { valid: false, error: `Blocked hostname: ${hostname}` };
        }
      } else if (hostname === blocked) {
        return { valid: false, error: `Blocked hostname: ${hostname}` };
      }
    }

    // Check if hostname is an IP address
    const ipMatch = hostname.match(/^(\d{1,3}\.){3}\d{1,3}$/) || hostname.includes(':');
    if (ipMatch) {
      for (const pattern of BLOCKED_IP_PATTERNS) {
        if (pattern.test(hostname)) {
          return { valid: false, error: `Blocked IP range: ${hostname}` };
        }
      }
    }

    // Block common internal ports if specified
    const blockedPorts = ['22', '23', '25', '3306', '5432', '5433', '6379', '27017'];
    if (blockedPorts.includes(url.port)) {
      return { valid: false, error: `Blocked port: ${url.port}` };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

// Validation schemas

/**
 * Schema for Claude API proxy request
 */
const ClaudeCompleteSchema = z.object({
  model: z.string().optional().default('claude-sonnet-4-20250514'),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })),
  system: z.string().optional(),
  max_tokens: z.number().min(1).max(8192).optional().default(4096),
  temperature: z.number().min(0).max(2).optional().default(0.3),
});

/**
 * Schema for LM Studio / OpenAI-compatible API proxy request
 */
const LMStudioCompleteSchema = z.object({
  endpoint: z.string().url(),
  model: z.string().optional().default('local-model'),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
  })),
  max_tokens: z.number().min(1).max(32000).optional().default(4096),
  temperature: z.number().min(0).max(2).optional().default(0.3),
  stream: z.boolean().optional().default(false),
});

const GenerateCodeSchema = z.object({
  nodeId: z.string(),
  nodeType: z.string(),
  intent: z.string(),
  language: z.string(),
  context: z.object({
    testPlanId: z.string().optional(),
    variables: z.record(z.unknown()).optional(),
    databaseSchema: z.any().optional(),
    apiSpecification: z.any().optional(),
    ragQuery: z.string().optional(),
  }).optional().default({}),
  options: z.object({
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().min(100).max(16000).optional(),
    includeTests: z.boolean().optional(),
  }).optional(),
});

const GenerateDataSchema = z.object({
  schema: z.object({
    fields: z.array(z.object({
      name: z.string(),
      type: z.string(),
      format: z.string().optional(),
      nullable: z.boolean().optional(),
      unique: z.boolean().optional(),
      enumValues: z.array(z.string()).optional(),
      min: z.number().optional(),
      max: z.number().optional(),
      minLength: z.number().optional(),
      maxLength: z.number().optional(),
      pattern: z.string().optional(),
      aiHint: z.string().optional(),
    })),
    constraints: z.array(z.any()).optional(),
  }),
  count: z.number().min(1).max(10000),
  locale: z.string().optional(),
  seed: z.number().optional(),
  ragContext: z.array(z.string()).optional(),
});

const ValidateResponseSchema = z.object({
  response: z.unknown(),
  intent: z.string(),
  expectedBehavior: z.string(),
  rules: z.array(z.string()).optional(),
});

const DetectAnomaliesSchema = z.object({
  metrics: z.array(z.object({
    timestamp: z.string(),
    name: z.string(),
    value: z.number(),
    labels: z.record(z.string()).optional(),
  })),
  sensitivity: z.enum(['low', 'medium', 'high']),
  baselineWindow: z.number().optional(),
});

const IndexDocumentSchema = z.object({
  id: z.string(),
  content: z.string(),
  metadata: z.record(z.unknown()).optional().default({}),
});

const SearchRAGSchema = z.object({
  query: z.string(),
  topK: z.number().min(1).max(100).optional().default(5),
  filters: z.record(z.unknown()).optional(),
});

// Schemas for RAG indexing endpoints (previously unvalidated)
const IndexCodeExampleSchema = z.object({
  id: z.string().min(1),
  language: z.string().min(1),
  nodeType: z.string().min(1),
  description: z.string().min(1),
  code: z.string().min(1),
  tags: z.array(z.string()).optional(),
});

const IndexAPIDocSchema = z.object({
  id: z.string().min(1),
  endpoint: z.string().min(1),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']),
  description: z.string().min(1),
  requestSchema: z.unknown().optional(),
  responseSchema: z.unknown().optional(),
  examples: z.array(z.unknown()).optional(),
});

const IndexDBSchemaSchema = z.object({
  id: z.string().min(1),
  tableName: z.string().min(1),
  columns: z.array(z.object({
    name: z.string().min(1),
    type: z.string().min(1),
    description: z.string().optional(),
  })),
  relationships: z.array(z.object({
    table: z.string().min(1),
    type: z.string().min(1),
  })).optional(),
});

export async function aiRoutes(app: FastifyInstance): Promise<void> {
  // Claude API Proxy - for AI Auto-Fill feature
  app.post<{ Body: z.infer<typeof ClaudeCompleteSchema> }>(
    '/complete',
    async (request, reply) => {
      try {
        const body = ClaudeCompleteSchema.parse(request.body);
        logger.info({ model: body.model, messagesCount: body.messages.length }, 'Claude API proxy request');

        const apiKey = process.env.ANTHROPIC_API_KEY || process.env.AI_API_KEY;
        if (!apiKey) {
          logger.warn('No Anthropic API key configured');
          return reply.status(500).send({ error: 'Anthropic API key not configured' });
        }

        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: body.model,
            max_tokens: body.max_tokens,
            temperature: body.temperature,
            system: body.system,
            messages: body.messages,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          logger.error({ status: response.status, error: errorText }, 'Claude API error');
          return reply.status(response.status).send({
            error: 'Claude API error',
            message: errorText,
          });
        }

        const data = await response.json();
        return reply.send(data);
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Validation error', details: err.errors });
        }
        logger.error({ err }, 'Claude API proxy failed');
        return reply.status(500).send({ error: 'Claude API proxy failed' });
      }
    }
  );

  // Generate code from natural language intent
  app.post<{ Body: z.infer<typeof GenerateCodeSchema> }>(
    '/generate/code',
    async (request, reply) => {
      try {
        const body = GenerateCodeSchema.parse(request.body);
        logger.info({ nodeId: body.nodeId, intent: body.intent.substring(0, 100) }, 'Code generation request');

        const result = await aiService.generateCode({
          nodeId: body.nodeId,
          nodeType: body.nodeType,
          intent: body.intent,
          language: body.language,
          context: body.context,
          options: body.options,
        });

        return reply.send(result);
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Validation error', details: err.errors });
        }
        logger.error({ err }, 'Code generation failed');
        return reply.status(500).send({ error: 'Code generation failed' });
      }
    }
  );

  // Generate test data
  app.post<{ Body: z.infer<typeof GenerateDataSchema> }>(
    '/generate/data',
    async (request, reply) => {
      try {
        const body = GenerateDataSchema.parse(request.body);
        logger.info({ count: body.count, fields: body.schema.fields.length }, 'Data generation request');

        const result = await aiService.generateData(body);

        return reply.send(result);
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Validation error', details: err.errors });
        }
        logger.error({ err }, 'Data generation failed');
        return reply.status(500).send({ error: 'Data generation failed' });
      }
    }
  );

  // Validate response using AI
  app.post<{ Body: z.infer<typeof ValidateResponseSchema> }>(
    '/validate',
    async (request, reply) => {
      try {
        const body = ValidateResponseSchema.parse(request.body);
        logger.info({ intent: body.intent.substring(0, 100) }, 'Validation request');

        const result = await aiService.validateResponse(body);

        return reply.send(result);
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Validation error', details: err.errors });
        }
        logger.error({ err }, 'AI validation failed');
        return reply.status(500).send({ error: 'Validation failed' });
      }
    }
  );

  // Detect anomalies in metrics
  app.post<{ Body: z.infer<typeof DetectAnomaliesSchema> }>(
    '/anomalies/detect',
    async (request, reply) => {
      try {
        const body = DetectAnomaliesSchema.parse(request.body);
        logger.info({ metricsCount: body.metrics.length }, 'Anomaly detection request');

        const result = await aiService.detectAnomalies(body);

        return reply.send(result);
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Validation error', details: err.errors });
        }
        logger.error({ err }, 'Anomaly detection failed');
        return reply.status(500).send({ error: 'Anomaly detection failed' });
      }
    }
  );

  // RAG: Index a document
  app.post<{ Body: z.infer<typeof IndexDocumentSchema> }>(
    '/rag/documents',
    async (request, reply) => {
      try {
        const body = IndexDocumentSchema.parse(request.body);
        logger.info({ docId: body.id }, 'Indexing document for RAG');

        const result = await ragService.indexDocument(body);

        return reply.status(201).send({
          id: result.id,
          indexed: true,
        });
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Validation error', details: err.errors });
        }
        logger.error({ err }, 'Document indexing failed');
        return reply.status(500).send({ error: 'Indexing failed' });
      }
    }
  );

  // RAG: Search documents
  app.post<{ Body: z.infer<typeof SearchRAGSchema> }>(
    '/rag/search',
    async (request, reply) => {
      try {
        const body = SearchRAGSchema.parse(request.body);
        logger.info({ query: body.query.substring(0, 100) }, 'RAG search request');

        const result = await ragService.search(body);

        return reply.send(result);
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Validation error', details: err.errors });
        }
        logger.error({ err }, 'RAG search failed');
        return reply.status(500).send({ error: 'Search failed' });
      }
    }
  );

  // RAG: Get document by ID
  app.get<{ Params: { id: string } }>(
    '/rag/documents/:id',
    async (request, reply) => {
      const { id } = request.params;

      const document = await ragService.getDocument(id);
      if (!document) {
        return reply.status(404).send({ error: 'Document not found' });
      }

      return reply.send(document);
    }
  );

  // RAG: Delete document
  app.delete<{ Params: { id: string } }>(
    '/rag/documents/:id',
    async (request, reply) => {
      const { id } = request.params;

      const deleted = await ragService.deleteDocument(id);
      if (!deleted) {
        return reply.status(404).send({ error: 'Document not found' });
      }

      return reply.status(204).send();
    }
  );

  // LM Studio / OpenAI-compatible API Proxy - avoids CORS issues
  // SECURITY: URL validation to prevent SSRF attacks
  app.post<{ Body: z.infer<typeof LMStudioCompleteSchema> }>(
    '/lm-studio/complete',
    async (request, reply) => {
      try {
        const body = LMStudioCompleteSchema.parse(request.body);

        // SSRF Protection: Validate the endpoint URL
        const urlValidation = validateExternalUrl(body.endpoint);
        if (!urlValidation.valid) {
          logger.warn({ endpoint: body.endpoint, error: urlValidation.error }, 'LM Studio proxy blocked - SSRF protection');
          return reply.status(400).send({
            error: 'Invalid endpoint URL',
            message: urlValidation.error,
          });
        }

        logger.info({ endpoint: body.endpoint, model: body.model, messagesCount: body.messages.length }, 'LM Studio API proxy request');

        const response = await fetch(body.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: body.model,
            messages: body.messages,
            max_tokens: body.max_tokens,
            temperature: body.temperature,
            stream: body.stream,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          logger.error({ status: response.status, error: errorText }, 'LM Studio API error');
          return reply.status(response.status).send({
            error: 'LM Studio API error',
            message: errorText,
          });
        }

        const data = await response.json();
        return reply.send(data);
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Validation error', details: err.errors });
        }
        logger.error({ err }, 'LM Studio API proxy failed');
        return reply.status(500).send({ error: 'LM Studio API proxy failed' });
      }
    }
  );

  // Index code example for RAG
  app.post<{ Body: z.infer<typeof IndexCodeExampleSchema> }>(
    '/rag/code-examples',
    async (request, reply) => {
      try {
        const body = IndexCodeExampleSchema.parse(request.body);
        logger.info({ id: body.id, language: body.language, nodeType: body.nodeType }, 'Indexing code example');

        await ragService.indexCodeExample(body);

        return reply.status(201).send({ indexed: true });
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Validation error', details: err.errors });
        }
        logger.error({ err }, 'Code example indexing failed');
        return reply.status(500).send({ error: 'Indexing failed' });
      }
    }
  );

  // Index API documentation for RAG
  app.post<{ Body: z.infer<typeof IndexAPIDocSchema> }>(
    '/rag/api-docs',
    async (request, reply) => {
      try {
        const body = IndexAPIDocSchema.parse(request.body);
        logger.info({ id: body.id, endpoint: body.endpoint, method: body.method }, 'Indexing API doc');

        await ragService.indexAPIDoc(body);

        return reply.status(201).send({ indexed: true });
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Validation error', details: err.errors });
        }
        logger.error({ err }, 'API doc indexing failed');
        return reply.status(500).send({ error: 'Indexing failed' });
      }
    }
  );

  // Index database schema for RAG
  app.post<{ Body: z.infer<typeof IndexDBSchemaSchema> }>(
    '/rag/db-schemas',
    async (request, reply) => {
      try {
        const body = IndexDBSchemaSchema.parse(request.body);
        logger.info({ id: body.id, tableName: body.tableName, columnCount: body.columns.length }, 'Indexing DB schema');

        await ragService.indexDatabaseSchema(body);

        return reply.status(201).send({ indexed: true });
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Validation error', details: err.errors });
        }
        logger.error({ err }, 'DB schema indexing failed');
        return reply.status(500).send({ error: 'Indexing failed' });
      }
    }
  );

  // =========================================================================
  // RAG Export/Import Endpoints
  // =========================================================================

  // RAG: Export all documents
  app.get<{
    Querystring: {
      includeEmbeddings?: string;
      type?: string;
    };
  }>(
    '/rag/export',
    async (request, reply) => {
      try {
        const { includeEmbeddings, type } = request.query;
        logger.info({ includeEmbeddings, type }, 'RAG export request');

        const filters: Record<string, string> = {};
        if (type) {
          filters.type = type;
        }

        const result = await ragService.exportDocuments({
          filters: Object.keys(filters).length > 0 ? filters : undefined,
          includeEmbeddings: includeEmbeddings === 'true',
        });

        // Set content disposition for download
        reply.header('Content-Type', 'application/json');
        reply.header('Content-Disposition', `attachment; filename="rag-export-${new Date().toISOString().split('T')[0]}.json"`);

        return reply.send(result);
      } catch (err) {
        logger.error({ err }, 'RAG export failed');
        return reply.status(500).send({ error: 'Export failed' });
      }
    }
  );

  // RAG: Import documents
  app.post<{
    Body: {
      version: string;
      documents: Array<{
        id: string;
        content: string;
        metadata: Record<string, unknown>;
        embedding?: number[];
      }>;
    };
    Querystring: {
      overwrite?: string;
      regenerateEmbeddings?: string;
    };
  }>(
    '/rag/import',
    async (request, reply) => {
      try {
        const { overwrite, regenerateEmbeddings } = request.query;
        const body = request.body;

        logger.info({
          documentCount: body.documents?.length,
          version: body.version,
          overwrite,
          regenerateEmbeddings,
        }, 'RAG import request');

        if (!body.version || !body.documents || !Array.isArray(body.documents)) {
          return reply.status(400).send({
            error: 'Invalid import format',
            message: 'Expected {version: string, documents: array}',
          });
        }

        const result = await ragService.importDocuments(body, {
          overwrite: overwrite === 'true',
          regenerateEmbeddings: regenerateEmbeddings === 'true',
        });

        return reply.send(result);
      } catch (err) {
        logger.error({ err }, 'RAG import failed');
        return reply.status(500).send({ error: 'Import failed' });
      }
    }
  );

  // RAG: Get statistics
  app.get(
    '/rag/stats',
    async (request, reply) => {
      try {
        const stats = await ragService.getStats();
        return reply.send(stats);
      } catch (err) {
        logger.error({ err }, 'RAG stats failed');
        return reply.status(500).send({ error: 'Failed to get stats' });
      }
    }
  );

  // RAG: Clear all documents (admin only - use with caution)
  app.delete(
    '/rag/documents',
    async (request, reply) => {
      try {
        logger.warn('RAG clear all documents requested');
        const deleted = await ragService.clearAll();
        return reply.send({ deleted });
      } catch (err) {
        logger.error({ err }, 'RAG clear failed');
        return reply.status(500).send({ error: 'Clear failed' });
      }
    }
  );
}
