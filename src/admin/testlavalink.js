import { EmbedBuilder } from 'discord.js';

export default {
    name: 'testlavalink',
    description: 'Test Lavalink server latency (Owner only)',
    ownerOnly: true,
    
    async execute(message, args, client) {
        const e = client.config.emojis;
        
        const statusMsg = await message.reply(`${e.loading} **Testing Lavalink Servers...**\n\n${e.info} This may take a moment...`);
        
        // Server configs to test
        const servers = [
            {
                name: 'Current Server (US)',
                host: 'lava-v4.ajieblogs.eu.org',
                port: 443,
                password: 'https://dsc.gg/ajidevserver',
                secure: true
            },
            {
                name: 'Alternative 1 (US)',
                host: 'lavalinkv4.serenetia.com',
                port: 443,
                password: 'https://dsc.gg/ajidevserver',
                secure: true
            },
            {
                name: 'Singapore Server',
                host: 'pool-sg.alfari.id',
                port: 443,
                password: 'alfari',
                secure: true
            },
            {
                name: 'Trinium v3',
                host: 'lavalink-v3.triniumhost.com',
                port: 443,
                password: 'free',
                secure: true
            },
            {
                name: 'Trinium v4',
                host: 'lavalink-v4.triniumhost.com',
                port: 443,
                password: 'free',
                secure: true
            },
            {
                name: 'Jirayu Server',
                host: 'lavalink.jirayu.net',
                port: 443,
                password: 'youshallnotpass',
                secure: true
            },
            {
                name: 'Hanahira Server',
                host: 'lava.hanahira.dev',
                port: 4546,
                password: 'hinakochan',
                secure: false
            },
            {
                name: 'DCTV Singapore',
                host: 's13.oddblox.us',
                port: 28405,
                password: 'quangloc2018',
                secure: false
            },
            {
                name: 'Linux Server (SSL)',
                host: '104.223.57.116',
                port: 443,
                password: 'youshallnotpass',
                secure: true
            },
            {
                name: 'Linux Server (Non-SSL)',
                host: '104.223.57.116',
                port: 2333,
                password: 'youshallnotpass',
                secure: false
            }
        ];
        
        const embed = new EmbedBuilder()
            .setColor(client.config.colors.primary)
            .setTitle(`${e.rocket} Lavalink Server Test Results`)
            .setDescription('Testing server connections and performance...')
            .setFooter({ text: 'v2.2.5 | Server Test' })
            .setTimestamp();
        
        let testResults = [];
        let serverFields = [];
        
        for (const server of servers) {
            let serverInfo = `${e.control} Host: \`${server.host}:${server.port}\`\n`;
            
            const startTime = Date.now();
            
            try {
                // Test connection by pinging the server
                const protocol = server.secure ? 'https' : 'http';
                const url = `${protocol}://${server.host}:${server.port}/version`;
                
                const fetchStart = Date.now();
                const response_data = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Authorization': server.password
                    },
                    signal: AbortSignal.timeout(5000) // 5 second timeout
                });
                
                const latency = Date.now() - fetchStart;
                
                if (response_data.ok) {
                    const data = await response_data.text();
                    const version = data || 'Unknown';
                    
                    testResults.push({ name: server.name, latency, status: 'online' });
                    
                    serverInfo += `└─ ${e.checkmark} Status: **Online**\n`;
                    serverInfo += `└─ ${e.time} Latency: **${latency}ms**\n`;
                    serverInfo += `└─ ${e.database} Version: ${version}\n`;
                    
                    // Performance rating
                    if (latency < 200) {
                        serverInfo += `└─ ${e.rocket} Rating: **Excellent!**`;
                    } else if (latency < 500) {
                        serverInfo += `└─ ${e.online} Rating: **Good**`;
                    } else if (latency < 1000) {
                        serverInfo += `└─ ${e.warning} Rating: **Acceptable**`;
                    } else {
                        serverInfo += `└─ ${e.dnd} Rating: **Slow**`;
                    }
                } else {
                    testResults.push({ name: server.name, latency, status: 'error' });
                    serverInfo += `└─ ${e.error} Status: **Error** (${response_data.status})\n`;
                    serverInfo += `└─ ${e.time} Response Time: ${latency}ms`;
                }
            } catch (error) {
                const latency = Date.now() - startTime;
                testResults.push({ name: server.name, latency, status: 'failed' });
                serverInfo += `└─ ${e.error} Status: **Failed**\n`;
                serverInfo += `└─ ${e.time} Timeout: ${latency}ms\n`;
                serverInfo += `└─ ${e.warning} Error: ${error.message}`;
            }
            
            // Add server as field (truncate if too long for embed)
            serverFields.push({
                name: `${e.server} ${server.name}`,
                value: serverInfo.substring(0, 1024),
                inline: false
            });
        }
        
        // Add all server fields to embed (split if necessary)
        const maxFieldsPerEmbed = 25;
        if (serverFields.length <= maxFieldsPerEmbed) {
            embed.addFields(...serverFields);
        } else {
            // Add first batch
            embed.addFields(...serverFields.slice(0, maxFieldsPerEmbed));
        }
        
        // Find best server
        const onlineServers = testResults.filter(r => r.status === 'online').sort((a, b) => a.latency - b.latency);
        
        let recommendation = '';
        if (onlineServers.length > 0) {
            const best = onlineServers[0];
            recommendation = `${e.rocket} **Best Server:** ${best.name} (${best.latency}ms)\n`;
            if (onlineServers.length > 1) {
                const second = onlineServers[1];
                recommendation += `${e.online} **Alternative:** ${second.name} (${second.latency}ms)`;
            }
        } else {
            recommendation = `${e.error} No servers are currently online.`;
        }
        
        embed.addFields(
            {
                name: `${e.bulb} Recommendation`,
                value: recommendation,
                inline: false
            },
            {
                name: `${e.gear} To Switch Servers`,
                value: `${e.control} 1. Edit \`.env\` file\n` +
                       `${e.control} 2. Update \`LAVALINK_HOST\`, \`LAVALINK_PORT\`, \`LAVALINK_PASSWORD\`\n` +
                       `${e.control} 3. Restart bot: \`pm2 restart geomsc\``,
                inline: false
            },
            {
                name: `${e.info} Current Server`,
                value: `\`${client.config.lavalink.host}:${client.config.lavalink.port}\``,
                inline: false
            }
        );
        
        await statusMsg.edit({ content: null, embeds: [embed] });
        
        // If there are more servers, send additional embeds
        if (serverFields.length > maxFieldsPerEmbed) {
            const remainingFields = serverFields.slice(maxFieldsPerEmbed);
            const additionalEmbed = new EmbedBuilder()
                .setColor(client.config.colors.primary)
                .setTitle(`${e.rocket} Lavalink Server Test Results (continued)`)
                .addFields(...remainingFields.slice(0, maxFieldsPerEmbed))
                .setFooter({ text: 'v2.2.5 | Server Test' })
                .setTimestamp();
            
            await message.channel.send({ embeds: [additionalEmbed] });
        }
    }
};
