import { Component, inject, ViewChild, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Tree } from 'primeng/tree';
import { ContextMenu } from 'primeng/contextmenu';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Dialog } from 'primeng/dialog';
import { Tooltip } from 'primeng/tooltip';
import { TreeNode as PrimeTreeNode, MenuItem, TreeDragDropService } from 'primeng/api';
import { TestPlanStore, TreeSelectionStore } from '../../../../core/services/state';
import { NodeRegistryService, NodeCategory } from '../../../../core/services/node-registry.service';
import { TreeNode, NodeType } from '../../../../shared/models';
import { NodeTypeIconComponent } from '../../../../shared/components/node-type-icon';

interface ExtendedPrimeTreeNode extends PrimeTreeNode {
  data: TreeNode;
}

@Component({
  selector: 'app-tree-panel',
  standalone: true,
  imports: [
    FormsModule,
    Tree,
    ContextMenu,
    Button,
    InputText,
    Dialog,
    Tooltip,
    NodeTypeIconComponent
  ],
  providers: [TreeDragDropService],
  template: `
    <div class="tree-panel">
      <div class="tree-panel__header">
        <div class="tree-panel__search">
          <i class="pi pi-search"></i>
          <input
            type="text"
            pInputText
            placeholder="Search nodes..."
            [ngModel]="selectionStore.searchQuery()"
            (ngModelChange)="selectionStore.setSearchQuery($event)"
          />
          @if (selectionStore.searchQuery()) {
            <button class="tree-panel__search-clear" (click)="selectionStore.clearSearch()">
              <i class="pi pi-times"></i>
            </button>
          }
        </div>
        <div class="tree-panel__actions">
          <p-button
            icon="pi pi-angle-double-down"
            [text]="true"
            size="small"
            pTooltip="Expand All"
            tooltipPosition="bottom"
            (onClick)="selectionStore.expandAll()"
          />
          <p-button
            icon="pi pi-angle-double-up"
            [text]="true"
            size="small"
            pTooltip="Collapse All"
            tooltipPosition="bottom"
            (onClick)="selectionStore.collapseAll()"
          />
        </div>
      </div>

      <div class="tree-panel__content">
        @if (treeNodes().length === 0) {
          <div class="tree-panel__empty">
            <i class="pi pi-folder-open"></i>
            <span>No test plan loaded</span>
            <span class="tree-panel__empty-hint">Select a test plan from the dropdown above</span>
          </div>
        } @else {
          <p-tree
            [value]="treeNodes()"
            selectionMode="single"
            [selection]="selectedTreeNode()"
            (selectionChange)="onSelectionChange($event)"
            [draggableNodes]="true"
            [droppableNodes]="true"
            [validateDrop]="validateDrop"
            (onNodeDrop)="onNodeDrop($event)"
            [contextMenu]="contextMenu"
            (onNodeContextMenuSelect)="onContextMenuSelect($event)"
            styleClass="tree-panel__tree tree-panel__tree--enhanced-dnd"
          >
            <ng-template let-node pTemplate="default">
              <div
                class="tree-node"
                [class.tree-node--disabled]="node.data?.enabled === false"
                [class.tree-node--highlighted]="selectionStore.highlightedNodeId() === node.data?.id"
              >
                <span class="tree-node__status node-status" [class]="'node-status--' + (node.data?.validationStatus || 'pending')"></span>
                <app-node-type-icon [type]="node.data?.type || 'root'" [size]="14"></app-node-type-icon>
                <span class="tree-node__label">{{ node.label }}</span>
                @if (node.data?.enabled === false) {
                  <i class="pi pi-ban tree-node__disabled-icon" pTooltip="Disabled"></i>
                }
              </div>
            </ng-template>
          </p-tree>
        }
      </div>

      <p-contextMenu #contextMenu [model]="contextMenuItems()"></p-contextMenu>

      <!-- Add Node Dialog -->
      <p-dialog
        header="Add Node"
        [(visible)]="showAddNodeDialog"
        [modal]="true"
        [style]="{ width: '500px', maxHeight: '80vh' }"
        [draggable]="false"
        [resizable]="false"
      >
        <div class="add-node-dialog">
          <div class="add-node-dialog__search">
            <i class="pi pi-search"></i>
            <input
              type="text"
              pInputText
              placeholder="Search node types..."
              [(ngModel)]="nodeTypeSearch"
              (ngModelChange)="onNodeTypeSearchChange()"
            />
          </div>

          <div class="add-node-dialog__categories">
            @for (category of filteredCategories(); track category.name) {
              <div class="node-category">
                <div class="node-category__header">{{ category.label }}</div>
                <div class="node-category__items">
                  @for (nodeType of category.types; track nodeType.type) {
                    <button class="node-type-item" (click)="addNode(nodeType.type)">
                      <app-node-type-icon [type]="nodeType.type" [size]="18"></app-node-type-icon>
                      <div class="node-type-item__info">
                        <span class="node-type-item__label">{{ nodeType.label }}</span>
                        <span class="node-type-item__description">{{ nodeType.description }}</span>
                      </div>
                    </button>
                  }
                </div>
              </div>
            }
          </div>
        </div>
      </p-dialog>
    </div>
  `,
  styles: [`
    .tree-panel {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .tree-panel__header {
      display: flex;
      align-items: center;
      gap: var(--tc-spacing-sm);
      padding: var(--tc-spacing-sm);
      border-bottom: 1px solid var(--tc-border);
    }

    .tree-panel__search {
      flex: 1;
      display: flex;
      align-items: center;
      gap: var(--tc-spacing-sm);
      background: var(--tc-bg-tertiary);
      border-radius: var(--tc-radius-sm);
      padding: 0 var(--tc-spacing-sm);
    }

    .tree-panel__search i {
      color: var(--tc-text-muted);
      font-size: 12px;
    }

    .tree-panel__search input {
      flex: 1;
      border: none;
      background: transparent;
      padding: var(--tc-spacing-xs) 0;
      font-size: 13px;
      color: var(--tc-text-primary);
    }

    .tree-panel__search input:focus {
      outline: none;
      box-shadow: none;
    }

    .tree-panel__search-clear {
      background: none;
      border: none;
      padding: 4px;
      cursor: pointer;
      color: var(--tc-text-muted);
    }

    .tree-panel__search-clear:hover {
      color: var(--tc-text-primary);
    }

    .tree-panel__actions {
      display: flex;
      gap: 2px;
    }

    .tree-panel__content {
      flex: 1;
      overflow: auto;
      padding: var(--tc-spacing-sm);
    }

    .tree-panel__empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--tc-text-muted);
      gap: var(--tc-spacing-sm);
      padding: var(--tc-spacing-xl);
      text-align: center;
    }

    .tree-panel__empty i {
      font-size: 48px;
      opacity: 0.3;
    }

    .tree-panel__empty-hint {
      font-size: 12px;
      opacity: 0.7;
    }

    :host ::ng-deep .tree-panel__tree {
      font-size: 13px;
    }

    :host ::ng-deep .p-tree-node-content {
      padding: 4px 8px;
      border-radius: 4px;
    }

    :host ::ng-deep .p-tree-node-content:hover {
      background: var(--tc-bg-tertiary);
    }

    :host ::ng-deep .p-tree-node-content.p-tree-node-selected {
      background: var(--tc-primary);
    }

    .tree-node {
      display: flex;
      align-items: center;
      gap: var(--tc-spacing-xs);
      padding: 2px 0;
    }

    .tree-node--disabled {
      opacity: 0.5;
    }

    .tree-node--disabled .tree-node__label {
      text-decoration: line-through;
    }

    .tree-node--highlighted {
      background: rgba(99, 102, 241, 0.1);
      border-radius: var(--tc-radius-sm);
    }

    .tree-node__status {
      flex-shrink: 0;
    }

    .tree-node__label {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .tree-node__disabled-icon {
      font-size: 10px;
      color: var(--tc-warning);
    }

    .add-node-dialog {
      display: flex;
      flex-direction: column;
      gap: var(--tc-spacing-md);
      max-height: 60vh;
    }

    .add-node-dialog__search {
      display: flex;
      align-items: center;
      gap: var(--tc-spacing-sm);
      background: var(--tc-bg-tertiary);
      border-radius: var(--tc-radius-sm);
      padding: 0 var(--tc-spacing-sm);
    }

    .add-node-dialog__search i {
      color: var(--tc-text-muted);
    }

    .add-node-dialog__search input {
      flex: 1;
      border: none;
      background: transparent;
      padding: var(--tc-spacing-sm) 0;
      color: var(--tc-text-primary);
    }

    .add-node-dialog__categories {
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: var(--tc-spacing-md);
    }

    .node-category__header {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--tc-text-muted);
      padding: var(--tc-spacing-xs) 0;
      border-bottom: 1px solid var(--tc-border);
      margin-bottom: var(--tc-spacing-xs);
    }

    .node-category__items {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .node-type-item {
      display: flex;
      align-items: center;
      gap: var(--tc-spacing-sm);
      padding: var(--tc-spacing-sm);
      background: transparent;
      border: none;
      border-radius: var(--tc-radius-sm);
      cursor: pointer;
      text-align: left;
      width: 100%;
      transition: background-color var(--tc-transition-fast);
      color: var(--tc-text-primary);
    }

    .node-type-item:hover {
      background: var(--tc-bg-tertiary);
    }

    .node-type-item__info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      overflow: hidden;
    }

    .node-type-item__label {
      font-size: 13px;
      color: var(--tc-text-primary);
    }

    .node-type-item__description {
      font-size: 11px;
      color: var(--tc-text-muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* Enhanced Drag and Drop Styles */
    :host ::ng-deep .tree-panel__tree--enhanced-dnd {
      /* Make drop targets more visible */
    }

    /* Style for node being dragged */
    :host ::ng-deep .p-tree-node-content.p-tree-node-dragover {
      background: var(--tc-primary) !important;
      outline: 2px dashed var(--tc-primary);
      outline-offset: 2px;
      position: relative;
    }

    /* Add "Drop as child" indicator */
    :host ::ng-deep .p-tree-node-content.p-tree-node-dragover::after {
      content: "→ Drop as child";
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 10px;
      font-weight: 600;
      color: white;
      background: var(--tc-primary);
      padding: 2px 6px;
      border-radius: 4px;
      pointer-events: none;
    }

    /* Style for valid drop target (can receive children) */
    :host ::ng-deep .tree-panel__tree--enhanced-dnd .p-tree-node-droppable > .p-tree-node-content {
      transition: all 0.15s ease;
    }

    :host ::ng-deep .tree-panel__tree--enhanced-dnd .p-tree-node-droppable > .p-tree-node-content:hover {
      border-left: 3px solid var(--tc-primary);
      padding-left: 5px;
    }

    /* Style for invalid drop target */
    :host ::ng-deep .p-tree-node-content.p-tree-node-dragover-invalid {
      background: var(--tc-error) !important;
      opacity: 0.5;
    }

    :host ::ng-deep .p-tree-node-content.p-tree-node-dragover-invalid::after {
      content: "✗ Cannot drop here";
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 10px;
      font-weight: 600;
      color: white;
      background: var(--tc-error);
      padding: 2px 6px;
      border-radius: 4px;
      pointer-events: none;
    }

    /* Drop line indicator between nodes */
    :host ::ng-deep .p-tree-drop-indicator {
      background: var(--tc-primary) !important;
      height: 3px !important;
      border-radius: 2px;
      position: relative;
    }

    :host ::ng-deep .p-tree-drop-indicator::before {
      content: "";
      position: absolute;
      left: 0;
      top: -3px;
      width: 8px;
      height: 8px;
      background: var(--tc-primary);
      border-radius: 50%;
    }

    /* Dragging node ghost style */
    :host ::ng-deep .p-tree-node-content.p-tree-node-dragging {
      opacity: 0.6;
      background: var(--tc-bg-tertiary);
    }
  `]
})
export class TreePanelComponent {
  protected readonly planStore = inject(TestPlanStore);
  protected readonly selectionStore = inject(TreeSelectionStore);
  private readonly nodeRegistry = inject(NodeRegistryService);

