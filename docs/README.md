# TestCraft Documentation

Welcome to the TestCraft documentation. This folder contains comprehensive documentation for the TestCraft test execution platform.

## Quick Links

| Document | Description |
|----------|-------------|
| [Architecture](./ARCHITECTURE.md) | System architecture, components, and design |
| [Features](./FEATURES.md) | Detailed feature documentation |
| [HOCON Reference](./HOCON-REFERENCE.md) | Complete HOCON test plan syntax reference |
| [CLI Reference](./CLI-REFERENCE.md) | Command-line tool usage |
| [API Reference](./API-REFERENCE.md) | REST API endpoint documentation |
| [Development Guide](./DEVELOPMENT.md) | Guide for contributors and developers |

## Overview

TestCraft is a Kubernetes-based test execution platform that supports:

- **Multi-language execution**: Run tests in 10+ programming languages
- **HOCON test plans**: Human-readable, version-control friendly test definitions
- **AI-powered testing**: Automatic test generation, data generation, and validation
- **Comprehensive reporting**: JUnit XML, HTML, JSON, Markdown, CSV formats
- **CI/CD integration**: Jenkins, GitHub Actions, GitLab CI support
- **Secure context management**: Encrypted variables and database connections

## Getting Started

### 1. Install the CLI 

```bash
npm install -g @testcraft/cli
```

### 2. Create a Test Plan

```bash
testcraft init --name my-tests --template api
```

### 3. Run Tests

```bash
testcraft run my-tests.hocon --api-url http://localhost:3000
```

### 4. View Reports

Reports are generated in `./test-reports/`:
- `test-report.json` - JSON format
- `test-report.xml` - JUnit XML format
- `test-report.html` - Interactive HTML report

## Documentation Structure

```
docs/
├── README.md           # This file
├── ARCHITECTURE.md     # System architecture and design
├── FEATURES.md         # Feature documentation
├── HOCON-REFERENCE.md  # HOCON syntax reference
├── CLI-REFERENCE.md    # CLI tool reference
├── API-REFERENCE.md    # REST API reference
└── DEVELOPMENT.md      # Development guide
```

## When to Update Documentation

| Making changes to... | Update these docs |
|---------------------|-------------------|
| System architecture | `ARCHITECTURE.md` |
| Adding new features | `FEATURES.md` |
| New node types | `HOCON-REFERENCE.md` |
| CLI commands | `CLI-REFERENCE.md` |
| API endpoints | `API-REFERENCE.md` |
| Build/dev process | `DEVELOPMENT.md` |

## Key Concepts

### Test Plans

Test plans are defined in HOCON format. See [HOCON Reference](./HOCON-REFERENCE.md) for complete syntax.

```hocon
testcraft {
  plan {
    name = "API Tests"
    nodes = [
      {
        id = "health-check"
        type = "http-request"
        name = "Health Check"
        config {
          method = "GET"
          url = "https://api.example.com/health"
        }
      }
    ]
  }
}
```

### Context Management

The context system manages variables, database connections, and state across test steps. See [Features](./FEATURES.md#context-management).

### Reporting

TestCraft generates reports in multiple formats. JUnit XML is used for CI/CD integration. See [Features](./FEATURES.md#reporting-system).

### AI Features

AI nodes can generate tests, create test data, and validate responses. See [Features](./FEATURES.md#ai-features).

## Support

- Create an issue on GitHub
- Check the [Development Guide](./DEVELOPMENT.md) for contribution guidelines
