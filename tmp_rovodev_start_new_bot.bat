@echo off
echo ================================================
echo   Starting Momoify#3255 (NEW BOT)
echo ================================================
echo.

echo [1/2] Killing any running PM2 processes...
pm2 kill
timeout /t 2 /nobreak >nul

echo.
echo [2/2] Starting bot with fresh environment...
pm2 start src/index.js --name momoify-bot
timeout /t 3 /nobreak >nul

echo.
echo ================================================
pm2 list
echo.
echo Bot started! Check Discord to see if Momoify#3255 is online.
echo.
echo Press any key to view logs...
pause >nul
pm2 logs momoify-bot --lines 30
