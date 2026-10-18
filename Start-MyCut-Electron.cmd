@echo off
setlocal
set "ELECTRON_RUN_AS_NODE="
cd /d "%~dp0electron-study"
where node >nul 2>nul
if errorlevel 1 set "PATH=C:\Users\Admin\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;%PATH%"
node scripts/build.mjs
if errorlevel 1 goto failed
start "MyCut Electron UI study" "node_modules\electron\dist\electron.exe" "%~dp0electron-study\main.cjs"
exit /b
:failed
echo Build failed. See electron-study\README.md for installation instructions.
pause
