@echo off
setlocal
title Bismuth Visualizer
cd /d "%~dp0"

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0review.ps1" %*
set "exitCode=%ERRORLEVEL%"

if not "%exitCode%"=="0" (
    echo.
    echo The Bismuth review launcher stopped with error code %exitCode%.
    pause
)

exit /b %exitCode%
