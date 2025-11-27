@echo off
REM Quick Lavalink server selector for Windows

echo 🎯 Selecting best Lavalink server...
node scripts/lavalink-chooser.mjs %*

if %errorlevel% equ 0 (
    echo.
    echo ✅ Done! Restart your bot to use the new server.
)
