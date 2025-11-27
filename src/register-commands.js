import { REST, Routes } from 'discord.js';
import { readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import config from './config.js';
import colors from 'colors';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Get command line arguments
const args = process.argv.slice(2);
const guildId = args.find(arg => arg.startsWith('--guild='))?.split('=')[1];
const mode = args.includes('--global') ? 'global' : (guildId ? 'guild' : 'global');

async function registerCommands() {
    const commands = [];
    const commandsPath = join(__dirname, 'commands');
    
    try {
        const commandFiles = (await readdir(commandsPath)).filter(file => file.endsWith('.js'));
        
        for (const file of commandFiles) {
            const command = await import(`./commands/${file}`);
            if (command.default?.data) {
                commands.push(command.default.data.toJSON());
                console.log(`✓ Loaded command: ${command.default.data.name}`.green);
            }
        }
        
        const rest = new REST({ version: '10' }).setToken(config.token);
        
        if (mode === 'guild' && guildId) {
            console.log(`\n📝 Registering ${commands.length} commands to guild ${guildId}...\n`.cyan);
            
            const data = await rest.put(
                Routes.applicationGuildCommands(config.clientId, guildId),
                { body: commands }
            );
            
            console.log(`✓ Successfully registered ${data.length} guild commands! (Updates instantly)\n`.green.bold);
            console.log('Commands:'.cyan);
            data.forEach(cmd => console.log(`  - /${cmd.name}`.gray));
        } else {
            console.log(`\n📝 Registering ${commands.length} global commands...\n`.cyan);
            console.log('⚠️  Note: Global commands may take up to 1 hour to update across all servers.\n'.yellow);
            
            const data = await rest.put(
                Routes.applicationCommands(config.clientId),
                { body: commands }
            );
            
            console.log(`✓ Successfully registered ${data.length} global commands!\n`.green.bold);
            console.log('Commands:'.cyan);
            data.forEach(cmd => console.log(`  - /${cmd.name}`.gray));
        }
        
    } catch (error) {
        console.error('Error registering commands:'.red, error);
        console.log('\nUsage:'.yellow);
        console.log('  Global:  node src/register-commands.js --global'.gray);
        console.log('  Guild:   node src/register-commands.js --guild=YOUR_GUILD_ID'.gray);
        process.exit(1);
    }
}

registerCommands();
