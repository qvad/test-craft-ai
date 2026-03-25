import { Injectable, computed, signal, inject, OnDestroy } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import {
  TestExecution,
  ExecutionStatus,
  NodeExecutionResult,
  ExecutionLog
} from '../../../shared/models';
import { ExecutionApiService } from '../api/execution-api.service';
import { WebSocketService } from '../api/websocket.service';
import { TestPlanStore } from './test-plan.store';

/**
 * State management for test plan execution.
 * Handles running, pausing, stopping tests and tracking results.
 *
 * @description
 * The ExecutionStore manages:
 * - Starting and controlling test executions
 * - Real-time progress tracking via WebSocket
 * - Execution logs and node results
 * - Execution history
 *
 * @example
 * ```typescript
 * readonly executionStore = inject(ExecutionStore);
 *
 * // Start execution
 * await this.executionStore.execute();
 *
 * // Watch progress
 * effect(() => {
 *   console.log(`Progress: ${this.executionStore.progress()}%`);
 *   console.log(`Passed: ${this.executionStore.passedCount()}`);
 * });
 *
 * // Stop if needed
 * await this.executionStore.stop();
 * ```
 */
@Injectable({
  providedIn: 'root'
})
export class ExecutionStore implements OnDestroy {
  private readonly executionApi = inject(ExecutionApiService);
  private readonly wsService = inject(WebSocketService);
  private readonly planStore = inject(TestPlanStore);
  private readonly destroy$ = new Subject<void>();

  // ============================================================
  // State Signals (private, mutable)
  // ============================================================

  private readonly _currentExecution = signal<TestExecution | null>(null);
  private readonly _executionHistory = signal<TestExecution[]>([]);
  private readonly _isExecuting = signal(false);
  private readonly _logs = signal<ExecutionLog[]>([]);
  private readonly _error = signal<string | null>(null);

  // ============================================================
  // Public Readonly State
  // ============================================================

  /** The current execution details */
  readonly currentExecution = this._currentExecution.asReadonly();

  /** History of recent executions (max 50) */
  readonly executionHistory = this._executionHistory.asReadonly();

  /** Whether an execution is currently in progress */
  readonly isExecuting = this._isExecuting.asReadonly();

  /** Execution logs from all nodes */
  readonly logs = this._logs.asReadonly();

  /** Current error message, if any */
  readonly error = this._error.asReadonly();

  /** Current execution status */
  readonly status = computed<ExecutionStatus | null>(() => {
    return this._currentExecution()?.status ?? null;
  });

  /** Execution progress percentage (0-100) */
  readonly progress = computed(() => {
    const execution = this._currentExecution();
    if (!execution) return 0;
    return execution.progress;
  });

  /** Results for all executed nodes */
  readonly results = computed(() => {
    return this._currentExecution()?.results ?? [];
  });

  /** Count of nodes that passed */
  readonly passedCount = computed(() => {
    return this.results().filter((r) => r.status === 'passed').length;
  });

  /** Count of nodes that failed */
  readonly failedCount = computed(() => {
    return this.results().filter((r) => r.status === 'failed').length;
  });

  /** Count of nodes currently running */
  readonly runningCount = computed(() => {
    return this.results().filter((r) => r.status === 'running').length;
  });

  /** Whether execution is paused */
  readonly isPaused = computed(() => {
    return this._currentExecution()?.status === 'paused';
  });

  /** Whether a new execution can be started */
  readonly canRun = computed(() => {
    const status = this.status();
    return !status || status === 'completed' || status === 'failed' || status === 'cancelled';
  });

  /** Whether the current execution can be stopped */
  readonly canStop = computed(() => {
    const status = this.status();
    return status === 'running' || status === 'paused' || status === 'initializing';
  });

  /** Whether the current execution can be paused */
  readonly canPause = computed(() => {
    return this.status() === 'running';
  });

  constructor() {
    this.setupWebSocketListeners();
  }

