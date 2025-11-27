import fs from 'fs/promises';
import path from 'path';

const STATS_FILE = path.join(process.cwd(), 'data', 'listening-stats.json');
const TRACKS_FILE = path.join(process.cwd(), 'data', 'user-tracks.json');

class StatsCache {
    constructor(ttl = 5 * 60 * 1000) { // Default 5 minutes TTL
        this.ttl = ttl;
        this.cache = {
            stats: { data: null, timestamp: 0 },
            tracks: { data: null, timestamp: 0 }
        };
    }

    // Check if cache is valid
    isValid(cacheKey) {
        const cached = this.cache[cacheKey];
        if (!cached.data) return false;
        return Date.now() - cached.timestamp < this.ttl;
    }

    // Load listening stats
    async loadStats(forceRefresh = false) {
        if (!forceRefresh && this.isValid('stats')) {
            return this.cache.stats.data;
        }

        try {
            const data = await fs.readFile(STATS_FILE, 'utf8');
            const parsed = JSON.parse(data);
            this.cache.stats = {
                data: parsed,
                timestamp: Date.now()
            };
            return parsed;
        } catch (error) {
            const defaultData = { users: {} };
            this.cache.stats = {
                data: defaultData,
                timestamp: Date.now()
            };
            return defaultData;
        }
    }

    // Load track stats
    async loadTrackStats(forceRefresh = false) {
        if (!forceRefresh && this.isValid('tracks')) {
            return this.cache.tracks.data;
        }

        try {
            const data = await fs.readFile(TRACKS_FILE, 'utf8');
            const parsed = JSON.parse(data);
            this.cache.tracks = {
                data: parsed,
                timestamp: Date.now()
            };
            return parsed;
        } catch (error) {
            const defaultData = { users: {} };
            this.cache.tracks = {
                data: defaultData,
                timestamp: Date.now()
            };
            return defaultData;
        }
    }

    // Invalidate specific cache or all
    invalidate(cacheKey = null) {
        if (cacheKey) {
            this.cache[cacheKey] = { data: null, timestamp: 0 };
        } else {
            // Invalidate all
            this.cache.stats = { data: null, timestamp: 0 };
            this.cache.tracks = { data: null, timestamp: 0 };
        }
    }

    // Get cache info for debugging
    getCacheInfo() {
        return {
            stats: {
                cached: !!this.cache.stats.data,
                age: this.cache.stats.data ? Date.now() - this.cache.stats.timestamp : 0,
                valid: this.isValid('stats')
            },
            tracks: {
                cached: !!this.cache.tracks.data,
                age: this.cache.tracks.data ? Date.now() - this.cache.tracks.timestamp : 0,
                valid: this.isValid('tracks')
            },
            ttl: this.ttl
        };
    }
}

// Export singleton instance
export const statsCache = new StatsCache();
