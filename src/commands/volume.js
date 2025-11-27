import { SlashCommandBuilder } from 'discord.js';
import { validatePlayerCommand, createSuccessEmbed } from '../utils/commandHelpers.js';

export default {
    data: new SlashCommandBuilder()
        .setName('volume')
        .setDescription('Set the player volume')
        .addIntegerOption(option =>
            option.setName('level')
                .setDescription('Volume level (0-200)')
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(200)
        ),
    
    async execute(interaction, client) {
        // Validate player and user permissions
        const { player, error } = validatePlayerCommand(interaction, client);
        if (error) {
            return interaction.reply({ embeds: [error], flags: 64 });
        }
        
        const volume = interaction.options.getInteger('level');
        
        // Check if volume is null or invalid
        if (volume === null || volume === undefined) {
            return interaction.reply({
                content: '❌ Please provide a valid volume level (0-200)',
                flags: 64
            });
        }
        
        await player.setVolume(volume);
        
        const volumeEmoji = volume === 0 ? '🔇' : volume < 50 ? '🔉' : '🔊';
        
        await interaction.reply({
            embeds: [createSuccessEmbed(
                client,
                `${volumeEmoji} Volume set to **${volume}%**`
            )]
        });
    }
};
