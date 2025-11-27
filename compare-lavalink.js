import colors from 'colors';

// Server configurations
const SERVERS = [
    {
        name: "Current (lava-all)",
        host: "lava-all.ajieblogs.eu.org",
        port: 443,
        password: "https://dsc.gg/ajidevserver",
        secure: true
    },
    {
        name: "DCTV (Singapore)",
        host: "140.245.120.106",
        port: 25230,
        password: "quangloc2018",
        secure: false
    }
];

async function testServer(server) {
    const protocol = server.secure ? 'https' : 'http';
    const baseUrl = `${protocol}://${server.host}:${server.port}`;
    
    console.log(`\n${'='.repeat(60)}`.cyan);
    console.log(`Testing: ${server.name}`.cyan.bold);
    console.log(`URL: ${baseUrl}`.cyan);
    console.log(`${'='.repeat(60)}`.cyan);
    
    const results = {
        name: server.name,
        url: baseUrl,
        reachable: false,
        version: null,
        info: null,
        latency: null,
        error: null
    };
    
    try {
        // Test connection and measure latency
        console.log('\n[1/3] Testing connection...'.yellow);
        const startTime = Date.now();
        
        const versionResponse = await fetch(`${baseUrl}/version`, {
            method: 'GET',
            headers: {
                'Authorization': server.password
            },
            signal: AbortSignal.timeout(5000)
        });
        
        const latency = Date.now() - startTime;
        results.latency = latency;
        
        if (!versionResponse.ok) {
            throw new Error(`HTTP ${versionResponse.status}: ${versionResponse.statusText}`);
        }
        
        results.version = await versionResponse.text();
        console.log(`✓ Connected successfully!`.green);
        console.log(`  Latency: ${getPingDisplay(latency)}`);
        console.log(`  Version: ${results.version}`.green);
        
        // Get server info
        console.log('\n[2/3] Getting server info...'.yellow);
        const infoResponse = await fetch(`${baseUrl}/v4/info`, {
            method: 'GET',
            headers: {
                'Authorization': server.password
            },
            signal: AbortSignal.timeout(5000)
        });
        
        if (infoResponse.ok) {
            results.info = await infoResponse.json();
            console.log(`✓ Server info retrieved!`.green);
            console.log(`  Version: ${results.info.version?.semver || 'Unknown'}`.green);
            console.log(`  Build: ${results.info.buildTime ? new Date(results.info.buildTime).toLocaleDateString() : 'Unknown'}`.green);
            console.log(`  Plugins: ${results.info.plugins?.length || 0}`.green);
            if (results.info.plugins?.length > 0) {
                results.info.plugins.forEach(plugin => {
                    console.log(`    - ${plugin.name} v${plugin.version}`.gray);
                });
            }
        } else {
            console.log(`⚠ Could not get server info (HTTP ${infoResponse.status})`.yellow);
        }
        
        // Get server stats
        console.log('\n[3/3] Getting server stats...'.yellow);
        const statsResponse = await fetch(`${baseUrl}/v4/stats`, {
            method: 'GET',
            headers: {
                'Authorization': server.password
            },
            signal: AbortSignal.timeout(5000)
        });
        
        if (statsResponse.ok) {
            const stats = await statsResponse.json();
            console.log(`✓ Server stats retrieved!`.green);
            console.log(`  Players: ${stats.players || 0} (${stats.playingPlayers || 0} playing)`.green);
            console.log(`  Uptime: ${formatUptime(stats.uptime)}`.green);
            console.log(`  Memory: ${formatBytes(stats.memory?.used)} / ${formatBytes(stats.memory?.allocated)}`.green);
            console.log(`  CPU Cores: ${stats.cpu?.cores || 'Unknown'}`.green);
            console.log(`  System Load: ${(stats.cpu?.systemLoad * 100).toFixed(2)}%`.green);
        } else {
            console.log(`⚠ Could not get server stats (HTTP ${statsResponse.status})`.yellow);
        }
        
        results.reachable = true;
        console.log(`\n${'✓ Server is WORKING!'.green.bold}`);
        
    } catch (error) {
        results.error = error.message;
        console.log(`\n${'✗ Server is NOT WORKING!'.red.bold}`);
        
        if (error.name === 'AbortError' || error.code === 'ETIMEDOUT') {
            console.log(`  Error: Connection timeout`.red);
        } else if (error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN') {
            console.log(`  Error: Cannot resolve hostname`.red);
        } else if (error.code === 'ECONNREFUSED') {
            console.log(`  Error: Connection refused`.red);
        } else {
            console.log(`  Error: ${error.message}`.red);
        }
    }
    
    return results;
}

function formatUptime(ms) {
    if (!ms) return 'Unknown';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}

