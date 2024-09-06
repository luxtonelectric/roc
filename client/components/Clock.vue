<template>
  <span v-if='simData' class="text-2xl font-bold text-gray-800">
    {{ secondsToTime(simData.clock.clock) }}
  </span>
  <span v-else class="text-2xl font-bold text-gray-800">
    {{time}}
  </span>
</template>

<script>
  export default {
    name: "Clock",
    props: ["simData"],
    data() {
      return {
        interval: null,
        time: null
      }
    },
    beforeDestroy() {
      // prevent memory leak
      clearInterval(this.interval)
    },
    created() {
      // update the time every second
      this.interval = setInterval(() => {
        // Concise way to format time according to system locale.
        // In my case this returns "3:48:00 am"
        this.time = Intl.DateTimeFormat(navigator.language, {
          hour: 'numeric',
          minute: 'numeric',
          second: 'numeric'
        }).format()
      }, 1000)
    },
    mounted() {
      // this.socket.on("test", function (msg)
      // {
      //   console.log(msg);
      // });
      // this.socket.emit("extraTest", {nolo:false});
    },
    methods: {
      secondsToTime(givenSeconds){
        const dateObj = new Date(givenSeconds * 1000);
        const hours = dateObj.getUTCHours();
        const minutes = dateObj.getUTCMinutes();
        const seconds = dateObj.getSeconds();
        const timeString = hours.toString().padStart(2, '0') + ':' + minutes.toString().padStart(2, '0') + ':' + seconds.toString().padStart(2, '0');
        return timeString;
      }
    },
  }
</script>