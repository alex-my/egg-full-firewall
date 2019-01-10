'use strict';

const _ = require('lodash');
const fastJson = require('fast-json-stringify');
const Logger = require('../../lib/logger');

module.exports = (options, app) => {
  const {
    logEnable,
    useIP,
    ipRule,
    ipRedirectUrl,
    ipCode,
    ipMessage,
    ipIgnore,
    ipDisabled,
    ipRedisName,
    ipRedisPrefix,
    ipIgnoreRequest,
  } = app.config.fullFirewall;
  const redis = ipRedisName ? app.redis.get(ipRedisName) : app.redis;
  const logger = new Logger(app.coreLogger, logEnable, 'firewallIP');

  // 查找最大的 interval 做为缓存有效时间
  let cacheExpire = 0;
  _.forEach(ipRule, rule => {
    if (rule.interval > cacheExpire) {
      cacheExpire = rule.interval;
    }
  });

  // 预定义 JSON 转换结构
  const stringify = fastJson({
    title: 'Firewall IP Info',
    type: 'object',
    properties: {
      pret_t: {
        type: 'integer'
      },
      count: {
        type: 'integer'
      },
      disable_t: {
        type: 'integer'
      },
    }
  }, {
    uglify: true
  });

  const checkIP = async (ip, method, path) => {
    // 被禁止
    if (ipDisabled.some(val => val === ip)) {
      logger.log(`ip: ${ip} in the forbidden list`);
      return false;
    }
    // 未设置规则
    if (_.isEmpty(ipRule)) {
      return true;
    }
    // 忽略
    if (ipIgnore.some(val => val === ip)) {
      logger.log(`ip: ${ip} in the ignore list`);
      return true;
    }
    // 某些路由不受 IP 判断
    const ignoreRequestResult = ipIgnoreRequest.some(rule => {
      if (rule.method !== method) {
        return false;
      }
      const {
        url
      } = rule;
      if (url.charAt(url.length - 1) === '*') {
        const checkUrl = url.slice(0, url.length - 1);
        if (_.startsWith(path, checkUrl)) {
          return true;
        }
      } else if (url === path) {
        return true;
      }
      return false;
    })
    if (ignoreRequestResult) {
      logger.log(`path: ${path} in the ignore list`);
      return true;
    };

    const cacheKey = `${ipRedisPrefix}:${ip}`;
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
        logger.log(`ip: ${ip} is currently in the limit period`);
        return false;
      }

      info.count += 1;

      const result = ipRule.some(rule => {
        if (t - info.pret_t < rule.interval) {
          if (info.count > rule.count) {
            // 违反了本规则
            redis.set(cacheKey, stringify({
              pret_t: t,
              count: 0,
              disable_t: t + rule.expire,
            }), 'EX', cacheExpire);
            logger.log(`ip: ${ip} violation of rule ${JSON.stringify(rule)}`);
            return true;
          }
        }
        return false;
      });

      if (result) {
        // 违法了规则
        return false;
      }
      // 没有违反规则，则记录本次访问
      redis.set(cacheKey, stringify({
        pret_t: t,
        count: info.count,
        disable_t: 0,
      }), 'EX', cacheExpire);

    } else {
      // 没有任何记录，创建一个记录存储
      redis.set(cacheKey, stringify({
        pret_t: t,
        count: 1,
        disable_t: 0,
      }), 'EX', cacheExpire);
    }

    return true;
  };

  return async function firewallIP(ctx, next) {
    if (useIP) {
      const result = await checkIP(ctx.ip, ctx.request.method, ctx.path);
      if (!result) {
        if (ipRedirectUrl) {
          logger.log(`ip limit, redirect to ${ipRedirectUrl}`);
          await ctx.redirect(ipRedirectUrl);
        } else {
          ctx.status = ipCode;
          ctx.body = ipMessage;
          logger.log(`ip limit, status: ${ipCode}, body: ${JSON.stringify(ipMessage)}`);
        }
        return;
      }
    }
    await next();
  };
};