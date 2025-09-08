/**
 * OpenRouter Request Handler
 * Handles requests routed through OpenRouter
 */

import axios from 'axios';
import { OpenRouterConverter } from '../converters/openrouter.js';

export class OpenRouterHandler {
  constructor(config, logger, requestStore, configManager = null) {
    this.config = config;
    this.logger = logger;
    this.requestStore = requestStore;
    this.configManager = configManager;
    this.converter = new OpenRouterConverter(config.openrouter, configManager);
  }

  /**
   * Get current configuration (fresh from config manager if available)
   */
  getCurrentConfig() {
    if (this.configManager) {
      return this.configManager.getConfig();
    }
    return this.config;
  }

  /**
   * Handle non-streaming request
   */
  async handleRequest(req, res) {
    const monitorId = req.monitorId;
    
    try {
      // Log incoming request
      this.logger.info('='.repeat(60));
      this.logger.info('🔄 ROUTING TO OPENROUTER');
      this.logger.info(`Original Model: ${req.body.model}`);
      
      // Convert request to OpenRouter format
      const openRouterRequest = this.converter.convertRequest(req.body);
      const currentConfig = this.getCurrentConfig();
      this.logger.info(`Mapped Model: ${openRouterRequest.model}`);
      this.logger.info(`Forwarding to: ${currentConfig.openrouter.baseUrl}/v1/chat/completions`);
      this.logger.debug('OpenRouter Request:', JSON.stringify(openRouterRequest, null, 2));
      
      // Get headers for OpenRouter
      const headers = this.converter.getHeaders(req.headers);
      this.logger.info('Headers being sent:', JSON.stringify(headers));
      
      // Make request to OpenRouter  
      const response = await axios.post(
        `${currentConfig.openrouter.baseUrl}/v1/chat/completions`,
        openRouterRequest,
        {
          headers,
          timeout: currentConfig.anthropic.timeout || 120000,
          validateStatus: null
        }
      );
      
      if (response.status !== 200) {
        this.logger.error('='.repeat(60));
        this.logger.error('❌ ERROR RESPONSE FROM OPENROUTER');
        this.logger.error(`Status Code: ${response.status}`);
        this.logger.debug(`Response: ${JSON.stringify(response.data)}`);
        this.logger.error('='.repeat(60));
        
        res.status(response.status).json({
          error: response.data.error || response.data
        });
        return;
      }
      
      // Convert response back to Anthropic format
      const anthropicResponse = this.converter.convertResponse(response.data);
      
      this.logger.info('='.repeat(60));
      this.logger.info('✅ SUCCESSFUL RESPONSE FROM OPENROUTER');
      this.logger.info('📥 OpenRouter Raw Response:');
      this.logger.info(JSON.stringify(response.data, null, 2));
      this.logger.info('-'.repeat(40));
      this.logger.info('📤 Converted Anthropic Response:');
      this.logger.info(JSON.stringify(anthropicResponse, null, 2));
      this.logger.info('='.repeat(60));
      
      // Update monitor
      if (monitorId) {
        this.requestStore.endRequest(monitorId, {
          status: response.status,
          headers: response.headers,
          body: anthropicResponse,
          provider: 'openrouter'
        });
      }
      
      res.json(anthropicResponse);
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  /**
   * Handle streaming request
   */
  async handleStreamingRequest(req, res) {
    const monitorId = req.monitorId;
    let responseEnded = false;
    let streamDestroyed = false;
    
    try {
      this.logger.info('='.repeat(60));
      this.logger.info('🔄 STARTING STREAMING TO OPENROUTER');
      this.logger.info(`Original Model: ${req.body.model}`);
      
      // Convert request
      const openRouterRequest = this.converter.convertRequest(req.body);
      this.logger.info(`Mapped Model: ${openRouterRequest.model}`);
      this.logger.info(`Forwarding to: ${this.getCurrentConfig().openrouter.baseUrl}/v1/chat/completions`);
      
      // Get headers
      const headers = this.converter.getHeaders(req.headers);
      this.logger.info('Headers being sent:', JSON.stringify(headers));
      
      // Set SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*'
      });
      
      // Make streaming request to OpenRouter
      const currentConfig = this.getCurrentConfig();
      const response = await axios.post(
        `${currentConfig.openrouter.baseUrl}/v1/chat/completions`,
        openRouterRequest,
        {
          headers,
          timeout: currentConfig.anthropic.timeout || 120000,
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
          this.logger.error('Streaming error from OpenRouter:', errorText);
          
          res.write(`data: ${JSON.stringify({
            type: 'error',
            error: { type: 'api_error', message: errorText }
          })}\n\n`);
          res.end();
          responseEnded = true;
        });
        return;
      }
      
      // Create unique message ID
      const messageId = 'msg_' + Math.random().toString(36).substr(2, 24);
      
      // Send initial message_start event
      this.sendSSE(res, 'message_start', {
        type: 'message_start',
        message: {
          id: messageId,
          type: 'message',
          role: 'assistant',
          model: openRouterRequest.model,
          content: [],
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 0, output_tokens: 0 }
        }
      });
      
