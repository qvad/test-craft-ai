import { Component, Input, inject, computed, signal } from '@angular/core';
import { NodeType } from '../models';
import { NodeRegistryService } from '../../core/services/node-registry.service';

@Component({
  selector: 'app-node-type-icon',
  standalone: true,
  template: `
    <i
      [class]="iconClass()"
      [style.color]="color()"
      [style.font-size.px]="size"
    ></i>
  `,
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    i {
      line-height: 1;
    }
  `]
})
export class NodeTypeIconComponent {
  private readonly registry = inject(NodeRegistryService);

  @Input({ required: true }) set type(value: NodeType) {
    this._type.set(value);
  }
  @Input() size = 16;
  @Input() showColor = true;

  private readonly _type = signal<NodeType>('root');

  readonly iconClass = computed(() => {
    const meta = this.registry.get(this._type());
    return `pi ${meta?.icon ?? 'pi-circle'}`;
  });

  readonly color = computed(() => {
    if (!this.showColor) return 'inherit';
    const meta = this.registry.get(this._type());
    return meta?.color ?? 'var(--tc-text-secondary)';
  });
}
