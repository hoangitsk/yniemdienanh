@echo off
title Deploy to InfinityFree FTP
cd /d "%~dp0"

echo ==============================================
echo   Deploying to InfinityFree (yniemdienanh.gt.tc)
echo ==============================================
echo.

:: Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in your PATH.
    echo Please install Python to run this deploy script.
    pause
    exit /b 1
)

:: Run the python deployment script
python upload_infinityfree.py
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Deployment failed! Check the errors above.
    pause
    exit /b 1
)

echo.
pause
