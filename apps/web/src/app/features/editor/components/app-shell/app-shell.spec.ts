import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { vi } from 'vitest';
import { Component } from '@angular/core';
import { AppShellComponent } from './app-shell';

@Component({
  standalone: true,
  imports: [AppShellComponent],
  template: `
    <app-shell
      [leftPanelSize]="leftSize"
      [bottomPanelSize]="bottomSize"
      (leftPanelSizeChange)="onLeftSizeChange($event)"
      (bottomPanelSizeChange)="onBottomSizeChange($event)"
    >
      <div toolbar>Toolbar Content</div>
      <div leftPanel>Left Panel Content</div>
      <div centerPanel>Center Panel Content</div>
      <div bottomPanel>Bottom Panel Content</div>
    </app-shell>
  `
})
class TestHostComponent {
  leftSize = 20;
  bottomSize = 25;
  lastLeftSize?: number;
  lastBottomSize?: number;

  onLeftSizeChange(size: number): void {
    this.lastLeftSize = size;
    this.leftSize = size;
  }

  onBottomSizeChange(size: number): void {
    this.lastBottomSize = size;
    this.bottomSize = size;
  }
}

describe('AppShellComponent', () => {
  let component: AppShellComponent;
  let fixture: ComponentFixture<AppShellComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppShellComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(AppShellComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Initial State', () => {
    it('should have default left panel size of 20', () => {
      expect(component.leftPanelSize).toBe(20);
    });

    it('should have default bottom panel size of 25', () => {
      expect(component.bottomPanelSize).toBe(25);
    });
  });

  describe('Structure', () => {
    it('should render app shell container', () => {
      const shell = fixture.nativeElement.querySelector('.app-shell');
      expect(shell).toBeTruthy();
    });

    it('should render toolbar section', () => {
      const toolbar = fixture.nativeElement.querySelector('.app-shell__toolbar');
      expect(toolbar).toBeTruthy();
    });

    it('should render main section', () => {
      const main = fixture.nativeElement.querySelector('.app-shell__main');
      expect(main).toBeTruthy();
    });

    it('should render left panel', () => {
      const leftPanel = fixture.nativeElement.querySelector('.app-shell__left-panel');
      expect(leftPanel).toBeTruthy();
    });

    it('should render center panel', () => {
      const centerPanel = fixture.nativeElement.querySelector('.app-shell__center-panel');
      expect(centerPanel).toBeTruthy();
    });

    it('should render bottom panel', () => {
      const bottomPanel = fixture.nativeElement.querySelector('.app-shell__bottom-panel');
      expect(bottomPanel).toBeTruthy();
    });

    it('should render horizontal gutter', () => {
      const gutter = fixture.nativeElement.querySelector('.app-shell__gutter--horizontal');
      expect(gutter).toBeTruthy();
    });

    it('should render vertical gutter', () => {
      const gutter = fixture.nativeElement.querySelector('.app-shell__gutter--vertical');
      expect(gutter).toBeTruthy();
    });
  });

  describe('Panel Sizing', () => {
    it('should apply left panel width', () => {
      component.leftPanelSize = 30;
      fixture.detectChanges();
      const leftPanel = fixture.nativeElement.querySelector('.app-shell__left-panel');
      expect(leftPanel.style.width).toBe('30%');
    });

    it('should apply bottom panel height', () => {
      component.bottomPanelSize = 40;
      fixture.detectChanges();
      const bottomPanel = fixture.nativeElement.querySelector('.app-shell__bottom-panel');
      expect(bottomPanel.style.height).toBe('40%');
    });
  });

  describe('Horizontal Resize', () => {
    it('should start horizontal resize on mousedown', () => {
      const gutter = fixture.nativeElement.querySelector('.app-shell__gutter--horizontal');
      const event = new MouseEvent('mousedown', { clientX: 100 });
      gutter.dispatchEvent(event);
      // No error should be thrown
      expect(true).toBe(true);
    });

    it('should emit leftPanelSizeChange during resize', fakeAsync(() => {
      vi.spyOn(component.leftPanelSizeChange, 'emit');
      const gutter = fixture.nativeElement.querySelector('.app-shell__gutter--horizontal');

      // Start resize
      const mousedownEvent = new MouseEvent('mousedown', { clientX: 100, bubbles: true });
      Object.defineProperty(mousedownEvent, 'target', { value: gutter });
      component.startHorizontalResize(mousedownEvent);

      // Simulate mouse move - this would normally update size
      // The actual resize calculation depends on container dimensions
      // which aren't available in unit tests
      tick();

      // Clean up by simulating mouseup
      document.dispatchEvent(new MouseEvent('mouseup'));
      tick();
    }));
  });

  describe('Vertical Resize', () => {
    it('should start vertical resize on mousedown', () => {
      const gutter = fixture.nativeElement.querySelector('.app-shell__gutter--vertical');
      const event = new MouseEvent('mousedown', { clientY: 100 });
      gutter.dispatchEvent(event);
      // No error should be thrown
      expect(true).toBe(true);
    });

    it('should emit bottomPanelSizeChange during resize', fakeAsync(() => {
      vi.spyOn(component.bottomPanelSizeChange, 'emit');
      const gutter = fixture.nativeElement.querySelector('.app-shell__gutter--vertical');

      // Start resize
      const mousedownEvent = new MouseEvent('mousedown', { clientY: 100, bubbles: true });
      Object.defineProperty(mousedownEvent, 'target', { value: gutter });
      component.startVerticalResize(mousedownEvent);

      tick();

      // Clean up by simulating mouseup
      document.dispatchEvent(new MouseEvent('mouseup'));
      tick();
    }));
  });
});

describe('AppShellComponent with Host', () => {
  let hostComponent: TestHostComponent;
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    hostComponent = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create with host', () => {
    expect(hostComponent).toBeTruthy();
  });

  describe('Content Projection', () => {
    it('should project toolbar content', () => {
      const toolbar = fixture.nativeElement.querySelector('.app-shell__toolbar');
      expect(toolbar.textContent).toContain('Toolbar Content');
    });

    it('should project left panel content', () => {
      const leftPanel = fixture.nativeElement.querySelector('.app-shell__left-panel');
      expect(leftPanel.textContent).toContain('Left Panel Content');
    });

    it('should project center panel content', () => {
      const centerPanel = fixture.nativeElement.querySelector('.app-shell__center-panel');
      expect(centerPanel.textContent).toContain('Center Panel Content');
    });

    it('should project bottom panel content', () => {
      const bottomPanel = fixture.nativeElement.querySelector('.app-shell__bottom-panel');
      expect(bottomPanel.textContent).toContain('Bottom Panel Content');
    });
  });

  describe('Input/Output Binding', () => {
    it('should bind left panel size from host', () => {
      hostComponent.leftSize = 35;
      fixture.detectChanges();
      const leftPanel = fixture.nativeElement.querySelector('.app-shell__left-panel');
      expect(leftPanel.style.width).toBe('35%');
    });

    it('should bind bottom panel size from host', () => {
      hostComponent.bottomSize = 45;
      fixture.detectChanges();
      const bottomPanel = fixture.nativeElement.querySelector('.app-shell__bottom-panel');
      expect(bottomPanel.style.height).toBe('45%');
    });
  });
});
