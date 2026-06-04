#!/usr/bin/env bash
# start.command - start local HTTP server and show local IP/QR
set -e
PORT=${1:-8000}
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

# discover local IP (best-effort)
LOCAL_IP="$(ip route get 1.1.1.1 2>/dev/null | awk '/src/ {print $7; exit}')"
if [ -z "$LOCAL_IP" ]; then
  LOCAL_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
fi

URL="http://$LOCAL_IP:$PORT/"

echo "Starting simple HTTP server at: $URL"

echo "If you want to open from another device on the same Wi-Fi, scan the QR or open the URL manually."

# Print QR code if qrencode is installed
if command -v qrencode >/dev/null 2>&1; then
  echo "QR (scan with phone):"
  qrencode -t ANSIUTF8 "$URL"
fi

# Start server in background and print PID
if command -v python3 >/dev/null 2>&1; then
  nohup python3 -m http.server "$PORT" >/dev/null 2>&1 &
  PID=$!
  echo "HTTP server launched (PID: $PID)."
  echo "Press Ctrl-C to stop this script; the server will continue running."
else
  echo "python3 not found. Please run: python3 -m http.server $PORT"
fi

# Print local files summary
echo
ls -la | sed -n '1,60p'

# Keep script running so user sees output (exit will leave server running)
sleep 1
exit 0
