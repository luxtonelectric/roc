<template>
  <div class="bg-red-50 border-2 border-red-300 rounded-lg p-4">
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center space-x-3">
        <div class="w-6 h-6 bg-red-600 rounded-full flex items-center justify-center">
          <span class="text-white font-bold text-sm">!</span>
        </div>
        <h2 class="text-xl font-bold text-red-800">Railway Emergency Call</h2>
        <div class="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
      </div>
      
      <!-- Call Duration -->
      <div class="text-right">
        <div class="text-sm text-gray-600">Duration</div>
        <div class="text-lg font-mono font-bold text-red-700">{{ formattedDuration }}</div>
      </div>
    </div>

    <!-- Call Information -->
    <div class="mb-4">
      <div class="bg-white rounded-lg p-3 border border-red-200">
        <div class="text-sm text-gray-600 mb-1">Initiated by:</div>
        <div class="text-lg font-semibold text-red-800">{{ callerInfo?.name || 'Unknown' }}</div>
        <div class="text-sm text-gray-500">{{ callerInfo?.location || '' }}</div>
      </div>
    </div>

    <!-- Participants -->
    <div class="mb-4" v-if="participants && participants.length > 0">
      <div class="text-sm text-gray-600 mb-2">Participants ({{ participants.length }}):</div>
      <div class="bg-white rounded-lg p-3 border border-red-200 max-h-24 overflow-y-auto">
        <div 
          v-for="participant in participants" 
          :key="participant.id"
          class="flex items-center justify-between py-1"
        >
          <span class="text-sm">{{ participant.name }}</span>
          <span 
            class="text-xs px-2 py-1 rounded"
            :class="participant.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'"
          >
            {{ participant.status }}
          </span>
        </div>
      </div>
    </div>

    <!-- Control Buttons -->
    <div class="flex space-x-3">
      <!-- Drop Out Button -->
      <button
        @click="dropOut"
        :disabled="isLeaving"
        class="flex-1 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg border-2 border-yellow-600 hover:border-yellow-700 disabled:border-gray-500 transition-colors duration-200 shadow-sm"
        :class="{ 'opacity-50 cursor-not-allowed': isLeaving }"
      >
        <div class="flex items-center justify-center space-x-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
          </svg>
          <span>{{ isLeaving ? 'Leaving...' : 'Drop Out' }}</span>
        </div>
      </button>

      <!-- End Call for All Button -->
      <button
        v-if="props.allowEnd"
        @click="confirmEndCall"
        :disabled="isEnding"
        class="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg border-2 border-red-700 hover:border-red-800 disabled:border-gray-500 transition-colors duration-200 shadow-sm"
        :class="{ 'opacity-50 cursor-not-allowed': isEnding }"
      >
        <div class="flex items-center justify-center space-x-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
          <span>{{ isEnding ? 'Ending...' : 'End for All' }}</span>
        </div>
      </button>
    </div>

    <!-- Confirmation Dialog -->
    <div 
      v-if="showConfirmDialog" 
      class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      @click.self="cancelEndCall"
    >
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 border-4 border-red-600">
        <div class="bg-red-600 text-white p-4 rounded-t-lg">
          <h3 class="text-lg font-bold">Confirm End Emergency Call</h3>
        </div>
        <div class="p-6">
          <p class="text-gray-700 mb-4">
            Are you sure you want to end the Railway Emergency Call for all participants?
          </p>
          <p class="text-sm text-red-600 font-semibold mb-6">
            This action cannot be undone and will disconnect all participants.
          </p>
          <div class="flex space-x-3">
            <button
              @click="cancelEndCall"
              class="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              @click="endCallForAll"
              class="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded transition-colors duration-200"
            >
              End Call
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

interface CallerInfo {
  name: string
  location?: string
  id: string
}

interface Participant {
  id: string
  name: string
  status: 'active' | 'inactive' | 'joined' | 'left'
}

interface Props {
  callerInfo?: CallerInfo
  participants?: Participant[]
  startTime?: Date
  callId?: string
  allowEnd?: boolean
}

interface Emits {
  (e: 'dropOut'): void
  (e: 'endCall'): void
}

const props = withDefaults(defineProps<Props>(), {
  allowEnd: false
})
const emit = defineEmits<Emits>()

const currentTime = ref(new Date())
const isLeaving = ref(false)
const isEnding = ref(false)
const showConfirmDialog = ref(false)

// Update current time every second for duration calculation
let timeInterval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  timeInterval = setInterval(() => {
    currentTime.value = new Date()
  }, 1000)
})

onUnmounted(() => {
  if (timeInterval) {
    clearInterval(timeInterval)
  }
})

// Calculate call duration
const formattedDuration = computed(() => {
  if (!props.startTime) return '00:00'
  
  const duration = Math.floor((currentTime.value.getTime() - props.startTime.getTime()) / 1000)
  const minutes = Math.floor(duration / 60)
  const seconds = duration % 60
  
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
})

// Control methods
const dropOut = async () => {
  if (isLeaving.value) return
  
  isLeaving.value = true
  try {
    emit('dropOut')
  } finally {
    // Reset after a delay to prevent rapid clicking
    setTimeout(() => {
      isLeaving.value = false
    }, 2000)
  }
}

const confirmEndCall = () => {
  showConfirmDialog.value = true
}

const cancelEndCall = () => {
  showConfirmDialog.value = false
}

const endCallForAll = async () => {
  if (isEnding.value) return
  
  isEnding.value = true
  showConfirmDialog.value = false
  
  try {
    emit('endCall')
  } finally {
    // Reset after a delay
    setTimeout(() => {
      isEnding.value = false
    }, 2000)
  }
}
</script>

<style scoped>
/* Ensure confirmation dialog stays on top */
.fixed {
  z-index: 9999;
}

/* Custom scrollbar for participants list */
.overflow-y-auto::-webkit-scrollbar {
  width: 4px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 2px;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background: #dc2626;
  border-radius: 2px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: #b91c1c;
}
</style>
