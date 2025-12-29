// @ts-check
import chalk from 'chalk';
import BaseCall from './model/BaseCall.js';
import CallRequest from './model/callrequest.js';
import GroupCallRequest from './model/groupcallrequest.js';
import CallGroup from './model/CallGroup.js';
import VGCSBus from './vgcs/VGCSBus.js';
import MobileStationVGCS from './vgcs/MobileStationVGCS.js';
import VGCSSocketBridge from './vgcs/VGCSSocketBridge.js';
import CallFactory from './CallFactory.js';
import CallValidator from './CallValidator.js';

// Ensure BaseCall constants are available
const { TYPES, LEVELS, STATUS } = BaseCall;

/** @typedef {import("./model/phone.js").default} Phone */
/** @typedef {import("./phonemanager.js").default} PhoneManager */
/** @typedef {import("./bot.js").default} DiscordBot */
/** @typedef {import("socket.io").Server} Server */
/** @typedef {import("socket.io").Socket} Socket */

/**
 * UnifiedCallManager - Single unified call management system
 * 
 * Replaces the legacy CallManager and GroupCallManager with a unified architecture
 * that handles all call types (P2P, GROUP, REC) through a single interface.
 * 
 * Features:
 * - Unified call placement logic for all call types
 * - Intelligent priority-based call queuing and management
 * - Hybrid FSM for all call states (simple and VGCS)
 * - Optimized socket.io event system for unified calls
 * - Comprehensive call lifecycle management
 * - VGCS integration for GROUP and REC calls
 * 
 * Architecture:
 * - Uses UnifiedCall for P2P calls
 * - Uses UnifiedGroupCall for GROUP and REC calls
 * - Integrates VGCS components for group call management
 * - Single point of call state management
 * - Unified priority system across all call types
 */
export default class UnifiedCallManager {

  // Call Storage
  /** @type {Map<string, BaseCall>} - All active calls by ID */
  activeCalls = new Map();
  
  /** @type {Map<string, BaseCall>} - Requested calls by ID */
  requestedCalls = new Map();
  
  /** @type {Map<string, BaseCall>} - Past calls by ID for history */
  pastCalls = new Map();

  /** @type {Map<string, number>} - Call ID to timestamp mapping for TTL */
  pastCallsTimestamps = new Map();

  // VGCS Components (for GROUP and REC calls)
  /** @type {VGCSBus} */
  vgcsBus;
  
  /** @type {VGCSSocketBridge} */
  socketBridge;
  
  /** @type {Map<string, MobileStationVGCS>} - phoneId -> MobileStationVGCS */
  mobileStations = new Map();
  
  /** @type {Map<string, string>} - phoneId -> callId mapping for group calls */
  phoneToCallMap = new Map();

  // Priority Configuration
  static CALL_PRIORITIES = {
    [BaseCall.TYPES.REC]: 1,
    [BaseCall.TYPES.P2P + '_' + BaseCall.LEVELS.EMERGENCY]: 2,
    [BaseCall.TYPES.GROUP + '_' + BaseCall.LEVELS.EMERGENCY]: 2,
    [BaseCall.TYPES.P2P + '_' + BaseCall.LEVELS.URGENT]: 3,
    [BaseCall.TYPES.GROUP + '_' + BaseCall.LEVELS.URGENT]: 3,  
    [BaseCall.TYPES.P2P + '_' + BaseCall.LEVELS.NORMAL]: 4,
    [BaseCall.TYPES.GROUP + '_' + BaseCall.LEVELS.NORMAL]: 4
  };

  // At the top of the file, modify the constants:
  static MAX_PAST_CALLS = parseInt(process.env.ROC_MAX_PAST_CALLS) || 1000;
  static CLEANUP_THRESHOLD = parseInt(process.env.ROC_CLEANUP_THRESHOLD) || 1200;
  static CLEANUP_BATCH_SIZE = parseInt(process.env.ROC_CLEANUP_BATCH_SIZE) || 200;
  static PAST_CALLS_TTL_MS = parseInt(process.env.ROC_PAST_CALLS_TTL_HOURS) * 60 * 60 * 1000 || (24 * 60 * 60 * 1000);

  /**
   * Create a new UnifiedCallManager
   * @param {PhoneManager} phoneManager 
   * @param {DiscordBot} bot 
   * @param {Server} io 
   * @param {import("./ROCManager.js").default} [rocManager] - ROC manager for socket-to-user lookup
   */
  constructor(phoneManager, bot, io, rocManager = null) {
    this.phoneManager = phoneManager;
    this.bot = bot;
    this.io = io;
    this.rocManager = rocManager;
    
    // Initialize streamlined call creation components
    // Use the shared CallFactory module (static factory methods)
    this.callFactory = CallFactory;
    this.callValidator = new CallValidator(phoneManager, bot);
    
    // Initialize VGCS components for group calls
    this.vgcsBus = new VGCSBus();
    // Note: VGCSSocketBridge will be initialized after constructor completes
    this.socketBridge = null;
    
    //console.log(chalk.green('UnifiedCallManager'), 'Unified Call Manager initialized');
    
    this.setupErrorHandling();
    
    // Initialize VGCS bridge after constructor completes
    this.initializeVGCSBridge();
  }

  /**
   * Set ROC Manager for socket-to-user lookup
   * @param {import("./ROCManager.js").default} rocManager - ROC manager instance
   */
  setROCManager(rocManager) {
    this.rocManager = rocManager;
  }

  /**
   * Leave a call (participant leaves but call may continue for others)
   * @param {string} socketId - Socket ID of the leaving participant
   * @param {string} callId - Call ID to leave
   * @param {Function} [callback] - Optional callback for socket response
   * @returns {Promise<boolean>} True if successful
   */
  async leaveCall(socketId, callId, callback = null) {
    const call = this.activeCalls.get(callId);
    if (!call) {
      const error = `Call not found for leaving: ${callId}`;
      console.error(chalk.red('UnifiedCallManager'), error);
      this.emitCallError(socketId, error, 'CALL_NOT_FOUND');
      if (callback) callback(false);
      return false;
    }

    // Get all phones for this user
    const userPhones = this.getAllPhonesForSocket(socketId);
    if (!userPhones || userPhones.length === 0) {
      const error = `No phones found for socket: ${socketId}`;
      console.error(chalk.red('UnifiedCallManager'), error);
      this.emitCallError(socketId, error, 'NO_PHONES_FOUND');
      if (callback) callback(false);
      return false;
    }

    // Find which of the user's phones is actually in this call
    const phoneInCall = userPhones.find(phone => call.includesPhone(phone));
    if (!phoneInCall) {
      const error = `None of user's phones are in call ${callId}`;
      console.error(chalk.red('UnifiedCallManager'), error);
      this.emitCallError(socketId, error, 'PHONE_NOT_IN_CALL');
      if (callback) callback(false);
      return false;
    }

    // Use the participating phone for all subsequent operations
    const phoneId = phoneInCall.getId();
    const phone = phoneInCall;

    try {
      // For P2P calls, leaving means terminating the entire call
      if (call.type === BaseCall.TYPES.P2P) {
        //console.log(chalk.yellow('UnifiedCallManager'), `P2P call ${callId}: leaving participant terminates call`);
        const result = await this.terminateCall(socketId, callId, 'PARTICIPANT_LEFT');
        if (callback) callback(result);
        return result;
      }

      // For GROUP/REC calls, handle individual participant leaving
      const discordId = phone.getDiscordId();
      if (discordId) {
        try {
          // Move participant out of voice channel
          await this.bot.setUserVoiceChannel(discordId);
          
          // Emit kicked from call to the leaving participant
          this.emitKickedFromCall(discordId, callId, 'LEFT_VOLUNTARILY');
        } catch (error) {
          console.error(chalk.red('UnifiedCallManager'), `Failed to move user ${phoneId} out of channel:`, error);
        }
      }

      // Remove participant from group call with proper VGCS mobile station handling
      if (call.type === BaseCall.TYPES.GROUP || call.type === BaseCall.TYPES.REC) {
        const groupCall = /** @type {GroupCallRequest} */ (call);
        
        // Handle VGCS mobile station departure
        const mobileStation = this.mobileStations.get(phoneId);
        if (mobileStation) {
          try {
            // Check if this phone is the originator
            const isOriginator = groupCall.originator && groupCall.originator.getId() === phoneId;
            
            if (isOriginator) {
              // Originators cannot leave - they must terminate the entire call
              console.log(chalk.red('UnifiedCallManager'), 
                `Originator ${phoneId} attempted to leave call ${callId} - originators must use terminate instead`);
              // Don't perform the leave operation for originators
              // The client should use terminateCall instead of leaveCall for originators
              throw new Error('Originators cannot leave calls - use terminate instead');
            } else {
              // Non-originators can leave normally
              mobileStation.leave();
              console.log(chalk.green('UnifiedCallManager'), 
                `Mobile station ${phoneId} left VGCS group call ${callId}`);
            }
          } catch (error) {
            console.warn(chalk.yellow('UnifiedCallManager'), 
              `Failed to properly leave VGCS call for ${phoneId}:`, error.message);
          }
        }
        
        // Clean up mobile station and phone mapping
        this.mobileStations.delete(phoneId);
        this.phoneToCallMap.delete(phoneId);
        
        // Check remaining participants
        const remainingParticipants = groupCall.getAllPhones().filter(p => p.getId() !== phoneId);
        
        if (remainingParticipants.length === 0) {
          // No more participants, terminate the entire call
          //console.log(chalk.yellow('UnifiedCallManager'), `Last participant left ${call.type} call ${callId} - terminating`);
          const result = await this.terminateCall(socketId, callId, 'NO_PARTICIPANTS_REMAINING');
          if (callback) callback(result);
          return result;
        }
        
        // Since originators cannot leave (only terminate), we don't need ownership transfer logic
        // If we reach here, it means a non-originator participant left the call
        
        // Notify remaining participants about participant leaving
        remainingParticipants.forEach(participant => {
          const participantDiscordId = participant.getDiscordId();
          if (participantDiscordId) {
            this.io.to(participantDiscordId).emit('groupCallParticipantLeft', {
              groupId: callId,
              participantId: phoneId,
              participantCount: remainingParticipants.length
            });
          }
        });
      }

      // Update call queues
      this.updatePhoneCallQueues([phone]);

      //console.log(chalk.green('UnifiedCallManager'), `Participant ${phoneId} left call ${callId}`);
      if (callback) callback(true);
      return true;
    } catch (error) {
      console.error(chalk.red('UnifiedCallManager'), `Error leaving call ${callId}:`, error);
      this.emitCallError(socketId, error.message, 'LEAVE_ERROR');
      if (callback) callback(false);
      return false;
    }
  }

