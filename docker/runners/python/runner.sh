#!/bin/bash
set -e

# Python Runner Script for TestCraft AI
# Accepts code via stdin or file, executes it

CODE_FILE="${CODE_DIR}/main.py"
OUTPUT_FILE="${OUTPUT_DIR}/result.json"

# Read code from stdin if no file provided
if [ ! -f "$CODE_FILE" ]; then
    echo "Reading code from stdin..."
    mkdir -p "$CODE_DIR"
    cat > "$CODE_FILE"
fi

echo "Executing Python code..."

cd "$CODE_DIR"
START_TIME=$(($(date +%s) * 1000))

# Run with timeout and capture output
OUTPUT=$(timeout ${TIMEOUT:-60} python "$CODE_FILE" 2>&1) || EXIT_CODE=$?

END_TIME=$(($(date +%s) * 1000))
DURATION=$(( END_TIME - START_TIME ))

# Write result
mkdir -p "$OUTPUT_DIR"
cat > "$OUTPUT_FILE" << EOF
{
    "status": "${EXIT_CODE:-0}",
    "language": "python",
    "duration_ms": $DURATION,
    "output": $(echo "$OUTPUT" | jq -Rs .),
    "exit_code": ${EXIT_CODE:-0}
}
EOF

cat "$OUTPUT_FILE"

if [ "${EXIT_CODE:-0}" != "0" ]; then
    exit 1
fi
