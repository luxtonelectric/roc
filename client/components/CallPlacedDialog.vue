<template>
  <div>
    <div class="z-90 bg-gray-600 bg-opacity-75 h-screen w-screen absolute bottom-0 left-0">
      <div class="container flex flex-col min-h-screen mx-auto">
        <div  class="flex-grow py-1"></div>
        <div class="flex-initial py-1 block pt-5 bg-white bg-opacity-100 text-center rounded-2xl pb-20">
          <img src="~assets/icons/phone-call-outline.svg" class="mx-auto recIcon" width="150" type=""/>
          <!--          style="color: #e53e3e"-->
          <h1 class="text-6xl p-5 font-bold text-green-600">Call Placed</h1>
          <p class="text-4xl mb-6 font-semibold">You have been waiting for {{timer}}.</p>
          <a class="rounded-2xl mt-4 mx-4 border border-green-600 bg-green-500 py-5 px-20 text-white text-2xl font-semibold hover:bg-green-800 focus:bg-green-800 active:bg-green-800" @click="hangUp()">Hang Up</a>
        </div>
        <div  class="flex-grow py-1"></div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "CallPlacedDialog",
  props: ["socket", "callData"],
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
    hangUp()
    {
      this.socket.emit('rejectCall', {"senderPhoneId": this.callData.sender, "receiverPhoneId": this.callData.receiver})
      this.$emit('hideCallDialog');
    }
  }
}
</script>

<style scoped>

</style>
