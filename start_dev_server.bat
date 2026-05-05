@echo off
setlocal

cd /d "%~dp0Marinara-Engine"
set LOG_LEVEL=debug

where pnpm >nul 2>nul
if %ERRORLEVEL% equ 0 (
  set "MARINARA_PNPM=pnpm"
) else (
  set "MARINARA_PNPM=corepack pnpm"
)

call %MARINARA_PNPM% dev:server
