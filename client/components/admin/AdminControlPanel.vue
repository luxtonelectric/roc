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
            <tr>
              <td colspan="4">Host</td>
              <td colspan="3">Interface Gateway</td>
            </tr>
            <tr>
              <td>Simulation</td>
              <td>URL/IP</td>
              <td>Voice Chat Channel</td>
              <td>Sim Enabled</td>
              <td>Port</td>
              <td>Connected</td>
              <td>Enabled/Disable</td>
            </tr>
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
      <template v-if="gameState.phones">
        <div>
          <h2 class="text-2xl font-bold">Phones</h2>
          <table>
            <tr v-for="phone in gameState.phones">
              <td><template v-if="phone.location">{{ phone.location.simId }}</template></td>
              <td>{{ phone.name }}</td>
              <td>{{ phone.type }}</td>
              <td><template v-if="phone.type === 'mobile'">{{ phone.id }}</template></td>
              <td><template v-if="phone.player">
                <img class="w-12 h-12 rounded-full" :src="phone.player.avatarURL" :title="phone.player.displayName" :alt="phone.player.displayName"></template></td>
              <td><button v-if="!phone.player" @click="claimPhone(phone.id)">Claim</button></td>
              <td><button>Call</button></td>
            </tr>
          </table>
        </div>
      </template>

      <form @submit.prevent="createPhone">
        <input v-model="newPhone.name" id="newphone_name" type="text" placeholder="Name">
        <input v-model="newPhone.number" id="newphone_number" type="text" title="" pattern="[0-9]+" placeholder="Number">
        <select v-model="newPhone.type" id="newphone_type">
          <option value="mobile">Mobile</option>
          <option value="fixed">Fixed</option>
        </select>
        <!--input type="checkbox" -->
        <button type="submit">Create Phone</button>
      </form>
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
  <div class="my-20">zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz </div>
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
      gameState: {},
      newPhone: {
        name: "",
        number: "",
        type: "mobile",
      }
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
      console.log('createPhone')
      //const phone = {'number': number, 'name': name, 'type': type, 'location':location, 'hidden':hidden};
      //const phone = {'number': '99999', 'name': 'TEST PHONE', 'type': 'mobile', 'location':null, 'hidden':false};
      const phone = this.newPhone;
      phone.location = null;
      phone.hidden = false;
      this.socket.emit("createPhone", phone);
    },
    claimPhone(phoneId) {
      this.socket.emit("claimPhone", {phoneId:phoneId});
    },
    async placeCall(receiver,type="p2p",level="normal")
    {
      const soc = this.socket;
      const callId = await new Promise(resolve => {soc.emit("placeCall", {"receiver":receiver, "sender": this.selectedPhone, "type":type,"level": level}, response => resolve(response))});
      if(callId) {
        this.placedCall({"receiver":receiver, "sender": this.selectedPhone, "id": callId})
      } else {
        this.rejectedAudio.play();
        console.log('No call id. Something went wrong.');
      }
    },
  }
}
</script>

<style scoped>

</style>
