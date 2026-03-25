import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { PromptImprovementService, ImprovedPrompt } from './prompt-improvement.service';
import { Variable } from '../../../shared/models';

describe('PromptImprovementService', () => {
  let service: PromptImprovementService;

  const mockVariables: Variable[] = [
    { id: '1', name: 'BASE_URL', value: 'https://api.example.com', type: 'string', sensitive: false, scope: 'plan', description: 'Base API URL' },
    { id: '2', name: 'AUTH_TOKEN', value: 'secret', type: 'string', sensitive: true, scope: 'plan', description: 'Authentication token' },
    { id: '3', name: 'USER_ID', value: '12345', type: 'string', sensitive: false, scope: 'plan', description: 'User ID' }
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PromptImprovementService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('improvePrompt', () => {
    it('should return improved prompt with context variables', fakeAsync(() => {
      const promise = service.improvePrompt(
        'Send a request to get users',
        mockVariables,
        'http-request'
      );

      tick(1100); // Wait for simulated delay

      promise.then((result: ImprovedPrompt) => {
        expect(result.original).toBe('Send a request to get users');
        expect(result.improved).toContain('${BASE_URL}');
        expect(result.improved).toContain('${AUTH_TOKEN}');
        expect(result.improved).toContain('${USER_ID}');
      });
    }));

    it('should set isImproving during processing', fakeAsync(() => {
      expect(service.isImproving()).toBe(false);

      const promise = service.improvePrompt('Test', [], 'http-request');

      expect(service.isImproving()).toBe(true);

      tick(1100);

      promise.then(() => {
        expect(service.isImproving()).toBe(false);
      });
    }));

    it('should reset isImproving on completion', fakeAsync(() => {
      const promise = service.improvePrompt('Test', [], 'http-request');
      tick(1100);

      promise.then(() => {
        expect(service.isImproving()).toBe(false);
      });
    }));

    it('should add HTTP context for http-request node type', fakeAsync(() => {
      const promise = service.improvePrompt(
        'Get user data',
        [],
        'http-request'
      );

      tick(1100);

      promise.then((result: ImprovedPrompt) => {
        expect(result.improved.toLowerCase()).toContain('http');
        expect(result.improved.toLowerCase()).toContain('response');
      });
    }));

    it('should add database context for jdbc-request node type', fakeAsync(() => {
      const promise = service.improvePrompt(
        'Fetch all users',
        [],
        'jdbc-request'
      );

      tick(1100);

      promise.then((result: ImprovedPrompt) => {
        expect(result.improved.toLowerCase()).toContain('database');
        expect(result.improved.toLowerCase()).toContain('sql injection');
      });
    }));

    it('should add Docker context for docker-run node type', fakeAsync(() => {
      const promise = service.improvePrompt(
        'Run nginx',
        [],
        'docker-run'
      );

      tick(1100);

      promise.then((result: ImprovedPrompt) => {
        expect(result.improved.toLowerCase()).toContain('container');
        expect(result.improved.toLowerCase()).toContain('cleanup');
      });
    }));

    it('should add Kubernetes context for k8s-deploy node type', fakeAsync(() => {
      const promise = service.improvePrompt(
        'Deploy app',
        [],
        'k8s-deploy'
      );

      tick(1100);

      promise.then((result: ImprovedPrompt) => {
        expect(result.improved.toLowerCase()).toContain('kubernetes');
        expect(result.improved.toLowerCase()).toContain('rollback');
      });
    }));

    it('should add error handling context for script node type', fakeAsync(() => {
      const promise = service.improvePrompt(
        'Calculate total',
        [],
        'script'
      );

      tick(1100);

      promise.then((result: ImprovedPrompt) => {
        expect(result.improved.toLowerCase()).toContain('error handling');
        expect(result.improved.toLowerCase()).toContain('logging');
      });
    }));

    it('should add JSON format context for AI node types', fakeAsync(() => {
      const aiTypes = ['lm-studio', 'poe-ai'];

      aiTypes.forEach(nodeType => {
        const promise = service.improvePrompt(
          'Generate response',
          [],
          nodeType
        );

        tick(1100);

        promise.then((result: ImprovedPrompt) => {
          expect(
            result.improved.toLowerCase().includes('json') ||
            result.improved.toLowerCase().includes('concise')
          ).toBe(true);
        });
      });
    }));

    it('should track context variables used', fakeAsync(() => {
      const promise = service.improvePrompt(
        'Use ${BASE_URL} to fetch data',
        mockVariables,
        'http-request'
      );

      tick(1100);

      promise.then((result: ImprovedPrompt) => {
        expect(result.contextUsed).toContain('BASE_URL');
      });
    }));

    it('should generate improvement suggestions', fakeAsync(() => {
      const promise = service.improvePrompt(
        'Get users',
        [],
        'http-request'
      );

      tick(1100);

      promise.then((result: ImprovedPrompt) => {
        expect(result.suggestions.length).toBeGreaterThan(0);
        expect(result.suggestions.length).toBeLessThanOrEqual(5);
      });
    }));

    it('should suggest using variables when none referenced', fakeAsync(() => {
      const promise = service.improvePrompt(
        'Get users',
        mockVariables,
        'http-request'
      );

      tick(1100);

      promise.then((result: ImprovedPrompt) => {
        expect(result.suggestions.some(s => s.toLowerCase().includes('variable'))).toBe(true);
      });
    }));

    it('should suggest error handling when not mentioned', fakeAsync(() => {
      const promise = service.improvePrompt(
        'Get users',
        [],
        'http-request'
      );

      tick(1100);

      promise.then((result: ImprovedPrompt) => {
        expect(result.suggestions.some(s => s.toLowerCase().includes('error'))).toBe(true);
      });
    }));

    it('should suggest headers for HTTP requests', fakeAsync(() => {
      const promise = service.improvePrompt(
        'Get users',
        [],
        'http-request'
      );

      tick(1100);

      promise.then((result: ImprovedPrompt) => {
        expect(result.suggestions.some(s => s.toLowerCase().includes('header'))).toBe(true);
      });
    }));

    it('should replace vague terms with specific ones', fakeAsync(() => {
      const promise = service.improvePrompt(
        'get the data and handle it',
        [],
        'http-request'
      );

      tick(1100);

      promise.then((result: ImprovedPrompt) => {
        expect(result.improved).not.toContain('get the');
        expect(result.improved).toContain('retrieve and store');
        expect(result.improved).not.toContain('handle it');
      });
    }));
  });

  describe('formatVariableReference', () => {
    it('should format variable name with ${} syntax', () => {
      expect(service.formatVariableReference('BASE_URL')).toBe('${BASE_URL}');
      expect(service.formatVariableReference('user_id')).toBe('${user_id}');
      expect(service.formatVariableReference('test123')).toBe('${test123}');
    });
  });

  describe('extractVariableReferences', () => {
    it('should extract variable names from text', () => {
      const text = 'Use ${BASE_URL} and ${API_KEY} to connect';
      const refs = service.extractVariableReferences(text);

      expect(refs).toContain('BASE_URL');
      expect(refs).toContain('API_KEY');
      expect(refs.length).toBe(2);
    });

    it('should return empty array when no variables', () => {
      const text = 'No variables here';
      const refs = service.extractVariableReferences(text);

      expect(refs).toEqual([]);
    });

    it('should handle multiple occurrences of same variable', () => {
      const text = '${URL} and ${URL} and ${OTHER}';
      const refs = service.extractVariableReferences(text);

      expect(refs).toContain('URL');
      expect(refs).toContain('OTHER');
      expect(refs.filter(r => r === 'URL').length).toBe(2);
    });

    it('should handle complex variable names', () => {
      const text = '${user_data.field} and ${api_v2_key}';
      const refs = service.extractVariableReferences(text);

      expect(refs).toContain('user_data.field');
      expect(refs).toContain('api_v2_key');
    });
  });

  describe('validateVariableReferences', () => {
    it('should return empty array when all variables exist', () => {
      const text = 'Use ${BASE_URL} for the request';
      const undefined_vars = service.validateVariableReferences(text, mockVariables);

      expect(undefined_vars).toEqual([]);
    });

    it('should return undefined variable names', () => {
      const text = 'Use ${BASE_URL} and ${UNDEFINED_VAR}';
      const undefined_vars = service.validateVariableReferences(text, mockVariables);

      expect(undefined_vars).toContain('UNDEFINED_VAR');
      expect(undefined_vars).not.toContain('BASE_URL');
    });

    it('should handle multiple undefined variables', () => {
      const text = '${VAR1} and ${VAR2} and ${BASE_URL}';
      const undefined_vars = service.validateVariableReferences(text, mockVariables);

      expect(undefined_vars).toContain('VAR1');
      expect(undefined_vars).toContain('VAR2');
      expect(undefined_vars.length).toBe(2);
    });

    it('should return empty array when no variables in text', () => {
      const text = 'No variables here';
      const undefined_vars = service.validateVariableReferences(text, mockVariables);

      expect(undefined_vars).toEqual([]);
    });

    it('should handle empty available variables', () => {
      const text = 'Use ${SOME_VAR}';
      const undefined_vars = service.validateVariableReferences(text, []);

      expect(undefined_vars).toContain('SOME_VAR');
    });
  });

  describe('node-type specific suggestions', () => {
    it('should suggest authentication for HTTP requests', fakeAsync(() => {
      const promise = service.improvePrompt(
        'Get secure data',
        [],
        'http-request'
      );

      tick(1100);

      promise.then((result: ImprovedPrompt) => {
        expect(result.suggestions.some(s =>
          s.toLowerCase().includes('auth') ||
          s.toLowerCase().includes('authentication')
        )).toBe(true);
      });
    }));

    it('should suggest transactions for JDBC requests', fakeAsync(() => {
      const promise = service.improvePrompt(
        'Update user record',
        [],
        'jdbc-request'
      );

      tick(1100);

      promise.then((result: ImprovedPrompt) => {
        expect(result.suggestions.some(s =>
          s.toLowerCase().includes('transaction')
        )).toBe(true);
      });
    }));

    it('should suggest output format for AI tasks', fakeAsync(() => {
      const promise = service.improvePrompt(
        'Generate test data',
        [],
        'ai-task'
      );

      tick(1100);

      promise.then((result: ImprovedPrompt) => {
        expect(result.suggestions.some(s =>
          s.toLowerCase().includes('format')
        )).toBe(true);
      });
    }));

    it('should suggest cleanup for infrastructure nodes', fakeAsync(() => {
      const promise = service.improvePrompt(
        'Run container',
        [],
        'docker-run'
      );

      tick(1100);

      promise.then((result: ImprovedPrompt) => {
        expect(result.suggestions.some(s =>
          s.toLowerCase().includes('cleanup') ||
          s.toLowerCase().includes('resource')
        )).toBe(true);
      });
    }));
  });
});
