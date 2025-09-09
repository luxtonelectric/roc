<template>
  <div class="call-actions" :class="{ 'space-x-2': !compact, 'flex flex-col space-y-1': compact }">
    <!-- Accept Button -->
    <button 
      v-if="canAccept"
      @click="$emit('accept')"
      :class="[
        'inline-flex items-center border border-transparent font-medium rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500',
        compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-xs',
        'bg-green-600 hover:bg-green-700'
      ]"
    >
      Accept
    </button>
    
    <!-- Reject Button -->
    <button 
      v-if="canReject"
      @click="$emit('reject')"
      :class="[
        'inline-flex items-center border border-transparent font-medium rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500',
        compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-xs',
        'bg-red-600 hover:bg-red-700'
      ]"
    >
      Reject
    </button>
    
    <!-- Leave Button -->
    <button 
      v-if="canLeave"
      @click="$emit('leave')"
      :class="[
        'inline-flex items-center border border-transparent font-medium rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500',
        compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-xs',
        'bg-red-600 hover:bg-red-700'
      ]"
    >
      Leave
    </button>
    
    <!-- End Button -->
    <button 
      v-if="canEnd"
      @click="$emit('end')"
      :class="[
        'inline-flex items-center border border-transparent font-medium rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500',
        compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-xs',
        'bg-red-600 hover:bg-red-700'
      ]"
    >
      End Call
    </button>
    
    <!-- No Actions Available -->
    <span 
      v-if="!canAccept && !canReject && !canLeave && !canEnd"
      :class="[
        'inline-flex items-center border border-gray-300 font-medium rounded-md text-gray-500',
        compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-xs',
        'bg-gray-100'
      ]"
    >
      No actions
    </span>
  </div>
</template>

<script>
import { PreparedCall } from '~/models/PreparedCall'
import { CallDetails } from '~/models/CallDetails'

export default {
  name: 'CallActionButtons',
  props: {
    call: {
      type: Object,
      required: true
    },
    compact: {
      type: Boolean,
      default: false
    },
    allowAccept: {
      type: Boolean,
      default: true
    },
    allowReject: {
      type: Boolean,
      default: true
    },
    allowLeave: {
      type: Boolean,
      default: true
    },
    allowEnd: {
      type: Boolean,
      default: false
    }
  },
  emits: ['accept', 'reject', 'leave', 'end'],
  computed: {
    canAccept() {
      if (!this.allowAccept) return false
      return this.call.status === PreparedCall.STATUS.OFFERED || 
             this.call.status === CallDetails.STATUS.OFFERED
    },
    canReject() {
      if (!this.allowReject) return false
      return this.call.status === PreparedCall.STATUS.OFFERED || 
             this.call.status === CallDetails.STATUS.OFFERED
    },
    canLeave() {
      if (!this.allowLeave) return false
      return this.call.status === PreparedCall.STATUS.ACCEPTED || 
             this.call.status === CallDetails.STATUS.ACCEPTED
    },
    canEnd() {
      if (!this.allowEnd) return false
      return this.call.status === PreparedCall.STATUS.ACCEPTED || 
             this.call.status === CallDetails.STATUS.ACCEPTED
    }
  }
}
</script>

<style scoped>
.call-actions {
  display: flex;
  align-items: center;
}
</style>
