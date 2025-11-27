import { SlashCommandBuilder } from 'discord.js';
import { validatePlayerCommand, createSuccessEmbed } from '../utils/commandHelpers.js';

export default {
    data: new SlashCommandBuilder()
        .setName('pause')
        .setDescription('Pause or resume the current song'),
    
    async execute(interaction, client) {
        // Validate player and user permissions
        const { player, error } = validatePlayerCommand(interaction, client);
        if (error) {
            return interaction.reply({ embeds: [error], flags: 64 });
        }
        
        // Check if there's a current track
        if (!player.queue.current) {
            return interaction.reply({
                embeds: [{
                    color: client.config.colors.error,
                    description: `${client.config.emojis.error} There's nothing playing right now!`
                }],
                flags: 64
            });
        }
        
        // Toggle pause state with error handling
        try {
            const targetState = !player.paused;
            await player.pause(targetState);
            
            // Wait for state to update
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Send success message
            const description = player.paused 
                ? `${client.config.emojis.pause} Paused the music` 
                : `${client.config.emojis.play} Resumed the music`;
            
            await interaction.reply({
                embeds: [createSuccessEmbed(client, description)]
            });
        } catch (error) {
            console.error('Pause toggle error:', error.message);
            return interaction.reply({
                embeds: [{
                    color: client.config.colors.error,
                    description: `${client.config.emojis.error} Failed to toggle pause: ${error.message}`
                }],
                flags: 64
            });
        }
    }
};
