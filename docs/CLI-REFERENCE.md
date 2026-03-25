# TestCraft CLI Reference

## Installation

```bash
# Global installation
npm install -g @testcraft/cli

# Or use npx
npx @testcraft/cli [command]
```

## Commands

### `testcraft run`

Execute a test plan.

```bash
testcraft run <file> [options]
```

**Arguments:**
- `<file>` - Path to the HOCON test plan file

**Options:**
| Option | Description | Default |
|--------|-------------|---------|
| `-e, --environment <env>` | Target environment | `staging` |
| `-v, --var <key=value>` | Set variables (can be repeated) | - |
| `-o, --output <dir>` | Output directory for reports | `./test-reports` |
| `-f, --format <format>` | Report formats (can be repeated) | `json` |
| `--api-url <url>` | TestCraft API server URL | `http://localhost:3000` |
| `-p, --parallel` | Run tests in parallel | `false` |
| `-d, --dry-run` | Validate without executing | `false` |
| `--verbose` | Verbose output | `false` |
| `--ci` | CI mode (exit with error on failure) | `false` |

**Examples:**

```bash
# Basic execution
testcraft run tests/api-tests.hocon

# With environment and variables
testcraft run tests/api-tests.hocon \
  --environment production \
  --var API_KEY=secret123 \
  --var BASE_URL=https://api.prod.com

# CI mode with multiple report formats
testcraft run tests/api-tests.hocon \
  --api-url https://testcraft.company.com \
  --format json --format junit --format html \
  --output ./reports \
  --ci

# Dry run for validation
testcraft run tests/api-tests.hocon --dry-run
```

---

### `testcraft validate`

Validate a HOCON test plan without executing.

```bash
testcraft validate <file> [options]
```

**Arguments:**
- `<file>` - Path to the HOCON test plan file

**Options:**
| Option | Description | Default |
|--------|-------------|---------|
| `-s, --strict` | Fail on warnings | `false` |

**Examples:**

```bash
# Basic validation
testcraft validate tests/api-tests.hocon

# Strict validation (fail on warnings)
testcraft validate tests/api-tests.hocon --strict
```

**Output:**

```
✓ Validation passed

Plan Info:
  Name: API Tests
  Description: Comprehensive API test suite
  Nodes: 15

Warnings:
  ⚠ Missing version, will default to 1.0
```

---

### `testcraft import`

Import a HOCON test plan to the server.

```bash
testcraft import <file> [options]
```

**Arguments:**
- `<file>` - Path to the HOCON test plan file

**Options:**
| Option | Description | Default |
|--------|-------------|---------|
| `--api-url <url>` | TestCraft API server URL | `http://localhost:3000` |
| `-n, --name <name>` | Override plan name | - |

**Examples:**

```bash
# Import a test plan
testcraft import tests/api-tests.hocon --api-url https://testcraft.company.com

# Import with custom name
testcraft import tests/api-tests.hocon --name "Production API Tests v2"
```

**Output:**

```
✓ Test plan imported

Imported Plan:
  ID: plan-123abc
  Name: API Tests
  Version: 1.0

To run this plan:
  testcraft run tests/api-tests.hocon
```

---

### `testcraft export`

Export a test plan from the server to a HOCON file.

```bash
testcraft export <id> <file> [options]
```

**Arguments:**
- `<id>` - Test plan ID
- `<file>` - Output file path

**Options:**
| Option | Description | Default |
|--------|-------------|---------|
| `--api-url <url>` | TestCraft API server URL | `http://localhost:3000` |

**Examples:**

```bash
# Export a test plan
testcraft export plan-123abc ./exported-plan.hocon

# Export to specific location
testcraft export plan-123abc /path/to/tests/exported.hocon --api-url https://testcraft.company.com
```

---

### `testcraft list`

List test plans on the server.

```bash
testcraft list [options]
```

**Options:**
| Option | Description | Default |
|--------|-------------|---------|
| `--api-url <url>` | TestCraft API server URL | `http://localhost:3000` |
| `-t, --tags <tags>` | Filter by tags (comma-separated) | - |
| `-s, --search <query>` | Search by name/description | - |
| `--json` | Output as JSON | `false` |

**Examples:**

```bash
# List all plans
testcraft list --api-url https://testcraft.company.com

# Filter by tags
testcraft list --tags api,integration

# Search plans
testcraft list --search "user authentication"

# JSON output for scripting
testcraft list --json | jq '.items[].name'
```

**Output:**

