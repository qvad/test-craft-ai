import { TestBed } from '@angular/core/testing';
import { AutoFillService, AutoFillRequest, FieldSuggestion } from './auto-fill.service';
import { AIApiService } from './ai-api.service';
import { FieldMetadataService, FieldMetadata } from './field-metadata.service';
import { NodeRegistryService } from '../node-registry.service';
import { vi, describe, it, expect, beforeEach, afterEach, Mock } from 'vitest';

describe('AutoFillService', () => {
  let service: AutoFillService;
  let completeJsonMock: Mock;

  const mockFieldMetadata: FieldMetadata[] = [
    {
      key: 'method',
      label: 'HTTP Method',
      description: 'The HTTP method to use',
      dataType: 'enum',
      required: true,
      allowedValues: ['GET', 'POST', 'PUT', 'DELETE'],
      supportsVariables: false,
      semanticHints: ['GET for retrieving', 'POST for creating'],
      defaultValue: 'GET'
    },
    {
      key: 'serverName',
      label: 'Server Name',
      description: 'The server hostname',
      dataType: 'string',
      required: true,
      supportsVariables: true,
      semanticHints: ['Can use ${BASE_URL}'],
      example: 'api.example.com'
    },
    {
      key: 'path',
      label: 'Path',
      description: 'The URL path',
      dataType: 'string',
      required: true,
      supportsVariables: true,
      semanticHints: ['Start with /'],
      example: '/api/v1/users'
    },
    {
      key: 'timeout',
      label: 'Timeout',
      description: 'Request timeout in ms',
      dataType: 'number',
      required: false,
      supportsVariables: false,
      semanticHints: ['30000 for HTTP'],
      defaultValue: 30000
    }
  ];

  const mockAIResponse = {
    suggestions: [
      {
        fieldKey: 'method',
        suggestedValue: 'POST',
        confidence: 0.95,
        reasoning: 'POST for login/authentication',
        variablesUsed: []
      },
      {
        fieldKey: 'serverName',
        suggestedValue: '${API_HOST}',
        confidence: 0.9,
        reasoning: 'Using API_HOST variable',
        variablesUsed: ['API_HOST']
      },
      {
        fieldKey: 'path',
        suggestedValue: '/api/v1/auth/login',
        confidence: 0.85,
        reasoning: 'Standard login endpoint',
        variablesUsed: []
      }
    ],
    overallConfidence: 0.9,
    warnings: [],
    missingVariables: []
  };

  beforeEach(() => {
    completeJsonMock = vi.fn().mockResolvedValue(mockAIResponse);

    TestBed.configureTestingModule({
      providers: [
        AutoFillService,
        {
          provide: AIApiService,
          useValue: {
            completeJson: completeJsonMock
          }
        },
        {
          provide: FieldMetadataService,
          useValue: {
            getFields: vi.fn().mockReturnValue(mockFieldMetadata)
          }
        },
        {
          provide: NodeRegistryService,
          useValue: {
            get: vi.fn().mockReturnValue({ label: 'HTTP Request' })
          }
        }
      ]
    });

    service = TestBed.inject(AutoFillService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('generateSuggestions', () => {
    it('should generate suggestions for valid request', async () => {
      const request: AutoFillRequest = {
        intent: 'Test login API with invalid credentials',
        nodeType: 'http-request',
        contextVariables: [{ id: '1', name: 'API_HOST', value: 'api.example.com', type: 'string', sensitive: false, scope: 'plan', description: 'API host' }],
        currentConfig: {},
        preserveExisting: false
      };

      const result = await service.generateSuggestions(request);

      expect(result).toBeDefined();
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.overallConfidence).toBeGreaterThanOrEqual(0);
      expect(result.overallConfidence).toBeLessThanOrEqual(1);
    });

    it('should set isGenerating while generating', async () => {
      let isGeneratingDuringCall = false;
      completeJsonMock.mockImplementation(async () => {
        isGeneratingDuringCall = service.isGenerating();
        return mockAIResponse;
      });

      const request: AutoFillRequest = {
        intent: 'Test API',
        nodeType: 'http-request',
        contextVariables: [],
        currentConfig: {},
        preserveExisting: false
      };

      await service.generateSuggestions(request);
      expect(isGeneratingDuringCall).toBe(true);
      expect(service.isGenerating()).toBe(false);
    });

    it('should handle API errors gracefully', async () => {
      completeJsonMock.mockRejectedValue(new Error('API error'));

      const request: AutoFillRequest = {
        intent: 'Test API',
        nodeType: 'http-request',
        contextVariables: [],
        currentConfig: {},
        preserveExisting: false
      };

      await expect(service.generateSuggestions(request)).rejects.toThrow('API error');
      expect(service.lastError()).toBe('API error');
    });

    it('should filter out invalid field keys from AI response', async () => {
      const responseWithInvalidField = {
        ...mockAIResponse,
        suggestions: [
          ...mockAIResponse.suggestions,
          { fieldKey: 'invalidField', suggestedValue: 'test', confidence: 0.5, reasoning: 'test' }
        ]
      };
      completeJsonMock.mockResolvedValue(responseWithInvalidField);

      const request: AutoFillRequest = {
        intent: 'Test API',
        nodeType: 'http-request',
        contextVariables: [],
        currentConfig: {},
        preserveExisting: false
      };

      const result = await service.generateSuggestions(request);
      expect(result.suggestions.every(s => mockFieldMetadata.some(f => f.key === s.fieldKey))).toBe(true);
    });

    it('should mark overwrite fields correctly', async () => {
      const request: AutoFillRequest = {
        intent: 'Test API',
        nodeType: 'http-request',
        contextVariables: [],
        currentConfig: { method: 'GET' },
        preserveExisting: false
      };

      const result = await service.generateSuggestions(request);
      const methodSuggestion = result.suggestions.find(s => s.fieldKey === 'method');
      expect(methodSuggestion?.isOverwrite).toBe(true);
    });

    it('should clamp confidence values to 0-1 range', async () => {
      const responseWithBadConfidence = {
        ...mockAIResponse,
        suggestions: [
          { fieldKey: 'method', suggestedValue: 'POST', confidence: 1.5, reasoning: 'test' },
          { fieldKey: 'path', suggestedValue: '/api', confidence: -0.5, reasoning: 'test' }
        ],
        overallConfidence: 2.0
      };
      completeJsonMock.mockResolvedValue(responseWithBadConfidence);

      const request: AutoFillRequest = {
        intent: 'Test API',
        nodeType: 'http-request',
        contextVariables: [],
        currentConfig: {},
        preserveExisting: false
      };

      const result = await service.generateSuggestions(request);
      result.suggestions.forEach(s => {
        expect(s.confidence).toBeGreaterThanOrEqual(0);
        expect(s.confidence).toBeLessThanOrEqual(1);
      });
      expect(result.overallConfidence).toBeLessThanOrEqual(1);
    });
  });

  describe('getSelectedValues', () => {
    it('should return only selected suggestion values', () => {
      const suggestions: FieldSuggestion[] = [
        { fieldKey: 'method', suggestedValue: 'POST', confidence: 0.9, reasoning: '', variablesUsed: [], isOverwrite: false, selected: true },
        { fieldKey: 'path', suggestedValue: '/api', confidence: 0.8, reasoning: '', variablesUsed: [], isOverwrite: false, selected: false },
        { fieldKey: 'serverName', suggestedValue: 'api.example.com', confidence: 0.85, reasoning: '', variablesUsed: [], isOverwrite: false, selected: true }
      ];

      const values = service.getSelectedValues(suggestions);

      expect(values).toEqual({
        method: 'POST',
        serverName: 'api.example.com'
      });
      expect(values).not.toHaveProperty('path');
    });

    it('should return empty object for no selections', () => {
      const suggestions: FieldSuggestion[] = [
        { fieldKey: 'method', suggestedValue: 'POST', confidence: 0.9, reasoning: '', variablesUsed: [], isOverwrite: false, selected: false }
      ];

      const values = service.getSelectedValues(suggestions);
      expect(Object.keys(values).length).toBe(0);
    });
  });

  describe('toggleSuggestion', () => {
    it('should toggle selection state of a suggestion', () => {
      const suggestions: FieldSuggestion[] = [
        { fieldKey: 'method', suggestedValue: 'POST', confidence: 0.9, reasoning: '', variablesUsed: [], isOverwrite: false, selected: true },
        { fieldKey: 'path', suggestedValue: '/api', confidence: 0.8, reasoning: '', variablesUsed: [], isOverwrite: false, selected: false }
      ];

      const updated = service.toggleSuggestion(suggestions, 'method');

      expect(updated.find(s => s.fieldKey === 'method')?.selected).toBe(false);
      expect(updated.find(s => s.fieldKey === 'path')?.selected).toBe(false);
    });

    it('should not mutate original array', () => {
      const suggestions: FieldSuggestion[] = [
        { fieldKey: 'method', suggestedValue: 'POST', confidence: 0.9, reasoning: '', variablesUsed: [], isOverwrite: false, selected: true }
      ];

      const updated = service.toggleSuggestion(suggestions, 'method');

      expect(updated).not.toBe(suggestions);
      expect(suggestions[0].selected).toBe(true);
    });
  });

  describe('setAllSelected', () => {
    it('should select all suggestions', () => {
      const suggestions: FieldSuggestion[] = [
        { fieldKey: 'method', suggestedValue: 'POST', confidence: 0.9, reasoning: '', variablesUsed: [], isOverwrite: false, selected: false },
        { fieldKey: 'path', suggestedValue: '/api', confidence: 0.8, reasoning: '', variablesUsed: [], isOverwrite: false, selected: false }
      ];

      const updated = service.setAllSelected(suggestions, true);

      expect(updated.every(s => s.selected)).toBe(true);
    });

    it('should deselect all suggestions', () => {
      const suggestions: FieldSuggestion[] = [
        { fieldKey: 'method', suggestedValue: 'POST', confidence: 0.9, reasoning: '', variablesUsed: [], isOverwrite: false, selected: true },
        { fieldKey: 'path', suggestedValue: '/api', confidence: 0.8, reasoning: '', variablesUsed: [], isOverwrite: false, selected: true }
      ];

      const updated = service.setAllSelected(suggestions, false);

      expect(updated.every(s => !s.selected)).toBe(true);
    });
  });

  describe('updateSuggestionValue', () => {
    it('should update the value of a specific suggestion', () => {
      const suggestions: FieldSuggestion[] = [
        { fieldKey: 'method', suggestedValue: 'POST', confidence: 0.9, reasoning: '', variablesUsed: [], isOverwrite: false, selected: true },
        { fieldKey: 'path', suggestedValue: '/api', confidence: 0.8, reasoning: '', variablesUsed: [], isOverwrite: false, selected: true }
      ];

      const updated = service.updateSuggestionValue(suggestions, 'path', '/api/v2/users');

      expect(updated.find(s => s.fieldKey === 'path')?.suggestedValue).toBe('/api/v2/users');
      expect(updated.find(s => s.fieldKey === 'method')?.suggestedValue).toBe('POST');
    });
  });

  describe('clearError', () => {
    it('should clear the last error', async () => {
      completeJsonMock.mockRejectedValue(new Error('Test error'));

      const request: AutoFillRequest = {
        intent: 'Test',
        nodeType: 'http-request',
        contextVariables: [],
        currentConfig: {},
        preserveExisting: false
      };

      try {
        await service.generateSuggestions(request);
      } catch {
        // Expected error
      }

      expect(service.lastError()).toBeTruthy();

      service.clearError();

      expect(service.lastError()).toBeNull();
    });
  });

  describe('value validation', () => {
    it('should validate and coerce string values', async () => {
      const responseWithNumber = {
        ...mockAIResponse,
        suggestions: [
          { fieldKey: 'serverName', suggestedValue: 12345, confidence: 0.8, reasoning: 'test' }
        ]
      };
      completeJsonMock.mockResolvedValue(responseWithNumber);

      const request: AutoFillRequest = {
        intent: 'Test',
        nodeType: 'http-request',
        contextVariables: [],
        currentConfig: {},
        preserveExisting: false
      };

      const result = await service.generateSuggestions(request);
      const serverNameSuggestion = result.suggestions.find(s => s.fieldKey === 'serverName');
      expect(typeof serverNameSuggestion?.suggestedValue).toBe('string');
    });

    it('should validate enum values against allowed values', async () => {
      const responseWithInvalidEnum = {
        ...mockAIResponse,
        suggestions: [
          { fieldKey: 'method', suggestedValue: 'INVALID', confidence: 0.8, reasoning: 'test' }
        ]
      };
      completeJsonMock.mockResolvedValue(responseWithInvalidEnum);

      const request: AutoFillRequest = {
        intent: 'Test',
        nodeType: 'http-request',
        contextVariables: [],
        currentConfig: {},
        preserveExisting: false
      };

      const result = await service.generateSuggestions(request);
      const methodSuggestion = result.suggestions.find(s => s.fieldKey === 'method');
      expect(methodSuggestion?.suggestedValue).toBe('GET'); // Should fall back to default
    });

    it('should validate and coerce number values', async () => {
      const responseWithStringNumber = {
        ...mockAIResponse,
        suggestions: [
          { fieldKey: 'timeout', suggestedValue: '5000', confidence: 0.8, reasoning: 'test' }
        ]
      };
      completeJsonMock.mockResolvedValue(responseWithStringNumber);

      const request: AutoFillRequest = {
        intent: 'Test',
        nodeType: 'http-request',
        contextVariables: [],
        currentConfig: {},
        preserveExisting: false
      };

      const result = await service.generateSuggestions(request);
      const timeoutSuggestion = result.suggestions.find(s => s.fieldKey === 'timeout');
      expect(typeof timeoutSuggestion?.suggestedValue).toBe('number');
      expect(timeoutSuggestion?.suggestedValue).toBe(5000);
    });
  });
});
