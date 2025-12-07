import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import os from 'os';
import { adminCommands } from '../handlers/messageHandler.js';

export default {
    name: 'stats',
    aliases: ['botstats', 'status'],
    description: 'Show bot statistics (Owner only)',
    ownerOnly: true,
    
    async execute(message, args, client) {
        const e = client.config.emojis;
        const startTime = Date.now();
        
        // Build stats data
        const statsData = await buildStatsData(client);
        const { embed, row } = buildStatsEmbed(client, statsData, startTime);
        
        const replyMsg = await message.reply({ embeds: [embed], components: [row] });
        
        // Button collector
        const collector = replyMsg.createMessageComponentCollector({
            filter: i => i.user.id === message.author.id && i.customId.startsWith('stats_'),
            time: 300000
        });
        
        collector.on('collect', async interaction => {
            const action = interaction.customId.split('_')[1];
            
            if (action === 'refresh') {
                await interaction.deferUpdate();
                const newData = await buildStatsData(client);
                const { embed: newEmbed, row: newRow } = buildStatsEmbed(client, newData, Date.now());
                await interaction.editReply({ embeds: [newEmbed], components: [newRow] });
            } else if (action === 'lavalink') {
                await interaction.deferUpdate();
                // Show lavalink info directly
                const lavalinkEmbed = await buildLavalinkEmbed(client);
                await interaction.followUp({ embeds: [lavalinkEmbed], ephemeral: false });
            } else if (action === 'servers') {
                await interaction.deferUpdate();
                // Show servers info directly
                const serversEmbed = buildServersEmbed(client);
                await interaction.followUp({ embeds: [serversEmbed], ephemeral: false });
            } else if (action === 'health') {
                await interaction.deferUpdate();
                const healthEmbed = await buildHealthCheck(client);
                await interaction.followUp({ embeds: [healthEmbed], ephemeral: true });
            }
        });
        
        collector.on('end', async () => {
            try {
                const disabledRow = ActionRowBuilder.from(replyMsg.components[0]);
                disabledRow.components.forEach(c => c.setDisabled(true));
                await replyMsg.edit({ components: [disabledRow] });
            } catch {}
        });
    }
};

async function buildStatsData(client) {
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    const players = [...client.lavalink.players.values()];
    const nodes = [...client.lavalink.nodeManager.nodes.values()];
    
    // Get command lock status
    let lockedGuilds = 0;
    try {
        const { areCommandsLocked } = await import('../commands/lockcommands.js');
        for (const guildId of client.guilds.cache.keys()) {
            if (areCommandsLocked(guildId)) lockedGuilds++;
        }
    } catch {}
    
    // Get top playing servers
    const playingServers = players
        .filter(p => p.playing && p.queue.current)
        .map(p => {
            const guild = client.guilds.cache.get(p.guildId);
            return {
                name: guild?.name || 'Unknown',
                track: p.queue.current.info.title,
                members: guild?.memberCount || 0
            };
        })
        .sort((a, b) => b.members - a.members)
        .slice(0, 5);
    
    // Calculate total queue tracks
    const totalQueueTracks = players.reduce((sum, p) => sum + (p.queue.tracks?.length || 0), 0);
    
    // Get node health
    const connectedNodes = nodes.filter(n => n.connected).length;
    
    // System stats
    const cpuUsage = os.loadavg()[0]; // 1 minute load average
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const systemMemPercent = ((totalMem - freeMem) / totalMem * 100).toFixed(1);
    
    return {
        uptime,
        memoryUsage,
        players,
        activePlayers: players.filter(p => p.playing).length,
        idlePlayers: players.filter(p => !p.playing).length,
        lockedGuilds,
        playingServers,
        totalQueueTracks,
        nodes,
        connectedNodes,
        cpuUsage,
        systemMemPercent,
        totalMem,
        freeMem
    };
}

