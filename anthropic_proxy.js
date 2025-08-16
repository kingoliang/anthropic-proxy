#!/usr/bin/env node

/**
 * Anthropic API Proxy Server
 * Forwards requests from local port 8082 to https://api.anthropic.com
 * Maintains Claude Code compatible format
 */

import express from 'express';
import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Readable } from 'stream';
import { requestStore } from './monitor.js';
import { getMonitorHTML } from './monitor-ui.js';

// Load environment variables
dotenv.config();

// Configuration
const ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
const HOST = process.env.HOST || '0.0.0.0';
const PORT = parseInt(process.env.PORT || '8082');
const REQUEST_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT || '120000'); // in milliseconds
const LOG_LEVEL = process.env.LOG_LEVEL || 'INFO';

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.raw({ type: 'application/octet-stream', limit: '50mb' }));

// Logging utility
class Logger {
  constructor(level = 'INFO') {
    this.levels = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
    this.currentLevel = this.levels[level.toUpperCase()] || 1;
  }

  log(level, ...messages) {
    if (this.levels[level] >= this.currentLevel) {
      const timestamp = new Date().toISOString();
      console.log(`${timestamp} - ${level} -`, ...messages);
    }
  }

  debug(...messages) {
    this.log('DEBUG', ...messages);
  }

  info(...messages) {
    this.log('INFO', ...messages);
  }

  warn(...messages) {
    this.log('WARN', ...messages);
  }

  error(...messages) {
    this.log('ERROR', ...messages);
  }
}

const logger = new Logger(LOG_LEVEL);

/**
 * Extract headers to forward from the incoming request
 */
function getForwardedHeaders(req) {
  const forwardedHeaders = {};
  
  // Headers to forward from Claude Code
  const headersToForward = [
    'x-api-key',
    'anthropic-version',
    'anthropic-beta',
    'authorization',
    'user-agent'
  ];
  
  headersToForward.forEach(headerName => {
    const headerValue = req.headers[headerName];
    if (headerValue) {
      forwardedHeaders[headerName] = headerValue;
    }
  });
  
  // Ensure anthropic-version is set
  if (!forwardedHeaders['anthropic-version']) {
    forwardedHeaders['anthropic-version'] = '2023-06-01';
  }
  
  // Ensure content-type is set
  forwardedHeaders['content-type'] = 'application/json';
  
  return forwardedHeaders;
}

/**
 * Main messages endpoint - proxies to Anthropic API
 */
app.post('/v1/messages', async (req, res) => {
  // Start monitoring this request
  const monitorId = requestStore.startRequest(req);
  req.monitorId = monitorId;
  try {
    // Log incoming request details
    logger.info('='.repeat(60));
    logger.info('📥 INCOMING REQUEST FROM CLAUDE CODE');
    logger.info(`Model: ${req.body.model}`);
    logger.info(`Stream: ${req.body.stream}`);
    logger.info(`Max Tokens: ${req.body.max_tokens}`);
    logger.info(`Temperature: ${req.body.temperature}`);
    
    // Log headers
    logger.info('Headers from Claude Code:');
    Object.entries(req.headers).forEach(([headerName, headerValue]) => {
      if (['x-api-key', 'authorization'].includes(headerName.toLowerCase())) {
        // Mask sensitive data
        const maskedValue = headerValue.length > 10 
          ? headerValue.substring(0, 10) + '...' 
          : headerValue;
        logger.info(`  ${headerName}: ${maskedValue}`);
      } else {
        logger.info(`  ${headerName}: ${headerValue}`);
      }
    });
    
    // Forward all headers from Claude Code
    const headers = getForwardedHeaders(req);
    
    // Log COMPLETE request body
    logger.info('Request Body (COMPLETE):');
    logger.info(JSON.stringify(req.body, null, 2));
    logger.info('='.repeat(60));
    
    if (req.body.stream) {
      // Handle streaming response
      handleStreamingResponse(headers, req.body, req, res);
    } else {
      // Handle non-streaming response
      const response = await axios.post(
        `${ANTHROPIC_BASE_URL}/v1/messages`,
        req.body,
        {
          headers,
          timeout: REQUEST_TIMEOUT,
          validateStatus: null // Don't throw on non-2xx status
        }
      );
      
      if (response.status !== 200) {
        logger.error('='.repeat(60));
        logger.error('❌ ERROR RESPONSE FROM ANTHROPIC');
        logger.error(`Status Code: ${response.status}`);
        logger.error(`Response Headers: ${JSON.stringify(response.headers)}`);
        logger.error(`Response Body: ${JSON.stringify(response.data)}`);
        logger.error('='.repeat(60));
        
        res.status(response.status).json(response.data);
        return;
      }
      
      // Log successful response
      logger.info('='.repeat(60));
      logger.info('✅ SUCCESSFUL RESPONSE FROM ANTHROPIC');
      logger.info(`Status Code: ${response.status}`);
      logger.info(`Response Headers: ${JSON.stringify(response.headers)}`);
      logger.info('Response Body (COMPLETE):');
      logger.info(JSON.stringify(response.data, null, 2));
      logger.info('='.repeat(60));
      
      // Update monitor with response
      requestStore.endRequest(req.monitorId, {
        status: response.status,
        headers: response.headers,
        body: response.data
      });
      
      res.json(response.data);
    }
  } catch (error) {
    // Log error to monitor
    if (req.monitorId) {
      requestStore.setError(req.monitorId, error);
    }
    
    if (error.code === 'ECONNABORTED') {
      logger.error('Request to Anthropic API timed out');
      res.status(504).json({ error: 'Request timeout' });
    } else if (error.request) {
      logger.error(`Network error: ${error.message}`);
      res.status(502).json({ error: `Network error: ${error.message}` });
    } else {
      logger.error(`Unexpected error: ${error.message}`, error.stack);
      res.status(500).json({ error: `Internal server error: ${error.message}` });
    }
  }
});

