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
    
    const e = client.config.emojis;
    const position = player.position;
    const duration = track.info.duration;
    const percentage = Math.min((position / duration) * 100, 100);
    const remaining = duration - position;
    
    // Create visual progress bar
    const progressBar = createAdvancedProgressBar(position, duration, 15, e);
    
    // Status indicators
    const statusEmoji = player.paused ? (e.pause || '⏸️') : (e.play || '▶️');
    const statusText = player.paused ? 'PAUSED' : 'NOW PLAYING';
    
    // Loop mode
    const loopModes = { off: '➡️ Off', track: '🔂 Track', queue: '🔁 Queue' };
    const loopDisplay = loopModes[player.repeatMode] || loopModes.off;
    
    // Get platform info
    const platform = getPlatformInfo(track.info.uri);
    
    // Check for autoplay
    let autoplayStatus = '';
    try {
        const autoplayModule = require('../commands/autoplay.js');
        if (autoplayModule.isAutoplayEnabled && autoplayModule.isAutoplayEnabled(player.guildId)) {
            autoplayStatus = `${e.loop || '🔄'} Autoplay`;
        }
    } catch {}
    
    // Check for filters
    const activeFilters = getActiveFilters(player);
    
    // Volume bar
    const volumeBar = createVolumeBar(player.volume);
    
    // Up next preview
    let upNextText = '';
    if (player.queue.tracks.length > 0) {
        const next = player.queue.tracks[0];
        upNextText = `\n\n${e.skip || '⏭️'} **Up Next:** ${truncateString(next.info.title, 40)}`;
    } else if (autoplayStatus) {
        upNextText = `\n\n${e.stars || '✨'} **Up Next:** Autoplay will find similar tracks`;
    }
    
    // Build description
    const description = [
        `${statusEmoji} **${statusText}**`,
        ``,
        `${e.headphone || '🎧'} **${track.info.author}**`,
        ``,
        `\`${formatTime(position)}\` ${progressBar} \`${formatTime(duration)}\``,
        ``,
        `${e.volume || '🔊'} ${volumeBar} \`${player.volume}%\``,
        ``,
        `${platform.emoji} ${platform.name} • ${loopDisplay}${activeFilters ? ` • ${activeFilters}` : ''}${autoplayStatus ? ` • ${autoplayStatus}` : ''}`,
        upNextText
    ].join('\n');
    
    // Get artwork URL
    const artworkUrl = track.info.artworkUrl || 
        (track.info.uri?.includes('youtube') && track.info.identifier 
            ? `https://img.youtube.com/vi/${track.info.identifier}/maxresdefault.jpg` 
            : null);
    
    const embed = new EmbedBuilder()
        .setColor(player.paused ? client.config.colors.warning : client.config.colors.primary)
        .setAuthor({ 
            name: `${e.melody || '🎵'} Music Player`,
            iconURL: client.user.displayAvatarURL()
        })
        .setTitle(truncateString(track.info.title, 60))
        .setURL(track.info.uri)
        .setDescription(description);
    
    // Use large image for better visual
    if (artworkUrl) {
        embed.setImage(artworkUrl);
    }
    
    // Add fields
    embed.addFields(
        {
            name: `${e.headphone || '👤'} Requested By`,
            value: track.requester ? formatRequester(track.requester) : 'Unknown',
            inline: true
        },
        {
            name: `${e.time || '⏱️'} Remaining`,
            value: `\`${formatTime(remaining)}\``,
            inline: true
        },
        {
            name: `${e.queue || '📜'} Queue`,
            value: `\`${player.queue.tracks.length}\` tracks`,
            inline: true
        }
    );
    
    // Footer with more info
    const isLive = track.info.isStream;
    const footerParts = [];
    if (isLive) footerParts.push('🔴 LIVE');
    footerParts.push(`${Math.round(percentage)}% complete`);
    
    
    embed.setFooter({ 
        text: footerParts.join(' • '),
        iconURL: client.user.displayAvatarURL()
    });
    
    return embed;
}

