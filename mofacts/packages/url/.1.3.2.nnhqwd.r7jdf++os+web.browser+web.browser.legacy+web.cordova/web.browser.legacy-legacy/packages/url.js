(function(){

///////////////////////////////////////////////////////////////////////////////////
//                                                                               //
// packages/url/modern.js                                                        //
//                                                                               //
///////////////////////////////////////////////////////////////////////////////////
                                                                                 //
URL = global.URL;
URLSearchParams = global.URLSearchParams;

exports.URL = URL;
exports.URLSearchParams = URLSearchParams;

// backwards compatibility
Object.assign(URL, require('./bc/url_client'));

///////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

///////////////////////////////////////////////////////////////////////////////////
//                                                                               //
// packages/url/legacy.js                                                        //
//                                                                               //
///////////////////////////////////////////////////////////////////////////////////
                                                                                 //
try {
  require("core-js/proposals/url");
} catch (e) {
  throw new Error([
    "The core-js npm package could not be found in your node_modules ",
    "directory. Please run the following command to install it:",
    "",
    "  meteor npm install --save core-js",
    ""
  ].join("\n"));
}

// backwards compatibility
require('./modern.js');

///////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

///////////////////////////////////////////////////////////////////////////////////
//                                                                               //
// packages/url/server.js                                                        //
//                                                                               //
///////////////////////////////////////////////////////////////////////////////////
                                                                                 //
const { URL, URLSearchParams } = require('url');

exports.URL = URL;
exports.URLSearchParams = URLSearchParams;

const { setMinimumBrowserVersions } = require("meteor/modern-browsers");

// https://caniuse.com/#feat=url
setMinimumBrowserVersions({
   // Since there is no IE12, this effectively excludes Internet Explorer
  // (pre-Edge) from the modern classification. #9818 #9839
  ie: 12,
  chrome: 32,
  edge: 12,
  firefox: 26,
  mobile_safari: 8,
  opera: 36,
  safari: [7, 1],
  phantomjs: Infinity,
  // https://github.com/Kilian/electron-to-chromium/blob/master/full-versions.js
  electron: [0, 20],
}, module.id);

// backwards compatibility
Object.assign(exports.URL, require('./bc/url_server'));

///////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

///////////////////////////////////////////////////////////////////////////////////
//                                                                               //
// packages/url/bc/url_client.js                                                 //
//                                                                               //
///////////////////////////////////////////////////////////////////////////////////
                                                                                 //
var common = require("./url_common.js");

exports._constructUrl = function (url, query, params) {
  var query_match = /^(.*?)(\?.*)?$/.exec(url);
  return common.buildUrl(
    query_match[1],
    query_match[2],
    query,
    params
  );
};

exports._encodeParams = common._encodeParams;
///////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

///////////////////////////////////////////////////////////////////////////////////
//                                                                               //
// packages/url/bc/url_common.js                                                 //
//                                                                               //
///////////////////////////////////////////////////////////////////////////////////
                                                                                 //
function encodeString(str) {
  return encodeURIComponent(str).replace(/\*/g, '%2A');
}

// Encode URL parameters into a query string, handling nested objects and
// arrays properly.
var _encodeParams = function (params, prefix) {
  var str = [];
  var isParamsArray = Array.isArray(params);
  for (var p in params) {
    if (Object.prototype.hasOwnProperty.call(params, p)) {
      var k = prefix ? prefix + '[' + (isParamsArray ? '' : p) + ']' : p;
      var v = params[p];
      if (typeof v === 'object') {
        str.push(_encodeParams(v, k));
      } else {
        var encodedKey =
          encodeString(k).replace('%5B', '[').replace('%5D', ']');
        str.push(encodedKey + '=' + encodeString(v));
      }
    }
  }
  return str.join('&').replace(/%20/g, '+');
};

exports._encodeParams = _encodeParams;

exports.buildUrl = function(before_qmark, from_qmark, opt_query, opt_params) {
  var url_without_query = before_qmark;
  var query = from_qmark ? from_qmark.slice(1) : null;

  if (typeof opt_query === "string")
    query = String(opt_query);

  if (opt_params) {
    query = query || "";
    var prms = _encodeParams(opt_params);
    if (query && prms)
      query += '&';
    query += prms;
  }

  var url = url_without_query;
  if (query !== null)
    url += ("?"+query);

  return url;
};

///////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

///////////////////////////////////////////////////////////////////////////////////
//                                                                               //
// packages/url/bc/url_server.js                                                 //
//                                                                               //
///////////////////////////////////////////////////////////////////////////////////
                                                                                 //
var url_util = require('url');
var common = require("./url_common.js");

exports._constructUrl = function (url, query, params) {
  var url_parts = url_util.parse(url);
  return common.buildUrl(
    url_parts.protocol + "//" + url_parts.host + url_parts.pathname,
    url_parts.search,
    query,
    params
  );
};

exports._encodeParams = common._encodeParams;
///////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

///////////////////////////////////////////////////////////////////////////////////
//                                                                               //
// packages/url/bc/url_tests.js                                                  //
//                                                                               //
///////////////////////////////////////////////////////////////////////////////////
                                                                                 //
import { Tinytest } from "meteor/tinytest";

Tinytest.add('url - serializes params to query correctly', function (test) {
  var hash = {
    filter: {
      type: 'Foo',
      id_eq: 15,
    },
    array: ['1', 'a', 'dirty[]'],
    hasOwnProperty: 'horrible param name',
  };
  var query =
    'filter[type]=Foo&filter[id_eq]=15&array[]=1&array[]=a'
    + '&array[]=dirty%5B%5D&hasOwnProperty=horrible+param+name';
  test.equal(URL._encodeParams(hash), query);
});

///////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

///////////////////////////////////////////////////////////////////////////////////
//                                                                               //
// packages/url/tests/main.js                                                    //
//                                                                               //
///////////////////////////////////////////////////////////////////////////////////
                                                                                 //
import { Tinytest } from "meteor/tinytest";

Tinytest.add("url - sanity", function (test) {
  test.equal(typeof URL, "function");
  test.equal(typeof URLSearchParams, "function");
});

// backwards compatibility
require('../bc/url_tests');

///////////////////////////////////////////////////////////////////////////////////

}).call(this);
