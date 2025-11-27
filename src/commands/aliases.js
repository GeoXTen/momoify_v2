import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { loadCustomAliases, saveCustomAliases, getDefaultAliases } from '../utils/aliasManager.js';

export default {
    data: new SlashCommandBuilder()
        .setName('aliases')
        .setDescription('Manage command aliases')
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('Set a command alias')
                .addStringOption(option =>
                    option
                        .setName('alias')
                        .setDescription('The short alias to use (e.g., "p")')
                        .setRequired(true))
                .addStringOption(option =>
                    option
                        .setName('command')
                        .setDescription('The full command name to alias (e.g., "play")')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all configured command aliases'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove a custom alias')
                .addStringOption(option =>
                    option
                        .setName('alias')
                        .setDescription('The alias to remove')
                        .setRequired(true)))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction, client) {
        const subcommand = interaction.options.getSubcommand();
        
        if (subcommand === 'set') {
            await handleSet(interaction, client);
        } else if (subcommand === 'list') {
            await handleList(interaction, client);
        } else if (subcommand === 'remove') {
            await handleRemove(interaction, client);
        }
    }
};

async function handleSet(interaction, client) {
    const alias = interaction.options.getString('alias').toLowerCase().trim();
    const command = interaction.options.getString('command').toLowerCase().trim();
    
    // Validate alias format (no spaces, no special characters except underscore)
    if (!/^[a-z0-9_]+$/i.test(alias)) {
        const embed = new EmbedBuilder()
            .setColor(client.config.colors.error)
            .setTitle('❌ Invalid Alias')
            .setDescription('Alias can only contain letters, numbers, and underscores.')
            .addFields(
                { name: 'Your input', value: `\`${alias}\``, inline: true },
                { name: 'Example', value: '`p`, `np`, `cq`, `my_alias`', inline: true }
            )
            .setTimestamp();
        
        return interaction.reply({ embeds: [embed], flags: 64 });
    }
    
    // Validate that the target command exists
    const commandExists = client.commands.has(command);
    
    if (!commandExists) {
        const embed = new EmbedBuilder()
            .setColor(client.config.colors.error)
            .setTitle('❌ Command Not Found')
            .setDescription(`The command \`${command}\` doesn't exist.`)
            .addFields({
                name: '💡 Tip',
                value: 'Use `/help` to see all available commands.'
            })
            .setTimestamp();
        
        return interaction.reply({ embeds: [embed], flags: 64 });
    }
    
    // Load current custom aliases
    const customAliases = loadCustomAliases();
    const defaultAliases = getDefaultAliases();
    
    // Check if it's a default alias
    const isDefaultAlias = defaultAliases[alias];
    
    // Save the alias
    customAliases[alias] = command;
    saveCustomAliases(customAliases);
    
    const embed = new EmbedBuilder()
        .setColor(client.config.colors.success)
        .setTitle('✅ Alias Set Successfully')
        .setDescription(`The alias \`-${alias}\` now points to \`${command}\``)
        .addFields(
            { name: 'Alias', value: `\`-${alias}\``, inline: true },
            { name: 'Command', value: `\`${command}\``, inline: true },
            { name: 'Usage Example', value: `\`-${alias}\` (in chat)`, inline: false }
        )
        .setFooter({ text: isDefaultAlias ? `⚠️ This overrides a default alias that pointed to "${defaultAliases[alias]}"` : 'Custom alias created' })
        .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
}

