"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.FetchError$reflection = FetchError$reflection;
exports.Helper$$$fetch = Helper$$$fetch;
exports.Helper$$$withContentTypeJson = Helper$$$withContentTypeJson;
exports.Helper$$$encode = Helper$$$encode;
exports.Helper$$$withBody = Helper$$$withBody;
exports.Helper$$$withProperties = Helper$$$withProperties;
exports.Helper$$$eitherUnit = Helper$$$eitherUnit;
exports.Helper$$$resolve = Helper$$$resolve;
exports.Helper$$$message = Helper$$$message;
exports.Fetch$reflection = Fetch$reflection;
exports.Fetch$$$tryFetchAs$$25B10BBE = Fetch$$$tryFetchAs$$25B10BBE;
exports.Fetch$$$fetchAs$$25B10BBE = Fetch$$$fetchAs$$25B10BBE;
exports.Fetch$$$get$$5760677E = Fetch$$$get$$5760677E;
exports.Fetch$$$tryGet$$5760677E = Fetch$$$tryGet$$5760677E;
exports.Fetch$$$post$$5760677E = Fetch$$$post$$5760677E;
exports.Fetch$$$tryPost$$5760677E = Fetch$$$tryPost$$5760677E;
exports.Fetch$$$put$$5760677E = Fetch$$$put$$5760677E;
exports.Fetch$$$tryPut$$5760677E = Fetch$$$tryPut$$5760677E;
exports.Fetch$$$patch$$5760677E = Fetch$$$patch$$5760677E;
exports.Fetch$$$tryPatch$$5760677E = Fetch$$$tryPatch$$5760677E;
exports.Fetch$$$delete$$5760677E = Fetch$$$delete$$5760677E;
exports.Fetch$$$tryDelete$$5760677E = Fetch$$$tryDelete$$5760677E;
exports.Fetch = exports.FetchError = void 0;

var _Types = require("../fable-library.2.10.2/Types");

var _Reflection = require("../fable-library.2.10.2/Reflection");

var _Util = require("../fable-library.2.10.2/Util");

var _Fetch = require("../Fable.Fetch.2.2.0/Fetch");

var _Encode = require("../Thoth.Json.4.0.0/Encode");

var _Option = require("../fable-library.2.10.2/Option");

var _List = require("../fable-library.2.10.2/List");

var _Decode = require("../Thoth.Json.4.0.0/Decode");

var _PromiseImpl = require("../Fable.Promise.2.1.0/PromiseImpl");

var _Promise = require("../Fable.Promise.2.1.0/Promise");

const FetchError = (0, _Types.declare)(function Thoth_Fetch_FetchError(tag, name, ...fields) {
  this.tag = tag | 0;
  this.name = name;
  this.fields = fields;
}, _Types.Union);
exports.FetchError = FetchError;

function FetchError$reflection() {
  return (0, _Reflection.union_type)("Thoth.Fetch.FetchError", [], FetchError, () => [["PreparingRequestFailed", [["Item", (0, _Reflection.class_type)("System.Exception")]]], ["DecodingFailed", [["Item", _Reflection.string_type]]], ["FetchFailed", [["Item", (0, _Reflection.class_type)("Fetch.Types.Response")]]], ["NetworkError", [["Item", (0, _Reflection.class_type)("System.Exception")]]]]);
}

function Helper$$$fetch(url, init) {
  return fetch(url, (0, _Util.createObj)(init, 1));
}

function Helper$$$withContentTypeJson(data, headers) {
  if (data != null) {
    return new _Types.List(new _Fetch.Types$002EHttpRequestHeaders(11, "Content-Type", "application/json"), headers);
  } else {
    return headers;
  }
}

function Helper$$$encode(data$$1, caseStrategy, extra, dataResolver) {
  const encoder = (0, _Encode.Auto$$$generateEncoderCached$$Z127D9D79)(caseStrategy, extra, undefined, dataResolver);
  const value = encoder(data$$1);
  return (0, _Encode.toString)(0, value);
}

function Helper$$$withBody(data$$2, caseStrategy$$1, extra$$1, dataResolver$$1, properties) {
  let option$$1;
  option$$1 = (0, _Option.map)(function mapping(data$$3) {
    let body;
    let arg0;
    const x = Helper$$$encode(data$$3, caseStrategy$$1, extra$$1, dataResolver$$1);
    arg0 = x;
    body = new _Fetch.Types$002ERequestProperties(2, "Body", arg0);
    return new _Types.List(body, properties);
  }, data$$2);
  return (0, _Option.defaultArg)(option$$1, properties);
}

function Helper$$$withProperties(custom, properties$$1) {
  let option$$3;
  option$$3 = (0, _Option.map)(function mapping$$1(list2) {
    return (0, _List.append)(properties$$1, list2);
  }, custom);
  return (0, _Option.defaultArg)(option$$3, properties$$1);
}

