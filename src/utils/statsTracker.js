import fs from 'fs/promises';
import path from 'path';
import { statsCache } from './statsCache.js';

const STATS_FILE = path.join(process.cwd(), 'data', 'listening-stats.json');
const TRACKS_FILE = path.join(process.cwd(), 'data', 'user-tracks.json');

// Ensure data directory exists
async function ensureDataDir() {
    try {
        await fs.mkdir(path.join(process.cwd(), 'data'), { recursive: true });
    } catch (error) {
        // Directory exists
    }
}

// Load stats
async function loadStats() {
    try {
        const data = await fs.readFile(STATS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return { users: {} };
    }
}

// Save stats
async function saveStats(stats) {
    await ensureDataDir();
    await fs.writeFile(STATS_FILE, JSON.stringify(stats, null, 2));
    statsCache.invalidate('stats'); // Invalidate cache after save
}

// Load track stats
async function loadTrackStats() {
    try {
        const data = await fs.readFile(TRACKS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return { users: {} };
    }
}

// Save track stats
async function saveTrackStats(stats) {
    await ensureDataDir();
    await fs.writeFile(TRACKS_FILE, JSON.stringify(stats, null, 2));
    statsCache.invalidate('tracks'); // Invalidate cache after save
}

// Track a song play
export async function trackPlay(userId, guildId, durationMs, trackInfo = {}) {
    try {
        const stats = await loadStats();
        
        // Initialize user if doesn't exist
        if (!stats.users[userId]) {
            stats.users[userId] = {};
        }
        
        // Initialize guild for user if doesn't exist
        if (!stats.users[userId][guildId]) {
            stats.users[userId][guildId] = {
                tracks: 0,
                minutes: 0
            };
        }
        
        // Increment track count
        stats.users[userId][guildId].tracks += 1;
        
        // Add minutes listened (convert ms to minutes)
        const minutes = Math.floor(durationMs / 60000);
        stats.users[userId][guildId].minutes += minutes;
        
        await saveStats(stats);
        
        // Track individual tracks if info provided
        if (trackInfo.title) {
            const trackStats = await loadTrackStats();
            
            if (!trackStats.users[userId]) {
                trackStats.users[userId] = {};
            }
            
            const trackId = `${trackInfo.title}-${trackInfo.artist}`.toLowerCase().replace(/[^a-z0-9]/g, '');
            
            if (!trackStats.users[userId][trackId]) {
                trackStats.users[userId][trackId] = {
                    title: trackInfo.title,
                    artist: trackInfo.artist,
                    playCount: 0,
                    totalMinutes: 0
                };
            }
            
            trackStats.users[userId][trackId].playCount += 1;
            trackStats.users[userId][trackId].totalMinutes += minutes;
            
            await saveTrackStats(trackStats);
        }
    } catch (error) {
        console.error('Error tracking stats:', error);
    }
}

// Get user stats
export async function getUserStats(userId, guildId = null) {
    try {
        const stats = await loadStats();
        
        if (!stats.users[userId]) {
            return { tracks: 0, minutes: 0 };
        }
        
        if (guildId) {
            // Server-specific stats
            return stats.users[userId][guildId] || { tracks: 0, minutes: 0 };
        } else {
            // Global stats
            let totalTracks = 0;
            let totalMinutes = 0;
            for (const guildStats of Object.values(stats.users[userId])) {
                totalTracks += guildStats.tracks || 0;
                totalMinutes += guildStats.minutes || 0;
            }
            return { tracks: totalTracks, minutes: totalMinutes };
        }
    } catch (error) {
        console.error('Error getting user stats:', error);
        return { tracks: 0, minutes: 0 };
    }
}
