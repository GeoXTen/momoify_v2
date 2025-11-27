import { EmbedBuilder } from 'discord.js';

export default {
    name: 'reload',
    description: 'Reload commands without restarting - v2.2.0 (Owner only)',
    ownerOnly: true,
    
    async execute(message, args, client) {
        const e = client.config.emojis;
        
        if (!args.length) {
            const embed = new EmbedBuilder()
                .setColor(client.config.colors.error)
                .setTitle(`${e.error} No Command Specified`)
                .setDescription(`${e.refresh} **Usage:** \`-reload <command>\` or \`-reload all\``)
                .addFields(
                    {
                        name: `${e.bulb} Examples`,
                        value: `• \`-reload play\` - Reload the play command\n• \`-reload all\` - Reload all commands`,
                        inline: false
                    },
                    {
                        name: `${e.info} Tip`,
                        value: 'This is useful for testing changes without restarting the bot',
                        inline: false
                    }
                )
                .setFooter({ text: 'v2.2.0 | Reload Command' })
                .setTimestamp();
            
            return message.reply({ embeds: [embed] });
        }
        
        const commandName = args[0].toLowerCase();
        const startTime = Date.now();
        
        try {
            if (commandName === 'all') {
                const statusMsg = await message.reply(`${e.loading} Reloading all commands...`);
                
                const oldCount = client.commands.size;
                client.commands.clear();
                
                const { readdir } = await import('fs/promises');
                const { join, dirname } = await import('path');
                const { fileURLToPath } = await import('url');
                
                const __dirname = dirname(fileURLToPath(import.meta.url));
                const commandsPath = join(__dirname, '..', 'commands');
                const commandFiles = (await readdir(commandsPath)).filter(file => file.endsWith('.js'));
                
                let successCount = 0;
                let failedCommands = [];
                
                for (const file of commandFiles) {
                    try {
                        const command = await import(`../commands/${file}?update=${Date.now()}`);
                        if (command.default?.data?.name) {
                            client.commands.set(command.default.data.name, command.default);
                            successCount++;
                        }
                    } catch (error) {
                        failedCommands.push(file);
                        console.error(`Failed to reload ${file}:`, error);
                    }
                }
                
                const reloadTime = Date.now() - startTime;
                
                const embed = new EmbedBuilder()
                    .setColor(client.config.colors.success)
                    .setTitle(`${e.checkmark} Reload Complete!`)
                    .addFields(
                        {
                            name: `${e.refresh} Results`,
                            value: `└─ Reloaded: **${successCount}** commands\n└─ Time: **${reloadTime}ms**\n└─ Total commands: **${client.commands.size}**`,
                            inline: false
                        }
                    );
                
                if (failedCommands.length > 0) {
                    embed.addFields({
                        name: `${e.error} Failed Commands (${failedCommands.length})`,
                        value: failedCommands.join(', ').substring(0, 1024),
                        inline: false
                    });
                }
                
                embed.setFooter({ text: 'v2.2.0 | Reload All' });
                embed.setTimestamp();
                
                await statusMsg.edit({ content: null, embeds: [embed] });
            } else {
                const command = client.commands.get(commandName);
                
                if (!command) {
                    const embed = new EmbedBuilder()
                        .setColor(client.config.colors.error)
                        .setTitle(`${e.error} Command Not Found`)
                        .setDescription(`${e.info} Command \`${commandName}\` doesn't exist.`)
                        .addFields({
                            name: `${e.bulb} Tip`,
                            value: `Use \`-reload all\` to see available commands.`,
                            inline: false
                        })
                        .setFooter({ text: 'v2.2.0 | Reload Command' })
                        .setTimestamp();
                    
                    return message.reply({ embeds: [embed] });
                }
                
                const statusMsg = await message.reply(`${e.loading} Reloading command \`${commandName}\`...`);
                
                // Find the file
                const { readdir } = await import('fs/promises');
                const { join, dirname } = await import('path');
                const { fileURLToPath } = await import('url');
                
                const __dirname = dirname(fileURLToPath(import.meta.url));
                const commandsPath = join(__dirname, '..', 'commands');
                const commandFiles = await readdir(commandsPath);
                
                const file = commandFiles.find(f => f.replace('.js', '') === commandName);
                
                if (!file) {
                    return statusMsg.edit(`${e.error} Command file not found!`);
                }
                
                const newCommand = await import(`../commands/${file}?update=${Date.now()}`);
                
                if (!newCommand.default?.data?.name) {
                    return statusMsg.edit(`${e.error} Invalid command file!`);
                }
                
                client.commands.set(commandName, newCommand.default);
                
                const reloadTime = Date.now() - startTime;
                
                const embed = new EmbedBuilder()
                    .setColor(client.config.colors.success)
                    .setTitle(`${e.checkmark} Reload Successful!`)
                    .addFields({
                        name: `${e.refresh} Command Details`,
                        value: `└─ Command: \`${commandName}\`\n└─ Time: **${reloadTime}ms**\n└─ Status: ${e.verified} Ready to use`,
                        inline: false
                    })
                    .setFooter({ text: 'v2.2.0 | Reload Command' })
                    .setTimestamp();
                
                await statusMsg.edit({ content: null, embeds: [embed] });
            }
        } catch (error) {
            console.error('Error in reload command:', error);
            
            const embed = new EmbedBuilder()
                .setColor(client.config.colors.error)
                .setTitle(`${e.error} Reload Failed!`)
                .setDescription(`${e.warning} Error: \`${error.message}\``)
                .addFields({
                    name: `${e.bulb} Note`,
                    value: 'Check console for detailed error logs.',
                    inline: false
                })
                .setFooter({ text: 'v2.2.0 | Reload Error' })
                .setTimestamp();
            
            await message.reply({ embeds: [embed] });
        }
    }
};
