#!/usr/bin/env node

// Quick PM2 + Lavalink selector script
import { spawn } from 'child_process';

const PM2_COMMAND = 'pm2 start src/index.js --name momoify-bot --watch --max-memory-restart 500M';

console.log('🎯 Selecting best Lavalink server and starting with PM2...\n');

// Run the lavalink selector with PM2 command
const child = spawn('node', [
  'scripts/auto-select-lavalink.mjs',
  PM2_COMMAND,
  '--choose'
], {
  stdio: 'inherit',
  shell: true
});

child.on('error', (error) => {
  console.error(`❌ Failed to run script: ${error.message}`);
  process.exit(1);
});

child.on('close', (code) => {
  process.exit(code);
});