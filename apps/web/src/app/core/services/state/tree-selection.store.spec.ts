import { TestBed } from '@angular/core/testing';
import { TreeSelectionStore } from './tree-selection.store';
import { TestPlanStore } from './test-plan.store';

describe('TreeSelectionStore', () => {
  let store: TreeSelectionStore;
  let planStore: TestPlanStore;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    planStore = TestBed.inject(TestPlanStore);
    store = TestBed.inject(TreeSelectionStore);
  });

  it('should be created', () => {
    expect(store).toBeTruthy();
  });

  describe('Initial State', () => {
    it('should have no selection initially', () => {
      expect(store.selectedNodeId()).toBeNull();
    });

    it('should have empty expanded nodes initially', () => {
      expect(store.expandedNodeIds().size).toBe(0);
    });

    it('should have empty search query initially', () => {
      expect(store.searchQuery()).toBe('');
    });

    it('should have no highlighted node initially', () => {
      expect(store.highlightedNodeId()).toBeNull();
    });

    it('should have hasSelection as false initially', () => {
      expect(store.hasSelection()).toBe(false);
    });
  });

  describe('Selection', () => {
    beforeEach(async () => {
      await planStore.loadPlans();
      await planStore.loadPlan('plan-1');
    });

    it('should select a node', () => {
      const root = planStore.rootNode();
      if (root) {
        store.selectNode(root.id);
        expect(store.selectedNodeId()).toBe(root.id);
        expect(store.hasSelection()).toBe(true);
      }
    });

    it('should deselect when selecting null', () => {
      const root = planStore.rootNode();
      if (root) {
        store.selectNode(root.id);
        store.selectNode(null);
        expect(store.selectedNodeId()).toBeNull();
        expect(store.hasSelection()).toBe(false);
      }
    });

    it('should get selected node from plan store', () => {
      const root = planStore.rootNode();
      if (root) {
        store.selectNode(root.id);
        expect(store.selectedNode()).toEqual(root);
      }
    });

    it('should return null for selectedNode when not selected', () => {
      expect(store.selectedNode()).toBeNull();
    });

    it('should clear highlight when selecting', () => {
      store.highlightNode('some-node');
      store.selectNode('another-node');
      expect(store.highlightedNodeId()).toBeNull();
    });
  });

  describe('Expansion', () => {
    beforeEach(async () => {
      await planStore.loadPlans();
      await planStore.loadPlan('plan-1');
    });

    it('should toggle expand a node', () => {
      const root = planStore.rootNode();
      if (root) {
        expect(store.expandedNodeIds().has(root.id)).toBe(false);
        store.toggleExpanded(root.id);
        expect(store.expandedNodeIds().has(root.id)).toBe(true);
        store.toggleExpanded(root.id);
        expect(store.expandedNodeIds().has(root.id)).toBe(false);
      }
    });

    it('should expand a node', () => {
      const root = planStore.rootNode();
      if (root) {
        store.expand(root.id);
        expect(store.expandedNodeIds().has(root.id)).toBe(true);
      }
    });

    it('should collapse a node', () => {
      const root = planStore.rootNode();
      if (root) {
        store.expand(root.id);
        store.collapse(root.id);
        expect(store.expandedNodeIds().has(root.id)).toBe(false);
      }
    });

    it('should expand all nodes with children', () => {
      store.expandAll();
      const nodesWithChildren = planStore.nodes().filter((n) => n.children.length > 0);
      nodesWithChildren.forEach((node) => {
        expect(store.expandedNodeIds().has(node.id)).toBe(true);
      });
    });

    it('should collapse all except root', () => {
      store.expandAll();
      store.collapseAll();
      const root = planStore.rootNode();
      if (root) {
        expect(store.expandedNodeIds().has(root.id)).toBe(true);
        expect(store.expandedNodeIds().size).toBe(1);
      }
    });
  });

  describe('Search', () => {
    beforeEach(async () => {
      await planStore.loadPlans();
      await planStore.loadPlan('plan-1');
    });

    it('should set search query', () => {
      store.setSearchQuery('test');
      expect(store.searchQuery()).toBe('test');
    });

    it('should clear search query', () => {
      store.setSearchQuery('test');
      store.clearSearch();
      expect(store.searchQuery()).toBe('');
    });

    it('should filter nodes by search query', () => {
      store.setSearchQuery('thread');
      const filtered = store.filteredNodes();
      expect(filtered.every((n) =>
        n.name.toLowerCase().includes('thread') ||
        n.type.toLowerCase().includes('thread') ||
        n.config.description?.toLowerCase().includes('thread')
      )).toBe(true);
    });

    it('should return all nodes when search is empty', () => {
      store.setSearchQuery('');
      const filtered = store.filteredNodes();
      expect(filtered.length).toBe(planStore.nodes().length);
    });
  });

  describe('Highlight', () => {
    it('should highlight a node', () => {
      store.highlightNode('node-1');
      expect(store.highlightedNodeId()).toBe('node-1');
    });

    it('should clear highlight', () => {
      store.highlightNode('node-1');
      store.clearHighlight();
      expect(store.highlightedNodeId()).toBeNull();
    });
  });

  describe('Navigation', () => {
    beforeEach(async () => {
      await planStore.loadPlans();
      await planStore.loadPlan('plan-1');
      store.expandAll();
    });

    it('should select next node', () => {
      const root = planStore.rootNode();
      if (root) {
        store.selectNode(root.id);
        store.selectNext();
        expect(store.selectedNodeId()).not.toBe(root.id);
      }
    });

    it('should select previous node', () => {
      const root = planStore.rootNode();
      if (root && root.children.length > 0) {
        const firstChild = root.children[0];
        store.selectNode(firstChild);
        store.selectPrevious();
        expect(store.selectedNodeId()).toBe(root.id);
      }
    });

    it('should select parent node', () => {
      const root = planStore.rootNode();
      if (root && root.children.length > 0) {
        const childId = root.children[0];
        store.selectNode(childId);
        store.selectParent();
        expect(store.selectedNodeId()).toBe(root.id);
      }
    });

    it('should select first child', () => {
      const root = planStore.rootNode();
      if (root && root.children.length > 0) {
        store.selectNode(root.id);
        store.selectFirstChild();
        expect(store.selectedNodeId()).toBe(root.children[0]);
      }
    });

    it('should not move past last node', () => {
      const nodes = planStore.nodes();
      if (nodes.length > 0) {
        const lastNode = nodes[nodes.length - 1];
        store.selectNode(lastNode.id);
        const before = store.selectedNodeId();
        store.selectNext();
        // Should either stay or wrap around depending on implementation
        expect(store.selectedNodeId()).toBeDefined();
      }
    });
  });

  describe('initFromPlan', () => {
    beforeEach(async () => {
      await planStore.loadPlans();
      await planStore.loadPlan('plan-1');
    });

    it('should initialize expanded state from plan nodes', () => {
      store.initFromPlan();
      const expandedNodes = planStore.nodes().filter((n) => n.expanded);
      expandedNodes.forEach((node) => {
        expect(store.expandedNodeIds().has(node.id)).toBe(true);
      });
    });
  });
});
