/**
 * Request Analysis Module
 * Generates comprehensive analysis reports based on the Python implementation
 */

import { requestStore } from './store.js';

/**
 * Classify request type based on content and tools used
 */
function classifyRequestType(userContent, assistantResponse, toolsUsed) {
  if (!userContent) {
    userContent = "";
  }

  const contentLower = userContent.toLowerCase();
  const responseLower = assistantResponse ? assistantResponse.toLowerCase() : "";

  // Define patterns for different types of requests
  const patterns = {
    'Code Generation': [
      // English patterns
      /generate.*?code/i, /create.*?function/i, /write.*?class/i, /implement.*?method/i, /build.*?script/i,
      /generate.*?test/i, /create.*?test/i, /write.*?unit.*?test/i, /test.*?generation/i,
      /make.*?function/i, /develop.*?class/i, /code.*?for/i
    ],
    'Debugging & Fixing': [
      /fix.*?bug/i, /solve.*?problem/i, /correct.*?error/i, /debug/i, /troubleshoot/i,
      /repair/i, /resolve.*?issue/i, /handle.*?error/i
    ],
    'Code Analysis': [
      /analyze.*?code/i, /explain.*?function/i, /understand.*?logic/i, /review.*?implementation/i, /check.*?code/i,
      /examine/i, /interpret/i, /what.*?does/i, /how.*?works/i, /explain.*?this/i
    ],
    'Optimization & Refactoring': [
      /optimize.*?performance/i, /refactor.*?code/i, /improve.*?algorithm/i, /enhance.*?efficiency/i, /optimize/i,
      /make.*?better/i, /improve.*?code/i, /performance.*?improvement/i
    ],
    'File Operations': [
      /read.*?file/i, /write.*?file/i, /create.*?file/i, /edit.*?file/i, /delete.*?file/i
    ],
    'Documentation': [
      /write.*?documentation/i, /create.*?readme/i, /generate.*?docs/i, /document.*?code/i,
      /add.*?comments/i, /write.*?comments/i
    ],
    'Configuration & Setup': [
      /configure.*?environment/i, /setup.*?project/i, /initialize.*?project/i, /install.*?dependencies/i,
      /config/i, /setup/i, /init/i, /install/i
    ],
    'Data Processing': [
      /process.*?data/i, /parse.*?json/i, /convert.*?format/i, /extract.*?information/i,
      /transform.*?data/i, /process.*?file/i
    ]
  };

  // Check based on tools used
  if (toolsUsed && toolsUsed.length > 0) {
    const toolPatterns = {
      'File Operations': ['Read', 'Write', 'Edit', 'MultiEdit', 'Glob'],
      'Code Execution': ['Bash', 'mcp__ide__executeCode'],
      'Task Management': ['TodoWrite'],
      'Web Operations': ['WebSearch', 'WebFetch'],
      'Code Analysis': ['Grep']
    };

    for (const [category, toolList] of Object.entries(toolPatterns)) {
      if (toolList.some(tool => toolsUsed.includes(tool))) {
        // Double-check with content if possible
        for (const [patternCategory, patternList] of Object.entries(patterns)) {
          if (patternList.some(pattern => pattern.test(contentLower))) {
            return patternCategory;
          }
        }
        return category;
      }
    }
  }

  // Check content patterns
  for (const [category, patternList] of Object.entries(patterns)) {
    if (patternList.some(pattern => pattern.test(contentLower))) {
      return category;
    }
  }

  // Fallback: check assistant response for clues
  if (responseLower.includes('todowrite')) {
    return 'Task Management';
  } else if (['function', 'class', 'method', 'code'].some(keyword => responseLower.includes(keyword))) {
    return 'Code Generation';
  } else if (['error', 'fix', 'debug', 'problem'].some(keyword => responseLower.includes(keyword))) {
    return 'Debugging & Fixing';
  } else if (['read', 'write', 'file', 'edit'].some(keyword => responseLower.includes(keyword))) {
    return 'File Operations';
  }

  return 'General Query';
}

/**
 * Extract user content from messages
 */
