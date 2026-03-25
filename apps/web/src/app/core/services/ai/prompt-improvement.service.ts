import { Injectable, inject, signal } from '@angular/core';
import { Variable } from '../../../shared/models';

/**
 * Result of prompt improvement including suggestions.
 */
export interface ImprovedPrompt {
  /** The original user-provided prompt */
  original: string;
  /** The enhanced prompt with added context and clarity */
  improved: string;
  /** Suggestions for further improvement */
  suggestions: string[];
  /** Names of context variables that were incorporated */
  contextUsed: string[];
}

/**
 * Service for improving AI prompts using context awareness and best practices.
 * Enhances natural language instructions to be more specific and actionable.
 *
 * @description
 * The PromptImprovementService:
 * - Adds context variable awareness to prompts
 * - Makes vague instructions more explicit
 * - Provides node-type specific enhancements
 * - Validates variable references
 * - Generates improvement suggestions
 *
 * @example
 * ```typescript
 * const promptService = inject(PromptImprovementService);
 *
 * const result = await promptService.improvePrompt(
 *   'Send a request to get users',
 *   [{ name: 'BASE_URL', value: 'https://api.example.com', ... }],
 *   'http-request'
 * );
 *
 * console.log(result.improved);
 * // "Given the context variables: ${BASE_URL}
 * //  For an HTTP request: construct and transmit a request to retrieve and store users
 * //  Handle the response appropriately and extract relevant data."
 * ```
 */
@Injectable({
  providedIn: 'root'
})
export class PromptImprovementService {
  private readonly _isImproving = signal(false);

  /** Whether a prompt improvement is in progress */
  readonly isImproving = this._isImproving.asReadonly();

  /**
   * Improves a prompt by adding context and making instructions explicit.
   * @param intent - The original user prompt
   * @param contextVariables - Available variables for context
   * @param nodeType - The type of node for specific enhancements
   * @returns Enhanced prompt with suggestions
   */
  async improvePrompt(
    intent: string,
    contextVariables: Variable[],
    nodeType: string
  ): Promise<ImprovedPrompt> {
    this._isImproving.set(true);

    try {
      // In a real implementation, this would call an AI service
      // For now, we'll simulate the improvement with templates
      const improved = this.generateImprovedPrompt(intent, contextVariables, nodeType);
      const suggestions = this.generateSuggestions(intent, nodeType);
      const contextUsed = contextVariables
        .filter((v) => intent.includes(v.name) || improved.includes(v.name))
        .map((v) => v.name);

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      return {
        original: intent,
        improved,
        suggestions,
        contextUsed
      };
    } finally {
      this._isImproving.set(false);
    }
  }

  /**
   * Generates an improved version of the prompt with added context.
   */
  private generateImprovedPrompt(
    intent: string,
    contextVariables: Variable[],
    nodeType: string
  ): string {
    let improved = intent;

    // Add context awareness
    if (contextVariables.length > 0) {
      const varNames = contextVariables.map((v) => `\${${v.name}}`).join(', ');
      improved = `Given the context variables: ${varNames}\n\n${improved}`;
    }

    // Add node-type specific context
    switch (nodeType) {
      case 'http-request':
        if (!improved.toLowerCase().includes('http') && !improved.toLowerCase().includes('request')) {
          improved = `For an HTTP request: ${improved}`;
        }
        if (!improved.toLowerCase().includes('response')) {
          improved += '\n\nHandle the response appropriately and extract relevant data.';
        }
        break;

      case 'jdbc-request':
        if (!improved.toLowerCase().includes('database') && !improved.toLowerCase().includes('sql')) {
          improved = `For a database operation: ${improved}`;
        }
        improved += '\n\nEnsure proper parameterization to prevent SQL injection.';
        break;

      case 'script':
        improved += '\n\nInclude proper error handling and logging.';
        break;

      case 'ai-task':
        improved += '\n\nProvide a clear and structured response that can be parsed programmatically.';
        break;

      case 'lm-studio':
        improved += '\n\nFormat the response as JSON when possible for easier extraction.';
        break;

      case 'poe-ai':
        improved += '\n\nKeep the response concise and actionable.';
        break;

      case 'docker-run':
        if (!improved.toLowerCase().includes('container')) {
          improved = `For Docker container execution: ${improved}`;
        }
        improved += '\n\nEnsure proper cleanup of resources after execution.';
        break;

      case 'k8s-deploy':
        if (!improved.toLowerCase().includes('kubernetes') && !improved.toLowerCase().includes('k8s')) {
          improved = `For Kubernetes deployment: ${improved}`;
        }
        improved += '\n\nVerify deployment status and handle rollback if needed.';
        break;
    }

    // Make instructions more explicit
    improved = this.makeInstructionsExplicit(improved);

    return improved;
  }

