// @ts-check
import chalk from 'chalk';
import NetworkGCC, { MSG } from './NetworkGCC.js';

/**
 * VGCSBus - Message bus for VGCS communication between network and mobile stations
 * Handles message routing and group subscription management
 */
export default class VGCSBus {
  constructor() {
    /** @type {Map<string, import('./MobileStationVGCS.js').default>} */
    this.clients = new Map();     // msId -> client
    /** @type {Set<string>} */
    this.controllers = new Set(); // ids allowed to terminate
    /** @type {Map<string, NetworkGCC>} */
    this.networks = new Map();    // groupId -> NetworkGCC instance
    /** @type {Map<string, Set<string>>} */
    this.groupSubscriptions = new Map(); // groupId -> Set(msId)
    /** @type {Set<string>} */
    this.online = new Set();
    /** @type {Map<string, Set<Function>>} */
    this.subscribers = new Map(); // topic -> Set(callback functions)
    
    console.log(chalk.green('VGCSBus'), 'Phase 6 VGCS Bus initialized with subscription system');
  }

  /**
   * Subscribe to standardized VGCS messages
   * @param {string} topic - Subscription topic (e.g., 'SOCKET_BRIDGE', 'ADMIN_PANEL')
   * @param {Function} callback - Callback function to receive messages
   */
  subscribe(topic, callback) {
    if (!this.subscribers.has(topic)) {
      this.subscribers.set(topic, new Set());
    }
    
    this.subscribers.get(topic).add(callback);
    console.log(chalk.green('VGCSBus.subscribe'), `Subscribed to topic: ${topic}`);
  }

  /**
   * Unsubscribe from standardized VGCS messages
   * @param {string} topic - Subscription topic
   * @param {Function} callback - Callback function to remove
   */
  unsubscribe(topic, callback) {
    if (this.subscribers.has(topic)) {
      this.subscribers.get(topic).delete(callback);
      if (this.subscribers.get(topic).size === 0) {
        this.subscribers.delete(topic);
      }
      console.log(chalk.yellow('VGCSBus.unsubscribe'), `Unsubscribed from topic: ${topic}`);
    }
  }

  /**
   * Publish standardized message to subscribers
   * @param {string} topic - Topic to publish to
   * @param {Object} message - Standardized message object
   * @param {string} message.type - Message type
   * @param {Object} message.data - Message data
   * @param {string} message.groupId - Group call ID
   * @param {string} [message.phoneId] - Phone ID
   * @param {string[]} [message.recipients] - Recipients list
   */
  publish(topic, message) {
    if (this.subscribers.has(topic)) {
      console.log(chalk.blue('VGCSBus.publish'), `Publishing ${message.type} to ${this.subscribers.get(topic).size} subscribers on topic: ${topic}`);
      this.subscribers.get(topic).forEach(callback => {
        try {
          callback(message);
        } catch (error) {
          console.error(chalk.red('VGCSBus.publish'), 
            `Error in subscriber callback for topic ${topic}:`, error);
        }
      });
    }
  }

  /**
   * Register a mobile station client with the bus
   * @param {import('./MobileStationVGCS.js').default} client 
   */
  registerClient(client) {
    //console.log(chalk.yellow('VGCSBus.registerClient'), `Registering MS: ${client.id}`);
    this.clients.set(client.id, client);
    this.online.add(client.id);
  }

  /**
   * Unregister a mobile station client from the bus
   * @param {string} clientId 
   */
  unregisterClient(clientId) {
    //console.log(chalk.yellow('VGCSBus.unregisterClient'), `Unregistering MS: ${clientId}`);
    this.clients.delete(clientId);
    this.online.delete(clientId);
    
    // Remove from all group subscriptions
    for (const [groupId, subscribers] of this.groupSubscriptions) {
      subscribers.delete(clientId);
      if (subscribers.size === 0) {
        this.groupSubscriptions.delete(groupId);
      }
    }
  }

