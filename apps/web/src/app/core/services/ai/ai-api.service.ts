import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, timeout, catchError, throwError } from 'rxjs';
import { SettingsService, AIProvider } from '../settings';

/**
 * Message structure for AI API requests (OpenAI-compatible format).
 */
export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Request payload for AI completion.
 */
export interface AICompletionRequest {
  messages: AIMessage[];
  system?: string;
  model?: string;
  max_tokens?: number;
  temperature?: number;
}

/**
 * Normalized response from any AI provider.
 */
export interface AICompletionResponse {
  text: string;
  model: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  provider: AIProvider;
}

/**
 * Error structure from AI API.
 */
export interface AIApiError {
  type: string;
  message: string;
  status?: number;
  provider: AIProvider;
}

/**
 * LM Studio/OpenAI-compatible response format.
 */
interface OpenAICompatibleResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Claude API response format.
 */
interface ClaudeResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{ type: 'text'; text: string }>;
  model: string;
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Ollama API response format.
 */
interface OllamaResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

/**
 * Service for making AI completion requests to multiple providers.
 *
 * @description
 * The AIApiService handles communication with various AI providers:
 * - LM Studio (default, OpenAI-compatible)
 * - Anthropic Claude (via backend proxy)
 * - OpenAI (via backend proxy)
 * - Ollama (local)
 *
 * The active provider is determined by the SettingsService.
 *
 * @example
 * ```typescript
 * const aiApi = inject(AIApiService);
 *
 * const response = await aiApi.complete({
 *   messages: [{ role: 'user', content: 'Generate field values...' }],
 *   system: 'You are a test configuration assistant...'
 * });
 *
 * console.log(response.text);
 * ```
 */
@Injectable({
  providedIn: 'root'
})
export class AIApiService {
  private readonly http = inject(HttpClient);
  private readonly settingsService = inject(SettingsService);

  /** Whether a request is currently in progress */
  private readonly _isLoading = signal(false);
  readonly isLoading = this._isLoading.asReadonly();

  /** The last error that occurred */
  private readonly _lastError = signal<AIApiError | null>(null);
  readonly lastError = this._lastError.asReadonly();

  /** Current active provider */
  readonly activeProvider = computed(() => this.settingsService.aiProvider());

  /** Whether the provider is properly configured */
  readonly isConfigured = computed(() => this.settingsService.isAIConfigured());

  /**
   * Sends a completion request to the configured AI provider.
   *
   * @param request - The completion request
   * @returns Normalized AI response
   * @throws AIApiError if the request fails
   */
  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    this._isLoading.set(true);
    this._lastError.set(null);

    const provider = this.settingsService.aiProvider();
    const config = this.settingsService.activeAIConfig();

