@echo off
REM Start Local Lavalink Server on Windows

cd /d "%~dp0\..\lavalink"

echo.
echo Starting Lavalink server...
echo.

REM Check if Lavalink.jar exists
if not exist "Lavalink.jar" (
    echo X Lavalink.jar not found!
    echo.
    echo Please download Lavalink.jar from:
    echo https://github.com/lavalink-devs/Lavalink/releases/latest
    echo.
    echo Place it in the 'lavalink' folder
    echo.
    pause
    exit /b 1
)

REM Check if Java is installed
where java >nul 2>&1
if %errorlevel% neq 0 (
    echo X Java is not installed!
    echo.
    echo Please install Java 17 or higher from:
    echo https://adoptium.net/
    echo.
    pause
    exit /b 1
)

echo Java version:
java -version
echo.

REM Start with PM2
cd ..
pm2 start "java -jar Lavalink.jar" --name lavalink --cwd "%cd%\lavalink"
pm2 save

echo.
echo ✓ Lavalink started!
echo.
echo View logs: pm2 logs lavalink
echo Stop: pm2 stop lavalink
echo.
pause
