import { SlashCommandBuilder, MessageFlags } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('leave')
        .setDescription('Leave the voice channel'),
    
    async execute(interaction, client) {
        const player = client.lavalink.getPlayer(interaction.guildId);
        
        if (!player) {
            return interaction.reply({
                embeds: [{
                    color: client.config.colors.error,
                    description: `${client.config.emojis.error} I'm not in a voice channel!`
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
        
        const channelId = player.voiceChannelId;
        
        // Clear voice channel status before destroying player
        try {
            await client.rest.put(
                `/channels/${channelId}/voice-status`,
                { body: { status: '' } }
            ).catch(() => {});
        } catch (error) {
            // Ignore error
        }
        
        await player.destroy();
        
        await interaction.editReply({
            embeds: [{
                color: client.config.colors.success,
                description: `${client.config.emojis.success} Left <#${channelId}>!`
            }]
        });
    }
};
