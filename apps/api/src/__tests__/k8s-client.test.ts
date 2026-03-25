/**
 * Unit tests for K8sClient — comprehensive coverage of all public methods.
 * @kubernetes/client-node is fully mocked; no real cluster required.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks — must be declared before any imports so that vi.mock
// factories (which are hoisted to the top of the file) can reference them.
// ---------------------------------------------------------------------------

const configMock = vi.hoisted(() => ({
  config: {
    k8s: {
      namespace: 'testcraft-runners',
      inCluster: false,
      configPath: undefined as string | undefined,
    },
  },
}));

const k8sMocks = vi.hoisted(() => {
  const mockLoadFromCluster = vi.fn();
  const mockLoadFromFile = vi.fn();
  const mockLoadFromDefault = vi.fn();

  const mockCreateNamespacedPod = vi.fn();
  const mockDeleteNamespacedPod = vi.fn();
  const mockReadNamespacedPod = vi.fn();
  const mockListNamespacedPod = vi.fn();
  const mockReadNamespacedPodLog = vi.fn();
  const mockExecFn = vi.fn();
  const mockMakeApiClient = vi.fn();

  const mockCoreApiInstance = {
    createNamespacedPod: mockCreateNamespacedPod,
    deleteNamespacedPod: mockDeleteNamespacedPod,
    readNamespacedPod: mockReadNamespacedPod,
    listNamespacedPod: mockListNamespacedPod,
    readNamespacedPodLog: mockReadNamespacedPodLog,
  };

  mockMakeApiClient.mockReturnValue(mockCoreApiInstance);

  return {
    mockLoadFromCluster,
    mockLoadFromFile,
    mockLoadFromDefault,
    mockCreateNamespacedPod,
    mockDeleteNamespacedPod,
    mockReadNamespacedPod,
    mockListNamespacedPod,
    mockReadNamespacedPodLog,
    mockExecFn,
    mockMakeApiClient,
    mockCoreApiInstance,
  };
});

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../config/index.js', () => configMock);

vi.mock('../common/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@kubernetes/client-node', () => ({
  KubeConfig: vi.fn().mockImplementation(() => ({
    loadFromCluster: k8sMocks.mockLoadFromCluster,
    loadFromFile: k8sMocks.mockLoadFromFile,
    loadFromDefault: k8sMocks.mockLoadFromDefault,
    makeApiClient: k8sMocks.mockMakeApiClient,
  })),
  CoreV1Api: class MockCoreV1Api {},
  Exec: vi.fn().mockImplementation(() => ({ exec: k8sMocks.mockExecFn })),
  Log: vi.fn().mockImplementation(() => ({})),
}));

// ---------------------------------------------------------------------------
// Imports — after mocks are set up
// ---------------------------------------------------------------------------

import { K8sClient } from '../modules/containers/k8s-client.js';
import { config } from '../config/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePod(name: string, phase: string, containerReadiness: boolean[] = []) {
  return {
    metadata: { name, uid: `uid-${name}` },
    status: {
      phase,
      containerStatuses: containerReadiness.map((ready, i) => ({ name: `c${i}`, ready })),
    },
  };
}

function makeExecImpl(
  stdoutData: string,
  stderrData: string,
  statusStr: string,
  inspectStdin?: (stdin: unknown) => void
) {
  return (
    _ns: string,
    _pod: string,
    _container: string,
    _cmd: string[],
    stdout: NodeJS.WritableStream,
    stderr: NodeJS.WritableStream,
    stdin: unknown,
    _tty: boolean,
    cb: (status: { status: string; reason?: string; message?: string }) => void
  ) => {
    if (inspectStdin) inspectStdin(stdin);
    if (stdoutData) stdout.write(stdoutData);
    if (stderrData) stderr.write(stderrData);
    cb({ status: statusStr });
    return Promise.resolve();
  };
}

// ===========================================================================
// Constructor
// ===========================================================================

describe('K8sClient — constructor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    config.k8s.inCluster = false;
    config.k8s.configPath = undefined;
    // Ensure makeApiClient always returns the mock core api
    k8sMocks.mockMakeApiClient.mockReturnValue(k8sMocks.mockCoreApiInstance);
  });

  it('calls loadFromDefault when not in-cluster and no configPath', () => {
    new K8sClient();
    expect(k8sMocks.mockLoadFromDefault).toHaveBeenCalledOnce();
    expect(k8sMocks.mockLoadFromCluster).not.toHaveBeenCalled();
    expect(k8sMocks.mockLoadFromFile).not.toHaveBeenCalled();
  });

  it('calls loadFromCluster when inCluster is true', () => {
    config.k8s.inCluster = true;
    new K8sClient();
    expect(k8sMocks.mockLoadFromCluster).toHaveBeenCalledOnce();
    expect(k8sMocks.mockLoadFromDefault).not.toHaveBeenCalled();
    expect(k8sMocks.mockLoadFromFile).not.toHaveBeenCalled();
  });

  it('calls loadFromFile with configPath when configPath is set', () => {
    config.k8s.configPath = '/home/user/.kube/config';
    new K8sClient();
    expect(k8sMocks.mockLoadFromFile).toHaveBeenCalledWith('/home/user/.kube/config');
    expect(k8sMocks.mockLoadFromDefault).not.toHaveBeenCalled();
    expect(k8sMocks.mockLoadFromCluster).not.toHaveBeenCalled();
  });

  it('exposes the core API via the .core accessor', () => {
    const client = new K8sClient();
    expect(client.core).toBe(k8sMocks.mockCoreApiInstance);
  });

  it('exposes the KubeConfig via the .kubeConfig accessor', () => {
    const client = new K8sClient();
    expect(client.kubeConfig).toBeDefined();
  });
});

// ===========================================================================
// createPod
// ===========================================================================

describe('K8sClient.createPod', () => {
  let client: K8sClient;

  beforeEach(() => {
    vi.clearAllMocks();
    k8sMocks.mockMakeApiClient.mockReturnValue(k8sMocks.mockCoreApiInstance);
    client = new K8sClient();
  });

  it('returns the created pod body on success', async () => {
    const inputPod = {
      metadata: { name: 'runner-1', namespace: 'testcraft-runners' },
      spec: { containers: [{ image: 'python:latest' }] },
    };
    const createdPod = { metadata: { name: 'runner-1', uid: 'abc-123' } };
    k8sMocks.mockCreateNamespacedPod.mockResolvedValueOnce({ body: createdPod });

    const result = await client.createPod(inputPod as any);
    expect(result).toEqual(createdPod);
    expect(k8sMocks.mockCreateNamespacedPod).toHaveBeenCalledWith('testcraft-runners', inputPod);
  });

  it('uses the pod metadata.namespace over the default', async () => {
    const pod = { metadata: { name: 'runner-1', namespace: 'custom-ns' }, spec: {} };
    k8sMocks.mockCreateNamespacedPod.mockResolvedValueOnce({ body: { metadata: {} } });

    await client.createPod(pod as any);
    expect(k8sMocks.mockCreateNamespacedPod).toHaveBeenCalledWith('custom-ns', pod);
  });

  it('uses the default namespace when pod.metadata.namespace is absent', async () => {
    const pod = { metadata: { name: 'runner-2' }, spec: {} };
    k8sMocks.mockCreateNamespacedPod.mockResolvedValueOnce({ body: { metadata: {} } });

    await client.createPod(pod as any);
    expect(k8sMocks.mockCreateNamespacedPod).toHaveBeenCalledWith('testcraft-runners', pod);
  });

  it('propagates API errors', async () => {
    k8sMocks.mockCreateNamespacedPod.mockRejectedValueOnce(new Error('quota exceeded'));
    await expect(client.createPod({ metadata: { name: 'bad' } } as any)).rejects.toThrow(
      'quota exceeded'
    );
  });

  it('propagates non-Error API failures', async () => {
    k8sMocks.mockCreateNamespacedPod.mockRejectedValueOnce('raw string error');
    await expect(client.createPod({ metadata: {} } as any)).rejects.toBe('raw string error');
  });
});

// ===========================================================================
// deletePod
// ===========================================================================

describe('K8sClient.deletePod', () => {
  let client: K8sClient;

  beforeEach(() => {
    vi.clearAllMocks();
    k8sMocks.mockMakeApiClient.mockReturnValue(k8sMocks.mockCoreApiInstance);
    client = new K8sClient();
  });

  it('calls deleteNamespacedPod with the pod name and default namespace', async () => {
    k8sMocks.mockDeleteNamespacedPod.mockResolvedValueOnce({});

    await client.deletePod('runner-1');
    expect(k8sMocks.mockDeleteNamespacedPod).toHaveBeenCalledWith('runner-1', 'testcraft-runners');
  });

  it('uses the provided namespace override', async () => {
    k8sMocks.mockDeleteNamespacedPod.mockResolvedValueOnce({});

    await client.deletePod('runner-1', 'other-ns');
    expect(k8sMocks.mockDeleteNamespacedPod).toHaveBeenCalledWith('runner-1', 'other-ns');
  });

  it('resolves with void on success', async () => {
    k8sMocks.mockDeleteNamespacedPod.mockResolvedValueOnce({});

    const result = await client.deletePod('runner-1');
    expect(result).toBeUndefined();
  });

  it('propagates API errors', async () => {
    k8sMocks.mockDeleteNamespacedPod.mockRejectedValueOnce(new Error('not found'));
    await expect(client.deletePod('missing-pod')).rejects.toThrow('not found');
  });
});

// ===========================================================================
// getPod
// ===========================================================================

describe('K8sClient.getPod', () => {
  let client: K8sClient;

  beforeEach(() => {
    vi.clearAllMocks();
    k8sMocks.mockMakeApiClient.mockReturnValue(k8sMocks.mockCoreApiInstance);
    client = new K8sClient();
  });

  it('returns the pod body', async () => {
    const pod = { metadata: { name: 'runner-1' }, status: { phase: 'Running' } };
    k8sMocks.mockReadNamespacedPod.mockResolvedValueOnce({ body: pod });

    const result = await client.getPod('runner-1');
    expect(result).toEqual(pod);
    expect(k8sMocks.mockReadNamespacedPod).toHaveBeenCalledWith('runner-1', 'testcraft-runners');
  });

  it('uses the custom namespace when provided', async () => {
    k8sMocks.mockReadNamespacedPod.mockResolvedValueOnce({ body: {} });

    await client.getPod('pod', 'custom-ns');
    expect(k8sMocks.mockReadNamespacedPod).toHaveBeenCalledWith('pod', 'custom-ns');
  });

  it('propagates API errors', async () => {
    k8sMocks.mockReadNamespacedPod.mockRejectedValueOnce(new Error('not found'));
    await expect(client.getPod('ghost-pod')).rejects.toThrow('not found');
  });
});

// ===========================================================================
// getPodStatus
// ===========================================================================

describe('K8sClient.getPodStatus', () => {
  let client: K8sClient;

  beforeEach(() => {
    vi.clearAllMocks();
    k8sMocks.mockMakeApiClient.mockReturnValue(k8sMocks.mockCoreApiInstance);
    client = new K8sClient();
  });

  it.each(['Pending', 'Running', 'Succeeded', 'Failed', 'Unknown'])(
    'returns "%s" phase',
    async (phase) => {
      k8sMocks.mockReadNamespacedPod.mockResolvedValueOnce({ body: { status: { phase } } });
      const result = await client.getPodStatus('pod');
      expect(result).toBe(phase);
    }
  );

  it('returns undefined when pod has no status phase', async () => {
    k8sMocks.mockReadNamespacedPod.mockResolvedValueOnce({ body: { status: {} } });
    expect(await client.getPodStatus('pod')).toBeUndefined();
  });

  it('returns undefined when pod has no status at all', async () => {
    k8sMocks.mockReadNamespacedPod.mockResolvedValueOnce({ body: {} });
    expect(await client.getPodStatus('pod')).toBeUndefined();
  });
});

// ===========================================================================
// listPods
// ===========================================================================

describe('K8sClient.listPods', () => {
  let client: K8sClient;

  beforeEach(() => {
    vi.clearAllMocks();
    k8sMocks.mockMakeApiClient.mockReturnValue(k8sMocks.mockCoreApiInstance);
    client = new K8sClient();
  });

  it('returns the pod items array', async () => {
    const pods = [{ metadata: { name: 'pod-1' } }, { metadata: { name: 'pod-2' } }];
    k8sMocks.mockListNamespacedPod.mockResolvedValueOnce({ body: { items: pods } });

    const result = await client.listPods('app=testcraft');
    expect(result).toEqual(pods);
  });

  it('forwards the label selector as the 6th argument', async () => {
    k8sMocks.mockListNamespacedPod.mockResolvedValueOnce({ body: { items: [] } });

    await client.listPods('testcraft.io/language=python,testcraft.io/pool=warm');

    const call = k8sMocks.mockListNamespacedPod.mock.calls[0];
    expect(call[0]).toBe('testcraft-runners');
    expect(call[5]).toBe('testcraft.io/language=python,testcraft.io/pool=warm');
  });

  it('uses the provided namespace', async () => {
    k8sMocks.mockListNamespacedPod.mockResolvedValueOnce({ body: { items: [] } });

    await client.listPods('app=x', 'other-ns');
    expect(k8sMocks.mockListNamespacedPod.mock.calls[0][0]).toBe('other-ns');
  });

  it('returns an empty array when no pods match', async () => {
    k8sMocks.mockListNamespacedPod.mockResolvedValueOnce({ body: { items: [] } });
    const result = await client.listPods('app=nonexistent');
    expect(result).toEqual([]);
  });
});

// ===========================================================================
// getAvailableRunner
// ===========================================================================

describe('K8sClient.getAvailableRunner', () => {
  let client: K8sClient;

  beforeEach(() => {
    vi.clearAllMocks();
    k8sMocks.mockMakeApiClient.mockReturnValue(k8sMocks.mockCoreApiInstance);
    client = new K8sClient();
  });

  it('returns the first ready pod', async () => {
    const pod = makePod('runner-py-1', 'Running', [true]);
    k8sMocks.mockListNamespacedPod.mockResolvedValueOnce({ body: { items: [pod] } });

    const result = await client.getAvailableRunner('python');
    expect(result).toEqual(pod);
  });

  it('returns null when no pods are present', async () => {
    k8sMocks.mockListNamespacedPod.mockResolvedValueOnce({ body: { items: [] } });
    expect(await client.getAvailableRunner('go')).toBeNull();
  });

  it('returns null when a pod exists but its container is not ready', async () => {
    const pod = makePod('runner-1', 'Running', [false]);
    k8sMocks.mockListNamespacedPod.mockResolvedValueOnce({ body: { items: [pod] } });
    expect(await client.getAvailableRunner('python')).toBeNull();
  });

  it('requires ALL containers in a pod to be ready', async () => {
    const partiallyReady = makePod('runner-1', 'Running', [true, false]);
    k8sMocks.mockListNamespacedPod.mockResolvedValueOnce({ body: { items: [partiallyReady] } });
    expect(await client.getAvailableRunner('typescript')).toBeNull();
  });

  it('skips unready pods and returns the first ready one', async () => {
    const pod1 = makePod('runner-1', 'Running', [false]);
    const pod2 = makePod('runner-2', 'Running', [true]);
    const pod3 = makePod('runner-3', 'Running', [true]);
    k8sMocks.mockListNamespacedPod.mockResolvedValueOnce({ body: { items: [pod1, pod2, pod3] } });

    const result = await client.getAvailableRunner('rust');
    expect(result?.metadata?.name).toBe('runner-2');
  });

  it('treats a pod with empty containerStatuses as ready (vacuous truth)', async () => {
    const pod = { metadata: { name: 'runner-1' }, status: { containerStatuses: [] } };
    k8sMocks.mockListNamespacedPod.mockResolvedValueOnce({ body: { items: [pod] } });

    const result = await client.getAvailableRunner('ruby');
    expect(result).toEqual(pod);
  });

  it('uses the correct label selector for the given language', async () => {
    k8sMocks.mockListNamespacedPod.mockResolvedValueOnce({ body: { items: [] } });

    await client.getAvailableRunner('java');

    const call = k8sMocks.mockListNamespacedPod.mock.calls[0];
    expect(call[5]).toBe('testcraft.io/language=java,testcraft.io/pool=warm');
  });

  it('constructs the correct selector for every supported language', async () => {
    const languages = ['java', 'python', 'go', 'rust', 'csharp', 'javascript', 'typescript', 'ruby', 'php', 'kotlin'];
    for (const lang of languages) {
      k8sMocks.mockListNamespacedPod.mockResolvedValueOnce({ body: { items: [] } });
      await client.getAvailableRunner(lang);
    }
    const selectors = k8sMocks.mockListNamespacedPod.mock.calls.map((c) => c[5]);
    for (const lang of languages) {
      expect(selectors).toContain(`testcraft.io/language=${lang},testcraft.io/pool=warm`);
    }
  });
});

// ===========================================================================
// execInPod
// ===========================================================================

describe('K8sClient.execInPod', () => {
  let client: K8sClient;

  beforeEach(() => {
    vi.clearAllMocks();
    k8sMocks.mockMakeApiClient.mockReturnValue(k8sMocks.mockCoreApiInstance);
    client = new K8sClient();
  });

  it('returns stdout, stderr and exitCode=0 on Success status', async () => {
    k8sMocks.mockExecFn.mockImplementation(
      makeExecImpl('output data', 'warn msg', 'Success')
    );

    const result = await client.execInPod('pod-1', 'testcraft-runners', ['echo', 'hello']);
    expect(result.stdout).toBe('output data');
    expect(result.stderr).toBe('warn msg');
    expect(result.exitCode).toBe(0);
  });

  it('returns exitCode=1 when status is not Success', async () => {
    k8sMocks.mockExecFn.mockImplementation(
      makeExecImpl('', '', 'Failure')
    );

    const result = await client.execInPod('pod-1', 'ns', ['/app/runner.sh']);
    expect(result.exitCode).toBe(1);
  });

  it('concatenates multiple stdout chunks', async () => {
    k8sMocks.mockExecFn.mockImplementation(
      (_ns: string, _pod: string, _c: string, _cmd: string[], stdout: any, _stderr: any, _stdin: any, _tty: boolean, cb: any) => {
        stdout.write('chunk1');
        stdout.write('chunk2');
        stdout.write('chunk3');
        cb({ status: 'Success' });
        return Promise.resolve();
      }
    );

    const result = await client.execInPod('pod', 'ns', ['cat', 'file']);
    expect(result.stdout).toBe('chunk1chunk2chunk3');
  });

  it('passes null as stdin when no stdin arg is given', async () => {
    let capturedStdin: unknown;
    k8sMocks.mockExecFn.mockImplementation(
      makeExecImpl('', '', 'Success', (s) => { capturedStdin = s; })
    );

    await client.execInPod('pod', 'ns', ['ls']);
    expect(capturedStdin).toBeNull();
  });

  it('passes a Readable stream as stdin when stdin string is provided', async () => {
    let capturedStdin: unknown;
    k8sMocks.mockExecFn.mockImplementation(
      makeExecImpl('', '', 'Success', (s) => { capturedStdin = s; })
    );

    await client.execInPod('pod', 'ns', ['cat'], 'input data');
    expect(capturedStdin).not.toBeNull();
    // Should be a Readable stream
    expect(typeof (capturedStdin as any).pipe).toBe('function');
  });

  it('calls exec with the correct namespace, pod name, and container', async () => {
    k8sMocks.mockExecFn.mockImplementation(
      makeExecImpl('', '', 'Success')
    );

    await client.execInPod('my-pod', 'my-ns', ['sh', '-c', 'echo hi']);

    expect(k8sMocks.mockExecFn).toHaveBeenCalledWith(
      'my-ns',
      'my-pod',
      'runner',
      ['sh', '-c', 'echo hi'],
      expect.anything(),
      expect.anything(),
      null,
      false,
      expect.any(Function)
    );
  });

  it('rejects when exec itself throws (e.g. WebSocket error)', async () => {
    k8sMocks.mockExecFn.mockReturnValueOnce(Promise.reject(new Error('WebSocket failed')));

    await expect(client.execInPod('pod', 'ns', ['cmd'])).rejects.toThrow('WebSocket failed');
  });

  it('returns empty stdout and stderr when streams receive no data', async () => {
    k8sMocks.mockExecFn.mockImplementation(
      makeExecImpl('', '', 'Success')
    );

    const result = await client.execInPod('pod', 'ns', ['true']);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('');
    expect(result.exitCode).toBe(0);
  });
});

// ===========================================================================
// copyToPod
// ===========================================================================

describe('K8sClient.copyToPod', () => {
  let client: K8sClient;

  beforeEach(() => {
    vi.clearAllMocks();
    k8sMocks.mockMakeApiClient.mockReturnValue(k8sMocks.mockCoreApiInstance);
    client = new K8sClient();
  });

  it('calls execInPod with a cat command targeting the destination path', async () => {
    k8sMocks.mockExecFn.mockImplementation(makeExecImpl('', '', 'Success'));

    await client.copyToPod('my-pod', 'my-ns', 'print("hello")', '/app/code/main.py');

    expect(k8sMocks.mockExecFn).toHaveBeenCalledWith(
      'my-ns',
      'my-pod',
      'runner',
      ['sh', '-c', 'cat > /app/code/main.py'],
      expect.anything(),
      expect.anything(),
      expect.anything(), // stdin — the file content
      false,
      expect.any(Function)
    );
  });

  it('passes content as stdin (non-null)', async () => {
    let capturedStdin: unknown;
    k8sMocks.mockExecFn.mockImplementation(
      makeExecImpl('', '', 'Success', (s) => { capturedStdin = s; })
    );

    await client.copyToPod('pod', 'ns', 'file content here', '/dest/file.txt');
    expect(capturedStdin).not.toBeNull();
  });

  it('constructs the cat command with the correct path', async () => {
    k8sMocks.mockExecFn.mockImplementation(makeExecImpl('', '', 'Success'));

    await client.copyToPod('pod', 'ns', 'data', '/var/run/code.js');

    const callArgs = k8sMocks.mockExecFn.mock.calls[0];
    expect(callArgs[3]).toEqual(['sh', '-c', 'cat > /var/run/code.js']);
  });

  it('resolves with void on success', async () => {
    k8sMocks.mockExecFn.mockImplementation(makeExecImpl('', '', 'Success'));
    const result = await client.copyToPod('pod', 'ns', 'x', '/app/x');
    expect(result).toBeUndefined();
  });
});

// ===========================================================================
// getPodLogs
// ===========================================================================

describe('K8sClient.getPodLogs', () => {
  let client: K8sClient;

  beforeEach(() => {
    vi.clearAllMocks();
    k8sMocks.mockMakeApiClient.mockReturnValue(k8sMocks.mockCoreApiInstance);
    client = new K8sClient();
  });

  it('returns the log body string', async () => {
    k8sMocks.mockReadNamespacedPodLog.mockResolvedValueOnce({ body: 'line1\nline2\n' });

    const logs = await client.getPodLogs('runner-1');
    expect(logs).toBe('line1\nline2\n');
  });

  it('uses the default tail of 100 lines', async () => {
    k8sMocks.mockReadNamespacedPodLog.mockResolvedValueOnce({ body: '' });

    await client.getPodLogs('runner-1');
    const callArgs = k8sMocks.mockReadNamespacedPodLog.mock.calls[0];
    expect(callArgs[9]).toBe(100);
  });

  it('uses a custom tailLines value', async () => {
    k8sMocks.mockReadNamespacedPodLog.mockResolvedValueOnce({ body: '' });

    await client.getPodLogs('runner-1', 'testcraft-runners', 50);
    const callArgs = k8sMocks.mockReadNamespacedPodLog.mock.calls[0];
    expect(callArgs[9]).toBe(50);
  });

  it('uses the custom namespace', async () => {
    k8sMocks.mockReadNamespacedPodLog.mockResolvedValueOnce({ body: '' });

    await client.getPodLogs('runner-1', 'custom-ns');
    const callArgs = k8sMocks.mockReadNamespacedPodLog.mock.calls[0];
    expect(callArgs[0]).toBe('runner-1');
    expect(callArgs[1]).toBe('custom-ns');
  });

  it('returns an empty string when there are no logs', async () => {
    k8sMocks.mockReadNamespacedPodLog.mockResolvedValueOnce({ body: '' });
    expect(await client.getPodLogs('pod')).toBe('');
  });
});

// ===========================================================================
// waitForPodReady
// ===========================================================================

describe('K8sClient.waitForPodReady', () => {
  let client: K8sClient;

  beforeEach(() => {
    vi.clearAllMocks();
    k8sMocks.mockMakeApiClient.mockReturnValue(k8sMocks.mockCoreApiInstance);
    client = new K8sClient();
  });

  it('returns true immediately when pod is Running and all containers are ready', async () => {
    k8sMocks.mockReadNamespacedPod.mockResolvedValueOnce({
      body: {
        status: {
          phase: 'Running',
          containerStatuses: [{ name: 'runner', ready: true }],
        },
      },
    });

    const result = await client.waitForPodReady('pod', 'ns', 5000);
    expect(result).toBe(true);
    expect(k8sMocks.mockReadNamespacedPod).toHaveBeenCalledOnce();
  });

  it('returns false immediately when pod is in Failed phase', async () => {
    k8sMocks.mockReadNamespacedPod.mockResolvedValueOnce({
      body: {
        status: {
          phase: 'Failed',
          conditions: [{ type: 'Ready', reason: 'OOMKilled' }],
        },
      },
    });

    const result = await client.waitForPodReady('pod', 'ns', 5000);
    expect(result).toBe(false);
    expect(k8sMocks.mockReadNamespacedPod).toHaveBeenCalledOnce();
  });

  it('returns false immediately when pod is in Unknown phase', async () => {
    k8sMocks.mockReadNamespacedPod.mockResolvedValueOnce({
      body: { status: { phase: 'Unknown' } },
    });

    const result = await client.waitForPodReady('pod', 'ns', 5000);
    expect(result).toBe(false);
  });

  it('returns false without polling when timeoutMs is 0', async () => {
    const result = await client.waitForPodReady('pod', 'ns', 0);
    expect(result).toBe(false);
    expect(k8sMocks.mockReadNamespacedPod).not.toHaveBeenCalled();
  });

  it('polls again after getPod throws and eventually returns true', async () => {
    vi.useFakeTimers();
    try {
      k8sMocks.mockReadNamespacedPod
        .mockRejectedValueOnce(new Error('pod not found'))
        .mockResolvedValueOnce({
          body: {
            status: {
              phase: 'Running',
              containerStatuses: [{ ready: true }],
            },
          },
        });

      const resultPromise = client.waitForPodReady('pod', 'ns', 10_000);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toBe(true);
      expect(k8sMocks.mockReadNamespacedPod).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('polls again when pod is Running but containers are not yet ready', async () => {
    vi.useFakeTimers();
    try {
      k8sMocks.mockReadNamespacedPod
        .mockResolvedValueOnce({
          body: {
            status: {
              phase: 'Running',
              containerStatuses: [{ name: 'runner', ready: false }],
            },
          },
        })
        .mockResolvedValueOnce({
          body: {
            status: {
              phase: 'Running',
              containerStatuses: [{ name: 'runner', ready: true }],
            },
          },
        });

      const resultPromise = client.waitForPodReady('pod', 'ns', 10_000);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toBe(true);
      expect(k8sMocks.mockReadNamespacedPod).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('polls through Pending phase and returns true when Running+ready', async () => {
    vi.useFakeTimers();
    try {
      k8sMocks.mockReadNamespacedPod
        .mockResolvedValueOnce({ body: { status: { phase: 'Pending' } } })
        .mockResolvedValueOnce({
          body: {
            status: {
              phase: 'Running',
              containerStatuses: [{ ready: true }],
            },
          },
        });

      const resultPromise = client.waitForPodReady('pod', 'ns', 10_000);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns true for a pod with no containerStatuses (all-ready vacuous truth)', async () => {
    k8sMocks.mockReadNamespacedPod.mockResolvedValueOnce({
      body: { status: { phase: 'Running', containerStatuses: [] } },
    });

    const result = await client.waitForPodReady('pod', 'ns', 5000);
    expect(result).toBe(true);
  });
});

// ===========================================================================
// waitForPodCompletion
// ===========================================================================

describe('K8sClient.waitForPodCompletion', () => {
  let client: K8sClient;

  beforeEach(() => {
    vi.clearAllMocks();
    k8sMocks.mockMakeApiClient.mockReturnValue(k8sMocks.mockCoreApiInstance);
    client = new K8sClient();
  });

  it('returns { success: true, phase: "Succeeded" } when pod succeeds', async () => {
    k8sMocks.mockReadNamespacedPod.mockResolvedValueOnce({
      body: { status: { phase: 'Succeeded' } },
    });

    const result = await client.waitForPodCompletion('pod', 'ns', 5000);
    expect(result).toEqual({ success: true, phase: 'Succeeded' });
  });

  it('returns { success: false, phase: "Failed" } when pod fails', async () => {
    k8sMocks.mockReadNamespacedPod.mockResolvedValueOnce({
      body: {
        status: {
          phase: 'Failed',
          containerStatuses: [
            { state: { terminated: { exitCode: 137, reason: 'OOMKilled' } } },
          ],
        },
      },
    });

    const result = await client.waitForPodCompletion('pod', 'ns', 5000);
    expect(result).toEqual({ success: false, phase: 'Failed' });
  });

  it('returns { success: false, phase: "Timeout" } when timeoutMs is 0', async () => {
    const result = await client.waitForPodCompletion('pod', 'ns', 0);
    expect(result).toEqual({ success: false, phase: 'Timeout' });
    expect(k8sMocks.mockReadNamespacedPod).not.toHaveBeenCalled();
  });

  it('polls again after a transient error and eventually returns success', async () => {
    vi.useFakeTimers();
    try {
      k8sMocks.mockReadNamespacedPod
        .mockRejectedValueOnce(new Error('transient'))
        .mockResolvedValueOnce({ body: { status: { phase: 'Succeeded' } } });

      const resultPromise = client.waitForPodCompletion('pod', 'ns', 10_000);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toEqual({ success: true, phase: 'Succeeded' });
      expect(k8sMocks.mockReadNamespacedPod).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('polls through Running phase until Succeeded', async () => {
    vi.useFakeTimers();
    try {
      k8sMocks.mockReadNamespacedPod
        .mockResolvedValueOnce({ body: { status: { phase: 'Running' } } })
        .mockResolvedValueOnce({ body: { status: { phase: 'Succeeded' } } });

      const resultPromise = client.waitForPodCompletion('pod', 'ns', 10_000);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toEqual({ success: true, phase: 'Succeeded' });
      expect(k8sMocks.mockReadNamespacedPod).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('uses 1000ms polling interval', async () => {
    vi.useFakeTimers();
    try {
      const startTime = Date.now();
      k8sMocks.mockReadNamespacedPod
        .mockResolvedValueOnce({ body: { status: { phase: 'Running' } } })
        .mockResolvedValueOnce({ body: { status: { phase: 'Succeeded' } } });

      const resultPromise = client.waitForPodCompletion('pod', 'ns', 10_000);

      // Advance only 999ms — should not have polled twice yet
      await vi.advanceTimersByTimeAsync(999);

      // Now advance 1ms more to cross the 1000ms boundary
      await vi.advanceTimersByTimeAsync(1);
      const result = await resultPromise;

      expect(result).toEqual({ success: true, phase: 'Succeeded' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns Timeout when pod keeps Running past timeoutMs', async () => {
    vi.useFakeTimers();
    try {
      // Always returns Running → should time out
      k8sMocks.mockReadNamespacedPod.mockResolvedValue({
        body: { status: { phase: 'Running' } },
      });

      const resultPromise = client.waitForPodCompletion('pod', 'ns', 1500);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toEqual({ success: false, phase: 'Timeout' });
    } finally {
      vi.useRealTimers();
    }
  });
});
