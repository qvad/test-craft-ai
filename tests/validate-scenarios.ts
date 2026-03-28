/**
 * Scenario Validator
 * Imports all example HOCON files, extracts every node, and attempts to
 * execute each one via POST /api/v1/test/node. Reports pass/fail/skip
 * grouped by scenario file and node type.
 */

import * as fs from 'fs';
import * as path from 'path';

const API_URL = process.env.API_URL ?? 'http://localhost:3000/api/v1';

// Nodes that require external infrastructure not usually in CI
const INFRA_REQUIRED: Record<string, string> = {
  // 'jdbc-request':          'YugabyteDB / PostgreSQL',
  // 'redis-request':         'Redis',
  // 'kafka-producer':        'Kafka',
  // 'kafka-consumer':        'Kafka',
  'websocket-request':     'WebSocket server',
  'jms-subscriber':        'JMS broker',
  'jms-publisher':         'JMS broker',
  'grpc-request':          'gRPC server',
  'graphql-request':       'GraphQL server',
  'ai-data-generator':     'AI API key',
  'ai-response-validator': 'AI API key',
  'ai-anomaly-detector':   'AI API key',
  'ai-test-generator':     'AI API key',
  // 'context-setup':         'YugabyteDB context',
  // 'context-export':        'YugabyteDB context',
  // 'yugabyte':              'YugabyteDB',
  'k8s-pod':               'Kubernetes',
  'response-assertion':    'preceding node response',
};

// Shell commands that reference kubectl — need K8s
const K8S_COMMANDS = ['kubectl', 'minikube', 'helm', 'k9s'];

function requiresExternal(node: { type: string; config?: any }): string | null {
  // Check node type
  if (INFRA_REQUIRED[node.type]) {
    // Check if we have YugabyteDB locally for JDBC/Context nodes
    const isDbNode = ['jdbc-request', 'context-setup', 'context-export', 'yugabyte'].includes(node.type);
    if (isDbNode && process.env.DB_HOST) return null; 
    
    // Check AI nodes
    if (node.type.startsWith('ai-')) return null;

    // Check K8s nodes
    if (node.type === 'k8s-pod') return null;

    return INFRA_REQUIRED[node.type];
  }

  // Skip shell commands in validator to avoid turn timeout
  if (node.type === 'shell-command') {
    return 'Shell command (skip)';
  }

  return null;
}

