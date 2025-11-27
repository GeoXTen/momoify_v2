import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Check the bot latency and response time'),
    
    async execute(interaction, client) {
        const sent = await interaction.reply({
            embeds: [{
                color: client.config.colors.primary,
                description: '🏓 Pinging...'
            }],
            fetchReply: true
        });
        
        const latency = sent.createdTimestamp - interaction.createdTimestamp;
        const wsLatency = client.ws ? client.ws.ping : 0;
        
        // Get Lavalink latency
        const nodes = client.lavalink?.nodeManager?.leastUsedNodes() || [];
        const lavalinkLatency = nodes[0] ? Math.round(nodes[0].ping) : 'N/A';
        
        // Determine latency quality
        const getLatencyEmoji = (ms) => {
            if (ms < 100) return '🟢';
            if (ms < 200) return '🟡';
            return '🔴';
        };
        
        const embed = new EmbedBuilder()
            .setColor(client.config.colors.primary)
            .setTitle('🏓 Pong!')
            .addFields(
                {
                    name: '📡 Bot Latency',
                    value: `${getLatencyEmoji(latency)} \`${latency}ms\``,
                    inline: true
                },
                {
                    name: '💓 WebSocket',
                    value: `${getLatencyEmoji(wsLatency)} \`${wsLatency}ms\``,
                    inline: true
                },
                {
                    name: '🎵 Lavalink',
                    value: lavalinkLatency === 'N/A' ? '❌ `N/A`' : `${getLatencyEmoji(lavalinkLatency)} \`${lavalinkLatency}ms\``,
                    inline: true
                }
            )
            .setTimestamp();
        
        if (interaction.user) {
            embed.setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });
        }
        
        await interaction.editReply({ embeds: [embed] });
    }
};
