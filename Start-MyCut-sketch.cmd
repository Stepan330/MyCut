@echo off
cd /d "%~dp0"
if not exist "out\MyCut-sketch\MyCut.exe" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\Build.ps1" -Test -OutputDirectory out/MyCut-sketch
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
start "" "%~dp0out\MyCut-sketch\MyCut.exe"
