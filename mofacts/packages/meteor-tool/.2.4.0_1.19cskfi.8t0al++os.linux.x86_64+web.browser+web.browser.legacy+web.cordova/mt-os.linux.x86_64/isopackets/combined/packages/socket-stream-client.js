(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var ECMAScript = Package.ecmascript.ECMAScript;
var Retry = Package.retry.Retry;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var options;

var require = meteorInstall({"node_modules":{"meteor":{"socket-stream-client":{"server.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/socket-stream-client/server.js                                                                        //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
!function (module1) {
  let setMinimumBrowserVersions;
  module1.link("meteor/modern-browsers", {
    setMinimumBrowserVersions(v) {
      setMinimumBrowserVersions = v;
    }

  }, 0);
  setMinimumBrowserVersions({
    chrome: 16,
    edge: 12,
    firefox: 11,
    ie: 10,
    mobileSafari: [6, 1],
    phantomjs: 2,
    safari: 7,
    electron: [0, 20]
  }, module.id);
}.call(this, module);
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"node.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/socket-stream-client/node.js                                                                          //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
!function (module1) {
  module1.export({
    ClientStream: () => ClientStream
  });
  let Meteor;
  module1.link("meteor/meteor", {
    Meteor(v) {
      Meteor = v;
    }

  }, 0);
  let toWebsocketUrl;
  module1.link("./urls.js", {
    toWebsocketUrl(v) {
      toWebsocketUrl = v;
    }

  }, 1);
  let StreamClientCommon;
  module1.link("./common.js", {
    StreamClientCommon(v) {
      StreamClientCommon = v;
    }

  }, 2);

  class ClientStream extends StreamClientCommon {
    constructor(endpoint, options) {
      super(options);
      this.client = null; // created in _launchConnection

      this.endpoint = endpoint;
      this.headers = this.options.headers || {};
      this.npmFayeOptions = this.options.npmFayeOptions || {};

      this._initCommon(this.options); //// Kickoff!


      this._launchConnection();
    } // data is a utf8 string. Data sent while not connected is dropped on
    // the floor, and it is up the user of this API to retransmit lost
    // messages on 'reset'


    send(data) {
      if (this.currentStatus.connected) {
        this.client.send(data);
      }
    } // Changes where this connection points


    _changeUrl(url) {
      this.endpoint = url;
    }

    _onConnect(client) {
      if (client !== this.client) {
        // This connection is not from the last call to _launchConnection.
        // But _launchConnection calls _cleanup which closes previous connections.
        // It's our belief that this stifles future 'open' events, but maybe
        // we are wrong?
        throw new Error('Got open from inactive client ' + !!this.client);
      }

      if (this._forcedToDisconnect) {
        // We were asked to disconnect between trying to open the connection and
        // actually opening it. Let's just pretend this never happened.
        this.client.close();
        this.client = null;
        return;
      }

      if (this.currentStatus.connected) {
        // We already have a connection. It must have been the case that we
        // started two parallel connection attempts (because we wanted to
        // 'reconnect now' on a hanging connection and we had no way to cancel the
        // connection attempt.) But this shouldn't happen (similarly to the client
        // !== this.client check above).
        throw new Error('Two parallel connections?');
      }

      this._clearConnectionTimer(); // update status


      this.currentStatus.status = 'connected';
      this.currentStatus.connected = true;
      this.currentStatus.retryCount = 0;
      this.statusChanged(); // fire resets. This must come after status change so that clients
      // can call send from within a reset callback.

      this.forEachCallback('reset', callback => {
        callback();
      });
    }

    _cleanup(maybeError) {
      this._clearConnectionTimer();

      if (this.client) {
        var client = this.client;
        this.client = null;
        client.close();
        this.forEachCallback('disconnect', callback => {
          callback(maybeError);
        });
      }
    }

    _clearConnectionTimer() {
      if (this.connectionTimer) {
        clearTimeout(this.connectionTimer);
        this.connectionTimer = null;
      }
    }

    _getProxyUrl(targetUrl) {
      // Similar to code in tools/http-helpers.js.
      var proxy = process.env.HTTP_PROXY || process.env.http_proxy || null;
      var noproxy = process.env.NO_PROXY || process.env.no_proxy || null; // if we're going to a secure url, try the https_proxy env variable first.

      if (targetUrl.match(/^wss:/) || targetUrl.match(/^https:/)) {
        proxy = process.env.HTTPS_PROXY || process.env.https_proxy || proxy;
      }

      if (targetUrl.indexOf('localhost') != -1 || targetUrl.indexOf('127.0.0.1') != -1) {
        return null;
      }

      if (noproxy) {
        for (let item of noproxy.split(',')) {
          if (targetUrl.indexOf(item.trim().replace(/\*/, '')) !== -1) {
            proxy = null;
          }
        }
      }

      return proxy;
    }

    _launchConnection() {
      var _this = this;

      this._cleanup(); // cleanup the old socket, if there was one.
      // Since server-to-server DDP is still an experimental feature, we only
      // require the module if we actually create a server-to-server
      // connection.


      var FayeWebSocket = Npm.require('faye-websocket');

      var deflate = Npm.require('permessage-deflate');

      var targetUrl = toWebsocketUrl(this.endpoint);
      var fayeOptions = {
        headers: this.headers,
        extensions: [deflate]
      };
      fayeOptions = Object.assign(fayeOptions, this.npmFayeOptions);

      var proxyUrl = this._getProxyUrl(targetUrl);

      if (proxyUrl) {
        fayeOptions.proxy = {
          origin: proxyUrl
        };
      } // We would like to specify 'ddp' as the subprotocol here. The npm module we
      // used to use as a client would fail the handshake if we ask for a
      // subprotocol and the server doesn't send one back (and sockjs doesn't).
      // Faye doesn't have that behavior; it's unclear from reading RFC 6455 if
      // Faye is erroneous or not.  So for now, we don't specify protocols.


      var subprotocols = [];
      var client = this.client = new FayeWebSocket.Client(targetUrl, subprotocols, fayeOptions);

      this._clearConnectionTimer();

      this.connectionTimer = Meteor.setTimeout(() => {
        this._lostConnection(new this.ConnectionError('DDP connection timed out'));
      }, this.CONNECT_TIMEOUT);
      this.client.on('open', Meteor.bindEnvironment(() => {
        return this._onConnect(client);
      }, 'stream connect callback'));

      var clientOnIfCurrent = (event, description, callback) => {
        this.client.on(event, Meteor.bindEnvironment(function () {
          // Ignore events from any connection we've already cleaned up.
          if (client !== _this.client) return;
          callback(...arguments);
        }, description));
      };

      clientOnIfCurrent('error', 'stream error callback', error => {
        if (!this.options._dontPrintErrors) Meteor._debug('stream error', error.message); // Faye's 'error' object is not a JS error (and among other things,
        // doesn't stringify well). Convert it to one.

        this._lostConnection(new this.ConnectionError(error.message));
      });
      clientOnIfCurrent('close', 'stream close callback', () => {
        this._lostConnection();
      });
      clientOnIfCurrent('message', 'stream message callback', message => {
        // Ignore binary frames, where message.data is a Buffer
        if (typeof message.data !== 'string') return;
        this.forEachCallback('message', callback => {
          callback(message.data);
        });
      });
    }

  }
}.call(this, module);
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"common.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/socket-stream-client/common.js                                                                        //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
let _objectSpread;

module.link("@babel/runtime/helpers/objectSpread2", {
  default(v) {
    _objectSpread = v;
  }

}, 0);
module.export({
  StreamClientCommon: () => StreamClientCommon
});
let Retry;
module.link("meteor/retry", {
  Retry(v) {
    Retry = v;
  }

}, 0);
const forcedReconnectError = new Error("forced reconnect");

class StreamClientCommon {
  constructor(options) {
    this.options = _objectSpread({
      retry: true
    }, options || null);
    this.ConnectionError = options && options.ConnectionError || Error;
  } // Register for callbacks.


  on(name, callback) {
    if (name !== 'message' && name !== 'reset' && name !== 'disconnect') throw new Error('unknown event type: ' + name);
    if (!this.eventCallbacks[name]) this.eventCallbacks[name] = [];
    this.eventCallbacks[name].push(callback);
  }

  forEachCallback(name, cb) {
    if (!this.eventCallbacks[name] || !this.eventCallbacks[name].length) {
      return;
    }

    this.eventCallbacks[name].forEach(cb);
  }

  _initCommon(options) {
    options = options || Object.create(null); //// Constants
    // how long to wait until we declare the connection attempt
    // failed.

    this.CONNECT_TIMEOUT = options.connectTimeoutMs || 10000;
    this.eventCallbacks = Object.create(null); // name -> [callback]

    this._forcedToDisconnect = false; //// Reactive status

    this.currentStatus = {
      status: 'connecting',
      connected: false,
      retryCount: 0
    };

    if (Package.tracker) {
      this.statusListeners = new Package.tracker.Tracker.Dependency();
    }

    this.statusChanged = () => {
      if (this.statusListeners) {
        this.statusListeners.changed();
      }
    }; //// Retry logic


    this._retry = new Retry();
    this.connectionTimer = null;
  } // Trigger a reconnect.


  reconnect(options) {
    options = options || Object.create(null);

    if (options.url) {
      this._changeUrl(options.url);
    }

    if (options._sockjsOptions) {
      this.options._sockjsOptions = options._sockjsOptions;
    }

    if (this.currentStatus.connected) {
      if (options._force || options.url) {
        this._lostConnection(forcedReconnectError);
      }

      return;
    } // if we're mid-connection, stop it.


    if (this.currentStatus.status === 'connecting') {
      // Pretend it's a clean close.
      this._lostConnection();
    }

    this._retry.clear();

    this.currentStatus.retryCount -= 1; // don't count manual retries

    this._retryNow();
  }

  disconnect(options) {
    options = options || Object.create(null); // Failed is permanent. If we're failed, don't let people go back
    // online by calling 'disconnect' then 'reconnect'.

    if (this._forcedToDisconnect) return; // If _permanent is set, permanently disconnect a stream. Once a stream
    // is forced to disconnect, it can never reconnect. This is for
    // error cases such as ddp version mismatch, where trying again
    // won't fix the problem.

    if (options._permanent) {
      this._forcedToDisconnect = true;
    }

    this._cleanup();

    this._retry.clear();

    this.currentStatus = {
      status: options._permanent ? 'failed' : 'offline',
      connected: false,
      retryCount: 0
    };
    if (options._permanent && options._error) this.currentStatus.reason = options._error;
    this.statusChanged();
  } // maybeError is set unless it's a clean protocol-level close.


  _lostConnection(maybeError) {
    this._cleanup(maybeError);

    this._retryLater(maybeError); // sets status. no need to do it here.

  } // fired when we detect that we've gone online. try to reconnect
  // immediately.


  _online() {
    // if we've requested to be offline by disconnecting, don't reconnect.
    if (this.currentStatus.status != 'offline') this.reconnect();
  }

  _retryLater(maybeError) {
    var timeout = 0;

    if (this.options.retry || maybeError === forcedReconnectError) {
      timeout = this._retry.retryLater(this.currentStatus.retryCount, this._retryNow.bind(this));
      this.currentStatus.status = 'waiting';
      this.currentStatus.retryTime = new Date().getTime() + timeout;
    } else {
      this.currentStatus.status = 'failed';
      delete this.currentStatus.retryTime;
    }

    this.currentStatus.connected = false;
    this.statusChanged();
  }

  _retryNow() {
    if (this._forcedToDisconnect) return;
    this.currentStatus.retryCount += 1;
    this.currentStatus.status = 'connecting';
    this.currentStatus.connected = false;
    delete this.currentStatus.retryTime;
    this.statusChanged();

    this._launchConnection();
  } // Get current status. Reactive.


  status() {
    if (this.statusListeners) {
      this.statusListeners.depend();
    }

    return this.currentStatus;
  }

}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"urls.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/socket-stream-client/urls.js                                                                          //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
module.export({
  toSockjsUrl: () => toSockjsUrl,
  toWebsocketUrl: () => toWebsocketUrl
});
let Meteor;
module.link("meteor/meteor", {
  Meteor(v) {
    Meteor = v;
  }

}, 0);

// @param url {String} URL to Meteor app, eg:
//   "/" or "madewith.meteor.com" or "https://foo.meteor.com"
//   or "ddp+sockjs://ddp--****-foo.meteor.com/sockjs"
// @returns {String} URL to the endpoint with the specific scheme and subPath, e.g.
// for scheme "http" and subPath "sockjs"
//   "http://subdomain.meteor.com/sockjs" or "/sockjs"
//   or "https://ddp--1234-foo.meteor.com/sockjs"
function translateUrl(url, newSchemeBase, subPath) {
  if (!newSchemeBase) {
    newSchemeBase = 'http';
  }

  if (subPath !== "sockjs" && url.startsWith("/")) {
    url = Meteor.absoluteUrl(url.substr(1));
  }

  var ddpUrlMatch = url.match(/^ddp(i?)\+sockjs:\/\//);
  var httpUrlMatch = url.match(/^http(s?):\/\//);
  var newScheme;

  if (ddpUrlMatch) {
    // Remove scheme and split off the host.
    var urlAfterDDP = url.substr(ddpUrlMatch[0].length);
    newScheme = ddpUrlMatch[1] === 'i' ? newSchemeBase : newSchemeBase + 's';
    var slashPos = urlAfterDDP.indexOf('/');
    var host = slashPos === -1 ? urlAfterDDP : urlAfterDDP.substr(0, slashPos);
    var rest = slashPos === -1 ? '' : urlAfterDDP.substr(slashPos); // In the host (ONLY!), change '*' characters into random digits. This
    // allows different stream connections to connect to different hostnames
    // and avoid browser per-hostname connection limits.

    host = host.replace(/\*/g, () => Math.floor(Math.random() * 10));
    return newScheme + '://' + host + rest;
  } else if (httpUrlMatch) {
    newScheme = !httpUrlMatch[1] ? newSchemeBase : newSchemeBase + 's';
    var urlAfterHttp = url.substr(httpUrlMatch[0].length);
    url = newScheme + '://' + urlAfterHttp;
  } // Prefix FQDNs but not relative URLs


  if (url.indexOf('://') === -1 && !url.startsWith('/')) {
    url = newSchemeBase + '://' + url;
  } // XXX This is not what we should be doing: if I have a site
  // deployed at "/foo", then DDP.connect("/") should actually connect
  // to "/", not to "/foo". "/" is an absolute path. (Contrast: if
  // deployed at "/foo", it would be reasonable for DDP.connect("bar")
  // to connect to "/foo/bar").
  //
  // We should make this properly honor absolute paths rather than
  // forcing the path to be relative to the site root. Simultaneously,
  // we should set DDP_DEFAULT_CONNECTION_URL to include the site
  // root. See also client_convenience.js #RationalizingRelativeDDPURLs


  url = Meteor._relativeToSiteRootUrl(url);
  if (url.endsWith('/')) return url + subPath;else return url + '/' + subPath;
}

function toSockjsUrl(url) {
  return translateUrl(url, 'http', 'sockjs');
}

function toWebsocketUrl(url) {
  return translateUrl(url, 'ws', 'websocket');
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});

require("/node_modules/meteor/socket-stream-client/server.js");

/* Exports */
Package._define("socket-stream-client");

})();

//# sourceURL=meteor://💻app/packages/socket-stream-client.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvc29ja2V0LXN0cmVhbS1jbGllbnQvc2VydmVyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9zb2NrZXQtc3RyZWFtLWNsaWVudC9ub2RlLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9zb2NrZXQtc3RyZWFtLWNsaWVudC9jb21tb24uanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3NvY2tldC1zdHJlYW0tY2xpZW50L3VybHMuanMiXSwibmFtZXMiOlsic2V0TWluaW11bUJyb3dzZXJWZXJzaW9ucyIsIm1vZHVsZTEiLCJsaW5rIiwidiIsImNocm9tZSIsImVkZ2UiLCJmaXJlZm94IiwiaWUiLCJtb2JpbGVTYWZhcmkiLCJwaGFudG9tanMiLCJzYWZhcmkiLCJlbGVjdHJvbiIsIm1vZHVsZSIsImlkIiwiZXhwb3J0IiwiQ2xpZW50U3RyZWFtIiwiTWV0ZW9yIiwidG9XZWJzb2NrZXRVcmwiLCJTdHJlYW1DbGllbnRDb21tb24iLCJjb25zdHJ1Y3RvciIsImVuZHBvaW50Iiwib3B0aW9ucyIsImNsaWVudCIsImhlYWRlcnMiLCJucG1GYXllT3B0aW9ucyIsIl9pbml0Q29tbW9uIiwiX2xhdW5jaENvbm5lY3Rpb24iLCJzZW5kIiwiZGF0YSIsImN1cnJlbnRTdGF0dXMiLCJjb25uZWN0ZWQiLCJfY2hhbmdlVXJsIiwidXJsIiwiX29uQ29ubmVjdCIsIkVycm9yIiwiX2ZvcmNlZFRvRGlzY29ubmVjdCIsImNsb3NlIiwiX2NsZWFyQ29ubmVjdGlvblRpbWVyIiwic3RhdHVzIiwicmV0cnlDb3VudCIsInN0YXR1c0NoYW5nZWQiLCJmb3JFYWNoQ2FsbGJhY2siLCJjYWxsYmFjayIsIl9jbGVhbnVwIiwibWF5YmVFcnJvciIsImNvbm5lY3Rpb25UaW1lciIsImNsZWFyVGltZW91dCIsIl9nZXRQcm94eVVybCIsInRhcmdldFVybCIsInByb3h5IiwicHJvY2VzcyIsImVudiIsIkhUVFBfUFJPWFkiLCJodHRwX3Byb3h5Iiwibm9wcm94eSIsIk5PX1BST1hZIiwibm9fcHJveHkiLCJtYXRjaCIsIkhUVFBTX1BST1hZIiwiaHR0cHNfcHJveHkiLCJpbmRleE9mIiwiaXRlbSIsInNwbGl0IiwidHJpbSIsInJlcGxhY2UiLCJGYXllV2ViU29ja2V0IiwiTnBtIiwicmVxdWlyZSIsImRlZmxhdGUiLCJmYXllT3B0aW9ucyIsImV4dGVuc2lvbnMiLCJPYmplY3QiLCJhc3NpZ24iLCJwcm94eVVybCIsIm9yaWdpbiIsInN1YnByb3RvY29scyIsIkNsaWVudCIsInNldFRpbWVvdXQiLCJfbG9zdENvbm5lY3Rpb24iLCJDb25uZWN0aW9uRXJyb3IiLCJDT05ORUNUX1RJTUVPVVQiLCJvbiIsImJpbmRFbnZpcm9ubWVudCIsImNsaWVudE9uSWZDdXJyZW50IiwiZXZlbnQiLCJkZXNjcmlwdGlvbiIsImVycm9yIiwiX2RvbnRQcmludEVycm9ycyIsIl9kZWJ1ZyIsIm1lc3NhZ2UiLCJfb2JqZWN0U3ByZWFkIiwiZGVmYXVsdCIsIlJldHJ5IiwiZm9yY2VkUmVjb25uZWN0RXJyb3IiLCJyZXRyeSIsIm5hbWUiLCJldmVudENhbGxiYWNrcyIsInB1c2giLCJjYiIsImxlbmd0aCIsImZvckVhY2giLCJjcmVhdGUiLCJjb25uZWN0VGltZW91dE1zIiwiUGFja2FnZSIsInRyYWNrZXIiLCJzdGF0dXNMaXN0ZW5lcnMiLCJUcmFja2VyIiwiRGVwZW5kZW5jeSIsImNoYW5nZWQiLCJfcmV0cnkiLCJyZWNvbm5lY3QiLCJfc29ja2pzT3B0aW9ucyIsIl9mb3JjZSIsImNsZWFyIiwiX3JldHJ5Tm93IiwiZGlzY29ubmVjdCIsIl9wZXJtYW5lbnQiLCJfZXJyb3IiLCJyZWFzb24iLCJfcmV0cnlMYXRlciIsIl9vbmxpbmUiLCJ0aW1lb3V0IiwicmV0cnlMYXRlciIsImJpbmQiLCJyZXRyeVRpbWUiLCJEYXRlIiwiZ2V0VGltZSIsImRlcGVuZCIsInRvU29ja2pzVXJsIiwidHJhbnNsYXRlVXJsIiwibmV3U2NoZW1lQmFzZSIsInN1YlBhdGgiLCJzdGFydHNXaXRoIiwiYWJzb2x1dGVVcmwiLCJzdWJzdHIiLCJkZHBVcmxNYXRjaCIsImh0dHBVcmxNYXRjaCIsIm5ld1NjaGVtZSIsInVybEFmdGVyRERQIiwic2xhc2hQb3MiLCJob3N0IiwicmVzdCIsIk1hdGgiLCJmbG9vciIsInJhbmRvbSIsInVybEFmdGVySHR0cCIsIl9yZWxhdGl2ZVRvU2l0ZVJvb3RVcmwiLCJlbmRzV2l0aCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxNQUFJQSx5QkFBSjtBQUE4QkMsU0FBTyxDQUFDQyxJQUFSLENBQWEsd0JBQWIsRUFBc0M7QUFBQ0YsNkJBQXlCLENBQUNHLENBQUQsRUFBRztBQUFDSCwrQkFBeUIsR0FBQ0csQ0FBMUI7QUFBNEI7O0FBQTFELEdBQXRDLEVBQWtHLENBQWxHO0FBSTlCSCwyQkFBeUIsQ0FBQztBQUN4QkksVUFBTSxFQUFFLEVBRGdCO0FBRXhCQyxRQUFJLEVBQUUsRUFGa0I7QUFHeEJDLFdBQU8sRUFBRSxFQUhlO0FBSXhCQyxNQUFFLEVBQUUsRUFKb0I7QUFLeEJDLGdCQUFZLEVBQUUsQ0FBQyxDQUFELEVBQUksQ0FBSixDQUxVO0FBTXhCQyxhQUFTLEVBQUUsQ0FOYTtBQU94QkMsVUFBTSxFQUFFLENBUGdCO0FBUXhCQyxZQUFRLEVBQUUsQ0FBQyxDQUFELEVBQUksRUFBSjtBQVJjLEdBQUQsRUFTdEJDLE1BQU0sQ0FBQ0MsRUFUZSxDQUF6Qjs7Ozs7Ozs7Ozs7OztBQ0pBWixTQUFPLENBQUNhLE1BQVIsQ0FBZTtBQUFDQyxnQkFBWSxFQUFDLE1BQUlBO0FBQWxCLEdBQWY7QUFBZ0QsTUFBSUMsTUFBSjtBQUFXZixTQUFPLENBQUNDLElBQVIsQ0FBYSxlQUFiLEVBQTZCO0FBQUNjLFVBQU0sQ0FBQ2IsQ0FBRCxFQUFHO0FBQUNhLFlBQU0sR0FBQ2IsQ0FBUDtBQUFTOztBQUFwQixHQUE3QixFQUFtRCxDQUFuRDtBQUFzRCxNQUFJYyxjQUFKO0FBQW1CaEIsU0FBTyxDQUFDQyxJQUFSLENBQWEsV0FBYixFQUF5QjtBQUFDZSxrQkFBYyxDQUFDZCxDQUFELEVBQUc7QUFBQ2Msb0JBQWMsR0FBQ2QsQ0FBZjtBQUFpQjs7QUFBcEMsR0FBekIsRUFBK0QsQ0FBL0Q7QUFBa0UsTUFBSWUsa0JBQUo7QUFBdUJqQixTQUFPLENBQUNDLElBQVIsQ0FBYSxhQUFiLEVBQTJCO0FBQUNnQixzQkFBa0IsQ0FBQ2YsQ0FBRCxFQUFHO0FBQUNlLHdCQUFrQixHQUFDZixDQUFuQjtBQUFxQjs7QUFBNUMsR0FBM0IsRUFBeUUsQ0FBekU7O0FBZXROLFFBQU1ZLFlBQU4sU0FBMkJHLGtCQUEzQixDQUE4QztBQUNuREMsZUFBVyxDQUFDQyxRQUFELEVBQVdDLE9BQVgsRUFBb0I7QUFDN0IsWUFBTUEsT0FBTjtBQUVBLFdBQUtDLE1BQUwsR0FBYyxJQUFkLENBSDZCLENBR1Q7O0FBQ3BCLFdBQUtGLFFBQUwsR0FBZ0JBLFFBQWhCO0FBRUEsV0FBS0csT0FBTCxHQUFlLEtBQUtGLE9BQUwsQ0FBYUUsT0FBYixJQUF3QixFQUF2QztBQUNBLFdBQUtDLGNBQUwsR0FBc0IsS0FBS0gsT0FBTCxDQUFhRyxjQUFiLElBQStCLEVBQXJEOztBQUVBLFdBQUtDLFdBQUwsQ0FBaUIsS0FBS0osT0FBdEIsRUFUNkIsQ0FXN0I7OztBQUNBLFdBQUtLLGlCQUFMO0FBQ0QsS0Fka0QsQ0FnQm5EO0FBQ0E7QUFDQTs7O0FBQ0FDLFFBQUksQ0FBQ0MsSUFBRCxFQUFPO0FBQ1QsVUFBSSxLQUFLQyxhQUFMLENBQW1CQyxTQUF2QixFQUFrQztBQUNoQyxhQUFLUixNQUFMLENBQVlLLElBQVosQ0FBaUJDLElBQWpCO0FBQ0Q7QUFDRixLQXZCa0QsQ0F5Qm5EOzs7QUFDQUcsY0FBVSxDQUFDQyxHQUFELEVBQU07QUFDZCxXQUFLWixRQUFMLEdBQWdCWSxHQUFoQjtBQUNEOztBQUVEQyxjQUFVLENBQUNYLE1BQUQsRUFBUztBQUNqQixVQUFJQSxNQUFNLEtBQUssS0FBS0EsTUFBcEIsRUFBNEI7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQSxjQUFNLElBQUlZLEtBQUosQ0FBVSxtQ0FBbUMsQ0FBQyxDQUFDLEtBQUtaLE1BQXBELENBQU47QUFDRDs7QUFFRCxVQUFJLEtBQUthLG1CQUFULEVBQThCO0FBQzVCO0FBQ0E7QUFDQSxhQUFLYixNQUFMLENBQVljLEtBQVo7QUFDQSxhQUFLZCxNQUFMLEdBQWMsSUFBZDtBQUNBO0FBQ0Q7O0FBRUQsVUFBSSxLQUFLTyxhQUFMLENBQW1CQyxTQUF2QixFQUFrQztBQUNoQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsY0FBTSxJQUFJSSxLQUFKLENBQVUsMkJBQVYsQ0FBTjtBQUNEOztBQUVELFdBQUtHLHFCQUFMLEdBMUJpQixDQTRCakI7OztBQUNBLFdBQUtSLGFBQUwsQ0FBbUJTLE1BQW5CLEdBQTRCLFdBQTVCO0FBQ0EsV0FBS1QsYUFBTCxDQUFtQkMsU0FBbkIsR0FBK0IsSUFBL0I7QUFDQSxXQUFLRCxhQUFMLENBQW1CVSxVQUFuQixHQUFnQyxDQUFoQztBQUNBLFdBQUtDLGFBQUwsR0FoQ2lCLENBa0NqQjtBQUNBOztBQUNBLFdBQUtDLGVBQUwsQ0FBcUIsT0FBckIsRUFBOEJDLFFBQVEsSUFBSTtBQUN4Q0EsZ0JBQVE7QUFDVCxPQUZEO0FBR0Q7O0FBRURDLFlBQVEsQ0FBQ0MsVUFBRCxFQUFhO0FBQ25CLFdBQUtQLHFCQUFMOztBQUNBLFVBQUksS0FBS2YsTUFBVCxFQUFpQjtBQUNmLFlBQUlBLE1BQU0sR0FBRyxLQUFLQSxNQUFsQjtBQUNBLGFBQUtBLE1BQUwsR0FBYyxJQUFkO0FBQ0FBLGNBQU0sQ0FBQ2MsS0FBUDtBQUVBLGFBQUtLLGVBQUwsQ0FBcUIsWUFBckIsRUFBbUNDLFFBQVEsSUFBSTtBQUM3Q0Esa0JBQVEsQ0FBQ0UsVUFBRCxDQUFSO0FBQ0QsU0FGRDtBQUdEO0FBQ0Y7O0FBRURQLHlCQUFxQixHQUFHO0FBQ3RCLFVBQUksS0FBS1EsZUFBVCxFQUEwQjtBQUN4QkMsb0JBQVksQ0FBQyxLQUFLRCxlQUFOLENBQVo7QUFDQSxhQUFLQSxlQUFMLEdBQXVCLElBQXZCO0FBQ0Q7QUFDRjs7QUFFREUsZ0JBQVksQ0FBQ0MsU0FBRCxFQUFZO0FBQ3RCO0FBQ0EsVUFBSUMsS0FBSyxHQUFHQyxPQUFPLENBQUNDLEdBQVIsQ0FBWUMsVUFBWixJQUEwQkYsT0FBTyxDQUFDQyxHQUFSLENBQVlFLFVBQXRDLElBQW9ELElBQWhFO0FBQ0EsVUFBSUMsT0FBTyxHQUFHSixPQUFPLENBQUNDLEdBQVIsQ0FBWUksUUFBWixJQUF3QkwsT0FBTyxDQUFDQyxHQUFSLENBQVlLLFFBQXBDLElBQWdELElBQTlELENBSHNCLENBSXRCOztBQUNBLFVBQUlSLFNBQVMsQ0FBQ1MsS0FBVixDQUFnQixPQUFoQixLQUE0QlQsU0FBUyxDQUFDUyxLQUFWLENBQWdCLFNBQWhCLENBQWhDLEVBQTREO0FBQzFEUixhQUFLLEdBQUdDLE9BQU8sQ0FBQ0MsR0FBUixDQUFZTyxXQUFaLElBQTJCUixPQUFPLENBQUNDLEdBQVIsQ0FBWVEsV0FBdkMsSUFBc0RWLEtBQTlEO0FBQ0Q7O0FBQ0QsVUFBSUQsU0FBUyxDQUFDWSxPQUFWLENBQWtCLFdBQWxCLEtBQWtDLENBQUMsQ0FBbkMsSUFBd0NaLFNBQVMsQ0FBQ1ksT0FBVixDQUFrQixXQUFsQixLQUFrQyxDQUFDLENBQS9FLEVBQWtGO0FBQ2hGLGVBQU8sSUFBUDtBQUNEOztBQUNELFVBQUlOLE9BQUosRUFBYTtBQUNYLGFBQUssSUFBSU8sSUFBVCxJQUFpQlAsT0FBTyxDQUFDUSxLQUFSLENBQWMsR0FBZCxDQUFqQixFQUFxQztBQUNuQyxjQUFJZCxTQUFTLENBQUNZLE9BQVYsQ0FBa0JDLElBQUksQ0FBQ0UsSUFBTCxHQUFZQyxPQUFaLENBQW9CLElBQXBCLEVBQTBCLEVBQTFCLENBQWxCLE1BQXFELENBQUMsQ0FBMUQsRUFBNkQ7QUFDM0RmLGlCQUFLLEdBQUcsSUFBUjtBQUNEO0FBQ0Y7QUFDRjs7QUFDRCxhQUFPQSxLQUFQO0FBQ0Q7O0FBRUR2QixxQkFBaUIsR0FBRztBQUFBOztBQUNsQixXQUFLaUIsUUFBTCxHQURrQixDQUNEO0FBRWpCO0FBQ0E7QUFDQTs7O0FBQ0EsVUFBSXNCLGFBQWEsR0FBR0MsR0FBRyxDQUFDQyxPQUFKLENBQVksZ0JBQVosQ0FBcEI7O0FBQ0EsVUFBSUMsT0FBTyxHQUFHRixHQUFHLENBQUNDLE9BQUosQ0FBWSxvQkFBWixDQUFkOztBQUVBLFVBQUluQixTQUFTLEdBQUcvQixjQUFjLENBQUMsS0FBS0csUUFBTixDQUE5QjtBQUNBLFVBQUlpRCxXQUFXLEdBQUc7QUFDaEI5QyxlQUFPLEVBQUUsS0FBS0EsT0FERTtBQUVoQitDLGtCQUFVLEVBQUUsQ0FBQ0YsT0FBRDtBQUZJLE9BQWxCO0FBSUFDLGlCQUFXLEdBQUdFLE1BQU0sQ0FBQ0MsTUFBUCxDQUFjSCxXQUFkLEVBQTJCLEtBQUs3QyxjQUFoQyxDQUFkOztBQUNBLFVBQUlpRCxRQUFRLEdBQUcsS0FBSzFCLFlBQUwsQ0FBa0JDLFNBQWxCLENBQWY7O0FBQ0EsVUFBSXlCLFFBQUosRUFBYztBQUNaSixtQkFBVyxDQUFDcEIsS0FBWixHQUFvQjtBQUFFeUIsZ0JBQU0sRUFBRUQ7QUFBVixTQUFwQjtBQUNELE9BbEJpQixDQW9CbEI7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FBQ0EsVUFBSUUsWUFBWSxHQUFHLEVBQW5CO0FBRUEsVUFBSXJELE1BQU0sR0FBSSxLQUFLQSxNQUFMLEdBQWMsSUFBSTJDLGFBQWEsQ0FBQ1csTUFBbEIsQ0FDMUI1QixTQUQwQixFQUUxQjJCLFlBRjBCLEVBRzFCTixXQUgwQixDQUE1Qjs7QUFNQSxXQUFLaEMscUJBQUw7O0FBQ0EsV0FBS1EsZUFBTCxHQUF1QjdCLE1BQU0sQ0FBQzZELFVBQVAsQ0FBa0IsTUFBTTtBQUM3QyxhQUFLQyxlQUFMLENBQXFCLElBQUksS0FBS0MsZUFBVCxDQUF5QiwwQkFBekIsQ0FBckI7QUFDRCxPQUZzQixFQUVwQixLQUFLQyxlQUZlLENBQXZCO0FBSUEsV0FBSzFELE1BQUwsQ0FBWTJELEVBQVosQ0FDRSxNQURGLEVBRUVqRSxNQUFNLENBQUNrRSxlQUFQLENBQXVCLE1BQU07QUFDM0IsZUFBTyxLQUFLakQsVUFBTCxDQUFnQlgsTUFBaEIsQ0FBUDtBQUNELE9BRkQsRUFFRyx5QkFGSCxDQUZGOztBQU9BLFVBQUk2RCxpQkFBaUIsR0FBRyxDQUFDQyxLQUFELEVBQVFDLFdBQVIsRUFBcUIzQyxRQUFyQixLQUFrQztBQUN4RCxhQUFLcEIsTUFBTCxDQUFZMkQsRUFBWixDQUNFRyxLQURGLEVBRUVwRSxNQUFNLENBQUNrRSxlQUFQLENBQXVCLFlBQWE7QUFDbEM7QUFDQSxjQUFJNUQsTUFBTSxLQUFLLEtBQUksQ0FBQ0EsTUFBcEIsRUFBNEI7QUFDNUJvQixrQkFBUSxDQUFDLFlBQUQsQ0FBUjtBQUNELFNBSkQsRUFJRzJDLFdBSkgsQ0FGRjtBQVFELE9BVEQ7O0FBV0FGLHVCQUFpQixDQUFDLE9BQUQsRUFBVSx1QkFBVixFQUFtQ0csS0FBSyxJQUFJO0FBQzNELFlBQUksQ0FBQyxLQUFLakUsT0FBTCxDQUFha0UsZ0JBQWxCLEVBQ0V2RSxNQUFNLENBQUN3RSxNQUFQLENBQWMsY0FBZCxFQUE4QkYsS0FBSyxDQUFDRyxPQUFwQyxFQUZ5RCxDQUkzRDtBQUNBOztBQUNBLGFBQUtYLGVBQUwsQ0FBcUIsSUFBSSxLQUFLQyxlQUFULENBQXlCTyxLQUFLLENBQUNHLE9BQS9CLENBQXJCO0FBQ0QsT0FQZ0IsQ0FBakI7QUFTQU4sdUJBQWlCLENBQUMsT0FBRCxFQUFVLHVCQUFWLEVBQW1DLE1BQU07QUFDeEQsYUFBS0wsZUFBTDtBQUNELE9BRmdCLENBQWpCO0FBSUFLLHVCQUFpQixDQUFDLFNBQUQsRUFBWSx5QkFBWixFQUF1Q00sT0FBTyxJQUFJO0FBQ2pFO0FBQ0EsWUFBSSxPQUFPQSxPQUFPLENBQUM3RCxJQUFmLEtBQXdCLFFBQTVCLEVBQXNDO0FBRXRDLGFBQUthLGVBQUwsQ0FBcUIsU0FBckIsRUFBZ0NDLFFBQVEsSUFBSTtBQUMxQ0Esa0JBQVEsQ0FBQytDLE9BQU8sQ0FBQzdELElBQVQsQ0FBUjtBQUNELFNBRkQ7QUFHRCxPQVBnQixDQUFqQjtBQVFEOztBQTdMa0Q7Ozs7Ozs7Ozs7OztBQ2ZyRCxJQUFJOEQsYUFBSjs7QUFBa0I5RSxNQUFNLENBQUNWLElBQVAsQ0FBWSxzQ0FBWixFQUFtRDtBQUFDeUYsU0FBTyxDQUFDeEYsQ0FBRCxFQUFHO0FBQUN1RixpQkFBYSxHQUFDdkYsQ0FBZDtBQUFnQjs7QUFBNUIsQ0FBbkQsRUFBaUYsQ0FBakY7QUFBbEJTLE1BQU0sQ0FBQ0UsTUFBUCxDQUFjO0FBQUNJLG9CQUFrQixFQUFDLE1BQUlBO0FBQXhCLENBQWQ7QUFBMkQsSUFBSTBFLEtBQUo7QUFBVWhGLE1BQU0sQ0FBQ1YsSUFBUCxDQUFZLGNBQVosRUFBMkI7QUFBQzBGLE9BQUssQ0FBQ3pGLENBQUQsRUFBRztBQUFDeUYsU0FBSyxHQUFDekYsQ0FBTjtBQUFROztBQUFsQixDQUEzQixFQUErQyxDQUEvQztBQUVyRSxNQUFNMEYsb0JBQW9CLEdBQUcsSUFBSTNELEtBQUosQ0FBVSxrQkFBVixDQUE3Qjs7QUFFTyxNQUFNaEIsa0JBQU4sQ0FBeUI7QUFDOUJDLGFBQVcsQ0FBQ0UsT0FBRCxFQUFVO0FBQ25CLFNBQUtBLE9BQUw7QUFDRXlFLFdBQUssRUFBRTtBQURULE9BRU16RSxPQUFPLElBQUksSUFGakI7QUFLQSxTQUFLMEQsZUFBTCxHQUNFMUQsT0FBTyxJQUFJQSxPQUFPLENBQUMwRCxlQUFuQixJQUFzQzdDLEtBRHhDO0FBRUQsR0FUNkIsQ0FXOUI7OztBQUNBK0MsSUFBRSxDQUFDYyxJQUFELEVBQU9yRCxRQUFQLEVBQWlCO0FBQ2pCLFFBQUlxRCxJQUFJLEtBQUssU0FBVCxJQUFzQkEsSUFBSSxLQUFLLE9BQS9CLElBQTBDQSxJQUFJLEtBQUssWUFBdkQsRUFDRSxNQUFNLElBQUk3RCxLQUFKLENBQVUseUJBQXlCNkQsSUFBbkMsQ0FBTjtBQUVGLFFBQUksQ0FBQyxLQUFLQyxjQUFMLENBQW9CRCxJQUFwQixDQUFMLEVBQWdDLEtBQUtDLGNBQUwsQ0FBb0JELElBQXBCLElBQTRCLEVBQTVCO0FBQ2hDLFNBQUtDLGNBQUwsQ0FBb0JELElBQXBCLEVBQTBCRSxJQUExQixDQUErQnZELFFBQS9CO0FBQ0Q7O0FBRURELGlCQUFlLENBQUNzRCxJQUFELEVBQU9HLEVBQVAsRUFBVztBQUN4QixRQUFJLENBQUMsS0FBS0YsY0FBTCxDQUFvQkQsSUFBcEIsQ0FBRCxJQUE4QixDQUFDLEtBQUtDLGNBQUwsQ0FBb0JELElBQXBCLEVBQTBCSSxNQUE3RCxFQUFxRTtBQUNuRTtBQUNEOztBQUVELFNBQUtILGNBQUwsQ0FBb0JELElBQXBCLEVBQTBCSyxPQUExQixDQUFrQ0YsRUFBbEM7QUFDRDs7QUFFRHpFLGFBQVcsQ0FBQ0osT0FBRCxFQUFVO0FBQ25CQSxXQUFPLEdBQUdBLE9BQU8sSUFBSWtELE1BQU0sQ0FBQzhCLE1BQVAsQ0FBYyxJQUFkLENBQXJCLENBRG1CLENBR25CO0FBRUE7QUFDQTs7QUFDQSxTQUFLckIsZUFBTCxHQUF1QjNELE9BQU8sQ0FBQ2lGLGdCQUFSLElBQTRCLEtBQW5EO0FBRUEsU0FBS04sY0FBTCxHQUFzQnpCLE1BQU0sQ0FBQzhCLE1BQVAsQ0FBYyxJQUFkLENBQXRCLENBVG1CLENBU3dCOztBQUUzQyxTQUFLbEUsbUJBQUwsR0FBMkIsS0FBM0IsQ0FYbUIsQ0FhbkI7O0FBQ0EsU0FBS04sYUFBTCxHQUFxQjtBQUNuQlMsWUFBTSxFQUFFLFlBRFc7QUFFbkJSLGVBQVMsRUFBRSxLQUZRO0FBR25CUyxnQkFBVSxFQUFFO0FBSE8sS0FBckI7O0FBTUEsUUFBSWdFLE9BQU8sQ0FBQ0MsT0FBWixFQUFxQjtBQUNuQixXQUFLQyxlQUFMLEdBQXVCLElBQUlGLE9BQU8sQ0FBQ0MsT0FBUixDQUFnQkUsT0FBaEIsQ0FBd0JDLFVBQTVCLEVBQXZCO0FBQ0Q7O0FBRUQsU0FBS25FLGFBQUwsR0FBcUIsTUFBTTtBQUN6QixVQUFJLEtBQUtpRSxlQUFULEVBQTBCO0FBQ3hCLGFBQUtBLGVBQUwsQ0FBcUJHLE9BQXJCO0FBQ0Q7QUFDRixLQUpELENBeEJtQixDQThCbkI7OztBQUNBLFNBQUtDLE1BQUwsR0FBYyxJQUFJakIsS0FBSixFQUFkO0FBQ0EsU0FBSy9DLGVBQUwsR0FBdUIsSUFBdkI7QUFDRCxHQTdENkIsQ0ErRDlCOzs7QUFDQWlFLFdBQVMsQ0FBQ3pGLE9BQUQsRUFBVTtBQUNqQkEsV0FBTyxHQUFHQSxPQUFPLElBQUlrRCxNQUFNLENBQUM4QixNQUFQLENBQWMsSUFBZCxDQUFyQjs7QUFFQSxRQUFJaEYsT0FBTyxDQUFDVyxHQUFaLEVBQWlCO0FBQ2YsV0FBS0QsVUFBTCxDQUFnQlYsT0FBTyxDQUFDVyxHQUF4QjtBQUNEOztBQUVELFFBQUlYLE9BQU8sQ0FBQzBGLGNBQVosRUFBNEI7QUFDMUIsV0FBSzFGLE9BQUwsQ0FBYTBGLGNBQWIsR0FBOEIxRixPQUFPLENBQUMwRixjQUF0QztBQUNEOztBQUVELFFBQUksS0FBS2xGLGFBQUwsQ0FBbUJDLFNBQXZCLEVBQWtDO0FBQ2hDLFVBQUlULE9BQU8sQ0FBQzJGLE1BQVIsSUFBa0IzRixPQUFPLENBQUNXLEdBQTlCLEVBQW1DO0FBQ2pDLGFBQUs4QyxlQUFMLENBQXFCZSxvQkFBckI7QUFDRDs7QUFDRDtBQUNELEtBaEJnQixDQWtCakI7OztBQUNBLFFBQUksS0FBS2hFLGFBQUwsQ0FBbUJTLE1BQW5CLEtBQThCLFlBQWxDLEVBQWdEO0FBQzlDO0FBQ0EsV0FBS3dDLGVBQUw7QUFDRDs7QUFFRCxTQUFLK0IsTUFBTCxDQUFZSSxLQUFaOztBQUNBLFNBQUtwRixhQUFMLENBQW1CVSxVQUFuQixJQUFpQyxDQUFqQyxDQXpCaUIsQ0F5Qm1COztBQUNwQyxTQUFLMkUsU0FBTDtBQUNEOztBQUVEQyxZQUFVLENBQUM5RixPQUFELEVBQVU7QUFDbEJBLFdBQU8sR0FBR0EsT0FBTyxJQUFJa0QsTUFBTSxDQUFDOEIsTUFBUCxDQUFjLElBQWQsQ0FBckIsQ0FEa0IsQ0FHbEI7QUFDQTs7QUFDQSxRQUFJLEtBQUtsRSxtQkFBVCxFQUE4QixPQUxaLENBT2xCO0FBQ0E7QUFDQTtBQUNBOztBQUNBLFFBQUlkLE9BQU8sQ0FBQytGLFVBQVosRUFBd0I7QUFDdEIsV0FBS2pGLG1CQUFMLEdBQTJCLElBQTNCO0FBQ0Q7O0FBRUQsU0FBS1EsUUFBTDs7QUFDQSxTQUFLa0UsTUFBTCxDQUFZSSxLQUFaOztBQUVBLFNBQUtwRixhQUFMLEdBQXFCO0FBQ25CUyxZQUFNLEVBQUVqQixPQUFPLENBQUMrRixVQUFSLEdBQXFCLFFBQXJCLEdBQWdDLFNBRHJCO0FBRW5CdEYsZUFBUyxFQUFFLEtBRlE7QUFHbkJTLGdCQUFVLEVBQUU7QUFITyxLQUFyQjtBQU1BLFFBQUlsQixPQUFPLENBQUMrRixVQUFSLElBQXNCL0YsT0FBTyxDQUFDZ0csTUFBbEMsRUFDRSxLQUFLeEYsYUFBTCxDQUFtQnlGLE1BQW5CLEdBQTRCakcsT0FBTyxDQUFDZ0csTUFBcEM7QUFFRixTQUFLN0UsYUFBTDtBQUNELEdBekg2QixDQTJIOUI7OztBQUNBc0MsaUJBQWUsQ0FBQ2xDLFVBQUQsRUFBYTtBQUMxQixTQUFLRCxRQUFMLENBQWNDLFVBQWQ7O0FBQ0EsU0FBSzJFLFdBQUwsQ0FBaUIzRSxVQUFqQixFQUYwQixDQUVJOztBQUMvQixHQS9INkIsQ0FpSTlCO0FBQ0E7OztBQUNBNEUsU0FBTyxHQUFHO0FBQ1I7QUFDQSxRQUFJLEtBQUszRixhQUFMLENBQW1CUyxNQUFuQixJQUE2QixTQUFqQyxFQUE0QyxLQUFLd0UsU0FBTDtBQUM3Qzs7QUFFRFMsYUFBVyxDQUFDM0UsVUFBRCxFQUFhO0FBQ3RCLFFBQUk2RSxPQUFPLEdBQUcsQ0FBZDs7QUFDQSxRQUFJLEtBQUtwRyxPQUFMLENBQWF5RSxLQUFiLElBQ0FsRCxVQUFVLEtBQUtpRCxvQkFEbkIsRUFDeUM7QUFDdkM0QixhQUFPLEdBQUcsS0FBS1osTUFBTCxDQUFZYSxVQUFaLENBQ1IsS0FBSzdGLGFBQUwsQ0FBbUJVLFVBRFgsRUFFUixLQUFLMkUsU0FBTCxDQUFlUyxJQUFmLENBQW9CLElBQXBCLENBRlEsQ0FBVjtBQUlBLFdBQUs5RixhQUFMLENBQW1CUyxNQUFuQixHQUE0QixTQUE1QjtBQUNBLFdBQUtULGFBQUwsQ0FBbUIrRixTQUFuQixHQUErQixJQUFJQyxJQUFKLEdBQVdDLE9BQVgsS0FBdUJMLE9BQXREO0FBQ0QsS0FSRCxNQVFPO0FBQ0wsV0FBSzVGLGFBQUwsQ0FBbUJTLE1BQW5CLEdBQTRCLFFBQTVCO0FBQ0EsYUFBTyxLQUFLVCxhQUFMLENBQW1CK0YsU0FBMUI7QUFDRDs7QUFFRCxTQUFLL0YsYUFBTCxDQUFtQkMsU0FBbkIsR0FBK0IsS0FBL0I7QUFDQSxTQUFLVSxhQUFMO0FBQ0Q7O0FBRUQwRSxXQUFTLEdBQUc7QUFDVixRQUFJLEtBQUsvRSxtQkFBVCxFQUE4QjtBQUU5QixTQUFLTixhQUFMLENBQW1CVSxVQUFuQixJQUFpQyxDQUFqQztBQUNBLFNBQUtWLGFBQUwsQ0FBbUJTLE1BQW5CLEdBQTRCLFlBQTVCO0FBQ0EsU0FBS1QsYUFBTCxDQUFtQkMsU0FBbkIsR0FBK0IsS0FBL0I7QUFDQSxXQUFPLEtBQUtELGFBQUwsQ0FBbUIrRixTQUExQjtBQUNBLFNBQUtwRixhQUFMOztBQUVBLFNBQUtkLGlCQUFMO0FBQ0QsR0FySzZCLENBdUs5Qjs7O0FBQ0FZLFFBQU0sR0FBRztBQUNQLFFBQUksS0FBS21FLGVBQVQsRUFBMEI7QUFDeEIsV0FBS0EsZUFBTCxDQUFxQnNCLE1BQXJCO0FBQ0Q7O0FBQ0QsV0FBTyxLQUFLbEcsYUFBWjtBQUNEOztBQTdLNkIsQzs7Ozs7Ozs7Ozs7QUNKaENqQixNQUFNLENBQUNFLE1BQVAsQ0FBYztBQUFDa0gsYUFBVyxFQUFDLE1BQUlBLFdBQWpCO0FBQTZCL0csZ0JBQWMsRUFBQyxNQUFJQTtBQUFoRCxDQUFkO0FBQStFLElBQUlELE1BQUo7QUFBV0osTUFBTSxDQUFDVixJQUFQLENBQVksZUFBWixFQUE0QjtBQUFDYyxRQUFNLENBQUNiLENBQUQsRUFBRztBQUFDYSxVQUFNLEdBQUNiLENBQVA7QUFBUzs7QUFBcEIsQ0FBNUIsRUFBa0QsQ0FBbEQ7O0FBRTFGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBUzhILFlBQVQsQ0FBc0JqRyxHQUF0QixFQUEyQmtHLGFBQTNCLEVBQTBDQyxPQUExQyxFQUFtRDtBQUNqRCxNQUFJLENBQUNELGFBQUwsRUFBb0I7QUFDbEJBLGlCQUFhLEdBQUcsTUFBaEI7QUFDRDs7QUFFRCxNQUFJQyxPQUFPLEtBQUssUUFBWixJQUF3Qm5HLEdBQUcsQ0FBQ29HLFVBQUosQ0FBZSxHQUFmLENBQTVCLEVBQWlEO0FBQy9DcEcsT0FBRyxHQUFHaEIsTUFBTSxDQUFDcUgsV0FBUCxDQUFtQnJHLEdBQUcsQ0FBQ3NHLE1BQUosQ0FBVyxDQUFYLENBQW5CLENBQU47QUFDRDs7QUFFRCxNQUFJQyxXQUFXLEdBQUd2RyxHQUFHLENBQUN5QixLQUFKLENBQVUsdUJBQVYsQ0FBbEI7QUFDQSxNQUFJK0UsWUFBWSxHQUFHeEcsR0FBRyxDQUFDeUIsS0FBSixDQUFVLGdCQUFWLENBQW5CO0FBQ0EsTUFBSWdGLFNBQUo7O0FBQ0EsTUFBSUYsV0FBSixFQUFpQjtBQUNmO0FBQ0EsUUFBSUcsV0FBVyxHQUFHMUcsR0FBRyxDQUFDc0csTUFBSixDQUFXQyxXQUFXLENBQUMsQ0FBRCxDQUFYLENBQWVwQyxNQUExQixDQUFsQjtBQUNBc0MsYUFBUyxHQUFHRixXQUFXLENBQUMsQ0FBRCxDQUFYLEtBQW1CLEdBQW5CLEdBQXlCTCxhQUF6QixHQUF5Q0EsYUFBYSxHQUFHLEdBQXJFO0FBQ0EsUUFBSVMsUUFBUSxHQUFHRCxXQUFXLENBQUM5RSxPQUFaLENBQW9CLEdBQXBCLENBQWY7QUFDQSxRQUFJZ0YsSUFBSSxHQUFHRCxRQUFRLEtBQUssQ0FBQyxDQUFkLEdBQWtCRCxXQUFsQixHQUFnQ0EsV0FBVyxDQUFDSixNQUFaLENBQW1CLENBQW5CLEVBQXNCSyxRQUF0QixDQUEzQztBQUNBLFFBQUlFLElBQUksR0FBR0YsUUFBUSxLQUFLLENBQUMsQ0FBZCxHQUFrQixFQUFsQixHQUF1QkQsV0FBVyxDQUFDSixNQUFaLENBQW1CSyxRQUFuQixDQUFsQyxDQU5lLENBUWY7QUFDQTtBQUNBOztBQUNBQyxRQUFJLEdBQUdBLElBQUksQ0FBQzVFLE9BQUwsQ0FBYSxLQUFiLEVBQW9CLE1BQU04RSxJQUFJLENBQUNDLEtBQUwsQ0FBV0QsSUFBSSxDQUFDRSxNQUFMLEtBQWdCLEVBQTNCLENBQTFCLENBQVA7QUFFQSxXQUFPUCxTQUFTLEdBQUcsS0FBWixHQUFvQkcsSUFBcEIsR0FBMkJDLElBQWxDO0FBQ0QsR0FkRCxNQWNPLElBQUlMLFlBQUosRUFBa0I7QUFDdkJDLGFBQVMsR0FBRyxDQUFDRCxZQUFZLENBQUMsQ0FBRCxDQUFiLEdBQW1CTixhQUFuQixHQUFtQ0EsYUFBYSxHQUFHLEdBQS9EO0FBQ0EsUUFBSWUsWUFBWSxHQUFHakgsR0FBRyxDQUFDc0csTUFBSixDQUFXRSxZQUFZLENBQUMsQ0FBRCxDQUFaLENBQWdCckMsTUFBM0IsQ0FBbkI7QUFDQW5FLE9BQUcsR0FBR3lHLFNBQVMsR0FBRyxLQUFaLEdBQW9CUSxZQUExQjtBQUNELEdBOUJnRCxDQWdDakQ7OztBQUNBLE1BQUlqSCxHQUFHLENBQUM0QixPQUFKLENBQVksS0FBWixNQUF1QixDQUFDLENBQXhCLElBQTZCLENBQUM1QixHQUFHLENBQUNvRyxVQUFKLENBQWUsR0FBZixDQUFsQyxFQUF1RDtBQUNyRHBHLE9BQUcsR0FBR2tHLGFBQWEsR0FBRyxLQUFoQixHQUF3QmxHLEdBQTlCO0FBQ0QsR0FuQ2dELENBcUNqRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FBQ0FBLEtBQUcsR0FBR2hCLE1BQU0sQ0FBQ2tJLHNCQUFQLENBQThCbEgsR0FBOUIsQ0FBTjtBQUVBLE1BQUlBLEdBQUcsQ0FBQ21ILFFBQUosQ0FBYSxHQUFiLENBQUosRUFBdUIsT0FBT25ILEdBQUcsR0FBR21HLE9BQWIsQ0FBdkIsS0FDSyxPQUFPbkcsR0FBRyxHQUFHLEdBQU4sR0FBWW1HLE9BQW5CO0FBQ047O0FBRU0sU0FBU0gsV0FBVCxDQUFxQmhHLEdBQXJCLEVBQTBCO0FBQy9CLFNBQU9pRyxZQUFZLENBQUNqRyxHQUFELEVBQU0sTUFBTixFQUFjLFFBQWQsQ0FBbkI7QUFDRDs7QUFFTSxTQUFTZixjQUFULENBQXdCZSxHQUF4QixFQUE2QjtBQUNsQyxTQUFPaUcsWUFBWSxDQUFDakcsR0FBRCxFQUFNLElBQU4sRUFBWSxXQUFaLENBQW5CO0FBQ0QsQyIsImZpbGUiOiIvcGFja2FnZXMvc29ja2V0LXN0cmVhbS1jbGllbnQuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge1xuICBzZXRNaW5pbXVtQnJvd3NlclZlcnNpb25zLFxufSBmcm9tIFwibWV0ZW9yL21vZGVybi1icm93c2Vyc1wiO1xuXG5zZXRNaW5pbXVtQnJvd3NlclZlcnNpb25zKHtcbiAgY2hyb21lOiAxNixcbiAgZWRnZTogMTIsXG4gIGZpcmVmb3g6IDExLFxuICBpZTogMTAsXG4gIG1vYmlsZVNhZmFyaTogWzYsIDFdLFxuICBwaGFudG9tanM6IDIsXG4gIHNhZmFyaTogNyxcbiAgZWxlY3Ryb246IFswLCAyMF0sXG59LCBtb2R1bGUuaWQpO1xuIiwiaW1wb3J0IHsgTWV0ZW9yIH0gZnJvbSBcIm1ldGVvci9tZXRlb3JcIjtcbmltcG9ydCB7IHRvV2Vic29ja2V0VXJsIH0gZnJvbSBcIi4vdXJscy5qc1wiO1xuaW1wb3J0IHsgU3RyZWFtQ2xpZW50Q29tbW9uIH0gZnJvbSBcIi4vY29tbW9uLmpzXCI7XG5cbi8vIEBwYXJhbSBlbmRwb2ludCB7U3RyaW5nfSBVUkwgdG8gTWV0ZW9yIGFwcFxuLy8gICBcImh0dHA6Ly9zdWJkb21haW4ubWV0ZW9yLmNvbS9cIiBvciBcIi9cIiBvclxuLy8gICBcImRkcCtzb2NranM6Ly9mb28tKioubWV0ZW9yLmNvbS9zb2NranNcIlxuLy9cbi8vIFdlIGRvIHNvbWUgcmV3cml0aW5nIG9mIHRoZSBVUkwgdG8gZXZlbnR1YWxseSBtYWtlIGl0IFwid3M6Ly9cIiBvciBcIndzczovL1wiLFxuLy8gd2hhdGV2ZXIgd2FzIHBhc3NlZCBpbi4gIEF0IHRoZSB2ZXJ5IGxlYXN0LCB3aGF0IE1ldGVvci5hYnNvbHV0ZVVybCgpIHJldHVybnNcbi8vIHVzIHNob3VsZCB3b3JrLlxuLy9cbi8vIFdlIGRvbid0IGRvIGFueSBoZWFydGJlYXRpbmcuIChUaGUgbG9naWMgdGhhdCBkaWQgdGhpcyBpbiBzb2NranMgd2FzIHJlbW92ZWQsXG4vLyBiZWNhdXNlIGl0IHVzZWQgYSBidWlsdC1pbiBzb2NranMgbWVjaGFuaXNtLiBXZSBjb3VsZCBkbyBpdCB3aXRoIFdlYlNvY2tldFxuLy8gcGluZyBmcmFtZXMgb3Igd2l0aCBERFAtbGV2ZWwgbWVzc2FnZXMuKVxuZXhwb3J0IGNsYXNzIENsaWVudFN0cmVhbSBleHRlbmRzIFN0cmVhbUNsaWVudENvbW1vbiB7XG4gIGNvbnN0cnVjdG9yKGVuZHBvaW50LCBvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG5cbiAgICB0aGlzLmNsaWVudCA9IG51bGw7IC8vIGNyZWF0ZWQgaW4gX2xhdW5jaENvbm5lY3Rpb25cbiAgICB0aGlzLmVuZHBvaW50ID0gZW5kcG9pbnQ7XG5cbiAgICB0aGlzLmhlYWRlcnMgPSB0aGlzLm9wdGlvbnMuaGVhZGVycyB8fCB7fTtcbiAgICB0aGlzLm5wbUZheWVPcHRpb25zID0gdGhpcy5vcHRpb25zLm5wbUZheWVPcHRpb25zIHx8IHt9O1xuXG4gICAgdGhpcy5faW5pdENvbW1vbih0aGlzLm9wdGlvbnMpO1xuXG4gICAgLy8vLyBLaWNrb2ZmIVxuICAgIHRoaXMuX2xhdW5jaENvbm5lY3Rpb24oKTtcbiAgfVxuXG4gIC8vIGRhdGEgaXMgYSB1dGY4IHN0cmluZy4gRGF0YSBzZW50IHdoaWxlIG5vdCBjb25uZWN0ZWQgaXMgZHJvcHBlZCBvblxuICAvLyB0aGUgZmxvb3IsIGFuZCBpdCBpcyB1cCB0aGUgdXNlciBvZiB0aGlzIEFQSSB0byByZXRyYW5zbWl0IGxvc3RcbiAgLy8gbWVzc2FnZXMgb24gJ3Jlc2V0J1xuICBzZW5kKGRhdGEpIHtcbiAgICBpZiAodGhpcy5jdXJyZW50U3RhdHVzLmNvbm5lY3RlZCkge1xuICAgICAgdGhpcy5jbGllbnQuc2VuZChkYXRhKTtcbiAgICB9XG4gIH1cblxuICAvLyBDaGFuZ2VzIHdoZXJlIHRoaXMgY29ubmVjdGlvbiBwb2ludHNcbiAgX2NoYW5nZVVybCh1cmwpIHtcbiAgICB0aGlzLmVuZHBvaW50ID0gdXJsO1xuICB9XG5cbiAgX29uQ29ubmVjdChjbGllbnQpIHtcbiAgICBpZiAoY2xpZW50ICE9PSB0aGlzLmNsaWVudCkge1xuICAgICAgLy8gVGhpcyBjb25uZWN0aW9uIGlzIG5vdCBmcm9tIHRoZSBsYXN0IGNhbGwgdG8gX2xhdW5jaENvbm5lY3Rpb24uXG4gICAgICAvLyBCdXQgX2xhdW5jaENvbm5lY3Rpb24gY2FsbHMgX2NsZWFudXAgd2hpY2ggY2xvc2VzIHByZXZpb3VzIGNvbm5lY3Rpb25zLlxuICAgICAgLy8gSXQncyBvdXIgYmVsaWVmIHRoYXQgdGhpcyBzdGlmbGVzIGZ1dHVyZSAnb3BlbicgZXZlbnRzLCBidXQgbWF5YmVcbiAgICAgIC8vIHdlIGFyZSB3cm9uZz9cbiAgICAgIHRocm93IG5ldyBFcnJvcignR290IG9wZW4gZnJvbSBpbmFjdGl2ZSBjbGllbnQgJyArICEhdGhpcy5jbGllbnQpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9mb3JjZWRUb0Rpc2Nvbm5lY3QpIHtcbiAgICAgIC8vIFdlIHdlcmUgYXNrZWQgdG8gZGlzY29ubmVjdCBiZXR3ZWVuIHRyeWluZyB0byBvcGVuIHRoZSBjb25uZWN0aW9uIGFuZFxuICAgICAgLy8gYWN0dWFsbHkgb3BlbmluZyBpdC4gTGV0J3MganVzdCBwcmV0ZW5kIHRoaXMgbmV2ZXIgaGFwcGVuZWQuXG4gICAgICB0aGlzLmNsaWVudC5jbG9zZSgpO1xuICAgICAgdGhpcy5jbGllbnQgPSBudWxsO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmICh0aGlzLmN1cnJlbnRTdGF0dXMuY29ubmVjdGVkKSB7XG4gICAgICAvLyBXZSBhbHJlYWR5IGhhdmUgYSBjb25uZWN0aW9uLiBJdCBtdXN0IGhhdmUgYmVlbiB0aGUgY2FzZSB0aGF0IHdlXG4gICAgICAvLyBzdGFydGVkIHR3byBwYXJhbGxlbCBjb25uZWN0aW9uIGF0dGVtcHRzIChiZWNhdXNlIHdlIHdhbnRlZCB0b1xuICAgICAgLy8gJ3JlY29ubmVjdCBub3cnIG9uIGEgaGFuZ2luZyBjb25uZWN0aW9uIGFuZCB3ZSBoYWQgbm8gd2F5IHRvIGNhbmNlbCB0aGVcbiAgICAgIC8vIGNvbm5lY3Rpb24gYXR0ZW1wdC4pIEJ1dCB0aGlzIHNob3VsZG4ndCBoYXBwZW4gKHNpbWlsYXJseSB0byB0aGUgY2xpZW50XG4gICAgICAvLyAhPT0gdGhpcy5jbGllbnQgY2hlY2sgYWJvdmUpLlxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdUd28gcGFyYWxsZWwgY29ubmVjdGlvbnM/Jyk7XG4gICAgfVxuXG4gICAgdGhpcy5fY2xlYXJDb25uZWN0aW9uVGltZXIoKTtcblxuICAgIC8vIHVwZGF0ZSBzdGF0dXNcbiAgICB0aGlzLmN1cnJlbnRTdGF0dXMuc3RhdHVzID0gJ2Nvbm5lY3RlZCc7XG4gICAgdGhpcy5jdXJyZW50U3RhdHVzLmNvbm5lY3RlZCA9IHRydWU7XG4gICAgdGhpcy5jdXJyZW50U3RhdHVzLnJldHJ5Q291bnQgPSAwO1xuICAgIHRoaXMuc3RhdHVzQ2hhbmdlZCgpO1xuXG4gICAgLy8gZmlyZSByZXNldHMuIFRoaXMgbXVzdCBjb21lIGFmdGVyIHN0YXR1cyBjaGFuZ2Ugc28gdGhhdCBjbGllbnRzXG4gICAgLy8gY2FuIGNhbGwgc2VuZCBmcm9tIHdpdGhpbiBhIHJlc2V0IGNhbGxiYWNrLlxuICAgIHRoaXMuZm9yRWFjaENhbGxiYWNrKCdyZXNldCcsIGNhbGxiYWNrID0+IHtcbiAgICAgIGNhbGxiYWNrKCk7XG4gICAgfSk7XG4gIH1cblxuICBfY2xlYW51cChtYXliZUVycm9yKSB7XG4gICAgdGhpcy5fY2xlYXJDb25uZWN0aW9uVGltZXIoKTtcbiAgICBpZiAodGhpcy5jbGllbnQpIHtcbiAgICAgIHZhciBjbGllbnQgPSB0aGlzLmNsaWVudDtcbiAgICAgIHRoaXMuY2xpZW50ID0gbnVsbDtcbiAgICAgIGNsaWVudC5jbG9zZSgpO1xuXG4gICAgICB0aGlzLmZvckVhY2hDYWxsYmFjaygnZGlzY29ubmVjdCcsIGNhbGxiYWNrID0+IHtcbiAgICAgICAgY2FsbGJhY2sobWF5YmVFcnJvcik7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICBfY2xlYXJDb25uZWN0aW9uVGltZXIoKSB7XG4gICAgaWYgKHRoaXMuY29ubmVjdGlvblRpbWVyKSB7XG4gICAgICBjbGVhclRpbWVvdXQodGhpcy5jb25uZWN0aW9uVGltZXIpO1xuICAgICAgdGhpcy5jb25uZWN0aW9uVGltZXIgPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIF9nZXRQcm94eVVybCh0YXJnZXRVcmwpIHtcbiAgICAvLyBTaW1pbGFyIHRvIGNvZGUgaW4gdG9vbHMvaHR0cC1oZWxwZXJzLmpzLlxuICAgIHZhciBwcm94eSA9IHByb2Nlc3MuZW52LkhUVFBfUFJPWFkgfHwgcHJvY2Vzcy5lbnYuaHR0cF9wcm94eSB8fCBudWxsO1xuICAgIHZhciBub3Byb3h5ID0gcHJvY2Vzcy5lbnYuTk9fUFJPWFkgfHwgcHJvY2Vzcy5lbnYubm9fcHJveHkgfHwgbnVsbDtcbiAgICAvLyBpZiB3ZSdyZSBnb2luZyB0byBhIHNlY3VyZSB1cmwsIHRyeSB0aGUgaHR0cHNfcHJveHkgZW52IHZhcmlhYmxlIGZpcnN0LlxuICAgIGlmICh0YXJnZXRVcmwubWF0Y2goL153c3M6LynCoHx8IHRhcmdldFVybC5tYXRjaCgvXmh0dHBzOi8pKSB7XG4gICAgICBwcm94eSA9IHByb2Nlc3MuZW52LkhUVFBTX1BST1hZIHx8IHByb2Nlc3MuZW52Lmh0dHBzX3Byb3h5IHx8IHByb3h5O1xuICAgIH1cbiAgICBpZiAodGFyZ2V0VXJsLmluZGV4T2YoJ2xvY2FsaG9zdCcpICE9IC0xIHx8wqB0YXJnZXRVcmwuaW5kZXhPZignMTI3LjAuMC4xJykgIT0gLTEpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBpZiAobm9wcm94eSkge1xuICAgICAgZm9yIChsZXQgaXRlbSBvZiBub3Byb3h5LnNwbGl0KCcsJykpIHtcbiAgICAgICAgaWYgKHRhcmdldFVybC5pbmRleE9mKGl0ZW0udHJpbSgpLnJlcGxhY2UoL1xcKi8sICcnKSkgIT09IC0xKSB7XG4gICAgICAgICAgcHJveHkgPSBudWxsO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBwcm94eTtcbiAgfVxuXG4gIF9sYXVuY2hDb25uZWN0aW9uKCkge1xuICAgIHRoaXMuX2NsZWFudXAoKTsgLy8gY2xlYW51cCB0aGUgb2xkIHNvY2tldCwgaWYgdGhlcmUgd2FzIG9uZS5cblxuICAgIC8vIFNpbmNlIHNlcnZlci10by1zZXJ2ZXIgRERQIGlzIHN0aWxsIGFuIGV4cGVyaW1lbnRhbCBmZWF0dXJlLCB3ZSBvbmx5XG4gICAgLy8gcmVxdWlyZSB0aGUgbW9kdWxlIGlmIHdlIGFjdHVhbGx5IGNyZWF0ZSBhIHNlcnZlci10by1zZXJ2ZXJcbiAgICAvLyBjb25uZWN0aW9uLlxuICAgIHZhciBGYXllV2ViU29ja2V0ID0gTnBtLnJlcXVpcmUoJ2ZheWUtd2Vic29ja2V0Jyk7XG4gICAgdmFyIGRlZmxhdGUgPSBOcG0ucmVxdWlyZSgncGVybWVzc2FnZS1kZWZsYXRlJyk7XG5cbiAgICB2YXIgdGFyZ2V0VXJsID0gdG9XZWJzb2NrZXRVcmwodGhpcy5lbmRwb2ludCk7XG4gICAgdmFyIGZheWVPcHRpb25zID0ge1xuICAgICAgaGVhZGVyczogdGhpcy5oZWFkZXJzLFxuICAgICAgZXh0ZW5zaW9uczogW2RlZmxhdGVdXG4gICAgfTtcbiAgICBmYXllT3B0aW9ucyA9IE9iamVjdC5hc3NpZ24oZmF5ZU9wdGlvbnMsIHRoaXMubnBtRmF5ZU9wdGlvbnMpO1xuICAgIHZhciBwcm94eVVybCA9IHRoaXMuX2dldFByb3h5VXJsKHRhcmdldFVybCk7XG4gICAgaWYgKHByb3h5VXJsKSB7XG4gICAgICBmYXllT3B0aW9ucy5wcm94eSA9IHsgb3JpZ2luOiBwcm94eVVybCB9O1xuICAgIH1cblxuICAgIC8vIFdlIHdvdWxkIGxpa2UgdG8gc3BlY2lmeSAnZGRwJyBhcyB0aGUgc3VicHJvdG9jb2wgaGVyZS4gVGhlIG5wbSBtb2R1bGUgd2VcbiAgICAvLyB1c2VkIHRvIHVzZSBhcyBhIGNsaWVudCB3b3VsZCBmYWlsIHRoZSBoYW5kc2hha2UgaWYgd2UgYXNrIGZvciBhXG4gICAgLy8gc3VicHJvdG9jb2wgYW5kIHRoZSBzZXJ2ZXIgZG9lc24ndCBzZW5kIG9uZSBiYWNrIChhbmQgc29ja2pzIGRvZXNuJ3QpLlxuICAgIC8vIEZheWUgZG9lc24ndCBoYXZlIHRoYXQgYmVoYXZpb3I7IGl0J3MgdW5jbGVhciBmcm9tIHJlYWRpbmcgUkZDIDY0NTUgaWZcbiAgICAvLyBGYXllIGlzIGVycm9uZW91cyBvciBub3QuICBTbyBmb3Igbm93LCB3ZSBkb24ndCBzcGVjaWZ5IHByb3RvY29scy5cbiAgICB2YXIgc3VicHJvdG9jb2xzID0gW107XG5cbiAgICB2YXIgY2xpZW50ID0gKHRoaXMuY2xpZW50ID0gbmV3IEZheWVXZWJTb2NrZXQuQ2xpZW50KFxuICAgICAgdGFyZ2V0VXJsLFxuICAgICAgc3VicHJvdG9jb2xzLFxuICAgICAgZmF5ZU9wdGlvbnNcbiAgICApKTtcblxuICAgIHRoaXMuX2NsZWFyQ29ubmVjdGlvblRpbWVyKCk7XG4gICAgdGhpcy5jb25uZWN0aW9uVGltZXIgPSBNZXRlb3Iuc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICB0aGlzLl9sb3N0Q29ubmVjdGlvbihuZXcgdGhpcy5Db25uZWN0aW9uRXJyb3IoJ0REUCBjb25uZWN0aW9uIHRpbWVkIG91dCcpKTtcbiAgICB9LCB0aGlzLkNPTk5FQ1RfVElNRU9VVCk7XG5cbiAgICB0aGlzLmNsaWVudC5vbihcbiAgICAgICdvcGVuJyxcbiAgICAgIE1ldGVvci5iaW5kRW52aXJvbm1lbnQoKCkgPT4ge1xuICAgICAgICByZXR1cm4gdGhpcy5fb25Db25uZWN0KGNsaWVudCk7XG4gICAgICB9LCAnc3RyZWFtIGNvbm5lY3QgY2FsbGJhY2snKVxuICAgICk7XG5cbiAgICB2YXIgY2xpZW50T25JZkN1cnJlbnQgPSAoZXZlbnQsIGRlc2NyaXB0aW9uLCBjYWxsYmFjaykgPT4ge1xuICAgICAgdGhpcy5jbGllbnQub24oXG4gICAgICAgIGV2ZW50LFxuICAgICAgICBNZXRlb3IuYmluZEVudmlyb25tZW50KCguLi5hcmdzKSA9PiB7XG4gICAgICAgICAgLy8gSWdub3JlIGV2ZW50cyBmcm9tIGFueSBjb25uZWN0aW9uIHdlJ3ZlIGFscmVhZHkgY2xlYW5lZCB1cC5cbiAgICAgICAgICBpZiAoY2xpZW50ICE9PSB0aGlzLmNsaWVudCkgcmV0dXJuO1xuICAgICAgICAgIGNhbGxiYWNrKC4uLmFyZ3MpO1xuICAgICAgICB9LCBkZXNjcmlwdGlvbilcbiAgICAgICk7XG4gICAgfTtcblxuICAgIGNsaWVudE9uSWZDdXJyZW50KCdlcnJvcicsICdzdHJlYW0gZXJyb3IgY2FsbGJhY2snLCBlcnJvciA9PiB7XG4gICAgICBpZiAoIXRoaXMub3B0aW9ucy5fZG9udFByaW50RXJyb3JzKVxuICAgICAgICBNZXRlb3IuX2RlYnVnKCdzdHJlYW0gZXJyb3InLCBlcnJvci5tZXNzYWdlKTtcblxuICAgICAgLy8gRmF5ZSdzICdlcnJvcicgb2JqZWN0IGlzIG5vdCBhIEpTIGVycm9yIChhbmQgYW1vbmcgb3RoZXIgdGhpbmdzLFxuICAgICAgLy8gZG9lc24ndCBzdHJpbmdpZnkgd2VsbCkuIENvbnZlcnQgaXQgdG8gb25lLlxuICAgICAgdGhpcy5fbG9zdENvbm5lY3Rpb24obmV3IHRoaXMuQ29ubmVjdGlvbkVycm9yKGVycm9yLm1lc3NhZ2UpKTtcbiAgICB9KTtcblxuICAgIGNsaWVudE9uSWZDdXJyZW50KCdjbG9zZScsICdzdHJlYW0gY2xvc2UgY2FsbGJhY2snLCAoKSA9PiB7XG4gICAgICB0aGlzLl9sb3N0Q29ubmVjdGlvbigpO1xuICAgIH0pO1xuXG4gICAgY2xpZW50T25JZkN1cnJlbnQoJ21lc3NhZ2UnLCAnc3RyZWFtIG1lc3NhZ2UgY2FsbGJhY2snLCBtZXNzYWdlID0+IHtcbiAgICAgIC8vIElnbm9yZSBiaW5hcnkgZnJhbWVzLCB3aGVyZSBtZXNzYWdlLmRhdGEgaXMgYSBCdWZmZXJcbiAgICAgIGlmICh0eXBlb2YgbWVzc2FnZS5kYXRhICE9PSAnc3RyaW5nJykgcmV0dXJuO1xuXG4gICAgICB0aGlzLmZvckVhY2hDYWxsYmFjaygnbWVzc2FnZScsIGNhbGxiYWNrID0+IHtcbiAgICAgICAgY2FsbGJhY2sobWVzc2FnZS5kYXRhKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG59XG4iLCJpbXBvcnQgeyBSZXRyeSB9IGZyb20gJ21ldGVvci9yZXRyeSc7XG5cbmNvbnN0IGZvcmNlZFJlY29ubmVjdEVycm9yID0gbmV3IEVycm9yKFwiZm9yY2VkIHJlY29ubmVjdFwiKTtcblxuZXhwb3J0IGNsYXNzIFN0cmVhbUNsaWVudENvbW1vbiB7XG4gIGNvbnN0cnVjdG9yKG9wdGlvbnMpIHtcbiAgICB0aGlzLm9wdGlvbnMgPSB7XG4gICAgICByZXRyeTogdHJ1ZSxcbiAgICAgIC4uLihvcHRpb25zIHx8IG51bGwpLFxuICAgIH07XG5cbiAgICB0aGlzLkNvbm5lY3Rpb25FcnJvciA9XG4gICAgICBvcHRpb25zICYmIG9wdGlvbnMuQ29ubmVjdGlvbkVycm9yIHx8IEVycm9yO1xuICB9XG5cbiAgLy8gUmVnaXN0ZXIgZm9yIGNhbGxiYWNrcy5cbiAgb24obmFtZSwgY2FsbGJhY2spIHtcbiAgICBpZiAobmFtZSAhPT0gJ21lc3NhZ2UnICYmIG5hbWUgIT09ICdyZXNldCcgJiYgbmFtZSAhPT0gJ2Rpc2Nvbm5lY3QnKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bmtub3duIGV2ZW50IHR5cGU6ICcgKyBuYW1lKTtcblxuICAgIGlmICghdGhpcy5ldmVudENhbGxiYWNrc1tuYW1lXSkgdGhpcy5ldmVudENhbGxiYWNrc1tuYW1lXSA9IFtdO1xuICAgIHRoaXMuZXZlbnRDYWxsYmFja3NbbmFtZV0ucHVzaChjYWxsYmFjayk7XG4gIH1cblxuICBmb3JFYWNoQ2FsbGJhY2sobmFtZSwgY2IpIHtcbiAgICBpZiAoIXRoaXMuZXZlbnRDYWxsYmFja3NbbmFtZV0gfHwgIXRoaXMuZXZlbnRDYWxsYmFja3NbbmFtZV0ubGVuZ3RoKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5ldmVudENhbGxiYWNrc1tuYW1lXS5mb3JFYWNoKGNiKTtcbiAgfVxuXG4gIF9pbml0Q29tbW9uKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zID0gb3B0aW9ucyB8fCBPYmplY3QuY3JlYXRlKG51bGwpO1xuXG4gICAgLy8vLyBDb25zdGFudHNcblxuICAgIC8vIGhvdyBsb25nIHRvIHdhaXQgdW50aWwgd2UgZGVjbGFyZSB0aGUgY29ubmVjdGlvbiBhdHRlbXB0XG4gICAgLy8gZmFpbGVkLlxuICAgIHRoaXMuQ09OTkVDVF9USU1FT1VUID0gb3B0aW9ucy5jb25uZWN0VGltZW91dE1zIHx8IDEwMDAwO1xuXG4gICAgdGhpcy5ldmVudENhbGxiYWNrcyA9IE9iamVjdC5jcmVhdGUobnVsbCk7IC8vIG5hbWUgLT4gW2NhbGxiYWNrXVxuXG4gICAgdGhpcy5fZm9yY2VkVG9EaXNjb25uZWN0ID0gZmFsc2U7XG5cbiAgICAvLy8vIFJlYWN0aXZlIHN0YXR1c1xuICAgIHRoaXMuY3VycmVudFN0YXR1cyA9IHtcbiAgICAgIHN0YXR1czogJ2Nvbm5lY3RpbmcnLFxuICAgICAgY29ubmVjdGVkOiBmYWxzZSxcbiAgICAgIHJldHJ5Q291bnQ6IDBcbiAgICB9O1xuXG4gICAgaWYgKFBhY2thZ2UudHJhY2tlcikge1xuICAgICAgdGhpcy5zdGF0dXNMaXN0ZW5lcnMgPSBuZXcgUGFja2FnZS50cmFja2VyLlRyYWNrZXIuRGVwZW5kZW5jeSgpO1xuICAgIH1cblxuICAgIHRoaXMuc3RhdHVzQ2hhbmdlZCA9ICgpID0+IHtcbiAgICAgIGlmICh0aGlzLnN0YXR1c0xpc3RlbmVycykge1xuICAgICAgICB0aGlzLnN0YXR1c0xpc3RlbmVycy5jaGFuZ2VkKCk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIC8vLy8gUmV0cnkgbG9naWNcbiAgICB0aGlzLl9yZXRyeSA9IG5ldyBSZXRyeSgpO1xuICAgIHRoaXMuY29ubmVjdGlvblRpbWVyID0gbnVsbDtcbiAgfVxuXG4gIC8vIFRyaWdnZXIgYSByZWNvbm5lY3QuXG4gIHJlY29ubmVjdChvcHRpb25zKSB7XG4gICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwgT2JqZWN0LmNyZWF0ZShudWxsKTtcblxuICAgIGlmIChvcHRpb25zLnVybCkge1xuICAgICAgdGhpcy5fY2hhbmdlVXJsKG9wdGlvbnMudXJsKTtcbiAgICB9XG5cbiAgICBpZiAob3B0aW9ucy5fc29ja2pzT3B0aW9ucykge1xuICAgICAgdGhpcy5vcHRpb25zLl9zb2NranNPcHRpb25zID0gb3B0aW9ucy5fc29ja2pzT3B0aW9ucztcbiAgICB9XG5cbiAgICBpZiAodGhpcy5jdXJyZW50U3RhdHVzLmNvbm5lY3RlZCkge1xuICAgICAgaWYgKG9wdGlvbnMuX2ZvcmNlIHx8IG9wdGlvbnMudXJsKSB7XG4gICAgICAgIHRoaXMuX2xvc3RDb25uZWN0aW9uKGZvcmNlZFJlY29ubmVjdEVycm9yKTtcbiAgICAgIH1cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBpZiB3ZSdyZSBtaWQtY29ubmVjdGlvbiwgc3RvcCBpdC5cbiAgICBpZiAodGhpcy5jdXJyZW50U3RhdHVzLnN0YXR1cyA9PT0gJ2Nvbm5lY3RpbmcnKSB7XG4gICAgICAvLyBQcmV0ZW5kIGl0J3MgYSBjbGVhbiBjbG9zZS5cbiAgICAgIHRoaXMuX2xvc3RDb25uZWN0aW9uKCk7XG4gICAgfVxuXG4gICAgdGhpcy5fcmV0cnkuY2xlYXIoKTtcbiAgICB0aGlzLmN1cnJlbnRTdGF0dXMucmV0cnlDb3VudCAtPSAxOyAvLyBkb24ndCBjb3VudCBtYW51YWwgcmV0cmllc1xuICAgIHRoaXMuX3JldHJ5Tm93KCk7XG4gIH1cblxuICBkaXNjb25uZWN0KG9wdGlvbnMpIHtcbiAgICBvcHRpb25zID0gb3B0aW9ucyB8fCBPYmplY3QuY3JlYXRlKG51bGwpO1xuXG4gICAgLy8gRmFpbGVkIGlzIHBlcm1hbmVudC4gSWYgd2UncmUgZmFpbGVkLCBkb24ndCBsZXQgcGVvcGxlIGdvIGJhY2tcbiAgICAvLyBvbmxpbmUgYnkgY2FsbGluZyAnZGlzY29ubmVjdCcgdGhlbiAncmVjb25uZWN0Jy5cbiAgICBpZiAodGhpcy5fZm9yY2VkVG9EaXNjb25uZWN0KSByZXR1cm47XG5cbiAgICAvLyBJZiBfcGVybWFuZW50IGlzIHNldCwgcGVybWFuZW50bHkgZGlzY29ubmVjdCBhIHN0cmVhbS4gT25jZSBhIHN0cmVhbVxuICAgIC8vIGlzIGZvcmNlZCB0byBkaXNjb25uZWN0LCBpdCBjYW4gbmV2ZXIgcmVjb25uZWN0LiBUaGlzIGlzIGZvclxuICAgIC8vIGVycm9yIGNhc2VzIHN1Y2ggYXMgZGRwIHZlcnNpb24gbWlzbWF0Y2gsIHdoZXJlIHRyeWluZyBhZ2FpblxuICAgIC8vIHdvbid0IGZpeCB0aGUgcHJvYmxlbS5cbiAgICBpZiAob3B0aW9ucy5fcGVybWFuZW50KSB7XG4gICAgICB0aGlzLl9mb3JjZWRUb0Rpc2Nvbm5lY3QgPSB0cnVlO1xuICAgIH1cblxuICAgIHRoaXMuX2NsZWFudXAoKTtcbiAgICB0aGlzLl9yZXRyeS5jbGVhcigpO1xuXG4gICAgdGhpcy5jdXJyZW50U3RhdHVzID0ge1xuICAgICAgc3RhdHVzOiBvcHRpb25zLl9wZXJtYW5lbnQgPyAnZmFpbGVkJyA6ICdvZmZsaW5lJyxcbiAgICAgIGNvbm5lY3RlZDogZmFsc2UsXG4gICAgICByZXRyeUNvdW50OiAwXG4gICAgfTtcblxuICAgIGlmIChvcHRpb25zLl9wZXJtYW5lbnQgJiYgb3B0aW9ucy5fZXJyb3IpXG4gICAgICB0aGlzLmN1cnJlbnRTdGF0dXMucmVhc29uID0gb3B0aW9ucy5fZXJyb3I7XG5cbiAgICB0aGlzLnN0YXR1c0NoYW5nZWQoKTtcbiAgfVxuXG4gIC8vIG1heWJlRXJyb3IgaXMgc2V0IHVubGVzcyBpdCdzIGEgY2xlYW4gcHJvdG9jb2wtbGV2ZWwgY2xvc2UuXG4gIF9sb3N0Q29ubmVjdGlvbihtYXliZUVycm9yKSB7XG4gICAgdGhpcy5fY2xlYW51cChtYXliZUVycm9yKTtcbiAgICB0aGlzLl9yZXRyeUxhdGVyKG1heWJlRXJyb3IpOyAvLyBzZXRzIHN0YXR1cy4gbm8gbmVlZCB0byBkbyBpdCBoZXJlLlxuICB9XG5cbiAgLy8gZmlyZWQgd2hlbiB3ZSBkZXRlY3QgdGhhdCB3ZSd2ZSBnb25lIG9ubGluZS4gdHJ5IHRvIHJlY29ubmVjdFxuICAvLyBpbW1lZGlhdGVseS5cbiAgX29ubGluZSgpIHtcbiAgICAvLyBpZiB3ZSd2ZSByZXF1ZXN0ZWQgdG8gYmUgb2ZmbGluZSBieSBkaXNjb25uZWN0aW5nLCBkb24ndCByZWNvbm5lY3QuXG4gICAgaWYgKHRoaXMuY3VycmVudFN0YXR1cy5zdGF0dXMgIT0gJ29mZmxpbmUnKSB0aGlzLnJlY29ubmVjdCgpO1xuICB9XG5cbiAgX3JldHJ5TGF0ZXIobWF5YmVFcnJvcikge1xuICAgIHZhciB0aW1lb3V0ID0gMDtcbiAgICBpZiAodGhpcy5vcHRpb25zLnJldHJ5IHx8XG4gICAgICAgIG1heWJlRXJyb3IgPT09IGZvcmNlZFJlY29ubmVjdEVycm9yKSB7XG4gICAgICB0aW1lb3V0ID0gdGhpcy5fcmV0cnkucmV0cnlMYXRlcihcbiAgICAgICAgdGhpcy5jdXJyZW50U3RhdHVzLnJldHJ5Q291bnQsXG4gICAgICAgIHRoaXMuX3JldHJ5Tm93LmJpbmQodGhpcylcbiAgICAgICk7XG4gICAgICB0aGlzLmN1cnJlbnRTdGF0dXMuc3RhdHVzID0gJ3dhaXRpbmcnO1xuICAgICAgdGhpcy5jdXJyZW50U3RhdHVzLnJldHJ5VGltZSA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpICsgdGltZW91dDtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5jdXJyZW50U3RhdHVzLnN0YXR1cyA9ICdmYWlsZWQnO1xuICAgICAgZGVsZXRlIHRoaXMuY3VycmVudFN0YXR1cy5yZXRyeVRpbWU7XG4gICAgfVxuXG4gICAgdGhpcy5jdXJyZW50U3RhdHVzLmNvbm5lY3RlZCA9IGZhbHNlO1xuICAgIHRoaXMuc3RhdHVzQ2hhbmdlZCgpO1xuICB9XG5cbiAgX3JldHJ5Tm93KCkge1xuICAgIGlmICh0aGlzLl9mb3JjZWRUb0Rpc2Nvbm5lY3QpIHJldHVybjtcblxuICAgIHRoaXMuY3VycmVudFN0YXR1cy5yZXRyeUNvdW50ICs9IDE7XG4gICAgdGhpcy5jdXJyZW50U3RhdHVzLnN0YXR1cyA9ICdjb25uZWN0aW5nJztcbiAgICB0aGlzLmN1cnJlbnRTdGF0dXMuY29ubmVjdGVkID0gZmFsc2U7XG4gICAgZGVsZXRlIHRoaXMuY3VycmVudFN0YXR1cy5yZXRyeVRpbWU7XG4gICAgdGhpcy5zdGF0dXNDaGFuZ2VkKCk7XG5cbiAgICB0aGlzLl9sYXVuY2hDb25uZWN0aW9uKCk7XG4gIH1cblxuICAvLyBHZXQgY3VycmVudCBzdGF0dXMuIFJlYWN0aXZlLlxuICBzdGF0dXMoKSB7XG4gICAgaWYgKHRoaXMuc3RhdHVzTGlzdGVuZXJzKSB7XG4gICAgICB0aGlzLnN0YXR1c0xpc3RlbmVycy5kZXBlbmQoKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuY3VycmVudFN0YXR1cztcbiAgfVxufVxuIiwiaW1wb3J0IHsgTWV0ZW9yIH0gZnJvbSBcIm1ldGVvci9tZXRlb3JcIjtcblxuLy8gQHBhcmFtIHVybCB7U3RyaW5nfSBVUkwgdG8gTWV0ZW9yIGFwcCwgZWc6XG4vLyAgIFwiL1wiIG9yIFwibWFkZXdpdGgubWV0ZW9yLmNvbVwiIG9yIFwiaHR0cHM6Ly9mb28ubWV0ZW9yLmNvbVwiXG4vLyAgIG9yIFwiZGRwK3NvY2tqczovL2RkcC0tKioqKi1mb28ubWV0ZW9yLmNvbS9zb2NranNcIlxuLy8gQHJldHVybnMge1N0cmluZ30gVVJMIHRvIHRoZSBlbmRwb2ludCB3aXRoIHRoZSBzcGVjaWZpYyBzY2hlbWUgYW5kIHN1YlBhdGgsIGUuZy5cbi8vIGZvciBzY2hlbWUgXCJodHRwXCIgYW5kIHN1YlBhdGggXCJzb2NranNcIlxuLy8gICBcImh0dHA6Ly9zdWJkb21haW4ubWV0ZW9yLmNvbS9zb2NranNcIiBvciBcIi9zb2NranNcIlxuLy8gICBvciBcImh0dHBzOi8vZGRwLS0xMjM0LWZvby5tZXRlb3IuY29tL3NvY2tqc1wiXG5mdW5jdGlvbiB0cmFuc2xhdGVVcmwodXJsLCBuZXdTY2hlbWVCYXNlLCBzdWJQYXRoKSB7XG4gIGlmICghbmV3U2NoZW1lQmFzZSkge1xuICAgIG5ld1NjaGVtZUJhc2UgPSAnaHR0cCc7XG4gIH1cblxuICBpZiAoc3ViUGF0aCAhPT0gXCJzb2NranNcIiAmJiB1cmwuc3RhcnRzV2l0aChcIi9cIikpIHtcbiAgICB1cmwgPSBNZXRlb3IuYWJzb2x1dGVVcmwodXJsLnN1YnN0cigxKSk7XG4gIH1cblxuICB2YXIgZGRwVXJsTWF0Y2ggPSB1cmwubWF0Y2goL15kZHAoaT8pXFwrc29ja2pzOlxcL1xcLy8pO1xuICB2YXIgaHR0cFVybE1hdGNoID0gdXJsLm1hdGNoKC9eaHR0cChzPyk6XFwvXFwvLyk7XG4gIHZhciBuZXdTY2hlbWU7XG4gIGlmIChkZHBVcmxNYXRjaCkge1xuICAgIC8vIFJlbW92ZSBzY2hlbWUgYW5kIHNwbGl0IG9mZiB0aGUgaG9zdC5cbiAgICB2YXIgdXJsQWZ0ZXJERFAgPSB1cmwuc3Vic3RyKGRkcFVybE1hdGNoWzBdLmxlbmd0aCk7XG4gICAgbmV3U2NoZW1lID0gZGRwVXJsTWF0Y2hbMV0gPT09ICdpJyA/IG5ld1NjaGVtZUJhc2UgOiBuZXdTY2hlbWVCYXNlICsgJ3MnO1xuICAgIHZhciBzbGFzaFBvcyA9IHVybEFmdGVyRERQLmluZGV4T2YoJy8nKTtcbiAgICB2YXIgaG9zdCA9IHNsYXNoUG9zID09PSAtMSA/IHVybEFmdGVyRERQIDogdXJsQWZ0ZXJERFAuc3Vic3RyKDAsIHNsYXNoUG9zKTtcbiAgICB2YXIgcmVzdCA9IHNsYXNoUG9zID09PSAtMSA/ICcnIDogdXJsQWZ0ZXJERFAuc3Vic3RyKHNsYXNoUG9zKTtcblxuICAgIC8vIEluIHRoZSBob3N0IChPTkxZISksIGNoYW5nZSAnKicgY2hhcmFjdGVycyBpbnRvIHJhbmRvbSBkaWdpdHMuIFRoaXNcbiAgICAvLyBhbGxvd3MgZGlmZmVyZW50IHN0cmVhbSBjb25uZWN0aW9ucyB0byBjb25uZWN0IHRvIGRpZmZlcmVudCBob3N0bmFtZXNcbiAgICAvLyBhbmQgYXZvaWQgYnJvd3NlciBwZXItaG9zdG5hbWUgY29ubmVjdGlvbiBsaW1pdHMuXG4gICAgaG9zdCA9IGhvc3QucmVwbGFjZSgvXFwqL2csICgpID0+IE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIDEwKSk7XG5cbiAgICByZXR1cm4gbmV3U2NoZW1lICsgJzovLycgKyBob3N0ICsgcmVzdDtcbiAgfSBlbHNlIGlmIChodHRwVXJsTWF0Y2gpIHtcbiAgICBuZXdTY2hlbWUgPSAhaHR0cFVybE1hdGNoWzFdID8gbmV3U2NoZW1lQmFzZSA6IG5ld1NjaGVtZUJhc2UgKyAncyc7XG4gICAgdmFyIHVybEFmdGVySHR0cCA9IHVybC5zdWJzdHIoaHR0cFVybE1hdGNoWzBdLmxlbmd0aCk7XG4gICAgdXJsID0gbmV3U2NoZW1lICsgJzovLycgKyB1cmxBZnRlckh0dHA7XG4gIH1cblxuICAvLyBQcmVmaXggRlFETnMgYnV0IG5vdCByZWxhdGl2ZSBVUkxzXG4gIGlmICh1cmwuaW5kZXhPZignOi8vJykgPT09IC0xICYmICF1cmwuc3RhcnRzV2l0aCgnLycpKSB7XG4gICAgdXJsID0gbmV3U2NoZW1lQmFzZSArICc6Ly8nICsgdXJsO1xuICB9XG5cbiAgLy8gWFhYIFRoaXMgaXMgbm90IHdoYXQgd2Ugc2hvdWxkIGJlIGRvaW5nOiBpZiBJIGhhdmUgYSBzaXRlXG4gIC8vIGRlcGxveWVkIGF0IFwiL2Zvb1wiLCB0aGVuIEREUC5jb25uZWN0KFwiL1wiKSBzaG91bGQgYWN0dWFsbHkgY29ubmVjdFxuICAvLyB0byBcIi9cIiwgbm90IHRvIFwiL2Zvb1wiLiBcIi9cIiBpcyBhbiBhYnNvbHV0ZSBwYXRoLiAoQ29udHJhc3Q6IGlmXG4gIC8vIGRlcGxveWVkIGF0IFwiL2Zvb1wiLCBpdCB3b3VsZCBiZSByZWFzb25hYmxlIGZvciBERFAuY29ubmVjdChcImJhclwiKVxuICAvLyB0byBjb25uZWN0IHRvIFwiL2Zvby9iYXJcIikuXG4gIC8vXG4gIC8vIFdlIHNob3VsZCBtYWtlIHRoaXMgcHJvcGVybHkgaG9ub3IgYWJzb2x1dGUgcGF0aHMgcmF0aGVyIHRoYW5cbiAgLy8gZm9yY2luZyB0aGUgcGF0aCB0byBiZSByZWxhdGl2ZSB0byB0aGUgc2l0ZSByb290LiBTaW11bHRhbmVvdXNseSxcbiAgLy8gd2Ugc2hvdWxkIHNldCBERFBfREVGQVVMVF9DT05ORUNUSU9OX1VSTCB0byBpbmNsdWRlIHRoZSBzaXRlXG4gIC8vIHJvb3QuIFNlZSBhbHNvIGNsaWVudF9jb252ZW5pZW5jZS5qcyAjUmF0aW9uYWxpemluZ1JlbGF0aXZlRERQVVJMc1xuICB1cmwgPSBNZXRlb3IuX3JlbGF0aXZlVG9TaXRlUm9vdFVybCh1cmwpO1xuXG4gIGlmICh1cmwuZW5kc1dpdGgoJy8nKSkgcmV0dXJuIHVybCArIHN1YlBhdGg7XG4gIGVsc2UgcmV0dXJuIHVybCArICcvJyArIHN1YlBhdGg7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0b1NvY2tqc1VybCh1cmwpIHtcbiAgcmV0dXJuIHRyYW5zbGF0ZVVybCh1cmwsICdodHRwJywgJ3NvY2tqcycpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdG9XZWJzb2NrZXRVcmwodXJsKSB7XG4gIHJldHVybiB0cmFuc2xhdGVVcmwodXJsLCAnd3MnLCAnd2Vic29ja2V0Jyk7XG59XG4iXX0=