  /**
   * Get phone ID from socket ID - improved approach without hard-coded assumptions
   * @param {string} socketId - Socket ID to lookup
   * @returns {string|null} Phone ID if found
   */
  getPhoneIdFromSocket(socketId) {
    try {
      // Get user from ROCManager
      const user = this.rocManager?.findUserBySocketId(socketId);
      if (!user) {
        console.warn(chalk.yellow('UnifiedCallManager'), `No user found for socket ${socketId}`);
        return null;
      }
      
      // Get all phones assigned to this user's Discord ID
      const userPhones = this.phoneManager.getPhonesForDiscordId(user.discordId);
      if (!userPhones || userPhones.length === 0) {
        console.warn(chalk.yellow('UnifiedCallManager'), `No phones assigned to user ${user.discordId}`);
        return null;
      }
      
      // Return the first phone (most users will have one primary phone)
      // In future, we could add logic to select the "active" phone based on context
      return userPhones[0].getId();
    } catch (error) {
      console.error(chalk.red('UnifiedCallManager'), `Error getting phone ID from socket ${socketId}:`, error.message);
      return null;
    }
  }

  /**
   * Get phone object from socket ID with enhanced error context
   * @param {string} socketId - Socket ID to lookup
   * @returns {Phone|null} Phone object if found
   */
  getPhoneFromSocket(socketId) {
    const phoneId = this.getPhoneIdFromSocket(socketId);
    if (!phoneId) {
      return null;
    }
    
    return this.phoneManager.getPhone(phoneId);
  }

  /**
   * Get Discord ID from socket ID with enhanced validation
   * @param {string} socketId - Socket ID to lookup
   * @returns {string|null} Discord ID if found
   */
  getDiscordIdFromSocket(socketId) {
    try {
      const user = this.rocManager?.findUserBySocketId(socketId);
      if (!user) {
        console.warn(chalk.yellow('UnifiedCallManager'), `No user found for socket ID: ${socketId}`);
        return null;
      }
      
      // Validate socket is still connected
      if (!user.socket || user.socket.disconnected) {
        console.warn(chalk.yellow('UnifiedCallManager'), `User ${user.discordId} has disconnected socket, cannot resolve from socket ID: ${socketId}`);
        return null;
      }
      
      // Validate socket ID matches (detect stale socket references)
      if (user.socket.id !== socketId) {
        console.warn(chalk.yellow('UnifiedCallManager'), `Socket ID mismatch for user ${user.discordId}: expected ${socketId}, got ${user.socket.id}`);
        return null;
      }
      
      return user.discordId;
    } catch (error) {
      console.error(chalk.red('UnifiedCallManager'), `Error getting Discord ID for socket ${socketId}:`, error.message);
      return null;
    }
  }

  /**
   * Get all phones assigned to a socket's user with fallback Discord ID resolution
   * @param {string} socketId - Socket ID to lookup
   * @param {string} [fallbackDiscordId] - Optional Discord ID to use if socket lookup fails
   * @returns {Phone[]} Array of phones assigned to the user
   */
  getAllPhonesForSocket(socketId, fallbackDiscordId = null) {
    try {
      let discordId = this.getDiscordIdFromSocket(socketId);
      
      // Fallback: if socket lookup fails but we have a Discord ID, use it
      if (!discordId && fallbackDiscordId) {
        console.warn(chalk.yellow('UnifiedCallManager'), `Socket ${socketId} lookup failed, using fallback Discord ID: ${fallbackDiscordId}`);
        discordId = fallbackDiscordId;
      }
      
      if (!discordId) {
        return [];
      }
      
      return this.phoneManager.getPhonesForDiscordId(discordId) || [];
    } catch (error) {
      console.error(chalk.red('UnifiedCallManager'), `Error getting phones for socket ${socketId}:`, error.message);
      return [];
    }
  }

  /**
   * Set up error handling for VGCS and general call errors
   * @private
   */
  setupErrorHandling() {
    process.on('uncaughtException', (error) => {
      if (error.message && error.message.includes('VGCS')) {
        this.handleVGCSError(error);
      }
    });

    if (this.io && typeof this.io.on === 'function') {
      this.io.on('error', (error) => {
        console.error(chalk.red('UnifiedCallManager Socket Error:'), error);
        this.handleVGCSError(error);
      });
    }
  }

  /**
   * Initialize VGCS bridge for socket integration
   */
  initializeVGCSBridge() {
    try {
      this.socketBridge = new VGCSSocketBridge(this, this.io, this.phoneManager, this.bot);
      this.socketBridge.registerWithVGCSBus(this.vgcsBus);
      return true;
    } catch (error) {
      console.error(chalk.red('UnifiedCallManager'), 'Failed to register VGCS Bridge:', error.message);
      this.socketBridge = null;
      return false;
    }
  }

  /**
   * Handle VGCS-related errors with recovery attempts
   * @param {Error} error - The error that occurred
   * @param {string} [callId] - Call ID if error is call-specific
   * @param {string} [phoneId] - Phone ID if error is phone-specific
   */
  handleVGCSError(error, callId = null, phoneId = null) {
    console.error(chalk.red('UnifiedCallManager VGCS Error:'), error.message);
    
    const errorData = {
      message: error.message,
      stack: error.stack,
      callId,
      phoneId,
      timestamp: new Date().toISOString(),
      recoverable: this.isRecoverableError(error)
    };

    // TODO: Implement socket bridge error handling when VGCS bridge is ready
    // For now, just log the error
    console.error(chalk.red('UnifiedCallManager'), 'VGCS Error Data:', errorData);

    // Get affected participants for notification
    const recipients = this.getErrorRecipients(callId, phoneId);
    
    // Attempt recovery if error is recoverable
    if (errorData.recoverable && callId) {
      this.attemptErrorRecovery(callId, error);
    }
  }

  /**
   * Determine if an error is recoverable
   * @param {Error} error - The error to check
   * @returns {boolean} True if error might be recoverable
   */
  isRecoverableError(error) {
    const recoverablePatterns = [
      'network timeout',
      'connection lost',
      'temporary failure',
      'retry',
      'timeout'
    ];
    
    const errorMessage = error.message.toLowerCase();
    return recoverablePatterns.some(pattern => errorMessage.includes(pattern));
  }

