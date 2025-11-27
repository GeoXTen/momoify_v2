import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { getPrefix, setPrefix, resetPrefix, getDefaultPrefix } from '../utils/prefixManager.js';

export default {
    data: new SlashCommandBuilder()
        .setName('prefix')
        .setDescription('Manage custom text command prefix for this server')
        .addSubcommand(subcommand =>
            subcommand
                .setName('show')
                .setDescription('Show current prefix for this server'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('Set a custom prefix for text commands (Admin only)')
                .addStringOption(option =>
                    option
                        .setName('prefix')
                        .setDescription('New prefix to use (1-5 characters)')
                        .setRequired(true)
                        .setMinLength(1)
                        .setMaxLength(5)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('reset')
                .setDescription('Reset prefix to default (Admin only)'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction, client) {
        const subcommand = interaction.options.getSubcommand();
        
        if (subcommand === 'show') {
            await handleShow(interaction, client);
        } else if (subcommand === 'set') {
            await handleSet(interaction, client);
        } else if (subcommand === 'reset') {
            await handleReset(interaction, client);
        }
    }
};

async function handleShow(interaction, client) {
    const guildId = interaction.guildId;
    const currentPrefix = getPrefix(guildId);
    const defaultPrefix = getDefaultPrefix();
    const isDefault = currentPrefix === defaultPrefix;
    
    const embed = new EmbedBuilder()
        .setColor(client.config.colors.primary)
        .setTitle('⚙️ Server Prefix Configuration')
        .setDescription(`Current text command prefix for **${interaction.guild.name}**`)
        .addFields(
            {
                name: '📝 Current Prefix',
                value: `\`${currentPrefix}\``,
                inline: true
            },
            {
                name: '🔧 Status',
                value: isDefault ? '✓ Using default' : '⭐ Custom prefix',
                inline: true
            },
            {
                name: '💡 Default Prefix',
                value: `\`${defaultPrefix}\``,
                inline: true
            }
        )
        .addFields({
            name: '📖 Usage Examples',
            value: `**Text commands:**\n` +
                   `\`${currentPrefix}play song name\` - Play music\n` +
                   `\`${currentPrefix}skip\` - Skip current track\n` +
                   `\`${currentPrefix}queue\` - Show queue\n` +
                   `\`${currentPrefix}help\` - Show help menu\n\n` +
                   `**Slash commands still work with \`/\`:**\n` +
                   `\`/play\`, \`/skip\`, \`/queue\`, \`/help\``
        })
        .setFooter({
            text: 'Admins can change prefix with /prefix set • Slash commands unaffected',
            iconURL: client.user.displayAvatarURL()
        })
        .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
}

async function handleSet(interaction, client) {
    // Check admin permission
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        const embed = new EmbedBuilder()
            .setColor(client.config.colors.error)
            .setTitle('❌ Permission Denied')
            .setDescription('You need Administrator permission to change the server prefix.')
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed], flags: 64 });
        return;
    }
    
    const newPrefix = interaction.options.getString('prefix');
    const guildId = interaction.guildId;
    const oldPrefix = getPrefix(guildId);
    
    const result = setPrefix(guildId, newPrefix);
    
    if (result.success) {
        const embed = new EmbedBuilder()
            .setColor(client.config.colors.success)
            .setTitle('✅ Prefix Updated')
            .setDescription(`Text command prefix has been updated for **${interaction.guild.name}**`)
            .addFields(
                {
                    name: '📝 Old Prefix',
                    value: `\`${oldPrefix}\``,
                    inline: true
                },
                {
                    name: '✨ New Prefix',
                    value: `\`${newPrefix}\``,
                    inline: true
                },
                {
                    name: '👤 Changed By',
                    value: `${interaction.user}`,
                    inline: true
                }
            )
            .addFields({
                name: '💡 Usage Examples',
                value: `**Old:** \`${oldPrefix}play song\` → **New:** \`${newPrefix}play song\`\n` +
                       `**Old:** \`${oldPrefix}queue\` → **New:** \`${newPrefix}queue\`\n` +
                       `**Old:** \`${oldPrefix}skip\` → **New:** \`${newPrefix}skip\`\n\n` +
                       `⚠️ **Note:** Slash commands (\`/play\`, \`/queue\`, etc.) are not affected.`
            })
            .setFooter({
                text: 'All server members will use this new prefix for text commands',
                iconURL: client.user.displayAvatarURL()
            })
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
        
        console.log(`⚙️  Prefix updated for guild ${interaction.guild.name} (${guildId}): "${oldPrefix}" → "${newPrefix}"`.cyan);
    } else {
        const embed = new EmbedBuilder()
            .setColor(client.config.colors.error)
            .setTitle('❌ Invalid Prefix')
            .setDescription(result.message)
            .addFields({
                name: '📋 Prefix Requirements',
                value: '• Must be 1-5 characters long\n' +
                       '• Cannot start or end with spaces\n' +
                       '• Cannot contain newlines or tabs\n' +
                       '• Can include letters, numbers, symbols'
            })
            .addFields({
                name: '✅ Valid Examples',
                value: '`!`, `?`, `>`, `!!`, `~`, `bot!`, `m.`'
            })
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed], flags: 64 });
    }
}

async function handleReset(interaction, client) {
    // Check admin permission
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        const embed = new EmbedBuilder()
            .setColor(client.config.colors.error)
            .setTitle('❌ Permission Denied')
            .setDescription('You need Administrator permission to reset the server prefix.')
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed], flags: 64 });
        return;
    }
    
    const guildId = interaction.guildId;
    const oldPrefix = getPrefix(guildId);
    
    const result = resetPrefix(guildId);
    
    if (result.success) {
        const embed = new EmbedBuilder()
            .setColor(client.config.colors.success)
            .setTitle('✅ Prefix Reset')
            .setDescription(`Text command prefix has been reset to default for **${interaction.guild.name}**`)
            .addFields(
                {
                    name: '📝 Old Prefix',
                    value: `\`${oldPrefix}\``,
                    inline: true
                },
                {
                    name: '🔧 New Prefix',
                    value: `\`${result.prefix}\` (default)`,
                    inline: true
                },
                {
                    name: '👤 Reset By',
                    value: `${interaction.user}`,
                    inline: true
                }
            )
            .addFields({
                name: '💡 Usage Examples',
                value: `\`${result.prefix}play song\` - Play music\n` +
                       `\`${result.prefix}queue\` - Show queue\n` +
                       `\`${result.prefix}skip\` - Skip track\n` +
                       `\`${result.prefix}help\` - Show help`
            })
            .setFooter({
                text: 'You can set a custom prefix again with /prefix set',
                iconURL: client.user.displayAvatarURL()
            })
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
        
        console.log(`⚙️  Prefix reset for guild ${interaction.guild.name} (${guildId}): "${oldPrefix}" → "${result.prefix}"`.cyan);
    } else {
        const embed = new EmbedBuilder()
            .setColor(client.config.colors.warning)
            .setTitle('ℹ️ Already Using Default')
            .setDescription(result.message)
            .addFields({
                name: '💡 Tip',
                value: `Use \`/prefix set\` to set a custom prefix`
            })
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed], flags: 64 });
    }
}
