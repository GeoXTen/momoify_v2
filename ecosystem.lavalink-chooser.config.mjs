// PM2 Ecosystem Config for Lavalink Chooser
// This runs the lavalink-chooser periodically to keep selecting the best server

export default {
    apps: [
        {
            name: 'lavalink-chooser',
            script: './scripts/lavalink-chooser.mjs',
            // Run once and exit - PM2 will restart based on cron
            autorestart: false,
            // Run every hour to check for better servers
            cron_restart: '0 * * * *',
            // Or use watch mode to keep it running
            // watch: false,
            // Environment variables
            env: {
                NODE_ENV: 'production',
                LAVALINK_LIST: 'lavalink server lis.txt',
                ENV_PATH: '.env',
                PING_SAMPLES: '3',
                HTTP_TIMEOUT: '5000'
            },
            // Logging
            error_file: './logs/lavalink-chooser-error.log',
            out_file: './logs/lavalink-chooser-out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            time: true,
            // Memory management
            max_memory_restart: '200M',
            // Additional options
            merge_logs: true,
            // Arguments to pass to the script
            args: '--verbose'
        }
    ]
};
