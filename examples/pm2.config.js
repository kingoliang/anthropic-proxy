module.exports = {
  apps: [{
    name: 'anthropic-proxy',
    script: './src/server.js',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development',
      PORT: 8082,
      LOG_LEVEL: 'INFO'
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 8082,
      LOG_LEVEL: 'WARN'
    },
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    time: true,
    max_memory_restart: '500M',
    restart_delay: 4000
  }]
};