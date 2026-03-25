#!/bin/bash
set -e

# JavaScript Runner Script for TestCraft AI
# Fetches global variables from the GlobalVarsService before execution,
# exposes them to user code as `tc.vars` (and `globalThis.tc_vars`),
# and pushes any exported object back as extractedValues after execution.

CODE_FILE="${CODE_DIR}/main.js"
OUTPUT_FILE="${OUTPUT_DIR}/result.json"
VARS_FILE="${CODE_DIR}/_tc_vars.json"
EXTRACTED_FILE="${OUTPUT_DIR}/_tc_extracted.json"

# Read code from stdin if no file provided
if [ ! -f "$CODE_FILE" ]; then
    mkdir -p "$CODE_DIR"
    cat > "$CODE_FILE"
fi

# ── 1. Fetch global variables from the GlobalVarsService ─────────────────────
mkdir -p "$CODE_DIR" "$OUTPUT_DIR"
if [ -n "$TESTCRAFT_API_URL" ] && [ -n "$TESTCRAFT_EXECUTION_ID" ]; then
    VARS_JSON=$(curl -sf --max-time 5 \
        "${TESTCRAFT_API_URL}/vars/${TESTCRAFT_EXECUTION_ID}" 2>/dev/null || echo '{}')
else
    VARS_JSON='{}'
fi
echo "$VARS_JSON" > "$VARS_FILE"

# ── 2. Write a wrapper that injects tc_vars and captures the return value ─────
cat > "${CODE_DIR}/_tc_wrapper.js" << 'JSEOF'
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const varsFile = path.join(__dirname, '_tc_vars.json');
let tc_vars = {};
try { tc_vars = JSON.parse(fs.readFileSync(varsFile, 'utf8')); } catch {}

// Expose as both tc_vars (plain) and tc.vars (namespaced)
const tc = { vars: tc_vars };

// Execute user code in a sandbox with tc_vars available
const userCode = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
const sandbox = { ...global, require, tc_vars, tc, module: { exports: {} }, console };
const script = new vm.Script(userCode, { filename: 'main.js' });
let result;
try {
    result = script.runInNewContext(sandbox);
} catch (e) {
    // If user code threw, re-throw so the runner captures non-zero exit
    throw e;
}

// Also check module.exports if the user did `module.exports = { ... }`
if (!result || typeof result !== 'object') {
    result = sandbox.module.exports;
}

const extractedFile = path.join(process.env.OUTPUT_DIR || '/app/output', '_tc_extracted.json');
if (result && typeof result === 'object' && !Array.isArray(result)) {
    fs.mkdirSync(path.dirname(extractedFile), { recursive: true });
    fs.writeFileSync(extractedFile, JSON.stringify(result));
}
JSEOF

echo "Executing JavaScript code..."

cd "$CODE_DIR"
START_TIME=$(($(date +%s) * 1000))

OUTPUT=$(timeout ${TIMEOUT:-60} node "${CODE_DIR}/_tc_wrapper.js" 2>&1) || EXIT_CODE=$?

END_TIME=$(($(date +%s) * 1000))
DURATION=$(( END_TIME - START_TIME ))

# ── 3. Push extractedValues back to the GlobalVarsService ────────────────────
if [ -f "$EXTRACTED_FILE" ] && [ -n "$TESTCRAFT_API_URL" ] && [ -n "$TESTCRAFT_EXECUTION_ID" ]; then
    curl -sf --max-time 5 \
        -X POST \
        -H 'Content-Type: application/json' \
        -d "@${EXTRACTED_FILE}" \
        "${TESTCRAFT_API_URL}/vars/${TESTCRAFT_EXECUTION_ID}" > /dev/null 2>&1 || true
fi

# ── 4. Write structured result ───────────────────────────────────────────────
EXTRACTED_VALUES='null'
if [ -f "$EXTRACTED_FILE" ]; then
    EXTRACTED_VALUES=$(cat "$EXTRACTED_FILE")
fi

mkdir -p "$OUTPUT_DIR"
cat > "$OUTPUT_FILE" << EOF
{
    "status": "${EXIT_CODE:-0}",
    "language": "javascript",
    "duration_ms": $DURATION,
    "output": $(echo "$OUTPUT" | jq -Rs .),
    "exit_code": ${EXIT_CODE:-0},
    "extracted_values": ${EXTRACTED_VALUES}
}
EOF

cat "$OUTPUT_FILE"

if [ "${EXIT_CODE:-0}" != "0" ]; then
    exit 1
fi
