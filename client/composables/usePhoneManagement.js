import { ref, computed } from 'vue'
import { PreparedCall } from '~/models/PreparedCall'

export function usePhoneManagement(socket, gameState, showError, showSuccess) {
  const phoneSearchQuery = ref('')
  const selectedPhone = ref({})
  const newPhone = ref({
    name: "",
    number: "",
    type: "mobile"
  })

  const filteredPhones = computed(() => {
    if (!gameState.value || !gameState.value.phones) return []
    if (!phoneSearchQuery.value) return gameState.value.phones
    
    const searchQuery = phoneSearchQuery.value.toLowerCase()
    return gameState.value.phones.filter(phone => 
      phone.name?.toLowerCase().includes(searchQuery)
    )
  })

  const validatePhoneNumberInput = (event) => {
    // Only allow numeric input for phone number fields
    const value = event.target.value
    
    // Remove any non-numeric characters
    const numericValue = value.replace(/[^0-9]/g, '')
    
    if (numericValue !== value) {
      // Update the input with cleaned value
      event.target.value = numericValue
      newPhone.value.number = numericValue
    }
  }

  const createPhone = (resetForm = true) => {
    console.log('createPhone')
    
    // Validate required fields
    if (!newPhone.value.name || !newPhone.value.name.toString().trim()) {
      showError('Validation Error', 'Phone name is required')
      return
    }
    
    if (!newPhone.value.number || !newPhone.value.number.toString().trim()) {
      showError('Validation Error', 'Phone number is required')
      return
    }

    // Create phone data from form
    const phone = { ...newPhone.value }
    phone.location = null
    phone.hidden = false
    
    socket.emit("createPhone", phone)
    
    // Reset the form after successful submission (optional)
    if (resetForm) {
      newPhone.value = {
        name: "",
        number: "",
        type: "mobile"
      }
    }
    
    showSuccess('Phone Created', `Phone "${phone.name}" has been created successfully`)
  }

  const claimPhone = (phoneId) => {
    socket.emit("claimPhone", { phoneId: phoneId })
  }

  const unclaimPhone = (phoneId) => {
    socket.emit("unclaimPhone", { phoneId: phoneId })
  }

  const placeCall = async (receiver, type = PreparedCall.TYPES.P2P, level = PreparedCall.LEVELS.NORMAL) => {
    console.log('placeCall', receiver, type, level)
    console.log('selectedPhone', selectedPhone.value[receiver])
    console.log('gameState.phones:', gameState.value.phones?.map(p => ({ id: p.id, name: p.name })))
    console.log('selectedPhone full object:', selectedPhone.value)

    // Validate call type
    if (!Object.values(PreparedCall.TYPES).includes(type)) {
      console.error('Invalid call type:', type)
      showError('Invalid Call', `Call type "${type}" is not supported`)
      return
    }

    // Validate call level
    if (!Object.values(PreparedCall.LEVELS).includes(level)) {
      console.error('Invalid call level:', level)
      showError('Invalid Call', `Call level "${level}" is not supported`)
      return
    }

    const receiverPhone = gameState.value.phones.find(p => p.id === receiver)
    // Handle string/number conversion for phone ID lookup
    const selectedPhoneId = selectedPhone.value[receiver]
    const senderPhone = gameState.value.phones.find(p => 
      p.id === selectedPhoneId || 
      p.id === String(selectedPhoneId) || 
      String(p.id) === String(selectedPhoneId)
    )
    
    console.log('receiverPhone found:', receiverPhone ? `${receiverPhone.id} (${receiverPhone.name})` : 'NOT FOUND')
    console.log('senderPhone found:', senderPhone ? `${senderPhone.id} (${senderPhone.name})` : 'NOT FOUND')
    
    if (!senderPhone) {
      console.log("Refusing call: sender phone not selected/not found")
      console.log("Looking for sender phone ID:", selectedPhone.value[receiver])
      console.log("Available phone IDs in gameState:", gameState.value.phones?.map(p => p.id))
      showError('Call Failed', 'Sender phone not selected or not found')
      return
    }

    if (!receiverPhone) {
      console.log("Refusing call: receiver phone not found")
      showError('Call Failed', 'Receiver phone not found')
      return
    }

    try {
      const callId = await new Promise(resolve => { 
        socket.emit("placeCall", { 
          "receivers": [receiverPhone], 
          "sender": senderPhone, 
          "type": type, 
          "level": level 
        }, response => resolve(response)) 
      })
      
      if (callId) {
        const callTypeText = type === PreparedCall.TYPES.REC ? 'Railway Emergency Call' : 
                           type === PreparedCall.TYPES.GROUP ? 'Group Call' : 'P2P Call'
        showSuccess('Call Placed', `${callTypeText} placed from ${senderPhone.name} to ${receiverPhone.name}`)
      }
    } catch (error) {
      console.error('Error placing call:', error)
      showError('Call Failed', 'Failed to place call. Please try again.')
    }
  }

  return {
    phoneSearchQuery,
    selectedPhone,
    newPhone,
    filteredPhones,
    validatePhoneNumberInput,
    createPhone,
    claimPhone,
    unclaimPhone,
    placeCall
  }
}