      // Send initial ping
      this.sendSSE(res, 'ping', { type: 'ping' });
      
      let buffer = '';
      let contentIndex = 0;
      let textBlockStarted = false;
      let toolCallsStarted = {};
      let accumulatedContent = '';
      let usage = null;
      let mappedModel = openRouterRequest.model;
      
      response.data.on('data', chunk => {
        if (responseEnded || streamDestroyed) return;
        
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop();
        
        lines.forEach(line => {
          if (responseEnded || streamDestroyed) return;
          
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) return;
          
          const dataStr = trimmed.replace(/^data:\s*/, '');
          if (dataStr === '[DONE]') {
            // Send final events
            if (textBlockStarted || Object.keys(toolCallsStarted).length > 0) {
              const indices = textBlockStarted ? [0] : Object.keys(toolCallsStarted).map(Number);
              indices.forEach(idx => {
                this.sendSSE(res, 'content_block_stop', {
                  type: 'content_block_stop',
                  index: idx
                });
              });
            }
            
            this.sendSSE(res, 'message_delta', {
              type: 'message_delta',
              delta: {
                stop_reason: Object.keys(toolCallsStarted).length > 0 ? 'tool_use' : 'end_turn',
                stop_sequence: null
              },
              usage: usage ? { output_tokens: usage.completion_tokens } : { output_tokens: 0 }
            });
            
            this.sendSSE(res, 'message_stop', { type: 'message_stop' });
            
            if (!responseEnded) {
              res.end();
              responseEnded = true;
              
              // Log accumulated streaming content
              this.logger.info('='.repeat(60));
              this.logger.info('✅ STREAMING COMPLETED FROM OPENROUTER');
              this.logger.info('📥 OpenRouter Raw Streaming Response:');
              
              // Construct raw OpenRouter response format
              const rawOpenRouterResponse = {
                id: 'chatcmpl-' + Math.random().toString(36).substr(2, 24),
                object: 'chat.completion',
                created: Math.floor(Date.now() / 1000),
                model: mappedModel,
                choices: [{
                  index: 0,
                  message: {
                    role: 'assistant',
                    content: accumulatedContent,
                    tool_calls: Object.keys(toolCallsStarted).length > 0 ? 
                      Object.keys(toolCallsStarted).map(idx => ({
                        id: 'call_' + idx,
                        type: 'function',
                        function: { name: 'unknown', arguments: '{}' }
                      })) : undefined
                  },
                  finish_reason: Object.keys(toolCallsStarted).length > 0 ? 'tool_calls' : 'stop'
                }],
                usage: usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
              };
              
              this.logger.info(JSON.stringify(rawOpenRouterResponse, null, 2));
              this.logger.info('-'.repeat(40));
              this.logger.info('📤 Converted Anthropic Response:');
              
              const anthropicResponse = {
                id: 'stream_' + Math.random().toString(36).substr(2, 24),
                type: 'message',
                role: 'assistant',
                content: [{
                  type: 'text',
                  text: accumulatedContent
                }],
                model: mappedModel,
                stop_reason: Object.keys(toolCallsStarted).length > 0 ? 'tool_use' : 'end_turn',
                stop_sequence: null,
                usage: usage || { input_tokens: 0, output_tokens: 0 }
              };
              
              this.logger.info(JSON.stringify(anthropicResponse, null, 2));
              this.logger.info('='.repeat(60));
              
              // Update monitor with accumulated content
              if (monitorId) {
                this.requestStore.endRequest(monitorId, {
                  status: 200,
                  headers: response.headers,
                  body: {
                    id: 'stream_' + Math.random().toString(36).substr(2, 24),
                    type: 'message',
                    role: 'assistant',
                    content: [{
                      type: 'text',
                      text: accumulatedContent
                    }],
                    model: mappedModel,
                    stop_reason: Object.keys(toolCallsStarted).length > 0 ? 'tool_use' : 'end_turn',
                    stop_sequence: null,
                    usage: usage || { input_tokens: 0, output_tokens: 0 },
                    provider: 'openrouter'
                  }
                });
              }
            }
            return;
          }
          
          try {
            const parsed = JSON.parse(dataStr);
            
            // Log raw streaming chunk from OpenRouter
            this.logger.debug('📥 OpenRouter Stream Chunk:', JSON.stringify(parsed, null, 2));
            
            if (parsed.usage) {
              usage = parsed.usage;
            }
            
            const delta = parsed.choices?.[0]?.delta;
            if (!delta) return;
            
            // Handle text content
            if (delta.content) {
              if (!textBlockStarted) {
                textBlockStarted = true;
                this.sendSSE(res, 'content_block_start', {
                  type: 'content_block_start',
                  index: 0,
                  content_block: {
                    type: 'text',
                    text: ''
                  }
                });
              }
              
              accumulatedContent += delta.content;
              this.sendSSE(res, 'content_block_delta', {
                type: 'content_block_delta',
                index: 0,
                delta: {
                  type: 'text_delta',
                  text: delta.content
                }
              });
              
              // Add to monitor
              if (monitorId) {
                this.requestStore.addStreamChunk(monitorId, dataStr);
              }
            }
            
            // Handle tool calls
            if (delta.tool_calls) {
              delta.tool_calls.forEach(toolCall => {
                const idx = toolCall.index || contentIndex++;
                
                if (!toolCallsStarted[idx]) {
                  toolCallsStarted[idx] = true;
                  this.sendSSE(res, 'content_block_start', {
                    type: 'content_block_start',
                    index: idx,
                    content_block: {
                      type: 'tool_use',
                      id: toolCall.id,
                      name: toolCall.function?.name,
                      input: {}
                    }
                  });
                }
                
                if (toolCall.function?.arguments) {
                  this.sendSSE(res, 'content_block_delta', {
                    type: 'content_block_delta',
                    index: idx,
                    delta: {
                      type: 'input_json_delta',
                      partial_json: toolCall.function.arguments
                    }
                  });
                }
              });
            }
          } catch (e) {
            this.logger.debug('Error parsing chunk:', e.message);
          }
        });
      });
      
      response.data.on('end', () => {
        if (!responseEnded) {
          if (buffer.trim()) {
            // Process remaining buffer
            this.logger.debug('Remaining buffer:', buffer);
          }
          res.end();
          responseEnded = true;
        }
      });
      
      response.data.on('error', error => {
        if (!responseEnded) {
          this.logger.error('Stream error:', error);
          this.sendSSE(res, 'error', {
            type: 'error',
            error: { type: 'stream_error', message: error.message }
          });
          res.end();
          responseEnded = true;
        }
      });
      
      // Handle client disconnect
      req.on('close', () => {
        this.logger.info('Client disconnected');
        responseEnded = true;
        streamDestroyed = true;
        if (response.data) {
          response.data.destroy();
        }
      });
      
    } catch (error) {
      this.logger.error('Streaming error:', error);
      
      if (!responseEnded && !streamDestroyed) {
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'text/event-stream' });
        }
        
        this.sendSSE(res, 'error', {
          type: 'error',
          error: { type: 'stream_error', message: error.message }
        });
        
        res.end();
        responseEnded = true;
      }
    }
  }

  /**
   * Send SSE event
   */
  sendSSE(res, event, data) {
    try {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (error) {
      this.logger.error('Error sending SSE:', error);
    }
  }

  /**
   * Handle errors
   */
  handleError(error, req, res) {
    if (req.monitorId) {
      this.requestStore.setError(req.monitorId, error);
    }
    
    if (error.code === 'ECONNABORTED') {
      this.logger.error('Request to OpenRouter timed out');
      res.status(504).json({ error: 'Request timeout' });
    } else if (error.request) {
      this.logger.error(`Network error: ${error.message}`);
      res.status(502).json({ error: `Network error: ${error.message}` });
    } else {
      this.logger.error(`Unexpected error: ${error.message}`, error.stack);
      res.status(500).json({ error: `Internal server error: ${error.message}` });
    }
  }
}