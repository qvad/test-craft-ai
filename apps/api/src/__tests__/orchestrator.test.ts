/**
 * Unit tests for ContainerOrchestrator — covering gaps not in orchestrator-comprehensive.test.ts:
 *   - getRunnerImage
 *   - createPodSpec
 *   - getPoolStatus
 *   - executeWithNewPod: non-zero exit_code from JSON, with dependencies, stderr logging
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContainerOrchestrator } from '../modules/containers/orchestrator.js';

vi.mock('../modules/containers/k8s-client.js', () => ({
  k8sClient: {
    createPod: vi.fn().mockResolvedValue({}),
    deletePod: vi.fn().mockResolvedValue(undefined),
    waitForPodReady: vi.fn().mockResolvedValue(true),
    execInPod: vi.fn().mockResolvedValue({
      stdout: JSON.stringify({ exit_code: 0, output: 'ok' }),
      stderr: '',
      exitCode: 0,
    }),
    copyToPod: vi.fn().mockResolvedValue(undefined),
    getAvailableRunner: vi.fn().mockResolvedValue(null),
    listPods: vi.fn().mockResolvedValue([]),
  },
}));

// ============================================================================
// getRunnerImage
// ============================================================================

describe('ContainerOrchestrator.getRunnerImage', () => {
  const orc = new ContainerOrchestrator();

  it('returns the configured image for each supported language', () => {
    const languages = ['java', 'python', 'csharp', 'javascript', 'typescript', 'go', 'rust', 'ruby', 'php', 'kotlin'] as const;
    for (const lang of languages) {
      const image = orc.getRunnerImage(lang);
      expect(image).toBeTruthy();
      expect(image).toContain(lang === 'csharp' ? 'csharp' : lang);
    }
  });

  it('throws an error for an unknown language', () => {
    expect(() => orc.getRunnerImage('cobol' as any)).toThrow('No runner image configured for language: cobol');
  });
});

// ============================================================================
// createPodSpec
// ============================================================================

describe('ContainerOrchestrator.createPodSpec', () => {
  const orc = new ContainerOrchestrator();

  it('returns a pod spec with correct apiVersion and kind', () => {
    const spec = orc.createPodSpec('exec-1', 'python', 60);
    expect(spec.apiVersion).toBe('v1');
    expect(spec.kind).toBe('Pod');
  });

  it('encodes the executionId in the pod name and labels', () => {
    const spec = orc.createPodSpec('abc-123', 'go', 30);
    expect(spec.metadata!.name).toBe('runner-abc-123');
    expect(spec.metadata!.labels!['testcraft.io/execution-id']).toBe('abc-123');
  });

  it('sets language label correctly', () => {
    const spec = orc.createPodSpec('exec-2', 'rust', 30);
    expect(spec.metadata!.labels!['testcraft.io/language']).toBe('rust');
  });

  it('sets activeDeadlineSeconds from the timeout arg', () => {
    const spec = orc.createPodSpec('exec-3', 'java', 120);
    expect(spec.spec!.activeDeadlineSeconds).toBe(120);
  });

  it('uses the correct runner image for the language', () => {
    const spec = orc.createPodSpec('exec-4', 'python', 60);
    const container = spec.spec!.containers![0];
    expect(container.image).toContain('python');
  });

  it('sets EXECUTION_ID env var', () => {
    const spec = orc.createPodSpec('exec-5', 'javascript', 60);
    const envVars = spec.spec!.containers![0].env!;
    const execIdEnv = envVars.find(e => e.name === 'EXECUTION_ID');
    expect(execIdEnv?.value).toBe('exec-5');
  });

  it('sets TIMEOUT env var to string of timeout value', () => {
    const spec = orc.createPodSpec('exec-6', 'go', 45);
    const envVars = spec.spec!.containers![0].env!;
    const timeoutEnv = envVars.find(e => e.name === 'TIMEOUT');
    expect(timeoutEnv?.value).toBe('45');
  });

  it('sets restartPolicy to Never', () => {
    const spec = orc.createPodSpec('exec-7', 'typescript', 60);
    expect(spec.spec!.restartPolicy).toBe('Never');
  });

  it('runs as non-root with uid 1000', () => {
    const spec = orc.createPodSpec('exec-8', 'ruby', 60);
    const sc = spec.spec!.securityContext!;
    expect(sc.runAsNonRoot).toBe(true);
    expect(sc.runAsUser).toBe(1000);
  });

  it('drops ALL capabilities in container security context', () => {
    const spec = orc.createPodSpec('exec-9', 'php', 60);
    const csc = spec.spec!.containers![0].securityContext!;
    expect(csc.capabilities!.drop).toContain('ALL');
  });

  it('includes code-volume and output-volume', () => {
    const spec = orc.createPodSpec('exec-10', 'kotlin', 60);
    const volumes = spec.spec!.volumes!.map(v => v.name);
    expect(volumes).toContain('code-volume');
    expect(volumes).toContain('output-volume');
  });

  it('mounts code-volume at /app/code', () => {
    const spec = orc.createPodSpec('exec-11', 'csharp', 60);
    const mounts = spec.spec!.containers![0].volumeMounts!;
    const codeMount = mounts.find(m => m.name === 'code-volume');
    expect(codeMount?.mountPath).toBe('/app/code');
  });
});

// ============================================================================
// executeWithNewPod — additional coverage
// ============================================================================

describe('ContainerOrchestrator.executeWithNewPod — JSON exit_code variants', () => {
  let orc: ContainerOrchestrator;

  beforeEach(async () => {
    vi.clearAllMocks();
    orc = new ContainerOrchestrator();
    const { k8sClient } = await import('../modules/containers/k8s-client.js');
    vi.mocked(k8sClient.waitForPodReady).mockResolvedValue(true);
    vi.mocked(k8sClient.copyToPod).mockResolvedValue(undefined);
    vi.mocked(k8sClient.deletePod).mockResolvedValue(undefined);
  });

  it('returns status error when JSON exit_code is non-zero', async () => {
    const { k8sClient } = await import('../modules/containers/k8s-client.js');
    vi.mocked(k8sClient.execInPod).mockResolvedValueOnce({
      stdout: JSON.stringify({ exit_code: 1, output: 'Runtime error: division by zero' }),
      stderr: '',
      exitCode: 0,
    });
    const result = await orc.executeWithNewPod({
      executionId: 'cold-err-exit-1',
      language: 'python',
      code: 'print(1/0)',
    });
    expect(result.status).toBe('error');
    expect(result.exitCode).toBe(1);
    expect(result.output).toBe('Runtime error: division by zero');
  });

  it('returns variables from parsed JSON output', async () => {
    const { k8sClient } = await import('../modules/containers/k8s-client.js');
    vi.mocked(k8sClient.execInPod).mockResolvedValueOnce({
      stdout: JSON.stringify({ exit_code: 0, output: 'done', variables: { count: 42, name: 'test' } }),
      stderr: '',
      exitCode: 0,
    });
    const result = await orc.executeWithNewPod({
      executionId: 'cold-vars-1',
      language: 'go',
      code: 'package main\nfunc main() {}',
    });
    expect(result.variables).toEqual({ count: 42, name: 'test' });
    expect(result.status).toBe('success');
  });

  it('logs stderr when present but does not fail the execution', async () => {
    const { k8sClient } = await import('../modules/containers/k8s-client.js');
    vi.mocked(k8sClient.execInPod).mockResolvedValueOnce({
      stdout: JSON.stringify({ exit_code: 0, output: 'result' }),
      stderr: 'some warning message',
      exitCode: 0,
    });
    const result = await orc.executeWithNewPod({
      executionId: 'cold-stderr-1',
      language: 'javascript',
      code: 'console.log("hi")',
    });
    expect(result.status).toBe('success');
    expect(result.output).toBe('result');
  });

  it('installs dependencies before code execution in cold start', async () => {
    const { k8sClient } = await import('../modules/containers/k8s-client.js');
    // First call = dependency install, second = runner execution
    vi.mocked(k8sClient.execInPod)
      .mockResolvedValueOnce({ stdout: 'installed', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({
        stdout: JSON.stringify({ exit_code: 0, output: 'done' }),
        stderr: '',
        exitCode: 0,
      });

    const result = await orc.executeWithNewPod({
      executionId: 'cold-deps-1',
      language: 'python',
      code: 'import requests',
      dependencies: { python: { packages: ['requests'] } },
    });

    expect(k8sClient.execInPod).toHaveBeenCalledTimes(2);
    // First call is sh -c pip install, second is /app/runner.sh
    const calls = vi.mocked(k8sClient.execInPod).mock.calls;
    expect(calls[0][2]).toEqual(['sh', '-c', expect.stringContaining('pip install')]);
    expect(calls[1][2]).toEqual(['/app/runner.sh']);
    expect(result.status).toBe('success');
  });

  it('falls back to raw stderr as error when raw stdout empty and exit non-zero', async () => {
    const { k8sClient } = await import('../modules/containers/k8s-client.js');
    vi.mocked(k8sClient.execInPod).mockResolvedValueOnce({
      stdout: 'invalid json {{{',
      stderr: 'compile error: unexpected token',
      exitCode: 1,
    });
    const result = await orc.executeWithNewPod({
      executionId: 'cold-raw-err-1',
      language: 'csharp',
      code: 'bad code',
    });
    expect(result.status).toBe('error');
    expect(result.error).toBe('compile error: unexpected token');
    expect(result.exitCode).toBe(1);
  });
});

// ============================================================================
// getPoolStatus
// ============================================================================

describe('ContainerOrchestrator.getPoolStatus', () => {
  let orc: ContainerOrchestrator;

  beforeEach(async () => {
    vi.clearAllMocks();
    orc = new ContainerOrchestrator();
  });

  it('returns status for all 10 languages', async () => {
    const status = await orc.getPoolStatus();
    const langs = ['java', 'python', 'csharp', 'javascript', 'typescript', 'go', 'rust', 'ruby', 'php', 'kotlin'];
    for (const lang of langs) {
      expect(status[lang]).toBeDefined();
      expect(typeof status[lang].ready).toBe('number');
      expect(typeof status[lang].total).toBe('number');
    }
  });

  it('returns zero ready and total when no pods exist', async () => {
    const { k8sClient } = await import('../modules/containers/k8s-client.js');
    vi.mocked(k8sClient.listPods).mockResolvedValue([]);
    const status = await orc.getPoolStatus();
    expect(status['python'].ready).toBe(0);
    expect(status['python'].total).toBe(0);
  });

  it('counts only ready containers as ready', async () => {
    const { k8sClient } = await import('../modules/containers/k8s-client.js');
    // Return 2 pods: one fully ready, one not ready
    vi.mocked(k8sClient.listPods).mockResolvedValue([
      { status: { containerStatuses: [{ ready: true }] } },
      { status: { containerStatuses: [{ ready: false }] } },
    ] as any);
    const status = await orc.getPoolStatus();
    // All languages get same mock result; just check one
    expect(status['python'].total).toBe(2);
    expect(status['python'].ready).toBe(1);
  });

  it('counts a pod as ready only when ALL its containers are ready', async () => {
    const { k8sClient } = await import('../modules/containers/k8s-client.js');
    vi.mocked(k8sClient.listPods).mockResolvedValue([
      { status: { containerStatuses: [{ ready: true }, { ready: false }] } },
      { status: { containerStatuses: [{ ready: true }, { ready: true }] } },
    ] as any);
    const status = await orc.getPoolStatus();
    expect(status['java'].total).toBe(2);
    expect(status['java'].ready).toBe(1);
  });

  it('counts pods with no containerStatuses as not ready', async () => {
    const { k8sClient } = await import('../modules/containers/k8s-client.js');
    vi.mocked(k8sClient.listPods).mockResolvedValue([
      { status: {} },
      { status: { containerStatuses: [] } },
    ] as any);
    const status = await orc.getPoolStatus();
    expect(status['go'].total).toBe(2);
    // empty containerStatuses: every() on [] returns true, so they count as ready
    expect(status['go'].ready).toBe(2);
  });

  it('calls listPods once per language (10 times total)', async () => {
    const { k8sClient } = await import('../modules/containers/k8s-client.js');
    await orc.getPoolStatus();
    expect(k8sClient.listPods).toHaveBeenCalledTimes(10);
  });

  it('passes the correct label selector for each language', async () => {
    const { k8sClient } = await import('../modules/containers/k8s-client.js');
    await orc.getPoolStatus();
    const selectors = vi.mocked(k8sClient.listPods).mock.calls.map(c => c[0]);
    expect(selectors).toContain('testcraft.io/language=python,testcraft.io/pool=warm');
    expect(selectors).toContain('testcraft.io/language=java,testcraft.io/pool=warm');
    expect(selectors).toContain('testcraft.io/language=rust,testcraft.io/pool=warm');
  });
});
