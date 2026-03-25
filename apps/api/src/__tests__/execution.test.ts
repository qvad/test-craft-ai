/**
 * Tests for the Execution Service
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { orchestrator } from '../modules/containers/orchestrator.js';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../modules/containers/types.js';

// Mock the k8s client
vi.mock('../modules/containers/k8s-client.js', () => ({
  k8sClient: {
    createPod: vi.fn().mockResolvedValue({ metadata: { name: 'test-pod' } }),
    deletePod: vi.fn().mockResolvedValue(undefined),
    getPod: vi.fn().mockResolvedValue({ status: { phase: 'Running' } }),
    getPodStatus: vi.fn().mockResolvedValue('Running'),
    listPods: vi.fn().mockResolvedValue([]),
    getAvailableRunner: vi.fn().mockResolvedValue(null),
    execInPod: vi.fn().mockResolvedValue({
      stdout: JSON.stringify({ status: '0', output: 'Hello World', exit_code: 0 }),
      stderr: '',
      exitCode: 0,
    }),
    copyToPod: vi.fn().mockResolvedValue(undefined),
    waitForPodReady: vi.fn().mockResolvedValue(true),
  },
}));

describe('ContainerOrchestrator', () => {
  describe('getRunnerImage', () => {
    it('should return correct image for each supported language', () => {
      SUPPORTED_LANGUAGES.forEach((lang) => {
        const image = orchestrator.getRunnerImage(lang);
        expect(image).toBeDefined();
        expect(image).toContain('testcraft/runner-');
        expect(image).toContain(lang);
      });
    });

    it('should throw for unsupported language', () => {
      expect(() => orchestrator.getRunnerImage('unsupported' as SupportedLanguage))
        .toThrow();
    });
  });

  describe('createPodSpec', () => {
    it('should create valid pod spec for Java', () => {
      const spec = orchestrator.createPodSpec('test-123', 'java', 60);

      expect(spec.apiVersion).toBe('v1');
      expect(spec.kind).toBe('Pod');
      expect(spec.metadata?.name).toBe('runner-test-123');
      expect(spec.metadata?.labels?.['testcraft.io/language']).toBe('java');
      expect(spec.spec?.activeDeadlineSeconds).toBe(60);
      expect(spec.spec?.containers?.[0]?.image).toContain('java');
    });

    it('should create valid pod spec for Python', () => {
      const spec = orchestrator.createPodSpec('test-456', 'python', 120);

      expect(spec.metadata?.name).toBe('runner-test-456');
      expect(spec.metadata?.labels?.['testcraft.io/language']).toBe('python');
      expect(spec.spec?.activeDeadlineSeconds).toBe(120);
    });

    it('should include security context', () => {
      const spec = orchestrator.createPodSpec('test-789', 'javascript', 30);

      expect(spec.spec?.securityContext?.runAsNonRoot).toBe(true);
      expect(spec.spec?.containers?.[0]?.securityContext?.allowPrivilegeEscalation).toBe(false);
    });
  });

  describe('executeWithNewPod', () => {
    it('should execute Java code successfully', async () => {
      const result = await orchestrator.executeWithNewPod({
        executionId: 'test-exec-1',
        language: 'java',
        code: 'public class Main { public static void main(String[] args) { System.out.println("Hello"); } }',
        timeout: 60,
      });

      expect(result.executionId).toBe('test-exec-1');
      expect(result.language).toBe('java');
      expect(result.status).toBe('success');
    });

    it('should execute Python code successfully', async () => {
      const result = await orchestrator.executeWithNewPod({
        executionId: 'test-exec-2',
        language: 'python',
        code: 'print("Hello from Python")',
        timeout: 30,
      });

      expect(result.executionId).toBe('test-exec-2');
      expect(result.language).toBe('python');
    });

    it('should handle execution errors', async () => {
      const { k8sClient } = await import('../modules/containers/k8s-client.js');
      vi.mocked(k8sClient.execInPod).mockRejectedValueOnce(new Error('Execution failed'));

      const result = await orchestrator.executeWithNewPod({
        executionId: 'test-exec-error',
        language: 'java',
        code: 'invalid code',
        timeout: 30,
      });

      expect(result.status).toBe('error');
      expect(result.error).toBeDefined();
    });
  });

  describe('getPoolStatus', () => {
    it('should return status for all languages', async () => {
      const status = await orchestrator.getPoolStatus();

      expect(Object.keys(status)).toHaveLength(SUPPORTED_LANGUAGES.length);
      SUPPORTED_LANGUAGES.forEach((lang) => {
        expect(status[lang]).toBeDefined();
        expect(status[lang]).toHaveProperty('ready');
        expect(status[lang]).toHaveProperty('total');
      });
    });
  });
});

describe('Language Support', () => {
  const testCodes: Record<SupportedLanguage, { code: string; expectedOutput: RegExp }> = {
    java: {
      code: 'public class Main { public static void main(String[] args) { System.out.println("Java works!"); } }',
      expectedOutput: /Java works!/,
    },
    python: {
      code: 'print("Python works!")',
      expectedOutput: /Python works!/,
    },
    csharp: {
      code: 'using System; class Program { static void Main() { Console.WriteLine("C# works!"); } }',
      expectedOutput: /C# works!/,
    },
    javascript: {
      code: 'console.log("JavaScript works!");',
      expectedOutput: /JavaScript works!/,
    },
    typescript: {
      code: 'const message: string = "TypeScript works!"; console.log(message);',
      expectedOutput: /TypeScript works!/,
    },
    go: {
      code: 'package main; import "fmt"; func main() { fmt.Println("Go works!") }',
      expectedOutput: /Go works!/,
    },
    rust: {
      code: 'fn main() { println!("Rust works!"); }',
      expectedOutput: /Rust works!/,
    },
    ruby: {
      code: 'puts "Ruby works!"',
      expectedOutput: /Ruby works!/,
    },
    php: {
      code: '<?php echo "PHP works!";',
      expectedOutput: /PHP works!/,
    },
    kotlin: {
      code: 'fun main() { println("Kotlin works!") }',
      expectedOutput: /Kotlin works!/,
    },
  };

  SUPPORTED_LANGUAGES.forEach((lang) => {
    it(`should have valid test code for ${lang}`, () => {
      expect(testCodes[lang]).toBeDefined();
      expect(testCodes[lang].code).toBeTruthy();
      expect(testCodes[lang].expectedOutput).toBeInstanceOf(RegExp);
    });
  });
});
