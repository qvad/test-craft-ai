
import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';
import { EventEmitter } from 'events';

// ---------------------------------------------------------------------------
// Mock modules using vi.hoisted for variables used in factories
// ---------------------------------------------------------------------------
const { mockSpawn } = vi.hoisted(() => {
  return {
    mockSpawn: vi.fn(),
  };
});

vi.mock('child_process', () => ({ spawn: mockSpawn }));
vi.mock('node:child_process', () => ({ spawn: mockSpawn }));

vi.mock('../modules/containers/k8s-client.js', () => ({
  k8sClient: {
    createPod: vi.fn(),
    deletePod: vi.fn(),
    waitForPodReady: vi.fn(),
    waitForPodCompletion: vi.fn(),
    getPodLogs: vi.fn(),
    getPod: vi.fn(),
    getAvailableRunner: vi.fn(),
    listPods: vi.fn(),
  },
}));

import Fastify from 'fastify';
import { testingRoutes } from '../modules/testing/routes.js';
import { k8sClient } from '../modules/containers/k8s-client.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFakeProc() {
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  const proc = new EventEmitter() as any;
  proc.stdout = stdout;
  proc.stderr = stderr;
  proc.kill = vi.fn();
  proc.unref = vi.fn();
  return proc;
}

function closeProc(proc: any, code: number, stdoutText = '', stderrText = '') {
  setImmediate(() => {
    if (stdoutText) proc.stdout.emit('data', Buffer.from(stdoutText));
    if (stderrText) proc.stderr.emit('data', Buffer.from(stderrText));
    proc.emit('close', code);
  });
}

function errorProc(proc: any, message: string) {
  setImmediate(() => {
    proc.emit('error', new Error(message));
  });
}

function makeAutoCloseProc(code: number, stdoutText = '', stderrText = '') {
  const proc = makeFakeProc();
  closeProc(proc, code, stdoutText, stderrText);
  return proc;
}

const k8s = k8sClient as any;

async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(testingRoutes, { prefix: '/api/v1' });
  await app.ready();
  return app;
}

