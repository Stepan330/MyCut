@echo off
cd /d "%~dp0"
if not exist "out\MyCut-inline-text\MyCut.exe" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\Build.ps1" -Test -OutputDirectory out/MyCut-inline-text
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
start "" "%~dp0out\MyCut-inline-text\MyCut.exe"