export function createNowPlayingButtons(player, client) {
    const getEmoji = (name, fallback) => {
        if (!client?.config?.emojis?.[name]) return fallback;
        const match = client.config.emojis[name].match(/:(\d+)>/);
        return match ? match[1] : fallback;
    };
    
    // Row 1: Main playback controls
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('np_previous')
            .setEmoji(getEmoji('previous', '⏮️'))
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(player.queue.previous.length === 0),
        new ButtonBuilder()
            .setCustomId(player.paused ? 'np_resume' : 'np_pause')
            .setEmoji(player.paused ? getEmoji('play', '▶️') : getEmoji('pause', '⏸️'))
            .setStyle(player.paused ? ButtonStyle.Success : ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('np_stop')
            .setEmoji(getEmoji('stop', '⏹️'))
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('np_skip')
            .setEmoji(getEmoji('skip', '⏭️'))
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(player.queue.tracks.length === 0),
        new ButtonBuilder()
            .setCustomId('np_loop')
            .setEmoji(player.repeatMode === 'track' ? '🔂' : player.repeatMode === 'queue' ? '🔁' : '➡️')
            .setStyle(player.repeatMode === 'off' ? ButtonStyle.Secondary : ButtonStyle.Success)
    );
    
    // Row 2: Volume and seek controls
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('np_voldown')
            .setEmoji('🔉')
            .setLabel('-10')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(player.volume <= 0),
        new ButtonBuilder()
            .setCustomId('np_volup')
            .setEmoji('🔊')
            .setLabel('+10')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(player.volume >= 200),
        new ButtonBuilder()
            .setCustomId('np_seekback')
            .setEmoji('⏪')
            .setLabel('-10s')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('np_seekforward')
            .setEmoji('⏩')
            .setLabel('+10s')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('np_shuffle')
            .setEmoji(getEmoji('shuffle', '🔀'))
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(player.queue.tracks.length < 2)
    );
    
    // Row 3: Additional features
    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('np_queue')
            .setEmoji(getEmoji('queue', '📜'))
            .setLabel('Queue')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('np_lyrics')
            .setEmoji('📝')
            .setLabel('Lyrics')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('np_filters')
            .setEmoji('🎛️')
            .setLabel('Filters')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('np_save')
            .setEmoji('💾')
            .setLabel('Save')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('np_refresh')
            .setEmoji(getEmoji('refresh', '🔄'))
            .setStyle(ButtonStyle.Primary)
    );
    
    return [row1, row2, row3];
}

function createAdvancedProgressBar(current, total, length = 15, emojis = {}) {
    const progress = Math.min(Math.round((current / total) * length), length);
    const emptyProgress = length - progress;
    
    // Use custom emoji progress bar if available
    if (emojis.startingfillbar && emojis.middlefillbar && emojis.middledotfillbar && 
        emojis.emptymiddlebar && emojis.emptyendbar) {
        let bar = '';
        for (let i = 0; i < length; i++) {
            if (i < progress - 1) {
                bar += i === 0 ? emojis.startingfillbar : emojis.middlefillbar;
            } else if (i === progress - 1) {
                bar += emojis.middledotfillbar;
            } else {
                bar += i === length - 1 ? emojis.emptyendbar : emojis.emptymiddlebar;
            }
        }
        return bar;
    }
    
    // Modern progress bar style
    const filled = '▓'.repeat(progress);
    const empty = '░'.repeat(emptyProgress);
    return `\`${filled}⚪${empty}\``;
}

function createVolumeBar(volume, length = 10) {
    const filled = Math.round((volume / 100) * length);
    const empty = length - filled;
    
    let icon = '🔈';
    if (volume === 0) icon = '🔇';
    else if (volume < 50) icon = '🔉';
    else icon = '🔊';
    
    return `\`[${'█'.repeat(Math.min(filled, length))}${'░'.repeat(Math.max(empty, 0))}]\``;
}

function getPlatformInfo(url) {
    if (!url) return { emoji: '🎵', name: 'Unknown' };
    
    const platforms = {
        'youtube.com': { emoji: '📺', name: 'YouTube' },
        'youtu.be': { emoji: '📺', name: 'YouTube' },
        'spotify.com': { emoji: '💚', name: 'Spotify' },
        'soundcloud.com': { emoji: '🟠', name: 'SoundCloud' },
        'deezer.com': { emoji: '💜', name: 'Deezer' },
        'music.apple.com': { emoji: '🍎', name: 'Apple Music' },
        'bandcamp.com': { emoji: '🎸', name: 'Bandcamp' },
        'twitch.tv': { emoji: '💜', name: 'Twitch' },
        'vimeo.com': { emoji: '🔵', name: 'Vimeo' }
    };
    
    for (const [domain, info] of Object.entries(platforms)) {
        if (url.includes(domain)) return info;
    }
    
    return { emoji: '🌐', name: 'Direct Link' };
}

function getActiveFilters(player) {
    const filters = [];
    
    try {
        const filterData = player.filterManager?.filters || player.filters;
        
        if (filterData?.equalizer?.length > 0) filters.push('EQ');
        if (filterData?.timescale) {
            if (filterData.timescale.speed !== 1) filters.push('Speed');
            if (filterData.timescale.pitch !== 1) filters.push('Pitch');
        }
        if (filterData?.karaoke) filters.push('Karaoke');
        if (filterData?.tremolo) filters.push('Tremolo');
        if (filterData?.vibrato) filters.push('Vibrato');
        if (filterData?.rotation) filters.push('8D');
        if (filterData?.lowPass) filters.push('LowPass');
    } catch {}
    
    if (filters.length === 0) return null;
    return `🎛️ ${filters.join(', ')}`;
}

function createProgressBar(current, total, length = 20, emojis = {}) {
    return createAdvancedProgressBar(current, total, length, emojis);
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
