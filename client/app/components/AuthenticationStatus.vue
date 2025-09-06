<script setup lang="ts">
import type { Session } from 'next-auth';
import { Socket } from 'socket.io-client';

const { getSession, status, data, signOut, signIn } = useAuth()
const session:Session = await getSession();

const props = defineProps({
  socket: Socket
})

</script>

<template>
  <div class="flex space-x-2">
    <img
      v-if="status === 'authenticated' && data?.user?.image"
      class="w-8 h-8 rounded-full"
      :src="data.user.image"
      alt="User Avatar"
    >
    <h1 v-if="status === 'authenticated'" class="pt-0.5">
      {{ data?.user?.name }}
    </h1>
    <h1 v-else class="text-rose-700 font-bold">
      Not authenticated
    </h1>
  </div>
</template>