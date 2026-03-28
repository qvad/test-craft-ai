/**
 * HOCON Schema Definitions for TestCraft Test Plans
 *
 * HOCON (Human-Optimized Config Object Notation) is used for:
 * - Readable test plan definitions
 * - Version control friendly format
 * - Environment-specific configurations
 * - Reusable test components via includes
 *
 * Reference: https://github.com/lightbend/config/blob/main/HOCON.md
 */

// ============================================================================
// HOCON TEST PLAN STRUCTURE
// ============================================================================

/**
 * Root structure of a TestCraft test plan in HOCON
 */
export interface HoconTestPlan {
  testcraft: {
    version: string;  // Schema version, e.g., "1.0"
    plan: HoconPlanDefinition;
  };
}

export interface HoconPlanDefinition {
  name: string;
  description?: string;
  tags?: string[];
  author?: string;

  // Global settings
  settings?: HoconSettings;

  // Variables and environments
  variables?: Record<string, HoconVariable>;
  environments?: Record<string, HoconEnvironment>;

  // Connection configurations
  connections?: Record<string, HoconConnection>;

  // The test tree
  nodes: HoconNode[];
}

export interface HoconSettings {
  defaultTimeout?: string;  // e.g., "60s", "5m"
  defaultLanguage?: string;
  continueOnError?: boolean;
  parallel?: boolean;
  maxParallelThreads?: number;

  // Reporting
  reporting?: {
    format?: ('json' | 'junit' | 'html' | 'allure')[];
    outputDir?: string;
  };

  // AI settings
  ai?: {
    enabled?: boolean;
    model?: string;
    temperature?: number;
    useRAG?: boolean;
  };
}

export interface HoconVariable {
  type: 'string' | 'number' | 'boolean' | 'secret' | 'list' | 'map';
  value?: unknown;
  default?: unknown;
  description?: string;
  sensitive?: boolean;
  // Reference to environment variable
  env?: string;
  // Reference to file
  file?: string;
}

export interface HoconEnvironment {
  description?: string;
  extends?: string;  // Inherit from another environment
  variables?: Record<string, unknown>;
  connections?: Record<string, Partial<HoconConnection>>;
}

export interface HoconConnection {
  type: 'jdbc' | 'http' | 'kafka' | 'redis' | 'mongodb' | 'grpc';

  // JDBC
  url?: string;
  driver?: string;
  username?: string;
  password?: string;  // Can use ${env.DB_PASSWORD} substitution
  poolSize?: number;

  // HTTP
  baseUrl?: string;
  headers?: Record<string, string>;
  auth?: {
    type: 'basic' | 'bearer' | 'oauth2' | 'api-key';
    credentials?: Record<string, string>;
  };

  // Kafka
  bootstrapServers?: string;
  groupId?: string;
  securityProtocol?: string;

  // Other properties
  properties?: Record<string, unknown>;
}

// ============================================================================
// HOCON NODE DEFINITIONS
// ============================================================================

export interface HoconNode {
  // Node identity
  id?: string;  // Auto-generated if not provided
  name: string;
  type: string;
  enabled?: boolean;
  description?: string;

  // Execution settings
  timeout?: string;
  retries?: number;
  retryDelay?: string;
  continueOnError?: boolean;

  // Type-specific configuration
  config?: Record<string, unknown>;

  // AI configuration (for ai-* nodes)
  ai?: HoconAIConfig;

  // Nested children
  children?: HoconNode[];

  // Include external file
  include?: string;  // e.g., "components/login-flow.conf"
}

export interface HoconAIConfig {
  intent: string;
  language?: string;
  useRAG?: boolean;
  ragQuery?: string;
  temperature?: number;
  context?: Record<string, unknown>;
}

/**
 * Validates a HOCON test plan structure
 * @throws Error if the plan is invalid
 */
export function validateHocon(plan: any): HoconTestPlan {
  if (!plan.testcraft) {
    throw new Error('Missing root "testcraft" element');
  }

  const p = plan.testcraft.plan;
  if (!p) {
    throw new Error('Missing "plan" element');
  }

  if (!p.name) {
    throw new Error('Missing plan name');
  }

  if (p.connections) {
    for (const [name, conn] of Object.entries(p.connections)) {
      const c = conn as any;
      if (c.type === 'invalid-type') {
        throw new Error(`Invalid connection type for "${name}": ${c.type}`);
      }
    }
  }

  return plan as HoconTestPlan;
}

// ============================================================================
// EXAMPLE HOCON CONFIGURATIONS
// ============================================================================

