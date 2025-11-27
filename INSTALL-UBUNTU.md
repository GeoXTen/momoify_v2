# 🐧 Installing Momoify Bot on Ubuntu Server

Complete guide for setting up the Discord music bot with local Lavalink on Ubuntu Server.

---

## 📋 Prerequisites

- Ubuntu Server 20.04 LTS or newer
- Root or sudo access
- At least 2GB RAM
- Internet connection

---

## 🚀 Step-by-Step Installation

### 1️⃣ Update System

```bash
sudo apt update && sudo apt upgrade -y
```

### 2️⃣ Install Node.js (v24.x)

```bash
# Install Node.js 24.x (required by the bot)
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node -v    # Should show v24.x.x
npm -v     # Should show npm version
```

### 3️⃣ Install Java 17 (for Lavalink)

```bash
# Install Java 17
sudo apt install -y openjdk-17-jdk

# Verify installation
java -version  # Should show Java 17
```

### 4️⃣ Install PM2 (Process Manager)

```bash
# Install PM2 globally
sudo npm install -g pm2

# Verify installation
pm2 -v
```

### 5️⃣ Install Git

```bash
sudo apt install -y git
```

### 6️⃣ Clone/Upload Bot Files

**Option A: Clone from Git (if you have a repo)**
```bash
cd /opt
sudo git clone <your-repo-url> momoify-bot
cd momoify-bot
```

**Option B: Upload via SCP/SFTP**
```bash
# On your local machine (Windows/Mac)
scp -r /path/to/bot_v2 user@server-ip:/opt/momoify-bot

# Then on the server
cd /opt/momoify-bot
```

### 7️⃣ Install Bot Dependencies

```bash
cd /opt/momoify-bot
npm install
```

### 8️⃣ Configure Environment Variables

```bash
# Copy example env file
cp .env.example .env

# Edit the .env file
nano .env
```

**Required settings in `.env`:**
```env
# Discord Bot Configuration
DISCORD_TOKEN=your_discord_bot_token_here
CLIENT_ID=your_discord_client_id_here

# Local Lavalink Configuration
LAVALINK_HOST=localhost
LAVALINK_PORT=2333
LAVALINK_PASSWORD=youshallnotpass
LAVALINK_SECURE=false

# Bot Settings
PREFIX=/
BOT_ACTIVITY=music
BOT_STATUS=online
OWNER_ID=your_discord_user_id_here

# Spotify (Optional)
SPOTIFY_CLIENT_ID=e311e16239d2491fb6c91f90facb0371
SPOTIFY_CLIENT_SECRET=cb3f5ae4c54542d09528c07318ba8060

# API Settings
API_PORT=3001
```

**Save and exit:** `Ctrl + X`, then `Y`, then `Enter`

### 9️⃣ Download Lavalink

```bash
# Create lavalink directory if it doesn't exist
mkdir -p lavalink
cd lavalink

# Download Lavalink v4.1.1
wget https://github.com/lavalink-devs/Lavalink/releases/download/4.1.1/Lavalink.jar

# Verify download
ls -lh Lavalink.jar
```

### 🔟 Install Lavalink Plugins

```bash
# Create plugins directory
mkdir -p plugins
cd plugins

# Download YouTube plugin
wget https://github.com/lavalink-devs/youtube-source/releases/download/1.16.0/youtube-plugin-1.16.0.jar -O youtube-plugin.jar

# Download Spotify plugin (LavaSrc)
wget https://github.com/topi314/LavaSrc/releases/download/4.8.1/lavasrc-plugin-4.8.1.jar -O lavasrc-plugin.jar

# Go back to bot root
cd ../..

# Verify plugins
ls -lh lavalink/plugins/
```

### 1️⃣1️⃣ Configure Lavalink

The `application.yml` should already be configured. If not, create it:

```bash
nano lavalink/application.yml
```

