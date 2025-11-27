@echo off
REM Switch to Local Lavalink Server
REM This script updates .env to use localhost Lavalink

echo.
echo Switching to Local Lavalink...
echo.

REM Backup current .env
copy .env .env.backup.%date:~-4,4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2% >nul 2>&1

REM Create new .env with local Lavalink settings
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

echo ✓ .env file updated for local Lavalink!
echo.
echo Current Lavalink Configuration:
findstr /B "LAVALINK" .env
echo.

REM Check if Lavalink is running
pm2 describe lavalink >nul 2>&1
if %errorlevel% equ 0 (
    echo ✓ Lavalink is already running
) else (
    echo ! Lavalink is not running
    echo   Start it with: npm run lavalink:start
)

echo.
set /p restart="Restart bot to apply changes? (y/n): "
if /i "%restart%"=="y" (
    echo.
    echo Restarting bot...
    pm2 restart all --update-env
    echo ✓ Bot restarted!
) else (
    echo.
    echo ! Remember to restart the bot manually:
    echo   pm2 restart all --update-env
)

echo.
pause
