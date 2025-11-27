import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('grab')
        .setDescription('Save the current song to your DMs'),
    
    async execute(interaction, client) {
        if (!interaction.guild) {
            return interaction.reply({
                embeds: [{
                    color: client.config.colors.error,
                    description: `${client.config.emojis.error} This command can only be used in a server!`
                }],
                flags: 64
            });
        }
        
        const player = client.lavalink?.getPlayer(interaction.guildId);
        
        if (!player || !player.queue.current) {
            return interaction.reply({
                embeds: [{
                    color: client.config.colors.error,
                    description: `${client.config.emojis.error} There's nothing playing right now!`
                }],
                flags: 64
            });
        }
        
        const track = player.queue.current;
        
        // Format duration
        const formatDuration = (ms) => {
            if (!ms) return 'Unknown';
            const seconds = Math.floor(ms / 1000);
            const hours = Math.floor(seconds / 3600);
            const mins = Math.floor((seconds % 3600) / 60);
            const secs = seconds % 60;
            
            if (hours > 0) {
                return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            }
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        };
        
        const embed = new EmbedBuilder()
            .setColor(client.config.colors.primary)
            .setTitle('🎵 Saved Song')
            .setDescription(`**[${track.info.title}](${track.info.uri})**`)
            .addFields(
                { name: '👤 Artist', value: track.info.author || 'Unknown', inline: true },
                { name: '⏱️ Duration', value: track.info.isStream ? '🔴 LIVE' : formatDuration(track.info.duration), inline: true },
                { name: '🔗 Source', value: track.info.sourceName || 'Unknown', inline: true }
            )
            .setTimestamp();
        
        if (interaction.guild?.name) {
            embed.setFooter({ text: `Grabbed from ${interaction.guild.name}` });
        }
        
        if (track.info.artworkUrl) {
            embed.setThumbnail(track.info.artworkUrl);
        }
        
        try {
            await interaction.user.send({ embeds: [embed] });
            
            await interaction.reply({
                embeds: [{
                    color: client.config.colors.success,
                    description: `${client.config.emojis.success} Check your DMs! I've sent you **${track.info.title}**`
                }],
                flags: 64
            });
        } catch (error) {
            await interaction.reply({
                embeds: [{
                    color: client.config.colors.error,
                    description: `${client.config.emojis.error} I couldn't send you a DM! Please enable DMs from server members.`
                }],
                flags: 64
            });
        }
    }
};
