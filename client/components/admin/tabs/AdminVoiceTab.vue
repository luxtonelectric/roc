<template>
  <div class="my-4">
            <!-- Active Group Calls Section -->
        <div v-if="(gameState.groupCalls || []).length > 0" class="mt-8">
          <CallDisplay
            :calls="gameState.groupCalls || []"
            title="Active Group Calls"
            :display-mode="'table'"
            :show-queue="false"
            :show-count="false"
            :show-actions="true"
            :show-empty="false"
            :my-phones="myPhones"
            :is-group-call="true"
            @end-call="terminateCall"
            @join-group-call="joinGroupCall"
            @leave-group-call="leaveGroupCall"
          />
        </div>
        
    <!-- Voice Calls Container -->
    <div class="bg-white shadow-sm rounded-lg overflow-hidden">
      <div class="border-b border-gray-200 bg-gray-50 px-4 py-4 sm:px-6">
        <h1 class="text-3xl font-bold text-gray-900">Voice Calls</h1>
        <!-- Current Call Status -->
        <div class="mt-2">
          <CallStatus 
            :current-call="currentCall"
            :in-call="inCall"
            :incoming-call="incomingCall"
            :queued-calls-count="queuedCallsCount"
            :show-count="true"
            :show-details="false"
          />
        </div>
      </div>
      
      <div class="px-4 py-5 sm:p-6">
        <!-- Phone Queues Section -->
        <div v-for="(phone, key) in myPhones" :key="key" class="mb-8 last:mb-0">
          <CallDisplay
            v-if="phone.queue && phone.queue.length > 0"
            :calls="phone.queue"
            :title="phone.name || key"
            :display-mode="'table'"
            :show-queue="true"
            :show-count="true"
            :show-actions="true"
            :show-empty="false"
            :my-phones="myPhones"
            @accept-call="acceptCall"
            @reject-call="rejectCall"
            @leave-call="leaveCall"
            @end-call="terminateCall"
          />
        </div>

        <!-- Active Group Calls Section (VGCS) -->
        <div v-if="Object.keys(gameState.groupCalls || {}).length > 0" class="mt-8">
          <CallDisplay
            :calls="Object.values(gameState.groupCalls || {})"
            title="Active Group Calls (VGCS)"
            :display-mode="'table'"
            :show-queue="false"
            :show-count="true"
            :show-actions="true"
            :show-empty="false"
            :my-phones="myPhones"
            :is-group-call="true"
            @end-call="terminateCall"
            @join-group-call="joinGroupCall"
            @leave-group-call="leaveGroupCall"
          />
        </div>

        <!-- Active Private Calls Section -->
        <div v-if="Object.keys(gameState.privateCalls || {}).length > 0" class="mt-8">
          <CallDisplay
            :calls="Object.values(gameState.privateCalls || {})"
            title="Active Private Calls"
            :display-mode="'table'"
            :show-queue="true"
            :show-count="false"
            :show-actions="true"
            :show-empty="false"
            :my-phones="myPhones"
            :is-group-call="false"
            @end-call="terminateCall"
          />
        </div>

        <!-- No Active Calls Message -->
        <CallDisplay
          v-if="!Object.keys(gameState.privateCalls || {}).length && 
                !(gameState.groupCalls || []).length && 
                !Object.values(myPhones).some(phone => phone.queue?.length)"
          :calls="[]"
          :show-queue="false" 
          :show-empty="true"
          empty-title="No active calls"
          empty-message="There are currently no active calls or calls in queue."
        />
      </div>
    </div>
  </div>
</template>

<script>
import { toRefs, ref, watch } from 'vue'
import { useCallManager } from '~/composables/useCallManager'
import CallDisplay from '~/components/shared/CallDisplay.vue'
import CallStatus from '~/components/shared/CallStatus.vue'

export default {
  name: 'AdminVoiceTab',
  components: {
    CallDisplay,
    CallStatus
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
    }
  },
  
  setup(props) {
    const { gameState, myPhones } = toRefs(props)
    
    // Create a reactive reference for the socket
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
        enableAudio: true,
        autoAcceptREC: false,
        enableQueueManagement: true
      }
    )
    
    // Override REC notification handling for admin users (REQ-004)
    // Admins should receive audio notification only, no modal or auto-join
    watch(() => socketRef.value, (socket) => {
      if (socket) {
        // Override the default recNotification handler to prevent modal
        socket.off('recNotification') // Remove default handler
        socket.on('recNotification', (msg) => {
          console.log('Admin REC notification (audio only):', msg)
          // Play audio notification without showing modal
          // This satisfies REQ-004: "Admins receive REC audio notification but no auto-join or special modal"
          if (callManager.enableAudio) {
            callManager.playCallAudio()
          }
          // Explicitly do NOT show modal or trigger auto-join for admin users
        })
      }
    }, { immediate: true })
    
    // Group call management methods
    const joinGroupCall = (groupId) => {
      console.log('Admin joining group call:', groupId)
      if (socketRef.value) {
        socketRef.value.emit('joinGroupCall', { groupId })
      }
    }

    const leaveGroupCall = (groupId) => {
      console.log('Admin leaving group call:', groupId)
      if (socketRef.value) {
        socketRef.value.emit('leaveGroupCall', { groupId })
      }
    }

    return {
      ...callManager,
      joinGroupCall,
      leaveGroupCall
    }
  },
  
  mounted() {
    // Set up call event listeners when component mounts
    this.setupCallEventListeners()
  },
  
  beforeUnmount() {
    // Clean up call event listeners when component unmounts
    this.removeCallEventListeners()
    
    // Clean up admin-specific REC notification override
    if (this.socketRef) {
      this.socketRef.off('recNotification')
    }
  }
}
</script>
