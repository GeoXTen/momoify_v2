import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default {
    name: 'logs',
    aliases: ['log', 'viewlogs', 'errorlog'],
    description: 'View and manage bot logs (Owner only)',
    ownerOnly: true,
    usage: 'logs [type] [lines] [search]',
    examples: [
        'logs',
        'logs error',
        'logs combined 100',
        'logs out 50 "connection"'
    ],
    
    async execute(message, args, client) {
        const e = client.config.emojis;
        
        // Initial settings
        let logType = args[0]?.toLowerCase() || 'out';
        let lines = parseInt(args[1]) || 50;
        let searchTerm = args.slice(2).join(' ').replace(/"/g, '') || null;
        let currentPage = 0;
        const linesPerPage = 30;
        
        // Validate log type
        const validTypes = ['error', 'combined', 'out', 'err'];
        if (!validTypes.includes(logType)) {
            logType = 'out';
        }
        
        // Map err to error for PM2 compatibility
        if (logType === 'err') logType = 'error';
        
        // Validate lines
        if (isNaN(lines) || lines < 1) lines = 50;
        if (lines > 500) lines = 500;
        
        // Build initial embed
        const { embed, logData } = await buildLogsEmbed(client, logType, lines, searchTerm, currentPage, linesPerPage);
        const row1 = buildSelectMenu(logType);
        const row2 = buildButtons(currentPage, logData.totalPages, logData.totalLines);
        
        const replyMsg = await message.reply({ 
            embeds: [embed], 
            components: [row1, row2] 
        });
        
        // Store log data for pagination
        const sessionData = {
            logType,
            lines,
            searchTerm,
            currentPage,
            logData
        };
        
        // Button collector
        const collector = replyMsg.createMessageComponentCollector({
            filter: i => i.user.id === message.author.id,
            time: 300000 // 5 minutes
        });
        
        collector.on('collect', async interaction => {
            const customId = interaction.customId;
            
            if (interaction.isStringSelectMenu()) {
                sessionData.logType = interaction.values[0];
                sessionData.currentPage = 0;
                
                await interaction.deferUpdate();
                const { embed: newEmbed, logData: newData } = await buildLogsEmbed(
                    client, sessionData.logType, sessionData.lines, 
                    sessionData.searchTerm, sessionData.currentPage, linesPerPage
                );
                sessionData.logData = newData;
                
                const newRow1 = buildSelectMenu(sessionData.logType);
                const newRow2 = buildButtons(sessionData.currentPage, newData.totalPages, newData.totalLines);
                await interaction.editReply({ embeds: [newEmbed], components: [newRow1, newRow2] });
                
            } else if (interaction.isButton()) {
                await interaction.deferUpdate();
                
                if (customId === 'logs_first') {
                    sessionData.currentPage = 0;
                } else if (customId === 'logs_prev') {
                    sessionData.currentPage = Math.max(0, sessionData.currentPage - 1);
                } else if (customId === 'logs_next') {
                    sessionData.currentPage = Math.min(sessionData.logData.totalPages - 1, sessionData.currentPage + 1);
                } else if (customId === 'logs_last') {
                    sessionData.currentPage = sessionData.logData.totalPages - 1;
                } else if (customId === 'logs_refresh') {
                    // Refresh current view
                } else if (customId === 'logs_download') {
                    // Send full log file
                    const logsDir = resolve(process.cwd(), 'logs');
                    const logPath = join(logsDir, `${sessionData.logType}.log`);
                    
                    if (existsSync(logPath)) {
                        const content = readFileSync(logPath, 'utf-8');
                        const buffer = Buffer.from(content, 'utf-8');
                        await interaction.followUp({
                            content: `${e.checkmark || '✅'} Full ${sessionData.logType} log file:`,
                            files: [{
                                attachment: buffer,
                                name: `${sessionData.logType}-logs-${Date.now()}.txt`
                            }],
                            ephemeral: true
                        });
                    }
                    return;
                } else if (customId === 'logs_stats') {
                    // Show log statistics
                    const statsEmbed = await buildLogStats(client);
                    await interaction.followUp({ embeds: [statsEmbed], ephemeral: true });
                    return;
                }
                
                const { embed: newEmbed, logData: newData } = await buildLogsEmbed(
                    client, sessionData.logType, sessionData.lines,
                    sessionData.searchTerm, sessionData.currentPage, linesPerPage
                );
                sessionData.logData = newData;
                
                const newRow1 = buildSelectMenu(sessionData.logType);
                const newRow2 = buildButtons(sessionData.currentPage, newData.totalPages, newData.totalLines);
                await interaction.editReply({ embeds: [newEmbed], components: [newRow1, newRow2] });
            }
        });
        
        collector.on('end', async () => {
            try {
                const disabledRow1 = ActionRowBuilder.from(replyMsg.components[0]);
                const disabledRow2 = ActionRowBuilder.from(replyMsg.components[1]);
                disabledRow1.components.forEach(c => c.setDisabled(true));
                disabledRow2.components.forEach(c => c.setDisabled(true));
                await replyMsg.edit({ components: [disabledRow1, disabledRow2] });
            } catch {}
        });
    }
};

async function buildLogsEmbed(client, logType, maxLines, searchTerm, page, linesPerPage) {
    const e = client.config.emojis;
    const logsDir = resolve(process.cwd(), 'logs');
    
    // Try different file name patterns
    const possibleFiles = [
        `${logType}.log`,
        `${logType}-0.log`,
        `${logType === 'error' ? 'err' : logType}.log`
    ];
    
    let logPath = null;
    let logFileName = null;
    
    for (const file of possibleFiles) {
        const path = join(logsDir, file);
        if (existsSync(path)) {
            logPath = path;
            logFileName = file;
            break;
        }
    }
    
    if (!logPath) {
        return {
            embed: new EmbedBuilder()
                .setColor(client.config.colors.error)
                .setTitle(`${e.error || '❌'} Log File Not Found`)
                .setDescription(`Could not find log file for type: \`${logType}\`\n\nTried: ${possibleFiles.map(f => `\`${f}\``).join(', ')}`)
                .setTimestamp(),
            logData: { totalLines: 0, totalPages: 0, lines: [] }
        };
    }
    
    // Read log file
    const content = readFileSync(logPath, 'utf-8');
    let logLines = content.split('\n').filter(line => line.trim().length > 0);
    
    // Apply search filter
    if (searchTerm) {
        logLines = logLines.filter(line => line.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    
    // Get file stats
    const stats = statSync(logPath);
    const fileSizeKB = (stats.size / 1024).toFixed(2);
    
    const totalLines = logLines.length;
    const totalPages = Math.max(1, Math.ceil(totalLines / linesPerPage));
    
    // Get lines for current page (from end)
    const startIdx = Math.max(0, totalLines - ((page + 1) * linesPerPage));
    const endIdx = totalLines - (page * linesPerPage);
    const pageLines = logLines.slice(startIdx, endIdx);
    
    // Format output
    let output = pageLines.join('\n');
    
    // Truncate if too long
    const maxLength = 3800;
    if (output.length > maxLength) {
        output = output.slice(-maxLength);
        output = '...(truncated)\n' + output;
    }
    
    // Color based on type
    const colors = {
        error: client.config.colors.error,
        err: client.config.colors.error,
        out: client.config.colors.success,
        combined: client.config.colors.primary
    };
    
    const icons = {
        error: '🔴',
        err: '🔴',
        out: '🟢',
        combined: '📋'
    };
    
    const embed = new EmbedBuilder()
        .setColor(colors[logType] || client.config.colors.primary)
        .setTitle(`${icons[logType] || '📄'} ${logType.toUpperCase()} Logs`)
        .setDescription(output.length > 0 ? `\`\`\`ansi\n${output}\n\`\`\`` : '*No logs found*');
    
    // Add fields
    const fields = [
        { name: '📊 Total Lines', value: `\`${totalLines.toLocaleString()}\``, inline: true },
        { name: '📄 Page', value: `\`${page + 1}/${totalPages}\``, inline: true },
        { name: '💾 File Size', value: `\`${fileSizeKB} KB\``, inline: true }
    ];
    
    if (searchTerm) {
        fields.push({ name: '🔍 Filter', value: `\`${searchTerm}\``, inline: true });
    }
    
    embed.addFields(fields);
    embed.setFooter({ text: `File: ${logFileName} • Use buttons to navigate` });
    embed.setTimestamp();
    
    return {
        embed,
        logData: { totalLines, totalPages, lines: logLines }
    };
}

function buildSelectMenu(currentType) {
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('logs_type')
            .setPlaceholder('Select log type...')
            .addOptions([
                {
                    label: 'Output Logs',
                    description: 'Standard output logs',
                    value: 'out',
                    emoji: '🟢',
                    default: currentType === 'out'
                },
                {
                    label: 'Error Logs', 
                    description: 'Error and exception logs',
                    value: 'error',
                    emoji: '🔴',
                    default: currentType === 'error'
                },
                {
                    label: 'Combined Logs',
                    description: 'All logs combined',
                    value: 'combined',
                    emoji: '📋',
                    default: currentType === 'combined'
                }
            ])
    );
}

