import { Component, inject, signal, computed, input, output, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Dialog } from 'primeng/dialog';
import { Button } from 'primeng/button';
import { Textarea } from 'primeng/textarea';
import { Checkbox } from 'primeng/checkbox';
import { ProgressBar } from 'primeng/progressbar';
import { Tooltip } from 'primeng/tooltip';
import { Chip } from 'primeng/chip';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { AutoFillService, AutoFillResponse, FieldSuggestion } from '../../../../core/services/ai/auto-fill.service';
import { CorrectionMemoryService } from '../../../../core/services/ai/correction-memory.service';
import { TestPlanStore } from '../../../../core/services/state';
import { TreeSelectionStore } from '../../../../core/services/state/tree-selection.store';
import { NodeType, NodeConfig, TreeNode } from '../../../../shared/models';
import { extractNodeSummary, PrecedingNodeSummary } from '../../../../shared/config/ai-prompts';

/**
 * Event emitted when suggestions are applied.
 */
export interface ApplyEvent {
  values: Partial<NodeConfig>;
}

/**
 * Dialog component for AI Auto-Fill feature.
 *
 * @description
 * Provides a validation-mode interface where users can:
 * - Enter natural language description of what they want to test
 * - Review AI-generated field suggestions
 * - Edit individual suggestions
 * - Select which suggestions to apply
 * - Apply selected suggestions to the node configuration
 */