export const HOCON_EXAMPLES = {
  simpleHttpTest: `
# Simple HTTP API Test
testcraft {
  version = "1.0"

  plan {
    name = "User API Test"
    description = "Test user CRUD operations"
    tags = ["api", "users", "smoke"]

    settings {
      defaultTimeout = "30s"
      continueOnError = false
    }

    variables {
      baseUrl {
        type = string
        default = "http://localhost:3000"
        env = "API_BASE_URL"
      }
      authToken {
        type = secret
        env = "API_AUTH_TOKEN"
      }
    }

    environments {
      dev {
        variables {
          baseUrl = "http://dev-api.example.com"
        }
      }
      staging {
        extends = dev
        variables {
          baseUrl = "http://staging-api.example.com"
        }
      }
      prod {
        variables {
          baseUrl = "https://api.example.com"
        }
      }
    }

    nodes = [
      {
        name = "User API Tests"
        type = "thread-group"
        config {
          threads = 10
          rampUp = "10s"
          loops = 5
        }
        children = [
          {
            name = "Create User"
            type = "http-request"
            config {
              method = "POST"
              path = "/api/users"
              headers {
                "Content-Type" = "application/json"
                "Authorization" = "Bearer \${authToken}"
              }
              body = """
                {
                  "name": "\${__randomString(10)}",
                  "email": "\${__randomEmail()}"
                }
              """
            }
            children = [
              {
                name = "Extract User ID"
                type = "json-extractor"
                config {
                  variableName = "userId"
                  jsonPath = "$.id"
                }
              }
              {
                name = "Verify Status 201"
                type = "response-assertion"
                config {
                  testField = "response-code"
                  pattern = "201"
                }
              }
            ]
          }
          {
            name = "Get User"
            type = "http-request"
            config {
              method = "GET"
              path = "/api/users/\${userId}"
            }
            children = [
              {
                name = "Verify User Data"
                type = "ai-assertion"
                ai {
                  intent = "Verify the response contains valid user data with name and email"
                  confidenceThreshold = 0.8
                }
              }
            ]
          }
        ]
      }
    ]
  }
}
`,

  databaseTest: `
# Database Test Plan
testcraft {
  version = "1.0"

  plan {
    name = "Database Integration Tests"
    description = "Test database operations"

    connections {
      mainDb {
        type = jdbc
        url = "jdbc:postgresql://\${env.DB_HOST}:5432/testcraft"
        driver = "org.postgresql.Driver"
        username = \${env.DB_USER}
        password = \${env.DB_PASSWORD}
        poolSize = 5
      }
    }

    nodes = [
      {
        name = "Database Tests"
        type = "thread-group"
        config {
          threads = 1
          loops = 1
        }
        children = [
          {
            name = "Query Active Users"
            type = "jdbc-request"
            config {
              connection = "mainDb"
              queryType = "select"
            }
            ai {
              intent = "Get all users who logged in within the last 7 days, ordered by last login"
              useRAG = true
            }
            children = [
              {
                name = "Verify Results"
                type = "response-assertion"
                config {
                  testField = "response-text"
                  testType = "contains"
                  patterns = ["id", "email"]
                }
              }
            ]
          }
        ]
      }
    ]
  }
}
`,

  loadTest: `
# Load Test Configuration
testcraft {
  version = "1.0"

  plan {
    name = "API Load Test"
    description = "Performance testing for API endpoints"
    tags = ["performance", "load"]

    settings {
      defaultTimeout = "120s"
      parallel = true
      maxParallelThreads = 100

      reporting {
        format = ["json", "html", "allure"]
        outputDir = "./reports"
      }
    }

    nodes = [
      {
        name = "Ramp-up Load Test"
        type = "thread-group"
        config {
          threads = 100
          rampUp = "60s"
          duration = "300s"
          onSampleError = "continue"
        }
        children = [
          {
            name = "Constant Throughput"
            type = "constant-throughput-timer"
            config {
              targetThroughput = 600  # 10 requests/second
              calcMode = "all-active-threads"
            }
          }
          {
            name = "API Request"
            type = "http-request"
            config {
              method = "GET"
              path = "/api/products"
            }
            children = [
              {
                name = "Response Time Check"
                type = "duration-assertion"
                config {
                  maxDuration = 2000  # 2 seconds
                }
              }
            ]
          }
        ]
      }
      {
        name = "Monitor Anomalies"
        type = "ai-anomaly-detector"
        ai {
          intent = "Monitor response times and error rates for anomalies"
          monitoredMetrics = ["response_time", "error_rate", "throughput"]
          sensitivityLevel = "medium"
          alertOnAnomaly = true
        }
      }
    ]
  }
}
`,

  aiGeneratedTest: `
# AI-Generated Test Plan
testcraft {
  version = "1.0"

  plan {
    name = "AI-Generated E-Commerce Tests"
    description = "AI generates and validates test scenarios"

    settings {
      ai {
        enabled = true
        model = "claude-sonnet-4-20250514"
        useRAG = true
      }
    }

    nodes = [
      {
        name = "Generate Test Scenarios"
        type = "ai-scenario-builder"
        ai {
          intent = "Create a realistic e-commerce checkout flow with user authentication, cart management, and payment processing"
          userPersonas = ["new-user", "returning-customer", "guest"]
          includeEdgeCases = true
          variationCount = 5
        }
      }
      {
        name = "Generate Test Data"
        type = "ai-data-generator"
        ai {
          intent = "Generate realistic product catalog with prices, descriptions, and inventory"
          useRAG = true
          ragQuery = "e-commerce product data examples"
        }
        config {
          count = 100
          locale = "en-US"
          outputVariable = "products"
        }
      }
      {
        name = "Run Generated Tests"
        type = "foreach-controller"
        config {
          inputVariable = "generatedScenarios"
          outputVariable = "currentScenario"
        }
        children = [
          {
            name = "Execute Scenario"
            type = "ai-script"
            ai {
              intent = "Execute the test scenario stored in currentScenario variable"
              language = "typescript"
            }
          }
        ]
      }
    ]
  }
}
`
};

// ============================================================================
// HOCON DURATION PARSER
// ============================================================================

export function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)?$/i);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}`);
  }

  const value = parseFloat(match[1]);
  const unit = (match[2] || 'ms').toLowerCase();

  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60000,
    h: 3600000,
    d: 86400000,
  };

  return Math.round(value * (multipliers[unit] || 1));
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${ms / 1000}s`;
  if (ms < 3600000) return `${ms / 60000}m`;
  return `${ms / 3600000}h`;
}
