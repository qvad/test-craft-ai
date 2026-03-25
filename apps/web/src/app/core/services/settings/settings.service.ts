import { Injectable, signal, computed, effect } from '@angular/core';

/**
 * Available AI providers for auto-fill and code generation.
 */
export type AIProvider = 'lm-studio' | 'anthropic' | 'openai' | 'ollama';

/**
 * LM Studio specific configuration.
 */
export interface LMStudioSettings {
  /** API endpoint URL */
  endpoint: string;
  /** Model name (optional, depends on what's loaded) */
  model: string;
  /** Request timeout in milliseconds */
  timeout: number;
}

/**
 * Anthropic (Claude) specific configuration.
 */
export interface AnthropicSettings {
  /** API key for authentication */
  apiKey: string;
  /** Model to use */
  model: string;
}

/**
 * OpenAI specific configuration.
 */
export interface OpenAISettings {
  /** API key for authentication */
  apiKey: string;
  /** Model to use */
  model: string;
  /** Organization ID (optional) */
  organization?: string;
}

/**
 * Ollama specific configuration.
 */
export interface OllamaSettings {
  /** API endpoint URL */
  endpoint: string;
  /** Model name */
  model: string;
}

/**
 * AI-related settings.
 */
export interface AISettings {
  /** Active AI provider */
  provider: AIProvider;
  /** Default temperature for AI requests */
  temperature: number;
  /** Default max tokens for responses */
  maxTokens: number;
  /** LM Studio configuration */
  lmStudio: LMStudioSettings;
  /** Anthropic configuration */
  anthropic: AnthropicSettings;
  /** OpenAI configuration */
  openai: OpenAISettings;
  /** Ollama configuration */
  ollama: OllamaSettings;
}

/**
 * General application settings.
 */
export interface GeneralSettings {
  /** Default timeout for operations (ms) */
  defaultTimeout: number;
  /** Auto-save interval (seconds) */
  autoSaveInterval: number;
  /** Theme preference */
  theme: 'dark' | 'light' | 'system';
}

/**
 * Execution settings.
 */
export interface ExecutionSettings {
  /** Maximum concurrent threads */
  maxThreads: number;
  /** Stop on first failure */
  stopOnFailure: boolean;
  /** Show real-time logs */
  showRealtimeLogs: boolean;
}

/**
 * Complete application settings.
 */
export interface AppSettings {
  general: GeneralSettings;
  ai: AISettings;
  execution: ExecutionSettings;
}

/**
 * Default settings with LM Studio as the default AI provider.
 */
const DEFAULT_SETTINGS: AppSettings = {
  general: {
    defaultTimeout: 30000,
    autoSaveInterval: 60,
    theme: 'dark'
  },
  ai: {
    provider: 'lm-studio', // LM Studio is the default
    temperature: 0.3,
    maxTokens: 4096,
    lmStudio: {
      endpoint: 'http://localhost:1234/v1/chat/completions',
      model: 'local-model',
      timeout: 60000
    },
    anthropic: {
      apiKey: '',
      model: 'claude-sonnet-4-20250514'
    },
    openai: {
      apiKey: '',
      model: 'gpt-4o',
      organization: ''
    },
    ollama: {
      endpoint: 'http://localhost:11434/api/generate',
      model: 'llama2'
    }
  },
  execution: {
    maxThreads: 10,
    stopOnFailure: false,
    showRealtimeLogs: true
  }
};

const STORAGE_KEY = 'testcraft-settings';

/**
 * Service for managing application settings.
 *
 * @description
 * The SettingsService provides centralized settings management with:
 * - Reactive settings via Angular signals
 * - Automatic persistence to localStorage
 * - Type-safe access to all settings
 * - Default values with LM Studio as the default AI provider
 *
 * @example
 * ```typescript
 * const settings = inject(SettingsService);
 *
 * // Get current AI provider
 * const provider = settings.aiProvider();
 *
 * // Update a setting
 * settings.updateAISettings({ provider: 'anthropic' });
 *
 * // Get full AI config for active provider
 * const config = settings.activeAIConfig();
 * ```
 */
