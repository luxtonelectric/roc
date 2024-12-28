<script lang="ts" setup>
import io from 'socket.io-client'
import type { Socket } from 'socket.io-client'
import DialPad from '~/components/DialPad.vue';
import IncomingCalls from '~/components/IncomingCalls.vue';
import PhoneBook from '~/components/PhoneBook.vue';
import { CallDetails } from "~/models/CallDetails.js";

const { getSession, status, data, signOut, signIn } = useAuth();
const session: any = await getSession();
const runtimeConfig: any = useRuntimeConfig()

const loggedIn = ref(false);
let error = ref("");
const gameData = ref({});
const username = ref("");
const playerData = ref({ phones: {} })
const phoneData = ref({});
const callData = reactive(new Map<string, CallDetails>());

const hasIncomingCall = ref(false);
const incomingCallId = ref("");
const isInCall = ref(false);
const currentCallId = ref("");
const isCallPrepared = ref(false);

const app = useNuxtApp();
let socket: Socket | undefined
const connected = ref(false)
const hasPhones = ref(false)
const showTab = ref("panelSelector");
const selectedReceiver = ref("");
const selectedPhone = ref("");

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
        selectedPhone.value = msg.phones[0].id;

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
      console.log(msg.length);
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
      if (callData.has(call.id)) {
        console.log('Known call', call.id);
        // Known call, we may need to do some things.
        // If the call is ended then we need to remove it from the callData
        if (call.status === CallDetails.STATUS.ENDED) {
          callData.delete(call.id);
          isInCall.value = false;
          currentCallId.value = "";

          isCallPrepared.value = false;
          console.log(callData.size);
          console.log(callData);
          if(callData.size === 0) {
            hasIncomingCall.value = false;
            incomingCallId.value = "";
            callAudio.pause();
          }

        } else if (call.status === CallDetails.STATUS.REJECTED) {
          callData.delete(call.id);
          console.log(callData.size);
          console.log(callData);
          if(callData.size === 0) {
            hasIncomingCall.value = false;
            incomingCallId.value = "";
            callAudio.pause();
          }


        } else if (call.status === CallDetails.STATUS.ACCEPTED && callData.get(call.id)?.status !== CallDetails.STATUS.ACCEPTED) {
          // The call has newly been accepted, we need to do things.
          callAudio.pause();
          isInCall.value = true;
          currentCallId.value = call.id;
          callData.set(call.id, call);
        }
      } else {
        console.log('New call', call.id);
        // This is a new call for the queue. We need to add it to the callData
        callData.set(call.id, call);

        if (call.status === CallDetails.STATUS.OFFERED) {
          console.log(phoneData.value);
          if (phoneData.value.some((phone) => phone.id === call.sender.id)) {
            // This is a call from a phone that we have in our inventory
            isInCall.value = true;
            currentCallId.value = call.id;

          } else {
            // This is an incoming call, we need to ring the phone
            if (!hasIncomingCall.value) {
              console.log('This is the incoming call...', call.id);
              hasIncomingCall.value = true;
              incomingCallId.value = call.id;
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
    //console.log(reason);
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
  console.log('change tab', tab);
  showTab.value = tab;
}

function prepareCall(sender: string, receiver: string) {
  isCallPrepared.value = false;
  selectedPhone.value = sender;
  selectedReceiver.value = receiver;
  isCallPrepared.value = true;
}

function placeCall(receiver: string, type = "p2p", level = "normal") {
  socket?.emit("placeCall", { "receiver": receiver, "sender": selectedPhone.value, "type": type, "level": level }, (response) => { console.log(response) });
}

function acceptCall() {
  console.log('accept call', incomingCallId.value);
  socket?.emit('acceptCall', { id: incomingCallId.value });
}

function leaveCall() {
  console.log('leave call', incomingCallId.value);
  socket?.emit("leaveCall", { id: currentCallId.value });
}

function rejectCall(callId) {
  console.log('reject call', callId);
  socket?.emit('rejectCall', { id: callId })
}

function playCallAudio() {
  callAudio.currentTime = 0;
  callAudio.play().then(() => { console.log('audio played'); }).catch((error) => { console.log('audio error', error) });
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
        <DialPad v-if="showTab === 'dialPad'" :gameData="gameData" :username=username :playerData="playerData"
          :phoneData="phoneData" :socket="socket" />
        <PhoneBook v-if="showTab === 'phoneBook'" @prepare-call="prepareCall" :gameData="gameData" :username=username
          :playerData="playerData" :selectedReceiver="selectedReceiver" :phoneData="phoneData" :socket="socket"
          :selectedPhone="selectedPhone" />
        <IncomingCalls v-if="showTab === 'incomingCalls'" :callData="callData" @reject-call="rejectCall" />
      </div>
      <div class="grid grid-cols-2 grid-rows-5 gap-4 ml-1 w-1/6 bg-red-800">
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
        <div class="row-start-5">
          <CallButton @change-tab="changeTab" @place-call="placeCall" @accept-call="acceptCall" @leave-call="leaveCall"
            @reject-call="rejectCall" :callData="callData" :phoneData="phoneData" :isInCall="isInCall"
            :hasIncomingCall="hasIncomingCall" :incomingCallId="incomingCallId" :currentCallId="currentCallId"
            :selectedPhone="selectedPhone" :selectedReceiver="selectedReceiver" :isCallPrepared="isCallPrepared" />
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