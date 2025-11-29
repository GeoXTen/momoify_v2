import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { EmbedBuilder } from 'discord.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default {
    name: 'logs',
    description: 'View bot logs (Owner only)',
    ownerOnly: true,
    usage: 'logs [type] [lines]',
    examples: [
        'logs',
        'logs error',
        'logs combined 100',
        'logs out 50'
    ],
    
    async execute(message, args, client) {
        const e = client.config.emojis;
        
        // Parse arguments
        let logType = args[0]?.toLowerCase() || 'error';
        let lines = parseInt(args[1]) || 50;
        
        // Validate log type
        const validTypes = ['error', 'combined', 'out'];
        if (!validTypes.includes(logType)) {
            const embed = new EmbedBuilder()
                .setColor(client.config.colors.error)
                .setTitle(`${e.error} Invalid Log Type`)
                .setDescription(`${e.cloudnote} **Valid types:** \`${validTypes.join('`, `')}\``)
                .addFields(
                    {
                        name: `${e.info} Usage`,
                        value: `\`${client.config.prefix}logs [type] [lines]\``,
                        inline: false
                    },
                    {
                        name: `${e.bulb} Examples`,
                        value: `• \`${client.config.prefix}logs error\` - Show last 50 error logs\n` +
                               `• \`${client.config.prefix}logs combined 100\` - Show last 100 combined logs\n` +
                               `• \`${client.config.prefix}logs out 30\` - Show last 30 output logs`,
                        inline: false
                    }
                )
                .setFooter({ text: 'v2.2.5 | Max lines: 200' })
                .setTimestamp();
            
            return message.reply({ embeds: [embed] });
        }
        
        // Validate lines
        if (isNaN(lines) || lines < 1) {
            lines = 50;
        }
        if (lines > 200) {
            lines = 200;
        }
        
        try {
            // Find the logs directory
            const logsDir = resolve(process.cwd(), 'logs');
            
            // Find the latest log file for the type
            const logFileName = `${logType}-0.log`;
            const logPath = join(logsDir, logFileName);
            
            if (!existsSync(logPath)) {
                const embed = new EmbedBuilder()
                    .setColor(client.config.colors.error)
                    .setTitle(`${e.error} Log File Not Found`)
                    .setDescription(`${e.cloudnote} File: \`${logFileName}\``)
                    .addFields({
                        name: `${e.info} Available Types`,
                        value: `\`${validTypes.join('`, `')}\``,
                        inline: false
                    })
                    .setFooter({ text: 'v2.2.5 | Logs Command' })
                    .setTimestamp();
                
                return message.reply({ embeds: [embed] });
            }
            
            // Read the log file
            const logContent = readFileSync(logPath, 'utf-8');
            
            if (!logContent || logContent.trim().length === 0) {
                const embed = new EmbedBuilder()
                    .setColor(client.config.colors.primary)
                    .setTitle(`${e.info} Empty Log File`)
                    .setDescription(`${e.cloudnote} The \`${logType}\` log file is empty.\n\n` +
                                  `${e.checkmark} This is normal if no ${logType === 'error' ? 'errors have occurred' : 'logs have been generated'} yet.`)
                    .setFooter({ text: 'v2.2.5 | Logs Command' })
                    .setTimestamp();
                
                return message.reply({ embeds: [embed] });
            }
            
            // Split by lines and get the last N lines
            const logLines = logContent.split('\n').filter(line => line.trim().length > 0);
            const requestedLines = lines;
            const lastLines = logLines.slice(-lines);
            const actualLines = lastLines.length;
            
            // Format the output
            let output = lastLines.join('\n');
            
            // Discord has a 2000 character limit for messages
            // If content is too long, truncate it
            const maxLength = 1800; // Leave room for formatting
            const wasTruncated = output.length > maxLength;
            if (wasTruncated) {
                output = '...(truncated)\n' + output.slice(-maxLength);
            }
            
            // Send as code block
            const emoji = logType === 'error' ? e.dnd : e.cloudnote;
            const typeEmoji = {
                'error': e.error,
                'combined': e.cloudnote,
                'out': e.info
            };
            
            let response = `${emoji} **${logType.toUpperCase()} LOGS** ${emoji}\n`;
            response += `${typeEmoji[logType] || e.info} Showing last ${actualLines} of ${logLines.length} lines\n`;
            if (wasTruncated) response += `${e.warning} Output truncated to fit Discord limit\n`;
            response += `\n\`\`\`\n${output}\n\`\`\``;
            
            // If still too long, send as file
            if (response.length > 2000) {
                const buffer = Buffer.from(lastLines.join('\n'), 'utf-8');
                return message.reply({
                    content: `${emoji} **${logType.toUpperCase()} LOGS**\n\n` +
                             `${e.warning} Content too large for Discord, sent as file\n` +
                             `${e.cloudnote} Lines: **${actualLines}** / ${logLines.length} total`,
                    files: [{
                        attachment: buffer,
                        name: `${logType}-logs-${Date.now()}.txt`
                    }]
                });
            }
            
            await message.reply(response);
            
        } catch (error) {
            console.error('Error reading logs:', error);
            await message.reply({
                content: `${e.error} **Failed to read logs!**\n\n` +
                         `${e.warning} Error: \`${error.message}\`\n\n` +
                         `${e.bulb} Check that the log file exists and has proper permissions.`
            });
        }
    }
};
