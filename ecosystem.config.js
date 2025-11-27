export default {
    apps: [
        {
            name: 'momoify-bot',
            script: './src/index.js',
            instances: 1,
            watch: true,
            max_memory_restart: '500M',
            env: {
                NODE_ENV: 'production'
            },
            error_file: './logs/error.log',
            out_file: './logs/out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            time: true,
            autorestart: true,
            max_restarts: 10,
            min_uptime: '10s',
            listen_timeout: 3000,
            kill_timeout: 5000
        }
    ]
};
