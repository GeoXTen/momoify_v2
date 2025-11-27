import { SlashCommandBuilder, MessageFlags } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('remove')
        .setDescription('Remove a song from the queue')
        .addIntegerOption(option =>
            option.setName('position')
                .setDescription('Position of the song in the queue')
                .setRequired(true)
                .setMinValue(1)
        ),
    
    async execute(interaction, client) {
        const player = client.lavalink.getPlayer(interaction.guildId);
        
        if (!player || player.queue.tracks.length === 0) {
            return interaction.reply({
                embeds: [{
                    color: client.config.colors.error,
                    description: `${client.config.emojis.error} The queue is empty!`
                }],
                flags: MessageFlags.Ephemeral
            });
        }
        
        const member = interaction.guild.members.cache.get(interaction.user.id);
        if (member.voice.channelId !== player.voiceChannelId) {
            return interaction.reply({
                embeds: [{
                    color: client.config.colors.error,
                    description: `${client.config.emojis.error} You need to be in the same voice channel as me!`
                }],
                flags: MessageFlags.Ephemeral
            });
        }
        
        const position = interaction.options.getInteger('position') - 1;
        
        if (position < 0 || position >= player.queue.tracks.length) {
            return interaction.reply({
                embeds: [{
                    color: client.config.colors.error,
                    description: `${client.config.emojis.error} Invalid position! Queue has ${player.queue.tracks.length} tracks`
                }],
                flags: MessageFlags.Ephemeral
            });
        }
        
        const removed = player.queue.tracks[position];
        player.queue.tracks.splice(position, 1);
        
        await interaction.reply({
            embeds: [{
                color: client.config.colors.success,
                description: `${client.config.emojis.success} Removed **[${removed.info.title}](${removed.info.uri})** from the queue`
            }]
        });
    }
};
