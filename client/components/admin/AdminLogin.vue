<template>
  <div class="container mx-auto align-middle">
    <div class="text-center flex flex-col min-h-screen">
      <div  class="flex-grow py-1"></div>
<!--      <Logo class="block mx-auto" />-->
      <h1 class="text-6xl font-bold">
        ROC Admin Panel
      </h1>
      <div class="p-5">
        <p class="text-3xl">Request access in Discord</p>
      </div>
      <div  class="flex-grow py-5">
      </div>
    </div>
  </div>
</template>
<script>
export default {
  name: "AdminLogin",
  data()
  {
    return{
      adminPassword: ""
    }
  },
  methods: {
    joinGame()
    {
      this.$emit("adminLogin");
    }
  }
};
</script>
<style scoped>

</style>
