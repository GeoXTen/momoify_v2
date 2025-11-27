import { EmbedBuilder } from 'discord.js';

export default {
    name: 'uploademojis',
    description: 'Upload custom emojis from URLs to the current server (Owner only)',
    ownerOnly: true,
    
    async execute(message, args, client) {
        try {
            // Check if bot has MANAGE_EMOJIS_AND_STICKERS permission
            const permissions = message.guild.members.me.permissions;
            if (!permissions.has('ManageGuildExpressions')) {
                return message.reply('❌ I need `Manage Expressions` permission to upload emojis!');
            }

            // Emoji list with direct Discord CDN URLs (from emoji.txt)
            const emojisToUpload = [
                // Music Player Controls - UPDATED IDs from emoji.txt
                { name: 'play', url: 'https://cdn.discordapp.com/emojis/1439784311086645309.png' },
                { name: 'pause', url: 'https://cdn.discordapp.com/emojis/1439780149385232465.png' },
                { name: 'loop', url: 'https://cdn.discordapp.com/emojis/1439803192824303669.png' },
                { name: 'player', url: 'https://cdn.discordapp.com/emojis/1439063416185688239.png' },
                { name: 'seek', url: 'https://cdn.discordapp.com/emojis/1439063423823384588.png' },
                { name: 'previous', url: 'https://cdn.discordapp.com/emojis/1439785185628524727.png' },
                { name: 'skip', url: 'https://cdn.discordapp.com/emojis/1439785191492157492.png' },
                { name: 'stop', url: 'https://cdn.discordapp.com/emojis/1439785197712179260.png' },
                { name: 'shuffle', url: 'https://cdn.discordapp.com/emojis/1439780008465010870.png' }, // animated
                { name: 'refresh', url: 'https://cdn.discordapp.com/emojis/1439785212467875841.png' },
                
                // Audio & Volume
                { name: 'volume', url: 'https://cdn.discordapp.com/emojis/1439063432413315182.png' },
                { name: 'headphone', url: 'https://cdn.discordapp.com/emojis/1439063440936145027.png' },
                { name: 'visualizer', url: 'https://cdn.discordapp.com/emojis/1439830990905278525.gif' },
                
                // Queue & Status
                { name: 'queue', url: 'https://cdn.discordapp.com/emojis/1439044159305416704.png' }, // Updated from line 125
                { name: 'cloudnote', url: 'https://cdn.discordapp.com/emojis/1439063457105186876.png' },
                { name: 'disk', url: 'https://cdn.discordapp.com/emojis/1439063465301114950.png' },
                
                // Progress Bar Elements - UPDATED IDs from emoji.txt
                { name: 'startingfillbar', url: 'https://cdn.discordapp.com/emojis/1439785219518500894.png' },
                { name: 'middlefillbar', url: 'https://cdn.discordapp.com/emojis/1439785226317336878.png' },
                { name: 'middledotfillbar', url: 'https://cdn.discordapp.com/emojis/1439808212533510174.png' },
                { name: 'emptymiddlebar', url: 'https://cdn.discordapp.com/emojis/1439785239848157307.png' },
                { name: 'emptyendbar', url: 'https://cdn.discordapp.com/emojis/1439785246622220379.png' },
                
                // Music Icons & Notes
                { name: 'melody', url: 'https://cdn.discordapp.com/emojis/1439063473916084295.png' },
                { name: 'note1', url: 'https://cdn.discordapp.com/emojis/1439063482031935598.png' },
                { name: 'note2', url: 'https://cdn.discordapp.com/emojis/1439063490345042081.png' },
                { name: 'note3', url: 'https://cdn.discordapp.com/emojis/1439063498494709871.png' },
                { name: 'note4', url: 'https://cdn.discordapp.com/emojis/1439063506552094800.png' },
                { name: 'stars', url: 'https://cdn.discordapp.com/emojis/1439063514890371183.png' },
                
                // Status & Verification
                { name: 'checkmark', url: 'https://cdn.discordapp.com/emojis/1439063523039908002.png' },
                { name: 'verified', url: 'https://cdn.discordapp.com/emojis/1439063531206217768.png' },
                { name: 'time', url: 'https://cdn.discordapp.com/emojis/1439063539636768893.png' },
                
                // Music Platform Sources
                { name: 'youtube', url: 'https://cdn.discordapp.com/emojis/1439063548872626380.png' },
                { name: 'spotify', url: 'https://cdn.discordapp.com/emojis/1439063557084938351.png' },
                { name: 'soundcloud', url: 'https://cdn.discordapp.com/emojis/1439063565314035824.png' },
                { name: 'applemusic', url: 'https://cdn.discordapp.com/emojis/1439063573656768653.png' },
                { name: 'deezer', url: 'https://cdn.discordapp.com/emojis/1439063582036987964.png' },
                
                // Control & Source Icons
                { name: 'control', url: 'https://cdn.discordapp.com/emojis/1439090516825477120.png' },
                { name: 'source', url: 'https://cdn.discordapp.com/emojis/1439090541634523146.png' }
            ];

            const statusMsg = await message.reply(`🔄 Starting emoji upload... (${emojisToUpload.length} emojis)`);
            
            const results = {
                success: [],
                failed: [],
                skipped: []
            };

            for (const emojiData of emojisToUpload) {
                try {
                    // Check if emoji already exists
                    const existingEmoji = message.guild.emojis.cache.find(e => e.name === emojiData.name);
                    if (existingEmoji) {
                        results.skipped.push(`${emojiData.name} (already exists)`);
                        continue;
                    }

                    // Upload emoji
                    const emoji = await message.guild.emojis.create({
                        attachment: emojiData.url,
                        name: emojiData.name
                    });
                    
                    results.success.push(`<:${emoji.name}:${emoji.id}> ${emojiData.name}`);
                    
                    // Small delay to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (error) {
                    results.failed.push(`${emojiData.name}: ${error.message}`);
                }
            }

            // Build result embed
            const embed = new EmbedBuilder()
                .setTitle('📤 Emoji Upload Results')
                .setColor(results.failed.length > 0 ? 0xFFA500 : 0x00FF00)
                .setTimestamp();

            if (results.success.length > 0) {
                embed.addFields({
                    name: `✅ Successfully Uploaded (${results.success.length})`,
                    value: results.success.join('\n').slice(0, 1024),
                    inline: false
                });
            }

            if (results.skipped.length > 0) {
                embed.addFields({
                    name: `⏭️ Skipped (${results.skipped.length})`,
                    value: results.skipped.join('\n').slice(0, 1024),
                    inline: false
                });
            }

            if (results.failed.length > 0) {
                embed.addFields({
                    name: `❌ Failed (${results.failed.length})`,
                    value: results.failed.join('\n').slice(0, 1024),
                    inline: false
                });
            }

            await statusMsg.edit({ content: null, embeds: [embed] });

            // If successful, suggest running listemojis
            if (results.success.length > 0) {
                await message.channel.send('✅ Done! Run `-listemojis` to see all available emojis and update your config.');
            }

        } catch (error) {
            console.error('Error in uploademojis command:', error);
            return message.reply(`❌ Error: ${error.message}`);
        }
    }
};
