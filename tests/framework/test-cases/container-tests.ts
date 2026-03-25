/**
 * Container Test Cases
 * Tests for Docker and Kubernetes node types
 *
 * NOTE: These tests require Docker and/or Kubernetes to be available.
 * Docker tests will run if Docker daemon is accessible.
 * K8s tests will run if a valid kubeconfig is available.
 */

import type { TestCase } from '../test-runner';

export const dockerTests: TestCase[] = [
  // ============================================================================
  // DOCKER RUN TESTS
  // ============================================================================
  {
    id: 'docker-hello-world',
    name: 'Docker Run - Hello World',
    description: 'Test running a simple hello-world Docker container',
    nodeType: 'docker-run',
    category: 'containers',
    config: {
      type: 'docker-run',
      imageName: 'hello-world',
      imageTag: 'latest',
      removeAfterRun: true,
      timeout: 30000,
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      outputContains: ['Hello from Docker!'],
    },
    timeout: 60000,
    tags: ['container', 'docker', 'basic'],
    // Skip if Docker is not available
    skip: process.env.SKIP_DOCKER_TESTS === 'true',
  },
  {
    id: 'docker-alpine-echo',
    name: 'Docker Run - Alpine Echo',
    description: 'Test running Alpine container with echo command',
    nodeType: 'docker-run',
    category: 'containers',
    config: {
      type: 'docker-run',
      imageName: 'alpine',
      imageTag: 'latest',
      command: 'echo',
      args: ['Hello', 'TestCraft'],
      removeAfterRun: true,
      timeout: 30000,
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      outputContains: ['Hello TestCraft'],
    },
    timeout: 60000,
    tags: ['container', 'docker', 'command'],
    skip: process.env.SKIP_DOCKER_TESTS === 'true',
  },
  {
    id: 'docker-env-vars',
    name: 'Docker Run - Environment Variables',
    description: 'Test passing environment variables to Docker container',
    nodeType: 'docker-run',
    category: 'containers',
    config: {
      type: 'docker-run',
      imageName: 'alpine',
      imageTag: 'latest',
      command: 'sh',
      args: ['-c', 'echo "Name: $MY_NAME, Value: $MY_VALUE"'],
      environment: {
        MY_NAME: 'TestCraft',
        MY_VALUE: '42',
      },
      removeAfterRun: true,
      timeout: 30000,
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      outputContains: ['Name: TestCraft', 'Value: 42'],
    },
    timeout: 60000,
    tags: ['container', 'docker', 'environment'],
    skip: process.env.SKIP_DOCKER_TESTS === 'true',
  },
  {
    id: 'docker-exit-code',
    name: 'Docker Run - Non-Zero Exit Code',
    description: 'Test handling container with non-zero exit code',
    nodeType: 'docker-run',
    category: 'containers',
    config: {
      type: 'docker-run',
      imageName: 'alpine',
      imageTag: 'latest',
      command: 'sh',
      args: ['-c', 'exit 42'],
      removeAfterRun: true,
      timeout: 30000,
    },
    inputs: {},
    expectedOutput: {
      status: 'error',
      customValidator: (result: any) => result.output?.exitCode === 42,
    },
    timeout: 60000,
    tags: ['container', 'docker', 'exit-code'],
    skip: process.env.SKIP_DOCKER_TESTS === 'true',
  },
  {
    id: 'docker-resource-limits',
    name: 'Docker Run - Resource Limits',
    description: 'Test container with CPU and memory limits',
    nodeType: 'docker-run',
    category: 'containers',
    config: {
      type: 'docker-run',
      imageName: 'alpine',
      imageTag: 'latest',
      command: 'sh',
      args: ['-c', 'cat /sys/fs/cgroup/memory/memory.limit_in_bytes 2>/dev/null || cat /sys/fs/cgroup/memory.max 2>/dev/null || echo "128m"'],
      cpuLimit: '0.5',
      memoryLimit: '128m',
      removeAfterRun: true,
      timeout: 30000,
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
    },
    timeout: 60000,
    tags: ['container', 'docker', 'resources'],
    skip: process.env.SKIP_DOCKER_TESTS === 'true',
  },
];

