<template>
  <button class="w-full bg-zinc-300 text-black py-1 px-3 text-lg border-4 border-zinc-400 hover:bg-zinc-400 hover:border-zinc-300 aspect-square" @click="muteRinger">
    <a>Mute Ringer</a>
  </button>
</template>
<script>
export default {
  name: "Main",
  props: [""],
  data() {
    return {
      callAudio: null
    }
  },
  created() {
    this.rejectedAudio = new Audio('/audio/rejected.mp3');
    this.callAudio = new Audio('/audio/telephone-ring.mp3');
    this.recAudio = new Audio('/audio/rec.mp3');
    this.callAudio.loop = true;
  },
  methods: {
    muteRinger() {
      //console.info("Mute Ringer");
      this.callAudio.pause();
      // this.callAudio.stop();
      this.callAudio.currentTime = 0;
    }
  }
}
</script>
