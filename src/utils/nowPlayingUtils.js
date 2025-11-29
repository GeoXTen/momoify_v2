import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export function createNowPlayingEmbed(player, client) {
    const track = player.queue.current;
    
    // Safety check for client
    if (!client || !client.config) {
        throw new Error('Client or client.config is undefined');
    }
    
    // Safety check for track
    if (!track || !track.info) {
        throw new Error('No track is currently playing');
    }
    
    const position = player.position;
    const duration = track.info.duration;
    const percentage = (position / duration) * 100;
    
    // Create advanced progress bar with custom emojis
    const progressBar = createProgressBar(position, duration, 20, client.config.emojis);
    
    
    // Create animated equalizer bars - use visualizer emoji when playing (repeat for visibility)
    const visualizerEmoji = client.config.emojis?.visualizer || '▁▂▃▄▅▆▇█';
    const equalizer = player.paused ? '▬▬▬▬▬▬▬▬' : `${visualizerEmoji}${visualizerEmoji}${visualizerEmoji}`;
    
    // Get platform emoji
    const platformEmoji = getPlatformEmoji(track.info.uri, client.config.emojis);
    
    // Status indicator with fallbacks
    const statusEmoji = player.paused ? (client.config.emojis?.pause || client.config.emojis?.player) : (client.config.emojis?.play || client.config.emojis?.player);
    const statusText = player.paused ? 'Paused' : 'Playing';
    
    // Loop status with fallbacks
    const loopEmoji = player.repeatMode === 'off' ? (client.config.emojis?.control || '➡️') : player.repeatMode === 'track' ? '🔂' : (client.config.emojis?.loop || client.config.emojis?.control);
    const loopText = player.repeatMode === 'off' ? 'Off' : player.repeatMode === 'track' ? 'Track' : 'Queue';
    
    // Volume emoji with fallback
    const volumeEmoji = client.config.emojis?.volume || client.config.emojis?.player;
    
    // Create rich description
    const description = [
        `${equalizer} **Currently ${statusText}**\n`,
        `**Artist:** ${track.info.author}`,
        `**Duration:** \`${formatTime(position)}\` / \`${formatTime(duration)}\` • **${percentage.toFixed(1)}%**`,
        `${progressBar}\n`,
        `${volumeEmoji} **Volume:** \`${player.volume}%\` • ${loopEmoji} **Loop:** \`${loopText}\` • ${client.config.emojis?.queue || client.config.emojis?.cloudnote} **Queue:** \`${player.queue.tracks.length}\``,
        `${platformEmoji} **Source:** ${getPlatformName(track.info.uri)}`
    ].join('\n');
    
    const embed = new EmbedBuilder()
        .setColor(player.paused ? client.config.colors.warning : client.config.colors.primary)
        .setAuthor({ 
            name: `🎵 Now Playing`,
            iconURL: client.user.displayAvatarURL()
        })
        .setTitle(truncateString(track.info.title, 80))
        .setURL(track.info.uri)
        .setDescription(description)
        .setThumbnail(
            track.info.artworkUrl || 
            (track.info.identifier ? `https://img.youtube.com/vi/${track.info.identifier}/maxresdefault.jpg` : null) ||
            client.user.displayAvatarURL({ size: 512 })
        )
        .addFields(
            {
                name: `${client.config.emojis?.note1 || client.config.emojis?.melody} Requested By`,
                value: track.requester ? formatRequester(track.requester) : 'Unknown',
                inline: true
            },
            {
                name: `${client.config.emojis?.time || client.config.emojis?.checkmark} Started`,
                value: `<t:${Math.floor((Date.now() - position) / 1000)}:R>`,
                inline: true
            },
            {
                name: `${client.config.emojis?.stars || client.config.emojis?.verified} Bitrate`,
                value: track.info.isStream ? `${client.config.emojis?.source || client.config.emojis?.control} Live Stream` : `${client.config.emojis?.disk || client.config.emojis?.cloudnote} High Quality`,
                inline: true
            }
        )
        .setFooter({ 
            text: `🎧 ${player.queue.tracks.length + 1} tracks in session • Created by GeoNFs`,
            iconURL: null
        })
        .setTimestamp();
    
    return embed;
}

