# How to Check Bot Status on AlmaLinux

## Quick Status Check (When You Login)

### Method 1: Check Node Processes (Fastest)
```bash
ps aux | grep node
```

**What to look for:**
- ✅ **Bot is running** if you see: `node src/index.js` or similar
- ❌ **Bot is NOT running** if you only see: `grep --color=auto node`

**Example Output (Bot Running):**
```
user    12345  0.5  2.1  ...  node src/index.js
user    12346  0.0  0.0  ...  grep --color=auto node
```

**Example Output (Bot Stopped):**
```
user    12347  0.0  0.0  ...  grep --color=auto node
```

### Method 2: Check API Health (Most Reliable)
```bash
curl http://localhost:3001/api/health
```

**Expected Output:**
- ✅ **Bot is running:** `{"status":"online"}` or similar
- ❌ **Bot is NOT running:** `curl: (7) Failed to connect to localhost port 3001: Connection refused`

### Method 3: Check Port 3001
```bash
ss -tulpn | grep 3001
# or
lsof -i :3001
```

**Expected Output:**
- ✅ **Bot is running:** Shows node process using port 3001
- ❌ **Bot is NOT running:** No output

### Method 4: Check PM2 (If Using PM2)
```bash
pm2 list
```

**Expected Output:**
- ✅ **Bot is running:** Shows bot in "online" status
- ❌ **Bot is NOT running:** Empty list or "stopped" status

---

## Detailed Status Check

### One Command to Check Everything
```bash
echo "=== Bot Status Check ===" && \
echo "1. Node Processes:" && ps aux | grep "node src/index.js" | grep -v grep && \
echo "2. API Health:" && curl -s http://localhost:3001/api/health && echo && \
echo "3. Port 3001:" && ss -tulpn | grep 3001 && \
echo "=== Check Complete ===" || echo "Bot may not be running"
```

### Create an Alias (Add to ~/.bashrc)
```bash
# Add this to your ~/.bashrc file
alias botcheck='curl -s http://localhost:3001/api/health | jq . 2>/dev/null || echo "Bot is NOT running"'
alias botstatus='ps aux | grep "node src/index.js" | grep -v grep && echo "✓ Bot is running" || echo "✗ Bot is NOT running"'

# Reload bashrc
source ~/.bashrc

# Now you can just type:
botcheck
# or
botstatus
```

---

## View Bot Logs

### Method 1: Check Log Files (Default)
```bash
# Navigate to bot directory
cd ~/bot_v2  # or your bot path

# View latest log
ls -lt logs/  # List logs by time
tail -f logs/*.log  # Follow latest log

# View last 50 lines of combined log
tail -50 logs/combined-*.log

# View last 50 lines of error log
tail -50 logs/error-*.log

# Search for errors
grep -i error logs/*.log

# Watch logs in real-time
tail -f logs/combined-*.log
```

### Method 2: PM2 Logs (If Using PM2)
```bash
# View all PM2 logs
pm2 logs

# View logs for specific bot
pm2 logs momoify-bot

# View last 100 lines
pm2 logs momoify-bot --lines 100

# View only error logs
pm2 logs momoify-bot --err

# Clear logs
pm2 flush
```

### Method 3: System Journal (If Running as Service)
```bash
# View systemd journal
journalctl -u momoify-bot -f

# View last 100 lines
journalctl -u momoify-bot -n 100

# View errors only
journalctl -u momoify-bot -p err
```

### Method 4: Real-time Console Output
```bash
# If bot was started in screen/tmux
screen -ls  # List screen sessions
screen -r momoify  # Reattach to session

# Or with tmux
tmux ls  # List tmux sessions
tmux attach -t momoify  # Attach to session
```

---

## Complete Status Dashboard (Copy-Paste Script)

Create a status checking script:

