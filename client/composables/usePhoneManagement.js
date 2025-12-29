import { ref, computed } from 'vue'

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

  return {
    phoneSearchQuery,
    selectedPhone,
    newPhone,
    filteredPhones,
    validatePhoneNumberInput,
    createPhone,
    claimPhone,
    unclaimPhone
  }
}