  @ViewChild('contextMenu') contextMenu!: ContextMenu;

  showAddNodeDialog = false;
  nodeTypeSearch = '';
  private contextMenuNode: TreeNode | null = null;

  readonly treeNodes = signal<ExtendedPrimeTreeNode[]>([]);
  readonly selectedTreeNode = signal<ExtendedPrimeTreeNode | null>(null);
  readonly contextMenuItems = signal<MenuItem[]>([]);
  readonly filteredCategories = signal<{ name: NodeCategory; label: string; types: { type: NodeType; label: string; description: string }[] }[]>([]);

  constructor() {
    this.rebuildTree();
  }

  ngOnInit(): void {
    // Categories are updated when the add node dialog opens
  }

  private lastPlanVersion = 0;

  ngDoCheck(): void {
    const currentRoot = this.planStore.rootNode();
    const currentVersion = this.planStore.version();

    if (currentVersion !== this.lastPlanVersion) {
      this.lastPlanVersion = currentVersion;
      if (currentRoot) {
        const nodes = this.buildPrimeTreeNodes(currentRoot);
        this.treeNodes.set([nodes]);
      }
    }
  }

  private rebuildTree(): void {
    const root = this.planStore.rootNode();
    if (!root) {
      this.treeNodes.set([]);
      return;
    }

    const nodes = this.buildPrimeTreeNodes(root);
    this.treeNodes.set([nodes]);
    this.selectionStore.initFromPlan();
  }

