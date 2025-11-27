#!/bin/bash

# Run lavalink-chooser with PM2
# Usage: ./scripts/run-lavalink-chooser-pm2.sh [options]
# Options:
#   --choose, -c    Interactive mode
#   --dry-run       Test only, don't update .env
#   --v4-only       Only test v4 servers
#   --stop          Stop the PM2 process
#   --status        Show PM2 status

cd "$(dirname "$0")/.." || exit

case "$1" in
    --stop)
        echo "🛑 Stopping lavalink-chooser..."
        pm2 stop lavalink-chooser
        pm2 delete lavalink-chooser
        ;;
    --status)
        echo "📊 Lavalink Chooser Status:"
        pm2 info lavalink-chooser
        ;;
    --logs)
        echo "📋 Viewing logs..."
        pm2 logs lavalink-chooser
        ;;
    *)
        echo "🚀 Starting lavalink-chooser with PM2..."
        
        # Build args
        ARGS=""
        if [[ "$*" == *"--choose"* ]] || [[ "$*" == *"-c"* ]]; then
            ARGS="$ARGS --choose"
        fi
        if [[ "$*" == *"--dry-run"* ]]; then
            ARGS="$ARGS --dry-run"
        fi
        if [[ "$*" == *"--v4-only"* ]] || [[ "$*" == *"--v4"* ]]; then
            ARGS="$ARGS --v4-only"
        fi
        if [[ "$*" == *"--verbose"* ]] || [[ "$*" == *"-v"* ]]; then
            ARGS="$ARGS --verbose"
        fi
        
        # Start with PM2
        pm2 start scripts/lavalink-chooser.mjs \
            --name lavalink-chooser \
            --no-autorestart \
            --max-memory-restart 200M \
            --log ./logs/lavalink-chooser.log \
            --time \
            -- $ARGS
        
        echo ""
        echo "✅ Started! View logs with: pm2 logs lavalink-chooser"
        echo "📊 Check status with: pm2 status"
        echo "🛑 Stop with: ./scripts/run-lavalink-chooser-pm2.sh --stop"
        ;;
esac
