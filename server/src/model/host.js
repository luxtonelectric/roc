// @ts-check

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

  /**
   * @param {number} port The port number for the interface gateway
   * @param {boolean} enabled Whether the interface gateway is enabled
   * @param {string} connectionState Current connection state
   * @param {string} errorMessage Error message if connection failed
   */
  constructor(port, enabled = false, connectionState = 'disconnected', errorMessage = undefined) {
    this.port = port;
    this.enabled = enabled;
    this.connectionState = connectionState;
    this.errorMessage = errorMessage;
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
      igConfig.errorMessage
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
    
    return config;
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
  /** @type {string} */
  channel;
  /** @type {boolean} */
  enabled;
  /** @type {number|undefined} */
  port;
  /** @type {InterfaceGateway} */
  interfaceGateway;

  /**
   * @param {string} sim Simulation ID
   * @param {string} host Host URL/IP address
   * @param {string} channel Discord voice channel name
   * @param {InterfaceGateway} interfaceGateway Interface gateway configuration
   * @param {boolean} enabled Whether the host is enabled
   * @param {number} port Optional host port number
   */
  constructor(sim, host, channel, interfaceGateway, enabled = true, port = undefined) {
    this.sim = sim;
    this.host = host;
    this.channel = channel;
    this.interfaceGateway = interfaceGateway;
    this.enabled = enabled;
    this.port = port;
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

    // Validate interfaceGateway
    if (!config.interfaceGateway || typeof config.interfaceGateway !== 'object') {
      throw new Error('Host configuration must have an interfaceGateway object');
    }

    // Create InterfaceGateway instance
    const interfaceGateway = InterfaceGateway.fromConfig(config.interfaceGateway);

    return new Host(
      config.sim,
      config.host,
      config.channel,
      interfaceGateway,
      config.enabled !== undefined ? config.enabled : true,
      config.port
    );
  }

  /**
   * Convert Host instance to configuration object for serialization
   * @returns {object}
   */
  toConfig() {
    const config = {
      sim: this.sim,
      host: this.host,
      channel: this.channel,
      interfaceGateway: this.interfaceGateway.toConfig(),
      enabled: this.enabled
    };

    if (this.port !== undefined) {
      config.port = this.port;
    }

    return config;
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

    if (this.port !== undefined && (typeof this.port !== 'number' || this.port <= 0 || this.port > 65535)) {
      throw new Error('Host port must be a valid port number (1-65535) if provided');
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
   * @returns {object}
   */
  toClientObject() {
    return {
      sim: this.sim,
      host: this.host,
      channel: this.channel,
      enabled: this.enabled,
      port: this.port,
      interfaceGateway: {
        port: this.interfaceGateway.port,
        enabled: this.interfaceGateway.enabled,
        connectionState: this.interfaceGateway.connectionState,
        errorMessage: this.interfaceGateway.errorMessage
      }
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
