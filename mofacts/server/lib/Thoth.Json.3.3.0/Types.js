"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ErrorReason$reflection = ErrorReason$reflection;
exports.Util$002ECache$00601$reflection = Util$002ECache$00601$reflection;
exports.Util$002ECache$00601$$$$002Ector = Util$002ECache$00601$$$$002Ector;
exports.Util$002ECache$00601$$GetOrAdd$$43981464 = Util$002ECache$00601$$GetOrAdd$$43981464;
exports.Util$$$CachedDecoders = exports.Util$$$CachedEncoders = exports.Util$002ECache$00601 = exports.ErrorReason = void 0;

var _Types = require("../fable-library.2.3.11/Types");

var _Reflection = require("../fable-library.2.3.11/Reflection");

var _Util = require("../fable-library.2.3.11/Util");

const ErrorReason = (0, _Types.declare)(function Thoth_Json_ErrorReason(tag, name, ...fields) {
  _Types.Union.call(this, tag, name, ...fields);
}, _Types.Union);
exports.ErrorReason = ErrorReason;

function ErrorReason$reflection() {
  return (0, _Reflection.union)("Thoth.Json.ErrorReason", [], ErrorReason, () => [["BadPrimitive", [_Reflection.string, _Reflection.obj]], ["BadPrimitiveExtra", [_Reflection.string, _Reflection.obj, _Reflection.string]], ["BadType", [_Reflection.string, _Reflection.obj]], ["BadField", [_Reflection.string, _Reflection.obj]], ["BadPath", [_Reflection.string, _Reflection.obj, _Reflection.string]], ["TooSmallArray", [_Reflection.string, _Reflection.obj]], ["FailMessage", [_Reflection.string]], ["BadOneOf", [(0, _Reflection.list)(_Reflection.string)]]]);
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