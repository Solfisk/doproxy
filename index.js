'use strict';

const config = require('config'),
      https = require('https'),
      proxy = require('http-proxy').createProxyServer({}),
      DigitalOcean = require('do-wrapper'),
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
      const name = tokenMap[fromToken];
      const toToken = (config.get('tokens')[tokenMap[fromToken]] || {}).to;

      if(!toToken) {
        res.statusCode = 403;
        res.statusMessage = 'Unrecognized authorization';
        res.end();
        return;
      }
      
      req.pipe(writable);
      
      req.on('end', () => {
        const requestObject = JSON.parse(writable.getContents());
    
        function validate(req, obj, cb) {
          const pathname = require('url').parse(req.url).pathname,
                match = pathname.match(/\/droplets(\/(.+$))?/),
                dropletId = (match || [])[1];
          if(!match) {
            cb(null, obj);
            return;
          }
          console.log(req.method + ' ' + req.url + ' ' + toToken);
          if(obj && obj.name !== name) {
            cb('Name must be ' + name);
            return;
          }
          const api = new DigitalOcean(toToken);
          api.dropletsGetAll('*', (err, res, body) => {
            if(err) {
              cb(err);
              return;
            }
            for(let droplet of body.droplets) {
              console.log(droplet.id + ': ' + droplet.name);
              if(obj && obj.name === droplet.name) {
                cb('Droplet with name ' + name + ' already exists');
                return;
              }
              if(dropletId && dropletId === droplet.id && droplet.name !== name) {
                cb('The droplet ' + droplet.id + ' is protected');
                return;
              }
            }
            if(req.method === 'POST') {
              api.sizesGetAll('*', (err, res, body) => {
                console.log('Available sizes: ');
                for(let size of body.sizes) {
                  console.log(size.slug + ': ' + size.price_monthly);
                  if(obj.size === size.slug) {
                    if(size.price_monthly <= 20) {
                      cb(null, obj);
                      return;
                    } else {
                      cb('Pricing of size ' + obj.size + ' is above $20');
                      return;
                    }
                  }
                }
                cb('Unidentified size: ' + obj.size);
                return;
              });
            } else {
              console.log('Accepting PUT');
              cb(null, obj);
            }
          });
        }
        
        validate(req, requestObject, (err, newRequest) => {
          if(!err) {
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
                authorization: 'Bearer ' + toToken,
                host: digitalOceanApiAddress
              }
            });
          } else {
            res.statusCode = 403;
            res.statusMessage = err;
            res.end();
          }
        });
      });
    }
  );
  return server;
};
