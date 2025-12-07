import { EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

// Store pagination state
const paginationState = new Map();

export default {
    name: 'shards',
    aliases: ['servers', 'guilds'],
    description: 'Show server list with details (Owner only)',
    usage: '[search|playing|connected|export] [query]',
    ownerOnly: true,
    
    async execute(message, args, client) {
        const e = client.config.emojis;
        const players = client.lavalink.players;
        const subCommand = args[0]?.toLowerCase();
        const query = args.slice(1).join(' ').toLowerCase();
        
        // Get all guilds with detailed info
        let guilds = [...client.guilds.cache.values()].map(g => {
            const hasPlayer = players.has(g.id);
            const player = hasPlayer ? players.get(g.id) : null;
            const isPlaying = player?.playing || false;
            const currentTrack = player?.queue?.current?.info?.title || null;
            
            return {
                guild: g,
                id: g.id,
                name: g.name,
                members: g.memberCount,
                boostLevel: g.premiumTier,
                boostCount: g.premiumSubscriptionCount || 0,
                hasPlayer,
                isPlaying,
                currentTrack,
                joinedAt: g.joinedTimestamp,
                ownerId: g.ownerId
            };
        });
        
        // Filter based on subcommand
        let filterLabel = '';
        if (subCommand === 'playing') {
            guilds = guilds.filter(g => g.isPlaying);
            filterLabel = ' (Playing)';
        } else if (subCommand === 'connected') {
            guilds = guilds.filter(g => g.hasPlayer);
            filterLabel = ' (Connected)';
        } else if (subCommand === 'search' && query) {
            guilds = guilds.filter(g => 
                g.name.toLowerCase().includes(query) || 
                g.id.includes(query)
            );
            filterLabel = ` (Search: "${query}")`;
        } else if (subCommand === 'export') {
            return await exportFullList(message, client, guilds, e);
        }
        
        // Sort by member count
        guilds.sort((a, b) => b.members - a.members);
        
        const totalServers = client.guilds.cache.size;
        const totalMembers = client.guilds.cache.reduce((a, g) => a + g.memberCount, 0);
        const activePlayers = [...players.values()].filter(p => p.playing).length;
        const connectedPlayers = players.size;
        
        if (guilds.length === 0) {
            const embed = new EmbedBuilder()
                .setColor(client.config.colors.warning)
                .setTitle(`${e.warning || '⚠️'} No Servers Found`)
                .setDescription(`No servers match your filter${filterLabel}.`)
                .setTimestamp();
            return message.reply({ embeds: [embed] });
        }
        
        const perPage = 10;
        const maxPages = Math.ceil(guilds.length / perPage);
        const stateId = `shards_${message.author.id}_${Date.now()}`;
        
        paginationState.set(stateId, { guilds, page: 1, perPage, filterLabel });
        
        // Auto-cleanup after 5 minutes
        setTimeout(() => paginationState.delete(stateId), 300000);
        
        const { embed, row } = buildPage(client, stateId, totalServers, totalMembers, activePlayers, connectedPlayers);
        
        const replyMsg = await message.reply({ embeds: [embed], components: [row] });
        
        // Button collector
        const collector = replyMsg.createMessageComponentCollector({ 
            filter: i => i.user.id === message.author.id && i.customId.startsWith('shards_'),
            time: 300000 
        });
        
        collector.on('collect', async interaction => {
            const state = paginationState.get(stateId);
            if (!state) return interaction.reply({ content: 'Session expired.', ephemeral: true });
            
            const action = interaction.customId.split('_')[1];
            
            if (action === 'first') state.page = 1;
            else if (action === 'prev') state.page = Math.max(1, state.page - 1);
            else if (action === 'next') state.page = Math.min(Math.ceil(state.guilds.length / state.perPage), state.page + 1);
            else if (action === 'last') state.page = Math.ceil(state.guilds.length / state.perPage);
            else if (action === 'export') {
                await interaction.deferUpdate();
                return await exportFullList(message, client, state.guilds, e, interaction);
            }
            
            const { embed, row } = buildPage(client, stateId, totalServers, totalMembers, activePlayers, connectedPlayers);
            await interaction.update({ embeds: [embed], components: [row] });
        });
        
        collector.on('end', async () => {
            paginationState.delete(stateId);
            try {
                const disabledRow = new ActionRowBuilder().addComponents(
                    ...replyMsg.components[0].components.map(c => 
                        ButtonBuilder.from(c).setDisabled(true)
                    )
                );
                await replyMsg.edit({ components: [disabledRow] });
            } catch {}
        });
    }
};

function buildPage(client, stateId, totalServers, totalMembers, activePlayers, connectedPlayers) {
    const state = paginationState.get(stateId);
    const { guilds, page, perPage, filterLabel } = state;
    const e = client.config.emojis;
    
    const maxPages = Math.ceil(guilds.length / perPage);
    const start = (page - 1) * perPage;
    const pageGuilds = guilds.slice(start, start + perPage);
    
    const boostEmojis = ['', e.boost1 || '🥉', e.boost2 || '🥈', e.boost3 || '🥇'];
    
    const listText = pageGuilds.map((g, i) => {
        const idx = start + i + 1;
        let status = e.offline || '⚫';
        if (g.isPlaying) status = e.online || '🟢';
        else if (g.hasPlayer) status = e.idle || '🟡';
        
        const boost = g.boostLevel > 0 ? ` ${boostEmojis[g.boostLevel] || '✨'}` : '';
        const playing = g.currentTrack ? `\n│  ${e.melody || '🎵'} ${g.currentTrack.substring(0, 40)}${g.currentTrack.length > 40 ? '...' : ''}` : '';
        
        return `${status} **${idx}.** ${g.name}${boost}\n` +
               `│  \`${g.id}\`\n` +
               `│  ${e.headphone || '👥'} ${g.members.toLocaleString()} members` +
               `${g.boostCount > 0 ? ` • ${e.nitro || '💎'} ${g.boostCount} boosts` : ''}` +
               playing +
               `\n└─ Joined: <t:${Math.floor(g.joinedAt / 1000)}:R>`;
    }).join('\n\n');
    
    const embed = new EmbedBuilder()
        .setColor(client.config.colors.primary)
        .setTitle(`${e.server || '🖥️'} Server List${filterLabel}`)
        .setDescription(
            `**Overview**\n` +
            `${e.verified || '✅'} Servers: **${totalServers}** • ` +
            `${e.headphone || '👥'} Members: **${totalMembers.toLocaleString()}**\n` +
            `${e.online || '🟢'} Playing: **${activePlayers}** • ` +
            `${e.idle || '🟡'} Connected: **${connectedPlayers}**\n` +
            `${e.search || '🔍'} Showing: **${guilds.length}** servers\n\n` +
            `${'─'.repeat(30)}\n\n` +
            listText
        )
        .setFooter({ 
            text: `Page ${page}/${maxPages} • Use -shards search <query> | playing | connected | export` 
        })
        .setTimestamp();
    
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('shards_first')
            .setEmoji('⏮️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === 1),
        new ButtonBuilder()
            .setCustomId('shards_prev')
            .setEmoji(e.previous || '◀️')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page === 1),
        new ButtonBuilder()
            .setCustomId('shards_next')
            .setEmoji(e.skip || '▶️')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page === maxPages),
        new ButtonBuilder()
            .setCustomId('shards_last')
            .setEmoji('⏭️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === maxPages),
        new ButtonBuilder()
            .setCustomId('shards_export')
            .setEmoji('📄')
            .setLabel('Export')
            .setStyle(ButtonStyle.Success)
    );
    
    return { embed, row };
}

