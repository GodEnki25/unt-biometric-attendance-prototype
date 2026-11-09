#!/bin/bash

set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

cleanup() {
    echo
    echo "====================================="
    echo " Stopping Expo"
    echo "====================================="
    echo
    echo "Expo stopped."
    echo "Backend remains running on rasey."
    echo
    exit 0
}

trap cleanup INT TERM

echo "====================================="
echo " UNT Biometric Attendance - Dev Start"
echo "====================================="
echo

echo "Backend:"
echo "  https://rasey.tail26a817.ts.net"
echo

echo "Starting Expo..."
echo

cd "$ROOT/react_demo/reactDemo"

npx expo start --tunnel