import { Injectable, inject, signal } from '@angular/core';
import { NodeType, NodeConfig } from '../../../shared/models';
import { Variable } from '../../../shared/models';
import { FieldMetadataService, FieldMetadata } from './field-metadata.service';
import { AIApiService, AIApiError } from './ai-api.service';
import { NodeRegistryService } from '../node-registry.service';
import { CorrectionMemoryService } from './correction-memory.service';
import { AUTO_FILL_SYSTEM_PROMPT, buildAutoFillUserPrompt, PrecedingNodeSummary } from '../../../shared/config/ai-prompts';

/**
 * Request for AI Auto-Fill generation.
 */
export interface AutoFillRequest {
  /** User's natural language description of what they want */
  intent: string;
  /** The type of node being configured */
  nodeType: NodeType;
  /** Available context variables */
  contextVariables: Variable[];
  /** Current node configuration */
  currentConfig: Partial<NodeConfig>;
  /** Whether to preserve existing non-empty values */
  preserveExisting: boolean;
  /** Preceding nodes in the tree for context (executed before this node) */
  precedingNodes?: PrecedingNodeSummary[];
}

/**
 * A single field suggestion from AI.
 */
export interface FieldSuggestion {
  /** The field key (config property name) */
  fieldKey: string;
  /** The suggested value for this field */
  suggestedValue: unknown;
  /** Confidence score from 0 to 1 */
  confidence: number;
  /** Brief explanation of why this value was suggested */
  reasoning: string;
  /** Variables referenced in the suggested value */
  variablesUsed: string[];
  /** Whether this would overwrite an existing value */
  isOverwrite: boolean;
  /** Whether this suggestion is selected for application */
  selected: boolean;
  /** Field metadata for display purposes */
  fieldMetadata?: FieldMetadata;
}

/**
 * Response from AI Auto-Fill generation.
 */
export interface AutoFillResponse {
  /** List of field suggestions */
  suggestions: FieldSuggestion[];
  /** Overall confidence in the suggestions (0-1) */
  overallConfidence: number;
  /** Warnings about the generated configuration */
  warnings: string[];
  /** Variables that were referenced but not defined */
  missingVariables: string[];
}

/**
 * Raw response structure from Claude API.
 */
interface RawAutoFillResponse {
  suggestions: {
    fieldKey: string;
    suggestedValue: unknown;
    confidence: number;
    reasoning: string;
    variablesUsed?: string[];
  }[];
  overallConfidence: number;
  warnings?: string[];
  missingVariables?: string[];
}

/**
 * Service for AI-powered auto-filling of node configurations.
 *
 * @description
 * The AutoFillService orchestrates the AI Auto-Fill feature by:
 * - Building prompts with context and field metadata
 * - Calling Claude API via the proxy service
 * - Parsing and validating AI responses
 * - Enriching suggestions with metadata
 *
 * @example
 * ```typescript
 * const autoFill = inject(AutoFillService);
 *
 * const response = await autoFill.generateSuggestions({
 *   intent: 'Test login API with invalid credentials',
 *   nodeType: 'http-request',
 *   contextVariables: [],
 *   currentConfig: {},
 *   preserveExisting: false
 * });
 *
 * // Apply selected suggestions
 * const selectedValues = autoFill.getSelectedValues(response.suggestions);
 * ```
 */
@Injectable({
  providedIn: 'root'
})
export class AutoFillService {
  private readonly fieldMetadata = inject(FieldMetadataService);
  private readonly aiApi = inject(AIApiService);
  private readonly nodeRegistry = inject(NodeRegistryService);
  private readonly correctionMemory = inject(CorrectionMemoryService);

  /** Whether a generation is in progress */
  private readonly _isGenerating = signal(false);
  readonly isGenerating = this._isGenerating.asReadonly();

  /** The last error that occurred */
  private readonly _lastError = signal<string | null>(null);
  readonly lastError = this._lastError.asReadonly();

  /**
   * Generates AI suggestions for node configuration fields.
   *
   * @param request - The auto-fill request parameters
   * @returns Auto-fill response with suggestions
   * @throws Error if generation fails
   */
  async generateSuggestions(request: AutoFillRequest): Promise<AutoFillResponse> {
    this._isGenerating.set(true);
    this._lastError.set(null);

    try {
      // Get field metadata for this node type
      const fields = this.fieldMetadata.getFields(request.nodeType);

      // Get node type label
      const nodeMetadata = this.nodeRegistry.get(request.nodeType);
      const nodeTypeLabel = nodeMetadata?.label || request.nodeType;

      // Build the prompt
      const userPrompt = buildAutoFillUserPrompt(
        request.nodeType,
        nodeTypeLabel,
        request.intent,
        fields,
        request.contextVariables,
        request.currentConfig as Record<string, unknown>,
        request.preserveExisting,
        request.precedingNodes
      );

      // Add corrections context if available
      const correctionsContext = this.correctionMemory.getCorrectionsContext(request.nodeType);
      const fullPrompt = correctionsContext
        ? `${userPrompt}\n\n${correctionsContext}`
        : userPrompt;

      // Call AI API (provider determined by settings)
      const rawResponse = await this.aiApi.completeJson<RawAutoFillResponse>({
        system: AUTO_FILL_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: fullPrompt }],
        temperature: 0.3,
        max_tokens: 4096
      });