  /**
   * Add a controller ID (authorized to terminate calls)
   * @param {string} controllerId 
   */
  addController(controllerId) {
    //console.log(chalk.yellow('VGCSBus.addController'), `Adding controller: ${controllerId}`);
    this.controllers.add(controllerId);
  }

  /**
   * Remove a controller ID
   * @param {string} controllerId 
   */
  removeController(controllerId) {
    //console.log(chalk.yellow('VGCSBus.removeController'), `Removing controller: ${controllerId}`);
    this.controllers.delete(controllerId);
  }

  /**
   * Check if an ID is a controller
   * @param {string} id 
   * @returns {boolean}
   */
  isController(id) { 
    return this.controllers.has(id); 
  }

  /**
   * Check if a mobile station is online
   * @param {string} id 
   * @returns {boolean}
   */
  isOnline(id) { 
    return this.online.has(id); 
  }

  /**
   * Set online status for a mobile station
   * @param {string} id 
   * @param {boolean} online 
   */
  setOnlineStatus(id, online) {
    if (online) {
      this.online.add(id);
    } else {
      this.online.delete(id);
    }
    // console.log(chalk.cyan('VGCSBus.setOnlineStatus'), `MS: ${id}, Online: ${online}`);
  }

  /**
   * Get or create a NetworkGCC instance for a group
   * @param {string} groupId 
   * @returns {NetworkGCC}
   */
  _getNetworkForGroup(groupId) {
    if (!this.networks.has(groupId)) {
      // console.log(chalk.cyan('VGCSBus._getNetworkForGroup'), `Creating NetworkGCC for group: ${groupId}`);
      this.networks.set(groupId, new NetworkGCC(this));
    }
    return this.networks.get(groupId);
  }

  /**
   * Remove a NetworkGCC instance when group call ends
   * @param {string} groupId 
   */
  _removeNetworkForGroup(groupId) {
    // console.log(chalk.cyan('VGCSBus._removeNetworkForGroup'), `Removing NetworkGCC for group: ${groupId}`);
    this.networks.delete(groupId);
    this.groupSubscriptions.delete(groupId);
  }

  /**
   * Handle message from mobile station to network
   * @param {string} msId 
   * @param {Object} payload 
   */
  sendFrom(msId, payload) {
    // console.log(chalk.blue('VGCSBus.sendFrom'), `From: ${msId}, Type: ${payload.type}`);
    
    const groupId = payload.groupId;
    if (!groupId) {
      console.error(chalk.red('VGCSBus.sendFrom'), `No groupId provided for message type: ${payload.type}`);
      return;
    }

    const network = this._getNetworkForGroup(groupId);
    
    switch (payload.type) {
      case MSG.START_REQ:
        this._ensureGroup(groupId);
        network.onStartReq(payload);
        break;
        
      case MSG.JOIN_REQ:
        this._ensureGroup(groupId).add(msId);
        network.onJoinReq({ fromMs: msId });
        break;
        
      case MSG.LEAVE:
        network.onLeave({ fromMs: msId });
        break;
        
      case MSG.TERMINATE:
        network.onTerminate({ fromMs: msId });
        // Clean up network instance after termination
        this._removeNetworkForGroup(groupId);
        break;
        
      default:
        console.log(chalk.red('VGCSBus.sendFrom'), `Unknown message type: ${payload.type}`);
    }
  }

  /**
   * Send message from network to specific mobile station (unicast)
   * @param {string} msId 
   * @param {Object} payload 
   */
  sendTo(msId, payload) {
    // console.log(chalk.blue('VGCSBus.sendTo'), `To: ${msId}, Type: ${payload.type}`);
    
    const client = this.clients.get(msId);
    if (client) {
      // Update VGCS mobile station state only
      client.onMessage(payload);
    } else {
      console.log(chalk.red('VGCSBus.sendTo'), `Client not found: ${msId}`);
    }
  }

