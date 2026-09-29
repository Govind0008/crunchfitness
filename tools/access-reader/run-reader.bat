@echo off
title Crunch access reader
cd /d "%~dp0"
:loop
python crunch_reader.py
echo Reader stopped - restarting in 30 seconds...
timeout /t 30 /nobreak >nul
goto loop
