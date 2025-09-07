// @ts-check
import fs from 'fs';
import chalk from 'chalk';

/**
 * Service for managing application configuration
 * Handles loading, saving, and validation of configuration files
 */
export default class ConfigurationManager {
  /** @type {string} */
  #configPath;
  /** @type {object|null} */
  #cachedConfig = null;

  /**
   * @param {string} configPath Path to the configuration file
   */
  constructor(configPath = './config.json') {
    this.#configPath = configPath;
  }

  /**
   * Load configuration from file
   * @returns {object} The loaded configuration
   * @throws {Error} If configuration file cannot be read or parsed
   */
  loadConfig() {
    try {
      const configData = fs.readFileSync(this.#configPath, 'utf8');
      this.#cachedConfig = JSON.parse(configData);
      console.log(chalk.green('Configuration loaded successfully from'), this.#configPath);
      return this.#cachedConfig;
    } catch (error) {
      console.error(chalk.red('Error loading configuration:'), error);
      throw new Error(`Failed to load configuration from ${this.#configPath}: ${error.message}`);
    }
  }

  /**
   * Save configuration to file
   * @param {object} config The configuration object to save
   * @throws {Error} If configuration cannot be saved
   */
  async saveConfig(config) {
    try {
      // Validate config before saving
      this.#validateConfig(config);
      
      // Write to file with pretty formatting
      fs.writeFileSync(this.#configPath, JSON.stringify(config, null, 2), 'utf8');
      
      // Update cached config
      this.#cachedConfig = config;
      
      console.log(chalk.green('Configuration saved successfully to'), this.#configPath);
    } catch (error) {
      console.error(chalk.red('Error saving configuration:'), error);
      throw new Error(`Failed to save configuration to ${this.#configPath}: ${error.message}`);
    }
  }

  /**
   * Get the current cached configuration
   * @returns {object|null} The cached configuration or null if not loaded
   */
  getCachedConfig() {
    return this.#cachedConfig;
  }

  /**
   * Add a new game host to the configuration
   * @param {object} hostConfig The host configuration to add
   * @param {object} currentConfig The current configuration object
   * @returns {object} The updated configuration
   * @throws {Error} If host configuration is invalid
   */
  addHost(hostConfig, currentConfig) {
    // Validate host config
    this.#validateHostConfig(hostConfig);
    
    // Check for duplicate sim IDs
    const existingHost = currentConfig.games.find(g => g.sim === hostConfig.sim);
    if (existingHost) {
      throw new Error(`Host with simulation ID '${hostConfig.sim}' already exists`);
    }

    // Ensure interfaceGateway is disabled by default for new hosts
    if (!hostConfig.interfaceGateway) {
      hostConfig.interfaceGateway = { enabled: false };
    } else {
      hostConfig.interfaceGateway.enabled = false;
    }

    // Create updated config
    const updatedConfig = {
      ...currentConfig,
      games: [...currentConfig.games, hostConfig]
    };

    return updatedConfig;
  }

  /**
   * Update an existing host in the configuration
   * @param {string} originalSimId The original simulation ID
   * @param {object} newHostConfig The new host configuration
   * @param {object} currentConfig The current configuration object
   * @returns {object} The updated configuration
   * @throws {Error} If host is not found or configuration is invalid
   */
  updateHost(originalSimId, newHostConfig, currentConfig) {
    // Validate new host config
    this.#validateHostConfig(newHostConfig);

    // Find existing host
    const existingHostIndex = currentConfig.games.findIndex(g => g.sim === originalSimId);
    if (existingHostIndex === -1) {
      throw new Error(`Host with simulation ID '${originalSimId}' not found`);
    }

    // Check for duplicate sim IDs (if sim ID is changing)
    if (newHostConfig.sim !== originalSimId) {
      const duplicateHost = currentConfig.games.find(g => g.sim === newHostConfig.sim);
      if (duplicateHost) {
        throw new Error(`Host with simulation ID '${newHostConfig.sim}' already exists`);
      }
    }

    // Preserve interface gateway enabled state
    const existingHost = currentConfig.games[existingHostIndex];
    newHostConfig.interfaceGateway.enabled = existingHost.interfaceGateway.enabled;

    // Create updated config
    const updatedGames = [...currentConfig.games];
    updatedGames[existingHostIndex] = newHostConfig;

    const updatedConfig = {
      ...currentConfig,
      games: updatedGames
    };

    return updatedConfig;
  }

  /**
   * Remove a host from the configuration
   * @param {string} simId The simulation ID of the host to remove
   * @param {object} currentConfig The current configuration object
   * @returns {object} The updated configuration
   * @throws {Error} If host is not found
   */
  removeHost(simId, currentConfig) {
    const existingHost = currentConfig.games.find(g => g.sim === simId);
    if (!existingHost) {
      throw new Error(`Host with simulation ID '${simId}' not found`);
    }

    // Create updated config
    const updatedConfig = {
      ...currentConfig,
      games: currentConfig.games.filter(g => g.sim !== simId)
    };

    return updatedConfig;
  }

  /**
   * Update host enabled state
   * @param {string} simId The simulation ID
   * @param {boolean} enabled Whether the host should be enabled
   * @param {object} currentConfig The current configuration object
   * @returns {object} The updated configuration
   * @throws {Error} If host is not found
   */
  updateHostEnabledState(simId, enabled, currentConfig) {
    const hostIndex = currentConfig.games.findIndex(g => g.sim === simId);
    if (hostIndex === -1) {
      throw new Error(`Host with simulation ID '${simId}' not found`);
    }

    // Create updated config
    const updatedGames = [...currentConfig.games];
    updatedGames[hostIndex] = {
      ...updatedGames[hostIndex],
      enabled: enabled
    };

    const updatedConfig = {
      ...currentConfig,
      games: updatedGames
    };

    return updatedConfig;
  }

  /**
   * Validate the overall configuration structure
   * @param {object} config The configuration to validate
   * @throws {Error} If configuration is invalid
   */
  #validateConfig(config) {
    if (!config || typeof config !== 'object') {
      throw new Error('Configuration must be an object');
    }

    if (!Array.isArray(config.games)) {
      throw new Error('Configuration must have a games array');
    }

    // Validate each game host
    config.games.forEach((game, index) => {
      try {
        this.#validateHostConfig(game);
      } catch (error) {
        throw new Error(`Invalid host configuration at index ${index}: ${error.message}`);
      }
    });
  }

  /**
   * Validate a host configuration
   * @param {object} hostConfig The host configuration to validate
   * @throws {Error} If host configuration is invalid
   */
  #validateHostConfig(hostConfig) {
    if (!hostConfig || typeof hostConfig !== 'object') {
      throw new Error('Host configuration must be an object');
    }

    // Required fields
    const requiredFields = ['sim', 'host', 'channel'];
    for (const field of requiredFields) {
      if (!hostConfig[field] || typeof hostConfig[field] !== 'string') {
        throw new Error(`Host configuration must have a valid '${field}' string field`);
      }
    }

    // Validate interfaceGateway
    if (!hostConfig.interfaceGateway || typeof hostConfig.interfaceGateway !== 'object') {
      throw new Error('Host configuration must have an interfaceGateway object');
    }

    if (typeof hostConfig.interfaceGateway.port !== 'number' || hostConfig.interfaceGateway.port <= 0) {
      throw new Error('interfaceGateway must have a valid port number');
    }

    if (typeof hostConfig.interfaceGateway.enabled !== 'boolean') {
      throw new Error('interfaceGateway must have a boolean enabled field');
    }

    // Optional fields validation
    if (hostConfig.enabled !== undefined && typeof hostConfig.enabled !== 'boolean') {
      throw new Error('enabled field must be a boolean if provided');
    }

    if (hostConfig.port !== undefined && (typeof hostConfig.port !== 'number' || hostConfig.port <= 0)) {
      throw new Error('port field must be a positive number if provided');
    }
  }
}
