import { Collection, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { resolveAlias } from '../utils/aliasManager.js';
import { getPrefix } from '../utils/prefixManager.js';
import { createQuoteFromMention } from '../utils/quoteGenerator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const adminCommands = new Collection();

export async function loadAdminCommands() {
    const adminPath = join(__dirname, '..', 'admin');
    
    try {
        const adminFiles = (await readdir(adminPath)).filter(file => file.endsWith('.js'));
        
        for (const file of adminFiles) {
            const command = await import(`../admin/${file}`);
            if (command.default?.name) {
                adminCommands.set(command.default.name, command.default);
                console.log(`✓ Loaded admin command: ${command.default.name}`.magenta);
            }
        }
        
        if (adminCommands.size > 0) {
            console.log(`✓ Loaded ${adminCommands.size} admin commands\n`.magenta.bold);
        }
    } catch (error) {
        // Admin commands directory doesn't exist or is empty
    }
}

// Create a mock interaction object from a message for slash command compatibility
function createMockInteraction(message, commandName, args) {
    const replied = { value: false };
    const deferred = { value: false };
    let replyMessage = null;
    
    // Check if first arg might be a subcommand
    const potentialSubcommand = args[0]?.toLowerCase();
    let subcommand = null;
    let subcommandArgs = args;
    
    // For commands that have subcommands (like aliases, config, playlist, search, prefix, lockcommands)
    if (commandName === 'aliases' && potentialSubcommand && ['set', 'list', 'remove'].includes(potentialSubcommand)) {
        subcommand = potentialSubcommand;
        subcommandArgs = args.slice(1);
    } else if (commandName === 'config' && potentialSubcommand && ['show', 'set', 'reset', 'keys'].includes(potentialSubcommand)) {
        subcommand = potentialSubcommand;
        subcommandArgs = args.slice(1);
    } else if (commandName === 'playlist' && potentialSubcommand && ['create', 'list', 'play', 'delete', 'add', 'remove', 'show'].includes(potentialSubcommand)) {
        subcommand = potentialSubcommand;
        subcommandArgs = args.slice(1);
    } else if (commandName === 'search' && potentialSubcommand && ['youtube', 'youtubemusic', 'soundcloud', 'spotify', 'deezer', 'applemusic', 'bandcamp', 'jiosaavn'].includes(potentialSubcommand)) {
        subcommand = potentialSubcommand;
        subcommandArgs = args.slice(1);
    } else if (commandName === 'prefix' && potentialSubcommand && ['show', 'set', 'reset'].includes(potentialSubcommand)) {
        subcommand = potentialSubcommand;
        subcommandArgs = args.slice(1);
    } else if (commandName === 'lockcommands' && potentialSubcommand && ['lock', 'unlock', 'status'].includes(potentialSubcommand)) {
        subcommand = potentialSubcommand;
        subcommandArgs = args.slice(1);
    }
    
    return {
        guild: message.guild,
        guildId: message.guild?.id,
        channel: message.channel,
        channelId: message.channel.id,
        user: message.author,
        member: message.member,
        commandName: commandName,
        replied: false,
        deferred: false,
        
        // Mock methods for slash command detection
        isCommand: () => false,
        isChatInputCommand: () => false,
        
        // Mock options for different command types
        options: {
            getSubcommand: () => {
                return subcommand;
            },
            getString: (name) => {
                // Handle aliases subcommand options
                if (commandName === 'aliases') {
                    if (subcommand === 'set') {
                        if (name === 'alias') return subcommandArgs[0] || null;
                        if (name === 'command') return subcommandArgs[1] || null;
                    }
                    if (subcommand === 'remove') {
                        if (name === 'alias') return subcommandArgs[0] || null;
                    }
                }
                
                // Handle config subcommand options
                if (commandName === 'config') {
                    if (subcommand === 'set') {
                        if (name === 'key') return subcommandArgs[0] || null;
                        if (name === 'value') return subcommandArgs.slice(1).join(' ') || null;
                    }
                    if (subcommand === 'reset') {
                        if (name === 'key') return subcommandArgs[0] || null;
                    }
                }
                
                // Handle prefix subcommand options
                if (commandName === 'prefix') {
                    if (subcommand === 'set') {
                        if (name === 'prefix') return subcommandArgs[0] || null;
                    }
                }
                
                // Handle lockcommands options
                if (commandName === 'lockcommands') {
                    if (name === 'action') {
                        // Map subcommand or first arg to action
                        return subcommand || subcommandArgs[0] || null;
                    }
                }
                
                // Handle playlist subcommand options
                if (commandName === 'playlist') {
                    if (name === 'name') {
                        // For remove subcommand, exclude the last arg (position)
                        if (subcommand === 'remove') {
                            return subcommandArgs.slice(0, -1).join(' ') || null;
                        }
                        // For add subcommand with track parameter
                        // Format: -playlist add PlaylistName track Song Name
                        if (subcommand === 'add') {
                            // Find 'track' keyword position
                            const trackIndex = subcommandArgs.findIndex(arg => arg.toLowerCase() === 'track');
                            if (trackIndex > 0) {
                                // Return playlist name (everything before 'track')
                                return subcommandArgs.slice(0, trackIndex).join(' ') || null;
                            }
                            // No track keyword, just playlist name
                            return subcommandArgs.join(' ') || null;
                        }
                        // For all other subcommands, join all args as playlist name
                        return subcommandArgs.join(' ') || null;
                    }
                    if (name === 'track') {
                        // For add subcommand, extract track after 'track' keyword
                        if (subcommand === 'add') {
                            const trackIndex = subcommandArgs.findIndex(arg => arg.toLowerCase() === 'track');
                            if (trackIndex >= 0 && trackIndex < subcommandArgs.length - 1) {
                                // Return everything after 'track' keyword
                                return subcommandArgs.slice(trackIndex + 1).join(' ') || null;
                            }
                        }
                        return null;
                    }
                }
                
                // Handle search subcommand options
                if (commandName === 'search') {
                    if (name === 'query') {
                        // Check if first arg is a type keyword
                        const validTypes = ['track', 'playlist', 'album', 'artist'];
                        if (subcommandArgs.length > 1 && validTypes.includes(subcommandArgs[0].toLowerCase())) {
                            // Skip the type keyword and use rest as query
                            return subcommandArgs.slice(1).join(' ') || null;
                        }
                        // All args are the query
                        return subcommandArgs.join(' ') || null;
                    }
                    if (name === 'type') {
                        // Check if first arg is a type keyword
                        const validTypes = ['track', 'playlist', 'album', 'artist'];
                        if (subcommandArgs.length > 0 && validTypes.includes(subcommandArgs[0].toLowerCase())) {
                            return subcommandArgs[0].toLowerCase();
                        }
                        // Default to track
                        return 'track';
                    }
                }
                
                // Handle regular command options
                if (name === 'song' || name === 'query' || name === 'position') {
                    return subcommandArgs.join(' ') || null;
                }
                if (name === 'filter') {
                    return subcommandArgs[0] || null;
                }
                return subcommandArgs[0] || null;
            },
            getInteger: (name) => {
                // Handle playlist remove position (last argument)
                if (commandName === 'playlist' && subcommand === 'remove' && name === 'position') {
                    const num = parseInt(subcommandArgs[subcommandArgs.length - 1]);
                    return isNaN(num) ? null : num;
                }
                
                if (name === 'amount' || name === 'volume' || name === 'position' || name === 'level') {
                    const num = parseInt(subcommandArgs[0]);
                    return isNaN(num) ? null : num;
                }
                return null;
            },
            getNumber: (name) => {
                // Handle numeric options for commands like pitch, rate, speed
                if (name === 'value' || name === 'volume') {
                    const num = parseFloat(subcommandArgs[0]);
                    return isNaN(num) ? null : num;
                }
                return null;
            },
            getBoolean: (name) => {
                return null;
            }
        },
        
        async deferReply() {
            if (deferred.value || replied.value) return;
            deferred.value = true;
            this.deferred = true;
            // Send a "thinking" message
            replyMessage = await message.reply('⏳ Processing...').catch(() => null);
        },
        
        async reply(options) {
            if (replied.value) throw new Error('Already replied');
            replied.value = true;
            this.replied = true;
            
            const content = typeof options === 'string' ? options : options.content;
            const embeds = typeof options === 'object' ? options.embeds : undefined;
            const components = typeof options === 'object' ? options.components : undefined;
            
            replyMessage = await message.reply({ content, embeds, components });
            return replyMessage;
        },
        
        async editReply(options) {
            if (!deferred.value && !replied.value) {
                // Not deferred yet, just reply
                return this.reply(options);
            }
            
            const content = typeof options === 'string' ? options : options.content;
            const embeds = typeof options === 'object' ? options.embeds : undefined;
            const components = typeof options === 'object' ? options.components : undefined;
            
            if (replyMessage) {
                return await replyMessage.edit({ content, embeds, components });
            } else {
                // Fallback: send new message
                replyMessage = await message.reply({ content, embeds, components });
                return replyMessage;
            }
        },
        
        async followUp(options) {
            const content = typeof options === 'string' ? options : options.content;
            const embeds = typeof options === 'object' ? options.embeds : undefined;
            const components = typeof options === 'object' ? options.components : undefined;
            
            return await message.channel.send({ content, embeds, components });
        }
    };
}



export async function handleMessageCommand(message, client) {
    // Ignore bots
    if (message.author.bot) return;
    
    // Get custom prefix for this guild
    const guildPrefix = getPrefix(message.guildId);
    
    // Check if bot is mentioned
    if (message.mentions.has(client.user.id) && !message.content.startsWith(guildPrefix)) {
        const botMention = `<@${client.user.id}>`;
        const botMentionNick = `<@!${client.user.id}>`;
        
        // PRIORITY 1: Check if this is a reply to another message (for quote generation)
        if (message.reference && message.reference.messageId) {
            try {
                const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
                
                // Don't quote bot messages
                if (repliedMessage.author.bot) {
                    return await message.reply({
                        content: '❌ Cannot create quotes from bot messages!',
                        flags: 64
                    });
                }
                
                // Don't quote empty messages
                if (!repliedMessage.content || repliedMessage.content.trim().length === 0) {
                    return await message.reply({
                        content: '❌ Cannot create quotes from empty messages!',
                        flags: 64
                    });
                }
                
                // Parse options from the mention message
                let optionsText = message.content.replace(botMention, '').replace(botMentionNick, '').trim();
                
                // Generate the quote
                const quoteAttachment = await createQuoteFromMention(repliedMessage, optionsText);
                
                // Check if canvas is not available
                if (!quoteAttachment) {
                    return await message.reply({
                        content: '❌ Quote generation is currently unavailable. The canvas library needs to be installed on this server.',
                        flags: 64
                    });
                }
                
                // Create "Remove my Quote" button
                const removeButton = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`remove_quote_${message.author.id}_${repliedMessage.id}`)
                            .setLabel('Remove my Quote')
                            .setEmoji('🗑️')
                            .setStyle(ButtonStyle.Danger)
                    );
                
                // Send the quote image
                return await message.reply({
                    files: [quoteAttachment],
                    components: [removeButton]
                });
                
            } catch (error) {
                console.error('Error generating quote:', error);
                return await message.reply({
                    content: '❌ Failed to generate quote. Please try again!',
                    flags: 64
                });
            }
        }
        
        // PRIORITY 2: Regular mention (not a reply) - show bot info/guide
        // Only respond if the message is just the mention or starts with mention
        if (message.content.trim() === botMention || message.content.trim() === botMentionNick || 
            message.content.startsWith(botMention + ' ') || message.content.startsWith(botMentionNick + ' ')) {
            
            const embed = {
                color: client.config.colors.primary,
                title: `${client.config.emojis.melody} Hey! I'm ${client.config.botName}`,
                description: `I'm a high-quality music bot for Discord!\n\n` +
                           `You can control me using **multiple features:**`,
                fields: [
                    {
                        name: `${client.config.emojis.control} Text Commands (Prefix: \`${guildPrefix}\`)`,
                        value: '```\n' +
                               `${guildPrefix}play <song>      # Play music (alias: ${guildPrefix}p)\n` +
                               `${guildPrefix}skip              # Skip track (alias: ${guildPrefix}s)\n` +
                               `${guildPrefix}pause             # Pause/resume (alias: ${guildPrefix}pau)\n` +
                               `${guildPrefix}queue             # Show queue (alias: ${guildPrefix}q)\n` +
                               `${guildPrefix}volume <1-200>    # Set volume (alias: ${guildPrefix}v)\n` +
                               `${guildPrefix}seek <position>   # Seek position\n` +
                               `${guildPrefix}help              # Full command list (alias: ${guildPrefix}h)\n` +
                               '```\n' +
                               `${client.config.emojis.stars} **Tip:** Use short aliases like \`${guildPrefix}p\`, \`${guildPrefix}s\`, \`${guildPrefix}q\` for faster typing!`,
                        inline: false
                    },
                    {
                        name: `${client.config.emojis.refresh} Slash Commands (Prefix: \`/\`)`,
                        value: '```\n' +
                               '/play <song>      # Play music (with autocomplete!)\n' +
                               '/skip              # Skip track\n' +
                               '/pause             # Pause/resume\n' +
                               '/queue             # Show queue\n' +
                               '/volume <1-200>    # Set volume\n' +
                               '/seek <position>   # Seek position\n' +
                               '/help              # Full command list\n' +
                               '```',
                        inline: false
                    },
                    {
                        name: `💬 Quote Generator (NEW!)`,
                        value: `Reply to any message and mention me to create a beautiful quote image!\n\n` +
                               `**Options:** \`light\` (white bg), \`bold\` (bold text), \`flip\` (flip layout), \`color\` (colored avatar)\n\n` +
                               `**Example:** Reply to a message with \`@${client.user.username} light, bold\``,
                        inline: false
                    },
                    {
                        name: `${client.config.emojis.note1} Quick Start`,
                        value: '1. Join a voice channel\n' +
                               `2. Use \`${guildPrefix}play song name\` or \`/play song name\`\n` +
                               '3. Control playback with buttons or commands!\n\n' +
                               '**Both command types work the same way!**',
                        inline: false
                    },
                    {
                        name: `${client.config.emojis.stars} Key Features`,
                        value: `${client.config.emojis.play} **High-Quality Playback** - Crystal clear audio streaming\n` +
                               `${client.config.emojis.loop} **Smart Autoplay** - Automatic queue continuation\n` +
                               `${client.config.emojis.shuffle} **Multiple Sources** - YouTube, Spotify, SoundCloud & more\n` +
                               `${client.config.emojis.queue} **Playlist Support** - Save and manage your playlists\n` +
                               `${client.config.emojis.filters} **Audio Filters** - Bass boost, nightcore, and more effects\n` +
                               `💬 **Quote Generator** - Create beautiful quote images`,
                        inline: false
                    },
                    {
                        name: `${client.config.emojis.cloudnote} More Info`,
                        value: `Use \`${guildPrefix}help\` or \`/help\` for all commands\n` +
                               `Use \`${guildPrefix}about\` or \`/about\` for bot info\n` +
                               `Use \`/prefix\` to customize the text command prefix`,
                        inline: false
                    }
                ],
                footer: {
                    text: `v2.2.1 • Requested by ${message.author.tag}`,
                    iconURL: message.author.displayAvatarURL()
                },
                timestamp: new Date().toISOString()
            };
            
            await message.reply({ embeds: [embed] }).catch(() => {});
            return;
        }
    }
    
    // Check for command prefix (use custom prefix for this guild)
    if (!message.content.startsWith(guildPrefix)) return;
    
    const args = message.content.slice(guildPrefix.length).trim().split(/ +/);
    let commandName = args.shift()?.toLowerCase();
    
    if (!commandName) return;
    
    // Check for alias and resolve to full command name
    const resolvedCommand = resolveAlias(commandName) || commandName;
    
    // Check admin commands first
    const adminCommand = adminCommands.get(resolvedCommand);
    
    if (adminCommand) {
        // Owner-only check
        if (adminCommand.ownerOnly && message.author.id !== client.config.ownerId) {
            // Send ephemeral-like error message for owner-only commands
            const errorEmbed = {
                color: client.config.colors.error,
                title: `${client.config.emojis.lock} Owner Only Command`,
                description: `${client.config.emojis.error} **This command is restricted to the bot owner only!**\n\n` +
                           `**Bot Owner:** <@${client.config.ownerId}>\n\n` +
                           `Only the bot owner can use administrative commands like \`${guildPrefix}${resolvedCommand}\`.`,
                footer: { text: 'Unauthorized access attempt' },
                timestamp: new Date().toISOString()
            };
            
            await message.reply({ embeds: [errorEmbed] })
                .then(msg => {
                    // Auto-delete after 10 seconds
                    setTimeout(() => {
                        msg.delete().catch(() => {});
                        message.delete().catch(() => {});
                    }, 10000);
                })
                .catch(() => {});
            return;
        }
        
        try {
            await adminCommand.execute(message, args, client);
        } catch (error) {
            console.error(`Error executing admin command ${resolvedCommand}:`.red, error);
            await message.reply(`❌ Error: ${error.message}`).catch(() => {});
        }
        return;
    }
    
    // Check regular slash commands
    const slashCommand = client.commands.get(resolvedCommand);
    
    if (slashCommand) {
        // Check if commands are locked (except for lockcommands itself)
        if (resolvedCommand !== 'lockcommands') {
            try {
                const { areCommandsLocked, canBypassLock } = await import('../commands/lockcommands.js');
                
                if (areCommandsLocked(message.guildId) && !canBypassLock(message.author.id, client)) {
                    const lockEmbed = {
                        color: client.config.colors.error,
                        title: '🔒 Commands Locked',
                        description: `${client.config.emojis.error} **All commands are currently locked!**\n\n` +
                                   `Only the bot owner can use commands right now.\n\n` +
                                   `**Bot Owner:** <@${client.config.ownerId}>\n\n` +
                                   `Contact an administrator if you believe this is a mistake.`,
                        footer: { text: 'This server has restricted bot usage to the owner only' }
                    };
                    
                    await message.reply({ embeds: [lockEmbed] }).catch(() => {});
                    return;
                }
            } catch (error) {
                console.error('Error checking command lock:', error);
            }
        }
        
        try {
            // Create a mock interaction object
            const mockInteraction = createMockInteraction(message, resolvedCommand, args);
            
            // Execute the slash command with the mock interaction
            await slashCommand.execute(mockInteraction, client);
        } catch (error) {
            console.error(`Error executing command ${resolvedCommand}:`.red, error);
            await message.reply(`❌ Error: ${error.message}`).catch(() => {});
        }
    }
}
