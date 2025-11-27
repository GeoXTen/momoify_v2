#!/bin/bash

echo "========================================"
echo "Stopping Bot and Lavalink"
echo "========================================"
echo ""

echo "[1/2] Stopping Discord Bot..."
pm2 stop momoify-bot
pm2 delete momoify-bot

echo "[2/2] Stopping Lavalink Server..."
if lsof -Pi :2333 -sTCP:LISTEN -t >/dev/null ; then
    PID=$(lsof -Pi :2333 -sTCP:LISTEN -t)
    echo "Killing Lavalink process $PID"
    kill -9 $PID
    echo "[INFO] Lavalink stopped"
else
    echo "[INFO] Lavalink is not running"
fi

echo ""
echo "========================================"
echo "All Services Stopped!"
echo "========================================"