function buildButtons(currentPage, totalPages, totalLines) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('logs_first')
            .setEmoji('⏮️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === 0),
        new ButtonBuilder()
            .setCustomId('logs_prev')
            .setEmoji('◀️')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(currentPage === 0),
        new ButtonBuilder()
            .setCustomId('logs_refresh')
            .setEmoji('🔄')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('logs_next')
            .setEmoji('▶️')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(currentPage >= totalPages - 1),
        new ButtonBuilder()
            .setCustomId('logs_last')
            .setEmoji('⏭️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage >= totalPages - 1)
    );
}

async function buildLogStats(client) {
    const e = client.config.emojis;
    const logsDir = resolve(process.cwd(), 'logs');
    
    const stats = [];
    const logTypes = ['out', 'error', 'combined', 'err'];
    
    for (const type of logTypes) {
        const possibleFiles = [`${type}.log`, `${type}-0.log`];
        
        for (const file of possibleFiles) {
            const path = join(logsDir, file);
            if (existsSync(path)) {
                const fileStats = statSync(path);
                const content = readFileSync(path, 'utf-8');
                const lineCount = content.split('\n').filter(l => l.trim()).length;
                
                stats.push({
                    name: file,
                    size: (fileStats.size / 1024).toFixed(2),
                    lines: lineCount,
                    modified: fileStats.mtime
                });
            }
        }
    }
    
    // Remove duplicates
    const uniqueStats = [...new Map(stats.map(s => [s.name, s])).values()];
    
    const description = uniqueStats.map(s => 
        `📄 **${s.name}**\n` +
        `   └─ Size: \`${s.size} KB\` | Lines: \`${s.lines.toLocaleString()}\``
    ).join('\n\n');
    
    return new EmbedBuilder()
        .setColor(client.config.colors.primary)
        .setTitle(`${e.cloudnote || '📊'} Log Statistics`)
        .setDescription(description || 'No log files found')
        .setFooter({ text: `Logs directory: ${logsDir}` })
        .setTimestamp();
}