export const k8sTests: TestCase[] = [
  // ============================================================================
  // K8S DEPLOY/POD TESTS
  // ============================================================================
  {
    id: 'k8s-pod-hello',
    name: 'K8s Pod - Hello World',
    description: 'Test creating a simple K8s pod that prints hello',
    nodeType: 'k8s-pod',
    category: 'containers',
    config: {
      type: 'k8s-pod',
      namespace: 'default',
      imageName: 'busybox',
      imageTag: 'latest',
      command: 'echo',
      args: ['Hello from Kubernetes!'],
      waitForReady: true,
      readyTimeout: 60000,
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      outputContains: ['Hello from Kubernetes!'],
    },
    timeout: 120000,
    tags: ['container', 'k8s', 'basic'],
    // Skip if K8s is not available
    skip: process.env.SKIP_K8S_TESTS === 'true',
  },
  {
    id: 'k8s-pod-env-vars',
    name: 'K8s Pod - Environment Variables',
    description: 'Test K8s pod with environment variables',
    nodeType: 'k8s-pod',
    category: 'containers',
    config: {
      type: 'k8s-pod',
      namespace: 'default',
      imageName: 'busybox',
      imageTag: 'latest',
      command: 'sh',
      args: ['-c', 'echo "TEST_VAR=$TEST_VAR"'],
      environment: {
        TEST_VAR: 'kubernetes-test-value',
      },
      waitForReady: true,
      readyTimeout: 60000,
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      outputContains: ['TEST_VAR=kubernetes-test-value'],
    },
    timeout: 120000,
    tags: ['container', 'k8s', 'environment'],
    skip: process.env.SKIP_K8S_TESTS === 'true',
  },
  {
    id: 'k8s-pod-resource-limits',
    name: 'K8s Pod - Resource Limits',
    description: 'Test K8s pod with CPU and memory limits',
    nodeType: 'k8s-pod',
    category: 'containers',
    config: {
      type: 'k8s-pod',
      namespace: 'default',
      imageName: 'busybox',
      imageTag: 'latest',
      command: 'echo',
      args: ['Resource limited pod'],
      cpuRequest: '50m',
      cpuLimit: '100m',
      memoryRequest: '32Mi',
      memoryLimit: '64Mi',
      waitForReady: true,
      readyTimeout: 60000,
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
    },
    timeout: 120000,
    tags: ['container', 'k8s', 'resources'],
    skip: process.env.SKIP_K8S_TESTS === 'true',
  },
  {
    id: 'k8s-pod-exit-code',
    name: 'K8s Pod - Non-Zero Exit Code',
    description: 'Test K8s pod handling of non-zero exit code',
    nodeType: 'k8s-pod',
    category: 'containers',
    config: {
      type: 'k8s-pod',
      namespace: 'default',
      imageName: 'busybox',
      imageTag: 'latest',
      command: 'sh',
      args: ['-c', 'exit 1'],
      waitForReady: true,
      readyTimeout: 60000,
    },
    inputs: {},
    expectedOutput: {
      status: 'error',
      customValidator: (result: any) => result.output?.exitCode === 1,
    },
    timeout: 120000,
    tags: ['container', 'k8s', 'exit-code'],
    skip: process.env.SKIP_K8S_TESTS === 'true',
  },
  {
    id: 'k8s-pod-labels',
    name: 'K8s Pod - Custom Labels',
    description: 'Test K8s pod with custom labels',
    nodeType: 'k8s-pod',
    category: 'containers',
    config: {
      type: 'k8s-pod',
      namespace: 'default',
      imageName: 'busybox',
      imageTag: 'latest',
      command: 'echo',
      args: ['Pod with labels'],
      labels: {
        'app': 'testcraft-test',
        'environment': 'testing',
      },
      waitForReady: true,
      readyTimeout: 60000,
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
    },
    timeout: 120000,
    tags: ['container', 'k8s', 'labels'],
    skip: process.env.SKIP_K8S_TESTS === 'true',
  },
];

// k8s-deploy alias test (uses same handler as k8s-pod)
export const k8sDeployTest: TestCase[] = [
  {
    id: 'k8s-deploy-basic',
    name: 'K8s Deploy - Basic (Alias)',
    description: 'Test k8s-deploy alias uses k8s-pod handler',
    nodeType: 'k8s-deploy',
    category: 'containers',
    config: {
      type: 'k8s-deploy',
      namespace: 'default',
      imageName: 'busybox',
      imageTag: 'latest',
      command: ['echo', 'deploy test'],
      waitForReady: true,
      readyTimeout: 60000,
    },
    inputs: {},
    expectedOutput: {
      status: 'success',
      outputContains: ['deploy test'],
    },
    timeout: 120000,
    tags: ['container', 'k8s', 'deploy', 'alias'],
    skip: process.env.SKIP_K8S_TESTS === 'true',
  },
];

// Filter out skipped tests
export const containerTests: TestCase[] = [
  ...dockerTests.filter(t => !t.skip),
  ...k8sTests.filter(t => !t.skip),
  ...k8sDeployTest.filter(t => !t.skip),
];

export default containerTests;
