import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { WebSocket } from 'ws';
import { logger } from '../../common/logger.js';
import { authService } from '../auth/auth.service.js';

interface ClientSubscription {
  executions: Set<string>;
  validations: Set<string>;
}

interface WSMessage {
  type: string;
  executionId?: string;
  nodeId?: string;
}

// Track connected clients and their subscriptions
const clients = new Map<WebSocket, ClientSubscription>();

/**
 * Broadcast an event to all clients subscribed to a specific execution
 */
export function broadcastExecutionEvent(executionId: string, event: unknown): void {
  clients.forEach((subscription, ws) => {
    if (subscription.executions.has(executionId) && ws.readyState === 1) {
      ws.send(JSON.stringify(event));
    }
  });
}

/**
 * Broadcast an event to all clients subscribed to a specific validation
 */
export function broadcastValidationEvent(nodeId: string, event: unknown): void {
  clients.forEach((subscription, ws) => {
    if (subscription.validations.has(nodeId) && ws.readyState === 1) {
      ws.send(JSON.stringify(event));
    }
  });
}

/**
 * Broadcast an event to all connected clients
 */
export function broadcastToAll(event: unknown): void {
  clients.forEach((_, ws) => {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify(event));
    }
  });
}

export async function websocketRoutes(app: FastifyInstance): Promise<void> {
  // Authenticate WebSocket connections via query param token
  // (browsers can't set custom headers on new WebSocket())
  app.addHook('preValidation', async (request, reply) => {
    if (request.url.startsWith('/ws')) {
      const url = new URL(request.url, 'http://localhost');
      const token = url.searchParams.get('token');
      if (token && !request.user) {
        const result = await authService.verifyJwt(token);
        if (result.valid) {
          request.user = result.user;
          request.scopes = result.scopes;
          request.authMethod = 'jwt';
        }
      }
    }
  });

  app.get('/ws', { websocket: true }, (socket: WebSocket, _req: FastifyRequest) => {
    logger.info('WebSocket client connected');

    // Initialize client subscriptions
    const subscription: ClientSubscription = {
      executions: new Set(),
      validations: new Set(),
    };
    clients.set(socket, subscription);

    // Handle incoming messages
    socket.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString()) as WSMessage;

        switch (message.type) {
          case 'subscribe:execution':
            if (message.executionId) {
              subscription.executions.add(message.executionId);
              logger.info({ executionId: message.executionId }, 'Client subscribed to execution');
            }
            break;

          case 'unsubscribe:execution':
            if (message.executionId) {
              subscription.executions.delete(message.executionId);
              logger.info({ executionId: message.executionId }, 'Client unsubscribed from execution');
            }
            break;

          case 'subscribe:validation':
            if (message.nodeId) {
              subscription.validations.add(message.nodeId);
              logger.info({ nodeId: message.nodeId }, 'Client subscribed to validation');
            }
            break;

          case 'unsubscribe:validation':
            if (message.nodeId) {
              subscription.validations.delete(message.nodeId);
              logger.info({ nodeId: message.nodeId }, 'Client unsubscribed from validation');
            }
            break;

          case 'ping':
            socket.send(JSON.stringify({ type: 'pong' }));
            break;

          default:
            logger.warn({ type: message.type }, 'Unknown WebSocket message type');
        }
      } catch (err) {
        logger.error({ err }, 'Failed to parse WebSocket message');
      }
    });

    // Handle client disconnect
    socket.on('close', () => {
      clients.delete(socket);
      logger.info('WebSocket client disconnected');
    });

    // Handle errors
    socket.on('error', (err) => {
      logger.error({ err }, 'WebSocket error');
      clients.delete(socket);
    });

    // Send connection confirmation
    socket.send(JSON.stringify({ type: 'connected', timestamp: Date.now() }));
  });
}
