/**
 * OpenRouter Request Handler
 * Handles requests routed through OpenRouter
 * Refactored to match maxnowack/anthropic-proxy patterns
 */

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
   * Map stop reason (matches reference implementation)
   */
  mapStopReason(finishReason) {
    switch (finishReason) {
      case 'tool_calls': return 'tool_use';
      case 'stop': return 'end_turn';
      case 'length': return 'max_tokens';
      default: return 'end_turn';
    }
  }

  /**
   * Handle non-streaming request (simplified to match reference)
   */
  async handleRequest(req, res) {
    const monitorId = req.monitorId;
    
    try {
      const payload = req.body;
      
      // Convert request
      const openRouterRequest = this.convertRequestInline(payload);
      const currentConfig = this.getCurrentConfig();
      
      // Get headers
      const headers = this.getRequestHeaders();
      
      // Make request using fetch
      const openaiResponse = await fetch(`${currentConfig.openrouter.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(openRouterRequest)
      });
      
      if (!openaiResponse.ok) {
        const errorDetails = await openaiResponse.text();
        
        // Sanitize error message to avoid leaking sensitive information
        const sanitizedError = this.sanitizeError(errorDetails, openaiResponse.status);
        
        // Update monitor for error
        if (monitorId) {
          this.requestStore.endRequest(monitorId, {
            status: openaiResponse.status,
            body: { error: sanitizedError },
            provider: 'openrouter'
          });
        }
        
        res.writeHead(openaiResponse.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: sanitizedError }));
        return;
      }
      
      const data = await openaiResponse.json();
      if (data.error) {
        throw new Error(data.error.message);
      }
      
      const anthropicResponse = this.convertResponseInline(data, openRouterRequest.model);
      
      // Update monitor for success
      if (monitorId) {
        this.requestStore.endRequest(monitorId, {
          status: 200,
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
   * Handle streaming request (refactored to match reference implementation)
   */
  async handleStreamingRequest(req, res) {
    const monitorId = req.monitorId;
    
    try {
      const payload = req.body;
      
      this.logger.info('🔄 STARTING STREAMING TO OPENROUTER');
      this.logger.info(`Original Model: ${payload.model}`);
      
      // Convert request using inline logic (matching reference)
      const openRouterRequest = this.convertRequestInline(payload);
      const currentConfig = this.getCurrentConfig();
      
      this.logger.info(`Mapped Model: ${openRouterRequest.model}`);
      this.logger.info(`Tools: ${openRouterRequest.tools ? openRouterRequest.tools.length : 0}`);
      
      // Get headers
      const headers = this.getRequestHeaders();
      
      // Make request using fetch (matching reference pattern)
      const openaiResponse = await fetch(`${currentConfig.openrouter.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(openRouterRequest)
      });
      
      if (!openaiResponse.ok) {
        const errorDetails = await openaiResponse.text();
        const sanitizedError = this.sanitizeError(errorDetails, openaiResponse.status);
        res.writeHead(openaiResponse.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: sanitizedError }));
        return;
      }
      
      // Non-streaming response
      if (!openRouterRequest.stream) {
        const data = await openaiResponse.json();
        if (data.error) {
          throw new Error(data.error.message);
        }
        
        const anthropicResponse = this.convertResponseInline(data, openRouterRequest.model);
        res.json(anthropicResponse);
        return;
      }
      
      // Streaming response - match reference implementation pattern
      let isSucceeded = false;
      let hasActualContent = false;
      const sendSuccessMessage = () => {
        if (isSucceeded) return;
        isSucceeded = true;
        
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        });
        
        const messageId = 'msg_' + Math.random().toString(36).substr(2, 24);
        
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
        
        this.sendSSE(res, 'ping', { type: 'ping' });
      };
      
      // Stream processing variables (matching reference)
      let accumulatedContent = '';
      let accumulatedReasoning = '';
      let usage = null;
      let textBlockStarted = false;
      let encounteredToolCall = false;
      const toolCallAccumulators = {};
      const decoder = new TextDecoder('utf-8');
      const reader = openaiResponse.body.getReader();
      let done = false;
      
      // Main streaming loop (matching reference implementation)
      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value);
          this.logger.debug('OpenAI response chunk:', chunk);
          
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed === '' || !trimmed.startsWith('data:')) continue;
            const dataStr = trimmed.replace(/^data:\s*/, '');
            
            if (dataStr === '[DONE]') {
              // Finalize stream with stop events
              if (encounteredToolCall) {
                for (const idx in toolCallAccumulators) {
                  this.sendSSE(res, 'content_block_stop', {
                    type: 'content_block_stop',
                    index: parseInt(idx, 10)
                  });
                }
              } else if (textBlockStarted) {
                this.sendSSE(res, 'content_block_stop', {
                  type: 'content_block_stop',
                  index: 0
                });
              }
              
              const stopReason = encounteredToolCall ? 'tool_use' : 'end_turn';
              
              this.sendSSE(res, 'message_delta', {
                type: 'message_delta',
                delta: {
                  stop_reason: stopReason,
                  stop_sequence: null
                },
                usage: usage
                  ? { output_tokens: usage.completion_tokens }
                  : { output_tokens: accumulatedContent.split(' ').length + accumulatedReasoning.split(' ').length }
              });
              
              this.sendSSE(res, 'message_stop', { type: 'message_stop' });
              
              // Update monitor with final streaming response
              if (monitorId) {
                this.requestStore.endRequest(monitorId, {
                  status: 200,
                  body: {
                    type: 'message',
                    role: 'assistant',
                    content: encounteredToolCall ? 
                      Object.entries(toolCallAccumulators).map(([ idx, args]) => {
                        let input = {};
                        try {
                          input = JSON.parse(args || '{}');
                        } catch (e) {
                          this.logger.debug('Failed to parse tool args:', e);
                        }
                        return {
                          type: 'tool_use',
                          id: `tool_${idx}`,
                          name: 'unknown',
                          input: input
                        };
                      }) :
                      [{ type: 'text', text: accumulatedContent }],
                    model: openRouterRequest.model,
                    stop_reason: stopReason,
                    stop_sequence: null,
                    usage: usage || { input_tokens: 0, output_tokens: 0 }
                  },
                  provider: 'openrouter'
                });
              }
              
              res.end();
              return;
            }
            
            let parsed;
            try {
              parsed = JSON.parse(dataStr);
            } catch (e) {
              this.logger.debug('Failed to parse JSON:', dataStr, e);
              continue;
            }
            
            if (parsed.error) {
              if (!isSucceeded) {
                throw new Error(parsed.error.message);
              } else {
                this.sendSSE(res, 'error', {
                  type: 'error',
                  error: {
                    type: 'api_error',
                    message: parsed.error.message
                  }
                });
                res.end();
                return;
              }
            }
            
            // Capture usage if available
            if (parsed.usage) {
              usage = parsed.usage;
            }
            
            const delta = parsed.choices[0].delta;
            if (delta && delta.tool_calls) {
              // Send success message only when we have actual content
              if (!hasActualContent) {
                hasActualContent = true;
                sendSuccessMessage();
              }
              
              for (const toolCall of delta.tool_calls) {
                encounteredToolCall = true;
                const idx = toolCall.index;
                if (toolCallAccumulators[idx] === undefined) {
                  toolCallAccumulators[idx] = "";
                  // Ensure tool call has a valid ID
                  const toolCallId = toolCall.id || `call_${Date.now()}_${idx}`;
                  this.sendSSE(res, 'content_block_start', {
                    type: 'content_block_start',
                    index: idx,
                    content_block: {
                      type: 'tool_use',
                      id: toolCallId,
                      name: toolCall.function.name,
                      input: {}
                    }
                  });
                }
                const newArgs = toolCall.function.arguments || "";
                const oldArgs = toolCallAccumulators[idx];
                if (newArgs.length > oldArgs.length) {
                  const deltaText = newArgs.substring(oldArgs.length);
                  this.sendSSE(res, 'content_block_delta', {
                    type: 'content_block_delta',
                    index: idx,
                    delta: {
                      type: 'input_json_delta',
                      partial_json: deltaText
                    }
                  });
                  toolCallAccumulators[idx] = newArgs;
                }
              }
            } else if (delta && delta.content) {
              // Send success message only when we have actual content
              if (!hasActualContent) {
                hasActualContent = true;
                sendSuccessMessage();
              }
              
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
            } else if (delta && delta.reasoning) {
              // Send success message only when we have actual content
              if (!hasActualContent) {
                hasActualContent = true;
                sendSuccessMessage();
              }
              
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
              accumulatedReasoning += delta.reasoning;
              this.sendSSE(res, 'content_block_delta', {
                type: 'content_block_delta',
                index: 0,
                delta: {
                  type: 'thinking_delta',
                  thinking: delta.reasoning
                }
              });
            }
          }
        }
      }
      
      res.end();
    } catch (err) {
      this.logger.error('Streaming error:', err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    }
  }

  /**
   * Send SSE event (matches reference implementation exactly)
   */
  sendSSE(reply, event, data) {
    const sseMessage = `event: ${event}\n` +
                       `data: ${JSON.stringify(data)}\n\n`;
    reply.write(sseMessage);
    // Flush if the flush method is available
    if (typeof reply.flush === 'function') {
      reply.flush();
    }
  }

  /**
   * Convert request inline (matching reference implementation)
   */
  convertRequestInline(payload) {
    // Helper to normalize message content
    const normalizeContent = (content) => {
      if (typeof content === 'string') return content;
      if (Array.isArray(content)) {
        return content.map(item => item.text).join(' ');
      }
      return null;
    };

    // Build messages array
    const messages = [];
    if (payload.system && Array.isArray(payload.system)) {
      payload.system.forEach(sysMsg => {
        const normalized = normalizeContent(sysMsg.text || sysMsg.content);
        if (normalized) {
          messages.push({
            role: 'system',
            content: normalized
          });
        }
      });
    }

    // Add user messages
    if (payload.messages && Array.isArray(payload.messages)) {
      payload.messages.forEach(msg => {
        const toolCalls = (Array.isArray(msg.content) ? msg.content : []).filter(item => item.type === 'tool_use').map(toolCall => ({
          id: toolCall.id,
          type: 'function',
          function: {
            name: toolCall.name,
            arguments: JSON.stringify(toolCall.input),
          }
        }));
        const newMsg = { role: msg.role };
        const normalized = normalizeContent(msg.content);
        if (normalized) newMsg.content = normalized;
        if (toolCalls.length > 0) newMsg.tool_calls = toolCalls;
        if (newMsg.content || newMsg.tool_calls) messages.push(newMsg);

        if (Array.isArray(msg.content)) {
          const toolResults = msg.content.filter(item => item.type === 'tool_result');
          toolResults.forEach(toolResult => {
            // Only process tool results that have a valid tool_use_id
            if (toolResult.tool_use_id) {
              messages.push({
                role: 'tool',
                content: toolResult.text || toolResult.content,
                tool_call_id: toolResult.tool_use_id,
              });
            } else {
              // Log warning for debugging - missing tool_use_id means this result can't be matched to a call
              this.logger.warn('Tool result missing tool_use_id, skipping to avoid ID mismatch');
            }
          });
        }
      });
    }

    // Convert tools
    const tools = (payload.tools || []).filter(tool => !['BatchTool'].includes(tool.name)).map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: this.removeUriFormat(tool.input_schema),
      },
    }));

    const openaiPayload = {
      model: this.converter.mapModel(payload.model),
      messages,
      max_tokens: payload.max_tokens,
      temperature: payload.temperature !== undefined ? payload.temperature : 1,
      stream: payload.stream === true,
    };
    if (tools.length > 0) openaiPayload.tools = tools;
    return openaiPayload;
  }

  /**
   * Remove URI format from JSON schema (matches reference implementation)
   */
  removeUriFormat(schema) {
    if (!schema || typeof schema !== 'object') return schema;

    // If this is a string type with uri format, remove the format
    if (schema.type === 'string' && schema.format === 'uri') {
      const { format, ...rest } = schema;
      return rest;
    }

    // Handle array of schemas (like in anyOf, allOf, oneOf)
    if (Array.isArray(schema)) {
      return schema.map(item => this.removeUriFormat(item));
    }

    // Recursively process all properties
    const result = {};
    for (const key in schema) {
    if (key === 'properties' && typeof schema[key] === 'object') {
      result[key] = {};
      for (const propKey in schema[key]) {
        result[key][propKey] = this.removeUriFormat(schema[key][propKey]);
      }
    } else if (key === 'items' && typeof schema[key] === 'object') {
      result[key] = this.removeUriFormat(schema[key]);
    } else if (key === 'additionalProperties' && typeof schema[key] === 'object') {
      result[key] = this.removeUriFormat(schema[key]);
    } else if (['anyOf', 'allOf', 'oneOf'].includes(key) && Array.isArray(schema[key])) {
      result[key] = schema[key].map(item => this.removeUriFormat(item));
    } else {
      result[key] = this.removeUriFormat(schema[key]);
    }
    }
    return result;
  }

  /**
   * Convert response inline (matches reference implementation)
   */
  convertResponseInline(data, model) {
    const choice = data.choices[0];
    const openaiMessage = choice.message;

    // Map finish_reason to anthropic stop_reason
    const mapStopReason = (finishReason) => {
      switch (finishReason) {
        case 'tool_calls': return 'tool_use';
        case 'stop': return 'end_turn';
        case 'length': return 'max_tokens';
        default: return 'end_turn';
      }
    };

    const stopReason = mapStopReason(choice.finish_reason);
    const toolCalls = openaiMessage.tool_calls || [];

    // Create message id
    const messageId = data.id
      ? data.id.replace('chatcmpl', 'msg')
      : 'msg_' + Math.random().toString(36).substr(2, 24);

    const content = [];
    
    // Only add text content if it exists and is not null/empty
    if (openaiMessage.content && openaiMessage.content.trim()) {
      content.push({
        text: openaiMessage.content,
        type: 'text'
      });
    }
    
    // Add tool calls
    toolCalls.forEach(toolCall => {
      content.push({
        type: 'tool_use',
        id: toolCall.id,
        name: toolCall.function.name,
        input: JSON.parse(toolCall.function.arguments),
      });
    });

    const anthropicResponse = {
      content,
      id: messageId,
      model: model,
      role: openaiMessage.role,
      stop_reason: stopReason,
      stop_sequence: null,
      type: 'message',
      usage: {
        input_tokens: data.usage
          ? data.usage.prompt_tokens
          : 0,
        output_tokens: data.usage
          ? data.usage.completion_tokens
          : 0,
      }
    };

    return anthropicResponse;
  }

  /**
   * Get request headers (matches reference implementation)
   */
  getRequestHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };
    
    const apiKey = this.converter.getApiKey();
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    
    return headers;
  }

  /**
   * Sanitize error messages to prevent sensitive information leakage
   */
  sanitizeError(errorDetails, statusCode) {
    try {
      // Try to parse as JSON first
      const errorObj = JSON.parse(errorDetails);
      if (errorObj.error && errorObj.error.message) {
        return this.sanitizeErrorMessage(errorObj.error.message);
      }
    } catch (e) {
      // If not JSON, treat as plain text
    }
    
    return this.sanitizeErrorMessage(errorDetails);
  }

  /**
   * Clean error message of sensitive information
   */
  sanitizeErrorMessage(message) {
    if (!message || typeof message !== 'string') {
      return 'An error occurred while processing your request';
    }

    // Remove potential API keys, tokens, and sensitive paths
    let sanitized = message
      .replace(/sk-[a-zA-Z0-9-_]{20,}/g, 'sk-***')
      .replace(/Bearer\s+[a-zA-Z0-9-_]{20,}/g, 'Bearer ***')
      .replace(/\/[a-zA-Z0-9\/\-_\.]+\/[a-zA-Z0-9\/\-_\.]+/g, '/***/')
      .replace(/api[_-]?key[s]?[:\s=]+[a-zA-Z0-9-_]{10,}/gi, 'api_key: ***')
      .replace(/token[s]?[:\s=]+[a-zA-Z0-9-_]{10,}/gi, 'token: ***');

    // Limit message length to prevent information leakage
    if (sanitized.length > 200) {
      sanitized = sanitized.substring(0, 200) + '...';
    }

    return sanitized;
  }

  /**
   * Handle errors (simplified to match reference)
   */
  handleError(error, req, res) {
    this.logger.error('Request error:', error);
    
    const sanitizedMessage = this.sanitizeErrorMessage(error.message);
    
    // Update monitor with error
    if (req.monitorId) {
      this.requestStore.endRequest(req.monitorId, {
        status: 500,
        body: { error: sanitizedMessage },
        provider: 'openrouter'
      });
    }
    
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: sanitizedMessage }));
    }
  }
}