function extractUserContent(messages) {
  if (!messages || !Array.isArray(messages)) return '';

  for (const msg of messages) {
    if (msg.role === 'user') {
      const content = msg.content;
      if (typeof content === 'string') {
        return content.trim();
      } else if (Array.isArray(content)) {
        // Handle complex content structure
        // Filter out system-reminder messages and get actual user content
        const textParts = content
          .filter(part => part && part.type === 'text')
          .map(part => part.text || '')
          .filter(text => !text.startsWith('<system-reminder>'));
        
        // If all parts are system reminders, fall back to all text
        if (textParts.length === 0) {
          return content
            .filter(part => part && part.type === 'text')
            .map(part => part.text || '')
            .join(' ');
        }
        
        // Return the first non-system-reminder text as the main user content
        return textParts[0] ? textParts[0].trim() : textParts.join(' ').trim();
      }
    }
  }
  return '';
}

/**
 * Extract assistant response from stream chunks or merged content
 */
function extractAssistantResponse(streamChunks, mergedContent) {
  // Try merged content first (more reliable)
  // Check for completeText first (current format)
  if (mergedContent && mergedContent.completeText) {
    return mergedContent.completeText;
  }
  
  // Fallback to old content format for compatibility
  if (mergedContent && mergedContent.content) {
    if (typeof mergedContent.content === 'string') {
      return mergedContent.content;
    } else if (Array.isArray(mergedContent.content)) {
      return mergedContent.content
        .filter(item => item && item.type === 'text')
        .map(item => item.text || '')
        .join('');
    }
  }

  // Fallback to stream chunks
  if (!streamChunks || !Array.isArray(streamChunks)) return '';

  const textParts = [];
  
  for (const chunk of streamChunks) {
    if (!chunk.data) continue;
    
    try {
      const chunkData = JSON.parse(chunk.data);
      
      if (chunkData.type === 'content_block_delta') {
        const delta = chunkData.delta;
        if (delta && delta.type === 'text_delta' && delta.text) {
          textParts.push(delta.text);
        }
      }
    } catch (error) {
      // Skip malformed JSON
      continue;
    }
  }
  
  return textParts.join('');
}

/**
 * Extract tools used from stream chunks or merged content
 */
function extractToolsUsed(streamChunks, mergedContent) {
  const tools = new Set();

  // Try merged content first
  if (mergedContent && mergedContent.toolCalls && Array.isArray(mergedContent.toolCalls)) {
    mergedContent.toolCalls.forEach(toolCall => {
      if (toolCall.name) {
        tools.add(toolCall.name);
      }
    });
  }

  // Also check stream chunks
  if (streamChunks && Array.isArray(streamChunks)) {
    for (const chunk of streamChunks) {
      if (!chunk.data) continue;
      
      try {
        const chunkData = JSON.parse(chunk.data);
        
        if (chunkData.type === 'content_block_start') {
          const block = chunkData.content_block;
          if (block && block.type === 'tool_use' && block.name) {
            tools.add(block.name);
          }
        }
      } catch (error) {
        // Skip malformed JSON
        continue;
      }
    }
  }

  return Array.from(tools);
}

/**
 * Extract token usage from stream chunks
 */
function extractTokenUsage(streamChunks) {
  let inputTokens = 0;
  let outputTokens = 0;

  if (!streamChunks || !Array.isArray(streamChunks)) {
    return { inputTokens, outputTokens };
  }

  for (const chunk of streamChunks) {
    if (!chunk.data) continue;
    
    try {
      const chunkData = JSON.parse(chunk.data);
      
      if (chunkData.type === 'message_start') {
        const usage = chunkData.message?.usage;
        if (usage) {
          inputTokens = usage.input_tokens || 0;
          outputTokens = usage.output_tokens || 0;
        }
      } else if (chunkData.type === 'message_delta') {
        const usage = chunkData.usage;
        if (usage && usage.output_tokens) {
          outputTokens = usage.output_tokens;
        }
      }
    } catch (error) {
      // Skip malformed JSON
      continue;
    }
  }

  return { inputTokens, outputTokens };
}

/**
 * Calculate duration between request and response
 */
function calculateDuration(request) {
  const requestTimestamp = request.timestamp;
  const mergedTimestamp = request.mergedContent?.timestamp;

  if (requestTimestamp && mergedTimestamp) {
    try {
      const reqTime = new Date(requestTimestamp);
      const mergedTime = new Date(mergedTimestamp);
      return Math.max(0, mergedTime.getTime() - reqTime.getTime());
    } catch (error) {
      // Fallback to existing metrics
      return request.metrics?.duration || 0;
    }
  }

  return request.metrics?.duration || 0;
}

