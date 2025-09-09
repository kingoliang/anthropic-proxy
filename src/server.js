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
import { requestStore } from './monitor/store.js';
import { getMonitorHTML } from './monitor/ui.js';
import { analyzeRequests, generateAnalysisHTML } from './monitor/analysis.js';
import { configManager } from './config/manager.js';
import { getConfigHTML } from './config/ui.js';
import { OpenRouterHandler } from './routers/openrouter.js';

// Load environment variables
dotenv.config();

// Load configuration
const config = configManager.getConfig();
const ANTHROPIC_BASE_URL = config.anthropic.baseUrl;
const HOST = config.server.host;
const PORT = config.server.port;
const REQUEST_TIMEOUT = config.anthropic.timeout;
const LOG_LEVEL = config.server.logLevel;

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

// Initialize logger
const logger = new Logger(LOG_LEVEL);

// Initialize OpenRouter handler (always create it, we'll use it dynamically)
let openRouterHandler = new OpenRouterHandler(config, logger, requestStore, configManager);

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.raw({ type: 'application/octet-stream', limit: '50mb' }));

// Update OpenRouter handler with logger (no need to check null, always initialized)
openRouterHandler.logger = logger;

// Listen for configuration changes
configManager.addListener((newConfig) => {
  logger.info('Configuration updated, restart required for some changes');
  if (newConfig.proxyMode === 'openrouter') {
    // Always ensure we have a handler for OpenRouter mode
    if (!openRouterHandler) {
      openRouterHandler = new OpenRouterHandler(newConfig, logger, requestStore, configManager);
    } else {
      // Update existing handler configuration
      openRouterHandler.config = newConfig;
      openRouterHandler.converter.config = newConfig.openrouter;
    }
  } else if (newConfig.proxyMode === 'anthropic') {
    // Don't set to null, just keep it available but unused
    if (openRouterHandler) {
      openRouterHandler.config = newConfig;
    }
  }
});

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
 * Main messages endpoint - proxies to Anthropic API or OpenRouter
 */
