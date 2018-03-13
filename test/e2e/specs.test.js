import path from 'path';
import fs from 'fs-extra';
import http from 'http';

import sinon from 'sinon';
import { expect } from 'chai';

import Fms from 'flex-mock-server';
import Ftp from 'ftp';
import FtpSrv from 'ftp-srv';

import compile from './compile';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
process.chdir(__dirname);

const serverOpts = {
  cwd: __dirname,
  map: {
    '/.+/image\\.gif': '/image.gif',
  },
};

const imageSize = fs.statSync(path.join(__dirname, 'image.gif')).size;
const defaultCacheDir = '__download_cache__';
function checkImage(compiler) {
  const _fs = compiler.outputFileSystem.readFileSync ? compiler.outputFileSystem : fs;
  const options = compiler.options.output;
  const outFile = path.join(options.path, options.filename);
  // eslint-disable-next-line no-eval
  let imageFile = eval(_fs.readFileSync(outFile).toString());

  expect(typeof imageFile).equal('string');
  expect(imageFile.endsWith('.gif')).ok;

  imageFile = path.join(options.path, imageFile);
  expect(_fs.readFileSync(imageFile).length).equal(imageSize);
}
function checkCacheExist(cacheDir) {
  return fs.stat(cacheDir)
    .then(() => fs.readdir(cacheDir))
    .then((files) => {
      expect(files).ok;
      expect(files.length).equal(2);
    });
}
function createHttpSuite(serverOptsOther, entry) {
  const mixedServerOpts = Object.assign({}, serverOpts, serverOptsOther);
  function HttpSuite() {
    this.timeout(5000);
    beforeEach(function () {
      this.server = new Fms(mixedServerOpts);
      this.server.start();
    });
    afterEach(function () {
      this.server.stop();
    });

    it('compile', (done) => {
      const compiler = compile(entry);
      compiler.run()
        .then(() => {
          checkImage(compiler);
          checkCacheExist(defaultCacheDir).then(done, done);
        }, done);
    });
    it('config', function (done) {
      const { logger } = this.server;
      sinon.spy(logger, 'info');
      const cacheDir = 'cacheFolder';
      const compilerOpts = {
        cacheDir,
        http: {
          'localhost:3000': {
            method: 'post',
          },
        },
      };
      fs.stat(cacheDir)
        .then(() => fs.remove(cacheDir), () => {})
        .then(() => {
          fs.stat(cacheDir).then(
            () => {
              done(new Error(`directory can not be removed - ${cacheDir}`));
            },
            () => {
              const compiler = compile(entry, compilerOpts);
              compiler.run().then(() => {
                checkImage(compiler);
                sinon.assert.calledWith(logger.info, 'POST', '/dir1/dir2/image.gif');
                checkCacheExist(cacheDir).then(done, done);
              }, done);
            },
          );
        }, done);
    });
    it('offline', function (done) {
      const { server } = this;
      const compiler = compile(entry);
      compiler.run().then(() => {
        checkImage(compiler);

        fs.stat(defaultCacheDir)
          .then(() => fs.readdir(defaultCacheDir), done)
          .then((files) => {
            expect(files).ok;
            expect(files.length).equal(2);

            server.stop();

            http.get('http://localhost:3000/')
              .on('error', (err2) => {
                expect(err2).ok;
                expect(err2.code).equal('ECONNREFUSED');

                const compiler2 = compile(entry);
                compiler2.run().then(() => {
                  checkImage(compiler2);
                  done();
                }, done);
              });
          });
      }, done);
    });
  }
  return HttpSuite;
}

beforeEach((done) => {
  fs
    .stat(defaultCacheDir)
    .then(() => fs.remove(defaultCacheDir), () => {})
    .then(done, done);
});

describe('http', createHttpSuite(null, './http.js'));
describe('https', createHttpSuite({ https: true }, './https.js'));

describe('ftp', function () {
  const entry = './ftp.js';
  const auth = {
    user: 'user1',
    password: 'password1',
  };
  const compilerOpts = {
    ftp: {
      'localhost:5000': auth,
    },
  };
  this.timeout(5000);
  before(function (done) {
    this.ftpServer = new FtpSrv('ftp://127.0.0.1:5000');
    this.ftpServer.on('login', (data, resolve, reject) => {
      if (data.username === auth.user && data.password === auth.password) {
        resolve({ root: __dirname });
      } else {
        reject(new Error('invalid auth'));
      }
    });
    this.ftpServer.listen().then(() => {
      done();
    }, done);
  });
  after(function () {
    this.ftpServer && this.ftpServer.close();
  });
  it('compile', (done) => {
    const compiler = compile(entry, compilerOpts);
    compiler.run().then(() => {
      checkImage(compiler);
      checkCacheExist(defaultCacheDir).then(done, done);
    }, done);
  });
  it('config', (done) => {
    const cacheDir = 'cacheFolder';
    const compilerOptsNew = Object.assign({}, compilerOpts, {
      cacheDir,
    });
    fs.stat(cacheDir)
      .then(() => fs.remove(cacheDir), () => {})
      .then(() => {
        fs.stat(cacheDir).then(
          () => {
            done(new Error(`directory can not be removed - ${cacheDir}`));
          },
          () => {
            const compiler = compile(entry, compilerOptsNew);
            compiler.run().then(() => {
              checkImage(compiler);
              checkCacheExist(cacheDir).then(done, done);
            }, done);
          },
        );
      }, done);
  });
  it('offline', function (done) {
    const compiler = compile(entry, compilerOpts);
    compiler.run().then(() => {
      checkImage(compiler);

      fs.stat(defaultCacheDir).then(() => {
        fs.readdir(defaultCacheDir).then((files) => {
          expect(files).ok;
          expect(files.length).equal(2);

          this.ftpServer.close();
          delete this.ftpServer;

          new Ftp()
            .on('error', (err) => {
              expect(err).ok;
              expect(err.code).equal('ECONNREFUSED');

              const compiler2 = compile(entry, compilerOpts);
              compiler2.run().then(() => {
                checkImage(compiler2);
                done();
              }, done);
            })
            .connect(Object.assign(
              {
                host: 'localhost',
                port: '5000',
              },
              auth,
            ));
        });
      }, done);
    }, done);
  });
});
