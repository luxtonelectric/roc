<template>
  <button @click="takeAction()"
    class="w-full bg-zinc-300 text-black py-1 px-3 text-lg border-4 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300 aspect-square">
    <a>{{ title }}</a><br />
    <a> {{ line1 }}</a><br>
    <a> {{ line2 }} </a>
    <a> {{ line3 }}</a>
  </button>
  <!-- current:{{ currentCall !== null }} next:{{ nextCall !== null }} prep:{{ preparedCall !== null }} -->
</template>

<script>
export default {
  name: "Call Button",
  emits: ["acceptCall", "changeTab", "placeCall", "leaveCall", "rejectCall"],
  props: ["callData", "phoneData", "nextCall", "selectedPhone", "selectedReceiver", "preparedCall", "currentCall"],
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
      if (this.nextCall && !this.currentCall) {
        this.$emit("acceptCall", this.nextCall.id);
      } else if (this.currentCall && this.currentCall.status === 'offered' && this.phoneData.some((p) => p.id === this.currentCall.sender.id)) {
        this.$emit("rejectCall", this.currentCall.id);
      } else if (this.currentCall && this.currentCall.status === 'accepted') {
        this.$emit("leaveCall", this.currentCall.Id);
      } else if (this.preparedCall) {
        this.$emit("placeCall", this.preparedCall);
      } else {
        this.$emit("changeTab", "phoneBook");
      }
    },
    changeScreen() {
      if (this.currentCall) {
        this.title = "End Call";
        this.line1 = "From: " + this.currentCall.sender.name;
        this.line2 = " -> ";
        this.line3 = "To: " + this.currentCall.receivers[0].name;
      } else if (this.nextCall) {
        this.title = "Answer Call";
        this.line1 = "From: " + this.nextCall.sender.name;
        this.line2 = " -> ";
        this.line3 = "To: " + this.nextCall.receivers[0].name;
      } else if (this.preparedCall) {
        this.title = "Place Call";
        this.line1 = "From: " + this.preparedCall.sender.name;
        this.line2 = " -> ";
        this.line3 = "To: " + this.preparedCall.receivers[0].name;
      } else {
        this.title = "Call";
        this.line1 = "";
        this.line2 = "";
        this.line3 = "";
      }
    },
  },
  mounted() {

  },
  watch: {
    nextCall: function () {
      this.changeScreen();
    },
    currentCall: function () {
      this.changeScreen();
    },
    preparedCall: function () {
      this.changeScreen();
    },
  },
  beforeUnmount() {

  },
};
</script>