#!/usr/bin/env node

var minimist = require('minimist')(process.argv.slice(2));
var fs = require('fs');
var http = require('http');
var mime = require('mime');
var redisWStream = require('redis-wstream');
var async = require("async");
var redis = require("redis");
var pad = require('node-string-pad');

if (minimist.verbose || minimist.v)
  process.env['DEBUG'] = 'http-recorder';
var debug = require('debug')('http-recorder');


var httpPort = minimist.port || 9615
var httpHost = minimist.host || '0.0.0.0'

var client = redis.createClient(
    minimist.rport || 6379,
    minimist.rhost || '0.0.0.0',
    (minimist.ropts && JSON.parse(minimist.ropts)) || {

    });
var getBlockKey = function () {
  var d = new Date()
  return 'k'+d.getFullYear()
    +''+pad(''+(1+d.getMonth()), 2, 'LEFT', '0')
    +''+pad(''+d.getDate(), 2, 'LEFT', '0')
    +''+pad(''+d.getHours(), 2, 'LEFT', '0')
    +''+pad(''+d.getMinutes(), 2, 'LEFT', '0')
    +''+pad(''+d.getSeconds(), 2, 'LEFT', '0')
    +''+pad(''+d.getMilliseconds(), 3, 'LEFT', '0')
    ;
};
var saveBlocks = function (blockKey, items, then) {
  if(items.length) {
    debug('saving blocks '+items.length)
    client.sadd('blockKeys', blockKey)
    items.unshift('r'+blockKey); // the key to save to
    client.send_command('lpush', items, then);
  }
}
var blockKey = getBlockKey();
var blocksToRecord = []

client.on("connect", function () {
  debug('connect')

  setTimeout(function () {

    var blockInvl = setInterval(function () {
      // save current keyspace blocks
      saveBlocks(blockKey, [].concat(blocksToRecord));
      // then get a new keyspace
      blocksToRecord  = [];
      blockKey        = getBlockKey();
    }, 100);

    var blockInvl2 = setInterval(function () {
      client.scard('blockKeys', function(err, res){
        debug('blockKey '+blockKey)
        debug('len '+res)
      })
    }, 550);

    client.on("end", function () {
      clearInterval(blockInvl)
      clearInterval(blockInvl2)
    });

  }, (60-(new Date()).getSeconds()));

});

var resFile = null;
var resMime = 'text/plain';
if (minimist.response) {
  resFile = fs.readFileSync(minimist.response)
  resMime = mime.lookup(minimist.response)
}

var recorder = function (req, res, blockKey, jobId, next) {
  blocksToRecord.push(JSON.stringify({
    "headers": req.rawHeaders || eq.headers,
    "httpVersion": req.httpVersion,
    "method": req.method,
    "url": req.url,
    "jobId": jobId,
    "blockKey": blockKey
  }));
  if (req.method.match(/post|put/i)) {
    req.pipe(redisWStream(client, 'c'+blockKey+'-'+jobId))
      .on('error', function (err) {console.error(err)})
      .on('end', next);
  } else {
    next();
  }
};

if (minimist.recorder) {
  recorder = require(minimist.recorder);
}

var responder = function (req, res, blockKey, jobId, next) {
  res.writeHead(200, {
    'Content-Type': resMime,
    'Connection': 'close',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Cache-Length': resFile && resFile.length || 0,
    'Pragma': 'no-cache',
    'Expires': '0',
    'X-FYI': (blockKey + ' ' + jobId)
  });
  resFile && res.write(resFile);
  next()
};
if (minimist.responder) {
  responder = require(minimist.responder);
}

client.on("connect", function () {

  http.createServer(function (req, res) {
    var tout = setTimeout(function () {res.end();}, 30*1000)
    var jobId = pad(''+blocksToRecord.length, 10, 'LEFT', '0');
    async.parallel([
      function (next) {responder(req, res, blockKey, jobId, next)},
      function (next) {recorder(req, res, blockKey, jobId, next)}
    ], function(){
      res.end()
      clearTimeout(tout);
    });
  }).listen(httpPort, httpHost);

  console.log('server started http://%s:%s', httpHost, httpPort)

  process.on('exit', function () {
    client.end();
    http.close()
  })

});