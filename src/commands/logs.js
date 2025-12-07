import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, resolve } from 'path';

export default {
    data: new SlashCommandBuilder()
        .setName('logs')
        .setDescription('View and manage bot logs (Owner only)')
        .addStringOption(option =>
            option
                .setName('type')
                .setDescription('Type of logs to view')
                .setRequired(false)
                .addChoices(
                    { name: '🟢 Output Logs', value: 'out' },
                    { name: '🔴 Error Logs', value: 'error' },
                    { name: '📋 Combined Logs', value: 'combined' }
                ))
        .addIntegerOption(option =>
            option
                .setName('lines')
                .setDescription('Number of lines per page (default: 30)')
                .setRequired(false)
                .setMinValue(10)
                .setMaxValue(50))
        .addStringOption(option =>
            option
                .setName('search')
                .setDescription('Filter logs containing this text')
                .setRequired(false)),
    
    ownerOnly: true,
    
    async execute(interaction, client) {
        // Check if user is owner
        if (interaction.user.id !== client.config.ownerId) {
            return interaction.reply({
                embeds: [{
                    color: client.config.colors.error,
                    title: '❌ Access Denied',
                    description: 'This command is only available to the bot owner.'
                }],
                ephemeral: true
            });
        }
        
        await interaction.deferReply();
        
        const e = client.config.emojis;
        let logType = interaction.options.getString('type') || 'out';
        const linesPerPage = interaction.options.getInteger('lines') || 30;
        const searchTerm = interaction.options.getString('search') || null;
        let currentPage = 0;
        
        // Build initial embed
        const { embed, logData } = await buildLogsEmbed(client, logType, searchTerm, currentPage, linesPerPage);
        const row1 = buildSelectMenu(logType);
        const row2 = buildButtons(currentPage, logData.totalPages);
        
        const replyMsg = await interaction.editReply({
            embeds: [embed],
            components: [row1, row2]
        });
        
        // Session data
        const sessionData = { logType, searchTerm, currentPage, logData, linesPerPage };
        
        // Collector
        const collector = replyMsg.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id,
            time: 300000
        });
        
        collector.on('collect', async i => {
            if (i.isStringSelectMenu()) {
                sessionData.logType = i.values[0];
                sessionData.currentPage = 0;
                
                await i.deferUpdate();
                const { embed: newEmbed, logData: newData } = await buildLogsEmbed(
                    client, sessionData.logType, sessionData.searchTerm,
                    sessionData.currentPage, sessionData.linesPerPage
                );
                sessionData.logData = newData;
                
                await i.editReply({
                    embeds: [newEmbed],
                    components: [buildSelectMenu(sessionData.logType), buildButtons(sessionData.currentPage, newData.totalPages)]
                });
                
            } else if (i.isButton()) {
                await i.deferUpdate();
                
                if (i.customId === 'logs_first') sessionData.currentPage = 0;
                else if (i.customId === 'logs_prev') sessionData.currentPage = Math.max(0, sessionData.currentPage - 1);
                else if (i.customId === 'logs_next') sessionData.currentPage = Math.min(sessionData.logData.totalPages - 1, sessionData.currentPage + 1);
                else if (i.customId === 'logs_last') sessionData.currentPage = sessionData.logData.totalPages - 1;
                else if (i.customId === 'logs_download') {
                    const logsDir = resolve(process.cwd(), 'logs');
                    const possibleFiles = [`${sessionData.logType}.log`, `${sessionData.logType}-0.log`];
                    
                    for (const file of possibleFiles) {
                        const path = join(logsDir, file);
                        if (existsSync(path)) {
                            const content = readFileSync(path, 'utf-8');
                            await i.followUp({
                                content: `✅ Full ${sessionData.logType} log file:`,
                                files: [{ attachment: Buffer.from(content), name: `${sessionData.logType}-logs.txt` }],
                                ephemeral: true
                            });
                            break;
                        }
                    }
                    return;
                }
                
                const { embed: newEmbed, logData: newData } = await buildLogsEmbed(
                    client, sessionData.logType, sessionData.searchTerm,
                    sessionData.currentPage, sessionData.linesPerPage
                );
                sessionData.logData = newData;
                
                await i.editReply({
                    embeds: [newEmbed],
                    components: [buildSelectMenu(sessionData.logType), buildButtons(sessionData.currentPage, newData.totalPages)]
                });
            }
        });
        
        collector.on('end', async () => {
            try {
                const disabledRow1 = ActionRowBuilder.from(replyMsg.components[0]);
                const disabledRow2 = ActionRowBuilder.from(replyMsg.components[1]);
                disabledRow1.components.forEach(c => c.setDisabled(true));
                disabledRow2.components.forEach(c => c.setDisabled(true));
                await interaction.editReply({ components: [disabledRow1, disabledRow2] });
            } catch {}
        });
    }
};

