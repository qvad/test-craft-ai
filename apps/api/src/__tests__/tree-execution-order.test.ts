/**
 * Tests for tree execution order.
 *
 * Verifies that nodes are executed in depth-first tree order,
 * not just flat array order.
 */

import { describe, it, expect } from 'vitest';

interface TreeNode {
  id: string;
  parentId: string | null;
  type: string;
  name: string;
  order: number;
  enabled: boolean;
  children: string[];
}

/**
 * Gets nodes in depth-first tree order (same as execution.store.ts)
 */
function getNodesInTreeOrder(allNodes: TreeNode[]): TreeNode[] {
  const result: TreeNode[] = [];
  const nodeMap = new Map(allNodes.map(n => [n.id, n]));

  // Find root nodes (thread-groups or nodes with no parent)
  const rootNodes = allNodes.filter(n =>
    n.type !== 'root' && n.enabled &&
    (n.parentId === null || n.parentId === 'root' || nodeMap.get(n.parentId)?.type === 'root')
  ).sort((a, b) => a.order - b.order);

  // Recursive depth-first traversal
  const traverse = (node: TreeNode) => {
    result.push(node);
    // Get children sorted by order
    const children = node.children
      .map(childId => nodeMap.get(childId))
      .filter((n): n is TreeNode => n !== undefined && n.enabled)
      .sort((a, b) => a.order - b.order);
    for (const child of children) {
      traverse(child);
    }
  };

  for (const root of rootNodes) {
    traverse(root);
  }

  return result;
}

