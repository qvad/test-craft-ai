/**
 * Unit tests for testing/routes.ts — assertion and extractor node types.
 *   - response-assertion
 *   - json-assertion
 *   - json-extractor
 *   - ai-assertion
 *
 * safe-regex helpers are mocked so tests are not sensitive to the ReDoS
 * detection heuristic; k8s-client and pg are mocked to avoid I/O.
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

// ---------------------------------------------------------------------------
// Module mocks — declared before any import that triggers side-effects
// ---------------------------------------------------------------------------

vi.mock('../modules/containers/k8s-client.js', () => ({
  k8sClient: {
    createPod: vi.fn(),
    deletePod: vi.fn(),
    waitForPodReady: vi.fn(),
    execInPod: vi.fn(),
    copyToPod: vi.fn(),
    getAvailableRunner: vi.fn().mockResolvedValue(null),
    listPods: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('pg', () => ({
  default: { Client: vi.fn() },
}));

// Mock safe-regex so individual tests can control its behaviour
vi.mock('../common/safe-regex.js', () => ({
  safeRegex: vi.fn((pattern: string, flags?: string) => new RegExp(pattern, flags)),
  safeRegexTest: vi.fn((pattern: string, input: string, flags?: string) => {
    try { return new RegExp(pattern, flags).test(input); } catch { return false; }
  }),
  safeRegexExec: vi.fn((pattern: string, input: string, flags?: string) => {
    try { return new RegExp(pattern, flags).exec(input); } catch { return null; }
  }),
}));

// ---------------------------------------------------------------------------
// Subject under test
// ---------------------------------------------------------------------------

import { testingRoutes } from '../modules/testing/routes.js';
import { safeRegex, safeRegexTest } from '../common/safe-regex.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Post to /test/node and return the parsed body. */
async function testNode(
  app: FastifyInstance,
  nodeType: string,
  config: Record<string, unknown>,
  inputs: Record<string, unknown> = {},
) {
  const res = await app.inject({
    method: 'POST',
    url: '/test/node',
    payload: { nodeType, config, inputs },
  });
  return { statusCode: res.statusCode, body: res.json() };
}

/** Minimal HTTP-like response object for inputs.response. */
function httpResponse(overrides: {
  body?: string;
  statusCode?: number;
  headers?: Record<string, string>;
  duration?: number;
}) {
  return {
    body: '{}',
    statusCode: 200,
    headers: {},
    duration: 50,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Shared Fastify instance
// ---------------------------------------------------------------------------

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify({ logger: false });
  await app.register(testingRoutes);
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  vi.clearAllMocks();
  // Restore defaults after any per-test overrides
  vi.mocked(safeRegex).mockImplementation(
    (pattern: string, flags?: string) => new RegExp(pattern, flags),
  );
  vi.mocked(safeRegexTest).mockImplementation(
    (pattern: string, input: string, flags?: string) => {
      try { return new RegExp(pattern, flags).test(input); } catch { return false; }
    },
  );
});

// ===========================================================================
// response-assertion
// ===========================================================================