/**
 * Handle streaming response from Anthropic API
 */
async function handleStreamingResponse(headers, requestData, req, res) {
  let responseEnded = false;
  let streamDestroyed = false;
  
  try {
    logger.info('='.repeat(60));
    logger.info('🔄 STARTING STREAMING RESPONSE');
    logger.info(`Forwarding to: ${ANTHROPIC_BASE_URL}/v1/messages`);
    logger.info(`Headers being sent: ${JSON.stringify(headers)}`);
    logger.info('='.repeat(60));
    
    const collectedResponse = []; // Collect response chunks for logging
    
    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*'
    });
    
    const response = await axios.post(
      `${ANTHROPIC_BASE_URL}/v1/messages`,
      requestData,
      {
        headers,
        timeout: REQUEST_TIMEOUT,
        responseType: 'stream',
        validateStatus: null
      }
    );
    
    if (response.status !== 200) {
      const errorChunks = [];
      response.data.on('data', chunk => errorChunks.push(chunk));
      response.data.on('end', () => {
        if (responseEnded) return;
        const errorText = Buffer.concat(errorChunks).toString();
        logger.error('='.repeat(60));
        logger.error('❌ STREAMING ERROR FROM ANTHROPIC');
        logger.error(`Status Code: ${response.status}`);
        logger.error(`Error Body: ${errorText}`);
        logger.error('='.repeat(60));
        
        if (!res.headersSent) {
          res.writeHead(response.status, { 'Content-Type': 'text/event-stream' });
        }
        res.write(`data: ${JSON.stringify({
          type: 'error',
          error: { type: 'api_error', message: errorText }
        })}\n\n`);
        res.end();
        responseEnded = true;
      });
      return;
    }
    
    let buffer = '';
    
    response.data.on('data', chunk => {
      if (responseEnded || streamDestroyed) return;
      
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep incomplete line in buffer
      
      lines.forEach(line => {
        if (responseEnded || streamDestroyed) return;
        
        if (line.trim()) {
          // Log COMPLETE chunk content
          if (line.startsWith('data: ')) {
            const chunkData = line.substring(6);
            if (chunkData.trim() && chunkData.trim() !== '[DONE]') {
              logger.info(`📤 Stream chunk: ${chunkData}`);
              collectedResponse.push(chunkData);
              
              // Add to monitor
              if (req.monitorId) {
                requestStore.addStreamChunk(req.monitorId, chunkData);
              }
            }
          }
          
          try {
            res.write(`${line}\n`);
            if (line.startsWith('data: ')) {
              res.write('\n'); // Add extra newline after data lines for SSE format
            }
          } catch (writeError) {
            logger.error(`Error writing to response: ${writeError.message}`);
            streamDestroyed = true;
          }
        }
      });
    });
    
    response.data.on('end', () => {
      if (responseEnded) return;
      
      // Process any remaining data in buffer
      if (buffer.trim() && !streamDestroyed) {
        try {
          res.write(`${buffer}\n\n`);
        } catch (writeError) {
          logger.error(`Error writing final buffer: ${writeError.message}`);
        }
      }
      
      logger.info('='.repeat(60));
      logger.info('✅ STREAMING COMPLETED');
      logger.info(`Total chunks received: ${collectedResponse.length}`);
      
      // Log COMPLETE aggregated response
      if (collectedResponse.length > 0) {
        logger.info('='.repeat(60));
        logger.info('📝 STREAMING RESPONSE ANALYSIS:');
        
        // Reconstruct full response content from all chunks
        const fullTextParts = [];
        const toolCalls = [];
        let messageComplete = false;
        
        collectedResponse.forEach(chunkStr => {
          try {
            const chunk = JSON.parse(chunkStr);
            
            // Handle different chunk types
            if (chunk.type === 'content_block_delta') {
              const delta = chunk.delta || {};
              if (delta.type === 'text_delta' && delta.text) {
                fullTextParts.push(delta.text);
              } else if (delta.type === 'input_json_delta' && delta.partial_json) {
                // Tool use input
                fullTextParts.push(delta.partial_json);
              }
            } else if (chunk.type === 'content_block_start') {
              const contentBlock = chunk.content_block || {};
              if (contentBlock.type === 'tool_use') {
                toolCalls.push({
                  id: contentBlock.id,
                  name: contentBlock.name,
                  input: ''
                });
              }
            } else if (chunk.type === 'message_stop') {
              messageComplete = true;
            }
          } catch (e) {
            // Ignore parse errors
          }
        });
        
        // Output merged complete content as JSON
        logger.info('='.repeat(60));
        logger.info('🔗 MERGED COMPLETE CONTENT (JSON):');
        
        const mergedContent = {
          completeText: fullTextParts.join(''),
          totalCharacters: fullTextParts.join('').length,
          toolCalls: toolCalls,
          messageComplete: messageComplete,
          timestamp: new Date().toISOString()
        };
        
        logger.info(JSON.stringify(mergedContent, null, 2));
        
        // Save merged content to monitor
        if (req.monitorId) {
          requestStore.setMergedContent(req.monitorId, mergedContent);
        }
        
        // Also log individual chunks for debugging
        logger.info('='.repeat(60));
        logger.info('📦 INDIVIDUAL CHUNKS (for debugging):');
        collectedResponse.forEach((chunk, i) => {
          logger.info(`Chunk ${i + 1}: ${chunk}`);
        });
      }
      
      logger.info('='.repeat(60));
      
      if (!responseEnded && !streamDestroyed) {
        res.end();
        responseEnded = true;
        
        // Mark request as completed in monitor
        if (req.monitorId) {
          requestStore.endRequest(req.monitorId, {
            status: 200,
            headers: response.headers,
            body: { streaming: true, chunks: collectedResponse.length }
          });
        }
      }
    });
    
    response.data.on('error', error => {
      if (responseEnded) return;
      
      logger.error(`Stream error: ${error.message}`);
      if (!streamDestroyed) {
        try {
          res.write(`data: ${JSON.stringify({
            type: 'error',
            error: { type: 'stream_error', message: error.message }
          })}\n\n`);
        } catch (writeError) {
          logger.error(`Error writing error message: ${writeError.message}`);
        }
      }
      
      if (!responseEnded) {
        res.end();
        responseEnded = true;
      }
    });
    
    // Handle client disconnect
    req.on('close', () => {
      logger.info('Client disconnected, stopping stream');
      responseEnded = true;
      streamDestroyed = true;
      if (response && response.data) {
        response.data.destroy();
      }
    });
    
    // Handle response errors
    res.on('error', (error) => {
      logger.error(`Response error: ${error.message}`);
      responseEnded = true;
      streamDestroyed = true;
    });
    
  } catch (error) {
    logger.error(`Streaming error: ${error.message}`, error.stack);
    
    if (!responseEnded && !streamDestroyed) {
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/event-stream' });
      }
      
      try {
        res.write(`data: ${JSON.stringify({
          type: 'error',
          error: { type: 'stream_error', message: error.message }
        })}\n\n`);
      } catch (writeError) {
        logger.error(`Error writing error response: ${writeError.message}`);
      }
      
      res.end();
      responseEnded = true;
    }
  }
}

