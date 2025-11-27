# Test Local Lavalink on Windows

Quick guide to test local Lavalink setup on your Windows machine before deploying to Ubuntu.

## 📋 Prerequisites

### 1. Install Java 17 or Higher

Download and install from: https://adoptium.net/

Or use Chocolatey:
```powershell
choco install temurin17
```

Verify installation:
```powershell
java -version
```

### 2. Download Lavalink.jar

**Option A: Automatic (using PowerShell)**
```powershell
# Download to lavalink folder
Invoke-WebRequest -Uri "https://github.com/lavalink-devs/Lavalink/releases/download/4.0.7/Lavalink.jar" -OutFile "lavalink\Lavalink.jar"
```

**Option B: Manual**
1. Go to: https://github.com/lavalink-devs/Lavalink/releases/latest
2. Download `Lavalink.jar`
3. Place it in the `lavalink` folder

## 🚀 Quick Test (All-in-One)

```batch
scripts\test-local-lavalink.bat
```

This script will:
- ✅ Check Java installation
- ✅ Download Lavalink.jar if needed
- ✅ Update .env file
- ✅ Start Lavalink with PM2
- ✅ Test the connection

## 🔧 Manual Testing Steps

### Step 1: Switch to Local Configuration

```batch
scripts\switch-to-local-lavalink.bat
```

This updates your `.env` file to use `localhost:2333`

### Step 2: Start Lavalink

**Option A: Using npm scripts**
```batch
npm run lavalink:start
```

**Option B: Using batch script**
```batch
scripts\start-lavalink.bat
```

**Option C: Manual PM2 command**
```powershell
pm2 start "java -jar Lavalink.jar" --name lavalink --cwd "%cd%\lavalink"
```

**Option D: Direct Java (no PM2)**
```batch
cd lavalink
java -jar Lavalink.jar
```

### Step 3: Verify Lavalink is Running

**Check PM2 status:**
```powershell
pm2 list
```

**Test HTTP endpoint:**
```powershell
curl http://localhost:2333/version
```

**Or in PowerShell:**
```powershell
Invoke-WebRequest -Uri "http://localhost:2333/version"
```

Expected response: `{"version":"4.0.7","buildTime":...}`

**View logs:**
```powershell
pm2 logs lavalink
```

### Step 4: Start Your Bot

```powershell
pm2 restart all --update-env
```

Or start fresh:
```powershell
pm2 start ecosystem.config.mjs
```

### Step 5: Test in Discord

Run these commands:
```
/lavalink
/play never gonna give you up
```

Expected `/lavalink` output:
- 🏠 Host: `localhost`
- 🔌 Port: `2333`
- 🔐 Password: `youshallnotpass`
- 🛡️ Secure: ❌ No
- 🟢 Status: Connected

## 📊 PM2 Management

```powershell
# View all processes
pm2 list

# View Lavalink logs
pm2 logs lavalink

# View bot logs
pm2 logs momoify-bot

# Restart Lavalink
pm2 restart lavalink

# Stop Lavalink
pm2 stop lavalink

# Delete from PM2
pm2 delete lavalink

# Monitor in real-time
pm2 monit
```

## 🐛 Troubleshooting

### Java Not Found

**Error:** `'java' is not recognized as an internal or external command`

**Fix:**
1. Install Java from https://adoptium.net/
2. Restart your terminal/PowerShell
3. Verify: `java -version`

### Port 2333 Already in Use

**Check what's using port 2333:**
```powershell
netstat -ano | findstr :2333
```

**Kill the process:**
```powershell
# Replace PID with the process ID from above command
taskkill /PID <PID> /F
```

### Lavalink Won't Start

**Check logs:**
```powershell
pm2 logs lavalink --lines 50
```

**Try starting manually to see errors:**
```batch
cd lavalink
java -jar Lavalink.jar
```

### Bot Can't Connect

1. **Check Lavalink is running:**
   ```powershell
   pm2 list
   curl http://localhost:2333/version
   ```

2. **Verify .env file:**
   ```powershell
   type .env | findstr LAVALINK
   ```

3. **Restart bot with updated environment:**
   ```powershell
   pm2 restart all --update-env
   ```

4. **Check bot logs:**
   ```powershell
   pm2 logs momoify-bot
   ```

### Memory Issues

If Lavalink uses too much memory:

```powershell
pm2 delete lavalink
pm2 start "java -Xmx512M -jar Lavalink.jar" --name lavalink --cwd "%cd%\lavalink"
```

## 🔄 Switch Back to External Lavalink

```powershell
# Run the lavalink chooser
node scripts\lavalink-chooser.mjs --choose

# Restart bot
pm2 restart all --update-env
```

## ✅ Quick Verification Checklist

- [ ] Java is installed (`java -version`)
- [ ] Lavalink.jar exists in `lavalink` folder
- [ ] `.env` has `LAVALINK_HOST=localhost`
- [ ] Lavalink is running (`pm2 list`)
- [ ] Port 2333 is responding (`curl http://localhost:2333/version`)
- [ ] Bot is running (`pm2 list`)
- [ ] `/lavalink` shows localhost connection
- [ ] Music plays (`/play test`)

## 📝 NPM Scripts Available

```json
"lavalink:start": "pm2 start ecosystem.lavalink.config.mjs",
"lavalink:stop": "pm2 stop lavalink",
"lavalink:restart": "pm2 restart lavalink",
"lavalink:logs": "pm2 logs lavalink",
"lavalink:local": "bash scripts/switch-to-local-lavalink.sh"
```

## 🎯 Expected Results

After successful setup:

1. **PM2 Status:**
   ```
   ┌─────┬──────────────┬─────────┬─────────┬───────────┐
   │ id  │ name         │ mode    │ status  │ cpu       │
   ├─────┼──────────────┼─────────┼─────────┼───────────┤
   │ 0   │ lavalink     │ fork    │ online  │ 2%        │
   │ 1   │ momoify-bot  │ fork    │ online  │ 1%        │
   └─────┴──────────────┴─────────┴─────────┴───────────┘
   ```

2. **Lavalink Response:**
   ```json
   {"version":"4.0.7","buildTime":1234567890}
   ```

3. **Discord `/lavalink` Command:**
   - Shows localhost connection
   - Status: Connected
   - All features working

4. **Music Playback:**
   - `/play` works
   - Queue functions work
   - All music commands functional

## 💡 Tips

- Keep a terminal open with `pm2 logs lavalink` to monitor
- Use `pm2 monit` for real-time monitoring
- Lavalink takes ~5-10 seconds to fully start
- First song might take longer to load (cache warming)
- Local Lavalink is faster than external servers for local testing

## 🚀 Next Steps After Testing

Once local testing works on Windows:
1. Deploy to Ubuntu server using `SETUP-LOCAL-LAVALINK.md`
2. Configure PM2 startup for auto-start on reboot
3. Set up monitoring and logging
4. Benchmark performance vs external servers