describe('response-assertion node', () => {
  describe('testType: contains', () => {
    it('passes when response body contains the pattern', async () => {
      const { body } = await testNode(app, 'response-assertion', {
        testField: 'response-text',
        testType: 'contains',
        patterns: ['hello'],
      }, { response: httpResponse({ body: 'hello world' }) });

      expect(body.status).toBe('success');
      expect(body.output.passed).toBe(true);
      expect(body.output.results[0]).toMatchObject({ pattern: 'hello', matched: true });
    });

    it('fails when response body does not contain the pattern', async () => {
      const { body } = await testNode(app, 'response-assertion', {
        testField: 'response-text',
        testType: 'contains',
        patterns: ['missing'],
      }, { response: httpResponse({ body: 'hello world' }) });

      expect(body.status).toBe('error');
      expect(body.output.passed).toBe(false);
      expect(body.error).toContain('Assertion failed');
    });

    it('uses testStrings as alias for patterns', async () => {
      const { body } = await testNode(app, 'response-assertion', {
        testField: 'response-text',
        testType: 'contains',
        testStrings: ['world'],
      }, { response: httpResponse({ body: 'hello world' }) });

      expect(body.status).toBe('success');
    });

    it('all patterns must match (logical AND)', async () => {
      const { body } = await testNode(app, 'response-assertion', {
        testField: 'response-text',
        testType: 'contains',
        patterns: ['hello', 'world', 'missing'],
      }, { response: httpResponse({ body: 'hello world' }) });

      expect(body.status).toBe('error');
      expect(body.output.results).toHaveLength(3);
      expect(body.output.results[0].matched).toBe(true);
      expect(body.output.results[2].matched).toBe(false);
    });
  });

  describe('testType: equals', () => {
    it('passes when response body equals the pattern exactly', async () => {
      const { body } = await testNode(app, 'response-assertion', {
        testField: 'response-text',
        testType: 'equals',
        patterns: ['exact'],
      }, { response: httpResponse({ body: 'exact' }) });

      expect(body.status).toBe('success');
    });

    it('fails when response body is a superset of the pattern', async () => {
      const { body } = await testNode(app, 'response-assertion', {
        testField: 'response-text',
        testType: 'equals',
        patterns: ['exact'],
      }, { response: httpResponse({ body: 'not exact' }) });

      expect(body.status).toBe('error');
    });
  });

  describe('testType: matches (regex)', () => {
    it('delegates to safeRegexTest and passes on match', async () => {
      vi.mocked(safeRegexTest).mockReturnValueOnce(true);

      const { body } = await testNode(app, 'response-assertion', {
        testField: 'response-text',
        testType: 'matches',
        patterns: ['\\d+'],
      }, { response: httpResponse({ body: '42' }) });

      expect(safeRegexTest).toHaveBeenCalledWith('\\d+', '42');
      expect(body.status).toBe('success');
    });

    it('delegates to safeRegexTest and fails when no match', async () => {
      vi.mocked(safeRegexTest).mockReturnValueOnce(false);

      const { body } = await testNode(app, 'response-assertion', {
        testField: 'response-text',
        testType: 'matches',
        patterns: ['\\d+'],
      }, { response: httpResponse({ body: 'no digits here' }) });

      expect(safeRegexTest).toHaveBeenCalled();
      expect(body.status).toBe('error');
    });

    it('returns error (safe failure) when safeRegexTest returns false for dangerous pattern', async () => {
      // Simulate safeRegexTest returning false for a ReDoS-dangerous pattern
      vi.mocked(safeRegexTest).mockReturnValueOnce(false);

      const { body } = await testNode(app, 'response-assertion', {
        testField: 'response-text',
        testType: 'matches',
        patterns: ['(a+)+'],
      }, { response: httpResponse({ body: 'aaaaaa' }) });

      expect(body.status).toBe('error');
    });
  });

  describe('testType: not', () => {
    it('passes when pattern is absent from the response body', async () => {
      const { body } = await testNode(app, 'response-assertion', {
        testField: 'response-text',
        testType: 'not',
        patterns: ['error'],
      }, { response: httpResponse({ body: 'everything is fine' }) });

      expect(body.status).toBe('success');
    });

    it('fails when pattern is present in the response body', async () => {
      const { body } = await testNode(app, 'response-assertion', {
        testField: 'response-text',
        testType: 'not',
        patterns: ['error'],
      }, { response: httpResponse({ body: 'internal server error' }) });

      expect(body.status).toBe('error');
    });
  });

  describe('testField variants', () => {
    it('uses statusCode when testField is response-code', async () => {
      const { body } = await testNode(app, 'response-assertion', {
        testField: 'response-code',
        testType: 'equals',
        patterns: ['200'],
      }, { response: httpResponse({ statusCode: 200, body: '' }) });

      expect(body.status).toBe('success');
      expect(body.output.testValue).toBe('200');
    });

    it('uses serialised headers when testField is response-headers', async () => {
      const { body } = await testNode(app, 'response-assertion', {
        testField: 'response-headers',
        testType: 'contains',
        patterns: ['application/json'],
      }, { response: httpResponse({ headers: { 'content-type': 'application/json' } }) });

      expect(body.status).toBe('success');
    });

    it('defaults to body when testField is unrecognised', async () => {
      const { body } = await testNode(app, 'response-assertion', {
        testField: 'unknown-field',
        testType: 'contains',
        patterns: ['hello'],
      }, { response: httpResponse({ body: 'hello world' }) });

      expect(body.status).toBe('success');
    });
  });

  describe('negation flag', () => {
    it('inverts each match result when negation is true', async () => {
      // "contains" + negation=true → matched = false means the assertion passes only if
      // the pattern is NOT in the string.
      const { body } = await testNode(app, 'response-assertion', {
        testField: 'response-text',
        testType: 'contains',
        patterns: ['absent'],
        negation: true,
      }, { response: httpResponse({ body: 'hello world' }) });

      // "absent" not found → matched=false → negated to true → passed
      expect(body.status).toBe('success');
    });

    it('makes a normally-passing assertion fail when negation is true', async () => {
      const { body } = await testNode(app, 'response-assertion', {
        testField: 'response-text',
        testType: 'contains',
        patterns: ['hello'],
        negation: true,
      }, { response: httpResponse({ body: 'hello world' }) });

      // "hello" found → matched=true → negated to false → failed
      expect(body.status).toBe('error');
    });
  });

  describe('fallback input sources', () => {
    it('uses DB rows when response is absent and rows are present', async () => {
      const { body } = await testNode(app, 'response-assertion', {
        testField: 'response-data',
        testType: 'contains',
        patterns: ['alice'],
      }, { rows: [{ name: 'alice' }] });

      expect(body.status).toBe('success');
    });

    it('uses rowCount for response-code testField with DB results', async () => {
      const { body } = await testNode(app, 'response-assertion', {
        testField: 'response-code',
        testType: 'equals',
        patterns: ['3'],
      }, { rowCount: 3 });

      expect(body.status).toBe('success');
    });

    it('uses _previousOutput when neither response nor rows are present', async () => {
      const { body } = await testNode(app, 'response-assertion', {
        testField: 'response-text',
        testType: 'contains',
        patterns: ['prev'],
      }, { _previousOutput: 'previous node result' });

      expect(body.status).toBe('success');
    });

    it('falls back to JSON-stringified inputs when nothing else matches', async () => {
      const { body } = await testNode(app, 'response-assertion', {
        testField: 'response-text',
        testType: 'contains',
        patterns: ['someKey'],
      }, { someKey: 'someValue' });

      expect(body.status).toBe('success');
    });
  });

  describe('empty pattern list', () => {
    it('passes with empty patterns (nothing to check)', async () => {
      const { body } = await testNode(app, 'response-assertion', {
        testField: 'response-text',
        testType: 'contains',
        patterns: [],
      }, { response: httpResponse({ body: 'anything' }) });

      expect(body.status).toBe('success');
      expect(body.output.results).toHaveLength(0);
    });
  });
});

