<template>
  <div class="container px-5 mx-auto align-middle">
    <div class="flex py-5">
      <div class="flex-grow">
        <h1 class="text-3xl font-semibold ">{{ simData.name }} ({{simData.id}})</h1>
      </div>
      <span v-if="simData.time" class="rounded border border-red-900 bg-red-300 text-white text-lg font-bold p-5 ml-2 mr-2 mb-2 hover:bg-red-400 focus:bg-red-400 active:bg-red-400">
        <Clock :clockData="simData.time"/>
      </span>
      <a tabindex="0" class="text-2xl link py-1" @click="movePlayer">Join Voice Channel</a>
    </div>
    <div v-if="simData.panels" class="flex flex-wrap">
      <table>
       <tr v-for="(panel) in simData.panels">
        <td>{{panel.name}}</td>
        <td class="py-1">
          <a v-if="!panel.player" class="cursor-pointer bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded" @click="claimPanel(simData.id, panel.id)">Claim</a>
          <a v-if="panel.player === username" class="cursor-pointer bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded" @click="releasePanel(simData.id,panel.id)">Release</a>
        </td>
       </tr> 
      </table>
    </div>
<!--    <hr class="mt-5"/>-->
  </div>

</template>

<script>
export default {
  name: "Sim",
  props: ["simData", "socket", "username", "panel", "playerSim"],
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
      this.socket.emit("movePlayerVoiceChannel", {"user": this.username, "channel": this.simData.config.channel});
      this.$emit("movedSim", this.simData.name);
    },
    claimPanel(sim, panel)
    {
      this.socket.emit("claimPanel", {"sim": sim, "panel":panel, "sender": this.username});
    },
    releasePanel(sim, panel)
    {
      this.socket.emit("releasePanel", {"sim": sim, "panel":panel, "sender": this.username});
    }
  }
}
</script>

<style scoped>

</style>
