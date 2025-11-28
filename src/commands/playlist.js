import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { 
    createPlaylist, 
    deletePlaylist, 
    addTrackToPlaylist, 
    removeTrackFromPlaylist, 
    getPlaylist, 
    getAllPlaylists 
} from '../utils/playlistManager.js';

export default {
    data: new SlashCommandBuilder()
        .setName('playlist')
        .setDescription('Manage and play saved playlists')
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Create a new playlist')
                .addStringOption(option =>
                    option
                        .setName('name')
                        .setDescription('Playlist name')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all saved playlists'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('play')
                .setDescription('Play a saved playlist')
                .addStringOption(option =>
                    option
                        .setName('name')
                        .setDescription('Playlist name to play')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Delete a playlist (Admin only)')
                .addStringOption(option =>
                    option
                        .setName('name')
                        .setDescription('Playlist name to delete')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add a track to a playlist')
                .addStringOption(option =>
                    option
                        .setName('name')
                        .setDescription('Playlist name')
                        .setRequired(true))
                .addStringOption(option =>
                    option
                        .setName('track')
                        .setDescription('Track name or URL (leave empty to add currently playing track)')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove a track from playlist (Admin only)')
                .addStringOption(option =>
                    option
                        .setName('name')
                        .setDescription('Playlist name')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option
                        .setName('position')
                        .setDescription('Track position to remove')
                        .setRequired(true)
                        .setMinValue(1)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('show')
                .setDescription('Show playlist contents')
                .addStringOption(option =>
                    option
                        .setName('name')
                        .setDescription('Playlist name')
                        .setRequired(true))),
    
    async execute(interaction, client) {
        const subcommand = interaction.options.getSubcommand();
        
        if (subcommand === 'create') {
            await handleCreate(interaction, client);
        } else if (subcommand === 'list') {
            await handleList(interaction, client);
        } else if (subcommand === 'play') {
            await handlePlay(interaction, client);
        } else if (subcommand === 'delete') {
            await handleDelete(interaction, client);
        } else if (subcommand === 'add') {
            await handleAdd(interaction, client);
        } else if (subcommand === 'remove') {
            await handleRemove(interaction, client);
        } else if (subcommand === 'show') {
            await handleShow(interaction, client);
        }
    }
};

async function handleCreate(interaction, client) {
    const name = interaction.options.getString('name');
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    
    const result = createPlaylist(guildId, name, userId);
    
    if (result.success) {
        const embed = new EmbedBuilder()
            .setColor(client.config.colors.success)
            .setTitle('✅ Playlist Created')
            .setDescription(`Successfully created playlist **${name}**`)
            .addFields(
                { name: 'Playlist Name', value: name, inline: true },
                { name: 'Tracks', value: '0', inline: true },
                { name: 'Creator', value: `<@${userId}>`, inline: true }
            )
            .addFields({
                name: '💡 Next Steps',
                value: `• Add tracks: \`/playlist add name:${name} track:song name\`\n` +
                       `• Or add current: \`/playlist add name:${name}\` (while music plays)\n` +
                       '• View contents: `/playlist show`\n' +
                       '• Play playlist: `/playlist play`'
            })
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
    } else {
        const embed = new EmbedBuilder()
            .setColor(client.config.colors.error)
            .setTitle('❌ Failed to Create Playlist')
            .setDescription(result.message)
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed], flags: 64 });
    }
}

async function handleList(interaction, client) {
    const guildId = interaction.guildId;
    const playlists = getAllPlaylists(guildId);
    
    if (playlists.length === 0) {
        const embed = new EmbedBuilder()
            .setColor(client.config.colors.warning)
            .setTitle('📜 Saved Playlists')
            .setDescription('No playlists found. Create one with `/playlist create` or `-playlist create`')
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
        return;
    }
    
    // Sort by creation date
    playlists.sort((a, b) => b.createdAt - a.createdAt);
    
    const embed = new EmbedBuilder()
        .setColor(client.config.colors.primary)
        .setTitle('📜 Saved Playlists')
        .setDescription(`Found **${playlists.length}** playlist${playlists.length === 1 ? '' : 's'}`)
        .setTimestamp();
    
    const playlistList = playlists.map((pl, index) => {
        const trackCount = pl.tracks.length;
        const creator = `<@${pl.creatorId}>`;
        return `**${index + 1}. ${pl.name}**\n` +
               `└ Tracks: ${trackCount} • Creator: ${creator}`;
    }).join('\n\n');
    
    // Split into chunks if too long
    if (playlistList.length > 4000) {
        const chunks = [];
        let currentChunk = '';
        
        for (const pl of playlists) {
            const trackCount = pl.tracks.length;
            const line = `**${pl.name}** (${trackCount} tracks)\n`;
            
            if ((currentChunk + line).length > 4000) {
                chunks.push(currentChunk);
                currentChunk = line;
            } else {
                currentChunk += line;
            }
        }
        if (currentChunk) chunks.push(currentChunk);
        
        embed.addFields({ name: 'Playlists', value: chunks[0], inline: false });
    } else {
        embed.addFields({ name: 'Playlists', value: playlistList, inline: false });
    }
    
    embed.addFields({
        name: '💡 Quick Actions',
        value: '• `/playlist play <name>` - Play a playlist\n' +
               '• `/playlist show <name>` - View playlist tracks\n' +
               '• `/playlist create <name>` - Create new playlist'
    });
    
    await interaction.reply({ embeds: [embed] });
}

async function handlePlay(interaction, client) {
    const name = interaction.options.getString('name');
    const guildId = interaction.guildId;
    const member = interaction.member;
    
    // Check if user is in voice channel
    if (!member.voice.channel) {
        const embed = new EmbedBuilder()
            .setColor(client.config.colors.error)
            .setTitle('❌ Not in Voice Channel')
            .setDescription('You need to be in a voice channel to play a playlist!')
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed], flags: 64 });
        return;
    }
    
    const playlist = getPlaylist(guildId, name);
    
    if (!playlist) {
        const embed = new EmbedBuilder()
            .setColor(client.config.colors.error)
            .setTitle('❌ Playlist Not Found')
            .setDescription(`Playlist **${name}** doesn't exist.\n\nUse \`/playlist list\` to see all available playlists.`)
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed], flags: 64 });
        return;
    }
    
    if (playlist.tracks.length === 0) {
        const embed = new EmbedBuilder()
            .setColor(client.config.colors.warning)
            .setTitle('⚠️ Empty Playlist')
            .setDescription(`Playlist **${playlist.name}** has no tracks.\n\nAdd tracks using \`/playlist add\` while music is playing.`)
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed], flags: 64 });
        return;
    }
    
    await interaction.deferReply();
    
    try {
        // Get or create player
        let player = client.lavalink.getPlayer(guildId);
        
        if (!player) {
            player = client.lavalink.createPlayer({
                guildId: guildId,
                voiceChannelId: member.voice.channel.id,
                textChannelId: interaction.channel.id,
                selfDeaf: true,
                selfMute: false,
                volume: 100
            });
            
            await player.connect();
        }
        
        // Add tracks to queue
        let addedCount = 0;
        for (const track of playlist.tracks) {
            try {
                const result = await player.search({ query: track.url }, interaction.user);
                if (result.tracks.length > 0) {
                    player.queue.add(result.tracks[0]);
                    addedCount++;
                }
            } catch (error) {
                console.error(`Failed to load track: ${track.title}`.red, error);
            }
        }
        
        // Start playing if not already
        if (!player.playing && !player.paused) {
            // Store the text channel for trackStart event to use
            player.set('currentTextChannel', interaction.channel);
            await player.play();
        }
        
        const embed = new EmbedBuilder()
            .setColor(client.config.colors.success)
            .setTitle('✅ Playlist Loaded')
            .setDescription(`Successfully loaded playlist **${playlist.name}**`)
            .addFields(
                { name: 'Tracks Added', value: `${addedCount}/${playlist.tracks.length}`, inline: true },
                { name: 'Queue Position', value: `${player.queue.tracks.length} tracks`, inline: true },
                { name: 'Voice Channel', value: member.voice.channel.name, inline: true }
            )
            .setFooter({ text: `Playlist by ${client.users.cache.get(playlist.creatorId)?.tag || 'Unknown'}` })
            .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Error playing playlist:'.red, error);
        
        const embed = new EmbedBuilder()
            .setColor(client.config.colors.error)
            .setTitle('❌ Error Playing Playlist')
            .setDescription('Failed to load playlist. Please try again.')
            .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
    }
}

