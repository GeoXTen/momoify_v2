@echo off
REM Start Everything with PM2 (Lavalink + Bot)

echo.
echo ========================================
echo   Starting Local Lavalink + Bot
echo ========================================
echo.

REM Check Java
echo [1/5] Checking Java...
where java >nul 2>&1
if %errorlevel% neq 0 (
    echo X Java is NOT installed
    echo.
    echo Please install Java 17+ from: https://adoptium.net/
    pause
    exit /b 1
)
echo ✓ Java found
echo.

REM Check Lavalink.jar
echo [2/5] Checking Lavalink.jar...
if not exist "lavalink\Lavalink.jar" (
    echo X Lavalink.jar not found in lavalink folder
    echo.
    echo Downloading Lavalink v4.0.7...
    powershell -Command "Invoke-WebRequest -Uri 'https://github.com/lavalink-devs/Lavalink/releases/download/4.0.7/Lavalink.jar' -OutFile 'lavalink\Lavalink.jar'"
    if exist "lavalink\Lavalink.jar" (
        echo ✓ Download complete!
    ) else (
        echo X Download failed
        echo Please download manually from: https://github.com/lavalink-devs/Lavalink/releases
        pause
        exit /b 1
    )
) else (
    echo ✓ Lavalink.jar found
)
echo.

REM Update .env for local Lavalink
echo [3/5] Configuring for local Lavalink...
copy .env .env.backup.%date:~-4,4%%date:~-10,2%%date:~-7,2% >nul 2>&1

(
echo # Discord Bot Configuration
echo DISCORD_TOKEN=MTAzMzEzNzI5OTA0ODkwNjc1Mg.GuaXHP.CXpLWeiEohaR79DspeSBa-RwAdkRUdfpyTA2LI
echo CLIENT_ID=1033137299048906752
echo.
echo # Lavalink Configuration - LOCAL SERVER
echo LAVALINK_HOST=localhost
echo LAVALINK_PORT=2333
echo LAVALINK_PASSWORD=youshallnotpass
echo LAVALINK_SECURE=false
echo.
echo # Bot Settings
echo PREFIX=/
echo BOT_ACTIVITY=music
echo BOT_STATUS=online
echo OWNER_ID=572614372812390410
echo.
echo # Genius Lyrics API
echo GENIUS_CLIENT_ID=IWIdEVDcL0oD09rRVv3hCaWuRmRUdY7X2yXti8woy7zUWPq5Br8RR-qLzxzuqG7m
echo.
echo # API Settings
echo API_PORT=3001
) > .env

echo ✓ Configuration updated
echo.

REM Stop any existing processes
echo [4/5] Cleaning up old processes...
pm2 delete all >nul 2>&1
echo ✓ Ready to start fresh
echo.

REM Start everything with PM2
echo [5/5] Starting Lavalink and Bot...
echo.
echo Starting Lavalink server...
pm2 start "java -jar Lavalink.jar" --name lavalink --cwd "%cd%\lavalink"

echo Waiting for Lavalink to start (10 seconds)...
timeout /t 10 /nobreak >nul

echo Starting Discord bot...
pm2 start src\index.js --name momoify-bot --watch --max-memory-restart 500M

echo Saving PM2 process list...
pm2 save

echo.
echo ========================================
echo   Startup Complete!
echo ========================================
echo.
echo ✓ Lavalink: Running on localhost:2333
echo ✓ Bot: Running and ready
echo.
echo View processes: pm2 list
echo View all logs: pm2 logs
echo View bot logs: pm2 logs momoify-bot
echo View Lavalink logs: pm2 logs lavalink
echo.
echo Monitor: pm2 monit
echo Stop all: pm2 stop all
echo.
pause
