import * as k8s from '@kubernetes/client-node';
import { v4 as uuidv4 } from 'uuid';
import { k8sClient } from './k8s-client.js';
import { config } from '../../config/index.js';
import { logger } from '../../common/logger.js';
import type { ExecutionRequest, ExecutionResult, SupportedLanguage } from './types.js';

export class ContainerOrchestrator {
  private readonly namespace = config.k8s.namespace;

  /**
   * Get the runner image for a specific language
   */
  getRunnerImage(language: SupportedLanguage): string {
    const runners = config.runners as Record<string, string>;
    const image = runners[language];
    if (!image) {
      throw new Error(`No runner image configured for language: ${language}`);
    }
    return image;
  }

  /**
   * Create a pod spec for executing code
   */
  createPodSpec(
    executionId: string,
    language: SupportedLanguage,
    timeout: number
  ): k8s.V1Pod {
    const image = this.getRunnerImage(language);

    return {
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: {
        name: `runner-${executionId}`,
        namespace: this.namespace,
        labels: {
          'app.kubernetes.io/name': 'testcraft',
          'app.kubernetes.io/component': 'runner',
          'testcraft.io/language': language,
          'testcraft.io/execution-id': executionId,
        },
        annotations: {
          'testcraft.io/created-at': new Date().toISOString(),
        },
      },
      spec: {
        restartPolicy: 'Never',
        // Give K8s 60s of grace over the inner timeout for scheduling/image-pull overhead.
        // The runner.sh script enforces the actual timeout via `timeout ${TIMEOUT} ...`.
        activeDeadlineSeconds: timeout + 60,
        serviceAccountName: 'testcraft-runner',
        securityContext: {
          runAsNonRoot: true,
          runAsUser: 1000,
          runAsGroup: 1000,
          fsGroup: 1000,
        },
        containers: [
          {
            name: 'runner',
            image,
            imagePullPolicy: 'IfNotPresent',
            resources: {
              requests: {
                cpu: '100m',
                memory: '256Mi',
              },
              limits: {
                cpu: '1',
                memory: '1Gi',
              },
            },
            env: [
              { name: 'EXECUTION_ID', value: executionId },
              { name: 'TIMEOUT', value: timeout.toString() },
              { name: 'CODE_DIR', value: '/app/code' },
              { name: 'OUTPUT_DIR', value: '/app/output' },
              // GlobalVarsService: runners use these to fetch/push global variables
              { name: 'TESTCRAFT_API_URL', value: config.runners.apiUrl },
              { name: 'TESTCRAFT_EXECUTION_ID', value: executionId },
            ],
            volumeMounts: [
              { name: 'code-volume', mountPath: '/app/code' },
              { name: 'output-volume', mountPath: '/app/output' },
            ],
            securityContext: {
              allowPrivilegeEscalation: false,
              readOnlyRootFilesystem: false,
              capabilities: {
                drop: ['ALL'],
              },
            },
          },
        ],
        volumes: [
          { name: 'code-volume', emptyDir: {} },
          { name: 'output-volume', emptyDir: {} },
        ],
      },
    };
  }

