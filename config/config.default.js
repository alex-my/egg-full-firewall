'use strict';

exports.fullFirewall = {
  // 是否开启日志，日志位于 logs/你的项目名称/egg-web.log
  logEnable: false,
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
  ipIgnoreRequest: [{
    method: 'GET',
    url: '/build/*',
  }, {
    method: 'GET',
    url: '/favicon.ico',
  }],

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
      urls: [ '/', '/404' ],
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
