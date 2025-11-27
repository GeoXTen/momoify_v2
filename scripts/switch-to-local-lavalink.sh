#!/bin/bash

# Switch to Local Lavalink Server
# This script updates .env to use localhost Lavalink

cd "$(dirname "$0")/.." || exit

echo "🔄 Switching to Local Lavalink..."

# Backup current .env
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)

# Update .env file
if [ -f .env ]; then
    # Comment out external Lavalink settings
    sed -i 's/^LAVALINK_HOST=lava/#LAVALINK_HOST=lava/' .env
    sed -i 's/^LAVALINK_PORT=443/#LAVALINK_PORT=443/' .env
    sed -i 's/^LAVALINK_PASSWORD=https/#LAVALINK_PASSWORD=https/' .env
    sed -i 's/^LAVALINK_SECURE=true/#LAVALINK_SECURE=true/' .env
    
    # Check if local settings already exist
    if grep -q "^# LAVALINK_HOST=localhost" .env; then
        # Uncomment local settings
        sed -i 's/^# LAVALINK_HOST=localhost/LAVALINK_HOST=localhost/' .env
        sed -i 's/^# LAVALINK_PORT=2333/LAVALINK_PORT=2333/' .env
        sed -i 's/^# LAVALINK_PASSWORD=youshallnotpass/LAVALINK_PASSWORD=youshallnotpass/' .env
        sed -i 's/^# LAVALINK_SECURE=false/LAVALINK_SECURE=false/' .env
    else
        # Add local settings if they don't exist
        echo "" >> .env
        echo "# Local Lavalink Server" >> .env
        echo "LAVALINK_HOST=localhost" >> .env
        echo "LAVALINK_PORT=2333" >> .env
        echo "LAVALINK_PASSWORD=youshallnotpass" >> .env
        echo "LAVALINK_SECURE=false" >> .env
    fi
    
    echo "✅ .env file updated!"
    echo ""
    echo "Current Lavalink Configuration:"
    cat .env | grep LAVALINK | grep -v "^#"
    echo ""
else
    echo "❌ .env file not found!"
    exit 1
fi

# Check if Lavalink is running
if pm2 describe lavalink > /dev/null 2>&1; then
    echo "✅ Lavalink is running"
else
    echo "⚠️  Lavalink is not running"
    echo "Start it with: pm2 start ecosystem.lavalink.config.mjs"
fi

# Ask to restart bot
echo ""
read -p "Restart bot to apply changes? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🔄 Restarting bot..."
    pm2 restart all --update-env
    echo "✅ Bot restarted!"
else
    echo "⚠️  Remember to restart the bot manually:"
    echo "  pm2 restart all --update-env"
fi
