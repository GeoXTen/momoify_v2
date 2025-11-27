import { SlashCommandBuilder } from 'discord.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export default {
    data: new SlashCommandBuilder()
        .setName('restart')
        .setDescription('🔄 Restart the bot or Lavalink server (Owner only)')
        .addStringOption(option =>
            option.setName('service')
                .setDescription('Which service to restart')
                .setRequired(true)
                .addChoices(
                    { name: '🤖 Bot Only', value: 'bot' },
                    { name: '🎵 Lavalink Only', value: 'lavalink' },
                    { name: '🔄 Both (Bot + Lavalink)', value: 'both' }
                )
        ),
    category: 'admin',
    
    async execute(interaction, client) {
        const config = client.config;
        
        // Check if user is bot owner
        if (interaction.user.id !== config.ownerId) {
            return interaction.reply({
                embeds: [{
                    color: config.colors.error,
                    title: '❌ Access Denied',
                    description: `${config.emojis.error} This command is only available to the bot owner.`,
                    footer: { text: 'Owner-only command' }
                }],
                ephemeral: true
            });
        }
        
        const service = interaction.options.getString('service');
        
        await interaction.deferReply({ ephemeral: true });
        
        try {
            let message = '';
            let scriptToRun = '';
            
            switch (service) {
                case 'bot':
                    message = '🤖 Restarting bot...';
                    scriptToRun = process.platform === 'win32' ? 'restart-bot.bat' : './restart-bot.sh';
                    break;
                case 'lavalink':
                    message = '🎵 Restarting Lavalink server...';
                    scriptToRun = process.platform === 'win32' ? 'restart-lavalink.bat' : './restart-lavalink.sh';
                    break;
                case 'both':
                    message = '🔄 Restarting both bot and Lavalink...';
                    scriptToRun = process.platform === 'win32' ? 'restart-all.bat' : './restart-all.sh';
                    break;
            }
            
            await interaction.editReply({
                embeds: [{
                    color: config.colors.warning,
                    title: '⚠️ Restart Initiated',
                    description: `${message}\n\nThis may take a few seconds...`,
                    fields: [
                        {
                            name: '📋 Service',
                            value: service === 'bot' ? 'Bot' : service === 'lavalink' ? 'Lavalink' : 'Both',
                            inline: true
                        },
                        {
                            name: '⏱️ Expected Time',
                            value: service === 'both' ? '~15 seconds' : service === 'lavalink' ? '~10 seconds' : '~5 seconds',
                            inline: true
                        }
                    ],
                    footer: { text: 'Initiated by ' + interaction.user.tag }
                }]
            });
            
            // Execute restart script
            if (service === 'bot') {
                // For bot restart, we need to do it through PM2 or process manager
                if (process.platform === 'win32') {
                    exec('pm2 restart discord-bot', (error) => {
                        if (error) {
                            // Fallback: exit process (if using a process manager, it will auto-restart)
                            console.log('Restarting bot via process exit...');
                            setTimeout(() => process.exit(0), 2000);
                        }
                    });
                } else {
                    exec('pm2 restart discord-bot', (error) => {
                        if (error) {
                            console.log('Restarting bot via process exit...');
                            setTimeout(() => process.exit(0), 2000);
                        }
                    });
                }
            } else if (service === 'lavalink') {
                // Restart Lavalink only
                exec(scriptToRun, (error, stdout, stderr) => {
                    if (error) {
                        console.error('Error restarting Lavalink:', error);
                    } else {
                        console.log('Lavalink restart initiated:', stdout);
                    }
                });
            } else {
                // Restart both
                exec(scriptToRun, (error, stdout, stderr) => {
                    if (error) {
                        console.error('Error restarting services:', error);
                    }
                });
                
                // Exit bot process after delay
                setTimeout(() => process.exit(0), 3000);
            }
            
        } catch (error) {
            console.error('Error in restart command:', error);
            
            try {
                await interaction.editReply({
                    embeds: [{
                        color: config.colors.error,
                        title: '❌ Restart Failed',
                        description: `${config.emojis.error} Failed to restart: ${error.message}`,
                        footer: { text: 'Check bot logs for details' }
                    }]
                });
            } catch (replyError) {
                console.error('Could not send error reply:', replyError);
            }
        }
    }
};
