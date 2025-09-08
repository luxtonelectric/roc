// @ts-check
import fs from 'fs';
import chalk from 'chalk';
import Host from '../model/host.js';

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
   * @param {object|Host} hostConfig The host configuration to add
   * @param {object} currentConfig The current configuration object
   * @returns {object} The updated configuration
   * @throws {Error} If host configuration is invalid
   */
  addHost(hostConfig, currentConfig) {
    // Create Host instance if not already one
    const host = hostConfig instanceof Host ? hostConfig : Host.fromConfig(hostConfig);
    
    // Validate the host configuration
    host.validate();
    
    // Check for duplicate sim IDs
    const existingHost = currentConfig.games.find(g => g.sim === host.sim);
    if (existingHost) {
      throw new Error(`Host with simulation ID '${host.sim}' already exists`);
    }

    // Ensure interfaceGateway is disabled by default for new hosts
    host.disableInterfaceGateway();

    // Create updated config
    const updatedConfig = {
      ...currentConfig,
      games: [...currentConfig.games, host.toConfig()]
    };

    return updatedConfig;
  }

  /**
   * Update an existing host in the configuration
   * @param {string} originalSimId The original simulation ID
   * @param {object|Host} newHostConfig The new host configuration
   * @param {object} currentConfig The current configuration object
   * @returns {object} The updated configuration
   * @throws {Error} If host is not found or configuration is invalid
   */
  updateHost(originalSimId, newHostConfig, currentConfig) {
    // Create Host instance if not already one
    const newHost = newHostConfig instanceof Host ? newHostConfig : Host.fromConfig(newHostConfig);
    
    // Validate new host config
    newHost.validate();

    // Find existing host
    const existingHostIndex = currentConfig.games.findIndex(g => g.sim === originalSimId);
    if (existingHostIndex === -1) {
      throw new Error(`Host with simulation ID '${originalSimId}' not found`);
    }

    // Check for duplicate sim IDs (if sim ID is changing)
    if (newHost.sim !== originalSimId) {
      const duplicateHost = currentConfig.games.find(g => g.sim === newHost.sim);
      if (duplicateHost) {
        throw new Error(`Host with simulation ID '${newHost.sim}' already exists`);
      }
    }

    // Preserve interface gateway enabled state and connection info
    const existingHost = Host.fromConfig(currentConfig.games[existingHostIndex]);
    newHost.interfaceGateway.enabled = existingHost.interfaceGateway.enabled;
    newHost.interfaceGateway.connectionState = existingHost.interfaceGateway.connectionState;
    newHost.interfaceGateway.errorMessage = existingHost.interfaceGateway.errorMessage;

    // Create updated config
    const updatedGames = [...currentConfig.games];
    updatedGames[existingHostIndex] = newHost.toConfig();

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

    // Create Host instance from existing config
    const existingHost = Host.fromConfig(currentConfig.games[hostIndex]);
    
    // Update enabled state
    if (enabled) {
      existingHost.enable();
    } else {
      existingHost.disable(); // This also disables interface gateway
    }

    // Create updated config
    const updatedGames = [...currentConfig.games];
    updatedGames[hostIndex] = existingHost.toConfig();

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
        const host = Host.fromConfig(game);
        host.validate();
      } catch (error) {
        throw new Error(`Invalid host configuration at index ${index}: ${error.message}`);
      }
    });
  }

  /**
   * Validate a host configuration using the Host class
   * @param {object|Host} hostConfig The host configuration to validate
   * @throws {Error} If host configuration is invalid
   */
  #validateHostConfig(hostConfig) {
    const host = hostConfig instanceof Host ? hostConfig : Host.fromConfig(hostConfig);
    host.validate();
  }

  /**
   * Get all hosts as Host class instances
   * @param {object} config The configuration object
   * @returns {Host[]} Array of Host instances
   */
  getHosts(config) {
    if (!config || !Array.isArray(config.games)) {
      return [];
    }
    
    return config.games.map(game => Host.fromConfig(game));
  }

  /**
   * Find a host by simulation ID
   * @param {string} simId The simulation ID
   * @param {object} config The configuration object
   * @returns {Host|null} Host instance or null if not found
   */
  getHost(simId, config) {
    if (!config || !Array.isArray(config.games)) {
      return null;
    }
    
    const hostConfig = config.games.find(g => g.sim === simId);
    return hostConfig ? Host.fromConfig(hostConfig) : null;
  }

  /**
   * Update interface gateway state for a host
   * @param {string} simId The simulation ID
   * @param {boolean} enabled Whether interface gateway should be enabled
   * @param {string} connectionState Connection state
   * @param {string} errorMessage Optional error message
   * @param {object} currentConfig The current configuration object
   * @returns {object} The updated configuration
   * @throws {Error} If host is not found
   */
  updateInterfaceGatewayState(simId, enabled, connectionState = undefined, errorMessage = undefined, currentConfig) {
    const hostIndex = currentConfig.games.findIndex(g => g.sim === simId);
    if (hostIndex === -1) {
      throw new Error(`Host with simulation ID '${simId}' not found`);
    }

    // Create Host instance from existing config
    const host = Host.fromConfig(currentConfig.games[hostIndex]);
    
    // Update interface gateway state
    if (enabled) {
      host.enableInterfaceGateway();
    } else {
      host.disableInterfaceGateway();
    }
    
    if (connectionState !== undefined) {
      host.updateInterfaceGatewayState(connectionState, errorMessage);
    }

    // Create updated config
    const updatedGames = [...currentConfig.games];
    updatedGames[hostIndex] = host.toConfig();

    return {
      ...currentConfig,
      games: updatedGames
    };
  }
}
