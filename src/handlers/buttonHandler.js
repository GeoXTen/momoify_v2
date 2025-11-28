import { EmbedBuilder, ActivityType, MessageFlags } from 'discord.js';
import { toBold } from '../utils/textFormat.js';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

function updateBotActivity(client) {
    // Keep default activity - don't show current song
    // This function is kept for compatibility but does nothing
}

function truncate(str, maxLength) {
    if (!str) return '';
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + '...';
}

function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

async function handleStopConversion(interaction, guildId, client) {
    try {
        await interaction.deferUpdate();
        
        const player = client.lavalink.getPlayer(guildId);
        
        if (!player) {
            return interaction.followUp({
                embeds: [{
                    color: client.config.colors.error,
                    description: `${client.config.emojis.error} No active player found!`
                }],
                ephemeral: true
            });
        }
        
        // Set the flag to stop background conversion
        player.set('backgroundConversion', false);
        console.log(`User manually stopped background conversion for guild ${guildId}`.yellow);
        
        await interaction.followUp({
            embeds: [{
                color: client.config.colors.warning,
                description: `⏹️ Background conversion will stop after the current track...`
            }],
            ephemeral: true
        });
        
    } catch (error) {
        console.error('Error stopping conversion:', error);
        await interaction.followUp({
            embeds: [{
                color: client.config.colors.error,
                description: `${client.config.emojis.error} Failed to stop conversion!`
            }],
            ephemeral: true
        }).catch(() => {});
    }
}

export async function handleButtonInteraction(interaction, client) {
    // Handle both buttons and select menus
    if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;
    
    const [action, ...args] = interaction.customId.split('_');
    
    // Handle help menu interactions (select menu and buttons)
    if (action === 'help') {
        if (interaction.isStringSelectMenu()) {
            return handleHelpCategorySelect(interaction, client);
        }
        return handleHelpButton(interaction, args[0], client);
    }
    
    // Handle switch lavalink select menu
    if (action === 'switch' && args[0] === 'lavalink') {
        if (interaction.isStringSelectMenu()) {
            return handleSwitchLavalinkSelect(interaction, client);
        }
    }
    
    // Handle search result selection (no player needed yet)
    if (action === 'search') {
        return handleSearchButton(interaction, args, client);
    }
    
    // Handle stop conversion button
    if (action === 'stop' && args[0] === 'conversion') {
        return handleStopConversion(interaction, args[1], client);
    }
    
    // Handle quote removal button
    if (action === 'remove' && args[0] === 'quote') {
        const [userId, messageId] = args.slice(1);
        
        // Only the person who requested the quote can remove it
        if (interaction.user.id !== userId) {
            return await interaction.reply({
                content: '❌ You can only remove quotes that you created!',
                flags: 64
            });
        }
        
        try {
            await interaction.message.delete();
            return await interaction.reply({
                content: '✅ Quote removed!',
                flags: 64
            });
        } catch (error) {
            console.error('Error removing quote:', error);
            return await interaction.reply({
                content: '❌ Failed to remove quote!',
                flags: 64
            });
        }
    }
    
    // For music control buttons, check player
    const player = client.lavalink.getPlayer(interaction.guildId);
    
    if (!player) {
        return interaction.reply({
            embeds: [{
                color: client.config.colors.error,
                description: `${client.config.emojis.error} No active player found!`
            }],
            flags: 64 // Ephemeral
        });
    }
    
    const member = interaction.guild.members.cache.get(interaction.user.id);
    if (member.voice.channelId !== player.voiceChannelId) {
        return interaction.reply({
            embeds: [{
                color: client.config.colors.error,
                description: `${client.config.emojis.error} You need to be in the same voice channel as me!`
            }],
            flags: 64 // Ephemeral
        });
    }
    
    try {
        switch (action) {
            case 'np':
                await handleNowPlayingButton(interaction, player, args[0], client);
                break;
            case 'queue':
                await handleQueueButton(interaction, player, args[0], args[1], client);
                break;
            default:
                await interaction.reply({
                    content: 'Unknown button action!',
                    flags: 64 // Ephemeral
                });
        }
    } catch (error) {
        console.error('Button handler error:', error);
        
        // Check if we can still reply to the interaction
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                embeds: [{
                    color: client.config.colors.error,
                    description: `${client.config.emojis.error} An error occurred!`
                }],
                flags: 64 // Ephemeral
            }).catch(console.error);
        } else if (interaction.deferred) {
            await interaction.editReply({
                embeds: [{
                    color: client.config.colors.error,
                    description: `${client.config.emojis.error} An error occurred!`
                }]
            }).catch(console.error);
        }
    }
}

