/**
 * OpenRouter API Converter
 * Converts Anthropic API format to OpenAI/OpenRouter format and back
 */

export class OpenRouterConverter {
  constructor(config = {}, configManager = null, logger = null) {
    this.config = {
      baseUrl: config.baseUrl || 'https://openrouter.ai/api',
      defaultModel: config.defaultModel || 'anthropic/claude-3.5-sonnet',
      modelMapping: config.modelMapping || {
        sonnet: 'anthropic/claude-3.5-sonnet',
        opus: 'anthropic/claude-3-opus',
        haiku: 'anthropic/claude-3.5-haiku'
      }
    };
    this.configManager = configManager;
    this.logger = logger;
  }

  /**
   * Get current API key (always fresh from environment)
   */
  getApiKey() {
    if (this.configManager) {
      return this.configManager.getOpenRouterApiKey();
    }
    return process.env.OPENROUTER_API_KEY || '';
  }

  /**
   * Map Anthropic model to OpenRouter model based on model family
   */
  mapModel(anthropicModel) {
    if (!anthropicModel) return this.config.defaultModel;
    
    const modelLower = anthropicModel.toLowerCase();
    
    // Check for model family keywords
    if (modelLower.includes('sonnet')) {
      return this.config.modelMapping.sonnet;
    } else if (modelLower.includes('opus')) {
      return this.config.modelMapping.opus;
    } else if (modelLower.includes('haiku')) {
      return this.config.modelMapping.haiku;
    }
    
    // Default fallback
    return anthropicModel;
  }

