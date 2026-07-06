@echo off
setlocal

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-build-server.ps1"
set "EXIT_CODE=%ERRORLEVEL%"

exit /b %EXIT_CODE%
