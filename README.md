# Anthropic API Proxy

A proxy server for forwarding requests to the Anthropic API, specifically designed for Claude Code.

## Features

- 🚀 **Node.js-based proxy** for Anthropic API
- 📊 **Built-in monitoring dashboard** with real-time updates
- 🔒 **API key masking** for security
- 📈 **Performance metrics** and token usage tracking
- 🌊 **Streaming response** support with chunk analysis
- 💾 **Data export** and management capabilities

## Quick Start

### Method 1: Run directly from local directory
```bash
# In the project directory
npx .

# Or specify a custom port
PORT=3000 npx .
```

### Method 2: Global installation
```bash
# Install globally
npm install -g .

# Run
anthropic-proxy

# Or with environment variables
PORT=3000 anthropic-proxy
```

### Method 3: Using npm link (development mode)
```bash
# Create global link in project directory
npm link

# Run
anthropic-proxy
```

### Method 4: Direct script execution
```bash
# Ensure execution permissions
chmod +x anthropic_proxy.js

# Run directly
./anthropic_proxy.js
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

## Troubleshooting

### Common Issues:

1. **Port already in use**: Change PORT environment variable
2. **API key not working**: Verify key format and headers
3. **Timeout errors**: Increase REQUEST_TIMEOUT value
4. **Memory usage**: Monitoring data auto-rotates after 1000 requests

### Debug Mode:
```bash
LOG_LEVEL=DEBUG npx .
```

## Contributing

This proxy server is designed for development and testing purposes. Feel free to extend with additional features or monitoring capabilities.

## License

MIT