function Helper$$$eitherUnit(responseResolver, cont) {
  if ((0, _Reflection.fullName)(responseResolver.ResolveType()) === "Microsoft.FSharp.Core.Unit") {
    return new _Option.Result(0, "Ok", void null);
  } else {
    return cont();
  }
}

function Helper$$$resolve(response, caseStrategy$$2, extra$$2, decoder, responseResolver$$1) {
  let decoder$$1;
  const value$$1 = (0, _Decode.Auto$$$generateDecoderCached$$7848D058)(caseStrategy$$2, extra$$2, responseResolver$$1);
  decoder$$1 = (0, _Option.defaultArg)((0, _Util.curry)(2, decoder), value$$1);
  let eitherUnitOr;
  const responseResolver$$2 = responseResolver$$1;

  eitherUnitOr = function (cont$$1) {
    return Helper$$$eitherUnit(responseResolver$$2, cont$$1);
  };

  return (0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
    var a, arg0$$2;
    return (response.ok ? ((0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
      return response.text().then(function (_arg1) {
        return Promise.resolve(eitherUnitOr(function () {
          let matchValue;
          matchValue = (0, _Decode.fromString)((0, _Util.uncurry)(2, decoder$$1), _arg1);

          if (matchValue.tag === 1) {
            const arg0$$1 = new FetchError(1, "DecodingFailed", matchValue.fields[0]);
            return new _Option.Result(1, "Error", arg0$$1);
          } else {
            return new _Option.Result(0, "Ok", matchValue.fields[0]);
          }
        }));
      });
    }))) : (a = (arg0$$2 = new FetchError(2, "FetchFailed", response), (new _Option.Result(1, "Error", arg0$$2))), (Promise.resolve(a)))).then(function (_arg2) {
      return Promise.resolve(_arg2);
    });
  }));
}

function Helper$$$message(error) {
  switch (error.tag) {
    case 1:
      {
        return "[Thoth.Fetch] Error while decoding the response:\n\n" + error.fields[0];
      }

    case 2:
      {
        return "[Thoth.Fetch] Request failed:\n\n" + (0, _Util.int32ToString)(error.fields[0].status) + " " + error.fields[0].statusText + " for URL " + error.fields[0].url;
      }

    case 3:
      {
        return "[Thoth.Fetch] A network error occured:\n\n" + error.fields[0].message;
      }

    default:
      {
        return "[Thoth.Fetch] Request preparation failed:\n\n" + error.fields[0].message;
      }
  }
}

const Fetch = (0, _Types.declare)(function Thoth_Fetch_Fetch() {});
exports.Fetch = Fetch;

function Fetch$reflection() {
  return (0, _Reflection.class_type)("Thoth.Fetch.Fetch", undefined, Fetch);
}

function Fetch$$$tryFetchAs$$25B10BBE(url$$1, decoder$$2, data$$4, httpMethod, properties$$2, headers$$1, caseStrategy$$3, extra$$3, responseResolver$$3, dataResolver$$2) {
  var arg0$$3, headers$$3, headers$$2;

  try {
    let properties$$5;
    let properties$$4;
    const properties$$3 = (0, _List.ofArray)([(arg0$$3 = (0, _Option.defaultArg)(httpMethod, "GET"), (new _Fetch.Types$002ERequestProperties(0, "Method", arg0$$3))), (headers$$3 = (headers$$2 = (0, _Option.defaultArg)(headers$$1, new _Types.List()), (Helper$$$withContentTypeJson(data$$4, headers$$2))), new _Fetch.Types$002ERequestProperties(1, "Headers", (0, _Util.createObj)(headers$$3, 0)))]);
    properties$$4 = Helper$$$withBody(data$$4, caseStrategy$$3, extra$$3, dataResolver$$2, properties$$3);
    properties$$5 = Helper$$$withProperties(properties$$2, properties$$4);
    let pr;
    pr = (0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
      return Helper$$$fetch(url$$1, properties$$5).then(function (_arg1$$1) {
        return Helper$$$resolve(_arg1$$1, caseStrategy$$3, extra$$3, decoder$$2, responseResolver$$3);
      });
    }));
    return pr.then(void 0, function fail($arg$$1) {
      let arg0$$5;
      arg0$$5 = new FetchError(3, "NetworkError", $arg$$1);
      return new _Option.Result(1, "Error", arg0$$5);
    });
  } catch (exn$$2) {
    return (0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
      var arg0$$6;
      return Promise.resolve((arg0$$6 = new FetchError(0, "PreparingRequestFailed", exn$$2), (new _Option.Result(1, "Error", arg0$$6))));
    }));
  }
}

