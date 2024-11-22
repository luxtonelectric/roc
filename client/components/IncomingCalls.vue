<template>
  <div class="flex pt-2">
    <div class="grid w-full p-2">
      <h1 class="text-center text-3xl font-bold">Incoming Calls</h1>
    </div>
  </div>
  <div class="grid">
    <div class="grid grid-cols-4 bg-red-600 text-white w-full text-center text-xl py-4 border-y border-zinc-400">
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
    </div>
  </div>
</template>

<script>

export default {
  name: "Incoming Calls",
  props: ["gameData", "socket", "username", "playerData", "socket", "phoneData",],
  data() {
    return {
      panel: "No Panel Set",
      incomingCall: false,
      callData: {user: "test", panel: "test panel", sim: "test sim"},
      rejectedAudio: null,
      callAudio: null,
      recAudio: null,
      considerRec: false,
      incomingRec: false,
      lastChannel: "Lobby",
      selectedPhone: "",
      callChannel: 0,
      myCalls: [],
      hasPlacedCall: false,
      inCall: false,
      phoneNumber: "",
      showTab: "panelSelector"
    }
  },
  created() {
    this.rejectedAudio = new Audio('/audio/rejected.mp3');
    this.callAudio = new Audio('/audio/telephone-ring.mp3');
    this.recAudio = new Audio('/audio/rec.mp3');
    this.callAudio.loop = true;
  },
  mounted() {
    var that = this;

  },
  methods: {
    changeTab(tab) {
      this.showTab = tab;
    },

    callNumber(){
      this.placeCall(this.phoneNumber);
    },
    async placeCall(receiver,type="p2p",level="normal")
    {
      const soc = this.socket;
      const callId = await new Promise(resolve => {soc.emit("placeCall", {"receiver":receiver, "sender": this.selectedPhone, "type":type,"level": level}, response => resolve(response))});
      if(callId) {
        this.placedCall({"receiver":receiver, "sender": this.selectedPhone, "id": callId})
      } else {
        this.rejectedAudio.play();
        console.log('No call id. Something went wrong.');
      }
    },
  }
}
</script>

<style scoped>

</style>
