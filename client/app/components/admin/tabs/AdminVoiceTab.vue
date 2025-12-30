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
            :is-admin="true"
            @end-call="terminateCall"
            @join-group-call="joinGroupCall"
            @leave-group-call="leaveGroupCall"
            @force-terminate="forceTerminateCall"
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
            :is-admin="true"
            @end-call="terminateCall"
            @join-group-call="joinGroupCall"
            @leave-group-call="leaveGroupCall"
            @force-terminate="forceTerminateCall"
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
import { useCallManager } from '../../../../composables/useCallManager'
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
    },
    enableAudio: {
      type: Boolean,
      default: true
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
        enableAudio: props.enableAudio,
        autoAcceptREC: false,
        enableQueueManagement: true,
        showRECModal: false
      }
    )

    // Keep call manager audio setting in sync with prop
    watch(() => props.enableAudio, (val) => {
      callManager.setEnableAudio?.(val)
    }, { immediate: true })
    
    // Override REC notification handling for admin users (REQ-004)
    // Admins should receive audio notification only, no modal or auto-join
    watch(() => socketRef.value, (socket) => {
      if (socket) {


        // Admin-specific group call update listeners
        socket.off('adminGroupCallUpdate')
        socket.on('adminGroupCallUpdate', (data) => {
          console.log('adminGroupCallUpdate received:', data)
          try {
            if (Array.isArray(data)) {
              // Normalize into map keyed by call id or groupId
              const map = {}
              data.forEach(item => {
                const key = item.id || item.groupId || item.callId
                if (key) map[key] = item
              })
              gameState.value.groupCalls = map
            } else if (data && typeof data === 'object') {
              gameState.value.groupCalls = data
            }
          } catch (err) {
            console.error('Failed to process adminGroupCallUpdate:', err)
          }
        })

        socket.off('adminGroupCallError')
        socket.on('adminGroupCallError', (err) => {
          console.error('adminGroupCallError received:', err)
          props.showError('Admin Group Call Error', err?.message || err || 'Unknown error')
        })
      }
    }, { immediate: true })
    
    // Group call management methods (centralized via callManager)
    const getAdminPhoneId = () => {
      const keys = Object.keys(myPhones.value || {})
      return keys[0] || null
    }

    const joinGroupCall = async (groupId) => {
      console.log('Admin joining group call (via callManager):', groupId)
      const phoneId = getAdminPhoneId()
      if (!phoneId) {
        props.showError('Join Failed', 'No admin phone available to join the call')
        return
      }
      const ok = await callManager.joinGroupCall(groupId, phoneId)
      if (!ok) props.showError('Join Failed', 'Failed to join group call')
    }

    const leaveGroupCall = async (groupId) => {
      console.log('Admin leaving group call (via callManager):', groupId)
      const phoneId = getAdminPhoneId()
      if (!phoneId) {
        props.showError('Leave Failed', 'No admin phone available to leave the call')
        return
      }
      const ok = await callManager.leaveGroupCall(phoneId)
      if (!ok) props.showError('Leave Failed', 'Failed to leave group call')
    }

    const forceTerminateCall = async (groupId) => {
      console.log('Admin force terminating group call:', groupId)
      if (!socketRef.value) {
        props.showError('Force Terminate Failed', 'Socket not available')
        return
      }

      socketRef.value.emit('forceTerminateGroupCall', { groupId }, (resp) => {
        if (resp && (resp.success || resp === true)) {
          props.showSuccess('Force Terminated', `Group ${groupId} has been force terminated`)
          // Refresh admin group call list
          callManager.requestGroupCallUpdate()
        } else {
          props.showError('Force Terminate Failed', resp?.error || resp?.message || 'Unknown error')
        }
      })
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
    
    // Clean up admin-specific listeners
    if (this.socket) {
      this.socket.off('adminGroupCallUpdate')
      this.socket.off('adminGroupCallError')
    }
  }
}
</script>
