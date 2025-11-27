import { EmbedBuilder } from 'discord.js';

export default {
    name: 'stats',
    description: 'Show bot statistics (Owner only)',
    ownerOnly: true,
    
    async execute(message, args, client) {
        const uptime = process.uptime();
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);
        
        const memoryUsage = process.memoryUsage();
        const memoryMB = (memoryUsage.heapUsed / 1024 / 1024).toFixed(2);
        const totalMemoryMB = (memoryUsage.heapTotal / 1024 / 1024).toFixed(2);
        const memoryPercent = ((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100).toFixed(1);
        
        const players = [...client.lavalink.players.values()];
        const activePlayers = players.filter(p => p.playing).length;
        const idlePlayers = players.length - activePlayers;
        
        // Get command lock status
        let lockedGuilds = 0;
        try {
            const { areCommandsLocked } = await import('../commands/lockcommands.js');
            for (const guildId of client.guilds.cache.keys()) {
                if (areCommandsLocked(guildId)) lockedGuilds++;
            }
        } catch (error) {
            // lockcommands not available
        }
        
        const e = client.config.emojis;
        const djsVersion = (await import('discord.js')).version;
        
        // Ping quality indicator
        let pingIndicator = e.online;
        if (client.ws.ping > 200) pingIndicator = e.warning;
        if (client.ws.ping > 500) pingIndicator = e.dnd;
        
        // Memory usage indicator
        let memoryIndicator = e.online;
        if (memoryPercent > 70) memoryIndicator = e.warning;
        if (memoryPercent > 85) memoryIndicator = e.dnd;
        
        const embed = new EmbedBuilder()
            .setColor(client.config.colors.primary)
            .setTitle(`${e.stats_icon} Bot Statistics Dashboard`)
            .setDescription(`${e.shield} v2.2.0 • ${client.config.botName}`)
            .addFields(
                {
                    name: `${e.time} System Uptime`,
                    value: `└─ ${days}d ${hours}h ${minutes}m ${seconds}s`,
                    inline: true
                },
                {
                    name: `${memoryIndicator} Memory Usage`,
                    value: `└─ ${memoryMB}MB / ${totalMemoryMB}MB (${memoryPercent}%)\n└─ RSS: ${(memoryUsage.rss / 1024 / 1024).toFixed(2)}MB`,
                    inline: true
                },
                {
                    name: `${pingIndicator} Performance`,
                    value: `└─ Bot Ping: **${client.ws.ping}ms**\n└─ Commands: **${client.commands.size}**`,
                    inline: true
                },
                {
                    name: `${e.server} Server Statistics`,
                    value: `└─ ${e.verified} Servers: **${client.guilds.cache.size}**${lockedGuilds > 0 ? ` ${e.lock} (${lockedGuilds} locked)` : ''}\n` +
                           `└─ ${e.headphone} Users: **${client.guilds.cache.reduce((a, g) => a + g.memberCount, 0).toLocaleString()}**\n` +
                           `└─ ${e.control} Channels: **${client.channels.cache.size}**`,
                    inline: false
                },
                {
                    name: `${e.melody} Music Statistics`,
                    value: `└─ ${e.play} Active Players: **${activePlayers}**\n` +
                           `└─ ${e.pause} Idle Players: **${idlePlayers}**\n` +
                           `└─ ${e.queue} Total Players: **${players.length}**\n` +
                           `└─ ${e.server} Lavalink Nodes: **${client.lavalink.nodeManager.nodes.size}**`,
                    inline: false
                },
                {
                    name: `${e.code} Environment`,
                    value: `└─ Node.js: **${process.version}**\n` +
                           `└─ Discord.js: **v${djsVersion}**\n` +
                           `└─ Platform: **${process.platform}**\n` +
                           `└─ Arch: **${process.arch}**`,
                    inline: false
                },
                {
                    name: `${e.checkmark} v2.2.0 Features`,
                    value: `${e.lock} Command locking (${lockedGuilds} active)\n` +
                           `${e.rocket} Smart autoplay (no duplicates)\n` +
                           `${e.shield} Enhanced error handling\n` +
                           `${e.skip} Auto-skip stuck tracks`,
                    inline: false
                }
            )
            .setFooter({ text: `v2.2.0 | ${client.config.botName}` })
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
    }
};
