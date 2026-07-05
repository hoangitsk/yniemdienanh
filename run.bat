@echo off
title Y Niem Dien Anh
cd /d "%~dp0"

echo [1/3] Installing Python dependencies...
pip install -r requirements.txt >nul 2>&1

echo [2/3] Installing Node.js dependencies...
if not exist node_modules npm install >nul 2>&1

echo [3/3] Starting Python backend + Node.js server...
start /B python -m uvicorn app:app --host 0.0.0.0 --port 8000 >nul 2>&1
npm run dev
pause
