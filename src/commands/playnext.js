import { SlashCommandBuilder } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('playnext')
        .setDescription('Add a song to play next (first in queue)')
        .addStringOption(option =>
            option.setName('song')
                .setDescription('Song name, URL, or playlist URL')
                .setRequired(true)
                .setAutocomplete(true)
        ),
    
    async execute(interaction, client) {
        await interaction.deferReply();
        
        const query = interaction.options.getString('song');
        
        if (!query || query.trim().length === 0) {
            return interaction.editReply({
                embeds: [{
                    color: client.config.colors.error,
                    description: `${client.config.emojis.error} Please provide a song name or URL!`
                }]
            });
        }
        
        const member = interaction.guild.members.cache.get(interaction.user.id);
        const voiceChannel = member?.voice?.channel;
        
        if (!voiceChannel) {
            return interaction.editReply({
                embeds: [{
                    color: client.config.colors.error,
                    description: `${client.config.emojis.error} You need to be in a voice channel!`
                }]
            });
        }
        
        let player = client.lavalink.getPlayer(interaction.guildId);
        
        if (!player) {
            player = client.lavalink.createPlayer({
                guildId: interaction.guildId,
                voiceChannelId: voiceChannel.id,
                textChannelId: interaction.channelId,
                selfDeaf: true,
                selfMute: false,
                volume: 75
            });
            
            await player.connect();
        } else if (player.voiceChannelId !== voiceChannel.id) {
            return interaction.editReply({
                embeds: [{
                    color: client.config.colors.error,
                    description: `${client.config.emojis.error} I'm already playing in <#${player.voiceChannelId}>!`
                }]
            });
        }
        
        const node = client.lavalink.nodeManager.leastUsedNodes()[0];
        if (!node) {
            return interaction.editReply({
                embeds: [{
                    color: client.config.colors.error,
                    description: `${client.config.emojis.error} No Lavalink nodes available!`
                }]
            });
        }
        
        const res = await node.search({ 
            query: query,
            source: "ytmsearch"
        }, interaction.user);
        
        if (!res?.tracks?.length) {
            return interaction.editReply({
                embeds: [{
                    color: client.config.colors.error,
                    description: `${client.config.emojis.error} No results found for **${query}**`
                }]
            });
        }
        
        if (res.loadType === 'playlist') {
            // Add all playlist tracks to position 0
            for (let i = res.tracks.length - 1; i >= 0; i--) {
                await player.queue.add(res.tracks[i], 0);
            }
            
            await interaction.editReply({
                embeds: [{
                    color: client.config.colors.success,
                    description: `${client.config.emojis.success} Added **${res.tracks.length}** tracks from **${res.playlist?.name}** to play next!`,
                    thumbnail: { url: res.tracks[0]?.info?.artworkUrl }
                }]
            });
            
            if (!player.playing) {
                // Store the text channel for trackStart event to use
                player.set('currentTextChannel', interaction.channel);
                await player.play();
            }
        } else {
            const track = res.tracks[0];
            
            // Add to position 0 (play next)
            await player.queue.add(track, 0);
            
            await interaction.editReply({
                embeds: [{
                    color: client.config.colors.success,
                    description: `${client.config.emojis.success} **[${track.info.title}](${track.info.uri})** will play next!`,
                    thumbnail: { url: track.info.artworkUrl }
                }]
            });
            
            if (!player.playing) {
                // Store the text channel for trackStart event to use
                player.set('currentTextChannel', interaction.channel);
                await player.play();
            }
        }
    },

    async autocomplete(interaction, client) {
        try {
            const focusedValue = interaction.options.getFocused();
            
            if (!focusedValue || focusedValue.trim().length < 2) {
                return interaction.respond([]);
            }
            
            if (focusedValue.startsWith('http://') || focusedValue.startsWith('https://')) {
                return interaction.respond([
                    { name: 'Play from URL: ' + focusedValue.substring(0, 80), value: focusedValue }
                ]);
            }
            
            const node = client.lavalink.nodeManager.leastUsedNodes()[0];
            if (!node) {
                return interaction.respond([]);
            }
            
            const searchPromise = node.search({ 
                query: focusedValue,
                source: "ytmsearch"
            }, interaction.user);
            
            const timeoutPromise = new Promise((resolve) => 
                setTimeout(() => resolve(null), 2500)
            );
            
            const res = await Promise.race([searchPromise, timeoutPromise]);
            
            if (!res?.tracks?.length) {
                return interaction.respond([]);
            }
            
            const choices = res.tracks.slice(0, 10).map(track => ({
                name: `${track.info.title} - ${track.info.author}`.substring(0, 100),
                value: track.info.uri
            }));
            
            await interaction.respond(choices);
        } catch (error) {
            try {
                await interaction.respond([]);
            } catch {}
        }
    }
};
