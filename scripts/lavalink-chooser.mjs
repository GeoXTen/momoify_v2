#!/usr/bin/env node

/**
 * Lavalink Server Chooser
 * Automatically tests and selects the best Lavalink server
 * 
 * Usage:
 *   node scripts/lavalink-chooser.mjs [options]
 * 
 * Options:
 *   --dry-run        Test servers but don't update .env
 *   --verbose, -v    Show detailed output
 *   --choose, -c     Interactive mode - choose from top servers
 *   --v4-only        Only test Lavalink v4 servers
 *   --all, -a        Show all servers (default)
 *   --top N          Show only top N servers
 *   --timeout N      HTTP timeout in ms (default: 5000)
 *   --start-bot      Start the bot after selecting server

 */

import fs from 'fs';
import https from 'https';
import http from 'http';
import { performance } from 'perf_hooks';
import readline from 'readline';
import { spawn } from 'child_process';

// Parse --top argument
function getTopCount() {
  const topIndex = process.argv.findIndex(arg => arg === '--top');
  if (topIndex !== -1 && process.argv[topIndex + 1]) {
    const num = parseInt(process.argv[topIndex + 1]);
    if (!isNaN(num) && num > 0) return num;
  }
  return 999; // Show all by default
}

// Configuration
const CONFIG = {
  serverListPath: process.env.LAVALINK_LIST || 'lavalink server lis.txt',
  envPath: process.env.ENV_PATH || '.env',
  pingSamples: parseInt(process.env.PING_SAMPLES) || 3,
  httpTimeout: parseInt(process.env.HTTP_TIMEOUT) || 5000,
  dryRun: process.argv.includes('--dry-run'),
  verbose: process.argv.includes('--verbose') || process.argv.includes('-v'),
  interactive: process.argv.includes('--choose') || process.argv.includes('-c'),
  topCount: getTopCount(),
  onlyV4: process.argv.includes('--v4-only') || process.argv.includes('--v4'),
  startBot: process.argv.includes('--start-bot')
};

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

// Helper functions
const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  debug: (msg) => CONFIG.verbose && console.log(`${colors.dim}  ${msg}${colors.reset}`),
  header: (msg) => console.log(`\n${colors.bright}${colors.cyan}${msg}${colors.reset}\n`)
};

/**
 * Parse server list from file
 */
