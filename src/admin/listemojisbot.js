import { EmbedBuilder } from 'discord.js';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default {
    name: 'listemojisbot',
    description: 'List emojis from emoji.txt file (Owner only)',
    ownerOnly: true,
    
    async execute(message, args, client) {
        try {
            // Read the emoji.txt file from the project root
            const emojiFilePath = join(__dirname, '..', '..', 'emoji.txt');
            const fileContent = await readFile(emojiFilePath, 'utf-8');
            
            // Parse the file content
            const lines = fileContent.split('\n');
            const categories = new Map();
            let currentCategory = 'Uncategorized';
            
            for (const line of lines) {
                const trimmedLine = line.trim();
                
                // Skip empty lines and usage instructions section
                if (!trimmedLine || trimmedLine.startsWith('##') || trimmedLine.startsWith('#')) {
                    // Check if it's a category header
                    if (trimmedLine.startsWith('##') && !trimmedLine.toLowerCase().includes('usage')) {
                        currentCategory = trimmedLine.replace(/^##\s*/, '').trim();
                        if (!categories.has(currentCategory)) {
                            categories.set(currentCategory, []);
                        }
                    }
                    continue;
                }
                
                // Match emoji format: <:name:id> or <a:name:id>
                const emojiMatch = trimmedLine.match(/<a?:\w+:\d+>/g);
                if (emojiMatch) {
                    if (!categories.has(currentCategory)) {
                        categories.set(currentCategory, []);
                    }
                    categories.get(currentCategory).push(...emojiMatch);
                }
            }
            
            // Count total emojis
            let totalEmojis = 0;
            categories.forEach(emojis => totalEmojis += emojis.length);
            
            if (totalEmojis === 0) {
                const embed = new EmbedBuilder()
                    .setTitle('❌ No Emojis Found')
                    .setDescription('No emojis found in emoji.txt file!')
                    .setColor(client.config.colors.error);
                
                return message.reply({ embeds: [embed] });
            }
            
            // Create embeds
            const embeds = [];
            
            // Main embed with summary
            const mainEmbed = new EmbedBuilder()
                .setTitle('🎨 Bot Emojis from emoji.txt')
                .setDescription(`Found **${totalEmojis}** emojis in **${categories.size}** categories`)
                .setColor(client.config.colors.primary)
                .setTimestamp();
            
            // Add categories as fields
            let currentEmbed = mainEmbed;
            let fieldCount = 0;
            let embedCharCount = 0;
            
            for (const [category, emojis] of categories) {
                if (emojis.length === 0) continue;
                
                // Create field value with emojis
                const emojiDisplay = emojis.map(emoji => {
                    // Extract emoji name from format <:name:id>
                    const nameMatch = emoji.match(/<a?:(\w+):\d+>/);
                    const name = nameMatch ? nameMatch[1] : 'unknown';
                    return `${emoji} \`${name}\``;
                }).join('\n');
                
                const fieldLength = category.length + emojiDisplay.length;
                
                // Check if we need a new embed (max 25 fields or approaching 6000 chars total)
                if (fieldCount >= 25 || embedCharCount + fieldLength > 5500) {
                    embeds.push(currentEmbed);
                    
                    // Start new embed
                    currentEmbed = new EmbedBuilder()
                        .setTitle('🎨 Bot Emojis (continued)')
                        .setColor(client.config.colors.primary);
                    fieldCount = 0;
                    embedCharCount = 0;
                }
                
                // Check if field value exceeds 1024 chars
                if (emojiDisplay.length > 1024) {
                    // Split the emojis into multiple fields
                    const chunks = [];
                    let currentChunk = '';
                    
                    for (const emoji of emojis) {
                        const nameMatch = emoji.match(/<a?:(\w+):\d+>/);
                        const name = nameMatch ? nameMatch[1] : 'unknown';
                        const line = `${emoji} \`${name}\`\n`;
                        
                        if (currentChunk.length + line.length > 1000) {
                            chunks.push(currentChunk.trim());
                            currentChunk = line;
                        } else {
                            currentChunk += line;
                        }
                    }
                    
                    if (currentChunk.trim()) {
                        chunks.push(currentChunk.trim());
                    }
                    
                    // Add each chunk as a field
                    for (let i = 0; i < chunks.length; i++) {
                        const fieldName = i === 0 ? category : '​'; // Zero-width space for continuation
                        currentEmbed.addFields({
                            name: fieldName,
                            value: chunks[i],
                            inline: false
                        });
                        fieldCount++;
                        embedCharCount += fieldName.length + chunks[i].length;
                        
                        // Check if we need a new embed after adding this field
                        if (fieldCount >= 25 && i < chunks.length - 1) {
                            embeds.push(currentEmbed);
                            currentEmbed = new EmbedBuilder()
                                .setTitle('🎨 Bot Emojis (continued)')
                                .setColor(client.config.colors.primary);
                            fieldCount = 0;
                            embedCharCount = 0;
                        }
                    }
                } else {
                    currentEmbed.addFields({
                        name: category,
                        value: emojiDisplay,
                        inline: false
                    });
                    fieldCount++;
                    embedCharCount += fieldLength;
                }
            }
            
            // Add the last embed if it has fields
            if (currentEmbed.data.fields && currentEmbed.data.fields.length > 0) {
                embeds.push(currentEmbed);
            }
            
            // Send embeds
            if (embeds.length > 0) {
                await message.reply({ embeds: [embeds[0]] });
                
                for (let i = 1; i < embeds.length; i++) {
                    await message.channel.send({ embeds: [embeds[i]] });
                    
                    // Small delay to avoid rate limiting
                    if (i % 3 === 0) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                }
            }
            
        } catch (error) {
            console.error('Error in listemojisbot command:', error);
            
            let errorMessage = `Failed to read emoji.txt: ${error.message}`;
            if (error.code === 'ENOENT') {
                errorMessage = 'emoji.txt file not found in the bot root directory!';
            }
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Error')
                .setDescription(errorMessage)
                .setColor(client.config.colors.error);
            
            return message.reply({ embeds: [errorEmbed] }).catch(() => {});
        }
    }
};