async function handleDelete(interaction, client) {
    // Check admin permission
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        const embed = new EmbedBuilder()
            .setColor(client.config.colors.error)
            .setTitle('❌ Permission Denied')
            .setDescription('You need Administrator permission to delete playlists.')
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed], flags: 64 });
        return;
    }
    
    const name = interaction.options.getString('name');
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    
    const result = deletePlaylist(guildId, name, userId);
    
    if (result.success) {
        const embed = new EmbedBuilder()
            .setColor(client.config.colors.success)
            .setTitle('✅ Playlist Deleted')
            .setDescription(`Successfully deleted playlist **${name}**`)
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
    } else {
        const embed = new EmbedBuilder()
            .setColor(client.config.colors.error)
            .setTitle('❌ Failed to Delete Playlist')
            .setDescription(result.message)
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed], flags: 64 });
    }
}

async function handleAdd(interaction, client) {
    const name = interaction.options.getString('name');
    const trackQuery = interaction.options.getString('track');
    const guildId = interaction.guildId;
    
    let track;
    let trackTitle;
    
    // If track query is provided, search for it
    if (trackQuery) {
        await interaction.deferReply();
        
        try {
            // Get lavalink node to search
            const node = client.lavalink.nodeManager.leastUsedNodes()[0];
            
            if (!node) {
                const embed = new EmbedBuilder()
                    .setColor(client.config.colors.error)
                    .setTitle('❌ Service Unavailable')
                    .setDescription('Music service is currently unavailable.')
                    .setTimestamp();
                
                await interaction.editReply({ embeds: [embed] });
                return;
            }
            
            // Search for the track
            const result = await node.search({ query: trackQuery }, interaction.user);
            
            if (!result?.tracks || result.tracks.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor(client.config.colors.error)
                    .setTitle('❌ No Results')
                    .setDescription(`No results found for **${trackQuery}**`)
                    .setTimestamp();
                
                await interaction.editReply({ embeds: [embed] });
                return;
            }
            
            // Use the first result
            const foundTrack = result.tracks[0];
            track = {
                title: foundTrack.info.title,
                url: foundTrack.info.uri,
                duration: foundTrack.info.duration
            };
            trackTitle = foundTrack.info.title;
            
        } catch (error) {
            console.error('Error searching for track:', error);
            
            const embed = new EmbedBuilder()
                .setColor(client.config.colors.error)
                .setTitle('❌ Search Error')
                .setDescription('Failed to search for track. Please try again.')
                .setTimestamp();
            
            await interaction.editReply({ embeds: [embed] });
            return;
        }
    } else {
        // No track query provided, use currently playing track
        const player = client.lavalink.getPlayer(guildId);
        
        if (!player || !player.queue.current) {
            const embed = new EmbedBuilder()
                .setColor(client.config.colors.error)
                .setTitle('❌ No Track Playing')
                .setDescription('There must be a track currently playing, or provide a track name/URL.\n\n' +
                               '**Examples:**\n' +
                               '• `/playlist add name:MyPlaylist track:Despacito`\n' +
                               '• `/playlist add name:MyPlaylist track:https://youtube.com/...`')
                .setTimestamp();
            
            await interaction.reply({ embeds: [embed], flags: 64 });
            return;
        }
        
        const currentTrack = player.queue.current;
        track = {
            title: currentTrack.info.title,
            url: currentTrack.info.uri,
            duration: currentTrack.info.duration
        };
        trackTitle = currentTrack.info.title;
    }
    
    // Add track to playlist
    const result = addTrackToPlaylist(guildId, name, track);
    
    if (result.success) {
        const embed = new EmbedBuilder()
            .setColor(client.config.colors.success)
            .setTitle('✅ Track Added to Playlist')
            .setDescription(`Added **${trackTitle}** to playlist **${name}**`)
            .addFields(
                { name: 'Track', value: trackTitle, inline: false },
                { name: 'Playlist', value: name, inline: true },
                { name: 'Total Tracks', value: result.trackCount.toString(), inline: true }
            )
            .setTimestamp();
        
        if (trackQuery) {
            await interaction.editReply({ embeds: [embed] });
        } else {
            await interaction.reply({ embeds: [embed] });
        }
    } else {
        const embed = new EmbedBuilder()
            .setColor(client.config.colors.error)
            .setTitle('❌ Failed to Add Track')
            .setDescription(result.message)
            .setTimestamp();
        
        if (trackQuery) {
            await interaction.editReply({ embeds: [embed] });
        } else {
            await interaction.reply({ embeds: [embed], flags: 64 });
        }
    }
}

