// @ts-check

import EncryptionService from '../services/EncryptionService.js';

/**
 * Interface Gateway configuration for a host
 */
class InterfaceGateway {
  /** @type {number} */
  port;
  /** @type {boolean} */
  enabled;
  /** @type {string|undefined} */
  connectionState;
  /** @type {string|undefined} */
  errorMessage;
  /** @type {string|undefined} */
  username;
  /** @type {string|undefined} */
  encryptedPassword;

  /**
   * @param {number} port The port number for the interface gateway
   * @param {boolean} enabled Whether the interface gateway is enabled
   * @param {string} connectionState Current connection state
   * @param {string} errorMessage Error message if connection failed
   * @param {string} username Optional username for authentication
   * @param {string} encryptedPassword Optional encrypted password for authentication
   */
  constructor(port, enabled = false, connectionState = 'disconnected', errorMessage = undefined, username = undefined, encryptedPassword = undefined) {
    this.port = port;
    this.enabled = enabled;
    this.connectionState = connectionState;
    this.errorMessage = errorMessage;
    this.username = username;
    this.encryptedPassword = encryptedPassword;
  }

  /**
   * Create InterfaceGateway from configuration object
   * @param {object} igConfig Interface gateway configuration object
   * @returns {InterfaceGateway}
   */
  static fromConfig(igConfig) {
    return new InterfaceGateway(
      igConfig.port,
      igConfig.enabled || false,
      igConfig.connectionState || 'disconnected',
      igConfig.errorMessage,
      igConfig.username,
      igConfig.encryptedPassword
    );
  }

  /**
   * Convert to plain object for serialization
   * @returns {object}
   */
  toConfig() {
    const config = {
      port: this.port,
      enabled: this.enabled
    };
    
    if (this.connectionState !== undefined) {
      config.connectionState = this.connectionState;
    }
    
    if (this.errorMessage !== undefined) {
      config.errorMessage = this.errorMessage;
    }

    if (this.username !== undefined) {
      config.username = this.username;
    }

    if (this.encryptedPassword !== undefined) {
      config.encryptedPassword = this.encryptedPassword;
    }
    
    return config;
  }

  /**
   * Set authentication credentials (encrypts password automatically)
   * @param {string} username Username for authentication
   * @param {string} password Plain text password (will be encrypted)
   */
  setAuthentication(username, password) {
    this.username = username;
    this.encryptedPassword = password ? EncryptionService.encrypt(password) : undefined;
  }

  /**
   * Get decrypted password for STOMP connection (server-side only)
   * @returns {string|undefined} Decrypted password or undefined
   */
  getDecryptedPassword() {
    if (!this.encryptedPassword) {
      return undefined;
    }
    
    try {
      return EncryptionService.decrypt(this.encryptedPassword);
    } catch (error) {
      console.error('Failed to decrypt password:', error);
      return undefined;
    }
  }

  /**
   * Check if authentication is configured
   * @returns {boolean} True if both username and password are set
   */
  hasAuthentication() {
    return !!(this.username && this.encryptedPassword);
  }
}

/**
 * Host configuration class representing a SimSig simulation host
 */
export default class Host {
  /** @type {string} */
  sim;
  /** @type {string} */
  host;
  /** @type {number} */
  port;
  /** @type {string} */
  channel;
  /** @type {boolean} */
  enabled;
  /** @type {InterfaceGateway} */
  interfaceGateway;

  /**
   * @param {string} sim Simulation ID
   * @param {string} host Host URL/IP address
   * @param {number} port Host port number
   * @param {string} channel Discord voice channel name
   * @param {InterfaceGateway} interfaceGateway Interface gateway configuration
   * @param {boolean} enabled Whether the host is enabled
   */
  constructor(sim, host, port, channel, interfaceGateway, enabled = true) {
    this.sim = sim;
    this.host = host;
    this.port = port;
    this.channel = channel;
    this.interfaceGateway = interfaceGateway;
    this.enabled = enabled;
  }

  /**
   * Create Host instance from configuration object
   * @param {object} config Host configuration object
   * @returns {Host}
   * @throws {Error} If configuration is invalid
   */
  static fromConfig(config) {
    // Validate required fields
    if (!config || typeof config !== 'object') {
      throw new Error('Host configuration must be an object');
    }

    const requiredFields = ['sim', 'host', 'channel'];
    for (const field of requiredFields) {
      if (!config[field] || typeof config[field] !== 'string') {
        throw new Error(`Host configuration must have a valid '${field}' string field`);
      }
    }

    // Validate port (required)
    if (config.port === undefined || config.port === null || typeof config.port !== 'number' || config.port <= 0 || config.port > 65535) {
      throw new Error('Host configuration must have a valid port number (1-65535)');
    }

    // Validate interfaceGateway
    if (!config.interfaceGateway || typeof config.interfaceGateway !== 'object') {
      throw new Error('Host configuration must have an interfaceGateway object');
    }

    // Create InterfaceGateway instance
    const interfaceGateway = InterfaceGateway.fromConfig(config.interfaceGateway);

    return new Host(
      config.sim,
      config.host,
      config.port,
      config.channel,
      interfaceGateway,
      config.enabled !== undefined ? config.enabled : true
    );
  }

