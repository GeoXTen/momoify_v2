# Lavalink Chooser PM2 Setup

This guide shows you how to run the lavalink-chooser.mjs script with PM2 on your Ubuntu server.

## Quick Start

### Option 1: Run Once with PM2 (Manual)

```bash
# Run the chooser once (auto-select best server)
npm run chooser:pm2-auto

# Run with interactive selection
npm run chooser:pm2-interactive

# View logs
npm run chooser:pm2-logs

# Stop the process
npm run chooser:pm2-stop
```

### Option 2: Run with Cron (Automatic Periodic Updates)

```bash
# Start with hourly cron schedule
pm2 start ecosystem.lavalink-chooser.config.mjs

# This will run the chooser every hour automatically
# View status
pm2 status lavalink-chooser

# View logs
pm2 logs lavalink-chooser

# Stop
pm2 stop lavalink-chooser
pm2 delete lavalink-chooser
```

### Option 3: Using the Shell Script (Recommended for Ubuntu)

```bash
# Make the script executable (first time only)
chmod +x scripts/run-lavalink-chooser-pm2.sh

# Run auto-select
./scripts/run-lavalink-chooser-pm2.sh

# Run interactive mode
./scripts/run-lavalink-chooser-pm2.sh --choose

# Dry run (test only)
./scripts/run-lavalink-chooser-pm2.sh --dry-run --verbose

# V4 servers only
./scripts/run-lavalink-chooser-pm2.sh --v4-only

# Check status
./scripts/run-lavalink-chooser-pm2.sh --status

# View logs
./scripts/run-lavalink-chooser-pm2.sh --logs

# Stop
./scripts/run-lavalink-chooser-pm2.sh --stop
```

## Advanced Configuration

### Modify Cron Schedule

Edit `ecosystem.lavalink-chooser.config.mjs` and change the `cron_restart` line:

```javascript
cron_restart: '0 * * * *',  // Every hour
// cron_restart: '0 */6 * * *',  // Every 6 hours
// cron_restart: '0 0 * * *',  // Daily at midnight
// cron_restart: '*/30 * * * *',  // Every 30 minutes
```

### Custom Arguments

You can pass any lavalink-chooser arguments:

```bash
# Show top 5 servers only
pm2 start scripts/lavalink-chooser.mjs --name lavalink-chooser -- --top 5 --verbose

# V4 servers with interactive selection
pm2 start scripts/lavalink-chooser.mjs --name lavalink-chooser -- --v4-only --choose

# Dry run with verbose output
pm2 start scripts/lavalink-chooser.mjs --name lavalink-chooser -- --dry-run --verbose
```

## PM2 Management Commands

```bash
# Start
pm2 start ecosystem.lavalink-chooser.config.mjs

# Stop
pm2 stop lavalink-chooser

# Restart
pm2 restart lavalink-chooser

# Delete from PM2
pm2 delete lavalink-chooser

# View detailed info
pm2 info lavalink-chooser

# Monitor in real-time
pm2 monit

# View logs
pm2 logs lavalink-chooser

# Clear logs
pm2 flush lavalink-chooser
```

## Save PM2 Configuration

To ensure the lavalink-chooser starts on server reboot:

```bash
# Save the current PM2 process list
pm2 save

# Setup PM2 to start on boot
pm2 startup

# Follow the instructions printed by the command above
```

## Logging

Logs are stored in:
- `./logs/lavalink-chooser-out.log` - Standard output
- `./logs/lavalink-chooser-error.log` - Error output

## Troubleshooting

### Permission Denied on Ubuntu

```bash
chmod +x scripts/run-lavalink-chooser-pm2.sh
chmod +x scripts/lavalink-chooser.mjs
```

### Chooser Not Finding Servers

Check that the server list file exists:
```bash
ls -la "lavalink server lis.txt"
```

### PM2 Not Installed

```bash
npm install -g pm2
```

### View Full Logs

```bash
pm2 logs lavalink-chooser --lines 100
```

## Integration with Main Bot

To automatically update the Lavalink server before starting your bot:

```bash
# Run chooser, then start bot with PM2
npm run chooser:pm2-auto && pm2 start ecosystem.config.mjs
```

Or create a combined startup script.
