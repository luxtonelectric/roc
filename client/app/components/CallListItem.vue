<template>
  <tr class="hover:bg-gray-50">
    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
      <div class="flex items-center space-x-2">
        <span class="text-sm font-medium">{{ callData.sender.name }} → {{ callData.receivers[0].name }}</span>
        <span :class="getTypeClass(callData.type)" class="px-2 py-1 text-xs font-medium rounded-full">
          {{ getTypeLabel(callData.type) }}
        </span>
        <span v-if="callData.level !== PreparedCall.LEVELS.NORMAL" :class="getLevelClass(callData.level)" class="px-2 py-1 text-xs font-medium rounded-full">
          {{ getLevelLabel(callData.level) }}
        </span>
      </div>
    </td>
    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
      {{ new Date(callData.timePlaced).toLocaleString("en-GB", {hour: "numeric", minute: "numeric", second: "numeric"}) }}
    </td>
    <td class="px-6 py-4 whitespace-nowrap">
      <span 
        :class="[
          'inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium',
          {
            'bg-green-100 text-green-800': callData.status === PreparedCall.STATUS.OFFERED || callData.status === PreparedCall.STATUS.ACCEPTED,
            'bg-gray-100 text-gray-800': callData.status === PreparedCall.STATUS.ENDED,
            'bg-red-100 text-red-800': callData.status === PreparedCall.STATUS.REJECTED
          }
        ]"
      >
        {{ getStatusLabel(callData.status) }}
      </span>
    </td>
    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
      <button 
        v-if="callData.status === PreparedCall.STATUS.OFFERED"
        @click="acceptCall(callData.id)"
        class="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium text-white bg-green-600 hover:bg-green-700 shadow-sm"
      >
        Accept
      </button>
      <button 
        v-if="callData.status === PreparedCall.STATUS.ACCEPTED"
        @click="leaveCall(callData.id)"
        class="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 shadow-sm"
      >
        Leave
      </button>
      <button 
        v-if="callData.status === PreparedCall.STATUS.OFFERED"
        @click="rejectCall(callData.id)"
        class="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium text-white bg-red-500 hover:bg-red-600 shadow-sm"
      >
        Reject
      </button>
      <span 
        v-if="callData.status === PreparedCall.STATUS.ENDED || callData.status === PreparedCall.STATUS.REJECTED"
        class="text-gray-400 text-sm"
      >
        No actions available
      </span>
    </td>
  </tr>
</template>

<script>
import { PreparedCall } from '~/models/PreparedCall';

export default {
  name: "CallListItem",
  props: ["socket","callData"],
  data() {
    return {
      PreparedCall // Make PreparedCall available in template
    };
  },
  methods: {
    acceptCall(callId) {
      this.$emit("acceptCall", callId);
    },
    rejectCall(callId) {
      this.$emit("rejectCall", callId);
    },
    leaveCall(callId) {
      this.$emit("leaveCall", callId);
    },
    getTypeClass(type) {
      const typeClasses = {
        [PreparedCall.TYPES.P2P]: 'bg-blue-100 text-blue-800',
        [PreparedCall.TYPES.GROUP]: 'bg-purple-100 text-purple-800',
        [PreparedCall.TYPES.REC]: 'bg-red-100 text-red-800'
      };
      return typeClasses[type] || 'bg-gray-100 text-gray-800';
    },
    getTypeLabel(type) {
      const typeLabels = {
        [PreparedCall.TYPES.P2P]: 'P2P',
        [PreparedCall.TYPES.GROUP]: 'Group',
        [PreparedCall.TYPES.REC]: 'Emergency'
      };
      return typeLabels[type] || type;
    },
    getLevelClass(level) {
      const levelClasses = {
        [PreparedCall.LEVELS.NORMAL]: 'bg-gray-100 text-gray-800',
        [PreparedCall.LEVELS.URGENT]: 'bg-yellow-100 text-yellow-800',
        [PreparedCall.LEVELS.EMERGENCY]: 'bg-red-100 text-red-800'
      };
      return levelClasses[level] || 'bg-gray-100 text-gray-800';
    },
    getLevelLabel(level) {
      const levelLabels = {
        [PreparedCall.LEVELS.NORMAL]: 'Normal',
        [PreparedCall.LEVELS.URGENT]: 'Urgent',
        [PreparedCall.LEVELS.EMERGENCY]: 'Emergency'
      };
      return levelLabels[level] || level;
    },
    getStatusLabel(status) {
      const statusLabels = {
        [PreparedCall.STATUS.OFFERED]: 'Offered',
        [PreparedCall.STATUS.ACCEPTED]: 'Accepted',
        [PreparedCall.STATUS.REJECTED]: 'Rejected',
        [PreparedCall.STATUS.ENDED]: 'Ended'
      };
      return statusLabels[status] || status.charAt(0).toUpperCase() + status.slice(1);
    }
  }
}
</script>

<style scoped>

</style>

<!--    <img src="~assets/icons/phone-outline.svg" class="mr-2 inline-block" width="30"/>-->
