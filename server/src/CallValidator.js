import chalk from 'chalk';
import BaseCall from './model/BaseCall.js';

/**
 * Validator for call requests with unified validation pipeline
 */
export default class CallValidator {
  constructor(phoneManager, bot) {
    this.phoneManager = phoneManager;
    this.bot = bot;
  }

  /**
   * Validate call request parameters
   * @param {Object} request - Call request object
   * @throws {Error} If validation fails
   */
  validateInput(request) {
    if (!request.senderPhoneId) {
      throw new Error('Sender phone ID is required');
    }
    
    if (!Object.values(BaseCall.TYPES).includes(request.callType)) {
      throw new Error(`Invalid call type: ${request.callType}. Must be one of: ${Object.values(BaseCall.TYPES).join(', ')}`);
    }
    
    if (!Object.values(BaseCall.LEVELS).includes(request.callLevel)) {
      throw new Error(`Invalid call level: ${request.callLevel}. Must be one of: ${Object.values(BaseCall.LEVELS).join(', ')}`);
    }

    // Receiver validation - REC calls determine receiver by location
    if (request.callType === BaseCall.TYPES.REC) {
      // REC calls don't need a receiver - it's determined by the sender's location
      // Receiver can be null or undefined for REC calls
    } else if (!request.receiver) {
      throw new Error('Receiver is required');
    }

    // Validate receiver format based on call type
    if (request.callType === BaseCall.TYPES.P2P) {
      // P2P calls can receive either a phone ID string or Phone object
      if (typeof request.receiver !== 'string' && 
          (typeof request.receiver !== 'object' || !request.receiver.id)) {
        throw new Error('P2P calls require receiver to be a phone ID string or Phone object');
      }
    }
    
    if (request.callType === BaseCall.TYPES.GROUP) {
      // GROUP calls require CallGroup ID string or CallGroup object (has members property)
      if (typeof request.receiver !== 'string' && 
          (typeof request.receiver !== 'object' || !request.receiver.members)) {
        throw new Error('GROUP calls require receiver to be a CallGroup ID string or CallGroup object');
      }
    }
    
    if (request.callType === BaseCall.TYPES.REC) {
      // REC calls determine receiver by location - no receiver validation needed
    }
  }

  /**
   * Validate phone existence and connectivity
   * @param {Object} request - Call request object
   * @throws {Error} If validation fails
   */
  async validatePhones(request) {
    // Validate sender phone
    const senderPhone = this.phoneManager.getPhone(request.senderPhoneId);
    if (!senderPhone) {
      throw new Error(`Sender phone not found: ${request.senderPhoneId}`);
    }
    
    if (!senderPhone.getDiscordId()) {
      throw new Error(`Sender phone not assigned to Discord authenticated user: ${request.senderPhoneId}`);
    }

    // Check sender voice connection
    await this._validateVoiceConnection(senderPhone, 'Sender');

    // Validate receiver phones based on call type
    if (request.callType === BaseCall.TYPES.P2P) {
      // P2P: receiver should be phone ID string
      const receiverPhoneId = typeof request.receiver === 'string' ? request.receiver : request.receiver.id;
      const receiverPhone = this.phoneManager.getPhone(receiverPhoneId);
      if (!receiverPhone) {
        throw new Error(`Receiver phone not found: ${receiverPhoneId}`);
      }
      
      if (!receiverPhone.getDiscordId()) {
        throw new Error(`Receiver phone not connected to Discord: ${receiverPhoneId}`);
      }

      await this._validateVoiceConnection(receiverPhone, 'Receiver');

      // Prevent self-calling
      if (senderPhone.getId() === receiverPhone.getId()) {
        throw new Error('Cannot call yourself');
      }

      // Prevent calling between phones owned by the same user
      if (senderPhone.getDiscordId() === receiverPhone.getDiscordId()) {
        throw new Error('Cannot call between phones you control');
      }
    } else if (request.callType === BaseCall.TYPES.REC) {
      // REC calls determine participants by sender's location
      // Validate that sender phone has a valid location
      if (!senderPhone.hasValidLocation || !senderPhone.hasValidLocation()) {
        throw new Error(`Sender phone must have valid location (sim and panel) to initiate REC call: ${request.senderPhoneId}`);
      }

      // Get sender location for participant determination
      const senderLocation = this.phoneManager.getPhoneLocation ? 
        this.phoneManager.getPhoneLocation(request.senderPhoneId) : 
        senderPhone.getLocation();
      
      if (!senderLocation || !senderLocation.sim || !senderLocation.panel) {
        throw new Error(`Sender phone location is invalid for REC call: ${request.senderPhoneId}`);
      }

      // Validate that location-based methods exist in phone manager
      if (!this.phoneManager.getPhonesInSameLocation || 
          !this.phoneManager.getNeighboringPanelPhones || 
          !this.phoneManager.getControlPhoneForSim) {
        throw new Error('PhoneManager missing required location-based methods for REC calls');
      }

    } else if (request.callType === BaseCall.TYPES.GROUP) {
      // GROUP: receiver should be CallGroup ID string or CallGroup object
      let callGroup;
      if (typeof request.receiver === 'string') {
        // CallGroup ID - look it up
        callGroup = this.phoneManager.getCallGroup(request.receiver);
        if (!callGroup) {
          throw new Error(`CallGroup not found: ${request.receiver}`);
        }
      } else {
        // CallGroup object passed directly
        callGroup = request.receiver;
      }

      // Validate CallGroup has available members
      if (!callGroup.hasAvailableMembers()) {
        throw new Error(`CallGroup has no available members: ${callGroup.name}`);
      }
    }
  }

  /**
   * Validate Discord voice connection for a phone
   * @param {Phone} phone - Phone to validate
   * @param {string} label - Description for error messages
   * @throws {Error} If not connected to voice
   * @private
   */
  async _validateVoiceConnection(phone, label) {
    const discordId = phone.getDiscordId();
    if (!discordId) return;

    // If bot doesn't provide voice lookup (e.g., in unit tests), skip voice checks
    if (!this.bot || typeof this.bot.getUserVoiceChannel !== 'function') {
      console.warn(chalk.yellow('CallValidator'), `Skipping ${label} voice check: bot.getUserVoiceChannel unavailable`);
      return;
    }

    try {
      const voiceChannel = await this.bot.getUserVoiceChannel(discordId);
      if (!voiceChannel) {
        throw new Error(`${label} not connected to Discord voice: ${phone.getId()}`);
      }
    } catch (error) {
      console.error(chalk.red('CallValidator'), `Error checking ${label} voice status:`, error.message);
      throw new Error(`Cannot verify ${label} voice connection: ${phone.getId()}`);
    }
  }

  /**
   * Validate permissions for call type
   * @param {Object} request - Call request object
   * @throws {Error} If validation fails
   */
  validatePermissions(request) {
    // Add permission checks here as needed
    // For example, check if user can place REC calls, etc.
    
    if (request.callType === BaseCall.TYPES.REC) {
      // Could add REC permission validation here
      // For now, allow all authenticated users to place REC calls
    }
  }

  /**
   * Validate system resources (channels, etc.)
   * @param {Object} request - Call request object
   * @throws {Error} If validation fails
   */
  validateResources(request) {
    // Could add resource validation here
    // For example, check if channels are available for the call
    
    // For now, resource allocation is handled during call acceptance
    // This is a placeholder for future resource validation
  }
}