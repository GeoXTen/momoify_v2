import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';

export default {
    data: new SlashCommandBuilder()
        .setName('logs')
        .setDescription('View bot logs (Owner only)')
        .addStringOption(option =>
            option
                .setName('type')
                .setDescription('Type of logs to view')
                .setRequired(false)
                .addChoices(
                    { name: 'Error Logs', value: 'error' },
                    { name: 'Combined Logs', value: 'combined' },
                    { name: 'Output Logs', value: 'out' }
                ))
        .addIntegerOption(option =>
            option
                .setName('lines')
                .setDescription('Number of lines to show (1-200, default: 50)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(200)),
    
    async execute(interaction, client) {
        // Check if user is owner
        if (interaction.user.id !== client.config.ownerId) {
            const embed = new EmbedBuilder()
                .setColor(client.config.colors.error)
                .setTitle('❌ Access Denied')
                .setDescription('This command is only available to the bot owner.')
                .setTimestamp();
            
            return interaction.reply({ embeds: [embed], flags: 64 });
        }
        
        await interaction.deferReply({ flags: 64 });
        
        // Get options
        const logType = interaction.options.getString('type') || 'error';
        let lines = interaction.options.getInteger('lines') || 50;
        
        // Validate lines
        if (lines < 1) lines = 1;
        if (lines > 200) lines = 200;
        
        try {
            // Find the logs directory
            const logsDir = resolve(process.cwd(), 'logs');
            
            // Find the latest log file for the type
            const logFileName = `${logType}-0.log`;
            const logPath = join(logsDir, logFileName);
            
            if (!existsSync(logPath)) {
                const embed = new EmbedBuilder()
                    .setColor(client.config.colors.error)
                    .setTitle('❌ Log File Not Found')
                    .setDescription(`Log file not found: \`${logFileName}\``)
                    .addFields({
                        name: 'Available Types',
                        value: '`error`, `combined`, `out`'
                    })
                    .setTimestamp();
                
                return interaction.editReply({ embeds: [embed] });
            }
            
            // Read the log file
            const logContent = readFileSync(logPath, 'utf-8');
            
            if (!logContent || logContent.trim().length === 0) {
                const embed = new EmbedBuilder()
                    .setColor(client.config.colors.warning)
                    .setTitle('📄 Empty Log File')
                    .setDescription(`The \`${logType}\` log file is currently empty.`)
                    .setTimestamp();
                
                return interaction.editReply({ embeds: [embed] });
            }
            
            // Split by lines and get the last N lines
            const logLines = logContent.split('\n').filter(line => line.trim().length > 0);
            const lastLines = logLines.slice(-lines);
            
            // Format the output
            let output = lastLines.join('\n');
            
            // Discord embed description has a 4096 character limit
            // If content is too long, send as file
            const maxLength = 3900; // Leave room for code block formatting
            
            if (output.length > maxLength) {
                const buffer = Buffer.from(lastLines.join('\n'), 'utf-8');
                
                const embed = new EmbedBuilder()
                    .setColor(client.config.colors.primary)
                    .setTitle(`${logType === 'error' ? '🔴' : '📄'} ${logType.toUpperCase()} LOGS`)
                    .setDescription(`Last ${lastLines.length} lines (sent as file due to size)`)
                    .addFields(
                        { name: 'Total Lines', value: logLines.length.toString(), inline: true },
                        { name: 'Showing', value: lastLines.length.toString(), inline: true },
                        { name: 'File Size', value: `${(buffer.length / 1024).toFixed(2)} KB`, inline: true }
                    )
                    .setTimestamp();
                
                return interaction.editReply({
                    embeds: [embed],
                    files: [{
                        attachment: buffer,
                        name: `${logType}-logs.txt`
                    }]
                });
            }
            
            // Send as embed with code block
            const emoji = logType === 'error' ? '🔴' : '📄';
            const embed = new EmbedBuilder()
                .setColor(logType === 'error' ? client.config.colors.error : client.config.colors.primary)
                .setTitle(`${emoji} ${logType.toUpperCase()} LOGS`)
                .setDescription(`\`\`\`\n${output}\n\`\`\``)
                .addFields(
                    { name: 'Total Lines', value: logLines.length.toString(), inline: true },
                    { name: 'Showing', value: lastLines.length.toString(), inline: true }
                )
                .setTimestamp();
            
            await interaction.editReply({ embeds: [embed] });
            
        } catch (error) {
            console.error('Error reading logs:', error);
            
            const embed = new EmbedBuilder()
                .setColor(client.config.colors.error)
                .setTitle('❌ Error Reading Logs')
                .setDescription(`\`\`\`\n${error.message}\n\`\`\``)
                .setTimestamp();
            
            await interaction.editReply({ embeds: [embed] });
        }
    }
};