/**
 * Generate request summary for display
 */
function getRequestSummary(userContent, assistantResponse, toolsUsed = []) {
  if (!userContent) {
    if (toolsUsed.length > 0) {
      return `Tool Usage: ${toolsUsed.slice(0, 3).join(', ')}`;
    } else if (assistantResponse && assistantResponse.length > 10) {
      return `AI Response: ${assistantResponse.substring(0, 60).trim()}...`;
    }
    return 'Unknown Request';
  }

  const reqType = classifyRequestType(userContent, assistantResponse, toolsUsed);
  
  // Truncate content for summary
  let contentPreview = userContent.substring(0, 80).trim();
  if (userContent.length > 80) {
    contentPreview += '...';
  }

  // Add tool info if available
  let toolInfo = '';
  if (toolsUsed.length > 0) {
    toolInfo = ` [${toolsUsed.slice(0, 2).join(', ')}]`;
  }

  // Generate contextual summary based on type
  const typeEmojis = {
    'Code Generation': '🔧',
    'Debugging & Fixing': '🐛',
    'Code Analysis': '🔍',
    'Optimization & Refactoring': '⚡',
    'File Operations': '📁',
    'Documentation': '📝',
    'Configuration & Setup': '⚙️',
    'Data Processing': '📊',
    'Task Management': '📋',
    'Code Execution': '▶️',
    'Web Operations': '🌐',
    'General Query': '❓'
  };

  const emoji = typeEmojis[reqType] || '❓';
  return `${emoji} ${reqType}${toolInfo} - ${contentPreview}`;
}

/**
 * Parse and analyze all requests
 */
export function analyzeRequests(filters = {}) {
  // Get filtered requests if filters are provided
  let allRequests;
  let exportData;
  if (Object.keys(filters).length > 0) {
    const filteredData = requestStore.getAll(filters);
    allRequests = filteredData.data || [];
    // Still need export data for stats
    exportData = requestStore.export();
  } else {
    exportData = requestStore.export();
    allRequests = exportData.requests || [];
  }
  const requestSummary = [];
  const requestTypes = {};
  let totalUserChars = 0;
  let totalAssistantChars = 0;
  let totalDuration = 0;
  let successCount = 0;
  let errorCount = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (let i = 0; i < allRequests.length; i++) {
    const req = allRequests[i];
    
    // Extract content
    const userContent = extractUserContent(req.request?.body?.messages);
    const assistantResponse = extractAssistantResponse(req.streamChunks, req.mergedContent);
    const toolsUsed = extractToolsUsed(req.streamChunks, req.mergedContent);
    const tokenUsage = extractTokenUsage(req.streamChunks);
    const duration = calculateDuration(req);

    // Build request info
    const reqInfo = {
      id: req.id || `req_${i}`,
      timestamp: req.timestamp || '',
      method: req.method || 'POST',
      url: req.url || '/v1/messages',
      status: req.response?.status || (req.status === 'success' ? 200 : (req.status === 'error' ? 500 : 0)),
      userContent,
      assistantResponse,
      toolsUsed,
      durationMs: duration,
      model: req.request?.body?.model || 'Unknown',
      totalInputTokens: tokenUsage.inputTokens,
      totalOutputTokens: tokenUsage.outputTokens,
      summary: getRequestSummary(userContent, assistantResponse, toolsUsed)
    };

    requestSummary.push(reqInfo);

    // Accumulate statistics
    const reqType = classifyRequestType(userContent, assistantResponse, toolsUsed);
    requestTypes[reqType] = (requestTypes[reqType] || 0) + 1;
    
    totalUserChars += userContent.length;
    totalAssistantChars += assistantResponse.length;
    totalDuration += duration;
    totalInputTokens += tokenUsage.inputTokens;
    totalOutputTokens += tokenUsage.outputTokens;

    const responseStatus = req.response?.status;
    if (responseStatus >= 200 && responseStatus < 300) {
      successCount++;
    } else if (responseStatus >= 400 || req.status === 'error' || req.error) {
      errorCount++;
    }
  }

  // Calculate additional analytics
  const analytics = {
    requestTypes,
    totalUserChars,
    totalAssistantChars,
    avgUserChars: allRequests.length > 0 ? Math.floor(totalUserChars / allRequests.length) : 0,
    avgAssistantChars: allRequests.length > 0 ? Math.floor(totalAssistantChars / allRequests.length) : 0,
    totalDurationMs: totalDuration,
    avgDurationMs: allRequests.length > 0 ? Math.floor(totalDuration / allRequests.length) : 0,
    totalInputTokens,
    totalOutputTokens,
    avgInputTokens: allRequests.length > 0 ? Math.floor(totalInputTokens / allRequests.length) : 0,
    avgOutputTokens: allRequests.length > 0 ? Math.floor(totalOutputTokens / allRequests.length) : 0
  };

  // Calculate stats - if filters are applied, use calculated stats from filtered data
  const useFilteredStats = Object.keys(filters).length > 0;
  const exportedStats = useFilteredStats ? {} : (exportData.stats || {});
  
  const stats = {
    totalRequests: useFilteredStats ? allRequests.length : (exportedStats.totalRequests || allRequests.length),
    successCount: useFilteredStats ? successCount : (exportedStats.successCount || successCount),
    errorCount: useFilteredStats ? errorCount : (exportedStats.errorCount || errorCount),
    successRate: allRequests.length > 0 ? `${Math.round(successCount / allRequests.length * 100)}%` : '0%',
    avgDuration: analytics.avgDurationMs > 0 ? `${analytics.avgDurationMs}ms` : '0ms'
  };

  return {
    stats,
    requests: requestSummary,
    analytics,
    filters: filters || {}
  };
}

