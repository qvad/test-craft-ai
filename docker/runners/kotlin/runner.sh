#!/bin/bash
set -e

# Kotlin Runner Script for TestCraft AI
CODE_FILE="${CODE_DIR}/Main.kt"
OUTPUT_FILE="${OUTPUT_DIR}/result.json"

# Read code from stdin if no file provided
if [ ! -f "$CODE_FILE" ]; then
    echo "Reading code from stdin..."
    mkdir -p "$CODE_DIR"
    cat > "$CODE_FILE"
fi

echo "Compiling Kotlin code..."

CLASSPATH="/app/libs/*:."
cd "$CODE_DIR"

# Compile Kotlin code
JAR_FILE="main.jar"
if kotlinc "$CODE_FILE" -include-runtime -d "$JAR_FILE" 2>&1; then
    echo "Compilation successful"

    START_TIME=$(($(date +%s) * 1000))

    # Execute the compiled jar
    OUTPUT=$(timeout ${TIMEOUT:-60} java $JAVA_OPTS -cp "$CLASSPATH:$JAR_FILE" MainKt 2>&1) || EXIT_CODE=$?

    END_TIME=$(($(date +%s) * 1000))
    DURATION=$(( END_TIME - START_TIME ))

    # Write result
    mkdir -p "$OUTPUT_DIR"
    cat > "$OUTPUT_FILE" << EOF
{
    "status": "${EXIT_CODE:-0}",
    "language": "kotlin",
    "duration_ms": $DURATION,
    "output": $(echo "$OUTPUT" | jq -Rs .),
    "exit_code": ${EXIT_CODE:-0}
}
EOF

    cat "$OUTPUT_FILE"
else
    echo "Compilation failed"
    mkdir -p "$OUTPUT_DIR"
    cat > "$OUTPUT_FILE" << EOF
{
    "status": "error",
    "language": "kotlin",
    "error": "compilation_failed",
    "output": "Compilation failed",
    "exit_code": 1
}
EOF
    cat "$OUTPUT_FILE"
    exit 1
fi

if [ "${EXIT_CODE:-0}" != "0" ]; then
    exit 1
fi