describe('Tree Execution Order', () => {
  it('should execute Docker → Context Setup → JDBC → Assertion in order', () => {
    // Simulates the user's tree structure:
    // Thread Group
    //   └── Docker Run
    //        └── Context Setup
    //        └── JDBC Request
    //             └── Response Assertion
    const nodes: TreeNode[] = [
      {
        id: 'root',
        parentId: null,
        type: 'root',
        name: 'Test Plan',
        order: 0,
        enabled: true,
        children: ['thread-group-1']
      },
      {
        id: 'thread-group-1',
        parentId: 'root',
        type: 'thread-group',
        name: 'User Threads',
        order: 0,
        enabled: true,
        children: ['docker-1']
      },
      {
        id: 'docker-1',
        parentId: 'thread-group-1',
        type: 'docker-run',
        name: 'Docker Run',
        order: 0,
        enabled: true,
        children: ['context-1', 'jdbc-1']
      },
      {
        id: 'context-1',
        parentId: 'docker-1',
        type: 'context-setup',
        name: 'Context Setup',
        order: 0,
        enabled: true,
        children: []
      },
      {
        id: 'jdbc-1',
        parentId: 'docker-1',
        type: 'jdbc-request',
        name: 'JDBC Request',
        order: 1,
        enabled: true,
        children: ['assertion-1']
      },
      {
        id: 'assertion-1',
        parentId: 'jdbc-1',
        type: 'response-assertion',
        name: 'Response Assertion',
        order: 0,
        enabled: true,
        children: []
      }
    ];

    const ordered = getNodesInTreeOrder(nodes);
    const names = ordered.map(n => n.name);

    expect(names).toEqual([
      'User Threads',
      'Docker Run',
      'Context Setup',
      'JDBC Request',
      'Response Assertion'
    ]);
  });

  it('should respect sibling order', () => {
    // Thread Group
    //   └── HTTP 1 (order: 0)
    //   └── HTTP 2 (order: 1)
    //   └── HTTP 3 (order: 2)
    const nodes: TreeNode[] = [
      {
        id: 'root',
        parentId: null,
        type: 'root',
        name: 'Test Plan',
        order: 0,
        enabled: true,
        children: ['tg-1']
      },
      {
        id: 'tg-1',
        parentId: 'root',
        type: 'thread-group',
        name: 'Thread Group',
        order: 0,
        enabled: true,
        children: ['http-1', 'http-2', 'http-3']
      },
      {
        id: 'http-2',  // Inserted out of order in array
        parentId: 'tg-1',
        type: 'http-request',
        name: 'HTTP 2',
        order: 1,
        enabled: true,
        children: []
      },
      {
        id: 'http-3',  // Inserted out of order in array
        parentId: 'tg-1',
        type: 'http-request',
        name: 'HTTP 3',
        order: 2,
        enabled: true,
        children: []
      },
      {
        id: 'http-1',  // Inserted out of order in array
        parentId: 'tg-1',
        type: 'http-request',
        name: 'HTTP 1',
        order: 0,
        enabled: true,
        children: []
      }
    ];

    const ordered = getNodesInTreeOrder(nodes);
    const names = ordered.map(n => n.name);

    // Despite array order being 2, 3, 1, execution order should be 1, 2, 3
    expect(names).toEqual([
      'Thread Group',
      'HTTP 1',
      'HTTP 2',
      'HTTP 3'
    ]);
  });

  it('should do depth-first traversal (visit children before siblings)', () => {
    // Thread Group
    //   └── Loop Controller (order: 0)
    //        └── HTTP inside loop
    //   └── HTTP after loop (order: 1)
    const nodes: TreeNode[] = [
      {
        id: 'root',
        parentId: null,
        type: 'root',
        name: 'Test Plan',
        order: 0,
        enabled: true,
        children: ['tg-1']
      },
      {
        id: 'tg-1',
        parentId: 'root',
        type: 'thread-group',
        name: 'Thread Group',
        order: 0,
        enabled: true,
        children: ['loop-1', 'http-after']
      },
      {
        id: 'loop-1',
        parentId: 'tg-1',
        type: 'loop-controller',
        name: 'Loop Controller',
        order: 0,
        enabled: true,
        children: ['http-inside']
      },
      {
        id: 'http-inside',
        parentId: 'loop-1',
        type: 'http-request',
        name: 'HTTP inside loop',
        order: 0,
        enabled: true,
        children: []
      },
      {
        id: 'http-after',
        parentId: 'tg-1',
        type: 'http-request',
        name: 'HTTP after loop',
        order: 1,
        enabled: true,
        children: []
      }
    ];

    const ordered = getNodesInTreeOrder(nodes);
    const names = ordered.map(n => n.name);

    // HTTP inside loop should come before HTTP after loop (depth-first)
    expect(names).toEqual([
      'Thread Group',
      'Loop Controller',
      'HTTP inside loop',
      'HTTP after loop'
    ]);
  });

  it('should skip disabled nodes', () => {
    const nodes: TreeNode[] = [
      {
        id: 'root',
        parentId: null,
        type: 'root',
        name: 'Test Plan',
        order: 0,
        enabled: true,
        children: ['tg-1']
      },
      {
        id: 'tg-1',
        parentId: 'root',
        type: 'thread-group',
        name: 'Thread Group',
        order: 0,
        enabled: true,
        children: ['http-1', 'http-2', 'http-3']
      },
      {
        id: 'http-1',
        parentId: 'tg-1',
        type: 'http-request',
        name: 'HTTP 1',
        order: 0,
        enabled: true,
        children: []
      },
      {
        id: 'http-2',
        parentId: 'tg-1',
        type: 'http-request',
        name: 'HTTP 2 (disabled)',
        order: 1,
        enabled: false,  // Disabled!
        children: []
      },
      {
        id: 'http-3',
        parentId: 'tg-1',
        type: 'http-request',
        name: 'HTTP 3',
        order: 2,
        enabled: true,
        children: []
      }
    ];

    const ordered = getNodesInTreeOrder(nodes);
    const names = ordered.map(n => n.name);

    expect(names).toEqual([
      'Thread Group',
      'HTTP 1',
      'HTTP 3'
    ]);
    expect(names).not.toContain('HTTP 2 (disabled)');
  });

  it('should handle complex nested structure', () => {
    // Thread Group
    //   └── Docker Run
    //        └── Context Setup
    //        └── Loop Controller
    //             └── JDBC 1
    //             └── JDBC 2
    //                  └── JSON Extractor
    //        └── HTTP Cleanup
    const nodes: TreeNode[] = [
      { id: 'root', parentId: null, type: 'root', name: 'Test Plan', order: 0, enabled: true, children: ['tg'] },
      { id: 'tg', parentId: 'root', type: 'thread-group', name: 'Thread Group', order: 0, enabled: true, children: ['docker'] },
      { id: 'docker', parentId: 'tg', type: 'docker-run', name: 'Docker Run', order: 0, enabled: true, children: ['ctx', 'loop', 'cleanup'] },
      { id: 'ctx', parentId: 'docker', type: 'context-setup', name: 'Context Setup', order: 0, enabled: true, children: [] },
      { id: 'loop', parentId: 'docker', type: 'loop-controller', name: 'Loop Controller', order: 1, enabled: true, children: ['jdbc1', 'jdbc2'] },
      { id: 'jdbc1', parentId: 'loop', type: 'jdbc-request', name: 'JDBC 1', order: 0, enabled: true, children: [] },
      { id: 'jdbc2', parentId: 'loop', type: 'jdbc-request', name: 'JDBC 2', order: 1, enabled: true, children: ['extractor'] },
      { id: 'extractor', parentId: 'jdbc2', type: 'json-extractor', name: 'JSON Extractor', order: 0, enabled: true, children: [] },
      { id: 'cleanup', parentId: 'docker', type: 'http-request', name: 'HTTP Cleanup', order: 2, enabled: true, children: [] }
    ];

    const ordered = getNodesInTreeOrder(nodes);
    const names = ordered.map(n => n.name);

    expect(names).toEqual([
      'Thread Group',
      'Docker Run',
      'Context Setup',
      'Loop Controller',
      'JDBC 1',
      'JDBC 2',
      'JSON Extractor',
      'HTTP Cleanup'
    ]);
  });

  it('should handle multiple thread groups', () => {
    const nodes: TreeNode[] = [
      { id: 'root', parentId: null, type: 'root', name: 'Test Plan', order: 0, enabled: true, children: ['tg1', 'tg2'] },
      { id: 'tg1', parentId: 'root', type: 'thread-group', name: 'Thread Group 1', order: 0, enabled: true, children: ['http1'] },
      { id: 'http1', parentId: 'tg1', type: 'http-request', name: 'HTTP 1', order: 0, enabled: true, children: [] },
      { id: 'tg2', parentId: 'root', type: 'thread-group', name: 'Thread Group 2', order: 1, enabled: true, children: ['http2'] },
      { id: 'http2', parentId: 'tg2', type: 'http-request', name: 'HTTP 2', order: 0, enabled: true, children: [] }
    ];

    const ordered = getNodesInTreeOrder(nodes);
    const names = ordered.map(n => n.name);

    expect(names).toEqual([
      'Thread Group 1',
      'HTTP 1',
      'Thread Group 2',
      'HTTP 2'
    ]);
  });
});

