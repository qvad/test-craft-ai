/**
 * Reporting API Routes
 *
 * API endpoints for generating and retrieving test reports
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ReportGenerator, buildExecutionReport } from './report-generator.js';
import { ReportFormat, StepResult } from './types.js';
import { getExecutionContext } from '../context/routes.js';
import { logger } from '../../common/logger.js';

// Store execution results (in production, use database)
const executionResults = new Map<string, {
  planName: string;
  planId?: string;
  steps: StepResult[];
  startTime: Date;
  endTime?: Date;
  environment: string;
  variables?: Record<string, any>;
}>();

const reportGenerator = new ReportGenerator({
  maskSensitiveData: true,
  includeLogs: true,
  includeMetrics: true,
});

export async function reportingRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * List all executions with pagination and filtering
   */
  fastify.get('/executions', async (
    request: FastifyRequest<{
      Querystring: {
        page?: string;
        pageSize?: string;
        planId?: string;
        status?: string;
        dateFrom?: string;
        dateTo?: string;
        search?: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    const {
      page = '1',
      pageSize = '20',
      planId,
      status,
      dateFrom,
      dateTo,
      search,
    } = request.query;

    const pageNum = parseInt(page, 10);
    const pageSizeNum = parseInt(pageSize, 10);

    // Get all executions and convert to summaries
    let executions = Array.from(executionResults.entries()).map(([id, data]) => {
      const flatSteps = flattenSteps(data.steps);
      const endTime = data.endTime || new Date();
      const duration = endTime.getTime() - data.startTime.getTime();

      return {
        id,
        planId: (data as any).planId || 'unknown',
        planName: data.planName,
        environment: data.environment,
        status: getOverallStatus(flatSteps) as 'success' | 'failed' | 'error' | 'aborted' | 'running',
        startTime: data.startTime,
        endTime: data.endTime,
        duration,
        totalTests: flatSteps.length,
        passed: flatSteps.filter(s => s.status === 'passed').length,
        failed: flatSteps.filter(s => s.status === 'failed').length,
        skipped: flatSteps.filter(s => s.status === 'skipped').length,
      };
    });

    // Apply filters
    if (planId) {
      executions = executions.filter(e => e.planId === planId);
    }
    if (status && status !== 'all') {
      executions = executions.filter(e => e.status === status);
    }
    if (dateFrom) {
      const from = new Date(dateFrom);
      executions = executions.filter(e => new Date(e.startTime) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      executions = executions.filter(e => new Date(e.startTime) <= to);
    }
    if (search) {
      const query = search.toLowerCase();
      executions = executions.filter(e =>
        e.planName.toLowerCase().includes(query) ||
        e.id.toLowerCase().includes(query)
      );
    }

    // Sort by start time descending (newest first)
    executions.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

    // Get total before pagination
    const total = executions.length;

    // Apply pagination
    const start = (pageNum - 1) * pageSizeNum;
    const paginatedExecutions = executions.slice(start, start + pageSizeNum);

    return reply.send({
      executions: paginatedExecutions,
      total,
      page: pageNum,
      pageSize: pageSizeNum,
      totalPages: Math.ceil(total / pageSizeNum),
    });
  });

  /**
   * Generate a report for an execution
   */
  fastify.get('/executions/:executionId/report', async (
    request: FastifyRequest<{
      Params: { executionId: string };
      Querystring: {
        format?: ReportFormat;
        includeLogs?: boolean;
        includeMetrics?: boolean;
        maskSensitive?: boolean;
      };
    }>,
    reply: FastifyReply
  ) => {
    const { executionId } = request.params;
    const {
      format = 'json',
      includeLogs = true,
      includeMetrics = true,
      maskSensitive = true,
    } = request.query;

    const executionData = executionResults.get(executionId);
    if (!executionData) {
      return reply.status(404).send({
        error: 'Execution not found',
        executionId,
      });
    }

    // Get context for service metrics
    const context = getExecutionContext(executionId);
    const serviceMetrics = undefined;

    const report = buildExecutionReport(executionId, executionData.planName, executionData.steps, {
      environment: executionData.environment,
      startTime: executionData.startTime,
      endTime: executionData.endTime || new Date(),
      variables: executionData.variables,
      serviceMetrics,
      logs: context?.getLogs() || [],
    });

    const reportContent = reportGenerator.generate(report, format);

    // Set appropriate content type
    const contentTypes: Record<ReportFormat, string> = {
      junit: 'application/xml',
      html: 'text/html',
      json: 'application/json',
      markdown: 'text/markdown',
      csv: 'text/csv',
    };

    return reply
      .header('Content-Type', contentTypes[format])
      .header('Content-Disposition', `attachment; filename="report-${executionId}.${getExtension(format)}"`)
      .send(reportContent);
  });

  /**
   * Generate reports in multiple formats
   */
  fastify.post('/executions/:executionId/reports', async (
    request: FastifyRequest<{
      Params: { executionId: string };
      Body: { formats: ReportFormat[] };
    }>,
    reply: FastifyReply
  ) => {
    const { executionId } = request.params;
    const { formats } = request.body;

    const executionData = executionResults.get(executionId);
    if (!executionData) {
      return reply.status(404).send({
        error: 'Execution not found',
        executionId,
      });
    }

    const context = getExecutionContext(executionId);

    const report = buildExecutionReport(executionId, executionData.planName, executionData.steps, {
      environment: executionData.environment,
      startTime: executionData.startTime,
      endTime: executionData.endTime || new Date(),
      variables: executionData.variables,
      logs: context?.getLogs() || [],
    });

    const reports = reportGenerator.generateAll(report, formats);

    const result: Record<string, string> = {};
    for (const [format, content] of reports) {
      result[format] = content;
    }

    return reply.send({
      executionId,
      formats: formats,
      reports: result,
    });
  });

  /**
   * Get execution summary (quick overview without full report)
   */
  fastify.get('/executions/:executionId/summary', async (
    request: FastifyRequest<{ Params: { executionId: string } }>,
    reply: FastifyReply
  ) => {
    const { executionId } = request.params;

    const executionData = executionResults.get(executionId);
    if (!executionData) {
      return reply.status(404).send({
        error: 'Execution not found',
        executionId,
      });
    }

    const steps = executionData.steps;
    const flatSteps = flattenSteps(steps);

    const summary = {
      executionId,
      planName: executionData.planName,
      environment: executionData.environment,
      startTime: executionData.startTime,
      endTime: executionData.endTime,
      duration: executionData.endTime
        ? executionData.endTime.getTime() - executionData.startTime.getTime()
        : undefined,
      totalTests: flatSteps.length,
      passed: flatSteps.filter(s => s.status === 'passed').length,
      failed: flatSteps.filter(s => s.status === 'failed').length,
      skipped: flatSteps.filter(s => s.status === 'skipped').length,
      errors: flatSteps.filter(s => s.status === 'error').length,
      status: getOverallStatus(flatSteps),
    };

    return reply.send(summary);
  });

  /**
   * Record a step result (used during execution)
   */
  fastify.post('/executions/:executionId/steps', async (
    request: FastifyRequest<{
      Params: { executionId: string };
      Body: StepResult;
    }>,
    reply: FastifyReply
  ) => {
    const { executionId } = request.params;
    const stepResult = request.body;

    let executionData = executionResults.get(executionId);
    if (!executionData) {
      // Create new execution record
      executionData = {
        planName: 'Unknown',
        steps: [],
        startTime: new Date(),
        environment: 'default',
      };
      executionResults.set(executionId, executionData);
    }

    executionData.steps.push(stepResult);

    logger.info('Step recorded', {
      executionId,
      stepId: stepResult.id,
      stepName: stepResult.name,
      status: stepResult.status,
    });

    return reply.status(201).send({
      recorded: true,
      stepId: stepResult.id,
      totalSteps: executionData.steps.length,
    });
  });

  /**
   * Start an execution recording
   */
  fastify.post('/executions/:executionId/start', async (
    request: FastifyRequest<{
      Params: { executionId: string };
      Body: {
        planName: string;
        environment?: string;
        variables?: Record<string, any>;
        planId?: string;
        planVersion?: string;
        gitCommit?: string;
        gitBranch?: string;
        buildNumber?: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    const { executionId } = request.params;
    const { planName, environment = 'default', variables, planId, ...metadata } = request.body;

    if (executionResults.has(executionId)) {
      return reply.status(409).send({
        error: 'Execution already exists',
        executionId,
      });
    }

    executionResults.set(executionId, {
      planName,
      planId,
      steps: [],
      startTime: new Date(),
      environment,
      variables,
    });

    logger.info('Execution started', { executionId, planName, planId, environment });

    return reply.status(201).send({
      executionId,
      started: true,
      startTime: new Date().toISOString(),
    });
  });

  /**
   * Complete an execution recording
   */
  fastify.post('/executions/:executionId/complete', async (
    request: FastifyRequest<{ Params: { executionId: string } }>,
    reply: FastifyReply
  ) => {
    const { executionId } = request.params;

    const executionData = executionResults.get(executionId);
    if (!executionData) {
      return reply.status(404).send({
        error: 'Execution not found',
        executionId,
      });
    }

    executionData.endTime = new Date();

    const flatSteps = flattenSteps(executionData.steps);
    const summary = {
      totalTests: flatSteps.length,
      passed: flatSteps.filter(s => s.status === 'passed').length,
      failed: flatSteps.filter(s => s.status === 'failed').length,
      skipped: flatSteps.filter(s => s.status === 'skipped').length,
      status: getOverallStatus(flatSteps),
      duration: executionData.endTime.getTime() - executionData.startTime.getTime(),
    };

    logger.info('Execution completed', { executionId, ...summary });

    return reply.send({
      executionId,
      completed: true,
      endTime: executionData.endTime.toISOString(),
      summary,
    });
  });

  /**
   * Get all step results for an execution
   */
  fastify.get('/executions/:executionId/steps', async (
    request: FastifyRequest<{
      Params: { executionId: string };
      Querystring: { status?: string };
    }>,
    reply: FastifyReply
  ) => {
    const { executionId } = request.params;
    const { status } = request.query;

    const executionData = executionResults.get(executionId);
    if (!executionData) {
      return reply.status(404).send({
        error: 'Execution not found',
        executionId,
      });
    }

    let steps = executionData.steps;
    if (status) {
      const flatSteps = flattenSteps(steps);
      steps = flatSteps.filter(s => s.status === status);
    }

    return reply.send({
      executionId,
      count: steps.length,
      steps,
    });
  });

  /**
   * Delete execution data
   */
  fastify.delete('/executions/:executionId', async (
    request: FastifyRequest<{ Params: { executionId: string } }>,
    reply: FastifyReply
  ) => {
    const { executionId } = request.params;

    if (!executionResults.has(executionId)) {
      return reply.status(404).send({
        error: 'Execution not found',
        executionId,
      });
    }

    executionResults.delete(executionId);

    return reply.status(204).send();
  });
}

// Helper functions
function flattenSteps(steps: StepResult[]): StepResult[] {
  const result: StepResult[] = [];
  for (const step of steps) {
    if (step.children && step.children.length > 0) {
      result.push(...flattenSteps(step.children));
    } else {
      result.push(step);
    }
  }
  return result;
}

function getOverallStatus(steps: StepResult[]): string {
  const hasFailures = steps.some(s => s.status === 'failed');
  const hasErrors = steps.some(s => s.status === 'error');

  if (hasErrors) return 'error';
  if (hasFailures) return 'failed';
  if (steps.length === 0) return 'empty';
  return 'success';
}

function getExtension(format: ReportFormat): string {
  switch (format) {
    case 'junit': return 'xml';
    case 'html': return 'html';
    case 'json': return 'json';
    case 'markdown': return 'md';
    case 'csv': return 'csv';
    default: return 'txt';
  }
}

/**
 * Record a step result (for internal use by execution engine)
 */
export function recordStepResult(executionId: string, step: StepResult): void {
  let data = executionResults.get(executionId);
  if (!data) {
    data = {
      planName: 'Unknown',
      steps: [],
      startTime: new Date(),
      environment: 'default',
    };
    executionResults.set(executionId, data);
  }
  data.steps.push(step);
}

/**
 * Get execution data (for internal use)
 */
export function getExecutionData(executionId: string) {
  return executionResults.get(executionId);
}
