'use strict';

class Logger {
    constructor(logger, enable, prefix) {
        this.logger = logger;
        this.enable = enable;
        this.prefix = prefix;
    }

    log(msg) {
        if (this.enable) {
            this.logger.info(`[${this.prefix}]\t${msg}`);
        }
    }
}

module.exports = Logger;