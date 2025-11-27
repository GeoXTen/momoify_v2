#!/bin/bash

echo "========================================"
echo "Starting Momoify Bot with Local Lavalink"
echo "========================================"
echo ""

echo "[1/3] Checking if Lavalink is already running..."
if lsof -Pi :2333 -sTCP:LISTEN -t >/dev/null ; then
    echo "[INFO] Lavalink is already running on port 2333"
else
    echo "[2/3] Starting Local Lavalink Server..."
    cd lavalink
    nohup java -jar Lavalink.jar > ../logs/lavalink.log 2>&1 &
    cd ..
    echo "[INFO] Waiting 15 seconds for Lavalink to start..."
    sleep 15
fi

echo "[3/3] Starting Discord Bot with PM2..."
pm2 stop momoify-bot 2>/dev/null
pm2 delete momoify-bot 2>/dev/null
pm2 start src/index.js --name momoify-bot

echo ""
echo "========================================"
echo "Bot Started Successfully!"
echo "========================================"
echo ""
echo "Use these commands:"
echo "  pm2 logs momoify-bot  - View bot logs"
echo "  pm2 monit             - Monitor resources"
echo "  pm2 stop momoify-bot  - Stop the bot"
echo "  pm2 restart momoify-bot - Restart the bot"
echo ""
