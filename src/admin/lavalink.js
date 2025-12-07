import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export default {
    name: 'lavalink',
    aliases: ['ll', 'nodes', 'audio'],
    description: 'Show Lavalink node status (Owner only)',
    ownerOnly: true,
    
    async execute(message, args, client) {
        const e = client.config.emojis;
        const startTime = Date.now();
        
        const nodes = [...client.lavalink.nodeManager.nodes.values()];
        
        if (nodes.length === 0) {
            const embed = new EmbedBuilder()
                .setColor(client.config.colors.error)
                .setTitle(`${e.error} No Lavalink Nodes`)
                .setDescription('No Lavalink nodes configured!')
                .setFooter({ text: 'v2.2.5 | Lavalink Status' })
                .setTimestamp();
            return await message.reply({ embeds: [embed] });
        }
        
        const { embed, row } = await buildLavalinkEmbed(client, startTime);
        const replyMsg = await message.reply({ embeds: [embed], components: [row] });
        
        // Button collector
        const collector = replyMsg.createMessageComponentCollector({
            filter: i => i.user.id === message.author.id && i.customId.startsWith('lavalink_'),
            time: 300000
        });
        
        collector.on('collect', async interaction => {
            const action = interaction.customId.split('_')[1];
            
            if (action === 'refresh') {
                await interaction.deferUpdate();
                const { embed: newEmbed, row: newRow } = await buildLavalinkEmbed(client, Date.now());
                await interaction.editReply({ embeds: [newEmbed], components: [newRow] });
            } else if (action === 'players') {
                await interaction.deferUpdate();
                const playersEmbed = buildPlayersEmbed(client);
                await interaction.followUp({ embeds: [playersEmbed], ephemeral: true });
            } else if (action === 'reconnect') {
                await interaction.deferUpdate();
                await reconnectNodes(client, interaction);
            } else if (action === 'sources') {
                await interaction.deferUpdate();
                const sourcesEmbed = await buildSourcesEmbed(client);
                await interaction.followUp({ embeds: [sourcesEmbed], ephemeral: true });
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

async function buildLavalinkEmbed(client, startTime) {
    const e = client.config.emojis;
    const nodes = [...client.lavalink.nodeManager.nodes.values()];
    const players = [...client.lavalink.players.values()];
    const activePlayers = players.filter(p => p.playing).length;
    const idlePlayers = players.length - activePlayers;
    
    // Calculate total queue tracks
    const totalQueueTracks = players.reduce((sum, p) => sum + (p.queue.tracks?.length || 0), 0);
    
    const connectedNodes = nodes.filter(n => n.connected).length;
    const overallStatus = connectedNodes === nodes.length ? e.online : connectedNodes > 0 ? e.warning : e.dnd;
    
    const embed = new EmbedBuilder()
        .setColor(connectedNodes === nodes.length ? client.config.colors.success : 
                  connectedNodes > 0 ? client.config.colors.warning : client.config.colors.error)
        .setTitle(`${e.server || '🖥️'} Lavalink Status Dashboard`)
        .setDescription(
            `${overallStatus} **${connectedNodes}/${nodes.length}** nodes connected\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `${e.play || '▶️'} **${activePlayers}** playing | ` +
            `${e.pause || '⏸️'} **${idlePlayers}** idle | ` +
            `${e.queue || '📜'} **${totalQueueTracks}** queued`
        );
    
    // Build node info
    for (const node of nodes) {
        const isConnected = node.connected;
        const statusEmoji = isConnected ? e.online || '🟢' : e.dnd || '🔴';
        
        let nodeInfo = '';
        
        // Host info (hidden for local)
        const isLocalHost = ['localhost', '127.0.0.1'].includes(node.options.host) ||
                           node.options.host.startsWith('192.168.') ||
                           node.options.host.startsWith('10.') ||
                           node.options.host.startsWith('172.');
        
        const hostDisplay = isLocalHost ? `\`Local Server\` ${e.lock || '🔒'}` : `\`${node.options.host}:${node.options.port}\``;
        
        if (isConnected) {
            // Fetch node info
            let latency = null;
            let versionInfo = null;
            let plugins = [];
            
            try {
                const protocol = node.options.secure ? 'https' : 'http';
                const baseUrl = `${protocol}://${node.options.host}:${node.options.port}`;
                const pingStart = Date.now();
                
                const [pingResult, infoResult] = await Promise.allSettled([
                    fetch(`${baseUrl}/version`, {
                        headers: { 'Authorization': node.options.authorization },
                        signal: AbortSignal.timeout(2000)
                    }),
                    fetch(`${baseUrl}/v4/info`, {
                        headers: { 'Authorization': node.options.authorization },
                        signal: AbortSignal.timeout(2000)
                    })
                ]);
                
                latency = Date.now() - pingStart;
                
                if (infoResult.status === 'fulfilled' && infoResult.value.ok) {
                    const info = await infoResult.value.json();
                    versionInfo = info.version?.semver || info.version;
                    plugins = info.plugins || [];
                }
            } catch {}
            
            // Build info display
            const pingDisplay = latency ? getPingDisplay(latency, e) : 'N/A';
            
            nodeInfo = `${statusEmoji} **Connected** | ${hostDisplay}\n`;
            nodeInfo += `${e.time || '⏱️'} Ping: ${pingDisplay}`;
            if (versionInfo) nodeInfo += ` | Ver: \`${versionInfo}\``;
            nodeInfo += '\n';
            
            // Node stats
            if (node.stats) {
                const stats = node.stats;
                const memPercent = stats.memory ? ((stats.memory.used / stats.memory.allocated) * 100).toFixed(0) : 0;
                const cpuPercent = stats.cpu ? (stats.cpu.lavalinkLoad * 100).toFixed(0) : 0;
                
                const memBar = createMiniBar(parseFloat(memPercent));
                const cpuBar = createMiniBar(parseFloat(cpuPercent));
                
                nodeInfo += `${e.control || '🎛️'} Players: **${stats.playingPlayers || 0}**/${stats.players || 0}\n`;
                nodeInfo += `💾 Mem: ${memBar} ${memPercent}% | 🔧 CPU: ${cpuBar} ${cpuPercent}%\n`;
                nodeInfo += `⏰ Uptime: \`${formatUptime(stats.uptime || 0)}\``;
                
                if (stats.frameStats && stats.frameStats.deficit > 0) {
                    nodeInfo += ` | ⚠️ Frame deficit: ${stats.frameStats.deficit}`;
                }
            }
            
            // Plugins summary
            if (plugins.length > 0) {
                const pluginNames = plugins.slice(0, 3).map(p => p.name.replace('lavasrc', 'LS').replace('youtube', 'YT').replace('sponsorblock', 'SB'));
                nodeInfo += `\n🔌 Plugins: ${pluginNames.join(', ')}${plugins.length > 3 ? ` +${plugins.length - 3}` : ''}`;
            }
        } else {
            nodeInfo = `${statusEmoji} **Disconnected** | ${hostDisplay}\n`;
            nodeInfo += `⚠️ Node is offline or unreachable`;
        }
        
        embed.addFields({
            name: `${statusEmoji} ${node.options.id}`,
            value: nodeInfo,
            inline: false
        });
    }
    
    const responseTime = Date.now() - startTime;
    
    embed.setFooter({ 
        text: `Response: ${responseTime}ms | v2.2.5 | Discord: ${client.ws.ping}ms`,
        iconURL: client.user.displayAvatarURL()
    }).setTimestamp();
    
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('lavalink_refresh')
            .setEmoji('🔄')
            .setLabel('Refresh')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('lavalink_players')
            .setEmoji('🎵')
            .setLabel(`Players (${players.length})`)
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('lavalink_sources')
            .setEmoji('📊')
            .setLabel('Sources')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('lavalink_reconnect')
            .setEmoji('🔌')
            .setLabel('Reconnect')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(connectedNodes === nodes.length)
    );
    
    return { embed, row };
}

function buildPlayersEmbed(client) {
    const e = client.config.emojis;
    const players = [...client.lavalink.players.values()];
    
    if (players.length === 0) {
        return new EmbedBuilder()
            .setColor(client.config.colors.warning)
            .setTitle(`${e.melody || '🎵'} Active Players`)
            .setDescription('No active players')
            .setTimestamp();
    }
    
    const playerList = players.slice(0, 15).map((p, i) => {
        const guild = client.guilds.cache.get(p.guildId);
        const status = p.playing ? (e.play || '▶️') : (e.pause || '⏸️');
        const track = p.queue.current?.info?.title?.substring(0, 30) || 'No track';
        const queueSize = p.queue.tracks?.length || 0;
        
        return `${status} **${guild?.name || 'Unknown'}**\n` +
               `└─ ${track}${track.length >= 30 ? '...' : ''} | Queue: ${queueSize}`;
    }).join('\n\n');
    
    return new EmbedBuilder()
        .setColor(client.config.colors.primary)
        .setTitle(`${e.melody || '🎵'} Active Players (${players.length})`)
        .setDescription(playerList || 'No players')
        .setFooter({ text: `Showing ${Math.min(players.length, 15)} of ${players.length}` })
        .setTimestamp();
}

async function buildSourcesEmbed(client) {
    const e = client.config.emojis;
    const players = [...client.lavalink.players.values()];
    
    // Count track sources
    const sources = {};
    for (const player of players) {
        if (player.queue.current?.info?.sourceName) {
            const source = player.queue.current.info.sourceName;
            sources[source] = (sources[source] || 0) + 1;
        }
        for (const track of player.queue.tracks || []) {
            if (track.info?.sourceName) {
                const source = track.info.sourceName;
                sources[source] = (sources[source] || 0) + 1;
            }
        }
    }
    
    const sourceIcons = {
        youtube: '📺',
        spotify: '💚',
        soundcloud: '🟠',
        deezer: '💜',
        applemusic: '🍎',
        bandcamp: '🎸',
        twitch: '💜',
        vimeo: '🔵',
        http: '🌐'
    };
    
    const total = Object.values(sources).reduce((a, b) => a + b, 0);
    
    let description = '';
    if (total === 0) {
        description = '*No tracks currently loaded*';
    } else {
        const sortedSources = Object.entries(sources).sort((a, b) => b[1] - a[1]);
        description = sortedSources.map(([source, count]) => {
            const icon = sourceIcons[source.toLowerCase()] || '🎵';
            const percent = ((count / total) * 100).toFixed(1);
            const bar = createMiniBar(parseFloat(percent));
            return `${icon} **${source}**: ${count} tracks (${percent}%)\n${bar}`;
        }).join('\n\n');
    }
    
    return new EmbedBuilder()
        .setColor(client.config.colors.primary)
        .setTitle(`${e.chart || '📊'} Track Sources`)
        .setDescription(description)
        .addFields({
            name: 'Summary',
            value: `Total tracks loaded: **${total}**\nActive players: **${players.length}**`,
            inline: false
        })
        .setTimestamp();
}

async function reconnectNodes(client, interaction) {
    const e = client.config.emojis;
    const nodes = [...client.lavalink.nodeManager.nodes.values()];
    const disconnected = nodes.filter(n => !n.connected);
    
    if (disconnected.length === 0) {
        return interaction.followUp({
            embeds: [{
                color: client.config.colors.success,
                description: `${e.checkmark || '✅'} All nodes are already connected!`
            }],
            ephemeral: true
        });
    }
    
    let reconnected = 0;
    for (const node of disconnected) {
        try {
            await node.connect();
            reconnected++;
        } catch (err) {
            console.error(`Failed to reconnect node ${node.options.id}:`, err);
        }
    }
    
    await interaction.followUp({
        embeds: [{
            color: reconnected > 0 ? client.config.colors.success : client.config.colors.error,
            description: reconnected > 0 
                ? `${e.checkmark || '✅'} Reconnected **${reconnected}/${disconnected.length}** nodes`
                : `${e.error || '❌'} Failed to reconnect any nodes`
        }],
        ephemeral: true
    });
}

function formatUptime(ms) {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 && days === 0) parts.push(`${seconds}s`);
    
    return parts.join(' ') || '0s';
}

function getPingDisplay(latency, emojis) {
    if (!latency) return 'N/A';
    
    let indicator;
    if (latency < 100) indicator = emojis.online || '🟢';
    else if (latency < 200) indicator = emojis.online || '🟢';
    else if (latency < 300) indicator = emojis.warning || '🟡';
    else if (latency < 500) indicator = emojis.warning || '🟡';
    else indicator = emojis.dnd || '🔴';
    
    return `${indicator} **${latency}ms**`;
}

function createMiniBar(percent, length = 8) {
    const filled = Math.round((percent / 100) * length);
    const empty = length - filled;
    const char = percent < 70 ? '▓' : percent < 85 ? '▓' : '▓';
    return `\`[${'█'.repeat(filled)}${'░'.repeat(empty)}]\``;
}