  // ===== CORE CALL MANAGEMENT METHODS =====

  /**
   * Get all calls for a specific phone
   * @param {Phone} phone - The phone to get calls for
   * @returns {BaseCall[]} Array of calls involving the phone
   */
  getCallsForPhone(phone) {
    if (!phone) return [];
    
    const calls = [];
    
    // Check active calls
    for (const call of this.activeCalls.values()) {
      if (call.includesPhone(phone)) {
        calls.push(call);
      }
    }
    
    // Check requested calls
    for (const call of this.requestedCalls.values()) {
      if (call.includesPhone(phone)) {
        calls.push(call);
      }
    }
    
    return calls;
  }

  /**
   * Get call queue for a specific phone with priority ordering
   * @param {Phone} phone - The phone to get queue for
   * @returns {BaseCall[]} Sorted array of calls by priority
   */
  getCallQueueForPhone(phone) {
    const calls = this.getCallsForPhone(phone);
    
    // Sort by priority (lower number = higher priority)
    return calls.sort((a, b) => {
      const priorityA = this.getCallPriority(a.type, a.level);
      const priorityB = this.getCallPriority(b.type, b.level);
      return priorityA - priorityB;
    });
  }

  /**
   * Get numeric priority for a call type and level
   * @param {string|BaseCall} callTypeOrCall - Call type string or call object
   * @param {string} [callLevel] - Call level (if first param is callType)
   * @returns {number} Priority number (lower = higher priority)
   */
  getCallPriority(callTypeOrCall, callLevel) {
    let callType, level;
    
    // Handle both single call object and separate parameters
    if (typeof callTypeOrCall === 'object' && callTypeOrCall.type) {
      callType = callTypeOrCall.type;
      level = callTypeOrCall.level;
    } else {
      callType = callTypeOrCall;
      level = callLevel;
    }
    
    if (callType === BaseCall.TYPES.REC) {
      return UnifiedCallManager.CALL_PRIORITIES[BaseCall.TYPES.REC];
    }
    
    const key = `${callType}_${level}`;
    return UnifiedCallManager.CALL_PRIORITIES[key] || 999;
  }

  /**
   * Compare two calls for priority ordering
   * @param {BaseCall} call1 - First call
   * @param {BaseCall} call2 - Second call
   * @returns {number} Comparison result (-1, 0, 1)
   */
  compareCallPriorities(call1, call2) {
    const priority1 = this.getCallPriority(call1.type, call1.level);
    const priority2 = this.getCallPriority(call2.type, call2.level);
    
    if (priority1 !== priority2) {
      return priority1 - priority2;
    }
    
    // If same priority, prefer calls with fewer participants (easier to preempt)
    const participants1 = call1.getAllPhones().length;
    const participants2 = call2.getAllPhones().length;
    
    return participants1 - participants2;
  }

  /**
   * Find the best channel to terminate for a new higher priority call
   * @param {string} requiredCallType - Type of the new call
   * @param {string} requiredCallLevel - Level of the new call
   * @returns {Object|null} Channel information or null if none available
   */
  selectChannelToTerminate(requiredCallType, requiredCallLevel) {
    const channelStats = this.bot.getChannelUsageInfo();

    if (!channelStats || !channelStats.channels) {
      return null;
    }

    // Active channels should have participants and associated call metadata
    const activeChannels = channelStats.channels.filter(channel =>
      (channel.participantCount || 0) > 0 && channel.callType
    );

    if (activeChannels.length === 0) {
      return null;
    }

    const requiredPriority = this.getCallPriority(requiredCallType, requiredCallLevel);

    // Find channels with lower priority calls (higher numeric priority value)
    const preemptibleChannels = activeChannels.filter(channel => {
      const channelPriority = (typeof channel.priority === 'number') ? channel.priority : this.getCallPriority(channel.callType, channel.callLevel || 'normal');
      return channelPriority > requiredPriority;
    });

    if (preemptibleChannels.length === 0) {
      return null;
    }

    // Select the best channel to terminate:
    // 1) prefer higher numeric priority (i.e., lower real priority)
    // 2) then fewer participants
    // 3) then longer running (larger duration)
    return preemptibleChannels.sort((a, b) => {
      const priorityA = (typeof a.priority === 'number') ? a.priority : this.getCallPriority(a.callType, a.callLevel || 'normal');
      const priorityB = (typeof b.priority === 'number') ? b.priority : this.getCallPriority(b.callType, b.callLevel || 'normal');

      if (priorityA !== priorityB) {
        return priorityB - priorityA; // higher numeric -> lower priority -> better to terminate
      }

      if ((a.participantCount || 0) !== (b.participantCount || 0)) {
        return (a.participantCount || 0) - (b.participantCount || 0);
      }

      // prefer longer duration (older calls)
      return (b.duration || 0) - (a.duration || 0);
    })[0];
  }

  // ===== CALL PLACEMENT LOGIC =====

  /**
   * Place a call - streamlined method for all call types
   * @param {Object} request - Call request object
   * @param {string} request.senderPhoneId - ID of the phone initiating the call
   * @param {string} request.callType - Type of call (p2p, group, REC)
   * @param {string} request.callLevel - Priority level (normal, urgent, emergency)
   * @param {string|Object} request.receiver - Receiver: string for P2P, CallGroup ID/object for GROUP/REC
   * @param {Object} [request.options={}] - Additional call options
   * @returns {Promise<string|null>} Call ID if successful, null if failed
   */
  async placeCall(request) {
    try {
      // Unified validation pipeline
      this.callValidator.validateInput(request);
      await this.callValidator.validatePhones(request);
      this.callValidator.validatePermissions(request);
      this.callValidator.validateResources(request);

      // Get sender phone (already validated)
      const senderPhone = this.phoneManager.getPhone(request.senderPhoneId);
      
      // Create call using factory pattern with receiver objects
      let call;
      switch (request.callType) {
        case BaseCall.TYPES.P2P:
          // P2P calls: resolve receiver to Phone object (string ID or Phone object)
          const receiverPhone = typeof request.receiver === 'string'
            ? this.phoneManager.getPhone(request.receiver)
            : request.receiver;
          if (!receiverPhone) {
            throw new Error(`Receiver phone not found: ${request.receiver}`);
          }
          call = this.callFactory.createP2PCall(senderPhone, receiverPhone, request.callLevel, request.options);
          break;
          
        case BaseCall.TYPES.GROUP:
          // GROUP calls: resolve receiver to CallGroup object
          const callGroup = typeof request.receiver === 'string'
            ? this.phoneManager.getCallGroup(request.receiver)
            : request.receiver;
          if (!callGroup) {
            throw new Error(`Call group not found: ${request.receiver}`);
          }
          call = this.callFactory.createGroupCall(senderPhone, callGroup.id, request.callLevel, request.options);
          break;
          
        case BaseCall.TYPES.REC:
          // REC calls: participants determined by originator's location; REC calls are always EMERGENCY
          call = this.callFactory.createRECCall(senderPhone, null, request.options);
          break;
          
        default:
          throw new Error(`Unsupported call type: ${request.callType}`);
      }

      // Store in requested calls and set up VGCS for group calls
      this.requestedCalls.set(call.id, call);
      
      if (call.type === BaseCall.TYPES.GROUP || call.type === BaseCall.TYPES.REC) {
        await this._setupGroupCall(/** @type {GroupCallRequest} */ (call), senderPhone);
      }

      // Send notifications and update queues
      this.sendNewCallNotifications(call);
      this.updatePhoneCallQueues(call.getAllPhones());
      
      console.log(chalk.green('UnifiedCallManager'), `${call.type} call placed: ${call.id}`);
      return call.id;
      
    } catch (error) {
      console.error(chalk.red('UnifiedCallManager'), 'Call placement failed:', error.message);
      console.error(chalk.red('UnifiedCallManager'), error.stack || error);
      
      // Notify user via socket if available
      if (request.options?.socketId && this.io) {
        this.io.to(request.options.socketId).emit('callError', {
          error: error.message,
          type: 'validation'
        });
      }
      
      return null;
    }
  }