@Component({
  selector: 'app-auto-fill-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    Dialog,
    Button,
    Textarea,
    Checkbox,
    ProgressBar,
    Tooltip,
    Chip,
    InputText,
    Message
  ],
  template: `
    <p-dialog
      [header]="'AI Auto-Fill: ' + nodeType()"
      [(visible)]="dialogVisible"
      [modal]="true"
      [style]="{ width: '600px', maxHeight: '85vh' }"
      [draggable]="false"
      [resizable]="false"
      [closeOnEscape]="!autoFillService.isGenerating()"
      [closable]="!autoFillService.isGenerating()"
      styleClass="auto-fill-dialog"
    >
      <!-- Intent Input Section -->
      <div class="intent-section">
        <label class="section-label">What do you want to test?</label>
        <textarea
          pTextarea
          [(ngModel)]="intent"
          [rows]="3"
          placeholder="e.g., Test login API with invalid credentials and verify 401 response"
          [disabled]="autoFillService.isGenerating()"
          class="intent-textarea"
        ></textarea>

        <div class="intent-actions">
          <div class="preserve-toggle">
            <p-checkbox
              [(ngModel)]="preserveExisting"
              [binary]="true"
              inputId="preserveExisting"
              [disabled]="autoFillService.isGenerating()"
            />
            <label for="preserveExisting">Keep existing values</label>
          </div>

          <p-button
            icon="pi pi-sync"
            label="Generate"
            [loading]="autoFillService.isGenerating()"
            [disabled]="!intent.trim()"
            (onClick)="generate()"
          />
        </div>

        <!-- Context Variables -->
        @if (contextVariables().length > 0) {
          <div class="context-vars">
            <span class="context-vars__label">Available variables:</span>
            <div class="context-vars__list">
              @for (variable of contextVariables(); track variable.id) {
                <p-chip
                  [label]="variable.name"
                  styleClass="var-chip"
                  pTooltip="\${{'{'}}{{variable.name}}{{'}'}} - {{variable.description || variable.type}}"
                />
              }
            </div>
          </div>
        }
      </div>

      <!-- Error Message -->
      @if (autoFillService.lastError()) {
        <p-message
          severity="error"
          [text]="autoFillService.lastError()!"
          styleClass="error-message"
        />
      }

      <!-- Results Section -->
      @if (response()) {
        <div class="results-section">
          <!-- Confidence Bar -->
          <div class="confidence-section">
            <div class="confidence-header">
              <span class="confidence-label">Overall Confidence</span>
              <span class="confidence-value" [class]="getConfidenceClass(response()!.overallConfidence)">
                {{ (response()!.overallConfidence * 100).toFixed(0) }}%
              </span>
            </div>
            <p-progressBar
              [value]="response()!.overallConfidence * 100"
              [showValue]="false"
              [style]="{ height: '8px' }"
              [styleClass]="getConfidenceClass(response()!.overallConfidence)"
            />
          </div>

          <!-- Warnings -->
          @if (response()!.warnings.length > 0) {
            <div class="warnings-section">
              @for (warning of response()!.warnings; track $index) {
                <p-message severity="warn" [text]="warning" />
              }
            </div>
          }

          <!-- Missing Variables -->
          @if (response()!.missingVariables.length > 0) {
            <div class="missing-vars-section">
              <p-message
                severity="info"
                text="Variables referenced but not defined: {{response()!.missingVariables.join(', ')}}"
              />
            </div>
          }

          <!-- Suggestions List -->
          <div class="suggestions-section">
            <div class="suggestions-header">
              <span>Field Suggestions ({{ selectedCount() }}/{{ response()!.suggestions.length }} selected)</span>
              <p-button
                [label]="allSelected() ? 'Deselect All' : 'Select All'"
                [text]="true"
                size="small"
                (onClick)="toggleSelectAll()"
              />
            </div>

            <div class="suggestions-list">
              @for (suggestion of response()!.suggestions; track suggestion.fieldKey) {
                <div
                  class="suggestion-item"
                  [class.suggestion-item--selected]="suggestion.selected"
                  [class.suggestion-item--overwrite]="suggestion.isOverwrite"
                >
                  <div class="suggestion-item__header">
                    <p-checkbox
                      [(ngModel)]="suggestion.selected"
                      [binary]="true"
                      [inputId]="'sugg_' + suggestion.fieldKey"
                    />
                    <label [for]="'sugg_' + suggestion.fieldKey" class="suggestion-item__label">
                      {{ suggestion.fieldMetadata?.label || suggestion.fieldKey }}
                    </label>
                    <span
                      class="suggestion-item__confidence"
                      [class]="getConfidenceClass(suggestion.confidence)"
                      pTooltip="Confidence: {{(suggestion.confidence * 100).toFixed(0)}}%"
                    >
                      {{ (suggestion.confidence * 100).toFixed(0) }}%
                    </span>
                    @if (suggestion.isOverwrite) {
                      <span class="suggestion-item__overwrite-badge" pTooltip="Will overwrite existing value">
                        <i class="pi pi-exclamation-triangle"></i>
                      </span>
                    }
                  </div>

                  <div class="suggestion-item__value">
                    @if (editingField() === suggestion.fieldKey) {
                      <input
                        type="text"
                        pInputText
                        [ngModel]="getDisplayValue(suggestion.suggestedValue)"
                        (ngModelChange)="updateValue(suggestion.fieldKey, $event)"
                        (blur)="stopEditing()"
                        (keyup.enter)="stopEditing()"
                        (keyup.escape)="stopEditing()"
                        class="suggestion-item__edit-input"
                        #editInput
                      />
                    } @else {
                      <code class="suggestion-item__code" (click)="startEditing(suggestion.fieldKey)">
                        {{ getDisplayValue(suggestion.suggestedValue) }}
                      </code>
                      <p-button
                        icon="pi pi-pencil"
                        [text]="true"
                        [rounded]="true"
                        size="small"
                        pTooltip="Edit value"
                        (onClick)="startEditing(suggestion.fieldKey)"
                      />
                    }
                  </div>

                  <div class="suggestion-item__reasoning">
                    <i class="pi pi-info-circle"></i>
                    {{ suggestion.reasoning }}
                  </div>

                  @if (suggestion.variablesUsed.length > 0) {
                    <div class="suggestion-item__variables">
                      @for (varName of suggestion.variablesUsed; track varName) {
                        <p-chip [label]="varName" styleClass="var-chip-small" />
                      }
                    </div>
                  }
                </div>
              }
            </div>
          </div>
        </div>
      }

      <!-- Footer Buttons -->
      <div class="dialog-footer">
        <p-button
          label="Cancel"
          severity="secondary"
          [text]="true"
          (onClick)="close()"
          [disabled]="autoFillService.isGenerating()"
        />
        @if (response()) {
          <p-button
            label="Apply Selected"
            icon="pi pi-check"
            [disabled]="selectedCount() === 0"
            (onClick)="applySelected()"
          />
        }
      </div>
    </p-dialog>
  `,
  styles: [`
    :host {
      display: contents;
    }

    :host ::ng-deep .auto-fill-dialog .p-dialog-content {
      padding: var(--tc-spacing-md);
      display: flex;
      flex-direction: column;
      gap: var(--tc-spacing-md);
      overflow-y: auto;
      max-height: calc(85vh - 120px);
    }

    :host ::ng-deep .auto-fill-dialog .p-dialog-header {
      padding: var(--tc-spacing-md);
      border-bottom: 1px solid var(--tc-border);
    }

    :host ::ng-deep .auto-fill-dialog .p-dialog-header .p-dialog-title {
      display: flex;
      align-items: center;
      gap: var(--tc-spacing-sm);
    }

    :host ::ng-deep .auto-fill-dialog .p-dialog-header .p-dialog-title::before {
      content: '✨';
    }

    .intent-section {
      display: flex;
      flex-direction: column;
      gap: var(--tc-spacing-sm);
    }

    .section-label {
      font-size: 13px;
      font-weight: 500;
      color: var(--tc-text-secondary);
    }

    .intent-textarea {
      width: 100%;
      resize: vertical;
    }

    .intent-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .preserve-toggle {
      display: flex;
      align-items: center;
      gap: var(--tc-spacing-sm);
    }

    .preserve-toggle label {
      font-size: 13px;
      color: var(--tc-text-secondary);
      cursor: pointer;
    }

    .context-vars {
      display: flex;
      flex-direction: column;
      gap: var(--tc-spacing-xs);
      padding: var(--tc-spacing-sm);
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--tc-border);
      border-radius: var(--tc-radius-sm);
    }

    .context-vars__label {
      font-size: 11px;
      color: var(--tc-text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .context-vars__list {
      display: flex;
      flex-wrap: wrap;
      gap: var(--tc-spacing-xs);
    }

    :host ::ng-deep .var-chip {
      font-size: 11px;
      background: rgba(99, 102, 241, 0.2) !important;
      border: 1px solid rgba(99, 102, 241, 0.4) !important;
      color: #a5b4fc !important;
    }

    :host ::ng-deep .var-chip .p-chip-label {
      font-family: monospace;
    }

    :host ::ng-deep .var-chip-small {
      font-size: 10px;
      padding: 2px 6px;
      background: rgba(99, 102, 241, 0.15) !important;
      border: 1px solid rgba(99, 102, 241, 0.3) !important;
      color: #a5b4fc !important;
    }

    :host ::ng-deep .var-chip-small .p-chip-label {
      font-family: monospace;
    }

    :host ::ng-deep .error-message {
      width: 100%;
    }

    .results-section {
      display: flex;
      flex-direction: column;
      gap: var(--tc-spacing-md);
    }

    .confidence-section {
      display: flex;
      flex-direction: column;
      gap: var(--tc-spacing-xs);
    }

    .confidence-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .confidence-label {
      font-size: 12px;
      color: var(--tc-text-secondary);
    }

    .confidence-value {
      font-size: 14px;
      font-weight: 600;
    }

    .confidence-value.high {
      color: var(--tc-success);
    }

    .confidence-value.medium {
      color: var(--tc-warning);
    }

    .confidence-value.low {
      color: var(--tc-danger);
    }

    :host ::ng-deep .p-progressbar.high .p-progressbar-value {
      background: var(--tc-success);
    }

    :host ::ng-deep .p-progressbar.medium .p-progressbar-value {
      background: var(--tc-warning);
    }

    :host ::ng-deep .p-progressbar.low .p-progressbar-value {
      background: var(--tc-danger);
    }

    .warnings-section,
    .missing-vars-section {
      display: flex;
      flex-direction: column;
      gap: var(--tc-spacing-xs);
    }

    .suggestions-section {
      display: flex;
      flex-direction: column;
      gap: var(--tc-spacing-sm);
    }

    .suggestions-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
      color: var(--tc-text-secondary);
    }

    .suggestions-list {
      display: flex;
      flex-direction: column;
      gap: var(--tc-spacing-sm);
    }

    .suggestion-item {
      display: flex;
      flex-direction: column;
      gap: var(--tc-spacing-xs);
      padding: var(--tc-spacing-sm);
      background: var(--tc-bg-tertiary);
      border-radius: var(--tc-radius-sm);
      border: 1px solid transparent;
      transition: all 0.15s ease;
    }

    .suggestion-item:hover {
      background: var(--tc-bg-secondary);
    }

    .suggestion-item--selected {
      border-color: var(--tc-primary);
      background: var(--tc-primary-soft);
    }

    .suggestion-item--overwrite {
      border-left: 3px solid var(--tc-warning);
    }

    .suggestion-item__header {
      display: flex;
      align-items: center;
      gap: var(--tc-spacing-sm);
    }

    .suggestion-item__label {
      flex: 1;
      font-size: 13px;
      font-weight: 500;
      color: var(--tc-text-primary);
      cursor: pointer;
    }

    .suggestion-item__confidence {
      font-size: 11px;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: var(--tc-radius-sm);
    }

    .suggestion-item__confidence.high {
      background: rgba(34, 197, 94, 0.15);
      color: var(--tc-success);
    }

    .suggestion-item__confidence.medium {
      background: rgba(245, 158, 11, 0.15);
      color: var(--tc-warning);
    }

    .suggestion-item__confidence.low {
      background: rgba(239, 68, 68, 0.15);
      color: var(--tc-danger);
    }

    .suggestion-item__overwrite-badge {
      color: var(--tc-warning);
      font-size: 12px;
    }

    .suggestion-item__value {
      display: flex;
      align-items: center;
      gap: var(--tc-spacing-xs);
      padding-left: calc(var(--tc-spacing-md) + 16px);
    }

    .suggestion-item__code {
      flex: 1;
      font-family: monospace;
      font-size: 12px;
      padding: var(--tc-spacing-xs) var(--tc-spacing-sm);
      background: var(--tc-bg-secondary);
      border-radius: var(--tc-radius-sm);
      color: var(--tc-primary);
      cursor: pointer;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 100%;
    }

    .suggestion-item__code:hover {
      background: var(--tc-bg-primary);
    }

    .suggestion-item__edit-input {
      flex: 1;
      font-family: monospace;
      font-size: 12px;
    }

    .suggestion-item__reasoning {
      display: flex;
      align-items: flex-start;
      gap: var(--tc-spacing-xs);
      padding-left: calc(var(--tc-spacing-md) + 16px);
      font-size: 11px;
      color: var(--tc-text-muted);
      font-style: italic;
    }

    .suggestion-item__reasoning i {
      margin-top: 2px;
      font-size: 10px;
    }

    .suggestion-item__variables {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      padding-left: calc(var(--tc-spacing-md) + 16px);
    }

    .dialog-footer {
      display: flex;
      justify-content: flex-end;
      gap: var(--tc-spacing-sm);
      padding-top: var(--tc-spacing-md);
      margin-top: var(--tc-spacing-md);
      border-top: 1px solid var(--tc-border);
      position: sticky;
      bottom: 0;
      background: var(--tc-bg-secondary);
    }
  `]
})
export class AutoFillDialogComponent {
  protected readonly autoFillService = inject(AutoFillService);
  protected readonly correctionMemory = inject(CorrectionMemoryService);
  protected readonly planStore = inject(TestPlanStore);
  protected readonly selectionStore = inject(TreeSelectionStore);

