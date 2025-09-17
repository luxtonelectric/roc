import { ref, computed, nextTick } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import type { Socket } from 'socket.io-client'
import { PreparedCall } from '~/models/PreparedCall'
import { CallDetails } from '~/models/CallDetails'
import type Phone from '~/models/Phone'

// Type definitions
interface CallManagerOptions {
  enableAudio?: boolean
  autoAcceptREC?: boolean
  enableQueueManagement?: boolean
}

interface GameState {
  [key: string]: any
}

interface PhoneData {
  [key: string]: any
  queue?: CallDetails[]
}

interface MyPhones {
  [key: string]: PhoneData
}

interface CallManagerReturn {
  // State
  currentCall: Ref<CallDetails | undefined>
  nextCall: Ref<CallDetails | undefined>
  preparedCall: Ref<PreparedCall | undefined>
  callQueue: Ref<CallDetails[]>
  inCall: Ref<boolean>
  incomingCall: Ref<boolean>
  
  // Computed
  queuedCallsCount: ComputedRef<number>
  currentCallStatus: ComputedRef<string>
  sortedIncomingCalls: ComputedRef<CallDetails[]>
  
  // Methods
  placeCall: (callData: PreparedCall) => Promise<any>
  acceptCall: (callId: string) => Promise<boolean>
  rejectCall: (callId: string) => Promise<boolean>
  leaveCall: (callId: string) => void
  endCall: (callId: string) => Promise<boolean>
  selectCall: (call: CallDetails) => void
  addCallToQueue: (call: CallDetails) => void
  removeCallFromQueue: (call: CallDetails) => void
  processCallQueueUpdate: (phoneId: string, queue: CallDetails[]) => void
  playCallAudio: () => void
  playRejectedAudio: () => void
  stopCallAudio: () => void
  setupCallEventListeners: () => void
  removeCallEventListeners: () => void
  getCallPriorityClass: (call: CallDetails) => string
  getCallTypeClass: (call: CallDetails) => string
  getCallStatusClass: (call: CallDetails) => string
  
  // TASK-033: Group call methods for Phase 6
  startGroupCall: (callData: PreparedCall) => Promise<any>
  joinGroupCall: (groupId: string, phoneId: string) => Promise<boolean>
  leaveGroupCall: (phoneId: string) => Promise<boolean>
  terminateGroupCall: (phoneId: string) => Promise<boolean>
  acceptGroupCall: (callRequest: any) => Promise<boolean>
  requestGroupCallUpdate: () => void
  
  // TASK-022: REC call management
  recModalVisible: Ref<boolean>
  recCallInfo: Ref<any>
  recCountdownActive: Ref<boolean>
  handleRECCallOffer: (callInfo: any) => void
  acceptRECCall: () => Promise<boolean>
  declineRECCall: () => void
  forceDisconnectFromCurrentCall: () => Promise<void>
}

/**
 * Unified call management composable for both client and admin UIs
 */