  private buildPrimeTreeNodes(node: TreeNode): ExtendedPrimeTreeNode {
    const children = node.children
      .map((id) => this.planStore.getNode(id))
      .filter((n): n is TreeNode => !!n)
      .sort((a, b) => a.order - b.order)
      .map((child) => this.buildPrimeTreeNodes(child));

    const meta = this.nodeRegistry.get(node.type);

    return {
      key: node.id,
      label: node.name,
      icon: `pi ${meta?.icon ?? 'pi-circle'}`,
      data: node,
      children,
      expanded: node.expanded ?? true,
      draggable: node.type !== 'root',
      droppable: meta?.canHaveChildren ?? false,
      styleClass: !node.enabled ? 'node-disabled' : ''
    };
  }

  onSelectionChange(selection: unknown): void {
    const sel = selection as ExtendedPrimeTreeNode | ExtendedPrimeTreeNode[] | null;
    const node = Array.isArray(sel) ? sel[0] : sel;
    this.selectedTreeNode.set(node ?? null);
    this.selectionStore.selectNode(node?.data?.id ?? null);
  }

  onContextMenuSelect(event: unknown): void {
    const evt = event as { node: ExtendedPrimeTreeNode };
    if (evt.node?.data) {
      this.contextMenuNode = evt.node.data;
      this.buildContextMenu(evt.node.data);
    }
  }

