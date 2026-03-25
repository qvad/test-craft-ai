import { Component, inject, signal, Output, EventEmitter } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { Select } from 'primeng/select';
import { InputText } from 'primeng/inputtext';
import { Tooltip } from 'primeng/tooltip';
import { Dialog } from 'primeng/dialog';
import { TestPlanStore, ExecutionStore } from '../../../../core/services/state';
import { TestPlan } from '../../../../shared/models';
import { ThemeService } from '../../../../core/services/theme/theme.service';

@Component({
  selector: 'app-top-toolbar',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    Button,
    Select,
    InputText,
    Tooltip,
    Dialog
  ],
  template: `
    <div class="toolbar">
      <div class="toolbar__left">
        <div class="toolbar__logo">
          <i class="pi pi-bolt" style="color: var(--tc-primary); font-size: 20px;"></i>
          <span class="toolbar__title">TestCraft AI</span>
        </div>

        <div class="toolbar__divider"></div>

        <p-select
          [options]="planStore.plans()"
          [ngModel]="selectedPlan()"
          (ngModelChange)="onPlanSelect($event)"
          optionLabel="name"
          placeholder="Select Test Plan"
          styleClass="toolbar__plan-selector"
          [showClear]="false"
        >
          <ng-template pTemplate="selectedItem" let-plan>
            @if (plan) {
              <div class="plan-option">
                <i class="pi pi-folder"></i>
                <span>{{ plan.name }}</span>
                @if (planStore.isDirty()) {
                  <span class="plan-option__dirty">*</span>
                }
              </div>
            }
          </ng-template>
          <ng-template pTemplate="item" let-plan>
            <div class="plan-option">
              <i class="pi pi-folder"></i>
              <span>{{ plan.name }}</span>
              <span class="plan-option__status" [class]="'plan-option__status--' + plan.status">
                {{ plan.status }}
              </span>
            </div>
          </ng-template>
        </p-select>

        <p-button
          icon="pi pi-plus"
          [text]="true"
          pTooltip="New Test Plan"
          tooltipPosition="bottom"
          (onClick)="showNewPlanDialog = true"
        />

        <p-button
          icon="pi pi-save"
          [text]="true"
          [disabled]="!planStore.isDirty()"
          pTooltip="Save (Ctrl+S)"
          tooltipPosition="bottom"
          (onClick)="onSave()"
        />
      </div>

      <div class="toolbar__center">
        <p-button
          icon="pi pi-play"
          label="Run"
          severity="success"
          size="small"
          [disabled]="!executionStore.canRun()"
          pTooltip="Execute Test Plan"
          tooltipPosition="bottom"
          (onClick)="onRun()"
        />

        @if (executionStore.isExecuting()) {
          <p-button
            icon="pi pi-pause"
            [text]="true"
            severity="warn"
            [disabled]="!executionStore.canPause()"
            pTooltip="Pause Execution"
            tooltipPosition="bottom"
            (onClick)="onPause()"
          />

          <p-button
            icon="pi pi-stop"
            [text]="true"
            severity="danger"
            [disabled]="!executionStore.canStop()"
            pTooltip="Stop Execution"
            tooltipPosition="bottom"
            (onClick)="onStop()"
          />
        }
      </div>

      <div class="toolbar__right">
        <p-button
          icon="pi pi-chart-bar"
          [text]="true"
          pTooltip="Reports"
          tooltipPosition="bottom"
          routerLink="/reports"
        />

        <p-button
          icon="pi pi-box"
          [text]="true"
          pTooltip="Plan Dependencies"
          tooltipPosition="bottom"
          (onClick)="onDependencies()"
        />

        <p-button
          icon="pi pi-download"
          [text]="true"
          pTooltip="Import HOCON"
          tooltipPosition="bottom"
          (onClick)="onImport()"
        />

        <p-button
          icon="pi pi-upload"
          [text]="true"
          pTooltip="Export HOCON"
          tooltipPosition="bottom"
          (onClick)="onExport()"
        />

        <div class="toolbar__divider"></div>

        <p-button
          [icon]="themeService.isDark() ? 'pi pi-sun' : 'pi pi-moon'"
          [text]="true"
          [pTooltip]="themeService.isDark() ? 'Switch to Light Mode' : 'Switch to Dark Mode'"
          tooltipPosition="bottom"
          (onClick)="onToggleTheme()"
        />

        <p-button
          icon="pi pi-cog"
          [text]="true"
          pTooltip="Settings"
          tooltipPosition="bottom"
          (onClick)="onSettings()"
        />
      </div>
    </div>

    <!-- New Plan Dialog -->
    <p-dialog
      header="Create New Test Plan"
      [(visible)]="showNewPlanDialog"
      [modal]="true"
      [style]="{ width: '400px' }"
      [draggable]="false"
      [resizable]="false"
    >
      <div class="new-plan-form">
        <div class="form-field">
          <label for="planName">Name</label>
          <input
            id="planName"
            type="text"
            pInputText
            [(ngModel)]="newPlanName"
            placeholder="Enter plan name"
            class="w-full"
          />
        </div>
        <div class="form-field">
          <label for="planDescription">Description</label>
          <input
            id="planDescription"
            type="text"
            pInputText
            [(ngModel)]="newPlanDescription"
            placeholder="Optional description"
            class="w-full"
          />
        </div>
        <div class="form-actions">
          <p-button
            label="Cancel"
            [text]="true"
            (onClick)="showNewPlanDialog = false"
          />
          <p-button
            label="Create"
            icon="pi pi-plus"
            [disabled]="!newPlanName"
            (onClick)="createPlan()"
          />
        </div>
      </div>
    </p-dialog>
  `,
  styles: [`
    .toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 100%;
      padding: 0 var(--tc-spacing-md);
      gap: var(--tc-spacing-md);
    }

    .toolbar__left,
    .toolbar__center,
    .toolbar__right {
      display: flex;
      align-items: center;
      gap: var(--tc-spacing-xs);
    }

    .toolbar__logo {
      display: flex;
      align-items: center;
      gap: var(--tc-spacing-sm);
    }

    .toolbar__title {
      font-weight: 600;
      font-size: 16px;
      color: var(--tc-text-primary);
    }

    .toolbar__divider {
      width: 1px;
      height: 24px;
      background: var(--tc-border);
      margin: 0 var(--tc-spacing-sm);
    }

    :host ::ng-deep .toolbar__plan-selector {
      min-width: 200px;
    }

    .plan-option {
      display: flex;
      align-items: center;
      gap: var(--tc-spacing-sm);
    }

    .plan-option__dirty {
      color: var(--tc-warning);
      font-weight: bold;
    }

    .plan-option__status {
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 4px;
      text-transform: uppercase;
      margin-left: auto;
    }

    .plan-option__status--draft {
      background: var(--tc-bg-tertiary);
      color: var(--tc-text-secondary);
    }

    .plan-option__status--ready {
      background: rgba(34, 197, 94, 0.1);
      color: var(--tc-success);
    }

    .plan-option__status--running {
      background: rgba(99, 102, 241, 0.1);
      color: var(--tc-primary);
    }

    .new-plan-form {
      display: flex;
      flex-direction: column;
      gap: var(--tc-spacing-md);
    }

    .form-field {
      display: flex;
      flex-direction: column;
      gap: var(--tc-spacing-xs);
    }

    .form-field label {
      font-size: 13px;
      color: var(--tc-text-secondary);
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--tc-spacing-sm);
      margin-top: var(--tc-spacing-md);
      padding-top: var(--tc-spacing-md);
      border-top: 1px solid var(--tc-border);
    }

    .w-full {
      width: 100%;
    }
  `]
})
export class TopToolbarComponent {
  protected readonly planStore = inject(TestPlanStore);
  protected readonly executionStore = inject(ExecutionStore);
  readonly themeService = inject(ThemeService);

