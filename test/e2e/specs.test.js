process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

process.chdir(__dirname);

var path = require('path');
var fs = require('fs-extra');
var http = require('http');

var sinon = require('sinon');
var expect = require('chai').expect;

var Fms = require('flex-mock-server').default;
var Ftp = require('ftp');
var FtpSrv = require('ftp-srv');

var compile = require('./compile');

var serverOpts = {
  cwd: __dirname,
  map: {
    '/.+/image\\.gif': '/image.gif'
  }
};

var imageSize = fs.statSync(path.join(__dirname, 'image.gif')).size;
var defaultCacheDir = '__download_cache__';
function checkImage(compiler) {
  var _fs = compiler.outputFileSystem;
  var options = compiler.options.output;
  var outFile = path.join(options.path, options.filename);
  // eslint-disable-next-line no-eval
  var imageFile = eval(_fs.readFileSync(outFile).toString());

  expect(typeof imageFile).equal('string');
  expect(imageFile.endsWith('.gif')).ok;

  imageFile = path.join(options.path, imageFile);
  expect(_fs.readFileSync(imageFile).length).equal(imageSize);
}
function checkCacheExist(cacheDir, done) {
  fs.stat(cacheDir)
    .then(function () {
      fs.readdir(cacheDir)
        .then(function (files) {
          expect(files).ok;
          expect(files.length).equal(2);
          done();
        });
    }, done);
}
function createHttpSuite(serverOptsOther, entry) {
  var mixedServerOpts = Object.assign(serverOpts, serverOptsOther);
  function HttpSuite() {
    beforeEach(function () {
      this.server = new Fms(mixedServerOpts);
      this.server.start();
    });
    afterEach(function () {
      this.server.stop();
    });

    it('compile', function (done) {
      var compiler = compile(entry, null, function (err) {
        if (err) {
          done(err);
        } else {
          checkImage(compiler);
          checkCacheExist(defaultCacheDir, done);
        }
      });
    });
    it('config', function (done) {
      var logger = this.server.logger;
      sinon.spy(logger, 'info');
      var cacheDir = 'cacheFolder';
      var compilerOpts = {
        cacheDir: cacheDir,
        http: {
          'localhost:3000': {
            method: 'post'
          }
        }
      };
      fs.stat(cacheDir)
        .then(function () {
          return fs.remove(cacheDir);
        }, function () {})
        .then(function () {
          fs.stat(cacheDir)
            .then(function () {
              done(new Error('directory can not be removed - ' + cacheDir));
            }, function () {
              var compiler = compile(entry, compilerOpts, function (err) {
                if (err) {
                  done(err);
                } else {
                  checkImage(compiler);
                  sinon.assert.calledWith(logger.info, 'POST', '/dir1/dir2/image.gif');
                  checkCacheExist(cacheDir, done);
                }
              });
            });
        });
    });
    it('offline', function (done) {
      var server = this.server;
      var compiler = compile(entry, null, function (err) {
        if (err) {
          done(err);
        } else {
          checkImage(compiler);

          fs.stat(defaultCacheDir)
            .then(function () {
              fs.readdir(defaultCacheDir)
                .then(function (files) {
                  expect(files).ok;
                  expect(files.length).equal(2);

                  server.stop();

                  http.get('http://localhost:3000/')
                    .on('error', function (err2) {
                      expect(err2).ok;
                      expect(err2.code).equal('ECONNREFUSED');

                      compiler = compile(entry, null, function (err3) {
                        if (err3) {
                          done(err3);
                        } else {
                          checkImage(compiler);
                          done();
                        }
                      });
                    });
                });
            }, done);
        }
      });
    });
  }
  return HttpSuite;
}

xdescribe('http', createHttpSuite(null, './http.js'));
describe('https', createHttpSuite({ debug: true, https: true }, './https.js'));


describe('ftp', function () {
  var entry = './ftp.js';
  var auth = {
    user: 'user1',
    password: 'password1'
  };
  var compilerOpts = {
    ftp: {
      'localhost:5000': auth
    }
  };
  this.timeout(5000);
  before(function (done) {
    this.ftpServer = new FtpSrv('ftp://127.0.0.1:5000');
    this.ftpServer.on('login', function (data, resolve, reject) {
      if (data.username === auth.user && data.password === auth.password) {
        resolve({ root: __dirname });
      } else {
        reject(new Error('invalid auth'));
      }
    });
    this.ftpServer.listen().then(function () { done(); }, done);
  });
  after(function () {
    this.ftpServer.close();
  });
  it('compile', function (done) {
    var compiler = compile(entry, compilerOpts, function (err) {
      if (err) {
        done(err);
      } else {
        checkImage(compiler);
        checkCacheExist(defaultCacheDir, done);
      }
    });
  });
  it('config', function (done) {
    var logger = this.server.logger;
    sinon.spy(logger, 'info');
    var cacheDir = 'cacheFolder';
    var compilerOptsNew = Object.assign({}, compilerOpts, {
      cacheDir: cacheDir
    });
    fs.stat(cacheDir)
      .then(function () {
        return fs.remove(cacheDir);
      }, function () {})
      .then(function () {
        fs.stat(cacheDir)
          .then(function () {
            done(new Error('directory can not be removed - ' + cacheDir));
          }, function () {
            var compiler = compile(entry, compilerOptsNew, function (err) {
              if (err) {
                done(err);
              } else {
                checkImage(compiler);
                sinon.assert.calledWith(logger.info, 'POST', '/dir1/dir2/image.gif');
                checkCacheExist(cacheDir, done);
              }
            });
          });
      });
  });
  it('offline', function (done) {
    var server = this.server;
    var compiler = compile(entry, null, function (err) {
      if (err) {
        done(err);
      } else {
        checkImage(compiler);

        fs.stat(defaultCacheDir)
          .then(function () {
            fs.readdir(defaultCacheDir)
              .then(function (files) {
                expect(files).ok;
                expect(files.length).equal(2);

                server.close();

                new Ftp().on('ready', function onReady() {
                  this.get('image.gif', function getCallback(err2) {
                    expect(err2).ok;
                    expect(err2.code).equal('ECONNREFUSED');

                    compiler = compile(entry, null, function (err3) {
                      if (err3) {
                        done(err3);
                      } else {
                        checkImage(compiler);
                        done();
                      }
                    });
                  });
                }).on('error', function onError(err3) {
                  done(err3);
                }).connect(Object.assign({
                  host: 'localhost',
                  port: '5000'
                }, auth));
              });
          }, done);
      }
    });
  });
});
