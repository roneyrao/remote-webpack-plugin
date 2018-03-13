import url from 'url';
import sinon from 'sinon';
import { expect } from 'chai';
import https from 'https';

import { pitch, __RewireAPI__ } from '../../src/loader';

describe('loader.js', () => {
  describe('getStreamKeyForStore', () => {
    const getStreamKeyForStore = __RewireAPI__.__get__('getStreamKeyForStore');
    it('method and url', () => {
      const stream = { method: 'afafa', url: 'asfafaf' };
      expect(getStreamKeyForStore(stream)).equal(`${stream.method}:${stream.url}`);
    });
  });
  describe('handleStreamError', () => {
    const handleStreamError = __RewireAPI__.__get__('handleStreamError');
    it('with store', () => {
      const get = sinon.stub().returnsArg(0);
      const response = {
        store: { get },
        method: 'options',
        url: 'http://dafsofas.faof/fafa9l.html',
      };
      const callback = sinon.spy();
      const key = `${response.method}:${response.url}`;
      handleStreamError(response, null, callback);

      sinon.assert.calledWithExactly(get, key);
      sinon.assert.calledWithExactly(callback, null, key);
    });
    it('without store, error passed', () => {
      const response = {};
      const callback = sinon.spy();
      const error = {};
      handleStreamError(response, error, callback);

      sinon.assert.calledWithExactly(callback, error);
    });
    it('without store, no error passed', () => {
      const response = { statusCode: 1234, url: 'http://dafsofas.faof/fafa9l.html' };
      const callback = sinon.spy();
      handleStreamError(response, null, callback);

      sinon.assert.calledOnce(callback);
      expect(callback.getCall(0).args[0].message).equal(`Fail to dowload: ${response.url} - ${response.statusCode}`);
    });
  });
  describe('handleStream events', () => {
    const handlerMap = {};
    function on(key, callback) {
      handlerMap[key] = callback;
      return this;
    }
    const set = sinon.spy();
    const response = { on, store: { set } };
    const handleStream = __RewireAPI__.__get__('handleStream');
    const key = 'aafaa';
    const callback = sinon.spy();

    before(function () {
      __RewireAPI__.__set__({
        handleStreamError: sinon.spy(),
        getStreamKeyForStore: sinon.stub().returns(key),
      });
      this.handleStreamError = __RewireAPI__.__get__('handleStreamError');
    });
    after(function () {
      __RewireAPI__.__ResetDependency__();
    });
    beforeEach(function () {
      this.handleStreamError.resetHistory();
    });

    it('data and end, toSave', () => {
      handleStream(response, true, callback);
      const data1 = Buffer.from('afasfa');
      const data2 = Buffer.from('892af9a9');
      handlerMap.data(data1);
      handlerMap.data(data2);
      handlerMap.end();

      const combinedBuf = callback.getCall(0).args[1];
      expect(combinedBuf instanceof Buffer);
      sinon.assert.calledWithExactly(set, key, combinedBuf);
      expect(combinedBuf.toString()).equal(data1.toString() + data2.toString());
    });
    it('data and end, no save', () => {
      handleStream(response, false, callback);
      handlerMap.end();

      set.resetHistory();
      sinon.assert.notCalled(set);
    });
    it('aborted', function () {
      handleStream(response, null, callback);
      const err = new Error();
      handlerMap.aborted(err);

      sinon.assert.calledWithExactly(this.handleStreamError, response, err, callback);
    });
    it('error', function () {
      handleStream(response, null, callback);
      const err = new Error();
      handlerMap.error(err);

      sinon.assert.calledWithExactly(this.handleStreamError, response, err, callback);
    });
  });

  describe('loadHttp', () => {
    describe('without store', () => {
      before(function () {
        const handlerMap = {};
        this.handlerMap = handlerMap;
        function on(key, callback) {
          handlerMap[key] = callback;
          return this;
        }
        sinon.stub(https, 'request').returns({ on });
        this.request = https.request;
        this.config = { protocol: 'https:' };
        this.callback = sinon.spy();

        __RewireAPI__.__get__('loadHttp')(this.config, this.callback);

        this.handleStream = sinon.spy();
        this.handleStreamError = sinon.spy();
        __RewireAPI__.__set__({
          handleStreamError: this.handleStreamError,
          handleStream: this.handleStream,
        });
      });
      after(function () {
        __RewireAPI__.__ResetDependency__();
        https.request.restore();
      });

      it('correct request function ', function () {
        sinon.assert.calledOnce(this.request);
        expect(this.request.getCall(0).args[0]).equal(this.config);
      });

      it('request handler, 200', function () {
        const cb = this.request.getCall(0).args[1];
        expect(typeof cb).equal('function');
        const res = { statusCode: 200 };
        cb(res);

        expect(res.store).equal(undefined);
        sinon.assert.calledWithExactly(this.handleStream, res, false, this.callback);
      });
      it('request handler, 404', function () {
        const cb = this.request.getCall(0).args[1];
        const res = { statusCode: 404 };
        cb(res);

        sinon.assert.calledWithExactly(this.handleStreamError, res, null, this.callback);
      });

      it('request is ended ', function () {
        expect(typeof this.handlerMap.request).equal('function');
        const end = sinon.spy();
        const req = { end };
        this.handlerMap.request(req);
        sinon.assert.calledOnce(end);
      });

      it('error is handled', function () {
        expect(typeof this.handlerMap.error).equal('function');
        const err = {};
        this.handlerMap.error(err);
        sinon.assert.calledWithExactly(this.callback, err);
      });
    });
    describe('with store', () => {
      it('correct request settings ', () => {
        const request = sinon.stub().returns({ on: sinon.spy() });
        const inst = {
          cache: { opts: {} },
          createRequest() {
            return request;
          },
        };
        const CacheableRequest = sinon.stub().returns(inst);
        __RewireAPI__.__set__('CacheableRequest', CacheableRequest);
        const config = { protocol: 'https:' };
        const store = {
          namespace: 'afadaf',
        };
        __RewireAPI__.__get__('loadHttp')(config, null, store);

        sinon.assert.calledWithExactly(CacheableRequest, https.request, store);
        expect(inst.CachePolicy).equal(__RewireAPI__.__get__('NewCachePolicy'));
        expect(inst.cache.opts.namespace).equal(store.namespace);
        sinon.assert.calledOnce(request);
        __RewireAPI__.__ResetDependency__();
      });
    });
  });

  describe('loadFtp', () => {
    const handlerMap = {};
    function on(key, callback) {
      handlerMap[key] = callback;
      return this;
    }
    let getCallback;
    const get = sinon.stub().callsFake((path, cb) => {
      getCallback = cb;
    });
    const connect = sinon.spy();
    function Ftp() {}
    Ftp.prototype = { on, get, connect };

    const handleStream = sinon.spy();
    const handleStreamError = sinon.spy();
    const config = { path: 'abd:' };
    const callback = sinon.spy();
    const store = {};
    before(function () {
      __RewireAPI__.__set__({
        Ftp,
        handleStreamError,
        handleStream,
      });
      __RewireAPI__.__get__('loadFtp')(config, callback, store);
    });
    after(function () {
      __RewireAPI__.__ResetDependency__();
    });

    it('create ftp', () => {
      expect(typeof handlerMap.ready).equal('function');
      expect(typeof handlerMap.error).equal('function');
      sinon.assert.calledWithExactly(connect, config);
    });
    it('ready handler', () => {
      handlerMap.ready();
      sinon.assert.calledWithMatch(get, config.path, sinon.match.func);
      expect(typeof getCallback).equal('function');
    });
    it('error handler', () => {
      const err = {};
      handlerMap.error(err);
      sinon.assert.calledWithExactly(
        handleStreamError,
        sinon.match({ method: 'ftp', url: config.path, store }),
        err,
        callback,
      );
      handleStreamError.resetHistory();
    });
    it('getCallback with error', () => {
      const err = {};
      getCallback(err);
      sinon.assert.calledWithExactly(
        handleStreamError,
        sinon.match({ method: 'ftp', url: config.path, store }),
        err,
        callback,
      );
    });
    it('getCallback without error', () => {
      const response = {};
      getCallback(null, response);
      sinon.assert.calledWithExactly(handleStream, response, true, callback);
    });
  });
  describe('findConfig', () => {
    const findConfig = __RewireAPI__.__get__('findConfig');
    const setting = {};
    const _url = 'http://abc.com:301/dir1/dir2/abc.htm';
    it('matched', () => {
      expect(findConfig({ 'http:.+/abc\\.htm': setting }, _url)).equal(setting);
    });
    it('non-matched', () => {
      expect(findConfig({ 'httpp:.+/abc\\.htm': setting }, _url)).equal(undefined);
    });
  });

  describe('pitch', () => {
    const KeyvFs = sinon.spy();
    before(function () {
      __RewireAPI__.__set__({
        KeyvFs,
        loadHttp: sinon.spy(),
        loadFtp: sinon.spy(),
      });
      this.loadHttp = __RewireAPI__.__get__('loadHttp');
      this.loadFtp = __RewireAPI__.__get__('loadFtp');
    });
    after(function () {
      __RewireAPI__.__ResetDependency__();
    });
    describe('general', () => {
      function withConfig(request, cfgField, load) {
        const callback = sinon.spy();
        const cacheDir = 'afasdfdasf';
        const query = { cacheDir, http: {}, ftp: {} };
        const ctx = {
          async() {
            return callback;
          },
          query,
        };
        const cfg = { a: 1, b: 2 };
        const parsedUrl = url.parse(request);
        __RewireAPI__.__set__('findConfig', sinon.stub().returns(cfg));

        load.resetHistory();
        pitch.call(ctx, request);
        __RewireAPI__.__ResetDependency__();

        sinon.assert.calledWith(
          load,
          sinon.match(Object.assign(cfg, parsedUrl)),
          callback,
          sinon.match.instanceOf(KeyvFs),
        );
        expect(load.getCall(0).args[0]).not.equal(parsedUrl);
      }
      function withoutConfig(request, protocol, load) {
        const callback = sinon.spy();
        const ctx = {
          async() {
            return callback;
          },
        };
        const parsedUrl = { protocol, c: 1, d: 2 };
        this.sandbox.stub(url, 'parse').returns(parsedUrl);
        __RewireAPI__.__set__('findConfig', sinon.stub());

        load.resetHistory();
        pitch.call(ctx, request);
        __RewireAPI__.__ResetDependency__();

        sinon.assert.calledWith(load, parsedUrl, callback, sinon.match.instanceOf(KeyvFs));
      }
      it('unsupported', () => {
        const callback = sinon.spy();
        const ctx = {
          async() {
            return callback;
          },
        };
        const request = 'abdef';
        pitch.call(ctx, request);
        expect(callback.getCall(0).args[0].message).equal(`download: the protocol is not supported - ${request}`);
      });

      it('http', function () {
        const request = 'http://abca.bdef:1234/afa.jpg';
        withConfig(request, 'http', this.loadHttp);
        withoutConfig.call(this, request, 'http:', this.loadHttp);
      });

      it('https', function () {
        const request = 'https://abca.bdef:1234/afa.jpg';
        withConfig(request, 'http', this.loadHttp);
        withoutConfig.call(this, request, 'http:', this.loadHttp);
      });

      it('ftp', function () {
        const request = 'ftp://abca.bdef:1234/afa.jpg';
        withConfig(request, 'ftp', this.loadFtp);
        withoutConfig.call(this, request, 'ftp:', this.loadFtp);
      });
    });
    describe('allow cache', () => {
      const findConfig = sinon.stub();
      const storeInst = {};
      before(function () {
        __RewireAPI__.__set__({
          KeyvFs: sinon.stub().returns(storeInst),
          findConfig,
        });
      });
      after(function () {
        __RewireAPI__.__ResetDependency__();
      });

      function createTest(cacheDir, cache, isStore, namespace) {
        return function () {
          const callback = sinon.spy();
          const ctx = {
            query: { http: {}, cacheDir },
            async() {
              return callback;
            },
          };
          const cfg = { cache };
          findConfig.returns(cfg);
          const request = 'https://abdef';
          pitch.call(ctx, request);
          sinon.assert.calledWith(
            this.loadHttp,
            sinon.match(Object.assign(cfg, url.parse(request))),
            callback,
            isStore ? storeInst : undefined,
          );
          if (isStore) {
            expect(storeInst.namespace).equal(namespace);
          }
        };
      }
      const defaultCacheDir = '__download_cache__';
      const customCacheDir = 'afafa';

      it(
        'cacheDir undefined, cache undefined',
        createTest(undefined, undefined, true, defaultCacheDir),
      );
      it('cacheDir undefined, cache false', createTest(undefined, false, false));
      it('cacheDir undefined, cache true', createTest(undefined, true, true, defaultCacheDir));
      it('cacheDir false, cache undefined', createTest(false, undefined, false));
      it('cacheDir false, cache false', createTest(false, false, false));
      it('cacheDir false, cache true', createTest(false, true, true, defaultCacheDir));
      it('cacheDir true, cache undefined', createTest(true, undefined, true, defaultCacheDir));
      it('cacheDir true, cache false', createTest(true, false, false));
      it('cacheDir true, cache true', createTest(true, true, true, defaultCacheDir));
      it(
        'cacheDir string, cache undefined',
        createTest(customCacheDir, undefined, true, customCacheDir),
      );
      it('cacheDir string, cache false', createTest(customCacheDir, false, false));
      it('cacheDir string, cache true', createTest(customCacheDir, true, true, customCacheDir));
    });
  });
});
