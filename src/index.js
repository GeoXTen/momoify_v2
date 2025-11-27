import { Client, GatewayIntentBits, ActivityType, Collection } from 'discord.js';
import { LavalinkManager } from 'lavalink-client';
import { readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import config from './config.js';
import { handleButtonInteraction } from './handlers/buttonHandler.js';
import { loadAdminCommands, handleMessageCommand } from './handlers/messageHandler.js';
// import { toBold } from './utils/textFormat.js';
import { trackPlay } from './utils/statsTracker.js';
import { createStatsAPI } from './api/stats.js';
import { createNowPlayingEmbed, createNowPlayingButtons } from './utils/nowPlayingUtils.js';
import { is247Enabled } from './commands/247.js';
import colors from 'colors';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Register custom fonts (optional - for quote feature)
try {
    const { registerFont } = await import('canvas');
    console.log('🎨 Registering custom fonts...'.cyan);
    const fontsToRegister = [
        { path: join(dirname(__dirname), 'fonts/Damion-Regular.ttf'), family: 'Damion' },
        { path: join(dirname(__dirname), 'fonts/Pacifico-Regular.ttf'), family: 'Pacifico' },
        { path: join(dirname(__dirname), 'fonts/GreatVibes-Regular.ttf'), family: 'Great Vibes' },
        { path: join(dirname(__dirname), 'fonts/Lobster-Regular.ttf'), family: 'Lobster' },
        { path: join(dirname(__dirname), 'fonts/ArchitectsDaughter-Regular.ttf'), family: 'Architects Daughter' }
    ];

    fontsToRegister.forEach(font => {
        try {
            const options = { family: font.family };
            if (font.weight) options.weight = font.weight;
            registerFont(font.path, options);
            console.log(`  ✓ ${font.family} font registered`.green);
        } catch (error) {
            console.error(`  ✗ Failed to load ${font.family} font:`.red, error.message);
        }
    });
} catch (error) {
    console.log('⚠️  Custom fonts not available - quote feature will use default fonts'.yellow);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.commands = new Collection();
client.config = config;

client.lavalink = new LavalinkManager({
    nodes: [
        {
            authorization: config.lavalink.password,
            host: config.lavalink.host,
            port: config.lavalink.port,
            id: 'main-node',
            secure: config.lavalink.secure
        }
    ],
    sendToShard: (guildId, payload) => client.guilds.cache.get(guildId)?.shard?.send(payload),
    queueOptions: {
        maxPreviousTracks: 10,
        queueChangesWatcher: null
    },
    playerOptions: {
        maxErrorsPerTime: {
            threshold: 10_000,
            maxAmount: 3,
        },
        minimalErrorsPerTime: {
            threshold: 30_000,
            maxAmount: 1,
        },
        onEmptyQueue: {
            destroyAfterMs: 1_800_000, // 30 minutes
        },
        useUnresolvedData: true
    }
});

async function loadCommands() {
    const commandsPath = join(__dirname, 'commands');
    try {
        const commandFiles = (await readdir(commandsPath)).filter(file => file.endsWith('.js'));
        
        for (const file of commandFiles) {
            const command = await import(`./commands/${file}`);
            if (command.default?.data?.name) {
                client.commands.set(command.default.data.name, command.default);
                console.log(`✓ Loaded command: ${command.default.data.name}`.green);
            }
        }
    } catch (error) {
        console.error('Error loading commands:', error);
    }
}

function updateActivity() {
    const customConfig = client.config || config;
    const activityConfig = customConfig.activity || config.activity;
    
    // Map activity type string to ActivityType enum
    const activityTypeMap = {
        'playing': ActivityType.Playing,
        'streaming': ActivityType.Streaming,
        'listening': ActivityType.Listening,
        'watching': ActivityType.Watching,
        'competing': ActivityType.Competing
    };
    
    const activityType = activityTypeMap[activityConfig.type] || ActivityType.Playing;
    
    client.user.setPresence({
        status: activityConfig.status || 'online',
        activities: [{
            name: activityConfig.name || '/help | -help',
            type: activityType
        }]
    });
}

function truncateString(str, maxLength) {
    if (!str) return 'Unknown';
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + '...';
}

client.once('ready', async () => {
    console.log('\n╔═══════════════════════════════════╗'.cyan);
    console.log(`║  Bot is online as ${client.user.tag}  ║`.cyan.bold);
    console.log('╚═══════════════════════════════════╝\n'.cyan);
    
    await loadCommands();
    await loadAdminCommands();
    
    try {
        client.lavalink.init({ 
            id: client.user.id, 
            username: client.user.username 
        });
    } catch (error) {
        console.error('Failed to initialize Lavalink:'.red, error.message);
        console.log('Bot will continue running but music features will be unavailable.'.yellow);
    }
    
    // Load custom config and merge with default
    const { getConfig } = await import('./utils/configManager.js');
    const customConfig = getConfig();
    
    // Merge custom config into client.config
    client.config = {
        ...config,
        botName: customConfig.botName,
        prefix: customConfig.prefix,
        colors: customConfig.colors,
        activity: customConfig.activity
    };
    
    // Set bot profile description
    try {
        await client.user.setAbout(
            `🎵 High-quality music bot for Discord\n\n` +
            // `**Support Discord:** https://discord.gg/Bcd3ts28RP` +
            // `**Website:** https://discord.gg/Bcd3ts28RP` +
            `**Commands:** Use /play to start listening!\n\n` +
            `Created by ${config.author || 'GeoNFs'}`
        );
        console.log('✓ Bot profile description updated'.green);
    } catch (error) {
        console.log('Note: Could not update bot description (requires user account or specific permissions)'.yellow);
    }
    
    updateActivity();
    
    console.log(`✓ Lavalink initialized`.green);
    console.log(`✓ Guilds: ${client.guilds.cache.size}`.green);
    console.log(`✓ Activity status: ${client.config.activity.name}`.green);
    
    // Initialize Stats API
    createStatsAPI(client);
});

client.on('interactionCreate', async interaction => {
    if (interaction.isButton() || interaction.isStringSelectMenu()) {
        return handleButtonInteraction(interaction, client);
    }
    
    if (interaction.isAutocomplete()) {
        const command = client.commands.get(interaction.commandName);
        if (!command || !command.autocomplete) return;
        
        try {
            await command.autocomplete(interaction, client);
        } catch (error) {
            // Silently ignore autocomplete errors (timeouts are expected)
            if (error.code !== 40060 && error.code !== 10062) {
                console.error(`Error in autocomplete for ${interaction.commandName}:`.red, error);
            }
        }
        return;
    }
    
    if (!interaction.isChatInputCommand()) return;
    
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    
    // Check if commands are locked (except for lockcommands itself)
    if (interaction.commandName !== 'lockcommands') {
        try {
            const { areCommandsLocked, canBypassLock } = await import('./commands/lockcommands.js');
            
            if (areCommandsLocked(interaction.guildId) && !canBypassLock(interaction.user.id, client)) {
                return interaction.reply({
                    embeds: [{
                        color: config.colors.error,
                        title: '🔒 Commands Locked',
                        description: `${config.emojis.error} **All commands are currently locked!**\n\n` +
                                   `Only the bot owner can use commands right now.\n\n` +
                                   `**Bot Owner:** <@${config.ownerId}>\n\n` +
                                   `Contact an administrator if you believe this is a mistake.`,
                        footer: { text: 'This server has restricted bot usage to the owner only' }
                    }],
                    flags: 64 // Ephemeral
                });
            }
        } catch (error) {
            console.error('Error checking command lock:', error);
        }
    }
    
    try {
        await command.execute(interaction, client);
    } catch (error) {
        console.error(`\n${'='.repeat(50)}`.red);
        console.error(`Error executing ${interaction.commandName}:`.red.bold);
        console.error(`User: ${interaction.user.tag}`.yellow);
        console.error(`Guild: ${interaction.guild?.name || 'DM'}`.yellow);
        console.error(`Error Message: ${error.message}`.red);
        console.error(`Stack Trace:`.red);
        console.error(error.stack);
        console.error(`${'='.repeat(50)}\n`.red);
        
        // Don't try to reply if interaction is expired
        if (error.code === 10062 || error.code === 40060) {
            console.error('Interaction expired - command executed too slowly'.yellow);
            return;
        }
        
        const errorMessage = {
            content: `${config.emojis.error} An error occurred while executing this command!\n\`\`\`${error.message}\`\`\``,
            flags: 64 // Ephemeral flag
        };
        
        try {
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorMessage);
            } else {
                await interaction.reply(errorMessage);
            }
        } catch (replyError) {
            // Ignore errors when trying to send error message
        }
    }
});

