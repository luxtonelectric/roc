<template>
<div>
  <AdminControlPanel v-if="adminLoggedIn" :socket="socketPointer"/>
  <AdminLogin v-else  @adminLogin="adminLogin" v-model:adminPassword="adminPassword"/>
</div>
</template>

<script>
export default {
name: "admin.vue",
  data(){
  return {
    adminLoggedIn: false,
    inputData: String,
    connected: false,
    error: "",
    socketPointer : null,
    adminPassword: "",
    socketStatus: {}
    }
  },
  mounted()
  {
    var that = this;
    this.socket = this.$nuxtSocket({
      options: {
        cors:true,
        statusProp: 'socketStatus'
      }
    });
    this.socketPointer = this.socket;
    this.socket.on('connect', () => {
      that.connected = true;
    });
    this.socket.on('authd', (msg)=>{
      this.adminLoggedIn = true;
    });
  },
  methods:{
    adminLogin()
    {
      this.socket.emit('adminLogin', {"password": this.adminPassword})
    }
  }
}
</script>

  <style>
.link{
  @apply text-purple-600 cursor-pointer;
}
.link:hover, .link:focus, .link:active{
  @apply text-purple-800
}

.button {
  @apply text-purple-600 cursor-pointer border border-purple-600 rounded p-5 ml-2 mr-2 mb-2
}
.button:hover, .button:focus, .button:active {
  @apply text-purple-800 border-purple-800
}
</style>
