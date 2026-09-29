@echo off
title Crunch access reader - start automatically
cd /d "%~dp0"
schtasks /Create /TN "Crunch Access Reader" /TR "cmd /c start \"\" /min \"%~dp0run-reader.bat\"" /SC ONLOGON /RL LIMITED /F
if errorlevel 1 (
  echo Could not create the startup task. Right-click this file and choose "Run as administrator".
  pause
  exit /b 1
)
echo The reader will now start by itself whenever this PC is logged in.
echo Starting it now (a minimised window called "Crunch access reader" - leave it open).
start "" /min "%~dp0run-reader.bat"
pause
