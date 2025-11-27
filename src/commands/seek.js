import { SlashCommandBuilder } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('seek')
        .setDescription('Seek to a specific position in the song')
        .addStringOption(option =>
            option.setName('position')
                .setDescription('Position to seek to (e.g., 30s, 1m, 1m30s, 1:30, or 90)')
                .setRequired(true)
        ),
    
    async execute(interaction, client) {
        const startTime = Date.now();
        
        // Defer reply immediately
        await interaction.deferReply();
        
        const player = client.lavalink.getPlayer(interaction.guildId);
        
        // Quick validation - fail fast
        if (!player?.queue.current) {
            return interaction.editReply({
                embeds: [{
                    color: client.config.colors.error,
                    description: `${client.config.emojis.error} Nothing is playing!`
                }]
            });
        }
        
        // Voice channel check
        const member = interaction.guild.members.cache.get(interaction.user.id);
        if (member.voice.channelId !== player.voiceChannelId) {
            return interaction.editReply({
                embeds: [{
                    color: client.config.colors.error,
                    description: `${client.config.emojis.error} You need to be in my voice channel!`
                }]
            });
        }
        
        // Parse position (optimized)
        const milliseconds = parsePosition(interaction.options.getString('position'));
        const trackDuration = player.queue.current.info.duration;
        
        if (milliseconds === null || milliseconds < 0) {
            return interaction.editReply({
                embeds: [{
                    color: client.config.colors.error,
                    description: `${client.config.emojis.error} Invalid position! Use: 30s, 1m30s, 1:30, or 90`
                }]
            });
        }
        
        if (milliseconds > trackDuration) {
            return interaction.editReply({
                embeds: [{
                    color: client.config.colors.error,
                    description: `${client.config.emojis.error} Position is beyond track duration! Track length: **${formatTime(trackDuration)}**`
                }]
            });
        }
        
        // Seek operation - fast and simple
        try {
            console.log(`[SEEK] Before seek:`.cyan);
            console.log(`  Track: ${player.queue.current.info.title}`.cyan);
            console.log(`  Duration: ${formatTime(trackDuration)}`.cyan);
            console.log(`  Current position: ${formatTime(player.position)}`.cyan);
            console.log(`  Queue size: ${player.queue.tracks.length}`.cyan);
            console.log(`  Seeking to: ${formatTime(milliseconds)}`.cyan);
            
            // Set seeking flag to prevent trackEnd events during seek
            player.isSeeking = true;
            
            await player.seek(milliseconds);
            
            // Wait for remote Lavalink to process seek (especially important for US servers)
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Clear seeking flag
            player.isSeeking = false;
            
            const totalTime = Date.now() - startTime;
            console.log(`[SEEK] After seek (${totalTime}ms):`.green);
            console.log(`  Player playing: ${player.playing}`.green);
            console.log(`  Player paused: ${player.paused}`.green);
            console.log(`  Current track exists: ${!!player.queue.current}`.green);
            console.log(`  New position: ${formatTime(player.position)}`.green);
            console.log(`  Queue size: ${player.queue.tracks.length}`.green);
            
            // Simple response
            await interaction.editReply({
                embeds: [{
                    color: client.config.colors.success,
                    description: `⏩ Seeked to **${formatTime(milliseconds)}**`
                }]
            });
        } catch (error) {
            // Clear seeking flag on error
            if (player) {
                player.isSeeking = false;
            }
            
            console.error('[SEEK] Error:'.red, error);
            await interaction.editReply({
                embeds: [{
                    color: client.config.colors.error,
                    description: `${client.config.emojis.error} Seek failed! Try again.`
                }]
            });
        }
    }
};

// Optimized position parser
function parsePosition(input) {
    if (!input) return null;
    
    // Format: 1:30 or 1:30:45
    if (input.includes(':')) {
        const parts = input.split(':').map(p => parseInt(p));
        if (parts.some(isNaN)) return null;
        
        if (parts.length === 2) {
            return (parts[0] * 60 + parts[1]) * 1000;
        }
        if (parts.length === 3) {
            return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
        }
        return null;
    }
    
    // Format: 1h30m45s
    if (/[hms]/.test(input)) {
        let ms = 0;
        const hours = input.match(/(\d+)h/);
        const minutes = input.match(/(\d+)m/);
        const seconds = input.match(/(\d+)s/);
        
        if (hours) ms += parseInt(hours[1]) * 3600000;
        if (minutes) ms += parseInt(minutes[1]) * 60000;
        if (seconds) ms += parseInt(seconds[1]) * 1000;
        
        return ms > 0 ? ms : null;
    }
    
    // Format: plain seconds (e.g., 90)
    const num = parseInt(input);
    return isNaN(num) ? null : num * 1000;
}

function formatTime(ms) {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor(ms / (1000 * 60 * 60));
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
