import * as k8s from '@kubernetes/client-node';
import { PassThrough, Readable } from 'stream';
import { config } from '../../config/index.js';
import { logger } from '../../common/logger.js';

export class K8sClient {
  private kc: k8s.KubeConfig;
  private coreApi: k8s.CoreV1Api;
  private exec: k8s.Exec;
  private log: k8s.Log;

  constructor() {
    this.kc = new k8s.KubeConfig();

    if (config.k8s.inCluster) {
      logger.debug('[K8s] Loading in-cluster configuration');
      this.kc.loadFromCluster();
      
      // Override server URL to cluster IP to bypass DNS issues
      const currentCluster = this.kc.getCurrentCluster();
      if (currentCluster) {
        currentCluster.server = 'https://10.96.0.1:443';
        currentCluster.skipTLSVerify = true;
      }
    } else if (config.k8s.configPath) {
      logger.debug({ path: config.k8s.configPath }, '[K8s] Loading configuration from file');
      this.kc.loadFromFile(config.k8s.configPath);
    } else {
      logger.debug('[K8s] Loading default configuration');
      this.kc.loadFromDefault();
    }

    this.coreApi = this.kc.makeApiClient(k8s.CoreV1Api);
    this.exec = new k8s.Exec(this.kc);
    this.log = new k8s.Log(this.kc);
  }

  get core(): k8s.CoreV1Api {
    return this.coreApi;
  }

  get kubeConfig(): k8s.KubeConfig {
    return this.kc;
  }

  async createPod(pod: k8s.V1Pod): Promise<k8s.V1Pod> {
    const namespace = pod.metadata?.namespace || config.k8s.namespace;
    const podName = pod.metadata?.name;
    const image = pod.spec?.containers?.[0]?.image;

    logger.debug(
      { podName, namespace, image, operation: 'CREATE_POD_START' },
      `[K8s] Creating pod ${podName}`
    );

    try {
      let response;
      let retries = 3;
      while (retries > 0) {
        try {
          response = await this.coreApi.createNamespacedPod(namespace, pod);
          break;
        } catch (err) {
          retries--;
          if (retries === 0) throw err;
          logger.warn({ err, retries }, `[K8s] Retry pod creation for ${podName}`);
          await new Promise(r => setTimeout(r, 1000));
        }
      }
      
      logger.info(
        {
          podName: response!.body.metadata?.name,
          namespace,
          uid: response!.body.metadata?.uid,
          operation: 'CREATE_POD_SUCCESS'
        },
        `[K8s] Pod ${response!.body.metadata?.name} created successfully`
      );
      return response!.body;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      logger.error(
        { err, podName, namespace, errorMessage, operation: 'CREATE_POD_FAILED' },
        `[K8s] Failed to create pod ${podName}: ${errorMessage}`
      );
      throw err;
    }
  }