function parseServerList(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const servers = [];
    
    log.debug('Parsing server list...');
    
    // Method 1: Find JSON array with quoted keys (the proper JSON array)
    let arrayStart = -1;
    for (let i = 60; i < lines.length; i++) {
      if (lines[i].trim() === '[') {
        // Check if next few lines have quoted keys (proper JSON)
        const next10 = lines.slice(i, i + 10).join('\n');
        if (next10.includes('"name"')) {
          arrayStart = i;
          break;
        }
      }
    }
    
    if (arrayStart > 0) {
      log.debug(`Found JSON array at line ${arrayStart}`);
      
      const arrayLines = [];
      let depth = 0;
      
      for (let i = arrayStart; i < lines.length; i++) {
        arrayLines.push(lines[i]);
        
        for (const char of lines[i]) {
          if (char === '[') depth++;
          if (char === ']') depth--;
        }
        
        if (depth === 0 && lines[i].includes(']')) break;
      }
      
      const arrayText = arrayLines.join('\n').replace(/chttps:/g, 'https:'); // Fix typo
      
      try {
        const parsed = JSON.parse(arrayText);
        
        for (const server of parsed) {
          if (server.host && server.port && server.password && server.secure !== undefined) {
            servers.push({
              name: server.name || 'Unknown',
              host: server.host,
              port: parseInt(server.port),
              password: server.password,
              secure: server.secure,
              region: server.region || 'Unknown',
              version: server.version || 'v3'
            });
          }
        }
        
        log.debug(`Parsed ${parsed.length} servers from JSON array`);
      } catch (e) {
        log.debug(`Failed to parse JSON array: ${e.message}`);
      }
    }
    
    // Method 2: Parse JavaScript-style arrays (unquoted keys) - fallback
    if (servers.length === 0) {
      log.debug('Trying JavaScript-style array parsing...');
      
      // Find first array
      let jsArrayStart = -1;
      for (let i = 0; i < 65; i++) {
        if (lines[i].trim() === '[') {
          const next5 = lines.slice(i, i + 5).join('\n');
          if (next5.includes('name:') && next5.includes('host:')) {
            jsArrayStart = i;
            break;
          }
        }
      }
      
      if (jsArrayStart > 0) {
        log.debug(`Found JS array at line ${jsArrayStart}`);
        
        const arrayLines = [];
        let depth = 0;
        
        for (let i = jsArrayStart; i < lines.length && i < 65; i++) {
          arrayLines.push(lines[i]);
          
          for (const char of lines[i]) {
            if (char === '[') depth++;
            if (char === ']') depth--;
          }
          
          if (depth === 0 && lines[i].includes(']')) break;
        }
        
        // Convert JS object notation to JSON
        let jsonText = arrayLines.join('\n')
          .replace(/(\w+):/g, '"$1":')
          .replace(/chttps:/g, 'https:');
        
        try {
          const parsed = JSON.parse(jsonText);
          
          for (const server of parsed) {
            if (server.host && server.port && server.password && server.secure !== undefined) {
              servers.push({
                name: server.name || 'Unknown',
                host: server.host,
                port: parseInt(server.port),
                password: server.password,
                secure: server.secure,
                region: server.region || 'Unknown',
                version: server.version || 'v3'
              });
            }
          }
          
          log.debug(`Parsed ${parsed.length} servers from JS array`);
        } catch (e) {
          log.debug(`Failed to parse JS array: ${e.message}`);
        }
      }
    }
    
    // Remove duplicates (prefer servers with region info)
    const uniqueServers = [];
    const seenKeys = new Map();
    
    // Sort servers so those with region info come first
    servers.sort((a, b) => {
      const aHasRegion = a.region && a.region !== 'Unknown' && a.region !== '🌍 Unknown';
      const bHasRegion = b.region && b.region !== 'Unknown' && b.region !== '🌍 Unknown';
      if (aHasRegion && !bHasRegion) return -1;
      if (!aHasRegion && bHasRegion) return 1;
      return 0;
    });
    
    for (const server of servers) {
      const key = `${server.host}:${server.port}`;
      if (!seenKeys.has(key)) {
        seenKeys.set(key, true);
        uniqueServers.push(server);
        log.debug(`Added: ${server.name} (${key}) - ${server.region}`);
      } else {
        log.debug(`Skipped duplicate: ${server.name} (${key})`);
      }
    }
    
    log.debug(`Total unique servers: ${uniqueServers.length}`);
    
    return uniqueServers;
  } catch (error) {
    log.error(`Failed to read server list: ${error.message}`);
    return [];
  }
}

/**
 * Test server latency
 */
function testServer(server) {
  return new Promise((resolve) => {
    const startTime = performance.now();
    const protocol = server.secure ? https : http;
    const url = `${server.secure ? 'https' : 'http'}://${server.host}:${server.port}/version`;
    
    log.debug(`Testing ${server.name} (${server.host}:${server.port})`);
    
    const req = protocol.get(url, {
      headers: { 'Authorization': server.password },
      timeout: CONFIG.httpTimeout,
      rejectUnauthorized: false
    }, (res) => {
      const latency = Math.round(performance.now() - startTime);
      
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const result = {
          server,
          latency,
          status: res.statusCode,
          online: res.statusCode === 200,
          version: null
        };
        
        try {
          const versionData = JSON.parse(data);
          result.version = versionData.version || server.version;
        } catch (e) {
          result.version = server.version;
        }
        
        log.debug(`${server.name}: ${latency}ms (${res.statusCode})`);
        resolve(result);
      });
    });
    
    req.on('error', (error) => {
      log.debug(`${server.name}: Failed - ${error.message}`);
      resolve({
        server,
        latency: 9999,
        status: 0,
        online: false,
        error: error.message,
        version: server.version
      });
    });
    
    req.on('timeout', () => {
      req.destroy();
      log.debug(`${server.name}: Timeout`);
      resolve({
        server,
        latency: 9999,
        status: 0,
        online: false,
        error: 'Timeout',
        version: server.version
      });
    });
  });
}

/**
 * Test all servers with multiple samples
 */
