#!/bin/bash

echo "=========================================="
echo "Rebuilding Canvas for AlmaLinux"
echo "=========================================="
echo ""

# Navigate to bot directory
cd /home/geo/bot_v2

echo "Step 1: Removing old canvas installation..."
npm uninstall canvas

echo ""
echo "Step 2: Installing canvas 2.11.2 (AlmaLinux compatible)..."
npm install canvas@2.11.2

echo ""
echo "Step 3: Testing canvas..."
node check-canvas-path.js

echo ""
echo "=========================================="
echo "If test passed, restart the bot:"
echo "  pm2 restart momoify-bot"
echo "=========================================="