function formatBytes(bytes) {
    if (!bytes) return 'Unknown';
    const mb = bytes / 1024 / 1024;
    if (mb > 1024) {
        return `${(mb / 1024).toFixed(2)} GB`;
    }
    return `${mb.toFixed(2)} MB`;
}

function getPingDisplay(latency) {
    if (!latency) return 'Unknown';
    
    let quality, color;
    if (latency < 100) {
        quality = 'Excellent';
        color = 'green';
    } else if (latency < 200) {
        quality = 'Good';
        color = 'green';
    } else if (latency < 300) {
        quality = 'Fair';
        color = 'yellow';
    } else if (latency < 500) {
        quality = 'Poor';
        color = 'yellow';
    } else {
        quality = 'Very Poor';
        color = 'red';
    }
    
    return `${latency}ms (${quality})`[color];
}

function printComparison(results) {
    console.log(`\n\n${'='.repeat(60)}`.cyan);
    console.log('COMPARISON RESULTS'.cyan.bold);
    console.log(`${'='.repeat(60)}`.cyan);
    
    const working = results.filter(r => r.reachable);
    
    if (working.length === 0) {
        console.log('\n❌ No servers are working!'.red.bold);
        return;
    }
    
    if (working.length < results.length) {
        console.log('\n⚠ Some servers are offline:'.yellow);
        results.filter(r => !r.reachable).forEach(server => {
            console.log(`  • ${server.name}: ${server.error}`.red);
        });
    }
    
    if (working.length === 2) {
        console.log('\n✓ Both servers are online!'.green.bold);
        
        const [server1, server2] = working;
        
        console.log('\n📊 Latency Comparison:'.cyan.bold);
        console.log(`  ${server1.name}: ${getPingDisplay(server1.latency)}`);
        console.log(`  ${server2.name}: ${getPingDisplay(server2.latency)}`);
        
        const latencyDiff = Math.abs(server1.latency - server2.latency);
        const faster = server1.latency < server2.latency ? server1 : server2;
        console.log(`  → ${faster.name} is ${latencyDiff}ms faster`.cyan);
        
        console.log('\n🎵 Plugin Comparison:'.cyan.bold);
        const plugins1 = server1.info?.plugins?.length || 0;
        const plugins2 = server2.info?.plugins?.length || 0;
        console.log(`  ${server1.name}: ${plugins1} plugin(s)`);
        if (server1.info?.plugins) {
            server1.info.plugins.forEach(p => console.log(`    - ${p.name} v${p.version}`.gray));
        }
        console.log(`  ${server2.name}: ${plugins2} plugin(s)`);
        if (server2.info?.plugins) {
            server2.info.plugins.forEach(p => console.log(`    - ${p.name} v${p.version}`.gray));
        }
        
        console.log('\n🏆 RECOMMENDATION:'.green.bold);
        
        if (faster.latency < 200 && plugins1 > 0 && plugins2 > 0) {
            console.log(`  Use ${faster.name} - Lower latency with good plugin support`.green);
        } else if (faster.latency < 200) {
            console.log(`  Use ${faster.name} - Significantly lower latency`.green);
        } else if (plugins1 > plugins2) {
            console.log(`  ${server1.name} might be better - More plugins (likely YouTube support)`.yellow);
        } else if (plugins2 > plugins1) {
            console.log(`  ${server2.name} might be better - More plugins (likely YouTube support)`.yellow);
        } else {
            console.log(`  Both servers are similar - Choose based on reliability preference`.cyan);
        }
        
        console.log('\n⚠️  IMPORTANT: Check YouTube support separately!'.yellow.bold);
        console.log('  Your current server has YouTube support confirmed in .env comments'.yellow);
        console.log('  Test the new server with actual YouTube playback before switching'.yellow);
    } else {
        console.log(`\n✓ ${working[0].name} is working`.green.bold);
        console.log(`  Latency: ${getPingDisplay(working[0].latency)}`);
        console.log(`  Plugins: ${working[0].info?.plugins?.length || 0}`);
    }
    
    console.log('\n📝 Configuration:'.cyan.bold);
    working.forEach(server => {
        const result = results.find(r => r.name === server.name);
        const originalServer = SERVERS.find(s => s.name === server.name);
        console.log(`\n  ${server.name}:`.yellow);
        console.log(`  LAVALINK_HOST=${originalServer.host}`);
        console.log(`  LAVALINK_PORT=${originalServer.port}`);
        console.log(`  LAVALINK_PASSWORD=${originalServer.password}`);
        console.log(`  LAVALINK_SECURE=${originalServer.secure}`);
    });
}

// Run comparison
(async () => {
    console.log('🎵 Lavalink Server Comparison'.cyan.bold);
    console.log(`Testing ${SERVERS.length} servers...\n`.cyan);
    
    const results = [];
    for (const server of SERVERS) {
        const result = await testServer(server);
        results.push(result);
    }
    
    printComparison(results);
})();
