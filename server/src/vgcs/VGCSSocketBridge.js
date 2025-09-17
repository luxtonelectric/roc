// @ts-check
import chalk from 'chalk';
import { MSG } from './NetworkGCC.js';

/**
 * VGCSSocketBridge - Bridges VGCS messages with socket.io events
 * Translates between VGCS message format and ROC socket events
 */
export default class VGCSSocketBridge {
  /**
   * @param {import('../groupCallManager.js').default} groupCallManager 
   * @param {import('socket.io').Server} io 
   */
  constructor(groupCallManager, io) {
    this.groupCallManager = groupCallManager;
    this.io = io;
    
    console.log(chalk.green('VGCSSocketBridge'), 'VGCS Socket Bridge initialized');
  }

  /**
   * Handle VGCS message and convert to socket.io event
   * @param {string} phoneId 
   * @param {Object} vgcsMessage 
   */
  handleVGCSMessage(phoneId, vgcsMessage) {
    console.log(chalk.blue('VGCSSocketBridge.handleVGCSMessage'), 
      `Phone: ${phoneId}, Type: ${vgcsMessage.type}`);
    
    const phone = this.groupCallManager.phoneManager.getPhone(phoneId);
    if (!phone || !phone.getDiscordId()) {
      console.log(chalk.red('VGCSSocketBridge'), 'Phone or Discord ID not found');
      return;
    }

    const discordId = phone.getDiscordId();
    
    switch (vgcsMessage.type) {
      case MSG.NOTIFICATION:
        this._handleNotification(discordId, vgcsMessage);
        break;
        
      case MSG.START_ACK:
        this._handleStartAck(discordId, vgcsMessage);
        break;
        
      case MSG.JOIN_ACCEPT:
        this._handleJoinAccept(discordId, vgcsMessage);
        break;
        
      case MSG.CHANNEL_ASSIGN:
        this._handleChannelAssign(discordId, vgcsMessage);
        break;
        
      case MSG.WITHDRAWN:
        this._handleWithdrawn(discordId, vgcsMessage);
        break;
        
      case MSG.RELEASE:
        this._handleRelease(discordId, vgcsMessage);
        break;
        
      default:
        console.log(chalk.yellow('VGCSSocketBridge'), `Unhandled VGCS message type: ${vgcsMessage.type}`);
    }
  }

  /**
   * Convert socket.io event to VGCS message
   * @param {string} eventName 
   * @param {Object} eventData 
   * @returns {Object|null} VGCS message or null if not convertible
   */
  socketEventToVGCS(eventName, eventData) {
    console.log(chalk.blue('VGCSSocketBridge.socketEventToVGCS'), `Event: ${eventName}`);
    
    switch (eventName) {
      case 'startGroupCall':
        return {
          type: MSG.START_REQ,
          fromMs: eventData.phoneId,
          groupId: eventData.groupId,
          options: eventData.options || {}
        };
        
      case 'joinGroupCall':
        return {
          type: MSG.JOIN_REQ,
          fromMs: eventData.phoneId,
          groupId: eventData.groupId
        };
        
      case 'leaveGroupCall':
        return {
          type: MSG.LEAVE,
          fromMs: eventData.phoneId,
          groupId: eventData.groupId
        };
        
      case 'terminateGroupCall':
        return {
          type: MSG.TERMINATE,
          fromMs: eventData.phoneId,
          groupId: eventData.groupId
        };
        
      default:
        return null;
    }
  }

  // --- Internal event handlers ---

  /**
   * Handle NOTIFICATION message
   * @param {string} discordId 
   * @param {Object} message 
   */
  _handleNotification(discordId, message) {
    console.log(chalk.cyan('VGCSSocketBridge._handleNotification'), `To: ${discordId}`);
    
    this.io.to(discordId).emit('groupCallNotification', {
      groupId: message.groupId,
      priority: message.priority,
      autoAnswer: message.autoAnswer,
      type: 'notification'
    });
  }