  /**
   * Set up VGCS mobile stations for group calls
   * @param {GroupCallRequest} call - The group call
   * @param {Phone} originatorPhone - The originating phone
   * @private
   */
  async _setupGroupCall(call, originatorPhone) {
    // Set initial VGCS status
    call.updateStatus(BaseCall.STATUS.N1_INITIATED);
    
    // Create VGCS mobile station for originator
    const mobileStation = new MobileStationVGCS({
      msId: originatorPhone.getId(), 
      bus: this.vgcsBus,
      autoAnswer: call.type === BaseCall.TYPES.REC
    });
    
    this.mobileStations.set(originatorPhone.getId(), mobileStation);
    this.phoneToCallMap.set(originatorPhone.getId(), call.id);
    
    // For REC calls, create mobile stations for all participants
    if (call.type === BaseCall.TYPES.REC) {
      const participants = call.getAllPhones().filter(p => p.getId() !== originatorPhone.getId());
      participants.forEach(phone => {
        const participantStation = new MobileStationVGCS({
          msId: phone.getId(),
          bus: this.vgcsBus,
          autoAnswer: true
        });
        this.mobileStations.set(phone.getId(), participantStation);
        this.phoneToCallMap.set(phone.getId(), call.id);
      });
    }
    
    // Start group call on the mobile station
    mobileStation.startGroupCall(call.id, {
      immediateSetup: call.level === BaseCall.LEVELS.EMERGENCY || call.type === BaseCall.TYPES.REC,
      priority: call.level
    });
  }



  // ===== CALL LIFECYCLE MANAGEMENT =====

  /**
   * Validate and resolve socket/user information for call operations
   * @param {string} socketId - Socket ID to validate
   * @returns {Object} Validation result with user info or errors
   * @private
   */
  _validateSocketAndResolveUser(socketId) {
    const result = {
      isValid: false,
      user: null,
      discordId: null,
      phones: [],
      error: null,
      errorType: null
    };

    // Primary socket lookup
    result.user = this.rocManager?.findUserBySocketId(socketId);
    
    if (!result.user) {
      result.error = `No user found for socket: ${socketId}`;
      result.errorType = 'NO_USER_FOUND';
      return result;
    }

    // Socket validation
    if (!result.user.socket || result.user.socket.disconnected) {
      result.error = `User ${result.user.discordId} socket disconnected`;
      result.errorType = 'SOCKET_DISCONNECTED';
      return result;
    }

    // Socket ID consistency check
    if (result.user.socket.id !== socketId) {
      result.error = `Socket ID mismatch for user ${result.user.discordId}: expected ${socketId}, got ${result.user.socket.id}`;
      result.errorType = 'SOCKET_MISMATCH';
      return result;
    }

    // Get user phones
    result.discordId = result.user.discordId;
    result.phones = this.phoneManager.getPhonesForDiscordId(result.discordId) || [];
    
    if (result.phones.length === 0) {
      result.error = `No phones assigned to user ${result.discordId}`;
      result.errorType = 'NO_PHONES_ASSIGNED';
      return result;
    }

    result.isValid = true;
    return result;
  }

  /**
   * Accept a call
   * @param {string} socketId - Socket ID of the accepting user
   * @param {string} callId - Call ID to accept
   * @param {Function} [callback] - Optional callback for socket response
   * @returns {Promise<boolean>} True if successful
   */
  async acceptCall(socketId, callId, callback = null) {
    const call = this.requestedCalls.get(callId) || this.activeCalls.get(callId);
    if (!call) {
      const error = `Call not found: ${callId}`;
      console.error(chalk.red('UnifiedCallManager'), error);
      this.emitCallError(socketId, error, 'CALL_NOT_FOUND');
      if (callback) callback(false);
      return false;
    }

    // Validate socket and resolve user information
    console.log(chalk.blue('UnifiedCallManager'), `Validating socket and resolving user for socket: ${socketId}`);
    const validation = this._validateSocketAndResolveUser(socketId);
    
    if (!validation.isValid) {
      console.error(chalk.red('UnifiedCallManager'), `Socket validation failed: ${validation.error}`);
      this.emitCallError(socketId, validation.error, validation.errorType);
      if (callback) callback(false);
      return false;
    }
    
    console.log(chalk.blue('UnifiedCallManager'), `Validated user ${validation.discordId} with ${validation.phones.length} phones`);
    const userPhones = validation.phones;

    // Find which of the user's phones is actually in this call
    let phoneInCall = userPhones.find(phone => call.includesPhone(phone));
    
    // For GROUP calls, allow phones to join dynamically even if not originally in the call
    if (!phoneInCall && call.type === BaseCall.TYPES.GROUP) {
      // Use the first available phone for this user to join the group call
      phoneInCall = userPhones[0];
    }
    
    if (!phoneInCall) {
      const error = `None of user's phones are in call ${callId}`;
      console.error(chalk.red('UnifiedCallManager'), error);
      this.emitCallError(socketId, error, 'PHONE_NOT_IN_CALL');
      if (callback) callback(false);
      return false;
    }

    // Validate the participating phone has Discord ID
    if (!phoneInCall.getDiscordId()) {
      const error = `Phone ${phoneInCall.getId()} not connected to Discord`;
      console.error(chalk.red('UnifiedCallManager'), error);
      this.emitCallError(socketId, error, 'PHONE_NOT_CONNECTED');
      if (callback) callback(false);
      return false;
    }

    // Use the participating phone for all subsequent operations
    const phone = phoneInCall;

    try {

      let result = false;
      // Handle call type-specific acceptance logic
      if (call.type === BaseCall.TYPES.P2P) {
        result = await this.acceptP2PCall(/** @type {CallRequest} */ (call), phone, socketId);
      } else if (call.type === BaseCall.TYPES.GROUP || call.type === BaseCall.TYPES.REC) {
        result = await this.acceptGroupCall(/** @type {GroupCallRequest} */ (call), phone, socketId);
      }

      // Emit success response to client
      if (result) {
        this.emitJoinedCall(socketId, true);
        this.broadcastCallUpdate(call);
      }
      
      if (callback) callback(result);
      return result;
    } catch (error) {
      console.error(chalk.red('UnifiedCallManager'), `Error accepting call ${callId}:`, error);
      this.emitCallError(socketId, error.message, 'ACCEPTANCE_ERROR');
      if (callback) callback(false);
      return false;
    }
  }

  /**
   * Accept a P2P call
   * @param {CallRequest} call - The P2P call to accept
   * @param {Phone} acceptingPhone - Phone accepting the call
   * @param {string} socketId - Socket ID for direct emissions
   * @returns {Promise<boolean>} True if successful
   */
  async acceptP2PCall(call, acceptingPhone, socketId) {
    // Move call from requested to active
    this.requestedCalls.delete(call.id);
    this.activeCalls.set(call.id, call);
    
    // Update call status
    call.updateStatus(BaseCall.STATUS.ACCEPTED);
    console.info(chalk.magenta('UnifiedCallManager'), `acceptP2PCall after updateStatus: ${call.id} status=${call.status}`);
    
    // Allocate Discord channel using existing bot method
    const channelId = this.bot.getAvailableCallChannel();
    if (!channelId) {
      // Try to preempt a lower priority call
      const channelToTerminate = this.selectChannelToTerminate(call.type, call.level);
      if (channelToTerminate) {
        await this.terminateCallForChannel(channelToTerminate.channelId);
        // Retry allocation
        const retryChannelId = this.bot.getAvailableCallChannel();
        if (!retryChannelId) {
          call.updateStatus(BaseCall.STATUS.REJECTED);
          this.activeCalls.delete(call.id);
          this.requestedCalls.set(call.id, call);
          return false;
        }
        call.channel = retryChannelId;
      } else {
        call.updateStatus(BaseCall.STATUS.REJECTED);
        this.activeCalls.delete(call.id);
        this.requestedCalls.set(call.id, call);
        return false;
      }
    } else {
      call.channel = channelId;
      console.info(chalk.magenta('UnifiedCallManager'), `acceptP2PCall channel assigned: ${call.id} channel=${call.channel} status=${call.status}`);
    }
    
    // Move participants to voice channel using existing bot method
    const allPhones = call.getAllPhones();
    let moveFailed = false;
    for (const phone of allPhones) {
      const discordId = phone.getDiscordId();
      if (discordId) {
        try {
          const moved = await this.bot.setUserVoiceChannel(discordId, call.channel);
          if (!moved) {
            console.error(chalk.red('UnifiedCallManager'), `Failed to move user ${phone.getId()} to channel (returned false)`);
            moveFailed = true;
            break;
          }
        } catch (error) {
          console.error(chalk.red('UnifiedCallManager'), `Failed to move user ${phone.getId()} to channel:`, error);
          moveFailed = true;
          break;
        }
      }
    }

    if (moveFailed) {
      // Release reservation and move to past calls as an ended call
      if (call.channel) {
        this.bot.releasePrivateCallChannelReservation(call.channel);
      }
      // Move call to past which will set an appropriate final status (ENDED for P2P)
      this.moveCallToPast(call);
      // Update phone call queues
      this.updatePhoneCallQueues(allPhones);
      console.info(chalk.magenta('UnifiedCallManager'), `acceptP2PCall failed and moved to past: ${call.id}`);
      return false;
    }
    
    // Update phone call queues
    this.updatePhoneCallQueues(allPhones);
    console.info(chalk.magenta('UnifiedCallManager'), `acceptP2PCall completed: ${call.id} status=${call.status}`);
    //console.log(chalk.green('UnifiedCallManager'), `P2P call ${call.id} accepted by ${acceptingPhone.getId()}`);
    return true;
  }

