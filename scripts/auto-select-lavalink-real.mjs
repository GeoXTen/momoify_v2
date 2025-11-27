#!/usr/bin/env node

import fs from 'fs';
import https from 'https';
import http from 'http';
import { performance } from 'perf_hooks';
import readline from 'readline';
import { spawn } from 'child_process';

// Configuration
const CONFIG = {
  serverListPath: 'lavalink server lis.txt',
  envPath: '.env',
  pingSamples: 3,
  httpTimeout: 5000,
  startCommand: process.argv[2] || 'npm start',
  dryRun: process.argv.includes('--dry-run'),
  verbose: process.argv.includes('--verbose'),
  interactive: process.argv.includes('--choose') || process.argv.includes('-c'),
  topCount: 5,
  onlyV4: process.argv.includes('--v4-only') || process.argv.includes('--v4')
};

// Parse server list - handles both individual objects and arrays
function parseServerList(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const servers = [];
    
    // Method 1: Extract individual {...} objects (first 9 servers)
    const objectPattern = /\{[^{}]*\}/g;
    const individualMatches = content.match(objectPattern) || [];
    
    for (const block of individualMatches) {
      try {
        const extractField = (key, isBoolean = false) => {
          const patterns = [
            new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`),
            new RegExp(`\\b${key}\\s*:\\s*"([^"]+)"`),
            new RegExp(`"${key}"\\s*:\\s*(\\d+)`),
            new RegExp(`\\b${key}\\s*:\\s*(\\d+)`),
            new RegExp(`\\b${key}\\s*:\\s*(true|false)`)
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
        
        if (server.host && server.port && server.password && server.secure !== null) {
          servers.push(server);
        }
      } catch (e) {
        if (CONFIG.verbose) console.warn(`Failed to parse individual server: ${e.message}`);
      }
    }
    
    // Method 2: Extract JSON array (remaining servers) - handle syntax errors
    try {
      // Find the array part: [ ... ]
      const arrayMatch = content.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (arrayMatch) {
        let arrayContent = arrayMatch[0];
        
        // Fix common JSON syntax errors
        arrayContent = arrayContent
          .replace(/chttps:/g, 'https:')  // Fix "chttps" typo
          .replace(/([{,]\s*)"?([a-zA-Z_][a-zA-Z0-9_]*)"?\s*:/g, '$1"$2":'); // Ensure quoted keys
        
        try {
          const parsedArray = JSON.parse(arrayContent);
          
          for (const server of parsedArray) {
            if (server.host && server.port && server.password && server.secure !== null) {
              servers.push({
                name: server.name || 'Unknown',
                host: server.host,
                port: parseInt(server.port),
                password: server.password,
                secure: server.secure,
                region: server.region,
                version: server.version
              });
            }
          }
        } catch (parseError) {
          // If JSON still fails, try to extract servers manually using regex
          if (CONFIG.verbose) console.warn(`JSON parse failed, trying manual extraction: ${parseError.message}`);
          
          const manualMatches = arrayContent.match(/\{[^{}]*"host"[^{}]*\}/g) || [];
          for (const block of manualMatches) {
            try {
              // Try to parse individual objects with error fixes
              let cleanBlock = block
                .replace(/chttps:/g, 'https:')
                .replace(/([{,]\s*)"?([a-zA-Z_][a-zA-Z0-9_]*)"?\s*:/g, '$1"$2":');
              
              const serverObj = JSON.parse(cleanBlock);
              if (serverObj.host && serverObj.port && serverObj.password && serverObj.secure !== null) {
                servers.push({
                  name: serverObj.name || 'Unknown',
                  host: serverObj.host,
                  port: parseInt(serverObj.port),
                  password: serverObj.password,
                  secure: serverObj.secure,
                  region: serverObj.region,
                  version: serverObj.version
                });
              }
            } catch (e) {
              if (CONFIG.verbose) console.warn(`Failed to parse individual block: ${e.message}`);
            }
          }
        }
      }
    } catch (e) {
      if (CONFIG.verbose) console.warn(`Failed to extract JSON array: ${e.message}`);
    }
    
    // Remove duplicates based on host:port combination
    // Prefer servers with more complete info (version, region)
    const serverMap = new Map();
    
    for (const server of servers) {
      const key = `${server.host}:${server.port}`;
      const existing = serverMap.get(key);
      
      if (!existing) {
        // First entry for this host:port
        serverMap.set(key, server);
      } else {
        // Duplicate found - keep the one with more info
        const serverScore = (server.version ? 2 : 0) + (server.region ? 1 : 0);
        const existingScore = (existing.version ? 2 : 0) + (existing.region ? 1 : 0);
        
        if (serverScore > existingScore) {
          // New server has more info, replace existing
          serverMap.set(key, server);
        }
      }
    }
    
    const unique = Array.from(serverMap.values());
    
    // Note: v4 filtering now happens after testing servers to detect actual versions
    let filtered = unique;
    
    if (CONFIG.verbose) {
      console.log(`📊 Final result: ${filtered.length} servers (${unique.length - filtered.length} duplicates removed)`);
    }
    
    return filtered;
  } catch (error) {
    throw new Error(`Failed to read server list: ${error.message}`);
  }
}

// Test actual Lavalink server performance via /version endpoint and detect version
function measureLavalinkPing(server, samples = 3) {
  return new Promise(async (resolve) => {
    const results = [];
    const protocol = server.secure ? https : http;
    const baseUrl = `${server.secure ? 'https' : 'http'}://${server.host}:${server.port}`;
    let detectedVersion = null;
    
    for (let i = 0; i < samples; i++) {
      const start = performance.now();
      
      try {
        const versionData = await new Promise((resolve, reject) => {
          const options = {
            method: 'GET',
            headers: {
              'Authorization': server.password,
              'User-Agent': 'Lavalink-Selector/1.0'
            },
            timeout: CONFIG.httpTimeout
          };
          
          const req = protocol.request(`${baseUrl}/version`, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
              if (res.statusCode === 200) {
                resolve(data);
              } else {
                reject(new Error(`HTTP ${res.statusCode}`));
              }
            });
          });
          
          req.on('error', reject);
          req.on('timeout', () => {
            req.destroy();
            reject(new Error('Timeout'));
          });
          
          req.setTimeout(CONFIG.httpTimeout);
          req.end();
        });
        
        const latency = performance.now() - start;
        results.push(latency);
        
        // Parse version from response (only on first successful request)
        if (!detectedVersion && versionData) {
          try {
            // Try parsing as JSON first (v4 format)
            const jsonData = JSON.parse(versionData);
            
            // Handle different v4 response formats
            if (jsonData.major !== undefined && jsonData.major > 0) {
              detectedVersion = `v${jsonData.major}`;
            } else if (jsonData.version) {
              // Extract version from version string like "4.0.7" or "v4.0.7"
              const versionMatch = jsonData.version.match(/(\d+)\./);
              if (versionMatch) {
                detectedVersion = `v${versionMatch[1]}`;
              }
            } else if (jsonData.build) {
              // Some v4 servers return build info
              detectedVersion = 'v4';
            } else if (typeof jsonData === 'object' && Object.keys(jsonData).length > 0) {
              // If we get a JSON object response, likely v4
              detectedVersion = 'v4';
            }
          } catch {
            // Fallback: plain text response (v3 format)
            const versionMatch = versionData.match(/(\d+)\.(\d+)/);
            if (versionMatch) {
              const majorVersion = parseInt(versionMatch[1]);
              if (majorVersion > 0) {
                detectedVersion = `v${majorVersion}`;
              }
            } else if (versionData.length > 0) {
              // If we get any non-empty response from /version, assume it's working
              // Check if response looks like v4 (JSON-like) or v3 (plain text)
              if (versionData.includes('{') || versionData.includes('build') || versionData.includes('git')) {
                detectedVersion = 'v4';
              } else {
                detectedVersion = 'v3';
              }
            }
          }
        }
        
      } catch (error) {
        if (CONFIG.verbose) console.log(`   Sample ${i+1} failed: ${error.message}`);
      }
      
      // Small delay between samples
      if (i < samples - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    if (results.length === 0) {
      resolve({ latency: null, error: 'All requests failed', version: null });
    } else {
      const avg = results.reduce((a, b) => a + b, 0) / results.length;
      const successRate = (results.length / samples) * 100;
      resolve({ 
        latency: Math.round(avg * 100) / 100,
        successRate: Math.round(successRate),
        samples: results.length,
        version: detectedVersion
      });
    }
  });
}

