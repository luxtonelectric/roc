<template>
  <button @click="takeAction()"
    class="w-full bg-zinc-300 text-black py-1 px-3 text-lg border-4 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300 aspect-square">
    <a>{{ title }}</a><br />
    <a> {{ line1 }}</a><br>
    <a> {{ line2 }} </a>
    <a> {{ line3 }}</a>
  </button>
  inC:{{ isInCall }} hasIC:{{ hasIncomingCall }} isCP:{{ isCallPrepared }}
</template>

<script>
export default {
  name: "Call Button",
  emits: ["acceptCall", "changeTab", "placeCall","leaveCall", "rejectCall"],
  props: ["callData", "phoneData", "hasIncomingCall", "isInCall", "selectedPhone", "selectedReceiver", "currentCallId", "isCallPrepared", "incomingCallId"],
  data() {
    return {
      title: "Call",
      line1: "",
      line2: "",
      line3: "",
    };
  },
  methods: {
    takeAction() {
      const currentCall = this.callData.get(this.currentCallId);
      console.log(currentCall);
      if (this.hasIncomingCall && !this.isInCall) {
        this.$emit("acceptCall", this.currentCallId);
      } else if (this.isInCall && currentCall.status === 'offered' && this.phoneData.some((p) => p.id === currentCall.sender.id)) {
        this.$emit("rejectCall", this.currentCallId);
      } else if (this.isInCall) {
        this.$emit("leaveCall", this.currentCallId);
      } else if (this.isCallPrepared) {
        this.$emit("placeCall", this.selectedReceiver);
      } else {
        this.$emit("changeTab", "phoneBook");
        // this.$emit("placeCall", selectedPhone, selectedReceiver);
      }
    },
  },
  mounted() {

  },
  watch: {
    hasIncomingCall: function () {
      console.log("hasIncomingCall changed");
      if (this.hasIncomingCall && !this.isInCall) {
        if(this.callData) {
          const incomingCall = this.callData.get(this.incomingCallId);
          this.title = "Answer Call";
          this.line1 = "From: " + incomingCall.sender.name;
          this.line2 = " -> ";
          this.line3 = "To: " + incomingCall.receivers[0].name;
        }
      }
    },
    isInCall: function () {
      console.log("isInCall changed");
      if (this.isInCall) {
        this.title = "End Call";
      } else if (!this.hasIncomingCall && !this.isInCall && !this.isCallPrepared) {
        this.title = "Call";
        this.line1 = "";
        this.line2 = "";
        this.line3 = " ";
      }
    },
    isCallPrepared: function () {
      console.log("isCallPrepared changed");
      if (this.isCallPrepared && !this.isInCall && !this.hasIncomingCall) {
        this.title = "Place Call";
        this.line1 = "From: " + this.selectedPhone;
        this.line2 = " -> ";
        this.line3 = "To: " + this.selectedReceiver;
      }
    },
  },
  beforeUnmount() {

  },
};
</script>