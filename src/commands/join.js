import { SlashCommandBuilder, MessageFlags } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('join')
        .setDescription('Join your voice channel'),
    
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
        
        const permissions = voiceChannel.permissionsFor(interaction.guild.members.me);
        if (!permissions || !permissions.has('Connect') || !permissions.has('Speak')) {
            return interaction.reply({
                embeds: [{
                    color: client.config.colors.error,
                    description: `${client.config.emojis.error} I don't have permission to join or speak in your voice channel!`
                }],
                flags: MessageFlags.Ephemeral
            });
        }
        
        let player = client.lavalink.getPlayer(interaction.guildId);
        
        if (player) {
            if (player.voiceChannelId === voiceChannel.id) {
                return interaction.reply({
                    embeds: [{
                        color: client.config.colors.warning,
                        description: `${client.config.emojis.music} I'm already in your voice channel!`
                    }],
                    flags: MessageFlags.Ephemeral
                });
            } else {
                return interaction.reply({
                    embeds: [{
                        color: client.config.colors.error,
                        description: `${client.config.emojis.error} I'm already playing in <#${player.voiceChannelId}>!`
                    }],
                    flags: MessageFlags.Ephemeral
                });
            }
        }
        
        player = client.lavalink.createPlayer({
            guildId: interaction.guildId,
            voiceChannelId: voiceChannel.id,
            textChannelId: interaction.channelId,
            selfDeaf: true,
            selfMute: false,
            volume: 75
        });
        
        await player.connect();
        
        await interaction.reply({
            embeds: [{
                color: client.config.colors.success,
                description: `${client.config.emojis.success} Joined <#${voiceChannel.id}>!`
            }]
        });
    }
};
