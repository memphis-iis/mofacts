"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.guid = guid;
exports.decimal = decimal;
exports.object = object;
exports.list = list;
exports.seq = seq;
exports.dict = dict;
exports.bigint = bigint;
exports.datetimeOffset = datetimeOffset;
exports.timespan = timespan;
exports.int64 = int64;
exports.uint64 = uint64;
exports.tuple2 = tuple2;
exports.tuple3 = tuple3;
exports.tuple4 = tuple4;
exports.tuple5 = tuple5;
exports.tuple6 = tuple6;
exports.tuple7 = tuple7;
exports.tuple8 = tuple8;
exports.datetime = datetime;
exports.toString = toString;
exports.option = option;
exports.Auto$reflection = Auto$reflection;
exports.Auto$$$generateEncoderCached$$4AE6C623 = Auto$$$generateEncoderCached$$4AE6C623;
exports.Auto$$$generateEncoder$$4AE6C623 = Auto$$$generateEncoder$$4AE6C623;
exports.Auto$$$toString$$59982D9A = Auto$$$toString$$59982D9A;
exports.encode = encode;
exports.Auto = exports.nil = void 0;

var _Seq = require("../fable-library.2.3.11/Seq");

var _Map = require("../fable-library.2.3.11/Map");

var _Date = require("../fable-library.2.3.11/Date");

var _TimeSpan = require("../fable-library.2.3.11/TimeSpan");

var _Long = require("../fable-library.2.3.11/Long");

var _Util = require("../fable-library.2.3.11/Util");

var _Option = require("../fable-library.2.3.11/Option");

var _Types = require("../fable-library.2.3.11/Types");

var _Reflection = require("../fable-library.2.3.11/Reflection");

var _Array = require("../fable-library.2.3.11/Array");

var _String = require("../fable-library.2.3.11/String");

var _Types2 = require("./Types");

function guid(value) {
  return String(value);
}

function decimal(value$$1) {
  return String(value$$1);
}

const nil = null;
exports.nil = nil;

function object(values) {
  const o = {};
  (0, _Seq.iterate)(function (forLoopVar) {
    o[forLoopVar[0]] = forLoopVar[1];
  }, values);
  return o;
}

function list(values$$1) {
  return Array.from(values$$1);
}

function seq(values$$2) {
  return Array.from(values$$2);
}

function dict(values$$3) {
  return object((0, _Map.toList)(values$$3));
}

function bigint(value$$5) {
  return String(value$$5);
}

function datetimeOffset(value$$6) {
  return (0, _Date.toString)(value$$6, "O", {});
}

function timespan(value$$9) {
  return (0, _TimeSpan.toString)(value$$9);
}

function int64(value$$12) {
  return String(value$$12);
}

function uint64(value$$13) {
  return (0, _Long.toString)(value$$13);
}

function tuple2(enc1, enc2, v1, v2) {
  return [enc1(v1), enc2(v2)];
}

function tuple3(enc1$$1, enc2$$1, enc3, v1$$1, v2$$1, v3) {
  return [enc1$$1(v1$$1), enc2$$1(v2$$1), enc3(v3)];
}

function tuple4(enc1$$2, enc2$$2, enc3$$1, enc4, v1$$2, v2$$2, v3$$1, v4) {
  return [enc1$$2(v1$$2), enc2$$2(v2$$2), enc3$$1(v3$$1), enc4(v4)];
}

function tuple5(enc1$$3, enc2$$3, enc3$$2, enc4$$1, enc5, v1$$3, v2$$3, v3$$2, v4$$1, v5) {
  return [enc1$$3(v1$$3), enc2$$3(v2$$3), enc3$$2(v3$$2), enc4$$1(v4$$1), enc5(v5)];
}

function tuple6(enc1$$4, enc2$$4, enc3$$3, enc4$$2, enc5$$1, enc6, v1$$4, v2$$4, v3$$3, v4$$2, v5$$1, v6) {
  return [enc1$$4(v1$$4), enc2$$4(v2$$4), enc3$$3(v3$$3), enc4$$2(v4$$2), enc5$$1(v5$$1), enc6(v6)];
}

function tuple7(enc1$$5, enc2$$5, enc3$$4, enc4$$3, enc5$$2, enc6$$1, enc7, v1$$5, v2$$5, v3$$4, v4$$3, v5$$2, v6$$1, v7) {
  return [enc1$$5(v1$$5), enc2$$5(v2$$5), enc3$$4(v3$$4), enc4$$3(v4$$3), enc5$$2(v5$$2), enc6$$1(v6$$1), enc7(v7)];
}

function tuple8(enc1$$6, enc2$$6, enc3$$5, enc4$$4, enc5$$3, enc6$$2, enc7$$1, enc8, v1$$6, v2$$6, v3$$5, v4$$4, v5$$3, v6$$2, v7$$1, v8) {
  return [enc1$$6(v1$$6), enc2$$6(v2$$6), enc3$$5(v3$$5), enc4$$4(v4$$4), enc5$$3(v5$$3), enc6$$2(v6$$2), enc7$$1(v7$$1), enc8(v8)];
}