  @Output() importRequested = new EventEmitter<void>();
  @Output() exportRequested = new EventEmitter<void>();
  @Output() settingsRequested = new EventEmitter<void>();
  @Output() dependenciesRequested = new EventEmitter<void>();

  showNewPlanDialog = false;
  newPlanName = '';
  newPlanDescription = '';

  readonly selectedPlan = signal<TestPlan | null>(null);

  private static readonly LAST_PLAN_KEY = 'testcraft-last-plan-id';

  constructor() {
    this.planStore.loadPlans().then(() => {
      const plans = this.planStore.plans();
      if (plans.length > 0) {
        // Try to restore last opened plan
        const lastPlanId = localStorage.getItem(TopToolbarComponent.LAST_PLAN_KEY);
        const lastPlan = lastPlanId ? plans.find(p => p.id === lastPlanId) : null;
        this.onPlanSelect(lastPlan || plans[0]);
      }
    });
  }

  async onPlanSelect(plan: TestPlan | null): Promise<void> {
    // Auto-save current plan before switching
    const currentPlan = this.planStore.plan();
    const isDirty = this.planStore.isDirty();
    console.log('[TopToolbar] onPlanSelect called', {
      currentPlanId: currentPlan?.id,
      currentPlanName: currentPlan?.name,
      newPlanId: plan?.id,
      newPlanName: plan?.name,
      isDirty,
    });

    if (isDirty) {
      console.log('[TopToolbar] Auto-saving dirty plan before switch...');
      await this.planStore.savePlan();
      console.log('[TopToolbar] Auto-save complete');
    }

    this.selectedPlan.set(plan);
    if (plan) {
      // Remember last opened plan
      localStorage.setItem(TopToolbarComponent.LAST_PLAN_KEY, plan.id);
      await this.planStore.loadPlan(plan.id);
    }
  }

  async onSave(): Promise<void> {
    await this.planStore.savePlan();
  }

  onRun(): void {
    this.executionStore.execute();
  }

  onPause(): void {
    this.executionStore.pause();
  }

  onStop(): void {
    this.executionStore.stop();
  }

  onImport(): void {
    this.importRequested.emit();
  }

  onExport(): void {
    this.exportRequested.emit();
  }

  onSettings(): void {
    this.settingsRequested.emit();
  }

  onToggleTheme(): void {
    this.themeService.toggle();
  }

  onDependencies(): void {
    this.dependenciesRequested.emit();
  }

  async createPlan(): Promise<void> {
    if (!this.newPlanName) return;

    const planId = await this.planStore.createPlan(this.newPlanName, this.newPlanDescription);
    this.showNewPlanDialog = false;
    this.newPlanName = '';
    this.newPlanDescription = '';

    const plans = this.planStore.plans();
    const newPlan = plans.find((p) => p.id === planId);
    if (newPlan) {
      this.selectedPlan.set(newPlan);
    }
  }
}
