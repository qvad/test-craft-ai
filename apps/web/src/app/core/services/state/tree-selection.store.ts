import { Injectable, computed, signal, inject, effect, untracked } from '@angular/core';
import { TestPlanStore } from './test-plan.store';
import { TreeNode } from '../../../shared/models';

/**
 * State management for tree view selection and navigation.
 * Handles node selection, expansion state, and search filtering.
 *
 * @description
 * The TreeSelectionStore manages:
 * - Currently selected node
 * - Expanded/collapsed state for tree nodes
 * - Search filtering across nodes
 * - Keyboard navigation (up/down/parent/child)
 *
 * @example
 * ```typescript
 * readonly selectionStore = inject(TreeSelectionStore);
 *
 * // Select a node
 * this.selectionStore.selectNode('node-123');
 *
 * // Get selected node details
 * const node = this.selectionStore.selectedNode();
 *
 * // Search nodes
 * this.selectionStore.setSearchQuery('http');
 * const matches = this.selectionStore.filteredNodes();
 * ```
 */
@Injectable({
  providedIn: 'root'
})
export class TreeSelectionStore {
  private readonly planStore = inject(TestPlanStore);

  // ============================================================
  // State Signals (private, mutable)
  // ============================================================

  private readonly _selectedNodeId = signal<string | null>(null);
  private readonly _expandedNodeIds = signal<Set<string>>(new Set());
  private readonly _searchQuery = signal('');
  private readonly _highlightedNodeId = signal<string | null>(null);

  // ============================================================
  // Public Readonly State
  // ============================================================

  /** ID of the currently selected node */
  readonly selectedNodeId = this._selectedNodeId.asReadonly();

  /** Set of expanded node IDs */
  readonly expandedNodeIds = this._expandedNodeIds.asReadonly();

  /** Current search query */
  readonly searchQuery = this._searchQuery.asReadonly();

  /** ID of temporarily highlighted node (e.g., from search) */
  readonly highlightedNodeId = this._highlightedNodeId.asReadonly();

  /** The currently selected node object */
  readonly selectedNode = computed(() => {
    const id = this._selectedNodeId();
    if (!id) return null;
    return this.planStore.getNode(id) ?? null;
  });

  /** Nodes filtered by search query */
  readonly filteredNodes = computed(() => {
    const query = this._searchQuery().toLowerCase();
    if (!query) return this.planStore.nodes();

    return this.planStore.nodes().filter(
      (node) =>
        node.name.toLowerCase().includes(query) ||
        node.type.toLowerCase().includes(query) ||
        node.config.description?.toLowerCase().includes(query)
    );
  });

  /** Whether any node is selected */
  readonly hasSelection = computed(() => this._selectedNodeId() !== null);

  constructor() {
    // Effect removed to prevent potential infinite loops
    // Path expansion will happen on demand instead
  }

  // ============================================================
  // Selection Actions
  // ============================================================

  /**
   * Selects a node by ID. Pass null to clear selection.
   * @param nodeId - The node ID to select, or null to deselect
   */
  selectNode(nodeId: string | null): void {
    this._selectedNodeId.set(nodeId);
    this._highlightedNodeId.set(null);
  }

  /**
   * Toggles the expanded state of a node.
   * @param nodeId - The node to toggle
   */
  toggleExpanded(nodeId: string): void {
    const expanded = this._expandedNodeIds();
    const newExpanded = new Set(expanded);

    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }

    this._expandedNodeIds.set(newExpanded);

