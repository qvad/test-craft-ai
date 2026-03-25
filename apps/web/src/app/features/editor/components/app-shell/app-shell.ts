import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [],
  template: `
    <div class="app-shell">
      <header class="app-shell__toolbar">
        <ng-content select="[toolbar]"></ng-content>
      </header>

      <main class="app-shell__main">
        <div class="app-shell__left-panel" [style.width.%]="leftPanelSize">
          <ng-content select="[leftPanel]"></ng-content>
        </div>

        <div class="app-shell__gutter app-shell__gutter--horizontal"
             (mousedown)="startHorizontalResize($event)"></div>

        <div class="app-shell__right-section">
          <div class="app-shell__center-panel" [style.height]="'calc(' + (100 - bottomPanelSize) + '% - 2px)'">
            <ng-content select="[centerPanel]"></ng-content>
          </div>

          <div class="app-shell__gutter app-shell__gutter--vertical"
               (mousedown)="startVerticalResize($event)"></div>

          <div class="app-shell__bottom-panel" [style.height]="'calc(' + bottomPanelSize + '% - 2px)'">
            <ng-content select="[bottomPanel]"></ng-content>
          </div>
        </div>
      </main>
    </div>
  `,
  styles: [`
    .app-shell {
      display: flex;
      flex-direction: column;
      height: 100vh;
      width: 100vw;
      overflow: hidden;
      background: var(--tc-bg-primary);
    }

    .app-shell__toolbar {
      flex-shrink: 0;
      height: var(--tc-toolbar-height);
      background: var(--tc-bg-secondary);
      border-bottom: 1px solid var(--tc-border);
      z-index: 100;
    }

    .app-shell__main {
      flex: 1;
      display: flex;
      overflow: hidden;
      min-height: 0;
    }

    .app-shell__left-panel {
      height: 100%;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      background: var(--tc-bg-secondary);
      min-width: 200px;
    }

    .app-shell__right-section {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      height: 100%;
    }

    .app-shell__center-panel {
      overflow: hidden;
      background: var(--tc-bg-primary);
      flex-shrink: 0;
    }

    .app-shell__bottom-panel {
      overflow: hidden;
      background: var(--tc-bg-secondary);
      border-top: 1px solid var(--tc-border);
      flex-shrink: 0;
    }

    .app-shell__gutter {
      background: var(--tc-bg-tertiary);
      flex-shrink: 0;
      transition: background-color 0.15s ease;
      cursor: col-resize;
    }

    .app-shell__gutter:hover {
      background: var(--tc-primary);
    }

    .app-shell__gutter--horizontal {
      width: 4px;
      cursor: col-resize;
    }

    .app-shell__gutter--vertical {
      height: 4px;
      cursor: row-resize;
    }
  `]
})
export class AppShellComponent {
  @Input() leftPanelSize = 20;
  @Input() bottomPanelSize = 25;

  @Output() leftPanelSizeChange = new EventEmitter<number>();
  @Output() bottomPanelSizeChange = new EventEmitter<number>();

  private isResizing = false;
  private resizeType: 'horizontal' | 'vertical' = 'horizontal';

  startHorizontalResize(event: MouseEvent): void {
    event.preventDefault();
    this.isResizing = true;
    this.resizeType = 'horizontal';

    const onMouseMove = (e: MouseEvent) => {
      if (!this.isResizing) return;
      const container = (event.target as HTMLElement).closest('.app-shell__main');
      if (container) {
        const rect = container.getBoundingClientRect();
        const newSize = ((e.clientX - rect.left) / rect.width) * 100;
        this.leftPanelSize = Math.max(15, Math.min(50, newSize));
        this.leftPanelSizeChange.emit(this.leftPanelSize);
      }
    };

    const onMouseUp = () => {
      this.isResizing = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  startVerticalResize(event: MouseEvent): void {
    event.preventDefault();
    this.isResizing = true;
    this.resizeType = 'vertical';

    const onMouseMove = (e: MouseEvent) => {
      if (!this.isResizing) return;
      const container = (event.target as HTMLElement).closest('.app-shell__right-section');
      if (container) {
        const rect = container.getBoundingClientRect();
        const newSize = ((rect.bottom - e.clientY) / rect.height) * 100;
        this.bottomPanelSize = Math.max(10, Math.min(70, newSize));
        this.bottomPanelSizeChange.emit(this.bottomPanelSize);
      }
    };

    const onMouseUp = () => {
      this.isResizing = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }
}
