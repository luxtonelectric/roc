<template>
	<WelcomePage>
		<p class="mt-10 text-center text-xl">
			Restricted Access - Authentication Required:
			<span
				class="relative w-[max-content] font-mono before:absolute before:inset-0 before:bg-slate-900 before:animate-typewriter">....</span>
		</p>
		<p class="text-center text-xl m-5">
			<button
				class="rounded-xl bg-lime-500 text-slate-900 p-3 hover:bg-lime-700 hover:text-slate-50 hover:fill-slate-50"
				@click="signIn('discord')">
				<DiscordLogo class="inline mx-1 " width="40" /> Login with Discord
			</button>
		</p>
	</WelcomePage>
</template>

<script setup lang="ts">
definePageMeta({
	auth: {
		unauthenticatedOnly: true,
		navigateAuthenticatedTo: '/',
	}
});
const { signIn } = useAuth();
</script>