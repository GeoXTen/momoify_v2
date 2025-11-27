import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_FILE = join(__dirname, '..', '..', 'data', 'config.json');

// Editable config settings (non-sensitive)
const defaultConfig = {
    botName: '✧˖°.𝓜𝓸𝓶𝓸𝓲𝓯𝔂˙✦',
    prefix: '-',
    colors: {
        primary: 0xFF8C00,
        success: 0xFFA500,
        error: 0xFF6347,
        warning: 0xFFB347
    },
    activity: {
        name: '/help | -help',
        type: 'playing',
        status: 'online'
    }
};

// Valid activity types
const validActivityTypes = ['playing', 'streaming', 'listening', 'watching', 'competing'];
const validStatuses = ['online', 'idle', 'dnd', 'invisible'];

/**
 * Load custom config from file
 * @returns {Object} Custom config object
 */
export function loadCustomConfig() {
    try {
        if (existsSync(CONFIG_FILE)) {
            const data = readFileSync(CONFIG_FILE, 'utf-8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading custom config:'.red, error);
    }
    return {};
}

/**
 * Save custom config to file
 * @param {Object} config - Config object to save
 */
export function saveCustomConfig(config) {
    try {
        // Ensure data directory exists
        const dataDir = dirname(CONFIG_FILE);
        if (!existsSync(dataDir)) {
            mkdirSync(dataDir, { recursive: true });
        }
        
        writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
    } catch (error) {
        console.error('Error saving custom config:'.red, error);
        throw new Error('Failed to save configuration');
    }
}

/**
 * Get merged config (default + custom)
 * @returns {Object} Merged config object
 */
export function getConfig() {
    const custom = loadCustomConfig();
    return {
        botName: custom.botName || defaultConfig.botName,
        prefix: custom.prefix || defaultConfig.prefix,
        colors: { ...defaultConfig.colors, ...custom.colors },
        activity: { ...defaultConfig.activity, ...custom.activity }
    };
}

/**
 * Set a config value
 * @param {string} key - Config key (e.g., 'botName', 'prefix', 'colors.primary')
 * @param {any} value - Value to set
 * @returns {Object} Result object with success status and message
 */
export function setConfigValue(key, value) {
    const custom = loadCustomConfig();
    const config = getConfig();
    
    // Handle nested keys (e.g., 'colors.primary')
    const keys = key.split('.');
    
    try {
        if (keys.length === 1) {
            // Top-level key
            if (key === 'botName') {
                if (typeof value !== 'string' || value.length === 0) {
                    return { success: false, message: 'Bot name must be a non-empty string' };
                }
                if (value.length > 32) {
                    return { success: false, message: 'Bot name must be 32 characters or less' };
                }
                custom.botName = value;
            } else if (key === 'prefix') {
                if (typeof value !== 'string' || value.length === 0) {
                    return { success: false, message: 'Prefix must be a non-empty string' };
                }
                if (value.length > 5) {
                    return { success: false, message: 'Prefix must be 5 characters or less' };
                }
                custom.prefix = value;
            } else {
                return { success: false, message: `Invalid config key: ${key}` };
            }
        } else if (keys.length === 2) {
            // Nested key
            const [parent, child] = keys;
            
            if (parent === 'colors') {
                if (!['primary', 'success', 'error', 'warning'].includes(child)) {
                    return { success: false, message: `Invalid color key: ${child}. Valid: primary, success, error, warning` };
                }
                
                // Parse hex color
                let colorValue;
                if (typeof value === 'string') {
                    // Remove # if present
                    const hex = value.replace('#', '');
                    if (!/^[0-9A-Fa-f]{6}$/.test(hex)) {
                        return { success: false, message: 'Color must be a valid hex code (e.g., #5865F2 or 5865F2)' };
                    }
                    colorValue = parseInt(hex, 16);
                } else if (typeof value === 'number') {
                    if (value < 0 || value > 0xFFFFFF) {
                        return { success: false, message: 'Color must be a valid hex number (0x000000 to 0xFFFFFF)' };
                    }
                    colorValue = value;
                } else {
                    return { success: false, message: 'Color must be a hex string or number' };
                }
                
                if (!custom.colors) custom.colors = {};
                custom.colors[child] = colorValue;
            } else if (parent === 'activity') {
                if (child === 'name') {
                    if (typeof value !== 'string' || value.length === 0) {
                        return { success: false, message: 'Activity name must be a non-empty string' };
                    }
                    if (value.length > 128) {
                        return { success: false, message: 'Activity name must be 128 characters or less' };
                    }
                    if (!custom.activity) custom.activity = {};
                    custom.activity.name = value;
                } else if (child === 'type') {
                    const lowerValue = String(value).toLowerCase();
                    if (!validActivityTypes.includes(lowerValue)) {
                        return { 
                            success: false, 
                            message: `Invalid activity type. Valid: ${validActivityTypes.join(', ')}` 
                        };
                    }
                    if (!custom.activity) custom.activity = {};
                    custom.activity.type = lowerValue;
                } else if (child === 'status') {
                    const lowerValue = String(value).toLowerCase();
                    if (!validStatuses.includes(lowerValue)) {
                        return { 
                            success: false, 
                            message: `Invalid status. Valid: ${validStatuses.join(', ')}` 
                        };
                    }
                    if (!custom.activity) custom.activity = {};
                    custom.activity.status = lowerValue;
                } else {
                    return { success: false, message: `Invalid activity key: ${child}. Valid: name, type, status` };
                }
            } else {
                return { success: false, message: `Invalid config category: ${parent}` };
            }
        } else {
            return { success: false, message: 'Invalid config key format' };
        }
        
        saveCustomConfig(custom);
        return { success: true, message: 'Configuration updated successfully' };
    } catch (error) {
        console.error('Error setting config value:'.red, error);
        return { success: false, message: error.message };
    }
}

/**
 * Reset a config value to default
 * @param {string} key - Config key to reset
 * @returns {Object} Result object with success status and message
 */
export function resetConfigValue(key) {
    const custom = loadCustomConfig();
    const keys = key.split('.');
    
    try {
        if (keys.length === 1) {
            if (custom[key]) {
                delete custom[key];
            }
        } else if (keys.length === 2) {
            const [parent, child] = keys;
            if (custom[parent] && custom[parent][child]) {
                delete custom[parent][child];
                // If parent is now empty, remove it too
                if (Object.keys(custom[parent]).length === 0) {
                    delete custom[parent];
                }
            }
        }
        
        saveCustomConfig(custom);
        return { success: true, message: 'Configuration reset to default' };
    } catch (error) {
        console.error('Error resetting config value:'.red, error);
        return { success: false, message: error.message };
    }
}

/**
 * Get available config keys
 * @returns {Array} Array of config key objects
 */
export function getConfigKeys() {
    return [
        { key: 'botName', description: 'Bot display name', type: 'string', example: 'MusicBot' },
        { key: 'prefix', description: 'Text command prefix', type: 'string', example: '-' },
        { key: 'colors.primary', description: 'Primary embed color', type: 'hex', example: '#5865F2' },
        { key: 'colors.success', description: 'Success embed color', type: 'hex', example: '#57F287' },
        { key: 'colors.error', description: 'Error embed color', type: 'hex', example: '#ED4245' },
        { key: 'colors.warning', description: 'Warning embed color', type: 'hex', example: '#FEE75C' },
        { key: 'activity.name', description: 'Bot activity text', type: 'string', example: '/help | -help' },
        { key: 'activity.type', description: 'Bot activity type', type: 'enum', example: 'playing, listening, watching, streaming' },
        { key: 'activity.status', description: 'Bot status color', type: 'enum', example: 'online, idle, dnd, invisible' }
    ];
}
