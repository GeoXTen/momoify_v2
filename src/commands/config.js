import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { getConfig, setConfigValue, resetConfigValue, getConfigKeys } from '../utils/configManager.js';

export default {
    data: new SlashCommandBuilder()
        .setName('config')
        .setDescription('View or edit bot configuration settings')
        .addSubcommand(subcommand =>
            subcommand
                .setName('show')
                .setDescription('Show current configuration settings'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('Set a configuration value (Owner only)')
                .addStringOption(option =>
                    option
                        .setName('key')
                        .setDescription('Configuration key to set')
                        .setRequired(true)
                        .addChoices(
                            { name: 'botName - Bot display name', value: 'botName' },
                            { name: 'prefix - Text command prefix', value: 'prefix' },
                            { name: 'colors.primary - Primary embed color', value: 'colors.primary' },
                            { name: 'colors.success - Success embed color', value: 'colors.success' },
                            { name: 'colors.error - Error embed color', value: 'colors.error' },
                            { name: 'colors.warning - Warning embed color', value: 'colors.warning' },
                            { name: 'activity.name - Bot activity text', value: 'activity.name' },
                            { name: 'activity.type - Bot activity type', value: 'activity.type' },
                            { name: 'activity.status - Bot status color', value: 'activity.status' }
                        ))
                .addStringOption(option =>
                    option
                        .setName('value')
                        .setDescription('Value to set')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('reset')
                .setDescription('Reset a configuration value to default (Owner only)')
                .addStringOption(option =>
                    option
                        .setName('key')
                        .setDescription('Configuration key to reset')
                        .setRequired(true)
                        .addChoices(
                            { name: 'botName', value: 'botName' },
                            { name: 'prefix', value: 'prefix' },
                            { name: 'colors.primary', value: 'colors.primary' },
                            { name: 'colors.success', value: 'colors.success' },
                            { name: 'colors.error', value: 'colors.error' },
                            { name: 'colors.warning', value: 'colors.warning' },
                            { name: 'activity.name', value: 'activity.name' },
                            { name: 'activity.type', value: 'activity.type' },
                            { name: 'activity.status', value: 'activity.status' }
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('keys')
                .setDescription('List all available configuration keys'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction, client) {
        const subcommand = interaction.options.getSubcommand();
        
        // Check if user is bot owner for set and reset commands
        if ((subcommand === 'set' || subcommand === 'reset') && interaction.user.id !== client.config.ownerId) {
            const embed = new EmbedBuilder()
                .setColor(client.config.colors.error)
                .setTitle('🔒 Owner Only')
                .setDescription(
                    `${client.config.emojis.error} **Only the bot owner can modify configuration!**\n\n` +
                    `**Bot Owner:** <@${client.config.ownerId}>\n\n` +
                    `You can still view the configuration using:\n` +
                    `• \`/config show\` - View current settings\n` +
                    `• \`/config keys\` - List available keys`
                )
                .setFooter({ text: 'Configuration changes are restricted to the bot owner' })
                .setTimestamp();
            
            return interaction.reply({ embeds: [embed], flags: 64 });
        }
        
        if (subcommand === 'show') {
            await handleShow(interaction, client);
        } else if (subcommand === 'set') {
            await handleSet(interaction, client);
        } else if (subcommand === 'reset') {
            await handleReset(interaction, client);
        } else if (subcommand === 'keys') {
            await handleKeys(interaction, client);
        }
    }
};

async function handleShow(interaction, client) {
    const config = getConfig();
    
    // Format colors as hex
    const formatColor = (color) => `#${color.toString(16).padStart(6, '0').toUpperCase()}`;
    
    const embed = new EmbedBuilder()
        .setColor(config.colors.primary)
        .setTitle('⚙️ Bot Configuration')
        .setDescription('Current configuration settings')
        .addFields(
            {
                name: '🤖 Bot Settings',
                value: `**Name:** ${config.botName}\n**Prefix:** \`${config.prefix}\``,
                inline: false
            },
            {
                name: '🎨 Colors',
                value: 
                    `**Primary:** ${formatColor(config.colors.primary)}\n` +
                    `**Success:** ${formatColor(config.colors.success)}\n` +
                    `**Error:** ${formatColor(config.colors.error)}\n` +
                    `**Warning:** ${formatColor(config.colors.warning)}`,
                inline: true
            },
            {
                name: '🎭 Activity',
                value: 
                    `**Name:** ${config.activity.name}\n` +
                    `**Type:** ${config.activity.type}\n` +
                    `**Status:** ${config.activity.status}`,
                inline: true
            },
            {
                name: '💡 Tips',
                value: 
                    '• Use `/config set` or `-config set` to change values\n' +
                    '• Use `/config keys` to see all available keys\n' +
                    '• Use `/config reset` to restore defaults\n' +
                    '• Only the bot owner can edit configuration',
                inline: false
            }
        )
        .setFooter({ 
            text: 'Configuration • Owner Only',
            iconURL: client.user.displayAvatarURL()
        })
        .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
}

async function handleSet(interaction, client) {
    const key = interaction.options.getString('key');
    const value = interaction.options.getString('value');
    
    const result = setConfigValue(key, value);
    
    if (result.success) {
        const config = getConfig();
        
        // Update client.config with the new values
        client.config.botName = config.botName;
        client.config.prefix = config.prefix;
        client.config.colors = config.colors;
        client.config.activity = config.activity;
        
        const embed = new EmbedBuilder()
            .setColor(client.config.colors.success)
            .setTitle('✅ Configuration Updated')
            .setDescription(result.message)
            .addFields(
                { name: 'Key', value: `\`${key}\``, inline: true },
                { name: 'New Value', value: `\`${value}\``, inline: true }
            )
            .setTimestamp();
        
        // Add note about activity changes
        if (key.startsWith('activity.')) {
            embed.setFooter({ text: '⚠️ Activity changes applied immediately!' });
            
            // Update activity in real-time
            try {
                const { ActivityType } = await import('discord.js');
                const activityTypeMap = {
                    'playing': ActivityType.Playing,
                    'streaming': ActivityType.Streaming,
                    'listening': ActivityType.Listening,
                    'watching': ActivityType.Watching,
                    'competing': ActivityType.Competing
                };
                
                const activityType = activityTypeMap[config.activity.type] || ActivityType.Playing;
                
                await client.user.setPresence({
                    status: config.activity.status || 'online',
                    activities: [{
                        name: config.activity.name || '/help | -help',
                        type: activityType
                    }]
                });
                
                console.log(`✓ Activity updated: ${config.activity.name} (${config.activity.type})`.green);
            } catch (error) {
                console.error('Error updating activity:', error);
            }
        } else {
            embed.setFooter({ text: '💡 Changes applied successfully' });
        }
        
        await interaction.reply({ embeds: [embed] });
        
        // Log configuration changes
        if (key === 'botName' || key.startsWith('activity.')) {
            console.log(`⚙️  Configuration updated: ${key} = ${value}`.cyan);
        }
    } else {
        const embed = new EmbedBuilder()
            .setColor(client.config.colors.error)
            .setTitle('❌ Configuration Error')
            .setDescription(result.message)
            .addFields(
                { name: 'Key', value: `\`${key}\``, inline: true },
                { name: 'Value', value: `\`${value}\``, inline: true }
            )
            .setFooter({ text: 'Use /config keys to see valid configuration keys' })
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed], flags: 64 });
    }
}

async function handleReset(interaction, client) {
    const key = interaction.options.getString('key');
    
    const result = resetConfigValue(key);
    
    if (result.success) {
        const config = getConfig();
        
        // Update client.config with the reset values
        client.config.botName = config.botName;
        client.config.prefix = config.prefix;
        client.config.colors = config.colors;
        client.config.activity = config.activity;
        
        const embed = new EmbedBuilder()
            .setColor(client.config.colors.success)
            .setTitle('✅ Configuration Reset')
            .setDescription(result.message)
            .addFields(
                { name: 'Key', value: `\`${key}\``, inline: true },
                { name: 'Status', value: 'Restored to default', inline: true }
            )
            .setTimestamp();
        
        // Add note about activity changes
        if (key.startsWith('activity.')) {
            embed.setFooter({ text: '⚠️ Activity reset applied immediately!' });
            
            // Update activity in real-time
            try {
                const { ActivityType } = await import('discord.js');
                const activityTypeMap = {
                    'playing': ActivityType.Playing,
                    'streaming': ActivityType.Streaming,
                    'listening': ActivityType.Listening,
                    'watching': ActivityType.Watching,
                    'competing': ActivityType.Competing
                };
                
                const activityType = activityTypeMap[config.activity.type] || ActivityType.Playing;
                
                await client.user.setPresence({
                    status: config.activity.status || 'online',
                    activities: [{
                        name: config.activity.name || '/help | -help',
                        type: activityType
                    }]
                });
                
                console.log(`✓ Activity reset to default: ${config.activity.name} (${config.activity.type})`.green);
            } catch (error) {
                console.error('Error updating activity:', error);
            }
        } else {
            embed.setFooter({ text: '💡 Configuration restored to default' });
        }
        
        await interaction.reply({ embeds: [embed] });
        console.log(`⚙️  Configuration reset: ${key}`.cyan);
    } else {
        const embed = new EmbedBuilder()
            .setColor(client.config.colors.error)
            .setTitle('❌ Reset Error')
            .setDescription(result.message)
            .addFields({ name: 'Key', value: `\`${key}\``, inline: true })
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed], flags: 64 });
    }
}

