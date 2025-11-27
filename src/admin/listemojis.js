import { EmbedBuilder } from 'discord.js';

export default {
    name: 'listemojis',
    description: 'List all custom emojis available to the bot (Owner only)',
    ownerOnly: true,
    
    async execute(message, args, client) {
        try {
            const emojis = new Map();
            
            // Collect all custom emojis from all guilds
            client.guilds.cache.forEach(guild => {
                guild.emojis.cache.forEach(emoji => {
                    const emojiFormat = emoji.animated ? `<a:${emoji.name}:${emoji.id}>` : `<:${emoji.name}:${emoji.id}>`;
                    emojis.set(emoji.name, {
                        id: emoji.id,
                        name: emoji.name,
                        format: emojiFormat,
                        animated: emoji.animated,
                        guild: guild.name
                    });
                });
            });

            if (emojis.size === 0) {
                const embed = new EmbedBuilder()
                    .setTitle('❌ No Custom Emojis Found')
                    .setDescription('No custom emojis found! Make sure:\n' +
                        '1. Bot is in a server with custom emojis\n' +
                        '2. Emojis are uploaded to that server')
                    .setColor(client.config.colors.error);
                
                return message.reply({ embeds: [embed] });
            }

            // Create embed with emoji list (split into multiple embeds if needed)
            const emojiArray = Array.from(emojis.values());
            const embedsToSend = [];
            let currentEmbed = new EmbedBuilder()
                .setTitle('🎨 Custom Emojis Available')
                .setDescription(`Found **${emojis.size}** custom emojis`)
                .setColor(client.config.colors.primary);
            
            let currentField = '';
            let fieldCount = 0;
            let embedCharCount = 0;
            
            // Calculate initial embed size
            const titleLength = currentEmbed.data.title?.length || 0;
            const descLength = currentEmbed.data.description?.length || 0;
            embedCharCount = titleLength + descLength;
            
            for (let i = 0; i < emojiArray.length; i++) {
                const emoji = emojiArray[i];
                const line = `${emoji.format} \`${emoji.name}\`\n`;
                
                // Check if adding this line would exceed field limit (1024 chars)
                if (currentField.length + line.length > 1000) {
                    // Add current field and start new one
                    const fieldName = fieldCount === 0 ? 'Emojis' : '​'; // Zero-width space for continuation
                    currentEmbed.addFields({ 
                        name: fieldName,
                        value: currentField || 'Loading...',
                        inline: false
                    });
                    
                    // Update character count
                    embedCharCount += fieldName.length + currentField.length;
                    fieldCount++;
                    currentField = line;
                    
                    // Check if we need a new embed (max 20 fields or approaching 4000 chars)
                    if (fieldCount >= 20 || embedCharCount > 4000) {
                        embedsToSend.push(currentEmbed);
                        
                        // Start new embed
                        currentEmbed = new EmbedBuilder()
                            .setTitle('🎨 Custom Emojis (continued)')
                            .setColor(client.config.colors.primary);
                        fieldCount = 0;
                        embedCharCount = 35; // Length of title
                    }
                } else {
                    currentField += line;
                }
            }
            
            // Add remaining field if any
            if (currentField.length > 0) {
                currentEmbed.addFields({ 
                    name: fieldCount === 0 ? 'Emojis' : '​',
                    value: currentField,
                    inline: false
                });
            }
            
            // Only push the current embed if it has fields
            if (currentEmbed.data.fields && currentEmbed.data.fields.length > 0) {
                embedsToSend.push(currentEmbed);
            }
            
            // Send embeds with error handling
            if (embedsToSend.length > 0) {
                await message.reply({ embeds: [embedsToSend[0]] });
                
                for (let i = 1; i < embedsToSend.length; i++) {
                    await message.channel.send({ embeds: [embedsToSend[i]] });
                    
                    // Small delay to avoid rate limiting
                    if (i % 3 === 0) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                }
            } else {
                // Fallback if somehow no embeds were created
                await message.reply('No emojis to display.');
                return;
            }

            // Add copy-paste config format in a follow-up message
            await message.channel.send(`**Found ${emojis.size} emojis. Generating config format...**`);
            
            const lines = [];
            emojis.forEach((emoji) => {
                lines.push(`    ${emoji.name}: '${emoji.format}',`);
            });
            
            // Split into multiple messages to avoid hitting limits
            let currentMessage = '```javascript\nemojis: {\n';
            let messageCount = 0;
            
            for (const line of lines) {
                // Check if adding this line would exceed Discord's 2000 char limit
                if (currentMessage.length + line.length + 20 > 1950) {
                    await message.channel.send(currentMessage + '\n```');
                    currentMessage = '```javascript\n' + line + '\n';
                    messageCount++;
                    
                    // Add a small delay between messages to avoid rate limiting
                    if (messageCount % 3 === 0) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                } else {
                    currentMessage += line + '\n';
                }
            }
            
            // Send the final message
            await message.channel.send(currentMessage + '}```');
            
            // Send helpful tip
            await message.channel.send('**Tip:** Copy all code blocks above and merge them into your `config.js` file under the `emojis` object.');
        } catch (error) {
            console.error('Error in listemojis command:', error);
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Error')
                .setDescription(`Failed to list emojis: ${error.message}`)
                .setColor(client.config.colors.error);
            
            return message.reply({ embeds: [errorEmbed] }).catch(() => {});
        }
    }
};
