import { SlashCommandBuilder, MessageFlags } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('move')
        .setDescription('Move a track to a different position in the queue')
        .addIntegerOption(option =>
            option.setName('from')
                .setDescription('Current position of the track')
                .setRequired(true)
                .setMinValue(1)
        )
        .addIntegerOption(option =>
            option.setName('to')
                .setDescription('New position for the track')
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
        
        const from = interaction.options.getInteger('from') - 1;
        const to = interaction.options.getInteger('to') - 1;
        
        if (from < 0 || from >= player.queue.tracks.length) {
            return interaction.reply({
                embeds: [{
                    color: client.config.colors.error,
                    description: `${client.config.emojis.error} Invalid 'from' position! Queue has ${player.queue.tracks.length} tracks`
                }],
                flags: MessageFlags.Ephemeral
            });
        }
        
        if (to < 0 || to >= player.queue.tracks.length) {
            return interaction.reply({
                embeds: [{
                    color: client.config.colors.error,
                    description: `${client.config.emojis.error} Invalid 'to' position! Queue has ${player.queue.tracks.length} tracks`
                }],
                flags: MessageFlags.Ephemeral
            });
        }
        
        const track = player.queue.tracks[from];
        player.queue.tracks.splice(from, 1);
        player.queue.tracks.splice(to, 0, track);
        
        await interaction.reply({
            embeds: [{
                color: client.config.colors.success,
                description: `${client.config.emojis.success} Moved **[${track.info.title}](${track.info.uri})** from position ${from + 1} to ${to + 1}`
            }]
        });
    }
};
