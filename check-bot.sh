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
