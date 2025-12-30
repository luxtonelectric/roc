<script lang="ts" setup>
import io from 'socket.io-client'
import type { Socket } from 'socket.io-client'
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import type { PreparedCall } from '~/models/PreparedCall';
import { useCallManager } from '../../composables/useCallManager'
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
const error = ref("");
const gameData = ref({});
const username = ref("");
const playerData = ref({ phones: {} });
const phoneData = ref({} as any);

let socket: Socket | undefined
const connected = ref(false)
const hasPhones = ref(false)
const showTab = ref("panelSelector");

// Create a reactive socket reference for call manager
const socketRef = ref<any>(undefined)

// Convert phoneData array to object format expected by call manager
const myPhones = computed(() => {
  if (!phoneData.value || !Array.isArray(phoneData.value)) return {};
  
  const phones: any = {};
  phoneData.value.forEach((phone: any) => {
    if (phone && phone.id) {
      phones[phone.id] = phone;
    }
  });
  return phones;
});

// Initialize unified call manager
const callManager = useCallManager(
  socketRef, 
  gameData, 
  myPhones, 
  () => {}, // Silent error handler
  () => {}, // Silent info handler
  {
    enableAudio: true,
    autoAcceptREC: true,
    enableQueueManagement: true,
    enableUnifiedInterface: true
  }
)

// Destructure call manager properties
const {
  currentCall,
  nextCall,
  preparedCall,
  callQueue,
  activeCalls,
  inCall,
  incomingCall,
  
  queuedCallsCount,
  currentCallStatus,
  sortedIncomingCalls,
  highestPriorityCall,
  callsByType,

  placeCall,
  acceptCall,
  rejectCall,
  terminateCall,
  leaveCall,
  selectCall,
  updateCallStatus,



  createP2PCall,
  createGroupCall,
  createRECCall,

  // REC call properties
  recModalVisible,
  recCallInfo,
  recCountdownActive,
  handleRECCallOffer,
  acceptRECCall,
  declineRECCall,
  forceDisconnectFromCurrentCall,

  // Group call functions
  startGroupCall,
  joinGroupCall,
  leaveGroupCall,
  terminateGroupCall,
  requestGroupCallUpdate,

  // Enhanced utilities
  validateCallTransition,
  getCallPriorityClass,
  getCallTypeClass,
  getCallStatusClass
} = callManager

onMounted(() => {
  socket = io(runtimeConfig.public.socketServer)
  
  socket.on('connect', () => {
    connected.value = true;
    error.value = "";
    joinUser();
    socketRef.value = socket;
    callManager.setupCallEventListeners?.();
    socket.emit('requestGameUpdate');
  });

  socket.on('connect_error', (error) => {
    error.value = "Connection failed";
  });

  socket.on("loggedIn", (msg: any) => {
    loggedIn.value = msg.loggedIn;
    error.value = msg.error;
  });

  // Server sends AUTHD when an admin authenticates — treat this as logged in for the player UI
  socket.on("authd", (msg: any) => {
    // authd payload: { success, error }
    if (msg && typeof msg.success !== 'undefined') {
      loggedIn.value = !!msg.success;
      error.value = msg.error || "";
    }
  });

  socket.on("playerLocationUpdate", () => {
    // Player location updates handled silently
  });

  socket.on("gameInfo", (msg) => {
    gameData.value = msg;
  });

  socket.on("playerInfo", (msg) => {
    playerData.value = msg;
    if (msg.phones) {
      phoneData.value = msg.phones;
      hasPhones.value = msg.phones.length > 0;
      if (hasPhones.value) {
        msg.phones.forEach((phone: any) => {
          socket?.emit("requestPhoneQueueUpdate", { id: phone.id });
        });
      }
    }
  });

  socket.on("phonebookUpdate", (msg) => {
    phoneData.value = msg;
    hasPhones.value = msg.length > 0;
  });

  socket.on('disconnect', (reason) => {
    error.value = `Disconnected: ${reason}`;
    connected.value = false;
    setTimeout(() => socket?.connect(), 1000);
  });
})

onUnmounted(() => {
  callManager.removeCallEventListeners?.();
  socket?.disconnect()
})

function joinUser() {
  username.value = session?.sub || "testuser";
  socket?.emit("newPlayer", { discordId: session?.sub || "123456789" });
}

function changeTab(tab: string) {
  showTab.value = tab;
}

// Utility: determine an appropriate phone id to act with (first phone or sender matching the current call)
function findCurrentPhoneId(): string | null {
  const phoneKeys = Object.keys(myPhones.value || {})

  // If current call has a sender that matches one of our phones, prefer that
  try {
    if (currentCall?.value && currentCall.value.sender && currentCall.value.sender.id) {
      const sid = currentCall.value.sender.id
      if (phoneKeys.includes(sid)) return sid
    }
  } catch (err) {
    // ignore
  }

  // Fall back to the first available phone
  return phoneKeys.length > 0 ? phoneKeys[0] : null
}