  /**
   * Broadcast message from network to all subscribers of a group
   * @param {string} groupId 
   * @param {Object} payload 
   */
  broadcast(groupId, payload) {
    // console.log(chalk.blue('VGCSBus.broadcast'), `GroupId: ${groupId}, Type: ${payload.type}`);
    
    // For NOTIFICATION messages, broadcast to all clients (area notification)
    if (payload.type === MSG.NOTIFICATION) {
      console.log(chalk.cyan('VGCSBus.broadcast'), 'Broadcasting NOTIFICATION to all clients in area');
      for (const [msId, client] of this.clients) {
        this._ensureGroup(groupId).add(msId);
        client.onMessage(payload);
      }
      return;
    }
    
    // For other messages, broadcast only to group subscribers
    const subscribers = this.groupSubscriptions.get(groupId) || new Set();
    // console.log(chalk.cyan('VGCSBus.broadcast'), `Broadcasting to ${subscribers.size} subscribers`);
    
    for (const msId of subscribers) {
      this.sendTo(msId, payload);
    }
  }

  /**
   * Get network state information
   * @param {string} [groupId] - Optional group ID to get specific network state
   * @returns {Object}
   */
  getNetworkState(groupId = null) {
    if (groupId && this.networks.has(groupId)) {
      return this.networks.get(groupId).getStateInfo();
    }
    
    // Return aggregate state of all networks
    const networkStates = {};
    for (const [gId, network] of this.networks.entries()) {
      networkStates[gId] = network.getStateInfo();
    }
    
    return {
      activeNetworks: this.networks.size,
      networks: networkStates
    };
  }

  /**
   * Get all client state information
   * @returns {Object[]}
   */
  getAllClientStates() {
    const states = [];
    for (const [msId, client] of this.clients) {
      states.push(client.getStateInfo());
    }
    return states;
  }

  /**
   * Get group subscription information
   * @returns {Object}
   */
  getGroupSubscriptions() {
    const subscriptions = {};
    for (const [groupId, subscribers] of this.groupSubscriptions) {
      subscriptions[groupId] = Array.from(subscribers);
    }
    return subscriptions;
  }

  /**
   * Force terminate a group call (admin function)
   * @param {string} groupId 
   * @param {string} reason 
   */
  forceTerminate(groupId, reason = "admin-termination") {
    // console.log(chalk.red('VGCSBus.forceTerminate'), `GroupId: ${groupId}, Reason: ${reason}`);
    
    const network = this.networks.get(groupId);
    if (network) {
      network.state = "N4_TERMINATING";
      network._releaseAll(reason);
      this._removeNetworkForGroup(groupId);
    } else {
      console.log(chalk.yellow('VGCSBus.forceTerminate'), `Group ${groupId} not found`);
    }
  }

  /**
   * Get statistics about the bus
   * @returns {Object}
   */
  getStatistics() {
    return {
      totalClients: this.clients.size,
      onlineClients: this.online.size,
      controllers: this.controllers.size,
      activeGroups: this.groupSubscriptions.size,
      activeNetworks: this.networks.size,
      networks: Array.from(this.networks.entries()).map(([groupId, network]) => ({
        groupId,
        state: network.state,
        originator: network.originator,
        participantCount: network.participants.size
      }))
    };
  }

  // --- Internal helper methods ---
  
  /**
   * Ensure a group exists in subscriptions
   * @param {string} groupId 
   * @returns {Set<string>}
   */
  _ensureGroup(groupId) {
    if (!this.groupSubscriptions.has(groupId)) {
      console.log(chalk.green('VGCSBus._ensureGroup'), `Creating group: ${groupId}`);
      this.groupSubscriptions.set(groupId, new Set());
    }
    return this.groupSubscriptions.get(groupId);
  }

  /**
   * Get all mobile station IDs for standardized message recipients
   * Note: These are phone IDs that will be resolved to Discord IDs by the socket bridge
   * @returns {string[]} Array of mobile station/phone IDs
   */
  _getAllOnlineDiscordIds() {
    const phoneIds = [];
    for (const [msId, client] of this.clients) {
      if (this.online.has(msId)) {
        // Mobile station IDs are phone IDs - socket bridge will resolve Discord IDs
        phoneIds.push(msId);
      }
    }
    return phoneIds;
  }
}
