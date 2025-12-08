import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { hasVoted, getVoteUrl, CACHE_3D } from '../utils/voteChecker.js';

const stayConnected = new Map();

export default {
    data: new SlashCommandBuilder()
        .setName('247')
        .setDescription('Toggle 24/7 mode (bot stays in voice channel)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    
    async execute(interaction, client) {
        const userId = interaction.user.id;
        const isOwner = userId === client.config.ownerId;
        
        // Check vote requirement (skip for owner)
        if (!isOwner) {
            const voted = await hasVoted(userId, client, CACHE_3D);
            
            if (!voted) {
                const voteUrl = getVoteUrl(client.config.clientId);
                const voteButton = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setLabel('Vote on Top.gg')
                        .setURL(voteUrl)
                        .setStyle(ButtonStyle.Link)
                        .setEmoji('🗳️')
                );
                
                return interaction.reply({
                    embeds: [{
                        color: client.config.colors.warning,
                        title: '🗳️ Vote Required',
                        description: `**24/7 Mode is a premium feature!**\n\n` +
                                   `To unlock 24/7 mode, please vote for **${client.config.botName}** on Top.gg.\n\n` +
                                   `✨ **Benefits of voting:**\n` +
                                   `• Unlock 24/7 mode for 3 days\n` +
                                   `• Keep the music going non-stop\n` +
                                   `• Support the bot's growth!\n\n` +
                                   `Click the button below to vote!`,
                        footer: { text: 'Votes unlock 24/7 for 3 days' }
                    }],
                    components: [voteButton],
                    flags: MessageFlags.Ephemeral
                });
            }
        }
        
        const member = interaction.guild.members.cache.get(interaction.user.id);
        const voiceChannel = member?.voice?.channel;
        
        if (!voiceChannel) {
            return interaction.reply({
                embeds: [{
                    color: client.config.colors.error,
                    description: `${client.config.emojis.error} You need to be in a voice channel!`
                }],
                flags: MessageFlags.Ephemeral
            });
        }
        
        const is247 = stayConnected.get(interaction.guildId) || false;
        
        if (is247) {
            stayConnected.delete(interaction.guildId);
            
            await interaction.reply({
                embeds: [{
                    color: client.config.colors.success,
                    description: `${client.config.emojis.success} 24/7 mode disabled. Bot will leave when queue ends.`
                }]
            });
        } else {
            stayConnected.set(interaction.guildId, true);
            
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
            }
            
            await interaction.reply({
                embeds: [{
                    color: client.config.colors.success,
                    description: `${client.config.emojis.success} 24/7 mode enabled. Bot will stay connected in <#${voiceChannel.id}>`
                }]
            });
        }
    }
};

export function is247Enabled(guildId) {
    return stayConnected.get(guildId) || false;
}
