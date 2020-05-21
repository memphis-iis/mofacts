"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Types$002EHttpRequestHeaders$reflection = Types$002EHttpRequestHeaders$reflection;
exports.Types$002ERequestProperties$reflection = Types$002ERequestProperties$reflection;
exports.fetch$ = fetch$;
exports.tryFetch = tryFetch;
exports.tryOptionsRequest = tryOptionsRequest;
exports.Types$002ERequestProperties = exports.Types$002EHttpRequestHeaders = void 0;

var _Types = require("../fable-library.2.8.4/Types");

var _Reflection = require("../fable-library.2.8.4/Reflection");

var _Util = require("../fable-library.2.8.4/Util");

var _Promise = require("../Fable.Promise.2.1.0/Promise");

const Types$002EHttpRequestHeaders = (0, _Types.declare)(function Fetch_Types_HttpRequestHeaders(tag, name, ...fields) {
  _Types.Union.call(this, tag, name, ...fields);
}, _Types.Union);
exports.Types$002EHttpRequestHeaders = Types$002EHttpRequestHeaders;

function Types$002EHttpRequestHeaders$reflection() {
  return (0, _Reflection.union)("Fetch.Types.HttpRequestHeaders", [], Types$002EHttpRequestHeaders, () => [["Accept", [["Item", _Reflection.string]]], ["Accept-Charset", [["Item", _Reflection.string]]], ["Accept-Encoding", [["Item", _Reflection.string]]], ["Accept-Language", [["Item", _Reflection.string]]], ["Accept-Datetime", [["Item", _Reflection.string]]], ["Authorization", [["Item", _Reflection.string]]], ["Cache-Control", [["Item", _Reflection.string]]], ["Connection", [["Item", _Reflection.string]]], ["Cookie", [["Item", _Reflection.string]]], ["Content-Length", [["Item", _Reflection.string]]], ["Content-MD5", [["Item", _Reflection.string]]], ["Content-Type", [["Item", _Reflection.string]]], ["Date", [["Item", _Reflection.string]]], ["Expect", [["Item", _Reflection.string]]], ["Forwarded", [["Item", _Reflection.string]]], ["From", [["Item", _Reflection.string]]], ["Host", [["Item", _Reflection.string]]], ["If-Match", [["Item", _Reflection.string]]], ["If-Modified-Since", [["Item", _Reflection.string]]], ["If-None-Match", [["Item", _Reflection.string]]], ["If-Range", [["Item", _Reflection.string]]], ["If-Unmodified-Since", [["Item", _Reflection.string]]], ["Max-Forwards", [["Item", _Reflection.int32]]], ["Origin", [["Item", _Reflection.string]]], ["Pragma", [["Item", _Reflection.string]]], ["Proxy-Authorization", [["Item", _Reflection.string]]], ["Range", [["Item", _Reflection.string]]], ["Referer", [["Item", _Reflection.string]]], ["SOAPAction", [["Item", _Reflection.string]]], ["TE", [["Item", _Reflection.string]]], ["User-Agent", [["Item", _Reflection.string]]], ["Upgrade", [["Item", _Reflection.string]]], ["Via", [["Item", _Reflection.string]]], ["Warning", [["Item", _Reflection.string]]], ["X-Requested-With", [["Item", _Reflection.string]]], ["DNT", [["Item", _Reflection.string]]], ["X-Forwarded-For", [["Item", _Reflection.string]]], ["X-Forwarded-Host", [["Item", _Reflection.string]]], ["X-Forwarded-Proto", [["Item", _Reflection.string]]], ["Front-End-Https", [["Item", _Reflection.string]]], ["X-Http-Method-Override", [["Item", _Reflection.string]]], ["X-ATT-DeviceId", [["Item", _Reflection.string]]], ["X-Wap-Profile", [["Item", _Reflection.string]]], ["Proxy-Connection", [["Item", _Reflection.string]]], ["X-UIDH", [["Item", _Reflection.string]]], ["X-Csrf-Token", [["Item", _Reflection.string]]], ["Custom", [["key", _Reflection.string], ["value", _Reflection.obj]]]]);
}

const Types$002ERequestProperties = (0, _Types.declare)(function Fetch_Types_RequestProperties(tag, name, ...fields) {
  _Types.Union.call(this, tag, name, ...fields);
}, _Types.Union);
exports.Types$002ERequestProperties = Types$002ERequestProperties;

function Types$002ERequestProperties$reflection() {
  return (0, _Reflection.union)("Fetch.Types.RequestProperties", [], Types$002ERequestProperties, () => [["Method", [["Item", _Reflection.string]]], ["Headers", [["Item", (0, _Reflection.type)("Fetch.Types.IHttpRequestHeaders")]]], ["Body", [["Item", _Reflection.obj]]], ["Mode", [["Item", _Reflection.string]]], ["Credentials", [["Item", _Reflection.string]]], ["Cache", [["Item", _Reflection.string]]], ["Redirect", [["Item", _Reflection.string]]], ["Referrer", [["Item", _Reflection.string]]], ["ReferrerPolicy", [["Item", _Reflection.string]]], ["Integrity", [["Item", _Reflection.string]]], ["KeepAlive", [["Item", _Reflection.bool]]], ["Signal", [["Item", (0, _Reflection.type)("Fetch.Types.AbortSignal")]]]]);
}

function errorString(response) {
  return (0, _Util.int32ToString)(response.status) + " " + response.statusText + " for URL " + response.url;
}

function fetch$(url, init) {
  const pr = fetch(url, (0, _Util.createObj)(init, 1));
  return pr.then(function a(response$$1) {
    if (response$$1.ok) {
      return response$$1;
    } else {
      const message = errorString(response$$1);
      throw new Error(message);
    }
  });
}

function tryFetch(url$$1, init$$1) {
  const a$$1 = fetch$(url$$1, init$$1);
  return (0, _Promise.result)(a$$1);
}

function tryOptionsRequest(url$$2) {
  const a$$2 = fetch$(url$$2, new _Types.List(new Types$002ERequestProperties(0, "Method", "OPTIONS"), new _Types.List()));
  return (0, _Promise.result)(a$$2);
}