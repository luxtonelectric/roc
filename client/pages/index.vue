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
      playerData.value = msg;
    });

    socket.on('disconnect', function (reason){
      console.log(reason);
      error.value = `You have been disconnected from ROC. (${reason})`;
      connected.value = false;
    });
  })

  onUnmounted(() => {
  socket?.disconnect()
})

function joinUser() {
  username.value = session.sub;
  socket?.emit("newPlayer", {discordID: session?.sub});
}
</script>

<style>
.link{
  @apply text-purple-600 cursor-pointer;
}
.link:hover, .link:focus, .link:active{
  @apply text-purple-800
}

.button {
  @apply text-purple-600 cursor-pointer border border-purple-600 rounded p-5 ml-2 mr-2 mb-2
}
.button:hover, .button:focus, .button:active {
  @apply text-purple-800 border-purple-800
}
</style>

<template>
  <div>
    <div v-if="error" class="flex justify-center items-center m-1 font-medium py-1 px-2 bg-white rounded-md text-red-100 bg-red-700 border border-red-700 ">
      <div slot="avatar">
        <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-alert-octagon w-5 h-5 mx-2">
          <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      </div>
      <div class="text-xl font-normal  max-w-full flex-initial">
        {{ error }}</div>
      <div class="flex flex-auto flex-row-reverse">

      </div>
    </div>
    <div v-if="loggedIn">
      <Main :gameData="gameData" :username=username :playerData="playerData" :socket="socket" />
    </div>
    <div v-else>
      <p>Awaiting connection...</p>
    </div>
  </div>
</template>
