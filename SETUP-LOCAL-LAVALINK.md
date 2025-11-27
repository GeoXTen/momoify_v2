# Setup Local Lavalink Server on Ubuntu

This guide will help you set up and run Lavalink locally on your Ubuntu server.

## 📋 Prerequisites

### 1. Install Java 17 or Higher

```bash
# Update package list
sudo apt update

# Install OpenJDK 17
sudo apt install openjdk-17-jdk -y

# Verify installation
java -version
```

Expected output: `openjdk version "17.x.x"` or higher

### 2. Download Lavalink.jar

```bash
# Navigate to lavalink directory
cd ~/bot_v2/lavalink

# Download latest Lavalink v4 (recommended)
wget https://github.com/lavalink-devs/Lavalink/releases/download/4.0.7/Lavalink.jar

# OR download latest version from releases page:
# https://github.com/lavalink-devs/Lavalink/releases
```

## 🚀 Quick Start

### Method 1: Start Lavalink Manually

```bash
cd ~/bot_v2/lavalink
java -jar Lavalink.jar
```

### Method 2: Start Lavalink with PM2 (Recommended)

```bash
# Start Lavalink with PM2
pm2 start "java -jar Lavalink.jar" --name lavalink --cwd ~/bot_v2/lavalink

# View logs
pm2 logs lavalink

# Stop
pm2 stop lavalink

# Restart
pm2 restart lavalink
```

### Method 3: Use PM2 Ecosystem Config

```bash
# Start using ecosystem config
pm2 start ecosystem.lavalink.config.mjs

# Save for auto-restart
pm2 save
```

## 🔧 Configure Bot to Use Local Lavalink

### Step 1: Update .env file

```bash
# Edit .env file
nano .env
```

**Comment out external server and uncomment local:**

```env
# Lavalink Configuration (External Server - No Docker/Java needed!)
# LAVALINK_HOST=lava-v4.ajieblogs.eu.org
# LAVALINK_PORT=443
# LAVALINK_PASSWORD=https://dsc.gg/ajidevserver
# LAVALINK_SECURE=true

# Alternative: Local Lavalink Server
LAVALINK_HOST=localhost
LAVALINK_PORT=2333
LAVALINK_PASSWORD=youshallnotpass
LAVALINK_SECURE=false
```

Save with `Ctrl+O`, then exit with `Ctrl+X`

### Step 2: Restart the Bot

```bash
# Restart bot with updated environment
pm2 restart all --update-env

# OR use the restart command
pm2 restart momoify-bot --update-env
```

## ✅ Verify Connection

### Check Lavalink is Running

```bash
# Check if Lavalink is listening on port 2333
sudo netstat -tlnp | grep 2333

# OR use curl
curl http://localhost:2333/version
```

Expected output: `{"version":"4.0.7","buildTime":...}`

### Check Bot Connection

In Discord, run:
```
/lavalink
```

You should see:
- Host: `localhost`
- Port: `2333`
- Status: 🟢 Connected

## 🔄 Create Startup Scripts

### Create lavalink-start.sh

```bash
cat > ~/bot_v2/scripts/lavalink-start.sh << 'EOF'
#!/bin/bash
cd ~/bot_v2/lavalink

echo "🚀 Starting Lavalink server..."

# Check if Lavalink.jar exists
if [ ! -f "Lavalink.jar" ]; then
    echo "❌ Lavalink.jar not found!"
    echo "Downloading Lavalink v4.0.7..."
    wget https://github.com/lavalink-devs/Lavalink/releases/download/4.0.7/Lavalink.jar
fi

# Start with PM2
pm2 start "java -jar Lavalink.jar" --name lavalink --cwd ~/bot_v2/lavalink
pm2 save

echo "✅ Lavalink started!"
echo "📊 View logs: pm2 logs lavalink"
EOF

chmod +x ~/bot_v2/scripts/lavalink-start.sh
```

### Create lavalink-stop.sh

```bash
cat > ~/bot_v2/scripts/lavalink-stop.sh << 'EOF'
#!/bin/bash
echo "🛑 Stopping Lavalink server..."
pm2 stop lavalink
pm2 delete lavalink
echo "✅ Lavalink stopped!"
EOF

chmod +x ~/bot_v2/scripts/lavalink-stop.sh
```

