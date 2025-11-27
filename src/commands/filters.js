import { SlashCommandBuilder, MessageFlags } from 'discord.js';

const FILTERS = {
    bassboost: { equalizer: [
        { band: 0, gain: 0.2 }, { band: 1, gain: 0.15 }, { band: 2, gain: 0.1 },
        { band: 3, gain: 0.05 }, { band: 4, gain: 0.0 }, { band: 5, gain: -0.05 }
    ]},
    nightcore: { timescale: { speed: 1.2, pitch: 1.2, rate: 1 } },
    vaporwave: { timescale: { speed: 0.8, pitch: 0.8, rate: 1 } },
    '8d': { rotation: { rotationHz: 0.2 } },
    karaoke: { karaoke: { level: 1.0, monoLevel: 1.0, filterBand: 220.0, filterWidth: 100.0 } },
    vibrato: { vibrato: { frequency: 4.0, depth: 0.75 } },
    tremolo: { tremolo: { frequency: 4.0, depth: 0.75 } },
    clear: {}
};

export default {
    data: new SlashCommandBuilder()
        .setName('filters')
        .setDescription('Apply audio filters to the player')
        .addStringOption(option =>
            option.setName('filter')
                .setDescription('Filter to apply')
                .setRequired(true)
                .addChoices(
                    { name: 'Bass Boost', value: 'bassboost' },
                    { name: 'Nightcore', value: 'nightcore' },
                    { name: 'Vaporwave', value: 'vaporwave' },
                    { name: '8D Audio', value: '8d' },
                    { name: 'Karaoke', value: 'karaoke' },
                    { name: 'Vibrato', value: 'vibrato' },
                    { name: 'Tremolo', value: 'tremolo' },
                    { name: 'Clear All', value: 'clear' }
                )
        ),
    
    async execute(interaction, client) {
        const player = client.lavalink.getPlayer(interaction.guildId);
        
        if (!player || !player.queue.current) {
            return interaction.reply({
                embeds: [{
                    color: client.config.colors.error,
                    description: `${client.config.emojis.error} There's nothing playing right now!`
                }],
                flags: 64
            });
        }
        
        const member = interaction.guild.members.cache.get(interaction.user.id);
        if (member.voice.channelId !== player.voiceChannelId) {
            return interaction.reply({
                embeds: [{
                    color: client.config.colors.error,
                    description: `${client.config.emojis.error} You need to be in the same voice channel as me!`
                }],
                flags: 64
            });
        }
        
        // Defer reply for filter operation (needs time)
        await interaction.deferReply();
        
        const filter = interaction.options.getString('filter');
        const filterConfig = FILTERS[filter];
        
        console.log(`[Filters] Filter requested: "${filter}", Config found:`, filterConfig ? 'yes' : 'no');
        
        if (!filterConfig) {
            return interaction.editReply({
                embeds: [{
                    color: client.config.colors.error,
                    description: `${client.config.emojis.error} Invalid filter: **${filter}**\n\n` +
                                 '**Available filters:**\n' +
                                 '• `bassboost` - Bass Boost\n' +
                                 '• `nightcore` - Nightcore\n' +
                                 '• `vaporwave` - Vaporwave\n' +
                                 '• `8d` - 8D Audio\n' +
                                 '• `karaoke` - Karaoke\n' +
                                 '• `vibrato` - Vibrato\n' +
                                 '• `tremolo` - Tremolo\n' +
                                 '• `clear` - Clear All'
                }]
            });
        }
        
        if (filter === 'clear') {
            try {
                await player.filterManager.resetFilters();
                return interaction.editReply({
                    embeds: [{
                        color: client.config.colors.success,
                        description: `${client.config.emojis.success} Cleared all filters`
                    }]
                });
            } catch (error) {
                console.error('[Filters] Error clearing filters:', error.message);
                return interaction.editReply({
                    embeds: [{
                        color: client.config.colors.error,
                        description: `${client.config.emojis.error} Failed to clear filters: ${error.message}`
                    }]
                });
            }
        }
        
        // Apply the selected filter
        try {
            // Reset filters first
            await player.filterManager.resetFilters();
            console.log(`[Filters] Applying filter: ${filter}`);
            
            // Check if filterManager has required methods
            if (!player.filterManager) {
                throw new Error('Filter manager not available on this player');
            }
            
            if (filterConfig.equalizer) {
                console.log('[Filters] Applying equalizer:', filterConfig.equalizer);
                if (typeof player.filterManager.setEQ !== 'function') {
                    throw new Error('setEQ method not available');
                }
                await player.filterManager.setEQ(filterConfig.equalizer);
            }
            
            if (filterConfig.timescale) {
                console.log('[Filters] Applying timescale:', filterConfig.timescale);
                // Set timescale properties individually
                if (filterConfig.timescale.speed) {
                    if (typeof player.filterManager.setSpeed !== 'function') {
                        throw new Error('setSpeed method not available');
                    }
                    await player.filterManager.setSpeed(filterConfig.timescale.speed);
                }
                if (filterConfig.timescale.pitch) {
                    if (typeof player.filterManager.setPitch !== 'function') {
                        throw new Error('setPitch method not available');
                    }
                    await player.filterManager.setPitch(filterConfig.timescale.pitch);
                }
                if (filterConfig.timescale.rate) {
                    if (typeof player.filterManager.setRate !== 'function') {
                        throw new Error('setRate method not available');
                    }
                    await player.filterManager.setRate(filterConfig.timescale.rate);
                }
            }
            
            if (filterConfig.rotation) {
                console.log('[Filters] Applying rotation:', filterConfig.rotation);
                if (typeof player.filterManager.toggleRotation !== 'function') {
                    throw new Error('toggleRotation method not available');
                }
                await player.filterManager.toggleRotation(filterConfig.rotation.rotationHz);
            }
            
            if (filterConfig.karaoke) {
                console.log('[Filters] Applying karaoke');
                if (typeof player.filterManager.toggleKaraoke !== 'function') {
                    throw new Error('toggleKaraoke method not available');
                }
                await player.filterManager.toggleKaraoke();
            }
            
            if (filterConfig.vibrato) {
                console.log('[Filters] Applying vibrato:', filterConfig.vibrato);
                if (typeof player.filterManager.toggleVibrato !== 'function') {
                    throw new Error('toggleVibrato method not available');
                }
                await player.filterManager.toggleVibrato(filterConfig.vibrato.frequency, filterConfig.vibrato.depth);
            }
            
            if (filterConfig.tremolo) {
                console.log('[Filters] Applying tremolo:', filterConfig.tremolo);
                if (typeof player.filterManager.toggleTremolo !== 'function') {
                    throw new Error('toggleTremolo method not available');
                }
                await player.filterManager.toggleTremolo(filterConfig.tremolo.frequency, filterConfig.tremolo.depth);
            }
            
            console.log(`[Filters] Successfully applied ${filter} filter`);
        } catch (error) {
            console.error(`[Filters] Error applying ${filter}:`, error.message);
            console.error(`[Filters] Error stack:`, error.stack);
            return interaction.editReply({
                embeds: [{
                    color: client.config.colors.error,
                    description: `${client.config.emojis.error} Failed to apply filter: ${error.message}\n\n` +
                               `This may be due to Lavalink compatibility issues. Make sure your Lavalink server supports filters.`
                }]
            });
        }
        
        const filterName = filter.charAt(0).toUpperCase() + filter.slice(1);
        
        await interaction.editReply({
            embeds: [{
                color: client.config.colors.success,
                description: `🎛️ Applied **${filterName}** filter`
            }]
        });
    }
};
