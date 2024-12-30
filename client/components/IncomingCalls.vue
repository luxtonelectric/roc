<template>
  <div class="flex pt-2">
    <div class="grid w-full p-2">
      <h1 class="text-center text-3xl font-bold">Incoming Calls</h1>
    </div>
  </div>
  <div class="grid">
    <template v-for="call in callData">
      <template v-if="call.status === 'incoming'">
        <div class="grid grid-cols-4 bg-zinc-200 text-white w-full text-center text-xl py-4 border-y border-zinc-400">
          <div>{{call.type}}</div>
          <div>{{call.sender.name}}</div>
          <div>{{call.receivers[0].name}}</div>
          <div><button @click="rejectCall(call.id)">Reject</button></div>
        </div>
      </template>
    </template>
    <!--div class="grid grid-cols-4 bg-red-600 text-white w-full text-center text-xl py-4 border-y border-zinc-400">
      <div>Emergency</div>
      <div>23172</div>
      <div>Unknown</div>
      <div>00:13</div>
    </div>
    <div class="grid grid-cols-4 bg-cyan-400 w-full text-center text-xl py-4 border-y border-zinc-400">
      <div>Phone</div>
      <div>21869</div>
      <div>Fran Franklin</div>
      <div>01:03</div>
    </div>
    <div class="grid grid-cols-4 bg-zinc-200 w-full text-center text-xl py-4 border-y border-zinc-400">
      <div>Train</div>
      <div>1X01</div>
      <div>HIT</div>
      <div>03:03</div>
    </div>
    <div class="grid grid-cols-4 bg-zinc-200 w-full text-center text-xl py-4 border-y border-zinc-400">
      <div>Phone</div>
      <div>1555</div>
      <div>IM Services</div>
      <div>05:03</div>
    </div>
    <div class="grid grid-cols-4 bg-zinc-200 w-full text-center text-xl py-4 border-y border-zinc-400">
      <div>Phone</div>
      <div>78192</div>
      <div>Unknown</div>
      <div>06:09</div>
    </div-->
  </div>
</template>

<script>

export default {
  name: "Incoming Calls",
  props: ["callData"],
  emits: ["rejectCall"],
  data() {
    return {

    }
  },
  created() {

  },
  mounted() {
    var that = this;

  },
  methods: {
    rejectCall(key) {
      this.$emit("rejectCall", key);
    }
  }
}
</script>

<style scoped>

</style>