async function handleKeys(interaction, client) {
    const keys = getConfigKeys();
    
    const embed = new EmbedBuilder()
        .setColor(client.config.colors.primary)
        .setTitle('🔑 Available Configuration Keys')
        .setDescription('All editable configuration keys and their descriptions')
        .setTimestamp();
    
    // Group by category
    const categories = {
        'Bot Settings': keys.filter(k => !k.key.includes('.')),
        'Colors': keys.filter(k => k.key.startsWith('colors.')),
        'Activity': keys.filter(k => k.key.startsWith('activity.'))
    };
    
    for (const [category, categoryKeys] of Object.entries(categories)) {
        if (categoryKeys.length > 0) {
            const value = categoryKeys.map(k => 
                `**${k.key}**\n└ ${k.description}\n└ Example: \`${k.example}\``
            ).join('\n\n');
            
            embed.addFields({ name: category, value, inline: false });
        }
    }
    
    embed.addFields({
        name: '📝 Usage Examples',
        value: 
            '**Slash commands:**\n' +
            '`/config set key:botName value:MyBot`\n' +
            '`/config set key:colors.primary value:#FF5733`\n' +
            '`/config reset key:botName`\n\n' +
            '**Text commands:**\n' +
            '`-config set botName MyBot`\n' +
            '`-config set colors.primary #FF5733`\n' +
            '`-config reset botName`',
        inline: false
    });
    
    await interaction.reply({ embeds: [embed] });
}
