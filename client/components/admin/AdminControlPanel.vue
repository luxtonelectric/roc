<template>
  <div class="container container mx-auto align-middle">
    <div class="flex-grow py-1 text-center">
      <h1 class="text-6xl">ROC Administration Centre</h1>
    </div>
    <div class="divide-y">
      <div class="my-1">
      <h1 class="text-3xl font-bold">Hosts</h1>
      <template v-if="gameState.hostState">
        <div>
          <table>
            <tr v-for=" host in gameState.hostState">
              <td>{{ host.sim }}</td>
              <td>{{ host.host }}</td>
              <td>{{ host.channel }}</td>
              <td>{{ host.enabled }}</td>
              <td>{{ host.interfaceGateway.port }}</td>
              <td>{{ host.interfaceGateway.connected }}</td>
              <td>
                <button v-if="host.interfaceGateway.enabled" class="btn" @click="disableIG(host.sim)">Disable IG</button>
                <button v-else class="btn" @click="enableIG(host.sim)">Enable IG</button>
              </td>
            </tr>
          </table>
        </div>
      </template>
    </div>
    <div class="my-1">
      <h1 class="text-3xl font-bold">Games</h1>
      <template v-if="gameState.gameState">
        <div v-for=" game in gameState.gameState">
          <h2 class="text-2xl font-bold">{{ game.name }}</h2>
          <table>
            <tr v-for="panel in game.panels">
              <td>{{ panel.name }}</td>
              <td>
                <template v-if="panel.player">
                  {{panel.player}}
                </template>
              </td>
            </tr>
          </table>
        </div>
      </template>
    </div>
    <div class="my-1">
      <input type="text" pattern="[0-9]+">
      <input type="text">
      <select>
        <option value="mobile">Mobile</option>
        <option value="fixed">Fixed</option>
      </select>
      <input type="checkbox">
      <button>Create Phone</button>
    </div>
    <div class="my-4">
      <h1 class="text-3xl font-bold">Voice Calls</h1>
      <div v-for="(call, key) in gameState.privateCalls" :key="key">
        <p class="text-xl">{{key}}:</p>
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
  props: ['socket'],
  mounted() {
    var that = this;
    this.socket.on('adminStatus', function (msg){
      console.log(msg);
      that.gameState = msg;
    });
  },
  data() {
    return{
      gameState: {}
    }
  },
  methods: {
    kickUserFromCall(user)
    {
      this.socket.emit("adminKickFromCall", {"user": user});
    },
    enableIG(simId) {
      console.log('enableIG', simId)
      this.socket.emit("enableInterfaceGateway", {"simId": simId});
    },
    disableIG(simId) {
      console.log('disableIG', simId)
      this.socket.emit("disableInterfaceGateway", {"simId": simId});
    },
    createPhone(number, name, type, location = null, hidden = false) {
      this.socket.emit("createPhone", {'number': number, 'name': name, 'type': type, 'location':location, 'hidden':hidden});
    }
  }
}
</script>

<style scoped>

</style>
