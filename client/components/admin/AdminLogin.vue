<template>
  <div class="container mx-auto align-middle">
    <div class="text-center flex flex-col min-h-screen">
      <div  class="flex-grow py-1"></div>
<!--      <Logo class="block mx-auto" />-->
      <img src="https://i.pinimg.com/originals/55/b8/98/55b898f8504d8a004349ece55758cad0.png" class="block mx-auto" />
      <h1 class="text-6xl font-bold rainbow rainbow_text_animated">
        WHERE'S THE LAMB SAUCE?
      </h1>
      <div class="p-5">
        <input v-model="adminPassword" @keyup="$emit('update:adminPassword', adminPassword)" class="mt-2 mb-4 ring-4 border border-solid border-purple-400 rounded text-3xl text-purple-400" placeholder="Come on man" v-on:keyup.enter="joinGame()" />

        <input type="submit" class="px-2  border border-solid border-purple-600 text-purple-600 rounded text-3xl hover:bg-purple-600 hover:text-white" value="Become God" @click="joinGame()">
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

.rainbow {
  text-align: center;
  text-decoration: underline;
  font-size: 32px;
  font-family: "Comic Sans MS";
  letter-spacing: 5px;
}
.rainbow_text_animated {
  background: linear-gradient(to right, #6666ff, #0099ff , #00ff00, #ff3399, #6666ff);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: rainbow_animation 6s ease-in-out infinite;
  background-size: 400% 100%;
}

@keyframes rainbow_animation {
  0%,100% {
    background-position: 0 0;
  }

  50% {
    background-position: 100% 0;
  }
}
</style>
