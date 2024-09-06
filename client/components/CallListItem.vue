<template>
  <div class="border-b-2 border-gray-400">
    <a class="border border-green-600 bg-green-500 rounded p-5 ml-2 mr-2 mb-2 text-white inline-block hover" @click="acceptCall(callData.id)" href="#">{{ callData.sender.name }} -> {{ callData.receivers[0].name }}</a>
    <a v-if="callData.status ==='accepted'" class="border border-red-600 bg-red-500 rounded p-5 ml-2 mr-2 mb-2 text-white inline-block font-bold" @click="leaveCall(callData.id)">LEAVE</a>
    <a v-else class="border border-red-600 bg-red-500 rounded p-5 ml-2 mr-2 mb-2 text-white inline-block font-bold" @click="rejectCall(callData.id)">REJECT</a>
    <p class="border border-gray-800 bg-gray-500 rounded p-5 ml-2 mr-2 mb-2 text-white inline-block">{{new Date(callData.timePlaced).toLocaleString("en-GB", {hour: "numeric", minute: "numeric", second: "numeric"})}}</p>
  </div>
</template>

<script>
export default {
  name: "CallListItem",
  props: ["socket","callData"],
  methods: {
    acceptCall(callId) {
      this.$emit("acceptCall", callId);
    },
    rejectCall(callId)
    {
      this.$emit("rejectCall", callId);
    },
    leaveCall(callId) {
      this.$emit("leaveCall", callId);
    },
  }
}
</script>

<style scoped>

</style>

<!--    <img src="~assets/icons/phone-outline.svg" class="mr-2 inline-block" width="30"/>-->