export function createNowPlayingButtons(player, client) {
    // Safety check for client parameter
    if (!client || !client.config) {
        console.error('Warning: client or client.config is undefined in createNowPlayingButtons');
        // Return basic buttons without emojis
        const row1 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('np_previous')
                    .setLabel('Previous')
                    .setEmoji('⏮️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(player.queue.previous.length === 0),
                new ButtonBuilder()
                    .setCustomId('np_pause')
                    .setLabel('Pause')
                    .setEmoji('⏸️')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(player.paused),
                new ButtonBuilder()
                    .setCustomId('np_resume')
                    .setLabel('Resume')
                    .setEmoji('▶️')
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(!player.paused),
                new ButtonBuilder()
                    .setCustomId('np_skip')
                    .setLabel('Skip')
                    .setEmoji('⏭️')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(player.queue.tracks.length === 0),
                new ButtonBuilder()
                    .setCustomId('np_stop')
                    .setLabel('Stop')
                    .setEmoji('⏹️')
                    .setStyle(ButtonStyle.Danger)
            );
        
        const row2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('np_loop')
                    .setLabel(`Loop: ${player.repeatMode === 'off' ? 'Off' : player.repeatMode === 'track' ? 'Track' : 'Queue'}`)
                    .setEmoji(player.repeatMode === 'track' ? '🔂' : '🔁')
                    .setStyle(player.repeatMode === 'off' ? ButtonStyle.Secondary : ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('np_shuffle')
                    .setLabel('Shuffle')
                    .setEmoji('🔀')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(player.queue.tracks.length < 2),
                new ButtonBuilder()
                    .setCustomId('np_queue')
                    .setLabel('View Queue')
                    .setEmoji('📜')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('np_lyrics')
                    .setLabel('Lyrics')
                    .setEmoji('📝')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('np_refresh')
                    .setLabel('Refresh')
                    .setEmoji('🔄')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        return [row1, row2];
    }
    
    // Create control buttons (2 rows for more options)
    const row1 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('np_previous')
                .setLabel('Previous')
                .setEmoji(client.config.emojis?.previous?.match(/:(\d+)>/)?.[1] || '⏮️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(player.queue.previous.length === 0),
            new ButtonBuilder()
                .setCustomId('np_pause')
                .setLabel('Pause')
                .setEmoji(client.config.emojis?.pause?.match(/:(\d+)>/)?.[1] || '⏸️')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(player.paused),
            new ButtonBuilder()
                .setCustomId('np_resume')
                .setLabel('Resume')
                .setEmoji(client.config.emojis?.play?.match(/:(\d+)>/)?.[1] || '▶️')
                .setStyle(ButtonStyle.Success)
                .setDisabled(!player.paused),
            new ButtonBuilder()
                .setCustomId('np_skip')
                .setLabel('Skip')
                .setEmoji(client.config.emojis?.skip?.match(/:(\d+)>/)?.[1] || '⏭️')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(player.queue.tracks.length === 0),
            new ButtonBuilder()
                .setCustomId('np_stop')
                .setLabel('Stop')
                .setEmoji(client.config.emojis?.stop?.match(/:(\d+)>/)?.[1] || '⏹️')
                .setStyle(ButtonStyle.Danger)
        );
    
    const loopText = player.repeatMode === 'off' ? 'Off' : player.repeatMode === 'track' ? 'Track' : 'Queue';
    const loopEmojiId = player.repeatMode === 'track' 
        ? null
        : (client.config.emojis?.loop?.match(/:(\d+)>/)?.[1] || null);
    
    const loopButton = new ButtonBuilder()
        .setCustomId('np_loop')
        .setLabel(`Loop: ${loopText}`)
        .setStyle(player.repeatMode === 'off' ? ButtonStyle.Secondary : ButtonStyle.Success);
    
    if (loopEmojiId) {
        loopButton.setEmoji(loopEmojiId);
    } else if (player.repeatMode === 'track') {
        loopButton.setEmoji('🔂');
    } else {
        loopButton.setEmoji('🔁');
    }
    
    const row2 = new ActionRowBuilder()
        .addComponents(
            loopButton,
            new ButtonBuilder()
                .setCustomId('np_shuffle')
                .setLabel('Shuffle')
                .setEmoji(client.config.emojis?.shuffle?.match(/:(\d+)>/)?.[1] || '🔀')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(player.queue.tracks.length < 2),
            new ButtonBuilder()
                .setCustomId('np_queue')
                .setLabel('View Queue')
                .setEmoji(client.config.emojis?.queue?.match(/:(\d+)>/)?.[1] || '📜')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('np_lyrics')
                .setLabel('Lyrics')
                .setEmoji(client.config.emojis?.cloudnote?.match(/:(\d+)>/)?.[1] || '📝')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('np_refresh')
                .setLabel('Refresh')
                .setEmoji(client.config.emojis?.refresh?.match(/:(\d+)>/)?.[1] || '🔄')
                .setStyle(ButtonStyle.Secondary)
        );
    
    return [row1, row2];
}

function createProgressBar(current, total, length = 20, emojis = {}) {
    const progress = Math.min(Math.round((current / total) * length), length);
    const emptyProgress = length - progress;
    
    // Use custom progress bar emojis if available
    if (emojis.startingfillbar && emojis.middlefillbar && emojis.middledotfillbar && 
        emojis.emptymiddlebar && emojis.emptyendbar) {
        
        let progressBar = '';
        
        for (let i = 0; i < length; i++) {
            if (i < progress - 1) {
                // Filled sections before the current position
                if (i === 0) {
                    progressBar += emojis.startingfillbar;
                } else {
                    progressBar += emojis.middlefillbar;
                }
            } else if (i === progress - 1) {
                // Current position indicator
                progressBar += emojis.middledotfillbar;
            } else if (i === progress && progress < length) {
                // Empty section right after current position
                progressBar += emojis.emptymiddlebar;
            } else {
                // Remaining empty sections
                if (i === length - 1) {
                    progressBar += emojis.emptyendbar;
                } else {
                    progressBar += emojis.emptymiddlebar;
                }
            }
        }
        
        return progressBar;
    }
    
    // Fallback to original progress bar
    const progressBar = '▰'.repeat(progress) + '🔘' + '▱'.repeat(emptyProgress);
    return `\`${progressBar}\``;
}

function createProgressBarLine(current, total) {
    const barLength = 30;
    const filledLength = Math.min(Math.round((current / total) * barLength), barLength);
    const emptyLength = barLength - filledLength;
    
    const bar = '━'.repeat(filledLength) + '◉' + '─'.repeat(emptyLength);
    return bar;
}

function formatTime(ms) {
    if (!ms || ms === 0) return '0:00';
    
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor(ms / (1000 * 60 * 60));
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function getPlatformEmoji(url, emojis) {
    if (!url) return emojis?.melody || emojis?.note1;
    
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
        return emojis?.youtube || emojis?.play;
    } else if (url.includes('spotify.com')) {
        return emojis?.spotify || emojis?.note2;
    } else if (url.includes('soundcloud.com')) {
        return emojis?.soundcloud || emojis?.cloudnote;
    } else if (url.includes('apple.com')) {
        return emojis?.applemusic || emojis?.note3;
    } else if (url.includes('deezer.com')) {
        return emojis?.deezer || emojis?.note4;
    } else if (url.includes('bandcamp.com')) {
        return emojis?.disk || emojis?.cloudnote;
    } else if (url.includes('twitch.tv')) {
        return emojis?.source || emojis?.control;
    }
    
    return emojis?.melody || emojis?.note1;
}

function getPlatformName(url) {
    if (!url) return 'Unknown';
    
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
        return 'YouTube';
    } else if (url.includes('spotify.com')) {
        return 'Spotify';
    } else if (url.includes('soundcloud.com')) {
        return 'SoundCloud';
    } else if (url.includes('bandcamp.com')) {
        return 'Bandcamp';
    } else if (url.includes('twitch.tv')) {
        return 'Twitch';
    }
    
    return 'Direct Link';
}

function truncateString(str, maxLength) {
    if (!str) return 'Unknown Track';
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + '...';
}

function formatRequester(requester) {
    if (!requester) return 'Unknown';
    
    // Just return the requester as-is without any formatting
    return String(requester);
}
