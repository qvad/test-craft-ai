import { Injectable, computed, signal, inject, effect } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TestPlan, TreeNode, NodeType, NodeConfig } from '../../../shared/models';
import { PlansApiService } from '../api/plans-api.service';
import { NodeRegistryService } from '../node-registry.service';
import { getMockPlans, getMockPlanData } from './mock-data';

const STORAGE_KEY = 'testcraft-plans';
const CURRENT_PLAN_KEY = 'testcraft-current-plan';

/**
 * Generates a unique identifier using the Web Crypto API.
 */
function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Central state management for test plans and their tree structure.
 * Uses Angular signals for reactive state management.
 *
 * @description
 * The TestPlanStore manages:
 * - Loading and saving test plans
 * - Tree node operations (add, delete, move, duplicate)
 * - Node state (enabled, expanded, validation status)
 * - Dirty tracking for unsaved changes
 *
 * @example
 * ```typescript
 * // In a component
 * readonly planStore = inject(TestPlanStore);
 *
 * async ngOnInit() {
 *   await this.planStore.loadPlans();
 *   await this.planStore.loadPlan('plan-1');
 * }
 * ```
 */
@Injectable({
  providedIn: 'root'
})
export class TestPlanStore {
  private readonly plansApi = inject(PlansApiService);
  private readonly nodeRegistry = inject(NodeRegistryService);

  // ============================================================
  // State Signals (private, mutable)
  // ============================================================

  private readonly _plan = signal<TestPlan | null>(null);
  private readonly _nodes = signal<Map<string, TreeNode>>(new Map());
  private readonly _isDirty = signal(false);
  private readonly _isLoading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _plans = signal<TestPlan[]>([]);
  private readonly _version = signal(0);

  // ============================================================
  // Public Readonly State
  // ============================================================

  /** Currently loaded test plan */
  readonly plan = this._plan.asReadonly();

  /** All nodes as an array */
  readonly nodes = computed(() => Array.from(this._nodes().values()));

  /** Nodes indexed by ID for fast lookup */
  readonly nodesMap = this._nodes.asReadonly();

  /** Whether there are unsaved changes */
  readonly isDirty = this._isDirty.asReadonly();

  /** Whether a loading operation is in progress */
  readonly isLoading = this._isLoading.asReadonly();

  /** Current error message, if any */
  readonly error = this._error.asReadonly();

  /** List of available test plans */
  readonly plans = this._plans.asReadonly();

  /** Version counter, incremented on every state change */
  readonly version = this._version.asReadonly();

  /** The root node of the current plan's tree */
  readonly rootNode = computed(() => {
    const plan = this._plan();
    if (!plan) return null;
    return this._nodes().get(plan.rootNodeId) ?? null;
  });

  /** Complete tree structure with nested children */
  readonly nodeTree = computed(() => {
    const root = this.rootNode();
    if (!root) return null;
    return this.buildNodeTree(root);
  });

  // ============================================================
  // Tree Building
  // ============================================================

  /**
   * Recursively builds a tree structure from flat node data.
   */
  private buildNodeTree(node: TreeNode): TreeNode & { childNodes: (TreeNode & { childNodes: unknown[] })[] } {
    const children = node.children
      .map((id) => this._nodes().get(id))
      .filter((n): n is TreeNode => !!n)
      .sort((a, b) => a.order - b.order);

    return {
      ...node,
      childNodes: children.map((child) => this.buildNodeTree(child))
    };
  }

  // ============================================================
  // Plan Operations
  // ============================================================

  /**
   * Loads the list of available test plans.
   * Priority: localStorage + Backend API > Mock data
   */
  async loadPlans(): Promise<void> {
    this._isLoading.set(true);
    this._error.set(null);
    try {
      // Merge plans from localStorage and backend
      const localPlans = this.loadPlansFromStorage();
      let backendPlans: TestPlan[] = [];

      // Try loading from backend API
      try {
        const plans = await firstValueFrom(this.plansApi.getPlans());
        backendPlans = (plans || []).map((item: any) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          rootNodeId: '',
          variables: [],
          environments: [],
          createdAt: new Date(item.createdAt),
          updatedAt: new Date(item.updatedAt),
          createdBy: 'api',
          status: 'draft',
        }));
      } catch {
        // Backend unavailable
      }

