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

var require = meteorInstall({"node_modules":{"meteor":{"ddp-client":{"server":{"server.js":function module(require,exports,module){

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

}},"common":{"MethodInvoker.js":function module(require,exports,module){

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

},"livedata_connection.js":function module(require,exports,module){

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

},"namespace.js":function module(require,exports,module){

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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvZGRwLWNsaWVudC9zZXJ2ZXIvc2VydmVyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9kZHAtY2xpZW50L2NvbW1vbi9NZXRob2RJbnZva2VyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9kZHAtY2xpZW50L2NvbW1vbi9saXZlZGF0YV9jb25uZWN0aW9uLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9kZHAtY2xpZW50L2NvbW1vbi9uYW1lc3BhY2UuanMiXSwibmFtZXMiOlsibW9kdWxlIiwibGluayIsIkREUCIsImV4cG9ydCIsImRlZmF1bHQiLCJNZXRob2RJbnZva2VyIiwiY29uc3RydWN0b3IiLCJvcHRpb25zIiwibWV0aG9kSWQiLCJzZW50TWVzc2FnZSIsIl9jYWxsYmFjayIsImNhbGxiYWNrIiwiX2Nvbm5lY3Rpb24iLCJjb25uZWN0aW9uIiwiX21lc3NhZ2UiLCJtZXNzYWdlIiwiX29uUmVzdWx0UmVjZWl2ZWQiLCJvblJlc3VsdFJlY2VpdmVkIiwiX3dhaXQiLCJ3YWl0Iiwibm9SZXRyeSIsIl9tZXRob2RSZXN1bHQiLCJfZGF0YVZpc2libGUiLCJfbWV0aG9kSW52b2tlcnMiLCJzZW5kTWVzc2FnZSIsImdvdFJlc3VsdCIsIkVycm9yIiwiX21ldGhvZHNCbG9ja2luZ1F1aWVzY2VuY2UiLCJfc2VuZCIsIl9tYXliZUludm9rZUNhbGxiYWNrIiwiX291dHN0YW5kaW5nTWV0aG9kRmluaXNoZWQiLCJyZWNlaXZlUmVzdWx0IiwiZXJyIiwicmVzdWx0IiwiZGF0YVZpc2libGUiLCJfb2JqZWN0U3ByZWFkIiwidiIsIkNvbm5lY3Rpb24iLCJNZXRlb3IiLCJERFBDb21tb24iLCJUcmFja2VyIiwiRUpTT04iLCJSYW5kb20iLCJIb29rIiwiTW9uZ29JRCIsImhhc093biIsInNsaWNlIiwia2V5cyIsImlzRW1wdHkiLCJsYXN0IiwiRmliZXIiLCJGdXR1cmUiLCJpc1NlcnZlciIsIk5wbSIsInJlcXVpcmUiLCJNb25nb0lETWFwIiwiSWRNYXAiLCJpZFN0cmluZ2lmeSIsImlkUGFyc2UiLCJ1cmwiLCJzZWxmIiwib25Db25uZWN0ZWQiLCJvbkREUFZlcnNpb25OZWdvdGlhdGlvbkZhaWx1cmUiLCJkZXNjcmlwdGlvbiIsIl9kZWJ1ZyIsImhlYXJ0YmVhdEludGVydmFsIiwiaGVhcnRiZWF0VGltZW91dCIsIm5wbUZheWVPcHRpb25zIiwiT2JqZWN0IiwiY3JlYXRlIiwicmVsb2FkV2l0aE91dHN0YW5kaW5nIiwic3VwcG9ydGVkRERQVmVyc2lvbnMiLCJTVVBQT1JURURfRERQX1ZFUlNJT05TIiwicmV0cnkiLCJyZXNwb25kVG9QaW5ncyIsImJ1ZmZlcmVkV3JpdGVzSW50ZXJ2YWwiLCJidWZmZXJlZFdyaXRlc01heEFnZSIsIm9uUmVjb25uZWN0IiwiX3N0cmVhbSIsIkNsaWVudFN0cmVhbSIsIkNvbm5lY3Rpb25FcnJvciIsImhlYWRlcnMiLCJfc29ja2pzT3B0aW9ucyIsIl9kb250UHJpbnRFcnJvcnMiLCJjb25uZWN0VGltZW91dE1zIiwiX2xhc3RTZXNzaW9uSWQiLCJfdmVyc2lvblN1Z2dlc3Rpb24iLCJfdmVyc2lvbiIsIl9zdG9yZXMiLCJfbWV0aG9kSGFuZGxlcnMiLCJfbmV4dE1ldGhvZElkIiwiX3N1cHBvcnRlZEREUFZlcnNpb25zIiwiX2hlYXJ0YmVhdEludGVydmFsIiwiX2hlYXJ0YmVhdFRpbWVvdXQiLCJfb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MiLCJfZG9jdW1lbnRzV3JpdHRlbkJ5U3R1YiIsIl9zZXJ2ZXJEb2N1bWVudHMiLCJfYWZ0ZXJVcGRhdGVDYWxsYmFja3MiLCJfbWVzc2FnZXNCdWZmZXJlZFVudGlsUXVpZXNjZW5jZSIsIl9zdWJzQmVpbmdSZXZpdmVkIiwiX3Jlc2V0U3RvcmVzIiwiX3VwZGF0ZXNGb3JVbmtub3duU3RvcmVzIiwiX3JldHJ5TWlncmF0ZSIsIl9fZmx1c2hCdWZmZXJlZFdyaXRlcyIsImJpbmRFbnZpcm9ubWVudCIsIl9mbHVzaEJ1ZmZlcmVkV3JpdGVzIiwiX2J1ZmZlcmVkV3JpdGVzIiwiX2J1ZmZlcmVkV3JpdGVzRmx1c2hBdCIsIl9idWZmZXJlZFdyaXRlc0ZsdXNoSGFuZGxlIiwiX2J1ZmZlcmVkV3JpdGVzSW50ZXJ2YWwiLCJfYnVmZmVyZWRXcml0ZXNNYXhBZ2UiLCJfc3Vic2NyaXB0aW9ucyIsIl91c2VySWQiLCJfdXNlcklkRGVwcyIsIkRlcGVuZGVuY3kiLCJpc0NsaWVudCIsIlBhY2thZ2UiLCJyZWxvYWQiLCJSZWxvYWQiLCJfb25NaWdyYXRlIiwiX3JlYWR5VG9NaWdyYXRlIiwib25EaXNjb25uZWN0IiwiX2hlYXJ0YmVhdCIsInN0b3AiLCJvbiIsIm9uTWVzc2FnZSIsImJpbmQiLCJvblJlc2V0IiwicmVnaXN0ZXJTdG9yZSIsIm5hbWUiLCJ3cmFwcGVkU3RvcmUiLCJzdG9yZSIsImtleXNPZlN0b3JlIiwiZm9yRWFjaCIsIm1ldGhvZCIsInF1ZXVlZCIsIkFycmF5IiwiaXNBcnJheSIsImJlZ2luVXBkYXRlIiwibGVuZ3RoIiwibXNnIiwidXBkYXRlIiwiZW5kVXBkYXRlIiwic3Vic2NyaWJlIiwicGFyYW1zIiwiY2FsbCIsImFyZ3VtZW50cyIsImNhbGxiYWNrcyIsImxhc3RQYXJhbSIsIm9uUmVhZHkiLCJwb3AiLCJvbkVycm9yIiwib25TdG9wIiwic29tZSIsImYiLCJleGlzdGluZyIsInZhbHVlcyIsImZpbmQiLCJzdWIiLCJpbmFjdGl2ZSIsImVxdWFscyIsImlkIiwicmVhZHkiLCJyZWFkeUNhbGxiYWNrIiwiZXJyb3JDYWxsYmFjayIsInN0b3BDYWxsYmFjayIsImNsb25lIiwicmVhZHlEZXBzIiwicmVtb3ZlIiwiY2hhbmdlZCIsImhhbmRsZSIsInJlY29yZCIsImRlcGVuZCIsInN1YnNjcmlwdGlvbklkIiwiYWN0aXZlIiwib25JbnZhbGlkYXRlIiwiYyIsImFmdGVyRmx1c2giLCJfc3Vic2NyaWJlQW5kV2FpdCIsImFyZ3MiLCJwdXNoIiwiZSIsIm9uTGF0ZUVycm9yIiwiYXBwbHkiLCJjb25jYXQiLCJtZXRob2RzIiwiZW50cmllcyIsImZ1bmMiLCJlbmNsb3NpbmciLCJfQ3VycmVudE1ldGhvZEludm9jYXRpb24iLCJnZXQiLCJhbHJlYWR5SW5TaW11bGF0aW9uIiwiaXNTaW11bGF0aW9uIiwicmFuZG9tU2VlZCIsInJhbmRvbVNlZWRHZW5lcmF0b3IiLCJtYWtlUnBjU2VlZCIsInN0dWJSZXR1cm5WYWx1ZSIsImV4Y2VwdGlvbiIsInN0dWIiLCJzZXRVc2VySWQiLCJ1c2VySWQiLCJpbnZvY2F0aW9uIiwiTWV0aG9kSW52b2NhdGlvbiIsIl9zYXZlT3JpZ2luYWxzIiwid2l0aFZhbHVlIiwiX25vWWllbGRzQWxsb3dlZCIsInVuZGVmaW5lZCIsIl9yZXRyaWV2ZUFuZFN0b3JlT3JpZ2luYWxzIiwidGhyb3dTdHViRXhjZXB0aW9ucyIsIl9leHBlY3RlZEJ5VGVzdCIsImZ1dHVyZSIsInJlc29sdmVyIiwibWV0aG9kSW52b2tlciIsInJldHVyblN0dWJWYWx1ZSIsIl93YWl0aW5nRm9yUXVpZXNjZW5jZSIsInNhdmVPcmlnaW5hbHMiLCJkb2NzV3JpdHRlbiIsImNvbGxlY3Rpb24iLCJvcmlnaW5hbHMiLCJyZXRyaWV2ZU9yaWdpbmFscyIsImRvYyIsInNlcnZlckRvYyIsInNldERlZmF1bHQiLCJ3cml0dGVuQnlTdHVicyIsImRvY3VtZW50IiwiZmx1c2hDYWxsYmFja3MiLCJfdW5zdWJzY3JpYmVBbGwiLCJvYmoiLCJzZW5kIiwic3RyaW5naWZ5RERQIiwiX2xvc3RDb25uZWN0aW9uIiwiZXJyb3IiLCJzdGF0dXMiLCJyZWNvbm5lY3QiLCJkaXNjb25uZWN0IiwiY2xvc2UiLCJfcGVybWFuZW50IiwiX2FueU1ldGhvZHNBcmVPdXRzdGFuZGluZyIsImludm9rZXJzIiwiaW52b2tlciIsIl9saXZlZGF0YV9jb25uZWN0ZWQiLCJIZWFydGJlYXQiLCJvblRpbWVvdXQiLCJzZW5kUGluZyIsInN0YXJ0IiwicmVjb25uZWN0ZWRUb1ByZXZpb3VzU2Vzc2lvbiIsInNlc3Npb24iLCJfcnVuQWZ0ZXJVcGRhdGVDYWxsYmFja3MiLCJfcHJvY2Vzc09uZURhdGFNZXNzYWdlIiwidXBkYXRlcyIsIm1lc3NhZ2VUeXBlIiwiX3Byb2Nlc3NfYWRkZWQiLCJfcHJvY2Vzc19jaGFuZ2VkIiwiX3Byb2Nlc3NfcmVtb3ZlZCIsIl9wcm9jZXNzX3JlYWR5IiwiX3Byb2Nlc3NfdXBkYXRlZCIsIl9saXZlZGF0YV9kYXRhIiwic3VicyIsInN1YklkIiwiYnVmZmVyZWRNZXNzYWdlcyIsImJ1ZmZlcmVkTWVzc2FnZSIsInN0YW5kYXJkV3JpdGUiLCJEYXRlIiwidmFsdWVPZiIsImNsZWFyVGltZW91dCIsInNldFRpbWVvdXQiLCJ3cml0ZXMiLCJfcGVyZm9ybVdyaXRlcyIsInN0b3JlTmFtZSIsInVwZGF0ZU1lc3NhZ2VzIiwidXBkYXRlTWVzc2FnZSIsIl9wdXNoVXBkYXRlIiwiX2dldFNlcnZlckRvYyIsInNlcnZlckRvY3NGb3JDb2xsZWN0aW9uIiwiaXNFeGlzdGluZyIsImZpZWxkcyIsIl9pZCIsImN1cnJlbnREb2MiLCJnZXREb2MiLCJEaWZmU2VxdWVuY2UiLCJhcHBseUNoYW5nZXMiLCJkb2NzIiwid3JpdHRlbiIsIkpTT04iLCJzdHJpbmdpZnkiLCJyZXBsYWNlIiwiY2FsbGJhY2tJbnZva2VyIiwiX3J1bldoZW5BbGxTZXJ2ZXJEb2NzQXJlRmx1c2hlZCIsInN1YlJlY29yZCIsInJ1bkZBZnRlclVwZGF0ZXMiLCJ1bmZsdXNoZWRTZXJ2ZXJEb2NDb3VudCIsIm9uU2VydmVyRG9jRmx1c2giLCJzZXJ2ZXJEb2N1bWVudHMiLCJ3cml0dGVuQnlTdHViRm9yQU1ldGhvZFdpdGhTZW50TWVzc2FnZSIsIl9saXZlZGF0YV9ub3N1YiIsIm1ldGVvckVycm9yRnJvbU1zZyIsIm1zZ0FyZyIsInJlYXNvbiIsImRldGFpbHMiLCJfbGl2ZWRhdGFfcmVzdWx0IiwiY3VycmVudE1ldGhvZEJsb2NrIiwiaSIsIm0iLCJpZHgiLCJmb3VuZCIsInNwbGljZSIsImZpcnN0QmxvY2siLCJzaGlmdCIsIl9zZW5kT3V0c3RhbmRpbmdNZXRob2RzIiwiX21heWJlTWlncmF0ZSIsIl9saXZlZGF0YV9lcnJvciIsIm9mZmVuZGluZ01lc3NhZ2UiLCJfY2FsbE9uUmVjb25uZWN0QW5kU2VuZEFwcHJvcHJpYXRlT3V0c3RhbmRpbmdNZXRob2RzIiwib2xkT3V0c3RhbmRpbmdNZXRob2RCbG9ja3MiLCJfcmVjb25uZWN0SG9vayIsImVhY2giLCJyYXdfbXNnIiwicGFyc2VERFAiLCJtZXNzYWdlUmVjZWl2ZWQiLCJzZXJ2ZXJfaWQiLCJpbmRleE9mIiwidmVyc2lvbiIsIl9mb3JjZSIsIl9lcnJvciIsImluY2x1ZGVzIiwic3VwcG9ydCIsImZpbHRlciIsImFsbENvbm5lY3Rpb25zIiwiRW52aXJvbm1lbnRWYXJpYWJsZSIsIl9DdXJyZW50UHVibGljYXRpb25JbnZvY2F0aW9uIiwiX0N1cnJlbnRJbnZvY2F0aW9uIiwiY29ubmVjdGlvbkVycm9yQ29uc3RydWN0b3IiLCJtYWtlRXJyb3JUeXBlIiwiRm9yY2VkUmVjb25uZWN0RXJyb3IiLCJyYW5kb21TdHJlYW0iLCJzY29wZSIsIlJhbmRvbVN0cmVhbSIsImNvbm5lY3QiLCJyZXQiLCJyZWdpc3RlciIsIl9hbGxTdWJzY3JpcHRpb25zUmVhZHkiLCJldmVyeSIsImNvbm4iXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBQSxNQUFNLENBQUNDLElBQVAsQ0FBWSx3QkFBWixFQUFxQztBQUFDQyxLQUFHLEVBQUM7QUFBTCxDQUFyQyxFQUFpRCxDQUFqRCxFOzs7Ozs7Ozs7OztBQ0FBRixNQUFNLENBQUNHLE1BQVAsQ0FBYztBQUFDQyxTQUFPLEVBQUMsTUFBSUM7QUFBYixDQUFkOztBQUtlLE1BQU1BLGFBQU4sQ0FBb0I7QUFDakNDLGFBQVcsQ0FBQ0MsT0FBRCxFQUFVO0FBQ25CO0FBQ0EsU0FBS0MsUUFBTCxHQUFnQkQsT0FBTyxDQUFDQyxRQUF4QjtBQUNBLFNBQUtDLFdBQUwsR0FBbUIsS0FBbkI7QUFFQSxTQUFLQyxTQUFMLEdBQWlCSCxPQUFPLENBQUNJLFFBQXpCO0FBQ0EsU0FBS0MsV0FBTCxHQUFtQkwsT0FBTyxDQUFDTSxVQUEzQjtBQUNBLFNBQUtDLFFBQUwsR0FBZ0JQLE9BQU8sQ0FBQ1EsT0FBeEI7O0FBQ0EsU0FBS0MsaUJBQUwsR0FBeUJULE9BQU8sQ0FBQ1UsZ0JBQVIsS0FBNkIsTUFBTSxDQUFFLENBQXJDLENBQXpCOztBQUNBLFNBQUtDLEtBQUwsR0FBYVgsT0FBTyxDQUFDWSxJQUFyQjtBQUNBLFNBQUtDLE9BQUwsR0FBZWIsT0FBTyxDQUFDYSxPQUF2QjtBQUNBLFNBQUtDLGFBQUwsR0FBcUIsSUFBckI7QUFDQSxTQUFLQyxZQUFMLEdBQW9CLEtBQXBCLENBWm1CLENBY25COztBQUNBLFNBQUtWLFdBQUwsQ0FBaUJXLGVBQWpCLENBQWlDLEtBQUtmLFFBQXRDLElBQWtELElBQWxEO0FBQ0QsR0FqQmdDLENBa0JqQztBQUNBOzs7QUFDQWdCLGFBQVcsR0FBRztBQUNaO0FBQ0E7QUFDQTtBQUNBLFFBQUksS0FBS0MsU0FBTCxFQUFKLEVBQ0UsTUFBTSxJQUFJQyxLQUFKLENBQVUsK0NBQVYsQ0FBTixDQUxVLENBT1o7QUFDQTs7QUFDQSxTQUFLSixZQUFMLEdBQW9CLEtBQXBCO0FBQ0EsU0FBS2IsV0FBTCxHQUFtQixJQUFuQixDQVZZLENBWVo7QUFDQTs7QUFDQSxRQUFJLEtBQUtTLEtBQVQsRUFDRSxLQUFLTixXQUFMLENBQWlCZSwwQkFBakIsQ0FBNEMsS0FBS25CLFFBQWpELElBQTZELElBQTdELENBZlUsQ0FpQlo7O0FBQ0EsU0FBS0ksV0FBTCxDQUFpQmdCLEtBQWpCLENBQXVCLEtBQUtkLFFBQTVCO0FBQ0QsR0F2Q2dDLENBd0NqQztBQUNBOzs7QUFDQWUsc0JBQW9CLEdBQUc7QUFDckIsUUFBSSxLQUFLUixhQUFMLElBQXNCLEtBQUtDLFlBQS9CLEVBQTZDO0FBQzNDO0FBQ0E7QUFDQSxXQUFLWixTQUFMLENBQWUsS0FBS1csYUFBTCxDQUFtQixDQUFuQixDQUFmLEVBQXNDLEtBQUtBLGFBQUwsQ0FBbUIsQ0FBbkIsQ0FBdEMsRUFIMkMsQ0FLM0M7OztBQUNBLGFBQU8sS0FBS1QsV0FBTCxDQUFpQlcsZUFBakIsQ0FBaUMsS0FBS2YsUUFBdEMsQ0FBUCxDQU4yQyxDQVEzQztBQUNBOztBQUNBLFdBQUtJLFdBQUwsQ0FBaUJrQiwwQkFBakI7QUFDRDtBQUNGLEdBdkRnQyxDQXdEakM7QUFDQTtBQUNBO0FBQ0E7OztBQUNBQyxlQUFhLENBQUNDLEdBQUQsRUFBTUMsTUFBTixFQUFjO0FBQ3pCLFFBQUksS0FBS1IsU0FBTCxFQUFKLEVBQ0UsTUFBTSxJQUFJQyxLQUFKLENBQVUsMENBQVYsQ0FBTjtBQUNGLFNBQUtMLGFBQUwsR0FBcUIsQ0FBQ1csR0FBRCxFQUFNQyxNQUFOLENBQXJCOztBQUNBLFNBQUtqQixpQkFBTCxDQUF1QmdCLEdBQXZCLEVBQTRCQyxNQUE1Qjs7QUFDQSxTQUFLSixvQkFBTDtBQUNELEdBbEVnQyxDQW1FakM7QUFDQTtBQUNBO0FBQ0E7OztBQUNBSyxhQUFXLEdBQUc7QUFDWixTQUFLWixZQUFMLEdBQW9CLElBQXBCOztBQUNBLFNBQUtPLG9CQUFMO0FBQ0QsR0ExRWdDLENBMkVqQzs7O0FBQ0FKLFdBQVMsR0FBRztBQUNWLFdBQU8sQ0FBQyxDQUFDLEtBQUtKLGFBQWQ7QUFDRDs7QUE5RWdDLEM7Ozs7Ozs7Ozs7O0FDTG5DLElBQUljLGFBQUo7O0FBQWtCbkMsTUFBTSxDQUFDQyxJQUFQLENBQVksc0NBQVosRUFBbUQ7QUFBQ0csU0FBTyxDQUFDZ0MsQ0FBRCxFQUFHO0FBQUNELGlCQUFhLEdBQUNDLENBQWQ7QUFBZ0I7O0FBQTVCLENBQW5ELEVBQWlGLENBQWpGO0FBQWxCcEMsTUFBTSxDQUFDRyxNQUFQLENBQWM7QUFBQ2tDLFlBQVUsRUFBQyxNQUFJQTtBQUFoQixDQUFkO0FBQTJDLElBQUlDLE1BQUo7QUFBV3RDLE1BQU0sQ0FBQ0MsSUFBUCxDQUFZLGVBQVosRUFBNEI7QUFBQ3FDLFFBQU0sQ0FBQ0YsQ0FBRCxFQUFHO0FBQUNFLFVBQU0sR0FBQ0YsQ0FBUDtBQUFTOztBQUFwQixDQUE1QixFQUFrRCxDQUFsRDtBQUFxRCxJQUFJRyxTQUFKO0FBQWN2QyxNQUFNLENBQUNDLElBQVAsQ0FBWSxtQkFBWixFQUFnQztBQUFDc0MsV0FBUyxDQUFDSCxDQUFELEVBQUc7QUFBQ0csYUFBUyxHQUFDSCxDQUFWO0FBQVk7O0FBQTFCLENBQWhDLEVBQTRELENBQTVEO0FBQStELElBQUlJLE9BQUo7QUFBWXhDLE1BQU0sQ0FBQ0MsSUFBUCxDQUFZLGdCQUFaLEVBQTZCO0FBQUN1QyxTQUFPLENBQUNKLENBQUQsRUFBRztBQUFDSSxXQUFPLEdBQUNKLENBQVI7QUFBVTs7QUFBdEIsQ0FBN0IsRUFBcUQsQ0FBckQ7QUFBd0QsSUFBSUssS0FBSjtBQUFVekMsTUFBTSxDQUFDQyxJQUFQLENBQVksY0FBWixFQUEyQjtBQUFDd0MsT0FBSyxDQUFDTCxDQUFELEVBQUc7QUFBQ0ssU0FBSyxHQUFDTCxDQUFOO0FBQVE7O0FBQWxCLENBQTNCLEVBQStDLENBQS9DO0FBQWtELElBQUlNLE1BQUo7QUFBVzFDLE1BQU0sQ0FBQ0MsSUFBUCxDQUFZLGVBQVosRUFBNEI7QUFBQ3lDLFFBQU0sQ0FBQ04sQ0FBRCxFQUFHO0FBQUNNLFVBQU0sR0FBQ04sQ0FBUDtBQUFTOztBQUFwQixDQUE1QixFQUFrRCxDQUFsRDtBQUFxRCxJQUFJTyxJQUFKO0FBQVMzQyxNQUFNLENBQUNDLElBQVAsQ0FBWSxzQkFBWixFQUFtQztBQUFDMEMsTUFBSSxDQUFDUCxDQUFELEVBQUc7QUFBQ08sUUFBSSxHQUFDUCxDQUFMO0FBQU87O0FBQWhCLENBQW5DLEVBQXFELENBQXJEO0FBQXdELElBQUlRLE9BQUo7QUFBWTVDLE1BQU0sQ0FBQ0MsSUFBUCxDQUFZLGlCQUFaLEVBQThCO0FBQUMyQyxTQUFPLENBQUNSLENBQUQsRUFBRztBQUFDUSxXQUFPLEdBQUNSLENBQVI7QUFBVTs7QUFBdEIsQ0FBOUIsRUFBc0QsQ0FBdEQ7QUFBeUQsSUFBSWxDLEdBQUo7QUFBUUYsTUFBTSxDQUFDQyxJQUFQLENBQVksZ0JBQVosRUFBNkI7QUFBQ0MsS0FBRyxDQUFDa0MsQ0FBRCxFQUFHO0FBQUNsQyxPQUFHLEdBQUNrQyxDQUFKO0FBQU07O0FBQWQsQ0FBN0IsRUFBNkMsQ0FBN0M7QUFBZ0QsSUFBSS9CLGFBQUo7QUFBa0JMLE1BQU0sQ0FBQ0MsSUFBUCxDQUFZLG9CQUFaLEVBQWlDO0FBQUNHLFNBQU8sQ0FBQ2dDLENBQUQsRUFBRztBQUFDL0IsaUJBQWEsR0FBQytCLENBQWQ7QUFBZ0I7O0FBQTVCLENBQWpDLEVBQStELENBQS9EO0FBQWtFLElBQUlTLE1BQUosRUFBV0MsS0FBWCxFQUFpQkMsSUFBakIsRUFBc0JDLE9BQXRCLEVBQThCQyxJQUE5QjtBQUFtQ2pELE1BQU0sQ0FBQ0MsSUFBUCxDQUFZLDRCQUFaLEVBQXlDO0FBQUM0QyxRQUFNLENBQUNULENBQUQsRUFBRztBQUFDUyxVQUFNLEdBQUNULENBQVA7QUFBUyxHQUFwQjs7QUFBcUJVLE9BQUssQ0FBQ1YsQ0FBRCxFQUFHO0FBQUNVLFNBQUssR0FBQ1YsQ0FBTjtBQUFRLEdBQXRDOztBQUF1Q1csTUFBSSxDQUFDWCxDQUFELEVBQUc7QUFBQ1csUUFBSSxHQUFDWCxDQUFMO0FBQU8sR0FBdEQ7O0FBQXVEWSxTQUFPLENBQUNaLENBQUQsRUFBRztBQUFDWSxXQUFPLEdBQUNaLENBQVI7QUFBVSxHQUE1RTs7QUFBNkVhLE1BQUksQ0FBQ2IsQ0FBRCxFQUFHO0FBQUNhLFFBQUksR0FBQ2IsQ0FBTDtBQUFPOztBQUE1RixDQUF6QyxFQUF1SSxDQUF2STtBQWlCN3FCLElBQUljLEtBQUo7QUFDQSxJQUFJQyxNQUFKOztBQUNBLElBQUliLE1BQU0sQ0FBQ2MsUUFBWCxFQUFxQjtBQUNuQkYsT0FBSyxHQUFHRyxHQUFHLENBQUNDLE9BQUosQ0FBWSxRQUFaLENBQVI7QUFDQUgsUUFBTSxHQUFHRSxHQUFHLENBQUNDLE9BQUosQ0FBWSxlQUFaLENBQVQ7QUFDRDs7QUFFRCxNQUFNQyxVQUFOLFNBQXlCQyxLQUF6QixDQUErQjtBQUM3QmxELGFBQVcsR0FBRztBQUNaLFVBQU1zQyxPQUFPLENBQUNhLFdBQWQsRUFBMkJiLE9BQU8sQ0FBQ2MsT0FBbkM7QUFDRDs7QUFINEIsQyxDQU0vQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUFDTyxNQUFNckIsVUFBTixDQUFpQjtBQUN0Qi9CLGFBQVcsQ0FBQ3FELEdBQUQsRUFBTXBELE9BQU4sRUFBZTtBQUN4QixVQUFNcUQsSUFBSSxHQUFHLElBQWI7QUFFQSxTQUFLckQsT0FBTCxHQUFlQSxPQUFPO0FBQ3BCc0QsaUJBQVcsR0FBRyxDQUFFLENBREk7O0FBRXBCQyxvQ0FBOEIsQ0FBQ0MsV0FBRCxFQUFjO0FBQzFDekIsY0FBTSxDQUFDMEIsTUFBUCxDQUFjRCxXQUFkO0FBQ0QsT0FKbUI7O0FBS3BCRSx1QkFBaUIsRUFBRSxLQUxDO0FBTXBCQyxzQkFBZ0IsRUFBRSxLQU5FO0FBT3BCQyxvQkFBYyxFQUFFQyxNQUFNLENBQUNDLE1BQVAsQ0FBYyxJQUFkLENBUEk7QUFRcEI7QUFDQUMsMkJBQXFCLEVBQUUsS0FUSDtBQVVwQkMsMEJBQW9CLEVBQUVoQyxTQUFTLENBQUNpQyxzQkFWWjtBQVdwQkMsV0FBSyxFQUFFLElBWGE7QUFZcEJDLG9CQUFjLEVBQUUsSUFaSTtBQWFwQjtBQUNBQyw0QkFBc0IsRUFBRSxDQWRKO0FBZXBCO0FBQ0FDLDBCQUFvQixFQUFFO0FBaEJGLE9Ba0JqQnJFLE9BbEJpQixDQUF0QixDQUh3QixDQXdCeEI7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFDQXFELFFBQUksQ0FBQ2lCLFdBQUwsR0FBbUIsSUFBbkIsQ0E3QndCLENBK0J4Qjs7QUFDQSxRQUFJLE9BQU9sQixHQUFQLEtBQWUsUUFBbkIsRUFBNkI7QUFDM0JDLFVBQUksQ0FBQ2tCLE9BQUwsR0FBZW5CLEdBQWY7QUFDRCxLQUZELE1BRU87QUFDTCxZQUFNO0FBQUVvQjtBQUFGLFVBQW1CekIsT0FBTyxDQUFDLDZCQUFELENBQWhDOztBQUNBTSxVQUFJLENBQUNrQixPQUFMLEdBQWUsSUFBSUMsWUFBSixDQUFpQnBCLEdBQWpCLEVBQXNCO0FBQ25DYyxhQUFLLEVBQUVsRSxPQUFPLENBQUNrRSxLQURvQjtBQUVuQ08sdUJBQWUsRUFBRTlFLEdBQUcsQ0FBQzhFLGVBRmM7QUFHbkNDLGVBQU8sRUFBRTFFLE9BQU8sQ0FBQzBFLE9BSGtCO0FBSW5DQyxzQkFBYyxFQUFFM0UsT0FBTyxDQUFDMkUsY0FKVztBQUtuQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0FDLHdCQUFnQixFQUFFNUUsT0FBTyxDQUFDNEUsZ0JBVlM7QUFXbkNDLHdCQUFnQixFQUFFN0UsT0FBTyxDQUFDNkUsZ0JBWFM7QUFZbkNqQixzQkFBYyxFQUFFNUQsT0FBTyxDQUFDNEQ7QUFaVyxPQUF0QixDQUFmO0FBY0Q7O0FBRURQLFFBQUksQ0FBQ3lCLGNBQUwsR0FBc0IsSUFBdEI7QUFDQXpCLFFBQUksQ0FBQzBCLGtCQUFMLEdBQTBCLElBQTFCLENBckR3QixDQXFEUTs7QUFDaEMxQixRQUFJLENBQUMyQixRQUFMLEdBQWdCLElBQWhCLENBdER3QixDQXNERjs7QUFDdEIzQixRQUFJLENBQUM0QixPQUFMLEdBQWVwQixNQUFNLENBQUNDLE1BQVAsQ0FBYyxJQUFkLENBQWYsQ0F2RHdCLENBdURZOztBQUNwQ1QsUUFBSSxDQUFDNkIsZUFBTCxHQUF1QnJCLE1BQU0sQ0FBQ0MsTUFBUCxDQUFjLElBQWQsQ0FBdkIsQ0F4RHdCLENBd0RvQjs7QUFDNUNULFFBQUksQ0FBQzhCLGFBQUwsR0FBcUIsQ0FBckI7QUFDQTlCLFFBQUksQ0FBQytCLHFCQUFMLEdBQTZCcEYsT0FBTyxDQUFDZ0Usb0JBQXJDO0FBRUFYLFFBQUksQ0FBQ2dDLGtCQUFMLEdBQTBCckYsT0FBTyxDQUFDMEQsaUJBQWxDO0FBQ0FMLFFBQUksQ0FBQ2lDLGlCQUFMLEdBQXlCdEYsT0FBTyxDQUFDMkQsZ0JBQWpDLENBN0R3QixDQStEeEI7QUFDQTtBQUNBO0FBQ0E7O0FBQ0FOLFFBQUksQ0FBQ3JDLGVBQUwsR0FBdUI2QyxNQUFNLENBQUNDLE1BQVAsQ0FBYyxJQUFkLENBQXZCLENBbkV3QixDQXFFeEI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUNBVCxRQUFJLENBQUNrQyx3QkFBTCxHQUFnQyxFQUFoQyxDQXpHd0IsQ0EyR3hCO0FBQ0E7QUFDQTtBQUNBOztBQUNBbEMsUUFBSSxDQUFDbUMsdUJBQUwsR0FBK0IzQixNQUFNLENBQUNDLE1BQVAsQ0FBYyxJQUFkLENBQS9CLENBL0d3QixDQWdIeEI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBQ0FULFFBQUksQ0FBQ29DLGdCQUFMLEdBQXdCNUIsTUFBTSxDQUFDQyxNQUFQLENBQWMsSUFBZCxDQUF4QixDQXZId0IsQ0F5SHhCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBQ0FULFFBQUksQ0FBQ3FDLHFCQUFMLEdBQTZCLEVBQTdCLENBakl3QixDQW1JeEI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUVBOztBQUNBckMsUUFBSSxDQUFDc0MsZ0NBQUwsR0FBd0MsRUFBeEMsQ0FoSndCLENBaUp4QjtBQUNBO0FBQ0E7O0FBQ0F0QyxRQUFJLENBQUNqQywwQkFBTCxHQUFrQ3lDLE1BQU0sQ0FBQ0MsTUFBUCxDQUFjLElBQWQsQ0FBbEMsQ0FwSndCLENBcUp4QjtBQUNBOztBQUNBVCxRQUFJLENBQUN1QyxpQkFBTCxHQUF5Qi9CLE1BQU0sQ0FBQ0MsTUFBUCxDQUFjLElBQWQsQ0FBekIsQ0F2SndCLENBdUpzQjtBQUM5QztBQUNBOztBQUNBVCxRQUFJLENBQUN3QyxZQUFMLEdBQW9CLEtBQXBCLENBMUp3QixDQTRKeEI7O0FBQ0F4QyxRQUFJLENBQUN5Qyx3QkFBTCxHQUFnQ2pDLE1BQU0sQ0FBQ0MsTUFBUCxDQUFjLElBQWQsQ0FBaEMsQ0E3SndCLENBOEp4Qjs7QUFDQVQsUUFBSSxDQUFDMEMsYUFBTCxHQUFxQixJQUFyQjtBQUVBMUMsUUFBSSxDQUFDMkMscUJBQUwsR0FBNkJqRSxNQUFNLENBQUNrRSxlQUFQLENBQzNCNUMsSUFBSSxDQUFDNkMsb0JBRHNCLEVBRTNCLDhCQUYyQixFQUczQjdDLElBSDJCLENBQTdCLENBakt3QixDQXNLeEI7O0FBQ0FBLFFBQUksQ0FBQzhDLGVBQUwsR0FBdUJ0QyxNQUFNLENBQUNDLE1BQVAsQ0FBYyxJQUFkLENBQXZCLENBdkt3QixDQXdLeEI7O0FBQ0FULFFBQUksQ0FBQytDLHNCQUFMLEdBQThCLElBQTlCLENBekt3QixDQTBLeEI7O0FBQ0EvQyxRQUFJLENBQUNnRCwwQkFBTCxHQUFrQyxJQUFsQztBQUVBaEQsUUFBSSxDQUFDaUQsdUJBQUwsR0FBK0J0RyxPQUFPLENBQUNvRSxzQkFBdkM7QUFDQWYsUUFBSSxDQUFDa0QscUJBQUwsR0FBNkJ2RyxPQUFPLENBQUNxRSxvQkFBckMsQ0E5S3dCLENBZ0x4QjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUNBaEIsUUFBSSxDQUFDbUQsY0FBTCxHQUFzQjNDLE1BQU0sQ0FBQ0MsTUFBUCxDQUFjLElBQWQsQ0FBdEIsQ0EzTHdCLENBNkx4Qjs7QUFDQVQsUUFBSSxDQUFDb0QsT0FBTCxHQUFlLElBQWY7QUFDQXBELFFBQUksQ0FBQ3FELFdBQUwsR0FBbUIsSUFBSXpFLE9BQU8sQ0FBQzBFLFVBQVosRUFBbkIsQ0EvTHdCLENBaU14Qjs7QUFDQSxRQUFJNUUsTUFBTSxDQUFDNkUsUUFBUCxJQUNBQyxPQUFPLENBQUNDLE1BRFIsSUFFQSxDQUFFOUcsT0FBTyxDQUFDK0QscUJBRmQsRUFFcUM7QUFDbkM4QyxhQUFPLENBQUNDLE1BQVIsQ0FBZUMsTUFBZixDQUFzQkMsVUFBdEIsQ0FBaUM5QyxLQUFLLElBQUk7QUFDeEMsWUFBSSxDQUFFYixJQUFJLENBQUM0RCxlQUFMLEVBQU4sRUFBOEI7QUFDNUI1RCxjQUFJLENBQUMwQyxhQUFMLEdBQXFCN0IsS0FBckI7QUFDQSxpQkFBTyxDQUFDLEtBQUQsQ0FBUDtBQUNELFNBSEQsTUFHTztBQUNMLGlCQUFPLENBQUMsSUFBRCxDQUFQO0FBQ0Q7QUFDRixPQVBEO0FBUUQ7O0FBRUQsVUFBTWdELFlBQVksR0FBRyxNQUFNO0FBQ3pCLFVBQUk3RCxJQUFJLENBQUM4RCxVQUFULEVBQXFCO0FBQ25COUQsWUFBSSxDQUFDOEQsVUFBTCxDQUFnQkMsSUFBaEI7O0FBQ0EvRCxZQUFJLENBQUM4RCxVQUFMLEdBQWtCLElBQWxCO0FBQ0Q7QUFDRixLQUxEOztBQU9BLFFBQUlwRixNQUFNLENBQUNjLFFBQVgsRUFBcUI7QUFDbkJRLFVBQUksQ0FBQ2tCLE9BQUwsQ0FBYThDLEVBQWIsQ0FDRSxTQURGLEVBRUV0RixNQUFNLENBQUNrRSxlQUFQLENBQ0UsS0FBS3FCLFNBQUwsQ0FBZUMsSUFBZixDQUFvQixJQUFwQixDQURGLEVBRUUsc0JBRkYsQ0FGRjs7QUFPQWxFLFVBQUksQ0FBQ2tCLE9BQUwsQ0FBYThDLEVBQWIsQ0FDRSxPQURGLEVBRUV0RixNQUFNLENBQUNrRSxlQUFQLENBQXVCLEtBQUt1QixPQUFMLENBQWFELElBQWIsQ0FBa0IsSUFBbEIsQ0FBdkIsRUFBZ0Qsb0JBQWhELENBRkY7O0FBSUFsRSxVQUFJLENBQUNrQixPQUFMLENBQWE4QyxFQUFiLENBQ0UsWUFERixFQUVFdEYsTUFBTSxDQUFDa0UsZUFBUCxDQUF1QmlCLFlBQXZCLEVBQXFDLHlCQUFyQyxDQUZGO0FBSUQsS0FoQkQsTUFnQk87QUFDTDdELFVBQUksQ0FBQ2tCLE9BQUwsQ0FBYThDLEVBQWIsQ0FBZ0IsU0FBaEIsRUFBMkIsS0FBS0MsU0FBTCxDQUFlQyxJQUFmLENBQW9CLElBQXBCLENBQTNCOztBQUNBbEUsVUFBSSxDQUFDa0IsT0FBTCxDQUFhOEMsRUFBYixDQUFnQixPQUFoQixFQUF5QixLQUFLRyxPQUFMLENBQWFELElBQWIsQ0FBa0IsSUFBbEIsQ0FBekI7O0FBQ0FsRSxVQUFJLENBQUNrQixPQUFMLENBQWE4QyxFQUFiLENBQWdCLFlBQWhCLEVBQThCSCxZQUE5QjtBQUNEO0FBQ0YsR0E1T3FCLENBOE90QjtBQUNBO0FBQ0E7OztBQUNBTyxlQUFhLENBQUNDLElBQUQsRUFBT0MsWUFBUCxFQUFxQjtBQUNoQyxVQUFNdEUsSUFBSSxHQUFHLElBQWI7QUFFQSxRQUFJcUUsSUFBSSxJQUFJckUsSUFBSSxDQUFDNEIsT0FBakIsRUFBMEIsT0FBTyxLQUFQLENBSE0sQ0FLaEM7QUFDQTs7QUFDQSxVQUFNMkMsS0FBSyxHQUFHL0QsTUFBTSxDQUFDQyxNQUFQLENBQWMsSUFBZCxDQUFkO0FBQ0EsVUFBTStELFdBQVcsR0FBRyxDQUNsQixRQURrQixFQUVsQixhQUZrQixFQUdsQixXQUhrQixFQUlsQixlQUprQixFQUtsQixtQkFMa0IsRUFNbEIsUUFOa0IsRUFPbEIsZ0JBUGtCLENBQXBCO0FBU0FBLGVBQVcsQ0FBQ0MsT0FBWixDQUFxQkMsTUFBRCxJQUFZO0FBQzlCSCxXQUFLLENBQUNHLE1BQUQsQ0FBTCxHQUFnQixZQUFhO0FBQzNCLFlBQUlKLFlBQVksQ0FBQ0ksTUFBRCxDQUFoQixFQUEwQjtBQUN4QixpQkFBT0osWUFBWSxDQUFDSSxNQUFELENBQVosQ0FBcUIsWUFBckIsQ0FBUDtBQUNEO0FBQ0YsT0FKRDtBQUtELEtBTkQ7QUFPQTFFLFFBQUksQ0FBQzRCLE9BQUwsQ0FBYXlDLElBQWIsSUFBcUJFLEtBQXJCO0FBRUEsVUFBTUksTUFBTSxHQUFHM0UsSUFBSSxDQUFDeUMsd0JBQUwsQ0FBOEI0QixJQUE5QixDQUFmOztBQUNBLFFBQUlPLEtBQUssQ0FBQ0MsT0FBTixDQUFjRixNQUFkLENBQUosRUFBMkI7QUFDekJKLFdBQUssQ0FBQ08sV0FBTixDQUFrQkgsTUFBTSxDQUFDSSxNQUF6QixFQUFpQyxLQUFqQztBQUNBSixZQUFNLENBQUNGLE9BQVAsQ0FBZU8sR0FBRyxJQUFJO0FBQ3BCVCxhQUFLLENBQUNVLE1BQU4sQ0FBYUQsR0FBYjtBQUNELE9BRkQ7QUFHQVQsV0FBSyxDQUFDVyxTQUFOO0FBQ0EsYUFBT2xGLElBQUksQ0FBQ3lDLHdCQUFMLENBQThCNEIsSUFBOUIsQ0FBUDtBQUNEOztBQUVELFdBQU8sSUFBUDtBQUNEO0FBRUQ7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQUNFYyxXQUFTLENBQUNkO0FBQUs7QUFBTixJQUFvRDtBQUMzRCxVQUFNckUsSUFBSSxHQUFHLElBQWI7QUFFQSxVQUFNb0YsTUFBTSxHQUFHbEcsS0FBSyxDQUFDbUcsSUFBTixDQUFXQyxTQUFYLEVBQXNCLENBQXRCLENBQWY7QUFDQSxRQUFJQyxTQUFTLEdBQUcvRSxNQUFNLENBQUNDLE1BQVAsQ0FBYyxJQUFkLENBQWhCOztBQUNBLFFBQUkyRSxNQUFNLENBQUNMLE1BQVgsRUFBbUI7QUFDakIsWUFBTVMsU0FBUyxHQUFHSixNQUFNLENBQUNBLE1BQU0sQ0FBQ0wsTUFBUCxHQUFnQixDQUFqQixDQUF4Qjs7QUFDQSxVQUFJLE9BQU9TLFNBQVAsS0FBcUIsVUFBekIsRUFBcUM7QUFDbkNELGlCQUFTLENBQUNFLE9BQVYsR0FBb0JMLE1BQU0sQ0FBQ00sR0FBUCxFQUFwQjtBQUNELE9BRkQsTUFFTyxJQUFJRixTQUFTLElBQUksQ0FDdEJBLFNBQVMsQ0FBQ0MsT0FEWSxFQUV0QjtBQUNBO0FBQ0FELGVBQVMsQ0FBQ0csT0FKWSxFQUt0QkgsU0FBUyxDQUFDSSxNQUxZLEVBTXRCQyxJQU5zQixDQU1qQkMsQ0FBQyxJQUFJLE9BQU9BLENBQVAsS0FBYSxVQU5ELENBQWpCLEVBTStCO0FBQ3BDUCxpQkFBUyxHQUFHSCxNQUFNLENBQUNNLEdBQVAsRUFBWjtBQUNEO0FBQ0YsS0FsQjBELENBb0IzRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQUNBLFVBQU1LLFFBQVEsR0FBR3ZGLE1BQU0sQ0FBQ3dGLE1BQVAsQ0FBY2hHLElBQUksQ0FBQ21ELGNBQW5CLEVBQW1DOEMsSUFBbkMsQ0FDZkMsR0FBRyxJQUFLQSxHQUFHLENBQUNDLFFBQUosSUFBZ0JELEdBQUcsQ0FBQzdCLElBQUosS0FBYUEsSUFBN0IsSUFBcUN4RixLQUFLLENBQUN1SCxNQUFOLENBQWFGLEdBQUcsQ0FBQ2QsTUFBakIsRUFBeUJBLE1BQXpCLENBRDlCLENBQWpCO0FBSUEsUUFBSWlCLEVBQUo7O0FBQ0EsUUFBSU4sUUFBSixFQUFjO0FBQ1pNLFFBQUUsR0FBR04sUUFBUSxDQUFDTSxFQUFkO0FBQ0FOLGNBQVEsQ0FBQ0ksUUFBVCxHQUFvQixLQUFwQixDQUZZLENBRWU7O0FBRTNCLFVBQUlaLFNBQVMsQ0FBQ0UsT0FBZCxFQUF1QjtBQUNyQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxZQUFJTSxRQUFRLENBQUNPLEtBQWIsRUFBb0I7QUFDbEJmLG1CQUFTLENBQUNFLE9BQVY7QUFDRCxTQUZELE1BRU87QUFDTE0sa0JBQVEsQ0FBQ1EsYUFBVCxHQUF5QmhCLFNBQVMsQ0FBQ0UsT0FBbkM7QUFDRDtBQUNGLE9BbkJXLENBcUJaO0FBQ0E7OztBQUNBLFVBQUlGLFNBQVMsQ0FBQ0ksT0FBZCxFQUF1QjtBQUNyQjtBQUNBO0FBQ0FJLGdCQUFRLENBQUNTLGFBQVQsR0FBeUJqQixTQUFTLENBQUNJLE9BQW5DO0FBQ0Q7O0FBRUQsVUFBSUosU0FBUyxDQUFDSyxNQUFkLEVBQXNCO0FBQ3BCRyxnQkFBUSxDQUFDVSxZQUFULEdBQXdCbEIsU0FBUyxDQUFDSyxNQUFsQztBQUNEO0FBQ0YsS0FoQ0QsTUFnQ087QUFDTDtBQUNBUyxRQUFFLEdBQUd2SCxNQUFNLENBQUN1SCxFQUFQLEVBQUw7QUFDQXJHLFVBQUksQ0FBQ21ELGNBQUwsQ0FBb0JrRCxFQUFwQixJQUEwQjtBQUN4QkEsVUFBRSxFQUFFQSxFQURvQjtBQUV4QmhDLFlBQUksRUFBRUEsSUFGa0I7QUFHeEJlLGNBQU0sRUFBRXZHLEtBQUssQ0FBQzZILEtBQU4sQ0FBWXRCLE1BQVosQ0FIZ0I7QUFJeEJlLGdCQUFRLEVBQUUsS0FKYztBQUt4QkcsYUFBSyxFQUFFLEtBTGlCO0FBTXhCSyxpQkFBUyxFQUFFLElBQUkvSCxPQUFPLENBQUMwRSxVQUFaLEVBTmE7QUFPeEJpRCxxQkFBYSxFQUFFaEIsU0FBUyxDQUFDRSxPQVBEO0FBUXhCO0FBQ0FlLHFCQUFhLEVBQUVqQixTQUFTLENBQUNJLE9BVEQ7QUFVeEJjLG9CQUFZLEVBQUVsQixTQUFTLENBQUNLLE1BVkE7QUFXeEIzSSxrQkFBVSxFQUFFK0MsSUFYWTs7QUFZeEI0RyxjQUFNLEdBQUc7QUFDUCxpQkFBTyxLQUFLM0osVUFBTCxDQUFnQmtHLGNBQWhCLENBQStCLEtBQUtrRCxFQUFwQyxDQUFQO0FBQ0EsZUFBS0MsS0FBTCxJQUFjLEtBQUtLLFNBQUwsQ0FBZUUsT0FBZixFQUFkO0FBQ0QsU0FmdUI7O0FBZ0J4QjlDLFlBQUksR0FBRztBQUNMLGVBQUs5RyxVQUFMLENBQWdCZSxLQUFoQixDQUFzQjtBQUFFZ0gsZUFBRyxFQUFFLE9BQVA7QUFBZ0JxQixjQUFFLEVBQUVBO0FBQXBCLFdBQXRCOztBQUNBLGVBQUtPLE1BQUw7O0FBRUEsY0FBSXJCLFNBQVMsQ0FBQ0ssTUFBZCxFQUFzQjtBQUNwQkwscUJBQVMsQ0FBQ0ssTUFBVjtBQUNEO0FBQ0Y7O0FBdkJ1QixPQUExQjs7QUF5QkE1RixVQUFJLENBQUNoQyxLQUFMLENBQVc7QUFBRWdILFdBQUcsRUFBRSxLQUFQO0FBQWNxQixVQUFFLEVBQUVBLEVBQWxCO0FBQXNCaEMsWUFBSSxFQUFFQSxJQUE1QjtBQUFrQ2UsY0FBTSxFQUFFQTtBQUExQyxPQUFYO0FBQ0QsS0F4RzBELENBMEczRDs7O0FBQ0EsVUFBTTBCLE1BQU0sR0FBRztBQUNiL0MsVUFBSSxHQUFHO0FBQ0wsWUFBSSxDQUFFOUUsTUFBTSxDQUFDb0csSUFBUCxDQUFZckYsSUFBSSxDQUFDbUQsY0FBakIsRUFBaUNrRCxFQUFqQyxDQUFOLEVBQTRDO0FBQzFDO0FBQ0Q7O0FBQ0RyRyxZQUFJLENBQUNtRCxjQUFMLENBQW9Ca0QsRUFBcEIsRUFBd0J0QyxJQUF4QjtBQUNELE9BTlk7O0FBT2J1QyxXQUFLLEdBQUc7QUFDTjtBQUNBLFlBQUksQ0FBQ3JILE1BQU0sQ0FBQ29HLElBQVAsQ0FBWXJGLElBQUksQ0FBQ21ELGNBQWpCLEVBQWlDa0QsRUFBakMsQ0FBTCxFQUEyQztBQUN6QyxpQkFBTyxLQUFQO0FBQ0Q7O0FBQ0QsY0FBTVUsTUFBTSxHQUFHL0csSUFBSSxDQUFDbUQsY0FBTCxDQUFvQmtELEVBQXBCLENBQWY7QUFDQVUsY0FBTSxDQUFDSixTQUFQLENBQWlCSyxNQUFqQjtBQUNBLGVBQU9ELE1BQU0sQ0FBQ1QsS0FBZDtBQUNELE9BZlk7O0FBZ0JiVyxvQkFBYyxFQUFFWjtBQWhCSCxLQUFmOztBQW1CQSxRQUFJekgsT0FBTyxDQUFDc0ksTUFBWixFQUFvQjtBQUNsQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQXRJLGFBQU8sQ0FBQ3VJLFlBQVIsQ0FBc0JDLENBQUQsSUFBTztBQUMxQixZQUFJbkksTUFBTSxDQUFDb0csSUFBUCxDQUFZckYsSUFBSSxDQUFDbUQsY0FBakIsRUFBaUNrRCxFQUFqQyxDQUFKLEVBQTBDO0FBQ3hDckcsY0FBSSxDQUFDbUQsY0FBTCxDQUFvQmtELEVBQXBCLEVBQXdCRixRQUF4QixHQUFtQyxJQUFuQztBQUNEOztBQUVEdkgsZUFBTyxDQUFDeUksVUFBUixDQUFtQixNQUFNO0FBQ3ZCLGNBQUlwSSxNQUFNLENBQUNvRyxJQUFQLENBQVlyRixJQUFJLENBQUNtRCxjQUFqQixFQUFpQ2tELEVBQWpDLEtBQ0FyRyxJQUFJLENBQUNtRCxjQUFMLENBQW9Ca0QsRUFBcEIsRUFBd0JGLFFBRDVCLEVBQ3NDO0FBQ3BDVyxrQkFBTSxDQUFDL0MsSUFBUDtBQUNEO0FBQ0YsU0FMRDtBQU1ELE9BWEQ7QUFZRDs7QUFFRCxXQUFPK0MsTUFBUDtBQUNELEdBNWJxQixDQThidEI7QUFDQTtBQUNBOzs7QUFDQVEsbUJBQWlCLENBQUNqRCxJQUFELEVBQU9rRCxJQUFQLEVBQWE1SyxPQUFiLEVBQXNCO0FBQ3JDLFVBQU1xRCxJQUFJLEdBQUcsSUFBYjtBQUNBLFVBQU04RixDQUFDLEdBQUcsSUFBSXZHLE1BQUosRUFBVjtBQUNBLFFBQUkrRyxLQUFLLEdBQUcsS0FBWjtBQUNBaUIsUUFBSSxHQUFHQSxJQUFJLElBQUksRUFBZjtBQUNBQSxRQUFJLENBQUNDLElBQUwsQ0FBVTtBQUNSL0IsYUFBTyxHQUFHO0FBQ1JhLGFBQUssR0FBRyxJQUFSO0FBQ0FSLFNBQUMsQ0FBQyxRQUFELENBQUQ7QUFDRCxPQUpPOztBQUtSSCxhQUFPLENBQUM4QixDQUFELEVBQUk7QUFDVCxZQUFJLENBQUNuQixLQUFMLEVBQVlSLENBQUMsQ0FBQyxPQUFELENBQUQsQ0FBVzJCLENBQVgsRUFBWixLQUNLOUssT0FBTyxJQUFJQSxPQUFPLENBQUMrSyxXQUFuQixJQUFrQy9LLE9BQU8sQ0FBQytLLFdBQVIsQ0FBb0JELENBQXBCLENBQWxDO0FBQ047O0FBUk8sS0FBVjtBQVdBLFVBQU1YLE1BQU0sR0FBRzlHLElBQUksQ0FBQ21GLFNBQUwsQ0FBZXdDLEtBQWYsQ0FBcUIzSCxJQUFyQixFQUEyQixDQUFDcUUsSUFBRCxFQUFPdUQsTUFBUCxDQUFjTCxJQUFkLENBQTNCLENBQWY7QUFDQXpCLEtBQUMsQ0FBQ3ZJLElBQUY7QUFDQSxXQUFPdUosTUFBUDtBQUNEOztBQUVEZSxTQUFPLENBQUNBLE9BQUQsRUFBVTtBQUNmckgsVUFBTSxDQUFDc0gsT0FBUCxDQUFlRCxPQUFmLEVBQXdCcEQsT0FBeEIsQ0FBZ0MsVUFBa0I7QUFBQSxVQUFqQixDQUFDSixJQUFELEVBQU8wRCxJQUFQLENBQWlCOztBQUNoRCxVQUFJLE9BQU9BLElBQVAsS0FBZ0IsVUFBcEIsRUFBZ0M7QUFDOUIsY0FBTSxJQUFJakssS0FBSixDQUFVLGFBQWF1RyxJQUFiLEdBQW9CLHNCQUE5QixDQUFOO0FBQ0Q7O0FBQ0QsVUFBSSxLQUFLeEMsZUFBTCxDQUFxQndDLElBQXJCLENBQUosRUFBZ0M7QUFDOUIsY0FBTSxJQUFJdkcsS0FBSixDQUFVLHFCQUFxQnVHLElBQXJCLEdBQTRCLHNCQUF0QyxDQUFOO0FBQ0Q7O0FBQ0QsV0FBS3hDLGVBQUwsQ0FBcUJ3QyxJQUFyQixJQUE2QjBELElBQTdCO0FBQ0QsS0FSRDtBQVNEO0FBRUQ7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQUNFMUMsTUFBSSxDQUFDaEI7QUFBSztBQUFOLElBQXdDO0FBQzFDO0FBQ0E7QUFDQSxVQUFNa0QsSUFBSSxHQUFHckksS0FBSyxDQUFDbUcsSUFBTixDQUFXQyxTQUFYLEVBQXNCLENBQXRCLENBQWI7QUFDQSxRQUFJdkksUUFBSjs7QUFDQSxRQUFJd0ssSUFBSSxDQUFDeEMsTUFBTCxJQUFlLE9BQU93QyxJQUFJLENBQUNBLElBQUksQ0FBQ3hDLE1BQUwsR0FBYyxDQUFmLENBQVgsS0FBaUMsVUFBcEQsRUFBZ0U7QUFDOURoSSxjQUFRLEdBQUd3SyxJQUFJLENBQUM3QixHQUFMLEVBQVg7QUFDRDs7QUFDRCxXQUFPLEtBQUtpQyxLQUFMLENBQVd0RCxJQUFYLEVBQWlCa0QsSUFBakIsRUFBdUJ4SyxRQUF2QixDQUFQO0FBQ0Q7QUFFRDtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FBQ0U0SyxPQUFLLENBQUN0RCxJQUFELEVBQU9rRCxJQUFQLEVBQWE1SyxPQUFiLEVBQXNCSSxRQUF0QixFQUFnQztBQUNuQyxVQUFNaUQsSUFBSSxHQUFHLElBQWIsQ0FEbUMsQ0FHbkM7QUFDQTs7QUFDQSxRQUFJLENBQUNqRCxRQUFELElBQWEsT0FBT0osT0FBUCxLQUFtQixVQUFwQyxFQUFnRDtBQUM5Q0ksY0FBUSxHQUFHSixPQUFYO0FBQ0FBLGFBQU8sR0FBRzZELE1BQU0sQ0FBQ0MsTUFBUCxDQUFjLElBQWQsQ0FBVjtBQUNEOztBQUNEOUQsV0FBTyxHQUFHQSxPQUFPLElBQUk2RCxNQUFNLENBQUNDLE1BQVAsQ0FBYyxJQUFkLENBQXJCOztBQUVBLFFBQUkxRCxRQUFKLEVBQWM7QUFDWjtBQUNBO0FBQ0E7QUFDQUEsY0FBUSxHQUFHMkIsTUFBTSxDQUFDa0UsZUFBUCxDQUNUN0YsUUFEUyxFQUVULG9DQUFvQ3NILElBQXBDLEdBQTJDLEdBRmxDLENBQVg7QUFJRCxLQW5Ca0MsQ0FxQm5DO0FBQ0E7OztBQUNBa0QsUUFBSSxHQUFHMUksS0FBSyxDQUFDNkgsS0FBTixDQUFZYSxJQUFaLENBQVA7O0FBRUEsVUFBTVMsU0FBUyxHQUFHMUwsR0FBRyxDQUFDMkwsd0JBQUosQ0FBNkJDLEdBQTdCLEVBQWxCOztBQUNBLFVBQU1DLG1CQUFtQixHQUFHSCxTQUFTLElBQUlBLFNBQVMsQ0FBQ0ksWUFBbkQsQ0ExQm1DLENBNEJuQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFDQSxRQUFJQyxVQUFVLEdBQUcsSUFBakI7O0FBQ0EsVUFBTUMsbUJBQW1CLEdBQUcsTUFBTTtBQUNoQyxVQUFJRCxVQUFVLEtBQUssSUFBbkIsRUFBeUI7QUFDdkJBLGtCQUFVLEdBQUcxSixTQUFTLENBQUM0SixXQUFWLENBQXNCUCxTQUF0QixFQUFpQzNELElBQWpDLENBQWI7QUFDRDs7QUFDRCxhQUFPZ0UsVUFBUDtBQUNELEtBTEQsQ0F2Q21DLENBOENuQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUFFQSxRQUFJRyxlQUFKO0FBQ0EsUUFBSUMsU0FBSjtBQUNBLFVBQU1DLElBQUksR0FBRzFJLElBQUksQ0FBQzZCLGVBQUwsQ0FBcUJ3QyxJQUFyQixDQUFiOztBQUNBLFFBQUlxRSxJQUFKLEVBQVU7QUFDUixZQUFNQyxTQUFTLEdBQUdDLE1BQU0sSUFBSTtBQUMxQjVJLFlBQUksQ0FBQzJJLFNBQUwsQ0FBZUMsTUFBZjtBQUNELE9BRkQ7O0FBSUEsWUFBTUMsVUFBVSxHQUFHLElBQUlsSyxTQUFTLENBQUNtSyxnQkFBZCxDQUErQjtBQUNoRFYsb0JBQVksRUFBRSxJQURrQztBQUVoRFEsY0FBTSxFQUFFNUksSUFBSSxDQUFDNEksTUFBTCxFQUZ3QztBQUdoREQsaUJBQVMsRUFBRUEsU0FIcUM7O0FBSWhETixrQkFBVSxHQUFHO0FBQ1gsaUJBQU9DLG1CQUFtQixFQUExQjtBQUNEOztBQU4rQyxPQUEvQixDQUFuQjtBQVNBLFVBQUksQ0FBQ0gsbUJBQUwsRUFBMEJuSSxJQUFJLENBQUMrSSxjQUFMOztBQUUxQixVQUFJO0FBQ0Y7QUFDQTtBQUNBUCx1QkFBZSxHQUFHbE0sR0FBRyxDQUFDMkwsd0JBQUosQ0FBNkJlLFNBQTdCLENBQ2hCSCxVQURnQixFQUVoQixNQUFNO0FBQ0osY0FBSW5LLE1BQU0sQ0FBQ2MsUUFBWCxFQUFxQjtBQUNuQjtBQUNBO0FBQ0EsbUJBQU9kLE1BQU0sQ0FBQ3VLLGdCQUFQLENBQXdCLE1BQU07QUFDbkM7QUFDQSxxQkFBT1AsSUFBSSxDQUFDZixLQUFMLENBQVdrQixVQUFYLEVBQXVCaEssS0FBSyxDQUFDNkgsS0FBTixDQUFZYSxJQUFaLENBQXZCLENBQVA7QUFDRCxhQUhNLENBQVA7QUFJRCxXQVBELE1BT087QUFDTCxtQkFBT21CLElBQUksQ0FBQ2YsS0FBTCxDQUFXa0IsVUFBWCxFQUF1QmhLLEtBQUssQ0FBQzZILEtBQU4sQ0FBWWEsSUFBWixDQUF2QixDQUFQO0FBQ0Q7QUFDRixTQWJlLENBQWxCO0FBZUQsT0FsQkQsQ0FrQkUsT0FBT0UsQ0FBUCxFQUFVO0FBQ1ZnQixpQkFBUyxHQUFHaEIsQ0FBWjtBQUNEO0FBQ0YsS0FsR2tDLENBb0duQztBQUNBO0FBQ0E7OztBQUNBLFFBQUlVLG1CQUFKLEVBQXlCO0FBQ3ZCLFVBQUlwTCxRQUFKLEVBQWM7QUFDWkEsZ0JBQVEsQ0FBQzBMLFNBQUQsRUFBWUQsZUFBWixDQUFSO0FBQ0EsZUFBT1UsU0FBUDtBQUNEOztBQUNELFVBQUlULFNBQUosRUFBZSxNQUFNQSxTQUFOO0FBQ2YsYUFBT0QsZUFBUDtBQUNELEtBOUdrQyxDQWdIbkM7QUFDQTs7O0FBQ0EsVUFBTTVMLFFBQVEsR0FBRyxLQUFLb0QsSUFBSSxDQUFDOEIsYUFBTCxFQUF0Qjs7QUFDQSxRQUFJNEcsSUFBSixFQUFVO0FBQ1IxSSxVQUFJLENBQUNtSiwwQkFBTCxDQUFnQ3ZNLFFBQWhDO0FBQ0QsS0FySGtDLENBdUhuQztBQUNBO0FBQ0E7QUFDQTs7O0FBQ0EsVUFBTU8sT0FBTyxHQUFHO0FBQ2Q2SCxTQUFHLEVBQUUsUUFEUztBQUVkTixZQUFNLEVBQUVMLElBRk07QUFHZGUsWUFBTSxFQUFFbUMsSUFITTtBQUlkbEIsUUFBRSxFQUFFeko7QUFKVSxLQUFoQixDQTNIbUMsQ0FrSW5DO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUNBLFFBQUk2TCxTQUFKLEVBQWU7QUFDYixVQUFJOUwsT0FBTyxDQUFDeU0sbUJBQVosRUFBaUM7QUFDL0IsY0FBTVgsU0FBTjtBQUNELE9BRkQsTUFFTyxJQUFJLENBQUNBLFNBQVMsQ0FBQ1ksZUFBZixFQUFnQztBQUNyQzNLLGNBQU0sQ0FBQzBCLE1BQVAsQ0FDRSx3REFBd0RpRSxJQUF4RCxHQUErRCxHQURqRSxFQUVFb0UsU0FGRjtBQUlEO0FBQ0YsS0FsSmtDLENBb0puQztBQUNBO0FBRUE7OztBQUNBLFFBQUlhLE1BQUo7O0FBQ0EsUUFBSSxDQUFDdk0sUUFBTCxFQUFlO0FBQ2IsVUFBSTJCLE1BQU0sQ0FBQzZFLFFBQVgsRUFBcUI7QUFDbkI7QUFDQTtBQUNBO0FBQ0E7QUFDQXhHLGdCQUFRLEdBQUdxQixHQUFHLElBQUk7QUFDaEJBLGFBQUcsSUFBSU0sTUFBTSxDQUFDMEIsTUFBUCxDQUFjLDRCQUE0QmlFLElBQTVCLEdBQW1DLEdBQWpELEVBQXNEakcsR0FBdEQsQ0FBUDtBQUNELFNBRkQ7QUFHRCxPQVJELE1BUU87QUFDTDtBQUNBO0FBQ0FrTCxjQUFNLEdBQUcsSUFBSS9KLE1BQUosRUFBVDtBQUNBeEMsZ0JBQVEsR0FBR3VNLE1BQU0sQ0FBQ0MsUUFBUCxFQUFYO0FBQ0Q7QUFDRixLQXhLa0MsQ0EwS25DOzs7QUFDQSxRQUFJbEIsVUFBVSxLQUFLLElBQW5CLEVBQXlCO0FBQ3ZCbEwsYUFBTyxDQUFDa0wsVUFBUixHQUFxQkEsVUFBckI7QUFDRDs7QUFFRCxVQUFNbUIsYUFBYSxHQUFHLElBQUkvTSxhQUFKLENBQWtCO0FBQ3RDRyxjQURzQztBQUV0Q0csY0FBUSxFQUFFQSxRQUY0QjtBQUd0Q0UsZ0JBQVUsRUFBRStDLElBSDBCO0FBSXRDM0Msc0JBQWdCLEVBQUVWLE9BQU8sQ0FBQ1UsZ0JBSlk7QUFLdENFLFVBQUksRUFBRSxDQUFDLENBQUNaLE9BQU8sQ0FBQ1ksSUFMc0I7QUFNdENKLGFBQU8sRUFBRUEsT0FONkI7QUFPdENLLGFBQU8sRUFBRSxDQUFDLENBQUNiLE9BQU8sQ0FBQ2E7QUFQbUIsS0FBbEIsQ0FBdEI7O0FBVUEsUUFBSWIsT0FBTyxDQUFDWSxJQUFaLEVBQWtCO0FBQ2hCO0FBQ0F5QyxVQUFJLENBQUNrQyx3QkFBTCxDQUE4QnNGLElBQTlCLENBQW1DO0FBQ2pDakssWUFBSSxFQUFFLElBRDJCO0FBRWpDc0ssZUFBTyxFQUFFLENBQUMyQixhQUFEO0FBRndCLE9BQW5DO0FBSUQsS0FORCxNQU1PO0FBQ0w7QUFDQTtBQUNBLFVBQUlwSyxPQUFPLENBQUNZLElBQUksQ0FBQ2tDLHdCQUFOLENBQVAsSUFDQTdDLElBQUksQ0FBQ1csSUFBSSxDQUFDa0Msd0JBQU4sQ0FBSixDQUFvQzNFLElBRHhDLEVBQzhDO0FBQzVDeUMsWUFBSSxDQUFDa0Msd0JBQUwsQ0FBOEJzRixJQUE5QixDQUFtQztBQUNqQ2pLLGNBQUksRUFBRSxLQUQyQjtBQUVqQ3NLLGlCQUFPLEVBQUU7QUFGd0IsU0FBbkM7QUFJRDs7QUFFRHhJLFVBQUksQ0FBQ1csSUFBSSxDQUFDa0Msd0JBQU4sQ0FBSixDQUFvQzJGLE9BQXBDLENBQTRDTCxJQUE1QyxDQUFpRGdDLGFBQWpEO0FBQ0QsS0EzTWtDLENBNk1uQzs7O0FBQ0EsUUFBSXhKLElBQUksQ0FBQ2tDLHdCQUFMLENBQThCNkMsTUFBOUIsS0FBeUMsQ0FBN0MsRUFBZ0R5RSxhQUFhLENBQUM1TCxXQUFkLEdBOU1iLENBZ05uQztBQUNBOztBQUNBLFFBQUkwTCxNQUFKLEVBQVk7QUFDVixhQUFPQSxNQUFNLENBQUMvTCxJQUFQLEVBQVA7QUFDRDs7QUFDRCxXQUFPWixPQUFPLENBQUM4TSxlQUFSLEdBQTBCakIsZUFBMUIsR0FBNENVLFNBQW5EO0FBQ0QsR0E3dEJxQixDQSt0QnRCO0FBQ0E7QUFDQTs7O0FBQ0FILGdCQUFjLEdBQUc7QUFDZixRQUFJLENBQUUsS0FBS1cscUJBQUwsRUFBTixFQUFvQztBQUNsQyxXQUFLN0csb0JBQUw7QUFDRDs7QUFFRHJDLFVBQU0sQ0FBQ3dGLE1BQVAsQ0FBYyxLQUFLcEUsT0FBbkIsRUFBNEI2QyxPQUE1QixDQUFxQ0YsS0FBRCxJQUFXO0FBQzdDQSxXQUFLLENBQUNvRixhQUFOO0FBQ0QsS0FGRDtBQUdELEdBMXVCcUIsQ0E0dUJ0QjtBQUNBO0FBQ0E7OztBQUNBUiw0QkFBMEIsQ0FBQ3ZNLFFBQUQsRUFBVztBQUNuQyxVQUFNb0QsSUFBSSxHQUFHLElBQWI7QUFDQSxRQUFJQSxJQUFJLENBQUNtQyx1QkFBTCxDQUE2QnZGLFFBQTdCLENBQUosRUFDRSxNQUFNLElBQUlrQixLQUFKLENBQVUsa0RBQVYsQ0FBTjtBQUVGLFVBQU04TCxXQUFXLEdBQUcsRUFBcEI7QUFFQXBKLFVBQU0sQ0FBQ3NILE9BQVAsQ0FBZTlILElBQUksQ0FBQzRCLE9BQXBCLEVBQTZCNkMsT0FBN0IsQ0FBcUMsV0FBeUI7QUFBQSxVQUF4QixDQUFDb0YsVUFBRCxFQUFhdEYsS0FBYixDQUF3QjtBQUM1RCxZQUFNdUYsU0FBUyxHQUFHdkYsS0FBSyxDQUFDd0YsaUJBQU4sRUFBbEIsQ0FENEQsQ0FFNUQ7O0FBQ0EsVUFBSSxDQUFFRCxTQUFOLEVBQWlCO0FBQ2pCQSxlQUFTLENBQUNyRixPQUFWLENBQWtCLENBQUN1RixHQUFELEVBQU0zRCxFQUFOLEtBQWE7QUFDN0J1RCxtQkFBVyxDQUFDcEMsSUFBWixDQUFpQjtBQUFFcUMsb0JBQUY7QUFBY3hEO0FBQWQsU0FBakI7O0FBQ0EsWUFBSSxDQUFFcEgsTUFBTSxDQUFDb0csSUFBUCxDQUFZckYsSUFBSSxDQUFDb0MsZ0JBQWpCLEVBQW1DeUgsVUFBbkMsQ0FBTixFQUFzRDtBQUNwRDdKLGNBQUksQ0FBQ29DLGdCQUFMLENBQXNCeUgsVUFBdEIsSUFBb0MsSUFBSWxLLFVBQUosRUFBcEM7QUFDRDs7QUFDRCxjQUFNc0ssU0FBUyxHQUFHakssSUFBSSxDQUFDb0MsZ0JBQUwsQ0FBc0J5SCxVQUF0QixFQUFrQ0ssVUFBbEMsQ0FDaEI3RCxFQURnQixFQUVoQjdGLE1BQU0sQ0FBQ0MsTUFBUCxDQUFjLElBQWQsQ0FGZ0IsQ0FBbEI7O0FBSUEsWUFBSXdKLFNBQVMsQ0FBQ0UsY0FBZCxFQUE4QjtBQUM1QjtBQUNBO0FBQ0FGLG1CQUFTLENBQUNFLGNBQVYsQ0FBeUJ2TixRQUF6QixJQUFxQyxJQUFyQztBQUNELFNBSkQsTUFJTztBQUNMO0FBQ0FxTixtQkFBUyxDQUFDRyxRQUFWLEdBQXFCSixHQUFyQjtBQUNBQyxtQkFBUyxDQUFDSSxjQUFWLEdBQTJCLEVBQTNCO0FBQ0FKLG1CQUFTLENBQUNFLGNBQVYsR0FBMkIzSixNQUFNLENBQUNDLE1BQVAsQ0FBYyxJQUFkLENBQTNCO0FBQ0F3SixtQkFBUyxDQUFDRSxjQUFWLENBQXlCdk4sUUFBekIsSUFBcUMsSUFBckM7QUFDRDtBQUNGLE9BcEJEO0FBcUJELEtBekJEOztBQTBCQSxRQUFJLENBQUV3QyxPQUFPLENBQUN3SyxXQUFELENBQWIsRUFBNEI7QUFDMUI1SixVQUFJLENBQUNtQyx1QkFBTCxDQUE2QnZGLFFBQTdCLElBQXlDZ04sV0FBekM7QUFDRDtBQUNGLEdBbnhCcUIsQ0FxeEJ0QjtBQUNBOzs7QUFDQVUsaUJBQWUsR0FBRztBQUNoQjlKLFVBQU0sQ0FBQ3dGLE1BQVAsQ0FBYyxLQUFLN0MsY0FBbkIsRUFBbUNzQixPQUFuQyxDQUE0Q3lCLEdBQUQsSUFBUztBQUNsRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxVQUFJQSxHQUFHLENBQUM3QixJQUFKLEtBQWEsa0NBQWpCLEVBQXFEO0FBQ25ENkIsV0FBRyxDQUFDbkMsSUFBSjtBQUNEO0FBQ0YsS0FWRDtBQVdELEdBbnlCcUIsQ0FxeUJ0Qjs7O0FBQ0EvRixPQUFLLENBQUN1TSxHQUFELEVBQU07QUFDVCxTQUFLckosT0FBTCxDQUFhc0osSUFBYixDQUFrQjdMLFNBQVMsQ0FBQzhMLFlBQVYsQ0FBdUJGLEdBQXZCLENBQWxCO0FBQ0QsR0F4eUJxQixDQTB5QnRCO0FBQ0E7QUFDQTs7O0FBQ0FHLGlCQUFlLENBQUNDLEtBQUQsRUFBUTtBQUNyQixTQUFLekosT0FBTCxDQUFhd0osZUFBYixDQUE2QkMsS0FBN0I7QUFDRDtBQUVEO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUFDRUMsUUFBTSxHQUFVO0FBQ2QsV0FBTyxLQUFLMUosT0FBTCxDQUFhMEosTUFBYixDQUFvQixZQUFwQixDQUFQO0FBQ0Q7QUFFRDtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUFFRUMsV0FBUyxHQUFVO0FBQ2pCLFdBQU8sS0FBSzNKLE9BQUwsQ0FBYTJKLFNBQWIsQ0FBdUIsWUFBdkIsQ0FBUDtBQUNEO0FBRUQ7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQUNFQyxZQUFVLEdBQVU7QUFDbEIsV0FBTyxLQUFLNUosT0FBTCxDQUFhNEosVUFBYixDQUF3QixZQUF4QixDQUFQO0FBQ0Q7O0FBRURDLE9BQUssR0FBRztBQUNOLFdBQU8sS0FBSzdKLE9BQUwsQ0FBYTRKLFVBQWIsQ0FBd0I7QUFBRUUsZ0JBQVUsRUFBRTtBQUFkLEtBQXhCLENBQVA7QUFDRCxHQXQxQnFCLENBdzFCdEI7QUFDQTtBQUNBOzs7QUFDQXBDLFFBQU0sR0FBRztBQUNQLFFBQUksS0FBS3ZGLFdBQVQsRUFBc0IsS0FBS0EsV0FBTCxDQUFpQjJELE1BQWpCO0FBQ3RCLFdBQU8sS0FBSzVELE9BQVo7QUFDRDs7QUFFRHVGLFdBQVMsQ0FBQ0MsTUFBRCxFQUFTO0FBQ2hCO0FBQ0EsUUFBSSxLQUFLeEYsT0FBTCxLQUFpQndGLE1BQXJCLEVBQTZCO0FBQzdCLFNBQUt4RixPQUFMLEdBQWV3RixNQUFmO0FBQ0EsUUFBSSxLQUFLdkYsV0FBVCxFQUFzQixLQUFLQSxXQUFMLENBQWlCd0QsT0FBakI7QUFDdkIsR0FyMkJxQixDQXUyQnRCO0FBQ0E7QUFDQTs7O0FBQ0E2Qyx1QkFBcUIsR0FBRztBQUN0QixXQUNFLENBQUV0SyxPQUFPLENBQUMsS0FBS21ELGlCQUFOLENBQVQsSUFDQSxDQUFFbkQsT0FBTyxDQUFDLEtBQUtyQiwwQkFBTixDQUZYO0FBSUQsR0EvMkJxQixDQWkzQnRCO0FBQ0E7OztBQUNBa04sMkJBQXlCLEdBQUc7QUFDMUIsVUFBTUMsUUFBUSxHQUFHLEtBQUt2TixlQUF0QjtBQUNBLFdBQU82QyxNQUFNLENBQUN3RixNQUFQLENBQWNrRixRQUFkLEVBQXdCckYsSUFBeEIsQ0FBOEJzRixPQUFELElBQWEsQ0FBQyxDQUFDQSxPQUFPLENBQUN0TyxXQUFwRCxDQUFQO0FBQ0Q7O0FBRUR1TyxxQkFBbUIsQ0FBQ3BHLEdBQUQsRUFBTTtBQUN2QixVQUFNaEYsSUFBSSxHQUFHLElBQWI7O0FBRUEsUUFBSUEsSUFBSSxDQUFDMkIsUUFBTCxLQUFrQixNQUFsQixJQUE0QjNCLElBQUksQ0FBQ2dDLGtCQUFMLEtBQTRCLENBQTVELEVBQStEO0FBQzdEaEMsVUFBSSxDQUFDOEQsVUFBTCxHQUFrQixJQUFJbkYsU0FBUyxDQUFDME0sU0FBZCxDQUF3QjtBQUN4Q2hMLHlCQUFpQixFQUFFTCxJQUFJLENBQUNnQyxrQkFEZ0I7QUFFeEMxQix3QkFBZ0IsRUFBRU4sSUFBSSxDQUFDaUMsaUJBRmlCOztBQUd4Q3FKLGlCQUFTLEdBQUc7QUFDVnRMLGNBQUksQ0FBQzBLLGVBQUwsQ0FDRSxJQUFJcE8sR0FBRyxDQUFDOEUsZUFBUixDQUF3Qix5QkFBeEIsQ0FERjtBQUdELFNBUHVDOztBQVF4Q21LLGdCQUFRLEdBQUc7QUFDVHZMLGNBQUksQ0FBQ2hDLEtBQUwsQ0FBVztBQUFFZ0gsZUFBRyxFQUFFO0FBQVAsV0FBWDtBQUNEOztBQVZ1QyxPQUF4QixDQUFsQjs7QUFZQWhGLFVBQUksQ0FBQzhELFVBQUwsQ0FBZ0IwSCxLQUFoQjtBQUNELEtBakJzQixDQW1CdkI7OztBQUNBLFFBQUl4TCxJQUFJLENBQUN5QixjQUFULEVBQXlCekIsSUFBSSxDQUFDd0MsWUFBTCxHQUFvQixJQUFwQjtBQUV6QixRQUFJaUosNEJBQUo7O0FBQ0EsUUFBSSxPQUFPekcsR0FBRyxDQUFDMEcsT0FBWCxLQUF1QixRQUEzQixFQUFxQztBQUNuQ0Qsa0NBQTRCLEdBQUd6TCxJQUFJLENBQUN5QixjQUFMLEtBQXdCdUQsR0FBRyxDQUFDMEcsT0FBM0Q7QUFDQTFMLFVBQUksQ0FBQ3lCLGNBQUwsR0FBc0J1RCxHQUFHLENBQUMwRyxPQUExQjtBQUNEOztBQUVELFFBQUlELDRCQUFKLEVBQWtDO0FBQ2hDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNELEtBbkNzQixDQXFDdkI7QUFFQTtBQUNBOzs7QUFDQXpMLFFBQUksQ0FBQ3lDLHdCQUFMLEdBQWdDakMsTUFBTSxDQUFDQyxNQUFQLENBQWMsSUFBZCxDQUFoQzs7QUFFQSxRQUFJVCxJQUFJLENBQUN3QyxZQUFULEVBQXVCO0FBQ3JCO0FBQ0E7QUFDQXhDLFVBQUksQ0FBQ21DLHVCQUFMLEdBQStCM0IsTUFBTSxDQUFDQyxNQUFQLENBQWMsSUFBZCxDQUEvQjtBQUNBVCxVQUFJLENBQUNvQyxnQkFBTCxHQUF3QjVCLE1BQU0sQ0FBQ0MsTUFBUCxDQUFjLElBQWQsQ0FBeEI7QUFDRCxLQWhEc0IsQ0FrRHZCOzs7QUFDQVQsUUFBSSxDQUFDcUMscUJBQUwsR0FBNkIsRUFBN0IsQ0FuRHVCLENBcUR2QjtBQUNBO0FBQ0E7QUFDQTs7QUFDQXJDLFFBQUksQ0FBQ3VDLGlCQUFMLEdBQXlCL0IsTUFBTSxDQUFDQyxNQUFQLENBQWMsSUFBZCxDQUF6QjtBQUNBRCxVQUFNLENBQUNzSCxPQUFQLENBQWU5SCxJQUFJLENBQUNtRCxjQUFwQixFQUFvQ3NCLE9BQXBDLENBQTRDLFdBQWU7QUFBQSxVQUFkLENBQUM0QixFQUFELEVBQUtILEdBQUwsQ0FBYzs7QUFDekQsVUFBSUEsR0FBRyxDQUFDSSxLQUFSLEVBQWU7QUFDYnRHLFlBQUksQ0FBQ3VDLGlCQUFMLENBQXVCOEQsRUFBdkIsSUFBNkIsSUFBN0I7QUFDRDtBQUNGLEtBSkQsRUExRHVCLENBZ0V2QjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFDQXJHLFFBQUksQ0FBQ2pDLDBCQUFMLEdBQWtDeUMsTUFBTSxDQUFDQyxNQUFQLENBQWMsSUFBZCxDQUFsQzs7QUFDQSxRQUFJVCxJQUFJLENBQUN3QyxZQUFULEVBQXVCO0FBQ3JCLFlBQU0wSSxRQUFRLEdBQUdsTCxJQUFJLENBQUNyQyxlQUF0QjtBQUNBd0IsVUFBSSxDQUFDK0wsUUFBRCxDQUFKLENBQWV6RyxPQUFmLENBQXVCNEIsRUFBRSxJQUFJO0FBQzNCLGNBQU04RSxPQUFPLEdBQUdELFFBQVEsQ0FBQzdFLEVBQUQsQ0FBeEI7O0FBQ0EsWUFBSThFLE9BQU8sQ0FBQ3ROLFNBQVIsRUFBSixFQUF5QjtBQUN2QjtBQUNBO0FBQ0E7QUFDQTtBQUNBbUMsY0FBSSxDQUFDcUMscUJBQUwsQ0FBMkJtRixJQUEzQixDQUNFO0FBQUEsbUJBQWEyRCxPQUFPLENBQUM3TSxXQUFSLENBQW9CLFlBQXBCLENBQWI7QUFBQSxXQURGO0FBR0QsU0FSRCxNQVFPLElBQUk2TSxPQUFPLENBQUN0TyxXQUFaLEVBQXlCO0FBQzlCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBbUQsY0FBSSxDQUFDakMsMEJBQUwsQ0FBZ0NvTixPQUFPLENBQUN2TyxRQUF4QyxJQUFvRCxJQUFwRDtBQUNEO0FBQ0YsT0F0QkQ7QUF1QkQ7O0FBRURvRCxRQUFJLENBQUNzQyxnQ0FBTCxHQUF3QyxFQUF4QyxDQW5HdUIsQ0FxR3ZCO0FBQ0E7O0FBQ0EsUUFBSSxDQUFFdEMsSUFBSSxDQUFDMEoscUJBQUwsRUFBTixFQUFvQztBQUNsQyxVQUFJMUosSUFBSSxDQUFDd0MsWUFBVCxFQUF1QjtBQUNyQmhDLGNBQU0sQ0FBQ3dGLE1BQVAsQ0FBY2hHLElBQUksQ0FBQzRCLE9BQW5CLEVBQTRCNkMsT0FBNUIsQ0FBcUNGLEtBQUQsSUFBVztBQUM3Q0EsZUFBSyxDQUFDTyxXQUFOLENBQWtCLENBQWxCLEVBQXFCLElBQXJCO0FBQ0FQLGVBQUssQ0FBQ1csU0FBTjtBQUNELFNBSEQ7QUFJQWxGLFlBQUksQ0FBQ3dDLFlBQUwsR0FBb0IsS0FBcEI7QUFDRDs7QUFDRHhDLFVBQUksQ0FBQzJMLHdCQUFMO0FBQ0Q7QUFDRjs7QUFFREMsd0JBQXNCLENBQUM1RyxHQUFELEVBQU02RyxPQUFOLEVBQWU7QUFDbkMsVUFBTUMsV0FBVyxHQUFHOUcsR0FBRyxDQUFDQSxHQUF4QixDQURtQyxDQUduQzs7QUFDQSxRQUFJOEcsV0FBVyxLQUFLLE9BQXBCLEVBQTZCO0FBQzNCLFdBQUtDLGNBQUwsQ0FBb0IvRyxHQUFwQixFQUF5QjZHLE9BQXpCO0FBQ0QsS0FGRCxNQUVPLElBQUlDLFdBQVcsS0FBSyxTQUFwQixFQUErQjtBQUNwQyxXQUFLRSxnQkFBTCxDQUFzQmhILEdBQXRCLEVBQTJCNkcsT0FBM0I7QUFDRCxLQUZNLE1BRUEsSUFBSUMsV0FBVyxLQUFLLFNBQXBCLEVBQStCO0FBQ3BDLFdBQUtHLGdCQUFMLENBQXNCakgsR0FBdEIsRUFBMkI2RyxPQUEzQjtBQUNELEtBRk0sTUFFQSxJQUFJQyxXQUFXLEtBQUssT0FBcEIsRUFBNkI7QUFDbEMsV0FBS0ksY0FBTCxDQUFvQmxILEdBQXBCLEVBQXlCNkcsT0FBekI7QUFDRCxLQUZNLE1BRUEsSUFBSUMsV0FBVyxLQUFLLFNBQXBCLEVBQStCO0FBQ3BDLFdBQUtLLGdCQUFMLENBQXNCbkgsR0FBdEIsRUFBMkI2RyxPQUEzQjtBQUNELEtBRk0sTUFFQSxJQUFJQyxXQUFXLEtBQUssT0FBcEIsRUFBNkIsQ0FDbEM7QUFDRCxLQUZNLE1BRUE7QUFDTHBOLFlBQU0sQ0FBQzBCLE1BQVAsQ0FBYywrQ0FBZCxFQUErRDRFLEdBQS9EO0FBQ0Q7QUFDRjs7QUFFRG9ILGdCQUFjLENBQUNwSCxHQUFELEVBQU07QUFDbEIsVUFBTWhGLElBQUksR0FBRyxJQUFiOztBQUVBLFFBQUlBLElBQUksQ0FBQzBKLHFCQUFMLEVBQUosRUFBa0M7QUFDaEMxSixVQUFJLENBQUNzQyxnQ0FBTCxDQUFzQ2tGLElBQXRDLENBQTJDeEMsR0FBM0M7O0FBRUEsVUFBSUEsR0FBRyxDQUFDQSxHQUFKLEtBQVksT0FBaEIsRUFBeUI7QUFDdkIsZUFBT2hGLElBQUksQ0FBQ3VDLGlCQUFMLENBQXVCeUMsR0FBRyxDQUFDcUIsRUFBM0IsQ0FBUDtBQUNEOztBQUVELFVBQUlyQixHQUFHLENBQUNxSCxJQUFSLEVBQWM7QUFDWnJILFdBQUcsQ0FBQ3FILElBQUosQ0FBUzVILE9BQVQsQ0FBaUI2SCxLQUFLLElBQUk7QUFDeEIsaUJBQU90TSxJQUFJLENBQUN1QyxpQkFBTCxDQUF1QitKLEtBQXZCLENBQVA7QUFDRCxTQUZEO0FBR0Q7O0FBRUQsVUFBSXRILEdBQUcsQ0FBQzZDLE9BQVIsRUFBaUI7QUFDZjdDLFdBQUcsQ0FBQzZDLE9BQUosQ0FBWXBELE9BQVosQ0FBb0I3SCxRQUFRLElBQUk7QUFDOUIsaUJBQU9vRCxJQUFJLENBQUNqQywwQkFBTCxDQUFnQ25CLFFBQWhDLENBQVA7QUFDRCxTQUZEO0FBR0Q7O0FBRUQsVUFBSW9ELElBQUksQ0FBQzBKLHFCQUFMLEVBQUosRUFBa0M7QUFDaEM7QUFDRCxPQXJCK0IsQ0F1QmhDO0FBQ0E7QUFDQTs7O0FBRUEsWUFBTTZDLGdCQUFnQixHQUFHdk0sSUFBSSxDQUFDc0MsZ0NBQTlCO0FBQ0E5QixZQUFNLENBQUN3RixNQUFQLENBQWN1RyxnQkFBZCxFQUFnQzlILE9BQWhDLENBQXdDK0gsZUFBZSxJQUFJO0FBQ3pEeE0sWUFBSSxDQUFDNEwsc0JBQUwsQ0FDRVksZUFERixFQUVFeE0sSUFBSSxDQUFDOEMsZUFGUDtBQUlELE9BTEQ7QUFPQTlDLFVBQUksQ0FBQ3NDLGdDQUFMLEdBQXdDLEVBQXhDO0FBRUQsS0FyQ0QsTUFxQ087QUFDTHRDLFVBQUksQ0FBQzRMLHNCQUFMLENBQTRCNUcsR0FBNUIsRUFBaUNoRixJQUFJLENBQUM4QyxlQUF0QztBQUNELEtBMUNpQixDQTRDbEI7QUFDQTtBQUNBOzs7QUFDQSxVQUFNMkosYUFBYSxHQUNqQnpILEdBQUcsQ0FBQ0EsR0FBSixLQUFZLE9BQVosSUFDQUEsR0FBRyxDQUFDQSxHQUFKLEtBQVksU0FEWixJQUVBQSxHQUFHLENBQUNBLEdBQUosS0FBWSxTQUhkOztBQUtBLFFBQUloRixJQUFJLENBQUNpRCx1QkFBTCxLQUFpQyxDQUFqQyxJQUFzQyxDQUFFd0osYUFBNUMsRUFBMkQ7QUFDekR6TSxVQUFJLENBQUM2QyxvQkFBTDs7QUFDQTtBQUNEOztBQUVELFFBQUk3QyxJQUFJLENBQUMrQyxzQkFBTCxLQUFnQyxJQUFwQyxFQUEwQztBQUN4Qy9DLFVBQUksQ0FBQytDLHNCQUFMLEdBQ0UsSUFBSTJKLElBQUosR0FBV0MsT0FBWCxLQUF1QjNNLElBQUksQ0FBQ2tELHFCQUQ5QjtBQUVELEtBSEQsTUFHTyxJQUFJbEQsSUFBSSxDQUFDK0Msc0JBQUwsR0FBOEIsSUFBSTJKLElBQUosR0FBV0MsT0FBWCxFQUFsQyxFQUF3RDtBQUM3RDNNLFVBQUksQ0FBQzZDLG9CQUFMOztBQUNBO0FBQ0Q7O0FBRUQsUUFBSTdDLElBQUksQ0FBQ2dELDBCQUFULEVBQXFDO0FBQ25DNEosa0JBQVksQ0FBQzVNLElBQUksQ0FBQ2dELDBCQUFOLENBQVo7QUFDRDs7QUFDRGhELFFBQUksQ0FBQ2dELDBCQUFMLEdBQWtDNkosVUFBVSxDQUMxQzdNLElBQUksQ0FBQzJDLHFCQURxQyxFQUUxQzNDLElBQUksQ0FBQ2lELHVCQUZxQyxDQUE1QztBQUlEOztBQUVESixzQkFBb0IsR0FBRztBQUNyQixVQUFNN0MsSUFBSSxHQUFHLElBQWI7O0FBQ0EsUUFBSUEsSUFBSSxDQUFDZ0QsMEJBQVQsRUFBcUM7QUFDbkM0SixrQkFBWSxDQUFDNU0sSUFBSSxDQUFDZ0QsMEJBQU4sQ0FBWjtBQUNBaEQsVUFBSSxDQUFDZ0QsMEJBQUwsR0FBa0MsSUFBbEM7QUFDRDs7QUFFRGhELFFBQUksQ0FBQytDLHNCQUFMLEdBQThCLElBQTlCLENBUHFCLENBUXJCO0FBQ0E7QUFDQTs7QUFDQSxVQUFNK0osTUFBTSxHQUFHOU0sSUFBSSxDQUFDOEMsZUFBcEI7QUFDQTlDLFFBQUksQ0FBQzhDLGVBQUwsR0FBdUJ0QyxNQUFNLENBQUNDLE1BQVAsQ0FBYyxJQUFkLENBQXZCOztBQUNBVCxRQUFJLENBQUMrTSxjQUFMLENBQW9CRCxNQUFwQjtBQUNEOztBQUVEQyxnQkFBYyxDQUFDbEIsT0FBRCxFQUFVO0FBQ3RCLFVBQU03TCxJQUFJLEdBQUcsSUFBYjs7QUFFQSxRQUFJQSxJQUFJLENBQUN3QyxZQUFMLElBQXFCLENBQUVwRCxPQUFPLENBQUN5TSxPQUFELENBQWxDLEVBQTZDO0FBQzNDO0FBRUFyTCxZQUFNLENBQUNzSCxPQUFQLENBQWU5SCxJQUFJLENBQUM0QixPQUFwQixFQUE2QjZDLE9BQTdCLENBQXFDLFdBQXdCO0FBQUEsWUFBdkIsQ0FBQ3VJLFNBQUQsRUFBWXpJLEtBQVosQ0FBdUI7QUFDM0RBLGFBQUssQ0FBQ08sV0FBTixDQUNFN0YsTUFBTSxDQUFDb0csSUFBUCxDQUFZd0csT0FBWixFQUFxQm1CLFNBQXJCLElBQ0luQixPQUFPLENBQUNtQixTQUFELENBQVAsQ0FBbUJqSSxNQUR2QixHQUVJLENBSE4sRUFJRS9FLElBQUksQ0FBQ3dDLFlBSlA7QUFNRCxPQVBEO0FBU0F4QyxVQUFJLENBQUN3QyxZQUFMLEdBQW9CLEtBQXBCO0FBRUFoQyxZQUFNLENBQUNzSCxPQUFQLENBQWUrRCxPQUFmLEVBQXdCcEgsT0FBeEIsQ0FBZ0MsV0FBaUM7QUFBQSxZQUFoQyxDQUFDdUksU0FBRCxFQUFZQyxjQUFaLENBQWdDO0FBQy9ELGNBQU0xSSxLQUFLLEdBQUd2RSxJQUFJLENBQUM0QixPQUFMLENBQWFvTCxTQUFiLENBQWQ7O0FBQ0EsWUFBSXpJLEtBQUosRUFBVztBQUNUMEksd0JBQWMsQ0FBQ3hJLE9BQWYsQ0FBdUJ5SSxhQUFhLElBQUk7QUFDdEMzSSxpQkFBSyxDQUFDVSxNQUFOLENBQWFpSSxhQUFiO0FBQ0QsV0FGRDtBQUdELFNBSkQsTUFJTztBQUNMO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxnQkFBTXJCLE9BQU8sR0FBRzdMLElBQUksQ0FBQ3lDLHdCQUFyQjs7QUFFQSxjQUFJLENBQUV4RCxNQUFNLENBQUNvRyxJQUFQLENBQVl3RyxPQUFaLEVBQXFCbUIsU0FBckIsQ0FBTixFQUF1QztBQUNyQ25CLG1CQUFPLENBQUNtQixTQUFELENBQVAsR0FBcUIsRUFBckI7QUFDRDs7QUFFRG5CLGlCQUFPLENBQUNtQixTQUFELENBQVAsQ0FBbUJ4RixJQUFuQixDQUF3QixHQUFHeUYsY0FBM0I7QUFDRDtBQUNGLE9BcEJELEVBZDJDLENBb0MzQzs7QUFDQXpNLFlBQU0sQ0FBQ3dGLE1BQVAsQ0FBY2hHLElBQUksQ0FBQzRCLE9BQW5CLEVBQTRCNkMsT0FBNUIsQ0FBcUNGLEtBQUQsSUFBVztBQUM3Q0EsYUFBSyxDQUFDVyxTQUFOO0FBQ0QsT0FGRDtBQUdEOztBQUVEbEYsUUFBSSxDQUFDMkwsd0JBQUw7QUFDRCxHQXhvQ3FCLENBMG9DdEI7QUFDQTtBQUNBOzs7QUFDQUEsMEJBQXdCLEdBQUc7QUFDekIsVUFBTTNMLElBQUksR0FBRyxJQUFiO0FBQ0EsVUFBTXVGLFNBQVMsR0FBR3ZGLElBQUksQ0FBQ3FDLHFCQUF2QjtBQUNBckMsUUFBSSxDQUFDcUMscUJBQUwsR0FBNkIsRUFBN0I7QUFDQWtELGFBQVMsQ0FBQ2QsT0FBVixDQUFtQjJDLENBQUQsSUFBTztBQUN2QkEsT0FBQztBQUNGLEtBRkQ7QUFHRDs7QUFFRCtGLGFBQVcsQ0FBQ3RCLE9BQUQsRUFBVWhDLFVBQVYsRUFBc0I3RSxHQUF0QixFQUEyQjtBQUNwQyxRQUFJLENBQUUvRixNQUFNLENBQUNvRyxJQUFQLENBQVl3RyxPQUFaLEVBQXFCaEMsVUFBckIsQ0FBTixFQUF3QztBQUN0Q2dDLGFBQU8sQ0FBQ2hDLFVBQUQsQ0FBUCxHQUFzQixFQUF0QjtBQUNEOztBQUNEZ0MsV0FBTyxDQUFDaEMsVUFBRCxDQUFQLENBQW9CckMsSUFBcEIsQ0FBeUJ4QyxHQUF6QjtBQUNEOztBQUVEb0ksZUFBYSxDQUFDdkQsVUFBRCxFQUFheEQsRUFBYixFQUFpQjtBQUM1QixVQUFNckcsSUFBSSxHQUFHLElBQWI7O0FBQ0EsUUFBSSxDQUFFZixNQUFNLENBQUNvRyxJQUFQLENBQVlyRixJQUFJLENBQUNvQyxnQkFBakIsRUFBbUN5SCxVQUFuQyxDQUFOLEVBQXNEO0FBQ3BELGFBQU8sSUFBUDtBQUNEOztBQUNELFVBQU13RCx1QkFBdUIsR0FBR3JOLElBQUksQ0FBQ29DLGdCQUFMLENBQXNCeUgsVUFBdEIsQ0FBaEM7QUFDQSxXQUFPd0QsdUJBQXVCLENBQUNuRixHQUF4QixDQUE0QjdCLEVBQTVCLEtBQW1DLElBQTFDO0FBQ0Q7O0FBRUQwRixnQkFBYyxDQUFDL0csR0FBRCxFQUFNNkcsT0FBTixFQUFlO0FBQzNCLFVBQU03TCxJQUFJLEdBQUcsSUFBYjtBQUNBLFVBQU1xRyxFQUFFLEdBQUdySCxPQUFPLENBQUNjLE9BQVIsQ0FBZ0JrRixHQUFHLENBQUNxQixFQUFwQixDQUFYOztBQUNBLFVBQU00RCxTQUFTLEdBQUdqSyxJQUFJLENBQUNvTixhQUFMLENBQW1CcEksR0FBRyxDQUFDNkUsVUFBdkIsRUFBbUN4RCxFQUFuQyxDQUFsQjs7QUFDQSxRQUFJNEQsU0FBSixFQUFlO0FBQ2I7QUFDQSxZQUFNcUQsVUFBVSxHQUFHckQsU0FBUyxDQUFDRyxRQUFWLEtBQXVCbEIsU0FBMUM7QUFFQWUsZUFBUyxDQUFDRyxRQUFWLEdBQXFCcEYsR0FBRyxDQUFDdUksTUFBSixJQUFjL00sTUFBTSxDQUFDQyxNQUFQLENBQWMsSUFBZCxDQUFuQztBQUNBd0osZUFBUyxDQUFDRyxRQUFWLENBQW1Cb0QsR0FBbkIsR0FBeUJuSCxFQUF6Qjs7QUFFQSxVQUFJckcsSUFBSSxDQUFDd0MsWUFBVCxFQUF1QjtBQUNyQjtBQUNBO0FBQ0E7QUFDQTtBQUNBLGNBQU1pTCxVQUFVLEdBQUd6TixJQUFJLENBQUM0QixPQUFMLENBQWFvRCxHQUFHLENBQUM2RSxVQUFqQixFQUE2QjZELE1BQTdCLENBQW9DMUksR0FBRyxDQUFDcUIsRUFBeEMsQ0FBbkI7O0FBQ0EsWUFBSW9ILFVBQVUsS0FBS3ZFLFNBQW5CLEVBQThCbEUsR0FBRyxDQUFDdUksTUFBSixHQUFhRSxVQUFiOztBQUU5QnpOLFlBQUksQ0FBQ21OLFdBQUwsQ0FBaUJ0QixPQUFqQixFQUEwQjdHLEdBQUcsQ0FBQzZFLFVBQTlCLEVBQTBDN0UsR0FBMUM7QUFDRCxPQVRELE1BU08sSUFBSXNJLFVBQUosRUFBZ0I7QUFDckIsY0FBTSxJQUFJeFAsS0FBSixDQUFVLHNDQUFzQ2tILEdBQUcsQ0FBQ3FCLEVBQXBELENBQU47QUFDRDtBQUNGLEtBbkJELE1BbUJPO0FBQ0xyRyxVQUFJLENBQUNtTixXQUFMLENBQWlCdEIsT0FBakIsRUFBMEI3RyxHQUFHLENBQUM2RSxVQUE5QixFQUEwQzdFLEdBQTFDO0FBQ0Q7QUFDRjs7QUFFRGdILGtCQUFnQixDQUFDaEgsR0FBRCxFQUFNNkcsT0FBTixFQUFlO0FBQzdCLFVBQU03TCxJQUFJLEdBQUcsSUFBYjs7QUFDQSxVQUFNaUssU0FBUyxHQUFHakssSUFBSSxDQUFDb04sYUFBTCxDQUFtQnBJLEdBQUcsQ0FBQzZFLFVBQXZCLEVBQW1DN0ssT0FBTyxDQUFDYyxPQUFSLENBQWdCa0YsR0FBRyxDQUFDcUIsRUFBcEIsQ0FBbkMsQ0FBbEI7O0FBQ0EsUUFBSTRELFNBQUosRUFBZTtBQUNiLFVBQUlBLFNBQVMsQ0FBQ0csUUFBVixLQUF1QmxCLFNBQTNCLEVBQ0UsTUFBTSxJQUFJcEwsS0FBSixDQUFVLDZDQUE2Q2tILEdBQUcsQ0FBQ3FCLEVBQTNELENBQU47QUFDRnNILGtCQUFZLENBQUNDLFlBQWIsQ0FBMEIzRCxTQUFTLENBQUNHLFFBQXBDLEVBQThDcEYsR0FBRyxDQUFDdUksTUFBbEQ7QUFDRCxLQUpELE1BSU87QUFDTHZOLFVBQUksQ0FBQ21OLFdBQUwsQ0FBaUJ0QixPQUFqQixFQUEwQjdHLEdBQUcsQ0FBQzZFLFVBQTlCLEVBQTBDN0UsR0FBMUM7QUFDRDtBQUNGOztBQUVEaUgsa0JBQWdCLENBQUNqSCxHQUFELEVBQU02RyxPQUFOLEVBQWU7QUFDN0IsVUFBTTdMLElBQUksR0FBRyxJQUFiOztBQUNBLFVBQU1pSyxTQUFTLEdBQUdqSyxJQUFJLENBQUNvTixhQUFMLENBQW1CcEksR0FBRyxDQUFDNkUsVUFBdkIsRUFBbUM3SyxPQUFPLENBQUNjLE9BQVIsQ0FBZ0JrRixHQUFHLENBQUNxQixFQUFwQixDQUFuQyxDQUFsQjs7QUFDQSxRQUFJNEQsU0FBSixFQUFlO0FBQ2I7QUFDQSxVQUFJQSxTQUFTLENBQUNHLFFBQVYsS0FBdUJsQixTQUEzQixFQUNFLE1BQU0sSUFBSXBMLEtBQUosQ0FBVSw0Q0FBNENrSCxHQUFHLENBQUNxQixFQUExRCxDQUFOO0FBQ0Y0RCxlQUFTLENBQUNHLFFBQVYsR0FBcUJsQixTQUFyQjtBQUNELEtBTEQsTUFLTztBQUNMbEosVUFBSSxDQUFDbU4sV0FBTCxDQUFpQnRCLE9BQWpCLEVBQTBCN0csR0FBRyxDQUFDNkUsVUFBOUIsRUFBMEM7QUFDeEM3RSxXQUFHLEVBQUUsU0FEbUM7QUFFeEM2RSxrQkFBVSxFQUFFN0UsR0FBRyxDQUFDNkUsVUFGd0I7QUFHeEN4RCxVQUFFLEVBQUVyQixHQUFHLENBQUNxQjtBQUhnQyxPQUExQztBQUtEO0FBQ0Y7O0FBRUQ4RixrQkFBZ0IsQ0FBQ25ILEdBQUQsRUFBTTZHLE9BQU4sRUFBZTtBQUM3QixVQUFNN0wsSUFBSSxHQUFHLElBQWIsQ0FENkIsQ0FFN0I7O0FBRUFnRixPQUFHLENBQUM2QyxPQUFKLENBQVlwRCxPQUFaLENBQXFCN0gsUUFBRCxJQUFjO0FBQ2hDLFlBQU1pUixJQUFJLEdBQUc3TixJQUFJLENBQUNtQyx1QkFBTCxDQUE2QnZGLFFBQTdCLEtBQTBDLEVBQXZEO0FBQ0E0RCxZQUFNLENBQUN3RixNQUFQLENBQWM2SCxJQUFkLEVBQW9CcEosT0FBcEIsQ0FBNkJxSixPQUFELElBQWE7QUFDdkMsY0FBTTdELFNBQVMsR0FBR2pLLElBQUksQ0FBQ29OLGFBQUwsQ0FBbUJVLE9BQU8sQ0FBQ2pFLFVBQTNCLEVBQXVDaUUsT0FBTyxDQUFDekgsRUFBL0MsQ0FBbEI7O0FBQ0EsWUFBSSxDQUFFNEQsU0FBTixFQUFpQjtBQUNmLGdCQUFNLElBQUluTSxLQUFKLENBQVUsd0JBQXdCaVEsSUFBSSxDQUFDQyxTQUFMLENBQWVGLE9BQWYsQ0FBbEMsQ0FBTjtBQUNEOztBQUNELFlBQUksQ0FBRTdELFNBQVMsQ0FBQ0UsY0FBVixDQUF5QnZOLFFBQXpCLENBQU4sRUFBMEM7QUFDeEMsZ0JBQU0sSUFBSWtCLEtBQUosQ0FDSixTQUNFaVEsSUFBSSxDQUFDQyxTQUFMLENBQWVGLE9BQWYsQ0FERixHQUVFLDBCQUZGLEdBR0VsUixRQUpFLENBQU47QUFNRDs7QUFDRCxlQUFPcU4sU0FBUyxDQUFDRSxjQUFWLENBQXlCdk4sUUFBekIsQ0FBUDs7QUFDQSxZQUFJd0MsT0FBTyxDQUFDNkssU0FBUyxDQUFDRSxjQUFYLENBQVgsRUFBdUM7QUFDckM7QUFDQTtBQUNBO0FBQ0E7QUFFQTtBQUNBO0FBQ0E7QUFDQW5LLGNBQUksQ0FBQ21OLFdBQUwsQ0FBaUJ0QixPQUFqQixFQUEwQmlDLE9BQU8sQ0FBQ2pFLFVBQWxDLEVBQThDO0FBQzVDN0UsZUFBRyxFQUFFLFNBRHVDO0FBRTVDcUIsY0FBRSxFQUFFckgsT0FBTyxDQUFDYSxXQUFSLENBQW9CaU8sT0FBTyxDQUFDekgsRUFBNUIsQ0FGd0M7QUFHNUM0SCxtQkFBTyxFQUFFaEUsU0FBUyxDQUFDRztBQUh5QixXQUE5QyxFQVRxQyxDQWNyQzs7O0FBRUFILG1CQUFTLENBQUNJLGNBQVYsQ0FBeUI1RixPQUF6QixDQUFrQzJDLENBQUQsSUFBTztBQUN0Q0EsYUFBQztBQUNGLFdBRkQsRUFoQnFDLENBb0JyQztBQUNBO0FBQ0E7O0FBQ0FwSCxjQUFJLENBQUNvQyxnQkFBTCxDQUFzQjBMLE9BQU8sQ0FBQ2pFLFVBQTlCLEVBQTBDakQsTUFBMUMsQ0FBaURrSCxPQUFPLENBQUN6SCxFQUF6RDtBQUNEO0FBQ0YsT0F2Q0Q7QUF3Q0EsYUFBT3JHLElBQUksQ0FBQ21DLHVCQUFMLENBQTZCdkYsUUFBN0IsQ0FBUCxDQTFDZ0MsQ0E0Q2hDO0FBQ0E7O0FBQ0EsWUFBTXNSLGVBQWUsR0FBR2xPLElBQUksQ0FBQ3JDLGVBQUwsQ0FBcUJmLFFBQXJCLENBQXhCOztBQUNBLFVBQUksQ0FBRXNSLGVBQU4sRUFBdUI7QUFDckIsY0FBTSxJQUFJcFEsS0FBSixDQUFVLG9DQUFvQ2xCLFFBQTlDLENBQU47QUFDRDs7QUFFRG9ELFVBQUksQ0FBQ21PLCtCQUFMLENBQ0U7QUFBQSxlQUFhRCxlQUFlLENBQUM1UCxXQUFoQixDQUE0QixZQUE1QixDQUFiO0FBQUEsT0FERjtBQUdELEtBdEREO0FBdUREOztBQUVENE4sZ0JBQWMsQ0FBQ2xILEdBQUQsRUFBTTZHLE9BQU4sRUFBZTtBQUMzQixVQUFNN0wsSUFBSSxHQUFHLElBQWIsQ0FEMkIsQ0FFM0I7QUFDQTtBQUNBOztBQUVBZ0YsT0FBRyxDQUFDcUgsSUFBSixDQUFTNUgsT0FBVCxDQUFrQjZILEtBQUQsSUFBVztBQUMxQnRNLFVBQUksQ0FBQ21PLCtCQUFMLENBQXFDLE1BQU07QUFDekMsY0FBTUMsU0FBUyxHQUFHcE8sSUFBSSxDQUFDbUQsY0FBTCxDQUFvQm1KLEtBQXBCLENBQWxCLENBRHlDLENBRXpDOztBQUNBLFlBQUksQ0FBQzhCLFNBQUwsRUFBZ0IsT0FIeUIsQ0FJekM7O0FBQ0EsWUFBSUEsU0FBUyxDQUFDOUgsS0FBZCxFQUFxQjtBQUNyQjhILGlCQUFTLENBQUM5SCxLQUFWLEdBQWtCLElBQWxCO0FBQ0E4SCxpQkFBUyxDQUFDN0gsYUFBVixJQUEyQjZILFNBQVMsQ0FBQzdILGFBQVYsRUFBM0I7QUFDQTZILGlCQUFTLENBQUN6SCxTQUFWLENBQW9CRSxPQUFwQjtBQUNELE9BVEQ7QUFVRCxLQVhEO0FBWUQsR0E5eUNxQixDQWd6Q3RCO0FBQ0E7QUFDQTs7O0FBQ0FzSCxpQ0FBK0IsQ0FBQ3JJLENBQUQsRUFBSTtBQUNqQyxVQUFNOUYsSUFBSSxHQUFHLElBQWI7O0FBQ0EsVUFBTXFPLGdCQUFnQixHQUFHLE1BQU07QUFDN0JyTyxVQUFJLENBQUNxQyxxQkFBTCxDQUEyQm1GLElBQTNCLENBQWdDMUIsQ0FBaEM7QUFDRCxLQUZEOztBQUdBLFFBQUl3SSx1QkFBdUIsR0FBRyxDQUE5Qjs7QUFDQSxVQUFNQyxnQkFBZ0IsR0FBRyxNQUFNO0FBQzdCLFFBQUVELHVCQUFGOztBQUNBLFVBQUlBLHVCQUF1QixLQUFLLENBQWhDLEVBQW1DO0FBQ2pDO0FBQ0E7QUFDQUQsd0JBQWdCO0FBQ2pCO0FBQ0YsS0FQRDs7QUFTQTdOLFVBQU0sQ0FBQ3dGLE1BQVAsQ0FBY2hHLElBQUksQ0FBQ29DLGdCQUFuQixFQUFxQ3FDLE9BQXJDLENBQThDK0osZUFBRCxJQUFxQjtBQUNoRUEscUJBQWUsQ0FBQy9KLE9BQWhCLENBQXlCd0YsU0FBRCxJQUFlO0FBQ3JDLGNBQU13RSxzQ0FBc0MsR0FDMUN0UCxJQUFJLENBQUM4SyxTQUFTLENBQUNFLGNBQVgsQ0FBSixDQUErQnRFLElBQS9CLENBQW9DakosUUFBUSxJQUFJO0FBQzlDLGdCQUFNdU8sT0FBTyxHQUFHbkwsSUFBSSxDQUFDckMsZUFBTCxDQUFxQmYsUUFBckIsQ0FBaEI7QUFDQSxpQkFBT3VPLE9BQU8sSUFBSUEsT0FBTyxDQUFDdE8sV0FBMUI7QUFDRCxTQUhELENBREY7O0FBTUEsWUFBSTRSLHNDQUFKLEVBQTRDO0FBQzFDLFlBQUVILHVCQUFGO0FBQ0FyRSxtQkFBUyxDQUFDSSxjQUFWLENBQXlCN0MsSUFBekIsQ0FBOEIrRyxnQkFBOUI7QUFDRDtBQUNGLE9BWEQ7QUFZRCxLQWJEOztBQWNBLFFBQUlELHVCQUF1QixLQUFLLENBQWhDLEVBQW1DO0FBQ2pDO0FBQ0E7QUFDQUQsc0JBQWdCO0FBQ2pCO0FBQ0Y7O0FBRURLLGlCQUFlLENBQUMxSixHQUFELEVBQU07QUFDbkIsVUFBTWhGLElBQUksR0FBRyxJQUFiLENBRG1CLENBR25CO0FBQ0E7O0FBQ0FBLFFBQUksQ0FBQ29NLGNBQUwsQ0FBb0JwSCxHQUFwQixFQUxtQixDQU9uQjtBQUNBO0FBRUE7OztBQUNBLFFBQUksQ0FBRS9GLE1BQU0sQ0FBQ29HLElBQVAsQ0FBWXJGLElBQUksQ0FBQ21ELGNBQWpCLEVBQWlDNkIsR0FBRyxDQUFDcUIsRUFBckMsQ0FBTixFQUFnRDtBQUM5QztBQUNELEtBYmtCLENBZW5COzs7QUFDQSxVQUFNRyxhQUFhLEdBQUd4RyxJQUFJLENBQUNtRCxjQUFMLENBQW9CNkIsR0FBRyxDQUFDcUIsRUFBeEIsRUFBNEJHLGFBQWxEO0FBQ0EsVUFBTUMsWUFBWSxHQUFHekcsSUFBSSxDQUFDbUQsY0FBTCxDQUFvQjZCLEdBQUcsQ0FBQ3FCLEVBQXhCLEVBQTRCSSxZQUFqRDs7QUFFQXpHLFFBQUksQ0FBQ21ELGNBQUwsQ0FBb0I2QixHQUFHLENBQUNxQixFQUF4QixFQUE0Qk8sTUFBNUI7O0FBRUEsVUFBTStILGtCQUFrQixHQUFHQyxNQUFNLElBQUk7QUFDbkMsYUFDRUEsTUFBTSxJQUNOQSxNQUFNLENBQUNqRSxLQURQLElBRUEsSUFBSWpNLE1BQU0sQ0FBQ1osS0FBWCxDQUNFOFEsTUFBTSxDQUFDakUsS0FBUCxDQUFhQSxLQURmLEVBRUVpRSxNQUFNLENBQUNqRSxLQUFQLENBQWFrRSxNQUZmLEVBR0VELE1BQU0sQ0FBQ2pFLEtBQVAsQ0FBYW1FLE9BSGYsQ0FIRjtBQVNELEtBVkQsQ0FyQm1CLENBaUNuQjs7O0FBQ0EsUUFBSXRJLGFBQWEsSUFBSXhCLEdBQUcsQ0FBQzJGLEtBQXpCLEVBQWdDO0FBQzlCbkUsbUJBQWEsQ0FBQ21JLGtCQUFrQixDQUFDM0osR0FBRCxDQUFuQixDQUFiO0FBQ0Q7O0FBRUQsUUFBSXlCLFlBQUosRUFBa0I7QUFDaEJBLGtCQUFZLENBQUNrSSxrQkFBa0IsQ0FBQzNKLEdBQUQsQ0FBbkIsQ0FBWjtBQUNEO0FBQ0Y7O0FBRUQrSixrQkFBZ0IsQ0FBQy9KLEdBQUQsRUFBTTtBQUNwQjtBQUVBLFVBQU1oRixJQUFJLEdBQUcsSUFBYixDQUhvQixDQUtwQjs7QUFDQSxRQUFJLENBQUVaLE9BQU8sQ0FBQ1ksSUFBSSxDQUFDOEMsZUFBTixDQUFiLEVBQXFDO0FBQ25DOUMsVUFBSSxDQUFDNkMsb0JBQUw7QUFDRCxLQVJtQixDQVVwQjtBQUNBOzs7QUFDQSxRQUFJekQsT0FBTyxDQUFDWSxJQUFJLENBQUNrQyx3QkFBTixDQUFYLEVBQTRDO0FBQzFDeEQsWUFBTSxDQUFDMEIsTUFBUCxDQUFjLG1EQUFkOztBQUNBO0FBQ0Q7O0FBQ0QsVUFBTTRPLGtCQUFrQixHQUFHaFAsSUFBSSxDQUFDa0Msd0JBQUwsQ0FBOEIsQ0FBOUIsRUFBaUMyRixPQUE1RDtBQUNBLFFBQUlvSCxDQUFKO0FBQ0EsVUFBTUMsQ0FBQyxHQUFHRixrQkFBa0IsQ0FBQy9JLElBQW5CLENBQXdCLENBQUN2QixNQUFELEVBQVN5SyxHQUFULEtBQWlCO0FBQ2pELFlBQU1DLEtBQUssR0FBRzFLLE1BQU0sQ0FBQzlILFFBQVAsS0FBb0JvSSxHQUFHLENBQUNxQixFQUF0QztBQUNBLFVBQUkrSSxLQUFKLEVBQVdILENBQUMsR0FBR0UsR0FBSjtBQUNYLGFBQU9DLEtBQVA7QUFDRCxLQUpTLENBQVY7O0FBS0EsUUFBSSxDQUFDRixDQUFMLEVBQVE7QUFDTnhRLFlBQU0sQ0FBQzBCLE1BQVAsQ0FBYyxxREFBZCxFQUFxRTRFLEdBQXJFOztBQUNBO0FBQ0QsS0ExQm1CLENBNEJwQjtBQUNBO0FBQ0E7OztBQUNBZ0ssc0JBQWtCLENBQUNLLE1BQW5CLENBQTBCSixDQUExQixFQUE2QixDQUE3Qjs7QUFFQSxRQUFJaFEsTUFBTSxDQUFDb0csSUFBUCxDQUFZTCxHQUFaLEVBQWlCLE9BQWpCLENBQUosRUFBK0I7QUFDN0JrSyxPQUFDLENBQUMvUSxhQUFGLENBQ0UsSUFBSU8sTUFBTSxDQUFDWixLQUFYLENBQWlCa0gsR0FBRyxDQUFDMkYsS0FBSixDQUFVQSxLQUEzQixFQUFrQzNGLEdBQUcsQ0FBQzJGLEtBQUosQ0FBVWtFLE1BQTVDLEVBQW9EN0osR0FBRyxDQUFDMkYsS0FBSixDQUFVbUUsT0FBOUQsQ0FERjtBQUdELEtBSkQsTUFJTztBQUNMO0FBQ0E7QUFDQUksT0FBQyxDQUFDL1EsYUFBRixDQUFnQitLLFNBQWhCLEVBQTJCbEUsR0FBRyxDQUFDM0csTUFBL0I7QUFDRDtBQUNGLEdBNTZDcUIsQ0E4NkN0QjtBQUNBO0FBQ0E7OztBQUNBSCw0QkFBMEIsR0FBRztBQUMzQixVQUFNOEIsSUFBSSxHQUFHLElBQWI7QUFDQSxRQUFJQSxJQUFJLENBQUNpTCx5QkFBTCxFQUFKLEVBQXNDLE9BRlgsQ0FJM0I7QUFDQTtBQUNBOztBQUNBLFFBQUksQ0FBRTdMLE9BQU8sQ0FBQ1ksSUFBSSxDQUFDa0Msd0JBQU4sQ0FBYixFQUE4QztBQUM1QyxZQUFNb04sVUFBVSxHQUFHdFAsSUFBSSxDQUFDa0Msd0JBQUwsQ0FBOEJxTixLQUE5QixFQUFuQjs7QUFDQSxVQUFJLENBQUVuUSxPQUFPLENBQUNrUSxVQUFVLENBQUN6SCxPQUFaLENBQWIsRUFDRSxNQUFNLElBQUkvSixLQUFKLENBQ0osZ0RBQ0VpUSxJQUFJLENBQUNDLFNBQUwsQ0FBZXNCLFVBQWYsQ0FGRSxDQUFOLENBSDBDLENBUTVDOztBQUNBLFVBQUksQ0FBRWxRLE9BQU8sQ0FBQ1ksSUFBSSxDQUFDa0Msd0JBQU4sQ0FBYixFQUNFbEMsSUFBSSxDQUFDd1AsdUJBQUw7QUFDSCxLQWxCMEIsQ0FvQjNCOzs7QUFDQXhQLFFBQUksQ0FBQ3lQLGFBQUw7QUFDRCxHQXY4Q3FCLENBeThDdEI7QUFDQTs7O0FBQ0FELHlCQUF1QixHQUFHO0FBQ3hCLFVBQU14UCxJQUFJLEdBQUcsSUFBYjs7QUFFQSxRQUFJWixPQUFPLENBQUNZLElBQUksQ0FBQ2tDLHdCQUFOLENBQVgsRUFBNEM7QUFDMUM7QUFDRDs7QUFFRGxDLFFBQUksQ0FBQ2tDLHdCQUFMLENBQThCLENBQTlCLEVBQWlDMkYsT0FBakMsQ0FBeUNwRCxPQUF6QyxDQUFpRHlLLENBQUMsSUFBSTtBQUNwREEsT0FBQyxDQUFDdFIsV0FBRjtBQUNELEtBRkQ7QUFHRDs7QUFFRDhSLGlCQUFlLENBQUMxSyxHQUFELEVBQU07QUFDbkJ0RyxVQUFNLENBQUMwQixNQUFQLENBQWMsOEJBQWQsRUFBOEM0RSxHQUFHLENBQUM2SixNQUFsRDs7QUFDQSxRQUFJN0osR0FBRyxDQUFDMkssZ0JBQVIsRUFBMEJqUixNQUFNLENBQUMwQixNQUFQLENBQWMsT0FBZCxFQUF1QjRFLEdBQUcsQ0FBQzJLLGdCQUEzQjtBQUMzQjs7QUFFREMsc0RBQW9ELEdBQUc7QUFDckQsVUFBTTVQLElBQUksR0FBRyxJQUFiO0FBQ0EsVUFBTTZQLDBCQUEwQixHQUFHN1AsSUFBSSxDQUFDa0Msd0JBQXhDO0FBQ0FsQyxRQUFJLENBQUNrQyx3QkFBTCxHQUFnQyxFQUFoQztBQUVBbEMsUUFBSSxDQUFDaUIsV0FBTCxJQUFvQmpCLElBQUksQ0FBQ2lCLFdBQUwsRUFBcEI7O0FBQ0EzRSxPQUFHLENBQUN3VCxjQUFKLENBQW1CQyxJQUFuQixDQUF3QmhULFFBQVEsSUFBSTtBQUNsQ0EsY0FBUSxDQUFDaUQsSUFBRCxDQUFSO0FBQ0EsYUFBTyxJQUFQO0FBQ0QsS0FIRDs7QUFLQSxRQUFJWixPQUFPLENBQUN5USwwQkFBRCxDQUFYLEVBQXlDLE9BWFksQ0FhckQ7QUFDQTtBQUNBOztBQUNBLFFBQUl6USxPQUFPLENBQUNZLElBQUksQ0FBQ2tDLHdCQUFOLENBQVgsRUFBNEM7QUFDMUNsQyxVQUFJLENBQUNrQyx3QkFBTCxHQUFnQzJOLDBCQUFoQzs7QUFDQTdQLFVBQUksQ0FBQ3dQLHVCQUFMOztBQUNBO0FBQ0QsS0FwQm9ELENBc0JyRDtBQUNBO0FBQ0E7OztBQUNBLFFBQUksQ0FBRW5RLElBQUksQ0FBQ1csSUFBSSxDQUFDa0Msd0JBQU4sQ0FBSixDQUFvQzNFLElBQXRDLElBQ0EsQ0FBRXNTLDBCQUEwQixDQUFDLENBQUQsQ0FBMUIsQ0FBOEJ0UyxJQURwQyxFQUMwQztBQUN4Q3NTLGdDQUEwQixDQUFDLENBQUQsQ0FBMUIsQ0FBOEJoSSxPQUE5QixDQUFzQ3BELE9BQXRDLENBQThDeUssQ0FBQyxJQUFJO0FBQ2pEN1AsWUFBSSxDQUFDVyxJQUFJLENBQUNrQyx3QkFBTixDQUFKLENBQW9DMkYsT0FBcEMsQ0FBNENMLElBQTVDLENBQWlEMEgsQ0FBakQsRUFEaUQsQ0FHakQ7O0FBQ0EsWUFBSWxQLElBQUksQ0FBQ2tDLHdCQUFMLENBQThCNkMsTUFBOUIsS0FBeUMsQ0FBN0MsRUFBZ0Q7QUFDOUNtSyxXQUFDLENBQUN0UixXQUFGO0FBQ0Q7QUFDRixPQVBEO0FBU0FpUyxnQ0FBMEIsQ0FBQ04sS0FBM0I7QUFDRCxLQXJDb0QsQ0F1Q3JEOzs7QUFDQXZQLFFBQUksQ0FBQ2tDLHdCQUFMLENBQThCc0YsSUFBOUIsQ0FBbUMsR0FBR3FJLDBCQUF0QztBQUNELEdBcmdEcUIsQ0F1Z0R0Qjs7O0FBQ0FqTSxpQkFBZSxHQUFHO0FBQ2hCLFdBQU94RSxPQUFPLENBQUMsS0FBS3pCLGVBQU4sQ0FBZDtBQUNELEdBMWdEcUIsQ0E0Z0R0QjtBQUNBOzs7QUFDQThSLGVBQWEsR0FBRztBQUNkLFVBQU16UCxJQUFJLEdBQUcsSUFBYjs7QUFDQSxRQUFJQSxJQUFJLENBQUMwQyxhQUFMLElBQXNCMUMsSUFBSSxDQUFDNEQsZUFBTCxFQUExQixFQUFrRDtBQUNoRDVELFVBQUksQ0FBQzBDLGFBQUw7O0FBQ0ExQyxVQUFJLENBQUMwQyxhQUFMLEdBQXFCLElBQXJCO0FBQ0Q7QUFDRjs7QUFFRHVCLFdBQVMsQ0FBQytMLE9BQUQsRUFBVTtBQUNqQixRQUFJaEwsR0FBSjs7QUFDQSxRQUFJO0FBQ0ZBLFNBQUcsR0FBR3JHLFNBQVMsQ0FBQ3NSLFFBQVYsQ0FBbUJELE9BQW5CLENBQU47QUFDRCxLQUZELENBRUUsT0FBT3ZJLENBQVAsRUFBVTtBQUNWL0ksWUFBTSxDQUFDMEIsTUFBUCxDQUFjLDZCQUFkLEVBQTZDcUgsQ0FBN0M7O0FBQ0E7QUFDRCxLQVBnQixDQVNqQjtBQUNBOzs7QUFDQSxRQUFJLEtBQUszRCxVQUFULEVBQXFCO0FBQ25CLFdBQUtBLFVBQUwsQ0FBZ0JvTSxlQUFoQjtBQUNEOztBQUVELFFBQUlsTCxHQUFHLEtBQUssSUFBUixJQUFnQixDQUFDQSxHQUFHLENBQUNBLEdBQXpCLEVBQThCO0FBQzVCO0FBQ0E7QUFDQTtBQUNBLFVBQUksRUFBRUEsR0FBRyxJQUFJQSxHQUFHLENBQUNtTCxTQUFiLENBQUosRUFDRXpSLE1BQU0sQ0FBQzBCLE1BQVAsQ0FBYyxxQ0FBZCxFQUFxRDRFLEdBQXJEO0FBQ0Y7QUFDRDs7QUFFRCxRQUFJQSxHQUFHLENBQUNBLEdBQUosS0FBWSxXQUFoQixFQUE2QjtBQUMzQixXQUFLckQsUUFBTCxHQUFnQixLQUFLRCxrQkFBckI7O0FBQ0EsV0FBSzBKLG1CQUFMLENBQXlCcEcsR0FBekI7O0FBQ0EsV0FBS3JJLE9BQUwsQ0FBYXNELFdBQWI7QUFDRCxLQUpELE1BSU8sSUFBSStFLEdBQUcsQ0FBQ0EsR0FBSixLQUFZLFFBQWhCLEVBQTBCO0FBQy9CLFVBQUksS0FBS2pELHFCQUFMLENBQTJCcU8sT0FBM0IsQ0FBbUNwTCxHQUFHLENBQUNxTCxPQUF2QyxLQUFtRCxDQUF2RCxFQUEwRDtBQUN4RCxhQUFLM08sa0JBQUwsR0FBMEJzRCxHQUFHLENBQUNxTCxPQUE5Qjs7QUFDQSxhQUFLblAsT0FBTCxDQUFhMkosU0FBYixDQUF1QjtBQUFFeUYsZ0JBQU0sRUFBRTtBQUFWLFNBQXZCO0FBQ0QsT0FIRCxNQUdPO0FBQ0wsY0FBTW5RLFdBQVcsR0FDZiw4REFDQTZFLEdBQUcsQ0FBQ3FMLE9BRk47O0FBR0EsYUFBS25QLE9BQUwsQ0FBYTRKLFVBQWIsQ0FBd0I7QUFBRUUsb0JBQVUsRUFBRSxJQUFkO0FBQW9CdUYsZ0JBQU0sRUFBRXBRO0FBQTVCLFNBQXhCOztBQUNBLGFBQUt4RCxPQUFMLENBQWF1RCw4QkFBYixDQUE0Q0MsV0FBNUM7QUFDRDtBQUNGLEtBWE0sTUFXQSxJQUFJNkUsR0FBRyxDQUFDQSxHQUFKLEtBQVksTUFBWixJQUFzQixLQUFLckksT0FBTCxDQUFhbUUsY0FBdkMsRUFBdUQ7QUFDNUQsV0FBSzlDLEtBQUwsQ0FBVztBQUFFZ0gsV0FBRyxFQUFFLE1BQVA7QUFBZXFCLFVBQUUsRUFBRXJCLEdBQUcsQ0FBQ3FCO0FBQXZCLE9BQVg7QUFDRCxLQUZNLE1BRUEsSUFBSXJCLEdBQUcsQ0FBQ0EsR0FBSixLQUFZLE1BQWhCLEVBQXdCLENBQzdCO0FBQ0QsS0FGTSxNQUVBLElBQ0wsQ0FBQyxPQUFELEVBQVUsU0FBVixFQUFxQixTQUFyQixFQUFnQyxPQUFoQyxFQUF5QyxTQUF6QyxFQUFvRHdMLFFBQXBELENBQTZEeEwsR0FBRyxDQUFDQSxHQUFqRSxDQURLLEVBRUw7QUFDQSxXQUFLb0gsY0FBTCxDQUFvQnBILEdBQXBCO0FBQ0QsS0FKTSxNQUlBLElBQUlBLEdBQUcsQ0FBQ0EsR0FBSixLQUFZLE9BQWhCLEVBQXlCO0FBQzlCLFdBQUswSixlQUFMLENBQXFCMUosR0FBckI7QUFDRCxLQUZNLE1BRUEsSUFBSUEsR0FBRyxDQUFDQSxHQUFKLEtBQVksUUFBaEIsRUFBMEI7QUFDL0IsV0FBSytKLGdCQUFMLENBQXNCL0osR0FBdEI7QUFDRCxLQUZNLE1BRUEsSUFBSUEsR0FBRyxDQUFDQSxHQUFKLEtBQVksT0FBaEIsRUFBeUI7QUFDOUIsV0FBSzBLLGVBQUwsQ0FBcUIxSyxHQUFyQjtBQUNELEtBRk0sTUFFQTtBQUNMdEcsWUFBTSxDQUFDMEIsTUFBUCxDQUFjLDBDQUFkLEVBQTBENEUsR0FBMUQ7QUFDRDtBQUNGOztBQUVEYixTQUFPLEdBQUc7QUFDUjtBQUNBO0FBQ0E7QUFDQSxVQUFNYSxHQUFHLEdBQUc7QUFBRUEsU0FBRyxFQUFFO0FBQVAsS0FBWjtBQUNBLFFBQUksS0FBS3ZELGNBQVQsRUFBeUJ1RCxHQUFHLENBQUMwRyxPQUFKLEdBQWMsS0FBS2pLLGNBQW5CO0FBQ3pCdUQsT0FBRyxDQUFDcUwsT0FBSixHQUFjLEtBQUszTyxrQkFBTCxJQUEyQixLQUFLSyxxQkFBTCxDQUEyQixDQUEzQixDQUF6QztBQUNBLFNBQUtMLGtCQUFMLEdBQTBCc0QsR0FBRyxDQUFDcUwsT0FBOUI7QUFDQXJMLE9BQUcsQ0FBQ3lMLE9BQUosR0FBYyxLQUFLMU8scUJBQW5COztBQUNBLFNBQUsvRCxLQUFMLENBQVdnSCxHQUFYLEVBVFEsQ0FXUjtBQUNBO0FBQ0E7QUFFQTtBQUNBOzs7QUFDQSxRQUFJLEtBQUs5Qyx3QkFBTCxDQUE4QjZDLE1BQTlCLEdBQXVDLENBQTNDLEVBQThDO0FBQzVDO0FBQ0E7QUFDQSxZQUFNaUssa0JBQWtCLEdBQUcsS0FBSzlNLHdCQUFMLENBQThCLENBQTlCLEVBQWlDMkYsT0FBNUQ7QUFDQSxXQUFLM0Ysd0JBQUwsQ0FBOEIsQ0FBOUIsRUFBaUMyRixPQUFqQyxHQUEyQ21ILGtCQUFrQixDQUFDMEIsTUFBbkIsQ0FDekNsSCxhQUFhLElBQUk7QUFDZjtBQUNBO0FBQ0EsWUFBSUEsYUFBYSxDQUFDM00sV0FBZCxJQUE2QjJNLGFBQWEsQ0FBQ2hNLE9BQS9DLEVBQXdEO0FBQ3REO0FBQ0FnTSx1QkFBYSxDQUFDckwsYUFBZCxDQUNFLElBQUlPLE1BQU0sQ0FBQ1osS0FBWCxDQUNFLG1CQURGLEVBRUUsb0VBQ0UsOERBSEosQ0FERjtBQU9ELFNBWmMsQ0FjZjtBQUNBO0FBQ0E7OztBQUNBLGVBQU8sRUFBRTBMLGFBQWEsQ0FBQzNNLFdBQWQsSUFBNkIyTSxhQUFhLENBQUNoTSxPQUE3QyxDQUFQO0FBQ0QsT0FuQndDLENBQTNDO0FBcUJELEtBMUNPLENBNENSO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFFQTtBQUNBOzs7QUFDQSxRQUNFLEtBQUswRSx3QkFBTCxDQUE4QjZDLE1BQTlCLEdBQXVDLENBQXZDLElBQ0EsS0FBSzdDLHdCQUFMLENBQThCLENBQTlCLEVBQWlDMkYsT0FBakMsQ0FBeUM5QyxNQUF6QyxLQUFvRCxDQUZ0RCxFQUdFO0FBQ0EsV0FBSzdDLHdCQUFMLENBQThCcU4sS0FBOUI7QUFDRCxLQTVETyxDQThEUjtBQUNBOzs7QUFDQXBRLFFBQUksQ0FBQyxLQUFLeEIsZUFBTixDQUFKLENBQTJCOEcsT0FBM0IsQ0FBbUM0QixFQUFFLElBQUk7QUFDdkMsV0FBSzFJLGVBQUwsQ0FBcUIwSSxFQUFyQixFQUF5QnhKLFdBQXpCLEdBQXVDLEtBQXZDO0FBQ0QsS0FGRCxFQWhFUSxDQW9FUjtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUNBLFNBQUsrUyxvREFBTCxHQXpFUSxDQTJFUjtBQUNBOzs7QUFDQXBQLFVBQU0sQ0FBQ3NILE9BQVAsQ0FBZSxLQUFLM0UsY0FBcEIsRUFBb0NzQixPQUFwQyxDQUE0QyxXQUFlO0FBQUEsVUFBZCxDQUFDNEIsRUFBRCxFQUFLSCxHQUFMLENBQWM7O0FBQ3pELFdBQUtsSSxLQUFMLENBQVc7QUFDVGdILFdBQUcsRUFBRSxLQURJO0FBRVRxQixVQUFFLEVBQUVBLEVBRks7QUFHVGhDLFlBQUksRUFBRTZCLEdBQUcsQ0FBQzdCLElBSEQ7QUFJVGUsY0FBTSxFQUFFYyxHQUFHLENBQUNkO0FBSkgsT0FBWDtBQU1ELEtBUEQ7QUFRRDs7QUFycURxQixDOzs7Ozs7Ozs7OztBQ2xEeEJoSixNQUFNLENBQUNHLE1BQVAsQ0FBYztBQUFDRCxLQUFHLEVBQUMsTUFBSUE7QUFBVCxDQUFkO0FBQTZCLElBQUlxQyxTQUFKO0FBQWN2QyxNQUFNLENBQUNDLElBQVAsQ0FBWSxtQkFBWixFQUFnQztBQUFDc0MsV0FBUyxDQUFDSCxDQUFELEVBQUc7QUFBQ0csYUFBUyxHQUFDSCxDQUFWO0FBQVk7O0FBQTFCLENBQWhDLEVBQTRELENBQTVEO0FBQStELElBQUlFLE1BQUo7QUFBV3RDLE1BQU0sQ0FBQ0MsSUFBUCxDQUFZLGVBQVosRUFBNEI7QUFBQ3FDLFFBQU0sQ0FBQ0YsQ0FBRCxFQUFHO0FBQUNFLFVBQU0sR0FBQ0YsQ0FBUDtBQUFTOztBQUFwQixDQUE1QixFQUFrRCxDQUFsRDtBQUFxRCxJQUFJVyxJQUFKO0FBQVMvQyxNQUFNLENBQUNDLElBQVAsQ0FBWSw0QkFBWixFQUF5QztBQUFDOEMsTUFBSSxDQUFDWCxDQUFELEVBQUc7QUFBQ1csUUFBSSxHQUFDWCxDQUFMO0FBQU87O0FBQWhCLENBQXpDLEVBQTJELENBQTNEO0FBQThELElBQUlDLFVBQUo7QUFBZXJDLE1BQU0sQ0FBQ0MsSUFBUCxDQUFZLDBCQUFaLEVBQXVDO0FBQUNvQyxZQUFVLENBQUNELENBQUQsRUFBRztBQUFDQyxjQUFVLEdBQUNELENBQVg7QUFBYTs7QUFBNUIsQ0FBdkMsRUFBcUUsQ0FBckU7QUFNaFE7QUFDQTtBQUNBO0FBQ0EsTUFBTW1TLGNBQWMsR0FBRyxFQUF2QjtBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUNPLE1BQU1yVSxHQUFHLEdBQUcsRUFBWjtBQUVQO0FBQ0E7QUFDQTtBQUNBQSxHQUFHLENBQUMyTCx3QkFBSixHQUErQixJQUFJdkosTUFBTSxDQUFDa1MsbUJBQVgsRUFBL0I7QUFDQXRVLEdBQUcsQ0FBQ3VVLDZCQUFKLEdBQW9DLElBQUluUyxNQUFNLENBQUNrUyxtQkFBWCxFQUFwQyxDLENBRUE7O0FBQ0F0VSxHQUFHLENBQUN3VSxrQkFBSixHQUF5QnhVLEdBQUcsQ0FBQzJMLHdCQUE3QixDLENBRUE7QUFDQTs7QUFDQSxTQUFTOEksMEJBQVQsQ0FBb0M1VCxPQUFwQyxFQUE2QztBQUMzQyxPQUFLQSxPQUFMLEdBQWVBLE9BQWY7QUFDRDs7QUFFRGIsR0FBRyxDQUFDOEUsZUFBSixHQUFzQjFDLE1BQU0sQ0FBQ3NTLGFBQVAsQ0FDcEIscUJBRG9CLEVBRXBCRCwwQkFGb0IsQ0FBdEI7QUFLQXpVLEdBQUcsQ0FBQzJVLG9CQUFKLEdBQTJCdlMsTUFBTSxDQUFDc1MsYUFBUCxDQUN6QiwwQkFEeUIsRUFFekIsTUFBTSxDQUFFLENBRmlCLENBQTNCLEMsQ0FLQTtBQUNBO0FBQ0E7O0FBQ0ExVSxHQUFHLENBQUM0VSxZQUFKLEdBQW1CN00sSUFBSSxJQUFJO0FBQ3pCLFFBQU04TSxLQUFLLEdBQUc3VSxHQUFHLENBQUMyTCx3QkFBSixDQUE2QkMsR0FBN0IsRUFBZDs7QUFDQSxTQUFPdkosU0FBUyxDQUFDeVMsWUFBVixDQUF1QmxKLEdBQXZCLENBQTJCaUosS0FBM0IsRUFBa0M5TSxJQUFsQyxDQUFQO0FBQ0QsQ0FIRCxDLENBS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQUNBL0gsR0FBRyxDQUFDK1UsT0FBSixHQUFjLENBQUN0UixHQUFELEVBQU1wRCxPQUFOLEtBQWtCO0FBQzlCLFFBQU0yVSxHQUFHLEdBQUcsSUFBSTdTLFVBQUosQ0FBZXNCLEdBQWYsRUFBb0JwRCxPQUFwQixDQUFaO0FBQ0FnVSxnQkFBYyxDQUFDbkosSUFBZixDQUFvQjhKLEdBQXBCLEVBRjhCLENBRUo7O0FBQzFCLFNBQU9BLEdBQVA7QUFDRCxDQUpEOztBQU1BaFYsR0FBRyxDQUFDd1QsY0FBSixHQUFxQixJQUFJL1EsSUFBSixDQUFTO0FBQUU2RCxpQkFBZSxFQUFFO0FBQW5CLENBQVQsQ0FBckI7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBQ0F0RyxHQUFHLENBQUMyRSxXQUFKLEdBQWtCbEUsUUFBUSxJQUFJVCxHQUFHLENBQUN3VCxjQUFKLENBQW1CeUIsUUFBbkIsQ0FBNEJ4VSxRQUE1QixDQUE5QixDLENBRUE7QUFDQTtBQUNBOzs7QUFDQVQsR0FBRyxDQUFDa1Ysc0JBQUosR0FBNkIsTUFBTWIsY0FBYyxDQUFDYyxLQUFmLENBQ2pDQyxJQUFJLElBQUlsUixNQUFNLENBQUN3RixNQUFQLENBQWMwTCxJQUFJLENBQUN2TyxjQUFuQixFQUFtQ3NPLEtBQW5DLENBQXlDdkwsR0FBRyxJQUFJQSxHQUFHLENBQUNJLEtBQXBELENBRHlCLENBQW5DLEMiLCJmaWxlIjoiL3BhY2thZ2VzL2RkcC1jbGllbnQuanMiLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgeyBERFAgfSBmcm9tICcuLi9jb21tb24vbmFtZXNwYWNlLmpzJztcbiIsIi8vIEEgTWV0aG9kSW52b2tlciBtYW5hZ2VzIHNlbmRpbmcgYSBtZXRob2QgdG8gdGhlIHNlcnZlciBhbmQgY2FsbGluZyB0aGUgdXNlcidzXG4vLyBjYWxsYmFja3MuIE9uIGNvbnN0cnVjdGlvbiwgaXQgcmVnaXN0ZXJzIGl0c2VsZiBpbiB0aGUgY29ubmVjdGlvbidzXG4vLyBfbWV0aG9kSW52b2tlcnMgbWFwOyBpdCByZW1vdmVzIGl0c2VsZiBvbmNlIHRoZSBtZXRob2QgaXMgZnVsbHkgZmluaXNoZWQgYW5kXG4vLyB0aGUgY2FsbGJhY2sgaXMgaW52b2tlZC4gVGhpcyBvY2N1cnMgd2hlbiBpdCBoYXMgYm90aCByZWNlaXZlZCBhIHJlc3VsdCxcbi8vIGFuZCB0aGUgZGF0YSB3cml0dGVuIGJ5IGl0IGlzIGZ1bGx5IHZpc2libGUuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBNZXRob2RJbnZva2VyIHtcbiAgY29uc3RydWN0b3Iob3B0aW9ucykge1xuICAgIC8vIFB1YmxpYyAod2l0aGluIHRoaXMgZmlsZSkgZmllbGRzLlxuICAgIHRoaXMubWV0aG9kSWQgPSBvcHRpb25zLm1ldGhvZElkO1xuICAgIHRoaXMuc2VudE1lc3NhZ2UgPSBmYWxzZTtcblxuICAgIHRoaXMuX2NhbGxiYWNrID0gb3B0aW9ucy5jYWxsYmFjaztcbiAgICB0aGlzLl9jb25uZWN0aW9uID0gb3B0aW9ucy5jb25uZWN0aW9uO1xuICAgIHRoaXMuX21lc3NhZ2UgPSBvcHRpb25zLm1lc3NhZ2U7XG4gICAgdGhpcy5fb25SZXN1bHRSZWNlaXZlZCA9IG9wdGlvbnMub25SZXN1bHRSZWNlaXZlZCB8fCAoKCkgPT4ge30pO1xuICAgIHRoaXMuX3dhaXQgPSBvcHRpb25zLndhaXQ7XG4gICAgdGhpcy5ub1JldHJ5ID0gb3B0aW9ucy5ub1JldHJ5O1xuICAgIHRoaXMuX21ldGhvZFJlc3VsdCA9IG51bGw7XG4gICAgdGhpcy5fZGF0YVZpc2libGUgPSBmYWxzZTtcblxuICAgIC8vIFJlZ2lzdGVyIHdpdGggdGhlIGNvbm5lY3Rpb24uXG4gICAgdGhpcy5fY29ubmVjdGlvbi5fbWV0aG9kSW52b2tlcnNbdGhpcy5tZXRob2RJZF0gPSB0aGlzO1xuICB9XG4gIC8vIFNlbmRzIHRoZSBtZXRob2QgbWVzc2FnZSB0byB0aGUgc2VydmVyLiBNYXkgYmUgY2FsbGVkIGFkZGl0aW9uYWwgdGltZXMgaWZcbiAgLy8gd2UgbG9zZSB0aGUgY29ubmVjdGlvbiBhbmQgcmVjb25uZWN0IGJlZm9yZSByZWNlaXZpbmcgYSByZXN1bHQuXG4gIHNlbmRNZXNzYWdlKCkge1xuICAgIC8vIFRoaXMgZnVuY3Rpb24gaXMgY2FsbGVkIGJlZm9yZSBzZW5kaW5nIGEgbWV0aG9kIChpbmNsdWRpbmcgcmVzZW5kaW5nIG9uXG4gICAgLy8gcmVjb25uZWN0KS4gV2Ugc2hvdWxkIG9ubHkgKHJlKXNlbmQgbWV0aG9kcyB3aGVyZSB3ZSBkb24ndCBhbHJlYWR5IGhhdmUgYVxuICAgIC8vIHJlc3VsdCFcbiAgICBpZiAodGhpcy5nb3RSZXN1bHQoKSlcbiAgICAgIHRocm93IG5ldyBFcnJvcignc2VuZGluZ01ldGhvZCBpcyBjYWxsZWQgb24gbWV0aG9kIHdpdGggcmVzdWx0Jyk7XG5cbiAgICAvLyBJZiB3ZSdyZSByZS1zZW5kaW5nIGl0LCBpdCBkb2Vzbid0IG1hdHRlciBpZiBkYXRhIHdhcyB3cml0dGVuIHRoZSBmaXJzdFxuICAgIC8vIHRpbWUuXG4gICAgdGhpcy5fZGF0YVZpc2libGUgPSBmYWxzZTtcbiAgICB0aGlzLnNlbnRNZXNzYWdlID0gdHJ1ZTtcblxuICAgIC8vIElmIHRoaXMgaXMgYSB3YWl0IG1ldGhvZCwgbWFrZSBhbGwgZGF0YSBtZXNzYWdlcyBiZSBidWZmZXJlZCB1bnRpbCBpdCBpc1xuICAgIC8vIGRvbmUuXG4gICAgaWYgKHRoaXMuX3dhaXQpXG4gICAgICB0aGlzLl9jb25uZWN0aW9uLl9tZXRob2RzQmxvY2tpbmdRdWllc2NlbmNlW3RoaXMubWV0aG9kSWRdID0gdHJ1ZTtcblxuICAgIC8vIEFjdHVhbGx5IHNlbmQgdGhlIG1lc3NhZ2UuXG4gICAgdGhpcy5fY29ubmVjdGlvbi5fc2VuZCh0aGlzLl9tZXNzYWdlKTtcbiAgfVxuICAvLyBJbnZva2UgdGhlIGNhbGxiYWNrLCBpZiB3ZSBoYXZlIGJvdGggYSByZXN1bHQgYW5kIGtub3cgdGhhdCBhbGwgZGF0YSBoYXNcbiAgLy8gYmVlbiB3cml0dGVuIHRvIHRoZSBsb2NhbCBjYWNoZS5cbiAgX21heWJlSW52b2tlQ2FsbGJhY2soKSB7XG4gICAgaWYgKHRoaXMuX21ldGhvZFJlc3VsdCAmJiB0aGlzLl9kYXRhVmlzaWJsZSkge1xuICAgICAgLy8gQ2FsbCB0aGUgY2FsbGJhY2suIChUaGlzIHdvbid0IHRocm93OiB0aGUgY2FsbGJhY2sgd2FzIHdyYXBwZWQgd2l0aFxuICAgICAgLy8gYmluZEVudmlyb25tZW50LilcbiAgICAgIHRoaXMuX2NhbGxiYWNrKHRoaXMuX21ldGhvZFJlc3VsdFswXSwgdGhpcy5fbWV0aG9kUmVzdWx0WzFdKTtcblxuICAgICAgLy8gRm9yZ2V0IGFib3V0IHRoaXMgbWV0aG9kLlxuICAgICAgZGVsZXRlIHRoaXMuX2Nvbm5lY3Rpb24uX21ldGhvZEludm9rZXJzW3RoaXMubWV0aG9kSWRdO1xuXG4gICAgICAvLyBMZXQgdGhlIGNvbm5lY3Rpb24ga25vdyB0aGF0IHRoaXMgbWV0aG9kIGlzIGZpbmlzaGVkLCBzbyBpdCBjYW4gdHJ5IHRvXG4gICAgICAvLyBtb3ZlIG9uIHRvIHRoZSBuZXh0IGJsb2NrIG9mIG1ldGhvZHMuXG4gICAgICB0aGlzLl9jb25uZWN0aW9uLl9vdXRzdGFuZGluZ01ldGhvZEZpbmlzaGVkKCk7XG4gICAgfVxuICB9XG4gIC8vIENhbGwgd2l0aCB0aGUgcmVzdWx0IG9mIHRoZSBtZXRob2QgZnJvbSB0aGUgc2VydmVyLiBPbmx5IG1heSBiZSBjYWxsZWRcbiAgLy8gb25jZTsgb25jZSBpdCBpcyBjYWxsZWQsIHlvdSBzaG91bGQgbm90IGNhbGwgc2VuZE1lc3NhZ2UgYWdhaW4uXG4gIC8vIElmIHRoZSB1c2VyIHByb3ZpZGVkIGFuIG9uUmVzdWx0UmVjZWl2ZWQgY2FsbGJhY2ssIGNhbGwgaXQgaW1tZWRpYXRlbHkuXG4gIC8vIFRoZW4gaW52b2tlIHRoZSBtYWluIGNhbGxiYWNrIGlmIGRhdGEgaXMgYWxzbyB2aXNpYmxlLlxuICByZWNlaXZlUmVzdWx0KGVyciwgcmVzdWx0KSB7XG4gICAgaWYgKHRoaXMuZ290UmVzdWx0KCkpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZHMgc2hvdWxkIG9ubHkgcmVjZWl2ZSByZXN1bHRzIG9uY2UnKTtcbiAgICB0aGlzLl9tZXRob2RSZXN1bHQgPSBbZXJyLCByZXN1bHRdO1xuICAgIHRoaXMuX29uUmVzdWx0UmVjZWl2ZWQoZXJyLCByZXN1bHQpO1xuICAgIHRoaXMuX21heWJlSW52b2tlQ2FsbGJhY2soKTtcbiAgfVxuICAvLyBDYWxsIHRoaXMgd2hlbiBhbGwgZGF0YSB3cml0dGVuIGJ5IHRoZSBtZXRob2QgaXMgdmlzaWJsZS4gVGhpcyBtZWFucyB0aGF0XG4gIC8vIHRoZSBtZXRob2QgaGFzIHJldHVybnMgaXRzIFwiZGF0YSBpcyBkb25lXCIgbWVzc2FnZSAqQU5EKiBhbGwgc2VydmVyXG4gIC8vIGRvY3VtZW50cyB0aGF0IGFyZSBidWZmZXJlZCBhdCB0aGF0IHRpbWUgaGF2ZSBiZWVuIHdyaXR0ZW4gdG8gdGhlIGxvY2FsXG4gIC8vIGNhY2hlLiBJbnZva2VzIHRoZSBtYWluIGNhbGxiYWNrIGlmIHRoZSByZXN1bHQgaGFzIGJlZW4gcmVjZWl2ZWQuXG4gIGRhdGFWaXNpYmxlKCkge1xuICAgIHRoaXMuX2RhdGFWaXNpYmxlID0gdHJ1ZTtcbiAgICB0aGlzLl9tYXliZUludm9rZUNhbGxiYWNrKCk7XG4gIH1cbiAgLy8gVHJ1ZSBpZiByZWNlaXZlUmVzdWx0IGhhcyBiZWVuIGNhbGxlZC5cbiAgZ290UmVzdWx0KCkge1xuICAgIHJldHVybiAhIXRoaXMuX21ldGhvZFJlc3VsdDtcbiAgfVxufVxuIiwiaW1wb3J0IHsgTWV0ZW9yIH0gZnJvbSAnbWV0ZW9yL21ldGVvcic7XG5pbXBvcnQgeyBERFBDb21tb24gfSBmcm9tICdtZXRlb3IvZGRwLWNvbW1vbic7XG5pbXBvcnQgeyBUcmFja2VyIH0gZnJvbSAnbWV0ZW9yL3RyYWNrZXInO1xuaW1wb3J0IHsgRUpTT04gfSBmcm9tICdtZXRlb3IvZWpzb24nO1xuaW1wb3J0IHsgUmFuZG9tIH0gZnJvbSAnbWV0ZW9yL3JhbmRvbSc7XG5pbXBvcnQgeyBIb29rIH0gZnJvbSAnbWV0ZW9yL2NhbGxiYWNrLWhvb2snO1xuaW1wb3J0IHsgTW9uZ29JRCB9IGZyb20gJ21ldGVvci9tb25nby1pZCc7XG5pbXBvcnQgeyBERFAgfSBmcm9tICcuL25hbWVzcGFjZS5qcyc7XG5pbXBvcnQgTWV0aG9kSW52b2tlciBmcm9tICcuL01ldGhvZEludm9rZXIuanMnO1xuaW1wb3J0IHtcbiAgaGFzT3duLFxuICBzbGljZSxcbiAga2V5cyxcbiAgaXNFbXB0eSxcbiAgbGFzdCxcbn0gZnJvbSBcIm1ldGVvci9kZHAtY29tbW9uL3V0aWxzLmpzXCI7XG5cbmxldCBGaWJlcjtcbmxldCBGdXR1cmU7XG5pZiAoTWV0ZW9yLmlzU2VydmVyKSB7XG4gIEZpYmVyID0gTnBtLnJlcXVpcmUoJ2ZpYmVycycpO1xuICBGdXR1cmUgPSBOcG0ucmVxdWlyZSgnZmliZXJzL2Z1dHVyZScpO1xufVxuXG5jbGFzcyBNb25nb0lETWFwIGV4dGVuZHMgSWRNYXAge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihNb25nb0lELmlkU3RyaW5naWZ5LCBNb25nb0lELmlkUGFyc2UpO1xuICB9XG59XG5cbi8vIEBwYXJhbSB1cmwge1N0cmluZ3xPYmplY3R9IFVSTCB0byBNZXRlb3IgYXBwLFxuLy8gICBvciBhbiBvYmplY3QgYXMgYSB0ZXN0IGhvb2sgKHNlZSBjb2RlKVxuLy8gT3B0aW9uczpcbi8vICAgcmVsb2FkV2l0aE91dHN0YW5kaW5nOiBpcyBpdCBPSyB0byByZWxvYWQgaWYgdGhlcmUgYXJlIG91dHN0YW5kaW5nIG1ldGhvZHM/XG4vLyAgIGhlYWRlcnM6IGV4dHJhIGhlYWRlcnMgdG8gc2VuZCBvbiB0aGUgd2Vic29ja2V0cyBjb25uZWN0aW9uLCBmb3Jcbi8vICAgICBzZXJ2ZXItdG8tc2VydmVyIEREUCBvbmx5XG4vLyAgIF9zb2NranNPcHRpb25zOiBTcGVjaWZpZXMgb3B0aW9ucyB0byBwYXNzIHRocm91Z2ggdG8gdGhlIHNvY2tqcyBjbGllbnRcbi8vICAgb25ERFBOZWdvdGlhdGlvblZlcnNpb25GYWlsdXJlOiBjYWxsYmFjayB3aGVuIHZlcnNpb24gbmVnb3RpYXRpb24gZmFpbHMuXG4vL1xuLy8gWFhYIFRoZXJlIHNob3VsZCBiZSBhIHdheSB0byBkZXN0cm95IGEgRERQIGNvbm5lY3Rpb24sIGNhdXNpbmcgYWxsXG4vLyBvdXRzdGFuZGluZyBtZXRob2QgY2FsbHMgdG8gZmFpbC5cbi8vXG4vLyBYWFggT3VyIGN1cnJlbnQgd2F5IG9mIGhhbmRsaW5nIGZhaWx1cmUgYW5kIHJlY29ubmVjdGlvbiBpcyBncmVhdFxuLy8gZm9yIGFuIGFwcCAod2hlcmUgd2Ugd2FudCB0byB0b2xlcmF0ZSBiZWluZyBkaXNjb25uZWN0ZWQgYXMgYW5cbi8vIGV4cGVjdCBzdGF0ZSwgYW5kIGtlZXAgdHJ5aW5nIGZvcmV2ZXIgdG8gcmVjb25uZWN0KSBidXQgY3VtYmVyc29tZVxuLy8gZm9yIHNvbWV0aGluZyBsaWtlIGEgY29tbWFuZCBsaW5lIHRvb2wgdGhhdCB3YW50cyB0byBtYWtlIGFcbi8vIGNvbm5lY3Rpb24sIGNhbGwgYSBtZXRob2QsIGFuZCBwcmludCBhbiBlcnJvciBpZiBjb25uZWN0aW9uXG4vLyBmYWlscy4gV2Ugc2hvdWxkIGhhdmUgYmV0dGVyIHVzYWJpbGl0eSBpbiB0aGUgbGF0dGVyIGNhc2UgKHdoaWxlXG4vLyBzdGlsbCB0cmFuc3BhcmVudGx5IHJlY29ubmVjdGluZyBpZiBpdCdzIGp1c3QgYSB0cmFuc2llbnQgZmFpbHVyZVxuLy8gb3IgdGhlIHNlcnZlciBtaWdyYXRpbmcgdXMpLlxuZXhwb3J0IGNsYXNzIENvbm5lY3Rpb24ge1xuICBjb25zdHJ1Y3Rvcih1cmwsIG9wdGlvbnMpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcblxuICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnMgPSB7XG4gICAgICBvbkNvbm5lY3RlZCgpIHt9LFxuICAgICAgb25ERFBWZXJzaW9uTmVnb3RpYXRpb25GYWlsdXJlKGRlc2NyaXB0aW9uKSB7XG4gICAgICAgIE1ldGVvci5fZGVidWcoZGVzY3JpcHRpb24pO1xuICAgICAgfSxcbiAgICAgIGhlYXJ0YmVhdEludGVydmFsOiAxNzUwMCxcbiAgICAgIGhlYXJ0YmVhdFRpbWVvdXQ6IDE1MDAwLFxuICAgICAgbnBtRmF5ZU9wdGlvbnM6IE9iamVjdC5jcmVhdGUobnVsbCksXG4gICAgICAvLyBUaGVzZSBvcHRpb25zIGFyZSBvbmx5IGZvciB0ZXN0aW5nLlxuICAgICAgcmVsb2FkV2l0aE91dHN0YW5kaW5nOiBmYWxzZSxcbiAgICAgIHN1cHBvcnRlZEREUFZlcnNpb25zOiBERFBDb21tb24uU1VQUE9SVEVEX0REUF9WRVJTSU9OUyxcbiAgICAgIHJldHJ5OiB0cnVlLFxuICAgICAgcmVzcG9uZFRvUGluZ3M6IHRydWUsXG4gICAgICAvLyBXaGVuIHVwZGF0ZXMgYXJlIGNvbWluZyB3aXRoaW4gdGhpcyBtcyBpbnRlcnZhbCwgYmF0Y2ggdGhlbSB0b2dldGhlci5cbiAgICAgIGJ1ZmZlcmVkV3JpdGVzSW50ZXJ2YWw6IDUsXG4gICAgICAvLyBGbHVzaCBidWZmZXJzIGltbWVkaWF0ZWx5IGlmIHdyaXRlcyBhcmUgaGFwcGVuaW5nIGNvbnRpbnVvdXNseSBmb3IgbW9yZSB0aGFuIHRoaXMgbWFueSBtcy5cbiAgICAgIGJ1ZmZlcmVkV3JpdGVzTWF4QWdlOiA1MDAsXG5cbiAgICAgIC4uLm9wdGlvbnNcbiAgICB9O1xuXG4gICAgLy8gSWYgc2V0LCBjYWxsZWQgd2hlbiB3ZSByZWNvbm5lY3QsIHF1ZXVpbmcgbWV0aG9kIGNhbGxzIF9iZWZvcmVfIHRoZVxuICAgIC8vIGV4aXN0aW5nIG91dHN0YW5kaW5nIG9uZXMuXG4gICAgLy8gTk9URTogVGhpcyBmZWF0dXJlIGhhcyBiZWVuIHByZXNlcnZlZCBmb3IgYmFja3dhcmRzIGNvbXBhdGliaWxpdHkuIFRoZVxuICAgIC8vIHByZWZlcnJlZCBtZXRob2Qgb2Ygc2V0dGluZyBhIGNhbGxiYWNrIG9uIHJlY29ubmVjdCBpcyB0byB1c2VcbiAgICAvLyBERFAub25SZWNvbm5lY3QuXG4gICAgc2VsZi5vblJlY29ubmVjdCA9IG51bGw7XG5cbiAgICAvLyBhcyBhIHRlc3QgaG9vaywgYWxsb3cgcGFzc2luZyBhIHN0cmVhbSBpbnN0ZWFkIG9mIGEgdXJsLlxuICAgIGlmICh0eXBlb2YgdXJsID09PSAnb2JqZWN0Jykge1xuICAgICAgc2VsZi5fc3RyZWFtID0gdXJsO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCB7IENsaWVudFN0cmVhbSB9ID0gcmVxdWlyZShcIm1ldGVvci9zb2NrZXQtc3RyZWFtLWNsaWVudFwiKTtcbiAgICAgIHNlbGYuX3N0cmVhbSA9IG5ldyBDbGllbnRTdHJlYW0odXJsLCB7XG4gICAgICAgIHJldHJ5OiBvcHRpb25zLnJldHJ5LFxuICAgICAgICBDb25uZWN0aW9uRXJyb3I6IEREUC5Db25uZWN0aW9uRXJyb3IsXG4gICAgICAgIGhlYWRlcnM6IG9wdGlvbnMuaGVhZGVycyxcbiAgICAgICAgX3NvY2tqc09wdGlvbnM6IG9wdGlvbnMuX3NvY2tqc09wdGlvbnMsXG4gICAgICAgIC8vIFVzZWQgdG8ga2VlcCBzb21lIHRlc3RzIHF1aWV0LCBvciBmb3Igb3RoZXIgY2FzZXMgaW4gd2hpY2hcbiAgICAgICAgLy8gdGhlIHJpZ2h0IHRoaW5nIHRvIGRvIHdpdGggY29ubmVjdGlvbiBlcnJvcnMgaXMgdG8gc2lsZW50bHlcbiAgICAgICAgLy8gZmFpbCAoZS5nLiBzZW5kaW5nIHBhY2thZ2UgdXNhZ2Ugc3RhdHMpLiBBdCBzb21lIHBvaW50IHdlXG4gICAgICAgIC8vIHNob3VsZCBoYXZlIGEgcmVhbCBBUEkgZm9yIGhhbmRsaW5nIGNsaWVudC1zdHJlYW0tbGV2ZWxcbiAgICAgICAgLy8gZXJyb3JzLlxuICAgICAgICBfZG9udFByaW50RXJyb3JzOiBvcHRpb25zLl9kb250UHJpbnRFcnJvcnMsXG4gICAgICAgIGNvbm5lY3RUaW1lb3V0TXM6IG9wdGlvbnMuY29ubmVjdFRpbWVvdXRNcyxcbiAgICAgICAgbnBtRmF5ZU9wdGlvbnM6IG9wdGlvbnMubnBtRmF5ZU9wdGlvbnNcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHNlbGYuX2xhc3RTZXNzaW9uSWQgPSBudWxsO1xuICAgIHNlbGYuX3ZlcnNpb25TdWdnZXN0aW9uID0gbnVsbDsgLy8gVGhlIGxhc3QgcHJvcG9zZWQgRERQIHZlcnNpb24uXG4gICAgc2VsZi5fdmVyc2lvbiA9IG51bGw7IC8vIFRoZSBERFAgdmVyc2lvbiBhZ3JlZWQgb24gYnkgY2xpZW50IGFuZCBzZXJ2ZXIuXG4gICAgc2VsZi5fc3RvcmVzID0gT2JqZWN0LmNyZWF0ZShudWxsKTsgLy8gbmFtZSAtPiBvYmplY3Qgd2l0aCBtZXRob2RzXG4gICAgc2VsZi5fbWV0aG9kSGFuZGxlcnMgPSBPYmplY3QuY3JlYXRlKG51bGwpOyAvLyBuYW1lIC0+IGZ1bmNcbiAgICBzZWxmLl9uZXh0TWV0aG9kSWQgPSAxO1xuICAgIHNlbGYuX3N1cHBvcnRlZEREUFZlcnNpb25zID0gb3B0aW9ucy5zdXBwb3J0ZWRERFBWZXJzaW9ucztcblxuICAgIHNlbGYuX2hlYXJ0YmVhdEludGVydmFsID0gb3B0aW9ucy5oZWFydGJlYXRJbnRlcnZhbDtcbiAgICBzZWxmLl9oZWFydGJlYXRUaW1lb3V0ID0gb3B0aW9ucy5oZWFydGJlYXRUaW1lb3V0O1xuXG4gICAgLy8gVHJhY2tzIG1ldGhvZHMgd2hpY2ggdGhlIHVzZXIgaGFzIHRyaWVkIHRvIGNhbGwgYnV0IHdoaWNoIGhhdmUgbm90IHlldFxuICAgIC8vIGNhbGxlZCB0aGVpciB1c2VyIGNhbGxiYWNrIChpZSwgdGhleSBhcmUgd2FpdGluZyBvbiB0aGVpciByZXN1bHQgb3IgZm9yIGFsbFxuICAgIC8vIG9mIHRoZWlyIHdyaXRlcyB0byBiZSB3cml0dGVuIHRvIHRoZSBsb2NhbCBjYWNoZSkuIE1hcCBmcm9tIG1ldGhvZCBJRCB0b1xuICAgIC8vIE1ldGhvZEludm9rZXIgb2JqZWN0LlxuICAgIHNlbGYuX21ldGhvZEludm9rZXJzID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblxuICAgIC8vIFRyYWNrcyBtZXRob2RzIHdoaWNoIHRoZSB1c2VyIGhhcyBjYWxsZWQgYnV0IHdob3NlIHJlc3VsdCBtZXNzYWdlcyBoYXZlIG5vdFxuICAgIC8vIGFycml2ZWQgeWV0LlxuICAgIC8vXG4gICAgLy8gX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzIGlzIGFuIGFycmF5IG9mIGJsb2NrcyBvZiBtZXRob2RzLiBFYWNoIGJsb2NrXG4gICAgLy8gcmVwcmVzZW50cyBhIHNldCBvZiBtZXRob2RzIHRoYXQgY2FuIHJ1biBhdCB0aGUgc2FtZSB0aW1lLiBUaGUgZmlyc3QgYmxvY2tcbiAgICAvLyByZXByZXNlbnRzIHRoZSBtZXRob2RzIHdoaWNoIGFyZSBjdXJyZW50bHkgaW4gZmxpZ2h0OyBzdWJzZXF1ZW50IGJsb2Nrc1xuICAgIC8vIG11c3Qgd2FpdCBmb3IgcHJldmlvdXMgYmxvY2tzIHRvIGJlIGZ1bGx5IGZpbmlzaGVkIGJlZm9yZSB0aGV5IGNhbiBiZSBzZW50XG4gICAgLy8gdG8gdGhlIHNlcnZlci5cbiAgICAvL1xuICAgIC8vIEVhY2ggYmxvY2sgaXMgYW4gb2JqZWN0IHdpdGggdGhlIGZvbGxvd2luZyBmaWVsZHM6XG4gICAgLy8gLSBtZXRob2RzOiBhIGxpc3Qgb2YgTWV0aG9kSW52b2tlciBvYmplY3RzXG4gICAgLy8gLSB3YWl0OiBhIGJvb2xlYW47IGlmIHRydWUsIHRoaXMgYmxvY2sgaGFkIGEgc2luZ2xlIG1ldGhvZCBpbnZva2VkIHdpdGhcbiAgICAvLyAgICAgICAgIHRoZSBcIndhaXRcIiBvcHRpb25cbiAgICAvL1xuICAgIC8vIFRoZXJlIHdpbGwgbmV2ZXIgYmUgYWRqYWNlbnQgYmxvY2tzIHdpdGggd2FpdD1mYWxzZSwgYmVjYXVzZSB0aGUgb25seSB0aGluZ1xuICAgIC8vIHRoYXQgbWFrZXMgbWV0aG9kcyBuZWVkIHRvIGJlIHNlcmlhbGl6ZWQgaXMgYSB3YWl0IG1ldGhvZC5cbiAgICAvL1xuICAgIC8vIE1ldGhvZHMgYXJlIHJlbW92ZWQgZnJvbSB0aGUgZmlyc3QgYmxvY2sgd2hlbiB0aGVpciBcInJlc3VsdFwiIGlzXG4gICAgLy8gcmVjZWl2ZWQuIFRoZSBlbnRpcmUgZmlyc3QgYmxvY2sgaXMgb25seSByZW1vdmVkIHdoZW4gYWxsIG9mIHRoZSBpbi1mbGlnaHRcbiAgICAvLyBtZXRob2RzIGhhdmUgcmVjZWl2ZWQgdGhlaXIgcmVzdWx0cyAoc28gdGhlIFwibWV0aG9kc1wiIGxpc3QgaXMgZW1wdHkpICpBTkQqXG4gICAgLy8gYWxsIG9mIHRoZSBkYXRhIHdyaXR0ZW4gYnkgdGhvc2UgbWV0aG9kcyBhcmUgdmlzaWJsZSBpbiB0aGUgbG9jYWwgY2FjaGUuIFNvXG4gICAgLy8gaXQgaXMgcG9zc2libGUgZm9yIHRoZSBmaXJzdCBibG9jaydzIG1ldGhvZHMgbGlzdCB0byBiZSBlbXB0eSwgaWYgd2UgYXJlXG4gICAgLy8gc3RpbGwgd2FpdGluZyBmb3Igc29tZSBvYmplY3RzIHRvIHF1aWVzY2UuXG4gICAgLy9cbiAgICAvLyBFeGFtcGxlOlxuICAgIC8vICBfb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MgPSBbXG4gICAgLy8gICAge3dhaXQ6IGZhbHNlLCBtZXRob2RzOiBbXX0sXG4gICAgLy8gICAge3dhaXQ6IHRydWUsIG1ldGhvZHM6IFs8TWV0aG9kSW52b2tlciBmb3IgJ2xvZ2luJz5dfSxcbiAgICAvLyAgICB7d2FpdDogZmFsc2UsIG1ldGhvZHM6IFs8TWV0aG9kSW52b2tlciBmb3IgJ2Zvbyc+LFxuICAgIC8vICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxNZXRob2RJbnZva2VyIGZvciAnYmFyJz5dfV1cbiAgICAvLyBUaGlzIG1lYW5zIHRoYXQgdGhlcmUgd2VyZSBzb21lIG1ldGhvZHMgd2hpY2ggd2VyZSBzZW50IHRvIHRoZSBzZXJ2ZXIgYW5kXG4gICAgLy8gd2hpY2ggaGF2ZSByZXR1cm5lZCB0aGVpciByZXN1bHRzLCBidXQgc29tZSBvZiB0aGUgZGF0YSB3cml0dGVuIGJ5XG4gICAgLy8gdGhlIG1ldGhvZHMgbWF5IG5vdCBiZSB2aXNpYmxlIGluIHRoZSBsb2NhbCBjYWNoZS4gT25jZSBhbGwgdGhhdCBkYXRhIGlzXG4gICAgLy8gdmlzaWJsZSwgd2Ugd2lsbCBzZW5kIGEgJ2xvZ2luJyBtZXRob2QuIE9uY2UgdGhlIGxvZ2luIG1ldGhvZCBoYXMgcmV0dXJuZWRcbiAgICAvLyBhbmQgYWxsIHRoZSBkYXRhIGlzIHZpc2libGUgKGluY2x1ZGluZyByZS1ydW5uaW5nIHN1YnMgaWYgdXNlcklkIGNoYW5nZXMpLFxuICAgIC8vIHdlIHdpbGwgc2VuZCB0aGUgJ2ZvbycgYW5kICdiYXInIG1ldGhvZHMgaW4gcGFyYWxsZWwuXG4gICAgc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MgPSBbXTtcblxuICAgIC8vIG1ldGhvZCBJRCAtPiBhcnJheSBvZiBvYmplY3RzIHdpdGgga2V5cyAnY29sbGVjdGlvbicgYW5kICdpZCcsIGxpc3RpbmdcbiAgICAvLyBkb2N1bWVudHMgd3JpdHRlbiBieSBhIGdpdmVuIG1ldGhvZCdzIHN0dWIuIGtleXMgYXJlIGFzc29jaWF0ZWQgd2l0aFxuICAgIC8vIG1ldGhvZHMgd2hvc2Ugc3R1YiB3cm90ZSBhdCBsZWFzdCBvbmUgZG9jdW1lbnQsIGFuZCB3aG9zZSBkYXRhLWRvbmUgbWVzc2FnZVxuICAgIC8vIGhhcyBub3QgeWV0IGJlZW4gcmVjZWl2ZWQuXG4gICAgc2VsZi5fZG9jdW1lbnRzV3JpdHRlbkJ5U3R1YiA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gICAgLy8gY29sbGVjdGlvbiAtPiBJZE1hcCBvZiBcInNlcnZlciBkb2N1bWVudFwiIG9iamVjdC4gQSBcInNlcnZlciBkb2N1bWVudFwiIGhhczpcbiAgICAvLyAtIFwiZG9jdW1lbnRcIjogdGhlIHZlcnNpb24gb2YgdGhlIGRvY3VtZW50IGFjY29yZGluZyB0aGVcbiAgICAvLyAgIHNlcnZlciAoaWUsIHRoZSBzbmFwc2hvdCBiZWZvcmUgYSBzdHViIHdyb3RlIGl0LCBhbWVuZGVkIGJ5IGFueSBjaGFuZ2VzXG4gICAgLy8gICByZWNlaXZlZCBmcm9tIHRoZSBzZXJ2ZXIpXG4gICAgLy8gICBJdCBpcyB1bmRlZmluZWQgaWYgd2UgdGhpbmsgdGhlIGRvY3VtZW50IGRvZXMgbm90IGV4aXN0XG4gICAgLy8gLSBcIndyaXR0ZW5CeVN0dWJzXCI6IGEgc2V0IG9mIG1ldGhvZCBJRHMgd2hvc2Ugc3R1YnMgd3JvdGUgdG8gdGhlIGRvY3VtZW50XG4gICAgLy8gICB3aG9zZSBcImRhdGEgZG9uZVwiIG1lc3NhZ2VzIGhhdmUgbm90IHlldCBiZWVuIHByb2Nlc3NlZFxuICAgIHNlbGYuX3NlcnZlckRvY3VtZW50cyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cbiAgICAvLyBBcnJheSBvZiBjYWxsYmFja3MgdG8gYmUgY2FsbGVkIGFmdGVyIHRoZSBuZXh0IHVwZGF0ZSBvZiB0aGUgbG9jYWxcbiAgICAvLyBjYWNoZS4gVXNlZCBmb3I6XG4gICAgLy8gIC0gQ2FsbGluZyBtZXRob2RJbnZva2VyLmRhdGFWaXNpYmxlIGFuZCBzdWIgcmVhZHkgY2FsbGJhY2tzIGFmdGVyXG4gICAgLy8gICAgdGhlIHJlbGV2YW50IGRhdGEgaXMgZmx1c2hlZC5cbiAgICAvLyAgLSBJbnZva2luZyB0aGUgY2FsbGJhY2tzIG9mIFwiaGFsZi1maW5pc2hlZFwiIG1ldGhvZHMgYWZ0ZXIgcmVjb25uZWN0XG4gICAgLy8gICAgcXVpZXNjZW5jZS4gU3BlY2lmaWNhbGx5LCBtZXRob2RzIHdob3NlIHJlc3VsdCB3YXMgcmVjZWl2ZWQgb3ZlciB0aGUgb2xkXG4gICAgLy8gICAgY29ubmVjdGlvbiAoc28gd2UgZG9uJ3QgcmUtc2VuZCBpdCkgYnV0IHdob3NlIGRhdGEgaGFkIG5vdCBiZWVuIG1hZGVcbiAgICAvLyAgICB2aXNpYmxlLlxuICAgIHNlbGYuX2FmdGVyVXBkYXRlQ2FsbGJhY2tzID0gW107XG5cbiAgICAvLyBJbiB0d28gY29udGV4dHMsIHdlIGJ1ZmZlciBhbGwgaW5jb21pbmcgZGF0YSBtZXNzYWdlcyBhbmQgdGhlbiBwcm9jZXNzIHRoZW1cbiAgICAvLyBhbGwgYXQgb25jZSBpbiBhIHNpbmdsZSB1cGRhdGU6XG4gICAgLy8gICAtIER1cmluZyByZWNvbm5lY3QsIHdlIGJ1ZmZlciBhbGwgZGF0YSBtZXNzYWdlcyB1bnRpbCBhbGwgc3VicyB0aGF0IGhhZFxuICAgIC8vICAgICBiZWVuIHJlYWR5IGJlZm9yZSByZWNvbm5lY3QgYXJlIHJlYWR5IGFnYWluLCBhbmQgYWxsIG1ldGhvZHMgdGhhdCBhcmVcbiAgICAvLyAgICAgYWN0aXZlIGhhdmUgcmV0dXJuZWQgdGhlaXIgXCJkYXRhIGRvbmUgbWVzc2FnZVwiOyB0aGVuXG4gICAgLy8gICAtIER1cmluZyB0aGUgZXhlY3V0aW9uIG9mIGEgXCJ3YWl0XCIgbWV0aG9kLCB3ZSBidWZmZXIgYWxsIGRhdGEgbWVzc2FnZXNcbiAgICAvLyAgICAgdW50aWwgdGhlIHdhaXQgbWV0aG9kIGdldHMgaXRzIFwiZGF0YSBkb25lXCIgbWVzc2FnZS4gKElmIHRoZSB3YWl0IG1ldGhvZFxuICAgIC8vICAgICBvY2N1cnMgZHVyaW5nIHJlY29ubmVjdCwgaXQgZG9lc24ndCBnZXQgYW55IHNwZWNpYWwgaGFuZGxpbmcuKVxuICAgIC8vIGFsbCBkYXRhIG1lc3NhZ2VzIGFyZSBwcm9jZXNzZWQgaW4gb25lIHVwZGF0ZS5cbiAgICAvL1xuICAgIC8vIFRoZSBmb2xsb3dpbmcgZmllbGRzIGFyZSB1c2VkIGZvciB0aGlzIFwicXVpZXNjZW5jZVwiIHByb2Nlc3MuXG5cbiAgICAvLyBUaGlzIGJ1ZmZlcnMgdGhlIG1lc3NhZ2VzIHRoYXQgYXJlbid0IGJlaW5nIHByb2Nlc3NlZCB5ZXQuXG4gICAgc2VsZi5fbWVzc2FnZXNCdWZmZXJlZFVudGlsUXVpZXNjZW5jZSA9IFtdO1xuICAgIC8vIE1hcCBmcm9tIG1ldGhvZCBJRCAtPiB0cnVlLiBNZXRob2RzIGFyZSByZW1vdmVkIGZyb20gdGhpcyB3aGVuIHRoZWlyXG4gICAgLy8gXCJkYXRhIGRvbmVcIiBtZXNzYWdlIGlzIHJlY2VpdmVkLCBhbmQgd2Ugd2lsbCBub3QgcXVpZXNjZSB1bnRpbCBpdCBpc1xuICAgIC8vIGVtcHR5LlxuICAgIHNlbGYuX21ldGhvZHNCbG9ja2luZ1F1aWVzY2VuY2UgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICAgIC8vIG1hcCBmcm9tIHN1YiBJRCAtPiB0cnVlIGZvciBzdWJzIHRoYXQgd2VyZSByZWFkeSAoaWUsIGNhbGxlZCB0aGUgc3ViXG4gICAgLy8gcmVhZHkgY2FsbGJhY2spIGJlZm9yZSByZWNvbm5lY3QgYnV0IGhhdmVuJ3QgYmVjb21lIHJlYWR5IGFnYWluIHlldFxuICAgIHNlbGYuX3N1YnNCZWluZ1Jldml2ZWQgPSBPYmplY3QuY3JlYXRlKG51bGwpOyAvLyBtYXAgZnJvbSBzdWIuX2lkIC0+IHRydWVcbiAgICAvLyBpZiB0cnVlLCB0aGUgbmV4dCBkYXRhIHVwZGF0ZSBzaG91bGQgcmVzZXQgYWxsIHN0b3Jlcy4gKHNldCBkdXJpbmdcbiAgICAvLyByZWNvbm5lY3QuKVxuICAgIHNlbGYuX3Jlc2V0U3RvcmVzID0gZmFsc2U7XG5cbiAgICAvLyBuYW1lIC0+IGFycmF5IG9mIHVwZGF0ZXMgZm9yICh5ZXQgdG8gYmUgY3JlYXRlZCkgY29sbGVjdGlvbnNcbiAgICBzZWxmLl91cGRhdGVzRm9yVW5rbm93blN0b3JlcyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gICAgLy8gaWYgd2UncmUgYmxvY2tpbmcgYSBtaWdyYXRpb24sIHRoZSByZXRyeSBmdW5jXG4gICAgc2VsZi5fcmV0cnlNaWdyYXRlID0gbnVsbDtcblxuICAgIHNlbGYuX19mbHVzaEJ1ZmZlcmVkV3JpdGVzID0gTWV0ZW9yLmJpbmRFbnZpcm9ubWVudChcbiAgICAgIHNlbGYuX2ZsdXNoQnVmZmVyZWRXcml0ZXMsXG4gICAgICAnZmx1c2hpbmcgRERQIGJ1ZmZlcmVkIHdyaXRlcycsXG4gICAgICBzZWxmXG4gICAgKTtcbiAgICAvLyBDb2xsZWN0aW9uIG5hbWUgLT4gYXJyYXkgb2YgbWVzc2FnZXMuXG4gICAgc2VsZi5fYnVmZmVyZWRXcml0ZXMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICAgIC8vIFdoZW4gY3VycmVudCBidWZmZXIgb2YgdXBkYXRlcyBtdXN0IGJlIGZsdXNoZWQgYXQsIGluIG1zIHRpbWVzdGFtcC5cbiAgICBzZWxmLl9idWZmZXJlZFdyaXRlc0ZsdXNoQXQgPSBudWxsO1xuICAgIC8vIFRpbWVvdXQgaGFuZGxlIGZvciB0aGUgbmV4dCBwcm9jZXNzaW5nIG9mIGFsbCBwZW5kaW5nIHdyaXRlc1xuICAgIHNlbGYuX2J1ZmZlcmVkV3JpdGVzRmx1c2hIYW5kbGUgPSBudWxsO1xuXG4gICAgc2VsZi5fYnVmZmVyZWRXcml0ZXNJbnRlcnZhbCA9IG9wdGlvbnMuYnVmZmVyZWRXcml0ZXNJbnRlcnZhbDtcbiAgICBzZWxmLl9idWZmZXJlZFdyaXRlc01heEFnZSA9IG9wdGlvbnMuYnVmZmVyZWRXcml0ZXNNYXhBZ2U7XG5cbiAgICAvLyBtZXRhZGF0YSBmb3Igc3Vic2NyaXB0aW9ucy4gIE1hcCBmcm9tIHN1YiBJRCB0byBvYmplY3Qgd2l0aCBrZXlzOlxuICAgIC8vICAgLSBpZFxuICAgIC8vICAgLSBuYW1lXG4gICAgLy8gICAtIHBhcmFtc1xuICAgIC8vICAgLSBpbmFjdGl2ZSAoaWYgdHJ1ZSwgd2lsbCBiZSBjbGVhbmVkIHVwIGlmIG5vdCByZXVzZWQgaW4gcmUtcnVuKVxuICAgIC8vICAgLSByZWFkeSAoaGFzIHRoZSAncmVhZHknIG1lc3NhZ2UgYmVlbiByZWNlaXZlZD8pXG4gICAgLy8gICAtIHJlYWR5Q2FsbGJhY2sgKGFuIG9wdGlvbmFsIGNhbGxiYWNrIHRvIGNhbGwgd2hlbiByZWFkeSlcbiAgICAvLyAgIC0gZXJyb3JDYWxsYmFjayAoYW4gb3B0aW9uYWwgY2FsbGJhY2sgdG8gY2FsbCBpZiB0aGUgc3ViIHRlcm1pbmF0ZXMgd2l0aFxuICAgIC8vICAgICAgICAgICAgICAgICAgICBhbiBlcnJvciwgWFhYIENPTVBBVCBXSVRIIDEuMC4zLjEpXG4gICAgLy8gICAtIHN0b3BDYWxsYmFjayAoYW4gb3B0aW9uYWwgY2FsbGJhY2sgdG8gY2FsbCB3aGVuIHRoZSBzdWIgdGVybWluYXRlc1xuICAgIC8vICAgICBmb3IgYW55IHJlYXNvbiwgd2l0aCBhbiBlcnJvciBhcmd1bWVudCBpZiBhbiBlcnJvciB0cmlnZ2VyZWQgdGhlIHN0b3ApXG4gICAgc2VsZi5fc3Vic2NyaXB0aW9ucyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cbiAgICAvLyBSZWFjdGl2ZSB1c2VySWQuXG4gICAgc2VsZi5fdXNlcklkID0gbnVsbDtcbiAgICBzZWxmLl91c2VySWREZXBzID0gbmV3IFRyYWNrZXIuRGVwZW5kZW5jeSgpO1xuXG4gICAgLy8gQmxvY2sgYXV0by1yZWxvYWQgd2hpbGUgd2UncmUgd2FpdGluZyBmb3IgbWV0aG9kIHJlc3BvbnNlcy5cbiAgICBpZiAoTWV0ZW9yLmlzQ2xpZW50ICYmXG4gICAgICAgIFBhY2thZ2UucmVsb2FkICYmXG4gICAgICAgICEgb3B0aW9ucy5yZWxvYWRXaXRoT3V0c3RhbmRpbmcpIHtcbiAgICAgIFBhY2thZ2UucmVsb2FkLlJlbG9hZC5fb25NaWdyYXRlKHJldHJ5ID0+IHtcbiAgICAgICAgaWYgKCEgc2VsZi5fcmVhZHlUb01pZ3JhdGUoKSkge1xuICAgICAgICAgIHNlbGYuX3JldHJ5TWlncmF0ZSA9IHJldHJ5O1xuICAgICAgICAgIHJldHVybiBbZmFsc2VdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiBbdHJ1ZV07XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IG9uRGlzY29ubmVjdCA9ICgpID0+IHtcbiAgICAgIGlmIChzZWxmLl9oZWFydGJlYXQpIHtcbiAgICAgICAgc2VsZi5faGVhcnRiZWF0LnN0b3AoKTtcbiAgICAgICAgc2VsZi5faGVhcnRiZWF0ID0gbnVsbDtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgaWYgKE1ldGVvci5pc1NlcnZlcikge1xuICAgICAgc2VsZi5fc3RyZWFtLm9uKFxuICAgICAgICAnbWVzc2FnZScsXG4gICAgICAgIE1ldGVvci5iaW5kRW52aXJvbm1lbnQoXG4gICAgICAgICAgdGhpcy5vbk1lc3NhZ2UuYmluZCh0aGlzKSxcbiAgICAgICAgICAnaGFuZGxpbmcgRERQIG1lc3NhZ2UnXG4gICAgICAgIClcbiAgICAgICk7XG4gICAgICBzZWxmLl9zdHJlYW0ub24oXG4gICAgICAgICdyZXNldCcsXG4gICAgICAgIE1ldGVvci5iaW5kRW52aXJvbm1lbnQodGhpcy5vblJlc2V0LmJpbmQodGhpcyksICdoYW5kbGluZyBERFAgcmVzZXQnKVxuICAgICAgKTtcbiAgICAgIHNlbGYuX3N0cmVhbS5vbihcbiAgICAgICAgJ2Rpc2Nvbm5lY3QnLFxuICAgICAgICBNZXRlb3IuYmluZEVudmlyb25tZW50KG9uRGlzY29ubmVjdCwgJ2hhbmRsaW5nIEREUCBkaXNjb25uZWN0JylcbiAgICAgICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHNlbGYuX3N0cmVhbS5vbignbWVzc2FnZScsIHRoaXMub25NZXNzYWdlLmJpbmQodGhpcykpO1xuICAgICAgc2VsZi5fc3RyZWFtLm9uKCdyZXNldCcsIHRoaXMub25SZXNldC5iaW5kKHRoaXMpKTtcbiAgICAgIHNlbGYuX3N0cmVhbS5vbignZGlzY29ubmVjdCcsIG9uRGlzY29ubmVjdCk7XG4gICAgfVxuICB9XG5cbiAgLy8gJ25hbWUnIGlzIHRoZSBuYW1lIG9mIHRoZSBkYXRhIG9uIHRoZSB3aXJlIHRoYXQgc2hvdWxkIGdvIGluIHRoZVxuICAvLyBzdG9yZS4gJ3dyYXBwZWRTdG9yZScgc2hvdWxkIGJlIGFuIG9iamVjdCB3aXRoIG1ldGhvZHMgYmVnaW5VcGRhdGUsIHVwZGF0ZSxcbiAgLy8gZW5kVXBkYXRlLCBzYXZlT3JpZ2luYWxzLCByZXRyaWV2ZU9yaWdpbmFscy4gc2VlIENvbGxlY3Rpb24gZm9yIGFuIGV4YW1wbGUuXG4gIHJlZ2lzdGVyU3RvcmUobmFtZSwgd3JhcHBlZFN0b3JlKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG5cbiAgICBpZiAobmFtZSBpbiBzZWxmLl9zdG9yZXMpIHJldHVybiBmYWxzZTtcblxuICAgIC8vIFdyYXAgdGhlIGlucHV0IG9iamVjdCBpbiBhbiBvYmplY3Qgd2hpY2ggbWFrZXMgYW55IHN0b3JlIG1ldGhvZCBub3RcbiAgICAvLyBpbXBsZW1lbnRlZCBieSAnc3RvcmUnIGludG8gYSBuby1vcC5cbiAgICBjb25zdCBzdG9yZSA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gICAgY29uc3Qga2V5c09mU3RvcmUgPSBbXG4gICAgICAndXBkYXRlJyxcbiAgICAgICdiZWdpblVwZGF0ZScsXG4gICAgICAnZW5kVXBkYXRlJyxcbiAgICAgICdzYXZlT3JpZ2luYWxzJyxcbiAgICAgICdyZXRyaWV2ZU9yaWdpbmFscycsXG4gICAgICAnZ2V0RG9jJyxcbiAgICAgICdfZ2V0Q29sbGVjdGlvbidcbiAgICBdO1xuICAgIGtleXNPZlN0b3JlLmZvckVhY2goKG1ldGhvZCkgPT4ge1xuICAgICAgc3RvcmVbbWV0aG9kXSA9ICguLi5hcmdzKSA9PiB7XG4gICAgICAgIGlmICh3cmFwcGVkU3RvcmVbbWV0aG9kXSkge1xuICAgICAgICAgIHJldHVybiB3cmFwcGVkU3RvcmVbbWV0aG9kXSguLi5hcmdzKTtcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9KTtcbiAgICBzZWxmLl9zdG9yZXNbbmFtZV0gPSBzdG9yZTtcblxuICAgIGNvbnN0IHF1ZXVlZCA9IHNlbGYuX3VwZGF0ZXNGb3JVbmtub3duU3RvcmVzW25hbWVdO1xuICAgIGlmIChBcnJheS5pc0FycmF5KHF1ZXVlZCkpIHtcbiAgICAgIHN0b3JlLmJlZ2luVXBkYXRlKHF1ZXVlZC5sZW5ndGgsIGZhbHNlKTtcbiAgICAgIHF1ZXVlZC5mb3JFYWNoKG1zZyA9PiB7XG4gICAgICAgIHN0b3JlLnVwZGF0ZShtc2cpO1xuICAgICAgfSk7XG4gICAgICBzdG9yZS5lbmRVcGRhdGUoKTtcbiAgICAgIGRlbGV0ZSBzZWxmLl91cGRhdGVzRm9yVW5rbm93blN0b3Jlc1tuYW1lXTtcbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAbWVtYmVyT2YgTWV0ZW9yXG4gICAqIEBpbXBvcnRGcm9tUGFja2FnZSBtZXRlb3JcbiAgICogQGFsaWFzIE1ldGVvci5zdWJzY3JpYmVcbiAgICogQHN1bW1hcnkgU3Vic2NyaWJlIHRvIGEgcmVjb3JkIHNldC4gIFJldHVybnMgYSBoYW5kbGUgdGhhdCBwcm92aWRlc1xuICAgKiBgc3RvcCgpYCBhbmQgYHJlYWR5KClgIG1ldGhvZHMuXG4gICAqIEBsb2N1cyBDbGllbnRcbiAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgTmFtZSBvZiB0aGUgc3Vic2NyaXB0aW9uLiAgTWF0Y2hlcyB0aGUgbmFtZSBvZiB0aGVcbiAgICogc2VydmVyJ3MgYHB1Ymxpc2goKWAgY2FsbC5cbiAgICogQHBhcmFtIHtFSlNPTmFibGV9IFthcmcxLGFyZzIuLi5dIE9wdGlvbmFsIGFyZ3VtZW50cyBwYXNzZWQgdG8gcHVibGlzaGVyXG4gICAqIGZ1bmN0aW9uIG9uIHNlcnZlci5cbiAgICogQHBhcmFtIHtGdW5jdGlvbnxPYmplY3R9IFtjYWxsYmFja3NdIE9wdGlvbmFsLiBNYXkgaW5jbHVkZSBgb25TdG9wYFxuICAgKiBhbmQgYG9uUmVhZHlgIGNhbGxiYWNrcy4gSWYgdGhlcmUgaXMgYW4gZXJyb3IsIGl0IGlzIHBhc3NlZCBhcyBhblxuICAgKiBhcmd1bWVudCB0byBgb25TdG9wYC4gSWYgYSBmdW5jdGlvbiBpcyBwYXNzZWQgaW5zdGVhZCBvZiBhbiBvYmplY3QsIGl0XG4gICAqIGlzIGludGVycHJldGVkIGFzIGFuIGBvblJlYWR5YCBjYWxsYmFjay5cbiAgICovXG4gIHN1YnNjcmliZShuYW1lIC8qIC4uIFthcmd1bWVudHNdIC4uIChjYWxsYmFja3xjYWxsYmFja3MpICovKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG5cbiAgICBjb25zdCBwYXJhbXMgPSBzbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgbGV0IGNhbGxiYWNrcyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gICAgaWYgKHBhcmFtcy5sZW5ndGgpIHtcbiAgICAgIGNvbnN0IGxhc3RQYXJhbSA9IHBhcmFtc1twYXJhbXMubGVuZ3RoIC0gMV07XG4gICAgICBpZiAodHlwZW9mIGxhc3RQYXJhbSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBjYWxsYmFja3Mub25SZWFkeSA9IHBhcmFtcy5wb3AoKTtcbiAgICAgIH0gZWxzZSBpZiAobGFzdFBhcmFtICYmIFtcbiAgICAgICAgbGFzdFBhcmFtLm9uUmVhZHksXG4gICAgICAgIC8vIFhYWCBDT01QQVQgV0lUSCAxLjAuMy4xIG9uRXJyb3IgdXNlZCB0byBleGlzdCwgYnV0IG5vdyB3ZSB1c2VcbiAgICAgICAgLy8gb25TdG9wIHdpdGggYW4gZXJyb3IgY2FsbGJhY2sgaW5zdGVhZC5cbiAgICAgICAgbGFzdFBhcmFtLm9uRXJyb3IsXG4gICAgICAgIGxhc3RQYXJhbS5vblN0b3BcbiAgICAgIF0uc29tZShmID0+IHR5cGVvZiBmID09PSBcImZ1bmN0aW9uXCIpKSB7XG4gICAgICAgIGNhbGxiYWNrcyA9IHBhcmFtcy5wb3AoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBJcyB0aGVyZSBhbiBleGlzdGluZyBzdWIgd2l0aCB0aGUgc2FtZSBuYW1lIGFuZCBwYXJhbSwgcnVuIGluIGFuXG4gICAgLy8gaW52YWxpZGF0ZWQgQ29tcHV0YXRpb24/IFRoaXMgd2lsbCBoYXBwZW4gaWYgd2UgYXJlIHJlcnVubmluZyBhblxuICAgIC8vIGV4aXN0aW5nIGNvbXB1dGF0aW9uLlxuICAgIC8vXG4gICAgLy8gRm9yIGV4YW1wbGUsIGNvbnNpZGVyIGEgcmVydW4gb2Y6XG4gICAgLy9cbiAgICAvLyAgICAgVHJhY2tlci5hdXRvcnVuKGZ1bmN0aW9uICgpIHtcbiAgICAvLyAgICAgICBNZXRlb3Iuc3Vic2NyaWJlKFwiZm9vXCIsIFNlc3Npb24uZ2V0KFwiZm9vXCIpKTtcbiAgICAvLyAgICAgICBNZXRlb3Iuc3Vic2NyaWJlKFwiYmFyXCIsIFNlc3Npb24uZ2V0KFwiYmFyXCIpKTtcbiAgICAvLyAgICAgfSk7XG4gICAgLy9cbiAgICAvLyBJZiBcImZvb1wiIGhhcyBjaGFuZ2VkIGJ1dCBcImJhclwiIGhhcyBub3QsIHdlIHdpbGwgbWF0Y2ggdGhlIFwiYmFyXCJcbiAgICAvLyBzdWJjcmliZSB0byBhbiBleGlzdGluZyBpbmFjdGl2ZSBzdWJzY3JpcHRpb24gaW4gb3JkZXIgdG8gbm90XG4gICAgLy8gdW5zdWIgYW5kIHJlc3ViIHRoZSBzdWJzY3JpcHRpb24gdW5uZWNlc3NhcmlseS5cbiAgICAvL1xuICAgIC8vIFdlIG9ubHkgbG9vayBmb3Igb25lIHN1Y2ggc3ViOyBpZiB0aGVyZSBhcmUgTiBhcHBhcmVudGx5LWlkZW50aWNhbCBzdWJzXG4gICAgLy8gYmVpbmcgaW52YWxpZGF0ZWQsIHdlIHdpbGwgcmVxdWlyZSBOIG1hdGNoaW5nIHN1YnNjcmliZSBjYWxscyB0byBrZWVwXG4gICAgLy8gdGhlbSBhbGwgYWN0aXZlLlxuICAgIGNvbnN0IGV4aXN0aW5nID0gT2JqZWN0LnZhbHVlcyhzZWxmLl9zdWJzY3JpcHRpb25zKS5maW5kKFxuICAgICAgc3ViID0+IChzdWIuaW5hY3RpdmUgJiYgc3ViLm5hbWUgPT09IG5hbWUgJiYgRUpTT04uZXF1YWxzKHN1Yi5wYXJhbXMsIHBhcmFtcykpXG4gICAgKTtcblxuICAgIGxldCBpZDtcbiAgICBpZiAoZXhpc3RpbmcpIHtcbiAgICAgIGlkID0gZXhpc3RpbmcuaWQ7XG4gICAgICBleGlzdGluZy5pbmFjdGl2ZSA9IGZhbHNlOyAvLyByZWFjdGl2YXRlXG5cbiAgICAgIGlmIChjYWxsYmFja3Mub25SZWFkeSkge1xuICAgICAgICAvLyBJZiB0aGUgc3ViIGlzIG5vdCBhbHJlYWR5IHJlYWR5LCByZXBsYWNlIGFueSByZWFkeSBjYWxsYmFjayB3aXRoIHRoZVxuICAgICAgICAvLyBvbmUgcHJvdmlkZWQgbm93LiAoSXQncyBub3QgcmVhbGx5IGNsZWFyIHdoYXQgdXNlcnMgd291bGQgZXhwZWN0IGZvclxuICAgICAgICAvLyBhbiBvblJlYWR5IGNhbGxiYWNrIGluc2lkZSBhbiBhdXRvcnVuOyB0aGUgc2VtYW50aWNzIHdlIHByb3ZpZGUgaXNcbiAgICAgICAgLy8gdGhhdCBhdCB0aGUgdGltZSB0aGUgc3ViIGZpcnN0IGJlY29tZXMgcmVhZHksIHdlIGNhbGwgdGhlIGxhc3RcbiAgICAgICAgLy8gb25SZWFkeSBjYWxsYmFjayBwcm92aWRlZCwgaWYgYW55LilcbiAgICAgICAgLy8gSWYgdGhlIHN1YiBpcyBhbHJlYWR5IHJlYWR5LCBydW4gdGhlIHJlYWR5IGNhbGxiYWNrIHJpZ2h0IGF3YXkuXG4gICAgICAgIC8vIEl0IHNlZW1zIHRoYXQgdXNlcnMgd291bGQgZXhwZWN0IGFuIG9uUmVhZHkgY2FsbGJhY2sgaW5zaWRlIGFuXG4gICAgICAgIC8vIGF1dG9ydW4gdG8gdHJpZ2dlciBvbmNlIHRoZSB0aGUgc3ViIGZpcnN0IGJlY29tZXMgcmVhZHkgYW5kIGFsc29cbiAgICAgICAgLy8gd2hlbiByZS1zdWJzIGhhcHBlbnMuXG4gICAgICAgIGlmIChleGlzdGluZy5yZWFkeSkge1xuICAgICAgICAgIGNhbGxiYWNrcy5vblJlYWR5KCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZXhpc3RpbmcucmVhZHlDYWxsYmFjayA9IGNhbGxiYWNrcy5vblJlYWR5O1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIFhYWCBDT01QQVQgV0lUSCAxLjAuMy4xIHdlIHVzZWQgdG8gaGF2ZSBvbkVycm9yIGJ1dCBub3cgd2UgY2FsbFxuICAgICAgLy8gb25TdG9wIHdpdGggYW4gb3B0aW9uYWwgZXJyb3IgYXJndW1lbnRcbiAgICAgIGlmIChjYWxsYmFja3Mub25FcnJvcikge1xuICAgICAgICAvLyBSZXBsYWNlIGV4aXN0aW5nIGNhbGxiYWNrIGlmIGFueSwgc28gdGhhdCBlcnJvcnMgYXJlbid0XG4gICAgICAgIC8vIGRvdWJsZS1yZXBvcnRlZC5cbiAgICAgICAgZXhpc3RpbmcuZXJyb3JDYWxsYmFjayA9IGNhbGxiYWNrcy5vbkVycm9yO1xuICAgICAgfVxuXG4gICAgICBpZiAoY2FsbGJhY2tzLm9uU3RvcCkge1xuICAgICAgICBleGlzdGluZy5zdG9wQ2FsbGJhY2sgPSBjYWxsYmFja3Mub25TdG9wO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBOZXcgc3ViISBHZW5lcmF0ZSBhbiBpZCwgc2F2ZSBpdCBsb2NhbGx5LCBhbmQgc2VuZCBtZXNzYWdlLlxuICAgICAgaWQgPSBSYW5kb20uaWQoKTtcbiAgICAgIHNlbGYuX3N1YnNjcmlwdGlvbnNbaWRdID0ge1xuICAgICAgICBpZDogaWQsXG4gICAgICAgIG5hbWU6IG5hbWUsXG4gICAgICAgIHBhcmFtczogRUpTT04uY2xvbmUocGFyYW1zKSxcbiAgICAgICAgaW5hY3RpdmU6IGZhbHNlLFxuICAgICAgICByZWFkeTogZmFsc2UsXG4gICAgICAgIHJlYWR5RGVwczogbmV3IFRyYWNrZXIuRGVwZW5kZW5jeSgpLFxuICAgICAgICByZWFkeUNhbGxiYWNrOiBjYWxsYmFja3Mub25SZWFkeSxcbiAgICAgICAgLy8gWFhYIENPTVBBVCBXSVRIIDEuMC4zLjEgI2Vycm9yQ2FsbGJhY2tcbiAgICAgICAgZXJyb3JDYWxsYmFjazogY2FsbGJhY2tzLm9uRXJyb3IsXG4gICAgICAgIHN0b3BDYWxsYmFjazogY2FsbGJhY2tzLm9uU3RvcCxcbiAgICAgICAgY29ubmVjdGlvbjogc2VsZixcbiAgICAgICAgcmVtb3ZlKCkge1xuICAgICAgICAgIGRlbGV0ZSB0aGlzLmNvbm5lY3Rpb24uX3N1YnNjcmlwdGlvbnNbdGhpcy5pZF07XG4gICAgICAgICAgdGhpcy5yZWFkeSAmJiB0aGlzLnJlYWR5RGVwcy5jaGFuZ2VkKCk7XG4gICAgICAgIH0sXG4gICAgICAgIHN0b3AoKSB7XG4gICAgICAgICAgdGhpcy5jb25uZWN0aW9uLl9zZW5kKHsgbXNnOiAndW5zdWInLCBpZDogaWQgfSk7XG4gICAgICAgICAgdGhpcy5yZW1vdmUoKTtcblxuICAgICAgICAgIGlmIChjYWxsYmFja3Mub25TdG9wKSB7XG4gICAgICAgICAgICBjYWxsYmFja3Mub25TdG9wKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9O1xuICAgICAgc2VsZi5fc2VuZCh7IG1zZzogJ3N1YicsIGlkOiBpZCwgbmFtZTogbmFtZSwgcGFyYW1zOiBwYXJhbXMgfSk7XG4gICAgfVxuXG4gICAgLy8gcmV0dXJuIGEgaGFuZGxlIHRvIHRoZSBhcHBsaWNhdGlvbi5cbiAgICBjb25zdCBoYW5kbGUgPSB7XG4gICAgICBzdG9wKCkge1xuICAgICAgICBpZiAoISBoYXNPd24uY2FsbChzZWxmLl9zdWJzY3JpcHRpb25zLCBpZCkpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgc2VsZi5fc3Vic2NyaXB0aW9uc1tpZF0uc3RvcCgpO1xuICAgICAgfSxcbiAgICAgIHJlYWR5KCkge1xuICAgICAgICAvLyByZXR1cm4gZmFsc2UgaWYgd2UndmUgdW5zdWJzY3JpYmVkLlxuICAgICAgICBpZiAoIWhhc093bi5jYWxsKHNlbGYuX3N1YnNjcmlwdGlvbnMsIGlkKSkge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCByZWNvcmQgPSBzZWxmLl9zdWJzY3JpcHRpb25zW2lkXTtcbiAgICAgICAgcmVjb3JkLnJlYWR5RGVwcy5kZXBlbmQoKTtcbiAgICAgICAgcmV0dXJuIHJlY29yZC5yZWFkeTtcbiAgICAgIH0sXG4gICAgICBzdWJzY3JpcHRpb25JZDogaWRcbiAgICB9O1xuXG4gICAgaWYgKFRyYWNrZXIuYWN0aXZlKSB7XG4gICAgICAvLyBXZSdyZSBpbiBhIHJlYWN0aXZlIGNvbXB1dGF0aW9uLCBzbyB3ZSdkIGxpa2UgdG8gdW5zdWJzY3JpYmUgd2hlbiB0aGVcbiAgICAgIC8vIGNvbXB1dGF0aW9uIGlzIGludmFsaWRhdGVkLi4uIGJ1dCBub3QgaWYgdGhlIHJlcnVuIGp1c3QgcmUtc3Vic2NyaWJlc1xuICAgICAgLy8gdG8gdGhlIHNhbWUgc3Vic2NyaXB0aW9uISAgV2hlbiBhIHJlcnVuIGhhcHBlbnMsIHdlIHVzZSBvbkludmFsaWRhdGVcbiAgICAgIC8vIGFzIGEgY2hhbmdlIHRvIG1hcmsgdGhlIHN1YnNjcmlwdGlvbiBcImluYWN0aXZlXCIgc28gdGhhdCBpdCBjYW5cbiAgICAgIC8vIGJlIHJldXNlZCBmcm9tIHRoZSByZXJ1bi4gIElmIGl0IGlzbid0IHJldXNlZCwgaXQncyBraWxsZWQgZnJvbVxuICAgICAgLy8gYW4gYWZ0ZXJGbHVzaC5cbiAgICAgIFRyYWNrZXIub25JbnZhbGlkYXRlKChjKSA9PiB7XG4gICAgICAgIGlmIChoYXNPd24uY2FsbChzZWxmLl9zdWJzY3JpcHRpb25zLCBpZCkpIHtcbiAgICAgICAgICBzZWxmLl9zdWJzY3JpcHRpb25zW2lkXS5pbmFjdGl2ZSA9IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBUcmFja2VyLmFmdGVyRmx1c2goKCkgPT4ge1xuICAgICAgICAgIGlmIChoYXNPd24uY2FsbChzZWxmLl9zdWJzY3JpcHRpb25zLCBpZCkgJiZcbiAgICAgICAgICAgICAgc2VsZi5fc3Vic2NyaXB0aW9uc1tpZF0uaW5hY3RpdmUpIHtcbiAgICAgICAgICAgIGhhbmRsZS5zdG9wKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiBoYW5kbGU7XG4gIH1cblxuICAvLyBvcHRpb25zOlxuICAvLyAtIG9uTGF0ZUVycm9yIHtGdW5jdGlvbihlcnJvcil9IGNhbGxlZCBpZiBhbiBlcnJvciB3YXMgcmVjZWl2ZWQgYWZ0ZXIgdGhlIHJlYWR5IGV2ZW50LlxuICAvLyAgICAgKGVycm9ycyByZWNlaXZlZCBiZWZvcmUgcmVhZHkgY2F1c2UgYW4gZXJyb3IgdG8gYmUgdGhyb3duKVxuICBfc3Vic2NyaWJlQW5kV2FpdChuYW1lLCBhcmdzLCBvcHRpb25zKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgY29uc3QgZiA9IG5ldyBGdXR1cmUoKTtcbiAgICBsZXQgcmVhZHkgPSBmYWxzZTtcbiAgICBhcmdzID0gYXJncyB8fCBbXTtcbiAgICBhcmdzLnB1c2goe1xuICAgICAgb25SZWFkeSgpIHtcbiAgICAgICAgcmVhZHkgPSB0cnVlO1xuICAgICAgICBmWydyZXR1cm4nXSgpO1xuICAgICAgfSxcbiAgICAgIG9uRXJyb3IoZSkge1xuICAgICAgICBpZiAoIXJlYWR5KSBmWyd0aHJvdyddKGUpO1xuICAgICAgICBlbHNlIG9wdGlvbnMgJiYgb3B0aW9ucy5vbkxhdGVFcnJvciAmJiBvcHRpb25zLm9uTGF0ZUVycm9yKGUpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgY29uc3QgaGFuZGxlID0gc2VsZi5zdWJzY3JpYmUuYXBwbHkoc2VsZiwgW25hbWVdLmNvbmNhdChhcmdzKSk7XG4gICAgZi53YWl0KCk7XG4gICAgcmV0dXJuIGhhbmRsZTtcbiAgfVxuXG4gIG1ldGhvZHMobWV0aG9kcykge1xuICAgIE9iamVjdC5lbnRyaWVzKG1ldGhvZHMpLmZvckVhY2goKFtuYW1lLCBmdW5jXSkgPT4ge1xuICAgICAgaWYgKHR5cGVvZiBmdW5jICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIk1ldGhvZCAnXCIgKyBuYW1lICsgXCInIG11c3QgYmUgYSBmdW5jdGlvblwiKTtcbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLl9tZXRob2RIYW5kbGVyc1tuYW1lXSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJBIG1ldGhvZCBuYW1lZCAnXCIgKyBuYW1lICsgXCInIGlzIGFscmVhZHkgZGVmaW5lZFwiKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuX21ldGhvZEhhbmRsZXJzW25hbWVdID0gZnVuYztcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAbWVtYmVyT2YgTWV0ZW9yXG4gICAqIEBpbXBvcnRGcm9tUGFja2FnZSBtZXRlb3JcbiAgICogQGFsaWFzIE1ldGVvci5jYWxsXG4gICAqIEBzdW1tYXJ5IEludm9rZXMgYSBtZXRob2QgcGFzc2luZyBhbnkgbnVtYmVyIG9mIGFyZ3VtZW50cy5cbiAgICogQGxvY3VzIEFueXdoZXJlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIE5hbWUgb2YgbWV0aG9kIHRvIGludm9rZVxuICAgKiBAcGFyYW0ge0VKU09OYWJsZX0gW2FyZzEsYXJnMi4uLl0gT3B0aW9uYWwgbWV0aG9kIGFyZ3VtZW50c1xuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbYXN5bmNDYWxsYmFja10gT3B0aW9uYWwgY2FsbGJhY2ssIHdoaWNoIGlzIGNhbGxlZCBhc3luY2hyb25vdXNseSB3aXRoIHRoZSBlcnJvciBvciByZXN1bHQgYWZ0ZXIgdGhlIG1ldGhvZCBpcyBjb21wbGV0ZS4gSWYgbm90IHByb3ZpZGVkLCB0aGUgbWV0aG9kIHJ1bnMgc3luY2hyb25vdXNseSBpZiBwb3NzaWJsZSAoc2VlIGJlbG93KS5cbiAgICovXG4gIGNhbGwobmFtZSAvKiAuLiBbYXJndW1lbnRzXSAuLiBjYWxsYmFjayAqLykge1xuICAgIC8vIGlmIGl0J3MgYSBmdW5jdGlvbiwgdGhlIGxhc3QgYXJndW1lbnQgaXMgdGhlIHJlc3VsdCBjYWxsYmFjayxcbiAgICAvLyBub3QgYSBwYXJhbWV0ZXIgdG8gdGhlIHJlbW90ZSBtZXRob2QuXG4gICAgY29uc3QgYXJncyA9IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICBsZXQgY2FsbGJhY2s7XG4gICAgaWYgKGFyZ3MubGVuZ3RoICYmIHR5cGVvZiBhcmdzW2FyZ3MubGVuZ3RoIC0gMV0gPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGNhbGxiYWNrID0gYXJncy5wb3AoKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuYXBwbHkobmFtZSwgYXJncywgY2FsbGJhY2spO1xuICB9XG5cbiAgLyoqXG4gICAqIEBtZW1iZXJPZiBNZXRlb3JcbiAgICogQGltcG9ydEZyb21QYWNrYWdlIG1ldGVvclxuICAgKiBAYWxpYXMgTWV0ZW9yLmFwcGx5XG4gICAqIEBzdW1tYXJ5IEludm9rZSBhIG1ldGhvZCBwYXNzaW5nIGFuIGFycmF5IG9mIGFyZ3VtZW50cy5cbiAgICogQGxvY3VzIEFueXdoZXJlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIE5hbWUgb2YgbWV0aG9kIHRvIGludm9rZVxuICAgKiBAcGFyYW0ge0VKU09OYWJsZVtdfSBhcmdzIE1ldGhvZCBhcmd1bWVudHNcbiAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXVxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IG9wdGlvbnMud2FpdCAoQ2xpZW50IG9ubHkpIElmIHRydWUsIGRvbid0IHNlbmQgdGhpcyBtZXRob2QgdW50aWwgYWxsIHByZXZpb3VzIG1ldGhvZCBjYWxscyBoYXZlIGNvbXBsZXRlZCwgYW5kIGRvbid0IHNlbmQgYW55IHN1YnNlcXVlbnQgbWV0aG9kIGNhbGxzIHVudGlsIHRoaXMgb25lIGlzIGNvbXBsZXRlZC5cbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gb3B0aW9ucy5vblJlc3VsdFJlY2VpdmVkIChDbGllbnQgb25seSkgVGhpcyBjYWxsYmFjayBpcyBpbnZva2VkIHdpdGggdGhlIGVycm9yIG9yIHJlc3VsdCBvZiB0aGUgbWV0aG9kIChqdXN0IGxpa2UgYGFzeW5jQ2FsbGJhY2tgKSBhcyBzb29uIGFzIHRoZSBlcnJvciBvciByZXN1bHQgaXMgYXZhaWxhYmxlLiBUaGUgbG9jYWwgY2FjaGUgbWF5IG5vdCB5ZXQgcmVmbGVjdCB0aGUgd3JpdGVzIHBlcmZvcm1lZCBieSB0aGUgbWV0aG9kLlxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IG9wdGlvbnMubm9SZXRyeSAoQ2xpZW50IG9ubHkpIGlmIHRydWUsIGRvbid0IHNlbmQgdGhpcyBtZXRob2QgYWdhaW4gb24gcmVsb2FkLCBzaW1wbHkgY2FsbCB0aGUgY2FsbGJhY2sgYW4gZXJyb3Igd2l0aCB0aGUgZXJyb3IgY29kZSAnaW52b2NhdGlvbi1mYWlsZWQnLlxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IG9wdGlvbnMudGhyb3dTdHViRXhjZXB0aW9ucyAoQ2xpZW50IG9ubHkpIElmIHRydWUsIGV4Y2VwdGlvbnMgdGhyb3duIGJ5IG1ldGhvZCBzdHVicyB3aWxsIGJlIHRocm93biBpbnN0ZWFkIG9mIGxvZ2dlZCwgYW5kIHRoZSBtZXRob2Qgd2lsbCBub3QgYmUgaW52b2tlZCBvbiB0aGUgc2VydmVyLlxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IG9wdGlvbnMucmV0dXJuU3R1YlZhbHVlIChDbGllbnQgb25seSkgSWYgdHJ1ZSB0aGVuIGluIGNhc2VzIHdoZXJlIHdlIHdvdWxkIGhhdmUgb3RoZXJ3aXNlIGRpc2NhcmRlZCB0aGUgc3R1YidzIHJldHVybiB2YWx1ZSBhbmQgcmV0dXJuZWQgdW5kZWZpbmVkLCBpbnN0ZWFkIHdlIGdvIGFoZWFkIGFuZCByZXR1cm4gaXQuIFNwZWNpZmljYWxseSwgdGhpcyBpcyBhbnkgdGltZSBvdGhlciB0aGFuIHdoZW4gKGEpIHdlIGFyZSBhbHJlYWR5IGluc2lkZSBhIHN0dWIgb3IgKGIpIHdlIGFyZSBpbiBOb2RlIGFuZCBubyBjYWxsYmFjayB3YXMgcHJvdmlkZWQuIEN1cnJlbnRseSB3ZSByZXF1aXJlIHRoaXMgZmxhZyB0byBiZSBleHBsaWNpdGx5IHBhc3NlZCB0byByZWR1Y2UgdGhlIGxpa2VsaWhvb2QgdGhhdCBzdHViIHJldHVybiB2YWx1ZXMgd2lsbCBiZSBjb25mdXNlZCB3aXRoIHNlcnZlciByZXR1cm4gdmFsdWVzOyB3ZSBtYXkgaW1wcm92ZSB0aGlzIGluIGZ1dHVyZS5cbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2FzeW5jQ2FsbGJhY2tdIE9wdGlvbmFsIGNhbGxiYWNrOyBzYW1lIHNlbWFudGljcyBhcyBpbiBbYE1ldGVvci5jYWxsYF0oI21ldGVvcl9jYWxsKS5cbiAgICovXG4gIGFwcGx5KG5hbWUsIGFyZ3MsIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG5cbiAgICAvLyBXZSB3ZXJlIHBhc3NlZCAzIGFyZ3VtZW50cy4gVGhleSBtYXkgYmUgZWl0aGVyIChuYW1lLCBhcmdzLCBvcHRpb25zKVxuICAgIC8vIG9yIChuYW1lLCBhcmdzLCBjYWxsYmFjaylcbiAgICBpZiAoIWNhbGxiYWNrICYmIHR5cGVvZiBvcHRpb25zID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICBjYWxsYmFjayA9IG9wdGlvbnM7XG4gICAgICBvcHRpb25zID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgICB9XG4gICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwgT2JqZWN0LmNyZWF0ZShudWxsKTtcblxuICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgLy8gWFhYIHdvdWxkIGl0IGJlIGJldHRlciBmb3JtIHRvIGRvIHRoZSBiaW5kaW5nIGluIHN0cmVhbS5vbixcbiAgICAgIC8vIG9yIGNhbGxlciwgaW5zdGVhZCBvZiBoZXJlP1xuICAgICAgLy8gWFhYIGltcHJvdmUgZXJyb3IgbWVzc2FnZSAoYW5kIGhvdyB3ZSByZXBvcnQgaXQpXG4gICAgICBjYWxsYmFjayA9IE1ldGVvci5iaW5kRW52aXJvbm1lbnQoXG4gICAgICAgIGNhbGxiYWNrLFxuICAgICAgICBcImRlbGl2ZXJpbmcgcmVzdWx0IG9mIGludm9raW5nICdcIiArIG5hbWUgKyBcIidcIlxuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyBLZWVwIG91ciBhcmdzIHNhZmUgZnJvbSBtdXRhdGlvbiAoZWcgaWYgd2UgZG9uJ3Qgc2VuZCB0aGUgbWVzc2FnZSBmb3IgYVxuICAgIC8vIHdoaWxlIGJlY2F1c2Ugb2YgYSB3YWl0IG1ldGhvZCkuXG4gICAgYXJncyA9IEVKU09OLmNsb25lKGFyZ3MpO1xuXG4gICAgY29uc3QgZW5jbG9zaW5nID0gRERQLl9DdXJyZW50TWV0aG9kSW52b2NhdGlvbi5nZXQoKTtcbiAgICBjb25zdCBhbHJlYWR5SW5TaW11bGF0aW9uID0gZW5jbG9zaW5nICYmIGVuY2xvc2luZy5pc1NpbXVsYXRpb247XG5cbiAgICAvLyBMYXppbHkgZ2VuZXJhdGUgYSByYW5kb21TZWVkLCBvbmx5IGlmIGl0IGlzIHJlcXVlc3RlZCBieSB0aGUgc3R1Yi5cbiAgICAvLyBUaGUgcmFuZG9tIHN0cmVhbXMgb25seSBoYXZlIHV0aWxpdHkgaWYgdGhleSdyZSB1c2VkIG9uIGJvdGggdGhlIGNsaWVudFxuICAgIC8vIGFuZCB0aGUgc2VydmVyOyBpZiB0aGUgY2xpZW50IGRvZXNuJ3QgZ2VuZXJhdGUgYW55ICdyYW5kb20nIHZhbHVlc1xuICAgIC8vIHRoZW4gd2UgZG9uJ3QgZXhwZWN0IHRoZSBzZXJ2ZXIgdG8gZ2VuZXJhdGUgYW55IGVpdGhlci5cbiAgICAvLyBMZXNzIGNvbW1vbmx5LCB0aGUgc2VydmVyIG1heSBwZXJmb3JtIGRpZmZlcmVudCBhY3Rpb25zIGZyb20gdGhlIGNsaWVudCxcbiAgICAvLyBhbmQgbWF5IGluIGZhY3QgZ2VuZXJhdGUgdmFsdWVzIHdoZXJlIHRoZSBjbGllbnQgZGlkIG5vdCwgYnV0IHdlIGRvbid0XG4gICAgLy8gaGF2ZSBhbnkgY2xpZW50LXNpZGUgdmFsdWVzIHRvIG1hdGNoLCBzbyBldmVuIGhlcmUgd2UgbWF5IGFzIHdlbGwganVzdFxuICAgIC8vIHVzZSBhIHJhbmRvbSBzZWVkIG9uIHRoZSBzZXJ2ZXIuICBJbiB0aGF0IGNhc2UsIHdlIGRvbid0IHBhc3MgdGhlXG4gICAgLy8gcmFuZG9tU2VlZCB0byBzYXZlIGJhbmR3aWR0aCwgYW5kIHdlIGRvbid0IGV2ZW4gZ2VuZXJhdGUgaXQgdG8gc2F2ZSBhXG4gICAgLy8gYml0IG9mIENQVSBhbmQgdG8gYXZvaWQgY29uc3VtaW5nIGVudHJvcHkuXG4gICAgbGV0IHJhbmRvbVNlZWQgPSBudWxsO1xuICAgIGNvbnN0IHJhbmRvbVNlZWRHZW5lcmF0b3IgPSAoKSA9PiB7XG4gICAgICBpZiAocmFuZG9tU2VlZCA9PT0gbnVsbCkge1xuICAgICAgICByYW5kb21TZWVkID0gRERQQ29tbW9uLm1ha2VScGNTZWVkKGVuY2xvc2luZywgbmFtZSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gcmFuZG9tU2VlZDtcbiAgICB9O1xuXG4gICAgLy8gUnVuIHRoZSBzdHViLCBpZiB3ZSBoYXZlIG9uZS4gVGhlIHN0dWIgaXMgc3VwcG9zZWQgdG8gbWFrZSBzb21lXG4gICAgLy8gdGVtcG9yYXJ5IHdyaXRlcyB0byB0aGUgZGF0YWJhc2UgdG8gZ2l2ZSB0aGUgdXNlciBhIHNtb290aCBleHBlcmllbmNlXG4gICAgLy8gdW50aWwgdGhlIGFjdHVhbCByZXN1bHQgb2YgZXhlY3V0aW5nIHRoZSBtZXRob2QgY29tZXMgYmFjayBmcm9tIHRoZVxuICAgIC8vIHNlcnZlciAod2hlcmV1cG9uIHRoZSB0ZW1wb3Jhcnkgd3JpdGVzIHRvIHRoZSBkYXRhYmFzZSB3aWxsIGJlIHJldmVyc2VkXG4gICAgLy8gZHVyaW5nIHRoZSBiZWdpblVwZGF0ZS9lbmRVcGRhdGUgcHJvY2Vzcy4pXG4gICAgLy9cbiAgICAvLyBOb3JtYWxseSwgd2UgaWdub3JlIHRoZSByZXR1cm4gdmFsdWUgb2YgdGhlIHN0dWIgKGV2ZW4gaWYgaXQgaXMgYW5cbiAgICAvLyBleGNlcHRpb24pLCBpbiBmYXZvciBvZiB0aGUgcmVhbCByZXR1cm4gdmFsdWUgZnJvbSB0aGUgc2VydmVyLiBUaGVcbiAgICAvLyBleGNlcHRpb24gaXMgaWYgdGhlICpjYWxsZXIqIGlzIGEgc3R1Yi4gSW4gdGhhdCBjYXNlLCB3ZSdyZSBub3QgZ29pbmdcbiAgICAvLyB0byBkbyBhIFJQQywgc28gd2UgdXNlIHRoZSByZXR1cm4gdmFsdWUgb2YgdGhlIHN0dWIgYXMgb3VyIHJldHVyblxuICAgIC8vIHZhbHVlLlxuXG4gICAgbGV0IHN0dWJSZXR1cm5WYWx1ZTtcbiAgICBsZXQgZXhjZXB0aW9uO1xuICAgIGNvbnN0IHN0dWIgPSBzZWxmLl9tZXRob2RIYW5kbGVyc1tuYW1lXTtcbiAgICBpZiAoc3R1Yikge1xuICAgICAgY29uc3Qgc2V0VXNlcklkID0gdXNlcklkID0+IHtcbiAgICAgICAgc2VsZi5zZXRVc2VySWQodXNlcklkKTtcbiAgICAgIH07XG5cbiAgICAgIGNvbnN0IGludm9jYXRpb24gPSBuZXcgRERQQ29tbW9uLk1ldGhvZEludm9jYXRpb24oe1xuICAgICAgICBpc1NpbXVsYXRpb246IHRydWUsXG4gICAgICAgIHVzZXJJZDogc2VsZi51c2VySWQoKSxcbiAgICAgICAgc2V0VXNlcklkOiBzZXRVc2VySWQsXG4gICAgICAgIHJhbmRvbVNlZWQoKSB7XG4gICAgICAgICAgcmV0dXJuIHJhbmRvbVNlZWRHZW5lcmF0b3IoKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIGlmICghYWxyZWFkeUluU2ltdWxhdGlvbikgc2VsZi5fc2F2ZU9yaWdpbmFscygpO1xuXG4gICAgICB0cnkge1xuICAgICAgICAvLyBOb3RlIHRoYXQgdW5saWtlIGluIHRoZSBjb3JyZXNwb25kaW5nIHNlcnZlciBjb2RlLCB3ZSBuZXZlciBhdWRpdFxuICAgICAgICAvLyB0aGF0IHN0dWJzIGNoZWNrKCkgdGhlaXIgYXJndW1lbnRzLlxuICAgICAgICBzdHViUmV0dXJuVmFsdWUgPSBERFAuX0N1cnJlbnRNZXRob2RJbnZvY2F0aW9uLndpdGhWYWx1ZShcbiAgICAgICAgICBpbnZvY2F0aW9uLFxuICAgICAgICAgICgpID0+IHtcbiAgICAgICAgICAgIGlmIChNZXRlb3IuaXNTZXJ2ZXIpIHtcbiAgICAgICAgICAgICAgLy8gQmVjYXVzZSBzYXZlT3JpZ2luYWxzIGFuZCByZXRyaWV2ZU9yaWdpbmFscyBhcmVuJ3QgcmVlbnRyYW50LFxuICAgICAgICAgICAgICAvLyBkb24ndCBhbGxvdyBzdHVicyB0byB5aWVsZC5cbiAgICAgICAgICAgICAgcmV0dXJuIE1ldGVvci5fbm9ZaWVsZHNBbGxvd2VkKCgpID0+IHtcbiAgICAgICAgICAgICAgICAvLyByZS1jbG9uZSwgc28gdGhhdCB0aGUgc3R1YiBjYW4ndCBhZmZlY3Qgb3VyIGNhbGxlcidzIHZhbHVlc1xuICAgICAgICAgICAgICAgIHJldHVybiBzdHViLmFwcGx5KGludm9jYXRpb24sIEVKU09OLmNsb25lKGFyZ3MpKTtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICByZXR1cm4gc3R1Yi5hcHBseShpbnZvY2F0aW9uLCBFSlNPTi5jbG9uZShhcmdzKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICApO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBleGNlcHRpb24gPSBlO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIElmIHdlJ3JlIGluIGEgc2ltdWxhdGlvbiwgc3RvcCBhbmQgcmV0dXJuIHRoZSByZXN1bHQgd2UgaGF2ZSxcbiAgICAvLyByYXRoZXIgdGhhbiBnb2luZyBvbiB0byBkbyBhbiBSUEMuIElmIHRoZXJlIHdhcyBubyBzdHViLFxuICAgIC8vIHdlJ2xsIGVuZCB1cCByZXR1cm5pbmcgdW5kZWZpbmVkLlxuICAgIGlmIChhbHJlYWR5SW5TaW11bGF0aW9uKSB7XG4gICAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgY2FsbGJhY2soZXhjZXB0aW9uLCBzdHViUmV0dXJuVmFsdWUpO1xuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgfVxuICAgICAgaWYgKGV4Y2VwdGlvbikgdGhyb3cgZXhjZXB0aW9uO1xuICAgICAgcmV0dXJuIHN0dWJSZXR1cm5WYWx1ZTtcbiAgICB9XG5cbiAgICAvLyBXZSBvbmx5IGNyZWF0ZSB0aGUgbWV0aG9kSWQgaGVyZSBiZWNhdXNlIHdlIGRvbid0IGFjdHVhbGx5IG5lZWQgb25lIGlmXG4gICAgLy8gd2UncmUgYWxyZWFkeSBpbiBhIHNpbXVsYXRpb25cbiAgICBjb25zdCBtZXRob2RJZCA9ICcnICsgc2VsZi5fbmV4dE1ldGhvZElkKys7XG4gICAgaWYgKHN0dWIpIHtcbiAgICAgIHNlbGYuX3JldHJpZXZlQW5kU3RvcmVPcmlnaW5hbHMobWV0aG9kSWQpO1xuICAgIH1cblxuICAgIC8vIEdlbmVyYXRlIHRoZSBERFAgbWVzc2FnZSBmb3IgdGhlIG1ldGhvZCBjYWxsLiBOb3RlIHRoYXQgb24gdGhlIGNsaWVudCxcbiAgICAvLyBpdCBpcyBpbXBvcnRhbnQgdGhhdCB0aGUgc3R1YiBoYXZlIGZpbmlzaGVkIGJlZm9yZSB3ZSBzZW5kIHRoZSBSUEMsIHNvXG4gICAgLy8gdGhhdCB3ZSBrbm93IHdlIGhhdmUgYSBjb21wbGV0ZSBsaXN0IG9mIHdoaWNoIGxvY2FsIGRvY3VtZW50cyB0aGUgc3R1YlxuICAgIC8vIHdyb3RlLlxuICAgIGNvbnN0IG1lc3NhZ2UgPSB7XG4gICAgICBtc2c6ICdtZXRob2QnLFxuICAgICAgbWV0aG9kOiBuYW1lLFxuICAgICAgcGFyYW1zOiBhcmdzLFxuICAgICAgaWQ6IG1ldGhvZElkXG4gICAgfTtcblxuICAgIC8vIElmIGFuIGV4Y2VwdGlvbiBvY2N1cnJlZCBpbiBhIHN0dWIsIGFuZCB3ZSdyZSBpZ25vcmluZyBpdFxuICAgIC8vIGJlY2F1c2Ugd2UncmUgZG9pbmcgYW4gUlBDIGFuZCB3YW50IHRvIHVzZSB3aGF0IHRoZSBzZXJ2ZXJcbiAgICAvLyByZXR1cm5zIGluc3RlYWQsIGxvZyBpdCBzbyB0aGUgZGV2ZWxvcGVyIGtub3dzXG4gICAgLy8gKHVubGVzcyB0aGV5IGV4cGxpY2l0bHkgYXNrIHRvIHNlZSB0aGUgZXJyb3IpLlxuICAgIC8vXG4gICAgLy8gVGVzdHMgY2FuIHNldCB0aGUgJ19leHBlY3RlZEJ5VGVzdCcgZmxhZyBvbiBhbiBleGNlcHRpb24gc28gaXQgd29uJ3RcbiAgICAvLyBnbyB0byBsb2cuXG4gICAgaWYgKGV4Y2VwdGlvbikge1xuICAgICAgaWYgKG9wdGlvbnMudGhyb3dTdHViRXhjZXB0aW9ucykge1xuICAgICAgICB0aHJvdyBleGNlcHRpb247XG4gICAgICB9IGVsc2UgaWYgKCFleGNlcHRpb24uX2V4cGVjdGVkQnlUZXN0KSB7XG4gICAgICAgIE1ldGVvci5fZGVidWcoXG4gICAgICAgICAgXCJFeGNlcHRpb24gd2hpbGUgc2ltdWxhdGluZyB0aGUgZWZmZWN0IG9mIGludm9raW5nICdcIiArIG5hbWUgKyBcIidcIixcbiAgICAgICAgICBleGNlcHRpb25cbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBBdCB0aGlzIHBvaW50IHdlJ3JlIGRlZmluaXRlbHkgZG9pbmcgYW4gUlBDLCBhbmQgd2UncmUgZ29pbmcgdG9cbiAgICAvLyByZXR1cm4gdGhlIHZhbHVlIG9mIHRoZSBSUEMgdG8gdGhlIGNhbGxlci5cblxuICAgIC8vIElmIHRoZSBjYWxsZXIgZGlkbid0IGdpdmUgYSBjYWxsYmFjaywgZGVjaWRlIHdoYXQgdG8gZG8uXG4gICAgbGV0IGZ1dHVyZTtcbiAgICBpZiAoIWNhbGxiYWNrKSB7XG4gICAgICBpZiAoTWV0ZW9yLmlzQ2xpZW50KSB7XG4gICAgICAgIC8vIE9uIHRoZSBjbGllbnQsIHdlIGRvbid0IGhhdmUgZmliZXJzLCBzbyB3ZSBjYW4ndCBibG9jay4gVGhlXG4gICAgICAgIC8vIG9ubHkgdGhpbmcgd2UgY2FuIGRvIGlzIHRvIHJldHVybiB1bmRlZmluZWQgYW5kIGRpc2NhcmQgdGhlXG4gICAgICAgIC8vIHJlc3VsdCBvZiB0aGUgUlBDLiBJZiBhbiBlcnJvciBvY2N1cnJlZCB0aGVuIHByaW50IHRoZSBlcnJvclxuICAgICAgICAvLyB0byB0aGUgY29uc29sZS5cbiAgICAgICAgY2FsbGJhY2sgPSBlcnIgPT4ge1xuICAgICAgICAgIGVyciAmJiBNZXRlb3IuX2RlYnVnKFwiRXJyb3IgaW52b2tpbmcgTWV0aG9kICdcIiArIG5hbWUgKyBcIidcIiwgZXJyKTtcbiAgICAgICAgfTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIE9uIHRoZSBzZXJ2ZXIsIG1ha2UgdGhlIGZ1bmN0aW9uIHN5bmNocm9ub3VzLiBUaHJvdyBvblxuICAgICAgICAvLyBlcnJvcnMsIHJldHVybiBvbiBzdWNjZXNzLlxuICAgICAgICBmdXR1cmUgPSBuZXcgRnV0dXJlKCk7XG4gICAgICAgIGNhbGxiYWNrID0gZnV0dXJlLnJlc29sdmVyKCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gU2VuZCB0aGUgcmFuZG9tU2VlZCBvbmx5IGlmIHdlIHVzZWQgaXRcbiAgICBpZiAocmFuZG9tU2VlZCAhPT0gbnVsbCkge1xuICAgICAgbWVzc2FnZS5yYW5kb21TZWVkID0gcmFuZG9tU2VlZDtcbiAgICB9XG5cbiAgICBjb25zdCBtZXRob2RJbnZva2VyID0gbmV3IE1ldGhvZEludm9rZXIoe1xuICAgICAgbWV0aG9kSWQsXG4gICAgICBjYWxsYmFjazogY2FsbGJhY2ssXG4gICAgICBjb25uZWN0aW9uOiBzZWxmLFxuICAgICAgb25SZXN1bHRSZWNlaXZlZDogb3B0aW9ucy5vblJlc3VsdFJlY2VpdmVkLFxuICAgICAgd2FpdDogISFvcHRpb25zLndhaXQsXG4gICAgICBtZXNzYWdlOiBtZXNzYWdlLFxuICAgICAgbm9SZXRyeTogISFvcHRpb25zLm5vUmV0cnlcbiAgICB9KTtcblxuICAgIGlmIChvcHRpb25zLndhaXQpIHtcbiAgICAgIC8vIEl0J3MgYSB3YWl0IG1ldGhvZCEgV2FpdCBtZXRob2RzIGdvIGluIHRoZWlyIG93biBibG9jay5cbiAgICAgIHNlbGYuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzLnB1c2goe1xuICAgICAgICB3YWl0OiB0cnVlLFxuICAgICAgICBtZXRob2RzOiBbbWV0aG9kSW52b2tlcl1cbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBOb3QgYSB3YWl0IG1ldGhvZC4gU3RhcnQgYSBuZXcgYmxvY2sgaWYgdGhlIHByZXZpb3VzIGJsb2NrIHdhcyBhIHdhaXRcbiAgICAgIC8vIGJsb2NrLCBhbmQgYWRkIGl0IHRvIHRoZSBsYXN0IGJsb2NrIG9mIG1ldGhvZHMuXG4gICAgICBpZiAoaXNFbXB0eShzZWxmLl9vdXRzdGFuZGluZ01ldGhvZEJsb2NrcykgfHxcbiAgICAgICAgICBsYXN0KHNlbGYuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzKS53YWl0KSB7XG4gICAgICAgIHNlbGYuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzLnB1c2goe1xuICAgICAgICAgIHdhaXQ6IGZhbHNlLFxuICAgICAgICAgIG1ldGhvZHM6IFtdLFxuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgbGFzdChzZWxmLl9vdXRzdGFuZGluZ01ldGhvZEJsb2NrcykubWV0aG9kcy5wdXNoKG1ldGhvZEludm9rZXIpO1xuICAgIH1cblxuICAgIC8vIElmIHdlIGFkZGVkIGl0IHRvIHRoZSBmaXJzdCBibG9jaywgc2VuZCBpdCBvdXQgbm93LlxuICAgIGlmIChzZWxmLl9vdXRzdGFuZGluZ01ldGhvZEJsb2Nrcy5sZW5ndGggPT09IDEpIG1ldGhvZEludm9rZXIuc2VuZE1lc3NhZ2UoKTtcblxuICAgIC8vIElmIHdlJ3JlIHVzaW5nIHRoZSBkZWZhdWx0IGNhbGxiYWNrIG9uIHRoZSBzZXJ2ZXIsXG4gICAgLy8gYmxvY2sgd2FpdGluZyBmb3IgdGhlIHJlc3VsdC5cbiAgICBpZiAoZnV0dXJlKSB7XG4gICAgICByZXR1cm4gZnV0dXJlLndhaXQoKTtcbiAgICB9XG4gICAgcmV0dXJuIG9wdGlvbnMucmV0dXJuU3R1YlZhbHVlID8gc3R1YlJldHVyblZhbHVlIDogdW5kZWZpbmVkO1xuICB9XG5cbiAgLy8gQmVmb3JlIGNhbGxpbmcgYSBtZXRob2Qgc3R1YiwgcHJlcGFyZSBhbGwgc3RvcmVzIHRvIHRyYWNrIGNoYW5nZXMgYW5kIGFsbG93XG4gIC8vIF9yZXRyaWV2ZUFuZFN0b3JlT3JpZ2luYWxzIHRvIGdldCB0aGUgb3JpZ2luYWwgdmVyc2lvbnMgb2YgY2hhbmdlZFxuICAvLyBkb2N1bWVudHMuXG4gIF9zYXZlT3JpZ2luYWxzKCkge1xuICAgIGlmICghIHRoaXMuX3dhaXRpbmdGb3JRdWllc2NlbmNlKCkpIHtcbiAgICAgIHRoaXMuX2ZsdXNoQnVmZmVyZWRXcml0ZXMoKTtcbiAgICB9XG5cbiAgICBPYmplY3QudmFsdWVzKHRoaXMuX3N0b3JlcykuZm9yRWFjaCgoc3RvcmUpID0+IHtcbiAgICAgIHN0b3JlLnNhdmVPcmlnaW5hbHMoKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8vIFJldHJpZXZlcyB0aGUgb3JpZ2luYWwgdmVyc2lvbnMgb2YgYWxsIGRvY3VtZW50cyBtb2RpZmllZCBieSB0aGUgc3R1YiBmb3JcbiAgLy8gbWV0aG9kICdtZXRob2RJZCcgZnJvbSBhbGwgc3RvcmVzIGFuZCBzYXZlcyB0aGVtIHRvIF9zZXJ2ZXJEb2N1bWVudHMgKGtleWVkXG4gIC8vIGJ5IGRvY3VtZW50KSBhbmQgX2RvY3VtZW50c1dyaXR0ZW5CeVN0dWIgKGtleWVkIGJ5IG1ldGhvZCBJRCkuXG4gIF9yZXRyaWV2ZUFuZFN0b3JlT3JpZ2luYWxzKG1ldGhvZElkKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgaWYgKHNlbGYuX2RvY3VtZW50c1dyaXR0ZW5CeVN0dWJbbWV0aG9kSWRdKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdEdXBsaWNhdGUgbWV0aG9kSWQgaW4gX3JldHJpZXZlQW5kU3RvcmVPcmlnaW5hbHMnKTtcblxuICAgIGNvbnN0IGRvY3NXcml0dGVuID0gW107XG5cbiAgICBPYmplY3QuZW50cmllcyhzZWxmLl9zdG9yZXMpLmZvckVhY2goKFtjb2xsZWN0aW9uLCBzdG9yZV0pID0+IHtcbiAgICAgIGNvbnN0IG9yaWdpbmFscyA9IHN0b3JlLnJldHJpZXZlT3JpZ2luYWxzKCk7XG4gICAgICAvLyBub3QgYWxsIHN0b3JlcyBkZWZpbmUgcmV0cmlldmVPcmlnaW5hbHNcbiAgICAgIGlmICghIG9yaWdpbmFscykgcmV0dXJuO1xuICAgICAgb3JpZ2luYWxzLmZvckVhY2goKGRvYywgaWQpID0+IHtcbiAgICAgICAgZG9jc1dyaXR0ZW4ucHVzaCh7IGNvbGxlY3Rpb24sIGlkIH0pO1xuICAgICAgICBpZiAoISBoYXNPd24uY2FsbChzZWxmLl9zZXJ2ZXJEb2N1bWVudHMsIGNvbGxlY3Rpb24pKSB7XG4gICAgICAgICAgc2VsZi5fc2VydmVyRG9jdW1lbnRzW2NvbGxlY3Rpb25dID0gbmV3IE1vbmdvSURNYXAoKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBzZXJ2ZXJEb2MgPSBzZWxmLl9zZXJ2ZXJEb2N1bWVudHNbY29sbGVjdGlvbl0uc2V0RGVmYXVsdChcbiAgICAgICAgICBpZCxcbiAgICAgICAgICBPYmplY3QuY3JlYXRlKG51bGwpXG4gICAgICAgICk7XG4gICAgICAgIGlmIChzZXJ2ZXJEb2Mud3JpdHRlbkJ5U3R1YnMpIHtcbiAgICAgICAgICAvLyBXZSdyZSBub3QgdGhlIGZpcnN0IHN0dWIgdG8gd3JpdGUgdGhpcyBkb2MuIEp1c3QgYWRkIG91ciBtZXRob2QgSURcbiAgICAgICAgICAvLyB0byB0aGUgcmVjb3JkLlxuICAgICAgICAgIHNlcnZlckRvYy53cml0dGVuQnlTdHVic1ttZXRob2RJZF0gPSB0cnVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIEZpcnN0IHN0dWIhIFNhdmUgdGhlIG9yaWdpbmFsIHZhbHVlIGFuZCBvdXIgbWV0aG9kIElELlxuICAgICAgICAgIHNlcnZlckRvYy5kb2N1bWVudCA9IGRvYztcbiAgICAgICAgICBzZXJ2ZXJEb2MuZmx1c2hDYWxsYmFja3MgPSBbXTtcbiAgICAgICAgICBzZXJ2ZXJEb2Mud3JpdHRlbkJ5U3R1YnMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICAgICAgICAgIHNlcnZlckRvYy53cml0dGVuQnlTdHVic1ttZXRob2RJZF0gPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcbiAgICBpZiAoISBpc0VtcHR5KGRvY3NXcml0dGVuKSkge1xuICAgICAgc2VsZi5fZG9jdW1lbnRzV3JpdHRlbkJ5U3R1YlttZXRob2RJZF0gPSBkb2NzV3JpdHRlbjtcbiAgICB9XG4gIH1cblxuICAvLyBUaGlzIGlzIHZlcnkgbXVjaCBhIHByaXZhdGUgZnVuY3Rpb24gd2UgdXNlIHRvIG1ha2UgdGhlIHRlc3RzXG4gIC8vIHRha2UgdXAgZmV3ZXIgc2VydmVyIHJlc291cmNlcyBhZnRlciB0aGV5IGNvbXBsZXRlLlxuICBfdW5zdWJzY3JpYmVBbGwoKSB7XG4gICAgT2JqZWN0LnZhbHVlcyh0aGlzLl9zdWJzY3JpcHRpb25zKS5mb3JFYWNoKChzdWIpID0+IHtcbiAgICAgIC8vIEF2b2lkIGtpbGxpbmcgdGhlIGF1dG91cGRhdGUgc3Vic2NyaXB0aW9uIHNvIHRoYXQgZGV2ZWxvcGVyc1xuICAgICAgLy8gc3RpbGwgZ2V0IGhvdCBjb2RlIHB1c2hlcyB3aGVuIHdyaXRpbmcgdGVzdHMuXG4gICAgICAvL1xuICAgICAgLy8gWFhYIGl0J3MgYSBoYWNrIHRvIGVuY29kZSBrbm93bGVkZ2UgYWJvdXQgYXV0b3VwZGF0ZSBoZXJlLFxuICAgICAgLy8gYnV0IGl0IGRvZXNuJ3Qgc2VlbSB3b3J0aCBpdCB5ZXQgdG8gaGF2ZSBhIHNwZWNpYWwgQVBJIGZvclxuICAgICAgLy8gc3Vic2NyaXB0aW9ucyB0byBwcmVzZXJ2ZSBhZnRlciB1bml0IHRlc3RzLlxuICAgICAgaWYgKHN1Yi5uYW1lICE9PSAnbWV0ZW9yX2F1dG91cGRhdGVfY2xpZW50VmVyc2lvbnMnKSB7XG4gICAgICAgIHN1Yi5zdG9wKCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvLyBTZW5kcyB0aGUgRERQIHN0cmluZ2lmaWNhdGlvbiBvZiB0aGUgZ2l2ZW4gbWVzc2FnZSBvYmplY3RcbiAgX3NlbmQob2JqKSB7XG4gICAgdGhpcy5fc3RyZWFtLnNlbmQoRERQQ29tbW9uLnN0cmluZ2lmeUREUChvYmopKTtcbiAgfVxuXG4gIC8vIFdlIGRldGVjdGVkIHZpYSBERFAtbGV2ZWwgaGVhcnRiZWF0cyB0aGF0IHdlJ3ZlIGxvc3QgdGhlXG4gIC8vIGNvbm5lY3Rpb24uICBVbmxpa2UgYGRpc2Nvbm5lY3RgIG9yIGBjbG9zZWAsIGEgbG9zdCBjb25uZWN0aW9uXG4gIC8vIHdpbGwgYmUgYXV0b21hdGljYWxseSByZXRyaWVkLlxuICBfbG9zdENvbm5lY3Rpb24oZXJyb3IpIHtcbiAgICB0aGlzLl9zdHJlYW0uX2xvc3RDb25uZWN0aW9uKGVycm9yKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAbWVtYmVyT2YgTWV0ZW9yXG4gICAqIEBpbXBvcnRGcm9tUGFja2FnZSBtZXRlb3JcbiAgICogQGFsaWFzIE1ldGVvci5zdGF0dXNcbiAgICogQHN1bW1hcnkgR2V0IHRoZSBjdXJyZW50IGNvbm5lY3Rpb24gc3RhdHVzLiBBIHJlYWN0aXZlIGRhdGEgc291cmNlLlxuICAgKiBAbG9jdXMgQ2xpZW50XG4gICAqL1xuICBzdGF0dXMoLi4uYXJncykge1xuICAgIHJldHVybiB0aGlzLl9zdHJlYW0uc3RhdHVzKC4uLmFyZ3MpO1xuICB9XG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IEZvcmNlIGFuIGltbWVkaWF0ZSByZWNvbm5lY3Rpb24gYXR0ZW1wdCBpZiB0aGUgY2xpZW50IGlzIG5vdCBjb25uZWN0ZWQgdG8gdGhlIHNlcnZlci5cblxuICBUaGlzIG1ldGhvZCBkb2VzIG5vdGhpbmcgaWYgdGhlIGNsaWVudCBpcyBhbHJlYWR5IGNvbm5lY3RlZC5cbiAgICogQG1lbWJlck9mIE1ldGVvclxuICAgKiBAaW1wb3J0RnJvbVBhY2thZ2UgbWV0ZW9yXG4gICAqIEBhbGlhcyBNZXRlb3IucmVjb25uZWN0XG4gICAqIEBsb2N1cyBDbGllbnRcbiAgICovXG4gIHJlY29ubmVjdCguLi5hcmdzKSB7XG4gICAgcmV0dXJuIHRoaXMuX3N0cmVhbS5yZWNvbm5lY3QoLi4uYXJncyk7XG4gIH1cblxuICAvKipcbiAgICogQG1lbWJlck9mIE1ldGVvclxuICAgKiBAaW1wb3J0RnJvbVBhY2thZ2UgbWV0ZW9yXG4gICAqIEBhbGlhcyBNZXRlb3IuZGlzY29ubmVjdFxuICAgKiBAc3VtbWFyeSBEaXNjb25uZWN0IHRoZSBjbGllbnQgZnJvbSB0aGUgc2VydmVyLlxuICAgKiBAbG9jdXMgQ2xpZW50XG4gICAqL1xuICBkaXNjb25uZWN0KC4uLmFyZ3MpIHtcbiAgICByZXR1cm4gdGhpcy5fc3RyZWFtLmRpc2Nvbm5lY3QoLi4uYXJncyk7XG4gIH1cblxuICBjbG9zZSgpIHtcbiAgICByZXR1cm4gdGhpcy5fc3RyZWFtLmRpc2Nvbm5lY3QoeyBfcGVybWFuZW50OiB0cnVlIH0pO1xuICB9XG5cbiAgLy8vXG4gIC8vLyBSZWFjdGl2ZSB1c2VyIHN5c3RlbVxuICAvLy9cbiAgdXNlcklkKCkge1xuICAgIGlmICh0aGlzLl91c2VySWREZXBzKSB0aGlzLl91c2VySWREZXBzLmRlcGVuZCgpO1xuICAgIHJldHVybiB0aGlzLl91c2VySWQ7XG4gIH1cblxuICBzZXRVc2VySWQodXNlcklkKSB7XG4gICAgLy8gQXZvaWQgaW52YWxpZGF0aW5nIGRlcGVuZGVudHMgaWYgc2V0VXNlcklkIGlzIGNhbGxlZCB3aXRoIGN1cnJlbnQgdmFsdWUuXG4gICAgaWYgKHRoaXMuX3VzZXJJZCA9PT0gdXNlcklkKSByZXR1cm47XG4gICAgdGhpcy5fdXNlcklkID0gdXNlcklkO1xuICAgIGlmICh0aGlzLl91c2VySWREZXBzKSB0aGlzLl91c2VySWREZXBzLmNoYW5nZWQoKTtcbiAgfVxuXG4gIC8vIFJldHVybnMgdHJ1ZSBpZiB3ZSBhcmUgaW4gYSBzdGF0ZSBhZnRlciByZWNvbm5lY3Qgb2Ygd2FpdGluZyBmb3Igc3VicyB0byBiZVxuICAvLyByZXZpdmVkIG9yIGVhcmx5IG1ldGhvZHMgdG8gZmluaXNoIHRoZWlyIGRhdGEsIG9yIHdlIGFyZSB3YWl0aW5nIGZvciBhXG4gIC8vIFwid2FpdFwiIG1ldGhvZCB0byBmaW5pc2guXG4gIF93YWl0aW5nRm9yUXVpZXNjZW5jZSgpIHtcbiAgICByZXR1cm4gKFxuICAgICAgISBpc0VtcHR5KHRoaXMuX3N1YnNCZWluZ1Jldml2ZWQpIHx8XG4gICAgICAhIGlzRW1wdHkodGhpcy5fbWV0aG9kc0Jsb2NraW5nUXVpZXNjZW5jZSlcbiAgICApO1xuICB9XG5cbiAgLy8gUmV0dXJucyB0cnVlIGlmIGFueSBtZXRob2Qgd2hvc2UgbWVzc2FnZSBoYXMgYmVlbiBzZW50IHRvIHRoZSBzZXJ2ZXIgaGFzXG4gIC8vIG5vdCB5ZXQgaW52b2tlZCBpdHMgdXNlciBjYWxsYmFjay5cbiAgX2FueU1ldGhvZHNBcmVPdXRzdGFuZGluZygpIHtcbiAgICBjb25zdCBpbnZva2VycyA9IHRoaXMuX21ldGhvZEludm9rZXJzO1xuICAgIHJldHVybiBPYmplY3QudmFsdWVzKGludm9rZXJzKS5zb21lKChpbnZva2VyKSA9PiAhIWludm9rZXIuc2VudE1lc3NhZ2UpO1xuICB9XG5cbiAgX2xpdmVkYXRhX2Nvbm5lY3RlZChtc2cpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcblxuICAgIGlmIChzZWxmLl92ZXJzaW9uICE9PSAncHJlMScgJiYgc2VsZi5faGVhcnRiZWF0SW50ZXJ2YWwgIT09IDApIHtcbiAgICAgIHNlbGYuX2hlYXJ0YmVhdCA9IG5ldyBERFBDb21tb24uSGVhcnRiZWF0KHtcbiAgICAgICAgaGVhcnRiZWF0SW50ZXJ2YWw6IHNlbGYuX2hlYXJ0YmVhdEludGVydmFsLFxuICAgICAgICBoZWFydGJlYXRUaW1lb3V0OiBzZWxmLl9oZWFydGJlYXRUaW1lb3V0LFxuICAgICAgICBvblRpbWVvdXQoKSB7XG4gICAgICAgICAgc2VsZi5fbG9zdENvbm5lY3Rpb24oXG4gICAgICAgICAgICBuZXcgRERQLkNvbm5lY3Rpb25FcnJvcignRERQIGhlYXJ0YmVhdCB0aW1lZCBvdXQnKVxuICAgICAgICAgICk7XG4gICAgICAgIH0sXG4gICAgICAgIHNlbmRQaW5nKCkge1xuICAgICAgICAgIHNlbGYuX3NlbmQoeyBtc2c6ICdwaW5nJyB9KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBzZWxmLl9oZWFydGJlYXQuc3RhcnQoKTtcbiAgICB9XG5cbiAgICAvLyBJZiB0aGlzIGlzIGEgcmVjb25uZWN0LCB3ZSdsbCBoYXZlIHRvIHJlc2V0IGFsbCBzdG9yZXMuXG4gICAgaWYgKHNlbGYuX2xhc3RTZXNzaW9uSWQpIHNlbGYuX3Jlc2V0U3RvcmVzID0gdHJ1ZTtcblxuICAgIGxldCByZWNvbm5lY3RlZFRvUHJldmlvdXNTZXNzaW9uO1xuICAgIGlmICh0eXBlb2YgbXNnLnNlc3Npb24gPT09ICdzdHJpbmcnKSB7XG4gICAgICByZWNvbm5lY3RlZFRvUHJldmlvdXNTZXNzaW9uID0gc2VsZi5fbGFzdFNlc3Npb25JZCA9PT0gbXNnLnNlc3Npb247XG4gICAgICBzZWxmLl9sYXN0U2Vzc2lvbklkID0gbXNnLnNlc3Npb247XG4gICAgfVxuXG4gICAgaWYgKHJlY29ubmVjdGVkVG9QcmV2aW91c1Nlc3Npb24pIHtcbiAgICAgIC8vIFN1Y2Nlc3NmdWwgcmVjb25uZWN0aW9uIC0tIHBpY2sgdXAgd2hlcmUgd2UgbGVmdCBvZmYuICBOb3RlIHRoYXQgcmlnaHRcbiAgICAgIC8vIG5vdywgdGhpcyBuZXZlciBoYXBwZW5zOiB0aGUgc2VydmVyIG5ldmVyIGNvbm5lY3RzIHVzIHRvIGEgcHJldmlvdXNcbiAgICAgIC8vIHNlc3Npb24sIGJlY2F1c2UgRERQIGRvZXNuJ3QgcHJvdmlkZSBlbm91Z2ggZGF0YSBmb3IgdGhlIHNlcnZlciB0byBrbm93XG4gICAgICAvLyB3aGF0IG1lc3NhZ2VzIHRoZSBjbGllbnQgaGFzIHByb2Nlc3NlZC4gV2UgbmVlZCB0byBpbXByb3ZlIEREUCB0byBtYWtlXG4gICAgICAvLyB0aGlzIHBvc3NpYmxlLCBhdCB3aGljaCBwb2ludCB3ZSdsbCBwcm9iYWJseSBuZWVkIG1vcmUgY29kZSBoZXJlLlxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIFNlcnZlciBkb2Vzbid0IGhhdmUgb3VyIGRhdGEgYW55IG1vcmUuIFJlLXN5bmMgYSBuZXcgc2Vzc2lvbi5cblxuICAgIC8vIEZvcmdldCBhYm91dCBtZXNzYWdlcyB3ZSB3ZXJlIGJ1ZmZlcmluZyBmb3IgdW5rbm93biBjb2xsZWN0aW9ucy4gVGhleSdsbFxuICAgIC8vIGJlIHJlc2VudCBpZiBzdGlsbCByZWxldmFudC5cbiAgICBzZWxmLl91cGRhdGVzRm9yVW5rbm93blN0b3JlcyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cbiAgICBpZiAoc2VsZi5fcmVzZXRTdG9yZXMpIHtcbiAgICAgIC8vIEZvcmdldCBhYm91dCB0aGUgZWZmZWN0cyBvZiBzdHVicy4gV2UnbGwgYmUgcmVzZXR0aW5nIGFsbCBjb2xsZWN0aW9uc1xuICAgICAgLy8gYW55d2F5LlxuICAgICAgc2VsZi5fZG9jdW1lbnRzV3JpdHRlbkJ5U3R1YiA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gICAgICBzZWxmLl9zZXJ2ZXJEb2N1bWVudHMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICAgIH1cblxuICAgIC8vIENsZWFyIF9hZnRlclVwZGF0ZUNhbGxiYWNrcy5cbiAgICBzZWxmLl9hZnRlclVwZGF0ZUNhbGxiYWNrcyA9IFtdO1xuXG4gICAgLy8gTWFyayBhbGwgbmFtZWQgc3Vic2NyaXB0aW9ucyB3aGljaCBhcmUgcmVhZHkgKGllLCB3ZSBhbHJlYWR5IGNhbGxlZCB0aGVcbiAgICAvLyByZWFkeSBjYWxsYmFjaykgYXMgbmVlZGluZyB0byBiZSByZXZpdmVkLlxuICAgIC8vIFhYWCBXZSBzaG91bGQgYWxzbyBibG9jayByZWNvbm5lY3QgcXVpZXNjZW5jZSB1bnRpbCB1bm5hbWVkIHN1YnNjcmlwdGlvbnNcbiAgICAvLyAgICAgKGVnLCBhdXRvcHVibGlzaCkgYXJlIGRvbmUgcmUtcHVibGlzaGluZyB0byBhdm9pZCBmbGlja2VyIVxuICAgIHNlbGYuX3N1YnNCZWluZ1Jldml2ZWQgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICAgIE9iamVjdC5lbnRyaWVzKHNlbGYuX3N1YnNjcmlwdGlvbnMpLmZvckVhY2goKFtpZCwgc3ViXSkgPT4ge1xuICAgICAgaWYgKHN1Yi5yZWFkeSkge1xuICAgICAgICBzZWxmLl9zdWJzQmVpbmdSZXZpdmVkW2lkXSA9IHRydWU7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBBcnJhbmdlIGZvciBcImhhbGYtZmluaXNoZWRcIiBtZXRob2RzIHRvIGhhdmUgdGhlaXIgY2FsbGJhY2tzIHJ1biwgYW5kXG4gICAgLy8gdHJhY2sgbWV0aG9kcyB0aGF0IHdlcmUgc2VudCBvbiB0aGlzIGNvbm5lY3Rpb24gc28gdGhhdCB3ZSBkb24ndFxuICAgIC8vIHF1aWVzY2UgdW50aWwgdGhleSBhcmUgYWxsIGRvbmUuXG4gICAgLy9cbiAgICAvLyBTdGFydCBieSBjbGVhcmluZyBfbWV0aG9kc0Jsb2NraW5nUXVpZXNjZW5jZTogbWV0aG9kcyBzZW50IGJlZm9yZVxuICAgIC8vIHJlY29ubmVjdCBkb24ndCBtYXR0ZXIsIGFuZCBhbnkgXCJ3YWl0XCIgbWV0aG9kcyBzZW50IG9uIHRoZSBuZXcgY29ubmVjdGlvblxuICAgIC8vIHRoYXQgd2UgZHJvcCBoZXJlIHdpbGwgYmUgcmVzdG9yZWQgYnkgdGhlIGxvb3AgYmVsb3cuXG4gICAgc2VsZi5fbWV0aG9kc0Jsb2NraW5nUXVpZXNjZW5jZSA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gICAgaWYgKHNlbGYuX3Jlc2V0U3RvcmVzKSB7XG4gICAgICBjb25zdCBpbnZva2VycyA9IHNlbGYuX21ldGhvZEludm9rZXJzO1xuICAgICAga2V5cyhpbnZva2VycykuZm9yRWFjaChpZCA9PiB7XG4gICAgICAgIGNvbnN0IGludm9rZXIgPSBpbnZva2Vyc1tpZF07XG4gICAgICAgIGlmIChpbnZva2VyLmdvdFJlc3VsdCgpKSB7XG4gICAgICAgICAgLy8gVGhpcyBtZXRob2QgYWxyZWFkeSBnb3QgaXRzIHJlc3VsdCwgYnV0IGl0IGRpZG4ndCBjYWxsIGl0cyBjYWxsYmFja1xuICAgICAgICAgIC8vIGJlY2F1c2UgaXRzIGRhdGEgZGlkbid0IGJlY29tZSB2aXNpYmxlLiBXZSBkaWQgbm90IHJlc2VuZCB0aGVcbiAgICAgICAgICAvLyBtZXRob2QgUlBDLiBXZSdsbCBjYWxsIGl0cyBjYWxsYmFjayB3aGVuIHdlIGdldCBhIGZ1bGwgcXVpZXNjZSxcbiAgICAgICAgICAvLyBzaW5jZSB0aGF0J3MgYXMgY2xvc2UgYXMgd2UnbGwgZ2V0IHRvIFwiZGF0YSBtdXN0IGJlIHZpc2libGVcIi5cbiAgICAgICAgICBzZWxmLl9hZnRlclVwZGF0ZUNhbGxiYWNrcy5wdXNoKFxuICAgICAgICAgICAgKC4uLmFyZ3MpID0+IGludm9rZXIuZGF0YVZpc2libGUoLi4uYXJncylcbiAgICAgICAgICApO1xuICAgICAgICB9IGVsc2UgaWYgKGludm9rZXIuc2VudE1lc3NhZ2UpIHtcbiAgICAgICAgICAvLyBUaGlzIG1ldGhvZCBoYXMgYmVlbiBzZW50IG9uIHRoaXMgY29ubmVjdGlvbiAobWF5YmUgYXMgYSByZXNlbmRcbiAgICAgICAgICAvLyBmcm9tIHRoZSBsYXN0IGNvbm5lY3Rpb24sIG1heWJlIGZyb20gb25SZWNvbm5lY3QsIG1heWJlIGp1c3QgdmVyeVxuICAgICAgICAgIC8vIHF1aWNrbHkgYmVmb3JlIHByb2Nlc3NpbmcgdGhlIGNvbm5lY3RlZCBtZXNzYWdlKS5cbiAgICAgICAgICAvL1xuICAgICAgICAgIC8vIFdlIGRvbid0IG5lZWQgdG8gZG8gYW55dGhpbmcgc3BlY2lhbCB0byBlbnN1cmUgaXRzIGNhbGxiYWNrcyBnZXRcbiAgICAgICAgICAvLyBjYWxsZWQsIGJ1dCB3ZSdsbCBjb3VudCBpdCBhcyBhIG1ldGhvZCB3aGljaCBpcyBwcmV2ZW50aW5nXG4gICAgICAgICAgLy8gcmVjb25uZWN0IHF1aWVzY2VuY2UuIChlZywgaXQgbWlnaHQgYmUgYSBsb2dpbiBtZXRob2QgdGhhdCB3YXMgcnVuXG4gICAgICAgICAgLy8gZnJvbSBvblJlY29ubmVjdCwgYW5kIHdlIGRvbid0IHdhbnQgdG8gc2VlIGZsaWNrZXIgYnkgc2VlaW5nIGFcbiAgICAgICAgICAvLyBsb2dnZWQtb3V0IHN0YXRlLilcbiAgICAgICAgICBzZWxmLl9tZXRob2RzQmxvY2tpbmdRdWllc2NlbmNlW2ludm9rZXIubWV0aG9kSWRdID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgc2VsZi5fbWVzc2FnZXNCdWZmZXJlZFVudGlsUXVpZXNjZW5jZSA9IFtdO1xuXG4gICAgLy8gSWYgd2UncmUgbm90IHdhaXRpbmcgb24gYW55IG1ldGhvZHMgb3Igc3Vicywgd2UgY2FuIHJlc2V0IHRoZSBzdG9yZXMgYW5kXG4gICAgLy8gY2FsbCB0aGUgY2FsbGJhY2tzIGltbWVkaWF0ZWx5LlxuICAgIGlmICghIHNlbGYuX3dhaXRpbmdGb3JRdWllc2NlbmNlKCkpIHtcbiAgICAgIGlmIChzZWxmLl9yZXNldFN0b3Jlcykge1xuICAgICAgICBPYmplY3QudmFsdWVzKHNlbGYuX3N0b3JlcykuZm9yRWFjaCgoc3RvcmUpID0+IHtcbiAgICAgICAgICBzdG9yZS5iZWdpblVwZGF0ZSgwLCB0cnVlKTtcbiAgICAgICAgICBzdG9yZS5lbmRVcGRhdGUoKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHNlbGYuX3Jlc2V0U3RvcmVzID0gZmFsc2U7XG4gICAgICB9XG4gICAgICBzZWxmLl9ydW5BZnRlclVwZGF0ZUNhbGxiYWNrcygpO1xuICAgIH1cbiAgfVxuXG4gIF9wcm9jZXNzT25lRGF0YU1lc3NhZ2UobXNnLCB1cGRhdGVzKSB7XG4gICAgY29uc3QgbWVzc2FnZVR5cGUgPSBtc2cubXNnO1xuXG4gICAgLy8gbXNnIGlzIG9uZSBvZiBbJ2FkZGVkJywgJ2NoYW5nZWQnLCAncmVtb3ZlZCcsICdyZWFkeScsICd1cGRhdGVkJ11cbiAgICBpZiAobWVzc2FnZVR5cGUgPT09ICdhZGRlZCcpIHtcbiAgICAgIHRoaXMuX3Byb2Nlc3NfYWRkZWQobXNnLCB1cGRhdGVzKTtcbiAgICB9IGVsc2UgaWYgKG1lc3NhZ2VUeXBlID09PSAnY2hhbmdlZCcpIHtcbiAgICAgIHRoaXMuX3Byb2Nlc3NfY2hhbmdlZChtc2csIHVwZGF0ZXMpO1xuICAgIH0gZWxzZSBpZiAobWVzc2FnZVR5cGUgPT09ICdyZW1vdmVkJykge1xuICAgICAgdGhpcy5fcHJvY2Vzc19yZW1vdmVkKG1zZywgdXBkYXRlcyk7XG4gICAgfSBlbHNlIGlmIChtZXNzYWdlVHlwZSA9PT0gJ3JlYWR5Jykge1xuICAgICAgdGhpcy5fcHJvY2Vzc19yZWFkeShtc2csIHVwZGF0ZXMpO1xuICAgIH0gZWxzZSBpZiAobWVzc2FnZVR5cGUgPT09ICd1cGRhdGVkJykge1xuICAgICAgdGhpcy5fcHJvY2Vzc191cGRhdGVkKG1zZywgdXBkYXRlcyk7XG4gICAgfSBlbHNlIGlmIChtZXNzYWdlVHlwZSA9PT0gJ25vc3ViJykge1xuICAgICAgLy8gaWdub3JlIHRoaXNcbiAgICB9IGVsc2Uge1xuICAgICAgTWV0ZW9yLl9kZWJ1ZygnZGlzY2FyZGluZyB1bmtub3duIGxpdmVkYXRhIGRhdGEgbWVzc2FnZSB0eXBlJywgbXNnKTtcbiAgICB9XG4gIH1cblxuICBfbGl2ZWRhdGFfZGF0YShtc2cpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcblxuICAgIGlmIChzZWxmLl93YWl0aW5nRm9yUXVpZXNjZW5jZSgpKSB7XG4gICAgICBzZWxmLl9tZXNzYWdlc0J1ZmZlcmVkVW50aWxRdWllc2NlbmNlLnB1c2gobXNnKTtcblxuICAgICAgaWYgKG1zZy5tc2cgPT09ICdub3N1YicpIHtcbiAgICAgICAgZGVsZXRlIHNlbGYuX3N1YnNCZWluZ1Jldml2ZWRbbXNnLmlkXTtcbiAgICAgIH1cblxuICAgICAgaWYgKG1zZy5zdWJzKSB7XG4gICAgICAgIG1zZy5zdWJzLmZvckVhY2goc3ViSWQgPT4ge1xuICAgICAgICAgIGRlbGV0ZSBzZWxmLl9zdWJzQmVpbmdSZXZpdmVkW3N1YklkXTtcbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIGlmIChtc2cubWV0aG9kcykge1xuICAgICAgICBtc2cubWV0aG9kcy5mb3JFYWNoKG1ldGhvZElkID0+IHtcbiAgICAgICAgICBkZWxldGUgc2VsZi5fbWV0aG9kc0Jsb2NraW5nUXVpZXNjZW5jZVttZXRob2RJZF07XG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICBpZiAoc2VsZi5fd2FpdGluZ0ZvclF1aWVzY2VuY2UoKSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIC8vIE5vIG1ldGhvZHMgb3Igc3VicyBhcmUgYmxvY2tpbmcgcXVpZXNjZW5jZSFcbiAgICAgIC8vIFdlJ2xsIG5vdyBwcm9jZXNzIGFuZCBhbGwgb2Ygb3VyIGJ1ZmZlcmVkIG1lc3NhZ2VzLCByZXNldCBhbGwgc3RvcmVzLFxuICAgICAgLy8gYW5kIGFwcGx5IHRoZW0gYWxsIGF0IG9uY2UuXG5cbiAgICAgIGNvbnN0IGJ1ZmZlcmVkTWVzc2FnZXMgPSBzZWxmLl9tZXNzYWdlc0J1ZmZlcmVkVW50aWxRdWllc2NlbmNlO1xuICAgICAgT2JqZWN0LnZhbHVlcyhidWZmZXJlZE1lc3NhZ2VzKS5mb3JFYWNoKGJ1ZmZlcmVkTWVzc2FnZSA9PiB7XG4gICAgICAgIHNlbGYuX3Byb2Nlc3NPbmVEYXRhTWVzc2FnZShcbiAgICAgICAgICBidWZmZXJlZE1lc3NhZ2UsXG4gICAgICAgICAgc2VsZi5fYnVmZmVyZWRXcml0ZXNcbiAgICAgICAgKTtcbiAgICAgIH0pO1xuXG4gICAgICBzZWxmLl9tZXNzYWdlc0J1ZmZlcmVkVW50aWxRdWllc2NlbmNlID0gW107XG5cbiAgICB9IGVsc2Uge1xuICAgICAgc2VsZi5fcHJvY2Vzc09uZURhdGFNZXNzYWdlKG1zZywgc2VsZi5fYnVmZmVyZWRXcml0ZXMpO1xuICAgIH1cblxuICAgIC8vIEltbWVkaWF0ZWx5IGZsdXNoIHdyaXRlcyB3aGVuOlxuICAgIC8vICAxLiBCdWZmZXJpbmcgaXMgZGlzYWJsZWQuIE9yO1xuICAgIC8vICAyLiBhbnkgbm9uLShhZGRlZC9jaGFuZ2VkL3JlbW92ZWQpIG1lc3NhZ2UgYXJyaXZlcy5cbiAgICBjb25zdCBzdGFuZGFyZFdyaXRlID1cbiAgICAgIG1zZy5tc2cgPT09IFwiYWRkZWRcIiB8fFxuICAgICAgbXNnLm1zZyA9PT0gXCJjaGFuZ2VkXCIgfHxcbiAgICAgIG1zZy5tc2cgPT09IFwicmVtb3ZlZFwiO1xuXG4gICAgaWYgKHNlbGYuX2J1ZmZlcmVkV3JpdGVzSW50ZXJ2YWwgPT09IDAgfHwgISBzdGFuZGFyZFdyaXRlKSB7XG4gICAgICBzZWxmLl9mbHVzaEJ1ZmZlcmVkV3JpdGVzKCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKHNlbGYuX2J1ZmZlcmVkV3JpdGVzRmx1c2hBdCA9PT0gbnVsbCkge1xuICAgICAgc2VsZi5fYnVmZmVyZWRXcml0ZXNGbHVzaEF0ID1cbiAgICAgICAgbmV3IERhdGUoKS52YWx1ZU9mKCkgKyBzZWxmLl9idWZmZXJlZFdyaXRlc01heEFnZTtcbiAgICB9IGVsc2UgaWYgKHNlbGYuX2J1ZmZlcmVkV3JpdGVzRmx1c2hBdCA8IG5ldyBEYXRlKCkudmFsdWVPZigpKSB7XG4gICAgICBzZWxmLl9mbHVzaEJ1ZmZlcmVkV3JpdGVzKCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKHNlbGYuX2J1ZmZlcmVkV3JpdGVzRmx1c2hIYW5kbGUpIHtcbiAgICAgIGNsZWFyVGltZW91dChzZWxmLl9idWZmZXJlZFdyaXRlc0ZsdXNoSGFuZGxlKTtcbiAgICB9XG4gICAgc2VsZi5fYnVmZmVyZWRXcml0ZXNGbHVzaEhhbmRsZSA9IHNldFRpbWVvdXQoXG4gICAgICBzZWxmLl9fZmx1c2hCdWZmZXJlZFdyaXRlcyxcbiAgICAgIHNlbGYuX2J1ZmZlcmVkV3JpdGVzSW50ZXJ2YWxcbiAgICApO1xuICB9XG5cbiAgX2ZsdXNoQnVmZmVyZWRXcml0ZXMoKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgaWYgKHNlbGYuX2J1ZmZlcmVkV3JpdGVzRmx1c2hIYW5kbGUpIHtcbiAgICAgIGNsZWFyVGltZW91dChzZWxmLl9idWZmZXJlZFdyaXRlc0ZsdXNoSGFuZGxlKTtcbiAgICAgIHNlbGYuX2J1ZmZlcmVkV3JpdGVzRmx1c2hIYW5kbGUgPSBudWxsO1xuICAgIH1cblxuICAgIHNlbGYuX2J1ZmZlcmVkV3JpdGVzRmx1c2hBdCA9IG51bGw7XG4gICAgLy8gV2UgbmVlZCB0byBjbGVhciB0aGUgYnVmZmVyIGJlZm9yZSBwYXNzaW5nIGl0IHRvXG4gICAgLy8gIHBlcmZvcm1Xcml0ZXMuIEFzIHRoZXJlJ3Mgbm8gZ3VhcmFudGVlIHRoYXQgaXRcbiAgICAvLyAgd2lsbCBleGl0IGNsZWFubHkuXG4gICAgY29uc3Qgd3JpdGVzID0gc2VsZi5fYnVmZmVyZWRXcml0ZXM7XG4gICAgc2VsZi5fYnVmZmVyZWRXcml0ZXMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICAgIHNlbGYuX3BlcmZvcm1Xcml0ZXMod3JpdGVzKTtcbiAgfVxuXG4gIF9wZXJmb3JtV3JpdGVzKHVwZGF0ZXMpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcblxuICAgIGlmIChzZWxmLl9yZXNldFN0b3JlcyB8fCAhIGlzRW1wdHkodXBkYXRlcykpIHtcbiAgICAgIC8vIEJlZ2luIGEgdHJhbnNhY3Rpb25hbCB1cGRhdGUgb2YgZWFjaCBzdG9yZS5cblxuICAgICAgT2JqZWN0LmVudHJpZXMoc2VsZi5fc3RvcmVzKS5mb3JFYWNoKChbc3RvcmVOYW1lLCBzdG9yZV0pID0+IHtcbiAgICAgICAgc3RvcmUuYmVnaW5VcGRhdGUoXG4gICAgICAgICAgaGFzT3duLmNhbGwodXBkYXRlcywgc3RvcmVOYW1lKVxuICAgICAgICAgICAgPyB1cGRhdGVzW3N0b3JlTmFtZV0ubGVuZ3RoXG4gICAgICAgICAgICA6IDAsXG4gICAgICAgICAgc2VsZi5fcmVzZXRTdG9yZXNcbiAgICAgICAgKTtcbiAgICAgIH0pO1xuXG4gICAgICBzZWxmLl9yZXNldFN0b3JlcyA9IGZhbHNlO1xuXG4gICAgICBPYmplY3QuZW50cmllcyh1cGRhdGVzKS5mb3JFYWNoKChbc3RvcmVOYW1lLCB1cGRhdGVNZXNzYWdlc10pID0+IHtcbiAgICAgICAgY29uc3Qgc3RvcmUgPSBzZWxmLl9zdG9yZXNbc3RvcmVOYW1lXTtcbiAgICAgICAgaWYgKHN0b3JlKSB7XG4gICAgICAgICAgdXBkYXRlTWVzc2FnZXMuZm9yRWFjaCh1cGRhdGVNZXNzYWdlID0+IHtcbiAgICAgICAgICAgIHN0b3JlLnVwZGF0ZSh1cGRhdGVNZXNzYWdlKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBOb2JvZHkncyBsaXN0ZW5pbmcgZm9yIHRoaXMgZGF0YS4gUXVldWUgaXQgdXAgdW50aWxcbiAgICAgICAgICAvLyBzb21lb25lIHdhbnRzIGl0LlxuICAgICAgICAgIC8vIFhYWCBtZW1vcnkgdXNlIHdpbGwgZ3JvdyB3aXRob3V0IGJvdW5kIGlmIHlvdSBmb3JnZXQgdG9cbiAgICAgICAgICAvLyBjcmVhdGUgYSBjb2xsZWN0aW9uIG9yIGp1c3QgZG9uJ3QgY2FyZSBhYm91dCBpdC4uLiBnb2luZ1xuICAgICAgICAgIC8vIHRvIGhhdmUgdG8gZG8gc29tZXRoaW5nIGFib3V0IHRoYXQuXG4gICAgICAgICAgY29uc3QgdXBkYXRlcyA9IHNlbGYuX3VwZGF0ZXNGb3JVbmtub3duU3RvcmVzO1xuXG4gICAgICAgICAgaWYgKCEgaGFzT3duLmNhbGwodXBkYXRlcywgc3RvcmVOYW1lKSkge1xuICAgICAgICAgICAgdXBkYXRlc1tzdG9yZU5hbWVdID0gW107XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgdXBkYXRlc1tzdG9yZU5hbWVdLnB1c2goLi4udXBkYXRlTWVzc2FnZXMpO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgLy8gRW5kIHVwZGF0ZSB0cmFuc2FjdGlvbi5cbiAgICAgIE9iamVjdC52YWx1ZXMoc2VsZi5fc3RvcmVzKS5mb3JFYWNoKChzdG9yZSkgPT4ge1xuICAgICAgICBzdG9yZS5lbmRVcGRhdGUoKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHNlbGYuX3J1bkFmdGVyVXBkYXRlQ2FsbGJhY2tzKCk7XG4gIH1cblxuICAvLyBDYWxsIGFueSBjYWxsYmFja3MgZGVmZXJyZWQgd2l0aCBfcnVuV2hlbkFsbFNlcnZlckRvY3NBcmVGbHVzaGVkIHdob3NlXG4gIC8vIHJlbGV2YW50IGRvY3MgaGF2ZSBiZWVuIGZsdXNoZWQsIGFzIHdlbGwgYXMgZGF0YVZpc2libGUgY2FsbGJhY2tzIGF0XG4gIC8vIHJlY29ubmVjdC1xdWllc2NlbmNlIHRpbWUuXG4gIF9ydW5BZnRlclVwZGF0ZUNhbGxiYWNrcygpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICBjb25zdCBjYWxsYmFja3MgPSBzZWxmLl9hZnRlclVwZGF0ZUNhbGxiYWNrcztcbiAgICBzZWxmLl9hZnRlclVwZGF0ZUNhbGxiYWNrcyA9IFtdO1xuICAgIGNhbGxiYWNrcy5mb3JFYWNoKChjKSA9PiB7XG4gICAgICBjKCk7XG4gICAgfSk7XG4gIH1cblxuICBfcHVzaFVwZGF0ZSh1cGRhdGVzLCBjb2xsZWN0aW9uLCBtc2cpIHtcbiAgICBpZiAoISBoYXNPd24uY2FsbCh1cGRhdGVzLCBjb2xsZWN0aW9uKSkge1xuICAgICAgdXBkYXRlc1tjb2xsZWN0aW9uXSA9IFtdO1xuICAgIH1cbiAgICB1cGRhdGVzW2NvbGxlY3Rpb25dLnB1c2gobXNnKTtcbiAgfVxuXG4gIF9nZXRTZXJ2ZXJEb2MoY29sbGVjdGlvbiwgaWQpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICBpZiAoISBoYXNPd24uY2FsbChzZWxmLl9zZXJ2ZXJEb2N1bWVudHMsIGNvbGxlY3Rpb24pKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgY29uc3Qgc2VydmVyRG9jc0ZvckNvbGxlY3Rpb24gPSBzZWxmLl9zZXJ2ZXJEb2N1bWVudHNbY29sbGVjdGlvbl07XG4gICAgcmV0dXJuIHNlcnZlckRvY3NGb3JDb2xsZWN0aW9uLmdldChpZCkgfHwgbnVsbDtcbiAgfVxuXG4gIF9wcm9jZXNzX2FkZGVkKG1zZywgdXBkYXRlcykge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIGNvbnN0IGlkID0gTW9uZ29JRC5pZFBhcnNlKG1zZy5pZCk7XG4gICAgY29uc3Qgc2VydmVyRG9jID0gc2VsZi5fZ2V0U2VydmVyRG9jKG1zZy5jb2xsZWN0aW9uLCBpZCk7XG4gICAgaWYgKHNlcnZlckRvYykge1xuICAgICAgLy8gU29tZSBvdXRzdGFuZGluZyBzdHViIHdyb3RlIGhlcmUuXG4gICAgICBjb25zdCBpc0V4aXN0aW5nID0gc2VydmVyRG9jLmRvY3VtZW50ICE9PSB1bmRlZmluZWQ7XG5cbiAgICAgIHNlcnZlckRvYy5kb2N1bWVudCA9IG1zZy5maWVsZHMgfHwgT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgICAgIHNlcnZlckRvYy5kb2N1bWVudC5faWQgPSBpZDtcblxuICAgICAgaWYgKHNlbGYuX3Jlc2V0U3RvcmVzKSB7XG4gICAgICAgIC8vIER1cmluZyByZWNvbm5lY3QgdGhlIHNlcnZlciBpcyBzZW5kaW5nIGFkZHMgZm9yIGV4aXN0aW5nIGlkcy5cbiAgICAgICAgLy8gQWx3YXlzIHB1c2ggYW4gdXBkYXRlIHNvIHRoYXQgZG9jdW1lbnQgc3RheXMgaW4gdGhlIHN0b3JlIGFmdGVyXG4gICAgICAgIC8vIHJlc2V0LiBVc2UgY3VycmVudCB2ZXJzaW9uIG9mIHRoZSBkb2N1bWVudCBmb3IgdGhpcyB1cGRhdGUsIHNvXG4gICAgICAgIC8vIHRoYXQgc3R1Yi13cml0dGVuIHZhbHVlcyBhcmUgcHJlc2VydmVkLlxuICAgICAgICBjb25zdCBjdXJyZW50RG9jID0gc2VsZi5fc3RvcmVzW21zZy5jb2xsZWN0aW9uXS5nZXREb2MobXNnLmlkKTtcbiAgICAgICAgaWYgKGN1cnJlbnREb2MgIT09IHVuZGVmaW5lZCkgbXNnLmZpZWxkcyA9IGN1cnJlbnREb2M7XG5cbiAgICAgICAgc2VsZi5fcHVzaFVwZGF0ZSh1cGRhdGVzLCBtc2cuY29sbGVjdGlvbiwgbXNnKTtcbiAgICAgIH0gZWxzZSBpZiAoaXNFeGlzdGluZykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1NlcnZlciBzZW50IGFkZCBmb3IgZXhpc3RpbmcgaWQ6ICcgKyBtc2cuaWQpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBzZWxmLl9wdXNoVXBkYXRlKHVwZGF0ZXMsIG1zZy5jb2xsZWN0aW9uLCBtc2cpO1xuICAgIH1cbiAgfVxuXG4gIF9wcm9jZXNzX2NoYW5nZWQobXNnLCB1cGRhdGVzKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgY29uc3Qgc2VydmVyRG9jID0gc2VsZi5fZ2V0U2VydmVyRG9jKG1zZy5jb2xsZWN0aW9uLCBNb25nb0lELmlkUGFyc2UobXNnLmlkKSk7XG4gICAgaWYgKHNlcnZlckRvYykge1xuICAgICAgaWYgKHNlcnZlckRvYy5kb2N1bWVudCA9PT0gdW5kZWZpbmVkKVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1NlcnZlciBzZW50IGNoYW5nZWQgZm9yIG5vbmV4aXN0aW5nIGlkOiAnICsgbXNnLmlkKTtcbiAgICAgIERpZmZTZXF1ZW5jZS5hcHBseUNoYW5nZXMoc2VydmVyRG9jLmRvY3VtZW50LCBtc2cuZmllbGRzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgc2VsZi5fcHVzaFVwZGF0ZSh1cGRhdGVzLCBtc2cuY29sbGVjdGlvbiwgbXNnKTtcbiAgICB9XG4gIH1cblxuICBfcHJvY2Vzc19yZW1vdmVkKG1zZywgdXBkYXRlcykge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIGNvbnN0IHNlcnZlckRvYyA9IHNlbGYuX2dldFNlcnZlckRvYyhtc2cuY29sbGVjdGlvbiwgTW9uZ29JRC5pZFBhcnNlKG1zZy5pZCkpO1xuICAgIGlmIChzZXJ2ZXJEb2MpIHtcbiAgICAgIC8vIFNvbWUgb3V0c3RhbmRpbmcgc3R1YiB3cm90ZSBoZXJlLlxuICAgICAgaWYgKHNlcnZlckRvYy5kb2N1bWVudCA9PT0gdW5kZWZpbmVkKVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1NlcnZlciBzZW50IHJlbW92ZWQgZm9yIG5vbmV4aXN0aW5nIGlkOicgKyBtc2cuaWQpO1xuICAgICAgc2VydmVyRG9jLmRvY3VtZW50ID0gdW5kZWZpbmVkO1xuICAgIH0gZWxzZSB7XG4gICAgICBzZWxmLl9wdXNoVXBkYXRlKHVwZGF0ZXMsIG1zZy5jb2xsZWN0aW9uLCB7XG4gICAgICAgIG1zZzogJ3JlbW92ZWQnLFxuICAgICAgICBjb2xsZWN0aW9uOiBtc2cuY29sbGVjdGlvbixcbiAgICAgICAgaWQ6IG1zZy5pZFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgX3Byb2Nlc3NfdXBkYXRlZChtc2csIHVwZGF0ZXMpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICAvLyBQcm9jZXNzIFwibWV0aG9kIGRvbmVcIiBtZXNzYWdlcy5cblxuICAgIG1zZy5tZXRob2RzLmZvckVhY2goKG1ldGhvZElkKSA9PiB7XG4gICAgICBjb25zdCBkb2NzID0gc2VsZi5fZG9jdW1lbnRzV3JpdHRlbkJ5U3R1YlttZXRob2RJZF0gfHwge307XG4gICAgICBPYmplY3QudmFsdWVzKGRvY3MpLmZvckVhY2goKHdyaXR0ZW4pID0+IHtcbiAgICAgICAgY29uc3Qgc2VydmVyRG9jID0gc2VsZi5fZ2V0U2VydmVyRG9jKHdyaXR0ZW4uY29sbGVjdGlvbiwgd3JpdHRlbi5pZCk7XG4gICAgICAgIGlmICghIHNlcnZlckRvYykge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignTG9zdCBzZXJ2ZXJEb2MgZm9yICcgKyBKU09OLnN0cmluZ2lmeSh3cml0dGVuKSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCEgc2VydmVyRG9jLndyaXR0ZW5CeVN0dWJzW21ldGhvZElkXSkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICdEb2MgJyArXG4gICAgICAgICAgICAgIEpTT04uc3RyaW5naWZ5KHdyaXR0ZW4pICtcbiAgICAgICAgICAgICAgJyBub3Qgd3JpdHRlbiBieSAgbWV0aG9kICcgK1xuICAgICAgICAgICAgICBtZXRob2RJZFxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlIHNlcnZlckRvYy53cml0dGVuQnlTdHVic1ttZXRob2RJZF07XG4gICAgICAgIGlmIChpc0VtcHR5KHNlcnZlckRvYy53cml0dGVuQnlTdHVicykpIHtcbiAgICAgICAgICAvLyBBbGwgbWV0aG9kcyB3aG9zZSBzdHVicyB3cm90ZSB0aGlzIG1ldGhvZCBoYXZlIGNvbXBsZXRlZCEgV2UgY2FuXG4gICAgICAgICAgLy8gbm93IGNvcHkgdGhlIHNhdmVkIGRvY3VtZW50IHRvIHRoZSBkYXRhYmFzZSAocmV2ZXJ0aW5nIHRoZSBzdHViJ3NcbiAgICAgICAgICAvLyBjaGFuZ2UgaWYgdGhlIHNlcnZlciBkaWQgbm90IHdyaXRlIHRvIHRoaXMgb2JqZWN0LCBvciBhcHBseWluZyB0aGVcbiAgICAgICAgICAvLyBzZXJ2ZXIncyB3cml0ZXMgaWYgaXQgZGlkKS5cblxuICAgICAgICAgIC8vIFRoaXMgaXMgYSBmYWtlIGRkcCAncmVwbGFjZScgbWVzc2FnZS4gIEl0J3MganVzdCBmb3IgdGFsa2luZ1xuICAgICAgICAgIC8vIGJldHdlZW4gbGl2ZWRhdGEgY29ubmVjdGlvbnMgYW5kIG1pbmltb25nby4gIChXZSBoYXZlIHRvIHN0cmluZ2lmeVxuICAgICAgICAgIC8vIHRoZSBJRCBiZWNhdXNlIGl0J3Mgc3VwcG9zZWQgdG8gbG9vayBsaWtlIGEgd2lyZSBtZXNzYWdlLilcbiAgICAgICAgICBzZWxmLl9wdXNoVXBkYXRlKHVwZGF0ZXMsIHdyaXR0ZW4uY29sbGVjdGlvbiwge1xuICAgICAgICAgICAgbXNnOiAncmVwbGFjZScsXG4gICAgICAgICAgICBpZDogTW9uZ29JRC5pZFN0cmluZ2lmeSh3cml0dGVuLmlkKSxcbiAgICAgICAgICAgIHJlcGxhY2U6IHNlcnZlckRvYy5kb2N1bWVudFxuICAgICAgICAgIH0pO1xuICAgICAgICAgIC8vIENhbGwgYWxsIGZsdXNoIGNhbGxiYWNrcy5cblxuICAgICAgICAgIHNlcnZlckRvYy5mbHVzaENhbGxiYWNrcy5mb3JFYWNoKChjKSA9PiB7XG4gICAgICAgICAgICBjKCk7XG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICAvLyBEZWxldGUgdGhpcyBjb21wbGV0ZWQgc2VydmVyRG9jdW1lbnQuIERvbid0IGJvdGhlciB0byBHQyBlbXB0eVxuICAgICAgICAgIC8vIElkTWFwcyBpbnNpZGUgc2VsZi5fc2VydmVyRG9jdW1lbnRzLCBzaW5jZSB0aGVyZSBwcm9iYWJseSBhcmVuJ3RcbiAgICAgICAgICAvLyBtYW55IGNvbGxlY3Rpb25zIGFuZCB0aGV5J2xsIGJlIHdyaXR0ZW4gcmVwZWF0ZWRseS5cbiAgICAgICAgICBzZWxmLl9zZXJ2ZXJEb2N1bWVudHNbd3JpdHRlbi5jb2xsZWN0aW9uXS5yZW1vdmUod3JpdHRlbi5pZCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgZGVsZXRlIHNlbGYuX2RvY3VtZW50c1dyaXR0ZW5CeVN0dWJbbWV0aG9kSWRdO1xuXG4gICAgICAvLyBXZSB3YW50IHRvIGNhbGwgdGhlIGRhdGEtd3JpdHRlbiBjYWxsYmFjaywgYnV0IHdlIGNhbid0IGRvIHNvIHVudGlsIGFsbFxuICAgICAgLy8gY3VycmVudGx5IGJ1ZmZlcmVkIG1lc3NhZ2VzIGFyZSBmbHVzaGVkLlxuICAgICAgY29uc3QgY2FsbGJhY2tJbnZva2VyID0gc2VsZi5fbWV0aG9kSW52b2tlcnNbbWV0aG9kSWRdO1xuICAgICAgaWYgKCEgY2FsbGJhY2tJbnZva2VyKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignTm8gY2FsbGJhY2sgaW52b2tlciBmb3IgbWV0aG9kICcgKyBtZXRob2RJZCk7XG4gICAgICB9XG5cbiAgICAgIHNlbGYuX3J1bldoZW5BbGxTZXJ2ZXJEb2NzQXJlRmx1c2hlZChcbiAgICAgICAgKC4uLmFyZ3MpID0+IGNhbGxiYWNrSW52b2tlci5kYXRhVmlzaWJsZSguLi5hcmdzKVxuICAgICAgKTtcbiAgICB9KTtcbiAgfVxuXG4gIF9wcm9jZXNzX3JlYWR5KG1zZywgdXBkYXRlcykge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIC8vIFByb2Nlc3MgXCJzdWIgcmVhZHlcIiBtZXNzYWdlcy4gXCJzdWIgcmVhZHlcIiBtZXNzYWdlcyBkb24ndCB0YWtlIGVmZmVjdFxuICAgIC8vIHVudGlsIGFsbCBjdXJyZW50IHNlcnZlciBkb2N1bWVudHMgaGF2ZSBiZWVuIGZsdXNoZWQgdG8gdGhlIGxvY2FsXG4gICAgLy8gZGF0YWJhc2UuIFdlIGNhbiB1c2UgYSB3cml0ZSBmZW5jZSB0byBpbXBsZW1lbnQgdGhpcy5cblxuICAgIG1zZy5zdWJzLmZvckVhY2goKHN1YklkKSA9PiB7XG4gICAgICBzZWxmLl9ydW5XaGVuQWxsU2VydmVyRG9jc0FyZUZsdXNoZWQoKCkgPT4ge1xuICAgICAgICBjb25zdCBzdWJSZWNvcmQgPSBzZWxmLl9zdWJzY3JpcHRpb25zW3N1YklkXTtcbiAgICAgICAgLy8gRGlkIHdlIGFscmVhZHkgdW5zdWJzY3JpYmU/XG4gICAgICAgIGlmICghc3ViUmVjb3JkKSByZXR1cm47XG4gICAgICAgIC8vIERpZCB3ZSBhbHJlYWR5IHJlY2VpdmUgYSByZWFkeSBtZXNzYWdlPyAoT29wcyEpXG4gICAgICAgIGlmIChzdWJSZWNvcmQucmVhZHkpIHJldHVybjtcbiAgICAgICAgc3ViUmVjb3JkLnJlYWR5ID0gdHJ1ZTtcbiAgICAgICAgc3ViUmVjb3JkLnJlYWR5Q2FsbGJhY2sgJiYgc3ViUmVjb3JkLnJlYWR5Q2FsbGJhY2soKTtcbiAgICAgICAgc3ViUmVjb3JkLnJlYWR5RGVwcy5jaGFuZ2VkKCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8vIEVuc3VyZXMgdGhhdCBcImZcIiB3aWxsIGJlIGNhbGxlZCBhZnRlciBhbGwgZG9jdW1lbnRzIGN1cnJlbnRseSBpblxuICAvLyBfc2VydmVyRG9jdW1lbnRzIGhhdmUgYmVlbiB3cml0dGVuIHRvIHRoZSBsb2NhbCBjYWNoZS4gZiB3aWxsIG5vdCBiZSBjYWxsZWRcbiAgLy8gaWYgdGhlIGNvbm5lY3Rpb24gaXMgbG9zdCBiZWZvcmUgdGhlbiFcbiAgX3J1bldoZW5BbGxTZXJ2ZXJEb2NzQXJlRmx1c2hlZChmKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgY29uc3QgcnVuRkFmdGVyVXBkYXRlcyA9ICgpID0+IHtcbiAgICAgIHNlbGYuX2FmdGVyVXBkYXRlQ2FsbGJhY2tzLnB1c2goZik7XG4gICAgfTtcbiAgICBsZXQgdW5mbHVzaGVkU2VydmVyRG9jQ291bnQgPSAwO1xuICAgIGNvbnN0IG9uU2VydmVyRG9jRmx1c2ggPSAoKSA9PiB7XG4gICAgICAtLXVuZmx1c2hlZFNlcnZlckRvY0NvdW50O1xuICAgICAgaWYgKHVuZmx1c2hlZFNlcnZlckRvY0NvdW50ID09PSAwKSB7XG4gICAgICAgIC8vIFRoaXMgd2FzIHRoZSBsYXN0IGRvYyB0byBmbHVzaCEgQXJyYW5nZSB0byBydW4gZiBhZnRlciB0aGUgdXBkYXRlc1xuICAgICAgICAvLyBoYXZlIGJlZW4gYXBwbGllZC5cbiAgICAgICAgcnVuRkFmdGVyVXBkYXRlcygpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBPYmplY3QudmFsdWVzKHNlbGYuX3NlcnZlckRvY3VtZW50cykuZm9yRWFjaCgoc2VydmVyRG9jdW1lbnRzKSA9PiB7XG4gICAgICBzZXJ2ZXJEb2N1bWVudHMuZm9yRWFjaCgoc2VydmVyRG9jKSA9PiB7XG4gICAgICAgIGNvbnN0IHdyaXR0ZW5CeVN0dWJGb3JBTWV0aG9kV2l0aFNlbnRNZXNzYWdlID1cbiAgICAgICAgICBrZXlzKHNlcnZlckRvYy53cml0dGVuQnlTdHVicykuc29tZShtZXRob2RJZCA9PiB7XG4gICAgICAgICAgICBjb25zdCBpbnZva2VyID0gc2VsZi5fbWV0aG9kSW52b2tlcnNbbWV0aG9kSWRdO1xuICAgICAgICAgICAgcmV0dXJuIGludm9rZXIgJiYgaW52b2tlci5zZW50TWVzc2FnZTtcbiAgICAgICAgICB9KTtcblxuICAgICAgICBpZiAod3JpdHRlbkJ5U3R1YkZvckFNZXRob2RXaXRoU2VudE1lc3NhZ2UpIHtcbiAgICAgICAgICArK3VuZmx1c2hlZFNlcnZlckRvY0NvdW50O1xuICAgICAgICAgIHNlcnZlckRvYy5mbHVzaENhbGxiYWNrcy5wdXNoKG9uU2VydmVyRG9jRmx1c2gpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcbiAgICBpZiAodW5mbHVzaGVkU2VydmVyRG9jQ291bnQgPT09IDApIHtcbiAgICAgIC8vIFRoZXJlIGFyZW4ndCBhbnkgYnVmZmVyZWQgZG9jcyAtLS0gd2UgY2FuIGNhbGwgZiBhcyBzb29uIGFzIHRoZSBjdXJyZW50XG4gICAgICAvLyByb3VuZCBvZiB1cGRhdGVzIGlzIGFwcGxpZWQhXG4gICAgICBydW5GQWZ0ZXJVcGRhdGVzKCk7XG4gICAgfVxuICB9XG5cbiAgX2xpdmVkYXRhX25vc3ViKG1zZykge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuXG4gICAgLy8gRmlyc3QgcGFzcyBpdCB0aHJvdWdoIF9saXZlZGF0YV9kYXRhLCB3aGljaCBvbmx5IHVzZXMgaXQgdG8gaGVscCBnZXRcbiAgICAvLyB0b3dhcmRzIHF1aWVzY2VuY2UuXG4gICAgc2VsZi5fbGl2ZWRhdGFfZGF0YShtc2cpO1xuXG4gICAgLy8gRG8gdGhlIHJlc3Qgb2Ygb3VyIHByb2Nlc3NpbmcgaW1tZWRpYXRlbHksIHdpdGggbm9cbiAgICAvLyBidWZmZXJpbmctdW50aWwtcXVpZXNjZW5jZS5cblxuICAgIC8vIHdlIHdlcmVuJ3Qgc3ViYmVkIGFueXdheSwgb3Igd2UgaW5pdGlhdGVkIHRoZSB1bnN1Yi5cbiAgICBpZiAoISBoYXNPd24uY2FsbChzZWxmLl9zdWJzY3JpcHRpb25zLCBtc2cuaWQpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gWFhYIENPTVBBVCBXSVRIIDEuMC4zLjEgI2Vycm9yQ2FsbGJhY2tcbiAgICBjb25zdCBlcnJvckNhbGxiYWNrID0gc2VsZi5fc3Vic2NyaXB0aW9uc1ttc2cuaWRdLmVycm9yQ2FsbGJhY2s7XG4gICAgY29uc3Qgc3RvcENhbGxiYWNrID0gc2VsZi5fc3Vic2NyaXB0aW9uc1ttc2cuaWRdLnN0b3BDYWxsYmFjaztcblxuICAgIHNlbGYuX3N1YnNjcmlwdGlvbnNbbXNnLmlkXS5yZW1vdmUoKTtcblxuICAgIGNvbnN0IG1ldGVvckVycm9yRnJvbU1zZyA9IG1zZ0FyZyA9PiB7XG4gICAgICByZXR1cm4gKFxuICAgICAgICBtc2dBcmcgJiZcbiAgICAgICAgbXNnQXJnLmVycm9yICYmXG4gICAgICAgIG5ldyBNZXRlb3IuRXJyb3IoXG4gICAgICAgICAgbXNnQXJnLmVycm9yLmVycm9yLFxuICAgICAgICAgIG1zZ0FyZy5lcnJvci5yZWFzb24sXG4gICAgICAgICAgbXNnQXJnLmVycm9yLmRldGFpbHNcbiAgICAgICAgKVxuICAgICAgKTtcbiAgICB9O1xuXG4gICAgLy8gWFhYIENPTVBBVCBXSVRIIDEuMC4zLjEgI2Vycm9yQ2FsbGJhY2tcbiAgICBpZiAoZXJyb3JDYWxsYmFjayAmJiBtc2cuZXJyb3IpIHtcbiAgICAgIGVycm9yQ2FsbGJhY2sobWV0ZW9yRXJyb3JGcm9tTXNnKG1zZykpO1xuICAgIH1cblxuICAgIGlmIChzdG9wQ2FsbGJhY2spIHtcbiAgICAgIHN0b3BDYWxsYmFjayhtZXRlb3JFcnJvckZyb21Nc2cobXNnKSk7XG4gICAgfVxuICB9XG5cbiAgX2xpdmVkYXRhX3Jlc3VsdChtc2cpIHtcbiAgICAvLyBpZCwgcmVzdWx0IG9yIGVycm9yLiBlcnJvciBoYXMgZXJyb3IgKGNvZGUpLCByZWFzb24sIGRldGFpbHNcblxuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuXG4gICAgLy8gTGV0cyBtYWtlIHN1cmUgdGhlcmUgYXJlIG5vIGJ1ZmZlcmVkIHdyaXRlcyBiZWZvcmUgcmV0dXJuaW5nIHJlc3VsdC5cbiAgICBpZiAoISBpc0VtcHR5KHNlbGYuX2J1ZmZlcmVkV3JpdGVzKSkge1xuICAgICAgc2VsZi5fZmx1c2hCdWZmZXJlZFdyaXRlcygpO1xuICAgIH1cblxuICAgIC8vIGZpbmQgdGhlIG91dHN0YW5kaW5nIHJlcXVlc3RcbiAgICAvLyBzaG91bGQgYmUgTygxKSBpbiBuZWFybHkgYWxsIHJlYWxpc3RpYyB1c2UgY2FzZXNcbiAgICBpZiAoaXNFbXB0eShzZWxmLl9vdXRzdGFuZGluZ01ldGhvZEJsb2NrcykpIHtcbiAgICAgIE1ldGVvci5fZGVidWcoJ1JlY2VpdmVkIG1ldGhvZCByZXN1bHQgYnV0IG5vIG1ldGhvZHMgb3V0c3RhbmRpbmcnKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgY3VycmVudE1ldGhvZEJsb2NrID0gc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3NbMF0ubWV0aG9kcztcbiAgICBsZXQgaTtcbiAgICBjb25zdCBtID0gY3VycmVudE1ldGhvZEJsb2NrLmZpbmQoKG1ldGhvZCwgaWR4KSA9PiB7XG4gICAgICBjb25zdCBmb3VuZCA9IG1ldGhvZC5tZXRob2RJZCA9PT0gbXNnLmlkO1xuICAgICAgaWYgKGZvdW5kKSBpID0gaWR4O1xuICAgICAgcmV0dXJuIGZvdW5kO1xuICAgIH0pO1xuICAgIGlmICghbSkge1xuICAgICAgTWV0ZW9yLl9kZWJ1ZyhcIkNhbid0IG1hdGNoIG1ldGhvZCByZXNwb25zZSB0byBvcmlnaW5hbCBtZXRob2QgY2FsbFwiLCBtc2cpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIFJlbW92ZSBmcm9tIGN1cnJlbnQgbWV0aG9kIGJsb2NrLiBUaGlzIG1heSBsZWF2ZSB0aGUgYmxvY2sgZW1wdHksIGJ1dCB3ZVxuICAgIC8vIGRvbid0IG1vdmUgb24gdG8gdGhlIG5leHQgYmxvY2sgdW50aWwgdGhlIGNhbGxiYWNrIGhhcyBiZWVuIGRlbGl2ZXJlZCwgaW5cbiAgICAvLyBfb3V0c3RhbmRpbmdNZXRob2RGaW5pc2hlZC5cbiAgICBjdXJyZW50TWV0aG9kQmxvY2suc3BsaWNlKGksIDEpO1xuXG4gICAgaWYgKGhhc093bi5jYWxsKG1zZywgJ2Vycm9yJykpIHtcbiAgICAgIG0ucmVjZWl2ZVJlc3VsdChcbiAgICAgICAgbmV3IE1ldGVvci5FcnJvcihtc2cuZXJyb3IuZXJyb3IsIG1zZy5lcnJvci5yZWFzb24sIG1zZy5lcnJvci5kZXRhaWxzKVxuICAgICAgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gbXNnLnJlc3VsdCBtYXkgYmUgdW5kZWZpbmVkIGlmIHRoZSBtZXRob2QgZGlkbid0IHJldHVybiBhXG4gICAgICAvLyB2YWx1ZVxuICAgICAgbS5yZWNlaXZlUmVzdWx0KHVuZGVmaW5lZCwgbXNnLnJlc3VsdCk7XG4gICAgfVxuICB9XG5cbiAgLy8gQ2FsbGVkIGJ5IE1ldGhvZEludm9rZXIgYWZ0ZXIgYSBtZXRob2QncyBjYWxsYmFjayBpcyBpbnZva2VkLiAgSWYgdGhpcyB3YXNcbiAgLy8gdGhlIGxhc3Qgb3V0c3RhbmRpbmcgbWV0aG9kIGluIHRoZSBjdXJyZW50IGJsb2NrLCBydW5zIHRoZSBuZXh0IGJsb2NrLiBJZlxuICAvLyB0aGVyZSBhcmUgbm8gbW9yZSBtZXRob2RzLCBjb25zaWRlciBhY2NlcHRpbmcgYSBob3QgY29kZSBwdXNoLlxuICBfb3V0c3RhbmRpbmdNZXRob2RGaW5pc2hlZCgpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICBpZiAoc2VsZi5fYW55TWV0aG9kc0FyZU91dHN0YW5kaW5nKCkpIHJldHVybjtcblxuICAgIC8vIE5vIG1ldGhvZHMgYXJlIG91dHN0YW5kaW5nLiBUaGlzIHNob3VsZCBtZWFuIHRoYXQgdGhlIGZpcnN0IGJsb2NrIG9mXG4gICAgLy8gbWV0aG9kcyBpcyBlbXB0eS4gKE9yIGl0IG1pZ2h0IG5vdCBleGlzdCwgaWYgdGhpcyB3YXMgYSBtZXRob2QgdGhhdFxuICAgIC8vIGhhbGYtZmluaXNoZWQgYmVmb3JlIGRpc2Nvbm5lY3QvcmVjb25uZWN0LilcbiAgICBpZiAoISBpc0VtcHR5KHNlbGYuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzKSkge1xuICAgICAgY29uc3QgZmlyc3RCbG9jayA9IHNlbGYuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzLnNoaWZ0KCk7XG4gICAgICBpZiAoISBpc0VtcHR5KGZpcnN0QmxvY2subWV0aG9kcykpXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAnTm8gbWV0aG9kcyBvdXRzdGFuZGluZyBidXQgbm9uZW1wdHkgYmxvY2s6ICcgK1xuICAgICAgICAgICAgSlNPTi5zdHJpbmdpZnkoZmlyc3RCbG9jaylcbiAgICAgICAgKTtcblxuICAgICAgLy8gU2VuZCB0aGUgb3V0c3RhbmRpbmcgbWV0aG9kcyBub3cgaW4gdGhlIGZpcnN0IGJsb2NrLlxuICAgICAgaWYgKCEgaXNFbXB0eShzZWxmLl9vdXRzdGFuZGluZ01ldGhvZEJsb2NrcykpXG4gICAgICAgIHNlbGYuX3NlbmRPdXRzdGFuZGluZ01ldGhvZHMoKTtcbiAgICB9XG5cbiAgICAvLyBNYXliZSBhY2NlcHQgYSBob3QgY29kZSBwdXNoLlxuICAgIHNlbGYuX21heWJlTWlncmF0ZSgpO1xuICB9XG5cbiAgLy8gU2VuZHMgbWVzc2FnZXMgZm9yIGFsbCB0aGUgbWV0aG9kcyBpbiB0aGUgZmlyc3QgYmxvY2sgaW5cbiAgLy8gX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzLlxuICBfc2VuZE91dHN0YW5kaW5nTWV0aG9kcygpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcblxuICAgIGlmIChpc0VtcHR5KHNlbGYuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHNlbGYuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzWzBdLm1ldGhvZHMuZm9yRWFjaChtID0+IHtcbiAgICAgIG0uc2VuZE1lc3NhZ2UoKTtcbiAgICB9KTtcbiAgfVxuXG4gIF9saXZlZGF0YV9lcnJvcihtc2cpIHtcbiAgICBNZXRlb3IuX2RlYnVnKCdSZWNlaXZlZCBlcnJvciBmcm9tIHNlcnZlcjogJywgbXNnLnJlYXNvbik7XG4gICAgaWYgKG1zZy5vZmZlbmRpbmdNZXNzYWdlKSBNZXRlb3IuX2RlYnVnKCdGb3I6ICcsIG1zZy5vZmZlbmRpbmdNZXNzYWdlKTtcbiAgfVxuXG4gIF9jYWxsT25SZWNvbm5lY3RBbmRTZW5kQXBwcm9wcmlhdGVPdXRzdGFuZGluZ01ldGhvZHMoKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgY29uc3Qgb2xkT3V0c3RhbmRpbmdNZXRob2RCbG9ja3MgPSBzZWxmLl9vdXRzdGFuZGluZ01ldGhvZEJsb2NrcztcbiAgICBzZWxmLl9vdXRzdGFuZGluZ01ldGhvZEJsb2NrcyA9IFtdO1xuXG4gICAgc2VsZi5vblJlY29ubmVjdCAmJiBzZWxmLm9uUmVjb25uZWN0KCk7XG4gICAgRERQLl9yZWNvbm5lY3RIb29rLmVhY2goY2FsbGJhY2sgPT4ge1xuICAgICAgY2FsbGJhY2soc2VsZik7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9KTtcblxuICAgIGlmIChpc0VtcHR5KG9sZE91dHN0YW5kaW5nTWV0aG9kQmxvY2tzKSkgcmV0dXJuO1xuXG4gICAgLy8gV2UgaGF2ZSBhdCBsZWFzdCBvbmUgYmxvY2sgd29ydGggb2Ygb2xkIG91dHN0YW5kaW5nIG1ldGhvZHMgdG8gdHJ5XG4gICAgLy8gYWdhaW4uIEZpcnN0OiBkaWQgb25SZWNvbm5lY3QgYWN0dWFsbHkgc2VuZCBhbnl0aGluZz8gSWYgbm90LCB3ZSBqdXN0XG4gICAgLy8gcmVzdG9yZSBhbGwgb3V0c3RhbmRpbmcgbWV0aG9kcyBhbmQgcnVuIHRoZSBmaXJzdCBibG9jay5cbiAgICBpZiAoaXNFbXB0eShzZWxmLl9vdXRzdGFuZGluZ01ldGhvZEJsb2NrcykpIHtcbiAgICAgIHNlbGYuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzID0gb2xkT3V0c3RhbmRpbmdNZXRob2RCbG9ja3M7XG4gICAgICBzZWxmLl9zZW5kT3V0c3RhbmRpbmdNZXRob2RzKCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gT0ssIHRoZXJlIGFyZSBibG9ja3Mgb24gYm90aCBzaWRlcy4gU3BlY2lhbCBjYXNlOiBtZXJnZSB0aGUgbGFzdCBibG9jayBvZlxuICAgIC8vIHRoZSByZWNvbm5lY3QgbWV0aG9kcyB3aXRoIHRoZSBmaXJzdCBibG9jayBvZiB0aGUgb3JpZ2luYWwgbWV0aG9kcywgaWZcbiAgICAvLyBuZWl0aGVyIG9mIHRoZW0gYXJlIFwid2FpdFwiIGJsb2Nrcy5cbiAgICBpZiAoISBsYXN0KHNlbGYuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzKS53YWl0ICYmXG4gICAgICAgICEgb2xkT3V0c3RhbmRpbmdNZXRob2RCbG9ja3NbMF0ud2FpdCkge1xuICAgICAgb2xkT3V0c3RhbmRpbmdNZXRob2RCbG9ja3NbMF0ubWV0aG9kcy5mb3JFYWNoKG0gPT4ge1xuICAgICAgICBsYXN0KHNlbGYuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzKS5tZXRob2RzLnB1c2gobSk7XG5cbiAgICAgICAgLy8gSWYgdGhpcyBcImxhc3QgYmxvY2tcIiBpcyBhbHNvIHRoZSBmaXJzdCBibG9jaywgc2VuZCB0aGUgbWVzc2FnZS5cbiAgICAgICAgaWYgKHNlbGYuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgIG0uc2VuZE1lc3NhZ2UoKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIG9sZE91dHN0YW5kaW5nTWV0aG9kQmxvY2tzLnNoaWZ0KCk7XG4gICAgfVxuXG4gICAgLy8gTm93IGFkZCB0aGUgcmVzdCBvZiB0aGUgb3JpZ2luYWwgYmxvY2tzIG9uLlxuICAgIHNlbGYuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzLnB1c2goLi4ub2xkT3V0c3RhbmRpbmdNZXRob2RCbG9ja3MpO1xuICB9XG5cbiAgLy8gV2UgY2FuIGFjY2VwdCBhIGhvdCBjb2RlIHB1c2ggaWYgdGhlcmUgYXJlIG5vIG1ldGhvZHMgaW4gZmxpZ2h0LlxuICBfcmVhZHlUb01pZ3JhdGUoKSB7XG4gICAgcmV0dXJuIGlzRW1wdHkodGhpcy5fbWV0aG9kSW52b2tlcnMpO1xuICB9XG5cbiAgLy8gSWYgd2Ugd2VyZSBibG9ja2luZyBhIG1pZ3JhdGlvbiwgc2VlIGlmIGl0J3Mgbm93IHBvc3NpYmxlIHRvIGNvbnRpbnVlLlxuICAvLyBDYWxsIHdoZW5ldmVyIHRoZSBzZXQgb2Ygb3V0c3RhbmRpbmcvYmxvY2tlZCBtZXRob2RzIHNocmlua3MuXG4gIF9tYXliZU1pZ3JhdGUoKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgaWYgKHNlbGYuX3JldHJ5TWlncmF0ZSAmJiBzZWxmLl9yZWFkeVRvTWlncmF0ZSgpKSB7XG4gICAgICBzZWxmLl9yZXRyeU1pZ3JhdGUoKTtcbiAgICAgIHNlbGYuX3JldHJ5TWlncmF0ZSA9IG51bGw7XG4gICAgfVxuICB9XG5cbiAgb25NZXNzYWdlKHJhd19tc2cpIHtcbiAgICBsZXQgbXNnO1xuICAgIHRyeSB7XG4gICAgICBtc2cgPSBERFBDb21tb24ucGFyc2VERFAocmF3X21zZyk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgTWV0ZW9yLl9kZWJ1ZygnRXhjZXB0aW9uIHdoaWxlIHBhcnNpbmcgRERQJywgZSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gQW55IG1lc3NhZ2UgY291bnRzIGFzIHJlY2VpdmluZyBhIHBvbmcsIGFzIGl0IGRlbW9uc3RyYXRlcyB0aGF0XG4gICAgLy8gdGhlIHNlcnZlciBpcyBzdGlsbCBhbGl2ZS5cbiAgICBpZiAodGhpcy5faGVhcnRiZWF0KSB7XG4gICAgICB0aGlzLl9oZWFydGJlYXQubWVzc2FnZVJlY2VpdmVkKCk7XG4gICAgfVxuXG4gICAgaWYgKG1zZyA9PT0gbnVsbCB8fCAhbXNnLm1zZykge1xuICAgICAgLy8gWFhYIENPTVBBVCBXSVRIIDAuNi42LiBpZ25vcmUgdGhlIG9sZCB3ZWxjb21lIG1lc3NhZ2UgZm9yIGJhY2tcbiAgICAgIC8vIGNvbXBhdC4gIFJlbW92ZSB0aGlzICdpZicgb25jZSB0aGUgc2VydmVyIHN0b3BzIHNlbmRpbmcgd2VsY29tZVxuICAgICAgLy8gbWVzc2FnZXMgKHN0cmVhbV9zZXJ2ZXIuanMpLlxuICAgICAgaWYgKCEobXNnICYmIG1zZy5zZXJ2ZXJfaWQpKVxuICAgICAgICBNZXRlb3IuX2RlYnVnKCdkaXNjYXJkaW5nIGludmFsaWQgbGl2ZWRhdGEgbWVzc2FnZScsIG1zZyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKG1zZy5tc2cgPT09ICdjb25uZWN0ZWQnKSB7XG4gICAgICB0aGlzLl92ZXJzaW9uID0gdGhpcy5fdmVyc2lvblN1Z2dlc3Rpb247XG4gICAgICB0aGlzLl9saXZlZGF0YV9jb25uZWN0ZWQobXNnKTtcbiAgICAgIHRoaXMub3B0aW9ucy5vbkNvbm5lY3RlZCgpO1xuICAgIH0gZWxzZSBpZiAobXNnLm1zZyA9PT0gJ2ZhaWxlZCcpIHtcbiAgICAgIGlmICh0aGlzLl9zdXBwb3J0ZWRERFBWZXJzaW9ucy5pbmRleE9mKG1zZy52ZXJzaW9uKSA+PSAwKSB7XG4gICAgICAgIHRoaXMuX3ZlcnNpb25TdWdnZXN0aW9uID0gbXNnLnZlcnNpb247XG4gICAgICAgIHRoaXMuX3N0cmVhbS5yZWNvbm5lY3QoeyBfZm9yY2U6IHRydWUgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBkZXNjcmlwdGlvbiA9XG4gICAgICAgICAgJ0REUCB2ZXJzaW9uIG5lZ290aWF0aW9uIGZhaWxlZDsgc2VydmVyIHJlcXVlc3RlZCB2ZXJzaW9uICcgK1xuICAgICAgICAgIG1zZy52ZXJzaW9uO1xuICAgICAgICB0aGlzLl9zdHJlYW0uZGlzY29ubmVjdCh7IF9wZXJtYW5lbnQ6IHRydWUsIF9lcnJvcjogZGVzY3JpcHRpb24gfSk7XG4gICAgICAgIHRoaXMub3B0aW9ucy5vbkREUFZlcnNpb25OZWdvdGlhdGlvbkZhaWx1cmUoZGVzY3JpcHRpb24pO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAobXNnLm1zZyA9PT0gJ3BpbmcnICYmIHRoaXMub3B0aW9ucy5yZXNwb25kVG9QaW5ncykge1xuICAgICAgdGhpcy5fc2VuZCh7IG1zZzogJ3BvbmcnLCBpZDogbXNnLmlkIH0pO1xuICAgIH0gZWxzZSBpZiAobXNnLm1zZyA9PT0gJ3BvbmcnKSB7XG4gICAgICAvLyBub29wLCBhcyB3ZSBhc3N1bWUgZXZlcnl0aGluZydzIGEgcG9uZ1xuICAgIH0gZWxzZSBpZiAoXG4gICAgICBbJ2FkZGVkJywgJ2NoYW5nZWQnLCAncmVtb3ZlZCcsICdyZWFkeScsICd1cGRhdGVkJ10uaW5jbHVkZXMobXNnLm1zZylcbiAgICApIHtcbiAgICAgIHRoaXMuX2xpdmVkYXRhX2RhdGEobXNnKTtcbiAgICB9IGVsc2UgaWYgKG1zZy5tc2cgPT09ICdub3N1YicpIHtcbiAgICAgIHRoaXMuX2xpdmVkYXRhX25vc3ViKG1zZyk7XG4gICAgfSBlbHNlIGlmIChtc2cubXNnID09PSAncmVzdWx0Jykge1xuICAgICAgdGhpcy5fbGl2ZWRhdGFfcmVzdWx0KG1zZyk7XG4gICAgfSBlbHNlIGlmIChtc2cubXNnID09PSAnZXJyb3InKSB7XG4gICAgICB0aGlzLl9saXZlZGF0YV9lcnJvcihtc2cpO1xuICAgIH0gZWxzZSB7XG4gICAgICBNZXRlb3IuX2RlYnVnKCdkaXNjYXJkaW5nIHVua25vd24gbGl2ZWRhdGEgbWVzc2FnZSB0eXBlJywgbXNnKTtcbiAgICB9XG4gIH1cblxuICBvblJlc2V0KCkge1xuICAgIC8vIFNlbmQgYSBjb25uZWN0IG1lc3NhZ2UgYXQgdGhlIGJlZ2lubmluZyBvZiB0aGUgc3RyZWFtLlxuICAgIC8vIE5PVEU6IHJlc2V0IGlzIGNhbGxlZCBldmVuIG9uIHRoZSBmaXJzdCBjb25uZWN0aW9uLCBzbyB0aGlzIGlzXG4gICAgLy8gdGhlIG9ubHkgcGxhY2Ugd2Ugc2VuZCB0aGlzIG1lc3NhZ2UuXG4gICAgY29uc3QgbXNnID0geyBtc2c6ICdjb25uZWN0JyB9O1xuICAgIGlmICh0aGlzLl9sYXN0U2Vzc2lvbklkKSBtc2cuc2Vzc2lvbiA9IHRoaXMuX2xhc3RTZXNzaW9uSWQ7XG4gICAgbXNnLnZlcnNpb24gPSB0aGlzLl92ZXJzaW9uU3VnZ2VzdGlvbiB8fCB0aGlzLl9zdXBwb3J0ZWRERFBWZXJzaW9uc1swXTtcbiAgICB0aGlzLl92ZXJzaW9uU3VnZ2VzdGlvbiA9IG1zZy52ZXJzaW9uO1xuICAgIG1zZy5zdXBwb3J0ID0gdGhpcy5fc3VwcG9ydGVkRERQVmVyc2lvbnM7XG4gICAgdGhpcy5fc2VuZChtc2cpO1xuXG4gICAgLy8gTWFyayBub24tcmV0cnkgY2FsbHMgYXMgZmFpbGVkLiBUaGlzIGhhcyB0byBiZSBkb25lIGVhcmx5IGFzIGdldHRpbmcgdGhlc2UgbWV0aG9kcyBvdXQgb2YgdGhlXG4gICAgLy8gY3VycmVudCBibG9jayBpcyBwcmV0dHkgaW1wb3J0YW50IHRvIG1ha2luZyBzdXJlIHRoYXQgcXVpZXNjZW5jZSBpcyBwcm9wZXJseSBjYWxjdWxhdGVkLCBhc1xuICAgIC8vIHdlbGwgYXMgcG9zc2libHkgbW92aW5nIG9uIHRvIGFub3RoZXIgdXNlZnVsIGJsb2NrLlxuXG4gICAgLy8gT25seSBib3RoZXIgdGVzdGluZyBpZiB0aGVyZSBpcyBhbiBvdXRzdGFuZGluZ01ldGhvZEJsb2NrICh0aGVyZSBtaWdodCBub3QgYmUsIGVzcGVjaWFsbHkgaWZcbiAgICAvLyB3ZSBhcmUgY29ubmVjdGluZyBmb3IgdGhlIGZpcnN0IHRpbWUuXG4gICAgaWYgKHRoaXMuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzLmxlbmd0aCA+IDApIHtcbiAgICAgIC8vIElmIHRoZXJlIGlzIGFuIG91dHN0YW5kaW5nIG1ldGhvZCBibG9jaywgd2Ugb25seSBjYXJlIGFib3V0IHRoZSBmaXJzdCBvbmUgYXMgdGhhdCBpcyB0aGVcbiAgICAgIC8vIG9uZSB0aGF0IGNvdWxkIGhhdmUgYWxyZWFkeSBzZW50IG1lc3NhZ2VzIHdpdGggbm8gcmVzcG9uc2UsIHRoYXQgYXJlIG5vdCBhbGxvd2VkIHRvIHJldHJ5LlxuICAgICAgY29uc3QgY3VycmVudE1ldGhvZEJsb2NrID0gdGhpcy5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3NbMF0ubWV0aG9kcztcbiAgICAgIHRoaXMuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzWzBdLm1ldGhvZHMgPSBjdXJyZW50TWV0aG9kQmxvY2suZmlsdGVyKFxuICAgICAgICBtZXRob2RJbnZva2VyID0+IHtcbiAgICAgICAgICAvLyBNZXRob2RzIHdpdGggJ25vUmV0cnknIG9wdGlvbiBzZXQgYXJlIG5vdCBhbGxvd2VkIHRvIHJlLXNlbmQgYWZ0ZXJcbiAgICAgICAgICAvLyByZWNvdmVyaW5nIGRyb3BwZWQgY29ubmVjdGlvbi5cbiAgICAgICAgICBpZiAobWV0aG9kSW52b2tlci5zZW50TWVzc2FnZSAmJiBtZXRob2RJbnZva2VyLm5vUmV0cnkpIHtcbiAgICAgICAgICAgIC8vIE1ha2Ugc3VyZSB0aGF0IHRoZSBtZXRob2QgaXMgdG9sZCB0aGF0IGl0IGZhaWxlZC5cbiAgICAgICAgICAgIG1ldGhvZEludm9rZXIucmVjZWl2ZVJlc3VsdChcbiAgICAgICAgICAgICAgbmV3IE1ldGVvci5FcnJvcihcbiAgICAgICAgICAgICAgICAnaW52b2NhdGlvbi1mYWlsZWQnLFxuICAgICAgICAgICAgICAgICdNZXRob2QgaW52b2NhdGlvbiBtaWdodCBoYXZlIGZhaWxlZCBkdWUgdG8gZHJvcHBlZCBjb25uZWN0aW9uLiAnICtcbiAgICAgICAgICAgICAgICAgICdGYWlsaW5nIGJlY2F1c2UgYG5vUmV0cnlgIG9wdGlvbiB3YXMgcGFzc2VkIHRvIE1ldGVvci5hcHBseS4nXG4gICAgICAgICAgICAgIClcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gT25seSBrZWVwIGEgbWV0aG9kIGlmIGl0IHdhc24ndCBzZW50IG9yIGl0J3MgYWxsb3dlZCB0byByZXRyeS5cbiAgICAgICAgICAvLyBUaGlzIG1heSBsZWF2ZSB0aGUgYmxvY2sgZW1wdHksIGJ1dCB3ZSBkb24ndCBtb3ZlIG9uIHRvIHRoZSBuZXh0XG4gICAgICAgICAgLy8gYmxvY2sgdW50aWwgdGhlIGNhbGxiYWNrIGhhcyBiZWVuIGRlbGl2ZXJlZCwgaW4gX291dHN0YW5kaW5nTWV0aG9kRmluaXNoZWQuXG4gICAgICAgICAgcmV0dXJuICEobWV0aG9kSW52b2tlci5zZW50TWVzc2FnZSAmJiBtZXRob2RJbnZva2VyLm5vUmV0cnkpO1xuICAgICAgICB9XG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIE5vdywgdG8gbWluaW1pemUgc2V0dXAgbGF0ZW5jeSwgZ28gYWhlYWQgYW5kIGJsYXN0IG91dCBhbGwgb2ZcbiAgICAvLyBvdXIgcGVuZGluZyBtZXRob2RzIGFuZHMgc3Vic2NyaXB0aW9ucyBiZWZvcmUgd2UndmUgZXZlbiB0YWtlblxuICAgIC8vIHRoZSBuZWNlc3NhcnkgUlRUIHRvIGtub3cgaWYgd2Ugc3VjY2Vzc2Z1bGx5IHJlY29ubmVjdGVkLiAoMSlcbiAgICAvLyBUaGV5J3JlIHN1cHBvc2VkIHRvIGJlIGlkZW1wb3RlbnQsIGFuZCB3aGVyZSB0aGV5IGFyZSBub3QsXG4gICAgLy8gdGhleSBjYW4gYmxvY2sgcmV0cnkgaW4gYXBwbHk7ICgyKSBldmVuIGlmIHdlIGRpZCByZWNvbm5lY3QsXG4gICAgLy8gd2UncmUgbm90IHN1cmUgd2hhdCBtZXNzYWdlcyBtaWdodCBoYXZlIGdvdHRlbiBsb3N0XG4gICAgLy8gKGluIGVpdGhlciBkaXJlY3Rpb24pIHNpbmNlIHdlIHdlcmUgZGlzY29ubmVjdGVkIChUQ1AgYmVpbmdcbiAgICAvLyBzbG9wcHkgYWJvdXQgdGhhdC4pXG5cbiAgICAvLyBJZiB0aGUgY3VycmVudCBibG9jayBvZiBtZXRob2RzIGFsbCBnb3QgdGhlaXIgcmVzdWx0cyAoYnV0IGRpZG4ndCBhbGwgZ2V0XG4gICAgLy8gdGhlaXIgZGF0YSB2aXNpYmxlKSwgZGlzY2FyZCB0aGUgZW1wdHkgYmxvY2sgbm93LlxuICAgIGlmIChcbiAgICAgIHRoaXMuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzLmxlbmd0aCA+IDAgJiZcbiAgICAgIHRoaXMuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzWzBdLm1ldGhvZHMubGVuZ3RoID09PSAwXG4gICAgKSB7XG4gICAgICB0aGlzLl9vdXRzdGFuZGluZ01ldGhvZEJsb2Nrcy5zaGlmdCgpO1xuICAgIH1cblxuICAgIC8vIE1hcmsgYWxsIG1lc3NhZ2VzIGFzIHVuc2VudCwgdGhleSBoYXZlIG5vdCB5ZXQgYmVlbiBzZW50IG9uIHRoaXNcbiAgICAvLyBjb25uZWN0aW9uLlxuICAgIGtleXModGhpcy5fbWV0aG9kSW52b2tlcnMpLmZvckVhY2goaWQgPT4ge1xuICAgICAgdGhpcy5fbWV0aG9kSW52b2tlcnNbaWRdLnNlbnRNZXNzYWdlID0gZmFsc2U7XG4gICAgfSk7XG5cbiAgICAvLyBJZiBhbiBgb25SZWNvbm5lY3RgIGhhbmRsZXIgaXMgc2V0LCBjYWxsIGl0IGZpcnN0LiBHbyB0aHJvdWdoXG4gICAgLy8gc29tZSBob29wcyB0byBlbnN1cmUgdGhhdCBtZXRob2RzIHRoYXQgYXJlIGNhbGxlZCBmcm9tIHdpdGhpblxuICAgIC8vIGBvblJlY29ubmVjdGAgZ2V0IGV4ZWN1dGVkIF9iZWZvcmVfIG9uZXMgdGhhdCB3ZXJlIG9yaWdpbmFsbHlcbiAgICAvLyBvdXRzdGFuZGluZyAoc2luY2UgYG9uUmVjb25uZWN0YCBpcyB1c2VkIHRvIHJlLWVzdGFibGlzaCBhdXRoXG4gICAgLy8gY2VydGlmaWNhdGVzKVxuICAgIHRoaXMuX2NhbGxPblJlY29ubmVjdEFuZFNlbmRBcHByb3ByaWF0ZU91dHN0YW5kaW5nTWV0aG9kcygpO1xuXG4gICAgLy8gYWRkIG5ldyBzdWJzY3JpcHRpb25zIGF0IHRoZSBlbmQuIHRoaXMgd2F5IHRoZXkgdGFrZSBlZmZlY3QgYWZ0ZXJcbiAgICAvLyB0aGUgaGFuZGxlcnMgYW5kIHdlIGRvbid0IHNlZSBmbGlja2VyLlxuICAgIE9iamVjdC5lbnRyaWVzKHRoaXMuX3N1YnNjcmlwdGlvbnMpLmZvckVhY2goKFtpZCwgc3ViXSkgPT4ge1xuICAgICAgdGhpcy5fc2VuZCh7XG4gICAgICAgIG1zZzogJ3N1YicsXG4gICAgICAgIGlkOiBpZCxcbiAgICAgICAgbmFtZTogc3ViLm5hbWUsXG4gICAgICAgIHBhcmFtczogc3ViLnBhcmFtc1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cbn1cbiIsImltcG9ydCB7IEREUENvbW1vbiB9IGZyb20gJ21ldGVvci9kZHAtY29tbW9uJztcbmltcG9ydCB7IE1ldGVvciB9IGZyb20gJ21ldGVvci9tZXRlb3InO1xuaW1wb3J0IHsga2V5cyB9IGZyb20gXCJtZXRlb3IvZGRwLWNvbW1vbi91dGlscy5qc1wiO1xuXG5pbXBvcnQgeyBDb25uZWN0aW9uIH0gZnJvbSAnLi9saXZlZGF0YV9jb25uZWN0aW9uLmpzJztcblxuLy8gVGhpcyBhcnJheSBhbGxvd3MgdGhlIGBfYWxsU3Vic2NyaXB0aW9uc1JlYWR5YCBtZXRob2QgYmVsb3csIHdoaWNoXG4vLyBpcyB1c2VkIGJ5IHRoZSBgc3BpZGVyYWJsZWAgcGFja2FnZSwgdG8ga2VlcCB0cmFjayBvZiB3aGV0aGVyIGFsbFxuLy8gZGF0YSBpcyByZWFkeS5cbmNvbnN0IGFsbENvbm5lY3Rpb25zID0gW107XG5cbi8qKlxuICogQG5hbWVzcGFjZSBERFBcbiAqIEBzdW1tYXJ5IE5hbWVzcGFjZSBmb3IgRERQLXJlbGF0ZWQgbWV0aG9kcy9jbGFzc2VzLlxuICovXG5leHBvcnQgY29uc3QgRERQID0ge307XG5cbi8vIFRoaXMgaXMgcHJpdmF0ZSBidXQgaXQncyB1c2VkIGluIGEgZmV3IHBsYWNlcy4gYWNjb3VudHMtYmFzZSB1c2VzXG4vLyBpdCB0byBnZXQgdGhlIGN1cnJlbnQgdXNlci4gTWV0ZW9yLnNldFRpbWVvdXQgYW5kIGZyaWVuZHMgY2xlYXJcbi8vIGl0LiBXZSBjYW4gcHJvYmFibHkgZmluZCBhIGJldHRlciB3YXkgdG8gZmFjdG9yIHRoaXMuXG5ERFAuX0N1cnJlbnRNZXRob2RJbnZvY2F0aW9uID0gbmV3IE1ldGVvci5FbnZpcm9ubWVudFZhcmlhYmxlKCk7XG5ERFAuX0N1cnJlbnRQdWJsaWNhdGlvbkludm9jYXRpb24gPSBuZXcgTWV0ZW9yLkVudmlyb25tZW50VmFyaWFibGUoKTtcblxuLy8gWFhYOiBLZWVwIEREUC5fQ3VycmVudEludm9jYXRpb24gZm9yIGJhY2t3YXJkcy1jb21wYXRpYmlsaXR5LlxuRERQLl9DdXJyZW50SW52b2NhdGlvbiA9IEREUC5fQ3VycmVudE1ldGhvZEludm9jYXRpb247XG5cbi8vIFRoaXMgaXMgcGFzc2VkIGludG8gYSB3ZWlyZCBgbWFrZUVycm9yVHlwZWAgZnVuY3Rpb24gdGhhdCBleHBlY3RzIGl0cyB0aGluZ1xuLy8gdG8gYmUgYSBjb25zdHJ1Y3RvclxuZnVuY3Rpb24gY29ubmVjdGlvbkVycm9yQ29uc3RydWN0b3IobWVzc2FnZSkge1xuICB0aGlzLm1lc3NhZ2UgPSBtZXNzYWdlO1xufVxuXG5ERFAuQ29ubmVjdGlvbkVycm9yID0gTWV0ZW9yLm1ha2VFcnJvclR5cGUoXG4gICdERFAuQ29ubmVjdGlvbkVycm9yJyxcbiAgY29ubmVjdGlvbkVycm9yQ29uc3RydWN0b3Jcbik7XG5cbkREUC5Gb3JjZWRSZWNvbm5lY3RFcnJvciA9IE1ldGVvci5tYWtlRXJyb3JUeXBlKFxuICAnRERQLkZvcmNlZFJlY29ubmVjdEVycm9yJyxcbiAgKCkgPT4ge31cbik7XG5cbi8vIFJldHVybnMgdGhlIG5hbWVkIHNlcXVlbmNlIG9mIHBzZXVkby1yYW5kb20gdmFsdWVzLlxuLy8gVGhlIHNjb3BlIHdpbGwgYmUgRERQLl9DdXJyZW50TWV0aG9kSW52b2NhdGlvbi5nZXQoKSwgc28gdGhlIHN0cmVhbSB3aWxsIHByb2R1Y2Vcbi8vIGNvbnNpc3RlbnQgdmFsdWVzIGZvciBtZXRob2QgY2FsbHMgb24gdGhlIGNsaWVudCBhbmQgc2VydmVyLlxuRERQLnJhbmRvbVN0cmVhbSA9IG5hbWUgPT4ge1xuICBjb25zdCBzY29wZSA9IEREUC5fQ3VycmVudE1ldGhvZEludm9jYXRpb24uZ2V0KCk7XG4gIHJldHVybiBERFBDb21tb24uUmFuZG9tU3RyZWFtLmdldChzY29wZSwgbmFtZSk7XG59O1xuXG4vLyBAcGFyYW0gdXJsIHtTdHJpbmd9IFVSTCB0byBNZXRlb3IgYXBwLFxuLy8gICAgIGUuZy46XG4vLyAgICAgXCJzdWJkb21haW4ubWV0ZW9yLmNvbVwiLFxuLy8gICAgIFwiaHR0cDovL3N1YmRvbWFpbi5tZXRlb3IuY29tXCIsXG4vLyAgICAgXCIvXCIsXG4vLyAgICAgXCJkZHArc29ja2pzOi8vZGRwLS0qKioqLWZvby5tZXRlb3IuY29tL3NvY2tqc1wiXG5cbi8qKlxuICogQHN1bW1hcnkgQ29ubmVjdCB0byB0aGUgc2VydmVyIG9mIGEgZGlmZmVyZW50IE1ldGVvciBhcHBsaWNhdGlvbiB0byBzdWJzY3JpYmUgdG8gaXRzIGRvY3VtZW50IHNldHMgYW5kIGludm9rZSBpdHMgcmVtb3RlIG1ldGhvZHMuXG4gKiBAbG9jdXMgQW55d2hlcmVcbiAqIEBwYXJhbSB7U3RyaW5nfSB1cmwgVGhlIFVSTCBvZiBhbm90aGVyIE1ldGVvciBhcHBsaWNhdGlvbi5cbiAqL1xuRERQLmNvbm5lY3QgPSAodXJsLCBvcHRpb25zKSA9PiB7XG4gIGNvbnN0IHJldCA9IG5ldyBDb25uZWN0aW9uKHVybCwgb3B0aW9ucyk7XG4gIGFsbENvbm5lY3Rpb25zLnB1c2gocmV0KTsgLy8gaGFjay4gc2VlIGJlbG93LlxuICByZXR1cm4gcmV0O1xufTtcblxuRERQLl9yZWNvbm5lY3RIb29rID0gbmV3IEhvb2soeyBiaW5kRW52aXJvbm1lbnQ6IGZhbHNlIH0pO1xuXG4vKipcbiAqIEBzdW1tYXJ5IFJlZ2lzdGVyIGEgZnVuY3Rpb24gdG8gY2FsbCBhcyB0aGUgZmlyc3Qgc3RlcCBvZlxuICogcmVjb25uZWN0aW5nLiBUaGlzIGZ1bmN0aW9uIGNhbiBjYWxsIG1ldGhvZHMgd2hpY2ggd2lsbCBiZSBleGVjdXRlZCBiZWZvcmVcbiAqIGFueSBvdGhlciBvdXRzdGFuZGluZyBtZXRob2RzLiBGb3IgZXhhbXBsZSwgdGhpcyBjYW4gYmUgdXNlZCB0byByZS1lc3RhYmxpc2hcbiAqIHRoZSBhcHByb3ByaWF0ZSBhdXRoZW50aWNhdGlvbiBjb250ZXh0IG9uIHRoZSBjb25uZWN0aW9uLlxuICogQGxvY3VzIEFueXdoZXJlXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBUaGUgZnVuY3Rpb24gdG8gY2FsbC4gSXQgd2lsbCBiZSBjYWxsZWQgd2l0aCBhXG4gKiBzaW5nbGUgYXJndW1lbnQsIHRoZSBbY29ubmVjdGlvbiBvYmplY3RdKCNkZHBfY29ubmVjdCkgdGhhdCBpcyByZWNvbm5lY3RpbmcuXG4gKi9cbkREUC5vblJlY29ubmVjdCA9IGNhbGxiYWNrID0+IEREUC5fcmVjb25uZWN0SG9vay5yZWdpc3RlcihjYWxsYmFjayk7XG5cbi8vIEhhY2sgZm9yIGBzcGlkZXJhYmxlYCBwYWNrYWdlOiBhIHdheSB0byBzZWUgaWYgdGhlIHBhZ2UgaXMgZG9uZVxuLy8gbG9hZGluZyBhbGwgdGhlIGRhdGEgaXQgbmVlZHMuXG4vL1xuRERQLl9hbGxTdWJzY3JpcHRpb25zUmVhZHkgPSAoKSA9PiBhbGxDb25uZWN0aW9ucy5ldmVyeShcbiAgY29ubiA9PiBPYmplY3QudmFsdWVzKGNvbm4uX3N1YnNjcmlwdGlvbnMpLmV2ZXJ5KHN1YiA9PiBzdWIucmVhZHkpXG4pO1xuIl19
