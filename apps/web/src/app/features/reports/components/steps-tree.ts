import { Component, Input, Output, EventEmitter } from '@angular/core';
import { NgClass, NgTemplateOutlet } from '@angular/common';
import { ReportStepResult } from '../../../core/services/state/reports.store';

@Component({
  selector: 'app-steps-tree',
  standalone: true,
  imports: [NgClass, NgTemplateOutlet],
  template: `
    <div class="steps-tree">
      <div class="steps-tree__header">
        <h3>Execution Steps</h3>
        <span class="steps-count">{{ countSteps(steps) }} steps</span>
      </div>

      <div class="steps-tree__content">
        @for (step of steps; track step.id) {
          <ng-container *ngTemplateOutlet="stepTemplate; context: { step: step, level: 0 }"></ng-container>
        }

        @if (steps.length === 0) {
          <div class="steps-empty">
            <i class="pi pi-list"></i>
            <span>No steps recorded</span>
          </div>
        }
      </div>
    </div>

    <ng-template #stepTemplate let-step="step" let-level="level">
      <div
        class="step-item"
        [ngClass]="{
          'step-item--selected': selectedStepId === step.id,
          'step-item--passed': step.status === 'passed',
          'step-item--failed': step.status === 'failed',
          'step-item--error': step.status === 'error',
          'step-item--skipped': step.status === 'skipped',
          'step-item--running': step.status === 'running'
        }"
        [style.padding-left.px]="12 + level * 16"
        (click)="onStepSelect(step)"
      >
        <i class="step-icon" [ngClass]="getStepIcon(step)"></i>
        <span class="step-name">{{ step.name }}</span>
        <span class="step-type">{{ step.type }}</span>
        @if (step.duration) {
          <span class="step-duration">{{ formatDuration(step.duration) }}</span>
        }
      </div>

      @if (step.children && step.children.length > 0) {
        @for (child of step.children; track child.id) {
          <ng-container *ngTemplateOutlet="stepTemplate; context: { step: child, level: level + 1 }"></ng-container>
        }
      }
    </ng-template>
  `,
  styles: [`
    .steps-tree {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--tc-bg-secondary);
      border-right: 1px solid var(--tc-border);
    }

    .steps-tree__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--tc-spacing-sm) var(--tc-spacing-md);
      border-bottom: 1px solid var(--tc-border);
    }

    .steps-tree__header h3 {
      margin: 0;
      font-size: 13px;
      font-weight: 600;
      color: var(--tc-text-primary);
    }

    .steps-count {
      font-size: 11px;
      color: var(--tc-text-muted);
    }

    .steps-tree__content {
      flex: 1;
      overflow-y: auto;
    }

    .step-item {
      display: flex;
      align-items: center;
      gap: var(--tc-spacing-sm);
      padding: var(--tc-spacing-xs) var(--tc-spacing-md);
      cursor: pointer;
      border-left: 3px solid transparent;
      transition: background-color 0.15s;
    }

    .step-item:hover {
      background: var(--tc-bg-tertiary);
    }

    .step-item--selected {
      background: var(--tc-bg-tertiary);
      border-left-color: var(--tc-primary);
    }

    .step-item--passed .step-icon {
      color: var(--tc-success);
    }

    .step-item--failed .step-icon {
      color: var(--tc-danger);
    }

    .step-item--error .step-icon {
      color: var(--tc-warning);
    }

    .step-item--skipped .step-icon {
      color: var(--tc-text-muted);
    }

    .step-item--running .step-icon {
      color: var(--tc-primary);
    }

    .step-icon {
      width: 16px;
      text-align: center;
      flex-shrink: 0;
    }

    .step-name {
      flex: 1;
      font-size: 13px;
      color: var(--tc-text-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .step-type {
      font-size: 10px;
      color: var(--tc-text-muted);
      text-transform: uppercase;
      flex-shrink: 0;
    }

    .step-duration {
      font-size: 11px;
      font-family: var(--tc-font-mono);
      color: var(--tc-text-secondary);
      flex-shrink: 0;
    }

    .steps-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--tc-text-muted);
      gap: var(--tc-spacing-sm);
    }

    .steps-empty i {
      font-size: 24px;
      opacity: 0.5;
    }
  `]
})
export class StepsTreeComponent {
  @Input() steps: ReportStepResult[] = [];
  @Input() selectedStepId: string | null = null;

  @Output() stepSelect = new EventEmitter<ReportStepResult>();

  onStepSelect(step: ReportStepResult): void {
    this.stepSelect.emit(step);
  }

  getStepIcon(step: ReportStepResult): string {
    switch (step.status) {
      case 'passed': return 'pi pi-check-circle';
      case 'failed': return 'pi pi-times-circle';
      case 'error': return 'pi pi-exclamation-triangle';
      case 'skipped': return 'pi pi-minus-circle';
      case 'running': return 'pi pi-spinner pi-spin';
      case 'pending': return 'pi pi-circle';
      default: return 'pi pi-circle';
    }
  }

  formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  countSteps(steps: ReportStepResult[]): number {
    let count = steps.length;
    for (const step of steps) {
      if (step.children) {
        count += this.countSteps(step.children);
      }
    }
    return count;
  }
}
