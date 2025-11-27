import { SlashCommandBuilder } from 'discord.js';
import { createNowPlayingEmbed, createNowPlayingButtons } from '../utils/nowPlayingUtils.js';

export default {
    data: new SlashCommandBuilder()
        .setName('nowplaying')
        .setDescription('Show the currently playing song with advanced controls'),
    
    async execute(interaction, client) {
        try {
            await interaction.deferReply();
        } catch (error) {
            console.error('Failed to defer reply:', error.message);
            return;
        }
        
        const player = client.lavalink.getPlayer(interaction.guildId);
        
        if (!player || !player.queue.current) {
            return interaction.editReply({
                embeds: [{
                    color: client.config.colors.error,
                    description: `${client.config.emojis.error} **Nothing is playing right now!**\n\nUse \`/play <song>\` to start listening to music.`
                }]
            });
        }
        
        const embed = createNowPlayingEmbed(player, client);
        const buttons = createNowPlayingButtons(player, client);
        
        await interaction.editReply({
            embeds: [embed],
            components: buttons
        });
    }
};
