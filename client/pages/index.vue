<script lang="ts" setup>
import io from 'socket.io-client'
import type { Socket } from 'socket.io-client'
import DialPad from '~/components/DialPad.vue';
import IncomingCalls from '~/components/IncomingCalls.vue';
import PhoneBook from '~/components/PhoneBook.vue';

const { getSession, status, data, signOut, signIn } = useAuth();
const session: any = await getSession();
const runtimeConfig: any = useRuntimeConfig()

const loggedIn = ref(false);
let error = ref("");
const gameData = ref({});
const username = ref("");
const playerData = ref({ phones: {} })
const phoneData = ref({});
const callData = reactive(new Map<string, any>());
const app = useNuxtApp();
let socket: Socket | undefined
const connected = ref(false)
const hasPhones = ref(false)
const showTab = ref("panelSelector");

onMounted(() => {
  socket = io(runtimeConfig.public.socketServer)
  socket.on('connect', () => {
    console.log('connected');
    connected.value = true;
    error.value = "";
    joinUser();
  });

  socket.on("loggedIn", (msg: any) => {
    console.log(msg);
    loggedIn.value = msg.loggedIn;
    error.value = msg.error;
  });

  socket.on("playerLocationUpdate", function (msg) {
    console.log(msg);
  });

  socket.on("gameInfo", function (msg) {
    console.log('gameInfo', msg);
    gameData.value = msg;
  });

  socket.on("playerInfo", function (msg) {
    console.log('playerInfo', msg);
    playerData.value = msg;
    if (typeof msg.phones !== 'undefined') {
      phoneData.value = msg.phones;
      if (msg.phones.length > 0) {
        console.log(msg.phones.length);
        hasPhones.value = true;
      } else {
        hasPhones.value = false;
      }
    }
  });

  socket.on("phonebookUpdate", function (msg) {
    console.log('phonebookUpdate', msg);
    phoneData.value = msg;
    if (msg.length > 0) {
      console.log(msg.length);
      hasPhones.value = true;
    } else {
      hasPhones.value = false;
    }
  });

  socket.on("callQueueUpdate", function (msg) {
    console.log('callQueueUpdate', msg);
    //playerData.value = msg;
    const phoneId: string = msg.phoneId;
    callData[phoneId as keyof any] = msg;

  });

  socket.on('disconnect', function (reason) {
    //console.log(reason);
    error.value = `You have been disconnected from ROC. (${reason})`;
    connected.value = false;
    setTimeout(() => {
      socket.connect();
      console.log('reconnecting...');
    }, 1000);
  });
})

onUnmounted(() => {
  socket?.disconnect()
})


function joinUser() {
  username.value = session.sub;
  socket?.emit("newPlayer", { discordId: session?.sub });
}

function changeTab(tab: string) {
  console.log('change tab', tab);
  showTab.value = tab;
}

</script>

<template>
  <div class="flex flex-col pb-0 px-4 bg-neutral-200 text-lg h-screen max-h-screen">
    <StatusBar :gameData="gameData" :username=username :playerData="playerData" :phoneData="phoneData" :socket="socket"
      :error="error" :callData="callData" />

    <div class="flex flex-row pt-2 h-5/6">
      <div v-if="error" class="mr-2 w-5/6 border-4 border-zinc-400 bg-red-100 h-full text-center">
        <div class="px-4 py-3 text-red-700">
          <p class="font-bold text-xl">An error occurred:</p>
          <p>{{ error }}</p>
        </div>
      </div>
      <div v-else-if="loggedIn"
        class="mr-0 w-5/6 border-4 border-zinc-400 bg-zinc-300 overflow-scroll overscroll-contain h">
        <Selector v-if="showTab === 'panelSelector'" :gameData="gameData" :username=username :playerData="playerData"
          :phoneData="phoneData" :socket="socket" />
        <DialPad v-if="showTab === 'dialPad'" :gameData="gameData" :username=username :playerData="playerData"
          :phoneData="phoneData" :socket="socket" />
        <PhoneBook v-if="showTab === 'phoneBook'" :gameData="gameData" :username=username :playerData="playerData"
          :phoneData="phoneData" :socket="socket" />
        <IncomingCalls v-if="showTab === 'incomingCalls'" :gameData="gameData" :username=username
          :playerData="playerData" :phoneData="phoneData" :socket="socket" />
      </div>
      <div class="grid grid-cols-2 grid-rows-5 gap-4 ml-1 w-1/6">
        <div class="">
          <button @click="changeTab('panelSelector')"
            class="w-full bg-zinc-300 text-black py-1 px-3 text-lg border-4 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300 aspect-square">
            <a>Panel Selection</a>
          </button>
        </div>
        <div class="">
          <AuthenticationButton />
        </div>
        <div class="">
          <button v-if="hasPhones" @click="changeTab('phoneBook')"
            class="w-full bg-zinc-300 text-black py-1 px-3 text-lg border-4 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300 aspect-square">
            <a>Phone Book</a>
          </button>
        </div>
        <div class="">
          <button v-if="hasPhones" @click="changeTab('dialPad')"
            class="w-full bg-zinc-300 text-black py-1 px-3 text-lg border-4 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300 aspect-square">
            <a>Dial Pad</a>
          </button>
        </div>
        <div class="row-start-5">
          <button v-if="hasPhones" @click="changeTab('incomingCalls')"
            class="w-full bg-zinc-300 text-black py-1 px-3 text-lg border-4 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300 aspect-square">
            <a>Incoming Calls</a>
          </button>
        </div>
        <!--div class="row-start-5">
          <MuteButton />
        </div-->
        <!--div class="row-start-6">
          <button class="w-full bg-zinc-300 text-black py-1 px-3 text-lg border-4 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300 aspect-square">
            <a>Join Lobby</a>
          </button>
        </div-->
        <!--div class="row-start-6">
          <button class="w-full bg-zinc-300 text-black py-1 px-3 text-lg border-4 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300 aspect-square">
            <a>Mark AFK</a>
          </button>
        </div-->
      </div>
    </div>
    <div class="flex flex-row">
      <div class="grid grid-cols-3 gap-2 pt-2 w-5/6 pr-2.5">
        <div class="w-full h-full bg-zinc-300 text-black py-2 px-3 text-lg border-4 border-zinc-400">

        </div>
        <div class="w-full h-full bg-zinc-300 text-black py-2 px-3 text-lg border-4 border-zinc-400">

        </div>
        <div class="w-full h-full bg-zinc-300 text-black py-2 px-3 text-lg border-4 border-zinc-400">

        </div>
        <!-- TODO: Do we need this connecting message here?-->
        <!--div class="w-full h-full bg-cyan-500 text-black py-2 px-3 text-lg border-4 border-zinc-400">
          Connecting...
        </div-->
      </div>
      <div class="grid pt-2 w-1/6 pl-0.5">
        <button v-if="hasPhones"
          class="w-full bg-zinc-300 text-black py-2 px-3 text-lg border-4 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300">
          <a>Place Call</a>
        </button>
      </div>
    </div>
  </div>
</template>