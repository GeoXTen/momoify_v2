// ecosystem.config.mjs
export default {
    apps: [
        {
            name: 'geomsc',
            script: './src/index.js',
            // Remove interpreter line entirely, pm2 detects from shebang/extension
            // Remove interpreterArgs, --experimental-modules is deprecated in node 24
            instances: 1,
            watch: true,
            max_memory_restart: '500M',
            // env_file doesn't exist in pm2, use dotenv in your app or:
            // Remove env_file line
            env: {
                NODE_ENV: 'production',
                // Add your vars here directly, or load via dotenv package
            },
            // Add these for better logging
            error_file: './logs/err.log',
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
}

// export default {
//     apps: [
//         {
//             name: 'geomsc',
//             script: './src/index.js',
//             interpreter: 'node',  // Remove full path or use 'node'
//             interpreterArgs: '--experimental-modules', // Add if needed for ESM
//             instances: 1,
//             watch: true,
//             max_memory_restart: '500M',
//             env_file: '.env', // Load environment variables from .env file
//             env: {
//                 NODE_ENV: 'production',
//                 LAVALINK_HOST: 'lava-v4.ajieblogs.eu.org',
//                 LAVALINK_PORT: '443',
//                 LAVALINK_PASSWORD: 'https://dsc.gg/ajidevserver',
//                 LAVALINK_SECURE: 'true'
//             },
//             error_file: './logs/error.log',
//             out_file: './logs/out.log',
//             log_file: './logs/combined.log',
//             time: true,
//             autorestart: true,
//             max_restarts: 10,
//             min_uptime: '10s',
//             listen_timeout: 3000,
//             kill_timeout: 5000
//         }
//     ]
// };


// module.exports = {
//     apps: [
//         {
//             name: 'geomsc',
//             script: './src/index.js',
//             interpreter: '/usr/local/bin/node',  // Use Bun instead of Node.js
//             instances: 1,
//             // exec_mode: 'fork',
//             watch: true,
//             max_memory_restart: '500M',
            
//         }
//     ]
// };
