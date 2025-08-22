/**
 * Monitor Web UI HTML Generator
 */

export function getMonitorHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Anthropic Proxy Monitor</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js" defer></script>
    <style>
        [x-cloak] { display: none !important; }
        .json-view { 
            background: #1e293b; 
            color: #e2e8f0; 
            font-family: 'Monaco', 'Courier New', monospace;
            font-size: 12px;
        }
        .scroll-container {
            max-height: 400px;
            overflow-y: auto;
        }
        .chunk-timeline {
            position: relative;
            padding-left: 20px;
        }
        .chunk-timeline::before {
            content: '';
            position: absolute;
            left: 5px;
            top: 0;
            bottom: 0;
            width: 2px;
            background: #3b82f6;
        }
        .chunk-dot {
            position: absolute;
            left: 2px;
            width: 8px;
            height: 8px;
            background: #3b82f6;
            border-radius: 50%;
        }
    </style>
</head>
<body class="bg-gray-100">
    <div x-data="monitorApp()" x-init="init()" x-cloak>
        <!-- Header -->
        <div class="bg-white shadow-sm border-b">
            <div class="container mx-auto px-4 py-4">
                <div class="flex justify-between items-center">
                    <h1 class="text-2xl font-bold text-gray-800">🚀 Anthropic Proxy Monitor</h1>
                    <div class="flex gap-2">
                        <button @click="showAnalysis()" class="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600">
                            Analyze
                        </button>
                        <button @click="exportData()" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                            Export Data
                        </button>
                        <button @click="exportCompressData()" class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
                            Export Compress Data
                        </button>
                        <button @click="clearData()" class="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600">
                            Clear All
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Stats Dashboard -->
        <div class="container mx-auto px-4 py-6">
            <div class="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                <div class="bg-white rounded-lg shadow p-4">
                    <div class="text-sm text-gray-600">Total Requests</div>
                    <div class="text-2xl font-bold" x-text="stats.totalRequests"></div>
                </div>
                <div class="bg-white rounded-lg shadow p-4">
                    <div class="text-sm text-gray-600">Success Rate</div>
                    <div class="text-2xl font-bold text-green-600" x-text="stats.successRate"></div>
                </div>
                <div class="bg-white rounded-lg shadow p-4">
                    <div class="text-sm text-gray-600">Avg Duration</div>
                    <div class="text-2xl font-bold text-blue-600" x-text="stats.avgDuration"></div>
                </div>
                <div class="bg-white rounded-lg shadow p-4">
                    <div class="text-sm text-gray-600">Active</div>
                    <div class="text-2xl font-bold text-orange-600" x-text="stats.activeRequests"></div>
                </div>
                <div class="bg-white rounded-lg shadow p-4">
                    <div class="text-sm text-gray-600">Total Size</div>
                    <div class="text-2xl font-bold text-purple-600" x-text="formatSize(calculateTotalSize())"></div>
                </div>
            </div>

            <!-- Filters -->
            <div class="bg-white rounded-lg shadow p-4 mb-6">
                <div class="flex gap-4">
                    <select x-model="filters.status" @change="applyFilters()" class="px-3 py-2 border rounded">
                        <option value="">All Status</option>
                        <option value="success">Success</option>
                        <option value="error">Error</option>
                        <option value="pending">Pending</option>
                    </select>
                    <select x-model="filters.model" @change="applyFilters()" class="px-3 py-2 border rounded">
                        <option value="">All Models</option>
                        <template x-for="model in availableModels" :key="model.value">
                            <option :value="model.value" x-text="model.label"></option>
                        </template>
                    </select>
                    <select x-model="filters.timeRange" @change="applyFilters()" class="px-3 py-2 border rounded">
                        <option value="">All Time</option>
                        <option value="1h">Last Hour</option>
                        <option value="24h">Last 24 Hours</option>
                        <option value="7d">Last 7 Days</option>
                    </select>
                    <label class="flex items-center gap-2">
                        <input type="checkbox" x-model="autoRefresh" @change="toggleAutoRefresh()" class="rounded">
                        <span>Auto Refresh</span>
                    </label>
                </div>
            </div>

            <!-- Request List -->
            <div class="bg-white rounded-lg shadow">
                <table class="w-full">
                    <thead class="bg-gray-50 border-b">
                        <tr>
                            <th class="px-4 py-3 text-left text-sm font-medium text-gray-700">Time</th>
                            <th class="px-4 py-3 text-left text-sm font-medium text-gray-700">Model</th>
                            <th class="px-4 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                            <th class="px-4 py-3 text-left text-sm font-medium text-gray-700">Duration</th>
                            <th class="px-4 py-3 text-left text-sm font-medium text-gray-700">Tokens</th>
                            <th class="px-4 py-3 text-left text-sm font-medium text-gray-700">Size</th>
                            <th class="px-4 py-3 text-left text-sm font-medium text-gray-700">Stream</th>
                            <th class="px-4 py-3 text-left text-sm font-medium text-gray-700">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y">
                        <template x-for="request in requests" :key="request.id">
                            <tr :class="{
                                'bg-blue-50 border-l-4 border-l-blue-500': selectedRequestId === request.id,
                                'hover:bg-gray-50': selectedRequestId !== request.id
                            }" class="cursor-pointer transition-colors" @click="showDetails(request)">
                                <td class="px-4 py-3 text-sm" x-text="formatTime(request.timestamp)"></td>
                                <td class="px-4 py-3 text-sm">
                                    <span x-text="formatModel(request.request?.body?.model)"></span>
                                </td>
                                <td class="px-4 py-3 text-sm">
                                    <span :class="{
                                        'text-green-600': request.status === 'success',
                                        'text-red-600': request.status === 'error',
                                        'text-orange-600': request.status === 'pending'
                                    }" x-text="request.status"></span>
                                </td>
                                <td class="px-4 py-3 text-sm">
                                    <span x-text="request.metrics?.duration ? request.metrics.duration + 'ms' : '-'"></span>
                                </td>
                                <td class="px-4 py-3 text-sm">
                                    <span x-text="formatTokens(request.metrics)"></span>
                                </td>
                                <td class="px-4 py-3 text-sm">
                                    <span x-text="formatBytes(request.metrics?.totalSize)" class="text-gray-600"></span>
                                </td>
                                <td class="px-4 py-3 text-sm">
                                    <span x-text="request.streamChunks?.length > 0 ? '✓ ' + request.streamChunks.length : '-'"></span>
                                </td>
                                <td class="px-4 py-3 text-sm">
                                    <button @click.stop="showDetails(request)" class="text-blue-600 hover:underline">
                                        Details
                                    </button>
                                </td>
                            </tr>
                        </template>
                    </tbody>
                </table>
                <div x-show="requests.length === 0" class="p-8 text-center text-gray-500">
                    No requests yet
                </div>
            </div>
        </div>

        <!-- Detail Modal -->
        <div x-show="selectedRequest" @click="closeModal()" 
             class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" x-cloak>
            <div class="bg-white rounded-lg shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto" @click.stop>
                <div class="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
                    <h2 class="text-xl font-bold">Request Details</h2>
                    <button @click="closeModal()" class="text-gray-500 hover:text-gray-700">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
                
                <div class="p-6" x-show="selectedRequest">
                    <!-- Request Info -->
                    <div class="mb-6">
                        <div class="flex justify-between items-center mb-2">
                            <h3 class="text-lg font-semibold">Request Information</h3>
                            <button @click="copyToClipboard(getRequestInfo(selectedRequest), 'Request Info')" 
                                    class="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-1">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                                </svg>
                                Copy
                            </button>
                        </div>
                        <div class="bg-gray-50 rounded p-4">
                            <div class="grid grid-cols-3 gap-4">
                                <div>
                                    <span class="text-sm text-gray-600">ID:</span>
                                    <span class="font-mono text-sm" x-text="selectedRequest?.id"></span>
                                </div>
                                <div>
                                    <span class="text-sm text-gray-600">Time:</span>
                                    <span x-text="selectedRequest?.timestamp"></span>
                                </div>
                                <div>
                                    <span class="text-sm text-gray-600">Duration:</span>
                                    <span x-text="selectedRequest?.metrics?.duration + 'ms'"></span>
                                </div>
                                <div>
                                    <span class="text-sm text-gray-600">Status:</span>
                                    <span x-text="selectedRequest?.status"></span>
                                </div>
                                <div>
                                    <span class="text-sm text-gray-600">Request Size:</span>
                                    <span x-text="formatBytes(selectedRequest?.metrics?.requestSize)"></span>
                                </div>
                                <div>
                                    <span class="text-sm text-gray-600">Response Size:</span>
                                    <span x-text="formatBytes(selectedRequest?.metrics?.responseSize)"></span>
                                </div>
                                <div>
                                    <span class="text-sm text-gray-600">Total Size:</span>
                                    <span class="font-semibold" x-text="formatBytes(selectedRequest?.metrics?.totalSize)"></span>
                                </div>
                                <div>
                                    <span class="text-sm text-gray-600">Input Tokens:</span>
                                    <span x-text="selectedRequest?.metrics?.inputTokens || 0"></span>
                                </div>
                                <div>
                                    <span class="text-sm text-gray-600">Output Tokens:</span>
                                    <span x-text="selectedRequest?.metrics?.outputTokens || 0"></span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Request Headers -->
                    <div class="mb-6" x-data="{ expanded: false }">
                        <div class="flex justify-between items-center mb-2">
                            <button @click="expanded = !expanded" class="flex items-center gap-2 text-lg font-semibold hover:text-blue-600">
                                <svg class="w-4 h-4 transition-transform" :class="{ 'rotate-90': expanded }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                                </svg>
                                Request Headers
                            </button>
                            <button @click="copyToClipboard(JSON.stringify(selectedRequest?.request?.headers, null, 2), 'Request Headers')" 
                                    class="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-1">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                                </svg>
                                Copy
                            </button>
                        </div>
                        <pre x-show="expanded" x-transition class="json-view rounded p-4 scroll-container" x-text="JSON.stringify(selectedRequest?.request?.headers, null, 2)"></pre>
                    </div>

                    <!-- Request Body -->
                    <div class="mb-6">
                        <div class="flex justify-between items-center mb-2">
                            <h3 class="text-lg font-semibold">Request Body</h3>
                            <button @click="copyToClipboard(JSON.stringify(selectedRequest?.request?.body, null, 2), 'Request Body')" 
                                    class="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-1">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                                </svg>
                                Copy
                            </button>
                        </div>
                        <pre class="json-view rounded p-4 scroll-container" x-text="JSON.stringify(selectedRequest?.request?.body, null, 2)"></pre>
                    </div>

                    <!-- Response -->
                    <div class="mb-6" x-show="selectedRequest?.response">
                        <div class="flex justify-between items-center mb-2">
                            <h3 class="text-lg font-semibold">Response</h3>
                            <button @click="copyToClipboard(JSON.stringify(selectedRequest?.response?.body, null, 2), 'Response')" 
                                    class="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-1">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                                </svg>
                                Copy
                            </button>
                        </div>
                        <pre class="json-view rounded p-4 scroll-container" x-text="JSON.stringify(selectedRequest?.response?.body, null, 2)"></pre>
                    </div>

                    <!-- Stream Chunks Timeline (Only in DEBUG mode) -->
                    <div class="mb-6" x-show="selectedRequest?.streamChunks?.length > 0 && isDebugMode">
                        <div class="flex justify-between items-center mb-2">
                            <h3 class="text-lg font-semibold">Stream Chunks (<span x-text="selectedRequest?.streamChunks?.length"></span>)</h3>
                            <button @click="copyToClipboard(getStreamChunksText(selectedRequest?.streamChunks), 'Stream Chunks')" 
                                    class="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-1">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                                </svg>
                                Copy All
                            </button>
                        </div>
                        <div class="bg-gray-50 rounded p-4 scroll-container">
                            <div class="chunk-timeline space-y-2">
                                <template x-for="(chunk, index) in (selectedRequest?.streamChunks || [])" :key="index">
                                    <div class="ml-4 p-2 bg-white rounded border relative">
                                        <div class="chunk-dot"></div>
                                        <div class="flex justify-between items-center">
                                            <div class="text-xs text-gray-500" x-text="chunk.timestamp"></div>
                                            <button @click="copyToClipboard(formatChunk(chunk.data), 'Chunk ' + (index + 1))" 
                                                    class="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300">
                                                Copy
                                            </button>
                                        </div>
                                        <pre class="text-xs mt-1" x-text="formatChunk(chunk.data)"></pre>
                                    </div>
                                </template>
                            </div>
                        </div>
                    </div>

                    <!-- Merged Content -->
                    <div class="mb-6" x-show="selectedRequest?.mergedContent">
                        <div class="flex justify-between items-center mb-2">
                            <h3 class="text-lg font-semibold">Merged Content</h3>
                            <button @click="copyToClipboard(JSON.stringify(selectedRequest?.mergedContent, null, 2), 'Merged Content')" 
                                    class="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-1">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                                </svg>
                                Copy
                            </button>
                        </div>
                        <pre class="json-view rounded p-4 scroll-container" x-text="JSON.stringify(selectedRequest?.mergedContent, null, 2)"></pre>
                    </div>

                    <!-- Error -->
                    <div class="mb-6" x-show="selectedRequest?.error">
                        <div class="flex justify-between items-center mb-2">
                            <h3 class="text-lg font-semibold text-red-600">Error</h3>
                            <button @click="copyToClipboard(JSON.stringify(selectedRequest?.error, null, 2), 'Error Details')" 
                                    class="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 flex items-center gap-1">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                                </svg>
                                Copy
                            </button>
                        </div>
                        <pre class="bg-red-50 text-red-800 rounded p-4" x-text="JSON.stringify(selectedRequest?.error, null, 2)"></pre>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        function monitorApp() {
            return {
                requests: [],
                stats: {},
                filters: {
                    status: '',
                    model: '',
                    timeRange: ''
                },
                selectedRequest: null,
                selectedRequestId: null,
                autoRefresh: true,
                eventSource: null,
                refreshInterval: null,
                availableModels: [],
                isDebugMode: false,

                async init() {
                    await this.loadConfig();
                    await this.loadAvailableModels();
                    await this.loadStats();
                    await this.loadRequests();
                    this.startRealTimeUpdates();
                    
                    if (this.autoRefresh) {
                        this.startAutoRefresh();
                    }
                },

                async loadConfig() {
                    try {
                        const response = await fetch('/api/monitor/config');
                        const config = await response.json();
                        this.isDebugMode = config.logLevel === 'DEBUG';
                    } catch (error) {
                        console.error('Failed to load config:', error);
                    }
                },

                async loadStats() {
                    try {
                        const params = new URLSearchParams(this.filters);
                        const response = await fetch('/api/monitor/stats?' + params);
                        this.stats = await response.json();
                    } catch (error) {
                        console.error('Failed to load stats:', error);
                    }
                },

                async loadRequests() {
                    try {
                        const params = new URLSearchParams(this.filters);
                        const response = await fetch('/api/monitor/requests?' + params);
                        const data = await response.json();
                        this.requests = data.data;
                        this.updateAvailableModels();
                    } catch (error) {
                        console.error('Failed to load requests:', error);
                    }
                },

                async applyFilters() {
                    // Load both stats and requests when filters change
                    await Promise.all([
                        this.loadStats(),
                        this.loadRequests()
                    ]);
                },

                async loadAvailableModels() {
                    try {
                        // Load all requests without filters to get complete model list
                        const response = await fetch('/api/monitor/requests');
                        const data = await response.json();
                        const allRequests = data.data;
                        
                        const modelsSet = new Set();
                        allRequests.forEach(request => {
                            const model = request.request?.body?.model;
                            if (model) {
                                modelsSet.add(model);
                            }
                        });
                        
                        this.availableModels = Array.from(modelsSet).map(model => ({
                            value: model,
                            label: this.getModelDisplayName(model)
                        })).sort((a, b) => a.label.localeCompare(b.label));
                    } catch (error) {
                        console.error('Failed to load available models:', error);
                    }
                },

                checkAndUpdateNewModel(request) {
                    const model = request.request?.body?.model;
                    if (model) {
                        const modelExists = this.availableModels.some(m => m.value === model);
                        if (!modelExists) {
                            // Add new model to the list
                            this.availableModels.push({
                                value: model,
                                label: this.getModelDisplayName(model)
                            });
                            // Re-sort the list
                            this.availableModels.sort((a, b) => a.label.localeCompare(b.label));
                        }
                    }
                },

                updateAvailableModels() {
                    // This function is kept for compatibility but now only used for checking new models
                    // The main model list is loaded via loadAvailableModels()
                },

                getModelDisplayName(model) {
                    if (!model) return 'Unknown';
                    
                    // Claude 4 models
                    if (model.includes('claude-4') || model.includes('opus-4')) {
                        if (model.includes('sonnet')) return 'Claude 4 Sonnet';
                        if (model.includes('opus')) return 'Claude 4 Opus';
                        if (model.includes('haiku')) return 'Claude 4 Haiku';
                        return 'Claude 4';
                    }
                    
                    // Claude 3.5 models
                    if (model.includes('claude-3-5') || model.includes('3.5')) {
                        if (model.includes('sonnet')) return 'Claude 3.5 Sonnet';
                        if (model.includes('haiku')) return 'Claude 3.5 Haiku';
                        return 'Claude 3.5';
                    }
                    
                    // Claude 3 models
                    if (model.includes('claude-3')) {
                        if (model.includes('opus')) return 'Claude 3 Opus';
                        if (model.includes('sonnet')) return 'Claude 3 Sonnet';
                        if (model.includes('haiku')) return 'Claude 3 Haiku';
                        return 'Claude 3';
                    }
                    
                    // Fallback: return the original model name
                    return model;
                },

                startRealTimeUpdates() {
                    this.eventSource = new EventSource('/api/monitor/stream');
                    
                    this.eventSource.onmessage = (event) => {
                        const data = JSON.parse(event.data);
                        
                        if (data.type === 'request') {
                            // Add or update request
                            const index = this.requests.findIndex(r => r.id === data.request.id);
                            if (index >= 0) {
                                this.requests[index] = data.request;
                            } else {
                                this.requests.unshift(data.request);
                                // Keep max 100 items in view
                                if (this.requests.length > 100) {
                                    this.requests.pop();
                                }
                                // Check if new model appeared and update model list
                                this.checkAndUpdateNewModel(data.request);
                            }
                        } else if (data.type === 'stats') {
                            this.stats = data.stats;
                        }
                    };
                },

                startAutoRefresh() {
                    this.refreshInterval = setInterval(() => {
                        this.loadStats();
                    }, 5000);
                },

                toggleAutoRefresh() {
                    if (this.autoRefresh) {
                        this.startAutoRefresh();
                    } else {
                        if (this.refreshInterval) {
                            clearInterval(this.refreshInterval);
                            this.refreshInterval = null;
                        }
                    }
                },

                showDetails(request) {
                    this.selectedRequest = request;
                    this.selectedRequestId = request.id;
                },

                closeModal() {
                    this.selectedRequest = null;
                    // Keep selectedRequestId to maintain row highlighting
                },

                formatTime(timestamp) {
                    const date = new Date(timestamp);
                    return date.toLocaleTimeString();
                },

                formatModel(model) {
                    if (!model) return '-';
                    if (model.includes('opus')) return 'Opus';
                    if (model.includes('sonnet')) return 'Sonnet';
                    if (model.includes('haiku')) return 'Haiku';
                    return model;
                },

                formatSize(bytes) {
                    if (!bytes || bytes === 0) return '0 B';
                    const k = 1024;
                    const sizes = ['B', 'KB', 'MB', 'GB'];
                    const i = Math.floor(Math.log(bytes) / Math.log(k));
                    return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
                },

                calculateTotalSize() {
                    return this.requests.reduce((total, request) => {
                        const reqSize = request.metrics?.requestSize || 0;
                        const resSize = request.metrics?.responseSize || 0;
                        return total + reqSize + resSize;
                    }, 0);
                },

                formatTokens(metrics) {
                    if (!metrics) return '-';
                    const input = metrics.inputTokens || 0;
                    const output = metrics.outputTokens || 0;
                    if (input === 0 && output === 0) return '-';
                    return \`\${input}/\${output}\`;
                },

                formatChunk(chunkData) {
                    try {
                        const parsed = JSON.parse(chunkData);
                        return JSON.stringify(parsed, null, 2);
                    } catch {
                        return chunkData;
                    }
                },

                formatBytes(bytes) {
                    if (!bytes || bytes === 0) return '0 B';
                    const k = 1024;
                    const sizes = ['B', 'KB', 'MB', 'GB'];
                    const i = Math.floor(Math.log(bytes) / Math.log(k));
                    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
                },

                getRequestInfo(request) {
                    if (!request) return '';
                    return JSON.stringify({
                        id: request.id,
                        timestamp: request.timestamp,
                        method: request.method,
                        url: request.url,
                        status: request.status,
                        metrics: request.metrics
                    }, null, 2);
                },

                getStreamChunksText(chunks) {
                    if (!chunks || chunks.length === 0) return '';
                    return chunks.map((chunk, index) => 
                        \`=== Chunk \${index + 1} [\${chunk.timestamp}] ===\\n\${this.formatChunk(chunk.data)}\`
                    ).join('\\n\\n');
                },

                async copyToClipboard(text, label) {
                    try {
                        if (navigator.clipboard && navigator.clipboard.writeText) {
                            await navigator.clipboard.writeText(text);
                        } else {
                            // Fallback for older browsers or non-HTTPS contexts
                            const textArea = document.createElement('textarea');
                            textArea.value = text;
                            textArea.style.position = 'fixed';
                            textArea.style.opacity = '0';
                            document.body.appendChild(textArea);
                            textArea.focus();
                            textArea.select();
                            document.execCommand('copy');
                            document.body.removeChild(textArea);
                        }
                        this.showNotification(\`\${label} copied to clipboard!\`, 'success');
                    } catch (error) {
                        console.error('Copy failed:', error);
                        this.showNotification('Copy failed. Please try again.', 'error');
                    }
                },

                showNotification(message, type = 'info') {
                    // Create a simple notification
                    const notification = document.createElement('div');
                    notification.className = \`fixed top-4 right-4 z-50 px-4 py-2 rounded shadow-lg text-white \${
                        type === 'success' ? 'bg-green-500' : 
                        type === 'error' ? 'bg-red-500' : 'bg-blue-500'
                    }\`;
                    notification.textContent = message;
                    
                    document.body.appendChild(notification);
                    
                    // Auto remove after 3 seconds
                    setTimeout(() => {
                        notification.remove();
                    }, 3000);
                },

                async exportData() {
                    try {
                        const params = new URLSearchParams(this.filters);
                        const response = await fetch('/api/monitor/export?' + params);
                        const data = await response.json();
                        
                        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = \`proxy-monitor-filtered-\${Date.now()}.json\`;
                        a.click();
                        URL.revokeObjectURL(url);
                        
                        this.showNotification('Data exported successfully!', 'success');
                    } catch (error) {
                        console.error('Failed to export data:', error);
                        this.showNotification('Failed to export data', 'error');
                    }
                },

                async exportCompressData() {
                    try {
                        const params = new URLSearchParams(this.filters);
                        const response = await fetch('/api/monitor/export?' + params);
                        const data = await response.json();
                        
                        // 使用增量去重算法压缩数据
                        const compressedResult = this.performIncrementalDeduplication(data);
                        
                        // 只导出压缩后的数据
                        const compressedBlob = new Blob([JSON.stringify(compressedResult.compressedData, null, 2)], { type: 'application/json' });
                        const compressedUrl = URL.createObjectURL(compressedBlob);
                        const compressedLink = document.createElement('a');
                        compressedLink.href = compressedUrl;
                        compressedLink.download = \`proxy-monitor-compressed-filtered-\${Date.now()}.json\`;
                        compressedLink.click();
                        URL.revokeObjectURL(compressedUrl);
                        
                        this.showNotification('Compressed data exported successfully!', 'success');
                    } catch (error) {
                        console.error('Failed to export compressed data:', error);
                        this.showNotification('Failed to export compressed data', 'error');
                    }
                },

                async clearData() {
                    if (confirm('Are you sure you want to clear all monitoring data?')) {
                        try {
                            await fetch('/api/monitor/clear', { method: 'POST' });
                            this.requests = [];
                            this.selectedRequest = null;
                            this.selectedRequestId = null;
                            this.availableModels = [];
                            await this.loadStats();
                        } catch (error) {
                            console.error('Failed to clear data:', error);
                        }
                    }
                },

                async showAnalysis() {
                    try {
                        // Open analysis report in a new window/tab with filters
                        const params = new URLSearchParams(this.filters);
                        const url = '/api/monitor/analyze' + (params.toString() ? '?' + params : '');
                        window.open(url, '_blank');
                    } catch (error) {
                        console.error('Failed to open analysis:', error);
                        this.showNotification('Failed to open analysis report', 'error');
                    }
                },

                // 增量去重相关方法
                performIncrementalDeduplication(data) {
                    const requests = data.requests || [];
                    const excludedFields = new Set(['streamChunks', 'tools']);
                    const seenValues = {};
                    const fieldHistory = {};
                    const compressionStats = {
                        originalFields: 0,
                        removedFields: 0,
                        uniqueFields: 0,
                        excludedFields: 0
                    };
                    
                    const compressedRequests = [];
                    const removalLog = {};
                    
                    for (let i = 0; i < requests.length; i++) {
                        const request = requests[i];
                        const requestId = request.id || \`req_\${i}\`;
                        
                        // 移除排除字段并统计
                        const cleanedRequest = this.removeExcludedFields(request, excludedFields, compressionStats);
                        
                        // 提取所有字段
                        const allFields = this.extractAllFields(cleanedRequest);
                        compressionStats.originalFields += Object.keys(allFields).length;
                        
                        // 处理去重
                        const { compressedRequest, removedFields } = this.processRequestDeduplication(
                            cleanedRequest, allFields, seenValues, fieldHistory, requestId, compressionStats
                        );
                        
                        // 清理空结构
                        const finalRequest = this.cleanEmptyStructures(compressedRequest);
                        compressedRequests.push(finalRequest);
                        
                        if (Object.keys(removedFields).length > 0) {
                            removalLog[requestId] = removedFields;
                        }
                    }
                    
                    const compressionRatio = compressionStats.originalFields > 0 
                        ? (compressionStats.removedFields / compressionStats.originalFields * 100) 
                        : 0;
                    
                    return {
                        compressedData: {
                            compressionInfo: {
                                method: 'incremental_field_deduplication',
                                originalRequests: requests.length,
                                compressedRequests: compressedRequests.length,
                                stats: {
                                    ...compressionStats,
                                    compressionRatio: compressionRatio.toFixed(2) + '%'
                                },
                                compressionTime: new Date().toISOString()
                            },
                            requests: compressedRequests
                        },
                        removalMapping: {
                            restorationInfo: {
                                description: '用于恢复被移除字段的映射信息',
                                totalRemovedFields: compressionStats.removedFields,
                                fieldHistory: fieldHistory
                            },
                            removalLog: removalLog
                        },
                        stats: compressionStats
                    };
                },

                removeExcludedFields(obj, excludedFields, stats) {
                    if (typeof obj !== 'object' || obj === null) return obj;
                    
                    if (Array.isArray(obj)) {
                        return obj.map(item => this.removeExcludedFields(item, excludedFields, stats));
                    }
                    
                    const cleaned = {};
                    for (const [key, value] of Object.entries(obj)) {
                        if (excludedFields.has(key)) {
                            stats.excludedFields += this.countFields(value);
                            continue;
                        }
                        
                        if (typeof value === 'object' && value !== null) {
                            const cleanedValue = this.removeExcludedFields(value, excludedFields, stats);
                            if (cleanedValue !== null && 
                                (typeof cleanedValue !== 'object' || 
                                 Object.keys(cleanedValue).length > 0 || 
                                 Array.isArray(cleanedValue))) {
                                cleaned[key] = cleanedValue;
                            }
                        } else {
                            cleaned[key] = value;
                        }
                    }
                    return cleaned;
                },

                countFields(obj) {
                    if (typeof obj !== 'object' || obj === null) return 1;
                    
                    let count = 0;
                    if (Array.isArray(obj)) {
                        for (const item of obj) {
                            count += this.countFields(item);
                        }
                    } else {
                        for (const value of Object.values(obj)) {
                            count += this.countFields(value);
                        }
                    }
                    return count;
                },

                extractAllFields(obj, path = []) {
                    const fields = {};
                    
                    if (typeof obj !== 'object' || obj === null) {
                        return fields;
                    }
                    
                    if (Array.isArray(obj)) {
                        obj.forEach((item, index) => {
                            const currentPath = [...path, index.toString()];
                            if (typeof item === 'object' && item !== null) {
                                Object.assign(fields, this.extractAllFields(item, currentPath));
                            } else {
                                fields[currentPath.join('.')] = item;
                            }
                        });
                    } else {
                        Object.entries(obj).forEach(([key, value]) => {
                            const currentPath = [...path, key];
                            if (typeof value === 'object' && value !== null) {
                                Object.assign(fields, this.extractAllFields(value, currentPath));
                            } else {
                                fields[currentPath.join('.')] = value;
                            }
                        });
                    }
                    
                    return fields;
                },

                processRequestDeduplication(request, allFields, seenValues, fieldHistory, requestId, stats) {
                    const compressedRequest = JSON.parse(JSON.stringify(request));
                    const removedFields = {};
                    
                    for (const [fieldPath, value] of Object.entries(allFields)) {
                        const fieldValueKey = \`\${fieldPath}:\${JSON.stringify(value)}\`;
                        
                        if (seenValues[fieldValueKey]) {
                            // 重复字段，移除它
                            const originalRequestId = fieldHistory[fieldValueKey];
                            
                            if (this.removeNestedField(compressedRequest, fieldPath.split('.'))) {
                                removedFields[fieldPath] = {
                                    value: value,
                                    firstSeenIn: originalRequestId,
                                    reason: 'duplicate_value'
                                };
                                stats.removedFields++;
                            }
                        } else {
                            // 新字段值，记录它
                            seenValues[fieldValueKey] = true;
                            fieldHistory[fieldValueKey] = requestId;
                            stats.uniqueFields++;
                        }
                    }
                    
                    return { compressedRequest, removedFields };
                },

                removeNestedField(obj, pathArray) {
                    if (pathArray.length === 0) return false;
                    
                    try {
                        let current = obj;
                        for (let i = 0; i < pathArray.length - 1; i++) {
                            const key = pathArray[i];
                            if (key.match(/^\\d+$/)) {
                                current = current[parseInt(key)];
                            } else {
                                current = current[key];
                            }
                            if (current === undefined) return false;
                        }
                        
                        const finalKey = pathArray[pathArray.length - 1];
                        if (finalKey.match(/^\\d+$/)) {
                            const index = parseInt(finalKey);
                            if (Array.isArray(current) && index < current.length) {
                                current.splice(index, 1);
                                return true;
                            }
                        } else {
                            if (current && current.hasOwnProperty(finalKey)) {
                                delete current[finalKey];
                                return true;
                            }
                        }
                    } catch (e) {
                        return false;
                    }
                    
                    return false;
                },

                cleanEmptyStructures(obj) {
                    if (typeof obj !== 'object' || obj === null) return obj;
                    
                    if (Array.isArray(obj)) {
                        const cleaned = obj.map(item => this.cleanEmptyStructures(item))
                                          .filter(item => item !== null && item !== undefined);
                        return cleaned.length > 0 ? cleaned : null;
                    }
                    
                    const cleaned = {};
                    for (const [key, value] of Object.entries(obj)) {
                        const cleanedValue = this.cleanEmptyStructures(value);
                        if (cleanedValue !== null && cleanedValue !== undefined && 
                            (typeof cleanedValue !== 'object' || 
                             Object.keys(cleanedValue).length > 0 ||
                             Array.isArray(cleanedValue))) {
                            cleaned[key] = cleanedValue;
                        }
                    }
                    
                    return Object.keys(cleaned).length > 0 ? cleaned : null;
                }
            };
        }
    </script>
</body>
</html>`;
}