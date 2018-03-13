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
  const options = compiler.options.output;
  const outFile = path.join(options.path, options.filename);
  // eslint-disable-next-line no-eval
  let imageFile = eval(fs.readFileSync(outFile).toString());

  expect(typeof imageFile).equal('string');
  expect(imageFile.endsWith('.gif')).ok;

  imageFile = path.join(options.path, imageFile);
  expect(fs.readFileSync(imageFile).length).equal(imageSize);
  return fs.remove(options.path);
}
function checkCacheExist(cacheDir) {
  return fs.stat(cacheDir)
    .then(() => fs.readdir(cacheDir))
    .then((files) => {
      expect(files).ok;
      expect(files.length).equal(2);
      return fs.remove(cacheDir);
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
      compile(entry)
        .then(compiler => checkImage(compiler))
        .then(() => checkCacheExist(defaultCacheDir))
        .then(done, done);
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
              compile(entry, compilerOpts)
                .then(compiler => checkImage(compiler))
                .then(() => {
                  sinon.assert.calledWith(logger.info, 'POST', '/dir1/dir2/image.gif');
                  return checkCacheExist(cacheDir);
                })
                .then(done, done);
            },
          );
        }, done);
    });
    it('offline', function (done) {
      const { server } = this;
      compile(entry)
        .then(compiler => checkImage(compiler))
        .then(() => fs.stat(defaultCacheDir))
        .then(() => fs.readdir(defaultCacheDir))
        .then((files) => {
          expect(files).ok;
          expect(files.length).equal(2);

          server.stop();

          http.get('http://localhost:3000/')
            .on('error', (err2) => {
              expect(err2).ok;
              expect(err2.code).equal('ECONNREFUSED');

              compile(entry)
                .then(compiler2 => checkImage(compiler2))
                .then(() => fs.remove(defaultCacheDir))
                .then(done, done);
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
    compile(entry, compilerOpts)
      .then(compiler => checkImage(compiler), done)
      .then(() => checkCacheExist(defaultCacheDir))
      .then(done, done);
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
            compile(entry, compilerOptsNew)
              .then(compiler => checkImage(compiler), done)
              .then(() => checkCacheExist(cacheDir))
              .then(done, done);
          },
        );
      }, done);
  });
  it('offline', function (done) {
    compile(entry, compilerOpts)
      .then(compiler => checkImage(compiler), done)
      .then(() => fs.stat(defaultCacheDir))
      .then(() => fs.readdir(defaultCacheDir))
      .then((files) => {
        expect(files).ok;
        expect(files.length).equal(2);

        this.ftpServer.close();
        delete this.ftpServer;

        new Ftp()
          .on('error', (err) => {
            expect(err).ok;
            expect(err.code).equal('ECONNREFUSED');

            compile(entry, compilerOpts)
              .then(compiler2 => checkImage(compiler2), done)
              .then(() => fs.remove(defaultCacheDir))
              .then(done, done);
          })
          .connect(Object.assign(
            {
              host: 'localhost',
              port: '5000',
            },
            auth,
          ));
      });
  });
});
