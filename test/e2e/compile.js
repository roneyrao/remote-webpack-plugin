import path from 'path';
import webpack from 'webpack';
import DownloadPlugin from '../../src/index';

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

  return new Promise((resolve, reject) => {
    compiler.run((err, stats) => {
      if (err) {
        reject(err);
      } else {
        resolve(compiler, stats);
      }
    });
  });
}
