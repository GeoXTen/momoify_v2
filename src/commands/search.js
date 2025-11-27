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
        
        // Store all tracks for pagination (up to 50 results)
        const allTracks = result.tracks.slice(0, 50);
        const pageSize = 10;
        const currentPage = 0;
        
        // Get tracks for current page
        const tracks = allTracks.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
        const totalPages = Math.ceil(allTracks.length / pageSize);
        
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
            .setDescription(`Found **${allTracks.length}** results for **${query}**\n\nSelect a track to play:\n\n📄 Page ${currentPage + 1} of ${totalPages}`)
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
            const trackNumber = currentPage * pageSize + index + 1;
            embed.addFields({
                name: `${trackNumber}. ${track.info.title}`,
                value: `👤 ${track.info.author} • ⏱️ ${duration}`,
                inline: false
            });
        });
        
        // Create buttons for selection (up to 10 tracks)
        const row1 = new ActionRowBuilder();
        const row2 = new ActionRowBuilder();
        const row3 = new ActionRowBuilder();
        
        for (let i = 0; i < Math.min(tracks.length, 10); i++) {
            const trackNumber = currentPage * pageSize + i + 1;
            const button = new ButtonBuilder()
                .setCustomId(`search_select_${i}_${currentPage}_${interaction.user.id}`)
                .setLabel(`${trackNumber}`)
                .setStyle(ButtonStyle.Primary);
            
            // Distribute buttons: 5 per row
            if (i < 5) {
                row1.addComponents(button);
            } else {
                row2.addComponents(button);
            }
        }
        
        // Navigation buttons on third row
        const prevButton = new ButtonBuilder()
            .setCustomId(`search_prev_${currentPage}_${interaction.user.id}`)
            .setLabel('◀ Previous')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === 0);
        
        const pageButton = new ButtonBuilder()
            .setCustomId(`search_page_info_${interaction.user.id}`)
            .setLabel(`Page ${currentPage + 1}/${totalPages}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true);
        
        const nextButton = new ButtonBuilder()
            .setCustomId(`search_next_${currentPage}_${interaction.user.id}`)
            .setLabel('Next ▶')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage >= totalPages - 1);
        
        const cancelButton = new ButtonBuilder()
            .setCustomId(`search_cancel_${interaction.user.id}`)
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Danger);
        
        row3.addComponents(prevButton, pageButton, nextButton, cancelButton);
        
        // Add rows based on number of tracks
        const components = [row1];
        if (tracks.length > 5) {
            components.push(row2);
        }
        components.push(row3);
        
        // Store tracks in a temporary cache (we'll handle this in button handler)
        if (!client.searchCache) {
            client.searchCache = new Map();
        }
        
        const cacheKey = `${interaction.user.id}_${interaction.id}`;
        client.searchCache.set(cacheKey, {
            allTracks: allTracks,
            tracks: tracks,
            voiceChannelId: voiceChannel.id,
            textChannelId: interaction.channelId,
            platform: platformConfig.name,
            platformConfig: platformConfig,
            query: query,
            currentPage: currentPage,
            pageSize: pageSize,
            totalPages: totalPages,
            usedFallback: usedFallback,
            fallbackSource: fallbackSource,
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
