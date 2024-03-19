<template>
  <div>
    <div class="z-90 bg-gray-600 bg-opacity-75 h-screen w-screen fixed absolute bottom-0 left-0">
      <div class="container flex flex-col min-h-screen mx-auto">
        <div  class="flex-grow py-1"></div>
        <div class="flex-initial py-1 block pt-5 pb-0 bg-white bg-opacity-100 text-center rounded-2xl pb-20">
          <img src="~assets/icons/phone-call-outline.svg" class="mx-auto recIcon" width="150" type=""/>
          <h1 class="text-6xl p-5 font-bold text-green-600">In Call</h1>
          <p class="text-4xl mb-6 font-semibold">You have been in a call for {{timer}}.</p>
<!--          <a class="rounded-2xl mt-4 mx-4 border border-green-600 bg-green-500 py-5 px-20 text-white text-2xl font-semibold hover:bg-green-800 focus:bg-green-800 active:bg-green-800" @click="leaveCall()">Leave Call</a>-->
          <a class="rounded border border-red-900 bg-red-300 text-white text-lg font-bold p-5 ml-2 mr-2 mb-2 hover:bg-red-400 focus:bg-red-400 active:bg-red-400" @click="leaveCall(callData.id)">Leave Call</a>
        </div>
        <div  class="flex-grow py-1"></div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "InCallDialog",
  props: ['callData'],
  data() {
    return {
      time: 0,
      isRunning: false,
      interval: null
    }
  },
  mounted()
  {
    this.toggleTimer();
  },
  computed: {
    timer: function () {
      return new Date(this.time * 1000).toISOString().substr(14,5)
    }
  },
  methods: {
    toggleTimer() {
      if (this.isRunning) {
        clearInterval(this.interval);
        // console.log('timer stops');
      } else {
        this.interval = setInterval(this.incrementTime, 1000);
      }
      this.isRunning = !this.isRunning
    },
    incrementTime() {
      this.time = parseInt(this.time) + 1;
    },
    leaveCall(callId)
    {
      this.$emit('leaveCall', callId);
    }
  }
}
</script>

<style scoped>

</style>
