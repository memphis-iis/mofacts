(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var check = Package.check.check;
var Match = Package.check.Match;
var Random = Package.random.Random;
var EJSON = Package.ejson.EJSON;
var Tracker = Package.tracker.Tracker;
var Deps = Package.tracker.Deps;
var Retry = Package.retry.Retry;
var IdMap = Package['id-map'].IdMap;
var ECMAScript = Package.ecmascript.ECMAScript;
var Hook = Package['callback-hook'].Hook;
var DDPCommon = Package['ddp-common'].DDPCommon;
var DiffSequence = Package['diff-sequence'].DiffSequence;
var MongoID = Package['mongo-id'].MongoID;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var options, args, callback, DDP;

var require = meteorInstall({"node_modules":{"meteor":{"ddp-client":{"server":{"server.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/ddp-client/server/server.js                                                                                //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.link("../common/namespace.js", {
  DDP: "DDP"
}, 0);
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"common":{"MethodInvoker.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/ddp-client/common/MethodInvoker.js                                                                         //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
  default: () => MethodInvoker
});

class MethodInvoker {
  constructor(options) {
    // Public (within this file) fields.
    this.methodId = options.methodId;
    this.sentMessage = false;
    this._callback = options.callback;
    this._connection = options.connection;
    this._message = options.message;

    this._onResultReceived = options.onResultReceived || (() => {});

    this._wait = options.wait;
    this.noRetry = options.noRetry;
    this._methodResult = null;
    this._dataVisible = false; // Register with the connection.

    this._connection._methodInvokers[this.methodId] = this;
  } // Sends the method message to the server. May be called additional times if
  // we lose the connection and reconnect before receiving a result.


  sendMessage() {
    // This function is called before sending a method (including resending on
    // reconnect). We should only (re)send methods where we don't already have a
    // result!
    if (this.gotResult()) throw new Error('sendingMethod is called on method with result'); // If we're re-sending it, it doesn't matter if data was written the first
    // time.

    this._dataVisible = false;
    this.sentMessage = true; // If this is a wait method, make all data messages be buffered until it is
    // done.

    if (this._wait) this._connection._methodsBlockingQuiescence[this.methodId] = true; // Actually send the message.

    this._connection._send(this._message);
  } // Invoke the callback, if we have both a result and know that all data has
  // been written to the local cache.


  _maybeInvokeCallback() {
    if (this._methodResult && this._dataVisible) {
      // Call the callback. (This won't throw: the callback was wrapped with
      // bindEnvironment.)
      this._callback(this._methodResult[0], this._methodResult[1]); // Forget about this method.


      delete this._connection._methodInvokers[this.methodId]; // Let the connection know that this method is finished, so it can try to
      // move on to the next block of methods.

      this._connection._outstandingMethodFinished();
    }
  } // Call with the result of the method from the server. Only may be called
  // once; once it is called, you should not call sendMessage again.
  // If the user provided an onResultReceived callback, call it immediately.
  // Then invoke the main callback if data is also visible.


  receiveResult(err, result) {
    if (this.gotResult()) throw new Error('Methods should only receive results once');
    this._methodResult = [err, result];

    this._onResultReceived(err, result);

    this._maybeInvokeCallback();
  } // Call this when all data written by the method is visible. This means that
  // the method has returns its "data is done" message *AND* all server
  // documents that are buffered at that time have been written to the local
  // cache. Invokes the main callback if the result has been received.


  dataVisible() {
    this._dataVisible = true;

    this._maybeInvokeCallback();
  } // True if receiveResult has been called.


  gotResult() {
    return !!this._methodResult;
  }

}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"livedata_connection.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/ddp-client/common/livedata_connection.js                                                                   //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let _objectSpread;

module.link("@babel/runtime/helpers/objectSpread2", {
  default(v) {
    _objectSpread = v;
  }

}, 0);
module.export({
  Connection: () => Connection
});
let Meteor;
module.link("meteor/meteor", {
  Meteor(v) {
    Meteor = v;
  }

}, 0);
let DDPCommon;
module.link("meteor/ddp-common", {
  DDPCommon(v) {
    DDPCommon = v;
  }

}, 1);
let Tracker;
module.link("meteor/tracker", {
  Tracker(v) {
    Tracker = v;
  }

}, 2);
let EJSON;
module.link("meteor/ejson", {
  EJSON(v) {
    EJSON = v;
  }

}, 3);
let Random;
module.link("meteor/random", {
  Random(v) {
    Random = v;
  }

}, 4);
let Hook;
module.link("meteor/callback-hook", {
  Hook(v) {
    Hook = v;
  }

}, 5);
let MongoID;
module.link("meteor/mongo-id", {
  MongoID(v) {
    MongoID = v;
  }

}, 6);
let DDP;
module.link("./namespace.js", {
  DDP(v) {
    DDP = v;
  }

}, 7);
let MethodInvoker;
module.link("./MethodInvoker.js", {
  default(v) {
    MethodInvoker = v;
  }

}, 8);
let hasOwn, slice, keys, isEmpty, last;
module.link("meteor/ddp-common/utils.js", {
  hasOwn(v) {
    hasOwn = v;
  },

  slice(v) {
    slice = v;
  },

  keys(v) {
    keys = v;
  },

  isEmpty(v) {
    isEmpty = v;
  },

  last(v) {
    last = v;
  }

}, 9);
let Fiber;
let Future;

if (Meteor.isServer) {
  Fiber = Npm.require('fibers');
  Future = Npm.require('fibers/future');
}

class MongoIDMap extends IdMap {
  constructor() {
    super(MongoID.idStringify, MongoID.idParse);
  }

} // @param url {String|Object} URL to Meteor app,
//   or an object as a test hook (see code)
// Options:
//   reloadWithOutstanding: is it OK to reload if there are outstanding methods?
//   headers: extra headers to send on the websockets connection, for
//     server-to-server DDP only
//   _sockjsOptions: Specifies options to pass through to the sockjs client
//   onDDPNegotiationVersionFailure: callback when version negotiation fails.
//
// XXX There should be a way to destroy a DDP connection, causing all
// outstanding method calls to fail.
//
// XXX Our current way of handling failure and reconnection is great
// for an app (where we want to tolerate being disconnected as an
// expect state, and keep trying forever to reconnect) but cumbersome
// for something like a command line tool that wants to make a
// connection, call a method, and print an error if connection
// fails. We should have better usability in the latter case (while
// still transparently reconnecting if it's just a transient failure
// or the server migrating us).


class Connection {
  constructor(url, options) {
    const self = this;
    this.options = options = _objectSpread({
      onConnected() {},

      onDDPVersionNegotiationFailure(description) {
        Meteor._debug(description);
      },

      heartbeatInterval: 17500,
      heartbeatTimeout: 15000,
      npmFayeOptions: Object.create(null),
      // These options are only for testing.
      reloadWithOutstanding: false,
      supportedDDPVersions: DDPCommon.SUPPORTED_DDP_VERSIONS,
      retry: true,
      respondToPings: true,
      // When updates are coming within this ms interval, batch them together.
      bufferedWritesInterval: 5,
      // Flush buffers immediately if writes are happening continuously for more than this many ms.
      bufferedWritesMaxAge: 500
    }, options); // If set, called when we reconnect, queuing method calls _before_ the
    // existing outstanding ones.
    // NOTE: This feature has been preserved for backwards compatibility. The
    // preferred method of setting a callback on reconnect is to use
    // DDP.onReconnect.

    self.onReconnect = null; // as a test hook, allow passing a stream instead of a url.

    if (typeof url === 'object') {
      self._stream = url;
    } else {
      const {
        ClientStream
      } = require("meteor/socket-stream-client");

      self._stream = new ClientStream(url, {
        retry: options.retry,
        ConnectionError: DDP.ConnectionError,
        headers: options.headers,
        _sockjsOptions: options._sockjsOptions,
        // Used to keep some tests quiet, or for other cases in which
        // the right thing to do with connection errors is to silently
        // fail (e.g. sending package usage stats). At some point we
        // should have a real API for handling client-stream-level
        // errors.
        _dontPrintErrors: options._dontPrintErrors,
        connectTimeoutMs: options.connectTimeoutMs,
        npmFayeOptions: options.npmFayeOptions
      });
    }

    self._lastSessionId = null;
    self._versionSuggestion = null; // The last proposed DDP version.

    self._version = null; // The DDP version agreed on by client and server.

    self._stores = Object.create(null); // name -> object with methods

    self._methodHandlers = Object.create(null); // name -> func

    self._nextMethodId = 1;
    self._supportedDDPVersions = options.supportedDDPVersions;
    self._heartbeatInterval = options.heartbeatInterval;
    self._heartbeatTimeout = options.heartbeatTimeout; // Tracks methods which the user has tried to call but which have not yet
    // called their user callback (ie, they are waiting on their result or for all
    // of their writes to be written to the local cache). Map from method ID to
    // MethodInvoker object.

    self._methodInvokers = Object.create(null); // Tracks methods which the user has called but whose result messages have not
    // arrived yet.
    //
    // _outstandingMethodBlocks is an array of blocks of methods. Each block
    // represents a set of methods that can run at the same time. The first block
    // represents the methods which are currently in flight; subsequent blocks
    // must wait for previous blocks to be fully finished before they can be sent
    // to the server.
    //
    // Each block is an object with the following fields:
    // - methods: a list of MethodInvoker objects
    // - wait: a boolean; if true, this block had a single method invoked with
    //         the "wait" option
    //
    // There will never be adjacent blocks with wait=false, because the only thing
    // that makes methods need to be serialized is a wait method.
    //
    // Methods are removed from the first block when their "result" is
    // received. The entire first block is only removed when all of the in-flight
    // methods have received their results (so the "methods" list is empty) *AND*
    // all of the data written by those methods are visible in the local cache. So
    // it is possible for the first block's methods list to be empty, if we are
    // still waiting for some objects to quiesce.
    //
    // Example:
    //  _outstandingMethodBlocks = [
    //    {wait: false, methods: []},
    //    {wait: true, methods: [<MethodInvoker for 'login'>]},
    //    {wait: false, methods: [<MethodInvoker for 'foo'>,
    //                            <MethodInvoker for 'bar'>]}]
    // This means that there were some methods which were sent to the server and
    // which have returned their results, but some of the data written by
    // the methods may not be visible in the local cache. Once all that data is
    // visible, we will send a 'login' method. Once the login method has returned
    // and all the data is visible (including re-running subs if userId changes),
    // we will send the 'foo' and 'bar' methods in parallel.

    self._outstandingMethodBlocks = []; // method ID -> array of objects with keys 'collection' and 'id', listing
    // documents written by a given method's stub. keys are associated with
    // methods whose stub wrote at least one document, and whose data-done message
    // has not yet been received.

    self._documentsWrittenByStub = Object.create(null); // collection -> IdMap of "server document" object. A "server document" has:
    // - "document": the version of the document according the
    //   server (ie, the snapshot before a stub wrote it, amended by any changes
    //   received from the server)
    //   It is undefined if we think the document does not exist
    // - "writtenByStubs": a set of method IDs whose stubs wrote to the document
    //   whose "data done" messages have not yet been processed

    self._serverDocuments = Object.create(null); // Array of callbacks to be called after the next update of the local
    // cache. Used for:
    //  - Calling methodInvoker.dataVisible and sub ready callbacks after
    //    the relevant data is flushed.
    //  - Invoking the callbacks of "half-finished" methods after reconnect
    //    quiescence. Specifically, methods whose result was received over the old
    //    connection (so we don't re-send it) but whose data had not been made
    //    visible.

    self._afterUpdateCallbacks = []; // In two contexts, we buffer all incoming data messages and then process them
    // all at once in a single update:
    //   - During reconnect, we buffer all data messages until all subs that had
    //     been ready before reconnect are ready again, and all methods that are
    //     active have returned their "data done message"; then
    //   - During the execution of a "wait" method, we buffer all data messages
    //     until the wait method gets its "data done" message. (If the wait method
    //     occurs during reconnect, it doesn't get any special handling.)
    // all data messages are processed in one update.
    //
    // The following fields are used for this "quiescence" process.
    // This buffers the messages that aren't being processed yet.

    self._messagesBufferedUntilQuiescence = []; // Map from method ID -> true. Methods are removed from this when their
    // "data done" message is received, and we will not quiesce until it is
    // empty.

    self._methodsBlockingQuiescence = Object.create(null); // map from sub ID -> true for subs that were ready (ie, called the sub
    // ready callback) before reconnect but haven't become ready again yet

    self._subsBeingRevived = Object.create(null); // map from sub._id -> true
    // if true, the next data update should reset all stores. (set during
    // reconnect.)

    self._resetStores = false; // name -> array of updates for (yet to be created) collections

    self._updatesForUnknownStores = Object.create(null); // if we're blocking a migration, the retry func

    self._retryMigrate = null;
    self.__flushBufferedWrites = Meteor.bindEnvironment(self._flushBufferedWrites, 'flushing DDP buffered writes', self); // Collection name -> array of messages.

    self._bufferedWrites = Object.create(null); // When current buffer of updates must be flushed at, in ms timestamp.

    self._bufferedWritesFlushAt = null; // Timeout handle for the next processing of all pending writes

    self._bufferedWritesFlushHandle = null;
    self._bufferedWritesInterval = options.bufferedWritesInterval;
    self._bufferedWritesMaxAge = options.bufferedWritesMaxAge; // metadata for subscriptions.  Map from sub ID to object with keys:
    //   - id
    //   - name
    //   - params
    //   - inactive (if true, will be cleaned up if not reused in re-run)
    //   - ready (has the 'ready' message been received?)
    //   - readyCallback (an optional callback to call when ready)
    //   - errorCallback (an optional callback to call if the sub terminates with
    //                    an error, XXX COMPAT WITH 1.0.3.1)
    //   - stopCallback (an optional callback to call when the sub terminates
    //     for any reason, with an error argument if an error triggered the stop)

    self._subscriptions = Object.create(null); // Reactive userId.

    self._userId = null;
    self._userIdDeps = new Tracker.Dependency(); // Block auto-reload while we're waiting for method responses.

    if (Meteor.isClient && Package.reload && !options.reloadWithOutstanding) {
      Package.reload.Reload._onMigrate(retry => {
        if (!self._readyToMigrate()) {
          self._retryMigrate = retry;
          return [false];
        } else {
          return [true];
        }
      });
    }

    const onDisconnect = () => {
      if (self._heartbeat) {
        self._heartbeat.stop();

        self._heartbeat = null;
      }
    };

    if (Meteor.isServer) {
      self._stream.on('message', Meteor.bindEnvironment(this.onMessage.bind(this), 'handling DDP message'));

      self._stream.on('reset', Meteor.bindEnvironment(this.onReset.bind(this), 'handling DDP reset'));

      self._stream.on('disconnect', Meteor.bindEnvironment(onDisconnect, 'handling DDP disconnect'));
    } else {
      self._stream.on('message', this.onMessage.bind(this));

      self._stream.on('reset', this.onReset.bind(this));

      self._stream.on('disconnect', onDisconnect);
    }
  } // 'name' is the name of the data on the wire that should go in the
  // store. 'wrappedStore' should be an object with methods beginUpdate, update,
  // endUpdate, saveOriginals, retrieveOriginals. see Collection for an example.


  registerStore(name, wrappedStore) {
    const self = this;
    if (name in self._stores) return false; // Wrap the input object in an object which makes any store method not
    // implemented by 'store' into a no-op.

    const store = Object.create(null);
    const keysOfStore = ['update', 'beginUpdate', 'endUpdate', 'saveOriginals', 'retrieveOriginals', 'getDoc', '_getCollection'];
    keysOfStore.forEach(method => {
      store[method] = function () {
        if (wrappedStore[method]) {
          return wrappedStore[method](...arguments);
        }
      };
    });
    self._stores[name] = store;
    const queued = self._updatesForUnknownStores[name];

    if (Array.isArray(queued)) {
      store.beginUpdate(queued.length, false);
      queued.forEach(msg => {
        store.update(msg);
      });
      store.endUpdate();
      delete self._updatesForUnknownStores[name];
    }

    return true;
  }
  /**
   * @memberOf Meteor
   * @importFromPackage meteor
   * @alias Meteor.subscribe
   * @summary Subscribe to a record set.  Returns a handle that provides
   * `stop()` and `ready()` methods.
   * @locus Client
   * @param {String} name Name of the subscription.  Matches the name of the
   * server's `publish()` call.
   * @param {EJSONable} [arg1,arg2...] Optional arguments passed to publisher
   * function on server.
   * @param {Function|Object} [callbacks] Optional. May include `onStop`
   * and `onReady` callbacks. If there is an error, it is passed as an
   * argument to `onStop`. If a function is passed instead of an object, it
   * is interpreted as an `onReady` callback.
   */


  subscribe(name
  /* .. [arguments] .. (callback|callbacks) */
  ) {
    const self = this;
    const params = slice.call(arguments, 1);
    let callbacks = Object.create(null);

    if (params.length) {
      const lastParam = params[params.length - 1];

      if (typeof lastParam === 'function') {
        callbacks.onReady = params.pop();
      } else if (lastParam && [lastParam.onReady, // XXX COMPAT WITH 1.0.3.1 onError used to exist, but now we use
      // onStop with an error callback instead.
      lastParam.onError, lastParam.onStop].some(f => typeof f === "function")) {
        callbacks = params.pop();
      }
    } // Is there an existing sub with the same name and param, run in an
    // invalidated Computation? This will happen if we are rerunning an
    // existing computation.
    //
    // For example, consider a rerun of:
    //
    //     Tracker.autorun(function () {
    //       Meteor.subscribe("foo", Session.get("foo"));
    //       Meteor.subscribe("bar", Session.get("bar"));
    //     });
    //
    // If "foo" has changed but "bar" has not, we will match the "bar"
    // subcribe to an existing inactive subscription in order to not
    // unsub and resub the subscription unnecessarily.
    //
    // We only look for one such sub; if there are N apparently-identical subs
    // being invalidated, we will require N matching subscribe calls to keep
    // them all active.


    const existing = Object.values(self._subscriptions).find(sub => sub.inactive && sub.name === name && EJSON.equals(sub.params, params));
    let id;

    if (existing) {
      id = existing.id;
      existing.inactive = false; // reactivate

      if (callbacks.onReady) {
        // If the sub is not already ready, replace any ready callback with the
        // one provided now. (It's not really clear what users would expect for
        // an onReady callback inside an autorun; the semantics we provide is
        // that at the time the sub first becomes ready, we call the last
        // onReady callback provided, if any.)
        // If the sub is already ready, run the ready callback right away.
        // It seems that users would expect an onReady callback inside an
        // autorun to trigger once the the sub first becomes ready and also
        // when re-subs happens.
        if (existing.ready) {
          callbacks.onReady();
        } else {
          existing.readyCallback = callbacks.onReady;
        }
      } // XXX COMPAT WITH 1.0.3.1 we used to have onError but now we call
      // onStop with an optional error argument


      if (callbacks.onError) {
        // Replace existing callback if any, so that errors aren't
        // double-reported.
        existing.errorCallback = callbacks.onError;
      }

      if (callbacks.onStop) {
        existing.stopCallback = callbacks.onStop;
      }
    } else {
      // New sub! Generate an id, save it locally, and send message.
      id = Random.id();
      self._subscriptions[id] = {
        id: id,
        name: name,
        params: EJSON.clone(params),
        inactive: false,
        ready: false,
        readyDeps: new Tracker.Dependency(),
        readyCallback: callbacks.onReady,
        // XXX COMPAT WITH 1.0.3.1 #errorCallback
        errorCallback: callbacks.onError,
        stopCallback: callbacks.onStop,
        connection: self,

        remove() {
          delete this.connection._subscriptions[this.id];
          this.ready && this.readyDeps.changed();
        },

        stop() {
          this.connection._send({
            msg: 'unsub',
            id: id
          });

          this.remove();

          if (callbacks.onStop) {
            callbacks.onStop();
          }
        }

      };

      self._send({
        msg: 'sub',
        id: id,
        name: name,
        params: params
      });
    } // return a handle to the application.


    const handle = {
      stop() {
        if (!hasOwn.call(self._subscriptions, id)) {
          return;
        }

        self._subscriptions[id].stop();
      },

      ready() {
        // return false if we've unsubscribed.
        if (!hasOwn.call(self._subscriptions, id)) {
          return false;
        }

        const record = self._subscriptions[id];
        record.readyDeps.depend();
        return record.ready;
      },

      subscriptionId: id
    };

    if (Tracker.active) {
      // We're in a reactive computation, so we'd like to unsubscribe when the
      // computation is invalidated... but not if the rerun just re-subscribes
      // to the same subscription!  When a rerun happens, we use onInvalidate
      // as a change to mark the subscription "inactive" so that it can
      // be reused from the rerun.  If it isn't reused, it's killed from
      // an afterFlush.
      Tracker.onInvalidate(c => {
        if (hasOwn.call(self._subscriptions, id)) {
          self._subscriptions[id].inactive = true;
        }

        Tracker.afterFlush(() => {
          if (hasOwn.call(self._subscriptions, id) && self._subscriptions[id].inactive) {
            handle.stop();
          }
        });
      });
    }

    return handle;
  } // options:
  // - onLateError {Function(error)} called if an error was received after the ready event.
  //     (errors received before ready cause an error to be thrown)


  _subscribeAndWait(name, args, options) {
    const self = this;
    const f = new Future();
    let ready = false;
    args = args || [];
    args.push({
      onReady() {
        ready = true;
        f['return']();
      },

      onError(e) {
        if (!ready) f['throw'](e);else options && options.onLateError && options.onLateError(e);
      }

    });
    const handle = self.subscribe.apply(self, [name].concat(args));
    f.wait();
    return handle;
  }

  methods(methods) {
    Object.entries(methods).forEach((_ref) => {
      let [name, func] = _ref;

      if (typeof func !== 'function') {
        throw new Error("Method '" + name + "' must be a function");
      }

      if (this._methodHandlers[name]) {
        throw new Error("A method named '" + name + "' is already defined");
      }

      this._methodHandlers[name] = func;
    });
  }
  /**
   * @memberOf Meteor
   * @importFromPackage meteor
   * @alias Meteor.call
   * @summary Invokes a method passing any number of arguments.
   * @locus Anywhere
   * @param {String} name Name of method to invoke
   * @param {EJSONable} [arg1,arg2...] Optional method arguments
   * @param {Function} [asyncCallback] Optional callback, which is called asynchronously with the error or result after the method is complete. If not provided, the method runs synchronously if possible (see below).
   */


  call(name
  /* .. [arguments] .. callback */
  ) {
    // if it's a function, the last argument is the result callback,
    // not a parameter to the remote method.
    const args = slice.call(arguments, 1);
    let callback;

    if (args.length && typeof args[args.length - 1] === 'function') {
      callback = args.pop();
    }

    return this.apply(name, args, callback);
  }
  /**
   * @memberOf Meteor
   * @importFromPackage meteor
   * @alias Meteor.apply
   * @summary Invoke a method passing an array of arguments.
   * @locus Anywhere
   * @param {String} name Name of method to invoke
   * @param {EJSONable[]} args Method arguments
   * @param {Object} [options]
   * @param {Boolean} options.wait (Client only) If true, don't send this method until all previous method calls have completed, and don't send any subsequent method calls until this one is completed.
   * @param {Function} options.onResultReceived (Client only) This callback is invoked with the error or result of the method (just like `asyncCallback`) as soon as the error or result is available. The local cache may not yet reflect the writes performed by the method.
   * @param {Boolean} options.noRetry (Client only) if true, don't send this method again on reload, simply call the callback an error with the error code 'invocation-failed'.
   * @param {Boolean} options.throwStubExceptions (Client only) If true, exceptions thrown by method stubs will be thrown instead of logged, and the method will not be invoked on the server.
   * @param {Boolean} options.returnStubValue (Client only) If true then in cases where we would have otherwise discarded the stub's return value and returned undefined, instead we go ahead and return it. Specifically, this is any time other than when (a) we are already inside a stub or (b) we are in Node and no callback was provided. Currently we require this flag to be explicitly passed to reduce the likelihood that stub return values will be confused with server return values; we may improve this in future.
   * @param {Function} [asyncCallback] Optional callback; same semantics as in [`Meteor.call`](#meteor_call).
   */


  apply(name, args, options, callback) {
    const self = this; // We were passed 3 arguments. They may be either (name, args, options)
    // or (name, args, callback)

    if (!callback && typeof options === 'function') {
      callback = options;
      options = Object.create(null);
    }

    options = options || Object.create(null);

    if (callback) {
      // XXX would it be better form to do the binding in stream.on,
      // or caller, instead of here?
      // XXX improve error message (and how we report it)
      callback = Meteor.bindEnvironment(callback, "delivering result of invoking '" + name + "'");
    } // Keep our args safe from mutation (eg if we don't send the message for a
    // while because of a wait method).


    args = EJSON.clone(args);

    const enclosing = DDP._CurrentMethodInvocation.get();

    const alreadyInSimulation = enclosing && enclosing.isSimulation; // Lazily generate a randomSeed, only if it is requested by the stub.
    // The random streams only have utility if they're used on both the client
    // and the server; if the client doesn't generate any 'random' values
    // then we don't expect the server to generate any either.
    // Less commonly, the server may perform different actions from the client,
    // and may in fact generate values where the client did not, but we don't
    // have any client-side values to match, so even here we may as well just
    // use a random seed on the server.  In that case, we don't pass the
    // randomSeed to save bandwidth, and we don't even generate it to save a
    // bit of CPU and to avoid consuming entropy.

    let randomSeed = null;

    const randomSeedGenerator = () => {
      if (randomSeed === null) {
        randomSeed = DDPCommon.makeRpcSeed(enclosing, name);
      }

      return randomSeed;
    }; // Run the stub, if we have one. The stub is supposed to make some
    // temporary writes to the database to give the user a smooth experience
    // until the actual result of executing the method comes back from the
    // server (whereupon the temporary writes to the database will be reversed
    // during the beginUpdate/endUpdate process.)
    //
    // Normally, we ignore the return value of the stub (even if it is an
    // exception), in favor of the real return value from the server. The
    // exception is if the *caller* is a stub. In that case, we're not going
    // to do a RPC, so we use the return value of the stub as our return
    // value.


    let stubReturnValue;
    let exception;
    const stub = self._methodHandlers[name];

    if (stub) {
      const setUserId = userId => {
        self.setUserId(userId);
      };

      const invocation = new DDPCommon.MethodInvocation({
        isSimulation: true,
        userId: self.userId(),
        setUserId: setUserId,

        randomSeed() {
          return randomSeedGenerator();
        }

      });
      if (!alreadyInSimulation) self._saveOriginals();

      try {
        // Note that unlike in the corresponding server code, we never audit
        // that stubs check() their arguments.
        stubReturnValue = DDP._CurrentMethodInvocation.withValue(invocation, () => {
          if (Meteor.isServer) {
            // Because saveOriginals and retrieveOriginals aren't reentrant,
            // don't allow stubs to yield.
            return Meteor._noYieldsAllowed(() => {
              // re-clone, so that the stub can't affect our caller's values
              return stub.apply(invocation, EJSON.clone(args));
            });
          } else {
            return stub.apply(invocation, EJSON.clone(args));
          }
        });
      } catch (e) {
        exception = e;
      }
    } // If we're in a simulation, stop and return the result we have,
    // rather than going on to do an RPC. If there was no stub,
    // we'll end up returning undefined.


    if (alreadyInSimulation) {
      if (callback) {
        callback(exception, stubReturnValue);
        return undefined;
      }

      if (exception) throw exception;
      return stubReturnValue;
    } // We only create the methodId here because we don't actually need one if
    // we're already in a simulation


    const methodId = '' + self._nextMethodId++;

    if (stub) {
      self._retrieveAndStoreOriginals(methodId);
    } // Generate the DDP message for the method call. Note that on the client,
    // it is important that the stub have finished before we send the RPC, so
    // that we know we have a complete list of which local documents the stub
    // wrote.


    const message = {
      msg: 'method',
      method: name,
      params: args,
      id: methodId
    }; // If an exception occurred in a stub, and we're ignoring it
    // because we're doing an RPC and want to use what the server
    // returns instead, log it so the developer knows
    // (unless they explicitly ask to see the error).
    //
    // Tests can set the '_expectedByTest' flag on an exception so it won't
    // go to log.

    if (exception) {
      if (options.throwStubExceptions) {
        throw exception;
      } else if (!exception._expectedByTest) {
        Meteor._debug("Exception while simulating the effect of invoking '" + name + "'", exception);
      }
    } // At this point we're definitely doing an RPC, and we're going to
    // return the value of the RPC to the caller.
    // If the caller didn't give a callback, decide what to do.


    let future;

    if (!callback) {
      if (Meteor.isClient) {
        // On the client, we don't have fibers, so we can't block. The
        // only thing we can do is to return undefined and discard the
        // result of the RPC. If an error occurred then print the error
        // to the console.
        callback = err => {
          err && Meteor._debug("Error invoking Method '" + name + "'", err);
        };
      } else {
        // On the server, make the function synchronous. Throw on
        // errors, return on success.
        future = new Future();
        callback = future.resolver();
      }
    } // Send the randomSeed only if we used it


    if (randomSeed !== null) {
      message.randomSeed = randomSeed;
    }

    const methodInvoker = new MethodInvoker({
      methodId,
      callback: callback,
      connection: self,
      onResultReceived: options.onResultReceived,
      wait: !!options.wait,
      message: message,
      noRetry: !!options.noRetry
    });

    if (options.wait) {
      // It's a wait method! Wait methods go in their own block.
      self._outstandingMethodBlocks.push({
        wait: true,
        methods: [methodInvoker]
      });
    } else {
      // Not a wait method. Start a new block if the previous block was a wait
      // block, and add it to the last block of methods.
      if (isEmpty(self._outstandingMethodBlocks) || last(self._outstandingMethodBlocks).wait) {
        self._outstandingMethodBlocks.push({
          wait: false,
          methods: []
        });
      }

      last(self._outstandingMethodBlocks).methods.push(methodInvoker);
    } // If we added it to the first block, send it out now.


    if (self._outstandingMethodBlocks.length === 1) methodInvoker.sendMessage(); // If we're using the default callback on the server,
    // block waiting for the result.

    if (future) {
      return future.wait();
    }

    return options.returnStubValue ? stubReturnValue : undefined;
  } // Before calling a method stub, prepare all stores to track changes and allow
  // _retrieveAndStoreOriginals to get the original versions of changed
  // documents.


  _saveOriginals() {
    if (!this._waitingForQuiescence()) {
      this._flushBufferedWrites();
    }

    Object.values(this._stores).forEach(store => {
      store.saveOriginals();
    });
  } // Retrieves the original versions of all documents modified by the stub for
  // method 'methodId' from all stores and saves them to _serverDocuments (keyed
  // by document) and _documentsWrittenByStub (keyed by method ID).


  _retrieveAndStoreOriginals(methodId) {
    const self = this;
    if (self._documentsWrittenByStub[methodId]) throw new Error('Duplicate methodId in _retrieveAndStoreOriginals');
    const docsWritten = [];
    Object.entries(self._stores).forEach((_ref2) => {
      let [collection, store] = _ref2;
      const originals = store.retrieveOriginals(); // not all stores define retrieveOriginals

      if (!originals) return;
      originals.forEach((doc, id) => {
        docsWritten.push({
          collection,
          id
        });

        if (!hasOwn.call(self._serverDocuments, collection)) {
          self._serverDocuments[collection] = new MongoIDMap();
        }

        const serverDoc = self._serverDocuments[collection].setDefault(id, Object.create(null));

        if (serverDoc.writtenByStubs) {
          // We're not the first stub to write this doc. Just add our method ID
          // to the record.
          serverDoc.writtenByStubs[methodId] = true;
        } else {
          // First stub! Save the original value and our method ID.
          serverDoc.document = doc;
          serverDoc.flushCallbacks = [];
          serverDoc.writtenByStubs = Object.create(null);
          serverDoc.writtenByStubs[methodId] = true;
        }
      });
    });

    if (!isEmpty(docsWritten)) {
      self._documentsWrittenByStub[methodId] = docsWritten;
    }
  } // This is very much a private function we use to make the tests
  // take up fewer server resources after they complete.


  _unsubscribeAll() {
    Object.values(this._subscriptions).forEach(sub => {
      // Avoid killing the autoupdate subscription so that developers
      // still get hot code pushes when writing tests.
      //
      // XXX it's a hack to encode knowledge about autoupdate here,
      // but it doesn't seem worth it yet to have a special API for
      // subscriptions to preserve after unit tests.
      if (sub.name !== 'meteor_autoupdate_clientVersions') {
        sub.stop();
      }
    });
  } // Sends the DDP stringification of the given message object


  _send(obj) {
    this._stream.send(DDPCommon.stringifyDDP(obj));
  } // We detected via DDP-level heartbeats that we've lost the
  // connection.  Unlike `disconnect` or `close`, a lost connection
  // will be automatically retried.


  _lostConnection(error) {
    this._stream._lostConnection(error);
  }
  /**
   * @memberOf Meteor
   * @importFromPackage meteor
   * @alias Meteor.status
   * @summary Get the current connection status. A reactive data source.
   * @locus Client
   */


  status() {
    return this._stream.status(...arguments);
  }
  /**
   * @summary Force an immediate reconnection attempt if the client is not connected to the server.
   This method does nothing if the client is already connected.
   * @memberOf Meteor
   * @importFromPackage meteor
   * @alias Meteor.reconnect
   * @locus Client
   */


  reconnect() {
    return this._stream.reconnect(...arguments);
  }
  /**
   * @memberOf Meteor
   * @importFromPackage meteor
   * @alias Meteor.disconnect
   * @summary Disconnect the client from the server.
   * @locus Client
   */


  disconnect() {
    return this._stream.disconnect(...arguments);
  }

  close() {
    return this._stream.disconnect({
      _permanent: true
    });
  } ///
  /// Reactive user system
  ///


  userId() {
    if (this._userIdDeps) this._userIdDeps.depend();
    return this._userId;
  }

  setUserId(userId) {
    // Avoid invalidating dependents if setUserId is called with current value.
    if (this._userId === userId) return;
    this._userId = userId;
    if (this._userIdDeps) this._userIdDeps.changed();
  } // Returns true if we are in a state after reconnect of waiting for subs to be
  // revived or early methods to finish their data, or we are waiting for a
  // "wait" method to finish.


  _waitingForQuiescence() {
    return !isEmpty(this._subsBeingRevived) || !isEmpty(this._methodsBlockingQuiescence);
  } // Returns true if any method whose message has been sent to the server has
  // not yet invoked its user callback.


  _anyMethodsAreOutstanding() {
    const invokers = this._methodInvokers;
    return Object.values(invokers).some(invoker => !!invoker.sentMessage);
  }

  _livedata_connected(msg) {
    const self = this;

    if (self._version !== 'pre1' && self._heartbeatInterval !== 0) {
      self._heartbeat = new DDPCommon.Heartbeat({
        heartbeatInterval: self._heartbeatInterval,
        heartbeatTimeout: self._heartbeatTimeout,

        onTimeout() {
          self._lostConnection(new DDP.ConnectionError('DDP heartbeat timed out'));
        },

        sendPing() {
          self._send({
            msg: 'ping'
          });
        }

      });

      self._heartbeat.start();
    } // If this is a reconnect, we'll have to reset all stores.


    if (self._lastSessionId) self._resetStores = true;
    let reconnectedToPreviousSession;

    if (typeof msg.session === 'string') {
      reconnectedToPreviousSession = self._lastSessionId === msg.session;
      self._lastSessionId = msg.session;
    }

    if (reconnectedToPreviousSession) {
      // Successful reconnection -- pick up where we left off.  Note that right
      // now, this never happens: the server never connects us to a previous
      // session, because DDP doesn't provide enough data for the server to know
      // what messages the client has processed. We need to improve DDP to make
      // this possible, at which point we'll probably need more code here.
      return;
    } // Server doesn't have our data any more. Re-sync a new session.
    // Forget about messages we were buffering for unknown collections. They'll
    // be resent if still relevant.


    self._updatesForUnknownStores = Object.create(null);

    if (self._resetStores) {
      // Forget about the effects of stubs. We'll be resetting all collections
      // anyway.
      self._documentsWrittenByStub = Object.create(null);
      self._serverDocuments = Object.create(null);
    } // Clear _afterUpdateCallbacks.


    self._afterUpdateCallbacks = []; // Mark all named subscriptions which are ready (ie, we already called the
    // ready callback) as needing to be revived.
    // XXX We should also block reconnect quiescence until unnamed subscriptions
    //     (eg, autopublish) are done re-publishing to avoid flicker!

    self._subsBeingRevived = Object.create(null);
    Object.entries(self._subscriptions).forEach((_ref3) => {
      let [id, sub] = _ref3;

      if (sub.ready) {
        self._subsBeingRevived[id] = true;
      }
    }); // Arrange for "half-finished" methods to have their callbacks run, and
    // track methods that were sent on this connection so that we don't
    // quiesce until they are all done.
    //
    // Start by clearing _methodsBlockingQuiescence: methods sent before
    // reconnect don't matter, and any "wait" methods sent on the new connection
    // that we drop here will be restored by the loop below.

    self._methodsBlockingQuiescence = Object.create(null);

    if (self._resetStores) {
      const invokers = self._methodInvokers;
      keys(invokers).forEach(id => {
        const invoker = invokers[id];

        if (invoker.gotResult()) {
          // This method already got its result, but it didn't call its callback
          // because its data didn't become visible. We did not resend the
          // method RPC. We'll call its callback when we get a full quiesce,
          // since that's as close as we'll get to "data must be visible".
          self._afterUpdateCallbacks.push(function () {
            return invoker.dataVisible(...arguments);
          });
        } else if (invoker.sentMessage) {
          // This method has been sent on this connection (maybe as a resend
          // from the last connection, maybe from onReconnect, maybe just very
          // quickly before processing the connected message).
          //
          // We don't need to do anything special to ensure its callbacks get
          // called, but we'll count it as a method which is preventing
          // reconnect quiescence. (eg, it might be a login method that was run
          // from onReconnect, and we don't want to see flicker by seeing a
          // logged-out state.)
          self._methodsBlockingQuiescence[invoker.methodId] = true;
        }
      });
    }

    self._messagesBufferedUntilQuiescence = []; // If we're not waiting on any methods or subs, we can reset the stores and
    // call the callbacks immediately.

    if (!self._waitingForQuiescence()) {
      if (self._resetStores) {
        Object.values(self._stores).forEach(store => {
          store.beginUpdate(0, true);
          store.endUpdate();
        });
        self._resetStores = false;
      }

      self._runAfterUpdateCallbacks();
    }
  }

  _processOneDataMessage(msg, updates) {
    const messageType = msg.msg; // msg is one of ['added', 'changed', 'removed', 'ready', 'updated']

    if (messageType === 'added') {
      this._process_added(msg, updates);
    } else if (messageType === 'changed') {
      this._process_changed(msg, updates);
    } else if (messageType === 'removed') {
      this._process_removed(msg, updates);
    } else if (messageType === 'ready') {
      this._process_ready(msg, updates);
    } else if (messageType === 'updated') {
      this._process_updated(msg, updates);
    } else if (messageType === 'nosub') {// ignore this
    } else {
      Meteor._debug('discarding unknown livedata data message type', msg);
    }
  }

  _livedata_data(msg) {
    const self = this;

    if (self._waitingForQuiescence()) {
      self._messagesBufferedUntilQuiescence.push(msg);

      if (msg.msg === 'nosub') {
        delete self._subsBeingRevived[msg.id];
      }

      if (msg.subs) {
        msg.subs.forEach(subId => {
          delete self._subsBeingRevived[subId];
        });
      }

      if (msg.methods) {
        msg.methods.forEach(methodId => {
          delete self._methodsBlockingQuiescence[methodId];
        });
      }

      if (self._waitingForQuiescence()) {
        return;
      } // No methods or subs are blocking quiescence!
      // We'll now process and all of our buffered messages, reset all stores,
      // and apply them all at once.


      const bufferedMessages = self._messagesBufferedUntilQuiescence;
      Object.values(bufferedMessages).forEach(bufferedMessage => {
        self._processOneDataMessage(bufferedMessage, self._bufferedWrites);
      });
      self._messagesBufferedUntilQuiescence = [];
    } else {
      self._processOneDataMessage(msg, self._bufferedWrites);
    } // Immediately flush writes when:
    //  1. Buffering is disabled. Or;
    //  2. any non-(added/changed/removed) message arrives.


    const standardWrite = msg.msg === "added" || msg.msg === "changed" || msg.msg === "removed";

    if (self._bufferedWritesInterval === 0 || !standardWrite) {
      self._flushBufferedWrites();

      return;
    }

    if (self._bufferedWritesFlushAt === null) {
      self._bufferedWritesFlushAt = new Date().valueOf() + self._bufferedWritesMaxAge;
    } else if (self._bufferedWritesFlushAt < new Date().valueOf()) {
      self._flushBufferedWrites();

      return;
    }

    if (self._bufferedWritesFlushHandle) {
      clearTimeout(self._bufferedWritesFlushHandle);
    }

    self._bufferedWritesFlushHandle = setTimeout(self.__flushBufferedWrites, self._bufferedWritesInterval);
  }

  _flushBufferedWrites() {
    const self = this;

    if (self._bufferedWritesFlushHandle) {
      clearTimeout(self._bufferedWritesFlushHandle);
      self._bufferedWritesFlushHandle = null;
    }

    self._bufferedWritesFlushAt = null; // We need to clear the buffer before passing it to
    //  performWrites. As there's no guarantee that it
    //  will exit cleanly.

    const writes = self._bufferedWrites;
    self._bufferedWrites = Object.create(null);

    self._performWrites(writes);
  }

  _performWrites(updates) {
    const self = this;

    if (self._resetStores || !isEmpty(updates)) {
      // Begin a transactional update of each store.
      Object.entries(self._stores).forEach((_ref4) => {
        let [storeName, store] = _ref4;
        store.beginUpdate(hasOwn.call(updates, storeName) ? updates[storeName].length : 0, self._resetStores);
      });
      self._resetStores = false;
      Object.entries(updates).forEach((_ref5) => {
        let [storeName, updateMessages] = _ref5;
        const store = self._stores[storeName];

        if (store) {
          updateMessages.forEach(updateMessage => {
            store.update(updateMessage);
          });
        } else {
          // Nobody's listening for this data. Queue it up until
          // someone wants it.
          // XXX memory use will grow without bound if you forget to
          // create a collection or just don't care about it... going
          // to have to do something about that.
          const updates = self._updatesForUnknownStores;

          if (!hasOwn.call(updates, storeName)) {
            updates[storeName] = [];
          }

          updates[storeName].push(...updateMessages);
        }
      }); // End update transaction.

      Object.values(self._stores).forEach(store => {
        store.endUpdate();
      });
    }

    self._runAfterUpdateCallbacks();
  } // Call any callbacks deferred with _runWhenAllServerDocsAreFlushed whose
  // relevant docs have been flushed, as well as dataVisible callbacks at
  // reconnect-quiescence time.


  _runAfterUpdateCallbacks() {
    const self = this;
    const callbacks = self._afterUpdateCallbacks;
    self._afterUpdateCallbacks = [];
    callbacks.forEach(c => {
      c();
    });
  }

  _pushUpdate(updates, collection, msg) {
    if (!hasOwn.call(updates, collection)) {
      updates[collection] = [];
    }

    updates[collection].push(msg);
  }

  _getServerDoc(collection, id) {
    const self = this;

    if (!hasOwn.call(self._serverDocuments, collection)) {
      return null;
    }

    const serverDocsForCollection = self._serverDocuments[collection];
    return serverDocsForCollection.get(id) || null;
  }

  _process_added(msg, updates) {
    const self = this;
    const id = MongoID.idParse(msg.id);

    const serverDoc = self._getServerDoc(msg.collection, id);

    if (serverDoc) {
      // Some outstanding stub wrote here.
      const isExisting = serverDoc.document !== undefined;
      serverDoc.document = msg.fields || Object.create(null);
      serverDoc.document._id = id;

      if (self._resetStores) {
        // During reconnect the server is sending adds for existing ids.
        // Always push an update so that document stays in the store after
        // reset. Use current version of the document for this update, so
        // that stub-written values are preserved.
        const currentDoc = self._stores[msg.collection].getDoc(msg.id);

        if (currentDoc !== undefined) msg.fields = currentDoc;

        self._pushUpdate(updates, msg.collection, msg);
      } else if (isExisting) {
        throw new Error('Server sent add for existing id: ' + msg.id);
      }
    } else {
      self._pushUpdate(updates, msg.collection, msg);
    }
  }

  _process_changed(msg, updates) {
    const self = this;

    const serverDoc = self._getServerDoc(msg.collection, MongoID.idParse(msg.id));

    if (serverDoc) {
      if (serverDoc.document === undefined) throw new Error('Server sent changed for nonexisting id: ' + msg.id);
      DiffSequence.applyChanges(serverDoc.document, msg.fields);
    } else {
      self._pushUpdate(updates, msg.collection, msg);
    }
  }

  _process_removed(msg, updates) {
    const self = this;

    const serverDoc = self._getServerDoc(msg.collection, MongoID.idParse(msg.id));

    if (serverDoc) {
      // Some outstanding stub wrote here.
      if (serverDoc.document === undefined) throw new Error('Server sent removed for nonexisting id:' + msg.id);
      serverDoc.document = undefined;
    } else {
      self._pushUpdate(updates, msg.collection, {
        msg: 'removed',
        collection: msg.collection,
        id: msg.id
      });
    }
  }

  _process_updated(msg, updates) {
    const self = this; // Process "method done" messages.

    msg.methods.forEach(methodId => {
      const docs = self._documentsWrittenByStub[methodId] || {};
      Object.values(docs).forEach(written => {
        const serverDoc = self._getServerDoc(written.collection, written.id);

        if (!serverDoc) {
          throw new Error('Lost serverDoc for ' + JSON.stringify(written));
        }

        if (!serverDoc.writtenByStubs[methodId]) {
          throw new Error('Doc ' + JSON.stringify(written) + ' not written by  method ' + methodId);
        }

        delete serverDoc.writtenByStubs[methodId];

        if (isEmpty(serverDoc.writtenByStubs)) {
          // All methods whose stubs wrote this method have completed! We can
          // now copy the saved document to the database (reverting the stub's
          // change if the server did not write to this object, or applying the
          // server's writes if it did).
          // This is a fake ddp 'replace' message.  It's just for talking
          // between livedata connections and minimongo.  (We have to stringify
          // the ID because it's supposed to look like a wire message.)
          self._pushUpdate(updates, written.collection, {
            msg: 'replace',
            id: MongoID.idStringify(written.id),
            replace: serverDoc.document
          }); // Call all flush callbacks.


          serverDoc.flushCallbacks.forEach(c => {
            c();
          }); // Delete this completed serverDocument. Don't bother to GC empty
          // IdMaps inside self._serverDocuments, since there probably aren't
          // many collections and they'll be written repeatedly.

          self._serverDocuments[written.collection].remove(written.id);
        }
      });
      delete self._documentsWrittenByStub[methodId]; // We want to call the data-written callback, but we can't do so until all
      // currently buffered messages are flushed.

      const callbackInvoker = self._methodInvokers[methodId];

      if (!callbackInvoker) {
        throw new Error('No callback invoker for method ' + methodId);
      }

      self._runWhenAllServerDocsAreFlushed(function () {
        return callbackInvoker.dataVisible(...arguments);
      });
    });
  }

  _process_ready(msg, updates) {
    const self = this; // Process "sub ready" messages. "sub ready" messages don't take effect
    // until all current server documents have been flushed to the local
    // database. We can use a write fence to implement this.

    msg.subs.forEach(subId => {
      self._runWhenAllServerDocsAreFlushed(() => {
        const subRecord = self._subscriptions[subId]; // Did we already unsubscribe?

        if (!subRecord) return; // Did we already receive a ready message? (Oops!)

        if (subRecord.ready) return;
        subRecord.ready = true;
        subRecord.readyCallback && subRecord.readyCallback();
        subRecord.readyDeps.changed();
      });
    });
  } // Ensures that "f" will be called after all documents currently in
  // _serverDocuments have been written to the local cache. f will not be called
  // if the connection is lost before then!


  _runWhenAllServerDocsAreFlushed(f) {
    const self = this;

    const runFAfterUpdates = () => {
      self._afterUpdateCallbacks.push(f);
    };

    let unflushedServerDocCount = 0;

    const onServerDocFlush = () => {
      --unflushedServerDocCount;

      if (unflushedServerDocCount === 0) {
        // This was the last doc to flush! Arrange to run f after the updates
        // have been applied.
        runFAfterUpdates();
      }
    };

    Object.values(self._serverDocuments).forEach(serverDocuments => {
      serverDocuments.forEach(serverDoc => {
        const writtenByStubForAMethodWithSentMessage = keys(serverDoc.writtenByStubs).some(methodId => {
          const invoker = self._methodInvokers[methodId];
          return invoker && invoker.sentMessage;
        });

        if (writtenByStubForAMethodWithSentMessage) {
          ++unflushedServerDocCount;
          serverDoc.flushCallbacks.push(onServerDocFlush);
        }
      });
    });

    if (unflushedServerDocCount === 0) {
      // There aren't any buffered docs --- we can call f as soon as the current
      // round of updates is applied!
      runFAfterUpdates();
    }
  }

  _livedata_nosub(msg) {
    const self = this; // First pass it through _livedata_data, which only uses it to help get
    // towards quiescence.

    self._livedata_data(msg); // Do the rest of our processing immediately, with no
    // buffering-until-quiescence.
    // we weren't subbed anyway, or we initiated the unsub.


    if (!hasOwn.call(self._subscriptions, msg.id)) {
      return;
    } // XXX COMPAT WITH 1.0.3.1 #errorCallback


    const errorCallback = self._subscriptions[msg.id].errorCallback;
    const stopCallback = self._subscriptions[msg.id].stopCallback;

    self._subscriptions[msg.id].remove();

    const meteorErrorFromMsg = msgArg => {
      return msgArg && msgArg.error && new Meteor.Error(msgArg.error.error, msgArg.error.reason, msgArg.error.details);
    }; // XXX COMPAT WITH 1.0.3.1 #errorCallback


    if (errorCallback && msg.error) {
      errorCallback(meteorErrorFromMsg(msg));
    }

    if (stopCallback) {
      stopCallback(meteorErrorFromMsg(msg));
    }
  }

  _livedata_result(msg) {
    // id, result or error. error has error (code), reason, details
    const self = this; // Lets make sure there are no buffered writes before returning result.

    if (!isEmpty(self._bufferedWrites)) {
      self._flushBufferedWrites();
    } // find the outstanding request
    // should be O(1) in nearly all realistic use cases


    if (isEmpty(self._outstandingMethodBlocks)) {
      Meteor._debug('Received method result but no methods outstanding');

      return;
    }

    const currentMethodBlock = self._outstandingMethodBlocks[0].methods;
    let i;
    const m = currentMethodBlock.find((method, idx) => {
      const found = method.methodId === msg.id;
      if (found) i = idx;
      return found;
    });

    if (!m) {
      Meteor._debug("Can't match method response to original method call", msg);

      return;
    } // Remove from current method block. This may leave the block empty, but we
    // don't move on to the next block until the callback has been delivered, in
    // _outstandingMethodFinished.


    currentMethodBlock.splice(i, 1);

    if (hasOwn.call(msg, 'error')) {
      m.receiveResult(new Meteor.Error(msg.error.error, msg.error.reason, msg.error.details));
    } else {
      // msg.result may be undefined if the method didn't return a
      // value
      m.receiveResult(undefined, msg.result);
    }
  } // Called by MethodInvoker after a method's callback is invoked.  If this was
  // the last outstanding method in the current block, runs the next block. If
  // there are no more methods, consider accepting a hot code push.


  _outstandingMethodFinished() {
    const self = this;
    if (self._anyMethodsAreOutstanding()) return; // No methods are outstanding. This should mean that the first block of
    // methods is empty. (Or it might not exist, if this was a method that
    // half-finished before disconnect/reconnect.)

    if (!isEmpty(self._outstandingMethodBlocks)) {
      const firstBlock = self._outstandingMethodBlocks.shift();

      if (!isEmpty(firstBlock.methods)) throw new Error('No methods outstanding but nonempty block: ' + JSON.stringify(firstBlock)); // Send the outstanding methods now in the first block.

      if (!isEmpty(self._outstandingMethodBlocks)) self._sendOutstandingMethods();
    } // Maybe accept a hot code push.


    self._maybeMigrate();
  } // Sends messages for all the methods in the first block in
  // _outstandingMethodBlocks.


  _sendOutstandingMethods() {
    const self = this;

    if (isEmpty(self._outstandingMethodBlocks)) {
      return;
    }

    self._outstandingMethodBlocks[0].methods.forEach(m => {
      m.sendMessage();
    });
  }

  _livedata_error(msg) {
    Meteor._debug('Received error from server: ', msg.reason);

    if (msg.offendingMessage) Meteor._debug('For: ', msg.offendingMessage);
  }

  _callOnReconnectAndSendAppropriateOutstandingMethods() {
    const self = this;
    const oldOutstandingMethodBlocks = self._outstandingMethodBlocks;
    self._outstandingMethodBlocks = [];
    self.onReconnect && self.onReconnect();

    DDP._reconnectHook.each(callback => {
      callback(self);
      return true;
    });

    if (isEmpty(oldOutstandingMethodBlocks)) return; // We have at least one block worth of old outstanding methods to try
    // again. First: did onReconnect actually send anything? If not, we just
    // restore all outstanding methods and run the first block.

    if (isEmpty(self._outstandingMethodBlocks)) {
      self._outstandingMethodBlocks = oldOutstandingMethodBlocks;

      self._sendOutstandingMethods();

      return;
    } // OK, there are blocks on both sides. Special case: merge the last block of
    // the reconnect methods with the first block of the original methods, if
    // neither of them are "wait" blocks.


    if (!last(self._outstandingMethodBlocks).wait && !oldOutstandingMethodBlocks[0].wait) {
      oldOutstandingMethodBlocks[0].methods.forEach(m => {
        last(self._outstandingMethodBlocks).methods.push(m); // If this "last block" is also the first block, send the message.

        if (self._outstandingMethodBlocks.length === 1) {
          m.sendMessage();
        }
      });
      oldOutstandingMethodBlocks.shift();
    } // Now add the rest of the original blocks on.


    self._outstandingMethodBlocks.push(...oldOutstandingMethodBlocks);
  } // We can accept a hot code push if there are no methods in flight.


  _readyToMigrate() {
    return isEmpty(this._methodInvokers);
  } // If we were blocking a migration, see if it's now possible to continue.
  // Call whenever the set of outstanding/blocked methods shrinks.


  _maybeMigrate() {
    const self = this;

    if (self._retryMigrate && self._readyToMigrate()) {
      self._retryMigrate();

      self._retryMigrate = null;
    }
  }

  onMessage(raw_msg) {
    let msg;

    try {
      msg = DDPCommon.parseDDP(raw_msg);
    } catch (e) {
      Meteor._debug('Exception while parsing DDP', e);

      return;
    } // Any message counts as receiving a pong, as it demonstrates that
    // the server is still alive.


    if (this._heartbeat) {
      this._heartbeat.messageReceived();
    }

    if (msg === null || !msg.msg) {
      // XXX COMPAT WITH 0.6.6. ignore the old welcome message for back
      // compat.  Remove this 'if' once the server stops sending welcome
      // messages (stream_server.js).
      if (!(msg && msg.server_id)) Meteor._debug('discarding invalid livedata message', msg);
      return;
    }

    if (msg.msg === 'connected') {
      this._version = this._versionSuggestion;

      this._livedata_connected(msg);

      this.options.onConnected();
    } else if (msg.msg === 'failed') {
      if (this._supportedDDPVersions.indexOf(msg.version) >= 0) {
        this._versionSuggestion = msg.version;

        this._stream.reconnect({
          _force: true
        });
      } else {
        const description = 'DDP version negotiation failed; server requested version ' + msg.version;

        this._stream.disconnect({
          _permanent: true,
          _error: description
        });

        this.options.onDDPVersionNegotiationFailure(description);
      }
    } else if (msg.msg === 'ping' && this.options.respondToPings) {
      this._send({
        msg: 'pong',
        id: msg.id
      });
    } else if (msg.msg === 'pong') {// noop, as we assume everything's a pong
    } else if (['added', 'changed', 'removed', 'ready', 'updated'].includes(msg.msg)) {
      this._livedata_data(msg);
    } else if (msg.msg === 'nosub') {
      this._livedata_nosub(msg);
    } else if (msg.msg === 'result') {
      this._livedata_result(msg);
    } else if (msg.msg === 'error') {
      this._livedata_error(msg);
    } else {
      Meteor._debug('discarding unknown livedata message type', msg);
    }
  }

  onReset() {
    // Send a connect message at the beginning of the stream.
    // NOTE: reset is called even on the first connection, so this is
    // the only place we send this message.
    const msg = {
      msg: 'connect'
    };
    if (this._lastSessionId) msg.session = this._lastSessionId;
    msg.version = this._versionSuggestion || this._supportedDDPVersions[0];
    this._versionSuggestion = msg.version;
    msg.support = this._supportedDDPVersions;

    this._send(msg); // Mark non-retry calls as failed. This has to be done early as getting these methods out of the
    // current block is pretty important to making sure that quiescence is properly calculated, as
    // well as possibly moving on to another useful block.
    // Only bother testing if there is an outstandingMethodBlock (there might not be, especially if
    // we are connecting for the first time.


    if (this._outstandingMethodBlocks.length > 0) {
      // If there is an outstanding method block, we only care about the first one as that is the
      // one that could have already sent messages with no response, that are not allowed to retry.
      const currentMethodBlock = this._outstandingMethodBlocks[0].methods;
      this._outstandingMethodBlocks[0].methods = currentMethodBlock.filter(methodInvoker => {
        // Methods with 'noRetry' option set are not allowed to re-send after
        // recovering dropped connection.
        if (methodInvoker.sentMessage && methodInvoker.noRetry) {
          // Make sure that the method is told that it failed.
          methodInvoker.receiveResult(new Meteor.Error('invocation-failed', 'Method invocation might have failed due to dropped connection. ' + 'Failing because `noRetry` option was passed to Meteor.apply.'));
        } // Only keep a method if it wasn't sent or it's allowed to retry.
        // This may leave the block empty, but we don't move on to the next
        // block until the callback has been delivered, in _outstandingMethodFinished.


        return !(methodInvoker.sentMessage && methodInvoker.noRetry);
      });
    } // Now, to minimize setup latency, go ahead and blast out all of
    // our pending methods ands subscriptions before we've even taken
    // the necessary RTT to know if we successfully reconnected. (1)
    // They're supposed to be idempotent, and where they are not,
    // they can block retry in apply; (2) even if we did reconnect,
    // we're not sure what messages might have gotten lost
    // (in either direction) since we were disconnected (TCP being
    // sloppy about that.)
    // If the current block of methods all got their results (but didn't all get
    // their data visible), discard the empty block now.


    if (this._outstandingMethodBlocks.length > 0 && this._outstandingMethodBlocks[0].methods.length === 0) {
      this._outstandingMethodBlocks.shift();
    } // Mark all messages as unsent, they have not yet been sent on this
    // connection.


    keys(this._methodInvokers).forEach(id => {
      this._methodInvokers[id].sentMessage = false;
    }); // If an `onReconnect` handler is set, call it first. Go through
    // some hoops to ensure that methods that are called from within
    // `onReconnect` get executed _before_ ones that were originally
    // outstanding (since `onReconnect` is used to re-establish auth
    // certificates)

    this._callOnReconnectAndSendAppropriateOutstandingMethods(); // add new subscriptions at the end. this way they take effect after
    // the handlers and we don't see flicker.


    Object.entries(this._subscriptions).forEach((_ref6) => {
      let [id, sub] = _ref6;

      this._send({
        msg: 'sub',
        id: id,
        name: sub.name,
        params: sub.params
      });
    });
  }

}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"namespace.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/ddp-client/common/namespace.js                                                                             //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
  DDP: () => DDP
});
let DDPCommon;
module.link("meteor/ddp-common", {
  DDPCommon(v) {
    DDPCommon = v;
  }

}, 0);
let Meteor;
module.link("meteor/meteor", {
  Meteor(v) {
    Meteor = v;
  }

}, 1);
let keys;
module.link("meteor/ddp-common/utils.js", {
  keys(v) {
    keys = v;
  }

}, 2);
let Connection;
module.link("./livedata_connection.js", {
  Connection(v) {
    Connection = v;
  }

}, 3);
// This array allows the `_allSubscriptionsReady` method below, which
// is used by the `spiderable` package, to keep track of whether all
// data is ready.
const allConnections = [];
/**
 * @namespace DDP
 * @summary Namespace for DDP-related methods/classes.
 */

const DDP = {};
// This is private but it's used in a few places. accounts-base uses
// it to get the current user. Meteor.setTimeout and friends clear
// it. We can probably find a better way to factor this.
DDP._CurrentMethodInvocation = new Meteor.EnvironmentVariable();
DDP._CurrentPublicationInvocation = new Meteor.EnvironmentVariable(); // XXX: Keep DDP._CurrentInvocation for backwards-compatibility.

DDP._CurrentInvocation = DDP._CurrentMethodInvocation; // This is passed into a weird `makeErrorType` function that expects its thing
// to be a constructor

function connectionErrorConstructor(message) {
  this.message = message;
}

DDP.ConnectionError = Meteor.makeErrorType('DDP.ConnectionError', connectionErrorConstructor);
DDP.ForcedReconnectError = Meteor.makeErrorType('DDP.ForcedReconnectError', () => {}); // Returns the named sequence of pseudo-random values.
// The scope will be DDP._CurrentMethodInvocation.get(), so the stream will produce
// consistent values for method calls on the client and server.

DDP.randomStream = name => {
  const scope = DDP._CurrentMethodInvocation.get();

  return DDPCommon.RandomStream.get(scope, name);
}; // @param url {String} URL to Meteor app,
//     e.g.:
//     "subdomain.meteor.com",
//     "http://subdomain.meteor.com",
//     "/",
//     "ddp+sockjs://ddp--****-foo.meteor.com/sockjs"

/**
 * @summary Connect to the server of a different Meteor application to subscribe to its document sets and invoke its remote methods.
 * @locus Anywhere
 * @param {String} url The URL of another Meteor application.
 */


DDP.connect = (url, options) => {
  const ret = new Connection(url, options);
  allConnections.push(ret); // hack. see below.

  return ret;
};

DDP._reconnectHook = new Hook({
  bindEnvironment: false
});
/**
 * @summary Register a function to call as the first step of
 * reconnecting. This function can call methods which will be executed before
 * any other outstanding methods. For example, this can be used to re-establish
 * the appropriate authentication context on the connection.
 * @locus Anywhere
 * @param {Function} callback The function to call. It will be called with a
 * single argument, the [connection object](#ddp_connect) that is reconnecting.
 */

DDP.onReconnect = callback => DDP._reconnectHook.register(callback); // Hack for `spiderable` package: a way to see if the page is done
// loading all the data it needs.
//


DDP._allSubscriptionsReady = () => allConnections.every(conn => Object.values(conn._subscriptions).every(sub => sub.ready));
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});