async function handleList(interaction, client) {
    const customAliases = loadCustomAliases();
    const defaultAliases = getDefaultAliases();
    const allAliases = { ...defaultAliases, ...customAliases };
    
    if (Object.keys(allAliases).length === 0) {
        const embed = new EmbedBuilder()
            .setColor(client.config.colors.warning)
            .setTitle('📝 Command Aliases')
            .setDescription('No aliases configured yet.')
            .addFields({
                name: '💡 Getting Started',
                value: 'Use `/aliases set` or `-aliases set` to create your first alias!\n\n' +
                       '**Slash command:** `/aliases set alias:p command:play`\n' +
                       '**Text command:** `-aliases set p play`'
            })
            .setTimestamp();
        
        return interaction.reply({ embeds: [embed] });
    }
    
    // Separate default and custom aliases
    const defaultEntries = [];
    const customEntries = [];
    
    for (const [alias, command] of Object.entries(allAliases)) {
        const entry = `\`-${alias}\` → \`${command}\``;
        if (customAliases[alias]) {
            customEntries.push(entry);
        } else {
            defaultEntries.push(entry);
        }
    }
    
    const embed = new EmbedBuilder()
        .setColor(client.config.colors.primary)
        .setTitle('📝 Command Aliases')
        .setDescription('All configured command aliases (use with `-` prefix in chat)')
        .setTimestamp();
    
    // Add default aliases if they exist
    if (defaultEntries.length > 0) {
        const chunks = chunkArray(defaultEntries, 15);
        chunks.forEach((chunk, index) => {
            embed.addFields({
                name: index === 0 ? '🔧 Default Aliases' : '‎',
                value: chunk.join('\n'),
                inline: false
            });
        });
    }
    
    // Add custom aliases if they exist
    if (customEntries.length > 0) {
        const chunks = chunkArray(customEntries, 15);
        chunks.forEach((chunk, index) => {
            embed.addFields({
                name: index === 0 ? '⭐ Custom Aliases' : '‎',
                value: chunk.join('\n'),
                inline: false
            });
        });
    }
    
    embed.addFields({
        name: '💡 Quick Tips',
        value: '• Use short aliases like `-p`, `-s`, `-q` for faster typing\n' +
               '• Create custom aliases: `/aliases set` or `-aliases set`\n' +
               '• Remove custom aliases: `/aliases remove` or `-aliases remove`\n' +
               '• Aliases work only with `-` prefix, not `/`'
    });
    
    await interaction.reply({ embeds: [embed] });
}

async function handleRemove(interaction, client) {
    const alias = interaction.options.getString('alias').toLowerCase().trim();
    const customAliases = loadCustomAliases();
    const defaultAliases = getDefaultAliases();
    
    // Check if it's a default alias
    if (defaultAliases[alias] && !customAliases[alias]) {
        const embed = new EmbedBuilder()
            .setColor(client.config.colors.error)
            .setTitle('❌ Cannot Remove Default Alias')
            .setDescription(`\`-${alias}\` is a default alias and cannot be removed.`)
            .addFields({
                name: 'Alternative',
                value: `You can override it with a custom alias using:\n\`/aliases set alias:${alias} command:your_command\``
            })
            .setTimestamp();
        
        return interaction.reply({ embeds: [embed], flags: 64 });
    }
    
    // Check if the custom alias exists
    if (!customAliases[alias]) {
        const embed = new EmbedBuilder()
            .setColor(client.config.colors.error)
            .setTitle('❌ Alias Not Found')
            .setDescription(`The custom alias \`-${alias}\` doesn't exist.`)
            .addFields({
                name: '💡 Tip',
                value: 'Use `/aliases list` to see all configured aliases.'
            })
            .setTimestamp();
        
        return interaction.reply({ embeds: [embed], flags: 64 });
    }
    
    // Remove the alias
    const removedCommand = customAliases[alias];
    delete customAliases[alias];
    saveCustomAliases(customAliases);
    
    const embed = new EmbedBuilder()
        .setColor(client.config.colors.success)
        .setTitle('✅ Alias Removed')
        .setDescription(`The custom alias \`-${alias}\` has been removed.`)
        .addFields(
            { name: 'Removed Alias', value: `\`-${alias}\``, inline: true },
            { name: 'Was Pointing To', value: `\`${removedCommand}\``, inline: true }
        )
        .setTimestamp();
    
    // Check if it falls back to a default alias
    if (defaultAliases[alias]) {
        embed.setFooter({ text: `ℹ️ This alias now falls back to the default: ${defaultAliases[alias]}` });
    }
    
    await interaction.reply({ embeds: [embed] });
}

// Helper function to chunk array into smaller arrays
function chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}
