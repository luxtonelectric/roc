<template>
  <div class="container mx-auto align-middle">
    <div class="flex-grow py-1 text-center">
      <h1 class="text-6xl">ROC Administration Centre</h1>
    </div>
    
    <!-- Error/Success Notification -->
    <div 
      v-if="notification.show" 
      :class="[
        'fixed top-4 right-4 z-50 max-w-sm p-4 rounded-lg shadow-lg transition-all duration-300',
        notification.type === 'error' ? 'bg-red-50 border-l-4 border-red-400' : 'bg-green-50 border-l-4 border-green-400'
      ]"
    >
      <div class="flex">
        <div class="flex-shrink-0">
          <!-- Error Icon -->
          <svg v-if="notification.type === 'error'" class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
          <!-- Success Icon -->
          <svg v-else class="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
          </svg>
        </div>
        <div class="ml-3">
          <p :class="[
            'text-sm font-medium',
            notification.type === 'error' ? 'text-red-800' : 'text-green-800'
          ]">
            {{ notification.title }}
          </p>
          <p :class="[
            'mt-1 text-sm',
            notification.type === 'error' ? 'text-red-700' : 'text-green-700'
          ]">
            {{ notification.message }}
          </p>
        </div>
        <div class="ml-auto pl-3">
          <button 
            @click="hideNotification"
            :class="[
              'inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2',
              notification.type === 'error' 
                ? 'text-red-400 hover:bg-red-100 focus:ring-red-600' 
                : 'text-green-400 hover:bg-green-100 focus:ring-green-600'
            ]"
          >
            <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </div>
    
    <!-- Tab Navigation -->
    <div class="flex border-b border-gray-200 mb-4">
      <button 
        v-for="tab in tabs" 
        :key="tab.id"
        @click="currentTab = tab.id"
        :class="tab.id === 'voice' ? voiceTabClasses : [
          'py-2 px-4 text-sm font-medium rounded-t-lg',
          currentTab === tab.id
            ? 'bg-white text-indigo-600 border-b-2 border-indigo-600'
            : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
        ]"
      >
        {{ tab.name }}
        <span 
          v-if="tab.id === 'voice' && queuedCallsCount > 0"
          class="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
        >
          {{ queuedCallsCount }}
        </span>
      </button>
    </div>

    <!-- Tab Content -->
    <div class="divide-y">
      <div v-show="currentTab === 'hosts'" class="my-1">
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
                  <button class="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium text-white bg-yellow-500 hover:bg-yellow-600 shadow-sm" @click="editHost(host)">Edit</button>
                  <button class="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium text-white bg-red-500 hover:bg-red-600 shadow-sm" @click="confirmDelete(host)">Delete</button>
                </td>
              </tr>
              </tbody>
            </table>
          </div>
        </template>
      </div>
      <div v-show="currentTab === 'games'" class="my-1">
        <h1 class="text-3xl font-bold mb-6">Games</h1>
        <template v-if="gameState.gameState">
          <div v-for="game in gameState.gameState" :key="game.id" class="mb-8 bg-white rounded-lg shadow-md p-6">
            <div class="flex justify-between items-center mb-4">
              <h2 class="text-2xl font-bold text-gray-900">{{ game.name }}</h2>
              <div class="flex items-center space-x-2">
                <span :class="[
                  'px-3 py-1 rounded-full text-sm font-medium',
                  game.connectionsOpen 
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                ]">
                  {{ game.connectionsOpen ? 'Connections Open' : 'Connections Closed' }}
                </span>
                <button 
                  :class="[
                    'inline-flex items-center px-4 py-2 rounded-md text-sm font-medium shadow-sm',
                    game.connectionsOpen
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  ]"
                  @click="game.connectionsOpen ? disableConnections(game.id) : enableConnections(game.id)"
                >
                  {{ game.connectionsOpen ? 'Close Connections' : 'Open Connections' }}
                </button>
              </div>
            </div>

            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Panel
                    </th>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Assigned Player
                    </th>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  <tr v-for="panel in game.panels" :key="panel.name" class="hover:bg-gray-50">
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {{ panel.name }}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <template v-if="panel.player">
                        <div class="flex items-center">
                      <img v-if="panel.playerDetails?.avatarURL" 
                           :src="panel.playerDetails.avatarURL" 
                           :alt="panel.playerDetails.displayName"
                           :title="panel.playerDetails.displayName"
                           class="w-8 h-8 rounded-full mr-2"
                      />
                      <span>{{ panel.playerDetails?.displayName || panel.player }}</span>
                      <button class="ml-2 px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600" 
                              @click="unclaimPanel(game.id, panel.id, panel.player)">
                        Unclaim
                      </button>
                    </div>
                      </template>
                      <span v-else class="text-gray-400">Unassigned</span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <span :class="[
                        'px-2 inline-flex text-xs leading-5 font-semibold rounded-full',
                        panel.player 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      ]">
                        {{ panel.player ? 'Active' : 'Available' }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </template>
        <div v-else class="text-center py-8 text-gray-500">
          No active games found
        </div>
      </div>
      <div v-show="currentTab === 'phones'" class="my-1">
        <h1 class="text-3xl font-bold">Phones</h1>
        <template v-if="gameState.phones">
          <div class="overflow-x-auto">
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
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900"><template v-if="phone.location">{{ phone.location.simId }}</template></td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900"><template v-if="phone.location">{{ phone.location.panelId }}</template></td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{{ phone.name }}</td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                  <span :class="[
                    'px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full',
                    phone.type === 'mobile' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                  ]">
                    {{ phone.type }}
                  </span>
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900"><template v-if="phone.type === 'mobile'">{{ phone.id }}</template></td>
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
                      class="block w-40 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    >
                      <option v-for="(myPhone, key) in myPhones" :key="key" :value="key">{{myPhone?.name || key}}</option>
                    </select>
                    <button 
                      @click="placeCall(phone.id)"
                      class="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                      Call
                    </button>
                  </div>
                </td>
              </tr>
              </tbody>
            </table>
          </div>
        </template>

        <form @submit.prevent="createPhone">
          <input v-model="newPhone.name" id="newphone_name" type="text" placeholder="Name">
          <input 
            v-model="newPhone.number" 
            id="newphone_number" 
            type="number" 
            min="1" 
            step="1"
            pattern="[0-9]+" 
            title="Phone number (numbers only)" 
            placeholder="Number"
            @input="validatePhoneNumberInput"
          />
          <select v-model="newPhone.type" id="newphone_type">
            <option value="mobile">Mobile</option>
            <option value="fixed">Fixed</option>
          </select>
          <!--input type="checkbox" -->
          <button type="submit">Create Phone</button>
        </form>
      </div>
      <div v-show="currentTab === 'voice'" class="my-4">
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
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Call Route
                        </th>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Time Placed
                        </th>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                      <CallListItem
                        v-for="call in phone.queue"
                        :key="call.id"
                        :callData="call"
                        :socket="socket"
                        @accept-call="acceptCall"
                        @reject-call="rejectCall"
                        @leave-call="leaveCall"
                      />
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
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Call Channel
                      </th>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Participants
                      </th>
                      <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody class="bg-white divide-y divide-gray-200">
                    <tr v-for="(call, key) in gameState.privateCalls" :key="key" class="hover:bg-gray-50">
                      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {{ key }}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div class="flex flex-wrap gap-1">
                          <span 
                            v-for="(user, userKey) in call" 
                            :key="userKey"
                            class="inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium bg-blue-100 text-blue-800"
                          >
                            {{ user }}
                          </span>
                        </div>
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div class="flex justify-end flex-wrap gap-1">
                          <button
                            v-for="(user, userKey) in call"
                            :key="userKey"
                            @click="kickUserFromCall(user)"
                            class="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                            :title="`Kick ${user} from call`"
                          >
                            Kick {{ user }}
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 ml-1" viewBox="0 0 20 20" fill="currentColor">
                              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                            </svg>
                          </button>
                        </div>
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
              No active calls or calls in queue
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "AdminControlPanel",
  props: ['socket', 'discordId'],
  mounted() {
    console.log('AdminControlPanel mounted');
    this.setupSocketListeners();
    
    // Load initial data if we're already connected
    if (this.socket.connected) {
      console.log('Socket already connected, loading initial data');
      this.loadInitialData();
    }
  },
  
  beforeUnmount() {
    // Clean up socket listeners
    this.removeSocketListeners();
  },

  data() {
    return {
      phoneSearchQuery: '',
      currentTab: 'hosts',
      tabs: [
        { id: 'hosts', name: 'Hosts' },
        { id: 'games', name: 'Games' },
        { id: 'phones', name: 'Phones' },
        { id: 'voice', name: 'Voice Calls' }
      ],
      gameState: {},
      myPhones: {},
      selectedPhone: {},
      availableSimulations: [],
      availableChannels: [],
      notification: {
        show: false,
        type: 'error', // 'error' or 'success'
        title: '',
        message: ''
      },
      newPhone: {
        name: "",
        number: "",
        type: "mobile",
      },
      formMode: 'add',
      selectedHostId: null,
      newHost: {
        sim: "",
        host: "",
        port: "",
        channel: "",
        interfaceGateway: {
          port: 51515,
          enabled: true,
          username: "",
          password: "",
          hasPassword: false
        }
      },
      passwordConfirmation: "",
      // Call state management
      currentCall: null,
      inCall: false,
      incomingCall: false
    }
  },
  computed: {
    hasVoiceChannels() {
      return this.availableChannels && this.availableChannels.length > 0;
    },
    filteredPhones() {
      if (!this.gameState?.phones) return [];
      if (!this.phoneSearchQuery) return this.gameState.phones;
      
      const searchQuery = this.phoneSearchQuery.toLowerCase();
      return this.gameState.phones.filter(phone => 
        phone.name?.toLowerCase().includes(searchQuery)
      );
    },
    queuedCallsCount() {
      return Object.values(this.myPhones).reduce((total, phone) => {
        if (!phone.queue) return total;
        return total + phone.queue.filter(call => 
          call.status === 'offered' || call.status === 'accepted'
        ).length;
      }, 0);
    },
    voiceTabClasses() {
      return {
        'py-2 px-4 text-sm font-medium rounded-t-lg': true,
        'text-gray-500 hover:text-gray-700 hover:border-gray-300': this.currentTab !== 'voice',
        'bg-white text-indigo-600 border-b-2 border-indigo-600': this.currentTab === 'voice',
        'animate-pulse bg-green-50': this.queuedCallsCount > 0 && this.currentTab !== 'voice'
      };
    },
    currentCallStatus() {
      if (!this.currentCall) return 'No active call';
      if (this.inCall) return `In call: ${this.currentCall.sender.name} ↔ ${this.currentCall.receivers[0].name}`;
      if (this.incomingCall) return `Incoming call: ${this.currentCall.sender.name} → ${this.currentCall.receivers[0].name}`;
      return `Call status: ${this.currentCall.status}`;
    }
  },
  
  watch: {
    availableChannels: {
      handler(newChannels) {
        console.log('Voice channels changed:', newChannels);
      },
      immediate: true
    }
  },
  
  methods: {
    showNotification(type, title, message) {
      this.notification = {
        show: true,
        type: type, // 'error' or 'success'
        title: title,
        message: message
      };
      
      // Auto-hide after 5 seconds
      setTimeout(() => {
        this.hideNotification();
      }, 5000);
    },

    hideNotification() {
      this.notification.show = false;
    },

    showError(title, message) {
      this.showNotification('error', title, message);
    },

    showSuccess(title, message) {
      this.showNotification('success', title, message);
    },

    async loadInitialData() {
      if (!this.socket.connected) {
        console.warn('Socket not connected, waiting for connection...');
        return;
      }
      
      // Load admin state first
      await this.refreshAdminData();
      
      // Load available simulations and voice channels in parallel
      await Promise.all([
        this.loadSimulations(),
        this.loadVoiceChannels()
      ]).catch(err => {
        console.error('Error loading initial data:', err);
      });
    },
    setupSocketListeners() {
      // Set up connection event handlers
      this.socket.on('connect', () => {
        console.log('Socket connected, loading initial data');
        this.loadInitialData();
      });

      this.socket.on('disconnect', () => {
        console.log('Socket disconnected');
      });

      // Set up admin status listener
      this.socket.on('adminStatus', (msg) => {
        console.log('Received admin status update');
        this.gameState = msg;
        const allPhones = msg.phones;
        const myPhones = allPhones.filter((p) => typeof p.player !== 'undefined' && p.player.discordId === this.discordId);
        console.log('Filtered my phones:', myPhones);
        // Remove phones that are no longer assigned to this user
        Object.keys(this.myPhones).forEach(phoneId => {
          if (!myPhones.find(mp => mp.id === phoneId)) {
            // Clean up selected phone entries using this phone
            Object.keys(this.selectedPhone).forEach(key => {
              if (this.selectedPhone[key] === phoneId) {
                console.log('Cleaning up selected phone for key:', key);
                delete this.selectedPhone[key];
              }
            });
            console.log('Removing unassigned phone:', phoneId);
            delete this.myPhones[phoneId];
          }
        });
        
        // Update currently assigned phones
        myPhones.forEach(mp => {
          this.myPhones[mp.id] = mp;
        });
        console.log('Updated myPhones:', this.myPhones);
        
        // Ensure voice channels are loaded
        if (!this.availableChannels.length) {
          this.loadVoiceChannels();
        }
      });

      // Listen for voice channel updates
      this.socket.on('voiceChannelsUpdate', (channels) => {
        console.log('Voice channels updated:', channels);
        if (channels && Array.isArray(channels)) {
          this.availableChannels = channels;
        }
      });

      this.socket.on('callQueueUpdate', (msg) => {
        console.log('Call queue update received:', msg);
        if (this.myPhones[msg.phoneId]) {
          // Update only the queue and preserve other phone properties
          this.myPhones[msg.phoneId] = {
            ...this.myPhones[msg.phoneId],
            queue: msg.queue || []
          };
        } else {
          // If the phone doesn't exist yet, initialize it
          this.myPhones[msg.phoneId] = msg;
        }
        
        // Check if our current call was ended/rejected and update state accordingly
        if (this.currentCall) {
          let callStillExists = false;
          const queue = msg.queue || [];
          
          for (const call of queue) {
            if (call.id === this.currentCall.id) {
              // Update current call status
              this.currentCall = call;
              
              if (call.status === 'accepted') {
                this.inCall = true;
                this.incomingCall = false;
              } else if (call.status === 'offered') {
                this.inCall = false;
                this.incomingCall = true;
              }
              
              callStillExists = true;
              break;
            }
          }
          
          // If our current call is no longer in the queue, it was ended/rejected
          if (!callStillExists) {
            console.log('Current call no longer in queue, clearing state');
            this.currentCall = null;
            this.inCall = false;
            this.incomingCall = false;
          }
        }
      });

      // Handle being kicked from call
      this.socket.on("kickedFromCall", (msg) => {
        console.log('Admin kicked from call:', msg);
        // End current call state
        if (this.currentCall) {
          this.currentCall = null;
          this.inCall = false;
          this.incomingCall = false;
        }
      });
    },

    removeSocketListeners() {
      this.socket.off('connect');
      this.socket.off('disconnect');
      this.socket.off('adminStatus');
      this.socket.off('voiceChannelsUpdate');
      this.socket.off('callQueueUpdate');
      this.socket.off('kickedFromCall');
    },

    async loadSimulations() {
      return new Promise((resolve, reject) => {
        this.socket.emit('getAvailableSimulations', {}, (response) => {
          if (response.success) {
            console.log('Loaded available simulations:', response.simulations);
            this.availableSimulations = response.simulations;
            resolve(response.simulations);
          } else {
            console.error('Failed to get simulations:', response.error);
            reject(new Error(response.error));
          }
        });
      });
    },
    
    async loadVoiceChannels() {
      return new Promise((resolve, reject) => {
        this.socket.emit('getAvailableVoiceChannels', {}, (response) => {
          if (response.success && response.voiceChannels) {
            console.log('Loaded available voice channels:', response.voiceChannels);
            this.availableChannels = response.voiceChannels;
            resolve(response.voiceChannels);
          } else {
            console.error('Failed to get voice channels:', response.error);
            reject(new Error(response.error));
          }
        });
      });
    },

    submitHostForm() {
      // Validate passwords if provided
      if (this.newHost.interfaceGateway.password) {
        if (this.newHost.interfaceGateway.password !== this.passwordConfirmation) {
          this.showError('Validation Error', 'Passwords do not match');
          return;
        }
        if (this.newHost.interfaceGateway.password.length < 6) {
          this.showError('Validation Error', 'Password must be at least 6 characters long');
          return;
        }
      }

      // Prepare host data
      const hostData = { ...this.newHost };
      
      // Only include authentication if username is provided
      if (!hostData.interfaceGateway.username) {
        // Clear authentication fields if no username
        delete hostData.interfaceGateway.username;
        delete hostData.interfaceGateway.password;
      } else if (!hostData.interfaceGateway.password && this.formMode === 'edit') {
        // For edit mode, if no password provided, don't include it (keep existing)
        delete hostData.interfaceGateway.password;
      }

      if (this.formMode === 'add') {
        this.socket.emit("addHost", hostData, (response) => {
          if (response.success) {
            this.showSuccess('Host Added', `Successfully added host for simulation '${hostData.sim}'`);
            this.resetForm();
          } else {
            this.showError('Failed to Add Host', response.error);
          }
        });
      } else {
        this.socket.emit("updateHost", { ...hostData, originalSimId: this.selectedHostId }, (response) => {
          if (response.success) {
            this.showSuccess('Host Updated', `Successfully updated host for simulation '${hostData.sim}'`);
            this.resetForm();
          } else {
            this.showError('Failed to Update Host', response.error);
          }
        });
      }
    },

    editHost(host) {
      // Make sure the simulation is available
      if (!this.availableSimulations.some(sim => sim.id === host.sim)) {
        this.availableSimulations.push({
          id: host.sim,
          name: host.sim // Fallback in case we don't have the name
        });
      }
      this.formMode = 'edit';
      this.selectedHostId = host.sim;
      this.newHost = {
        sim: host.sim,
        host: host.host,
        port: host.port,
        channel: host.channel,
        interfaceGateway: {
          port: host.interfaceGateway.port,
          enabled: host.interfaceGateway.enabled,
          username: host.interfaceGateway.username || "",
          password: "", // Never populate password field for security
          hasPassword: host.interfaceGateway.hasPassword || false
        }
      };
      this.passwordConfirmation = "";
    },

    cancelEdit() {
      this.resetForm();
    },

    confirmDelete(host) {
      if (confirm(`Are you sure you want to delete the host for ${host.sim}?`)) {
        this.socket.emit("deleteHost", { simId: host.sim }, (response) => {
          if (response.success) {
            this.showSuccess('Host Deleted', `Successfully deleted host for simulation '${host.sim}'`);
          } else {
            this.showError('Failed to Delete Host', response.error);
          }
        });
      }
    },

    // loadInitialData method moved to combined implementation above

    resetForm() {
      this.formMode = 'add';
      this.selectedHostId = null;
      this.newHost = {
        sim: "",
        host: "",
        port: "",
        channel: "",
        interfaceGateway: {
          port: 51515,
          enabled: true,
          username: "",
          password: "",
          hasPassword: false
        }
      };
      this.passwordConfirmation = "";
    },

    validatePortInput(event) {
      // Only allow numeric input for port fields
      const value = event.target.value;
      
      // Remove any non-numeric characters
      const numericValue = value.replace(/[^0-9]/g, '');
      
      // Convert to number and validate range
      const portNumber = parseInt(numericValue);
      
      if (numericValue !== value) {
        // Update the input with cleaned value
        event.target.value = numericValue;
        this.newHost.interfaceGateway.port = portNumber || '';
      } else if (portNumber) {
        // Ensure the port is within valid range
        if (portNumber < 1 || portNumber > 65535) {
          // If outside range, reset to a valid port
          if (portNumber > 65535) {
            this.newHost.interfaceGateway.port = 65535;
          } else if (portNumber < 1) {
            this.newHost.interfaceGateway.port = 1;
          }
        }
      }
    },

    validatePhoneNumberInput(event) {
      // Only allow numeric input for phone number fields
      const value = event.target.value;
      
      // Remove any non-numeric characters
      const numericValue = value.replace(/[^0-9]/g, '');
      
      if (numericValue !== value) {
        // Update the input with cleaned value
        event.target.value = numericValue;
        this.newPhone.number = numericValue;
      }
    },
    kickUserFromCall(user) {
      this.socket.emit("adminKickFromCall", { "user": user });
    },
    toggleHost(host) {
      if (host.enabled) {
        this.socket.emit("disableHost", { simId: host.sim });
      } else {
        this.socket.emit("enableHost", { simId: host.sim });
      }
    },
    enableIG(simId) {
      console.log('enableIG', simId)
      this.socket.emit("enableInterfaceGateway", { "simId": simId }, (response) => {
        if (!response.success) {
          alert(`Failed to enable Interface Gateway: ${response.error}`);
        }
      });
    },
    disableIG(simId) {
      console.log('disableIG', simId)
      this.socket.emit("disableInterfaceGateway", { "simId": simId }, (response) => {
        if (!response.success) {
          alert(`Failed to disable Interface Gateway: ${response.error}`);
        }
      });
    },
    enableConnections(simId) {
      console.log('enableConnections', simId)
      this.socket.emit("enableConnections", { "simId": simId });
    },
    disableConnections(simId) {
      console.log('disableConnections', simId)
      this.socket.emit("disableConnections", { "simId": simId });
    },
    unclaimPanel(sim, panel, player) {
      console.log('unclaimPanel', sim, panel, player);
      this.socket.emit("releasePanel", { sim, panel, player });
    },
    createPhone(number, name, type, location = null, hidden = false) {
      console.log('createPhone')
      //const phone = {'number': number, 'name': name, 'type': type, 'location':location, 'hidden':hidden};
      //const phone = {'number': '99999', 'name': 'TEST PHONE', 'type': 'mobile', 'location':null, 'hidden':false};
      
      // After a successful phone creation, reset the form
      this.newPhone = {
        name: "",
        number: "",
        type: "mobile"
      };
      const phone = this.newPhone;
      phone.location = null;
      phone.hidden = false;
      this.socket.emit("createPhone", phone);
    },
    claimPhone(phoneId) {
      this.socket.emit("claimPhone", { phoneId: phoneId });
    },
    unclaimPhone(phoneId) {
      this.socket.emit("unclaimPhone", { phoneId: phoneId });
    },
    refreshAdminData() {
      console.log('Refreshing admin data...');
      return new Promise((resolve, reject) => {
        this.socket.emit('adminLogin', { discordId: this.discordId }, (response) => {
          console.log('Admin login response:', response);
          if (response?.success) {
            if (response.voiceChannels && Array.isArray(response.voiceChannels)) {
              console.log('Setting voice channels from admin login:', response.voiceChannels.length);
              this.availableChannels = response.voiceChannels;
            } else {
              console.log('No voice channels in admin login response, will retry');
              this.retryLoadVoiceChannels();
            }
            resolve(response);
          } else {
            reject(new Error('Admin login failed'));
          }
        });
      });
    },

    retryLoadVoiceChannels(attempt = 1) {
      if (attempt > 3) return; // Max 3 attempts
      
      console.log(`Attempting to load voice channels (attempt ${attempt})`);
      this.socket.emit('getAvailableVoiceChannels', {}, (response) => {
        if (response?.success && Array.isArray(response.voiceChannels)) {
          console.log(`Got voice channels on attempt ${attempt}:`, response.voiceChannels.length);
          this.availableChannels = response.voiceChannels;
        } else {
          console.log(`Voice channels not available on attempt ${attempt}, retrying in 2s...`);
          setTimeout(() => this.retryLoadVoiceChannels(attempt + 1), 2000);
        }
      });
    },
    async placeCall(receiver, type = "p2p", level = "normal") {
      const soc = this.socket;
      console.log('placeCall', receiver, type, level);
      console.log('this.selectedPhone', this.selectedPhone[receiver]);

      const receiverPhone = this.gameState.phones.find(p => p.id === receiver);
      const senderPhone = this.gameState.phones.find(p => p.id === this.selectedPhone[receiver]);
      if (!senderPhone) {
        console.log("Refusing call: sender phone not selected/not found")
        return;
      }

      const callId = await new Promise(resolve => { soc.emit("placeCall", { "receivers": [receiverPhone], "sender": senderPhone, "type": type, "level": level }, response => resolve(response)) });
      // if (callId) {
      //   this.placedCall({ "receiver": receiver, "sender": this.selectedPhone, "id": callId })
      // } else {
      //   this.rejectedAudio.play();
      //   console.log('No call id. Something went wrong.');
      // }
    },
    acceptCall(callId) {
      console.log('Accepting call:', callId);
      
      // Find the call in the queue
      let foundCall = null;
      for (const phone of Object.values(this.myPhones)) {
        if (phone.queue) {
          foundCall = phone.queue.find(c => c.id === callId);
          if (foundCall) break;
        }
      }
      
      if (!foundCall) {
        console.error('Call not found in queue:', callId);
        return;
      }

      const call = { id: callId };
      this.socket.emit('acceptCall', call, response => {
        console.log('acceptCall response', response);
        if (response && response !== false) {
          // Set current call state
          this.currentCall = foundCall;
          this.inCall = true;
          this.incomingCall = false;
          console.log('Call accepted successfully');
        } else {
          console.error('Failed to accept call');
        }
      });
    },
    async rejectCall(callId) {
      console.log('Rejecting call:', callId);
      return new Promise((resolve) => {
        this.socket.emit('rejectCall', { id: callId }, (response) => {
          console.log('Call rejection response:', response);
          if (response?.success || response === true) {
            // Clear call state if we were rejecting our incoming call
            if (this.currentCall && this.currentCall.id === callId) {
              this.currentCall = null;
            }
            this.incomingCall = false;
            this.inCall = false;
            console.log('Call rejected successfully');
          } else {
            console.error('Failed to reject call:', response?.error || 'Unknown error');
          }
          resolve(response);
        });
      });
    },
    leaveCall(callId) {
      console.log('Leaving call:', callId);
      
      this.socket.emit("leaveCall", { id: callId });
      
      // Clear call state
      if (this.currentCall && this.currentCall.id === callId) {
        this.currentCall = null;
      }
      this.inCall = false;
      this.incomingCall = false;
      
      console.log('Left call successfully');
    },
  }
}
</script>

<style scoped>
@keyframes pulse {
  0%, 100% {
    background-color: rgb(240, 253, 244); /* green-50 */
  }
  50% {
    background-color: rgb(220, 252, 231); /* green-100 */
  }
}

@keyframes blink {
  0% {
    background-color: rgb(220, 252, 231); /* green-100 */
  }
  50% {
    background-color: rgb(240, 253, 244); /* green-50 */
  }
  100% {
    background-color: rgb(220, 252, 231); /* green-100 */
  }
}

.animate-pulse {
  animation: blink 500s infinite;
}
</style>
