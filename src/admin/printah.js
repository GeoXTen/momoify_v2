import { REST, Routes, EmbedBuilder } from 'discord.js';
import { readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default {
    name: 'printah',
    description: 'Register slash commands - v2.2.5 (Owner only)',
    ownerOnly: true,
    
    async execute(message, args, client) {
        const e = client.config.emojis;
        const commands = [];
        const commandsPath = join(__dirname, '..', 'commands');
        
        try {
            const startTime = Date.now();
            const statusMsg = await message.reply(`${e.loading} Loading commands...`);
            
            const commandFiles = (await readdir(commandsPath)).filter(file => file.endsWith('.js'));
            
            let loadedCount = 0;
            let failedCommands = [];
            
            for (const file of commandFiles) {
                try {
                    const command = await import(`../commands/${file}?update=${Date.now()}`);
                    if (command.default?.data) {
                        commands.push(command.default.data.toJSON());
                        loadedCount++;
                    }
                } catch (error) {
                    failedCommands.push(file);
                    console.error(`Failed to load ${file}:`, error);
                }
            }
            
            await statusMsg.edit(`${e.loading} Loaded ${commands.length} commands. Registering...`);
            
            const rest = new REST({ version: '10' }).setToken(client.config.token);
            
            // Check if user wants guild or global
            const mode = args[0]?.toLowerCase();
            
            if (mode === 'guild' || mode === 'g') {
                const guildId = args[1] || message.guild?.id;
                
                if (!guildId) {
                    const embed = new EmbedBuilder()
                        .setColor(client.config.colors.error)
                        .setTitle(`${e.error} No Guild ID Provided`)
                        .setDescription(`${e.info} Please run this command in a server or provide a guild ID.`)
                        .addFields({
                            name: `${e.bulb} Usage`,
                            value: `\`-printah g\` or \`-printah guild <id>\``,
                            inline: false
                        })
                        .setFooter({ text: 'v2.2.5 | Command Registration' })
                        .setTimestamp();
                    
                    return await statusMsg.edit({ content: null, embeds: [embed] });
                }
                
                const data = await rest.put(
                    Routes.applicationGuildCommands(client.config.clientId, guildId),
                    { body: commands }
                );
                
                const registrationTime = Date.now() - startTime;
                
                const embed = new EmbedBuilder()
                    .setColor(client.config.colors.success)
                    .setTitle(`${e.checkmark} Command Registration Successful!`)
                    .setDescription(`${e.gear} **Mode:** Guild Registration`)
                    .addFields(
                        {
                            name: `${e.server} Guild Information`,
                            value: `└─ Guild ID: \`${guildId}\`\n└─ Commands: **${data.length}** registered\n└─ Update Speed: **Instant**\n└─ Time: **${registrationTime}ms**`,
                            inline: false
                        }
                    );
                
                if (failedCommands.length > 0) {
                    embed.addFields({
                        name: `${e.warning} Failed Commands (${failedCommands.length})`,
                        value: failedCommands.join(', ').substring(0, 1024),
                        inline: false
                    });
                }
                
                embed.addFields({
                    name: `${e.stars} v2.2.5 Features`,
                    value: `${e.lock} /lockcommands - Access control\n${e.rocket} Smart autoplay (no duplicates)\n${e.shield} Enhanced error handling`,
                    inline: false
                });
                
                embed.setFooter({ text: 'v2.2.5 | Guild Registration' });
                embed.setTimestamp();
                
                await statusMsg.edit({ content: null, embeds: [embed] });
            } else {
                const data = await rest.put(
                    Routes.applicationCommands(client.config.clientId),
                    { body: commands }
                );
                
                const registrationTime = Date.now() - startTime;
                
                const embed = new EmbedBuilder()
                    .setColor(client.config.colors.success)
                    .setTitle(`${e.checkmark} Global Command Registration Successful!`)
                    .setDescription(`${e.gear} **Mode:** Global Registration`)
                    .addFields(
                        {
                            name: `${e.verified} Registration Details`,
                            value: `└─ Commands: **${data.length}** registered\n└─ Registration Time: **${registrationTime}ms**\n└─ ${e.warning} Update Time: Up to 1 hour globally`,
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
                
                embed.addFields(
                    {
                        name: `${e.bulb} Pro Tip`,
                        value: `Use \`-printah g\` for instant updates in current server`,
                        inline: false
                    },
                    {
                        name: `${e.stars} v2.2.5 Features`,
                        value: `${e.lock} /lockcommands - Owner access control\n${e.rocket} Smart autoplay (no duplicates)\n${e.shield} Enhanced error handling & recovery`,
                        inline: false
                    }
                );
                
                embed.setFooter({ text: 'v2.2.5 | Global Registration' });
                embed.setTimestamp();
                
                await statusMsg.edit({ content: null, embeds: [embed] });
            }
            
        } catch (error) {
            console.error('Error in printah command:', error);
            
            const embed = new EmbedBuilder()
                .setColor(client.config.colors.error)
                .setTitle(`${e.error} Command Registration Failed!`)
                .setDescription(`${e.warning} **Error:**\n\`\`\`${error.message.substring(0, 1000)}\`\`\``)
                .addFields(
                    {
                        name: `${e.info} Usage`,
                        value: `${e.control} \`-printah\` - Register globally\n` +
                               `${e.control} \`-printah guild [id]\` - Register to specific guild\n` +
                               `${e.control} \`-printah g\` - Register to current guild (instant)`,
                        inline: false
                    },
                    {
                        name: `${e.bulb} Note`,
                        value: 'Check console for detailed error logs.',
                        inline: false
                    }
                )
                .setFooter({ text: 'v2.2.5 | Registration Error' })
                .setTimestamp();
            
            return message.reply({ embeds: [embed] });
        }
    }
};
