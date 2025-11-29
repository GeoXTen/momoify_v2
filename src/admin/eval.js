import util from 'util';
import { EmbedBuilder } from 'discord.js';

export default {
    name: 'eval',
    description: 'Execute JavaScript code - v2.2.5 (Owner only)',
    ownerOnly: true,
    
    async execute(message, args, client) {
        const e = client.config.emojis;
        
        if (!args.length) {
            const embed = new EmbedBuilder()
                .setColor(client.config.colors.error)
                .setTitle(`${e.error} No Code Provided`)
                .setDescription(`${e.code} **Usage:** \`-eval <code>\``)
                .addFields(
                    {
                        name: `${e.bulb} Examples`,
                        value: `• \`-eval client.guilds.cache.size\`\n` +
                               `• \`-eval client.ws.ping\`\n` +
                               `• \`-eval client.lavalink.players.size\``,
                        inline: false
                    },
                    {
                        name: `${e.shield} Security`,
                        value: 'Token and passwords are automatically hidden',
                        inline: false
                    }
                )
                .setFooter({ text: 'v2.2.5 | Owner Command' })
                .setTimestamp();
            
            return message.reply({ embeds: [embed] });
        }
        
        const code = args.join(' ');
        const startTime = Date.now();
        
        try {
            let evaled = eval(code);
            
            if (evaled instanceof Promise) {
                evaled = await evaled;
            }
            
            if (typeof evaled !== 'string') {
                evaled = util.inspect(evaled, { depth: 1 });
            }
            
            const executionTime = Date.now() - startTime;
            
            // Truncate if too long
            const wasTruncated = evaled.length > 1900;
            if (wasTruncated) {
                evaled = evaled.substring(0, 1900) + '\n... (truncated)';
            }
            
            // Hide sensitive data
            evaled = evaled
                .replace(new RegExp(client.config.token, 'g'), '[DISCORD_TOKEN]')
                .replace(new RegExp(client.config.lavalink.password, 'g'), '[LAVALINK_PASSWORD]');
            
            const embed = new EmbedBuilder()
                .setColor(client.config.colors.success)
                .setTitle(`${e.checkmark} Evaluation Successful`)
                .setDescription(`${e.time} Execution time: **${executionTime}ms**${wasTruncated ? `\n${e.warning} Output truncated` : ''}`)
                .addFields(
                    {
                        name: 'Input',
                        value: `\`\`\`js\n${code.substring(0, 1000)}\n\`\`\``,
                        inline: false
                    },
                    {
                        name: 'Output',
                        value: `\`\`\`js\n${evaled.substring(0, 1000)}\n\`\`\``,
                        inline: false
                    }
                )
                .setFooter({ text: 'v2.2.5 | Eval Command' })
                .setTimestamp();
            
            await message.reply({ embeds: [embed] });
        } catch (error) {
            const executionTime = Date.now() - startTime;
            
            const embed = new EmbedBuilder()
                .setColor(client.config.colors.error)
                .setTitle(`${e.error} Evaluation Failed`)
                .setDescription(`${e.time} Execution time: **${executionTime}ms**`)
                .addFields(
                    {
                        name: 'Input',
                        value: `\`\`\`js\n${code.substring(0, 1000)}\n\`\`\``,
                        inline: false
                    },
                    {
                        name: 'Error',
                        value: `\`\`\`js\n${(error.stack || error.message).substring(0, 1000)}\n\`\`\``,
                        inline: false
                    }
                )
                .setFooter({ text: 'v2.2.5 | Eval Command' })
                .setTimestamp();
            
            await message.reply({ embeds: [embed] });
        }
    }
};
