import { SlashCommandBuilder, MessageFlags } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('clearqueue')
        .setDescription('Clear all songs from the queue'),
    
    async execute(interaction, client) {
        const player = client.lavalink.getPlayer(interaction.guildId);
        
        if (!player || player.queue.tracks.length === 0) {
            return interaction.reply({
                embeds: [{
                    color: client.config.colors.error,
                    description: `${client.config.emojis.error} The queue is already empty!`
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
        
        await interaction.deferReply();
        
        const queueLength = player.queue.tracks.length;
        player.queue.tracks = [];
        
        let description = `${client.config.emojis.success} **Cleared ${queueLength} ${queueLength === 1 ? 'song' : 'songs'} from the queue**`;
        
        if (player.queue.current) {
            description += `\n\n🎵 **Current song will keep playing:**\n` +
                          `${player.queue.current.info.title}\n\n` +
                          `💡 Music will stop after the current song finishes.`;
        }
        
        await interaction.editReply({
            embeds: [{
                color: client.config.colors.success,
                description: description
            }]
        });
    }
};
