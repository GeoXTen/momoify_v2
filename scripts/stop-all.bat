@echo off
REM Stop all PM2 processes (Lavalink + Bot)

echo.
echo Stopping all processes...
echo.

pm2 stop all
pm2 delete all
pm2 save

echo.
echo ✓ All processes stopped and removed
echo.
pause
