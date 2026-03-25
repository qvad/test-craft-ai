# HOCON Test Plan Reference

## Overview

TestCraft uses HOCON (Human-Optimized Config Object Notation) for defining test plans. This reference documents all available configurations and node types.

## Importing Test Plans

Import HOCON files via the UI (editor → Import button) or CLI:

```bash
testcraft import plan.hocon
testcraft validate plan.hocon --strict
```

The parser handles the following HOCON features automatically:

- **Block comments** (`/* ... */`) — stripped before parsing (line comments `#` and `//` are also supported)
- **`${?VAR} defaultValue` syntax** — the optional-substitution form is a compatibility notation only; the parser replaces it with the literal default value. The environment variable is **not** read at runtime with this syntax.
- **Runtime environment variable access** — use `${env.VAR_NAME}` inside string values (e.g. `url = "http://${env.API_HOST}/api"`); this is resolved at execution time via `process.env`.
- **`include` directives** (`include "other.hocon"`) — parsed recursively; included files must be accessible on the server's filesystem relative to the base plan file.
- **Multi-line strings** (`"""..."""`) — preserved verbatim

> **Summary of variable syntaxes:**
> | Syntax | Resolved at | Source |
> |--------|-------------|--------|
> | `key = "literal"` | Parse time | Hardcoded |
> | `key = ${?ENV} "default"` | Parse time | Always uses `"default"` |
> | `key = "${env.ENV_VAR}"` | Execution time | `process.env.ENV_VAR` |
> | `url = "http://${baseUrl}/api"` | Execution time | Plan variable `baseUrl` |

## Basic Structure

```hocon
testcraft {
  plan {
    # Required fields
    name = "Test Plan Name"

    # Optional fields
    description = "Plan description"
    version = "1.0"
    tags = ["tag1", "tag2"]

    # Configuration
    config { ... }

    # Variables
    variables { ... }
    secrets { ... }

    # Setup and teardown
    setup = [ ... ]
    teardown = [ ... ]

    # Test nodes
    nodes = [ ... ]

    # Hooks
    hooks { ... }
  }
}
```

## Plan Configuration

```hocon
config {
  # Execution timeout in milliseconds
  timeout = 300000  # 5 minutes

  # Stop execution on first error
  stopOnError = false

  # Run nodes in parallel when possible
  parallelExecution = true

  # Maximum concurrent parallel nodes
  maxConcurrent = 10

  # Retry failed tests
  retryFailedTests = 2

  # Take screenshot on failure
  screenshotOnFailure = true

  # Default environment
  environment = "staging"
}
```

## Variables

### Regular Variables

```hocon
variables {
  # Static value
  baseUrl = "https://api.example.com"

  # Default value (${?DB_HOST} is stripped at parse time; "localhost" is always used)
  dbHost = ${?DB_HOST} "localhost"

  # Runtime env var — read from process.env at execution time
  apiEndpoint = "${env.API_ENDPOINT}"

  # Number
  timeout = 30000

  # Boolean
  debug = true

  # Object
  headers = {
    Accept = "application/json"
    X-Custom = "value"
  }

  # Array
  tags = ["tag1", "tag2"]
}
```

### Secrets (Encrypted)

```hocon
secrets {
  # Runtime env var — read from process.env
  apiKey = "${env.API_KEY}"

  # Static default (${?DB_PASSWORD} is ignored at parse time)
  password = ${?DB_PASSWORD} ""

  # JWT secret from env
  jwtSecret = "${env.JWT_SECRET}"
}
```

## Node Structure

```hocon
{
  # Required
  id = "unique-node-id"
  type = "node-type"
  name = "Human-readable name"

  # Optional
  description = "Node description"
  dependsOn = ["other-node-id"]
  condition = "${someVariable} == true"
  runAlways = false  # Run even if previous failed
  repeat = 1  # Number of times to repeat

  # Node-specific configuration
  config { ... }

  # Assertions
  assertions = [ ... ]

  # Variable extraction
  extractors = [ ... ]

  # Nested nodes (for controllers)
  children = [ ... ]
}
```

## Node Types

### HTTP Request

