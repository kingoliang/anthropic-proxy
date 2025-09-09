/**
 * Request/Response Monitor Module
 * Stores and manages API request/response data for monitoring
 */

import { EventEmitter } from 'events';

// Utility to mask sensitive data
export function maskSensitiveData(value) {
  if (!value) return value;
  
  // Handle array values (multiple headers with same name)
  if (Array.isArray(value)) {
    return value.map(item => maskSensitiveData(item));
  }
  
  // Handle non-string values
  if (typeof value !== 'string') {
    return value;
  }
  
  // Mask API keys - show first 10 chars and last 4 chars
  if (value.length > 20) {
    return value.substring(0, 10) + '...' + value.substring(value.length - 4);
  } else if (value.length > 10) {
    return value.substring(0, 6) + '...';
  }
  return value;
}

// Request/Response storage manager
export class RequestStore extends EventEmitter {
  constructor(maxSize = 1000) {
    super();
    this.requests = new Map();
    this.maxSize = maxSize;
    this.stats = {
      totalRequests: 0,
      successCount: 0,
      errorCount: 0,
      totalDuration: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0
    };
  }

  // Generate unique request ID
  generateId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Utility to calculate object size in bytes
  calculateSize(obj) {
    if (!obj) return 0;
    return new Blob([JSON.stringify(obj)]).size;
  }

  // Smart eviction strategy - remove oldest completed requests first
  evictOldestRequests() {
    const requests = Array.from(this.requests.entries());
    
    // Sort by priority: pending requests last (keep them), then by timestamp
    requests.sort(([, a], [, b]) => {
      // Keep pending requests
      if (a.status === 'pending' && b.status !== 'pending') return 1;
      if (b.status === 'pending' && a.status !== 'pending') return -1;
      
      // For non-pending requests, sort by timestamp (oldest first)
      return new Date(a.timestamp) - new Date(b.timestamp);
    });
    
    // Remove oldest 10% or at least 1 request
    const removeCount = Math.max(1, Math.floor(this.maxSize * 0.1));
    for (let i = 0; i < removeCount && requests.length > 0; i++) {
      const [id] = requests[i];
      this.requests.delete(id);
    }
    
    // If we still don't have space and all remaining are pending, remove oldest pending
    if (this.requests.size >= this.maxSize) {
      const oldestPending = requests.find(([, req]) => req.status === 'pending');
      if (oldestPending) {
        this.requests.delete(oldestPending[0]);
      }
    }
  }

  // Start tracking a request
  startRequest(req) {
    const id = this.generateId();
    
    // Mask sensitive headers
    const maskedHeaders = {};
    Object.entries(req.headers).forEach(([key, value]) => {
      if (['x-api-key', 'authorization'].includes(key.toLowerCase())) {
        maskedHeaders[key] = maskSensitiveData(value);
      } else {
        maskedHeaders[key] = value;
      }
    });

    const requestBody = req.body;
    const requestSize = this.calculateSize(requestBody) + this.calculateSize(maskedHeaders);

    const requestData = {
      id,
      timestamp: new Date().toISOString(),
      startTime: Date.now(),
      method: req.method,
      url: req.url,
      request: {
        headers: maskedHeaders,
        body: requestBody
      },
      response: null,
      streamChunks: [],
      mergedContent: null,
      metrics: {
        duration: null,
        inputTokens: 0,
        outputTokens: 0,
        firstChunkTime: null,
        chunksCount: 0,
        requestSize: requestSize,
        responseSize: 0,
        totalSize: requestSize
      },
      status: 'pending',
      error: null
    };

    // Maintain max size limit with smarter eviction
    if (this.requests.size >= this.maxSize) {
      this.evictOldestRequests();
    }

    this.requests.set(id, requestData);
    this.stats.totalRequests++;
    
    // Emit event for real-time updates
    this.emit('requestStart', requestData);
    
    return id;
  }

  // Update request with response data
  endRequest(id, responseData) {
    const request = this.requests.get(id);
    if (!request) return;

    const duration = Date.now() - request.startTime;
    
    request.response = {
      status: responseData.status,
      headers: responseData.headers,
      body: responseData.body
    };
    
    // Calculate response size
    const responseSize = this.calculateSize(responseData.body) + this.calculateSize(responseData.headers);
    request.metrics.responseSize = responseSize;
    request.metrics.totalSize = request.metrics.requestSize + responseSize;
    
    request.metrics.duration = duration;
    request.status = responseData.status >= 200 && responseData.status < 300 ? 'success' : 'error';
    
    // Update stats
    this.stats.totalDuration += duration;
    if (request.status === 'success') {
      this.stats.successCount++;
    } else {
      this.stats.errorCount++;
    }

    // Extract token counts if available
    if (responseData.body?.usage) {
      const usage = responseData.body.usage;
      request.metrics.inputTokens = usage.input_tokens || 0;
      request.metrics.outputTokens = usage.output_tokens || 0;
      this.stats.totalInputTokens += request.metrics.inputTokens;
      this.stats.totalOutputTokens += request.metrics.outputTokens;
    }

    this.emit('requestEnd', request);
  }

