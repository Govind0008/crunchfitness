@echo off
title Crunch access reader - setup
cd /d "%~dp0"
echo Installing the reader (needs internet, about a minute)...
python -m pip install --upgrade pip >nul
python -m pip install -r requirements.txt
if errorlevel 1 (
  echo.
  echo Setup failed. Is Python installed with "Add python.exe to PATH" ticked?
  pause
  exit /b 1
)
if not exist config.json copy config.example.json config.json >nul
if not exist serviceAccount.json (
  echo.
  echo Almost done: put the Firebase key file here as serviceAccount.json
  echo   %~dp0serviceAccount.json
)
echo.
echo Setup finished. Next: double-click 2-test.bat
pause
