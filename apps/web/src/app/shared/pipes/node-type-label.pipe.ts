import { Pipe, PipeTransform, inject } from '@angular/core';
import { NodeType } from '../models';
import { NodeRegistryService } from '../../core/services/node-registry.service';

@Pipe({
  name: 'nodeTypeLabel',
  standalone: true
})
export class NodeTypeLabelPipe implements PipeTransform {
  private readonly registry = inject(NodeRegistryService);

  transform(type: NodeType): string {
    return this.registry.get(type)?.label ?? type;
  }
}
