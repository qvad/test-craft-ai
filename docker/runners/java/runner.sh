#!/bin/bash
set -e

# Java Runner Script for TestCraft AI
# Accepts code via stdin or file, compiles and executes it

CODE_FILE="${CODE_DIR}/Main.java"
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

# Extract class name from the code
CLASS_NAME=$(grep -oP 'public\s+class\s+\K\w+' "$CODE_FILE" | head -1)
if [ -z "$CLASS_NAME" ]; then
    CLASS_NAME="Main"
fi

# Rename file to match class name
if [ "$CLASS_NAME" != "Main" ]; then
    mv "$CODE_FILE" "${CODE_DIR}/${CLASS_NAME}.java"
    CODE_FILE="${CODE_DIR}/${CLASS_NAME}.java"
fi

echo "Compiling ${CLASS_NAME}.java..."

# Compile the code
CLASSPATH="/app/libs/*:."
cd "$CODE_DIR"

if javac -cp "$CLASSPATH" -d . "$CODE_FILE" 2>&1; then
    echo "Compilation successful"

    # Execute the code
    echo "Executing ${CLASS_NAME}..."
    START_TIME=$(($(date +%s) * 1000))

    # Run with timeout and capture output
    OUTPUT=$(timeout ${TIMEOUT:-60} java $JAVA_OPTS -cp "$CLASSPATH:." "$CLASS_NAME" 2>&1) || EXIT_CODE=$?

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
    "language": "java",
    "duration_ms": $DURATION,
    "output": $(echo "$OUTPUT" | jq -Rs .),
    "exit_code": ${EXIT_CODE:-0},
    "extracted_values": ${EXTRACTED_VALUES}
}
EOF

    cat "$OUTPUT_FILE"
else
    echo "Compilation failed"
    cat > "$OUTPUT_FILE" << EOF
{
    "status": "error",
    "language": "java",
    "error": "compilation_failed",
    "output": $(echo "$OUTPUT" | jq -Rs .),
    "exit_code": 1,
    "extracted_values": null
}
EOF
    cat "$OUTPUT_FILE"
    exit 1
fi
