import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { orchestrator } from '../containers/orchestrator.js';
import { SUPPORTED_LANGUAGES, type SupportedLanguage, type ExecutionRequest, type LanguageDependencies } from '../containers/types.js';
import { recordStepResult } from '../reporting/routes.js';
import { broadcastExecutionEvent } from '../websocket/routes.js';
import { ensureExecutionContext } from '../context/routes.js';
import { logger } from '../../common/logger.js';
import { config } from '../../config/index.js';

// Dependencies schema for each language
const DependenciesSchema = z.object({
  python: z.object({
    packages: z.array(z.string()),
    requirements: z.string().optional(),
  }).optional(),
  javascript: z.object({
    packages: z.array(z.string()),
    packageJson: z.string().optional(),
  }).optional(),
  java: z.object({
    maven: z.array(z.string()).optional(),
    jars: z.array(z.string()).optional(),
    gradleDeps: z.array(z.string()).optional(),
  }).optional(),
  csharp: z.object({
    packages: z.array(z.string()),
  }).optional(),
  go: z.object({
    modules: z.array(z.string()),
  }).optional(),
  ruby: z.object({
    gems: z.array(z.string()),
  }).optional(),
  rust: z.object({
    crates: z.array(z.string()),
  }).optional(),
  php: z.object({
    packages: z.array(z.string()),
  }).optional(),
  kotlin: z.object({
    maven: z.array(z.string()).optional(),
    jars: z.array(z.string()).optional(),
  }).optional(),
}).optional();

// Request validation schema
const ExecuteCodeSchema = z.object({
  language: z.enum(SUPPORTED_LANGUAGES as [SupportedLanguage, ...SupportedLanguage[]]),
  code: z.string().min(1).max(1000000), // Max 1MB of code
  timeout: z.number().min(1).max(config.execution.maxTimeout).optional(),
  inputs: z.record(z.unknown()).optional(),
  useWarmPool: z.boolean().optional().default(true),
  dependencies: DependenciesSchema,
});

// In-memory store for execution results (use Redis in production)
const executionStore = new Map<string, {
  status: 'pending' | 'running' | 'completed' | 'failed';
  request: ExecutionRequest;
  result?: unknown;
  createdAt: Date;
  completedAt?: Date;
}>();

