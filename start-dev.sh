#!/bin/bash

set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

BACKEND_PID=""
EXPO_PID=""

cleanup() {
    echo
    echo "====================================="
    echo " Stopping development services"
    echo "====================================="

    if [ -n "$BACKEND_PID" ]; then
        kill "$BACKEND_PID" 2>/dev/null || true
    fi

    if [ -n "$EXPO_PID" ]; then
        kill "$EXPO_PID" 2>/dev/null || true
    fi

    echo
    echo "FastAPI and Expo stopped."
    echo "Tile38 will remain running in Docker."
    echo
    exit 0
}

trap cleanup INT TERM

echo "====================================="
echo " UNT Biometric Attendance - Dev Start"
echo "====================================="
echo

# =========================
# CHECK DOCKER DESKTOP
# =========================

echo "[1/3] Checking Docker Desktop..."

if ! docker info >/dev/null 2>&1; then
    echo
    echo "ERROR: Docker Desktop is not running or WSL cannot access it."
    echo
    echo "Start Docker Desktop in Windows and wait until it is fully running."
    echo "Then run:"
    echo
    echo "    ./start-dev.sh"
    echo
    exit 1
fi

echo "Docker is ready."

# =========================
# START TILE38
# =========================

echo
echo "[2/3] Starting Tile38..."

cd "$ROOT/backend"

docker compose up -d tile38

echo "Tile38 started."

# =========================
# START FASTAPI
# =========================

echo
echo "[3/3] Starting FastAPI and Expo..."
echo

cd "$ROOT"

if [ -f "$ROOT/backend/.venv/bin/python" ]; then

    "$ROOT/backend/.venv/bin/python" -m uvicorn backend.main:app \
        --host 0.0.0.0 \
        --port 8000 \
        --reload &

else

    echo "WARNING: backend/.venv/bin/python was not found."
    echo "Trying system python3 instead..."

    python3 -m uvicorn backend.main:app \
        --host 0.0.0.0 \
        --port 8000 \
        --reload &

fi

BACKEND_PID=$!

# Give FastAPI a moment to start
sleep 2

# =========================
# START EXPO
# =========================

cd "$ROOT/react_demo/reactDemo"

npx expo start --tunnel &

EXPO_PID=$!

# =========================
# STATUS
# =========================

echo
echo "====================================="
echo " Development services started"
echo "====================================="
echo
echo "Tile38:"
echo "  localhost:9851"
echo
echo "FastAPI:"
echo "  http://127.0.0.1:8000"
echo
echo "Swagger:"
echo "  http://127.0.0.1:8000/docs"
echo
echo "Expo:"
echo "  Running with tunnel mode"
echo
echo "Press Ctrl+C to stop FastAPI and Expo."
echo
echo "NOTE:"
echo "  Tile38 stays running in Docker after"
echo "  this script stops."
echo
echo "====================================="
echo

wait
