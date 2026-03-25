export type SupportedLanguage =
  | 'java'
  | 'python'
  | 'csharp'
  | 'javascript'
  | 'typescript'
  | 'go'
  | 'rust'
  | 'ruby'
  | 'php'
  | 'kotlin';

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  'java',
  'python',
  'csharp',
  'javascript',
  'typescript',
  'go',
  'rust',
  'ruby',
  'php',
  'kotlin',
];

/**
 * Language-specific dependency configuration.
 */
export interface LanguageDependencies {
  python?: { packages: string[]; requirements?: string };
  javascript?: { packages: string[]; packageJson?: string };
  java?: { maven?: string[]; jars?: string[]; gradleDeps?: string[] };
  csharp?: { packages: string[] };
  go?: { modules: string[] };
  ruby?: { gems: string[] };
  rust?: { crates: string[] };
  php?: { packages: string[] };
  kotlin?: { maven?: string[]; jars?: string[] };
}

export interface ExecutionRequest {
  executionId?: string;
  language: SupportedLanguage;
  code: string;
  timeout?: number;
  inputs?: Record<string, unknown>;
  dependencies?: LanguageDependencies;
}

export interface ExecutionResult {
  executionId: string;
  status: 'success' | 'error' | 'timeout';
  language: SupportedLanguage;
  output?: string;
  error?: string;
  exitCode: number;
  duration: number;
  podName?: string;
  metrics?: ExecutionMetrics;
}

export interface ExecutionMetrics {
  cpuUsage?: number;
  memoryUsage?: number;
  startTime?: Date;
  endTime?: Date;
}

export interface RunnerPoolStatus {
  language: SupportedLanguage;
  ready: number;
  total: number;
  image: string;
}

export interface LanguageInfo {
  language: SupportedLanguage;
  displayName: string;
  extension: string;
  image: string;
  available: boolean;
}

export const LANGUAGE_INFO: Record<SupportedLanguage, Omit<LanguageInfo, 'available'>> = {
  java: {
    language: 'java',
    displayName: 'Java',
    extension: '.java',
    image: 'testcraft/runner-java:latest',
  },
  python: {
    language: 'python',
    displayName: 'Python',
    extension: '.py',
    image: 'testcraft/runner-python:latest',
  },
  csharp: {
    language: 'csharp',
    displayName: 'C#',
    extension: '.cs',
    image: 'testcraft/runner-csharp:latest',
  },
  javascript: {
    language: 'javascript',
    displayName: 'JavaScript',
    extension: '.js',
    image: 'testcraft/runner-javascript:latest',
  },
  typescript: {
    language: 'typescript',
    displayName: 'TypeScript',
    extension: '.ts',
    image: 'testcraft/runner-typescript:latest',
  },
  go: {
    language: 'go',
    displayName: 'Go',
    extension: '.go',
    image: 'testcraft/runner-go:latest',
  },
  rust: {
    language: 'rust',
    displayName: 'Rust',
    extension: '.rs',
    image: 'testcraft/runner-rust:latest',
  },
  ruby: {
    language: 'ruby',
    displayName: 'Ruby',
    extension: '.rb',
    image: 'testcraft/runner-ruby:latest',
  },
  php: {
    language: 'php',
    displayName: 'PHP',
    extension: '.php',
    image: 'testcraft/runner-php:latest',
  },
  kotlin: {
    language: 'kotlin',
    displayName: 'Kotlin',
    extension: '.kt',
    image: 'testcraft/runner-kotlin:latest',
  },
};
