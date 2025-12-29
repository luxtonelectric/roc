<template>
  <div class="my-1">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-3xl font-bold">Hosts</h1>
      <button 
        @click="openAddHostModal"
        class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-sm"
      >
        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
        </svg>
        Add New Host
      </button>
    </div>

    <!-- Add Host Modal -->
    <AddHostModal
      :isVisible="isModalVisible"
      :formMode="formMode"
      v-model:newHost="newHost"
      v-model:passwordConfirmation="passwordConfirmation"
      :availableSimulations="availableSimulations"
      :availableChannels="availableChannels"
      :validatePortInput="validatePortInput"
      :submitHostForm="submitHostForm"
      @close="closeModal"
    />

    <template v-if="gameState.hostState">
      <div class="overflow-x-auto">
        <table class="min-w-full table-auto">
          <thead>
            <tr>
              <th colspan="5" class="px-4 py-2 border">Host</th>
              <th colspan="3" class="px-4 py-2 border">Interface Gateway</th>
            </tr>
            <tr>
              <th class="px-4 py-2 border">Simulation</th>
              <th class="px-4 py-2 border">URL/IP</th>
              <th class="px-4 py-2 border">Port</th>
              <th class="px-4 py-2 border">Voice Channel</th>
              <th class="px-4 py-2 border">Host State</th>
              <th class="px-4 py-2 border">IG Port</th>
              <th class="px-4 py-2 border">Status</th>
              <th class="px-4 py-2 border">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="host in gameState.hostState" :key="host.sim">
            <td>{{ host.sim }}</td>
            <td>{{ host.host }}</td>
            <td>{{ host.port || 'Not Set' }}</td>
            <td>{{ host.channel }}</td>
            <td>
              <button 
                :class="[
                  'inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium',
                  host.enabled 
                    ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                    : 'bg-red-100 text-red-800 hover:bg-red-200'
                ]"
                @click="toggleHost(host)"
              >
                {{ host.enabled ? 'Enabled' : 'Disabled' }}
              </button>
            </td>
            <td>{{ host.interfaceGateway.port }}</td>
            <td>
              <div class="flex flex-col">
                <span 
                  :class="[
                    'inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium',
                    {
                      'bg-green-100 text-green-800': host.interfaceGateway.connectionState === 'connected',
                      'bg-yellow-100 text-yellow-800': host.interfaceGateway.connectionState === 'connecting',
                      'bg-gray-100 text-gray-800': host.interfaceGateway.connectionState === 'disconnected',
                      'bg-red-100 text-red-800': host.interfaceGateway.connectionState === 'error'
                    }
                  ]"
                >
                  {{ host.interfaceGateway.connectionState?.charAt(0).toUpperCase() + host.interfaceGateway.connectionState?.slice(1) || 'Unknown' }}
                </span>
                <span 
                  v-if="host.interfaceGateway.username" 
                  class="text-xs text-blue-600 mt-1"
                  title="Authentication configured"
                >
                  🔐 Auth: {{ host.interfaceGateway.username }}
                </span>
                <span 
                  v-if="host.interfaceGateway.errorMessage" 
                  class="text-xs text-red-600 mt-1"
                  :title="host.interfaceGateway.errorMessage"
                >
                  {{ host.interfaceGateway.errorMessage }}
                </span>
              </div>
            </td>
            <td class="space-x-2">
              <button 
                :class="[
                  'inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium shadow-sm',
                  host.interfaceGateway.enabled
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-green-600 text-white hover:bg-green-700'
                ]"
                @click="host.interfaceGateway.enabled ? disableIG(host.sim) : enableIG(host.sim)"
              >
                {{ host.interfaceGateway.enabled ? 'Disable IG' : 'Enable IG' }}
              </button>
              <button class="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium text-white bg-yellow-500 hover:bg-yellow-600 shadow-sm" @click="editHostModal(host, availableSimulations)">Edit</button>
              <button class="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium text-white bg-red-500 hover:bg-red-600 shadow-sm" @click="confirmDelete(host)">Delete</button>
            </td>
          </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<script>
import { useHostManagement } from '~/composables/useHostManagement'
import AddHostModal from '../AddHostModal.vue'

export default {
  name: 'AdminHostsTab',
  components: {
    AddHostModal
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
    availableSimulations: {
      type: Array,
      required: true
    },
    availableChannels: {
      type: Array,
      required: true
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
    const hostManagement = useHostManagement(props.socket, props.showError, props.showSuccess)
    
    return {
      ...hostManagement
    }
  },
  data() {
    return {
      isModalVisible: false
    }
  },
  computed: {
    hasVoiceChannels() {
      return this.availableChannels && this.availableChannels.length > 0
    }
  },
  watch: {
    // Close modal when form is reset (indicating successful submission)
    formMode(newMode) {
      if (newMode === 'add' && this.isModalVisible) {
        // If formMode changed to 'add' while modal is visible, it means
        // the form was successfully submitted and reset
        this.isModalVisible = false
      }
    }
  },
  methods: {
    openAddHostModal() {
      this.formMode = 'add'
      this.resetForm()
      this.isModalVisible = true
    },
    closeModal() {
      this.isModalVisible = false
      if (this.formMode === 'edit') {
        this.cancelEdit()
      }
    },
    // Override the editHost method to open modal
    editHostModal(host, availableSimulations) {
      // Call the original editHost method from composable
      this.editHost(host, availableSimulations)
      // Open the modal
      this.isModalVisible = true
    }
  }
}
</script>
