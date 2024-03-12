<template>
  <div class="container px-5 mx-auto align-middle">
    <div class="flex py-5">
      <div class="flex-grow">
        <h1 class="text-3xl font-semibold ">{{ simData.name }} ({{simData.id}})</h1>
      </div>
      <a v-if="simData.name.includes('Private Call')" class="rounded border border-red-900 bg-red-300 text-white text-lg font-bold p-5 ml-2 mr-2 mb-2 hover:bg-red-400 focus:bg-red-400 active:bg-red-400" @click="leaveCall">Leave Call</a>
      <a v-else tabindex="0" class="text-2xl link py-1" @click="movePlayer">Join Voice Channel</a>
    </div>
    <div v-if="simData.panels" class="flex flex-wrap">
      <div v-for="(panel, key) in simData.panels" class="w-1/3">
        <h4>{{panel.name}}
          <a v-if="!panel.player" class="" :key="key" @click="claimPanel(simData.id,key)"> - [C]</a>
          <a v-if="panel.player === username" class="" :key="key" @click="releasePanel(simData.id,key)"> - [R]</a>
        </h4>
        <a class="button inline-block" :key="key" @click="placeCall(panel.phone)">Call</a>
        
        
      </div>

    </div>
<!--    <hr class="mt-5"/>-->
  </div>

</template>

<script>
export default {
  name: "Sim",
  props: ["simData", "socket", "username", "panel", "playerSim", "selectedPhone"],
  data() {
    return {
    }
  },
  mounted()
  {
    // this.socket.on("test", function (msg)
    // {
    //   console.log(msg);
    // });
    // this.socket.emit("extraTest", {nolo:false});
  },
  methods: {
    movePlayer()
    {
      this.socket.emit("movePlayerVoiceChannel", {"user": this.username, "channel": this.simData.channel});
      this.$emit("movedSim", this.simData.name);
    },
    claimPanel(sim, key)
    {
      this.socket.emit("claimPanel", {"sim": sim, "panel":key, "sender": this.username});
    },
    releasePanel(sim, key)
    {
      this.socket.emit("releasePanel", {"sim": sim, "panel":key, "sender": this.username});
    },
    placeCall(key)
    {
      this.$emit('placedCall', {"receiver":key, "sender": this.selectedPhone});
      this.socket.emit("placeCall", {"receiver":key, "sender": this.selectedPhone});
    },
    leaveCall()
    {
      this.$emit('leaveCall');
    }
  }
}
</script>

<style scoped>

</style>
