import { ref, computed, nextTick } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import type { Socket } from 'socket.io-client'
import type { ICall } from '~/models/PreparedCall'
import { PreparedCall } from '~/models/PreparedCall'
import { CallFactory } from '~/models/CallFactory'
import type { AnyCall, IP2PCall, IGroupCall, IRECCall } from '~/models/CallTypeGuards'
import { 
  isP2PCall, 
  isGroupCall, 
  isRECCall, 
  isVGCSCall,
  getCallPriority,
  getCallTypeClass,
  getCallPriorityClass,
  getCallStatusClass,
  usesSimpleStates,
  usesVGCSStates,
  isValidStatusForCallType
} from '~/models/CallTypeGuards'
import type Phone from '~/models/Phone'
import type CallGroup from '~/models/CallGroup'

// Type definitions for enhanced unified call manager
interface UnifiedCallManagerOptions {
  enableAudio?: boolean
  autoAcceptREC?: boolean
  enableQueueManagement?: boolean
  enableUnifiedInterface?: boolean
}

interface GameState {
  [key: string]: any
}

interface PhoneData {
  [key: string]: any
  queue?: ICall[]
}

interface MyPhones {
  [key: string]: PhoneData
}

interface UnifiedCallManagerReturn {
  // Enhanced state management
  currentCall: Ref<ICall | undefined>
  nextCall: Ref<ICall | undefined>
  preparedCall: Ref<ICall | undefined>
  callQueue: Ref<ICall[]>
  activeCalls: Ref<Map<string, ICall>>
  inCall: Ref<boolean>
  incomingCall: Ref<boolean>
  
  // Enhanced computed properties
  queuedCallsCount: ComputedRef<number>
  currentCallStatus: ComputedRef<string>
  sortedIncomingCalls: ComputedRef<ICall[]>
  highestPriorityCall: ComputedRef<ICall | undefined>
  callsByType: ComputedRef<{ p2p: ICall[], group: ICall[], rec: ICall[] }>
  
  // Unified call operations
  placeCall: (callData: ICall | PreparedCall) => Promise<any>
  acceptCall: (callId: string) => Promise<boolean>
  rejectCall: (callId: string) => Promise<boolean>
  terminateCall: (callId: string) => Promise<boolean>
  leaveCall: (callId: string) => void
  
  // Enhanced call management
  selectCall: (call: ICall) => void
  addCallToQueue: (call: ICall) => void
  removeCallFromQueue: (call: ICall) => void
  processCallQueueUpdate: (phoneId: string, queue: ICall[]) => void
  updateCallStatus: (callId: string, status: string) => void
  
  // Audio management
  playCallAudio: () => void
  playRejectedAudio: () => void
  stopCallAudio: () => void
  
  // Event management
  setupCallEventListeners: () => void
  removeCallEventListeners: () => void
  
  // Utility methods enhanced for unified interface
  getCallPriorityClass: (call: ICall) => string
  getCallTypeClass: (call: ICall) => string
  getCallStatusClass: (call: ICall) => string
  validateCallTransition: (call: ICall, newStatus: string) => boolean
  
  // Type-specific call operations
  createP2PCall: (sender: Phone, receiver: Phone, level?: string) => IP2PCall
  createGroupCall: (sender: Phone, receiver: CallGroup, level?: string) => IGroupCall
  createRECCall: (sender: Phone, receiver: CallGroup) => IRECCall
  
  // REC call management (enhanced)
  recModalVisible: Ref<boolean>
  recCallInfo: Ref<IRECCall | undefined>
  recCountdownActive: Ref<boolean>
  handleRECCallOffer: (callInfo: any) => void
  acceptRECCall: () => Promise<boolean>
  declineRECCall: () => void
  forceDisconnectFromCurrentCall: () => Promise<void>
  
  // Group call management (enhanced)
  startGroupCall: (callData: ICall) => Promise<any>
  joinGroupCall: (groupId: string, phoneId: string) => Promise<boolean>
  leaveGroupCall: (phoneId: string) => Promise<boolean>
  terminateGroupCall: (phoneId: string) => Promise<boolean>
  requestGroupCallUpdate: () => void
}

/**
 * Enhanced unified call management composable
 * Supports the new unified call interface with ICall implementation
 */
