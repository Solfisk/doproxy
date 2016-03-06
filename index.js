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
      const fromToken = ((req.headers.authorization || '').match(/Bearer (.+)/) || [])[1];
      const toToken = tokenMap[fromToken];

      if(!toToken) {
        res.statusCode = 403;
        res.statusMessage = 'Unrecognized authorization';
        res.end();
        return;
      }
      
      req.pipe(writable);
      
      req.on('end', () => {
        console.log('end:');
        const requestObject = JSON.parse(writable.getContents());
    
        function validate(obj) {
          return obj;
        }
        
        try {
          let newRequest = validate(requestObject);
          
          console.log(newRequest);
          const readable = new buffers.ReadableStreamBuffer();

          for(let method of ['on', 'read', 'pipe', 'isPaused', 'pause', 'resume', 'setEncoding', 'unpipe', 'unshift', 'wrap']) {
            req[method] = readable[method] ? readable[method].bind(readable) : undefined;
          }

          const newRequestBuffer = new Buffer(JSON.stringify(newRequest));
          
          readable.put(newRequestBuffer);
          readable.stop();

          proxy.web(req, res, {
            target: 'https://' + digitalOceanApiAddress,
            agent: https.globalAgent,
            headers: {
              'content-length': newRequestBuffer.length,
              host: digitalOceanApiAddress
            }
          });
          
        } catch(e) {
          res.statusCode = 403;
          res.statusMessage = e.toString();
          console.log(e.toString());
          res.end();
        }

      });
    }
  );
  return server;
};
