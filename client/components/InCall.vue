<template>
  <div>
    <div class="z-90 bg-gray-600 bg-opacity-75 h-screen w-screen fixed absolute bottom-0 left-0">
      <div class="container flex flex-col min-h-screen mx-auto">
        <div  class="flex-grow py-1"></div>
        <div class="flex-initial py-1 block pt-5 pb-0 bg-white bg-opacity-100 text-center rounded-2xl pb-20">
          <img src="~assets/icons/phone-outline.svg" class="mx-auto" width="150"/>
          <h1 class="text-6xl p-5 font-bold">In Call</h1>
          <p class="text-4xl font-semibold">{{callData.sim}}</p><p class="text-4xl pb-10 mb-10">{{ callData.panel }}</p>
          <a class="rounded-2xl mx-4 border border-red-600 bg-red-500 py-5 px-20 text-white text-2xl font-semibold hover:bg-red-800 focus:bg-red-800 active:bg-red-800" @click="leaveCall()">Reject</a>
        </div>
        <div  class="flex-grow py-1"></div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "InCall.vue",
  props: ['callData'],
  methods: {
    leaveCall()
    {
      this.$emit('leaveCall');
    }
  }
}
</script>

<style scoped>

</style>
