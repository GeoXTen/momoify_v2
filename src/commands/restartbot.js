import { SlashCommandBuilder } from 'discord.js';
import { exec } from 'child_process';

export default {
    data: new SlashCommandBuilder()
        .setName('restartbot')
        .setDescription('🤖 Restart the Discord bot (Owner only)'),
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
                title: '🤖 Restarting Bot',
                description: `${config.emojis.loading || '⏳'} Restarting the Discord bot...\n\nI'll be back online in a few seconds!`,
                fields: [
                    {
                        name: '⏱️ Estimated Time',
                        value: '~5 seconds',
                        inline: true
                    },
                    {
                        name: '📝 Note',
                        value: 'Music will continue playing',
                        inline: true
                    }
                ],
                footer: { text: 'Initiated by ' + interaction.user.tag },
                timestamp: new Date()
            }],
            ephemeral: true
        });
        
        // Log the restart
        console.log(`\n${'='.repeat(50)}`);
        console.log('Bot restart requested by:', interaction.user.tag);
        console.log('Restarting in 2 seconds...');
        console.log(`${'='.repeat(50)}\n`);
        
        // Wait a moment for the message to send, then restart
        setTimeout(() => {
            // Save PM2 process list first, then restart with updated environment
            exec('pm2 save && pm2 restart geomsc --update-env', (error, stdout, stderr) => {
                if (error) {
                    console.log('PM2 restart error:', error.message);
                    // Fallback: exit process (process manager should auto-restart)
                    console.log('Exiting process for restart...');
                    process.exit(0);
                } else {
                    console.log('Bot restart initiated via PM2 with environment update');
                    if (stdout) console.log('PM2 output:', stdout);
                }
            });
        }, 2000);
    }
};
