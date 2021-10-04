(function(){

///////////////////////////////////////////////////////////////////////////////////
//                                                                               //
// packages/promise/modern.js                                                    //
//                                                                               //
///////////////////////////////////////////////////////////////////////////////////
                                                                                 //
// Initialize the package-scoped Promise variable with global.Promise in
// all environments, even if it's not defined.
Promise = global.Promise;

///////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

///////////////////////////////////////////////////////////////////////////////////
//                                                                               //
// packages/promise/server.js                                                    //
//                                                                               //
///////////////////////////////////////////////////////////////////////////////////
                                                                                 //
require("./extensions.js");

require("meteor-promise").makeCompatible(
  Promise,
  // Allow every Promise callback to run in a Fiber drawn from a pool of
  // reusable Fibers.
  require("fibers")
);

// Reference: https://caniuse.com/#feat=promises
require("meteor/modern-browsers").setMinimumBrowserVersions({
  chrome: 32,
  edge: 12,
  // Since there is no IE12, this effectively excludes Internet Explorer
  // (pre-Edge) from the modern classification. #9818 #9839
  ie: 12,
  firefox: 29,
  mobileSafari: 8,
  opera: 20,
  safari: [7, 1],
  // https://github.com/Kilian/electron-to-chromium/blob/master/full-versions.js
  electron: [0, 20],
}, module.id);

///////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

///////////////////////////////////////////////////////////////////////////////////
//                                                                               //
// packages/promise/client.js                                                    //
//                                                                               //
///////////////////////////////////////////////////////////////////////////////////
                                                                                 //
require("./extensions.js");
require("meteor-promise").makeCompatible(Promise);

///////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

///////////////////////////////////////////////////////////////////////////////////
//                                                                               //
// packages/promise/extensions.js                                                //
//                                                                               //
///////////////////////////////////////////////////////////////////////////////////
                                                                                 //
var proto = Promise.prototype;
var hasOwn = Object.prototype.hasOwnProperty;

proto.done = function (onFulfilled, onRejected) {
  var self = this;

  if (arguments.length > 0) {
    self = this.then.apply(this, arguments);
  }

  self.then(null, function (err) {
    Meteor._setImmediate(function () {
      throw err;
    });
  });
};

if (! hasOwn.call(proto, "finally")) {
  proto["finally"] = function (onFinally) {
    var threw = false, result;
    return this.then(function (value) {
      result = value;
      // Most implementations of Promise.prototype.finally call
      // Promise.resolve(onFinally()) (or this.constructor.resolve or even
      // this.constructor[Symbol.species].resolve, depending on how spec
      // compliant they're trying to be), but this implementation simply
      // relies on the standard Promise behavior of resolving any value
      // returned from a .then callback function.
      return onFinally();
    }, function (error) {
      // Make the final .then callback (below) re-throw the error instead
      // of returning it.
      threw = true;
      result = error;
      return onFinally();
    }).then(function () {
      if (threw) throw result;
      return result;
    });
  };
}

///////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

///////////////////////////////////////////////////////////////////////////////////
//                                                                               //
// packages/promise/legacy.js                                                    //
//                                                                               //
///////////////////////////////////////////////////////////////////////////////////
                                                                                 //
// In legacy environments, load a polyfill if global.Promise was not
// defined in modern.js.
if (typeof global.Promise === "function") {
  Promise = global.Promise;
} else {
  Promise = global.Promise =
    require("promise/lib/es6-extensions");
}

///////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

///////////////////////////////////////////////////////////////////////////////////
//                                                                               //
// packages/promise/promise-tests.js                                             //
//                                                                               //
///////////////////////////////////////////////////////////////////////////////////
                                                                                 //
Tinytest.addAsync("meteor-promise - sanity", function (test, done) {
  var expectedError = new Error("expected");
  Promise.resolve("working").then(function (result) {
    test.equal(result, "working");
    throw expectedError;
  }).catch(function (error) {
    test.equal(error, expectedError);
    if (Meteor.isServer) {
      var Fiber = require("fibers");
      // Make sure the Promise polyfill runs callbacks in a Fiber.
      test.instanceOf(Fiber.current, Fiber);
    }
  }).then(done, function (error) {
    test.exception(error);
  });
});

Tinytest.addAsync("meteor-promise - finally", function (test, done) {
  var finallyCalledAfterResolved = false;
  Promise.resolve("working").then(function (result) {
    test.equal(result, "working");
  }).finally(function () {
    finallyCalledAfterResolved = true;
  }).then(function () {
    test.isTrue(finallyCalledAfterResolved);
    done();
  });

  var finallyCalledAfterRejected = false;
  Promise.reject("failed").catch(function (result) {
    test.equal(result, "failed");
  }).finally(function () {
    finallyCalledAfterRejected = true;
  }).then(function () {
    test.isTrue(finallyCalledAfterRejected);
    done();
  });
});

///////////////////////////////////////////////////////////////////////////////////

}).call(this);
