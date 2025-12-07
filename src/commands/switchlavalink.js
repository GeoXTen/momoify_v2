import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import https from 'https';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..', '..');

// Parse servers from the lavalink server list file
function parseServerList() {
    try {
        const filePath = join(projectRoot, 'lavalink server lis.txt');
        const content = readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        const servers = [];
        
        // Find JSON array with quoted keys
        let arrayStart = -1;
        for (let i = 60; i < lines.length; i++) {
            if (lines[i].trim() === '[') {
                const next10 = lines.slice(i, i + 10).join('\n');
                if (next10.includes('"name"')) {
                    arrayStart = i;
                    break;
                }
            }
        }
        
        if (arrayStart > 0) {
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
            
            const arrayText = arrayLines.join('\n').replace(/chttps:/g, 'https:');
            
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
                            region: server.region || '🌍 Unknown',
                            version: server.version || 'v3'
                        });
                    }
                }
            } catch (e) {
                console.error('Failed to parse server list:', e.message);
            }
        }
        
        // Remove duplicates
        const uniqueServers = [];
        const seenKeys = new Set();
        for (const server of servers) {
            const key = `${server.host}:${server.port}`;
            if (!seenKeys.has(key)) {
                seenKeys.add(key);
                uniqueServers.push(server);
            }
        }
        
        return uniqueServers;
    } catch (error) {
        console.error('Error reading server list:', error.message);
        return [];
    }
}

// Test a single server with detailed stats
function testServer(server, timeout = 5000) {
    return new Promise((resolve) => {
        const startTime = Date.now();
        const protocol = server.secure ? https : http;
        const url = `${server.secure ? 'https' : 'http'}://${server.host}:${server.port}/v4/stats`;
        
        const req = protocol.get(url, {
            headers: { 'Authorization': server.password },
            timeout: timeout,
            rejectUnauthorized: false
        }, (res) => {
            const latency = Date.now() - startTime;
            let data = '';
            
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const result = {
                    ...server,
                    latency,
                    status: res.statusCode,
                    online: res.statusCode === 200,
                    players: 0,
                    playingPlayers: 0,
                    memory: null,
                    cpu: null,
                    uptime: null
                };
                
                try {
                    const stats = JSON.parse(data);
                    result.players = stats.players || 0;
                    result.playingPlayers = stats.playingPlayers || 0;
                    result.uptime = stats.uptime || null;
                    if (stats.memory) {
                        result.memory = {
                            used: Math.round(stats.memory.used / 1024 / 1024),
                            allocated: Math.round(stats.memory.allocated / 1024 / 1024)
                        };
                    }
                    if (stats.cpu) {
                        result.cpu = Math.round(stats.cpu.lavalinkLoad * 100);
                    }
                } catch (e) {
                    // Stats parsing failed, try version endpoint
                }
                
                resolve(result);
            });
        });
        
        req.on('error', () => {
            resolve({
                ...server,
                latency: 9999,
                online: false,
                error: 'Connection failed'
            });
        });
        
        req.on('timeout', () => {
            req.destroy();
            resolve({
                ...server,
                latency: 9999,
                online: false,
                error: 'Timeout'
            });
        });
    });
}

// Format uptime
function formatUptime(ms) {
    if (!ms) return 'Unknown';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
}

