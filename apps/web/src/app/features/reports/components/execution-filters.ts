import { Component, inject, Output, EventEmitter, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Select } from 'primeng/select';
import { InputText } from 'primeng/inputtext';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { ReportsStore, ExecutionFilters } from '../../../core/services/state/reports.store';
import { TestPlanStore } from '../../../core/services/state';

interface StatusOption {
  label: string;
  value: string;
}

interface PlanOption {
  label: string;
  value: string;
}

@Component({
  selector: 'app-execution-filters',
  standalone: true,
  imports: [
    FormsModule,
    Select,
    InputText,
    Button,
    DatePicker
  ],
  template: `
    <div class="filters">
      <div class="filters__row">
        <div class="filter-group">
          <label>Plan</label>
          <p-select
            [options]="planOptions()"
            [(ngModel)]="selectedPlan"
            (ngModelChange)="onPlanChange($event)"
            placeholder="All Plans"
            styleClass="filter-select"
            [showClear]="true"
          />
        </div>

        <div class="filter-group">
          <label>Status</label>
          <p-select
            [options]="statusOptions"
            [(ngModel)]="selectedStatus"
            (ngModelChange)="onStatusChange($event)"
            placeholder="All Statuses"
            styleClass="filter-select"
          />
        </div>

        <div class="filter-group">
          <label>Date Range</label>
          <p-datepicker
            [(ngModel)]="dateRange"
            (ngModelChange)="onDateChange($event)"
            selectionMode="range"
            [showIcon]="true"
            placeholder="Select date range"
            dateFormat="yy-mm-dd"
            styleClass="filter-date"
          />
        </div>

        <div class="filter-group filter-group--search">
          <label>Search</label>
          <span class="p-input-icon-left">
            <i class="pi pi-search"></i>
            <input
              type="text"
              pInputText
              [(ngModel)]="searchQuery"
              (ngModelChange)="onSearchChange($event)"
              placeholder="Search by name or ID..."
              class="filter-search"
            />
          </span>
        </div>

        <div class="filter-group filter-group--actions">
          <p-button
            icon="pi pi-filter-slash"
            [text]="true"
            severity="secondary"
            pTooltip="Clear filters"
            (onClick)="onClearFilters()"
          />
          <p-button
            icon="pi pi-refresh"
            [text]="true"
            severity="secondary"
            pTooltip="Refresh"
            (onClick)="onRefresh()"
          />
        </div>
      </div>
    </div>
  `,
  styles: [`
    .filters {
      padding: var(--tc-spacing-md);
      background: var(--tc-bg-secondary);
      border-bottom: 1px solid var(--tc-border);
    }

    .filters__row {
      display: flex;
      align-items: flex-end;
      gap: var(--tc-spacing-md);
      flex-wrap: wrap;
    }

    .filter-group {
      display: flex;
      flex-direction: column;
      gap: var(--tc-spacing-xs);
    }

    .filter-group label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--tc-text-secondary);
    }

    .filter-group--search {
      flex: 1;
      min-width: 200px;
    }

    .filter-group--actions {
      flex-direction: row;
      align-items: center;
      margin-left: auto;
    }

    :host ::ng-deep .filter-select {
      min-width: 150px;
    }

    :host ::ng-deep .filter-date {
      min-width: 200px;
    }

    .filter-search {
      width: 100%;
    }

    .p-input-icon-left {
      width: 100%;
    }

    .p-input-icon-left i {
      color: var(--tc-text-muted);
    }
  `]
})
export class ExecutionFiltersComponent {
  private readonly reportsStore = inject(ReportsStore);
  private readonly planStore = inject(TestPlanStore);

  @Output() filtersChanged = new EventEmitter<ExecutionFilters>();
  @Output() refresh = new EventEmitter<void>();

  selectedPlan: PlanOption | null = null;
  selectedStatus: StatusOption | null = null;
  dateRange: Date[] | null = null;
  searchQuery = '';

  readonly statusOptions: StatusOption[] = [
    { label: 'All Statuses', value: 'all' },
    { label: 'Passed', value: 'success' },
    { label: 'Failed', value: 'failed' },
    { label: 'Error', value: 'error' },
  ];

  readonly planOptions = signal<PlanOption[]>([]);

  constructor() {
    // Load plans for filter dropdown
    this.planStore.loadPlans().then(() => {
      const plans = this.planStore.plans();
      this.planOptions.set([
        { label: 'All Plans', value: '' },
        ...plans.map(p => ({ label: p.name, value: p.id }))
      ]);
    });
  }

  onPlanChange(option: PlanOption | null): void {
    const planId = option?.value || undefined;
    this.reportsStore.setFilters({ planId });
    this.emitFilters();
  }

  onStatusChange(option: StatusOption | null): void {
    const status = option?.value as 'success' | 'failed' | 'error' | 'all' | undefined;
    this.reportsStore.setFilters({ status });
    this.emitFilters();
  }

  onDateChange(range: Date[] | null): void {
    const dateFrom = range?.[0];
    const dateTo = range?.[1];
    this.reportsStore.setFilters({ dateFrom, dateTo });
    this.emitFilters();
  }

  onSearchChange(query: string): void {
    this.reportsStore.setFilters({ searchQuery: query || undefined });
    this.emitFilters();
  }

  onClearFilters(): void {
    this.selectedPlan = null;
    this.selectedStatus = null;
    this.dateRange = null;
    this.searchQuery = '';
    this.reportsStore.clearFilters();
    this.emitFilters();
  }

  onRefresh(): void {
    this.refresh.emit();
  }

  private emitFilters(): void {
    this.filtersChanged.emit(this.reportsStore.filters());
  }
}