  /**
   * Accept a group call (GROUP or REC)
   * @param {GroupCallRequest} call - The group call to accept
   * @param {Phone} acceptingPhone - Phone accepting the call
   * @param {string} socketId - Socket ID for direct emissions
   * @returns {Promise<boolean>} True if successful
   */
  async acceptGroupCall(call, acceptingPhone, socketId) {
    // For GROUP calls, add the phone to the call if it's not already a participant
    if (call.type === BaseCall.TYPES.GROUP && !call.includesPhone(acceptingPhone)) {
      call.addParticipant(acceptingPhone);
    }
    
    // Update mobile station state
    const mobileStation = this.mobileStations.get(acceptingPhone.getId());
    if (mobileStation) {
      // Accept the group call on the mobile station
      mobileStation.accept();
    } else {
      // Create new mobile station for late joiner
      const newMobileStation = new MobileStationVGCS({
        msId: acceptingPhone.getId(),
        bus: this.vgcsBus,
        autoAnswer: false
      });
      this.mobileStations.set(acceptingPhone.getId(), newMobileStation);
      this.phoneToCallMap.set(acceptingPhone.getId(), call.id);
      
      // Join the existing group call
      newMobileStation.accept();
    }
    
    // If this is the first acceptance and call is still in N1_INITIATED, move to N3_ESTABLISHING
    if (call.status === BaseCall.STATUS.N1_INITIATED) {
      call.updateStatus(BaseCall.STATUS.N3_ESTABLISHING);
      
      // Allocate channel for the group call using existing bot method
      const channelId = this.bot.getAvailableCallChannel();
      if (!channelId) {
        console.error(chalk.red('UnifiedCallManager'), `Failed to allocate channel for group call ${call.id}`);
        return false;
      }
      
      call.channel = channelId;
      
      // Move call to active
      this.requestedCalls.delete(call.id);
      this.activeCalls.set(call.id, call);
      
      // Move to N2_ACTIVE
      call.updateStatus(BaseCall.STATUS.N2_ACTIVE);
    }
    
    // Move accepting phone to voice channel
    if (call.channel) {
      try {
        const moved = await this.bot.setUserVoiceChannel(acceptingPhone.getDiscordId(), call.channel);
        if (!moved) {
          console.error(chalk.red('UnifiedCallManager'), `Failed to move user ${acceptingPhone.getId()} to channel (returned false)`);
          // Release reservation and roll back call state for group calls as well
          this.bot.releasePrivateCallChannelReservation(call.channel);
          call.updateStatus(BaseCall.STATUS.N4_TERMINATING);
          this.activeCalls.delete(call.id);
          this.requestedCalls.set(call.id, call);
          return false;
        }
      } catch (error) {
        console.error(chalk.red('UnifiedCallManager'), `Failed to move user ${acceptingPhone.getId()} to channel:`, error);
        // Rollback similarly
        this.bot.releasePrivateCallChannelReservation(call.channel);
        call.updateStatus(BaseCall.STATUS.N4_TERMINATING);
        this.activeCalls.delete(call.id);
        this.requestedCalls.set(call.id, call);
        return false;
      }
    }
    
    // Update phone call queues
    this.updatePhoneCallQueues(call.getAllPhones());
    
    //console.log(chalk.green('UnifiedCallManager'), `Group call ${call.id} accepted by ${acceptingPhone.getId()}`);
    return true;
  }

  /**
   * Reject a call
   * @param {string} socketId - Socket ID of the rejecting user
   * @param {string} callId - Call ID to reject
   * @param {Function} [callback] - Optional callback for socket response
   * @returns {Promise<boolean>} True if successful
   */
  async rejectCall(socketId, callId, callback = null) {
    const context = { socketId, callId, phoneId: null, phone: null, call: null };
    
    try {
      // Validate request context
      if (!this._validateRejectRequest(context)) {
        return this._handleRejectFailure(context, callback);
      }
      
      // Execute rejection strategy based on call type
      const result = await this._executeRejectStrategy(context);
      
      //console.log(chalk.green('UnifiedCallManager'), `Call ${callId} rejected by ${context.phoneId}`);
      if (callback) callback({ success: result });
      return result;
    } catch (error) {
      console.error(chalk.red('UnifiedCallManager'), `Error rejecting call ${callId}:`, error);
      this.emitCallError(socketId, error.message, 'REJECTION_ERROR');
      if (callback) callback({ success: false });
      return false;
    }
  }

  /**
   * Validate the reject request and populate context
   * @private
   * @param {Object} context - Request context to validate and populate
   * @returns {boolean} True if request is valid
   */
  _validateRejectRequest(context) {
    // Get the call from requested calls first
    context.call = this.requestedCalls.get(context.callId);
    if (!context.call) {
      context.error = `Call not found for rejection: ${context.callId}`;
      context.errorType = 'CALL_NOT_FOUND';
      return false;
    }

    // Get all phones for this user
    const userPhones = this.getAllPhonesForSocket(context.socketId);
    if (!userPhones || userPhones.length === 0) {
      context.error = `No phones found for socket: ${context.socketId}`;
      context.errorType = 'NO_PHONES_FOUND';
      return false;
    }

    // Find which of the user's phones is actually in this call
    const phoneInCall = userPhones.find(phone => context.call.includesPhone(phone));
    if (!phoneInCall) {
      context.error = `None of user's phones are in call ${context.callId}`;
      context.errorType = 'PHONE_NOT_IN_CALL';
      return false;
    }

    // Set the participating phone and phoneId in context
    context.phone = phoneInCall;
    context.phoneId = phoneInCall.getId();

    return true;
  }

  /**
   * Handle reject request failure
   * @private
   * @param {Object} context - Request context with error information
   * @param {Function} [callback] - Optional callback for socket response
   * @returns {boolean} Always false for failure
   */
  _handleRejectFailure(context, callback) {
    console.error(chalk.red('UnifiedCallManager'), context.error);
    this.emitCallError(context.socketId, context.error, context.errorType);
    if (callback) callback({ success: false });
    return false;
  }

  /**
   * Execute the appropriate rejection strategy based on call type
   * @private
   * @param {Object} context - Validated request context
   * @returns {Promise<boolean>} True if successful
   */
  async _executeRejectStrategy(context) {
    const { call, phone, socketId, callId } = context;
    
    if (call.type === BaseCall.TYPES.P2P) {
      return this._rejectP2PCall(call);
    } else {
      return await this._rejectGroupCall(call, phone, socketId, callId);
    }
  }

  /**
   * Reject a P2P call - always terminates the entire call
   * @private
   * @param {BaseCall} call - The P2P call to reject
   * @returns {boolean} True if successful
   */
  _rejectP2PCall(call) {
    call.updateStatus(BaseCall.STATUS.REJECTED);
    this.moveCallToPast(call);
    
    // Notify all participants about rejection
    const allPhones = call.getAllPhones();
    this.updatePhoneCallQueues(allPhones);
    this.broadcastCallRejected(call);
    
    return true;
  }

