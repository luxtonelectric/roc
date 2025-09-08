<template>
  <button @click="takeAction()"
    :class="`w-full ${backgroundClass} text-black py-1 px-3 text-lg border-4 ${borderClass} ${hoverClass} aspect-square`">
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
      if (this.currentCall && this.currentCall.status === 'offered' && this.phoneData.some((p) => p.id === this.currentCall.sender.id)) {
        this.$emit("rejectCall", this.currentCall.id);
      } else if (this.currentCall && this.currentCall.status === 'accepted') {
        this.$emit("leaveCall", this.currentCall.id);
      } else if (this.preparedCall) {
        this.$emit("placeCall", this.preparedCall);
      } else if (this.nextCall && !this.currentCall) {
        this.$emit("acceptCall", this.nextCall.id);
      } else {
        this.$emit("changeTab", "phoneBook");
      }
    },
    changeScreen() {
      if (this.currentCall) {
        console.log("Current Call:", this.currentCall);
        this.title = "End Call";
        this.line1 = "From: " + this.currentCall.sender.name;
        this.line2 = " -> ";
        this.line3 = "To: " + this.currentCall.receivers[0].name;
      } else if (this.preparedCall) {
        console.log("Prepared Call:", this.preparedCall);
        if(this.preparedCall.level === 'emergency')
        {
          this.title = "Place Emergency Call";
          this.line1 = "From: " + this.preparedCall.sender.name;
          this.line2 = "";
          this.line3 = ""
        } else {
          this.title = "Place Call";
          this.line1 = "From: " + this.preparedCall.sender.name;
          this.line2 = " -> ";
          this.line3 = "To: " + this.preparedCall.receivers[0].name;
        }
      } else if (this.nextCall) {
        this.title = "Answer Call";
        this.line1 = "From: " + this.nextCall.sender.name;
        this.line2 = " -> ";
        this.line3 = "To: " + this.nextCall.receivers[0].name;
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