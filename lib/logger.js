'use strict';

class Logger {
  constructor(logger, enable, prefix) {
    this.logger = logger;
    this.enable = enable;
    this.prefix = prefix;
    this.debugAble = enable && process.env.NODE_ENV !== 'production';
  }

  info(msg) {
    if (this.enable) {
      this.logger.info(`[${this.prefix}]\t${msg}`);
    }
  }

  debug(msg) {
    if (this.debugAble) {
      this.logger.info(`[${this.prefix}]\t${msg}`);
    }
  }
}

module.exports = Logger;
