<template>
  <div class="container mx-auto align-middle">
    <div class="text-center flex flex-col min-h-screen">
      <div  class="flex-grow py-1"></div>
      <Logo class="block mx-auto" />
      <h1 class="text-5xl">
        Please log in with Discord
      </h1>
      <p>If you enter someone else here, you will be banned.</p>
      <div class="p-5">
        <input v-model="username" @keyup="$emit('update:username', username);" class="mt-2 mb-4 ring-4 border border-solid border-purple-400 rounded text-3xl text-purple-400" placeholder="Username#1234"  v-on:keyup.enter="joinGame()"/>

        <input type="submit" class="px-2  border border-solid border-purple-600 text-purple-600 rounded text-3xl hover:bg-purple-600 hover:text-white" value="Join Game" @click="joinGame()">
      </div>
      <div  class="flex-grow py-5"></div>
    </div>
  </div>
</template>
<script>
export default {
  name: "Login",
  props: {
    modelValue: String
  },
  data()
  {
    return{
      username: ""
    }
  },
  methods: {
    joinGame()
    {
      this.$emit("joinGame");
    }
  }
};
</script>
