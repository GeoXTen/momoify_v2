# Bot Scripts

This directory contains utility scripts for managing the Discord music bot.

## 🎵 Lavalink Server Management

### `lavalink-chooser.mjs`
Automatically tests and selects the best Lavalink server from your server list.

**Usage:**
```bash
# Auto-select best server
node scripts/lavalink-chooser.mjs

# Interactive mode - choose from top servers
node scripts/lavalink-chooser.mjs --choose

# Test without updating .env
node scripts/lavalink-chooser.mjs --dry-run

# Verbose output
node scripts/lavalink-chooser.mjs --verbose

# Only test v4 servers
node scripts/lavalink-chooser.mjs --v4-only

# Show top 10 servers
node scripts/lavalink-chooser.mjs --choose 10
```

**Quick shortcuts:**
```bash
# Linux/Mac
./scripts/select-lavalink.sh --choose

# Windows
scripts\select-lavalink.bat --choose
```

### `test-lavalink.mjs`
Test your current Lavalink server configuration.

**Usage:**
```bash
node scripts/test-lavalink.mjs
```

## 🐧 Ubuntu/Linux Deployment

### `ubuntu-install.sh`
Complete installation script for Ubuntu/Debian systems.

**Usage:**
```bash
chmod +x scripts/ubuntu-install.sh
./scripts/ubuntu-install.sh
```

**What it installs:**
- Node.js 20.x LTS
- Git
- Build tools (gcc, g++, python3)
- Canvas dependencies (for image generation)
- PM2 process manager
- Bot dependencies

### `ubuntu-deploy.sh`
Quick deployment/update script.

**Usage:**
```bash
chmod +x scripts/ubuntu-deploy.sh
./scripts/ubuntu-deploy.sh
```

**What it does:**
- Installs/updates dependencies
- Starts or restarts the bot with PM2
- Shows status and logs

### `ubuntu-uninstall.sh`
Removes the bot from PM2.

**Usage:**
```bash
chmod +x scripts/ubuntu-uninstall.sh
./scripts/ubuntu-uninstall.sh
```

### `pm2-start.sh`
Quick start script for PM2 with optimal settings.

**Usage:**
```bash
chmod +x scripts/pm2-start.sh
./scripts/pm2-start.sh
```

## 🪟 Windows PM2 Management

### `pm2-lavalink.js`
Legacy PM2 starter with Lavalink auto-selection.

**Usage:**
```bash
node scripts/pm2-lavalink.js
```

## 📋 Examples

### First-time setup on Ubuntu:
```bash
# 1. Install prerequisites
./scripts/ubuntu-install.sh

# 2. Configure environment
cp .env.example .env
nano .env

# 3. Select best Lavalink server
node scripts/lavalink-chooser.mjs --choose

# 4. Deploy bot
./scripts/ubuntu-deploy.sh
```

### Update bot on Ubuntu:
```bash
# Pull changes
git pull

# Redeploy
./scripts/ubuntu-deploy.sh
```

### Switch Lavalink server:
```bash
# Auto-select best
node scripts/lavalink-chooser.mjs

# Or choose manually
node scripts/lavalink-chooser.mjs --choose

# Restart bot
pm2 restart music-bot
```

### Test current server:
```bash
node scripts/test-lavalink.mjs
```

## 🔧 Environment Variables

Scripts respect these environment variables:

- `LAVALINK_LIST` - Path to server list file (default: `lavalink server lis.txt`)
- `ENV_PATH` - Path to .env file (default: `.env`)
- `PING_SAMPLES` - Number of ping samples per server (default: `3`)
- `HTTP_TIMEOUT` - HTTP timeout in ms (default: `5000`)

**Example:**
```bash
LAVALINK_LIST=my-servers.txt node scripts/lavalink-chooser.mjs
```

## 📝 Notes

- Make scripts executable on Linux/Mac: `chmod +x scripts/*.sh`
- Windows users can use `.bat` files or run `.mjs` directly with `node`
- All temporary files created by scripts use `tmp_rovodev_` prefix
- Scripts are designed to be safe and reversible

## 🆘 Troubleshooting

**"No servers found"**
- Check `lavalink server lis.txt` exists and contains server configurations

**"All servers offline"**
- Verify your internet connection
- Try with `--verbose` flag to see detailed errors
- Check firewall settings

**PM2 not found**
- Install PM2: `npm install -g pm2` or `sudo npm install -g pm2`

**Permission denied on Ubuntu**
- Make script executable: `chmod +x scripts/ubuntu-install.sh`
- Use `sudo` for system package installation

## 🔗 Related Files

- `lavalink server lis.txt` - List of available Lavalink servers
- `.env` - Environment configuration
- `ecosystem.config.js` - PM2 configuration
