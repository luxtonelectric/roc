<template>
  <div>
    <div class="z-90 bg-gray-600 bg-opacity-75 h-screen w-screen fixed absolute bottom-0 left-0">
      <div class="container flex flex-col min-h-screen mx-auto">
        <div  class="flex-grow py-1"></div>
        <div class="flex-initial block pt-5 pb-0 bg-white bg-opacity-100 text-center rounded-2xl pb-20">
          <img src="~assets/icons/phone-outline.svg" class="mx-auto" width="150"/>
          <h1 class="text-6xl p-5 font-bold">Railway Emergency Call</h1>
          <p class="text-4xl font-semibold mb-10">Please select the panel you wish to call</p>
          <p>
            <template v-for="(simData, simID) in gameData">
              <template v-for="(panelData, panelID) in simData.panels" :key="panelID">
                <a v-if="panelData.player === username" class="rounded border border-red-900 bg-red-600 text-white text-lg font-bold p-5 ml-2 mr-2 mb-2 hover:bg-red-900 focus:bg-red-900 active:bg-red-900 inline-block" :simData="simData" :socket="socket" @click="startRec(simData.id+'.'+panelID)">{{panelData.name}}</a>
              </template>
            </template>
          </p>
          <p class="my-4 pt-10"><a class="rounded-2xl mx-4 border border-gray-600 bg-gray-500 py-5 px-10 text-white text-2xl font-semibold hover:bg-gray-800 focus:bg-gray-800 active:bg-gray-800" @click="cancelRec()">Cancel</a></p>
        </div>
        <div  class="flex-grow py-1"></div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
name: "StartREC",
  props: ['socket', 'gameData', 'username'],
  mounted() {
    var that = this;
  },
  methods: {
    cancelRec()
    {
      this.$emit("cancelRec", false);
    },
    startRec(panel)
    {
      this.$emit("startREC", false);
    }
  }
}
</script>

<style scoped>

</style>