  /**
   * Reject a group call - behavior depends on who is rejecting
   * @private
   * @param {GroupCallRequest} call - The group call to reject
   * @param {Phone} phone - The phone rejecting the call
   * @param {string} socketId - Socket ID for termination if needed
   * @param {string} callId - Call ID for termination if needed
   * @returns {Promise<boolean>} True if successful
   */
  async _rejectGroupCall(call, phone, socketId, callId) {
    const groupCall = /** @type {GroupCallRequest} */ (call);
    
    // If originator rejects, terminate the entire call
    if (groupCall.isOriginator && groupCall.isOriginator(phone)) {
      call.updateStatus(BaseCall.STATUS.N4_TERMINATING);
      return await this.terminateCall(socketId, callId, 'ORIGINATOR_REJECTED');
    }
    
    // Otherwise, just remove this participant
    if (groupCall.removeParticipant) {
      groupCall.removeParticipant(phone);
    }
    this.mobileStations.delete(phone.getId());
    this.phoneToCallMap.delete(phone.getId());
    
    // Update call queues for this phone only
    this.updatePhoneCallQueues([phone]);
    return true;
  }

  /**
   * Terminate a call
   * @param {string} socketId - Socket ID of the terminating user
   * @param {string} callId - Call ID to terminate
   * @param {string} [reason] - Reason for termination (optional)
   * @returns {Promise<boolean>} True if successful
   */
  async terminateCall(socketId, callId, reason = 'COMPLETED', callback = null) {
    // Allow system-initiated terminations where socketId may be null or 'SYSTEM'
    let phoneId = null;
    if (socketId) {
      phoneId = this.getPhoneIdFromSocket(socketId);
      if (!phoneId) {
        const error = `Could not determine phone ID for socket: ${socketId}`;
        console.error(chalk.red('UnifiedCallManager'), error);
        this.emitCallError(socketId, error, 'INVALID_SOCKET');
        if (callback) callback(false);
        return false;
      }
    }

    const call = this.activeCalls.get(callId) || this.requestedCalls.get(callId);
    if (!call) {
      console.error(chalk.red('UnifiedCallManager'), `Call not found for termination: ${callId}`);
      this.emitCallError(socketId, 'Call not found', 'CALL_NOT_FOUND');
      if (callback) callback(false);
      return false;
    }

    try {
      // Update call status
      if (call.type === BaseCall.TYPES.P2P) {
        call.updateStatus(BaseCall.STATUS.ENDED);
      } else {
        call.updateStatus(BaseCall.STATUS.N4_TERMINATING);
      }
      
      // Release Discord channel using existing bot method
      if (call.channel && this.bot && typeof this.bot.terminateCallForChannel === 'function') {
        try {
          await this.bot.terminateCallForChannel(call.channel, 'SYSTEM', 'COMPLETED');
        } catch (error) {
          console.error(chalk.red('UnifiedCallManager'), `Failed to terminate channel ${call.channel}:`, error);
        }
      }
      
      // Clean up VGCS resources for group calls
      if (call.type === BaseCall.TYPES.GROUP || call.type === BaseCall.TYPES.REC) {
        call.getAllPhones().forEach(phone => {
          this.mobileStations.delete(phone.getId());
          this.phoneToCallMap.delete(phone.getId());
        });
      }
      
      // Move to past calls
      this.moveCallToPast(call);
      
      // Update phone call queues
      this.updatePhoneCallQueues(call.getAllPhones());
      
      //console.log(chalk.green('UnifiedCallManager'), `Call ${callId} terminated`);
      
      // Emit call ended event
      if (this.io) {
        this.broadcastCallEnded(call, reason);
      }
      
      if (callback) callback(true);
      return true;
    } catch (error) {
      console.error(chalk.red('UnifiedCallManager'), `Error terminating call ${callId}:`, error);
      if (callback) callback(false);
      return false;
    }
  }

  // ===== UTILITY METHODS =====

 /**
 * Move a call to past calls storage with automatic cleanup
 * @param {BaseCall} call - Call to move
 */
moveCallToPast(call) {
  // Remove from active storage
  this.activeCalls.delete(call.id);
  this.requestedCalls.delete(call.id);
  
  // Clean up VGCS mobile stations for GROUP and REC calls
  if (call.type === BaseCall.TYPES.GROUP || call.type === BaseCall.TYPES.REC) {
    this._cleanupVGCSResources(call);
  }
  
  // Set final status
  this._setFinalCallStatus(call);
  
  // Add to past calls with timestamp tracking
  const now = Date.now();
  this.pastCalls.set(call.id, call);
  this.pastCallsTimestamps.set(call.id, now);
  
  // Trigger cleanup if needed (async to avoid blocking)
  if (this.pastCalls.size >= UnifiedCallManager.CLEANUP_THRESHOLD) {
    setImmediate(() => this._cleanupPastCalls());
  }
}

/**
 * Clean up VGCS resources for a call
 * @param {BaseCall} call - Call with VGCS resources to clean
 * @private
 */
_cleanupVGCSResources(call) {
  for (const [phoneId, callId] of this.phoneToCallMap.entries()) {
    if (callId === call.id) {
      // Clean up mobile station with better error handling
      const mobileStation = this.mobileStations.get(phoneId);
      if (mobileStation) {
        try {
          // Check if _reset method exists before calling
          if (typeof mobileStation._reset === 'function') {
            mobileStation._reset(false);
          } else if (typeof mobileStation._reset === 'function') {
            mobileStation._reset();
          } else {
            // Fallback: set state to terminated
            mobileStation.state = 'TERMINATED';
          }
        } catch (error) {
          console.warn(chalk.yellow('UnifiedCallManager'), 
            `Failed to reset mobile station ${phoneId}:`, error.message);
          // Force cleanup anyway
          mobileStation.state = 'ERROR';
        }
      }
      this.mobileStations.delete(phoneId);
      this.phoneToCallMap.delete(phoneId);
    }
  }
}

/**
 * Set appropriate final status for a call
 * @param {BaseCall} call - Call to set final status for
 * @private
 */
_setFinalCallStatus(call) {
  if (call.type === BaseCall.TYPES.P2P) {
    if (![BaseCall.STATUS.REJECTED, BaseCall.STATUS.ENDED].includes(call.status)) {
      call.updateStatus(BaseCall.STATUS.ENDED);
    }
  } else {
    if (call.status !== BaseCall.STATUS.N0_NULL) {
      call.updateStatus(BaseCall.STATUS.N0_NULL);
    }
  }
}

/**
 * Clean up old past calls using LRU + TTL strategy
 * @private
 */
_cleanupPastCalls() {
  const now = Date.now();
  const callsToRemove = [];
  
  // Strategy 1: Remove calls older than TTL
  for (const [callId, timestamp] of this.pastCallsTimestamps.entries()) {
    if (now - timestamp > UnifiedCallManager.PAST_CALLS_TTL_MS) {
      callsToRemove.push({ callId, timestamp, reason: 'TTL_EXPIRED' });
    }
  }
  
  // Strategy 2: If still over limit, remove oldest calls (LRU)
  if (this.pastCalls.size - callsToRemove.length > UnifiedCallManager.MAX_PAST_CALLS) {
    const remainingCalls = Array.from(this.pastCallsTimestamps.entries())
      .filter(([callId]) => !callsToRemove.some(item => item.callId === callId))
      .sort((a, b) => a[1] - b[1]); // Sort by timestamp (oldest first)
    
    const excessCount = this.pastCalls.size - callsToRemove.length - UnifiedCallManager.MAX_PAST_CALLS;
    const oldestToRemove = remainingCalls.slice(0, Math.min(excessCount, UnifiedCallManager.CLEANUP_BATCH_SIZE));
    
    oldestToRemove.forEach(([callId, timestamp]) => {
      callsToRemove.push({ callId, timestamp, reason: 'LRU_EVICTION' });
    });
  }
  
  // Perform the actual cleanup
  const cleanupStats = {
    totalRemoved: callsToRemove.length,
    ttlExpired: callsToRemove.filter(item => item.reason === 'TTL_EXPIRED').length,
    lruEvicted: callsToRemove.filter(item => item.reason === 'LRU_EVICTION').length,
    sizeBefore: this.pastCalls.size,
    sizeAfter: 0
  };
  
  callsToRemove.forEach(({ callId, reason }) => {
    // Get call before deletion for any final cleanup
    const call = this.pastCalls.get(callId);
    if (call) {
      this._finalCallCleanup(call, reason);
    }
    
    this.pastCalls.delete(callId);
    this.pastCallsTimestamps.delete(callId);
  });
  
  cleanupStats.sizeAfter = this.pastCalls.size;
  
  if (cleanupStats.totalRemoved > 0) {
    console.log(chalk.blue('UnifiedCallManager'), 
      `Past calls cleanup: removed ${cleanupStats.totalRemoved} calls ` +
      `(${cleanupStats.ttlExpired} TTL expired, ${cleanupStats.lruEvicted} LRU evicted). ` +
      `Size: ${cleanupStats.sizeBefore} → ${cleanupStats.sizeAfter}`);
  }
}

/**
 * Final cleanup for a call being removed from past calls
 * @param {BaseCall} call - Call being permanently removed
 * @param {string} reason - Reason for removal
 * @private
 */
_finalCallCleanup(call, reason) {
  // Log for audit trail if needed
  if (call.type === BaseCall.TYPES.REC) {
    console.log(chalk.gray('UnifiedCallManager'), 
      `Removing REC call from history: ${call.id} (${reason})`);
  }
  
  // Could add metrics collection here
  // this.metrics?.recordCallRemoved(call.type, reason);
}