function prepareCall(call: PreparedCall) {
  preparedCall.value = call;
}

// REC Call Control Handlers
function handleRECDropOut() {
  const phoneId = findCurrentPhoneId();
  if (phoneId) {
    leaveGroupCall(phoneId);
  }
}

function handleRECEndCall() {
  const phoneId = findCurrentPhoneId();
  if (phoneId) {
    terminateGroupCall(phoneId);
  }
}

// Determine if current user is the sender for the active REC/group call
const isSenderInCall = computed(() => {
  if (!currentCall.value || !currentCall.value.sender) return false
  const phoneId = findCurrentPhoneId()
  return phoneId && currentCall.value.sender?.id === phoneId
})

// REC modal accept handling with disabled state
const isAcceptingREC = ref(false)
async function onRecAccept() {
  if (isAcceptingREC.value) return
  isAcceptingREC.value = true
  try {
    const success = await acceptRECCall()
    if (success) {
      recModalVisible.value = false
      recCallInfo.value = undefined
    }
  } catch (err) {
    console.error('REC accept failed:', err)
  } finally {
    isAcceptingREC.value = false
  }
}
</script>

<template>
  <div class="flex flex-col pb-0 px-4 bg-neutral-200 text-lg h-screen max-h-screen">
    <!-- Status Bar -->
    <StatusBar 
      :gameData="gameData || {}" 
      :username="username" 
      :playerData="playerData || {}" 
      :phoneData="phoneData" 
      :socket="socket"
      :error="error" 
      :callData="callQueue || {}" 
    >
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
      <div v-else-if="loggedIn" class="mr-0 w-5/6 border-4 border-zinc-400 bg-zinc-300 overflow-scroll overscroll-contain">
        <Selector v-if="showTab === 'panelSelector'" :gameData="gameData" :username="username" :playerData="playerData" :phoneData="phoneData" :socket="socket" />
        <DialPad v-if="showTab === 'dialPad'" @prepare-call="prepareCall" @place-call="placeCall" :phoneData="phoneData" />
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
        <button @click="changeTab('panelSelector')" :class="buttonClasses">Panel Selection</button>
        <AuthenticationButton />
        <button v-if="hasPhones" @click="changeTab('phoneBook')" :class="buttonClasses + ' row-start-2'">Phone Book</button>
        <button v-if="hasPhones" @click="changeTab('dialPad')" :class="buttonClasses">Dial Pad</button>
        <button v-if="hasPhones" @click="changeTab('incomingCalls')" :class="buttonClasses + ' row-start-3'">Incoming Calls</button>
        <button v-if="hasPhones" @click="changeTab('considerREC')" :class="emergencyButtonClasses">EMERGENCY</button>
        
        <div class="row-start-4 col-span-2">
          <CallButton 
            v-if="hasPhones" 
            :current-call="currentCall"
            :next-call="nextCall"
            :prepared-call="preparedCall"
            :in-call="inCall"
            :incoming-call="incomingCall"
            :phone-data="phoneData"
            @change-tab="changeTab"
            @place-call="placeCall"
            @accept-call="acceptCall"
            @leave-call="leaveCall"
            @reject-call="rejectCall"
            @terminate-group-call="terminateGroupCall"
          />
        </div>

      </div>
    </div>
    <div class="flex flex-row">
      <!-- REC Call Controls - Show when in REC call -->
      <div v-if="inCall && currentCall?.type === 'REC'" class="w-5/6 pr-2.5 pt-2">
        <RECCallControls 
          :caller-info="currentCall?.sender"
          :start-time="currentCall?.timePlaced ? new Date(currentCall.timePlaced) : undefined"
          :call-id="currentCall?.id"
          :allow-end="isSenderInCall"
          @drop-out="handleRECDropOut"
          @end-call="handleRECEndCall"
        />
      </div>
      
      <!-- Default bottom section -->
      <div v-else class="grid grid-cols-3 gap-2 pt-2 w-5/6 pr-2.5">
        <div class="w-full h-full bg-zinc-300 border-4 border-zinc-400"></div>
        <div class="w-full h-full bg-zinc-300 border-4 border-zinc-400"></div>
        <div class="w-full h-full bg-zinc-300 border-4 border-zinc-400"></div>
      </div>
    </div>

    <!-- Railway Emergency Call Modal -->
    <RECModal 
      :is-visible="recModalVisible || false"
      :caller-info="recCallInfo?.callerInfo"
      :initial-countdown="recCallInfo?.countdown ?? 5"
      :allow-decline="!recCallInfo?.isSender"
      :is-accepting="isAcceptingREC"
      @accept="onRecAccept"
      @decline="declineRECCall"
      @timeout="onRecAccept"
      @close="declineRECCall"
    />
  </div>
</template>