<template>
  <div class="mx-auto align-middle">
    <div class="flex flex-col">
      <div class="text-right"><input maxlength="25" class="border border-purple-600 rounded" placeholder="Panel Here" v-model="panel" v-on:keyup.enter="sendPanel">
        <a class="link" @click="sendPanel">Set Panel</a></div>
    </div>
<!--    <div class="flex flex-col">-->
<!--      -->
<!--    </div>-->
    <div class="grid grid-cols-4 divide-x divide-gray-500 flex">
      <div class="flex flex-col flex-grow col-span-3 mx-2 divide-y divide-gray-500">
        <Sim v-for="simData in gameData" :simData="simData" :socket="socket" :username="username"
             :panel="panel" @movedSim="movedSim" @leaveCall="leaveCall" @placedCall="placedCall" class="mb-10" :playerSim="lastChannel"/>
      </div>
      <div class="flex-grow">
        <div class="py-5 mx-2">
          <a class="button p-5 ml-2 mr-2 mb-2 inline-block"
             @click="muteCall">Mute Ringer</a>
          <a class="rounded border border-red-900 bg-red-600 text-white text-lg font-bold p-5 ml-2 mr-2 mb-2 hover:bg-red-900 focus:bg-red-900 active:bg-red-900 inline-block"
             @click="considerRECWindow">EMERGENCY CALL</a>
          <h1 class="flex-grow text-3xl font-semibold ">Incoming Calls</h1>

          <div class="mb-5">
              <CallListItem v-for="player in myCalls" :key="player" :callData="player" :socket="socket" :username="username" @acceptedCall="muteCall"/>
          </div>
<!--          <a class="rounded border border-red-900 bg-red-400 text-white p-5 ml-2 mr-2 mb-2 hover:bg-red-600 focus:bg-red-600 active:bg-red-600"-->
<!--             @click="muteCall">Mute Ringer</a>-->

        </div>
      </div>
    </div>

    <div class="text-center mt-4">
      <a tabindex="0" class="link py-1" href="https://bradshaw.onourlines.co.uk/wiki/Disruption_Management" target="_blank">Disruption Management</a>
      | <a tabindex="0" class="link py-1" href="https://simsig.org" target="_blank">SimSig</a>
      | <a tabindex="0" class="link py-1" href="https://bradshaw.onourlines.co.uk/wiki/SimSig:Railway_Operating_Centre" target="_blank">ROC User Manual</a>
    </div>
    <CallWindow v-if="incomingCall" :callData="callData" :socket="socket" :username="username" @rejectCall="rejectCall" :callChannel="callChannel" @acceptCall="acceptCall"/>
    <IncomingREC v-if="incomingRec" :callData="callData" :socket="socket" :username="username" @joinREC="joinREC"/>
    <StartREC v-if="considerRec" :gameData="gameData" :socket="socket" :username="username" @cancelRec="cancelREC"
              @startREC="startREC"/>
    <CallPlacedDialog v-if="hasPlacedCall" @hideCallDialog="hidePlacedCall" />
    <InCallDialog v-if="inCall" @leaveCall="leaveCall"/>
    <!--    <audio id="rejectedAudio" :src="require('@/assets/audio/rejected.mp3')" preload="auto"/>-->

  </div>
</template>

<script>
// import '../components/CallListItem';

export default {
  name: "Main",
  props: ["gameData", "socket", "username"],
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
      callChannel: 0,
      myCalls: [],
      hasPlacedCall: false,
      inCall: false
    }
  },
  created() {
    this.rejectedAudio = new Audio(require('@/assets/audio/rejected.mp3'));
    this.callAudio = new Audio(require('@/assets/audio/telephone-ring.mp3'));
    this.recAudio = new Audio(require('@/assets/audio/rec.mp3'));
    this.callAudio.loop = true;
  },
  mounted() {
    var that = this;
    this.socket.on("incomingCall", function (msg) {
      that.callAudio.currentTime = 0;
      that.incomingCall = true;
      that.callChannel = msg.channel;
      that.callData = msg;
      that.callAudio.play();
    });
    this.socket.on("rejectCall", function (msg) {
      that.incomingCall = false;
      that.hasPlacedCall = false;
      that.rejectedAudio.play();
    });
    this.socket.on("incomingREC", function (msg) {

      that.incomingRec = true;
      that.recAudio.play();
    });
    this.socket.on('newCallInQueue', function (msg) {
      that.callAudio.currentTime = 0;
      that.callAudio.play();
      that.myCalls = msg;
    });
    this.socket.on('updateMyCalls', function (msg){
      that.myCalls = msg;
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
    sendPanel() {
      this.socket.emit("updatePlayerPanel", {"user": this.username, "panel": this.panel});
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
    joinREC() {
      // this.lastChannel = this.panel;
      this.incomingRec = false;
      this.recAudio.pause();
      this.recAudio.currentTime = 0;
      this.socket.emit("joinREC", {"user": this.username});
    },
    movedSim(sim) {
      this.lastChannel = sim;
    },
    placedCall()
    {
      this.hasPlacedCall = true;
    },
    hidePlacedCall()
    {
      this.hasPlacedCall = false;
    }
  }
}
</script>

<style scoped>

</style>
