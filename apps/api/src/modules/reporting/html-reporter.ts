/**
 * HTML Report Generator
 *
 * Generates interactive HTML reports with:
 * - Test results summary
 * - Step-by-step details with logs
 * - Performance metrics and charts
 * - Service metrics visualization
 */

import { ExecutionReport, StepResult, TestMetrics, LogEntry, AssertionResult } from './types';

export interface HtmlReportOptions {
  title?: string;
  theme?: 'light' | 'dark';
  includeCharts?: boolean;
  includeLogs?: boolean;
  includeMetrics?: boolean;
  includeTimeline?: boolean;
  collapsePassedSteps?: boolean;
  embedAssets?: boolean;  // Embed CSS/JS inline
}

export class HtmlReporter {
  private options: HtmlReportOptions;

  constructor(options: HtmlReportOptions = {}) {
    this.options = {
      theme: 'light',
      includeCharts: true,
      includeLogs: true,
      includeMetrics: true,
      includeTimeline: true,
      collapsePassedSteps: true,
      embedAssets: true,
      ...options,
    };
  }

  /**
   * Generate HTML report
   */
  generate(report: ExecutionReport): string {
    return `<!DOCTYPE html>
<html lang="en" data-theme="${this.options.theme}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.options.title || report.planName} - Test Report</title>
  ${this.generateStyles()}
</head>
<body>
  <div class="container">
    ${this.generateHeader(report)}
    ${this.generateSummary(report)}
    ${this.options.includeTimeline ? this.generateTimeline(report) : ''}
    ${this.options.includeMetrics ? this.generateMetricsSection(report) : ''}
    ${this.generateStepsSection(report)}
    ${this.options.includeLogs ? this.generateLogsSection(report) : ''}
    ${report.serviceMetrics ? this.generateServiceMetrics(report) : ''}
    ${this.generateFooter(report)}
  </div>
  ${this.generateScripts(report)}
</body>
</html>`;
  }

