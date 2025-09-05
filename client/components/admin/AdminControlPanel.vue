<template>
  <div class="container mx-auto align-middle">
    <div class="flex-grow py-1 text-center">
      <h1 class="text-6xl">ROC Administration Centre</h1>
    </div>
    
    <!-- Tab Navigation -->
    <div class="flex border-b border-gray-200 mb-4">
      <button 
        v-for="tab in tabs" 
        :key="tab.id"
        @click="currentTab = tab.id"
        :class="[
          'py-2 px-4 text-sm font-medium rounded-t-lg',
          currentTab === tab.id
            ? 'bg-white text-indigo-600 border-b-2 border-indigo-600'
            : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
        ]"
      >
        {{ tab.name }}
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
                <input v-model="newHost.interfaceGateway.port" required type="number" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"/>
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
                  <th colspan="4" class="px-4 py-2 border">Host</th>
                  <th colspan="3" class="px-4 py-2 border">Interface Gateway</th>
                </tr>
                <tr>
                  <th class="px-4 py-2 border">Simulation</th>
                  <th class="px-4 py-2 border">URL/IP</th>
                  <th class="px-4 py-2 border">Voice Chat Channel</th>
                  <th class="px-4 py-2 border">Host State</th>
                  <th class="px-4 py-2 border">Port</th>
                  <th class="px-4 py-2 border">Connected</th>
                  <th class="px-4 py-2 border">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="host in gameState.hostState" :key="host.sim">
                <td>{{ host.sim }}</td>
                <td>{{ host.host }}</td>
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
                        {{ panel.player }}
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
          <input v-model="newPhone.number" id="newphone_number" type="text" title="" pattern="[0-9]+"
            placeholder="Number">
          <select v-model="newPhone.type" id="newphone_type">
            <option value="mobile">Mobile</option>
            <option value="fixed">Fixed</option>
          </select>
          <!--input type="checkbox" -->
          <button type="submit">Create Phone</button>
        </form>
      </div>
      <div v-show="currentTab === 'voice'" class="my-4">
        <h1 class="text-3xl font-bold">Voice Calls</h1>

        <div class="mb-5" v-for="(phone, key) in myPhones" :key="key">
          <CallListItem v-for="call in phone.queue" :key="call.id" :callData="call" :socket="socket" @accept-call="acceptCall"
            @reject-call="rejectCall" @leave-call="leaveCall"/>
        </div>

        <div v-for="(call, key) in gameState.privateCalls" :key="key">
          <p class="text-xl">{{ key }}:</p>
          <div v-for="(user, key) in call" :key="key">
            <a class="button inline-block" @click="kickUserFromCall(user)">{{ user }}</a>
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
  
  methods: {
    async loadInitialData() {
      if (!this.socket.connected) {
        console.warn('Socket not connected, waiting for connection...');
        return;
      }
      
      try {
        // Load admin state first
        await this.refreshAdminData();
        
        // Load available simulations - this also gets voice channels from the server
        await this.loadSimulations();
      } catch (err) {
        console.error('Error loading initial data:', err);
      }
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
        // Remove phones that are no longer assigned to this user
        Object.keys(this.myPhones).forEach(phoneId => {
          if (!myPhones.find(mp => mp.id === phoneId)) {
            // Clean up selected phone entries using this phone
            Object.keys(this.selectedPhone).forEach(key => {
              if (this.selectedPhone[key] === phoneId) {
                delete this.selectedPhone[key];
              }
            });
            delete this.myPhones[phoneId];
          }
        });
        
        // Update currently assigned phones
        myPhones.forEach(mp => {
          this.myPhones[mp.id] = mp;
        });
        // Ensure voice channels are loaded
        if (!this.availableChannels.length) {
          this.loadVoiceChannels();
        }
      });

      this.socket.on('callQueueUpdate', (msg) => {
        this.myPhones[msg.phoneId] = msg;
      });
    },
    
    removeSocketListeners() {
      this.socket.off('connect');
      this.socket.off('disconnect');
      this.socket.off('adminStatus');
      this.socket.off('voiceChannelsUpdate');
      this.socket.off('callQueueUpdate');
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
        channel: "",
        interfaceGateway: {
          port: 51515,
          enabled: true
        }
      }
    }
  },
  methods: {
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
        this.myPhones[msg.phoneId] = msg;
      });
    },

    removeSocketListeners() {
      this.socket.off('connect');
      this.socket.off('disconnect');
      this.socket.off('adminStatus');
      this.socket.off('voiceChannelsUpdate');
      this.socket.off('callQueueUpdate');
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
      if (this.formMode === 'add') {
        this.socket.emit("addHost", this.newHost, (response) => {
          if (response.success) {
            this.resetForm();
          } else {
            alert('Failed to add host: ' + response.error);
          }
        });
      } else {
        this.socket.emit("updateHost", { ...this.newHost, originalSimId: this.selectedHostId }, (response) => {
          if (response.success) {
            this.resetForm();
          } else {
            alert('Failed to update host: ' + response.error);
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
        channel: host.channel,
        interfaceGateway: {
          port: host.interfaceGateway.port,
          enabled: host.interfaceGateway.enabled
        }
      };
    },

    cancelEdit() {
      this.resetForm();
    },

    confirmDelete(host) {
      if (confirm(`Are you sure you want to delete the host for ${host.sim}?`)) {
        this.socket.emit("deleteHost", { simId: host.sim }, (response) => {
          if (!response.success) {
            alert('Failed to delete host: ' + response.error);
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
        channel: "",
        interfaceGateway: {
          port: 51515,
          enabled: true
        }
      };
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
      this.incomingCall = false;
      //this.muteRinger();
      const call = {id:callId}
      //this.callData = this.myCalls.find(c => c.id === callId);
      //this.myCalls = this.myCalls.filter(c => c.id !== callId);
      this.socket.emit('acceptCall', call, response => {
        console.log('acceptCall response', response);
      });
      

    },
    rejectCall(callId) {
      this.incomingCall = false;
      //this.muteRinger();
      this.socket.emit('rejectCall', {id:callId})
    },
    leaveCall(callId) {
      this.socket.emit("leaveCall", {id:callId});
      this.inCall = false;
    },
  }
}
</script>

<style scoped></style>
