import { Component, Input } from '@angular/core';

export interface SummaryCounts {
  total: number;
  success: number;
  failed: number;
  error: number;
  running: number;
}

@Component({
  selector: 'app-summary-cards',
  standalone: true,
  imports: [],
  template: `
    <div class="summary-cards">
      <div class="summary-card summary-card--total">
        <div class="summary-card__icon">
          <i class="pi pi-list"></i>
        </div>
        <div class="summary-card__content">
          <span class="summary-card__value">{{ counts.total }}</span>
          <span class="summary-card__label">Total</span>
        </div>
      </div>

      <div class="summary-card summary-card--success">
        <div class="summary-card__icon">
          <i class="pi pi-check-circle"></i>
        </div>
        <div class="summary-card__content">
          <span class="summary-card__value">{{ counts.success }}</span>
          <span class="summary-card__label">Passed</span>
        </div>
      </div>

      <div class="summary-card summary-card--failed">
        <div class="summary-card__icon">
          <i class="pi pi-times-circle"></i>
        </div>
        <div class="summary-card__content">
          <span class="summary-card__value">{{ counts.failed }}</span>
          <span class="summary-card__label">Failed</span>
        </div>
      </div>

      <div class="summary-card summary-card--error">
        <div class="summary-card__icon">
          <i class="pi pi-exclamation-triangle"></i>
        </div>
        <div class="summary-card__content">
          <span class="summary-card__value">{{ counts.error }}</span>
          <span class="summary-card__label">Errors</span>
        </div>
      </div>

      @if (counts.running > 0) {
        <div class="summary-card summary-card--running">
          <div class="summary-card__icon">
            <i class="pi pi-spinner pi-spin"></i>
          </div>
          <div class="summary-card__content">
            <span class="summary-card__value">{{ counts.running }}</span>
            <span class="summary-card__label">Running</span>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .summary-cards {
      display: flex;
      gap: var(--tc-spacing-md);
      padding: var(--tc-spacing-md);
      background: var(--tc-bg-primary);
      border-bottom: 1px solid var(--tc-border);
      flex-wrap: wrap;
    }

    .summary-card {
      display: flex;
      align-items: center;
      gap: var(--tc-spacing-sm);
      padding: var(--tc-spacing-sm) var(--tc-spacing-md);
      border-radius: var(--tc-radius-md);
      min-width: 100px;
    }

    .summary-card__icon {
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--tc-radius-sm);
      font-size: 16px;
    }

    .summary-card__content {
      display: flex;
      flex-direction: column;
    }

    .summary-card__value {
      font-size: 20px;
      font-weight: 600;
      line-height: 1;
    }

    .summary-card__label {
      font-size: 11px;
      color: var(--tc-text-secondary);
      text-transform: uppercase;
      margin-top: 2px;
    }

    .summary-card--total {
      background: var(--tc-bg-tertiary);
    }

    .summary-card--total .summary-card__icon {
      background: var(--tc-bg-secondary);
      color: var(--tc-text-primary);
    }

    .summary-card--total .summary-card__value {
      color: var(--tc-text-primary);
    }

    .summary-card--success {
      background: rgba(34, 197, 94, 0.1);
    }

    .summary-card--success .summary-card__icon {
      background: rgba(34, 197, 94, 0.2);
      color: var(--tc-success);
    }

    .summary-card--success .summary-card__value {
      color: var(--tc-success);
    }

    .summary-card--failed {
      background: rgba(239, 68, 68, 0.1);
    }

    .summary-card--failed .summary-card__icon {
      background: rgba(239, 68, 68, 0.2);
      color: var(--tc-danger);
    }

    .summary-card--failed .summary-card__value {
      color: var(--tc-danger);
    }

    .summary-card--error {
      background: rgba(251, 146, 60, 0.1);
    }

    .summary-card--error .summary-card__icon {
      background: rgba(251, 146, 60, 0.2);
      color: var(--tc-warning);
    }

    .summary-card--error .summary-card__value {
      color: var(--tc-warning);
    }

    .summary-card--running {
      background: rgba(99, 102, 241, 0.1);
    }

    .summary-card--running .summary-card__icon {
      background: rgba(99, 102, 241, 0.2);
      color: var(--tc-primary);
    }

    .summary-card--running .summary-card__value {
      color: var(--tc-primary);
    }
  `]
})
export class SummaryCardsComponent {
  @Input() counts: SummaryCounts = {
    total: 0,
    success: 0,
    failed: 0,
    error: 0,
    running: 0
  };
}
