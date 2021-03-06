'use strict';

const _ = require('lodash');
const fastJson = require('fast-json-stringify');
const Logger = require('../../lib/logger');

module.exports = (options, app) => {
  const {
    logEnable,
    useRequest,
    requestRule,
    requestRedirectUrl,
    requestCode,
    requestMessage,
    requestIgnoreIP,
    requestName,
    requestRedisPrefix,
  } = app.config.fullFirewall;
  const redis = requestName ? app.redis.get(requestName) : app.redis;
  const logger = new Logger(app.coreLogger, logEnable, 'firewallRequest');

  // 查找最大的 interval 做为缓存有效时间
  let cacheExpire = 0;
  // 记录所有要检测的路由
  let urlList = [];
  _.forEach(requestRule, rule => {
    if (rule.interval > cacheExpire) {
      cacheExpire = rule.interval;
    }
    urlList = urlList.concat(rule.urls);
  });
  const urls = new Set(urlList);

  // 预定义 JSON 转换结构
  const stringify = fastJson({
    title: 'Firewall Request Info',
    type: 'object',
    properties: {
      pret_t: {
        type: 'integer',
      },
      count: {
        type: 'integer',
      },
      disable_t: {
        type: 'integer',
      },
    },
  }, {
    uglify: true,
  });

  const checkRequest = async (ip, method, path) => {
    // 未设置规则
    if (_.isEmpty(requestRule)) {
      return true;
    }
    // 不在规则里面
    if (!urls.has(path)) {
      return true;
    }
    // 忽略
    if (requestIgnoreIP.some(val => val === ip)) {
      logger.info(`ip: ${ip} in the ignore list`);
      return true;
    }

    const cacheKey = `${requestRedisPrefix}:${ip}:${method}:${encodeURIComponent(
      path
    )}`;
    const cacheValue = await redis.get(cacheKey);
    const info = JSON.parse(cacheValue);
    /**
     * info:
     * pre_t: 上一次检测的时间戳
     * count: 已访问的次数
     * disable_t: 封禁的时间戳
     */
    const t = _.parseInt(new Date() / 1000, 10);

    // 检测是否达到规则指定的条件
    if (info) {
      // 是否在封禁时间内
      if (info.disable_t > t) {
        logger.info(
          `request: ${method} ${path} is currently in the limit period`
        );
        return false;
      }

      info.count += 1;

      const result = requestRule.some(rule => {
        if (rule.method === method) {
          if (rule.urls.some(url => url === path)) {
            // path 适用于本规则
            if (t - info.pret_t < rule.interval) {
              if (info.count > rule.count) {
                // 违反了本规则
                redis.set(
                  cacheKey,
                  stringify({
                    pret_t: t,
                    count: 0,
                    disable_t: t + rule.expire,
                  }),
                  'EX',
                  cacheExpire
                );
                logger.info(
                  `request: ${method} ${path} violation of rule ${JSON.stringify(
                    rule
                  )}, t: ${t}, info: ${JSON.stringify(info)}`
                );
                return true;
              }
            }
          }
        }
        return false;
      });

      if (result) {
        // 违法了规则
        return false;
      }
      // 没有违反规则，则记录本次访问
      redis.set(
        cacheKey,
        stringify({
          pret_t: info.pret_t,
          count: info.count,
          disable_t: 0,
        }),
        'EX',
        cacheExpire
      );

      logger.debug(
        `update record, key: ${cacheKey}, pre_t: ${info.pret_t}, count: ${info.count}`
      );
    } else {
      // 没有任何记录，创建一个记录存储
      redis.set(
        cacheKey,
        stringify({
          pret_t: t,
          count: 1,
          disable_t: 0,
        }),
        'EX',
        cacheExpire
      );

      logger.debug(`new record, key: ${cacheKey}, pre_t: ${t}, count: 1`);
    }

    return true;
  };

  return async function firewallRequest(ctx, next) {
    if (useRequest) {
      const result = await checkRequest(ctx.ip, ctx.request.method, ctx.path);
      if (!result) {
        if (requestRedirectUrl) {
          logger.info(`request limit, redirect to ${requestRedirectUrl}`);
          await ctx.redirect(requestRedirectUrl);
        } else {
          ctx.status = requestCode;
          ctx.body = requestMessage;
          logger.info(
            `request limit, status: ${requestCode}, body: ${JSON.stringify(
              requestMessage
            )}`
          );
        }
        return;
      }
    }
    await next();
  };
};