  private generateStyles(): string {
    return `<style>
:root {
  --bg-primary: #ffffff;
  --bg-secondary: #f8f9fa;
  --bg-tertiary: #e9ecef;
  --text-primary: #212529;
  --text-secondary: #6c757d;
  --border-color: #dee2e6;
  --success-color: #28a745;
  --failure-color: #dc3545;
  --warning-color: #ffc107;
  --info-color: #17a2b8;
  --error-color: #dc3545;
  --skipped-color: #6c757d;
}

[data-theme="dark"] {
  --bg-primary: #1a1a2e;
  --bg-secondary: #16213e;
  --bg-tertiary: #0f3460;
  --text-primary: #e9ecef;
  --text-secondary: #adb5bd;
  --border-color: #495057;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background-color: var(--bg-primary);
  color: var(--text-primary);
  line-height: 1.6;
}

.container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px;
}

/* Header */
.header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 30px;
  border-radius: 12px;
  margin-bottom: 20px;
}

.header h1 {
  font-size: 2rem;
  margin-bottom: 10px;
}

.header-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  font-size: 0.9rem;
  opacity: 0.9;
}

.header-meta span {
  display: flex;
  align-items: center;
  gap: 5px;
}

/* Status Badge */
.status-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 20px;
  font-weight: 600;
  font-size: 0.85rem;
  text-transform: uppercase;
}

.status-success { background-color: var(--success-color); color: white; }
.status-failed { background-color: var(--failure-color); color: white; }
.status-error { background-color: var(--error-color); color: white; }
.status-skipped { background-color: var(--skipped-color); color: white; }
.status-passed { background-color: var(--success-color); color: white; }

/* Summary Cards */
.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.summary-card {
  background-color: var(--bg-secondary);
  border-radius: 12px;
  padding: 20px;
  text-align: center;
  border: 1px solid var(--border-color);
}

.summary-card .value {
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 5px;
}

.summary-card .label {
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.summary-card.passed .value { color: var(--success-color); }
.summary-card.failed .value { color: var(--failure-color); }
.summary-card.skipped .value { color: var(--skipped-color); }

/* Progress Bar */
.progress-bar {
  height: 12px;
  background-color: var(--bg-tertiary);
  border-radius: 6px;
  overflow: hidden;
  margin: 20px 0;
}

.progress-bar .segment {
  height: 100%;
  float: left;
  transition: width 0.3s ease;
}

.progress-bar .passed { background-color: var(--success-color); }
.progress-bar .failed { background-color: var(--failure-color); }
.progress-bar .skipped { background-color: var(--skipped-color); }

/* Section */
.section {
  background-color: var(--bg-secondary);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  border: 1px solid var(--border-color);
}

.section-title {
  font-size: 1.25rem;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 2px solid var(--border-color);
}

/* Timeline */
.timeline {
  position: relative;
  padding-left: 30px;
}

.timeline::before {
  content: '';
  position: absolute;
  left: 10px;
  top: 0;
  bottom: 0;
  width: 2px;
  background-color: var(--border-color);
}

.timeline-item {
  position: relative;
  margin-bottom: 15px;
  padding: 10px 15px;
  background-color: var(--bg-primary);
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.timeline-item::before {
  content: '';
  position: absolute;
  left: -24px;
  top: 50%;
  transform: translateY(-50%);
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background-color: var(--info-color);
  border: 2px solid var(--bg-secondary);
}

.timeline-item.passed::before { background-color: var(--success-color); }
.timeline-item.failed::before { background-color: var(--failure-color); }
.timeline-item.skipped::before { background-color: var(--skipped-color); }

/* Steps */
.step {
  background-color: var(--bg-primary);
  border-radius: 8px;
  border: 1px solid var(--border-color);
  margin-bottom: 10px;
  overflow: hidden;
}

.step-header {
  display: flex;
  align-items: center;
  padding: 15px;
  cursor: pointer;
  user-select: none;
}

.step-header:hover {
  background-color: var(--bg-tertiary);
}

.step-icon {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 15px;
  font-size: 14px;
  color: white;
}

.step-icon.passed { background-color: var(--success-color); }
.step-icon.failed { background-color: var(--failure-color); }
.step-icon.skipped { background-color: var(--skipped-color); }
.step-icon.error { background-color: var(--error-color); }

.step-info {
  flex: 1;
}

.step-name {
  font-weight: 600;
  margin-bottom: 3px;
}

.step-meta {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.step-duration {
  font-family: monospace;
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.step-expand {
  margin-left: 15px;
  transition: transform 0.2s;
}

.step.expanded .step-expand {
  transform: rotate(180deg);
}

.step-details {
  display: none;
  padding: 0 15px 15px;
  border-top: 1px solid var(--border-color);
}

.step.expanded .step-details {
  display: block;
}

/* Assertions */
.assertions {
  margin-top: 15px;
}

.assertion {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background-color: var(--bg-secondary);
  border-radius: 6px;
  margin-bottom: 5px;
  font-size: 0.9rem;
}

.assertion-icon {
  margin-right: 10px;
}

.assertion.passed .assertion-icon { color: var(--success-color); }
.assertion.failed .assertion-icon { color: var(--failure-color); }

/* Logs */
.logs {
  background-color: #1e1e1e;
  color: #d4d4d4;
  border-radius: 8px;
  padding: 15px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 0.85rem;
  max-height: 400px;
  overflow-y: auto;
}

.log-entry {
  margin-bottom: 3px;
  white-space: pre-wrap;
  word-break: break-all;
}

.log-entry .timestamp {
  color: #6a9955;
}

.log-entry .level {
  font-weight: bold;
  padding: 0 5px;
}

.log-entry .level.debug { color: #569cd6; }
.log-entry .level.info { color: #4ec9b0; }
.log-entry .level.warn { color: #ce9178; }
.log-entry .level.error { color: #f44747; }

/* Metrics */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 15px;
}

.metric-item {
  text-align: center;
  padding: 15px;
  background-color: var(--bg-primary);
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.metric-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--info-color);
}

.metric-label {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-top: 5px;
}

/* Charts */
.chart-container {
  position: relative;
  height: 300px;
  margin: 20px 0;
}

/* Table */
.table {
  width: 100%;
  border-collapse: collapse;
}

.table th,
.table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid var(--border-color);
}

.table th {
  background-color: var(--bg-tertiary);
  font-weight: 600;
}

.table tr:hover {
  background-color: var(--bg-tertiary);
}

/* Footer */
.footer {
  text-align: center;
  padding: 20px;
  color: var(--text-secondary);
  font-size: 0.85rem;
}

/* Responsive */
@media (max-width: 768px) {
  .header h1 {
    font-size: 1.5rem;
  }

  .summary-card .value {
    font-size: 2rem;
  }
}

/* Print */
@media print {
  .step-details {
    display: block !important;
  }

  .logs {
    max-height: none;
  }
}
</style>`;
  }

