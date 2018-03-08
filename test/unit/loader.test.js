var url = require('url');
var sinon = require('sinon');
var expect = require('chai').expect;
var https = require('https');
var rewire = require('rewire');
var CachePolicy = require('http-cache-semantics');

var mod = rewire('../../loader');

describe('loader.js', function () {
  describe('handleResponseError', function () {
    var handleResponseError = mod.__get__('handleResponseError');
    it('with store', function () {
      var get = sinon.stub().returnsArg(0);
      var response = {
        store: { get: get },
        method: 'options',
        url: 'http://dafsofas.faof/fafa9l.html'
      };
      var callback = sinon.spy();
      var key = response.method + ':' + response.url;
      handleResponseError(response, null, callback);

      sinon.assert.calledWithExactly(get, key);
      sinon.assert.calledWithExactly(callback, null, key);
    });
    it('without store, error passed', function () {
      var response = {};
      var callback = sinon.spy();
      var error = {};
      handleResponseError(response, error, callback);

      sinon.assert.calledWithExactly(callback, error);
    });
    it('without store, no error passed', function () {
      var response = { statusCode: 1234, url: 'http://dafsofas.faof/fafa9l.html' };
      var callback = sinon.spy();
      handleResponseError(response, null, callback);

      sinon.assert.calledOnce(callback);
      expect(callback.getCall(0).args[0].message).equal('Fail to dowload: ' + response.url + ' - ' + response.statusCode);
    });
  });
  describe('handleResp events', function () {
    describe('200', function () {
      var handlerMap = {};
      function on(key, callback) {
        handlerMap[key] = callback;
        return this;
      }
      var response = { on: on, statusCode: 200 };
      var callback = sinon.spy();
      var handleResponseError = sinon.spy();

      before(function () {
        var handleResp = mod.__get__('handleResp');
        this.restore = mod.__set__('handleResponseError', handleResponseError);

        handleResp(response, callback);
      });
      after(function () {
        this.restore();
      });

      it('data and end', function () {
        var data1 = Buffer.from('afasfa');
        var data2 = Buffer.from('892af9a9');
        handlerMap.data(data1);
        handlerMap.data(data2);
        handlerMap.end();

        var combinedBuf = callback.getCall(0).args[1];
        expect(combinedBuf instanceof Buffer);
        expect(combinedBuf.toString()).equal(data1.toString() + data2.toString());
      });
      it('aborted', function () {
        var err = new Error();
        handlerMap.aborted(err);

        expect(handleResponseError.getCall(0).calledWithExactly(err));
      });
      it('error', function () {
        var err = new Error();
        handlerMap.error(err);

        expect(handleResponseError.getCall(1).calledWithExactly(err));
      });
    });
    describe('other', function () {
      it('call handleResponseError', function () {
        var handleResp = mod.__get__('handleResp');
        var handleResponseError = sinon.spy();
        mod.__set__('handleResponseError', handleResponseError);
        var response = { statusCode: 401 };
        var callback = {};
        handleResp(response, callback);

        sinon.assert.calledWithExactly(handleResponseError, response, null, callback);
      });
    });
  });

  describe('loadHttp', function () {
    describe('without store', function () {
      before(function () {
        var handlerMap = {};
        this.handlerMap = handlerMap;
        function on(key, callback) {
          handlerMap[key] = callback;
          return this;
        }
        sinon.stub(https, 'request').returns({ on: on });
        this.request = https.request;
        this.config = { protocol: 'https:' };
        this.callback = sinon.spy();

        mod.__get__('loadHttp')(this.config, this.callback);

        this.handleResp = sinon.spy();
        this.restore = mod.__set__('handleResp', this.handleResp);
      });
      after(function () {
        this.restore();
        https.request.restore();
      });

      it('correct request function ', function () {
        sinon.assert.calledOnce(this.request);
        expect(this.request.getCall(0).args[0]).equal(this.config);
      });

      it('correct request handler ', function () {
        var cb = this.request.getCall(0).args[1];
        expect(typeof cb).equal('function');
        var res = {};
        cb(res);

        expect(res.store).equal(undefined);
        sinon.assert.calledWithExactly(this.handleResp, res, this.callback);
      });

      it('request is ended ', function () {
        expect(typeof this.handlerMap.request).equal('function');
        var end = sinon.spy();
        var req = { end: end };
        this.handlerMap.request(req);
        sinon.assert.calledOnce(end);
      });

      it('error is handled', function () {
        expect(typeof this.handlerMap.error).equal('function');
        var err = {};
        this.handlerMap.error(err);
        sinon.assert.calledWithExactly(this.callback, err);
      });
    });
    describe('with store', function () {
      it('correct request function ', function () {
        var CacheableRequest = sinon.spy();
        CacheableRequest.prototype.createRequest = function () {
          return sinon.stub().returns({ on: sinon.spy() });
        };
        var restore = mod.__set__('CacheableRequest', CacheableRequest);
        var config = { protocol: 'https:' };
        var store = {};
        mod.__get__('loadHttp')(config, null, store);

        sinon.assert.calledWithExactly(CacheableRequest, https.request, store, CachePolicy);
        restore();
      });
    });
  });

  describe('loadFtp', function () {
    var handlerMap = {};
    function on(key, callback) {
      handlerMap[key] = callback;
      return this;
    }
    var getCallback;
    var get = sinon.stub().callsFake(function (path, cb) {
      getCallback = cb;
    });
    var connect = sinon.spy();
    function Ftp() {}
    Ftp.prototype = { on: on, get: get, connect: connect };

    var handleResp = sinon.spy();
    var handleResponseError = sinon.spy();
    var config = { path: 'abd:' };
    var callback = sinon.spy();
    var store = {};
    before(function () {
      this.restore = mod.__set__({
        Ftp: Ftp,
        handleResponseError: handleResponseError,
        handleResp: handleResp
      });
      mod.__get__('loadFtp')(config, callback, store);
    });
    after(function () {
      this.restore();
    });

    it('create ftp', function () {
      expect(typeof handlerMap.ready).equal('function');
      expect(typeof handlerMap.error).equal('function');
      sinon.assert.calledWithExactly(connect, config);
    });
    it('ready handler', function () {
      handlerMap.ready();
      sinon.assert.calledWithMatch(get, config.path, sinon.match.func);
      expect(typeof getCallback).equal('function');
    });
    it('error handler', function () {
      var err = {};
      handlerMap.error(err);
      sinon.assert.calledWithExactly(
        handleResponseError,
        sinon.match({ method: 'ftp', url: config.path, store: store }),
        err,
        callback
      );
      handleResponseError.resetHistory();
    });
    it('getCallback with error', function () {
      var err = {};
      getCallback(err);
      sinon.assert.calledWithExactly(
        handleResponseError,
        sinon.match({ method: 'ftp', url: config.path, store: store }),
        err,
        callback
      );
    });
    it('getCallback without error', function () {
      var response = {};
      getCallback(null, response);
      sinon.assert.calledWithExactly(handleResp, response, callback);
    });
  });
  describe('findConfig', function () {
    var findConfig = mod.__get__('findConfig');
    var setting = {};
    var _url = 'http://abc.com:301/dir1/dir2/abc.htm';
    it('matched', function () {
      expect(findConfig({ 'http:.+/abc\\.htm': setting }, _url)).equal(setting);
    });
    it('non-matched', function () {
      expect(findConfig({ 'httpp:.+/abc\\.htm': setting }, _url)).equal(undefined);
    });
  });

  describe('pitch', function () {
    var pitch = mod.__get__('pitch');
    function KeyvFs() {}
    before(function () {
      this.restore = mod.__set__({
        KeyvFs: KeyvFs,
        loadHttp: sinon.spy(),
        loadFtp: sinon.spy()
      });
      this.loadHttp = mod.__get__('loadHttp');
      this.loadFtp = mod.__get__('loadFtp');
    });
    after(function () {
      this.restore();
    });
    function withConfig(request, cfgField, load) {
      var callback = sinon.spy();
      var query = { http: {}, ftp: {} };
      var ctx = {
        async: function () {
          return callback;
        },
        query: query
      };
      var cfg = { a: 1, b: 2 };
      var parsedUrl = url.parse(request);
      var restore = mod.__set__('findConfig', sinon.stub().returns(cfg));

      load.resetHistory();
      pitch.call(ctx, request);
      restore();

      sinon.assert.calledWith(
        load,
        sinon.match(Object.assign(cfg, parsedUrl)),
        callback,
        sinon.match.instanceOf(KeyvFs)
      );
      expect(load.getCall(0).args[0]).not.equal(parsedUrl);
    }
    function withoutConfig(request, protocol, load) {
      var callback = sinon.spy();
      var ctx = {
        async: function () {
          return callback;
        }
      };
      var parsedUrl = { protocol: protocol, c: 1, d: 2 };
      this.sandbox.stub(url, 'parse').returns(parsedUrl);
      var restore = mod.__set__('findConfig', sinon.stub());

      load.resetHistory();
      pitch.call(ctx, request);
      restore();

      sinon.assert.calledWith(load, parsedUrl, callback, sinon.match.instanceOf(KeyvFs));
    }
    it('unsupported', function () {
      var callback = sinon.spy();
      var ctx = {
        async: function () {
          return callback;
        }
      };
      var request = 'abdef';
      pitch.call(ctx, request);
      expect(callback.getCall(0).args[0].message).equal('download: the protocol is not supported - ' + request);
    });
    describe('offline', function () {
      var findConfig = sinon.stub();
      var storeInst = {};
      function KeyvFs2() {
        return storeInst;
      }
      before(function () {
        this.restore = mod.__set__({
          KeyvFs: KeyvFs2,
          findConfig: findConfig
        });
      });
      after(function () {
        this.restore();
      });

      function createTest(outer, inner, isStore) {
        return function () {
          var callback = sinon.spy();
          var ctx = {
            query: { http: {}, offline: outer },
            async: function () {
              return callback;
            }
          };
          var cfg = { offline: inner };
          findConfig.returns(cfg);
          var request = 'https://abdef';
          pitch.call(ctx, request);
          sinon.assert.calledWith(
            this.loadHttp,
            sinon.match(Object.assign(cfg, url.parse(request))),
            callback,
            isStore ? storeInst : undefined
          );
        };
      }

      it('outer undefined, inner undefined', createTest(undefined, undefined, true));
      it('outer undefined, inner false', createTest(undefined, false, false));
      it('outer undefined, inner true', createTest(undefined, true, true));
      it('outer false, inner undefined', createTest(false, undefined, false));
      it('outer false, inner false', createTest(false, false, false));
      it('outer false, inner true', createTest(false, true, true));
      it('outer true, inner undefined', createTest(true, undefined, true));
      it('outer true, inner false', createTest(true, false, false));
      it('outer true, inner true', createTest(true, true, true));
    });

    it('http', function () {
      var request = 'http://abca.bdef:1234/afa.jpg';
      withConfig(request, 'http', this.loadHttp);
      withoutConfig.call(this, request, 'http:', this.loadHttp);
    });

    it('https', function () {
      var request = 'https://abca.bdef:1234/afa.jpg';
      withConfig(request, 'http', this.loadHttp);
      withoutConfig.call(this, request, 'http:', this.loadHttp);
    });

    it('ftp', function () {
      var request = 'ftp://abca.bdef:1234/afa.jpg';
      withConfig(request, 'ftp', this.loadFtp);
      withoutConfig.call(this, request, 'ftp:', this.loadFtp);
    });
  });
});
