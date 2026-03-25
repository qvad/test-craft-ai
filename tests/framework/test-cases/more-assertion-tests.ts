/**
 * Additional Assertion Test Cases
 * XPath, MD5, Compare, HTML, XML, BeanShell, JSR223 assertions
 */

import type { TestCase } from '../test-runner';

export const moreAssertionTests: TestCase[] = [
  // XPATH ASSERTION
  {
    id: 'xpath-assertion-element',
    name: 'XPath Assertion - Element Exists',
    description: 'Test XPath assertion for element presence',
    nodeType: 'xpath-assertion',
    category: 'assertions',
    config: {
      type: 'xpath-assertion',
      xpath: '//body',
      validate: false,
    },
    inputs: {
      response: {
        body: '<html><head><title>Test</title></head><body><p>Content</p></body></html>',
      },
    },
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) => result.output?.found === true,
    },
    timeout: 5000,
    tags: ['assertion', 'xpath'],
  },
  {
    id: 'xpath-assertion-missing',
    name: 'XPath Assertion - Missing Element',
    description: 'Test XPath assertion for missing element',
    nodeType: 'xpath-assertion',
    category: 'assertions',
    config: {
      type: 'xpath-assertion',
      xpath: '//nonexistent',
    },
    inputs: {
      response: {
        body: '<html><body>Content</body></html>',
      },
    },
    expectedOutput: {
      status: 'error',
    },
    timeout: 5000,
    tags: ['assertion', 'xpath', 'negative'],
  },

  // MD5 ASSERTION
  {
    id: 'md5hex-assertion-match',
    name: 'MD5 Assertion - Hash Match',
    description: 'Test MD5 hash assertion',
    nodeType: 'md5hex-assertion',
    category: 'assertions',
    config: {
      type: 'md5hex-assertion',
      md5hex: '098f6bcd4621d373cade4e832627b4f6', // MD5 of "test"
    },
    inputs: {
      response: { body: 'test' },
    },
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) => result.output?.passed === true,
    },
    timeout: 5000,
    tags: ['assertion', 'md5'],
  },
  {
    id: 'md5hex-assertion-mismatch',
    name: 'MD5 Assertion - Hash Mismatch',
    description: 'Test MD5 hash assertion with wrong hash',
    nodeType: 'md5hex-assertion',
    category: 'assertions',
    config: {
      type: 'md5hex-assertion',
      md5hex: 'wronghash123456789012345678901234',
    },
    inputs: {
      response: { body: 'test' },
    },
    expectedOutput: {
      status: 'error',
    },
    timeout: 5000,
    tags: ['assertion', 'md5', 'negative'],
  },

  // COMPARE ASSERTION
  {
    id: 'compare-assertion-content',
    name: 'Compare Assertion - Content Match',
    description: 'Test compare assertion for content',
    nodeType: 'compare-assertion',
    category: 'assertions',
    config: {
      type: 'compare-assertion',
      compareContent: true,
      compareTime: false,
    },
    inputs: {
      response: { body: 'test content', duration: 100 },
      previousResponse: { body: 'test content', duration: 150 },
    },
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) => result.output?.contentMatch === true,
    },
    timeout: 5000,
    tags: ['assertion', 'compare'],
  },
  {
    id: 'compare-assertion-time',
    name: 'Compare Assertion - Time Comparison',
    description: 'Test compare assertion for response time',
    nodeType: 'compare-assertion',
    category: 'assertions',
    config: {
      type: 'compare-assertion',
      compareContent: false,
      compareTime: true,
    },
    inputs: {
      response: { body: 'content', duration: 100 },
      previousResponse: { body: 'different', duration: 150 },
    },
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) => result.output?.timeDifference === 50,
    },
    timeout: 5000,
    tags: ['assertion', 'compare', 'time'],
  },

  // HTML ASSERTION
  {
    id: 'html-assertion-valid',
    name: 'HTML Assertion - Valid HTML',
    description: 'Test HTML assertion with valid HTML',
    nodeType: 'html-assertion',
    category: 'assertions',
    config: {
      type: 'html-assertion',
      errorThreshold: 0,
      warningThreshold: 5,
    },
    inputs: {
      response: {
        body: '<!DOCTYPE html><html><head><title>Test</title></head><body><p>Content</p></body></html>',
      },
    },
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) => result.output?.errorCount === 0,
    },
    timeout: 5000,
    tags: ['assertion', 'html'],
  },
  {
    id: 'html-assertion-invalid',
    name: 'HTML Assertion - Invalid HTML',
    description: 'Test HTML assertion with invalid HTML',
    nodeType: 'html-assertion',
    category: 'assertions',
    config: {
      type: 'html-assertion',
      errorThreshold: 0,
      warningThreshold: 0,
    },
    inputs: {
      response: {
        body: '<p>Just a paragraph, no html/head/body</p>',
      },
    },
    expectedOutput: {
      status: 'error',
    },
    timeout: 5000,
    tags: ['assertion', 'html', 'invalid'],
  },

  // XML ASSERTION
  {
    id: 'xml-assertion-valid',
    name: 'XML Assertion - Well-formed XML',
    description: 'Test XML assertion with well-formed XML',
    nodeType: 'xml-assertion',
    category: 'assertions',
    config: {
      type: 'xml-assertion',
      validate: true,
    },
    inputs: {
      response: {
        body: '<?xml version="1.0"?><root><item>Value</item></root>',
      },
    },
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) => result.output?.wellFormed === true,
    },
    timeout: 5000,
    tags: ['assertion', 'xml'],
  },
  {
    id: 'xml-assertion-malformed',
    name: 'XML Assertion - Malformed XML',
    description: 'Test XML assertion with malformed XML',
    nodeType: 'xml-assertion',
    category: 'assertions',
    config: {
      type: 'xml-assertion',
      validate: true,
    },
    inputs: {
      response: {
        body: '<root><unclosed>',
      },
    },
    expectedOutput: {
      status: 'error',
    },
    timeout: 5000,
    tags: ['assertion', 'xml', 'malformed'],
  },

  // BEANSHELL ASSERTION
  {
    id: 'beanshell-assertion-pass',
    name: 'BeanShell Assertion - Pass',
    description: 'Test BeanShell assertion that passes',
    nodeType: 'beanshell-assertion',
    category: 'assertions',
    config: {
      type: 'beanshell-assertion',
      language: 'beanshell',
      script: 'return true;',
    },
    inputs: { response: { body: 'test' } },
    expectedOutput: {
      status: 'success',
    },
    timeout: 5000,
    tags: ['assertion', 'beanshell'],
  },

  // JSR223 ASSERTION
  {
    id: 'jsr223-assertion-javascript-pass',
    name: 'JSR223 Assertion - JavaScript Pass',
    description: 'Test JSR223 assertion with JavaScript that passes',
    nodeType: 'jsr223-assertion',
    category: 'assertions',
    config: {
      type: 'jsr223-assertion',
      language: 'javascript',
      script: 'return response?.body?.includes("success");',
    },
    inputs: { response: { body: 'operation success completed' } },
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) => result.output?.passed === true,
    },
    timeout: 5000,
    tags: ['assertion', 'jsr223', 'javascript'],
  },
  {
    id: 'jsr223-assertion-javascript-fail',
    name: 'JSR223 Assertion - JavaScript Fail',
    description: 'Test JSR223 assertion with JavaScript that fails',
    nodeType: 'jsr223-assertion',
    category: 'assertions',
    config: {
      type: 'jsr223-assertion',
      language: 'javascript',
      script: 'return response?.body?.includes("success");',
    },
    inputs: { response: { body: 'operation failed with error' } },
    expectedOutput: {
      status: 'error',
    },
    timeout: 5000,
    tags: ['assertion', 'jsr223', 'javascript', 'fail'],
  },
];

export default moreAssertionTests;
