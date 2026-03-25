# TestCraft AI - Operational Runbooks

This document contains operational procedures for common incidents and maintenance tasks.

## Table of Contents

1. [API Server Issues](#api-server-issues)
2. [Database Issues](#database-issues)
3. [Authentication Issues](#authentication-issues)
4. [Rate Limiting Issues](#rate-limiting-issues)
5. [Performance Issues](#performance-issues)
6. [Deployment Procedures](#deployment-procedures)
7. [Disaster Recovery](#disaster-recovery)

---

## API Server Issues

### Runbook: API Not Responding

**Symptoms:**
- Health checks failing
- 502/503 errors from ingress
- Pods in CrashLoopBackOff

**Diagnosis Steps:**

1. Check pod status:
   ```bash
   kubectl get pods -n testcraft -l app=testcraft-api
   ```

2. Check pod logs:
   ```bash
   kubectl logs -n testcraft -l app=testcraft-api --tail=100
   ```

3. Check events:
   ```bash
   kubectl get events -n testcraft --sort-by='.lastTimestamp' | tail -20
   ```

4. Check resource usage:
   ```bash
   kubectl top pods -n testcraft -l app=testcraft-api
   ```

**Resolution Steps:**

1. **If OOMKilled:** Increase memory limits in deployment
   ```bash
   kubectl set resources deployment/api -n testcraft --limits=memory=2Gi
   ```

2. **If CrashLoopBackOff:** Check for startup errors
   ```bash
   kubectl logs -n testcraft -l app=testcraft-api --previous
   ```

3. **If connection refused:** Restart deployment
   ```bash
   kubectl rollout restart deployment/api -n testcraft
   ```

4. **If database connection failed:** See [Database Issues](#database-issues)

---

### Runbook: High Error Rate

**Symptoms:**
- Error rate > 5% on Grafana dashboard
- 5xx responses in logs

**Diagnosis Steps:**

1. Check error breakdown:
   ```bash
   kubectl logs -n testcraft -l app=testcraft-api | grep -i error | tail -50
   ```

2. Check Prometheus metrics:
   ```promql
   sum(rate(http_requests_total{status=~"5.."}[5m])) by (path, status)
   ```

**Resolution Steps:**

1. Identify failing endpoint and investigate root cause
2. Check for dependency failures (database, external APIs)
3. If AI API failures: Check API key validity and rate limits
4. Consider temporary traffic reduction via rate limiting

---

## Database Issues

### Runbook: Database Connection Failed

**Symptoms:**
- API logs show "Database initialization failed"
- Health check shows database unhealthy

**Diagnosis Steps:**

1. Check YugabyteDB pods:
   ```bash
   kubectl get pods -n testcraft -l app=yugabyte
   ```

2. Check YugabyteDB logs:
   ```bash
   kubectl logs -n testcraft yugabyte-0
   ```

3. Test connection manually:
   ```bash
   kubectl exec -it -n testcraft yugabyte-0 -- ysqlsh -h localhost -U yugabyte
   ```

**Resolution Steps:**

1. **If pod not running:** Restart the statefulset
   ```bash
   kubectl rollout restart statefulset/yugabyte -n testcraft
   ```

2. **If disk full:** Expand PVC or cleanup old data
   ```bash
   kubectl exec -it -n testcraft yugabyte-0 -- df -h
   ```

3. **If connection limit reached:** Restart API pods to release connections
   ```bash
   kubectl rollout restart deployment/api -n testcraft
   ```

---

### Runbook: Database Performance Degradation

**Symptoms:**
- Slow query warnings in logs
- High latency on Grafana dashboard
- Database query latency > 1s

**Diagnosis Steps:**

1. Check slow queries:
   ```sql
   SELECT * FROM pg_stat_activity WHERE state = 'active' ORDER BY query_start;
   ```

2. Check table sizes:
   ```sql
   SELECT relname, pg_size_pretty(pg_total_relation_size(relid))
   FROM pg_catalog.pg_statio_user_tables ORDER BY pg_total_relation_size(relid) DESC;
   ```

**Resolution Steps:**

1. Analyze and vacuum tables:
   ```sql
   VACUUM ANALYZE;
   ```

2. Check for missing indexes on frequently queried columns

3. Consider partitioning large tables (audit_logs)

---

## Authentication Issues

### Runbook: JWT Validation Failing

**Symptoms:**
- Users getting 401 Unauthorized
- "Token expired" or "Invalid signature" errors

**Diagnosis Steps:**

1. Check JWT_SECRET is set:
   ```bash
   kubectl get secret -n testcraft testcraft-jwt-secret -o jsonpath='{.data.JWT_SECRET}' | base64 -d
   ```

2. Verify token in logs:
   ```bash
   kubectl logs -n testcraft -l app=testcraft-api | grep -i "jwt\|token"
   ```

**Resolution Steps:**

1. **If secret rotated:** Inform users to re-authenticate

2. **If clock skew:** Ensure all pods have correct time
   ```bash
   kubectl exec -n testcraft deployment/api -- date
   ```

3. **If token expired:** Client should refresh token or re-login

---

### Runbook: API Key Not Working

**Symptoms:**
- 401 Unauthorized with API key
- "Invalid API key" in logs

**Diagnosis Steps:**

1. Verify key format starts with `tc_`
2. Check if key exists and is active in database

**Resolution Steps:**

1. User should regenerate API key via UI or API
2. Check if key has expired
3. Verify key has required scopes

---

## Rate Limiting Issues

### Runbook: Legitimate Traffic Rate Limited

**Symptoms:**
- 429 Too Many Requests responses
- Users complaining about being blocked

**Diagnosis Steps:**

1. Check rate limit configuration:
   ```bash
   kubectl get configmap -n testcraft api-config -o yaml | grep RATE
   ```

2. Check rate limit table:
   ```sql
   SELECT * FROM rate_limits WHERE count > 100 ORDER BY count DESC;
   ```

**Resolution Steps:**

1. **Temporary increase:** Modify rate limit in ConfigMap
   ```bash
   kubectl edit configmap api-config -n testcraft
   kubectl rollout restart deployment/api -n testcraft
   ```

2. **Clear specific key:**
   ```sql
   DELETE FROM rate_limits WHERE key LIKE '%<ip_or_user>%';
   ```

3. **Whitelist IP:** Add to trusted proxies list

---

## Performance Issues

### Runbook: High Latency

**Symptoms:**
- P95 latency > 2s
- Users reporting slow responses

**Diagnosis Steps:**

1. Identify slow endpoints:
   ```promql
   histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (path, le))
   ```

2. Check database latency:
   ```promql
   db_query_latency_ms
   ```

3. Check for resource constraints:
   ```bash
   kubectl top pods -n testcraft
   ```

**Resolution Steps:**

1. **If CPU-bound:** Scale horizontally
   ```bash
   kubectl scale deployment/api -n testcraft --replicas=5
   ```

2. **If memory-bound:** Increase limits or optimize queries

3. **If database-bound:** See [Database Performance](#runbook-database-performance-degradation)

---

## Deployment Procedures

### Standard Deployment

1. Build new image:
   ```bash
   docker build -t testcraft-api:v1.2.3 -f docker/Dockerfile.api .
   ```

2. Update deployment:
   ```bash
   kubectl set image deployment/api -n testcraft api=testcraft-api:v1.2.3
   ```

3. Monitor rollout:
   ```bash
   kubectl rollout status deployment/api -n testcraft
   ```

4. If issues, rollback:
   ```bash
   kubectl rollout undo deployment/api -n testcraft
   ```

### Database Migration Deployment

1. Create migration backup:
   ```bash
   kubectl exec -n testcraft yugabyte-0 -- ysql_dump testcraft > backup.sql
   ```

2. Run migrations:
   ```bash
   kubectl exec -n testcraft deployment/api -- npm run migrate
   ```

3. Verify migration:
   ```bash
   kubectl exec -n testcraft deployment/api -- npm run migrate:status
   ```

4. If issues, rollback:
   ```bash
   kubectl exec -n testcraft deployment/api -- npm run migrate:rollback
   ```

---

## Disaster Recovery

### Runbook: Full Service Restoration

**Prerequisites:**
- Access to backup storage
- kubectl configured for cluster
- Database backup available

**Steps:**

1. **Restore namespace:**
   ```bash
   kubectl apply -f k8s/namespace.yaml
   ```

2. **Restore secrets:**
   ```bash
   kubectl apply -f k8s/secrets.yaml
   # Or restore from sealed-secrets/vault
   ```

3. **Restore database:**
   ```bash
   kubectl apply -f k8s/yugabyte.yaml
   kubectl wait --for=condition=ready pod/yugabyte-0 -n testcraft --timeout=300s
   kubectl cp backup.sql testcraft/yugabyte-0:/tmp/
   kubectl exec -n testcraft yugabyte-0 -- ysqlsh -f /tmp/backup.sql
   ```

4. **Restore API:**
   ```bash
   kubectl apply -f k8s/api.yaml
   ```

5. **Verify health:**
   ```bash
   kubectl wait --for=condition=ready pod -l app=testcraft-api -n testcraft --timeout=120s
   curl -k https://<api-url>/api/v1/health
   ```

### RTO/RPO Targets

| Metric | Target | Current |
|--------|--------|---------|
| RTO (Recovery Time Objective) | 1 hour | ~30 mins |
| RPO (Recovery Point Objective) | 1 hour | Continuous |

---

## Contact Information

- **On-call:** Check PagerDuty rotation
- **Slack:** #testcraft-incidents
- **Escalation:** See incident management policy

---

## Appendix: Useful Commands

```bash
# Get all testcraft resources
kubectl get all -n testcraft

# Force delete stuck pod
kubectl delete pod <pod-name> -n testcraft --force --grace-period=0

# Get secrets
kubectl get secrets -n testcraft

# Port forward for debugging
kubectl port-forward -n testcraft svc/api 3000:3000

# Execute into pod
kubectl exec -it -n testcraft deployment/api -- sh

# Check API health directly
kubectl exec -n testcraft deployment/api -- curl -s localhost:3000/api/v1/health
```
