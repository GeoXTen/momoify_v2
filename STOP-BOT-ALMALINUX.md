# How to Stop the Bot on AlmaLinux

## Quick Reference

### When bot was started with: `node scripts/lavalink-chooser.mjs --start-bot`

#### ⚡ Fastest Method (Recommended)
```bash
pkill -f node
```
This kills all Node.js processes immediately.

#### 🎯 Precise Method (Kill only the bot)
```bash
# Step 1: Find the bot process
ps aux | grep "node src/index.js"

# Step 2: Kill by PID
kill <PID>

# Example output:
# user     12345  0.5  2.1  ...  node src/index.js
# Then run: kill 12345
```

#### 💪 Force Kill (If bot won't stop)
```bash
pkill -9 -f node
```
The `-9` flag forces immediate termination.

#### 🔍 Kill by Pattern
```bash
# Kill only the bot process (not other node apps)
pkill -f "src/index.js"
```

---

## Verification - Check if Bot is Stopped

### Method 1: Check Node Processes
```bash
ps aux | grep node
```
**Expected output if stopped:** Only the grep command itself, or nothing

### Method 2: Check API Endpoint
```bash
curl http://localhost:3001/api/health
```
**Expected output if stopped:** Connection refused error

### Method 3: Check Port Usage
```bash
ss -tulpn | grep 3001
# or
lsof -i :3001
```
**Expected output if stopped:** No output (port is free)

### Method 4: Count Node Processes
```bash
ps aux | grep node | grep -v grep | wc -l
```
**Expected output if stopped:** `0`

---

## Common Scenarios

### Scenario 1: Bot won't stop with regular kill
```bash
# Find the PID
ps aux | grep node

# Force kill
kill -9 <PID>

# Or kill all node processes
pkill -9 -f node
```

### Scenario 2: Multiple node processes running
```bash
# Show all node processes with details
ps aux | grep node

# Kill only bot-related processes
pkill -f "src/index.js"

# Or kill all if needed
pkill -f node
```

### Scenario 3: Bot restarts automatically (PM2 or systemd)
```bash
# Check if PM2 is managing it
pm2 list

# If yes, stop with PM2
pm2 stop all
pm2 kill

# Check for systemd service
systemctl list-units | grep bot

# If found, stop with systemctl
sudo systemctl stop <service-name>
```

### Scenario 4: Port 3001 still in use after stopping
```bash
# Find what's using the port
lsof -i :3001

# Kill that process
kill -9 <PID>

# Or use fuser
sudo fuser -k 3001/tcp
```

---

## Restart Bot After Stopping

### Clean Restart (Select new Lavalink)
```bash
# Stop bot first
pkill -f node

# Start with fresh Lavalink selection
node scripts/lavalink-chooser.mjs --start-bot
```

### Quick Restart (Keep current Lavalink)
```bash
# Stop bot
pkill -f node

# Start directly
npm start
# or
node src/index.js
```

### Restart with PM2 (Recommended for Production)
```bash
# Stop current bot
pkill -f node

# Start with PM2
pm2 start src/index.js --name momoify-bot
pm2 save
```

---

## Troubleshooting

### Issue: `pkill: command not found`
```bash
# Use killall instead
killall node

# Or use ps and kill
ps aux | grep node
kill <PID>
```

### Issue: Permission denied
```bash
# Add sudo if needed (be careful!)
sudo pkill -f node

# Better: Check who owns the process
ps aux | grep node
# Then login as that user or use sudo
```

### Issue: Can't find bot process
```bash
# Show all processes with full command
ps aux | grep -i bot

# Check if running on different port
netstat -tulpn | grep node

# Check PM2
pm2 list

# Check screen sessions
screen -ls
```

### Issue: Bot stops but API still responds
```bash
# Something else might be using port 3001
# Find and kill it
lsof -i :3001
kill -9 <PID>
```

---

## Best Practices

### ✅ Recommended Approach
1. Use PM2 for production:
   ```bash
   pm2 start src/index.js --name momoify-bot
   pm2 stop momoify-bot  # to stop
   ```

2. For development/testing:
   ```bash
   node scripts/lavalink-chooser.mjs --start-bot
   pkill -f node  # to stop
   ```

### ❌ Not Recommended
- Don't use `pkill -9` as first option (graceful shutdown is better)
- Don't use `sudo killall node` on shared servers
- Don't run multiple bot instances simultaneously

---

## One-Line Commands Cheat Sheet

```bash
# Start bot
node scripts/lavalink-chooser.mjs --start-bot

# Stop bot
pkill -f node

# Check if running
ps aux | grep node

# Restart bot
pkill -f node && node scripts/lavalink-chooser.mjs --start-bot

# Check bot health
curl http://localhost:3001/api/health

# View bot logs (if using PM2)
pm2 logs

# Force stop everything
pkill -9 -f node
```

---

## Need More Help?

- Check bot logs: `cat logs/*.log`
- Check system logs: `journalctl -xe`
- Monitor real-time: `watch -n 1 'ps aux | grep node'`
- Interactive process viewer: `htop` (filter with F4: node)