@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  /** Internal settings state */
  private readonly _settings = signal<AppSettings>(this.loadSettings());

  /** Readonly settings signal */
  readonly settings = this._settings.asReadonly();

  /** Current AI provider */
  readonly aiProvider = computed(() => this._settings().ai.provider);

  /** Current AI settings */
  readonly aiSettings = computed(() => this._settings().ai);

  /** General settings */
  readonly generalSettings = computed(() => this._settings().general);

  /** Execution settings */
  readonly executionSettings = computed(() => this._settings().execution);

  /** Configuration for the active AI provider */
  readonly activeAIConfig = computed(() => {
    const ai = this._settings().ai;
    switch (ai.provider) {
      case 'lm-studio':
        return {
          type: 'lm-studio' as const,
          endpoint: ai.lmStudio.endpoint,
          model: ai.lmStudio.model,
          timeout: ai.lmStudio.timeout,
          temperature: ai.temperature,
          maxTokens: ai.maxTokens
        };
      case 'anthropic':
        return {
          type: 'anthropic' as const,
          apiKey: ai.anthropic.apiKey,
          model: ai.anthropic.model,
          temperature: ai.temperature,
          maxTokens: ai.maxTokens
        };
      case 'openai':
        return {
          type: 'openai' as const,
          apiKey: ai.openai.apiKey,
          model: ai.openai.model,
          organization: ai.openai.organization,
          temperature: ai.temperature,
          maxTokens: ai.maxTokens
        };
      case 'ollama':
        return {
          type: 'ollama' as const,
          endpoint: ai.ollama.endpoint,
          model: ai.ollama.model,
          temperature: ai.temperature,
          maxTokens: ai.maxTokens
        };
    }
  });

  /** Whether the active AI provider is configured and ready */
  readonly isAIConfigured = computed(() => {
    const config = this.activeAIConfig();
    switch (config.type) {
      case 'lm-studio':
        return !!config.endpoint;
      case 'anthropic':
        return !!config.apiKey;
      case 'openai':
        return !!config.apiKey;
      case 'ollama':
        return !!config.endpoint;
    }
  });

  constructor() {
    // Auto-save settings when they change
    effect(() => {
      const settings = this._settings();
      this.saveSettings(settings);
    });
  }

  /**
   * Updates general settings.
   */
  updateGeneralSettings(updates: Partial<GeneralSettings>): void {
    this._settings.update((s) => ({
      ...s,
      general: { ...s.general, ...updates }
    }));
  }

  /**
   * Updates AI settings.
   */
  updateAISettings(updates: Partial<AISettings>): void {
    this._settings.update((s) => ({
      ...s,
      ai: { ...s.ai, ...updates }
    }));
  }

  /**
   * Updates LM Studio specific settings.
   */
  updateLMStudioSettings(updates: Partial<LMStudioSettings>): void {
    this._settings.update((s) => ({
      ...s,
      ai: {
        ...s.ai,
        lmStudio: { ...s.ai.lmStudio, ...updates }
      }
    }));
  }

  /**
   * Updates Anthropic specific settings.
   */
  updateAnthropicSettings(updates: Partial<AnthropicSettings>): void {
    this._settings.update((s) => ({
      ...s,
      ai: {
        ...s.ai,
        anthropic: { ...s.ai.anthropic, ...updates }
      }
    }));
  }

  /**
   * Updates OpenAI specific settings.
   */
  updateOpenAISettings(updates: Partial<OpenAISettings>): void {
    this._settings.update((s) => ({
      ...s,
      ai: {
        ...s.ai,
        openai: { ...s.ai.openai, ...updates }
      }
    }));
  }

  /**
   * Updates Ollama specific settings.
   */
  updateOllamaSettings(updates: Partial<OllamaSettings>): void {
    this._settings.update((s) => ({
      ...s,
      ai: {
        ...s.ai,
        ollama: { ...s.ai.ollama, ...updates }
      }
    }));
  }

  /**
   * Updates execution settings.
   */
  updateExecutionSettings(updates: Partial<ExecutionSettings>): void {
    this._settings.update((s) => ({
      ...s,
      execution: { ...s.execution, ...updates }
    }));
  }

  /**
   * Sets the active AI provider.
   */
  setAIProvider(provider: AIProvider): void {
    this.updateAISettings({ provider });
  }

  /**
   * Resets all settings to defaults.
   */
  resetToDefaults(): void {
    this._settings.set({ ...DEFAULT_SETTINGS });
  }

  /**
   * Loads settings from localStorage.
   */
  private loadSettings(): AppSettings {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<AppSettings>;
        return this.mergeSettings(DEFAULT_SETTINGS, parsed);
      }
    } catch (e) {
      console.warn('Failed to load settings:', e);
    }
    return { ...DEFAULT_SETTINGS };
  }

  /**
   * Saves settings to localStorage.
   */
  private saveSettings(settings: AppSettings): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn('Failed to save settings:', e);
    }
  }

  /**
   * Deep merges saved settings with defaults.
   */
  private mergeSettings(defaults: AppSettings, saved: Partial<AppSettings>): AppSettings {
    return {
      general: { ...defaults.general, ...saved.general },
      ai: {
        ...defaults.ai,
        ...saved.ai,
        lmStudio: { ...defaults.ai.lmStudio, ...saved.ai?.lmStudio },
        anthropic: { ...defaults.ai.anthropic, ...saved.ai?.anthropic },
        openai: { ...defaults.ai.openai, ...saved.ai?.openai },
        ollama: { ...defaults.ai.ollama, ...saved.ai?.ollama }
      },
      execution: { ...defaults.execution, ...saved.execution }
    };
  }
}
