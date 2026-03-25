/**
 * Test Plan Storage Service
 *
 * Handles storage and retrieval of test plans in HOCON format.
 * Supports file-based and database storage.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/yugabyte-client.js';
import { HoconParser, HoconSerializer, hoconParser, hoconSerializer } from './parser.js';
import { logger } from '../../common/logger.js';
import type { HoconTestPlan, HoconPlanDefinition } from '@testcraft/shared-types';

export interface StoredTestPlan {
  id: string;
  name: string;
  description?: string;
  hoconContent: string;
  version: number;
  tags: string[];
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestPlanListItem {
  id: string;
  name: string;
  description?: string;
  tags: string[];
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SaveOptions {
  createVersion?: boolean;
  author?: string;
}

export class TestPlanStorage {
  private basePath: string;
  private useDatabase: boolean;

  constructor(options: { basePath?: string; useDatabase?: boolean } = {}) {
    this.basePath = options.basePath || path.join(process.cwd(), 'test-plans');
    this.useDatabase = options.useDatabase ?? true;
  }

  /**
   * Save test plan (from HOCON string)
   */
  async save(
    hoconContent: string,
    options: SaveOptions = {}
  ): Promise<StoredTestPlan> {
    // Parse to validate and extract metadata
    const parseResult = await hoconParser.parse(hoconContent);
    if (parseResult.errors.length > 0) {
      throw new Error(`Invalid HOCON: ${parseResult.errors.map((e) => e.message).join(', ')}`);
    }

    const plan = parseResult.plan.testcraft.plan;
    const id = uuidv4();
    const now = new Date();

    const stored: StoredTestPlan = {
      id,
      name: plan.name,
      description: plan.description,
      hoconContent,
      version: 1,
      tags: plan.tags || [],
      createdBy: options.author,
      createdAt: now,
      updatedAt: now,
    };

    if (this.useDatabase) {
      await this.saveToDatabase(stored);
    } else {
      await this.saveToFile(stored);
    }

    logger.info({ id, name: plan.name }, 'Test plan saved');
    return stored;
  }

  /**
   * Save test plan from parsed object
   */
  async saveFromObject(
    testPlan: HoconTestPlan,
    options: SaveOptions = {}
  ): Promise<StoredTestPlan> {
    const hoconContent = hoconSerializer.serialize(testPlan);
    return this.save(hoconContent, options);
  }

  /**
   * Update existing test plan
   */
  async update(
    id: string,
    hoconContent: string,
    options: SaveOptions = {}
  ): Promise<StoredTestPlan> {
    const existing = await this.get(id);
    if (!existing) {
      throw new Error(`Test plan not found: ${id}`);
    }

    // Parse to validate
    const parseResult = await hoconParser.parse(hoconContent);
    if (parseResult.errors.length > 0) {
      throw new Error(`Invalid HOCON: ${parseResult.errors.map((e) => e.message).join(', ')}`);
    }

    const plan = parseResult.plan.testcraft.plan;
    const now = new Date();

    const updated: StoredTestPlan = {
      ...existing,
      name: plan.name,
      description: plan.description,
      hoconContent,
      version: options.createVersion ? existing.version + 1 : existing.version,
      tags: plan.tags || [],
      updatedAt: now,
    };

    if (this.useDatabase) {
      await this.updateInDatabase(updated);
    } else {
      await this.saveToFile(updated);
    }

    logger.info({ id, name: plan.name, version: updated.version }, 'Test plan updated');
    return updated;
  }

  /**
   * Get test plan by ID
   */
  async get(id: string): Promise<StoredTestPlan | null> {
    if (this.useDatabase) {
      return this.getFromDatabase(id);
    }
    return this.getFromFile(id);
  }

  /**
   * Get test plan and parse it
   */
  async getAndParse(
    id: string,
    options: { environment?: string; variables?: Record<string, unknown> } = {}
  ): Promise<{ stored: StoredTestPlan; parsed: HoconTestPlan } | null> {
    const stored = await this.get(id);
    if (!stored) return null;

    const parser = new HoconParser({
      environment: options.environment,
      variables: options.variables,
    });

    const parseResult = await parser.parse(stored.hoconContent);
    if (parseResult.errors.length > 0) {
      throw new Error(`Parse error: ${parseResult.errors.map((e) => e.message).join(', ')}`);
    }

    return { stored, parsed: parseResult.plan };
  }

  /**
   * List all test plans
   */
  async list(options: {
    tags?: string[];
    search?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ items: TestPlanListItem[]; total: number }> {
    if (this.useDatabase) {
      return this.listFromDatabase(options);
    }
    return this.listFromFiles(options);
  }

  /**
   * Delete test plan
   */
  async delete(id: string): Promise<boolean> {
    if (this.useDatabase) {
      return this.deleteFromDatabase(id);
    }
    return this.deleteFromFile(id);
  }

  /**
   * Export test plan to file
   */
  async exportToFile(id: string, filePath: string): Promise<void> {
    const stored = await this.get(id);
    if (!stored) {
      throw new Error(`Test plan not found: ${id}`);
    }

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, stored.hoconContent, 'utf-8');
    logger.info({ id, filePath }, 'Test plan exported');
  }

  /**
   * Import test plan from file
   */
  async importFromFile(filePath: string, options: SaveOptions = {}): Promise<StoredTestPlan> {
    const content = await fs.readFile(filePath, 'utf-8');
    return this.save(content, options);
  }

  /**
   * Get version history
   */
  async getVersionHistory(id: string): Promise<Array<{
    version: number;
    updatedAt: Date;
    updatedBy?: string;
  }>> {
    if (!this.useDatabase) {
      return [];
    }

    const result = await db.query<{
      version: number;
      updated_at: Date;
      updated_by: string;
    }>(
      `SELECT version, updated_at, created_by as updated_by
       FROM test_plan_versions
       WHERE plan_id = $1
       ORDER BY version DESC`,
      [id]
    );

    return result.rows.map((row) => ({
      version: row.version,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by,
    }));
  }

  /**
   * Get all unique tags across all plans
   */
  async getTags(): Promise<string[]> {
    if (!this.useDatabase) {
      return this.getTagsFromFiles();
    }

    const result = await db.query<{ tag: string }>(
      `SELECT DISTINCT UNNEST(tags) AS tag FROM test_plans_hocon ORDER BY tag`
    );

    return result.rows.map((row) => row.tag);
  }

  private async getTagsFromFiles(): Promise<string[]> {
    try {
      const { items } = await this.listFromFiles({});
      const tagSet = new Set<string>();
      for (const item of items) {
        for (const tag of item.tags) {
          tagSet.add(tag);
        }
      }
      return Array.from(tagSet).sort();
    } catch {
      return [];
    }
  }

  // ============================================================================
  // Database operations
  // ============================================================================

  private async saveToDatabase(plan: StoredTestPlan): Promise<void> {
    await db.query(
      `INSERT INTO test_plans_hocon (id, name, description, hocon_content, version, tags, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        plan.id,
        plan.name,
        plan.description,
        plan.hoconContent,
        plan.version,
        plan.tags,
        plan.createdBy,
        plan.createdAt,
        plan.updatedAt,
      ]
    );
  }

  private async updateInDatabase(plan: StoredTestPlan): Promise<void> {
    await db.query(
      `UPDATE test_plans_hocon
       SET name = $2, description = $3, hocon_content = $4, version = $5, tags = $6, updated_at = $7
       WHERE id = $1`,
      [
        plan.id,
        plan.name,
        plan.description,
        plan.hoconContent,
        plan.version,
        plan.tags,
        plan.updatedAt,
      ]
    );
  }

  private async getFromDatabase(id: string): Promise<StoredTestPlan | null> {
    const result = await db.query<{
      id: string;
      name: string;
      description: string;
      hocon_content: string;
      version: number;
      tags: string[];
      created_by: string;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT * FROM test_plans_hocon WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      hoconContent: row.hocon_content,
      version: row.version,
      tags: row.tags || [],
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private async listFromDatabase(options: {
    tags?: string[];
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: TestPlanListItem[]; total: number }> {
    let whereClause = '';
    const params: unknown[] = [];

    if (options.tags && options.tags.length > 0) {
      params.push(options.tags);
      whereClause = `WHERE tags && $${params.length}`;
    }

    if (options.search) {
      params.push(`%${options.search}%`);
      whereClause += whereClause
        ? ` AND (name ILIKE $${params.length} OR description ILIKE $${params.length})`
        : `WHERE name ILIKE $${params.length} OR description ILIKE $${params.length}`;
    }

    const countResult = await db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM test_plans_hocon ${whereClause}`,
      params
    );

    params.push(options.limit || 50);
    params.push(options.offset || 0);

    const result = await db.query<{
      id: string;
      name: string;
      description: string;
      tags: string[];
      version: number;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT id, name, description, tags, version, created_at, updated_at
       FROM test_plans_hocon
       ${whereClause}
       ORDER BY updated_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return {
      items: result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        tags: row.tags || [],
        version: row.version,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
      total: parseInt(countResult.rows[0]?.count || '0'),
    };
  }

  private async deleteFromDatabase(id: string): Promise<boolean> {
    const result = await db.query(
      `DELETE FROM test_plans_hocon WHERE id = $1`,
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  // ============================================================================
  // File operations
  // ============================================================================

  private async saveToFile(plan: StoredTestPlan): Promise<void> {
    await fs.mkdir(this.basePath, { recursive: true });

    const metaPath = path.join(this.basePath, `${plan.id}.meta.json`);
    const hoconPath = path.join(this.basePath, `${plan.id}.conf`);

    const meta = {
      id: plan.id,
      name: plan.name,
      description: plan.description,
      version: plan.version,
      tags: plan.tags,
      createdBy: plan.createdBy,
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
    };

    await Promise.all([
      fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8'),
      fs.writeFile(hoconPath, plan.hoconContent, 'utf-8'),
    ]);
  }

  private async getFromFile(id: string): Promise<StoredTestPlan | null> {
    const metaPath = path.join(this.basePath, `${id}.meta.json`);
    const hoconPath = path.join(this.basePath, `${id}.conf`);

    try {
      const [metaContent, hoconContent] = await Promise.all([
        fs.readFile(metaPath, 'utf-8'),
        fs.readFile(hoconPath, 'utf-8'),
      ]);

      const meta = JSON.parse(metaContent);
      return {
        id: meta.id,
        name: meta.name,
        description: meta.description,
        hoconContent,
        version: meta.version,
        tags: meta.tags || [],
        createdBy: meta.createdBy,
        createdAt: new Date(meta.createdAt),
        updatedAt: new Date(meta.updatedAt),
      };
    } catch {
      return null;
    }
  }

  private async listFromFiles(options: {
    tags?: string[];
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: TestPlanListItem[]; total: number }> {
    try {
      const files = await fs.readdir(this.basePath);
      const metaFiles = files.filter((f) => f.endsWith('.meta.json'));

      const items: TestPlanListItem[] = [];

      for (const file of metaFiles) {
        const content = await fs.readFile(path.join(this.basePath, file), 'utf-8');
        const meta = JSON.parse(content);

        // Apply filters
        if (options.tags && options.tags.length > 0) {
          if (!options.tags.some((t) => meta.tags?.includes(t))) continue;
        }

        if (options.search) {
          const search = options.search.toLowerCase();
          if (
            !meta.name.toLowerCase().includes(search) &&
            !meta.description?.toLowerCase().includes(search)
          ) {
            continue;
          }
        }

        items.push({
          id: meta.id,
          name: meta.name,
          description: meta.description,
          tags: meta.tags || [],
          version: meta.version,
          createdAt: new Date(meta.createdAt),
          updatedAt: new Date(meta.updatedAt),
        });
      }

      // Sort by updated date
      items.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

      const offset = options.offset || 0;
      const limit = options.limit || 50;

      return {
        items: items.slice(offset, offset + limit),
        total: items.length,
      };
    } catch {
      return { items: [], total: 0 };
    }
  }

  private async deleteFromFile(id: string): Promise<boolean> {
    const metaPath = path.join(this.basePath, `${id}.meta.json`);
    const hoconPath = path.join(this.basePath, `${id}.conf`);

    try {
      await Promise.all([
        fs.unlink(metaPath),
        fs.unlink(hoconPath),
      ]);
      return true;
    } catch {
      return false;
    }
  }
}

export const testPlanStorage = new TestPlanStorage();
