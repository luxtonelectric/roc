// @ts-check
import chalk from 'chalk';

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
    console.log(chalk.yellow('placeCall'), 'Processing call placement request:', msg);
    
    // Extract sender phone ID from object or use directly
    const senderPhoneId = typeof msg.sender === 'object' ? msg.sender.id : msg.sender;
    
    // Extract receiver from message - unified architecture
    const receiver = msg.receiver || msg.target; // Support both new and legacy property names
    if (!receiver) {
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
    console.log(chalk.yellow('rejectCall'), 'Processing call rejection:', msg);
    
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
    console.log(chalk.yellow('acceptCall'), 'Processing call acceptance:', msg);
    
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
    console.log(chalk.yellow('leaveCall'), 'Processing leave call request:', msg);
    
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
    console.log(chalk.yellow('startGroupCall'), 'Processing group call start:', msg);
    
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
    console.log(chalk.yellow('joinGroupCall'), 'Processing group call join:', msg);
    
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
    console.log(chalk.yellow('leaveGroupCall'), 'Processing group call leave:', msg);
    
    try {
      // Look up callId from phoneId if not provided directly
      let callId = msg.callId || msg.groupId;
      if (!callId && msg.phoneId) {
        callId = unifiedCallManager.phoneToCallMap.get(msg.phoneId);
        console.log(chalk.blue('leaveGroupCall'), `Looked up callId ${callId} for phoneId ${msg.phoneId}`);
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
    console.log(chalk.yellow('terminateGroupCall'), 'Processing group call termination:', msg);
    
    try {
      // Look up callId from phoneId if not provided directly
      let callId = msg.callId || msg.groupId;
      if (!callId && msg.phoneId) {
        callId = unifiedCallManager.phoneToCallMap.get(msg.phoneId);
        console.log(chalk.blue('terminateGroupCall'), `Looked up callId ${callId} for phoneId ${msg.phoneId}`);
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
    console.log(chalk.yellow('acceptGroupCall'), 'Processing group call acceptance:', msg);
    
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

  socket.on("requestGroupCallUpdate", function(msg) {
    console.log(chalk.yellow('requestGroupCallUpdate'), 'Processing group call update request:', msg);
    
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