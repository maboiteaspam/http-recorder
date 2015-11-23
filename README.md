# http-recorder

node module which serves an http server and records
all incoming requests into a redis backend.

Should support POST, PUT and cookies in a raw format.

By default the response is a static html file.

Check `--response=`, `--recorder=`,  `--responder=`,
options to personalize that behavior at your convenience.


## install

    npm i maboiteaspam/http-recorder -g


## usage

    redis-server
    http-recorder --verbose [opts]
    ab -c 3000 -n 90000 http://127.0.0.1:9615/


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
 `responder(req, res, done)`.

##### --responder=``
File to the default request responder,
 a require-able javascript file which expose a function such
 `responder(req, res, done)`.


## more info

##### keyspace distribution

The `keyspace` use a time distribution.

Every `100ms` a new `blockKey` of the `keyspace` is created.

The complete `keyspace` is recorded into a redis `set` named `blockKeys`.

Empty `blockKey` are not recorded.

##### request saving

Each request is json serialized.

Once the `keyspace` has expired, its items
are `lpush`ed to a redis `list` name `r[blockKey]`.

Each request know its `blockKey` and a `jobId`.

`jobId` is an incremented integer within the `keyspace`.

When the request is a `POST` or `PUT`, its content
is immediately streamed to a redis `key` as a string value.

The content can be found at address `c[blockKey]-[jobId]`

##### request processing

Two handlers are available to process the requests: `recorder`, `responder`.

They are passed on the command line.

They must be a `require`able javascript file.

They must call `done`, otherwise a timeout
will arbitrary clean up the mess after `30` seconds.

They receive `blockKey` and `jobId` data to sync with each other.

```
    http-recorder --verbose --recorder=path/to/file.js
```

__path/to/file.js__
```js
module.exports = function requestProcesssor (req, res, blockKey, jobId, done) {
    done();
}
```



## need

##### optimizations

They are rooms too optimize. Noticeable example is the redis writes,
which are made by items, should be made by collection.


## see also

- [http-replayer](https://github.com/maboiteaspam/http-replayer)
- [http-flow-visualizer](https://github.com/maboiteaspam/http-flow-visualizer)
