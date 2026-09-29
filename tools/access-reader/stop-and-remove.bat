@echo off
title Crunch access reader - stop
schtasks /Delete /TN "Crunch Access Reader" /F
taskkill /FI "WINDOWTITLE eq Crunch access reader*" /T /F >nul 2>&1
echo The reader is stopped and will no longer start automatically.
pause
