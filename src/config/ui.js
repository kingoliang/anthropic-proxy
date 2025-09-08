/**
 * Configuration UI
 * Web interface for managing proxy configuration
 */

export function getConfigHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Proxy Configuration</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        
        .header {
            background: white;
            border-radius: 12px;
            padding: 30px;
            margin-bottom: 30px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        }
        
        .header h1 {
            color: #333;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            gap: 15px;
        }
        
        .header .subtitle {
            color: #666;
            font-size: 14px;
        }
        
        .config-panel {
            background: white;
            border-radius: 12px;
            padding: 30px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            margin-bottom: 30px;
        }
        
        .mode-selector {
            display: flex;
            gap: 20px;
            margin-bottom: 30px;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
        }
        
        .mode-option {
            flex: 1;
            padding: 20px;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.3s;
            text-align: center;
        }
        
        .mode-option:hover {
            border-color: #667eea;
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(102,126,234,0.2);
        }
        
        .mode-option.active {
            border-color: #667eea;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        
        .mode-option h3 {
            margin-bottom: 10px;
            font-size: 18px;
        }
        
        .mode-option p {
            font-size: 14px;
            opacity: 0.8;
        }
        
        .config-section {
            margin-bottom: 30px;
        }
        
        .config-section h2 {
            color: #333;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #f0f0f0;
        }
        
        .form-group {
            margin-bottom: 20px;
        }
        
        .form-group label {
            display: block;
            margin-bottom: 8px;
            color: #555;
            font-weight: 500;
        }
        
        .form-group input,
        .form-group select,
        .form-group textarea {
            width: 100%;
            padding: 10px 15px;
            border: 1px solid #ddd;
            border-radius: 6px;
            font-size: 14px;
            transition: border-color 0.3s;
        }
        
        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
            outline: none;
            border-color: #667eea;
        }
        
        .form-group .help-text {
            margin-top: 5px;
            font-size: 12px;
            color: #888;
        }
        
        .btn {
            padding: 10px 20px;
            border: none;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.3s;
        }
        
        .btn-primary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        
        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(102,126,234,0.3);
        }
        
        .btn-secondary {
            background: #f8f9fa;
            color: #333;
            margin-left: 10px;
        }
        
        .btn-secondary:hover {
            background: #e9ecef;
        }
        
        .btn-danger {
            background: #dc3545;
            color: white;
        }
        
        .btn-danger:hover {
            background: #c82333;
        }
        
        .status-indicator {
            display: inline-block;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            margin-right: 8px;
        }
        
        .status-active {
            background: #28a745;
            animation: pulse 2s infinite;
        }
        
        .status-inactive {
            background: #dc3545;
        }
        
        @keyframes pulse {
            0% {
                box-shadow: 0 0 0 0 rgba(40, 167, 69, 0.7);
            }
            70% {
                box-shadow: 0 0 0 10px rgba(40, 167, 69, 0);
            }
            100% {
                box-shadow: 0 0 0 0 rgba(40, 167, 69, 0);
            }
        }
        
        .alert {
            padding: 15px 20px;
            border-radius: 6px;
            margin-bottom: 20px;
        }
        
        .alert-success {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        
        .alert-error {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        
        .alert-info {
            background: #d1ecf1;
            color: #0c5460;
            border: 1px solid #bee5eb;
        }
        
        /* Toast Notifications */
        .toast {
            min-width: 300px;
            max-width: 400px;
            padding: 15px 20px;
            margin-bottom: 10px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            color: white;
            font-weight: 500;
            position: relative;
            transform: translateX(400px);
            opacity: 0;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            cursor: pointer;
        }
        
        .toast.show {
            transform: translateX(0);
            opacity: 1;
        }
        
        .toast.hide {
            transform: translateX(400px);
            opacity: 0;
        }
        
        .toast-success {
            background: linear-gradient(135deg, #28a745, #20c997);
            border-left: 4px solid #155724;
        }
        
        .toast-error {
            background: linear-gradient(135deg, #dc3545, #e74c3c);
            border-left: 4px solid #721c24;
        }
        
        .toast-info {
            background: linear-gradient(135deg, #17a2b8, #007bff);
            border-left: 4px solid #0c5460;
        }
        
        .toast-warning {
            background: linear-gradient(135deg, #ffc107, #fd7e14);
            border-left: 4px solid #856404;
            color: #212529;
        }
        
        .toast::before {
            content: '';
            position: absolute;
            top: 8px;
            left: 8px;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background-size: 12px;
            background-position: center;
            background-repeat: no-repeat;
        }
        
        .toast-success::before {
            background-image: url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTkgMTJsLTIgMmw2IDZsMTItMTIiIHN0cm9rZT0iI0ZGRiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+');
        }
        
        .toast-error::before {
            background-image: url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE4IDZMMTggMTgiIHN0cm9rZT0iI0ZGRiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPHBhdGggZD0iTTYgNkwxOCAxOCIgc3Ryb2tlPSIjRkZGIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgo8L3N2Zz4=');
        }
        
        .toast-info::before {
            background-image: url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiIHN0cm9rZT0iI0ZGRiIgc3Ryb2tlLXdpZHRoPSIyIi8+CjxwYXRoIGQ9Ik0xMiAxNnYtNCIgc3Ryb2tlPSIjRkZGIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgo8cGF0aCBkPSJNMTIgOGguMDEiIHN0cm9rZT0iI0ZGRiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+');
        }
        
        .toast-content {
            padding-left: 35px;
            line-height: 1.4;
        }
        
        
        .tabs {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
            border-bottom: 2px solid #f0f0f0;
        }
        
        .tab {
            padding: 10px 20px;
            cursor: pointer;
            border-bottom: 2px solid transparent;
            transition: all 0.3s;
            margin-bottom: -2px;
        }
        
        .tab:hover {
            background: #f8f9fa;
        }
        
        .tab.active {
            border-bottom-color: #667eea;
            color: #667eea;
            font-weight: 500;
        }
        
        .tab-content {
            display: none;
        }
        
        .tab-content.active {
            display: block;
        }
        
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
        }
        
        .stats-card {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
        }
        
        .stats-card h3 {
            color: #666;
            font-size: 14px;
            margin-bottom: 10px;
        }
        
        .stats-card .value {
            font-size: 24px;
            font-weight: bold;
            color: #333;
        }
        
        input[list] {
            position: relative;
            background: #f8f9fa;
            border: 2px solid #e0e0e0;
            transition: all 0.3s;
        }
        
        input[list]:focus {
            background: white;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102,126,234,0.1);
        }
        
        .model-count {
            font-size: 12px;
            color: #888;
            font-style: italic;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <h1>
                    <span class="status-indicator status-active"></span>
                    Anthropic Proxy Configuration
                </h1>
                <a href="/monitor" class="btn btn-secondary" style="margin: 0; text-decoration: none;">
                    📊 Monitor
                </a>
            </div>
            <div class="subtitle">Configure proxy routing between Anthropic API and OpenRouter</div>
        </div>
        
        <div class="config-panel">
            <!-- Toast Notification Container -->
            <div id="toast-container" style="position: fixed; top: 20px; right: 20px; z-index: 9999;"></div>
            
            
            <div class="mode-selector">
                <div class="mode-option" data-mode="anthropic">
                    <h3>Direct Anthropic</h3>
                    <p>Forward requests directly to Anthropic API</p>
                </div>
                <div class="mode-option" data-mode="openrouter">
                    <h3>OpenRouter</h3>
                    <p>Convert and forward requests to OpenRouter</p>
                </div>
            </div>
            
            <div class="tabs">
                <div class="tab active" data-tab="general">General Settings</div>
                <div class="tab" data-tab="anthropic">Anthropic Settings</div>
                <div class="tab" data-tab="openrouter">OpenRouter Settings</div>
                <div class="tab" data-tab="advanced">Advanced</div>
            </div>
            
            <!-- General Settings Tab -->
            <div class="tab-content active" id="general-tab">
                <div class="config-section">
                    <h2>Server Configuration</h2>
                    <div class="grid">
                        <div class="form-group">
                            <label>Host</label>
                            <input type="text" id="server-host" placeholder="0.0.0.0">
                            <div class="help-text">Server binding address</div>
                        </div>
                        <div class="form-group">
                            <label>Port</label>
                            <input type="number" id="server-port" placeholder="8082">
                            <div class="help-text">Server listening port</div>
                        </div>
                        <div class="form-group">
                            <label>Log Level</label>
                            <select id="server-loglevel">
                                <option value="DEBUG">DEBUG</option>
                                <option value="INFO">INFO</option>
                                <option value="WARN">WARN</option>
                                <option value="ERROR">ERROR</option>
                            </select>
                            <div class="help-text">Logging verbosity</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Anthropic Settings Tab -->
            <div class="tab-content" id="anthropic-tab">
                <div class="config-section">
                    <h2>Anthropic API Configuration</h2>
                    <div class="form-group">
                        <label>Base URL</label>
                        <input type="text" id="anthropic-url" placeholder="https://api.anthropic.com">
                        <div class="help-text">Anthropic API endpoint</div>
                    </div>
                    <div class="form-group">
                        <label>Request Timeout (ms)</label>
                        <input type="number" id="anthropic-timeout" placeholder="120000">
                        <div class="help-text">Maximum time to wait for response</div>
                    </div>
                </div>
            </div>
            
            <!-- OpenRouter Settings Tab -->
            <div class="tab-content" id="openrouter-tab">
                <div class="config-section">
                    <h2>OpenRouter Configuration</h2>
                    <div class="form-group">
                        <label>Base URL</label>
                        <input type="text" id="openrouter-url" placeholder="https://openrouter.ai/api">
                        <div class="help-text">OpenRouter API endpoint</div>
                    </div>
                    <div class="alert alert-info">
                        <strong>🔑 API Key Configuration</strong><br>
                        OpenRouter API Key must be configured as an environment variable for security.<br>
                        <strong>Method 1:</strong> Set <code>OPENROUTER_API_KEY=your_key_here</code> in <code>.env</code> file<br>
                        <strong>Method 2:</strong> Export as environment variable: <code>export OPENROUTER_API_KEY=your_key_here</code>
                    </div>
                    <div class="form-group">
                        <label>Default Model</label>
                        <select id="openrouter-model">
                            <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet</option>
                            <option value="anthropic/claude-3.5-haiku">Claude 3.5 Haiku</option>
                            <option value="anthropic/claude-3-opus">Claude 3 Opus</option>
                            <option value="anthropic/claude-3-sonnet">Claude 3 Sonnet</option>
                            <option value="anthropic/claude-3-haiku">Claude 3 Haiku</option>
                            <option value="openai/gpt-4-turbo-preview">GPT-4 Turbo</option>
                            <option value="google/gemini-pro">Gemini Pro</option>
                        </select>
                        <div class="help-text">Default model for OpenRouter requests</div>
                    </div>
                    <button class="btn btn-secondary" onclick="testOpenRouterConnection()">Test Connection</button>
                </div>
            </div>
            
            <!-- Advanced Tab -->
            <div class="tab-content" id="advanced-tab">
                <div class="config-section">
                    <h2>Model Mapping</h2>
                    <p style="color: #666; margin-bottom: 20px;">Map Claude model families to specific OpenRouter models</p>
                    <div class="grid">
                        <div class="form-group">
                            <label>Sonnet Models → OpenRouter</label>
                            <div style="position: relative;">
                                <input type="text" id="mapping-sonnet" list="sonnet-models" placeholder="Click here, then type to search models (99 available)..." 
                                       style="width: 100%; padding-right: 30px;"
                                       onclick="this.focus(); this.setSelectionRange(0, this.value.length);">
                                <datalist id="sonnet-models">
                                    <!-- Options will be populated by JavaScript -->
                                </datalist>
                                <span style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); pointer-events: none; color: #666;">▼</span>
                            </div>
                            <div class="help-text" id="sonnet-count">Loading models...</div>
                        </div>
                        <div class="form-group">
                            <label>Opus Models → OpenRouter</label>
                            <div style="position: relative;">
                                <input type="text" id="mapping-opus" list="opus-models" placeholder="Click here, then type to search models (99 available)..." 
                                       style="width: 100%; padding-right: 30px;"
                                       onclick="this.focus(); this.setSelectionRange(0, this.value.length);">
                                <datalist id="opus-models">
                                    <!-- Options will be populated by JavaScript -->
                                </datalist>
                                <span style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); pointer-events: none; color: #666;">▼</span>
                            </div>
                            <div class="help-text" id="opus-count">Loading models...</div>
                        </div>
                        <div class="form-group">
                            <label>Haiku Models → OpenRouter</label>
                            <div style="position: relative;">
                                <input type="text" id="mapping-haiku" list="haiku-models" placeholder="Click here, then type to search models (99 available)..." 
                                       style="width: 100%; padding-right: 30px;"
                                       onclick="this.focus(); this.setSelectionRange(0, this.value.length);">
                                <datalist id="haiku-models">
                                    <!-- Options will be populated by JavaScript -->
                                </datalist>
                                <span style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); pointer-events: none; color: #666;">▼</span>
                            </div>
                            <div class="help-text" id="haiku-count">Loading models...</div>
                        </div>
                    </div>
                </div>
                
                <div class="config-section">
                    <h2>Configuration Management</h2>
                    <div class="grid">
                        <button class="btn btn-secondary" onclick="exportConfig()">Export Config</button>
                        <button class="btn btn-secondary" onclick="importConfig()">Import Config</button>
                        <button class="btn btn-danger" onclick="resetConfig()">Reset to Defaults</button>
                    </div>
                </div>
            </div>
            
            <div style="margin-top: 30px; text-align: right;">
                <button class="btn btn-primary" onclick="saveConfiguration()">Save Configuration</button>
                <button class="btn btn-secondary" onclick="loadConfiguration()">Reload</button>
            </div>
        </div>
        
        <div class="config-panel">
            <h2>Quick Links</h2>
            <div class="grid">
                <div class="stats-card">
                    <h3>Monitor Dashboard</h3>
                    <a href="/monitor" class="btn btn-primary" style="margin-top: 10px;">Open Monitor</a>
                </div>
                <div class="stats-card">
                    <h3>API Health</h3>
                    <a href="/health" class="btn btn-primary" style="margin-top: 10px;">Check Health</a>
                </div>
                <div class="stats-card">
                    <h3>OpenRouter Models</h3>
                    <button class="btn btn-primary" style="margin-top: 10px;" onclick="fetchAvailableModels()">View Models</button>
                </div>
            </div>
        </div>
    </div>
    
    <script>
        let currentConfig = {};
        
        // Global variables
        let allAvailableModels = [];
        
        // Load configuration on page load
        window.addEventListener('DOMContentLoaded', () => {
            loadConfiguration();
            loadAvailableModels();
            setupEventListeners();
        });
        
        function setupEventListeners() {
            // Mode selector
            document.querySelectorAll('.mode-option').forEach(option => {
                option.addEventListener('click', () => {
                    const mode = option.dataset.mode;
                    selectMode(mode);
                });
            });
            
            // Tab switching
            document.querySelectorAll('.tab').forEach(tab => {
                tab.addEventListener('click', () => {
                    const tabName = tab.dataset.tab;
                    switchTab(tabName);
                });
            });
        }
        
        function selectMode(mode) {
            document.querySelectorAll('.mode-option').forEach(option => {
                option.classList.remove('active');
            });
            document.querySelector(\`[data-mode="\${mode}"]\`).classList.add('active');
            currentConfig.proxyMode = mode;
        }
        
        function switchTab(tabName) {
            document.querySelectorAll('.tab').forEach(tab => {
                tab.classList.remove('active');
            });
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            
            document.querySelector(\`[data-tab="\${tabName}"]\`).classList.add('active');
            document.getElementById(\`\${tabName}-tab\`).classList.add('active');
        }
        
        async function loadConfiguration() {
            try {
                showMessage('Loading configuration...', 'info');
                const response = await fetch('/api/config');
                if (!response.ok) throw new Error('Failed to load configuration');
                
                currentConfig = await response.json();
                populateForm(currentConfig);
                selectMode(currentConfig.proxyMode);
                showMessage('Configuration loaded successfully', 'success');
            } catch (error) {
                showMessage('Error loading configuration: ' + error.message, 'error');
            }
        }

        async function loadAvailableModels() {
            try {
                const response = await fetch('/api/config/models');
                const models = await response.json();
                
                // Store all models globally
                allAvailableModels = models;
                
                // Populate datalists with all models
                populateModelDataLists(models);
                
                // Set current values if config is loaded
                if (currentConfig.openrouter?.modelMapping) {
                    document.getElementById('mapping-sonnet').value = currentConfig.openrouter.modelMapping.sonnet || '';
                    document.getElementById('mapping-opus').value = currentConfig.openrouter.modelMapping.opus || '';
                    document.getElementById('mapping-haiku').value = currentConfig.openrouter.modelMapping.haiku || '';
                }
                
                if (models.length > 0) {
                    showMessage(\`Loaded \${models.length} available models from OpenRouter\`, 'success');
                }
            } catch (error) {
                console.error('Error loading models:', error);
                allAvailableModels = [];
                const counts = ['sonnet-count', 'opus-count', 'haiku-count'];
                counts.forEach(countId => {
                    const element = document.getElementById(countId);
                    if (element) {
                        element.textContent = 'Error loading models';
                    }
                });
                showMessage('Error loading models: ' + error.message, 'error');
            }
        }

        function populateModelDataLists(models) {
            const datalists = [
                { listId: 'sonnet-models', countId: 'sonnet-count' },
                { listId: 'opus-models', countId: 'opus-count' },
                { listId: 'haiku-models', countId: 'haiku-count' }
            ];
            
            datalists.forEach(({ listId, countId }) => {
                const datalist = document.getElementById(listId);
                const countElement = document.getElementById(countId);
                
                if (!datalist) return;
                
                // Clear existing options
                datalist.innerHTML = '';
                
                if (models.length === 0) {
                    if (countElement) {
                        countElement.textContent = 'No models available';
                    }
                    return;
                }
                
                // Add all models to datalist
                models.forEach(model => {
                    const option = document.createElement('option');
                    option.value = model.id;
                    option.textContent = \`\${model.name || model.id} (\${model.id})\`;
                    datalist.appendChild(option);
                });
                
                // Update count display
                if (countElement) {
                    countElement.textContent = \`\${models.length} models available (type to search)\`;
                }
            });
        }
        
        function populateForm(config) {
            // Server settings
            document.getElementById('server-host').value = config.server?.host || '0.0.0.0';
            document.getElementById('server-port').value = config.server?.port || 8082;
            document.getElementById('server-loglevel').value = config.server?.logLevel || 'INFO';
            
            // Anthropic settings
            document.getElementById('anthropic-url').value = config.anthropic?.baseUrl || 'https://api.anthropic.com';
            document.getElementById('anthropic-timeout').value = config.anthropic?.timeout || 120000;
            
            // OpenRouter settings
            document.getElementById('openrouter-url').value = config.openrouter?.baseUrl || 'https://openrouter.ai/api';
            document.getElementById('openrouter-model').value = config.openrouter?.defaultModel || 'anthropic/claude-3.5-sonnet';
            
            // Model mappings
            if (config.openrouter?.modelMapping) {
                document.getElementById('mapping-sonnet').value = config.openrouter.modelMapping.sonnet || 'anthropic/claude-3.5-sonnet';
                document.getElementById('mapping-opus').value = config.openrouter.modelMapping.opus || 'anthropic/claude-3-opus';
                document.getElementById('mapping-haiku').value = config.openrouter.modelMapping.haiku || 'anthropic/claude-3.5-haiku';
            }
        }
        
        
        function getFormData() {
            return {
                proxyMode: currentConfig.proxyMode,
                server: {
                    host: document.getElementById('server-host').value,
                    port: parseInt(document.getElementById('server-port').value),
                    logLevel: document.getElementById('server-loglevel').value
                },
                anthropic: {
                    baseUrl: document.getElementById('anthropic-url').value,
                    timeout: parseInt(document.getElementById('anthropic-timeout').value)
                },
                openrouter: {
                    baseUrl: document.getElementById('openrouter-url').value,
                    defaultModel: document.getElementById('openrouter-model').value,
                    modelMapping: {
                        sonnet: document.getElementById('mapping-sonnet').value,
                        opus: document.getElementById('mapping-opus').value,
                        haiku: document.getElementById('mapping-haiku').value
                    }
                }
            };
        }
        
        async function saveConfiguration() {
            const saveBtn = document.querySelector('button[onclick="saveConfiguration()"]');
            const originalText = saveBtn.textContent;
            
            try {
                saveBtn.textContent = 'Saving...';
                saveBtn.disabled = true;
                showMessage('Saving configuration...', 'info');
                
                const config = getFormData();
                const response = await fetch('/api/config', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(config)
                });
                
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Failed to save configuration');
                }
                
                currentConfig = await response.json();
                showMessage('Configuration saved successfully! Some changes may require server restart.', 'success');
                
            } catch (error) {
                showMessage('Error saving configuration: ' + error.message, 'error');
            } finally {
                saveBtn.textContent = originalText;
                saveBtn.disabled = false;
            }
        }
        
        async function testOpenRouterConnection() {
            const testBtn = document.querySelector('button[onclick="testOpenRouterConnection()"]');
            const originalText = testBtn.textContent;
            
            try {
                testBtn.textContent = 'Testing...';
                testBtn.disabled = true;
                showMessage('Testing OpenRouter connection...', 'info');
                
                const apiKey = document.getElementById('openrouter-key').value;
                if (!apiKey) {
                    showMessage('Please enter an OpenRouter API key', 'error');
                    return;
                }
                
                const response = await fetch('/api/config/test-openrouter', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ apiKey })
                });
                
                const result = await response.json();
                if (result.success) {
                    showMessage('OpenRouter connection successful!', 'success');
                    // Reload models after successful connection test
                    setTimeout(() => loadAvailableModels(), 500);
                } else {
                    showMessage('OpenRouter connection failed: ' + (result.error || 'Invalid API key'), 'error');
                }
            } catch (error) {
                showMessage('Error testing connection: ' + error.message, 'error');
            } finally {
                testBtn.textContent = originalText;
                testBtn.disabled = false;
            }
        }
        
        async function fetchAvailableModels() {
            const fetchBtn = document.querySelector('button[onclick="fetchAvailableModels()"]');
            const originalText = fetchBtn.textContent;
            
            try {
                fetchBtn.textContent = 'Loading...';
                fetchBtn.disabled = true;
                showMessage('Fetching available models...', 'info');
                
                const response = await fetch('/api/config/models');
                const models = await response.json();
                
                if (models.length > 0) {
                    const modelList = models.map(m => \`\${m.name || m.id} (\${m.id})\`).join('\\n');
                    alert(\`Available Models (\${models.length} total):\\n\\n\` + modelList);
                    showMessage(\`Found \${models.length} available models\`, 'success');
                } else {
                    showMessage('No models available. Please configure OpenRouter API key.', 'error');
                }
            } catch (error) {
                showMessage('Error fetching models: ' + error.message, 'error');
            } finally {
                fetchBtn.textContent = originalText;
                fetchBtn.disabled = false;
            }
        }
        
        async function exportConfig() {
            try {
                const config = JSON.stringify(currentConfig, null, 2);
                const blob = new Blob([config], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'proxy-config.json';
                a.click();
                URL.revokeObjectURL(url);
                showMessage('Configuration exported successfully', 'success');
            } catch (error) {
                showMessage('Error exporting configuration: ' + error.message, 'error');
            }
        }
        
        async function importConfig() {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                
                try {
                    const text = await file.text();
                    const config = JSON.parse(text);
                    
                    const response = await fetch('/api/config', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(config)
                    });
                    
                    if (!response.ok) throw new Error('Failed to import configuration');
                    
                    currentConfig = await response.json();
                    populateForm(currentConfig);
                    showMessage('Configuration imported successfully', 'success');
                } catch (error) {
                    showMessage('Error importing configuration: ' + error.message, 'error');
                }
            };
            input.click();
        }
        
        async function resetConfig() {
            if (!confirm('Are you sure you want to reset to default configuration?')) return;
            
            const resetBtn = document.querySelector('button[onclick="resetConfig()"]');
            const originalText = resetBtn.textContent;
            
            try {
                resetBtn.textContent = 'Resetting...';
                resetBtn.disabled = true;
                showMessage('Resetting configuration to defaults...', 'info');
                
                const response = await fetch('/api/config/reset', {
                    method: 'POST'
                });
                
                if (!response.ok) throw new Error('Failed to reset configuration');
                
                currentConfig = await response.json();
                populateForm(currentConfig);
                selectMode(currentConfig.proxyMode);
                showMessage('Configuration reset to defaults successfully', 'success');
                
                // Reload models since API key might have changed
                setTimeout(() => loadAvailableModels(), 500);
            } catch (error) {
                showMessage('Error resetting configuration: ' + error.message, 'error');
            } finally {
                resetBtn.textContent = originalText;
                resetBtn.disabled = false;
            }
        }
        
        function showMessage(message, type = 'info') {
            // Only show toast notification now
            showToast(message, type);
        }
        
        function showToast(message, type = 'info', duration = 4000) {
            const container = document.getElementById('toast-container');
            
            // Create toast element
            const toast = document.createElement('div');
            toast.className = 'toast toast-' + type;
            
            const content = document.createElement('div');
            content.className = 'toast-content';
            content.textContent = message;
            
            toast.appendChild(content);
            container.appendChild(toast);
            
            // Click to dismiss
            toast.addEventListener('click', () => {
                dismissToast(toast);
            });
            
            // Animate in
            setTimeout(() => {
                toast.classList.add('show');
            }, 10);
            
            // Auto dismiss
            setTimeout(() => {
                dismissToast(toast);
            }, duration);
            
            return toast;
        }
        
        function dismissToast(toast) {
            if (!toast || !toast.parentNode) return;
            
            toast.classList.remove('show');
            toast.classList.add('hide');
            
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }
    </script>
</body>
</html>`;
}