import { ref, computed, nextTick } from 'vue'
import { PreparedCall } from '~/models/PreparedCall'
import { CallDetails } from '~/models/CallDetails'

/**
 * Unified call management composable for both client and admin UIs
 * @param {Object} socket - Socket.io client instance
 * @param {Object} gameState - Reactive game state object
 * @param {Object} myPhones - Reactive phones object
 * @param {Function} showError - Error notification function
 * @param {Function} showSuccess - Success notification function
 * @param {Object} options - Configuration options
 * @param {boolean} options.enableAudio - Enable audio feedback (default: false)
 * @param {boolean} options.autoAcceptREC - Auto-accept REC calls (default: false)
 * @param {boolean} options.enableQueueManagement - Enable automatic queue management (default: false)
 */
export function useCallManager(socketRef, gameState, myPhones, showError, showSuccess, options = {}) {
  const {
    enableAudio = false,
    autoAcceptREC = false,
    enableQueueManagement = false
  } = options

  // Core call state
  const currentCall = ref(null)
  const nextCall = ref(null)
  const preparedCall = ref(null)
  const callQueue = ref([])
  const inCall = ref(false)
  const incomingCall = ref(false)

  // Audio elements (only created if audio is enabled)
  let callAudio = null
  let rejectedAudio = null
  let recAudio = null

  if (enableAudio && typeof Audio !== 'undefined') {
    callAudio = new Audio('/audio/telephone-ring.mp3')
    rejectedAudio = new Audio('/audio/rejected.mp3')
    recAudio = new Audio('/audio/rec.mp3')
    if (callAudio) callAudio.loop = true
  }

  // Computed properties
  const queuedCallsCount = computed(() => {
    if (enableQueueManagement) {
      return callQueue.value.filter(call => 
        call.status === CallDetails.STATUS.OFFERED || call.status === CallDetails.STATUS.ACCEPTED
      ).length
    } else {
      return Object.values(myPhones.value).reduce((total, phone) => {
        if (!phone.queue) return total
        return total + phone.queue.filter(call => 
          call.status === PreparedCall.STATUS.OFFERED || call.status === PreparedCall.STATUS.ACCEPTED
        ).length
      }, 0)
    }
  })

  const currentCallStatus = computed(() => {
    if (!currentCall.value) return 'No active call'
    if (inCall.value) {
      const senderName = currentCall.value.sender?.name || 'Unknown'
      const receiverName = currentCall.value.receivers?.[0]?.name || 'Unknown'
      return `In call: ${senderName} ↔ ${receiverName}`
    }
    if (incomingCall.value) {
      const senderName = currentCall.value.sender?.name || 'Unknown'
      const receiverName = currentCall.value.receivers?.[0]?.name || 'Unknown'
      return `Incoming call: ${senderName} → ${receiverName}`
    }
    return `Call status: ${currentCall.value.status}`
  })

  const sortedIncomingCalls = computed(() => {
    const incomingCalls = callQueue.value.filter(call => 
      call.status === CallDetails.STATUS.OFFERED ||
      call.status === PreparedCall.STATUS.OFFERED
    )
    
    // Sort by priority: emergency (1), urgent (2), normal (3)
    return incomingCalls.sort((a, b) => {
      const priorityOrder = {
        'emergency': 1,
        'urgent': 2,
        'normal': 3
      }
      return priorityOrder[a.level] - priorityOrder[b.level]
    })
  })

  // Core call operations
  const placeCall = async (callData) => {
    console.log('Placing call:', callData)
    
    if (!socketRef.value) {
      showError('Call Failed', 'Socket connection not available')
      return false
    }
    
    // Validate call data
    if (!callData.sender || !callData.receivers || callData.receivers.length === 0) {
      showError('Call Failed', 'Invalid call data: missing sender or receivers')
      return false
    }

    // Validate call type
    if (!Object.values(PreparedCall.TYPES).includes(callData.type)) {
      showError('Call Failed', `Invalid call type: ${callData.type}`)
      return false
    }

    // Validate call level
    if (!Object.values(PreparedCall.LEVELS).includes(callData.level)) {
      showError('Call Failed', `Invalid call level: ${callData.level}`)
      return false
    }

    preparedCall.value = callData

    return new Promise((resolve) => {
      socketRef.value.emit('placeCall', callData, (response) => {
        console.log('Place call response:', response)
        if (response && response !== false) {
          const callTypeText = callData.type === PreparedCall.TYPES.REC ? 'Railway Emergency Call' : 
                               callData.type === PreparedCall.TYPES.GROUP ? 'Group Call' : 'P2P Call'
          showSuccess('Call Placed', `${callTypeText} placed from ${callData.sender.name} to ${callData.receivers[0].name}`)
          preparedCall.value = null
          resolve(response)
        } else {
          playRejectedAudio()
          preparedCall.value = null
          showError('Call Failed', 'Failed to place call')
          resolve(false)
        }
      })
    })
  }

  const acceptCall = (callId) => {
    console.log('Accepting call:', callId)
    
    if (!socketRef.value) {
      showError('Call Failed', 'Socket connection not available')
      return
    }
    
    // Find the call in the queue
    let foundCall = null
    if (enableQueueManagement) {
      foundCall = callQueue.value.find(c => c.id === callId)
    } else {
      for (const phone of Object.values(myPhones.value)) {
        if (phone.queue) {
          foundCall = phone.queue.find(c => c.id === callId)
          if (foundCall) break
        }
      }
    }
    
    if (!foundCall) {
      console.error('Call not found in queue:', callId)
      showError('Call Error', 'Call not found in queue')
      return
    }

    return new Promise((resolve) => {
      socketRef.value.emit('acceptCall', { id: callId }, (response) => {
        console.log('Accept call response:', response)
        if (response && response !== false) {
          currentCall.value = foundCall
          inCall.value = true
          incomingCall.value = false
          
          if (enableQueueManagement) {
            removeCallFromQueue(foundCall)
          }
          
          stopCallAudio()
          showSuccess('Call Accepted', `Call from ${foundCall.sender?.name || 'Unknown'} accepted`)
          resolve(true)
        } else {
          playRejectedAudio()
          if (enableQueueManagement) {
            removeCallFromQueue(foundCall)
          }
          showError('Call Error', 'Failed to accept call')
          resolve(false)
        }
      })
    })
  }

  const rejectCall = (callId) => {
    console.log('Rejecting call:', callId)
    
    if (!socketRef.value) {
      showError('Call Failed', 'Socket connection not available')
      return Promise.resolve(false)
    }
    
    return new Promise((resolve) => {
      socketRef.value.emit('rejectCall', { id: callId }, (response) => {
        console.log('Reject call response:', response)
        if (response?.success || response === true) {
          // Clear call state if we were rejecting our current call
          if (currentCall.value && currentCall.value.id === callId) {
            currentCall.value = null
          }
          
          if (nextCall.value && nextCall.value.id === callId) {
            nextCall.value = null
            stopCallAudio()
          }
          
          if (enableQueueManagement) {
            const call = callQueue.value.find(c => c.id === callId)
            if (call) removeCallFromQueue(call)
          }
          
          incomingCall.value = false
          inCall.value = false
          showSuccess('Call Rejected', 'Call has been rejected')
          resolve(true)
        } else {
          showError('Call Error', 'Failed to reject call')
          resolve(false)
        }
      })
    })
  }

  const leaveCall = (callId) => {
    console.log('Leaving call:', callId)
    
    if (!socketRef.value) {
      showError('Call Failed', 'Socket connection not available')
      return
    }
    
    socketRef.value.emit('leaveCall', { id: callId })
    
    // Clear call state
    if (currentCall.value && currentCall.value.id === callId) {
      currentCall.value = null
    }
    inCall.value = false
    incomingCall.value = false
    
    showSuccess('Call Ended', 'You have left the call')
  }

  const endCall = (callId) => {
    console.log('Ending call:', callId)
    
    if (!socketRef.value) {
      showError('Call Failed', 'Socket connection not available')
      return Promise.resolve(false)
    }
    
    return new Promise((resolve) => {
      socketRef.value.emit('endCall', { id: callId }, (response) => {
        if (response?.success || response === true) {
          if (currentCall.value && currentCall.value.id === callId) {
            currentCall.value = null
          }
          inCall.value = false
          incomingCall.value = false
          showSuccess('Call Ended', 'Call has been ended')
          resolve(true)
        } else {
          showError('Call Error', 'Failed to end call')
          resolve(false)
        }
      })
    })
  }

  const selectCall = (call) => {
    console.log('Selecting call:', call.id)
    nextCall.value = call
    if (enableAudio && callAudio && callAudio.paused) {
      playCallAudio()
    }
  }

  // Audio management functions
  const playCallAudio = () => {
    if (enableAudio && callAudio) {
      callAudio.currentTime = 0
      callAudio.play().then(() => {
        console.log('Call audio played')
      }).catch((error) => {
        console.log('Call audio error:', error)
      })
    }
  }

  const playRejectedAudio = () => {
    if (enableAudio && rejectedAudio) {
      rejectedAudio.currentTime = 0
      rejectedAudio.play().then(() => {
        console.log('Rejected audio played')
      }).catch((error) => {
        console.log('Rejected audio error:', error)
      })
    }
  }

  const stopCallAudio = () => {
    if (enableAudio && callAudio) {
      callAudio.pause()
    }
  }

  // Queue management functions (for client UI)
  const addCallToQueue = (call) => {
    if (!enableQueueManagement) return
    
    const existingIndex = callQueue.value.findIndex(c => c.id === call.id)
    if (existingIndex !== -1) {
      // Update existing call
      callQueue.value.splice(existingIndex, 1, call)
    } else {
      // Add new call
      callQueue.value.push(call)
    }
  }

  const removeCallFromQueue = (call) => {
    if (!enableQueueManagement || !call) return
    
    const callIndex = callQueue.value.findIndex(c => c.id === call.id)
    if (callIndex !== -1) {
      callQueue.value.splice(callIndex, 1)
    }
    
    // Update next call if needed
    if (callQueue.value.length === 0) {
      nextCall.value = null
      stopCallAudio()
    } else if (callQueue.value.some(c => c.status === CallDetails.STATUS.OFFERED)) {
      nextCall.value = callQueue.value.find(c => c.status === CallDetails.STATUS.OFFERED) || null
      if (nextCall.value && enableAudio) {
        playCallAudio()
      }
    }
  }

  const processCallQueueUpdate = (phoneId, queue) => {
    if (!enableQueueManagement) return
    
    console.log('Processing call queue update:', phoneId, queue)
    
    queue.forEach((call) => {
      const oldCall = callQueue.value.find(c => c.id === call.id)
      
      if (oldCall) {
        if (oldCall.status === call.status) return
        
        console.log('Known call status change:', call.id, oldCall.status, '->', call.status)
        
        if (call.status === CallDetails.STATUS.ENDED) {
          removeCallFromQueue(call)
          if (currentCall.value && currentCall.value.id === call.id) {
            currentCall.value = null
            preparedCall.value = null
          }
        } else if (call.status === CallDetails.STATUS.REJECTED) {
          console.log('Call rejected:', call.id)
          removeCallFromQueue(call)
          
          if (currentCall.value && call.id === currentCall.value.id) {
            preparedCall.value = null
            currentCall.value = null
          }
          
          if (nextCall.value && call.id === nextCall.value.id) {
            nextCall.value = null
            stopCallAudio()
          }
        } else if (call.status === CallDetails.STATUS.ACCEPTED) {
          currentCall.value = call
          removeCallFromQueue(call)
          addCallToQueue(call) // Re-add with updated status
        }
      } else {
        console.log('New call:', call.id)
        
        if (call.status === CallDetails.STATUS.OFFERED) {
          addCallToQueue(call)
          
          // Check if this is an outgoing call from our phone
          const isOutgoingCall = myPhones.value && Object.values(myPhones.value).some(phone => phone.id === call.sender.id)
          
          if (isOutgoingCall) {
            if (call.type === "REC" && autoAcceptREC) {
              nextCall.value = call
              acceptCall(call.id)
            } else {
              currentCall.value = call
            }
          } else {
            // Incoming call
            if (!nextCall.value) {
              console.log('Setting as next incoming call:', call.id)
              nextCall.value = call
              playCallAudio()
            }
          }
        }
      }
    })
  }

  // Socket event handlers
  const setupCallEventListeners = () => {
    if (!socketRef.value) {
      console.warn('Socket is not available for setting up call event listeners')
      return
    }
    
    socketRef.value.on('callOffered', (call) => {
      console.log('Call offered:', call)
      currentCall.value = call
      incomingCall.value = true
      inCall.value = false
    })

    socketRef.value.on('callAccepted', (call) => {
      console.log('Call accepted:', call)
      if (currentCall.value && currentCall.value.id === call.id) {
        inCall.value = true
        incomingCall.value = false
      }
    })

    socketRef.value.on('callEnded', (call) => {
      console.log('Call ended:', call)
      if (currentCall.value && currentCall.value.id === call.id) {
        currentCall.value = null
        inCall.value = false
        incomingCall.value = false
      }
    })

    socketRef.value.on('callRejected', (call) => {
      console.log('Call rejected:', call)
      if (currentCall.value && currentCall.value.id === call.id) {
        currentCall.value = null
        inCall.value = false
        incomingCall.value = false
      }
    })

    socketRef.value.on('kickedFromCall', (msg) => {
      console.log('Kicked from call:', msg)
      if (currentCall.value) {
        currentCall.value = null
        preparedCall.value = null
        inCall.value = false
        incomingCall.value = false
        stopCallAudio()
      }
    })

    // Queue management events (for client UI)
    if (enableQueueManagement) {
      socketRef.value.on('callQueueUpdate', (msg) => {
        processCallQueueUpdate(msg.phoneId, msg.queue)
      })
    }
  }

  const removeCallEventListeners = () => {
    if (!socketRef.value) {
      console.warn('Socket is not available for removing call event listeners')
      return
    }
    
    socketRef.value.off('callOffered')
    socketRef.value.off('callAccepted')
    socketRef.value.off('callEnded')
    socketRef.value.off('callRejected')
    socketRef.value.off('kickedFromCall')
    
    if (enableQueueManagement) {
      socketRef.value.off('callQueueUpdate')
    }
  }

  // Utility functions
  const getCallPriorityClass = (call) => {
    switch (call.level) {
      case 'emergency':
        return 'bg-red-600 text-white'
      case 'urgent':
        return 'bg-yellow-400 text-black'
      case 'normal':
      default:
        return 'bg-zinc-200 text-black'
    }
  }

  const getCallTypeClass = (call) => {
    switch (call.type) {
      case PreparedCall.TYPES.REC:
        return 'bg-red-100 text-red-800'
      case PreparedCall.TYPES.GROUP:
        return 'bg-purple-100 text-purple-800'
      case PreparedCall.TYPES.P2P:
      default:
        return 'bg-blue-100 text-blue-800'
    }
  }

  const getCallStatusClass = (call) => {
    switch (call.status) {
      case PreparedCall.STATUS.OFFERED:
      case CallDetails.STATUS.OFFERED:
        return 'bg-yellow-100 text-yellow-800'
      case PreparedCall.STATUS.ACCEPTED:
      case CallDetails.STATUS.ACCEPTED:
        return 'bg-green-100 text-green-800'
      case PreparedCall.STATUS.REJECTED:
      case CallDetails.STATUS.REJECTED:
        return 'bg-red-100 text-red-800'
      case PreparedCall.STATUS.ENDED:
      case CallDetails.STATUS.ENDED:
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return {
    // State
    currentCall,
    nextCall,
    preparedCall,
    callQueue,
    inCall,
    incomingCall,
    
    // Computed
    queuedCallsCount,
    currentCallStatus,
    sortedIncomingCalls,
    
    // Core operations
    placeCall,
    acceptCall,
    rejectCall,
    leaveCall,
    endCall,
    selectCall,
    
    // Queue management
    addCallToQueue,
    removeCallFromQueue,
    processCallQueueUpdate,
    
    // Audio
    playCallAudio,
    playRejectedAudio,
    stopCallAudio,
    
    // Event handling
    setupCallEventListeners,
    removeCallEventListeners,
    
    // Utilities
    getCallPriorityClass,
    getCallTypeClass,
    getCallStatusClass
  }
}
