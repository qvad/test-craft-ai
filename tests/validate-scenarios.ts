/**
 * Scenario Validator
 * Imports all example HOCON files, extracts every node, and attempts to
 * execute each one via POST /api/v1/test/node. Reports pass/fail/skip
 * grouped by scenario file and node type.
 */

import * as fs from 'fs';
import * as path from 'path';

const API_URL = process.env.API_URL ?? 'http://localhost:3000/api/v1';

// Node types that require external infrastructure not available locally
const INFRA_REQUIRED: Record<string, string> = {
  'jdbc-request':          'YugabyteDB / PostgreSQL',
  'redis-request':         'Redis',
  'kafka-producer':        'Kafka',
  'kafka-consumer':        'Kafka',
  'websocket-request':     'WebSocket server',
  'jms-subscriber':        'JMS broker',
  'jms-publisher':         'JMS broker',
  'grpc-request':          'gRPC server',
  'graphql-request':       'GraphQL server',
  'ai-data-generator':     'AI API key',
  'ai-response-validator': 'AI API key',
  'ai-anomaly-detector':   'AI API key',
  'ai-test-generator':     'AI API key',
  'context-setup':         'YugabyteDB context',
  'context-export':        'YugabyteDB context',
  'yugabyte':              'YugabyteDB',
  'k8s-pod':               'Kubernetes',
};

// Shell commands that reference kubectl — need K8s
function requiresK8s(config: Record<string, unknown>): boolean {
  const cmd = String(config.command ?? '');
  const args = (config.arguments ?? config.args ?? []) as string[];
  const allText = [cmd, ...args].join(' ');
  return /kubectl|helm|k8s|namespace/.test(allText);
}

// Shell command needs K8s to check
function requiresExternal(node: { type: string; config?: Record<string, unknown> }): string | null {
  const t = (node.type ?? '').toLowerCase();
  if (INFRA_REQUIRED[t]) return INFRA_REQUIRED[t];
  if (t === 'shell-command' && node.config && requiresK8s(node.config)) return 'Kubernetes';
  if (t === 'http-request') {
    const url = String((node.config ?? {}).url ?? '');
    // Placeholder URLs — unresolved substitution vars or known demo domains
    if (url.includes('${') || url.includes('example.com') || url.includes('api.local')) {
      return 'target service (set baseUrl variable)';
    }
  }
  return null;
}

async function importPlan(content: string): Promise<{ id: string; name: string; nodeCount: number; nodes: any[] } | null> {
  const res = await fetch(`${API_URL}/plans/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, format: 'hocon' }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`  Import failed: ${err.slice(0, 200)}`);
    return null;
  }
  const plan = await res.json() as { id: string; name: string };

  // Fetch the nodes
  const planRes = await fetch(`${API_URL}/plans/${plan.id}`);
  const planDetail = await planRes.json() as { nodes?: any[] };
  const nodes = planDetail.nodes ?? [];
  return { id: plan.id, name: plan.name, nodeCount: nodes.length, nodes };
}

async function runNode(nodeType: string, config: Record<string, unknown>, inputs: Record<string, unknown> = {}): Promise<{ status: string; error?: string }> {
  const res = await fetch(`${API_URL}/test/node`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nodeType, config: { type: nodeType, ...config }, inputs }),
  });
  const data = await res.json() as Record<string, unknown>;
  return { status: data.status as string ?? (res.ok ? 'success' : 'error'), error: data.error as string };
}

const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const RED   = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN  = '\x1b[36m';
const BOLD  = '\x1b[1m';

async function main() {
  const hoconFiles = fs.readdirSync('tests').filter(f => f.endsWith('.hocon'));

  let totalPassed = 0, totalFailed = 0, totalSkipped = 0;
  const failedNodes: Array<{ file: string; node: string; error: string }> = [];

  for (const file of hoconFiles) {
    const content = fs.readFileSync(path.join('tests', file), 'utf-8');
    process.stdout.write(`\n${BOLD}${CYAN}── ${file}${RESET}\n`);

    const plan = await importPlan(content);
    if (!plan) { console.log(`  ${RED}✘ Import failed${RESET}`); totalFailed++; continue; }

    console.log(`  Imported: "${plan.name}" — ${plan.nodes.length} nodes`);

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
        const result = await runNode(node.type, node.config ?? {}, {});
        if (result.status === 'success' || result.status === 'passed') {
          console.log(`  ${GREEN}✔ ${label}${RESET}`);
          totalPassed++;
        } else {
          const errMsg = result.error ?? result.status ?? 'unknown';
          console.log(`  ${RED}✘ ${label}${RESET}`);
          console.log(`      ${errMsg.slice(0, 120)}`);
          totalFailed++;
          failedNodes.push({ file, node: label, error: errMsg });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.log(`  ${RED}✘ ${label}${RESET} (exception: ${msg.slice(0, 80)})`);
        totalFailed++;
        failedNodes.push({ file, node: label, error: msg });
      }
    }
  }

  console.log(`\n${'═'.repeat(72)}`);
  console.log(`${BOLD}Results:  ${GREEN}${totalPassed} passed${RESET}  ${RED}${totalFailed} failed${RESET}  ${YELLOW}${totalSkipped} skipped (requires infra)${RESET}`);

  if (failedNodes.length > 0) {
    console.log(`\n${BOLD}Failures:${RESET}`);
    for (const f of failedNodes) {
      console.log(`  ${f.file} / ${f.node}`);
      console.log(`    → ${f.error.slice(0, 150)}`);
    }
  }

  process.exit(totalFailed > 0 ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });
