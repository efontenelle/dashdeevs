@echo off
setlocal
set PORT=8080

cd /d "%~dp0"

where python >nul 2>&1
if %ERRORLEVEL%==0 (
  set CMD=python -m http.server %PORT%
  goto :run
)

where py >nul 2>&1
if %ERRORLEVEL%==0 (
  set CMD=py -3 -m http.server %PORT%
  goto :run
)

where npx >nul 2>&1
if %ERRORLEVEL%==0 (
  set CMD=npx --yes serve -l %PORT% .
  goto :run
)

echo Nao foi possivel encontrar Python nem Node.js (npx).
echo Instale um dos dois e tente novamente:
echo   - Python: https://www.python.org/downloads/
echo   - Node.js: https://nodejs.org/
exit /b 1

:run
echo Servindo em http://localhost:%PORT%
start "" http://localhost:%PORT%/index.html
%CMD%
