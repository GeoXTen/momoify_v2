# AlmaLinux Compatibility Report

## ✅ Summary
The bot and `lavalink-chooser.mjs` script are **fully compatible** with AlmaLinux.

## Cross-Platform Features

### 1. **Lavalink Chooser Script** ✅
- Uses platform detection: `process.platform === 'win32'`
- Automatically uses correct npm command:
  - Windows: `npm.cmd`
  - Linux: `npm`
- Properly detaches processes on both platforms
- Uses cross-platform modules: `fs`, `https`, `http`

### 2. **Path Handling** ✅
- Uses `path.join()` and `path.dirname()` for cross-platform paths
- No hardcoded Windows paths (no `C:\` or backslashes)
- Works with both `/` (Linux) and `\` (Windows) separators

### 3. **Environment Variables** ✅
- Uses dotenv with `override: true` to ensure `.env` is loaded
- No platform-specific environment variable handling

### 4. **Dependencies** ⚠️ (Requires Linux setup)
The `canvas` package requires system libraries on Linux:

#### AlmaLinux Installation:
```bash
# Install required system dependencies for canvas
sudo dnf install -y cairo-devel pango-devel libjpeg-turbo-devel giflib-devel pixman-devel

# Or if using older package names:
sudo yum install -y cairo-devel pango-devel libjpeg-turbo-devel giflib-devel pixman-devel

# Then install npm packages
npm install
```

### 5. **File System** ✅
- No Windows-specific file operations
- All file reads/writes use Node.js `fs` module
- Line endings handled automatically by Node.js

## AlmaLinux-Specific Notes

### Running the Script
```bash
# Make scripts executable (one-time setup)
chmod +x scripts/*.sh

# Run lavalink chooser and auto-start bot
node scripts/lavalink-chooser.mjs --start-bot

# Or use npm script
npm start
```

### Process Management
```bash
# Check running bot processes
ps aux | grep node

# Stop all node processes
pkill -f node

# Or stop specific process by PID
kill <PID>
```

### Using PM2 (Recommended for Production)
```bash
# Install PM2 globally
npm install -g pm2

# Start bot with PM2
pm2 start src/index.js --name momoify-bot

# Or use the lavalink chooser with PM2
pm2 start ecosystem.config.mjs
```

## Testing on AlmaLinux

### Quick Test:
```bash
# 1. Test the lavalink chooser (dry run)
node scripts/lavalink-chooser.mjs --dry-run --verbose

# 2. Run the chooser and start bot
node scripts/lavalink-chooser.mjs --start-bot

# 3. Check bot is running
curl http://localhost:3001/api/health

# 4. Check Lavalink connection
curl http://localhost:3001/api/lavalink
```

## Known Differences

| Feature | Windows | AlmaLinux | Status |
|---------|---------|-----------|--------|
| npm command | `npm.cmd` | `npm` | ✅ Auto-detected |
| Path separator | `\` | `/` | ✅ Handled by Node.js |
| Process spawning | Works | Works | ✅ Platform-specific code |
| Canvas library | Included | Requires system libs | ⚠️ Needs setup |
| Font loading | Optional | Optional | ✅ Fails gracefully |
| .env loading | Works | Works | ✅ Cross-platform |
| Lavalink connection | Works | Works | ✅ Network-based |

## Potential Issues & Solutions

### Issue 1: Canvas Installation Fails
**Solution:**
```bash
sudo dnf install -y cairo-devel pango-devel libjpeg-turbo-devel giflib-devel pixman-devel
npm rebuild canvas
```

### Issue 2: Permission Denied on Scripts
**Solution:**
```bash
chmod +x scripts/*.sh
```

### Issue 3: Port 3001 Already in Use
**Solution:**
```bash
# Change API_PORT in .env
echo "API_PORT=3002" >> .env
```

### Issue 4: Bot Stops When SSH Session Ends
**Solution:**
```bash
# Use PM2 for persistent processes
pm2 start src/index.js --name momoify-bot
pm2 save
pm2 startup  # Follow the instructions
```

## Conclusion

✅ **The bot is fully compatible with AlmaLinux**

The codebase is well-written with cross-platform compatibility in mind. The only requirement is installing the system dependencies for the `canvas` package, which is optional (only needed for the quote/image generation feature).

The `lavalink-chooser.mjs` script will work perfectly on AlmaLinux with no modifications needed.