// ===========================================================================
// json-assertion
// ===========================================================================

describe('json-assertion node', () => {
  it('returns error when no response body is provided', async () => {
    const { body } = await testNode(app, 'json-assertion', {
      jsonPath: '$.name',
      expectedValue: 'alice',
    }, {});

    expect(body.status).toBe('error');
    expect(body.error).toContain('No response body');
  });

  it('returns error on invalid JSON body', async () => {
    const { body } = await testNode(app, 'json-assertion', {
      jsonPath: '$.name',
      expectedValue: 'alice',
    }, { response: httpResponse({ body: 'not json{{}' }) });

    expect(body.status).toBe('error');
    expect(body.error).toContain('JSON parse error');
  });

  describe('basic path matching', () => {
    it('passes when extracted value matches expectedValue (string comparison)', async () => {
      const { body } = await testNode(app, 'json-assertion', {
        jsonPath: '$.name',
        expectedValue: 'alice',
      }, { response: httpResponse({ body: JSON.stringify({ name: 'alice' }) }) });

      expect(body.status).toBe('success');
      expect(body.output.actualValue).toBe('alice');
    });

    it('fails when extracted value differs from expectedValue', async () => {
      const { body } = await testNode(app, 'json-assertion', {
        jsonPath: '$.name',
        expectedValue: 'bob',
      }, { response: httpResponse({ body: JSON.stringify({ name: 'alice' }) }) });

      expect(body.status).toBe('error');
      expect(body.error).toContain('JSON assertion failed');
    });

    it('navigates nested paths', async () => {
      const { body } = await testNode(app, 'json-assertion', {
        jsonPath: '$.user.address.city',
        expectedValue: 'London',
      }, { response: httpResponse({ body: JSON.stringify({ user: { address: { city: 'London' } } }) }) });

      expect(body.status).toBe('success');
    });

    it('navigates array indices via items[0] notation', async () => {
      const { body } = await testNode(app, 'json-assertion', {
        jsonPath: '$.items[0]',
        expectedValue: 'first',
      }, { response: httpResponse({ body: JSON.stringify({ items: ['first', 'second'] }) }) });

      expect(body.status).toBe('success');
      expect(body.output.actualValue).toBe('first');
    });

    it('passes without expectedValue when path exists (existence check)', async () => {
      const { body } = await testNode(app, 'json-assertion', {
        jsonPath: '$.name',
      }, { response: httpResponse({ body: JSON.stringify({ name: 'alice' }) }) });

      expect(body.status).toBe('success');
    });

    it('fails existence check when path does not exist', async () => {
      const { body } = await testNode(app, 'json-assertion', {
        jsonPath: '$.missing',
      }, { response: httpResponse({ body: JSON.stringify({ name: 'alice' }) }) });

      expect(body.status).toBe('error');
    });
  });

  describe('expectNull', () => {
    it('passes when value is null and expectNull is true', async () => {
      const { body } = await testNode(app, 'json-assertion', {
        jsonPath: '$.value',
        expectNull: true,
      }, { response: httpResponse({ body: JSON.stringify({ value: null }) }) });

      expect(body.status).toBe('success');
    });

    it('passes when path is missing and expectNull is true', async () => {
      const { body } = await testNode(app, 'json-assertion', {
        jsonPath: '$.missing',
        expectNull: true,
      }, { response: httpResponse({ body: JSON.stringify({}) }) });

      expect(body.status).toBe('success');
    });

    it('fails when value is non-null and expectNull is true', async () => {
      const { body } = await testNode(app, 'json-assertion', {
        jsonPath: '$.value',
        expectNull: true,
      }, { response: httpResponse({ body: JSON.stringify({ value: 'something' }) }) });

      expect(body.status).toBe('error');
    });
  });

  describe('invert', () => {
    it('passes when assertion would normally fail and invert is true', async () => {
      const { body } = await testNode(app, 'json-assertion', {
        jsonPath: '$.name',
        expectedValue: 'bob',
        invert: true,
      }, { response: httpResponse({ body: JSON.stringify({ name: 'alice' }) }) });

      // name is 'alice', not 'bob' → would fail → inverted → success
      expect(body.status).toBe('success');
    });

    it('fails when assertion would normally pass and invert is true', async () => {
      const { body } = await testNode(app, 'json-assertion', {
        jsonPath: '$.name',
        expectedValue: 'alice',
        invert: true,
      }, { response: httpResponse({ body: JSON.stringify({ name: 'alice' }) }) });

      expect(body.status).toBe('error');
    });
  });

  describe('isRegex', () => {
    it('delegates to safeRegexTest and passes when regex matches', async () => {
      vi.mocked(safeRegexTest).mockReturnValueOnce(true);

      const { body } = await testNode(app, 'json-assertion', {
        jsonPath: '$.code',
        expectedValue: '^[A-Z]{3}$',
        isRegex: true,
      }, { response: httpResponse({ body: JSON.stringify({ code: 'USD' }) }) });

      expect(safeRegexTest).toHaveBeenCalledWith('^[A-Z]{3}$', 'USD');
      expect(body.status).toBe('success');
    });

    it('delegates to safeRegexTest and fails when regex does not match', async () => {
      vi.mocked(safeRegexTest).mockReturnValueOnce(false);

      const { body } = await testNode(app, 'json-assertion', {
        jsonPath: '$.code',
        expectedValue: '^[A-Z]{3}$',
        isRegex: true,
      }, { response: httpResponse({ body: JSON.stringify({ code: 'us' }) }) });

      expect(body.status).toBe('error');
    });

    it('returns false safely when safeRegexTest returns false for dangerous pattern', async () => {
      vi.mocked(safeRegexTest).mockReturnValueOnce(false);

      const { body } = await testNode(app, 'json-assertion', {
        jsonPath: '$.text',
        expectedValue: '(a+)+',
        isRegex: true,
      }, { response: httpResponse({ body: JSON.stringify({ text: 'aaaaaa' }) }) });

      expect(body.status).toBe('error');
    });
  });
});

