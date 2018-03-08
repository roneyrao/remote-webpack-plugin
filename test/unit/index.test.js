var sinon = require('sinon');
var expect = require('chai').expect;
var copy = require('deepcopy');
var rewire = require('rewire');

var mod = rewire('../../index');

describe('index.js', function () {
  describe('combineHttpAuth', function () {
    var combineHttpAuth = mod.__get__('combineHttpAuth');

    function check(map, map2) {
      combineHttpAuth(map);
      expect(map).eql(map2);
    }

    it('no user and password', function () {
      var map = {
        'abc.com': {
          method: 'post'
        }
      };
      var map2 = copy(map);

      check(map, map2);
    });

    it('only user', function () {
      var map = {
        'abc.com': {
          method: 'post',
          user: 'user'
        }
      };
      var map2 = {
        'abc.com': {
          method: 'post',
          auth: 'user'
        }
      };
      check(map, map2);
    });

    it('user and password', function () {
      var map = {
        'abc.com': {
          method: 'post',
          user: 'user',
          password: 'password'
        }
      };
      var map2 = {
        'abc.com': {
          method: 'post',
          auth: 'user:password'
        }
      };
      check(map, map2);
    });
  });

  describe('checkProtocol', function () {
    var checkProtocol = mod.__get__('checkProtocol');

    it('abdef', function () {
      expect(checkProtocol('abdef')).not.to.be.ok;
    });

    it('http', function () {
      expect(checkProtocol('http://abc')).to.be.ok;
    });

    it('https', function () {
      expect(checkProtocol('https://abc')).to.be.ok;
    });

    it('ftp', function () {
      expect(checkProtocol('ftp://abc')).to.be.ok;
    });

    it('ftps', function () {
      expect(checkProtocol('ftps://abc')).to.be.ok;
    });
  });

  describe('DownloadWebpackPlugin', function () {
    var DownloadWebpackPlugin = mod.__get__('DownloadWebpackPlugin');

    it('no options', function () {
      var restore = mod.__set__('combineHttpAuth', sinon.spy());
      new DownloadWebpackPlugin(); // eslint-disable-line no-new
      sinon.assert.notCalled(mod.__get__('combineHttpAuth'));

      restore();
    });
    it('stores options', function () {
      var restore = mod.__set__('combineHttpAuth', sinon.spy());
      var options = {
        http: {}
      };
      var inst = new DownloadWebpackPlugin(options);
      expect(inst.options).equal(options);
      sinon.assert.calledWithExactly(mod.__get__('combineHttpAuth'), options.http);

      restore();
    });
  });

  describe('DownloadWebpackPlugin.prototype.apply', function () {
    var options = {};
    var callbackMap = {};
    function plugin(key, callback) {
      callbackMap[key] = callback;
    }
    var compiler = { plugin: plugin };
    var DownloadWebpackPlugin = mod.__get__('DownloadWebpackPlugin');
    var inst = new DownloadWebpackPlugin(options);
    inst.apply(compiler);

    describe('before-compile', function () {
      var key;
      var afterResolve;
      function plugin2(_key, _afterResolve) {
        key = _key;
        afterResolve = _afterResolve;
      }
      var params = {
        normalModuleFactory: {
          plugin: plugin2
        }
      };
      var callback = sinon.spy();
      callbackMap['before-compile'](params, callback);

      it('install plugin and exec callback', function () {
        expect(key).equal('after-resolve');
        expect(typeof afterResolve).equal('function');
        sinon.assert.calledOnce(callback);
      });
      it('after-resolve executes correctly', function () {
        var restore = mod.__set__('checkProtocol', sinon.spy());
        var checkProtocol = mod.__get__('checkProtocol');
        var data = { resource: {} };
        var callback2 = sinon.spy();
        afterResolve(data, callback2);

        sinon.assert.calledWithExactly(callback2, null, data);
        sinon.assert.calledWithExactly(checkProtocol, data.resource);
        restore();
      });
      it('download, no otherLoader', function () {
        var dirname = 'dirnameaaa';
        var restore = mod.__set__({
          checkProtocol: function () {
            return true;
          },
          __dirname: dirname
        });
        var resource = 'http://abc.com';
        var loaderPath = dirname + '/loader.js';
        var data = {
          resource: resource,
          request: resource,
          loaders: [1, 2]
        };
        afterResolve(data, function () {});

        expect(data.loaders.pop()).eql({ loader: loaderPath, options: options });
        expect(data.request).equal(loaderPath + '!' + resource);
        restore();
      });
      it('download, otherLoader exists', function () {
        var dirname = 'dirnameaaa';
        var restore = mod.__set__({
          checkProtocol: function () {
            return true;
          },
          __dirname: dirname
        });
        var otherLoader = 'afsaf.com!';
        var resource = 'http://abc.com';
        var loaderPath = dirname + '/loader.js';
        var data = {
          resource: resource,
          request: otherLoader + resource,
          loaders: []
        };
        afterResolve(data, function () {});

        expect(data.request).equal(otherLoader + loaderPath + '!' + resource);
        restore();
      });
    });

    describe('after-resolvers', function () {
      var key;
      var parsedResolve;
      function plugin3(_key, _parsedResolve) {
        key = _key;
        parsedResolve = _parsedResolve;
      }
      var compilerInst = {
        resolvers: {
          normal: {
            plugin: plugin3
          }
        }
      };
      var normalInst = {
        doResolve: sinon.spy()
      };
      callbackMap['after-resolvers'].call(compilerInst);

      it('install plugin', function () {
        expect(key).equal('before-described-resolve');
        expect(typeof parsedResolve).equal('function');
      });
      it('before-described-resolve executes correctly', function () {
        var restore = mod.__set__('checkProtocol', sinon.spy());
        var checkProtocol = mod.__get__('checkProtocol');
        var request = { request: {} };
        var callback3 = sinon.spy();
        parsedResolve.call(normalInst, request, callback3);

        sinon.assert.calledOnce(callback3);
        sinon.assert.calledWithExactly(checkProtocol, request.request);
        restore();
      });
      it('parse download correctly', function () {
        var restore = mod.__set__('checkProtocol', function () {
          return true;
        });
        var requestPath = 'aaaaaaaaaaa';
        var request = { request: requestPath };
        var callback4 = function () {};
        parsedResolve.call(normalInst, request, callback4);

        expect(request).eql({ module: false, path: requestPath, request: undefined });
        sinon.assert.calledWithExactly(
          normalInst.doResolve,
          'resolved',
          request,
          'download: url is resolved - ' + request.path,
          callback4
        );
        restore();
      });
    });
  });
});
