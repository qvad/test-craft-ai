# TestCraft API Reference

## Base URL

```
http://localhost:3000/api/v1
```

## Authentication

Include API key in header:
```
Authorization: Bearer <api-key>
```

---

## Test Plans

### Import Test Plan

Import a HOCON test plan to the server.

```http
POST /plans/import
Content-Type: application/json

{
  "hoconContent": "testcraft { plan { ... } }",
  "nameOverride": "Custom Name",
  "tags": ["api", "integration"]
}
```

**Response:**
```json
{
  "id": "plan-123abc",
  "name": "Test Plan Name",
  "version": "1.0",
  "tags": ["api", "integration"],
  "nodeCount": 15,
  "createdAt": "2024-01-15T10:30:00Z"
}
```

### Export Test Plan

Export a test plan to HOCON format.

```http
GET /plans/{id}/export
```

**Response:**
```json
{
  "id": "plan-123abc",
  "name": "Test Plan Name",
  "version": "1.0",
  "hoconContent": "testcraft { plan { ... } }"
}
```

### List Test Plans

```http
GET /plans?page=1&limit=20&search=api&tags=integration,api&sortBy=updatedAt&sortOrder=desc
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20) |
| `search` | string | Search in name/description |
| `tags` | string | Comma-separated tags |
| `sortBy` | string | `name`, `createdAt`, `updatedAt` |
| `sortOrder` | string | `asc`, `desc` |

**Response:**
```json
{
  "items": [
    {
      "id": "plan-123abc",
      "name": "API Tests",
      "description": "Comprehensive API test suite",
      "version": "1.0",
      "tags": ["api", "integration"],
      "nodeCount": 15,
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 20,
  "totalPages": 3
}
```

### Get Test Plan

```http
GET /plans/{id}
```

**Response:**
```json
{
  "id": "plan-123abc",
  "name": "API Tests",
  "description": "Comprehensive API test suite",
  "version": "1.0",
  "tags": ["api", "integration"],
  "config": { ... },
  "nodes": [ ... ],
  "nodeCount": 15,
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

### Update Test Plan

```http
PUT /plans/{id}
Content-Type: application/json

{
  "hoconContent": "testcraft { plan { ... } }",
  "name": "Updated Name",
  "description": "Updated description",
  "tags": ["new-tag"]
}
```

### Delete Test Plan

```http
DELETE /plans/{id}
```

**Response:** `204 No Content`

### Validate Test Plan

Validate a HOCON test plan without saving.

```http
POST /plans/validate
Content-Type: application/json

{
  "hoconContent": "testcraft { plan { ... } }",
  "environment": "staging",
  "variables": {
    "API_KEY": "test-key"
  }
}
```

**Response:**
```json
{
  "valid": true,
  "errors": [],
  "warnings": ["Missing version, will default to 1.0"],
  "executionPlan": {
    "name": "Test Plan",
    "environment": "staging",
    "nodeCount": 15,
    "nodes": [
      { "id": "node-1", "type": "http-request", "name": "GET Users" }
    ],
    "estimatedDuration": "~5m",
    "variables": {
      "defined": ["baseUrl", "timeout"],
      "provided": ["API_KEY"],
      "missing": []
    }
  }
}
```

### Execute Test Plan

```http
POST /plans/execute
Content-Type: application/json

{
  "hoconContent": "testcraft { plan { ... } }",
  "environment": "staging",
  "variables": {
    "API_KEY": "test-key"
  },
  "parallel": true,
  "reportFormats": ["json", "junit", "html"]
}
```

**Response:**
```json
{
  "executionId": "exec-abc123",
  "status": "queued",
  "planName": "Test Plan",
  "nodeCount": 15,
  "environment": "staging",
  "streamUrl": "/api/v1/executions/exec-abc123/stream"
}
```

### Clone Test Plan

```http
POST /plans/{id}/clone
Content-Type: application/json

{
  "name": "Cloned Plan Name"
}
```

**Response:**
```json
{
  "id": "plan-456def",
  "name": "Cloned Plan Name",
  "clonedFrom": "plan-123abc"
}
```

---

## Context Management

### Create Execution Context

```http
POST /executions/{executionId}/context
```

**Response:**
```json
{
  "executionId": "exec-abc123",
  "created": true
}
```

### Get Execution Context

```http
GET /executions/{executionId}/context
```

**Response:**
```json
{
  "variables": [
    { "name": "userId", "value": "123", "scope": "plan", "type": "string" },
    { "name": "authToken", "value": "********", "scope": "global", "type": "string" }
  ],
  "connections": [
    { "id": "conn-abc", "type": "postgresql", "host": "localhost", "port": 5432, "database": "testdb" }
  ],
  "logs": [ ... ]
}
```

### Set Variable

```http
POST /executions/{executionId}/context/variables
Content-Type: application/json

{
  "name": "userId",
  "value": "12345",
  "scope": "plan",
  "sensitive": false,
  "type": "string"
}
```

**Response:**
```json
{
  "success": true,
  "name": "userId",
  "scope": "plan"
}
```

### Get Variable

```http
GET /executions/{executionId}/context/variables/{name}?scope=plan
```

**Response:**
```json
{
  "name": "userId",
  "value": "12345"
}
```

### Get All Variables

```http
GET /executions/{executionId}/context/variables?scope=plan&masked=true
```

**Response:**
```json
{
  "scope": "plan",
  "variables": {
    "userId": "12345",
    "authToken": "********"
  }
}
```

### Register Database Connection

```http
POST /executions/{executionId}/context/connections
Content-Type: application/json

{
  "type": "postgresql",
  "host": "localhost",
  "port": 5432,
  "database": "testdb",
  "username": "user",
  "password": "secret123",
  "options": {
    "pool_size": 5
  }
}
```

**Response:**
```json
{
  "connectionId": "conn-abc123",
  "type": "postgresql",
  "host": "localhost",
  "port": 5432,
  "database": "testdb"
}
```

### Get Connection

```http
GET /executions/{executionId}/context/connections/{connectionId}
```

**Response:**
```json
{
  "id": "conn-abc123",
  "type": "postgresql",
  "host": "localhost",
  "port": 5432,
  "database": "testdb",
  "username": "user",
  "createdAt": "2024-01-15T10:30:00Z"
}
```

### Get Connection String

```http
GET /executions/{executionId}/context/connections/{connectionId}/string
```

**Response:**
```json
{
  "connectionString": "postgresql://user:****@localhost:5432/testdb"
}
```

### Generate Code Injection

Generate code with context variables for a specific language.

```http
POST /executions/{executionId}/context/code-injection
Content-Type: application/json

{
  "language": "python",
  "variables": ["userId", "authToken"],
  "connectionIds": ["conn-abc123"]
}
```

**Response:**
```json
{
  "language": "python",
  "code": "# === TestCraft Context Injection ===\nimport os\n\n# Context Variables\nuserId = \"12345\"\nauthToken = \"secret-token\"\n\n# Database Connections\nconn_abc123_config = {\n    \"host\": \"localhost\",\n    \"port\": 5432,\n    ...\n}\n# === End Context Injection ==="
}
```

### Create Snapshot

```http
POST /executions/{executionId}/context/snapshots
```

**Response:**
```json
{
  "snapshotId": "snap-123abc"
}
```

### Restore Snapshot

```http
POST /executions/{executionId}/context/snapshots/{snapshotId}/restore
```

**Response:**
```json
{
  "restored": true,
  "snapshotId": "snap-123abc"
}
```

### Get Logs

```http
GET /executions/{executionId}/context/logs?level=info&nodeId=node-1&limit=100
```

**Response:**
```json
{
  "count": 50,
  "logs": [
    {
      "timestamp": "2024-01-15T10:30:00Z",
      "level": "info",
      "nodeId": "node-1",
      "nodeName": "GET Users",
      "message": "Request completed in 150ms",
      "data": { "statusCode": 200 }
    }
  ]
}
```

### Delete Context

```http
DELETE /executions/{executionId}/context
```

**Response:**
```json
{
  "deleted": true,
  "executionId": "exec-abc123"
}
```

---

## Reporting

### Generate Report

```http
GET /executions/{executionId}/report?format=junit&includeLogs=true&includeMetrics=true&maskSensitive=true
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `format` | string | `junit`, `html`, `json`, `markdown`, `csv` |
| `includeLogs` | boolean | Include execution logs |
| `includeMetrics` | boolean | Include performance metrics |
| `maskSensitive` | boolean | Mask sensitive data |

**Response:** Report content with appropriate Content-Type header.

### Generate Multiple Reports

```http
POST /executions/{executionId}/reports
Content-Type: application/json

{
  "formats": ["junit", "html", "json"]
}
```

**Response:**
```json
{
  "executionId": "exec-abc123",
  "formats": ["junit", "html", "json"],
  "reports": {
    "junit": "<?xml version=\"1.0\"?>...",
    "html": "<!DOCTYPE html>...",
    "json": "{ \"id\": \"exec-abc123\", ... }"
  }
}
```

### Get Summary

Quick execution overview without full report.

```http
GET /executions/{executionId}/summary
```

**Response:**
```json
{
  "executionId": "exec-abc123",
  "planName": "API Tests",
  "environment": "staging",
  "startTime": "2024-01-15T10:30:00Z",
  "endTime": "2024-01-15T10:35:00Z",
  "duration": 300000,
  "totalTests": 15,
  "passed": 13,
  "failed": 1,
  "skipped": 1,
  "errors": 0,
  "status": "failed"
}
```

### Start Execution Recording

```http
POST /executions/{executionId}/start
Content-Type: application/json

{
  "planName": "API Tests",
  "environment": "staging",
  "variables": { "key": "value" },
  "planId": "plan-123abc",
  "planVersion": "1.0",
  "gitCommit": "abc123",
  "gitBranch": "main",
  "buildNumber": "42"
}
```

**Response:**
```json
{
  "executionId": "exec-abc123",
  "started": true,
  "startTime": "2024-01-15T10:30:00Z"
}
```

### Record Step Result

```http
POST /executions/{executionId}/steps
Content-Type: application/json

{
  "id": "step-1",
  "name": "GET Users",
  "type": "http-request",
  "status": "passed",
  "startTime": "2024-01-15T10:30:00Z",
  "endTime": "2024-01-15T10:30:01Z",
  "duration": 150,
  "assertions": [
    { "name": "Status 200", "type": "status", "passed": true }
  ],
  "metrics": {
    "startTime": "2024-01-15T10:30:00Z",
    "responseTime": 150,
    "bytesReceived": 1024
  },
  "logs": [
    { "timestamp": "2024-01-15T10:30:00Z", "level": "info", "message": "Request sent" }
  ]
}
```

**Response:**
```json
{
  "recorded": true,
  "stepId": "step-1",
  "totalSteps": 5
}
```

### Complete Execution

```http
POST /executions/{executionId}/complete
```

**Response:**
```json
{
  "executionId": "exec-abc123",
  "completed": true,
  "endTime": "2024-01-15T10:35:00Z",
  "summary": {
    "totalTests": 15,
    "passed": 13,
    "failed": 1,
    "skipped": 1,
    "status": "failed",
    "duration": 300000
  }
}
```

### Get All Steps

```http
GET /executions/{executionId}/steps?status=failed
```

**Response:**
```json
{
  "executionId": "exec-abc123",
  "count": 1,
  "steps": [
    {
      "id": "step-3",
      "name": "Create Order",
      "type": "http-request",
      "status": "failed",
      ...
    }
  ]
}
```

---

## AI Services

### Generate Tests

```http
POST /ai/generate-tests
Content-Type: application/json

{
  "requirements": "User registration with email validation",
  "context": {
    "baseUrl": "https://api.example.com",
    "endpoints": ["/users", "/auth/register"]
  },
  "options": {
    "includeEdgeCases": true,
    "includeNegativeTests": true
  }
}
```

### Generate Test Data

```http
POST /ai/generate-data
Content-Type: application/json

{
  "prompt": "Generate 10 realistic user profiles",
  "schema": {
    "type": "array",
    "items": {
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "email": { "type": "string", "format": "email" },
        "age": { "type": "integer", "minimum": 18 }
      }
    }
  }
}
```

### Validate Response

```http
POST /ai/validate
Content-Type: application/json

{
  "response": { ... },
  "validations": [
    "Contains valid product data",
    "No sensitive information exposed",
    "All required fields present"
  ],
  "threshold": 0.8
}
```

### RAG Search

```http
POST /ai/search
Content-Type: application/json

{
  "query": "how to handle authentication",
  "limit": 5,
  "minScore": 0.7,
  "filters": {
    "type": "api-docs"
  }
}
```

---

## Health Check

### Basic Health

```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 3600
}
```

### Detailed Health

```http
GET /health/detailed
```

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 3600,
  "components": {
    "database": { "status": "healthy", "latency": 5 },
    "kubernetes": { "status": "healthy", "pods": 10 },
    "ai": { "status": "healthy" }
  }
}
```

---

## WebSocket Streams

### Execution Stream

Connect to receive real-time execution updates.

```
WS /executions/{executionId}/stream
```

**Events:**

```json
// Execution started
{ "type": "execution:started" }

// Node started
{
  "type": "node:started",
  "nodeId": "node-1",
  "nodeName": "GET Users"
}

// Node completed
{
  "type": "node:completed",
  "nodeId": "node-1",
  "nodeName": "GET Users",
  "status": "passed",
  "duration": 150,
  "error": null,
  "assertions": [
    { "name": "Status 200", "passed": true }
  ]
}

// Execution completed
{
  "type": "execution:completed",
  "status": "success",
  "totalTests": 15,
  "passed": 15,
  "failed": 0,
  "skipped": 0,
  "duration": 5000
}

// Execution error
{
  "type": "execution:error",
  "error": "Connection refused"
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": { ... }
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 204 | No Content |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict |
| 422 | Validation Error |
| 500 | Internal Server Error |