```hocon
{
  id = "http-request-1"
  type = "http-request"
  name = "GET Users"
  config {
    method = "GET"  # GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS
    url = "${baseUrl}/users"

    # Query parameters
    params {
      page = 1
      limit = 10
    }

    # Headers
    headers {
      Authorization = "Bearer ${authToken}"
      Content-Type = "application/json"
    }

    # Request body (for POST/PUT/PATCH)
    body = """
      {
        "name": "John Doe",
        "email": "john@example.com"
      }
    """

    # Timeout in milliseconds
    timeout = 30000

    # Follow redirects
    followRedirects = true

    # Proxy settings
    proxy {
      host = "proxy.example.com"
      port = 8080
    }
  }
  assertions = [
    { type = "status", expected = 200 }
    { type = "json-path", path = "$.data", isArray = true }
    { type = "response-time", maxMs = 1000 }
  ]
  extractors = [
    { name = "userId", type = "json-path", path = "$.data[0].id" }
  ]
}
```

### JDBC Request

```hocon
{
  id = "db-query-1"
  type = "jdbc-request"
  name = "Query Users Table"
  config {
    # Use connection reference or inline
    connectionRef = "primary_db"

    # Or inline connection
    driver = "postgresql"
    connectionString = "postgresql://localhost:5432/testdb"

    # Query
    query = """
      SELECT * FROM users
      WHERE status = 'active'
      LIMIT 10
    """

    # Query type
    queryType = "select"  # select, update, insert, delete, callable

    # Timeout
    timeout = 30000
  }
  assertions = [
    { type = "result-count", minimum = 1 }
    { type = "column-value", column = "status", expected = "active" }
    { type = "execution-time", maxMs = 100 }
  ]
  extractors = [
    { name = "userIds", type = "column", column = "id" }
    { name = "firstUser", type = "row", index = 0 }
  ]
}
```

### Code Execution

```hocon
{
  id = "code-exec-1"
  type = "code-execution"
  name = "Run Python Script"
  config {
    language = "python"  # python, java, javascript, etc.

    # Inject context variables
    injectVariables = ["userId", "testData"]
    injectConnections = ["primary_db"]

    # Code to execute
    code = """
      import json

      # userId is available from context
      result = {"processed": userId}
      print(json.dumps(result))
    """

    # Or reference a file
    # file = "scripts/process.py"

    # Working directory
    workDir = "/tmp"

    # Timeout
    timeout = 60000

    # Environment variables
    env {
      DEBUG = "true"
    }
  }
  assertions = [
    { type = "exit-code", expected = 0 }
    { type = "stdout-contains", value = "processed" }
  ]
  extractors = [
    { name = "result", type = "json-path", path = "$.processed" }
  ]
}
```

### Loop Controller

```hocon
{
  id = "loop-1"
  type = "loop-controller"
  name = "Repeat 10 Times"
  iterations = 10
  config {
    # Pace between iterations (ms)
    paceMs = 1000
  }
  children = [
    {
      id = "looped-request"
      type = "http-request"
      name = "Request #${__counter}"
      config {
        method = "GET"
        url = "${baseUrl}/status"
      }
    }
  ]
}
```

### ForEach Controller

```hocon
{
  id = "foreach-1"
  type = "foreach-controller"
  name = "Process Each User"
  dataSource = "${userIds}"  # Reference to array variable
  # Or inline data
  # dataSource = [
  #   { id = 1, name = "John" }
  #   { id = 2, name = "Jane" }
  # ]
  children = [
    {
      id = "process-user"
      type = "http-request"
      name = "Get User ${item.id}"
      config {
        method = "GET"
        url = "${baseUrl}/users/${item.id}"
      }
    }
  ]
}
```

### If Controller

```hocon
{
  id = "if-1"
  type = "if-controller"
  name = "Conditional Logic"
  condition = "${environment} == 'production'"
  children = [
    {
      id = "prod-only"
      type = "http-request"
      name = "Production Check"
      config {
        method = "GET"
        url = "${baseUrl}/production-status"
      }
    }
  ]
}
```

### Transaction Controller

```hocon
{
  id = "transaction-1"
  type = "transaction-controller"
  name = "User Registration Flow"
  config {
    # Generate parent sample
    generateParentSample = true
    # Include timers in generated sample
    includeTimers = false
  }
  children = [
    { id = "step-1", ... }
    { id = "step-2", ... }
    { id = "step-3", ... }
  ]
}
```

### Thread Group

