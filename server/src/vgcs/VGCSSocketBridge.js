// @ts-check
import chalk from 'chalk';
import { MSG } from './NetworkGCC.js';
import PhoneManager from '../phonemanager.js';

/**
 * VGCSSocketBridge - Bridges VGCS messages with socket.io events
 * Translates between VGCS message format and ROC socket events
 */
export default class VGCSSocketBridge {
  /**
   * @param {import('socket.io').Server} io 
   * @param {PhoneManager} phoneManager 
   * @param {import('../bot.js').default} bot 
   */
  constructor(callManager, io, phoneManager, bot) {
    this.callManager = callManager;
    this.io = io;
    this.phoneManager = phoneManager;
    this.bot = bot;
    
    console.log(chalk.green('VGCSSocketBridge'), 'VGCS Socket Bridge initialized');
  }

  /**
   * Convert socket.io event to VGCS message
   * @param {string} eventName 
   * @param {Object} eventData 
   * @returns {Object|null} VGCS message or null if not convertible
   */
  socketEventToVGCS(eventName, eventData) {
    //console.log(chalk.blue('VGCSSocketBridge.socketEventToVGCS'), `Event: ${eventName}`);
    
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

  /**
   * Send group call status update to all participants
   * @param {string} groupId 
   * @param {Object} statusUpdate 
   */
  broadcastGroupCallStatus(groupId, statusUpdate) {
    //console.log(chalk.blue('VGCSSocketBridge.broadcastGroupCallStatus'), `GroupId: ${groupId}`);
    
    const groupCall = this.callManager.activeGroupCalls.get(groupId);
    if (!groupCall) {
      console.error(chalk.red('VGCSSocketBridge'), 'Group call not found for status update');
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
    //console.log(chalk.blue('VGCSSocketBridge.broadcastParticipantUpdate'), 
      // `GroupId: ${groupId}, Action: ${participantAction}`);
    
    const groupCall = this.callManager.activeGroupCalls.get(groupId);
    if (!groupCall) {
      console.error(chalk.red('VGCSSocketBridge'), 'Group call not found for participant update');
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
      `Type: ${type}, Group: ${groupId}, Phone: ${phoneId || 'N/A'}, Recipients: ${recipients?.length || 0}`);
    
    // Convert phone IDs to Discord IDs for recipients
    const discordIds = this._resolveDiscordIds(recipients);
    
    try {
      switch (type) {
        case 'GROUP_CALL_INITIATED':
          this._emitGroupCallInitiated(data, groupId, discordIds);
          break;
          
        case 'GROUP_CALL_ACTIVE':
          this._emitGroupCallActive(data, groupId, discordIds);
          break;
          
        case 'GROUP_CALL_TERMINATED':
          this._emitGroupCallTerminated(data, groupId, discordIds);
          break;
          
        // REC_NOTIFICATION removed - REC calls now use unified callUpdate events
          
        case 'FORCE_DISCONNECT':
          this._emitForceDisconnect(data, discordIds);
          break;
          
        case 'PARTICIPANT_JOINED':
          this._emitParticipantJoined(data, groupId, discordIds);
          break;
          
        case 'PARTICIPANT_LEFT':
          this._emitParticipantLeft(data, groupId, discordIds);
          break;
          
        case 'VGCS_ERROR':
          this._emitVGCSError(data, groupId, phoneId, discordIds);
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
      senderPhoneId: data.senderPhoneId,
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

  // _emitRECNotification method removed - REC calls now use unified callUpdate events
  // All modal/countdown behavior is handled client-side based on call.type === 'REC'

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
      console.log(chalk.green('VGCSSocketBridge'), 'Successfully registered with VGCS Bus for Phase 6 standardized messages');
    } else {
      console.error(chalk.red('VGCSSocketBridge'), 'VGCS Bus subscribe method not available - Phase 6 integration failed');
      throw new Error('VGCSBus subscription system not properly implemented');
    }
  }

  /**
   * Resolve phone IDs to Discord IDs for message recipients
   * @param {string[]} phoneIds - Array of phone IDs
   * @returns {string[]} Array of Discord IDs
   * @private
   */
  _resolveDiscordIds(phoneIds) {
    if (!phoneIds || !Array.isArray(phoneIds)) {
      return [];
    }

    const discordIds = [];
    for (const phoneId of phoneIds) {
      const phone = this.phoneManager.getPhone(phoneId);
      if (phone && phone.getDiscordId()) {
        discordIds.push(phone.getDiscordId());
      }
    }
    return discordIds;
  }
}