  /**
   * Sets up WebSocket event listeners for real-time execution updates.
   */
  private setupWebSocketListeners(): void {
    this.wsService.onExecutionStarted()
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ executionId }) => {
        this._isExecuting.set(true);
        this.addLog({ level: 'info', message: `Execution ${executionId} started`, timestamp: new Date() });
      });

    this.wsService.onNodeStarted()
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ nodeId, nodeName }) => {
        this.updateNodeResult(nodeId, { status: 'running', nodeName });
        this.addLog({ level: 'info', message: `Running: ${nodeName}`, nodeId, timestamp: new Date() });
      });

    this.wsService.onNodeCompleted()
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ result }) => {
        this.updateNodeResult(result.nodeId, result);
        const level = result.status === 'failed' ? 'error' : 'info';
        this.addLog({
          level,
          message: `${result.nodeName}: ${result.status} (${result.duration}ms)`,
          nodeId: result.nodeId,
          timestamp: new Date()
        });
      });

    this.wsService.onNodeLog()
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ log }) => {
        this.addLog(log);
      });

    this.wsService.onExecutionCompleted()
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ execution }) => {
        this._currentExecution.set(execution);
        this._isExecuting.set(false);
        this._executionHistory.update((history) => [execution, ...history].slice(0, 50));
        this.addLog({
          level: execution.status === 'completed' ? 'info' : 'error',
          message: `Execution ${execution.status}`,
          timestamp: new Date()
        });
      });
  }

  // ============================================================
  // Execution Control Actions
  // ============================================================

  /**
   * Starts execution of the current test plan.
   * @param environmentId - Optional environment to run against
   */
  async execute(environmentId?: string): Promise<void> {
    const plan = this.planStore.plan();
    if (!plan) {
      this._error.set('No test plan loaded');
      return;
    }

    this._isExecuting.set(true);
    this._error.set(null);
    this._logs.set([]);

    try {
      // Create execution instance
      const execution = this.createMockExecution(plan.id, environmentId);
      this._currentExecution.set(execution);

      // Subscribe to WebSocket updates (for future real-time updates)
      this.wsService.connect();
      this.wsService.subscribeToExecution(execution.id);

      // Run real execution against backend API
      await this.runRealExecution(execution);
    } catch (e) {
      this._error.set(e instanceof Error ? e.message : 'Execution failed');
      this._isExecuting.set(false);
    }
  }

  /**
   * Stops the current execution.
   */
  async stop(): Promise<void> {
    const execution = this._currentExecution();
    if (!execution) return;

    try {
      this._currentExecution.update((e) =>
        e ? { ...e, status: 'cancelled', completedAt: new Date() } : null
      );
      this._isExecuting.set(false);
      this.addLog({ level: 'warn', message: 'Execution cancelled by user', timestamp: new Date() });
    } catch (e) {
      this._error.set(e instanceof Error ? e.message : 'Failed to stop execution');
    }
  }

  /**
   * Pauses the current execution.
   */
  async pause(): Promise<void> {
    const execution = this._currentExecution();
    if (!execution) return;

    this._currentExecution.update((e) =>
      e ? { ...e, status: 'paused' } : null
    );
    this.addLog({ level: 'info', message: 'Execution paused', timestamp: new Date() });
  }

  /**
   * Resumes a paused execution.
   */
  async resume(): Promise<void> {
    const execution = this._currentExecution();
    if (!execution) return;

    this._currentExecution.update((e) =>
      e ? { ...e, status: 'running' } : null
    );
    this.addLog({ level: 'info', message: 'Execution resumed', timestamp: new Date() });
  }

  /**
   * Clears all execution logs.
   */
  clearLogs(): void {
    this._logs.set([]);
  }

  /**
   * Clears the current execution state.
   */
  clearExecution(): void {
    this._currentExecution.set(null);
    this._logs.set([]);
    this._error.set(null);
  }

  // ============================================================
  // Private Helper Methods
  // ============================================================

  /**
   * Adds a log entry to the execution logs.
   */
  private static readonly MAX_LOGS = 5000;

  private addLog(log: ExecutionLog): void {
    this._logs.update((logs) => {
      const updated = [...logs, log];
      // Cap to prevent unbounded memory growth on long-running tests
      return updated.length > ExecutionStore.MAX_LOGS
        ? updated.slice(-ExecutionStore.MAX_LOGS)
        : updated;
    });
  }

  /**
   * Updates the result for a specific node.
   */
  private updateNodeResult(nodeId: string, result: Partial<NodeExecutionResult>): void {
    this._currentExecution.update((execution) => {
      if (!execution) return null;

      const results = execution.results.map((r) =>
        r.nodeId === nodeId ? { ...r, ...result } : r
      );

      const completed = results.filter((r) =>
        r.status === 'passed' || r.status === 'failed' || r.status === 'skipped'
      ).length;
      const progress = Math.round((completed / results.length) * 100);

      return { ...execution, results, progress };
    });
  }

  /**
   * Creates a mock execution for development testing.
   * TODO: Replace with actual API call
   */
  private createMockExecution(planId: string, environmentId?: string): TestExecution {
    const allNodes = this.planStore.nodes();
    const nodes = this.getNodesInTreeOrder(allNodes);

    return {
      id: crypto.randomUUID(),
      testPlanId: planId,
      testPlanName: this.planStore.plan()?.name ?? 'Test Plan',
      environmentId: environmentId ?? 'default',
      status: 'running',
      startedAt: new Date(),
      triggeredBy: 'current-user',
      results: nodes.map((node) => ({
        nodeId: node.id,
        nodeName: node.name,
        status: 'pending',
        logs: []
      })),
      logs: [],
      progress: 0
    };
  }

  /**
   * Executes the test plan by calling the real backend API for each node.
   * Maintains execution context for variable passing between nodes.
   * Uses depth-first tree traversal to respect parent-child execution order.
   * Also saves execution results to the reporting backend for later viewing.
   */
  private async runRealExecution(execution: TestExecution): Promise<void> {
    const allNodes = this.planStore.nodes();
    const nodes = this.getNodesInTreeOrder(allNodes);

    // Execution context - variables passed between nodes
    const context: Record<string, unknown> = {};

    // Initialize context with plan variables
    const plan = this.planStore.plan();
    if (plan?.variables) {
      for (const variable of plan.variables) {
        context[variable.name] = variable.value;
      }
    }

    this.addLog({ level: 'info', message: `Starting execution with ${nodes.length} nodes (tree order)`, timestamp: new Date() });

    // Start execution recording on backend
    await this.startBackendExecution(execution, plan?.name || 'Test Plan', plan?.id);

    // Add teardown step to execution results (hidden step shown at the end)
    const teardownNodeId = '__teardown__';
    this._currentExecution.update((e) => e ? {
      ...e,
      results: [...e.results, {
        nodeId: teardownNodeId,
        nodeName: 'Teardown',
        status: 'pending',
        logs: []
      }]
    } : null);

    // Execute nodes with proper cleanup handling
    let executionError: Error | null = null;
    try {
      await this.executeNodes(nodes, context, execution);
    } catch (error) {
      executionError = error instanceof Error ? error : new Error(String(error));
    }

    // Always run teardown phase (even on failure/cancellation)
    await this.runTeardownPhase(teardownNodeId, context, execution);

    // Complete execution
    const failed = this.failedCount() > 0 || executionError !== null;
    this._currentExecution.update((e) =>
      e
        ? {
            ...e,
            status: failed ? 'failed' : 'completed',
            completedAt: new Date(),
            progress: 100
          }
        : null
    );
    this._isExecuting.set(false);

    // Complete execution recording on backend
    await this.completeBackendExecution(execution.id);

    this.addLog({
      level: failed ? 'error' : 'info',
      message: `Execution ${failed ? 'failed' : 'completed'} - ${this.passedCount()} passed, ${this.failedCount()} failed`,
      timestamp: new Date()
    });
  }

  /**
   * Executes all nodes in order with context passing.
   */
  private async executeNodes(
    nodes: Array<{ id: string; name: string; type: string; config: unknown }>,
    context: Record<string, unknown>,
    execution: TestExecution
  ): Promise<void> {
    for (const node of nodes) {
      if (this._currentExecution()?.status === 'cancelled') break;

      while (this._currentExecution()?.status === 'paused') {
        await this.delay(100);
      }

      if (this._currentExecution()?.status === 'cancelled') break;

      // Start node
      const startTime = Date.now();
      this.updateNodeResult(node.id, { status: 'running', startedAt: new Date() });
      this.addLog({ level: 'info', message: `Running: ${node.name} (${node.type})`, nodeId: node.id, timestamp: new Date() });

      try {
        // Call the real backend API
        const response = await fetch('/api/v1/test/node', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nodeType: node.type,
            config: node.config,
            inputs: context
          })
        });

        const result = await response.json();
        const duration = Date.now() - startTime;

        // Log full API response to UI
        this.addLog({
          level: 'debug',
          message: `API Response: ${JSON.stringify({ status: result.status, error: result.error, output: result.output })}`,
          nodeId: node.id,
          timestamp: new Date()
        });

        // Log individual backend logs to UI
        if (result.logs && Array.isArray(result.logs)) {
          for (const log of result.logs) {
            this.addLog({
              level: log.level || 'info',
              message: `[Backend] ${log.message}`,
              nodeId: node.id,
              timestamp: new Date(log.timestamp || Date.now())
            });
          }
        }

        // Backend returns { status: 'success' | 'error', output: {...}, error: '...' }
        const isSuccess = result.status === 'success';

        if (isSuccess) {
          // Merge output variables into context for next nodes
          if (result.output) {
            Object.assign(context, result.output);
            // Also set _previousOutput for assertions to use
            context['_previousOutput'] = result.output;

            // Track Docker containers for cleanup (both by ID and name)
            if (node.type === 'docker-run') {
              const containerId = result.output?.containerId;
              const containerName = result.output?.containerName || (node.config as Record<string, unknown>)?.['name'];

              // Track container by ID (preferred) or by name (fallback)
              const containerRef = containerId || containerName;
              if (containerRef) {
                if (!context['_dockerContainers']) {
                  context['_dockerContainers'] = [];
                }
                (context['_dockerContainers'] as string[]).push(containerRef as string);
                this.addLog({
                  level: 'debug',
                  message: `Tracking container for cleanup: ${containerRef}`,
                  nodeId: node.id,
                  timestamp: new Date()
                });
              }
            }

            this.addLog({
              level: 'debug',
              message: `Outputs: ${JSON.stringify(result.output)}`,
              nodeId: node.id,
              timestamp: new Date()
            });
          }

          // Also merge extracted values (from extractors)
          if (result.extractedValues) {
            Object.assign(context, result.extractedValues);
          }

          this.updateNodeResult(node.id, {
            status: 'passed',
            completedAt: new Date(),
            duration,
            logs: result.logs?.map((l: { message: string }) => l.message) || [`Executed ${node.name}`],
            output: result.output
          });

          this.addLog({
            level: 'info',
            message: `${node.name}: passed (${duration}ms)`,
            nodeId: node.id,
            timestamp: new Date()
          });

          // Record step result to backend
          await this.recordBackendStep(execution.id, {
            id: node.id,
            name: node.name,
            type: node.type,
            status: 'passed',
            duration,
            output: result.output,
            extractedVariables: result.output,
            logs: result.logs || []
          });
        } else {
          this.updateNodeResult(node.id, {
            status: 'failed',
            completedAt: new Date(),
            duration,
            error: { message: result.error || 'Unknown error', type: 'ExecutionError' },
            logs: result.logs?.map((l: { message: string }) => l.message) || []
          });

          this.addLog({
            level: 'error',
            message: `${node.name}: failed - ${result.error} (${duration}ms)`,
            nodeId: node.id,
            timestamp: new Date()
          });

          // Record failed step to backend
          await this.recordBackendStep(execution.id, {
            id: node.id,
            name: node.name,
            type: node.type,
            status: 'failed',
            duration,
            error: { message: result.error || 'Unknown error', type: 'ExecutionError' },
            logs: result.logs || []
          });
        }
      } catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : 'Network error';

        this.updateNodeResult(node.id, {
          status: 'failed',
          completedAt: new Date(),
          duration,
          error: { message: errorMessage, type: 'NetworkError' },
          logs: []
        });

        this.addLog({
          level: 'error',
          message: `${node.name}: failed - ${errorMessage} (${duration}ms)`,
          nodeId: node.id,
          timestamp: new Date()
        });

        // Record failed step to backend
        await this.recordBackendStep(execution.id, {
          id: node.id,
          name: node.name,
          type: node.type,
          status: 'error',
          duration,
          error: { message: errorMessage, type: 'NetworkError' },
          logs: []
        });
      }
    }
  }

  /**
   * Runs the teardown phase - cleans up all resources created during execution.
   * This runs as a visible step that always executes, even on failure/cancellation.
   */
  private async runTeardownPhase(
    teardownNodeId: string,
    context: Record<string, unknown>,
    execution: TestExecution
  ): Promise<void> {
    const containerIds = context['_dockerContainers'] as string[] | undefined;
    const hasResourcesToCleanup = containerIds && containerIds.length > 0;

    // If no resources to cleanup, mark teardown as skipped
    if (!hasResourcesToCleanup) {
      this.updateNodeResult(teardownNodeId, {
        status: 'skipped',
        completedAt: new Date(),
        duration: 0,
        logs: ['No resources to cleanup']
      });
      return;
    }

    const startTime = Date.now();
    this.updateNodeResult(teardownNodeId, { status: 'running', startedAt: new Date() });
    this.addLog({ level: 'info', message: 'Teardown: Starting cleanup phase', nodeId: teardownNodeId, timestamp: new Date() });

    const cleanupLogs: string[] = [];
    let cleanupErrors = 0;

    // Cleanup Docker containers
    if (containerIds && containerIds.length > 0) {
      this.addLog({
        level: 'info',
        message: `Teardown: Stopping ${containerIds.length} Docker container(s): ${containerIds.map(c => c.slice(0, 12)).join(', ')}`,
        nodeId: teardownNodeId,
        timestamp: new Date()
      });
      cleanupLogs.push(`Stopping ${containerIds.length} Docker container(s): ${containerIds.map(c => c.slice(0, 12)).join(', ')}`);

      for (const containerRef of containerIds) {
        try {
          // containerRef could be either container ID or container name
          const isContainerId = /^[a-f0-9]{64}$|^[a-f0-9]{12}$/.test(containerRef);

          const response = await fetch('/api/v1/test/node', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              nodeType: 'docker-stop',
              config: isContainerId
                ? { containerId: containerRef, remove: true }
                : { containerName: containerRef, remove: true },
              inputs: {}
            })
          });

          const result = await response.json();

          if (result.status === 'success') {
            const msg = `Stopped and removed container: ${containerRef.slice(0, 20)}`;
            cleanupLogs.push(msg);
            this.addLog({ level: 'debug', message: `Teardown: ${msg}`, nodeId: teardownNodeId, timestamp: new Date() });
          } else {
            const msg = `Failed to stop container ${containerRef.slice(0, 20)}: ${result.error}`;
            cleanupLogs.push(msg);
            cleanupErrors++;
            this.addLog({ level: 'warn', message: `Teardown: ${msg}`, nodeId: teardownNodeId, timestamp: new Date() });
          }
        } catch (err) {
          const msg = `Error stopping container ${containerRef.slice(0, 20)}: ${err instanceof Error ? err.message : 'Unknown error'}`;
          cleanupLogs.push(msg);
          cleanupErrors++;
          this.addLog({ level: 'warn', message: `Teardown: ${msg}`, nodeId: teardownNodeId, timestamp: new Date() });
        }
      }
    }

    const duration = Date.now() - startTime;
    const teardownStatus = cleanupErrors === 0 ? 'passed' : 'warning';

    this.updateNodeResult(teardownNodeId, {
      status: teardownStatus,
      completedAt: new Date(),
      duration,
      logs: cleanupLogs
    });

    // Record teardown step to backend
    await this.recordBackendStep(execution.id, {
      id: teardownNodeId,
      name: 'Teardown',
      type: 'teardown',
      status: teardownStatus,
      duration,
      output: { cleanedContainers: containerIds?.length || 0, errors: cleanupErrors },
      logs: cleanupLogs.map(msg => ({ level: 'info', message: msg }))
    });

    this.addLog({
      level: cleanupErrors > 0 ? 'warn' : 'info',
      message: `Teardown: Cleanup complete (${cleanupErrors} errors) (${duration}ms)`,
      nodeId: teardownNodeId,
      timestamp: new Date()
    });
  }

  /**
   * Utility to pause execution for a duration.
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Gets nodes in depth-first tree order for execution.
   * Respects parent-child relationships and node ordering.
   */
  private getNodesInTreeOrder<T extends { id: string; type: string; enabled: boolean; parentId: string | null; order: number; children: string[] }>(
    allNodes: T[]
  ): T[] {
    const nodeMap = new Map(allNodes.map(n => [n.id, n]));
    const result: T[] = [];

    // Find root nodes (thread-groups or nodes with no parent)
    const rootNodes = allNodes.filter(n =>
      n.type !== 'root' && n.enabled &&
      (n.parentId === null || n.parentId === 'root' || nodeMap.get(n.parentId)?.type === 'root')
    ).sort((a, b) => a.order - b.order);

    // Recursive depth-first traversal
    const traverse = (node: T) => {
      result.push(node);
      const children = node.children
        .map(childId => nodeMap.get(childId))
        .filter((n): n is T => n !== undefined && n.enabled)
        .sort((a, b) => a.order - b.order);
      for (const child of children) {
        traverse(child);
      }
    };

    for (const root of rootNodes) {
      traverse(root);
    }

    return result;
  }

  // ============================================================
  // Backend Integration for Reporting
  // ============================================================

  /**
   * Starts execution recording on the backend.
   */
  private async startBackendExecution(
    execution: TestExecution,
    planName: string,
    planId?: string
  ): Promise<void> {
    try {
      await fetch(`/api/v1/reports/executions/${execution.id}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planName,
          planId,
          environment: execution.environmentId,
          variables: {}
        })
      });
    } catch (error) {
      console.warn('[ExecutionStore] Failed to start backend execution recording:', error);
    }
  }

  /**
   * Records a step result to the backend.
   */
  private async recordBackendStep(
    executionId: string,
    step: {
      id: string;
      name: string;
      type: string;
      status: string;
      duration?: number;
      output?: unknown;
      extractedVariables?: Record<string, unknown>;
      error?: { message: string; type?: string; stack?: string };
      logs?: Array<{ level?: string; message: string; timestamp?: string }>;
    }
  ): Promise<void> {
    try {
      const now = new Date();
      await fetch(`/api/v1/reports/executions/${executionId}/steps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: step.id,
          name: step.name,
          type: step.type,
          status: step.status,
          startTime: new Date(now.getTime() - (step.duration || 0)),
          endTime: now,
          duration: step.duration,
          output: step.output ? JSON.stringify(step.output) : undefined,
          extractedVariables: step.extractedVariables,
          error: step.error,
          assertions: [],
          metrics: {
            startTime: new Date(now.getTime() - (step.duration || 0)),
            endTime: now,
            duration: step.duration
          },
          logs: (step.logs || []).map(log => ({
            timestamp: log.timestamp || now.toISOString(),
            level: log.level || 'info',
            message: log.message
          }))
        })
      });
    } catch (error) {
      console.warn('[ExecutionStore] Failed to record step to backend:', error);
    }
  }

  /**
   * Completes execution recording on the backend.
   */
  private async completeBackendExecution(executionId: string): Promise<void> {
    try {
      await fetch(`/api/v1/reports/executions/${executionId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.warn('[ExecutionStore] Failed to complete backend execution recording:', error);
    }
  }

  /** Cleanup on service destruction */
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