export function useCallManager(
  socketRef: Ref<Socket | undefined>,
  gameState: Ref<GameState>,
  myPhones: Ref<MyPhones>,
  showError: (title?: string, message?: string) => void,
  showSuccess: (title?: string, message?: string) => void,
  options: CallManagerOptions = {}
): CallManagerReturn {
  const {
    enableAudio = false,
    autoAcceptREC = false,
    enableQueueManagement = false
  } = options

  // Core call state
  const currentCall: Ref<CallDetails | undefined> = ref(undefined)
  const nextCall: Ref<CallDetails | undefined> = ref(undefined)
  const preparedCall: Ref<PreparedCall | undefined> = ref(undefined)
  const callQueue: Ref<CallDetails[]> = ref([])
  const inCall = ref(false)
  const incomingCall = ref(false)

  // REC call state (TASK-022)
  const recModalVisible = ref(false)
  const recCallInfo: Ref<any> = ref(undefined)
  const recCountdownActive = ref(false)

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
      const priorityOrder: Record<string, number> = {
        'emergency': 1,
        'urgent': 2,
        'normal': 3
      }
      return (priorityOrder[a.level] || 3) - (priorityOrder[b.level] || 3)
    })
  })

  // Core call operations
  const placeCall = async (callData: PreparedCall): Promise<any> => {
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
          showSuccess('Call Placed', `${callTypeText} placed from ${callData.sender.name} to ${callData.receivers[0]?.name || 'Unknown'}`)
          preparedCall.value = undefined
          resolve(response)
        } else {
          playRejectedAudio()
          preparedCall.value = undefined
          showError('Call Failed', 'Failed to place call')
          resolve(false)
        }
      })
    })
  }

  const acceptCall = (callId: string): Promise<boolean> => {
    console.log('Accepting call:', callId)
    
    if (!socketRef.value) {
      showError('Call Failed', 'Socket connection not available')
      return Promise.resolve(false)
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
      return Promise.resolve(false)
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

  const rejectCall = (callId: string): Promise<boolean> => {
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
            currentCall.value = undefined
          }
          
          if (nextCall.value && nextCall.value.id === callId) {
            nextCall.value = undefined
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

  const leaveCall = (callId: string): void => {
    console.log('Leaving call:', callId)
    
    if (!socketRef.value) {
      showError('Call Failed', 'Socket connection not available')
      return
    }
    
    socketRef.value.emit('leaveCall', { id: callId })
    
    // Clear call state
    if (currentCall.value && currentCall.value.id === callId) {
      currentCall.value = undefined
    }
    inCall.value = false
    incomingCall.value = false
    
    showSuccess('Call Ended', 'You have left the call')
  }

  const endCall = async (callId: string): Promise<boolean> => {
    if (!socketRef.value) {
      console.error('Socket is not available for ending call')
      return false
    }

    return new Promise((resolve) => {
      socketRef.value.emit('endCall', { id: callId }, (response) => {
        console.log('End call response:', response)
        
        if (response && response.success) {
          // Clean up local state
          if (currentCall.value && currentCall.value.id === callId) {
            currentCall.value = undefined
            preparedCall.value = undefined
            inCall.value = false
            incomingCall.value = false
          }
          
          // Remove from queue
          callQueue.value = callQueue.value.filter(call => call.id !== callId)
          
          stopCallAudio()
          showSuccess('Call Ended', 'Call has been ended successfully')
          resolve(true)
        } else {
          console.error('Failed to end call:', response)
          showError('End Call Failed', 'Unable to end the call')
          resolve(false)
        }
      })
    })
  }

  // TASK-033: Group call management methods for Phase 6
  
  /**
   * Start a group call (primarily for REC calls)
   * @param callData - Group call data
   */
  const startGroupCall = async (callData: PreparedCall): Promise<any> => {
    if (!socketRef.value) {
      console.error('Socket is not available for starting group call')
      return false
    }

    return new Promise((resolve) => {
      socketRef.value.emit('startGroupCall', {
        type: callData.type,
        level: callData.level,
        senderPhoneId: callData.sender.id
      }, (response) => {
        console.log('Start group call response:', response)
        resolve(response)
      })
    })
  }

  /**
   * Join a group call
   * @param groupId - Group call ID
   * @param phoneId - Phone ID to join with
   */
  const joinGroupCall = async (groupId: string, phoneId: string): Promise<boolean> => {
    if (!socketRef.value) {
      console.error('Socket is not available for joining group call')
      return false
    }

    return new Promise((resolve) => {
      socketRef.value.emit('joinGroupCall', {
        groupId,
        phoneId
      }, (response) => {
        console.log('Join group call response:', response)
        resolve(response || false)
      })
    })
  }

  /**
   * Leave a group call
   * @param phoneId - Phone ID to leave with
   */
  const leaveGroupCall = async (phoneId: string): Promise<boolean> => {
    if (!socketRef.value) {
      console.error('Socket is not available for leaving group call')
      return false
    }

    return new Promise((resolve) => {
      socketRef.value.emit('leaveGroupCall', {
        phoneId
      }, (response) => {
        console.log('Leave group call response:', response)
        
        if (response) {
          // Clean up local state
          if (currentCall.value) {
            currentCall.value = undefined
            preparedCall.value = undefined
            inCall.value = false
            incomingCall.value = false
          }
          stopCallAudio()
        }
        
        resolve(response || false)
      })
    })
  }

  /**
   * Terminate a group call (end for all participants)
   * @param phoneId - Phone ID of terminator
   */
  const terminateGroupCall = async (phoneId: string): Promise<boolean> => {
    if (!socketRef.value) {
      console.error('Socket is not available for terminating group call')
      return false
    }

    return new Promise((resolve) => {
      socketRef.value.emit('terminateGroupCall', {
        phoneId
      }, (response) => {
        console.log('Terminate group call response:', response)
        
        if (response) {
          // Clean up local state
          if (currentCall.value) {
            currentCall.value = undefined
            preparedCall.value = undefined
            inCall.value = false
            incomingCall.value = false
          }
          stopCallAudio()
          showSuccess('Group Call Ended', 'Group call has been terminated')
        }
        
        resolve(response || false)
      })
    })
  }

  /**
   * Accept a group call (primarily for REC calls)
   * @param callRequest - Call request object
   */
  const acceptGroupCall = async (callRequest: any): Promise<boolean> => {
    if (!socketRef.value) {
      console.error('Socket is not available for accepting group call')
      return false
    }

    return new Promise((resolve) => {
      socketRef.value.emit('acceptGroupCall', {
        type: callRequest.type || 'REC',
        callRequest
      }, (response) => {
        console.log('Accept group call response:', response)
        
        if (response) {
          inCall.value = true
          incomingCall.value = false
          stopCallAudio()
          showSuccess('Joined Group Call', 'Successfully joined the group call')
        }
        
        resolve(response || false)
      })
    })
  }

  /**
   * Request group call update from server
   */
  const requestGroupCallUpdate = () => {
    if (!socketRef.value) {
      console.error('Socket is not available for requesting group call update')
      return
    }

    socketRef.value.emit('requestGroupCallUpdate', {})
  }

  const selectCall = (call: CallDetails): void => {
    console.log('Selecting call:', call.id)
    nextCall.value = call
    if (enableAudio && callAudio && callAudio.paused) {
      playCallAudio()
    }
  }

  // Audio management functions
  const playCallAudio = () => {
    console.log('playCallAudio called, enableAudio:', enableAudio, 'callAudio exists:', !!callAudio)
    if (enableAudio && callAudio) {
      callAudio.currentTime = 0
      callAudio.play().then(() => {
        console.log('Call audio played successfully')
      }).catch((error) => {
        console.error('Call audio error:', error)
      })
    } else {
      console.warn('Call audio not played - enableAudio:', enableAudio, 'callAudio:', !!callAudio)
    }
  }

  const playRejectedAudio = () => {
    console.log('playRejectedAudio called, enableAudio:', enableAudio, 'rejectedAudio exists:', !!rejectedAudio)
    if (enableAudio && rejectedAudio) {
      rejectedAudio.currentTime = 0
      rejectedAudio.play().then(() => {
        console.log('Rejected audio played successfully')
      }).catch((error) => {
        console.error('Rejected audio error:', error)
      })
    } else {
      console.warn('Rejected audio not played - enableAudio:', enableAudio, 'rejectedAudio:', !!rejectedAudio)
    }
  }

  const stopCallAudio = () => {
    if (enableAudio && callAudio) {
      callAudio.pause()
    }
  }

  // Queue management functions (for client UI)
  const addCallToQueue = (call: CallDetails): void => {
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

  const removeCallFromQueue = (call: CallDetails): void => {
    if (!enableQueueManagement || !call) return
    
    const callIndex = callQueue.value.findIndex(c => c.id === call.id)
    if (callIndex !== -1) {
      callQueue.value.splice(callIndex, 1)
    }
    
    // Update next call if needed
    if (callQueue.value.length === 0) {
      nextCall.value = undefined
      stopCallAudio()
    } else if (callQueue.value.some(c => c.status === CallDetails.STATUS.OFFERED)) {
      nextCall.value = callQueue.value.find(c => c.status === CallDetails.STATUS.OFFERED) || undefined
      if (nextCall.value && enableAudio) {
        playCallAudio()
      }
    }
  }

  const processCallQueueUpdate = (phoneId: string, queue: CallDetails[]): void => {
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
            currentCall.value = undefined
            preparedCall.value = undefined
          }
        } else if (call.status === CallDetails.STATUS.REJECTED) {
          console.log('Call rejected:', call.id)
          removeCallFromQueue(call)
          
          if (currentCall.value && call.id === currentCall.value.id) {
            preparedCall.value = undefined
            currentCall.value = undefined
          }
          
          if (nextCall.value && call.id === nextCall.value.id) {
            nextCall.value = undefined
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
              playCallAudio() // Play ring tone for outgoing calls while waiting for answer
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
    
    // Handle new calls in queue (server emits 'newCallInQueue')
    socketRef.value.on('newCallInQueue', (call: CallDetails) => {
      console.log('New call in queue:', call)
      
      // Check if this is an incoming call for us (we're a receiver)
      const myPhoneIds = myPhones.value ? Object.keys(myPhones.value) : []
      const isIncomingCall = call.receivers?.some(receiver => 
        myPhoneIds.includes(receiver.id)
      )
      
      if (isIncomingCall && call.status === CallDetails.STATUS.OFFERED) {
        currentCall.value = call
        incomingCall.value = true
        inCall.value = false
        playCallAudio() // Play incoming call sound
      }
    })

    // Handle call acceptance confirmation (server emits 'joinedCall')
    socketRef.value.on('joinedCall', (msg: { success: boolean }) => {
      console.log('Joined call:', msg)
      if (msg.success && currentCall.value) {
        inCall.value = true
        incomingCall.value = false
        stopCallAudio() // Stop call sounds when call connects
      }
    })

    // Handle being kicked from calls (server emits 'kickedFromCall')
    socketRef.value.on('kickedFromCall', (msg: any) => {
      console.log('Kicked from call:', msg)
      if (currentCall.value) {
        currentCall.value = undefined
        preparedCall.value = undefined
        inCall.value = false
        incomingCall.value = false
        stopCallAudio()
      }
    })

    // Handle VGCS group call notifications (for REC calls)
    socketRef.value.on('groupCallNotification', (msg: any) => {
      console.log('Group call notification:', msg)
      // Handle VGCS-based REC call notifications
      if (msg.callType === 'REC' && autoAcceptREC) {
        // Auto-accept REC calls if configured
        console.log('Auto-accepting REC call:', msg.groupId)
        socketRef.value?.emit('acceptCall', { id: msg.groupId })
      }
    })

    // Handle REC call active status (server emits 'recCallActive')
    socketRef.value.on('recCallActive', (msg: any) => {
      console.log('REC call active:', msg)
      // Update UI to show active REC call state
      if (msg.success) {
        inCall.value = true
        incomingCall.value = false
        
        // Set currentCall for REC if we have REC call info
        if (recCallInfo.value) {
          currentCall.value = {
            id: recCallInfo.value.id || msg.groupId || '',
            type: 'REC',
            status: 'accepted',
            sender: recCallInfo.value.callerInfo || { name: 'Emergency Call', id: 'rec', type: 'emergency' },
            receivers: [],
            level: 'emergency',
            timePlaced: Date.now()
          }
        } else if (msg.groupId) {
          // Fallback if no recCallInfo available
          currentCall.value = {
            id: msg.groupId,
            type: 'REC',
            status: 'accepted',
            sender: { name: 'Emergency Call', id: 'rec', type: 'emergency' },
            receivers: [],
            level: 'emergency',
            timePlaced: Date.now()
          }
        }
      }
    })

    // TASK-033: Group call event handlers for Phase 6 socket integration
    
    // Handle group call initiated notifications
    socketRef.value.on('groupCallInitiated', (msg: any) => {
      console.log('Group call initiated:', msg)
      if (msg.type === 'REC') {
        // Handle REC call initiation - create minimal call details for UI
        const dummyPhone = { id: msg.originatorPhoneId, name: 'REC Caller' } as Phone
        currentCall.value = new CallDetails(
          msg.groupId,
          msg.timestamp || Date.now(),
          msg.level || 'emergency',
          'offered',
          dummyPhone,
          [],
          'REC'
        )
        incomingCall.value = true
        inCall.value = false
        playCallAudio()
      }
    })

    // Handle REC notifications with admin/player differentiation
    socketRef.value.on('recNotification', (msg: any) => {
      console.log('REC notification (player):', msg)
      if (msg.showModal) {
        // Show REC modal with countdown for players
        // The autoAcceptREC setting controls auto-join behavior within the modal
        handleRECCallOffer(msg)
        console.log('Should show REC modal with countdown:', msg.autoJoinCountdown)
      }
    })

    // Handle REC audio notifications for admins
    socketRef.value.on('recAudioNotification', (msg: any) => {
      console.log('REC audio notification (admin):', msg)
      // Play audio notification without modal for admins
      if (enableAudio) {
        playCallAudio()
        // Audio plays but no modal or auto-join for admins
      }
    })

    // Handle group call status updates
    socketRef.value.on('groupCallStatusUpdate', (msg: any) => {
      console.log('Group call status update:', msg)
      if (currentCall.value && currentCall.value.id === msg.groupId) {
        // Update current call status
        currentCall.value.status = msg.status
        if (msg.status === 'active') {
          inCall.value = true
          incomingCall.value = false
        }
      }
    })

    // Handle group call active notifications
    socketRef.value.on('groupCallActive', (msg: any) => {
      console.log('Group call active:', msg)
      
      // Update call state for group calls
      if (msg.groupId) {
        inCall.value = true
        incomingCall.value = false
        stopCallAudio()
        
        // If this is a REC call and we don't have currentCall set, create it
        if (msg.type === 'REC' && !currentCall.value) {
          currentCall.value = {
            id: msg.groupId,
            type: 'REC',
            status: 'accepted',
            sender: { name: 'Emergency Call', id: 'rec', type: 'emergency' },
            receivers: [],
            level: 'emergency',
            timePlaced: Date.now()
          }
        }
        // Update existing currentCall if IDs match
        else if (currentCall.value && currentCall.value.id === msg.groupId) {
          currentCall.value.status = 'accepted'
          inCall.value = true
        }
      }
    })

    // Handle group call terminated notifications
    socketRef.value.on('groupCallTerminated', (msg: any) => {
      console.log('Group call terminated:', msg)
      if (currentCall.value && currentCall.value.id === msg.groupId) {
        currentCall.value = undefined
        preparedCall.value = undefined
        inCall.value = false
        incomingCall.value = false
        stopCallAudio()
      }
    })

    // Handle participant updates
    socketRef.value.on('groupCallParticipantJoined', (msg: any) => {
      console.log('Participant joined group call:', msg)
      // Update participant count or list if needed
    })

    socketRef.value.on('groupCallParticipantLeft', (msg: any) => {
      console.log('Participant left group call:', msg)
      // Update participant count or list if needed
    })

    // Handle force disconnect for REC priority
    socketRef.value.on('forceDisconnect', (msg: any) => {
      console.log('Force disconnect for REC priority:', msg)
      // Disconnect from current call and join REC call
      if (currentCall.value) {
        leaveCall(currentCall.value.id)
      }
      
      // Auto-join the new REC call if configured
      if (autoAcceptREC && msg.newGroupId) {
        setTimeout(() => {
          socketRef.value?.emit('acceptGroupCall', { 
            type: 'REC',
            callRequest: { id: msg.newGroupId }
          })
        }, 100)
      }
    })

    // Handle REC auto-join
    socketRef.value.on('recAutoJoin', (msg: any) => {
      console.log('REC auto-join:', msg)
      if (msg.forceJoin && msg.groupId) {
        // Force join the REC call
        socketRef.value?.emit('acceptGroupCall', {
          type: 'REC',
          callRequest: { id: msg.groupId }
        })
      }
    })

    // Handle group call errors
    socketRef.value.on('groupCallError', (msg: any) => {
      console.error('Group call error:', msg)
      showError('Group Call Error', msg.error)
      
      // Clean up call state on error
      if (currentCall.value && currentCall.value.id === msg.groupId) {
        currentCall.value = undefined
        preparedCall.value = undefined
        inCall.value = false
        incomingCall.value = false
        stopCallAudio()
      }
    })

    // Handle VGCS errors
    socketRef.value.on('vgcsError', (msg: any) => {
      console.error('VGCS error:', msg)
      showError('VGCS Error', msg.error)
    })

    // Queue management events (for client UI)
    if (enableQueueManagement) {
      socketRef.value.on('callQueueUpdate', (msg: { phoneId: string, queue: CallDetails[] }) => {
        processCallQueueUpdate(msg.phoneId, msg.queue)
      })
    }
  }

  const removeCallEventListeners = () => {
    if (!socketRef.value) {
      console.warn('Socket is not available for removing call event listeners')
      return
    }
    
    // Remove existing event listeners
    socketRef.value.off('newCallInQueue')
    socketRef.value.off('joinedCall')
    socketRef.value.off('kickedFromCall')
    socketRef.value.off('groupCallNotification')
    socketRef.value.off('recCallActive')
    
    // TASK-033: Remove group call event listeners for Phase 6
    socketRef.value.off('groupCallInitiated')
    socketRef.value.off('recNotification')
    socketRef.value.off('recAudioNotification')
    socketRef.value.off('groupCallStatusUpdate')
    socketRef.value.off('groupCallActive')
    socketRef.value.off('groupCallTerminated')
    socketRef.value.off('groupCallParticipantJoined')
    socketRef.value.off('groupCallParticipantLeft')
    socketRef.value.off('forceDisconnect')
    socketRef.value.off('recAutoJoin')
    socketRef.value.off('groupCallError')
    socketRef.value.off('vgcsError')
    
    if (enableQueueManagement) {
      socketRef.value.off('callQueueUpdate')
    }
  }

  // Utility functions
  const getCallPriorityClass = (call: CallDetails): string => {
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

  const getCallTypeClass = (call: CallDetails): string => {
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

  const getCallStatusClass = (call: CallDetails): string => {
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

  // TASK-022: REC call management methods
  const handleRECCallOffer = (callInfo: any) => {
    console.log('REC call offer received:', callInfo)
    
    // Play REC audio notification
    if (recAudio) {
      recAudio.play().catch(console.error)
    }
    
    // Transform server data to match RECModal component expectations
    const transformedCallInfo = {
      ...callInfo,
      callerInfo: {
        name: callInfo.originatorName || 'Unknown Caller',
        location: callInfo.originatorLocation || 'Unknown Location',
        id: callInfo.originatorPhoneId || callInfo.phoneId
      },
      countdown: callInfo.autoJoinCountdown !== undefined ? callInfo.autoJoinCountdown : 5,
      isOriginator: callInfo.isOriginator || false,
      message: callInfo.message || undefined
    }
    
    // Show REC modal with appropriate countdown
    recCallInfo.value = transformedCallInfo
    recModalVisible.value = true
    recCountdownActive.value = !transformedCallInfo.isOriginator // No countdown for originator
    
    // Auto-accept after countdown if enabled and not originator
    if (autoAcceptREC && !transformedCallInfo.isOriginator && transformedCallInfo.countdown > 0) {
      setTimeout(() => {
        if (recCountdownActive.value && recModalVisible.value) {
          acceptRECCall()
        }
      }, transformedCallInfo.countdown * 1000)
    }
  }

  const acceptRECCall = async (): Promise<boolean> => {
    if (!recCallInfo.value || !socketRef.value) {
      return false
    }

    recCountdownActive.value = false
    
    // If this is the originator, set up their call state and dismiss the modal
    if (recCallInfo.value.isOriginator) {
      console.log('Originator accepting REC modal - setting up call state')
      
      // Set up the originator's current call state
      currentCall.value = {
        id: recCallInfo.value.id,
        type: 'REC',
        status: 'accepted',
        sender: recCallInfo.value.callerInfo || { name: 'Emergency Call', id: 'rec', type: 'emergency' },
        receivers: [],
        level: 'emergency',
        timePlaced: Date.now()
      }
      
      // Set call state flags
      inCall.value = true
      incomingCall.value = false
      
      // Dismiss the modal
      recModalVisible.value = false
      
      console.log('Originator currentCall state set:', currentCall.value)
      console.log('inCall:', inCall.value, 'currentCall type:', currentCall.value?.type)
      console.log('REC controls should be visible:', inCall.value && currentCall.value?.type === 'REC')
      return true
    }
    
    try {
      // Force disconnect from current call if in one
      await forceDisconnectFromCurrentCall()
      
      // Join the REC call
      const result = await new Promise<boolean>((resolve) => {
        if (!socketRef.value || !recCallInfo.value) {
          resolve(false)
          return
        }
        
        socketRef.value.emit('acceptGroupCall', {
          id: recCallInfo.value.id,
          phoneId: recCallInfo.value.receiverPhone?.id
        }, (response: any) => {
          resolve(response && response !== false)
        })
      })

      if (result) {
        showSuccess('Emergency Call', 'Joined Railway Emergency Call')
        
        // Set current call immediately upon successful join
        if (recCallInfo.value) {
          currentCall.value = {
            id: recCallInfo.value.id,
            type: 'REC',
            status: 'accepted',
            sender: recCallInfo.value.callerInfo || { name: 'Emergency Call', id: 'rec', type: 'emergency' },
            receivers: [],
            level: 'emergency',
            timePlaced: Date.now()
          }
          inCall.value = true
        }
        
        recModalVisible.value = false
        // Note: Keep recCallInfo available for potential future use rather than clearing immediately
      } else {
        showError('Emergency Call Failed', 'Could not join Railway Emergency Call')
      }

      return result
    } catch (error) {
      console.error('Error accepting REC call:', error)
      showError('Emergency Call Failed', 'Error joining Railway Emergency Call')
      return false
    }
  }

  const declineRECCall = () => {
    recCountdownActive.value = false
    recModalVisible.value = false
    
    if (recCallInfo.value && socketRef.value) {
      socketRef.value.emit('rejectGroupCall', {
        id: recCallInfo.value.id,
        phoneId: recCallInfo.value.receiverPhone?.id
      })
    }
    
    recCallInfo.value = undefined
  }

  const forceDisconnectFromCurrentCall = async (): Promise<void> => {
    if (!currentCall.value) return

    try {
      if (currentCall.value.type === 'group' || currentCall.value.type === PreparedCall.TYPES.REC) {
        // Leave group call - use any available phone ID
        const phoneId = Object.keys(myPhones.value)[0] || ''
        await leaveGroupCall(phoneId)
      } else {
        // End P2P call
        await endCall(currentCall.value.id)
      }
    } catch (error) {
      console.error('Error disconnecting from current call:', error)
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
    
    // TASK-033: Group call methods for Phase 6
    startGroupCall,
    joinGroupCall,
    leaveGroupCall,
    terminateGroupCall,
    acceptGroupCall,
    requestGroupCallUpdate,
    
    // TASK-022: REC call management
    recModalVisible,
    recCallInfo,
    recCountdownActive,
    handleRECCallOffer,
    acceptRECCall,
    declineRECCall,
    forceDisconnectFromCurrentCall,
    
    // Utilities
    getCallPriorityClass,
    getCallTypeClass,
    getCallStatusClass
  }
}
