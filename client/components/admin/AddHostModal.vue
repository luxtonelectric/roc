<template>
  <div 
    v-if="isVisible" 
    class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm"
    @click.self="handleBackgroundClick"
  >
    <div class="bg-white rounded-lg shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
      <!-- Header -->
      <div class="bg-indigo-600 text-white p-6 rounded-t-lg">
        <div class="flex items-center justify-between">
          <h1 class="text-2xl font-bold">{{ formMode === 'add' ? 'Add New Host' : 'Edit Host' }}</h1>
          <button 
            @click="closeModal"
            class="text-white hover:text-gray-200 text-2xl font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-indigo-700 transition-colors"
          >
            ×
          </button>
        </div>
      </div>

      <!-- Content -->
      <div class="p-6">
        <form @submit.prevent="handleSubmit">
          <div class="grid grid-cols-1 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700">Simulation</label>
              <select v-model="localNewHost.sim" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                <option value="">Select a simulation</option>
                <option v-for="sim in availableSimulations" :key="sim.id" :value="sim.id">
                  {{ sim.name }}
                </option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Host URL/IP</label>
              <input v-model="localNewHost.host" required type="text" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" placeholder="e.g., localhost or 192.168.1.100"/>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Host Port</label>
              <input 
                v-model="localNewHost.port" 
                required 
                type="number" 
                min="1" 
                max="65535" 
                step="1"
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                placeholder="e.g., 51515"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Voice Channel</label>
              <select v-model="localNewHost.channel" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                <option value="">{{ hasVoiceChannels ? 'Select a voice channel' : 'Loading channels...' }}</option>
                <option v-for="channel in availableChannels" :key="channel.id" :value="channel.name">
                  {{ channel.name }}
                </option>
              </select>
              <div v-if="!hasVoiceChannels" class="mt-1 text-sm text-gray-500">
                Waiting for voice channels to load...
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Interface Gateway Port</label>
              <input 
                v-model="localNewHost.interfaceGateway.port" 
                required 
                type="number" 
                min="1" 
                max="65535" 
                step="1"
                pattern="[0-9]+"
                @input="handleValidatePortInput"
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                placeholder="e.g., 51515"
              />
            </div>
            <!-- Interface Gateway Authentication (Optional) -->
            <div class="mt-4 p-4 border border-gray-200 rounded-md bg-gray-50">
              <h3 class="text-sm font-medium text-gray-700 mb-3">Interface Gateway Authentication (Optional)</h3>
              <div class="grid grid-cols-1 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700">Username</label>
                  <input 
                    v-model="localNewHost.interfaceGateway.username" 
                    type="text" 
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    placeholder="Optional username for STOMP authentication"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700">Password</label>
                  <input 
                    v-model="localNewHost.interfaceGateway.password" 
                    type="password" 
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    :placeholder="formMode === 'edit' && localNewHost.interfaceGateway.hasPassword ? 'Leave blank to keep existing password' : 'Optional password for STOMP authentication'"
                  />
                  <div v-if="formMode === 'edit' && localNewHost.interfaceGateway.hasPassword" class="mt-1 text-sm text-gray-500">
                    Current password is set. Enter new password to change it, or leave blank to keep existing.
                  </div>
                </div>
                <div v-if="localNewHost.interfaceGateway.password" class="grid grid-cols-1 gap-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700">Confirm Password</label>
                    <input 
                      v-model="localPasswordConfirmation" 
                      type="password" 
                      class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      placeholder="Confirm the password"
                    />
                    <div v-if="localNewHost.interfaceGateway.password && localPasswordConfirmation && localNewHost.interfaceGateway.password !== localPasswordConfirmation" class="mt-1 text-sm text-red-600">
                      Passwords do not match
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
            <button 
              type="button" 
              @click="closeModal" 
              class="inline-flex justify-center rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              class="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              {{ formMode === 'add' ? 'Add Host' : 'Update Host' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, watch } from 'vue'

export default {
  name: 'AddHostModal',
  props: {
    isVisible: {
      type: Boolean,
      default: false
    },
    formMode: {
      type: String,
      default: 'add'
    },
    newHost: {
      type: Object,
      required: true
    },
    passwordConfirmation: {
      type: String,
      default: ''
    },
    availableSimulations: {
      type: Array,
      required: true
    },
    availableChannels: {
      type: Array,
      required: true
    },
    validatePortInput: {
      type: Function,
      required: true
    },
    submitHostForm: {
      type: Function,
      required: true
    }
  },
  emits: ['close', 'update:newHost', 'update:passwordConfirmation'],
  setup(props, { emit }) {
    // Create local reactive copies of the props
    const localNewHost = ref({ ...props.newHost })
    const localPasswordConfirmation = ref(props.passwordConfirmation)

    // Watch for changes to props and update local copies
    watch(() => props.newHost, (newValue) => {
      localNewHost.value = { ...newValue }
    }, { deep: true })

    watch(() => props.passwordConfirmation, (newValue) => {
      localPasswordConfirmation.value = newValue
    })

    // Watch local copies and emit updates
    watch(localNewHost, (newValue) => {
      emit('update:newHost', newValue)
    }, { deep: true })

    watch(localPasswordConfirmation, (newValue) => {
      emit('update:passwordConfirmation', newValue)
    })

    return {
      localNewHost,
      localPasswordConfirmation
    }
  },
  computed: {
    hasVoiceChannels() {
      return this.availableChannels && this.availableChannels.length > 0
    }
  },
  methods: {
    closeModal() {
      this.$emit('close')
    },
    handleBackgroundClick() {
      this.closeModal()
    },
    handleValidatePortInput(event) {
      this.validatePortInput(event)
    },
    handleSubmit() {
      // Ensure all emitted values are current before submitting
      this.$emit('update:newHost', this.localNewHost)
      this.$emit('update:passwordConfirmation', this.localPasswordConfirmation)
      // Call the actual submit function (which will work with the parent's reactive data)
      this.$nextTick(() => {
        this.submitHostForm()
      })
    }
  }
}
</script>

<style scoped>
/* Custom scrollbar for modal content */
.max-h-\[90vh\]::-webkit-scrollbar {
  width: 6px;
}

.max-h-\[90vh\]::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.max-h-\[90vh\]::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 3px;
}

.max-h-\[90vh\]::-webkit-scrollbar-thumb:hover {
  background: #555;
}
</style>