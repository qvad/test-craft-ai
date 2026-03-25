import { TestBed } from '@angular/core/testing';
import { TestPlanStore } from './test-plan.store';

describe('TestPlanStore', () => {
  let store: TestPlanStore;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = TestBed.inject(TestPlanStore);
  });

  it('should be created', () => {
    expect(store).toBeTruthy();
  });

  describe('Initial State', () => {
    it('should have null plan initially', () => {
      expect(store.plan()).toBeNull();
    });

    it('should have empty nodes initially', () => {
      expect(store.nodes()).toEqual([]);
    });

    it('should not be dirty initially', () => {
      expect(store.isDirty()).toBe(false);
    });

    it('should not be loading initially', () => {
      expect(store.isLoading()).toBe(false);
    });

    it('should have no error initially', () => {
      expect(store.error()).toBeNull();
    });

    it('should have version 0 initially', () => {
      expect(store.version()).toBe(0);
    });
  });

  describe('loadPlans', () => {
    it('should load mock plans', async () => {
      await store.loadPlans();
      const plans = store.plans();
      expect(plans.length).toBeGreaterThan(0);
    });

    it('should load at least 2 plans', async () => {
      await store.loadPlans();
      const plans = store.plans();
      expect(plans.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('loadPlan', () => {
    beforeEach(async () => {
      await store.loadPlans();
    });

    it('should load a plan by ID', async () => {
      await store.loadPlan('plan-1');
      expect(store.plan()).not.toBeNull();
      expect(store.plan()?.id).toBe('plan-1');
    });

    it('should load nodes for the plan', async () => {
      await store.loadPlan('plan-1');
      expect(store.nodes().length).toBeGreaterThan(0);
    });

    it('should have a root node after loading', async () => {
      await store.loadPlan('plan-1');
      expect(store.rootNode()).not.toBeNull();
      expect(store.rootNode()?.type).toBe('root');
    });

    it('should increment version when loading plan', async () => {
      const initialVersion = store.version();
      await store.loadPlan('plan-1');
      expect(store.version()).toBeGreaterThan(initialVersion);
    });

    it('should set isDirty to false after loading', async () => {
      await store.loadPlan('plan-1');
      expect(store.isDirty()).toBe(false);
    });
  });

  describe('createPlan', () => {
    it('should create a new plan', async () => {
      const planId = await store.createPlan('My Test Plan', 'A description');
      expect(planId).toBeDefined();
      expect(store.plan()?.name).toBe('My Test Plan');
    });

    it('should create a root node for new plan', async () => {
      await store.createPlan('New Plan');
      expect(store.rootNode()).not.toBeNull();
      expect(store.rootNode()?.type).toBe('root');
    });

    it('should set isDirty to true after creating', async () => {
      await store.createPlan('New Plan');
      expect(store.isDirty()).toBe(true);
    });

    it('should increment version when creating plan', async () => {
      const initialVersion = store.version();
      await store.createPlan('New Plan');
      expect(store.version()).toBeGreaterThan(initialVersion);
    });
  });

  describe('Node Operations', () => {
    beforeEach(async () => {
      await store.loadPlans();
      await store.loadPlan('plan-1');
    });

    describe('getNode', () => {
      it('should get a node by ID', () => {
        const root = store.rootNode();
        if (root) {
          const node = store.getNode(root.id);
          expect(node).toBeDefined();
          expect(node?.id).toBe(root.id);
        }
      });

      it('should return undefined for unknown ID', () => {
        const node = store.getNode('unknown-id');
        expect(node).toBeUndefined();
      });
    });

    describe('updateNode', () => {
      it('should update node name', () => {
        const root = store.rootNode();
        if (root) {
          store.updateNode(root.id, { name: 'Updated Name' });
          const updated = store.getNode(root.id);
          expect(updated?.name).toBe('Updated Name');
        }
      });

      it('should set isDirty after update', () => {
        const root = store.rootNode();
        if (root) {
          store.updateNode(root.id, { name: 'Updated' });
          expect(store.isDirty()).toBe(true);
        }
      });

      it('should increment version after update', () => {
        const root = store.rootNode();
        if (root) {
          const prevVersion = store.version();
          store.updateNode(root.id, { name: 'Updated' });
          expect(store.version()).toBeGreaterThan(prevVersion);
        }
      });
    });

    describe('addNode', () => {
      it('should add a child node', () => {
        const root = store.rootNode();
        if (root) {
          const initialChildCount = root.children.length;
          const newNodeId = store.addNode(root.id, 'thread-group', 'New Thread Group');
          const updatedRoot = store.getNode(root.id);
          expect(updatedRoot?.children.length).toBe(initialChildCount + 1);
          expect(updatedRoot?.children).toContain(newNodeId);
        }
      });

      it('should create node with correct type', () => {
        const root = store.rootNode();
        if (root) {
          const newNodeId = store.addNode(root.id, 'thread-group');
          const newNode = store.getNode(newNodeId);
          expect(newNode?.type).toBe('thread-group');
        }
      });

      it('should increment version after adding node', () => {
        const root = store.rootNode();
        if (root) {
          const prevVersion = store.version();
          store.addNode(root.id, 'thread-group');
          expect(store.version()).toBeGreaterThan(prevVersion);
        }
      });
    });

    describe('deleteNode', () => {
      it('should delete a node', () => {
        const root = store.rootNode();
        if (root && root.children.length > 0) {
          const childId = root.children[0];
          store.deleteNode(childId);
          expect(store.getNode(childId)).toBeUndefined();
        }
      });

      it('should remove node from parent children array', () => {
        const root = store.rootNode();
        if (root && root.children.length > 0) {
          const childId = root.children[0];
          store.deleteNode(childId);
          const updatedRoot = store.getNode(root.id);
          expect(updatedRoot?.children).not.toContain(childId);
        }
      });

      it('should increment version after deleting node', () => {
        const root = store.rootNode();
        if (root && root.children.length > 0) {
          const prevVersion = store.version();
          store.deleteNode(root.children[0]);
          expect(store.version()).toBeGreaterThan(prevVersion);
        }
      });
    });

    describe('duplicateNode', () => {
      it('should create a copy of a node', () => {
        const root = store.rootNode();
        if (root && root.children.length > 0) {
          const childId = root.children[0];
          const originalNode = store.getNode(childId);
          const newNodeId = store.duplicateNode(childId);
          const newNode = store.getNode(newNodeId);

          expect(newNode).toBeDefined();
          expect(newNode?.type).toBe(originalNode?.type);
          expect(newNode?.name).toContain('(Copy)');
        }
      });

      it('should add duplicated node to parent', () => {
        const root = store.rootNode();
        if (root && root.children.length > 0) {
          const childId = root.children[0];
          const initialChildCount = root.children.length;
          store.duplicateNode(childId);
          const updatedRoot = store.getNode(root.id);
          expect(updatedRoot?.children.length).toBe(initialChildCount + 1);
        }
      });
    });

    describe('toggleNodeEnabled', () => {
      it('should toggle node enabled state', () => {
        const root = store.rootNode();
        if (root && root.children.length > 0) {
          const childId = root.children[0];
          const child = store.getNode(childId);
          const originalEnabled = child?.enabled;

          store.toggleNodeEnabled(childId);

          const updated = store.getNode(childId);
          expect(updated?.enabled).toBe(!originalEnabled);
        }
      });
    });

    describe('moveNode', () => {
      it('should move node to new parent', async () => {
        // Create a structure with multiple thread groups
        const root = store.rootNode();
        if (root) {
          const tg1Id = store.addNode(root.id, 'thread-group', 'TG1');
          const tg2Id = store.addNode(root.id, 'thread-group', 'TG2');
          const httpId = store.addNode(tg1Id, 'http-request', 'HTTP');

          // Move HTTP from TG1 to TG2
          store.moveNode(httpId, tg2Id, 0);

          const tg1 = store.getNode(tg1Id);
          const tg2 = store.getNode(tg2Id);
          const http = store.getNode(httpId);

          expect(tg1?.children).not.toContain(httpId);
          expect(tg2?.children).toContain(httpId);
          expect(http?.parentId).toBe(tg2Id);
        }
      });
    });
  });

  describe('Computed Properties', () => {
    beforeEach(async () => {
      await store.loadPlans();
      await store.loadPlan('plan-1');
    });

    it('should compute rootNode correctly', () => {
      const plan = store.plan();
      const root = store.rootNode();
      expect(root).not.toBeNull();
      expect(root?.id).toBe(plan?.rootNodeId);
    });

    it('should compute nodeTree correctly', () => {
      const tree = store.nodeTree();
      expect(tree).not.toBeNull();
      expect(tree?.type).toBe('root');
    });
  });
});
