import express from 'express';
import cors from 'cors';

const router = express.Router();

// Bot start time for uptime calculation
const startTime = Date.now();

export function createStatsAPI(client) {
    const app = express();
    const port = process.env.API_PORT || 3001;
    
    // CORS configuration - allow your website to access the API
    app.use(cors({
        origin: function (origin, callback) {
            // Allow requests with no origin (like file:// or mobile apps)
            if (!origin) return callback(null, true);
            
            // Allow all localhost and 127.0.0.1 regardless of port
            if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
                return callback(null, true);
            }
            
            // Allow your production domain
            if (origin === 'https://momoify.netlify.app') {
                return callback(null, true);
            }
            
            // For development, allow all origins (remove this in production)
            return callback(null, true);
        },
        methods: ['GET', 'POST', 'OPTIONS'],
        credentials: true
    }));
    
    app.use(express.json());
    
    // Health check endpoint
    app.get('/api/health', (req, res) => {
        res.json({ 
            status: 'online',
            timestamp: Date.now()
        });
    });
    
    // Main stats endpoint
    app.get('/api/stats', (req, res) => {
        console.log(`📊 Stats request received from: ${req.get('origin') || 'no-origin (file://)'}`);
        try {
            // Calculate uptime
            const uptimeMs = Date.now() - startTime;
            const uptimeSeconds = Math.floor(uptimeMs / 1000);
            const uptimeDays = Math.floor(uptimeSeconds / 86400);
            const uptimeHours = Math.floor((uptimeSeconds % 86400) / 3600);
            const uptimeMinutes = Math.floor((uptimeSeconds % 3600) / 60);
            
            // Get active players (servers currently playing music)
            const activePlayers = client.lavalink ? 
                [...client.lavalink.players.values()].filter(p => p.playing).length : 0;
            
            // Total players (servers with bot in voice channel)
            const totalPlayers = client.lavalink ? client.lavalink.players.size : 0;
            
            // Calculate total users across all guilds
            const totalUsers = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
            
            // Get total commands count from client.commands collection
            const totalCommands = client.commands ? client.commands.size : 0;
            
            // Stats object
            const stats = {
                // Bot Info
                botName: client.user.username,
                botTag: client.user.tag,
                botId: client.user.id,
                botAvatar: client.user.displayAvatarURL({ size: 256 }),
                
                // Server Stats
                totalServers: client.guilds.cache.size,
                totalUsers: totalUsers,
                totalChannels: client.channels.cache.size,
                
                // Music Stats
                activePlayers: activePlayers,
                totalPlayers: totalPlayers,
                totalCommands: totalCommands,
                
                // Uptime
                uptime: {
                    ms: uptimeMs,
                    seconds: uptimeSeconds,
                    formatted: `${uptimeDays}d ${uptimeHours}h ${uptimeMinutes}m`,
                    days: uptimeDays,
                    hours: uptimeHours,
                    minutes: uptimeMinutes
                },
                
                // Performance
                ping: client.ws.ping,
                memoryUsage: {
                    heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                    heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
                    rss: Math.round(process.memoryUsage().rss / 1024 / 1024)
                },
                
                // Timestamps
                timestamp: Date.now(),
                startedAt: startTime
            };
            
            res.json(stats);
        } catch (error) {
            console.error('Error generating stats:', error);
            res.status(500).json({ 
                error: 'Failed to generate stats',
                message: error.message 
            });
        }
    });
    
    // Detailed guild stats endpoint (optional)
    app.get('/api/guilds', (req, res) => {
        try {
            const guilds = client.guilds.cache.map(guild => ({
                id: guild.id,
                name: guild.name,
                memberCount: guild.memberCount,
                icon: guild.iconURL({ size: 128 }),
                hasPlayer: client.lavalink?.players.has(guild.id) || false
            }));
            
            res.json({ 
                count: guilds.length,
                guilds: guilds 
            });
        } catch (error) {
            console.error('Error getting guild stats:', error);
            res.status(500).json({ 
                error: 'Failed to get guild stats',
                message: error.message 
            });
        }
    });
    
    // Lavalink node stats (optional)
    app.get('/api/lavalink', (req, res) => {
        try {
            if (!client.lavalink) {
                return res.status(404).json({ error: 'Lavalink not initialized' });
            }
            
            const nodes = [...client.lavalink.nodeManager.nodes.values()].map(node => ({
                id: node.id,
                host: node.options.host,
                port: node.options.port,
                connected: node.connected,
                stats: node.stats || {}
            }));
            
            res.json({ 
                nodes: nodes,
                totalPlayers: client.lavalink.players.size
            });
        } catch (error) {
            console.error('Error getting Lavalink stats:', error);
            res.status(500).json({ 
                error: 'Failed to get Lavalink stats',
                message: error.message 
            });
        }
    });
    
    // 404 handler
    app.use((req, res) => {
        res.status(404).json({ 
            error: 'Not found',
            availableEndpoints: [
                '/api/health',
                '/api/stats',
                '/api/guilds',
                '/api/lavalink'
            ]
        });
    });
    
    // Start server
    app.listen(port, () => {
        console.log(`\n╔═══════════════════════════════════╗`.magenta);
        console.log(`║  Stats API running on port ${port}  ║`.magenta.bold);
        console.log(`╚═══════════════════════════════════╝\n`.magenta);
        console.log(`📊 Endpoints available:`.cyan);
        console.log(`   • http://localhost:${port}/api/stats`.cyan);
        console.log(`   • http://localhost:${port}/api/health`.cyan);
        console.log(`   • http://localhost:${port}/api/guilds`.cyan);
        console.log(`   • http://localhost:${port}/api/lavalink\n`.cyan);
    });
    
    return app;
}
