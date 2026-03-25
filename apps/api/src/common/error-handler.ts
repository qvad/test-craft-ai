/**
 * Centralized Error Handler Plugin for Fastify
 *
 * Eliminates the need for repeated try/catch blocks in route handlers.
 * Handles Zod validation errors, known application errors, and unknown errors.
 */

import type { FastifyInstance, FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { logger } from './logger.js';

/**
 * Custom application error with status code
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code?: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }

  static badRequest(message: string, details?: unknown): AppError {
    return new AppError(400, message, 'BAD_REQUEST', details);
  }

  static unauthorized(message = 'Unauthorized'): AppError {
    return new AppError(401, message, 'UNAUTHORIZED');
  }

  static forbidden(message = 'Forbidden'): AppError {
    return new AppError(403, message, 'FORBIDDEN');
  }

  static notFound(resource = 'Resource'): AppError {
    return new AppError(404, `${resource} not found`, 'NOT_FOUND');
  }

  static conflict(message: string): AppError {
    return new AppError(409, message, 'CONFLICT');
  }

  static internal(message = 'Internal server error'): AppError {
    return new AppError(500, message, 'INTERNAL_ERROR');
  }
}

/**
 * Standard error response format
 */
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Format error into standard response
 */
function formatErrorResponse(
  code: string,
  message: string,
  details?: unknown
): ErrorResponse {
  return {
    error: {
      code,
      message,
      ...(details !== undefined && { details }),
    },
  };
}

/**
 * Register the centralized error handler
 */
export async function errorHandlerPlugin(app: FastifyInstance): Promise<void> {
  app.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    // Log the error with request context
    const errorContext = {
      err: error,
      url: request.url,
      method: request.method,
      requestId: request.id,
    };

    // Don't attempt to send if response already started
    if (reply.sent) {
      logger.error(errorContext, 'Error after response already sent');
      return;
    }

    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      logger.warn(errorContext, 'Validation error');
      return reply.status(400).send(
        formatErrorResponse('VALIDATION_ERROR', 'Validation failed', error.errors)
      );
    }

    // Handle custom application errors
    if (error instanceof AppError) {
      if (error.statusCode >= 500) {
        logger.error(errorContext, error.message);
      } else {
        logger.warn(errorContext, error.message);
      }
      return reply.status(error.statusCode).send(
        formatErrorResponse(error.code || 'APP_ERROR', error.message, error.details)
      );
    }

    // Handle Fastify validation errors (from schema validation)
    if (error.validation) {
      logger.warn(errorContext, 'Schema validation error');
      return reply.status(400).send(
        formatErrorResponse('VALIDATION_ERROR', 'Request validation failed', error.validation)
      );
    }

    // Handle rate limit errors
    if (error.statusCode === 429) {
      logger.warn(errorContext, 'Rate limit exceeded');
      return reply.status(429).send(
        formatErrorResponse('RATE_LIMIT_EXCEEDED', error.message || 'Too many requests')
      );
    }

    // Handle all other errors as internal server errors
    logger.error(errorContext, 'Unhandled error');
    return reply.status(500).send(
      formatErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred')
    );
  });

  // Handle 404 for undefined routes
  app.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
    logger.debug({ url: request.url, method: request.method }, 'Route not found');
    return reply.status(404).send(
      formatErrorResponse('NOT_FOUND', `Route ${request.method}:${request.url} not found`)
    );
  });
}
