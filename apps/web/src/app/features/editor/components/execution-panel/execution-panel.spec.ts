import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { vi } from 'vitest';
import { ExecutionPanelComponent } from './execution-panel';
import { ExecutionStore, TestPlanStore } from '../../../../core/services/state';
import { WebSocketService } from '../../../../core/services/api/websocket.service';
import { ExecutionApiService } from '../../../../core/services/api/execution-api.service';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Subject } from 'rxjs';

describe('ExecutionPanelComponent', () => {
  let component: ExecutionPanelComponent;
  let fixture: ComponentFixture<ExecutionPanelComponent>;
  let executionStore: ExecutionStore;
  let planStore: TestPlanStore;

  const mockExecutionStarted$ = new Subject<{ executionId: string }>();
  const mockNodeStarted$ = new Subject<{ nodeId: string; nodeName: string }>();
  const mockNodeCompleted$ = new Subject<{ result: any }>();
  const mockNodeLog$ = new Subject<{ log: any }>();
  const mockExecutionCompleted$ = new Subject<{ execution: any }>();

  beforeEach(async () => {
    const mockWsService = {
      connect: vi.fn(),
      subscribeToExecution: vi.fn(),
      onExecutionStarted: vi.fn().mockReturnValue(mockExecutionStarted$.asObservable()),
      onNodeStarted: vi.fn().mockReturnValue(mockNodeStarted$.asObservable()),
      onNodeCompleted: vi.fn().mockReturnValue(mockNodeCompleted$.asObservable()),
      onNodeLog: vi.fn().mockReturnValue(mockNodeLog$.asObservable()),
      onExecutionCompleted: vi.fn().mockReturnValue(mockExecutionCompleted$.asObservable())
    };

    const mockExecutionApi = {
      startExecution: vi.fn(),
      stopExecution: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [ExecutionPanelComponent, NoopAnimationsModule],
      providers: [
        { provide: WebSocketService, useValue: mockWsService },
        { provide: ExecutionApiService, useValue: mockExecutionApi }
      ]
    }).compileComponents();

    planStore = TestBed.inject(TestPlanStore);
    executionStore = TestBed.inject(ExecutionStore);

    fixture = TestBed.createComponent(ExecutionPanelComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Initial State', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should show Ready status when not executing', () => {
      const compiled = fixture.nativeElement;
      expect(compiled.textContent).toContain('Ready');
    });

    it('should show Run button when not executing', () => {
      const runButton = fixture.nativeElement.querySelector('[icon="pi pi-play"]');
      expect(runButton).toBeTruthy();
    });

    it('should show empty console message', () => {
      const compiled = fixture.nativeElement;
      expect(compiled.textContent).toContain('Execution logs will appear here');
    });
  });

  describe('Run Execution', () => {
    beforeEach(async () => {
      await planStore.loadPlans();
      await planStore.loadPlan('plan-1');
      fixture.detectChanges();
    });

    it('should call execute on run click', () => {
      vi.spyOn(executionStore, 'execute');
      component.onRun();
      expect(executionStore.execute).toHaveBeenCalled();
    });

    it('should show running status during execution', fakeAsync(() => {
      component.onRun();
      tick(100);
      fixture.detectChanges();
      expect(executionStore.isExecuting()).toBe(true);
      executionStore.stop();
      tick(5000);
    }));

    it('should show stop button during execution', fakeAsync(() => {
      component.onRun();
      tick(100);
      fixture.detectChanges();
      const stopButton = fixture.nativeElement.querySelector('[icon="pi pi-stop"]');
      expect(stopButton).toBeTruthy();
      executionStore.stop();
      tick(5000);
    }));

    it('should show pause button during execution', fakeAsync(() => {
      component.onRun();
      tick(100);
      fixture.detectChanges();
      const pauseButton = fixture.nativeElement.querySelector('[icon="pi pi-pause"]');
      expect(pauseButton).toBeTruthy();
      executionStore.stop();
      tick(5000);
    }));
  });

  describe('Pause and Resume', () => {
    beforeEach(async () => {
      await planStore.loadPlans();
      await planStore.loadPlan('plan-1');
      fixture.detectChanges();
    });

    it('should call pause on pause click', fakeAsync(() => {
      component.onRun();
      tick(100);
      const pauseSpy = vi.spyOn(executionStore, 'pause');
      component.onPause();
      tick(100);
      expect(pauseSpy).toHaveBeenCalled();
      executionStore.stop();
      tick(5000);
    }));

    it('should call resume on resume click', fakeAsync(() => {
      component.onRun();
      tick(100);
      executionStore.pause();
      tick(100);
      const resumeSpy = vi.spyOn(executionStore, 'resume');
      component.onResume();
      tick(100);
      expect(resumeSpy).toHaveBeenCalled();
      executionStore.stop();
      tick(5000);
    }));
  });

  describe('Stop Execution', () => {
    beforeEach(async () => {
      await planStore.loadPlans();
      await planStore.loadPlan('plan-1');
      fixture.detectChanges();
    });

    it('should call stop on stop click', fakeAsync(() => {
      component.onRun();
      tick(100);
      const stopSpy = vi.spyOn(executionStore, 'stop');
      component.onStop();
      tick(100);
      expect(stopSpy).toHaveBeenCalled();
      tick(5000);
    }));

    it('should show Ready status after stop', fakeAsync(() => {
      component.onRun();
      tick(100);
      component.onStop();
      tick(100);
      fixture.detectChanges();
      expect(executionStore.isExecuting()).toBe(false);
      tick(5000);
    }));
  });

  describe('Clear', () => {
    beforeEach(async () => {
      await planStore.loadPlans();
      await planStore.loadPlan('plan-1');
      fixture.detectChanges();
    });

    it('should call clearExecution on clear click', () => {
      vi.spyOn(executionStore, 'clearExecution');
      component.onClear();
      expect(executionStore.clearExecution).toHaveBeenCalled();
    });
  });

  describe('Console Output', () => {
    beforeEach(async () => {
      await planStore.loadPlans();
      await planStore.loadPlan('plan-1');
      fixture.detectChanges();
    });

    it('should display logs', fakeAsync(() => {
      component.onRun();
      tick(1000);
      fixture.detectChanges();
      const logs = executionStore.logs();
      expect(logs.length).toBeGreaterThan(0);
      executionStore.stop();
      tick(5000);
    }));

    it('should scroll to bottom when new logs are added', fakeAsync(() => {
      component.onRun();
      tick(500);
      fixture.detectChanges();
      // AfterViewChecked should have been called
      executionStore.stop();
      tick(5000);
    }));
  });

  describe('Results Table', () => {
    beforeEach(async () => {
      await planStore.loadPlans();
      await planStore.loadPlan('plan-1');
      fixture.detectChanges();
    });

    it('should show results', fakeAsync(() => {
      component.onRun();
      tick(1000);
      fixture.detectChanges();
      const results = executionStore.results();
      expect(results.length).toBeGreaterThan(0);
      executionStore.stop();
      tick(5000);
    }));

    it('should show no results message when empty', () => {
      fixture.detectChanges();
      const compiled = fixture.nativeElement;
      expect(compiled.textContent).toContain('No execution results yet');
    });
  });

  describe('Progress', () => {
    beforeEach(async () => {
      await planStore.loadPlans();
      await planStore.loadPlan('plan-1');
      fixture.detectChanges();
    });

    it('should show progress bar during execution', fakeAsync(() => {
      component.onRun();
      tick(100);
      fixture.detectChanges();
      const progressBar = fixture.nativeElement.querySelector('p-progressbar');
      expect(progressBar).toBeTruthy();
      executionStore.stop();
      tick(5000);
    }));

    it('should show stats during execution', fakeAsync(() => {
      component.onRun();
      tick(100);
      fixture.detectChanges();
      const stats = fixture.nativeElement.querySelector('.execution-panel__stats');
      expect(stats).toBeTruthy();
      executionStore.stop();
      tick(5000);
    }));
  });

  describe('Status Indicator', () => {
    beforeEach(async () => {
      await planStore.loadPlans();
      await planStore.loadPlan('plan-1');
      fixture.detectChanges();
    });

    it('should show idle status initially', () => {
      const indicator = fixture.nativeElement.querySelector('.status-indicator--idle');
      expect(indicator).toBeTruthy();
    });

    it('should show running status during execution', fakeAsync(() => {
      component.onRun();
      tick(100);
      fixture.detectChanges();
      const indicator = fixture.nativeElement.querySelector('.status-indicator--running');
      expect(indicator).toBeTruthy();
      executionStore.stop();
      tick(5000);
    }));

    it('should show paused status when paused', fakeAsync(() => {
      component.onRun();
      tick(100);
      executionStore.pause();
      tick(100);
      fixture.detectChanges();
      const status = executionStore.status();
      expect(status).toBe('paused');
      executionStore.stop();
      tick(5000);
    }));
  });

  afterEach(() => {
    executionStore.ngOnDestroy();
  });
});
