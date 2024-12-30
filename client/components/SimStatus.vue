<script setup lang="ts">
import type { Simulation } from './GameStatus.vue';

const { simData } = defineProps<{ simData: Simulation; }>();
const freePanels = computed(() => simData.panels.filter(p => !p.player).length);
const totalPanels = computed(() => simData.panels.length);
const gatewayConnected = computed(() => simData.config.interfaceGateway.connected);
const gatewayEnabled = computed(() => simData.config.interfaceGateway.enabled);
const connectionsOpen = computed(() => simData.connectionsOpen);
</script>

<template>
	<div class="rounded-lg border-lime-500 border-2 p-2">
		<div class="text-center text-lg">{{ simData.name }}</div>
		<div class="grid grid-cols-2">
			<div class="text-slate-500">
				Panels available: {{ freePanels }}/{{ totalPanels }}
			</div>
			<div v-if="gatewayEnabled && !gatewayConnected" class="text-slate-500 text-right">
				<span class="text-red-800">&bull;</span> Disconnected
			</div>
			<div v-else-if="freePanels === 0" class="text-slate-500 text-right">
				<span class="text-yellow-500">&bull;</span> At Capacity
			</div>
			<div v-else-if="gatewayConnected" class="text-slate-500 text-right">
				<span class="text-green-500">&bull;</span> Connected
			</div>
		</div>
		<div v-if="connectionsOpen" class="text-base pt-2 text-center">Connections open</div>
		<div v-if="connectionsOpen" class="grid grid-cols-2 auto-cols-auto">
			<div class="text-sm">{{ simData.config.host }}</div>
			<div class="text-sm text-right">:{{ simData.config.port }}</div>
		</div>
		<div v-else class="text-base pt-2 text-center">Connections closed</div>
	</div>
</template>

<style scoped></style>
