import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Button } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';
import { ReportFormat } from '../../../core/services/state/reports.store';

interface ExportOption {
  format: ReportFormat;
  label: string;
  icon: string;
  description: string;
}

@Component({
  selector: 'app-export-buttons',
  standalone: true,
  imports: [Button, Tooltip],
  template: `
    <div class="export-buttons">
      <span class="export-label">Export:</span>
      @for (option of exportOptions; track option.format) {
        <p-button
          [label]="option.label"
          [icon]="option.icon"
          [outlined]="true"
          size="small"
          [pTooltip]="option.description"
          tooltipPosition="top"
          [disabled]="exporting"
          (onClick)="onExport(option.format)"
        />
      }
    </div>
  `,
  styles: [`
    .export-buttons {
      display: flex;
      align-items: center;
      gap: var(--tc-spacing-sm);
      padding: var(--tc-spacing-md);
      background: var(--tc-bg-secondary);
      border-top: 1px solid var(--tc-border);
    }

    .export-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--tc-text-secondary);
      margin-right: var(--tc-spacing-sm);
    }
  `]
})
export class ExportButtonsComponent {
  @Input() executionId = '';
  @Input() exporting = false;

  @Output() export = new EventEmitter<ReportFormat>();

  readonly exportOptions: ExportOption[] = [
    {
      format: 'junit',
      label: 'JUnit XML',
      icon: 'pi pi-code',
      description: 'Export as JUnit XML for CI/CD integration'
    },
    {
      format: 'html',
      label: 'HTML',
      icon: 'pi pi-file',
      description: 'Export as interactive HTML report'
    },
    {
      format: 'json',
      label: 'JSON',
      icon: 'pi pi-database',
      description: 'Export as JSON for programmatic access'
    },
    {
      format: 'csv',
      label: 'CSV',
      icon: 'pi pi-table',
      description: 'Export as CSV for data analysis'
    }
  ];

  onExport(format: ReportFormat): void {
    this.export.emit(format);
  }
}
