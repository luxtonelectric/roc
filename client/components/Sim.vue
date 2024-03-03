<template>
  <div class="container px-5 mx-auto align-middle">
    <div class="flex py-5">
      <div class="flex-grow">
        <h1 class="text-3xl font-semibold ">{{ simData.name }} ({{simData.id}})</h1>
        <h2 v-if="simData.name.includes('Private Call')" class="text-xl">When leaving a call, please use the Leave Call button.</h2>
      </div>
      <a v-if="simData.name.includes('Private Call')" class="rounded border border-red-900 bg-red-300 text-white text-lg font-bold p-5 ml-2 mr-2 mb-2 hover:bg-red-400 focus:bg-red-400 active:bg-red-400" @click="leaveCall">Leave Call</a>
      <p v-else-if="simData.name.includes('Emergency Call')"></p>
      <a v-else tabindex="0" class="text-2xl link py-1" @click="movePlayer">Join Sim</a>
    </div>
    <div v-if="simData.panels">
      <div v-for="(panel, key) in simData.panels">
        <h5>{{panel.name}}</h5>
        <a class="button inline-block" :key="key" @click="placeCall(panel.phone)">Call</a>
        <a v-if="!panel.player" class="button inline-block" :key="key" @click="claimPanel(simData.id,key)">Claim</a>
        <a v-if="panel.player === username" class="button inline-block" :key="key" @click="releasePanel(simData.id,key)">Release</a>
      </div>

    </div>
    <div class="text-right"><input maxlength="10" class="border border-purple-600 rounded" placeholder="Phone Number" v-model="phoneNumber" v-on:keyup.enter="callNumber">
        <a class="link" @click="callNumber">Call Number</a></div>
<!--    <hr class="mt-5"/>-->
  </div>

</template>

<script>
export default {
  name: "Sim",
  props: ["simData", "socket", "username", "panel", "playerSim", "selectedPhone"],
  data() {
    return {
      phoneNumber: "",
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
      this.socket.emit("movePlayerSim", {"user": this.username, "sim": this.simData.id});
      this.$emit("movedSim", this.simData.name);
    },
    callNumber(){
      this.placeCall(this.phoneNumber);
    },
    placeCall(key)
    {
      this.$emit('placedCall', {"receiver":key, "sender": this.selectedPhone});
      this.socket.emit("placeCall", {"receiver":key, "sender": this.selectedPhone});
    },
    claimPanel(sim, key)
    {
      this.socket.emit("claimPanel", {"sim": sim, "panel":key, "sender": this.username});
    },
    releasePanel(sim, key)
    {
      this.socket.emit("releasePanel", {"sim": sim, "panel":key, "sender": this.username});
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
