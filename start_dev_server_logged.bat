@echo off
setlocal

:: Dev server launcher with log capture.
:: Override these before running if needed:
::   set LOG_LEVEL=info
::   set SERVER_LOG_FILE=logs\server-debug.log

if not defined LOG_LEVEL set LOG_LEVEL=debug
if not defined SERVER_LOG_FILE set SERVER_LOG_FILE=logs\server-debug.log

cd /d "%~dp0Marinara-Engine"

where pnpm >nul 2>nul
if %ERRORLEVEL% equ 0 (
  set "MARINARA_PNPM=pnpm"
) else (
  set "MARINARA_PNPM=corepack pnpm"
)

if not exist logs mkdir logs

echo.
echo  ==========================================
echo    Starting Marinara dev server with logging
echo    LOG_LEVEL=%LOG_LEVEL%
echo    Log file: %SERVER_LOG_FILE%
echo  ==========================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference = 'Stop'; cmd /d /s /c \"$env:MARINARA_PNPM dev:server\" 2>&1 | Tee-Object -FilePath $env:SERVER_LOG_FILE -Append; if ($LASTEXITCODE) { exit $LASTEXITCODE }"
set EXIT_CODE=%ERRORLEVEL%

echo.
echo  Server exited with code %EXIT_CODE%.
echo  Log file: %SERVER_LOG_FILE%
echo.
pause
exit /b %EXIT_CODE%
