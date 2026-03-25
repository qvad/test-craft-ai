import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { signal } from '@angular/core';
import { AutoFillDialogComponent } from './auto-fill-dialog';
import { AutoFillService, AutoFillResponse, FieldSuggestion } from '../../../../core/services/ai/auto-fill.service';
import { TestPlanStore } from '../../../../core/services/state';
import { NodeType } from '../../../../shared/models';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('AutoFillDialogComponent', () => {
  let component: AutoFillDialogComponent;
  let fixture: ComponentFixture<AutoFillDialogComponent>;
  let generateSuggestionsMock: ReturnType<typeof vi.fn>;
  let getSelectedValuesMock: ReturnType<typeof vi.fn>;
  let toggleSuggestionMock: ReturnType<typeof vi.fn>;
  let setAllSelectedMock: ReturnType<typeof vi.fn>;
  let updateSuggestionValueMock: ReturnType<typeof vi.fn>;
  let clearErrorMock: ReturnType<typeof vi.fn>;
  let planSignal: ReturnType<typeof signal>;

  const mockSuggestions: FieldSuggestion[] = [
    {
      fieldKey: 'method',
      suggestedValue: 'POST',
      confidence: 0.95,
      reasoning: 'POST for login requests',
      variablesUsed: [],
      isOverwrite: false,
      selected: true
    },
    {
      fieldKey: 'serverName',
      suggestedValue: '${API_HOST}',
      confidence: 0.9,
      reasoning: 'Using API_HOST variable',
      variablesUsed: ['API_HOST'],
      isOverwrite: false,
      selected: true
    },
    {
      fieldKey: 'path',
      suggestedValue: '/api/v1/auth/login',
      confidence: 0.85,
      reasoning: 'Standard login endpoint',
      variablesUsed: [],
      isOverwrite: true,
      selected: false
    }
  ];

  const mockResponse: AutoFillResponse = {
    suggestions: mockSuggestions,
    overallConfidence: 0.9,
    warnings: ['Consider adding authentication headers'],
    missingVariables: ['MISSING_VAR']
  };

  const mockPlan = {
    id: 'test-plan-1',
    name: 'Test Plan',
    variables: [
      { id: '1', name: 'API_HOST', value: 'api.example.com', type: 'string' as const, sensitive: false, scope: 'plan' as const, description: 'API host' }
    ],
    children: []
  };

  beforeEach(async () => {
    generateSuggestionsMock = vi.fn().mockResolvedValue(mockResponse);
    getSelectedValuesMock = vi.fn().mockReturnValue({ method: 'POST', serverName: '${API_HOST}' });
    toggleSuggestionMock = vi.fn().mockImplementation((suggestions, key) =>
      suggestions.map((s: FieldSuggestion) => s.fieldKey === key ? { ...s, selected: !s.selected } : s)
    );
    setAllSelectedMock = vi.fn().mockImplementation((suggestions, selected) =>
      suggestions.map((s: FieldSuggestion) => ({ ...s, selected }))
    );
    updateSuggestionValueMock = vi.fn().mockImplementation((suggestions, key, value) =>
      suggestions.map((s: FieldSuggestion) => s.fieldKey === key ? { ...s, suggestedValue: value } : s)
    );
    clearErrorMock = vi.fn();
    planSignal = signal(mockPlan);

    await TestBed.configureTestingModule({
      imports: [AutoFillDialogComponent, NoopAnimationsModule],
      providers: [
        {
          provide: AutoFillService,
          useValue: {
            generateSuggestions: generateSuggestionsMock,
            getSelectedValues: getSelectedValuesMock,
            toggleSuggestion: toggleSuggestionMock,
            setAllSelected: setAllSelectedMock,
            updateSuggestionValue: updateSuggestionValueMock,
            clearError: clearErrorMock,
            isGenerating: signal(false).asReadonly(),
            lastError: signal(null as string | null).asReadonly()
          }
        },
        {
          provide: TestPlanStore,
          useValue: {
            plan: planSignal.asReadonly()
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AutoFillDialogComponent);
    component = fixture.componentInstance;

    // Set required inputs
    fixture.componentRef.setInput('nodeType', 'http-request' as NodeType);
    fixture.componentRef.setInput('currentConfig', {});
    fixture.componentRef.setInput('visible', false);

    fixture.detectChanges();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('contextVariables', () => {
    it('should return variables from test plan', () => {
      // The computed contextVariables should return these
      const variables = component['contextVariables']();
      expect(variables.length).toBe(1);
      expect(variables[0].name).toBe('API_HOST');
    });

    it('should return empty array when no plan', () => {
      // Set the plan to null
      planSignal.set(null as any);

      const vars = component['contextVariables']();
      expect(vars).toEqual([]);
    });
  });

  describe('generate', () => {
    it('should call autoFillService.generateSuggestions', async () => {
      (component as any).intent = 'Test login API';
      component['generate']();
      await vi.waitFor(() => expect(generateSuggestionsMock).toHaveBeenCalled());

      expect(generateSuggestionsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          intent: 'Test login API',
          nodeType: 'http-request'
        })
      );
    });

    it('should not generate when intent is empty', async () => {
      (component as any).intent = '   ';
      component['generate']();
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(generateSuggestionsMock).not.toHaveBeenCalled();
    });

    it('should set response on success', async () => {
      (component as any).intent = 'Test API';
      component['generate']();
      await vi.waitFor(() => expect(component['response']()).not.toBeNull());

      expect(component['response']()).toEqual(mockResponse);
    });

    it('should clear error before generating', async () => {
      (component as any).intent = 'Test API';
      component['generate']();
      await vi.waitFor(() => expect(clearErrorMock).toHaveBeenCalled());
    });
  });

  describe('selectedCount', () => {
    it('should return count of selected suggestions', async () => {
      (component as any).intent = 'Test';
      component['generate']();
      await vi.waitFor(() => expect(component['response']()).not.toBeNull());

      const count = component['selectedCount']();
      expect(count).toBe(2); // method and serverName are selected in mockSuggestions
    });

    it('should return 0 when no response', () => {
      expect(component['selectedCount']()).toBe(0);
    });
  });

  describe('allSelected', () => {
    it('should return true when all suggestions are selected', async () => {
      const allSelectedResponse = {
        ...mockResponse,
        suggestions: mockSuggestions.map(s => ({ ...s, selected: true }))
      };
      generateSuggestionsMock.mockResolvedValue(allSelectedResponse);

      (component as any).intent = 'Test';
      component['generate']();
      await vi.waitFor(() => expect(component['response']()).not.toBeNull());

      expect(component['allSelected']()).toBe(true);
    });

    it('should return false when some suggestions are not selected', async () => {
      (component as any).intent = 'Test';
      component['generate']();
      await vi.waitFor(() => expect(component['response']()).not.toBeNull());

      expect(component['allSelected']()).toBe(false);
    });
  });

  describe('toggleSelectAll', () => {
    it('should select all when not all selected', async () => {
      (component as any).intent = 'Test';
      component['generate']();
      await vi.waitFor(() => expect(component['response']()).not.toBeNull());

      component['toggleSelectAll']();

      expect(setAllSelectedMock).toHaveBeenCalledWith(
        expect.any(Array),
        true
      );
    });

    it('should deselect all when all selected', async () => {
      const allSelectedResponse = {
        ...mockResponse,
        suggestions: mockSuggestions.map(s => ({ ...s, selected: true }))
      };
      generateSuggestionsMock.mockResolvedValue(allSelectedResponse);

      (component as any).intent = 'Test';
      component['generate']();
      await vi.waitFor(() => expect(component['response']()).not.toBeNull());

      component['toggleSelectAll']();

      expect(setAllSelectedMock).toHaveBeenCalledWith(
        expect.any(Array),
        false
      );
    });
  });

  describe('applySelected', () => {
    it('should emit apply event with selected values', async () => {
      const emitSpy = vi.spyOn(component['apply'], 'emit');

      (component as any).intent = 'Test';
      component['generate']();
      await vi.waitFor(() => expect(component['response']()).not.toBeNull());

      component['applySelected']();

      expect(emitSpy).toHaveBeenCalledWith({
        values: { method: 'POST', serverName: '${API_HOST}' }
      });
    });

    it('should close dialog after applying', async () => {
      const closeSpy = vi.spyOn(component as any, 'close');

      (component as any).intent = 'Test';
      component['generate']();
      await vi.waitFor(() => expect(component['response']()).not.toBeNull());

      component['applySelected']();

      expect(closeSpy).toHaveBeenCalled();
    });
  });

  describe('close', () => {
    it('should set dialogVisible to false', () => {
      component['dialogVisible'].set(true);
      component['close']();
      expect(component['dialogVisible']()).toBe(false);
    });

    it('should reset state', () => {
      (component as any).intent = 'Some intent';
      component['response'].set(mockResponse);
      component['editingField'].set('method');

      component['close']();

      expect((component as any).intent).toBe('');
      expect(component['response']()).toBeNull();
      expect(component['editingField']()).toBeNull();
    });
  });

  describe('startEditing', () => {
    it('should set editingField', () => {
      component['startEditing']('method');
      expect(component['editingField']()).toBe('method');
    });
  });

  describe('stopEditing', () => {
    it('should clear editingField', () => {
      component['editingField'].set('method');
      component['stopEditing']();
      expect(component['editingField']()).toBeNull();
    });
  });

  describe('updateValue', () => {
    it('should update suggestion value', async () => {
      (component as any).intent = 'Test';
      component['generate']();
      await vi.waitFor(() => expect(component['response']()).not.toBeNull());

      component['updateValue']('method', 'GET');

      expect(updateSuggestionValueMock).toHaveBeenCalledWith(
        expect.any(Array),
        'method',
        'GET'
      );
    });
  });

  describe('getDisplayValue', () => {
    it('should return empty string for null/undefined', () => {
      expect(component['getDisplayValue'](null)).toBe('');
      expect(component['getDisplayValue'](undefined)).toBe('');
    });

    it('should return string as-is', () => {
      expect(component['getDisplayValue']('test')).toBe('test');
    });

    it('should stringify objects', () => {
      expect(component['getDisplayValue']({ key: 'value' })).toBe('{"key":"value"}');
    });

    it('should convert numbers to string', () => {
      expect(component['getDisplayValue'](123)).toBe('123');
    });

    it('should convert booleans to string', () => {
      expect(component['getDisplayValue'](true)).toBe('true');
    });
  });

  describe('getConfidenceClass', () => {
    it('should return "high" for confidence >= 0.8', () => {
      expect(component['getConfidenceClass'](0.8)).toBe('high');
      expect(component['getConfidenceClass'](0.95)).toBe('high');
      expect(component['getConfidenceClass'](1.0)).toBe('high');
    });

    it('should return "medium" for confidence >= 0.5 and < 0.8', () => {
      expect(component['getConfidenceClass'](0.5)).toBe('medium');
      expect(component['getConfidenceClass'](0.7)).toBe('medium');
      expect(component['getConfidenceClass'](0.79)).toBe('medium');
    });

    it('should return "low" for confidence < 0.5', () => {
      expect(component['getConfidenceClass'](0.49)).toBe('low');
      expect(component['getConfidenceClass'](0.3)).toBe('low');
      expect(component['getConfidenceClass'](0)).toBe('low');
    });
  });

  describe('preserveExisting', () => {
    it('should pass preserveExisting flag to service', async () => {
      (component as any).intent = 'Test';
      (component as any).preserveExisting = true;

      component['generate']();
      await vi.waitFor(() => expect(generateSuggestionsMock).toHaveBeenCalled());

      expect(generateSuggestionsMock).toHaveBeenCalledWith(
        expect.objectContaining({ preserveExisting: true })
      );
    });
  });

  describe('visibility sync', () => {
    it('should sync internal visibility with input', async () => {
      fixture.componentRef.setInput('visible', true);
      fixture.detectChanges();
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(component['dialogVisible']()).toBe(true);

      fixture.componentRef.setInput('visible', false);
      fixture.detectChanges();
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(component['dialogVisible']()).toBe(false);
    });
  });
});
