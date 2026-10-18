@echo off
setlocal
cd /d "%~dp0"
echo Starting MyCut Review Preview...
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -STA -ExecutionPolicy Bypass -File "%~dp0MyCut.ps1" 2> "%~dp0mycut-console.log"
if errorlevel 1 (
  echo.
  echo MyCut could not start. See mycut-startup.log or mycut-console.log.
  type "%~dp0mycut-console.log"
  pause
)
