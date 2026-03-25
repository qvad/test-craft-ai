import { Injectable, signal } from '@angular/core';

/**
 * A correction made by the user to an AI suggestion.
 */
export interface Correction {
  id: string;
  nodeType: string;
  fieldKey: string;
  originalValue: string;
  correctedValue: string;
  context?: string; // e.g., intent that was used
  timestamp: number;
}

const STORAGE_KEY = 'testcraft_ai_corrections';
const MAX_CORRECTIONS = 100; // Keep last 100 corrections

/**
 * Service that remembers user corrections to AI suggestions.
 * These corrections are used to improve future AI suggestions.
 *
 * @example
 * ```typescript
 * // Record a correction
 * correctionMemory.addCorrection({
 *   nodeType: 'http-request',
 *   fieldKey: 'path',
 *   originalValue: '/api/v1/users',
 *   correctedValue: '/api/users'
 * });
 *
 * // Get corrections for prompt context
 * const context = correctionMemory.getCorrectionsContext('http-request');
 * ```
 */
@Injectable({
  providedIn: 'root'
})
export class CorrectionMemoryService {
  private readonly _corrections = signal<Correction[]>([]);
  readonly corrections = this._corrections.asReadonly();

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Add a correction when user edits an AI suggestion.
   */
  addCorrection(correction: Omit<Correction, 'id' | 'timestamp'>): void {
    const newCorrection: Correction = {
      ...correction,
      id: crypto.randomUUID(),
      timestamp: Date.now()
    };

    const corrections = [...this._corrections(), newCorrection];

    // Keep only the most recent corrections
    const trimmed = corrections.slice(-MAX_CORRECTIONS);

    this._corrections.set(trimmed);
    this.saveToStorage();
  }

  /**
   * Get corrections for a specific node type.
   */
  getCorrections(nodeType: string): Correction[] {
    return this._corrections().filter(c => c.nodeType === nodeType);
  }

  /**
   * Get corrections formatted as context for AI prompts.
   */
  getCorrectionsContext(nodeType: string): string {
    const corrections = this.getCorrections(nodeType);
    if (corrections.length === 0) return '';

    const lines = corrections.map(c =>
      `- Field "${c.fieldKey}": AI suggested "${c.originalValue}" → User corrected to "${c.correctedValue}"`
    );

    return `
## Previous User Corrections (Learn from these!)
The user has previously corrected these AI suggestions. Use this feedback to improve your suggestions:
${lines.join('\n')}
`;
  }

  /**
   * Get all unique corrections as a map for quick lookup.
   * More recent corrections override older ones for the same field.
   */
  getCorrectionMap(nodeType: string): Map<string, { original: string; corrected: string }> {
    const corrections = this.getCorrections(nodeType);
    const map = new Map<string, { original: string; corrected: string }>();

    // Process in order so newer corrections override older ones
    for (const c of corrections) {
      map.set(`${c.fieldKey}:${c.originalValue}`, {
        original: c.originalValue,
        corrected: c.correctedValue
      });
    }

    return map;
  }

  /**
   * Clear all corrections.
   */
  clearAll(): void {
    this._corrections.set([]);
    this.saveToStorage();
  }

  /**
   * Clear corrections for a specific node type.
   */
  clearForNodeType(nodeType: string): void {
    const filtered = this._corrections().filter(c => c.nodeType !== nodeType);
    this._corrections.set(filtered);
    this.saveToStorage();
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const corrections = JSON.parse(stored) as Correction[];
        this._corrections.set(corrections);
      }
    } catch {
      // Ignore storage errors
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._corrections()));
    } catch {
      // Ignore storage errors
    }
  }
}