client.on('messageCreate', async message => {
    await handleMessageCommand(message, client);
});

// Store timers for voice channel inactivity
const aloneTimers = new Map();

client.on('voiceStateUpdate', async (oldState, newState) => {
    // Get the player for this guild
    const player = client.lavalink.getPlayer(newState.guild.id);
    if (!player || !player.voiceChannelId) return;
    
    const voiceChannel = newState.guild.channels.cache.get(player.voiceChannelId);
    if (!voiceChannel) return;
    
    // Count non-bot members in the voice channel
    const members = voiceChannel.members.filter(m => !m.user.bot);
    
    // If bot is alone in the channel
    if (members.size === 0) {
        // Don't set timer if one already exists
        if (aloneTimers.has(newState.guild.id)) {
            return;
        }
        
        console.log(`Bot is alone in voice channel in ${newState.guild.name}. Starting 30-minute timer...`.yellow);
        
        // Set a 30-minute timer
        const timer = setTimeout(async () => {
            const currentPlayer = client.lavalink.getPlayer(newState.guild.id);
            if (!currentPlayer) {
                aloneTimers.delete(newState.guild.id);
                return;
            }
            
            const currentChannel = newState.guild.channels.cache.get(currentPlayer.voiceChannelId);
            if (currentChannel) {
                const currentMembers = currentChannel.members.filter(m => !m.user.bot);
                
                // Double-check bot is still alone
                if (currentMembers.size === 0) {
                    // Check if 247 mode is enabled - if so, don't leave
                    if (is247Enabled(newState.guild.id)) {
                        console.log(`Bot is alone but 24/7 mode is enabled in ${newState.guild.name}. Staying connected...`.cyan);
                        aloneTimers.delete(newState.guild.id);
                        return;
                    }
                    
                    console.log(`Bot was alone for 30 minutes in ${newState.guild.name}. Leaving...`.yellow);
                    
                    try {
                        // Send a message if we have a text channel
                        const textChannel = currentPlayer.get('currentTextChannel');
                        if (textChannel) {
                            await textChannel.send({
                                embeds: [{
                                    color: config.colors.warning,
                                    title: '⏰ Inactivity Timeout',
                                    description: `${config.emojis.leave} Left the voice channel after being alone for 30 minutes.`
                                }]
                            }).catch(() => {});
                        }
                    } catch (error) {
                        console.error('Error sending timeout message:', error);
                    }
                    
                    currentPlayer.destroy();
                    aloneTimers.delete(newState.guild.id);
                }
            }
        }, 30 * 60 * 1000); // 30 minutes
        
        aloneTimers.set(newState.guild.id, timer);
    } else {
        // Someone joined, cancel the timer
        const timer = aloneTimers.get(newState.guild.id);
        if (timer) {
            console.log(`User joined voice channel in ${newState.guild.name}. Canceling inactivity timer.`.green);
            clearTimeout(timer);
            aloneTimers.delete(newState.guild.id);
        }
    }
});

