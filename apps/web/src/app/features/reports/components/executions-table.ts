import { Component, Input, Output, EventEmitter } from '@angular/core';
import { DatePipe, NgClass } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { Button } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';
import { Tag } from 'primeng/tag';
import { ExecutionSummary, ReportFormat } from '../../../core/services/state/reports.store';

@Component({
  selector: 'app-executions-table',
  standalone: true,
  imports: [
    DatePipe,
    NgClass,
    RouterLink,
    TableModule,
    Button,
    Tooltip,
    Tag
  ],
  template: `
    <div class="executions-table-container">
      <p-table
        [value]="executions"
        [paginator]="true"
        [rows]="pageSize"
        [totalRecords]="totalRecords"
        [lazy]="true"
        (onLazyLoad)="onPageChange($event)"
        [loading]="loading"
        [rowHover]="true"
        styleClass="executions-table"
        [tableStyle]="{ 'min-width': '50rem' }"
      >
        <ng-template pTemplate="header">
          <tr>
            <th style="width: 80px">ID</th>
            <th>Plan</th>
            <th style="width: 100px">Status</th>
            <th style="width: 120px">Results</th>
            <th style="width: 100px">Duration</th>
            <th style="width: 160px">Started</th>
            <th style="width: 140px">Actions</th>
          </tr>
        </ng-template>

        <ng-template pTemplate="body" let-execution>
          <tr [ngClass]="'row--' + execution.status">
            <td class="cell-id">
              <span class="execution-id">#{{ execution.id.slice(-6) }}</span>
            </td>
            <td>
              <div class="plan-info">
                <i class="pi pi-folder"></i>
                <span class="plan-name">{{ execution.planName }}</span>
              </div>
            </td>
            <td>
              <p-tag
                [value]="getStatusLabel(execution.status)"
                [severity]="getStatusSeverity(execution.status)"
                [icon]="getStatusIcon(execution.status)"
              />
            </td>
            <td>
              <div class="results-summary">
                <span class="result result--passed" pTooltip="Passed">
                  <i class="pi pi-check"></i>
                  {{ execution.passed }}
                </span>
                <span class="result result--failed" pTooltip="Failed">
                  <i class="pi pi-times"></i>
                  {{ execution.failed }}
                </span>
                <span class="result result--total" pTooltip="Total">
                  / {{ execution.totalTests }}
                </span>
              </div>
            </td>
            <td>
              <span class="duration">{{ formatDuration(execution.duration) }}</span>
            </td>
            <td>
              <span class="timestamp">{{ execution.startTime | date:'MMM d, y HH:mm' }}</span>
            </td>
            <td>
              <div class="actions">
                <p-button
                  icon="pi pi-eye"
                  [text]="true"
                  size="small"
                  pTooltip="View Details"
                  tooltipPosition="top"
                  [routerLink]="['/reports', execution.id]"
                />
                <p-button
                  icon="pi pi-download"
                  [text]="true"
                  size="small"
                  pTooltip="Export"
                  tooltipPosition="top"
                  (onClick)="onExport(execution.id)"
                />
                <p-button
                  icon="pi pi-trash"
                  [text]="true"
                  size="small"
                  severity="danger"
                  pTooltip="Delete"
                  tooltipPosition="top"
                  (onClick)="onDeleteClick($event, execution)"
                />
              </div>
            </td>
          </tr>
        </ng-template>

        <ng-template pTemplate="emptymessage">
          <tr>
            <td colspan="7" class="empty-message">
              <div class="empty-state">
                <i class="pi pi-inbox"></i>
                <h3>No Executions Found</h3>
                <p>Run a test plan to see execution history here.</p>
              </div>
            </td>
          </tr>
        </ng-template>
      </p-table>
    </div>
  `,
  styles: [`
    .executions-table-container {
      flex: 1;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    :host ::ng-deep .executions-table {
      height: 100%;
    }

    :host ::ng-deep .executions-table th {
      background: var(--tc-bg-tertiary);
      color: var(--tc-text-secondary);
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      padding: var(--tc-spacing-sm) var(--tc-spacing-md);
    }

    :host ::ng-deep .executions-table td {
      padding: var(--tc-spacing-sm) var(--tc-spacing-md);
      font-size: 13px;
      border-bottom: 1px solid var(--tc-border);
    }

    :host ::ng-deep .executions-table tr:hover td {
      background: var(--tc-bg-tertiary);
    }

    .row--success td {
      border-left: 3px solid var(--tc-success);
    }

    .row--failed td {
      border-left: 3px solid var(--tc-danger);
    }

    .row--error td {
      border-left: 3px solid var(--tc-warning);
    }

    .row--running td {
      border-left: 3px solid var(--tc-primary);
    }

    .cell-id {
      font-family: var(--tc-font-mono);
    }

    .execution-id {
      color: var(--tc-text-secondary);
      font-size: 12px;
    }

    .plan-info {
      display: flex;
      align-items: center;
      gap: var(--tc-spacing-sm);
    }

    .plan-info i {
      color: var(--tc-text-muted);
    }

    .plan-name {
      font-weight: 500;
    }

    .results-summary {
      display: flex;
      align-items: center;
      gap: var(--tc-spacing-sm);
      font-size: 12px;
    }

    .result {
      display: flex;
      align-items: center;
      gap: 2px;
    }

    .result--passed {
      color: var(--tc-success);
    }

    .result--failed {
      color: var(--tc-danger);
    }

    .result--total {
      color: var(--tc-text-muted);
    }

    .duration {
      font-family: var(--tc-font-mono);
      font-size: 12px;
      color: var(--tc-text-secondary);
    }

    .timestamp {
      font-size: 12px;
      color: var(--tc-text-secondary);
    }

    .actions {
      display: flex;
      gap: 2px;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--tc-spacing-xl);
      color: var(--tc-text-muted);
    }

    .empty-state i {
      font-size: 48px;
      opacity: 0.5;
      margin-bottom: var(--tc-spacing-md);
    }

    .empty-state h3 {
      margin: 0;
      font-size: 16px;
      color: var(--tc-text-secondary);
    }

    .empty-state p {
      margin: var(--tc-spacing-sm) 0 0;
      font-size: 13px;
    }
  `]
})
export class ExecutionsTableComponent {
  @Input() executions: ExecutionSummary[] = [];
  @Input() totalRecords = 0;
  @Input() pageSize = 20;
  @Input() loading = false;

