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

var _Types = require("../fable-library.2.10.2/Types");

var _Reflection = require("../fable-library.2.10.2/Reflection");

var _Util = require("../fable-library.2.10.2/Util");

var _Promise = require("../Fable.Promise.2.1.0/Promise");

const Types$002EHttpRequestHeaders = (0, _Types.declare)(function Fetch_Types_HttpRequestHeaders(tag, name, ...fields) {
  this.tag = tag | 0;
  this.name = name;
  this.fields = fields;
}, _Types.Union);
exports.Types$002EHttpRequestHeaders = Types$002EHttpRequestHeaders;

function Types$002EHttpRequestHeaders$reflection() {
  return (0, _Reflection.union_type)("Fetch.Types.HttpRequestHeaders", [], Types$002EHttpRequestHeaders, () => [["Accept", [["Item", _Reflection.string_type]]], ["Accept-Charset", [["Item", _Reflection.string_type]]], ["Accept-Encoding", [["Item", _Reflection.string_type]]], ["Accept-Language", [["Item", _Reflection.string_type]]], ["Accept-Datetime", [["Item", _Reflection.string_type]]], ["Authorization", [["Item", _Reflection.string_type]]], ["Cache-Control", [["Item", _Reflection.string_type]]], ["Connection", [["Item", _Reflection.string_type]]], ["Cookie", [["Item", _Reflection.string_type]]], ["Content-Length", [["Item", _Reflection.string_type]]], ["Content-MD5", [["Item", _Reflection.string_type]]], ["Content-Type", [["Item", _Reflection.string_type]]], ["Date", [["Item", _Reflection.string_type]]], ["Expect", [["Item", _Reflection.string_type]]], ["Forwarded", [["Item", _Reflection.string_type]]], ["From", [["Item", _Reflection.string_type]]], ["Host", [["Item", _Reflection.string_type]]], ["If-Match", [["Item", _Reflection.string_type]]], ["If-Modified-Since", [["Item", _Reflection.string_type]]], ["If-None-Match", [["Item", _Reflection.string_type]]], ["If-Range", [["Item", _Reflection.string_type]]], ["If-Unmodified-Since", [["Item", _Reflection.string_type]]], ["Max-Forwards", [["Item", _Reflection.int32_type]]], ["Origin", [["Item", _Reflection.string_type]]], ["Pragma", [["Item", _Reflection.string_type]]], ["Proxy-Authorization", [["Item", _Reflection.string_type]]], ["Range", [["Item", _Reflection.string_type]]], ["Referer", [["Item", _Reflection.string_type]]], ["SOAPAction", [["Item", _Reflection.string_type]]], ["TE", [["Item", _Reflection.string_type]]], ["User-Agent", [["Item", _Reflection.string_type]]], ["Upgrade", [["Item", _Reflection.string_type]]], ["Via", [["Item", _Reflection.string_type]]], ["Warning", [["Item", _Reflection.string_type]]], ["X-Requested-With", [["Item", _Reflection.string_type]]], ["DNT", [["Item", _Reflection.string_type]]], ["X-Forwarded-For", [["Item", _Reflection.string_type]]], ["X-Forwarded-Host", [["Item", _Reflection.string_type]]], ["X-Forwarded-Proto", [["Item", _Reflection.string_type]]], ["Front-End-Https", [["Item", _Reflection.string_type]]], ["X-Http-Method-Override", [["Item", _Reflection.string_type]]], ["X-ATT-DeviceId", [["Item", _Reflection.string_type]]], ["X-Wap-Profile", [["Item", _Reflection.string_type]]], ["Proxy-Connection", [["Item", _Reflection.string_type]]], ["X-UIDH", [["Item", _Reflection.string_type]]], ["X-Csrf-Token", [["Item", _Reflection.string_type]]], ["Custom", [["key", _Reflection.string_type], ["value", _Reflection.obj_type]]]]);
}

const Types$002ERequestProperties = (0, _Types.declare)(function Fetch_Types_RequestProperties(tag, name, ...fields) {
  this.tag = tag | 0;
  this.name = name;
  this.fields = fields;
}, _Types.Union);
exports.Types$002ERequestProperties = Types$002ERequestProperties;

function Types$002ERequestProperties$reflection() {
  return (0, _Reflection.union_type)("Fetch.Types.RequestProperties", [], Types$002ERequestProperties, () => [["Method", [["Item", _Reflection.string_type]]], ["Headers", [["Item", (0, _Reflection.class_type)("Fetch.Types.IHttpRequestHeaders")]]], ["Body", [["Item", _Reflection.obj_type]]], ["Mode", [["Item", _Reflection.string_type]]], ["Credentials", [["Item", _Reflection.string_type]]], ["Cache", [["Item", _Reflection.string_type]]], ["Redirect", [["Item", _Reflection.string_type]]], ["Referrer", [["Item", _Reflection.string_type]]], ["ReferrerPolicy", [["Item", _Reflection.string_type]]], ["Integrity", [["Item", _Reflection.string_type]]], ["KeepAlive", [["Item", _Reflection.bool_type]]], ["Signal", [["Item", (0, _Reflection.class_type)("Fetch.Types.AbortSignal")]]]]);
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