client.on('raw', d => client.lavalink.sendRawData(d));

client.lavalink.on('nodeCreate', (node) => {
    console.log(`Lavalink node created: ${node.id}`.cyan);
});

client.lavalink.on('nodeConnect', (node) => {
    console.log(`✓ Lavalink node connected: ${node.id}`.green.bold);
    console.log(`  Host: ${node.options.host}:${node.options.port}`.green);
    console.log(`  Secure: ${node.options.secure ? 'Yes' : 'No'}`.green);
});

client.lavalink.on('nodeDisconnect', (node, reason) => {
    console.error(`✗ Lavalink node disconnected: ${node.id}`.red.bold);
    console.error(`  Reason: ${reason}`.red);
    console.error(`  Will attempt to reconnect...`.yellow);
});

client.lavalink.on('nodeError', (node, error) => {
    console.error(`✗ Lavalink node error: ${node.id}`.red.bold);
    console.error(`  Error: ${error.message}`.red);
    console.error(`  Stack:`, error.stack);
});

client.lavalink.on('nodeReconnect', (node) => {
    console.log(`🔄 Lavalink node reconnecting: ${node.id}`.yellow);
});

client.lavalink.on('playerCreate', (player) => {
    console.log(`Player created in ${player.guildId}`.cyan);
});

