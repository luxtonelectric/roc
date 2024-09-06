<script lang="ts" setup>
import io from 'socket.io-client'
import type { Socket } from 'socket.io-client'

const { getSession, status, data, signOut, signIn } = useAuth();
const session: any = await getSession();
const runtimeConfig: any = useRuntimeConfig()

const loggedIn = ref(false);
let error =  ref("");
const gameData =  ref({});
const username = ref("");
const playerData =  ref({phones:{}})
const phoneData = ref({});
const app = useNuxtApp();
let socket: Socket | undefined
const connected = ref(false)

onMounted(() =>{
    socket = io(runtimeConfig.public.socketServer)
    socket.on('connect', () => {
      connected.value = true;
      joinUser();
    });
    
    socket.on("loggedIn", (msg:any) => {
      console.log(msg);
      loggedIn.value = msg.loggedIn;
      error.value = msg.error;
    });

    socket.on("playerLocationUpdate", function (msg){
      console.log(msg);
    });

    socket.on("gameInfo", function (msg){
      console.log(msg);
      gameData.value = msg;
    });

    socket.on("playerInfo", function (msg){
      console.log(msg);
      playerData.value = msg;
    });

    socket.on("phonebookUpdate", function (msg){
      console.log('phonebookUpdate', msg);
      phoneData.value = msg;
    });

    socket.on('disconnect', function (reason){
      //console.log(reason);
      error.value = `You have been disconnected from ROC. (${reason})`;
      connected.value = false;
    });
  })

  onUnmounted(() => {
  socket?.disconnect()
})


function joinUser() {
  username.value = session.sub;
  socket?.emit("newPlayer", {discordId: session?.sub});
}
</script>

<template>
  <div class="flex flex-col pb-0 px-4 bg-neutral-200 text-lg h-screen max-h-screen">
    <StatusBar />

    <div class="flex flex-row pt-2 h-5/6">
      <div v-if="error" class="mr-2 w-5/6 border-4 border-zinc-400 bg-red-100 h-full text-center">
        <div class="px-4 py-3 text-red-700">
          <p class="font-bold text-xl">An error occurred:</p>
          <p>{{ error }}</p>
        </div>
      </div>
      <div v-else-if="loggedIn" class="mr-0 w-5/6 border-4 border-zinc-400 bg-zinc-300 overflow-scroll overscroll-contain h">
        <Selector :gameData="gameData" :username=username :playerData="playerData" :phoneData="phoneData" :socket="socket" />
      </div>
      <div class="grid grid-cols-2 grid-rows-5 gap-4 ml-1 w-1/6">
        <div class="">
          <button class="w-full bg-zinc-300 text-black py-1 px-3 text-lg border-4 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300 aspect-square">
            <a>Panel Selection</a>
          </button>
        </div>
        <div class="">
            <AuthenticationButton />
        </div>
        <div class="">
          <button class="w-full bg-zinc-300 text-black py-1 px-3 text-lg border-4 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300 aspect-square">
            <a>Phone Book</a>
          </button>
        </div>
        <div class="">
          <button class="w-full bg-zinc-300 text-black py-1 px-3 text-lg border-4 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300 aspect-square">
            <a>Dial Pad</a>
          </button>
        </div>
        <div class="row-start-5">
          <button class="w-full bg-zinc-300 text-black py-1 px-3 text-lg border-4 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300 aspect-square">
            <a>Incoming Calls</a>
          </button>
        </div>
        <div class="row-start-5">
          <MuteButton />
        </div>
        <div class="row-start-6">
          <button class="w-full bg-zinc-300 text-black py-1 px-3 text-lg border-4 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300 aspect-square">
            <a>Join Lobby</a>
          </button>
        </div>
        <div class="row-start-6">
          <button class="w-full bg-zinc-300 text-black py-1 px-3 text-lg border-4 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300 aspect-square">
            <a>Mark AFK</a>
          </button>
        </div>
      </div>
    </div>
    <div class="flex flex-row">
      <div class="grid grid-cols-3 gap-2 pt-2 w-5/6 pr-2.5">
        <div class="w-full h-full bg-zinc-300 text-black py-2 px-3 text-lg border-4 border-zinc-400">
          
        </div>
        <div class="w-full h-full bg-zinc-300 text-black py-2 px-3 text-lg border-4 border-zinc-400">
          
        </div>
        <div class="w-full h-full bg-cyan-500 text-black py-2 px-3 text-lg border-4 border-zinc-400">
          Connecting...
        </div>
      </div>
      <div class="grid pt-2 w-1/6 pl-0.5">
        <button class="w-full bg-zinc-300 text-black py-2 px-3 text-lg border-4 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300">
            <a>Place Call</a>
          </button>
      </div>
    </div>
  </div>
</template>