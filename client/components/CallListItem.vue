<template>
  <div class="border-b-2 border-gray-400">
    <a class="border border-green-600 bg-green-500 rounded p-5 ml-2 mr-2 mb-2 text-white inline-block hover" @click="placeCall(callData.discordID)" href="#">{{callData.sim ? callData.sim : "Unknown Sim"}} - {{ callData.panel ? callData.panel : callData.discordID }}</a>
    <a class="border border-red-600 bg-red-500 rounded p-5 ml-2 mr-2 mb-2 text-white inline-block font-bold" @click="rejectCall(callData.discordID)">X</a>
    <p class="border border-gray-800 bg-gray-500 rounded p-5 ml-2 mr-2 mb-2 text-white inline-block">{{new Date(callData.timePlaced).toLocaleString("en-GB", {hour: "numeric", minute: "numeric", second: "numeric"})}}</p>
  </div>
</template>

<script>
export default {
  name: "CallListItem",
  props: ["socket", "username", "callData"],
  methods: {
    placeCall(user) {
      var other = user;
      console.info(other);
      var yes = {"users": [this.username, other], "sender": other, "user": this.username}
      console.info(yes);
      this.$emit("acceptedCall");
      this.socket.emit('acceptCall', yes);
    },
    rejectCall(user)
    {
      this.socket.emit('rejectCall', {"users": [this.username, user], "sender": user, "user": this.username})
      this.$emit("acceptedCall");
    }
  }
}
</script>

<style scoped>

</style>

<!--    <img src="~assets/icons/phone-outline.svg" class="mr-2 inline-block" width="30"/>-->