function datetime(value$$14) {
  return (0, _Date.toString)(value$$14, "O", {});
}

function toString(space, value$$17) {
  return JSON.stringify(value$$17, (0, _Util.uncurry)(2, null), space);
}

function option(encoder) {
  return function ($arg$$1) {
    return (0, _Option.defaultArgWith)((0, _Option.defaultArg)($arg$$1, null, encoder), function defThunk() {
      return nil;
    });
  };
}

function autoEncodeRecordsAndUnions(extra, isCamelCase, t) {
  const encoderRef = new _Types.FSharpRef(null);
  const extra$$1 = (0, _Map.add)((0, _Reflection.fullName)(t), encoderRef, extra);
  let encoder$$1;

  if ((0, _Reflection.isRecord)(t, true)) {
    const setters = (0, _Array.map)(function mapping(fi) {
      const targetKey = isCamelCase ? (0, _Reflection.name)(fi).slice(null, 0 + 1).toLowerCase() + (0, _Reflection.name)(fi).slice(1, (0, _Reflection.name)(fi).length) : (0, _Reflection.name)(fi);
      const encode$$1 = autoEncoder(extra$$1, isCamelCase, fi[1]);
      return function (source) {
        return function (target) {
          const value$$18 = (0, _Reflection.getRecordField)(source, fi);

          if (!(value$$18 == null)) {
            target[targetKey] = encode$$1(value$$18);
          }

          return target;
        };
      };
    }, (0, _Reflection.getRecordElements)(t, true), Array);

    encoder$$1 = function (source$$1) {
      return (0, _Seq.fold)((0, _Util.uncurry)(2, (0, _Util.mapCurriedArgs)(function folder(target$$1) {
        return function (set) {
          return set(source$$1, target$$1);
        };
      }, [0, [0, 2]])), {}, setters);
    };
  } else if ((0, _Reflection.isUnion)(t, true)) {
    encoder$$1 = function (value$$19) {
      const patternInput = (0, _Reflection.getUnionFields)(value$$19, t, true);
      const matchValue = patternInput[1].length | 0;

      if (matchValue === 0) {
        return (0, _Reflection.name)(patternInput[0]);
      } else {
        const len = matchValue | 0;
        const fieldTypes = (0, _Reflection.getUnionCaseFields)(patternInput[0]);
        const target$$2 = (0, _Array.fill)(new Array(len + 1), 0, len + 1, null);
        target$$2[0] = (0, _Reflection.name)(patternInput[0]);

        for (let i = 1; i <= len; i++) {
          const encode$$2 = autoEncoder(extra$$1, isCamelCase, fieldTypes[i - 1][1]);
          target$$2[i] = encode$$2(patternInput[1][i - 1]);
        }

        return target$$2;
      }
    };
  } else {
    encoder$$1 = function (message) {
      throw new Error(message);
    }((0, _String.toText)((0, _String.printf)("Cannot generate auto encoder for %s. Please pass an extra encoder."))((0, _Reflection.fullName)(t)));
  }

  encoderRef.contents = encoder$$1;
  return encoder$$1;
}