Paste the configuration (already in your files, but here's the template):

```yaml
server:
  port: 2333
  address: 0.0.0.0

lavalink:
  plugins:
    - dependency: "dev.lavalink.youtube:youtube-plugin:1.16.0"
      repository: "https://maven.lavalink.dev/releases"
    - dependency: "com.github.topi314.lavasrc:lavasrc-plugin:4.8.1"
      repository: "https://maven.lavalink.dev/releases"
  server:
    password: "youshallnotpass"
    sources:
      youtube: false
      bandcamp: true
      soundcloud: true
      twitch: true
      vimeo: true
      http: true
      local: false
    bufferDurationMs: 400
    frameBufferDurationMs: 5000
    youtubePlaylistLoadLimit: 100
    playerUpdateInterval: 5
    youtubeSearchEnabled: true
    soundcloudSearchEnabled: true
    gc-warnings: true

metrics:
  prometheus:
    enabled: false
    endpoint: /metrics

sentry:
  dsn: ""
  environment: ""

logging:
  file:
    path: ./logs/
  level:
    root: INFO
    lavalink: INFO
  logback:
    rollingpolicy:
      max-file-size: 10MB
      max-history: 7

plugins:
  lavasrc:
    providers:
      - "ytsearch:\"%ISRC%\""
      - "ytsearch:%QUERY%"
    sources:
      spotify: true
      applemusic: false
      deezer: false
      yandexmusic: false
      flowerytts: false
      youtube: true
    spotify:
      clientId: "e311e16239d2491fb6c91f90facb0371"
      clientSecret: "cb3f5ae4c54542d09528c07318ba8060"
      countryCode: "US"
      playlistLoadLimit: 100
      albumLoadLimit: 100
```

### 1️⃣2️⃣ Make Start Scripts Executable

```bash
chmod +x start-bot-local.sh
chmod +x stop-all.sh
```

### 1️⃣3️⃣ Start the Bot

```bash
# Start bot with local Lavalink
./start-bot-local.sh
```

**Or manually:**

```bash
# Start Lavalink in background
cd lavalink
nohup java -jar Lavalink.jar > lavalink.log 2>&1 &
cd ..

# Wait for Lavalink to start
sleep 15

# Start bot with PM2
pm2 start src/index.js --name momoify-bot

# Save PM2 configuration
pm2 save
```

### 1️⃣4️⃣ Enable Auto-Start on Boot

```bash
# Generate PM2 startup script
pm2 startup

# Copy and run the command it outputs (will look like):
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u username --hp /home/username

# Save current PM2 processes
pm2 save
```

### 1️⃣5️⃣ Configure Firewall (Optional)

```bash
# If using UFW firewall
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 3001/tcp    # Bot API (optional, if you want external access)
sudo ufw enable
```

**Note:** Port 2333 (Lavalink) should NOT be exposed publicly for security.

---

## 📊 Useful Commands

### Check Status
```bash
pm2 status                 # Check bot status
pm2 logs momoify-bot      # View bot logs
pm2 monit                 # Monitor resources
```

### Control Bot
```bash
pm2 restart momoify-bot   # Restart bot
pm2 stop momoify-bot      # Stop bot
pm2 start momoify-bot     # Start bot
pm2 delete momoify-bot    # Remove from PM2
```

### Check Lavalink
```bash
ps aux | grep Lavalink    # Check if Lavalink is running
netstat -tuln | grep 2333 # Check if port 2333 is listening
tail -f lavalink/logs/*.log  # View Lavalink logs
```

### Stop Everything
```bash
./stop-all.sh             # Use the stop script
# OR manually:
pm2 stop momoify-bot
pm2 delete momoify-bot
pkill -f Lavalink.jar
```

---

## 🔧 Troubleshooting

### Bot won't connect to Discord
```bash
# Check if token is correct in .env
nano .env

# Check bot logs
pm2 logs momoify-bot --lines 100
```

### Music not playing
```bash
# Check if Lavalink is running
netstat -tuln | grep 2333

# Check Lavalink logs
tail -f lavalink/logs/*.log

# Restart Lavalink
pkill -f Lavalink.jar
cd lavalink && nohup java -jar Lavalink.jar > lavalink.log 2>&1 &
```

### Out of Memory
```bash
# Increase Lavalink memory (edit start-bot-local.sh)
# Change: java -jar Lavalink.jar
# To: java -Xmx2G -jar Lavalink.jar

# Or set PM2 memory limit
pm2 start src/index.js --name momoify-bot --max-memory-restart 500M
```

### Check System Resources
```bash
htop                      # Interactive process viewer
free -h                   # Check RAM usage
df -h                     # Check disk space
```

---

## 🔐 Security Best Practices

### 1. Create a dedicated user
```bash
sudo adduser momoify
sudo usermod -aG sudo momoify
su - momoify
```

### 2. Use environment file permissions
```bash
chmod 600 .env
```

### 3. Don't expose Lavalink port
- Keep Lavalink on localhost only
- Don't open port 2333 in firewall

### 4. Keep system updated
```bash
sudo apt update && sudo apt upgrade -y
```

---

## 📈 Performance Optimization

### Increase Java heap for Lavalink (if needed)
```bash
# Edit start script or run manually:
java -Xms512M -Xmx2G -jar Lavalink.jar
```

### Set PM2 with clustering (advanced)
```bash
pm2 start src/index.js --name momoify-bot -i 1 --max-memory-restart 500M
```

---

## ✅ Verification Checklist

- [ ] Node.js v24.x installed
- [ ] Java 17 installed
- [ ] PM2 installed
- [ ] Bot files uploaded
- [ ] Dependencies installed (`npm install`)
- [ ] `.env` configured
- [ ] Lavalink.jar downloaded
- [ ] Plugins downloaded
- [ ] `application.yml` configured
- [ ] Bot started successfully
- [ ] Lavalink running on port 2333
- [ ] Bot shows online in Discord
- [ ] Music plays successfully
- [ ] PM2 auto-start configured

---

## 🆘 Need Help?

Check logs:
```bash
pm2 logs momoify-bot --lines 200
tail -f lavalink/logs/*.log
```

System info:
```bash
node -v
java -version
pm2 -v
free -h
df -h
```

---

**Installation complete! Your bot should now be running on Ubuntu Server.** 🎉
