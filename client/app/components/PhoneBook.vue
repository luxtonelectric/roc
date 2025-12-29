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
            <!-- TODO: Make these buttons do something-->
            <!-- div>
              <button
                class="w-20 h-16 bg-zinc-300 text-black py-1 mb-2 text-lg border-2 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300">
                <a>1</a>
              </button>
              <button
                class="w-20 h-16 bg-zinc-300 text-black py-1 mb-2 text-lg border-2 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300">
                <a>3</a>
              </button>
              <button
                class="w-20 h-16 bg-zinc-300 text-black py-1 mb-2 text-lg border-2 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300">
                <a>5</a>
              </button>
              <button
                class="w-20 h-16 bg-zinc-300 text-black py-1 mb-2 text-lg border-2 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300">
                <a>7</a>
              </button>
              <button
                class="w-20 h-16 bg-zinc-300 text-black py-1 mb-2 text-lg border-2 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300">
                <a>9</a>
              </button>
            </div>
            <div>
              <button
                class="w-20 h-16 bg-zinc-300 text-black py-1 mb-2 text-lg border-2 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300">
                <a>2</a>
              </button>
              <button
                class="w-20 h-16 bg-zinc-300 text-black py-1 mb-2 text-lg border-2 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300">
                <a>4</a>
              </button>
              <button
                class="w-20 h-16 bg-zinc-300 text-black py-1 mb-2 text-lg border-2 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300">
                <a>6</a>
              </button>
              <button
                class="w-20 h-16 bg-zinc-300 text-black py-1 mb-2 text-lg border-2 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300">
                <a>8</a>
              </button>
              <button
                class="w-20 h-16 bg-zinc-300 text-black py-1 mb-2 text-lg border-2 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300">
                <a>0</a>
              </button>
            </div -->
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
                  <th>From</th>
                </tr>
              </thead>
              <tbody>
                <template v-for="phone in phoneData">
                  <template v-for="speedDial in phone.speedDial">
                    <tr v-if="!phoneData.some((p) => p.id === speedDial.id)"
                      :class="[selectedReceiver === speedDial.id && selectedPhone === phone.id ? 'bg-cyan-500' : '']"
                      class="border-b border-zinc-300" @click="prepareCall(phone.id, speedDial.id)">
                      <td class="border-r border-zinc-300 p-4">{{
                        speedDial.name }}</td>
                      <td>{{ phone.name }}</td>
                    </tr>
                  </template>
                </template>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div class="w-40">
        <!-- TODO: Make these buttons do something-->
        <!--button
          class="w-full bg-zinc-300 text-black py-1 px-3 mb-2 text-lg border-2 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300 aspect-square">
          <a>Search</a>
        </button>
        <button
          class="w-full bg-zinc-300 text-black py-1 px-3 mb-2 text-lg border-2 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300 aspect-square">
          <a>Add</a>
        </button>
        <button
          class="w-full bg-zinc-300 text-black py-1 px-3 mb-2  text-lg border-2 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300 aspect-square">
          <a>Edit</a>
        </button>
        <button
          class="w-full bg-zinc-300 text-black py-1 px-3 mb-2  text-lg border-2 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300 aspect-square">
          <a>Delete</a>
        </button -->
      </div>
    </div>
  </div>
  <div class="flex px-2 h-1/6">
    <div class="pr-2">
      <button
        class="w-36 bg-zinc-300 text-black py-1 px-3 text-lg border-2 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300 h-16">
        <a>Global</a>
      </button>
    </div>
    <div>
      <button
        class="w-36 bg-zinc-300 text-black py-1 px-3 text-lg border-2 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300 h-16">
        <a>Local</a>
      </button>
    </div>
    <div class="px-2">
      <!-- TODO: This number is not accurate as it includes all the phones even if they're assigned to you. -->
      <p>{{ phoneData.reduce((p, c, i) => { return p + c.speedDial.length }, 0) }} items in global phone book</p>
    </div>
  </div>
</template>

<script>
import { PreparedCall } from '~/models/PreparedCall';


export default {
  name: "Phone Book",
  props: { phoneData: Array, preparedCall: PreparedCall | null },
  data() {
    return {
      selectedPhone: String, 
      selectedReceiver: String
    }
  },
  created() {
  },
  mounted() {
    var that = this;

  },
  emits: ["prepareCall"],
  watch: {
    preparedCall: function () {
        if (this.preparedCall === null) {
          this.selectedPhone = "";
          this.selectedReceiver = "";
        }
    }
  },
  methods: {
    changeTab(tab) {
      this.showTab = tab;
    },

    prepareCall(senderId, receiverId) {
      if (this.selectedReceiver !== receiverId || this.selectedPhone !== senderId) {
        const sender = this.phoneData.find((p) => p.id === senderId);
        const receiver = sender.speedDial.find((sd) => sd.id === receiverId);
        const call = new PreparedCall(sender, [receiver]);
        this.selectedPhone = senderId;
        this.selectedReceiver = receiverId;
        this.$emit("prepareCall", call);
      } else {
        this.$emit("prepareCall", null);
      }
    },
  }
}
</script>

<style scoped></style>