app.post('/v1/messages', async (req, res) => {
  // Start monitoring this request
  const monitorId = requestStore.startRequest(req);
  req.monitorId = monitorId;
  
  // Check routing mode
  const currentConfig = configManager.getConfig();
  if (currentConfig.proxyMode === 'openrouter' && openRouterHandler) {
    // Route to OpenRouter
    if (req.body.stream) {
      return openRouterHandler.handleStreamingRequest(req, res);
    } else {
      return openRouterHandler.handleRequest(req, res);
    }
  }
  
  // Default: Route to Anthropic
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
    
    // Log COMPLETE request body (DEBUG only)
    logger.debug('Request Body (COMPLETE):');
    logger.debug(JSON.stringify(req.body, null, 2));
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
        logger.debug(`Response Headers: ${JSON.stringify(response.headers)}`);
        logger.debug(`Response Body: ${JSON.stringify(response.data)}`);
        logger.error('='.repeat(60));
        
        res.status(response.status).json(response.data);
        return;
      }
      
      // Log successful response
      logger.info('='.repeat(60));
      logger.info('✅ SUCCESSFUL RESPONSE FROM ANTHROPIC');
      logger.info(`Status Code: ${response.status}`);
      logger.debug(`Response Headers: ${JSON.stringify(response.headers)}`);
      logger.debug('Response Body (COMPLETE):');
      logger.debug(JSON.stringify(response.data, null, 2));
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
          // Log COMPLETE chunk content (DEBUG only)
          if (line.startsWith('data: ')) {
            const chunkData = line.substring(6);
            if (chunkData.trim() && chunkData.trim() !== '[DONE]') {
              logger.debug(`📤 Stream chunk: ${chunkData}`);
              collectedResponse.push(chunkData);
              
              // Add to monitor
              if (req.monitorId) {
                requestStore.addStreamChunk(req.monitorId, chunkData);
              }
            }
          }
          
          try {
            if (!streamDestroyed && !responseEnded) {
              res.write(`${line}\n`);
              if (line.startsWith('data: ')) {
                res.write('\n'); // Add extra newline after data lines for SSE format
              }
            }
          } catch (writeError) {
            logger.error(`Error writing to response: ${writeError.message}`);
            streamDestroyed = true;
            responseEnded = true;
          }
        }
      });
    });
    
    response.data.on('end', () => {
      if (responseEnded) return;
      
      // Process any remaining data in buffer
      if (buffer.trim() && !streamDestroyed && !responseEnded) {
        try {
          res.write(`${buffer}\n\n`);
        } catch (writeError) {
          logger.error(`Error writing final buffer: ${writeError.message}`);
          streamDestroyed = true;
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
        
        collectedResponse.forEach((chunkStr, index) => {
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
          } catch (parseError) {
            // Log JSON parse errors for debugging instead of silently ignoring
            logger.warn(`Failed to parse JSON chunk at index ${index}: ${parseError.message}`);
            logger.debug(`Invalid chunk content: ${chunkStr.substring(0, 200)}${chunkStr.length > 200 ? '...' : ''}`);
            
            // Optionally, we could collect malformed chunks for analysis
            if (req.monitorId) {
              requestStore.addStreamChunk(req.monitorId, {
                error: 'JSON_PARSE_ERROR',
                content: chunkStr,
                message: parseError.message
              });
            }
          }
        });
        
        // Output merged complete content as JSON (DEBUG only)
        logger.info('='.repeat(60));
        logger.info('🔗 MERGED COMPLETE CONTENT (JSON):');
        
        const mergedContent = {
          completeText: fullTextParts.join(''),
          totalCharacters: fullTextParts.join('').length,
          toolCalls: toolCalls,
          messageComplete: messageComplete,
          timestamp: new Date().toISOString()
        };
        
        logger.debug(JSON.stringify(mergedContent, null, 2));
        
        // Save merged content to monitor
        if (req.monitorId) {
          requestStore.setMergedContent(req.monitorId, mergedContent);
        }
        
        // Also log individual chunks for debugging (DEBUG only)
        logger.debug('='.repeat(60));
        logger.debug('📦 INDIVIDUAL CHUNKS (for debugging):');
        collectedResponse.forEach((chunk, i) => {
          logger.debug(`Chunk ${i + 1}: ${chunk}`);
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
      if (!streamDestroyed && !responseEnded) {
        try {
          res.write(`data: ${JSON.stringify({
            type: 'error',
            error: { type: 'stream_error', message: error.message }
          })}\n\n`);
        } catch (writeError) {
          logger.error(`Error writing error message: ${writeError.message}`);
          streamDestroyed = true;
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
      
      if (!streamDestroyed && !responseEnded) {
        try {
          res.write(`data: ${JSON.stringify({
            type: 'error',
            error: { type: 'stream_error', message: error.message }
          })}\n\n`);
        } catch (writeError) {
          logger.error(`Error writing error response: ${writeError.message}`);
          streamDestroyed = true;
        }
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
    logger.debug('Request (COMPLETE):');
    logger.debug(JSON.stringify(req.body, null, 2));
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
    logger.debug('Result (COMPLETE):');
    logger.debug(JSON.stringify(response.data, null, 2));
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
  res.redirect('/monitor');
});


// Configuration UI
app.get('/config', (req, res) => {
  res.send(getConfigHTML());
});

// Configuration API endpoints
app.get('/api/config', (req, res) => {
  res.json(configManager.getConfig());
});

app.post('/api/config', (req, res) => {
  try {
    const updatedConfig = configManager.updateConfig(req.body);
    res.json(updatedConfig);
  } catch (error) {
    logger.error('Error updating config:', error);
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/config/reset', (req, res) => {
  try {
    const config = configManager.resetToDefaults();
    res.json(config);
  } catch (error) {
    logger.error('Error resetting config:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/config/test-openrouter', async (req, res) => {
  try {
    const { apiKey } = req.body;
    const isValid = await configManager.validateOpenRouterKey(apiKey);
    res.json({ success: isValid });
  } catch (error) {
    logger.error('Error testing OpenRouter connection:', error);
    res.json({ success: false, error: error.message });
  }
});

app.get('/api/config/models', async (req, res) => {
  try {
    const models = await configManager.getAvailableModels();
    res.json(models);
  } catch (error) {
    logger.error('Error fetching models:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reload configuration endpoint
app.post('/api/config/reload', (req, res) => {
  try {
    const reloadedConfig = configManager.reloadConfig();
    logger.info('Configuration reloaded successfully');
    res.json({ 
      success: true, 
      message: 'Configuration reloaded successfully',
      config: reloadedConfig
    });
  } catch (error) {
    logger.error('Error reloading config:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
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

app.get('/api/monitor/config', (req, res) => {
  res.json({
    logLevel: LOG_LEVEL,
    port: PORT,
    host: HOST
  });
});

app.get('/api/monitor/stats', (req, res) => {
  try {
    // Get filters from query parameters
    const filters = {
      status: req.query.status,
      model: req.query.model,
      timeRange: req.query.timeRange
    };
    
    // Remove empty filters
    Object.keys(filters).forEach(key => {
      if (!filters[key]) delete filters[key];
    });
    
    let stats;
    if (Object.keys(filters).length > 0) {
      // Calculate stats for filtered data
      const filteredRequests = requestStore.getAll(filters);
      const requests = filteredRequests.data || [];
      
      let successCount = 0;
      let errorCount = 0;
      let totalDuration = 0;
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      
      requests.forEach(request => {
        const responseStatus = request.response?.status;
        if (responseStatus >= 200 && responseStatus < 300 || request.status === 'success') {
          successCount++;
        } else if (responseStatus >= 400 || request.status === 'error' || request.error) {
          errorCount++;
        }
        
        totalDuration += request.metrics?.duration || 0;
        totalInputTokens += request.metrics?.inputTokens || 0;
        totalOutputTokens += request.metrics?.outputTokens || 0;
      });
      
      const avgDuration = requests.length > 0 ? Math.round(totalDuration / requests.length) : 0;
      const successRate = requests.length > 0 ? ((successCount / requests.length) * 100).toFixed(2) : 0;
      const activeRequests = requests.filter(r => r.status === 'pending').length;
      
      stats = {
        totalRequests: requests.length,
        successCount: successCount,
        errorCount: errorCount,
        successRate: successRate + '%',
        avgDuration: avgDuration + 'ms',
        totalInputTokens: totalInputTokens,
        totalOutputTokens: totalOutputTokens,
        activeRequests: activeRequests
      };
    } else {
      // Use global stats
      stats = requestStore.getStats();
    }
    
    res.json(stats);
  } catch (error) {
    logger.error(`Monitor API error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/monitor/export', (req, res) => {
  try {
    // Get filtered data based on query parameters
    const filters = {
      status: req.query.status,
      model: req.query.model,
      timeRange: req.query.timeRange
    };
    
    // Remove empty filters
    Object.keys(filters).forEach(key => {
      if (!filters[key]) delete filters[key];
    });
    
    const filteredRequests = requestStore.getAll(filters);
    
    // Export filtered data
    const exportData = {
      stats: requestStore.getStats(),
      requests: filteredRequests.data,
      total: filteredRequests.total,
      filters: filters,
      exportTime: new Date().toISOString()
    };
    
    const filterSuffix = Object.keys(filters).length > 0 ? '-filtered' : '';
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="proxy-monitor${filterSuffix}-${Date.now()}.json"`);
    res.json(exportData);
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

app.get('/api/monitor/analyze', (req, res) => {
  try {
    logger.info('Generating analysis report...');
    
    // Get filters from query parameters
    const filters = {
      status: req.query.status,
      model: req.query.model,
      timeRange: req.query.timeRange
    };
    
    // Remove empty filters
    Object.keys(filters).forEach(key => {
      if (!filters[key]) delete filters[key];
    });
    
    const analysisData = analyzeRequests(filters);
    const htmlReport = generateAnalysisHTML(analysisData, filters);
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(htmlReport);
    
    const filterInfo = Object.keys(filters).length > 0 ? ` with filters: ${JSON.stringify(filters)}` : '';
    logger.info(`Analysis report generated with ${analysisData.requests.length} requests${filterInfo}`);
  } catch (error) {
    logger.error(`Analysis generation error: ${error.message}`, error.stack);
    res.status(500).json({ 
      error: 'Failed to generate analysis report',
      message: error.message 
    });
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
  let isShuttingDown = false;
  
  const gracefulShutdown = (signal) => {
    if (isShuttingDown) {
      logger.warn('Force shutdown - exiting immediately');
      process.exit(1);
    }
    
    isShuttingDown = true;
    logger.info(`${signal} signal received: starting graceful shutdown`);
    
    // Set a timeout to force exit if graceful shutdown takes too long
    const forceExitTimeout = setTimeout(() => {
      logger.error('Graceful shutdown timeout - forcing exit');
      process.exit(1);
    }, 10000); // 10 seconds timeout
    
    server.close((err) => {
      clearTimeout(forceExitTimeout);
      if (err) {
        logger.error('Error during server shutdown:', err);
        process.exit(1);
      }
      logger.info('HTTP server closed successfully');
      process.exit(0);
    });
    
    // Also close any active connections
    if (server.closeAllConnections) {
      server.closeAllConnections();
    }
  };
  
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', err);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('UNHANDLED_REJECTION');
  });
}

// Run the server
main();