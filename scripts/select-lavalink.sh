#!/bin/bash
# Quick Lavalink server selector for Unix/Linux/Mac

echo "🎯 Selecting best Lavalink server..."
node scripts/lavalink-chooser.mjs "$@"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Done! Restart your bot to use the new server."
fi
