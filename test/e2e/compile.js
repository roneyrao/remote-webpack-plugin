import path from 'path';
import webpack from 'webpack';
import Memoryfs from 'memory-fs';
import DownloadPlugin from '../../src/index';
import pify from 'pify';

const proto = webpack.Compiler.prototype;
proto.run = pify(proto.run);

export default function (fixture, options) {
  const compiler = webpack({
    context: __dirname,
    entry: fixture,
    output: {
      path: path.resolve(__dirname, 'out'),
      filename: 'bundle.js',
    },
    module: {
      rules: [
        {
          test: /\.gif$/,
          loader: 'file-loader',
        },
      ],
    },
    plugins: [new DownloadPlugin(options)],
  });

  // compiler.outputFileSystem = new Memoryfs();
  // compiler.outputFileSystem.mkdirp(process.cwd(), (err) => {
  //   if (err) throw err;
  //   compiler.run(callback);
  // });
  return compiler;
}
