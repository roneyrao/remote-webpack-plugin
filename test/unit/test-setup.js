var sinon = require('sinon');
var chai = require('chai');
var sinonChai = require('sinon-chai');

before(function () {
  chai.use(sinonChai);
});

beforeEach('set sinon this.sandbox', function () {
  this.sandbox = sinon.sandbox.create();
});
afterEach('restore sinon this.sandbox', function () {
  this.sandbox.restore();
});
