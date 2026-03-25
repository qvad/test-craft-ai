import { Component, Input } from '@angular/core';
import { DatePipe, NgClass } from '@angular/common';
import { Tabs, TabList, Tab, TabPanels, TabPanel } from 'primeng/tabs';
import { ReportStepResult } from '../../../core/services/state/reports.store';
import { AssertionResultsComponent } from './assertion-results';
import { ContextVariablesComponent } from './context-variables';

@Component({
  selector: 'app-step-details',
  standalone: true,
  imports: [
    DatePipe,
    NgClass,
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    AssertionResultsComponent,
    ContextVariablesComponent
  ],
  template: `
    @if (step) {
      <div class="step-details">
        <div class="step-header">
          <div class="step-header__info">
            <div class="step-header__status" [ngClass]="'status--' + step.status">
              <i [class]="getStatusIcon()"></i>
              <span>{{ getStatusLabel() }}</span>
            </div>
            <h2>{{ step.name }}</h2>
            <div class="step-header__meta">
              <span class="meta-item">
                <i class="pi pi-tag"></i>
                {{ step.type }}
              </span>
              @if (step.duration) {
                <span class="meta-item">
                  <i class="pi pi-clock"></i>
                  {{ formatDuration(step.duration) }}
                </span>
              }
              @if (step.startTime) {
                <span class="meta-item">
                  <i class="pi pi-calendar"></i>
                  {{ step.startTime | date:'HH:mm:ss.SSS' }}
                </span>
              }
            </div>
          </div>
        </div>

        @if (step.error) {
          <div class="step-error">
            <div class="error-header">
              <i class="pi pi-exclamation-triangle"></i>
              <span>Error: {{ step.error.type || 'ExecutionError' }}</span>
            </div>
            <div class="error-message">{{ step.error.message }}</div>
            @if (step.error.stack) {
              <pre class="error-stack">{{ step.error.stack }}</pre>
            }
          </div>
        }

        <p-tabs value="request" styleClass="step-tabs">
          <p-tablist>
            @if (step.request) {
              <p-tab value="request">Request</p-tab>
            }
            @if (step.response) {
              <p-tab value="response">Response</p-tab>
            }
            @if (step.assertions && step.assertions.length > 0) {
              <p-tab value="assertions">
                Assertions
                <span class="tab-badge" [ngClass]="hasFailedAssertions() ? 'badge--failed' : 'badge--passed'">
                  {{ step.assertions.length }}
                </span>
              </p-tab>
            }
            <p-tab value="logs">
              Logs
              @if (step.logs && step.logs.length > 0) {
                <span class="tab-badge">{{ step.logs.length }}</span>
              }
            </p-tab>
            <p-tab value="variables">Variables</p-tab>
            @if (step.output) {
              <p-tab value="output">Output</p-tab>
            }
          </p-tablist>

          <p-tabpanels>
            @if (step.request) {
              <p-tabpanel value="request">
                <div class="request-panel">
                  <div class="request-line">
                    <span class="request-method">{{ step.request.method || 'GET' }}</span>
                    <span class="request-url">{{ step.request.url }}</span>
                  </div>
                  @if (step.request.headers && hasKeys(step.request.headers)) {
                    <div class="section">
                      <h4>Headers</h4>
                      <div class="key-value-list">
                        @for (header of getEntries(step.request.headers); track header[0]) {
                          <div class="key-value-item">
                            <span class="key">{{ header[0] }}:</span>
                            <span class="value">{{ header[1] }}</span>
                          </div>
                        }
                      </div>
                    </div>
                  }
                  @if (step.request.body) {
                    <div class="section">
                      <h4>Body</h4>
                      <pre class="code-block">{{ formatJson(step.request.body) }}</pre>
                    </div>
                  }
                </div>
              </p-tabpanel>
            }

            @if (step.response) {
              <p-tabpanel value="response">
                <div class="response-panel">
                  <div class="response-line">
                    <span
                      class="response-status"
                      [ngClass]="getResponseStatusClass(step.response.status)"
                    >
                      {{ step.response.status }} {{ step.response.statusText }}
                    </span>
                  </div>
                  @if (step.response.headers && hasKeys(step.response.headers)) {
                    <div class="section">
                      <h4>Headers</h4>
                      <div class="key-value-list">
                        @for (header of getEntries(step.response.headers); track header[0]) {
                          <div class="key-value-item">
                            <span class="key">{{ header[0] }}:</span>
                            <span class="value">{{ header[1] }}</span>
                          </div>
                        }
                      </div>
                    </div>
                  }
                  @if (step.response.body) {
                    <div class="section">
                      <h4>Body</h4>
                      <pre class="code-block">{{ formatJson(step.response.body) }}</pre>
                    </div>
                  }
                </div>
              </p-tabpanel>
            }

            @if (step.assertions && step.assertions.length > 0) {
              <p-tabpanel value="assertions">
                <app-assertion-results [assertions]="step.assertions" />
              </p-tabpanel>
            }

            <p-tabpanel value="logs">
              <div class="logs-panel">
                @for (log of step.logs; track $index) {
                  <div class="log-entry" [ngClass]="'log-entry--' + log.level">
                    <span class="log-time">{{ log.timestamp | date:'HH:mm:ss.SSS' }}</span>
                    <span class="log-level">{{ log.level.toUpperCase() }}</span>
                    <span class="log-message">{{ log.message }}</span>
                  </div>
                }
                @if (!step.logs || step.logs.length === 0) {
                  <div class="empty-state">
                    <i class="pi pi-file"></i>
                    <span>No logs recorded for this step</span>
                  </div>
                }
              </div>
            </p-tabpanel>

            <p-tabpanel value="variables">
              <app-context-variables
                [extractedVariables]="step.extractedVariables"
              />
            </p-tabpanel>

            @if (step.output) {
              <p-tabpanel value="output">
                <div class="output-panel">
                  <pre class="code-block">{{ formatJson(step.output) }}</pre>
                </div>
              </p-tabpanel>
            }
          </p-tabpanels>
        </p-tabs>
      </div>
    } @else {
      <div class="no-step-selected">
        <i class="pi pi-arrow-left"></i>
        <h3>Select a Step</h3>
        <p>Click on a step in the tree to view its details</p>
      </div>
    }
  `,
  styles: [`
    .step-details {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }

    .step-header {
      padding: var(--tc-spacing-md);
      background: var(--tc-bg-secondary);
      border-bottom: 1px solid var(--tc-border);
    }

    .step-header__status {
      display: flex;
      align-items: center;
      gap: var(--tc-spacing-xs);
      font-size: 12px;
      font-weight: 600;
      margin-bottom: var(--tc-spacing-xs);
    }

    .status--passed {
      color: var(--tc-success);
    }

    .status--failed {
      color: var(--tc-danger);
    }

    .status--error {
      color: var(--tc-warning);
    }

    .status--skipped {
      color: var(--tc-text-muted);
    }

    .status--running {
      color: var(--tc-primary);
    }

    .step-header h2 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: var(--tc-text-primary);
    }

    .step-header__meta {
      display: flex;
      gap: var(--tc-spacing-md);
      margin-top: var(--tc-spacing-sm);
    }

    .meta-item {
      display: flex;
      align-items: center;
      gap: var(--tc-spacing-xs);
      font-size: 12px;
      color: var(--tc-text-secondary);
    }

    .meta-item i {
      font-size: 12px;
      color: var(--tc-text-muted);
    }

    .step-error {
      margin: var(--tc-spacing-md);
      padding: var(--tc-spacing-md);
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid var(--tc-danger);
      border-radius: var(--tc-radius-md);
    }

    .error-header {
      display: flex;
      align-items: center;
      gap: var(--tc-spacing-sm);
      color: var(--tc-danger);
      font-weight: 600;
      margin-bottom: var(--tc-spacing-sm);
    }

    .error-message {
      color: var(--tc-text-primary);
      font-size: 13px;
    }

    .error-stack {
      margin-top: var(--tc-spacing-sm);
      padding: var(--tc-spacing-sm);
      background: var(--tc-bg-primary);
      border-radius: var(--tc-radius-sm);
      font-family: var(--tc-font-mono);
      font-size: 11px;
      color: var(--tc-text-secondary);
      overflow-x: auto;
      white-space: pre-wrap;
    }

    :host ::ng-deep .step-tabs {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    :host ::ng-deep .step-tabs .p-tabpanels {
      flex: 1;
      overflow: hidden;
    }

    :host ::ng-deep .step-tabs .p-tabpanel {
      height: 100%;
      overflow: auto;
      padding: var(--tc-spacing-md);
    }

    .tab-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 18px;
      height: 18px;
      padding: 0 6px;
      margin-left: 6px;
      font-size: 10px;
      font-weight: 600;
      border-radius: 9px;
      background: var(--tc-bg-tertiary);
      color: var(--tc-text-secondary);
    }

    .badge--passed {
      background: rgba(34, 197, 94, 0.2);
      color: var(--tc-success);
    }

    .badge--failed {
      background: rgba(239, 68, 68, 0.2);
      color: var(--tc-danger);
    }

    .request-panel,
    .response-panel,
    .output-panel {
      font-family: var(--tc-font-mono);
      font-size: 12px;
    }

    .request-line,
    .response-line {
      display: flex;
      align-items: center;
      gap: var(--tc-spacing-sm);
      padding: var(--tc-spacing-sm) var(--tc-spacing-md);
      background: var(--tc-bg-tertiary);
      border-radius: var(--tc-radius-md);
      margin-bottom: var(--tc-spacing-md);
    }

    .request-method {
      padding: 2px 8px;
      background: var(--tc-primary);
      color: white;
      border-radius: var(--tc-radius-sm);
      font-weight: 600;
      font-size: 11px;
    }

    .request-url {
      color: var(--tc-text-primary);
      word-break: break-all;
    }

    .response-status {
      padding: 2px 8px;
      border-radius: var(--tc-radius-sm);
      font-weight: 600;
      font-size: 11px;
    }

    .response-status--success {
      background: rgba(34, 197, 94, 0.2);
      color: var(--tc-success);
    }

    .response-status--error {
      background: rgba(239, 68, 68, 0.2);
      color: var(--tc-danger);
    }

    .response-status--warning {
      background: rgba(251, 146, 60, 0.2);
      color: var(--tc-warning);
    }

    .section {
      margin-bottom: var(--tc-spacing-md);
    }

    .section h4 {
      margin: 0 0 var(--tc-spacing-sm);
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--tc-text-secondary);
    }

    .key-value-list {
      background: var(--tc-bg-secondary);
      border-radius: var(--tc-radius-md);
      border: 1px solid var(--tc-border);
      overflow: hidden;
    }

    .key-value-item {
      display: flex;
      gap: var(--tc-spacing-sm);
      padding: var(--tc-spacing-xs) var(--tc-spacing-sm);
      border-bottom: 1px solid var(--tc-border);
    }

    .key-value-item:last-child {
      border-bottom: none;
    }

    .key {
      color: var(--tc-primary);
      font-weight: 500;
      flex-shrink: 0;
    }

    .value {
      color: var(--tc-text-primary);
      word-break: break-all;
    }

    .code-block {
      margin: 0;
      padding: var(--tc-spacing-md);
      background: var(--tc-bg-secondary);
      border: 1px solid var(--tc-border);
      border-radius: var(--tc-radius-md);
      overflow-x: auto;
      white-space: pre-wrap;
      color: var(--tc-text-primary);
    }

    .logs-panel {
      font-family: var(--tc-font-mono);
      font-size: 12px;
    }

    .log-entry {
      display: flex;
      gap: var(--tc-spacing-sm);
      padding: var(--tc-spacing-xs) 0;
      border-bottom: 1px solid var(--tc-border);
    }

    .log-entry:last-child {
      border-bottom: none;
    }

    .log-time {
      color: var(--tc-text-muted);
      flex-shrink: 0;
    }

    .log-level {
      width: 50px;
      flex-shrink: 0;
      font-weight: 600;
    }

    .log-entry--info .log-level {
      color: var(--tc-info);
    }

    .log-entry--warn .log-level {
      color: var(--tc-warning);
    }

    .log-entry--error .log-level {
      color: var(--tc-danger);
    }

    .log-entry--debug .log-level {
      color: var(--tc-text-muted);
    }

    .log-message {
      color: var(--tc-text-primary);
      word-break: break-word;
    }

    .empty-state,
    .no-step-selected {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--tc-text-muted);
      gap: var(--tc-spacing-sm);
    }

    .empty-state i,
    .no-step-selected i {
      font-size: 32px;
      opacity: 0.5;
    }

    .no-step-selected h3 {
      margin: 0;
      font-size: 16px;
      color: var(--tc-text-secondary);
    }

    .no-step-selected p {
      margin: 0;
      font-size: 13px;
    }
  `]
})
export class StepDetailsComponent {
  @Input() step: ReportStepResult | null = null;

