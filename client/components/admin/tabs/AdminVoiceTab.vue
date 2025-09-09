<template>
  <div class="my-4">
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
            @end-call="endCall"
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
            @end-call="endCall"
          />
        </div>

        <!-- No Active Calls Message -->
        <CallDisplay
          v-if="!Object.keys(gameState.privateCalls || {}).length && !Object.values(myPhones).some(phone => phone.queue?.length)"
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
        enableAudio: false,
        autoAcceptREC: false,
        enableQueueManagement: false
      }
    )
    
    return {
      ...callManager
    }
  },
  
  mounted() {
    // Set up call event listeners when component mounts
    this.setupCallEventListeners()
  },
  
  beforeUnmount() {
    // Clean up call event listeners when component unmounts
    this.removeCallEventListeners()
  }
}
</script>