  /**
   * Normalize message content
   */
  normalizeContent(content) {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content
        .filter(item => item.type === 'text')
        .map(item => item.text)
        .join(' ');
    }
    return '';
  }

  /**
   * Convert Anthropic request to OpenRouter format
   */
  convertRequest(anthropicRequest) {
    const messages = [];
    
    // Add system messages
    if (anthropicRequest.system) {
      if (typeof anthropicRequest.system === 'string') {
        messages.push({
          role: 'system',
          content: anthropicRequest.system
        });
      } else if (Array.isArray(anthropicRequest.system)) {
        anthropicRequest.system.forEach(sysMsg => {
          const content = sysMsg.text || sysMsg.content || '';
          if (content) {
            messages.push({
              role: 'system',
              content: content
            });
          }
        });
      }
    }
    
    // Convert messages
    if (anthropicRequest.messages && Array.isArray(anthropicRequest.messages)) {
      anthropicRequest.messages.forEach(msg => {
        const newMsg = { role: msg.role };
        
        // Handle tool calls in content
        const toolCalls = [];
        if (Array.isArray(msg.content)) {
          // Extract tool uses
          const toolUses = msg.content.filter(item => item.type === 'tool_use');
          toolUses.forEach((toolUse, index) => {
            toolCalls.push({
              id: toolUse.id,
              type: 'function',
              function: {
                name: toolUse.name,
                arguments: JSON.stringify(toolUse.input)
              }
            });
          });
          
          // Extract tool results - EXACTLY like reference
          const toolResults = msg.content.filter(item => item.type === 'tool_result');
          toolResults.forEach(toolResult => {
            messages.push({
              role: 'tool',
              content: toolResult.text || toolResult.content,
              tool_call_id: toolResult.tool_use_id
            });
          });
        }
        
        // Get text content
        const textContent = this.normalizeContent(msg.content);
        if (textContent) newMsg.content = textContent;
        
        // Add tool calls if any
        if (toolCalls.length > 0) {
          newMsg.tool_calls = toolCalls;
        }
        
        // Only add message if it has content or tool calls
        if (newMsg.content || newMsg.tool_calls) {
          messages.push(newMsg);
        }
      });
    }
    
    // Convert tools - filter out BatchTool exactly like reference
    const tools = [];
    if (anthropicRequest.tools && Array.isArray(anthropicRequest.tools)) {
      anthropicRequest.tools.forEach(tool => {
        // Filter out BatchTool exactly like reference implementation
        if (!['BatchTool'].includes(tool.name)) {
          tools.push({
            type: 'function',
            function: {
              name: tool.name,
              description: tool.description,
              parameters: this.cleanJsonSchema(tool.input_schema)
            }
          });
        }
      });
    }
    
    // Build OpenRouter request
    const openRouterRequest = {
      model: this.mapModel(anthropicRequest.model),
      messages: messages,
      max_tokens: anthropicRequest.max_tokens,
      temperature: anthropicRequest.temperature !== undefined ? anthropicRequest.temperature : 1,
      stream: anthropicRequest.stream === true
    };
    
    // Add tools if any
    if (tools.length > 0) {
      openRouterRequest.tools = tools;
    }
    
    // Add top_p if present
    if (anthropicRequest.top_p !== undefined) {
      openRouterRequest.top_p = anthropicRequest.top_p;
    }
    
    // Add stop sequences if present
    if (anthropicRequest.stop_sequences) {
      openRouterRequest.stop = anthropicRequest.stop_sequences;
    }
    
    return openRouterRequest;
  }

  /**
   * Clean JSON schema (remove unsupported formats like uri)
   */
  cleanJsonSchema(schema) {
    if (!schema || typeof schema !== 'object') return schema;
    
    // If this is a string type with uri format, remove the format
    if (schema.type === 'string' && schema.format === 'uri') {
      const { format, ...rest } = schema;
      return rest;
    }
    
    // Handle arrays
    if (Array.isArray(schema)) {
      return schema.map(item => this.cleanJsonSchema(item));
    }
    
    // Recursively process all properties
    const result = {};
    for (const key in schema) {
      if (key === 'properties' && typeof schema[key] === 'object') {
        result[key] = {};
        for (const propKey in schema[key]) {
          result[key][propKey] = this.cleanJsonSchema(schema[key][propKey]);
        }
      } else if (key === 'items' && typeof schema[key] === 'object') {
        result[key] = this.cleanJsonSchema(schema[key]);
      } else if (key === 'additionalProperties' && typeof schema[key] === 'object') {
        result[key] = this.cleanJsonSchema(schema[key]);
      } else if (['anyOf', 'allOf', 'oneOf'].includes(key) && Array.isArray(schema[key])) {
        result[key] = schema[key].map(item => this.cleanJsonSchema(item));
      } else {
        result[key] = this.cleanJsonSchema(schema[key]);
      }
    }
    return result;
  }

  /**
   * Convert OpenRouter response to Anthropic format
   */
  convertResponse(openRouterResponse) {
    const choice = openRouterResponse.choices[0];
    const message = choice.message;
    
    // Map finish reason with original response for detailed logging
    const stopReason = this.mapStopReason(choice.finish_reason, openRouterResponse);
    
    // Build content array
    const content = [];
    
    // Add text content if present
    if (message.content) {
      content.push({
        type: 'text',
        text: message.content
      });
    }
    
    // Add tool calls if present
    if (message.tool_calls && Array.isArray(message.tool_calls)) {
      message.tool_calls.forEach(toolCall => {
        content.push({
          type: 'tool_use',
          id: toolCall.id,
          name: toolCall.function.name,
          input: JSON.parse(toolCall.function.arguments)
        });
      });
    }
    
    // Create message ID
    const messageId = openRouterResponse.id
      ? openRouterResponse.id.replace('chatcmpl', 'msg')
      : 'msg_' + Math.random().toString(36).substr(2, 24);
    
    // Build Anthropic response
    return {
      id: messageId,
      type: 'message',
      role: message.role || 'assistant',
      content: content,
      model: openRouterResponse.model,
      stop_reason: stopReason,
      stop_sequence: null,
      usage: {
        input_tokens: openRouterResponse.usage?.prompt_tokens || 0,
        output_tokens: openRouterResponse.usage?.completion_tokens || 0
      }
    };
  }

  /**
   * Map OpenRouter finish reason to Anthropic stop reason
   */
  mapStopReason(finishReason, originalResponse = null) {
    // Match reference implementation exactly
    let mappedReason;
    let mappingSource;
    
    switch (finishReason) {
      case 'tool_calls': 
        mappedReason = 'tool_use';
        mappingSource = 'standard mapping: tool_calls → tool_use';
        break;
      case 'stop': 
        mappedReason = 'end_turn';
        mappingSource = 'standard mapping: stop → end_turn (normal completion)';
        break;
      case 'length': 
        mappedReason = 'max_tokens';
        mappingSource = 'standard mapping: length → max_tokens';
        break;
      default: 
        mappedReason = 'end_turn';
        mappingSource = `fallback mapping: unknown finish_reason '${finishReason}' → end_turn`;
        console.warn(`Unknown OpenRouter finish_reason: ${finishReason}, defaulting to end_turn`);
        break;
    }
    
    // Log detailed information when mapping to end_turn
    if (mappedReason === 'end_turn') {
      const logMethod = this.logger?.info || console.info;
      logMethod.call(this.logger || console, '🔍 STOP_REASON MAPPING TO END_TURN (Converter):');
      logMethod.call(this.logger || console, `   Original finish_reason: "${finishReason}"`);
      logMethod.call(this.logger || console, `   Mapping decision: ${mappingSource}`);
      if (originalResponse) {
        logMethod.call(this.logger || console, '   Original OpenRouter response:');
        logMethod.call(this.logger || console, '   ' + JSON.stringify(originalResponse, null, 2).replace(/\n/g, '\n   '));
      }
    }
    
    return mappedReason;
  }

  /**
   * Convert streaming chunk from OpenRouter to Anthropic format
   */
  convertStreamingChunk(chunk, messageId, contentIndex = 0) {
    const events = [];
    
    // Parse chunk if it's a string
    if (typeof chunk === 'string') {
      try {
        chunk = JSON.parse(chunk);
      } catch (e) {
        return events;
      }
    }
    
    const delta = chunk.choices?.[0]?.delta;
    if (!delta) return events;
    
    // Handle content delta
    if (delta.content) {
      events.push({
        type: 'content_block_delta',
        index: contentIndex,
        delta: {
          type: 'text_delta',
          text: delta.content
        }
      });
    }
    
    // Handle tool calls
    if (delta.tool_calls) {
      delta.tool_calls.forEach(toolCall => {
        if (toolCall.function?.arguments) {
          events.push({
            type: 'content_block_delta',
            index: toolCall.index || contentIndex,
            delta: {
              type: 'input_json_delta',
              partial_json: toolCall.function.arguments
            }
          });
        }
      });
    }
    
    // Handle finish reason
    if (chunk.choices?.[0]?.finish_reason) {
      events.push({
        type: 'message_delta',
        delta: {
          stop_reason: this.mapStopReason(chunk.choices[0].finish_reason, chunk),
          stop_sequence: null
        },
        usage: chunk.usage ? {
          output_tokens: chunk.usage.completion_tokens
        } : undefined
      });
    }
    
    return events;
  }

  /**
   * Get request headers for OpenRouter
   */
  getHeaders(anthropicHeaders = {}) {
    const headers = {
      'Content-Type': 'application/json'
    };
    
    // Add OpenRouter API key (get fresh from environment)
    const apiKey = this.getApiKey();
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    
    // Add any custom headers
    if (anthropicHeaders['x-api-key'] && !apiKey) {
      // Use Anthropic API key as fallback if no OpenRouter key
      headers['Authorization'] = `Bearer ${anthropicHeaders['x-api-key']}`;
    }
    
    // Add HTTP referer for OpenRouter (from configManager if available)
    const config = this.configManager ? this.configManager.getConfig() : {};
    headers['HTTP-Referer'] = config.headers?.httpReferer || 'https://github.com/kingoliang/anthropic-proxy';
    headers['X-Title'] = config.headers?.title || 'Anthropic Proxy';
    
    return headers;
  }

}