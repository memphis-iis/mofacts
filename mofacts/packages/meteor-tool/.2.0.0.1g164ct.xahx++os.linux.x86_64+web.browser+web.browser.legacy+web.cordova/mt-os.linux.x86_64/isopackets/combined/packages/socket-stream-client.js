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
      this.headers = this.options.headers || Object.create(null);
      this.npmFayeOptions = this.options.npmFayeOptions || Object.create(null);

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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvc29ja2V0LXN0cmVhbS1jbGllbnQvc2VydmVyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9zb2NrZXQtc3RyZWFtLWNsaWVudC9ub2RlLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9zb2NrZXQtc3RyZWFtLWNsaWVudC9jb21tb24uanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3NvY2tldC1zdHJlYW0tY2xpZW50L3VybHMuanMiXSwibmFtZXMiOlsic2V0TWluaW11bUJyb3dzZXJWZXJzaW9ucyIsIm1vZHVsZTEiLCJsaW5rIiwidiIsImNocm9tZSIsImVkZ2UiLCJmaXJlZm94IiwiaWUiLCJtb2JpbGVTYWZhcmkiLCJwaGFudG9tanMiLCJzYWZhcmkiLCJlbGVjdHJvbiIsIm1vZHVsZSIsImlkIiwiZXhwb3J0IiwiQ2xpZW50U3RyZWFtIiwiTWV0ZW9yIiwidG9XZWJzb2NrZXRVcmwiLCJTdHJlYW1DbGllbnRDb21tb24iLCJjb25zdHJ1Y3RvciIsImVuZHBvaW50Iiwib3B0aW9ucyIsImNsaWVudCIsImhlYWRlcnMiLCJPYmplY3QiLCJjcmVhdGUiLCJucG1GYXllT3B0aW9ucyIsIl9pbml0Q29tbW9uIiwiX2xhdW5jaENvbm5lY3Rpb24iLCJzZW5kIiwiZGF0YSIsImN1cnJlbnRTdGF0dXMiLCJjb25uZWN0ZWQiLCJfY2hhbmdlVXJsIiwidXJsIiwiX29uQ29ubmVjdCIsIkVycm9yIiwiX2ZvcmNlZFRvRGlzY29ubmVjdCIsImNsb3NlIiwiX2NsZWFyQ29ubmVjdGlvblRpbWVyIiwic3RhdHVzIiwicmV0cnlDb3VudCIsInN0YXR1c0NoYW5nZWQiLCJmb3JFYWNoQ2FsbGJhY2siLCJjYWxsYmFjayIsIl9jbGVhbnVwIiwibWF5YmVFcnJvciIsImNvbm5lY3Rpb25UaW1lciIsImNsZWFyVGltZW91dCIsIl9nZXRQcm94eVVybCIsInRhcmdldFVybCIsInByb3h5IiwicHJvY2VzcyIsImVudiIsIkhUVFBfUFJPWFkiLCJodHRwX3Byb3h5Iiwibm9wcm94eSIsIk5PX1BST1hZIiwibm9fcHJveHkiLCJtYXRjaCIsIkhUVFBTX1BST1hZIiwiaHR0cHNfcHJveHkiLCJpbmRleE9mIiwiaXRlbSIsInNwbGl0IiwidHJpbSIsInJlcGxhY2UiLCJGYXllV2ViU29ja2V0IiwiTnBtIiwicmVxdWlyZSIsImRlZmxhdGUiLCJmYXllT3B0aW9ucyIsImV4dGVuc2lvbnMiLCJhc3NpZ24iLCJwcm94eVVybCIsIm9yaWdpbiIsInN1YnByb3RvY29scyIsIkNsaWVudCIsInNldFRpbWVvdXQiLCJfbG9zdENvbm5lY3Rpb24iLCJDb25uZWN0aW9uRXJyb3IiLCJDT05ORUNUX1RJTUVPVVQiLCJvbiIsImJpbmRFbnZpcm9ubWVudCIsImNsaWVudE9uSWZDdXJyZW50IiwiZXZlbnQiLCJkZXNjcmlwdGlvbiIsImVycm9yIiwiX2RvbnRQcmludEVycm9ycyIsIl9kZWJ1ZyIsIm1lc3NhZ2UiLCJfb2JqZWN0U3ByZWFkIiwiZGVmYXVsdCIsIlJldHJ5IiwiZm9yY2VkUmVjb25uZWN0RXJyb3IiLCJyZXRyeSIsIm5hbWUiLCJldmVudENhbGxiYWNrcyIsInB1c2giLCJjYiIsImxlbmd0aCIsImZvckVhY2giLCJjb25uZWN0VGltZW91dE1zIiwiUGFja2FnZSIsInRyYWNrZXIiLCJzdGF0dXNMaXN0ZW5lcnMiLCJUcmFja2VyIiwiRGVwZW5kZW5jeSIsImNoYW5nZWQiLCJfcmV0cnkiLCJyZWNvbm5lY3QiLCJfc29ja2pzT3B0aW9ucyIsIl9mb3JjZSIsImNsZWFyIiwiX3JldHJ5Tm93IiwiZGlzY29ubmVjdCIsIl9wZXJtYW5lbnQiLCJfZXJyb3IiLCJyZWFzb24iLCJfcmV0cnlMYXRlciIsIl9vbmxpbmUiLCJ0aW1lb3V0IiwicmV0cnlMYXRlciIsImJpbmQiLCJyZXRyeVRpbWUiLCJEYXRlIiwiZ2V0VGltZSIsImRlcGVuZCIsInRvU29ja2pzVXJsIiwidHJhbnNsYXRlVXJsIiwibmV3U2NoZW1lQmFzZSIsInN1YlBhdGgiLCJzdGFydHNXaXRoIiwiYWJzb2x1dGVVcmwiLCJzdWJzdHIiLCJkZHBVcmxNYXRjaCIsImh0dHBVcmxNYXRjaCIsIm5ld1NjaGVtZSIsInVybEFmdGVyRERQIiwic2xhc2hQb3MiLCJob3N0IiwicmVzdCIsIk1hdGgiLCJmbG9vciIsInJhbmRvbSIsInVybEFmdGVySHR0cCIsIl9yZWxhdGl2ZVRvU2l0ZVJvb3RVcmwiLCJlbmRzV2l0aCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxNQUFJQSx5QkFBSjtBQUE4QkMsU0FBTyxDQUFDQyxJQUFSLENBQWEsd0JBQWIsRUFBc0M7QUFBQ0YsNkJBQXlCLENBQUNHLENBQUQsRUFBRztBQUFDSCwrQkFBeUIsR0FBQ0csQ0FBMUI7QUFBNEI7O0FBQTFELEdBQXRDLEVBQWtHLENBQWxHO0FBSTlCSCwyQkFBeUIsQ0FBQztBQUN4QkksVUFBTSxFQUFFLEVBRGdCO0FBRXhCQyxRQUFJLEVBQUUsRUFGa0I7QUFHeEJDLFdBQU8sRUFBRSxFQUhlO0FBSXhCQyxNQUFFLEVBQUUsRUFKb0I7QUFLeEJDLGdCQUFZLEVBQUUsQ0FBQyxDQUFELEVBQUksQ0FBSixDQUxVO0FBTXhCQyxhQUFTLEVBQUUsQ0FOYTtBQU94QkMsVUFBTSxFQUFFLENBUGdCO0FBUXhCQyxZQUFRLEVBQUUsQ0FBQyxDQUFELEVBQUksRUFBSjtBQVJjLEdBQUQsRUFTdEJDLE1BQU0sQ0FBQ0MsRUFUZSxDQUF6Qjs7Ozs7Ozs7Ozs7OztBQ0pBWixTQUFPLENBQUNhLE1BQVIsQ0FBZTtBQUFDQyxnQkFBWSxFQUFDLE1BQUlBO0FBQWxCLEdBQWY7QUFBZ0QsTUFBSUMsTUFBSjtBQUFXZixTQUFPLENBQUNDLElBQVIsQ0FBYSxlQUFiLEVBQTZCO0FBQUNjLFVBQU0sQ0FBQ2IsQ0FBRCxFQUFHO0FBQUNhLFlBQU0sR0FBQ2IsQ0FBUDtBQUFTOztBQUFwQixHQUE3QixFQUFtRCxDQUFuRDtBQUFzRCxNQUFJYyxjQUFKO0FBQW1CaEIsU0FBTyxDQUFD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cyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7XG4gIHNldE1pbmltdW1Ccm93c2VyVmVyc2lvbnMsXG59IGZyb20gXCJtZXRlb3IvbW9kZXJuLWJyb3dzZXJzXCI7XG5cbnNldE1pbmltdW1Ccm93c2VyVmVyc2lvbnMoe1xuICBjaHJvbWU6IDE2LFxuICBlZGdlOiAxMixcbiAgZmlyZWZveDogMTEsXG4gIGllOiAxMCxcbiAgbW9iaWxlU2FmYXJpOiBbNiwgMV0sXG4gIHBoYW50b21qczogMixcbiAgc2FmYXJpOiA3LFxuICBlbGVjdHJvbjogWzAsIDIwXSxcbn0sIG1vZHVsZS5pZCk7XG4iLCJpbXBvcnQgeyBNZXRlb3IgfSBmcm9tIFwibWV0ZW9yL21ldGVvclwiO1xuaW1wb3J0IHsgdG9XZWJzb2NrZXRVcmwgfSBmcm9tIFwiLi91cmxzLmpzXCI7XG5pbXBvcnQgeyBTdHJlYW1DbGllbnRDb21tb24gfSBmcm9tIFwiLi9jb21tb24uanNcIjtcblxuLy8gQHBhcmFtIGVuZHBvaW50IHtTdHJpbmd9IFVSTCB0byBNZXRlb3IgYXBwXG4vLyAgIFwiaHR0cDovL3N1YmRvbWFpbi5tZXRlb3IuY29tL1wiIG9yIFwiL1wiIG9yXG4vLyAgIFwiZGRwK3NvY2tqczovL2Zvby0qKi5tZXRlb3IuY29tL3NvY2tqc1wiXG4vL1xuLy8gV2UgZG8gc29tZSByZXdyaXRpbmcgb2YgdGhlIFVSTCB0byBldmVudHVhbGx5IG1ha2UgaXQgXCJ3czovL1wiIG9yIFwid3NzOi8vXCIsXG4vLyB3aGF0ZXZlciB3YXMgcGFzc2VkIGluLiAgQXQgdGhlIHZlcnkgbGVhc3QsIHdoYXQgTWV0ZW9yLmFic29sdXRlVXJsKCkgcmV0dXJuc1xuLy8gdXMgc2hvdWxkIHdvcmsuXG4vL1xuLy8gV2UgZG9uJ3QgZG8gYW55IGhlYXJ0YmVhdGluZy4gKFRoZSBsb2dpYyB0aGF0IGRpZCB0aGlzIGluIHNvY2tqcyB3YXMgcmVtb3ZlZCxcbi8vIGJlY2F1c2UgaXQgdXNlZCBhIGJ1aWx0LWluIHNvY2tqcyBtZWNoYW5pc20uIFdlIGNvdWxkIGRvIGl0IHdpdGggV2ViU29ja2V0XG4vLyBwaW5nIGZyYW1lcyBvciB3aXRoIEREUC1sZXZlbCBtZXNzYWdlcy4pXG5leHBvcnQgY2xhc3MgQ2xpZW50U3RyZWFtIGV4dGVuZHMgU3RyZWFtQ2xpZW50Q29tbW9uIHtcbiAgY29uc3RydWN0b3IoZW5kcG9pbnQsIG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcblxuICAgIHRoaXMuY2xpZW50ID0gbnVsbDsgLy8gY3JlYXRlZCBpbiBfbGF1bmNoQ29ubmVjdGlvblxuICAgIHRoaXMuZW5kcG9pbnQgPSBlbmRwb2ludDtcblxuICAgIHRoaXMuaGVhZGVycyA9IHRoaXMub3B0aW9ucy5oZWFkZXJzIHx8IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gICAgdGhpcy5ucG1GYXllT3B0aW9ucyA9IHRoaXMub3B0aW9ucy5ucG1GYXllT3B0aW9ucyB8fCBPYmplY3QuY3JlYXRlKG51bGwpO1xuXG4gICAgdGhpcy5faW5pdENvbW1vbih0aGlzLm9wdGlvbnMpO1xuXG4gICAgLy8vLyBLaWNrb2ZmIVxuICAgIHRoaXMuX2xhdW5jaENvbm5lY3Rpb24oKTtcbiAgfVxuXG4gIC8vIGRhdGEgaXMgYSB1dGY4IHN0cmluZy4gRGF0YSBzZW50IHdoaWxlIG5vdCBjb25uZWN0ZWQgaXMgZHJvcHBlZCBvblxuICAvLyB0aGUgZmxvb3IsIGFuZCBpdCBpcyB1cCB0aGUgdXNlciBvZiB0aGlzIEFQSSB0byByZXRyYW5zbWl0IGxvc3RcbiAgLy8gbWVzc2FnZXMgb24gJ3Jlc2V0J1xuICBzZW5kKGRhdGEpIHtcbiAgICBpZiAodGhpcy5jdXJyZW50U3RhdHVzLmNvbm5lY3RlZCkge1xuICAgICAgdGhpcy5jbGllbnQuc2VuZChkYXRhKTtcbiAgICB9XG4gIH1cblxuICAvLyBDaGFuZ2VzIHdoZXJlIHRoaXMgY29ubmVjdGlvbiBwb2ludHNcbiAgX2NoYW5nZVVybCh1cmwpIHtcbiAgICB0aGlzLmVuZHBvaW50ID0gdXJsO1xuICB9XG5cbiAgX29uQ29ubmVjdChjbGllbnQpIHtcbiAgICBpZiAoY2xpZW50ICE9PSB0aGlzLmNsaWVudCkge1xuICAgICAgLy8gVGhpcyBjb25uZWN0aW9uIGlzIG5vdCBmcm9tIHRoZSBsYXN0IGNhbGwgdG8gX2xhdW5jaENvbm5lY3Rpb24uXG4gICAgICAvLyBCdXQgX2xhdW5jaENvbm5lY3Rpb24gY2FsbHMgX2NsZWFudXAgd2hpY2ggY2xvc2VzIHByZXZpb3VzIGNvbm5lY3Rpb25zLlxuICAgICAgLy8gSXQncyBvdXIgYmVsaWVmIHRoYXQgdGhpcyBzdGlmbGVzIGZ1dHVyZSAnb3BlbicgZXZlbnRzLCBidXQgbWF5YmVcbiAgICAgIC8vIHdlIGFyZSB3cm9uZz9cbiAgICAgIHRocm93IG5ldyBFcnJvcignR290IG9wZW4gZnJvbSBpbmFjdGl2ZSBjbGllbnQgJyArICEhdGhpcy5jbGllbnQpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9mb3JjZWRUb0Rpc2Nvbm5lY3QpIHtcbiAgICAgIC8vIFdlIHdlcmUgYXNrZWQgdG8gZGlzY29ubmVjdCBiZXR3ZWVuIHRyeWluZyB0byBvcGVuIHRoZSBjb25uZWN0aW9uIGFuZFxuICAgICAgLy8gYWN0dWFsbHkgb3BlbmluZyBpdC4gTGV0J3MganVzdCBwcmV0ZW5kIHRoaXMgbmV2ZXIgaGFwcGVuZWQuXG4gICAgICB0aGlzLmNsaWVudC5jbG9zZSgpO1xuICAgICAgdGhpcy5jbGllbnQgPSBudWxsO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmICh0aGlzLmN1cnJlbnRTdGF0dXMuY29ubmVjdGVkKSB7XG4gICAgICAvLyBXZSBhbHJlYWR5IGhhdmUgYSBjb25uZWN0aW9uLiBJdCBtdXN0IGhhdmUgYmVlbiB0aGUgY2FzZSB0aGF0IHdlXG4gICAgICAvLyBzdGFydGVkIHR3byBwYXJhbGxlbCBjb25uZWN0aW9uIGF0dGVtcHRzIChiZWNhdXNlIHdlIHdhbnRlZCB0b1xuICAgICAgLy8gJ3JlY29ubmVjdCBub3cnIG9uIGEgaGFuZ2luZyBjb25uZWN0aW9uIGFuZCB3ZSBoYWQgbm8gd2F5IHRvIGNhbmNlbCB0aGVcbiAgICAgIC8vIGNvbm5lY3Rpb24gYXR0ZW1wdC4pIEJ1dCB0aGlzIHNob3VsZG4ndCBoYXBwZW4gKHNpbWlsYXJseSB0byB0aGUgY2xpZW50XG4gICAgICAvLyAhPT0gdGhpcy5jbGllbnQgY2hlY2sgYWJvdmUpLlxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdUd28gcGFyYWxsZWwgY29ubmVjdGlvbnM/Jyk7XG4gICAgfVxuXG4gICAgdGhpcy5fY2xlYXJDb25uZWN0aW9uVGltZXIoKTtcblxuICAgIC8vIHVwZGF0ZSBzdGF0dXNcbiAgICB0aGlzLmN1cnJlbnRTdGF0dXMuc3RhdHVzID0gJ2Nvbm5lY3RlZCc7XG4gICAgdGhpcy5jdXJyZW50U3RhdHVzLmNvbm5lY3RlZCA9IHRydWU7XG4gICAgdGhpcy5jdXJyZW50U3RhdHVzLnJldHJ5Q291bnQgPSAwO1xuICAgIHRoaXMuc3RhdHVzQ2hhbmdlZCgpO1xuXG4gICAgLy8gZmlyZSByZXNldHMuIFRoaXMgbXVzdCBjb21lIGFmdGVyIHN0YXR1cyBjaGFuZ2Ugc28gdGhhdCBjbGllbnRzXG4gICAgLy8gY2FuIGNhbGwgc2VuZCBmcm9tIHdpdGhpbiBhIHJlc2V0IGNhbGxiYWNrLlxuICAgIHRoaXMuZm9yRWFjaENhbGxiYWNrKCdyZXNldCcsIGNhbGxiYWNrID0+IHtcbiAgICAgIGNhbGxiYWNrKCk7XG4gICAgfSk7XG4gIH1cblxuICBfY2xlYW51cChtYXliZUVycm9yKSB7XG4gICAgdGhpcy5fY2xlYXJDb25uZWN0aW9uVGltZXIoKTtcbiAgICBpZiAodGhpcy5jbGllbnQpIHtcbiAgICAgIHZhciBjbGllbnQgPSB0aGlzLmNsaWVudDtcbiAgICAgIHRoaXMuY2xpZW50ID0gbnVsbDtcbiAgICAgIGNsaWVudC5jbG9zZSgpO1xuXG4gICAgICB0aGlzLmZvckVhY2hDYWxsYmFjaygnZGlzY29ubmVjdCcsIGNhbGxiYWNrID0+IHtcbiAgICAgICAgY2FsbGJhY2sobWF5YmVFcnJvcik7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICBfY2xlYXJDb25uZWN0aW9uVGltZXIoKSB7XG4gICAgaWYgKHRoaXMuY29ubmVjdGlvblRpbWVyKSB7XG4gICAgICBjbGVhclRpbWVvdXQodGhpcy5jb25uZWN0aW9uVGltZXIpO1xuICAgICAgdGhpcy5jb25uZWN0aW9uVGltZXIgPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIF9nZXRQcm94eVVybCh0YXJnZXRVcmwpIHtcbiAgICAvLyBTaW1pbGFyIHRvIGNvZGUgaW4gdG9vbHMvaHR0cC1oZWxwZXJzLmpzLlxuICAgIHZhciBwcm94eSA9IHByb2Nlc3MuZW52LkhUVFBfUFJPWFkgfHwgcHJvY2Vzcy5lbnYuaHR0cF9wcm94eSB8fCBudWxsO1xuICAgIHZhciBub3Byb3h5ID0gcHJvY2Vzcy5lbnYuTk9fUFJPWFkgfHwgcHJvY2Vzcy5lbnYubm9fcHJveHkgfHwgbnVsbDtcbiAgICAvLyBpZiB3ZSdyZSBnb2luZyB0byBhIHNlY3VyZSB1cmwsIHRyeSB0aGUgaHR0cHNfcHJveHkgZW52IHZhcmlhYmxlIGZpcnN0LlxuICAgIGlmICh0YXJnZXRVcmwubWF0Y2goL153c3M6LynCoHx8IHRhcmdldFVybC5tYXRjaCgvXmh0dHBzOi8pKSB7XG4gICAgICBwcm94eSA9IHByb2Nlc3MuZW52LkhUVFBTX1BST1hZIHx8IHByb2Nlc3MuZW52Lmh0dHBzX3Byb3h5IHx8IHByb3h5O1xuICAgIH1cbiAgICBpZiAodGFyZ2V0VXJsLmluZGV4T2YoJ2xvY2FsaG9zdCcpICE9IC0xIHx8wqB0YXJnZXRVcmwuaW5kZXhPZignMTI3LjAuMC4xJykgIT0gLTEpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBpZiAobm9wcm94eSkge1xuICAgICAgZm9yIChsZXQgaXRlbSBvZiBub3Byb3h5LnNwbGl0KCcsJykpIHtcbiAgICAgICAgaWYgKHRhcmdldFVybC5pbmRleE9mKGl0ZW0udHJpbSgpLnJlcGxhY2UoL1xcKi8sICcnKSkgIT09IC0xKSB7XG4gICAgICAgICAgcHJveHkgPSBudWxsO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBwcm94eTtcbiAgfVxuXG4gIF9sYXVuY2hDb25uZWN0aW9uKCkge1xuICAgIHRoaXMuX2NsZWFudXAoKTsgLy8gY2xlYW51cCB0aGUgb2xkIHNvY2tldCwgaWYgdGhlcmUgd2FzIG9uZS5cblxuICAgIC8vIFNpbmNlIHNlcnZlci10by1zZXJ2ZXIgRERQIGlzIHN0aWxsIGFuIGV4cGVyaW1lbnRhbCBmZWF0dXJlLCB3ZSBvbmx5XG4gICAgLy8gcmVxdWlyZSB0aGUgbW9kdWxlIGlmIHdlIGFjdHVhbGx5IGNyZWF0ZSBhIHNlcnZlci10by1zZXJ2ZXJcbiAgICAvLyBjb25uZWN0aW9uLlxuICAgIHZhciBGYXllV2ViU29ja2V0ID0gTnBtLnJlcXVpcmUoJ2ZheWUtd2Vic29ja2V0Jyk7XG4gICAgdmFyIGRlZmxhdGUgPSBOcG0ucmVxdWlyZSgncGVybWVzc2FnZS1kZWZsYXRlJyk7XG5cbiAgICB2YXIgdGFyZ2V0VXJsID0gdG9XZWJzb2NrZXRVcmwodGhpcy5lbmRwb2ludCk7XG4gICAgdmFyIGZheWVPcHRpb25zID0ge1xuICAgICAgaGVhZGVyczogdGhpcy5oZWFkZXJzLFxuICAgICAgZXh0ZW5zaW9uczogW2RlZmxhdGVdXG4gICAgfTtcbiAgICBmYXllT3B0aW9ucyA9IE9iamVjdC5hc3NpZ24oZmF5ZU9wdGlvbnMsIHRoaXMubnBtRmF5ZU9wdGlvbnMpO1xuICAgIHZhciBwcm94eVVybCA9IHRoaXMuX2dldFByb3h5VXJsKHRhcmdldFVybCk7XG4gICAgaWYgKHByb3h5VXJsKSB7XG4gICAgICBmYXllT3B0aW9ucy5wcm94eSA9IHsgb3JpZ2luOiBwcm94eVVybCB9O1xuICAgIH1cblxuICAgIC8vIFdlIHdvdWxkIGxpa2UgdG8gc3BlY2lmeSAnZGRwJyBhcyB0aGUgc3VicHJvdG9jb2wgaGVyZS4gVGhlIG5wbSBtb2R1bGUgd2VcbiAgICAvLyB1c2VkIHRvIHVzZSBhcyBhIGNsaWVudCB3b3VsZCBmYWlsIHRoZSBoYW5kc2hha2UgaWYgd2UgYXNrIGZvciBhXG4gICAgLy8gc3VicHJvdG9jb2wgYW5kIHRoZSBzZXJ2ZXIgZG9lc24ndCBzZW5kIG9uZSBiYWNrIChhbmQgc29ja2pzIGRvZXNuJ3QpLlxuICAgIC8vIEZheWUgZG9lc24ndCBoYXZlIHRoYXQgYmVoYXZpb3I7IGl0J3MgdW5jbGVhciBmcm9tIHJlYWRpbmcgUkZDIDY0NTUgaWZcbiAgICAvLyBGYXllIGlzIGVycm9uZW91cyBvciBub3QuICBTbyBmb3Igbm93LCB3ZSBkb24ndCBzcGVjaWZ5IHByb3RvY29scy5cbiAgICB2YXIgc3VicHJvdG9jb2xzID0gW107XG5cbiAgICB2YXIgY2xpZW50ID0gKHRoaXMuY2xpZW50ID0gbmV3IEZheWVXZWJTb2NrZXQuQ2xpZW50KFxuICAgICAgdGFyZ2V0VXJsLFxuICAgICAgc3VicHJvdG9jb2xzLFxuICAgICAgZmF5ZU9wdGlvbnNcbiAgICApKTtcblxuICAgIHRoaXMuX2NsZWFyQ29ubmVjdGlvblRpbWVyKCk7XG4gICAgdGhpcy5jb25uZWN0aW9uVGltZXIgPSBNZXRlb3Iuc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICB0aGlzLl9sb3N0Q29ubmVjdGlvbihuZXcgdGhpcy5Db25uZWN0aW9uRXJyb3IoJ0REUCBjb25uZWN0aW9uIHRpbWVkIG91dCcpKTtcbiAgICB9LCB0aGlzLkNPTk5FQ1RfVElNRU9VVCk7XG5cbiAgICB0aGlzLmNsaWVudC5vbihcbiAgICAgICdvcGVuJyxcbiAgICAgIE1ldGVvci5iaW5kRW52aXJvbm1lbnQoKCkgPT4ge1xuICAgICAgICByZXR1cm4gdGhpcy5fb25Db25uZWN0KGNsaWVudCk7XG4gICAgICB9LCAnc3RyZWFtIGNvbm5lY3QgY2FsbGJhY2snKVxuICAgICk7XG5cbiAgICB2YXIgY2xpZW50T25JZkN1cnJlbnQgPSAoZXZlbnQsIGRlc2NyaXB0aW9uLCBjYWxsYmFjaykgPT4ge1xuICAgICAgdGhpcy5jbGllbnQub24oXG4gICAgICAgIGV2ZW50LFxuICAgICAgICBNZXRlb3IuYmluZEVudmlyb25tZW50KCguLi5hcmdzKSA9PiB7XG4gICAgICAgICAgLy8gSWdub3JlIGV2ZW50cyBmcm9tIGFueSBjb25uZWN0aW9uIHdlJ3ZlIGFscmVhZHkgY2xlYW5lZCB1cC5cbiAgICAgICAgICBpZiAoY2xpZW50ICE9PSB0aGlzLmNsaWVudCkgcmV0dXJuO1xuICAgICAgICAgIGNhbGxiYWNrKC4uLmFyZ3MpO1xuICAgICAgICB9LCBkZXNjcmlwdGlvbilcbiAgICAgICk7XG4gICAgfTtcblxuICAgIGNsaWVudE9uSWZDdXJyZW50KCdlcnJvcicsICdzdHJlYW0gZXJyb3IgY2FsbGJhY2snLCBlcnJvciA9PiB7XG4gICAgICBpZiAoIXRoaXMub3B0aW9ucy5fZG9udFByaW50RXJyb3JzKVxuICAgICAgICBNZXRlb3IuX2RlYnVnKCdzdHJlYW0gZXJyb3InLCBlcnJvci5tZXNzYWdlKTtcblxuICAgICAgLy8gRmF5ZSdzICdlcnJvcicgb2JqZWN0IGlzIG5vdCBhIEpTIGVycm9yIChhbmQgYW1vbmcgb3RoZXIgdGhpbmdzLFxuICAgICAgLy8gZG9lc24ndCBzdHJpbmdpZnkgd2VsbCkuIENvbnZlcnQgaXQgdG8gb25lLlxuICAgICAgdGhpcy5fbG9zdENvbm5lY3Rpb24obmV3IHRoaXMuQ29ubmVjdGlvbkVycm9yKGVycm9yLm1lc3NhZ2UpKTtcbiAgICB9KTtcblxuICAgIGNsaWVudE9uSWZDdXJyZW50KCdjbG9zZScsICdzdHJlYW0gY2xvc2UgY2FsbGJhY2snLCAoKSA9PiB7XG4gICAgICB0aGlzLl9sb3N0Q29ubmVjdGlvbigpO1xuICAgIH0pO1xuXG4gICAgY2xpZW50T25JZkN1cnJlbnQoJ21lc3NhZ2UnLCAnc3RyZWFtIG1lc3NhZ2UgY2FsbGJhY2snLCBtZXNzYWdlID0+IHtcbiAgICAgIC8vIElnbm9yZSBiaW5hcnkgZnJhbWVzLCB3aGVyZSBtZXNzYWdlLmRhdGEgaXMgYSBCdWZmZXJcbiAgICAgIGlmICh0eXBlb2YgbWVzc2FnZS5kYXRhICE9PSAnc3RyaW5nJykgcmV0dXJuO1xuXG4gICAgICB0aGlzLmZvckVhY2hDYWxsYmFjaygnbWVzc2FnZScsIGNhbGxiYWNrID0+IHtcbiAgICAgICAgY2FsbGJhY2sobWVzc2FnZS5kYXRhKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG59XG4iLCJpbXBvcnQgeyBSZXRyeSB9IGZyb20gJ21ldGVvci9yZXRyeSc7XG5cbmNvbnN0IGZvcmNlZFJlY29ubmVjdEVycm9yID0gbmV3IEVycm9yKFwiZm9yY2VkIHJlY29ubmVjdFwiKTtcblxuZXhwb3J0IGNsYXNzIFN0cmVhbUNsaWVudENvbW1vbiB7XG4gIGNvbnN0cnVjdG9yKG9wdGlvbnMpIHtcbiAgICB0aGlzLm9wdGlvbnMgPSB7XG4gICAgICByZXRyeTogdHJ1ZSxcbiAgICAgIC4uLihvcHRpb25zIHx8IG51bGwpLFxuICAgIH07XG5cbiAgICB0aGlzLkNvbm5lY3Rpb25FcnJvciA9XG4gICAgICBvcHRpb25zICYmIG9wdGlvbnMuQ29ubmVjdGlvbkVycm9yIHx8IEVycm9yO1xuICB9XG5cbiAgLy8gUmVnaXN0ZXIgZm9yIGNhbGxiYWNrcy5cbiAgb24obmFtZSwgY2FsbGJhY2spIHtcbiAgICBpZiAobmFtZSAhPT0gJ21lc3NhZ2UnICYmIG5hbWUgIT09ICdyZXNldCcgJiYgbmFtZSAhPT0gJ2Rpc2Nvbm5lY3QnKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bmtub3duIGV2ZW50IHR5cGU6ICcgKyBuYW1lKTtcblxuICAgIGlmICghdGhpcy5ldmVudENhbGxiYWNrc1tuYW1lXSkgdGhpcy5ldmVudENhbGxiYWNrc1tuYW1lXSA9IFtdO1xuICAgIHRoaXMuZXZlbnRDYWxsYmFja3NbbmFtZV0ucHVzaChjYWxsYmFjayk7XG4gIH1cblxuICBmb3JFYWNoQ2FsbGJhY2sobmFtZSwgY2IpIHtcbiAgICBpZiAoIXRoaXMuZXZlbnRDYWxsYmFja3NbbmFtZV0gfHwgIXRoaXMuZXZlbnRDYWxsYmFja3NbbmFtZV0ubGVuZ3RoKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5ldmVudENhbGxiYWNrc1tuYW1lXS5mb3JFYWNoKGNiKTtcbiAgfVxuXG4gIF9pbml0Q29tbW9uKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zID0gb3B0aW9ucyB8fCBPYmplY3QuY3JlYXRlKG51bGwpO1xuXG4gICAgLy8vLyBDb25zdGFudHNcblxuICAgIC8vIGhvdyBsb25nIHRvIHdhaXQgdW50aWwgd2UgZGVjbGFyZSB0aGUgY29ubmVjdGlvbiBhdHRlbXB0XG4gICAgLy8gZmFpbGVkLlxuICAgIHRoaXMuQ09OTkVDVF9USU1FT1VUID0gb3B0aW9ucy5jb25uZWN0VGltZW91dE1zIHx8IDEwMDAwO1xuXG4gICAgdGhpcy5ldmVudENhbGxiYWNrcyA9IE9iamVjdC5jcmVhdGUobnVsbCk7IC8vIG5hbWUgLT4gW2NhbGxiYWNrXVxuXG4gICAgdGhpcy5fZm9yY2VkVG9EaXNjb25uZWN0ID0gZmFsc2U7XG5cbiAgICAvLy8vIFJlYWN0aXZlIHN0YXR1c1xuICAgIHRoaXMuY3VycmVudFN0YXR1cyA9IHtcbiAgICAgIHN0YXR1czogJ2Nvbm5lY3RpbmcnLFxuICAgICAgY29ubmVjdGVkOiBmYWxzZSxcbiAgICAgIHJldHJ5Q291bnQ6IDBcbiAgICB9O1xuXG4gICAgaWYgKFBhY2thZ2UudHJhY2tlcikge1xuICAgICAgdGhpcy5zdGF0dXNMaXN0ZW5lcnMgPSBuZXcgUGFja2FnZS50cmFja2VyLlRyYWNrZXIuRGVwZW5kZW5jeSgpO1xuICAgIH1cblxuICAgIHRoaXMuc3RhdHVzQ2hhbmdlZCA9ICgpID0+IHtcbiAgICAgIGlmICh0aGlzLnN0YXR1c0xpc3RlbmVycykge1xuICAgICAgICB0aGlzLnN0YXR1c0xpc3RlbmVycy5jaGFuZ2VkKCk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIC8vLy8gUmV0cnkgbG9naWNcbiAgICB0aGlzLl9yZXRyeSA9IG5ldyBSZXRyeSgpO1xuICAgIHRoaXMuY29ubmVjdGlvblRpbWVyID0gbnVsbDtcbiAgfVxuXG4gIC8vIFRyaWdnZXIgYSByZWNvbm5lY3QuXG4gIHJlY29ubmVjdChvcHRpb25zKSB7XG4gICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwgT2JqZWN0LmNyZWF0ZShudWxsKTtcblxuICAgIGlmIChvcHRpb25zLnVybCkge1xuICAgICAgdGhpcy5fY2hhbmdlVXJsKG9wdGlvbnMudXJsKTtcbiAgICB9XG5cbiAgICBpZiAob3B0aW9ucy5fc29ja2pzT3B0aW9ucykge1xuICAgICAgdGhpcy5vcHRpb25zLl9zb2NranNPcHRpb25zID0gb3B0aW9ucy5fc29ja2pzT3B0aW9ucztcbiAgICB9XG5cbiAgICBpZiAodGhpcy5jdXJyZW50U3RhdHVzLmNvbm5lY3RlZCkge1xuICAgICAgaWYgKG9wdGlvbnMuX2ZvcmNlIHx8IG9wdGlvbnMudXJsKSB7XG4gICAgICAgIHRoaXMuX2xvc3RDb25uZWN0aW9uKGZvcmNlZFJlY29ubmVjdEVycm9yKTtcbiAgICAgIH1cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBpZiB3ZSdyZSBtaWQtY29ubmVjdGlvbiwgc3RvcCBpdC5cbiAgICBpZiAodGhpcy5jdXJyZW50U3RhdHVzLnN0YXR1cyA9PT0gJ2Nvbm5lY3RpbmcnKSB7XG4gICAgICAvLyBQcmV0ZW5kIGl0J3MgYSBjbGVhbiBjbG9zZS5cbiAgICAgIHRoaXMuX2xvc3RDb25uZWN0aW9uKCk7XG4gICAgfVxuXG4gICAgdGhpcy5fcmV0cnkuY2xlYXIoKTtcbiAgICB0aGlzLmN1cnJlbnRTdGF0dXMucmV0cnlDb3VudCAtPSAxOyAvLyBkb24ndCBjb3VudCBtYW51YWwgcmV0cmllc1xuICAgIHRoaXMuX3JldHJ5Tm93KCk7XG4gIH1cblxuICBkaXNjb25uZWN0KG9wdGlvbnMpIHtcbiAgICBvcHRpb25zID0gb3B0aW9ucyB8fCBPYmplY3QuY3JlYXRlKG51bGwpO1xuXG4gICAgLy8gRmFpbGVkIGlzIHBlcm1hbmVudC4gSWYgd2UncmUgZmFpbGVkLCBkb24ndCBsZXQgcGVvcGxlIGdvIGJhY2tcbiAgICAvLyBvbmxpbmUgYnkgY2FsbGluZyAnZGlzY29ubmVjdCcgdGhlbiAncmVjb25uZWN0Jy5cbiAgICBpZiAodGhpcy5fZm9yY2VkVG9EaXNjb25uZWN0KSByZXR1cm47XG5cbiAgICAvLyBJZiBfcGVybWFuZW50IGlzIHNldCwgcGVybWFuZW50bHkgZGlzY29ubmVjdCBhIHN0cmVhbS4gT25jZSBhIHN0cmVhbVxuICAgIC8vIGlzIGZvcmNlZCB0byBkaXNjb25uZWN0LCBpdCBjYW4gbmV2ZXIgcmVjb25uZWN0LiBUaGlzIGlzIGZvclxuICAgIC8vIGVycm9yIGNhc2VzIHN1Y2ggYXMgZGRwIHZlcnNpb24gbWlzbWF0Y2gsIHdoZXJlIHRyeWluZyBhZ2FpblxuICAgIC8vIHdvbid0IGZpeCB0aGUgcHJvYmxlbS5cbiAgICBpZiAob3B0aW9ucy5fcGVybWFuZW50KSB7XG4gICAgICB0aGlzLl9mb3JjZWRUb0Rpc2Nvbm5lY3QgPSB0cnVlO1xuICAgIH1cblxuICAgIHRoaXMuX2NsZWFudXAoKTtcbiAgICB0aGlzLl9yZXRyeS5jbGVhcigpO1xuXG4gICAgdGhpcy5jdXJyZW50U3RhdHVzID0ge1xuICAgICAgc3RhdHVzOiBvcHRpb25zLl9wZXJtYW5lbnQgPyAnZmFpbGVkJyA6ICdvZmZsaW5lJyxcbiAgICAgIGNvbm5lY3RlZDogZmFsc2UsXG4gICAgICByZXRyeUNvdW50OiAwXG4gICAgfTtcblxuICAgIGlmIChvcHRpb25zLl9wZXJtYW5lbnQgJiYgb3B0aW9ucy5fZXJyb3IpXG4gICAgICB0aGlzLmN1cnJlbnRTdGF0dXMucmVhc29uID0gb3B0aW9ucy5fZXJyb3I7XG5cbiAgICB0aGlzLnN0YXR1c0NoYW5nZWQoKTtcbiAgfVxuXG4gIC8vIG1heWJlRXJyb3IgaXMgc2V0IHVubGVzcyBpdCdzIGEgY2xlYW4gcHJvdG9jb2wtbGV2ZWwgY2xvc2UuXG4gIF9sb3N0Q29ubmVjdGlvbihtYXliZUVycm9yKSB7XG4gICAgdGhpcy5fY2xlYW51cChtYXliZUVycm9yKTtcbiAgICB0aGlzLl9yZXRyeUxhdGVyKG1heWJlRXJyb3IpOyAvLyBzZXRzIHN0YXR1cy4gbm8gbmVlZCB0byBkbyBpdCBoZXJlLlxuICB9XG5cbiAgLy8gZmlyZWQgd2hlbiB3ZSBkZXRlY3QgdGhhdCB3ZSd2ZSBnb25lIG9ubGluZS4gdHJ5IHRvIHJlY29ubmVjdFxuICAvLyBpbW1lZGlhdGVseS5cbiAgX29ubGluZSgpIHtcbiAgICAvLyBpZiB3ZSd2ZSByZXF1ZXN0ZWQgdG8gYmUgb2ZmbGluZSBieSBkaXNjb25uZWN0aW5nLCBkb24ndCByZWNvbm5lY3QuXG4gICAgaWYgKHRoaXMuY3VycmVudFN0YXR1cy5zdGF0dXMgIT0gJ29mZmxpbmUnKSB0aGlzLnJlY29ubmVjdCgpO1xuICB9XG5cbiAgX3JldHJ5TGF0ZXIobWF5YmVFcnJvcikge1xuICAgIHZhciB0aW1lb3V0ID0gMDtcbiAgICBpZiAodGhpcy5vcHRpb25zLnJldHJ5IHx8XG4gICAgICAgIG1heWJlRXJyb3IgPT09IGZvcmNlZFJlY29ubmVjdEVycm9yKSB7XG4gICAgICB0aW1lb3V0ID0gdGhpcy5fcmV0cnkucmV0cnlMYXRlcihcbiAgICAgICAgdGhpcy5jdXJyZW50U3RhdHVzLnJldHJ5Q291bnQsXG4gICAgICAgIHRoaXMuX3JldHJ5Tm93LmJpbmQodGhpcylcbiAgICAgICk7XG4gICAgICB0aGlzLmN1cnJlbnRTdGF0dXMuc3RhdHVzID0gJ3dhaXRpbmcnO1xuICAgICAgdGhpcy5jdXJyZW50U3RhdHVzLnJldHJ5VGltZSA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpICsgdGltZW91dDtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5jdXJyZW50U3RhdHVzLnN0YXR1cyA9ICdmYWlsZWQnO1xuICAgICAgZGVsZXRlIHRoaXMuY3VycmVudFN0YXR1cy5yZXRyeVRpbWU7XG4gICAgfVxuXG4gICAgdGhpcy5jdXJyZW50U3RhdHVzLmNvbm5lY3RlZCA9IGZhbHNlO1xuICAgIHRoaXMuc3RhdHVzQ2hhbmdlZCgpO1xuICB9XG5cbiAgX3JldHJ5Tm93KCkge1xuICAgIGlmICh0aGlzLl9mb3JjZWRUb0Rpc2Nvbm5lY3QpIHJldHVybjtcblxuICAgIHRoaXMuY3VycmVudFN0YXR1cy5yZXRyeUNvdW50ICs9IDE7XG4gICAgdGhpcy5jdXJyZW50U3RhdHVzLnN0YXR1cyA9ICdjb25uZWN0aW5nJztcbiAgICB0aGlzLmN1cnJlbnRTdGF0dXMuY29ubmVjdGVkID0gZmFsc2U7XG4gICAgZGVsZXRlIHRoaXMuY3VycmVudFN0YXR1cy5yZXRyeVRpbWU7XG4gICAgdGhpcy5zdGF0dXNDaGFuZ2VkKCk7XG5cbiAgICB0aGlzLl9sYXVuY2hDb25uZWN0aW9uKCk7XG4gIH1cblxuICAvLyBHZXQgY3VycmVudCBzdGF0dXMuIFJlYWN0aXZlLlxuICBzdGF0dXMoKSB7XG4gICAgaWYgKHRoaXMuc3RhdHVzTGlzdGVuZXJzKSB7XG4gICAgICB0aGlzLnN0YXR1c0xpc3RlbmVycy5kZXBlbmQoKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuY3VycmVudFN0YXR1cztcbiAgfVxufVxuIiwiLy8gQHBhcmFtIHVybCB7U3RyaW5nfSBVUkwgdG8gTWV0ZW9yIGFwcCwgZWc6XG4vLyAgIFwiL1wiIG9yIFwibWFkZXdpdGgubWV0ZW9yLmNvbVwiIG9yIFwiaHR0cHM6Ly9mb28ubWV0ZW9yLmNvbVwiXG4vLyAgIG9yIFwiZGRwK3NvY2tqczovL2RkcC0tKioqKi1mb28ubWV0ZW9yLmNvbS9zb2NranNcIlxuLy8gQHJldHVybnMge1N0cmluZ30gVVJMIHRvIHRoZSBlbmRwb2ludCB3aXRoIHRoZSBzcGVjaWZpYyBzY2hlbWUgYW5kIHN1YlBhdGgsIGUuZy5cbi8vIGZvciBzY2hlbWUgXCJodHRwXCIgYW5kIHN1YlBhdGggXCJzb2NranNcIlxuLy8gICBcImh0dHA6Ly9zdWJkb21haW4ubWV0ZW9yLmNvbS9zb2NranNcIiBvciBcIi9zb2NranNcIlxuLy8gICBvciBcImh0dHBzOi8vZGRwLS0xMjM0LWZvby5tZXRlb3IuY29tL3NvY2tqc1wiXG5mdW5jdGlvbiB0cmFuc2xhdGVVcmwodXJsLCBuZXdTY2hlbWVCYXNlLCBzdWJQYXRoKSB7XG4gIGlmICghbmV3U2NoZW1lQmFzZSkge1xuICAgIG5ld1NjaGVtZUJhc2UgPSAnaHR0cCc7XG4gIH1cblxuICBpZiAoc3ViUGF0aCAhPT0gXCJzb2NranNcIiAmJiB1cmwuc3RhcnRzV2l0aChcIi9cIikpIHtcbiAgICB1cmwgPSBNZXRlb3IuYWJzb2x1dGVVcmwodXJsLnN1YnN0cigxKSk7XG4gIH1cblxuICB2YXIgZGRwVXJsTWF0Y2ggPSB1cmwubWF0Y2goL15kZHAoaT8pXFwrc29ja2pzOlxcL1xcLy8pO1xuICB2YXIgaHR0cFVybE1hdGNoID0gdXJsLm1hdGNoKC9eaHR0cChzPyk6XFwvXFwvLyk7XG4gIHZhciBuZXdTY2hlbWU7XG4gIGlmIChkZHBVcmxNYXRjaCkge1xuICAgIC8vIFJlbW92ZSBzY2hlbWUgYW5kIHNwbGl0IG9mZiB0aGUgaG9zdC5cbiAgICB2YXIgdXJsQWZ0ZXJERFAgPSB1cmwuc3Vic3RyKGRkcFVybE1hdGNoWzBdLmxlbmd0aCk7XG4gICAgbmV3U2NoZW1lID0gZGRwVXJsTWF0Y2hbMV0gPT09ICdpJyA/IG5ld1NjaGVtZUJhc2UgOiBuZXdTY2hlbWVCYXNlICsgJ3MnO1xuICAgIHZhciBzbGFzaFBvcyA9IHVybEFmdGVyRERQLmluZGV4T2YoJy8nKTtcbiAgICB2YXIgaG9zdCA9IHNsYXNoUG9zID09PSAtMSA/IHVybEFmdGVyRERQIDogdXJsQWZ0ZXJERFAuc3Vic3RyKDAsIHNsYXNoUG9zKTtcbiAgICB2YXIgcmVzdCA9IHNsYXNoUG9zID09PSAtMSA/ICcnIDogdXJsQWZ0ZXJERFAuc3Vic3RyKHNsYXNoUG9zKTtcblxuICAgIC8vIEluIHRoZSBob3N0IChPTkxZISksIGNoYW5nZSAnKicgY2hhcmFjdGVycyBpbnRvIHJhbmRvbSBkaWdpdHMuIFRoaXNcbiAgICAvLyBhbGxvd3MgZGlmZmVyZW50IHN0cmVhbSBjb25uZWN0aW9ucyB0byBjb25uZWN0IHRvIGRpZmZlcmVudCBob3N0bmFtZXNcbiAgICAvLyBhbmQgYXZvaWQgYnJvd3NlciBwZXItaG9zdG5hbWUgY29ubmVjdGlvbiBsaW1pdHMuXG4gICAgaG9zdCA9IGhvc3QucmVwbGFjZSgvXFwqL2csICgpID0+IE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIDEwKSk7XG5cbiAgICByZXR1cm4gbmV3U2NoZW1lICsgJzovLycgKyBob3N0ICsgcmVzdDtcbiAgfSBlbHNlIGlmIChodHRwVXJsTWF0Y2gpIHtcbiAgICBuZXdTY2hlbWUgPSAhaHR0cFVybE1hdGNoWzFdID8gbmV3U2NoZW1lQmFzZSA6IG5ld1NjaGVtZUJhc2UgKyAncyc7XG4gICAgdmFyIHVybEFmdGVySHR0cCA9IHVybC5zdWJzdHIoaHR0cFVybE1hdGNoWzBdLmxlbmd0aCk7XG4gICAgdXJsID0gbmV3U2NoZW1lICsgJzovLycgKyB1cmxBZnRlckh0dHA7XG4gIH1cblxuICAvLyBQcmVmaXggRlFETnMgYnV0IG5vdCByZWxhdGl2ZSBVUkxzXG4gIGlmICh1cmwuaW5kZXhPZignOi8vJykgPT09IC0xICYmICF1cmwuc3RhcnRzV2l0aCgnLycpKSB7XG4gICAgdXJsID0gbmV3U2NoZW1lQmFzZSArICc6Ly8nICsgdXJsO1xuICB9XG5cbiAgLy8gWFhYIFRoaXMgaXMgbm90IHdoYXQgd2Ugc2hvdWxkIGJlIGRvaW5nOiBpZiBJIGhhdmUgYSBzaXRlXG4gIC8vIGRlcGxveWVkIGF0IFwiL2Zvb1wiLCB0aGVuIEREUC5jb25uZWN0KFwiL1wiKSBzaG91bGQgYWN0dWFsbHkgY29ubmVjdFxuICAvLyB0byBcIi9cIiwgbm90IHRvIFwiL2Zvb1wiLiBcIi9cIiBpcyBhbiBhYnNvbHV0ZSBwYXRoLiAoQ29udHJhc3Q6IGlmXG4gIC8vIGRlcGxveWVkIGF0IFwiL2Zvb1wiLCBpdCB3b3VsZCBiZSByZWFzb25hYmxlIGZvciBERFAuY29ubmVjdChcImJhclwiKVxuICAvLyB0byBjb25uZWN0IHRvIFwiL2Zvby9iYXJcIikuXG4gIC8vXG4gIC8vIFdlIHNob3VsZCBtYWtlIHRoaXMgcHJvcGVybHkgaG9ub3IgYWJzb2x1dGUgcGF0aHMgcmF0aGVyIHRoYW5cbiAgLy8gZm9yY2luZyB0aGUgcGF0aCB0byBiZSByZWxhdGl2ZSB0byB0aGUgc2l0ZSByb290LiBTaW11bHRhbmVvdXNseSxcbiAgLy8gd2Ugc2hvdWxkIHNldCBERFBfREVGQVVMVF9DT05ORUNUSU9OX1VSTCB0byBpbmNsdWRlIHRoZSBzaXRlXG4gIC8vIHJvb3QuIFNlZSBhbHNvIGNsaWVudF9jb252ZW5pZW5jZS5qcyAjUmF0aW9uYWxpemluZ1JlbGF0aXZlRERQVVJMc1xuICB1cmwgPSBNZXRlb3IuX3JlbGF0aXZlVG9TaXRlUm9vdFVybCh1cmwpO1xuXG4gIGlmICh1cmwuZW5kc1dpdGgoJy8nKSkgcmV0dXJuIHVybCArIHN1YlBhdGg7XG4gIGVsc2UgcmV0dXJuIHVybCArICcvJyArIHN1YlBhdGg7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0b1NvY2tqc1VybCh1cmwpIHtcbiAgcmV0dXJuIHRyYW5zbGF0ZVVybCh1cmwsICdodHRwJywgJ3NvY2tqcycpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdG9XZWJzb2NrZXRVcmwodXJsKSB7XG4gIHJldHVybiB0cmFuc2xhdGVVcmwodXJsLCAnd3MnLCAnd2Vic29ja2V0Jyk7XG59XG4iXX0=
