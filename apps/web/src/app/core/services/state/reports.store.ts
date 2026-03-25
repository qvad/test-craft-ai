import { Injectable, computed, signal } from '@angular/core';

/**
 * Execution summary for list view
 */
export interface ExecutionSummary {
  id: string;
  planId: string;
  planName: string;
  environment: string;
  status: 'success' | 'failed' | 'error' | 'aborted' | 'running';
  startTime: Date;
  endTime?: Date;
  duration?: number;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
}

/**
 * Step result from backend
 */
export interface ReportStepResult {
  id: string;
  name: string;
  type: string;
  status: 'passed' | 'failed' | 'skipped' | 'error' | 'pending' | 'running';
  startTime: Date;
  endTime?: Date;
  duration?: number;
  assertions: AssertionResult[];
  error?: {
    message: string;
    stack?: string;
    type?: string;
  };
  output?: string;
  extractedVariables?: Record<string, unknown>;
  metrics: {
    startTime: Date;
    endTime?: Date;
    duration?: number;
    responseTime?: number;
    bytesReceived?: number;
    bytesSent?: number;
  };
  logs: LogEntry[];
  children?: ReportStepResult[];
  request?: {
    method?: string;
    url?: string;
    headers?: Record<string, string>;
    body?: string;
  };
  response?: {
    status?: number;
    statusText?: string;
    headers?: Record<string, string>;
    body?: string;
  };
}

/**
 * Assertion result
 */
export interface AssertionResult {
  name: string;
  type: string;
  passed: boolean;
  expected?: unknown;
  actual?: unknown;
  message?: string;
  duration?: number;
}

/**
 * Log entry
 */
export interface LogEntry {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  data?: unknown;
}

/**
 * Full execution report
 */
export interface ExecutionReport {
  id: string;
  planId?: string;
  planName: string;
  planVersion?: string;
  environment: string;
  executionId: string;
  triggeredBy?: string;
  buildNumber?: string;
  gitCommit?: string;
  gitBranch?: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  status: 'success' | 'failed' | 'error' | 'aborted';
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    skipped: number;
    errors: number;
    totalAssertions: number;
    passedAssertions: number;
    failedAssertions: number;
    duration: number;
    avgResponseTime?: number;
    p50ResponseTime?: number;
    p90ResponseTime?: number;
    p95ResponseTime?: number;
    p99ResponseTime?: number;
  };
  steps: ReportStepResult[];
  logs: LogEntry[];
  variables?: Record<string, unknown>;
}

/**
 * Filter options for executions list
 */
export interface ExecutionFilters {
  planId?: string;
  status?: 'success' | 'failed' | 'error' | 'all';
  dateFrom?: Date;
  dateTo?: Date;
  searchQuery?: string;
}

/**
 * Report format types
 */
export type ReportFormat = 'junit' | 'html' | 'json' | 'markdown' | 'csv';

/**
 * State management for reports and execution history.
 * Handles fetching executions, filtering, and report generation.
 */
@Injectable({
  providedIn: 'root'
})
export class ReportsStore {
  // ============================================================
  // State Signals (private, mutable)
  // ============================================================

  private readonly _executions = signal<ExecutionSummary[]>([]);
  private readonly _currentReport = signal<ExecutionReport | null>(null);
  private readonly _selectedStepId = signal<string | null>(null);
  private readonly _filters = signal<ExecutionFilters>({});
  private readonly _isLoading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _totalCount = signal(0);
  private readonly _page = signal(1);
  private readonly _pageSize = signal(20);

  // ============================================================
  // Public Readonly State
  // ============================================================

  /** List of execution summaries */
  readonly executions = this._executions.asReadonly();

  /** Currently loaded execution report */
  readonly currentReport = this._currentReport.asReadonly();

  /** Currently selected step ID in results viewer */
  readonly selectedStepId = this._selectedStepId.asReadonly();

  /** Current filters applied */
  readonly filters = this._filters.asReadonly();