    // Also update the node's expanded state in the store
    this.planStore.toggleNodeExpanded(nodeId);
  }

  /**
   * Expands a node.
   * @param nodeId - The node to expand
   */
  expand(nodeId: string): void {
    const expanded = new Set(this._expandedNodeIds());
    expanded.add(nodeId);
    this._expandedNodeIds.set(expanded);
  }

  /**
   * Collapses a node.
   * @param nodeId - The node to collapse
   */
  collapse(nodeId: string): void {
    const expanded = new Set(this._expandedNodeIds());
    expanded.delete(nodeId);
    this._expandedNodeIds.set(expanded);
  }

  /**
   * Expands all nodes that have children.
   */
  expandAll(): void {
    const allIds = new Set(
      this.planStore.nodes()
        .filter((n) => n.children.length > 0)
        .map((n) => n.id)
    );
    this._expandedNodeIds.set(allIds);
    this.planStore.expandAll();
  }

  /**
   * Collapses all nodes except the root.
   */
  collapseAll(): void {
    const root = this.planStore.rootNode();
    this._expandedNodeIds.set(root ? new Set([root.id]) : new Set());
    this.planStore.collapseAll();
  }

  // ============================================================
  // Search Actions
  // ============================================================

  /**
   * Sets the search query for filtering nodes.
   * @param query - Search text
   */
  setSearchQuery(query: string): void {
    this._searchQuery.set(query);
  }

  /**
   * Clears the search query.
   */
  clearSearch(): void {
    this._searchQuery.set('');
  }

  /**
   * Temporarily highlights a node (e.g., for search results).
   * @param nodeId - The node to highlight
   */
  highlightNode(nodeId: string | null): void {
    this._highlightedNodeId.set(nodeId);
  }

  /**
   * Clears the highlight.
   */
  clearHighlight(): void {
    this._highlightedNodeId.set(null);
  }

  // ============================================================
  // Keyboard Navigation Actions
  // ============================================================

  /**
   * Selects the next visible node (keyboard down arrow).
   */
  selectNext(): void {
    const visibleNodes = this.getVisibleNodes();
    const currentIndex = this.findCurrentIndex(visibleNodes);

    if (currentIndex < visibleNodes.length - 1) {
      this.selectNode(visibleNodes[currentIndex + 1].id);
    }
  }

  /**
   * Selects the previous visible node (keyboard up arrow).
   */
  selectPrevious(): void {
    const visibleNodes = this.getVisibleNodes();
    const currentIndex = this.findCurrentIndex(visibleNodes);

    if (currentIndex > 0) {
      this.selectNode(visibleNodes[currentIndex - 1].id);
    }
  }

  /**
   * Selects the parent of the current node.
   */
  selectParent(): void {
    const selected = this.selectedNode();
    if (selected?.parentId) {
      this.selectNode(selected.parentId);
    }
  }

  /**
   * Expands current node and selects first child.
   */
  selectFirstChild(): void {
    const selected = this.selectedNode();
    if (selected && selected.children.length > 0) {
      this.expand(selected.id);
      this.selectNode(selected.children[0]);
    }
  }

  // ============================================================
  // Private Helper Methods
  // ============================================================

  /**
   * Expands all ancestor nodes to reveal a specific node.
   */
  private expandPathToNode(nodeId: string): void {
    const nodes = this.planStore.nodesMap();
    let current = nodes.get(nodeId);
    const expanded = new Set(this._expandedNodeIds());

    while (current?.parentId) {
      expanded.add(current.parentId);
      current = nodes.get(current.parentId);
    }

    this._expandedNodeIds.set(expanded);
  }

  /**
   * Gets all currently visible nodes based on expansion state.
   */
  private getVisibleNodes(): TreeNode[] {
    const root = this.planStore.rootNode();
    if (!root) return [];

    const visible: TreeNode[] = [];
    this.collectVisibleNodes(root, visible);
    return visible;
  }

  /**
   * Recursively collects visible nodes in tree order.
   */
  private collectVisibleNodes(node: TreeNode, result: TreeNode[]): void {
    result.push(node);

    const expanded = this._expandedNodeIds();
    if (expanded.has(node.id) || node.expanded) {
      const nodes = this.planStore.nodesMap();
      node.children
        .map((id) => nodes.get(id))
        .filter((n): n is TreeNode => !!n)
        .sort((a, b) => a.order - b.order)
        .forEach((child) => this.collectVisibleNodes(child, result));
    }
  }

  /**
   * Finds the index of the selected node in a node array.
   */
  private findCurrentIndex(nodes: TreeNode[]): number {
    const selectedId = this._selectedNodeId();
    if (!selectedId) return -1;
    return nodes.findIndex((n) => n.id === selectedId);
  }

  /**
   * Initializes expanded state from the loaded plan's node data.
   * Call this after loading a new plan.
   */
  initFromPlan(): void {
    const expanded = new Set(
      this.planStore.nodes()
        .filter((n) => n.expanded)
        .map((n) => n.id)
    );
    this._expandedNodeIds.set(expanded);
  }
}
