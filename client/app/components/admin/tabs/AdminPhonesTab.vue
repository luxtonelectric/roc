<template>
  <div class="my-1">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-3xl font-bold">Phones</h1>
      <button 
        @click="openAddPhoneModal"
        class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-sm"
      >
        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
        </svg>
        Add New Phone
      </button>
    </div>

    <!-- Add Phone Modal -->
    <AddPhoneModal
      :isVisible="isModalVisible"
      :validatePhoneNumberInput="validatePhoneNumberInput"
      @close="closeModal"
      @submit="handlePhoneSubmit"
    />
    
    <!-- Debug info -->
    <div class="mb-4 p-2 bg-yellow-100 text-sm">
      <p>GameState phones: {{ gameState.phones ? gameState.phones.length : 'undefined' }}</p>
      <p>Filtered phones: {{ filteredPhones ? filteredPhones.length : 'undefined' }}</p>
    </div>
    
    <template v-if="gameState.phones">
      <div class="overflow-x-auto">
        <!-- Search Bar -->
        <div class="flex justify-between items-center mb-4">
          <div class="relative">
            <input
              v-model="phoneSearchQuery"
              type="text"
              placeholder="Search phones by name..."
              class="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span class="absolute right-3 top-2.5 text-gray-400">
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
          </div>
        </div>

        <!-- Phones Table -->
        <table class="min-w-full table-auto bg-white shadow-sm rounded-lg overflow-hidden">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Number</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Claimed</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Call Controls</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="phone in filteredPhones" :key="phone.id" class="hover:bg-gray-50">
              <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{{ phone.name }}</td>
              <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{{ phone.number }}</td>
              <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{{ phone.type }}</td>
              <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                <span v-if="phone.location">{{ phone.location.simId }}/{{ phone.location.panelId }}</span>
                <span v-else class="text-gray-400">Not set</span>
              </td>
              <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                <span v-if="phone.player" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  <img class="h-8 w-8 rounded-full" :src="phone.player.avatarURL" :title="phone.player.displayName" :alt="phone.player.displayName">
                </span>
                <span v-else class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  Available
                </span>
              </td>
              <td class="px-4 py-3 whitespace-nowrap text-sm font-medium">
                <button 
                  v-if="!phone.player"
                  @click="claimPhone(phone.id)"
                  class="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Claim
                </button>
                <button 
                  v-else 
                  @click="unclaimPhone(phone.id)"
                  class="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Unclaim
                </button>
              </td>
              <td class="px-4 py-3 whitespace-nowrap">
                <div class="flex items-center space-x-2">
                  <select 
                    v-model="selectedPhone[phone.id]"
                    class="block w-32 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    :disabled="Object.keys(myPhones).length === 0"
                  >
                    <option value="">{{ Object.keys(myPhones).length === 0 ? 'No claimed phones' : 'Select Phone' }}</option>
                    <option v-for="(myPhone, key) in myPhones" :key="key" :value="key">
                      {{ myPhone?.name || key }}
                    </option>
                  </select>
                  <button 
                    @click="placeCall(phone.id, PreparedCall.TYPES.P2P, PreparedCall.LEVELS.NORMAL)"
                    :disabled="!selectedPhone[phone.id] || !phone.player"
                    :class="[
                      'px-2 py-1 rounded text-sm',
                      (selectedPhone[phone.id] && phone.player) 
                        ? 'bg-blue-500 hover:bg-blue-600 text-white cursor-pointer' 
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-50'
                    ]"
                    :title="!selectedPhone[phone.id] ? 'Select a sender phone first' : (!phone.player ? 'Receiver phone must be claimed' : 'Place a normal priority P2P call')"
                  >
                    Call
                  </button>
                  <button 
                    @click="placeCall(phone.id, PreparedCall.TYPES.P2P, PreparedCall.LEVELS.URGENT)"
                    :disabled="!selectedPhone[phone.id] || !phone.player"
                    :class="[
                      'px-2 py-1 rounded text-sm',
                      (selectedPhone[phone.id] && phone.player) 
                        ? 'bg-yellow-500 hover:bg-yellow-600 text-white cursor-pointer' 
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-50'
                    ]"
                    :title="!selectedPhone[phone.id] ? 'Select a sender phone first' : (!phone.player ? 'Receiver phone must be claimed' : 'Place an urgent priority P2P call')"
                  >
                    Urgent
                  </button> 
                  <button 
                    @click="placeCall(phone.id, PreparedCall.TYPES.REC, PreparedCall.LEVELS.EMERGENCY)"
                    :disabled="!selectedPhone[phone.id] || !hasValidLocationForREC(phone.id) || !phone.player"
                    :class="[
                      'px-2 py-1 rounded text-sm',
                      (selectedPhone[phone.id] && hasValidLocationForREC(phone.id) && phone.player)
                        ? 'bg-red-500 hover:bg-red-600 text-white cursor-pointer' 
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-50'
                    ]"
                    :title="!selectedPhone[phone.id] ? 'Select a sender phone first' : (!phone.player ? 'Receiver phone must be claimed' : (!hasValidLocationForREC(phone.id) ? 'Sender phone must have valid location (simId and panelId) for REC calls' : 'Place a Railway Emergency Call'))"
                  >
                    REC
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
    
    <div v-else class="text-center py-8">
      <p class="text-gray-500">No phones data available</p>
    </div>
  </div>
</template>