function Fetch$$$fetchAs$$25B10BBE(url$$2, decoder$$3, data$$5, httpMethod$$1, properties$$6, headers$$4, caseStrategy$$4, extra$$4, responseResolver$$4, dataResolver$$3) {
  return (0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
    return Fetch$$$tryFetchAs$$25B10BBE(url$$2, decoder$$3, data$$5, httpMethod$$1, properties$$6, headers$$4, caseStrategy$$4, extra$$4, responseResolver$$4, dataResolver$$3).then(function (_arg2$$1) {
      let response$$4;

      if (_arg2$$1.tag === 1) {
        throw new Error(Helper$$$message(_arg2$$1.fields[0]));
      } else {
        response$$4 = _arg2$$1.fields[0];
      }

      return Promise.resolve(response$$4);
    });
  }));
}

function Fetch$$$get$$5760677E(url$$3, data$$6, properties$$7, headers$$5, caseStrategy$$5, extra$$5, decoder$$4, responseResolver$$5, dataResolver$$4) {
  return Fetch$$$fetchAs$$25B10BBE(url$$3, decoder$$4, data$$6, undefined, properties$$7, headers$$5, caseStrategy$$5, extra$$5, responseResolver$$5, dataResolver$$4);
}

function Fetch$$$tryGet$$5760677E(url$$4, data$$7, properties$$8, headers$$6, caseStrategy$$6, extra$$6, decoder$$5, responseResolver$$6, dataResolver$$5) {
  return Fetch$$$tryFetchAs$$25B10BBE(url$$4, decoder$$5, data$$7, undefined, properties$$8, headers$$6, caseStrategy$$6, extra$$6, responseResolver$$6, dataResolver$$5);
}

function Fetch$$$post$$5760677E(url$$5, data$$8, properties$$9, headers$$7, caseStrategy$$7, extra$$7, decoder$$6, responseResolver$$7, dataResolver$$6) {
  return Fetch$$$fetchAs$$25B10BBE(url$$5, decoder$$6, data$$8, "POST", properties$$9, headers$$7, caseStrategy$$7, extra$$7, responseResolver$$7, dataResolver$$6);
}

function Fetch$$$tryPost$$5760677E(url$$6, data$$9, properties$$10, headers$$8, caseStrategy$$8, extra$$8, decoder$$7, responseResolver$$8, dataResolver$$7) {
  return Fetch$$$tryFetchAs$$25B10BBE(url$$6, decoder$$7, data$$9, "POST", properties$$10, headers$$8, caseStrategy$$8, extra$$8, responseResolver$$8, dataResolver$$7);
}

function Fetch$$$put$$5760677E(url$$7, data$$10, properties$$11, headers$$9, caseStrategy$$9, extra$$9, decoder$$8, responseResolver$$9, dataResolver$$8) {
  return Fetch$$$fetchAs$$25B10BBE(url$$7, decoder$$8, data$$10, "PUT", properties$$11, headers$$9, caseStrategy$$9, extra$$9, responseResolver$$9, dataResolver$$8);
}

function Fetch$$$tryPut$$5760677E(url$$8, data$$11, properties$$12, headers$$10, caseStrategy$$10, extra$$10, decoder$$9, responseResolver$$10, dataResolver$$9) {
  return Fetch$$$tryFetchAs$$25B10BBE(url$$8, decoder$$9, data$$11, "PUT", properties$$12, headers$$10, caseStrategy$$10, extra$$10, responseResolver$$10, dataResolver$$9);
}

function Fetch$$$patch$$5760677E(url$$9, data$$12, properties$$13, headers$$11, caseStrategy$$11, extra$$11, decoder$$10, responseResolver$$11, dataResolver$$10) {
  return Fetch$$$fetchAs$$25B10BBE(url$$9, decoder$$10, data$$12, "PATCH", properties$$13, headers$$11, caseStrategy$$11, extra$$11, responseResolver$$11, dataResolver$$10);
}

function Fetch$$$tryPatch$$5760677E(url$$10, data$$13, properties$$14, headers$$12, caseStrategy$$12, extra$$12, decoder$$11, responseResolver$$12, dataResolver$$11) {
  return Fetch$$$tryFetchAs$$25B10BBE(url$$10, decoder$$11, data$$13, "PATCH", properties$$14, headers$$12, caseStrategy$$12, extra$$12, responseResolver$$12, dataResolver$$11);
}

function Fetch$$$delete$$5760677E(url$$11, data$$14, properties$$15, headers$$13, caseStrategy$$13, extra$$13, decoder$$12, responseResolver$$13, dataResolver$$12) {
  return Fetch$$$fetchAs$$25B10BBE(url$$11, decoder$$12, data$$14, "DELETE", properties$$15, headers$$13, caseStrategy$$13, extra$$13, responseResolver$$13, dataResolver$$12);
}

function Fetch$$$tryDelete$$5760677E(url$$12, data$$15, properties$$16, headers$$14, caseStrategy$$14, extra$$14, decoder$$13, responseResolver$$14, dataResolver$$13) {
  return Fetch$$$tryFetchAs$$25B10BBE(url$$12, decoder$$13, data$$15, "DELETE", properties$$16, headers$$14, caseStrategy$$14, extra$$14, responseResolver$$14, dataResolver$$13);
}