# AlmaLinux Quick Start Guide

## Prerequisites

### 1. Install Node.js (v24+)
```bash
# Install Node.js 24.x from NodeSource
curl -fsSL https://rpm.nodesource.com/setup_24.x | sudo bash -
sudo dnf install -y nodejs

# Verify installation
node --version  # Should be v24.x or higher
npm --version
```

### 2. Install System Dependencies for Canvas
```bash
# Install required libraries for canvas package
sudo dnf install -y cairo-devel pango-devel libjpeg-turbo-devel giflib-devel pixman-devel

# Alternative for older AlmaLinux versions:
# sudo yum install -y cairo-devel pango-devel libjpeg-turbo-devel giflib-devel pixman-devel
```

### 3. Install Java (for Local Lavalink - Optional)
```bash
# If you want to run Lavalink locally
sudo dnf install -y java-17-openjdk java-17-openjdk-devel

# Verify
java -version
```

### 4. Install PM2 (Optional but Recommended)
```bash
# Install PM2 globally for process management
sudo npm install -g pm2

# Setup PM2 to start on system boot
pm2 startup
# Follow the instructions provided by the command
```

## Installation

### 1. Clone or Upload the Bot
```bash
# If cloning from git
git clone <your-repo-url>
cd bot_v2

# Or upload your bot folder and navigate to it
cd /path/to/bot_v2
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment
```bash
# Copy example or create .env file
cp .env.example .env

# Edit with your Discord bot token
nano .env
# or
vi .env
```

Edit the following values:
```
DISCORD_TOKEN=your_discord_bot_token_here
CLIENT_ID=your_bot_client_id_here
OWNER_ID=your_discord_user_id_here
```

## Running the Bot

### Method 1: Auto-Select Best Lavalink Server (Recommended)

This will automatically test all public Lavalink servers, select the fastest one, and start the bot:

```bash
# Simple auto-start
node scripts/lavalink-chooser.mjs --start-bot

# With verbose output
node scripts/lavalink-chooser.mjs --start-bot --verbose

# Interactive mode (choose from top servers)
node scripts/lavalink-chooser.mjs --start-bot --choose

# Only test v4 servers
node scripts/lavalink-chooser.mjs --start-bot --v4-only
```

### Method 2: Manual Start

```bash
# Just start the bot (uses current .env settings)
npm start

# Or directly with node
node src/index.js
```

### Method 3: Using PM2 (Production)

```bash
# Option A: Auto-select Lavalink first, then start with PM2
node scripts/lavalink-chooser.mjs  # Select best server
pm2 start src/index.js --name momoify-bot --watch

# Option B: Use PM2 directly with current settings
pm2 start ecosystem.config.mjs

# Option C: Start everything (local Lavalink + Bot)
npm run start:all-linux
```

## Process Management

### Check Status
```bash
# Check if bot is running
pm2 list

# Check all node processes
ps aux | grep node

# Test bot API
curl http://localhost:3001/api/health
```

### View Logs
```bash
# PM2 logs
pm2 logs momoify-bot

# Or follow logs in real-time
pm2 logs momoify-bot --lines 100
```

### Stop/Restart Bot

#### If Started with `--start-bot` flag:
```bash
# Method 1: Kill all node processes (simple)
pkill -f node

# Method 2: Find and kill specific bot process
ps aux | grep node
kill <PID>

# Method 3: Kill by name pattern
pkill -f "node src/index.js"

# Method 4: Force kill if not responding
pkill -9 -f node
```

#### If Started with PM2:
```bash
# Stop the bot
pm2 stop momoify-bot

# Restart the bot
pm2 restart momoify-bot

# Delete from PM2 (stop and remove)
pm2 delete momoify-bot

# Stop all PM2 processes
pm2 stop all

# Kill PM2 daemon entirely
pm2 kill
```

#### Check if Bot is Running:
```bash
# Check all node processes
ps aux | grep node

# Count node processes
ps aux | grep node | wc -l

# Check if bot API is responding
curl http://localhost:3001/api/health

# Check which process is using port 3001
lsof -i :3001
# or
ss -tulpn | grep 3001
```

### Keep Bot Running After Logout
```bash
# Use PM2 (recommended)
pm2 start src/index.js --name momoify-bot
pm2 save
pm2 startup  # Follow instructions

# Or use screen/tmux
screen -S momoify
node src/index.js
# Press Ctrl+A then D to detach
# Reattach with: screen -r momoify
```

## Testing

### 1. Test Lavalink Connection (Dry Run)
```bash
node scripts/lavalink-chooser.mjs --dry-run --verbose
```

### 2. Check Bot Health
```bash
curl http://localhost:3001/api/health
```

### 3. Check Lavalink Status
```bash
curl http://localhost:3001/api/lavalink
```

### 4. View Bot Stats
```bash
curl http://localhost:3001/api/stats
```

## Firewall Configuration (If Needed)

```bash
# Open API port (if you want external access)
sudo firewall-cmd --permanent --add-port=3001/tcp
sudo firewall-cmd --reload

# For local Lavalink
sudo firewall-cmd --permanent --add-port=2333/tcp
sudo firewall-cmd --reload
```

## Troubleshooting

### Bot Won't Start
```bash
# Check logs
cat logs/*.log

# Check if port is in use
ss -tulpn | grep 3001

# Verify .env file
cat .env
```

### Canvas Installation Fails
```bash
# Reinstall system dependencies
sudo dnf install -y cairo-devel pango-devel libjpeg-turbo-devel giflib-devel pixman-devel

# Rebuild canvas
npm rebuild canvas
```

### Lavalink Connection Failed
```bash
# Test server selection
node scripts/lavalink-chooser.mjs --verbose

# Check .env file
grep LAVALINK .env

# Test connection manually
curl -H "Authorization: $(grep LAVALINK_PASSWORD .env | cut -d= -f2)" \
  http://$(grep LAVALINK_HOST .env | cut -d= -f2):$(grep LAVALINK_PORT .env | cut -d= -f2)/version
```

### Permission Issues
```bash
# Make scripts executable
chmod +x scripts/*.sh

# Fix ownership if needed
sudo chown -R $USER:$USER .
```

## Common Commands Reference

```bash
# Start bot with auto Lavalink selection
node scripts/lavalink-chooser.mjs --start-bot

# Start with PM2
pm2 start src/index.js --name momoify-bot

# View processes
pm2 list
ps aux | grep node

# Stop all
pm2 stop all
pkill -f node

# View logs
pm2 logs
tail -f logs/*.log

# Update bot
git pull  # if using git
npm install

# Restart after update
pm2 restart momoify-bot
```

## Automated Startup on Boot

```bash
# Using PM2
pm2 start src/index.js --name momoify-bot
pm2 save
pm2 startup
# Run the command shown by pm2 startup

# Verify
sudo systemctl status pm2-$USER
```

## Performance Monitoring

```bash
# Real-time monitoring
pm2 monit

# Memory and CPU usage
pm2 status

# Detailed info
pm2 show momoify-bot
```

## Need Help?

- Check logs: `pm2 logs momoify-bot`
- Check API: `curl http://localhost:3001/api/health`
- View processes: `pm2 list` or `ps aux | grep node`
- Test Lavalink: `node scripts/lavalink-chooser.mjs --dry-run --verbose`
