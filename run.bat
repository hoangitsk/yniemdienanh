@echo off
title Y Niem Dien Anh (Local Dev)
cd /d "%~dp0"

echo [1/2] Checking and installing Node.js dependencies...
call npm install

echo.
echo [2/2] Starting Node.js server...
call npm run dev
pause