  private generateHeader(report: ExecutionReport): string {
    const statusClass = report.status === 'success' ? 'success' : 'failed';

    return `
<div class="header">
  <div style="display: flex; justify-content: space-between; align-items: center;">
    <h1>${this.escapeHtml(report.planName)}</h1>
    <span class="status-badge status-${statusClass}">${report.status.toUpperCase()}</span>
  </div>
  <div class="header-meta">
    <span>📋 Version ${report.planVersion || '1.0'}</span>
    <span>🌍 ${this.escapeHtml(report.environment)}</span>
    <span>🕐 ${this.formatDate(report.startTime)}</span>
    <span>⏱️ ${this.formatDuration(report.duration)}</span>
    ${report.gitBranch ? `<span>🌿 ${this.escapeHtml(report.gitBranch)}</span>` : ''}
    ${report.gitCommit ? `<span>📝 ${this.escapeHtml(report.gitCommit.slice(0, 7))}</span>` : ''}
  </div>
</div>`;
  }

  private generateSummary(report: ExecutionReport): string {
    const { summary } = report;
    const total = summary.totalTests;
    const passedPercent = total > 0 ? (summary.passed / total * 100).toFixed(1) : 0;
    const failedPercent = total > 0 ? (summary.failed / total * 100).toFixed(1) : 0;
    const skippedPercent = total > 0 ? (summary.skipped / total * 100).toFixed(1) : 0;

    return `
<div class="summary-grid">
  <div class="summary-card">
    <div class="value">${summary.totalTests}</div>
    <div class="label">Total Tests</div>
  </div>
  <div class="summary-card passed">
    <div class="value">${summary.passed}</div>
    <div class="label">Passed</div>
  </div>
  <div class="summary-card failed">
    <div class="value">${summary.failed}</div>
    <div class="label">Failed</div>
  </div>
  <div class="summary-card skipped">
    <div class="value">${summary.skipped}</div>
    <div class="label">Skipped</div>
  </div>
  <div class="summary-card">
    <div class="value">${this.formatDuration(summary.duration)}</div>
    <div class="label">Duration</div>
  </div>
  <div class="summary-card">
    <div class="value">${summary.passedAssertions}/${summary.totalAssertions}</div>
    <div class="label">Assertions</div>
  </div>
</div>

<div class="progress-bar">
  <div class="segment passed" style="width: ${passedPercent}%"></div>
  <div class="segment failed" style="width: ${failedPercent}%"></div>
  <div class="segment skipped" style="width: ${skippedPercent}%"></div>
</div>`;
  }

  private generateTimeline(report: ExecutionReport): string {
    const items = report.steps.map(step => `
      <div class="timeline-item ${step.status}">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <strong>${this.escapeHtml(step.name)}</strong>
          <span class="step-duration">${this.formatDuration(step.duration || 0)}</span>
        </div>
        <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 5px;">
          ${step.type} • ${this.formatTime(step.startTime)}
          ${step.assertions.length > 0 ? ` • ${step.assertions.filter(a => a.passed).length}/${step.assertions.length} assertions` : ''}
        </div>
      </div>
    `).join('');

    return `
<div class="section">
  <h2 class="section-title">📊 Execution Timeline</h2>
  <div class="timeline">
    ${items}
  </div>
</div>`;
  }

  private generateMetricsSection(report: ExecutionReport): string {
    const { summary } = report;

    let metricsHtml = `
<div class="metrics-grid">
  ${summary.avgResponseTime !== undefined ? `
  <div class="metric-item">
    <div class="metric-value">${summary.avgResponseTime.toFixed(0)}ms</div>
    <div class="metric-label">Avg Response Time</div>
  </div>` : ''}
  ${summary.p50ResponseTime !== undefined ? `
  <div class="metric-item">
    <div class="metric-value">${summary.p50ResponseTime.toFixed(0)}ms</div>
    <div class="metric-label">P50 Response Time</div>
  </div>` : ''}
  ${summary.p95ResponseTime !== undefined ? `
  <div class="metric-item">
    <div class="metric-value">${summary.p95ResponseTime.toFixed(0)}ms</div>
    <div class="metric-label">P95 Response Time</div>
  </div>` : ''}
  ${summary.p99ResponseTime !== undefined ? `
  <div class="metric-item">
    <div class="metric-value">${summary.p99ResponseTime.toFixed(0)}ms</div>
    <div class="metric-label">P99 Response Time</div>
  </div>` : ''}
  ${summary.throughput !== undefined ? `
  <div class="metric-item">
    <div class="metric-value">${summary.throughput.toFixed(2)}</div>
    <div class="metric-label">Throughput (req/s)</div>
  </div>` : ''}
  ${summary.errorRate !== undefined ? `
  <div class="metric-item">
    <div class="metric-value">${(summary.errorRate * 100).toFixed(2)}%</div>
    <div class="metric-label">Error Rate</div>
  </div>` : ''}
</div>`;

    if (this.options.includeCharts) {
      metricsHtml += `
<div class="chart-container">
  <canvas id="metricsChart"></canvas>
</div>`;
    }

    return `
<div class="section">
  <h2 class="section-title">📈 Performance Metrics</h2>
  ${metricsHtml}
</div>`;
  }

