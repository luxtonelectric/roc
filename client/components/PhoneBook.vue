<template>
  <div class="flex pt-2">
    <div class="grid w-full p-2">
      <h1 class="text-center text-3xl font-bold">Phone Book</h1>
    </div>
  </div>
  <div class="flex p-2 h-4/5">
    <div class="flex flex-cols-3 w-full">
      <div class="w-64 border-2 border-zinc-400">
        <div class="w-full border-b-2 border-zinc-400">
          <h2 class="text-center text-xl font-bold ">Num Pad</h2>
        </div>
        <div class="p-2">
          <div class="flex flex-cols-2">
            <div>
              <button class="w-20 h-16 bg-zinc-300 text-black py-1 mb-2 text-lg border-2 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300">
                <a>1</a>
              </button>
              <button class="w-20 h-16 bg-zinc-300 text-black py-1 mb-2 text-lg border-2 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300">
                <a>3</a>
              </button>
              <button class="w-20 h-16 bg-zinc-300 text-black py-1 mb-2 text-lg border-2 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300">
                <a>5</a>
              </button>
              <button class="w-20 h-16 bg-zinc-300 text-black py-1 mb-2 text-lg border-2 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300">
                <a>7</a>
              </button>
              <button class="w-20 h-16 bg-zinc-300 text-black py-1 mb-2 text-lg border-2 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300">
                <a>9</a>
              </button>
            </div>
            <div>
              <button class="w-20 h-16 bg-zinc-300 text-black py-1 mb-2 text-lg border-2 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300">
                <a>2</a>
              </button>
              <button class="w-20 h-16 bg-zinc-300 text-black py-1 mb-2 text-lg border-2 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300">
                <a>4</a>
              </button>
              <button class="w-20 h-16 bg-zinc-300 text-black py-1 mb-2 text-lg border-2 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300">
                <a>6</a>
              </button>
              <button class="w-20 h-16 bg-zinc-300 text-black py-1 mb-2 text-lg border-2 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300">
                <a>8</a>
              </button>
              <button class="w-20 h-16 bg-zinc-300 text-black py-1 mb-2 text-lg border-2 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300">
                <a>0</a>
              </button>
            </div>
          </div>
        </div>
      </div>
      <div class="border-2 border-zinc-400 w-full mx-2">
        <div class="w-full border-b-2 border-zinc-400">
          <h2 class="text-center text-xl font-bold ">Global Directory</h2>
        </div>
        <div class="bg-neutral-200 overflow-scroll overscroll-contain">
          <div class="text-center text-lg w-full">
            <table class="w-full">
              <thead class="border-b border-zinc-400 p-2 bg-zinc-300 text-xl">
                <tr>
                  <th class="border-r border-zinc-400">Contact</th>
                  <th>Number</th>
                </tr>
              </thead>
              <tbody>
                <tr class="border-b border-zinc-300">
                  <td class="border-r border-zinc-300 p-4">Finsbury</td>
                  <td>12345</td>
                </tr>
                <tr class="border-b border-zinc-300 bg-cyan-500">
                  <td class="border-r border-zinc-300 p-4">King's Cross Control</td>
                  <td>23000</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div class="w-40">
        <button class="w-full bg-zinc-300 text-black py-1 px-3 mb-2 text-lg border-2 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300 aspect-square">
          <a>Search</a>
        </button>
        <button class="w-full bg-zinc-300 text-black py-1 px-3 mb-2 text-lg border-2 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300 aspect-square">
          <a>Add</a>
        </button>
        <button class="w-full bg-zinc-300 text-black py-1 px-3 mb-2  text-lg border-2 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300 aspect-square">
          <a>Edit</a>
        </button>
        <button class="w-full bg-zinc-300 text-black py-1 px-3 mb-2  text-lg border-2 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300 aspect-square">
          <a>Delete</a>
        </button>
      </div>
    </div>
  </div>
  <div class="flex px-2 h-1/6">
    <div class="pr-2">
        <button class="w-36 bg-zinc-300 text-black py-1 px-3 text-lg border-2 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300 h-16">
          <a>Global</a>
        </button>
      </div>
      <div>
        <button class="w-36 bg-zinc-300 text-black py-1 px-3 text-lg border-2 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300 h-16">
          <a>Local</a>
        </button>
      </div>
      <div class="px-2">
        <p>2 items in global phone book</p>
      </div>
  </div>
</template>

<script>

export default {
  name: "Phone Book",
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