  /**
   * Convert Host instance to configuration object for serialization
   * @returns {object}
   */
  toConfig() {
    return {
      sim: this.sim,
      host: this.host,
      port: this.port,
      channel: this.channel,
      interfaceGateway: this.interfaceGateway.toConfig(),
      enabled: this.enabled
    };
  }

  /**
   * Validate the host configuration
   * @throws {Error} If configuration is invalid
   */
  validate() {
    // Validate required fields
    const requiredFields = ['sim', 'host', 'channel'];
    for (const field of requiredFields) {
      if (!this[field] || typeof this[field] !== 'string') {
        throw new Error(`Host configuration must have a valid '${field}' string field`);
      }
    }

    // Validate port (required)
    if (typeof this.port !== 'number' || this.port <= 0 || this.port > 65535) {
      throw new Error('Host port must be a valid port number (1-65535)');
    }

    // Validate interfaceGateway
    if (!this.interfaceGateway || !(this.interfaceGateway instanceof InterfaceGateway)) {
      throw new Error('Host must have a valid InterfaceGateway instance');
    }

    if (typeof this.interfaceGateway.port !== 'number' || this.interfaceGateway.port <= 0 || this.interfaceGateway.port > 65535) {
      throw new Error('InterfaceGateway port must be a valid port number (1-65535)');
    }

    if (typeof this.interfaceGateway.enabled !== 'boolean') {
      throw new Error('InterfaceGateway enabled field must be a boolean');
    }

    // Validate optional fields
    if (this.enabled !== undefined && typeof this.enabled !== 'boolean') {
      throw new Error('Host enabled field must be a boolean if provided');
    }
  }

  /**
   * Check if the host is currently active (enabled and has valid configuration)
   * @returns {boolean}
   */
  isActive() {
    try {
      this.validate();
      return this.enabled === true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Enable the interface gateway
   */
  enableInterfaceGateway() {
    this.interfaceGateway.enabled = true;
    this.interfaceGateway.connectionState = 'connecting';
    this.interfaceGateway.errorMessage = undefined;
  }

  /**
   * Disable the interface gateway
   */
  disableInterfaceGateway() {
    this.interfaceGateway.enabled = false;
    this.interfaceGateway.connectionState = 'disconnected';
    this.interfaceGateway.errorMessage = undefined;
  }

  /**
   * Update interface gateway connection state
   * @param {string} state Connection state ('connected', 'disconnected', 'connecting', 'error')
   * @param {string} errorMessage Optional error message
   */
  updateInterfaceGatewayState(state, errorMessage = undefined) {
    this.interfaceGateway.connectionState = state;
    this.interfaceGateway.errorMessage = errorMessage;
  }

  /**
   * Enable the host
   */
  enable() {
    this.enabled = true;
  }

  /**
   * Disable the host
   */
  disable() {
    this.enabled = false;
    // Also disable interface gateway when disabling host
    this.disableInterfaceGateway();
  }

  /**
   * Get a simple representation of the host for client updates
   * SECURITY: Never includes encrypted passwords
   * @returns {object}
   */
  toClientObject() {
    const igConfig = {
      port: this.interfaceGateway.port,
      enabled: this.interfaceGateway.enabled,
      connectionState: this.interfaceGateway.connectionState,
      errorMessage: this.interfaceGateway.errorMessage
    };

    // Include username if present, but never include password
    if (this.interfaceGateway.username) {
      igConfig.username = this.interfaceGateway.username;
      igConfig.hasPassword = !!this.interfaceGateway.encryptedPassword;
    }

    return {
      sim: this.sim,
      host: this.host,
      port: this.port,
      channel: this.channel,
      enabled: this.enabled,
      interfaceGateway: igConfig
    };
  }

  /**
   * Create a copy of the host with updated configuration
   * @param {object} updates Partial configuration updates
   * @returns {Host}
   */
  withUpdates(updates) {
    const currentConfig = this.toConfig();
    const updatedConfig = { ...currentConfig, ...updates };
    
    // Handle nested interfaceGateway updates
    if (updates.interfaceGateway) {
      updatedConfig.interfaceGateway = {
        ...currentConfig.interfaceGateway,
        ...updates.interfaceGateway
      };
    }
    
    return Host.fromConfig(updatedConfig);
  }

  /**
   * Check if this host configuration is equivalent to another
   * @param {Host|object} other Another host instance or configuration object
   * @returns {boolean}
   */
  isEquivalentTo(other) {
    const otherConfig = other instanceof Host ? other.toConfig() : other;
    const thisConfig = this.toConfig();
    
    return JSON.stringify(thisConfig) === JSON.stringify(otherConfig);
  }
}

export { InterfaceGateway };