  /**
   * Handle START_ACK message
   * @param {string} discordId 
   * @param {Object} message 
   */
  _handleStartAck(discordId, message) {
    console.log(chalk.cyan('VGCSSocketBridge._handleStartAck'), `To: ${discordId}`);
    
    this.io.to(discordId).emit('groupCallStartAcknowledged', {
      groupId: message.groupId,
      type: 'start_ack'
    });
  }

  /**
   * Handle JOIN_ACCEPT message
   * @param {string} discordId 
   * @param {Object} message 
   */
  _handleJoinAccept(discordId, message) {
    console.log(chalk.cyan('VGCSSocketBridge._handleJoinAccept'), `To: ${discordId}`);
    
    this.io.to(discordId).emit('groupCallJoinAccepted', {
      groupId: message.groupId,
      type: 'join_accept'
    });
  }

  /**
   * Handle CHANNEL_ASSIGN message
   * @param {string} discordId 
   * @param {Object} message 
   */
  async _handleChannelAssign(discordId, message) {
    console.log(chalk.cyan('VGCSSocketBridge._handleChannelAssign'), `To: ${discordId}`);
    
    // Get the group call to find the allocated Discord channel
    const groupCall = this.groupCallManager.activeGroupCalls.get(message.groupId);
    if (!groupCall) {
      console.log(chalk.red('VGCSSocketBridge._handleChannelAssign'), `Group call not found: ${message.groupId}`);
      return;
    }

    // Get the allocated Discord voice channel ID from the group call
    const discordChannelId = groupCall.channel;
    if (!discordChannelId) {
      console.log(chalk.red('VGCSSocketBridge._handleChannelAssign'), `No channel allocated for group: ${message.groupId}`);
      return;
    }
    
    // Move user to Discord voice channel
    if (this.groupCallManager.bot) {
      try {
        console.log(chalk.green('VGCSSocketBridge._handleChannelAssign'), 
          `Moving user ${discordId} to Discord channel ${discordChannelId}`);
        await this.groupCallManager.bot.setUserVoiceChannel(discordId, discordChannelId);
      } catch (error) {
        console.error(chalk.red('VGCSSocketBridge._handleChannelAssign'), 
          `Failed to move user to Discord channel:`, error);
      }
    }

    // Send UI update
    this.io.to(discordId).emit('groupCallChannelAssigned', {
      groupId: message.groupId,
      channelId: discordChannelId,
      type: 'channel_assign'
    });

    // If this is a REC call, trigger client-side join logic
    if (groupCall && groupCall.type === 'REC') {
      this.io.to(discordId).emit('recCallActive', {
        groupId: message.groupId,
        channelId: discordChannelId,
        groupCall: groupCall.toEmittable()
      });
    }
  }

  /**
   * Handle WITHDRAWN message
   * @param {string} discordId 
   * @param {Object} message 
   */
  _handleWithdrawn(discordId, message) {
    console.log(chalk.cyan('VGCSSocketBridge._handleWithdrawn'), `To: ${discordId}`);
    
    this.io.to(discordId).emit('groupCallWithdrawn', {
      groupId: message.groupId,
      reason: message.reason,
      type: 'withdrawn'
    });
  }

  /**
   * Handle RELEASE message
   * @param {string} discordId 
   * @param {Object} message 
   */
  _handleRelease(discordId, message) {
    console.log(chalk.cyan('VGCSSocketBridge._handleRelease'), `To: ${discordId}`);
    
    this.io.to(discordId).emit('groupCallReleased', {
      groupId: message.groupId,
      reason: message.reason,
      type: 'release'
    });
  }

  /**
   * Send group call status update to all participants
   * @param {string} groupId 
   * @param {Object} statusUpdate 
   */
  broadcastGroupCallStatus(groupId, statusUpdate) {
    console.log(chalk.blue('VGCSSocketBridge.broadcastGroupCallStatus'), `GroupId: ${groupId}`);
    
    const groupCall = this.groupCallManager.activeGroupCalls.get(groupId);
    if (!groupCall) {
      console.log(chalk.red('VGCSSocketBridge'), 'Group call not found for status update');
      return;
    }

    const allPhones = groupCall.getAllParticipants();
    
    allPhones.forEach(phone => {
      if (phone.getDiscordId()) {
        this.io.to(phone.getDiscordId()).emit('groupCallStatusUpdate', {
          groupId: groupId,
          ...statusUpdate
        });
      }
    });
  }

