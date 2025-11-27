#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import net from 'net';
import { spawn } from 'child_process';
import { performance } from 'perf_hooks';
import readline from 'readline';

// Configuration
const CONFIG = {
  serverListPath: 'lavalink server lis.txt',
  envPath: '.env',
  pingSamples: 4,
  tcpTimeout: 3000,
  startCommand: process.argv[2] || 'npm start', // Allow override via command line
  dryRun: process.argv.includes('--dry-run'),
  verbose: process.argv.includes('--verbose'),
  interactive: process.argv.includes('--choose') || process.argv.includes('-c'),
  topCount: 5
};

// Parse server list (handles mixed JSON/JS object formats)
function parseServerList(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const servers = [];
    
    // Extract all {...} blocks
    const objectPattern = /\{[^{}]*\}/g;
    const matches = content.match(objectPattern) || [];
    
    for (const block of matches) {
      try {
        // Extract fields using regex (handles both "key": "value" and key: "value")
        const extractField = (key, isBoolean = false) => {
          const patterns = [
            new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`),  // "key": "value"
            new RegExp(`\\b${key}\\s*:\\s*"([^"]+)"`), // key: "value"
            new RegExp(`"${key}"\\s*:\\s*(\\d+)`),     // "key": 123
            new RegExp(`\\b${key}\\s*:\\s*(\\d+)`),    // key: 123
            new RegExp(`\\b${key}\\s*:\\s*(true|false)`) // key: true/false
          ];
          
          for (const pattern of patterns) {
            const match = block.match(pattern);
            if (match) {
              if (isBoolean) return match[1] === 'true';
              return isNaN(match[1]) ? match[1] : parseInt(match[1]);
            }
          }
          return null;
        };
        
        const server = {
          name: extractField('name') || 'Unknown',
          host: extractField('host'),
          port: extractField('port'),
          password: extractField('password'),
          secure: extractField('secure', true),
          region: extractField('region'),
          version: extractField('version')
        };
        
        // Only add if required fields exist
        if (server.host && server.port && server.password && server.secure !== null) {
          servers.push(server);
        }
      } catch (e) {
        if (CONFIG.verbose) console.warn(`Failed to parse server block: ${e.message}`);
      }
    }
    
    return servers;
  } catch (error) {
    throw new Error(`Failed to read server list: ${error.message}`);
  }
}

// Measure TCP latency to server
function measureTcpLatency(host, port, samples = 3) {
  return new Promise(async (resolve) => {
    const results = [];
    
    for (let i = 0; i < samples; i++) {
      const start = performance.now();
      
      try {
        await new Promise((resolve, reject) => {
          const socket = new net.Socket();
          const timer = setTimeout(() => {
            socket.destroy();
            reject(new Error('Timeout'));
          }, CONFIG.tcpTimeout);
          
          socket.connect(port, host, () => {
            clearTimeout(timer);
            socket.destroy();
            resolve();
          });
          
          socket.on('error', (err) => {
            clearTimeout(timer);
            reject(err);
          });
        });
        
        const latency = performance.now() - start;
        results.push(latency);
        
      } catch (error) {
        // Failed connection, skip this sample
      }
      
      // Small delay between samples
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (results.length === 0) {
      resolve(null); // All attempts failed
    } else {
      // Return average of successful attempts
      const avg = results.reduce((a, b) => a + b, 0) / results.length;
      resolve(Math.round(avg * 100) / 100); // Round to 2 decimal places
    }
  });
}

// Test all servers and find the best one(s)
async function findBestServers(servers, interactive = false) {
  console.log(`🔍 Testing ${servers.length} Lavalink servers...`);
  
  const results = [];
  
  for (const server of servers) {
    const displayName = server.name !== 'Unknown' ? server.name : `${server.host}:${server.port}`;
    process.stdout.write(`   Testing ${displayName}... `);
    
    const latency = await measureTcpLatency(server.host, server.port, CONFIG.pingSamples);
    
    if (latency !== null) {
      console.log(`✅ ${latency}ms`);
      results.push({ ...server, latency, displayName });
    } else {
      console.log(`❌ Failed`);
    }
  }
  
  if (results.length === 0) {
    throw new Error('No servers are reachable');
  }
  
  // Sort by latency (lowest first)
  results.sort((a, b) => a.latency - b.latency);
  
  if (interactive) {
    return await chooseFromTopServers(results);
  } else {
    return results[0]; // Return best server
  }
}

// Let user choose from top servers
async function chooseFromTopServers(sortedResults) {
  const topServers = sortedResults.slice(0, Math.min(CONFIG.topCount, sortedResults.length));
  
  console.log(`\n🏆 Top ${topServers.length} servers by latency:`);
  console.log('');
  
  topServers.forEach((server, index) => {
    const region = server.region ? ` [${server.region}]` : '';
    const version = server.version ? ` (v${server.version})` : '';
    console.log(`  [${index + 1}] ${server.displayName}${region}${version}`);
    console.log(`      📍 ${server.host}:${server.port}`);
    console.log(`      ⚡ ${server.latency}ms latency`);
    console.log(`      🔒 Secure: ${server.secure}`);
    console.log('');
  });
  
  // Get user choice
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    const askChoice = () => {
      rl.question(`Choose a server (1-${topServers.length}) or press Enter for #1: `, (answer) => {
        const choice = answer.trim();
        
        if (choice === '') {
          console.log(`\n✨ Selected: ${topServers[0].displayName} (lowest ping)`);
          rl.close();
          resolve(topServers[0]);
          return;
        }
        
        const num = parseInt(choice);
        if (num >= 1 && num <= topServers.length) {
          console.log(`\n✨ Selected: ${topServers[num - 1].displayName}`);
          rl.close();
          resolve(topServers[num - 1]);
        } else {
          console.log(`❌ Invalid choice. Please enter 1-${topServers.length} or press Enter.`);
          askChoice();
        }
      });
    };
    
    askChoice();
  });
}

