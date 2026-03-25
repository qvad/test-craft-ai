import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';
import { ReportsStore, ReportFormat } from '../../../core/services/state/reports.store';
import { ThemeService } from '../../../core/services/theme/theme.service';
import { ExecutionFiltersComponent } from '../components/execution-filters';
import { SummaryCardsComponent } from '../components/summary-cards';
import { ExecutionsTableComponent } from '../components/executions-table';

@Component({
  selector: 'app-reports-page',
  standalone: true,
  imports: [
    RouterLink,
    Button,
    Tooltip,
    ExecutionFiltersComponent,
    SummaryCardsComponent,
    ExecutionsTableComponent
  ],
  template: `
    <div class="reports-page">
      <header class="reports-header">
        <div class="reports-header__left">
          <p-button
            icon="pi pi-arrow-left"
            [text]="true"
            routerLink="/"
            pTooltip="Back to Editor"
          />
          <h1>Execution Reports</h1>
        </div>
        <div class="reports-header__right">
          <p-button
            icon="pi pi-refresh"
            label="Refresh"
            [text]="true"
            (onClick)="onRefresh()"
          />
          <p-button
            [icon]="themeService.isDark() ? 'pi pi-sun' : 'pi pi-moon'"
            [text]="true"
            [pTooltip]="themeService.isDark() ? 'Switch to Light Mode' : 'Switch to Dark Mode'"
            tooltipPosition="bottom"
            (onClick)="onToggleTheme()"
          />
        </div>
      </header>

      <app-execution-filters
        (filtersChanged)="onFiltersChanged()"
        (refresh)="onRefresh()"
      />

      <app-summary-cards [counts]="reportsStore.summaryCounts()" />

      <main class="reports-content">
        <app-executions-table
          [executions]="reportsStore.filteredExecutions()"
          [totalRecords]="reportsStore.totalCount()"
          [loading]="reportsStore.isLoading()"
          (pageChange)="onPageChange($event)"
          (export)="onExport($event)"
          (delete)="onDelete($event)"
        />
      </main>

      @if (reportsStore.error()) {
        <div class="error-banner">
          <i class="pi pi-exclamation-circle"></i>
          <span>{{ reportsStore.error() }}</span>
          <p-button
            icon="pi pi-times"
            [text]="true"
            size="small"
            (onClick)="clearError()"
          />
        </div>
      }
    </div>
  `,
  styles: [`
    .reports-page {
      display: flex;
      flex-direction: column;
      height: 100vh;
      background: var(--tc-bg-primary);
    }

    .reports-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--tc-spacing-md) var(--tc-spacing-lg);
      background: var(--tc-bg-secondary);
      border-bottom: 1px solid var(--tc-border);
    }

    .reports-header__left {
      display: flex;
      align-items: center;
      gap: var(--tc-spacing-sm);
    }

    .reports-header__left h1 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: var(--tc-text-primary);
    }

    .reports-header__right {
      display: flex;
      align-items: center;
      gap: var(--tc-spacing-sm);
    }

    .reports-content {
      flex: 1;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .error-banner {
      display: flex;
      align-items: center;
      gap: var(--tc-spacing-sm);
      padding: var(--tc-spacing-sm) var(--tc-spacing-md);
      background: rgba(239, 68, 68, 0.1);
      border-top: 1px solid var(--tc-danger);
      color: var(--tc-danger);
    }

    .error-banner span {
      flex: 1;
    }
  `]
})
export class ReportsPageComponent implements OnInit {
  protected readonly reportsStore = inject(ReportsStore);
  readonly themeService = inject(ThemeService);

  ngOnInit(): void {
    this.reportsStore.loadExecutions();
  }

  onRefresh(): void {
    this.reportsStore.loadExecutions(this.reportsStore.page());
  }

  onToggleTheme(): void {
    this.themeService.toggle();
  }

  onFiltersChanged(): void {
    this.reportsStore.loadExecutions(1);
  }

  onPageChange(event: { page: number }): void {
    this.reportsStore.loadExecutions(event.page);
  }

  onExport(event: { executionId: string; format: ReportFormat }): void {
    this.reportsStore.exportReport(event.executionId, event.format);
  }

  onDelete(executionId: string): void {
    if (confirm('Are you sure you want to delete this execution?')) {
      this.reportsStore.deleteExecution(executionId);
    }
  }

  clearError(): void {
    // The store doesn't have a clearError method yet, so we'll just reload
    this.onRefresh();
  }
}
