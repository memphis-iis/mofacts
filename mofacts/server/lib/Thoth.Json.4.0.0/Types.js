"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ErrorReason$reflection = ErrorReason$reflection;
exports.CaseStrategy$reflection = CaseStrategy$reflection;
exports.ExtraCoders$reflection = ExtraCoders$reflection;
exports.Util$002ECache$00601$reflection = Util$002ECache$00601$reflection;
exports.Util$002ECache$00601$$$$002Ector = Util$002ECache$00601$$$$002Ector;
exports.Util$002ECache$00601$$GetOrAdd$$43981464 = Util$002ECache$00601$$GetOrAdd$$43981464;
exports.Util$002ECasing$$$lowerFirst = Util$002ECasing$$$lowerFirst;
exports.Util$002ECasing$$$convert = Util$002ECasing$$$convert;
exports.Util$$$CachedDecoders = exports.Util$$$CachedEncoders = exports.Util$002ECache$00601 = exports.ExtraCoders = exports.CaseStrategy = exports.ErrorReason = void 0;

var _Types = require("../fable-library.2.8.4/Types");

var _Reflection = require("../fable-library.2.8.4/Reflection");

var _Option = require("../fable-library.2.8.4/Option");

var _Util = require("../fable-library.2.8.4/Util");

var _RegExp = require("../fable-library.2.8.4/RegExp");

const ErrorReason = (0, _Types.declare)(function Thoth_Json_ErrorReason(tag, name, ...fields) {
  _Types.Union.call(this, tag, name, ...fields);
}, _Types.Union);
exports.ErrorReason = ErrorReason;

function ErrorReason$reflection() {
  return (0, _Reflection.union)("Thoth.Json.ErrorReason", [], ErrorReason, () => [["BadPrimitive", [["Item1", _Reflection.string], ["Item2", _Reflection.obj]]], ["BadPrimitiveExtra", [["Item1", _Reflection.string], ["Item2", _Reflection.obj], ["Item3", _Reflection.string]]], ["BadType", [["Item1", _Reflection.string], ["Item2", _Reflection.obj]]], ["BadField", [["Item1", _Reflection.string], ["Item2", _Reflection.obj]]], ["BadPath", [["Item1", _Reflection.string], ["Item2", _Reflection.obj], ["Item3", _Reflection.string]]], ["TooSmallArray", [["Item1", _Reflection.string], ["Item2", _Reflection.obj]]], ["FailMessage", [["Item", _Reflection.string]]], ["BadOneOf", [["Item", (0, _Reflection.list)(_Reflection.string)]]]]);
}

const CaseStrategy = (0, _Types.declare)(function Thoth_Json_CaseStrategy(tag, name, ...fields) {
  _Types.Union.call(this, tag, name, ...fields);
}, _Types.Union);
exports.CaseStrategy = CaseStrategy;

function CaseStrategy$reflection() {
  return (0, _Reflection.union)("Thoth.Json.CaseStrategy", [], CaseStrategy, () => ["PascalCase", "CamelCase", "SnakeCase"]);
}

const ExtraCoders = (0, _Types.declare)(function Thoth_Json_ExtraCoders(arg1, arg2) {
  this.Hash = arg1;
  this.Coders = arg2;
}, _Types.Record);
exports.ExtraCoders = ExtraCoders;

function ExtraCoders$reflection() {
  return (0, _Reflection.record)("Thoth.Json.ExtraCoders", [], ExtraCoders, () => [["Hash", _Reflection.string], ["Coders", (0, _Reflection.type)("Microsoft.FSharp.Collections.FSharpMap`2", [_Reflection.string, (0, _Reflection.tuple)((0, _Reflection.lambda)(_Reflection.obj, _Reflection.obj), (0, _Reflection.lambda)(_Reflection.string, (0, _Reflection.lambda)(_Reflection.obj, (0, _Reflection.union)("Microsoft.FSharp.Core.FSharpResult`2", [_Reflection.obj, (0, _Reflection.tuple)(_Reflection.string, ErrorReason$reflection())], _Option.Result, () => [["Ok", [["ResultValue", _Reflection.obj]]], ["Error", [["ErrorValue", (0, _Reflection.tuple)(_Reflection.string, ErrorReason$reflection())]]]]))))])]]);
}

const Util$002ECache$00601 = (0, _Types.declare)(function Thoth_Json_Util_Cache() {
  const $this$$1 = this;
  $this$$1.cache = new Map([]);
});
exports.Util$002ECache$00601 = Util$002ECache$00601;

function Util$002ECache$00601$reflection($gen$$2) {
  return (0, _Reflection.type)("Thoth.Json.Util.Cache`1", [$gen$$2]);
}

function Util$002ECache$00601$$$$002Ector() {
  return this instanceof Util$002ECache$00601 ? Util$002ECache$00601.call(this) : new Util$002ECache$00601();
}

function Util$002ECache$00601$$GetOrAdd$$43981464(__, key, factory) {
  const matchValue = (0, _Util.tryGetValue)(__.cache, key, null);

  if (matchValue[0]) {
    return matchValue[1];
  } else {
    const x$$1 = factory();
    (0, _Util.addToDict)(__.cache, key, x$$1);
    return x$$1;
  }
}

const Util$$$CachedEncoders = Util$002ECache$00601$$$$002Ector();
exports.Util$$$CachedEncoders = Util$$$CachedEncoders;
const Util$$$CachedDecoders = Util$002ECache$00601$$$$002Ector();
exports.Util$$$CachedDecoders = Util$$$CachedDecoders;

function Util$002ECasing$$$lowerFirst(str) {
  return str.slice(null, 0 + 1).toLowerCase() + str.slice(1, str.length);
}

function Util$002ECasing$$$convert(caseStrategy, fieldName) {
  switch (caseStrategy.tag) {
    case 2:
      {
        return (0, _RegExp.replace)(Util$002ECasing$$$lowerFirst(fieldName), "[A-Z]", "_$0").toLowerCase();
      }

    case 0:
      {
        return fieldName;
      }

    default:
      {
        return Util$002ECasing$$$lowerFirst(fieldName);
      }
  }
}