<template>
  <div class="my-1">
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
</template>

<script>
export default {
  name: 'AdminGamesTab',
  props: {
    socket: {
      type: Object,
      required: true
    },
    gameState: {
      type: Object,
      required: true
    }
  },
  methods: {
    enableConnections(simId) {
      console.log('enableConnections', simId)
      this.socket.emit("enableConnections", { "simId": simId })
    },
    disableConnections(simId) {
      console.log('disableConnections', simId)
      this.socket.emit("disableConnections", { "simId": simId })
    },
    unclaimPanel(sim, panel, player) {
      console.log('unclaimPanel', sim, panel, player)
      this.socket.emit("releasePanel", { sim, panel, player })
    }
  }
}
</script>