function autoEncoder(extra$$2, isCamelCase$$1, t$$1) {
  const fullname = (0, _Reflection.fullName)(t$$1);
  const matchValue$$1 = (0, _Map.tryFind)(fullname, extra$$2);

  if (matchValue$$1 == null) {
    if ((0, _Reflection.isArray)(t$$1)) {
      const encoder$$2 = function (t$$2) {
        return autoEncoder(extra$$2, isCamelCase$$1, t$$2);
      }((0, _Reflection.getElementType)(t$$1));

      return function (value$$22) {
        return seq((0, _Seq.map)(encoder$$2, value$$22));
      };
    } else if ((0, _Reflection.isGenericType)(t$$1)) {
      if ((0, _Reflection.isTuple)(t$$1)) {
        const encoders = (0, _Array.map)(function mapping$$1(t$$3) {
          return autoEncoder(extra$$2, isCamelCase$$1, t$$3);
        }, (0, _Reflection.getTupleElements)(t$$1), Array);
        return function (value$$23) {
          return seq((0, _Seq.mapIndexed)(function mapping$$2(i$$1, x) {
            return encoders[i$$1](x);
          }, (0, _Reflection.getTupleFields)(value$$23)));
        };
      } else {
        const fullname$$1 = (0, _Reflection.fullName)((0, _Reflection.getGenericTypeDefinition)(t$$1));

        if (fullname$$1 === "Microsoft.FSharp.Core.FSharpOption`1[System.Object]") {
          const encoder$$4 = new _Util.Lazy(function () {
            return function (d) {
              return d;
            }(option(function (t$$4) {
              return autoEncoder(extra$$2, isCamelCase$$1, t$$4);
            }((0, _Reflection.getGenerics)(t$$1)[0])));
          });
          return function (value$$24) {
            return value$$24 == null ? nil : encoder$$4.Value(value$$24);
          };
        } else if (fullname$$1 === "Microsoft.FSharp.Collections.FSharpList`1[System.Object]" ? true : fullname$$1 === "Microsoft.FSharp.Collections.FSharpSet`1[System.Object]") {
          const encoder$$5 = function (t$$5) {
            return autoEncoder(extra$$2, isCamelCase$$1, t$$5);
          }((0, _Reflection.getGenerics)(t$$1)[0]);

          return function (value$$25) {
            return seq((0, _Seq.map)(encoder$$5, value$$25));
          };
        } else if (fullname$$1 === "Microsoft.FSharp.Collections.FSharpMap`2[System.Object,System.Object]") {
          const keyType = (0, _Reflection.getGenerics)(t$$1)[0];

          const valueEncoder = function (t$$6) {
            return autoEncoder(extra$$2, isCamelCase$$1, t$$6);
          }((0, _Reflection.getGenerics)(t$$1)[1]);

          if ((0, _Reflection.fullName)(keyType) === "System.String" ? true : (0, _Reflection.fullName)(keyType) === "System.Guid") {
            return function (value$$26) {
              return (0, _Seq.fold)(function folder$$1(target$$3, _arg1$$1) {
                const activePatternResult6162 = _arg1$$1;
                target$$3[activePatternResult6162[0]] = valueEncoder(activePatternResult6162[1]);
                return target$$3;
              }, {}, value$$26);
            };
          } else {
            const keyEncoder = function (t$$7) {
              const clo3 = autoEncoder(extra$$2, isCamelCase$$1, t$$7);
              return function (arg30) {
                return clo3(arg30);
              };
            }(keyType);

            return function (value$$27) {
              return seq((0, _Seq.map)(function mapping$$3(_arg2) {
                const activePatternResult6166 = _arg2;
                return [keyEncoder(activePatternResult6166[0]), valueEncoder(activePatternResult6166[1])];
              }, value$$27));
            };
          }
        } else {
          return autoEncodeRecordsAndUnions(extra$$2, isCamelCase$$1, t$$1);
        }
      }
    } else if (fullname === "System.Boolean") {
      return function (value$$28) {
        return value$$28;
      };
    } else if (fullname === "System.String") {
      return function (value$$30) {
        return value$$30;
      };
    } else if (fullname === "System.Int32") {
      return function (value$$32) {
        return value$$32;
      };
    } else if (fullname === "System.UInt32") {
      return function (value$$34) {
        return value$$34;
      };
    } else if (fullname === "System.Double") {
      return function (value$$36) {
        return value$$36;
      };
    } else if (fullname === "System.DateTime") {
      return datetime;
    } else if (fullname === "System.DateTimeOffset") {
      return datetimeOffset;
    } else if (fullname === "System.TimeSpan") {
      return timespan;
    } else if (fullname === "System.Guid") {
      return guid;
    } else if (fullname === "System.Object") {
      return function (x$$1) {
        return x$$1;
      };
    } else {
      return autoEncodeRecordsAndUnions(extra$$2, isCamelCase$$1, t$$1);
    }
  } else {
    const encoderRef$$1 = matchValue$$1;
    return function (v) {
      return encoderRef$$1.contents(v);
    };
  }
}

function makeExtra(extra$$3) {
  if (extra$$3 != null) {
    const e = extra$$3;
    return (0, _Map.map)(function (_arg2$$1, tupledArg) {
      return new _Types.FSharpRef(tupledArg[0]);
    }, e);
  } else {
    return (0, _Map.empty)({
      Compare: _Util.comparePrimitives
    });
  }
}

const Auto = (0, _Types.declare)(function Thoth_Json_Encode_Auto() {});
exports.Auto = Auto;

function Auto$reflection() {
  return (0, _Reflection.type)("Thoth.Json.Encode.Auto");
}

function Auto$$$generateEncoderCached$$4AE6C623(isCamelCase$$2, extra$$4, resolver) {
  const t$$8 = resolver.ResolveType();
  return function (d$$13) {
    return d$$13;
  }((0, _Types2.Util$002ECache$00601$$GetOrAdd$$43981464)(_Types2.Util$$$CachedEncoders, (0, _Reflection.fullName)(t$$8), function () {
    const isCamelCase$$3 = (0, _Option.defaultArg)(isCamelCase$$2, false);
    return autoEncoder(makeExtra(extra$$4), isCamelCase$$3, t$$8);
  }));
}

function Auto$$$generateEncoder$$4AE6C623(isCamelCase$$4, extra$$5, resolver$$2) {
  const isCamelCase$$5 = (0, _Option.defaultArg)(isCamelCase$$4, false);
  return function (d$$15) {
    return d$$15;
  }(autoEncoder(makeExtra(extra$$5), isCamelCase$$5, resolver$$2.ResolveType()));
}

function Auto$$$toString$$59982D9A(space$$1, value$$42, isCamelCase$$6, extra$$7, resolver$$4) {
  const encoder$$6 = Auto$$$generateEncoder$$4AE6C623(isCamelCase$$6, extra$$7, resolver$$4);
  return toString(space$$1, encoder$$6(value$$42));
}

function encode(space$$2, value$$44) {
  return toString(space$$2, value$$44);
}