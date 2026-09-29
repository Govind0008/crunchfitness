@echo off
title Crunch access reader - test
cd /d "%~dp0"
echo Reading the device once and sending it to the CRM...
echo (the first run also uploads the scan history - give it a minute)
echo.
python crunch_reader.py --once
echo.
echo If you see "recorded ... scan(s)" above, it works. Check the CRM:
echo   Settings - Access control - the device should say Online.
echo Next: double-click 3-start-automatically.bat
pause
