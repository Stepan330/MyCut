@echo off
cd /d "%~dp0"
python "%~dp0scripts\prompt_scheduler.py"
if errorlevel 1 pause
