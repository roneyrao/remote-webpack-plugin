# webpack-plugin-download

[![NPM Version](http://img.shields.io/npm/v/download-webpack-plugin.svg?style=flat)](https://www.npmjs.org/package/download-webpack-plugin)
[![Build Status](https://travis-ci.org/roneyrao/download-webpack-plugin.svg?branch=master)](https://travis-ci.org/roneyrao/download-webpack-plugin)
[![codecov](https://codecov.io/gh/roneyrao/download-webpack-plugin/branch/master/graph/badge.svg)](https://codecov.io/gh/roneyrao/download-webpack-plugin)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](https://raw.githubusercontent.com/roneyrao/download-webpack-plugin/master/LICENSE)

A webpack plugin to fetch resource from internet, instead of local file system, to ensure the latest is bundled, e.g. to `require` an url starting with `http`/`https`/`ftp`: `require('http://abc.com/def.gh')`.

If you want to load script in browser at runtime, you may need this plugin: [webpack-require-http](https://github.com/darkty2009/webpack-require-http).

## Features

  * HTTP, HTTPS, FTP protocols
  * Cache and offline use: if file in server has not updated yet (http/https only), or server is inaccessable, cached version is picked.

## Usage 

#### webpack.config.js

```
const path = require('path');
const DownloadPlugin = require('download-webpack-plugin');

module.exports = {
  context: __dirname,
  entry: './index.js',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'index.bundle.js',
    },
    module: {
      rules: [
        {
          test: /\.png$/,
          loader: 'file-loader',
        },
        {
          test: /\.js$/,
          loader: 'babel-loader',
        },
      ],
    },
  plugins: [new DownloadPlugin(/*options*/)],
};
```


#### index.js

```
import React from 'react';
import { render } from 'react-dom';
import npmjsIcon from 'https://www.npmjs.com/static/images/touch-icons/coast-228x228.png';

render(
  <div>
    <img src={npmjsIcon} />
  </div>,
  document.getElementById('root'),
);
```


#### .babelrc

```
{
  "presets": [
    "react"
  ]
}
```


#### output

```
|- dist/
|--- c426a1116301d1fd178c51522484127a.png
|--- index.bundle.js

```

##### index.bundle.js
```
...
(function(module, exports, __webpack_require__) {
  module.exports = __webpack_require__.p + "c426a1116301d1fd178c51522484127a.png";
})
...
```


## Configuration 

```
{
  cacheDir:  - where cache is placed, `__download_cache__` by default, if `false`, cache is turned off.

  http: {   - for http/https.
    'https://abc\\.com:8080/\\.*': {  - Regexp string to of specific rule matched againast whole url.
      cache:      - {bool} turn on/off cache, overriding global config.
      method,     - {string} http method.
      user,       - {string} auth user.
      password,   - {string} auth password.
      headers,    - {string} http headers.
      agent,      - {string} custom useragent.
      timeout     - {number} request timeout duration.
    }
  },

  ftp: {  - refer to: https://www.npmjs.com/package/ftp
    'ftp://abc\\.com:8080/\\.*': {  - Regexp string to test against whole url.
      cache:        - {bool} (same as above)
      secure        - {mixed} Set to true for both control and data connection encryption, 'control' for control connection encryption only, or 'implicit' for implicitly encrypted control connection (this mode is deprecated in modern times, but usually uses port 990) Default: false,
      secureOptions - {object} Additional options to be passed to tls.connect(). Default: (none),
      user          - {string} Username for authentication. Default: 'anonymous',
      password      - {string} Password for authentication. Default: 'anonymous',
      connTimeout   - {integer} How long (in milliseconds) to wait for the control connection to be established. Default: 10000,
      pasvTimeout   - {integer} How long (in milliseconds) to wait for a PASV data connection to be established. Default: 10000,
      keepalive     - {integer} How often (in milliseconds) to send a 'dummy' (NOOP) command to keep the connection alive. Default: 10000
    }
  }
}
```
