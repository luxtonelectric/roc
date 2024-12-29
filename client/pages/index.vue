<script lang="ts" setup>
import io from 'socket.io-client'
import type { Socket } from 'socket.io-client'
import DialPad from '~/components/DialPad.vue';
import IncomingCalls from '~/components/IncomingCalls.vue';
import PhoneBook from '~/components/PhoneBook.vue';
import { CallDetails } from "~/models/CallDetails.js";
import type { PreparedCall } from '~/models/PreparedCall';

const { getSession, status, data, signOut, signIn } = useAuth();
const session: any = await getSession();
const runtimeConfig: any = useRuntimeConfig()

const loggedIn = ref(false);
let error = ref("");
const gameData = ref({});
const username = ref("");
const playerData = ref({ phones: {} })
const phoneData = ref({});
const callData = reactive<CallDetails[]>([]);

const preparedCall: Ref<PreparedCall | null> = ref(null);
const nextCall: Ref<CallDetails | null> = ref(null);
const currentCall: Ref<CallDetails | null> = ref(null);

const app = useNuxtApp();
let socket: Socket | undefined
const connected = ref(false)
const hasPhones = ref(false)
const showTab = ref("panelSelector");

let rejectedAudio: HTMLAudioElement;
let callAudio: HTMLAudioElement;
let recAudio: HTMLAudioElement;

onMounted(() => {

  rejectedAudio = new Audio('/audio/rejected.mp3');
  callAudio = new Audio('/audio/telephone-ring.mp3');
  recAudio = new Audio('/audio/rec.mp3');
  callAudio.loop = true;

  socket = io(runtimeConfig.public.socketServer)
  socket.on('connect', () => {
    console.log('connected');
    connected.value = true;
    error.value = "";
    joinUser();
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

  socket.on("callQueueUpdate", function (msg) {

    console.log('callQueueUpdate', msg);
    //playerData.value = msg;
    const phoneId: string = msg.phoneId;
    const queue: Array<CallDetails> = msg.queue;

    // Process each update in the queue
    queue.forEach((call: CallDetails) => {
      const oldCall = callData.find((c) => c.id === call.id);
      if (oldCall) {
        if (oldCall.status === call.status) {
          return;
        }
        console.log('Known call', call.id);
        if (call.status === CallDetails.STATUS.ENDED) {
          //console.log('Call ended', call.id);
          removeCallFromQueue(call);
          currentCall.value = null;
          preparedCall.value = null;
          if (callData.length === 0) {
            nextCall.value = null;
            callAudio.pause();
          }

        } else if (call.status === CallDetails.STATUS.REJECTED) {
          console.log('Call rejected', call.id);
          removeCallFromQueue(call);
          console.log(callData.length);
          console.log(callData);

          // If the rejected call is the one we were making then we need to no longer be in a a call
          if (currentCall.value && call.id === currentCall.value.id) {
            preparedCall.value = null;
            currentCall.value = null;
          }

          // If the rejected call is the next call then we need to stop ringing the phone
          if (nextCall.value && call.id === nextCall.value.id) {
            nextCall.value = null;
            callAudio.pause();
          }

          if (callData.length === 0) {
            nextCall.value = null;
            callAudio.pause();
          }

        } else if (call.status === CallDetails.STATUS.ACCEPTED) {
          // The call has newly been accepted, we need to do things.
          currentCall.value = call;
          removeCallFromQueue(call);
          callData.splice(callData.findIndex((c) => c.id === call.id), 1, call);
        }
      } else {
        console.log('New call', call.id);
        // This is a new call for the queue. We need to add it to the callData
        if (call.status === CallDetails.STATUS.OFFERED) {
          callData.push(call);
          if (phoneData.value.some((phone) => phone.id === call.sender.id)) {
            // This is a call from a phone that we have in our inventory
            currentCall.value = call;

          } else {
            // This is an incoming call, we need to ring the phone
            if (!nextCall.value) {
              console.log('This is the incoming call...', call.id);
              nextCall.value = call;
              // This is an incoming call, we need to ring the phone
              playCallAudio();
            }
          }
        } else {
          // ????
        }

      }
    });
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

function placeCall(toPlaceCall: PreparedCall) {
  socket?.emit("placeCall", toPlaceCall, (response) => {
    if (!response) {
      playRejectedAudio();
      preparedCall.value = null;
    }
  });
}

function acceptCall() {
  if (nextCall.value === null) {
    console.log('no call to accept');
    return;
  }

  console.log('accept call', nextCall.value.id);
  socket?.emit('acceptCall', { id: nextCall.value.id }, (response) => {
    console.log('place call response', response);
    if (response === false) {
      playRejectedAudio();
      removeCallFromQueue(nextCall.value);
    }
  });
}

function leaveCall() {
  if (currentCall.value === null) {
    console.log('no call to leave');
    return;
  }
  console.log('leave call', currentCall.value.id);
  socket?.emit("leaveCall", { id: currentCall.value.id });
}

function rejectCall(callId: string) {
  console.log('reject call', callId);
  socket?.emit('rejectCall', { id: callId })
}

function playCallAudio() {
  callAudio.currentTime = 0;
  callAudio.play().then(() => { console.log('audio played'); }).catch((error) => { console.log('audio error', error) });
}

function playRejectedAudio() {
  rejectedAudio.currentTime = 0;
  rejectedAudio.play().then(() => { console.log('audio played'); }).catch((error) => { console.log('audio error', error) });
}

function removeCallFromQueue(call: CallDetails | null) {
  console.log('remove call from queue', call);
  const callIndex = callData.findIndex((c) => c.id === call?.id);
  callData.splice(callIndex, 1);
  if (callData.length === 0) {
    console.log('no calls left');
    nextCall.value = null;
    callAudio.pause();
  } else if (callData.some((c) => c.status === CallDetails.STATUS.OFFERED)) {
    console.log('new call to ring');
    nextCall.value = callData.find((c) => c.status === CallDetails.STATUS.OFFERED) || null;
    playCallAudio();
  }
}

</script>

<template>
  <div class="flex flex-col pb-0 px-4 bg-neutral-200 text-lg h-screen max-h-screen">
    <StatusBar :gameData="gameData" :username=username :playerData="playerData" :phoneData="phoneData" :socket="socket"
      :error="error" :callData="callData" />

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
        <IncomingCalls v-if="showTab === 'incomingCalls'" :callData="callData" @reject-call="rejectCall" />
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
        <div class="">
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
        <div class="row-start-4 col-span-2">
          <CallButton v-if="hasPhones" @change-tab="changeTab" @place-call="placeCall" @accept-call="acceptCall"
            @leave-call="leaveCall" @reject-call="rejectCall" :callData="callData" :phoneData="phoneData"
            :current-call="currentCall" :nextCall="nextCall" :preparedCall="preparedCall" />
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