      // Process and validate the response
      return this.processResponse(rawResponse, fields, request.currentConfig as Record<string, unknown>);
    } catch (error) {
      const errorMessage = this.getErrorMessage(error);
      this._lastError.set(errorMessage);
      throw new Error(errorMessage);
    } finally {
      this._isGenerating.set(false);
    }
  }

  /**
   * Gets configuration values from selected suggestions.
   *
   * @param suggestions - Array of suggestions with selected state
   * @returns Object with field keys and values for selected suggestions
   */
  getSelectedValues(suggestions: FieldSuggestion[]): Partial<NodeConfig> {
    const values: Record<string, unknown> = {};

    suggestions
      .filter((s) => s.selected)
      .forEach((s) => {
        values[s.fieldKey] = s.suggestedValue;
      });

    return values as Partial<NodeConfig>;
  }

  /**
   * Toggles the selected state of a suggestion.
   *
   * @param suggestions - Array of suggestions
   * @param fieldKey - The field key to toggle
   * @returns Updated suggestions array
   */
  toggleSuggestion(suggestions: FieldSuggestion[], fieldKey: string): FieldSuggestion[] {
    return suggestions.map((s) =>
      s.fieldKey === fieldKey ? { ...s, selected: !s.selected } : s
    );
  }

  /**
   * Selects or deselects all suggestions.
   *
   * @param suggestions - Array of suggestions
   * @param selected - Whether to select or deselect
   * @returns Updated suggestions array
   */
  setAllSelected(suggestions: FieldSuggestion[], selected: boolean): FieldSuggestion[] {
    return suggestions.map((s) => ({ ...s, selected }));
  }

  /**
   * Updates the value of a suggestion.
   *
   * @param suggestions - Array of suggestions
   * @param fieldKey - The field key to update
   * @param newValue - The new value
   * @returns Updated suggestions array
   */
  updateSuggestionValue(
    suggestions: FieldSuggestion[],
    fieldKey: string,
    newValue: unknown
  ): FieldSuggestion[] {
    return suggestions.map((s) =>
      s.fieldKey === fieldKey ? { ...s, suggestedValue: newValue } : s
    );
  }

  /**
   * Clears the last error.
   */
  clearError(): void {
    this._lastError.set(null);
  }

  /**
   * Processes the raw AI response into structured suggestions.
   */
  private processResponse(
    raw: RawAutoFillResponse,
    fields: FieldMetadata[],
    currentConfig: Record<string, unknown>
  ): AutoFillResponse {
    const fieldMap = new Map(fields.map((f) => [f.key, f]));

    const suggestions: FieldSuggestion[] = raw.suggestions
      .filter((s) => s.fieldKey && fieldMap.has(s.fieldKey))
      .map((s) => {
        const fieldMeta = fieldMap.get(s.fieldKey)!;
        const currentValue = currentConfig[s.fieldKey];
        const hasExistingValue = currentValue !== undefined && currentValue !== null && currentValue !== '';

        // Validate and coerce the value
        const validatedValue = this.validateFieldValue(s.suggestedValue, fieldMeta);

        return {
          fieldKey: s.fieldKey,
          suggestedValue: validatedValue,
          confidence: Math.max(0, Math.min(1, s.confidence)),
          reasoning: s.reasoning || 'No reasoning provided',
          variablesUsed: s.variablesUsed || [],
          isOverwrite: hasExistingValue,
          selected: !hasExistingValue || s.confidence >= 0.8, // Auto-select non-overwrite or high confidence
          fieldMetadata: fieldMeta
        };
      });

    return {
      suggestions,
      overallConfidence: Math.max(0, Math.min(1, raw.overallConfidence)),
      warnings: raw.warnings || [],
      missingVariables: raw.missingVariables || []
    };
  }

  /**
   * Validates and coerces a field value to the correct type.
   */
  private validateFieldValue(value: unknown, field: FieldMetadata): unknown {
    if (value === null || value === undefined) {
      return field.defaultValue;
    }

    switch (field.dataType) {
      case 'string':
      case 'code':
        return String(value);

      case 'number':
        const num = Number(value);
        return isNaN(num) ? (field.defaultValue ?? 0) : num;

      case 'boolean':
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') return value.toLowerCase() === 'true';
        return Boolean(value);

      case 'enum':
        if (field.allowedValues && !field.allowedValues.includes(String(value))) {
          return field.defaultValue ?? field.allowedValues[0];
        }
        return value;

      case 'json':
        if (typeof value === 'string') return value;
        try {
          return JSON.stringify(value, null, 2);
        } catch {
          return field.defaultValue ?? '{}';
        }

      case 'array':
        if (Array.isArray(value)) return value;
        if (typeof value === 'string') {
          return value.split(',').map((s) => s.trim()).filter(Boolean);
        }
        return field.defaultValue ?? [];

      case 'object':
        if (typeof value === 'object' && value !== null) return value;
        if (typeof value === 'string') {
          try {
            return JSON.parse(value);
          } catch {
            return field.defaultValue ?? {};
          }
        }
        return field.defaultValue ?? {};

      default:
        return value;
    }
  }

  /**
   * Extracts error message from various error types.
   */
  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'object' && error !== null) {
      const apiError = error as AIApiError;
      if (apiError.message) {
        return apiError.message;
      }
    }

    return 'An unexpected error occurred while generating suggestions';
  }
}
