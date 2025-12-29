<template>
  <div class="flex pt-2">
    <div class="grid w-full p-2">
      <h1 class="text-center text-3xl font-bold">Claim Panels</h1>
    </div>
  </div>
  <div class="flex p-2 h-4/5">
    <div class="grid grid-cols-2 gap-2 w-full">
      <div class="w-full border-2 border-zinc-400">
        <div class="w-full border-b-2 border-zinc-400">
          <h2 class="text-center text-xl font-bold ">Available Panels</h2>
        </div>
        <div class="bg-neutral-200 overflow-scroll overscroll-contain">
          <div class="text-center text-lg w-full">
            <template v-for="sim in gameData">
              <template v-for="panel in sim.panels">
                <h3 v-if="!panel.player" class="border-b border-black p-2" @click="claimPanel(sim.id, panel.id)"><button class="font-mono underline border-2 border-green-800 p-1 rounded decoration-dotted text-sm">{{sim.name}}</button> {{panel.name}}</h3>
              </template>
            </template>
          </div>
        </div>
      </div>
      <div class="w-full border-2 border-zinc-400">
        <div class="w-full border-b-2 border-zinc-400">
          <h2 class="text-center text-xl font-bold">Claimed Panels</h2>
        </div>
        <div class="bg-neutral-200 overflow-scroll overscroll-contain h-99">
          <div class="text-center text-lg w-full">
            <template v-for="sim in gameData">
              <template v-for="panel in sim.panels">
                <h3 v-if="panel.player === username" class="border-b border-black p-2" @click="releasePanel(sim.id, panel.id)"><button class="font-mono underline border-2 border-green-800 p-1 rounded decoration-dotted text-sm">{{sim.name}}</button> {{panel.name}}</h3>
              </template>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>

export default {
  name: "Main",
  props: ["gameData", "socket", "username", "playerData", "socket", "phoneData"],
  data() {
    return {
      panel: "No Panel Set",
      callData: {user: "test", panel: "test panel", sim: "test sim"},
      considerRec: false,
      incomingRec: false,
      lastChannel: "Lobby",
      selectedPhone: "",
      callChannel: 0,
      myCalls: [],
      hasPlacedCall: false,
      inCall: false,
      phoneNumber: "",
      showTab: "panelSelector"
    }
  },
  created() {
  },
  mounted() {
    var that = this;
  },
  methods: {
    changeTab(tab) {
      this.showTab = tab;
    },


    claimPanel(sim, panel)
    {
      this.socket.emit("claimPanel", {"sim": sim, "panel":panel, "sender": this.username});
    },
    releasePanel(sim, panel)
    {
      this.socket.emit("releasePanel", {"sim": sim, "panel":panel, "sender": this.username});
    },
  }
}
</script>

<style scoped>

</style>