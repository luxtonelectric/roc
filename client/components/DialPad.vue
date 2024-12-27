<template>
  <div class="flex pt-2">
    <div class="grid w-full p-2">
      <h1 class="text-center text-3xl font-bold">Dial Number</h1>
    </div>
  </div>
  <div class="grid grid-cols-6 pt-2">
    <div class="grid col-start-3 col-span-2 w-full h-12 p-2 bg-zinc-100 border-2 border-zinc-400">
     {{ phoneNumber }}
    </div>
  </div>
  <div class="flex p-2">
    <div class="flex w-full">
      <div class="w-1/4 border-2 border-zinc-400">
        <div class="w-full border-b-2 border-zinc-400">
          <h2 class="text-center text-xl font-bold">Num Pad</h2>
        </div>
        <div class="p-2">
          <div class="flex flex-cols">
            <div class="w-1/3">
              <button class="w-20 h-16 bg-zinc-300 text-black mb-2 text-lg border-2 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300" @click="buttonPress('1')">
                <a>1</a>
              </button>
              <button class="w-20 h-16 bg-zinc-300 text-black mb-2 text-lg border-2 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300" @click="buttonPress('4')">
                <a>4</a>
              </button>
              <button class="w-20 h-16 bg-zinc-300 text-black mb-2 text-lg border-2 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300" @click="buttonPress('7')">
                <a>7</a>
              </button>
              <button class="w-20 h-16 bg-zinc-300 text-black text-lg border-2 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300" @click="buttonPress('clear')">
                <a>Clear</a>
              </button>
            </div>
            <div class="w-1/3">
              <button class="w-20 h-16 bg-zinc-300 text-black mb-2 text-lg border-2 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300" @click="buttonPress('2')">
                <a>2</a>
              </button>
              <button class="w-20 h-16 bg-zinc-300 text-black mb-2 text-lg border-2 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300" @click="buttonPress('5')">
                <a>5</a>
              </button>
              <button class="w-20 h-16 bg-zinc-300 text-black mb-2 text-lg border-2 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300" @click="buttonPress('8')">
                <a>8</a>
              </button>
              <button class="w-20 h-16 bg-zinc-300 text-black text-lg border-2 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300" @click="buttonPress('0')">
                <a>0</a>
              </button>
            </div>
            <div class="w-1/3">
              <button class="w-20 h-16 bg-zinc-300 text-black mb-2 text-lg border-2 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300" @click="buttonPress('3')">
                <a>3</a>
              </button>
              <button class="w-20 h-16 bg-zinc-300 text-black mb-2 text-lg border-2 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300" @click="buttonPress('6')">
                <a>6</a>
              </button>
              <button class="w-20 h-16 bg-zinc-300 text-black mb-2 text-lg border-2 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300" @click="buttonPress('9')">
                <a>9</a>
              </button>
              <button class="w-20 h-16 bg-zinc-300 text-black text-lg border-2 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300" @click="buttonPress('del')">
                <a>Del</a>
              </button>
            </div>
          </div>
        </div>
      </div>
      <div class="w-2/4 mx-2">
      </div>
      <div class="w-1/4 mx-2 text-xl font-bold">
        <div class="w-full border-2 border-zinc-400 bg-zinc-300 p-2 my-2 text-center">
          Telephone
        </div>
        <div class="w-full border-2 border-zinc-400 bg-zinc-300 p-2 text-center">
          Headcode
        </div>
        <button @click="callNumber()" class="w-full border-2 border-zinc-400 bg-zinc-300 p-2 text-center">
          Call
        </button>
      </div>
    </div>
  </div>
</template>

<script>

export default {
  name: "Dial Pad",
  props: ["gameData", "socket", "username", "playerData", "socket", "phoneData",],
  data() {
    return {
      panel: "No Panel Set",
      incomingCall: false,
      callData: {user: "test", panel: "test panel", sim: "test sim"},
      rejectedAudio: null,
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

    buttonPress(val) {
      console.log(val);
      switch (val) {
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
        case '0':
          this.phoneNumber += val;
          break;
        case 'del':
          this.phoneNumber = this.phoneNumber.slice(0,-1);
          break;
        case 'clear':
          this.phoneNumber = "";
          break;
        default:
          break;
      }
    },

    async placeCall(receiver,type="p2p",level="normal")
    {
      const soc = this.socket;
      const callId = await new Promise(resolve => {soc.emit("placeCall", {"receiver":receiver, "sender": this.playerData.phones[0].id, "type":type,"level": level}, response => resolve(response))});
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
