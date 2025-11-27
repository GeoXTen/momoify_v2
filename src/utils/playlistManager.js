import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLAYLISTS_FILE = join(__dirname, '..', '..', 'data', 'playlists.json');

/**
 * Load playlists from file
 * @param {string} guildId - Guild ID
 * @returns {Object} Playlists object for the guild
 */
export function loadPlaylists(guildId) {
    try {
        if (existsSync(PLAYLISTS_FILE)) {
            const data = readFileSync(PLAYLISTS_FILE, 'utf-8');
            const allPlaylists = JSON.parse(data);
            return allPlaylists[guildId] || {};
        }
    } catch (error) {
        console.error('Error loading playlists:'.red, error);
    }
    return {};
}

/**
 * Save playlists to file
 * @param {string} guildId - Guild ID
 * @param {Object} playlists - Playlists object to save
 */
export function savePlaylists(guildId, playlists) {
    try {
        // Ensure data directory exists
        const dataDir = dirname(PLAYLISTS_FILE);
        if (!existsSync(dataDir)) {
            mkdirSync(dataDir, { recursive: true });
        }
        
        // Load all playlists
        let allPlaylists = {};
        if (existsSync(PLAYLISTS_FILE)) {
            const data = readFileSync(PLAYLISTS_FILE, 'utf-8');
            allPlaylists = JSON.parse(data);
        }
        
        // Update this guild's playlists
        allPlaylists[guildId] = playlists;
        
        writeFileSync(PLAYLISTS_FILE, JSON.stringify(allPlaylists, null, 2), 'utf-8');
    } catch (error) {
        console.error('Error saving playlists:'.red, error);
        throw new Error('Failed to save playlists');
    }
}

/**
 * Create a new playlist
 * @param {string} guildId - Guild ID
 * @param {string} name - Playlist name
 * @param {string} creatorId - Creator's user ID
 * @returns {Object} Result object
 */
export function createPlaylist(guildId, name, creatorId) {
    const playlists = loadPlaylists(guildId);
    
    // Validate name
    if (!name || name.length === 0) {
        return { success: false, message: 'Playlist name cannot be empty' };
    }
    if (name.length > 50) {
        return { success: false, message: 'Playlist name must be 50 characters or less' };
    }
    if (!/^[a-zA-Z0-9_\s-]+$/.test(name)) {
        return { success: false, message: 'Playlist name can only contain letters, numbers, spaces, hyphens, and underscores' };
    }
    
    const playlistKey = name.toLowerCase();
    
    if (playlists[playlistKey]) {
        return { success: false, message: 'A playlist with this name already exists' };
    }
    
    playlists[playlistKey] = {
        name: name,
        creatorId: creatorId,
        createdAt: Date.now(),
        tracks: []
    };
    
    savePlaylists(guildId, playlists);
    return { success: true, message: 'Playlist created successfully', playlist: playlists[playlistKey] };
}

/**
 * Delete a playlist
 * @param {string} guildId - Guild ID
 * @param {string} name - Playlist name
 * @param {string} userId - User ID requesting deletion
 * @returns {Object} Result object
 */
export function deletePlaylist(guildId, name, userId) {
    const playlists = loadPlaylists(guildId);
    const playlistKey = name.toLowerCase();
    
    if (!playlists[playlistKey]) {
        return { success: false, message: 'Playlist not found' };
    }
    
    // Check if user is the creator (optional - can be removed for admin-only)
    // For now, anyone with admin perms can delete (handled in command)
    
    delete playlists[playlistKey];
    savePlaylists(guildId, playlists);
    
    return { success: true, message: 'Playlist deleted successfully' };
}

/**
 * Add a track to a playlist
 * @param {string} guildId - Guild ID
 * @param {string} name - Playlist name
 * @param {Object} track - Track object with title, url, duration
 * @returns {Object} Result object
 */
export function addTrackToPlaylist(guildId, name, track) {
    const playlists = loadPlaylists(guildId);
    const playlistKey = name.toLowerCase();
    
    if (!playlists[playlistKey]) {
        return { success: false, message: 'Playlist not found' };
    }
    
    // Check track limit
    if (playlists[playlistKey].tracks.length >= 100) {
        return { success: false, message: 'Playlist is full (maximum 100 tracks)' };
    }
    
    playlists[playlistKey].tracks.push({
        title: track.title,
        url: track.url,
        duration: track.duration,
        addedAt: Date.now()
    });
    
    savePlaylists(guildId, playlists);
    
    return { 
        success: true, 
        message: 'Track added to playlist', 
        trackCount: playlists[playlistKey].tracks.length 
    };
}

/**
 * Remove a track from a playlist
 * @param {string} guildId - Guild ID
 * @param {string} name - Playlist name
 * @param {number} position - Track position (1-based)
 * @returns {Object} Result object
 */
export function removeTrackFromPlaylist(guildId, name, position) {
    const playlists = loadPlaylists(guildId);
    const playlistKey = name.toLowerCase();
    
    if (!playlists[playlistKey]) {
        return { success: false, message: 'Playlist not found' };
    }
    
    const tracks = playlists[playlistKey].tracks;
    
    if (position < 1 || position > tracks.length) {
        return { success: false, message: `Invalid position. Must be between 1 and ${tracks.length}` };
    }
    
    const removed = tracks.splice(position - 1, 1)[0];
    savePlaylists(guildId, playlists);
    
    return { 
        success: true, 
        message: 'Track removed from playlist',
        removedTrack: removed.title
    };
}

/**
 * Get a playlist
 * @param {string} guildId - Guild ID
 * @param {string} name - Playlist name
 * @returns {Object|null} Playlist object or null
 */
export function getPlaylist(guildId, name) {
    const playlists = loadPlaylists(guildId);
    const playlistKey = name.toLowerCase();
    return playlists[playlistKey] || null;
}

/**
 * Get all playlists for a guild
 * @param {string} guildId - Guild ID
 * @returns {Array} Array of playlist objects
 */
export function getAllPlaylists(guildId) {
    const playlists = loadPlaylists(guildId);
    return Object.values(playlists);
}
