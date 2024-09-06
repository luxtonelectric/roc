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
      //console.log(msg);
      playerData.value = msg;
    });

    socket.on("phoneInfo", function (msg){
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
  <div class="pt-4">
    <div class="grid grid-cols-12 gap-0 p-0 border-y-2 border-zinc-400">
      <div class="flex flex-col col-span-2 border-zinc-400 border-x-2 p-2 capitalize truncate justify-center">
        <AuthenticationStatus :socket="socket" />
      </div>
      <div class="flex flex-col col-span-2 border-zinc-400 border-r-2 px-2 text-sm truncate justify-center">
        <p>control</p>
        <p>Fran Franklin (21869)</p>
      </div>
      <div class="flex flex-col col-span-1 border-zinc-400 border-r-2 p-2 justify-center">
        Stack: 0
      </div>
      <div class="flex flex-col col-span-1 border-zinc-400 border-r-2 p-2 justify-center">
        Text: 0
      </div>
      <div v-if="error" class="flex flex-col col-start-10 col-end-11 border-zinc-400 border-x-2 px-2 bg-red-500 text-white text-sm justify-center">
        <p class="text-right font-bold"><span class="font-bold">ROC:</span> ERROR</p>
      </div>
      <div v-else class="flex flex-col col-start-10 col-end-11 border-zinc-400 border-x-2 px-2 text-sm justify-center">
        <p class="text-right"><span class="font-bold">ROC:</span> OK</p>
      </div>
      <div class="col-span-2 border-zinc-400 border-r-2 p-2 text-center">
        <Clock v-for="simData in gameData" :simData="simData" :phoneData="phoneData"/>
      </div>
    </div>
  </div>
</template>