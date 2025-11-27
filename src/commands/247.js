import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';

const stayConnected = new Map();

export default {
    data: new SlashCommandBuilder()
        .setName('247')
        .setDescription('Toggle 24/7 mode (bot stays in voice channel)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    
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
        
        const is247 = stayConnected.get(interaction.guildId) || false;
        
        if (is247) {
            stayConnected.delete(interaction.guildId);
            
            await interaction.reply({
                embeds: [{
                    color: client.config.colors.success,
                    description: `${client.config.emojis.success} 24/7 mode disabled. Bot will leave when queue ends.`
                }]
            });
        } else {
            stayConnected.set(interaction.guildId, true);
            
            let player = client.lavalink.getPlayer(interaction.guildId);
            
            if (!player) {
                player = client.lavalink.createPlayer({
                    guildId: interaction.guildId,
                    voiceChannelId: voiceChannel.id,
                    textChannelId: interaction.channelId,
                    selfDeaf: true,
                    selfMute: false,
                    volume: 75
                });
                
                await player.connect();
            }
            
            await interaction.reply({
                embeds: [{
                    color: client.config.colors.success,
                    description: `${client.config.emojis.success} 24/7 mode enabled. Bot will stay connected in <#${voiceChannel.id}>`
                }]
            });
        }
    }
};

export function is247Enabled(guildId) {
    return stayConnected.get(guildId) || false;
}
