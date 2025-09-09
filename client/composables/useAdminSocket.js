import { ref } from 'vue'

export function useAdminSocket(socket, discordId) {
  const gameState = ref({})
  const myPhones = ref({})
  const availableSimulations = ref([])
  const availableChannels = ref([])
  
  // Call state management
  const currentCall = ref(null)
  const inCall = ref(false)
  const incomingCall = ref(false)

  const setupSocketListeners = () => {
    // Set up connection event handlers
    socket.on('connect', () => {
      console.log('Socket connected, loading initial data')
      loadInitialData()
    })

    socket.on('disconnect', () => {
      console.log('Socket disconnected')
    })

    // Set up admin status listener
    socket.on('adminStatus', (msg) => {
      console.log('Received admin status update')
      gameState.value = msg
      const allPhones = msg.phones
      const filteredPhones = allPhones.filter((p) => typeof p.player !== 'undefined' && p.player.discordId === discordId)
      console.log('Filtered my phones:', filteredPhones)
      
      // Remove phones that are no longer assigned to this user
      Object.keys(myPhones.value).forEach(phoneId => {
        if (!filteredPhones.find(mp => mp.id === phoneId)) {
          console.log('Removing unassigned phone:', phoneId)
          delete myPhones.value[phoneId]
        }
      })
      
      // Update currently assigned phones
      filteredPhones.forEach(mp => {
        myPhones.value[mp.id] = mp
      })
      console.log('Updated myPhones:', myPhones.value)
      
      // Ensure voice channels are loaded
      if (!availableChannels.value.length) {
        loadVoiceChannels()
      }
    })

    // Listen for voice channel updates
    socket.on('voiceChannelsUpdate', (channels) => {
      console.log('Voice channels updated:', channels)
      if (channels && Array.isArray(channels)) {
        availableChannels.value = channels
      }
    })

    socket.on('callQueueUpdate', (msg) => {
      console.log('Call queue update received:', msg)
      if (myPhones.value[msg.phoneId]) {
        // Update only the queue and preserve other phone properties
        myPhones.value[msg.phoneId] = {
          ...myPhones.value[msg.phoneId],
          queue: msg.queue || []
        }
      } else {
        // If the phone doesn't exist yet, initialize it
        myPhones.value[msg.phoneId] = msg
      }
      
      // Check if our current call was ended/rejected and update state accordingly
      if (currentCall.value) {
        let callStillExists = false
        const queue = msg.queue || []
        
        for (const call of queue) {
          if (call.id === currentCall.value.id) {
            // Update current call status
            currentCall.value = call
            
            if (call.status === 'accepted') {
              inCall.value = true
              incomingCall.value = false
            } else if (call.status === 'offered') {
              inCall.value = false
              incomingCall.value = true
            }
            
            callStillExists = true
            break
          }
        }
        
        // If our current call is no longer in the queue, it was ended/rejected
        if (!callStillExists) {
          console.log('Current call no longer in queue, clearing state')
          currentCall.value = null
          inCall.value = false
          incomingCall.value = false
        }
      }
    })

    // Handle being kicked from call
    socket.on("kickedFromCall", (msg) => {
      console.log('Admin kicked from call:', msg)
      // End current call state
      if (currentCall.value) {
        currentCall.value = null
        inCall.value = false
        incomingCall.value = false
      }
    })
  }

  const removeSocketListeners = () => {
    socket.off('connect')
    socket.off('disconnect')
    socket.off('adminStatus')
    socket.off('voiceChannelsUpdate')
    socket.off('callQueueUpdate')
    socket.off('kickedFromCall')
  }

  const loadInitialData = async () => {
    if (!socket.connected) {
      console.warn('Socket not connected, waiting for connection...')
      return
    }
    
    // Load admin state first
    await refreshAdminData()
    
    // Load available simulations and voice channels in parallel
    await Promise.all([
      loadSimulations(),
      loadVoiceChannels()
    ]).catch(err => {
      console.error('Error loading initial data:', err)
    })
  }

  const loadSimulations = async () => {
    return new Promise((resolve, reject) => {
      socket.emit('getAvailableSimulations', {}, (response) => {
        if (response.success) {
          console.log('Loaded available simulations:', response.simulations)
          availableSimulations.value = response.simulations
          resolve(response.simulations)
        } else {
          console.error('Failed to get simulations:', response.error)
          reject(new Error(response.error))
        }
      })
    })
  }
  
  const loadVoiceChannels = async () => {
    return new Promise((resolve, reject) => {
      socket.emit('getAvailableVoiceChannels', {}, (response) => {
        if (response.success && response.voiceChannels) {
          console.log('Loaded available voice channels:', response.voiceChannels)
          availableChannels.value = response.voiceChannels
          resolve(response.voiceChannels)
        } else {
          console.error('Failed to get voice channels:', response.error)
          reject(new Error(response.error))
        }
      })
    })
  }

  const refreshAdminData = () => {
    console.log('Refreshing admin data...')
    return new Promise((resolve, reject) => {
      socket.emit('adminLogin', { discordId: discordId }, (response) => {
        console.log('Admin login response:', response)
        if (response?.success) {
          if (response.voiceChannels && Array.isArray(response.voiceChannels)) {
            console.log('Setting voice channels from admin login:', response.voiceChannels.length)
            availableChannels.value = response.voiceChannels
          } else {
            console.log('No voice channels in admin login response, will retry')
            retryLoadVoiceChannels()
          }
          resolve(response)
        } else {
          reject(new Error('Admin login failed'))
        }
      })
    })
  }

  const retryLoadVoiceChannels = (attempt = 1) => {
    if (attempt > 3) return // Max 3 attempts
    
    console.log(`Attempting to load voice channels (attempt ${attempt})`)
    socket.emit('getAvailableVoiceChannels', {}, (response) => {
      if (response?.success && Array.isArray(response.voiceChannels)) {
        console.log(`Got voice channels on attempt ${attempt}:`, response.voiceChannels.length)
        availableChannels.value = response.voiceChannels
      } else {
        console.log(`Voice channels not available on attempt ${attempt}, retrying in 2s...`)
        setTimeout(() => retryLoadVoiceChannels(attempt + 1), 2000)
      }
    })
  }

  return {
    gameState,
    myPhones,
    availableSimulations,
    availableChannels,
    currentCall,
    inCall,
    incomingCall,
    setupSocketListeners,
    removeSocketListeners,
    loadInitialData,
    refreshAdminData
  }
}
