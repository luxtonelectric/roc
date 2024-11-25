<script setup lang="ts">
import { io, type Socket } from "socket.io-client";

const runtimeConfig = useRuntimeConfig();

interface ClockData {
	isPaused: boolean;
	secondsSinceMidnight: number;
	lastReportedAt: number;
	speed: number;
}
interface Panel {
	id: string;
	name: string;
	player: string;
}
export interface Simulation {
	panels: Panel[];
	enabled: boolean;
	name: string;
	channel: string;
	locationToPanelMap: Map<string, string>;
	time: ClockData;
	config: { host: string; port: number; interfaceGateway: { connected: boolean; enabled: boolean; } };
}
const gameState = ref<
	Simulation[]
>();
const socketStatus = ref("Connecting...");

let socket: Socket | undefined;
onMounted(() => {
	socket = io(runtimeConfig.public.socketServer);
	socket.on("connect", () => {
		socketStatus.value = "Connected.";
		socket!.emit("requestGameUpdate");
	});

	socket.on("gameInfo", function (msg) {
		console.log("gameInfo", msg);
		gameState.value = msg;
	});

	socket.on("disconnect", function (reason) {
		socketStatus.value = `Lost connection. (${reason})`;
	});
});

onUnmounted(() => {
	socket?.disconnect();
});
</script>

<template>
	<div class="flex-row text-xl text-center font-bold">
		Next Session: 23 November 2024, 1800 UTC<br />East Coast Mainline
	</div>
	<div class="flex-row text-center">
		{{ socketStatus }}
	</div>
	<div class="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
		<SimStatus v-for="(game, key) in gameState" :key="key" :simData="game" />
	</div>
</template>

<style scoped></style>