```bash
# Create the script
cat > ~/check-bot.sh << 'EOF'
#!/bin/bash

echo "╔════════════════════════════════════════════╗"
echo "║       Discord Bot Status Dashboard         ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# Check if bot process is running
if ps aux | grep "node src/index.js" | grep -v grep > /dev/null; then
    echo "✅ Process Status: RUNNING"
    PID=$(ps aux | grep "node src/index.js" | grep -v grep | awk '{print $2}')
    echo "   └─ PID: $PID"
else
    echo "❌ Process Status: NOT RUNNING"
fi

echo ""

# Check API health
if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
    echo "✅ API Status: RESPONSIVE"
    curl -s http://localhost:3001/api/health | jq . 2>/dev/null || curl -s http://localhost:3001/api/health
else
    echo "❌ API Status: NOT RESPONDING"
fi

echo ""

# Check Lavalink connection
if curl -s http://localhost:3001/api/lavalink > /dev/null 2>&1; then
    echo "✅ Lavalink Status:"
    LAVALINK_DATA=$(curl -s http://localhost:3001/api/lavalink)
    echo "$LAVALINK_DATA" | jq -r '.nodes[0] | "   └─ Host: \(.host):\(.port)\n   └─ Connected: \(.connected)"' 2>/dev/null || echo "   └─ Connected"
else
    echo "❌ Lavalink: NOT CONNECTED"
fi

echo ""

# Check bot uptime
if ps aux | grep "node src/index.js" | grep -v grep > /dev/null; then
    UPTIME=$(ps -o etime= -p $(ps aux | grep "node src/index.js" | grep -v grep | awk '{print $2}') 2>/dev/null)
    echo "⏱️  Bot Uptime: $UPTIME"
fi

echo ""

# Check memory usage
if ps aux | grep "node src/index.js" | grep -v grep > /dev/null; then
    MEM=$(ps aux | grep "node src/index.js" | grep -v grep | awk '{print $4}')
    echo "💾 Memory Usage: ${MEM}%"
fi

echo ""

# Recent errors
if [ -d "logs" ]; then
    ERROR_COUNT=$(grep -i error logs/*.log 2>/dev/null | tail -10 | wc -l)
    if [ "$ERROR_COUNT" -gt 0 ]; then
        echo "⚠️  Recent Errors: $ERROR_COUNT found in logs"
        echo "   └─ Run: tail -20 logs/error-*.log"
    else
        echo "✅ No Recent Errors"
    fi
else
    echo "ℹ️  No log directory found"
fi

echo ""
echo "════════════════════════════════════════════"
echo "Quick Commands:"
echo "  View logs:  tail -f logs/combined-*.log"
echo "  Stop bot:   pkill -f node"
echo "  Start bot:  node scripts/lavalink-chooser.mjs --start-bot"
echo "════════════════════════════════════════════"
EOF

# Make it executable
chmod +x ~/check-bot.sh

# Create alias
echo "alias botdash='~/check-bot.sh'" >> ~/.bashrc
source ~/.bashrc

echo "✅ Bot status script created!"
echo "Run: ~/check-bot.sh or just type: botdash"
```

Now you can run:
```bash
~/check-bot.sh
# or
botdash
```

---

## Quick Log Commands Reference

```bash
# View last 20 lines of logs
tail -20 logs/combined-*.log

# Watch logs in real-time (follow)
tail -f logs/combined-*.log

# Search for specific errors
grep -i "error" logs/*.log | tail -20

# Search for connection issues
grep -i "connection\|disconnect" logs/*.log | tail -20

# View logs from last hour
find logs/ -mmin -60 -exec tail {} \;

# Count errors today
grep -i error logs/*.log | grep "$(date +%Y-%m-%d)" | wc -l

# View only bot startup messages
grep -i "ready\|logged in\|started" logs/*.log | tail -10

# View Lavalink connection logs
grep -i "lavalink" logs/*.log | tail -20
```

---

## Login Routine (Recommended)

Add this to your `~/.bashrc` or `~/.bash_profile`:

```bash
# Bot status on login
if [ -d "$HOME/bot_v2" ]; then
    echo "═══════════════════════════════════════"
    echo "🤖 Checking Discord Bot Status..."
    echo "═══════════════════════════════════════"
    
    cd $HOME/bot_v2
    
    if ps aux | grep "node src/index.js" | grep -v grep > /dev/null; then
        echo "✅ Bot is RUNNING"
        
        # Quick API check
        if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
            echo "✅ API is RESPONSIVE"
        else
            echo "⚠️  API not responding"
        fi
    else
        echo "❌ Bot is NOT RUNNING"
        echo "   Start with: node scripts/lavalink-chooser.mjs --start-bot"
    fi
    
    echo "═══════════════════════════════════════"
    echo ""
fi
```

Then reload:
```bash
source ~/.bashrc
```

Now every time you login, you'll automatically see bot status!

---

## Advanced Monitoring

### Set up automatic alerts (optional)
```bash
# Create a monitoring script
cat > ~/monitor-bot.sh << 'EOF'
#!/bin/bash
while true; do
    if ! ps aux | grep "node src/index.js" | grep -v grep > /dev/null; then
        echo "[$(date)] Bot is down! Attempting restart..." >> ~/bot-monitor.log
        cd ~/bot_v2
        node scripts/lavalink-chooser.mjs --start-bot &
    fi
    sleep 60  # Check every minute
done
EOF

chmod +x ~/monitor-bot.sh

# Run in background
nohup ~/monitor-bot.sh > /dev/null 2>&1 &
```

### Use htop for visual monitoring
```bash
# Install htop if not available
sudo dnf install -y htop

# Run htop and filter for node
htop
# Press F4, type "node", Enter to filter
```

---

## Troubleshooting

### Issue: Can't see logs
```bash
# Check if log directory exists
ls -la logs/

# Check permissions
ls -ld logs/

# Create if missing
mkdir -p logs
```

### Issue: API not responding but process is running
```bash
# Check if port is actually in use
ss -tulpn | grep 3001

# Check for port conflicts
lsof -i :3001

# Restart the bot
pkill -f node
node scripts/lavalink-chooser.mjs --start-bot
```

### Issue: Can't find bot directory
```bash
# Search for bot directory
find ~ -name "bot_v2" -type d 2>/dev/null

# Or search for index.js
find ~ -name "index.js" -path "*/src/*" 2>/dev/null
```
