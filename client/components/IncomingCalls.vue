<template>
  <div class="flex pt-2">
    <div class="grid w-full p-2">
      <h1 class="text-center text-3xl font-bold">Incoming Calls</h1>
    </div>
  </div>
  <div class="grid">
    <template v-for="call in sortedOfferedCalls" :key="call.id">
      <div 
        class="grid grid-cols-4 w-full text-center text-xl py-4 border-y border-zinc-400 cursor-pointer hover:opacity-80 transition-opacity"
        :class="getCallRowClass(call)"
        @click="selectCall(call)"
      >
        <div>{{call.type}}</div>
        <div>{{call.sender.name}}</div>
        <div>{{call.receivers[0].name}}</div>
        <div>
          <button 
            @click.stop="rejectCall(call.id)"
            class="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Reject
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<script>

export default {
  name: "Incoming Calls",
  props: ["callData"],
  emits: ["rejectCall", "selectCall"],
  data() {
    return {

    }
  },
  computed: {
    sortedOfferedCalls() {
      // Filter to only show offered calls (incoming calls)
      const offeredCalls = this.callData.filter(call => call.status === 'offered');
      
      // Sort by priority: emergency (1), urgent (2), normal (3)
      return offeredCalls.sort((a, b) => {
        const priorityOrder = {
          'emergency': 1,
          'urgent': 2,
          'normal': 3
        };
        return priorityOrder[a.level] - priorityOrder[b.level];
      });
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
    },
    selectCall(call) {
      this.$emit("selectCall", call);
    },
    getCallRowClass(call) {
      // Return appropriate CSS classes based on call priority
      switch (call.level) {
        case 'emergency':
          return 'bg-red-600 text-white';
        case 'urgent':
          return 'bg-yellow-400 text-black';
        case 'normal':
        default:
          return 'bg-zinc-200 text-black';
      }
    }
  }
}
</script>

<style scoped>

</style>
