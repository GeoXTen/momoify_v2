import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { createNowPlayingEmbed, createNowPlayingButtons } from '../utils/nowPlayingUtils.js';

export default {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Play a song or playlist')
        .addStringOption(option =>
            option.setName('song')
                .setDescription('Song name, URL, or playlist URL')
                .setRequired(true)
                .setAutocomplete(true)
        ),
    
    async execute(interaction, client) {
        try {
            await interaction.deferReply();
        } catch (error) {
            // If deferReply fails, the interaction is likely expired
            console.error('Failed to defer reply:', error.message);
            return;
        }
        
        const query = interaction.options.getString('song');
        
        if (!query || !query.trim()) {
            return interaction.editReply({
                embeds: [{
                    color: client.config.colors.error,
                    description: `${client.config.emojis.error} Please provide a song name or URL!`
                }]
            });
        }
        
        const member = interaction.guild.members.cache.get(interaction.user.id);
        const voiceChannel = member?.voice?.channel;
        
        if (!voiceChannel) {
            return interaction.editReply({
                embeds: [{
                    color: client.config.colors.error,
                    description: `${client.config.emojis.error} You need to be in a voice channel!`
                }]
            });
        }
        
        const permissions = voiceChannel.permissionsFor(interaction.guild.members.me);
        if (!permissions || !permissions.has('Connect') || !permissions.has('Speak')) {
            return interaction.editReply({
                embeds: [{
                    color: client.config.colors.error,
                    description: `${client.config.emojis.error} I don't have permission to join or speak in your voice channel!`
                }]
            });
        }
        
        let player = client.lavalink.getPlayer(interaction.guildId);
        
        if (!player) {
            player = client.lavalink.createPlayer({
                guildId: interaction.guildId,
                voiceChannelId: voiceChannel.id,
                textChannelId: interaction.channelId,
                selfDeaf: true,
                selfMute: false,
                volume: 75
            });
            
            await player.connect();
        } else if (player.voiceChannelId !== voiceChannel.id) {
            return interaction.editReply({
                embeds: [{
                    color: client.config.colors.error,
                    description: `${client.config.emojis.error} I'm already playing in <#${player.voiceChannelId}>!`
                }]
            });
        }
        
        // Get the lavalink node and search
        const node = client.lavalink.nodeManager.leastUsedNodes()[0];
        if (!node) {
            return interaction.editReply({
                embeds: [{
                    color: client.config.colors.error,
                    description: `${client.config.emojis.error} No Lavalink nodes available!`
                }]
            });
        }
        
        // Detect if query is a URL or search term
        const isURL = /^https?:\/\/.+/.test(query);
        let res = null;
        let usedFallback = false;
        let originalPlatform = null;
        
        if (isURL) {
            // For URLs, let Lavalink auto-detect the platform first
            console.log(`Detected URL: ${query}`.cyan);
            
            // Detect platform and URL type from URL
            let isPlaylistURL = false;
            if (query.includes('spotify.com')) {
                originalPlatform = 'Spotify';
                isPlaylistURL = query.includes('/playlist/') || query.includes('/album/');
            } else if (query.includes('soundcloud.com')) {
                originalPlatform = 'SoundCloud';
                isPlaylistURL = query.includes('/sets/');
            } else if (query.includes('deezer.com')) {
                originalPlatform = 'Deezer';
                isPlaylistURL = query.includes('/playlist/') || query.includes('/album/');
            } else if (query.includes('music.apple.com')) {
                originalPlatform = 'Apple Music';
                isPlaylistURL = query.includes('/playlist/') || query.includes('/album/');
            }
            
            try {
                res = await node.search({ 
                    query: query
                }, interaction.user);
                
                if (res?.tracks?.length) {
                    console.log(`Successfully loaded ${originalPlatform || 'URL'}`.green);
                }
            } catch (error) {
                console.log(`Failed to load URL: ${error.message}`.red);
            }
            
            // If URL failed and it's a known music platform
            if ((!res?.tracks?.length || res.loadType === 'error') && originalPlatform) {
                console.log(`${originalPlatform} plugin not available`.yellow);
                
                // Check if it's a playlist URL
                if (isPlaylistURL) {
                    // For Spotify playlists, try automatic conversion if credentials are available
                    if (originalPlatform === 'Spotify' && client.config.spotify.clientId && client.config.spotify.clientSecret) {
                        console.log(`Attempting to fetch Spotify playlist and convert to YouTube...`.yellow);
                        
                        try {
                            // Update status
                            await interaction.editReply({
                                embeds: [{
                                    color: client.config.colors.warning,
                                    description: `${client.config.emojis.loading} **Fetching Spotify playlist...**\n\n` +
                                               `⚠️ Spotify plugin not available\n` +
                                               `🔄 Converting to YouTube tracks...`
                                }]
                            });
                            
                            // Extract playlist ID from URL
                            const playlistId = query.match(/playlist\/([a-zA-Z0-9]+)/)?.[1] || query.match(/album\/([a-zA-Z0-9]+)/)?.[1];
                            
                            if (!playlistId) {
                                throw new Error('Could not extract playlist ID');
                            }
                            
                            // Get Spotify access token
                            const credentials = Buffer.from(`${client.config.spotify.clientId}:${client.config.spotify.clientSecret}`).toString('base64');
                            const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/x-www-form-urlencoded',
                                    'Authorization': `Basic ${credentials}`
                                },
                                body: 'grant_type=client_credentials'
                            });
                            
                            if (!tokenResponse.ok) {
                                throw new Error(`Failed to get Spotify token: ${tokenResponse.status}`);
                            }
                            
                            const tokenData = await tokenResponse.json();
                            const accessToken = tokenData.access_token;
                            
                            // Fetch playlist data from Spotify API
                            const isAlbum = query.includes('/album/');
                            const spotifyUrl = `https://api.spotify.com/v1/${isAlbum ? 'albums' : 'playlists'}/${playlistId}`;
                            
                            const spotifyResponse = await fetch(spotifyUrl, {
                                headers: {
                                    'Authorization': `Bearer ${accessToken}`
                                }
                            });
                            
                            if (!spotifyResponse.ok) {
                                const errorText = await spotifyResponse.text();
                                let errorMessage = `Spotify API returned ${spotifyResponse.status}`;
                                
                                if (spotifyResponse.status === 404) {
                                    errorMessage = 'Playlist/Album not found or is region-blocked';
                                } else if (spotifyResponse.status === 403) {
                                    errorMessage = 'Access to this playlist/album is restricted';
                                }
                                
                                throw new Error(errorMessage);
                            }
                            
                            const playlistData = await spotifyResponse.json();
                            let tracks = isAlbum ? playlistData.tracks.items : playlistData.tracks.items.map(item => item.track);
                            
                            // Spotify API returns max 100 tracks per request - fetch additional pages if needed
                            let nextUrl = playlistData.tracks.next;
                            let totalFetched = tracks.length;
                            
                            while (nextUrl) {
                                console.log(`Fetching additional tracks... (${totalFetched} so far)`.cyan);
                                
                                const nextResponse = await fetch(nextUrl, {
                                    headers: {
                                        'Authorization': `Bearer ${accessToken}`
                                    }
                                });
                                
                                if (nextResponse.ok) {
                                    const nextData = await nextResponse.json();
                                    const nextTracks = isAlbum ? nextData.items : nextData.items.map(item => item.track);
                                    tracks = tracks.concat(nextTracks);
                                    totalFetched = tracks.length;
                                    nextUrl = nextData.next;
                                } else {
                                    console.log(`Failed to fetch additional tracks: ${nextResponse.status}`.yellow);
                                    break;
                                }
                            }
                            
                            if (!tracks || tracks.length === 0) {
                                throw new Error('No tracks found in playlist');
                            }
                            
                            console.log(`Found ${tracks.length} tracks in Spotify playlist (across ${Math.ceil(tracks.length / 100)} pages)`.green);
                            
                            // Update status
                            await interaction.editReply({
                                embeds: [{
                                    color: client.config.colors.primary,
                                    description: `${client.config.emojis.loading} **Converting ${tracks.length} tracks to YouTube...**\n\n` +
                                               `⏳ This may take a moment...`
                                }]
                            });
                            
                            // Search for each track on YouTube
                            // With background conversion, we can handle much larger playlists!
                            // Configurable limit from config (0 = unlimited)
                            const configLimit = client.config.spotify.maxPlaylistTracks;
                            const maxTracks = (configLimit === 0 || !configLimit) ? tracks.length : Math.min(tracks.length, configLimit);
                            const foundTracks = [];
                            const failedTracks = [];
                            
                            // Quick start: Convert first 10 tracks immediately, then continue in background
                            const quickStartLimit = Math.min(10, maxTracks);
                            let isQuickStartComplete = false;
                            
                            await interaction.editReply({
                                embeds: [{
                                    color: client.config.colors.primary,
                                    description: `${client.config.emojis.loading} **Converting tracks to YouTube...**\n\n` +
                                               `📊 Total tracks: ${maxTracks}\n` +
                                               `⚡ Converting first ${quickStartLimit} tracks for quick start...`
                                }]
                            });
                            
                            // Function to search for a track with fallback strategies
                            const searchTrack = async (track) => {
                                if (!track || !track.name) return null;
                                
                                const artists = track.artists?.map(a => a.name).join(', ') || 'Unknown Artist';
                                const searchQuery = `${artists} - ${track.name}`;
                                
                                try {
                                    // Try exact search first: "artist - song name"
                                    let ytResult = await node.search({
                                        query: searchQuery,
                                        source: 'ytsearch'
                                    }, interaction.user);
                                    
                                    if (ytResult?.tracks?.[0]) {
                                        return ytResult.tracks[0];
                                    }
                                    
                                    // Fallback 1: Try without artist, just song name
                                    const songOnly = track.name;
                                    ytResult = await node.search({
                                        query: songOnly,
                                        source: 'ytsearch'
                                    }, interaction.user);
                                    
                                    if (ytResult?.tracks?.[0]) {
                                        console.log(`Found using song name only: ${songOnly}`.yellow);
                                        return ytResult.tracks[0];
                                    }
                                    
                                    // Fallback 2: Try with "official" keyword
                                    const officialQuery = `${artists} ${track.name} official`;
                                    ytResult = await node.search({
                                        query: officialQuery,
                                        source: 'ytsearch'
                                    }, interaction.user);
                                    
                                    if (ytResult?.tracks?.[0]) {
                                        console.log(`Found using "official" keyword: ${officialQuery}`.yellow);
                                        return ytResult.tracks[0];
                                    }
                                    
                                    console.log(`Failed to find: ${searchQuery}`.red);
                                    failedTracks.push(`${artists} - ${track.name}`);
                                    return null;
                                    
                                } catch (error) {
                                    console.log(`Search error for: ${searchQuery} - ${error.message}`.red);
                                    return null;
                                }
                            };
                            
                            // Phase 1: Quick start - Convert first 10 tracks immediately
                            for (let i = 0; i < quickStartLimit; i++) {
                                const foundTrack = await searchTrack(tracks[i]);
                                if (foundTrack) {
                                    foundTracks.push(foundTrack);
                                }
                            }
                            
                            // If we found at least some tracks, start playing immediately
                            if (foundTracks.length > 0) {
                                isQuickStartComplete = true;
                                
                                // Add the first batch to queue and start playing
                                player.queue.add(foundTracks);
                                
                                if (!player.playing && !player.paused) {
                                    await player.play();
                                }
                                
                                // Show "now playing" message with stop conversion button
                                const stopButton = new (await import('discord.js')).ActionRowBuilder()
                                    .addComponents(
                                        new (await import('discord.js')).ButtonBuilder()
                                            .setCustomId(`stop_conversion_${interaction.guildId}`)
                                            .setLabel('Stop Conversion')
                                            .setEmoji('⏹️')
                                            .setStyle((await import('discord.js')).ButtonStyle.Danger)
                                    );
                                
                                await interaction.editReply({
                                    embeds: [{
                                        color: client.config.colors.success,
                                        title: `${client.config.emojis.play} Starting Playback!`,
                                        description: `**${playlistData.name}**\n\n` +
                                                   `⚡ Playing first ${foundTracks.length} tracks now!\n` +
                                                   `🔄 Converting remaining ${maxTracks - quickStartLimit} tracks in background...`,
                                        fields: [
                                            {
                                                name: '🎵 Now Playing',
                                                value: `${foundTracks[0].info.author} - ${foundTracks[0].info.title}`,
                                                inline: false
                                            },
                                            {
                                                name: '📊 Queue Status',
                                                value: `✅ Ready to play: ${foundTracks.length} tracks\n` +
                                                       `⏳ Still converting: ${maxTracks - quickStartLimit} tracks`,
                                                inline: false
                                            }
                                        ],
                                        thumbnail: { url: playlistData.images?.[0]?.url }
                                    }],
                                    components: [stopButton]
                                });
                                
                                // Phase 2: Background conversion - Continue converting remaining tracks
                                (async () => {
                                    console.log(`Background conversion started for remaining ${maxTracks - quickStartLimit} tracks...`.cyan);
                                    
                                    // Store background conversion flag on player
                                    player.set('backgroundConversion', true);
                                    player.set('backgroundConversionGuild', interaction.guildId);
                                    
                                    for (let i = quickStartLimit; i < maxTracks; i++) {
                                        // Check if conversion should be cancelled (player destroyed or stopped)
                                        // Try to get the player again to check if it still exists
                                        const currentPlayer = client.lavalink.getPlayer(interaction.guildId);
                                        if (!currentPlayer || !currentPlayer.connected || currentPlayer.get('backgroundConversion') === false) {
                                            console.log(`Background conversion cancelled at track ${i + 1}/${maxTracks}`.yellow);
                                            await interaction.editReply({
                                                embeds: [{
                                                    color: client.config.colors.warning,
                                                    title: `⚠️ Background Conversion Cancelled`,
                                                    description: `**${playlistData.name}**\n\n` +
                                                               `Conversion stopped at **${i}/${maxTracks}** tracks.`,
                                                    fields: [
                                                        {
                                                            name: '📊 Final Stats',
                                                            value: `✅ Converted: ${foundTracks.length} tracks\n` +
                                                                   `⏹️ Cancelled: ${maxTracks - i} tracks remaining`,
                                                            inline: false
                                                        }
                                                    ]
                                                }],
                                                components: [] // Remove button when cancelled
                                            }).catch(() => {});
                                            return;
                                        }
                                        
                                        const foundTrack = await searchTrack(tracks[i]);
                                        if (foundTrack) {
                                            foundTracks.push(foundTrack);
                                            player.queue.add(foundTrack);
                                        }
                                        
                                        // Update progress every 20 tracks
                                        if ((i + 1) % 20 === 0) {
                                            const progressStopButton = new (await import('discord.js')).ActionRowBuilder()
                                                .addComponents(
                                                    new (await import('discord.js')).ButtonBuilder()
                                                        .setCustomId(`stop_conversion_${interaction.guildId}`)
                                                        .setLabel('Stop Conversion')
                                                        .setEmoji('⏹️')
                                                        .setStyle((await import('discord.js')).ButtonStyle.Danger)
                                                );
                                            
                                            await interaction.editReply({
                                                embeds: [{
                                                    color: client.config.colors.primary,
                                                    title: `${client.config.emojis.play} Playing & Converting`,
                                                    description: `**${playlistData.name}**\n\n` +
                                                               `🎵 Currently playing tracks\n` +
                                                               `🔄 Background conversion in progress...`,
                                                    fields: [
                                                        {
                                                            name: '📊 Conversion Progress',
                                                            value: `✅ Converted: ${i + 1}/${maxTracks} tracks\n` +
                                                                   `✅ Found: ${foundTracks.length} tracks\n` +
                                                                   `⏱️ Estimated time remaining: ~${Math.ceil((maxTracks - i - 1) / 2)} seconds`,
                                                            inline: false
                                                        }
                                                    ]
                                                }],
                                                components: [progressStopButton]
                                            }).catch(() => {});
                                        }
                                    }
                                    
                                    // Background conversion complete!
                                    player.set('backgroundConversion', false); // Mark as complete
                                    const successRate = Math.round((foundTracks.length / maxTracks) * 100);
                                    console.log(`Background conversion complete! ${foundTracks.length}/${maxTracks} tracks (${successRate}%)`.green);
                                    
                                    // Final update
                                    const finalEmbedFields = [
                                        {
                                            name: '📊 Final Conversion Stats',
                                            value: `✅ Successfully converted: **${foundTracks.length}** tracks\n` +
                                                   `❌ Failed to find: **${failedTracks.length}** tracks\n` +
                                                   `📝 Total in playlist: **${tracks.length}** tracks\n` +
                                                   `📈 Success rate: **${successRate}%**\n` +
                                                   `${maxTracks < tracks.length ? `⚠️ Limited to first ${maxTracks} tracks (to avoid timeout)` : ''}`,
                                            inline: false
                                        },
                                        {
                                            name: '✅ Status',
                                            value: `Background conversion complete! All tracks added to queue.`,
                                            inline: false
                                        }
                                    ];
                                    
                                    // Add failed tracks list if there are any (but keep it short)
                                    if (failedTracks.length > 0 && failedTracks.length <= 5) {
                                        finalEmbedFields.push({
                                            name: '❌ Tracks Not Found on YouTube',
                                            value: failedTracks.map(t => `• ${t}`).join('\n').substring(0, 1024),
                                            inline: false
                                        });
                                    } else if (failedTracks.length > 5) {
                                        finalEmbedFields.push({
                                            name: '❌ Tracks Not Found on YouTube',
                                            value: `${failedTracks.slice(0, 3).map(t => `• ${t}`).join('\n')}\n...and ${failedTracks.length - 3} more`,
                                            inline: false
                                        });
                                    }
                                    
                                    await interaction.editReply({
                                        embeds: [{
                                            color: client.config.colors.success,
                                            title: `${client.config.emojis.success} Spotify Playlist Fully Converted!`,
                                            description: `**${playlistData.name}**`,
                                            fields: finalEmbedFields,
                                            thumbnail: { url: playlistData.images?.[0]?.url }
                                        }],
                                        components: [] // Remove button when done
                                    }).catch(() => {});
                                })();
                                
                                // Return early - music is already playing!
                                return;
                            }
                            
                            if (foundTracks.length === 0) {
                                throw new Error('Could not find any tracks on YouTube');
                            }
                            
                            console.log(`Successfully converted ${foundTracks.length}/${maxTracks} tracks to YouTube`.green);
                            
                            // Add tracks to queue
                            const isFirstPlaylist = !player.queue.current && player.queue.tracks.length === 0;
                            await player.queue.add(foundTracks);
                            
                            if (isFirstPlaylist) {
                                await player.play();
                            }
                            
                            // Show success message
                            const successRate = Math.round((foundTracks.length / maxTracks) * 100);
                            const embedFields = [
                                {
                                    name: '📊 Conversion Stats',
                                    value: `✅ Successfully converted: **${foundTracks.length}** tracks\n` +
                                           `❌ Failed to find: **${failedTracks.length}** tracks\n` +
                                           `📝 Total in playlist: **${tracks.length}** tracks\n` +
                                           `📈 Success rate: **${successRate}%**\n` +
                                           `${maxTracks < tracks.length ? `⚠️ Limited to first ${maxTracks} tracks (to avoid timeout)` : ''}`,
                                    inline: false
                                },
                                {
                                    name: '⚠️ Note',
                                    value: `Spotify plugin not available - tracks were automatically searched on YouTube`,
                                    inline: false
                                }
                            ];
                            
                            // Add failed tracks list if there are any (but keep it short)
                            if (failedTracks.length > 0 && failedTracks.length <= 5) {
                                embedFields.push({
                                    name: '❌ Tracks Not Found on YouTube',
                                    value: failedTracks.map(t => `• ${t}`).join('\n').substring(0, 1024),
                                    inline: false
                                });
                            } else if (failedTracks.length > 5) {
                                embedFields.push({
                                    name: '❌ Tracks Not Found on YouTube',
                                    value: `${failedTracks.slice(0, 3).map(t => `• ${t}`).join('\n')}\n...and ${failedTracks.length - 3} more`,
                                    inline: false
                                });
                            }
                            
                            return interaction.editReply({
                                embeds: [{
                                    color: client.config.colors.success,
                                    title: `${client.config.emojis.success} Spotify Playlist Converted!`,
                                    description: `**${playlistData.name}**`,
                                    fields: embedFields,
                                    thumbnail: { url: playlistData.images?.[0]?.url }
                                }]
                            });
                            
                        } catch (error) {
                            console.error(`Failed to convert Spotify playlist: ${error.message}`.red);
                            
                            // Check if it's a region block error
                            const isRegionBlock = error.message.includes('region-blocked') || error.message.includes('not found');
                            const is404 = error.message.includes('404');
                            
                            if (is404 || isRegionBlock) {
                                return interaction.editReply({
                                    embeds: [{
                                        color: client.config.colors.error,
                                        title: `${client.config.emojis.error} Spotify Playlist/Album Not Available`,
                                        description: `This Spotify playlist or album is region-blocked or unavailable.`,
                                        fields: [
                                            {
                                                name: '🌍 Region Restriction',
                                                value: `**This content cannot be accessed via Spotify API.**\n\n` +
                                                       `**Common reasons:**\n` +
                                                       `• Geographic/regional restrictions\n` +
                                                       `• Playlist is private or deleted\n` +
                                                       `• Editorial playlists (Today's Top Hits, etc.) are region-locked\n` +
                                                       `• Album removed from Spotify`,
                                                inline: false
                                            },
                                            {
                                                name: '💡 Alternative Solutions',
                                                value: `• **Copy the playlist to your own Spotify account** and share that URL\n` +
                                                       `• Use individual track links instead\n` +
                                                       `• Search by name: \`/play [song name]\`\n` +
                                                       `• Use YouTube playlist URLs\n` +
                                                       `• Try a different Spotify playlist`,
                                                inline: false
                                            },
                                            {
                                                name: '📝 Note',
                                                value: `Spotify editorial playlists (IDs starting with \`37i9dQZ...\`) often have API restrictions. User-created playlists work better!`,
                                                inline: false
                                            }
                                        ],
                                        footer: { text: `Error: ${error.message}` }
                                    }]
                                });
                            }
                            
                            // Show generic error for other failures
                            return interaction.editReply({
                                embeds: [{
                                    color: client.config.colors.error,
                                    title: `${client.config.emojis.error} Failed to Convert Spotify Playlist`,
                                    description: `Unable to convert this Spotify playlist to YouTube.`,
                                    fields: [
                                        {
                                            name: '⚠️ Error Details',
                                            value: error.message,
                                            inline: false
                                        },
                                        {
                                            name: '💡 Workarounds',
                                            value: `• Use individual track URLs instead of playlists\n` +
                                                   `• Use YouTube playlist URLs\n` +
                                                   `• Search for songs individually with \`/play\`\n` +
                                                   `• Ask the bot owner to enable Spotify plugin`
                                        }
                                    ],
                                    footer: { text: 'Spotify conversion failed' }
                                }]
                            });
                        }
                    } else {
                        // No Spotify credentials or non-Spotify playlist - show error
                        return interaction.editReply({
                            embeds: [{
                                color: client.config.colors.error,
                                title: `${client.config.emojis.error} ${originalPlatform} Plugin Not Available`,
                                description: `Unable to load ${originalPlatform} playlists because the ${originalPlatform} plugin is not configured on this Lavalink server.`,
                                fields: [
                                    {
                                        name: '💡 Recommended Solution',
                                        value: `**Use a Lavalink server with ${originalPlatform} support:**\n` +
                                               `The bot owner can switch to a server like:\n` +
                                               `• \`lava-v4.ajieblogs.eu.org:443\` (has Spotify)\n` +
                                               `• Use \`/switchlavalink\` command\n\n` +
                                               `Or use the workarounds below:`
                                    },
                                    {
                                        name: '🔧 Workarounds',
                                        value: `• Use individual track URLs instead of playlists\n` +
                                               `• Use YouTube playlist URLs\n` +
                                               `• Search for songs individually with \`/play\`\n` +
                                               `• Copy playlist to YouTube Music`
                                    }
                                ],
                                footer: { text: 'Playlists require platform-specific plugins to function' }
                            }]
                        });
                    }
                } else {
                    // For single Spotify tracks, try API conversion
                    if (originalPlatform === 'Spotify' && client.config.spotify.clientId && client.config.spotify.clientSecret) {
                        console.log('Attempting to convert Spotify track to YouTube...'.yellow);
                        
                        try {
                            // Extract track ID from URL
                            const trackId = query.match(/track\/([a-zA-Z0-9]+)/)?.[1];
                            
                            if (trackId) {
                                // Get Spotify access token
                                const credentials = Buffer.from(`${client.config.spotify.clientId}:${client.config.spotify.clientSecret}`).toString('base64');
                                const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/x-www-form-urlencoded',
                                        'Authorization': `Basic ${credentials}`
                                    },
                                    body: 'grant_type=client_credentials'
                                });
                                
                                if (tokenResponse.ok) {
                                    const tokenData = await tokenResponse.json();
                                    
                                    // Fetch track data from Spotify API
                                    const trackUrl = `https://api.spotify.com/v1/tracks/${trackId}`;
                                    const trackResponse = await fetch(trackUrl, {
                                        headers: {
                                            'Authorization': `Bearer ${tokenData.access_token}`
                                        }
                                    });
                                    
                                    if (trackResponse.ok) {
                                        const trackData = await trackResponse.json();
                                        const artists = trackData.artists?.map(a => a.name).join(', ') || 'Unknown Artist';
                                        const searchQuery = `${artists} - ${trackData.name}`;
                                        
                                        console.log(`Searching YouTube for: ${searchQuery}`.cyan);
                                        
                                        // Search on YouTube
                                        res = await node.search({ 
                                            query: searchQuery,
                                            source: 'ytsearch'
                                        }, interaction.user);
                                        
                                        if (res?.tracks?.length) {
                                            usedFallback = true;
                                            console.log(`Successfully converted Spotify track to YouTube!`.green);
                                        }
                                    } else if (trackResponse.status === 404) {
                                        // Track is region-blocked or not found
                                        console.log(`Spotify track is region-blocked or unavailable (404)`.red);
                                        return interaction.editReply({
                                            embeds: [{
                                                color: client.config.colors.error,
                                                title: `${client.config.emojis.error} Spotify Track Not Available`,
                                                description: `This Spotify track is region-blocked or unavailable.`,
                                                fields: [
                                                    {
                                                        name: '🌍 Region Restriction',
                                                        value: `This track cannot be accessed in your region via Spotify API.\n\n` +
                                                               `**Possible reasons:**\n` +
                                                               `• Geographic/regional restrictions\n` +
                                                               `• Track has been removed from Spotify\n` +
                                                               `• Track requires premium/specific subscription\n` +
                                                               `• API access limitations`,
                                                        inline: false
                                                    },
                                                    {
                                                        name: '💡 Alternative Solutions',
                                                        value: `• Try searching by name: \`/play [artist name - song name]\`\n` +
                                                               `• Use a YouTube link instead\n` +
                                                               `• Try a different Spotify track`,
                                                        inline: false
                                                    }
                                                ],
                                                footer: { text: 'Error 404: Resource not found' }
                                            }]
                                        });
                                    } else if (trackResponse.status === 403) {
                                        // Access restricted
                                        console.log(`Spotify track access restricted (403)`.red);
                                        return interaction.editReply({
                                            embeds: [{
                                                color: client.config.colors.error,
                                                title: `${client.config.emojis.error} Access Restricted`,
                                                description: `Access to this Spotify track is restricted.`,
                                                fields: [
                                                    {
                                                        name: '💡 Try Instead',
                                                        value: `• Search by name: \`/play [song name]\`\n` +
                                                               `• Use a YouTube link`,
                                                        inline: false
                                                    }
                                                ],
                                                footer: { text: 'Error 403: Forbidden' }
                                            }]
                                        });
                                    }
                                }
                            }
                        } catch (error) {
                            console.log(`Spotify track conversion failed: ${error.message}`.red);
                        }
                    }
                    
                    // If Spotify conversion didn't work or not Spotify, try generic fallback
                    if (!res?.tracks?.length) {
                        console.log('Trying YouTube fallback for single track...'.yellow);
                        
                        // Extract basic search query from URL (this is a simple fallback)
                        const searchQuery = query.split('/').pop().split('?')[0].replace(/-|_/g, ' ');
                        
                        try {
                            res = await node.search({ 
                                query: searchQuery,
                                source: 'ytsearch'
                            }, interaction.user);
                            
                            if (res?.tracks?.length) {
                                usedFallback = true;
                                console.log(`Found results on YouTube using: ${searchQuery}`.green);
                            }
                        } catch (fallbackError) {
                            console.log(`YouTube fallback failed: ${fallbackError.message}`.red);
                        }
                    }
                }
            }
        } else {
            // For search terms, try multiple sources as fallback
            const searchSources = ["ytmsearch", "ytsearch", "scsearch"];
            
            for (const source of searchSources) {
                try {
                    res = await node.search({ 
                        query: query,
                        source: source
                    }, interaction.user);
                    
                    if (res?.tracks?.length) {
                        console.log(`Found results using source: ${source}`.green);
                        break;
                    }
                } catch (error) {
                    console.log(`Search failed with ${source}: ${error.message}`.red);
                }
            }
        }
        
        if (!res?.tracks?.length) {
            return interaction.editReply({
                embeds: [{
                    color: client.config.colors.error,
                    description: `${client.config.emojis.error} No results found for **${query}**${originalPlatform ? `\n\n⚠️ ${originalPlatform} plugin is not available on this server` : ', check logs'}`
                }]
            });
        }
        
        if (res.loadType === 'playlist') {
            const isFirstPlaylist = !player.queue.current && player.queue.tracks.length === 0;
            
            console.log(`Adding PLAYLIST: ${res.playlist.name} with ${res.tracks.length} tracks`.yellow);
            await player.queue.add(res.tracks);
            
            if (isFirstPlaylist) {
                await player.play();
                
                // Wait for track to start
                let retries = 0;
                while (!player.queue.current && retries < 10) {
                    await new Promise(resolve => setTimeout(resolve, 300));
                    retries++;
                }
                
                // Store the text channel for trackStart event to use
                player.set('currentTextChannel', interaction.channel);
                
                // Send playlist confirmation only - trackStart event will send Now Playing
                await interaction.editReply({
                    embeds: [{
                        color: client.config.colors.success,
                        description: `${client.config.emojis.success} Added playlist **${res.playlist.name}** (${res.tracks.length} tracks) to the queue`,
                        thumbnail: { url: res.tracks[0]?.info?.artworkUrl }
                    }]
                });
            } else {
                await interaction.editReply({
                    embeds: [{
                        color: client.config.colors.success,
                        description: `${client.config.emojis.success} Added playlist **${res.playlist.name}** (${res.tracks.length} tracks) to the queue`,
                        thumbnail: { url: res.tracks[0]?.info?.artworkUrl }
                    }]
                });
            }
        } else {
            const track = res.tracks[0];
            
            // Debug logging
            console.log('─────────────────────────────────────'.cyan);
            console.log(`Adding SINGLE TRACK: ${track.info.title}`.cyan.bold);
            console.log('Track info:', JSON.stringify(track.info, null, 2));
            console.log('Before adding track:');
            console.log('  player.playing:', player.playing);
            console.log('  player.paused:', player.paused);
            console.log('  queue.current:', player.queue.current?.info?.title || 'none');
            console.log('  queue.tracks.length:', player.queue.tracks.length);
            console.log('  loadType:', res.loadType);
            console.log('  total search results:', res.tracks.length);
            
            const isFirstTrack = !player.queue.current && player.queue.tracks.length === 0;
            
            await player.queue.add(track);
            
            console.log('After adding track:');
            console.log('  queue.tracks.length:', player.queue.tracks.length);
            console.log('  isFirstTrack:', isFirstTrack);
            console.log('─────────────────────────────────────'.cyan);
            
            if (isFirstTrack) {
                // Store the text channel for trackStart event to use
                player.set('currentTextChannel', interaction.channel);
                
                // Start playing only if nothing is currently playing
                await player.play();
                
                // Wait for track to actually start (with retry logic)
                let retries = 0;
                while (!player.queue.current && retries < 10) {
                    await new Promise(resolve => setTimeout(resolve, 300));
                    retries++;
                }
                
                // Send simple confirmation - trackStart event will send full Now Playing message
                const confirmEmbed = {
                    color: client.config.colors.success,
                    description: `${client.config.emojis.play} **Starting playback...**\n**[${track.info.title}](${track.info.uri})**`,
                    thumbnail: { url: track.info.artworkUrl }
                };
                
                // Add fallback warning if used
                if (usedFallback && originalPlatform) {
                    confirmEmbed.fields = [{
                        name: '⚠️ Fallback Used',
                        value: `${originalPlatform} plugin is not available. Playing from YouTube instead.`,
                        inline: false
                    }];
                }
                
                await interaction.editReply({
                    embeds: [confirmEmbed]
                });
            } else {
                const queueEmbed = {
                    color: client.config.colors.success,
                    description: `${client.config.emojis.success} Added to queue: **[${track.info.title}](${track.info.uri})**`,
                    thumbnail: { url: track.info.artworkUrl },
                    fields: [
                        { name: 'Position', value: `#${player.queue.tracks.length}`, inline: true },
                        { name: 'Duration', value: formatTime(track.info.duration), inline: true }
                    ]
                };
                
                // Add fallback warning if used
                if (usedFallback && originalPlatform) {
                    queueEmbed.fields.push({
                        name: '⚠️ Fallback Used',
                        value: `${originalPlatform} plugin is not available. Playing from YouTube instead.`,
                        inline: false
                    });
                }
                
                await interaction.editReply({
                    embeds: [queueEmbed]
                });
            }
        }
    },

    async autocomplete(interaction, client) {
        try {
            const focusedValue = interaction.options.getFocused();
            
            // If empty or too short, return empty
            if (!focusedValue || focusedValue.trim().length < 2) {
                return interaction.respond([]);
            }
            
            // Check if it's a URL
            if (focusedValue.startsWith('http://') || focusedValue.startsWith('https://')) {
                return interaction.respond([
                    { name: 'Play from URL: ' + focusedValue.substring(0, 80), value: focusedValue }
                ]);
            }
            
            // Search for songs with timeout
            const node = client.lavalink.nodeManager.leastUsedNodes()[0];
            if (!node) {
                return interaction.respond([]);
            }
            
            // Add 2.5 second timeout to prevent Discord timeout
            // Try ytsearch first (more reliable than ytmsearch)
            const searchPromise = node.search({ 
                query: focusedValue,
                source: "ytsearch"
            }, interaction.user);
            
            const timeoutPromise = new Promise((resolve) => 
                setTimeout(() => resolve(null), 2500)
            );
            
            const res = await Promise.race([searchPromise, timeoutPromise]);
            
            if (!res?.tracks?.length) {
                return interaction.respond([]);
            }
            
            // Return top 10 results
            const choices = res.tracks.slice(0, 10).map(track => ({
                name: `${track.info.title} - ${track.info.author}`.substring(0, 100),
                value: track.info.uri
            }));
            
            await interaction.respond(choices);
        } catch (error) {
            // Silently fail autocomplete - don't log as it's expected sometimes
            try {
                await interaction.respond([]);
            } catch {}
        }
    }
};

function formatTime(ms) {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor(ms / (1000 * 60 * 60));
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