function buildStatsEmbed(client, data, startTime) {
    const e = client.config.emojis;
    const {
        uptime, memoryUsage, players, activePlayers, idlePlayers,
        lockedGuilds, playingServers, totalQueueTracks, nodes,
        connectedNodes, cpuUsage, systemMemPercent, totalMem, freeMem
    } = data;
    
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    
    const memoryMB = (memoryUsage.heapUsed / 1024 / 1024).toFixed(2);
    const totalMemoryMB = (memoryUsage.heapTotal / 1024 / 1024).toFixed(2);
    const memoryPercent = ((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100).toFixed(1);
    const rssMB = (memoryUsage.rss / 1024 / 1024).toFixed(2);
    
    // Health indicators
    const pingIndicator = client.ws.ping < 200 ? e.online : client.ws.ping < 500 ? e.warning : e.dnd;
    const memoryIndicator = memoryPercent < 70 ? e.online : memoryPercent < 85 ? e.warning : e.dnd;
    const nodeIndicator = connectedNodes === nodes.length ? e.online : connectedNodes > 0 ? e.warning : e.dnd;
    const cpuIndicator = cpuUsage < 2 ? e.online : cpuUsage < 4 ? e.warning : e.dnd;
    
    // Progress bars
    const memBar = createProgressBar(parseFloat(memoryPercent), 100);
    const sysMemBar = createProgressBar(parseFloat(systemMemPercent), 100);
    
    // Playing servers list
    let playingList = '';
    if (playingServers.length > 0) {
        playingList = playingServers.map((s, i) => 
            `${i + 1}. **${s.name}**\n   └─ ${s.track.substring(0, 35)}${s.track.length > 35 ? '...' : ''}`
        ).join('\n');
    } else {
        playingList = '*No servers currently playing*';
    }
    
    const responseTime = Date.now() - startTime;
    
    const embed = new EmbedBuilder()
        .setColor(client.config.colors.primary)
        .setTitle(`${e.stats_icon || '📊'} Bot Statistics Dashboard`)
        .setDescription(
            `${e.shield || '🛡️'} **${client.config.botName}** v2.2.5\n` +
            `${e.online || '🟢'} Online and operational\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
        )
        .addFields(
            {
                name: `${e.time || '⏰'} Uptime`,
                value: `\`${days}d ${hours}h ${minutes}m ${seconds}s\``,
                inline: true
            },
            {
                name: `${pingIndicator} API Latency`,
                value: `\`${client.ws.ping}ms\``,
                inline: true
            },
            {
                name: `${nodeIndicator} Lavalink`,
                value: `\`${connectedNodes}/${nodes.length} nodes\``,
                inline: true
            },
            {
                name: `${memoryIndicator} Bot Memory`,
                value: `${memBar}\n\`${memoryMB}MB / ${totalMemoryMB}MB (${memoryPercent}%)\`\nRSS: \`${rssMB}MB\``,
                inline: true
            },
            {
                name: `${cpuIndicator} System Resources`,
                value: `${sysMemBar}\nMem: \`${(totalMem/1024/1024/1024).toFixed(1)}GB\` | Load: \`${cpuUsage.toFixed(2)}\``,
                inline: true
            },
            {
                name: `${e.server || '🖥️'} Servers`,
                value: `\`${client.guilds.cache.size}\` servers\n\`${client.guilds.cache.reduce((a, g) => a + g.memberCount, 0).toLocaleString()}\` users`,
                inline: true
            },
            {
                name: `${e.melody || '🎵'} Music Stats`,
                value: `${e.play || '▶️'} Playing: **${activePlayers}**\n` +
                       `${e.pause || '⏸️'} Idle: **${idlePlayers}**\n` +
                       `${e.queue || '📜'} Queued: **${totalQueueTracks}** tracks`,
                inline: true
            },
            {
                name: `${e.gear || '⚙️'} Commands`,
                value: `Slash: **${client.commands.size}**\n` +
                       `Admin: **${adminCommands.size}**\n` +
                       `${lockedGuilds > 0 ? `${e.lock || '🔒'} Locked: **${lockedGuilds}**` : ''}`,
                inline: true
            },
            {
                name: `${e.code || '💻'} Environment`,
                value: `Node: \`${process.version}\`\nPlatform: \`${process.platform}\`\nArch: \`${process.arch}\``,
                inline: true
            },
            {
                name: `${e.play || '▶️'} Now Playing (Top ${playingServers.length})`,
                value: playingList,
                inline: false
            }
        )
        .setFooter({ 
            text: `Response: ${responseTime}ms | v2.2.5 | ${client.config.botName}`,
            iconURL: client.user.displayAvatarURL()
        })
        .setTimestamp();
    
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('stats_refresh')
            .setEmoji('🔄')
            .setLabel('Refresh')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('stats_lavalink')
            .setEmoji('🎵')
            .setLabel('Lavalink')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('stats_servers')
            .setEmoji('🖥️')
            .setLabel('Servers')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('stats_health')
            .setEmoji('🏥')
            .setLabel('Health Check')
            .setStyle(ButtonStyle.Success)
    );
    
    return { embed, row };
}