  /**
   * Send participant update to all participants
   * @param {string} groupId 
   * @param {string} participantAction - 'joined' or 'left'
   * @param {Object} participantInfo 
   */
  broadcastParticipantUpdate(groupId, participantAction, participantInfo) {
    console.log(chalk.blue('VGCSSocketBridge.broadcastParticipantUpdate'), 
      `GroupId: ${groupId}, Action: ${participantAction}`);
    
    const groupCall = this.groupCallManager.activeGroupCalls.get(groupId);
    if (!groupCall) {
      console.log(chalk.red('VGCSSocketBridge'), 'Group call not found for participant update');
      return;
    }

    const allPhones = groupCall.getAllParticipants();
    
    allPhones.forEach(phone => {
      if (phone.getDiscordId()) {
        this.io.to(phone.getDiscordId()).emit('groupCallParticipantUpdate', {
          groupId: groupId,
          action: participantAction,
          participant: participantInfo,
          totalParticipants: groupCall.getTotalUserCount()
        });
      }
    });
  }

  /**
   * TASK-030: Enhanced VGCS message processing for Phase 6
   * Process standardized VGCS message format for socket.io emission
   * @param {Object} message - VGCS message object
   * @param {string} message.type - Message type
   * @param {Object} message.data - Message data
   * @param {string} message.groupId - Group call ID
   * @param {string} [message.phoneId] - Phone ID
   * @param {string[]} [message.recipients] - List of Discord IDs
   */
  processStandardVGCSMessage(message) {
    const { type, data, groupId, phoneId, recipients } = message;
    
    console.log(chalk.blue('VGCSSocketBridge.processStandardVGCSMessage'), 
      `Type: ${type}, Group: ${groupId}, Phone: ${phoneId || 'N/A'}`);
    
    try {
      switch (type) {
        case 'GROUP_CALL_INITIATED':
          this._emitGroupCallInitiated(data, groupId, recipients);
          break;
          
        case 'GROUP_CALL_ACTIVE':
          this._emitGroupCallActive(data, groupId, recipients);
          break;
          
        case 'GROUP_CALL_TERMINATED':
          this._emitGroupCallTerminated(data, groupId, recipients);
          break;
          
        case 'REC_NOTIFICATION':
          this._emitRECNotification(data, groupId, phoneId, recipients);
          break;
          
        case 'FORCE_DISCONNECT':
          this._emitForceDisconnect(data, recipients);
          break;
          
        case 'PARTICIPANT_JOINED':
          this._emitParticipantJoined(data, groupId, recipients);
          break;
          
        case 'PARTICIPANT_LEFT':
          this._emitParticipantLeft(data, groupId, recipients);
          break;
          
        case 'VGCS_ERROR':
          this._emitVGCSError(data, groupId, phoneId, recipients);
          break;
          
        default:
          console.warn(chalk.yellow('VGCSSocketBridge'), `Unknown message type: ${type}`);
      }
    } catch (error) {
      console.error(chalk.red('VGCSSocketBridge Error'), `Failed to process message type ${type}:`, error);
      this._emitError(groupId, phoneId, `Message processing failed: ${error.message}`);
    }
  }

  /**
   * Emit group call initiated event
   * @param {Object} data - Call data
   * @param {string} groupId - Group call ID
   * @param {string[]} recipients - Recipients list
   */
  _emitGroupCallInitiated(data, groupId, recipients) {
    const eventData = {
      groupId,
      originatorPhoneId: data.originatorPhoneId,
      type: data.type,
      level: data.level,
      participants: data.participants || [],
      timestamp: Date.now()
    };

    // Emit to recipients
    if (recipients && recipients.length > 0) {
      recipients.forEach(discordId => {
        this.io.to(discordId).emit('groupCallInitiated', eventData);
      });
    }

    // Update admin interface
    this.io.emit('adminGroupCallUpdate', {
      action: 'initiated',
      ...eventData
    });
  }

