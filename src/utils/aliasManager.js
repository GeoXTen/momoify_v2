import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ALIASES_FILE = join(__dirname, '..', '..', 'data', 'aliases.json');

// Default built-in aliases
const defaultAliases = {
    'p': 'play',
    'pn': 'playnext',
    's': 'skip',
    'st': 'skipto',
    'rp': 'replay',
    'gr': 'grab',
    'np': 'nowplaying',
    'q': 'queue',
    'v': 'volume',
    'pau': 'pause',
    'res': 'resume',
    'stop': 'stop',
    'sh': 'shuffle',
    'l': 'loop',
    'j': 'join',
    'dc': 'disconnect',
    'lv': 'leave',
    'ap': 'autoplay',
    'rm': 'remove',
    'm': 'move',
    'cq': 'clearqueue',
    'f': 'filters',
    'h': 'help',
    'a': 'about',
    'ly': 'lyrics',
    'cs': 'clearstatus',
    'ping': 'ping'
};

/**
 * Get default built-in aliases
 * @returns {Object} Default aliases object
 */
export function getDefaultAliases() {
    return { ...defaultAliases };
}

/**
 * Load custom aliases from file
 * @returns {Object} Custom aliases object
 */
export function loadCustomAliases() {
    try {
        if (existsSync(ALIASES_FILE)) {
            const data = readFileSync(ALIASES_FILE, 'utf-8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading custom aliases:'.red, error);
    }
    return {};
}

/**
 * Save custom aliases to file
 * @param {Object} aliases - Custom aliases object to save
 */
export function saveCustomAliases(aliases) {
    try {
        // Ensure data directory exists
        const dataDir = dirname(ALIASES_FILE);
        if (!existsSync(dataDir)) {
            mkdirSync(dataDir, { recursive: true });
        }
        
        writeFileSync(ALIASES_FILE, JSON.stringify(aliases, null, 2), 'utf-8');
    } catch (error) {
        console.error('Error saving custom aliases:'.red, error);
        throw new Error('Failed to save aliases');
    }
}

/**
 * Get all aliases (default + custom, with custom overriding default)
 * @returns {Object} Merged aliases object
 */
export function getAllAliases() {
    const custom = loadCustomAliases();
    return { ...defaultAliases, ...custom };
}

/**
 * Resolve an alias to its command name
 * @param {string} alias - The alias to resolve
 * @returns {string|null} The command name or null if not found
 */
export function resolveAlias(alias) {
    const allAliases = getAllAliases();
    return allAliases[alias.toLowerCase()] || null;
}
