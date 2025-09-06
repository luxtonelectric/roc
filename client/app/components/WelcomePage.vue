<template>
	<div class="container max-w-full h-screen pt-4 bg-slate-900 text-lime-500 font-mono">
		<div class="text-right text-xs">
			<p>host: <b>april</b></p>
			<p>client: <b>2.0.0</b></p>
			<p>server: <b>2.0.0</b></p>
		</div>
		<Logo />
		<p class="text-3xl text-center">
			Railway Operations Centre
		</p>
		<slot />
		<p class="text-center text-sm m-50">
			<a href="/admin" class="hover:underline">Admin Console</a> &cir;
			<a href="https://simsig.co.uk" target="_blank" class="hover:underline">SimSig</a> &cir;
			<a href="https://bradshaw.onourlines.co.uk/wiki/SimSig:ROC" target="_blank" class="hover:underline">User Guide</a>
		</p>
		<div class="flex pt-5 pb-3 items-center">
			<div class="flex-grow border-t border-2 border-dashed border-lime-700"></div>
		</div>
		<GameStatus />
	</div>
</template>

<script setup lang="ts">

</script>

<style scoped></style>
