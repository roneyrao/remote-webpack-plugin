import url from 'url';
import fs from 'fs';
import http from 'http';
import https from 'https';
import Ftp from 'ftp';
import Keyv from 'keyv';
import KeyvFs from 'keyv-fs';
import CachePolicy from 'http-cache-semantics';
import CacheableRequest from 'cacheable-request-adaptable';

class NewCachePolicy extends CachePolicy {
  storable() { // eslint-disable-line class-methods-use-this
    return true;
  }
}

function handleStreamError(ctx, error, callback) {
  if (ctx.cache) {
    ctx.cache.get(ctx.cacheKey)
      .then(
        response => callback(null, response.body || response),
        callback,
      );
  } else {
    callback(error || new Error(`Fail to dowload: ${ctx.href} - ${ctx.statusCode}`));
  }
}

function handleStream(stream, toSave, callback) {
  const bufferList = [];
  stream.on('data', (d) => {
    bufferList.push(d);
  });
  stream.on('end', () => {
    const data = Buffer.concat(bufferList);
    if (toSave && stream.cache) {
      stream.cache.set(stream.cacheKey, { body: data });
    }
    callback(null, data);
  });
  stream.on('aborted', (err) => {
    handleStreamError(stream, err, callback);
  });
  stream.on('error', (err) => {
    handleStreamError(stream, err, callback);
  });
}

function loadHttp(config, callback, store) {
  let cacheableRequest;
  let request;
  if (store) {
    cacheableRequest = new CacheableRequest(
      config.protocol === 'https:' ? https.request : http.request,
      {
        cacheAdapter: store,
        policyConstructor: NewCachePolicy,
        namespace: store.namespace,
      },
    );
    request = cacheableRequest.createRequest();
  } else {
    const _http = config.protocol === 'https:' ? https : http;
    ({ request } = _http);
  }

  config.cache = cacheableRequest.cache;
  let cacheKey;
  const incomeMsg = request(config, (stream) => {
    if (stream.statusCode === 200) {
      stream.cache = cacheableRequest.cache;
      stream.cacheKey = cacheKey;
      stream.href = config.href;
      handleStream(stream, false, callback);
    } else {
      handleStreamError(config, null, callback);
    }
  });
  incomeMsg.on('cacheKey', (key) => {
    cacheKey = key;
  });
  incomeMsg.on('request', (req) => {
    req.end();
  });
  incomeMsg.on('error', (err) => {
    config.cache = cacheableRequest.cache; // take config as forged stream.
    config.cacheKey = cacheKey;
    handleStreamError(config, err, callback);
  });
}

function loadFtp(config, callback, store) {
  function getCtx() {
    return {
      cacheKey: config.href,
      href: config.href,
      cache: store,
    };
  }
  function handleError(err) {
    handleStreamError(
      getCtx(),
      err,
      callback,
    );
  }
  function getCallback(err, stream) {
    if (err) {
      handleError(err);
    } else {
      Object.assign(stream, getCtx());
      handleStream(stream, true, callback);
    }
  }
  const ftp = new Ftp();
  ftp
    .on('ready', () => {
      ftp.get(config.path, getCallback);
    })
    .on('error', (err) => {
      handleError(err);
    });

  config.host = config.hostname;
  ftp.connect(config);
}

function findConfig(config, _url) {
  const props = Object.getOwnPropertyNames(config);
  for (let i = 0, len = props.length; i < len; i++) {
    if (new RegExp(props[i]).test(_url)) {
      return config[props[i]];
    }
  }
  return undefined;
}

function pitch(request) {
  const options = this.query || {};
  const callback = this.async();
  const parsedUrl = url.parse(request);

  let load;
  let config;
  if (parsedUrl.protocol) {
    if (parsedUrl.protocol.startsWith('http')) {
      config = options.http && findConfig(options.http, request);
      load = loadHttp;
    } else if (parsedUrl.protocol.startsWith('ftp')) {
      config = options.ftp && findConfig(options.ftp, request);
      load = loadFtp;
    }
  }
  if (!load) {
    callback(new Error(`download: the protocol is not supported - ${request}`));
    return;
  }
  if (config) {
    config = Object.assign({}, config);
    config = Object.assign(config, parsedUrl);
  } else {
    config = parsedUrl;
  }
  let allowCache = config.cache;
  if (allowCache === undefined) {
    allowCache = options.cacheDir;
  }
  if (allowCache === undefined) {
    allowCache = true;
  }

  let store;
  if (allowCache) {
    let _fs = this._compiler.inputFileSystem;
    if (!_fs.readFile || !_fs.writeFile) { // no complete APIs, we assume its local file system.
      _fs = fs;
    }
    store = new KeyvFs(_fs);
    const namespace = typeof options.cacheDir === 'string' ? options.cacheDir : '__download_cache__';
    if (load === loadFtp) {
      store = new Keyv({
        store,
        namespace,
      });
    } else {
      store.namespace = namespace;
    }
  }

  load(config, callback, store);
}
// eslint-disable-next-line
export { pitch };