  /** Tracks original value when editing starts (for correction memory) */
  private editingOriginalValue: string | null = null;

  /** Whether the dialog is visible */
  visible = input<boolean>(false);

  /** The node type being configured */
  nodeType = input.required<NodeType>();

  /** The ID of the node being configured (for tree context) */
  nodeId = input<string>();

  /** Current node configuration */
  currentConfig = input<Partial<NodeConfig>>({});

  /** Event when visibility changes */
  visibleChange = output<boolean>();

  /** Event when suggestions are applied */
  apply = output<ApplyEvent>();

  /** Internal visibility state */
  protected dialogVisible = signal(false);

  /** User's intent description */
  protected intent = '';

  /** Whether to preserve existing values */
  protected preserveExisting = true;

  /** Current response from AI */
  protected response = signal<AutoFillResponse | null>(null);

  /** Field currently being edited */
  protected editingField = signal<string | null>(null);

  /** Context variables from the plan */
  protected contextVariables = computed(() => this.planStore.plan()?.variables || []);

  /** Number of selected suggestions */
  protected selectedCount = computed(() => {
    const resp = this.response();
    return resp ? resp.suggestions.filter((s) => s.selected).length : 0;
  });

  /** Whether all suggestions are selected */
  protected allSelected = computed(() => {
    const resp = this.response();
    return resp ? resp.suggestions.every((s) => s.selected) : false;
  });

