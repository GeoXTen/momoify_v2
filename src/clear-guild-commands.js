import { REST, Routes } from 'discord.js';
import config from './config.js';
import colors from 'colors';

// Get guild ID from command line
const args = process.argv.slice(2);
const guildId = args.find(arg => arg.startsWith('--guild='))?.split('=')[1];

if (!guildId) {
    console.log('Error: Please provide a guild ID'.red);
    console.log('Usage: node src/clear-guild-commands.js --guild=YOUR_GUILD_ID'.yellow);
    process.exit(1);
}

async function clearGuildCommands() {
    try {
        const rest = new REST({ version: '10' }).setToken(config.token);
        
        console.log(`\n🗑️  Clearing all guild commands for guild ${guildId}...\n`.cyan);
        
        await rest.put(
            Routes.applicationGuildCommands(config.clientId, guildId),
            { body: [] }
        );
        
        console.log(`✓ Successfully cleared all guild commands!\n`.green.bold);
        console.log('ℹ️  To register commands again, run:'.cyan);
        console.log(`   node src/register-commands.js --guild=${guildId}`.gray);
        console.log('   or'.gray);
        console.log('   node src/register-commands.js --global'.gray);
        
    } catch (error) {
        console.error('Error clearing guild commands:'.red, error);
        process.exit(1);
    }
}

clearGuildCommands();
