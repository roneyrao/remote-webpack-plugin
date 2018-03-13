import path from 'path';
import sinon from 'sinon';
import { expect } from 'chai';
import copy from 'deepcopy';

import DownloadWebpackPlugin, { __RewireAPI__ } from '../../src/';

describe('index.js', () => {
  describe('combineHttpAuth', () => {
    const combineHttpAuth = __RewireAPI__.__get__('combineHttpAuth');

    function check(map, map2) {
      combineHttpAuth(map);
      expect(map).eql(map2);
    }

    it('no user and password', () => {
      const map = {
        'abc.com': {
          method: 'post',
        },
      };
      const map2 = copy(map);

      check(map, map2);
    });

    it('only user', () => {
      const map = {
        'abc.com': {
          method: 'post',
          user: 'user',
        },
      };
      const map2 = {
        'abc.com': {
          method: 'post',
          auth: 'user',
        },
      };
      check(map, map2);
    });

    it('user and password', () => {
      const map = {
        'abc.com': {
          method: 'post',
          user: 'user',
          password: 'password',
        },
      };
      const map2 = {
        'abc.com': {
          method: 'post',
          auth: 'user:password',
        },
      };
      check(map, map2);
    });
  });

  describe('checkProtocol', () => {
    const checkProtocol = __RewireAPI__.__get__('checkProtocol');

    it('abdef', () => {
      expect(checkProtocol('abdef')).not.to.be.ok;
    });

    it('http', () => {
      expect(checkProtocol('http://abc')).to.be.ok;
    });

    it('https', () => {
      expect(checkProtocol('https://abc')).to.be.ok;
    });

    it('ftp', () => {
      expect(checkProtocol('ftp://abc')).to.be.ok;
    });

    it('ftps', () => {
      expect(checkProtocol('ftps://abc')).to.be.ok;
    });
  });

  describe('DownloadWebpackPlugin', () => {
    it('no options', () => {
      __RewireAPI__.__set__('combineHttpAuth', sinon.spy());
      new DownloadWebpackPlugin(); // eslint-disable-line no-new
      sinon.assert.notCalled(__RewireAPI__.__get__('combineHttpAuth'));

      __RewireAPI__.__ResetDependency__();
    });
    it('stores options', () => {
      __RewireAPI__.__set__('combineHttpAuth', sinon.spy());
      const options = {
        http: {},
      };
      const inst = new DownloadWebpackPlugin(options);
      expect(inst.options).equal(options);
      sinon.assert.calledWithExactly(__RewireAPI__.__get__('combineHttpAuth'), options.http);

      __RewireAPI__.__ResetDependency__();
    });
  });

  describe('DownloadWebpackPlugin.prototype.apply', () => {
    const loaderPath = path.resolve('src/loader.js');
    const options = {};
    const callbackMap = {};
    function plugin(key, callback) {
      callbackMap[key] = callback;
    }
    const compiler = { plugin };
    const inst = new DownloadWebpackPlugin(options);
    inst.apply(compiler);

    describe('before-compile', () => {
      let key;
      let afterResolve;
      function plugin2(_key, _afterResolve) {
        key = _key;
        afterResolve = _afterResolve;
      }
      const params = {
        normalModuleFactory: {
          plugin: plugin2,
        },
      };
      const callback = sinon.spy();
      callbackMap['before-compile'](params, callback);

      it('install plugin and exec callback', () => {
        expect(key).equal('after-resolve');
        expect(typeof afterResolve).equal('function');
        sinon.assert.calledOnce(callback);
      });
      it('after-resolve executes correctly', () => {
        __RewireAPI__.__set__('checkProtocol', sinon.spy());
        const checkProtocol = __RewireAPI__.__get__('checkProtocol');
        const data = { resource: {} };
        const callback2 = sinon.spy();
        afterResolve(data, callback2);

        sinon.assert.calledWithExactly(callback2, null, data);
        sinon.assert.calledWithExactly(checkProtocol, data.resource);
        __RewireAPI__.__ResetDependency__();
      });
      it('download, no otherLoader', () => {
        __RewireAPI__.__set__({
          checkProtocol() {
            return true;
          },
        });
        const resource = 'http://abc.com';
        const data = {
          resource,
          request: resource,
          loaders: [1, 2],
        };
        afterResolve(data, () => {});

        expect(data.loaders.pop()).eql({ loader: loaderPath, options });
        expect(data.request).equal(`${loaderPath}!${resource}`);
        __RewireAPI__.__ResetDependency__();
      });
      it('download, otherLoader exists', () => {
        __RewireAPI__.__set__({
          checkProtocol() {
            return true;
          },
        });
        const otherLoader = 'afsaf.com!';
        const resource = 'http://abc.com';
        const data = {
          resource,
          request: otherLoader + resource,
          loaders: [],
        };
        afterResolve(data, () => {});

        expect(data.request).equal(`${otherLoader + loaderPath}!${resource}`);
        __RewireAPI__.__ResetDependency__();
      });
    });

    describe('after-resolvers', () => {
      let key;
      let parsedResolve;
      function plugin3(_key, _parsedResolve) {
        key = _key;
        parsedResolve = _parsedResolve;
      }
      const compilerInst = {
        resolvers: {
          normal: {
            plugin: plugin3,
          },
        },
      };
      const normalInst = {
        doResolve: sinon.spy(),
      };
      callbackMap['after-resolvers'].call(compilerInst);

      it('install plugin', () => {
        expect(key).equal('before-described-resolve');
        expect(typeof parsedResolve).equal('function');
      });
      it('before-described-resolve executes correctly', () => {
        __RewireAPI__.__set__('checkProtocol', sinon.spy());
        const checkProtocol = __RewireAPI__.__get__('checkProtocol');
        const request = { request: {} };
        const callback3 = sinon.spy();
        parsedResolve.call(normalInst, request, callback3);

        sinon.assert.calledOnce(callback3);
        sinon.assert.calledWithExactly(checkProtocol, request.request);
        __RewireAPI__.__ResetDependency__();
      });
      it('parse download correctly', () => {
        __RewireAPI__.__set__('checkProtocol', () => true);
        const requestPath = 'aaaaaaaaaaa';
        const request = { request: requestPath };
        const callback4 = function () {};
        parsedResolve.call(normalInst, request, callback4);

        expect(request).eql({ module: false, path: requestPath, request: undefined });
        sinon.assert.calledWithExactly(
          normalInst.doResolve,
          'resolved',
          request,
          `download: url is resolved - ${request.path}`,
          callback4,
        );
        __RewireAPI__.__ResetDependency__();
      });
    });
  });
});
