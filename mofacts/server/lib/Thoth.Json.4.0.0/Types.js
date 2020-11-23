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

var _Types = require("../fable-library.2.10.2/Types");

var _Reflection = require("../fable-library.2.10.2/Reflection");

var _Option = require("../fable-library.2.10.2/Option");

var _Util = require("../fable-library.2.10.2/Util");

var _RegExp = require("../fable-library.2.10.2/RegExp");

const ErrorReason = (0, _Types.declare)(function Thoth_Json_ErrorReason(tag, name, ...fields) {
  this.tag = tag | 0;
  this.name = name;
  this.fields = fields;
}, _Types.Union);
exports.ErrorReason = ErrorReason;

function ErrorReason$reflection() {
  return (0, _Reflection.union_type)("Thoth.Json.ErrorReason", [], ErrorReason, () => [["BadPrimitive", [["Item1", _Reflection.string_type], ["Item2", _Reflection.obj_type]]], ["BadPrimitiveExtra", [["Item1", _Reflection.string_type], ["Item2", _Reflection.obj_type], ["Item3", _Reflection.string_type]]], ["BadType", [["Item1", _Reflection.string_type], ["Item2", _Reflection.obj_type]]], ["BadField", [["Item1", _Reflection.string_type], ["Item2", _Reflection.obj_type]]], ["BadPath", [["Item1", _Reflection.string_type], ["Item2", _Reflection.obj_type], ["Item3", _Reflection.string_type]]], ["TooSmallArray", [["Item1", _Reflection.string_type], ["Item2", _Reflection.obj_type]]], ["FailMessage", [["Item", _Reflection.string_type]]], ["BadOneOf", [["Item", (0, _Reflection.list_type)(_Reflection.string_type)]]]]);
}

const CaseStrategy = (0, _Types.declare)(function Thoth_Json_CaseStrategy(tag, name, ...fields) {
  this.tag = tag | 0;
  this.name = name;
  this.fields = fields;
}, _Types.Union);
exports.CaseStrategy = CaseStrategy;

function CaseStrategy$reflection() {
  return (0, _Reflection.union_type)("Thoth.Json.CaseStrategy", [], CaseStrategy, () => ["PascalCase", "CamelCase", "SnakeCase"]);
}

const ExtraCoders = (0, _Types.declare)(function Thoth_Json_ExtraCoders(Hash, Coders) {
  this.Hash = Hash;
  this.Coders = Coders;
}, _Types.Record);
exports.ExtraCoders = ExtraCoders;

function ExtraCoders$reflection() {
  return (0, _Reflection.record_type)("Thoth.Json.ExtraCoders", [], ExtraCoders, () => [["Hash", _Reflection.string_type], ["Coders", (0, _Reflection.class_type)("Microsoft.FSharp.Collections.FSharpMap`2", [_Reflection.string_type, (0, _Reflection.tuple_type)((0, _Reflection.lambda_type)(_Reflection.obj_type, _Reflection.obj_type), (0, _Reflection.lambda_type)(_Reflection.string_type, (0, _Reflection.lambda_type)(_Reflection.obj_type, (0, _Reflection.union_type)("Microsoft.FSharp.Core.FSharpResult`2", [_Reflection.obj_type, (0, _Reflection.tuple_type)(_Reflection.string_type, ErrorReason$reflection())], _Option.Result, () => [["Ok", [["ResultValue", _Reflection.obj_type]]], ["Error", [["ErrorValue", (0, _Reflection.tuple_type)(_Reflection.string_type, ErrorReason$reflection())]]]]))))])]]);
}

const Util$002ECache$00601 = (0, _Types.declare)(function Thoth_Json_Util_Cache() {
  const $this$$1 = this;
  $this$$1.cache = new Map([]);
  void null;
});
exports.Util$002ECache$00601 = Util$002ECache$00601;

function Util$002ECache$00601$reflection($gen$$2) {
  return (0, _Reflection.class_type)("Thoth.Json.Util.Cache`1", [$gen$$2], Util$002ECache$00601);
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
  return str.slice(undefined, 0 + 1).toLowerCase() + str.slice(1, str.length);
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