async function buildHealthCheck(client) {
    const e = client.config.emojis;
    const checks = [];
    
    // Discord connection
    const discordOk = client.ws.ping < 500;
    checks.push(`${discordOk ? '✅' : '❌'} Discord Gateway: ${client.ws.ping}ms`);
    
    // Lavalink nodes
    const nodes = [...client.lavalink.nodeManager.nodes.values()];
    const connectedNodes = nodes.filter(n => n.connected).length;
    checks.push(`${connectedNodes === nodes.length ? '✅' : connectedNodes > 0 ? '⚠️' : '❌'} Lavalink: ${connectedNodes}/${nodes.length} connected`);
    
    // Memory
    const memUsage = process.memoryUsage();
    const memPercent = (memUsage.heapUsed / memUsage.heapTotal * 100);
    checks.push(`${memPercent < 85 ? '✅' : '⚠️'} Memory: ${memPercent.toFixed(1)}% used`);
    
    // CPU Load
    const cpuLoad = os.loadavg()[0];
    checks.push(`${cpuLoad < 4 ? '✅' : '⚠️'} CPU Load: ${cpuLoad.toFixed(2)}`);
    
    // Uptime
    const uptime = process.uptime();
    checks.push(`✅ Uptime: ${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`);
    
    // Guilds cached
    checks.push(`✅ Guilds Cached: ${client.guilds.cache.size}`);
    
    // Players
    const players = client.lavalink.players.size;
    checks.push(`✅ Active Players: ${players}`);
    
    const allOk = checks.every(c => c.startsWith('✅'));
    
    return new EmbedBuilder()
        .setColor(allOk ? client.config.colors.success : client.config.colors.warning)
        .setTitle(`${allOk ? '✅' : '⚠️'} System Health Check`)
        .setDescription(checks.join('\n'))
        .setFooter({ text: 'Health check completed' })
        .setTimestamp();
}

function createProgressBar(value, max, length = 10) {
    const percentage = Math.min(value / max, 1);
    const filled = Math.round(percentage * length);
    const empty = length - filled;
    const filledChar = percentage < 0.7 ? '🟩' : percentage < 0.85 ? '🟨' : '🟥';
    return filledChar.repeat(filled) + '⬜'.repeat(empty);
}

function buildServersEmbed(client) {
    const e = client.config.emojis;
    const guilds = [...client.guilds.cache.values()];
    const totalMembers = guilds.reduce((sum, g) => sum + g.memberCount, 0);
    const players = [...client.lavalink.players.values()];
    const playingGuilds = players.filter(p => p.playing).length;
    
    // Sort by member count
    const topGuilds = guilds
        .sort((a, b) => b.memberCount - a.memberCount)
        .slice(0, 10);
    
    const guildList = topGuilds.map((g, i) => {
        const player = client.lavalink.getPlayer(g.id);
        const playing = player?.playing ? ' 🎵' : '';
        return `**${i + 1}.** ${g.name} - ${g.memberCount.toLocaleString()} members${playing}`;
    }).join('\n');
    
    return new EmbedBuilder()
        .setColor(client.config.colors.primary)
        .setTitle(`${e.server || '🏠'} Server Statistics`)
        .setDescription(
            `**Total Servers:** ${guilds.length.toLocaleString()}\n` +
            `**Total Members:** ${totalMembers.toLocaleString()}\n` +
            `**Playing Music:** ${playingGuilds} servers\n\n` +
            `**Top 10 Servers:**\n${guildList}`
        )
        .setFooter({ text: 'Server Statistics' })
        .setTimestamp();
}

async function buildLavalinkEmbed(client) {
    const e = client.config.emojis;
    const nodes = [...client.lavalink.nodeManager.nodes.values()];
    const players = [...client.lavalink.players.values()];
    const activePlayers = players.filter(p => p.playing).length;
    
    if (nodes.length === 0) {
        return new EmbedBuilder()
            .setColor(client.config.colors.error)
            .setTitle(`${e.error} No Lavalink Nodes`)
            .setDescription('No Lavalink nodes configured!')
            .setTimestamp();
    }
    
    const nodeFields = [];
    for (const node of nodes) {
        const status = node.connected ? `${e.online} Connected` : `${e.dnd} Disconnected`;
        let stats = 'N/A';
        
        if (node.connected && node.stats) {
            const memPercent = node.stats.memory ? 
                ((node.stats.memory.used / node.stats.memory.allocated) * 100).toFixed(0) : 0;
            const cpuPercent = node.stats.cpu ? 
                (node.stats.cpu.lavalinkLoad * 100).toFixed(1) : 0;
            stats = `Players: ${node.stats.players || 0} | CPU: ${cpuPercent}% | RAM: ${memPercent}%`;
        }
        
        nodeFields.push({
            name: `${node.connected ? '🟢' : '🔴'} ${node.options?.identifier || node.options?.host}`,
            value: `${status}\n${stats}`,
            inline: false
        });
    }
    
    const connectedNodes = nodes.filter(n => n.connected).length;
    
    return new EmbedBuilder()
        .setColor(connectedNodes === nodes.length ? client.config.colors.success : 
                  connectedNodes > 0 ? client.config.colors.warning : client.config.colors.error)
        .setTitle(`${e.melody || '🎵'} Lavalink Status`)
        .setDescription(`**Nodes:** ${connectedNodes}/${nodes.length} online\n**Players:** ${activePlayers} active / ${players.length} total`)
        .addFields(nodeFields.slice(0, 5))
        .setFooter({ text: 'Lavalink Node Status' })
        .setTimestamp();
}