/**
 * Token counting endpoint
 */
app.post('/v1/messages/count_tokens', async (req, res) => {
  try {
    logger.info('='.repeat(60));
    logger.info('🔢 TOKEN COUNT REQUEST');
    logger.info('Request (COMPLETE):');
    logger.info(JSON.stringify(req.body, null, 2));
    logger.info('='.repeat(60));
    
    // Forward all headers from Claude Code
    const headers = getForwardedHeaders(req);
    
    const response = await axios.post(
      `${ANTHROPIC_BASE_URL}/v1/messages/count_tokens`,
      req.body,
      {
        headers,
        timeout: 30000,
        validateStatus: null
      }
    );
    
    if (response.status !== 200) {
      logger.error(`Token count error: ${response.status} - ${JSON.stringify(response.data)}`);
      res.status(response.status).json(response.data);
      return;
    }
    
    logger.info('='.repeat(60));
    logger.info('✅ TOKEN COUNT RESPONSE');
    logger.info('Result (COMPLETE):');
    logger.info(JSON.stringify(response.data, null, 2));
    logger.info('='.repeat(60));
    
    res.json(response.data);
  } catch (error) {
    logger.error(`Token counting error: ${error.message}`, error.stack);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    anthropic_base_url: ANTHROPIC_BASE_URL,
    proxy_version: '1.0.0'
  });
});

