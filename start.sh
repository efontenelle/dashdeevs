#!/usr/bin/env bash
set -e

PORT=8080
cd "$(dirname "$0")"

if command -v python3 >/dev/null 2>&1; then
  CMD=(python3 -m http.server "$PORT")
elif command -v python >/dev/null 2>&1; then
  CMD=(python -m http.server "$PORT")
elif command -v npx >/dev/null 2>&1; then
  CMD=(npx --yes serve -l "$PORT" .)
else
  echo "Nao foi possivel encontrar Python nem Node.js (npx)."
  echo "Instale um dos dois e tente novamente:"
  echo "  - Python: https://www.python.org/downloads/"
  echo "  - Node.js: https://nodejs.org/"
  exit 1
fi

URL="http://localhost:$PORT/index.html"
echo "Servindo em $URL"

if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$URL" >/dev/null 2>&1 &
elif command -v open >/dev/null 2>&1; then
  open "$URL" >/dev/null 2>&1 &
fi

exec "${CMD[@]}"
