import { SlashCommandBuilder } from 'discord.js';
import { validatePlayerCommand, createSuccessEmbed, createErrorEmbed } from '../utils/commandHelpers.js';

export default {
    data: new SlashCommandBuilder()
        .setName('replay')
        .setDescription('Replay the current song from the beginning'),
    
    async execute(interaction, client) {
        const { player, error } = validatePlayerCommand(interaction, client);
        if (error) {
            return interaction.reply({ embeds: [error], flags: 64 });
        }
        
        if (!player.queue.current) {
            return interaction.reply({
                embeds: [createErrorEmbed(client, `${client.config.emojis.error} There's nothing playing right now!`)],
                flags: 64
            });
        }
        
        const track = player.queue.current;
        
        // Check if track is seekable
        if (track.info.isStream) {
            return interaction.reply({
                embeds: [{
                    color: client.config.colors.warning,
                    description: `${client.config.emojis.error} Can't replay a live stream!`
                }],
                flags: 64
            });
        }
        
        // Seek to the beginning
        await player.seek(0);
        
        await interaction.reply({
            embeds: [createSuccessEmbed(
                client,
                `${client.config.emojis.play} Replaying **[${track.info.title}](${track.info.uri})** from the beginning`
            )]
        });
    }
};
