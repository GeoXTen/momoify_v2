#!/usr/bin/env node
/**
 * Auto-restart wrapper for the bot
 * Restarts the bot if it crashes, with a delay to prevent crash loops
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

const RESTART_DELAY = 5000; // 5 seconds
const MAX_RESTARTS = 10;
const RESTART_WINDOW = 60000; // 1 minute

let restartCount = 0;
let lastRestartTime = Date.now();

function startBot() {
    console.log('\n\x1b[36m═══════════════════════════════════════\x1b[0m');
    console.log('\x1b[36m  Starting bot...\x1b[0m');
    console.log('\x1b[36m═══════════════════════════════════════\x1b[0m\n');

    const bot = spawn('node', ['src/index.js'], {
        cwd: rootDir,
        stdio: 'inherit',
        shell: true
    });

    bot.on('exit', (code, signal) => {
        const now = Date.now();
        
        // Reset restart count if outside window
        if (now - lastRestartTime > RESTART_WINDOW) {
            restartCount = 0;
        }
        
        restartCount++;
        lastRestartTime = now;

        if (code === 0) {
            console.log('\n\x1b[32m✓ Bot exited normally\x1b[0m');
            process.exit(0);
        }

        console.log(`\n\x1b[31m✗ Bot crashed with code ${code} (signal: ${signal})\x1b[0m`);
        console.log(`\x1b[33m  Restart count: ${restartCount}/${MAX_RESTARTS}\x1b[0m`);

        if (restartCount >= MAX_RESTARTS) {
            console.log('\x1b[31m✗ Too many restarts! Stopping...\x1b[0m');
            console.log('\x1b[33m  Check logs for errors\x1b[0m');
            process.exit(1);
        }

        console.log(`\x1b[33m  Restarting in ${RESTART_DELAY / 1000} seconds...\x1b[0m`);
        setTimeout(startBot, RESTART_DELAY);
    });

    bot.on('error', (error) => {
        console.error('\x1b[31m✗ Failed to start bot:\x1b[0m', error.message);
        setTimeout(startBot, RESTART_DELAY);
    });
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
    console.log('\n\x1b[33m⚠ Received SIGINT, shutting down...\x1b[0m');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n\x1b[33m⚠ Received SIGTERM, shutting down...\x1b[0m');
    process.exit(0);
});

console.log('\x1b[35m╔═══════════════════════════════════════╗\x1b[0m');
console.log('\x1b[35m║   Bot Auto-Restart Wrapper v1.0       ║\x1b[0m');
console.log('\x1b[35m╚═══════════════════════════════════════╝\x1b[0m');
console.log(`\x1b[90mMax restarts: ${MAX_RESTARTS} per ${RESTART_WINDOW / 1000}s\x1b[0m`);

startBot();