/**
 * Generate HTML analysis report
 */
export function generateAnalysisHTML(parsedData, filters = {}) {
  const { stats, requests, analytics, filters: dataFilters } = parsedData;
  // Use filters from data if available, otherwise use passed filters
  const activeFilters = dataFilters && Object.keys(dataFilters).length > 0 ? dataFilters : filters;
  const exportData = requestStore.export();
  const allRequests = exportData.requests || [];
  
  // Create filter info for display
  const filterInfo = Object.keys(activeFilters).length > 0 ? 
    ` (Filtered: ${Object.entries(activeFilters).map(([k, v]) => `${k}=${v}`).join(', ')})` : 
    '';
  
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Anthropic Proxy Analysis Report</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background-color: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #2c3e50;
            text-align: center;
            margin-bottom: 30px;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }
        .stat-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
        }
        .stat-value {
            font-size: 2em;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .stat-label {
            font-size: 0.9em;
            opacity: 0.9;
        }
        .requests-section {
            margin-top: 40px;
        }
        .request-item {
            border: 1px solid #ddd;
            margin-bottom: 20px;
            border-radius: 8px;
            overflow: hidden;
        }
        .request-header {
            background-color: #f8f9fa;
            padding: 15px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: pointer;
        }
        .request-header:hover {
            background-color: #e9ecef;
        }
        .request-details {
            padding: 20px;
            display: none;
            background-color: #fff;
        }
        .request-details.active {
            display: block;
        }
        .view-full-btn {
            background-color: #007bff;
            color: white;
            border: none;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.8em;
            cursor: pointer;
            margin-left: 8px;
        }
        .view-full-btn:hover {
            background-color: #0056b3;
        }
        .modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.5);
        }
        .modal-content {
            background-color: white;
            margin: 5% auto;
            padding: 20px;
            border-radius: 8px;
            width: 90%;
            max-width: 1000px;
            max-height: 80vh;
            overflow-y: auto;
            position: relative;
        }
        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid #ddd;
        }
        .close {
            color: #aaa;
            font-size: 28px;
            font-weight: bold;
            cursor: pointer;
        }
        .close:hover {
            color: black;
        }
        .modal-section {
            margin-bottom: 20px;
        }
        .modal-section h3 {
            margin: 0 0 10px 0;
            color: #333;
        }
        .modal-content-box {
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 4px;
            border-left: 4px solid #007bff;
            white-space: pre-wrap;
            font-family: monospace;
            font-size: 0.9em;
            max-height: 400px;
            overflow-y: auto;
        }
        .json-content {
            background-color: #1e1e1e;
            color: #d4d4d4;
            padding: 15px;
            border-radius: 4px;
            border-left: 4px solid #007bff;
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
            font-size: 0.85em;
            max-height: 500px;
            overflow-y: auto;
            line-height: 1.4;
        }
        .json-content pre {
            margin: 0;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        .copy-btn {
            position: absolute;
            top: 10px;
            right: 10px;
            background-color: #28a745;
            color: white;
            border: none;
            padding: 5px 10px;
            border-radius: 4px;
            font-size: 0.8em;
            cursor: pointer;
        }
        .copy-btn:hover {
            background-color: #218838;
        }
        .json-section {
            position: relative;
        }
        .status-success {
            color: #28a745;
            font-weight: bold;
        }
        .status-error {
            color: #dc3545;
            font-weight: bold;
        }
        .user-content {
            background-color: #e3f2fd;
            padding: 15px;
            border-radius: 4px;
            margin: 10px 0;
            border-left: 4px solid #2196f3;
            max-height: 300px;
            overflow-y: auto;
        }
        .assistant-response {
            background-color: #e8f5e8;
            padding: 15px;
            border-radius: 4px;
            margin: 10px 0;
            border-left: 4px solid #4caf50;
            max-height: 400px;
            overflow-y: auto;
            white-space: pre-wrap;
            font-family: monospace;
            font-size: 0.9em;
        }
        .tools-used {
            background-color: #f3e5f5;
            padding: 15px;
            border-radius: 4px;
            margin: 10px 0;
            border-left: 4px solid #9c27b0;
        }
        .content-summary {
            background-color: #fff3cd;
            padding: 10px;
            border-radius: 4px;
            margin: 5px 0;
            border-left: 4px solid #ffc107;
            font-weight: bold;
            color: #856404;
        }
        .timestamp {
            color: #6c757d;
            font-size: 0.9em;
        }
        .request-id {
            font-family: monospace;
            font-size: 0.8em;
            color: #6c757d;
        }
        .duration {
            background-color: #fff3cd;
            color: #856404;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.9em;
        }
        .tool-tag {
            background-color: #6f42c1;
            color: white;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 0.8em;
            margin-right: 5px;
        }
        .model-info {
            background-color: #e1f5fe;
            color: #01579b;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.8em;
            margin-right: 8px;
            font-weight: bold;
        }
        .token-info {
            background-color: #f3e5f5;
            color: #4a148c;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.8em;
            margin-right: 8px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Anthropic Proxy Analysis Report${filterInfo}</h1>
        
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value">${stats.totalRequests}</div>
                <div class="stat-label">Total Requests</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.successCount}</div>
                <div class="stat-label">Successful Requests</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.errorCount}</div>
                <div class="stat-label">Failed Requests</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.successRate}</div>
                <div class="stat-label">Success Rate</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.avgDuration}</div>
                <div class="stat-label">Average Duration</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${analytics.totalDurationMs > 0 ? analytics.totalDurationMs.toLocaleString() + 'ms' : 'N/A'}</div>
                <div class="stat-label">Total Duration</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${analytics.avgUserChars.toLocaleString()}</div>
                <div class="stat-label">Avg User Input Chars</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${analytics.avgAssistantChars.toLocaleString()}</div>
                <div class="stat-label">Avg Response Chars</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${analytics.totalInputTokens.toLocaleString()}</div>
                <div class="stat-label">Total Input Tokens</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${analytics.totalOutputTokens.toLocaleString()}</div>
                <div class="stat-label">Total Output Tokens</div>
            </div>
        </div>
        
        <div class="requests-section">
            <h2>Request Type Distribution</h2>
            <div class="stats-grid">`;

  // Add request type distribution
  for (const [reqType, count] of Object.entries(analytics.requestTypes)) {
    const percentage = requests.length > 0 ? (count / requests.length * 100) : 0;
    html += `
                <div class="stat-card">
                    <div class="stat-value">${count}</div>
                    <div class="stat-label">${reqType} (${percentage.toFixed(1)}%)</div>
                </div>`;
  }

  let requestListHtml = `
            </div>
        </div>
        
        <div class="requests-section">
            <h2>Request Details (${requests.length} requests)</h2>`;

  // Add individual requests
  for (let i = 0; i < requests.length; i++) {
    const req = requests[i];
    const timestampFormatted = req.timestamp ? new Date(req.timestamp).toLocaleString() : '';
    const statusClass = req.status === 200 ? 'status-success' : 'status-error';
    
    let toolsHtml = '';
    if (req.toolsUsed && req.toolsUsed.length > 0) {
      toolsHtml = '<div class="tools-used"><strong>Tools Used:</strong><br>';
      for (const tool of req.toolsUsed) {
        toolsHtml += `<span class="tool-tag">${tool}</span>`;
      }
      toolsHtml += '</div>';
    }

    let assistantResponseHtml = '';
    if (req.assistantResponse) {
      const escapedResponse = req.assistantResponse.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const truncatedResponse = escapedResponse.length > 2000 ? 
        escapedResponse.substring(0, 2000) + '\n\n... (content truncated)' : 
        escapedResponse;
      assistantResponseHtml = `<div class="assistant-response"><strong>Assistant Response:</strong><br>${truncatedResponse}</div>`;
    }

    // Format model name for display
    const modelDisplay = req.model
      .replace('claude-3-5-haiku-20241022', 'Claude-3.5-Haiku')
      .replace('claude-3-5-sonnet-20241022', 'Claude-3.5-Sonnet')
      .replace('claude-3-opus-20240229', 'Claude-3-Opus');

    const durationDisplay = req.durationMs > 0 ? `${req.durationMs.toLocaleString()}ms` : "0ms";
    const tokenDisplay = req.totalInputTokens > 0 || req.totalOutputTokens > 0 ? 
      `${req.totalInputTokens}→${req.totalOutputTokens}` : "";

    requestListHtml += `
            <div class="request-item">
                <div class="request-header" onclick="toggleRequest(${i})">
                    <div>
                        <strong>Request #${i + 1}</strong> - ${req.summary}
                        <span class="timestamp">${timestampFormatted}</span>
                        <div class="request-id">${req.id}</div>
                    </div>
                    <div>
                        <span class="model-info">${modelDisplay}</span>
                        ${tokenDisplay ? `<span class="token-info">${tokenDisplay}</span>` : ''}
                        <span class="${statusClass}">Status: ${req.status}</span>
                        <span class="duration">${durationDisplay}</span>
                        <button class="view-full-btn" onclick="event.stopPropagation(); showFullRequest(${i})">View Full</button>
                    </div>
                </div>
                <div class="request-details" id="request-${i}">
                    <div class="content-summary">${req.summary}</div>
                    <div><strong>Model Used:</strong> <span class="model-info">${modelDisplay}</span></div>
                    <div><strong>Request Method:</strong> ${req.method}</div>
                    <div><strong>Request URL:</strong> ${req.url}</div>
                    ${req.totalInputTokens > 0 || req.totalOutputTokens > 0 ? 
                      `<div><strong>Token Usage:</strong> <span class="token-info">Input: ${req.totalInputTokens} | Output: ${req.totalOutputTokens}</span></div>` : 
                      ''}
                    
                    ${req.userContent ? 
                      `<div class="user-content"><strong>User Input:</strong><br>${req.userContent.substring(0, 500)}${req.userContent.length > 500 ? "..." : ""}</div>` : 
                      ''}
                    
                    ${assistantResponseHtml}
                    
                    ${toolsHtml}
                    
                    <div><strong>Response Status:</strong> <span class="${statusClass}">${req.status}</span></div>
                    <div><strong>Processing Duration:</strong> ${durationDisplay}</div>
                </div>
            </div>`;
  }

  const finalHtml = html + requestListHtml + `
        </div>
    </div>
    
    <!-- Modal for full request content -->
    <div id="fullRequestModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2 id="modalTitle">Request Details</h2>
                <span class="close" onclick="closeModal()">&times;</span>
            </div>
            <div id="modalBody">
                <!-- Content will be loaded here -->
            </div>
        </div>
    </div>
    
    <script type="application/json" id="requestsData">${JSON.stringify(requests, null, 2).replace(/</g, '\\u003C').replace(/>/g, '\\u003E')}</script>
    <script type="application/json" id="originalRequestsData">${JSON.stringify(allRequests, null, 2).replace(/</g, '\\u003C').replace(/>/g, '\\u003E')}</script>
    <script>
        // Global variables
        let requestsData = null;
        let originalRequestsData = null;
        
        // Initialize data when DOM is ready
        document.addEventListener('DOMContentLoaded', function() {
            requestsData = JSON.parse(document.getElementById('requestsData').textContent);
            originalRequestsData = JSON.parse(document.getElementById('originalRequestsData').textContent);
        });
        
        function toggleRequest(index) {
            const details = document.getElementById(\`request-\${index}\`);
            details.classList.toggle('active');
        }
        
        function showFullRequest(index) {
            if (!requestsData || !originalRequestsData) {
                alert('Data is loading, please try again...');
                return;
            }
            const request = requestsData[index];
            const originalRequest = originalRequestsData[index];
            const modal = document.getElementById('fullRequestModal');
            const modalTitle = document.getElementById('modalTitle');
            const modalBody = document.getElementById('modalBody');
            
            modalTitle.textContent = \`Request #\${index + 1} - \${request.id}\`;
            
            const jsonString = JSON.stringify(originalRequest, null, 2);
            
            modalBody.innerHTML = \`
                <div class="modal-section json-section">
                    <h3>📋 Complete Request JSON Content</h3>
                    <button class="copy-btn" onclick="copyToClipboard(\${index})">Copy JSON</button>
                    <div class="json-content">
                        <pre id="json-content-\${index}">\${jsonString}</pre>
                    </div>
                </div>
                
                <div class="modal-section">
                    <h3>📊 Parsed Information</h3>
                    <div class="modal-content-box">
Request ID: \${request.id || 'N/A'}
Time: \${request.timestamp ? new Date(request.timestamp).toLocaleString() : 'N/A'}
Method: \${request.method || 'N/A'}
URL: \${request.url || 'N/A'}
Model: \${request.model || 'N/A'}
Status: \${request.status || 'N/A'}
Duration: \${request.durationMs ? request.durationMs.toLocaleString() + 'ms' : 'N/A'}
Input Tokens: \${request.totalInputTokens || 0}
Output Tokens: \${request.totalOutputTokens || 0}
Tools Used: \${request.toolsUsed ? request.toolsUsed.join(', ') : 'None'}
                    </div>
                </div>
                
                \${request.userContent ? \`
                <div class="modal-section">
                    <h3>👤 User Input</h3>
                    <div class="modal-content-box">\${request.userContent}</div>
                </div>
                \` : ''}
                
                \${request.assistantResponse ? \`
                <div class="modal-section">
                    <h3>🤖 Assistant Response</h3>
                    <div class="modal-content-box">\${request.assistantResponse}</div>
                </div>
                \` : ''}
            \`;
            
            modal.style.display = 'block';
        }
        
        function copyToClipboard(index) {
            if (!originalRequestsData) {
                alert('Data is loading, please try again...');
                return;
            }
            const originalRequest = originalRequestsData[index];
            const jsonString = JSON.stringify(originalRequest, null, 2);
            
            navigator.clipboard.writeText(jsonString).then(() => {
                const btn = event.target;
                const originalText = btn.textContent;
                btn.textContent = 'Copied!';
                btn.style.backgroundColor = '#28a745';
                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.style.backgroundColor = '#28a745';
                }, 2000);
            }).catch(err => {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = jsonString;
                document.body.appendChild(textArea);
                textArea.select();
                try {
                    document.execCommand('copy');
                    const btn = event.target;
                    const originalText = btn.textContent;
                    btn.textContent = 'Copied!';
                    setTimeout(() => {
                        btn.textContent = originalText;
                    }, 2000);
                } catch (err) {
                    console.error('Copy failed:', err);
                }
                document.body.removeChild(textArea);
            });
        }
        
        function closeModal() {
            document.getElementById('fullRequestModal').style.display = 'none';
        }
        
        // Close modal when clicking outside of it
        window.onclick = function(event) {
            const modal = document.getElementById('fullRequestModal');
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        }
        
        // Close modal with Escape key
        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape') {
                closeModal();
            }
        });
        
        // Add summary at the top
        document.addEventListener('DOMContentLoaded', function() {
            console.log('Anthropic Proxy Analysis Report loaded');
        });
    </script>
</body>
</html>`;

  return finalHtml;
}