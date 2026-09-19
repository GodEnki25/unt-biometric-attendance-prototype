#!/bin/bash

set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

EXPO_PID=""

cleanup() {
    echo
    echo "====================================="
    echo " Stopping Expo"
    echo "====================================="

    if [ -n "$EXPO_PID" ]; then
        kill "$EXPO_PID" 2>/dev/null || true
    fi

    echo
    echo "Expo stopped."
    echo "Backend remains running on vision."
    echo
    exit 0
}

trap cleanup INT TERM

echo "====================================="
echo " UNT Biometric Attendance - Dev Start"
echo "====================================="
echo

echo "Backend:"
echo "  https://vision.tail26a817.ts.net"
echo

echo "Starting Expo..."

cd "$ROOT/react_demo/reactDemo"

npx expo start --tunnel &

EXPO_PID=$!

echo
echo "====================================="
echo " Development frontend started"
echo "====================================="
echo
echo "Expo:"
echo "  Running with tunnel mode"
echo
echo "Backend:"
echo "  https://vision.tail26a817.ts.net"
echo
echo "Press Ctrl+C to stop Expo."
echo
echo "====================================="
echo

wait