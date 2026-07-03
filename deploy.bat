@echo off
chcp 65001 >nul
title Deploy Ý Niệm Điện Ảnh

echo ============================================
echo   Deploy Ý Niệm Điện Ảnh - GitHub + HuggingFace
echo ============================================
echo.

cd /d "%~dp0"

set commit_msg=%1
if "%commit_msg%"=="" set commit_msg=Update %date% %time%

echo [1/4] Git add...
git add -A
if %errorlevel% neq 0 ( echo Loi: git add that bai & pause & exit /b 1 )

echo [2/4] Git commit...
git commit -m "%commit_msg%"
if %errorlevel% neq 0 if %errorlevel% neq 1 ( echo Loi: git commit that bai & pause & exit /b 1 )

echo [3/4] Push to GitHub...
git push origin main
if %errorlevel% neq 0 ( echo Loi: push GitHub that bai & pause & exit /b 1 )

echo [4/4] Push to HuggingFace...
git push hf main
if %errorlevel% neq 0 ( echo Loi: push HuggingFace that bai & pause & exit /b 1 )

echo.
echo ============================================
echo   ✅ Deploy thanh cong!
echo   GitHub: https://github.com/hoangitsk/yniemdienanh
echo   HF:     https://huggingface.co/spaces/Harlanitsk/yniemdienanh
echo ============================================
pause
