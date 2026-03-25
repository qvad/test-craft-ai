/**
 * Tests for dependency installation command generation.
 *
 * Tests that each language generates the correct dependency installation commands.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ContainerOrchestrator } from '../modules/containers/orchestrator.js';
import type { LanguageDependencies, SupportedLanguage } from '../modules/containers/types.js';

describe('Dependency Installation', () => {
  let orchestrator: ContainerOrchestrator;

  beforeEach(() => {
    orchestrator = new ContainerOrchestrator();
  });

  describe('getDependencyInstallCommand', () => {
    describe('Python', () => {
      it('should generate pip install command for Python packages', () => {
        const deps: LanguageDependencies = {
          python: {
            packages: ['requests==2.31.0', 'sqlalchemy>=2.0', 'psycopg2-binary']
          }
        };

        const command = orchestrator.getDependencyInstallCommand('python', deps);

        expect(command).toBe('pip install --user requests==2.31.0 sqlalchemy>=2.0 psycopg2-binary');
      });

      it('should return null for empty Python packages', () => {
        const deps: LanguageDependencies = {
          python: { packages: [] }
        };

        const command = orchestrator.getDependencyInstallCommand('python', deps);

        expect(command).toBeNull();
      });

      it('should return null when no Python deps defined', () => {
        const deps: LanguageDependencies = {};

        const command = orchestrator.getDependencyInstallCommand('python', deps);

        expect(command).toBeNull();
      });
    });

    describe('JavaScript/TypeScript', () => {
      it('should generate npm install command for JavaScript packages', () => {
        const deps: LanguageDependencies = {
          javascript: {
            packages: ['axios@1.6.0', 'lodash', 'pg@8.11.3']
          }
        };

        const command = orchestrator.getDependencyInstallCommand('javascript', deps);

        expect(command).toBe('npm install --prefix /tmp/node_modules axios@1.6.0 lodash pg@8.11.3');
      });

      it('should use same command for TypeScript', () => {
        const deps: LanguageDependencies = {
          javascript: {
            packages: ['typescript', '@types/node']
          }
        };

        const command = orchestrator.getDependencyInstallCommand('typescript', deps);

        expect(command).toBe('npm install --prefix /tmp/node_modules typescript @types/node');
      });

      it('should return null for empty JavaScript packages', () => {
        const deps: LanguageDependencies = {
          javascript: { packages: [] }
        };

        const command = orchestrator.getDependencyInstallCommand('javascript', deps);

        expect(command).toBeNull();
      });
    });

    describe('Java/Kotlin', () => {
      it('should generate maven dependency:copy commands for Maven deps', () => {
        const deps: LanguageDependencies = {
          java: {
            maven: [
              'com.oracle.database.jdbc:ojdbc11:23.3.0.23.09',
              'org.postgresql:postgresql:42.7.1'
            ]
          }
        };

        const command = orchestrator.getDependencyInstallCommand('java', deps);

        expect(command).toContain('mkdir -p /app/libs');
        expect(command).toContain('mvn dependency:copy -Dartifact=com.oracle.database.jdbc:ojdbc11:23.3.0.23.09');
        expect(command).toContain('mvn dependency:copy -Dartifact=org.postgresql:postgresql:42.7.1');
      });

      it('should generate curl commands for JAR URLs', () => {
        const deps: LanguageDependencies = {
          java: {
            jars: [
              'https://example.com/custom-driver.jar',
              's3://bucket/my-library.jar'
            ]
          }
        };

        const command = orchestrator.getDependencyInstallCommand('java', deps);

        expect(command).toContain('mkdir -p /app/libs');
        expect(command).toContain('curl -sSL -o /app/libs/$(basename "https://example.com/custom-driver.jar")');
        expect(command).toContain('curl -sSL -o /app/libs/$(basename "s3://bucket/my-library.jar")');
      });

      it('should combine Maven and JAR dependencies', () => {
        const deps: LanguageDependencies = {
          java: {
            maven: ['org.postgresql:postgresql:42.7.1'],
            jars: ['https://example.com/custom.jar']
          }
        };

        const command = orchestrator.getDependencyInstallCommand('java', deps);

        expect(command).toContain('mvn dependency:copy');
        expect(command).toContain('curl -sSL');
      });

      it('should work for Kotlin with same Java deps', () => {
        const deps: LanguageDependencies = {
          kotlin: {
            maven: ['org.jetbrains.kotlin:kotlin-stdlib:1.9.22']
          }
        };

        const command = orchestrator.getDependencyInstallCommand('kotlin', deps);

        expect(command).toContain('mvn dependency:copy -Dartifact=org.jetbrains.kotlin:kotlin-stdlib:1.9.22');
      });

      it('should return null for empty Java deps', () => {
        const deps: LanguageDependencies = {
          java: {}
        };

        const command = orchestrator.getDependencyInstallCommand('java', deps);

        expect(command).toBeNull();
      });
    });

    describe('C#', () => {
      it('should generate dotnet add package commands', () => {
        const deps: LanguageDependencies = {
          csharp: {
            packages: ['Newtonsoft.Json@13.0.3', 'Dapper', 'Npgsql@8.0.1']
          }
        };

        const command = orchestrator.getDependencyInstallCommand('csharp', deps);

        expect(command).toContain('dotnet add package Newtonsoft.Json -v 13.0.3');
        expect(command).toContain('dotnet add package Dapper');
        expect(command).toContain('dotnet add package Npgsql -v 8.0.1');
      });

      it('should return null for empty C# packages', () => {
        const deps: LanguageDependencies = {
          csharp: { packages: [] }
        };

        const command = orchestrator.getDependencyInstallCommand('csharp', deps);

        expect(command).toBeNull();
      });
    });

    describe('Go', () => {
      it('should generate go get commands for Go modules', () => {
        const deps: LanguageDependencies = {
          go: {
            modules: [
              'github.com/lib/pq@v1.10.9',
              'github.com/go-redis/redis/v8'
            ]
          }
        };

        const command = orchestrator.getDependencyInstallCommand('go', deps);

        expect(command).toBe('go get github.com/lib/pq@v1.10.9 github.com/go-redis/redis/v8');
      });

      it('should return null for empty Go modules', () => {
        const deps: LanguageDependencies = {
          go: { modules: [] }
        };

        const command = orchestrator.getDependencyInstallCommand('go', deps);

        expect(command).toBeNull();
      });
    });

    describe('Ruby', () => {
      it('should generate gem install commands', () => {
        const deps: LanguageDependencies = {
          ruby: {
            gems: ['pg:1.5.4', 'redis', 'httparty:0.21.0']
          }
        };

        const command = orchestrator.getDependencyInstallCommand('ruby', deps);

        expect(command).toContain("gem install pg -v '1.5.4'");
        expect(command).toContain('gem install redis');
        expect(command).toContain("gem install httparty -v '0.21.0'");
      });

      it('should return null for empty Ruby gems', () => {
        const deps: LanguageDependencies = {
          ruby: { gems: [] }
        };

        const command = orchestrator.getDependencyInstallCommand('ruby', deps);

        expect(command).toBeNull();
      });
    });

    describe('Rust', () => {
      it('should generate cargo install commands', () => {
        const deps: LanguageDependencies = {
          rust: {
            crates: ['tokio@1.35', 'serde@1.0', 'reqwest']
          }
        };

        const command = orchestrator.getDependencyInstallCommand('rust', deps);

        expect(command).toBe('cargo install tokio@1.35 serde@1.0 reqwest');
      });

      it('should return null for empty Rust crates', () => {
        const deps: LanguageDependencies = {
          rust: { crates: [] }
        };

        const command = orchestrator.getDependencyInstallCommand('rust', deps);

        expect(command).toBeNull();
      });
    });

    describe('PHP', () => {
      it('should generate composer require commands', () => {
        const deps: LanguageDependencies = {
          php: {
            packages: ['guzzlehttp/guzzle:^7.0', 'monolog/monolog']
          }
        };

        const command = orchestrator.getDependencyInstallCommand('php', deps);

        expect(command).toBe('composer require guzzlehttp/guzzle:^7.0 monolog/monolog');
      });

      it('should return null for empty PHP packages', () => {
        const deps: LanguageDependencies = {
          php: { packages: [] }
        };

        const command = orchestrator.getDependencyInstallCommand('php', deps);

        expect(command).toBeNull();
      });
    });

    describe('All languages return null for missing deps', () => {
      const languages: SupportedLanguage[] = [
        'python', 'javascript', 'typescript', 'java', 'kotlin',
        'csharp', 'go', 'ruby', 'rust', 'php'
      ];

      languages.forEach((lang) => {
        it(`should return null for ${lang} with empty dependencies object`, () => {
          const deps: LanguageDependencies = {};
          const command = orchestrator.getDependencyInstallCommand(lang, deps);
          expect(command).toBeNull();
        });
      });
    });
  });
});
