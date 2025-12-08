// Top.gg vote checker utility

const voteCache = new Map();
export const CACHE_12H = 12 * 60 * 60 * 1000; // 12 hours in ms
export const CACHE_3D = 3 * 24 * 60 * 60 * 1000; // 3 days in ms

export async function hasVoted(userId, client, cacheDuration = CACHE_12H) {
    const topggToken = process.env.TOPGG_TOKEN;
    const botId = client.config.clientId;
    
    if (!topggToken) {
        console.warn('[Vote] TOPGG_TOKEN not configured, skipping vote check');
        return true; // Allow if no token configured
    }
    
    // Check cache first
    const cacheKey = `${userId}_${cacheDuration}`;
    const cached = voteCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < cacheDuration) {
        return cached.voted;
    }
    
    try {
        const response = await fetch(`https://top.gg/api/bots/${botId}/check?userId=${userId}`, {
            headers: {
                'Authorization': topggToken
            }
        });
        
        if (!response.ok) {
            console.error(`[Vote] API error: ${response.status}`);
            return true; // Allow on API error to not block users
        }
        
        const data = await response.json();
        const voted = data.voted === 1;
        
        // Cache the result
        voteCache.set(cacheKey, { voted, timestamp: Date.now() });
        
        return voted;
    } catch (error) {
        console.error(`[Vote] Check failed: ${error.message}`);
        return true; // Allow on error
    }
}

export function getVoteUrl(botId) {
    return `https://top.gg/bot/${botId}/vote`;
}

export function clearVoteCache(userId) {
    if (userId) {
        voteCache.delete(userId);
    } else {
        voteCache.clear();
    }
}