  getStatusIcon(): string {
    if (!this.step) return '';
    switch (this.step.status) {
      case 'passed': return 'pi pi-check-circle';
      case 'failed': return 'pi pi-times-circle';
      case 'error': return 'pi pi-exclamation-triangle';
      case 'skipped': return 'pi pi-minus-circle';
      case 'running': return 'pi pi-spinner pi-spin';
      default: return 'pi pi-circle';
    }
  }

  getStatusLabel(): string {
    if (!this.step) return '';
    switch (this.step.status) {
      case 'passed': return 'Passed';
      case 'failed': return 'Failed';
      case 'error': return 'Error';
      case 'skipped': return 'Skipped';
      case 'running': return 'Running';
      case 'pending': return 'Pending';
      default: return this.step.status;
    }
  }

  formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }

  hasFailedAssertions(): boolean {
    return this.step?.assertions?.some(a => !a.passed) ?? false;
  }

  hasKeys(obj: Record<string, string> | undefined): boolean {
    return obj !== undefined && Object.keys(obj).length > 0;
  }

  getEntries(obj: Record<string, string>): [string, string][] {
    return Object.entries(obj);
  }

  formatJson(value: unknown): string {
    if (typeof value === 'string') {
      try {
        return JSON.stringify(JSON.parse(value), null, 2);
      } catch {
        return value;
      }
    }
    return JSON.stringify(value, null, 2);
  }

  getResponseStatusClass(status: number | undefined): string {
    if (!status) return '';
    if (status >= 200 && status < 300) return 'response-status--success';
    if (status >= 400 && status < 500) return 'response-status--warning';
    if (status >= 500) return 'response-status--error';
    return '';
  }
}
