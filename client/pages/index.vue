<script lang="ts" setup>
import io from 'socket.io-client'
import type { Socket } from 'socket.io-client'
import type { Ref } from 'vue'
import DialPad from '~/components/DialPad.vue';
import PhoneBook from '~/components/PhoneBook.vue';
import RECModal from '~/components/RECModal.vue';
import RECCallControls from '~/components/RECCallControls.vue';
import type { PreparedCall } from '~/models/PreparedCall';
import { useCallManager } from '~/composables/useCallManager'
import CallDisplay from '~/components/shared/CallDisplay.vue'
import CallStatus from '~/components/shared/CallStatus.vue'
import CallButton from '~/components/shared/CallButton.vue'

// Reusable CSS classes
const buttonClasses = 'w-full bg-zinc-300 text-black py-1 px-3 text-lg border-4 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300 aspect-square'
const emergencyButtonClasses = 'w-full bg-red-300 text-black py-1 px-3 text-lg border-4 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300 aspect-square'

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
const socketRef: Ref<Socket | undefined> = ref(undefined)

// Initialize unified call manager with client-specific options
const callManager = useCallManager(
  socketRef, 
  gameData, 
  phoneData, 
  () => {}, // Error handler - silent in production
  () => {}, // Info handler - silent in production
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
  removeCallEventListeners,
  // REC call properties
  recModalVisible,
  recCallInfo,
  recCountdownActive,
  acceptRECCall,
  declineRECCall,
  // Group call functions
  leaveGroupCall,
  terminateGroupCall
} = callManager

// Computed property to convert phoneData to array format for CallButton
const phoneDataArray = computed(() => {
  if (!phoneData.value) return [];
  
  if (Array.isArray(phoneData.value)) {
    return phoneData.value;
  } else if (typeof phoneData.value === 'object') {
    return Object.values(phoneData.value);
  }
  
  return [];
})

onMounted(() => {
  console.log('DEBUGGING: Socket server URL:', runtimeConfig.public.socketServer);
  console.log('DEBUGGING: Session:', session);
  
  socket = io(runtimeConfig.public.socketServer)
  
  socket.on('connect', () => {
    console.log('DEBUGGING: Socket connected successfully');
    connected.value = true;
    error.value = "";
    joinUser();
    
    // Update the socket reference for the call manager
    socketRef.value = socket;
    
    // Set up unified call event listeners
    setupCallEventListeners();
  });

  socket.on('connect_error', (error) => {
    console.error('DEBUGGING: Socket connection error:', error);
  });

  socket.on("loggedIn", (msg: any) => {
    console.log('DEBUGGING: Received loggedIn event:', msg);
    loggedIn.value = msg.loggedIn;
    error.value = msg.error;
  });

  socket.on("playerLocationUpdate", function (msg) {
    // Player location updates handled silently
  });

  socket.on("gameInfo", function (msg) {
    gameData.value = msg;
  });

  socket.on("playerInfo", function (msg) {
    playerData.value = msg;
    if (typeof msg.phones !== 'undefined') {
      phoneData.value = msg.phones;
      if (msg.phones.length > 0) {
        hasPhones.value = true;
        msg.phones.forEach((phone: any) => {
          socket?.emit("requestPhoneQueueUpdate", { id: phone.id });
        });
      } else {
        hasPhones.value = false;
      }
    }
  });

  socket.on("phonebookUpdate", function (msg) {
    phoneData.value = msg;
    hasPhones.value = msg.length > 0;
  });

  socket.on('disconnect', function (reason) {
    error.value = `You have been disconnected from ROC. (${reason})`;
    connected.value = false;
    setTimeout(() => {
      socket?.connect();
    }, 1000);
  });
})

onUnmounted(() => {
  removeCallEventListeners(); // Clean up unified call event listeners
  socket?.disconnect()
})

function joinUser() {
  username.value = session?.sub || "testuser";
  socket?.emit("newPlayer", { discordId: session?.sub || "123456789" });
}

function changeTab(tab: string) {
  showTab.value = tab;
}

function prepareCall(call: PreparedCall) {
  preparedCall.value = call;
}

// REC Call Control Handlers
function handleRECDropOut() {
  // Find current phone ID from the REC call or player's claimed phones
  const phoneId = findCurrentPhoneId();
  if (phoneId) {
    leaveGroupCall(phoneId);
  } else {
    console.error('Cannot drop out: No phone ID found');
  }
}

