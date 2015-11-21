# http-recorder

node module which serves an http server and records
all incoming requests into a redis backend.

By default the response is a static html file.

Check `--response=`, `--recorder=`,  `--responder=`,
options to personalize that behavior at your convenience.


## install

    npm i maboiteaspam/http-recorder -g


## usage

    redis-server
    http-recorder [opts]

##### --verbose
More verbose.

##### --rport=`6379`
Redis port

##### --rhost=`0.0.0.0`
Redis host

##### --ropts=``
Redis options as a stringified json object

##### --port=`9615`
Recorder http server port

##### --host=`0.0.0.0`
Recorder http server host

##### --response=``
File to the default response file, if static.

##### --recorder=``
File to the default request recorder,
 a require-able javascript file which expose a function such
 `responder(req, res)`.

##### --responder=``
File to the default request responder,
 a require-able javascript file which expose a function such
 `responder(req, res)`.


## more info

##### keyspace distribution

It s a time based keyspace distribution.

Every `100ms` a new keyspace is created.

The complete `keyspace` is recorded into a `set` named `blockKeys`.

Empty `keyspace` are deleted at runtime.

##### request saving

Each request is saved json serialized into a `list` per `r[keyspace id]`.

Each request know its `keyspace` and a `jobId`.

`jobId` is an incremented integer to keep track of the data.


## need

##### optimizations

They are rooms too optimize. Noticeable example is the redis writes,
which are made by items, should be made by collection.

##### improve cookie support

Needs cookie support improvement.


## see also

- [http-replayer](https://github.com/maboiteaspam/http-replayer)
- [http-flow-visualizer](https://github.com/maboiteaspam/http-flow-visualizer)