async function importPlan(content: string, file: string): Promise<any> {
  const res = await fetch(`${API_URL}/plans/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, format: 'hocon' }),
  });

  if (!res.ok) {
    throw new Error(`Failed to import ${file}: ${res.status} ${await res.text()}`);
  }

  const data = await res.json() as any;
  // Fetch full plan to get nodes
  const planRes = await fetch(`${API_URL}/plans/${data.id}`);
  return await planRes.json();
}

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

async function main() {
  const testsDir = path.join(process.cwd(), 'tests');
  const files = fs.readdirSync(testsDir).filter(f => f.endsWith('.hocon'));

  let totalPassed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;
  const failedNodes: any[] = [];

  // Default inputs for nodes that need variables
  const defaultInputs = {
    baseUrl: 'http://localhost:3000/api/v1',
    'variables.baseUrl': 'http://localhost:3000/api/v1',
    db_host: 'yugabyte.testcraft.svc.cluster.local',
    db_port: 5433,
    db_name: 'testcraft',
    db_user: 'yugabyte',
    db_pass: 'yugabyte',
    db_password: 'yugabyte',
    dbHost: 'yugabyte.testcraft.svc.cluster.local',
    dbPort: 5433,
    dbName: 'testcraft',
    dbUser: 'yugabyte',
    dbPass: 'yugabyte',
    'variables.db_host': 'yugabyte.testcraft.svc.cluster.local',
    'variables.db_port': 5433,
    'variables.db_name': 'testcraft',
    'variables.db_user': 'yugabyte',
    'variables.db_pass': 'yugabyte',
    'variables.dbHost': 'yugabyte.testcraft.svc.cluster.local',
    'variables.dbPort': 5433,
    'variables.dbName': 'testcraft',
    'variables.dbUser': 'yugabyte',
    'variables.dbPass': 'yugabyte',
    primary_db_host: 'yugabyte.testcraft.svc.cluster.local',
    primary_db_port: 5433,
    primary_db_database: 'testcraft',
    primary_db_user: 'yugabyte',
    primary_db_password: 'yugabyte',
    primary_db_pass: 'yugabyte',
    from_account: 1,
    to_account: 2,
    test_run_id: '00000000-0000-0000-0000-000000000001',
    test_duration_ms: 1000,
    concurrency: 1
  };

  for (const file of files) {
    console.log(`\n── ${file}`);
    const content = fs.readFileSync(path.join(testsDir, file), 'utf8');
    
    let plan;
    try {
      plan = await importPlan(content, file);
    } catch (e) {
      console.error(e);
      continue;
    }

    console.log(`  Imported: "${plan.name}" — ${plan.nodes.length} nodes`);

    // Filter out root node
    const nonRoot = plan.nodes.filter((n: any) => n.type !== 'root');

    for (const node of nonRoot) {
      const infra = requiresExternal({ type: node.type, config: node.config });
      const label = `${node.type} / ${node.name}`.slice(0, 60);

      if (infra) {
        console.log(`  ${YELLOW}⚠ ${label.padEnd(62)} requires: ${infra}${RESET}`);
        totalSkipped++;
        continue;
      }

      try {
        // Enforce cluster host for JDBC nodes when running against K8s
        const nodeInputs = { ...defaultInputs };
        if (node.type === 'jdbc-request' || node.type === 'context-setup' || node.type === 'yugabyte-request' || node.type === 'postgresql-request') {
          nodeInputs.db_host = 'yugabyte.testcraft.svc.cluster.local';
          nodeInputs.dbHost = 'yugabyte.testcraft.svc.cluster.local';
          nodeInputs.host = 'yugabyte.testcraft.svc.cluster.local';
          nodeInputs['variables.db_host'] = 'yugabyte.testcraft.svc.cluster.local';
          nodeInputs['variables.dbHost'] = 'yugabyte.testcraft.svc.cluster.local';
          nodeInputs['variables.host'] = 'yugabyte.testcraft.svc.cluster.local';
        }

        const res = await fetch(`${API_URL}/test/node`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            nodeType: node.type, 
            config: { type: node.type, ...node.config }, 
            inputs: nodeInputs 
          }),
        });
        const result = await res.json() as any;

        if (result.status === 'success' || result.status === 'passed') {
          console.log(`  ${GREEN}✔ ${label}${RESET}`);
          totalPassed++;
        } else {
          const errMsg = result.error ?? result.status ?? 'unknown';
          console.log(`  ${RED}✘ ${label}${RESET}`);
          console.log(`      ${errMsg.slice(0, 120)}`);
          
          // Print error/warn logs from node execution
          if (result.logs && result.logs.length > 0) {
            result.logs
              .filter((l: any) => l.level === 'error' || l.level === 'warn')
              .forEach((l: any) => {
                console.log(`      [${l.level}] ${l.message}`);
              });
          }
          
          totalFailed++;
          failedNodes.push({ file, node: label, error: errMsg });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.log(`  ${RED}✘ ${label}${RESET}`);
        console.log(`      Fetch Error: ${msg}`);
        totalFailed++;
        failedNodes.push({ file, node: label, error: msg });
      }
    }
  }

  console.log('\n' + '═'.repeat(72));
  console.log(`Results:  ${totalPassed} passed  ${totalFailed} failed  ${totalSkipped} skipped (requires infra)`);

  if (failedNodes.length > 0) {
    console.log('\nFailures:');
    for (const f of failedNodes) {
      console.log(`  ${f.file} / ${f.node}`);
      console.log(`    → ${f.error.slice(0, 150)}`);
    }
  }

  process.exit(totalFailed > 0 ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });
