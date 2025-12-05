import { Client, GatewayIntentBits, ActivityType, Collection, Events } from 'discord.js';
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
import { getGenreFromSpotify, getSpotifyRecommendations } from './utils/spotifyGenre.js';
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
    ],
    ws: {
        properties: {
            browser: 'Discord iOS'
        }
    },
    rest: {
        timeout: 60000
    },
    // Memory optimization: Cache sweepers to prevent memory leaks during 24/7 operation
    sweepers: {
        messages: {
            interval: 300, // Every 5 minutes
            lifetime: 600  // Remove messages older than 10 minutes
        },
        users: {
            interval: 3600, // Every hour
            filter: () => user => !user.bot && user.id !== client.user?.id
        },
        guildMembers: {
            interval: 3600, // Every hour
            filter: () => member => !member.user.bot && !member.voice?.channelId
        },
        threadMembers: {
            interval: 3600,
            filter: () => () => true
        },
        threads: {
            interval: 3600,
            lifetime: 1800
        }
    }
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
            secure: config.lavalink.secure,
            requestTimeout: 30000, // 30 second timeout for requests
            retryAmount: 3,
            retryDelay: 3000
        }
    ],
    sendToShard: (guildId, payload) => client.guilds.cache.get(guildId)?.shard?.send(payload),
    queueOptions: {
        maxPreviousTracks: 5, // Reduced from 10 to save memory during 24/7
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

client.once(Events.ClientReady, async () => {
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
    
    // Memory cleanup interval for 24/7 operation
    setInterval(() => {
        // Clean up old search cache entries
        if (client.searchCache) {
            const now = Date.now();
            for (const [key, value] of client.searchCache.entries()) {
                if (now - value.timestamp > 300000) { // 5 minutes
                    client.searchCache.delete(key);
                }
            }
        }
        
        // Clean up player nowPlayingMessage references for inactive players
        for (const [guildId, player] of client.lavalink.players) {
            if (!player.playing && !player.paused) {
                player.nowPlayingMessage = null;
            }
            // Clear previous tracks if too many accumulated (keep only last 5)
            if (player.queue?.previous?.length > 5) {
                player.queue.previous.splice(0, player.queue.previous.length - 5);
            }
        }
        
        // Force garbage collection if available (requires --expose-gc flag)
        if (global.gc) {
            global.gc();
            console.log('🗑️ Garbage collection triggered'.gray);
        }
    }, 10 * 60 * 1000); // Every 10 minutes
    
    console.log(`✓ Memory cleanup interval started (every 10 min)`.green);
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
    
    // Clean up player data to prevent memory leaks
    player.nowPlayingMessage = null;
    player.set('currentTextChannel', null);
    
    // Clear voice channel status
    try {
        await client.rest.put(
            `/channels/${player.voiceChannelId}/voice-status`,
            { body: { status: '' } }
        ).catch(() => {});
    } catch (error) {
        // Ignore errors - channel might not exist
    }
    
    // Clean up alone timer if exists
    if (aloneTimers.has(player.guildId)) {
        clearTimeout(aloneTimers.get(player.guildId));
        aloneTimers.delete(player.guildId);
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
        
        // Remove " - Topic" suffix from artist name (YouTube auto-generated channels)
        const cleanAuthor = track.info.author.replace(/\s*-\s*Topic$/i, '');
        
        const statusText = `${config.emojis.play} **▸ ${truncatedTitle} - ${cleanAuthor}**`;
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
    
    // Send a compact "Started playing" message for each track
    try {
        const guild = client.guilds.cache.get(player.guildId);
        if (!guild) return;
        
        // Get the text channel from the player or stored channel
        const textChannel = player.get('currentTextChannel') || 
                          (player.textChannelId ? guild.channels.cache.get(player.textChannelId) : null);
        
        if (textChannel) {
            // Get source emoji
            let sourceEmoji = config.emojis.note2; // Default
            const url = track.info.uri || '';
            if (url.includes('youtube.com') || url.includes('youtu.be')) {
                sourceEmoji = config.emojis.youtube;
            } else if (url.includes('spotify.com')) {
                sourceEmoji = config.emojis.spotify;
            } else if (url.includes('soundcloud.com')) {
                sourceEmoji = config.emojis.soundcloud;
            } else if (url.includes('deezer.com')) {
                sourceEmoji = config.emojis.deezer;
            } else if (url.includes('apple.com')) {
                sourceEmoji = config.emojis.applemusic;
            }
            
            // Send compact message in a box/container style
            const message = await textChannel.send({
                embeds: [{
                    color: 0xFF8C00, // Orange (matching bot's primary color)
                    description: `${sourceEmoji} Started playing **[${track.info.title}](${track.info.uri})** by **${track.info.author}**`
                }]
            });
            
            player.nowPlayingMessage = message;
            console.log(`✓ Compact "Started playing" message sent`.green);
        } else {
            console.log(`Could not send Now Playing message - no text channel available`.yellow);
        }
    } catch (error) {
        console.error(`Failed to send Now Playing message: ${error.message}`.red);
    }
});

client.lavalink.on('trackEnd', async (player, track, payload) => {
    console.log(`Track ended: ${track.info.title} (reason: ${payload.reason})`.yellow);
    
    // Clean up old now playing message reference
    if (player.nowPlayingMessage) {
        player.nowPlayingMessage = null;
    }
    
    // Don't interfere with queue progression - let lavalink-client handle it
    // The queueEnd event will fire when the queue is actually empty
});

client.lavalink.on('trackError', async (player, track, payload) => {
    console.error(`\n${'✗'.repeat(60)}`.red);
    console.error(`TRACK ERROR`.red.bold);
    console.error(`  Track: ${track.info.title}`.red);
    console.error(`  Source: ${track.info.sourceName}`.red);
    console.error(`  Error: ${payload.exception?.message || 'Unknown error'}`.red);
    console.error(`  Severity: ${payload.exception?.severity || 'unknown'}`.red);
    console.error(`${'✗'.repeat(60)}\n`.red);
    
    // Auto-skip errored tracks to prevent stuck player
    try {
        console.log('Auto-skipping errored track...'.yellow);
        if (player.queue.tracks.length > 0) {
            await player.skip();
            console.log('Skipped to next track'.green);
        } else {
            // Check autoplay before stopping
            const { isAutoplayEnabled } = await import('./commands/autoplay.js');
            if (!isAutoplayEnabled(player.guildId)) {
                await player.stopPlaying();
                console.log('No more tracks, stopped player'.yellow);
            }
        }
    } catch (error) {
        console.error('Error skipping errored track:', error.message);
    }
});

client.lavalink.on('trackStuck', async (player, track, payload) => {
    console.error(`Track stuck: ${track.info.title} - ${payload.thresholdMs}ms`.red);
    
    // Auto-skip stuck tracks
    try {
        console.log('Attempting to skip stuck track...'.yellow);
        if (player.queue.tracks.length > 0) {
            await player.skip();
            console.log('Skipped to next track'.green);
        } else {
            // Check autoplay before stopping
            const { isAutoplayEnabled } = await import('./commands/autoplay.js');
            if (!isAutoplayEnabled(player.guildId)) {
                await player.stopPlaying();
                console.log('No more tracks, stopped player'.yellow);
            }
        }
    } catch (error) {
        console.error('Error handling stuck track:', error.message);
    }
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
                    // Helper function to normalize titles for duplicate detection
                    const normalizeTitle = (title) => {
                        return title
                            .toLowerCase()
                            .replace(/\(.*?\)|\[.*?\]/g, '')
                            .replace(/feat\.?|ft\.?|featuring/gi, '')
                            .replace(/official|video|audio|lyrics|hd|hq|mv/gi, '')
                            .replace(/[^a-z0-9\s]/g, '')
                            .replace(/\s+/g, ' ')
                            .trim();
                    };
                    
                    // Collect existing track titles (current, queue, and previous)
                    const existingTracks = [
                        lastTrack,
                        ...player.queue.tracks,
                        ...player.queue.previous
                    ];
                    
                    const existingTitles = new Set();
                    for (const t of existingTracks) {
                        if (t?.info?.title) {
                            existingTitles.add(normalizeTitle(t.info.title));
                        }
                    }
                    
                    let searchRes = null;
                    
                    // If source is SoundCloud, try to find related tracks on SoundCloud first
                    if (lastTrack.info.sourceName === 'soundcloud') {
                        console.log(`🔍 Track is from SoundCloud, searching for more by ${lastTrack.info.author}...`.cyan);
                        
                        // Search for more tracks by the same artist on SoundCloud
                        const scSearch = await player.search(
                            { query: `scsearch:${lastTrack.info.author}`, source: 'soundcloud' },
                            lastTrack.requester
                        );
                        
                        if (scSearch?.tracks?.length > 0) {
                            // Filter out duplicates and the current track
                            const uniqueScTracks = [];
                            const addedTitles = new Set();
                            
                            for (const searchTrack of scSearch.tracks) {
                                const normalizedTitle = normalizeTitle(searchTrack.info.title);
                                
                                if (existingTitles.has(normalizedTitle) || addedTitles.has(normalizedTitle)) {
                                    continue;
                                }
                                
                                uniqueScTracks.push(searchTrack);
                                addedTitles.add(normalizedTitle);
                                
                                if (uniqueScTracks.length >= 10) break;
                            }
                            
                            if (uniqueScTracks.length > 0) {
                                console.log(`✓ Found ${uniqueScTracks.length} SoundCloud tracks by ${lastTrack.info.author}`.green);
                                
                                // Add tracks to queue
                                for (const newTrack of uniqueScTracks) {
                                    player.queue.add(newTrack);
                                }
                                
                                console.log(`✅ Added ${uniqueScTracks.length} related SoundCloud tracks via autoplay`.green);
                                uniqueScTracks.forEach((t, i) => {
                                    console.log(`   ${i + 1}. ${t.info.title} - ${t.info.author}`.gray);
                                });
                                
                                // Start playing
                                if (!player.playing) {
                                    await player.play();
                                }
                                return; // Done, no need to fall back to YouTube
                            }
                        }
                        
                        console.log(`⚠️ No unique SoundCloud tracks found, falling back to YouTube...`.yellow);
                    }
                    
                    // If source is Spotify, try Spotify recommendations first
                    if (lastTrack.info.sourceName === 'spotify' || lastTrack.info.uri?.includes('spotify.com')) {
                        console.log(`🎵 Track is from Spotify, getting Spotify recommendations...`.cyan);
                        
                        const spotifyRecs = await getSpotifyRecommendations(lastTrack.info.title, lastTrack.info.author, 15);
                        
                        if (spotifyRecs && spotifyRecs.length > 0) {
                            const uniqueSpotifyTracks = [];
                            const addedTitles = new Set();
                            
                            for (const rec of spotifyRecs) {
                                const normalizedTitle = normalizeTitle(rec.title);
                                
                                if (existingTitles.has(normalizedTitle) || addedTitles.has(normalizedTitle)) {
                                    continue;
                                }
                                
                                // Search for this track - try Spotify first, fallback to YouTube
                                try {
                                    let searchResult = null;
                                    
                                    // Try Spotify URL/search first
                                    if (rec.spotifyUrl) {
                                        try {
                                            searchResult = await player.search(
                                                { query: rec.spotifyUrl },
                                                lastTrack.requester
                                            );
                                        } catch (e) {
                                            // Spotify plugin not available
                                        }
                                    }
                                    
                                    // If Spotify failed or no URL, try YouTube search
                                    if (!searchResult?.tracks?.length) {
                                        searchResult = await player.search(
                                            { query: `${rec.artist} - ${rec.title}`, source: 'youtube' },
                                            lastTrack.requester
                                        );
                                    }
                                    
                                    if (searchResult?.tracks?.length > 0) {
                                        uniqueSpotifyTracks.push(searchResult.tracks[0]);
                                        addedTitles.add(normalizedTitle);
                                        const source = searchResult.tracks[0].info.sourceName || 'unknown';
                                        console.log(`   ✓ ${rec.title} - ${rec.artist} [${source}]`.gray);
                                    }
                                } catch (searchError) {
                                    console.log(`   ⚠️ Could not find: ${rec.title}`.yellow);
                                }
                                
                                if (uniqueSpotifyTracks.length >= 10) break;
                            }
                            
                            if (uniqueSpotifyTracks.length > 0) {
                                console.log(`✓ Found ${uniqueSpotifyTracks.length} Spotify recommendations`.green);
                                
                                for (const newTrack of uniqueSpotifyTracks) {
                                    player.queue.add(newTrack);
                                }
                                
                                console.log(`✅ Added ${uniqueSpotifyTracks.length} Spotify recommended tracks via autoplay`.green);
                                
                                if (!player.playing) {
                                    await player.play();
                                }
                                return;
                            }
                        }
                        
                        console.log(`⚠️ No Spotify recommendations found, falling back to YouTube...`.yellow);
                    }
                    
                    // For YouTube or as fallback: use YouTube Mix
                    let videoId = lastTrack.info.identifier;
                    
                    // If not a YouTube track, search YouTube for the track first
                    if (lastTrack.info.sourceName !== 'youtube') {
                        console.log(`🔍 Searching YouTube for: ${lastTrack.info.title}...`.cyan);
                        const ytSearch = await player.search(
                            { query: `${lastTrack.info.title} ${lastTrack.info.author}`, source: 'youtube' },
                            lastTrack.requester
                        );
                        
                        if (ytSearch?.tracks?.length > 0) {
                            videoId = ytSearch.tracks[0].info.identifier;
                            console.log(`✓ Found YouTube equivalent: ${ytSearch.tracks[0].info.title}`.green);
                        } else {
                            console.log(`⚠️ Could not find YouTube equivalent for autoplay`.yellow);
                            return;
                        }
                    }
                    
                    // Use YouTube Mix (Radio) for related songs
                    const mixUrl = `https://www.youtube.com/watch?v=${videoId}&list=RD${videoId}`;
                    
                    console.log(`🔍 Autoplay loading YouTube Mix for: ${lastTrack.info.title}`.cyan);
                    
                    // Load YouTube Mix playlist for related tracks
                    searchRes = await player.search(
                        { query: mixUrl },
                        lastTrack.requester
                    );
                    
                    if (searchRes?.tracks?.length > 0) {
                        // Filter duplicates only
                        const uniqueTracks = [];
                        const addedTitles = new Set();
                        
                        for (const searchTrack of searchRes.tracks) {
                            const normalizedTitle = normalizeTitle(searchTrack.info.title);
                            
                            // Skip if already played or already added
                            if (existingTitles.has(normalizedTitle) || addedTitles.has(normalizedTitle)) {
                                continue;
                            }
                            
                            uniqueTracks.push(searchTrack);
                            addedTitles.add(normalizedTitle);
                            
                            if (uniqueTracks.length >= 10) break;
                        }
                        
                        if (uniqueTracks.length > 0) {
                            // Add tracks to queue
                            for (const newTrack of uniqueTracks) {
                                player.queue.add(newTrack);
                            }
                            
                            console.log(`✅ Added ${uniqueTracks.length} related tracks via autoplay`.green);
                            uniqueTracks.forEach((t, i) => {
                                console.log(`   ${i + 1}. ${t.info.title} - ${t.info.author}`.gray);
                            });
                            
                            // Start playing
                            if (!player.playing) {
                                await player.play();
                            }
                        } else {
                            console.log(`⚠️ No unique related tracks found for autoplay`.yellow);
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
            
            // Clear voice status when queue ends
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
    } catch (error) {
        console.error('Error in autoplay logic:', error.message);
    }
});

// Global error handlers to prevent crashes
process.on('unhandledRejection', (error) => {
    console.error('Unhandled Promise Rejection:'.red, error);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:'.red, error);
});

// Handle Discord disconnects
client.on('error', (error) => {
    console.error('Discord client error:'.red, error);
});

client.on('shardError', (error) => {
    console.error('Discord shard error:'.red, error);
});

client.on('shardDisconnect', (event, id) => {
    console.log(`Shard ${id} disconnected. Reconnecting...`.yellow);
});

client.on('shardReconnecting', (id) => {
    console.log(`Shard ${id} reconnecting...`.yellow);
});

// Auto-resume players after shard reconnects
client.on('shardResume', async (id, replayedEvents) => {
    console.log(`Shard ${id} resumed! Checking for players to reconnect...`.green);
    
    // Wait a moment for voice states to stabilize
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get all players and try to reconnect them
    for (const [guildId, player] of client.lavalink.players) {
        try {
            const guild = client.guilds.cache.get(guildId);
            if (!guild) continue;
            
            // Check if this guild is on the resumed shard
            if (guild.shardId !== id) continue;
            
            const voiceChannelId = player.voiceChannelId;
            if (!voiceChannelId) continue;
            
            const voiceChannel = guild.channels.cache.get(voiceChannelId);
            if (!voiceChannel) continue;
            
            // Check if 24/7 mode is enabled or player has a current track
            const has247 = await is247Enabled(guildId);
            const hasTrack = player.queue.current;
            
            if (has247 || hasTrack) {
                console.log(`Reconnecting player in guild ${guild.name} (${guildId})...`.cyan);
                
                // Reconnect to voice channel
                await player.connect();
                
                // Wait for connection to establish
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Resume playback if there was a track
                if (hasTrack && player.paused) {
                    await player.pause(false);
                    console.log(`Resumed playback in ${guild.name}`.green);
                } else if (hasTrack && !player.playing) {
                    // If player is not playing but has a track, try to resume
                    await player.play();
                    console.log(`Restarted playback in ${guild.name}`.green);
                }
            }
        } catch (error) {
            console.error(`Failed to reconnect player in ${guildId}:`.red, error.message);
        }
    }
});

client.login(config.token);