# Quick Commands Cheat Sheet - AlmaLinux

## 🚀 When You Login to Terminal

### 1. Check if Bot is Running
```bash
# Fastest way
ps aux | grep "node src/index.js" | grep -v grep

# Or check API
curl http://localhost:3001/api/health

# Or use the status script
./check-bot.sh
```

### 2. View Logs
```bash
# Follow logs in real-time
tail -f logs/combined-*.log

# View last 50 lines
tail -50 logs/combined-*.log

# View only errors
tail -50 logs/error-*.log

# Search for specific text
grep -i "error" logs/*.log | tail -20
```

---

## 🎮 Common Operations

### Start Bot
```bash
# With auto-select best Lavalink
node scripts/lavalink-chooser.mjs --start-bot

# Or start directly
npm start
```

### Stop Bot
```bash
# Simple method
pkill -f node

# Or find and kill by PID
ps aux | grep node
kill <PID>
```

### Restart Bot
```bash
# Stop and start
pkill -f node && node scripts/lavalink-chooser.mjs --start-bot
```

### Check Status
```bash
# Use the dashboard script
./check-bot.sh

# Or quick check
curl http://localhost:3001/api/health
```

---

## 📊 Status Dashboard

Run the included script:
```bash
# Make it executable (first time only)
chmod +x check-bot.sh

# Run it
./check-bot.sh
```

**Output Example:**
```
╔════════════════════════════════════════════╗
║       Discord Bot Status Dashboard         ║
╚════════════════════════════════════════════╝

✅ Process Status: RUNNING
   └─ PID: 12345

✅ API Status: RESPONSIVE
{"status":"online"}

✅ Lavalink Status:
   └─ Host: 140.245.120.106:25230
   └─ Connected: true

⏱️  Bot Uptime: 2:30:15

💾 Memory Usage: 2.1%

✅ No Recent Errors

════════════════════════════════════════════
Quick Commands:
  View logs:  tail -f logs/combined-*.log
  Stop bot:   pkill -f node
  Start bot:  node scripts/lavalink-chooser.mjs --start-bot
════════════════════════════════════════════
```

---

## 📝 Log Commands

```bash
# Real-time logs (follow mode)
tail -f logs/combined-*.log

# Last 20 lines
tail -20 logs/combined-*.log

# Search for errors
grep -i error logs/*.log | tail -20

# Search for specific text
grep -i "lavalink" logs/*.log | tail -20

# View file sizes
ls -lh logs/

# Clear old logs (be careful!)
rm logs/*.log.old
```

---

## 🔧 Troubleshooting

### Bot Won't Start
```bash
# Check if already running
ps aux | grep node

# Check if port 3001 is in use
ss -tulpn | grep 3001

# Try force stopping first
pkill -9 -f node

# Then start
node scripts/lavalink-chooser.mjs --start-bot
```

### Bot Stops Unexpectedly
```bash
# Check error logs
tail -50 logs/error-*.log

# Check if process crashed
dmesg | grep -i kill

# Restart bot
node scripts/lavalink-chooser.mjs --start-bot
```

### Can't Connect to Bot
```bash
# Check if bot is running
ps aux | grep node

# Check API
curl http://localhost:3001/api/health

# Check firewall
sudo firewall-cmd --list-ports

# Check logs
tail -f logs/combined-*.log
```

---

## 🎯 One-Line Commands

```bash
# Check status
curl -s http://localhost:3001/api/health && echo " - Bot is running" || echo " - Bot is NOT running"

# Start bot (quick)
node scripts/lavalink-chooser.mjs --start-bot

# Stop bot (quick)
pkill -f node

# Restart bot (one command)
pkill -f node && sleep 2 && node scripts/lavalink-chooser.mjs --start-bot

# Check processes
ps aux | grep "node src/index.js" | grep -v grep

# Follow logs
tail -f logs/combined-*.log

# Count errors in last hour
grep -i error logs/*.log | grep "$(date +%Y-%m-%d)" | wc -l
```

---

## 🌟 Pro Tips

### 1. Create Aliases (Add to ~/.bashrc)
```bash
alias botstart='node scripts/lavalink-chooser.mjs --start-bot'
alias botstop='pkill -f node'
alias botrestart='pkill -f node && sleep 2 && node scripts/lavalink-chooser.mjs --start-bot'
alias botlogs='tail -f logs/combined-*.log'
alias botcheck='./check-bot.sh'
alias botstatus='curl -s http://localhost:3001/api/health'

# Reload bashrc after adding
source ~/.bashrc
```

Now you can just type:
- `botstart` - Start the bot
- `botstop` - Stop the bot
- `botrestart` - Restart the bot
- `botlogs` - View logs
- `botcheck` - Check full status
- `botstatus` - Quick API check

### 2. Auto-Check on Login
Add to `~/.bashrc`:
```bash
if [ -d "$HOME/bot_v2" ]; then
    cd $HOME/bot_v2
    echo "🤖 Bot Status:"
    if ps aux | grep "node src/index.js" | grep -v grep > /dev/null; then
        echo "✅ Running"
    else
        echo "❌ Not Running"
    fi
fi
```

### 3. Use PM2 for Production
```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start src/index.js --name momoify-bot

# Then use PM2 commands
pm2 list          # Check status
pm2 logs          # View logs
pm2 restart all   # Restart
pm2 stop all      # Stop
pm2 monit         # Real-time monitoring
```

---

## 📚 More Documentation

- `CHECK-BOT-STATUS.md` - Detailed status checking guide
- `STOP-BOT-ALMALINUX.md` - How to stop the bot
- `ALMALINUX-QUICKSTART.md` - Complete setup guide
- `ALMALINUX-COMPATIBILITY.md` - Compatibility information

---

## 🆘 Emergency Commands

```bash
# Force kill everything
pkill -9 -f node

# Kill by port
sudo fuser -k 3001/tcp

# Check what's using memory
ps aux --sort=-%mem | head -10

# Check disk space
df -h

# View system logs
journalctl -xe
```
