<template>
  {{ time }} {{ clockData.isPaused ? 'PAUSED':'' }}
</template>

<script>
export default {
  name: "Clock",
  props: ["clockData"],
  data () {
    return {
      interval: null,
      time: null,
      simTime: null
    };
  },
  methods: {
    calculateTime () {
      const time = this.clockData;
      if (time) {
        const msPassed = Date.now() - time.lastReportedAt;
        const secondsPassed = msPassed / 1000;
        const timeNow = time.secondsSinceMidnight + (time.isPaused ? 0 : secondsPassed * time.speed);
        const dateObj = new Date(0, 0, 0, 0, 0, timeNow);
        const hours = dateObj.getUTCHours();
        const minutes = dateObj.getUTCMinutes();
        const seconds = dateObj.getSeconds();
        this.time = hours.toString().padStart(2, '0') + ':' + minutes.toString().padStart(2, '0') + ':' + seconds.toString().padStart(2, '0');
      } else {
        // Concise way to format time according to system locale.
        // In my case this returns "3:48:00 am"
        this.time = Intl.DateTimeFormat(navigator.language, {
          hour: 'numeric',
          minute: 'numeric',
          second: 'numeric'
        }).format();
      }
    },
    bindInterval () {
      this.interval = setInterval(this.calculateTime, 1000 / this.clockData?.speed ?? 1);
    },
    unbindInterval () {
      clearInterval(this.interval);
    },
  },
  mounted () {
    this.bindInterval();
  },
  watch: {
    "clockData.speed": function () {
      this.unbindInterval();
      this.bindInterval();
    }
  },
  beforeUnmount () {
    this.unbindInterval();
  },
};
</script>