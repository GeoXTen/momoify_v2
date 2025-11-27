import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { statsCache } from '../utils/statsCache.js';

export default {
    data: new SlashCommandBuilder()
        .setName('leaderboardglobal')
        .setDescription('View global music listening leaderboard across all servers')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Sort by tracks or time')
                .addChoices(
                    { name: 'Tracks Played', value: 'tracks' },
                    { name: 'Time Listened', value: 'time' }
                )
        ),
    
    async execute(interaction, client) {
        await interaction.deferReply();
        
        // This command is for GLOBAL leaderboard only
        const scope = 'global';
        
        // Handle both slash commands and text commands
        let type;
        if (interaction.options?.getString) {
            // Slash command
            type = interaction.options.getString('type') || 'tracks';
        } else {
            // Text command - parse args
            const args = interaction.args || [];
            type = args[0]?.toLowerCase() === 'time' ? 'time' : 'tracks';
        }
        
        const stats = await statsCache.loadStats();
        
        // Build leaderboard data
        const leaderboard = [];
        
        for (const [userId, guilds] of Object.entries(stats.users || {})) {
            // Global stats (sum across all guilds)
            let totalTracks = 0;
            let totalMinutes = 0;
            for (const guildStats of Object.values(guilds)) {
                totalTracks += guildStats.tracks || 0;
                totalMinutes += guildStats.minutes || 0;
            }
            leaderboard.push({
                userId,
                tracks: totalTracks,
                minutes: totalMinutes
            });
        }
        
        // Sort by chosen type
        const sortKey = type === 'tracks' ? 'tracks' : 'minutes';
        leaderboard.sort((a, b) => b[sortKey] - a[sortKey]);
        
        // Take top 10
        const top10 = leaderboard.slice(0, 10);
        
        if (top10.length === 0) {
            return interaction.editReply({
                embeds: [{
                    color: client.config.colors.warning,
                    description: `${client.config.emojis.warning} No listening data yet! Start playing some music!`
                }]
            });
        }
        
        // Build leaderboard text
        let description = '';
        for (let i = 0; i < top10.length; i++) {
            const entry = top10[i];
            
            // Skip invalid user IDs (like "[object Object]")
            if (!entry.userId || entry.userId.includes('object') || entry.userId === 'undefined') {
                continue;
            }
            
            const user = await client.users.fetch(entry.userId).catch(() => null);
            
            // Skip users that couldn't be fetched (deleted accounts, left server)
            if (!user) {
                continue;
            }
            
            const username = user.username;
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**${i + 1}.**`;
            
            if (type === 'tracks') {
                description += `${medal} **${username}** - ${entry.tracks.toLocaleString()} tracks\n`;
            } else {
                const hours = Math.floor(entry.minutes / 60);
                const mins = entry.minutes % 60;
                description += `${medal} **${username}** - ${hours}h ${mins}m\n`;
            }
        }
        
        // Find current user's rank
        const userIndex = leaderboard.findIndex(e => e.userId === interaction.user.id);
        let footer = '';
        if (userIndex !== -1) {
            const userEntry = leaderboard[userIndex];
            if (type === 'tracks') {
                footer = `Your global rank: #${userIndex + 1} with ${userEntry.tracks} tracks`;
            } else {
                const hours = Math.floor(userEntry.minutes / 60);
                const mins = userEntry.minutes % 60;
                footer = `Your global rank: #${userIndex + 1} with ${hours}h ${mins}m`;
            }
        } else {
            footer = 'You haven\'t listened to any music yet!';
        }
        
        const embed = new EmbedBuilder()
            .setColor(client.config.colors.primary)
            .setTitle(`${client.config.emojis.verified} Global Music Leaderboard`)
            .setDescription(description)
            .setFooter({ text: footer })
            .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
    }
};
