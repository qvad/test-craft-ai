/**
 * Assertion and Extractor Node Test Cases
 * Tests for Response Assertion, JSON Assertion, Extractors, etc.
 */

import type { TestCase } from '../test-runner';

export const assertionTests: TestCase[] = [
  // ============================================================================
  // RESPONSE ASSERTION TESTS
  // ============================================================================
  {
    id: 'response-assertion-contains',
    name: 'Response Assertion - Contains Text',
    description: 'Test response assertion with contains matching',
    nodeType: 'response-assertion',
    category: 'assertions',
    config: {
      type: 'response-assertion',
      applyTo: 'main-sample',
      testField: 'response-text',
      testType: 'contains',
      patterns: ['success', 'data'],
      ignoreStatus: false,
    },
    inputs: {
      response: { body: '{"status": "success", "data": [1,2,3]}', statusCode: 200 },
    },
    expectedOutput: {
      status: 'success',
    },
    timeout: 5000,
    tags: ['assertion', 'response', 'contains'],
  },
  {
    id: 'response-assertion-equals',
    name: 'Response Assertion - Equals',
    description: 'Test response assertion with exact match',
    nodeType: 'response-assertion',
    category: 'assertions',
    config: {
      type: 'response-assertion',
      applyTo: 'main-sample',
      testField: 'response-code',
      testType: 'equals',
      patterns: ['200'],
      ignoreStatus: false,
    },
    inputs: {
      response: { body: 'OK', statusCode: 200 },
    },
    expectedOutput: {
      status: 'success',
    },
    timeout: 5000,
    tags: ['assertion', 'response', 'equals'],
  },
  {
    id: 'response-assertion-regex',
    name: 'Response Assertion - Regex Match',
    description: 'Test response assertion with regex pattern',
    nodeType: 'response-assertion',
    category: 'assertions',
    config: {
      type: 'response-assertion',
      applyTo: 'main-sample',
      testField: 'response-text',
      testType: 'matches',
      patterns: ['"id":\\s*\\d+'],
      ignoreStatus: false,
    },
    inputs: {
      response: { body: '{"id": 12345, "name": "test"}', statusCode: 200 },
    },
    expectedOutput: {
      status: 'success',
    },
    timeout: 5000,
    tags: ['assertion', 'response', 'regex'],
  },
  {
    id: 'response-assertion-not-contains',
    name: 'Response Assertion - Not Contains',
    description: 'Test response assertion with negation',
    nodeType: 'response-assertion',
    category: 'assertions',
    config: {
      type: 'response-assertion',
      applyTo: 'main-sample',
      testField: 'response-text',
      testType: 'not',
      patterns: ['error', 'failure'],
      ignoreStatus: false,
    },
    inputs: {
      response: { body: '{"status": "ok"}', statusCode: 200 },
    },
    expectedOutput: {
      status: 'success',
    },
    timeout: 5000,
    tags: ['assertion', 'response', 'not'],
  },
  {
    id: 'response-assertion-headers',
    name: 'Response Assertion - Headers',
    description: 'Test response assertion on headers',
    nodeType: 'response-assertion',
    category: 'assertions',
    config: {
      type: 'response-assertion',
      applyTo: 'main-sample',
      testField: 'response-headers',
      testType: 'contains',
      patterns: ['"Content-Type":"application/json"'],  // JSON.stringify format
      ignoreStatus: false,
    },
    inputs: {
      response: {
        body: '{}',
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    },
    expectedOutput: {
      status: 'success',
    },
    timeout: 5000,
    tags: ['assertion', 'response', 'headers'],
  },
  {
    id: 'response-assertion-fail',
    name: 'Response Assertion - Expected Failure',
    description: 'Test response assertion that should fail',
    nodeType: 'response-assertion',
    category: 'assertions',
    config: {
      type: 'response-assertion',
      applyTo: 'main-sample',
      testField: 'response-code',
      testType: 'equals',
      patterns: ['200'],
      ignoreStatus: false,
    },
    inputs: {
      response: { body: 'Error', statusCode: 500 },
    },
    expectedOutput: {
      status: 'error',
      errorContains: ['Assertion failed'],
    },
    timeout: 5000,
    tags: ['assertion', 'response', 'fail'],
  },

  // ============================================================================
  // JSON ASSERTION TESTS
  // ============================================================================
  {
    id: 'json-assertion-path-exists',
    name: 'JSON Assertion - Path Exists',
    description: 'Test JSON assertion that path exists',
    nodeType: 'json-assertion',
    category: 'assertions',
    config: {
      type: 'json-assertion',
      jsonPath: '$.user.name',
      expectedValue: undefined,
      expectNull: false,
      invert: false,
      isRegex: false,
    },
    inputs: {
      response: { body: '{"user": {"name": "John", "age": 30}}' },
    },
    expectedOutput: {
      status: 'success',
    },
    timeout: 5000,
    tags: ['assertion', 'json', 'path'],
  },
  {
    id: 'json-assertion-value-equals',
    name: 'JSON Assertion - Value Equals',
    description: 'Test JSON assertion with expected value',
    nodeType: 'json-assertion',
    category: 'assertions',
    config: {
      type: 'json-assertion',
      jsonPath: '$.status',
      expectedValue: 'active',
      expectNull: false,
      invert: false,
      isRegex: false,
    },
    inputs: {
      response: { body: '{"status": "active", "count": 5}' },
    },
    expectedOutput: {
      status: 'success',
    },
    timeout: 5000,
    tags: ['assertion', 'json', 'equals'],
  },
  {
    id: 'json-assertion-value-regex',
    name: 'JSON Assertion - Value Regex',
    description: 'Test JSON assertion with regex match',
    nodeType: 'json-assertion',
    category: 'assertions',
    config: {
      type: 'json-assertion',
      jsonPath: '$.email',
      expectedValue: '^[a-z]+@example\\.com$',
      expectNull: false,
      invert: false,
      isRegex: true,
    },
    inputs: {
      response: { body: '{"email": "test@example.com"}' },
    },
    expectedOutput: {
      status: 'success',
    },
    timeout: 5000,
    tags: ['assertion', 'json', 'regex'],
  },
  {
    id: 'json-assertion-null',
    name: 'JSON Assertion - Expect Null',
    description: 'Test JSON assertion expecting null value',
    nodeType: 'json-assertion',
    category: 'assertions',
    config: {
      type: 'json-assertion',
      jsonPath: '$.deletedAt',
      expectedValue: undefined,
      expectNull: true,
      invert: false,
      isRegex: false,
    },
    inputs: {
      response: { body: '{"id": 1, "deletedAt": null}' },
    },
    expectedOutput: {
      status: 'success',
    },
    timeout: 5000,
    tags: ['assertion', 'json', 'null'],
  },
  {
    id: 'json-assertion-array',
    name: 'JSON Assertion - Array Path',
    description: 'Test JSON assertion on array element',
    nodeType: 'json-assertion',
    category: 'assertions',
    config: {
      type: 'json-assertion',
      jsonPath: '$.items[0].name',
      expectedValue: 'first',
      expectNull: false,
      invert: false,
      isRegex: false,
    },
    inputs: {
      response: { body: '{"items": [{"name": "first"}, {"name": "second"}]}' },
    },
    expectedOutput: {
      status: 'success',
    },
    timeout: 5000,
    tags: ['assertion', 'json', 'array'],
  },
  {
    id: 'json-assertion-invert',
    name: 'JSON Assertion - Inverted',
    description: 'Test JSON assertion with inverted logic',
    nodeType: 'json-assertion',
    category: 'assertions',
    config: {
      type: 'json-assertion',
      jsonPath: '$.error',
      expectedValue: undefined,
      expectNull: false,
      invert: true, // Assert path does NOT exist
      isRegex: false,
    },
    inputs: {
      response: { body: '{"data": "success"}' },
    },
    expectedOutput: {
      status: 'success',
    },
    timeout: 5000,
    tags: ['assertion', 'json', 'invert'],
  },

  // ============================================================================
  // JSON SCHEMA ASSERTION TESTS
  // ============================================================================
  {
    id: 'json-schema-assertion-valid',
    name: 'JSON Schema Assertion - Valid',
    description: 'Test JSON schema assertion with valid data',
    nodeType: 'json-schema-assertion',
    category: 'assertions',
    config: {
      type: 'json-schema-assertion',
      schema: JSON.stringify({
        type: 'object',
        required: ['id', 'name'],
        properties: {
          id: { type: 'number' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
        },
      }),
    },
    inputs: {
      response: { body: '{"id": 1, "name": "John", "email": "john@example.com"}' },
    },
    expectedOutput: {
      status: 'success',
    },
    timeout: 5000,
    tags: ['assertion', 'json-schema'],
  },
  {
    id: 'json-schema-assertion-invalid',
    name: 'JSON Schema Assertion - Invalid',
    description: 'Test JSON schema assertion with invalid data',
    nodeType: 'json-schema-assertion',
    category: 'assertions',
    config: {
      type: 'json-schema-assertion',
      schema: JSON.stringify({
        type: 'object',
        required: ['id', 'name'],
        properties: {
          id: { type: 'number' },
          name: { type: 'string' },
        },
      }),
    },
    inputs: {
      response: { body: '{"id": "not-a-number", "name": 123}' },
    },
    expectedOutput: {
      status: 'error',
    },
    timeout: 5000,
    tags: ['assertion', 'json-schema', 'invalid'],
  },

  // ============================================================================
  // DURATION ASSERTION TESTS
  // ============================================================================
  {
    id: 'duration-assertion-pass',
    name: 'Duration Assertion - Within Limit',
    description: 'Test duration assertion with response within limit',
    nodeType: 'duration-assertion',
    category: 'assertions',
    config: {
      type: 'duration-assertion',
      maxDuration: 5000, // 5 seconds
    },
    inputs: {
      response: { duration: 2000 },
    },
    expectedOutput: {
      status: 'success',
    },
    timeout: 5000,
    tags: ['assertion', 'duration', 'pass'],
  },
  {
    id: 'duration-assertion-fail',
    name: 'Duration Assertion - Exceeded Limit',
    description: 'Test duration assertion with response exceeding limit',
    nodeType: 'duration-assertion',
    category: 'assertions',
    config: {
      type: 'duration-assertion',
      maxDuration: 1000, // 1 second
    },
    inputs: {
      response: { duration: 3000 },
    },
    expectedOutput: {
      status: 'error',
    },
    timeout: 5000,
    tags: ['assertion', 'duration', 'fail'],
  },

  // ============================================================================
  // SIZE ASSERTION TESTS
  // ============================================================================
  {
    id: 'size-assertion-equal',
    name: 'Size Assertion - Equal',
    description: 'Test size assertion with exact size',
    nodeType: 'size-assertion',
    category: 'assertions',
    config: {
      type: 'size-assertion',
      applyTo: 'body',
      size: 100,
      comparison: 'equal',
    },
    inputs: {
      response: { body: 'x'.repeat(100) },
    },
    expectedOutput: {
      status: 'success',
    },
    timeout: 5000,
    tags: ['assertion', 'size', 'equal'],
  },
  {
    id: 'size-assertion-less-than',
    name: 'Size Assertion - Less Than',
    description: 'Test size assertion with less than comparison',
    nodeType: 'size-assertion',
    category: 'assertions',
    config: {
      type: 'size-assertion',
      applyTo: 'body',
      size: 1000,
      comparison: 'less',
    },
    inputs: {
      response: { body: '{"short": "response"}' },
    },
    expectedOutput: {
      status: 'success',
    },
    timeout: 5000,
    tags: ['assertion', 'size', 'less'],
  },
];

export const extractorTests: TestCase[] = [
  // ============================================================================
  // JSON EXTRACTOR TESTS
  // ============================================================================
  {
    id: 'json-extractor-simple',
    name: 'JSON Extractor - Simple Path',
    description: 'Test JSON extractor with simple path',
    nodeType: 'json-extractor',
    category: 'postprocessors',
    config: {
      type: 'json-extractor',
      variableName: 'extractedName',
      jsonPath: '$.name',
      matchNumber: 1,
      defaultValue: 'NOT_FOUND',
      computeConcatenation: false,
    },
    inputs: {
      response: { body: '{"name": "John", "age": 30}' },
    },
    expectedOutput: {
      status: 'success',
      extractedValues: { extractedName: 'John' },
    },
    timeout: 5000,
    tags: ['extractor', 'json', 'simple'],
  },
  {
    id: 'json-extractor-nested',
    name: 'JSON Extractor - Nested Path',
    description: 'Test JSON extractor with nested path',
    nodeType: 'json-extractor',
    category: 'postprocessors',
    config: {
      type: 'json-extractor',
      variableName: 'city',
      jsonPath: '$.user.address.city',
      matchNumber: 1,
      defaultValue: 'UNKNOWN',
      computeConcatenation: false,
    },
    inputs: {
      response: { body: '{"user": {"address": {"city": "New York", "zip": "10001"}}}' },
    },
    expectedOutput: {
      status: 'success',
      extractedValues: { city: 'New York' },
    },
    timeout: 5000,
    tags: ['extractor', 'json', 'nested'],
  },
  {
    id: 'json-extractor-array',
    name: 'JSON Extractor - Array Element',
    description: 'Test JSON extractor with array index',
    nodeType: 'json-extractor',
    category: 'postprocessors',
    config: {
      type: 'json-extractor',
      variableName: 'firstItem',
      jsonPath: '$.items[0].id',
      matchNumber: 1,
      defaultValue: '',
      computeConcatenation: false,
    },
    inputs: {
      response: { body: '{"items": [{"id": "a1"}, {"id": "b2"}, {"id": "c3"}]}' },
    },
    expectedOutput: {
      status: 'success',
      extractedValues: { firstItem: 'a1' },
    },
    timeout: 5000,
    tags: ['extractor', 'json', 'array'],
  },
  {
    id: 'json-extractor-all-matches',
    name: 'JSON Extractor - All Matches',
    description: 'Test JSON extractor getting all matches',
    nodeType: 'json-extractor',
    category: 'postprocessors',
    config: {
      type: 'json-extractor',
      variableName: 'allIds',
      jsonPath: '$.items[*].id',
      matchNumber: -1, // All matches
      defaultValue: '',
      computeConcatenation: true,
    },
    inputs: {
      response: { body: '{"items": [{"id": "a1"}, {"id": "b2"}, {"id": "c3"}]}' },
    },
    expectedOutput: {
      status: 'success',
    },
    timeout: 5000,
    tags: ['extractor', 'json', 'all'],
  },
  {
    id: 'json-extractor-default',
    name: 'JSON Extractor - Default Value',
    description: 'Test JSON extractor with path not found',
    nodeType: 'json-extractor',
    category: 'postprocessors',
    config: {
      type: 'json-extractor',
      variableName: 'missing',
      jsonPath: '$.nonexistent.path',
      matchNumber: 1,
      defaultValue: 'DEFAULT_VALUE',
      computeConcatenation: false,
    },
    inputs: {
      response: { body: '{"other": "data"}' },
    },
    expectedOutput: {
      status: 'success',
      extractedValues: { missing: 'DEFAULT_VALUE' },
    },
    timeout: 5000,
    tags: ['extractor', 'json', 'default'],
  },

  // ============================================================================
  // REGEX EXTRACTOR TESTS
  // ============================================================================
  {
    id: 'regex-extractor-simple',
    name: 'Regex Extractor - Simple Pattern',
    description: 'Test regex extractor with simple pattern',
    nodeType: 'regex-extractor',
    category: 'postprocessors',
    config: {
      type: 'regex-extractor',
      applyTo: 'body',
      variableName: 'extracted',
      regularExpression: 'id=(\\d+)',
      template: '$1$',
      matchNumber: 1,
      defaultValue: 'NOT_FOUND',
    },
    inputs: {
      response: { body: 'User id=12345 created successfully' },
    },
    expectedOutput: {
      status: 'success',
      extractedValues: { extracted: '12345' },
    },
    timeout: 5000,
    tags: ['extractor', 'regex', 'simple'],
  },
  {
    id: 'regex-extractor-groups',
    name: 'Regex Extractor - Multiple Groups',
    description: 'Test regex extractor with multiple capture groups',
    nodeType: 'regex-extractor',
    category: 'postprocessors',
    config: {
      type: 'regex-extractor',
      applyTo: 'body',
      variableName: 'userInfo',
      regularExpression: 'name=(\\w+).*email=(\\S+@\\S+)',
      template: '$1$|$2$',
      matchNumber: 1,
      defaultValue: '',
    },
    inputs: {
      response: { body: 'name=John email=john@example.com' },
    },
    expectedOutput: {
      status: 'success',
      extractedValues: { userInfo: 'John|john@example.com' },
    },
    timeout: 5000,
    tags: ['extractor', 'regex', 'groups'],
  },
  {
    id: 'regex-extractor-random-match',
    name: 'Regex Extractor - Random Match',
    description: 'Test regex extractor with random match selection',
    nodeType: 'regex-extractor',
    category: 'postprocessors',
    config: {
      type: 'regex-extractor',
      applyTo: 'body',
      variableName: 'randomId',
      regularExpression: 'item-(\\d+)',
      template: '$1$',
      matchNumber: 0, // Random
      defaultValue: '',
    },
    inputs: {
      response: { body: 'item-1 item-2 item-3 item-4 item-5' },
    },
    expectedOutput: {
      status: 'success',
    },
    timeout: 5000,
    tags: ['extractor', 'regex', 'random'],
  },

  // ============================================================================
  // CSS EXTRACTOR TESTS
  // ============================================================================
  {
    id: 'css-extractor-text',
    name: 'CSS Extractor - Text Content',
    description: 'Test CSS extractor getting text content',
    nodeType: 'css-extractor',
    category: 'postprocessors',
    config: {
      type: 'css-extractor',
      variableName: 'title',
      cssSelector: 'h1.page-title',
      attribute: undefined, // Get text content
      matchNumber: 1,
      defaultValue: 'No Title',
    },
    inputs: {
      response: { body: '<html><h1 class="page-title">Welcome Page</h1></html>' },
    },
    expectedOutput: {
      status: 'success',
      extractedValues: { title: 'Welcome Page' },
    },
    timeout: 5000,
    tags: ['extractor', 'css', 'text'],
  },
  {
    id: 'css-extractor-attribute',
    name: 'CSS Extractor - Attribute Value',
    description: 'Test CSS extractor getting attribute value',
    nodeType: 'css-extractor',
    category: 'postprocessors',
    config: {
      type: 'css-extractor',
      variableName: 'linkHref',
      cssSelector: 'a.nav-link',
      attribute: 'href',
      matchNumber: 1,
      defaultValue: '',
    },
    inputs: {
      response: { body: '<html><a class="nav-link" href="/dashboard">Go</a></html>' },
    },
    expectedOutput: {
      status: 'success',
      extractedValues: { linkHref: '/dashboard' },
    },
    timeout: 5000,
    tags: ['extractor', 'css', 'attribute'],
  },

  // ============================================================================
  // XPATH EXTRACTOR TESTS
  // ============================================================================
  {
    id: 'xpath-extractor-simple',
    name: 'XPath Extractor - Simple Path',
    description: 'Test XPath extractor with simple path',
    nodeType: 'xpath-extractor',
    category: 'postprocessors',
    config: {
      type: 'xpath-extractor',
      variableName: 'bookTitle',
      xpathQuery: '//book/title/text()',
      matchNumber: 1,
      defaultValue: 'Unknown',
      fragment: false,
    },
    inputs: {
      response: {
        body: '<?xml version="1.0"?><library><book><title>Clean Code</title></book></library>',
      },
    },
    expectedOutput: {
      status: 'success',
      extractedValues: { bookTitle: 'Clean Code' },
    },
    timeout: 5000,
    tags: ['extractor', 'xpath'],
  },
  {
    id: 'xpath-extractor-attribute',
    name: 'XPath Extractor - Attribute',
    description: 'Test XPath extractor getting attribute',
    nodeType: 'xpath-extractor',
    category: 'postprocessors',
    config: {
      type: 'xpath-extractor',
      variableName: 'bookId',
      xpathQuery: '//book/@id',
      matchNumber: 1,
      defaultValue: '',
      fragment: false,
    },
    inputs: {
      response: {
        body: '<?xml version="1.0"?><library><book id="123"><title>Test</title></book></library>',
      },
    },
    expectedOutput: {
      status: 'success',
      extractedValues: { bookId: '123' },
    },
    timeout: 5000,
    tags: ['extractor', 'xpath', 'attribute'],
  },

  // ============================================================================
  // BOUNDARY EXTRACTOR TESTS
  // ============================================================================
  {
    id: 'boundary-extractor-simple',
    name: 'Boundary Extractor - Simple',
    description: 'Test boundary extractor with left and right boundaries',
    nodeType: 'boundary-extractor',
    category: 'postprocessors',
    config: {
      type: 'boundary-extractor',
      variableName: 'token',
      leftBoundary: 'token=',
      rightBoundary: '&',
      matchNumber: 1,
      defaultValue: '',
    },
    inputs: {
      response: { body: 'session_id=abc&token=xyz123&user=admin' },
    },
    expectedOutput: {
      status: 'success',
      extractedValues: { token: 'xyz123' },
    },
    timeout: 5000,
    tags: ['extractor', 'boundary'],
  },
];

export default [...assertionTests, ...extractorTests];
