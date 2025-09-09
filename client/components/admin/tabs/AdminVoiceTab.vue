<template>
  <div class="my-4">
    <div class="bg-white shadow-sm rounded-lg overflow-hidden">
      <div class="border-b border-gray-200 bg-gray-50 px-4 py-4 sm:px-6">
        <h1 class="text-3xl font-bold text-gray-900">Voice Calls</h1>
        <!-- Current Call Status -->
        <div class="mt-2">
          <span 
            :class="[
              'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
              inCall ? 'bg-green-100 text-green-800' : 
              incomingCall ? 'bg-yellow-100 text-yellow-800' : 
              'bg-gray-100 text-gray-600'
            ]"
          >
            {{ currentCallStatus }}
          </span>
        </div>
      </div>
      
      <div class="px-4 py-5 sm:p-6">
        <!-- Phone Queues Section -->
        <div v-for="(phone, key) in myPhones" :key="key" class="mb-8 last:mb-0">
          <div v-if="phone.queue && phone.queue.length > 0">
            <h3 class="text-lg font-medium text-gray-900 mb-4">
              {{ phone.name || key }}
              <span class="ml-2 text-sm text-gray-500">({{ phone.queue.length }} calls in queue)</span>
            </h3>
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">From</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  <tr v-for="call in phone.queue" :key="call.id">
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {{ call.sender?.name || 'Unknown' }}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span :class="[
                        'px-2 inline-flex text-xs leading-5 font-semibold rounded-full',
                        call.type === PreparedCall.TYPES.REC ? 'bg-red-100 text-red-800' :
                        call.type === PreparedCall.TYPES.GROUP ? 'bg-purple-100 text-purple-800' :
                        'bg-blue-100 text-blue-800'
                      ]">
                        {{ call.type }}
                      </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span :class="[
                        'px-2 inline-flex text-xs leading-5 font-semibold rounded-full',
                        call.level === PreparedCall.LEVELS.EMERGENCY ? 'bg-red-100 text-red-800' :
                        call.level === PreparedCall.LEVELS.URGENT ? 'bg-yellow-100 text-yellow-800' :
                        'bg-blue-100 text-blue-800'
                      ]">
                        {{ call.level }}
                      </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span :class="[
                        'px-2 inline-flex text-xs leading-5 font-semibold rounded-full',
                        call.status === PreparedCall.STATUS.OFFERED ? 'bg-yellow-100 text-yellow-800' :
                        call.status === PreparedCall.STATUS.ACCEPTED ? 'bg-green-100 text-green-800' :
                        call.status === PreparedCall.STATUS.REJECTED ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      ]">
                        {{ call.status }}
                      </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button 
                        v-if="call.status === PreparedCall.STATUS.OFFERED"
                        @click="acceptCall(call.id)"
                        class="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                      >
                        Accept
                      </button>
                      <button 
                        v-if="call.status === PreparedCall.STATUS.OFFERED"
                        @click="rejectCall(call.id)"
                        class="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      >
                        Reject
                      </button>
                      <button 
                        v-if="call.status === PreparedCall.STATUS.ACCEPTED"
                        @click="leaveCall(call.id)"
                        class="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      >
                        Leave
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Active Private Calls Section -->
        <div v-if="Object.keys(gameState.privateCalls || {}).length > 0" class="mt-8">
          <h3 class="text-lg font-medium text-gray-900 mb-4">Active Private Calls</h3>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Call ID</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Participants</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-for="(call, key) in gameState.privateCalls" :key="key" class="hover:bg-gray-50">
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {{ call.id || key }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {{ call.participants?.join(', ') || 'Unknown' }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span :class="[
                      'px-2 inline-flex text-xs leading-5 font-semibold rounded-full',
                      call.type === PreparedCall.TYPES.REC ? 'bg-red-100 text-red-800' :
                      call.type === PreparedCall.TYPES.GROUP ? 'bg-purple-100 text-purple-800' :
                      'bg-blue-100 text-blue-800'
                    ]">
                      {{ call.type || 'P2P' }}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span :class="[
                      'px-2 inline-flex text-xs leading-5 font-semibold rounded-full',
                      call.status === 'active' ? 'bg-green-100 text-green-800' :
                      call.status === 'ended' ? 'bg-gray-100 text-gray-800' :
                      'bg-yellow-100 text-yellow-800'
                    ]">
                      {{ call.status || 'active' }}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button 
                      @click="endCall(call.id || key)"
                      class="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      End Call
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- No Active Calls Message -->
        <div 
          v-if="!Object.keys(gameState.privateCalls || {}).length && !Object.values(myPhones).some(phone => phone.queue?.length)"
          class="text-center py-8 text-gray-500"
        >
          <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
          <h3 class="mt-2 text-sm font-medium text-gray-900">No active calls</h3>
          <p class="mt-1 text-sm text-gray-500">There are currently no active calls or calls in queue.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { toRefs } from 'vue'
import { PreparedCall } from '~/models/PreparedCall'
import { useVoiceCallManagement } from '~/composables/useVoiceCallManagement'

export default {
  name: 'AdminVoiceTab',
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
    
    const voiceCallManagement = useVoiceCallManagement(
      props.socket,
      gameState,
      myPhones,
      props.showError,
      props.showSuccess
    )
    
    return {
      PreparedCall, // Make PreparedCall available in template
      ...voiceCallManagement
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