  private buildContextMenu(node: TreeNode): void {
    const meta = this.nodeRegistry.get(node.type);
    const items: MenuItem[] = [];

    if (meta?.canHaveChildren) {
      items.push({
        label: 'Add Child',
        icon: 'pi pi-plus',
        command: () => this.openAddNodeDialog()
      });
      items.push({ separator: true });
    }

    items.push({
      label: 'Duplicate',
      icon: 'pi pi-copy',
      disabled: node.type === 'root',
      command: () => this.duplicateNode(node.id)
    });

    items.push({
      label: node.enabled ? 'Disable' : 'Enable',
      icon: node.enabled ? 'pi pi-ban' : 'pi pi-check',
      command: () => this.toggleEnabled(node.id)
    });

    items.push({ separator: true });

    items.push({
      label: 'Delete',
      icon: 'pi pi-trash',
      disabled: node.type === 'root',
      styleClass: 'p-menuitem-danger',
      command: () => this.deleteNode(node.id)
    });

    this.contextMenuItems.set(items);
  }

  onNodeDrop(event: unknown): void {
    const evt = event as {
      dragNode?: ExtendedPrimeTreeNode;
      dropNode?: ExtendedPrimeTreeNode;
      index?: number;
      dropIndex?: number;
    };
    const dragNodeId = evt.dragNode?.data?.id;
    const dropNodeId = evt.dropNode?.data?.id;
    const dropIndex = evt.dropIndex ?? evt.index ?? 0;

    if (dragNodeId && dropNodeId && dragNodeId !== dropNodeId) {
      this.planStore.moveNode(dragNodeId, dropNodeId, dropIndex);
      this.rebuildTree();
    }
  }