  async deletePod(name: string, namespace: string = config.k8s.namespace): Promise<void> {
    logger.debug(
      { podName: name, namespace, operation: 'DELETE_POD_START' },
      `[K8s] Deleting pod ${name}`
    );

    try {
      await this.coreApi.deleteNamespacedPod(name, namespace);
      logger.info(
        { podName: name, namespace, operation: 'DELETE_POD_SUCCESS' },
        `[K8s] Pod ${name} deleted successfully`
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      logger.error(
        { err, podName, namespace, errorMessage, operation: 'DELETE_POD_FAILED' },
        `[K8s] Failed to delete pod ${name}: ${errorMessage}`
      );
      throw err;
    }
  }

  async getPod(name: string, namespace: string = config.k8s.namespace): Promise<k8s.V1Pod> {
    const response = await this.coreApi.readNamespacedPod(name, namespace);
    return response.body;
  }

  async getPodStatus(name: string, namespace: string = config.k8s.namespace): Promise<string | undefined> {
    const pod = await this.getPod(name, namespace);
    const phase = pod.status?.phase;
    logger.debug(
      { podName: name, namespace, phase, operation: 'GET_POD_STATUS' },
      `[K8s] Pod ${name} status: ${phase}`
    );
    return phase;
  }

  async listPods(
    labelSelector: string,
    namespace: string = config.k8s.namespace
  ): Promise<k8s.V1Pod[]> {
    logger.debug(
      { labelSelector, namespace, operation: 'LIST_PODS_START' },
      `[K8s] Listing pods with selector: ${labelSelector}`
    );

    const response = await this.coreApi.listNamespacedPod(
      namespace,
      undefined,
      undefined,
      undefined,
      undefined,
      labelSelector
    );

    const podCount = response.body.items.length;
    logger.debug(
      { labelSelector, namespace, podCount, operation: 'LIST_PODS_RESULT' },
      `[K8s] Found ${podCount} pods matching selector`
    );

    return response.body.items;
  }

  async getAvailableRunner(language: string): Promise<k8s.V1Pod | null> {
    const labelSelector = `testcraft.io/language=${language},testcraft.io/pool=warm`;

    logger.debug(
      { language, labelSelector, operation: 'FIND_WARM_POD_START' },
      `[K8s] Looking for available ${language} runner`
    );

    const pods = await this.listPods(labelSelector);

    // Find a ready pod
    const readyPod = pods.find((pod) => {
      const containerStatuses = pod.status?.containerStatuses || [];
      return containerStatuses.every((cs) => cs.ready);
    });

    if (readyPod) {
      logger.info(
        {
          language,
          podName: readyPod.metadata?.name,
          podCount: pods.length,
          operation: 'FIND_WARM_POD_SUCCESS'
        },
        `[K8s] Found available ${language} runner: ${readyPod.metadata?.name}`
      );
    } else {
      logger.debug(
        { language, totalPods: pods.length, operation: 'FIND_WARM_POD_NONE' },
        `[K8s] No ready ${language} runner available (${pods.length} total pods found)`
      );
    }

    return readyPod || null;
  }

  async execInPod(
    podName: string,
    namespace: string,
    command: string[],
    stdin?: string
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const startTime = Date.now();

    logger.debug(
      {
        podName,
        namespace,
        command: command.join(' '),
        hasStdin: !!stdin,
        stdinLength: stdin?.length,
        operation: 'EXEC_IN_POD_START'
      },
      `[K8s] Executing command in pod ${podName}: ${command[0]}`
    );

    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';

      const stdoutStream = new PassThrough();
      const stderrStream = new PassThrough();

      stdoutStream.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      stderrStream.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      this.exec.exec(
        namespace,
        podName,
        'runner',
        command,
        stdoutStream,
        stderrStream,
        stdin ? Readable.from(Buffer.from(stdin)) : null,
        false,
        (status: k8s.V1Status) => {
          const exitCode = status.status === 'Success' ? 0 : 1;
          const duration = Date.now() - startTime;

          logger.debug(
            {
              podName,
              namespace,
              exitCode,
              duration,
              stdoutLength: stdout.length,
              stderrLength: stderr.length,
              statusReason: status.reason,
              statusMessage: status.message,
              operation: 'EXEC_IN_POD_COMPLETE'
            },
            `[K8s] Command completed in ${podName} - exit: ${exitCode}, duration: ${duration}ms`
          );

          resolve({ stdout, stderr, exitCode });
        }
      ).catch((err) => {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        logger.error(
          {
            err,
            podName,
            namespace,
            command: command.join(' '),
            errorMessage,
            duration: Date.now() - startTime,
            operation: 'EXEC_IN_POD_FAILED'
          },
          `[K8s] Command execution FAILED in ${podName}: ${errorMessage}`
        );
        reject(err);
      });
    });
  }

  async copyToPod(
    podName: string,
    namespace: string,
    content: string,
    destPath: string
  ): Promise<void> {
    logger.debug(
      {
        podName,
        namespace,
        destPath,
        contentLength: content.length,
        operation: 'COPY_TO_POD_START'
      },
      `[K8s] Copying ${content.length} bytes to ${podName}:${destPath}`
    );

    // Use exec with cat to write content to file
    const command = ['sh', '-c', `cat > ${destPath}`];
    await this.execInPod(podName, namespace, command, content);

    logger.debug(
      { podName, namespace, destPath, operation: 'COPY_TO_POD_COMPLETE' },
      `[K8s] Copy to ${podName}:${destPath} completed`
    );
  }

  async getPodLogs(
    podName: string,
    namespace: string = config.k8s.namespace,
    tailLines: number = 100
  ): Promise<string> {
    logger.debug(
      { podName, namespace, tailLines, operation: 'GET_POD_LOGS_START' },
      `[K8s] Fetching last ${tailLines} log lines from ${podName}`
    );

    const response = await this.coreApi.readNamespacedPodLog(
      podName,
      namespace,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      tailLines
    );

    logger.debug(
      { podName, logLength: response.body.length, operation: 'GET_POD_LOGS_COMPLETE' },
      `[K8s] Retrieved ${response.body.length} bytes of logs from ${podName}`
    );

    return response.body;
  }

  async waitForPodReady(
    podName: string,
    namespace: string = config.k8s.namespace,
    timeoutMs: number = 30000
  ): Promise<boolean> {
    const startTime = Date.now();
    let pollCount = 0;
    let lastPhase = '';

    logger.debug(
      { podName, namespace, timeoutMs, operation: 'WAIT_POD_READY_START' },
      `[K8s] Waiting for pod ${podName} to become ready (timeout: ${timeoutMs}ms)`
    );

    while (Date.now() - startTime < timeoutMs) {
      pollCount++;
      try {
        const pod = await this.getPod(podName, namespace);
        const phase = pod.status?.phase || 'Unknown';

        if (phase !== lastPhase) {
          logger.debug(
            {
              podName,
              phase,
              previousPhase: lastPhase,
              pollCount,
              elapsed: Date.now() - startTime,
              operation: 'WAIT_POD_PHASE_CHANGE'
            },
            `[K8s] Pod ${podName} phase changed: ${lastPhase || 'none'} -> ${phase}`
          );
          lastPhase = phase;
        }

        if (phase === 'Running') {
          const containerStatuses = pod.status?.containerStatuses || [];
          const allReady = containerStatuses.every((cs) => cs.ready);

          if (allReady) {
            const duration = Date.now() - startTime;
            logger.info(
              {
                podName,
                namespace,
                duration,
                pollCount,
                operation: 'WAIT_POD_READY_SUCCESS'
              },
              `[K8s] Pod ${podName} is ready after ${duration}ms (${pollCount} polls)`
            );
            return true;
          } else {
            const notReadyContainers = containerStatuses
              .filter((cs) => !cs.ready)
              .map((cs) => cs.name);
            logger.debug(
              { podName, notReadyContainers, operation: 'WAIT_POD_CONTAINERS_NOT_READY' },
              `[K8s] Pod ${podName} running but containers not ready: ${notReadyContainers.join(', ')}`
            );
          }
        } else if (phase === 'Failed') {
          const reason = pod.status?.conditions?.find(c => c.type === 'Ready')?.reason;
          logger.error(
            { podName, phase, reason, elapsed: Date.now() - startTime, operation: 'WAIT_POD_FAILED' },
            `[K8s] Pod ${podName} entered Failed state: ${reason || 'unknown reason'}`
          );
          return false;
        } else if (phase === 'Unknown') {
          logger.warn(
            { podName, phase, elapsed: Date.now() - startTime, operation: 'WAIT_POD_UNKNOWN' },
            `[K8s] Pod ${podName} in Unknown state`
          );
          return false;
        }
      } catch (err) {
        // Pod might not exist yet
        logger.debug(
          { podName, pollCount, elapsed: Date.now() - startTime, operation: 'WAIT_POD_NOT_FOUND' },
          `[K8s] Pod ${podName} not found yet (poll ${pollCount})`
        );
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    const totalDuration = Date.now() - startTime;
    logger.warn(
      {
        podName,
        namespace,
        totalDuration,
        timeoutMs,
        pollCount,
        lastPhase,
        operation: 'WAIT_POD_TIMEOUT'
      },
      `[K8s] Timeout waiting for pod ${podName} to become ready (last phase: ${lastPhase})`
    );

    return false;
  }

  async waitForPodCompletion(
    podName: string,
    namespace: string = config.k8s.namespace,
    timeoutMs: number = 60000
  ): Promise<{ success: boolean; phase: string }> {
    const startTime = Date.now();
    let pollCount = 0;
    let lastPhase = '';

    logger.debug(
      { podName, namespace, timeoutMs, operation: 'WAIT_POD_COMPLETE_START' },
      `[K8s] Waiting for pod ${podName} to complete (timeout: ${timeoutMs}ms)`
    );

    while (Date.now() - startTime < timeoutMs) {
      pollCount++;
      try {
        const pod = await this.getPod(podName, namespace);
        const phase = pod.status?.phase || 'Unknown';

        if (phase !== lastPhase) {
          logger.debug(
            {
              podName,
              phase,
              previousPhase: lastPhase,
              pollCount,
              elapsed: Date.now() - startTime,
              operation: 'WAIT_COMPLETE_PHASE_CHANGE'
            },
            `[K8s] Pod ${podName} phase: ${lastPhase || 'none'} -> ${phase}`
          );
          lastPhase = phase;
        }

        if (phase === 'Succeeded') {
          const duration = Date.now() - startTime;
          logger.info(
            { podName, duration, pollCount, operation: 'WAIT_POD_COMPLETE_SUCCESS' },
            `[K8s] Pod ${podName} completed successfully after ${duration}ms`
          );
          return { success: true, phase };
        } else if (phase === 'Failed') {
          const exitCode = pod.status?.containerStatuses?.[0]?.state?.terminated?.exitCode;
          const reason = pod.status?.containerStatuses?.[0]?.state?.terminated?.reason;
          logger.error(
            {
              podName,
              exitCode,
              reason,
              elapsed: Date.now() - startTime,
              operation: 'WAIT_POD_COMPLETE_FAILED'
            },
            `[K8s] Pod ${podName} failed with exit code ${exitCode}: ${reason}`
          );
          return { success: false, phase };
        }
      } catch (err) {
        logger.error(
          { err, podName, pollCount, operation: 'WAIT_COMPLETE_ERROR' },
          `[K8s] Error checking pod ${podName} status`
        );
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    logger.warn(
      {
        podName,
        timeoutMs,
        pollCount,
        lastPhase,
        operation: 'WAIT_POD_COMPLETE_TIMEOUT'
      },
      `[K8s] Timeout waiting for pod ${podName} completion (last phase: ${lastPhase})`
    );

    return { success: false, phase: 'Timeout' };
  }
}

// Singleton instance
export const k8sClient = new K8sClient();
