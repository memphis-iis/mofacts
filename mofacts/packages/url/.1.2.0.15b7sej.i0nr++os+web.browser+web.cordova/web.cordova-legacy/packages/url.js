(function(){

/////////////////////////////////////////////////////////////////////////////////
//                                                                             //
// packages/url/url_client.js                                                  //
//                                                                             //
/////////////////////////////////////////////////////////////////////////////////
                                                                               //
var common = require("./url_common.js");
var URL = exports.URL = common.URL;

URL._constructUrl = function (url, query, params) {
  var query_match = /^(.*?)(\?.*)?$/.exec(url);
  return common.buildUrl(
    query_match[1],
    query_match[2],
    query,
    params
  );
};

/////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

/////////////////////////////////////////////////////////////////////////////////
//                                                                             //
// packages/url/url_common.js                                                  //
//                                                                             //
/////////////////////////////////////////////////////////////////////////////////
                                                                               //
var URL = exports.URL = {};

function encodeString(str) {
  return encodeURIComponent(str).replace(/\*/g, '%2A');
}

// Encode URL paramaters into a query string, handling nested objects and
// arrays properly.
URL._encodeParams = function (params, prefix) {
  var str = [];
  var isParamsArray = Array.isArray(params);
  for (var p in params) {
    if (Object.prototype.hasOwnProperty.call(params, p)) {
      var k = prefix ? prefix + '[' + (isParamsArray ? '' : p) + ']' : p;
      var v = params[p];
      if (typeof v === 'object') {
        str.push(this._encodeParams(v, k));
      } else {
        var encodedKey =
          encodeString(k).replace('%5B', '[').replace('%5D', ']');
        str.push(encodedKey + '=' + encodeString(v));
      }
    }
  }
  return str.join('&').replace(/%20/g, '+');
};

exports.buildUrl = function(before_qmark, from_qmark, opt_query, opt_params) {
  var url_without_query = before_qmark;
  var query = from_qmark ? from_qmark.slice(1) : null;

  if (typeof opt_query === "string")
    query = String(opt_query);

  if (opt_params) {
    query = query || "";
    var prms = URL._encodeParams(opt_params);
    if (query && prms)
      query += '&';
    query += prms;
  }

  var url = url_without_query;
  if (query !== null)
    url += ("?"+query);

  return url;
};

/////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

/////////////////////////////////////////////////////////////////////////////////
//                                                                             //
// packages/url/url_server.js                                                  //
//                                                                             //
/////////////////////////////////////////////////////////////////////////////////
                                                                               //
var url_util = require('url');
var common = require("./url_common.js");
var URL = exports.URL = common.URL;

URL._constructUrl = function (url, query, params) {
  var url_parts = url_util.parse(url);
  return common.buildUrl(
    url_parts.protocol + "//" + url_parts.host + url_parts.pathname,
    url_parts.search,
    query,
    params
  );
};

/////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

/////////////////////////////////////////////////////////////////////////////////
//                                                                             //
// packages/url/url_tests.js                                                   //
//                                                                             //
/////////////////////////////////////////////////////////////////////////////////
                                                                               //
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

/////////////////////////////////////////////////////////////////////////////////

}).call(this);
