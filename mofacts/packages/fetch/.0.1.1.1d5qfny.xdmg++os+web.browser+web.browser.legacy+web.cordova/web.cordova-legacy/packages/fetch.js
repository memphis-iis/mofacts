(function(){

///////////////////////////////////////////////////////////////////////////////////
//                                                                               //
// packages/fetch/legacy.js                                                      //
//                                                                               //
///////////////////////////////////////////////////////////////////////////////////
                                                                                 //
require("whatwg-fetch");

exports.fetch = global.fetch;
exports.Headers = global.Headers;
exports.Request = global.Request;
exports.Response = global.Response;

///////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

///////////////////////////////////////////////////////////////////////////////////
//                                                                               //
// packages/fetch/modern.js                                                      //
//                                                                               //
///////////////////////////////////////////////////////////////////////////////////
                                                                                 //
exports.fetch = global.fetch;
exports.Headers = global.Headers;
exports.Request = global.Request;
exports.Response = global.Response;

///////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

///////////////////////////////////////////////////////////////////////////////////
//                                                                               //
// packages/fetch/server.js                                                      //
//                                                                               //
///////////////////////////////////////////////////////////////////////////////////
                                                                                 //
const fetch = require("node-fetch");

exports.fetch = fetch;
exports.Headers = fetch.Headers;
exports.Request = fetch.Request;
exports.Response = fetch.Response;

const { setMinimumBrowserVersions } = require("meteor/modern-browsers");

// https://caniuse.com/#feat=fetch
setMinimumBrowserVersions({
  chrome: 42,
  edge: 14,
  firefox: 39,
  mobile_safari: [10, 3],
  opera: 29,
  safari: [10, 1],
  phantomjs: Infinity,
  // https://github.com/Kilian/electron-to-chromium/blob/master/full-versions.js
  electron: [0, 25],
}, module.id);

///////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

///////////////////////////////////////////////////////////////////////////////////
//                                                                               //
// packages/fetch/tests/main.js                                                  //
//                                                                               //
///////////////////////////////////////////////////////////////////////////////////
                                                                                 //
import { Tinytest } from "meteor/tinytest";

Tinytest.add("fetch - sanity", function (test) {
  test.equal(typeof fetch, "function");
});

Tinytest.addAsync("fetch - asset", function (test) {
  return fetch(
    Meteor.absoluteUrl("/packages/local-test_fetch/tests/asset.json")
  ).then(res => {
    if (! res.ok) throw res;
    return res.json();
  }).then(json => {
    test.equal(json.word, "oyez");
    test.equal(json.times, 3);
  });
});

///////////////////////////////////////////////////////////////////////////////////

}).call(this);