client.lavalink.on('playerDestroy', async (player, reason) => {
    console.log(`Player destroyed in ${player.guildId} - Reason: ${reason}`.yellow);
    
    // Clear voice channel status
    try {
        await client.rest.put(
            `/channels/${player.voiceChannelId}/voice-status`,
            { body: { status: '' } }
        ).catch(() => {});
    } catch (error) {
        // Ignore errors - channel might not exist
    }
});

client.lavalink.on('trackStart', async (player, track, payload) => {
    console.log(`\n${'▶'.repeat(30)}`.green);
    console.log(`TRACK STARTED`.green.bold);
    console.log(`  Title: ${track.info.title}`.green);
    console.log(`  Source: ${track.info.sourceName}`.green);
    console.log(`  Guild: ${player.guildId}`.green);
    console.log(`  Player connected: ${player.connected}`.green);
    console.log(`  Previous tracks: ${player.queue.previous.length}`.green);
    console.log(`${'▶'.repeat(30)}\n`.green);
    
    // Track play statistics
    try {
        // Get the user who requested this track
        const requesterId = track.requester?.id || track.requester;
        if (requesterId) {
            trackPlay(requesterId, player.guildId, track.info.duration, {
                title: track.info.title,
                artist: track.info.author
            });
        }
    } catch (error) {
        console.error('Error tracking play stats:', error.message);
    }
    
    // Update voice channel status
    try {
        console.log(`${'━'.repeat(40)}`.cyan);
        console.log(`Voice Channel Status Debug:`.cyan.bold);
        console.log(`Channel: ${player.voiceChannel?.name || 'Unknown'}`);
        
        // Truncate title to keep artist visible (max 20 chars for title to leave room for artist)
        const maxTitleLength = 20;
        const truncatedTitle = track.info.title.length > maxTitleLength 
            ? track.info.title.substring(0, maxTitleLength) + '...' 
            : track.info.title;
        
        const statusText = `${config.emojis.play} **▸ ${truncatedTitle} - ${track.info.author}**`;
        console.log(`Status text: ${statusText}`);
        
        console.log(`Attempting to set status via REST API...`.yellow);
        
        await client.rest.put(
            `/channels/${player.voiceChannelId}/voice-status`,
            { body: { status: statusText } }
        );
        
        console.log(`✓ Voice status updated successfully!`.green.bold);
        console.log(`${'━'.repeat(40)}`.cyan);
        
    } catch (error) {
        console.error(`Failed to update voice status: ${error.message}`.red);
    }
    
    // Send a new Now Playing message for each track
    try {
        const guild = client.guilds.cache.get(player.guildId);
        if (!guild) return;
        
        const embed = createNowPlayingEmbed(player, client);
        const buttons = createNowPlayingButtons(player, client);
        
        // Get the text channel from the player or stored channel
        const textChannel = player.get('currentTextChannel') || 
                          (player.textChannelId ? guild.channels.cache.get(player.textChannelId) : null);
        
        if (textChannel) {
            // Always send a new message for better visibility
            const message = await textChannel.send({
                embeds: [embed],
                components: [buttons]
            });
            player.nowPlayingMessage = message;
            console.log(`✓ Now Playing message sent for new track`.green);
        } else {
            console.log(`Could not send Now Playing message - no text channel available`.yellow);
        }
    } catch (error) {
        console.error(`Failed to send Now Playing message: ${error.message}`.red);
    }
});

