<template>
  <div class="container container mx-auto align-middle">
    <div class="flex-grow py-1 text-center">
      <h1 class="text-6xl">ROC Administration Centre</h1>
    </div>
    <div class="divide-y">
    <div class="my-1">
      <h1 class="text-3xl font-bold">Current Players</h1>
      <div v-if="gameState.gameState">
        <div v-for="(sim, key) in gameState.gameState" :key="key" class="my-1">
          <h2 class="text-xl">{{sim.name}}</h2>
          <a class="button inline-block" v-for="(player, key) in sim.players" :key="key">{{player.panel}} ({{player.discordId}})</a>
        </div>
      </div>
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
    }
  }
}
</script>

<style scoped>

</style>
