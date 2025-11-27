// PM2 Ecosystem Config - Run Everything (Lavalink + Bot)
// This config runs both Lavalink server and the bot together

export default {
    apps: [
        // Lavalink Server
        {
            name: 'lavalink',
            script: 'java',
            args: '-jar Lavalink.jar',
            cwd: './lavalink',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '1G',
            env: {
                NODE_ENV: 'production'
            },
            error_file: './logs/lavalink-error.log',
            out_file: './logs/lavalink-out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            time: true,
            min_uptime: '10s',
            max_restarts: 10,
            kill_timeout: 5000,
            listen_timeout: 10000
        },
        // Discord Bot
        {
            name: 'momoify-bot',
            script: './src/index.js',
            instances: 1,
            watch: true,
            max_memory_restart: '500M',
            env: {
                NODE_ENV: 'production'
            },
            error_file: './logs/bot-error.log',
            out_file: './logs/bot-out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            time: true,
            autorestart: true,
            max_restarts: 10,
            min_uptime: '10s',
            listen_timeout: 3000,
            kill_timeout: 5000,
            // Wait for Lavalink to start before starting bot
            wait_ready: true,
            startup_delay: 10000 // Wait 10 seconds after Lavalink starts
        }
    ]
};