```hocon
{
  id = "load-test-1"
  type = "thread-group"
  name = "Load Test"
  config {
    threads = 50
    rampUp = 30      # seconds
    duration = 120   # seconds
    iterations = -1  # -1 for duration-based
  }
  children = [ ... ]
  assertions = [
    { type = "throughput", minRps = 100 }
    { type = "error-rate", maxPercent = 1 }
    { type = "percentile", p99 = 2000 }
  ]
}
```

### AI Nodes

```hocon
# AI Data Generator
{
  id = "ai-data-1"
  type = "ai-data-generator"
  name = "Generate Test Users"
  config {
    prompt = "Generate 10 realistic user profiles"
    schema = {
      type = "array"
      items = {
        type = "object"
        properties = {
          name = { type = "string" }
          email = { type = "string", format = "email" }
          age = { type = "integer", minimum = 18, maximum = 80 }
        }
      }
    }
  }
  extractors = [
    { name = "testUsers", type = "full-response" }
  ]
}

# AI Response Validator
{
  id = "ai-validate-1"
  type = "ai-response-validator"
  name = "Validate API Response"
  config {
    responseVariable = "lastResponse"
    validations = [
      "Response contains valid product data"
      "No PII or sensitive data exposed"
      "All required fields are present"
    ]
    threshold = 0.8
  }
}

# AI Anomaly Detector
{
  id = "ai-anomaly-1"
  type = "ai-anomaly-detector"
  name = "Detect Anomalies"
  config {
    baseline = "previous-runs"
    sensitivity = "medium"  # low, medium, high
    checkTypes = [
      "response-time"
      "payload-size"
      "error-rate"
    ]
  }
}
```

### Context Setup

```hocon
{
  id = "context-setup"
  type = "context-setup"
  name = "Setup Execution Context"
  config {
    # Register database connections
    connections = [
      {
        name = "primary_db"
        type = "postgresql"
        host = "${dbHost}"
        port = 5432
        database = "testdb"
        username = "${dbUser}"
        password = "${secrets.dbPassword}"
      }
    ]

    # Set context variables
    variables = [
      { name = "runId", value = "${__uuid()}", scope = "global" }
      { name = "startTime", value = "${__timestamp()}", scope = "plan" }
    ]

    # Register context services
    services = [
      {
        type = "system"
        interval = 5000
      }
      {
        type = "http"
        interval = 10000
        config {
          endpoints = [
            { name = "api", url = "${baseUrl}/health" }
          ]
        }
      }
    ]
  }
}
```

## Assertions

### Status Code
```hocon
{ type = "status", expected = 200 }
{ type = "status", oneOf = [200, 201] }
{ type = "status", notExpected = 500 }
```

### JSON Path
```hocon
{ type = "json-path", path = "$.data.id", expected = "123" }
{ type = "json-path", path = "$.items", isArray = true }
{ type = "json-path", path = "$.count", isNumber = true }
{ type = "json-path", path = "$.name", pattern = "^[A-Z].*" }
```

### Response Time
```hocon
{ type = "response-time", maxMs = 1000 }
{ type = "response-time", percentile = 95, maxMs = 2000 }
```

### Body Content
```hocon
{ type = "body-contains", value = "success" }
{ type = "body-not-contains", value = "error" }
{ type = "body-regex", pattern = "id\":\\s*\\d+" }
```

### Header
```hocon
{ type = "header-equals", header = "Content-Type", value = "application/json" }
{ type = "header-exists", header = "X-Request-Id" }
```

### Database
```hocon
{ type = "result-count", expected = 10 }
{ type = "result-count", minimum = 1, maximum = 100 }
{ type = "column-value", column = "status", expected = "active" }
{ type = "execution-time", maxMs = 100 }
```

## Extractors

```hocon
extractors = [
  # JSON Path
  { name = "userId", type = "json-path", path = "$.data.id" }

  # Regex
  { name = "token", type = "regex", pattern = "token=([^&]+)" }

  # XPath (for XML)
  { name = "value", type = "xpath", path = "//response/value/text()" }

  # Header
  { name = "requestId", type = "header", header = "X-Request-Id" }

  # Full response
  { name = "response", type = "full-response" }

  # Database column
  { name = "ids", type = "column", column = "id" }

  # Database row
  { name = "firstRow", type = "row", index = 0 }
]
```

### Scope Options

```hocon
{ name = "var", type = "json-path", path = "$.id", scope = "global" }  # Available everywhere
{ name = "var", type = "json-path", path = "$.id", scope = "plan" }    # Plan level (default)
{ name = "var", type = "json-path", path = "$.id", scope = "node" }    # Node level only
```