// Test all servers
async function findBestServers(servers, interactive = false) {
  console.log(`🔍 Testing ${servers.length} Lavalink servers (real /version endpoint)...`);
  console.log('🎵 This tests actual Lavalink performance, not just network connectivity\n');
  
  const results = [];
  
  for (const server of servers) {
    const displayName = server.name !== 'Unknown' ? server.name : `${server.host}:${server.port}`;
    process.stdout.write(`   Testing ${displayName}... `);
    
    const result = await measureLavalinkPing(server, CONFIG.pingSamples);
    
    if (result.latency !== null) {
      const versionInfo = result.version ? ` [${result.version} detected]` : '';
      console.log(`✅ ${result.latency}ms (${result.successRate}% success)${versionInfo}`);
      results.push({ 
        ...server, 
        latency: result.latency, 
        successRate: result.successRate,
        detectedVersion: result.version,
        displayName 
      });
    } else {
      console.log(`❌ Failed (${result.error})`);
    }
  }
  
  if (results.length === 0) {
    throw new Error('No servers are reachable via Lavalink API');
  }
  
  // Filter by detected version if requested
  let filteredResults = results;
  if (CONFIG.onlyV4) {
    filteredResults = results.filter(server => {
      // Include if detected as v4
      if (server.detectedVersion === 'v4') return true;
      
      // Include if listed as v4 and no detection (server might not return version properly)
      if (server.version === 'v4' && !server.detectedVersion) return true;
      
      // Include servers with "v4" or "lavalink4" in name as fallback
      if (!server.detectedVersion && (
        server.name.toLowerCase().includes('v4') ||
        server.name.toLowerCase().includes('lavalink4') ||
        server.host.toLowerCase().includes('v4')
      )) return true;
      
      return false;
    });
    
    if (CONFIG.verbose) {
      console.log(`\n🔧 V4 Filter Results:`);
      console.log(`   - Detected v4: ${results.filter(s => s.detectedVersion === 'v4').length}`);
      console.log(`   - Listed v4 (no detection): ${results.filter(s => s.version === 'v4' && !s.detectedVersion).length}`);
      console.log(`   - Name-based v4: ${results.filter(s => !s.detectedVersion && !s.version && (s.name.toLowerCase().includes('v4') || s.host.toLowerCase().includes('v4'))).length}`);
      console.log(`   - Total v4 included: ${filteredResults.length}/${results.length}`);
    }
    
    console.log(`\n🔧 Filtered to ${filteredResults.length} v4 servers (${results.length - filteredResults.length} excluded)`);
    
    if (filteredResults.length === 0) {
      console.log('❌ No v4 servers found. Try without --v4 filter to see all working servers.');
      throw new Error('No v4 servers found after testing');
    }
  }

  // Sort by latency, then by success rate
  filteredResults.sort((a, b) => {
    if (Math.abs(a.latency - b.latency) < 10) {
      return b.successRate - a.successRate; // Higher success rate wins if latency is close
    }
    return a.latency - b.latency; // Lower latency wins
  });
  
  if (interactive) {
    return await chooseFromTopServers(filteredResults);
  } else {
    return filteredResults[0];
  }
}

