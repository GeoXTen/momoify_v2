import { EmbedBuilder } from 'discord.js';

export default {
    name: 'lavalink',
    description: 'Show Lavalink node status - v2.2.5 (Owner only)',
    ownerOnly: true,
    
    async execute(message, args, client) {
        const nodes = [...client.lavalink.nodeManager.nodes.values()];
        const players = [...client.lavalink.players.values()];
        const activePlayers = players.filter(p => p.playing).length;
        const idlePlayers = players.length - activePlayers;
        
        const e = client.config.emojis;
        
        if (nodes.length === 0) {
            const embed = new EmbedBuilder()
                .setColor(client.config.colors.error)
                .setTitle(`${e.error} No Lavalink Nodes`)
                .setDescription('No Lavalink nodes found!')
                .setFooter({ text: 'v2.2.5 | Lavalink Status' })
                .setTimestamp();
            
            return await message.reply({ embeds: [embed] });
        }
        
        const embed = new EmbedBuilder()
            .setColor(client.config.colors.primary)
            .setTitle(`${e.server} Lavalink Status Dashboard`)
            .setDescription(`${e.control} Monitoring ${nodes.length} node(s)`)
            .setFooter({ text: `v2.2.5 | Updated` })
            .setTimestamp();
        
        let nodeFields = [];
        
        for (const node of nodes) {
            const isConnected = node.connected;
            const statusEmoji = isConnected ? e.online : e.dnd;
            const statusText = isConnected ? 'Connected' : 'Disconnected';
            
            let nodeInfo = `${statusEmoji} **Status:** ${statusText}\n`;
            
            // Hide localhost/local IP details for security
            const isLocalHost = node.options.host === 'localhost' || 
                                node.options.host === '127.0.0.1' || 
                                node.options.host.startsWith('192.168.') || 
                                node.options.host.startsWith('10.') ||
                                node.options.host.startsWith('172.');
            
            if (isLocalHost) {
                nodeInfo += `${e.server} **Host:** \`Local Server\` ${e.lock}\n`;
            } else {
                nodeInfo += `${e.server} **Host:** \`${node.options.host}:${node.options.port}\`\n`;
            }
            
            nodeInfo += `${e.shield} **Secure:** ${node.options.secure ? e.checkmark + ' Yes' : e.error + ' No'}\n`;
            
            // Measure Lavalink ping and fetch info in parallel
            if (isConnected) {
                try {
                    const protocol = node.options.secure ? 'https' : 'http';
                    const baseUrl = `${protocol}://${node.options.host}:${node.options.port}`;
                    const startTime = Date.now();
                    
                    // Execute both requests in parallel with reduced timeout
                    const [pingResult, infoResult] = await Promise.allSettled([
                        // Ping request
                        fetch(`${baseUrl}/version`, {
                            method: 'GET',
                            headers: {
                                'Authorization': node.options.authorization
                            },
                            signal: AbortSignal.timeout(2000) // Reduced from 5000ms to 2000ms
                        }),
                        
                        // Info request
                        fetch(`${baseUrl}/v4/info`, {
                            method: 'GET',
                            headers: {
                                'Authorization': node.options.authorization
                            },
                            signal: AbortSignal.timeout(2000) // Reduced from 5000ms to 2000ms
                        })
                    ]);
                    
                    const latency = Date.now() - startTime;
                    
                    // Handle ping result
                    if (pingResult.status === 'fulfilled' && pingResult.value.ok) {
                        nodeInfo += `${e.time} **Lavalink Ping:** ${getPingDisplay(latency, e)}\n`;
                    } else {
                        nodeInfo += `${e.error} **Lavalink Ping:** Failed\n`;
                    }
                    
                    // Handle info result  
                    if (infoResult.status === 'fulfilled' && infoResult.value.ok) {
                        try {
                            const info = await infoResult.value.json();
                            const versionInfo = info.version?.semver || info.version || 'Unknown';
                            const buildTime = info.buildTime ? new Date(info.buildTime).toLocaleDateString() : 'Unknown';
                            const plugins = info.plugins || [];
                            
                            nodeInfo += `\n${e.database} **Version Info:**\n`;
                            nodeInfo += `└─ ${e.verified} Version: **${versionInfo}**\n`;
                            nodeInfo += `└─ ${e.time} Build: **${buildTime}**\n`;
                            
                            if (plugins.length > 0) {
                                nodeInfo += `\n${e.stars} **Plugins (${plugins.length}):**\n`;
                                const pluginList = plugins.slice(0, 5).map(plugin => 
                                    `└─ ${e.checkmark} ${plugin.name} \`v${plugin.version}\``
                                ).join('\n');
                                nodeInfo += pluginList;
                                if (plugins.length > 5) {
                                    nodeInfo += `\n└─ ... and ${plugins.length - 5} more`;
                                }
                            } else {
                                nodeInfo += `\n${e.stars} **Plugins:** None loaded\n`;
                            }
                        } catch (error) {
                            console.error('Failed to parse info response:', error);
                            nodeInfo += `\n${e.warning} Could not parse server information\n`;
                        }
                    } else {
                        nodeInfo += `\n${e.warning} Could not fetch server information\n`;
                    }
                } catch (error) {
                    console.error('Failed to fetch Lavalink info:', error);
                    nodeInfo += `${e.error} **Lavalink Ping:** Failed\n`;
                    nodeInfo += `\n${e.warning} Could not fetch server information\n`;
                }
            }
            
            if (isConnected && node.stats) {
                const stats = node.stats;
                nodeInfo += `\n${e.chart} **Node Statistics:**\n`;
                nodeInfo += `└─ ${e.play} Players: **${stats.players || 0}** (${stats.playingPlayers || 0} active)\n`;
                nodeInfo += `└─ ${e.time} Uptime: **${formatUptime(stats.uptime || 0)}**\n`;
                
                if (stats.memory) {
                    const memUsed = (stats.memory.used / 1024 / 1024).toFixed(2);
                    const memTotal = (stats.memory.allocated / 1024 / 1024).toFixed(2);
                    const memPercent = ((stats.memory.used / stats.memory.allocated) * 100).toFixed(1);
                    const memEmoji = memPercent < 70 ? e.online : memPercent < 85 ? e.warning : e.dnd;
                    nodeInfo += `└─ ${memEmoji} Memory: **${memUsed}MB** / ${memTotal}MB (${memPercent}%)\n`;
                }
                
                if (stats.cpu) {
                    const cpuLoad = (stats.cpu.systemLoad * 100).toFixed(1);
                    const lavalinkLoad = (stats.cpu.lavalinkLoad * 100).toFixed(1);
                    const cpuEmoji = lavalinkLoad < 50 ? e.online : lavalinkLoad < 75 ? e.warning : e.dnd;
                    nodeInfo += `└─ ${cpuEmoji} CPU Load: **${cpuLoad}%** (System) | **${lavalinkLoad}%** (Lavalink)\n`;
                    nodeInfo += `└─ ${e.cpu} CPU Cores: **${stats.cpu.cores || 0}**\n`;
                }
                
                if (stats.frameStats) {
                    const deficit = stats.frameStats.deficit || 0;
                    const frameEmoji = deficit === 0 ? e.online : e.warning;
                    nodeInfo += `└─ ${frameEmoji} Frame Stats: ${stats.frameStats.sent || 0} sent | ${deficit} deficit\n`;
                }
            }
            
            // Add node as a field (truncate if too long)
            nodeFields.push({
                name: `${statusEmoji} Node: ${node.options.id}`,
                value: nodeInfo.substring(0, 1024),
                inline: false
            });
        }
        
        // Add node fields to embed
        embed.addFields(...nodeFields);
        
        // Add global statistics
        embed.addFields(
            {
                name: `${e.melody} Global Music Statistics`,
                value: `└─ ${e.play} Active Players: **${activePlayers}**\n` +
                       `└─ ${e.pause} Idle Players: **${idlePlayers}**\n` +
                       `└─ ${e.queue} Total Players: **${players.length}**\n` +
                       `└─ ${e.online} Discord Ping: **${client.ws.ping}ms**`,
                inline: false
            },
            {
                name: `${e.gear} Configuration`,
                value: (() => {
                    const isLocalConfig = client.config.lavalink.host === 'localhost' || 
                                         client.config.lavalink.host === '127.0.0.1' || 
                                         client.config.lavalink.host.startsWith('192.168.') || 
                                         client.config.lavalink.host.startsWith('10.') ||
                                         client.config.lavalink.host.startsWith('172.');
                    
                    if (isLocalConfig) {
                        return `└─ ${e.server} Host: \`Local Server\` ${e.lock}\n` +
                               `└─ ${e.shield} Secure: ${client.config.lavalink.secure ? e.checkmark + ' Yes' : e.error + ' No'}`;
                    } else {
                        return `└─ ${e.server} Host: \`${client.config.lavalink.host}:${client.config.lavalink.port}\`\n` +
                               `└─ ${e.shield} Secure: ${client.config.lavalink.secure ? e.checkmark + ' Yes' : e.error + ' No'}`;
                    }
                })(),
                inline: false
            }
        );
        
        await message.reply({ embeds: [embed] });
    }
};

function formatUptime(ms) {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0) parts.push(`${seconds}s`);
    
    return parts.join(' ') || '0s';
}

function getPingDisplay(latency, emojis) {
    if (!latency) return 'Unknown';
    
    let quality;
    if (latency < 100) {
        quality = `${emojis.online} Excellent`;
    } else if (latency < 200) {
        quality = `${emojis.online} Good`;
    } else if (latency < 300) {
        quality = `${emojis.warning} Fair`;
    } else if (latency < 500) {
        quality = `${emojis.warning} Poor`;
    } else {
        quality = `${emojis.dnd} Very Poor`;
    }
    
    return `**${latency}ms** (${quality})`;
}
