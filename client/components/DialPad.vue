<template>
  <div class="flex pt-2">
    <div class="grid w-full p-2">
      <h1 class="text-center text-3xl font-bold">Dial Number</h1>
      <p class="text-center text-sm text-gray-600 mt-1">Click display or start typing to enter a number</p>
    </div>
  </div>
  <div class="grid grid-cols-6 pt-2">
    <div class="grid col-start-3 col-span-2 w-full h-12 p-2 bg-zinc-100 border-2 border-zinc-400 focus:bg-zinc-200 focus:border-zinc-500 cursor-text" 
         tabindex="0" 
         ref="numberDisplay"
         @click="focusDisplay"
         @keydown="handleKeydown">
     {{ phoneNumber }}
    </div>
  </div>
  <div class="flex justify-center pt-2">
    <div class="flex space-x-2">
      <button 
        @click="setPriority('normal')" 
        :class="['px-4 py-2 border-2 font-medium', callPriority === 'normal' ? 'bg-green-500 text-white border-green-600' : 'bg-zinc-300 text-black border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300']">
        Normal
      </button>
      <button 
        @click="setPriority('urgent')" 
        :class="['px-4 py-2 border-2 font-medium', callPriority === 'urgent' ? 'bg-yellow-500 text-white border-yellow-600' : 'bg-zinc-300 text-black border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300']">
        Urgent
      </button>
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
import { PreparedCall } from '~/models/PreparedCall';


export default {
  name: "Dial Pad",
  props: ["phoneData",],
  emits: ["placeCall", "prepareCall"],
  data() {
    return {
      phoneNumber: "",
      callPriority: "normal", // Default to normal priority
    }
  },
  created() {
  },
  mounted() {
    // Auto-focus the number display when component is mounted
    this.$nextTick(() => {
      this.$refs.numberDisplay?.focus();
    });
  },
  beforeUnmount() {
    // Clean up any global event listeners if we had any
  },
  methods: {
    focusDisplay() {
      // Keep the number display focused when clicked
      this.$refs.numberDisplay?.focus();
    },

    handleKeydown(event) {
      // Handle keyboard input for numbers and special keys
      const key = event.key;
      
      // Prevent default behavior for keys we handle
      if (/[0-9]/.test(key) || key === 'Backspace' || key === 'Delete' || key === 'Enter' || key === 'Escape') {
        event.preventDefault();
      }

      if (/[0-9]/.test(key)) {
        // Handle number keys (0-9)
        this.buttonPress(key);
      } else if (key === 'Backspace' || key === 'Delete') {
        // Handle backspace and delete keys
        this.buttonPress('del');
      } else if (key === 'Enter') {
        // Handle enter key to place call
        this.callNumber();
      } else if (key === 'Escape') {
        // Handle escape key to clear
        this.buttonPress('clear');
      }
    },

    changeTab(tab) {
      this.showTab = tab;
    },

    setPriority(priority) {
      this.callPriority = priority;
    },

    callNumber(){
      const preparedCall = new PreparedCall(
        this.phoneData[0], 
        [{id:this.phoneNumber, name:this.phoneNumber}], 
        PreparedCall.TYPES.P2P, 
        this.callPriority
      );
      this.$emit("prepareCall", preparedCall);
      this.$emit("placeCall", preparedCall);
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
  }
}
</script>

<style scoped>

</style>
