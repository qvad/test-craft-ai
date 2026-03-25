import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseApiService } from './base-api.service';
import { TestPlan, TreeNode } from '../../../shared/models';

/** Request payload for creating a new test plan */
export interface CreatePlanRequest {
  name: string;
  description?: string;
}

/** Request payload for updating a test plan */
export interface UpdatePlanRequest {
  name?: string;
  description?: string;
}

/** Request payload for creating a new tree node */
export interface CreateNodeRequest {
  parentId: string | null;
  type: string;
  name: string;
  config?: Partial<TreeNode['config']>;
}

/** Request payload for updating a tree node */
export interface UpdateNodeRequest {
  name?: string;
  enabled?: boolean;
  config?: Partial<TreeNode['config']>;
}

/** Request payload for moving a node to a new parent */
export interface MoveNodeRequest {
  newParentId: string;
  newIndex: number;
}

/**
 * API service for test plan and tree node CRUD operations.
 * Extends BaseApiService for standardized HTTP handling.
 *
 * @example
 * ```typescript
 * const plansApi = inject(PlansApiService);
 *
 * // Get all plans
 * plansApi.getPlans().subscribe(plans => console.log(plans));
 *
 * // Create a new plan
 * plansApi.createPlan({ name: 'My Plan' }).subscribe(plan => {
 *   console.log('Created:', plan.id);
 * });
 * ```
 */
@Injectable({
  providedIn: 'root'
})
export class PlansApiService extends BaseApiService {
  // ============================================================
  // Test Plan Operations
  // ============================================================

  /** Gets all test plans for the current user */
  getPlans(): Observable<TestPlan[]> {
    return this.get<TestPlan[]>('/plans');
  }

  /** Gets a single test plan by ID */
  getPlan(id: string): Observable<TestPlan> {
    return this.get<TestPlan>(`/plans/${id}`);
  }

  /** Creates a new test plan */
  createPlan(request: CreatePlanRequest): Observable<TestPlan> {
    return this.post<TestPlan>('/plans', request);
  }

  /** Updates an existing test plan */
  updatePlan(id: string, request: UpdatePlanRequest): Observable<TestPlan> {
    return this.put<TestPlan>(`/plans/${id}`, request);
  }

  /** Deletes a test plan and all its nodes */
  deletePlan(id: string): Observable<void> {
    return this.delete<void>(`/plans/${id}`);
  }

  /** Creates a duplicate of a test plan */
  duplicatePlan(id: string): Observable<TestPlan> {
    return this.post<TestPlan>(`/plans/${id}/duplicate`, {});
  }

  /**
   * Exports a test plan in the specified format.
   * @param id - Plan ID to export
   * @param format - Export format (hocon or json)
   */
  exportPlan(id: string, format: 'hocon' | 'json' = 'hocon'): Observable<string> {
    return this.get<string>(`/plans/${id}/export`, { format });
  }

  /**
   * Imports a test plan from content.
   * @param content - Plan content to import
   * @param format - Content format (hocon or json)
   */
  importPlan(content: string, format: 'hocon' | 'json' = 'hocon'): Observable<TestPlan> {
    return this.post<TestPlan>('/plans/import', { content, format });
  }

  // ============================================================
  // Tree Node Operations
  // ============================================================

  /** Gets all nodes for a test plan */
  getNodes(planId: string): Observable<TreeNode[]> {
    return this.get<TreeNode[]>(`/plans/${planId}/nodes`);
  }

  /** Gets a single node by ID */
  getNode(planId: string, nodeId: string): Observable<TreeNode> {
    return this.get<TreeNode>(`/plans/${planId}/nodes/${nodeId}`);
  }

  /** Creates a new node in a test plan */
  createNode(planId: string, request: CreateNodeRequest): Observable<TreeNode> {
    return this.post<TreeNode>(`/plans/${planId}/nodes`, request);
  }

  /** Updates an existing node */
  updateNode(planId: string, nodeId: string, request: UpdateNodeRequest): Observable<TreeNode> {
    return this.put<TreeNode>(`/plans/${planId}/nodes/${nodeId}`, request);
  }

  /** Deletes a node and its descendants */
  deleteNode(planId: string, nodeId: string): Observable<void> {
    return this.delete<void>(`/plans/${planId}/nodes/${nodeId}`);
  }

  /** Moves a node to a new parent at a specific index */
  moveNode(planId: string, nodeId: string, request: MoveNodeRequest): Observable<TreeNode> {
    return this.post<TreeNode>(`/plans/${planId}/nodes/${nodeId}/move`, request);
  }

  /** Creates a duplicate of a node and its descendants */
  duplicateNode(planId: string, nodeId: string): Observable<TreeNode> {
    return this.post<TreeNode>(`/plans/${planId}/nodes/${nodeId}/duplicate`, {});
  }

  // ============================================================
  // Code Generation Operations
  // ============================================================

  /** Generates code for an AI node */
  generateCode(nodeId: string): Observable<TreeNode> {
    return this.post<TreeNode>(`/nodes/${nodeId}/generate`, {});
  }

  /** Regenerates code for an AI node */
  regenerateCode(nodeId: string): Observable<TreeNode> {
    return this.post<TreeNode>(`/nodes/${nodeId}/regenerate`, {});
  }

  /** Updates generated code manually */
  updateCode(nodeId: string, code: string): Observable<TreeNode> {
    return this.put<TreeNode>(`/nodes/${nodeId}/code`, { code });
  }

  // ============================================================
  // Validation Operations
  // ============================================================

  /** Validates a single node's configuration */
  validateNode(nodeId: string): Observable<TreeNode> {
    return this.post<TreeNode>(`/nodes/${nodeId}/validate`, {});
  }

  /** Validates an entire test plan */
  validatePlan(planId: string): Observable<TestPlan> {
    return this.post<TestPlan>(`/plans/${planId}/validate`, {});
  }
}
