import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('clearstatus')
        .setDescription('Clear the voice channel status')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    
    async execute(interaction, client) {
        const member = interaction.guild.members.cache.get(interaction.user.id);
        const voiceChannel = member?.voice?.channel;
        
        if (!voiceChannel) {
            return interaction.reply({
                embeds: [{
                    color: client.config.colors.error,
                    description: `${client.config.emojis.error} You need to be in a voice channel!`
                }],
                flags: MessageFlags.Ephemeral
            });
        }
        
        try {
            await voiceChannel.setVoiceChannelStatus('');
            
            await interaction.reply({
                embeds: [{
                    color: client.config.colors.success,
                    description: `${client.config.emojis.success} Voice channel status cleared!`
                }],
                flags: MessageFlags.Ephemeral
            });
        } catch (error) {
            await interaction.reply({
                embeds: [{
                    color: client.config.colors.error,
                    description: `${client.config.emojis.error} Failed to clear voice channel status. This feature may not be available in this server.`
                }],
                flags: MessageFlags.Ephemeral
            });
        }
    }
};
