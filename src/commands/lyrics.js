import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { Client as GeniusClient } from 'genius-lyrics';

export default {
    data: new SlashCommandBuilder()
        .setName('lyrics')
        .setDescription('Get lyrics for the current song or search for a song')
        .addStringOption(option =>
            option.setName('song')
                .setDescription('Song name to search (leave empty for current song)')
                .setRequired(false)
        ),
    
    async execute(interaction, client) {
        // Only defer if not already deferred (for button interactions)
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply();
        }
        
        let songName, artistName;
        
        // Get song info from query or current playing
        const query = interaction.options?.getString ? interaction.options.getString('song') : null;
        
        if (query) {
            // Parse query - try to split by common separators
            const parts = query.split(/[-–—]/);
            if (parts.length >= 2) {
                songName = parts[0].trim();
                artistName = parts[1].trim();
            } else {
                songName = query.trim();
                artistName = '';
            }
        } else {
            // Get from current playing
            const player = client.lavalink.getPlayer(interaction.guildId);
            
            if (!player || !player.queue.current) {
                return interaction.editReply({
                    embeds: [{
                        color: client.config.colors.error,
                        description: `${client.config.emojis.error} No song is currently playing!\n\nUse \`/lyrics <song name - artist>\` to search for lyrics.`
                    }]
                });
            }
            
            const track = player.queue.current;
            songName = track.info.title;
            artistName = track.info.author;
        }
        
        try {
            let lyrics = null;
            let source = '';
            
            // Try Genius API first (best results, requires setup)
            if (client.config.genius.clientId) {
                try {
                    lyrics = await searchLyricsGenius(songName, artistName, client.config.genius.clientId);
                    source = 'Genius';
                } catch (error) {
                    console.log('Genius API failed, trying lrclib:', error.message);
                }
            }
            
            // Fallback to lrclib.net API (free, no key needed)
            if (!lyrics) {
                lyrics = await searchLyricsLrclib(songName, artistName);
                source = 'lrclib.net';
            }
            
            if (!lyrics) {
                return interaction.editReply({
                    embeds: [{
                        color: client.config.colors.error,
                        description: `${client.config.emojis.error} No lyrics found for **${songName}** by **${artistName}**\n\n` +
                                   `Try searching with: \`/lyrics ${songName} - ${artistName}\``
                    }]
                });
            }
            
            // Split lyrics into chunks (Discord has 4096 character limit per field)
            const chunks = splitLyrics(lyrics.text, 4000);
            
            if (chunks.length === 1) {
                // Single embed
                const embed = new EmbedBuilder()
                    .setColor(client.config.colors.primary)
                    .setAuthor({ 
                        name: '📝 Lyrics',
                        iconURL: client.user.displayAvatarURL()
                    })
                    .setTitle(`${lyrics.trackName || songName}`)
                    .setDescription(`**Artist:** ${lyrics.artistName || artistName}\n\n${chunks[0]}`)
                    .setFooter({ 
                        text: `Powered by ${source} • Requested by ${interaction.user.tag}`,
                        iconURL: interaction.user.displayAvatarURL()
                    })
                    .setTimestamp();
                
                if (lyrics.url) {
                    embed.setURL(lyrics.url);
                }
                
                await interaction.editReply({ embeds: [embed] });
            } else {
                // Multiple embeds for long lyrics
                const embeds = chunks.map((chunk, index) => {
                    const embed = new EmbedBuilder()
                        .setColor(client.config.colors.primary)
                        .setDescription(chunk);
                    
                    if (index === 0) {
                        embed
                            .setAuthor({ 
                                name: '📝 Lyrics',
                                iconURL: client.user.displayAvatarURL()
                            })
                            .setTitle(`${lyrics.trackName || songName}`)
                            .addFields({
                                name: 'Artist',
                                value: lyrics.artistName || artistName,
                                inline: true
                            });
                    }
                    
                    if (index === chunks.length - 1) {
                        embed.setFooter({ 
                            text: `Powered by ${source} • Requested by ${interaction.user.tag}`,
                            iconURL: interaction.user.displayAvatarURL()
                        })
                        .setTimestamp();
                    }
                    
                    if (index === 0 && lyrics.url) {
                        embed.setURL(lyrics.url);
                    }
                    
                    return embed;
                });
                
                // Discord allows max 10 embeds
                const embedsToSend = embeds.slice(0, 10);
                await interaction.editReply({ embeds: embedsToSend });
                
                if (embeds.length > 10) {
                    await interaction.followUp({
                        content: '⚠️ Lyrics were too long, only showing first part.',
                        flags: MessageFlags.Ephemeral
                    });
                }
            }
        } catch (error) {
            console.error('Lyrics search error:', error);
            
            return interaction.editReply({
                embeds: [{
                    color: client.config.colors.error,
                    description: `${client.config.emojis.error} Failed to fetch lyrics!\n\n` +
                               `**Error:** ${error.message}\n\n` +
                               `Try again or search manually: \`/lyrics <song name - artist>\``
                }]
            });
        }
    }
};

