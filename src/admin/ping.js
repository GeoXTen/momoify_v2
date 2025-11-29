import { EmbedBuilder } from 'discord.js';

export default {
    name: 'ping',
    description: 'Check bot latency - v2.2.5 (Owner only)',
    ownerOnly: true,
    
    async execute(message, args, client) {
        const startTime = Date.now();
        const sent = await message.reply('🏓 Pinging...');
        
        // Bot API latency
        const apiLatency = client.ws.ping;
        const botLatency = Date.now() - startTime;
        
        // Get Lavalink nodes
        const nodes = [...client.lavalink.nodeManager.nodes.values()];
        
        const e = client.config.emojis;
        
        // Get ping quality indicators
        const getQuality = (ping) => {
            if (ping < 100) return `${e.online} Excellent`;
            if (ping < 200) return `${e.online} Good`;
            if (ping < 300) return `${e.warning} Fair`;
            if (ping < 500) return `${e.warning} Poor`;
            return `${e.dnd} Very Poor`;
        };
        
        const embed = new EmbedBuilder()
            .setColor(client.config.colors.primary)
            .setTitle(`${e.online} Pong!`)
            .addFields(
                {
                    name: `${e.chart} Discord API Latency`,
                    value: `└─ ${apiLatency}ms (${getQuality(apiLatency)})`,
                    inline: false
                },
                {
                    name: `${e.rocket} Bot Response Time`,
                    value: `└─ ${botLatency}ms`,
                    inline: false
                }
            );
        
        if (nodes.length > 0) {
            for (const node of nodes) {
                const nodeStart = Date.now();
                try {
                    // Try to get node stats as a ping test
                    const stats = node.stats;
                    const nodePing = Date.now() - nodeStart;
                    
                    const statusEmoji = node.connected ? e.online : e.dnd;
                    const statusText = node.connected ? 'Connected' : 'Disconnected';
                    
                    let nodeInfo = `${statusEmoji} Status: ${statusText}\n`;
                    nodeInfo += `└─ ${e.time} Response: ${nodePing}ms (${getQuality(nodePing)})\n`;
                    
                    if (node.connected && stats) {
                        nodeInfo += `└─ ${e.play} Players: ${stats.players || 0} (${stats.playingPlayers || 0} active)\n`;
                        nodeInfo += `└─ ${e.clock || '⏰'} Uptime: ${formatUptime(stats.uptime || 0)}\n`;
                        
                        if (stats.cpu) {
                            const cpuLoad = (stats.cpu.lavalinkLoad * 100).toFixed(1);
                            const cpuEmoji = cpuLoad < 50 ? e.online : cpuLoad < 75 ? e.warning : e.dnd;
                            nodeInfo += `└─ ${cpuEmoji} CPU: ${cpuLoad}%`;
                        }
                    }
                    
                    embed.addFields({
                        name: `${e.server} ${node.options.id}`,
                        value: nodeInfo,
                        inline: false
                    });
                } catch (error) {
                    embed.addFields({
                        name: `${e.error} ${node.options.id}`,
                        value: `Error: ${error.message}`,
                        inline: false
                    });
                }
            }
        }
        
        // Performance recommendations
        let warnings = [];
        if (apiLatency > 200) {
            warnings.push(`${e.warning} High Discord API latency detected - Check your network connection`);
        }
        
        if (nodes.some(n => n.connected && n.stats?.cpu?.lavalinkLoad > 0.75)) {
            warnings.push(`${e.warning} High Lavalink CPU usage detected - Consider upgrading your Lavalink server`);
        }
        
        if (warnings.length > 0) {
            embed.addFields({
                name: `${e.bulb} Recommendations`,
                value: warnings.join('\n'),
                inline: false
            });
        }
        
        embed.setFooter({ text: 'v2.2.5 | Latency Check Complete' });
        embed.setTimestamp();
        
        await sent.edit({ content: null, embeds: [embed] });
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
    
    return parts.join(' ') || '<1m';
}