export async function executionRoutes(app: FastifyInstance): Promise<void> {
  // Execute code
  app.post<{
    Body: z.infer<typeof ExecuteCodeSchema>;
  }>('/', async (request, reply) => {
    const requestStartTime = Date.now();
    let executionId = '';

    try {
      // Step 1: Validate request
      logger.debug(
        { contentLength: JSON.stringify(request.body).length, phase: 'REQUEST_VALIDATION_START' },
        '[API] Validating execution request'
      );

      const body = ExecuteCodeSchema.parse(request.body);
      executionId = uuidv4();

      logger.info(
        {
          executionId,
          language: body.language,
          codeLength: body.code.length,
          timeout: body.timeout || config.execution.defaultTimeout,
          useWarmPool: body.useWarmPool,
          hasInputs: !!body.inputs,
          inputKeys: body.inputs ? Object.keys(body.inputs) : [],
          phase: 'EXECUTION_REQUEST_RECEIVED'
        },
        `[API] Execution request received - ${body.language}, ${body.code.length} bytes, warmPool=${body.useWarmPool}`
      );

      // Step 2: Store execution request & create context
      executionStore.set(executionId, {
        status: 'running',
        request: {
          executionId,
          language: body.language,
          code: body.code,
          timeout: body.timeout,
          inputs: body.inputs,
        },
        createdAt: new Date(),
      });

      // Create execution context and inject inputs as plan-scoped variables
      const context = ensureExecutionContext(executionId);
      if (body.inputs) {
        for (const [key, value] of Object.entries(body.inputs)) {
          context.setVariable(key, value, { scope: 'plan' });
        }
      }

      // Broadcast execution started
      broadcastExecutionEvent(executionId, {
        type: 'execution:started',
        executionId,
        language: body.language,
        timestamp: Date.now(),
      });

      logger.debug(
        { executionId, phase: 'EXECUTION_STORED' },
        '[API] Execution request stored in memory'
      );

      // Step 3: Execute code
      const executeStart = Date.now();
      logger.info(
        {
          executionId,
          language: body.language,
          mode: body.useWarmPool ? 'warm_pool' : 'cold_start',
          phase: 'EXECUTION_DISPATCHED'
        },
        `[API] Dispatching execution to orchestrator (${body.useWarmPool ? 'warm pool' : 'cold start'})`
      );

      const result = body.useWarmPool
        ? await orchestrator.executeWithWarmPool({
            executionId,
            language: body.language,
            code: body.code,
            timeout: body.timeout,
            inputs: body.inputs,
            dependencies: body.dependencies as LanguageDependencies | undefined,
          })
        : await orchestrator.executeWithNewPod({
            executionId,
            language: body.language,
            code: body.code,
            timeout: body.timeout,
            inputs: body.inputs,
            dependencies: body.dependencies as LanguageDependencies | undefined,
          });

      const executeDuration = Date.now() - executeStart;

      // Step 4: Update store with result
      const execution = executionStore.get(executionId);
      if (execution) {
        execution.status = result.status === 'success' ? 'completed' : 'failed';
        execution.result = result;
        execution.completedAt = new Date();
      }

      const totalDuration = Date.now() - requestStartTime;

      // Step 5: Record step result for reporting
      recordStepResult(executionId, {
        id: executionId,
        name: `${body.language} execution`,
        type: 'code-execution',
        status: result.status === 'success' ? 'passed' : 'failed',
        startTime: new Date(requestStartTime),
        endTime: new Date(),
        duration: totalDuration,
        assertions: [],
        error: result.status !== 'success' ? { message: result.error || 'Unknown error' } : undefined,
        metrics: { startTime: new Date(requestStartTime), endTime: new Date(), duration: totalDuration },
        logs: [],
      });

      // Step 6: Log final result and broadcast
      if (result.status === 'success') {
        logger.info(
          {
            executionId,
            status: result.status,
            language: body.language,
            exitCode: result.exitCode,
            executeDuration,
            totalDuration,
            outputLength: result.output?.length || 0,
            podName: result.podName,
            phase: 'EXECUTION_SUCCESS'
          },
          `[API] Execution SUCCESS - ${body.language}, exit=${result.exitCode}, total=${totalDuration}ms`
        );

        broadcastExecutionEvent(executionId, {
          type: 'execution:completed',
          executionId,
          status: 'success',
          exitCode: result.exitCode,
          duration: totalDuration,
          timestamp: Date.now(),
        });
      } else {
        logger.warn(
          {
            executionId,
            status: result.status,
            language: body.language,
            exitCode: result.exitCode,
            error: result.error,
            executeDuration,
            totalDuration,
            podName: result.podName,
            phase: 'EXECUTION_FAILED'
          },
          `[API] Execution FAILED - ${body.language}, exit=${result.exitCode}, error: ${result.error}`
        );

        broadcastExecutionEvent(executionId, {
          type: 'execution:failed',
          executionId,
          status: 'failed',
          error: result.error,
          exitCode: result.exitCode,
          duration: totalDuration,
          timestamp: Date.now(),
        });
      }

      return reply.send(result);
    } catch (err) {
      const totalDuration = Date.now() - requestStartTime;

      // Broadcast failure
      if (executionId) {
        broadcastExecutionEvent(executionId, {
          type: 'execution:failed',
          executionId,
          status: 'error',
          error: err instanceof Error ? err.message : 'Unknown error',
          timestamp: Date.now(),
        });
      }

      if (err instanceof z.ZodError) {
        logger.warn(
          {
            executionId: executionId || 'unknown',
            validationErrors: err.errors,
            totalDuration,
            phase: 'VALIDATION_FAILED'
          },
          `[API] Request validation failed: ${err.errors.map(e => e.message).join(', ')}`
        );
        return reply.status(400).send({
          error: 'Validation error',
          details: err.errors,
        });
      }

      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      const errorStack = err instanceof Error ? err.stack : undefined;

      logger.error(
        {
          err,
          executionId: executionId || 'unknown',
          errorMessage,
          errorStack,
          totalDuration,
          phase: 'API_ERROR'
        },
        `[API] Execution API error: ${errorMessage}`
      );

      return reply.status(500).send({
        error: 'Internal server error',
        message: errorMessage,
      });
    }
  });

  // Get execution status
  app.get<{ Params: { executionId: string } }>(
    '/:executionId',
    async (request, reply) => {
      const { executionId } = request.params;
      const execution = executionStore.get(executionId);

      if (!execution) {
        return reply.status(404).send({ error: 'Execution not found' });
      }

      return reply.send({
        executionId,
        status: execution.status,
        language: execution.request.language,
        createdAt: execution.createdAt,
        completedAt: execution.completedAt,
        result: execution.result,
      });
    }
  );

  // List recent executions
  app.get('/', async (_request, reply) => {
    const executions = Array.from(executionStore.entries())
      .map(([id, exec]) => ({
        executionId: id,
        status: exec.status,
        language: exec.request.language,
        createdAt: exec.createdAt,
        completedAt: exec.completedAt,
      }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 100); // Last 100 executions

    return reply.send({ executions });
  });

  // Execute code synchronously and wait for result
  app.post<{
    Body: z.infer<typeof ExecuteCodeSchema>;
  }>('/sync', async (request, reply) => {
    const requestStartTime = Date.now();
    let executionId = '';

    try {
      const body = ExecuteCodeSchema.parse(request.body);
      executionId = uuidv4();

      logger.info(
        {
          executionId,
          language: body.language,
          codeLength: body.code.length,
          timeout: body.timeout || config.execution.defaultTimeout,
          useWarmPool: body.useWarmPool,
          endpoint: 'sync',
          phase: 'SYNC_EXECUTION_START'
        },
        `[API/sync] Synchronous execution request - ${body.language}, ${body.code.length} bytes`
      );

      // Create execution context and inject inputs
      const context = ensureExecutionContext(executionId);
      if (body.inputs) {
        for (const [key, value] of Object.entries(body.inputs)) {
          context.setVariable(key, value, { scope: 'plan' });
        }
      }

      // Broadcast execution started
      broadcastExecutionEvent(executionId, {
        type: 'execution:started',
        executionId,
        language: body.language,
        timestamp: Date.now(),
      });

      const result = body.useWarmPool
        ? await orchestrator.executeWithWarmPool({
            executionId,
            language: body.language,
            code: body.code,
            timeout: body.timeout,
            inputs: body.inputs,
            dependencies: body.dependencies as LanguageDependencies | undefined,
          })
        : await orchestrator.executeWithNewPod({
            executionId,
            language: body.language,
            code: body.code,
            timeout: body.timeout,
            inputs: body.inputs,
            dependencies: body.dependencies as LanguageDependencies | undefined,
          });

      const totalDuration = Date.now() - requestStartTime;

      // Record step result for reporting
      recordStepResult(executionId, {
        id: executionId,
        name: `${body.language} execution`,
        type: 'code-execution',
        status: result.status === 'success' ? 'passed' : 'failed',
        startTime: new Date(requestStartTime),
        endTime: new Date(),
        duration: totalDuration,
        assertions: [],
        error: result.status !== 'success' ? { message: result.error || 'Unknown error' } : undefined,
        metrics: { startTime: new Date(requestStartTime), endTime: new Date(), duration: totalDuration },
        logs: [],
      });

      // Broadcast completion
      broadcastExecutionEvent(executionId, {
        type: result.status === 'success' ? 'execution:completed' : 'execution:failed',
        executionId,
        status: result.status,
        exitCode: result.exitCode,
        duration: totalDuration,
        timestamp: Date.now(),
      });

      logger.info(
        {
          executionId,
          status: result.status,
          exitCode: result.exitCode,
          totalDuration,
          outputLength: result.output?.length || 0,
          phase: result.status === 'success' ? 'SYNC_EXECUTION_SUCCESS' : 'SYNC_EXECUTION_FAILED'
        },
        `[API/sync] Execution ${result.status} - ${body.language}, exit=${result.exitCode}, total=${totalDuration}ms`
      );

      return reply.send(result);
    } catch (err) {
      const totalDuration = Date.now() - requestStartTime;

      // Broadcast failure
      if (executionId) {
        broadcastExecutionEvent(executionId, {
          type: 'execution:failed',
          executionId,
          status: 'error',
          error: err instanceof Error ? err.message : 'Unknown error',
          timestamp: Date.now(),
        });
      }

      if (err instanceof z.ZodError) {
        logger.warn(
          { executionId, validationErrors: err.errors, totalDuration, phase: 'SYNC_VALIDATION_FAILED' },
          `[API/sync] Validation failed: ${err.errors.map(e => e.message).join(', ')}`
        );
        return reply.status(400).send({
          error: 'Validation error',
          details: err.errors,
        });
      }

      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      logger.error(
        { err, executionId, errorMessage, totalDuration, phase: 'SYNC_API_ERROR' },
        `[API/sync] Execution failed: ${errorMessage}`
      );

      return reply.status(500).send({
        error: 'Internal server error',
        message: errorMessage,
      });
    }
  });

  // Quick test endpoint for each language
  app.post<{ Params: { language: string } }>(
    '/test/:language',
    async (request, reply) => {
      const { language } = request.params;

      if (!SUPPORTED_LANGUAGES.includes(language as SupportedLanguage)) {
        return reply.status(400).send({ error: `Unsupported language: ${language}` });
      }

      const testCode = getTestCode(language as SupportedLanguage);

      try {
        const result = await orchestrator.executeWithWarmPool({
          executionId: uuidv4(),
          language: language as SupportedLanguage,
          code: testCode,
          timeout: 30,
        });

        return reply.send({
          language,
          testResult: result.status === 'success' ? 'passed' : 'failed',
          ...result,
        });
      } catch (err) {
        logger.error({ err, language }, 'Test execution failed');
        return reply.status(500).send({
          language,
          testResult: 'failed',
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }
  );
}

// Get test code for each language
function getTestCode(language: SupportedLanguage): string {
  const testCodes: Record<SupportedLanguage, string> = {
    java: `
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello from Java!");
        System.out.println("Java version: " + System.getProperty("java.version"));
    }
}
`,
    python: `
import sys
print("Hello from Python!")
print(f"Python version: {sys.version}")
`,
    csharp: `
using System;

class Program {
    static void Main() {
        Console.WriteLine("Hello from C#!");
        Console.WriteLine($".NET version: {Environment.Version}");
    }
}
`,
    javascript: `
console.log("Hello from JavaScript!");
console.log("Node version:", process.version);
`,
    typescript: `
console.log("Hello from TypeScript!");
console.log("Node version:", process.version);
const greeting: string = "TypeScript works!";
console.log(greeting);
`,
    go: `
package main

import (
    "fmt"
    "runtime"
)

func main() {
    fmt.Println("Hello from Go!")
    fmt.Printf("Go version: %s\\n", runtime.Version())
}
`,
    rust: `
fn main() {
    println!("Hello from Rust!");
    println!("Rust edition: 2021");
}
`,
    ruby: `
puts "Hello from Ruby!"
puts "Ruby version: #{RUBY_VERSION}"
`,
    php: `<?php
echo "Hello from PHP!\\n";
echo "PHP version: " . phpversion() . "\\n";
`,
    kotlin: `
fun main() {
    println("Hello from Kotlin!")
    println("Kotlin version: ${KotlinVersion.CURRENT}")
}
`,
  };

  return testCodes[language];
}