client.lavalink.on('trackEnd', async (player, track, payload) => {
    console.log(`Track ended: ${track.info.title}`.yellow);
    
    if (payload.reason === 'replaced') return;
    if (!player.queue.tracks.length && player.repeatMode === 'off') {
        // Queue ended, clear voice status after delay
        setTimeout(async () => {
            try {
                if (!player.queue.current && !player.queue.tracks.length) {
                    await client.rest.put(
                        `/channels/${player.voiceChannelId}/voice-status`,
                        { body: { status: '' } }
                    ).catch(() => {});
                }
            } catch (error) {
                // Ignore
            }
        }, 5000);
    }
});

client.lavalink.on('trackError', async (player, track, payload) => {
    console.error(`\n${'✗'.repeat(60)}`.red);
    console.error(`TRACK ERROR`.red.bold);
    console.error(`  Track: ${track.info.title}`.red);
    console.error(`  Source: ${track.info.sourceName}`.red);
    console.error(`  Error: ${payload.exception?.message || 'Unknown error'}`.red);
    console.error(`  Severity: ${payload.exception?.severity || 'unknown'}`.red);
    console.error(`${'✗'.repeat(60)}\n`.red);
});

client.lavalink.on('trackStuck', async (player, track, payload) => {
    console.error(`Track stuck: ${track.info.title} - ${payload.thresholdMs}ms`.red);
});

client.lavalink.on('queueEnd', async (player, track, payload) => {
    console.log(`✅ Queue finished!`.green);
    
    // Check if autoplay is enabled
    try {
        const { isAutoplayEnabled } = await import('./commands/autoplay.js');
        
        if (isAutoplayEnabled(player.guildId)) {
            console.log(`🔄 Autoplay is enabled - searching for related tracks...`.cyan);
            
            // Get the last played track for recommendations
            const lastTrack = track || player.queue.previous[0];
            
            if (lastTrack) {
                try {
                    // Search for related tracks based on the last played track
                    const searchQuery = `${lastTrack.info.title} ${lastTrack.info.author}`;
                    const res = await player.search(
                        { query: searchQuery },
                        lastTrack.requester
                    );
                    
                    if (res.tracks && res.tracks.length > 0) {
                        // Add multiple tracks (skip the first one as it's likely the same song)
                        const tracksToAdd = res.tracks.slice(1, 6); // Add 5 related tracks
                        
                        for (const newTrack of tracksToAdd) {
                            player.queue.add(newTrack);
                        }
                        
                        console.log(`✅ Added ${tracksToAdd.length} related tracks via autoplay`.green);
                        
                        // Start playing if not already playing
                        if (!player.playing) {
                            await player.play();
                        }
                    } else {
                        console.log(`⚠️ No related tracks found for autoplay`.yellow);
                    }
                } catch (error) {
                    console.error(`❌ Autoplay search failed: ${error.message}`.red);
                }
            }
        } else {
            console.log(`The player will be destroyed in 30 minutes if no new tracks are added.`.yellow);
            console.log(`Use \`/play\` to continue listening or \`/autoplay\` for unlimited music.`.cyan);
        }
    } catch (error) {
        console.error('Error in autoplay logic:', error.message);
    }
});

client.login(config.token);