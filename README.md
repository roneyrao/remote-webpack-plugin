## Features

  * HTTP, HTTPS, FTP protocols
  * Cache and offline use, if file in server has not updated yet (http/https only), or server is inaccessable, cache is picked.


## 
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
