import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { SettingsService, AIProvider, AppSettings } from './settings.service';

describe('SettingsService', () => {
  let service: SettingsService;
  const STORAGE_KEY = 'testcraft-settings';

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();

    TestBed.configureTestingModule({});
    service = TestBed.inject(SettingsService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('default settings', () => {
    it('should have LM Studio as the default AI provider', () => {
      expect(service.aiProvider()).toBe('lm-studio');
    });

    it('should have correct default LM Studio endpoint', () => {
      const config = service.activeAIConfig();
      expect(config.type).toBe('lm-studio');
      if (config.type === 'lm-studio') {
        expect(config.endpoint).toBe('http://localhost:1234/v1/chat/completions');
        expect(config.model).toBe('local-model');
        expect(config.timeout).toBe(60000);
      }
    });

    it('should have dark theme as default', () => {
      expect(service.generalSettings().theme).toBe('dark');
    });

    it('should have reasonable execution defaults', () => {
      const execSettings = service.executionSettings();
      expect(execSettings.maxThreads).toBe(10);
      expect(execSettings.stopOnFailure).toBe(false);
      expect(execSettings.showRealtimeLogs).toBe(true);
    });
  });

  describe('aiProvider', () => {
    it('should return current AI provider', () => {
      expect(service.aiProvider()).toBe('lm-studio');
    });
  });

  describe('setAIProvider', () => {
    it('should change the AI provider', () => {
      service.setAIProvider('anthropic');
      expect(service.aiProvider()).toBe('anthropic');

      service.setAIProvider('openai');
      expect(service.aiProvider()).toBe('openai');

      service.setAIProvider('ollama');
      expect(service.aiProvider()).toBe('ollama');

      service.setAIProvider('lm-studio');
      expect(service.aiProvider()).toBe('lm-studio');
    });
  });

  describe('activeAIConfig', () => {
    it('should return LM Studio config when provider is lm-studio', () => {
      service.setAIProvider('lm-studio');
      const config = service.activeAIConfig();

      expect(config.type).toBe('lm-studio');
      if (config.type === 'lm-studio') {
        expect(config.endpoint).toBeDefined();
        expect(config.model).toBeDefined();
        expect(config.timeout).toBeDefined();
      }
    });

    it('should return Anthropic config when provider is anthropic', () => {
      service.setAIProvider('anthropic');
      const config = service.activeAIConfig();

      expect(config.type).toBe('anthropic');
      if (config.type === 'anthropic') {
        expect(config.model).toBeDefined();
      }
    });

    it('should return OpenAI config when provider is openai', () => {
      service.setAIProvider('openai');
      const config = service.activeAIConfig();

      expect(config.type).toBe('openai');
      if (config.type === 'openai') {
        expect(config.model).toBeDefined();
      }
    });

    it('should return Ollama config when provider is ollama', () => {
      service.setAIProvider('ollama');
      const config = service.activeAIConfig();

      expect(config.type).toBe('ollama');
      if (config.type === 'ollama') {
        expect(config.endpoint).toBeDefined();
        expect(config.model).toBeDefined();
      }
    });

    it('should include temperature and maxTokens from global AI settings', () => {
      service.updateAISettings({ temperature: 0.7, maxTokens: 8192 });
      const config = service.activeAIConfig();

      expect(config.temperature).toBe(0.7);
      expect(config.maxTokens).toBe(8192);
    });
  });

  describe('isAIConfigured', () => {
    it('should return true for LM Studio with endpoint', () => {
      service.setAIProvider('lm-studio');
      expect(service.isAIConfigured()).toBe(true);
    });

    it('should return false for Anthropic without API key', () => {
      service.setAIProvider('anthropic');
      service.updateAnthropicSettings({ apiKey: '' });
      expect(service.isAIConfigured()).toBe(false);
    });

    it('should return true for Anthropic with API key', () => {
      service.setAIProvider('anthropic');
      service.updateAnthropicSettings({ apiKey: 'test-key' });
      expect(service.isAIConfigured()).toBe(true);
    });

    it('should return false for OpenAI without API key', () => {
      service.setAIProvider('openai');
      service.updateOpenAISettings({ apiKey: '' });
      expect(service.isAIConfigured()).toBe(false);
    });

    it('should return true for OpenAI with API key', () => {
      service.setAIProvider('openai');
      service.updateOpenAISettings({ apiKey: 'test-key' });
      expect(service.isAIConfigured()).toBe(true);
    });

    it('should return true for Ollama with endpoint', () => {
      service.setAIProvider('ollama');
      expect(service.isAIConfigured()).toBe(true);
    });
  });

  describe('updateGeneralSettings', () => {
    it('should update general settings', () => {
      service.updateGeneralSettings({ theme: 'light', defaultTimeout: 60000 });

      const settings = service.generalSettings();
      expect(settings.theme).toBe('light');
      expect(settings.defaultTimeout).toBe(60000);
    });

    it('should merge with existing settings', () => {
      service.updateGeneralSettings({ theme: 'light' });
      service.updateGeneralSettings({ autoSaveInterval: 30 });

      const settings = service.generalSettings();
      expect(settings.theme).toBe('light');
      expect(settings.autoSaveInterval).toBe(30);
    });
  });

  describe('updateAISettings', () => {
    it('should update AI settings', () => {
      service.updateAISettings({ temperature: 0.8, maxTokens: 2048 });

      const settings = service.aiSettings();
      expect(settings.temperature).toBe(0.8);
      expect(settings.maxTokens).toBe(2048);
    });

    it('should update provider', () => {
      service.updateAISettings({ provider: 'anthropic' });
      expect(service.aiProvider()).toBe('anthropic');
    });
  });

  describe('updateLMStudioSettings', () => {
    it('should update LM Studio settings', () => {
      service.updateLMStudioSettings({
        endpoint: 'http://localhost:5000/v1/chat/completions',
        model: 'custom-model',
        timeout: 90000
      });

      const settings = service.aiSettings();
      expect(settings.lmStudio.endpoint).toBe('http://localhost:5000/v1/chat/completions');
      expect(settings.lmStudio.model).toBe('custom-model');
      expect(settings.lmStudio.timeout).toBe(90000);
    });
  });

  describe('updateAnthropicSettings', () => {
    it('should update Anthropic settings', () => {
      service.updateAnthropicSettings({
        apiKey: 'sk-test-key',
        model: 'claude-3-opus-20240229'
      });

      const settings = service.aiSettings();
      expect(settings.anthropic.apiKey).toBe('sk-test-key');
      expect(settings.anthropic.model).toBe('claude-3-opus-20240229');
    });
  });

  describe('updateOpenAISettings', () => {
    it('should update OpenAI settings', () => {
      service.updateOpenAISettings({
        apiKey: 'sk-test-key',
        model: 'gpt-4-turbo',
        organization: 'org-123'
      });

      const settings = service.aiSettings();
      expect(settings.openai.apiKey).toBe('sk-test-key');
      expect(settings.openai.model).toBe('gpt-4-turbo');
      expect(settings.openai.organization).toBe('org-123');
    });
  });

  describe('updateOllamaSettings', () => {
    it('should update Ollama settings', () => {
      service.updateOllamaSettings({
        endpoint: 'http://localhost:11434/api/generate',
        model: 'mistral'
      });

      const settings = service.aiSettings();
      expect(settings.ollama.endpoint).toBe('http://localhost:11434/api/generate');
      expect(settings.ollama.model).toBe('mistral');
    });
  });

  describe('updateExecutionSettings', () => {
    it('should update execution settings', () => {
      service.updateExecutionSettings({
        maxThreads: 20,
        stopOnFailure: true,
        showRealtimeLogs: false
      });

      const settings = service.executionSettings();
      expect(settings.maxThreads).toBe(20);
      expect(settings.stopOnFailure).toBe(true);
      expect(settings.showRealtimeLogs).toBe(false);
    });
  });

  describe('resetToDefaults', () => {
    it('should reset all settings to defaults', () => {
      // Make changes
      service.setAIProvider('anthropic');
      service.updateGeneralSettings({ theme: 'light' });
      service.updateAnthropicSettings({ apiKey: 'test-key' });

      // Reset
      service.resetToDefaults();

      // Verify defaults
      expect(service.aiProvider()).toBe('lm-studio');
      expect(service.generalSettings().theme).toBe('dark');
      expect(service.aiSettings().anthropic.apiKey).toBe('');
    });
  });

  describe('persistence', () => {
    it('should save settings to localStorage', fakeAsync(() => {
      service.setAIProvider('openai');
      tick();

      const saved = localStorage.getItem(STORAGE_KEY);
      expect(saved).toBeTruthy();

      const parsed = JSON.parse(saved!);
      expect(parsed.ai.provider).toBe('openai');
    }));

    it('should load settings from localStorage on init', () => {
      const customSettings: AppSettings = {
        general: { defaultTimeout: 45000, autoSaveInterval: 120, theme: 'light' },
        ai: {
          provider: 'anthropic',
          temperature: 0.5,
          maxTokens: 2048,
          lmStudio: { endpoint: 'http://localhost:1234/v1/chat/completions', model: 'local', timeout: 60000 },
          anthropic: { apiKey: 'saved-key', model: 'claude-3' },
          openai: { apiKey: '', model: 'gpt-4o', organization: '' },
          ollama: { endpoint: 'http://localhost:11434/api/generate', model: 'llama2' }
        },
        execution: { maxThreads: 5, stopOnFailure: true, showRealtimeLogs: false }
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(customSettings));

      // Create new service instance
      const newService = TestBed.inject(SettingsService);
      // Note: TestBed caches services, so we need to reset it
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({});
      const freshService = TestBed.inject(SettingsService);

      expect(freshService.aiProvider()).toBe('anthropic');
      expect(freshService.generalSettings().theme).toBe('light');
    });

    it('should merge saved settings with defaults for missing fields', () => {
      // Save incomplete settings
      const partialSettings = {
        general: { theme: 'light' },
        ai: { provider: 'anthropic' }
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(partialSettings));

      // Reset and create fresh service
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({});
      const freshService = TestBed.inject(SettingsService);

      // Should have saved value
      expect(freshService.generalSettings().theme).toBe('light');
      expect(freshService.aiProvider()).toBe('anthropic');

      // Should have default values for missing fields
      expect(freshService.generalSettings().defaultTimeout).toBe(30000);
      expect(freshService.executionSettings().maxThreads).toBe(10);
    });

    it('should handle corrupted localStorage gracefully', () => {
      localStorage.setItem(STORAGE_KEY, 'not valid json');

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({});

      // Should not throw and should use defaults
      const freshService = TestBed.inject(SettingsService);
      expect(freshService.aiProvider()).toBe('lm-studio');
    });
  });

  describe('computed signals', () => {
    it('should update aiProvider when settings change', () => {
      expect(service.aiProvider()).toBe('lm-studio');
      service.updateAISettings({ provider: 'openai' });
      expect(service.aiProvider()).toBe('openai');
    });

    it('should update aiSettings when AI settings change', () => {
      const initial = service.aiSettings();
      expect(initial.temperature).toBe(0.3);

      service.updateAISettings({ temperature: 0.9 });

      const updated = service.aiSettings();
      expect(updated.temperature).toBe(0.9);
    });

    it('should update generalSettings when general settings change', () => {
      const initial = service.generalSettings();
      expect(initial.theme).toBe('dark');

      service.updateGeneralSettings({ theme: 'light' });

      const updated = service.generalSettings();
      expect(updated.theme).toBe('light');
    });

    it('should update executionSettings when execution settings change', () => {
      const initial = service.executionSettings();
      expect(initial.maxThreads).toBe(10);

      service.updateExecutionSettings({ maxThreads: 50 });

      const updated = service.executionSettings();
      expect(updated.maxThreads).toBe(50);
    });

    it('should update activeAIConfig when provider or provider settings change', () => {
      service.setAIProvider('lm-studio');
      let config = service.activeAIConfig();
      expect(config.type).toBe('lm-studio');

      service.setAIProvider('anthropic');
      config = service.activeAIConfig();
      expect(config.type).toBe('anthropic');
    });

    it('should update isAIConfigured when API key is added/removed', () => {
      service.setAIProvider('anthropic');
      service.updateAnthropicSettings({ apiKey: '' });
      expect(service.isAIConfigured()).toBe(false);

      service.updateAnthropicSettings({ apiKey: 'new-key' });
      expect(service.isAIConfigured()).toBe(true);
    });
  });
});
