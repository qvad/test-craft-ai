import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NodeConfigPanelComponent } from './node-config-panel';
import { TestPlanStore, TreeSelectionStore } from '../../../../core/services/state';
import { NodeRegistryService } from '../../../../core/services/node-registry.service';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

describe('NodeConfigPanelComponent', () => {
  let component: NodeConfigPanelComponent;
  let fixture: ComponentFixture<NodeConfigPanelComponent>;
  let planStore: TestPlanStore;
  let selectionStore: TreeSelectionStore;
  let nodeRegistry: NodeRegistryService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NodeConfigPanelComponent, NoopAnimationsModule]
    }).compileComponents();

    planStore = TestBed.inject(TestPlanStore);
    selectionStore = TestBed.inject(TreeSelectionStore);
    nodeRegistry = TestBed.inject(NodeRegistryService);

    fixture = TestBed.createComponent(NodeConfigPanelComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Initial State - No Selection', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should show empty state when no node selected', () => {
      const emptyState = fixture.nativeElement.querySelector('.empty-state');
      expect(emptyState).toBeTruthy();
    });

    it('should show "No Node Selected" message', () => {
      const message = fixture.nativeElement.querySelector('.empty-state h3');
      expect(message.textContent).toContain('No Node Selected');
    });

    it('should have no selected node', () => {
      expect(component.selectedNode()).toBeNull();
    });
  });

  describe('With Selected Node', () => {
    beforeEach(async () => {
      await planStore.loadPlans();
      await planStore.loadPlan('plan-1');
      const root = planStore.rootNode();
      if (root) {
        selectionStore.selectNode(root.id);
      }
      fixture.detectChanges();
    });

    it('should show config panel when node selected', () => {
      const configPanel = fixture.nativeElement.querySelector('.config-panel:not(.config-panel--empty)');
      expect(configPanel).toBeTruthy();
    });

    it('should show node name input', () => {
      const nameInput = fixture.nativeElement.querySelector('.config-panel__name-input');
      expect(nameInput).toBeTruthy();
    });

    it('should show node type label', () => {
      const typeLabel = fixture.nativeElement.querySelector('.config-panel__type-label');
      expect(typeLabel).toBeTruthy();
    });

    it('should show toggle switch for enabled', () => {
      const toggle = fixture.nativeElement.querySelector('p-toggleswitch');
      expect(toggle).toBeTruthy();
    });

    it('should have tabs for Configuration and Advanced', () => {
      const tabs = fixture.nativeElement.querySelectorAll('p-tab');
      expect(tabs.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Update Operations', () => {
    beforeEach(async () => {
      await planStore.loadPlans();
      await planStore.loadPlan('plan-1');
      const root = planStore.rootNode();
      if (root) {
        selectionStore.selectNode(root.id);
      }
      fixture.detectChanges();
    });

    it('should update node name', () => {
      const node = selectionStore.selectedNode();
      if (node) {
        component.updateNodeName('Updated Name');
        const updated = planStore.getNode(node.id);
        expect(updated?.name).toBe('Updated Name');
      }
    });

    it('should update node enabled state', () => {
      const node = selectionStore.selectedNode();
      if (node) {
        const originalEnabled = node.enabled;
        component.updateNodeEnabled(!originalEnabled);
        const updated = planStore.getNode(node.id);
        expect(updated?.enabled).toBe(!originalEnabled);
      }
    });

    it('should update config value', () => {
      const node = selectionStore.selectedNode();
      if (node) {
        component.updateConfig('description', 'Test description');
        const updated = planStore.getNode(node.id);
        expect(updated?.config.description).toBe('Test description');
      }
    });
  });

  describe('Thread Group Config', () => {
    beforeEach(async () => {
      await planStore.loadPlans();
      await planStore.loadPlan('plan-1');
      const root = planStore.rootNode();
      if (root) {
        const tgId = planStore.addNode(root.id, 'thread-group', 'Thread Group');
        selectionStore.selectNode(tgId);
      }
      fixture.detectChanges();
    });

    it('should show thread group specific fields', fakeAsync(() => {
      tick();
      fixture.detectChanges();
      const compiled = fixture.nativeElement;
      expect(compiled.textContent).toContain('Number of Threads');
      expect(compiled.textContent).toContain('Ramp-up Period');
      expect(compiled.textContent).toContain('Loop Count');
    }));
  });

  describe('HTTP Request Config', () => {
    beforeEach(async () => {
      await planStore.loadPlans();
      await planStore.loadPlan('plan-1');
      const root = planStore.rootNode();
      if (root) {
        const tgId = planStore.addNode(root.id, 'thread-group', 'Thread Group');
        const httpId = planStore.addNode(tgId, 'http-request', 'HTTP Request');
        selectionStore.selectNode(httpId);
      }
      fixture.detectChanges();
    });

    it('should show HTTP request specific fields', fakeAsync(() => {
      tick();
      fixture.detectChanges();
      const compiled = fixture.nativeElement;
      expect(compiled.textContent).toContain('Method');
      expect(compiled.textContent).toContain('Protocol');
      expect(compiled.textContent).toContain('Server Name');
      expect(compiled.textContent).toContain('Path');
    }));

    it('should have HTTP method options', () => {
      expect(component.httpMethods.length).toBe(7);
      expect(component.httpMethods.map((m) => m.value)).toContain('GET');
      expect(component.httpMethods.map((m) => m.value)).toContain('POST');
    });

    it('should have protocol options', () => {
      expect(component.protocols.length).toBe(2);
      expect(component.protocols.map((p) => p.value)).toContain('http');
      expect(component.protocols.map((p) => p.value)).toContain('https');
    });
  });

  describe('JDBC Request Config', () => {
    beforeEach(async () => {
      await planStore.loadPlans();
      await planStore.loadPlan('plan-1');
      const root = planStore.rootNode();
      if (root) {
        const tgId = planStore.addNode(root.id, 'thread-group', 'Thread Group');
        const jdbcId = planStore.addNode(tgId, 'jdbc-request', 'JDBC Request');
        selectionStore.selectNode(jdbcId);
      }
      fixture.detectChanges();
    });

    it('should show JDBC request specific fields', fakeAsync(() => {
      tick();
      fixture.detectChanges();
      const compiled = fixture.nativeElement;
      expect(compiled.textContent).toContain('Connection Reference');
      expect(compiled.textContent).toContain('Query Type');
      expect(compiled.textContent).toContain('Query');
      expect(compiled.textContent).toContain('Result Variable');
    }));

    it('should have query type options', () => {
      expect(component.queryTypes.length).toBe(5);
      expect(component.queryTypes.map((q) => q.value)).toContain('select');
      expect(component.queryTypes.map((q) => q.value)).toContain('update');
    });
  });

  describe('Script Config', () => {
    beforeEach(async () => {
      await planStore.loadPlans();
      await planStore.loadPlan('plan-1');
      const root = planStore.rootNode();
      if (root) {
        const tgId = planStore.addNode(root.id, 'thread-group', 'Thread Group');
        const scriptId = planStore.addNode(tgId, 'script', 'Script');
        selectionStore.selectNode(scriptId);
      }
      fixture.detectChanges();
    });

    it('should show script specific fields', fakeAsync(() => {
      tick();
      fixture.detectChanges();
      const compiled = fixture.nativeElement;
      expect(compiled.textContent).toContain('Language');
      expect(compiled.textContent).toContain('Script');
    }));

    it('should have script language options', () => {
      expect(component.scriptLanguages.length).toBe(6);
      expect(component.scriptLanguages.map((l) => l.value)).toContain('groovy');
      expect(component.scriptLanguages.map((l) => l.value)).toContain('javascript');
      expect(component.scriptLanguages.map((l) => l.value)).toContain('java');
      expect(component.scriptLanguages.map((l) => l.value)).toContain('python');
    });
  });

  describe('Timer Config', () => {
    beforeEach(async () => {
      await planStore.loadPlans();
      await planStore.loadPlan('plan-1');
      const root = planStore.rootNode();
      if (root) {
        const tgId = planStore.addNode(root.id, 'thread-group', 'Thread Group');
        const timerId = planStore.addNode(tgId, 'constant-timer', 'Timer');
        selectionStore.selectNode(timerId);
      }
      fixture.detectChanges();
    });

    it('should show timer specific fields', fakeAsync(() => {
      tick();
      fixture.detectChanges();
      const compiled = fixture.nativeElement;
      expect(compiled.textContent).toContain('Delay (ms)');
    }));
  });

  describe('Assertion Config', () => {
    beforeEach(async () => {
      await planStore.loadPlans();
      await planStore.loadPlan('plan-1');
      const root = planStore.rootNode();
      if (root) {
        const tgId = planStore.addNode(root.id, 'thread-group', 'Thread Group');
        const httpId = planStore.addNode(tgId, 'http-request', 'HTTP');
        const assertionId = planStore.addNode(httpId, 'response-assertion', 'Assertion');
        selectionStore.selectNode(assertionId);
      }
      fixture.detectChanges();
    });

    it('should show assertion specific fields', fakeAsync(() => {
      tick();
      fixture.detectChanges();
      const compiled = fixture.nativeElement;
      expect(compiled.textContent).toContain('Test Field');
      expect(compiled.textContent).toContain('Test Type');
      expect(compiled.textContent).toContain('Test Strings');
    }));

    it('should have test field options', () => {
      expect(component.testFields.length).toBe(6);
      expect(component.testFields.map((f) => f.value)).toContain('response-data');
      expect(component.testFields.map((f) => f.value)).toContain('response-code');
    });

    it('should have test type options', () => {
      expect(component.testTypes.length).toBe(4);
      expect(component.testTypes.map((t) => t.value)).toContain('contains');
      expect(component.testTypes.map((t) => t.value)).toContain('matches');
      expect(component.testTypes.map((t) => t.value)).toContain('equals');
    });
  });

  describe('JSON Extractor Config', () => {
    beforeEach(async () => {
      await planStore.loadPlans();
      await planStore.loadPlan('plan-1');
      const root = planStore.rootNode();
      if (root) {
        const tgId = planStore.addNode(root.id, 'thread-group', 'Thread Group');
        const httpId = planStore.addNode(tgId, 'http-request', 'HTTP');
        const extractorId = planStore.addNode(httpId, 'json-extractor', 'Extractor');
        selectionStore.selectNode(extractorId);
      }
      fixture.detectChanges();
    });

    it('should show JSON extractor specific fields', fakeAsync(() => {
      tick();
      fixture.detectChanges();
      const compiled = fixture.nativeElement;
      expect(compiled.textContent).toContain('Reference Name');
      expect(compiled.textContent).toContain('Match Number');
      expect(compiled.textContent).toContain('JSONPath Expression');
    }));
  });

  describe('AI Task Config', () => {
    beforeEach(async () => {
      await planStore.loadPlans();
      await planStore.loadPlan('plan-1');
      const root = planStore.rootNode();
      if (root) {
        const tgId = planStore.addNode(root.id, 'thread-group', 'Thread Group');
        const aiId = planStore.addNode(tgId, 'ai-task', 'AI Task');
        selectionStore.selectNode(aiId);
      }
      fixture.detectChanges();
    });

    it('should show AI task specific fields', fakeAsync(() => {
      tick();
      fixture.detectChanges();
      const compiled = fixture.nativeElement;
      expect(compiled.textContent).toContain('Intent');
      expect(compiled.textContent).toContain('Target Language');
      expect(compiled.textContent).toContain('Generate Code');
    }));
  });

  describe('Advanced Tab', () => {
    beforeEach(async () => {
      await planStore.loadPlans();
      await planStore.loadPlan('plan-1');
      const root = planStore.rootNode();
      if (root) {
        selectionStore.selectNode(root.id);
      }
      fixture.detectChanges();
    });

    it('should have advanced configuration options', fakeAsync(() => {
      tick();
      fixture.detectChanges();
      const compiled = fixture.nativeElement;
      // These are in the Advanced tab
      expect(compiled.textContent).toContain('Timeout');
      expect(compiled.textContent).toContain('Retry Count');
      expect(compiled.textContent).toContain('Continue on Error');
    }));
  });

  describe('Helper Methods', () => {
    beforeEach(async () => {
      await planStore.loadPlans();
      await planStore.loadPlan('plan-1');
      const root = planStore.rootNode();
      if (root) {
        selectionStore.selectNode(root.id);
      }
      fixture.detectChanges();
    });

    it('should get config value', () => {
      const node = selectionStore.selectedNode();
      if (node) {
        const timeout = component.getConfigValue('timeout');
        expect(timeout).toBeDefined();
      }
    });

    it('should get config string', () => {
      const node = selectionStore.selectedNode();
      if (node) {
        const desc = component.getConfigString('description');
        expect(typeof desc).toBe('string');
      }
    });

    it('should return empty string for non-existent config', () => {
      const node = selectionStore.selectedNode();
      if (node) {
        const nonExistent = component.getConfigString('nonExistentKey');
        expect(nonExistent).toBe('');
      }
    });

    it('should update test strings from newline separated input', () => {
      const node = selectionStore.selectedNode();
      if (node) {
        component.updateTestStrings('string1\nstring2\nstring3');
        const updated = planStore.getNode(node.id);
        expect(updated?.config).toHaveProperty('testStrings');
      }
    });

    it('should get node metadata', () => {
      const metadata = component.nodeMetadata();
      expect(metadata).toBeDefined();
      expect(metadata?.type).toBe('root');
    });
  });

  describe('Code Tab', () => {
    beforeEach(async () => {
      await planStore.loadPlans();
      await planStore.loadPlan('plan-1');
      const root = planStore.rootNode();
      if (root) {
        const tgId = planStore.addNode(root.id, 'thread-group', 'TG');
        const httpId = planStore.addNode(tgId, 'http-request', 'HTTP');
        // Add generated code to the node
        planStore.updateNode(httpId, {
          generatedCode: {
            id: 'code-1',
            nodeId: httpId,
            language: 'java',
            code: 'public void test() {}',
            entryPoint: 'test',
            dependencies: [],
            generatedAt: new Date(),
            generatedBy: 'ai',
            confidence: 0.95,
            isValid: true,
            validationResults: []
          }
        });
        selectionStore.selectNode(httpId);
      }
      fixture.detectChanges();
    });

    it('should show Code tab when node has generated code', fakeAsync(() => {
      tick();
      fixture.detectChanges();
      const tabs = fixture.nativeElement.querySelectorAll('p-tab');
      const tabTexts = Array.from(tabs).map((t: any) => t.textContent);
      expect(tabTexts.some((t: string) => t.includes('Code'))).toBe(true);
    }));
  });
});
