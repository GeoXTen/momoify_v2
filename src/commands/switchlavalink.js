import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import servers from test-lavalink.js
const SERVERS = [
    {
        name: "lava-all (EU)",
        host: "lava-all.ajieblogs.eu.org",
        port: 443,
        password: "https://dsc.gg/ajidevserver",
        secure: true
    },
    {
        name: "lavalink.serenetiaNonSSL (US East)",
        host: "lavalink.sereneti.com",
        port: 80,
        password: "MjczMTQzNDc0MTY4NzI3NTU0.TkqLXZ.L2gsp0cP-ZbGhHqbCXvlEDO-cFA",
        secure: false
    },
    {
        name: "lava-v4 (EU)",
        host: "lava-v4.ajieblogs.eu.org",
        port: 443,
        password: "https://dsc.gg/ajidevserver",
        secure: true
    },
    {
        name: "lavalinkv4 (US East)",
        host: "v4.lavalink.rocks",
        port: 443,
        password: "horizxon.tech",
        secure: true
    },
    {
        name: "lavallNonSSL (EU)",
        host: "lava-all.ajieblogs.eu.org",
        port: 80,
        password: "https://dsc.gg/ajidevserver",
        secure: false
    },
    {
        name: "lavalink.serenetia (US East)",
        host: "lavalink.sereneti.com",
        port: 443,
        password: "MjczMTQzNDc0MTY4NzI3NTU0.TkqLXZ.L2gsp0cP-ZbGhHqbCXvlEDO-cFA",
        secure: true
    },
    {
        name: "lava.link",
        host: "lava.link",
        port: 80,
        password: "youshallnotpass",
        secure: false
    },
    {
        name: "lavalinkv3 (US East)",
        host: "v3.lavalink.rocks",
        port: 443,
        password: "horizxon.tech",
        secure: true
    },
    {
        name: "lavalinkinc.com",
        host: "lavalink.jirayu.net",
        port: 13592,
        password: "youshallnotpass",
        secure: false
    },
    {
        name: "DCTV Singapore",
        host: "140.245.120.106",
        port: 25230,
        password: "youshallnotpass",
        secure: false
    },
    {
        name: "Horizxon lavalinkv3",
        host: "lava-v3.horizxon.tech",
        port: 443,
        password: "horizxon.tech",
        secure: true
    },
    {
        name: "music.angelocore.fr",
        host: "music.angelocore.fr",
        port: 2333,
        password: "youshallnotpass",
        secure: false
    },
    {
        name: "lava.horizxon.tech",
        host: "lava.horizxon.tech",
        port: 443,
        password: "horizxon.tech",
        secure: true
    },
    {
        name: "Southctrl",
        host: "audio.chippy.info",
        port: 24597,
        password: "youshallnotpass",
        secure: false
    },
    {
        name: "lava-v3",
        host: "lava-v3.ajieblogs.eu.org",
        port: 443,
        password: "https://dsc.gg/ajidevserver",
        secure: true
    },
    {
        name: "Linux Server (SSL)",
        host: "104.223.57.116",
        port: 443,
        password: "youshallnotpass",
        secure: true
    },
    {
        name: "Linux Server (Non-SSL)",
        host: "104.223.57.116",
        port: 2333,
        password: "youshallnotpass",
        secure: false
    }
];

