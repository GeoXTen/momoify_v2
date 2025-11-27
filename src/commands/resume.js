import { SlashCommandBuilder } from 'discord.js';
import { validatePlayerCommand, createSuccessEmbed, createErrorEmbed } from '../utils/commandHelpers.js';

export default {
    data: new SlashCommandBuilder()
        .setName('resume')
        .setDescription('Resume the paused song'),
    
    async execute(interaction, client) {
        // Validate player and user permissions
        const { player, error } = validatePlayerCommand(interaction, client);
        if (error) {
            return interaction.reply({ embeds: [error], flags: 64 });
        }
        
        // Check if there's a current track
        if (!player.queue.current) {
            return interaction.reply({
                embeds: [createErrorEmbed(client, `${client.config.emojis.error} There's nothing playing right now!`)],
                flags: 64
            });
        }
        
        // Check if already playing
        if (!player.paused) {
            return interaction.reply({
                embeds: [{
                    color: client.config.colors.warning,
                    description: `${client.config.emojis.play} Music is already playing!`
                }],
                flags: 64
            });
        }
        
        // Save position for fallback
        const savedPosition = player.position;
        
        try {
            // Try to resume with pause(false)
            await player.pause(false);
            
            // Wait for state to update
            await new Promise(resolve => setTimeout(resolve, 100));
            
            await interaction.reply({
                embeds: [createSuccessEmbed(client, `${client.config.emojis.play} Resumed the music`)]
            });
        } catch (error) {
            console.error('Resume failed:', error.message);
            
            // Fallback: play and seek back to position
            try {
                if (player.queue.current) {
                    await player.play();
                    
                    // Seek back to saved position if we had one
                    if (savedPosition > 0) {
                        await new Promise(resolve => setTimeout(resolve, 200));
                        await player.seek(savedPosition);
                    }
                    
                    await interaction.reply({
                        embeds: [createSuccessEmbed(client, `${client.config.emojis.play} Resumed the music (fallback)`)]
                    });
                } else {
                    throw new Error('No current track to resume');
                }
            } catch (fallbackError) {
                console.error('Fallback also failed:', fallbackError.message);
                return interaction.reply({
                    embeds: [{
                        color: client.config.colors.error,
                        description: `${client.config.emojis.error} Failed to resume playback: ${fallbackError.message}`
                    }],
                    flags: 64
                });
            }
        }
    }
};