  /**
   * Execute code using a warm pool pod (faster)
   */
  async executeWithWarmPool(request: ExecutionRequest): Promise<ExecutionResult> {
    const executionId = request.executionId || uuidv4();
    const startTime = Date.now();

    logger.info(
      {
        executionId,
        language: request.language,
        codeLength: request.code.length,
        step: '1/5',
        phase: 'WARM_POOL_LOOKUP'
      },
      '[Step 1/5] Starting warm pool execution - looking for available pod'
    );

    // Try to get a warm pod
    const lookupStart = Date.now();
    const warmPod = await k8sClient.getAvailableRunner(request.language);
    const lookupDuration = Date.now() - lookupStart;

    if (!warmPod || !warmPod.metadata?.name) {
      logger.info(
        {
          executionId,
          lookupDuration,
          step: '1/5',
          phase: 'WARM_POOL_MISS'
        },
        '[Step 1/5] No warm pod available - falling back to cold start'
      );
      return this.executeWithNewPod(request);
    }

    const podName = warmPod.metadata.name;
    logger.info(
      {
        executionId,
        podName,
        lookupDuration,
        step: '2/6',
        phase: 'WARM_POOL_HIT'
      },
      '[Step 2/6] Found warm pod - checking dependencies'
    );

    try {
      // Clean previous execution's artifacts to prevent state leakage between warm-pool reuses
      await k8sClient.execInPod(podName, this.namespace, [
        'sh', '-c', 'rm -rf /app/code/* /app/output/* 2>/dev/null; mkdir -p /app/code /app/output',
      ]);

      // Install dependencies if provided
      if (request.dependencies) {
        const depStart = Date.now();
        logger.info(
          {
            executionId,
            podName,
            step: '3/6',
            phase: 'DEPENDENCIES_INSTALL_START'
          },
          '[Step 3/6] Installing dependencies'
        );

        const depResult = await this.installDependencies(
          podName,
          request.language,
          request.dependencies
        );

        const depDuration = Date.now() - depStart;
        logger.info(
          {
            executionId,
            podName,
            depDuration,
            success: depResult.success,
            step: '3/6',
            phase: 'DEPENDENCIES_INSTALL_COMPLETE'
          },
          `[Step 3/6] Dependencies installed (${depResult.success ? 'success' : 'with warnings'})`
        );
      }

      // Copy code to the pod
      const codeFileName = this.getCodeFileName(request.language);
      const copyStart = Date.now();

      logger.debug(
        {
          executionId,
          podName,
          codeFileName,
          codeLength: request.code.length,
          step: '4/6',
          phase: 'CODE_COPY_START'
        },
        '[Step 4/6] Copying code to pod'
      );

      await k8sClient.copyToPod(
        podName,
        this.namespace,
        request.code,
        `/app/code/${codeFileName}`
      );

      const copyDuration = Date.now() - copyStart;
      logger.debug(
        {
          executionId,
          podName,
          copyDuration,
          step: '4/6',
          phase: 'CODE_COPY_COMPLETE'
        },
        '[Step 4/6] Code copy completed'
      );

      // Execute the runner script
      const execStart = Date.now();
      logger.info(
        {
          executionId,
          podName,
          step: '5/6',
          phase: 'EXECUTION_START'
        },
        '[Step 5/6] Executing runner script'
      );

      const result = await k8sClient.execInPod(
        podName,
        this.namespace,
        ['/app/runner.sh']
      );

      const execDuration = Date.now() - execStart;
      const totalDuration = Date.now() - startTime;

      logger.info(
        {
          executionId,
          podName,
          execDuration,
          exitCode: result.exitCode,
          stdoutLength: result.stdout.length,
          stderrLength: result.stderr.length,
          step: '6/6',
          phase: 'EXECUTION_COMPLETE'
        },
        `[Step 6/6] Execution completed - exit code: ${result.exitCode}`
      );

      // Parse the output
      try {
        const output = JSON.parse(result.stdout);

        logger.info(
          {
            executionId,
            podName,
            totalDuration,
            status: output.exit_code === 0 ? 'success' : 'error',
            phase: 'RESULT_PARSED'
          },
          `Warm pool execution finished - status: ${output.exit_code === 0 ? 'success' : 'error'}, duration: ${totalDuration}ms`
        );

        return {
          executionId,
          status: output.exit_code === 0 ? 'success' : 'error',
          language: request.language,
          output: output.output,
          exitCode: output.exit_code,
          duration: totalDuration,
          podName,
        };
      } catch {
        logger.debug(
          { executionId, podName, phase: 'RESULT_PARSE_FALLBACK' },
          'Could not parse JSON output, using raw stdout/stderr'
        );

        return {
          executionId,
          status: result.exitCode === 0 ? 'success' : 'error',
          language: request.language,
          output: result.stdout,
          error: result.stderr || undefined,
          exitCode: result.exitCode,
          duration: totalDuration,
          podName,
        };
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      const errorStack = err instanceof Error ? err.stack : undefined;

      logger.error(
        {
          err,
          executionId,
          podName,
          errorMessage,
          errorStack,
          duration: Date.now() - startTime,
          phase: 'EXECUTION_FAILED'
        },
        `Warm pool execution FAILED: ${errorMessage}`
      );

      return {
        executionId,
        status: 'error',
        language: request.language,
        error: errorMessage,
        exitCode: 1,
        duration: Date.now() - startTime,
        podName,
      };
    }
  }

  /**
   * Execute code by creating a new pod (cold start)
   */
  async executeWithNewPod(request: ExecutionRequest): Promise<ExecutionResult> {
    const executionId = request.executionId || uuidv4();
    const timeout = request.timeout || config.execution.defaultTimeout;
    const startTime = Date.now();

    logger.info(
      {
        executionId,
        language: request.language,
        timeout,
        codeLength: request.code.length,
        step: '1/7',
        phase: 'COLD_START_BEGIN'
      },
      '[Step 1/7] Starting cold start execution - creating new pod'
    );

    // Create the pod spec
    const podSpec = this.createPodSpec(executionId, request.language, timeout);
    const podName = podSpec.metadata!.name!;
    const image = this.getRunnerImage(request.language);

    logger.debug(
      {
        executionId,
        podName,
        image,
        namespace: this.namespace,
        step: '2/7',
        phase: 'POD_SPEC_CREATED'
      },
      '[Step 2/7] Pod spec created'
    );

    try {
      // Create the pod
      const createStart = Date.now();
      logger.info(
        {
          executionId,
          podName,
          image,
          step: '3/7',
          phase: 'POD_CREATION_START'
        },
        '[Step 3/7] Creating pod in Kubernetes'
      );

      await k8sClient.createPod(podSpec);

      const createDuration = Date.now() - createStart;
      logger.info(
        {
          executionId,
          podName,
          createDuration,
          step: '3/7',
          phase: 'POD_CREATED'
        },
        `[Step 3/7] Pod created successfully in ${createDuration}ms`
      );

      // Wait for pod to be ready
      const waitStart = Date.now();
      logger.info(
        {
          executionId,
          podName,
          timeoutMs: 30000,
          step: '4/7',
          phase: 'POD_WAIT_START'
        },
        '[Step 4/7] Waiting for pod to become ready'
      );

      const isReady = await k8sClient.waitForPodReady(podName, this.namespace, 30000);
      const waitDuration = Date.now() - waitStart;

      if (!isReady) {
        logger.error(
          {
            executionId,
            podName,
            waitDuration,
            step: '4/7',
            phase: 'POD_NOT_READY'
          },
          '[Step 4/7] Pod FAILED to become ready within timeout'
        );
        throw new Error(`Pod failed to become ready after ${waitDuration}ms`);
      }

      logger.info(
        {
          executionId,
          podName,
          waitDuration,
          step: '4/8',
          phase: 'POD_READY'
        },
        `[Step 4/8] Pod is ready after ${waitDuration}ms`
      );

      // Install dependencies if provided
      if (request.dependencies) {
        const depStart = Date.now();
        logger.info(
          {
            executionId,
            podName,
            step: '5/8',
            phase: 'DEPENDENCIES_INSTALL_START'
          },
          '[Step 5/8] Installing dependencies'
        );

        const depResult = await this.installDependencies(
          podName,
          request.language,
          request.dependencies
        );

        const depDuration = Date.now() - depStart;
        logger.info(
          {
            executionId,
            podName,
            depDuration,
            success: depResult.success,
            step: '5/8',
            phase: 'DEPENDENCIES_INSTALL_COMPLETE'
          },
          `[Step 5/8] Dependencies installed (${depResult.success ? 'success' : 'with warnings'})`
        );
      }

      // Copy code to the pod
      const codeFileName = this.getCodeFileName(request.language);
      const copyStart = Date.now();

      logger.debug(
        {
          executionId,
          podName,
          codeFileName,
          codeLength: request.code.length,
          step: '6/8',
          phase: 'CODE_COPY_START'
        },
        `[Step 6/8] Copying code to pod (${request.code.length} bytes)`
      );

      await k8sClient.copyToPod(
        podName,
        this.namespace,
        request.code,
        `/app/code/${codeFileName}`
      );

      const copyDuration = Date.now() - copyStart;
      logger.debug(
        {
          executionId,
          podName,
          copyDuration,
          step: '6/8',
          phase: 'CODE_COPY_COMPLETE'
        },
        `[Step 6/8] Code copy completed in ${copyDuration}ms`
      );

      // Execute the runner script
      const execStart = Date.now();
      logger.info(
        {
          executionId,
          podName,
          command: '/app/runner.sh',
          step: '7/8',
          phase: 'EXECUTION_START'
        },
        '[Step 7/8] Executing runner script'
      );

      const result = await k8sClient.execInPod(
        podName,
        this.namespace,
        ['/app/runner.sh']
      );

      const execDuration = Date.now() - execStart;
      const totalDuration = Date.now() - startTime;

      logger.info(
        {
          executionId,
          podName,
          execDuration,
          exitCode: result.exitCode,
          stdoutLength: result.stdout.length,
          stderrLength: result.stderr.length,
          step: '7/8',
          phase: 'EXECUTION_COMPLETE'
        },
        `[Step 7/8] Execution completed - exit code: ${result.exitCode}, duration: ${execDuration}ms`
      );

      // Log stdout/stderr for debugging
      if (result.stderr && result.stderr.length > 0) {
        logger.debug(
          {
            executionId,
            podName,
            stderr: result.stderr.substring(0, 1000),
            phase: 'STDERR_OUTPUT'
          },
          'Execution stderr output (truncated to 1000 chars)'
        );
      }

      // Parse the output
      try {
        const output = JSON.parse(result.stdout);

        logger.info(
          {
            executionId,
            podName,
            totalDuration,
            status: output.exit_code === 0 ? 'success' : 'error',
            step: '8/8',
            phase: 'RESULT_PARSED'
          },
          `[Step 8/8] Cold start execution finished - status: ${output.exit_code === 0 ? 'success' : 'error'}, total duration: ${totalDuration}ms`
        );

        return {
          executionId,
          status: output.exit_code === 0 ? 'success' : 'error',
          language: request.language,
          output: output.output,
          exitCode: output.exit_code,
          duration: totalDuration,
          podName,
        };
      } catch {
        logger.debug(
          {
            executionId,
            podName,
            stdoutPreview: result.stdout.substring(0, 200),
            phase: 'RESULT_PARSE_FALLBACK'
          },
          'Could not parse JSON output, using raw stdout/stderr'
        );

        return {
          executionId,
          status: result.exitCode === 0 ? 'success' : 'error',
          language: request.language,
          output: result.stdout,
          error: result.stderr || undefined,
          exitCode: result.exitCode,
          duration: totalDuration,
          podName,
        };
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      const errorStack = err instanceof Error ? err.stack : undefined;

      logger.error(
        {
          err,
          executionId,
          podName,
          errorMessage,
          errorStack,
          duration: Date.now() - startTime,
          phase: 'EXECUTION_FAILED'
        },
        `Cold start execution FAILED: ${errorMessage}`
      );

      return {
        executionId,
        status: 'error',
        language: request.language,
        error: errorMessage,
        exitCode: 1,
        duration: Date.now() - startTime,
        podName,
      };
    } finally {
      // Cleanup: delete the pod
      const cleanupStart = Date.now();
      logger.debug(
        {
          executionId,
          podName,
          phase: 'CLEANUP_START'
        },
        'Starting pod cleanup'
      );

      try {
        await k8sClient.deletePod(podName, this.namespace);
        logger.debug(
          {
            executionId,
            podName,
            cleanupDuration: Date.now() - cleanupStart,
            phase: 'CLEANUP_COMPLETE'
          },
          'Pod cleanup completed'
        );
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        logger.warn(
          {
            err,
            podName,
            errorMessage,
            phase: 'CLEANUP_FAILED'
          },
          `Failed to cleanup pod: ${errorMessage}`
        );
      }
    }
  }

  /**
   * Generate dependency installation command for a language.
   */
  getDependencyInstallCommand(language: SupportedLanguage, dependencies: import('./types.js').LanguageDependencies): string | null {
    switch (language) {
      case 'python': {
        const deps = dependencies.python;
        if (!deps?.packages?.length) return null;
        return `pip install --user ${deps.packages.join(' ')}`;
      }
      case 'javascript':
      case 'typescript': {
        const deps = dependencies.javascript;
        if (!deps?.packages?.length) return null;
        return `npm install --prefix /tmp/node_modules ${deps.packages.join(' ')}`;
      }
      case 'java':
      case 'kotlin': {
        const deps = dependencies.java || dependencies.kotlin;
        if (!deps) return null;
        const commands: string[] = [];
        // Maven dependencies - download JARs using maven dependency:copy
        if (deps.maven?.length) {
          for (const mvn of deps.maven) {
            const [groupId, artifactId, version] = mvn.split(':');
            if (groupId && artifactId && version) {
              commands.push(`mvn dependency:copy -Dartifact=${groupId}:${artifactId}:${version} -DoutputDirectory=/app/libs 2>/dev/null || true`);
            }
          }
        }
        // Direct JAR downloads
        if (deps.jars?.length) {
          for (const jarUrl of deps.jars) {
            commands.push(`curl -sSL -o /app/libs/$(basename "${jarUrl}") "${jarUrl}" || true`);
          }
        }
        return commands.length > 0 ? `mkdir -p /app/libs && ${commands.join(' && ')}` : null;
      }
      case 'csharp': {
        const deps = dependencies.csharp;
        if (!deps?.packages?.length) return null;
        const packages = deps.packages.map(p => {
          const [name, version] = p.split('@');
          return version ? `${name} -v ${version}` : name;
        });
        return `dotnet add package ${packages.join(' && dotnet add package ')}`;
      }
      case 'go': {
        const deps = dependencies.go;
        if (!deps?.modules?.length) return null;
        return `go get ${deps.modules.join(' ')}`;
      }
      case 'ruby': {
        const deps = dependencies.ruby;
        if (!deps?.gems?.length) return null;
        const gems = deps.gems.map(g => {
          const [name, version] = g.split(':');
          return version ? `${name} -v '${version}'` : name;
        });
        return `gem install ${gems.join(' && gem install ')}`;
      }
      case 'rust': {
        const deps = dependencies.rust;
        if (!deps?.crates?.length) return null;
        // Rust crates are typically in Cargo.toml, but for dynamic install:
        const crates = deps.crates.map(c => {
          const [name, version] = c.split('@');
          return version ? `${name}@${version}` : name;
        });
        return `cargo install ${crates.join(' ')}`;
      }
      case 'php': {
        const deps = dependencies.php;
        if (!deps?.packages?.length) return null;
        return `composer require ${deps.packages.join(' ')}`;
      }
      default:
        return null;
    }
  }

  /**
   * Install dependencies in a pod before code execution.
   */
  async installDependencies(
    podName: string,
    language: SupportedLanguage,
    dependencies: import('./types.js').LanguageDependencies
  ): Promise<{ success: boolean; output: string }> {
    const installCommand = this.getDependencyInstallCommand(language, dependencies);

    if (!installCommand) {
      return { success: true, output: 'No dependencies to install' };
    }

    logger.info(
      { podName, language, command: installCommand },
      'Installing dependencies in pod'
    );

    try {
      const result = await k8sClient.execInPod(
        podName,
        this.namespace,
        ['sh', '-c', installCommand]
      );

      if (result.exitCode !== 0) {
        logger.warn(
          { podName, language, exitCode: result.exitCode, stderr: result.stderr },
          'Dependency installation had errors (continuing anyway)'
        );
      }

      return {
        success: result.exitCode === 0,
        output: result.stdout + (result.stderr ? `\nSTDERR: ${result.stderr}` : '')
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      logger.error(
        { err, podName, language },
        `Dependency installation failed: ${errorMessage}`
      );
      return { success: false, output: errorMessage };
    }
  }

  /**
   * Get the appropriate filename for the code based on language
   */
  private getCodeFileName(language: SupportedLanguage): string {
    const fileNames: Record<SupportedLanguage, string> = {
      java: 'Main.java',
      python: 'main.py',
      csharp: 'Program.cs',
      javascript: 'main.js',
      typescript: 'main.ts',
      go: 'main.go',
      rust: 'main.rs',
      ruby: 'main.rb',
      php: 'main.php',
      kotlin: 'Main.kt',
    };
    return fileNames[language];
  }

  /**
   * Get status of all runner pools
   */
  async getPoolStatus(): Promise<Record<string, { ready: number; total: number }>> {
    const languages: SupportedLanguage[] = [
      'java', 'python', 'csharp', 'javascript', 'typescript',
      'go', 'rust', 'ruby', 'php', 'kotlin'
    ];

    const status: Record<string, { ready: number; total: number }> = {};

    for (const lang of languages) {
      const labelSelector = `testcraft.io/language=${lang},testcraft.io/pool=warm`;
      const pods = await k8sClient.listPods(labelSelector, this.namespace);

      const readyCount = pods.filter((pod) => {
        const containerStatuses = pod.status?.containerStatuses || [];
        return containerStatuses.every((cs) => cs.ready);
      }).length;

      status[lang] = {
        ready: readyCount,
        total: pods.length,
      };
    }

    return status;
  }
}

export const orchestrator = new ContainerOrchestrator();
