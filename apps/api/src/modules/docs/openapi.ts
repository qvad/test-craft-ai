/**
 * OpenAPI/Swagger Documentation
 * Auto-generates API documentation from route schemas
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../../config/index.js';

// OpenAPI specification
const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'TestCraft AI API',
    description: `
# TestCraft AI API Documentation

TestCraft AI is a test automation platform that uses AI to generate, execute, and manage tests.

## Authentication

All API endpoints (except health and auth) require authentication. You can authenticate using:

1. **JWT Token**: Include in the \`Authorization\` header as \`Bearer <token>\`
2. **API Key**: Include in the \`X-API-Key\` header

## Rate Limiting

- Global: ${config.rateLimit.globalMaxRequests} requests per ${config.rateLimit.globalWindowMs / 1000}s
- AI Endpoints: ${config.rateLimit.aiMaxRequests} requests per ${config.rateLimit.aiWindowMs / 1000}s

Rate limit headers are included in responses:
- \`X-RateLimit-Limit\`: Maximum requests allowed
- \`X-RateLimit-Remaining\`: Remaining requests
- \`X-RateLimit-Reset\`: Unix timestamp when the limit resets

## Error Responses

All errors follow a consistent format:

\`\`\`json
{
  "error": "Error Type",
  "message": "Human-readable error message",
  "statusCode": 400
}
\`\`\`
    `,
    version: '1.0.0',
    contact: {
      name: 'TestCraft AI Team',
      url: 'https://testcraft.ai',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: '/api/v1',
      description: 'API v1',
    },
  ],
  tags: [
    { name: 'Health', description: 'Health check endpoints' },
    { name: 'Auth', description: 'Authentication and authorization' },
    { name: 'Test Plans', description: 'Test plan management' },
    { name: 'Executions', description: 'Test execution management' },
    { name: 'AI', description: 'AI-powered features' },
    { name: 'Reports', description: 'Execution reports and analytics' },
    { name: 'Audit', description: 'Audit log access (admin only)' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Basic health check',
        operationId: 'getHealth',
        responses: {
          '200': {
            description: 'Service is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    timestamp: { type: 'string', format: 'date-time' },
                    version: { type: 'string', example: '1.0.0' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/health/live': {
      get: {
        tags: ['Health'],
        summary: 'Kubernetes liveness probe',
        operationId: 'getLiveness',
        responses: {
          '200': {
            description: 'Service is alive',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'alive' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/health/ready': {
      get: {
        tags: ['Health'],
        summary: 'Kubernetes readiness probe',
        operationId: 'getReadiness',
        responses: {
          '200': {
            description: 'Service is ready to accept traffic',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ready' },
                  },
                },
              },
            },
          },
          '503': {
            description: 'Service is not ready',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'not_ready' },
                    errors: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/health/detailed': {
      get: {
        tags: ['Health'],
        summary: 'Detailed health check with component status',
        operationId: 'getDetailedHealth',
        responses: {
          '200': {
            description: 'Detailed health status',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['ok', 'degraded', 'unhealthy'] },
                    timestamp: { type: 'string', format: 'date-time' },
                    version: { type: 'string' },
                    uptime: { type: 'number', description: 'Uptime in seconds' },
                    checks: {
                      type: 'object',
                      additionalProperties: {
                        type: 'object',
                        properties: {
                          status: { type: 'string', enum: ['ok', 'error'] },
                          latency: { type: 'number' },
                          message: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login with email and password',
        operationId: 'login',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8 },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Login successful',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/AuthResponse',
                },
              },
            },
          },
          '401': {
            description: 'Invalid credentials',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a new user',
        operationId: 'register',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'name', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  name: { type: 'string', minLength: 2, maxLength: 100 },
                  password: { type: 'string', minLength: 8, maxLength: 128 },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Registration successful',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/AuthResponse',
                },
              },
            },
          },
          '409': {
            description: 'Email already registered',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Get current user info',
        operationId: 'getCurrentUser',
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        responses: {
          '200': {
            description: 'Current user info',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/User',
                },
              },
            },
          },
          '401': {
            description: 'Not authenticated',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
    '/auth/api-keys': {
      get: {
        tags: ['Auth'],
        summary: 'List API keys',
        operationId: 'listApiKeys',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'List of API keys',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    apiKeys: {
                      type: 'array',
                      items: {
                        $ref: '#/components/schemas/ApiKeyInfo',
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Auth'],
        summary: 'Create a new API key',
        operationId: 'createApiKey',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string', minLength: 1, maxLength: 100 },
                  scopes: { type: 'array', items: { type: 'string' } },
                  expiresInDays: { type: 'integer', minimum: 1, maximum: 365 },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'API key created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    name: { type: 'string' },
                    key: { type: 'string', description: 'The API key (only shown once)' },
                    scopes: { type: 'array', items: { type: 'string' } },
                    expiresAt: { type: 'string', format: 'date-time', nullable: true },
                    warning: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token from login endpoint',
      },
      apiKey: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'API key from /auth/api-keys endpoint',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          message: { type: 'string' },
          statusCode: { type: 'integer' },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          name: { type: 'string' },
          role: { type: 'string', enum: ['admin', 'user', 'viewer'] },
          scopes: { type: 'array', items: { type: 'string' } },
          authMethod: { type: 'string', enum: ['jwt', 'api-key', 'none'] },
        },
      },
      AuthResponse: {
        type: 'object',
        properties: {
          user: { $ref: '#/components/schemas/User' },
          accessToken: { type: 'string' },
          refreshToken: { type: 'string' },
          expiresIn: { type: 'integer', description: 'Token expiry in seconds' },
        },
      },
      ApiKeyInfo: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          keyPrefix: { type: 'string' },
          scopes: { type: 'array', items: { type: 'string' } },
          expiresAt: { type: 'string', format: 'date-time', nullable: true },
          lastUsedAt: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
};

export async function docsRoutes(fastify: FastifyInstance): Promise<void> {
  // Serve OpenAPI JSON
  fastify.get('/openapi.json', async (request: FastifyRequest, reply: FastifyReply) => {
    reply.header('Content-Type', 'application/json');
    return openApiSpec;
  });

  // Serve Swagger UI HTML
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    reply.header('Content-Type', 'text/html');
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TestCraft AI API Documentation</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui.css" />
  <style>
    body { margin: 0; padding: 0; }
    .swagger-ui .topbar { display: none; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function() {
      SwaggerUIBundle({
        url: '/api/v1/docs/openapi.json',
        dom_id: '#swagger-ui',
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: 'BaseLayout',
        deepLinking: true,
        showExtensions: true,
        showCommonExtensions: true
      });
    };
  </script>
</body>
</html>
    `;
  });
}
