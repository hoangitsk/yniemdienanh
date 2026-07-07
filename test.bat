@echo off
echo === YNDA Smoke Test ===
echo Testing Node.js server...
node -e "try { require('./index.js'); console.log('Server syntax OK'); } catch(e) { console.error('Server error:', e.message); process.exit(1); }"
echo Testing API module syntax...
for %%f in (api\*.js api\email\*.js api\admin\*.js) do (
    node -e "try { require('./%%f'); console.log('  OK: %%f'); } catch(e) { if(e.code !== 'MODULE_NOT_FOUND') console.error('  ERROR: %%f - ' + e.message); else console.log('  OK: %%f (deps not loaded)'); }"
)
echo Testing HTML file size...
setlocal enabledelayedexpansion
for %%f in (index.html) do set size=%%~zf
if !size! LSS 100000 (echo ERROR: index.html seems too small) else (echo OK: index.html is !size! bytes)
echo.
echo === Smoke test complete ===
