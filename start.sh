#!/usr/bin/env bash
set -e

PORT=8080
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js nao encontrado."
  echo "Instale em https://nodejs.org/ e tente novamente."
  exit 1
fi

URL="http://localhost:$PORT/index.html"
echo "Servindo em $URL"

if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$URL" >/dev/null 2>&1 &
elif command -v open >/dev/null 2>&1; then
  open "$URL" >/dev/null 2>&1 &
fi

PORT="$PORT" exec node server.js