async function testAllServers(servers) {
  log.header('🔍 Testing Lavalink Servers');
  log.info(`Testing ${servers.length} servers with ${CONFIG.pingSamples} samples each...`);
  
  const results = [];
  
  for (const server of servers) {
    const samples = [];
    
    for (let i = 0; i < CONFIG.pingSamples; i++) {
      const result = await testServer(server);
      samples.push(result);
      await new Promise(resolve => setTimeout(resolve, 100)); // Small delay between samples
    }
    
    // Calculate average latency
    const onlineSamples = samples.filter(s => s.online);
    const avgLatency = onlineSamples.length > 0
      ? Math.round(onlineSamples.reduce((sum, s) => sum + s.latency, 0) / onlineSamples.length)
      : 9999;
    
    results.push({
      server,
      latency: avgLatency,
      online: onlineSamples.length >= (CONFIG.pingSamples / 2),
      successRate: (onlineSamples.length / CONFIG.pingSamples * 100).toFixed(0),
      version: samples[0].version
    });
  }
  
  return results.sort((a, b) => {
    if (a.online !== b.online) return b.online - a.online;
    return a.latency - b.latency;
  });
}

/**
 * Display results
 */
function displayResults(results, topCount = CONFIG.topCount) {
  log.header('📊 Test Results');
  
  const onlineServers = results.filter(r => r.online);
  const offlineServers = results.filter(r => !r.online);
  
  log.info(`Online: ${colors.green}${onlineServers.length}${colors.reset} | Offline: ${colors.red}${offlineServers.length}${colors.reset}\n`);
  
  if (onlineServers.length === 0) {
    log.error('No servers are online!');
    return;
  }
  
  // Determine how many to show
  const displayCount = Math.min(topCount, onlineServers.length);
  const showingAll = displayCount === onlineServers.length;
  
  console.log(`${colors.bright}${showingAll ? 'All' : `Top ${displayCount}`} Online Servers:${colors.reset}\n`);
  console.log('Rank | Server Name                    | Region      | Latency | Success | Version');
  console.log('-----|--------------------------------|-------------|---------|---------|--------');
  
  onlineServers.slice(0, displayCount).forEach((result, index) => {
    const rank = `${index + 1}.`.padEnd(4);
    const name = result.server.name.substring(0, 30).padEnd(30);
    const region = result.server.region.substring(0, 11).padEnd(11);
    const latency = `${result.latency}ms`.padEnd(7);
    const success = `${result.successRate}%`.padEnd(7);
    const version = result.version || 'v3';
    
    const color = result.latency < 100 ? colors.green : result.latency < 300 ? colors.yellow : colors.red;
    console.log(`${rank} | ${name} | ${region} | ${color}${latency}${colors.reset} | ${success} | ${version}`);
  });
  
  if (!showingAll && onlineServers.length > displayCount) {
    console.log(`\n${colors.dim}... and ${onlineServers.length - displayCount} more servers${colors.reset}`);
    console.log(`${colors.dim}Use --all to see all servers${colors.reset}`);
  }
  
  console.log('');
}

/**
 * Interactive server selection
 */
async function chooseServer(results) {
  const onlineServers = results.filter(r => r.online);
  const displayCount = Math.min(CONFIG.topCount, onlineServers.length);
  
  if (onlineServers.length === 0) {
    log.error('No servers available for selection');
    return null;
  }
  
  console.log(`\n${colors.bright}Select a server:${colors.reset}`);
  onlineServers.slice(0, displayCount).forEach((result, index) => {
    console.log(`  ${colors.cyan}${index + 1}${colors.reset}) ${result.server.name} (${result.latency}ms)`);
  });
  console.log(`  ${colors.cyan}0${colors.reset}) Cancel\n`);
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question(`Enter your choice (1-${displayCount}): `, (answer) => {
      rl.close();
      const choice = parseInt(answer);
      
      if (choice === 0) {
        log.info('Selection cancelled');
        resolve(null);
      } else if (choice > 0 && choice <= displayCount) {
        resolve(onlineServers[choice - 1]);
      } else {
        log.error('Invalid choice');
        resolve(null);
      }
    });
  });
}

/**
 * Update .env file
 */