describe('Context Variable Flow', () => {
  it('should allow context-setup variables to flow to sibling nodes', () => {
    // This tests the logical flow, not actual execution
    // In the tree:
    // Docker Run
    //   └── Context Setup (sets pg_connection_url)
    //   └── JDBC Request (uses ${pg_connection_url})
    //
    // Since Context Setup comes before JDBC in depth-first order,
    // the variables set by Context Setup will be available to JDBC

    const nodes: TreeNode[] = [
      { id: 'root', parentId: null, type: 'root', name: 'Test Plan', order: 0, enabled: true, children: ['tg'] },
      { id: 'tg', parentId: 'root', type: 'thread-group', name: 'Thread Group', order: 0, enabled: true, children: ['docker'] },
      { id: 'docker', parentId: 'tg', type: 'docker-run', name: 'Docker Run', order: 0, enabled: true, children: ['ctx', 'jdbc'] },
      { id: 'ctx', parentId: 'docker', type: 'context-setup', name: 'Context Setup', order: 0, enabled: true, children: [] },
      { id: 'jdbc', parentId: 'docker', type: 'jdbc-request', name: 'JDBC Request', order: 1, enabled: true, children: [] }
    ];

    const ordered = getNodesInTreeOrder(nodes);
    const names = ordered.map(n => n.name);

    // Context Setup MUST come before JDBC Request
    const ctxIndex = names.indexOf('Context Setup');
    const jdbcIndex = names.indexOf('JDBC Request');

    expect(ctxIndex).toBeLessThan(jdbcIndex);
    expect(names).toEqual([
      'Thread Group',
      'Docker Run',
      'Context Setup',
      'JDBC Request'
    ]);
  });
});
