// Utility to detect and list all custom emojis available to the bot
export function getAllCustomEmojis(client) {
    const emojis = new Map();
    
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
    
    return emojis;
}

export function printEmojiList(client) {
    const emojis = getAllCustomEmojis(client);
    
    console.log('\n=== Custom Emojis Available ===\n');
    
    if (emojis.size === 0) {
        console.log('No custom emojis found! Make sure:');
        console.log('1. Bot is in a server with custom emojis');
        console.log('2. Emojis are uploaded to that server\n');
        return;
    }
    
    emojis.forEach((emoji, name) => {
        console.log(`${emoji.format} - ${emoji.name} (${emoji.guild})`);
    });
    
    console.log(`\n=== Total: ${emojis.size} emojis ===\n`);
    return emojis;
}