async function exportFullList(message, client, guilds, e, interaction = null) {
    const players = client.lavalink.players;
    const totalServers = client.guilds.cache.size;
    const totalMembers = client.guilds.cache.reduce((a, g) => a + g.memberCount, 0);
    
    const header = [
        `╔${'═'.repeat(78)}╗`,
        `║  SERVER LIST EXPORT - ${client.config.botName}`,
        `║  Generated: ${new Date().toISOString()}`,
        `╠${'═'.repeat(78)}╣`,
        `║  Total Servers: ${totalServers}`,
        `║  Total Members: ${totalMembers.toLocaleString()}`,
        `║  Active Players: ${[...players.values()].filter(p => p.playing).length}`,
        `║  Connected Players: ${players.size}`,
        `╠${'═'.repeat(78)}╣`,
        `║  Status Legend:`,
        `║  [PLAYING]   = Currently playing music`,
        `║  [CONNECTED] = Player exists but paused/idle`,
        `║  [IDLE]      = No music player`,
        `╚${'═'.repeat(78)}╝`,
        '',
        ''
    ].join('\n');
    
    const serverLines = guilds.map((g, i) => {
        let status = '[IDLE]     ';
        if (g.isPlaying) status = '[PLAYING]  ';
        else if (g.hasPlayer) status = '[CONNECTED]';
        
        const boostStr = g.boostLevel > 0 ? ` [Boost Lvl ${g.boostLevel}]` : '';
        const trackStr = g.currentTrack ? `\n     └─ Now Playing: ${g.currentTrack}` : '';
        const joinDate = new Date(g.joinedAt).toLocaleDateString();
        
        return [
            `${String(i + 1).padStart(3)}. ${status} ${g.name}${boostStr}`,
            `     ├─ ID: ${g.id}`,
            `     ├─ Members: ${g.members.toLocaleString()}${g.boostCount > 0 ? ` | Boosts: ${g.boostCount}` : ''}`,
            `     ├─ Owner ID: ${g.ownerId}`,
            `     └─ Joined: ${joinDate}${trackStr}`,
            ''
        ].join('\n');
    }).join('\n');
    
    const footer = [
        '',
        `${'─'.repeat(80)}`,
        `End of Report - ${guilds.length} servers listed`,
        `${'─'.repeat(80)}`
    ].join('\n');
    
    const fileContent = header + serverLines + footer;
    const attachment = new AttachmentBuilder(Buffer.from(fileContent, 'utf-8'), { 
        name: `servers_export_${Date.now()}.txt` 
    });
    
    const embed = new EmbedBuilder()
        .setColor(client.config.colors.success)
        .setTitle(`${e.checkmark || '✅'} Export Complete`)
        .setDescription(`Exported **${guilds.length}** servers to text file.`)
        .setTimestamp();
    
    if (interaction) {
        await message.channel.send({ embeds: [embed], files: [attachment] });
    } else {
        await message.reply({ embeds: [embed], files: [attachment] });
    }
}
