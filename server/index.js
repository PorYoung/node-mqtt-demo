const mosca = require('mosca');
const https = require('https');
const fs = require('fs');
const MqttServer = new mosca.Server({
  port: 1883
});
/* const httpServer = http.createServer((req, res) => {
  res.end('hello world!');
}).listen(3000); */
const options = {
  key: fs.readFileSync('E:/workfiles/Project/ssl/server.key'),
  cert: fs.readFileSync('E:/workfiles/Project/ssl/server.crt')
};
const httpsServer = https.createServer(options, (req, res) => {
  res.end('hello world!');
}).listen(443);
MqttServer.attachHttpServer(httpsServer);

const User = {
  username: 'PorYoung',
  password: '123456'
};
//连接认证
const authenticate = (client, username, password, callback) => {
  let flag = (username == User.username && password == User.password);
  if (flag) client.user = username;
  callback(null, flag);
};
//发布校验，授权可以发布'/users/user/'或者'/public/'下的主题
const authenticatePublish = (client, topic, payload, callback) => {
  let t = topic.split('/');
  if (t[1] == 'public') {
    callback(null, true);
  } else if (t[1] == 'users') {
    callback(null, client.user == t[2]);
  } else {
    callback(null, false);
  }
}
//订阅校验，授权可以订阅'/users/user/'或者'/public/'下的主题
const authenticateSubscribe = (client, topic, callback) => {
  let t = topic.split('/');
  if (t[1] == 'public') {
    callback(null, true);
  } else if (t[1] == 'users') {
    callback(null, client.user == t[2]);
  } else {
    callback(null, false);
  }
}

MqttServer.on('clientConnected', (client) => {
  console.log('client connected:', client.id);
});
MqttServer.on('subscribed', (topic, client) => { //订阅
  let qtt = {
    topic: '/public/systemInfo',
    payload: client.user + ' has subscribed topic: ' + topic
  };
  MqttServer.publish(qtt);
});
MqttServer.on('unSubscribed', (topic, client) => { //取消订阅
  console.log('unSubscribed: ', topic);
})


MqttServer.on('clientDisConnected', (client) => {
  console.log('client disconnected', client.id);
});

MqttServer.on('ready', () => {
  console.log('Mqtt Server is running...');
  MqttServer.authenticate = authenticate;
  MqttServer.authorizePublish = authenticatePublish;
  MqttServer.authorizeSubscribe = authenticateSubscribe;
});

/**
 * 监听Mqtt主题消息
 */

MqttServer.on('published', (packet, client) => {
  let topic = packet.topic;
  //Define message(String or Object)
  let qtt = {
    topic: 'other',
    payload: 'This is server'
  };
  let t = topic.split('/');
  if (t[1] == 'public') {
    switch (t[2]) {
      case 'systemInfo':
        {
          console.log('systemInfo: ', packet);
          break;
        }
    }
  } else if (t[1] == 'users') {
    switch (t[3]) {
      case 'tempdata':
        {
          console.log('mqtt-tempdata: ', 'topic =' + topic + ',message = ' + packet.payload.toString());
          MqttServer.publish(qtt); //推送一个json对象,这个推送自己也会收到
          let data;
          try {
            data = JSON.parse(packet.payload.toString());
          } catch {
            console.log('JSON.parse throw an error');
          }
          console.log(data);
          break;
        }
      case 'other':
        {
          console.log('mqtt-other: ', packet.payload.toString());
          break;
        }
      default:
        {
          break;
        }
    }
  }
})