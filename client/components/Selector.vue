<template>
  <div class="flex p-2">
    <div class="grid w-full p-2">
      <h1 class="text-center text-3xl font-bold">Claim Panels</h1>
    </div>
  </div>
  <div class="flex p-2">
    <div class="grid grid-cols-2 gap-2 w-full h-full">
      <div class="w-full border-2 border-zinc-400">
        <div class="">
          <h2 class="text-center text-xl font-bold w-full border-b-2 border-zinc-400 overflow-scroll overscroll-contain ">Available Panels</h2>
        </div>
        <div class="bg-neutral-200">
          <div class="text-center text-xl uppercase w-full">
            <h3 class="border-b border-black p-2"><span class="text-zinc-800 text-base normal-case">Aston //</span> Alrewas</h3>
            <h3 class="border-b border-black p-2">AN Lichfield Trent Valley</h3>
            <h3 class="border-b border-black p-2">AN Aston</h3>
            <h3 class="border-b border-black p-2">NS North</h3>
            <h3 class="border-b border-black p-2">NS Centre</h3>
            <h3 class="border-b border-black p-2">NS South 1</h3>
            <h3 class="border-b border-black p-2">NS South 2</h3>
          </div>
        </div>
      </div>
      <div class="w-full border-2 border-zinc-400">
        <div class="">
          <h2 class="text-center text-xl font-bold w-full border-b-2 border-zinc-400">Claimed Panels</h2>
        </div>
        <div class="bg-neutral-200">
          <div class="text-center text-lg w-full">
            <h3 class="border-b border-black p-2">SY South Top</h3>
            <h3 class="border-b border-black p-2">SY South Bottom</h3>
            <h3 class="border-b border-black p-2">SY Stratford-upon-Avon</h3>
            <h3 class="border-b border-black p-2">SY Centre</h3>
            <h3 class="border-b border-black p-2">SY North</h3>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>

export default {
  name: "Main",
  props: ["gameData", "socket", "username", "playerData", "socket", "phoneData"],
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
    this.socket.on("rejectCall", function (msg) {
      that.incomingCall = false;
      that.hasPlacedCall = false;
      that.rejectedAudio.play();
    });

    this.socket.on('newCallInQueue', function (msg) {
      if(msg.type === "p2p") {
        that.callAudio.currentTime = 0;
        that.callAudio.play();
        that.myCalls.push(msg);      
      } else if (msg.type === "REC") {
        that.callData = msg;
        that.incomingRec = true;
        that.recAudio.play();
      }
    });
    this.socket.on('removeCallFromQueue', function (msg){
      that.myCalls = that.myCalls.filter(x => x.id !== msg.id);
      if(Object.keys(msg).length === 0) {
        that.callAudio.pause();
      }
    });
    this.socket.on('joinedCall', function (msg){
      that.hasPlacedCall = false;
      that.inCall = true;
      that.callAudio.pause();
    });
    this.socket.on('kickedFromCall', function (msg){
      that.leaveCall();
    });
  },
  methods: {
    changeTab(tab) {
      this.showTab = tab;
    },
    selectPhone(phoneId){
      this.selectedPhone = phoneId;
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
    acceptCall(callId) {
      this.incomingCall = false;
      this.muteRinger();
      const call = {id:callId}
      this.callData = this.myCalls.find(c => c.id === callId);
      this.myCalls = this.myCalls.filter(c => c.id !== callId);
      this.socket.emit('acceptCall', call);

    },
    muteRinger() {
      //console.info("Mute Ringer");
      this.callAudio.pause();
      // this.callAudio.stop();
      this.callAudio.currentTime = 0;
    },
    rejectCall(callId) {
      this.incomingCall = false;
      this.muteRinger();
      this.socket.emit('rejectCall', {id:callId})
    },
    leaveCall(callId) {
      this.socket.emit("leaveCall", {id:callId});
      this.inCall = false;
    },
    considerRECWindow() {
      this.considerRec = true;
    },
    startREC() {
      this.considerRec = false;
      this.placeCall(this.selectedPhone,"REC","emergency")
    },
    cancelREC() {
      this.considerRec = false;
    },
    joinREC(callId) {
      // this.lastChannel = this.panel;
      this.incomingRec = false;
      this.recAudio.pause();
      this.recAudio.currentTime = 0;
      this.acceptCall(callId);
    },
    movedSim(sim) {
      this.lastChannel = sim;
    },
    placedCall(callData)
    {
      this.callData = callData;
      this.hasPlacedCall = true;
    },
    hidePlacedCall()
    {
      //Event happens when you cancel a call.
      this.hasPlacedCall = false;
    },
    moveToLobby()
    {
      this.socket.emit("moveToLobby", {});
    },
    markAFK()
    {
      this.socket.emit("markAFK", {});
    }
  }
}
</script>

<style scoped>

</style>
