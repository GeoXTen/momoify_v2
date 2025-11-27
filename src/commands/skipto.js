import { SlashCommandBuilder } from 'discord.js';
import { validatePlayerCommand, validateQueue, createSuccessEmbed, createErrorEmbed } from '../utils/commandHelpers.js';
import { createNowPlayingEmbed, createNowPlayingButtons } from '../utils/nowPlayingUtils.js';

export default {
    data: new SlashCommandBuilder()
        .setName('skipto')
        .setDescription('Skip to a specific song in the queue')
        .addIntegerOption(option =>
            option.setName('position')
                .setDescription('Queue position to skip to (1 = first song)')
                .setRequired(true)
                .setMinValue(1)
        ),
    
    async execute(interaction, client) {
        const { player, error } = validatePlayerCommand(interaction, client);
        if (error) {
            return interaction.reply({ embeds: [error], flags: 64 });
        }
        
        const queueError = validateQueue(player, client);
        if (queueError) {
            return interaction.reply({ embeds: [queueError], flags: 64 });
        }
        
        const position = interaction.options.getInteger('position');
        
        if (position === null || isNaN(position) || position < 1) {
            return interaction.reply({
                embeds: [createErrorEmbed(
                    client,
                    `${client.config.emojis.error} Please provide a valid queue position (1 or higher)!`
                )],
                flags: 64
            });
        }
        
        // Validate position
        if (position > player.queue.tracks.length) {
            return interaction.reply({
                embeds: [createErrorEmbed(
                    client,
                    `${client.config.emojis.error} Invalid position! The queue has only **${player.queue.tracks.length}** songs.`
                )],
                flags: 64
            });
        }
        
        await interaction.deferReply();
        
        const current = player.queue.current;
        const targetTrack = player.queue.tracks[position - 1];
        
        // Remove all tracks before the target position
        if (position > 1) {
            player.queue.tracks.splice(0, position - 1);
        }
        
        // Skip to the target track
        await player.skip();
        
        // Wait for new track to start
        await new Promise(resolve => setTimeout(resolve, 500));
        
        if (player.queue.current) {
            const nowPlayingEmbed = createNowPlayingEmbed(player, client);
            const nowPlayingButtons = createNowPlayingButtons(player, client);
            
            await interaction.editReply({
                content: `${client.config.emojis.skip} Skipped **${position}** song${position > 1 ? 's' : ''} to **${targetTrack.info.title}**`,
                embeds: [nowPlayingEmbed],
                components: nowPlayingButtons
            });
        } else {
            await interaction.editReply({
                embeds: [createSuccessEmbed(
                    client,
                    `${client.config.emojis.skip} Skipped to position **${position}**`
                )]
            });
        }
    }
};