  // Add stream chunk
  addStreamChunk(id, chunk) {
    const request = this.requests.get(id);
    if (!request) return;

    // Record first chunk time
    if (request.streamChunks.length === 0 && request.startTime) {
      request.metrics.firstChunkTime = Date.now() - request.startTime;
    }

    request.streamChunks.push({
      timestamp: new Date().toISOString(),
      data: chunk
    });
    
    request.metrics.chunksCount++;
    
    this.emit('streamChunk', { id, chunk });
  }

  // Set merged content for streaming response
  setMergedContent(id, mergedContent) {
    const request = this.requests.get(id);
    if (!request) return;
    
    request.mergedContent = mergedContent;
    
    // Calculate streaming response size
    const streamSize = this.calculateSize(mergedContent) + 
                      request.streamChunks.reduce((total, chunk) => total + this.calculateSize(chunk.data), 0);
    request.metrics.responseSize = streamSize;
    request.metrics.totalSize = request.metrics.requestSize + streamSize;
    
    // Extract token counts from merged content if available
    if (mergedContent.usage) {
      request.metrics.inputTokens = mergedContent.usage.input_tokens || 0;
      request.metrics.outputTokens = mergedContent.usage.output_tokens || 0;
      this.stats.totalInputTokens += request.metrics.inputTokens;
      this.stats.totalOutputTokens += request.metrics.outputTokens;
    }
  }

  // Set error for request
  setError(id, error) {
    const request = this.requests.get(id);
    if (!request) return;
    
    request.status = 'error';
    request.error = {
      message: error.message,
      stack: error.stack
    };
    
    this.stats.errorCount++;
    this.emit('requestError', request);
  }

  // Get all requests with optional filtering
  getAll(filters = {}) {
    let results = Array.from(this.requests.values());
    
    // Apply filters
    if (filters.status) {
      results = results.filter(r => r.status === filters.status);
    }
    
    if (filters.model) {
      results = results.filter(r => r.request.body?.model === filters.model);
    }
    
    if (filters.timeRange) {
      const now = Date.now();
      const range = filters.timeRange;
      results = results.filter(r => {
        const age = now - new Date(r.timestamp).getTime();
        switch(range) {
          case '1h': return age <= 3600000;
          case '24h': return age <= 86400000;
          case '7d': return age <= 604800000;
          default: return true;
        }
      });
    }
    
    // Sort by timestamp (newest first)
    results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Apply pagination
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const start = (page - 1) * limit;
    const end = start + limit;
    
    return {
      data: results.slice(start, end),
      total: results.length,
      page,
      limit
    };
  }

  // Get single request by ID
  getById(id) {
    return this.requests.get(id);
  }

  // Get statistics
  getStats() {
    const avgDuration = this.stats.totalRequests > 0 
      ? Math.round(this.stats.totalDuration / this.stats.totalRequests)
      : 0;
      
    const successRate = this.stats.totalRequests > 0
      ? ((this.stats.successCount / this.stats.totalRequests) * 100).toFixed(2)
      : 0;
    
    return {
      totalRequests: this.stats.totalRequests,
      successCount: this.stats.successCount,
      errorCount: this.stats.errorCount,
      successRate: successRate + '%',
      avgDuration: avgDuration + 'ms',
      totalInputTokens: this.stats.totalInputTokens,
      totalOutputTokens: this.stats.totalOutputTokens,
      activeRequests: Array.from(this.requests.values()).filter(r => r.status === 'pending').length
    };
  }

  // Clear all data
  clear() {
    this.requests.clear();
    this.stats = {
      totalRequests: 0,
      successCount: 0,
      errorCount: 0,
      totalDuration: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0
    };
    this.emit('clear');
  }

  // Export data as JSON
  export() {
    return {
      stats: this.getStats(),
      requests: Array.from(this.requests.values()),
      exportTime: new Date().toISOString()
    };
  }
}

// Singleton instance
export const requestStore = new RequestStore();