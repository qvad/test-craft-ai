import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-context-variables',
  standalone: true,
  imports: [],
  template: `
    <div class="context-variables">
      <div class="variables-header">
        <h4>
          <i class="pi pi-code"></i>
          Context Variables
        </h4>
        <span class="variables-count">{{ variableCount }} variables</span>
      </div>

      <div class="variables-content">
        @if (extractedVariables && hasVariables(extractedVariables)) {
          <div class="variables-section">
            <div class="section-header">
              <i class="pi pi-plus-circle"></i>
              <span>Extracted Variables</span>
            </div>
            @for (item of getEntries(extractedVariables); track item[0]) {
              <div class="variable-item variable-item--extracted">
                <span class="variable-name">{{ item[0] }}</span>
                <span class="variable-value">{{ formatValue(item[1]) }}</span>
              </div>
            }
          </div>
        }

        @if (inputVariables && hasVariables(inputVariables)) {
          <div class="variables-section">
            <div class="section-header">
              <i class="pi pi-arrow-right"></i>
              <span>Input Variables</span>
            </div>
            @for (item of getEntries(inputVariables); track item[0]) {
              <div class="variable-item variable-item--input">
                <span class="variable-name">{{ item[0] }}</span>
                <span class="variable-value">{{ formatValue(item[1]) }}</span>
              </div>
            }
          </div>
        }

        @if (!hasAnyVariables()) {
          <div class="variables-empty">
            <i class="pi pi-code"></i>
            <span>No variables in this step</span>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .context-variables {
      background: var(--tc-bg-secondary);
      border-radius: var(--tc-radius-md);
      border: 1px solid var(--tc-border);
      overflow: hidden;
    }

    .variables-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--tc-spacing-sm) var(--tc-spacing-md);
      background: var(--tc-bg-tertiary);
      border-bottom: 1px solid var(--tc-border);
    }

    .variables-header h4 {
      margin: 0;
      font-size: 12px;
      font-weight: 600;
      color: var(--tc-text-primary);
      display: flex;
      align-items: center;
      gap: var(--tc-spacing-xs);
    }

    .variables-count {
      font-size: 11px;
      color: var(--tc-text-muted);
    }

    .variables-content {
      max-height: 300px;
      overflow-y: auto;
    }

    .variables-section {
      border-bottom: 1px solid var(--tc-border);
    }

    .variables-section:last-child {
      border-bottom: none;
    }

    .section-header {
      display: flex;
      align-items: center;
      gap: var(--tc-spacing-xs);
      padding: var(--tc-spacing-xs) var(--tc-spacing-md);
      background: var(--tc-bg-primary);
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--tc-text-secondary);
    }

    .section-header i {
      font-size: 10px;
    }

    .variable-item {
      display: flex;
      align-items: flex-start;
      gap: var(--tc-spacing-sm);
      padding: var(--tc-spacing-xs) var(--tc-spacing-md);
      border-bottom: 1px solid var(--tc-border);
    }

    .variable-item:last-child {
      border-bottom: none;
    }

    .variable-item--extracted {
      background: rgba(34, 197, 94, 0.05);
    }

    .variable-item--extracted .variable-name::before {
      content: '+';
      color: var(--tc-success);
      margin-right: 4px;
    }

    .variable-name {
      font-family: var(--tc-font-mono);
      font-size: 12px;
      font-weight: 600;
      color: var(--tc-primary);
      min-width: 100px;
      flex-shrink: 0;
    }

    .variable-value {
      font-family: var(--tc-font-mono);
      font-size: 12px;
      color: var(--tc-text-secondary);
      word-break: break-all;
    }

    .variables-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--tc-spacing-lg);
      color: var(--tc-text-muted);
      gap: var(--tc-spacing-sm);
    }

    .variables-empty i {
      font-size: 20px;
      opacity: 0.5;
    }

    .variables-empty span {
      font-size: 12px;
    }
  `]
})
export class ContextVariablesComponent {
  @Input() extractedVariables: Record<string, unknown> | undefined;
  @Input() inputVariables: Record<string, unknown> | undefined;

  get variableCount(): number {
    let count = 0;
    if (this.extractedVariables) {
      count += Object.keys(this.extractedVariables).length;
    }
    if (this.inputVariables) {
      count += Object.keys(this.inputVariables).length;
    }
    return count;
  }

  hasVariables(vars: Record<string, unknown> | undefined): boolean {
    return vars !== undefined && Object.keys(vars).length > 0;
  }

  hasAnyVariables(): boolean {
    return this.hasVariables(this.extractedVariables) || this.hasVariables(this.inputVariables);
  }

  getEntries(obj: Record<string, unknown>): [string, unknown][] {
    return Object.entries(obj);
  }

  formatValue(value: unknown): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') {
      if (value.length > 100) {
        return `"${value.substring(0, 100)}..."`;
      }
      return `"${value}"`;
    }
    if (typeof value === 'object') {
      const str = JSON.stringify(value);
      if (str.length > 100) {
        return str.substring(0, 100) + '...';
      }
      return str;
    }
    return String(value);
  }
}