  /**
   * Emit group call active event
   * @param {Object} data - Call data
   * @param {string} groupId - Group call ID
   * @param {string[]} recipients - Recipients list
   */
  _emitGroupCallActive(data, groupId, recipients) {
    const eventData = {
      groupId,
      status: 'active',
      channelId: data.channelId,
      participantCount: data.participantCount || 0,
      participants: data.participants || [],
      timestamp: Date.now()
    };

    // Emit to participants
    if (recipients && recipients.length > 0) {
      recipients.forEach(discordId => {
        this.io.to(discordId).emit('groupCallActive', eventData);
      });
    }

    // Update admin interface
    this.io.emit('adminGroupCallUpdate', {
      action: 'active',
      ...eventData
    });
  }

  /**
   * Emit group call terminated event
   * @param {Object} data - Call data
   * @param {string} groupId - Group call ID
   * @param {string[]} recipients - Recipients list
   */
  _emitGroupCallTerminated(data, groupId, recipients) {
    const eventData = {
      groupId,
      status: 'terminated',
      reason: data.reason || 'completed',
      timestamp: Date.now()
    };

    // Emit to participants
    if (recipients && recipients.length > 0) {
      recipients.forEach(discordId => {
        this.io.to(discordId).emit('groupCallTerminated', eventData);
      });
    }

    // Update admin interface
    this.io.emit('adminGroupCallUpdate', {
      action: 'terminated',
      ...eventData
    });
  }

  /**
   * Emit REC notification with admin/player differentiation
   * @param {Object} data - REC notification data
   * @param {string} groupId - Group call ID
   * @param {string} phoneId - Originator phone ID
   * @param {string[]} recipients - Recipients list
   */
  _emitRECNotification(data, groupId, phoneId, recipients) {
    // Get originator phone information for caller details
    const originatorPhone = this.groupCallManager.phoneManager.getPhone(phoneId);
    const originatorDiscordId = originatorPhone ? originatorPhone.getDiscordId() : null;
    
    // Get location information
    let originatorLocation = 'Unknown Location';
    if (originatorPhone && originatorPhone.getLocation()) {
      const location = originatorPhone.getLocation();
      originatorLocation = location.simId;
      if (location.panelId) {
        originatorLocation += ` - ${location.panelId}`;
      }
    }
    
    const eventData = {
      groupId,
      originatorPhoneId: phoneId,
      originatorName: data.originatorName || (originatorPhone ? originatorPhone.getName() : 'Unknown'),
      originatorLocation: originatorLocation,
      level: data.level,
      autoJoinCountdown: data.autoJoinCountdown || 5,
      timestamp: Date.now()
    };

    // Emit to recipients with different handling for admins vs players vs originator
    if (recipients && recipients.length > 0) {
      recipients.forEach(discordId => {
        const isAdmin = data.adminUsers && data.adminUsers.includes(discordId);
        const isOriginator = discordId === originatorDiscordId;
        
        if (isAdmin) {
          // Admin gets notification without modal - TASK-027 requirement
          this.io.to(discordId).emit('recAudioNotification', {
            ...eventData,
            showModal: false,
            autoAccept: false,
            isOriginator: false
          });
        } else if (isOriginator) {
          // Originator gets REC modal but without countdown and with different messaging
          this.io.to(discordId).emit('recNotification', {
            ...eventData,
            showModal: true,
            autoAccept: false, // Originator doesn't auto-accept
            autoJoinCountdown: 0, // No countdown for originator
            isOriginator: true,
            message: 'REC call initiated - waiting for responders'
          });
        } else {
          // Recipients get full REC modal with countdown
          this.io.to(discordId).emit('recNotification', {
            ...eventData,
            showModal: true,
            autoAccept: true,
            isOriginator: false
          });
        }
      });
    }
  }

