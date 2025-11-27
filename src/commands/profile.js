import { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { statsCache } from '../utils/statsCache.js';

// Format time
function formatTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
}

export default {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('View your music listening profile')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to view (leave empty for yourself)')
        ),
    
    async execute(interaction, client) {
        await interaction.deferReply();
        
        // Handle both slash commands and text commands
        let targetUser;
        if (interaction.options?.getUser) {
            // Slash command
            targetUser = interaction.options.getUser('user') || interaction.user;
        } else {
            // Text command - check for mentioned user
            const mention = interaction.message?.mentions?.users?.first();
            targetUser = mention || interaction.user;
        }
        
        const userId = targetUser.id;
        
        const stats = await statsCache.loadStats();
        const trackStats = await statsCache.loadTrackStats();
        
        const userStats = stats.users?.[userId];
        const userTracks = trackStats.users?.[userId];
        
        if (!userStats) {
            return interaction.editReply({
                embeds: [{
                    color: client.config.colors.warning,
                    description: `${client.config.emojis.warning} ${targetUser.id === interaction.user.id ? 'You haven\'t' : 'This user hasn\'t'} listened to any music yet!`
                }]
            });
        }
        
        // Calculate total stats
        let totalTracks = 0;
        let totalMinutes = 0;
        for (const guildStats of Object.values(userStats)) {
            totalTracks += guildStats.tracks || 0;
            totalMinutes += guildStats.minutes || 0;
        }
        
        // TOP SERVERS - Sort guilds by listening time
        const topServers = [];
        for (const [guildId, guildStats] of Object.entries(userStats)) {
            const guild = client.guilds.cache.get(guildId);
            if (guild) {
                topServers.push({
                    name: guild.name,
                    minutes: guildStats.minutes || 0
                });
            }
        }
        topServers.sort((a, b) => b.minutes - a.minutes);
        
        // TOP TRACKS - Get most played tracks
        const topTracks = [];
        if (userTracks) {
            for (const [trackId, trackData] of Object.entries(userTracks)) {
                topTracks.push({
                    title: trackData.title,
                    artist: trackData.artist,
                    playCount: trackData.playCount,
                    duration: trackData.totalMinutes || 0
                });
            }
        }
        
        // Sort by play count for "Most Played"
        const mostPlayed = [...topTracks].sort((a, b) => b.playCount - a.playCount);
        
        // Sort by duration for "Most Listened"
        const mostListened = [...topTracks].sort((a, b) => b.duration - a.duration);
        
        // Build embed
        const embed = new EmbedBuilder()
            .setColor(client.config.colors.primary)
            .setAuthor({
                name: `${targetUser.username}'s Music Profile`,
                iconURL: targetUser.displayAvatarURL()
            })
            .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
            .setDescription(
                `${client.config.emojis.music} **Total Listening Time:** ${formatTime(totalMinutes)}\n` +
                `${client.config.emojis.note} **Total Tracks Played:** ${totalTracks.toLocaleString()}`
            );
        
        // TOP SERVERS field
        if (topServers.length > 0) {
            const serverList = topServers.slice(0, 3).map((server, i) => {
                return `**${i + 1}** ${formatTime(server.minutes)} · ${server.name}`;
            }).join('\n');
            
            embed.addFields({
                name: '🏆 TOP SERVERS',
                value: serverList || 'No data',
                inline: false
            });
        }
        
        // MOST PLAYED TRACKS field (by play count)
        if (mostPlayed.length > 0) {
            const playedList = mostPlayed.slice(0, 3).map((track, i) => {
                return `**${i + 1}** ${track.playCount}x · ${track.title}`;
            }).join('\n');
            
            embed.addFields({
                name: '🔥 MOST PLAYED',
                value: playedList || 'No data',
                inline: false
            });
        }
        
        // MOST LISTENED TRACKS field (by duration)
        if (mostListened.length > 0) {
            const listenedList = mostListened.slice(0, 3).map((track, i) => {
                return `**${i + 1}** ${formatTime(track.duration)} · ${track.title}`;
            }).join('\n');
            
            embed.addFields({
                name: '🎵 MOST LISTENED',
                value: listenedList || 'No data',
                inline: false
            });
        }
        
        embed.setFooter({
            text: `${client.config.botName} Music Stats`,
            iconURL: client.user.displayAvatarURL()
        })
        .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
    }
};
