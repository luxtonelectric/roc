<template>
  <tr class="hover:bg-gray-50">
    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
      {{ callData.sender.name }} → {{ callData.receivers[0].name }}
    </td>
    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
      {{ new Date(callData.timePlaced).toLocaleString("en-GB", {hour: "numeric", minute: "numeric", second: "numeric"}) }}
    </td>
    <td class="px-6 py-4 whitespace-nowrap">
      <span 
        :class="[
          'inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium',
          {
            'bg-green-100 text-green-800': callData.status === 'offered' || callData.status === 'accepted',
            'bg-gray-100 text-gray-800': callData.status === 'ended',
            'bg-red-100 text-red-800': callData.status === 'rejected'
          }
        ]"
      >
        {{ callData.status.charAt(0).toUpperCase() + callData.status.slice(1) }}
      </span>
    </td>
    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
      <button 
        v-if="callData.status === 'offered'"
        @click="acceptCall(callData.id)"
        class="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium text-white bg-green-600 hover:bg-green-700 shadow-sm"
      >
        Accept
      </button>
      <button 
        v-if="callData.status === 'accepted'"
        @click="leaveCall(callData.id)"
        class="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 shadow-sm"
      >
        Leave
      </button>
      <button 
        v-if="callData.status === 'offered'"
        @click="rejectCall(callData.id)"
        class="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium text-white bg-red-500 hover:bg-red-600 shadow-sm"
      >
        Reject
      </button>
      <span 
        v-if="callData.status === 'ended' || callData.status === 'rejected'"
        class="text-gray-400 text-sm"
      >
        No actions available
      </span>
    </td>
  </tr>
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