  @Output() pageChange = new EventEmitter<{ page: number }>();
  @Output() export = new EventEmitter<{ executionId: string; format: ReportFormat }>();
  @Output() delete = new EventEmitter<string>();

  getStatusLabel(status: string): string {
    switch (status) {
      case 'success': return 'Passed';
      case 'failed': return 'Failed';
      case 'error': return 'Error';
      case 'running': return 'Running';
      case 'aborted': return 'Aborted';
      default: return status;
    }
  }

  getStatusSeverity(status: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' | undefined {
    switch (status) {
      case 'success': return 'success';
      case 'failed': return 'danger';
      case 'error': return 'warn';
      case 'running': return 'info';
      default: return 'secondary';
    }
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'success': return 'pi pi-check';
      case 'failed': return 'pi pi-times';
      case 'error': return 'pi pi-exclamation-triangle';
      case 'running': return 'pi pi-spin pi-spinner';
      default: return '';
    }
  }

  formatDuration(ms?: number): string {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    const seconds = ms / 1000;
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  }

  onPageChange(event: TableLazyLoadEvent): void {
    const page = Math.floor((event.first ?? 0) / (event.rows ?? this.pageSize)) + 1;
    this.pageChange.emit({ page });
  }

  onExport(executionId: string): void {
    this.export.emit({ executionId, format: 'html' });
  }

  onDeleteClick(event: Event, execution: ExecutionSummary): void {
    this.delete.emit(execution.id);
  }
}