  /**
   * Update call queues for multiple phones
   * @param {Phone[]} phones - Phones to update
   */
  updatePhoneCallQueues(phones) {
    phones.forEach(phone => {
      if (phone && phone.getDiscordId()) {
        this.requestPhoneQueueUpdate(phone.getId());
      }
    });
  }

  /**
   * Request call queue update for a specific phone
   * @param {string} phoneId - Phone ID to update
   */
  requestPhoneQueueUpdate(phoneId) {
    const phone = this.phoneManager.getPhone(phoneId);
    if (!phone) return;
    
    const queue = this.getCallQueueForPhone(phone);
    const discordId = phone.getDiscordId();
    
    if (discordId) {
      this.io.to(discordId).emit('callQueueUpdate', {
        phoneId: phoneId,
        queue: queue.map(call => call.toEmittable())
      });
    }
  }

  /**
   * Send new call notifications to participants
   * @param {BaseCall} call - Call to send notifications for
   */
  sendNewCallNotifications(call) {
    if (!this.io) {
      console.warn(chalk.yellow('UnifiedCallManager'), 'No socket.io instance available for sendNewCallNotifications');
      return;
    }
    
    const participants = call.getAllPhones();
    
    // Send call offered events to participants (receivers for P2P, all participants for GROUP/REC)
    let receivers = [];
    if (call.type === BaseCall.TYPES.P2P) {
      // For P2P calls, notify the receiver (not the sender)
      const p2pCall = /** @type {CallRequest} */ (call);
      if (p2pCall.receivers && p2pCall.receivers.length > 0) {
        receivers = [p2pCall.receivers[0]];
      }
    } else {
      // For GROUP/REC calls, notify all participants
      receivers = participants;
    }
      
    console.log(chalk.blue('UnifiedCallManager'), `Sending call notifications for ${call.type} call ${call.id} to ${receivers.length} receivers`);
    
    receivers.forEach(phone => {
      const discordId = phone.getDiscordId();
      console.log(chalk.blue('UnifiedCallManager'), `Notifying phone ${phone.getId()} (discordId: ${discordId}) about call ${call.id}`);
      
      if (discordId) {
        // Get base call data
        const callData = call.toEmittable();
        
        // For REC calls, customize the data per participant
        if (call.type === BaseCall.TYPES.REC) {
          const groupCall = /** @type {GroupCallRequest} */ (call);
          const isOriginator = groupCall.originator && groupCall.originator.getId() === phone.getId();
          
          // Add REC-specific fields
          callData.isOriginator = isOriginator;
          callData.countdown = isOriginator ? 0 : 5; // No countdown for originator, 5s for recipients
          
          console.log(chalk.blue('UnifiedCallManager'), `REC call: phone ${phone.getId()} isOriginator=${isOriginator}, countdown=${callData.countdown}`);
          
          // Auto-accept for originator
          if (isOriginator) {
            console.log(chalk.green('UnifiedCallManager'), `Auto-accepting REC call for originator ${phone.getId()}`);
            // We'll auto-accept this call after sending notifications
            setImmediate(async () => {
              const user = this.rocManager?.getUserByDiscordId(discordId);
              if (user && user.socket) {
                await this.acceptCall(user.socket.id, call.id);
              }
            });
          }
        }
        
        // Send callUpdate event for new call notification - unified with other call updates
        this.io.to(discordId).emit('callUpdate', callData);
        console.log(chalk.green('UnifiedCallManager'), `Sent 'callUpdate' to ${discordId} for call ${call.id}`);
        
        // Group call specific notifications
        if (call.type === BaseCall.TYPES.GROUP || call.type === BaseCall.TYPES.REC) {
          this.io.to(discordId).emit('groupCallInitiated', {
            type: call.type,
            groupId: call.id,
            level: call.level,
            callData: callData
          });
          console.log(chalk.green('UnifiedCallManager'), `Sent 'groupCallInitiated' to ${discordId} for call ${call.id}`);
        }
      } else {
        console.warn(chalk.yellow('UnifiedCallManager'), `Phone ${phone.getId()} has no Discord ID - cannot send call notification`);
      }
    });
    
    // All call types now use the same unified notification system
    // REC-specific UI behavior (modals, countdowns) is handled client-side based on call.type
  }

  // REC notification method removed - all calls now use unified callUpdate events
  // REC-specific UI behavior (modals, countdowns, etc.) is handled client-side

  /**
   * Get Discord IDs of all admin users for notification differentiation
   * @returns {string[]} Array of admin Discord IDs
   * @private
   */
  _getAdminDiscordIds() {
    // This would typically get admin users from ROCManager
    // For now return empty array - this should be integrated with the admin system
    if (this.rocManager && typeof this.rocManager.getAllAdmins === 'function') {
      return this.rocManager.getAllAdmins().map(admin => admin.discordId).filter(id => id);
    }
    return [];
  }

  /**
   * Check if a phone is currently on a REC call
   * @param {string} phoneId - Phone ID to check
   * @returns {boolean} True if phone is on a REC call
   */
  isPhoneOnRECCall(phoneId) {
    const callId = this.phoneToCallMap.get(phoneId);
    if (!callId) return false;
    
    const call = this.activeCalls.get(callId) || this.requestedCalls.get(callId);
    return call && call.type === BaseCall.TYPES.REC;
  }

  /**
   * Get REC phones from a group identifier
   * @param {string} groupId - Group identifier
   * @returns {Phone[]} Array of REC phones
   */
  getRecPhonesFromGroup(groupId) {
    // This would be implemented based on the simulation/group configuration
    // For now, return empty array - to be extended with actual group management
    console.warn(chalk.yellow('UnifiedCallManager'), `Group-based REC phones not implemented for group: ${groupId}`);
    return [];
  }

  /**
   * Terminate a call using a specific channel
   * @param {string} channelId - Discord channel ID
   * @returns {Promise<boolean>} True if successful
   */
  async terminateCallForChannel(channelId) {
    // Find call using this channel
    for (const call of this.activeCalls.values()) {
      if (call.channel === channelId) {
        // Use system-initiated termination (no socket) so we pass null as socketId
        return await this.terminateCall(null, call.id, 'CHANNEL_TERMINATE');
      }
    }
    return false;
  }

  /**
   * Find active call for a Discord user
   * @param {string} discordId - Discord user ID
   * @returns {BaseCall|null} Active call or null
   */
  findActiveCallForPlayer(discordId) {
    // Check active calls
    for (const call of this.activeCalls.values()) {
      const participants = call.getAllPhones();
      if (participants.some(phone => phone.getDiscordId() === discordId)) {
        return call;
      }
    }
    
    // Check requested calls
    for (const call of this.requestedCalls.values()) {
      const participants = call.getAllPhones();
      if (participants.some(phone => phone.getDiscordId() === discordId)) {
        return call;
      }
    }
    
    return null;
  }

  /**
   * Get all private calls (P2P and GROUP)
   * @returns {BaseCall[]} Array of private calls
   */
  getAllPrivateCalls() {
    const calls = [];
    
    // Add requested calls
    for (const call of this.requestedCalls.values()) {
      if (call.type === BaseCall.TYPES.P2P || call.type === BaseCall.TYPES.GROUP) {
        calls.push(call);
      }
    }
    
    // Add active calls
    for (const call of this.activeCalls.values()) {
      if (call.type === BaseCall.TYPES.P2P || call.type === BaseCall.TYPES.GROUP) {
        calls.push(call);
      }
    }
    
    return calls;
  }

