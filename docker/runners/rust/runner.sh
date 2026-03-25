#!/bin/bash
set -e

# Rust Runner Script for TestCraft AI
CODE_FILE="${CODE_DIR}/main.rs"
OUTPUT_FILE="${OUTPUT_DIR}/result.json"

# Read code from stdin if no file provided
if [ ! -f "$CODE_FILE" ]; then
    echo "Reading code from stdin..."
    mkdir -p "$CODE_DIR"
    cat > "$CODE_FILE"
fi

# Step 1: Fetch global vars from GlobalVarsService
mkdir -p "$CODE_DIR" "$OUTPUT_DIR"
if [ -n "$TESTCRAFT_API_URL" ] && [ -n "$TESTCRAFT_EXECUTION_ID" ]; then
    VARS_JSON=$(curl -sf --max-time 5 \
        "${TESTCRAFT_API_URL}/vars/${TESTCRAFT_EXECUTION_ID}" 2>/dev/null || echo '{}')
else
    VARS_JSON='{}'
fi
echo "$VARS_JSON" > "${CODE_DIR}/_tc_vars.json"
export TC_VARS_FILE="${CODE_DIR}/_tc_vars.json"
EXTRACTED_FILE="${OUTPUT_DIR}/_tc_extracted.json"

echo "Building and executing Rust code..."

cd "$CODE_DIR"

# Create Cargo project if not exists
if [ ! -f "Cargo.toml" ]; then
    mkdir -p src
    mv "$CODE_FILE" src/main.rs
    cp /app/template/Cargo.toml .
fi

START_TIME=$(($(date +%s) * 1000))

# Build and run
if cargo build --release 2>&1; then
    BINARY=$(find target/release -maxdepth 1 -type f -executable | head -1)
    OUTPUT=$(timeout ${TIMEOUT:-60} "$BINARY" 2>&1) || EXIT_CODE=$?
else
    OUTPUT="Build failed"
    EXIT_CODE=1
fi

END_TIME=$(($(date +%s) * 1000))
DURATION=$(( END_TIME - START_TIME ))

# Step 3: Push extracted values back to GlobalVarsService
if [ -f "$EXTRACTED_FILE" ] && [ -n "$TESTCRAFT_API_URL" ] && [ -n "$TESTCRAFT_EXECUTION_ID" ]; then
    curl -sf --max-time 5 \
        -X POST \
        -H 'Content-Type: application/json' \
        -d "@${EXTRACTED_FILE}" \
        "${TESTCRAFT_API_URL}/vars/${TESTCRAFT_EXECUTION_ID}" > /dev/null 2>&1 || true
fi

EXTRACTED_VALUES='null'
if [ -f "$EXTRACTED_FILE" ]; then
    EXTRACTED_VALUES=$(cat "$EXTRACTED_FILE")
fi

# Write result
mkdir -p "$OUTPUT_DIR"
cat > "$OUTPUT_FILE" << EOF
{
    "status": "${EXIT_CODE:-0}",
    "language": "rust",
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
