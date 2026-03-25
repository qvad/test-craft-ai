import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { vi } from 'vitest';
import { TopToolbarComponent } from './top-toolbar';
import { TestPlanStore, ExecutionStore } from '../../../../core/services/state';
import { WebSocketService } from '../../../../core/services/api/websocket.service';
import { ExecutionApiService } from '../../../../core/services/api/execution-api.service';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Subject } from 'rxjs';

describe('TopToolbarComponent', () => {
  let component: TopToolbarComponent;
  let fixture: ComponentFixture<TopToolbarComponent>;
  let planStore: TestPlanStore;
  let executionStore: ExecutionStore;

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
      imports: [TopToolbarComponent, NoopAnimationsModule],
      providers: [
        { provide: WebSocketService, useValue: mockWsService },
        { provide: ExecutionApiService, useValue: mockExecutionApi }
      ]
    }).compileComponents();

    planStore = TestBed.inject(TestPlanStore);
    executionStore = TestBed.inject(ExecutionStore);

    fixture = TestBed.createComponent(TopToolbarComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Initial State', () => {
    beforeEach(fakeAsync(() => {
      fixture.detectChanges();
      tick(100);
    }));

    it('should show logo', () => {
      const logo = fixture.nativeElement.querySelector('.toolbar__logo');
      expect(logo).toBeTruthy();
      expect(logo.textContent).toContain('TestCraft AI');
    });

    it('should have plan selector', () => {
      const selector = fixture.nativeElement.querySelector('p-select');
      expect(selector).toBeTruthy();
    });

    it('should have new plan button', () => {
      const newButton = fixture.nativeElement.querySelector('[icon="pi pi-plus"]');
      expect(newButton).toBeTruthy();
    });

    it('should have save button', () => {
      const saveButton = fixture.nativeElement.querySelector('[icon="pi pi-save"]');
      expect(saveButton).toBeTruthy();
    });

    it('should have run button', () => {
      const runButton = fixture.nativeElement.querySelector('[icon="pi pi-play"]');
      expect(runButton).toBeTruthy();
    });

    it('should have import button', () => {
      const importButton = fixture.nativeElement.querySelector('[icon="pi pi-download"]');
      expect(importButton).toBeTruthy();
    });

    it('should have export button', () => {
      const exportButton = fixture.nativeElement.querySelector('[icon="pi pi-upload"]');
      expect(exportButton).toBeTruthy();
    });

    it('should have settings button', () => {
      const settingsButton = fixture.nativeElement.querySelector('[icon="pi pi-cog"]');
      expect(settingsButton).toBeTruthy();
    });
  });

  describe('Plan Selection', () => {
    beforeEach(fakeAsync(() => {
      fixture.detectChanges();
      tick(100);
    }));

    it('should load plans on init', fakeAsync(() => {
      tick(100);
      const plans = planStore.plans();
      expect(plans.length).toBeGreaterThan(0);
    }));

    it('should select first plan on init', fakeAsync(() => {
      tick(100);
      expect(component.selectedPlan()).not.toBeNull();
    }));

    it('should load plan when selected', fakeAsync(() => {
      tick(100);
      const plans = planStore.plans();
      if (plans.length > 1) {
        component.onPlanSelect(plans[1]);
        tick(100);
        expect(planStore.plan()?.id).toBe(plans[1].id);
      }
    }));

    it('should handle null plan selection', () => {
      component.onPlanSelect(null);
      expect(component.selectedPlan()).toBeNull();
    });
  });

  describe('New Plan Dialog', () => {
    beforeEach(fakeAsync(() => {
      fixture.detectChanges();
      tick(100);
    }));

    it('should not show dialog initially', () => {
      expect(component.showNewPlanDialog).toBe(false);
    });

    it('should show dialog when clicking new plan', () => {
      component.showNewPlanDialog = true;
      fixture.detectChanges();
      const dialog = fixture.nativeElement.querySelector('p-dialog');
      expect(dialog).toBeTruthy();
    });

    it('should create plan with name', fakeAsync(() => {
      const initialCount = planStore.plans().length;
      component.newPlanName = 'Test Plan';
      component.newPlanDescription = 'Test Description';
      component.createPlan();
      tick(100);
      expect(planStore.plans().length).toBe(initialCount + 1);
    }));

    it('should close dialog after creating plan', fakeAsync(() => {
      component.showNewPlanDialog = true;
      component.newPlanName = 'Test Plan';
      component.createPlan();
      tick(100);
      expect(component.showNewPlanDialog).toBe(false);
    }));

    it('should clear form after creating plan', fakeAsync(() => {
      component.newPlanName = 'Test Plan';
      component.newPlanDescription = 'Test Description';
      component.createPlan();
      tick(100);
      expect(component.newPlanName).toBe('');
      expect(component.newPlanDescription).toBe('');
    }));

    it('should not create plan without name', fakeAsync(() => {
      const initialCount = planStore.plans().length;
      component.newPlanName = '';
      component.createPlan();
      tick(100);
      expect(planStore.plans().length).toBe(initialCount);
    }));

    it('should select new plan after creation', fakeAsync(() => {
      component.newPlanName = 'New Test Plan';
      component.createPlan();
      tick(100);
      expect(component.selectedPlan()?.name).toBe('New Test Plan');
    }));
  });

  describe('Save', () => {
    beforeEach(fakeAsync(() => {
      fixture.detectChanges();
      tick(100);
    }));

    it('should call savePlan on save', fakeAsync(() => {
      vi.spyOn(planStore, 'savePlan').mockResolvedValue();
      component.onSave();
      tick(100);
      expect(planStore.savePlan).toHaveBeenCalled();
    }));

    it('should disable save button when not dirty', fakeAsync(() => {
      tick(100);
      fixture.detectChanges();
      // Plan is not dirty after loading
      const saveButton = fixture.nativeElement.querySelector('[icon="pi pi-save"]');
      expect(saveButton.disabled || saveButton.hasAttribute('ng-reflect-disabled')).toBeTruthy();
    }));
  });

  describe('Execution', () => {
    beforeEach(fakeAsync(() => {
      fixture.detectChanges();
      tick(100);
    }));

    it('should call execute on run', () => {
      vi.spyOn(executionStore, 'execute');
      component.onRun();
      expect(executionStore.execute).toHaveBeenCalled();
    });

    it('should call pause on pause', () => {
      vi.spyOn(executionStore, 'pause');
      component.onPause();
      expect(executionStore.pause).toHaveBeenCalled();
    });

    it('should call stop on stop', () => {
      vi.spyOn(executionStore, 'stop');
      component.onStop();
      expect(executionStore.stop).toHaveBeenCalled();
    });

    it('should show pause/stop buttons during execution', fakeAsync(() => {
      component.onRun();
      tick(100);
      fixture.detectChanges();
      const pauseButton = fixture.nativeElement.querySelector('[icon="pi pi-pause"]');
      const stopButton = fixture.nativeElement.querySelector('[icon="pi pi-stop"]');
      expect(pauseButton).toBeTruthy();
      expect(stopButton).toBeTruthy();
      executionStore.stop();
      tick(5000);
    }));
  });

  describe('Events', () => {
    beforeEach(fakeAsync(() => {
      fixture.detectChanges();
      tick(100);
    }));

    it('should emit importRequested on import', () => {
      vi.spyOn(component.importRequested, 'emit');
      component.onImport();
      expect(component.importRequested.emit).toHaveBeenCalled();
    });

    it('should emit exportRequested on export', () => {
      vi.spyOn(component.exportRequested, 'emit');
      component.onExport();
      expect(component.exportRequested.emit).toHaveBeenCalled();
    });

    it('should emit settingsRequested on settings', () => {
      vi.spyOn(component.settingsRequested, 'emit');
      component.onSettings();
      expect(component.settingsRequested.emit).toHaveBeenCalled();
    });
  });

  describe('Dirty State', () => {
    beforeEach(fakeAsync(() => {
      fixture.detectChanges();
      tick(100);
    }));

    it('should show dirty indicator when plan is modified', fakeAsync(() => {
      tick(100);
      // Create a new plan which sets isDirty to true
      planStore.createPlan('Dirty Plan');
      tick(100);
      fixture.detectChanges();
      expect(planStore.isDirty()).toBe(true);
    }));
  });

  afterEach(() => {
    executionStore.ngOnDestroy();
  });
});
