/**
 * Comprehensive tests for ContainerOrchestrator
 * Focuses on getDependencyInstallCommand, installDependencies, and executeWithWarmPool
 * which have no coverage in execution.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContainerOrchestrator } from '../modules/containers/orchestrator.js';
import type { LanguageDependencies } from '../modules/containers/types.js';

vi.mock('../modules/containers/k8s-client.js', () => ({
  k8sClient: {
    createPod: vi.fn().mockResolvedValue({}),
    deletePod: vi.fn().mockResolvedValue(undefined),
    waitForPodReady: vi.fn().mockResolvedValue(true),
    execInPod: vi.fn().mockResolvedValue({
      stdout: JSON.stringify({ exit_code: 0, output: 'Hello' }),
      stderr: '',
      exitCode: 0,
    }),
    copyToPod: vi.fn().mockResolvedValue(undefined),
    getAvailableRunner: vi.fn().mockResolvedValue(null),
    listPods: vi.fn().mockResolvedValue([]),
  },
}));

// ============================================================================
// getDependencyInstallCommand
// ============================================================================

describe('ContainerOrchestrator.getDependencyInstallCommand', () => {
  const orc = new ContainerOrchestrator();

  // Python
  it('returns pip install for python with packages', () => {
    const deps: LanguageDependencies = { python: { packages: ['requests', 'numpy'] } };
    expect(orc.getDependencyInstallCommand('python', deps)).toBe(
      'pip install --user requests numpy'
    );
  });

  it('returns null for python with empty packages', () => {
    expect(orc.getDependencyInstallCommand('python', { python: { packages: [] } })).toBeNull();
  });

  it('returns null for python with no python key', () => {
    expect(orc.getDependencyInstallCommand('python', {})).toBeNull();
  });

  // JavaScript / TypeScript
  it('returns npm install for javascript', () => {
    const deps: LanguageDependencies = { javascript: { packages: ['axios', 'lodash'] } };
    const cmd = orc.getDependencyInstallCommand('javascript', deps);
    expect(cmd).toContain('npm install');
    expect(cmd).toContain('axios');
    expect(cmd).toContain('lodash');
  });

  it('returns npm install for typescript (uses javascript packages)', () => {
    const deps: LanguageDependencies = { javascript: { packages: ['typescript'] } };
    const cmd = orc.getDependencyInstallCommand('typescript', deps);
    expect(cmd).toContain('npm install');
    expect(cmd).toContain('typescript');
  });

  it('returns null for javascript with empty packages', () => {
    expect(orc.getDependencyInstallCommand('javascript', { javascript: { packages: [] } })).toBeNull();
  });

  // Java
  it('returns maven command for java with maven deps', () => {
    const deps: LanguageDependencies = { java: { maven: ['com.example:lib:1.0.0', 'org.slf4j:slf4j-api:2.0.0'] } };
    const cmd = orc.getDependencyInstallCommand('java', deps);
    expect(cmd).toContain('mvn dependency:copy');
    expect(cmd).toContain('com.example:lib:1.0.0');
    expect(cmd).toContain('/app/libs');
  });

  it('returns curl command for java with jars', () => {
    const deps: LanguageDependencies = { java: { jars: ['https://example.com/mylib-1.0.jar'] } };
    const cmd = orc.getDependencyInstallCommand('java', deps);
    expect(cmd).toContain('curl');
    expect(cmd).toContain('mylib-1.0.jar');
    expect(cmd).toContain('/app/libs');
  });

  it('returns combined command for java with both maven and jars', () => {
    const deps: LanguageDependencies = {
      java: {
        maven: ['com.google.guava:guava:31.0-jre'],
        jars: ['https://example.com/extra.jar'],
      },
    };
    const cmd = orc.getDependencyInstallCommand('java', deps);
    expect(cmd).toContain('mvn dependency:copy');
    expect(cmd).toContain('curl');
  });

  it('returns null for java with empty deps object', () => {
    expect(orc.getDependencyInstallCommand('java', { java: {} })).toBeNull();
  });

  it('returns null for java with no java key', () => {
    expect(orc.getDependencyInstallCommand('java', {})).toBeNull();
  });

  it('skips malformed maven coordinates (missing version)', () => {
    const deps: LanguageDependencies = { java: { maven: ['com.example:lib'] } }; // only 2 parts
    const cmd = orc.getDependencyInstallCommand('java', deps);
    // No valid mvn command generated, result should be null (mkdir only if no commands)
    expect(cmd).toBeNull();
  });

  // Kotlin (uses java or kotlin deps)
  it('returns maven command for kotlin', () => {
    const deps: LanguageDependencies = { kotlin: { maven: ['org.jetbrains.kotlin:kotlin-stdlib:1.9.0'] } };
    const cmd = orc.getDependencyInstallCommand('kotlin', deps);
    expect(cmd).toContain('mvn dependency:copy');
  });

  // C#
  it('returns dotnet add package for csharp', () => {
    const deps: LanguageDependencies = { csharp: { packages: ['Newtonsoft.Json@13.0.1', 'Serilog'] } };
    const cmd = orc.getDependencyInstallCommand('csharp', deps);
    expect(cmd).toContain('dotnet add package');
    expect(cmd).toContain('Newtonsoft.Json');
  });

  it('returns null for csharp with empty packages', () => {
    expect(orc.getDependencyInstallCommand('csharp', { csharp: { packages: [] } })).toBeNull();
  });

  // Go
  it('returns go get for go', () => {
    const deps: LanguageDependencies = { go: { modules: ['github.com/pkg/errors', 'github.com/gorilla/mux'] } };
    const cmd = orc.getDependencyInstallCommand('go', deps);
    expect(cmd).toBe('go get github.com/pkg/errors github.com/gorilla/mux');
  });

  it('returns null for go with empty modules', () => {
    expect(orc.getDependencyInstallCommand('go', { go: { modules: [] } })).toBeNull();
  });

  // Ruby
  it('returns gem install for ruby', () => {
    const deps: LanguageDependencies = { ruby: { gems: ['rails:7.0.4', 'nokogiri'] } };
    const cmd = orc.getDependencyInstallCommand('ruby', deps);
    expect(cmd).toContain('gem install');
    expect(cmd).toContain('rails');
    expect(cmd).toContain("7.0.4");
  });

  it('returns null for ruby with empty gems', () => {
    expect(orc.getDependencyInstallCommand('ruby', { ruby: { gems: [] } })).toBeNull();
  });

  // Rust
  it('returns cargo install for rust', () => {
    const deps: LanguageDependencies = { rust: { crates: ['serde@1.0', 'tokio'] } };
    const cmd = orc.getDependencyInstallCommand('rust', deps);
    expect(cmd).toContain('cargo install');
    expect(cmd).toContain('serde@1.0');
    expect(cmd).toContain('tokio');
  });

  it('returns null for rust with empty crates', () => {
    expect(orc.getDependencyInstallCommand('rust', { rust: { crates: [] } })).toBeNull();
  });

  // PHP
  it('returns composer require for php', () => {
    const deps: LanguageDependencies = { php: { packages: ['guzzlehttp/guzzle', 'symfony/console'] } };
    const cmd = orc.getDependencyInstallCommand('php', deps);
    expect(cmd).toBe('composer require guzzlehttp/guzzle symfony/console');
  });

  it('returns null for php with empty packages', () => {
    expect(orc.getDependencyInstallCommand('php', { php: { packages: [] } })).toBeNull();
  });
});

// ============================================================================
// installDependencies
// ============================================================================

describe('ContainerOrchestrator.installDependencies', () => {
  let orc: ContainerOrchestrator;

  beforeEach(async () => {
    vi.clearAllMocks();
    orc = new ContainerOrchestrator();
    const { k8sClient } = await import('../modules/containers/k8s-client.js');
    vi.mocked(k8sClient.execInPod).mockResolvedValue({ stdout: 'installed', stderr: '', exitCode: 0 });
  });

  it('returns success immediately when no install command exists', async () => {
    const result = await orc.installDependencies('pod-1', 'python', {});
    expect(result.success).toBe(true);
    expect(result.output).toContain('No dependencies');
  });

  it('calls execInPod with sh -c and the install command', async () => {
    const { k8sClient } = await import('../modules/containers/k8s-client.js');
    await orc.installDependencies('pod-1', 'python', { python: { packages: ['requests'] } });
    expect(k8sClient.execInPod).toHaveBeenCalledWith(
      'pod-1',
      expect.any(String),
      ['sh', '-c', expect.stringContaining('pip install')]
    );
  });

  it('returns success true when exec exits with 0', async () => {
    const result = await orc.installDependencies('pod-1', 'python', { python: { packages: ['requests'] } });
    expect(result.success).toBe(true);
    expect(result.output).toContain('installed');
  });

  it('returns success false and includes stderr when exit code is non-zero', async () => {
    const { k8sClient } = await import('../modules/containers/k8s-client.js');
    vi.mocked(k8sClient.execInPod).mockResolvedValueOnce({
      stdout: '',
      stderr: 'Could not find package',
      exitCode: 1,
    });
    const result = await orc.installDependencies('pod-1', 'python', { python: { packages: ['bad-pkg'] } });
    expect(result.success).toBe(false);
    expect(result.output).toContain('Could not find package');
  });

  it('returns success false and error message on exec exception', async () => {
    const { k8sClient } = await import('../modules/containers/k8s-client.js');
    vi.mocked(k8sClient.execInPod).mockRejectedValueOnce(new Error('connection refused'));
    const result = await orc.installDependencies('pod-1', 'python', { python: { packages: ['requests'] } });
    expect(result.success).toBe(false);
    expect(result.output).toContain('connection refused');
  });

  it('installs go modules correctly', async () => {
    const { k8sClient } = await import('../modules/containers/k8s-client.js');
    await orc.installDependencies('pod-2', 'go', { go: { modules: ['github.com/pkg/errors'] } });
    expect(k8sClient.execInPod).toHaveBeenCalledWith(
      'pod-2',
      expect.any(String),
      ['sh', '-c', 'go get github.com/pkg/errors']
    );
  });
});

// ============================================================================
// executeWithWarmPool
// ============================================================================

describe('ContainerOrchestrator.executeWithWarmPool', () => {
  let orc: ContainerOrchestrator;

  beforeEach(async () => {
    vi.clearAllMocks();
    orc = new ContainerOrchestrator();
    const { k8sClient } = await import('../modules/containers/k8s-client.js');
    vi.mocked(k8sClient.getAvailableRunner).mockResolvedValue(null);
    vi.mocked(k8sClient.waitForPodReady).mockResolvedValue(true);
    vi.mocked(k8sClient.copyToPod).mockResolvedValue(undefined);
    vi.mocked(k8sClient.execInPod).mockResolvedValue({
      stdout: JSON.stringify({ exit_code: 0, output: 'Hello' }),
      stderr: '',
      exitCode: 0,
    });
  });

  it('falls back to cold start when no warm pod is available', async () => {
    const result = await orc.executeWithWarmPool({
      executionId: 'warm-fallback-1',
      language: 'python',
      code: 'print("hi")',
    });
    expect(result.executionId).toBe('warm-fallback-1');
    expect(result.status).toBe('success');
    expect(result.language).toBe('python');
  });

  it('falls back to cold start when warm pod has no metadata name', async () => {
    const { k8sClient } = await import('../modules/containers/k8s-client.js');
    vi.mocked(k8sClient.getAvailableRunner).mockResolvedValueOnce({ metadata: {} });
    const result = await orc.executeWithWarmPool({
      executionId: 'warm-fallback-2',
      language: 'java',
      code: 'System.out.println("hi");',
    });
    expect(result.status).toBe('success');
  });

  it('uses warm pod when available and returns its podName', async () => {
    const { k8sClient } = await import('../modules/containers/k8s-client.js');
    vi.mocked(k8sClient.getAvailableRunner).mockResolvedValueOnce({
      metadata: { name: 'warm-pod-python-42' },
    });
    const result = await orc.executeWithWarmPool({
      executionId: 'warm-hit-1',
      language: 'python',
      code: 'print("warm")',
    });
    expect(result.podName).toBe('warm-pod-python-42');
    expect(result.status).toBe('success');
    expect(result.output).toBe('Hello');
  });

  it('parses JSON output from warm pod correctly', async () => {
    const { k8sClient } = await import('../modules/containers/k8s-client.js');
    vi.mocked(k8sClient.getAvailableRunner).mockResolvedValueOnce({
      metadata: { name: 'warm-pod-go-1' },
    });
    vi.mocked(k8sClient.execInPod).mockResolvedValueOnce({
      stdout: JSON.stringify({ exit_code: 0, output: 'Go output', variables: { x: 42 } }),
      stderr: '',
      exitCode: 0,
    });
    const result = await orc.executeWithWarmPool({
      executionId: 'warm-json-1',
      language: 'go',
      code: 'package main\nfunc main() {}',
    });
    expect(result.output).toBe('Go output');
    expect(result.variables).toEqual({ x: 42 });
    expect(result.exitCode).toBe(0);
  });

  it('falls back to raw output when JSON parse fails in warm pool', async () => {
    const { k8sClient } = await import('../modules/containers/k8s-client.js');
    vi.mocked(k8sClient.getAvailableRunner).mockResolvedValueOnce({
      metadata: { name: 'warm-pod-ruby-1' },
    });
    vi.mocked(k8sClient.execInPod).mockResolvedValueOnce({
      stdout: 'raw text output',
      stderr: '',
      exitCode: 0,
    });
    const result = await orc.executeWithWarmPool({
      executionId: 'warm-raw-1',
      language: 'ruby',
      code: 'puts "hi"',
    });
    expect(result.output).toBe('raw text output');
    expect(result.status).toBe('success');
  });

  it('includes stderr as error in raw fallback when exit code non-zero', async () => {
    const { k8sClient } = await import('../modules/containers/k8s-client.js');
    vi.mocked(k8sClient.getAvailableRunner).mockResolvedValueOnce({
      metadata: { name: 'warm-pod-php-1' },
    });
    vi.mocked(k8sClient.execInPod).mockResolvedValueOnce({
      stdout: '',
      stderr: 'PHP fatal error',
      exitCode: 1,
    });
    const result = await orc.executeWithWarmPool({
      executionId: 'warm-raw-err-1',
      language: 'php',
      code: 'bad code',
    });
    expect(result.status).toBe('error');
    expect(result.error).toBe('PHP fatal error');
  });

  it('returns error result when copyToPod throws in warm pool', async () => {
    const { k8sClient } = await import('../modules/containers/k8s-client.js');
    vi.mocked(k8sClient.getAvailableRunner).mockResolvedValueOnce({
      metadata: { name: 'warm-pod-ts-1' },
    });
    vi.mocked(k8sClient.copyToPod).mockRejectedValueOnce(new Error('network error'));
    const result = await orc.executeWithWarmPool({
      executionId: 'warm-err-1',
      language: 'typescript',
      code: 'const x = 1;',
    });
    expect(result.status).toBe('error');
    expect(result.error).toContain('network error');
    expect(result.podName).toBe('warm-pod-ts-1');
  });

  it('installs dependencies before execution in warm pool', async () => {
    const { k8sClient } = await import('../modules/containers/k8s-client.js');
    vi.mocked(k8sClient.getAvailableRunner).mockResolvedValueOnce({
      metadata: { name: 'warm-pod-python-deps' },
    });
    // First call = dep install, second = code execution
    vi.mocked(k8sClient.execInPod)
      .mockResolvedValueOnce({ stdout: 'installed', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({
        stdout: JSON.stringify({ exit_code: 0, output: 'done' }),
        stderr: '',
        exitCode: 0,
      });

    const result = await orc.executeWithWarmPool({
      executionId: 'warm-deps-1',
      language: 'python',
      code: 'import requests',
      dependencies: { python: { packages: ['requests'] } },
    });
    expect(k8sClient.execInPod).toHaveBeenCalledTimes(2);
    expect(result.status).toBe('success');
  });

  it('generates a new executionId when none is provided', async () => {
    const result = await orc.executeWithWarmPool({
      language: 'javascript',
      code: 'console.log("hi")',
    });
    expect(result.executionId).toBeTruthy();
    expect(result.executionId).toMatch(/^[0-9a-f-]{36}$/);
  });
});

// ============================================================================
// executeWithNewPod — additional edge cases
// ============================================================================

describe('ContainerOrchestrator.executeWithNewPod — additional paths', () => {
  let orc: ContainerOrchestrator;

  beforeEach(async () => {
    vi.clearAllMocks();
    orc = new ContainerOrchestrator();
    const { k8sClient } = await import('../modules/containers/k8s-client.js');
    vi.mocked(k8sClient.waitForPodReady).mockResolvedValue(true);
    vi.mocked(k8sClient.copyToPod).mockResolvedValue(undefined);
    vi.mocked(k8sClient.execInPod).mockResolvedValue({
      stdout: JSON.stringify({ exit_code: 0, output: 'ok' }),
      stderr: '',
      exitCode: 0,
    });
  });

  it('returns error when pod fails to become ready', async () => {
    const { k8sClient } = await import('../modules/containers/k8s-client.js');
    vi.mocked(k8sClient.waitForPodReady).mockResolvedValueOnce(false);

    const result = await orc.executeWithNewPod({
      executionId: 'cold-notready-1',
      language: 'rust',
      code: 'fn main() {}',
    });
    expect(result.status).toBe('error');
    expect(result.error).toContain('failed to become ready');
  });

  it('falls back to raw output on JSON parse failure', async () => {
    const { k8sClient } = await import('../modules/containers/k8s-client.js');
    vi.mocked(k8sClient.execInPod).mockResolvedValueOnce({
      stdout: 'not json at all',
      stderr: '',
      exitCode: 0,
    });

    const result = await orc.executeWithNewPod({
      executionId: 'cold-raw-1',
      language: 'kotlin',
      code: 'fun main() { }',
    });
    expect(result.output).toBe('not json at all');
    expect(result.status).toBe('success');
  });

  it('still deletes pod even when execution fails (finally block)', async () => {
    const { k8sClient } = await import('../modules/containers/k8s-client.js');
    vi.mocked(k8sClient.execInPod).mockRejectedValueOnce(new Error('timeout'));

    await orc.executeWithNewPod({
      executionId: 'cold-cleanup-1',
      language: 'csharp',
      code: 'Console.WriteLine("hi");',
    });

    expect(k8sClient.deletePod).toHaveBeenCalled();
  });

  it('handles cleanup error gracefully (does not rethrow)', async () => {
    const { k8sClient } = await import('../modules/containers/k8s-client.js');
    vi.mocked(k8sClient.deletePod).mockRejectedValueOnce(new Error('delete failed'));

    const result = await orc.executeWithNewPod({
      executionId: 'cold-cleanup-err-1',
      language: 'python',
      code: 'print("hi")',
    });
    // Should still return a result, not throw
    expect(result).toBeDefined();
  });

  it('generates executionId if not provided', async () => {
    const result = await orc.executeWithNewPod({
      language: 'go',
      code: 'package main\nfunc main() {}',
    });
    expect(result.executionId).toBeTruthy();
    expect(result.executionId).toMatch(/^[0-9a-f-]{36}$/);
  });
});
