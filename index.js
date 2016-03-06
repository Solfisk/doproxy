'use strict';

const JSONStream = require('JSONStream'),
      config = require('config'),
      https = require('https'),
      proxy = require('http-proxy').createProxyServer({}),
      digitalOceanApiAddress = 'api.digitalocean.com';

module.exports = () => {
  const tokens = config.get('tokens'),
        tokenMap = {};
  if(tokens) {
    for(let name in tokens) {
      tokenMap[tokens[name].from] = name;
    }    
  }
  const server = require('http').createServer(
    (req, res) => {
      let data = '',
          encoding;
      const buffers = require('stream-buffers');
      const writable = new buffers.WritableStreamBuffer();

      req.pipe(writable);
      
      req.on('end', () => {
        console.log('end:');
//        console.log(writable.getContentsAsString('utf-8'));
        let buffer = writable.getContents();
        console.log(buffer);
        console.log(buffer.toString());
        
        const readable = new buffers.ReadableStreamBuffer();

        for(let method of ['on', 'read', 'pipe', 'isPaused', 'pause', 'resume', 'setEncoding', 'unpipe', 'unshift', 'wrap']) {
          req[method] = readable[method] ? readable[method].bind(readable) : undefined;
        }

        readable.put(buffer);
        readable.stop();

        proxy.web(req, res, {
          target: 'https://' + digitalOceanApiAddress,
          agent: https.globalAgent,
          headers: {
            'content-length': buffer.length,
            host: digitalOceanApiAddress
          }
        });

      });
    }
  );
  return server;
};
