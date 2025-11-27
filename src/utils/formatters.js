// Utility functions for formatting data

/**
 * Format a user ID or mention to proper Discord mention format
 * Handles cases where the requester might already be in <@id> format
 * 
 * @param {string} userId - User ID or mention string
 * @returns {string} - Properly formatted mention: <@userid>
 */
export function formatUserMention(userId) {
    if (!userId) return '@Unknown';
    
    // If already in mention format, return as-is
    if (userId.startsWith('<@') && userId.endsWith('>')) {
        return userId;
    }
    
    // Otherwise wrap in mention format
    return `<@${userId}>`;
}

/**
 * Format milliseconds to readable time string
 * @param {number} ms - Duration in milliseconds
 * @returns {string} - Formatted time (mm:ss or h:mm:ss)
 */
export function formatTime(ms) {
    if (!ms || ms === 0) return '0:00';
    
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor(ms / (1000 * 60 * 60));
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Truncate string to specified length
 * @param {string} str - String to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} - Truncated string with ellipsis if needed
 */
export function truncateString(str, maxLength) {
    if (!str) return '';
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + '...';
}
