<script lang="ts" setup>
import io from 'socket.io-client'
import type { Socket } from 'socket.io-client'

const { getSession, status, data, signOut, signIn } = useAuth();
const session: any = await getSession();
const runtimeConfig: any = useRuntimeConfig()

const loggedIn = ref(false);
let error = ref("");
const gameData = ref({});
const username = ref("");
const playerData = ref({ phones: {} })
const phoneData = ref({});
const app = useNuxtApp();
let socket: Socket | undefined
const connected = ref(false)

onMounted(() => {
  socket = io(runtimeConfig.public.socketServer)
  socket.on('connect', () => {
    connected.value = true;
    adminLogin();
  });

  socket.on("loggedIn", (msg: any) => {
    console.log(msg);
    loggedIn.value = msg.loggedIn;
    error.value = msg.error;
  });

  socket.on('authd', (msg) => {
    loggedIn.value = true;
  });

  socket.on("playerLocationUpdate", function (msg) {
    console.log(msg);
  });

  socket.on("gameInfo", function (msg) {
    console.log(msg);
    gameData.value = msg;
  });

  socket.on("playerInfo", function (msg) {
    //console.log(msg);
    playerData.value = msg;
  });

  socket.on("phoneInfo", function (msg) {
    phoneData.value = msg;
  });

  socket.on('disconnect', function (reason) {
    //console.log(reason);
    error.value = `You have been disconnected from ROC. (${reason})`;
    connected.value = false;
  });
})

onUnmounted(() => {
  socket?.disconnect()
})


function adminLogin() {
  console.log('adminLogin');
  username.value = session.sub;
  socket?.emit("adminLogin", { discordId: session?.sub });
}
</script>

<template>
  <div>
    <AdminControlPanel v-if="loggedIn" :socket="socket" />
    <AdminLogin v-else @adminLogin="adminLogin" />
  </div>
  <div class="fixed bottom-0 w-full">
    <AuthenticationStatus :socket="socket" />
  </div>
</template>

<style>
.link {
  @apply text-purple-600 cursor-pointer;
}

.link:hover,
.link:focus,
.link:active {
  @apply text-purple-800
}

.button {
  @apply text-purple-600 cursor-pointer border border-purple-600 rounded p-5 ml-2 mr-2 mb-2
}

.button:hover, .button:focus, .button:active {
  @apply text-purple-800 border-purple-800
}
</style>