  /**
   * Validates if a drop operation is allowed.
   * Returns true if the drag node can be dropped on the target node.
   */
  validateDrop = (dragNode: ExtendedPrimeTreeNode, dropNode: ExtendedPrimeTreeNode, _dragNodeIndex: number): boolean => {
    // Can't drop onto itself
    if (dragNode?.data?.id === dropNode?.data?.id) {
      return false;
    }

    // Can't drop root node
    if (dragNode?.data?.type === 'root') {
      return false;
    }

    // Check if drop target can have children
    const dropNodeType = dropNode?.data?.type;
    if (!dropNodeType) return false;

    const dropNodeMeta = this.nodeRegistry.get(dropNodeType);
    if (!dropNodeMeta?.canHaveChildren) {
      return false;
    }

    // Check if the dragged node type is allowed as a child
    const dragNodeType = dragNode?.data?.type;
    if (!dragNodeType) return false;

    return dropNodeMeta.allowedChildren.includes(dragNodeType);
  };

  openAddNodeDialog(): void {
    this.nodeTypeSearch = '';
    this.updateFilteredCategories();
    this.showAddNodeDialog = true;
  }

  onNodeTypeSearchChange(): void {
    this.updateFilteredCategories();
  }

  addNode(type: NodeType): void {
    const parentId = this.contextMenuNode?.id ?? this.selectionStore.selectedNodeId();
    if (!parentId) return;

    const nodeId = this.planStore.addNode(parentId, type);
    this.showAddNodeDialog = false;
    this.rebuildTree();
    this.selectionStore.selectNode(nodeId);
  }

  duplicateNode(nodeId: string): void {
    const newNodeId = this.planStore.duplicateNode(nodeId);
    this.rebuildTree();
    this.selectionStore.selectNode(newNodeId);
  }

  toggleEnabled(nodeId: string): void {
    this.planStore.toggleNodeEnabled(nodeId);
    this.rebuildTree();
  }

  deleteNode(nodeId: string): void {
    const node = this.planStore.getNode(nodeId);
    if (!node) return;

    const parentId = node.parentId;
    this.planStore.deleteNode(nodeId);
    this.rebuildTree();

    if (this.selectionStore.selectedNodeId() === nodeId) {
      this.selectionStore.selectNode(parentId);
    }
  }

  private updateFilteredCategories(): void {
    const search = this.nodeTypeSearch.toLowerCase();
    const parentId = this.contextMenuNode?.id ?? this.selectionStore.selectedNodeId();
    const parentNode = parentId ? this.planStore.getNode(parentId) : null;

    // Reorder categories to show Infrastructure earlier (after Samplers and AI)
    const categoryOrder: NodeCategory[] = [
      'sampler',
      'ai',
      'infrastructure',  // Moved up for visibility
      'logic-controller',
      'config-element',
      'timer',
      'pre-processor',
      'post-processor',
      'assertion',
      'listener',
      'thread-group'
    ];

    const categories = categoryOrder
      .map((category) => {
        let types = this.nodeRegistry.getByCategory(category);

        if (parentNode) {
          const parentMeta = this.nodeRegistry.get(parentNode.type);
          if (parentMeta) {
            types = types.filter((t) => parentMeta.allowedChildren.includes(t.type));
          }
        }

        if (search) {
          types = types.filter(
            (t) =>
              t.label.toLowerCase().includes(search) ||
              t.description.toLowerCase().includes(search)
          );
        }

        return {
          name: category,
          label: this.nodeRegistry.getCategoryLabel(category),
          types: types.map((t) => ({
            type: t.type,
            label: t.label,
            description: t.description
          }))
        };
      })
      .filter((cat) => cat.types.length > 0);

    console.log('Filtered categories:', categories.map(c => ({ name: c.name, count: c.types.length })));
    this.filteredCategories.set(categories);
  }
}
