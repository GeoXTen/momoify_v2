import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

// Platform and search type configurations
const searchConfigs = {
    youtube: {
        track: { name: 'YouTube', source: 'ytsearch', emoji: '▶️', color: 0xFF8C00 },
        playlist: { name: 'YouTube Playlist', source: 'ytsearch', emoji: '📜', color: 0xFF8C00 }
    },
    youtubemusic: {
        track: { name: 'YouTube Music', source: 'ytmsearch', emoji: '🎵', color: 0xFF8C00 }
    },
    soundcloud: {
        track: { name: 'SoundCloud', source: 'scsearch', emoji: '☁️', color: 0xFF8C00 }
    },
    spotify: {
        track: { name: 'Spotify Track', source: 'spsearch', emoji: '🟢', color: 0xFF8C00 },
        album: { name: 'Spotify Album', source: 'spsearch', emoji: '💿', color: 0xFF8C00 },
        playlist: { name: 'Spotify Playlist', source: 'spsearch', emoji: '📜', color: 0xFF8C00 },
        artist: { name: 'Spotify Artist', source: 'spsearch', emoji: '👤', color: 0xFF8C00 }
    },
    deezer: {
        track: { name: 'Deezer Track', source: 'dzsearch', emoji: '🎶', color: 0xFF8C00 },
        album: { name: 'Deezer Album', source: 'dzsearch', emoji: '💿', color: 0xFF8C00 },
        playlist: { name: 'Deezer Playlist', source: 'dzsearch', emoji: '📜', color: 0xFF8C00 }
    },
    applemusic: {
        track: { name: 'Apple Music', source: 'amsearch', emoji: '🍎', color: 0xFF8C00 }
    },
    bandcamp: {
        track: { name: 'Bandcamp', source: 'bcsearch', emoji: '🎸', color: 0xFF8C00 }
    },
    jiosaavn: {
        track: { name: 'JioSaavn', source: 'jssearch', emoji: '🎧', color: 0xFF8C00 }
    }
};