      // Merge plans, preferring local versions (user's unsaved changes)
      const mergedPlans = new Map<string, TestPlan>();

      // Add mock plans first (for development)
      const mockPlans = getMockPlans();
      mockPlans.forEach(p => mergedPlans.set(p.id, p));

      // Add backend plans
      backendPlans.forEach(p => mergedPlans.set(p.id, p));

      // Add local plans last (highest priority)
      localPlans.forEach(p => mergedPlans.set(p.id, p));

      this._plans.set(Array.from(mergedPlans.values()));
    } catch (e) {
      this._error.set(e instanceof Error ? e.message : 'Failed to load plans');
    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * Loads a specific test plan and its nodes.
   * Priority: localStorage > Backend API > Mock data
   * @param planId - The ID of the plan to load
   */
  async loadPlan(planId: string): Promise<void> {
    this._isLoading.set(true);
    this._error.set(null);
    try {
      // 1. Try loading from localStorage first (user's saved changes)
      const savedData = this.loadPlanFromStorage(planId);
      if (savedData) {
        console.log(`[TestPlanStore] Loading plan from localStorage: ${planId}`, {
          planName: savedData.plan.name,
          nodeCount: savedData.nodes.length,
        });
        this._plan.set(savedData.plan);
        this._nodes.set(new Map(savedData.nodes.map((n) => [n.id, n])));
        this._isDirty.set(false);
        this._version.update((v) => v + 1);
        return;
      }
      console.log(`[TestPlanStore] No localStorage data for plan: ${planId}, trying backend...`);

      // 2. Try loading from backend API (YugabyteDB)
      try {
        const data = await firstValueFrom(this.plansApi.getPlan(planId));
        if (data) {
          // Convert backend format to frontend format
          const plan: TestPlan = {
            id: data.id,
            name: data.name,
            description: data.description,
            rootNodeId: (data as any).nodes?.[0]?.id || '',
            variables: [],
            environments: [],
            createdAt: new Date(data.createdAt),
            updatedAt: new Date(data.updatedAt),
            createdBy: (data as any).createdBy || 'unknown',
            status: 'draft',
          };
          const nodes = (data as any).nodes || [];
          this._plan.set(plan);
          this._nodes.set(new Map(nodes.map((n: TreeNode) => [n.id, n])));
          this._isDirty.set(false);
          this._version.update((v) => v + 1);
          return;
        }
      } catch {
        // Backend unavailable, continue to mock data
      }

      // 3. Fall back to mock data for development
      console.log(`[TestPlanStore] Loading mock data for plan: ${planId}`);
      const { plan, nodes } = getMockPlanData(planId);
      this._plan.set(plan);
      this._nodes.set(new Map(nodes.map((n) => [n.id, n])));
      this._isDirty.set(false);
      this._version.update((v) => v + 1);
    } catch (e) {
      this._error.set(e instanceof Error ? e.message : 'Failed to load plan');
    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * Saves the current plan to the server and localStorage.
   */
  async savePlan(): Promise<void> {
    const plan = this._plan();
    if (!plan) {
      console.warn('[TestPlanStore] savePlan called but no plan is loaded');
      return;
    }

    this._isLoading.set(true);
    this._error.set(null);
    try {
      // Persist to localStorage immediately for reliability
      const nodes = Array.from(this._nodes().values());
      const savedData = {
        plan,
        nodes,
        savedAt: new Date().toISOString(),
      };
      const storageKey = `${CURRENT_PLAN_KEY}-${plan.id}`;
      localStorage.setItem(storageKey, JSON.stringify(savedData));
      console.log(`[TestPlanStore] Plan saved to localStorage: ${storageKey}`, {
        planId: plan.id,
        planName: plan.name,
        nodeCount: nodes.length,
      });

      // Update plans list in localStorage
      const storedPlans = this.loadPlansFromStorage();
      const existingIndex = storedPlans.findIndex(p => p.id === plan.id);
      if (existingIndex >= 0) {
        storedPlans[existingIndex] = { ...plan, updatedAt: new Date() };
      } else {
        storedPlans.push(plan);
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storedPlans));

      // Try to sync to backend API (YugabyteDB)
      try {
        await firstValueFrom(this.plansApi.updatePlan(plan.id, {
          name: plan.name,
          description: plan.description,
        }));
      } catch {
        // Backend unavailable, data is still in localStorage
        console.warn('Backend unavailable, data saved to localStorage');
      }

      this._isDirty.set(false);
    } catch (e) {
      this._error.set(e instanceof Error ? e.message : 'Failed to save plan');
    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * Load plans from localStorage
   */
  private loadPlansFromStorage(): TestPlan[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const plans = JSON.parse(stored);
        console.log(`[TestPlanStore] Loaded ${plans.length} plans from localStorage`);
        return plans;
      }
    } catch (e) {
      console.warn('[TestPlanStore] Failed to load plans from localStorage:', e);
    }
    return [];
  }

  /**
   * Load a specific plan from localStorage
   */
  private loadPlanFromStorage(planId: string): { plan: TestPlan; nodes: TreeNode[] } | null {
    try {
      const storageKey = `${CURRENT_PLAN_KEY}-${planId}`;
      const stored = localStorage.getItem(storageKey);
      console.log(`[TestPlanStore] Checking localStorage for key: ${storageKey}, found: ${!!stored}`);
      if (stored) {
        const data = JSON.parse(stored);
        console.log(`[TestPlanStore] Loaded plan data:`, {
          planName: data.plan?.name,
          nodeCount: data.nodes?.length,
          savedAt: data.savedAt,
        });
        return { plan: data.plan, nodes: data.nodes };
      }
    } catch (e) {
      console.warn('[TestPlanStore] Failed to load plan from localStorage:', e);
    }
    return null;
  }

  /**
   * Creates a new test plan with a root node.
   * @param name - Name of the new plan
   * @param description - Optional description
   * @returns The ID of the created plan
   */
  async createPlan(name: string, description: string = ''): Promise<string> {
    this._isLoading.set(true);
    this._error.set(null);
    try {
      const planId = generateId();
      const rootNodeId = generateId();

      const rootNode: TreeNode = {
        id: rootNodeId,
        testPlanId: planId,
        parentId: null,
        type: 'root',
        name: name,
        order: 0,
        enabled: true,
        config: this.nodeRegistry.getDefaultConfig('root') as NodeConfig,
        generatedCode: null,
        validationStatus: 'pending',
        children: [],
        expanded: true
      };

      const plan: TestPlan = {
        id: planId,
        name,
        description,
        rootNodeId,
        variables: [],
        environments: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'current-user',
        status: 'draft'
      };

      this._plan.set(plan);
      this._nodes.set(new Map([[rootNodeId, rootNode]]));
      this._plans.update((plans) => [...plans, plan]);
      this.markDirty();

      return planId;
    } catch (e) {
      this._error.set(e instanceof Error ? e.message : 'Failed to create plan');
      throw e;
    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * Updates the plan's dependencies.
   * @param dependencies - The new dependencies configuration
   */
  updatePlanDependencies(dependencies: import('../../../shared/models').LanguageDependencies): void {
    const plan = this._plan();
    if (!plan) return;

    const updatedPlan = {
      ...plan,
      dependencies,
      updatedAt: new Date()
    };

    this._plan.set(updatedPlan);
    this.markDirty();
  }

  // ============================================================
  // Node Query Operations
  // ============================================================

  /**
   * Gets a node by its ID.
   * @param nodeId - The node ID to look up
   * @returns The node or undefined if not found
   */
  getNode(nodeId: string): TreeNode | undefined {
    return this._nodes().get(nodeId);
  }

  // ============================================================
  // Node Mutation Operations
  // ============================================================

  /**
   * Updates a node's properties.
   * @param nodeId - The node to update
   * @param updates - Partial node properties to merge
   */
  updateNode(nodeId: string, updates: Partial<TreeNode>): void {
    this.updateNodeInternal(nodeId, (node) => ({ ...node, ...updates }));
  }

  /**
   * Adds a new child node to a parent.
   * @param parentId - The parent node ID
   * @param type - The type of node to create
   * @param name - Optional name (defaults to node type label)
   * @returns The ID of the created node
   */
  addNode(parentId: string, type: NodeType, name?: string): string {
    const parent = this._nodes().get(parentId);
    if (!parent) throw new Error('Parent node not found');

    const metadata = this.nodeRegistry.get(type);
    if (!metadata) throw new Error('Unknown node type');

    const nodeId = generateId();
    const plan = this._plan();

    const newNode: TreeNode = {
      id: nodeId,
      testPlanId: plan?.id ?? '',
      parentId,
      type,
      name: name ?? metadata.label,
      order: parent.children.length,
      enabled: true,
      config: this.nodeRegistry.getDefaultConfig(type) as NodeConfig,
      generatedCode: null,
      validationStatus: 'pending',
      children: [],
      expanded: true
    };

    const nodes = new Map(this._nodes());
    nodes.set(nodeId, newNode);
    nodes.set(parentId, { ...parent, children: [...parent.children, nodeId] });

    this._nodes.set(nodes);
    this.markDirty();

    return nodeId;
  }

  /**
   * Deletes a node and all its descendants.
   * @param nodeId - The node to delete
   */
  deleteNode(nodeId: string): void {
    const nodes = this._nodes();
    const node = nodes.get(nodeId);
    if (!node) return;

    const idsToDelete = this.collectDescendantIds(nodeId);
    idsToDelete.add(nodeId);

    const newNodes = new Map(nodes);
    idsToDelete.forEach((id) => newNodes.delete(id));

    // Update parent's children array
    if (node.parentId) {
      const parent = newNodes.get(node.parentId);
      if (parent) {
        newNodes.set(node.parentId, {
          ...parent,
          children: parent.children.filter((id) => id !== nodeId)
        });
      }
    }

    this._nodes.set(newNodes);
    this.markDirty();
  }

  /**
   * Moves a node to a new parent at a specific index.
   * @param nodeId - The node to move
   * @param newParentId - The new parent node ID
   * @param newIndex - Position in the new parent's children
   */
  moveNode(nodeId: string, newParentId: string, newIndex: number): void {
    const nodes = new Map(this._nodes());
    const node = nodes.get(nodeId);
    if (!node) return;

    const oldParentId = node.parentId;

    // Prevent moving a node to itself or to its own descendant
    if (nodeId === newParentId || this.isDescendant(nodeId, newParentId)) {
      console.warn('Cannot move a node to itself or its descendant');
      return;
    }

    // Step 1: Remove from old parent and reorder old siblings
    if (oldParentId) {
      const oldParent = nodes.get(oldParentId);
      if (oldParent) {
        const filteredChildren = oldParent.children.filter((id) => id !== nodeId);
        nodes.set(oldParentId, {
          ...oldParent,
          children: filteredChildren
        });

        // Reorder remaining siblings in old parent (if different from new parent)
        if (oldParentId !== newParentId) {
          filteredChildren.forEach((id, index) => {
            const sibling = nodes.get(id);
            if (sibling && sibling.order !== index) {
              nodes.set(id, { ...sibling, order: index });
            }
          });
        }
      }
    }

    // Step 2: Get FRESH reference to new parent (important for same-parent moves)
    const newParent = nodes.get(newParentId);
    if (!newParent) return;

    // Step 3: Add to new parent at the specified index
    const newChildren = [...newParent.children];

    // Clamp index to valid range
    const adjustedIndex = Math.min(Math.max(0, newIndex), newChildren.length);

    newChildren.splice(adjustedIndex, 0, nodeId);
    nodes.set(newParentId, { ...newParent, children: newChildren });

    // Step 4: Update node's parent reference
    nodes.set(nodeId, { ...node, parentId: newParentId });

    // Step 5: Reorder all siblings in new parent to update their order property
    const finalParent = nodes.get(newParentId)!;
    finalParent.children.forEach((id, index) => {
      const sibling = nodes.get(id);
      if (sibling && sibling.order !== index) {
        nodes.set(id, { ...sibling, order: index });
      }
    });

    this._nodes.set(nodes);
    this.markDirty();
  }

  /**
   * Checks if potentialDescendant is a descendant of ancestorId
   */
  private isDescendant(ancestorId: string, potentialDescendantId: string): boolean {
    const nodes = this._nodes();
    let current = nodes.get(potentialDescendantId);
    while (current && current.parentId) {
      if (current.parentId === ancestorId) return true;
      current = nodes.get(current.parentId);
    }
    return false;
  }

  /**
   * Creates a deep copy of a node and its descendants.
   * @param nodeId - The node to duplicate
   * @returns The ID of the duplicated node
   */
  duplicateNode(nodeId: string): string {
    const node = this._nodes().get(nodeId);
    if (!node || !node.parentId) throw new Error('Cannot duplicate root node');

    const nodes = new Map(this._nodes());
    const parent = nodes.get(node.parentId);
    if (!parent) throw new Error('Parent not found');

    const clonedNodes = this.deepCloneNode(node, node.parentId);
    clonedNodes.forEach((n) => nodes.set(n.id, n));

    // Insert after original
    const parentChildren = [...parent.children];
    const nodeIndex = parentChildren.indexOf(nodeId);
    parentChildren.splice(nodeIndex + 1, 0, clonedNodes[0].id);
    nodes.set(parent.id, { ...parent, children: parentChildren });

    this._nodes.set(nodes);
    this.markDirty();

    return clonedNodes[0].id;
  }

  /**
   * Toggles a node's enabled state.
   */
  toggleNodeEnabled(nodeId: string): void {
    const node = this._nodes().get(nodeId);
    if (node) {
      this.updateNode(nodeId, { enabled: !node.enabled });
    }
  }

  /**
   * Toggles a node's expanded state.
   */
  toggleNodeExpanded(nodeId: string): void {
    const node = this._nodes().get(nodeId);
    if (node) {
      this.updateNode(nodeId, { expanded: !node.expanded });
    }
  }

  /**
   * Expands all nodes that have children.
   */
  expandAll(): void {
    const nodes = new Map(this._nodes());
    nodes.forEach((node, id) => {
      if (node.children.length > 0) {
        nodes.set(id, { ...node, expanded: true });
      }
    });
    this._nodes.set(nodes);
  }

  /**
   * Collapses all nodes except the root.
   */
  collapseAll(): void {
    const nodes = new Map(this._nodes());
    nodes.forEach((node, id) => {
      if (node.children.length > 0 && node.type !== 'root') {
        nodes.set(id, { ...node, expanded: false });
      }
    });
    this._nodes.set(nodes);
  }

  // ============================================================
  // Private Helper Methods
  // ============================================================

  /**
   * Internal helper for node updates. Reduces code duplication.
   */
  private updateNodeInternal(nodeId: string, updater: (node: TreeNode) => TreeNode): void {
    const nodes = this._nodes();
    const node = nodes.get(nodeId);
    if (!node) return;

    const newNodes = new Map(nodes);
    newNodes.set(nodeId, updater(node));
    this._nodes.set(newNodes);
    this.markDirty();
  }

  /**
   * Marks the store as dirty and increments version.
   */
  private markDirty(): void {
    console.log('[TestPlanStore] markDirty called, setting isDirty=true');
    this._isDirty.set(true);
    this._version.update((v) => v + 1);
  }

  /**
   * Recursively collects all descendant node IDs.
   */
  private collectDescendantIds(nodeId: string): Set<string> {
    const ids = new Set<string>();
    const node = this._nodes().get(nodeId);
    if (!node) return ids;

    node.children.forEach((childId) => {
      ids.add(childId);
      this.collectDescendantIds(childId).forEach((id) => ids.add(id));
    });

    return ids;
  }

  /**
   * Deep clones a node and all its descendants.
   * @returns Array where first element is the cloned root, rest are descendants
   */
  private deepCloneNode(node: TreeNode, newParentId: string): TreeNode[] {
    const newId = generateId();
    const clonedNodes: TreeNode[] = [];

    const clonedChildren: string[] = [];
    node.children.forEach((childId) => {
      const child = this._nodes().get(childId);
      if (child) {
        const childClones = this.deepCloneNode(child, newId);
        clonedChildren.push(childClones[0].id);
        clonedNodes.push(...childClones);
      }
    });

    const clonedNode: TreeNode = {
      ...node,
      id: newId,
      parentId: newParentId,
      name: `${node.name} (Copy)`,
      children: clonedChildren,
      generatedCode: null,
      validationStatus: 'pending'
    };

    return [clonedNode, ...clonedNodes];
  }
}