async function handleNowPlayingButton(interaction, player, action, client) {
    // Actions that send new messages (don't defer update for these)
    const newMessageActions = ['queue', 'lyrics', 'skip', 'previous', 'shuffle'];
    
    // Actions that need deferReply instead of deferUpdate
    const replyActions = ['stop'];
    
    // Only defer update for actions that modify the existing message
    if (!newMessageActions.includes(action) && !replyActions.includes(action)) {
        await interaction.deferUpdate().catch(console.error);
    }
    
    switch (action) {
        case 'pause':
            // Check if already paused to prevent error
            if (player.paused) {
                // Already paused, just update UI
                try {
                    const { createNowPlayingEmbed, createNowPlayingButtons } = await import('../utils/nowPlayingUtils.js');
                    const embed = createNowPlayingEmbed(player, client);
                    const buttons = createNowPlayingButtons(player, client);
                    
                    await interaction.editReply({
                        embeds: [embed],
                        components: buttons
                    });
                } catch (error) {
                    console.error('Error updating now playing (already paused):', error);
                }
                return;
            }
            
            // Pause the player (use toggle method like /pause command)
            try {
                await player.pause(true);
            } catch (error) {
                console.error('Pause error:', error.message);
            }
            
            // Wait a moment for player state to update
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Update bot status
            updateBotActivity(client);
            
            // Update voice channel status using REST API
            try {
                if (player.voiceChannelId && player.queue.current) {
                    const track = player.queue.current;
                    
                    // Truncate title to keep artist visible (max 20 chars for title)
                    const maxTitleLength = 20;
                    const truncatedTitle = track.info.title.length > maxTitleLength 
                        ? track.info.title.substring(0, maxTitleLength) + '...' 
                        : track.info.title;
                    
                    const statusText = `${client.config.emojis.pause} **⏸ ${truncatedTitle} - ${track.info.author}**`;
                    console.log('Setting pause status:', statusText);
                    
                    await client.rest.put(
                        `/channels/${player.voiceChannelId}/voice-status`,
                        { body: { status: statusText } }
                    ).catch((err) => {
                        console.error('Failed to set pause status:', err.message);
                    });
                }
            } catch (error) {
                console.error('Voice status error (pause):', error.message);
            }
            
            // Refresh the now playing display
            try {
                const { createNowPlayingEmbed, createNowPlayingButtons } = await import('../utils/nowPlayingUtils.js');
                const embed = createNowPlayingEmbed(player, client);
                const buttons = createNowPlayingButtons(player, client);
                
                await interaction.editReply({
                    embeds: [embed],
                    components: buttons
                });
            } catch (error) {
                console.error('Error updating now playing:', error);
                await interaction.followUp({
                    embeds: [{
                        color: client.config.colors.success,
                        description: `${client.config.emojis.pause} ⏸️ **Paused the music**`
                    }],
                    flags: 64 // Ephemeral
                }).catch(() => {});
            }
            break;
            
        case 'resume':
            console.log('Resume button clicked. Player state:', {
                paused: player.paused,
                playing: player.playing,
                position: player.position
            });
            
            // Check if not paused to prevent error
            if (!player.paused) {
                console.log('Player is not paused, skipping resume');
                // Already playing, just update UI
                try {
                    const { createNowPlayingEmbed, createNowPlayingButtons } = await import('../utils/nowPlayingUtils.js');
                    const embed = createNowPlayingEmbed(player, client);
                    const buttons = createNowPlayingButtons(player, client);
                    
                    await interaction.editReply({
                        embeds: [embed],
                        components: buttons
                    });
                } catch (error) {
                    console.error('Error updating now playing (already playing):', error);
                }
                return;
            }
            
            // Resume the player - save position for fallback
            const savedPosition = player.position;
            console.log('Attempting to resume player. Current state:', {
                paused: player.paused,
                playing: player.playing,
                position: savedPosition
            });
            
            // Check if player is actually paused before trying to resume
            if (!player.paused) {
                console.log('Player is already playing, skipping resume'.yellow);
                return interaction.followUp({
                    embeds: [{
                        color: client.config.colors.warning,
                        description: `${client.config.emojis.warning} The player is already playing!`
                    }],
                    flags: 64
                }).catch(() => {});
            }
            
            // Use pause(false) to resume - this should preserve position
            try {
                await player.pause(false);
                console.log('Player resumed with pause(false)');
                // Wait for state to update
                await new Promise(resolve => setTimeout(resolve, 150));
            } catch (error) {
                console.error('pause(false) failed:', error.message);
                // Fallback: play and seek back to saved position
                try {
                    if (player.queue.current) {
                        await player.play();
                        // Wait for player to start before seeking
                        await new Promise(resolve => setTimeout(resolve, 300));
                        // Seek back to where we were paused
                        if (savedPosition > 0) {
                            await player.seek(savedPosition);
                            console.log(`Player resumed with play() + seek to ${savedPosition}ms`);
                            // Verify seek worked
                            await new Promise(resolve => setTimeout(resolve, 100));
                            console.log(`Position after seek: ${player.position}ms`);
                        } else {
                            console.log('Player resumed with play() from start');
                        }
                    }
                } catch (playError) {
                    console.error('play() also failed:', playError.message);
                }
            }
            
            console.log('After resume attempt:', {
                paused: player.paused,
                playing: player.playing,
                position: player.position
            });
            
            // Wait a moment for player state to update
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Update bot status
            updateBotActivity(client);
            
            // Update voice channel status using REST API
            try {
                if (player.voiceChannelId && player.queue.current) {
                    const track = player.queue.current;
                    
                    // Truncate title to keep artist visible (max 20 chars for title)
                    const maxTitleLength = 20;
                    const truncatedTitle = track.info.title.length > maxTitleLength 
                        ? track.info.title.substring(0, maxTitleLength) + '...' 
                        : track.info.title;
                    
                    const statusText = `${client.config.emojis.play} **▸ ${truncatedTitle} - ${track.info.author}**`;
                    console.log('Setting resume status:', statusText);
                    
                    await client.rest.put(
                        `/channels/${player.voiceChannelId}/voice-status`,
                        { body: { status: statusText } }
                    ).catch((err) => {
                        console.error('Failed to set resume status:', err.message);
                    });
                }
            } catch (error) {
                console.error('Voice status error (resume):', error.message);
            }
            
            // Refresh the now playing display
            try {
                const { createNowPlayingEmbed, createNowPlayingButtons } = await import('../utils/nowPlayingUtils.js');
                const embed = createNowPlayingEmbed(player, client);
                const buttons = createNowPlayingButtons(player, client);
                
                await interaction.editReply({
                    embeds: [embed],
                    components: buttons
                });
            } catch (error) {
                console.error('Error updating now playing:', error);
                await interaction.followUp({
                    embeds: [{
                        color: client.config.colors.success,
                        description: `${client.config.emojis.play} ▶️ **Resumed the music**`
                    }],
                    flags: 64 // Ephemeral
                }).catch(() => {});
            }
            break;
            
        case 'skip':
            const current = player.queue.current;
            if (!player.queue.tracks.length) {
                return interaction.reply({
                    embeds: [{
                        color: client.config.colors.error,
                        description: `${client.config.emojis.error} No more tracks in queue to skip to!`
                    }],
                    flags: 64 // Ephemeral
                });
            }
            await player.skip();
            await interaction.reply({
                embeds: [{
                    color: client.config.colors.success,
                    description: `${client.config.emojis.skip} ⏭️ **Skipped:** ${current.info.title}`
                }],
                flags: 64 // Ephemeral
            });
            break;
            
        case 'previous':
            if (player.queue.previous.length === 0) {
                return interaction.reply({
                    embeds: [{
                        color: client.config.colors.error,
                        description: `${client.config.emojis.error} No previous tracks available!`
                    }],
                    flags: 64 // Ephemeral
                });
            }
            
            const previousTrack = player.queue.previous[player.queue.previous.length - 1];
            await player.queue.add(previousTrack, 0);
            await player.skip();
            
            await interaction.reply({
                embeds: [{
                    color: client.config.colors.success,
                    description: `⏮️ **Playing previous track:** ${previousTrack.info.title}`
                }],
                flags: 64 // Ephemeral
            });
            break;
            
        case 'stop':
            // Defer reply (already excluded from deferUpdate above)
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferReply();
            }
            
            // Cancel any background conversion in progress
            const isConverting = player.get('backgroundConversion');
            if (isConverting) {
                player.set('backgroundConversion', false); // Signal to stop conversion
                console.log('Cancelled background Spotify conversion (via button)'.yellow);
            }
            
            // Clear voice channel status before destroying
            try {
                await client.rest.put(
                    `/channels/${player.voiceChannelId}/voice-status`,
                    { body: { status: '' } }
                ).catch(() => {});
            } catch (error) {
                // Voice channel status not supported or error occurred
            }
            
            await player.destroy();
            
            // Show different message if conversion was also stopped
            const stopMessage = isConverting 
                ? `${client.config.emojis.stop} ⏹️ **Stopped the music and cleared the queue**\n\n⏹️ Background Spotify conversion also cancelled.\n\nThe player has been destroyed.`
                : `${client.config.emojis.stop} ⏹️ **Stopped the music and cleared the queue**\n\nThe player has been destroyed.`;
            
            await interaction.editReply({
                embeds: [{
                    color: client.config.colors.error,
                    description: stopMessage
                }],
                components: []
            });
            break;
            
        case 'loop':
            const modes = ['off', 'track', 'queue'];
            const currentIndex = modes.indexOf(player.repeatMode);
            const nextMode = modes[(currentIndex + 1) % modes.length];
            await player.setRepeatMode(nextMode);
            
            const loopEmojis = { off: '➡️', track: '🔂', queue: '🔁' };
            
            // Refresh the now playing display with updated loop button
            try {
                // Check if there's a current track before creating embed
                if (!player.queue.current) {
                    throw new Error('No track is currently playing');
                }
                
                const { createNowPlayingEmbed, createNowPlayingButtons } = await import('../utils/nowPlayingUtils.js');
                const embed = createNowPlayingEmbed(player, client);
                const buttons = createNowPlayingButtons(player, client);
                
                await interaction.editReply({
                    embeds: [embed],
                    components: buttons
                });
            } catch (error) {
                console.error('Error updating now playing after loop:', error);
                await interaction.followUp({
                    embeds: [{
                        color: client.config.colors.success,
                        description: `${loopEmojis[nextMode]} **Loop mode changed to:** \`${nextMode.charAt(0).toUpperCase() + nextMode.slice(1)}\``
                    }],
                    flags: 64 // Ephemeral
                }).catch(() => {});
            }
            break;
            
        case 'shuffle':
            if (player.queue.tracks.length < 2) {
                return interaction.reply({
                    embeds: [{
                        color: client.config.colors.error,
                        description: `${client.config.emojis.error} Need at least 2 tracks in queue to shuffle!`
                    }],
                    flags: 64 // Ephemeral
                });
            }
            player.queue.shuffle();
            
            // Show success message without refreshing (shuffle doesn't change button states)
            await interaction.reply({
                embeds: [{
                    color: client.config.colors.success,
                    description: `${client.config.emojis.shuffle} 🔀 **Shuffled ${player.queue.tracks.length} tracks** in the queue`
                }],
                flags: 64 // Ephemeral
            });
            break;
            
        case 'queue':
            try {
                const queueCommand = client.commands.get('queue');
                if (queueCommand) {
                    // Defer reply for queue (new message)
                    if (!interaction.deferred && !interaction.replied) {
                        await interaction.deferReply({ flags: 64 }); // Ephemeral
                    }
                    
                    // Mock options for the command
                    interaction.options = { getInteger: () => 1 };
                    
                    // Mark as deferred so command doesn't try to defer/reply again
                    interaction.deferred = true;
                    
                    await queueCommand.execute(interaction, client);
                } else {
                    if (!interaction.replied) {
                        await interaction.reply({
                            content: '❌ Queue command not available',
                            flags: 64 // Ephemeral
                        });
                    }
                }
            } catch (error) {
                console.error('Error showing queue:', error);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: '❌ Failed to show queue',
                        flags: 64
                    }).catch(() => {});
                }
            }
            break;
            
        case 'refresh':
            try {
                const { createNowPlayingEmbed, createNowPlayingButtons } = await import('../utils/nowPlayingUtils.js');
                const embed = createNowPlayingEmbed(player, client);
                const buttons = createNowPlayingButtons(player, client);
                
                await interaction.editReply({
                    embeds: [embed],
                    components: buttons
                });
            } catch (error) {
                console.error('Error refreshing now playing:', error);
                await interaction.followUp({
                    content: '❌ Failed to refresh now playing display',
                    flags: 64 // Ephemeral
                }).catch(() => {});
            }
            break;
            
        case 'lyrics':
            try {
                if (!player.queue.current) {
                    if (!interaction.replied) {
                        return interaction.reply({
                            embeds: [{
                                color: client.config.colors.error,
                                description: `${client.config.emojis.error} No song is currently playing!`
                            }],
                            flags: 64 // Ephemeral flag
                        });
                    }
                    return;
                }
                
                const lyricsCommand = client.commands.get('lyrics');
                if (lyricsCommand) {
                    // Defer reply for lyrics (not ephemeral since it's in newMessageActions)
                    if (!interaction.deferred && !interaction.replied) {
                        await interaction.deferReply();
                    }
                    
                    // Mock options for the command
                    if (!interaction.options) {
                        interaction.options = {
                            getString: (name) => null
                        };
                    }
                    
                    await lyricsCommand.execute(interaction, client);
                } else {
                    if (!interaction.replied) {
                        await interaction.reply({
                            content: '❌ Lyrics command not available',
                            flags: 64 // Ephemeral flag
                        });
                    }
                }
            } catch (error) {
                console.error('Error showing lyrics:', error);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: '❌ Failed to fetch lyrics',
                        flags: 64 // Ephemeral flag
                    }).catch(() => {});
                } else if (interaction.deferred && !interaction.replied) {
                    await interaction.editReply({
                        embeds: [{
                            color: client.config.colors?.error || 0xFF0000,
                            description: `❌ Failed to fetch lyrics: ${error.message}`
                        }]
                    }).catch(() => {});
                }
            }
            break;
    }
}

