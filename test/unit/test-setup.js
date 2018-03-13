import sinon from 'sinon';
import chai from 'chai';
import sinonChai from 'sinon-chai';

before(() => {
  chai.use(sinonChai);
});

beforeEach('set sinon this.sandbox', function () {
  this.sandbox = sinon.sandbox.create();
});
afterEach('restore sinon this.sandbox', function () {
  this.sandbox.restore();
});