export default {
    data: new SlashCommandBuilder()
        .setName('switchlavalink')
        .setDescription('Switch to a different Lavalink server (Owner only)'),
    
    async execute(interaction, client) {
        // Only support slash commands - reject text commands
        if (!interaction.isChatInputCommand?.()) {
            return; // Silently ignore text commands
        }
        
        const e = client.config.emojis;
        
        // Check if user is bot owner
        if (interaction.user.id !== client.config.ownerId) {
            return interaction.reply({
                embeds: [{
                    color: client.config.colors.error,
                    title: `${e.error} Access Denied`,
                    description: `${e.lock} This command is only available to the bot owner.`,
                    footer: { text: 'Owner-only command' }
                }],
                ephemeral: true
            });
        }
        
        // Defer reply
        await interaction.deferReply();
        
        const initialEmbed = {
            color: client.config.colors.primary,
            title: `${e.loading} Testing Lavalink Servers...`,
            description: `${e.server} Testing ${SERVERS.length} servers...\n${e.time} This may take a moment...`,
            footer: { text: 'v2.2.5 | Switch Lavalink' },
            timestamp: new Date()
        };
        
        await interaction.editReply({ embeds: [initialEmbed] });
        
        // Test all servers
        const testResults = [];
        
        for (const server of SERVERS) {
            try {
                const startTime = Date.now();
                const url = `http${server.secure ? 's' : ''}://${server.host}:${server.port}/version`;
                
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Authorization': server.password
                    },
                    timeout: 5000
                });
                
                const latency = Date.now() - startTime;
                
                if (response.ok) {
                    testResults.push({
                        name: server.name,
                        host: server.host,
                        port: server.port,
                        password: server.password,
                        secure: server.secure,
                        latency: latency,
                        status: 'online'
                    });
                }
            } catch (error) {
                // Server failed or timed out, skip it
                continue;
            }
        }
        
        // Sort by latency and get top 5
        const topServers = testResults
            .filter(s => s.status === 'online')
            .sort((a, b) => a.latency - b.latency)
            .slice(0, 5);
        
        if (topServers.length === 0) {
            const errorEmbed = {
                color: client.config.colors.error,
                title: `${e.error} No Servers Available`,
                description: `${e.warning} No Lavalink servers are currently online.\n\n` +
                           `${e.info} Please try again later or check your network connection.`,
                footer: { text: 'v2.2.5 | Switch Lavalink' },
                timestamp: new Date()
            };
            
            return await interaction.editReply({ embeds: [errorEmbed] });
        }
        
        // Get current server info
        const currentServer = `${client.config.lavalink.host}:${client.config.lavalink.port}`;
        
        // Create embed showing top 5 servers
        const embed = new EmbedBuilder()
            .setColor(client.config.colors.primary)
            .setTitle(`${e.rocket} Top 5 Fastest Lavalink Servers`)
            .setDescription(`${e.checkmark} Found **${topServers.length}** working servers\n\n` +
                          `${e.info} **Current Server:** \`${currentServer}\`\n\n` +
                          `${e.bulb} Select a server from the dropdown menu below to switch:`)
            .setFooter({ text: 'v2.2.5 | Switch Lavalink' })
            .setTimestamp();
        
        // Add fields for each server
        topServers.forEach((server, index) => {
            const isCurrent = server.host === client.config.lavalink.host && 
                            server.port === client.config.lavalink.port;
            
            const quality = server.latency < 100 ? `${e.online} Excellent` :
                          server.latency < 200 ? `${e.online} Good` :
                          server.latency < 300 ? `${e.warning} Fair` :
                          `${e.warning} Acceptable`;
            
            embed.addFields({
                name: `${index + 1}. ${server.name}${isCurrent ? ' (Current)' : ''}`,
                value: `${e.server} Host: \`${server.host}:${server.port}\`\n` +
                      `${e.time} Latency: **${server.latency}ms** (${quality})\n` +
                      `${e.shield} Secure: ${server.secure ? `${e.checkmark} Yes` : `${e.error} No`}`,
                inline: false
            });
        });
        
        // Create select menu
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('switch_lavalink_select')
            .setPlaceholder('Choose a server to switch to...')
            .addOptions(
                topServers.map((server, index) => ({
                    label: server.name,
                    description: `${server.latency}ms - ${server.host}:${server.port}`,
                    value: `${index}`,
                    emoji: index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🎵'
                }))
            );
        
        const row = new ActionRowBuilder().addComponents(selectMenu);
        
        // Store server data temporarily in client
        if (!client.tempData) client.tempData = new Map();
        client.tempData.set(`switch_lavalink_${interaction.user.id}`, topServers);
        
        await interaction.editReply({
            embeds: [embed],
            components: [row]
        });
    }
};
