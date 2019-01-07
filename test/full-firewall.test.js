'use strict';

const mock = require('egg-mock');

describe('test/full-firewall.test.js', () => {
  let app;
  before(() => {
    app = mock.app({
      baseDir: 'apps/full-firewall-test',
    });
    return app.ready();
  });

  after(() => app.close());
  afterEach(mock.restore);

  it('should GET /', () => {
    return app.httpRequest()
      .get('/')
      .expect('hi, fullFirewall')
      .expect(200);
  });
});
