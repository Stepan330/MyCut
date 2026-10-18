@echo off
setlocal
cd /d "%~dp0"
for /f "usebackq delims=" %%I in (`powershell -NoProfile -Command "$p=Get-Process -Name Resolve -ErrorAction SilentlyContinue ^| Select-Object -First 1 -ExpandProperty Path; if($p){Split-Path -LiteralPath $p}"`) do set "RESOLVE_INSTALL_DIR=%%I"
if defined RESOLVE_INSTALL_DIR set "RESOLVE_SCRIPT_LIB=%RESOLVE_INSTALL_DIR%\fusionscript.dll"
set "RESOLVE_SCRIPT_API=%PROGRAMDATA%\Blackmagic Design\DaVinci Resolve\Support\Developer\Scripting"
set "PYTHONPATH=%RESOLVE_SCRIPT_API%\Modules;%PYTHONPATH%"
python -X utf8 -X faulthandler app.py 1>"%~dp0last-run.log" 2>&1
if errorlevel 1 (
  echo Приложение завершилось аварийно. Журнал: "%~dp0last-run.log"
  pause
)