// ===========================================================================
// json-extractor
// ===========================================================================

describe('json-extractor node', () => {
  it('returns defaultValue when no response body is provided', async () => {
    const { body } = await testNode(app, 'json-extractor', {
      variableName: 'userId',
      jsonPath: '$.id',
      defaultValue: 'unknown',
    }, {});

    expect(body.status).toBe('success');
    expect(body.output.userId).toBe('unknown');
    expect(body.extractedValues?.userId).toBe('unknown');
  });

  it('returns defaultValue when response body is an empty string', async () => {
    const { body } = await testNode(app, 'json-extractor', {
      variableName: 'userId',
      jsonPath: '$.id',
      defaultValue: 'fallback',
    }, { response: httpResponse({ body: '' }) });

    expect(body.status).toBe('success');
    expect(body.output.userId).toBe('fallback');
  });

  it('extracts a top-level string value', async () => {
    const { body } = await testNode(app, 'json-extractor', {
      variableName: 'userName',
      jsonPath: '$.name',
      defaultValue: 'none',
    }, { response: httpResponse({ body: JSON.stringify({ name: 'alice' }) }) });

    expect(body.status).toBe('success');
    expect(body.output.userName).toBe('alice');
    expect(body.extractedValues?.userName).toBe('alice');
  });

  it('extracts a nested value using dot-notation path', async () => {
    const { body } = await testNode(app, 'json-extractor', {
      variableName: 'city',
      jsonPath: '$.user.address.city',
      defaultValue: 'unknown',
    }, { response: httpResponse({ body: JSON.stringify({ user: { address: { city: 'Paris' } } }) }) });

    expect(body.status).toBe('success');
    expect(body.output.city).toBe('Paris');
  });

  it('extracts a value by array index using items[0] notation', async () => {
    const { body } = await testNode(app, 'json-extractor', {
      variableName: 'firstItem',
      jsonPath: '$.items[0]',
      defaultValue: 'none',
    }, { response: httpResponse({ body: JSON.stringify({ items: ['alpha', 'beta'] }) }) });

    expect(body.status).toBe('success');
    expect(body.output.firstItem).toBe('alpha');
  });

  it('extracts a numeric value', async () => {
    const { body } = await testNode(app, 'json-extractor', {
      variableName: 'count',
      jsonPath: '$.total',
      defaultValue: 0,
    }, { response: httpResponse({ body: JSON.stringify({ total: 42 }) }) });

    expect(body.status).toBe('success');
    expect(body.output.count).toBe(42);
  });

  it('uses defaultValue when path does not exist in JSON', async () => {
    const { body } = await testNode(app, 'json-extractor', {
      variableName: 'token',
      jsonPath: '$.auth.token',
      defaultValue: 'no-token',
    }, { response: httpResponse({ body: JSON.stringify({ auth: {} }) }) });

    expect(body.status).toBe('success');
    expect(body.output.token).toBe('no-token');
  });

  it('returns defaultValue (success) on invalid JSON — does not error out', async () => {
    const { body } = await testNode(app, 'json-extractor', {
      variableName: 'val',
      jsonPath: '$.x',
      defaultValue: 'fallback',
    }, { response: httpResponse({ body: 'not valid json' }) });

    expect(body.status).toBe('success');
    expect(body.output.val).toBe('fallback');
  });

  it('strips leading $. from jsonPath before traversal', async () => {
    const { body } = await testNode(app, 'json-extractor', {
      variableName: 'id',
      jsonPath: '$.id',    // leading $. must be stripped
      defaultValue: null,
    }, { response: httpResponse({ body: JSON.stringify({ id: 99 }) }) });

    expect(body.output.id).toBe(99);
  });

  it('works without the $. prefix as well', async () => {
    const { body } = await testNode(app, 'json-extractor', {
      variableName: 'id',
      jsonPath: 'id',
      defaultValue: null,
    }, { response: httpResponse({ body: JSON.stringify({ id: 7 }) }) });

    expect(body.output.id).toBe(7);
  });

  it('exposes extracted value under the correct variable name in extractedValues', async () => {
    const { body } = await testNode(app, 'json-extractor', {
      variableName: 'myVar',
      jsonPath: '$.key',
      defaultValue: 'default',
    }, { response: httpResponse({ body: JSON.stringify({ key: 'value' }) }) });

    expect(body.extractedValues).toHaveProperty('myVar', 'value');
    expect(body.extractedValues).not.toHaveProperty('key');
  });
});

