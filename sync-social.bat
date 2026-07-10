@echo off
echo ========================================
echo D?ng b? b�i dang t? MXH v? website
echo ========================================
echo.
echo Yeu cau: Chay Node.js server truoc (npm start)
echo.
echo Cach dung:
echo   sync-social              - Dong bo tat ca
echo   sync-social youtube       - Chi YouTube
echo   sync-social instagram     - Chi Instagram
echo   sync-social tiktok        - Chi TikTok
echo.
echo Dang g?i API d?ng b?...
echo.

if "%1"=="" (
    curl -s -X POST http://localhost:24687/api/sync/trigger -H "Content-Type: application/json" -d "{}" | python -c "import sys,json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"
) else (
    curl -s -X POST http://localhost:24687/api/sync/trigger -H "Content-Type: application/json" -d "{\"platforms\":[\"%1\"]}" | python -c "import sys,json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"
)

echo.
if %errorlevel% equ 0 (
    echo ✓ Hoan thanh!
) else (
    echo ? That bai. Hay chac chan server dang chay (npm start)
)
pause