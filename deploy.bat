@echo off
title Deploy Y Niem Dien Anh

echo ============================================
echo   Deploy Y Niem Dien Anh - GitHub + Vercel
echo ============================================
echo.

cd /d "%~dp0"

set commit_msg=%1
if "%commit_msg%"=="" (
    set "dt=%date:/=-%"
    set "tm=%time::=-%"
    set commit_msg=Update %dt% %tm%
)

echo [1/3] Git add...
git add -A
if %errorlevel% neq 0 ( echo FAIL: git add failed & pause & exit /b 1 )

echo [2/3] Git commit...
git commit -m "%commit_msg%"
if %errorlevel% neq 0 if %errorlevel% neq 1 ( echo FAIL: git commit failed & pause & exit /b 1 )

echo [3/3] Push to GitHub...
git push origin main
if %errorlevel% neq 0 ( echo FAIL: push to GitHub failed & pause & exit /b 1 )

echo.
echo ============================================
echo   Push len GitHub thanh cong!
echo   Vercel se tu dong deploy tu repo nay.
echo   GitHub: https://github.com/hoangitsk/yniemdienanh
echo ============================================
pause