async function handleQueueButton(interaction, player, action, currentPage, client) {
    const page = parseInt(currentPage);
    
    switch (action) {
        case 'prev':
            // Defer update for page navigation
            await interaction.deferUpdate().catch(console.error);
            
            if (page > 1) {
                await interaction.editReply({ content: 'Loading previous page...' });
                const command = client.commands.get('queue');
                interaction.options = {
                    getInteger: () => page - 1
                };
                await command.execute(interaction, client);
            }
            break;
            
        case 'next':
            // Defer update for page navigation
            await interaction.deferUpdate().catch(console.error);
            
            await interaction.editReply({ content: 'Loading next page...' });
            const command = client.commands.get('queue');
            interaction.options = {
                getInteger: () => page + 1
            };
            await command.execute(interaction, client);
            break;
            
        case 'clear':
            // Clear sends a new ephemeral message, don't defer update
            const clearedCount = player.queue.tracks.length;
            player.queue.tracks = [];
            
            let description;
            if (player.queue.current) {
                description = `${client.config.emojis.success} **Cleared ${clearedCount} track${clearedCount !== 1 ? 's' : ''} from queue**\n\n` +
                             `🎵 **Current song will keep playing:**\n` +
                             `${player.queue.current.info.title}\n\n` +
                             `💡 Music will stop after the current song finishes.`;
            } else {
                description = `${client.config.emojis.success} **Cleared the queue** (${clearedCount} track${clearedCount !== 1 ? 's' : ''})`;
            }
            
            await interaction.reply({
                embeds: [{
                    color: client.config.colors.success,
                    description: description
                }],
                flags: 64 // Ephemeral
            });
            break;
    }
}

