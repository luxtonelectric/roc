<template>
  <div>
    <div v-if="error" class="flex justify-center items-center m-1 font-medium py-1 px-2 bg-white rounded-md text-red-100 bg-red-700 border border-red-700 ">
      <div slot="avatar">
        <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-alert-octagon w-5 h-5 mx-2">
          <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      </div>
      <div class="text-xl font-normal  max-w-full flex-initial">
        {{ error }}</div>
      <div class="flex flex-auto flex-row-reverse">

      </div>
    </div>
    <div v-if="loggedIn">
      <Main :gameData="gameData" :playerData="playerData" :username="username" :socket="socketPointer"/>
    </div>
    <div v-else>
      <Login v-model:username="username" @joinGame="joinUser"/>
    </div>
<!--    <div class="w-screen">-->
<!--      <pre><code>{{debugData}}</code></pre>-->
<!--    </div>-->
  </div>
</template>
<script>
import Login from "../components/Login";
import Main from "../components/Main";
export default {
  data(){
    return{
      loggedIn: false,
      error: "",
      username: "Username#1234",
      gameData: {},
      playerData: {phones:{}},
      socketStatus: {},
      socketPointer: null,
      connected: false,
      debugData: ""
    }
  },
  components:{
    Login
  },
  computed:{},
  mounted() {
    var that = this;
    this.socket = this.$nuxtSocket({
      options: {
        cors:true,
        statusProp: 'socketStatus'
      }
    });
    this.socket.on('connect', () => {
      that.connected = true;
    });
    this.socketPointer = this.socket;
    this.socket.on("loggedIn", function (msg){
      console.log(msg);
      that.loggedIn = msg.loggedIn;
      that.error = msg.error;
    });
    this.socket.on("playerLocationUpdate", function (msg){
      console.log(msg);
    });
    this.socket.on("gameInfo", function (msg){
      console.log(msg);
      that.gameData = msg;
    });
    this.socket.on("playerInfo", function (msg){
      that.playerData = msg;
    });
    this.socket.on('disconnect', function (reason){
      console.log(reason);
      that.error = `You have been disconnected from ROC. (${reason})`;
      that.connected = false;
    });
    // this.socket.onAny((event, data) => {
    //   // that.debugData += `${event}::${JSON.stringify(data)}`;
    //   that.debugData += "\n" + event + "::" + JSON.stringify(data);
    // });
  },

  methods: {

    joinUser()
    {
      this.socket.emit("newPlayer", {panel: "NONE", socket: null, discordID: this.username});
    },
    annoyMe()
    {
      this.socket.emit('test', {test:"yes"});
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
