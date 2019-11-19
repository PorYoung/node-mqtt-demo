# MQTT + NodeJS + Weixin MiniProgram
> [PorYoung Blog](https://blog.poryoung.cn)
## [MQTT协议介绍](https://cn.bing.com)

## 基于NodeJS的MQTT服务器搭建

以下仅为本地开发环境搭建过程记录，操作系统为win10。

### NodeJS环境搭建

NodeJS环境搭建较为简单，访问[NodeJS官网](https://nodejs.org)，根据系统不同选择不同方式安装。

### 搭建HTPPS和MQTT服务器

NodeJS可以使用[mosca](https://github.com/mcollina/mosca)模块搭建MQTT服务器。

mosca可以单独使用，也可以和https服务器一起运行。**也可以使用http服务器，但在微信小程序中，即使选择不校验域名和HTTPS，也会报错（websocket failed: Error in connection establishment: net::ERR_SSL_PROTOCOL_ERROR）**

```js
const mosca = require('mosca');
const https = require('https');
const fs = require('fs');
const MqttServer = new mosca.Server({
  port: 1883
});

/**
 * HTTP方式
 * const httpServer = require('http').createServer((req, res) => {
  res.end('hello world!');
}).listen(3000); */
// HTTPS证书位置
const options = {
  key: fs.readFileSync('server.key'),
  cert: fs.readFileSync('server.crt')
};
const httpsServer = https.createServer(options, (req, res) => {
  // HTTPS服务器
  res.end('hello world!');
}).listen(443);
//通过attachHttpServer()，使得可以从浏览器或其他方式以https端口连接MQTT服务器
//微信小程序连接地址（使用MQTT.js包）为：wxs://localhost
MqttServer.attachHttpServer(httpsServer);
```

### MQTT验证用户身份

mosca提供`authenticate`、`autenticatePunlish`和`authenticateSubscribe`方法对连接请求进行验证，均可以被覆盖。

```js
//连接认证，验证上传的用户名和密码与服务器保存的信息（如数据库）一致
const User = {
  username: 'test',
  password: '123456'
};
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

MqttServer.on('ready', () => {
  console.log('Mqtt Server is running...');
  MqttServer.authenticate = authenticate;
  MqttServer.authorizePublish = authenticatePublish;
  MqttServer.authorizeSubscribe = authenticateSubscribe;
});
```

### 监听事件

mosca可以监听的事件参考官方文档。

```js
//部分事件示例如下
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
MqttServer.on('published', (packet, client) => {
  let topic = packet.topic;
  let qtt = {
    topic: 'other',
    payload: 'This is server'
  };
  switch(topic){
    case 'test1':{
      console.log(packet.payload.toString());
      MqttServer.publish(qtt); //服务器自身也会收到消息
      break;
    }
    case 'other':{
      break;
    }
  }
}
```

### NodeJS搭建本地HTTPS服务器

NodeJS本地启动https服务需要密钥和证书，可以使用[openssl](https://www.openssl.org/source/)对自身签证。

Window平台可以选择其他开源平台提供的工具，如[http://slproweb.com/products/Win32OpenSSL.html](http://slproweb.com/products/Win32OpenSSL.html)，选择32位或64位**Light**版（小但能用）。

安装好之后，可能需要手动配置环境变量，在`Path`中添加安装路径中的`bin`目录，即`openssl.exe`所在的目录）。

以管理员模式启动CMD，进入想要保存证书的目录，输入如下命令：(参考[node.js在本地启动https服务](https://blog.csdn.net/liuniansilence/article/details/78668578))。

1. 为服务器端和客户端准备公钥、私钥

```bash
// 生成服务器端私钥
openssl genrsa -out server.key 1024
// 生成服务器端公钥
openssl rsa -in server.key -pubout -out server.pem
// 生成客户端私钥
openssl genrsa -out client.key 1024
// 生成客户端公钥
openssl rsa -in client.key -pubout -out client.pem
```

2. 生成 CA 证书

```bash
// 生成 CA 私钥
openssl genrsa -out ca.key 1024
// X.509 Certificate Signing Request (CSR) Management.
openssl req -new -key ca.key -out ca.csr
// X.509 Certificate Data Management.
openssl x509 -req -in ca.csr -signkey ca.key -out ca.crt
```

> 第2步中的Organization Name (eg, company) [Internet Widgits Pty Ltd]: 后面生成客户端和服务器端证书的时候也需要填写，不要写成一样的

3. 生成服务器端证书和客户端证书

```bash
// 服务器端需要向 CA 机构申请签名证书，在申请签名证书之前依然是创建自己的 CSR 文件  
openssl req -new -key server.key -out server.csr  
// 向自己的CA机构申请证书，签名过程需要CA的证书和私钥参与，最终颁发一个带有CA签名的证书
openssl x509 -req -CA ca.crt -CAkey ca.key -CAcreateserial -in server.csr -out server.crt
// client 端
openssl req -new -key client.key -out client.csr
// client 端到 CA 签名
openssl x509 -req -CA ca.crt -CAkey ca.key -CAcreateserial -in client.csr -out client.crt
```

完成后，所在文件夹下生成如下文件:

```
    ├── ca.crt
    ├── ca.csr
    ├── ca.key
    ├── ca.srl
    ├── client.crt
    ├── client.csr
    ├── client.key
    ├── client.pem
    ├── server.crt
    ├── server.csr
    ├── server.key
    └── server.pem
```

再使用NodeJS的`HTTPS`模块启动https服务即可，配置方法见[Node.js HTTPS](https://www.w3cschool.cn/nodejs/85n21its.html).

### 微信小程序使用`MQTT.js`连接服务器

[`MQTT.js文档`](https://github.com/mqttjs/MQTT.js)，下载打包好的`MQTT.js`可以访问[http://unpkg.com](https://unpkg.com/mqtt/dist/mqtt.min.js).

```js
const mqtt = require('../../utils/mqtt.min.js');
const mqttOptions = {
  username,
  password,
  clientId
};
const mqttHost = 'wxs://localhost';
const mqttClient = mqtt.connect(mqttHost, mqttOptions);

mqttClient.on('connect', function() {
  console.log('connect');
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

//以下是发布和订阅的方法，其他方法详见文档
mqttClient.publish(topic, message, [options], [callback]);
mqttClient.subscribe(topic/topic array/topic object, [options], [callback]);
```
