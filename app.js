'use strict';

const assert = require('assert');
const _ = require('lodash');

const MIDDLEWARE_NAME_IP = 'firewallIp';
const MIDDLEWARE_NAME_REQUEST = 'firewallRequest';

module.exports = app => {
    const {
        config,
    } = app;

    _.forEach([MIDDLEWARE_NAME_IP, MIDDLEWARE_NAME_REQUEST], name => {
        const index = config.coreMiddleware.indexOf(name);
        assert.equal(
            index,
            -1,
            `Duplication of middleware name found: ${name}. Rename your middleware other than "${name}" please.`
        );
    });

    // 配置检查与转换
    const {
        fullFirewall
    } = config;

    if (fullFirewall.useIP) {
        if (!_.isArray(fullFirewall.ipRule)) {
            fullFirewall.ipRule = [];
        }
        if (!_.isArray(fullFirewall.ipIgnore)) {
            fullFirewall.ipIgnore = [];
        }
        if (!_.isArray(fullFirewall.ipDisabled)) {
            fullFirewall.ipDisabled = [];
        }
        if (!_.isArray(fullFirewall.ipIgnoreRequest)) {
            fullFirewall.ipIgnoreRequest = [];
        } else {
            _.forEach(fullFirewall.ipIgnoreRequest, item => {
                if (_.isNil(item.method)) {
                    assert.fail('method(GET | POST | PUT ...) is required in every ipIgnoreRequest configuration');
                }
                item.method = _.toUpper(item.method);
            });
        }
        if (fullFirewall.ipRedirectUrl) {
            fullFirewall.ipIgnoreRequest.push({
                method: 'GET',
                url: fullFirewall.ipRedirectUrl,
            })
        }
    }

    if (fullFirewall.useRequest) {
        if (!_.isArray(fullFirewall.requestRule)) {
            fullFirewall.requestRule = [];
        } else {
            _.forEach(fullFirewall.requestRule, c => {
                if (_.isNil(c.method)) {
                    assert.fail('method(GET | POST | PUT ...) is required in every requestRule configuration');
                }
                c.method = _.toUpper(c.method);
            });
        }
        if (!_.isArray(fullFirewall.requestIgnoreIP)) {
            fullFirewall.requestIgnoreIP = [];
        }
    }

    // 尽量放置在最前面
    config.coreMiddleware.unshift(MIDDLEWARE_NAME_IP, MIDDLEWARE_NAME_REQUEST);
};