  /** Track previous node type to detect changes */
  private previousNodeType: NodeType | null = null;

  constructor() {
    // Sync external visible input with internal state and reset on open
    effect(() => {
      const isVisible = this.visible();
      this.dialogVisible.set(isVisible);

      // Reset when dialog opens with a different node type
      if (isVisible) {
        const currentNodeType = this.nodeType();
        if (this.previousNodeType !== null && this.previousNodeType !== currentNodeType) {
          this.response.set(null);
          this.intent = '';
          this.autoFillService.clearError();
        }
        this.previousNodeType = currentNodeType;
      }
    }, { allowSignalWrites: true });

    // Emit visibility changes
    effect(() => {
      this.visibleChange.emit(this.dialogVisible());
    }, { allowSignalWrites: true });
  }

  /**
   * Generates AI suggestions based on the intent.
   */
  async generate(): Promise<void> {
    if (!this.intent.trim()) return;

    this.response.set(null);
    this.autoFillService.clearError();

    try {
      // Gather preceding nodes for tree context
      const precedingNodes = this.getPrecedingNodes();

      const result = await this.autoFillService.generateSuggestions({
        intent: this.intent,
        nodeType: this.nodeType(),
        contextVariables: this.contextVariables(),
        currentConfig: this.currentConfig(),
        preserveExisting: this.preserveExisting,
        precedingNodes
      });

      this.response.set(result);
    } catch {
      // Error is already set in the service
    }
  }

