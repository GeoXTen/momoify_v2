import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Show all available commands'),
    
    async execute(interaction, client) {
        const e = client.config.emojis;
        const totalCommands = client.commands.size;
        const activePlayers = client.lavalink.players.size;
        const isOwner = interaction.user.id === client.config.ownerId;
        
        const embed = new EmbedBuilder()
            .setColor(client.config.colors.primary)
            .setTitle(`Welcome! Let's Get Started with ${client.config.botName}`)
            .setDescription(`**About ${client.config.botName}**\n` +
                           `A simple, high-quality music bot built for great sound and easy use.`)
            .setThumbnail(client.user.displayAvatarURL({ size: 256 }))
            .addFields(
                {
                    name: 'Supported Platforms',
                    value: `${e.youtube} [YouTube](https://youtube.com) • ${e.spotify} [Spotify](https://spotify.com) • ` +
                           `🎵 [Tidal](https://tidal.com) • 🎶 [JioSaavn](https://jiosaavn.com) • ${e.applemusic} [Apple Music](https://music.apple.com) • ` +
                           `📀 [Amazon Music](https://music.amazon.com) • 🎧 [Pandora](https://pandora.com) • ${e.soundcloud} [SoundCloud](https://soundcloud.com) • ` +
                           `🎼 [Yandex Music](https://music.yandex.com)`,
                    inline: false
                },
                {
                    name: 'Features',
                    value: `${e.control} Custom aliases for commands • 🔴 Last.fm tracking • ${e.spotify} Spotify integration • ${e.disk} Audio filters • ` +
                           `${e.cloudnote} Playlist management • And much more!`,
                    inline: false
                },
                {
                    name: 'Quick Start',
                    value: `**1️⃣** Join a voice channel\n` +
                           `**2️⃣** Type \`/play [song name]\`\n` +
                           `**3️⃣** Explore commands below!`,
                    inline: false
                },
                {
                    name: '\u200B',
                    value: '📚 **Browse Commands by Category**\n' +
                           'Use the dropdown menu below to explore commands, or click "View All Commands" for a complete list.',
                    inline: false
                }
            )
            .setFooter({ 
                text: `💡 Tip: Use /help [command] for detailed command information`,
                iconURL: client.user.displayAvatarURL()
            })
            .setTimestamp();

        // Create select menu for browsing commands by category
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('help_category_select')
            .setPlaceholder('Choose a category to explore...')
            .addOptions([
                {
                    label: 'Config',
                    description: 'Bot configuration commands',
                    value: 'category_config',
                    emoji: e.gear?.match(/:(\d+)>/)?.[1] || '⚙️'
                },
                {
                    label: 'Music',
                    description: 'Music playback commands',
                    value: 'category_music',
                    emoji: e.melody?.match(/:(\d+)>/)?.[1] || '🎵'
                },
                {
                    label: 'Filters',
                    description: 'Audio filter commands',
                    value: 'category_filters',
                    emoji: e.disk?.match(/:(\d+)>/)?.[1] || '🎚️'
                },
                {
                    label: 'General',
                    description: 'General utility commands',
                    value: 'category_general',
                    emoji: '❓'
                }
            ]);

        const row1 = new ActionRowBuilder().addComponents(selectMenu);

        // Buttons row
        const row2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('View All Commands')
                    .setCustomId('help_all_commands')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji(e.cloudnote?.match(/:(\d+)>/)?.[1] || '📖'),
                new ButtonBuilder()
                    .setLabel('Support Server')
                    .setURL('https://discord.gg/your-invite')
                    .setStyle(ButtonStyle.Link)
                    .setEmoji('❓')
                    .setDisabled(true), // Enable when you have a support server
                new ButtonBuilder()
                    .setLabel('Invite Bot')
                    .setURL(`https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`)
                    .setStyle(ButtonStyle.Link)
                    .setEmoji(e.verified?.match(/:(\d+)>/)?.[1] || '✅')
            );
        
        await interaction.reply({ 
            embeds: [embed],
            components: [row1, row2]
        });
    }
};

function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}
