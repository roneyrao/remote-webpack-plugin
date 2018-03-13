# download-webpack-plugin

[![NPM Version](http://img.shields.io/npm/v/download-webpack-plugin.svg?style=flat)](https://www.npmjs.org/package/download-webpack-plugin)
[![Build Status](https://travis-ci.org/roneyrao/download-webpack-plugin.svg?branch=master)](https://travis-ci.org/roneyrao/download-webpack-plugin)
[![codecov](https://codecov.io/gh/roneyrao/download-webpack-plugin/branch/master/graph/badge.svg)](https://codecov.io/gh/roneyrao/download-webpack-plugin)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](https://raw.githubusercontent.com/roneyrao/download-webpack-plugin/master/LICENSE)

A webpack plugin to fetch resource from internet, instead of local file system, to ensure the latest is bundled. e.g. to `require` an url starting with `http`/`https`/`ftp`.
If you want to load script in browser at runtime, you may need this plugin, [webpack-require-http](https://github.com/darkty2009/webpack-require-http).

## Features

  * HTTP, HTTPS, FTP protocols
  * Cache and offline use, if file in server has not updated yet (http/https only), or server is inaccessable, cached version is picked.

## Usage 


## Configuration 

  ```
{
  cacheDir: Where cache is placed, '__download_cache__' by default, if `false`, cache is turned off
  http: {
    'https://abc\\.com:8080/\\.*': { // specific rule matched againast whole url.
      cache:  // override global config
      method,
      user,
      password,
      headers,
      agent,
      timeout
    }
  },
  ftp: { // refer: https://www.npmjs.com/package/ftp
    'abc.com:8080': { // domain[:port] match what in url
      cache: bool
      secure - mixed - Set to true for both control and data connection encryption, 'control' for control connection encryption only, or 'implicit' for implicitly encrypted control connection (this mode is deprecated in modern times, but usually uses port 990) Default: false,
      secureOptions - object - Additional options to be passed to tls.connect(). Default: (none),
      user - string - Username for authentication. Default: 'anonymous',
      password - string - Password for authentication. Default: 'anonymous',
      connTimeout - integer - How long (in milliseconds) to wait for the control connection to be established. Default: 10000,
      pasvTimeout - integer - How long (in milliseconds) to wait for a PASV data connection to be established. Default: 10000,
      keepalive - integer - How often (in milliseconds) to send a 'dummy' (NOOP) command to keep the connection alive. Default: 10000
    }
  }
}
  ```
