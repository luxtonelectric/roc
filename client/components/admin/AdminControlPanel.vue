<template>
  <div class="container mx-auto align-middle">
    <div class="flex-grow py-1 text-center">
      <h1 class="text-6xl">ROC Administration Centre</h1>
    </div>
    
    <!-- Error/Success Notification -->
    <AdminNotification :notification="notification" @close="hideNotification" />
    
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
      <AdminHostsTab 
        v-show="currentTab === 'hosts'"
        :socket="socket"
        :game-state="gameState"
        :available-simulations="availableSimulations"
        :available-channels="availableChannels"
        :show-error="showError"
        :show-success="showSuccess"
      />
      
      <AdminGamesTab 
        v-show="currentTab === 'games'"
        :socket="socket"
        :game-state="gameState"
      />
      
      <AdminPhonesTab 
        v-show="currentTab === 'phones'"
        :socket="socket"
        :game-state="gameState"
        :my-phones="myPhones"
        :show-error="showError"
        :show-success="showSuccess"
      />
      
      <AdminVoiceTab 
        v-show="currentTab === 'voice'"
        :socket="socket"
        :game-state="gameState"
        :my-phones="myPhones"
        :show-error="showError"
        :show-success="showSuccess"
      />
    </div>
  </div>
</template>

<script>
import { PreparedCall } from '~/models/PreparedCall'
import { useNotifications } from '~/composables/useNotifications'
import { useAdminSocket } from '~/composables/useAdminSocket'
import { useVoiceCallManagement } from '~/composables/useVoiceCallManagement'
import AdminNotification from './AdminNotification.vue'
import AdminHostsTab from './tabs/AdminHostsTab.vue'
import AdminGamesTab from './tabs/AdminGamesTab.vue'
import AdminPhonesTab from './tabs/AdminPhonesTab.vue'
import AdminVoiceTab from './tabs/AdminVoiceTab.vue'

export default {
  name: "AdminControlPanel",
  components: {
    AdminNotification,
    AdminHostsTab,
    AdminGamesTab,
    AdminPhonesTab,
    AdminVoiceTab
  },
  props: ['socket', 'discordId'],
  
  setup(props) {
    const notifications = useNotifications()
    const socketManager = useAdminSocket(props.socket, props.discordId)
    
    // Use voice call management for queue count computation
    const voiceCallManager = useVoiceCallManagement(
      props.socket,
      socketManager.gameState,
      socketManager.myPhones,
      notifications.showError,
      notifications.showSuccess
    )
    
    return {
      ...notifications,
      ...socketManager,
      queuedCallsCount: voiceCallManager.queuedCallsCount
    }
  },
  
  mounted() {
    console.log('AdminControlPanel mounted')
    this.setupSocketListeners()
    
    // Load initial data if we're already connected
    if (this.socket.connected) {
      console.log('Socket already connected, loading initial data')
      this.loadInitialData()
    }
  },
  
  beforeUnmount() {
    // Clean up socket listeners
    this.removeSocketListeners()
    // Clean up notification timeouts
    this.cleanup()
  },

  data() {
    return {
      PreparedCall, // Make PreparedCall available in template
      currentTab: 'hosts',
      tabs: [
        { id: 'hosts', name: 'Hosts' },
        { id: 'games', name: 'Games' },
        { id: 'phones', name: 'Phones' },
        { id: 'voice', name: 'Voice Calls' }
      ]
    }
  },
  
  computed: {
    voiceTabClasses() {
      return {
        'py-2 px-4 text-sm font-medium rounded-t-lg': true,
        'text-gray-500 hover:text-gray-700 hover:border-gray-300': this.currentTab !== 'voice',
        'bg-white text-indigo-600 border-b-2 border-indigo-600': this.currentTab === 'voice',
        'animate-pulse bg-green-50': this.queuedCallsCount > 0 && this.currentTab !== 'voice'
      };
    }
  },
  
  watch: {
    availableChannels: {
      handler(newChannels) {
        console.log('Voice channels changed:', newChannels);
      },
      immediate: true
    }
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
