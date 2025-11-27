// PM2 Ecosystem Config for Local Lavalink Server

export default {
    apps: [
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
        }
    ]
};
