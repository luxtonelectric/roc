import { ref, computed } from 'vue'
import { PreparedCall } from '~/models/PreparedCall'

export function useVoiceCallManagement(socket, gameState, myPhones, showError, showSuccess) {
  const currentCall = ref(null)
  const inCall = ref(false)
  const incomingCall = ref(false)

  const queuedCallsCount = computed(() => {
    return Object.values(myPhones.value).reduce((total, phone) => {
      if (!phone.queue) return total
      return total + phone.queue.filter(call => 
        call.status === PreparedCall.STATUS.OFFERED || call.status === PreparedCall.STATUS.ACCEPTED
      ).length
    }, 0)
  })

  const currentCallStatus = computed(() => {
    if (!currentCall.value) return 'No active call'
    if (inCall.value) return `In call: ${currentCall.value.sender.name} ↔ ${currentCall.value.receivers[0].name}`
    if (incomingCall.value) return `Incoming call: ${currentCall.value.sender.name} → ${currentCall.value.receivers[0].name}`
    return `Call status: ${currentCall.value.status}`
  })

  const acceptCall = (callId) => {
    console.log('Accepting call:', callId)
    
    // Find the call in the queue
    let foundCall = null
    for (const phone of Object.values(myPhones.value)) {
      if (phone.queue) {
        foundCall = phone.queue.find(c => c.id === callId)
        if (foundCall) break
      }
    }
    
    if (!foundCall) {
      console.error('Call not found in queue:', callId)
      showError('Call Error', 'Call not found in queue')
      return
    }

    const call = { id: callId }
    socket.emit('acceptCall', call, response => {
      console.log('acceptCall response', response)
      if (response && response !== false) {
        // Set current call state
        currentCall.value = foundCall
        inCall.value = true
        incomingCall.value = false
        console.log('Call accepted successfully')
        showSuccess('Call Accepted', `Call from ${foundCall.sender?.name || 'Unknown'} accepted`)
      } else {
        console.error('Failed to accept call')
        showError('Call Error', 'Failed to accept call')
      }
    })
  }

  const rejectCall = async (callId) => {
    console.log('Rejecting call:', callId)
    return new Promise((resolve) => {
      socket.emit('rejectCall', { id: callId }, (response) => {
        console.log('Call rejection response:', response)
        if (response?.success || response === true) {
          // Clear call state if we were rejecting our incoming call
          if (currentCall.value && currentCall.value.id === callId) {
            currentCall.value = null
          }
          incomingCall.value = false
          inCall.value = false
          console.log('Call rejected successfully')
          showSuccess('Call Rejected', 'Call has been rejected')
        } else {
          console.error('Failed to reject call:', response?.error || 'Unknown error')
          showError('Call Error', 'Failed to reject call')
        }
        resolve(response)
      })
    })
  }

  const leaveCall = (callId) => {
    console.log('Leaving call:', callId)
    
    socket.emit("leaveCall", { id: callId })
    
    // Clear call state
    if (currentCall.value && currentCall.value.id === callId) {
      currentCall.value = null
    }
    inCall.value = false
    incomingCall.value = false
    
    console.log('Left call successfully')
    showSuccess('Call Ended', 'You have left the call')
  }

  const endCall = (callId) => {
    console.log('Ending call:', callId)
    
    socket.emit("endCall", { id: callId }, (response) => {
      if (response?.success || response === true) {
        // Clear call state
        if (currentCall.value && currentCall.value.id === callId) {
          currentCall.value = null
        }
        inCall.value = false
        incomingCall.value = false
        console.log('Call ended successfully')
        showSuccess('Call Ended', 'Call has been ended')
      } else {
        console.error('Failed to end call:', response?.error || 'Unknown error')
        showError('Call Error', 'Failed to end call')
      }
    })
  }

  // Socket event handlers for call state updates
  const setupCallEventListeners = () => {
    socket.on('callOffered', (call) => {
      console.log('Call offered:', call)
      currentCall.value = call
      incomingCall.value = true
      inCall.value = false
    })

    socket.on('callAccepted', (call) => {
      console.log('Call accepted:', call)
      if (currentCall.value && currentCall.value.id === call.id) {
        inCall.value = true
        incomingCall.value = false
      }
    })

    socket.on('callEnded', (call) => {
      console.log('Call ended:', call)
      if (currentCall.value && currentCall.value.id === call.id) {
        currentCall.value = null
        inCall.value = false
        incomingCall.value = false
      }
    })

    socket.on('callRejected', (call) => {
      console.log('Call rejected:', call)
      if (currentCall.value && currentCall.value.id === call.id) {
        currentCall.value = null
        inCall.value = false
        incomingCall.value = false
      }
    })
  }

  const removeCallEventListeners = () => {
    socket.off('callOffered')
    socket.off('callAccepted')
    socket.off('callEnded')
    socket.off('callRejected')
  }

  return {
    currentCall,
    inCall,
    incomingCall,
    queuedCallsCount,
    currentCallStatus,
    acceptCall,
    rejectCall,
    leaveCall,
    endCall,
    setupCallEventListeners,
    removeCallEventListeners
  }
}