async function buildLogsEmbed(client, logType, searchTerm, page, linesPerPage) {
    const logsDir = resolve(process.cwd(), 'logs');
    const possibleFiles = [`${logType}.log`, `${logType}-0.log`, `${logType === 'error' ? 'err' : logType}.log`];
    
    let logPath = null, logFileName = null;
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
                .setTitle('❌ Log File Not Found')
                .setDescription(`Could not find: ${possibleFiles.map(f => `\`${f}\``).join(', ')}`)
                .setTimestamp(),
            logData: { totalLines: 0, totalPages: 0 }
        };
    }
    
    const content = readFileSync(logPath, 'utf-8');
    let logLines = content.split('\n').filter(l => l.trim());
    
    if (searchTerm) {
        logLines = logLines.filter(l => l.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    
    const stats = statSync(logPath);
    const totalLines = logLines.length;
    const totalPages = Math.max(1, Math.ceil(totalLines / linesPerPage));
    
    const startIdx = Math.max(0, totalLines - ((page + 1) * linesPerPage));
    const endIdx = totalLines - (page * linesPerPage);
    const pageLines = logLines.slice(startIdx, endIdx);
    
    let output = pageLines.join('\n');
    if (output.length > 3800) {
        output = '...(truncated)\n' + output.slice(-3800);
    }
    
    const colors = { error: client.config.colors.error, out: client.config.colors.success, combined: client.config.colors.primary };
    const icons = { error: '🔴', out: '🟢', combined: '📋' };
    
    const embed = new EmbedBuilder()
        .setColor(colors[logType] || client.config.colors.primary)
        .setTitle(`${icons[logType] || '📄'} ${logType.toUpperCase()} Logs`)
        .setDescription(output ? `\`\`\`ansi\n${output}\n\`\`\`` : '*No logs found*')
        .addFields(
            { name: '📊 Lines', value: `\`${totalLines.toLocaleString()}\``, inline: true },
            { name: '📄 Page', value: `\`${page + 1}/${totalPages}\``, inline: true },
            { name: '💾 Size', value: `\`${(stats.size / 1024).toFixed(2)} KB\``, inline: true }
        )
        .setFooter({ text: `File: ${logFileName}` })
        .setTimestamp();
    
    if (searchTerm) embed.addFields({ name: '🔍 Filter', value: `\`${searchTerm}\``, inline: true });
    
    return { embed, logData: { totalLines, totalPages } };
}

function buildSelectMenu(currentType) {
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('logs_type')
            .setPlaceholder('Select log type...')
            .addOptions([
                { label: 'Output Logs', value: 'out', emoji: '🟢', default: currentType === 'out' },
                { label: 'Error Logs', value: 'error', emoji: '🔴', default: currentType === 'error' },
                { label: 'Combined Logs', value: 'combined', emoji: '📋', default: currentType === 'combined' }
            ])
    );
}

function buildButtons(currentPage, totalPages) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('logs_first').setEmoji('⏮️').setStyle(ButtonStyle.Secondary).setDisabled(currentPage === 0),
        new ButtonBuilder().setCustomId('logs_prev').setEmoji('◀️').setStyle(ButtonStyle.Primary).setDisabled(currentPage === 0),
        new ButtonBuilder().setCustomId('logs_refresh').setEmoji('🔄').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('logs_next').setEmoji('▶️').setStyle(ButtonStyle.Primary).setDisabled(currentPage >= totalPages - 1),
        new ButtonBuilder().setCustomId('logs_download').setEmoji('📥').setStyle(ButtonStyle.Secondary)
    );
}
