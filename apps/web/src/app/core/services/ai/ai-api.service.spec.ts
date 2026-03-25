import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AIApiService, AICompletionRequest } from './ai-api.service';
import { SettingsService } from '../settings';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('AIApiService', () => {
  let service: AIApiService;
  let httpMock: HttpTestingController;
  let aiProviderMock: ReturnType<typeof vi.fn>;
  let activeAIConfigMock: ReturnType<typeof vi.fn>;
  let isAIConfiguredMock: ReturnType<typeof vi.fn>;

  const mockLMStudioConfig = {
    type: 'lm-studio' as const,
    endpoint: 'http://localhost:1234/v1/chat/completions',
    model: 'local-model',
    timeout: 60000,
    temperature: 0.3,
    maxTokens: 4096
  };

  const mockAnthropicConfig = {
    type: 'anthropic' as const,
    apiKey: 'test-api-key',
    model: 'claude-sonnet-4-20250514',
    temperature: 0.3,
    maxTokens: 4096
  };

  const mockOpenAIConfig = {
    type: 'openai' as const,
    apiKey: 'test-api-key',
    model: 'gpt-4o',
    organization: '',
    temperature: 0.3,
    maxTokens: 4096
  };

  const mockOllamaConfig = {
    type: 'ollama' as const,
    endpoint: 'http://localhost:11434/api/generate',
    model: 'llama2',
    temperature: 0.3,
    maxTokens: 4096
  };

  beforeEach(() => {
    aiProviderMock = vi.fn().mockReturnValue('lm-studio');
    activeAIConfigMock = vi.fn().mockReturnValue(mockLMStudioConfig);
    isAIConfiguredMock = vi.fn().mockReturnValue(true);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        AIApiService,
        {
          provide: SettingsService,
          useValue: {
            aiProvider: aiProviderMock,
            activeAIConfig: activeAIConfigMock,
            isAIConfigured: isAIConfiguredMock
          }
        }
      ]
    });

    service = TestBed.inject(AIApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('complete', () => {
    describe('LM Studio provider', () => {
      it('should send request to LM Studio proxy endpoint', async () => {
        activeAIConfigMock.mockReturnValue(mockLMStudioConfig);

        const request: AICompletionRequest = {
          messages: [{ role: 'user', content: 'Hello' }],
          system: 'You are a helpful assistant'
        };

        const mockResponse = {
          id: 'test-id',
          object: 'chat.completion',
          created: Date.now(),
          model: 'local-model',
          choices: [{
            index: 0,
            message: { role: 'assistant', content: 'Hello! How can I help?' },
            finish_reason: 'stop'
          }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
        };

        const promise = service.complete(request);

        const req = httpMock.expectOne('/api/v1/ai/lm-studio/complete');
        expect(req.request.method).toBe('POST');
        expect(req.request.body.endpoint).toBe(mockLMStudioConfig.endpoint);
        expect(req.request.body.model).toBe('local-model');
        expect(req.request.body.stream).toBe(false);
        expect(Array.isArray(req.request.body.messages)).toBe(true);
        req.flush(mockResponse);

        const result = await promise;
        expect(result.text).toBe('Hello! How can I help?');
        expect(result.provider).toBe('lm-studio');
        expect(result.usage?.inputTokens).toBe(10);
        expect(result.usage?.outputTokens).toBe(5);
      });

      it('should include system message in request', async () => {
        activeAIConfigMock.mockReturnValue(mockLMStudioConfig);

        const request: AICompletionRequest = {
          messages: [{ role: 'user', content: 'Hello' }],
          system: 'You are a test assistant'
        };

        const mockResponse = {
          id: 'test-id',
          object: 'chat.completion',
          created: Date.now(),
          model: 'local-model',
          choices: [{ index: 0, message: { role: 'assistant', content: 'Test' }, finish_reason: 'stop' }]
        };

        const promise = service.complete(request);

        const req = httpMock.expectOne('/api/v1/ai/lm-studio/complete');
        expect(req.request.body.messages[0]).toEqual({ role: 'system', content: 'You are a test assistant' });
        req.flush(mockResponse);

        await promise;
      });
    });

    describe('Anthropic provider', () => {
      beforeEach(() => {
        aiProviderMock.mockReturnValue('anthropic');
        activeAIConfigMock.mockReturnValue(mockAnthropicConfig);
      });

      it('should send request to Anthropic proxy endpoint', async () => {
        const request: AICompletionRequest = {
          messages: [{ role: 'user', content: 'Hello' }],
          system: 'You are a helpful assistant'
        };

        const mockResponse = {
          id: 'test-id',
          type: 'message',
          role: 'assistant',
          content: [{ type: 'text', text: 'Hello from Claude!' }],
          model: 'claude-sonnet-4-20250514',
          stop_reason: 'end_turn',
          usage: { input_tokens: 10, output_tokens: 5 }
        };

        const promise = service.complete(request);

        const req = httpMock.expectOne('/api/v1/ai/complete');
        expect(req.request.method).toBe('POST');
        expect(req.request.body.system).toBe('You are a helpful assistant');
        req.flush(mockResponse);

        const result = await promise;
        expect(result.text).toBe('Hello from Claude!');
        expect(result.provider).toBe('anthropic');
      });

      it('should filter system messages from Anthropic message array', async () => {
        const request: AICompletionRequest = {
          messages: [
            { role: 'system', content: 'System prompt' },
            { role: 'user', content: 'Hello' }
          ]
        };

        const mockResponse = {
          id: 'test-id',
          type: 'message',
          role: 'assistant',
          content: [{ type: 'text', text: 'Response' }],
          model: 'claude-sonnet-4-20250514',
          stop_reason: 'end_turn',
          usage: { input_tokens: 10, output_tokens: 5 }
        };

        const promise = service.complete(request);

        const req = httpMock.expectOne('/api/v1/ai/complete');
        expect(req.request.body.messages.length).toBe(1);
        expect(req.request.body.messages[0].role).toBe('user');
        expect(req.request.body.system).toBe('System prompt');
        req.flush(mockResponse);

        await promise;
      });
    });

    describe('OpenAI provider', () => {
      beforeEach(() => {
        aiProviderMock.mockReturnValue('openai');
        activeAIConfigMock.mockReturnValue(mockOpenAIConfig);
      });

      it('should send request to OpenAI proxy endpoint', async () => {
        const request: AICompletionRequest = {
          messages: [{ role: 'user', content: 'Hello' }]
        };

        const mockResponse = {
          id: 'test-id',
          object: 'chat.completion',
          created: Date.now(),
          model: 'gpt-4o',
          choices: [{ index: 0, message: { role: 'assistant', content: 'Hello from GPT!' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
        };

        const promise = service.complete(request);

        const req = httpMock.expectOne('/api/v1/ai/openai/complete');
        expect(req.request.method).toBe('POST');
        req.flush(mockResponse);

        const result = await promise;
        expect(result.text).toBe('Hello from GPT!');
        expect(result.provider).toBe('openai');
      });
    });

    describe('Ollama provider', () => {
      beforeEach(() => {
        aiProviderMock.mockReturnValue('ollama');
        activeAIConfigMock.mockReturnValue(mockOllamaConfig);
      });

      it('should send request to Ollama endpoint', async () => {
        const request: AICompletionRequest = {
          messages: [{ role: 'user', content: 'Hello' }],
          system: 'You are a helpful assistant'
        };

        const mockResponse = {
          model: 'llama2',
          created_at: new Date().toISOString(),
          response: 'Hello from Ollama!',
          done: true
        };

        const promise = service.complete(request);

        const req = httpMock.expectOne(mockOllamaConfig.endpoint);
        expect(req.request.method).toBe('POST');
        expect(req.request.body.stream).toBe(false);
        req.flush(mockResponse);

        const result = await promise;
        expect(result.text).toBe('Hello from Ollama!');
        expect(result.provider).toBe('ollama');
      });

      it('should build prompt with system message for Ollama', async () => {
        const request: AICompletionRequest = {
          messages: [{ role: 'user', content: 'Test' }],
          system: 'You are a test bot'
        };

        const mockResponse = {
          model: 'llama2',
          created_at: new Date().toISOString(),
          response: 'Response',
          done: true
        };

        const promise = service.complete(request);

        const req = httpMock.expectOne(mockOllamaConfig.endpoint);
        expect(req.request.body.prompt).toContain('System: You are a test bot');
        expect(req.request.body.prompt).toContain('User: Test');
        req.flush(mockResponse);

        await promise;
      });
    });
  });

  describe('completeText', () => {
    it('should return just the text from response', async () => {
      activeAIConfigMock.mockReturnValue(mockLMStudioConfig);

      const request: AICompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }]
      };

      const mockResponse = {
        id: 'test-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'local-model',
        choices: [{ index: 0, message: { role: 'assistant', content: 'Just text' }, finish_reason: 'stop' }]
      };

      const promise = service.completeText(request);

      httpMock.expectOne('/api/v1/ai/lm-studio/complete').flush(mockResponse);

      const result = await promise;
      expect(result).toBe('Just text');
    });
  });

  describe('completeJson', () => {
    it('should parse JSON from response', async () => {
      activeAIConfigMock.mockReturnValue(mockLMStudioConfig);

      const request: AICompletionRequest = {
        messages: [{ role: 'user', content: 'Return JSON' }]
      };

      const mockResponse = {
        id: 'test-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'local-model',
        choices: [{ index: 0, message: { role: 'assistant', content: '{"key": "value"}' }, finish_reason: 'stop' }]
      };

      const promise = service.completeJson<{ key: string }>(request);

      httpMock.expectOne('/api/v1/ai/lm-studio/complete').flush(mockResponse);

      const result = await promise;
      expect(result).toEqual({ key: 'value' });
    });
  });

  describe('parseJsonResponse', () => {
    it('should parse plain JSON', () => {
      const result = service.parseJsonResponse<{ test: string }>('{"test": "value"}');
      expect(result).toEqual({ test: 'value' });
    });

    it('should handle markdown code blocks', () => {
      const input = '```json\n{"test": "value"}\n```';
      const result = service.parseJsonResponse<{ test: string }>(input);
      expect(result).toEqual({ test: 'value' });
    });

    it('should handle code blocks without json specifier', () => {
      const input = '```\n{"test": "value"}\n```';
      const result = service.parseJsonResponse<{ test: string }>(input);
      expect(result).toEqual({ test: 'value' });
    });

    it('should extract JSON from surrounding text', () => {
      const input = 'Here is the response:\n{"test": "value"}\nDone!';
      const result = service.parseJsonResponse<{ test: string }>(input);
      expect(result).toEqual({ test: 'value' });
    });

    it('should throw error for invalid JSON', () => {
      expect(() => service.parseJsonResponse('not json')).toThrowError(/Failed to parse JSON/);
    });
  });

  describe('error handling', () => {
    it('should handle network errors', async () => {
      activeAIConfigMock.mockReturnValue(mockLMStudioConfig);

      const request: AICompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }]
      };

      const promise = service.complete(request);

      httpMock.expectOne('/api/v1/ai/lm-studio/complete').error(new ProgressEvent('error'), { status: 0 });

      await expect(promise).rejects.toThrow();
      const error = service.lastError();
      expect(error).toBeTruthy();
      expect(error?.type).toBe('network_error');
      expect(error?.provider).toBe('lm-studio');
    });

    it('should handle authentication errors', async () => {
      activeAIConfigMock.mockReturnValue(mockLMStudioConfig);

      const request: AICompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }]
      };

      const promise = service.complete(request);

      httpMock.expectOne('/api/v1/ai/lm-studio/complete').error(new ProgressEvent('error'), { status: 401 });

      await expect(promise).rejects.toThrow();
      const error = service.lastError();
      expect(error?.type).toBe('authentication_error');
    });

    it('should handle rate limit errors', async () => {
      activeAIConfigMock.mockReturnValue(mockLMStudioConfig);

      const request: AICompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }]
      };

      const promise = service.complete(request);

      httpMock.expectOne('/api/v1/ai/lm-studio/complete').error(new ProgressEvent('error'), { status: 429 });

      await expect(promise).rejects.toThrow();
      const error = service.lastError();
      expect(error?.type).toBe('rate_limit_error');
    });

    it('should handle server errors', async () => {
      activeAIConfigMock.mockReturnValue(mockLMStudioConfig);

      const request: AICompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }]
      };

      const promise = service.complete(request);

      httpMock.expectOne('/api/v1/ai/lm-studio/complete').error(new ProgressEvent('error'), { status: 500 });

      await expect(promise).rejects.toThrow();
      const error = service.lastError();
      expect(error?.type).toBe('server_error');
    });
  });

  describe('clearError', () => {
    it('should clear the last error', async () => {
      activeAIConfigMock.mockReturnValue(mockLMStudioConfig);

      const request: AICompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }]
      };

      const promise = service.complete(request);
      httpMock.expectOne('/api/v1/ai/lm-studio/complete').error(new ProgressEvent('error'), { status: 500 });

      try {
        await promise;
      } catch {
        // Expected error
      }

      expect(service.lastError()).toBeTruthy();

      service.clearError();

      expect(service.lastError()).toBeNull();
    });
  });

  describe('loading state', () => {
    it('should set isLoading during request', async () => {
      activeAIConfigMock.mockReturnValue(mockLMStudioConfig);

      const request: AICompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }]
      };

      expect(service.isLoading()).toBe(false);

      const promise = service.complete(request);

      // Check loading state before response
      expect(service.isLoading()).toBe(true);

      const mockResponse = {
        id: 'test-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'local-model',
        choices: [{ index: 0, message: { role: 'assistant', content: 'Done' }, finish_reason: 'stop' }]
      };

      httpMock.expectOne('/api/v1/ai/lm-studio/complete').flush(mockResponse);

      await promise;

      expect(service.isLoading()).toBe(false);
    });
  });

  describe('computed properties', () => {
    it('should expose activeProvider from settings', () => {
      // The mock was set up in beforeEach to return 'lm-studio'
      expect(service.activeProvider()).toBe('lm-studio');
    });

    it('should expose isConfigured from settings', () => {
      // The mock was set up in beforeEach to return true
      expect(service.isConfigured()).toBe(true);
    });
  });
});
