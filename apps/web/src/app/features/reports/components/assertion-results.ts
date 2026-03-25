import { Component, Input } from '@angular/core';
import { NgClass } from '@angular/common';
import { AssertionResult } from '../../../core/services/state/reports.store';

@Component({
  selector: 'app-assertion-results',
  standalone: true,
  imports: [NgClass],
  template: `
    <div class="assertion-results">
      <div class="assertions-header">
        <h4>
          <i class="pi pi-verified"></i>
          Assertions
        </h4>
        <div class="assertions-summary">
          <span class="passed">{{ passedCount }} passed</span>
          <span class="failed">{{ failedCount }} failed</span>
        </div>
      </div>

      <div class="assertions-content">
        @for (assertion of assertions; track $index) {
          <div
            class="assertion-item"
            [ngClass]="assertion.passed ? 'assertion-item--passed' : 'assertion-item--failed'"
          >
            <div class="assertion-status">
              <i [class]="assertion.passed ? 'pi pi-check-circle' : 'pi pi-times-circle'"></i>
            </div>
            <div class="assertion-details">
              <div class="assertion-name">{{ assertion.name }}</div>
              <div class="assertion-type">{{ assertion.type }}</div>
              @if (assertion.message) {
                <div class="assertion-message">{{ assertion.message }}</div>
              }
              @if (!assertion.passed && assertion.expected !== undefined) {
                <div class="assertion-comparison">
                  <div class="comparison-row">
                    <span class="comparison-label">Expected:</span>
                    <code class="comparison-value">{{ formatValue(assertion.expected) }}</code>
                  </div>
                  <div class="comparison-row">
                    <span class="comparison-label">Actual:</span>
                    <code class="comparison-value comparison-value--actual">{{ formatValue(assertion.actual) }}</code>
                  </div>
                </div>
              }
            </div>
            @if (assertion.duration) {
              <div class="assertion-duration">{{ assertion.duration }}ms</div>
            }
          </div>
        }

        @if (assertions.length === 0) {
          <div class="assertions-empty">
            <i class="pi pi-verified"></i>
            <span>No assertions in this step</span>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .assertion-results {
      background: var(--tc-bg-secondary);
      border-radius: var(--tc-radius-md);
      border: 1px solid var(--tc-border);
      overflow: hidden;
    }

    .assertions-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--tc-spacing-sm) var(--tc-spacing-md);
      background: var(--tc-bg-tertiary);
      border-bottom: 1px solid var(--tc-border);
    }

    .assertions-header h4 {
      margin: 0;
      font-size: 12px;
      font-weight: 600;
      color: var(--tc-text-primary);
      display: flex;
      align-items: center;
      gap: var(--tc-spacing-xs);
    }

    .assertions-summary {
      display: flex;
      gap: var(--tc-spacing-md);
      font-size: 11px;
    }

    .assertions-summary .passed {
      color: var(--tc-success);
    }

    .assertions-summary .failed {
      color: var(--tc-danger);
    }

    .assertions-content {
      max-height: 400px;
      overflow-y: auto;
    }

    .assertion-item {
      display: flex;
      align-items: flex-start;
      gap: var(--tc-spacing-sm);
      padding: var(--tc-spacing-sm) var(--tc-spacing-md);
      border-bottom: 1px solid var(--tc-border);
    }

    .assertion-item:last-child {
      border-bottom: none;
    }

    .assertion-item--passed {
      border-left: 3px solid var(--tc-success);
    }

    .assertion-item--passed .assertion-status {
      color: var(--tc-success);
    }

    .assertion-item--failed {
      border-left: 3px solid var(--tc-danger);
      background: rgba(239, 68, 68, 0.05);
    }

    .assertion-item--failed .assertion-status {
      color: var(--tc-danger);
    }

    .assertion-status {
      flex-shrink: 0;
      font-size: 16px;
    }

    .assertion-details {
      flex: 1;
      min-width: 0;
    }

    .assertion-name {
      font-size: 13px;
      font-weight: 500;
      color: var(--tc-text-primary);
    }

    .assertion-type {
      font-size: 10px;
      color: var(--tc-text-muted);
      text-transform: uppercase;
      margin-top: 2px;
    }

    .assertion-message {
      font-size: 12px;
      color: var(--tc-text-secondary);
      margin-top: var(--tc-spacing-xs);
    }

    .assertion-comparison {
      margin-top: var(--tc-spacing-sm);
      padding: var(--tc-spacing-sm);
      background: var(--tc-bg-primary);
      border-radius: var(--tc-radius-sm);
    }

    .comparison-row {
      display: flex;
      gap: var(--tc-spacing-sm);
      margin-bottom: var(--tc-spacing-xs);
    }

    .comparison-row:last-child {
      margin-bottom: 0;
    }

    .comparison-label {
      font-size: 11px;
      font-weight: 600;
      color: var(--tc-text-secondary);
      min-width: 60px;
    }

    .comparison-value {
      font-family: var(--tc-font-mono);
      font-size: 11px;
      color: var(--tc-text-primary);
      word-break: break-all;
    }

    .comparison-value--actual {
      color: var(--tc-danger);
    }

    .assertion-duration {
      font-size: 11px;
      font-family: var(--tc-font-mono);
      color: var(--tc-text-muted);
      flex-shrink: 0;
    }

    .assertions-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--tc-spacing-lg);
      color: var(--tc-text-muted);
      gap: var(--tc-spacing-sm);
    }

    .assertions-empty i {
      font-size: 20px;
      opacity: 0.5;
    }

    .assertions-empty span {
      font-size: 12px;
    }
  `]
})
export class AssertionResultsComponent {
  @Input() assertions: AssertionResult[] = [];

  get passedCount(): number {
    return this.assertions.filter(a => a.passed).length;
  }

  get failedCount(): number {
    return this.assertions.filter(a => !a.passed).length;
  }

  formatValue(value: unknown): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return `"${value}"`;
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  }
}
