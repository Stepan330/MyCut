@echo off
cd /d "%~dp0"
if not exist "next\target\debug\mycut-next.exe" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\Build-Rust.ps1" -Test
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
start "" "%~dp0next\target\debug\mycut-next.exe"
