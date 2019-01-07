## 说明

- 插件会对`ip`和理由请求按照配置的规则进行判断，不符合的跳转到`ipRedirectUrl | requestRedirectUrl`，或者显示`ipCode, ipMessage`或者`requestCode, requestMessage`
- 如果`ip`和路由功能都开启，则先对`IP`进行判断，然后对路由请求进行判断，代码: `config.coreMiddleware.unshift(MIDDLEWARE_NAME_IP, MIDDLEWARE_NAME_REQUEST);`
- `ip`和路由如果有设置多个规则，则只要符合其中一个，就会结束判断
  - 规则 1: 60 秒内同一个 ip 访问 30 次，则禁止访问 300 秒
  - 规则 2: 80 秒内同一个 ip 访问 40 次，则禁止访问 400 秒
  - 在`ipRule`中，使用`Array.some`方法来依次判断，假设规则 1 符合，则禁止访问 300 秒，不会再判断规则 2
- 在您的应用中必须安装`egg-redis`，配置见下方

## 依赖

> lodash, fast-json-stringify, uglify-es

## 安装

```bash
$ npm i egg-full-count egg-redis --save
```

## 使用

```js
// config/plugin.js
exports.fullFirewall = {
  enable: true,
  package: 'egg-full-count',
};

exports.redis = {
  enable: true,
  package: 'egg-redis',
};
```

## 配置

### 本插件配置 (必选)

```js
// {app_root}/config/config.default.js
exports.fullFirewall = {
  // 是否检测IP
  useIP: true,
  // IP 检测规则, interval 时间间隔(秒), count 间隔内允许的次数, expire 封禁时间(秒)
  // 未配置 ipRule 则不会进行检测，但 ipDisabled 仍然有效
  ipRule: [
    // 60秒内请求超过3次就会被封禁300秒
    {
      interval: 60,
      count: 3,
      expire: 300,
    },
  ],
  // IP 被禁的时候，跳转的地址，优先级高于 ipCode和ipMessage，eg: '/ip-disabled'
  ipRedirectUrl: null,
  // IP 被禁的时候返回值
  ipCode: 403,
  // IP 被禁的时候返回的内容
  ipMessage: 'IP DISABLED',
  // 指定忽略检测的 IP列表
  // ipIgnore: ['127.0.0.1'],
  ipIgnore: [],
  // 直接封禁的 IP, useIP需要为 true
  ipDisabled: [],
  // IP 检测时忽略的路由, 支持以 * 结尾
  // 本功能主要用于 ipRedirectUrl, requestRedirectUrl
  // 如果这两个页面中需要请求资源，则会在 ip 判断中被阻止，ip 被阻止后会跳转到 ipRedirectUrl，造成死循环
  // 如果想控制这些资源，可以在 requestRule 进行配置
  ipIgnoreRequest: [
    {
      method: 'GET',
      url: '/build/*',
    },
    {
      method: '/favicon.ico',
      url: '/favicon.ico',
    },
  ],

  // 是否检测路由请求
  useRequest: true,
  // 路由请求 检测规则, url(s) 请求的路由(们), method 方法,interval 时间间隔(秒), count 间隔内允许的次数, expire 封禁时间(秒)
  requestRule: [
    // 示例: 60秒内用 GET 访问 / 或者 /404 3次以上会被封禁300秒
    {
      // 大写
      method: 'GET',
      interval: 60,
      count: 3,
      expire: 300,
      // 本规则应用到的路由
      urls: ['/', '/404'],
    },
  ],
  // 路由请求 被禁的时候，跳转的地址，优先级高于 requestCode 和 requestMessage ，eg: '/request-disabled'
  requestRedirectUrl: null,
  // 路由请求 被禁的时候返回值
  requestCode: 403,
  // 路由请求 被禁的时候返回的内容
  requestMessage: 'REQUEST DISABLED',
  // 忽略指定 IP 的路由请求
  // requestIgnoreIP: ['127.0.0.1'],
  requestIgnoreIP: [],

  // 本中间件使用 egg-redis，如果没有配置redis对应的名称，则默认使用 app.redis
  ipRedisName: null,
  requestName: null,
  // redis 键前缀
  ipRedisPrefix: 'ip:count',
  requestRedisPrefix: 'request:count',
};
```

### egg-redis 配置 1 (二选一)

```js
// 没有指定 ipRedisName 和 requestName, 则直接使用 app.redis
config.redis = {
  client: {
    port: 6379,
    host: '127.0.0.1',
    password: '123456',
    db: 0,
  },
};
```

### egg-redis 配置 2 (二选一)

```js
/**
 * 如果不希望本插件的缓存数据与应用的缓存混在一起，可以指定 ipRedisName 和 requestName
 * 比如指定 ipRedisName 为 firewallIP, requestName 为 firewallRequest
 * 不要忘记在 fullFirewall 配置中填上名称，ipRedisName和requestName默认都为null
 */

config.redis = {
  clients: {
    firewallIP: {
      port: 6379,
      host: '127.0.0.1',
      password: '123456',
      db: 0,
    },
    firewallRequest: {
      port: 6379,
      host: '127.0.0.1',
      password: '123456',
      db: 1,
    },
  },
};
```

## License

[MIT](LICENSE)
