/**
 * Tests for HOCON Test Plan Storage
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing the module under test
vi.mock('../modules/database/yugabyte-client.js', () => ({
  db: {
    query: vi.fn(),
    initialize: vi.fn(),
  },
}));

vi.mock('../modules/hocon/parser.js', () => ({
  HoconParser: vi.fn().mockImplementation(() => ({
    parse: vi.fn(),
  })),
  HoconSerializer: vi.fn().mockImplementation(() => ({
    serialize: vi.fn(),
  })),
  hoconParser: {
    parse: vi.fn().mockResolvedValue({
      errors: [],
      plan: {
        testcraft: {
          plan: {
            name: 'Test Plan',
            description: 'A test plan',
            tags: ['test'],
          },
        },
      },
    }),
  },
  hoconSerializer: {
    serialize: vi.fn().mockReturnValue('testcraft { plan { name = "Test" } }'),
  },
  parseHocon: vi.fn(),
  serializeToHocon: vi.fn(),
  validateTestPlan: vi.fn(),
}));

import { TestPlanStorage } from '../modules/hocon/storage.js';

describe('TestPlanStorage', () => {
  let storage: TestPlanStorage;

  beforeEach(() => {
    vi.clearAllMocks();
    storage = new TestPlanStorage({ useDatabase: true });
  });

  describe('save()', () => {
    it('should save a test plan to the database', async () => {
      const { db } = await import('../modules/database/yugabyte-client.js');

      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
        fields: [],
      });

      const hocon = 'testcraft { plan { name = "My Plan" } }';
      const result = await storage.save(hocon);

      expect(result.id).toBeDefined();
      expect(result.name).toBe('Test Plan');
      expect(result.version).toBe(1);
      expect(result.hoconContent).toBe(hocon);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO test_plans_hocon'),
        expect.arrayContaining([expect.any(String), 'Test Plan']),
      );
    });
  });

  describe('get()', () => {
    it('should retrieve a test plan by ID from database', async () => {
      const { db } = await import('../modules/database/yugabyte-client.js');

      const mockRow = {
        id: 'plan-1',
        name: 'My Plan',
        description: 'Description',
        hocon_content: 'testcraft {}',
        version: 1,
        tags: ['tag1'],
        created_by: 'user1',
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-02'),
      };

      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [mockRow],
        rowCount: 1,
        fields: [],
      });

      const result = await storage.get('plan-1');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('plan-1');
      expect(result!.name).toBe('My Plan');
      expect(result!.hoconContent).toBe('testcraft {}');
      expect(result!.tags).toEqual(['tag1']);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM test_plans_hocon WHERE id = $1'),
        ['plan-1'],
      );
    });

    it('should return null for non-existent plan', async () => {
      const { db } = await import('../modules/database/yugabyte-client.js');

      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        fields: [],
      });

      const result = await storage.get('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('list()', () => {
    it('should list plans with pagination', async () => {
      const { db } = await import('../modules/database/yugabyte-client.js');

      // Count query
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [{ count: '2' }],
        rowCount: 1,
        fields: [],
      });

      // List query
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [
          {
            id: 'plan-1',
            name: 'Plan 1',
            description: null,
            tags: [],
            version: 1,
            created_at: new Date(),
            updated_at: new Date(),
          },
          {
            id: 'plan-2',
            name: 'Plan 2',
            description: 'Desc',
            tags: ['test'],
            version: 2,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
        rowCount: 2,
        fields: [],
      });

      const result = await storage.list({ limit: 10, offset: 0 });

      expect(result.total).toBe(2);
      expect(result.items).toHaveLength(2);
      expect(result.items[0].id).toBe('plan-1');
      expect(result.items[1].tags).toEqual(['test']);
    });

    it('should filter by tags', async () => {
      const { db } = await import('../modules/database/yugabyte-client.js');

      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [{ count: '1' }],
        rowCount: 1,
        fields: [],
      });

      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [{
          id: 'plan-2',
          name: 'Plan 2',
          description: null,
          tags: ['api'],
          version: 1,
          created_at: new Date(),
          updated_at: new Date(),
        }],
        rowCount: 1,
        fields: [],
      });

      const result = await storage.list({ tags: ['api'] });

      expect(result.items).toHaveLength(1);
      // Check the count query includes tag filter
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('tags && $1'),
        expect.arrayContaining([['api']]),
      );
    });
  });

  describe('getVersionHistory()', () => {
    it('should return version history for a plan', async () => {
      const { db } = await import('../modules/database/yugabyte-client.js');

      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [
          { version: 2, updated_at: new Date('2024-02-01'), updated_by: 'user1' },
          { version: 1, updated_at: new Date('2024-01-01'), updated_by: 'user1' },
        ],
        rowCount: 2,
        fields: [],
      });

      const history = await storage.getVersionHistory('plan-1');

      expect(history).toHaveLength(2);
      expect(history[0].version).toBe(2);
      expect(history[1].version).toBe(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('test_plan_versions'),
        ['plan-1'],
      );
    });
  });

  describe('getTags()', () => {
    it('should return all unique tags', async () => {
      const { db } = await import('../modules/database/yugabyte-client.js');

      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [
          { tag: 'api' },
          { tag: 'performance' },
          { tag: 'smoke' },
        ],
        rowCount: 3,
        fields: [],
      });

      const tags = await storage.getTags();

      expect(tags).toEqual(['api', 'performance', 'smoke']);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UNNEST(tags)'),
      );
    });
  });
});