var exports = require("/node_modules/meteor/ddp-client/server/server.js");

/* Exports */
Package._define("ddp-client", exports, {
  DDP: DDP
});

})();

//# sourceURL=meteor://💻app/packages/ddp-client.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvZGRwLWNsaWVudC9zZXJ2ZXIvc2VydmVyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9kZHAtY2xpZW50L2NvbW1vbi9NZXRob2RJbnZva2VyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9kZHAtY2xpZW50L2NvbW1vbi9saXZlZGF0YV9jb25uZWN0aW9uLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9kZHAtY2xpZW50L2NvbW1vbi9uYW1lc3BhY2UuanMiXSwibmFtZXMiOlsibW9kdWxlIiwibGluayIsIkREUCIsImV4cG9ydCIsImRlZmF1bHQiLCJNZXRob2RJbnZva2VyIiwiY29uc3RydWN0b3IiLCJvcHRpb25zIiwibWV0aG9kSWQiLCJzZW50TWVzc2FnZSIsIl9jYWxsYmFjayIsImNhbGxiYWNrIiwiX2Nvbm5lY3Rpb24iLCJjb25uZWN0aW9uIiwiX21lc3NhZ2UiLCJtZXNzYWdlIiwiX29uUmVzdWx0UmVjZWl2ZWQiLCJvblJlc3VsdFJlY2VpdmVkIiwiX3dhaXQiLCJ3YWl0Iiwibm9SZXRyeSIsIl9tZXRob2RSZXN1bHQiLCJfZGF0YVZpc2libGUiLCJfbWV0aG9kSW52b2tlcnMiLCJzZW5kTWVzc2FnZSIsImdvdFJlc3VsdCIsIkVycm9yIiwiX21ldGhvZHNCbG9ja2luZ1F1aWVzY2VuY2UiLCJfc2VuZCIsIl9tYXliZUludm9rZUNhbGxiYWNrIiwiX291dHN0YW5kaW5nTWV0aG9kRmluaXNoZWQiLCJyZWNlaXZlUmVzdWx0IiwiZXJyIiwicmVzdWx0IiwiZGF0YVZpc2libGUiLCJfb2JqZWN0U3ByZWFkIiwidiIsIkNvbm5lY3Rpb24iLCJNZXRlb3IiLCJERFBDb21tb24iLCJUcmFja2VyIiwiRUpTT04iLCJSYW5kb20iLCJIb29rIiwiTW9uZ29JRCIsImhhc093biIsInNsaWNlIiwia2V5cyIsImlzRW1wdHkiLCJsYXN0IiwiRmliZXIiLCJGdXR1cmUiLCJpc1NlcnZlciIsIk5wbSIsInJlcXVpcmUiLCJNb25nb0lETWFwIiwiSWRNYXAiLCJpZFN0cmluZ2lmeSIsImlkUGFyc2UiLCJ1cmwiLCJzZWxmIiwib25Db25uZWN0ZWQiLCJvbkREUFZlcnNpb25OZWdvdGlhdGlvbkZhaWx1cmUiLCJkZXNjcmlwdGlvbiIsIl9kZWJ1ZyIsImhlYXJ0YmVhdEludGVydmFsIiwiaGVhcnRiZWF0VGltZW91dCIsIm5wbUZheWVPcHRpb25zIiwiT2JqZWN0IiwiY3JlYXRlIiwicmVsb2FkV2l0aE91dHN0YW5kaW5nIiwic3VwcG9ydGVkRERQVmVyc2lvbnMiLCJTVVBQT1JURURfRERQX1ZFUlNJT05TIiwicmV0cnkiLCJyZXNwb25kVG9QaW5ncyIsImJ1ZmZlcmVkV3JpdGVzSW50ZXJ2YWwiLCJidWZmZXJlZFdyaXRlc01heEFnZSIsIm9uUmVjb25uZWN0IiwiX3N0cmVhbSIsIkNsaWVudFN0cmVhbSIsIkNvbm5lY3Rpb25FcnJvciIsImhlYWRlcnMiLCJfc29ja2pzT3B0aW9ucyIsIl9kb250UHJpbnRFcnJvcnMiLCJjb25uZWN0VGltZW91dE1zIiwiX2xhc3RTZXNzaW9uSWQiLCJfdmVyc2lvblN1Z2dlc3Rpb24iLCJfdmVyc2lvbiIsIl9zdG9yZXMiLCJfbWV0aG9kSGFuZGxlcnMiLCJfbmV4dE1ldGhvZElkIiwiX3N1cHBvcnRlZEREUFZlcnNpb25zIiwiX2hlYXJ0YmVhdEludGVydmFsIiwiX2hlYXJ0YmVhdFRpbWVvdXQiLCJfb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MiLCJfZG9jdW1lbnRzV3JpdHRlbkJ5U3R1YiIsIl9zZXJ2ZXJEb2N1bWVudHMiLCJfYWZ0ZXJVcGRhdGVDYWxsYmFja3MiLCJfbWVzc2FnZXNCdWZmZXJlZFVudGlsUXVpZXNjZW5jZSIsIl9zdWJzQmVpbmdSZXZpdmVkIiwiX3Jlc2V0U3RvcmVzIiwiX3VwZGF0ZXNGb3JVbmtub3duU3RvcmVzIiwiX3JldHJ5TWlncmF0ZSIsIl9fZmx1c2hCdWZmZXJlZFdyaXRlcyIsImJpbmRFbnZpcm9ubWVudCIsIl9mbHVzaEJ1ZmZlcmVkV3JpdGVzIiwiX2J1ZmZlcmVkV3JpdGVzIiwiX2J1ZmZlcmVkV3JpdGVzRmx1c2hBdCIsIl9idWZmZXJlZFdyaXRlc0ZsdXNoSGFuZGxlIiwiX2J1ZmZlcmVkV3JpdGVzSW50ZXJ2YWwiLCJfYnVmZmVyZWRXcml0ZXNNYXhBZ2UiLCJfc3Vic2NyaXB0aW9ucyIsIl91c2VySWQiLCJfdXNlcklkRGVwcyIsIkRlcGVuZGVuY3kiLCJpc0NsaWVudCIsIlBhY2thZ2UiLCJyZWxvYWQiLCJSZWxvYWQiLCJfb25NaWdyYXRlIiwiX3JlYWR5VG9NaWdyYXRlIiwib25EaXNjb25uZWN0IiwiX2hlYXJ0YmVhdCIsInN0b3AiLCJvbiIsIm9uTWVzc2FnZSIsImJpbmQiLCJvblJlc2V0IiwicmVnaXN0ZXJTdG9yZSIsIm5hbWUiLCJ3cmFwcGVkU3RvcmUiLCJzdG9yZSIsImtleXNPZlN0b3JlIiwiZm9yRWFjaCIsIm1ldGhvZCIsInF1ZXVlZCIsIkFycmF5IiwiaXNBcnJheSIsImJlZ2luVXBkYXRlIiwibGVuZ3RoIiwibXNnIiwidXBkYXRlIiwiZW5kVXBkYXRlIiwic3Vic2NyaWJlIiwicGFyYW1zIiwiY2FsbCIsImFyZ3VtZW50cyIsImNhbGxiYWNrcyIsImxhc3RQYXJhbSIsIm9uUmVhZHkiLCJwb3AiLCJvbkVycm9yIiwib25TdG9wIiwic29tZSIsImYiLCJleGlzdGluZyIsInZhbHVlcyIsImZpbmQiLCJzdWIiLCJpbmFjdGl2ZSIsImVxdWFscyIsImlkIiwicmVhZHkiLCJyZWFkeUNhbGxiYWNrIiwiZXJyb3JDYWxsYmFjayIsInN0b3BDYWxsYmFjayIsImNsb25lIiwicmVhZHlEZXBzIiwicmVtb3ZlIiwiY2hhbmdlZCIsImhhbmRsZSIsInJlY29yZCIsImRlcGVuZCIsInN1YnNjcmlwdGlvbklkIiwiYWN0aXZlIiwib25JbnZhbGlkYXRlIiwiYyIsImFmdGVyRmx1c2giLCJfc3Vic2NyaWJlQW5kV2FpdCIsImFyZ3MiLCJwdXNoIiwiZSIsIm9uTGF0ZUVycm9yIiwiYXBwbHkiLCJjb25jYXQiLCJtZXRob2RzIiwiZW50cmllcyIsImZ1bmMiLCJlbmNsb3NpbmciLCJfQ3VycmVudE1ldGhvZEludm9jYXRpb24iLCJnZXQiLCJhbHJlYWR5SW5TaW11bGF0aW9uIiwiaXNTaW11bGF0aW9uIiwicmFuZG9tU2VlZCIsInJhbmRvbVNlZWRHZW5lcmF0b3IiLCJtYWtlUnBjU2VlZCIsInN0dWJSZXR1cm5WYWx1ZSIsImV4Y2VwdGlvbiIsInN0dWIiLCJzZXRVc2VySWQiLCJ1c2VySWQiLCJpbnZvY2F0aW9uIiwiTWV0aG9kSW52b2NhdGlvbiIsIl9zYXZlT3JpZ2luYWxzIiwid2l0aFZhbHVlIiwiX25vWWllbGRzQWxsb3dlZCIsInVuZGVmaW5lZCIsIl9yZXRyaWV2ZUFuZFN0b3JlT3JpZ2luYWxzIiwidGhyb3dTdHViRXhjZXB0aW9ucyIsIl9leHBlY3RlZEJ5VGVzdCIsImZ1dHVyZSIsInJlc29sdmVyIiwibWV0aG9kSW52b2tlciIsInJldHVyblN0dWJWYWx1ZSIsIl93YWl0aW5nRm9yUXVpZXNjZW5jZSIsInNhdmVPcmlnaW5hbHMiLCJkb2NzV3JpdHRlbiIsImNvbGxlY3Rpb24iLCJvcmlnaW5hbHMiLCJyZXRyaWV2ZU9yaWdpbmFscyIsImRvYyIsInNlcnZlckRvYyIsInNldERlZmF1bHQiLCJ3cml0dGVuQnlTdHVicyIsImRvY3VtZW50IiwiZmx1c2hDYWxsYmFja3MiLCJfdW5zdWJzY3JpYmVBbGwiLCJvYmoiLCJzZW5kIiwic3RyaW5naWZ5RERQIiwiX2xvc3RDb25uZWN0aW9uIiwiZXJyb3IiLCJzdGF0dXMiLCJyZWNvbm5lY3QiLCJkaXNjb25uZWN0IiwiY2xvc2UiLCJfcGVybWFuZW50IiwiX2FueU1ldGhvZHNBcmVPdXRzdGFuZGluZyIsImludm9rZXJzIiwiaW52b2tlciIsIl9saXZlZGF0YV9jb25uZWN0ZWQiLCJIZWFydGJlYXQiLCJvblRpbWVvdXQiLCJzZW5kUGluZyIsInN0YXJ0IiwicmVjb25uZWN0ZWRUb1ByZXZpb3VzU2Vzc2lvbiIsInNlc3Npb24iLCJfcnVuQWZ0ZXJVcGRhdGVDYWxsYmFja3MiLCJfcHJvY2Vzc09uZURhdGFNZXNzYWdlIiwidXBkYXRlcyIsIm1lc3NhZ2VUeXBlIiwiX3Byb2Nlc3NfYWRkZWQiLCJfcHJvY2Vzc19jaGFuZ2VkIiwiX3Byb2Nlc3NfcmVtb3ZlZCIsIl9wcm9jZXNzX3JlYWR5IiwiX3Byb2Nlc3NfdXBkYXRlZCIsIl9saXZlZGF0YV9kYXRhIiwic3VicyIsInN1YklkIiwiYnVmZmVyZWRNZXNzYWdlcyIsImJ1ZmZlcmVkTWVzc2FnZSIsInN0YW5kYXJkV3JpdGUiLCJEYXRlIiwidmFsdWVPZiIsImNsZWFyVGltZW91dCIsInNldFRpbWVvdXQiLCJ3cml0ZXMiLCJfcGVyZm9ybVdyaXRlcyIsInN0b3JlTmFtZSIsInVwZGF0ZU1lc3NhZ2VzIiwidXBkYXRlTWVzc2FnZSIsIl9wdXNoVXBkYXRlIiwiX2dldFNlcnZlckRvYyIsInNlcnZlckRvY3NGb3JDb2xsZWN0aW9uIiwiaXNFeGlzdGluZyIsImZpZWxkcyIsIl9pZCIsImN1cnJlbnREb2MiLCJnZXREb2MiLCJEaWZmU2VxdWVuY2UiLCJhcHBseUNoYW5nZXMiLCJkb2NzIiwid3JpdHRlbiIsIkpTT04iLCJzdHJpbmdpZnkiLCJyZXBsYWNlIiwiY2FsbGJhY2tJbnZva2VyIiwiX3J1bldoZW5BbGxTZXJ2ZXJEb2NzQXJlRmx1c2hlZCIsInN1YlJlY29yZCIsInJ1bkZBZnRlclVwZGF0ZXMiLCJ1bmZsdXNoZWRTZXJ2ZXJEb2NDb3VudCIsIm9uU2VydmVyRG9jRmx1c2giLCJzZXJ2ZXJEb2N1bWVudHMiLCJ3cml0dGVuQnlTdHViRm9yQU1ldGhvZFdpdGhTZW50TWVzc2FnZSIsIl9saXZlZGF0YV9ub3N1YiIsIm1ldGVvckVycm9yRnJvbU1zZyIsIm1zZ0FyZyIsInJlYXNvbiIsImRldGFpbHMiLCJfbGl2ZWRhdGFfcmVzdWx0IiwiY3VycmVudE1ldGhvZEJsb2NrIiwiaSIsIm0iLCJpZHgiLCJmb3VuZCIsInNwbGljZSIsImZpcnN0QmxvY2siLCJzaGlmdCIsIl9zZW5kT3V0c3RhbmRpbmdNZXRob2RzIiwiX21heWJlTWlncmF0ZSIsIl9saXZlZGF0YV9lcnJvciIsIm9mZmVuZGluZ01lc3NhZ2UiLCJfY2FsbE9uUmVjb25uZWN0QW5kU2VuZEFwcHJvcHJpYXRlT3V0c3RhbmRpbmdNZXRob2RzIiwib2xkT3V0c3RhbmRpbmdNZXRob2RCbG9ja3MiLCJfcmVjb25uZWN0SG9vayIsImVhY2giLCJyYXdfbXNnIiwicGFyc2VERFAiLCJtZXNzYWdlUmVjZWl2ZWQiLCJzZXJ2ZXJfaWQiLCJpbmRleE9mIiwidmVyc2lvbiIsIl9mb3JjZSIsIl9lcnJvciIsImluY2x1ZGVzIiwic3VwcG9ydCIsImZpbHRlciIsImFsbENvbm5lY3Rpb25zIiwiRW52aXJvbm1lbnRWYXJpYWJsZSIsIl9DdXJyZW50UHVibGljYXRpb25JbnZvY2F0aW9uIiwiX0N1cnJlbnRJbnZvY2F0aW9uIiwiY29ubmVjdGlvbkVycm9yQ29uc3RydWN0b3IiLCJtYWtlRXJyb3JUeXBlIiwiRm9yY2VkUmVjb25uZWN0RXJyb3IiLCJyYW5kb21TdHJlYW0iLCJzY29wZSIsIlJhbmRvbVN0cmVhbSIsImNvbm5lY3QiLCJyZXQiLCJyZWdpc3RlciIsIl9hbGxTdWJzY3JpcHRpb25zUmVhZHkiLCJldmVyeSIsImNvbm4iXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBQSxNQUFNLENBQUNDLElBQVAsQ0FBWSx3QkFBWixFQUFxQztBQUFDQyxLQUFHLEVBQUM7QUFBTCxDQUFyQyxFQUFpRCxDQUFqRCxFOzs7Ozs7Ozs7OztBQ0FBRixNQUFNLENBQUNHLE1BQVAsQ0FBYztBQUFDQyxTQUFPLEVBQUMsTUFBSUM7QUFBYixDQUFkOztBQUtlLE1BQU1BLGFBQU4sQ0FBb0I7QUFDakNDLGFBQVcsQ0FBQ0MsT0FBRCxFQUFVO0FBQ25CO0FBQ0EsU0FBS0MsUUFBTCxHQUFnQkQsT0FBTyxDQUFDQyxRQUF4QjtBQUNBLFNBQUtDLFdBQUwsR0FBbUIsS0FBbkI7QUFFQSxTQUFLQyxTQUFM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QUFxQixJQUFJL1EsSUFBSixDQUFTO0FBQUU2RCxpQkFBZSxFQUFFO0FBQW5CLENBQVQsQ0FBckI7QUFFQTs7Ozs7Ozs7OztBQVNBdEcsR0FBRyxDQUFDMkUsV0FBSixHQUFrQmxFLFFBQVEsSUFBSVQsR0FBRyxDQUFDd1QsY0FBSixDQUFtQnlCLFFBQW5CLENBQTRCeFUsUUFBNUIsQ0FBOUIsQyxDQUVBO0FBQ0E7QUFDQTs7O0FBQ0FULEdBQUcsQ0FBQ2tWLHNCQUFKLEdBQTZCLE1BQU1iLGNBQWMsQ0FBQ2MsS0FBZixDQUNqQ0MsSUFBSSxJQUFJbFIsTUFBTSxDQUFDd0YsTUFBUCxDQUFjMEwsSUFBSSxDQUFDdk8sY0FBbkIsRUFBbUNzTyxLQUFuQyxDQUF5Q3ZMLEdBQUcsSUFBSUEsR0FBRyxDQUFDSSxLQUFwRCxDQUR5QixDQUFuQyxDIiwiZmlsZSI6Ii9wYWNrYWdlcy9kZHAtY2xpZW50LmpzIiwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IHsgRERQIH0gZnJvbSAnLi4vY29tbW9uL25hbWVzcGFjZS5qcyc7XG4iLCIvLyBBIE1ldGhvZEludm9rZXIgbWFuYWdlcyBzZW5kaW5nIGEgbWV0aG9kIHRvIHRoZSBzZXJ2ZXIgYW5kIGNhbGxpbmcgdGhlIHVzZXInc1xuLy8gY2FsbGJhY2tzLiBPbiBjb25zdHJ1Y3Rpb24sIGl0IHJlZ2lzdGVycyBpdHNlbGYgaW4gdGhlIGNvbm5lY3Rpb24nc1xuLy8gX21ldGhvZEludm9rZXJzIG1hcDsgaXQgcmVtb3ZlcyBpdHNlbGYgb25jZSB0aGUgbWV0aG9kIGlzIGZ1bGx5IGZpbmlzaGVkIGFuZFxuLy8gdGhlIGNhbGxiYWNrIGlzIGludm9rZWQuIFRoaXMgb2NjdXJzIHdoZW4gaXQgaGFzIGJvdGggcmVjZWl2ZWQgYSByZXN1bHQsXG4vLyBhbmQgdGhlIGRhdGEgd3JpdHRlbiBieSBpdCBpcyBmdWxseSB2aXNpYmxlLlxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgTWV0aG9kSW52b2tlciB7XG4gIGNvbnN0cnVjdG9yKG9wdGlvbnMpIHtcbiAgICAvLyBQdWJsaWMgKHdpdGhpbiB0aGlzIGZpbGUpIGZpZWxkcy5cbiAgICB0aGlzLm1ldGhvZElkID0gb3B0aW9ucy5tZXRob2RJZDtcbiAgICB0aGlzLnNlbnRNZXNzYWdlID0gZmFsc2U7XG5cbiAgICB0aGlzLl9jYWxsYmFjayA9IG9wdGlvbnMuY2FsbGJhY2s7XG4gICAgdGhpcy5fY29ubmVjdGlvbiA9IG9wdGlvbnMuY29ubmVjdGlvbjtcbiAgICB0aGlzLl9tZXNzYWdlID0gb3B0aW9ucy5tZXNzYWdlO1xuICAgIHRoaXMuX29uUmVzdWx0UmVjZWl2ZWQgPSBvcHRpb25zLm9uUmVzdWx0UmVjZWl2ZWQgfHwgKCgpID0+IHt9KTtcbiAgICB0aGlzLl93YWl0ID0gb3B0aW9ucy53YWl0O1xuICAgIHRoaXMubm9SZXRyeSA9IG9wdGlvbnMubm9SZXRyeTtcbiAgICB0aGlzLl9tZXRob2RSZXN1bHQgPSBudWxsO1xuICAgIHRoaXMuX2RhdGFWaXNpYmxlID0gZmFsc2U7XG5cbiAgICAvLyBSZWdpc3RlciB3aXRoIHRoZSBjb25uZWN0aW9uLlxuICAgIHRoaXMuX2Nvbm5lY3Rpb24uX21ldGhvZEludm9rZXJzW3RoaXMubWV0aG9kSWRdID0gdGhpcztcbiAgfVxuICAvLyBTZW5kcyB0aGUgbWV0aG9kIG1lc3NhZ2UgdG8gdGhlIHNlcnZlci4gTWF5IGJlIGNhbGxlZCBhZGRpdGlvbmFsIHRpbWVzIGlmXG4gIC8vIHdlIGxvc2UgdGhlIGNvbm5lY3Rpb24gYW5kIHJlY29ubmVjdCBiZWZvcmUgcmVjZWl2aW5nIGEgcmVzdWx0LlxuICBzZW5kTWVzc2FnZSgpIHtcbiAgICAvLyBUaGlzIGZ1bmN0aW9uIGlzIGNhbGxlZCBiZWZvcmUgc2VuZGluZyBhIG1ldGhvZCAoaW5jbHVkaW5nIHJlc2VuZGluZyBvblxuICAgIC8vIHJlY29ubmVjdCkuIFdlIHNob3VsZCBvbmx5IChyZSlzZW5kIG1ldGhvZHMgd2hlcmUgd2UgZG9uJ3QgYWxyZWFkeSBoYXZlIGFcbiAgICAvLyByZXN1bHQhXG4gICAgaWYgKHRoaXMuZ290UmVzdWx0KCkpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3NlbmRpbmdNZXRob2QgaXMgY2FsbGVkIG9uIG1ldGhvZCB3aXRoIHJlc3VsdCcpO1xuXG4gICAgLy8gSWYgd2UncmUgcmUtc2VuZGluZyBpdCwgaXQgZG9lc24ndCBtYXR0ZXIgaWYgZGF0YSB3YXMgd3JpdHRlbiB0aGUgZmlyc3RcbiAgICAvLyB0aW1lLlxuICAgIHRoaXMuX2RhdGFWaXNpYmxlID0gZmFsc2U7XG4gICAgdGhpcy5zZW50TWVzc2FnZSA9IHRydWU7XG5cbiAgICAvLyBJZiB0aGlzIGlzIGEgd2FpdCBtZXRob2QsIG1ha2UgYWxsIGRhdGEgbWVzc2FnZXMgYmUgYnVmZmVyZWQgdW50aWwgaXQgaXNcbiAgICAvLyBkb25lLlxuICAgIGlmICh0aGlzLl93YWl0KVxuICAgICAgdGhpcy5fY29ubmVjdGlvbi5fbWV0aG9kc0Jsb2NraW5nUXVpZXNjZW5jZVt0aGlzLm1ldGhvZElkXSA9IHRydWU7XG5cbiAgICAvLyBBY3R1YWxseSBzZW5kIHRoZSBtZXNzYWdlLlxuICAgIHRoaXMuX2Nvbm5lY3Rpb24uX3NlbmQodGhpcy5fbWVzc2FnZSk7XG4gIH1cbiAgLy8gSW52b2tlIHRoZSBjYWxsYmFjaywgaWYgd2UgaGF2ZSBib3RoIGEgcmVzdWx0IGFuZCBrbm93IHRoYXQgYWxsIGRhdGEgaGFzXG4gIC8vIGJlZW4gd3JpdHRlbiB0byB0aGUgbG9jYWwgY2FjaGUuXG4gIF9tYXliZUludm9rZUNhbGxiYWNrKCkge1xuICAgIGlmICh0aGlzLl9tZXRob2RSZXN1bHQgJiYgdGhpcy5fZGF0YVZpc2libGUpIHtcbiAgICAgIC8vIENhbGwgdGhlIGNhbGxiYWNrLiAoVGhpcyB3b24ndCB0aHJvdzogdGhlIGNhbGxiYWNrIHdhcyB3cmFwcGVkIHdpdGhcbiAgICAgIC8vIGJpbmRFbnZpcm9ubWVudC4pXG4gICAgICB0aGlzLl9jYWxsYmFjayh0aGlzLl9tZXRob2RSZXN1bHRbMF0sIHRoaXMuX21ldGhvZFJlc3VsdFsxXSk7XG5cbiAgICAgIC8vIEZvcmdldCBhYm91dCB0aGlzIG1ldGhvZC5cbiAgICAgIGRlbGV0ZSB0aGlzLl9jb25uZWN0aW9uLl9tZXRob2RJbnZva2Vyc1t0aGlzLm1ldGhvZElkXTtcblxuICAgICAgLy8gTGV0IHRoZSBjb25uZWN0aW9uIGtub3cgdGhhdCB0aGlzIG1ldGhvZCBpcyBmaW5pc2hlZCwgc28gaXQgY2FuIHRyeSB0b1xuICAgICAgLy8gbW92ZSBvbiB0byB0aGUgbmV4dCBibG9jayBvZiBtZXRob2RzLlxuICAgICAgdGhpcy5fY29ubmVjdGlvbi5fb3V0c3RhbmRpbmdNZXRob2RGaW5pc2hlZCgpO1xuICAgIH1cbiAgfVxuICAvLyBDYWxsIHdpdGggdGhlIHJlc3VsdCBvZiB0aGUgbWV0aG9kIGZyb20gdGhlIHNlcnZlci4gT25seSBtYXkgYmUgY2FsbGVkXG4gIC8vIG9uY2U7IG9uY2UgaXQgaXMgY2FsbGVkLCB5b3Ugc2hvdWxkIG5vdCBjYWxsIHNlbmRNZXNzYWdlIGFnYWluLlxuICAvLyBJZiB0aGUgdXNlciBwcm92aWRlZCBhbiBvblJlc3VsdFJlY2VpdmVkIGNhbGxiYWNrLCBjYWxsIGl0IGltbWVkaWF0ZWx5LlxuICAvLyBUaGVuIGludm9rZSB0aGUgbWFpbiBjYWxsYmFjayBpZiBkYXRhIGlzIGFsc28gdmlzaWJsZS5cbiAgcmVjZWl2ZVJlc3VsdChlcnIsIHJlc3VsdCkge1xuICAgIGlmICh0aGlzLmdvdFJlc3VsdCgpKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdNZXRob2RzIHNob3VsZCBvbmx5IHJlY2VpdmUgcmVzdWx0cyBvbmNlJyk7XG4gICAgdGhpcy5fbWV0aG9kUmVzdWx0ID0gW2VyciwgcmVzdWx0XTtcbiAgICB0aGlzLl9vblJlc3VsdFJlY2VpdmVkKGVyciwgcmVzdWx0KTtcbiAgICB0aGlzLl9tYXliZUludm9rZUNhbGxiYWNrKCk7XG4gIH1cbiAgLy8gQ2FsbCB0aGlzIHdoZW4gYWxsIGRhdGEgd3JpdHRlbiBieSB0aGUgbWV0aG9kIGlzIHZpc2libGUuIFRoaXMgbWVhbnMgdGhhdFxuICAvLyB0aGUgbWV0aG9kIGhhcyByZXR1cm5zIGl0cyBcImRhdGEgaXMgZG9uZVwiIG1lc3NhZ2UgKkFORCogYWxsIHNlcnZlclxuICAvLyBkb2N1bWVudHMgdGhhdCBhcmUgYnVmZmVyZWQgYXQgdGhhdCB0aW1lIGhhdmUgYmVlbiB3cml0dGVuIHRvIHRoZSBsb2NhbFxuICAvLyBjYWNoZS4gSW52b2tlcyB0aGUgbWFpbiBjYWxsYmFjayBpZiB0aGUgcmVzdWx0IGhhcyBiZWVuIHJlY2VpdmVkLlxuICBkYXRhVmlzaWJsZSgpIHtcbiAgICB0aGlzLl9kYXRhVmlzaWJsZSA9IHRydWU7XG4gICAgdGhpcy5fbWF5YmVJbnZva2VDYWxsYmFjaygpO1xuICB9XG4gIC8vIFRydWUgaWYgcmVjZWl2ZVJlc3VsdCBoYXMgYmVlbiBjYWxsZWQuXG4gIGdvdFJlc3VsdCgpIHtcbiAgICByZXR1cm4gISF0aGlzLl9tZXRob2RSZXN1bHQ7XG4gIH1cbn1cbiIsImltcG9ydCB7IE1ldGVvciB9IGZyb20gJ21ldGVvci9tZXRlb3InO1xuaW1wb3J0IHsgRERQQ29tbW9uIH0gZnJvbSAnbWV0ZW9yL2RkcC1jb21tb24nO1xuaW1wb3J0IHsgVHJhY2tlciB9IGZyb20gJ21ldGVvci90cmFja2VyJztcbmltcG9ydCB7IEVKU09OIH0gZnJvbSAnbWV0ZW9yL2Vqc29uJztcbmltcG9ydCB7IFJhbmRvbSB9IGZyb20gJ21ldGVvci9yYW5kb20nO1xuaW1wb3J0IHsgSG9vayB9IGZyb20gJ21ldGVvci9jYWxsYmFjay1ob29rJztcbmltcG9ydCB7IE1vbmdvSUQgfSBmcm9tICdtZXRlb3IvbW9uZ28taWQnO1xuaW1wb3J0IHsgRERQIH0gZnJvbSAnLi9uYW1lc3BhY2UuanMnO1xuaW1wb3J0IE1ldGhvZEludm9rZXIgZnJvbSAnLi9NZXRob2RJbnZva2VyLmpzJztcbmltcG9ydCB7XG4gIGhhc093bixcbiAgc2xpY2UsXG4gIGtleXMsXG4gIGlzRW1wdHksXG4gIGxhc3QsXG59IGZyb20gXCJtZXRlb3IvZGRwLWNvbW1vbi91dGlscy5qc1wiO1xuXG5sZXQgRmliZXI7XG5sZXQgRnV0dXJlO1xuaWYgKE1ldGVvci5pc1NlcnZlcikge1xuICBGaWJlciA9IE5wbS5yZXF1aXJlKCdmaWJlcnMnKTtcbiAgRnV0dXJlID0gTnBtLnJlcXVpcmUoJ2ZpYmVycy9mdXR1cmUnKTtcbn1cblxuY2xhc3MgTW9uZ29JRE1hcCBleHRlbmRzIElkTWFwIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoTW9uZ29JRC5pZFN0cmluZ2lmeSwgTW9uZ29JRC5pZFBhcnNlKTtcbiAgfVxufVxuXG4vLyBAcGFyYW0gdXJsIHtTdHJpbmd8T2JqZWN0fSBVUkwgdG8gTWV0ZW9yIGFwcCxcbi8vICAgb3IgYW4gb2JqZWN0IGFzIGEgdGVzdCBob29rIChzZWUgY29kZSlcbi8vIE9wdGlvbnM6XG4vLyAgIHJlbG9hZFdpdGhPdXRzdGFuZGluZzogaXMgaXQgT0sgdG8gcmVsb2FkIGlmIHRoZXJlIGFyZSBvdXRzdGFuZGluZyBtZXRob2RzP1xuLy8gICBoZWFkZXJzOiBleHRyYSBoZWFkZXJzIHRvIHNlbmQgb24gdGhlIHdlYnNvY2tldHMgY29ubmVjdGlvbiwgZm9yXG4vLyAgICAgc2VydmVyLXRvLXNlcnZlciBERFAgb25seVxuLy8gICBfc29ja2pzT3B0aW9uczogU3BlY2lmaWVzIG9wdGlvbnMgdG8gcGFzcyB0aHJvdWdoIHRvIHRoZSBzb2NranMgY2xpZW50XG4vLyAgIG9uRERQTmVnb3RpYXRpb25WZXJzaW9uRmFpbHVyZTogY2FsbGJhY2sgd2hlbiB2ZXJzaW9uIG5lZ290aWF0aW9uIGZhaWxzLlxuLy9cbi8vIFhYWCBUaGVyZSBzaG91bGQgYmUgYSB3YXkgdG8gZGVzdHJveSBhIEREUCBjb25uZWN0aW9uLCBjYXVzaW5nIGFsbFxuLy8gb3V0c3RhbmRpbmcgbWV0aG9kIGNhbGxzIHRvIGZhaWwuXG4vL1xuLy8gWFhYIE91ciBjdXJyZW50IHdheSBvZiBoYW5kbGluZyBmYWlsdXJlIGFuZCByZWNvbm5lY3Rpb24gaXMgZ3JlYXRcbi8vIGZvciBhbiBhcHAgKHdoZXJlIHdlIHdhbnQgdG8gdG9sZXJhdGUgYmVpbmcgZGlzY29ubmVjdGVkIGFzIGFuXG4vLyBleHBlY3Qgc3RhdGUsIGFuZCBrZWVwIHRyeWluZyBmb3JldmVyIHRvIHJlY29ubmVjdCkgYnV0IGN1bWJlcnNvbWVcbi8vIGZvciBzb21ldGhpbmcgbGlrZSBhIGNvbW1hbmQgbGluZSB0b29sIHRoYXQgd2FudHMgdG8gbWFrZSBhXG4vLyBjb25uZWN0aW9uLCBjYWxsIGEgbWV0aG9kLCBhbmQgcHJpbnQgYW4gZXJyb3IgaWYgY29ubmVjdGlvblxuLy8gZmFpbHMuIFdlIHNob3VsZCBoYXZlIGJldHRlciB1c2FiaWxpdHkgaW4gdGhlIGxhdHRlciBjYXNlICh3aGlsZVxuLy8gc3RpbGwgdHJhbnNwYXJlbnRseSByZWNvbm5lY3RpbmcgaWYgaXQncyBqdXN0IGEgdHJhbnNpZW50IGZhaWx1cmVcbi8vIG9yIHRoZSBzZXJ2ZXIgbWlncmF0aW5nIHVzKS5cbmV4cG9ydCBjbGFzcyBDb25uZWN0aW9uIHtcbiAgY29uc3RydWN0b3IodXJsLCBvcHRpb25zKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG5cbiAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zID0ge1xuICAgICAgb25Db25uZWN0ZWQoKSB7fSxcbiAgICAgIG9uRERQVmVyc2lvbk5lZ290aWF0aW9uRmFpbHVyZShkZXNjcmlwdGlvbikge1xuICAgICAgICBNZXRlb3IuX2RlYnVnKGRlc2NyaXB0aW9uKTtcbiAgICAgIH0sXG4gICAgICBoZWFydGJlYXRJbnRlcnZhbDogMTc1MDAsXG4gICAgICBoZWFydGJlYXRUaW1lb3V0OiAxNTAwMCxcbiAgICAgIG5wbUZheWVPcHRpb25zOiBPYmplY3QuY3JlYXRlKG51bGwpLFxuICAgICAgLy8gVGhlc2Ugb3B0aW9ucyBhcmUgb25seSBmb3IgdGVzdGluZy5cbiAgICAgIHJlbG9hZFdpdGhPdXRzdGFuZGluZzogZmFsc2UsXG4gICAgICBzdXBwb3J0ZWRERFBWZXJzaW9uczogRERQQ29tbW9uLlNVUFBPUlRFRF9ERFBfVkVSU0lPTlMsXG4gICAgICByZXRyeTogdHJ1ZSxcbiAgICAgIHJlc3BvbmRUb1BpbmdzOiB0cnVlLFxuICAgICAgLy8gV2hlbiB1cGRhdGVzIGFyZSBjb21pbmcgd2l0aGluIHRoaXMgbXMgaW50ZXJ2YWwsIGJhdGNoIHRoZW0gdG9nZXRoZXIuXG4gICAgICBidWZmZXJlZFdyaXRlc0ludGVydmFsOiA1LFxuICAgICAgLy8gRmx1c2ggYnVmZmVycyBpbW1lZGlhdGVseSBpZiB3cml0ZXMgYXJlIGhhcHBlbmluZyBjb250aW51b3VzbHkgZm9yIG1vcmUgdGhhbiB0aGlzIG1hbnkgbXMuXG4gICAgICBidWZmZXJlZFdyaXRlc01heEFnZTogNTAwLFxuXG4gICAgICAuLi5vcHRpb25zXG4gICAgfTtcblxuICAgIC8vIElmIHNldCwgY2FsbGVkIHdoZW4gd2UgcmVjb25uZWN0LCBxdWV1aW5nIG1ldGhvZCBjYWxscyBfYmVmb3JlXyB0aGVcbiAgICAvLyBleGlzdGluZyBvdXRzdGFuZGluZyBvbmVzLlxuICAgIC8vIE5PVEU6IFRoaXMgZmVhdHVyZSBoYXMgYmVlbiBwcmVzZXJ2ZWQgZm9yIGJhY2t3YXJkcyBjb21wYXRpYmlsaXR5LiBUaGVcbiAgICAvLyBwcmVmZXJyZWQgbWV0aG9kIG9mIHNldHRpbmcgYSBjYWxsYmFjayBvbiByZWNvbm5lY3QgaXMgdG8gdXNlXG4gICAgLy8gRERQLm9uUmVjb25uZWN0LlxuICAgIHNlbGYub25SZWNvbm5lY3QgPSBudWxsO1xuXG4gICAgLy8gYXMgYSB0ZXN0IGhvb2ssIGFsbG93IHBhc3NpbmcgYSBzdHJlYW0gaW5zdGVhZCBvZiBhIHVybC5cbiAgICBpZiAodHlwZW9mIHVybCA9PT0gJ29iamVjdCcpIHtcbiAgICAgIHNlbGYuX3N0cmVhbSA9IHVybDtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgeyBDbGllbnRTdHJlYW0gfSA9IHJlcXVpcmUoXCJtZXRlb3Ivc29ja2V0LXN0cmVhbS1jbGllbnRcIik7XG4gICAgICBzZWxmLl9zdHJlYW0gPSBuZXcgQ2xpZW50U3RyZWFtKHVybCwge1xuICAgICAgICByZXRyeTogb3B0aW9ucy5yZXRyeSxcbiAgICAgICAgQ29ubmVjdGlvbkVycm9yOiBERFAuQ29ubmVjdGlvbkVycm9yLFxuICAgICAgICBoZWFkZXJzOiBvcHRpb25zLmhlYWRlcnMsXG4gICAgICAgIF9zb2NranNPcHRpb25zOiBvcHRpb25zLl9zb2NranNPcHRpb25zLFxuICAgICAgICAvLyBVc2VkIHRvIGtlZXAgc29tZSB0ZXN0cyBxdWlldCwgb3IgZm9yIG90aGVyIGNhc2VzIGluIHdoaWNoXG4gICAgICAgIC8vIHRoZSByaWdodCB0aGluZyB0byBkbyB3aXRoIGNvbm5lY3Rpb24gZXJyb3JzIGlzIHRvIHNpbGVudGx5XG4gICAgICAgIC8vIGZhaWwgKGUuZy4gc2VuZGluZyBwYWNrYWdlIHVzYWdlIHN0YXRzKS4gQXQgc29tZSBwb2ludCB3ZVxuICAgICAgICAvLyBzaG91bGQgaGF2ZSBhIHJlYWwgQVBJIGZvciBoYW5kbGluZyBjbGllbnQtc3RyZWFtLWxldmVsXG4gICAgICAgIC8vIGVycm9ycy5cbiAgICAgICAgX2RvbnRQcmludEVycm9yczogb3B0aW9ucy5fZG9udFByaW50RXJyb3JzLFxuICAgICAgICBjb25uZWN0VGltZW91dE1zOiBvcHRpb25zLmNvbm5lY3RUaW1lb3V0TXMsXG4gICAgICAgIG5wbUZheWVPcHRpb25zOiBvcHRpb25zLm5wbUZheWVPcHRpb25zXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBzZWxmLl9sYXN0U2Vzc2lvbklkID0gbnVsbDtcbiAgICBzZWxmLl92ZXJzaW9uU3VnZ2VzdGlvbiA9IG51bGw7IC8vIFRoZSBsYXN0IHByb3Bvc2VkIEREUCB2ZXJzaW9uLlxuICAgIHNlbGYuX3ZlcnNpb24gPSBudWxsOyAvLyBUaGUgRERQIHZlcnNpb24gYWdyZWVkIG9uIGJ5IGNsaWVudCBhbmQgc2VydmVyLlxuICAgIHNlbGYuX3N0b3JlcyA9IE9iamVjdC5jcmVhdGUobnVsbCk7IC8vIG5hbWUgLT4gb2JqZWN0IHdpdGggbWV0aG9kc1xuICAgIHNlbGYuX21ldGhvZEhhbmRsZXJzID0gT2JqZWN0LmNyZWF0ZShudWxsKTsgLy8gbmFtZSAtPiBmdW5jXG4gICAgc2VsZi5fbmV4dE1ldGhvZElkID0gMTtcbiAgICBzZWxmLl9zdXBwb3J0ZWRERFBWZXJzaW9ucyA9IG9wdGlvbnMuc3VwcG9ydGVkRERQVmVyc2lvbnM7XG5cbiAgICBzZWxmLl9oZWFydGJlYXRJbnRlcnZhbCA9IG9wdGlvbnMuaGVhcnRiZWF0SW50ZXJ2YWw7XG4gICAgc2VsZi5faGVhcnRiZWF0VGltZW91dCA9IG9wdGlvbnMuaGVhcnRiZWF0VGltZW91dDtcblxuICAgIC8vIFRyYWNrcyBtZXRob2RzIHdoaWNoIHRoZSB1c2VyIGhhcyB0cmllZCB0byBjYWxsIGJ1dCB3aGljaCBoYXZlIG5vdCB5ZXRcbiAgICAvLyBjYWxsZWQgdGhlaXIgdXNlciBjYWxsYmFjayAoaWUsIHRoZXkgYXJlIHdhaXRpbmcgb24gdGhlaXIgcmVzdWx0IG9yIGZvciBhbGxcbiAgICAvLyBvZiB0aGVpciB3cml0ZXMgdG8gYmUgd3JpdHRlbiB0byB0aGUgbG9jYWwgY2FjaGUpLiBNYXAgZnJvbSBtZXRob2QgSUQgdG9cbiAgICAvLyBNZXRob2RJbnZva2VyIG9iamVjdC5cbiAgICBzZWxmLl9tZXRob2RJbnZva2VycyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cbiAgICAvLyBUcmFja3MgbWV0aG9kcyB3aGljaCB0aGUgdXNlciBoYXMgY2FsbGVkIGJ1dCB3aG9zZSByZXN1bHQgbWVzc2FnZXMgaGF2ZSBub3RcbiAgICAvLyBhcnJpdmVkIHlldC5cbiAgICAvL1xuICAgIC8vIF9vdXRzdGFuZGluZ01ldGhvZEJsb2NrcyBpcyBhbiBhcnJheSBvZiBibG9ja3Mgb2YgbWV0aG9kcy4gRWFjaCBibG9ja1xuICAgIC8vIHJlcHJlc2VudHMgYSBzZXQgb2YgbWV0aG9kcyB0aGF0IGNhbiBydW4gYXQgdGhlIHNhbWUgdGltZS4gVGhlIGZpcnN0IGJsb2NrXG4gICAgLy8gcmVwcmVzZW50cyB0aGUgbWV0aG9kcyB3aGljaCBhcmUgY3VycmVudGx5IGluIGZsaWdodDsgc3Vic2VxdWVudCBibG9ja3NcbiAgICAvLyBtdXN0IHdhaXQgZm9yIHByZXZpb3VzIGJsb2NrcyB0byBiZSBmdWxseSBmaW5pc2hlZCBiZWZvcmUgdGhleSBjYW4gYmUgc2VudFxuICAgIC8vIHRvIHRoZSBzZXJ2ZXIuXG4gICAgLy9cbiAgICAvLyBFYWNoIGJsb2NrIGlzIGFuIG9iamVjdCB3aXRoIHRoZSBmb2xsb3dpbmcgZmllbGRzOlxuICAgIC8vIC0gbWV0aG9kczogYSBsaXN0IG9mIE1ldGhvZEludm9rZXIgb2JqZWN0c1xuICAgIC8vIC0gd2FpdDogYSBib29sZWFuOyBpZiB0cnVlLCB0aGlzIGJsb2NrIGhhZCBhIHNpbmdsZSBtZXRob2QgaW52b2tlZCB3aXRoXG4gICAgLy8gICAgICAgICB0aGUgXCJ3YWl0XCIgb3B0aW9uXG4gICAgLy9cbiAgICAvLyBUaGVyZSB3aWxsIG5ldmVyIGJlIGFkamFjZW50IGJsb2NrcyB3aXRoIHdhaXQ9ZmFsc2UsIGJlY2F1c2UgdGhlIG9ubHkgdGhpbmdcbiAgICAvLyB0aGF0IG1ha2VzIG1ldGhvZHMgbmVlZCB0byBiZSBzZXJpYWxpemVkIGlzIGEgd2FpdCBtZXRob2QuXG4gICAgLy9cbiAgICAvLyBNZXRob2RzIGFyZSByZW1vdmVkIGZyb20gdGhlIGZpcnN0IGJsb2NrIHdoZW4gdGhlaXIgXCJyZXN1bHRcIiBpc1xuICAgIC8vIHJlY2VpdmVkLiBUaGUgZW50aXJlIGZpcnN0IGJsb2NrIGlzIG9ubHkgcmVtb3ZlZCB3aGVuIGFsbCBvZiB0aGUgaW4tZmxpZ2h0XG4gICAgLy8gbWV0aG9kcyBoYXZlIHJlY2VpdmVkIHRoZWlyIHJlc3VsdHMgKHNvIHRoZSBcIm1ldGhvZHNcIiBsaXN0IGlzIGVtcHR5KSAqQU5EKlxuICAgIC8vIGFsbCBvZiB0aGUgZGF0YSB3cml0dGVuIGJ5IHRob3NlIG1ldGhvZHMgYXJlIHZpc2libGUgaW4gdGhlIGxvY2FsIGNhY2hlLiBTb1xuICAgIC8vIGl0IGlzIHBvc3NpYmxlIGZvciB0aGUgZmlyc3QgYmxvY2sncyBtZXRob2RzIGxpc3QgdG8gYmUgZW1wdHksIGlmIHdlIGFyZVxuICAgIC8vIHN0aWxsIHdhaXRpbmcgZm9yIHNvbWUgb2JqZWN0cyB0byBxdWllc2NlLlxuICAgIC8vXG4gICAgLy8gRXhhbXBsZTpcbiAgICAvLyAgX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzID0gW1xuICAgIC8vICAgIHt3YWl0OiBmYWxzZSwgbWV0aG9kczogW119LFxuICAgIC8vICAgIHt3YWl0OiB0cnVlLCBtZXRob2RzOiBbPE1ldGhvZEludm9rZXIgZm9yICdsb2dpbic+XX0sXG4gICAgLy8gICAge3dhaXQ6IGZhbHNlLCBtZXRob2RzOiBbPE1ldGhvZEludm9rZXIgZm9yICdmb28nPixcbiAgICAvLyAgICAgICAgICAgICAgICAgICAgICAgICAgICA8TWV0aG9kSW52b2tlciBmb3IgJ2Jhcic+XX1dXG4gICAgLy8gVGhpcyBtZWFucyB0aGF0IHRoZXJlIHdlcmUgc29tZSBtZXRob2RzIHdoaWNoIHdlcmUgc2VudCB0byB0aGUgc2VydmVyIGFuZFxuICAgIC8vIHdoaWNoIGhhdmUgcmV0dXJuZWQgdGhlaXIgcmVzdWx0cywgYnV0IHNvbWUgb2YgdGhlIGRhdGEgd3JpdHRlbiBieVxuICAgIC8vIHRoZSBtZXRob2RzIG1heSBub3QgYmUgdmlzaWJsZSBpbiB0aGUgbG9jYWwgY2FjaGUuIE9uY2UgYWxsIHRoYXQgZGF0YSBpc1xuICAgIC8vIHZpc2libGUsIHdlIHdpbGwgc2VuZCBhICdsb2dpbicgbWV0aG9kLiBPbmNlIHRoZSBsb2dpbiBtZXRob2QgaGFzIHJldHVybmVkXG4gICAgLy8gYW5kIGFsbCB0aGUgZGF0YSBpcyB2aXNpYmxlIChpbmNsdWRpbmcgcmUtcnVubmluZyBzdWJzIGlmIHVzZXJJZCBjaGFuZ2VzKSxcbiAgICAvLyB3ZSB3aWxsIHNlbmQgdGhlICdmb28nIGFuZCAnYmFyJyBtZXRob2RzIGluIHBhcmFsbGVsLlxuICAgIHNlbGYuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzID0gW107XG5cbiAgICAvLyBtZXRob2QgSUQgLT4gYXJyYXkgb2Ygb2JqZWN0cyB3aXRoIGtleXMgJ2NvbGxlY3Rpb24nIGFuZCAnaWQnLCBsaXN0aW5nXG4gICAgLy8gZG9jdW1lbnRzIHdyaXR0ZW4gYnkgYSBnaXZlbiBtZXRob2QncyBzdHViLiBrZXlzIGFyZSBhc3NvY2lhdGVkIHdpdGhcbiAgICAvLyBtZXRob2RzIHdob3NlIHN0dWIgd3JvdGUgYXQgbGVhc3Qgb25lIGRvY3VtZW50LCBhbmQgd2hvc2UgZGF0YS1kb25lIG1lc3NhZ2VcbiAgICAvLyBoYXMgbm90IHlldCBiZWVuIHJlY2VpdmVkLlxuICAgIHNlbGYuX2RvY3VtZW50c1dyaXR0ZW5CeVN0dWIgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICAgIC8vIGNvbGxlY3Rpb24gLT4gSWRNYXAgb2YgXCJzZXJ2ZXIgZG9jdW1lbnRcIiBvYmplY3QuIEEgXCJzZXJ2ZXIgZG9jdW1lbnRcIiBoYXM6XG4gICAgLy8gLSBcImRvY3VtZW50XCI6IHRoZSB2ZXJzaW9uIG9mIHRoZSBkb2N1bWVudCBhY2NvcmRpbmcgdGhlXG4gICAgLy8gICBzZXJ2ZXIgKGllLCB0aGUgc25hcHNob3QgYmVmb3JlIGEgc3R1YiB3cm90ZSBpdCwgYW1lbmRlZCBieSBhbnkgY2hhbmdlc1xuICAgIC8vICAgcmVjZWl2ZWQgZnJvbSB0aGUgc2VydmVyKVxuICAgIC8vICAgSXQgaXMgdW5kZWZpbmVkIGlmIHdlIHRoaW5rIHRoZSBkb2N1bWVudCBkb2VzIG5vdCBleGlzdFxuICAgIC8vIC0gXCJ3cml0dGVuQnlTdHVic1wiOiBhIHNldCBvZiBtZXRob2QgSURzIHdob3NlIHN0dWJzIHdyb3RlIHRvIHRoZSBkb2N1bWVudFxuICAgIC8vICAgd2hvc2UgXCJkYXRhIGRvbmVcIiBtZXNzYWdlcyBoYXZlIG5vdCB5ZXQgYmVlbiBwcm9jZXNzZWRcbiAgICBzZWxmLl9zZXJ2ZXJEb2N1bWVudHMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXG4gICAgLy8gQXJyYXkgb2YgY2FsbGJhY2tzIHRvIGJlIGNhbGxlZCBhZnRlciB0aGUgbmV4dCB1cGRhdGUgb2YgdGhlIGxvY2FsXG4gICAgLy8gY2FjaGUuIFVzZWQgZm9yOlxuICAgIC8vICAtIENhbGxpbmcgbWV0aG9kSW52b2tlci5kYXRhVmlzaWJsZSBhbmQgc3ViIHJlYWR5IGNhbGxiYWNrcyBhZnRlclxuICAgIC8vICAgIHRoZSByZWxldmFudCBkYXRhIGlzIGZsdXNoZWQuXG4gICAgLy8gIC0gSW52b2tpbmcgdGhlIGNhbGxiYWNrcyBvZiBcImhhbGYtZmluaXNoZWRcIiBtZXRob2RzIGFmdGVyIHJlY29ubmVjdFxuICAgIC8vICAgIHF1aWVzY2VuY2UuIFNwZWNpZmljYWxseSwgbWV0aG9kcyB3aG9zZSByZXN1bHQgd2FzIHJlY2VpdmVkIG92ZXIgdGhlIG9sZFxuICAgIC8vICAgIGNvbm5lY3Rpb24gKHNvIHdlIGRvbid0IHJlLXNlbmQgaXQpIGJ1dCB3aG9zZSBkYXRhIGhhZCBub3QgYmVlbiBtYWRlXG4gICAgLy8gICAgdmlzaWJsZS5cbiAgICBzZWxmLl9hZnRlclVwZGF0ZUNhbGxiYWNrcyA9IFtdO1xuXG4gICAgLy8gSW4gdHdvIGNvbnRleHRzLCB3ZSBidWZmZXIgYWxsIGluY29taW5nIGRhdGEgbWVzc2FnZXMgYW5kIHRoZW4gcHJvY2VzcyB0aGVtXG4gICAgLy8gYWxsIGF0IG9uY2UgaW4gYSBzaW5nbGUgdXBkYXRlOlxuICAgIC8vICAgLSBEdXJpbmcgcmVjb25uZWN0LCB3ZSBidWZmZXIgYWxsIGRhdGEgbWVzc2FnZXMgdW50aWwgYWxsIHN1YnMgdGhhdCBoYWRcbiAgICAvLyAgICAgYmVlbiByZWFkeSBiZWZvcmUgcmVjb25uZWN0IGFyZSByZWFkeSBhZ2FpbiwgYW5kIGFsbCBtZXRob2RzIHRoYXQgYXJlXG4gICAgLy8gICAgIGFjdGl2ZSBoYXZlIHJldHVybmVkIHRoZWlyIFwiZGF0YSBkb25lIG1lc3NhZ2VcIjsgdGhlblxuICAgIC8vICAgLSBEdXJpbmcgdGhlIGV4ZWN1dGlvbiBvZiBhIFwid2FpdFwiIG1ldGhvZCwgd2UgYnVmZmVyIGFsbCBkYXRhIG1lc3NhZ2VzXG4gICAgLy8gICAgIHVudGlsIHRoZSB3YWl0IG1ldGhvZCBnZXRzIGl0cyBcImRhdGEgZG9uZVwiIG1lc3NhZ2UuIChJZiB0aGUgd2FpdCBtZXRob2RcbiAgICAvLyAgICAgb2NjdXJzIGR1cmluZyByZWNvbm5lY3QsIGl0IGRvZXNuJ3QgZ2V0IGFueSBzcGVjaWFsIGhhbmRsaW5nLilcbiAgICAvLyBhbGwgZGF0YSBtZXNzYWdlcyBhcmUgcHJvY2Vzc2VkIGluIG9uZSB1cGRhdGUuXG4gICAgLy9cbiAgICAvLyBUaGUgZm9sbG93aW5nIGZpZWxkcyBhcmUgdXNlZCBmb3IgdGhpcyBcInF1aWVzY2VuY2VcIiBwcm9jZXNzLlxuXG4gICAgLy8gVGhpcyBidWZmZXJzIHRoZSBtZXNzYWdlcyB0aGF0IGFyZW4ndCBiZWluZyBwcm9jZXNzZWQgeWV0LlxuICAgIHNlbGYuX21lc3NhZ2VzQnVmZmVyZWRVbnRpbFF1aWVzY2VuY2UgPSBbXTtcbiAgICAvLyBNYXAgZnJvbSBtZXRob2QgSUQgLT4gdHJ1ZS4gTWV0aG9kcyBhcmUgcmVtb3ZlZCBmcm9tIHRoaXMgd2hlbiB0aGVpclxuICAgIC8vIFwiZGF0YSBkb25lXCIgbWVzc2FnZSBpcyByZWNlaXZlZCwgYW5kIHdlIHdpbGwgbm90IHF1aWVzY2UgdW50aWwgaXQgaXNcbiAgICAvLyBlbXB0eS5cbiAgICBzZWxmLl9tZXRob2RzQmxvY2tpbmdRdWllc2NlbmNlID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgICAvLyBtYXAgZnJvbSBzdWIgSUQgLT4gdHJ1ZSBmb3Igc3VicyB0aGF0IHdlcmUgcmVhZHkgKGllLCBjYWxsZWQgdGhlIHN1YlxuICAgIC8vIHJlYWR5IGNhbGxiYWNrKSBiZWZvcmUgcmVjb25uZWN0IGJ1dCBoYXZlbid0IGJlY29tZSByZWFkeSBhZ2FpbiB5ZXRcbiAgICBzZWxmLl9zdWJzQmVpbmdSZXZpdmVkID0gT2JqZWN0LmNyZWF0ZShudWxsKTsgLy8gbWFwIGZyb20gc3ViLl9pZCAtPiB0cnVlXG4gICAgLy8gaWYgdHJ1ZSwgdGhlIG5leHQgZGF0YSB1cGRhdGUgc2hvdWxkIHJlc2V0IGFsbCBzdG9yZXMuIChzZXQgZHVyaW5nXG4gICAgLy8gcmVjb25uZWN0LilcbiAgICBzZWxmLl9yZXNldFN0b3JlcyA9IGZhbHNlO1xuXG4gICAgLy8gbmFtZSAtPiBhcnJheSBvZiB1cGRhdGVzIGZvciAoeWV0IHRvIGJlIGNyZWF0ZWQpIGNvbGxlY3Rpb25zXG4gICAgc2VsZi5fdXBkYXRlc0ZvclVua25vd25TdG9yZXMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICAgIC8vIGlmIHdlJ3JlIGJsb2NraW5nIGEgbWlncmF0aW9uLCB0aGUgcmV0cnkgZnVuY1xuICAgIHNlbGYuX3JldHJ5TWlncmF0ZSA9IG51bGw7XG5cbiAgICBzZWxmLl9fZmx1c2hCdWZmZXJlZFdyaXRlcyA9IE1ldGVvci5iaW5kRW52aXJvbm1lbnQoXG4gICAgICBzZWxmLl9mbHVzaEJ1ZmZlcmVkV3JpdGVzLFxuICAgICAgJ2ZsdXNoaW5nIEREUCBidWZmZXJlZCB3cml0ZXMnLFxuICAgICAgc2VsZlxuICAgICk7XG4gICAgLy8gQ29sbGVjdGlvbiBuYW1lIC0+IGFycmF5IG9mIG1lc3NhZ2VzLlxuICAgIHNlbGYuX2J1ZmZlcmVkV3JpdGVzID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgICAvLyBXaGVuIGN1cnJlbnQgYnVmZmVyIG9mIHVwZGF0ZXMgbXVzdCBiZSBmbHVzaGVkIGF0LCBpbiBtcyB0aW1lc3RhbXAuXG4gICAgc2VsZi5fYnVmZmVyZWRXcml0ZXNGbHVzaEF0ID0gbnVsbDtcbiAgICAvLyBUaW1lb3V0IGhhbmRsZSBmb3IgdGhlIG5leHQgcHJvY2Vzc2luZyBvZiBhbGwgcGVuZGluZyB3cml0ZXNcbiAgICBzZWxmLl9idWZmZXJlZFdyaXRlc0ZsdXNoSGFuZGxlID0gbnVsbDtcblxuICAgIHNlbGYuX2J1ZmZlcmVkV3JpdGVzSW50ZXJ2YWwgPSBvcHRpb25zLmJ1ZmZlcmVkV3JpdGVzSW50ZXJ2YWw7XG4gICAgc2VsZi5fYnVmZmVyZWRXcml0ZXNNYXhBZ2UgPSBvcHRpb25zLmJ1ZmZlcmVkV3JpdGVzTWF4QWdlO1xuXG4gICAgLy8gbWV0YWRhdGEgZm9yIHN1YnNjcmlwdGlvbnMuICBNYXAgZnJvbSBzdWIgSUQgdG8gb2JqZWN0IHdpdGgga2V5czpcbiAgICAvLyAgIC0gaWRcbiAgICAvLyAgIC0gbmFtZVxuICAgIC8vICAgLSBwYXJhbXNcbiAgICAvLyAgIC0gaW5hY3RpdmUgKGlmIHRydWUsIHdpbGwgYmUgY2xlYW5lZCB1cCBpZiBub3QgcmV1c2VkIGluIHJlLXJ1bilcbiAgICAvLyAgIC0gcmVhZHkgKGhhcyB0aGUgJ3JlYWR5JyBtZXNzYWdlIGJlZW4gcmVjZWl2ZWQ/KVxuICAgIC8vICAgLSByZWFkeUNhbGxiYWNrIChhbiBvcHRpb25hbCBjYWxsYmFjayB0byBjYWxsIHdoZW4gcmVhZHkpXG4gICAgLy8gICAtIGVycm9yQ2FsbGJhY2sgKGFuIG9wdGlvbmFsIGNhbGxiYWNrIHRvIGNhbGwgaWYgdGhlIHN1YiB0ZXJtaW5hdGVzIHdpdGhcbiAgICAvLyAgICAgICAgICAgICAgICAgICAgYW4gZXJyb3IsIFhYWCBDT01QQVQgV0lUSCAxLjAuMy4xKVxuICAgIC8vICAgLSBzdG9wQ2FsbGJhY2sgKGFuIG9wdGlvbmFsIGNhbGxiYWNrIHRvIGNhbGwgd2hlbiB0aGUgc3ViIHRlcm1pbmF0ZXNcbiAgICAvLyAgICAgZm9yIGFueSByZWFzb24sIHdpdGggYW4gZXJyb3IgYXJndW1lbnQgaWYgYW4gZXJyb3IgdHJpZ2dlcmVkIHRoZSBzdG9wKVxuICAgIHNlbGYuX3N1YnNjcmlwdGlvbnMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXG4gICAgLy8gUmVhY3RpdmUgdXNlcklkLlxuICAgIHNlbGYuX3VzZXJJZCA9IG51bGw7XG4gICAgc2VsZi5fdXNlcklkRGVwcyA9IG5ldyBUcmFja2VyLkRlcGVuZGVuY3koKTtcblxuICAgIC8vIEJsb2NrIGF1dG8tcmVsb2FkIHdoaWxlIHdlJ3JlIHdhaXRpbmcgZm9yIG1ldGhvZCByZXNwb25zZXMuXG4gICAgaWYgKE1ldGVvci5pc0NsaWVudCAmJlxuICAgICAgICBQYWNrYWdlLnJlbG9hZCAmJlxuICAgICAgICAhIG9wdGlvbnMucmVsb2FkV2l0aE91dHN0YW5kaW5nKSB7XG4gICAgICBQYWNrYWdlLnJlbG9hZC5SZWxvYWQuX29uTWlncmF0ZShyZXRyeSA9PiB7XG4gICAgICAgIGlmICghIHNlbGYuX3JlYWR5VG9NaWdyYXRlKCkpIHtcbiAgICAgICAgICBzZWxmLl9yZXRyeU1pZ3JhdGUgPSByZXRyeTtcbiAgICAgICAgICByZXR1cm4gW2ZhbHNlXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gW3RydWVdO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBjb25zdCBvbkRpc2Nvbm5lY3QgPSAoKSA9PiB7XG4gICAgICBpZiAoc2VsZi5faGVhcnRiZWF0KSB7XG4gICAgICAgIHNlbGYuX2hlYXJ0YmVhdC5zdG9wKCk7XG4gICAgICAgIHNlbGYuX2hlYXJ0YmVhdCA9IG51bGw7XG4gICAgICB9XG4gICAgfTtcblxuICAgIGlmIChNZXRlb3IuaXNTZXJ2ZXIpIHtcbiAgICAgIHNlbGYuX3N0cmVhbS5vbihcbiAgICAgICAgJ21lc3NhZ2UnLFxuICAgICAgICBNZXRlb3IuYmluZEVudmlyb25tZW50KFxuICAgICAgICAgIHRoaXMub25NZXNzYWdlLmJpbmQodGhpcyksXG4gICAgICAgICAgJ2hhbmRsaW5nIEREUCBtZXNzYWdlJ1xuICAgICAgICApXG4gICAgICApO1xuICAgICAgc2VsZi5fc3RyZWFtLm9uKFxuICAgICAgICAncmVzZXQnLFxuICAgICAgICBNZXRlb3IuYmluZEVudmlyb25tZW50KHRoaXMub25SZXNldC5iaW5kKHRoaXMpLCAnaGFuZGxpbmcgRERQIHJlc2V0JylcbiAgICAgICk7XG4gICAgICBzZWxmLl9zdHJlYW0ub24oXG4gICAgICAgICdkaXNjb25uZWN0JyxcbiAgICAgICAgTWV0ZW9yLmJpbmRFbnZpcm9ubWVudChvbkRpc2Nvbm5lY3QsICdoYW5kbGluZyBERFAgZGlzY29ubmVjdCcpXG4gICAgICApO1xuICAgIH0gZWxzZSB7XG4gICAgICBzZWxmLl9zdHJlYW0ub24oJ21lc3NhZ2UnLCB0aGlzLm9uTWVzc2FnZS5iaW5kKHRoaXMpKTtcbiAgICAgIHNlbGYuX3N0cmVhbS5vbigncmVzZXQnLCB0aGlzLm9uUmVzZXQuYmluZCh0aGlzKSk7XG4gICAgICBzZWxmLl9zdHJlYW0ub24oJ2Rpc2Nvbm5lY3QnLCBvbkRpc2Nvbm5lY3QpO1xuICAgIH1cbiAgfVxuXG4gIC8vICduYW1lJyBpcyB0aGUgbmFtZSBvZiB0aGUgZGF0YSBvbiB0aGUgd2lyZSB0aGF0IHNob3VsZCBnbyBpbiB0aGVcbiAgLy8gc3RvcmUuICd3cmFwcGVkU3RvcmUnIHNob3VsZCBiZSBhbiBvYmplY3Qgd2l0aCBtZXRob2RzIGJlZ2luVXBkYXRlLCB1cGRhdGUsXG4gIC8vIGVuZFVwZGF0ZSwgc2F2ZU9yaWdpbmFscywgcmV0cmlldmVPcmlnaW5hbHMuIHNlZSBDb2xsZWN0aW9uIGZvciBhbiBleGFtcGxlLlxuICByZWdpc3RlclN0b3JlKG5hbWUsIHdyYXBwZWRTdG9yZSkge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuXG4gICAgaWYgKG5hbWUgaW4gc2VsZi5fc3RvcmVzKSByZXR1cm4gZmFsc2U7XG5cbiAgICAvLyBXcmFwIHRoZSBpbnB1dCBvYmplY3QgaW4gYW4gb2JqZWN0IHdoaWNoIG1ha2VzIGFueSBzdG9yZSBtZXRob2Qgbm90XG4gICAgLy8gaW1wbGVtZW50ZWQgYnkgJ3N0b3JlJyBpbnRvIGEgbm8tb3AuXG4gICAgY29uc3Qgc3RvcmUgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICAgIGNvbnN0IGtleXNPZlN0b3JlID0gW1xuICAgICAgJ3VwZGF0ZScsXG4gICAgICAnYmVnaW5VcGRhdGUnLFxuICAgICAgJ2VuZFVwZGF0ZScsXG4gICAgICAnc2F2ZU9yaWdpbmFscycsXG4gICAgICAncmV0cmlldmVPcmlnaW5hbHMnLFxuICAgICAgJ2dldERvYycsXG4gICAgICAnX2dldENvbGxlY3Rpb24nXG4gICAgXTtcbiAgICBrZXlzT2ZTdG9yZS5mb3JFYWNoKChtZXRob2QpID0+IHtcbiAgICAgIHN0b3JlW21ldGhvZF0gPSAoLi4uYXJncykgPT4ge1xuICAgICAgICBpZiAod3JhcHBlZFN0b3JlW21ldGhvZF0pIHtcbiAgICAgICAgICByZXR1cm4gd3JhcHBlZFN0b3JlW21ldGhvZF0oLi4uYXJncyk7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfSk7XG4gICAgc2VsZi5fc3RvcmVzW25hbWVdID0gc3RvcmU7XG5cbiAgICBjb25zdCBxdWV1ZWQgPSBzZWxmLl91cGRhdGVzRm9yVW5rbm93blN0b3Jlc1tuYW1lXTtcbiAgICBpZiAoQXJyYXkuaXNBcnJheShxdWV1ZWQpKSB7XG4gICAgICBzdG9yZS5iZWdpblVwZGF0ZShxdWV1ZWQubGVuZ3RoLCBmYWxzZSk7XG4gICAgICBxdWV1ZWQuZm9yRWFjaChtc2cgPT4ge1xuICAgICAgICBzdG9yZS51cGRhdGUobXNnKTtcbiAgICAgIH0pO1xuICAgICAgc3RvcmUuZW5kVXBkYXRlKCk7XG4gICAgICBkZWxldGUgc2VsZi5fdXBkYXRlc0ZvclVua25vd25TdG9yZXNbbmFtZV07XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICAvKipcbiAgICogQG1lbWJlck9mIE1ldGVvclxuICAgKiBAaW1wb3J0RnJvbVBhY2thZ2UgbWV0ZW9yXG4gICAqIEBhbGlhcyBNZXRlb3Iuc3Vic2NyaWJlXG4gICAqIEBzdW1tYXJ5IFN1YnNjcmliZSB0byBhIHJlY29yZCBzZXQuICBSZXR1cm5zIGEgaGFuZGxlIHRoYXQgcHJvdmlkZXNcbiAgICogYHN0b3AoKWAgYW5kIGByZWFkeSgpYCBtZXRob2RzLlxuICAgKiBAbG9jdXMgQ2xpZW50XG4gICAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIE5hbWUgb2YgdGhlIHN1YnNjcmlwdGlvbi4gIE1hdGNoZXMgdGhlIG5hbWUgb2YgdGhlXG4gICAqIHNlcnZlcidzIGBwdWJsaXNoKClgIGNhbGwuXG4gICAqIEBwYXJhbSB7RUpTT05hYmxlfSBbYXJnMSxhcmcyLi4uXSBPcHRpb25hbCBhcmd1bWVudHMgcGFzc2VkIHRvIHB1Ymxpc2hlclxuICAgKiBmdW5jdGlvbiBvbiBzZXJ2ZXIuXG4gICAqIEBwYXJhbSB7RnVuY3Rpb258T2JqZWN0fSBbY2FsbGJhY2tzXSBPcHRpb25hbC4gTWF5IGluY2x1ZGUgYG9uU3RvcGBcbiAgICogYW5kIGBvblJlYWR5YCBjYWxsYmFja3MuIElmIHRoZXJlIGlzIGFuIGVycm9yLCBpdCBpcyBwYXNzZWQgYXMgYW5cbiAgICogYXJndW1lbnQgdG8gYG9uU3RvcGAuIElmIGEgZnVuY3Rpb24gaXMgcGFzc2VkIGluc3RlYWQgb2YgYW4gb2JqZWN0LCBpdFxuICAgKiBpcyBpbnRlcnByZXRlZCBhcyBhbiBgb25SZWFkeWAgY2FsbGJhY2suXG4gICAqL1xuICBzdWJzY3JpYmUobmFtZSAvKiAuLiBbYXJndW1lbnRzXSAuLiAoY2FsbGJhY2t8Y2FsbGJhY2tzKSAqLykge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuXG4gICAgY29uc3QgcGFyYW1zID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgIGxldCBjYWxsYmFja3MgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICAgIGlmIChwYXJhbXMubGVuZ3RoKSB7XG4gICAgICBjb25zdCBsYXN0UGFyYW0gPSBwYXJhbXNbcGFyYW1zLmxlbmd0aCAtIDFdO1xuICAgICAgaWYgKHR5cGVvZiBsYXN0UGFyYW0gPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgY2FsbGJhY2tzLm9uUmVhZHkgPSBwYXJhbXMucG9wKCk7XG4gICAgICB9IGVsc2UgaWYgKGxhc3RQYXJhbSAmJiBbXG4gICAgICAgIGxhc3RQYXJhbS5vblJlYWR5LFxuICAgICAgICAvLyBYWFggQ09NUEFUIFdJVEggMS4wLjMuMSBvbkVycm9yIHVzZWQgdG8gZXhpc3QsIGJ1dCBub3cgd2UgdXNlXG4gICAgICAgIC8vIG9uU3RvcCB3aXRoIGFuIGVycm9yIGNhbGxiYWNrIGluc3RlYWQuXG4gICAgICAgIGxhc3RQYXJhbS5vbkVycm9yLFxuICAgICAgICBsYXN0UGFyYW0ub25TdG9wXG4gICAgICBdLnNvbWUoZiA9PiB0eXBlb2YgZiA9PT0gXCJmdW5jdGlvblwiKSkge1xuICAgICAgICBjYWxsYmFja3MgPSBwYXJhbXMucG9wKCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gSXMgdGhlcmUgYW4gZXhpc3Rpbmcgc3ViIHdpdGggdGhlIHNhbWUgbmFtZSBhbmQgcGFyYW0sIHJ1biBpbiBhblxuICAgIC8vIGludmFsaWRhdGVkIENvbXB1dGF0aW9uPyBUaGlzIHdpbGwgaGFwcGVuIGlmIHdlIGFyZSByZXJ1bm5pbmcgYW5cbiAgICAvLyBleGlzdGluZyBjb21wdXRhdGlvbi5cbiAgICAvL1xuICAgIC8vIEZvciBleGFtcGxlLCBjb25zaWRlciBhIHJlcnVuIG9mOlxuICAgIC8vXG4gICAgLy8gICAgIFRyYWNrZXIuYXV0b3J1bihmdW5jdGlvbiAoKSB7XG4gICAgLy8gICAgICAgTWV0ZW9yLnN1YnNjcmliZShcImZvb1wiLCBTZXNzaW9uLmdldChcImZvb1wiKSk7XG4gICAgLy8gICAgICAgTWV0ZW9yLnN1YnNjcmliZShcImJhclwiLCBTZXNzaW9uLmdldChcImJhclwiKSk7XG4gICAgLy8gICAgIH0pO1xuICAgIC8vXG4gICAgLy8gSWYgXCJmb29cIiBoYXMgY2hhbmdlZCBidXQgXCJiYXJcIiBoYXMgbm90LCB3ZSB3aWxsIG1hdGNoIHRoZSBcImJhclwiXG4gICAgLy8gc3ViY3JpYmUgdG8gYW4gZXhpc3RpbmcgaW5hY3RpdmUgc3Vic2NyaXB0aW9uIGluIG9yZGVyIHRvIG5vdFxuICAgIC8vIHVuc3ViIGFuZCByZXN1YiB0aGUgc3Vic2NyaXB0aW9uIHVubmVjZXNzYXJpbHkuXG4gICAgLy9cbiAgICAvLyBXZSBvbmx5IGxvb2sgZm9yIG9uZSBzdWNoIHN1YjsgaWYgdGhlcmUgYXJlIE4gYXBwYXJlbnRseS1pZGVudGljYWwgc3Vic1xuICAgIC8vIGJlaW5nIGludmFsaWRhdGVkLCB3ZSB3aWxsIHJlcXVpcmUgTiBtYXRjaGluZyBzdWJzY3JpYmUgY2FsbHMgdG8ga2VlcFxuICAgIC8vIHRoZW0gYWxsIGFjdGl2ZS5cbiAgICBjb25zdCBleGlzdGluZyA9IE9iamVjdC52YWx1ZXMoc2VsZi5fc3Vic2NyaXB0aW9ucykuZmluZChcbiAgICAgIHN1YiA9PiAoc3ViLmluYWN0aXZlICYmIHN1Yi5uYW1lID09PSBuYW1lICYmIEVKU09OLmVxdWFscyhzdWIucGFyYW1zLCBwYXJhbXMpKVxuICAgICk7XG5cbiAgICBsZXQgaWQ7XG4gICAgaWYgKGV4aXN0aW5nKSB7XG4gICAgICBpZCA9IGV4aXN0aW5nLmlkO1xuICAgICAgZXhpc3RpbmcuaW5hY3RpdmUgPSBmYWxzZTsgLy8gcmVhY3RpdmF0ZVxuXG4gICAgICBpZiAoY2FsbGJhY2tzLm9uUmVhZHkpIHtcbiAgICAgICAgLy8gSWYgdGhlIHN1YiBpcyBub3QgYWxyZWFkeSByZWFkeSwgcmVwbGFjZSBhbnkgcmVhZHkgY2FsbGJhY2sgd2l0aCB0aGVcbiAgICAgICAgLy8gb25lIHByb3ZpZGVkIG5vdy4gKEl0J3Mgbm90IHJlYWxseSBjbGVhciB3aGF0IHVzZXJzIHdvdWxkIGV4cGVjdCBmb3JcbiAgICAgICAgLy8gYW4gb25SZWFkeSBjYWxsYmFjayBpbnNpZGUgYW4gYXV0b3J1bjsgdGhlIHNlbWFudGljcyB3ZSBwcm92aWRlIGlzXG4gICAgICAgIC8vIHRoYXQgYXQgdGhlIHRpbWUgdGhlIHN1YiBmaXJzdCBiZWNvbWVzIHJlYWR5LCB3ZSBjYWxsIHRoZSBsYXN0XG4gICAgICAgIC8vIG9uUmVhZHkgY2FsbGJhY2sgcHJvdmlkZWQsIGlmIGFueS4pXG4gICAgICAgIC8vIElmIHRoZSBzdWIgaXMgYWxyZWFkeSByZWFkeSwgcnVuIHRoZSByZWFkeSBjYWxsYmFjayByaWdodCBhd2F5LlxuICAgICAgICAvLyBJdCBzZWVtcyB0aGF0IHVzZXJzIHdvdWxkIGV4cGVjdCBhbiBvblJlYWR5IGNhbGxiYWNrIGluc2lkZSBhblxuICAgICAgICAvLyBhdXRvcnVuIHRvIHRyaWdnZXIgb25jZSB0aGUgdGhlIHN1YiBmaXJzdCBiZWNvbWVzIHJlYWR5IGFuZCBhbHNvXG4gICAgICAgIC8vIHdoZW4gcmUtc3VicyBoYXBwZW5zLlxuICAgICAgICBpZiAoZXhpc3RpbmcucmVhZHkpIHtcbiAgICAgICAgICBjYWxsYmFja3Mub25SZWFkeSgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGV4aXN0aW5nLnJlYWR5Q2FsbGJhY2sgPSBjYWxsYmFja3Mub25SZWFkeTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBYWFggQ09NUEFUIFdJVEggMS4wLjMuMSB3ZSB1c2VkIHRvIGhhdmUgb25FcnJvciBidXQgbm93IHdlIGNhbGxcbiAgICAgIC8vIG9uU3RvcCB3aXRoIGFuIG9wdGlvbmFsIGVycm9yIGFyZ3VtZW50XG4gICAgICBpZiAoY2FsbGJhY2tzLm9uRXJyb3IpIHtcbiAgICAgICAgLy8gUmVwbGFjZSBleGlzdGluZyBjYWxsYmFjayBpZiBhbnksIHNvIHRoYXQgZXJyb3JzIGFyZW4ndFxuICAgICAgICAvLyBkb3VibGUtcmVwb3J0ZWQuXG4gICAgICAgIGV4aXN0aW5nLmVycm9yQ2FsbGJhY2sgPSBjYWxsYmFja3Mub25FcnJvcjtcbiAgICAgIH1cblxuICAgICAgaWYgKGNhbGxiYWNrcy5vblN0b3ApIHtcbiAgICAgICAgZXhpc3Rpbmcuc3RvcENhbGxiYWNrID0gY2FsbGJhY2tzLm9uU3RvcDtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gTmV3IHN1YiEgR2VuZXJhdGUgYW4gaWQsIHNhdmUgaXQgbG9jYWxseSwgYW5kIHNlbmQgbWVzc2FnZS5cbiAgICAgIGlkID0gUmFuZG9tLmlkKCk7XG4gICAgICBzZWxmLl9zdWJzY3JpcHRpb25zW2lkXSA9IHtcbiAgICAgICAgaWQ6IGlkLFxuICAgICAgICBuYW1lOiBuYW1lLFxuICAgICAgICBwYXJhbXM6IEVKU09OLmNsb25lKHBhcmFtcyksXG4gICAgICAgIGluYWN0aXZlOiBmYWxzZSxcbiAgICAgICAgcmVhZHk6IGZhbHNlLFxuICAgICAgICByZWFkeURlcHM6IG5ldyBUcmFja2VyLkRlcGVuZGVuY3koKSxcbiAgICAgICAgcmVhZHlDYWxsYmFjazogY2FsbGJhY2tzLm9uUmVhZHksXG4gICAgICAgIC8vIFhYWCBDT01QQVQgV0lUSCAxLjAuMy4xICNlcnJvckNhbGxiYWNrXG4gICAgICAgIGVycm9yQ2FsbGJhY2s6IGNhbGxiYWNrcy5vbkVycm9yLFxuICAgICAgICBzdG9wQ2FsbGJhY2s6IGNhbGxiYWNrcy5vblN0b3AsXG4gICAgICAgIGNvbm5lY3Rpb246IHNlbGYsXG4gICAgICAgIHJlbW92ZSgpIHtcbiAgICAgICAgICBkZWxldGUgdGhpcy5jb25uZWN0aW9uLl9zdWJzY3JpcHRpb25zW3RoaXMuaWRdO1xuICAgICAgICAgIHRoaXMucmVhZHkgJiYgdGhpcy5yZWFkeURlcHMuY2hhbmdlZCgpO1xuICAgICAgICB9LFxuICAgICAgICBzdG9wKCkge1xuICAgICAgICAgIHRoaXMuY29ubmVjdGlvbi5fc2VuZCh7IG1zZzogJ3Vuc3ViJywgaWQ6IGlkIH0pO1xuICAgICAgICAgIHRoaXMucmVtb3ZlKCk7XG5cbiAgICAgICAgICBpZiAoY2FsbGJhY2tzLm9uU3RvcCkge1xuICAgICAgICAgICAgY2FsbGJhY2tzLm9uU3RvcCgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfTtcbiAgICAgIHNlbGYuX3NlbmQoeyBtc2c6ICdzdWInLCBpZDogaWQsIG5hbWU6IG5hbWUsIHBhcmFtczogcGFyYW1zIH0pO1xuICAgIH1cblxuICAgIC8vIHJldHVybiBhIGhhbmRsZSB0byB0aGUgYXBwbGljYXRpb24uXG4gICAgY29uc3QgaGFuZGxlID0ge1xuICAgICAgc3RvcCgpIHtcbiAgICAgICAgaWYgKCEgaGFzT3duLmNhbGwoc2VsZi5fc3Vic2NyaXB0aW9ucywgaWQpKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHNlbGYuX3N1YnNjcmlwdGlvbnNbaWRdLnN0b3AoKTtcbiAgICAgIH0sXG4gICAgICByZWFkeSgpIHtcbiAgICAgICAgLy8gcmV0dXJuIGZhbHNlIGlmIHdlJ3ZlIHVuc3Vic2NyaWJlZC5cbiAgICAgICAgaWYgKCFoYXNPd24uY2FsbChzZWxmLl9zdWJzY3JpcHRpb25zLCBpZCkpIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcmVjb3JkID0gc2VsZi5fc3Vic2NyaXB0aW9uc1tpZF07XG4gICAgICAgIHJlY29yZC5yZWFkeURlcHMuZGVwZW5kKCk7XG4gICAgICAgIHJldHVybiByZWNvcmQucmVhZHk7XG4gICAgICB9LFxuICAgICAgc3Vic2NyaXB0aW9uSWQ6IGlkXG4gICAgfTtcblxuICAgIGlmIChUcmFja2VyLmFjdGl2ZSkge1xuICAgICAgLy8gV2UncmUgaW4gYSByZWFjdGl2ZSBjb21wdXRhdGlvbiwgc28gd2UnZCBsaWtlIHRvIHVuc3Vic2NyaWJlIHdoZW4gdGhlXG4gICAgICAvLyBjb21wdXRhdGlvbiBpcyBpbnZhbGlkYXRlZC4uLiBidXQgbm90IGlmIHRoZSByZXJ1biBqdXN0IHJlLXN1YnNjcmliZXNcbiAgICAgIC8vIHRvIHRoZSBzYW1lIHN1YnNjcmlwdGlvbiEgIFdoZW4gYSByZXJ1biBoYXBwZW5zLCB3ZSB1c2Ugb25JbnZhbGlkYXRlXG4gICAgICAvLyBhcyBhIGNoYW5nZSB0byBtYXJrIHRoZSBzdWJzY3JpcHRpb24gXCJpbmFjdGl2ZVwiIHNvIHRoYXQgaXQgY2FuXG4gICAgICAvLyBiZSByZXVzZWQgZnJvbSB0aGUgcmVydW4uICBJZiBpdCBpc24ndCByZXVzZWQsIGl0J3Mga2lsbGVkIGZyb21cbiAgICAgIC8vIGFuIGFmdGVyRmx1c2guXG4gICAgICBUcmFja2VyLm9uSW52YWxpZGF0ZSgoYykgPT4ge1xuICAgICAgICBpZiAoaGFzT3duLmNhbGwoc2VsZi5fc3Vic2NyaXB0aW9ucywgaWQpKSB7XG4gICAgICAgICAgc2VsZi5fc3Vic2NyaXB0aW9uc1tpZF0uaW5hY3RpdmUgPSB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgVHJhY2tlci5hZnRlckZsdXNoKCgpID0+IHtcbiAgICAgICAgICBpZiAoaGFzT3duLmNhbGwoc2VsZi5fc3Vic2NyaXB0aW9ucywgaWQpICYmXG4gICAgICAgICAgICAgIHNlbGYuX3N1YnNjcmlwdGlvbnNbaWRdLmluYWN0aXZlKSB7XG4gICAgICAgICAgICBoYW5kbGUuc3RvcCgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gaGFuZGxlO1xuICB9XG5cbiAgLy8gb3B0aW9uczpcbiAgLy8gLSBvbkxhdGVFcnJvciB7RnVuY3Rpb24oZXJyb3IpfSBjYWxsZWQgaWYgYW4gZXJyb3Igd2FzIHJlY2VpdmVkIGFmdGVyIHRoZSByZWFkeSBldmVudC5cbiAgLy8gICAgIChlcnJvcnMgcmVjZWl2ZWQgYmVmb3JlIHJlYWR5IGNhdXNlIGFuIGVycm9yIHRvIGJlIHRocm93bilcbiAgX3N1YnNjcmliZUFuZFdhaXQobmFtZSwgYXJncywgb3B0aW9ucykge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIGNvbnN0IGYgPSBuZXcgRnV0dXJlKCk7XG4gICAgbGV0IHJlYWR5ID0gZmFsc2U7XG4gICAgYXJncyA9IGFyZ3MgfHwgW107XG4gICAgYXJncy5wdXNoKHtcbiAgICAgIG9uUmVhZHkoKSB7XG4gICAgICAgIHJlYWR5ID0gdHJ1ZTtcbiAgICAgICAgZlsncmV0dXJuJ10oKTtcbiAgICAgIH0sXG4gICAgICBvbkVycm9yKGUpIHtcbiAgICAgICAgaWYgKCFyZWFkeSkgZlsndGhyb3cnXShlKTtcbiAgICAgICAgZWxzZSBvcHRpb25zICYmIG9wdGlvbnMub25MYXRlRXJyb3IgJiYgb3B0aW9ucy5vbkxhdGVFcnJvcihlKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGNvbnN0IGhhbmRsZSA9IHNlbGYuc3Vic2NyaWJlLmFwcGx5KHNlbGYsIFtuYW1lXS5jb25jYXQoYXJncykpO1xuICAgIGYud2FpdCgpO1xuICAgIHJldHVybiBoYW5kbGU7XG4gIH1cblxuICBtZXRob2RzKG1ldGhvZHMpIHtcbiAgICBPYmplY3QuZW50cmllcyhtZXRob2RzKS5mb3JFYWNoKChbbmFtZSwgZnVuY10pID0+IHtcbiAgICAgIGlmICh0eXBlb2YgZnVuYyAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJNZXRob2QgJ1wiICsgbmFtZSArIFwiJyBtdXN0IGJlIGEgZnVuY3Rpb25cIik7XG4gICAgICB9XG4gICAgICBpZiAodGhpcy5fbWV0aG9kSGFuZGxlcnNbbmFtZV0pIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQSBtZXRob2QgbmFtZWQgJ1wiICsgbmFtZSArIFwiJyBpcyBhbHJlYWR5IGRlZmluZWRcIik7XG4gICAgICB9XG4gICAgICB0aGlzLl9tZXRob2RIYW5kbGVyc1tuYW1lXSA9IGZ1bmM7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogQG1lbWJlck9mIE1ldGVvclxuICAgKiBAaW1wb3J0RnJvbVBhY2thZ2UgbWV0ZW9yXG4gICAqIEBhbGlhcyBNZXRlb3IuY2FsbFxuICAgKiBAc3VtbWFyeSBJbnZva2VzIGEgbWV0aG9kIHBhc3NpbmcgYW55IG51bWJlciBvZiBhcmd1bWVudHMuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbmFtZSBOYW1lIG9mIG1ldGhvZCB0byBpbnZva2VcbiAgICogQHBhcmFtIHtFSlNPTmFibGV9IFthcmcxLGFyZzIuLi5dIE9wdGlvbmFsIG1ldGhvZCBhcmd1bWVudHNcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2FzeW5jQ2FsbGJhY2tdIE9wdGlvbmFsIGNhbGxiYWNrLCB3aGljaCBpcyBjYWxsZWQgYXN5bmNocm9ub3VzbHkgd2l0aCB0aGUgZXJyb3Igb3IgcmVzdWx0IGFmdGVyIHRoZSBtZXRob2QgaXMgY29tcGxldGUuIElmIG5vdCBwcm92aWRlZCwgdGhlIG1ldGhvZCBydW5zIHN5bmNocm9ub3VzbHkgaWYgcG9zc2libGUgKHNlZSBiZWxvdykuXG4gICAqL1xuICBjYWxsKG5hbWUgLyogLi4gW2FyZ3VtZW50c10gLi4gY2FsbGJhY2sgKi8pIHtcbiAgICAvLyBpZiBpdCdzIGEgZnVuY3Rpb24sIHRoZSBsYXN0IGFyZ3VtZW50IGlzIHRoZSByZXN1bHQgY2FsbGJhY2ssXG4gICAgLy8gbm90IGEgcGFyYW1ldGVyIHRvIHRoZSByZW1vdGUgbWV0aG9kLlxuICAgIGNvbnN0IGFyZ3MgPSBzbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgbGV0IGNhbGxiYWNrO1xuICAgIGlmIChhcmdzLmxlbmd0aCAmJiB0eXBlb2YgYXJnc1thcmdzLmxlbmd0aCAtIDFdID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICBjYWxsYmFjayA9IGFyZ3MucG9wKCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmFwcGx5KG5hbWUsIGFyZ3MsIGNhbGxiYWNrKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAbWVtYmVyT2YgTWV0ZW9yXG4gICAqIEBpbXBvcnRGcm9tUGFja2FnZSBtZXRlb3JcbiAgICogQGFsaWFzIE1ldGVvci5hcHBseVxuICAgKiBAc3VtbWFyeSBJbnZva2UgYSBtZXRob2QgcGFzc2luZyBhbiBhcnJheSBvZiBhcmd1bWVudHMuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbmFtZSBOYW1lIG9mIG1ldGhvZCB0byBpbnZva2VcbiAgICogQHBhcmFtIHtFSlNPTmFibGVbXX0gYXJncyBNZXRob2QgYXJndW1lbnRzXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc11cbiAgICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLndhaXQgKENsaWVudCBvbmx5KSBJZiB0cnVlLCBkb24ndCBzZW5kIHRoaXMgbWV0aG9kIHVudGlsIGFsbCBwcmV2aW91cyBtZXRob2QgY2FsbHMgaGF2ZSBjb21wbGV0ZWQsIGFuZCBkb24ndCBzZW5kIGFueSBzdWJzZXF1ZW50IG1ldGhvZCBjYWxscyB1bnRpbCB0aGlzIG9uZSBpcyBjb21wbGV0ZWQuXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IG9wdGlvbnMub25SZXN1bHRSZWNlaXZlZCAoQ2xpZW50IG9ubHkpIFRoaXMgY2FsbGJhY2sgaXMgaW52b2tlZCB3aXRoIHRoZSBlcnJvciBvciByZXN1bHQgb2YgdGhlIG1ldGhvZCAoanVzdCBsaWtlIGBhc3luY0NhbGxiYWNrYCkgYXMgc29vbiBhcyB0aGUgZXJyb3Igb3IgcmVzdWx0IGlzIGF2YWlsYWJsZS4gVGhlIGxvY2FsIGNhY2hlIG1heSBub3QgeWV0IHJlZmxlY3QgdGhlIHdyaXRlcyBwZXJmb3JtZWQgYnkgdGhlIG1ldGhvZC5cbiAgICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLm5vUmV0cnkgKENsaWVudCBvbmx5KSBpZiB0cnVlLCBkb24ndCBzZW5kIHRoaXMgbWV0aG9kIGFnYWluIG9uIHJlbG9hZCwgc2ltcGx5IGNhbGwgdGhlIGNhbGxiYWNrIGFuIGVycm9yIHdpdGggdGhlIGVycm9yIGNvZGUgJ2ludm9jYXRpb24tZmFpbGVkJy5cbiAgICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLnRocm93U3R1YkV4Y2VwdGlvbnMgKENsaWVudCBvbmx5KSBJZiB0cnVlLCBleGNlcHRpb25zIHRocm93biBieSBtZXRob2Qgc3R1YnMgd2lsbCBiZSB0aHJvd24gaW5zdGVhZCBvZiBsb2dnZWQsIGFuZCB0aGUgbWV0aG9kIHdpbGwgbm90IGJlIGludm9rZWQgb24gdGhlIHNlcnZlci5cbiAgICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLnJldHVyblN0dWJWYWx1ZSAoQ2xpZW50IG9ubHkpIElmIHRydWUgdGhlbiBpbiBjYXNlcyB3aGVyZSB3ZSB3b3VsZCBoYXZlIG90aGVyd2lzZSBkaXNjYXJkZWQgdGhlIHN0dWIncyByZXR1cm4gdmFsdWUgYW5kIHJldHVybmVkIHVuZGVmaW5lZCwgaW5zdGVhZCB3ZSBnbyBhaGVhZCBhbmQgcmV0dXJuIGl0LiBTcGVjaWZpY2FsbHksIHRoaXMgaXMgYW55IHRpbWUgb3RoZXIgdGhhbiB3aGVuIChhKSB3ZSBhcmUgYWxyZWFkeSBpbnNpZGUgYSBzdHViIG9yIChiKSB3ZSBhcmUgaW4gTm9kZSBhbmQgbm8gY2FsbGJhY2sgd2FzIHByb3ZpZGVkLiBDdXJyZW50bHkgd2UgcmVxdWlyZSB0aGlzIGZsYWcgdG8gYmUgZXhwbGljaXRseSBwYXNzZWQgdG8gcmVkdWNlIHRoZSBsaWtlbGlob29kIHRoYXQgc3R1YiByZXR1cm4gdmFsdWVzIHdpbGwgYmUgY29uZnVzZWQgd2l0aCBzZXJ2ZXIgcmV0dXJuIHZhbHVlczsgd2UgbWF5IGltcHJvdmUgdGhpcyBpbiBmdXR1cmUuXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IFthc3luY0NhbGxiYWNrXSBPcHRpb25hbCBjYWxsYmFjazsgc2FtZSBzZW1hbnRpY3MgYXMgaW4gW2BNZXRlb3IuY2FsbGBdKCNtZXRlb3JfY2FsbCkuXG4gICAqL1xuICBhcHBseShuYW1lLCBhcmdzLCBvcHRpb25zLCBjYWxsYmFjaykge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuXG4gICAgLy8gV2Ugd2VyZSBwYXNzZWQgMyBhcmd1bWVudHMuIFRoZXkgbWF5IGJlIGVpdGhlciAobmFtZSwgYXJncywgb3B0aW9ucylcbiAgICAvLyBvciAobmFtZSwgYXJncywgY2FsbGJhY2spXG4gICAgaWYgKCFjYWxsYmFjayAmJiB0eXBlb2Ygb3B0aW9ucyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgY2FsbGJhY2sgPSBvcHRpb25zO1xuICAgICAgb3B0aW9ucyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gICAgfVxuICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cbiAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgIC8vIFhYWCB3b3VsZCBpdCBiZSBiZXR0ZXIgZm9ybSB0byBkbyB0aGUgYmluZGluZyBpbiBzdHJlYW0ub24sXG4gICAgICAvLyBvciBjYWxsZXIsIGluc3RlYWQgb2YgaGVyZT9cbiAgICAgIC8vIFhYWCBpbXByb3ZlIGVycm9yIG1lc3NhZ2UgKGFuZCBob3cgd2UgcmVwb3J0IGl0KVxuICAgICAgY2FsbGJhY2sgPSBNZXRlb3IuYmluZEVudmlyb25tZW50KFxuICAgICAgICBjYWxsYmFjayxcbiAgICAgICAgXCJkZWxpdmVyaW5nIHJlc3VsdCBvZiBpbnZva2luZyAnXCIgKyBuYW1lICsgXCInXCJcbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gS2VlcCBvdXIgYXJncyBzYWZlIGZyb20gbXV0YXRpb24gKGVnIGlmIHdlIGRvbid0IHNlbmQgdGhlIG1lc3NhZ2UgZm9yIGFcbiAgICAvLyB3aGlsZSBiZWNhdXNlIG9mIGEgd2FpdCBtZXRob2QpLlxuICAgIGFyZ3MgPSBFSlNPTi5jbG9uZShhcmdzKTtcblxuICAgIGNvbnN0IGVuY2xvc2luZyA9IEREUC5fQ3VycmVudE1ldGhvZEludm9jYXRpb24uZ2V0KCk7XG4gICAgY29uc3QgYWxyZWFkeUluU2ltdWxhdGlvbiA9IGVuY2xvc2luZyAmJiBlbmNsb3NpbmcuaXNTaW11bGF0aW9uO1xuXG4gICAgLy8gTGF6aWx5IGdlbmVyYXRlIGEgcmFuZG9tU2VlZCwgb25seSBpZiBpdCBpcyByZXF1ZXN0ZWQgYnkgdGhlIHN0dWIuXG4gICAgLy8gVGhlIHJhbmRvbSBzdHJlYW1zIG9ubHkgaGF2ZSB1dGlsaXR5IGlmIHRoZXkncmUgdXNlZCBvbiBib3RoIHRoZSBjbGllbnRcbiAgICAvLyBhbmQgdGhlIHNlcnZlcjsgaWYgdGhlIGNsaWVudCBkb2Vzbid0IGdlbmVyYXRlIGFueSAncmFuZG9tJyB2YWx1ZXNcbiAgICAvLyB0aGVuIHdlIGRvbid0IGV4cGVjdCB0aGUgc2VydmVyIHRvIGdlbmVyYXRlIGFueSBlaXRoZXIuXG4gICAgLy8gTGVzcyBjb21tb25seSwgdGhlIHNlcnZlciBtYXkgcGVyZm9ybSBkaWZmZXJlbnQgYWN0aW9ucyBmcm9tIHRoZSBjbGllbnQsXG4gICAgLy8gYW5kIG1heSBpbiBmYWN0IGdlbmVyYXRlIHZhbHVlcyB3aGVyZSB0aGUgY2xpZW50IGRpZCBub3QsIGJ1dCB3ZSBkb24ndFxuICAgIC8vIGhhdmUgYW55IGNsaWVudC1zaWRlIHZhbHVlcyB0byBtYXRjaCwgc28gZXZlbiBoZXJlIHdlIG1heSBhcyB3ZWxsIGp1c3RcbiAgICAvLyB1c2UgYSByYW5kb20gc2VlZCBvbiB0aGUgc2VydmVyLiAgSW4gdGhhdCBjYXNlLCB3ZSBkb24ndCBwYXNzIHRoZVxuICAgIC8vIHJhbmRvbVNlZWQgdG8gc2F2ZSBiYW5kd2lkdGgsIGFuZCB3ZSBkb24ndCBldmVuIGdlbmVyYXRlIGl0IHRvIHNhdmUgYVxuICAgIC8vIGJpdCBvZiBDUFUgYW5kIHRvIGF2b2lkIGNvbnN1bWluZyBlbnRyb3B5LlxuICAgIGxldCByYW5kb21TZWVkID0gbnVsbDtcbiAgICBjb25zdCByYW5kb21TZWVkR2VuZXJhdG9yID0gKCkgPT4ge1xuICAgICAgaWYgKHJhbmRvbVNlZWQgPT09IG51bGwpIHtcbiAgICAgICAgcmFuZG9tU2VlZCA9IEREUENvbW1vbi5tYWtlUnBjU2VlZChlbmNsb3NpbmcsIG5hbWUpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHJhbmRvbVNlZWQ7XG4gICAgfTtcblxuICAgIC8vIFJ1biB0aGUgc3R1YiwgaWYgd2UgaGF2ZSBvbmUuIFRoZSBzdHViIGlzIHN1cHBvc2VkIHRvIG1ha2Ugc29tZVxuICAgIC8vIHRlbXBvcmFyeSB3cml0ZXMgdG8gdGhlIGRhdGFiYXNlIHRvIGdpdmUgdGhlIHVzZXIgYSBzbW9vdGggZXhwZXJpZW5jZVxuICAgIC8vIHVudGlsIHRoZSBhY3R1YWwgcmVzdWx0IG9mIGV4ZWN1dGluZyB0aGUgbWV0aG9kIGNvbWVzIGJhY2sgZnJvbSB0aGVcbiAgICAvLyBzZXJ2ZXIgKHdoZXJldXBvbiB0aGUgdGVtcG9yYXJ5IHdyaXRlcyB0byB0aGUgZGF0YWJhc2Ugd2lsbCBiZSByZXZlcnNlZFxuICAgIC8vIGR1cmluZyB0aGUgYmVnaW5VcGRhdGUvZW5kVXBkYXRlIHByb2Nlc3MuKVxuICAgIC8vXG4gICAgLy8gTm9ybWFsbHksIHdlIGlnbm9yZSB0aGUgcmV0dXJuIHZhbHVlIG9mIHRoZSBzdHViIChldmVuIGlmIGl0IGlzIGFuXG4gICAgLy8gZXhjZXB0aW9uKSwgaW4gZmF2b3Igb2YgdGhlIHJlYWwgcmV0dXJuIHZhbHVlIGZyb20gdGhlIHNlcnZlci4gVGhlXG4gICAgLy8gZXhjZXB0aW9uIGlzIGlmIHRoZSAqY2FsbGVyKiBpcyBhIHN0dWIuIEluIHRoYXQgY2FzZSwgd2UncmUgbm90IGdvaW5nXG4gICAgLy8gdG8gZG8gYSBSUEMsIHNvIHdlIHVzZSB0aGUgcmV0dXJuIHZhbHVlIG9mIHRoZSBzdHViIGFzIG91ciByZXR1cm5cbiAgICAvLyB2YWx1ZS5cblxuICAgIGxldCBzdHViUmV0dXJuVmFsdWU7XG4gICAgbGV0IGV4Y2VwdGlvbjtcbiAgICBjb25zdCBzdHViID0gc2VsZi5fbWV0aG9kSGFuZGxlcnNbbmFtZV07XG4gICAgaWYgKHN0dWIpIHtcbiAgICAgIGNvbnN0IHNldFVzZXJJZCA9IHVzZXJJZCA9PiB7XG4gICAgICAgIHNlbGYuc2V0VXNlcklkKHVzZXJJZCk7XG4gICAgICB9O1xuXG4gICAgICBjb25zdCBpbnZvY2F0aW9uID0gbmV3IEREUENvbW1vbi5NZXRob2RJbnZvY2F0aW9uKHtcbiAgICAgICAgaXNTaW11bGF0aW9uOiB0cnVlLFxuICAgICAgICB1c2VySWQ6IHNlbGYudXNlcklkKCksXG4gICAgICAgIHNldFVzZXJJZDogc2V0VXNlcklkLFxuICAgICAgICByYW5kb21TZWVkKCkge1xuICAgICAgICAgIHJldHVybiByYW5kb21TZWVkR2VuZXJhdG9yKCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICBpZiAoIWFscmVhZHlJblNpbXVsYXRpb24pIHNlbGYuX3NhdmVPcmlnaW5hbHMoKTtcblxuICAgICAgdHJ5IHtcbiAgICAgICAgLy8gTm90ZSB0aGF0IHVubGlrZSBpbiB0aGUgY29ycmVzcG9uZGluZyBzZXJ2ZXIgY29kZSwgd2UgbmV2ZXIgYXVkaXRcbiAgICAgICAgLy8gdGhhdCBzdHVicyBjaGVjaygpIHRoZWlyIGFyZ3VtZW50cy5cbiAgICAgICAgc3R1YlJldHVyblZhbHVlID0gRERQLl9DdXJyZW50TWV0aG9kSW52b2NhdGlvbi53aXRoVmFsdWUoXG4gICAgICAgICAgaW52b2NhdGlvbixcbiAgICAgICAgICAoKSA9PiB7XG4gICAgICAgICAgICBpZiAoTWV0ZW9yLmlzU2VydmVyKSB7XG4gICAgICAgICAgICAgIC8vIEJlY2F1c2Ugc2F2ZU9yaWdpbmFscyBhbmQgcmV0cmlldmVPcmlnaW5hbHMgYXJlbid0IHJlZW50cmFudCxcbiAgICAgICAgICAgICAgLy8gZG9uJ3QgYWxsb3cgc3R1YnMgdG8geWllbGQuXG4gICAgICAgICAgICAgIHJldHVybiBNZXRlb3IuX25vWWllbGRzQWxsb3dlZCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgLy8gcmUtY2xvbmUsIHNvIHRoYXQgdGhlIHN0dWIgY2FuJ3QgYWZmZWN0IG91ciBjYWxsZXIncyB2YWx1ZXNcbiAgICAgICAgICAgICAgICByZXR1cm4gc3R1Yi5hcHBseShpbnZvY2F0aW9uLCBFSlNPTi5jbG9uZShhcmdzKSk7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHN0dWIuYXBwbHkoaW52b2NhdGlvbiwgRUpTT04uY2xvbmUoYXJncykpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgZXhjZXB0aW9uID0gZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBJZiB3ZSdyZSBpbiBhIHNpbXVsYXRpb24sIHN0b3AgYW5kIHJldHVybiB0aGUgcmVzdWx0IHdlIGhhdmUsXG4gICAgLy8gcmF0aGVyIHRoYW4gZ29pbmcgb24gdG8gZG8gYW4gUlBDLiBJZiB0aGVyZSB3YXMgbm8gc3R1YixcbiAgICAvLyB3ZSdsbCBlbmQgdXAgcmV0dXJuaW5nIHVuZGVmaW5lZC5cbiAgICBpZiAoYWxyZWFkeUluU2ltdWxhdGlvbikge1xuICAgICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgIGNhbGxiYWNrKGV4Y2VwdGlvbiwgc3R1YlJldHVyblZhbHVlKTtcbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgIH1cbiAgICAgIGlmIChleGNlcHRpb24pIHRocm93IGV4Y2VwdGlvbjtcbiAgICAgIHJldHVybiBzdHViUmV0dXJuVmFsdWU7XG4gICAgfVxuXG4gICAgLy8gV2Ugb25seSBjcmVhdGUgdGhlIG1ldGhvZElkIGhlcmUgYmVjYXVzZSB3ZSBkb24ndCBhY3R1YWxseSBuZWVkIG9uZSBpZlxuICAgIC8vIHdlJ3JlIGFscmVhZHkgaW4gYSBzaW11bGF0aW9uXG4gICAgY29uc3QgbWV0aG9kSWQgPSAnJyArIHNlbGYuX25leHRNZXRob2RJZCsrO1xuICAgIGlmIChzdHViKSB7XG4gICAgICBzZWxmLl9yZXRyaWV2ZUFuZFN0b3JlT3JpZ2luYWxzKG1ldGhvZElkKTtcbiAgICB9XG5cbiAgICAvLyBHZW5lcmF0ZSB0aGUgRERQIG1lc3NhZ2UgZm9yIHRoZSBtZXRob2QgY2FsbC4gTm90ZSB0aGF0IG9uIHRoZSBjbGllbnQsXG4gICAgLy8gaXQgaXMgaW1wb3J0YW50IHRoYXQgdGhlIHN0dWIgaGF2ZSBmaW5pc2hlZCBiZWZvcmUgd2Ugc2VuZCB0aGUgUlBDLCBzb1xuICAgIC8vIHRoYXQgd2Uga25vdyB3ZSBoYXZlIGEgY29tcGxldGUgbGlzdCBvZiB3aGljaCBsb2NhbCBkb2N1bWVudHMgdGhlIHN0dWJcbiAgICAvLyB3cm90ZS5cbiAgICBjb25zdCBtZXNzYWdlID0ge1xuICAgICAgbXNnOiAnbWV0aG9kJyxcbiAgICAgIG1ldGhvZDogbmFtZSxcbiAgICAgIHBhcmFtczogYXJncyxcbiAgICAgIGlkOiBtZXRob2RJZFxuICAgIH07XG5cbiAgICAvLyBJZiBhbiBleGNlcHRpb24gb2NjdXJyZWQgaW4gYSBzdHViLCBhbmQgd2UncmUgaWdub3JpbmcgaXRcbiAgICAvLyBiZWNhdXNlIHdlJ3JlIGRvaW5nIGFuIFJQQyBhbmQgd2FudCB0byB1c2Ugd2hhdCB0aGUgc2VydmVyXG4gICAgLy8gcmV0dXJucyBpbnN0ZWFkLCBsb2cgaXQgc28gdGhlIGRldmVsb3BlciBrbm93c1xuICAgIC8vICh1bmxlc3MgdGhleSBleHBsaWNpdGx5IGFzayB0byBzZWUgdGhlIGVycm9yKS5cbiAgICAvL1xuICAgIC8vIFRlc3RzIGNhbiBzZXQgdGhlICdfZXhwZWN0ZWRCeVRlc3QnIGZsYWcgb24gYW4gZXhjZXB0aW9uIHNvIGl0IHdvbid0XG4gICAgLy8gZ28gdG8gbG9nLlxuICAgIGlmIChleGNlcHRpb24pIHtcbiAgICAgIGlmIChvcHRpb25zLnRocm93U3R1YkV4Y2VwdGlvbnMpIHtcbiAgICAgICAgdGhyb3cgZXhjZXB0aW9uO1xuICAgICAgfSBlbHNlIGlmICghZXhjZXB0aW9uLl9leHBlY3RlZEJ5VGVzdCkge1xuICAgICAgICBNZXRlb3IuX2RlYnVnKFxuICAgICAgICAgIFwiRXhjZXB0aW9uIHdoaWxlIHNpbXVsYXRpbmcgdGhlIGVmZmVjdCBvZiBpbnZva2luZyAnXCIgKyBuYW1lICsgXCInXCIsXG4gICAgICAgICAgZXhjZXB0aW9uXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gQXQgdGhpcyBwb2ludCB3ZSdyZSBkZWZpbml0ZWx5IGRvaW5nIGFuIFJQQywgYW5kIHdlJ3JlIGdvaW5nIHRvXG4gICAgLy8gcmV0dXJuIHRoZSB2YWx1ZSBvZiB0aGUgUlBDIHRvIHRoZSBjYWxsZXIuXG5cbiAgICAvLyBJZiB0aGUgY2FsbGVyIGRpZG4ndCBnaXZlIGEgY2FsbGJhY2ssIGRlY2lkZSB3aGF0IHRvIGRvLlxuICAgIGxldCBmdXR1cmU7XG4gICAgaWYgKCFjYWxsYmFjaykge1xuICAgICAgaWYgKE1ldGVvci5pc0NsaWVudCkge1xuICAgICAgICAvLyBPbiB0aGUgY2xpZW50LCB3ZSBkb24ndCBoYXZlIGZpYmVycywgc28gd2UgY2FuJ3QgYmxvY2suIFRoZVxuICAgICAgICAvLyBvbmx5IHRoaW5nIHdlIGNhbiBkbyBpcyB0byByZXR1cm4gdW5kZWZpbmVkIGFuZCBkaXNjYXJkIHRoZVxuICAgICAgICAvLyByZXN1bHQgb2YgdGhlIFJQQy4gSWYgYW4gZXJyb3Igb2NjdXJyZWQgdGhlbiBwcmludCB0aGUgZXJyb3JcbiAgICAgICAgLy8gdG8gdGhlIGNvbnNvbGUuXG4gICAgICAgIGNhbGxiYWNrID0gZXJyID0+IHtcbiAgICAgICAgICBlcnIgJiYgTWV0ZW9yLl9kZWJ1ZyhcIkVycm9yIGludm9raW5nIE1ldGhvZCAnXCIgKyBuYW1lICsgXCInXCIsIGVycik7XG4gICAgICAgIH07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBPbiB0aGUgc2VydmVyLCBtYWtlIHRoZSBmdW5jdGlvbiBzeW5jaHJvbm91cy4gVGhyb3cgb25cbiAgICAgICAgLy8gZXJyb3JzLCByZXR1cm4gb24gc3VjY2Vzcy5cbiAgICAgICAgZnV0dXJlID0gbmV3IEZ1dHVyZSgpO1xuICAgICAgICBjYWxsYmFjayA9IGZ1dHVyZS5yZXNvbHZlcigpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIFNlbmQgdGhlIHJhbmRvbVNlZWQgb25seSBpZiB3ZSB1c2VkIGl0XG4gICAgaWYgKHJhbmRvbVNlZWQgIT09IG51bGwpIHtcbiAgICAgIG1lc3NhZ2UucmFuZG9tU2VlZCA9IHJhbmRvbVNlZWQ7XG4gICAgfVxuXG4gICAgY29uc3QgbWV0aG9kSW52b2tlciA9IG5ldyBNZXRob2RJbnZva2VyKHtcbiAgICAgIG1ldGhvZElkLFxuICAgICAgY2FsbGJhY2s6IGNhbGxiYWNrLFxuICAgICAgY29ubmVjdGlvbjogc2VsZixcbiAgICAgIG9uUmVzdWx0UmVjZWl2ZWQ6IG9wdGlvbnMub25SZXN1bHRSZWNlaXZlZCxcbiAgICAgIHdhaXQ6ICEhb3B0aW9ucy53YWl0LFxuICAgICAgbWVzc2FnZTogbWVzc2FnZSxcbiAgICAgIG5vUmV0cnk6ICEhb3B0aW9ucy5ub1JldHJ5XG4gICAgfSk7XG5cbiAgICBpZiAob3B0aW9ucy53YWl0KSB7XG4gICAgICAvLyBJdCdzIGEgd2FpdCBtZXRob2QhIFdhaXQgbWV0aG9kcyBnbyBpbiB0aGVpciBvd24gYmxvY2suXG4gICAgICBzZWxmLl9vdXRzdGFuZGluZ01ldGhvZEJsb2Nrcy5wdXNoKHtcbiAgICAgICAgd2FpdDogdHJ1ZSxcbiAgICAgICAgbWV0aG9kczogW21ldGhvZEludm9rZXJdXG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gTm90IGEgd2FpdCBtZXRob2QuIFN0YXJ0IGEgbmV3IGJsb2NrIGlmIHRoZSBwcmV2aW91cyBibG9jayB3YXMgYSB3YWl0XG4gICAgICAvLyBibG9jaywgYW5kIGFkZCBpdCB0byB0aGUgbGFzdCBibG9jayBvZiBtZXRob2RzLlxuICAgICAgaWYgKGlzRW1wdHkoc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MpIHx8XG4gICAgICAgICAgbGFzdChzZWxmLl9vdXRzdGFuZGluZ01ldGhvZEJsb2Nrcykud2FpdCkge1xuICAgICAgICBzZWxmLl9vdXRzdGFuZGluZ01ldGhvZEJsb2Nrcy5wdXNoKHtcbiAgICAgICAgICB3YWl0OiBmYWxzZSxcbiAgICAgICAgICBtZXRob2RzOiBbXSxcbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIGxhc3Qoc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MpLm1ldGhvZHMucHVzaChtZXRob2RJbnZva2VyKTtcbiAgICB9XG5cbiAgICAvLyBJZiB3ZSBhZGRlZCBpdCB0byB0aGUgZmlyc3QgYmxvY2ssIHNlbmQgaXQgb3V0IG5vdy5cbiAgICBpZiAoc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MubGVuZ3RoID09PSAxKSBtZXRob2RJbnZva2VyLnNlbmRNZXNzYWdlKCk7XG5cbiAgICAvLyBJZiB3ZSdyZSB1c2luZyB0aGUgZGVmYXVsdCBjYWxsYmFjayBvbiB0aGUgc2VydmVyLFxuICAgIC8vIGJsb2NrIHdhaXRpbmcgZm9yIHRoZSByZXN1bHQuXG4gICAgaWYgKGZ1dHVyZSkge1xuICAgICAgcmV0dXJuIGZ1dHVyZS53YWl0KCk7XG4gICAgfVxuICAgIHJldHVybiBvcHRpb25zLnJldHVyblN0dWJWYWx1ZSA/IHN0dWJSZXR1cm5WYWx1ZSA6IHVuZGVmaW5lZDtcbiAgfVxuXG4gIC8vIEJlZm9yZSBjYWxsaW5nIGEgbWV0aG9kIHN0dWIsIHByZXBhcmUgYWxsIHN0b3JlcyB0byB0cmFjayBjaGFuZ2VzIGFuZCBhbGxvd1xuICAvLyBfcmV0cmlldmVBbmRTdG9yZU9yaWdpbmFscyB0byBnZXQgdGhlIG9yaWdpbmFsIHZlcnNpb25zIG9mIGNoYW5nZWRcbiAgLy8gZG9jdW1lbnRzLlxuICBfc2F2ZU9yaWdpbmFscygpIHtcbiAgICBpZiAoISB0aGlzLl93YWl0aW5nRm9yUXVpZXNjZW5jZSgpKSB7XG4gICAgICB0aGlzLl9mbHVzaEJ1ZmZlcmVkV3JpdGVzKCk7XG4gICAgfVxuXG4gICAgT2JqZWN0LnZhbHVlcyh0aGlzLl9zdG9yZXMpLmZvckVhY2goKHN0b3JlKSA9PiB7XG4gICAgICBzdG9yZS5zYXZlT3JpZ2luYWxzKCk7XG4gICAgfSk7XG4gIH1cblxuICAvLyBSZXRyaWV2ZXMgdGhlIG9yaWdpbmFsIHZlcnNpb25zIG9mIGFsbCBkb2N1bWVudHMgbW9kaWZpZWQgYnkgdGhlIHN0dWIgZm9yXG4gIC8vIG1ldGhvZCAnbWV0aG9kSWQnIGZyb20gYWxsIHN0b3JlcyBhbmQgc2F2ZXMgdGhlbSB0byBfc2VydmVyRG9jdW1lbnRzIChrZXllZFxuICAvLyBieSBkb2N1bWVudCkgYW5kIF9kb2N1bWVudHNXcml0dGVuQnlTdHViIChrZXllZCBieSBtZXRob2QgSUQpLlxuICBfcmV0cmlldmVBbmRTdG9yZU9yaWdpbmFscyhtZXRob2RJZCkge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIGlmIChzZWxmLl9kb2N1bWVudHNXcml0dGVuQnlTdHViW21ldGhvZElkXSlcbiAgICAgIHRocm93IG5ldyBFcnJvcignRHVwbGljYXRlIG1ldGhvZElkIGluIF9yZXRyaWV2ZUFuZFN0b3JlT3JpZ2luYWxzJyk7XG5cbiAgICBjb25zdCBkb2NzV3JpdHRlbiA9IFtdO1xuXG4gICAgT2JqZWN0LmVudHJpZXMoc2VsZi5fc3RvcmVzKS5mb3JFYWNoKChbY29sbGVjdGlvbiwgc3RvcmVdKSA9PiB7XG4gICAgICBjb25zdCBvcmlnaW5hbHMgPSBzdG9yZS5yZXRyaWV2ZU9yaWdpbmFscygpO1xuICAgICAgLy8gbm90IGFsbCBzdG9yZXMgZGVmaW5lIHJldHJpZXZlT3JpZ2luYWxzXG4gICAgICBpZiAoISBvcmlnaW5hbHMpIHJldHVybjtcbiAgICAgIG9yaWdpbmFscy5mb3JFYWNoKChkb2MsIGlkKSA9PiB7XG4gICAgICAgIGRvY3NXcml0dGVuLnB1c2goeyBjb2xsZWN0aW9uLCBpZCB9KTtcbiAgICAgICAgaWYgKCEgaGFzT3duLmNhbGwoc2VsZi5fc2VydmVyRG9jdW1lbnRzLCBjb2xsZWN0aW9uKSkge1xuICAgICAgICAgIHNlbGYuX3NlcnZlckRvY3VtZW50c1tjb2xsZWN0aW9uXSA9IG5ldyBNb25nb0lETWFwKCk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3Qgc2VydmVyRG9jID0gc2VsZi5fc2VydmVyRG9jdW1lbnRzW2NvbGxlY3Rpb25dLnNldERlZmF1bHQoXG4gICAgICAgICAgaWQsXG4gICAgICAgICAgT2JqZWN0LmNyZWF0ZShudWxsKVxuICAgICAgICApO1xuICAgICAgICBpZiAoc2VydmVyRG9jLndyaXR0ZW5CeVN0dWJzKSB7XG4gICAgICAgICAgLy8gV2UncmUgbm90IHRoZSBmaXJzdCBzdHViIHRvIHdyaXRlIHRoaXMgZG9jLiBKdXN0IGFkZCBvdXIgbWV0aG9kIElEXG4gICAgICAgICAgLy8gdG8gdGhlIHJlY29yZC5cbiAgICAgICAgICBzZXJ2ZXJEb2Mud3JpdHRlbkJ5U3R1YnNbbWV0aG9kSWRdID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBGaXJzdCBzdHViISBTYXZlIHRoZSBvcmlnaW5hbCB2YWx1ZSBhbmQgb3VyIG1ldGhvZCBJRC5cbiAgICAgICAgICBzZXJ2ZXJEb2MuZG9jdW1lbnQgPSBkb2M7XG4gICAgICAgICAgc2VydmVyRG9jLmZsdXNoQ2FsbGJhY2tzID0gW107XG4gICAgICAgICAgc2VydmVyRG9jLndyaXR0ZW5CeVN0dWJzID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgICAgICAgICBzZXJ2ZXJEb2Mud3JpdHRlbkJ5U3R1YnNbbWV0aG9kSWRdID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gICAgaWYgKCEgaXNFbXB0eShkb2NzV3JpdHRlbikpIHtcbiAgICAgIHNlbGYuX2RvY3VtZW50c1dyaXR0ZW5CeVN0dWJbbWV0aG9kSWRdID0gZG9jc1dyaXR0ZW47XG4gICAgfVxuICB9XG5cbiAgLy8gVGhpcyBpcyB2ZXJ5IG11Y2ggYSBwcml2YXRlIGZ1bmN0aW9uIHdlIHVzZSB0byBtYWtlIHRoZSB0ZXN0c1xuICAvLyB0YWtlIHVwIGZld2VyIHNlcnZlciByZXNvdXJjZXMgYWZ0ZXIgdGhleSBjb21wbGV0ZS5cbiAgX3Vuc3Vic2NyaWJlQWxsKCkge1xuICAgIE9iamVjdC52YWx1ZXModGhpcy5fc3Vic2NyaXB0aW9ucykuZm9yRWFjaCgoc3ViKSA9PiB7XG4gICAgICAvLyBBdm9pZCBraWxsaW5nIHRoZSBhdXRvdXBkYXRlIHN1YnNjcmlwdGlvbiBzbyB0aGF0IGRldmVsb3BlcnNcbiAgICAgIC8vIHN0aWxsIGdldCBob3QgY29kZSBwdXNoZXMgd2hlbiB3cml0aW5nIHRlc3RzLlxuICAgICAgLy9cbiAgICAgIC8vIFhYWCBpdCdzIGEgaGFjayB0byBlbmNvZGUga25vd2xlZGdlIGFib3V0IGF1dG91cGRhdGUgaGVyZSxcbiAgICAgIC8vIGJ1dCBpdCBkb2Vzbid0IHNlZW0gd29ydGggaXQgeWV0IHRvIGhhdmUgYSBzcGVjaWFsIEFQSSBmb3JcbiAgICAgIC8vIHN1YnNjcmlwdGlvbnMgdG8gcHJlc2VydmUgYWZ0ZXIgdW5pdCB0ZXN0cy5cbiAgICAgIGlmIChzdWIubmFtZSAhPT0gJ21ldGVvcl9hdXRvdXBkYXRlX2NsaWVudFZlcnNpb25zJykge1xuICAgICAgICBzdWIuc3RvcCgpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLy8gU2VuZHMgdGhlIEREUCBzdHJpbmdpZmljYXRpb24gb2YgdGhlIGdpdmVuIG1lc3NhZ2Ugb2JqZWN0XG4gIF9zZW5kKG9iaikge1xuICAgIHRoaXMuX3N0cmVhbS5zZW5kKEREUENvbW1vbi5zdHJpbmdpZnlERFAob2JqKSk7XG4gIH1cblxuICAvLyBXZSBkZXRlY3RlZCB2aWEgRERQLWxldmVsIGhlYXJ0YmVhdHMgdGhhdCB3ZSd2ZSBsb3N0IHRoZVxuICAvLyBjb25uZWN0aW9uLiAgVW5saWtlIGBkaXNjb25uZWN0YCBvciBgY2xvc2VgLCBhIGxvc3QgY29ubmVjdGlvblxuICAvLyB3aWxsIGJlIGF1dG9tYXRpY2FsbHkgcmV0cmllZC5cbiAgX2xvc3RDb25uZWN0aW9uKGVycm9yKSB7XG4gICAgdGhpcy5fc3RyZWFtLl9sb3N0Q29ubmVjdGlvbihlcnJvcik7XG4gIH1cblxuICAvKipcbiAgICogQG1lbWJlck9mIE1ldGVvclxuICAgKiBAaW1wb3J0RnJvbVBhY2thZ2UgbWV0ZW9yXG4gICAqIEBhbGlhcyBNZXRlb3Iuc3RhdHVzXG4gICAqIEBzdW1tYXJ5IEdldCB0aGUgY3VycmVudCBjb25uZWN0aW9uIHN0YXR1cy4gQSByZWFjdGl2ZSBkYXRhIHNvdXJjZS5cbiAgICogQGxvY3VzIENsaWVudFxuICAgKi9cbiAgc3RhdHVzKC4uLmFyZ3MpIHtcbiAgICByZXR1cm4gdGhpcy5fc3RyZWFtLnN0YXR1cyguLi5hcmdzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBGb3JjZSBhbiBpbW1lZGlhdGUgcmVjb25uZWN0aW9uIGF0dGVtcHQgaWYgdGhlIGNsaWVudCBpcyBub3QgY29ubmVjdGVkIHRvIHRoZSBzZXJ2ZXIuXG5cbiAgVGhpcyBtZXRob2QgZG9lcyBub3RoaW5nIGlmIHRoZSBjbGllbnQgaXMgYWxyZWFkeSBjb25uZWN0ZWQuXG4gICAqIEBtZW1iZXJPZiBNZXRlb3JcbiAgICogQGltcG9ydEZyb21QYWNrYWdlIG1ldGVvclxuICAgKiBAYWxpYXMgTWV0ZW9yLnJlY29ubmVjdFxuICAgKiBAbG9jdXMgQ2xpZW50XG4gICAqL1xuICByZWNvbm5lY3QoLi4uYXJncykge1xuICAgIHJldHVybiB0aGlzLl9zdHJlYW0ucmVjb25uZWN0KC4uLmFyZ3MpO1xuICB9XG5cbiAgLyoqXG4gICAqIEBtZW1iZXJPZiBNZXRlb3JcbiAgICogQGltcG9ydEZyb21QYWNrYWdlIG1ldGVvclxuICAgKiBAYWxpYXMgTWV0ZW9yLmRpc2Nvbm5lY3RcbiAgICogQHN1bW1hcnkgRGlzY29ubmVjdCB0aGUgY2xpZW50IGZyb20gdGhlIHNlcnZlci5cbiAgICogQGxvY3VzIENsaWVudFxuICAgKi9cbiAgZGlzY29ubmVjdCguLi5hcmdzKSB7XG4gICAgcmV0dXJuIHRoaXMuX3N0cmVhbS5kaXNjb25uZWN0KC4uLmFyZ3MpO1xuICB9XG5cbiAgY2xvc2UoKSB7XG4gICAgcmV0dXJuIHRoaXMuX3N0cmVhbS5kaXNjb25uZWN0KHsgX3Blcm1hbmVudDogdHJ1ZSB9KTtcbiAgfVxuXG4gIC8vL1xuICAvLy8gUmVhY3RpdmUgdXNlciBzeXN0ZW1cbiAgLy8vXG4gIHVzZXJJZCgpIHtcbiAgICBpZiAodGhpcy5fdXNlcklkRGVwcykgdGhpcy5fdXNlcklkRGVwcy5kZXBlbmQoKTtcbiAgICByZXR1cm4gdGhpcy5fdXNlcklkO1xuICB9XG5cbiAgc2V0VXNlcklkKHVzZXJJZCkge1xuICAgIC8vIEF2b2lkIGludmFsaWRhdGluZyBkZXBlbmRlbnRzIGlmIHNldFVzZXJJZCBpcyBjYWxsZWQgd2l0aCBjdXJyZW50IHZhbHVlLlxuICAgIGlmICh0aGlzLl91c2VySWQgPT09IHVzZXJJZCkgcmV0dXJuO1xuICAgIHRoaXMuX3VzZXJJZCA9IHVzZXJJZDtcbiAgICBpZiAodGhpcy5fdXNlcklkRGVwcykgdGhpcy5fdXNlcklkRGVwcy5jaGFuZ2VkKCk7XG4gIH1cblxuICAvLyBSZXR1cm5zIHRydWUgaWYgd2UgYXJlIGluIGEgc3RhdGUgYWZ0ZXIgcmVjb25uZWN0IG9mIHdhaXRpbmcgZm9yIHN1YnMgdG8gYmVcbiAgLy8gcmV2aXZlZCBvciBlYXJseSBtZXRob2RzIHRvIGZpbmlzaCB0aGVpciBkYXRhLCBvciB3ZSBhcmUgd2FpdGluZyBmb3IgYVxuICAvLyBcIndhaXRcIiBtZXRob2QgdG8gZmluaXNoLlxuICBfd2FpdGluZ0ZvclF1aWVzY2VuY2UoKSB7XG4gICAgcmV0dXJuIChcbiAgICAgICEgaXNFbXB0eSh0aGlzLl9zdWJzQmVpbmdSZXZpdmVkKSB8fFxuICAgICAgISBpc0VtcHR5KHRoaXMuX21ldGhvZHNCbG9ja2luZ1F1aWVzY2VuY2UpXG4gICAgKTtcbiAgfVxuXG4gIC8vIFJldHVybnMgdHJ1ZSBpZiBhbnkgbWV0aG9kIHdob3NlIG1lc3NhZ2UgaGFzIGJlZW4gc2VudCB0byB0aGUgc2VydmVyIGhhc1xuICAvLyBub3QgeWV0IGludm9rZWQgaXRzIHVzZXIgY2FsbGJhY2suXG4gIF9hbnlNZXRob2RzQXJlT3V0c3RhbmRpbmcoKSB7XG4gICAgY29uc3QgaW52b2tlcnMgPSB0aGlzLl9tZXRob2RJbnZva2VycztcbiAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyhpbnZva2Vycykuc29tZSgoaW52b2tlcikgPT4gISFpbnZva2VyLnNlbnRNZXNzYWdlKTtcbiAgfVxuXG4gIF9saXZlZGF0YV9jb25uZWN0ZWQobXNnKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG5cbiAgICBpZiAoc2VsZi5fdmVyc2lvbiAhPT0gJ3ByZTEnICYmIHNlbGYuX2hlYXJ0YmVhdEludGVydmFsICE9PSAwKSB7XG4gICAgICBzZWxmLl9oZWFydGJlYXQgPSBuZXcgRERQQ29tbW9uLkhlYXJ0YmVhdCh7XG4gICAgICAgIGhlYXJ0YmVhdEludGVydmFsOiBzZWxmLl9oZWFydGJlYXRJbnRlcnZhbCxcbiAgICAgICAgaGVhcnRiZWF0VGltZW91dDogc2VsZi5faGVhcnRiZWF0VGltZW91dCxcbiAgICAgICAgb25UaW1lb3V0KCkge1xuICAgICAgICAgIHNlbGYuX2xvc3RDb25uZWN0aW9uKFxuICAgICAgICAgICAgbmV3IEREUC5Db25uZWN0aW9uRXJyb3IoJ0REUCBoZWFydGJlYXQgdGltZWQgb3V0JylcbiAgICAgICAgICApO1xuICAgICAgICB9LFxuICAgICAgICBzZW5kUGluZygpIHtcbiAgICAgICAgICBzZWxmLl9zZW5kKHsgbXNnOiAncGluZycgfSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgc2VsZi5faGVhcnRiZWF0LnN0YXJ0KCk7XG4gICAgfVxuXG4gICAgLy8gSWYgdGhpcyBpcyBhIHJlY29ubmVjdCwgd2UnbGwgaGF2ZSB0byByZXNldCBhbGwgc3RvcmVzLlxuICAgIGlmIChzZWxmLl9sYXN0U2Vzc2lvbklkKSBzZWxmLl9yZXNldFN0b3JlcyA9IHRydWU7XG5cbiAgICBsZXQgcmVjb25uZWN0ZWRUb1ByZXZpb3VzU2Vzc2lvbjtcbiAgICBpZiAodHlwZW9mIG1zZy5zZXNzaW9uID09PSAnc3RyaW5nJykge1xuICAgICAgcmVjb25uZWN0ZWRUb1ByZXZpb3VzU2Vzc2lvbiA9IHNlbGYuX2xhc3RTZXNzaW9uSWQgPT09IG1zZy5zZXNzaW9uO1xuICAgICAgc2VsZi5fbGFzdFNlc3Npb25JZCA9IG1zZy5zZXNzaW9uO1xuICAgIH1cblxuICAgIGlmIChyZWNvbm5lY3RlZFRvUHJldmlvdXNTZXNzaW9uKSB7XG4gICAgICAvLyBTdWNjZXNzZnVsIHJlY29ubmVjdGlvbiAtLSBwaWNrIHVwIHdoZXJlIHdlIGxlZnQgb2ZmLiAgTm90ZSB0aGF0IHJpZ2h0XG4gICAgICAvLyBub3csIHRoaXMgbmV2ZXIgaGFwcGVuczogdGhlIHNlcnZlciBuZXZlciBjb25uZWN0cyB1cyB0byBhIHByZXZpb3VzXG4gICAgICAvLyBzZXNzaW9uLCBiZWNhdXNlIEREUCBkb2Vzbid0IHByb3ZpZGUgZW5vdWdoIGRhdGEgZm9yIHRoZSBzZXJ2ZXIgdG8ga25vd1xuICAgICAgLy8gd2hhdCBtZXNzYWdlcyB0aGUgY2xpZW50IGhhcyBwcm9jZXNzZWQuIFdlIG5lZWQgdG8gaW1wcm92ZSBERFAgdG8gbWFrZVxuICAgICAgLy8gdGhpcyBwb3NzaWJsZSwgYXQgd2hpY2ggcG9pbnQgd2UnbGwgcHJvYmFibHkgbmVlZCBtb3JlIGNvZGUgaGVyZS5cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBTZXJ2ZXIgZG9lc24ndCBoYXZlIG91ciBkYXRhIGFueSBtb3JlLiBSZS1zeW5jIGEgbmV3IHNlc3Npb24uXG5cbiAgICAvLyBGb3JnZXQgYWJvdXQgbWVzc2FnZXMgd2Ugd2VyZSBidWZmZXJpbmcgZm9yIHVua25vd24gY29sbGVjdGlvbnMuIFRoZXknbGxcbiAgICAvLyBiZSByZXNlbnQgaWYgc3RpbGwgcmVsZXZhbnQuXG4gICAgc2VsZi5fdXBkYXRlc0ZvclVua25vd25TdG9yZXMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXG4gICAgaWYgKHNlbGYuX3Jlc2V0U3RvcmVzKSB7XG4gICAgICAvLyBGb3JnZXQgYWJvdXQgdGhlIGVmZmVjdHMgb2Ygc3R1YnMuIFdlJ2xsIGJlIHJlc2V0dGluZyBhbGwgY29sbGVjdGlvbnNcbiAgICAgIC8vIGFueXdheS5cbiAgICAgIHNlbGYuX2RvY3VtZW50c1dyaXR0ZW5CeVN0dWIgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICAgICAgc2VsZi5fc2VydmVyRG9jdW1lbnRzID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgICB9XG5cbiAgICAvLyBDbGVhciBfYWZ0ZXJVcGRhdGVDYWxsYmFja3MuXG4gICAgc2VsZi5fYWZ0ZXJVcGRhdGVDYWxsYmFja3MgPSBbXTtcblxuICAgIC8vIE1hcmsgYWxsIG5hbWVkIHN1YnNjcmlwdGlvbnMgd2hpY2ggYXJlIHJlYWR5IChpZSwgd2UgYWxyZWFkeSBjYWxsZWQgdGhlXG4gICAgLy8gcmVhZHkgY2FsbGJhY2spIGFzIG5lZWRpbmcgdG8gYmUgcmV2aXZlZC5cbiAgICAvLyBYWFggV2Ugc2hvdWxkIGFsc28gYmxvY2sgcmVjb25uZWN0IHF1aWVzY2VuY2UgdW50aWwgdW5uYW1lZCBzdWJzY3JpcHRpb25zXG4gICAgLy8gICAgIChlZywgYXV0b3B1Ymxpc2gpIGFyZSBkb25lIHJlLXB1Ymxpc2hpbmcgdG8gYXZvaWQgZmxpY2tlciFcbiAgICBzZWxmLl9zdWJzQmVpbmdSZXZpdmVkID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgICBPYmplY3QuZW50cmllcyhzZWxmLl9zdWJzY3JpcHRpb25zKS5mb3JFYWNoKChbaWQsIHN1Yl0pID0+IHtcbiAgICAgIGlmIChzdWIucmVhZHkpIHtcbiAgICAgICAgc2VsZi5fc3Vic0JlaW5nUmV2aXZlZFtpZF0gPSB0cnVlO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gQXJyYW5nZSBmb3IgXCJoYWxmLWZpbmlzaGVkXCIgbWV0aG9kcyB0byBoYXZlIHRoZWlyIGNhbGxiYWNrcyBydW4sIGFuZFxuICAgIC8vIHRyYWNrIG1ldGhvZHMgdGhhdCB3ZXJlIHNlbnQgb24gdGhpcyBjb25uZWN0aW9uIHNvIHRoYXQgd2UgZG9uJ3RcbiAgICAvLyBxdWllc2NlIHVudGlsIHRoZXkgYXJlIGFsbCBkb25lLlxuICAgIC8vXG4gICAgLy8gU3RhcnQgYnkgY2xlYXJpbmcgX21ldGhvZHNCbG9ja2luZ1F1aWVzY2VuY2U6IG1ldGhvZHMgc2VudCBiZWZvcmVcbiAgICAvLyByZWNvbm5lY3QgZG9uJ3QgbWF0dGVyLCBhbmQgYW55IFwid2FpdFwiIG1ldGhvZHMgc2VudCBvbiB0aGUgbmV3IGNvbm5lY3Rpb25cbiAgICAvLyB0aGF0IHdlIGRyb3AgaGVyZSB3aWxsIGJlIHJlc3RvcmVkIGJ5IHRoZSBsb29wIGJlbG93LlxuICAgIHNlbGYuX21ldGhvZHNCbG9ja2luZ1F1aWVzY2VuY2UgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICAgIGlmIChzZWxmLl9yZXNldFN0b3Jlcykge1xuICAgICAgY29uc3QgaW52b2tlcnMgPSBzZWxmLl9tZXRob2RJbnZva2VycztcbiAgICAgIGtleXMoaW52b2tlcnMpLmZvckVhY2goaWQgPT4ge1xuICAgICAgICBjb25zdCBpbnZva2VyID0gaW52b2tlcnNbaWRdO1xuICAgICAgICBpZiAoaW52b2tlci5nb3RSZXN1bHQoKSkge1xuICAgICAgICAgIC8vIFRoaXMgbWV0aG9kIGFscmVhZHkgZ290IGl0cyByZXN1bHQsIGJ1dCBpdCBkaWRuJ3QgY2FsbCBpdHMgY2FsbGJhY2tcbiAgICAgICAgICAvLyBiZWNhdXNlIGl0cyBkYXRhIGRpZG4ndCBiZWNvbWUgdmlzaWJsZS4gV2UgZGlkIG5vdCByZXNlbmQgdGhlXG4gICAgICAgICAgLy8gbWV0aG9kIFJQQy4gV2UnbGwgY2FsbCBpdHMgY2FsbGJhY2sgd2hlbiB3ZSBnZXQgYSBmdWxsIHF1aWVzY2UsXG4gICAgICAgICAgLy8gc2luY2UgdGhhdCdzIGFzIGNsb3NlIGFzIHdlJ2xsIGdldCB0byBcImRhdGEgbXVzdCBiZSB2aXNpYmxlXCIuXG4gICAgICAgICAgc2VsZi5fYWZ0ZXJVcGRhdGVDYWxsYmFja3MucHVzaChcbiAgICAgICAgICAgICguLi5hcmdzKSA9PiBpbnZva2VyLmRhdGFWaXNpYmxlKC4uLmFyZ3MpXG4gICAgICAgICAgKTtcbiAgICAgICAgfSBlbHNlIGlmIChpbnZva2VyLnNlbnRNZXNzYWdlKSB7XG4gICAgICAgICAgLy8gVGhpcyBtZXRob2QgaGFzIGJlZW4gc2VudCBvbiB0aGlzIGNvbm5lY3Rpb24gKG1heWJlIGFzIGEgcmVzZW5kXG4gICAgICAgICAgLy8gZnJvbSB0aGUgbGFzdCBjb25uZWN0aW9uLCBtYXliZSBmcm9tIG9uUmVjb25uZWN0LCBtYXliZSBqdXN0IHZlcnlcbiAgICAgICAgICAvLyBxdWlja2x5IGJlZm9yZSBwcm9jZXNzaW5nIHRoZSBjb25uZWN0ZWQgbWVzc2FnZSkuXG4gICAgICAgICAgLy9cbiAgICAgICAgICAvLyBXZSBkb24ndCBuZWVkIHRvIGRvIGFueXRoaW5nIHNwZWNpYWwgdG8gZW5zdXJlIGl0cyBjYWxsYmFja3MgZ2V0XG4gICAgICAgICAgLy8gY2FsbGVkLCBidXQgd2UnbGwgY291bnQgaXQgYXMgYSBtZXRob2Qgd2hpY2ggaXMgcHJldmVudGluZ1xuICAgICAgICAgIC8vIHJlY29ubmVjdCBxdWllc2NlbmNlLiAoZWcsIGl0IG1pZ2h0IGJlIGEgbG9naW4gbWV0aG9kIHRoYXQgd2FzIHJ1blxuICAgICAgICAgIC8vIGZyb20gb25SZWNvbm5lY3QsIGFuZCB3ZSBkb24ndCB3YW50IHRvIHNlZSBmbGlja2VyIGJ5IHNlZWluZyBhXG4gICAgICAgICAgLy8gbG9nZ2VkLW91dCBzdGF0ZS4pXG4gICAgICAgICAgc2VsZi5fbWV0aG9kc0Jsb2NraW5nUXVpZXNjZW5jZVtpbnZva2VyLm1ldGhvZElkXSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHNlbGYuX21lc3NhZ2VzQnVmZmVyZWRVbnRpbFF1aWVzY2VuY2UgPSBbXTtcblxuICAgIC8vIElmIHdlJ3JlIG5vdCB3YWl0aW5nIG9uIGFueSBtZXRob2RzIG9yIHN1YnMsIHdlIGNhbiByZXNldCB0aGUgc3RvcmVzIGFuZFxuICAgIC8vIGNhbGwgdGhlIGNhbGxiYWNrcyBpbW1lZGlhdGVseS5cbiAgICBpZiAoISBzZWxmLl93YWl0aW5nRm9yUXVpZXNjZW5jZSgpKSB7XG4gICAgICBpZiAoc2VsZi5fcmVzZXRTdG9yZXMpIHtcbiAgICAgICAgT2JqZWN0LnZhbHVlcyhzZWxmLl9zdG9yZXMpLmZvckVhY2goKHN0b3JlKSA9PiB7XG4gICAgICAgICAgc3RvcmUuYmVnaW5VcGRhdGUoMCwgdHJ1ZSk7XG4gICAgICAgICAgc3RvcmUuZW5kVXBkYXRlKCk7XG4gICAgICAgIH0pO1xuICAgICAgICBzZWxmLl9yZXNldFN0b3JlcyA9IGZhbHNlO1xuICAgICAgfVxuICAgICAgc2VsZi5fcnVuQWZ0ZXJVcGRhdGVDYWxsYmFja3MoKTtcbiAgICB9XG4gIH1cblxuICBfcHJvY2Vzc09uZURhdGFNZXNzYWdlKG1zZywgdXBkYXRlcykge1xuICAgIGNvbnN0IG1lc3NhZ2VUeXBlID0gbXNnLm1zZztcblxuICAgIC8vIG1zZyBpcyBvbmUgb2YgWydhZGRlZCcsICdjaGFuZ2VkJywgJ3JlbW92ZWQnLCAncmVhZHknLCAndXBkYXRlZCddXG4gICAgaWYgKG1lc3NhZ2VUeXBlID09PSAnYWRkZWQnKSB7XG4gICAgICB0aGlzLl9wcm9jZXNzX2FkZGVkKG1zZywgdXBkYXRlcyk7XG4gICAgfSBlbHNlIGlmIChtZXNzYWdlVHlwZSA9PT0gJ2NoYW5nZWQnKSB7XG4gICAgICB0aGlzLl9wcm9jZXNzX2NoYW5nZWQobXNnLCB1cGRhdGVzKTtcbiAgICB9IGVsc2UgaWYgKG1lc3NhZ2VUeXBlID09PSAncmVtb3ZlZCcpIHtcbiAgICAgIHRoaXMuX3Byb2Nlc3NfcmVtb3ZlZChtc2csIHVwZGF0ZXMpO1xuICAgIH0gZWxzZSBpZiAobWVzc2FnZVR5cGUgPT09ICdyZWFkeScpIHtcbiAgICAgIHRoaXMuX3Byb2Nlc3NfcmVhZHkobXNnLCB1cGRhdGVzKTtcbiAgICB9IGVsc2UgaWYgKG1lc3NhZ2VUeXBlID09PSAndXBkYXRlZCcpIHtcbiAgICAgIHRoaXMuX3Byb2Nlc3NfdXBkYXRlZChtc2csIHVwZGF0ZXMpO1xuICAgIH0gZWxzZSBpZiAobWVzc2FnZVR5cGUgPT09ICdub3N1YicpIHtcbiAgICAgIC8vIGlnbm9yZSB0aGlzXG4gICAgfSBlbHNlIHtcbiAgICAgIE1ldGVvci5fZGVidWcoJ2Rpc2NhcmRpbmcgdW5rbm93biBsaXZlZGF0YSBkYXRhIG1lc3NhZ2UgdHlwZScsIG1zZyk7XG4gICAgfVxuICB9XG5cbiAgX2xpdmVkYXRhX2RhdGEobXNnKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG5cbiAgICBpZiAoc2VsZi5fd2FpdGluZ0ZvclF1aWVzY2VuY2UoKSkge1xuICAgICAgc2VsZi5fbWVzc2FnZXNCdWZmZXJlZFVudGlsUXVpZXNjZW5jZS5wdXNoKG1zZyk7XG5cbiAgICAgIGlmIChtc2cubXNnID09PSAnbm9zdWInKSB7XG4gICAgICAgIGRlbGV0ZSBzZWxmLl9zdWJzQmVpbmdSZXZpdmVkW21zZy5pZF07XG4gICAgICB9XG5cbiAgICAgIGlmIChtc2cuc3Vicykge1xuICAgICAgICBtc2cuc3Vicy5mb3JFYWNoKHN1YklkID0+IHtcbiAgICAgICAgICBkZWxldGUgc2VsZi5fc3Vic0JlaW5nUmV2aXZlZFtzdWJJZF07XG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICBpZiAobXNnLm1ldGhvZHMpIHtcbiAgICAgICAgbXNnLm1ldGhvZHMuZm9yRWFjaChtZXRob2RJZCA9PiB7XG4gICAgICAgICAgZGVsZXRlIHNlbGYuX21ldGhvZHNCbG9ja2luZ1F1aWVzY2VuY2VbbWV0aG9kSWRdO1xuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgaWYgKHNlbGYuX3dhaXRpbmdGb3JRdWllc2NlbmNlKCkpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICAvLyBObyBtZXRob2RzIG9yIHN1YnMgYXJlIGJsb2NraW5nIHF1aWVzY2VuY2UhXG4gICAgICAvLyBXZSdsbCBub3cgcHJvY2VzcyBhbmQgYWxsIG9mIG91ciBidWZmZXJlZCBtZXNzYWdlcywgcmVzZXQgYWxsIHN0b3JlcyxcbiAgICAgIC8vIGFuZCBhcHBseSB0aGVtIGFsbCBhdCBvbmNlLlxuXG4gICAgICBjb25zdCBidWZmZXJlZE1lc3NhZ2VzID0gc2VsZi5fbWVzc2FnZXNCdWZmZXJlZFVudGlsUXVpZXNjZW5jZTtcbiAgICAgIE9iamVjdC52YWx1ZXMoYnVmZmVyZWRNZXNzYWdlcykuZm9yRWFjaChidWZmZXJlZE1lc3NhZ2UgPT4ge1xuICAgICAgICBzZWxmLl9wcm9jZXNzT25lRGF0YU1lc3NhZ2UoXG4gICAgICAgICAgYnVmZmVyZWRNZXNzYWdlLFxuICAgICAgICAgIHNlbGYuX2J1ZmZlcmVkV3JpdGVzXG4gICAgICAgICk7XG4gICAgICB9KTtcblxuICAgICAgc2VsZi5fbWVzc2FnZXNCdWZmZXJlZFVudGlsUXVpZXNjZW5jZSA9IFtdO1xuXG4gICAgfSBlbHNlIHtcbiAgICAgIHNlbGYuX3Byb2Nlc3NPbmVEYXRhTWVzc2FnZShtc2csIHNlbGYuX2J1ZmZlcmVkV3JpdGVzKTtcbiAgICB9XG5cbiAgICAvLyBJbW1lZGlhdGVseSBmbHVzaCB3cml0ZXMgd2hlbjpcbiAgICAvLyAgMS4gQnVmZmVyaW5nIGlzIGRpc2FibGVkLiBPcjtcbiAgICAvLyAgMi4gYW55IG5vbi0oYWRkZWQvY2hhbmdlZC9yZW1vdmVkKSBtZXNzYWdlIGFycml2ZXMuXG4gICAgY29uc3Qgc3RhbmRhcmRXcml0ZSA9XG4gICAgICBtc2cubXNnID09PSBcImFkZGVkXCIgfHxcbiAgICAgIG1zZy5tc2cgPT09IFwiY2hhbmdlZFwiIHx8XG4gICAgICBtc2cubXNnID09PSBcInJlbW92ZWRcIjtcblxuICAgIGlmIChzZWxmLl9idWZmZXJlZFdyaXRlc0ludGVydmFsID09PSAwIHx8ICEgc3RhbmRhcmRXcml0ZSkge1xuICAgICAgc2VsZi5fZmx1c2hCdWZmZXJlZFdyaXRlcygpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChzZWxmLl9idWZmZXJlZFdyaXRlc0ZsdXNoQXQgPT09IG51bGwpIHtcbiAgICAgIHNlbGYuX2J1ZmZlcmVkV3JpdGVzRmx1c2hBdCA9XG4gICAgICAgIG5ldyBEYXRlKCkudmFsdWVPZigpICsgc2VsZi5fYnVmZmVyZWRXcml0ZXNNYXhBZ2U7XG4gICAgfSBlbHNlIGlmIChzZWxmLl9idWZmZXJlZFdyaXRlc0ZsdXNoQXQgPCBuZXcgRGF0ZSgpLnZhbHVlT2YoKSkge1xuICAgICAgc2VsZi5fZmx1c2hCdWZmZXJlZFdyaXRlcygpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChzZWxmLl9idWZmZXJlZFdyaXRlc0ZsdXNoSGFuZGxlKSB7XG4gICAgICBjbGVhclRpbWVvdXQoc2VsZi5fYnVmZmVyZWRXcml0ZXNGbHVzaEhhbmRsZSk7XG4gICAgfVxuICAgIHNlbGYuX2J1ZmZlcmVkV3JpdGVzRmx1c2hIYW5kbGUgPSBzZXRUaW1lb3V0KFxuICAgICAgc2VsZi5fX2ZsdXNoQnVmZmVyZWRXcml0ZXMsXG4gICAgICBzZWxmLl9idWZmZXJlZFdyaXRlc0ludGVydmFsXG4gICAgKTtcbiAgfVxuXG4gIF9mbHVzaEJ1ZmZlcmVkV3JpdGVzKCkge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIGlmIChzZWxmLl9idWZmZXJlZFdyaXRlc0ZsdXNoSGFuZGxlKSB7XG4gICAgICBjbGVhclRpbWVvdXQoc2VsZi5fYnVmZmVyZWRXcml0ZXNGbHVzaEhhbmRsZSk7XG4gICAgICBzZWxmLl9idWZmZXJlZFdyaXRlc0ZsdXNoSGFuZGxlID0gbnVsbDtcbiAgICB9XG5cbiAgICBzZWxmLl9idWZmZXJlZFdyaXRlc0ZsdXNoQXQgPSBudWxsO1xuICAgIC8vIFdlIG5lZWQgdG8gY2xlYXIgdGhlIGJ1ZmZlciBiZWZvcmUgcGFzc2luZyBpdCB0b1xuICAgIC8vICBwZXJmb3JtV3JpdGVzLiBBcyB0aGVyZSdzIG5vIGd1YXJhbnRlZSB0aGF0IGl0XG4gICAgLy8gIHdpbGwgZXhpdCBjbGVhbmx5LlxuICAgIGNvbnN0IHdyaXRlcyA9IHNlbGYuX2J1ZmZlcmVkV3JpdGVzO1xuICAgIHNlbGYuX2J1ZmZlcmVkV3JpdGVzID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgICBzZWxmLl9wZXJmb3JtV3JpdGVzKHdyaXRlcyk7XG4gIH1cblxuICBfcGVyZm9ybVdyaXRlcyh1cGRhdGVzKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG5cbiAgICBpZiAoc2VsZi5fcmVzZXRTdG9yZXMgfHwgISBpc0VtcHR5KHVwZGF0ZXMpKSB7XG4gICAgICAvLyBCZWdpbiBhIHRyYW5zYWN0aW9uYWwgdXBkYXRlIG9mIGVhY2ggc3RvcmUuXG5cbiAgICAgIE9iamVjdC5lbnRyaWVzKHNlbGYuX3N0b3JlcykuZm9yRWFjaCgoW3N0b3JlTmFtZSwgc3RvcmVdKSA9PiB7XG4gICAgICAgIHN0b3JlLmJlZ2luVXBkYXRlKFxuICAgICAgICAgIGhhc093bi5jYWxsKHVwZGF0ZXMsIHN0b3JlTmFtZSlcbiAgICAgICAgICAgID8gdXBkYXRlc1tzdG9yZU5hbWVdLmxlbmd0aFxuICAgICAgICAgICAgOiAwLFxuICAgICAgICAgIHNlbGYuX3Jlc2V0U3RvcmVzXG4gICAgICAgICk7XG4gICAgICB9KTtcblxuICAgICAgc2VsZi5fcmVzZXRTdG9yZXMgPSBmYWxzZTtcblxuICAgICAgT2JqZWN0LmVudHJpZXModXBkYXRlcykuZm9yRWFjaCgoW3N0b3JlTmFtZSwgdXBkYXRlTWVzc2FnZXNdKSA9PiB7XG4gICAgICAgIGNvbnN0IHN0b3JlID0gc2VsZi5fc3RvcmVzW3N0b3JlTmFtZV07XG4gICAgICAgIGlmIChzdG9yZSkge1xuICAgICAgICAgIHVwZGF0ZU1lc3NhZ2VzLmZvckVhY2godXBkYXRlTWVzc2FnZSA9PiB7XG4gICAgICAgICAgICBzdG9yZS51cGRhdGUodXBkYXRlTWVzc2FnZSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gTm9ib2R5J3MgbGlzdGVuaW5nIGZvciB0aGlzIGRhdGEuIFF1ZXVlIGl0IHVwIHVudGlsXG4gICAgICAgICAgLy8gc29tZW9uZSB3YW50cyBpdC5cbiAgICAgICAgICAvLyBYWFggbWVtb3J5IHVzZSB3aWxsIGdyb3cgd2l0aG91dCBib3VuZCBpZiB5b3UgZm9yZ2V0IHRvXG4gICAgICAgICAgLy8gY3JlYXRlIGEgY29sbGVjdGlvbiBvciBqdXN0IGRvbid0IGNhcmUgYWJvdXQgaXQuLi4gZ29pbmdcbiAgICAgICAgICAvLyB0byBoYXZlIHRvIGRvIHNvbWV0aGluZyBhYm91dCB0aGF0LlxuICAgICAgICAgIGNvbnN0IHVwZGF0ZXMgPSBzZWxmLl91cGRhdGVzRm9yVW5rbm93blN0b3JlcztcblxuICAgICAgICAgIGlmICghIGhhc093bi5jYWxsKHVwZGF0ZXMsIHN0b3JlTmFtZSkpIHtcbiAgICAgICAgICAgIHVwZGF0ZXNbc3RvcmVOYW1lXSA9IFtdO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHVwZGF0ZXNbc3RvcmVOYW1lXS5wdXNoKC4uLnVwZGF0ZU1lc3NhZ2VzKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIC8vIEVuZCB1cGRhdGUgdHJhbnNhY3Rpb24uXG4gICAgICBPYmplY3QudmFsdWVzKHNlbGYuX3N0b3JlcykuZm9yRWFjaCgoc3RvcmUpID0+IHtcbiAgICAgICAgc3RvcmUuZW5kVXBkYXRlKCk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBzZWxmLl9ydW5BZnRlclVwZGF0ZUNhbGxiYWNrcygpO1xuICB9XG5cbiAgLy8gQ2FsbCBhbnkgY2FsbGJhY2tzIGRlZmVycmVkIHdpdGggX3J1bldoZW5BbGxTZXJ2ZXJEb2NzQXJlRmx1c2hlZCB3aG9zZVxuICAvLyByZWxldmFudCBkb2NzIGhhdmUgYmVlbiBmbHVzaGVkLCBhcyB3ZWxsIGFzIGRhdGFWaXNpYmxlIGNhbGxiYWNrcyBhdFxuICAvLyByZWNvbm5lY3QtcXVpZXNjZW5jZSB0aW1lLlxuICBfcnVuQWZ0ZXJVcGRhdGVDYWxsYmFja3MoKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgY29uc3QgY2FsbGJhY2tzID0gc2VsZi5fYWZ0ZXJVcGRhdGVDYWxsYmFja3M7XG4gICAgc2VsZi5fYWZ0ZXJVcGRhdGVDYWxsYmFja3MgPSBbXTtcbiAgICBjYWxsYmFja3MuZm9yRWFjaCgoYykgPT4ge1xuICAgICAgYygpO1xuICAgIH0pO1xuICB9XG5cbiAgX3B1c2hVcGRhdGUodXBkYXRlcywgY29sbGVjdGlvbiwgbXNnKSB7XG4gICAgaWYgKCEgaGFzT3duLmNhbGwodXBkYXRlcywgY29sbGVjdGlvbikpIHtcbiAgICAgIHVwZGF0ZXNbY29sbGVjdGlvbl0gPSBbXTtcbiAgICB9XG4gICAgdXBkYXRlc1tjb2xsZWN0aW9uXS5wdXNoKG1zZyk7XG4gIH1cblxuICBfZ2V0U2VydmVyRG9jKGNvbGxlY3Rpb24sIGlkKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgaWYgKCEgaGFzT3duLmNhbGwoc2VsZi5fc2VydmVyRG9jdW1lbnRzLCBjb2xsZWN0aW9uKSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGNvbnN0IHNlcnZlckRvY3NGb3JDb2xsZWN0aW9uID0gc2VsZi5fc2VydmVyRG9jdW1lbnRzW2NvbGxlY3Rpb25dO1xuICAgIHJldHVybiBzZXJ2ZXJEb2NzRm9yQ29sbGVjdGlvbi5nZXQoaWQpIHx8IG51bGw7XG4gIH1cblxuICBfcHJvY2Vzc19hZGRlZChtc2csIHVwZGF0ZXMpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICBjb25zdCBpZCA9IE1vbmdvSUQuaWRQYXJzZShtc2cuaWQpO1xuICAgIGNvbnN0IHNlcnZlckRvYyA9IHNlbGYuX2dldFNlcnZlckRvYyhtc2cuY29sbGVjdGlvbiwgaWQpO1xuICAgIGlmIChzZXJ2ZXJEb2MpIHtcbiAgICAgIC8vIFNvbWUgb3V0c3RhbmRpbmcgc3R1YiB3cm90ZSBoZXJlLlxuICAgICAgY29uc3QgaXNFeGlzdGluZyA9IHNlcnZlckRvYy5kb2N1bWVudCAhPT0gdW5kZWZpbmVkO1xuXG4gICAgICBzZXJ2ZXJEb2MuZG9jdW1lbnQgPSBtc2cuZmllbGRzIHx8IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gICAgICBzZXJ2ZXJEb2MuZG9jdW1lbnQuX2lkID0gaWQ7XG5cbiAgICAgIGlmIChzZWxmLl9yZXNldFN0b3Jlcykge1xuICAgICAgICAvLyBEdXJpbmcgcmVjb25uZWN0IHRoZSBzZXJ2ZXIgaXMgc2VuZGluZyBhZGRzIGZvciBleGlzdGluZyBpZHMuXG4gICAgICAgIC8vIEFsd2F5cyBwdXNoIGFuIHVwZGF0ZSBzbyB0aGF0IGRvY3VtZW50IHN0YXlzIGluIHRoZSBzdG9yZSBhZnRlclxuICAgICAgICAvLyByZXNldC4gVXNlIGN1cnJlbnQgdmVyc2lvbiBvZiB0aGUgZG9jdW1lbnQgZm9yIHRoaXMgdXBkYXRlLCBzb1xuICAgICAgICAvLyB0aGF0IHN0dWItd3JpdHRlbiB2YWx1ZXMgYXJlIHByZXNlcnZlZC5cbiAgICAgICAgY29uc3QgY3VycmVudERvYyA9IHNlbGYuX3N0b3Jlc1ttc2cuY29sbGVjdGlvbl0uZ2V0RG9jKG1zZy5pZCk7XG4gICAgICAgIGlmIChjdXJyZW50RG9jICE9PSB1bmRlZmluZWQpIG1zZy5maWVsZHMgPSBjdXJyZW50RG9jO1xuXG4gICAgICAgIHNlbGYuX3B1c2hVcGRhdGUodXBkYXRlcywgbXNnLmNvbGxlY3Rpb24sIG1zZyk7XG4gICAgICB9IGVsc2UgaWYgKGlzRXhpc3RpbmcpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdTZXJ2ZXIgc2VudCBhZGQgZm9yIGV4aXN0aW5nIGlkOiAnICsgbXNnLmlkKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgc2VsZi5fcHVzaFVwZGF0ZSh1cGRhdGVzLCBtc2cuY29sbGVjdGlvbiwgbXNnKTtcbiAgICB9XG4gIH1cblxuICBfcHJvY2Vzc19jaGFuZ2VkKG1zZywgdXBkYXRlcykge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIGNvbnN0IHNlcnZlckRvYyA9IHNlbGYuX2dldFNlcnZlckRvYyhtc2cuY29sbGVjdGlvbiwgTW9uZ29JRC5pZFBhcnNlKG1zZy5pZCkpO1xuICAgIGlmIChzZXJ2ZXJEb2MpIHtcbiAgICAgIGlmIChzZXJ2ZXJEb2MuZG9jdW1lbnQgPT09IHVuZGVmaW5lZClcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdTZXJ2ZXIgc2VudCBjaGFuZ2VkIGZvciBub25leGlzdGluZyBpZDogJyArIG1zZy5pZCk7XG4gICAgICBEaWZmU2VxdWVuY2UuYXBwbHlDaGFuZ2VzKHNlcnZlckRvYy5kb2N1bWVudCwgbXNnLmZpZWxkcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHNlbGYuX3B1c2hVcGRhdGUodXBkYXRlcywgbXNnLmNvbGxlY3Rpb24sIG1zZyk7XG4gICAgfVxuICB9XG5cbiAgX3Byb2Nlc3NfcmVtb3ZlZChtc2csIHVwZGF0ZXMpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICBjb25zdCBzZXJ2ZXJEb2MgPSBzZWxmLl9nZXRTZXJ2ZXJEb2MobXNnLmNvbGxlY3Rpb24sIE1vbmdvSUQuaWRQYXJzZShtc2cuaWQpKTtcbiAgICBpZiAoc2VydmVyRG9jKSB7XG4gICAgICAvLyBTb21lIG91dHN0YW5kaW5nIHN0dWIgd3JvdGUgaGVyZS5cbiAgICAgIGlmIChzZXJ2ZXJEb2MuZG9jdW1lbnQgPT09IHVuZGVmaW5lZClcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdTZXJ2ZXIgc2VudCByZW1vdmVkIGZvciBub25leGlzdGluZyBpZDonICsgbXNnLmlkKTtcbiAgICAgIHNlcnZlckRvYy5kb2N1bWVudCA9IHVuZGVmaW5lZDtcbiAgICB9IGVsc2Uge1xuICAgICAgc2VsZi5fcHVzaFVwZGF0ZSh1cGRhdGVzLCBtc2cuY29sbGVjdGlvbiwge1xuICAgICAgICBtc2c6ICdyZW1vdmVkJyxcbiAgICAgICAgY29sbGVjdGlvbjogbXNnLmNvbGxlY3Rpb24sXG4gICAgICAgIGlkOiBtc2cuaWRcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIF9wcm9jZXNzX3VwZGF0ZWQobXNnLCB1cGRhdGVzKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgLy8gUHJvY2VzcyBcIm1ldGhvZCBkb25lXCIgbWVzc2FnZXMuXG5cbiAgICBtc2cubWV0aG9kcy5mb3JFYWNoKChtZXRob2RJZCkgPT4ge1xuICAgICAgY29uc3QgZG9jcyA9IHNlbGYuX2RvY3VtZW50c1dyaXR0ZW5CeVN0dWJbbWV0aG9kSWRdIHx8IHt9O1xuICAgICAgT2JqZWN0LnZhbHVlcyhkb2NzKS5mb3JFYWNoKCh3cml0dGVuKSA9PiB7XG4gICAgICAgIGNvbnN0IHNlcnZlckRvYyA9IHNlbGYuX2dldFNlcnZlckRvYyh3cml0dGVuLmNvbGxlY3Rpb24sIHdyaXR0ZW4uaWQpO1xuICAgICAgICBpZiAoISBzZXJ2ZXJEb2MpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0xvc3Qgc2VydmVyRG9jIGZvciAnICsgSlNPTi5zdHJpbmdpZnkod3JpdHRlbikpO1xuICAgICAgICB9XG4gICAgICAgIGlmICghIHNlcnZlckRvYy53cml0dGVuQnlTdHVic1ttZXRob2RJZF0pIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICAnRG9jICcgK1xuICAgICAgICAgICAgICBKU09OLnN0cmluZ2lmeSh3cml0dGVuKSArXG4gICAgICAgICAgICAgICcgbm90IHdyaXR0ZW4gYnkgIG1ldGhvZCAnICtcbiAgICAgICAgICAgICAgbWV0aG9kSWRcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZSBzZXJ2ZXJEb2Mud3JpdHRlbkJ5U3R1YnNbbWV0aG9kSWRdO1xuICAgICAgICBpZiAoaXNFbXB0eShzZXJ2ZXJEb2Mud3JpdHRlbkJ5U3R1YnMpKSB7XG4gICAgICAgICAgLy8gQWxsIG1ldGhvZHMgd2hvc2Ugc3R1YnMgd3JvdGUgdGhpcyBtZXRob2QgaGF2ZSBjb21wbGV0ZWQhIFdlIGNhblxuICAgICAgICAgIC8vIG5vdyBjb3B5IHRoZSBzYXZlZCBkb2N1bWVudCB0byB0aGUgZGF0YWJhc2UgKHJldmVydGluZyB0aGUgc3R1YidzXG4gICAgICAgICAgLy8gY2hhbmdlIGlmIHRoZSBzZXJ2ZXIgZGlkIG5vdCB3cml0ZSB0byB0aGlzIG9iamVjdCwgb3IgYXBwbHlpbmcgdGhlXG4gICAgICAgICAgLy8gc2VydmVyJ3Mgd3JpdGVzIGlmIGl0IGRpZCkuXG5cbiAgICAgICAgICAvLyBUaGlzIGlzIGEgZmFrZSBkZHAgJ3JlcGxhY2UnIG1lc3NhZ2UuICBJdCdzIGp1c3QgZm9yIHRhbGtpbmdcbiAgICAgICAgICAvLyBiZXR3ZWVuIGxpdmVkYXRhIGNvbm5lY3Rpb25zIGFuZCBtaW5pbW9uZ28uICAoV2UgaGF2ZSB0byBzdHJpbmdpZnlcbiAgICAgICAgICAvLyB0aGUgSUQgYmVjYXVzZSBpdCdzIHN1cHBvc2VkIHRvIGxvb2sgbGlrZSBhIHdpcmUgbWVzc2FnZS4pXG4gICAgICAgICAgc2VsZi5fcHVzaFVwZGF0ZSh1cGRhdGVzLCB3cml0dGVuLmNvbGxlY3Rpb24sIHtcbiAgICAgICAgICAgIG1zZzogJ3JlcGxhY2UnLFxuICAgICAgICAgICAgaWQ6IE1vbmdvSUQuaWRTdHJpbmdpZnkod3JpdHRlbi5pZCksXG4gICAgICAgICAgICByZXBsYWNlOiBzZXJ2ZXJEb2MuZG9jdW1lbnRcbiAgICAgICAgICB9KTtcbiAgICAgICAgICAvLyBDYWxsIGFsbCBmbHVzaCBjYWxsYmFja3MuXG5cbiAgICAgICAgICBzZXJ2ZXJEb2MuZmx1c2hDYWxsYmFja3MuZm9yRWFjaCgoYykgPT4ge1xuICAgICAgICAgICAgYygpO1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgLy8gRGVsZXRlIHRoaXMgY29tcGxldGVkIHNlcnZlckRvY3VtZW50LiBEb24ndCBib3RoZXIgdG8gR0MgZW1wdHlcbiAgICAgICAgICAvLyBJZE1hcHMgaW5zaWRlIHNlbGYuX3NlcnZlckRvY3VtZW50cywgc2luY2UgdGhlcmUgcHJvYmFibHkgYXJlbid0XG4gICAgICAgICAgLy8gbWFueSBjb2xsZWN0aW9ucyBhbmQgdGhleSdsbCBiZSB3cml0dGVuIHJlcGVhdGVkbHkuXG4gICAgICAgICAgc2VsZi5fc2VydmVyRG9jdW1lbnRzW3dyaXR0ZW4uY29sbGVjdGlvbl0ucmVtb3ZlKHdyaXR0ZW4uaWQpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIGRlbGV0ZSBzZWxmLl9kb2N1bWVudHNXcml0dGVuQnlTdHViW21ldGhvZElkXTtcblxuICAgICAgLy8gV2Ugd2FudCB0byBjYWxsIHRoZSBkYXRhLXdyaXR0ZW4gY2FsbGJhY2ssIGJ1dCB3ZSBjYW4ndCBkbyBzbyB1bnRpbCBhbGxcbiAgICAgIC8vIGN1cnJlbnRseSBidWZmZXJlZCBtZXNzYWdlcyBhcmUgZmx1c2hlZC5cbiAgICAgIGNvbnN0IGNhbGxiYWNrSW52b2tlciA9IHNlbGYuX21ldGhvZEludm9rZXJzW21ldGhvZElkXTtcbiAgICAgIGlmICghIGNhbGxiYWNrSW52b2tlcikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIGNhbGxiYWNrIGludm9rZXIgZm9yIG1ldGhvZCAnICsgbWV0aG9kSWQpO1xuICAgICAgfVxuXG4gICAgICBzZWxmLl9ydW5XaGVuQWxsU2VydmVyRG9jc0FyZUZsdXNoZWQoXG4gICAgICAgICguLi5hcmdzKSA9PiBjYWxsYmFja0ludm9rZXIuZGF0YVZpc2libGUoLi4uYXJncylcbiAgICAgICk7XG4gICAgfSk7XG4gIH1cblxuICBfcHJvY2Vzc19yZWFkeShtc2csIHVwZGF0ZXMpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICAvLyBQcm9jZXNzIFwic3ViIHJlYWR5XCIgbWVzc2FnZXMuIFwic3ViIHJlYWR5XCIgbWVzc2FnZXMgZG9uJ3QgdGFrZSBlZmZlY3RcbiAgICAvLyB1bnRpbCBhbGwgY3VycmVudCBzZXJ2ZXIgZG9jdW1lbnRzIGhhdmUgYmVlbiBmbHVzaGVkIHRvIHRoZSBsb2NhbFxuICAgIC8vIGRhdGFiYXNlLiBXZSBjYW4gdXNlIGEgd3JpdGUgZmVuY2UgdG8gaW1wbGVtZW50IHRoaXMuXG5cbiAgICBtc2cuc3Vicy5mb3JFYWNoKChzdWJJZCkgPT4ge1xuICAgICAgc2VsZi5fcnVuV2hlbkFsbFNlcnZlckRvY3NBcmVGbHVzaGVkKCgpID0+IHtcbiAgICAgICAgY29uc3Qgc3ViUmVjb3JkID0gc2VsZi5fc3Vic2NyaXB0aW9uc1tzdWJJZF07XG4gICAgICAgIC8vIERpZCB3ZSBhbHJlYWR5IHVuc3Vic2NyaWJlP1xuICAgICAgICBpZiAoIXN1YlJlY29yZCkgcmV0dXJuO1xuICAgICAgICAvLyBEaWQgd2UgYWxyZWFkeSByZWNlaXZlIGEgcmVhZHkgbWVzc2FnZT8gKE9vcHMhKVxuICAgICAgICBpZiAoc3ViUmVjb3JkLnJlYWR5KSByZXR1cm47XG4gICAgICAgIHN1YlJlY29yZC5yZWFkeSA9IHRydWU7XG4gICAgICAgIHN1YlJlY29yZC5yZWFkeUNhbGxiYWNrICYmIHN1YlJlY29yZC5yZWFkeUNhbGxiYWNrKCk7XG4gICAgICAgIHN1YlJlY29yZC5yZWFkeURlcHMuY2hhbmdlZCgpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICAvLyBFbnN1cmVzIHRoYXQgXCJmXCIgd2lsbCBiZSBjYWxsZWQgYWZ0ZXIgYWxsIGRvY3VtZW50cyBjdXJyZW50bHkgaW5cbiAgLy8gX3NlcnZlckRvY3VtZW50cyBoYXZlIGJlZW4gd3JpdHRlbiB0byB0aGUgbG9jYWwgY2FjaGUuIGYgd2lsbCBub3QgYmUgY2FsbGVkXG4gIC8vIGlmIHRoZSBjb25uZWN0aW9uIGlzIGxvc3QgYmVmb3JlIHRoZW4hXG4gIF9ydW5XaGVuQWxsU2VydmVyRG9jc0FyZUZsdXNoZWQoZikge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIGNvbnN0IHJ1bkZBZnRlclVwZGF0ZXMgPSAoKSA9PiB7XG4gICAgICBzZWxmLl9hZnRlclVwZGF0ZUNhbGxiYWNrcy5wdXNoKGYpO1xuICAgIH07XG4gICAgbGV0IHVuZmx1c2hlZFNlcnZlckRvY0NvdW50ID0gMDtcbiAgICBjb25zdCBvblNlcnZlckRvY0ZsdXNoID0gKCkgPT4ge1xuICAgICAgLS11bmZsdXNoZWRTZXJ2ZXJEb2NDb3VudDtcbiAgICAgIGlmICh1bmZsdXNoZWRTZXJ2ZXJEb2NDb3VudCA9PT0gMCkge1xuICAgICAgICAvLyBUaGlzIHdhcyB0aGUgbGFzdCBkb2MgdG8gZmx1c2ghIEFycmFuZ2UgdG8gcnVuIGYgYWZ0ZXIgdGhlIHVwZGF0ZXNcbiAgICAgICAgLy8gaGF2ZSBiZWVuIGFwcGxpZWQuXG4gICAgICAgIHJ1bkZBZnRlclVwZGF0ZXMoKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgT2JqZWN0LnZhbHVlcyhzZWxmLl9zZXJ2ZXJEb2N1bWVudHMpLmZvckVhY2goKHNlcnZlckRvY3VtZW50cykgPT4ge1xuICAgICAgc2VydmVyRG9jdW1lbnRzLmZvckVhY2goKHNlcnZlckRvYykgPT4ge1xuICAgICAgICBjb25zdCB3cml0dGVuQnlTdHViRm9yQU1ldGhvZFdpdGhTZW50TWVzc2FnZSA9XG4gICAgICAgICAga2V5cyhzZXJ2ZXJEb2Mud3JpdHRlbkJ5U3R1YnMpLnNvbWUobWV0aG9kSWQgPT4ge1xuICAgICAgICAgICAgY29uc3QgaW52b2tlciA9IHNlbGYuX21ldGhvZEludm9rZXJzW21ldGhvZElkXTtcbiAgICAgICAgICAgIHJldHVybiBpbnZva2VyICYmIGludm9rZXIuc2VudE1lc3NhZ2U7XG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgaWYgKHdyaXR0ZW5CeVN0dWJGb3JBTWV0aG9kV2l0aFNlbnRNZXNzYWdlKSB7XG4gICAgICAgICAgKyt1bmZsdXNoZWRTZXJ2ZXJEb2NDb3VudDtcbiAgICAgICAgICBzZXJ2ZXJEb2MuZmx1c2hDYWxsYmFja3MucHVzaChvblNlcnZlckRvY0ZsdXNoKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gICAgaWYgKHVuZmx1c2hlZFNlcnZlckRvY0NvdW50ID09PSAwKSB7XG4gICAgICAvLyBUaGVyZSBhcmVuJ3QgYW55IGJ1ZmZlcmVkIGRvY3MgLS0tIHdlIGNhbiBjYWxsIGYgYXMgc29vbiBhcyB0aGUgY3VycmVudFxuICAgICAgLy8gcm91bmQgb2YgdXBkYXRlcyBpcyBhcHBsaWVkIVxuICAgICAgcnVuRkFmdGVyVXBkYXRlcygpO1xuICAgIH1cbiAgfVxuXG4gIF9saXZlZGF0YV9ub3N1Yihtc2cpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcblxuICAgIC8vIEZpcnN0IHBhc3MgaXQgdGhyb3VnaCBfbGl2ZWRhdGFfZGF0YSwgd2hpY2ggb25seSB1c2VzIGl0IHRvIGhlbHAgZ2V0XG4gICAgLy8gdG93YXJkcyBxdWllc2NlbmNlLlxuICAgIHNlbGYuX2xpdmVkYXRhX2RhdGEobXNnKTtcblxuICAgIC8vIERvIHRoZSByZXN0IG9mIG91ciBwcm9jZXNzaW5nIGltbWVkaWF0ZWx5LCB3aXRoIG5vXG4gICAgLy8gYnVmZmVyaW5nLXVudGlsLXF1aWVzY2VuY2UuXG5cbiAgICAvLyB3ZSB3ZXJlbid0IHN1YmJlZCBhbnl3YXksIG9yIHdlIGluaXRpYXRlZCB0aGUgdW5zdWIuXG4gICAgaWYgKCEgaGFzT3duLmNhbGwoc2VsZi5fc3Vic2NyaXB0aW9ucywgbXNnLmlkKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIFhYWCBDT01QQVQgV0lUSCAxLjAuMy4xICNlcnJvckNhbGxiYWNrXG4gICAgY29uc3QgZXJyb3JDYWxsYmFjayA9IHNlbGYuX3N1YnNjcmlwdGlvbnNbbXNnLmlkXS5lcnJvckNhbGxiYWNrO1xuICAgIGNvbnN0IHN0b3BDYWxsYmFjayA9IHNlbGYuX3N1YnNjcmlwdGlvbnNbbXNnLmlkXS5zdG9wQ2FsbGJhY2s7XG5cbiAgICBzZWxmLl9zdWJzY3JpcHRpb25zW21zZy5pZF0ucmVtb3ZlKCk7XG5cbiAgICBjb25zdCBtZXRlb3JFcnJvckZyb21Nc2cgPSBtc2dBcmcgPT4ge1xuICAgICAgcmV0dXJuIChcbiAgICAgICAgbXNnQXJnICYmXG4gICAgICAgIG1zZ0FyZy5lcnJvciAmJlxuICAgICAgICBuZXcgTWV0ZW9yLkVycm9yKFxuICAgICAgICAgIG1zZ0FyZy5lcnJvci5lcnJvcixcbiAgICAgICAgICBtc2dBcmcuZXJyb3IucmVhc29uLFxuICAgICAgICAgIG1zZ0FyZy5lcnJvci5kZXRhaWxzXG4gICAgICAgIClcbiAgICAgICk7XG4gICAgfTtcblxuICAgIC8vIFhYWCBDT01QQVQgV0lUSCAxLjAuMy4xICNlcnJvckNhbGxiYWNrXG4gICAgaWYgKGVycm9yQ2FsbGJhY2sgJiYgbXNnLmVycm9yKSB7XG4gICAgICBlcnJvckNhbGxiYWNrKG1ldGVvckVycm9yRnJvbU1zZyhtc2cpKTtcbiAgICB9XG5cbiAgICBpZiAoc3RvcENhbGxiYWNrKSB7XG4gICAgICBzdG9wQ2FsbGJhY2sobWV0ZW9yRXJyb3JGcm9tTXNnKG1zZykpO1xuICAgIH1cbiAgfVxuXG4gIF9saXZlZGF0YV9yZXN1bHQobXNnKSB7XG4gICAgLy8gaWQsIHJlc3VsdCBvciBlcnJvci4gZXJyb3IgaGFzIGVycm9yIChjb2RlKSwgcmVhc29uLCBkZXRhaWxzXG5cbiAgICBjb25zdCBzZWxmID0gdGhpcztcblxuICAgIC8vIExldHMgbWFrZSBzdXJlIHRoZXJlIGFyZSBubyBidWZmZXJlZCB3cml0ZXMgYmVmb3JlIHJldHVybmluZyByZXN1bHQuXG4gICAgaWYgKCEgaXNFbXB0eShzZWxmLl9idWZmZXJlZFdyaXRlcykpIHtcbiAgICAgIHNlbGYuX2ZsdXNoQnVmZmVyZWRXcml0ZXMoKTtcbiAgICB9XG5cbiAgICAvLyBmaW5kIHRoZSBvdXRzdGFuZGluZyByZXF1ZXN0XG4gICAgLy8gc2hvdWxkIGJlIE8oMSkgaW4gbmVhcmx5IGFsbCByZWFsaXN0aWMgdXNlIGNhc2VzXG4gICAgaWYgKGlzRW1wdHkoc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MpKSB7XG4gICAgICBNZXRlb3IuX2RlYnVnKCdSZWNlaXZlZCBtZXRob2QgcmVzdWx0IGJ1dCBubyBtZXRob2RzIG91dHN0YW5kaW5nJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IGN1cnJlbnRNZXRob2RCbG9jayA9IHNlbGYuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzWzBdLm1ldGhvZHM7XG4gICAgbGV0IGk7XG4gICAgY29uc3QgbSA9IGN1cnJlbnRNZXRob2RCbG9jay5maW5kKChtZXRob2QsIGlkeCkgPT4ge1xuICAgICAgY29uc3QgZm91bmQgPSBtZXRob2QubWV0aG9kSWQgPT09IG1zZy5pZDtcbiAgICAgIGlmIChmb3VuZCkgaSA9IGlkeDtcbiAgICAgIHJldHVybiBmb3VuZDtcbiAgICB9KTtcbiAgICBpZiAoIW0pIHtcbiAgICAgIE1ldGVvci5fZGVidWcoXCJDYW4ndCBtYXRjaCBtZXRob2QgcmVzcG9uc2UgdG8gb3JpZ2luYWwgbWV0aG9kIGNhbGxcIiwgbXNnKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBSZW1vdmUgZnJvbSBjdXJyZW50IG1ldGhvZCBibG9jay4gVGhpcyBtYXkgbGVhdmUgdGhlIGJsb2NrIGVtcHR5LCBidXQgd2VcbiAgICAvLyBkb24ndCBtb3ZlIG9uIHRvIHRoZSBuZXh0IGJsb2NrIHVudGlsIHRoZSBjYWxsYmFjayBoYXMgYmVlbiBkZWxpdmVyZWQsIGluXG4gICAgLy8gX291dHN0YW5kaW5nTWV0aG9kRmluaXNoZWQuXG4gICAgY3VycmVudE1ldGhvZEJsb2NrLnNwbGljZShpLCAxKTtcblxuICAgIGlmIChoYXNPd24uY2FsbChtc2csICdlcnJvcicpKSB7XG4gICAgICBtLnJlY2VpdmVSZXN1bHQoXG4gICAgICAgIG5ldyBNZXRlb3IuRXJyb3IobXNnLmVycm9yLmVycm9yLCBtc2cuZXJyb3IucmVhc29uLCBtc2cuZXJyb3IuZGV0YWlscylcbiAgICAgICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIG1zZy5yZXN1bHQgbWF5IGJlIHVuZGVmaW5lZCBpZiB0aGUgbWV0aG9kIGRpZG4ndCByZXR1cm4gYVxuICAgICAgLy8gdmFsdWVcbiAgICAgIG0ucmVjZWl2ZVJlc3VsdCh1bmRlZmluZWQsIG1zZy5yZXN1bHQpO1xuICAgIH1cbiAgfVxuXG4gIC8vIENhbGxlZCBieSBNZXRob2RJbnZva2VyIGFmdGVyIGEgbWV0aG9kJ3MgY2FsbGJhY2sgaXMgaW52b2tlZC4gIElmIHRoaXMgd2FzXG4gIC8vIHRoZSBsYXN0IG91dHN0YW5kaW5nIG1ldGhvZCBpbiB0aGUgY3VycmVudCBibG9jaywgcnVucyB0aGUgbmV4dCBibG9jay4gSWZcbiAgLy8gdGhlcmUgYXJlIG5vIG1vcmUgbWV0aG9kcywgY29uc2lkZXIgYWNjZXB0aW5nIGEgaG90IGNvZGUgcHVzaC5cbiAgX291dHN0YW5kaW5nTWV0aG9kRmluaXNoZWQoKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgaWYgKHNlbGYuX2FueU1ldGhvZHNBcmVPdXRzdGFuZGluZygpKSByZXR1cm47XG5cbiAgICAvLyBObyBtZXRob2RzIGFyZSBvdXRzdGFuZGluZy4gVGhpcyBzaG91bGQgbWVhbiB0aGF0IHRoZSBmaXJzdCBibG9jayBvZlxuICAgIC8vIG1ldGhvZHMgaXMgZW1wdHkuIChPciBpdCBtaWdodCBub3QgZXhpc3QsIGlmIHRoaXMgd2FzIGEgbWV0aG9kIHRoYXRcbiAgICAvLyBoYWxmLWZpbmlzaGVkIGJlZm9yZSBkaXNjb25uZWN0L3JlY29ubmVjdC4pXG4gICAgaWYgKCEgaXNFbXB0eShzZWxmLl9vdXRzdGFuZGluZ01ldGhvZEJsb2NrcykpIHtcbiAgICAgIGNvbnN0IGZpcnN0QmxvY2sgPSBzZWxmLl9vdXRzdGFuZGluZ01ldGhvZEJsb2Nrcy5zaGlmdCgpO1xuICAgICAgaWYgKCEgaXNFbXB0eShmaXJzdEJsb2NrLm1ldGhvZHMpKVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgJ05vIG1ldGhvZHMgb3V0c3RhbmRpbmcgYnV0IG5vbmVtcHR5IGJsb2NrOiAnICtcbiAgICAgICAgICAgIEpTT04uc3RyaW5naWZ5KGZpcnN0QmxvY2spXG4gICAgICAgICk7XG5cbiAgICAgIC8vIFNlbmQgdGhlIG91dHN0YW5kaW5nIG1ldGhvZHMgbm93IGluIHRoZSBmaXJzdCBibG9jay5cbiAgICAgIGlmICghIGlzRW1wdHkoc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MpKVxuICAgICAgICBzZWxmLl9zZW5kT3V0c3RhbmRpbmdNZXRob2RzKCk7XG4gICAgfVxuXG4gICAgLy8gTWF5YmUgYWNjZXB0IGEgaG90IGNvZGUgcHVzaC5cbiAgICBzZWxmLl9tYXliZU1pZ3JhdGUoKTtcbiAgfVxuXG4gIC8vIFNlbmRzIG1lc3NhZ2VzIGZvciBhbGwgdGhlIG1ldGhvZHMgaW4gdGhlIGZpcnN0IGJsb2NrIGluXG4gIC8vIF9vdXRzdGFuZGluZ01ldGhvZEJsb2Nrcy5cbiAgX3NlbmRPdXRzdGFuZGluZ01ldGhvZHMoKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG5cbiAgICBpZiAoaXNFbXB0eShzZWxmLl9vdXRzdGFuZGluZ01ldGhvZEJsb2NrcykpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBzZWxmLl9vdXRzdGFuZGluZ01ldGhvZEJsb2Nrc1swXS5tZXRob2RzLmZvckVhY2gobSA9PiB7XG4gICAgICBtLnNlbmRNZXNzYWdlKCk7XG4gICAgfSk7XG4gIH1cblxuICBfbGl2ZWRhdGFfZXJyb3IobXNnKSB7XG4gICAgTWV0ZW9yLl9kZWJ1ZygnUmVjZWl2ZWQgZXJyb3IgZnJvbSBzZXJ2ZXI6ICcsIG1zZy5yZWFzb24pO1xuICAgIGlmIChtc2cub2ZmZW5kaW5nTWVzc2FnZSkgTWV0ZW9yLl9kZWJ1ZygnRm9yOiAnLCBtc2cub2ZmZW5kaW5nTWVzc2FnZSk7XG4gIH1cblxuICBfY2FsbE9uUmVjb25uZWN0QW5kU2VuZEFwcHJvcHJpYXRlT3V0c3RhbmRpbmdNZXRob2RzKCkge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIGNvbnN0IG9sZE91dHN0YW5kaW5nTWV0aG9kQmxvY2tzID0gc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3M7XG4gICAgc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MgPSBbXTtcblxuICAgIHNlbGYub25SZWNvbm5lY3QgJiYgc2VsZi5vblJlY29ubmVjdCgpO1xuICAgIEREUC5fcmVjb25uZWN0SG9vay5lYWNoKGNhbGxiYWNrID0+IHtcbiAgICAgIGNhbGxiYWNrKHNlbGYpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSk7XG5cbiAgICBpZiAoaXNFbXB0eShvbGRPdXRzdGFuZGluZ01ldGhvZEJsb2NrcykpIHJldHVybjtcblxuICAgIC8vIFdlIGhhdmUgYXQgbGVhc3Qgb25lIGJsb2NrIHdvcnRoIG9mIG9sZCBvdXRzdGFuZGluZyBtZXRob2RzIHRvIHRyeVxuICAgIC8vIGFnYWluLiBGaXJzdDogZGlkIG9uUmVjb25uZWN0IGFjdHVhbGx5IHNlbmQgYW55dGhpbmc/IElmIG5vdCwgd2UganVzdFxuICAgIC8vIHJlc3RvcmUgYWxsIG91dHN0YW5kaW5nIG1ldGhvZHMgYW5kIHJ1biB0aGUgZmlyc3QgYmxvY2suXG4gICAgaWYgKGlzRW1wdHkoc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MpKSB7XG4gICAgICBzZWxmLl9vdXRzdGFuZGluZ01ldGhvZEJsb2NrcyA9IG9sZE91dHN0YW5kaW5nTWV0aG9kQmxvY2tzO1xuICAgICAgc2VsZi5fc2VuZE91dHN0YW5kaW5nTWV0aG9kcygpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIE9LLCB0aGVyZSBhcmUgYmxvY2tzIG9uIGJvdGggc2lkZXMuIFNwZWNpYWwgY2FzZTogbWVyZ2UgdGhlIGxhc3QgYmxvY2sgb2ZcbiAgICAvLyB0aGUgcmVjb25uZWN0IG1ldGhvZHMgd2l0aCB0aGUgZmlyc3QgYmxvY2sgb2YgdGhlIG9yaWdpbmFsIG1ldGhvZHMsIGlmXG4gICAgLy8gbmVpdGhlciBvZiB0aGVtIGFyZSBcIndhaXRcIiBibG9ja3MuXG4gICAgaWYgKCEgbGFzdChzZWxmLl9vdXRzdGFuZGluZ01ldGhvZEJsb2Nrcykud2FpdCAmJlxuICAgICAgICAhIG9sZE91dHN0YW5kaW5nTWV0aG9kQmxvY2tzWzBdLndhaXQpIHtcbiAgICAgIG9sZE91dHN0YW5kaW5nTWV0aG9kQmxvY2tzWzBdLm1ldGhvZHMuZm9yRWFjaChtID0+IHtcbiAgICAgICAgbGFzdChzZWxmLl9vdXRzdGFuZGluZ01ldGhvZEJsb2NrcykubWV0aG9kcy5wdXNoKG0pO1xuXG4gICAgICAgIC8vIElmIHRoaXMgXCJsYXN0IGJsb2NrXCIgaXMgYWxzbyB0aGUgZmlyc3QgYmxvY2ssIHNlbmQgdGhlIG1lc3NhZ2UuXG4gICAgICAgIGlmIChzZWxmLl9vdXRzdGFuZGluZ01ldGhvZEJsb2Nrcy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICBtLnNlbmRNZXNzYWdlKCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICBvbGRPdXRzdGFuZGluZ01ldGhvZEJsb2Nrcy5zaGlmdCgpO1xuICAgIH1cblxuICAgIC8vIE5vdyBhZGQgdGhlIHJlc3Qgb2YgdGhlIG9yaWdpbmFsIGJsb2NrcyBvbi5cbiAgICBzZWxmLl9vdXRzdGFuZGluZ01ldGhvZEJsb2Nrcy5wdXNoKC4uLm9sZE91dHN0YW5kaW5nTWV0aG9kQmxvY2tzKTtcbiAgfVxuXG4gIC8vIFdlIGNhbiBhY2NlcHQgYSBob3QgY29kZSBwdXNoIGlmIHRoZXJlIGFyZSBubyBtZXRob2RzIGluIGZsaWdodC5cbiAgX3JlYWR5VG9NaWdyYXRlKCkge1xuICAgIHJldHVybiBpc0VtcHR5KHRoaXMuX21ldGhvZEludm9rZXJzKTtcbiAgfVxuXG4gIC8vIElmIHdlIHdlcmUgYmxvY2tpbmcgYSBtaWdyYXRpb24sIHNlZSBpZiBpdCdzIG5vdyBwb3NzaWJsZSB0byBjb250aW51ZS5cbiAgLy8gQ2FsbCB3aGVuZXZlciB0aGUgc2V0IG9mIG91dHN0YW5kaW5nL2Jsb2NrZWQgbWV0aG9kcyBzaHJpbmtzLlxuICBfbWF5YmVNaWdyYXRlKCkge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIGlmIChzZWxmLl9yZXRyeU1pZ3JhdGUgJiYgc2VsZi5fcmVhZHlUb01pZ3JhdGUoKSkge1xuICAgICAgc2VsZi5fcmV0cnlNaWdyYXRlKCk7XG4gICAgICBzZWxmLl9yZXRyeU1pZ3JhdGUgPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIG9uTWVzc2FnZShyYXdfbXNnKSB7XG4gICAgbGV0IG1zZztcbiAgICB0cnkge1xuICAgICAgbXNnID0gRERQQ29tbW9uLnBhcnNlRERQKHJhd19tc2cpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIE1ldGVvci5fZGVidWcoJ0V4Y2VwdGlvbiB3aGlsZSBwYXJzaW5nIEREUCcsIGUpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIEFueSBtZXNzYWdlIGNvdW50cyBhcyByZWNlaXZpbmcgYSBwb25nLCBhcyBpdCBkZW1vbnN0cmF0ZXMgdGhhdFxuICAgIC8vIHRoZSBzZXJ2ZXIgaXMgc3RpbGwgYWxpdmUuXG4gICAgaWYgKHRoaXMuX2hlYXJ0YmVhdCkge1xuICAgICAgdGhpcy5faGVhcnRiZWF0Lm1lc3NhZ2VSZWNlaXZlZCgpO1xuICAgIH1cblxuICAgIGlmIChtc2cgPT09IG51bGwgfHwgIW1zZy5tc2cpIHtcbiAgICAgIC8vIFhYWCBDT01QQVQgV0lUSCAwLjYuNi4gaWdub3JlIHRoZSBvbGQgd2VsY29tZSBtZXNzYWdlIGZvciBiYWNrXG4gICAgICAvLyBjb21wYXQuICBSZW1vdmUgdGhpcyAnaWYnIG9uY2UgdGhlIHNlcnZlciBzdG9wcyBzZW5kaW5nIHdlbGNvbWVcbiAgICAgIC8vIG1lc3NhZ2VzIChzdHJlYW1fc2VydmVyLmpzKS5cbiAgICAgIGlmICghKG1zZyAmJiBtc2cuc2VydmVyX2lkKSlcbiAgICAgICAgTWV0ZW9yLl9kZWJ1ZygnZGlzY2FyZGluZyBpbnZhbGlkIGxpdmVkYXRhIG1lc3NhZ2UnLCBtc2cpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChtc2cubXNnID09PSAnY29ubmVjdGVkJykge1xuICAgICAgdGhpcy5fdmVyc2lvbiA9IHRoaXMuX3ZlcnNpb25TdWdnZXN0aW9uO1xuICAgICAgdGhpcy5fbGl2ZWRhdGFfY29ubmVjdGVkKG1zZyk7XG4gICAgICB0aGlzLm9wdGlvbnMub25Db25uZWN0ZWQoKTtcbiAgICB9IGVsc2UgaWYgKG1zZy5tc2cgPT09ICdmYWlsZWQnKSB7XG4gICAgICBpZiAodGhpcy5fc3VwcG9ydGVkRERQVmVyc2lvbnMuaW5kZXhPZihtc2cudmVyc2lvbikgPj0gMCkge1xuICAgICAgICB0aGlzLl92ZXJzaW9uU3VnZ2VzdGlvbiA9IG1zZy52ZXJzaW9uO1xuICAgICAgICB0aGlzLl9zdHJlYW0ucmVjb25uZWN0KHsgX2ZvcmNlOiB0cnVlIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgZGVzY3JpcHRpb24gPVxuICAgICAgICAgICdERFAgdmVyc2lvbiBuZWdvdGlhdGlvbiBmYWlsZWQ7IHNlcnZlciByZXF1ZXN0ZWQgdmVyc2lvbiAnICtcbiAgICAgICAgICBtc2cudmVyc2lvbjtcbiAgICAgICAgdGhpcy5fc3RyZWFtLmRpc2Nvbm5lY3QoeyBfcGVybWFuZW50OiB0cnVlLCBfZXJyb3I6IGRlc2NyaXB0aW9uIH0pO1xuICAgICAgICB0aGlzLm9wdGlvbnMub25ERFBWZXJzaW9uTmVnb3RpYXRpb25GYWlsdXJlKGRlc2NyaXB0aW9uKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKG1zZy5tc2cgPT09ICdwaW5nJyAmJiB0aGlzLm9wdGlvbnMucmVzcG9uZFRvUGluZ3MpIHtcbiAgICAgIHRoaXMuX3NlbmQoeyBtc2c6ICdwb25nJywgaWQ6IG1zZy5pZCB9KTtcbiAgICB9IGVsc2UgaWYgKG1zZy5tc2cgPT09ICdwb25nJykge1xuICAgICAgLy8gbm9vcCwgYXMgd2UgYXNzdW1lIGV2ZXJ5dGhpbmcncyBhIHBvbmdcbiAgICB9IGVsc2UgaWYgKFxuICAgICAgWydhZGRlZCcsICdjaGFuZ2VkJywgJ3JlbW92ZWQnLCAncmVhZHknLCAndXBkYXRlZCddLmluY2x1ZGVzKG1zZy5tc2cpXG4gICAgKSB7XG4gICAgICB0aGlzLl9saXZlZGF0YV9kYXRhKG1zZyk7XG4gICAgfSBlbHNlIGlmIChtc2cubXNnID09PSAnbm9zdWInKSB7XG4gICAgICB0aGlzLl9saXZlZGF0YV9ub3N1Yihtc2cpO1xuICAgIH0gZWxzZSBpZiAobXNnLm1zZyA9PT0gJ3Jlc3VsdCcpIHtcbiAgICAgIHRoaXMuX2xpdmVkYXRhX3Jlc3VsdChtc2cpO1xuICAgIH0gZWxzZSBpZiAobXNnLm1zZyA9PT0gJ2Vycm9yJykge1xuICAgICAgdGhpcy5fbGl2ZWRhdGFfZXJyb3IobXNnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgTWV0ZW9yLl9kZWJ1ZygnZGlzY2FyZGluZyB1bmtub3duIGxpdmVkYXRhIG1lc3NhZ2UgdHlwZScsIG1zZyk7XG4gICAgfVxuICB9XG5cbiAgb25SZXNldCgpIHtcbiAgICAvLyBTZW5kIGEgY29ubmVjdCBtZXNzYWdlIGF0IHRoZSBiZWdpbm5pbmcgb2YgdGhlIHN0cmVhbS5cbiAgICAvLyBOT1RFOiByZXNldCBpcyBjYWxsZWQgZXZlbiBvbiB0aGUgZmlyc3QgY29ubmVjdGlvbiwgc28gdGhpcyBpc1xuICAgIC8vIHRoZSBvbmx5IHBsYWNlIHdlIHNlbmQgdGhpcyBtZXNzYWdlLlxuICAgIGNvbnN0IG1zZyA9IHsgbXNnOiAnY29ubmVjdCcgfTtcbiAgICBpZiAodGhpcy5fbGFzdFNlc3Npb25JZCkgbXNnLnNlc3Npb24gPSB0aGlzLl9sYXN0U2Vzc2lvbklkO1xuICAgIG1zZy52ZXJzaW9uID0gdGhpcy5fdmVyc2lvblN1Z2dlc3Rpb24gfHwgdGhpcy5fc3VwcG9ydGVkRERQVmVyc2lvbnNbMF07XG4gICAgdGhpcy5fdmVyc2lvblN1Z2dlc3Rpb24gPSBtc2cudmVyc2lvbjtcbiAgICBtc2cuc3VwcG9ydCA9IHRoaXMuX3N1cHBvcnRlZEREUFZlcnNpb25zO1xuICAgIHRoaXMuX3NlbmQobXNnKTtcblxuICAgIC8vIE1hcmsgbm9uLXJldHJ5IGNhbGxzIGFzIGZhaWxlZC4gVGhpcyBoYXMgdG8gYmUgZG9uZSBlYXJseSBhcyBnZXR0aW5nIHRoZXNlIG1ldGhvZHMgb3V0IG9mIHRoZVxuICAgIC8vIGN1cnJlbnQgYmxvY2sgaXMgcHJldHR5IGltcG9ydGFudCB0byBtYWtpbmcgc3VyZSB0aGF0IHF1aWVzY2VuY2UgaXMgcHJvcGVybHkgY2FsY3VsYXRlZCwgYXNcbiAgICAvLyB3ZWxsIGFzIHBvc3NpYmx5IG1vdmluZyBvbiB0byBhbm90aGVyIHVzZWZ1bCBibG9jay5cblxuICAgIC8vIE9ubHkgYm90aGVyIHRlc3RpbmcgaWYgdGhlcmUgaXMgYW4gb3V0c3RhbmRpbmdNZXRob2RCbG9jayAodGhlcmUgbWlnaHQgbm90IGJlLCBlc3BlY2lhbGx5IGlmXG4gICAgLy8gd2UgYXJlIGNvbm5lY3RpbmcgZm9yIHRoZSBmaXJzdCB0aW1lLlxuICAgIGlmICh0aGlzLl9vdXRzdGFuZGluZ01ldGhvZEJsb2Nrcy5sZW5ndGggPiAwKSB7XG4gICAgICAvLyBJZiB0aGVyZSBpcyBhbiBvdXRzdGFuZGluZyBtZXRob2QgYmxvY2ssIHdlIG9ubHkgY2FyZSBhYm91dCB0aGUgZmlyc3Qgb25lIGFzIHRoYXQgaXMgdGhlXG4gICAgICAvLyBvbmUgdGhhdCBjb3VsZCBoYXZlIGFscmVhZHkgc2VudCBtZXNzYWdlcyB3aXRoIG5vIHJlc3BvbnNlLCB0aGF0IGFyZSBub3QgYWxsb3dlZCB0byByZXRyeS5cbiAgICAgIGNvbnN0IGN1cnJlbnRNZXRob2RCbG9jayA9IHRoaXMuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzWzBdLm1ldGhvZHM7XG4gICAgICB0aGlzLl9vdXRzdGFuZGluZ01ldGhvZEJsb2Nrc1swXS5tZXRob2RzID0gY3VycmVudE1ldGhvZEJsb2NrLmZpbHRlcihcbiAgICAgICAgbWV0aG9kSW52b2tlciA9PiB7XG4gICAgICAgICAgLy8gTWV0aG9kcyB3aXRoICdub1JldHJ5JyBvcHRpb24gc2V0IGFyZSBub3QgYWxsb3dlZCB0byByZS1zZW5kIGFmdGVyXG4gICAgICAgICAgLy8gcmVjb3ZlcmluZyBkcm9wcGVkIGNvbm5lY3Rpb24uXG4gICAgICAgICAgaWYgKG1ldGhvZEludm9rZXIuc2VudE1lc3NhZ2UgJiYgbWV0aG9kSW52b2tlci5ub1JldHJ5KSB7XG4gICAgICAgICAgICAvLyBNYWtlIHN1cmUgdGhhdCB0aGUgbWV0aG9kIGlzIHRvbGQgdGhhdCBpdCBmYWlsZWQuXG4gICAgICAgICAgICBtZXRob2RJbnZva2VyLnJlY2VpdmVSZXN1bHQoXG4gICAgICAgICAgICAgIG5ldyBNZXRlb3IuRXJyb3IoXG4gICAgICAgICAgICAgICAgJ2ludm9jYXRpb24tZmFpbGVkJyxcbiAgICAgICAgICAgICAgICAnTWV0aG9kIGludm9jYXRpb24gbWlnaHQgaGF2ZSBmYWlsZWQgZHVlIHRvIGRyb3BwZWQgY29ubmVjdGlvbi4gJyArXG4gICAgICAgICAgICAgICAgICAnRmFpbGluZyBiZWNhdXNlIGBub1JldHJ5YCBvcHRpb24gd2FzIHBhc3NlZCB0byBNZXRlb3IuYXBwbHkuJ1xuICAgICAgICAgICAgICApXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIE9ubHkga2VlcCBhIG1ldGhvZCBpZiBpdCB3YXNuJ3Qgc2VudCBvciBpdCdzIGFsbG93ZWQgdG8gcmV0cnkuXG4gICAgICAgICAgLy8gVGhpcyBtYXkgbGVhdmUgdGhlIGJsb2NrIGVtcHR5LCBidXQgd2UgZG9uJ3QgbW92ZSBvbiB0byB0aGUgbmV4dFxuICAgICAgICAgIC8vIGJsb2NrIHVudGlsIHRoZSBjYWxsYmFjayBoYXMgYmVlbiBkZWxpdmVyZWQsIGluIF9vdXRzdGFuZGluZ01ldGhvZEZpbmlzaGVkLlxuICAgICAgICAgIHJldHVybiAhKG1ldGhvZEludm9rZXIuc2VudE1lc3NhZ2UgJiYgbWV0aG9kSW52b2tlci5ub1JldHJ5KTtcbiAgICAgICAgfVxuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyBOb3csIHRvIG1pbmltaXplIHNldHVwIGxhdGVuY3ksIGdvIGFoZWFkIGFuZCBibGFzdCBvdXQgYWxsIG9mXG4gICAgLy8gb3VyIHBlbmRpbmcgbWV0aG9kcyBhbmRzIHN1YnNjcmlwdGlvbnMgYmVmb3JlIHdlJ3ZlIGV2ZW4gdGFrZW5cbiAgICAvLyB0aGUgbmVjZXNzYXJ5IFJUVCB0byBrbm93IGlmIHdlIHN1Y2Nlc3NmdWxseSByZWNvbm5lY3RlZC4gKDEpXG4gICAgLy8gVGhleSdyZSBzdXBwb3NlZCB0byBiZSBpZGVtcG90ZW50LCBhbmQgd2hlcmUgdGhleSBhcmUgbm90LFxuICAgIC8vIHRoZXkgY2FuIGJsb2NrIHJldHJ5IGluIGFwcGx5OyAoMikgZXZlbiBpZiB3ZSBkaWQgcmVjb25uZWN0LFxuICAgIC8vIHdlJ3JlIG5vdCBzdXJlIHdoYXQgbWVzc2FnZXMgbWlnaHQgaGF2ZSBnb3R0ZW4gbG9zdFxuICAgIC8vIChpbiBlaXRoZXIgZGlyZWN0aW9uKSBzaW5jZSB3ZSB3ZXJlIGRpc2Nvbm5lY3RlZCAoVENQIGJlaW5nXG4gICAgLy8gc2xvcHB5IGFib3V0IHRoYXQuKVxuXG4gICAgLy8gSWYgdGhlIGN1cnJlbnQgYmxvY2sgb2YgbWV0aG9kcyBhbGwgZ290IHRoZWlyIHJlc3VsdHMgKGJ1dCBkaWRuJ3QgYWxsIGdldFxuICAgIC8vIHRoZWlyIGRhdGEgdmlzaWJsZSksIGRpc2NhcmQgdGhlIGVtcHR5IGJsb2NrIG5vdy5cbiAgICBpZiAoXG4gICAgICB0aGlzLl9vdXRzdGFuZGluZ01ldGhvZEJsb2Nrcy5sZW5ndGggPiAwICYmXG4gICAgICB0aGlzLl9vdXRzdGFuZGluZ01ldGhvZEJsb2Nrc1swXS5tZXRob2RzLmxlbmd0aCA9PT0gMFxuICAgICkge1xuICAgICAgdGhpcy5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3Muc2hpZnQoKTtcbiAgICB9XG5cbiAgICAvLyBNYXJrIGFsbCBtZXNzYWdlcyBhcyB1bnNlbnQsIHRoZXkgaGF2ZSBub3QgeWV0IGJlZW4gc2VudCBvbiB0aGlzXG4gICAgLy8gY29ubmVjdGlvbi5cbiAgICBrZXlzKHRoaXMuX21ldGhvZEludm9rZXJzKS5mb3JFYWNoKGlkID0+IHtcbiAgICAgIHRoaXMuX21ldGhvZEludm9rZXJzW2lkXS5zZW50TWVzc2FnZSA9IGZhbHNlO1xuICAgIH0pO1xuXG4gICAgLy8gSWYgYW4gYG9uUmVjb25uZWN0YCBoYW5kbGVyIGlzIHNldCwgY2FsbCBpdCBmaXJzdC4gR28gdGhyb3VnaFxuICAgIC8vIHNvbWUgaG9vcHMgdG8gZW5zdXJlIHRoYXQgbWV0aG9kcyB0aGF0IGFyZSBjYWxsZWQgZnJvbSB3aXRoaW5cbiAgICAvLyBgb25SZWNvbm5lY3RgIGdldCBleGVjdXRlZCBfYmVmb3JlXyBvbmVzIHRoYXQgd2VyZSBvcmlnaW5hbGx5XG4gICAgLy8gb3V0c3RhbmRpbmcgKHNpbmNlIGBvblJlY29ubmVjdGAgaXMgdXNlZCB0byByZS1lc3RhYmxpc2ggYXV0aFxuICAgIC8vIGNlcnRpZmljYXRlcylcbiAgICB0aGlzLl9jYWxsT25SZWNvbm5lY3RBbmRTZW5kQXBwcm9wcmlhdGVPdXRzdGFuZGluZ01ldGhvZHMoKTtcblxuICAgIC8vIGFkZCBuZXcgc3Vic2NyaXB0aW9ucyBhdCB0aGUgZW5kLiB0aGlzIHdheSB0aGV5IHRha2UgZWZmZWN0IGFmdGVyXG4gICAgLy8gdGhlIGhhbmRsZXJzIGFuZCB3ZSBkb24ndCBzZWUgZmxpY2tlci5cbiAgICBPYmplY3QuZW50cmllcyh0aGlzLl9zdWJzY3JpcHRpb25zKS5mb3JFYWNoKChbaWQsIHN1Yl0pID0+IHtcbiAgICAgIHRoaXMuX3NlbmQoe1xuICAgICAgICBtc2c6ICdzdWInLFxuICAgICAgICBpZDogaWQsXG4gICAgICAgIG5hbWU6IHN1Yi5uYW1lLFxuICAgICAgICBwYXJhbXM6IHN1Yi5wYXJhbXNcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG59XG4iLCJpbXBvcnQgeyBERFBDb21tb24gfSBmcm9tICdtZXRlb3IvZGRwLWNvbW1vbic7XG5pbXBvcnQgeyBNZXRlb3IgfSBmcm9tICdtZXRlb3IvbWV0ZW9yJztcbmltcG9ydCB7IGtleXMgfSBmcm9tIFwibWV0ZW9yL2RkcC1jb21tb24vdXRpbHMuanNcIjtcblxuaW1wb3J0IHsgQ29ubmVjdGlvbiB9IGZyb20gJy4vbGl2ZWRhdGFfY29ubmVjdGlvbi5qcyc7XG5cbi8vIFRoaXMgYXJyYXkgYWxsb3dzIHRoZSBgX2FsbFN1YnNjcmlwdGlvbnNSZWFkeWAgbWV0aG9kIGJlbG93LCB3aGljaFxuLy8gaXMgdXNlZCBieSB0aGUgYHNwaWRlcmFibGVgIHBhY2thZ2UsIHRvIGtlZXAgdHJhY2sgb2Ygd2hldGhlciBhbGxcbi8vIGRhdGEgaXMgcmVhZHkuXG5jb25zdCBhbGxDb25uZWN0aW9ucyA9IFtdO1xuXG4vKipcbiAqIEBuYW1lc3BhY2UgRERQXG4gKiBAc3VtbWFyeSBOYW1lc3BhY2UgZm9yIEREUC1yZWxhdGVkIG1ldGhvZHMvY2xhc3Nlcy5cbiAqL1xuZXhwb3J0IGNvbnN0IEREUCA9IHt9O1xuXG4vLyBUaGlzIGlzIHByaXZhdGUgYnV0IGl0J3MgdXNlZCBpbiBhIGZldyBwbGFjZXMuIGFjY291bnRzLWJhc2UgdXNlc1xuLy8gaXQgdG8gZ2V0IHRoZSBjdXJyZW50IHVzZXIuIE1ldGVvci5zZXRUaW1lb3V0IGFuZCBmcmllbmRzIGNsZWFyXG4vLyBpdC4gV2UgY2FuIHByb2JhYmx5IGZpbmQgYSBiZXR0ZXIgd2F5IHRvIGZhY3RvciB0aGlzLlxuRERQLl9DdXJyZW50TWV0aG9kSW52b2NhdGlvbiA9IG5ldyBNZXRlb3IuRW52aXJvbm1lbnRWYXJpYWJsZSgpO1xuRERQLl9DdXJyZW50UHVibGljYXRpb25JbnZvY2F0aW9uID0gbmV3IE1ldGVvci5FbnZpcm9ubWVudFZhcmlhYmxlKCk7XG5cbi8vIFhYWDogS2VlcCBERFAuX0N1cnJlbnRJbnZvY2F0aW9uIGZvciBiYWNrd2FyZHMtY29tcGF0aWJpbGl0eS5cbkREUC5fQ3VycmVudEludm9jYXRpb24gPSBERFAuX0N1cnJlbnRNZXRob2RJbnZvY2F0aW9uO1xuXG4vLyBUaGlzIGlzIHBhc3NlZCBpbnRvIGEgd2VpcmQgYG1ha2VFcnJvclR5cGVgIGZ1bmN0aW9uIHRoYXQgZXhwZWN0cyBpdHMgdGhpbmdcbi8vIHRvIGJlIGEgY29uc3RydWN0b3JcbmZ1bmN0aW9uIGNvbm5lY3Rpb25FcnJvckNvbnN0cnVjdG9yKG1lc3NhZ2UpIHtcbiAgdGhpcy5tZXNzYWdlID0gbWVzc2FnZTtcbn1cblxuRERQLkNvbm5lY3Rpb25FcnJvciA9IE1ldGVvci5tYWtlRXJyb3JUeXBlKFxuICAnRERQLkNvbm5lY3Rpb25FcnJvcicsXG4gIGNvbm5lY3Rpb25FcnJvckNvbnN0cnVjdG9yXG4pO1xuXG5ERFAuRm9yY2VkUmVjb25uZWN0RXJyb3IgPSBNZXRlb3IubWFrZUVycm9yVHlwZShcbiAgJ0REUC5Gb3JjZWRSZWNvbm5lY3RFcnJvcicsXG4gICgpID0+IHt9XG4pO1xuXG4vLyBSZXR1cm5zIHRoZSBuYW1lZCBzZXF1ZW5jZSBvZiBwc2V1ZG8tcmFuZG9tIHZhbHVlcy5cbi8vIFRoZSBzY29wZSB3aWxsIGJlIEREUC5fQ3VycmVudE1ldGhvZEludm9jYXRpb24uZ2V0KCksIHNvIHRoZSBzdHJlYW0gd2lsbCBwcm9kdWNlXG4vLyBjb25zaXN0ZW50IHZhbHVlcyBmb3IgbWV0aG9kIGNhbGxzIG9uIHRoZSBjbGllbnQgYW5kIHNlcnZlci5cbkREUC5yYW5kb21TdHJlYW0gPSBuYW1lID0+IHtcbiAgY29uc3Qgc2NvcGUgPSBERFAuX0N1cnJlbnRNZXRob2RJbnZvY2F0aW9uLmdldCgpO1xuICByZXR1cm4gRERQQ29tbW9uLlJhbmRvbVN0cmVhbS5nZXQoc2NvcGUsIG5hbWUpO1xufTtcblxuLy8gQHBhcmFtIHVybCB7U3RyaW5nfSBVUkwgdG8gTWV0ZW9yIGFwcCxcbi8vICAgICBlLmcuOlxuLy8gICAgIFwic3ViZG9tYWluLm1ldGVvci5jb21cIixcbi8vICAgICBcImh0dHA6Ly9zdWJkb21haW4ubWV0ZW9yLmNvbVwiLFxuLy8gICAgIFwiL1wiLFxuLy8gICAgIFwiZGRwK3NvY2tqczovL2RkcC0tKioqKi1mb28ubWV0ZW9yLmNvbS9zb2NranNcIlxuXG4vKipcbiAqIEBzdW1tYXJ5IENvbm5lY3QgdG8gdGhlIHNlcnZlciBvZiBhIGRpZmZlcmVudCBNZXRlb3IgYXBwbGljYXRpb24gdG8gc3Vic2NyaWJlIHRvIGl0cyBkb2N1bWVudCBzZXRzIGFuZCBpbnZva2UgaXRzIHJlbW90ZSBtZXRob2RzLlxuICogQGxvY3VzIEFueXdoZXJlXG4gKiBAcGFyYW0ge1N0cmluZ30gdXJsIFRoZSBVUkwgb2YgYW5vdGhlciBNZXRlb3IgYXBwbGljYXRpb24uXG4gKi9cbkREUC5jb25uZWN0ID0gKHVybCwgb3B0aW9ucykgPT4ge1xuICBjb25zdCByZXQgPSBuZXcgQ29ubmVjdGlvbih1cmwsIG9wdGlvbnMpO1xuICBhbGxDb25uZWN0aW9ucy5wdXNoKHJldCk7IC8vIGhhY2suIHNlZSBiZWxvdy5cbiAgcmV0dXJuIHJldDtcbn07XG5cbkREUC5fcmVjb25uZWN0SG9vayA9IG5ldyBIb29rKHsgYmluZEVudmlyb25tZW50OiBmYWxzZSB9KTtcblxuLyoqXG4gKiBAc3VtbWFyeSBSZWdpc3RlciBhIGZ1bmN0aW9uIHRvIGNhbGwgYXMgdGhlIGZpcnN0IHN0ZXAgb2ZcbiAqIHJlY29ubmVjdGluZy4gVGhpcyBmdW5jdGlvbiBjYW4gY2FsbCBtZXRob2RzIHdoaWNoIHdpbGwgYmUgZXhlY3V0ZWQgYmVmb3JlXG4gKiBhbnkgb3RoZXIgb3V0c3RhbmRpbmcgbWV0aG9kcy4gRm9yIGV4YW1wbGUsIHRoaXMgY2FuIGJlIHVzZWQgdG8gcmUtZXN0YWJsaXNoXG4gKiB0aGUgYXBwcm9wcmlhdGUgYXV0aGVudGljYXRpb24gY29udGV4dCBvbiB0aGUgY29ubmVjdGlvbi5cbiAqIEBsb2N1cyBBbnl3aGVyZVxuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgVGhlIGZ1bmN0aW9uIHRvIGNhbGwuIEl0IHdpbGwgYmUgY2FsbGVkIHdpdGggYVxuICogc2luZ2xlIGFyZ3VtZW50LCB0aGUgW2Nvbm5lY3Rpb24gb2JqZWN0XSgjZGRwX2Nvbm5lY3QpIHRoYXQgaXMgcmVjb25uZWN0aW5nLlxuICovXG5ERFAub25SZWNvbm5lY3QgPSBjYWxsYmFjayA9PiBERFAuX3JlY29ubmVjdEhvb2sucmVnaXN0ZXIoY2FsbGJhY2spO1xuXG4vLyBIYWNrIGZvciBgc3BpZGVyYWJsZWAgcGFja2FnZTogYSB3YXkgdG8gc2VlIGlmIHRoZSBwYWdlIGlzIGRvbmVcbi8vIGxvYWRpbmcgYWxsIHRoZSBkYXRhIGl0IG5lZWRzLlxuLy9cbkREUC5fYWxsU3Vic2NyaXB0aW9uc1JlYWR5ID0gKCkgPT4gYWxsQ29ubmVjdGlvbnMuZXZlcnkoXG4gIGNvbm4gPT4gT2JqZWN0LnZhbHVlcyhjb25uLl9zdWJzY3JpcHRpb25zKS5ldmVyeShzdWIgPT4gc3ViLnJlYWR5KVxuKTtcbiJdfQ==
