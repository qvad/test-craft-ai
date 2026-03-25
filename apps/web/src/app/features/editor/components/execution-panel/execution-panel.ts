import { Component, inject, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { DatePipe, NgClass, TitleCasePipe, UpperCasePipe, SlicePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { ProgressBar } from 'primeng/progressbar';
import { Tabs, TabList, Tab, TabPanels, TabPanel } from 'primeng/tabs';
import { TableModule } from 'primeng/table';
import { Tooltip } from 'primeng/tooltip';
import { ExecutionStore, TestPlanStore } from '../../../../core/services/state';

@Component({
  selector: 'app-execution-panel',
  standalone: true,
  imports: [
    DatePipe,
    NgClass,
    TitleCasePipe,
    UpperCasePipe,
    SlicePipe,
    RouterLink,
    Button,
    ProgressBar,
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    TableModule,
    Tooltip
  ],
  template: `
    <div class="execution-panel">
      <div class="execution-panel__header">
        <div class="execution-panel__status">
          @if (executionStore.isExecuting()) {
            <div class="status-indicator status-indicator--running"></div>
            <span>{{ executionStore.status() | titlecase }}</span>
          } @else if (executionStore.currentExecution()) {
            <div class="status-indicator" [ngClass]="'status-indicator--' + executionStore.status()"></div>
            <span>{{ executionStore.status() | titlecase }}</span>
          } @else {
            <div class="status-indicator status-indicator--idle"></div>
            <span>Ready</span>
          }
        </div>

        @if (executionStore.currentExecution()) {
          <div class="execution-panel__progress">
            <p-progressbar
              [value]="executionStore.progress()"
              [showValue]="false"
              styleClass="execution-progress"
            />
            <span class="progress-text">{{ executionStore.progress() }}%</span>
          </div>

          <div class="execution-panel__stats">
            <span class="stat stat--passed">
              <i class="pi pi-check-circle"></i>
              {{ executionStore.passedCount() }}
            </span>
            <span class="stat stat--failed">
              <i class="pi pi-times-circle"></i>
              {{ executionStore.failedCount() }}
            </span>
            @if (executionStore.runningCount() > 0) {
              <span class="stat stat--running">
                <i class="pi pi-spinner pi-spin"></i>
                {{ executionStore.runningCount() }}
              </span>
            }
          </div>
        }

        <div class="execution-panel__actions">
          @if (!executionStore.isExecuting()) {
            <p-button
              icon="pi pi-play"
              [text]="true"
              size="small"
              severity="success"
              pTooltip="Run"
              (onClick)="onRun()"
            />
          } @else {
            @if (executionStore.isPaused()) {
              <p-button
                icon="pi pi-play"
                [text]="true"
                size="small"
                severity="success"
                pTooltip="Resume"
                (onClick)="onResume()"
              />
            } @else {
              <p-button
                icon="pi pi-pause"
                [text]="true"
                size="small"
                severity="warn"
                pTooltip="Pause"
                (onClick)="onPause()"
              />
            }
            <p-button
              icon="pi pi-stop"
              [text]="true"
              size="small"
              severity="danger"
              pTooltip="Stop"
              (onClick)="onStop()"
            />
          }
          @if (executionStore.currentExecution() && !executionStore.isExecuting()) {
            <p-button
              icon="pi pi-external-link"
              [text]="true"
              size="small"
              pTooltip="View Full Report"
              [routerLink]="['/reports', executionStore.currentExecution()?.id]"
            />
          }
          <p-button
            icon="pi pi-trash"
            [text]="true"
            size="small"
            pTooltip="Clear"
            (onClick)="onClear()"
          />
        </div>
      </div>

      <p-tabs value="0" styleClass="execution-panel__tabs">
        <p-tablist>
          <p-tab value="0">Console</p-tab>
          <p-tab value="1">Results</p-tab>
        </p-tablist>
        <p-tabpanels>
          <p-tabpanel value="0">
            <div class="console-output" #consoleOutput>
              @for (log of executionStore.logs(); track $index) {
                <div class="log-entry" [ngClass]="'log-entry--' + log.level">
                  <span class="log-entry__time">{{ log.timestamp | date:'HH:mm:ss.SSS' }}</span>
                  <span class="log-entry__level">{{ log.level | uppercase }}</span>
                  <span class="log-entry__message">{{ log.message }}</span>
                </div>
              }
              @if (executionStore.logs().length === 0) {
                <div class="console-empty">
                  <i class="pi pi-terminal"></i>
                  <span>Execution logs will appear here</span>
                </div>
              }
            </div>
          </p-tabpanel>

          <p-tabpanel value="1">
            <div class="results-container">
              <p-table
                [value]="executionStore.results()"
                [scrollable]="true"
                scrollHeight="100%"
                styleClass="results-table"
              >
                <ng-template pTemplate="header">
                  <tr>
                    <th style="width: 40px">Status</th>
                    <th>Node</th>
                    <th style="width: 100px">Duration</th>
                    <th style="width: 150px">Error</th>
                  </tr>
                </ng-template>
                <ng-template pTemplate="body" let-result>
                  <tr [ngClass]="'result-row--' + result.status">
                    <td>
                      @switch (result.status) {
                        @case ('passed') {
                          <i class="pi pi-check-circle text-success"></i>
                        }
                        @case ('failed') {
                          <i class="pi pi-times-circle text-danger"></i>
                        }
                        @case ('running') {
                          <i class="pi pi-spinner pi-spin text-primary"></i>
                        }
                        @case ('skipped') {
                          <i class="pi pi-minus-circle text-muted"></i>
                        }
                        @default {
                          <i class="pi pi-circle text-muted"></i>
                        }
                      }
                    </td>
                    <td>{{ result.nodeName }}</td>
                    <td>{{ result.duration ? result.duration + 'ms' : '-' }}</td>
                    <td class="error-cell">
                      @if (result.error) {
                        <span
                          class="error-message"
                          [pTooltip]="result.error.message"
                          tooltipPosition="left"
                        >
                          {{ result.error.message | slice:0:50 }}
                        </span>
                      } @else {
                        -
                      }
                    </td>
                  </tr>
                </ng-template>
                <ng-template pTemplate="emptymessage">
                  <tr>
                    <td colspan="4" class="results-empty">
                      <i class="pi pi-chart-bar"></i>
                      <span>No execution results yet</span>
                    </td>
                  </tr>
                </ng-template>
              </p-table>
            </div>
          </p-tabpanel>
        </p-tabpanels>
      </p-tabs>
    </div>
  `,
  styles: [`
    .execution-panel {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--tc-bg-secondary);
    }

    .execution-panel__header {
      display: flex;
      align-items: center;
      gap: var(--tc-spacing-md);
      padding: var(--tc-spacing-sm) var(--tc-spacing-md);
      border-bottom: 1px solid var(--tc-border);
    }

    .execution-panel__status {
      display: flex;
      align-items: center;
      gap: var(--tc-spacing-sm);
      font-size: 13px;
      font-weight: 500;
    }

    .status-indicator {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    .status-indicator--idle {
      background: var(--tc-text-muted);
    }

    .status-indicator--running,
    .status-indicator--initializing {
      background: var(--tc-primary);
      animation: pulse 1s infinite;
    }

    .status-indicator--paused {
      background: var(--tc-warning);
    }

    .status-indicator--completed {
      background: var(--tc-success);
    }

    .status-indicator--failed {
      background: var(--tc-danger);
    }

    .status-indicator--cancelled {
      background: var(--tc-text-muted);
    }

    .execution-panel__progress {
      flex: 1;
      display: flex;
      align-items: center;
      gap: var(--tc-spacing-sm);
      max-width: 300px;
    }

    :host ::ng-deep .execution-progress {
      flex: 1;
      height: 6px;
    }

    .progress-text {
      font-size: 11px;
      color: var(--tc-text-secondary);
      min-width: 35px;
    }

    .execution-panel__stats {
      display: flex;
      gap: var(--tc-spacing-md);
    }

    .stat {
      display: flex;
      align-items: center;
      gap: var(--tc-spacing-xs);
      font-size: 12px;
      font-weight: 500;
    }

    .stat--passed {
      color: var(--tc-success);
    }

    .stat--failed {
      color: var(--tc-danger);
    }

    .stat--running {
      color: var(--tc-primary);
    }

    .execution-panel__actions {
      display: flex;
      gap: 2px;
      margin-left: auto;
    }

    :host ::ng-deep .execution-panel__tabs {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      min-height: 0;
    }

    :host ::ng-deep .execution-panel__tabs .p-tablist {
      flex-shrink: 0;
    }

    :host ::ng-deep .execution-panel__tabs .p-tabpanels {
      flex: 1;
      position: relative;
      min-height: 0;
    }

    :host ::ng-deep .execution-panel__tabs .p-tabpanel {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      overflow: hidden;
    }

    :host ::ng-deep .execution-panel__tabs .p-tabpanel-content {
      height: 100%;
      overflow: hidden;
    }

    .console-output {
      height: 100%;
      overflow-y: auto !important;
      overflow-x: hidden;
      font-family: var(--tc-font-mono);
      font-size: 12px;
      padding: var(--tc-spacing-sm);
      background: var(--tc-bg-primary);
    }

    .log-entry {
      display: flex;
      gap: var(--tc-spacing-sm);
      padding: 2px 0;
      line-height: 1.4;
    }

    .log-entry__time {
      color: var(--tc-text-muted);
      flex-shrink: 0;
    }

    .log-entry__level {
      width: 50px;
      flex-shrink: 0;
      font-weight: 600;
    }

    .log-entry--info .log-entry__level {
      color: var(--tc-info);
    }

    .log-entry--warn .log-entry__level {
      color: var(--tc-warning);
    }

    .log-entry--error .log-entry__level {
      color: var(--tc-danger);
    }

    .log-entry--debug .log-entry__level {
      color: var(--tc-text-muted);
    }

    .log-entry__message {
      color: var(--tc-text-primary);
      word-break: break-word;
    }

    .console-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--tc-text-muted);
      gap: var(--tc-spacing-sm);
    }

    .console-empty i {
      font-size: 24px;
      opacity: 0.5;
    }

    .results-container {
      height: 100%;
      overflow: auto;
    }

    :host ::ng-deep .results-table {
      height: 100%;
    }

    :host ::ng-deep .results-table .p-datatable-wrapper {
      max-height: 100%;
      overflow: auto;
    }

    :host ::ng-deep .results-table th {
      background: var(--tc-bg-tertiary);
      color: var(--tc-text-secondary);
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      padding: var(--tc-spacing-sm);
    }

    :host ::ng-deep .results-table td {
      padding: var(--tc-spacing-sm);
      font-size: 13px;
    }

    .result-row--passed td {
      background: rgba(34, 197, 94, 0.05);
    }

    .result-row--failed td {
      background: rgba(239, 68, 68, 0.05);
    }

    .result-row--running td {
      background: rgba(99, 102, 241, 0.05);
    }

    .error-cell {
      max-width: 150px;
    }

    .error-message {
      color: var(--tc-danger);
      font-size: 12px;
      cursor: help;
    }

    .results-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--tc-spacing-xl);
      color: var(--tc-text-muted);
      gap: var(--tc-spacing-sm);
    }

    .results-empty i {
      font-size: 24px;
      opacity: 0.5;
    }

    .text-success {
      color: var(--tc-success);
    }

    .text-danger {
      color: var(--tc-danger);
    }

    .text-primary {
      color: var(--tc-primary);
    }

    .text-muted {
      color: var(--tc-text-muted);
    }

    @keyframes pulse {
      0%, 100% {
        opacity: 1;
      }
      50% {
        opacity: 0.5;
      }
    }
  `]
})
export class ExecutionPanelComponent implements AfterViewChecked {
  protected readonly executionStore = inject(ExecutionStore);
  protected readonly planStore = inject(TestPlanStore);

  @ViewChild('consoleOutput') consoleOutput?: ElementRef<HTMLDivElement>;

  private shouldScrollToBottom = true;
  private lastLogCount = 0;

  ngAfterViewChecked(): void {
    const currentLogCount = this.executionStore.logs().length;
    if (currentLogCount > this.lastLogCount && this.shouldScrollToBottom) {
      this.scrollToBottom();
    }
    this.lastLogCount = currentLogCount;
  }

  private scrollToBottom(): void {
    if (this.consoleOutput?.nativeElement) {
      const el = this.consoleOutput.nativeElement;
      el.scrollTop = el.scrollHeight;
    }
  }

  onRun(): void {
    this.executionStore.execute();
  }

  onPause(): void {
    this.executionStore.pause();
  }

  onResume(): void {
    this.executionStore.resume();
  }

  onStop(): void {
    this.executionStore.stop();
  }

  onClear(): void {
    this.executionStore.clearExecution();
  }
}
