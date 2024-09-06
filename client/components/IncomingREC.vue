<template>
  <div>
    <div class="z-90 bg-gray-600 bg-opacity-75 h-screen w-screen absolute bottom-0 left-0">
      <div class="container flex flex-col min-h-screen mx-auto">
        <div  class="flex-grow py-1"></div>
        <div class="flex-initial py-1 block pt-5 bg-white bg-opacity-100 text-center rounded-2xl pb-20">
          <img src="~assets/icons/phone-call-outline.svg" class="mx-auto recIcon" width="150" type=""/>
<!--          style="color: #e53e3e"-->
          <h1 class="text-6xl p-5 font-bold text-red-600">Railway Emergency Call</h1>
          <p class="text-4xl font-semibold">Joining in:</p><p class="text-4xl pb-10 mb-10"><b>{{countdown}}</b> seconds</p>
          <a class="rounded-2xl mx-4 border border-green-600 bg-green-500 py-5 px-20 text-white text-2xl font-semibold hover:bg-green-800 focus:bg-green-800 active:bg-green-800" @click="joinREC(callData.id)">Accept</a>
        </div>
        <div  class="flex-grow py-1"></div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "IncomingREC",

  props: ['callData'],

  data() {
    return {
      countdown: 5
    }
  },
  created() {
    this.countDownTimer();
  },
  methods: {
    countDownTimer(){
      if(this.countdown > 0)
      {
        setTimeout(()=>{
          this.countdown -= 1;
          this.countDownTimer();
        }, 1000);
      }
      else if(this.countdown === 0)
      {
        this.joinREC();
      }
    },
    joinREC()
    {
      this.countdown = -1;
      console.log('joinREC', this.callData.id);
      this.$emit("joinREC", this.callData.id);
    }
  }


}
</script>

<style scoped>

</style>
