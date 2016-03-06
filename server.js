#!/usr/bin/env node
'use strict';

const Proxy = require('./index.js');
const proxy = Proxy('');
proxy.listen(80);
