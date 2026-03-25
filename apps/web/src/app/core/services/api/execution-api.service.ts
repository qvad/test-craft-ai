import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseApiService } from './base-api.service';
import { TestExecution, ExecutionLog } from '../../../shared/models';

/** Request payload for executing a test plan */
export interface ExecuteRequest {
  /** Optional environment to run against */
  environmentId?: string;
  /** Execution mode: sequential or parallel */
  mode?: 'sequential' | 'parallel';
  /** Stop on first failure */
  stopOnFailure?: boolean;
  /** Enable debug logging */
  debugMode?: boolean;
  /** Run without making actual requests */
  dryRun?: boolean;
}

/** Parameters for listing executions */
export interface ExecutionListParams {
  /** Filter by test plan ID */
  testPlanId?: string;
  /** Filter by status */
  status?: string;
  /** Maximum results to return */
  limit?: number;
  /** Results offset for pagination */
  offset?: number;
}

/**
 * API service for test execution operations.
 * Handles running, controlling, and querying test executions.
 *
 * @example
 * ```typescript
 * const executionApi = inject(ExecutionApiService);
 *
 * // Execute a test plan
 * executionApi.execute('plan-123', { debugMode: true }).subscribe(exec => {
 *   console.log('Execution started:', exec.id);
 * });
 *
 * // Stop a running execution
 * executionApi.stopExecution('exec-456').subscribe();
 * ```
 */
@Injectable({
  providedIn: 'root'
})
export class ExecutionApiService extends BaseApiService {
  /**
   * Starts execution of a test plan.
   * @param planId - The plan to execute
   * @param request - Execution options
   */
  execute(planId: string, request: ExecuteRequest = {}): Observable<TestExecution> {
    return this.post<TestExecution>(`/test-plans/${planId}/execute`, request);
  }

  /** Gets details of a specific execution */
  getExecution(executionId: string): Observable<TestExecution> {
    return this.get<TestExecution>(`/executions/${executionId}`);
  }

  /** Gets a list of executions with optional filtering */
  getExecutions(params: ExecutionListParams = {}): Observable<TestExecution[]> {
    return this.get<TestExecution[]>('/executions', params as Record<string, string | number | boolean>);
  }

  /** Stops a running execution */
  stopExecution(executionId: string): Observable<TestExecution> {
    return this.post<TestExecution>(`/executions/${executionId}/stop`, {});
  }

  /** Pauses a running execution */
  pauseExecution(executionId: string): Observable<TestExecution> {
    return this.post<TestExecution>(`/executions/${executionId}/pause`, {});
  }

  /** Resumes a paused execution */
  resumeExecution(executionId: string): Observable<TestExecution> {
    return this.post<TestExecution>(`/executions/${executionId}/resume`, {});
  }

  /**
   * Gets execution logs with optional filtering.
   * @param executionId - The execution to get logs for
   * @param params - Optional filters (nodeId, level)
   */
  getExecutionLogs(executionId: string, params: { nodeId?: string; level?: string } = {}): Observable<ExecutionLog[]> {
    return this.get<ExecutionLog[]>(`/executions/${executionId}/logs`, params);
  }
}
