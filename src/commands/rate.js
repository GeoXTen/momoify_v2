import { SlashCommandBuilder } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('rate')
        .setDescription('Adjust the playback rate (affects both pitch and speed)')
        .addNumberOption(option =>
            option.setName('value')
                .setDescription('Rate value (0.5 = slower/lower, 1.0 = normal, 2.0 = faster/higher)')
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
        
        const rate = interaction.options.getNumber('value');
        
        if (rate === null || isNaN(rate)) {
            return interaction.editReply({
                embeds: [{
                    color: client.config.colors.error,
                    description: `${client.config.emojis.error} Please provide a valid rate value (0.5 - 3.0)!`
                }]
            });
        }
        
        if (rate < 0.5 || rate > 3.0) {
            return interaction.editReply({
                embeds: [{
                    color: client.config.colors.error,
                    description: `${client.config.emojis.error} Rate value must be between 0.5 and 3.0!`
                }]
            });
        }
        
        try {
            await player.filterManager.setRate(rate);
            
            const rateText = rate === 1.0 ? 'Normal' : rate < 1.0 ? 'Slower & Lower' : 'Faster & Higher';
            
            await interaction.editReply({
                embeds: [{
                    color: client.config.colors.success,
                    description: `🎚️ Playback rate set to **${rate}x** (${rateText})\n\n💡 *This affects both speed and pitch*`
                }]
            });
        } catch (error) {
            console.error('Error setting rate:', error);
            await interaction.editReply({
                embeds: [{
                    color: client.config.colors.error,
                    description: `${client.config.emojis.error} Failed to set playback rate`
                }]
            });
        }
    }
};