// ===========================================================================
// ai-assertion
// ===========================================================================

describe('ai-assertion node', () => {
  it('always returns success with a confidence score', async () => {
    const { statusCode, body } = await testNode(app, 'ai-assertion', {
      intent: 'Verify response contains a valid user object',
      expectedOutcome: 'User object has id and name fields',
    }, { response: httpResponse({ body: JSON.stringify({ id: 1, name: 'alice' }) }) });

    expect(statusCode).toBe(200);
    expect(body.status).toBe('success');
    expect(body.output.passed).toBe(true);
    expect(typeof body.output.confidence).toBe('number');
    expect(body.output.confidence).toBeGreaterThan(0);
  });

  it('echoes back intent and expectedOutcome in the output', async () => {
    const { body } = await testNode(app, 'ai-assertion', {
      intent: 'check status',
      expectedOutcome: 'status is OK',
    }, { response: httpResponse({ body: '{"status":"ok"}' }) });

    expect(body.output.intent).toBe('check status');
    expect(body.output.expectedOutcome).toBe('status is OK');
  });

  it('reports "no response" when inputs.response is absent', async () => {
    const { body } = await testNode(app, 'ai-assertion', {
      intent: 'check something',
      expectedOutcome: 'outcome',
    }, {});

    expect(body.status).toBe('success');
    expect(body.output.response).toBe('no response');
  });

  it('reports "analyzed" when inputs.response is present', async () => {
    const { body } = await testNode(app, 'ai-assertion', {
      intent: 'check something',
      expectedOutcome: 'outcome',
    }, { response: httpResponse({ body: '{}' }) });

    expect(body.output.response).toBe('analyzed');
  });

  it('includes standard result envelope fields', async () => {
    const { body } = await testNode(app, 'ai-assertion', {
      intent: 'anything',
      expectedOutcome: 'something',
    }, {});

    expect(body).toHaveProperty('nodeType', 'ai-assertion');
    expect(body).toHaveProperty('duration');
    expect(Array.isArray(body.logs)).toBe(true);
    expect(body.metrics).toMatchObject({
      requestCount: 1,
      latencyMs: expect.any(Number),
    });
  });
});
