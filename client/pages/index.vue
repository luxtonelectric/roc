<script lang="ts" setup>
import io from 'socket.io-client'
import type { Socket } from 'socket.io-client'
import DialPad from '~/components/DialPad.vue';
import PhoneBook from '~/components/PhoneBook.vue';
import type { PreparedCall } from '~/models/PreparedCall';
import { useCallManager } from '~/composables/useCallManager'
import CallDisplay from '~/components/shared/CallDisplay.vue'
import CallStatus from '~/components/shared/CallStatus.vue'
import CallButton from '~/components/shared/CallButton.vue'

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
const hasPhones = ref(false)
const showTab = ref("panelSelector");

// Create a reactive socket reference
const socketRef = ref(null)

// Initialize unified call manager with client-specific options
const callManager = useCallManager(
  socketRef, 
  gameData, 
  phoneData, 
  (title: string, message: string) => console.error(title, message), 
  (title: string, message: string) => console.log(title, message),
  {
    enableAudio: true,
    autoAcceptREC: true,
    enableQueueManagement: true
  }
)

// Destructure call manager properties
const {
  currentCall,
  nextCall,
  preparedCall,
  callQueue,
  inCall,
  incomingCall,
  queuedCallsCount,
  sortedIncomingCalls,
  placeCall,
  acceptCall,
  rejectCall,
  leaveCall,
  selectCall,
  setupCallEventListeners,
  removeCallEventListeners
} = callManager

onMounted(() => {
  socket = io(runtimeConfig.public.socketServer)
  
  socket.on('connect', () => {
    console.log('connected');
    connected.value = true;
    error.value = "";
    joinUser();
    
    // Update the socket reference for the call manager
    socketRef.value = socket;
    
    // Set up unified call event listeners
    setupCallEventListeners();
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
        msg.phones.forEach((phone) => {
          console.log('requesting phone queue update', phone.id);
          socket?.emit("requestPhoneQueueUpdate", { id: phone.id });
        });
      } else {
        hasPhones.value = false;
      }
    }
  });

  socket.on("phonebookUpdate", function (msg) {
    console.log('phonebookUpdate', msg);
    phoneData.value = msg;
    if (msg.length > 0) {
      hasPhones.value = true;
    } else {
      hasPhones.value = false;
    }
  });

  socket.on('disconnect', function (reason) {
    error.value = `You have been disconnected from ROC. (${reason})`;
    connected.value = false;
    setTimeout(() => {
      socket?.connect();
      console.log('reconnecting...');
    }, 1000);
  });
})

onUnmounted(() => {
  removeCallEventListeners(); // Clean up unified call event listeners
  socket?.disconnect()
})

function joinUser() {
  username.value = session.sub;
  socket?.emit("newPlayer", { discordId: session?.sub });
}

function changeTab(tab: string) {
  showTab.value = tab;
}

function prepareCall(call: PreparedCall) {
  preparedCall.value = call;
}

</script>

<template>
  <div class="flex flex-col pb-0 px-4 bg-neutral-200 text-lg h-screen max-h-screen">
    <!-- Status Bar with unified call status -->
    <StatusBar 
      :gameData="gameData" 
      :username="username" 
      :playerData="playerData" 
      :phoneData="phoneData" 
      :socket="socket"
      :error="error" 
      :callData="callQueue" 
    >
      <!-- Enhanced call status display -->
      <template #call-status>
        <CallStatus 
          :current-call="currentCall"
          :in-call="inCall"
          :incoming-call="incomingCall"
          :queued-calls-count="queuedCallsCount"
          :show-count="true"
          :show-details="true"
        />
      </template>
    </StatusBar>

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
        <DialPad v-if="showTab === 'dialPad'" @prepare-call="prepareCall" @place-call="placeCall"
          :phoneData="phoneData" />
        <PhoneBook v-if="showTab === 'phoneBook'" @prepare-call="prepareCall" :prepared-call="preparedCall" :phoneData="phoneData" />
        <StartREC v-if="showTab === 'considerREC'" @prepare-call="prepareCall" :phoneData="phoneData" :username="username" />
        
        <!-- Unified incoming calls display -->
        <CallDisplay 
          v-if="showTab === 'incomingCalls'"
          :calls="sortedIncomingCalls"
          :selected-call="nextCall"
          :display-mode="'grid'"
          title="Incoming Calls"
          :show-queue="true"
          :show-count="true"
          :show-actions="false"
          @select-call="selectCall"
          @reject-call="rejectCall"
        />
      </div>
      <div class="grid grid-cols-2 grid-rows-5 gap-4 ml-1 w-1/6 bg-zinc-200">
        <div class="">
          <button @click="changeTab('panelSelector')"
            class="w-full bg-zinc-300 text-black py-1 px-3 text-lg border-4 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300 aspect-square">
            <a>Panel Selection</a>
          </button>
        </div>
        <div class="">
          <AuthenticationButton />
        </div>
        <div class="row-start-2">
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
        <div class="row-start-3">
          <button v-if="hasPhones" @click="changeTab('incomingCalls')"
            class="w-full bg-zinc-300 text-black py-1 px-3 text-lg border-4 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300 aspect-square">
            <a>Incoming Calls</a>
          </button>
        </div>
        <div>
          <button v-if="hasPhones" @click="changeTab('considerREC')"
            class="w-full bg-red-300 text-black py-1 px-3 text-lg border-4 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300 aspect-square">
            <a>EMERGENCY</a>
          </button>
        </div>
        <div class="row-start-4 col-span-2">
          <!-- Enhanced call button using unified call manager -->
          <CallButton 
            v-if="hasPhones" 
            :current-call="currentCall"
            :next-call="nextCall"
            :prepared-call="preparedCall"
            :in-call="inCall"
            :incoming-call="incomingCall"
            @change-tab="changeTab"
            @place-call="placeCall"
            @accept-call="acceptCall"
            @leave-call="leaveCall"
            @reject-call="rejectCall"
          />
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

    </div>
  </div>
</template>