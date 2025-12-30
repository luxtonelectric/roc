// @ts-check
import chalk from 'chalk';
import BaseCall from './model/BaseCall.js';

/** @typedef {import("./UnifiedCallManager.js").default} UnifiedCallManager */
/** @typedef {import("./ROCManager.js").default} ROCManager */
/** @typedef {import("socket.io").Socket} Socket */

/**
 * Call-specific socket handlers for the ROC system
 * Uses the UnifiedCallManager for all call operations
 * 
 * @param {Socket} socket 
 * @param {UnifiedCallManager} unifiedCallManager 
 * @param {ROCManager} rocManager - For player/phone lookup
 */
export function callSockets(socket, unifiedCallManager, rocManager) {
  socket.on("requestPhoneQueueUpdate", function(msg) {
    try {
      unifiedCallManager.requestPhoneQueueUpdate(msg.id);
    } catch (error) {
      console.error('Error processing phone queue update:', error);
    }
  });

  socket.on("placeCall", async function(msg, callback) {
    // Extract sender phone ID from object or use directly
    const senderPhoneId = typeof msg.sender === 'object' ? msg.sender.id : msg.sender;
    
    // Extract receiver from message - unified architecture
    const receiver = msg.receiver || msg.target; // Support both new and legacy property names
    // Allow missing receiver for REC calls (client may not include a receiver field)
    if (!receiver && String(msg.type || '') !== BaseCall.TYPES.REC) {
      console.error('No receiver specified in call placement request');
      if (callback && typeof callback === 'function') {
        callback(false);
      }
      return;
    }
    
    try {
      // Use new UnifiedCallManager object-based API
      const response = await unifiedCallManager.placeCall({
        senderPhoneId: senderPhoneId,
        callType: msg.type || 'p2p',
        callLevel: msg.level || 'normal',
        receiver: receiver,
        options: { socketId: socket.id }
      });
      
      if (callback && typeof callback === 'function') {
        callback(response);
      }
    } catch (error) {
      console.error('Error placing call:', error);
      if (callback && typeof callback === 'function') {
        callback(false);
      }
    }
  });

  socket.on("rejectCall", async function(msg, callback) {
    try {
      // Use new standardized signature with callback: rejectCall(socketId, callId, callback)
      const result = await unifiedCallManager.rejectCall(socket.id, msg.id, callback);
    } catch (error) {
      console.error('Error rejecting call:', error);
      if (callback && typeof callback === 'function') {
        callback({ success: false });
      }
    }
  });
  
  socket.on("acceptCall", async function(msg, callback) {
    try {
      // Use new standardized signature with callback: acceptCall(socketId, callId, callback)
      const response = await unifiedCallManager.acceptCall(socket.id, msg.id, callback);
    } catch (error) {
      console.error('Error accepting call:', error);
      if (callback && typeof callback === 'function') {
        callback(false);
      }
    }
  });

  socket.on("leaveCall", async function(msg, callback) {
    try {
      const result = await unifiedCallManager.leaveCall(socket.id, msg.id);
      
      if (callback && typeof callback === 'function') {
        callback({ success: result });
      }
    } catch (error) {
      console.error('Error leaving call:', error);
      if (callback && typeof callback === 'function') {
        callback({ success: false });
      }
    }
  });

  // Group call handlers - all delegated to UnifiedCallManager
  socket.on("startGroupCall", async function(msg, callback) {
    try {
      // Use new UnifiedCallManager object-based API
      const response = await unifiedCallManager.placeCall({
        senderPhoneId: msg.senderPhoneId,
        callType: msg.type || 'group',
        callLevel: msg.level || 'normal',
        receiver: msg.receiver || msg.target || 'DEFAULT_GROUP',
        options: { socketId: socket.id }
      });
      
      if (callback && typeof callback === 'function') {
        callback(response);
      }
    } catch (error) {
      console.error('Error starting group call:', error);
      if (callback && typeof callback === 'function') {
        callback(false);
      }
    }
  });

  socket.on("joinGroupCall", async function(msg, callback) {
    try {
      // Use new standardized signature: acceptCall(socketId, callId)
      const response = await unifiedCallManager.acceptCall(socket.id, msg.groupId);
      
      if (callback && typeof callback === 'function') {
        callback(response);
      }
    } catch (error) {
      console.error('Error joining group call:', error);
      if (callback && typeof callback === 'function') {
        callback(false);
      }
    }
  });

  socket.on("leaveGroupCall", async function(msg, callback) {
    try {
      // Look up callId from phoneId if not provided directly
      let callId = msg.callId || msg.groupId;
      if (!callId && msg.phoneId) {
        callId = unifiedCallManager.phoneToCallMap.get(msg.phoneId);
      }
      
      if (!callId) {
        throw new Error(`Cannot determine callId for phone ${msg.phoneId || 'unknown'}`);
      }
      
      // Use leaveCall method with standardized (socketId, callId) signature
      const response = await unifiedCallManager.leaveCall(socket.id, callId);
      
      if (callback && typeof callback === 'function') {
        callback({ success: response });
      }
    } catch (error) {
      console.error('Error leaving group call:', error);
      if (callback && typeof callback === 'function') {
        callback({ success: false });
      }
    }
  });

  socket.on("terminateGroupCall", async function(msg, callback) {
    try {
      // Look up callId from phoneId if not provided directly
      let callId = msg.callId || msg.groupId;
      if (!callId && msg.phoneId) {
        callId = unifiedCallManager.phoneToCallMap.get(msg.phoneId);
      }
      
      if (!callId) {
        throw new Error(`Cannot determine callId for phone ${msg.phoneId || 'unknown'}`);
      }
      
      // Use new standardized signature: terminateCall(socketId, callId, reason)
      const response = await unifiedCallManager.terminateCall(socket.id, callId);
      
      if (callback && typeof callback === 'function') {
        callback(response);
      }
    } catch (error) {
      console.error('Error terminating group call:', error);
      if (callback && typeof callback === 'function') {
        callback(false);
      }
    }
  });

  socket.on("acceptGroupCall", async function(msg, callback) {
    try {
      let callId = msg.callId;
      
      // Handle callRequest format
      if (msg.callRequest && !callId) {
        callId = msg.callRequest.id || msg.callRequest.callId;
      }
      
      // Use new standardized signature: acceptCall(socketId, callId)
      const response = await unifiedCallManager.acceptCall(socket.id, callId);
      
      if (callback && typeof callback === 'function') {
        callback(response);
      }
    } catch (error) {
      console.error('Error accepting group call:', error);
      if (callback && typeof callback === 'function') {
        callback(false);
      }
    }
  });

  // Admin: force terminate a group call (must be admin)
  socket.on('forceTerminateGroupCall', async function(msg, callback) {
    try {
      const user = rocManager?.findUserBySocketId(socket.id);
      if (!user || !rocManager.isAdmin(user.discordId)) {
        if (callback && typeof callback === 'function') {
          callback({ success: false, error: 'Unauthorized' });
        }
        return;
      }

      const groupId = msg.groupId || msg.id || msg.group;
      if (!groupId) {
        if (callback && typeof callback === 'function') {
          callback({ success: false, error: 'Missing groupId' });
        }
        return;
      }

      // Force terminate via VGCSBus if available
      try {
        if (unifiedCallManager.vgcsBus && typeof unifiedCallManager.vgcsBus.forceTerminate === 'function') {
          unifiedCallManager.vgcsBus.forceTerminate(groupId, msg.reason || 'admin-termination');
        }
      } catch (err) {
        console.error('Error forcing VGCS termination for group', groupId, err);
      }

      // Also terminate associated call objects if present
      const groupCalls = unifiedCallManager.getAllActiveGroupCalls();
      for (const call of groupCalls) {
        if (call.groupId === groupId) {
          try {
            await unifiedCallManager.terminateCall(null, call.id, 'ADMIN_FORCE_TERMINATE');
          } catch (err) {
            console.error('Failed to terminate call for groupId:', groupId, err);
          }
        }
      }

      if (callback && typeof callback === 'function') {
        callback({ success: true });
      }
    } catch (error) {
      console.error('Error handling forceTerminateGroupCall:', error);
      if (callback && typeof callback === 'function') {
        callback({ success: false, error: error.message || String(error) });
      }
    }
  });

  socket.on("requestGroupCallUpdate", function(msg) {
    try {
      // Send current group call state to requesting client
      // Note: UnifiedCallManager doesn't have getAllActiveGroupCalls - use alternative approach
      const allActiveCalls = Array.from(unifiedCallManager.activeCalls.values()).filter(call => 
        call.type === 'GROUP' || call.type === 'REC'
      );
      socket.emit('groupCallUpdate', allActiveCalls);
    } catch (error) {
      console.error('Error getting group call update:', error);
    }
  });
}