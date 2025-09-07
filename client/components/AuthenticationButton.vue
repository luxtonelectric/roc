<script setup lang="ts">
import type { Session } from 'next-auth';
import { Socket } from 'socket.io-client';

const { getSession, status, signOut, signIn } = useAuth()
const session:Session = await getSession();

const props = defineProps({
  socket: Socket
})

function logout() {
  console.log("logging out...");
  props.socket?.emit("playerQuit");
  signOut({ callbackUrl: '/' })
}

</script>

<template>
  <button v-if="status === 'authenticated'" class="w-full bg-red-500 text-white py-1 px-3 text-lg border-4 border-red-700 hover:bg-red-700 hover:border-red-500 aspect-square" @click="logout()">
    <span>Logout</span>
  </button>
  <button v-else class="w-full bg-green-500 text-white py-1 px-3 text-lg border-4 border-green-700 hover:bg-green-700 hover:border-green-500 aspect-square" @click="signIn('discord',{ callbackUrl: '/' })">
    <i class="fa fa-right-to-bracket pt-0.5"></i>
    <span>Login</span>
  </button>
</template>