  /**
   * Replaces vague terms with more specific instructions.
   */
  private makeInstructionsExplicit(text: string): string {
    // Replace vague terms with more specific ones
    const replacements: Record<string, string> = {
      'do something': 'perform the following specific action',
      'handle it': 'process and validate the result',
      'check if': 'verify that the following condition is met:',
      'make sure': 'validate and ensure that',
      'get the': 'retrieve and store the',
      'send': 'construct and transmit',
      'process': 'parse, validate, and transform'
    };

    let result = text;
    Object.entries(replacements).forEach(([vague, specific]) => {
      const regex = new RegExp(vague, 'gi');
      result = result.replace(regex, specific);
    });

    return result;
  }

  /**
   * Generates suggestions for improving the prompt.
   */
  private generateSuggestions(intent: string, nodeType: string): string[] {
    const suggestions: string[] = [];

    // Check for missing elements
    if (!intent.includes('${') && !intent.includes('$')) {
      suggestions.push('Consider using context variables (${variableName}) for dynamic values');
    }

    if (!intent.toLowerCase().includes('error') && !intent.toLowerCase().includes('fail')) {
      suggestions.push('Add error handling instructions for failure scenarios');
    }

    if (!intent.toLowerCase().includes('timeout')) {
      suggestions.push('Consider adding timeout specifications');
    }

    if (!intent.toLowerCase().includes('retry')) {
      suggestions.push('Consider adding retry logic for transient failures');
    }

    // Node-type specific suggestions
    switch (nodeType) {
      case 'http-request':
        if (!intent.toLowerCase().includes('header')) {
          suggestions.push('Specify required HTTP headers');
        }
        if (!intent.toLowerCase().includes('authentication') && !intent.toLowerCase().includes('auth')) {
          suggestions.push('Consider authentication requirements');
        }
        break;

      case 'jdbc-request':
        if (!intent.toLowerCase().includes('transaction')) {
          suggestions.push('Consider transaction boundaries');
        }
        break;

      case 'ai-task':
      case 'lm-studio':
      case 'poe-ai':
        if (!intent.toLowerCase().includes('format')) {
          suggestions.push('Specify the expected output format (JSON, plain text, etc.)');
        }
        break;

      case 'docker-run':
      case 'k8s-deploy':
        if (!intent.toLowerCase().includes('cleanup')) {
          suggestions.push('Consider cleanup and resource management');
        }
        break;
    }

    return suggestions.slice(0, 5);
  }

  /**
   * Formats a variable name as a reference string.
   * @param variableName - The variable name
   * @returns Formatted reference like ${variableName}
   */
  formatVariableReference(variableName: string): string {
    return `\${${variableName}}`;
  }

  /**
   * Extracts variable references from text.
   * @param text - Text to search for ${variableName} patterns
   * @returns Array of variable names found
   */
  extractVariableReferences(text: string): string[] {
    const regex = /\$\{([^}]+)\}/g;
    const matches: string[] = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      matches.push(match[1]);
    }
    return matches;
  }

  /**
   * Validates that all variable references in text exist.
   * @param text - Text containing variable references
   * @param availableVariables - List of defined variables
   * @returns Array of undefined variable names
   */
  validateVariableReferences(text: string, availableVariables: Variable[]): string[] {
    const references = this.extractVariableReferences(text);
    const availableNames = availableVariables.map((v) => v.name);
    return references.filter((ref) => !availableNames.includes(ref));
  }
}
