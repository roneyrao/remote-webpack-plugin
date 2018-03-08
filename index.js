var path = require('path');

function combineHttpAuth(map) {
  // auth = user:password
  var domains = Object.getOwnPropertyNames(map);
  for (var i = 0, len = domains.length; i < len; i++) {
    var item = map[domains[i]];
    if (item.user) {
      item.auth = item.user;
      delete item.user;
      if (item.password) {
        item.auth += ':' + item.password;
        delete item.password;
      }
    }
  }
}

var regexProtocols = /^(http|ftp)s?:\/\/.+/;

function checkProtocol(request) {
  return regexProtocols.test(request);
}

function DownloadWebpackPlugin(options) {
  this.options = options;
  if (options && options.http) {
    combineHttpAuth(options.http);
  }
}

DownloadWebpackPlugin.prototype.apply = function WebpackPluginRemoteApply(compiler) {
  var options = this.options;

  compiler.plugin('before-compile', function beforeCompile(params, callback) {
    params.normalModuleFactory.plugin('after-resolve', function afterResolve(data, callback2) {
      if (checkProtocol(data.resource)) {
        // append loader
        var loaderPath = path.join(__dirname, '/loader.js');
        data.loaders.push({ loader: loaderPath, options: options });
        data.request =
          data.request.substr(0, data.request.lastIndexOf('!') + 1) +
          loaderPath +
          '!' +
          data.resource;
      }
      callback2(null, data);
    });
    callback();
  });

  // resolving
  compiler.plugin('after-resolvers', function afterResolvers() {
    // bypass other plugins after `DescriptionFilePlugin`
    this.resolvers.normal.plugin('before-described-resolve', function parsedResolve(
      request,
      callback
    ) {
      if (checkProtocol(request.request)) {
        // turn off 'module' flag
        request.module = false;
        // store url in 'path' (later passed in to loader) and empty 'request'
        request.path = request.request;
        request.request = undefined;

        this.doResolve(
          'resolved',
          request,
          'download: url is resolved - ' + request.path,
          callback
        );
      } else {
        callback();
      }
    });
  });
};

module.exports = DownloadWebpackPlugin;
