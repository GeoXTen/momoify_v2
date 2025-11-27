import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', '..', 'data');
const lockFile = join(dataDir, 'command-locks.json');

// In-memory cache for performance
let commandLocks = new Map();

// Load locks from file
async function loadLocks() {
    try {
        if (!existsSync(dataDir)) {
            await mkdir(dataDir, { recursive: true });
        }
        
        if (existsSync(lockFile)) {
            const data = await readFile(lockFile, 'utf8');
            const locks = JSON.parse(data);
            commandLocks = new Map(Object.entries(locks));
            console.log(`✓ Loaded ${commandLocks.size} command locks`.green);
        }
    } catch (error) {
        console.error('Error loading command locks:', error.message);
        commandLocks = new Map();
    }
}

// Save locks to file
async function saveLocks() {
    try {
        if (!existsSync(dataDir)) {
            await mkdir(dataDir, { recursive: true });
        }
        
        const locks = Object.fromEntries(commandLocks);
        await writeFile(lockFile, JSON.stringify(locks, null, 2));
    } catch (error) {
        console.error('Error saving command locks:', error.message);
    }
}

// Initialize on module load
await loadLocks();

// Check if commands are locked for a guild
export function areCommandsLocked(guildId) {
    return commandLocks.get(guildId) === true;
}

// Check if user can bypass command lock
export function canBypassLock(userId, client) {
    return userId === client.config.ownerId;
}

export default {
    data: new SlashCommandBuilder()
        .setName('lockcommands')
        .setDescription('Lock/unlock bot commands to owner only (Admin)')
        .addStringOption(option =>
            option.setName('action')
                .setDescription('Lock or unlock commands')
                .setRequired(true)
                .addChoices(
                    { name: 'Lock (Owner Only)', value: 'lock' },
                    { name: 'Unlock (Everyone)', value: 'unlock' },
                    { name: 'Status', value: 'status' }
                )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction, client) {
        const action = interaction.options.getString('action');
        const guildId = interaction.guildId;
        const isLocked = commandLocks.get(guildId) === true;
        
        // Only bot owner can lock/unlock commands
        if (action !== 'status' && interaction.user.id !== client.config.ownerId) {
            return interaction.reply({
                embeds: [{
                    color: client.config.colors.error,
                    description: `${client.config.emojis.error} Only the bot owner can lock/unlock commands!\n\n` +
                               `**Bot Owner:** <@${client.config.ownerId}>`
                }],
                flags: 64
            });
        }
        
        switch (action) {
            case 'lock':
                if (isLocked) {
                    return interaction.reply({
                        embeds: [{
                            color: client.config.colors.warning,
                            description: `🔒 Commands are already locked in this server!\n\n` +
                                       `Only <@${client.config.ownerId}> can use commands.`
                        }],
                        flags: 64
                    });
                }
                
                commandLocks.set(guildId, true);
                await saveLocks();
                
                await interaction.reply({
                    embeds: [{
                        color: client.config.colors.success,
                        title: '🔒 Commands Locked',
                        description: `${client.config.emojis.success} **All commands are now locked!**\n\n` +
                                   `**Only the bot owner can use commands:**\n` +
                                   `<@${client.config.ownerId}>\n\n` +
                                   `**This applies to:**\n` +
                                   `• All slash commands (/play, /queue, etc.)\n` +
                                   `• All text commands (-play, -queue, etc.)\n\n` +
                                   `**To unlock:** Use \`/lockcommands unlock\` or \`-lockcommands unlock\``,
                        footer: { text: 'Server administrators cannot bypass this lock' }
                    }]
                });
                
                console.log(`🔒 Commands locked in guild ${guildId} by ${interaction.user.tag}`.yellow);
                break;
                
            case 'unlock':
                if (!isLocked) {
                    return interaction.reply({
                        embeds: [{
                            color: client.config.colors.warning,
                            description: `🔓 Commands are already unlocked in this server!\n\n` +
                                       `Everyone can use commands normally.`
                        }],
                        flags: 64
                    });
                }
                
                commandLocks.delete(guildId);
                await saveLocks();
                
                await interaction.reply({
                    embeds: [{
                        color: client.config.colors.success,
                        title: '🔓 Commands Unlocked',
                        description: `${client.config.emojis.success} **All commands are now unlocked!**\n\n` +
                                   `Everyone can use commands normally.\n\n` +
                                   `**To lock again:** Use \`/lockcommands lock\` or \`-lockcommands lock\``
                    }]
                });
                
                console.log(`🔓 Commands unlocked in guild ${guildId} by ${interaction.user.tag}`.green);
                break;
                
            case 'status':
                const statusEmbed = {
                    color: isLocked ? client.config.colors.error : client.config.colors.success,
                    title: isLocked ? '🔒 Commands Locked' : '🔓 Commands Unlocked',
                    fields: [
                        {
                            name: '📊 Current Status',
                            value: isLocked 
                                ? `Commands are **LOCKED** 🔒\nOnly <@${client.config.ownerId}> can use them.`
                                : `Commands are **UNLOCKED** 🔓\nEveryone can use them.`,
                            inline: false
                        },
                        {
                            name: '👑 Bot Owner',
                            value: `<@${client.config.ownerId}>`,
                            inline: true
                        },
                        {
                            name: '🎯 Applies To',
                            value: 'All slash & text commands',
                            inline: true
                        }
                    ],
                    footer: { 
                        text: isLocked 
                            ? 'Only the bot owner can lock/unlock commands' 
                            : 'Administrators can view this status'
                    }
                };
                
                await interaction.reply({
                    embeds: [statusEmbed],
                    flags: 64
                });
                break;
        }
    }
};
