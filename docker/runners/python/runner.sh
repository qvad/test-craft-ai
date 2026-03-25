#!/bin/bash
set -e

# Python Runner Script for TestCraft AI
# Fetches global variables from the GlobalVarsService before execution,
# exposes them to user code as a `tc_vars` dict (available as a global),
# and pushes any returned dict back as extractedValues after execution.

CODE_FILE="${CODE_DIR}/main.py"
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

# ── 2. Wrapper: inject tc_vars, run user code, capture return value ───────────
cat > "${CODE_DIR}/_tc_wrapper.py" << 'PYEOF'
import json, sys, os, importlib.util, builtins

_vars_file = os.path.join(os.path.dirname(__file__), '_tc_vars.json')
try:
    with open(_vars_file) as _f:
        tc_vars = json.load(_f)
except Exception:
    tc_vars = {}

# Make tc_vars a built-in so any user file can reference it without importing
builtins.tc_vars = tc_vars  # type: ignore[attr-defined]

_user_file = os.path.join(os.path.dirname(__file__), 'main.py')
_spec = importlib.util.spec_from_file_location('user_code', _user_file)
_mod = importlib.util.module_from_spec(_spec)
_mod.tc_vars = tc_vars  # also available as module attribute
_spec.loader.exec_module(_mod)

# Capture extracted values if user code sets `result = {...}`
_result = getattr(_mod, 'result', None)
_out_file = os.path.join(os.environ.get('OUTPUT_DIR', '/app/output'), '_tc_extracted.json')
os.makedirs(os.path.dirname(_out_file), exist_ok=True)
if isinstance(_result, dict):
    with open(_out_file, 'w') as _f:
        json.dump(_result, _f)
PYEOF

echo "Executing Python code..."

cd "$CODE_DIR"
START_TIME=$(($(date +%s) * 1000))

OUTPUT=$(timeout ${TIMEOUT:-60} python "${CODE_DIR}/_tc_wrapper.py" 2>&1) || EXIT_CODE=$?

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
    "language": "python",
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
