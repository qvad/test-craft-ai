/**
 * Tests for code execution with dependencies.
 *
 * These tests verify that the orchestrator correctly installs dependencies
 * before executing code for all supported languages.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { orchestrator } from '../modules/containers/orchestrator.js';
import type { LanguageDependencies, SupportedLanguage } from '../modules/containers/types.js';

// Track all execInPod calls to verify dependency installation
const execInPodCalls: { podName: string; command: string[] }[] = [];

// Mock the k8s client
vi.mock('../modules/containers/k8s-client.js', () => ({
  k8sClient: {
    createPod: vi.fn().mockResolvedValue({ metadata: { name: 'test-pod' } }),
    deletePod: vi.fn().mockResolvedValue(undefined),
    getPod: vi.fn().mockResolvedValue({ status: { phase: 'Running' } }),
    getPodStatus: vi.fn().mockResolvedValue('Running'),
    listPods: vi.fn().mockResolvedValue([]),
    getAvailableRunner: vi.fn().mockResolvedValue({
      metadata: { name: 'warm-pool-pod-123' }
    }),
    execInPod: vi.fn().mockImplementation((podName: string, _namespace: string, command: string[]) => {
      execInPodCalls.push({ podName, command });
      // Return success for dependency install commands (sh -c ...)
      if (command[0] === 'sh' && command[1] === '-c') {
        return Promise.resolve({
          stdout: 'Successfully installed dependencies',
          stderr: '',
          exitCode: 0,
        });
      }
      // Return mock execution result for runner script
      return Promise.resolve({
        stdout: JSON.stringify({ status: '0', output: 'Hello World', exit_code: 0 }),
        stderr: '',
        exitCode: 0,
      });
    }),
    copyToPod: vi.fn().mockResolvedValue(undefined),
    waitForPodReady: vi.fn().mockResolvedValue(true),
  },
}));

describe('Execution with Dependencies', () => {
  beforeEach(() => {
    execInPodCalls.length = 0; // Clear tracking array
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Python with dependencies', () => {
    it('should install Python packages before executing code', async () => {
      const dependencies: LanguageDependencies = {
        python: {
          packages: ['requests==2.31.0', 'pandas>=2.0']
        }
      };

      const result = await orchestrator.executeWithWarmPool({
        executionId: 'test-python-deps',
        language: 'python',
        code: 'import requests\nprint(requests.__version__)',
        timeout: 60,
        dependencies,
      });

      expect(result.status).toBe('success');

      // Verify pip install was called
      const pipCall = execInPodCalls.find(
        call => call.command[0] === 'sh' && call.command[2]?.includes('pip install')
      );
      expect(pipCall).toBeDefined();
      expect(pipCall!.command[2]).toContain('requests==2.31.0');
      expect(pipCall!.command[2]).toContain('pandas>=2.0');
    });

    it('should execute Python code that uses installed packages', async () => {
      const dependencies: LanguageDependencies = {
        python: { packages: ['httpx', 'pydantic'] }
      };

      const code = `
import httpx
from pydantic import BaseModel

class User(BaseModel):
    name: str

print("Dependencies loaded successfully!")
`;

      const result = await orchestrator.executeWithWarmPool({
        executionId: 'test-python-use-deps',
        language: 'python',
        code,
        timeout: 60,
        dependencies,
      });

      expect(result.status).toBe('success');
      // The runner would have executed after dependencies installed
      expect(execInPodCalls.length).toBeGreaterThan(1);
    });
  });

  describe('JavaScript with dependencies', () => {
    it('should install npm packages before executing code', async () => {
      const dependencies: LanguageDependencies = {
        javascript: {
          packages: ['axios@1.6.0', 'lodash']
        }
      };

      const result = await orchestrator.executeWithWarmPool({
        executionId: 'test-js-deps',
        language: 'javascript',
        code: 'const axios = require("axios"); console.log("axios loaded");',
        timeout: 60,
        dependencies,
      });

      expect(result.status).toBe('success');

      // Verify npm install was called
      const npmCall = execInPodCalls.find(
        call => call.command[0] === 'sh' && call.command[2]?.includes('npm install')
      );
      expect(npmCall).toBeDefined();
      expect(npmCall!.command[2]).toContain('axios@1.6.0');
      expect(npmCall!.command[2]).toContain('lodash');
    });
  });

  describe('Java with Maven dependencies', () => {
    it('should download Maven JARs before executing code', async () => {
      const dependencies: LanguageDependencies = {
        java: {
          maven: [
            'org.postgresql:postgresql:42.7.1',
            'com.google.code.gson:gson:2.10.1'
          ]
        }
      };

      const code = `
public class Main {
    public static void main(String[] args) {
        System.out.println("Java with JDBC driver!");
    }
}
`;

      const result = await orchestrator.executeWithWarmPool({
        executionId: 'test-java-deps',
        language: 'java',
        code,
        timeout: 120,
        dependencies,
      });

      expect(result.status).toBe('success');

      // Verify mvn dependency:copy was called
      const mvnCall = execInPodCalls.find(
        call => call.command[0] === 'sh' && call.command[2]?.includes('mvn dependency:copy')
      );
      expect(mvnCall).toBeDefined();
      expect(mvnCall!.command[2]).toContain('org.postgresql:postgresql:42.7.1');
      expect(mvnCall!.command[2]).toContain('com.google.code.gson:gson:2.10.1');
    });

    it('should download JAR files from URLs', async () => {
      const dependencies: LanguageDependencies = {
        java: {
          jars: ['https://example.com/custom-driver.jar']
        }
      };

      const result = await orchestrator.executeWithWarmPool({
        executionId: 'test-java-jar-url',
        language: 'java',
        code: 'public class Main { public static void main(String[] args) {} }',
        timeout: 60,
        dependencies,
      });

      expect(result.status).toBe('success');

      // Verify curl was called for JAR download
      const curlCall = execInPodCalls.find(
        call => call.command[0] === 'sh' && call.command[2]?.includes('curl')
      );
      expect(curlCall).toBeDefined();
      expect(curlCall!.command[2]).toContain('https://example.com/custom-driver.jar');
    });
  });

  describe('Go with module dependencies', () => {
    it('should run go get before executing code', async () => {
      const dependencies: LanguageDependencies = {
        go: {
          modules: [
            'github.com/lib/pq@v1.10.9',
            'github.com/go-redis/redis/v8'
          ]
        }
      };

      const code = `
package main

import "fmt"

func main() {
    fmt.Println("Go with database drivers!")
}
`;

      const result = await orchestrator.executeWithWarmPool({
        executionId: 'test-go-deps',
        language: 'go',
        code,
        timeout: 90,
        dependencies,
      });

      expect(result.status).toBe('success');

      // Verify go get was called
      const goGetCall = execInPodCalls.find(
        call => call.command[0] === 'sh' && call.command[2]?.includes('go get')
      );
      expect(goGetCall).toBeDefined();
      expect(goGetCall!.command[2]).toContain('github.com/lib/pq@v1.10.9');
      expect(goGetCall!.command[2]).toContain('github.com/go-redis/redis/v8');
    });
  });

  describe('C# with NuGet packages', () => {
    it('should run dotnet add package before executing code', async () => {
      const dependencies: LanguageDependencies = {
        csharp: {
          packages: ['Newtonsoft.Json@13.0.3', 'Dapper']
        }
      };

      const result = await orchestrator.executeWithWarmPool({
        executionId: 'test-csharp-deps',
        language: 'csharp',
        code: 'using System; class Program { static void Main() { Console.WriteLine("C#!"); } }',
        timeout: 90,
        dependencies,
      });

      expect(result.status).toBe('success');

      // Verify dotnet add package was called
      const dotnetCall = execInPodCalls.find(
        call => call.command[0] === 'sh' && call.command[2]?.includes('dotnet add package')
      );
      expect(dotnetCall).toBeDefined();
      expect(dotnetCall!.command[2]).toContain('Newtonsoft.Json');
      expect(dotnetCall!.command[2]).toContain('Dapper');
    });
  });

  describe('Ruby with gem dependencies', () => {
    it('should run gem install before executing code', async () => {
      const dependencies: LanguageDependencies = {
        ruby: {
          gems: ['pg:1.5.4', 'httparty']
        }
      };

      const result = await orchestrator.executeWithWarmPool({
        executionId: 'test-ruby-deps',
        language: 'ruby',
        code: 'puts "Ruby with gems!"',
        timeout: 60,
        dependencies,
      });

      expect(result.status).toBe('success');

      // Verify gem install was called
      const gemCall = execInPodCalls.find(
        call => call.command[0] === 'sh' && call.command[2]?.includes('gem install')
      );
      expect(gemCall).toBeDefined();
      expect(gemCall!.command[2]).toContain("pg -v '1.5.4'");
      expect(gemCall!.command[2]).toContain('httparty');
    });
  });

  describe('Rust with crate dependencies', () => {
    it('should run cargo install before executing code', async () => {
      const dependencies: LanguageDependencies = {
        rust: {
          crates: ['tokio@1.35', 'serde@1.0']
        }
      };

      const result = await orchestrator.executeWithWarmPool({
        executionId: 'test-rust-deps',
        language: 'rust',
        code: 'fn main() { println!("Rust with crates!"); }',
        timeout: 120,
        dependencies,
      });

      expect(result.status).toBe('success');

      // Verify cargo install was called
      const cargoCall = execInPodCalls.find(
        call => call.command[0] === 'sh' && call.command[2]?.includes('cargo install')
      );
      expect(cargoCall).toBeDefined();
      expect(cargoCall!.command[2]).toContain('tokio@1.35');
      expect(cargoCall!.command[2]).toContain('serde@1.0');
    });
  });

  describe('PHP with composer dependencies', () => {
    it('should run composer require before executing code', async () => {
      const dependencies: LanguageDependencies = {
        php: {
          packages: ['guzzlehttp/guzzle:^7.0', 'monolog/monolog']
        }
      };

      const result = await orchestrator.executeWithWarmPool({
        executionId: 'test-php-deps',
        language: 'php',
        code: '<?php echo "PHP with composer!";',
        timeout: 90,
        dependencies,
      });

      expect(result.status).toBe('success');

      // Verify composer require was called
      const composerCall = execInPodCalls.find(
        call => call.command[0] === 'sh' && call.command[2]?.includes('composer require')
      );
      expect(composerCall).toBeDefined();
      expect(composerCall!.command[2]).toContain('guzzlehttp/guzzle:^7.0');
      expect(composerCall!.command[2]).toContain('monolog/monolog');
    });
  });

  describe('Kotlin with Maven dependencies', () => {
    it('should download Maven JARs for Kotlin', async () => {
      const dependencies: LanguageDependencies = {
        kotlin: {
          maven: ['org.jetbrains.kotlin:kotlin-stdlib:1.9.22']
        }
      };

      const result = await orchestrator.executeWithWarmPool({
        executionId: 'test-kotlin-deps',
        language: 'kotlin',
        code: 'fun main() { println("Kotlin with deps!") }',
        timeout: 90,
        dependencies,
      });

      expect(result.status).toBe('success');

      // Verify mvn dependency:copy was called
      const mvnCall = execInPodCalls.find(
        call => call.command[0] === 'sh' && call.command[2]?.includes('mvn dependency:copy')
      );
      expect(mvnCall).toBeDefined();
      expect(mvnCall!.command[2]).toContain('org.jetbrains.kotlin:kotlin-stdlib:1.9.22');
    });
  });

  describe('No dependencies', () => {
    it('should skip dependency installation when no deps provided', async () => {
      const result = await orchestrator.executeWithWarmPool({
        executionId: 'test-no-deps',
        language: 'python',
        code: 'print("No deps needed")',
        timeout: 30,
      });

      expect(result.status).toBe('success');

      // Verify no dependency install commands were executed
      const depCall = execInPodCalls.find(
        call => call.command[0] === 'sh' && call.command[1] === '-c'
      );
      expect(depCall).toBeUndefined();
    });

    it('should skip dependency installation with empty packages', async () => {
      const dependencies: LanguageDependencies = {
        python: { packages: [] }
      };

      const result = await orchestrator.executeWithWarmPool({
        executionId: 'test-empty-deps',
        language: 'python',
        code: 'print("Empty deps")',
        timeout: 30,
        dependencies,
      });

      expect(result.status).toBe('success');

      // Empty packages should result in no install command
      const depCall = execInPodCalls.find(
        call => call.command[0] === 'sh' && call.command[2]?.includes('pip install')
      );
      expect(depCall).toBeUndefined();
    });
  });

  describe('Execution order', () => {
    it('should install dependencies before running code', async () => {
      const dependencies: LanguageDependencies = {
        python: { packages: ['requests'] }
      };

      await orchestrator.executeWithWarmPool({
        executionId: 'test-order',
        language: 'python',
        code: 'import requests',
        timeout: 60,
        dependencies,
      });

      // Find indices of dep install and runner execution
      const depIndex = execInPodCalls.findIndex(
        call => call.command[0] === 'sh' && call.command[2]?.includes('pip install')
      );
      const runnerIndex = execInPodCalls.findIndex(
        call => call.command[0] === '/app/runner.sh'
      );

      // Dependencies should be installed before runner is executed
      expect(depIndex).toBeLessThan(runnerIndex);
    });
  });

  describe('Cold start with dependencies', () => {
    beforeEach(async () => {
      execInPodCalls.length = 0;
      // Make warm pool unavailable to force cold start
      const { k8sClient } = await import('../modules/containers/k8s-client.js');
      vi.mocked(k8sClient.getAvailableRunner).mockResolvedValueOnce(null);
    });

    it('should install dependencies in cold start execution', async () => {
      const dependencies: LanguageDependencies = {
        python: { packages: ['flask', 'sqlalchemy'] }
      };

      const result = await orchestrator.executeWithWarmPool({
        executionId: 'test-cold-deps',
        language: 'python',
        code: 'from flask import Flask\nprint("Flask loaded")',
        timeout: 120,
        dependencies,
      });

      expect(result.status).toBe('success');

      // Verify pip install was called even in cold start
      const pipCall = execInPodCalls.find(
        call => call.command[0] === 'sh' && call.command[2]?.includes('pip install')
      );
      expect(pipCall).toBeDefined();
      expect(pipCall!.command[2]).toContain('flask');
      expect(pipCall!.command[2]).toContain('sqlalchemy');
    });
  });
});

describe('Real-world dependency scenarios', () => {
  beforeEach(() => {
    execInPodCalls.length = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should support PostgreSQL JDBC driver for Java database tests', async () => {
    const dependencies: LanguageDependencies = {
      java: {
        maven: ['org.postgresql:postgresql:42.7.1']
      }
    };

    const code = `
import java.sql.*;

public class Main {
    public static void main(String[] args) throws Exception {
        Class.forName("org.postgresql.Driver");
        System.out.println("PostgreSQL JDBC Driver loaded!");
    }
}
`;

    const result = await orchestrator.executeWithWarmPool({
      executionId: 'test-jdbc',
      language: 'java',
      code,
      timeout: 90,
      dependencies,
    });

    expect(result.status).toBe('success');
  });

  it('should support HTTP client libraries for API testing', async () => {
    const dependencies: LanguageDependencies = {
      python: {
        packages: ['requests', 'httpx', 'aiohttp']
      }
    };

    const code = `
import requests
import httpx
# aiohttp requires async context
print("All HTTP clients loaded!")
`;

    const result = await orchestrator.executeWithWarmPool({
      executionId: 'test-http-clients',
      language: 'python',
      code,
      timeout: 90,
      dependencies,
    });

    expect(result.status).toBe('success');
  });

  it('should support database drivers for multiple databases', async () => {
    const dependencies: LanguageDependencies = {
      go: {
        modules: [
          'github.com/lib/pq',
          'github.com/go-sql-driver/mysql',
          'github.com/go-redis/redis/v8',
          'go.mongodb.org/mongo-driver/mongo'
        ]
      }
    };

    const code = `
package main

import "fmt"

func main() {
    fmt.Println("Go database drivers ready!")
}
`;

    const result = await orchestrator.executeWithWarmPool({
      executionId: 'test-go-db-drivers',
      language: 'go',
      code,
      timeout: 120,
      dependencies,
    });

    expect(result.status).toBe('success');
  });
});
