import { EmbedBuilder } from 'discord.js';

/**
 * Validates if user is in a voice channel
 * @param {Object} interaction - Discord interaction
 * @param {Object} client - Discord client
 * @returns {Object|null} - Returns error embed if validation fails, null if success
 */
export function validateVoiceChannel(interaction, client) {
    if (!interaction.guild) {
        return {
            color: client.config.colors.error,
            description: `${client.config.emojis.error} This command can only be used in a server!`
        };
    }
    
    const member = interaction.guild.members.cache.get(interaction.user.id);
    
    if (!member || !member.voice || !member.voice.channel) {
        return {
            color: client.config.colors.error,
            description: `${client.config.emojis.error} You need to be in a voice channel to use this command!`
        };
    }
    
    return null;
}

/**
 * Validates if player exists
 * @param {Object} interaction - Discord interaction
 * @param {Object} client - Discord client
 * @returns {Object} - { player, error } - error is embed object if validation fails
 */
export function validatePlayer(interaction, client) {
    const player = client.lavalink.getPlayer(interaction.guildId);
    
    if (!player) {
        return {
            player: null,
            error: {
                color: client.config.colors.error,
                description: `${client.config.emojis.error} No active player found! Use \`/play\` to start playing music.`
            }
        };
    }
    
    return { player, error: null };
}

/**
 * Validates if user is in same voice channel as bot
 * @param {Object} interaction - Discord interaction
 * @param {Object} player - Lavalink player
 * @param {Object} client - Discord client
 * @returns {Object|null} - Returns error embed if validation fails, null if success
 */
export function validateSameVoiceChannel(interaction, player, client) {
    if (!interaction.guild) {
        return {
            color: client.config.colors.error,
            description: `${client.config.emojis.error} This command can only be used in a server!`
        };
    }
    
    const member = interaction.guild.members.cache.get(interaction.user.id);
    
    if (!member || !member.voice || member.voice.channelId !== player.voiceChannelId) {
        return {
            color: client.config.colors.error,
            description: `${client.config.emojis.error} You need to be in the same voice channel as me!`
        };
    }
    
    return null;
}

/**
 * Combined validation for player commands (checks voice channel, player, and same channel)
 * @param {Object} interaction - Discord interaction
 * @param {Object} client - Discord client
 * @returns {Object} - { player, error } - error is embed object if validation fails
 */
export function validatePlayerCommand(interaction, client) {
    // Check if user is in voice channel
    const voiceError = validateVoiceChannel(interaction, client);
    if (voiceError) {
        return { player: null, error: voiceError };
    }
    
    // Check if player exists
    const { player, error: playerError } = validatePlayer(interaction, client);
    if (playerError) {
        return { player: null, error: playerError };
    }
    
    // Check if user is in same voice channel
    const sameChannelError = validateSameVoiceChannel(interaction, player, client);
    if (sameChannelError) {
        return { player: null, error: sameChannelError };
    }
    
    return { player, error: null };
}

/**
 * Creates a standard success embed
 * @param {Object} client - Discord client
 * @param {String} description - Embed description
 * @param {Object} options - Additional embed options
 * @returns {EmbedBuilder} - Embed builder instance
 */
export function createSuccessEmbed(client, description, options = {}) {
    const embed = new EmbedBuilder()
        .setColor(client.config.colors.success)
        .setDescription(description);
    
    if (options.title) embed.setTitle(options.title);
    if (options.fields) embed.addFields(options.fields);
    if (options.footer) embed.setFooter(options.footer);
    if (options.thumbnail) embed.setThumbnail(options.thumbnail);
    if (options.timestamp) embed.setTimestamp();
    
    return embed;
}

/**
 * Creates a standard error embed
 * @param {Object} client - Discord client
 * @param {String} description - Embed description
 * @param {Object} options - Additional embed options
 * @returns {EmbedBuilder} - Embed builder instance
 */
export function createErrorEmbed(client, description, options = {}) {
    const embed = new EmbedBuilder()
        .setColor(client.config.colors.error)
        .setDescription(description);
    
    if (options.title) embed.setTitle(options.title);
    if (options.fields) embed.addFields(options.fields);
    if (options.footer) embed.setFooter(options.footer);
    if (options.timestamp) embed.setTimestamp();
    
    return embed;
}

/**
 * Creates a standard info embed
 * @param {Object} client - Discord client
 * @param {String} description - Embed description
 * @param {Object} options - Additional embed options
 * @returns {EmbedBuilder} - Embed builder instance
 */
export function createInfoEmbed(client, description, options = {}) {
    const embed = new EmbedBuilder()
        .setColor(client.config.colors.primary)
        .setDescription(description);
    
    if (options.title) embed.setTitle(options.title);
    if (options.fields) embed.addFields(options.fields);
    if (options.footer) embed.setFooter(options.footer);
    if (options.thumbnail) embed.setThumbnail(options.thumbnail);
    if (options.timestamp) embed.setTimestamp();
    
    return embed;
}

/**
 * Formats milliseconds to time string
 * @param {Number} ms - Milliseconds
 * @returns {String} - Formatted time string (mm:ss or h:mm:ss)
 */
export function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
        return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Safely replies to interaction (handles deferred state)
 * @param {Object} interaction - Discord interaction
 * @param {Object} options - Reply options
 */
export async function safeReply(interaction, options) {
    if (interaction.deferred) {
        return await interaction.editReply(options);
    } else if (!interaction.replied) {
        return await interaction.reply(options);
    }
}

/**
 * Validates if queue has tracks
 * @param {Object} player - Lavalink player
 * @param {Object} client - Discord client
 * @returns {Object|null} - Returns error embed if validation fails, null if success
 */
export function validateQueue(player, client) {
    if (!player.queue.tracks.length) {
        return {
            color: client.config.colors.error,
            description: `${client.config.emojis.error} The queue is empty!`
        };
    }
    
    return null;
}

/**
 * Validates if track is currently playing
 * @param {Object} player - Lavalink player
 * @param {Object} client - Discord client
 * @returns {Object|null} - Returns error embed if validation fails, null if success
 */
export function validateCurrentTrack(player, client) {
    if (!player.queue.current) {
        return {
            color: client.config.colors.error,
            description: `${client.config.emojis.error} No track is currently playing!`
        };
    }
    
    return null;
}