export function useCallManager(
  socketRef: Ref<Socket | undefined>,
  gameState: Ref<GameState>,
  myPhones: Ref<MyPhones>,
  showError: (title?: string, message?: string) => void,
  showSuccess: (title?: string, message?: string) => void,
  options: UnifiedCallManagerOptions = {}
): UnifiedCallManagerReturn {
  const {
    enableAudio = false,
    autoAcceptREC = false,
    enableQueueManagement = false,
    enableUnifiedInterface = true
  } = options

  // Enhanced call state with unified interface support
  const currentCall: Ref<ICall | undefined> = ref(undefined)
  const nextCall: Ref<ICall | undefined> = ref(undefined)
  const preparedCall: Ref<ICall | undefined> = ref(undefined)
  const callQueue: Ref<ICall[]> = ref([])
  const activeCalls: Ref<Map<string, ICall>> = ref(new Map())
  const inCall = ref(false)
  const incomingCall = ref(false)

  // REC call state (enhanced)
  const recModalVisible = ref(false)
  const recCallInfo: Ref<IRECCall | undefined> = ref(undefined)
  const recCountdownActive = ref(false)

  // Audio elements (only created if audio is enabled)
  let callAudio: HTMLAudioElement | null = null
  let rejectedAudio: HTMLAudioElement | null = null
  let recAudio: HTMLAudioElement | null = null

  if (enableAudio && typeof Audio !== 'undefined') {
    callAudio = new Audio('/audio/telephone-ring.mp3')
    rejectedAudio = new Audio('/audio/rejected.mp3')
    recAudio = new Audio('/audio/rec.mp3')
    if (callAudio) callAudio.loop = true
  }

  // Enhanced computed properties with unified interface support
  const queuedCallsCount = computed(() => {
    if (enableQueueManagement) {
      return callQueue.value.filter(call => 
        call.isOffered() || call.isActive()
      ).length
    } else {
      return Object.values(myPhones.value).reduce((total, phone) => {
        if (!phone.queue) return total
        return total + phone.queue.filter(call => 
          call.isOffered() || call.isActive()
        ).length
      }, 0)
    }
  })

  const currentCallStatus = computed(() => {
    if (!currentCall.value) return 'No active call'
    
    const allPhones = currentCall.value.getAllPhones()
    const senderName = allPhones[0]?.name || 'Unknown'
    const receiversText = allPhones.slice(1).map(p => p.name).join(', ') || 'Unknown'
    
    if (inCall.value) {
      if (isP2PCall(currentCall.value)) {
        return `In call: ${senderName} ↔ ${receiversText}`
      } else {
        return `In ${currentCall.value.type.toUpperCase()} call: ${senderName} ↔ ${receiversText}`
      }
    }
    
    if (incomingCall.value) {
      return `Incoming ${currentCall.value.type.toUpperCase()} call: ${senderName} → ${receiversText}`
    }
    
    return `Call status: ${currentCall.value.status}`
  })

  const sortedIncomingCalls = computed(() => {
    const incomingCalls = callQueue.value.filter(call => call.isOffered())
    
    // Sort by priority using unified priority system
    return incomingCalls.sort((a, b) => {
      return getCallPriority(a) - getCallPriority(b)
    })
  })

  const highestPriorityCall = computed(() => {
    const incoming = sortedIncomingCalls.value
    return incoming.length > 0 ? incoming[0] : undefined
  })

  const callsByType = computed(() => {
    return {
      p2p: callQueue.value.filter(call => isP2PCall(call)),
      group: callQueue.value.filter(call => isGroupCall(call)),
      rec: callQueue.value.filter(call => isRECCall(call))
    }
  })

  // Factory methods for creating calls - now cleaner with CallGroup!
  const createP2PCall = (sender: Phone, receiver: Phone, level: string = PreparedCall.LEVELS.NORMAL): IP2PCall => {
    return CallFactory.createP2PCall(sender, receiver, level)
  }

  const createGroupCall = (sender: Phone, receiver: CallGroup, level: string = PreparedCall.LEVELS.NORMAL): IGroupCall => {
    return CallFactory.createGroupCall(sender, receiver, level)
  }

  const createRECCall = (sender: Phone, receiver: CallGroup): IRECCall => {
    return CallFactory.createRECCall(sender, receiver)
  }

  // Enhanced call operations with unified interface support
  const placeCall = async (callData: ICall | PreparedCall): Promise<any> => {
    console.log('Placing unified call:', callData)
    
    if (!socketRef.value) {
      showError('Call Failed', 'Socket connection not available')
      return false
    }
    
    // Convert PreparedCall to ICall if needed
    let unifiedCall: ICall
    if (callData instanceof PreparedCall) {
      unifiedCall = callData as ICall
    } else {
      unifiedCall = callData
    }
    
    // Validate call data using unified interface
    const allPhones = unifiedCall.getAllPhones()
    if (allPhones.length < 2) {
      showError('Call Failed', 'Invalid call data: insufficient participants')
      return false
    }

    // Validate call type
    if (!Object.values(PreparedCall.TYPES).includes(unifiedCall.type)) {
      showError('Call Failed', `Invalid call type: ${unifiedCall.type}`)
      return false
    }

    // Validate call level
    if (!Object.values(PreparedCall.LEVELS).includes(unifiedCall.level)) {
      showError('Call Failed', `Invalid call level: ${unifiedCall.level}`)
      return false
    }

    preparedCall.value = unifiedCall

    return new Promise((resolve) => {
      socketRef.value?.emit('placeCall', unifiedCall.toEmittable(), (response: any) => {
        console.log('Place unified call response:', response)
        if (response && response !== false) {
          // Server returns the actual call ID - update our call object
          if (typeof response === 'string') {
            console.log('Updating call with server-assigned ID:', response, 'from temp ID:', unifiedCall.id)
            unifiedCall.setId(response)
          }
          
          const callTypeText = isRECCall(unifiedCall) ? 'Railway Emergency Call' : 
                               isGroupCall(unifiedCall) ? 'Group Call' : 'P2P Call'
          const participantsText = allPhones.slice(1).map(p => p.name).join(', ')
          showSuccess('Call Placed', `${callTypeText} placed from ${allPhones[0]?.name} to ${participantsText}`)
          
          // Set as current call to track outgoing call status with correct server ID
          currentCall.value = unifiedCall
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
    console.log('Accepting unified call:', callId)
    
    if (!socketRef.value) {
      showError('Call Failed', 'Socket connection not available')
      return Promise.resolve(false)
    }
    
    // Find the call in the queue
    let foundCall: ICall | null = null
    if (enableQueueManagement) {
      foundCall = callQueue.value.find(c => c.id === callId) || null
    } else {
      for (const phone of Object.values(myPhones.value)) {
        if (phone.queue) {
          foundCall = phone.queue.find(c => c.id === callId) || null
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
      socketRef.value?.emit('acceptCall', { id: callId }, (response: any) => {
        console.log('Accept unified call response:', response)
        if (response && response !== false) {
          currentCall.value = foundCall
          inCall.value = true
          incomingCall.value = false
          
          // Update call status using unified interface
          if (foundCall) {
            if (usesVGCSStates(foundCall)) {
              foundCall.updateStatus(PreparedCall.STATUS.N2_ACTIVE)
            } else {
              foundCall.updateStatus(PreparedCall.STATUS.ACCEPTED)
            }
          }
          
          if (enableQueueManagement && foundCall) {
            removeCallFromQueue(foundCall)
          }
          
          stopCallAudio()
          const senderName = foundCall?.getAllPhones()[0]?.name || 'Unknown'
          showSuccess('Call Accepted', `Call from ${senderName} accepted`)
          resolve(true)
        } else {
          playRejectedAudio()
          if (enableQueueManagement && foundCall) {
            removeCallFromQueue(foundCall)
          }
          showError('Call Error', 'Failed to accept call')
          resolve(false)
        }
      })
    })
  }

  const rejectCall = (callId: string): Promise<boolean> => {
    console.log('Rejecting unified call:', callId)
    
    if (!socketRef.value) {
      showError('Call Failed', 'Socket connection not available')
      return Promise.resolve(false)
    }
    
    return new Promise((resolve) => {
      socketRef.value?.emit('rejectCall', { id: callId }, (response: any) => {
        console.log('Reject unified call response:', response)
        
        // Always clear local state when user intends to reject/cancel
        // This prevents UI from getting stuck even if server reject fails
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
        
        if (response?.success || response === true) {
          showSuccess('Call Rejected', 'Call has been rejected')
          resolve(true)
        } else {
          // Even if server reject failed, we cleared local state for user experience
          showError('Call Error', 'Failed to reject call on server, but cleared locally')
          resolve(false)
        }
      })
    })
  }

  const terminateCall = async (callId: string): Promise<boolean> => {
    console.log('Terminating unified call:', callId)
    
    if (!socketRef.value) {
      console.error('Socket is not available for terminating call')
      return false
    }

    return new Promise((resolve) => {
      socketRef.value?.emit('terminateCall', { id: callId }, (response: any) => {
        console.log('Terminate unified call response:', response)
        
        if (response && response.success) {
          // Clean up local state
          if (currentCall.value && currentCall.value.id === callId) {
            currentCall.value = undefined
            preparedCall.value = undefined
            inCall.value = false
            incomingCall.value = false
          }
          
          // Remove from queue and active calls
          callQueue.value = callQueue.value.filter(call => call.id !== callId)
          activeCalls.value.delete(callId)
          
          stopCallAudio()
          showSuccess('Call Terminated', 'Call has been terminated successfully')
          resolve(true)
        } else {
          console.error('Failed to terminate call:', response)
          showError('Terminate Call Failed', 'Unable to terminate the call')
          resolve(false)
        }
      })
    })
  }

  const leaveCall = (callId: string): void => {
    console.log('Leaving unified call:', callId)
    
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

  // Queue management enhanced for unified interface
  const selectCall = (call: ICall): void => {
    currentCall.value = call
    nextTick(() => {
      console.log('Selected unified call:', call)
    })
  }

  const addCallToQueue = (call: ICall): void => {
    const existingIndex = callQueue.value.findIndex(c => c.id === call.id)
    if (existingIndex === -1) {
      callQueue.value.push(call)
      activeCalls.value.set(call.id, call)
      console.log('Added unified call to queue:', call.id)
    } else {
      // Update existing call
      callQueue.value[existingIndex] = call
      activeCalls.value.set(call.id, call)
      console.log('Updated unified call in queue:', call.id)
    }
    
    // Handle REC-specific UI behavior
    if (isRECCall(call)) {
      console.log('REC call detected - triggering REC modal logic')
      recCallInfo.value = call as IRECCall
      recModalVisible.value = true
      
      if (recAudio && enableAudio) {
        recAudio.play().catch(console.error)
      }
    }
    
    // Update nextCall and incomingCall state for UI display
    updateNextCallState()
  }

  const removeCallFromQueue = (call: ICall): void => {
    const index = callQueue.value.findIndex(c => c.id === call.id)
    if (index !== -1) {
      callQueue.value.splice(index, 1)
      activeCalls.value.delete(call.id)
      console.log('Removed unified call from queue:', call.id)
    }
    
    // Update nextCall and incomingCall state for UI display
    updateNextCallState()
  }

  const processCallQueueUpdate = (phoneId: string, queue: ICall[]): void => {
    if (enableQueueManagement) {
      // Update central queue with unified calls
      for (const callData of queue) {
        try {
          const unifiedCall = CallFactory.fromEmittedData(callData)
          addCallToQueue(unifiedCall)
        } catch (error) {
          console.error('Failed to process unified call data:', error, callData)
        }
      }
    } else {
      // Update phone-specific queue
      if (myPhones.value[phoneId]) {
        const processedQueue = queue.map(callData => {
          try {
            return CallFactory.fromEmittedData(callData)
          } catch (error) {
            console.error('Failed to process unified call data:', error, callData)
            return null
          }
        }).filter(call => call !== null) as ICall[]
        
        myPhones.value[phoneId].queue = processedQueue
      }
    }
  }

  const updateCallStatus = (callId: string, status: string): void => {
    // Update in call queue
    const queueCall = callQueue.value.find(c => c.id === callId)
    if (queueCall && isValidStatusForCallType(queueCall, status)) {
      queueCall.updateStatus(status)
    }
    
    // Update in active calls
    const activeCall = activeCalls.value.get(callId)
    if (activeCall && isValidStatusForCallType(activeCall, status)) {
      activeCall.updateStatus(status)
    }
    
    // Update current call if it matches
    if (currentCall.value && currentCall.value.id === callId && isValidStatusForCallType(currentCall.value, status)) {
      currentCall.value.updateStatus(status)
      
      // Handle call state transitions
      if (status === PreparedCall.STATUS.ACCEPTED) {
        inCall.value = true
        incomingCall.value = false
        stopCallAudio()
      } else if (status === PreparedCall.STATUS.REJECTED || status === PreparedCall.STATUS.ENDED) {
        inCall.value = false
        incomingCall.value = false
        currentCall.value = undefined
        stopCallAudio()
        
        // Update next call state for any remaining incoming calls
        updateNextCallState()
      }
    }
  }

  // Audio management
  const playCallAudio = (): void => {
    if (callAudio && enableAudio) {
      callAudio.currentTime = 0
      callAudio.play().catch(console.error)
    }
  }

  const playRejectedAudio = (): void => {
    if (rejectedAudio && enableAudio) {
      rejectedAudio.currentTime = 0
      rejectedAudio.play().catch(console.error)
    }
  }

  const stopCallAudio = (): void => {
    if (callAudio && enableAudio) {
      callAudio.pause()
      callAudio.currentTime = 0
    }
  }

  // Validation utilities
  const validateCallTransition = (call: ICall, newStatus: string): boolean => {
    return isValidStatusForCallType(call, newStatus)
  }

  // Helper function to check if a call is outgoing (we own the sender phone)
  const isOutgoingCall = (call: ICall): boolean => {
    const myPhoneIds = myPhones.value ? Object.keys(myPhones.value) : []
    const allPhones = call.getAllPhones()
    const sender = allPhones[0] // First phone is always the sender
    return sender ? myPhoneIds.includes(sender.id) : false
  }

  // Update nextCall and incomingCall state based on current queue
  const updateNextCallState = (): void => {
    console.log('updateNextCallState called, currentCall exists:', !!currentCall.value)
    if (currentCall.value) {
      console.log('Current call ID:', currentCall.value.id)
      console.log('Current call is outgoing:', isOutgoingCall(currentCall.value))
    }
    
    // Only look for incoming calls (where we don't own the sender)
    const incomingCalls = callQueue.value.filter(call => 
      call.isOffered() && !isOutgoingCall(call)
    )
    
    // Sort by priority and get the highest priority incoming call
    const highestPriorityIncoming = incomingCalls.sort((a, b) => {
      return getCallPriority(a) - getCallPriority(b)
    })[0]
    
    if (highestPriorityIncoming) {
      nextCall.value = highestPriorityIncoming
      incomingCall.value = true
      
      console.log('Set nextCall (incoming):', nextCall.value)
      console.log('NextCall toEmittable:', nextCall.value.toEmittable())
      
      // Play audio notification for new incoming calls
      if (enableAudio) {
        playCallAudio()
      }
    } else {
      nextCall.value = undefined
      incomingCall.value = false
      stopCallAudio()
    }
  }

  // Enhanced utility methods
  const getCallPriorityClassEnhanced = (call: ICall): string => {
    return getCallPriorityClass(call)
  }

  const getCallTypeClassEnhanced = (call: ICall): string => {
    return getCallTypeClass(call)
  }

  const getCallStatusClassEnhanced = (call: ICall): string => {
    return getCallStatusClass(call)
  }

  // Group call management (enhanced for unified interface)
  const startGroupCall = async (callData: ICall): Promise<any> => {
    if (!socketRef.value) {
      console.error('Socket is not available for starting group call')
      return false
    }

    if (!isVGCSCall(callData)) {
      console.error('Attempting to start group call with non-VGCS call type')
      return false
    }

    return new Promise((resolve) => {
      socketRef.value?.emit('startGroupCall', {
        type: callData.type,
        level: callData.level,
        senderPhoneId: callData.getAllPhones()[0]?.id
      }, (response: any) => {
        console.log('Start unified group call response:', response)
        resolve(response)
      })
    })
  }

  const joinGroupCall = async (groupId: string, phoneId: string): Promise<boolean> => {
    if (!socketRef.value) {
      console.error('Socket is not available for joining group call')
      return false
    }

    return new Promise((resolve) => {
      socketRef.value?.emit('joinGroupCall', {
        groupId,
        phoneId
      }, (response: any) => {
        console.log('Join unified group call response:', response)
        if (response && response.success) {
          showSuccess('Group Call Joined', 'Successfully joined the group call')
          resolve(true)
        } else {
          showError('Join Failed', 'Failed to join the group call')
          resolve(false)
        }
      })
    })
  }

  const leaveGroupCall = async (phoneId: string): Promise<boolean> => {
    if (!socketRef.value) {
      console.error('Socket is not available for leaving group call')
      return false
    }

    return new Promise((resolve) => {
      socketRef.value?.emit('leaveGroupCall', { phoneId }, (response: any) => {
        console.log('Leave unified group call response:', response)
        if (response && response.success) {
          showSuccess('Group Call Left', 'Successfully left the group call')
          resolve(true)
        } else {
          const errorMessage = response?.message || 'Failed to leave the group call'
          showError('Leave Failed', errorMessage)
          resolve(false)
        }
      })
    })
  }

  const terminateGroupCall = async (phoneId: string): Promise<boolean> => {
    if (!socketRef.value) {
      console.error('Socket is not available for terminating group call')
      return false
    }

    return new Promise((resolve) => {
      socketRef.value?.emit('terminateGroupCall', { phoneId }, (response: any) => {
        console.log('Terminate unified group call response:', response)
        if (response && response.success) {
          showSuccess('Group Call Terminated', 'Successfully terminated the group call')
          resolve(true)
        } else {
          const errorMessage = response?.message || 'Failed to terminate the group call'
          showError('Terminate Failed', errorMessage)
          resolve(false)
        }
      })
    })
  }

  const requestGroupCallUpdate = (): void => {
    if (socketRef.value) {
      socketRef.value.emit('requestGroupCallUpdate')
    }
  }

  // REC call management (enhanced for unified interface)
  const handleRECCallOffer = (callInfo: any): void => {
    try {
      const recCall = CallFactory.fromEmittedData(callInfo) as IRECCall
      if (!isRECCall(recCall)) {
        console.error('Invalid REC call data received')
        return
      }
      
      recCallInfo.value = recCall
      recModalVisible.value = true
      
      if (recAudio && enableAudio) {
        recAudio.play().catch(console.error)
      }
    } catch (error) {
      console.error('Failed to process REC call offer:', error)
      showError('REC Call Error', 'Failed to process Railway Emergency Call')
    }
  }

  const acceptRECCall = async (): Promise<boolean> => {
    if (!recCallInfo.value) {
      console.error('No REC call to accept')
      return false
    }

    const success = await acceptCall(recCallInfo.value.id)
    if (success) {
      recModalVisible.value = false
      recCallInfo.value = undefined
    }
    return success
  }

  const declineRECCall = (): void => {
    if (recCallInfo.value) {
      rejectCall(recCallInfo.value.id)
      recModalVisible.value = false
      recCallInfo.value = undefined
    }
  }

  const forceDisconnectFromCurrentCall = async (): Promise<void> => {
    if (currentCall.value) {
      await terminateCall(currentCall.value.id)
    }
  }

  // Event listeners (enhanced for unified interface)
  function setupCallEventListeners(): void {
    if (!socketRef.value) return

    // Unified call events - single event type for all call notifications
    socketRef.value.on('callUpdate', (data) => {
      console.log('Unified call update received:', data)
      try {
        const unifiedCall = CallFactory.fromEmittedData(data)
        console.log('Created unified call object:', unifiedCall)
        console.log('Call toEmittable:', unifiedCall.toEmittable())
        addCallToQueue(unifiedCall)
      } catch (error) {
        console.error('Failed to process unified call update:', error)
      }
    })

    socketRef.value.on('callStatusUpdate', (data) => {
      console.log('Unified call status update:', data)
      updateCallStatus(data.callId, data.status)
    })

    // REC calls now handled through unified callUpdate events
    // REC-specific UI behavior (modal, countdown) is triggered in addCallToQueue when call.type === 'REC'

    console.log('Unified call event listeners set up')
  }

  function removeCallEventListeners(): void {
    if (!socketRef.value) return

    socketRef.value.off('callUpdate')
    socketRef.value.off('callStatusUpdate')
    // No more separate REC event listeners - REC calls handled through unified callUpdate

    console.log('Unified call event listeners removed')
  }

  return {
    // Enhanced state
    currentCall,
    nextCall,
    preparedCall,
    callQueue,
    activeCalls,
    inCall,
    incomingCall,
    
    // Enhanced computed
    queuedCallsCount,
    currentCallStatus,
    sortedIncomingCalls,
    highestPriorityCall,
    callsByType,
    
    // Unified operations
    placeCall,
    acceptCall,
    rejectCall,
    terminateCall,
    leaveCall,
    
    // Enhanced management
    selectCall,
    addCallToQueue,
    removeCallFromQueue,
    processCallQueueUpdate,
    updateCallStatus,
    
    // Audio
    playCallAudio,
    playRejectedAudio,
    stopCallAudio,
    
    // Events
    setupCallEventListeners,
    removeCallEventListeners,
    
    // Utilities
    getCallPriorityClass: getCallPriorityClassEnhanced,
    getCallTypeClass: getCallTypeClassEnhanced,
    getCallStatusClass: getCallStatusClassEnhanced,
    validateCallTransition,
    
    // Factory methods
    createP2PCall,
    createGroupCall,
    createRECCall,
    
    // REC management
    recModalVisible,
    recCallInfo,
    recCountdownActive,
    handleRECCallOffer,
    acceptRECCall,
    declineRECCall,
    forceDisconnectFromCurrentCall,
    
    // Group management
    startGroupCall,
    joinGroupCall,
    leaveGroupCall,
    terminateGroupCall,
    requestGroupCallUpdate
  }
}