// Let user choose from top servers
async function chooseFromTopServers(sortedResults) {
  const topServers = sortedResults.slice(0, Math.min(CONFIG.topCount, sortedResults.length));
  
  console.log(`\n🏆 Top ${topServers.length} Lavalink servers by real performance:`);
  console.log('');
  
  topServers.forEach((server, index) => {
    const region = server.region ? ` [${server.region}]` : '';
    const detectedVer = server.detectedVersion ? ` (${server.detectedVersion} detected)` : '';
    const listedVer = server.version && !server.detectedVersion ? ` (${server.version} listed)` : '';
    const version = detectedVer || listedVer;
    const reliability = server.successRate === 100 ? '🟢' : server.successRate >= 66 ? '🟡' : '🔴';
    
    console.log(`  [${index + 1}] ${server.displayName}${region}${version}`);
    console.log(`      📍 ${server.host}:${server.port}`);
    console.log(`      ⚡ ${server.latency}ms Lavalink response time`);
    console.log(`      ${reliability} ${server.successRate}% reliability (${server.samples}/${CONFIG.pingSamples} samples)`);
    console.log(`      🔒 Secure: ${server.secure}`);
    console.log('');
  });
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    const askChoice = () => {
      rl.question(`Choose a server (1-${topServers.length}) or press Enter for #1: `, (answer) => {
        const choice = answer.trim();
        
        if (choice === '') {
          console.log(`\n✨ Selected: ${topServers[0].displayName} (best performance)`);
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

// Update .env file (same as before)
function updateEnvFile(envPath, server) {
  let envContent = '';
  
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }
  
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
  
  envVars.LAVALINK_HOST = server.host;
  envVars.LAVALINK_PORT = server.port.toString();
  envVars.LAVALINK_PASSWORD = server.password;
  envVars.LAVALINK_SECURE = server.secure.toString();
  
  const orderedKeys = [
    'DISCORD_TOKEN', 'CLIENT_ID', 'OWNER_ID',
    'LAVALINK_HOST', 'LAVALINK_PORT', 'LAVALINK_PASSWORD', 'LAVALINK_SECURE',
    'PREFIX', 'BOT_ACTIVITY', 'BOT_STATUS', 'GENIUS_CLIENT_ID', 'API_PORT'
  ];
  
  let newContent = '';
  
  for (const key of orderedKeys) {
    if (envVars[key] !== undefined) {
      newContent += `${key}=${envVars[key]}\n`;
      delete envVars[key];
    }
  }
  
  for (const [key, value] of Object.entries(envVars)) {
    newContent += `${key}=${value}\n`;
  }
  
  fs.writeFileSync(envPath, newContent, 'utf8');
}

// Start the bot (same as before)
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
    console.log('🎯 Auto-selecting best Lavalink server (REAL performance test)...\n');
    
    const servers = parseServerList(CONFIG.serverListPath);
    console.log(`📋 Found ${servers.length} servers in list`);
    
    if (servers.length === 0) {
      throw new Error('No valid servers found in list');
    }
    
    const bestServer = await findBestServers(servers, CONFIG.interactive);
    
    console.log('\n✨ Best server selected:');
    console.log(`   Name: ${bestServer.displayName}`);
    console.log(`   Host: ${bestServer.host}:${bestServer.port}`);
    console.log(`   Real Lavalink Latency: ${bestServer.latency}ms`);
    console.log(`   Reliability: ${bestServer.successRate}%`);
    console.log(`   Secure: ${bestServer.secure}`);
    console.log(`   Region: ${bestServer.region || 'Unknown'}`);
    
    if (CONFIG.dryRun) {
      console.log('\n🔍 Dry run mode - not updating .env or starting bot');
      return;
    }
    
    updateEnvFile(CONFIG.envPath, bestServer);
    console.log(`\n📝 Updated ${CONFIG.envPath} with new Lavalink settings`);
    
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
🎯 Real Lavalink Server Performance Tester

Usage: node scripts/auto-select-lavalink-real.mjs [START_COMMAND] [OPTIONS]

This script tests actual Lavalink server performance by calling the /version endpoint,
not just network connectivity. Results will match your bot's actual experience.

Arguments:
  START_COMMAND    Command to start bot (default: "npm start")

Options:
  --choose, -c    Show top 5 servers and let you choose
  --v4-only, --v4 Only test Lavalink v4 servers
  --dry-run       Only test servers, don't update .env or start bot
  --verbose       Show detailed output
  --help, -h      Show this help

Examples:
  node scripts/auto-select-lavalink-real.mjs --choose --dry-run --v4    # Test v4 servers only
  node scripts/auto-select-lavalink-real.mjs --choose --v4              # Choose from v4 servers
  node scripts/auto-select-lavalink-real.mjs "npm start" --v4           # Auto-pick best v4 server
`);
  process.exit(0);
}

main();