  /**
   * Get all active group calls (including REC)
   * @returns {BaseCall[]} Array of active group calls
   */
  getAllActiveGroupCalls() {
    const groupCalls = [];
    
    // Add requested group calls
    for (const call of this.requestedCalls.values()) {
      if (call.type === BaseCall.TYPES.GROUP || call.type === BaseCall.TYPES.REC) {
        groupCalls.push(call);
      }
    }
    
    // Add active group calls
    for (const call of this.activeCalls.values()) {
      if (call.type === BaseCall.TYPES.GROUP || call.type === BaseCall.TYPES.REC) {
        groupCalls.push(call);
      }
    }
    
    return groupCalls;
  }

  /**
   * Get error recipients for error notifications
   * @param {string} callId - Call ID if error is call-specific
   * @param {string} phoneId - Phone ID if error is phone-specific
   * @returns {string[]} Array of Discord IDs to notify
   */
  getErrorRecipients(callId, phoneId) {
    const recipients = [];
    
    if (callId) {
      const call = this.activeCalls.get(callId) || this.requestedCalls.get(callId);
      if (call) {
        call.getAllPhones().forEach(phone => {
          const discordId = phone.getDiscordId();
          if (discordId) recipients.push(discordId);
        });
      }
    }
    
    if (phoneId) {
      const phone = this.phoneManager.getPhone(phoneId);
      if (phone && phone.getDiscordId()) {
        recipients.push(phone.getDiscordId());
      }
    }
    
    return [...new Set(recipients)]; // Remove duplicates
  }

  /**
   * Attempt to recover from an error
   * @param {string} callId - Call ID to recover
   * @param {Error} error - Original error
   * @returns {boolean} True if recovery was attempted
   */
  attemptErrorRecovery(callId, error) {
    const call = this.activeCalls.get(callId) || this.requestedCalls.get(callId);
    if (!call) {
      console.warn(chalk.yellow('UnifiedCallManager'), `Cannot recover call ${callId} - not found`);
      return false;
    }

    try {
      if (error.message.includes('network timeout')) {
        return this.handleNetworkTimeoutRecovery(call);
      } else if (error.message.includes('connection lost')) {
        return this.handleConnectionLostRecovery(call);
      }
      
      console.warn(chalk.yellow('UnifiedCallManager'), `No recovery strategy for error: ${error.message}`);
      return false;
    } catch (recoveryError) {
      console.error(chalk.red('UnifiedCallManager'), `Recovery failed for call ${callId}:`, recoveryError);
      return false;
    }
  }

  /**
   * Handle network timeout recovery
   * @param {BaseCall} call - Call to recover
   * @returns {boolean} True if recovery successful
   */
  handleNetworkTimeoutRecovery(call) {
    //console.log(chalk.yellow('UnifiedCallManager'), `Attempting network timeout recovery for call ${call.id}`);
    
    // For active group calls, try to re-establish connection
    if ((call.type === BaseCall.TYPES.GROUP || call.type === BaseCall.TYPES.REC) && 
        call.status === BaseCall.STATUS.N2_ACTIVE) {
      
      // Reset VGCS components (simplified for now)
      call.getAllPhones().forEach(phone => {
        const mobileStation = this.mobileStations.get(phone.getId());
        if (mobileStation) {
          // Note: resetConnection method doesn't exist, so just log for now
          //console.log(chalk.yellow('UnifiedCallManager'), `Would reset connection for ${phone.getId()}`);
        }
      });
      
      return true;
    }
    
    return false;
  }

  /**
   * Handle connection lost recovery
   * @param {BaseCall} call - Call to recover
   * @returns {boolean} True if recovery successful
   */
  handleConnectionLostRecovery(call) {
    //console.log(chalk.yellow('UnifiedCallManager'), `Attempting connection lost recovery for call ${call.id}`);
    
    // Notify participants about connection issues
    call.getAllPhones().forEach(phone => {
      const discordId = phone.getDiscordId();
      if (discordId) {
        this.io.to(discordId).emit('callConnectionIssue', {
          callId: call.id,
          message: 'Connection lost, attempting to reconnect...'
        });
      }
    });
    
    return true;
  }

  // ===== SOCKET INTEGRATION METHODS (TASK-UCM-003) =====

  /**
   * Emit call error to a specific socket
   * @param {string} socketId - Target socket ID
   * @param {string} message - Error message
   * @param {string} type - Error type
   */
  emitCallError(socketId, message, type) {
    if (!this.io) {
      console.warn(chalk.yellow('UnifiedCallManager'), 'No socket.io instance available for emitCallError');
      return;
    }
    
    this.io.to(socketId).emit('callError', {
      error: message,
      type: type,
      timestamp: Date.now()
    });
  }

  /**
   * Emit joined call success to a specific socket
   * @param {string} socketId - Target socket ID
   * @param {boolean} success - Whether join was successful
   */
  emitJoinedCall(socketId, success) {
    if (!this.io) {
      console.warn(chalk.yellow('UnifiedCallManager'), 'No socket.io instance available for emitJoinedCall');
      return;
    }
    
    this.io.to(socketId).emit('joinedCall', { success });
  }

  /**
   * Emit kicked from call event to a specific socket
   * @param {string} discordId - Target Discord ID (socket room)
   * @param {string} callId - Call ID
   * @param {string} reason - Reason for being kicked
   */
  emitKickedFromCall(discordId, callId, reason) {
    if (!this.io) {
      console.warn(chalk.yellow('UnifiedCallManager'), 'No socket.io instance available for emitKickedFromCall');
      return;
    }
    
    this.io.to(discordId).emit('kickedFromCall', {
      success: true,
      callId,
      reason
    });
  }

  /**
   * Broadcast call update to all participants
   * @param {BaseCall} call - Call to broadcast update for
   */
  broadcastCallUpdate(call) {
    if (!this.io) {
      console.warn(chalk.yellow('UnifiedCallManager'), 'No socket.io instance available for broadcastCallUpdate');
      return;
    }
    
    // Send complete call data so frontend can recreate the call object properly
    const callData = call.toEmittable();

    // Send to all participants
    const allPhones = call.getAllPhones();
    allPhones.forEach(phone => {
      const discordId = phone.getDiscordId();
      if (discordId) {
        this.io.to(discordId).emit('callUpdate', callData);
      }
    });

    // Also emit for admin interfaces with minimal data
    const adminUpdateData = {
      callId: call.id,
      status: call.status,
      type: call.type,
      level: call.level,
      timestamp: Date.now()
    };
    this.io.emit('adminCallUpdate', adminUpdateData);
  }

  /**
   * Broadcast call rejected event to all participants
   * @param {BaseCall} call - Call that was rejected
   */
  broadcastCallRejected(call) {
    if (!this.io) {
      console.warn(chalk.yellow('UnifiedCallManager'), 'No socket.io instance available for broadcastCallRejected');
      return;
    }
    
    // Send complete call data for proper frontend handling
    const callData = call.toEmittable();

    // Send to all participants
    const allPhones = call.getAllPhones();
    allPhones.forEach(phone => {
      const discordId = phone.getDiscordId();
      if (discordId) {
        this.io.to(discordId).emit('callUpdate', callData);
      }
    });
  }

  /**
   * Broadcast call ended event to all participants
   * @param {BaseCall} call - Call that ended
   * @param {string} reason - Reason for ending
   */
  broadcastCallEnded(call, reason) {
    if (!this.io) {
      console.warn(chalk.yellow('UnifiedCallManager'), 'No socket.io instance available for broadcastCallEnded');
      return;
    }
    
    const endData = {
      callId: call.id,
      reason,
      timestamp: Date.now()
    };

    // Send to all participants
    const allPhones = call.getAllPhones();
    allPhones.forEach(phone => {
      const discordId = phone.getDiscordId();
      if (discordId) {
        this.io.to(discordId).emit('callEnded', endData);
      }
    });

    // Group call specific events
    if (call.type === BaseCall.TYPES.GROUP || call.type === BaseCall.TYPES.REC) {
      const groupEndData = {
        groupId: call.id,
        reason,
        timestamp: Date.now()
      };
      
      allPhones.forEach(phone => {
        const discordId = phone.getDiscordId();
        if (discordId) {
          this.io.to(discordId).emit('groupCallTerminated', groupEndData);
        }
      });
    }
  }


}