async function handleRemove(interaction, client) {
    // Check admin permission
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        const embed = new EmbedBuilder()
            .setColor(client.config.colors.error)
            .setTitle('❌ Permission Denied')
            .setDescription('You need Administrator permission to remove tracks from playlists.')
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed], flags: 64 });
        return;
    }
    
    const name = interaction.options.getString('name');
    const position = interaction.options.getInteger('position');
    const guildId = interaction.guildId;
    
    const result = removeTrackFromPlaylist(guildId, name, position);
    
    if (result.success) {
        const embed = new EmbedBuilder()
            .setColor(client.config.colors.success)
            .setTitle('✅ Track Removed')
            .setDescription(`Removed **${result.removedTrack}** from playlist **${name}**`)
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
    } else {
        const embed = new EmbedBuilder()
            .setColor(client.config.colors.error)
            .setTitle('❌ Failed to Remove Track')
            .setDescription(result.message)
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed], flags: 64 });
    }
}

async function handleShow(interaction, client) {
    const name = interaction.options.getString('name');
    const guildId = interaction.guildId;
    
    const playlist = getPlaylist(guildId, name);
    
    if (!playlist) {
        const embed = new EmbedBuilder()
            .setColor(client.config.colors.error)
            .setTitle('❌ Playlist Not Found')
            .setDescription(`Playlist **${name}** doesn't exist.\n\nUse \`/playlist list\` to see all available playlists.`)
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed], flags: 64 });
        return;
    }
    
    const embed = new EmbedBuilder()
        .setColor(client.config.colors.primary)
        .setTitle(`📜 ${playlist.name}`)
        .setDescription(playlist.tracks.length === 0 ? 'This playlist is empty.' : `**${playlist.tracks.length}** track${playlist.tracks.length === 1 ? '' : 's'}`)
        .addFields(
            { name: 'Creator', value: `<@${playlist.creatorId}>`, inline: true },
            { name: 'Tracks', value: playlist.tracks.length.toString(), inline: true },
            { name: 'Created', value: `<t:${Math.floor(playlist.createdAt / 1000)}:R>`, inline: true }
        )
        .setTimestamp();
    
    if (playlist.tracks.length > 0) {
        const formatDuration = (ms) => {
            const seconds = Math.floor(ms / 1000);
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        };
        
        // Show up to 10 tracks
        const trackList = playlist.tracks.slice(0, 10).map((track, index) => {
            return `**${index + 1}.** ${track.title} \`[${formatDuration(track.duration)}]\``;
        }).join('\n');
        
        embed.addFields({ 
            name: 'Tracks', 
            value: trackList + (playlist.tracks.length > 10 ? `\n\n*...and ${playlist.tracks.length - 10} more*` : ''),
            inline: false 
        });
        
        embed.addFields({
            name: '💡 Actions',
            value: `• \`/playlist play ${name}\` - Play this playlist\n` +
                   `• \`/playlist add name:${name} track:song\` - Add a track\n` +
                   `• \`/playlist remove ${name} <position>\` - Remove a track`
        });
    }
    
    await interaction.reply({ embeds: [embed] });
}
