import { SlashCommandBuilder } from 'discord.js';
import { validatePlayerCommand, validateQueue, createSuccessEmbed } from '../utils/commandHelpers.js';

export default {
    data: new SlashCommandBuilder()
        .setName('shuffle')
        .setDescription('Shuffle the queue'),
    
    async execute(interaction, client) {
        // Validate player and user permissions
        const { player, error } = validatePlayerCommand(interaction, client);
        if (error) {
            return interaction.reply({ embeds: [error], flags: 64 });
        }
        
        // Validate queue has tracks
        const queueError = validateQueue(player, client);
        if (queueError) {
            return interaction.reply({ embeds: [queueError], flags: 64 });
        }
        
        player.queue.shuffle();
        
        await interaction.reply({
            embeds: [createSuccessEmbed(
                client,
                `${client.config.emojis.shuffle} Shuffled **${player.queue.tracks.length}** tracks in the queue`
            )]
        });
    }
};
