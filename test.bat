@echo off
setlocal EnableExtensions EnableDelayedExpansion
set "FAILED=0"

echo === YNDA Smoke Test ===
echo Testing Node.js server...
node -e "try { require('./index.js'); console.log('Server load OK'); } catch(e) { console.error('Server error:', e.message); process.exit(1); }"
if errorlevel 1 set "FAILED=1"

echo Testing API module syntax...
rem Use node --check instead of require/eval so Windows path separators cannot
rem be interpreted as JavaScript escape sequences and missing runtime secrets do
rem not hide syntax errors. Scan every nested API module.
for /r api %%f in (*.js) do (
    node --check "%%f" >nul 2>&1
    if errorlevel 1 (
        echo   ERROR: %%f
        node --check "%%f"
        set "FAILED=1"
    ) else (
        echo   OK: %%f
    )
)

echo Testing HTML file size...
for %%f in (index.html) do set "size=%%~zf"
if !size! LSS 100000 (
    echo ERROR: index.html seems too small
    set "FAILED=1"
) else (
    echo OK: index.html is !size! bytes
)

echo.
if !FAILED! NEQ 0 (
    echo === Smoke test FAILED ===
    exit /b 1
) else (
    echo === Smoke test complete ===
    exit /b 0
)
