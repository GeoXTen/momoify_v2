@echo off
echo ========================================
echo Stopping Bot and Lavalink
echo ========================================
echo.

echo [1/2] Stopping Discord Bot...
pm2 stop momoify-bot
pm2 delete momoify-bot

echo [2/2] Stopping Lavalink Server...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":2333"') do (
    echo Killing Lavalink process %%a
    taskkill /F /PID %%a
)

echo.
echo ========================================
echo All Services Stopped!
echo ========================================
pause
