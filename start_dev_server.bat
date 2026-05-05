@echo off
setlocal

cd /d "%~dp0Marinara-Engine"
set LOG_LEVEL=debug
pnpm dev:server
