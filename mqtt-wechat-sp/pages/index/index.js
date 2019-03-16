// pages/index/index.js
const app = getApp();
const mqtt = require('../../utils/mqtt.min.js');
let config, mqttClient = null;
Page({

  /**
   * 页面的初始数据
   */
  data: {
    username: 'PorYoung',
    password: '123456',
    clientId: null,
    publishTopic: null,
    subscribeTopic: null,
    publishMessage: null,
    message: [],
    subscribeMsg: [],
    publishMsg: []
  },
  onLoad: function() {
    config = Object.assign({}, app.config);
    console.log(config);
  },
  connectionSubmit: function(event) {
    let that = this;
    let value = event.detail.value;
    let {
      username,
      password
    } = value;
    let clientId = username.concat(Math.floor(Math.random() * 10000));
    that.setData({
      username: username,
      password: password,
      clientId: clientId
    });
    config.mqttOptions = Object.assign(config.mqttOptions, {
      username,
      password,
      clientId
    });
    mqttClient = mqtt.connect(config.mqttHost, config.mqttOptions);

    mqttClient.on('connect', function() {
      mqttClient.subscribe('/public/systemInfo');
      console.log('connect');
      that.setData({
        connStatus: 'connected'
      });
    })

    mqttClient.on('message', function(topic, message) {
      // message is Buffer
      console.log('收到来自', topic, '的消息', message.toString())
    })

    mqttClient.on('reconnect', (error) => {
      console.log('正在重连:', error)
    })

    mqttClient.on('error', (error) => {
      console.log('连接失败:', error)
    })
  },
  subscribeSubmit: function(event) {
    let that = this;
    let value = event.detail.value;
    let {
      subscribeTopic
    } = value;
    if (mqttClient != null && mqttClient.connected && subscribeTopic != '') {
      mqttClient.subscribe('/users/' + that.data.username + '/' + subscribeTopic, (err) => {
        if (!err) {
          console.log('订阅成功,topic:' + subscribeTopic);
        }
      })
    }
  },
  publishSubmit: function(event) {
    let that = this;
    let value = event.detail.value;
    let {
      publishTopic,
      publishMessage
    } = value;
    if (mqttClient != null && mqttClient.connected && publishTopic != '') {
      mqttClient.publish('/users/' + that.data.username + '/' + publishTopic, publishMessage, (err) => {
        if (!err) {
          console.log('发布成功,topic:' + publishTopic + ', msg:' + publishMessage);
        }
      })
    }
  }
})