## Built-in Functions

Use in variable values or string templates:

| Function | Description | Example |
|----------|-------------|---------|
| `${__uuid()}` | Generate UUID | `550e8400-e29b-41d4-a716-446655440000` |
| `${__timestamp()}` | Current timestamp | `1705579200000` |
| `${__random(min,max)}` | Random number | `${__random(1,100)}` |
| `${__randomString(len)}` | Random string | `${__randomString(10)}` |
| `${__counter()}` | Incrementing counter | `1`, `2`, `3`... |
| `${__env(NAME)}` | Environment variable | `${__env(HOME)}` |
| `${__property(name)}` | System property | `${__property(user.dir)}` |
| `${__dateFormat(pattern)}` | Formatted date | `${__dateFormat(yyyy-MM-dd)}` |

## Hooks

```hocon
hooks {
  # Before any node runs
  beforeAll = [
    {
      type = "log"
      config { message = "Starting test plan" }
    }
  ]

  # After all nodes complete
  afterAll = [
    {
      type = "context-export"
      config {
        outputFile = "results/context.json"
        includeLogs = true
        maskSensitive = true
      }
    }
  ]

  # Before each node
  beforeEach = [ ... ]

  # After each node
  afterEach = [ ... ]

  # On node failure
  onFailure = [
    {
      type = "screenshot"
      config { outputDir = "screenshots" }
    }
  ]
}
```

## Complete Example

```hocon
testcraft {
  plan {
    name = "E-commerce API Tests"
    description = "Test the e-commerce API endpoints"
    version = "2.0"
    tags = ["api", "e-commerce", "integration"]

    config {
      timeout = 600000
      parallelExecution = true
      maxConcurrent = 5
      retryFailedTests = 1
    }

    variables {
      baseUrl = ${?API_URL} "https://api.example.com"
      environment = ${?ENV} "staging"
    }

    secrets {
      apiKey = ${API_KEY}
      dbPassword = ${?DB_PASSWORD}
    }

    setup = [
      {
        id = "setup-context"
        type = "context-setup"
        name = "Initialize Context"
        config {
          connections = [
            {
              name = "db"
              type = "postgresql"
              host = "localhost"
              port = 5432
              database = "ecommerce"
              username = "test"
              password = "${secrets.dbPassword}"
            }
          ]
        }
      }
      {
        id = "setup-auth"
        type = "http-request"
        name = "Get Auth Token"
        config {
          method = "POST"
          url = "${baseUrl}/auth/token"
          headers { Content-Type = "application/json" }
          body = """{"apiKey": "${secrets.apiKey}"}"""
        }
        extractors = [
          { name = "authToken", type = "json-path", path = "$.token", scope = "global" }
        ]
      }
    ]

    nodes = [
      {
        id = "products"
        type = "transaction-controller"
        name = "Product Tests"
        children = [
          {
            id = "list-products"
            type = "http-request"
            name = "List Products"
            config {
              method = "GET"
              url = "${baseUrl}/products"
              headers { Authorization = "Bearer ${authToken}" }
            }
            assertions = [
              { type = "status", expected = 200 }
              { type = "json-path", path = "$.items", isArray = true }
              { type = "response-time", maxMs = 500 }
            ]
            extractors = [
              { name = "productIds", type = "json-path", path = "$.items[*].id" }
            ]
          }
          {
            id = "foreach-product"
            type = "foreach-controller"
            name = "Validate Each Product"
            dataSource = "${productIds}"
            children = [
              {
                id = "get-product"
                type = "http-request"
                name = "Get Product ${item}"
                config {
                  method = "GET"
                  url = "${baseUrl}/products/${item}"
                  headers { Authorization = "Bearer ${authToken}" }
                }
                assertions = [
                  { type = "status", expected = 200 }
                  { type = "json-path", path = "$.id", expected = "${item}" }
                ]
              }
            ]
          }
        ]
      }
    ]

    teardown = [
      {
        id = "cleanup"
        type = "jdbc-request"
        name = "Cleanup Test Data"
        runAlways = true
        config {
          connectionRef = "db"
          query = "DELETE FROM orders WHERE test_flag = true"
        }
      }
    ]

    hooks {
      afterAll = [
        {
          type = "context-export"
          config {
            outputFile = "results/context-${__uuid()}.json"
            maskSensitive = true
          }
        }
      ]
    }
  }
}
```