## 📊 PM2 Ecosystem Config for Lavalink

Create `ecosystem.lavalink.config.mjs`:

```javascript
export default {
    apps: [
        {
            name: 'lavalink',
            script: 'java',
            args: '-jar Lavalink.jar',
            cwd: './lavalink',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '1G',
            env: {
                NODE_ENV: 'production'
            },
            error_file: './logs/lavalink-error.log',
            out_file: './logs/lavalink-out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            time: true,
            min_uptime: '10s',
            max_restarts: 10
        }
    ]
};
```

## 🔄 Complete Setup Workflow

### All-in-One Setup Script

```bash
cat > ~/bot_v2/setup-local-lavalink.sh << 'EOF'
#!/bin/bash

echo "🔧 Setting up Local Lavalink..."

# 1. Check Java
if ! command -v java &> /dev/null; then
    echo "❌ Java not found. Installing OpenJDK 17..."
    sudo apt update
    sudo apt install openjdk-17-jdk -y
else
    echo "✅ Java is installed: $(java -version 2>&1 | head -n 1)"
fi

# 2. Download Lavalink if not exists
if [ ! -f "./lavalink/Lavalink.jar" ]; then
    echo "📥 Downloading Lavalink v4.0.7..."
    cd lavalink
    wget https://github.com/lavalink-devs/Lavalink/releases/download/4.0.7/Lavalink.jar
    cd ..
else
    echo "✅ Lavalink.jar already exists"
fi

# 3. Update .env file
echo "📝 Updating .env file..."
cat > .env.tmp << 'ENVFILE'
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
ENVFILE

mv .env.tmp .env
echo "✅ .env updated for local Lavalink"

# 4. Start Lavalink with PM2
echo "🚀 Starting Lavalink with PM2..."
pm2 start "java -jar Lavalink.jar" --name lavalink --cwd $(pwd)/lavalink
pm2 save

# 5. Wait for Lavalink to start
echo "⏳ Waiting for Lavalink to start..."
sleep 5

# 6. Restart bot
echo "🔄 Restarting bot..."
pm2 restart all --update-env

echo ""
echo "✅ Setup complete!"
echo ""
echo "📊 Check status:"
echo "  pm2 list"
echo ""
echo "📋 View logs:"
echo "  pm2 logs lavalink"
echo "  pm2 logs momoify-bot"
echo ""
echo "🎵 Test in Discord:"
echo "  /lavalink"
echo "  /play your favorite song"
EOF

chmod +x ~/bot_v2/setup-local-lavalink.sh
```

### Run the Setup

```bash
cd ~/bot_v2
./setup-local-lavalink.sh
```

## 🐛 Troubleshooting

### Lavalink Won't Start

```bash
# Check if port 2333 is already in use
sudo netstat -tlnp | grep 2333

# Kill any process using port 2333
sudo kill -9 $(sudo lsof -t -i:2333)

# Try starting again
pm2 restart lavalink
```

### Bot Can't Connect

```bash
# Check Lavalink logs
pm2 logs lavalink

# Check if Lavalink is responding
curl http://localhost:2333/version

# Verify .env file
cat .env | grep LAVALINK

# Restart bot with fresh environment
pm2 restart all --update-env
```

### Java Out of Memory

Edit the PM2 config or start command:

```bash
pm2 start "java -Xmx512M -jar Lavalink.jar" --name lavalink --cwd ~/bot_v2/lavalink
```

### Check Lavalink Version

```bash
curl http://localhost:2333/version
```

## 📝 Useful Commands

```bash
# Start everything
pm2 start lavalink
pm2 start momoify-bot

# Stop everything
pm2 stop all

# Restart everything
pm2 restart all

# View all logs
pm2 logs

# View specific logs
pm2 logs lavalink
pm2 logs momoify-bot

# Monitor in real-time
pm2 monit

# Save PM2 process list
pm2 save

# Setup auto-start on reboot
pm2 startup
```

## 🔙 Switch Back to External Lavalink

If you want to switch back to external servers:

```bash
# Run the lavalink chooser
node scripts/lavalink-chooser.mjs --choose

# OR manually edit .env
nano .env

# Then restart bot
pm2 restart all --update-env
```
