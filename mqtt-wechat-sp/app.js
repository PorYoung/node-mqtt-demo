//app.js
const config = {
  mqttHost: 'wxs://localhost:443',
  mqttOptions: {
    connectTimeout: 4000
  }
};
App({
  onLaunch: function() {

  },
  globalData: {
    userInfo: null
  },
  config: config
})