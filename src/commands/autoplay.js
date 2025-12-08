import { SlashCommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { hasVoted, getVoteUrl } from '../utils/voteChecker.js';

// Store autoplay settings per guild
const autoplaySettings = new Map();

export function isAutoplayEnabled(guildId) {
    return autoplaySettings.get(guildId) || false;
}

export function setAutoplay(guildId, enabled) {
    if (enabled) {
        autoplaySettings.set(guildId, true);
    } else {
        autoplaySettings.delete(guildId);
    }
}

export default {
    data: new SlashCommandBuilder()
        .setName('autoplay')
        .setDescription('Toggle autoplay - automatically add related songs when queue ends'),
    
    async execute(interaction, client) {
        const userId = interaction.user.id;
        const isOwner = userId === client.config.ownerId;
        
        // Check vote requirement (skip for owner)
        if (!isOwner) {
            const voted = await hasVoted(userId, client);
            
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
                        description: `**Autoplay is a premium feature!**\n\n` +
                                   `To unlock autoplay, please vote for **${client.config.botName}** on Top.gg.\n\n` +
                                   `✨ **Benefits of voting:**\n` +
                                   `• Unlock autoplay for 12 hours\n` +
                                   `• Support the bot's growth\n` +
                                   `• Help others discover us!\n\n` +
                                   `Click the button below to vote!`,
                        footer: { text: 'Votes reset every 12 hours' }
                    }],
                    components: [voteButton],
                    flags: MessageFlags.Ephemeral
                });
            }
        }
        
        const player = client.lavalink.getPlayer(interaction.guildId);
        
        if (!player) {
            return interaction.reply({
                embeds: [{
                    color: client.config.colors.error,
                    description: `${client.config.emojis.error} **No active player!**\n\nUse \`/play\` to start playing music first.`
                }],
                flags: MessageFlags.Ephemeral
            });
        }
        
        const member = interaction.guild.members.cache.get(interaction.user.id);
        if (member.voice.channelId !== player.voiceChannelId) {
            return interaction.reply({
                embeds: [{
                    color: client.config.colors.error,
                    description: `${client.config.emojis.error} You need to be in the same voice channel as me!`
                }],
                flags: MessageFlags.Ephemeral
            });
        }
        
        const currentStatus = isAutoplayEnabled(interaction.guildId);
        const newStatus = !currentStatus;
        
        setAutoplay(interaction.guildId, newStatus);
        
        await interaction.reply({
            embeds: [{
                color: newStatus ? client.config.colors.success : client.config.colors.warning,
                title: newStatus ? '🔄 Autoplay Enabled' : '⏹️ Autoplay Disabled',
                description: newStatus 
                    ? `**Unlimited playlist activated!** 🎵\n\n` +
                      `✅ 10 related songs will be added automatically\n` +
                      `✅ Music will keep playing indefinitely\n` +
                      `✅ Based on your current queue\n\n` +
                      `Use \`/autoplay\` again to disable.`
                    : `**Autoplay disabled** ⏹️\n\n` +
                      `Music will stop when the queue ends.\n` +
                      `Use \`/autoplay\` to enable again.`,
                footer: { 
                    text: `Autoplay: ${newStatus ? 'ON' : 'OFF'} • Enjoy endless music!`,
                    iconURL: client.user.displayAvatarURL()
                }
            }]
        });
    }
};
