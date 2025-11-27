# How to Run Lavalink Chooser Script

## 🚀 Quick Start (Ubuntu Server)

### Method 1: Using NPM Scripts (Easiest)

```bash
# Auto-select best server and run once
npm run chooser:pm2-auto

# Interactive mode - choose from top servers
npm run chooser:pm2-interactive

# View logs
npm run chooser:pm2-logs

# Stop the process
npm run chooser:pm2-stop
```

### Method 2: Using Shell Script (Recommended for Ubuntu)

```bash
# First time: Make script executable
chmod +x scripts/run-lavalink-chooser-pm2.sh

# Run auto-select (picks best server automatically)
./scripts/run-lavalink-chooser-pm2.sh

# Run with interactive selection
./scripts/run-lavalink-chooser-pm2.sh --choose

# Test without updating .env (dry-run)
./scripts/run-lavalink-chooser-pm2.sh --dry-run --verbose

# Only test V4 servers
./scripts/run-lavalink-chooser-pm2.sh --v4-only

# Check status
./scripts/run-lavalink-chooser-pm2.sh --status

# View logs
./scripts/run-lavalink-chooser-pm2.sh --logs

# Stop
./scripts/run-lavalink-chooser-pm2.sh --stop
```

### Method 3: Direct Node Execution (No PM2)

```bash
# Auto-select best server
node scripts/lavalink-chooser.mjs

# Interactive mode
node scripts/lavalink-chooser.mjs --choose

# Verbose output
node scripts/lavalink-chooser.mjs --verbose

# Dry-run (test only, don't update .env)
node scripts/lavalink-chooser.mjs --dry-run

# Show top 10 servers only
node scripts/lavalink-chooser.mjs --top 10

# V4 servers only
node scripts/lavalink-chooser.mjs --v4-only

# Combine options
node scripts/lavalink-chooser.mjs --choose --v4-only --verbose
```

### Method 4: With Automatic Hourly Updates (PM2 Cron)

```bash
# Start with hourly cron schedule (runs every hour)
pm2 start ecosystem.lavalink-chooser.config.mjs

# Check status
pm2 status lavalink-chooser

# View logs
pm2 logs lavalink-chooser

# Stop
pm2 stop lavalink-chooser
pm2 delete lavalink-chooser
```

## 📋 Complete Workflow Example

### For First Time Setup:

```bash
# 1. Make scripts executable
chmod +x scripts/run-lavalink-chooser-pm2.sh
chmod +x scripts/lavalink-chooser.mjs

# 2. Test the chooser (dry-run)
node scripts/lavalink-chooser.mjs --dry-run --verbose

# 3. Run interactively to choose your server
./scripts/run-lavalink-chooser-pm2.sh --choose

# 4. View the logs
pm2 logs lavalink-chooser

# 5. Check your .env was updated
cat .env | grep LAVALINK
```

### For Regular Use:

```bash
# Option A: Run manually when needed
npm run chooser:pm2-auto

# Option B: Set up automatic hourly checks
pm2 start ecosystem.lavalink-chooser.config.mjs
pm2 save  # Save PM2 process list
pm2 startup  # Setup auto-start on reboot
```

## 🔧 Available Options

| Option | Description |
|--------|-------------|
| `--choose`, `-c` | Interactive mode - choose from top servers |
| `--dry-run` | Test servers but don't update .env |
| `--verbose`, `-v` | Show detailed output |
| `--v4-only`, `--v4` | Only test Lavalink v4 servers |
| `--top N` | Show only top N servers (default: all) |
| `--timeout N` | HTTP timeout in ms (default: 5000) |

## 📊 Understanding the Output

```
📊 Test Results
Online: 45 | Offline: 12

Top 5 Online Servers:

Rank | Server Name              | Region      | Latency | Success | Version
-----|--------------------------|-------------|---------|---------|--------
1.   | US Server 1              | 🇺🇸 USA     | 45ms    | 100%    | v4
2.   | EU Server 2              | 🇪🇺 Europe  | 78ms    | 100%    | v4
3.   | Asia Server 1            | 🇯🇵 Japan   | 120ms   | 100%    | v4
```

- **Green latency** (< 100ms): Excellent
- **Yellow latency** (100-300ms): Good
- **Red latency** (> 300ms): Fair

## 🐛 Troubleshooting

### Script Won't Run

```bash
# Make sure Node.js is installed (24+)
node --version

# Make script executable
chmod +x scripts/lavalink-chooser.mjs
chmod +x scripts/run-lavalink-chooser-pm2.sh
```

### PM2 Not Found

```bash
# Install PM2 globally
npm install -g pm2

# Or use npx
npx pm2 start scripts/lavalink-chooser.mjs
```

### No Servers Found

```bash
# Check if server list file exists
ls -la "lavalink server lis.txt"

# Run with verbose to see what's happening
node scripts/lavalink-chooser.mjs --dry-run --verbose
```

### Permission Denied on .env Update

```bash
# Check .env permissions
ls -la .env

# Fix permissions
chmod 644 .env
```

## 🔄 Integration with Bot Startup

### Start Bot After Choosing Server

```bash
# Method 1: Chain commands
npm run chooser:pm2-auto && npm start

# Method 2: Chain with PM2
npm run chooser:pm2-auto && pm2 start ecosystem.config.mjs

# Method 3: Create a startup script
```

### Create Combined Startup Script:

```bash
# Create start-bot.sh
cat > start-bot.sh << 'EOF'
#!/bin/bash
echo "🔍 Selecting best Lavalink server..."
node scripts/lavalink-chooser.mjs

if [ $? -eq 0 ]; then
    echo "✅ Server selected, starting bot..."
    pm2 start ecosystem.config.mjs
else
    echo "❌ Failed to select server"
    exit 1
fi
EOF

chmod +x start-bot.sh
./start-bot.sh
```

## 💾 Save PM2 Configuration

To ensure processes restart after server reboot:

```bash
# Save current PM2 process list
pm2 save

# Setup PM2 to start on boot
pm2 startup

# Follow the instructions printed by the command
```

## 📝 Useful PM2 Commands

```bash
# List all processes
pm2 list

# Monitor in real-time
pm2 monit

# View specific process info
pm2 info lavalink-chooser

# Restart process
pm2 restart lavalink-chooser

# Stop process
pm2 stop lavalink-chooser

# Delete process from PM2
pm2 delete lavalink-chooser

# View logs
pm2 logs lavalink-chooser

# Clear logs
pm2 flush lavalink-chooser

# Update PM2
npm install -g pm2@latest
pm2 update
```
