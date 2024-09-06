<template>
  <div class="mx-auto align-middle">
    <a class="button p-5 ml-2 mr-2 mb-2 inline-block" v-for="phone in phoneData" @click="selectPhone(phone.id)">{{phone.name}}</a>
    <div class="grid grid-cols-4 divide-x divide-gray-500 bg-neutral-300">
      <SpeedDial v-if="showTab === 'speedDial'" :phoneData="phoneData" :selectedPhone="selectedPhone" @place-call="placeCall" />
      <template v-if="showTab === 'panelSelector'">
        <div class="flex flex-col flex-grow col-span-3 mx-2 divide-y divide-gray-500">
          <Sim v-for="simData in gameData" :simData="simData" :socket="socket" :username="username" :selectedPhone="selectedPhone"
              :panel="panel" @movedSim="movedSim" @placedCall="placedCall" class="mb-10" :playerSim="lastChannel"/>
        </div>
      </template>
      <template v-if="showTab === 'dialPad'">
        <div class="flex flex-col">
          <div class="text-right">
          <input maxlength="10" class="border border-purple-600 rounded" placeholder="Phone Number" v-model="phoneNumber" v-on:keyup.enter="callNumber">
            <a class="link" @click="callNumber">Call Number</a>
          </div>
      </div>
      </template>
      <template v-if="showTab === 'incomingCall'">
        <div class="flex-grow">
          <div class="py-5 mx-2">
            <h1 class="flex-grow text-3xl font-semibold ">Incoming Calls</h1>
            
            <div class="mb-5">
              <CallListItem v-for="call in myCalls" :key="call.id" :callData="call" @accept-call="acceptCall" @reject-call="rejectCall" />
            </div>
          </div>
<!--          <a class="rounded border border-red-900 bg-red-400 text-white p-5 ml-2 mr-2 mb-2 hover:bg-red-600 focus:bg-red-600 active:bg-red-600"-->
<!--             @click="muteCall">Mute Ringer</a>-->

        </div>
      </div>
    </div>
    <a class="button p-5 ml-2 mr-2 mb-2 inline-block" @click="changeTab('panelSelector')">Panel Selector</a>
    <a v-if="selectedPhone" class="button p-5 ml-2 mr-2 mb-2 inline-block" @click="changeTab('speedDial')">Speed Dial</a>
    <a v-if="selectedPhone" class="button p-5 ml-2 mr-2 mb-2 inline-block" @click="changeTab('dialPad')">Dial Pad</a>
    <a v-if="selectedPhone" class="button p-5 ml-2 mr-2 mb-2 inline-block" @click="changeTab('incomingCall')">Incoming</a>
    <a class="button p-5 ml-2 mr-2 mb-2 inline-block" @click="moveToLobby()">Join Lobby</a>
    <a class="button p-5 ml-2 mr-2 mb-2 inline-block" @click="markAFK()">AFK</a>
    <a class="rounded border border-red-900 bg-red-600 text-white text-lg font-bold p-5 ml-2 mr-2 mb-2 cursor-pointer hover:bg-red-900 focus:bg-red-900 active:bg-red-900 inline-block"
       @click="considerRECWindow">EMERGENCY CALL</a>

    <CallWindow v-if="incomingCall" :callData="callData" @rejectCall="rejectCall" :callChannel="callChannel" @acceptCall="acceptCall"/>
    <IncomingREC v-if="incomingRec" :callData="callData" @joinREC="joinREC"/>
    <StartREC v-if="considerRec" :gameData="gameData" :socket="socket" :username="username" @cancelRec="cancelREC"
              @startREC="startREC"/>
    <CallPlacedDialog v-if="hasPlacedCall"  :callData="callData" :socket="socket" @hideCallDialog="hidePlacedCall" />
    <InCallDialog v-if="inCall" @leaveCall="leaveCall"/>
    <!--    <audio id="rejectedAudio" :src="require('@/assets/audio/rejected.mp3')" preload="auto"/>-->

  </div>
</template>

<script>
// import '../components/CallListItem';

export default {
  name: "Main",
  props: ["gameData", "socket", "username", "playerData", "socket"],
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
      phoneNumber: ""
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
    this.socket.on("incomingREC", function (msg) {
      that.incomingRec = true;
      that.callChannel = msg.channel;
      that.recAudio.play();
    });
    this.socket.on('newCallInQueue', function (msg) {
      that.callAudio.currentTime = 0;
      that.callAudio.play();
      that.myCalls = msg;
    });
    this.socket.on('updateMyCalls', function (msg){
      that.myCalls = msg;
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
    callNumber(){
      this.placeCall(this.phoneNumber);
    },
    placeCall(key)
    {
      this.placedCall({"receiver":key, "sender": this.selectedPhone})
      this.socket.emit("placeCall", {"receiver":key, "sender": this.selectedPhone});
    },
    acceptCall() {
      this.incomingCall = false;
      this.callAudio.pause();
      this.callAudio.currentTime = 0;
    },
    muteCall() {
      console.info("Mute Call");
      this.callAudio.pause();
      // this.callAudio.stop();
      this.callAudio.currentTime = 0;
    },
    rejectCall() {
      this.incomingCall = false;
      this.callAudio.pause();
      // this.callAudio.stop();
      this.callAudio.currentTime = 0;
    },
    leaveCall() {
      this.socket.emit("leaveCall", {"user": this.username, "sim": this.lastChannel});
      this.inCall = false;
    },
    considerRECWindow() {
      this.considerRec = true;
    },
    startREC() {
      this.considerRec = false;
    },
    cancelREC() {
      this.considerRec = false;
    },
    joinREC(msg) {
      // this.lastChannel = this.panel;
      this.incomingRec = false;
      this.recAudio.pause();
      this.recAudio.currentTime = 0;
      this.socket.emit("joinREC", {"user": this.username,"channel": msg.channel});
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
