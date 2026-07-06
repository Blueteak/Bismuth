#!/usr/bin/env bash

set -u

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

HOST="127.0.0.1"
START_PORT=4173
END_PORT=4190
SERVER_PID=""

pause_before_exit() {
  if [[ -t 0 ]]; then
    echo
    read -r -p "Press Enter to close this window..." _
  fi
}

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]]; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

if command -v npm.cmd >/dev/null 2>&1; then
  NPM=(npm.cmd)
elif command -v npm >/dev/null 2>&1; then
  NPM=(npm)
else
  echo "Could not find npm. Install Node.js, then run this launcher again."
  pause_before_exit
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Could not find node. Install Node.js, then run this launcher again."
  pause_before_exit
  exit 1
fi

port_is_free() {
  node -e "
    const net = require('net');
    const port = Number(process.argv[1]);
    const host = process.argv[2];
    const server = net.createServer();
    server.once('error', () => process.exit(1));
    server.once('listening', () => server.close(() => process.exit(0)));
    server.listen(port, host);
  " "$1" "$HOST" >/dev/null 2>&1
}

wait_for_server() {
  local url="$1"

  for _ in {1..60}; do
    node -e "
      const http = require('http');
      const req = http.get(process.argv[1], (res) => {
        res.resume();
        process.exit(0);
      });
      req.setTimeout(500, () => {
        req.destroy();
        process.exit(1);
      });
      req.on('error', () => process.exit(1));
    " "$url" >/dev/null 2>&1 && return 0

    if ! kill -0 "$SERVER_PID" >/dev/null 2>&1; then
      return 1
    fi

    sleep 0.25
  done

  return 1
}

open_browser() {
  local url="$1"
  local os_name
  os_name="$(uname -s 2>/dev/null || echo unknown)"

  case "$os_name" in
    MINGW*|MSYS*|CYGWIN*)
      cmd.exe /c start "" "$url" >/dev/null 2>&1
      ;;
    Darwin*)
      open "$url" >/dev/null 2>&1 &
      ;;
    *)
      if command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$url" >/dev/null 2>&1 &
      else
        echo "Open this URL in your browser: $url"
      fi
      ;;
  esac
}

PORT=""
for candidate_port in $(seq "$START_PORT" "$END_PORT"); do
  if port_is_free "$candidate_port"; then
    PORT="$candidate_port"
    break
  fi
done

if [[ -z "$PORT" ]]; then
  echo "No available preview port found between $START_PORT and $END_PORT."
  pause_before_exit
  exit 1
fi

URL="http://$HOST:$PORT/"

echo "Building production bundle..."
if ! "${NPM[@]}" run build; then
  echo
  echo "Build failed."
  pause_before_exit
  exit 1
fi

echo
echo "Starting local build server at $URL"
"${NPM[@]}" run preview -- --port "$PORT" --strictPort &
SERVER_PID=$!

if wait_for_server "$URL"; then
  open_browser "$URL"
  echo "Browser opened. Leave this window open while using the app."
  echo "Press Ctrl+C here to stop the local server."
else
  echo "Preview server did not start successfully."
  wait "$SERVER_PID" 2>/dev/null || true
  pause_before_exit
  exit 1
fi

wait "$SERVER_PID"
SERVER_PID=""

echo
echo "Preview server stopped."
pause_before_exit
