#!/bin/bash
# Start Everything with PM2 (Lavalink + Bot) - Ubuntu/Linux

cd "$(dirname "$0")/.." || exit

echo ""
echo "========================================"
echo "   Starting Local Lavalink + Bot"
echo "========================================"
echo ""

# Check Java
echo "[1/5] Checking Java..."
if ! command -v java &> /dev/null; then
    echo "❌ Java is NOT installed"
    echo ""
    echo "Install with: sudo apt install openjdk-17-jdk -y"
    exit 1
fi
echo "✅ Java found: $(java -version 2>&1 | head -n 1)"
echo ""

# Check Lavalink.jar
echo "[2/5] Checking Lavalink.jar..."
if [ ! -f "lavalink/Lavalink.jar" ]; then
    echo "❌ Lavalink.jar not found"
    echo ""
    echo "Downloading Lavalink v4.0.7..."
    wget -q --show-progress https://github.com/lavalink-devs/Lavalink/releases/download/4.0.7/Lavalink.jar -O lavalink/Lavalink.jar
    
    if [ -f "lavalink/Lavalink.jar" ]; then
        echo "✅ Download complete!"
    else
        echo "❌ Download failed"
        echo "Please download manually from: https://github.com/lavalink-devs/Lavalink/releases"
        exit 1
    fi
else
    echo "✅ Lavalink.jar found"
fi
echo ""

# Update .env for local Lavalink
echo "[3/5] Configuring for local Lavalink..."
cp .env .env.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null

cat > .env << 'EOF'
# Discord Bot Configuration
DISCORD_TOKEN=MTAzMzEzNzI5OTA0ODkwNjc1Mg.GuaXHP.CXpLWeiEohaR79DspeSBa-RwAdkRUdfpyTA2LI
CLIENT_ID=1033137299048906752

# Lavalink Configuration - LOCAL SERVER
LAVALINK_HOST=localhost
LAVALINK_PORT=2333
LAVALINK_PASSWORD=youshallnotpass
LAVALINK_SECURE=false

# Bot Settings
PREFIX=/
BOT_ACTIVITY=music
BOT_STATUS=online
OWNER_ID=572614372812390410

# Genius Lyrics API
GENIUS_CLIENT_ID=IWIdEVDcL0oD09rRVv3hCaWuRmRUdY7X2yXti8woy7zUWPq5Br8RR-qLzxzuqG7m

# API Settings
API_PORT=3001
EOF

echo "✅ Configuration updated"
echo ""

# Stop any existing processes
echo "[4/5] Cleaning up old processes..."
pm2 delete all >/dev/null 2>&1
echo "✅ Ready to start fresh"
echo ""

# Start everything with PM2
echo "[5/5] Starting Lavalink and Bot..."
echo ""
echo "Starting Lavalink server..."
pm2 start "java -jar Lavalink.jar" --name lavalink --cwd "$(pwd)/lavalink"

echo "Waiting for Lavalink to start (10 seconds)..."
sleep 10

echo "Starting Discord bot..."
pm2 start src/index.js --name momoify-bot --watch --max-memory-restart 500M

echo "Saving PM2 process list..."
pm2 save

echo ""
echo "========================================"
echo "   Startup Complete!"
echo "========================================"
echo ""
echo "✅ Lavalink: Running on localhost:2333"
echo "✅ Bot: Running and ready"
echo ""
echo "View processes: pm2 list"
echo "View all logs: pm2 logs"
echo "View bot logs: pm2 logs momoify-bot"
echo "View Lavalink logs: pm2 logs lavalink"
echo ""
echo "Monitor: pm2 monit"
echo "Stop all: pm2 stop all"
echo ""