  /**
   * Gets immediate preceding nodes for context.
   * Keeps it lightweight by only including:
   * - Parent node (for structural context)
   * - Up to 5 preceding siblings (nodes executed right before this one)
   *
   * Context variables already capture extracted/defined values from all previous nodes,
   * so we only need immediate structural context here.
   */
  private getPrecedingNodes(): PrecedingNodeSummary[] {
    const currentNodeId = this.nodeId() || this.selectionStore.selectedNodeId();
    if (!currentNodeId) return [];

    const nodesMap = this.planStore.nodesMap();
    const currentNode = nodesMap.get(currentNodeId);
    if (!currentNode || !currentNode.parentId) return [];

    const result: PrecedingNodeSummary[] = [];
    const maxSiblings = 5;

    // Add parent node for structural context (if not root)
    const parent = nodesMap.get(currentNode.parentId);
    if (parent && parent.type !== 'root') {
      result.push(extractNodeSummary(parent));
    }

    // Add preceding siblings (up to maxSiblings)
    if (parent) {
      const siblings = parent.children
        .map(id => nodesMap.get(id))
        .filter((n): n is TreeNode => !!n)
        .sort((a, b) => a.order - b.order);

      const currentIndex = siblings.findIndex(s => s.id === currentNodeId);
      const startIndex = Math.max(0, currentIndex - maxSiblings);

      for (let i = startIndex; i < currentIndex; i++) {
        result.push(extractNodeSummary(siblings[i]));
      }
    }

    return result;
  }

  /**
   * Applies selected suggestions.
   */
  applySelected(): void {
    const resp = this.response();
    if (!resp) return;

    const values = this.autoFillService.getSelectedValues(resp.suggestions);
    this.apply.emit({ values });
    this.close();
  }

  /**
   * Closes the dialog.
   */
  close(): void {
    this.dialogVisible.set(false);
    this.reset();
  }

  /**
   * Resets the dialog state.
   */
  private reset(): void {
    this.intent = '';
    this.response.set(null);
    this.editingField.set(null);
    this.autoFillService.clearError();
  }

  /**
   * Toggles select all/deselect all.
   */
  toggleSelectAll(): void {
    const resp = this.response();
    if (!resp) return;

    const newSelected = !this.allSelected();
    const updated = this.autoFillService.setAllSelected(resp.suggestions, newSelected);
    this.response.set({ ...resp, suggestions: updated });
  }

  /**
   * Starts editing a field value.
   */
  startEditing(fieldKey: string): void {
    // Store the original value for correction tracking
    const resp = this.response();
    const suggestion = resp?.suggestions.find(s => s.fieldKey === fieldKey);
    this.editingOriginalValue = suggestion ? this.getDisplayValue(suggestion.suggestedValue) : null;
    this.editingField.set(fieldKey);
  }

  /**
   * Stops editing and records correction if value changed.
   */
  stopEditing(): void {
    const fieldKey = this.editingField();
    if (fieldKey && this.editingOriginalValue !== null) {
      const resp = this.response();
      const suggestion = resp?.suggestions.find(s => s.fieldKey === fieldKey);
      if (suggestion) {
        const newValue = this.getDisplayValue(suggestion.suggestedValue);
        // If the value changed, record the correction
        if (newValue !== this.editingOriginalValue) {
          this.correctionMemory.addCorrection({
            nodeType: this.nodeType(),
            fieldKey,
            originalValue: this.editingOriginalValue,
            correctedValue: newValue,
            context: this.intent
          });
        }
      }
    }
    this.editingOriginalValue = null;
    this.editingField.set(null);
  }

  /**
   * Updates a suggestion value.
   */
  updateValue(fieldKey: string, newValue: string): void {
    const resp = this.response();
    if (!resp) return;

    const updated = this.autoFillService.updateSuggestionValue(resp.suggestions, fieldKey, newValue);
    this.response.set({ ...resp, suggestions: updated });
  }

  /**
   * Gets a display-friendly value string.
   */
  getDisplayValue(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }
    return String(value);
  }

  /**
   * Gets CSS class for confidence level.
   */
  getConfidenceClass(confidence: number): string {
    if (confidence >= 0.8) return 'high';
    if (confidence >= 0.5) return 'medium';
    return 'low';
  }
}
