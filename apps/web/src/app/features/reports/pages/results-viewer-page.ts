import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe, NgClass } from '@angular/common';
import { Button } from 'primeng/button';
import { ProgressBar } from 'primeng/progressbar';
import { Tooltip } from 'primeng/tooltip';
import { ReportsStore, ReportFormat, ReportStepResult } from '../../../core/services/state/reports.store';
import { ThemeService } from '../../../core/services/theme/theme.service';
import { StepsTreeComponent } from '../components/steps-tree';
import { StepDetailsComponent } from '../components/step-details';
import { ExportButtonsComponent } from '../components/export-buttons';

@Component({
  selector: 'app-results-viewer-page',
  standalone: true,
  imports: [
    DatePipe,
    NgClass,
    RouterLink,
    Button,
    ProgressBar,
    Tooltip,
    StepsTreeComponent,
    StepDetailsComponent,
    ExportButtonsComponent
  ],
  template: `
    <div class="results-viewer">
      @if (reportsStore.isLoading()) {
        <div class="loading-state">
          <p-progressbar mode="indeterminate" styleClass="loading-bar" />
          <span>Loading execution report...</span>
        </div>
      } @else if (reportsStore.error()) {
        <div class="error-state">
          <i class="pi pi-exclamation-circle"></i>
          <h3>Failed to Load Report</h3>
          <p>{{ reportsStore.error() }}</p>
          <p-button
            label="Go Back"
            icon="pi pi-arrow-left"
            routerLink="/reports"
          />
        </div>
      } @else if (reportsStore.currentReport(); as report) {
        <header class="results-header">
          <div class="results-header__left">
            <p-button
              icon="pi pi-arrow-left"
              [text]="true"
              routerLink="/reports"
              pTooltip="Back to Reports"
            />
            <div class="results-header__info">
              <h1>{{ report.planName }}</h1>
              <div class="results-header__meta">
                <span class="meta-item">
                  <i [class]="getStatusIcon(report.status)"></i>
                  <span [ngClass]="'status--' + report.status">{{ getStatusLabel(report.status) }}</span>
                </span>
                <span class="meta-divider">|</span>
                <span class="meta-item">
                  <i class="pi pi-clock"></i>
                  {{ formatDuration(report.duration) }}
                </span>
                <span class="meta-divider">|</span>
                <span class="meta-item">
                  <i class="pi pi-calendar"></i>
                  {{ report.startTime | date:'MMM d, y HH:mm:ss' }}
                </span>
                <span class="meta-divider">|</span>
                <span class="meta-item execution-id">
                  <i class="pi pi-hashtag"></i>
                  {{ report.executionId.slice(-8) }}
                </span>
              </div>
            </div>
          </div>

          <div class="results-header__right">
            <div class="results-header__stats">
              <div class="stat stat--passed">
                <span class="stat-value">{{ report.summary.passed }}</span>
                <span class="stat-label">Passed</span>
              </div>
              <div class="stat stat--failed">
                <span class="stat-value">{{ report.summary.failed }}</span>
                <span class="stat-label">Failed</span>
              </div>
              <div class="stat stat--total">
                <span class="stat-value">{{ report.summary.totalTests }}</span>
                <span class="stat-label">Total</span>
              </div>
            </div>
            <p-button
              [icon]="themeService.isDark() ? 'pi pi-sun' : 'pi pi-moon'"
              [text]="true"
              [pTooltip]="themeService.isDark() ? 'Switch to Light Mode' : 'Switch to Dark Mode'"
              tooltipPosition="bottom"
              (onClick)="onToggleTheme()"
            />
          </div>
        </header>

        <main class="results-content">
          <aside class="results-sidebar">
            <app-steps-tree
              [steps]="report.steps"
              [selectedStepId]="reportsStore.selectedStepId()"
              (stepSelect)="onStepSelect($event)"
            />
          </aside>

          <section class="results-main">
            <app-step-details [step]="reportsStore.selectedStep()" />
          </section>
        </main>

        <footer class="results-footer">
          <app-export-buttons
            [executionId]="report.executionId"
            (export)="onExport($event)"
          />
        </footer>
      } @else {
        <div class="empty-state">
          <i class="pi pi-file-excel"></i>
          <h3>No Report Found</h3>
          <p>The requested execution report could not be found.</p>
          <p-button
            label="Go to Reports"
            icon="pi pi-arrow-left"
            routerLink="/reports"
          />
        </div>
      }
    </div>
  `,
  styles: [`
    .results-viewer {
      display: flex;
      flex-direction: column;
      height: 100vh;
      background: var(--tc-bg-primary);
    }

    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      gap: var(--tc-spacing-md);
      color: var(--tc-text-secondary);
    }

    :host ::ng-deep .loading-bar {
      width: 200px;
      height: 4px;
    }

    .error-state,
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      gap: var(--tc-spacing-sm);
      color: var(--tc-text-muted);
    }

    .error-state i,
    .empty-state i {
      font-size: 48px;
      opacity: 0.5;
      color: var(--tc-danger);
    }

    .empty-state i {
      color: var(--tc-text-muted);
    }

    .error-state h3,
    .empty-state h3 {
      margin: 0;
      font-size: 18px;
      color: var(--tc-text-secondary);
    }

    .error-state p,
    .empty-state p {
      margin: 0 0 var(--tc-spacing-md);
      font-size: 13px;
    }

    .results-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--tc-spacing-md) var(--tc-spacing-lg);
      background: var(--tc-bg-secondary);
      border-bottom: 1px solid var(--tc-border);
    }

    .results-header__left {
      display: flex;
      align-items: center;
      gap: var(--tc-spacing-sm);
    }

    .results-header__info {
      display: flex;
      flex-direction: column;
    }

    .results-header__info h1 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: var(--tc-text-primary);
    }

    .results-header__meta {
      display: flex;
      align-items: center;
      gap: var(--tc-spacing-sm);
      margin-top: var(--tc-spacing-xs);
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

    .meta-divider {
      color: var(--tc-border);
    }

    .execution-id {
      font-family: var(--tc-font-mono);
    }

    .status--success {
      color: var(--tc-success);
    }

    .status--failed {
      color: var(--tc-danger);
    }

    .status--error {
      color: var(--tc-warning);
    }

    .results-header__right {
      display: flex;
      align-items: center;
      gap: var(--tc-spacing-md);
    }

    .results-header__stats {
      display: flex;
      gap: var(--tc-spacing-lg);
    }

    .stat {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: var(--tc-spacing-sm) var(--tc-spacing-md);
      border-radius: var(--tc-radius-md);
    }

    .stat-value {
      font-size: 24px;
      font-weight: 700;
      line-height: 1;
    }

    .stat-label {
      font-size: 10px;
      text-transform: uppercase;
      margin-top: 4px;
      color: var(--tc-text-secondary);
    }

    .stat--passed {
      background: rgba(34, 197, 94, 0.1);
    }

    .stat--passed .stat-value {
      color: var(--tc-success);
    }

    .stat--failed {
      background: rgba(239, 68, 68, 0.1);
    }

    .stat--failed .stat-value {
      color: var(--tc-danger);
    }

    .stat--total {
      background: var(--tc-bg-tertiary);
    }

    .stat--total .stat-value {
      color: var(--tc-text-primary);
    }

    .results-content {
      flex: 1;
      display: flex;
      overflow: hidden;
    }

    .results-sidebar {
      width: 300px;
      flex-shrink: 0;
      overflow: hidden;
    }

    .results-main {
      flex: 1;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .results-footer {
      flex-shrink: 0;
    }
  `]
})
export class ResultsViewerPageComponent implements OnInit, OnDestroy {
  protected readonly reportsStore = inject(ReportsStore);
  private readonly route = inject(ActivatedRoute);
  readonly themeService = inject(ThemeService);

  ngOnInit(): void {
    const executionId = this.route.snapshot.paramMap.get('executionId');
    if (executionId) {
      this.reportsStore.loadReport(executionId);
    }
  }

  ngOnDestroy(): void {
    this.reportsStore.clearReport();
  }

  onStepSelect(step: ReportStepResult): void {
    this.reportsStore.selectStep(step.id);
  }

  onExport(format: ReportFormat): void {
    const report = this.reportsStore.currentReport();
    if (report) {
      this.reportsStore.exportReport(report.executionId, format);
    }
  }

  onToggleTheme(): void {
    this.themeService.toggle();
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'success': return 'pi pi-check-circle';
      case 'failed': return 'pi pi-times-circle';
      case 'error': return 'pi pi-exclamation-triangle';
      default: return 'pi pi-circle';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'success': return 'Passed';
      case 'failed': return 'Failed';
      case 'error': return 'Error';
      case 'aborted': return 'Aborted';
      default: return status;
    }
  }

  formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    const seconds = ms / 1000;
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  }
}