```
Test Plans (5 total)
────────────────────────────────────────────────────────────────────

API Tests (plan-123abc)
  Comprehensive API test suite
  Tags: api, integration
  Updated: 1/15/2024, 10:30 AM

User Authentication Tests (plan-456def)
  Test user login, logout, and session management
  Tags: auth, security
  Updated: 1/14/2024, 3:45 PM
```

---

### `testcraft init`

Create a new test plan from a template.

```bash
testcraft init [options]
```

**Options:**
| Option | Description | Default |
|--------|-------------|---------|
| `-n, --name <name>` | Plan name | `my-test-plan` |
| `-o, --output <file>` | Output file path | `./<name>.hocon` |
| `-t, --template <type>` | Template type | `basic` |

**Templates:**
- `basic` - Minimal test plan structure
- `api` - REST API testing template
- `load` - Load testing template
- `database` - Database testing template
- `full` - Full-featured template with all sections

**Examples:**

```bash
# Create basic test plan
testcraft init --name "my-api-tests"

# Create API testing template
testcraft init --name "user-api" --template api --output tests/user-api.hocon

# Create load testing template
testcraft init --name "load-test" --template load
```

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `TESTCRAFT_API_URL` | Default API server URL | `http://localhost:3000` |
| `TESTCRAFT_API_KEY` | API authentication key | - |
| `TESTCRAFT_OUTPUT_DIR` | Default output directory | `./test-reports` |
| `TESTCRAFT_LOG_LEVEL` | Log level (debug, info, warn, error) | `info` |
| `TESTCRAFT_TIMEOUT` | Default execution timeout (ms) | `300000` |

---

## Exit Codes

| Code | Description |
|------|-------------|
| `0` | Success |
| `1` | Test failures or execution error |
| `2` | Validation error |
| `3` | Configuration error |
| `4` | Network/connectivity error |

---

## Configuration File

Create `testcraft.config.json` in your project root:

```json
{
  "apiUrl": "https://testcraft.company.com",
  "defaultEnvironment": "staging",
  "outputDir": "./test-reports",
  "formats": ["json", "junit", "html"],
  "variables": {
    "BASE_URL": "https://api.staging.com"
  },
  "ci": {
    "failOnWarnings": false,
    "retryCount": 2
  }
}
```

CLI options override configuration file settings.

---

## CI/CD Usage

### Jenkins

```groovy
pipeline {
  environment {
    TESTCRAFT_API_URL = credentials('testcraft-api-url')
  }
  stages {
    stage('Test') {
      steps {
        sh '''
          testcraft run tests/api-tests.hocon \
            --environment ${ENVIRONMENT} \
            --format junit --format html \
            --output test-reports \
            --ci
        '''
      }
      post {
        always {
          junit 'test-reports/test-report.xml'
          publishHTML([
            reportDir: 'test-reports',
            reportFiles: 'test-report.html',
            reportName: 'TestCraft Report'
          ])
        }
      }
    }
  }
}
```

### GitHub Actions

```yaml
- name: Run Tests
  env:
    TESTCRAFT_API_URL: ${{ secrets.TESTCRAFT_API_URL }}
  run: |
    npm install -g @testcraft/cli
    testcraft run tests/api-tests.hocon \
      --environment ${{ github.ref == 'refs/heads/main' && 'production' || 'staging' }} \
      --format junit --format html \
      --ci

- name: Upload Results
  uses: actions/upload-artifact@v4
  with:
    name: test-reports
    path: test-reports/
```

### GitLab CI

```yaml
test:
  script:
    - npm install -g @testcraft/cli
    - testcraft run tests/api-tests.hocon --format junit --ci
  artifacts:
    reports:
      junit: test-reports/test-report.xml
```

---

## Troubleshooting

### Connection Refused

```
Error: connect ECONNREFUSED 127.0.0.1:3000
```

**Solution:** Ensure the TestCraft API server is running and accessible.

```bash
# Check if server is running
curl http://localhost:3000/api/v1/health

# Use correct API URL
testcraft run tests/plan.hocon --api-url http://actual-server:3000
```

### Validation Failed

```
✗ Validation failed

Errors:
  ✗ Missing root "testcraft" element
  ✗ Missing "plan" element
```

**Solution:** Check your HOCON syntax. Ensure the file follows the correct structure.

### Timeout Error

```
Error: Execution timeout after 300000ms
```

**Solution:** Increase the timeout or optimize your test plan.

```bash
testcraft run tests/plan.hocon --var TIMEOUT=600000
```

Or in the HOCON file:

```hocon
config {
  timeout = 600000
}
```