function postNode(app: any, body: object) {
  return app.inject({
    method: 'POST',
    url: '/api/v1/test/node',
    payload: body,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('docker-run node', () => {
  let app: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
    mockSpawn.mockImplementation(() => makeAutoCloseProc(0));
  });

  it('returns success when docker exits with code 0', async () => {
    mockSpawn.mockImplementation((cmd, args) => {
      const proc = makeFakeProc();
      if (cmd === 'docker' && args.includes('run')) {
        closeProc(proc, 0, 'hello from container\n');
      } else {
        closeProc(proc, 0);
      }
      return proc;
    });

    const res = await postNode(app, {
      nodeType: 'docker-run',
      config: { imageName: 'alpine', imageTag: 'latest' },
      inputs: {},
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('success');
    expect(body.output.exitCode).toBe(0);
    expect(body.output.stdout).toContain('hello from container');
  });

  it('returns error when docker exits with non-zero code', async () => {
    mockSpawn.mockImplementation((cmd, args) => {
      const proc = makeFakeProc();
      if (cmd === 'docker' && args.includes('run')) {
        closeProc(proc, 1, '', 'No such image\n');
      } else {
        closeProc(proc, 0);
      }
      return proc;
    });

    const res = await postNode(app, {
      nodeType: 'docker-run',
      config: { imageName: 'nonexistent-image', imageTag: '1.0' },
      inputs: {},
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('error');
    expect(body.output.exitCode).toBe(1);
    expect(body.error).toMatch(/Docker exit code: 1/);
  });

  it('returns error when spawn emits an error event', async () => {
    mockSpawn.mockImplementation((cmd, args) => {
      const proc = makeFakeProc();
      if (cmd === 'docker' && args.includes('run')) {
        errorProc(proc, 'spawn docker ENOENT');
      } else {
        closeProc(proc, 0);
      }
      return proc;
    });

    const res = await postNode(app, {
      nodeType: 'docker-run',
      config: { imageName: 'alpine' },
      inputs: {},
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('error');
    expect(body.error).toContain('spawn docker ENOENT');
  });

  it('passes environment variables as -e flags', async () => {
    let capturedArgs: string[] = [];
    mockSpawn.mockImplementation((cmd, args) => {
      if (cmd === 'docker' && args.includes('run')) {
        capturedArgs = args;
      }
      return makeAutoCloseProc(0);
    });

    await postNode(app, {
      nodeType: 'docker-run',
      config: {
        imageName: 'alpine',
        environment: { MY_VAR: 'value1', OTHER: 'value2' },
      },
      inputs: {},
    });

    expect(capturedArgs).toContain('-e');
    expect(capturedArgs).toContain('MY_VAR=value1');
    expect(capturedArgs).toContain('OTHER=value2');
  });

  it('sets --rm flag when removeAfterRun is true and not detached', async () => {
    let capturedArgs: string[] = [];
    mockSpawn.mockImplementation((cmd, args) => {
      if (cmd === 'docker' && args.includes('run')) {
        capturedArgs = args;
      }
      return makeAutoCloseProc(0);
    });

    await postNode(app, {
      nodeType: 'docker-run',
      config: { imageName: 'alpine', removeAfterRun: true },
      inputs: {},
    });

    expect(capturedArgs).toContain('--rm');
  });

  it('uses detached mode (-d) for database images', async () => {
    let capturedArgs: string[] = [];
    mockSpawn.mockImplementation((cmd, args) => {
      if (cmd === 'docker' && args.includes('run')) {
        capturedArgs = args;
      }
      return makeAutoCloseProc(0, 'abc123containerId\n');
    });

    const res = await postNode(app, {
      nodeType: 'docker-run',
      config: { imageName: 'postgres', imageTag: '15' },
      inputs: {},
    });

    expect(capturedArgs).toContain('-d');
    const body = JSON.parse(res.body);
    expect(body.output.detached).toBe(true);
  });
});

describe('k8s-pod node', () => {
  let app: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  function setupK8sSuccess(podName = 'test-pod', podLogs = 'done', exitCode = 0) {
    k8s.createPod.mockResolvedValue({
      metadata: { name: podName },
    } as any);
    k8s.waitForPodReady.mockResolvedValue(true);
    k8s.waitForPodCompletion.mockResolvedValue({ success: true, phase: 'Succeeded' } as any);
    k8s.getPodLogs.mockResolvedValue(podLogs);
    k8s.getPod.mockResolvedValue({
      status: {
        containerStatuses: [{ state: { terminated: { exitCode } } }],
      },
    } as any);
    k8s.deletePod.mockResolvedValue(undefined);
  }

  it('returns success when pod completes successfully', async () => {
    setupK8sSuccess('my-pod', 'container output', 0);

    const res = await postNode(app, {
      nodeType: 'k8s-pod',
      config: {
        imageName: 'alpine',
        imageTag: 'latest',
        command: 'echo',
      },
      inputs: {},
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('success');
    expect(body.output.phase).toBe('Succeeded');
    expect(body.output.logs).toBe('container output');
    expect(body.output.exitCode).toBe(0);
  });
});

describe('shell-command node', () => {
  let app: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
    mockSpawn.mockImplementation(() => makeAutoCloseProc(0));
  });

  it('returns success when command exits with code 0', async () => {
    mockSpawn.mockImplementation(() => makeAutoCloseProc(0, 'hello world\n'));

    const res = await postNode(app, {
      nodeType: 'shell-command',
      config: { command: 'echo', arguments: ['hello', 'world'] },
      inputs: {},
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('success');
    expect(body.output.stdout).toContain('hello world');
    expect(body.output.exitCode).toBe(0);
  });

  it('returns error when command exits with non-zero code', async () => {
    mockSpawn.mockImplementation(() => makeAutoCloseProc(127, '', 'command not found\n'));

    const res = await postNode(app, {
      nodeType: 'shell-command',
      config: { command: 'nonexistent-cmd', arguments: [] },
      inputs: {},
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('error');
    expect(body.output.exitCode).toBe(127);
    expect(body.error).toMatch(/Exit code: 127/);
  });
});
