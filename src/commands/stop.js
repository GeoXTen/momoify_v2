import { SlashCommandBuilder } from 'discord.js';
import { validatePlayerCommand, createSuccessEmbed } from '../utils/commandHelpers.js';

export default {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Stop the music and clear the queue'),
    
    async execute(interaction, client) {
        // Validate player and user permissions
        const { player, error } = validatePlayerCommand(interaction, client);
        if (error) {
            return interaction.reply({ embeds: [error], flags: 64 });
        }
        
        // Defer reply for stop operation
        await interaction.deferReply();
        
        // Clear voice channel status before destroying player
        try {
            await client.rest.put(
                `/channels/${player.voiceChannelId}/voice-status`,
                { body: { status: '' } }
            ).catch(() => {});
        } catch (error) {
            // Ignore error
        }
        
        await player.destroy();
        
        await interaction.editReply({
            embeds: [createSuccessEmbed(
                client,
                `${client.config.emojis.stop} Stopped the music and disconnected from the voice channel`
            )]
        });
    }
};