// Handle switch lavalink select menu
async function handleSwitchLavalinkSelect(interaction, client) {
    try {
        await interaction.deferUpdate();
        
        const e = client.config.emojis;
        const selectedIndex = parseInt(interaction.values[0]);
        
        // Get the stored server data
        const servers = client.tempData?.get(`switch_lavalink_${interaction.user.id}`);
        if (!servers) {
            return await interaction.editReply({
                embeds: [{
                    color: client.config.colors.error,
                    title: `${e.error} Session Expired`,
                    description: `${e.warning} The server selection has expired. Please run \`-switchlavalink\` again.`,
                    footer: { text: 'v2.2.0 | Switch Lavalink' },
                    timestamp: new Date()
                }],
                components: []
            });
        }
        
        const selectedServer = servers[selectedIndex];
        if (!selectedServer) {
            return await interaction.editReply({
                embeds: [{
                    color: client.config.colors.error,
                    title: `${e.error} Invalid Selection`,
                    description: `${e.warning} The selected server is no longer available.`,
                    footer: { text: 'v2.2.0 | Switch Lavalink' },
                    timestamp: new Date()
                }],
                components: []
            });
        }
        
        // Update status
        await interaction.editReply({
            embeds: [{
                color: client.config.colors.primary,
                title: `${e.loading} Switching Lavalink Server...`,
                description: `${e.server} **Selected Server:** ${selectedServer.name}\n` +
                           `${e.control} Host: \`${selectedServer.host}:${selectedServer.port}\`\n` +
                           `${e.time} Latency: **${selectedServer.latency}ms**\n\n` +
                           `${e.gear} Updating configuration...\n` +
                           `${e.refresh} Restarting Lavalink connection...`,
                footer: { text: 'v2.2.0 | Switch Lavalink' },
                timestamp: new Date()
            }],
            components: []
        });
        
        // Update .env file and ecosystem.config.cjs
        try {
            const envPath = join(process.cwd(), '.env');
            let envContent = readFileSync(envPath, 'utf-8');
            
            // Update the Lavalink configuration in .env
            envContent = envContent.replace(/LAVALINK_HOST=.*/g, `LAVALINK_HOST=${selectedServer.host}`);
            envContent = envContent.replace(/LAVALINK_PORT=.*/g, `LAVALINK_PORT=${selectedServer.port}`);
            envContent = envContent.replace(/LAVALINK_PASSWORD=.*/g, `LAVALINK_PASSWORD=${selectedServer.password}`);
            envContent = envContent.replace(/LAVALINK_SECURE=.*/g, `LAVALINK_SECURE=${selectedServer.secure}`);
            
            writeFileSync(envPath, envContent, 'utf-8');
            
            // Also update ecosystem.config.cjs for PM2
            const ecosystemPath = join(process.cwd(), 'ecosystem.config.cjs');
            let ecosystemContent = readFileSync(ecosystemPath, 'utf-8');
            
            ecosystemContent = ecosystemContent.replace(/LAVALINK_HOST: ['"].*?['"]/g, `LAVALINK_HOST: '${selectedServer.host}'`);
            ecosystemContent = ecosystemContent.replace(/LAVALINK_PORT: ['"].*?['"]/g, `LAVALINK_PORT: '${selectedServer.port}'`);
            ecosystemContent = ecosystemContent.replace(/LAVALINK_PASSWORD: ['"].*?['"]/g, `LAVALINK_PASSWORD: '${selectedServer.password}'`);
            ecosystemContent = ecosystemContent.replace(/LAVALINK_SECURE: ['"].*?['"]/g, `LAVALINK_SECURE: '${selectedServer.secure}'`);
            
            writeFileSync(ecosystemPath, ecosystemContent, 'utf-8');
            
            // Update client config
            client.config.lavalink.host = selectedServer.host;
            client.config.lavalink.port = selectedServer.port;
            client.config.lavalink.password = selectedServer.password;
            client.config.lavalink.secure = selectedServer.secure;
            
            // Destroy all players
            const players = [...client.lavalink.players.values()];
            for (const player of players) {
                try {
                    player.destroy();
                } catch (err) {
                    console.error('Error destroying player:', err);
                }
            }
            
            // Success - configuration updated
            await interaction.editReply({
                embeds: [{
                    color: client.config.colors.success,
                    title: `${e.checkmark} Configuration Updated!`,
                    description: `${e.rocket} **Selected Server:** ${selectedServer.name}\n\n` +
                               `${e.server} **Connection Details:**\n` +
                               `└─ Host: \`${selectedServer.host}:${selectedServer.port}\`\n` +
                               `└─ ${e.time} Latency: **${selectedServer.latency}ms**\n` +
                               `└─ ${e.shield} Secure: ${selectedServer.secure ? `${e.checkmark} Yes` : `${e.error} No`}\n\n` +
                               `${e.checkmark} Configuration saved to \`.env\`\n` +
                               `${e.gear} Restarting bot to apply changes...\n\n` +
                               `${e.info} The bot will reconnect in ~5 seconds.`,
                    footer: { text: 'v2.2.0 | Restarting...' },
                    timestamp: new Date()
                }],
                components: []
            });
            
            // Clean up temp data
            client.tempData.delete(`switch_lavalink_${interaction.user.id}`);
            
            // Log the switch
            console.log(`\n${'='.repeat(50)}`);
            console.log('Lavalink server switch requested');
            console.log(`New server: ${selectedServer.name}`);
            console.log(`Host: ${selectedServer.host}:${selectedServer.port}`);
            console.log(`Restarting bot in 2 seconds...`);
            console.log(`${'='.repeat(50)}\n`);
            
            // Wait a moment for the message to send, then restart with updated env
            setTimeout(async () => {
                const { exec } = await import('child_process');
                // Try to restart with PM2 first (try momoify-bot, fallback to geomsc, then process.exit)
                exec('pm2 restart momoify-bot --update-env', (error) => {
                    if (error) {
                        console.log('PM2 restart momoify-bot failed, trying geomsc...');
                        exec('pm2 restart geomsc --update-env', (error2) => {
                            if (error2) {
                                console.log('PM2 restart with --update-env failed, using process.exit()');
                                process.exit(0); // Fallback
                            }
                        });
                    }
                });
            }, 2000);
            
        } catch (error) {
            console.error('Error switching Lavalink server:', error);
            
            await interaction.editReply({
                embeds: [{
                    color: client.config.colors.error,
                    title: `${e.error} Failed to Switch Server`,
                    description: `${e.warning} **Error:** ${error.message}\n\n` +
                               `${e.info} The configuration may have been partially updated.\n` +
                               `${e.bulb} You may need to restart the bot manually.`,
                    footer: { text: 'v2.2.0 | Switch Failed' },
                    timestamp: new Date()
                }],
                components: []
            });
        }
        
    } catch (error) {
        console.error('Error handling switch lavalink select:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: '❌ An error occurred while switching servers.',
                flags: 64
            }).catch(() => {});
        }
    }
}

// Handle help category select menu
async function handleHelpCategorySelect(interaction, client) {
    try {
        // Defer the update first to prevent timeout
        await interaction.deferUpdate();
        
        const selectedValue = interaction.values[0];
        const category = selectedValue.replace('category_', '');
        const e = client.config.emojis;
        
        let embed;
    
    switch (category) {
        case 'config':
            embed = new EmbedBuilder()
                .setColor(client.config.colors.primary)
                .setTitle(`${e.gear} Configuration Commands`)
                .setDescription('Customize your bot settings and preferences')
                .addFields(
                    {
                        name: '`/config` or `-config`',
                        value: 'View all bot settings for this server\nShows: prefix, DJ role, volume, 24/7 mode, etc.',
                        inline: false
                    },
                    {
                        name: '`/prefix` or `-prefix`',
                        value: 'Change the text command prefix\n**Example:** `/prefix !` to use `!play` instead of `-play`',
                        inline: false
                    },
                    {
                        name: '`/aliases` or `-aliases`',
                        value: 'View all available command aliases\nShows shortcuts like `-p` for play, `-q` for queue, etc.',
                        inline: false
                    },
                    {
                        name: '`/lockcommands` (Owner Only)',
                        value: 'Lock all commands to bot owner only\nUseful for maintenance or private testing',
                        inline: false
                    }
                )
                .setFooter({ text: 'Use /help for main menu', iconURL: client.user.displayAvatarURL() });
            break;
            
        case 'music':
            embed = new EmbedBuilder()
                .setColor(client.config.colors.primary)
                .setTitle(`${e.melody} Music Commands`)
                .setDescription('Play, control, and manage your music')
                .addFields(
                    {
                        name: '**Playback**',
                        value: '`/play` `-p` - Play songs or playlists\n' +
                               '`/pause` `-pau` - Pause/resume playback\n' +
                               '`/skip` `-s` - Skip current song\n' +
                               '`/stop` - Stop and clear queue\n' +
                               '`/nowplaying` `-np` - Show current song',
                        inline: false
                    },
                    {
                        name: '**Queue**',
                        value: '`/queue` `-q` - View queue with pagination\n' +
                               '`/playnext` `-pn` - Add song to play next\n' +
                               '`/remove` `-rm` - Remove song by position\n' +
                               '`/shuffle` `-sh` - Shuffle the queue\n' +
                               '`/loop` `-l` - Loop mode (off/track/queue)',
                        inline: false
                    },
                    {
                        name: '**Audio**',
                        value: '`/volume` `-v` - Set volume (0-200%)\n' +
                               '`/seek` - Seek to position\n' +
                               '`/autoplay` `-ap` - Toggle unlimited playlist',
                        inline: false
                    },
                    {
                        name: '**Voice**',
                        value: '`/join` - Join your voice channel\n' +
                               '`/leave` - Leave voice channel\n' +
                               '`/247` - Toggle 24/7 mode',
                        inline: false
                    }
                )
                .setFooter({ text: 'Use /help for main menu', iconURL: client.user.displayAvatarURL() });
            break;
            
        case 'filters':
            embed = new EmbedBuilder()
                .setColor(client.config.colors.primary)
                .setTitle(`${e.disk} Audio Filter Commands`)
                .setDescription('Apply effects and modify audio playback')
                .addFields(
                    {
                        name: '`/filters` or `-filters` or `-f`',
                        value: 'Apply audio filters (8 presets)\n' +
                               '**Filters:** bassboost, nightcore, vaporwave, 8d, karaoke, vibrato, tremolo, soft',
                        inline: false
                    },
                    {
                        name: '`/speed`',
                        value: 'Adjust playback speed (0.5x - 3.0x)\n' +
                               '**Example:** `/speed 1.5` for 1.5x speed',
                        inline: false
                    },
                    {
                        name: '`/pitch`',
                        value: 'Adjust audio pitch (0.5x - 3.0x)\n' +
                               '**Example:** `/pitch 1.2` for higher pitch',
                        inline: false
                    },
                    {
                        name: '`/rate`',
                        value: 'Adjust playback rate (speed + pitch)\n' +
                               '**Example:** `/rate 0.8` for slower + lower pitch',
                        inline: false
                    }
                )
                .setFooter({ text: 'Use /help for main menu', iconURL: client.user.displayAvatarURL() });
            break;
            
        case 'general':
            embed = new EmbedBuilder()
                .setColor(client.config.colors.primary)
                .setTitle('❓ General Commands')
                .setDescription('Utility and information commands')
                .addFields(
                    {
                        name: '`/help`',
                        value: 'Show this help menu\nBrowse commands by category',
                        inline: false
                    },
                    {
                        name: '`/about`',
                        value: 'Information about the bot\nShows version, features, and stats',
                        inline: false
                    },
                    {
                        name: '`/ping`',
                        value: 'Check bot latency\nShows Discord API and Lavalink ping',
                        inline: false
                    },
                    {
                        name: '`/profile`',
                        value: 'View your listening statistics\nShows tracks played, time listened, etc.',
                        inline: false
                    },
                    {
                        name: '`/leaderboard`',
                        value: 'View server music leaderboard\nSee who listens to music the most',
                        inline: false
                    },
                    {
                        name: '`/leaderboardglobal`',
                        value: 'View global music leaderboard\nSee top listeners across all servers',
                        inline: false
                    },
                    {
                        name: '`/search`',
                        value: 'Search for songs by platform\nSupports YouTube, Spotify, SoundCloud, etc.',
                        inline: false
                    },
                    {
                        name: '`/playlist`',
                        value: 'Manage your custom playlists\nCreate, load, delete, and view playlists',
                        inline: false
                    },
                    {
                        name: '`/lyrics`',
                        value: 'Get lyrics for current or specified song\nShows synchronized lyrics when available',
                        inline: false
                    }
                )
                .setFooter({ text: 'Use /help for main menu', iconURL: client.user.displayAvatarURL() });
            break;
    }
    
    // Edit the original message with the new embed
    await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Error handling help category select:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: '❌ An error occurred while loading the category.',
                flags: 64
            }).catch(() => {});
        }
    }
}

async function handleHelpButton(interaction, type, client) {
    try {
        let embed;
        const isOwner = interaction.user.id === client.config.ownerId;
        
        switch (type) {
            case 'all':
            // Show all commands in organized format
            const e = client.config.emojis;
            embed = new EmbedBuilder()
                .setColor(client.config.colors.primary)
                .setTitle(`${e.cloudnote} All Commands`)
                .setDescription(`**Total Commands:** ${client.commands.size}\n\nCommands organized by category:`)
                .addFields(
                    {
                        name: `${e.play} Playback (10)`,
                        value: '`play` `playnext` `pause` `resume` `skip` `skipto` `replay` `grab` `stop` `nowplaying`',
                        inline: false
                    },
                    {
                        name: `${e.queue} Queue (6)`,
                        value: '`queue` `remove` `move` `shuffle` `loop` `autoplay`',
                        inline: false
                    },
                    {
                        name: `${e.volume} Audio (6)`,
                        value: '`volume` `seek` `speed` `pitch` `rate` `filters`',
                        inline: false
                    },
                    {
                        name: `${e.headphone} Voice (5)`,
                        value: '`join` `leave` `disconnect` `247` `clearstatus`',
                        inline: false
                    },
                    {
                        name: '🔍 Search & Discovery (2)',
                        value: '`search` `lyrics`',
                        inline: false
                    },
                    {
                        name: `${e.cloudnote} Playlists (1)`,
                        value: '`playlist`',
                        inline: false
                    },
                    {
                        name: `${e.stars} Stats & Profile (3)`,
                        value: '`profile` `leaderboard` `leaderboardglobal`',
                        inline: false
                    },
                    {
                        name: `${e.gear} Configuration (4)`,
                        value: '`config` `prefix` `aliases` `lockcommands`',
                        inline: false
                    },
                    {
                        name: '❓ General (3)',
                        value: '`help` `about` `ping`',
                        inline: false
                    }
                )
                .setFooter({ 
                    text: '💡 Tip: Use the dropdown menu above to explore each category',
                    iconURL: client.user.displayAvatarURL() 
                });
            break;
            
        case 'admin':
            if (!isOwner) {
                return interaction.reply({
                    content: '❌ Only the bot owner can view admin commands!',
                    flags: 64 // Ephemeral
                });
            }
            
            embed = new EmbedBuilder()
                .setColor(client.config.colors.error)
                .setTitle('🔐 Admin Commands (Owner Only)')
                .setDescription(
                    '**Secret commands using `-` prefix**\n' +
                    '⚠️ These commands are invisible to regular users.\n\u200B'
                )
                .addFields(
                    {
                        name: `${client.config.emojis.cloudnote} \`-printah\` - Register Slash Commands`,
                        value: '**Register or update slash commands instantly**\n\n' +
                               '**Usage:**\n' +
                               '• `-printah` - Register globally (1 hour delay)\n' +
                               '• `-printah guild` - Register to current server (instant)\n' +
                               '• `-printah guild <id>` - Register to specific server\n' +
                               '• `-printah g` - Shortcut for guild registration\n\n' +
                               '**Example:** `-printah g` to update commands instantly',
                        inline: false
                    },
                    {
                        name: `${client.config.emojis.refresh} \`-reload\` - Reload Commands`,
                        value: '**Reload commands without restarting the bot**\n\n' +
                               '**Usage:**\n' +
                               '• `-reload <command>` - Reload specific command\n' +
                               '• `-reload all` - Reload all commands\n\n' +
                               '**Example:** `-reload play` after editing play.js',
                        inline: false
                    },
                    {
                        name: `${client.config.emojis.control} \`-eval\` - Execute JavaScript`,
                        value: '**Run JavaScript code for debugging**\n\n' +
                               '**Usage:**\n' +
                               '• `-eval <code>` - Execute code\n\n' +
                               '**Examples:**\n' +
                               '• `-eval client.guilds.cache.size` - Get server count\n' +
                               '• `-eval client.lavalink.players.size` - Get active players\n\n' +
                               '⚠️ **Auto-censors:** Token & passwords are hidden',
                        inline: false
                    },
                    {
                        name: `${client.config.emojis.disk} \`-stats\` - Bot Statistics`,
                        value: '**Show detailed bot statistics**\n\n' +
                               '**Usage:**\n' +
                               '• `-stats` - Display all stats\n\n' +
                               '**Shows:** Uptime, memory, servers, players, ping, command lock status',
                        inline: false
                    },
                    {
                        name: '🔗 `-lavalink` - Lavalink Status',
                        value: '**Show Lavalink node status and statistics**\n\n' +
                               '**Usage:**\n' +
                               '• `-lavalink` - Display node status\n\n' +
                               '**Shows:** Connection, uptime, memory, CPU, players, plugins',
                        inline: false
                    },
                    {
                        name: '🏓 `-ping` - Check Latency',
                        value: '**Check bot and Lavalink latency**\n\n' +
                               '**Usage:**\n' +
                               '• `-ping` - Display all latency info\n\n' +
                               '**Shows:** Discord API ping, bot response time, Lavalink node status',
                        inline: false
                    },
                    {
                        name: '🔍 `-testlavalink` - Test Lavalink Servers',
                        value: '**Test multiple Lavalink servers for best performance**\n\n' +
                               '**Usage:**\n' +
                               '• `-testlavalink` or `/testlavalink` - Test all configured servers\n\n' +
                               '**Shows:** Latency, version, status, and recommendations',
                        inline: false
                    },
                    {
                        name: '🔄 `-switchlavalink` - Switch Lavalink Server',
                        value: '**Switch to a different Lavalink server with interactive selection**\n\n' +
                               '**Usage:**\n' +
                               '• `-switchlavalink` or `/switchlavalink` - Test and switch servers\n\n' +
                               '**Features:**\n' +
                               '• Tests all servers and shows top 5 fastest\n' +
                               '• Interactive dropdown menu to select server\n' +
                               '• Automatically updates .env configuration\n' +
                               '• Restarts Lavalink connection seamlessly\n' +
                               '• Shows detailed status updates',
                        inline: false
                    },
                    {
                        name: '📄 `-logs` - View Bot Logs',
                        value: '**View recent bot logs for debugging**\n\n' +
                               '**Usage:**\n' +
                               '• `-logs [type] [lines]` - View logs\n' +
                               '• Types: `error`, `combined`, `out`\n' +
                               '• Default: 50 lines, max 200\n\n' +
                               '**Example:** `-logs error 100` to view last 100 errors',
                        inline: false
                    },
                    {
                        name: `${client.config.emojis.melody} \`-listemojis\` - List Custom Emojis`,
                        value: '**List all custom emojis available to the bot**\n\n' +
                               '**Usage:**\n' +
                               '• `-listemojis` - List all emojis from guilds\n\n' +
                               '**Shows:** All custom emojis in config-ready format',
                        inline: false
                    },
                    {
                        name: `${client.config.emojis.melody} \`-listemojisbot\` - List Emojis from File`,
                        value: '**List emojis from emoji.txt file**\n\n' +
                               '**Usage:**\n' +
                               '• `-listemojisbot` - Display emojis from emoji.txt\n\n' +
                               '**Shows:** All emojis organized by category',
                        inline: false
                    },
                    {
                        name: `${client.config.emojis.cloudnote} \`-uploademojis\` - Upload Emojis`,
                        value: '**Upload custom emojis to the current server**\n\n' +
                               '**Usage:**\n' +
                               '• `-uploademojis` - Upload predefined emojis\n\n' +
                               '**Requires:** `Manage Expressions` permission',
                        inline: false
                    },
                    {
                        name: `${client.config.emojis.cloudnote} \`-help\` - Admin Help`,
                        value: '**Show this admin help menu**\n\n' +
                               '**Usage:**\n' +
                               '• `-help` - Display admin commands',
                        inline: false
                    },
                    {
                        name: `${client.config.emojis.verified} Security Features`,
                        value: `${client.config.emojis.checkmark} Owner-only access (ID: \`` + client.config.ownerId + '`)\n' +
                               `${client.config.emojis.checkmark} Silent failure for non-owners\n` +
                               `${client.config.emojis.checkmark} Token/password protection in eval\n` +
                               `${client.config.emojis.checkmark} No slash command listing`,
                        inline: false
                    },
                    {
                        name: `${client.config.emojis.stars} Quick Tips`,
                        value: '• Test changes: `-reload play` → `-printah g`\n' +
                               '• Debug issues: `-eval` to inspect bot state\n' +
                               '• Fast updates: `-printah guild` updates instantly\n' +
                               '• Monitor: `-stats` for performance metrics\n' +
                               '• Check audio: `-lavalink` for node health\n' +
                               '• Switch servers: `-switchlavalink` for best performance\n' +
                               '• View errors: `-logs error` for recent issues\n' +
                               '• Manage emojis: `-listemojis` for config setup',
                        inline: false
                    }
                )
                .setFooter({ 
                    text: 'Admin commands are hidden from regular users • 13 commands total • v2.2.0',
                    iconURL: client.user.displayAvatarURL() 
                });
            break;
            
        case 'commands':
            const totalCommands = client.commands.size;
            const commandFields = [
                {
                    name: `${client.config.emojis.stars} Command Formats`,
                    value: '**Three ways to use commands:**\n' +
                           `${client.config.emojis.checkmark} **Slash Commands:** \`/play song\` (has autocomplete)\n` +
                           `${client.config.emojis.checkmark} **Text Commands:** \`-play song\` (faster typing)\n` +
                           '⚡ **Short Aliases:** `-p song` (ultra fast!)\n' +
                           '**All work exactly the same!**\n\u200B',
                    inline: false
                },
                {
                    name: `${client.config.emojis.play} Playback (10 commands)`,
                    value: '`/play` or `-play` or `-p` - Play songs or playlists\n' +
                           '`/playnext` or `-playnext` or `-pn` - Add song to play next\n' +
                           '`/pause` or `-pause` or `-pau` - Pause/resume playback\n' +
                           '`/resume` or `-resume` or `-res` - Resume paused song\n' +
                           '`/skip` or `-skip` or `-s` - Skip current or multiple songs\n' +
                           '`/skipto` or `-skipto` or `-st` - Skip to position in queue\n' +
                           '`/replay` or `-replay` or `-rp` - Replay current song from start\n' +
                           '`/grab` or `-grab` or `-gr` - Save current song to your DMs\n' +
                           '`/stop` or `-stop` - Stop and clear queue\n' +
                           '`/nowplaying` or `-nowplaying` or `-np` - Show current song',
                    inline: false
                },
                {
                    name: `${client.config.emojis.queue} Queue Management (6 commands)`,
                    value: '`/queue` or `-queue` or `-q` - View queue with pagination\n' +
                           '`/remove` or `-remove` or `-rm` - Remove song by position\n' +
                           '`/move` or `-move` or `-m` - Move song position\n' +
                           '`/shuffle` or `-shuffle` or `-sh` - Shuffle the queue\n' +
                           '`/loop` or `-loop` or `-l` - Loop mode (off/track/queue)\n' +
                           '`/autoplay` or `-autoplay` or `-ap` - Toggle unlimited playlist 🔄',
                    inline: false
                },
                {
                    name: `${client.config.emojis.volume} Audio Control (6 commands)`,
                    value: '`/volume` or `-volume` or `-v` - Set volume (0-200%)\n' +
                           '`/seek` or `-seek` - Seek position (e.g., 1m30s)\n' +
                           '`/speed` - Adjust playback speed (0.5x - 3.0x)\n' +
                           '`/pitch` - Adjust audio pitch (0.5x - 3.0x)\n' +
                           '`/rate` - Adjust playback rate (speed + pitch)\n' +
                           '`/filters` or `-filters` or `-f` - Apply 8 audio filters',
                    inline: false
                },
                {
                    name: `${client.config.emojis.headphone} Voice Channel (5 commands)`,
                    value: '`/join` or `-join` - Join your voice channel\n' +
                           '`/leave` or `-leave` - Leave voice channel\n' +
                           '`/disconnect` or `-disconnect` - Full disconnect\n' +
                           '`/247` or `-247` - Toggle 24/7 mode (Admin)\n' +
                           '`/clearstatus` or `-clearstatus` or `-cs` - Clear VC status',
                    inline: false
                },
                {
                    name: '🔍 Search & Discovery (2 commands)',
                    value: '`/search` or `-search` - Search on specific platforms\n' +
                           '`/lyrics` or `-lyrics` - Get song lyrics',
                    inline: false
                },
                {
                    name: '📁 Playlist Management (1 command)',
                    value: '`/playlist` or `-playlist` or `-pl` - Manage saved playlists\n' +
                           '└ `create` - Create new playlist\n' +
                           '└ `list` - View all playlists\n' +
                           '└ `play` - Play saved playlist\n' +
                           '└ `show` - View playlist tracks\n' +
                           '└ `add` - Add track (by name/URL or current)\n' +
                           '└ `remove` - Remove track (Admin)\n' +
                           '└ `delete` - Delete playlist (Admin)',
                    inline: false
                },
                {
                    name: `${client.config.emojis.control} Configuration (4 commands - Admin)`,
                    value: '`/prefix` or `-prefix` - Manage text command prefix\n' +
                           '└ `show` - View current prefix\n' +
                           '└ `set` - Change prefix (1-5 chars)\n' +
                           '└ `reset` - Reset to default\n\n' +
                           '`/aliases` or `-aliases` - Manage command aliases\n' +
                           '└ `set` - Create custom alias\n' +
                           '└ `list` - View all aliases\n' +
                           '└ `remove` - Remove custom alias\n\n' +
                           '`/config` or `-config` - View/edit bot settings\n' +
                           '└ `show` - View current settings\n' +
                           '└ `set` - Change a setting\n' +
                           '└ `reset` - Reset to default\n' +
                           '└ `keys` - List all config keys\n\n' +
                           '`/lockcommands` or `-lockcommands` - 🔒 Lock commands to owner\n' +
                           '└ `lock` - Lock all commands (owner only)\n' +
                           '└ `unlock` - Unlock all commands\n' +
                           '└ `status` - Check lock status',
                    inline: false
                },
                {
                    name: `${client.config.emojis.disk} Stats & Rankings (2 commands)`,
                    value: '`/profile` or `-profile` - View your music listening profile\n' +
                           '└ Top servers, top tracks, total stats\n' +
                           '`/leaderboard` or `-leaderboard` - View leaderboards\n' +
                           '└ Server or Global scope\n' +
                           '└ Sort by tracks or listening time',
                    inline: false
                },
                {
                    name: `${client.config.emojis.cloudnote} Information (3 commands)`,
                    value: '`/help` or `-help` - Show this help menu\n' +
                           '`/about` or `-about` - Bot info, stats & credits\n' +
                           '`/ping` or `-ping` - Check bot latency & response time',
                    inline: false
                }
            ];
            
            // Add admin commands section for owner
            if (isOwner) {
                commandFields.push({
                    name: `${client.config.emojis.verified} Admin Commands (12 commands - Owner Only)`,
                    value: '`-printah` - Register slash commands\n' +
                           '`-reload` - Reload commands without restart\n' +
                           '`-eval` - Execute JavaScript code\n' +
                           '`-stats` - Show detailed bot statistics\n' +
                           '`-lavalink` - Show Lavalink node status\n' +
                           '`-ping` - Check bot latency & response time\n' +
                           '`-testlavalink` - Test Lavalink server performance\n' +
                           '`-logs` - View bot logs (error/combined/out)\n' +
                           '`-listemojis` - List all available emojis\n' +
                           '`-listemojisbot` - List emojis from emoji.txt\n' +
                           '`-uploademojis` - Upload emojis to server\n' +
                           '`-help` - Show admin help menu\n\n' +
                           '**Note:** Admin commands use `-` prefix only\n\n' +
                           '**💡 Tip:** Use `/lockcommands` to restrict bot access',
                    inline: false
                });
            }
            
            embed = new EmbedBuilder()
                .setColor(client.config.colors.primary)
                .setTitle(`📖 All Commands (${totalCommands} Total${isOwner ? ' + 12 Admin' : ''})`)
                .setDescription('**Complete command list with both formats!**\n' +
                               '**✨ NEW in v2.2.0:** `/lockcommands` for access control, improved autoplay\n\u200B')
                .addFields(...commandFields)
                .setFooter({ 
                    text: `v2.2.0 • Use / for autocomplete or - for faster typing • ${totalCommands} commands available${isOwner ? ' + 12 admin' : ''}`,
                    iconURL: client.user.displayAvatarURL() 
                });
            break;
            
        case 'about':
            const uptime = formatUptime(process.uptime());
            const memoryUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
            
            embed = new EmbedBuilder()
                .setColor(client.config.colors.primary)
                .setTitle(`${client.config.emojis.melody} About ${client.config.botName}`)
                .setDescription(
                    `**${client.config.botName} v2.2.0**\n` +
                    `**Created by GeoNFs • ${client.commands.size} Commands Available • Made with ❤️**\n\n` +
                    `${client.config.emojis.melody} **Bonus:** Try \`/autoplay\` or \`-ap\` for unlimited music!\n\n` +
                    `${client.config.emojis.note1} **Tips:**\n` +
                    `${client.config.emojis.checkmark} Use \`/\` for autocomplete, \`-\` for typing, or \`-p\` for speed!\n` +
                    `${client.config.emojis.checkmark} Use \`/prefix\` to customize your text command prefix\n` +
                    `${client.config.emojis.source} Try \`/search\` or \`-search\` for platform-specific searches\n` +
                    `${client.config.emojis.cloudnote} Use \`/playlist\` or \`-playlist\` to save your favorite tracks\n` +
                    `${client.config.emojis.checkmark} Check \`/profile\` to view your listening stats!\n` +
                    `${client.config.emojis.checkmark} See \`/leaderboard\` for server & global rankings`
                )
                .addFields(
                    {
                        name: `${client.config.emojis.disk} Statistics`,
                        value: `**Servers:** ${client.guilds.cache.size}\n` +
                               `**Users:** ${client.guilds.cache.reduce((a, g) => a + g.memberCount, 0).toLocaleString()}\n` +
                               `**Active Players:** ${client.lavalink.players.size}`,
                        inline: true
                    },
                    {
                        name: `${client.config.emojis.control} Technology`,
                        value: `**Discord.js** v14\n` +
                               `**Lavalink** v4\n` +
                               `**Node.js** ${process.version}`,
                        inline: true
                    },
                    {
                        name: '📈 Performance',
                        value: `**Uptime:** ${uptime}\n` +
                               `**Memory:** ${memoryUsage} MB\n` +
                               `**Ping:** ${client.ws.ping}ms`,
                        inline: true
                    }
                )
                .setFooter({ 
                    text: 'Made with ❤️ by GeoNFs • Version 2.2.0',
                    iconURL: client.user.displayAvatarURL() 
                });
            break;
            
        case 'quickstart':
            embed = new EmbedBuilder()
                .setColor(client.config.colors.primary)
                .setTitle('🎵 Quick Start Guide')
                .setDescription('**Get started in 3 easy steps!**\n\u200B')
                .addFields(
                    {
                        name: `${client.config.emojis.headphone} Join a Voice Channel`,
                        value: `\`${client.config.emojis.headphone}\` Connect to any voice channel in your server`,
                        inline: false
                    },
                    {
                        name: `${client.config.emojis.play} Play Music`,
                        value: `\`${client.config.emojis.play}\` Use \`/play <song>\` or \`-play <song>\`\n` +
                               `\`${client.config.emojis.control}\` Full controls appear automatically!\n` +
                               `\`${client.config.emojis.cloudnote}\` Examples:\n` +
                               '• `/play never gonna give you up` or `-play never gonna give you up`\n' +
                               '• `/play https://youtube.com/...` or `-play https://youtube.com/...`\n' +
                               '• `/play https://open.spotify.com/...` or `-play spotify link`\n\n' +
                               `**${client.config.emojis.bulb} Tip:** Use \`/\` for autocomplete or \`-\` for faster typing!`,
                        inline: false
                    },
                    {
                        name: `${client.config.emojis.control} Control Playback`,
                        value: `\`${client.config.emojis.control}\` Interactive controls appear automatically!\n` +
                               `\`${client.config.emojis.queue}\` Use \`/queue\` or \`-queue\` to view upcoming tracks\n` +
                               `\`${client.config.emojis.refresh}\` Use \`/nowplaying\` or \`-nowplaying\` to refresh the interface\n` +
                               `\`${client.config.emojis.skip}\` Use \`/skip\` or \`-skip\` to skip songs`,
                        inline: false
                    },
                    {
                        name: `${client.config.emojis.stars} Pro Tips`,
                        value: 
                            `\`${client.config.emojis.loop}\` **Unlimited Music:** \`/autoplay\` or \`-autoplay\` for endless songs\n` +
                            `\`${client.config.emojis.skip}\` **Play Next:** \`/playnext\` or \`-pn\` to add songs to front\n` +
                            `\`${client.config.emojis.disk}\` **Save Songs:** \`/grab\` or \`-gr\` to save to your DMs\n` +
                            `\`${client.config.emojis.repeat}\` **Replay:** \`/replay\` or \`-rp\` to restart current song\n` +
                            `\`${client.config.emojis.filters}\` **Audio Effects:** \`/filters\`, \`/speed\`, \`/pitch\`, \`/rate\`\n` +
                            `\`${client.config.emojis.volume}\` **Volume:** \`/volume 150\` or \`-v 150\` to adjust (0-200%)\n` +
                            `\`${client.config.emojis.loop}\` **Loop:** \`/loop\` or \`-l\` to repeat tracks\n` +
                            `\`${client.config.emojis.alwayson}\` **Always On:** \`/247\` to keep bot connected\n` +
                            `\`${client.config.emojis.forward}\` **Seek:** \`/seek 1m30s\` to jump to position`,
                        inline: false
                    }
                )
                .setFooter({ 
                    text: 'Need detailed help? Use /help or -help • Both command types work the same!',
                    iconURL: client.user.displayAvatarURL() 
                });
            break;
            
        case 'features':
            embed = new EmbedBuilder()
                .setColor(client.config.colors.primary)
                .setTitle(`${client.config.emojis?.stars || '🎨'} Bot Features`)
                .setDescription('**Everything this bot can do!**\n\u200B')
                .addFields(
                    {
                        name: `${client.config.emojis?.note1 || '🎵'} Music Playback`,
                        value: '• Play from YouTube, Spotify, SoundCloud, Apple Music, Deezer, Bandcamp\n' +
                               '• Search by name or paste direct URL\n' +
                               '• Playlist support (YouTube & Spotify)\n' +
                               '• High-quality audio streaming',
                        inline: false
                    },
                    {
                        name: `${client.config.emojis?.seek || '🔍'} Advanced Search`,
                        value: '• Platform-specific search (YouTube, Spotify, SoundCloud, etc.)\n' +
                               '• Search for tracks, albums, playlists, artists\n' +
                               '• Interactive selection with buttons\n' +
                               '• Support for 8+ music platforms',
                        inline: false
                    },
                    {
                        name: `${client.config.emojis?.disk || '📁'} Playlist Management`,
                        value: '• Create and save custom playlists\n' +
                               '• Add/remove tracks from playlists\n' +
                               '• Play entire saved playlists\n' +
                               '• Server-specific playlist storage',
                        inline: false
                    },
                    {
                        name: `${client.config.emojis?.queue || '📜'} Queue Management`,
                        value: '• Up to 1,000 tracks in queue\n' +
                               '• Move, remove, shuffle songs\n' +
                               '• Play next, skip to position, replay\n' +
                               '• Loop modes: Off, Track, Queue\n' +
                               `• ${client.config.emojis?.loop || '🔄'} **Autoplay:** Unlimited playlist mode!\n` +
                               `• ${client.config.emojis?.cloudnote || '💾'} **Grab:** Save songs to your DMs`,
                        inline: false
                    },
                    {
                        name: `${client.config.emojis?.volume || '🎛️'} Audio Customization`,
                        value: '• Volume control (0-200%)\n' +
                               '• Seek to any position\n' +
                               '• Speed control (0.5x - 3.0x)\n' +
                               '• Pitch adjustment (0.5x - 3.0x)\n' +
                               '• Rate adjustment (speed + pitch)\n' +
                               '• 8 audio filters (bassboost, nightcore, 8D, etc.)\n' +
                               '• Professional audio effects',
                        inline: false
                    },
                    {
                        name: `${client.config.emojis?.player || '✨'} Interactive Controls`,
                        value: `• Full button interface with \`/play\` command\n` +
                               `• ${client.config.emojis?.previous || '⏮️'} Previous, ${client.config.emojis?.pause || '⏸️'} Pause, ${client.config.emojis?.skip || '⏭️'} Skip, ${client.config.emojis?.stop || '⏹️'} Stop, ${client.config.emojis?.refresh || '🔄'} Refresh buttons\n` +
                               `• ${client.config.emojis?.loop || '🔁'} Loop, ${client.config.emojis?.shuffle || '🔀'} Shuffle, ${client.config.emojis?.queue || '📜'} Queue, Lyrics shortcuts\n` +
                               '• Real-time progress bar & status updates',
                        inline: false
                    },
                    {
                        name: `${client.config.emojis?.control || '⚙️'} Customization`,
                        value: '• Set custom text command prefix per server\n' +
                               '• Create custom command aliases\n' +
                               '• Configure bot settings\n' +
                               '• Customize colors and activity\n' +
                               '• Admin-only configuration commands',
                        inline: false
                    },
                    {
                        name: '⚡ Advanced Features',
                        value: '• 24/7 mode (always connected)\n' +
                               '• Previous track history (25 tracks)\n' +
                               '• Auto-reconnect on disconnect\n' +
                               '• Smart recommendations with autoplay\n' +
                               '• Music stats tracking & leaderboards\n' +
                               '• Latency monitoring (bot/WS/Lavalink)',
                        inline: false
                    }
                )
                .setFooter({ 
                    text: `v2.2.0 • ${client.commands.size} commands • All features 100% free!`,
                    iconURL: client.user.displayAvatarURL() 
                });
            break;
        }
        
        await interaction.update({
            embeds: [embed],
            components: interaction.message.components // Keep the same buttons
        });
    } catch (error) {
        console.error('Error handling help button:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: '❌ An error occurred while loading the help menu.',
                flags: 64
            }).catch(() => {});
        }
    }
}

async function handleSearchButton(interaction, args, client) {
    const [subAction, currentPageOrIndex, userIdOrPage, ...rest] = args;
    
    // Determine userId based on button type
    let userId;
    if (subAction === 'prev' || subAction === 'next') {
        userId = userIdOrPage;
    } else if (subAction === 'page') {
        // Page info button (disabled)
        return;
    } else {
        userId = rest[0] || userIdOrPage;
    }
    
    // Check if button was pressed by the original user
    if (interaction.user.id !== userId) {
        return interaction.reply({
            embeds: [{
                color: client.config.colors.error,
                description: `${client.config.emojis.error} This search result is not for you!`
            }],
            flags: 64 // Ephemeral
        });
    }
    
    // Retrieve cached search results
    const cacheKey = `${userId}_${interaction.message.interaction.id}`;
    const cached = client.searchCache?.get(cacheKey);
    
    if (!cached) {
        return interaction.reply({
            embeds: [{
                color: client.config.colors.error,
                description: `${client.config.emojis.error} Search results expired. Please search again.`
            }],
            flags: 64 // Ephemeral
        });
    }
    
    // Handle pagination (prev/next)
    if (subAction === 'prev' || subAction === 'next') {
        await interaction.deferUpdate();
        
        const currentPage = parseInt(currentPageOrIndex);
        const newPage = subAction === 'prev' ? currentPage - 1 : currentPage + 1;
        
        // Get tracks for new page
        const pageSize = cached.pageSize || 10;
        const allTracks = cached.allTracks;
        const tracks = allTracks.slice(newPage * pageSize, (newPage + 1) * pageSize);
        const totalPages = cached.totalPages;
        
        // Update cached data
        cached.currentPage = newPage;
        cached.tracks = tracks;
        
        // Rebuild embed and buttons
        const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
        
        const formatDuration = (ms) => {
            const seconds = Math.floor(ms / 1000);
            const hours = Math.floor(seconds / 3600);
            const mins = Math.floor((seconds % 3600) / 60);
            const secs = seconds % 60;
            if (hours > 0) return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        };
        
        const embed = new EmbedBuilder()
            .setColor(cached.platformConfig.color)
            .setTitle(`${cached.platformConfig.emoji} Search Results - ${cached.usedFallback ? cached.fallbackSource : cached.platformConfig.name}`)
            .setDescription(`Found **${allTracks.length}** results for **${cached.query}**\n\nSelect a track to play:\n\n📄 Page ${newPage + 1} of ${totalPages}`)
            .setTimestamp();
        
        if (cached.usedFallback) {
            embed.addFields({
                name: '⚠️ Fallback Used',
                value: `${cached.platformConfig.name} plugin is not available or returned no results. Using ${cached.fallbackSource} instead.`,
                inline: false
            });
        }
        
        tracks.forEach((track, index) => {
            const duration = track.info.isStream ? '🔴 LIVE' : formatDuration(track.info.duration);
            const trackNumber = newPage * pageSize + index + 1;
            embed.addFields({
                name: `${trackNumber}. ${track.info.title}`,
                value: `👤 ${track.info.author} • ⏱️ ${duration}`,
                inline: false
            });
        });
        
        // Rebuild buttons
        const row1 = new ActionRowBuilder();
        const row2 = new ActionRowBuilder();
        const row3 = new ActionRowBuilder();
        
        for (let i = 0; i < Math.min(tracks.length, 10); i++) {
            const trackNumber = newPage * pageSize + i + 1;
            const button = new ButtonBuilder()
                .setCustomId(`search_select_${i}_${newPage}_${userId}`)
                .setLabel(`${trackNumber}`)
                .setStyle(ButtonStyle.Primary);
            
            if (i < 5) {
                row1.addComponents(button);
            } else {
                row2.addComponents(button);
            }
        }
        
        const prevButton = new ButtonBuilder()
            .setCustomId(`search_prev_${newPage}_${userId}`)
            .setLabel('◀ Previous')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(newPage === 0);
        
        const pageButton = new ButtonBuilder()
            .setCustomId(`search_page_info_${userId}`)
            .setLabel(`Page ${newPage + 1}/${totalPages}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true);
        
        const nextButton = new ButtonBuilder()
            .setCustomId(`search_next_${newPage}_${userId}`)
            .setLabel('Next ▶')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(newPage >= totalPages - 1);
        
        const cancelButton = new ButtonBuilder()
            .setCustomId(`search_cancel_${userId}`)
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Danger);
        
        row3.addComponents(prevButton, pageButton, nextButton, cancelButton);
        
        const components = [row1];
        if (tracks.length > 5) {
            components.push(row2);
        }
        components.push(row3);
        
        await interaction.editReply({ embeds: [embed], components });
        return;
    }
    
    if (subAction === 'cancel') {
        // Defer immediately
        await interaction.deferUpdate().catch(console.error);
        
        // Remove the search results
        await interaction.editReply({
            embeds: [{
                color: client.config.colors.error,
                description: '❌ Search cancelled.'
            }],
            components: []
        });
        
        // Clean up cache
        if (client.searchCache) {
            client.searchCache.delete(cacheKey);
        }
        return;
    }
    
    if (subAction === 'select') {
        const trackIndex = parseInt(currentPageOrIndex);
        const currentPage = parseInt(userIdOrPage);
        
        if (!cached || !cached.tracks || !cached.tracks[trackIndex]) {
            return interaction.reply({
                embeds: [{
                    color: client.config.colors.error,
                    description: `${client.config.emojis.error} Search results expired. Please search again.`
                }],
                flags: 64 // Ephemeral
            });
        }
        
        const selectedTrack = cached.tracks[trackIndex];
        const voiceChannelId = cached.voiceChannelId;
        const textChannelId = cached.textChannelId;
        const platform = cached.platform;
        
        // Verify user is still in the voice channel
        const member = interaction.guild.members.cache.get(interaction.user.id);
        if (!member.voice.channel || member.voice.channel.id !== voiceChannelId) {
            return interaction.reply({
                embeds: [{
                    color: client.config.colors.error,
                    description: `${client.config.emojis.error} You need to be in the same voice channel!`
                }],
                flags: 64 // Ephemeral
            });
        }
        
        await interaction.deferUpdate();
        
        try {
            // Get or create player
            let player = client.lavalink.getPlayer(interaction.guildId);
            
            if (!player) {
                player = client.lavalink.createPlayer({
                    guildId: interaction.guildId,
                    voiceChannelId: voiceChannelId,
                    textChannelId: textChannelId,
                    selfDeaf: true,
                    selfMute: false,
                    volume: 75
                });
                
                console.log('[Search] Connecting player to voice channel...'.yellow);
                console.log(`  Voice channel ID: ${voiceChannelId}`.yellow);
                console.log(`  Voice channel type: ${member.voice.channel?.type}`.yellow);
                
                try {
                    await player.connect();
                    console.log('[Search] Connect() call completed'.green);
                } catch (error) {
                    console.error('[Search] Connect() threw error:'.red, error);
                }
                
                // Wait for connection to establish (increased timeout to 5 seconds)
                let connectionAttempts = 0;
                const maxAttempts = 50; // 5 seconds (50 * 100ms)
                
                console.log('[Search] Waiting for connection...'.yellow);
                while (!player.connected && connectionAttempts < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    connectionAttempts++;
                    
                    // Log progress every second
                    if (connectionAttempts % 10 === 0) {
                        console.log(`[Search] Still waiting... ${connectionAttempts * 100}ms`.yellow);
                        console.log(`  Player state: connected=${player.connected}, voiceChannelId=${player.voiceChannelId}`.yellow);
                    }
                }
                
                if (!player.connected) {
                    console.error(`[Search] Failed to connect after ${connectionAttempts * 100}ms!`.red);
                    console.error(`  Player voiceChannelId: ${player.voiceChannelId}`.red);
                    console.error(`  Player state: ${JSON.stringify(player.state)}`.red);
                    
                    // Don't fail - let it try to play anyway (Lavalink might still work)
                    console.log('[Search] Continuing anyway - Lavalink might still work...'.yellow);
                } else {
                    console.log(`[Search] Player connected after ${connectionAttempts * 100}ms`.green);
                }
            }
            
            const wasPlaying = player.playing || player.paused;
            
            console.log('[Search] Before adding track:'.cyan);
            console.log(`  Current queue size: ${player.queue.tracks.length}`.cyan);
            console.log(`  Track to add: ${selectedTrack.info.title}`.cyan);
            console.log(`  Track source: ${selectedTrack.info.sourceName}`.cyan);
            console.log(`  Track URI: ${selectedTrack.info.uri}`.cyan);
            console.log(`  Track encoded: ${selectedTrack.encoded ? 'YES' : 'NO'}`.cyan);
            console.log(`  Was playing: ${wasPlaying}`.cyan);
            console.log(`  Player exists: ${!!player}`.cyan);
            console.log(`  Player connected: ${player.connected}`.cyan);
            
            // Ensure requester is set
            if (!selectedTrack.requester) {
                selectedTrack.requester = interaction.user;
                console.log(`  Set requester to: ${interaction.user.tag}`.yellow);
            }
            
            // Check if track needs to be resolved (re-searched)
            // Sometimes cached tracks lose their encoded data
            let trackToAdd = selectedTrack;
            
            if (!selectedTrack.encoded || !selectedTrack.info.identifier) {
                console.log('[Search] Track missing encoded data, re-searching...'.yellow);
                try {
                    // Re-search to get fresh track data
                    const node = client.lavalink.nodeManager.leastUsedNodes()[0];
                    const freshResult = await node.search({
                        query: selectedTrack.info.uri || selectedTrack.info.title,
                        source: selectedTrack.info.sourceName === 'youtube' ? 'ytsearch' : 
                                selectedTrack.info.sourceName === 'soundcloud' ? 'scsearch' :
                                selectedTrack.info.sourceName === 'spotify' ? 'spsearch' : 'ytsearch'
                    }, interaction.user);
                    
                    if (freshResult?.tracks?.[0]) {
                        trackToAdd = freshResult.tracks[0];
                        trackToAdd.requester = interaction.user;
                        console.log('[Search] Got fresh track data'.green);
                    } else {
                        console.error('[Search] Failed to get fresh track data'.red);
                    }
                } catch (error) {
                    console.error('[Search] Error re-searching track:', error.message);
                }
            }
            
            // Add track to queue
            player.queue.add(trackToAdd);
            
            console.log('[Search] After adding track:'.green);
            console.log(`  New queue size: ${player.queue.tracks.length}`.green);
            console.log(`  Queue tracks:`, player.queue.tracks.map(t => `${t.info.title} (${t.info.sourceName})`));
            
            // Start playing if not already
            if (!wasPlaying) {
                console.log('[Search] Starting playback...'.yellow);
                console.log(`  Player connected flag: ${player.connected}`.yellow);
                console.log(`  Player voiceChannelId: ${player.voiceChannelId}`.yellow);
                
                try {
                    await player.play();
                    console.log('[Search] Play() call completed'.green);
                } catch (error) {
                    console.error('[Search] Play() threw error:'.red, error);
                    return interaction.editReply({
                        embeds: [{
                            color: client.config.colors.error,
                            description: `${client.config.emojis.error} Failed to start playback: ${error.message}`
                        }],
                        components: []
                    });
                }
                
                // Wait for track to actually start (with timeout)
                let attempts = 0;
                const maxAttempts = 10; // 2 seconds max (10 * 200ms)
                
                while (!player.queue.current && attempts < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                    attempts++;
                }
                
                console.log(`[Search] Track started after ${attempts * 200}ms`.green);
                
                // Show Now Playing interface if track loaded
                if (player.queue.current) {
                    try {
                        const { createNowPlayingEmbed, createNowPlayingButtons } = await import('../utils/nowPlayingUtils.js');
                        const embed = createNowPlayingEmbed(player, client);
                        const buttons = createNowPlayingButtons(player, client);
                        
                        await interaction.editReply({
                            embeds: [embed],
                            components: buttons
                        });
                    } catch (error) {
                        console.error('Error showing now playing after search:', error);
                        // Fallback to simple message
                        await interaction.editReply({
                            embeds: [{
                                color: client.config.colors.success,
                                title: '✅ Now Playing',
                                description: `**${selectedTrack.info.title}**\nby ${selectedTrack.info.author}`,
                                thumbnail: { url: selectedTrack.info.artworkUrl || selectedTrack.info.thumbnail || null }
                            }],
                            components: []
                        });
                    }
                } else {
                    // Track failed to load
                    console.error('[Search] Track failed to start after 2 seconds'.red);
                    await interaction.editReply({
                        embeds: [{
                            color: client.config.colors.warning,
                            title: '⚠️ Track Queued',
                            description: `**${selectedTrack.info.title}**\n\nTrack is loading, please wait...`,
                            thumbnail: { url: selectedTrack.info.artworkUrl || selectedTrack.info.thumbnail || null }
                        }],
                        components: []
                    });
                }
            } else {
                // Track added to queue, show queue position
                const formatDuration = (ms) => {
                    const seconds = Math.floor(ms / 1000);
                    const hours = Math.floor(seconds / 3600);
                    const mins = Math.floor((seconds % 3600) / 60);
                    const secs = seconds % 60;
                    
                    if (hours > 0) {
                        return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
                    }
                    return `${mins}:${secs.toString().padStart(2, '0')}`;
                };
                
                const duration = selectedTrack.info.isStream ? '🔴 LIVE' : formatDuration(selectedTrack.info.duration);
                
                await interaction.editReply({
                    embeds: [{
                        color: client.config.colors.success,
                        title: '✅ Added to Queue',
                        description: `**${selectedTrack.info.title}**`,
                        fields: [
                            { name: 'Artist', value: selectedTrack.info.author, inline: true },
                            { name: 'Duration', value: duration, inline: true },
                            { name: 'Source', value: platform, inline: true },
                            { name: 'Position in Queue', value: `#${player.queue.tracks.length}`, inline: true }
                        ],
                        thumbnail: { url: selectedTrack.info.artworkUrl || selectedTrack.info.thumbnail || null },
                        timestamp: new Date().toISOString()
                    }],
                    components: []
                });
            }
            
            // Clean up cache
            client.searchCache.delete(cacheKey);
            
        } catch (error) {
            console.error('Error adding track from search:'.red, error);
            
            await interaction.editReply({
                embeds: [{
                    color: client.config.colors.error,
                    description: `${client.config.emojis.error} Failed to add track to queue. Please try again.`
                }],
                components: []
            });
        }
    }
}