    try {
      switch (config.type) {
        case 'lm-studio':
          return await this.completeLMStudio(request, config);
        case 'anthropic':
          return await this.completeAnthropic(request, config);
        case 'openai':
          return await this.completeOpenAI(request, config);
        case 'ollama':
          return await this.completeOllama(request, config);
        default:
          throw new Error(`Unknown AI provider: ${provider}`);
      }
    } catch (error) {
      if (this.isAIApiError(error)) {
        this._lastError.set(error);
        throw error;
      }
      const apiError = this.createError(error, provider);
      this._lastError.set(apiError);
      throw apiError;
    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * Sends a completion request and returns just the text response.
   */
  async completeText(request: AICompletionRequest): Promise<string> {
    const response = await this.complete(request);
    return response.text;
  }

  /**
   * Sends a completion request expecting JSON and parses the response.
   */
  async completeJson<T>(request: AICompletionRequest): Promise<T> {
    const text = await this.completeText(request);
    return this.parseJsonResponse<T>(text);
  }

  /**
   * Parses JSON from response text, handling markdown code blocks.
   */
  parseJsonResponse<T>(text: string): T {
    let jsonText = text.trim();

    // Handle ```json ... ``` blocks
    const jsonBlockMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonBlockMatch) {
      jsonText = jsonBlockMatch[1].trim();
    }

    // Handle standalone JSON
    const jsonStartIndex = jsonText.indexOf('{');
    const jsonEndIndex = jsonText.lastIndexOf('}');

    if (jsonStartIndex !== -1 && jsonEndIndex !== -1) {
      jsonText = jsonText.substring(jsonStartIndex, jsonEndIndex + 1);
    }

    try {
      return JSON.parse(jsonText) as T;
    } catch (error) {
      throw new Error(`Failed to parse JSON response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clears the last error.
   */
  clearError(): void {
    this._lastError.set(null);
  }

  /**
   * Completes via LM Studio (via backend proxy to avoid CORS).
   */
  private async completeLMStudio(
    request: AICompletionRequest,
    config: { endpoint: string; model: string; timeout: number; temperature: number; maxTokens: number }
  ): Promise<AICompletionResponse> {
    const messages = this.buildOpenAIMessages(request);

    // Use backend proxy to avoid CORS issues with local LM Studio
    const payload = {
      endpoint: config.endpoint, // Pass the LM Studio endpoint to the proxy
      model: request.model || config.model,
      messages,
      max_tokens: request.max_tokens || config.maxTokens,
      temperature: request.temperature ?? config.temperature,
      stream: false
    };

    const response = await firstValueFrom(
      this.http.post<OpenAICompatibleResponse>('/api/v1/ai/lm-studio/complete', payload).pipe(
        timeout(config.timeout),
        catchError((error: HttpErrorResponse) => this.handleHttpError(error, 'lm-studio'))
      )
    );

    return {
      text: response.choices[0]?.message?.content || '',
      model: response.model,
      usage: response.usage ? {
        inputTokens: response.usage.prompt_tokens,
        outputTokens: response.usage.completion_tokens
      } : undefined,
      provider: 'lm-studio'
    };
  }

  /**
   * Completes via Anthropic Claude (via backend proxy).
   */
  private async completeAnthropic(
    request: AICompletionRequest,
    config: { model: string; temperature: number; maxTokens: number }
  ): Promise<AICompletionResponse> {
    const messages = request.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    const payload = {
      model: request.model || config.model,
      messages,
      system: request.system || request.messages.find((m) => m.role === 'system')?.content,
      max_tokens: request.max_tokens || config.maxTokens,
      temperature: request.temperature ?? config.temperature
    };

    const response = await firstValueFrom(
      this.http.post<ClaudeResponse>('/api/v1/ai/complete', payload).pipe(
        timeout(60000),
        catchError((error: HttpErrorResponse) => this.handleHttpError(error, 'anthropic'))
      )
    );

    return {
      text: response.content.map((c) => c.text).join('\n'),
      model: response.model,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens
      },
      provider: 'anthropic'
    };
  }

  /**
   * Completes via OpenAI (via backend proxy).
   */
  private async completeOpenAI(
    request: AICompletionRequest,
    config: { model: string; temperature: number; maxTokens: number }
  ): Promise<AICompletionResponse> {
    const messages = this.buildOpenAIMessages(request);

    const payload = {
      model: request.model || config.model,
      messages,
      max_tokens: request.max_tokens || config.maxTokens,
      temperature: request.temperature ?? config.temperature
    };

    const response = await firstValueFrom(
      this.http.post<OpenAICompatibleResponse>('/api/v1/ai/openai/complete', payload).pipe(
        timeout(60000),
        catchError((error: HttpErrorResponse) => this.handleHttpError(error, 'openai'))
      )
    );

    return {
      text: response.choices[0]?.message?.content || '',
      model: response.model,
      usage: response.usage ? {
        inputTokens: response.usage.prompt_tokens,
        outputTokens: response.usage.completion_tokens
      } : undefined,
      provider: 'openai'
    };
  }

  /**
   * Completes via Ollama (local).
   */
  private async completeOllama(
    request: AICompletionRequest,
    config: { endpoint: string; model: string; temperature: number; maxTokens: number }
  ): Promise<AICompletionResponse> {
    // Build prompt from messages
    const prompt = this.buildOllamaPrompt(request);

    const payload = {
      model: request.model || config.model,
      prompt,
      stream: false,
      options: {
        temperature: request.temperature ?? config.temperature,
        num_predict: request.max_tokens || config.maxTokens
      }
    };

    const response = await firstValueFrom(
      this.http.post<OllamaResponse>(config.endpoint, payload).pipe(
        timeout(120000), // Ollama can be slow
        catchError((error: HttpErrorResponse) => this.handleHttpError(error, 'ollama'))
      )
    );

    return {
      text: response.response,
      model: response.model,
      provider: 'ollama'
    };
  }

  /**
   * Builds OpenAI-compatible messages array.
   */
  private buildOpenAIMessages(request: AICompletionRequest): AIMessage[] {
    const messages: AIMessage[] = [];

    // Add system message if provided
    const systemContent = request.system || request.messages.find((m) => m.role === 'system')?.content;
    if (systemContent) {
      messages.push({ role: 'system', content: systemContent });
    }

    // Add other messages
    for (const msg of request.messages) {
      if (msg.role !== 'system') {
        messages.push(msg);
      }
    }

    return messages;
  }

  /**
   * Builds a single prompt string for Ollama.
   */
  private buildOllamaPrompt(request: AICompletionRequest): string {
    const parts: string[] = [];

    // Add system message
    const systemContent = request.system || request.messages.find((m) => m.role === 'system')?.content;
    if (systemContent) {
      parts.push(`System: ${systemContent}\n`);
    }

    // Add conversation messages
    for (const msg of request.messages) {
      if (msg.role === 'user') {
        parts.push(`User: ${msg.content}`);
      } else if (msg.role === 'assistant') {
        parts.push(`Assistant: ${msg.content}`);
      }
    }

    return parts.join('\n\n');
  }

  /**
   * Handles HTTP errors and transforms them to AIApiError.
   */
  private handleHttpError(error: HttpErrorResponse, provider: AIProvider) {
    let apiError: AIApiError;

    if (error.status === 0) {
      const endpoint = provider === 'lm-studio'
        ? 'LM Studio'
        : provider === 'ollama'
          ? 'Ollama'
          : 'the API';

      apiError = {
        type: 'network_error',
        message: `Network error: Unable to reach ${endpoint}. Please check if it's running.`,
        status: 0,
        provider
      };
    } else if (error.status === 401) {
      apiError = {
        type: 'authentication_error',
        message: 'Authentication failed. Please check your API key.',
        status: 401,
        provider
      };
    } else if (error.status === 429) {
      apiError = {
        type: 'rate_limit_error',
        message: 'Rate limit exceeded. Please wait a moment and try again.',
        status: 429,
        provider
      };
    } else if (error.status >= 500) {
      apiError = {
        type: 'server_error',
        message: 'Server error. Please try again later.',
        status: error.status,
        provider
      };
    } else {
      apiError = {
        type: 'api_error',
        message: error.error?.message || error.error?.error?.message || error.message || 'An unknown error occurred',
        status: error.status,
        provider
      };
    }

    return throwError(() => apiError);
  }

  /**
   * Creates an error object from an unknown error.
   */
  private createError(error: unknown, provider: AIProvider): AIApiError {
    if (error instanceof Error) {
      return {
        type: 'error',
        message: error.message,
        provider
      };
    }
    return {
      type: 'unknown_error',
      message: 'An unexpected error occurred',
      provider
    };
  }

  /**
   * Type guard for AIApiError.
   */
  private isAIApiError(error: unknown): error is AIApiError {
    return (
      typeof error === 'object' &&
      error !== null &&
      'type' in error &&
      'message' in error &&
      'provider' in error
    );
  }
}