function handleRECEndCall() {
  // Find current phone ID for terminating the call
  const phoneId = findCurrentPhoneId();
  if (phoneId) {
    terminateGroupCall(phoneId);
  } else {
    console.error('Cannot end call: No phone ID found');
  }
}

function findCurrentPhoneId(): string | null {
  // For REC calls, we need to find the current player's phone, not the originator's
  // REC calls are group calls where participants use their own phones
  
  // Fallback: find any claimed phone from phoneData that belongs to this player
  if (phoneData.value) {
    // phoneData might be an array or object with phone entries
    let phones: any[] = [];
    
    if (Array.isArray(phoneData.value)) {
      phones = phoneData.value;
    } else if (typeof phoneData.value === 'object') {
      phones = Object.values(phoneData.value);
    }
    
    // Find the first phone that belongs to this player
    // In a REC call context, players use their own phones to participate
    const phone = phones.find(p => p && p.id);
    if (phone?.id) {
      console.log('findCurrentPhoneId: Using player phone:', phone.id);
      return phone.id;
    }
  }
  
  // Last resort: try to get from current call, but this is usually the originator
  if (currentCall.value?.sender?.id) {
    console.warn('findCurrentPhoneId: Falling back to call sender ID (may not be correct for participants):', currentCall.value.sender.id);
    return currentCall.value.sender.id;
  }
  
  console.error('findCurrentPhoneId: No phone ID found in', { 
    currentCall: currentCall.value, 
    recCallInfo: recCallInfo.value, 
    phoneData: phoneData.value 
  });
  
  return null;
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
          <button @click="changeTab('panelSelector')" :class="buttonClasses">
            <a>Panel Selection</a>
          </button>
        </div>
        <div class="">
          <AuthenticationButton />
        </div>
        <div class="row-start-2">
          <button v-if="hasPhones" @click="changeTab('phoneBook')" :class="buttonClasses">
            <a>Phone Book</a>
          </button>
        </div>
        <div class="">
          <button v-if="hasPhones" @click="changeTab('dialPad')" :class="buttonClasses">
            <a>Dial Pad</a>
          </button>
        </div>
        <div class="row-start-3">
          <button v-if="hasPhones" @click="changeTab('incomingCalls')" :class="buttonClasses">
            <a>Incoming Calls</a>
          </button>
        </div>
        <div>
          <button v-if="hasPhones" @click="changeTab('considerREC')" :class="emergencyButtonClasses">
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
            :phone-data="phoneDataArray"
            @change-tab="changeTab"
            @place-call="placeCall"
            @accept-call="acceptCall"
            @leave-call="leaveCall"
            @reject-call="rejectCall"
          />
        </div>

      </div>
    </div>
    <div class="flex flex-row">
      <!-- REC Call Controls - Show when in REC call -->
      <div v-if="inCall && currentCall?.type === 'REC'" class="w-5/6 pr-2.5 pt-2">
        <RECCallControls 
          :caller-info="currentCall?.sender"
          :participants="undefined"
          :start-time="currentCall?.timePlaced ? new Date(currentCall.timePlaced) : undefined"
          :call-id="currentCall?.id"
          @drop-out="handleRECDropOut"
          @end-call="handleRECEndCall"
        />
      </div>
      
      <!-- Default bottom section when not in REC call -->
      <div v-else class="grid grid-cols-3 gap-2 pt-2 w-5/6 pr-2.5">
        <div class="w-full h-full bg-zinc-300 text-black py-2 px-3 text-lg border-4 border-zinc-400">

        </div>
        <div class="w-full h-full bg-zinc-300 text-black py-2 px-3 text-lg border-4 border-zinc-400">

        </div>
        <div class="w-full h-full bg-zinc-300 text-black py-2 px-3 text-lg border-4 border-zinc-400">

        </div>
      </div>
    </div>

    <!-- Railway Emergency Call Modal (TASK-024) -->
    <RECModal 
      :is-visible="recModalVisible"
      :caller-info="recCallInfo?.callerInfo"
      :initial-countdown="recCallInfo?.countdown !== undefined ? recCallInfo.countdown : 5"
      :allow-decline="!recCallInfo?.isOriginator"
      @accept="acceptRECCall"
      @decline="declineRECCall"
      @timeout="acceptRECCall"
      @close="declineRECCall"
    />
  </div>
</template>