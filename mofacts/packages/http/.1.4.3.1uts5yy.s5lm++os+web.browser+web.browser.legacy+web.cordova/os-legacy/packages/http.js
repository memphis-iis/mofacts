(function(){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/http/httpcall_server.js                                                                                   //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
var path = require('path');
var request = require('request');
var url_util = require('url');
var URL = require("meteor/url").URL;
var common = require("./httpcall_common.js");
var HTTP = exports.HTTP = common.HTTP;
var hasOwn = Object.prototype.hasOwnProperty;

exports.HTTPInternals = {
  NpmModules: {
    request: {
      version: Npm.require('request/package.json').version,
      module: request
    }
  }
};

// _call always runs asynchronously; HTTP.call, defined below,
// wraps _call and runs synchronously when no callback is provided.
function _call(method, url, options, callback) {
  ////////// Process arguments //////////

  if (! callback && typeof options === "function") {
    // support (method, url, callback) argument list
    callback = options;
    options = null;
  }

  options = options || {};

  if (hasOwn.call(options, 'beforeSend')) {
    throw new Error("Option beforeSend not supported on server.");
  }

  method = (method || "").toUpperCase();

  if (! /^https?:\/\//.test(url))
    throw new Error("url must be absolute and start with http:// or https://");

  var headers = {};

  var content = options.content;
  if (options.data) {
    content = JSON.stringify(options.data);
    headers['Content-Type'] = 'application/json';
  }


  var paramsForUrl, paramsForBody;
  if (content || method === "GET" || method === "HEAD")
    paramsForUrl = options.params;
  else
    paramsForBody = options.params;

  var newUrl = URL._constructUrl(url, options.query, paramsForUrl);

  if (options.auth) {
    if (options.auth.indexOf(':') < 0)
      throw new Error('auth option should be of the form "username:password"');
    headers['Authorization'] = "Basic "+
      Buffer.from(options.auth, "ascii").toString("base64");
  }

  if (paramsForBody) {
    content = URL._encodeParams(paramsForBody);
    headers['Content-Type'] = "application/x-www-form-urlencoded";
  }

  if (options.headers) {
    Object.keys(options.headers).forEach(function (key) {
      headers[key] = options.headers[key];
    });
  }

  // wrap callback to add a 'response' property on an error, in case
  // we have both (http 4xx/5xx error, which has a response payload)
  callback = (function(callback) {
    var called = false;
    return function(error, response) {
      if (! called) {
        called = true;
        if (error && response) {
          error.response = response;
        }
        callback(error, response);
      }
    };
  })(callback);

  ////////// Kickoff! //////////

  // Allow users to override any request option with the npmRequestOptions
  // option.
  var reqOptions = Object.assign({
    url: newUrl,
    method: method,
    encoding: "utf8",
    jar: false,
    timeout: options.timeout,
    body: content,
    followRedirect: options.followRedirects,
    // Follow redirects on non-GET requests
    // also. (https://github.com/meteor/meteor/issues/2808)
    followAllRedirects: options.followRedirects,
    headers: headers
  }, options.npmRequestOptions || null);

  request(reqOptions, function(error, res, body) {
    var response = null;

    if (! error) {
      response = {};
      response.statusCode = res.statusCode;
      response.content = body;
      response.headers = res.headers;

      common.populateData(response);

      if (response.statusCode >= 400) {
        error = common.makeErrorByStatus(
          response.statusCode,
          response.content
        );
      }
    }

    callback(error, response);
  });
}

HTTP.call = Meteor.wrapAsync(_call);

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/http/httpcall_client.js                                                                                   //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
var URL = require("meteor/url").URL;
var common = require("./httpcall_common.js");
var HTTP = exports.HTTP = common.HTTP;
var hasOwn = Object.prototype.hasOwnProperty;

/**
 * @summary Perform an outbound HTTP request.
 * @locus Anywhere
 * @deprecated
 * @param {String} method The [HTTP method](http://en.wikipedia.org/wiki/HTTP_method) to use, such as "`GET`", "`POST`", or "`HEAD`".
 * @param {String} url The URL to retrieve.
 * @param {Object} [options]
 * @param {String} options.content String to use as the HTTP request body.
 * @param {Object} options.data JSON-able object to stringify and use as the HTTP request body. Overwrites `content`.
 * @param {String} options.query Query string to go in the URL. Overwrites any query string in `url`.
 * @param {Object} options.params Dictionary of request parameters to be encoded and placed in the URL (for GETs) or request body (for POSTs).  If `content` or `data` is specified, `params` will always be placed in the URL.
 * @param {String} options.auth HTTP basic authentication string of the form `"username:password"`
 * @param {Object} options.headers Dictionary of strings, headers to add to the HTTP request.
 * @param {Number} options.timeout Maximum time in milliseconds to wait for the request before failing.  There is no timeout by default.
 * @param {Boolean} options.followRedirects If `true`, transparently follow HTTP redirects. Cannot be set to `false` on the client. Default `true`.
 * @param {Object} options.npmRequestOptions On the server, `HTTP.call` is implemented by using the [npm `request` module](https://www.npmjs.com/package/request). Any options in this object will be passed directly to the `request` invocation.
 * @param {Function} options.beforeSend On the client, this will be called before the request is sent to allow for more direct manipulation of the underlying XMLHttpRequest object, which will be passed as the first argument. If the callback returns `false`, the request will be not be sent.
 * @param {Function} [asyncCallback] Optional callback.  If passed, the method runs asynchronously, instead of synchronously, and calls asyncCallback.  On the client, this callback is required.
 */
HTTP.call = function(method, url, options, callback) {

  ////////// Process arguments //////////

  if (! callback && typeof options === "function") {
    // support (method, url, callback) argument list
    callback = options;
    options = null;
  }

  options = options || {};

  if (typeof callback !== "function")
    throw new Error(
      "Can't make a blocking HTTP call from the client; callback required.");

  method = (method || "").toUpperCase();

  var headers = {};

  var content = options.content;
  if (options.data) {
    content = JSON.stringify(options.data);
    headers['Content-Type'] = 'application/json';
  }

  var params_for_url, params_for_body;
  if (content || method === "GET" || method === "HEAD")
    params_for_url = options.params;
  else
    params_for_body = options.params;

  url = URL._constructUrl(url, options.query, params_for_url);

  if (options.followRedirects === false)
    throw new Error("Option followRedirects:false not supported on client.");

  if (hasOwn.call(options, 'npmRequestOptions')) {
    throw new Error("Option npmRequestOptions not supported on client.");
  }

  var username, password;
  if (options.auth) {
    var colonLoc = options.auth.indexOf(':');
    if (colonLoc < 0)
      throw new Error('Option auth should be of the form "username:password"');
    username = options.auth.substring(0, colonLoc);
    password = options.auth.substring(colonLoc+1);
  }

  if (params_for_body) {
    content = URL._encodeParams(params_for_body);
  }

  if (options.headers) {
    Object.keys(options.headers).forEach(function (key) {
      headers[key] = options.headers[key];
    });
  }

  ////////// Callback wrapping //////////

  // wrap callback to add a 'response' property on an error, in case
  // we have both (http 4xx/5xx error, which has a response payload)
  callback = (function(callback) {
    var called = false;
    return function(error, response) {
      if (! called) {
        called = true;
        if (error && response) {
          error.response = response;
        }
        callback(error, response);
      }
    };
  })(callback);

  ////////// Kickoff! //////////

  // from this point on, errors are because of something remote, not
  // something we should check in advance. Turn exceptions into error
  // results.
  try {
    // setup XHR object
    var xhr;
    if (typeof XMLHttpRequest !== "undefined")
      xhr = new XMLHttpRequest();
    else if (typeof ActiveXObject !== "undefined")
      xhr = new ActiveXObject("Microsoft.XMLHttp"); // IE6
    else
      throw new Error("Can't create XMLHttpRequest"); // ???

    xhr.open(method, url, true, username, password);

    for (var k in headers)
      xhr.setRequestHeader(k, headers[k]);


    // setup timeout
    var timed_out = false;
    var timer;
    if (options.timeout) {
      timer = Meteor.setTimeout(function() {
        timed_out = true;
        xhr.abort();
      }, options.timeout);
    };

    // callback on complete
    xhr.onreadystatechange = function(evt) {
      if (xhr.readyState === 4) { // COMPLETE
        if (timer)
          Meteor.clearTimeout(timer);

        if (timed_out) {
          callback(new Error("Connection timeout"));
        } else if (! xhr.status) {
          // no HTTP response
          callback(new Error("Connection lost"));
        } else {

          var response = {};
          response.statusCode = xhr.status;
          response.content = xhr.responseText;

          response.headers = {};
          var header_str = xhr.getAllResponseHeaders();

          // https://github.com/meteor/meteor/issues/553
          //
          // In Firefox there is a weird issue, sometimes
          // getAllResponseHeaders returns the empty string, but
          // getResponseHeader returns correct results. Possibly this
          // issue:
          // https://bugzilla.mozilla.org/show_bug.cgi?id=608735
          //
          // If this happens we can't get a full list of headers, but
          // at least get content-type so our JSON decoding happens
          // correctly. In theory, we could try and rescue more header
          // values with a list of common headers, but content-type is
          // the only vital one for now.
          if ("" === header_str && xhr.getResponseHeader("content-type"))
            header_str =
            "content-type: " + xhr.getResponseHeader("content-type");

          var headers_raw = header_str.split(/\r?\n/);
          headers_raw.forEach(function (h) {
            var m = /^(.*?):(?:\s+)(.*)$/.exec(h);
            if (m && m.length === 3) {
              response.headers[m[1].toLowerCase()] = m[2];
            }
          });

          common.populateData(response);

          var error = null;
          if (response.statusCode >= 400) {
            error = common.makeErrorByStatus(
              response.statusCode,
              response.content
            );
          }

          callback(error, response);
        }
      }
    };

    // Allow custom control over XHR and abort early.
    if (typeof options.beforeSend === "function") {
      // Call the callback and check to see if the request was aborted
      if (false === options.beforeSend.call(null, xhr, options)) {
        return xhr.abort();
      }
    }

    // send it on its way
    xhr.send(content);

  } catch (err) {
    callback(err);
  }
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/http/httpcall_common.js                                                                                   //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
var MAX_LENGTH = 500; // if you change this, also change the appropriate test
var slice = Array.prototype.slice;

var deprecationMessage = function() {
  Log.debug('The http package has been deprecated, please migrate to the fetch package and new web standards.');
};

exports.makeErrorByStatus = function(statusCode, content) {
  var message = "failed [" + statusCode + "]";

  if (content) {
    var stringContent = typeof content == "string" ?
      content : content.toString();

    message += ' ' + truncate(stringContent.replace(/\n/g, ' '), MAX_LENGTH);
  }

  return new Error(message);
};

function truncate(str, length) {
  return str.length > length ? str.slice(0, length) + '...' : str;
}

// Fill in `response.data` if the content-type is JSON.
exports.populateData = function(response) {
  // Read Content-Type header, up to a ';' if there is one.
  // A typical header might be "application/json; charset=utf-8"
  // or just "application/json".
  var contentType = (response.headers['content-type'] || ';').split(';')[0];

  // Only try to parse data as JSON if server sets correct content type.
  if (['application/json',
       'text/javascript',
       'application/javascript',
       'application/x-javascript',
      ].indexOf(contentType) >= 0) {
    try {
      response.data = JSON.parse(response.content);
    } catch (err) {
      response.data = null;
    }
  } else {
    response.data = null;
  }
};

var HTTP = exports.HTTP = {};

/**
 * @summary Send an HTTP `GET` request. Equivalent to calling [`HTTP.call`](#http_call) with "GET" as the first argument.
 * @param {String} url The URL to which the request should be sent.
 * @param {Object} [callOptions] Options passed on to [`HTTP.call`](#http_call).
 * @param {Function} [asyncCallback] Callback that is called when the request is completed. Required on the client.
 * @locus Anywhere
 * @deprecated
 */
HTTP.get = function (/* varargs */) {
  deprecationMessage();
  return HTTP.call.apply(this, ["GET"].concat(slice.call(arguments)));
};

/**
 * @summary Send an HTTP `POST` request. Equivalent to calling [`HTTP.call`](#http_call) with "POST" as the first argument.
 * @param {String} url The URL to which the request should be sent.
 * @param {Object} [callOptions] Options passed on to [`HTTP.call`](#http_call).
 * @param {Function} [asyncCallback] Callback that is called when the request is completed. Required on the client.
 * @locus Anywhere
 * @deprecated
 */
HTTP.post = function (/* varargs */) {
  deprecationMessage();
  return HTTP.call.apply(this, ["POST"].concat(slice.call(arguments)));
};

/**
 * @summary Send an HTTP `PUT` request. Equivalent to calling [`HTTP.call`](#http_call) with "PUT" as the first argument.
 * @param {String} url The URL to which the request should be sent.
 * @param {Object} [callOptions] Options passed on to [`HTTP.call`](#http_call).
 * @param {Function} [asyncCallback] Callback that is called when the request is completed. Required on the client.
 * @locus Anywhere
 * @deprecated
 */
HTTP.put = function (/* varargs */) {
  deprecationMessage();
  return HTTP.call.apply(this, ["PUT"].concat(slice.call(arguments)));
};

/**
 * @summary Send an HTTP `DELETE` request. Equivalent to calling [`HTTP.call`](#http_call) with "DELETE" as the first argument. (Named `del` to avoid conflict with the Javascript keyword `delete`)
 * @param {String} url The URL to which the request should be sent.
 * @param {Object} [callOptions] Options passed on to [`HTTP.call`](#http_call).
 * @param {Function} [asyncCallback] Callback that is called when the request is completed. Required on the client.
 * @locus Anywhere
 * @deprecated
 */
HTTP.del = function (/* varargs */) {
  deprecationMessage();
  return HTTP.call.apply(this, ["DELETE"].concat(slice.call(arguments)));
};

/**
 * @summary Send an HTTP `PATCH` request. Equivalent to calling [`HTTP.call`](#http_call) with "PATCH" as the first argument.
 * @param {String} url The URL to which the request should be sent.
 * @param {Object} [callOptions] Options passed on to [`HTTP.call`](#http_call).
 * @param {Function} [asyncCallback] Callback that is called when the request is completed. Required on the client.
 * @locus Anywhere
 * @deprecated
 */
HTTP.patch = function (/* varargs */) {
  deprecationMessage();
  return HTTP.call.apply(this, ["PATCH"].concat(slice.call(arguments)));
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/http/httpcall_tests.js                                                                                    //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
// URL prefix for tests to talk to
var _XHR_URL_PREFIX = "/http_test_responder";

var url_base = function () {
  if (Meteor.isServer) {
    var address = WebApp.httpServer.address();
    return "http://127.0.0.1:" + address.port;
  } else {
    return "";
  }
};

var url_prefix = function () {
  if (Meteor.isServer && _XHR_URL_PREFIX.indexOf("http") !== 0) {
    _XHR_URL_PREFIX = url_base() + _XHR_URL_PREFIX;
  }
  return _XHR_URL_PREFIX;
};


testAsyncMulti("httpcall - basic", [
  function(test, expect) {
    var basic_get = function(url, options, expected_url) {

      var callback = function(error, result) {
        test.isFalse(error);
        if (! error) {
          test.equal(typeof result, "object");
          test.equal(result.statusCode, 200);

          var data = result.data;

          // allow dropping of final ? (which mobile browsers seem to do)
          var allowed = [expected_url];
          if (expected_url.slice(-1) === '?')
            allowed.push(expected_url.slice(0, -1));

          test.include(allowed, expected_url);
          test.equal(data.method, "GET");
        }
      };


      HTTP.call("GET", url_prefix()+url, options, expect(callback));

      if (Meteor.isServer) {
        // test sync version
        try {
          var result = HTTP.call("GET", url_prefix()+url, options);
          callback(undefined, result);
        } catch (e) {
          callback(e, e.response);
        }
      }
    };

    basic_get("/foo", null, "/foo");
    basic_get("/foo?", null, "/foo?");
    basic_get("/foo?a=b", null, "/foo?a=b");
    basic_get("/foo", {params: {fruit: "apple"}},
              "/foo?fruit=apple");
    basic_get("/foo", {params: {fruit: "apple", dog: "Spot the dog"}},
              "/foo?fruit=apple&dog=Spot+the+dog");
    basic_get("/foo?", {params: {fruit: "apple", dog: "Spot the dog"}},
              "/foo?fruit=apple&dog=Spot+the+dog");
    basic_get("/foo?bar", {params: {fruit: "apple", dog: "Spot the dog"}},
              "/foo?bar&fruit=apple&dog=Spot+the+dog");
    basic_get("/foo?bar", {params: {fruit: "apple", dog: "Spot the dog"},
                           query: "baz"},
              "/foo?baz&fruit=apple&dog=Spot+the+dog");
    basic_get("/foo", {params: {fruit: "apple", dog: "Spot the dog"},
                       query: "baz"},
              "/foo?baz&fruit=apple&dog=Spot+the+dog");
    basic_get("/foo?", {params: {fruit: "apple", dog: "Spot the dog"},
                       query: "baz"},
              "/foo?baz&fruit=apple&dog=Spot+the+dog");
    basic_get("/foo?bar", {query: ""}, "/foo?");
    basic_get("/foo?bar", {params: {fruit: "apple", dog: "Spot the dog"},
                           query: ""},
              "/foo?fruit=apple&dog=Spot+the+dog");
  }]);

testAsyncMulti("httpcall - errors", [
  function(test, expect) {

    // Accessing unknown server (should fail to make any connection)
    var unknownServerCallback = function(error, result) {
      test.isTrue(error);
      test.isFalse(result);
      test.isFalse(error.response);
    };

    const invalidIp = "0.0.0.199";
    // This is an invalid destination IP address, and thus should always give an error.
    // If your ISP is intercepting DNS misses and serving ads, an obviously
    // invalid URL (http://asdf.asdf) might produce an HTTP response.
    HTTP.call("GET", `http://${invalidIp}/`, expect(unknownServerCallback));

    if (Meteor.isServer) {
      // test sync version
      try {
        var unknownServerResult = HTTP.call("GET", `http://${invalidIp}/`);
        unknownServerCallback(undefined, unknownServerResult);
      } catch (e) {
        unknownServerCallback(e, e.response);
      }
    }

    // Server serves 500
    var error500Callback = function(error, result) {
      test.isTrue(error);
      test.isTrue(error.message.indexOf("500") !== -1); // message has statusCode
      test.isTrue(error.message.indexOf(
        error.response.content.substring(0, 10)) !== -1); // message has part of content

      test.isTrue(result);
      test.isTrue(error.response);
      test.equal(result, error.response);
      test.equal(error.response.statusCode, 500);

      // in test_responder.js we make a very long response body, to make sure
      // that we truncate messages. first of all, make sure we didn't make that
      // message too short, so that we can be sure we're verifying that we truncate.
      test.isTrue(error.response.content.length > 520);
      test.isTrue(error.message.length < 520); // make sure we truncate.
    };
    HTTP.call("GET", url_prefix()+"/fail", expect(error500Callback));

    if (Meteor.isServer) {
      // test sync version
      try {
        var error500Result = HTTP.call("GET", url_prefix()+"/fail");
        error500Callback(undefined, error500Result);
      } catch (e) {
        error500Callback(e, e.response);
      }
    }
  }
]);

testAsyncMulti("httpcall - timeout", [
  function(test, expect) {

    // Should time out
    var timeoutCallback = function(error, result) {
      test.isTrue(error);
      test.isFalse(result);
      test.isFalse(error.response);
    };
    var timeoutUrl = url_prefix()+"/slow-"+Random.id();
    HTTP.call(
      "GET", timeoutUrl,
      { timeout: 500 },
      expect(timeoutCallback));

    if (Meteor.isServer) {
      // test sync version
      try {
        var timeoutResult = HTTP.call("GET", timeoutUrl, { timeout: 500 });
        timeoutCallback(undefined, timeoutResult);
      } catch (e) {
        timeoutCallback(e, e.response);
      }
    }

    // Should not time out
    var noTimeoutCallback = function(error, result) {
      test.isFalse(error);
      test.isTrue(result);
      test.equal(result.statusCode, 200);
      var data = result.data;
      test.equal(data.url.substring(0, 4), "/foo");
      test.equal(data.method, "GET");
    };
    var noTimeoutUrl = url_prefix()+"/foo-"+Random.id();
    HTTP.call(
      "GET", noTimeoutUrl,
      { timeout: 2000 },
      expect(noTimeoutCallback));

    if (Meteor.isServer) {
      // test sync version
      try {
        var noTimeoutResult = HTTP.call("GET", noTimeoutUrl, { timeout: 2000 });
        noTimeoutCallback(undefined, noTimeoutResult);
      } catch (e) {
        noTimeoutCallback(e, e.response);
      }
    }
  }
]);

testAsyncMulti("httpcall - redirect", [

  function(test, expect) {
    // Test that we follow redirects by default
    HTTP.call("GET", url_prefix()+"/redirect", expect(
      function(error, result) {
        test.isFalse(error);
        test.isTrue(result);

        // should be redirected transparently to /foo
        test.equal(result.statusCode, 200);
        var data = result.data;
        test.equal(data.url, "/foo");
        test.equal(data.method, "GET");
      }));

    // followRedirect option; can't be false on client
    _.each([false, true], function(followRedirects) {
      var do_it = function(should_work) {
        var maybe_expect = should_work ? expect : _.identity;
        _.each(["GET", "POST"], function (method) {
          HTTP.call(
            method, url_prefix()+"/redirect",
            {followRedirects: followRedirects},
            maybe_expect(function(error, result) {
              test.isFalse(error);
              test.isTrue(result);

              if (followRedirects) {
                // should be redirected transparently to /foo
                test.equal(result.statusCode, 200);
                var data = result.data;
                test.equal(data.url, "/foo");
                // This is "GET" even when the initial request was a
                // POST because browsers follow redirects with a GET
                // even when the initial request was a different method.
                test.equal(data.method, "GET");
              } else {
                // should see redirect
                test.equal(result.statusCode, 301);
              }
            }));
        });
      };
      if (Meteor.isClient && ! followRedirects) {
        // not supported, should fail
        test.throws(do_it);
      } else {
        do_it(true);
      }
    });
  }

]);

testAsyncMulti("httpcall - methods", [

  function(test, expect) {
    // non-get methods
    var test_method = function(meth, func_name) {
      func_name = func_name || meth.toLowerCase();
      HTTP[func_name](
        url_prefix()+"/foo",
        expect(function(error, result) {
          test.isFalse(error);
          test.isTrue(result);
          test.equal(result.statusCode, 200);
          var data = result.data;
          test.equal(data.url, "/foo");
          test.equal(data.method, meth);
        }));
    };

    test_method("GET");
    test_method("POST");
    test_method("PUT");
    test_method("DELETE", 'del');
    test_method("PATCH");
  },

  function(test, expect) {
    // contents and data
    HTTP.call(
      "POST", url_prefix()+"/foo",
      { content: "Hello World!" },
      expect(function(error, result) {
        test.isFalse(error);
        test.isTrue(result);
        test.equal(result.statusCode, 200);
        var data = result.data;
        test.equal(data.body, "Hello World!");
      }));

    HTTP.call(
      "POST", url_prefix()+"/data-test",
      { data: {greeting: "Hello World!"} },
      expect(function(error, result) {
        test.isFalse(error);
        test.isTrue(result);
        test.equal(result.statusCode, 200);
        var data = result.data;
        test.equal(data.body, {greeting: "Hello World!"});
        // nb: some browsers include a charset here too.
        test.matches(data.headers['content-type'], /^application\/json\b/);
      }));

    HTTP.call(
      "POST", url_prefix()+"/data-test-explicit",
      { data: {greeting: "Hello World!"},
        headers: {'Content-Type': 'text/stupid'} },
      expect(function(error, result) {
        test.isFalse(error);
        test.isTrue(result);
        test.equal(result.statusCode, 200);
        var data = result.data;
        test.equal(data.body, {greeting: "Hello World!"});
        // nb: some browsers include a charset here too.
        test.matches(data.headers['content-type'], /^text\/stupid\b/);
      }));
  }
]);

testAsyncMulti("httpcall - http auth", [
  function(test, expect) {
    // Test basic auth

    // Unfortunately, any failed auth will result in a browser
    // password prompt.  So we don't test auth failure, only
    // success.

    // Random password breaks in Firefox, because Firefox incorrectly
    // uses cached credentials even if we supply different ones:
    // https://bugzilla.mozilla.org/show_bug.cgi?id=654348
    var password = 'rocks';
    //var password = Random.id().replace(/[^0-9a-zA-Z]/g, '');
    HTTP.call(
      "GET", url_prefix()+"/login?"+password,
      { auth: "meteor:"+password },
      expect(function(error, result) {
        // should succeed
        test.isFalse(error);
        test.isTrue(result);
        test.equal(result.statusCode, 200);
        var data = result.data;
        test.equal(data.url, "/login?"+password);
      }));

    // test fail on malformed username:password
    test.throws(function() {
      HTTP.call(
        "GET", url_prefix()+"/login?"+password,
        { auth: "fooooo" },
        function() { throw new Error("can't get here"); });
    });
  }
]);

testAsyncMulti("httpcall - headers", [
  function(test, expect) {
    HTTP.call(
      "GET", url_prefix()+"/foo-with-headers",
      {headers: { "Test-header": "Value",
                  "another": "Value2" } },
      expect(function(error, result) {
        test.isFalse(error);
        test.isTrue(result);

        test.equal(result.statusCode, 200);
        var data = result.data;
        test.equal(data.url, "/foo-with-headers");
        test.equal(data.method, "GET");
        test.equal(data.headers['test-header'], "Value");
        test.equal(data.headers['another'], "Value2");
      }));

    HTTP.call(
      "GET", url_prefix()+"/headers",
      expect(function(error, result) {
        test.isFalse(error);
        test.isTrue(result);

        test.equal(result.statusCode, 201);
        test.equal(result.headers['a-silly-header'], "Tis a");
        test.equal(result.headers['another-silly-header'], "Silly place.");
      }));
  }
]);

testAsyncMulti("httpcall - params", [
  function(test, expect) {
    var do_test = function(method, url, params, opt_opts, expect_url, expect_body) {
      var opts = {};
      if (typeof opt_opts === "string") {
        // opt_opts omitted
        expect_body = expect_url;
        expect_url = opt_opts;
      } else {
        opts = opt_opts;
      }
      HTTP.call(
        method, url_prefix()+url,
        _.extend({ params: params }, opts),
        expect(function(error, result) {
          test.isFalse(error);
          test.isTrue(result);
          test.equal(result.statusCode, 200);
          if (method !== "HEAD") {
            var data = result.data;
            test.equal(data.method, method);
            test.equal(data.url, expect_url);
            test.equal(data.body, expect_body);
          }
      }));
    };

    do_test("GET", "/blah", {foo:"bar"}, "/blah?foo=bar", "");
    do_test("GET", "/", {foo:"bar", fruit:"apple"}, "/?foo=bar&fruit=apple", "");
    do_test("POST", "/", {foo:"bar", fruit:"apple"}, "/", "foo=bar&fruit=apple");
    do_test("POST", "/", {foo:"bar", fruit:"apple"}, "/", "foo=bar&fruit=apple");
    do_test("GET", "/", {'foo?':"bang?"}, {}, "/?foo%3F=bang%3F", "");
    do_test("POST", "/", {'foo?':"bang?"}, {}, "/", "foo%3F=bang%3F");
    do_test("POST", "/", {foo:"bar", fruit:"apple"}, {
      content: "stuff!"}, "/?foo=bar&fruit=apple", "stuff!");
    do_test("POST", "/", {foo:"bar", greeting:"Hello World"}, {
      content: "stuff!"}, "/?foo=bar&greeting=Hello+World", "stuff!");
    do_test("POST", "/foo", {foo:"bar", greeting:"Hello World"},
            "/foo", "foo=bar&greeting=Hello+World");
    do_test("HEAD", "/head", {foo:"bar"}, "/head?foo=bar", "");
    do_test("PUT", "/put", {foo:"bar"}, "/put", "foo=bar");
  }
]);

testAsyncMulti("httpcall - npmRequestOptions", [
  function (test, expect) {
    if (Meteor.isClient) {
      test.throws(function () {
        HTTP.get(url_prefix() + "/",
                 { npmRequestOptions: { encoding: null } },
                 function () {});
      });
      return;
    }

    HTTP.get(
      url_prefix() + "/",
      { npmRequestOptions: { encoding: null } },
      expect(function (error, result) {
        test.isFalse(error);
        test.isTrue(result);
        test.equal(result.statusCode, 200);
        test.instanceOf(result.content, Buffer);
      })
    );
  }
]);

Meteor.isClient && testAsyncMulti("httpcall - beforeSend", [
  function (test, expect) {
    var fired = false;
    var bSend = function(xhr){
      test.isFalse(fired);
      fired = true;
      test.isTrue(xhr instanceof XMLHttpRequest);
    };

    HTTP.get(url_prefix() + "/", {beforeSend: bSend}, expect(function () {
      test.isTrue(fired);
    }));
  }
]);


if (Meteor.isServer) {
  // This is testing the server's static file sending code, not the http
  // package. It's here because it is very similar to the other tests
  // here, even though it is testing something else.
  //
  // client http library mangles paths before they are requested. only
  // run this test on the server.
  testAsyncMulti("httpcall - static file serving", [
    function(test, expect) {
      // Suppress error printing for this test (and for any other code that sets
      // the x-suppress-error header).
      WebApp.suppressConnectErrors();

      function do_test(path, code, match) {
        const prefix = Meteor.isModern
          ? "" // No prefix for web.browser (modern).
          : "/__browser.legacy";

        HTTP.get(url_base() + prefix + path, {
          headers: {
            "x-suppress-error": "true"
          }
        }, expect(function(error, result) {
          test.equal(result.statusCode, code);
          if (match) {
            test.matches(result.content, match);
          }
        }));
      }

      // existing static file
      do_test("/packages/local-test_http/test_static.serveme", 200, /static file serving/);

      // no such file, so return the default app HTML.
      var getsAppHtml = [
        // This file doesn't exist.
        "/nosuchfile",

        // Our static file serving doesn't process .. or its encoded version, so
        // any of these return the app HTML.
        "/../nosuchfile",
        "/%2e%2e/nosuchfile",
        "/%2E%2E/nosuchfile",
        "/%2d%2d/nosuchfile",
        "/packages/http/../http/test_static.serveme",
        "/packages/http/%2e%2e/http/test_static.serveme",
        "/packages/http/%2E%2E/http/test_static.serveme",
        "/packages/http/../../packages/http/test_static.serveme",
        "/packages/http/%2e%2e/%2e%2e/packages/http/test_static.serveme",
        "/packages/http/%2E%2E/%2E%2E/packages/http/test_static.serveme",

        // ... and they *definitely* shouldn't be able to escape the app bundle.
        "/packages/http/../../../../../../packages/http/test_static.serveme",
        "/../../../../../../../../../../../bin/ls",
        "/%2e%2e/%2e%2e/%2e%2e/%2e%2e/%2e%2e/%2e%2e/%2e%2e/%2e%2e/%2e%2e/%2e%2e/%2e%2e/bin/ls",
        "/%2E%2E/%2E%2E/%2E%2E/%2E%2E/%2E%2E/%2E%2E/%2E%2E/%2E%2E/%2E%2E/%2E%2E/%2E%2E/bin/ls"
      ];

      _.each(getsAppHtml, function (x) {
        do_test(x, 200, /__meteor_runtime_config__ = JSON/);
      });
    }
  ]);
}

Meteor.isServer && Tinytest.add("httpcall - npm modules", function (test) {
  // Make sure the version number looks like a version number. (All published
  // request version numbers end in ".0".)
  test.matches(HTTPInternals.NpmModules.request.version, /^2\.(\d+)\.0/);
  test.equal(typeof(HTTPInternals.NpmModules.request.module), 'function');
  test.isTrue(HTTPInternals.NpmModules.request.module.get);
});

// TO TEST/ADD:
// - https
// - cookies?
// - human-readable error reason/cause?
// - data parse error

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/http/test_responder.js                                                                                    //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
var TEST_RESPONDER_ROUTE = "/http_test_responder";

var respond = function(req, res) {

  if (req.url.slice(0,5) === "/slow") {
    setTimeout(function() {
      res.statusCode = 200;
      res.end("A SLOW RESPONSE");
    }, 5000);
    return;
  } else if (req.url === "/fail") {
    res.statusCode = 500;
    res.end("SOME SORT OF SERVER ERROR. foo" +
            _.times(100, function () {
              return "MAKE THIS LONG TO TEST THAT WE TRUNCATE";
            }).join(' '));
    return;
  } else if (req.url === "/redirect") {
    res.statusCode = 301;
    // XXX shouldn't be redirecting to a relative URL, per HTTP spec,
    // but browsers etc. seem to tolerate it.
    res.setHeader("Location", TEST_RESPONDER_ROUTE+"/foo");
    res.end("REDIRECT TO FOO");
    return;
  } else if (req.url.slice(0,6) === "/login") {
    var username = 'meteor';
    // get password from query string
    var password = req.url.slice(7);
    // realm is displayed in dialog box if one pops up, avoid confusion
    var realm = TEST_RESPONDER_ROUTE+"/login";
    var validate = function(user, pass) {
      return user === username && pass === password;
    };
    var connect = WebAppInternals.NpmModules.connect.module;
    var checker = connect.basicAuth(validate, realm);
    var success = false;
    checker(req, res, function() {
      success = true;
    });
    if (! success)
      return;
  } else if (req.url === "/headers") {
    res.statusCode = 201;
    res.setHeader("A-Silly-Header", "Tis a");
    res.setHeader("Another-Silly-Header", "Silly place.");
    res.end("A RESPONSE WITH SOME HEADERS");
    return;
  }

  var chunks = [];
  req.setEncoding("utf8");
  req.on("data", function(chunk) {
    chunks.push(chunk); });
  req.on("end", function() {
    var body = chunks.join('');

    if (body.charAt(0) === '{') {
      body = JSON.parse(body);
    }

    var response_data = {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: body
    };
    var response_string = "";
    if (req.method !== "HEAD")
      response_string = JSON.stringify(response_data);

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(response_string);
  });

};

var run_responder = function() {
  WebApp.connectHandlers.stack.unshift(
    { route: TEST_RESPONDER_ROUTE, handle: respond });
};

run_responder();

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);
