<template>
  <div class="call-display">
    <!-- Call Queue Section -->
    <div v-if="showQueue && calls.length > 0" class="call-queue mb-6">
      <h3 v-if="title" class="text-lg font-medium text-gray-900 mb-4">
        {{ title }}
        <span v-if="showCount" class="ml-2 text-sm text-gray-500">({{ calls.length }} calls)</span>
      </h3>
      
      <!-- Table View (Admin Style) -->
      <div v-if="displayMode === 'table'" class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">From</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">To</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th v-if="showActions" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="call in calls" :key="call.id" class="hover:bg-gray-50">
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                {{ call.sender?.name || 'Unknown' }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {{ call.receivers?.[0]?.name || 'Unknown' }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                <span :class="['px-2 inline-flex text-xs leading-5 font-semibold rounded-full', getCallTypeClass(call)]">
                  {{ call.type }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                <span :class="['px-2 inline-flex text-xs leading-5 font-semibold rounded-full', getCallLevelClass(call)]">
                  {{ call.level }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                <span :class="['px-2 inline-flex text-xs leading-5 font-semibold rounded-full', getCallStatusClass(call)]">
                  {{ call.status }}
                </span>
              </td>
              <td v-if="showActions" class="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                <CallActionButtons 
                  :call="call" 
                  :compact="true"
                  @accept="$emit('acceptCall', call.id)"
                  @reject="$emit('rejectCall', call.id)"
                  @leave="$emit('leaveCall', call.id)"
                  @end="$emit('endCall', call.id)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <!-- List View (Client Style) -->
      <div v-else-if="displayMode === 'list'" class="space-y-2">
        <div 
          v-for="call in calls" 
          :key="call.id"
          class="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
          :class="[getCallPriorityClass(call), { 'ring-2 ring-blue-500': selectedCall?.id === call.id }]"
          @click="$emit('selectCall', call)"
        >
          <div class="flex-1">
            <div class="flex items-center space-x-2">
              <span class="font-medium">{{ call.type }}</span>
              <span class="text-sm">{{ call.sender?.name || 'Unknown' }}</span>
              <span class="text-sm">→</span>
              <span class="text-sm">{{ call.receivers?.[0]?.name || 'Unknown' }}</span>
            </div>
            <div class="flex items-center space-x-2 mt-1">
              <span :class="['px-2 py-1 text-xs font-semibold rounded-full', getCallLevelClass(call)]">
                {{ call.level }}
              </span>
              <span :class="['px-2 py-1 text-xs font-semibold rounded-full', getCallStatusClass(call)]">
                {{ call.status }}
              </span>
            </div>
          </div>
          <div v-if="showActions" class="flex-shrink-0">
            <CallActionButtons 
              :call="call" 
              :compact="false"
              @accept="$emit('acceptCall', call.id)"
              @reject="$emit('rejectCall', call.id)"
              @leave="$emit('leaveCall', call.id)"
              @end="$emit('endCall', call.id)"
            />
          </div>
        </div>
      </div>
      
      <!-- Grid View (Client Incoming Calls Style) -->
      <div v-else-if="displayMode === 'grid'" class="space-y-1">
        <div 
          v-for="call in calls" 
          :key="call.id"
          class="grid grid-cols-4 w-full text-center text-xl py-4 border-y border-zinc-400 cursor-pointer hover:opacity-80 transition-opacity"
          :class="getCallPriorityClass(call)"
          @click="$emit('selectCall', call)"
        >
          <div>{{ call.type }}</div>
          <div>{{ call.sender?.name || 'Unknown' }}</div>
          <div>{{ call.receivers?.[0]?.name || 'Unknown' }}</div>
          <div>
            <button 
              @click.stop="$emit('rejectCall', call.id)"
              class="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Reject
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Empty State -->
    <div 
      v-else-if="showEmpty && (!calls || calls.length === 0)"
      class="text-center py-8 text-gray-500"
    >
      <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
      </svg>
      <h3 class="mt-2 text-sm font-medium text-gray-900">{{ emptyTitle || 'No active calls' }}</h3>
      <p class="mt-1 text-sm text-gray-500">{{ emptyMessage || 'There are currently no calls in the queue.' }}</p>
    </div>
  </div>
</template>

<script>
import { PreparedCall } from '~/models/PreparedCall'
import { CallDetails } from '~/models/CallDetails'
import CallActionButtons from './CallActionButtons.vue'

export default {
  name: 'CallDisplay',
  components: {
    CallActionButtons
  },
  props: {
    calls: {
      type: Array,
      default: () => []
    },
    selectedCall: {
      type: Object,
      default: null
    },
    displayMode: {
      type: String,
      default: 'table', // 'table', 'list', 'grid'
      validator: value => ['table', 'list', 'grid'].includes(value)
    },
    title: {
      type: String,
      default: ''
    },
    showQueue: {
      type: Boolean,
      default: true
    },
    showCount: {
      type: Boolean,
      default: true
    },
    showActions: {
      type: Boolean,
      default: true
    },
    showEmpty: {
      type: Boolean,
      default: true
    },
    emptyTitle: {
      type: String,
      default: ''
    },
    emptyMessage: {
      type: String,
      default: ''
    }
  },
  emits: [
    'selectCall',
    'acceptCall',
    'rejectCall',
    'leaveCall',
    'endCall'
  ],
  methods: {
    getCallTypeClass(call) {
      switch (call.type) {
        case PreparedCall.TYPES.REC:
          return 'bg-red-100 text-red-800'
        case PreparedCall.TYPES.GROUP:
          return 'bg-purple-100 text-purple-800'
        case PreparedCall.TYPES.P2P:
        default:
          return 'bg-blue-100 text-blue-800'
      }
    },
    
    getCallLevelClass(call) {
      switch (call.level) {
        case PreparedCall.LEVELS.EMERGENCY:
          return 'bg-red-100 text-red-800'
        case PreparedCall.LEVELS.URGENT:
          return 'bg-yellow-100 text-yellow-800'
        case PreparedCall.LEVELS.NORMAL:
        default:
          return 'bg-blue-100 text-blue-800'
      }
    },
    
    getCallStatusClass(call) {
      const offered = PreparedCall.STATUS.OFFERED || CallDetails.STATUS.OFFERED
      const accepted = PreparedCall.STATUS.ACCEPTED || CallDetails.STATUS.ACCEPTED
      const rejected = PreparedCall.STATUS.REJECTED || CallDetails.STATUS.REJECTED
      const ended = PreparedCall.STATUS.ENDED || CallDetails.STATUS.ENDED
      
      switch (call.status) {
        case offered:
          return 'bg-yellow-100 text-yellow-800'
        case accepted:
          return 'bg-green-100 text-green-800'
        case rejected:
          return 'bg-red-100 text-red-800'
        case ended:
          return 'bg-gray-100 text-gray-800'
        default:
          return 'bg-gray-100 text-gray-800'
      }
    },
    
    getCallPriorityClass(call) {
      switch (call.level) {
        case 'emergency':
          return 'bg-red-600 text-white border-red-700'
        case 'urgent':
          return 'bg-yellow-400 text-black border-yellow-500'
        case 'normal':
        default:
          return 'bg-zinc-200 text-black border-zinc-400'
      }
    }
  }
}
</script>

<style scoped>
.call-display {
  width: 100%;
}
</style>