export default {
    data: new SlashCommandBuilder()
        .setName('search')
        .setDescription('Search for music on different platforms')
        .addSubcommand(subcommand =>
            subcommand
                .setName('youtube')
                .setDescription('Search on YouTube')
                .addStringOption(option =>
                    option
                        .setName('query')
                        .setDescription('Search query')
                        .setRequired(true))
                .addStringOption(option =>
                    option
                        .setName('type')
                        .setDescription('Type of content to search for')
                        .addChoices(
                            { name: 'Track/Video', value: 'track' },
                            { name: 'Playlist', value: 'playlist' }
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('youtubemusic')
                .setDescription('Search on YouTube Music')
                .addStringOption(option =>
                    option
                        .setName('query')
                        .setDescription('Search query')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('soundcloud')
                .setDescription('Search on SoundCloud')
                .addStringOption(option =>
                    option
                        .setName('query')
                        .setDescription('Search query')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('spotify')
                .setDescription('Search on Spotify')
                .addStringOption(option =>
                    option
                        .setName('query')
                        .setDescription('Search query')
                        .setRequired(true))
                .addStringOption(option =>
                    option
                        .setName('type')
                        .setDescription('Type of content to search for')
                        .addChoices(
                            { name: 'Track', value: 'track' },
                            { name: 'Album', value: 'album' },
                            { name: 'Playlist', value: 'playlist' },
                            { name: 'Artist', value: 'artist' }
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('deezer')
                .setDescription('Search on Deezer')
                .addStringOption(option =>
                    option
                        .setName('query')
                        .setDescription('Search query')
                        .setRequired(true))
                .addStringOption(option =>
                    option
                        .setName('type')
                        .setDescription('Type of content to search for')
                        .addChoices(
                            { name: 'Track', value: 'track' },
                            { name: 'Album', value: 'album' },
                            { name: 'Playlist', value: 'playlist' }
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('applemusic')
                .setDescription('Search on Apple Music')
                .addStringOption(option =>
                    option
                        .setName('query')
                        .setDescription('Search query')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('bandcamp')
                .setDescription('Search on Bandcamp')
                .addStringOption(option =>
                    option
                        .setName('query')
                        .setDescription('Search query')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('jiosaavn')
                .setDescription('Search on JioSaavn (Indian music)')
                .addStringOption(option =>
                    option
                        .setName('query')
                        .setDescription('Search query')
                        .setRequired(true))),
    
    async execute(interaction, client) {
        const subcommand = interaction.options.getSubcommand();
        const query = interaction.options.getString('query');
        const type = interaction.options.getString('type') || 'track';
        
        await handleSearch(interaction, client, subcommand, query, type);
    }
};

async function handleSearch(interaction, client, platform, query, type = 'track') {
    // Check if user is in voice channel
    const member = interaction.guild.members.cache.get(interaction.user.id);
    const voiceChannel = member?.voice?.channel;
    
    if (!voiceChannel) {
        const embed = new EmbedBuilder()
            .setColor(client.config.colors.error)
            .setTitle('❌ Not in Voice Channel')
            .setDescription('You need to be in a voice channel to search and play music!')
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed], flags: 64 });
        return;
    }
    
    await interaction.deferReply();
    
    // Get platform config based on platform and type
    const platformConfig = searchConfigs[platform]?.[type];
    
    if (!platformConfig) {
        const embed = new EmbedBuilder()
            .setColor(client.config.colors.error)
            .setTitle('❌ Invalid Search Configuration')
            .setDescription(`Search type **${type}** is not available for **${platform}**.`)
            .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
        return;
    }
    
    try {
        // Get lavalink node
        const node = client.lavalink.nodeManager.leastUsedNodes()[0];
        
        if (!node) {
            const embed = new EmbedBuilder()
                .setColor(client.config.colors.error)
                .setTitle('❌ Service Unavailable')
                .setDescription('Music service is currently unavailable. Please try again later.')
                .setTimestamp();
            
            await interaction.editReply({ embeds: [embed] });
            return;
        }
        
        // Search for tracks with smart fallback
        let result = await node.search({
            query: query,
            source: platformConfig.source
        }, interaction.user);
        
        let usedFallback = false;
        let fallbackSource = null;
        
        // If no results or plugin not available, try YouTube fallback for non-YouTube platforms
        if ((!result?.tracks?.length || result.loadType === 'error') && platform !== 'youtube' && platform !== 'youtubemusic') {
            console.log(`⚠️  ${platformConfig.name} search failed, falling back to YouTube...`.yellow);
            
            try {
                result = await node.search({
                    query: query,
                    source: 'ytsearch'
                }, interaction.user);
                
                if (result?.tracks?.length) {
                    usedFallback = true;
                    fallbackSource = 'YouTube';
                    console.log(`✓ Successfully found results on YouTube fallback`.green);
                }
            } catch (fallbackError) {
                console.log(`✗ YouTube fallback also failed: ${fallbackError.message}`.red);
            }
        }
        
        if (!result?.tracks?.length) {
            const embed = new EmbedBuilder()
                .setColor(client.config.colors.warning)
                .setTitle(`${platformConfig.emoji} No Results Found`)
                .setDescription(`No results found for **${query}** on ${platformConfig.name}${usedFallback ? ' or YouTube' : ''}`)
                .addFields({
                    name: '💡 Tips',
                    value: '• Try different search terms\n' +
                           '• Check spelling\n' +
                           '• Try searching on a different platform\n' +
                           '• Use `/play` for general search'
                })
                .setTimestamp();
            
            await interaction.editReply({ embeds: [embed] });
            return;
        }
        
        // Limit to top 5 results
        const tracks = result.tracks.slice(0, 5);
        
        // Format duration
        const formatDuration = (ms) => {
            const seconds = Math.floor(ms / 1000);
            const hours = Math.floor(seconds / 3600);
            const mins = Math.floor((seconds % 3600) / 60);
            const secs = seconds % 60;
            
            if (hours > 0) {
                return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            }
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        };
        
        // Create embed with results
        const embed = new EmbedBuilder()
            .setColor(platformConfig.color)
            .setTitle(`${platformConfig.emoji} Search Results - ${usedFallback ? fallbackSource : platformConfig.name}`)
            .setDescription(`Found **${result.tracks.length}** results for **${query}**\n\nSelect a track to play:`)
            .setTimestamp();
        
        // Add fallback warning if used
        if (usedFallback) {
            embed.addFields({
                name: '⚠️ Fallback Used',
                value: `${platformConfig.name} plugin is not available or returned no results. Using ${fallbackSource} instead.`,
                inline: false
            });
        }
        
        // Add track fields
        tracks.forEach((track, index) => {
            const duration = track.info.isStream ? '🔴 LIVE' : formatDuration(track.info.duration);
            embed.addFields({
                name: `${index + 1}. ${track.info.title}`,
                value: `👤 ${track.info.author} • ⏱️ ${duration}`,
                inline: false
            });
        });
        
        // Create buttons for selection
        const row1 = new ActionRowBuilder();
        const row2 = new ActionRowBuilder();
        
        for (let i = 0; i < Math.min(tracks.length, 5); i++) {
            const button = new ButtonBuilder()
                .setCustomId(`search_select_${i}_${interaction.user.id}`)
                .setLabel(`${i + 1}`)
                .setStyle(ButtonStyle.Primary);
            
            if (i < 3) {
                row1.addComponents(button);
            } else {
                row2.addComponents(button);
            }
        }
        
        // Add cancel button
        const cancelButton = new ButtonBuilder()
            .setCustomId(`search_cancel_${interaction.user.id}`)
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Danger);
        
        row2.addComponents(cancelButton);
        
        const components = [row1];
        if (tracks.length > 3) {
            components.push(row2);
        } else {
            row1.addComponents(cancelButton);
        }
        
        // Store tracks in a temporary cache (we'll handle this in button handler)
        if (!client.searchCache) {
            client.searchCache = new Map();
        }
        
        const cacheKey = `${interaction.user.id}_${interaction.id}`;
        client.searchCache.set(cacheKey, {
            tracks: tracks,
            voiceChannelId: voiceChannel.id,
            textChannelId: interaction.channelId,
            platform: platformConfig.name,
            timestamp: Date.now()
        });
        
        // Clean up old cache entries (older than 5 minutes)
        for (const [key, value] of client.searchCache.entries()) {
            if (Date.now() - value.timestamp > 300000) {
                client.searchCache.delete(key);
            }
        }
        
        await interaction.editReply({ embeds: [embed], components });
        
    } catch (error) {
        console.error('Error searching:'.red, error);
        
        const embed = new EmbedBuilder()
            .setColor(client.config.colors.error)
            .setTitle('❌ Search Error')
            .setDescription('An error occurred while searching. Please try again.')
            .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
    }
}
