<template>
  <div class="call-status">
    <!-- Current Call Status Display -->
    <div class="flex items-center space-x-2">
      <span 
        :class="[
          'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
          statusClass
        ]"
      >
        <div v-if="isLoading" class="animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-1"></div>
        {{ statusText }}
      </span>
      
      <!-- Call Count Badge -->
      <span 
        v-if="showCount && queuedCallsCount > 0"
        :class="[
          'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
          queuedCallsCount > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
        ]"
      >
        {{ queuedCallsCount }} {{ queuedCallsCount === 1 ? 'call' : 'calls' }}
      </span>
    </div>
    
    <!-- Detailed Call Information -->
    <div v-if="showDetails && currentCall" class="mt-2 text-sm text-gray-600">
      <div class="flex items-center space-x-2">
        <span class="font-medium">Call ID:</span>
        <span class="font-mono text-xs">{{ currentCall.id }}</span>
      </div>
      <div v-if="currentCall.timePlaced" class="flex items-center space-x-2 mt-1">
        <span class="font-medium">Duration:</span>
        <span>{{ formatCallDuration(currentCall.timePlaced) }}</span>
      </div>
      <div v-if="currentCall.level" class="flex items-center space-x-2 mt-1">
        <span class="font-medium">Priority:</span>
        <span 
          :class="[
            'px-2 py-1 text-xs font-semibold rounded-full',
            getCallLevelClass(currentCall)
          ]"
        >
          {{ currentCall.level.toUpperCase() }}
        </span>
      </div>
    </div>
  </div>
</template>

<script>
import { PreparedCall } from '~/models/PreparedCall'

export default {
  name: 'CallStatus',
  props: {
    currentCall: {
      type: Object,
      default: null
    },
    inCall: {
      type: Boolean,
      default: false
    },
    incomingCall: {
      type: Boolean,
      default: false
    },
    queuedCallsCount: {
      type: Number,
      default: 0
    },
    isLoading: {
      type: Boolean,
      default: false
    },
    showCount: {
      type: Boolean,
      default: true
    },
    showDetails: {
      type: Boolean,
      default: false
    },
    customStatus: {
      type: String,
      default: ''
    }
  },
  computed: {
    statusText() {
      if (this.customStatus) return this.customStatus
      
      if (!this.currentCall) return 'No active call'
      
      if (this.inCall) {
        const senderName = this.currentCall.sender?.name || 'Unknown'
        const receiverName = this.currentCall.receivers?.[0]?.name || 'Unknown'
        return `In call: ${senderName} ↔ ${receiverName}`
      }
      
      if (this.incomingCall) {
        const senderName = this.currentCall.sender?.name || 'Unknown'
        const receiverName = this.currentCall.receivers?.[0]?.name || 'Unknown'
        return `Incoming call: ${senderName} → ${receiverName}`
      }
      
      return `Call status: ${this.currentCall.status}`
    },
    
    statusClass() {
      if (this.isLoading) return 'bg-blue-100 text-blue-800'
      
      if (this.inCall) return 'bg-green-100 text-green-800'
      
      if (this.incomingCall) {
        // Check call priority for incoming calls
        if (this.currentCall?.level === 'emergency') {
          return 'bg-red-100 text-red-800 animate-pulse'
        } else if (this.currentCall?.level === 'urgent') {
          return 'bg-yellow-100 text-yellow-800 animate-pulse'
        }
        return 'bg-yellow-100 text-yellow-800'
      }
      
      if (this.queuedCallsCount > 0) return 'bg-blue-100 text-blue-800'
      
      return 'bg-gray-100 text-gray-600'
    }
  },
  methods: {
    formatCallDuration(timePlaced) {
      if (!timePlaced) return '00:00'
      
      const now = Date.now()
      const duration = Math.floor((now - timePlaced) / 1000)
      
      const minutes = Math.floor(duration / 60)
      const seconds = duration % 60
      
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
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
    }
  }
}
</script>

<style scoped>
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: .7;
  }
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
