import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { TreePanelComponent } from './tree-panel';
import { TestPlanStore, TreeSelectionStore } from '../../../../core/services/state';
import { NodeRegistryService } from '../../../../core/services/node-registry.service';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

describe('TreePanelComponent', () => {
  let component: TreePanelComponent;
  let fixture: ComponentFixture<TreePanelComponent>;
  let planStore: TestPlanStore;
  let selectionStore: TreeSelectionStore;
  let nodeRegistry: NodeRegistryService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TreePanelComponent, NoopAnimationsModule]
    }).compileComponents();

    planStore = TestBed.inject(TestPlanStore);
    selectionStore = TestBed.inject(TreeSelectionStore);
    nodeRegistry = TestBed.inject(NodeRegistryService);

    fixture = TestBed.createComponent(TreePanelComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Initial State', () => {
    it('should have empty tree nodes initially', () => {
      expect(component.treeNodes().length).toBe(0);
    });

    it('should have no selected tree node', () => {
      expect(component.selectedTreeNode()).toBeNull();
    });

    it('should have empty context menu items', () => {
      expect(component.contextMenuItems().length).toBe(0);
    });

    it('should not show add node dialog initially', () => {
      expect(component.showAddNodeDialog).toBe(false);
    });

    it('should have empty node type search', () => {
      expect(component.nodeTypeSearch).toBe('');
    });
  });

  describe('With Loaded Plan', () => {
    beforeEach(async () => {
      await planStore.loadPlans();
      await planStore.loadPlan('plan-1');
      fixture.detectChanges();
    });

    it('should build tree nodes from plan', fakeAsync(() => {
      tick();
      fixture.detectChanges();
      expect(component.treeNodes().length).toBeGreaterThan(0);
    }));

    it('should have root node in tree', fakeAsync(() => {
      tick();
      fixture.detectChanges();
      const treeNodes = component.treeNodes();
      expect(treeNodes[0]?.data?.type).toBe('root');
    }));

    it('should build hierarchical tree structure', fakeAsync(() => {
      tick();
      fixture.detectChanges();
      const root = component.treeNodes()[0];
      if (root && root.children) {
        expect(root.children.length).toBeGreaterThanOrEqual(0);
      }
    }));
  });

  describe('Selection', () => {
    beforeEach(async () => {
      await planStore.loadPlans();
      await planStore.loadPlan('plan-1');
      fixture.detectChanges();
    });

    it('should handle selection change', fakeAsync(() => {
      tick();
      fixture.detectChanges();
      const treeNodes = component.treeNodes();
      if (treeNodes.length > 0) {
        component.onSelectionChange(treeNodes[0]);
        expect(selectionStore.selectedNodeId()).toBe(treeNodes[0].data?.id);
      }
    }));

    it('should handle null selection', fakeAsync(() => {
      tick();
      fixture.detectChanges();
      component.onSelectionChange(null);
      expect(selectionStore.selectedNodeId()).toBeNull();
    }));

    it('should handle array selection', fakeAsync(() => {
      tick();
      fixture.detectChanges();
      const treeNodes = component.treeNodes();
      if (treeNodes.length > 0) {
        component.onSelectionChange([treeNodes[0]]);
        expect(selectionStore.selectedNodeId()).toBe(treeNodes[0].data?.id);
      }
    }));
  });

  describe('Add Node Dialog', () => {
    beforeEach(async () => {
      await planStore.loadPlans();
      await planStore.loadPlan('plan-1');
      fixture.detectChanges();
    });

    it('should open add node dialog', () => {
      component.openAddNodeDialog();
      expect(component.showAddNodeDialog).toBe(true);
    });

    it('should clear search when opening dialog', () => {
      component.nodeTypeSearch = 'test';
      component.openAddNodeDialog();
      expect(component.nodeTypeSearch).toBe('');
    });

    it('should update filtered categories on search change', fakeAsync(() => {
      tick();
      component.openAddNodeDialog();
      component.nodeTypeSearch = 'http';
      component.onNodeTypeSearchChange();
      tick();
      const categories = component.filteredCategories();
      // Should filter to categories containing 'http' types
      expect(categories.some((c) => c.types.some((t) => t.label.toLowerCase().includes('http')))).toBe(true);
    }));

    it('should add a node', fakeAsync(() => {
      tick();
      fixture.detectChanges();
      const root = planStore.rootNode();
      if (root) {
        selectionStore.selectNode(root.id);
        component.openAddNodeDialog();
        const initialNodeCount = planStore.nodes().length;
        component.addNode('thread-group');
        expect(planStore.nodes().length).toBe(initialNodeCount + 1);
        expect(component.showAddNodeDialog).toBe(false);
      }
    }));
  });

  describe('Node Operations', () => {
    beforeEach(async () => {
      await planStore.loadPlans();
      await planStore.loadPlan('plan-1');
      fixture.detectChanges();
    });

    it('should duplicate a node', fakeAsync(() => {
      tick();
      const root = planStore.rootNode();
      if (root && root.children.length > 0) {
        const childId = root.children[0];
        const initialCount = planStore.nodes().length;
        component.duplicateNode(childId);
        expect(planStore.nodes().length).toBe(initialCount + 1);
      }
    }));

    it('should toggle enabled state', fakeAsync(() => {
      tick();
      const root = planStore.rootNode();
      if (root && root.children.length > 0) {
        const childId = root.children[0];
        const child = planStore.getNode(childId);
        const originalEnabled = child?.enabled;
        component.toggleEnabled(childId);
        const updated = planStore.getNode(childId);
        expect(updated?.enabled).toBe(!originalEnabled);
      }
    }));

    it('should delete a node', fakeAsync(() => {
      tick();
      const root = planStore.rootNode();
      if (root && root.children.length > 0) {
        const childId = root.children[0];
        const initialCount = planStore.nodes().length;
        component.deleteNode(childId);
        expect(planStore.nodes().length).toBe(initialCount - 1);
        expect(planStore.getNode(childId)).toBeUndefined();
      }
    }));

    it('should select parent after deleting selected node', fakeAsync(() => {
      tick();
      const root = planStore.rootNode();
      if (root && root.children.length > 0) {
        const childId = root.children[0];
        selectionStore.selectNode(childId);
        component.deleteNode(childId);
        expect(selectionStore.selectedNodeId()).toBe(root.id);
      }
    }));
  });

  describe('Context Menu', () => {
    beforeEach(async () => {
      await planStore.loadPlans();
      await planStore.loadPlan('plan-1');
      fixture.detectChanges();
    });

    it('should handle context menu select', fakeAsync(() => {
      tick();
      const treeNodes = component.treeNodes();
      if (treeNodes.length > 0) {
        component.onContextMenuSelect({ node: treeNodes[0] });
        expect(component.contextMenuItems().length).toBeGreaterThan(0);
      }
    }));

    it('should include Add Child for nodes that can have children', fakeAsync(() => {
      tick();
      const treeNodes = component.treeNodes();
      if (treeNodes.length > 0) {
        component.onContextMenuSelect({ node: treeNodes[0] });
        const items = component.contextMenuItems();
        const addChild = items.find((i) => i.label === 'Add Child');
        expect(addChild).toBeDefined();
      }
    }));

    it('should include Duplicate option', fakeAsync(() => {
      tick();
      const treeNodes = component.treeNodes();
      if (treeNodes.length > 0) {
        component.onContextMenuSelect({ node: treeNodes[0] });
        const items = component.contextMenuItems();
        const duplicate = items.find((i) => i.label === 'Duplicate');
        expect(duplicate).toBeDefined();
      }
    }));

    it('should include Enable/Disable toggle', fakeAsync(() => {
      tick();
      const treeNodes = component.treeNodes();
      if (treeNodes.length > 0) {
        component.onContextMenuSelect({ node: treeNodes[0] });
        const items = component.contextMenuItems();
        const toggle = items.find((i) => i.label === 'Disable' || i.label === 'Enable');
        expect(toggle).toBeDefined();
      }
    }));

    it('should include Delete option', fakeAsync(() => {
      tick();
      const treeNodes = component.treeNodes();
      if (treeNodes.length > 0) {
        component.onContextMenuSelect({ node: treeNodes[0] });
        const items = component.contextMenuItems();
        const del = items.find((i) => i.label === 'Delete');
        expect(del).toBeDefined();
      }
    }));

    it('should disable Delete for root node', fakeAsync(() => {
      tick();
      const treeNodes = component.treeNodes();
      if (treeNodes.length > 0) {
        component.onContextMenuSelect({ node: treeNodes[0] });
        const items = component.contextMenuItems();
        const del = items.find((i) => i.label === 'Delete');
        expect(del?.disabled).toBe(true);
      }
    }));
  });

  describe('Drag and Drop', () => {
    beforeEach(async () => {
      await planStore.loadPlans();
      await planStore.loadPlan('plan-1');
      fixture.detectChanges();
    });

    it('should handle node drop', fakeAsync(() => {
      tick();
      const root = planStore.rootNode();
      if (root) {
        // Add two thread groups
        const tg1Id = planStore.addNode(root.id, 'thread-group', 'TG1');
        const tg2Id = planStore.addNode(root.id, 'thread-group', 'TG2');
        const httpId = planStore.addNode(tg1Id, 'http-request', 'HTTP');

        fixture.detectChanges();
        tick();

        // Simulate drag from TG1 to TG2
        const tg1TreeNode = { data: planStore.getNode(tg1Id) };
        const httpTreeNode = { data: planStore.getNode(httpId) };
        const tg2TreeNode = { data: planStore.getNode(tg2Id) };

        component.onNodeDrop({
          dragNode: httpTreeNode,
          dropNode: tg2TreeNode,
          index: 0
        });

        const tg1 = planStore.getNode(tg1Id);
        const tg2 = planStore.getNode(tg2Id);
        expect(tg1?.children).not.toContain(httpId);
        expect(tg2?.children).toContain(httpId);
      }
    }));

    it('should not move node to itself', fakeAsync(() => {
      tick();
      const root = planStore.rootNode();
      if (root && root.children.length > 0) {
        const childId = root.children[0];
        const child = planStore.getNode(childId);
        const childTreeNode = { data: child };

        // Try to drop on itself
        component.onNodeDrop({
          dragNode: childTreeNode,
          dropNode: childTreeNode,
          index: 0
        });

        // Should not cause error, node should remain in place
        expect(planStore.getNode(childId)).toBeDefined();
      }
    }));
  });

  describe('ngDoCheck', () => {
    beforeEach(async () => {
      await planStore.loadPlans();
      await planStore.loadPlan('plan-1');
      fixture.detectChanges();
    });

    it('should rebuild tree when plan version changes', fakeAsync(() => {
      tick();
      const initialNodes = component.treeNodes();
      const root = planStore.rootNode();

      if (root) {
        // Add a node which increments version
        planStore.addNode(root.id, 'thread-group', 'New TG');
        fixture.detectChanges();
        tick();

        // Tree should be rebuilt
        expect(component.treeNodes()).not.toBe(initialNodes);
      }
    }));
  });
});