// Update .env file
function updateEnvFile(envPath, server) {
  let envContent = '';
  
  // Read existing .env if it exists
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }
  
  // Parse existing variables
  const envVars = {};
  const lines = envContent.split('\n');
  
  for (const line of lines) {
    if (line.trim() && !line.trim().startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join('=');
      }
    }
  }
  
  // Update Lavalink settings
  envVars.LAVALINK_HOST = server.host;
  envVars.LAVALINK_PORT = server.port.toString();
  envVars.LAVALINK_PASSWORD = server.password;
  envVars.LAVALINK_SECURE = server.secure.toString();
  
  // Rebuild .env content
  const orderedKeys = [
    'DISCORD_TOKEN', 'CLIENT_ID', 'OWNER_ID',
    'LAVALINK_HOST', 'LAVALINK_PORT', 'LAVALINK_PASSWORD', 'LAVALINK_SECURE',
    'PREFIX', 'BOT_ACTIVITY', 'BOT_STATUS', 'GENIUS_CLIENT_ID', 'API_PORT'
  ];
  
  let newContent = '';
  
  // Add ordered keys first
  for (const key of orderedKeys) {
    if (envVars[key] !== undefined) {
      newContent += `${key}=${envVars[key]}\n`;
      delete envVars[key]; // Remove from remaining vars
    }
  }
  
  // Add any remaining variables
  for (const [key, value] of Object.entries(envVars)) {
    newContent += `${key}=${value}\n`;
  }
  
  fs.writeFileSync(envPath, newContent, 'utf8');
}

// Start the bot
function startBot(command) {
  console.log(`🚀 Starting bot with: ${command}`);
  
  const [cmd, ...args] = command.split(' ');
  const child = spawn(cmd, args, {
    stdio: 'inherit',
    shell: true
  });
  
  child.on('error', (error) => {
    console.error(`❌ Failed to start bot: ${error.message}`);
    process.exit(1);
  });
  
  child.on('close', (code) => {
    console.log(`Bot process exited with code ${code}`);
    process.exit(code);
  });
}

// Main execution
async function main() {
  try {
    console.log('🎯 Auto-selecting best Lavalink server...\n');
    
    // Parse server list
    const servers = parseServerList(CONFIG.serverListPath);
    console.log(`📋 Found ${servers.length} servers in list`);
    
    if (servers.length === 0) {
      throw new Error('No valid servers found in list');
    }
    
    // Find best server(s)
    const bestServer = await findBestServers(servers, CONFIG.interactive);
    
    console.log('\n✨ Best server selected:');
    console.log(`   Name: ${bestServer.displayName}`);
    console.log(`   Host: ${bestServer.host}:${bestServer.port}`);
    console.log(`   Latency: ${bestServer.latency}ms`);
    console.log(`   Secure: ${bestServer.secure}`);
    console.log(`   Region: ${bestServer.region || 'Unknown'}`);
    
    if (CONFIG.dryRun) {
      console.log('\n🔍 Dry run mode - not updating .env or starting bot');
      return;
    }
    
    // Update .env
    updateEnvFile(CONFIG.envPath, bestServer);
    console.log(`\n📝 Updated ${CONFIG.envPath} with new Lavalink settings`);
    
    // Start bot
    console.log('');
    startBot(CONFIG.startCommand);
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

// Handle command line help
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
🎯 Auto Lavalink Server Selector

Usage: node scripts/auto-select-lavalink.js [START_COMMAND] [OPTIONS]

Arguments:
  START_COMMAND    Command to start bot (default: "npm start")

Options:
  --choose, -c    Show top 5 servers and let you choose
  --dry-run       Only test servers, don't update .env or start bot
  --verbose       Show detailed output
  --help, -h      Show this help

Examples:
  node scripts/auto-select-lavalink.js                       # Auto-pick lowest ping
  node scripts/auto-select-lavalink.js --choose              # Choose from top 5
  node scripts/auto-select-lavalink.js "pm2 restart bot" -c  # Choose + PM2
  node scripts/auto-select-lavalink.js --dry-run             # Test only
  node scripts/auto-select-lavalink.js --choose --dry-run    # Choose but don't apply
`);
  process.exit(0);
}

// Run the script
main();