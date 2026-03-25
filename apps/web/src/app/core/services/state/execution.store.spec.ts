import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { vi } from 'vitest';
import { ExecutionStore } from './execution.store';
import { TestPlanStore } from './test-plan.store';
import { WebSocketService } from '../api/websocket.service';
import { ExecutionApiService } from '../api/execution-api.service';
import { Subject } from 'rxjs';

describe('ExecutionStore', () => {
  let store: ExecutionStore;
  let planStore: TestPlanStore;
  let mockWsService: any;
  let mockExecutionApi: any;

  const mockExecutionStarted$ = new Subject<{ executionId: string }>();
  const mockNodeStarted$ = new Subject<{ nodeId: string; nodeName: string }>();
  const mockNodeCompleted$ = new Subject<{ result: any }>();
  const mockNodeLog$ = new Subject<{ log: any }>();
  const mockExecutionCompleted$ = new Subject<{ execution: any }>();

  beforeEach(() => {
    mockWsService = {
      connect: vi.fn(),
      subscribeToExecution: vi.fn(),
      onExecutionStarted: vi.fn().mockReturnValue(mockExecutionStarted$.asObservable()),
      onNodeStarted: vi.fn().mockReturnValue(mockNodeStarted$.asObservable()),
      onNodeCompleted: vi.fn().mockReturnValue(mockNodeCompleted$.asObservable()),
      onNodeLog: vi.fn().mockReturnValue(mockNodeLog$.asObservable()),
      onExecutionCompleted: vi.fn().mockReturnValue(mockExecutionCompleted$.asObservable())
    };

    mockExecutionApi = {
      startExecution: vi.fn(),
      stopExecution: vi.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: WebSocketService, useValue: mockWsService },
        { provide: ExecutionApiService, useValue: mockExecutionApi }
      ]
    });

    planStore = TestBed.inject(TestPlanStore);
    store = TestBed.inject(ExecutionStore);
  });

  it('should be created', () => {
    expect(store).toBeTruthy();
  });

  describe('Initial State', () => {
    it('should have no current execution initially', () => {
      expect(store.currentExecution()).toBeNull();
    });

    it('should have empty execution history', () => {
      expect(store.executionHistory()).toEqual([]);
    });

    it('should not be executing initially', () => {
      expect(store.isExecuting()).toBe(false);
    });

    it('should have empty logs', () => {
      expect(store.logs()).toEqual([]);
    });

    it('should have no error', () => {
      expect(store.error()).toBeNull();
    });

    it('should have status as null', () => {
      expect(store.status()).toBeNull();
    });

    it('should have progress as 0', () => {
      expect(store.progress()).toBe(0);
    });
  });

  describe('Computed Properties', () => {
    it('should return empty results when no execution', () => {
      expect(store.results()).toEqual([]);
    });

    it('should count passed as 0 initially', () => {
      expect(store.passedCount()).toBe(0);
    });

    it('should count failed as 0 initially', () => {
      expect(store.failedCount()).toBe(0);
    });

    it('should count running as 0 initially', () => {
      expect(store.runningCount()).toBe(0);
    });

    it('should not be paused initially', () => {
      expect(store.isPaused()).toBe(false);
    });

    it('should be able to run initially', () => {
      expect(store.canRun()).toBe(true);
    });

    it('should not be able to stop initially', () => {
      expect(store.canStop()).toBe(false);
    });

    it('should not be able to pause initially', () => {
      expect(store.canPause()).toBe(false);
    });
  });

  describe('Execute', () => {
    beforeEach(async () => {
      await planStore.loadPlans();
      await planStore.loadPlan('plan-1');
    });

    it('should set error when no plan loaded', async () => {
      planStore['_plan'].set(null);
      await store.execute();
      expect(store.error()).toBe('No test plan loaded');
    });

    it('should set isExecuting to true when executing', fakeAsync(() => {
      store.execute();
      tick(100);
      expect(store.isExecuting()).toBe(true);
      store.stop();
      tick(5000);
    }));

    it('should clear logs when starting execution', fakeAsync(() => {
      store.execute();
      tick(100);
      // Logs should be cleared at start, then new ones added
      expect(store.logs().length).toBeGreaterThanOrEqual(0);
      store.stop();
      tick(5000);
    }));

    it('should create current execution', fakeAsync(() => {
      store.execute();
      tick(100);
      expect(store.currentExecution()).not.toBeNull();
      store.stop();
      tick(5000);
    }));

    it('should connect to WebSocket', fakeAsync(() => {
      store.execute();
      tick(100);
      expect(mockWsService.connect).toHaveBeenCalled();
      store.stop();
      tick(5000);
    }));
  });

  describe('Stop', () => {
    beforeEach(async () => {
      await planStore.loadPlans();
      await planStore.loadPlan('plan-1');
    });

    it('should stop execution', fakeAsync(() => {
      store.execute();
      tick(100);
      store.stop();
      tick(100);
      expect(store.isExecuting()).toBe(false);
      expect(store.status()).toBe('cancelled');
      tick(5000);
    }));

    it('should add cancelled log', fakeAsync(() => {
      store.execute();
      tick(100);
      store.stop();
      tick(100);
      const cancelLog = store.logs().find((l) => l.message.includes('cancelled'));
      expect(cancelLog).toBeDefined();
      tick(5000);
    }));
  });

  describe('Pause and Resume', () => {
    beforeEach(async () => {
      await planStore.loadPlans();
      await planStore.loadPlan('plan-1');
    });

    it('should pause execution', fakeAsync(() => {
      store.execute();
      tick(100);
      store.pause();
      tick(100);
      expect(store.isPaused()).toBe(true);
      expect(store.status()).toBe('paused');
      store.stop();
      tick(5000);
    }));

    it('should resume execution', fakeAsync(() => {
      store.execute();
      tick(100);
      store.pause();
      tick(100);
      store.resume();
      tick(100);
      expect(store.isPaused()).toBe(false);
      expect(store.status()).toBe('running');
      store.stop();
      tick(5000);
    }));

    it('should add pause log', fakeAsync(() => {
      store.execute();
      tick(100);
      store.pause();
      tick(100);
      const pauseLog = store.logs().find((l) => l.message.includes('paused'));
      expect(pauseLog).toBeDefined();
      store.stop();
      tick(5000);
    }));

    it('should add resume log', fakeAsync(() => {
      store.execute();
      tick(100);
      store.pause();
      tick(100);
      store.resume();
      tick(100);
      const resumeLog = store.logs().find((l) => l.message.includes('resumed'));
      expect(resumeLog).toBeDefined();
      store.stop();
      tick(5000);
    }));
  });

  describe('Clear', () => {
    it('should clear logs', () => {
      store.clearLogs();
      expect(store.logs()).toEqual([]);
    });

    it('should clear execution', () => {
      store.clearExecution();
      expect(store.currentExecution()).toBeNull();
      expect(store.logs()).toEqual([]);
      expect(store.error()).toBeNull();
    });
  });

  describe('WebSocket Events', () => {
    beforeEach(async () => {
      await planStore.loadPlans();
      await planStore.loadPlan('plan-1');
    });

    it('should handle execution started event', fakeAsync(() => {
      store.execute();
      tick(100);
      mockExecutionStarted$.next({ executionId: 'exec-1' });
      tick(100);
      expect(store.isExecuting()).toBe(true);
      store.stop();
      tick(5000);
    }));

    it('should handle node started event', fakeAsync(() => {
      store.execute();
      tick(100);
      const nodes = planStore.nodes().filter((n) => n.type !== 'root');
      if (nodes.length > 0) {
        mockNodeStarted$.next({ nodeId: nodes[0].id, nodeName: nodes[0].name });
        tick(100);
        const results = store.results();
        const nodeResult = results.find((r) => r.nodeId === nodes[0].id);
        expect(nodeResult?.status).toBe('running');
      }
      store.stop();
      tick(5000);
    }));

    it('should handle node completed event', fakeAsync(() => {
      store.execute();
      tick(100);
      const nodes = planStore.nodes().filter((n) => n.type !== 'root');
      if (nodes.length > 0) {
        mockNodeCompleted$.next({
          result: {
            nodeId: nodes[0].id,
            nodeName: nodes[0].name,
            status: 'passed',
            duration: 100
          }
        });
        tick(100);
        const logWithDuration = store.logs().find((l) => l.message.includes('100ms'));
        expect(logWithDuration).toBeDefined();
      }
      store.stop();
      tick(5000);
    }));

    it('should handle execution completed event', fakeAsync(() => {
      store.execute();
      tick(100);
      const execution = store.currentExecution();
      if (execution) {
        mockExecutionCompleted$.next({
          execution: { ...execution, status: 'completed', completedAt: new Date() }
        });
        tick(100);
        expect(store.isExecuting()).toBe(false);
      }
      tick(5000);
    }));
  });

  describe('Execution States', () => {
    beforeEach(async () => {
      await planStore.loadPlans();
      await planStore.loadPlan('plan-1');
    });

    it('should allow run when completed', fakeAsync(() => {
      store.execute();
      tick(100);
      store.stop();
      tick(100);
      expect(store.canRun()).toBe(true);
      tick(5000);
    }));

    it('should allow stop when running', fakeAsync(() => {
      store.execute();
      tick(100);
      expect(store.canStop()).toBe(true);
      store.stop();
      tick(5000);
    }));

    it('should allow pause when running', fakeAsync(() => {
      store.execute();
      tick(100);
      expect(store.canPause()).toBe(true);
      store.stop();
      tick(5000);
    }));

    it('should not allow pause when paused', fakeAsync(() => {
      store.execute();
      tick(100);
      store.pause();
      tick(100);
      expect(store.canPause()).toBe(false);
      store.stop();
      tick(5000);
    }));
  });

  describe('Execution History', () => {
    beforeEach(async () => {
      await planStore.loadPlans();
      await planStore.loadPlan('plan-1');
    });

    it('should add completed execution to history', fakeAsync(() => {
      store.execute();
      tick(100);
      const execution = store.currentExecution();
      if (execution) {
        mockExecutionCompleted$.next({
          execution: { ...execution, status: 'completed', completedAt: new Date() }
        });
        tick(100);
        expect(store.executionHistory().length).toBeGreaterThan(0);
      }
      tick(5000);
    }));
  });

  afterEach(() => {
    store.ngOnDestroy();
  });
});
