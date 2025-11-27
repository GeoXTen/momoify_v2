import { SlashCommandBuilder } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('pitch')
        .setDescription('Adjust the audio pitch')
        .addNumberOption(option =>
            option.setName('value')
                .setDescription('Pitch value (0.5 = lower, 1.0 = normal, 2.0 = higher)')
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
        
        const pitch = interaction.options.getNumber('value');
        
        if (pitch === null || isNaN(pitch)) {
            return interaction.editReply({
                embeds: [{
                    color: client.config.colors.error,
                    description: `${client.config.emojis.error} Please provide a valid pitch value (0.5 - 3.0)!`
                }]
            });
        }
        
        if (pitch < 0.5 || pitch > 3.0) {
            return interaction.editReply({
                embeds: [{
                    color: client.config.colors.error,
                    description: `${client.config.emojis.error} Pitch value must be between 0.5 and 3.0!`
                }]
            });
        }
        
        try {
            await player.filterManager.setPitch(pitch);
            
            const pitchText = pitch === 1.0 ? 'Normal' : pitch < 1.0 ? 'Lower' : 'Higher';
            
            await interaction.editReply({
                embeds: [{
                    color: client.config.colors.success,
                    description: `🎼 Audio pitch set to **${pitch}x** (${pitchText})`
                }]
            });
        } catch (error) {
            console.error('Error setting pitch:', error);
            await interaction.editReply({
                embeds: [{
                    color: client.config.colors.error,
                    description: `${client.config.emojis.error} Failed to set audio pitch`
                }]
            });
        }
    }
};
