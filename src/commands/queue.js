import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('Show the current music queue')
        .addIntegerOption(option =>
            option.setName('page')
                .setDescription('Page number to view')
                .setMinValue(1)
        ),
    
    async execute(interaction, client) {
        const player = client.lavalink.getPlayer(interaction.guildId);
        
        if (!player || !player.queue.current) {
            const errorMessage = {
                embeds: [{
                    color: client.config.colors.error,
                    description: `${client.config.emojis.error} There's nothing playing right now!`
                }],
                flags: 64 // Ephemeral
            };
            
            // Use editReply if already deferred, otherwise reply
            return interaction.deferred || interaction.replied
                ? interaction.editReply(errorMessage)
                : interaction.reply(errorMessage);
        }
        
        const current = player.queue.current;
        const queue = player.queue.tracks;
        const page = interaction.options.getInteger('page') || 1;
        const perPage = 10;
        const maxPages = Math.ceil(queue.length / perPage) || 1;
        const currentPage = Math.min(page, maxPages);
        
        const start = (currentPage - 1) * perPage;
        const end = start + perPage;
        const tracks = queue.slice(start, end);
        
        let description = `${client.config.emojis.player || '▶️'} **Now Playing:**\n`;
        description += `${client.config.emojis.note1 || '🎵'} [${current.info.title}](${current.info.uri})\n`;
        
        // Handle requester
        const requesterStr = current.requester ? String(current.requester) : 'Unknown';
        description += `${client.config.emojis.time || '⏰'} \`${formatTime(player.position)} / ${formatTime(current.info.duration)}\` • ${client.config.emojis.headphone || '🎧'} ${requesterStr}\n\n`;
        
        if (tracks.length > 0) {
            description += `${client.config.emojis.queue || '📜'} **Up Next:**\n`;
            tracks.forEach((track, i) => {
                const position = start + i + 1;
                description += `\`${position}.\` [${track.info.title}](${track.info.uri}) • \`${formatTime(track.info.duration)}\`\n`;
            });
        } else {
            description += `${client.config.emojis.cloudnote || '☁️'} **Queue is empty!** Use \`/play\` to add more songs.`;
        }
        
        const queueDuration = queue.reduce((acc, track) => acc + track.info.duration, 0);
        
        // Check if autoplay is enabled
        const autoplayModule = await import('./autoplay.js');
        const isAutoplayEnabled = autoplayModule.isAutoplayEnabled(interaction.guildId);
        
        const embed = new EmbedBuilder()
            .setColor(client.config.colors.primary)
            .setTitle(`${client.config.emojis.queue || '📜'} Music Queue ${isAutoplayEnabled ? (client.config.emojis.loop || '🔄') : ''}`)
            .setDescription(description)
            .setThumbnail(current.info.artworkUrl)
            .addFields(
                { name: `${client.config.emojis.disk || '💿'} Total Tracks`, value: `${queue.length + 1}`, inline: true },
                { name: `${client.config.emojis.time || '⏰'} Queue Duration`, value: formatTime(queueDuration), inline: true },
                { name: `${client.config.emojis.loop || '🔁'} Loop Mode`, value: player.repeatMode === 'off' ? 'Off' : player.repeatMode === 'track' ? 'Track' : 'Queue', inline: true }
            )
            .setFooter({ 
                text: `Page ${currentPage}/${maxPages} • 🔊 ${player.volume}%${isAutoplayEnabled ? ' • Autoplay: ON' : ''}`,
                iconURL: client.user.displayAvatarURL()
            });
        
        const row = new ActionRowBuilder();
        
        if (maxPages > 1) {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`queue_prev_${currentPage}`)
                    .setEmoji(client.config.emojis.previous || '⏮️')
                    .setLabel('Previous')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(currentPage === 1),
                new ButtonBuilder()
                    .setCustomId(`queue_next_${currentPage}`)
                    .setEmoji(client.config.emojis.skip || '⏭️')
                    .setLabel('Next')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(currentPage === maxPages)
            );
        }
        
        row.addComponents(
            new ButtonBuilder()
                .setCustomId('queue_clear')
                .setEmoji(client.config.emojis.stop || '⏹️')
                .setLabel('Clear Queue')
                .setStyle(ButtonStyle.Danger)
                .setDisabled(queue.length === 0)
        );
        
        const replyOptions = {
            embeds: [embed],
            components: row.components.length > 0 ? [row] : []
        };
        
        // Use editReply if already deferred (from button), otherwise reply
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply(replyOptions);
        } else {
            await interaction.reply(replyOptions);
        }
    }
};

function formatTime(ms) {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor(ms / (1000 * 60 * 60));
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
