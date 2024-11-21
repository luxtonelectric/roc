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
      <p class="mt-10 text-center text-xl">
        Restricted Access - Authentication Required: <span class="relative w-[max-content] font-mono
before:absolute before:inset-0 before:bg-slate-900 before:animate-typewriter">....</span>
      </p>
      <p class="text-center text-xl m-5">
        <button class="rounded-xl bg-lime-500 text-slate-900 p-3 hover:bg-lime-700 hover:text-slate-50 hover:fill-slate-50" @click="signIn('discord')"><DiscordLogo class="inline mx-1 " width="40"/> Login with Discord</button>
      </p>
      <p class="text-center text-sm m-50">
        <a href="/admin" class="hover:underline">Admin Console</a> &cir;
        <a href="https://simsig.co.uk" target="_blank" class="hover:underline">SimSig</a> &cir;
        <a href="https://bradshaw.onourlines.co.uk/wiki/SimSig:ROC" target="_blank" class="hover:underline">User Guide</a>
      </p>
      <div class="flex pt-5 pb-3 items-center">
        <div class="flex-grow border-t border-2 border-dashed border-lime-700"></div>
      </div>
      <div class="flex-row text-xl text-center font-bold">Next Session: 23 November 2024, 1800 UTC<br />East Coast Mainline</div>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
        <div class="rounded-lg border-lime-500 border-2 p-2">
          <div class="text-center text-lg">King's Cross</div>
          <div class="grid grid-cols-2">
            <div class="text-slate-500">Panels: 5/5</div>
            <div class="text-slate-500 text-right"><span class="text-green-500">&bull;</span> Connected</div>
          </div>
          <div class="text-base pt-2 text-center">Connections open</div>
          <div class="grid grid-cols-2 auto-cols-auto">
            <div class="text-sm">jarley.onoursimsig.co.uk</div>
            <div class="text-sm text-right">:50505</div>
          </div>
        </div>
        <div class="rounded-lg border-lime-500 border-2 p-2">
          <div class="text-center text-lg">Peterborough</div>
          <div class="grid grid-cols-2">
            <div class="text-slate-500">Panels: 3/5</div>
            <div class="text-slate-500 text-right"><span class="text-green-500">&bull;</span> Connected</div>
          </div>
          <div class="text-base pt-2 text-center">Connections open</div>
          <div class="grid grid-cols-2 auto-cols-auto">
            <div class="text-sm">jarley.onoursimsig.co.uk</div>
            <div class="text-sm text-right">:50509</div>
          </div>
        </div>
        <div class="rounded-lg border-lime-500 border-2 p-2">
          <div class="text-center text-lg">Royston</div>
          <div class="grid grid-cols-2">
            <div class="text-slate-500">Panels: 0/1</div>
            <div class="text-slate-500 text-right"><span class="text-yellow-500">&bull;</span> At Capacity</div>
          </div>
          <div class="text-base pt-2 text-center">Connections closed</div>
          <div class="grid grid-cols-2 auto-cols-auto">
            <div class="text-sm"></div>
            <div class="text-sm text-right"></div>
          </div>
        </div>
        <div class="rounded-lg border-lime-500 border-2 p-2">
          <div class="text-center text-lg">Doncaster North</div>
          <div class="grid grid-cols-2">
            <div class="text-slate-500"></div>
            <div class="text-slate-500 text-right"><span class="text-red-800">&bull;</span> Disconnected</div>
          </div>
          <div class="text-base pt-2 text-center">
            Connections closed
          </div>
        </div>
      </div>
    </div>
</template>

<script setup lang="ts">
  definePageMeta({
      auth: {
          unauthenticatedOnly: true,
          navigateAuthenticatedTo: '/',
      }
  })
  const { signIn } = useAuth()
</script>