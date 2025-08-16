# Anthropic API Proxy

A professional proxy server for forwarding requests to the Anthropic API, specifically designed for Claude Code with comprehensive monitoring capabilities.

## 📁 Project Structure

```
anthropic-proxy/
├── src/                    # Source code
│   ├── server.js          # Main server application
│   ├── monitor/           # Monitoring modules
│   │   ├── store.js       # Request/response data storage
│   │   └── ui.js          # Web monitoring interface
│   └── utils/             # Utility functions
├── docs/                  # Documentation
├── examples/              # Configuration examples
│   ├── Dockerfile         # Docker container setup
│   ├── docker-compose.yml # Docker Compose configuration
│   └── pm2.config.js      # PM2 process management
├── package.json
├── README.md
├── .env.example           # Environment variables template
├── .gitignore
└── LICENSE
```

## ✨ Features

- 🚀 **Node.js-based proxy** for Anthropic API
- 📊 **Built-in monitoring dashboard** with real-time updates
- 🔒 **API key masking** for security
- 📈 **Performance metrics** and token usage tracking
- 🌊 **Streaming response** support with chunk analysis
- 💾 **Data export** and management capabilities
- 🐳 **Docker support** with examples
- ⚡ **Production ready** with PM2 configuration

## 🚀 Quick Start

### Option 1: Run directly from GitHub (Recommended)
```bash
# Run immediately without cloning
npx github:kingoliang/anthropic-proxy

# Or with custom configuration
PORT=3000 LOG_LEVEL=DEBUG npx github:kingoliang/anthropic-proxy
```

### Option 2: Clone and run locally
```bash
# Clone the repository
git clone https://github.com/kingoliang/anthropic-proxy.git
cd anthropic-proxy

# Install dependencies
npm install

# Configure environment (optional)
cp .env.example .env
# Edit .env file with your settings

# Run the server
npm start
# or
npx .
```

### Option 3: Global installation
```bash
# Install globally from GitHub
npm install -g github:kingoliang/anthropic-proxy

# Run anywhere
anthropic-proxy

# Or with environment variables
PORT=3000 LOG_LEVEL=DEBUG anthropic-proxy
```

### Option 4: Development mode
```bash
# Clone and link for development
git clone https://github.com/kingoliang/anthropic-proxy.git
cd anthropic-proxy
npm install
npm link

# Run from anywhere
anthropic-proxy
```

## Environment Configuration

Create a `.env` file or set environment variables:

```bash
# Anthropic API base URL
ANTHROPIC_BASE_URL=https://api.anthropic.com

# Server configuration
HOST=0.0.0.0
PORT=8082

# Request timeout (milliseconds)
REQUEST_TIMEOUT=120000

# Log level
LOG_LEVEL=INFO
```

## Usage Examples

```bash
# Run with custom port
PORT=3000 npx .

# Run in debug mode
LOG_LEVEL=DEBUG npx .

# Combine multiple environment variables
PORT=3000 LOG_LEVEL=DEBUG ANTHROPIC_BASE_URL=https://api.anthropic.com npx .
```

## API Endpoints

### Proxy Endpoints
- `POST /v1/messages` - Main messages endpoint (supports streaming)
- `POST /v1/messages/count_tokens` - Token counting endpoint
- `GET /health` - Health check
- `GET /` - API information

### Monitoring Endpoints
- `GET /monitor` - Web monitoring dashboard
- `GET /api/monitor/requests` - Get request list with filtering
- `GET /api/monitor/stats` - Get real-time statistics
- `GET /api/monitor/stream` - Server-sent events for real-time updates
- `POST /api/monitor/clear` - Clear all monitoring data
- `GET /api/monitor/export` - Export monitoring data as JSON

## Monitoring Dashboard

Access the built-in monitoring interface at: `http://localhost:8082/monitor`

### Features:
- **Real-time request/response tracking**
- **Performance metrics dashboard**
- **Stream chunk timeline visualization**
- **API key masking** for security
- **Advanced filtering** (status, model, time range)
- **Data export capabilities**
- **Auto-refresh with SSE**

### Dashboard Sections:
1. **Statistics Panel** - Total requests, success rate, average duration
2. **Request List** - Filterable table of all API calls
3. **Detail View** - Complete request/response inspection
4. **Stream Analysis** - Chunk-by-chunk streaming visualization
5. **Export Tools** - JSON data export functionality

## Security Notes

- API keys are automatically masked in logs and monitoring interface
- Shows first 10 characters + "..." + last 4 characters
- No authentication required for monitoring (local use)
- Sensitive headers are filtered in request logging

## Requirements

- **Node.js 18+**
- **API Key**: Client must provide API key via headers (`x-api-key` or `authorization`)
- **Network**: Outbound access to Anthropic API

## Technical Details

- **Framework**: Express.js with ES modules
- **Monitoring**: In-memory storage with circular buffer (max 1000 requests)
- **Real-time Updates**: Server-Sent Events (SSE)
- **Stream Processing**: Full chunk tracking and content merging
- **Error Handling**: Comprehensive error catching and logging

## 🐳 Production Deployment

### Docker
```bash
# Build and run with Docker
docker build -t anthropic-proxy .
docker run -p 8082:8082 -e ANTHROPIC_API_KEY=your_key anthropic-proxy

# Or use Docker Compose
docker-compose -f examples/docker-compose.yml up
```

### PM2 (Process Manager)
```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start examples/pm2.config.js

# Monitor
pm2 monit

# Stop
pm2 stop anthropic-proxy
```

### Systemd Service
```bash
# Create service file
sudo nano /etc/systemd/system/anthropic-proxy.service

# Add service configuration
[Unit]
Description=Anthropic API Proxy
After=network.target

[Service]
Type=simple
User=nodejs
WorkingDirectory=/path/to/anthropic-proxy
ExecStart=/usr/bin/node src/server.js
Restart=always
Environment=NODE_ENV=production
Environment=PORT=8082

[Install]
WantedBy=multi-user.target

# Enable and start
sudo systemctl enable anthropic-proxy
sudo systemctl start anthropic-proxy
```

## 🔧 Troubleshooting

### Common Issues:

1. **Port already in use**: Change PORT environment variable
2. **API key not working**: Verify key format and headers
3. **Timeout errors**: Increase REQUEST_TIMEOUT value
4. **Memory usage**: Monitoring data auto-rotates after 1000 requests
5. **Module not found**: Ensure you're running from the correct directory

### Debug Mode:
```bash
LOG_LEVEL=DEBUG npx github:kingoliang/anthropic-proxy
```

### Health Check:
```bash
curl http://localhost:8082/health
```

## 🔗 Related Links

- **GitHub Repository**: https://github.com/kingoliang/anthropic-proxy
- **NPM Package**: `npx github:kingoliang/anthropic-proxy`
- **Anthropic API Documentation**: https://docs.anthropic.com/
- **Docker Hub**: (coming soon)

## 🤝 Contributing

This proxy server is designed for development and testing purposes. Contributions are welcome:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- Built with [Express.js](https://expressjs.com/)
- Monitoring UI powered by [Alpine.js](https://alpinejs.dev/) and [Tailwind CSS](https://tailwindcss.com/)
- Generated with assistance from [Claude Code](https://claude.ai/code)