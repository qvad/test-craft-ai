#!/bin/bash
set -e

# Go Runner Script for TestCraft AI
CODE_FILE="${CODE_DIR}/main.go"
OUTPUT_FILE="${OUTPUT_DIR}/result.json"

# Read code from stdin if no file provided
if [ ! -f "$CODE_FILE" ]; then
    echo "Reading code from stdin..."
    mkdir -p "$CODE_DIR"
    cat > "$CODE_FILE"
fi

echo "Building and executing Go code..."

cd "$CODE_DIR"

# Initialize go module if not exists
if [ ! -f "go.mod" ]; then
    go mod init testcraft/runner
fi

# Download dependencies
go mod tidy 2>/dev/null || true

START_TIME=$(($(date +%s) * 1000))

# Build and run
if go build -o ./runner "$CODE_FILE" 2>&1; then
    OUTPUT=$(timeout ${TIMEOUT:-60} ./runner 2>&1) || EXIT_CODE=$?
else
    OUTPUT="Build failed"
    EXIT_CODE=1
fi

END_TIME=$(($(date +%s) * 1000))
DURATION=$(( END_TIME - START_TIME ))

# Write result
mkdir -p "$OUTPUT_DIR"
cat > "$OUTPUT_FILE" << EOF
{
    "status": "${EXIT_CODE:-0}",
    "language": "go",
    "duration_ms": $DURATION,
    "output": $(echo "$OUTPUT" | jq -Rs .),
    "exit_code": ${EXIT_CODE:-0}
}
EOF

cat "$OUTPUT_FILE"

if [ "${EXIT_CODE:-0}" != "0" ]; then
    exit 1
fi
