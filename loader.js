var url = require('url');
var http = require('http');
var https = require('https');
var Ftp = require('ftp');
var KeyvFs = require('keyv-fs');
var CachePolicy = require('http-cache-semantics');
var CacheableRequest = require('cacheable-request');

function NewCachePolicy() {
  CachePolicy.apply(this, arguments);
}
NewCachePolicy.prototype = Object.assgin({}, CachePolicy.prototype, {
  storable: function storable() {
    return true;
  }
});

function handleResponseError(response, error, callback) {
  if (response.store) {
    callback(null, response.store.get(response.method + ':' + response.url));
  } else {
    callback(error || new Error('Fail to dowload: ' + response.url + ' - ' + response.statusCode));
  }
}

function handleResp(response, callback) {
  if (response.statusCode === 200) {
    var bufferList = [];
    response.on('data', function onData(d) {
      bufferList.push(d);
    });
    response.on('end', function onEnd() {
      callback(null, Buffer.concat(bufferList));
    });
    response.on('aborted', function onAborted(err) {
      handleResponseError(response, err, callback);
    });
    response.on('error', function onError(err) {
      handleResponseError(response, err, callback);
    });
  } else {
    handleResponseError(response, null, callback);
  }
}

function loadHttp(config, callback, store, cacheDir) {
  var request;
  if (store) {
    var cacheableRequest = new CacheableRequest(
      config.protocol === 'https:' ? https.request : http.request,
      store,
      NewCachePolicy
    );
    cacheableRequest.cache.namespace = cacheDir || '__download_cache__';
    request = cacheableRequest.createRequest();
  } else {
    var _http = config.protocol === 'https:' ? https : http;
    request = _http.request;
  }

  var incomeMsg = request(config, function onResp(response) {
    response.store = store;
    handleResp(response, callback);
  });
  incomeMsg.on('request', function onRequest(req) {
    req.end();
  });
  incomeMsg.on('error', function onRequest(err) {
    callback(err);
  });
}

function loadFtp(config, callback, store, cacheDir) {
  function handleError(err) {
    handleResponseError(
      {
        method: 'ftp', url: config.path, store: store
      },
      err,
      callback
    );
  }
  var ftp = new Ftp();
  ftp
    .on('ready', function onReady() {
      this.get(config.path, function getCallback(err, response) {
        if (err) {
          handleError(err);
        } else {
          response.store = store;
          response.cacheDir = cacheDir;
          handleResp(response, callback);
        }
      });
    })
    .on('error', function onError(err) {
      handleError(err);
    });

  config.host = config.hostname;
  ftp.connect(config);
}

function findConfig(config, _url) {
  var props = Object.getOwnPropertyNames(config);
  for (var i = 0, len = props.length; i < len; i++) {
    if (new RegExp(props[i]).test(_url)) {
      return config[props[i]];
    }
  }
  return undefined;
}

function pitch(request) {
  var options = this.query || {};
  var callback = this.async();
  var parsedUrl = url.parse(request);

  var load;
  var config;
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
    callback(new Error('download: the protocol is not supported - ' + request));
    return;
  }
  if (config) {
    config = Object.assign({}, config);
    config = Object.assign(config, parsedUrl);
  } else {
    config = parsedUrl;
  }
  var allowCache = config.cache;
  if (allowCache === undefined) {
    allowCache = options.cacheDir;
  }
  if (allowCache === undefined) {
    allowCache = true;
  }

  var store;
  if (allowCache) {
    store = new KeyvFs();
  }

  load(config, callback, store, options.cacheDir);
}
module.exports.pitch = pitch;
