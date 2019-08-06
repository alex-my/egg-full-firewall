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

  // 预定义 JSON 转换结构，加快 JSON 压缩
  const schema = {
    title: 'Item Rule',
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
  };

  const stringify = fastJson({
    title: 'Firewall IP Rules',
    type: 'array',
    items: schema,
  }, {
    uglify: true,
  });

  const stringifyRule = fastJson({
    title: 'Firewall IP Rule',
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

  const stringifyDefinedRule = fastJson({
    title: 'Firewall IP Defined Rule',
    type: 'object',
    properties: {
      interval: {
        type: 'integer',
      },
      count: {
        type: 'integer',
      },
      expire: {
        type: 'integer',
      },
    },
  }, {
    uglify: true,
  });

  const checkIP = async (ip, method, path) => {
    // 被禁止
    if (ipDisabled.some(val => val === ip)) {
      logger.info(`ip: ${ip} in the forbidden list`);
      return false;
    }
    // 未设置规则
    if (_.isEmpty(ipRule)) {
      return true;
    }
    // 忽略
    if (ipIgnore.some(val => val === ip)) {
      logger.info(`ip: ${ip} in the ignore list`);
      return true;
    }
    // 某些路由不受 IP 判断
    const ignoreRequestResult = ipIgnoreRequest.some(rule => {
      if (rule.method !== method) {
        return false;
      }
      const {
        url,
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
    });

    if (ignoreRequestResult) {
      return true;
    }

    const cacheKey = `${ipRedisPrefix}:${ip}`;
    const cacheValue = await redis.get(cacheKey);
    const rules = JSON.parse(cacheValue);
    /**
     * pre_t: 上一次检测的时间戳
     * count: 已访问的次数
     * disable_t: 封禁的时间戳
     */
    const t = _.parseInt(new Date() / 1000, 10);

    // 检测是否达到规则指定的条件
    // 数量不相符表示更改了规则
    if (rules && _.size(rules) === _.size(ipRule)) {
      // 是否在封禁时间内
      const isDisable = rules.some(rule => {
        if (rule.disable_t > t) {
          logger.info(`ip: ${ip} is currently in the limit period, rest time: ${t - rule.disable_t}s`);
          return true;
        }
        return false;
      });

      if (isDisable) {
        return false;
      }

      // 检查是否违法了规则
      let isLimit = false;
      _.forEach(rules, (rule, index) => {
        const definedRule = ipRule[index];

        rule.count += 1;
        if (t - rule.pret_t < definedRule.interval) {
          if (rule.count > definedRule.count) {
            // 违反了规则
            rule.disable_t = t + definedRule.expire;
            isLimit = true;
            logger.info(`ip: ${ip} violation of rule: ${stringifyRule(rule)}, definedRule: ${stringifyDefinedRule(definedRule)}, t: ${t}`);
          }
        } else {
          // 重新计数
          rule.pret_t = t;
          rule.count = 0;
          // logger.debug('reset rule');
        }
      });

      // 更新本次数据
      const value = stringify(rules);
      redis.set(cacheKey, value, 'EX', cacheExpire);
      // logger.debug(`update record, key: ${cacheKey}, value: ${value}`);

      return !isLimit;
    }

    // 没有任何记录，创建一个记录存储

    // 定义初始的缓存结构
    const initRules = [];
    _.forEach(ipRule, () => {
      initRules.push({
        pret_t: t,
        count: 1,
        disable_t: 0,
      });
    });

    const value = stringify(initRules);

    redis.set(cacheKey, value, 'EX', cacheExpire);

    // logger.debug(`new record, key: ${cacheKey}, initRules: ${value}`);
    return true;
  };

  return async function firewallIP(ctx, next) {
    if (useIP) {
      const result = await checkIP(ctx.ip, ctx.request.method, ctx.path);
      if (!result) {
        if (ipRedirectUrl) {
          logger.info(`ip limit, redirect to ${ipRedirectUrl}`);
          await ctx.redirect(ipRedirectUrl);
        } else {
          ctx.status = ipCode;
          ctx.body = ipMessage;
        }
        return;
      }
    }
    await next();
  };
};
