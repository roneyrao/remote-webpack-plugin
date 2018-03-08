var path = require('path');
var webpack = require('webpack');
var Memoryfs = require('memory-fs');
var DownloadPlugin = require('../../index');

module.exports = function (fixture, options, callback) {
  var compiler = webpack({
    context: __dirname,
    entry: fixture,
    output: {
      path: path.resolve(__dirname, 'out'),
      filename: 'bundle.js'
    },
    module: {
      rules: [
        {
          test: /\.gif$/,
          loader: 'file-loader'
        }
      ]
    },
    plugins: [
      new DownloadPlugin(options)
    ]
  });

  compiler.outputFileSystem = new Memoryfs();
  compiler.run(callback);
  return compiler;
};
