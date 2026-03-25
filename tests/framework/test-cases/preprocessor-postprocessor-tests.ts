/**
 * Pre-processor and Post-processor Test Cases
 */

import type { TestCase } from '../test-runner';

export const processorTests: TestCase[] = [
  // PRE-PROCESSORS
  {
    id: 'user-parameters',
    name: 'User Parameters - Basic',
    description: 'Test user parameters preprocessor',
    nodeType: 'user-parameters',
    category: 'preprocessors',
    config: {
      type: 'user-parameters',
      parameters: [
        { name: 'param1', values: ['value1', 'value2', 'value3'] },
        { name: 'param2', values: ['a', 'b', 'c'] },
      ],
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) => result.output?.parameterCount === 2,
    },
    timeout: 5000,
    tags: ['preprocessor', 'parameters'],
  },
  {
    id: 'html-link-parser',
    name: 'HTML Link Parser - Basic',
    description: 'Test HTML link parser',
    nodeType: 'html-link-parser',
    category: 'preprocessors',
    config: {
      type: 'html-link-parser',
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) => result.output?.enabled === true,
    },
    timeout: 5000,
    tags: ['preprocessor', 'html'],
  },
  {
    id: 'http-url-rewriting-modifier',
    name: 'HTTP URL Rewriting - Session ID',
    description: 'Test URL rewriting modifier',
    nodeType: 'http-url-rewriting-modifier',
    category: 'preprocessors',
    config: {
      type: 'http-url-rewriting-modifier',
      argumentName: 'jsessionid',
      pathExtension: true,
      pathExtensionNoEquals: false,
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) =>
        result.output?.argumentName === 'jsessionid' &&
        result.output?.isValid === true,
    },
    timeout: 5000,
    tags: ['preprocessor', 'url'],
  },
  {
    id: 'beanshell-preprocessor',
    name: 'BeanShell Preprocessor - Basic',
    description: 'Test BeanShell preprocessor',
    nodeType: 'beanshell-preprocessor',
    category: 'preprocessors',
    config: {
      type: 'beanshell-preprocessor',
      language: 'beanshell',
      script: 'vars.put("testVar", "testValue");',
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) => result.output?.executed === true,
    },
    timeout: 5000,
    tags: ['preprocessor', 'beanshell'],
  },
  {
    id: 'jsr223-preprocessor-javascript',
    name: 'JSR223 Preprocessor - JavaScript',
    description: 'Test JSR223 preprocessor with JavaScript',
    nodeType: 'jsr223-preprocessor',
    category: 'preprocessors',
    config: {
      type: 'jsr223-preprocessor',
      language: 'javascript',
      script: 'return { processed: true, timestamp: Date.now() };',
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) => result.output?.result?.processed === true,
    },
    timeout: 5000,
    tags: ['preprocessor', 'jsr223', 'javascript'],
  },
  {
    id: 'jsr223-preprocessor-groovy',
    name: 'JSR223 Preprocessor - Groovy',
    description: 'Test JSR223 preprocessor with Groovy',
    nodeType: 'jsr223-preprocessor',
    category: 'preprocessors',
    config: {
      type: 'jsr223-preprocessor',
      language: 'groovy',
      script: 'vars.put("groovyVar", "groovyValue")',
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) => result.output?.language === 'groovy',
    },
    timeout: 5000,
    tags: ['preprocessor', 'jsr223', 'groovy'],
  },

  // POST-PROCESSORS
  {
    id: 'result-status-handler',
    name: 'Result Status Handler - Basic',
    description: 'Test result status handler',
    nodeType: 'result-status-handler',
    category: 'postprocessors',
    config: {
      type: 'result-status-handler',
      failOnError: true,
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) => result.output?.failOnError === true,
    },
    timeout: 5000,
    tags: ['postprocessor', 'status'],
  },
  {
    id: 'beanshell-postprocessor',
    name: 'BeanShell Postprocessor - Basic',
    description: 'Test BeanShell postprocessor',
    nodeType: 'beanshell-postprocessor',
    category: 'postprocessors',
    config: {
      type: 'beanshell-postprocessor',
      language: 'beanshell',
      script: 'String response = prev.getResponseDataAsString();',
    },
    inputs: { response: { body: 'test response' } },
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) => result.output?.executed === true,
    },
    timeout: 5000,
    tags: ['postprocessor', 'beanshell'],
  },
  {
    id: 'jsr223-postprocessor-javascript',
    name: 'JSR223 Postprocessor - JavaScript',
    description: 'Test JSR223 postprocessor with JavaScript',
    nodeType: 'jsr223-postprocessor',
    category: 'postprocessors',
    config: {
      type: 'jsr223-postprocessor',
      language: 'javascript',
      script: 'return { postProcessed: true, responseLength: prev?.body?.length || 0 };',
    },
    inputs: { response: { body: 'test response data' } },
    expectedOutput: {
      status: 'success',
      customValidator: (result: any) => result.output?.result?.postProcessed === true,
    },
    timeout: 5000,
    tags: ['postprocessor', 'jsr223', 'javascript'],
  },
];

export default processorTests;
