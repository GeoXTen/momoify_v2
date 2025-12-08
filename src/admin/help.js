import { EmbedBuilder } from 'discord.js';

export default {
    name: 'help',
    description: 'Show help commands',
    ownerOnly: false,
    
    async execute(message, args, client) {
        const isOwner = message.author.id === client.config.ownerId;
        
        // If not owner, show regular help by executing the slash command
        if (!isOwner) {
            const helpCommand = client.commands.get('help');
            if (helpCommand) {
                // Create mock interaction for slash command
                const mockInteraction = {
                    guild: message.guild,
                    guildId: message.guild?.id,
                    channel: message.channel,
                    channelId: message.channel.id,
                    user: message.author,
                    member: message.member,
                    commandName: 'help',
                    replied: false,
                    deferred: false,
                    options: {
                        getString: () => null,
                        getInteger: () => null
                    },
                    async reply(options) {
                        this.replied = true;
                        return await message.reply(options);
                    },
                    async editReply(options) {
                        return await message.reply(options);
                    },
                    async followUp(options) {
                        return await message.channel.send(options);
                    }
                };
                return await helpCommand.execute(mockInteraction, client);
            }
            return;
        }
        
        // Owner sees admin commands
        const adminCommands = await import('../handlers/messageHandler.js');
        const commandList = [...adminCommands.adminCommands.values()];
        
        const e = client.config.emojis;
        
        const embed = new EmbedBuilder()
            .setColor(client.config.colors.error)
            .setTitle(`${e.shield} Admin Commands Panel`)
            .setDescription(`${e.control} **Owner-Only Access** • v2.2.5`)
            .addFields(
                {
                    name: `${e.gear} Command Registration`,
                    value: `\`-printah\` - Register slash commands globally\n` +
                           `\`-printah guild\` - Register to current server (instant)\n` +
                           `\`-printah guild <id>\` - Register to specific server\n` +
                           `\`-printah g\` - Quick guild registration`,
                    inline: false
                },
                {
                    name: `${e.refresh} Command Management`,
                    value: `\`-reload <command>\` - Reload specific command\n` +
                           `\`-reload all\` - Reload all commands`,
                    inline: false
                },
                {
                    name: `${e.stats_icon} Bot Information`,
                    value: `\`-stats\` - Show detailed bot statistics\n` +
                           `\`-lavalink\` - Show Lavalink node status\n` +
                           `\`-ping\` - Check bot latency (bot, WS, Lavalink)\n` +
                           `\`-testlavalink\` - Test Lavalink server performance\n` +
                           `\`-help\` - Show this help menu`,
                    inline: false
                },
                {
                    name: `${e.code} Development & Debugging`,
                    value: `\`-eval <code>\` - Execute JavaScript code\n` +
                           `\`-logs [type] [lines]\` - View bot logs (error/combined/out)`,
                    inline: false
                },
                {
                    name: `${e.stars} Emoji Management`,
                    value: `\`-listemojis\` - List all custom emojis from guilds\n` +
                           `\`-listemojisbot\` - List emojis from emoji.txt file\n` +
                           `\`-uploademojis\` - Upload emojis to current server`,
                    inline: false
                },
                {
                    name: `${e.checkmark} 🆕 v2.2.5 Features`,
                    value: `${e.lock} \`/lockcommands\` - Lock bot to owner only\n` +
                           `${e.chart} Enhanced stats with lock status\n` +
                           `${e.shield} Improved error tracking\n` +
                           `${e.time} Activity update interval (15s)`,
                    inline: false
                },
                {
                    name: `${e.bulb} Pro Tips`,
                    value: `• Use \`-printah g\` for instant command updates\n` +
                           `• Use \`-stats\` to monitor performance\n` +
                           `• Use \`-lavalink\` to check audio server health\n` +
                           `• Use \`-logs error\` to check recent errors\n` +
                           `• Use \`-listemojis\` to get config-ready emoji list\n` +
                           `• Use \`/lockcommands\` for server maintenance\n` +
                           `• All admin commands use \`-\` prefix only`,
                    inline: false
                }
            )
            .setFooter({ 
                text: `Total Commands: ${commandList.length} | Version: v2.2.5 | Owner: ${message.author.tag}`,
                iconURL: client.user.displayAvatarURL()
            })
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
    }
};
