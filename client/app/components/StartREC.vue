<template>
  <div class="flex pt-2">
    <div class="grid w-full p-2">
      <h1 class="text-center text-3xl font-bold">Railway Emergency Call</h1>
      <p class="text-center text-sm text-gray-600 mt-1">Select the panel you wish to call</p>
    </div>
  </div>
  <div class="flex p-2">
    <div class="flex w-full">
      <div class="w-1/4 border-2 border-zinc-400">
        <div class="w-full border-b-2 border-zinc-400 bg-red-100">
          <h2 class="text-center text-xl font-bold text-red-800">Emergency Panels</h2>
        </div>
        <div class="p-2 space-y-2 max-h-96 overflow-y-auto">
          <template v-for="(phone) in phoneData" :key="phone.id">
            <button  
              @click="startRec(phone)"
              class="w-full bg-red-500 hover:bg-red-600 text-white text-sm font-bold py-3 px-2 border-2 border-red-600 hover:border-red-700 rounded transition-colors duration-200">
              <div class="text-xs">Railway Emergency Call</div>
              <div class="text-sm">{{ phone.name }}</div>
            </button>
          </template>
          <div v-if="!hasClaimedPanels" class="text-center text-gray-500 py-4">
            No panels claimed
          </div>
        </div>
      </div>
      <div class="w-2/4 mx-2">
      </div>
      <div class="w-1/4 mx-2 text-xl font-bold">
        <div class="w-full border-2 border-zinc-400 bg-zinc-300 p-2 my-2 text-center">
          Emergency
        </div>
        <div class="w-full border-2 border-zinc-400 bg-zinc-300 p-2 text-center">
          Call System
        </div>
        <button @click="cancelRec()" class="w-full border-2 border-zinc-400 bg-red-500 hover:bg-red-600 text-white p-2 text-center transition-colors duration-200">
          Cancel
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { PreparedCall } from '~/models/PreparedCall';
export default {
  name: "StartREC",
  props: ['socket', 'phoneData', 'username'],
  emits: ["prepareCall"],
  computed: {
    hasClaimedPanels() {
      if (!this.phoneData || !this.username) return false;
      return true;
    }
  },
  mounted() {
    var that = this;
  },
  methods: {
    startRec(phone)
    {
      console.log("Starting REC from phone:", phone.name);
      const preparedCall = new PreparedCall(
        phone, 
        [{name: "Railway Emergency Call", number: "10101"}], 
        PreparedCall.TYPES.REC, 
        PreparedCall.LEVELS.EMERGENCY
      );
      console.log("Prepared REC Call:", preparedCall);
      this.$emit("prepareCall", preparedCall);
    }
  }
}
</script>

<style scoped>

</style>