  /**
   * Emit force disconnect event for REC priority
   * @param {Object} data - Disconnect data
   * @param {string[]} recipients - Recipients list
   */
  _emitForceDisconnect(data, recipients) {
    const eventData = {
      reason: 'REC call priority',
      newGroupId: data.groupId,
      newChannelId: data.channelId,
      timestamp: Date.now()
    };

    // Emit to users who need to be force-disconnected
    if (recipients && recipients.length > 0) {
      recipients.forEach(discordId => {
        this.io.to(discordId).emit('forceDisconnect', eventData);
      });
    }
  }

  /**
   * Emit participant joined event
   * @param {Object} data - Participant data
   * @param {string} groupId - Group call ID
   * @param {string[]} recipients - Recipients list
   */
  _emitParticipantJoined(data, groupId, recipients) {
    const eventData = {
      groupId,
      phoneId: data.phoneId,
      discordId: data.discordId,
      participantCount: data.participantCount || 0,
      timestamp: Date.now()
    };

    // Emit to all participants
    if (recipients && recipients.length > 0) {
      recipients.forEach(discordId => {
        this.io.to(discordId).emit('groupCallParticipantJoined', eventData);
      });
    }

    // Update admin interface
    this.io.emit('adminGroupCallUpdate', {
      action: 'participant_joined',
      ...eventData
    });
  }

  /**
   * Emit participant left event
   * @param {Object} data - Participant data
   * @param {string} groupId - Group call ID
   * @param {string[]} recipients - Recipients list
   */
  _emitParticipantLeft(data, groupId, recipients) {
    const eventData = {
      groupId,
      phoneId: data.phoneId,
      discordId: data.discordId,
      participantCount: data.participantCount || 0,
      reason: data.reason || 'voluntary',
      timestamp: Date.now()
    };

    // Emit to remaining participants
    if (recipients && recipients.length > 0) {
      recipients.forEach(discordId => {
        this.io.to(discordId).emit('groupCallParticipantLeft', eventData);
      });
    }

    // Update admin interface
    this.io.emit('adminGroupCallUpdate', {
      action: 'participant_left',
      ...eventData
    });
  }

  /**
   * Emit VGCS error event
   * @param {Object} data - Error data
   * @param {string} groupId - Group call ID
   * @param {string} phoneId - Phone ID
   * @param {string[]} recipients - Recipients list
   */
  _emitVGCSError(data, groupId, phoneId, recipients) {
    const eventData = {
      groupId,
      phoneId,
      error: data.error,
      errorCode: data.errorCode,
      recoverable: data.recoverable || false,
      timestamp: Date.now()
    };

    // Emit error to affected users
    if (recipients && recipients.length > 0) {
      recipients.forEach(discordId => {
        this.io.to(discordId).emit('groupCallError', eventData);
      });
    }

    // Always notify admin interface of errors
    this.io.emit('adminGroupCallError', eventData);
  }

  /**
   * Emit general error event
   * @param {string} groupId - Group call ID
   * @param {string} phoneId - Phone ID
   * @param {string} error - Error message
   */
  _emitError(groupId, phoneId, error) {
    const errorData = {
      groupId,
      phoneId,
      error,
      timestamp: Date.now()
    };

    this.io.emit('vgcsError', errorData);
    console.error(chalk.red('VGCSSocketBridge Error'), errorData);
  }

  /**
   * Register with VGCS Bus to receive messages (Phase 6 integration)
   * @param {import('./VGCSBus.js').default} vgcsBus - VGCS Bus instance
   */
  registerWithVGCSBus(vgcsBus) {
    if (vgcsBus && typeof vgcsBus.subscribe === 'function') {
      vgcsBus.subscribe('SOCKET_BRIDGE', this.processStandardVGCSMessage.bind(this));
      console.log(chalk.green('VGCSSocketBridge'), 'Registered with VGCS Bus for Phase 6 integration');
    } else {
      console.warn(chalk.yellow('VGCSSocketBridge'), 'VGCS Bus not available for registration');
    }
  }
}
