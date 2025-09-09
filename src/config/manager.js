/**
 * Configuration Manager
 * Manages proxy configuration including routing mode and API settings
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_FILE = path.join(__dirname, '../../config.json');

export class ConfigManager {
  constructor() {
    this.config = this.loadConfig();
    this.listeners = [];
  }

  /**
   * Load configuration from file or create default
   */
  loadConfig() {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const data = fs.readFileSync(CONFIG_FILE, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
    
    // Return default configuration
    return this.getDefaultConfig();
  }

  /**
   * Get default configuration
   */
  getDefaultConfig() {
    return {
      proxyMode: 'anthropic', // 'anthropic' or 'openrouter'
      anthropic: {
        baseUrl: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
        timeout: parseInt(process.env.REQUEST_TIMEOUT || '120000')
      },
      openrouter: {
        baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api',
        apiKey: process.env.OPENROUTER_API_KEY || '',
        defaultModel: process.env.OPENROUTER_DEFAULT_MODEL || 'anthropic/claude-3.5-sonnet',
        modelMapping: {
          sonnet: 'anthropic/claude-3.5-sonnet',
          opus: 'anthropic/claude-3-opus', 
          haiku: 'anthropic/claude-3.5-haiku'
        }
      },
      server: {
        host: process.env.HOST || '0.0.0.0',
        port: parseInt(process.env.PORT || '8082'),
        logLevel: process.env.LOG_LEVEL || 'INFO'
      },
      monitoring: {
        enabled: true,
        maxRequests: 1000,
        retentionHours: 24
      },
      headers: {
        httpReferer: process.env.HTTP_REFERER || 'https://github.com/kingoliang/anthropic-proxy',
        title: process.env.X_TITLE || 'Anthropic Proxy'
      }
    };
  }

  /**
   * Save configuration to file
   */
  saveConfig() {
    try {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.config, null, 2));
      this.notifyListeners();
      return true;
    } catch (error) {
      console.error('Error saving config:', error);
      return false;
    }
  }

  /**
   * Reload configuration from file and environment
   */
  reloadConfig() {
    const oldConfig = JSON.parse(JSON.stringify(this.config));
    this.config = this.loadConfig();
    
    // Always get fresh values from environment for sensitive data
    this.config.openrouter.apiKey = process.env.OPENROUTER_API_KEY || '';
    
    // Notify listeners if config changed
    if (JSON.stringify(oldConfig) !== JSON.stringify(this.config)) {
      this.notifyListeners();
    }
    
    return this.config;
  }

  /**
   * Get current OpenRouter API key (always fresh from env)
   */
  getOpenRouterApiKey() {
    return process.env.OPENROUTER_API_KEY || '';
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Validate configuration structure
   */
  validateConfig(config) {
    if (!config || typeof config !== 'object') {
      throw new Error('Configuration must be an object');
    }
    
    // Validate proxy mode
    if (config.proxyMode && !['anthropic', 'openrouter'].includes(config.proxyMode)) {
      throw new Error('proxyMode must be either "anthropic" or "openrouter"');
    }
    
    // Validate server config
    if (config.server) {
      if (config.server.port && (typeof config.server.port !== 'number' || config.server.port < 1 || config.server.port > 65535)) {
        throw new Error('server.port must be a number between 1 and 65535');
      }
      if (config.server.logLevel && !['DEBUG', 'INFO', 'WARN', 'ERROR'].includes(config.server.logLevel)) {
        throw new Error('server.logLevel must be one of: DEBUG, INFO, WARN, ERROR');
      }
    }
    
    // Validate anthropic config
    if (config.anthropic) {
      if (config.anthropic.baseUrl && typeof config.anthropic.baseUrl !== 'string') {
        throw new Error('anthropic.baseUrl must be a string');
      }
      if (config.anthropic.timeout && (typeof config.anthropic.timeout !== 'number' || config.anthropic.timeout < 1000)) {
        throw new Error('anthropic.timeout must be a number >= 1000');
      }
    }
    
    // Validate openrouter config
    if (config.openrouter) {
      if (config.openrouter.baseUrl && typeof config.openrouter.baseUrl !== 'string') {
        throw new Error('openrouter.baseUrl must be a string');
      }
      if (config.openrouter.modelMapping && typeof config.openrouter.modelMapping !== 'object') {
        throw new Error('openrouter.modelMapping must be an object');
      }
    }
    
    // Validate monitoring config
    if (config.monitoring) {
      if (config.monitoring.maxRequests && (typeof config.monitoring.maxRequests !== 'number' || config.monitoring.maxRequests < 1)) {
        throw new Error('monitoring.maxRequests must be a positive number');
      }
      if (config.monitoring.retentionHours && (typeof config.monitoring.retentionHours !== 'number' || config.monitoring.retentionHours < 1)) {
        throw new Error('monitoring.retentionHours must be a positive number');
      }
    }
    
    return true;
  }

  /**
   * Update configuration
   */
  updateConfig(updates) {
    // Validate input before merging
    this.validateConfig(updates);
    
    this.config = this.mergeDeep(this.config, updates);
    this.saveConfig();
    return this.config;
  }

  /**
   * Get proxy mode
   */
  getProxyMode() {
    return this.config.proxyMode;
  }

  /**
   * Set proxy mode
   */
  setProxyMode(mode) {
    if (!['anthropic', 'openrouter'].includes(mode)) {
      throw new Error(`Invalid proxy mode: ${mode}`);
    }
    this.config.proxyMode = mode;
    this.saveConfig();
    return this.config;
  }

  /**
   * Get Anthropic configuration
   */
  getAnthropicConfig() {
    return { ...this.config.anthropic };
  }

  /**
   * Update Anthropic configuration
   */
  updateAnthropicConfig(updates) {
    this.config.anthropic = { ...this.config.anthropic, ...updates };
    this.saveConfig();
    return this.config.anthropic;
  }

  /**
   * Get OpenRouter configuration
   */
  getOpenRouterConfig() {
    return { ...this.config.openrouter };
  }

  /**
   * Update OpenRouter configuration
   */
  updateOpenRouterConfig(updates) {
    this.config.openrouter = { ...this.config.openrouter, ...updates };
    this.saveConfig();
    return this.config.openrouter;
  }

  /**
   * Get server configuration
   */
  getServerConfig() {
    return { ...this.config.server };
  }

  /**
   * Update server configuration
   */
  updateServerConfig(updates) {
    this.config.server = { ...this.config.server, ...updates };
    this.saveConfig();
    return this.config.server;
  }

  /**
   * Validate OpenRouter API key
   */
  async validateOpenRouterKey(apiKey) {
    if (!apiKey || !apiKey.startsWith('sk-or-')) {
      return false;
    }
    
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': this.config.headers?.httpReferer || 'https://github.com/kingoliang/anthropic-proxy',
          'X-Title': this.config.headers?.title || 'Anthropic Proxy'
        }
      });
      return response.ok;
    } catch (error) {
      console.error('Error validating OpenRouter key:', error);
      return false;
    }
  }

  /**
   * Get available OpenRouter models with caching
   */
  async getAvailableModels() {
    const apiKey = this.getOpenRouterApiKey();
    if (!apiKey) {
      return [];
    }
    
    // Check cache first
    const now = Date.now();
    if (this.modelsCache && this.modelsCacheExpiry && now < this.modelsCacheExpiry) {
      return this.modelsCache;
    }
    
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': this.config.headers?.httpReferer || 'https://github.com/kingoliang/anthropic-proxy',
          'X-Title': this.config.headers?.title || 'Anthropic Proxy'
        }
      });
      
      if (!response.ok) {
        return this.modelsCache || [];
      }
      
      const data = await response.json();
      const models = data.data || [];
      
      // Filter for relevant models and sort
      const filteredModels = models
        .filter(model => {
          const id = model.id.toLowerCase();
          return id.includes('claude') || 
                 id.includes('gpt') || 
                 id.includes('gemini') ||
                 id.includes('mixtral') ||
                 id.includes('llama');
        })
        .sort((a, b) => {
          // Prioritize Claude models
          if (a.id.includes('claude') && !b.id.includes('claude')) return -1;
          if (!a.id.includes('claude') && b.id.includes('claude')) return 1;
          return a.id.localeCompare(b.id);
        });
      
      // Cache for 1 hour
      this.modelsCache = filteredModels;
      this.modelsCacheExpiry = now + (60 * 60 * 1000); // 1 hour
      
      return filteredModels;
    } catch (error) {
      console.error('Error fetching models:', error);
      return this.modelsCache || [];
    }
  }

  /**
   * Clear models cache
   */
  clearModelsCache() {
    this.modelsCache = null;
    this.modelsCacheExpiry = null;
  }

  /**
   * Add configuration change listener
   */
  addListener(callback) {
    this.listeners.push(callback);
  }

  /**
   * Remove configuration change listener
   */
  removeListener(callback) {
    this.listeners = this.listeners.filter(l => l !== callback);
  }

  /**
   * Notify listeners of configuration changes
   */
  notifyListeners() {
    this.listeners.forEach(listener => {
      try {
        listener(this.config);
      } catch (error) {
        console.error('Error notifying listener:', error);
      }
    });
  }

  /**
   * Deep merge utility
   */
  mergeDeep(target, source) {
    const output = { ...target };
    if (this.isObject(target) && this.isObject(source)) {
      Object.keys(source).forEach(key => {
        if (this.isObject(source[key])) {
          if (!(key in target))
            Object.assign(output, { [key]: source[key] });
          else
            output[key] = this.mergeDeep(target[key], source[key]);
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }
    return output;
  }

  /**
   * Check if value is an object
   */
  isObject(item) {
    return item && typeof item === 'object' && !Array.isArray(item);
  }

  /**
   * Reset configuration to defaults
   */
  resetToDefaults() {
    this.config = this.getDefaultConfig();
    this.saveConfig();
    return this.config;
  }

  /**
   * Export configuration
   */
  exportConfig() {
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * Import configuration
   */
  importConfig(configString) {
    try {
      const newConfig = JSON.parse(configString);
      this.config = this.mergeDeep(this.getDefaultConfig(), newConfig);
      this.saveConfig();
      return true;
    } catch (error) {
      console.error('Error importing config:', error);
      return false;
    }
  }
}

// Create singleton instance
export const configManager = new ConfigManager();