async function searchLyricsGenius(trackName, artistName, accessToken) {
    try {
        const Genius = new GeniusClient(accessToken);
        
        // Clean up search query
        const cleanTrack = cleanSearchQuery(trackName);
        const cleanArtist = cleanSearchQuery(artistName);
        const searchQuery = `${cleanTrack} ${cleanArtist}`;
        
        // Search for songs
        const searches = await Genius.songs.search(searchQuery);
        
        if (!searches || searches.length === 0) {
            return null;
        }
        
        // Get the first result
        const song = searches[0];
        
        // Fetch full lyrics
        const lyrics = await song.lyrics();
        
        if (!lyrics) {
            return null;
        }
        
        return {
            text: lyrics,
            trackName: song.title,
            artistName: song.artist.name,
            albumName: song.album?.name,
            url: song.url
        };
    } catch (error) {
        console.error('Genius API error:', error);
        return null;
    }
}

async function searchLyricsLrclib(trackName, artistName) {
    try {
        const baseUrl = 'https://lrclib.net/api/get';
        
        // Clean up track and artist names
        const cleanTrack = cleanSearchQuery(trackName);
        const cleanArtist = cleanSearchQuery(artistName);
        
        // Build search URL
        const params = new URLSearchParams({
            track_name: cleanTrack,
            artist_name: cleanArtist
        });
        
        const url = `${baseUrl}?${params}`;
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Discord Music Bot (https://github.com/discord-bot)'
            },
            signal: AbortSignal.timeout(10000) // 10 second timeout
        });
        
        if (!response.ok) {
            if (response.status === 404) {
                return null; // No lyrics found
            }
            throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.plainLyrics && !data.syncedLyrics) {
            return null;
        }
        
        // Parse synced lyrics to remove timestamps if needed
        let lyricsText = data.plainLyrics;
        if (!lyricsText && data.syncedLyrics) {
            // Remove timestamps from synced lyrics [mm:ss.xx]
            lyricsText = data.syncedLyrics
                .split('\n')
                .map(line => line.replace(/^\[\d+:\d+\.\d+\]\s*/, ''))
                .filter(line => line.trim())
                .join('\n');
        }
        
        return {
            text: lyricsText || 'No lyrics available',
            trackName: data.trackName,
            artistName: data.artistName,
            albumName: data.albumName,
            duration: data.duration
        };
    } catch (error) {
        console.error('lrclib API error:', error);
        return null;
    }
}

function cleanSearchQuery(query) {
    if (!query) return '';
    
    return query
        // Remove common suffixes and prefixes
        .replace(/\s*-\s*(Official|Lyrics|Audio|Video|Music|HD|HQ|4K|MV|Visualizer|Lyric Video).*$/i, '')
        .replace(/\s*\(Official.*\)$/i, '')
        .replace(/\s*\[Official.*\]$/i, '')
        .replace(/\s*\(Lyrics?\)$/i, '')
        .replace(/\s*\[Lyrics?\]$/i, '')
        .replace(/\s*\(Audio\)$/i, '')
        .replace(/\s*\[Audio\]$/i, '')
        // Remove featuring artists (keep main artist only)
        .replace(/\s*[,&]\s+.*/i, '')
        .replace(/\s+(feat|ft|featuring)\.?\s+.*/i, '')
        .replace(/\s+x\s+.*/i, '')
        // Remove topic/VEVO/channel suffixes
        .replace(/\s*-\s*Topic$/i, '')
        .replace(/\s*VEVO$/i, '')
        // Remove extra punctuation
        .replace(/['"]/g, '')
        // Clean whitespace
        .trim();
}

function splitLyrics(lyrics, maxLength) {
    if (!lyrics) return ['No lyrics available'];
    
    if (lyrics.length <= maxLength) {
        return [lyrics];
    }
    
    const chunks = [];
    const lines = lyrics.split('\n');
    let currentChunk = '';
    
    for (const line of lines) {
        if ((currentChunk + line + '\n').length > maxLength) {
            if (currentChunk) {
                chunks.push(currentChunk.trim());
                currentChunk = '';
            }
            
            // If single line is too long, split it
            if (line.length > maxLength) {
                const words = line.split(' ');
                let tempLine = '';
                
                for (const word of words) {
                    if ((tempLine + word + ' ').length > maxLength) {
                        if (tempLine) {
                            chunks.push(tempLine.trim());
                            tempLine = '';
                        }
                        tempLine = word + ' ';
                    } else {
                        tempLine += word + ' ';
                    }
                }
                
                if (tempLine) {
                    currentChunk = tempLine;
                }
            } else {
                currentChunk = line + '\n';
            }
        } else {
            currentChunk += line + '\n';
        }
    }
    
    if (currentChunk) {
        chunks.push(currentChunk.trim());
    }
    
    return chunks.length > 0 ? chunks : ['No lyrics available'];
}
