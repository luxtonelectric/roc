<script lang="ts" setup>
import io from 'socket.io-client'
import { Socket } from 'socket.io-client'

const { getSession, status, data, signOut, signIn } = useAuth();
const session: any = await getSession();
const runtimeConfig: any = useRuntimeConfig()

const props = defineProps({gameData: {type: Object, required: true},username: String, playerData: {type: Object, required: true}, phoneData: Object, socket: Socket, error: String, callData: {type: Object, required: true}})

onMounted(() =>{

  })

  onUnmounted(() => {
})
</script>


<template>
  <div class="pt-4">
    <div class="grid grid-cols-12 gap-0 p-0 border-y-2 border-zinc-400">
      <div class="flex flex-col col-span-2 border-zinc-400 border-x-2 p-2 capitalize truncate justify-center">
        <AuthenticationStatus :socket="socket" />
      </div>
      <div class="flex flex-col col-span-2 border-zinc-400 border-r-2 px-2 text-sm truncate justify-center">
        <p>{{playerData.phones.length ? (playerData.phones as Array<any>).map(x => x.name).join(" | ") || "-": "-"}}</p>
      </div>
      <div class="flex flex-col col-span-1 border-zinc-400 border-r-2 p-2 justify-center">
        Stack: {{ callData.length || 0}}
      </div>
      <div class="flex flex-col col-span-1 border-zinc-400 border-r-2 p-2 justify-center">
        <!-- TODO: Add text messages here. -->
        <!-- Text: 0 -->
      </div>
      <div v-if="error" class="flex flex-col col-start-10 col-end-11 border-zinc-400 border-x-2 px-2 bg-red-500 text-white text-sm justify-center">
        <p class="text-right font-bold"><span class="font-bold">ROC:</span> ERROR</p>
      </div>
      <div v-else class="flex flex-col col-start-10 col-end-11 border-zinc-400 border-x-2 px-2 text-sm justify-center">
        <p class="text-right"><span class="font-bold">ROC:</span> OK</p>
      </div>
      <div class="col-span-2 border-zinc-400 border-r-2 p-2 text-center">
        <span class="text-2xl font-bold text-gray-800">
          <!-- TODO: Pull in the time for the currently selected panel-->
          <Clock :clockData="gameData[0]?.time"/>
        </span>
      </div>
    </div>
  </div>
</template>