<template>
  <div class="my-1">
    <h1 class="text-3xl font-bold">Phones</h1>
    
    <!-- Debug info -->
    <div class="mb-4 p-2 bg-yellow-100 text-sm">
      <p>GameState phones: {{ gameState.phones ? gameState.phones.length : 'undefined' }}</p>
      <p>Filtered phones: {{ filteredPhones ? filteredPhones.length : 'undefined' }}</p>
    </div>
    
    <template v-if="gameState.phones">
      <div class="overflow-x-auto">
        <!-- Search Bar -->
        <div class="flex justify-between items-center mb-4">
          <div class="relative">
            <input
              v-model="phoneSearchQuery"
              type="text"
              placeholder="Search phones by name..."
              class="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span class="absolute right-3 top-2.5 text-gray-400">
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
          </div>
        </div>

        <!-- Phones Table -->
        <table class="min-w-full table-auto bg-white shadow-sm rounded-lg overflow-hidden">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 border-b border-gray-200 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sim ID</th>
              <th class="px-4 py-3 border-b border-gray-200 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Panel ID</th>
              <th class="px-4 py-3 border-b border-gray-200 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th class="px-4 py-3 border-b border-gray-200 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
              <th class="px-4 py-3 border-b border-gray-200 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Number</th>
              <th class="px-4 py-3 border-b border-gray-200 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned</th>
              <th class="px-4 py-3 border-b border-gray-200 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Claim</th>
              <th class="px-4 py-3 border-b border-gray-200 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Place call</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="phone in filteredPhones" :key="phone.id" class="hover:bg-gray-50">
              <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                <template v-if="phone.location">{{ phone.location.simId }}</template>
              </td>
              <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                <template v-if="phone.location">{{ phone.location.panelId }}</template>
              </td>
              <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{{ phone.name }}</td>
              <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                <span :class="[
                  'px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full',
                  phone.type === 'mobile' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                ]">
                  {{ phone.type }}
                </span>
              </td>
              <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                <template v-if="phone.type === 'mobile'">{{ phone.id }}</template>
              </td>
              <td class="px-4 py-3 whitespace-nowrap">
                <template v-if="phone.player">
                  <div class="flex items-center">
                    <img class="h-8 w-8 rounded-full" :src="phone.player.avatarURL" :title="phone.player.displayName" :alt="phone.player.displayName">
                    <span class="ml-2 text-sm text-gray-900">{{ phone.player.displayName }}</span>
                  </div>
                </template>
              </td>
              <td class="px-4 py-3 whitespace-nowrap">
                <button 
                  v-if="!phone.player" 
                  @click="claimPhone(phone.id)"
                  class="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Claim
                </button>
                <button 
                  v-else 
                  @click="unclaimPhone(phone.id)"
                  class="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Unclaim
                </button>
              </td>
              <td class="px-4 py-3 whitespace-nowrap">
                <div class="flex items-center space-x-2">
                  <select 
                    v-model="selectedPhone[phone.id]"
                    class="block w-32 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  >
                    <option value="">Select Phone</option>
                    <option v-for="(myPhone, key) in myPhones" :key="key" :value="key">
                      {{ myPhone?.name || key }}
                    </option>
                  </select>
                  <button 
                    @click="placeCall(phone.id, PreparedCall.TYPES.P2P, PreparedCall.LEVELS.NORMAL)"
                    class="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-sm"
                    title="Place a normal priority P2P call"
                  >
                    Call
                  </button>
                  <button 
                    @click="placeCall(phone.id, PreparedCall.TYPES.P2P, PreparedCall.LEVELS.URGENT)"
                    class="bg-yellow-500 hover:bg-yellow-600 text-white px-2 py-1 rounded text-sm"
                    title="Place an urgent priority P2P call"
                  >
                    Urgent
                  </button>
                  <button 
                    @click="placeCall(phone.id, PreparedCall.TYPES.REC, PreparedCall.LEVELS.EMERGENCY)"
                    class="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-sm"
                    title="Place an emergency Railway Emergency Call (REC)"
                  >
                    REC
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- Create Phone Form -->
    <div class="mt-8 bg-white shadow-sm rounded-lg p-6">
      <h2 class="text-lg font-medium text-gray-900 mb-4">Create New Phone</h2>
      <form @submit.prevent="createPhone" class="space-y-4">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label for="newphone_name" class="block text-sm font-medium text-gray-700">Name</label>
            <input 
              v-model="newPhone.name" 
              id="newphone_name" 
              type="text" 
              placeholder="Phone name"
              class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              required
            />
          </div>
          <div>
            <label for="newphone_number" class="block text-sm font-medium text-gray-700">Number</label>
            <input 
              v-model="newPhone.number" 
              id="newphone_number" 
              type="number" 
              min="1" 
              step="1"
              pattern="[0-9]+" 
              title="Phone number (numbers only)" 
              placeholder="Phone number"
              class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              @input="validatePhoneNumberInput"
              required
            />
          </div>
          <div>
            <label for="newphone_type" class="block text-sm font-medium text-gray-700">Type</label>
            <select 
              v-model="newPhone.type" 
              id="newphone_type"
              class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="mobile">Mobile</option>
              <option value="fixed">Fixed</option>
            </select>
          </div>
        </div>
        <div class="flex justify-end">
          <button 
            type="submit"
            class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Create Phone
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import { toRefs } from 'vue'
import { PreparedCall } from '~/models/PreparedCall'
import { usePhoneManagement } from '~/composables/usePhoneManagement'

export default {
  name: 'AdminPhonesTab',
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
    const { gameState } = toRefs(props)
    
    const phoneManagement = usePhoneManagement(
      props.socket,
      gameState,
      props.showError,
      props.showSuccess
    )
    
    return {
      PreparedCall, // Make PreparedCall available in template
      ...phoneManagement
    }
  }
}
</script>
