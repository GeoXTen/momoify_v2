import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import os from 'os';

export default {
    data: new SlashCommandBuilder()
        .setName('about')
        .setDescription('About this bot - Information and credits'),
    
    async execute(interaction, client) {
        const uptime = process.uptime();
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);
        
        const uptimeString = `${days}d ${hours}h ${minutes}m ${seconds}s`;
        
        const totalMemory = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
        const usedMemory = ((os.totalmem() - os.freemem()) / 1024 / 1024 / 1024).toFixed(2);
        const memoryUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
        
        const embed = new EmbedBuilder()
            .setColor(client.config.colors.primary)
            .setTitle(`${client.config.emojis.info} About ${client.config.botName}`)
            .setDescription(
                `**${client.config.botName} v2.2.5**\n` +
                `**Created by GeoNFs**\n\n` +
                `${client.config.emojis.note1} **Features:**\n` +
                `${client.config.emojis.checkmark} High-quality audio streaming\n` +
                `${client.config.emojis.checkmark} Support for YouTube, Spotify, SoundCloud, Bandcamp, Deezer, Apple Music\n` +
                `${client.config.emojis.checkmark} Advanced queue (up to 1,000 tracks)\n` +
                `${client.config.emojis.checkmark} 11 Audio filters & effects (8 presets + speed/pitch/rate)\n` +
                `${client.config.emojis.checkmark} Smart queue controls (play next, skip to, replay)\n` +
                `${client.config.emojis.checkmark} Save songs to DMs (grab command)\n` +
                `${client.config.emojis.checkmark} 24/7 mode support\n` +
                `${client.config.emojis.checkmark} Unlimited playlist autoplay - no duplicates!\n` +
                `${client.config.emojis.checkmark} Command locking & access control\n` +
                `${client.config.emojis.checkmark} Interactive button controls\n` +
                `${client.config.emojis.checkmark} Voice channel status display\n` +
                `${client.config.emojis.checkmark} Real-time bot status updates\n` +
                `${client.config.emojis.checkmark} Music stats & leaderboards\n` +
                `${client.config.emojis.checkmark} Enhanced error handling & recovery`
            )
            .setThumbnail(client.user.displayAvatarURL({ size: 256 }))
            .addFields(
                {
                    name: `${client.config.emojis.stars} Statistics`,
                    value: [
                        `**Servers:** ${client.guilds.cache.size}`,
                        `**Users:** ${client.guilds.cache.reduce((a, g) => a + g.memberCount, 0).toLocaleString()}`,
                        `**Active Players:** ${client.lavalink.players.size}`
                    ].join('\n'),
                    inline: true
                },
                {
                    name: `${client.config.emojis.control} Technology`,
                    value: [
                        `**Discord.js** v14`,
                        `**Lavalink** v4`,
                        `**Node.js** ${process.version}`
                    ].join('\n'),
                    inline: true
                },
                {
                    name: `${client.config.emojis.note3} Performance`,
                    value: [
                        `**Uptime:** ${uptimeString}`,
                        `**Memory:** ${memoryUsage} MB`,
                        `**Ping:** ${client.ws.ping}ms`
                    ].join('\n'),
                    inline: true
                }
            )
            .setFooter({ 
                text: `Made with ❤️ by GeoNFs • Version 2.2.5`,
                iconURL: client.user.displayAvatarURL()
            })
            .setTimestamp();
        
        // Create button rows
        const row1 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('Help Menu')
                    .setEmoji(client.config.emojis.melody.match(/:(\d+)>/)?.[1] || '📖')
                    .setCustomId('about_help')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setLabel('All Commands')
                    .setEmoji(client.config.emojis.cloudnote.match(/:(\d+)>/)?.[1] || '📚')
                    .setCustomId('about_commands')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setLabel('Features')
                    .setEmoji(client.config.emojis.stars.match(/:(\d+)>/)?.[1] || '⭐')
                    .setCustomId('about_features')
                    .setStyle(ButtonStyle.Secondary)
            );

        const row2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('📚 Documentation')
                    .setURL('https://github.com/GeoNFs/discord-music-bot')
                    .setStyle(ButtonStyle.Link)
                    .setDisabled(true), // Enable when you have a repo
                new ButtonBuilder()
                    .setLabel('💝 Support Server')
                    .setURL('https://discord.gg/your-invite')
                    .setStyle(ButtonStyle.Link)
                    .setDisabled(true), // Enable when you have a support server
                new ButtonBuilder()
                    .setLabel('⭐ Star on GitHub')
                    .setURL('https://github.com/GeoNFs/discord-music-bot')
                    .setStyle(ButtonStyle.Link)
                    .setDisabled(true) // Enable when you have a repo
            );
        
        await interaction.reply({ 
            embeds: [embed],
            components: [row1, row2]
        });
    }
};
