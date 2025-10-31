"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.HttpMethod$reflection = HttpMethod$reflection;
exports.Header$reflection = Header$reflection;
exports.BodyContent$reflection = BodyContent$reflection;
exports.ResponseTypes$reflection = ResponseTypes$reflection;
exports.HttpRequest$reflection = HttpRequest$reflection;
exports.ResponseContent$reflection = ResponseContent$reflection;
exports.HttpResponse$reflection = HttpResponse$reflection;
exports.HttpResponse = exports.ResponseContent = exports.HttpRequest = exports.ResponseTypes = exports.BodyContent = exports.Header = exports.HttpMethod = void 0;

var _Types = require("../fable-library.2.3.11/Types");

var _Reflection = require("../fable-library.2.3.11/Reflection");

const HttpMethod = (0, _Types.declare)(function Fable_SimpleHttp_HttpMethod(tag, name, ...fields) {
  _Types.Union.call(this, tag, name, ...fields);
}, _Types.Union);
exports.HttpMethod = HttpMethod;

function HttpMethod$reflection() {
  return (0, _Reflection.union)("Fable.SimpleHttp.HttpMethod", [], HttpMethod, () => ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);
}

const Header = (0, _Types.declare)(function Fable_SimpleHttp_Header(tag, name, ...fields) {
  _Types.Union.call(this, tag, name, ...fields);
}, _Types.Union);
exports.Header = Header;

function Header$reflection() {
  return (0, _Reflection.union)("Fable.SimpleHttp.Header", [], Header, () => [["Header", [_Reflection.string, _Reflection.string]]]);
}

const BodyContent = (0, _Types.declare)(function Fable_SimpleHttp_BodyContent(tag, name, ...fields) {
  _Types.Union.call(this, tag, name, ...fields);
}, _Types.Union);
exports.BodyContent = BodyContent;

function BodyContent$reflection() {
  return (0, _Reflection.union)("Fable.SimpleHttp.BodyContent", [], BodyContent, () => ["Empty", ["Text", [_Reflection.string]], ["Binary", [(0, _Reflection.type)("Browser.Types.Blob")]], ["Form", [(0, _Reflection.type)("Browser.Types.FormData")]]]);
}

const ResponseTypes = (0, _Types.declare)(function Fable_SimpleHttp_ResponseTypes(tag, name, ...fields) {
  _Types.Union.call(this, tag, name, ...fields);
}, _Types.Union);
exports.ResponseTypes = ResponseTypes;

function ResponseTypes$reflection() {
  return (0, _Reflection.union)("Fable.SimpleHttp.ResponseTypes", [], ResponseTypes, () => ["Text", "Blob", "ArrayBuffer"]);
}

const HttpRequest = (0, _Types.declare)(function Fable_SimpleHttp_HttpRequest(arg1, arg2, arg3, arg4, arg5, arg6) {
  this.url = arg1;
  this.method = arg2;
  this.headers = arg3;
  this.overridenMimeType = arg4;
  this.overridenResponseType = arg5;
  this.content = arg6;
}, _Types.Record);
exports.HttpRequest = HttpRequest;

function HttpRequest$reflection() {
  return (0, _Reflection.record)("Fable.SimpleHttp.HttpRequest", [], HttpRequest, () => [["url", _Reflection.string], ["method", HttpMethod$reflection()], ["headers", (0, _Reflection.list)(Header$reflection())], ["overridenMimeType", (0, _Reflection.option)(_Reflection.string)], ["overridenResponseType", (0, _Reflection.option)(ResponseTypes$reflection())], ["content", BodyContent$reflection()]]);
}

const ResponseContent = (0, _Types.declare)(function Fable_SimpleHttp_ResponseContent(tag, name, ...fields) {
  _Types.Union.call(this, tag, name, ...fields);
}, _Types.Union);
exports.ResponseContent = ResponseContent;

function ResponseContent$reflection() {
  return (0, _Reflection.union)("Fable.SimpleHttp.ResponseContent", [], ResponseContent, () => [["Text", [_Reflection.string]], ["Blob", [(0, _Reflection.type)("Browser.Types.Blob")]], ["ArrayBuffer", [(0, _Reflection.type)("Fable.Core.JS.ArrayBuffer")]], ["Unknown", [_Reflection.obj]]]);
}

const HttpResponse = (0, _Types.declare)(function Fable_SimpleHttp_HttpResponse(arg1, arg2, arg3, arg4, arg5) {
  this.statusCode = arg1 | 0;
  this.responseText = arg2;
  this.responseType = arg3;
  this.responseHeaders = arg4;
  this.content = arg5;
}, _Types.Record);
exports.HttpResponse = HttpResponse;

function HttpResponse$reflection() {
  return (0, _Reflection.record)("Fable.SimpleHttp.HttpResponse", [], HttpResponse, () => [["statusCode", _Reflection.int32], ["responseText", _Reflection.string], ["responseType", _Reflection.string], ["responseHeaders", (0, _Reflection.type)("Microsoft.FSharp.Collections.FSharpMap`2", [_Reflection.string, _Reflection.string])], ["content", ResponseContent$reflection()]]);
}