  /** Loading state */
  readonly isLoading = this._isLoading.asReadonly();

  /** Error message if any */
  readonly error = this._error.asReadonly();

  /** Total count for pagination */
  readonly totalCount = this._totalCount.asReadonly();

  /** Current page */
  readonly page = this._page.asReadonly();

  /** Page size */
  readonly pageSize = this._pageSize.asReadonly();

  // ============================================================
  // Computed Properties
  // ============================================================

  /** Filtered executions based on current filters */
  readonly filteredExecutions = computed(() => {
    const executions = this._executions();
    const filters = this._filters();

    return executions.filter(exec => {
      if (filters.planId && exec.planId !== filters.planId) return false;
      if (filters.status && filters.status !== 'all' && exec.status !== filters.status) return false;
      if (filters.dateFrom && new Date(exec.startTime) < filters.dateFrom) return false;
      if (filters.dateTo && new Date(exec.startTime) > filters.dateTo) return false;
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        return exec.planName.toLowerCase().includes(query) ||
               exec.id.toLowerCase().includes(query);
      }
      return true;
    });
  });

  /** Summary counts for all executions */
  readonly summaryCounts = computed(() => {
    const executions = this._executions();
    return {
      total: executions.length,
      success: executions.filter(e => e.status === 'success').length,
      failed: executions.filter(e => e.status === 'failed').length,
      error: executions.filter(e => e.status === 'error').length,
      running: executions.filter(e => e.status === 'running').length,
    };
  });

  /** Currently selected step in results viewer */
  readonly selectedStep = computed(() => {
    const report = this._currentReport();
    const stepId = this._selectedStepId();
    if (!report || !stepId) return null;
    return this.findStepById(report.steps, stepId);
  });

  /** Whether there are more pages to load */
  readonly hasMorePages = computed(() => {
    const total = this._totalCount();
    const page = this._page();
    const pageSize = this._pageSize();
    return page * pageSize < total;
  });

  // ============================================================
  // Actions
  // ============================================================

  /**
   * Load execution history from backend
   */
  async loadExecutions(page = 1): Promise<void> {
    this._isLoading.set(true);
    this._error.set(null);
    this._page.set(page);

    try {
      const filters = this._filters();
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('pageSize', this._pageSize().toString());

      if (filters.planId) params.set('planId', filters.planId);
      if (filters.status && filters.status !== 'all') params.set('status', filters.status);
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom.toISOString());
      if (filters.dateTo) params.set('dateTo', filters.dateTo.toISOString());
      if (filters.searchQuery) params.set('search', filters.searchQuery);

      const response = await fetch(`/api/v1/reports/executions?${params}`);

      if (!response.ok) {
        throw new Error(`Failed to load executions: ${response.statusText}`);
      }

      const data = await response.json();

      // Parse dates
      const executions: ExecutionSummary[] = (data.executions || []).map((exec: Record<string, unknown>) => ({
        ...exec,
        startTime: new Date(exec['startTime'] as string),
        endTime: exec['endTime'] ? new Date(exec['endTime'] as string) : undefined,
      }));

      this._executions.set(executions);
      this._totalCount.set(data.total || executions.length);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load executions';
      this._error.set(message);
      console.error('[ReportsStore] Failed to load executions:', e);
    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * Load a full execution report
   */
  async loadReport(executionId: string): Promise<void> {
    this._isLoading.set(true);
    this._error.set(null);
    this._currentReport.set(null);
    this._selectedStepId.set(null);

    try {
      const response = await fetch(`/api/v1/reports/executions/${executionId}/report?format=json`);

      if (!response.ok) {
        throw new Error(`Failed to load report: ${response.statusText}`);
      }

      const data = await response.json();

      // Parse dates recursively
      const report = this.parseReportDates(data);
      this._currentReport.set(report);

      // Auto-select first step if available
      if (report.steps.length > 0) {
        this._selectedStepId.set(report.steps[0].id);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load report';
      this._error.set(message);
      console.error('[ReportsStore] Failed to load report:', e);
    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * Set filters for execution list
   */
  setFilters(filters: Partial<ExecutionFilters>): void {
    this._filters.update(current => ({ ...current, ...filters }));
  }

  /**
   * Clear all filters
   */
  clearFilters(): void {
    this._filters.set({});
  }

  /**
   * Select a step in the results viewer
   */
  selectStep(stepId: string | null): void {
    this._selectedStepId.set(stepId);
  }

  /**
   * Export report in specified format
   */
  async exportReport(executionId: string, format: ReportFormat): Promise<void> {
    try {
      const response = await fetch(`/api/v1/reports/executions/${executionId}/report?format=${format}`);

      if (!response.ok) {
        throw new Error(`Failed to export report: ${response.statusText}`);
      }

      // Get filename from Content-Disposition header or generate one
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `report-${executionId}.${this.getExtension(format)}`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) filename = match[1];
      }

      // Download the file
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to export report';
      this._error.set(message);
      console.error('[ReportsStore] Failed to export report:', e);
    }
  }

  /**
   * Delete an execution from history
   */
  async deleteExecution(executionId: string): Promise<void> {
    try {
      const response = await fetch(`/api/v1/reports/executions/${executionId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error(`Failed to delete execution: ${response.statusText}`);
      }

      // Remove from local state
      this._executions.update(executions =>
        executions.filter(e => e.id !== executionId)
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to delete execution';
      this._error.set(message);
      console.error('[ReportsStore] Failed to delete execution:', e);
    }
  }

  /**
   * Clear current report
   */
  clearReport(): void {
    this._currentReport.set(null);
    this._selectedStepId.set(null);
    this._error.set(null);
  }

  /**
   * Add a new execution to the list (called after execution completes)
   */
  addExecution(execution: ExecutionSummary): void {
    this._executions.update(executions => [execution, ...executions]);
    this._totalCount.update(count => count + 1);
  }

  // ============================================================
  // Private Helpers
  // ============================================================

  private findStepById(steps: ReportStepResult[], id: string): ReportStepResult | null {
    for (const step of steps) {
      if (step.id === id) return step;
      if (step.children) {
        const found = this.findStepById(step.children, id);
        if (found) return found;
      }
    }
    return null;
  }

  private parseReportDates(report: Record<string, unknown>): ExecutionReport {
    return {
      ...report,
      startTime: new Date(report['startTime'] as string),
      endTime: new Date(report['endTime'] as string),
      steps: this.parseStepsDates(report['steps'] as Record<string, unknown>[]),
      logs: (report['logs'] as Record<string, unknown>[] || []).map(log => ({
        ...log,
        timestamp: new Date(log['timestamp'] as string),
      })),
    } as ExecutionReport;
  }

  private parseStepsDates(steps: Record<string, unknown>[]): ReportStepResult[] {
    return (steps || []).map(step => ({
      ...step,
      startTime: new Date(step['startTime'] as string),
      endTime: step['endTime'] ? new Date(step['endTime'] as string) : undefined,
      metrics: {
        ...(step['metrics'] as Record<string, unknown> || {}),
        startTime: new Date((step['metrics'] as Record<string, unknown>)?.['startTime'] as string || Date.now()),
        endTime: (step['metrics'] as Record<string, unknown>)?.['endTime']
          ? new Date((step['metrics'] as Record<string, unknown>)['endTime'] as string)
          : undefined,
      },
      logs: ((step['logs'] as Record<string, unknown>[]) || []).map(log => ({
        ...log,
        timestamp: new Date(log['timestamp'] as string),
      })),
      children: step['children'] ? this.parseStepsDates(step['children'] as Record<string, unknown>[]) : undefined,
    })) as ReportStepResult[];
  }

  private getExtension(format: ReportFormat): string {
    switch (format) {
      case 'junit': return 'xml';
      case 'html': return 'html';
      case 'json': return 'json';
      case 'markdown': return 'md';
      case 'csv': return 'csv';
      default: return 'txt';
    }
  }
}
