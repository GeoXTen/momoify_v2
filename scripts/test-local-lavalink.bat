@echo off
REM Complete Local Lavalink Test Script for Windows

echo.
echo ========================================
echo   Local Lavalink Setup Test
echo ========================================
echo.

REM Step 1: Check Java
echo [1/5] Checking Java installation...
where java >nul 2>&1
if %errorlevel% neq 0 (
    echo X Java is NOT installed
    echo.
    echo Please install Java 17 or higher from:
    echo https://adoptium.net/
    echo.
    pause
    exit /b 1
) else (
    echo ✓ Java is installed
    java -version 2>&1 | findstr /C:"version"
)
echo.

REM Step 2: Check Lavalink.jar
echo [2/5] Checking Lavalink.jar...
if not exist "lavalink\Lavalink.jar" (
    echo X Lavalink.jar not found
    echo.
    set /p download="Download Lavalink.jar now? (y/n): "
    if /i "!download!"=="y" (
        echo.
        echo Downloading Lavalink v4.0.7...
        powershell -Command "Invoke-WebRequest -Uri 'https://github.com/lavalink-devs/Lavalink/releases/download/4.0.7/Lavalink.jar' -OutFile 'lavalink\Lavalink.jar'"
        if exist "lavalink\Lavalink.jar" (
            echo ✓ Download complete!
        ) else (
            echo X Download failed
            pause
            exit /b 1
        )
    ) else (
        echo Please download manually from:
        echo https://github.com/lavalink-devs/Lavalink/releases/latest
        pause
        exit /b 1
    )
) else (
    echo ✓ Lavalink.jar found
)
echo.

REM Step 3: Update .env
echo [3/5] Updating .env file for local Lavalink...
copy .env .env.backup.test >nul 2>&1
call scripts\switch-to-local-lavalink.bat
echo.

REM Step 4: Start Lavalink
echo [4/5] Starting Lavalink server...
pm2 start "java -jar Lavalink.jar" --name lavalink --cwd "%cd%\lavalink"
echo.
echo Waiting for Lavalink to start...
timeout /t 10 /nobreak >nul
echo.

REM Step 5: Test connection
echo [5/5] Testing Lavalink connection...
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:2333/version' -TimeoutSec 5; Write-Host '✓ Lavalink is responding'; Write-Host $response.Content } catch { Write-Host 'X Cannot connect to Lavalink' }"
echo.

REM Show status
echo ========================================
echo   Status Summary
echo ========================================
echo.
pm2 list
echo.

echo ========================================
echo   Next Steps
echo ========================================
echo.
echo 1. View Lavalink logs: pm2 logs lavalink
echo 2. Start your bot: pm2 start ecosystem.config.mjs
echo 3. Test in Discord: /lavalink
echo.
echo To stop Lavalink: pm2 stop lavalink
echo To restart: pm2 restart lavalink
echo.
pause
