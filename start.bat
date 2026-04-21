@echo off
setlocal
set PORT=8080

cd /d "%~dp0"

where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo Node.js nao encontrado.
  echo Instale em https://nodejs.org/ e tente novamente.
  exit /b 1
)

echo Servindo em http://localhost:%PORT%
start "" http://localhost:%PORT%/index.html
node server.js
