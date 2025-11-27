import { SlashCommandBuilder } from 'discord.js';
import { validatePlayerCommand, createSuccessEmbed } from '../utils/commandHelpers.js';

export default {
    data: new SlashCommandBuilder()
        .setName('loop')
        .setDescription('Set the loop mode')
        .addStringOption(option =>
            option.setName('mode')
                .setDescription('Loop mode')
                .setRequired(true)
                .addChoices(
                    { name: 'Off', value: 'off' },
                    { name: 'Track', value: 'track' },
                    { name: 'Queue', value: 'queue' }
                )
        ),
    
    async execute(interaction, client) {
        // Validate player and user permissions
        const { player, error } = validatePlayerCommand(interaction, client);
        if (error) {
            return interaction.reply({ embeds: [error], flags: 64 });
        }
        
        const mode = interaction.options.getString('mode');
        await player.setRepeatMode(mode);
        
        const modeText = mode === 'off' ? 'Off' : mode === 'track' ? 'Track' : 'Queue';
        
        await interaction.reply({
            embeds: [createSuccessEmbed(
                client,
                `${client.config.emojis.loop} Loop mode set to **${modeText}**`
            )]
        });
    }
};
