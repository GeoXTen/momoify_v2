import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', '..', 'data');
const prefixesPath = join(dataDir, 'prefixes.json');

// Default prefix
const DEFAULT_PREFIX = '-';

// In-memory cache for prefixes
let prefixesCache = null;

function ensureDataDir() {
    if (!existsSync(dataDir)) {
        mkdirSync(dataDir, { recursive: true });
    }
}

export function loadPrefixes() {
    ensureDataDir();
    
    if (!existsSync(prefixesPath)) {
        return {};
    }
    
    try {
        const data = readFileSync(prefixesPath, 'utf-8');
        prefixesCache = JSON.parse(data);
        return prefixesCache;
    } catch (error) {
        console.error('Error loading custom prefixes:', error);
        return {};
    }
}

export function savePrefixes(prefixes) {
    ensureDataDir();
    
    try {
        writeFileSync(prefixesPath, JSON.stringify(prefixes, null, 4), 'utf-8');
        prefixesCache = prefixes;
    } catch (error) {
        console.error('Error saving custom prefixes:', error);
    }
}

export function getPrefix(guildId) {
    if (!prefixesCache) {
        prefixesCache = loadPrefixes();
    }
    
    return prefixesCache[guildId] || DEFAULT_PREFIX;
}

export function setPrefix(guildId, prefix) {
    if (!prefixesCache) {
        prefixesCache = loadPrefixes();
    }
    
    // Validate prefix (must be 1-5 characters, no spaces at start/end)
    const trimmed = prefix.trim();
    if (trimmed.length === 0 || trimmed.length > 5) {
        return { success: false, message: 'Prefix must be 1-5 characters long.' };
    }
    
    if (prefix !== trimmed) {
        return { success: false, message: 'Prefix cannot start or end with spaces.' };
    }
    
    // Check if prefix contains only valid characters (allow most characters except newlines and tabs)
    if (/[\n\t\r]/.test(prefix)) {
        return { success: false, message: 'Prefix cannot contain newlines or tabs.' };
    }
    
    prefixesCache[guildId] = prefix;
    savePrefixes(prefixesCache);
    
    return { 
        success: true, 
        message: `Prefix updated to \`${prefix}\` for this server.`,
        prefix 
    };
}

export function resetPrefix(guildId) {
    if (!prefixesCache) {
        prefixesCache = loadPrefixes();
    }
    
    if (!prefixesCache[guildId]) {
        return { 
            success: false, 
            message: `This server is already using the default prefix \`${DEFAULT_PREFIX}\`` 
        };
    }
    
    delete prefixesCache[guildId];
    savePrefixes(prefixesCache);
    
    return { 
        success: true, 
        message: `Prefix reset to default \`${DEFAULT_PREFIX}\` for this server.`,
        prefix: DEFAULT_PREFIX
    };
}

export function getDefaultPrefix() {
    return DEFAULT_PREFIX;
}

export function getAllPrefixes() {
    if (!prefixesCache) {
        prefixesCache = loadPrefixes();
    }
    
    return { ...prefixesCache };
}
