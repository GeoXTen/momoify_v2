import { SlashCommandBuilder } from 'discord.js';
import { createNowPlayingEmbed, createNowPlayingButtons } from '../utils/nowPlayingUtils.js';
import { validatePlayerCommand, createSuccessEmbed } from '../utils/commandHelpers.js';

export default {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Skip the current song')
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Number of songs to skip')
                .setMinValue(1)
        ),
    
    async execute(interaction, client) {
        // Validate player and user permissions
        const { player, error } = validatePlayerCommand(interaction, client);
        if (error) {
            return interaction.reply({ embeds: [error], flags: 64 });
        }
        
        // Check if there's a current track
        if (!player.queue.current) {
            return interaction.reply({
                embeds: [{
                    color: client.config.colors.error,
                    description: `${client.config.emojis.error} There's nothing playing right now!`
                }],
                flags: 64
            });
        }
        
        // Defer reply for skip operation (needs time)
        await interaction.deferReply();
        
        const amount = interaction.options.getInteger('amount') || 1;
        const current = player.queue.current;
        
        console.log('[Skip] Before skip:'.yellow);
        console.log(`  Current track: ${current.info.title}`.yellow);
        console.log(`  Queue size: ${player.queue.tracks.length}`.yellow);
        console.log(`  Queue tracks:`, player.queue.tracks.map(t => t.info.title));
        console.log(`  Amount to skip: ${amount}`.yellow);
        
        if (amount > 1 && player.queue.tracks.length >= amount - 1) {
            player.queue.tracks.splice(0, amount - 1);
            await player.skip();
            
            // Wait a bit for the new track to start
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Show the new now playing track
            if (player.queue.current) {
                const nowPlayingEmbed = createNowPlayingEmbed(player, client);
                const nowPlayingButtons = createNowPlayingButtons(player, client);
                
                return interaction.editReply({
                    content: `${client.config.emojis.skip} Skipped ${amount} songs!`,
                    embeds: [nowPlayingEmbed],
                    components: nowPlayingButtons
                });
            } else {
                return interaction.editReply({
                    embeds: [{
                        color: client.config.colors.success,
                        description: `${client.config.emojis.skip} Skipped ${amount} songs!\n\nQueue is now empty.`
                    }]
                });
            }
        }
        
        // Check if there are more tracks to skip to
        if (player.queue.tracks.length === 0) {
            // Check if autoplay is enabled
            const { isAutoplayEnabled } = await import('./autoplay.js');
            const autoplayEnabled = isAutoplayEnabled(player.guildId);
            
            if (autoplayEnabled) {
                // If autoplay is ON, just skip - it will trigger queueEnd and autoplay will add more songs
                await player.skip();
                
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                return interaction.editReply({
                    embeds: [{
                        color: client.config.colors.success,
                        description: `${client.config.emojis.skip} Skipped **[${current.info.title}](${current.info.uri})**\n\n🔄 Autoplay is searching for related tracks...`
                    }]
                });
            } else {
                // If autoplay is OFF, destroy the player
                await player.destroy();
                return interaction.editReply({
                    embeds: [{
                        color: client.config.colors.success,
                        description: `${client.config.emojis.skip} Skipped **[${current.info.title}](${current.info.uri})**\n\nQueue is now empty. Player stopped.`
                    }]
                });
            }
        }
        
        await player.skip();
        
        console.log('[Skip] After skip() call:'.magenta);
        console.log(`  New current track: ${player.queue.current?.info.title || 'NONE'}`.magenta);
        console.log(`  Queue size: ${player.queue.tracks.length}`.magenta);
        console.log(`  Player playing: ${player.playing}`.magenta);
        console.log(`  Player paused: ${player.paused}`.magenta);
        
        // Wait a bit for the new track to start
        await new Promise(resolve => setTimeout(resolve, 500));
        
        console.log('[Skip] After 500ms wait:'.magenta);
        console.log(`  Current track: ${player.queue.current?.info.title || 'NONE'}`.magenta);
        console.log(`  Queue size: ${player.queue.tracks.length}`.magenta);
        console.log(`  Player playing: ${player.playing}`.magenta);
        
        // Show the new now playing track
        if (player.queue.current) {
            const nowPlayingEmbed = createNowPlayingEmbed(player, client);
            const nowPlayingButtons = createNowPlayingButtons(player, client);
            
            await interaction.editReply({
                content: `${client.config.emojis.skip} Skipped **${current.info.title}**`,
                embeds: [nowPlayingEmbed],
                components: nowPlayingButtons
            });
        } else {
            await interaction.editReply({
                embeds: [{
                    color: client.config.colors.success,
                    description: `${client.config.emojis.skip} Skipped **[${current.info.title}](${current.info.uri})**\n\nQueue is now empty.`
                }]
            });
        }
    }
};