/**
 * Root endpoint with API information
 */
app.get('/', (req, res) => {
  res.json({
    message: 'Anthropic API Proxy',
    status: 'running',
    version: '1.0.0',
    endpoints: {
      messages: '/v1/messages',
      count_tokens: '/v1/messages/count_tokens',
      health: '/health',
      monitor: '/monitor'
    },
    configuration: {
      target_api: ANTHROPIC_BASE_URL,
      timeout: REQUEST_TIMEOUT
    }
  });
});


// Monitor API endpoints
app.get('/monitor', (req, res) => {
  res.send(getMonitorHTML());
});

app.get('/api/monitor/requests', (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      model: req.query.model,
      timeRange: req.query.timeRange,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 50
    };
    
    const result = requestStore.getAll(filters);
    res.json(result);
  } catch (error) {
    logger.error(`Monitor API error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/monitor/requests/:id', (req, res) => {
  try {
    const request = requestStore.getById(req.params.id);
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }
    res.json(request);
  } catch (error) {
    logger.error(`Monitor API error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/monitor/stats', (req, res) => {
  try {
    const stats = requestStore.getStats();
    res.json(stats);
  } catch (error) {
    logger.error(`Monitor API error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/monitor/export', (req, res) => {
  try {
    const data = requestStore.export();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="proxy-monitor-${Date.now()}.json"`);
    res.json(data);
  } catch (error) {
    logger.error(`Monitor API error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/monitor/clear', (req, res) => {
  try {
    requestStore.clear();
    res.json({ success: true });
  } catch (error) {
    logger.error(`Monitor API error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Server-Sent Events for real-time updates
app.get('/api/monitor/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*'
  });
  
  // Send initial stats
  const stats = requestStore.getStats();
  res.write(`data: ${JSON.stringify({ type: 'stats', stats })}\n\n`);
  
  // Set up event listeners
  const onRequestStart = (request) => {
    res.write(`data: ${JSON.stringify({ type: 'request', request })}\n\n`);
  };
  
  const onRequestEnd = (request) => {
    res.write(`data: ${JSON.stringify({ type: 'request', request })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: 'stats', stats: requestStore.getStats() })}\n\n`);
  };
  
  const onRequestError = (request) => {
    res.write(`data: ${JSON.stringify({ type: 'request', request })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: 'stats', stats: requestStore.getStats() })}\n\n`);
  };
  
  const onStreamChunk = ({ id, chunk }) => {
    const request = requestStore.getById(id);
    if (request) {
      res.write(`data: ${JSON.stringify({ type: 'request', request })}\n\n`);
    }
  };
  
  // Register listeners
  requestStore.on('requestStart', onRequestStart);
  requestStore.on('requestEnd', onRequestEnd);
  requestStore.on('requestError', onRequestError);
  requestStore.on('streamChunk', onStreamChunk);
  
  // Clean up on client disconnect
  req.on('close', () => {
    requestStore.off('requestStart', onRequestStart);
    requestStore.off('requestEnd', onRequestEnd);
    requestStore.off('requestError', onRequestError);
    requestStore.off('streamChunk', onStreamChunk);
  });
  
  // Keep connection alive
  const keepAlive = setInterval(() => {
    res.write(': keep-alive\n\n');
  }, 30000);
  
  req.on('close', () => {
    clearInterval(keepAlive);
  });
});

/**
 * Start the server
 */
function main() {
  console.log('='.repeat(60));
  console.log('🚀 Anthropic API Proxy Server');
  console.log('='.repeat(60));
  console.log('✅ Configuration:');
  console.log(`   Target API: ${ANTHROPIC_BASE_URL}`);
  console.log(`   Timeout: ${REQUEST_TIMEOUT}ms`);
  console.log(`   Server: http://${HOST}:${PORT}`);
  console.log(`   Monitor: http://${HOST}:${PORT}/monitor`);
  console.log('='.repeat(60));
  console.log('ℹ️  Note: Client must provide API key via headers');
  console.log('='.repeat(60));
  console.log();
  
  const server = createServer(app);
  
  server.listen(PORT, HOST, () => {
    logger.info(`Server is running on http://${HOST}:${PORT}`);
  });
  
  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM signal received: closing HTTP server');
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
  });
  
  process.on('SIGINT', () => {
    logger.info('SIGINT signal received: closing HTTP server');
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
  });
}

// Run the server
main();