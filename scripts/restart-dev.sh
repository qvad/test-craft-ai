#!/bin/bash
# Restart development servers

# Get the project root directory (parent of scripts/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "Stopping existing servers..."
pkill -f "ng serve" 2>/dev/null
pkill -f "tsx" 2>/dev/null
pkill -f "npx tsx" 2>/dev/null
sleep 2

echo "Starting Angular..."
cd "$PROJECT_ROOT"
npm run start:web > /tmp/angular.log 2>&1 &

echo "Starting Backend..."
cd "$PROJECT_ROOT/apps/api"
npx tsx src/main.ts > /tmp/backend.log 2>&1 &

echo "Waiting for servers to start..."
sleep 12

# Check status
ANGULAR=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4200/ 2>/dev/null)
BACKEND=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/v1/health 2>/dev/null)

echo ""
echo "=== Server Status ==="
if [ "$ANGULAR" = "200" ]; then
  echo "Angular:  http://localhost:4200/ ✓"
else
  echo "Angular:  FAILED (code: $ANGULAR)"
fi

if [ "$BACKEND" = "200" ]; then
  echo "Backend:  http://localhost:3000/ ✓"
else
  echo "Backend:  FAILED (code: $BACKEND)"
fi
echo "===================="
