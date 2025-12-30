<template>
  <button @click="takeAction()"
    :class="`w-full ${backgroundClass} text-black py-1 px-3 text-lg border-4 ${borderClass} ${hoverClass} aspect-square`">
    <a>{{ title }}</a><br />
    <a> {{ line1 }}</a><br>
    <a> {{ line2 }} </a>
    <a> {{ line3 }}</a>
  </button>
</template>

<script>
import { PreparedCall } from '~/models/PreparedCall'
import { CallDetails } from '~/models/CallDetails'

export default {
  name: "CallButton",
  emits: ["acceptCall", "changeTab", "placeCall", "leaveCall", "rejectCall", "terminateGroupCall"],
  props: {
    currentCall: {
      type: Object,
      default: null
    },
    nextCall: {
      type: Object,
      default: null
    },
    preparedCall: {
      type: Object,
      default: null
    },
    inCall: {
      type: Boolean,
      default: false
    },
    incomingCall: {
      type: Boolean,
      default: false
    },
    phoneData: {
      type: Array,
      default: () => []
    }
  },
  data() {
    return {
      title: "Call",
      line1: "",
      line2: "",
      line3: "",
    };
  },
  computed: {
    currentCallLevel() {
      if (this.currentCall && this.currentCall.level) {
        return this.currentCall.level;
      }
      if (this.preparedCall && this.preparedCall.level) {
        return this.preparedCall.level;
      }
      if (this.nextCall && this.nextCall.level) {
        return this.nextCall.level;
      }
      return 'normal';
    },
    backgroundClass() {
      switch (this.currentCallLevel) {
        case 'emergency':
          return 'bg-red-600';
        case 'urgent':
          return 'bg-orange-300';
        case 'normal':
        default:
          return 'bg-zinc-300';
      }
    },
    borderClass() {
      switch (this.currentCallLevel) {
        case 'emergency':
          return 'border-red-700';
        case 'urgent':
          return 'border-orange-400';
        case 'normal':
        default:
          return 'border-zinc-400';
      }
    },
    hoverClass() {
      switch (this.currentCallLevel) {
        case 'emergency':
          return 'hover:bg-red-700 hover:border-red-600';
        case 'urgent':
          return 'hover:bg-orange-400 hover:border-orange-300';
        case 'normal':
        default:
          return 'hover:bg-zinc-400 hover:border-zinc-300';
      }
    }
  },
  methods: {
    takeAction() {
      // If we're in a call, decide whether to leave or terminate (sender of a GROUP/REC must terminate)
      if (this.inCall && this.currentCall) {
        const isVGCS = (this.currentCall.type === 'group' || this.currentCall.type === 'REC');
        const isSender = this.phoneData.some((p) => p.id === this.currentCall.sender?.id);
        if (isVGCS && isSender) {
          // Emit terminate for sender in group/REC calls (passes sender phone id)
          this.$emit('terminateGroupCall', this.currentCall.sender?.id);
        } else {
          // Participant or P2P: leave the call (server will handle termination for P2P)
          this.$emit('leaveCall', this.currentCall.id);
        }
        return;
      }
      
      // If we have an outgoing call that's been offered and we own the sender phone, reject it
      if (this.currentCall && 
          this.currentCall.status === 'offered' && 
          this.phoneData.some((p) => p.id === this.currentCall.sender.id)) {
        this.$emit("rejectCall", this.currentCall.id);
        return;
      }
      
      // If we have a prepared call, place it
      if (this.preparedCall) {
        this.$emit("placeCall", this.preparedCall);
        return;
      }
      
      // If we have an incoming call, accept it
      if (this.nextCall && !this.currentCall) {
        this.$emit("acceptCall", this.nextCall.id);
        return;
      }
      
      // Default action - go to phone book
      this.$emit("changeTab", "phoneBook");
    },
    
    updateDisplay() {
      // Debug logging to understand call objects structure
      if (this.currentCall) {
        console.log('CallButton - currentCall:', this.currentCall);
        console.log('CallButton - currentCall methods:', {
          hasGetReceiverDisplayName: typeof this.currentCall.getReceiverDisplayName === 'function',
          hasReceivers: !!this.currentCall.receivers,
          type: typeof this.currentCall,
          status: this.currentCall.status
        });
      }
      
      if (this.inCall && this.currentCall) {
        const isVGCS = (this.currentCall.type === 'group' || this.currentCall.type === 'REC');
        const isSender = this.phoneData.some((p) => p.id === this.currentCall.sender?.id);
        this.title = (isVGCS && isSender) ? "Terminate Call" : "End Call";
        this.line1 = "From: " + (this.currentCall.sender?.name || 'Unknown');
        this.line2 = " ↔ ";
        // Use unified architecture method for active call receiver display
        const receiverName = this.currentCall.getReceiverDisplayName?.() || 'Unknown';
        this.line3 = "To: " + receiverName;
      } else if (this.currentCall && 
                 this.currentCall.status === 'offered' && 
                 this.phoneData.some((p) => p.id === this.currentCall.sender.id)) {
        // This is our outgoing call that hasn't been accepted yet
        this.title = "Cancel Call";
        this.line1 = "From: " + (this.currentCall.sender?.name || 'Unknown');
        this.line2 = " → ";
        // Use unified architecture method for currentCall receiver display
        const receiverName = this.currentCall.getReceiverDisplayName?.() || 'Unknown';
        this.line3 = "To: " + receiverName;
      } else if (this.preparedCall) {
        if (this.preparedCall.level === 'emergency') {
          this.title = "Place Emergency Call";
          this.line1 = "From: " + (this.preparedCall.sender?.name || 'Unknown');
          this.line2 = "";
          this.line3 = "";
        } else {
          this.title = "Place Call";
          this.line1 = "From: " + (this.preparedCall.sender?.name || 'Unknown');
          this.line2 = " → ";
          // Use the unified receiver architecture and getReceiverDisplayName method
          const targetName = this.preparedCall.getReceiverDisplayName?.() || 
                            this.preparedCall.receiver?.name || 
                            (typeof this.preparedCall.receiver === 'string' ? this.preparedCall.receiver : 'Unknown');
          this.line3 = "To: " + targetName;
        }
      } else if (this.nextCall) {
        this.title = "Answer Call";
        this.line1 = "From: " + (this.nextCall.sender?.name || 'Unknown');
        this.line2 = " → ";
        // Use unified architecture method for nextCall receiver display
        const receiverName = this.nextCall.getReceiverDisplayName?.() || 'Unknown';
        this.line3 = "To: " + receiverName;
      } else {
        this.title = "Call";
        this.line1 = "";
        this.line2 = "";
        this.line3 = "";
      }
    },
  },
  mounted() {
    this.updateDisplay();
  },
  watch: {
    nextCall: function () {
      this.updateDisplay();
    },
    currentCall: function () {
      this.updateDisplay();
    },
    preparedCall: function () {
      this.updateDisplay();
    },
    inCall: function () {
      this.updateDisplay();
    }
  },
};
</script>

<style scoped>
button {
  transition: all 0.2s ease-in-out;
}
</style>
