@echo off
title Deploy to InfinityFree FTP
cd /d "%~dp0"

echo FTP deploy reads YNDA_FTP_* secrets from the environment.
if "%YNDA_FTP_USER%"=="" (
  echo [ERROR] YNDA_FTP_USER is not set.
  exit /b 1
)
if "%YNDA_FTP_PASS%"=="" (
  echo [ERROR] YNDA_FTP_PASS is not set.
  exit /b 1
)

python upload_infinityfree.py
if %errorlevel% neq 0 exit /b %errorlevel%
exit /b 0