  private generateStepsSection(report: ExecutionReport): string {
    const stepsHtml = report.steps.map((step, index) => this.generateStep(step, index)).join('');

    return `
<div class="section">
  <h2 class="section-title">🧪 Test Steps (${report.steps.length})</h2>
  <div class="steps-container">
    ${stepsHtml}
  </div>
</div>`;
  }

  private generateStep(step: StepResult, index: number): string {
    const statusIcon = {
      passed: '✓',
      failed: '✗',
      skipped: '○',
      error: '!',
      pending: '?',
      running: '⟳',
    }[step.status] || '?';

    const collapsed = this.options.collapsePassedSteps && step.status === 'passed' ? '' : ' expanded';

    const assertionsHtml = step.assertions.length > 0 ? `
      <div class="assertions">
        <strong>Assertions (${step.assertions.filter(a => a.passed).length}/${step.assertions.length})</strong>
        ${step.assertions.map(a => `
          <div class="assertion ${a.passed ? 'passed' : 'failed'}">
            <span class="assertion-icon">${a.passed ? '✓' : '✗'}</span>
            <span>${this.escapeHtml(a.name)}</span>
            ${a.message ? `<span style="margin-left: auto; color: var(--text-secondary);">${this.escapeHtml(a.message)}</span>` : ''}
          </div>
        `).join('')}
      </div>
    ` : '';

    const logsHtml = step.logs && step.logs.length > 0 ? `
      <div style="margin-top: 15px;">
        <strong>Logs</strong>
        <div class="logs">
          ${step.logs.map(log => `
            <div class="log-entry">
              <span class="timestamp">[${this.formatTime(log.timestamp)}]</span>
              <span class="level ${log.level}">[${log.level.toUpperCase()}]</span>
              <span>${this.escapeHtml(log.message)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    ` : '';

    const errorHtml = step.error ? `
      <div style="margin-top: 15px; padding: 15px; background: rgba(220, 53, 69, 0.1); border-radius: 8px; border-left: 4px solid var(--error-color);">
        <strong style="color: var(--error-color);">Error: ${this.escapeHtml(step.error.message)}</strong>
        ${step.error.stack ? `<pre style="margin-top: 10px; font-size: 0.85rem; overflow-x: auto;">${this.escapeHtml(step.error.stack)}</pre>` : ''}
      </div>
    ` : '';

    const metricsHtml = step.metrics ? `
      <div style="margin-top: 15px;">
        <strong>Metrics</strong>
        <div class="metrics-grid" style="margin-top: 10px;">
          ${step.metrics.responseTime !== undefined ? `
          <div class="metric-item">
            <div class="metric-value">${step.metrics.responseTime}ms</div>
            <div class="metric-label">Response Time</div>
          </div>` : ''}
          ${step.metrics.bytesReceived !== undefined ? `
          <div class="metric-item">
            <div class="metric-value">${this.formatBytes(step.metrics.bytesReceived)}</div>
            <div class="metric-label">Data Received</div>
          </div>` : ''}
          ${step.metrics.custom ? Object.entries(step.metrics.custom).map(([key, value]) => `
          <div class="metric-item">
            <div class="metric-value">${value}</div>
            <div class="metric-label">${this.escapeHtml(key)}</div>
          </div>`).join('') : ''}
        </div>
      </div>
    ` : '';

    return `
<div class="step${collapsed}" data-status="${step.status}">
  <div class="step-header" onclick="toggleStep(this)">
    <div class="step-icon ${step.status}">${statusIcon}</div>
    <div class="step-info">
      <div class="step-name">${this.escapeHtml(step.name)}</div>
      <div class="step-meta">${step.type} • ${step.assertions.length} assertions</div>
    </div>
    <div class="step-duration">${this.formatDuration(step.duration || 0)}</div>
    <div class="step-expand">▼</div>
  </div>
  <div class="step-details">
    ${errorHtml}
    ${assertionsHtml}
    ${metricsHtml}
    ${logsHtml}
    ${step.output ? `
    <div style="margin-top: 15px;">
      <strong>Output</strong>
      <pre style="background: var(--bg-tertiary); padding: 15px; border-radius: 8px; overflow-x: auto; margin-top: 10px;">${this.escapeHtml(step.output.slice(0, 5000))}</pre>
    </div>
    ` : ''}
    ${step.children && step.children.length > 0 ? `
    <div style="margin-top: 15px;">
      <strong>Nested Steps</strong>
      ${step.children.map((child, i) => this.generateStep(child, i)).join('')}
    </div>
    ` : ''}
  </div>
</div>`;
  }

  private generateLogsSection(report: ExecutionReport): string {
    if (!report.logs || report.logs.length === 0) return '';

    return `
<div class="section">
  <h2 class="section-title">📝 Execution Logs</h2>
  <div class="logs">
    ${report.logs.map(log => `
      <div class="log-entry">
        <span class="timestamp">[${this.formatTime(log.timestamp)}]</span>
        <span class="level ${log.level}">[${log.level.toUpperCase()}]</span>
        <span>${this.escapeHtml(log.message)}</span>
      </div>
    `).join('')}
  </div>
</div>`;
  }

  private generateServiceMetrics(report: ExecutionReport): string {
    if (!report.serviceMetrics) return '';

    const servicesHtml = Object.entries(report.serviceMetrics).map(([name, snapshot]) => {
      const metricsHtml = Object.entries(snapshot.metrics).map(([metricName, metric]) => `
        <tr>
          <td>${this.escapeHtml(metricName)}</td>
          <td>${metric.value}${metric.unit ? ' ' + metric.unit : ''}</td>
          <td>${metric.type}</td>
          <td>${metric.labels ? JSON.stringify(metric.labels) : '-'}</td>
        </tr>
      `).join('');

      return `
        <div style="margin-bottom: 20px;">
          <h3 style="margin-bottom: 10px;">${this.escapeHtml(snapshot.serviceName)}</h3>
          <table class="table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>Value</th>
                <th>Type</th>
                <th>Labels</th>
              </tr>
            </thead>
            <tbody>
              ${metricsHtml}
            </tbody>
          </table>
        </div>
      `;
    }).join('');

    return `
<div class="section">
  <h2 class="section-title">🔧 Service Metrics</h2>
  ${servicesHtml}
</div>`;
  }

  private generateFooter(report: ExecutionReport): string {
    return `
<div class="footer">
  <p>Generated by <strong>TestCraft</strong> at ${new Date().toISOString()}</p>
  <p>Execution ID: ${report.executionId}</p>
</div>`;
  }

  private generateScripts(report: ExecutionReport): string {
    const chartData = this.prepareChartData(report);

    return `
<script>
function toggleStep(header) {
  const step = header.parentElement;
  step.classList.toggle('expanded');
}

// Expand failed steps by default
document.querySelectorAll('.step[data-status="failed"], .step[data-status="error"]').forEach(step => {
  step.classList.add('expanded');
});

${this.options.includeCharts ? `
// Chart.js initialization
if (typeof Chart !== 'undefined') {
  const ctx = document.getElementById('metricsChart');
  if (ctx) {
    new Chart(ctx, {
      type: 'bar',
      data: ${JSON.stringify(chartData)},
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top'
          },
          title: {
            display: true,
            text: 'Step Duration (ms)'
          }
        },
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
  }
}
` : ''}
</script>
${this.options.includeCharts ? '<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>' : ''}`;
  }

  private prepareChartData(report: ExecutionReport): any {
    const labels = report.steps.map(s => s.name.slice(0, 20));
    const durations = report.steps.map(s => s.duration || 0);
    const colors = report.steps.map(s => {
      switch (s.status) {
        case 'passed': return 'rgba(40, 167, 69, 0.8)';
        case 'failed': return 'rgba(220, 53, 69, 0.8)';
        case 'skipped': return 'rgba(108, 117, 125, 0.8)';
        default: return 'rgba(23, 162, 184, 0.8)';
      }
    });

    return {
      labels,
      datasets: [{
        label: 'Duration (ms)',
        data: durations,
        backgroundColor: colors,
        borderColor: colors.map(c => c.replace('0.8', '1')),
        borderWidth: 1,
      }],
    };
  }

  // Utility methods
  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  }

  private formatDate(date: Date): string {
    return new Date(date).toLocaleString();
  }

  private formatTime(date: Date): string {
    return new Date(date).toISOString().split('T')[1].slice(0, 12);
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
}
