<template>
  <div 
    v-if="isVisible" 
    class="fixed inset-0 z-50 flex items-center justify-center bg-red-900 bg-opacity-95 backdrop-blur-sm"
    @click.self="handleBackgroundClick"
  >
    <div class="bg-white rounded-lg shadow-2xl max-w-2xl w-full mx-4 border-8 border-red-600">
      <!-- Header -->
      <div class="bg-red-600 text-white p-6 rounded-t-lg">
        <div class="flex items-center justify-center space-x-3">
          <div class="w-8 h-8 bg-white rounded-full flex items-center justify-center">
            <span class="text-red-600 font-bold text-xl">!</span>
          </div>
          <h1 class="text-3xl font-bold uppercase tracking-wide">Railway Emergency Call</h1>
          <div class="w-8 h-8 bg-white rounded-full flex items-center justify-center">
            <span class="text-red-600 font-bold text-xl">!</span>
          </div>
        </div>
      </div>

      <!-- Content -->
      <div class="p-8 text-center">
        <!-- Caller Information -->
        <div class="mb-6">
          <h2 class="text-xl font-semibold text-gray-800 mb-2">Emergency Call From:</h2>
          <div class="bg-gray-100 rounded-lg p-4 border-2 border-gray-300">
            <p class="text-2xl font-bold text-red-700">{{ callerInfo?.name || 'Unknown Caller' }}</p>
            <p class="text-sm text-gray-600">{{ callerInfo?.location || 'Unknown Location' }}</p>
          </div>
        </div>

        <!-- Countdown Timer (only for recipients, not senders) -->
        <div v-if="initialCountdown > 0" class="mb-8">
          <div class="bg-red-100 rounded-lg p-6 border-2 border-red-300">
            <p class="text-lg font-semibold text-red-800 mb-2">Auto-joining in:</p>
            <div class="text-6xl font-bold text-red-600 mb-2">{{ countdownSeconds }}</div>
            <div class="w-full bg-red-200 rounded-full h-4 mb-4">
              <div 
                class="bg-red-600 h-4 rounded-full transition-all duration-1000 ease-linear"
                :style="{ width: `${(countdownSeconds / initialCountdown) * 100}%` }"
              ></div>
            </div>
            <p class="text-sm text-red-700">
              You will automatically join this emergency call unless you decline
            </p>
          </div>
        </div>

        <!-- Sender Message (for call initiators) -->
        <div v-else class="mb-8">
          <div class="bg-blue-100 rounded-lg p-6 border-2 border-blue-300">
            <p class="text-lg font-semibold text-blue-800 mb-2">Emergency Call Status:</p>
            <p class="text-xl text-blue-700">
              REC call initiated - waiting for responders
            </p>
            <p class="text-sm text-blue-600 mt-2">
              You have initiated an emergency call. Other operators will be notified.
            </p>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex space-x-4 justify-center">
          <button
            @click="acceptCall"
            :disabled="props.isAccepting"
            class="bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-8 rounded-lg text-xl border-2 border-green-700 transition-colors duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ props.isAccepting ? (initialCountdown > 0 ? 'Joining...' : 'Processing...') : (initialCountdown > 0 ? 'Join Now' : 'Continue') }}
          </button>
          <button
            v-if="allowDecline"
            @click="declineCall"
            :disabled="props.isAccepting"
            class="bg-gray-600 hover:bg-gray-700 text-white font-bold py-4 px-8 rounded-lg text-xl border-2 border-gray-700 transition-colors duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ initialCountdown > 0 ? 'Decline' : 'Cancel Call' }}
          </button>
        </div>

        <!-- Warning Text -->
        <div class="mt-6 text-sm text-gray-600">
          <p class="font-semibold">This is a Railway Emergency Call</p>
          <p>Your current call will be terminated automatically if you join</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

interface CallerInfo {
  name: string
  location?: string
  id: string
}

interface Props {
  isVisible: boolean
  callerInfo?: CallerInfo
  initialCountdown?: number
  allowDecline?: boolean
  isAccepting?: boolean
}

interface Emits {
  (e: 'accept'): void
  (e: 'decline'): void
  (e: 'timeout'): void
  (e: 'close'): void
}

const props = withDefaults(defineProps<Props>(), {
  initialCountdown: 5,
  allowDecline: true,
  isAccepting: false
})

const emit = defineEmits<Emits>()

const countdownSeconds = ref(props.initialCountdown)
let countdownInterval: ReturnType<typeof setInterval> | null = null

// Define functions first before watch uses them
const stopCountdown = () => {
  if (countdownInterval) {
    clearInterval(countdownInterval)
    countdownInterval = null
  }
}

const startCountdown = () => {
  countdownSeconds.value = props.initialCountdown
  stopCountdown() // Clear any existing interval
  
  // Only start countdown if initialCountdown > 0
  if (props.initialCountdown > 0) {
    countdownInterval = setInterval(() => {
      countdownSeconds.value--
      
      if (countdownSeconds.value <= 0) {
        stopCountdown()
        emit('timeout')
      }
    }, 1000)
  }
}

// Start countdown when modal becomes visible
watch(
  () => props.isVisible,
  (isVisible) => {
    if (isVisible) {
      startCountdown()
    } else {
      stopCountdown()
    }
  },
  { immediate: true }
)

const acceptCall = () => {
  stopCountdown()
  emit('accept')
}

const declineCall = () => {
  if (!props.allowDecline) return
  stopCountdown()
  emit('decline')
}

const handleBackgroundClick = () => {
  // Prevent closing by clicking background for emergency calls
  // Only emit close if decline is allowed
  if (props.allowDecline) {
    emit('close')
  }
}

// Prevent escape key from closing during emergency
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && props.allowDecline) {
    declineCall()
  }
  // Block other keys during emergency
  if (props.isVisible && !props.allowDecline) {
    event.preventDefault()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  stopCountdown()
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
/* Ensure modal stays on top of everything */
.fixed {
  z-index: 9999;
}

/* Pulsing animation for emergency state */
@keyframes pulse-red {
  0%, 100% {
    background-color: rgb(220 38 38);
  }
  50% {
    background-color: rgb(185 28 28);
  }
}

.animate-pulse-red {
  animation: pulse-red 1s infinite;
}
</style>
