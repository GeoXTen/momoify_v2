import { SlashCommandBuilder } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('speed')
        .setDescription('Adjust the playback speed')
        .addNumberOption(option =>
            option.setName('value')
                .setDescription('Speed value (0.5 = slow, 1.0 = normal, 2.0 = fast)')
                .setRequired(true)
                .setMinValue(0.5)
                .setMaxValue(3.0)
        ),
    
    async execute(interaction, client) {
        const player = client.lavalink.getPlayer(interaction.guildId);
        
        if (!player || !player.queue.current) {
            return interaction.reply({
                embeds: [{
                    color: client.config.colors.error,
                    description: `${client.config.emojis.error} There's nothing playing right now!`
                }],
                flags: 64
            });
        }
        
        const member = interaction.guild.members.cache.get(interaction.user.id);
        if (member.voice.channelId !== player.voiceChannelId) {
            return interaction.reply({
                embeds: [{
                    color: client.config.colors.error,
                    description: `${client.config.emojis.error} You need to be in the same voice channel as me!`
                }],
                flags: 64
            });
        }
        
        await interaction.deferReply();
        
        const speed = interaction.options.getNumber('value');
        
        if (speed === null || isNaN(speed)) {
            return interaction.editReply({
                embeds: [{
                    color: client.config.colors.error,
                    description: `${client.config.emojis.error} Please provide a valid speed value (0.5 - 3.0)!`
                }]
            });
        }
        
        if (speed < 0.5 || speed > 3.0) {
            return interaction.editReply({
                embeds: [{
                    color: client.config.colors.error,
                    description: `${client.config.emojis.error} Speed value must be between 0.5 and 3.0!`
                }]
            });
        }
        
        try {
            await player.filterManager.setSpeed(speed);
            
            const speedText = speed === 1.0 ? 'Normal' : speed < 1.0 ? 'Slower' : 'Faster';
            
            await interaction.editReply({
                embeds: [{
                    color: client.config.colors.success,
                    description: `⚡ Playback speed set to **${speed}x** (${speedText})`
                }]
            });
        } catch (error) {
            console.error('Error setting speed:', error);
            await interaction.editReply({
                embeds: [{
                    color: client.config.colors.error,
                    description: `${client.config.emojis.error} Failed to set playback speed`
                }]
            });
        }
    }
};
