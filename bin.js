#!/usr/bin/env node

var minimist = require('minimist')(process.argv.slice(2));
var fs = require('fs');
var http = require('http');
var mime = require('mime');

if (minimist.verbose || minimist.v)
  process.env['DEBUG'] = 'http-recorder';
var debug = require('debug')('http-recorder');


var httpPort = minimist.port || 9615
var httpHost = minimist.host || '0.0.0.0'

var redis = require("redis"),
  client = redis.createClient(
    minimist.rport || 6379,
    minimist.rhost || '0.0.0.0',
    (minimist.ropts && JSON.parse(minimist.ropts)) || {

    });

var getBlockKey = function () {
  var d = new Date()
  return 'k'+d.getFullYear()
    +''+(d.getMonth()<9?'0'+1+d.getMonth():1+d.getMonth())
    +''+(d.getDate()<10?'0'+d.getDate():d.getDate())
    +''+(d.getHours()<10?'0'+d.getHours():d.getHours())
    +''+(d.getMinutes()<10?'0'+d.getMinutes():d.getMinutes())
    +''+(d.getSeconds()<10?'0'+d.getSeconds():d.getSeconds())
    +''+(d.getMilliseconds()<10?'0'+d.getMilliseconds():d.getMilliseconds())
    ;
};
var blockKey = getBlockKey();
var blockKeyIncrement = 0

client.on("connect", function () {
  debug('connect')
  client.sadd('blockKeys', blockKey)

  setTimeout(function () {

    var blockInvl = setInterval(function () {
      debug('blockInvl')
      if(!blockKeyIncrement) client.srem('blockKeys', blockKey)
      blockKey = getBlockKey();
      blockKeyIncrement = 0;
      client.sadd('blockKeys', blockKey)
      debug('new '+blockKey)
      client.scard('blockKeys', function(err, res){
        debug('len '+res)
      })
    }, 100);

    client.on("end", function () {
      clearInterval(blockInvl)
    });
  }, (60-(new Date()).getSeconds()))

});

var resFile = null;
var resMime = 'text/plain';
if (minimist.response) {
  resFile = fs.readFileSync(minimist.response)
  resMime = mime.lookup(minimist.response)
}

var recorder = function (req, res) {
  blockKeyIncrement++;
  var jobId = String("000000000000000" + blockKeyIncrement).slice(-15);
  client.lpush('r'+blockKey, JSON.stringify({
    "headers": req.rawHeaders || eq.headers,
    "httpVersion": req.httpVersion,
    "method": req.method,
    "url": req.url,
    "jobId": jobId,
    "blockKey": blockKey
  }));
};

if (minimist.recorder) {
  recorder = require(minimist.recorder);
}

var responder = function (req, res) {
  res.writeHead(200, {
    'Content-Type': resMime,
    'Connection': 'close',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  resFile && res.write(resFile);
  res.end();
};
if (minimist.responder) {
  responder = require(minimist.responder);
}

client.on("connect", function () {

  http.createServer(function (req, res) {
    responder(req, res);
    recorder(req, res)
  }).listen(httpPort, httpHost);

  console.log('server started http://%s:%s', httpHost, httpPort)

  process.on('exit', function () {
    client.end();
    http.close()
  })

});