<script>
import { toRefs, ref, watch } from 'vue'
import { usePhoneManagement } from '../../../../composables/usePhoneManagement'
import { useCallManager } from '../../../../composables/useCallManager'
import { PreparedCall } from '~/models/PreparedCall'
import AddPhoneModal from '~/components/admin/AddPhoneModal.vue'

export default {
  name: 'AdminPhonesTab',
  components: {
    AddPhoneModal
  },
  props: {
    socket: {
      type: Object,
      required: true
    },
    gameState: {
      type: Object,
      required: true
    },
    myPhones: {
      type: Object,
      default: () => ({})
    },
    showError: {
      type: Function,
      required: true
    },
    showSuccess: {
      type: Function,
      required: true
    },
    enableAudio: {
      type: Boolean,
      default: true
    }
  },
  
  setup(props) {
    const { gameState, myPhones } = toRefs(props)
    
    // Phone management composable (now focused only on phone administration)
    const phoneManagement = usePhoneManagement(
      props.socket,
      gameState,
      props.showError,
      props.showSuccess
    )
    
    // Call management composable for placing calls
    const socketRef = ref(props.socket)
    
    // Watch for socket prop changes and update the ref
    watch(() => props.socket, (newSocket) => {
      socketRef.value = newSocket
    })
    
    const callManager = useCallManager(
      socketRef,
      gameState,
      myPhones,
      props.showError,
      props.showSuccess,
      {
        enableAudio: props.enableAudio,           // Controlled by Admin ringer toggle
        autoAcceptREC: false,         // No auto-accept for admin
        enableQueueManagement: true  // Admin doesn't need queue management for placement
      }
    )

    // Keep call manager audio setting in sync with prop
    watch(() => props.enableAudio, (val) => {
      callManager.setEnableAudio?.(val)
    }, { immediate: true })
    
    // Enhanced placeCall that uses callManager with proper PreparedCall objects
    const placeCall = async (receiverId, type, level) => {
      console.log('Admin placing call:', receiverId, type, level)
      
      // Find receiver and sender phones
      const receiverPhone = gameState.value.phones.find(p => p.id === receiverId)
      const selectedPhoneId = phoneManagement.selectedPhone.value[receiverId]
      const senderPhone = gameState.value.phones.find(p => 
        p.id === selectedPhoneId || 
        p.id === String(selectedPhoneId) || 
        String(p.id) === String(selectedPhoneId)
      )
      
      console.log('receiverPhone found:', receiverPhone ? `${receiverPhone.id} (${receiverPhone.name})` : 'NOT FOUND')
      console.log('senderPhone found:', senderPhone ? `${senderPhone.id} (${senderPhone.name})` : 'NOT FOUND')
      
      if (!senderPhone) {
        console.log("Refusing call: sender phone not selected/not found")
        console.log("Looking for sender phone ID:", selectedPhoneId)
        console.log("Available phone IDs in gameState:", gameState.value.phones?.map(p => p.id))
        props.showError('Call Failed', 'Sender phone not selected or not found')
        return
      }

      if (!receiverPhone) {
        console.log("Refusing call: receiver phone not found")
        props.showError('Call Failed', 'Receiver phone not found')
        return
      }

      // Prevent calling a receiver phone that is not claimed/assigned
      if (!receiverPhone.player) {
        console.log("Refusing call: receiver phone not claimed")
        props.showError('Call Failed', 'Receiver phone must be claimed before placing calls')
        return
      }

      try {
        // Create PreparedCall object and use callManager's placeCall
        // Note: PreparedCall constructor expects (sender, target, type, level)
        // where target is a single Phone object or string, not an array
        const callData = new PreparedCall(
          senderPhone,
          receiverPhone,
          type,
          level
        )
        
        console.log('Created PreparedCall:', callData)
        
        const result = await callManager.placeCall(callData)
        console.log('Call placement result:', result)
        
        return result
      } catch (error) {
        console.error('Error placing call:', error)
        props.showError('Call Failed', 'Failed to place call. Please try again.')
        return false
      }
    }

    const hasValidLocationForREC = (receiverPhoneId) => {
      // Get the selected sender phone ID for this receiver
      const selectedSenderPhoneId = phoneManagement.selectedPhone.value[receiverPhoneId]
      if (!selectedSenderPhoneId) {
        return false
      }
      
      // Find the sender phone in myPhones
      const senderPhone = props.myPhones[selectedSenderPhoneId]
      if (!senderPhone) {
        return false
      }
      
      // Check if the sender phone has a valid location with both simId and panelId
      return senderPhone.location && 
             senderPhone.location.simId && 
             senderPhone.location.panelId
    }
    
    return {
      PreparedCall, // Make PreparedCall available in template
      hasValidLocationForREC,
      placeCall, // Enhanced version using callManager
      ...phoneManagement // Spread phone management functionality (excluding the old placeCall)
    }
  },
  
  data() {
    return {
      isModalVisible: false
    }
  },
  
  methods: {
    openAddPhoneModal() {
      this.isModalVisible = true
    },
    
    closeModal() {
      this.isModalVisible = false
    },
    
    handlePhoneSubmit(phoneData) {
      // Update the composable's newPhone with the submitted data
      this.newPhone.name = phoneData.name
      this.newPhone.number = phoneData.number
      this.newPhone.type = phoneData.type
      
      // Call the createPhone method from composable
      this.createPhone(true) // Reset form after creation
      
      // Close modal after successful submission
      this.closeModal()
    }
  }
}
</script>