function updateEnvFile(server) {
  try {
    let envContent = '';
    
    if (fs.existsSync(CONFIG.envPath)) {
      envContent = fs.readFileSync(CONFIG.envPath, 'utf8');
    }
    
    const updates = {
      LAVALINK_HOST: server.host,
      LAVALINK_PORT: server.port.toString(),
      LAVALINK_PASSWORD: server.password,
      LAVALINK_SECURE: server.secure.toString()
    };
    
    for (const [key, value] of Object.entries(updates)) {
      const regex = new RegExp(`^${key}=.*$`, 'm');
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${key}=${value}`);
      } else {
        envContent += `\n${key}=${value}`;
      }
    }
    
    fs.writeFileSync(CONFIG.envPath, envContent.trim() + '\n');
    log.success(`.env file updated with ${server.name}`);
    
    return true;
  } catch (error) {
    log.error(`Failed to update .env: ${error.message}`);
    return false;
  }
}

/**
 * Start the bot
 */
function startBot() {
  log.header('🚀 Starting Bot');
  
  try {
    const isWindows = process.platform === 'win32';
    
    log.info('Starting bot process...');
    
    let bot;
    if (isWindows) {
      // Windows: use npm.cmd
      bot = spawn('npm.cmd', ['start'], {
        detached: true,
        stdio: 'inherit',
        shell: true
      });
    } else {
      // Linux/Unix: use npm and properly detach
      bot = spawn('npm', ['start'], {
        detached: true,
        stdio: ['ignore', 'ignore', 'ignore'],
        shell: true
      });
    }
    
    bot.on('error', (error) => {
      log.error(`Failed to start bot: ${error.message}`);
    });
    
    // Detach the process so it continues running
    bot.unref();
    
    log.success('Bot started successfully!');
    log.info('The bot is now running in the background');
    
    if (!isWindows) {
      log.info('Tip: Use "ps aux | grep node" to check running processes');
      log.info('Tip: Use "pkill -f node" to stop all node processes');
    }
    
    return true;
  } catch (error) {
    log.error(`Failed to start bot: ${error.message}`);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  console.log(`${colors.bright}${colors.magenta}`);
  console.log('╔═══════════════════════════════════════╗');
  console.log('║   Lavalink Server Chooser v2.0       ║');
  console.log('╚═══════════════════════════════════════╝');
  console.log(colors.reset);
  
  // Parse server list
  const servers = parseServerList(CONFIG.serverListPath);
  
  if (servers.length === 0) {
    log.error(`No servers found in ${CONFIG.serverListPath}`);
    process.exit(1);
  }
  
  log.info(`Found ${servers.length} servers`);
  
  // Filter v4 only if requested
  const filteredServers = CONFIG.onlyV4 
    ? servers.filter(s => s.version === 'v4')
    : servers;
  
  if (CONFIG.onlyV4) {
    log.info(`Filtered to ${filteredServers.length} v4 servers`);
  }
  
  if (filteredServers.length === 0) {
    log.error('No servers match the filter criteria');
    process.exit(1);
  }
  
  // Test all servers
  const results = await testAllServers(filteredServers);
  
  // Display results
  displayResults(results);
  
  // Select server
  let selectedResult;
  
  if (CONFIG.interactive) {
    selectedResult = await chooseServer(results);
    if (!selectedResult) {
      process.exit(0);
    }
  } else {
    selectedResult = results.find(r => r.online);
    if (!selectedResult) {
      log.error('No online servers available');
      process.exit(1);
    }
    log.success(`Best server: ${colors.bright}${selectedResult.server.name}${colors.reset} (${selectedResult.latency}ms)`);
  }
  
  // Update .env file
  if (CONFIG.dryRun) {
    log.warn('Dry run - .env file not updated');
    console.log(`\nWould set:`);
    console.log(`  LAVALINK_HOST=${selectedResult.server.host}`);
    console.log(`  LAVALINK_PORT=${selectedResult.server.port}`);
    console.log(`  LAVALINK_SECURE=${selectedResult.server.secure}`);
  } else {
    if (updateEnvFile(selectedResult.server)) {
      log.success('Configuration updated successfully!');
      
      // Start bot if requested
      if (CONFIG.startBot) {
        console.log(''); // Add spacing
        startBot();
      }
    }
  }
}

// Run
main().catch(error => {
  log.error(`Fatal error: ${error.message}`);
  process.exit(1);
});