export default {
    data: new SlashCommandBuilder()
        .setName('switchlavalink')
        .setDescription('Switch to a different Lavalink server (Owner only)')
        .addStringOption(option =>
            option.setName('filter')
                .setDescription('Filter servers')
                .setRequired(false)
                .addChoices(
                    { name: 'All Servers', value: 'all' },
                    { name: 'V4 Only', value: 'v4' },
                    { name: 'V3 Only', value: 'v3' },
                    { name: 'Europe', value: 'eu' },
                    { name: 'US', value: 'us' }
                )),
    
    aliases: ['switchlava', 'lavaswitch', 'changelava'],
    ownerOnly: true,
    
    async execute(interaction, client) {
        const e = client.config.emojis;
        const isSlash = interaction.isChatInputCommand?.();
        
        // Check if user is bot owner
        const userId = isSlash ? interaction.user.id : interaction.author.id;
        if (userId !== client.config.ownerId) {
            const errorEmbed = {
                color: client.config.colors.error,
                title: `${e.error} Access Denied`,
                description: `${e.lock} This command is only available to the bot owner.`
            };
            
            if (isSlash) {
                return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            } else {
                return interaction.reply({ embeds: [errorEmbed] });
            }
        }
        
        // Defer/send initial message
        let msg;
        if (isSlash) {
            await interaction.deferReply();
        } else {
            msg = await interaction.reply({
                embeds: [{
                    color: client.config.colors.primary,
                    title: `${e.loading} Testing Lavalink Servers...`,
                    description: `${e.server} Loading server list...`
                }]
            });
        }
        
        // Get filter option
        const filter = isSlash ? (interaction.options.getString('filter') || 'all') : 'all';
        
        // Parse servers from file
        let servers = parseServerList();
        
        if (servers.length === 0) {
            const errorEmbed = {
                color: client.config.colors.error,
                title: `${e.error} No Servers Found`,
                description: `${e.warning} Could not load server list from file.`
            };
            
            if (isSlash) {
                return interaction.editReply({ embeds: [errorEmbed] });
            } else {
                return msg.edit({ embeds: [errorEmbed] });
            }
        }
        
        // Apply filter
        if (filter === 'v4') {
            servers = servers.filter(s => s.version === 'v4');
        } else if (filter === 'v3') {
            servers = servers.filter(s => s.version === 'v3');
        } else if (filter === 'eu') {
            servers = servers.filter(s => s.region?.toLowerCase().includes('eu') || s.region?.includes('🇪🇺'));
        } else if (filter === 'us') {
            servers = servers.filter(s => s.region?.toLowerCase().includes('us') || s.region?.includes('🇺🇸'));
        }
        
        // Update status
        const testingEmbed = {
            color: client.config.colors.primary,
            title: `${e.loading} Testing Lavalink Servers...`,
            description: `${e.server} Testing **${servers.length}** servers...\n${e.time} This may take a moment...`
        };
        
        if (isSlash) {
            await interaction.editReply({ embeds: [testingEmbed] });
        } else {
            await msg.edit({ embeds: [testingEmbed] });
        }
        
        // Test all servers in parallel (batches of 5)
        const results = [];
        const batchSize = 5;
        
        for (let i = 0; i < servers.length; i += batchSize) {
            const batch = servers.slice(i, i + batchSize);
            const batchResults = await Promise.all(batch.map(s => testServer(s)));
            results.push(...batchResults);
        }
        
        // Sort by latency and filter online
        const onlineServers = results
            .filter(s => s.online)
            .sort((a, b) => a.latency - b.latency);
        
        const offlineCount = results.filter(s => !s.online).length;
        
        if (onlineServers.length === 0) {
            const errorEmbed = {
                color: client.config.colors.error,
                title: `${e.error} No Servers Available`,
                description: `${e.warning} All ${results.length} servers are offline or unreachable.\n\n` +
                           `${e.info} Try again later or check your network.`
            };
            
            if (isSlash) {
                return interaction.editReply({ embeds: [errorEmbed] });
            } else {
                return msg.edit({ embeds: [errorEmbed] });
            }
        }
        
        // Get top 10 servers for selection
        const topServers = onlineServers.slice(0, 10);
        
        // Get current server
        const currentHost = process.env.LAVALINK_HOST || client.config.lavalink?.host;
        const currentPort = process.env.LAVALINK_PORT || client.config.lavalink?.port;
        
        // Build embed
        const embed = new EmbedBuilder()
            .setColor(client.config.colors.primary)
            .setTitle(`${e.rocket} Lavalink Server Selector`)
            .setDescription(
                `${e.online} **Online:** ${onlineServers.length} | ${e.dnd} **Offline:** ${offlineCount}\n` +
                `${e.server} **Current:** \`${currentHost}:${currentPort}\`\n` +
                `${e.filters} **Filter:** ${filter.toUpperCase()}\n\n` +
                `**Top ${topServers.length} Servers:**`
            )
            .setFooter({ text: 'Select a server from the dropdown below' })
            .setTimestamp();
        
        // Add server fields
        topServers.forEach((server, index) => {
            const isCurrent = server.host === currentHost && String(server.port) === String(currentPort);
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
            
            const latencyColor = server.latency < 100 ? '🟢' : server.latency < 200 ? '🟡' : '🟠';
            
            let stats = `${latencyColor} **${server.latency}ms**`;
            if (server.players !== undefined) stats += ` | 👥 ${server.playingPlayers}/${server.players}`;
            if (server.memory) stats += ` | 💾 ${server.memory.used}MB`;
            if (server.uptime) stats += ` | ⏱️ ${formatUptime(server.uptime)}`;
            
            embed.addFields({
                name: `${medal} ${server.name}${isCurrent ? ' ⭐' : ''} ${server.region}`,
                value: `\`${server.host}:${server.port}\` (${server.version})\n${stats}`,
                inline: false
            });
        });
        
        // Create select menu
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('switch_lavalink_select')
            .setPlaceholder('🎵 Choose a server to switch to...')
            .addOptions(
                topServers.map((server, index) => ({
                    label: `${server.name} (${server.latency}ms)`,
                    description: `${server.host}:${server.port} | ${server.region} | ${server.version}`,
                    value: `${index}`,
                    emoji: index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🎵'
                }))
            );
        
        // Create buttons
        const refreshBtn = new ButtonBuilder()
            .setCustomId('switch_lavalink_refresh')
            .setLabel('Refresh')
            .setEmoji('🔄')
            .setStyle(ButtonStyle.Secondary);
        
        const cancelBtn = new ButtonBuilder()
            .setCustomId('switch_lavalink_cancel')
            .setLabel('Cancel')
            .setEmoji('❌')
            .setStyle(ButtonStyle.Danger);
        
        const row1 = new ActionRowBuilder().addComponents(selectMenu);
        const row2 = new ActionRowBuilder().addComponents(refreshBtn, cancelBtn);
        
        // Store server data
        if (!client.tempData) client.tempData = new Map();
        client.tempData.set(`switch_lavalink_${userId}`, {
            servers: topServers,
            filter: filter,
            timestamp: Date.now()
        });
        
        if (isSlash) {
            await interaction.editReply({ embeds: [embed], components: [row1, row2] });
        } else {
            await msg.edit({ embeds: [embed], components: [row1, row2] });
        }
    }
};
