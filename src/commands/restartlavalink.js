import { SlashCommandBuilder } from 'discord.js';
import { exec } from 'child_process';

export default {
    data: new SlashCommandBuilder()
        .setName('restartlavalink')
        .setDescription('🎵 Restart the Lavalink server (Owner only)'),
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
        
        await interaction.reply({
            embeds: [{
                color: config.colors.warning,
                title: '🎵 Restarting Lavalink',
                description: `${config.emojis.loading || '⏳'} Restarting Lavalink server...\n\nThis will take approximately 10 seconds.`,
                fields: [
                    {
                        name: '⚠️ Note',
                        value: 'Music playback will be interrupted temporarily'
                    }
                ],
                footer: { text: 'Initiated by ' + interaction.user.tag },
                timestamp: new Date()
            }],
            ephemeral: true
        });
        
        try {
            const scriptToRun = process.platform === 'win32' ? 'restart-lavalink.bat' : './restart-lavalink.sh';
            
            exec(scriptToRun, (error, stdout, stderr) => {
                if (error) {
                    console.error('Error restarting Lavalink:', error);
                    interaction.followUp({
                        embeds: [{
                            color: config.colors.error,
                            title: '❌ Lavalink Restart Failed',
                            description: `${config.emojis.error} Failed to restart Lavalink:\n\`\`\`${error.message}\`\`\``,
                            footer: { text: 'Check server logs for details' }
                        }],
                        ephemeral: true
                    }).catch(() => {});
                } else {
                    console.log('Lavalink restart output:', stdout);
                    
                    setTimeout(() => {
                        interaction.followUp({
                            embeds: [{
                                color: config.colors.success,
                                title: '✅ Lavalink Restarted',
                                description: `${config.emojis.success || '✅'} Lavalink server has been restarted successfully!\n\nMusic playback should resume shortly.`,
                                footer: { text: 'Restart completed' },
                                timestamp: new Date()
                            }],
                            ephemeral: true
                        }).catch(() => {});
                    }, 10000);
                }
            });
            
        } catch (error) {
            console.error('Error executing Lavalink restart:', error);
            
            await interaction.followUp({
                embeds: [{
                    color: config.colors.error,
                    title: '❌ Restart Failed',
                    description: `${config.emojis.error} An error occurred:\n\`\`\`${error.message}\`\`\``
                }],
                ephemeral: true
            }).catch(() => {});
        }
    }
};
