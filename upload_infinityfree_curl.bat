@echo off
title Deploy to InfinityFree FTP (via Curl)
cd /d "%~dp0"

echo ==============================================
echo   Deploying to InfinityFree (via Curl)
echo ==============================================
echo.

set "FTP_URL=ftp://ftpupload.net/yniemdienanh.gt.tc/htdocs"
set "FTP_USER=if0_42342185"
set "FTP_PASS=GB9eMqPMra3MCO1"

echo [1/3] Uploading index.html...
curl -T "index.html" --ftp-create-dirs -u "%FTP_USER%:%FTP_PASS%" "%FTP_URL%/index.html"
if %errorlevel% neq 0 goto error

echo [2/3] Uploading Logo/avtar.png...
curl -T "Logo/avtar.png" --ftp-create-dirs -u "%FTP_USER%:%FTP_PASS%" "%FTP_URL%/Logo/avtar.png"
if %errorlevel% neq 0 goto error

echo [3/3] Uploading Logo/logo ngang.png...
curl -T "Logo/logo ngang.png" --ftp-create-dirs -u "%FTP_USER%:%FTP_PASS%" "%FTP_URL%/Logo/logo ngang.png"
if %errorlevel% neq 0 goto error

echo.
echo ==============================================
echo   Deploy successful to InfinityFree!
echo   URL: http://yniemdienanh.gt.tc
echo ==============================================
pause
exit /b 0

:error
echo.
echo [ERROR] Deployment failed!
pause
exit /b 1
