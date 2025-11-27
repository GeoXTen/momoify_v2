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
                                throw new Error(`Spotify API returned ${spotifyResponse.status}`);
                            }
                            
                            const playlistData = await spotifyResponse.json();
                            const tracks = isAlbum ? playlistData.tracks.items : playlistData.tracks.items.map(item => item.track);
                            
                            if (!tracks || tracks.length === 0) {
                                throw new Error('No tracks found in playlist');
                            }
                            
                            console.log(`Found ${tracks.length} tracks in Spotify playlist`.green);
                            
                            // Update status
                            await interaction.editReply({
                                embeds: [{
                                    color: client.config.colors.primary,
                                    description: `${client.config.emojis.loading} **Converting ${tracks.length} tracks to YouTube...**\n\n` +
                                               `⏳ This may take a moment...`
                                }]
                            });
                            
                            // Search for each track on YouTube (limit to first 50 tracks to avoid timeout)
                            const maxTracks = Math.min(tracks.length, 50);
                            const foundTracks = [];
                            
                            for (let i = 0; i < maxTracks; i++) {
                                const track = tracks[i];
                                if (!track || !track.name) continue;
                                
                                // Create search query: "artist - song name"
                                const artists = track.artists?.map(a => a.name).join(', ') || 'Unknown Artist';
                                const searchQuery = `${artists} - ${track.name}`;
                                
                                try {
                                    const ytResult = await node.search({
                                        query: searchQuery,
                                        source: 'ytsearch'
                                    }, interaction.user);
                                    
                                    if (ytResult?.tracks?.[0]) {
                                        foundTracks.push(ytResult.tracks[0]);
                                    }
                                } catch (error) {
                                    console.log(`Failed to find: ${searchQuery}`.red);
                                }
                                
                                // Update progress every 10 tracks
                                if ((i + 1) % 10 === 0) {
                                    await interaction.editReply({
                                        embeds: [{
                                            color: client.config.colors.primary,
                                            description: `${client.config.emojis.loading} **Converting tracks to YouTube...**\n\n` +
                                                       `📊 Progress: ${i + 1}/${maxTracks} tracks\n` +
                                                       `✅ Found: ${foundTracks.length} tracks`
                                        }]
                                    }).catch(() => {});
                                }
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
                            return interaction.editReply({
                                embeds: [{
                                    color: client.config.colors.success,
                                    title: `${client.config.emojis.success} Spotify Playlist Converted!`,
                                    description: `**${playlistData.name}**`,
                                    fields: [
                                        {
                                            name: '📊 Conversion Stats',
                                            value: `✅ Successfully converted: **${foundTracks.length}** tracks\n` +
                                                   `📝 Total in playlist: **${tracks.length}** tracks\n` +
                                                   `${maxTracks < tracks.length ? `⚠️ Limited to first ${maxTracks} tracks` : ''}`,
                                            inline: false
                                        },
                                        {
                                            name: '⚠️ Note',
                                            value: `Spotify plugin not available - tracks were automatically searched on YouTube`,
                                            inline: false
                                        }
                                    ],
                                    thumbnail: { url: playlistData.images?.[0]?.url }
                                }]
                            });
                            
                        } catch (error) {
                            console.error(`Failed to convert Spotify playlist: ${error.message}`.red);
                            
                            // Show error with fallback to manual workarounds
                            return interaction.editReply({
                                embeds: [{
                                    color: client.config.colors.error,
                                    title: `${client.config.emojis.error} Spotify Plugin Not Available`,
                                    description: `Unable to load Spotify playlists because the Spotify plugin is not configured on this Lavalink server.`,
                                    fields: [
                                        {
                                            name: '⚠️ Automatic conversion failed',
                                            value: `${error.message}. Try using individual track URLs or ask bot owner to configure Spotify plugin.`,
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
                                    footer: { text: 'Playlists require platform-specific plugins to function' }
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
                    // For single tracks, try YouTube fallback
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
                
                // Send playlist confirmation first
                await interaction.editReply({
                    embeds: [{
                        color: client.config.colors.success,
                        description: `${client.config.emojis.success} Added playlist **${res.playlist.name}** (${res.tracks.length} tracks) to the queue`,
                        thumbnail: { url: res.tracks[0]?.info?.artworkUrl }
                    }]
                });
                
                // Then send Now Playing message
                if (player.queue.current) {
                    const nowPlayingEmbed = createNowPlayingEmbed(player, client);
                    const nowPlayingButtons = createNowPlayingButtons(player, client);
                    
                    const message = await interaction.followUp({
                        embeds: [nowPlayingEmbed],
                        components: nowPlayingButtons
                    });
                    
                    player.nowPlayingMessage = message;
                }
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
                // Start playing only if nothing is currently playing
                await player.play();
                
                // Wait for track to actually start (with retry logic)
                let retries = 0;
                while (!player.queue.current && retries < 10) {
                    await new Promise(resolve => setTimeout(resolve, 300));
                    retries++;
                }
                
                // Check if track started successfully
                if (player.queue.current) {
                    // Show rich now playing interface
                    const nowPlayingEmbed = createNowPlayingEmbed(player, client);
                    const nowPlayingButtons = createNowPlayingButtons(player, client);
                    
                    // Add fallback warning if used
                    if (usedFallback && originalPlatform) {
                        nowPlayingEmbed.addFields({
                            name: '⚠️ Fallback Used',
                            value: `${originalPlatform} plugin is not available. Playing from YouTube instead.`,
                            inline: false
                        });
                    }
                    
                    const message = await interaction.editReply({
                        embeds: [nowPlayingEmbed],
                        components: nowPlayingButtons
                    });
                    
                    // Store the message reference for future edits
                    player.nowPlayingMessage = message;
                } else {
                    // Fallback: Track info from what we added
                    const message = await interaction.editReply({
                        embeds: [{
                            color: client.config.colors.success,
                            description: `${client.config.emojis.play} **Now Playing:**\n**[${track.info.title}](${track.info.uri})**\n\nBy: ${track.info.author}`,
                            thumbnail: { url: track.info.artworkUrl }
                        }]
                    });
                    
                    // Store the message reference for future edits
                    player.nowPlayingMessage = message;
                }
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
