import dotenv from 'dotenv';
import { getConfig } from './utils/configManager.js';

dotenv.config();

// Load custom config (if exists)
const customConfig = getConfig();

export default {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.CLIENT_ID,
    ownerId: process.env.OWNER_ID || 'YOUR_USER_ID', // Your Discord User ID for owner commands
    botName: customConfig.botName || '✧˖°.𝓜𝓸𝓶𝓸𝓲𝓯𝔂˙✦', // Fancy formatted bot name - Script font
    
    lavalink: {
        host: process.env.LAVALINK_HOST || 'localhost',
        port: parseInt(process.env.LAVALINK_PORT) || 2333,
        password: process.env.LAVALINK_PASSWORD || 'youshallnotpass',
        secure: process.env.LAVALINK_SECURE === 'true'
    },
    
    activity: {
        type: customConfig.activity?.type || process.env.BOT_ACTIVITY || 'music',
        status: customConfig.activity?.status || process.env.BOT_STATUS || 'online'
    },
    
    prefix: customConfig.prefix || process.env.PREFIX || '-',
    
    colors: {
        primary: customConfig.colors?.primary ?? 0xFF8C00,
        success: customConfig.colors?.success ?? 0xFFA500,
        error: customConfig.colors?.error ?? 0xFF6347,
        warning: customConfig.colors?.warning ?? 0xFFB347
    },
    
    emojis: {
        // Music Controls - UPDATED from emoji.txt
        play: '<:play:1439784311086645309>',
        pause: '<:pause:1439806475458449448>',
        loop: '<:loop:1439803192824303669>',
        player: '<:player:1439063416185688239>',
        seek: '<:seek:1439063423823384588>',
        previous: '<:previous:1439785185628524727>',
        skip: '<:skip:1439785191492157492>',
        stop: '<:stop:1439785197712179260>',
        shuffle: '<:shuffle:1439780008465010870>',
        refresh: '<:refresh:1439785212467875841>',
        
        // Audio
        volume: '<:volume:1439063432413315182>',
        headphone: '<:headphone:1439063440936145027>',
        visualizer: '<a:visualizer:1439830990905278525>',
        
        // Queue & Status - UPDATED queue ID
        queue: '<:queue:1439044159305416704>',
        cloudnote: '<:cloudnote:1439063457105186876>',
        disk: '<:disk:1439063465301114950>',
        
        // Progress Bar Elements - UPDATED from emoji.txt
        startingfillbar: '<:startingfillbar:1439785219518500894>',
        middlefillbar: '<:middlefillbar:1439785226317336878>',
        middledotfillbar: '<:middledotfillbar:1439808212533510174>',
        emptymiddlebar: '<:emptymiddlebar:1439785239848157307>',
        emptyendbar: '<:emptyendbar:1439785246622220379>',
        
        // Music Icons
        melody: '<:melody:1439063473916084295>',
        note1: '<:note1:1439063482031935598>',
        note2: '<:note2:1439063490345042081>',
        note3: '<:note3:1439063498494709871>',
        note4: '<:note4:1439063506552094800>',
        stars: '<:stars:1439063514890371183>',
        
        // Status
        checkmark: '<:checkmark:1439063523039908002>',
        verified: '<:verified:1439063531206217768>',
        time: '<:time:1439063539636768893>',
        
        // Sources
        youtube: '<:youtube:1439063548872626380>',
        spotify: '<:spotify:1439063557084938351>',
        soundcloud: '<:soundcloud:1439063565314035824>',
        applemusic: '<:applemusic:1439063573656768653>',
        deezer: '<:deezer:1439063582036987964>',
        control: '<:control:1439090516825477120>',
        source: '<:source:1439090541634523146>',
        
        // General
        error: '❌',
        success: '✅',
        warning: '⚠️',
        info: 'ℹ️',
        
        // Misc
        loading: '⏳',
        online: '🟢',
        idle: '🟡',
        dnd: '🔴',
        
        // Admin Command Enhancements
        bulb: '💡',
        repeat: '🔁',
        filters: '🎛️',
        alwayson: '24/7',
        forward: '⏩',
        lock: '🔒',
        unlock: '🔓',
        tools: '🔧',
        stats_icon: '📊',
        rocket: '🚀',
        chart: '📈',
        server: '🖥️',
        memory: '💾',
        cpu: '⚡',
        database: '💿',
        code: '💻',
        wrench: '🔨',
        gear: '⚙️',
        shield: '🛡️'
    },
    
    genius: {
        clientId: process.env.GENIUS_CLIENT_ID || '' // Client Access Token
    },
    
    spotify: {
        clientId: process.env.SPOTIFY_CLIENT_ID || '',
        clientSecret: process.env.SPOTIFY_CLIENT_SECRET || ''
    }
};
