<template>
  <div class="my-1">
    <h1 class="text-3xl font-bold">Hosts</h1>
    <div class="my-4">
      <form @submit.prevent="submitHostForm" class="max-w-lg mx-auto bg-gray-100 p-4 rounded-lg">
        <h2 class="text-xl font-semibold mb-4">{{ formMode === 'add' ? 'Add New Host' : 'Edit Host' }}</h2>
        <div class="grid grid-cols-1 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700">Simulation</label>
            <select v-model="newHost.sim" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
              <option value="">Select a simulation</option>
              <option v-for="sim in availableSimulations" :key="sim.id" :value="sim.id">
                {{ sim.name }}
              </option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Host URL/IP</label>
            <input v-model="newHost.host" required type="text" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" placeholder="e.g., localhost or 192.168.1.100"/>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Host Port</label>
            <input 
              v-model="newHost.port" 
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
            <select v-model="newHost.channel" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
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
              v-model="newHost.interfaceGateway.port" 
              required 
              type="number" 
              min="1" 
              max="65535" 
              step="1"
              pattern="[0-9]+"
              @input="validatePortInput"
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
                  v-model="newHost.interfaceGateway.username" 
                  type="text" 
                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  placeholder="Optional username for STOMP authentication"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700">Password</label>
                <input 
                  v-model="newHost.interfaceGateway.password" 
                  type="password" 
                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  :placeholder="formMode === 'edit' && newHost.interfaceGateway.hasPassword ? 'Leave blank to keep existing password' : 'Optional password for STOMP authentication'"
                />
                <div v-if="formMode === 'edit' && newHost.interfaceGateway.hasPassword" class="mt-1 text-sm text-gray-500">
                  Current password is set. Enter new password to change it, or leave blank to keep existing.
                </div>
              </div>
              <div v-if="newHost.interfaceGateway.password" class="grid grid-cols-1 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700">Confirm Password</label>
                  <input 
                    v-model="passwordConfirmation" 
                    type="password" 
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    placeholder="Confirm the password"
                  />
                  <div v-if="newHost.interfaceGateway.password && passwordConfirmation && newHost.interfaceGateway.password !== passwordConfirmation" class="mt-1 text-sm text-red-600">
                    Passwords do not match
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="flex justify-between">
            <button type="submit" class="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
              {{ formMode === 'add' ? 'Add Host' : 'Update Host' }}
            </button>
            <button v-if="formMode === 'edit'" type="button" @click="cancelEdit" class="inline-flex justify-center rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
              Cancel
            </button>
          </div>
        </div>
      </form>
    </div>
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
              <button class="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium text-white bg-yellow-500 hover:bg-yellow-600 shadow-sm" @click="editHost(host, availableSimulations)">Edit</button>
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

export default {
  name: 'AdminHostsTab',
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
  computed: {
    hasVoiceChannels() {
      return this.availableChannels && this.availableChannels.length > 0
    }
  }
}
</script>
