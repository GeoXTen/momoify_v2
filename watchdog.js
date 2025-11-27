import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

async function checkBot() {
    try {
        console.log(`[${new Date().toISOString()}] Checking bot status...`);
        
        // Check if PM2 process is running
        const { stdout } = await execAsync('pm2 jlist');
        const processes = JSON.parse(stdout);
        
        const botProcess = processes.find(p => p.name === 'geomsc');
        
        if (!botProcess) {
            console.log('[ERROR] Bot process not found! Starting...');
            await execAsync('pm2 start ecosystem.config.cjs');
            console.log('[SUCCESS] Bot started!');
            return;
        }
        
        // Check if process is online
        if (botProcess.pm2_env.status !== 'online') {
            console.log(`[WARNING] Bot status: ${botProcess.pm2_env.status}. Restarting...`);
            await execAsync('pm2 restart geomsc');
            console.log('[SUCCESS] Bot restarted!');
            return;
        }
        
        // Check uptime (if less than 30 seconds, it might be crash-looping)
        const uptime = Date.now() - botProcess.pm2_env.pm_uptime;
        if (uptime < 30000) {
            console.log(`[WARNING] Bot uptime is only ${Math.floor(uptime / 1000)}s - might be crash-looping`);
        }
        
        // Check memory usage
        const memoryMB = Math.floor(botProcess.monit.memory / 1024 / 1024);
        console.log(`[INFO] Bot status: ${botProcess.pm2_env.status}, Memory: ${memoryMB}MB, Uptime: ${Math.floor(uptime / 1000)}s`);
        
        // Check if memory is too high
        if (memoryMB > 450) {
            console.log(`[WARNING] High memory usage (${memoryMB}MB). Restarting...`);
            await execAsync('pm2 restart geomsc');
            console.log('[SUCCESS] Bot restarted due to high memory!');
        }
        
        console.log('[OK] Bot is running correctly!');
        
    } catch (error) {
        console.error(`[ERROR] Watchdog failed: ${error.message}`);
    }
}

// Run check immediately on start
checkBot();

// Then run every 5 minutes
setInterval(checkBot, CHECK_INTERVAL);

console.log(`Watchdog started! Checking every ${CHECK_INTERVAL / 1000 / 60} minutes...`);
