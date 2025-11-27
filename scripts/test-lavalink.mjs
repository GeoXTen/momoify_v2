#!/usr/bin/env node

/**
 * Test current Lavalink server configuration
 * Verifies the connection without changing any settings
 */

import https from 'https';
import http from 'http';
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`)
};

async function testCurrentServer() {
  console.log(`\n${colors.bright}${colors.cyan}Testing Current Lavalink Server${colors.reset}\n`);
  
  const host = process.env.LAVALINK_HOST;
  const port = process.env.LAVALINK_PORT;
  const password = process.env.LAVALINK_PASSWORD;
  const secure = process.env.LAVALINK_SECURE === 'true';
  
  if (!host || !port || !password) {
    log.error('Lavalink configuration missing in .env file');
    console.log('\nRequired variables:');
    console.log('  - LAVALINK_HOST');
    console.log('  - LAVALINK_PORT');
    console.log('  - LAVALINK_PASSWORD');
    console.log('  - LAVALINK_SECURE');
    process.exit(1);
  }
  
  console.log('Configuration:');
  console.log(`  Host:     ${host}`);
  console.log(`  Port:     ${port}`);
  console.log(`  Secure:   ${secure ? 'Yes (HTTPS)' : 'No (HTTP)'}`);
  console.log(`  Password: ${'*'.repeat(Math.min(password.length, 20))}\n`);
  
  const protocol = secure ? https : http;
  const url = `${secure ? 'https' : 'http'}://${host}:${port}/version`;
  
  log.info('Testing connection...');
  
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    const req = protocol.get(url, {
      headers: { 'Authorization': password },
      timeout: 10000,
      rejectUnauthorized: false
    }, (res) => {
      const latency = Date.now() - startTime;
      
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('');
        
        if (res.statusCode === 200) {
          log.success(`Server is ${colors.green}ONLINE${colors.reset}`);
          console.log(`  Response time: ${colors.green}${latency}ms${colors.reset}`);
          
          try {
            const versionData = JSON.parse(data);
            console.log(`  Version: ${versionData.version || 'Unknown'}`);
            console.log(`  Build: ${versionData.buildTime || 'Unknown'}`);
          } catch (e) {
            console.log(`  Raw response: ${data}`);
          }
          
          resolve(true);
        } else {
          log.error(`Server returned status code: ${res.statusCode}`);
          console.log(`  Response: ${data}`);
          resolve(false);
        }
      });
    });
    
    req.on('error', (error) => {
      console.log('');
      log.error('Connection failed');
      console.log(`  Error: ${error.message}`);
      
      if (error.code === 'ECONNREFUSED') {
        log.warn('Server refused connection. Is it running?');
      } else if (error.code === 'ETIMEDOUT') {
        log.warn('Connection timed out. Check host and port.');
      } else if (error.code === 'ENOTFOUND') {
        log.warn('Host not found. Check LAVALINK_HOST setting.');
      }
      
      resolve(false);
    });
    
    req.on('timeout', () => {
      req.destroy();
      console.log('');
      log.error('Connection timed out');
      resolve(false);
    });
  });
}

async function testStats() {
  const host = process.env.LAVALINK_HOST;
  const port = process.env.LAVALINK_PORT;
  const password = process.env.LAVALINK_PASSWORD;
  const secure = process.env.LAVALINK_SECURE === 'true';
  
  const protocol = secure ? https : http;
  const url = `${secure ? 'https' : 'http'}://${host}:${port}/v4/stats`;
  
  console.log(`\n${colors.bright}Server Statistics:${colors.reset}\n`);
  
  return new Promise((resolve) => {
    const req = protocol.get(url, {
      headers: { 'Authorization': password },
      timeout: 5000,
      rejectUnauthorized: false
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const stats = JSON.parse(data);
          
          if (stats.players !== undefined) {
            console.log(`  Active Players: ${stats.players.active || 0}`);
            console.log(`  Total Players:  ${stats.players.total || 0}`);
          }
          
          if (stats.memory) {
            const usedMB = Math.round(stats.memory.used / 1024 / 1024);
            const freeMB = Math.round(stats.memory.free / 1024 / 1024);
            const totalMB = Math.round((stats.memory.used + stats.memory.free) / 1024 / 1024);
            console.log(`  Memory: ${usedMB}MB / ${totalMB}MB (${freeMB}MB free)`);
          }
          
          if (stats.cpu) {
            console.log(`  CPU Cores: ${stats.cpu.cores || 'Unknown'}`);
            console.log(`  System Load: ${(stats.cpu.systemLoad * 100).toFixed(1)}%`);
          }
          
          if (stats.uptime) {
            const hours = Math.floor(stats.uptime / 3600000);
            const minutes = Math.floor((stats.uptime % 3600000) / 60000);
            console.log(`  Uptime: ${hours}h ${minutes}m`);
          }
          
        } catch (e) {
          log.warn('Could not parse server statistics');
        }
        
        resolve(true);
      });
    });
    
    req.on('error', () => {
      log.warn('Could not fetch server statistics');
      resolve(false);
    });
  });
}

async function main() {
  const success = await testCurrentServer();
  
  if (success) {
    await testStats();
    
    console.log(`\n${colors.green}${colors.bright}✓ Server test passed!${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`\n${colors.red}${colors.bright}✗ Server test failed!${colors.reset}`);
    console.log(`\nTry selecting a different server:`);
    console.log(`  node scripts/lavalink-chooser.mjs --choose\n`);
    process.exit(1);
  }
}

main();
