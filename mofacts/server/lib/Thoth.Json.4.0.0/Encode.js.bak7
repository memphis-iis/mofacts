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
exports.sbyte = sbyte;
exports.byte$ = byte$;
exports.int16 = int16;
exports.uint16 = uint16;
exports.int64 = int64;
exports.uint64 = uint64;
exports.unit = unit;
exports.tuple2 = tuple2;
exports.tuple3 = tuple3;
exports.tuple4 = tuple4;
exports.tuple5 = tuple5;
exports.tuple6 = tuple6;
exports.tuple7 = tuple7;
exports.tuple8 = tuple8;
exports.Enum$$$byte = Enum$$$byte;
exports.Enum$$$sbyte = Enum$$$sbyte;
exports.Enum$$$int16 = Enum$$$int16;
exports.Enum$$$uint16 = Enum$$$uint16;
exports.Enum$$$int = Enum$$$int;
exports.Enum$$$uint32 = Enum$$$uint32;
exports.datetime = datetime;
exports.toString = toString;
exports.option = option;
exports.Auto$reflection = Auto$reflection;
exports.Auto$$$generateEncoderCached$$Z127D9D79 = Auto$$$generateEncoderCached$$Z127D9D79;
exports.Auto$$$generateEncoder$$Z127D9D79 = Auto$$$generateEncoder$$Z127D9D79;
exports.Auto$$$toString$$5A41365E = Auto$$$toString$$5A41365E;
exports.encode = encode;
exports.Auto = exports.nil = void 0;

var _Seq = require("../fable-library.2.10.2/Seq");

var _Map = require("../fable-library.2.10.2/Map");

var _Date = require("../fable-library.2.10.2/Date");

var _TimeSpan = require("../fable-library.2.10.2/TimeSpan");

var _Util = require("../fable-library.2.10.2/Util");

var _Option = require("../fable-library.2.10.2/Option");

var _Types = require("../fable-library.2.10.2/Types");

var _Reflection = require("../fable-library.2.10.2/Reflection");

var _Types2 = require("./Types");

var _Array = require("../fable-library.2.10.2/Array");

var _String = require("../fable-library.2.10.2/String");

function guid(value) {
  return value;
}

function decimal(value$$1) {
  const value$$2 = String(value$$1);
  return value$$2;
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
  let values$$4;
  values$$4 = (0, _Map.toList)(values$$3);
  return object(values$$4);
}

function bigint(value$$5) {
  return String(value$$5);
}

function datetimeOffset(value$$6) {
  const value$$7 = (0, _Date.toString)(value$$6, "O", {});
  return value$$7;
}

function timespan(value$$9) {
  const value$$10 = (0, _TimeSpan.toString)(value$$9);
  return value$$10;
}

function sbyte(value$$12) {
  return String(value$$12);
}

function byte$(value$$13) {
  return String(value$$13);
}

function int16(value$$14) {
  return String(value$$14);
}

function uint16(value$$15) {
  return String(value$$15);
}

function int64(value$$16) {
  return String(value$$16);
}

function uint64(value$$17) {
  return String(value$$17);
}

function unit() {
  return null;
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

function Enum$$$byte(value$$18) {
  return byte$(value$$18);
}

function Enum$$$sbyte(value$$20) {
  return sbyte(value$$20);
}

function Enum$$$int16(value$$22) {
  return int16(value$$22);
}

function Enum$$$uint16(value$$24) {
  return uint16(value$$24);
}

function Enum$$$int(value$$26) {
  return value$$26;
}

function Enum$$$uint32(value$$29) {
  return value$$29;
}

function datetime(value$$32) {
  const value$$33 = (0, _Date.toString)(value$$32, "O", {});
  return value$$33;
}

function toString(space, value$$35) {
  return JSON.stringify(value$$35, (0, _Util.uncurry)(2, null), (0, _Option.some)(space));
}

function option(encoder) {
  return function ($arg$$1) {
    let option$$2;
    option$$2 = (0, _Option.map)(encoder, $arg$$1);
    return (0, _Option.defaultArgWith)(option$$2, function defThunk() {
      return nil;
    });
  };
}

function autoEncodeRecordsAndUnions(extra, caseStrategy, skipNullField, t) {
  const encoderRef = new _Types.FSharpRef(null);
  let extra$$1;
  const key$$1 = (0, _Reflection.fullName)(t);
  extra$$1 = (0, _Map.add)(key$$1, encoderRef, extra);
  let encoder$$1;

  if ((0, _Reflection.isRecord)(t, true)) {
    let setters;
    const array$$1 = (0, _Reflection.getRecordElements)(t, true);
    setters = (0, _Array.map)(function mapping(fi) {
      const targetKey = (0, _Types2.Util$002ECasing$$$convert)(caseStrategy, (0, _Reflection.name)(fi));
      const encode$$1 = autoEncoder(extra$$1, caseStrategy, skipNullField, fi[1]);
      return function (source) {
        return function (target) {
          const value$$36 = (0, _Reflection.getRecordField)(source, fi);

          if (!skipNullField ? true : skipNullField ? !(value$$36 == null) : false) {
            target[targetKey] = encode$$1(value$$36);
          } else {
            void null;
          }

          return target;
        };
      };
    }, array$$1, Array);

    encoder$$1 = function (source$$1) {
      const state = {};
      return (0, _Seq.fold)((0, _Util.uncurry)(2, (0, _Util.mapCurriedArgs)(function folder(target$$1) {
        return function (set) {
          return set(source$$1, target$$1);
        };
      }, [0, [0, 2]])), state, setters);
    };
  } else if ((0, _Reflection.isUnion)(t, true)) {
    encoder$$1 = function (value$$37) {
      const patternInput = (0, _Reflection.getUnionFields)(value$$37, t, true);
      const matchValue = patternInput[1].length | 0;

      if (matchValue === 0) {
        const value$$38 = (0, _Reflection.name)(patternInput[0]);
        return value$$38;
      } else {
        const fieldTypes = (0, _Reflection.getUnionCaseFields)(patternInput[0]);
        const target$$2 = (0, _Array.fill)(new Array(matchValue + 1), 0, matchValue + 1, null);
        const value$$39 = (0, _Reflection.name)(patternInput[0]);
        target$$2[0] = value$$39;

        for (let i = 1; i <= matchValue; i++) {
          const encode$$2 = autoEncoder(extra$$1, caseStrategy, skipNullField, fieldTypes[i - 1][1]);
          target$$2[i] = encode$$2(patternInput[1][i - 1]);
        }

        return target$$2;
      }
    };
  } else {
    let message;
    const arg10 = (0, _Reflection.fullName)(t);
    const clo1 = (0, _String.toText)((0, _String.printf)("Cannot generate auto encoder for %s. Please pass an extra encoder."));
    message = clo1(arg10);
    throw new Error(message);
  }

  encoderRef.contents = encoder$$1;
  return encoder$$1;
}

function autoEncoder(extra$$2, caseStrategy$$1, skipNullField$$1, t$$1) {
  var clo1$$1;
  const fullname = (0, _Reflection.fullName)(t$$1);
  const matchValue$$1 = (0, _Map.tryFind)(fullname, extra$$2);

  if (matchValue$$1 == null) {
    if ((0, _Reflection.isArray)(t$$1)) {
      let encoder$$2;
      const t$$2 = (0, _Reflection.getElementType)(t$$1);
      encoder$$2 = autoEncoder(extra$$2, caseStrategy$$1, skipNullField$$1, t$$2);
      return function (value$$40) {
        let values$$6;
        values$$6 = (0, _Seq.map)(encoder$$2, value$$40);
        return seq(values$$6);
      };
    } else if ((0, _Reflection.isEnum)(t$$1)) {
      const enumType = (0, _Reflection.fullName)((0, _Reflection.getEnumUnderlyingType)(t$$1));

      if (enumType === "System.SByte") {
        return sbyte;
      } else if (enumType === "System.Byte") {
        return byte$;
      } else if (enumType === "System.Int16") {
        return int16;
      } else if (enumType === "System.UInt16") {
        return uint16;
      } else if (enumType === "System.Int32") {
        return function d$$4(value$$45) {
          return value$$45;
        };
      } else if (enumType === "System.UInt32") {
        return function d$$5(value$$47) {
          return value$$47;
        };
      } else {
        return (clo1$$1 = (0, _String.toFail)((0, _String.printf)("Cannot generate auto encoder for %s.\nThoth.Json.Net only support the folluwing enum types:\n- sbyte\n- byte\n- int16\n- uint16\n- int\n- uint32\nIf you can't use one of these types, please pass an extra encoder.\n                    ")), function (arg10$$1) {
          const clo2 = clo1$$1(arg10$$1);
          return function (arg20) {
            return clo2(arg20);
          };
        })((0, _Reflection.fullName)(t$$1));
      }
    } else if ((0, _Reflection.isGenericType)(t$$1)) {
      if ((0, _Reflection.isTuple)(t$$1)) {
        let encoders;
        const array$$2 = (0, _Reflection.getTupleElements)(t$$1);
        encoders = (0, _Array.map)(function mapping$$1(t$$3) {
          return autoEncoder(extra$$2, caseStrategy$$1, skipNullField$$1, t$$3);
        }, array$$2, Array);
        return function (value$$49) {
          let values$$7;
          const source$$4 = (0, _Reflection.getTupleFields)(value$$49);
          values$$7 = (0, _Seq.mapIndexed)(function mapping$$2(i$$1, x) {
            return encoders[i$$1](x);
          }, source$$4);
          return seq(values$$7);
        };
      } else {
        const fullname$$1 = (0, _Reflection.fullName)((0, _Reflection.getGenericTypeDefinition)(t$$1));

        if (fullname$$1 === "Microsoft.FSharp.Core.FSharpOption`1[System.Object]") {
          const encoder$$4 = new _Util.Lazy(function () {
            let d$$6;
            let encoder$$3;
            const t$$4 = (0, _Reflection.getGenerics)(t$$1)[0];
            encoder$$3 = autoEncoder(extra$$2, caseStrategy$$1, skipNullField$$1, t$$4);
            d$$6 = option(encoder$$3);
            return d$$6;
          });
          return function d$$8(value$$50) {
            if (value$$50 == null) {
              return nil;
            } else {
              return encoder$$4.Value(value$$50);
            }
          };
        } else if (fullname$$1 === "Microsoft.FSharp.Collections.FSharpList`1[System.Object]" ? true : fullname$$1 === "Microsoft.FSharp.Collections.FSharpSet`1[System.Object]") {
          let encoder$$5;
          const t$$5 = (0, _Reflection.getGenerics)(t$$1)[0];
          encoder$$5 = autoEncoder(extra$$2, caseStrategy$$1, skipNullField$$1, t$$5);
          return function (value$$51) {
            let values$$8;
            values$$8 = (0, _Seq.map)(encoder$$5, value$$51);
            return seq(values$$8);
          };
        } else if (fullname$$1 === "Microsoft.FSharp.Collections.FSharpMap`2[System.Object,System.Object]") {
          const keyType = (0, _Reflection.getGenerics)(t$$1)[0];
          let valueEncoder;
          const t$$6 = (0, _Reflection.getGenerics)(t$$1)[1];
          valueEncoder = autoEncoder(extra$$2, caseStrategy$$1, skipNullField$$1, t$$6);

          if ((0, _Reflection.fullName)(keyType) === "System.String" ? true : (0, _Reflection.fullName)(keyType) === "System.Guid") {
            return function (value$$52) {
              const state$$1 = {};
              return (0, _Seq.fold)(function folder$$1(target$$3, _arg1$$1) {
                const activePatternResult6813 = _arg1$$1;
                target$$3[activePatternResult6813[0]] = valueEncoder(activePatternResult6813[1]);
                return target$$3;
              }, state$$1, value$$52);
            };
          } else {
            let keyEncoder;
            const clo4 = autoEncoder(extra$$2, caseStrategy$$1, skipNullField$$1, keyType);

            keyEncoder = function (arg40) {
              return clo4(arg40);
            };

            return function (value$$53) {
              let values$$10;
              values$$10 = (0, _Seq.map)(function mapping$$3(_arg2) {
                const activePatternResult6817 = _arg2;
                const values$$9 = [keyEncoder(activePatternResult6817[0]), valueEncoder(activePatternResult6817[1])];
                return values$$9;
              }, value$$53);
              return seq(values$$10);
            };
          }
        } else {
          return autoEncodeRecordsAndUnions(extra$$2, caseStrategy$$1, skipNullField$$1, t$$1);
        }
      }
    } else if (fullname === "System.Boolean") {
      return function d$$9(value$$54) {
        return value$$54;
      };
    } else if (fullname === "Microsoft.FSharp.Core.Unit") {
      return function d$$10() {
        return unit();
      };
    } else if (fullname === "System.String") {
      return function d$$11(value$$56) {
        return value$$56;
      };
    } else if (fullname === "System.SByte") {
      return sbyte;
    } else if (fullname === "System.Byte") {
      return byte$;
    } else if (fullname === "System.Int16") {
      return int16;
    } else if (fullname === "System.UInt16") {
      return uint16;
    } else if (fullname === "System.Int32") {
      return function d$$16(value$$62) {
        return value$$62;
      };
    } else if (fullname === "System.UInt32") {
      return function d$$17(value$$64) {
        return value$$64;
      };
    } else if (fullname === "System.Double") {
      return function d$$18(value$$66) {
        return value$$66;
      };
    } else if (fullname === "System.Single") {
      return function d$$19(value$$68) {
        return value$$68;
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
      return function d$$24(x$$1) {
        return x$$1;
      };
    } else {
      return autoEncodeRecordsAndUnions(extra$$2, caseStrategy$$1, skipNullField$$1, t$$1);
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
    }, e.Coders);
  } else {
    return (0, _Map.empty)({
      Compare: _Util.comparePrimitives
    });
  }
}

const Auto = (0, _Types.declare)(function Thoth_Json_Encode_Auto() {});
exports.Auto = Auto;

function Auto$reflection() {
  return (0, _Reflection.class_type)("Thoth.Json.Encode.Auto", undefined, Auto);
}

function Auto$$$generateEncoderCached$$Z127D9D79(caseStrategy$$2, extra$$4, skipNullField$$2, resolver) {
  const t$$8 = resolver.ResolveType();
  const caseStrategy$$3 = (0, _Option.defaultArg)(caseStrategy$$2, new _Types2.CaseStrategy(0, "PascalCase"));
  const skipNullField$$3 = (0, _Option.defaultArg)(skipNullField$$2, true);
  let key$$2;
  let y$$1;
  const y = (0, _Reflection.fullName)(t$$8);
  const x$$2 = String(caseStrategy$$3);
  y$$1 = x$$2 + y;
  let x$$3;
  let option$$4;
  option$$4 = (0, _Option.map)(function mapping$$4(e$$1) {
    return e$$1.Hash;
  }, extra$$4);
  x$$3 = (0, _Option.defaultArg)(option$$4, "");
  key$$2 = x$$3 + y$$1;
  const d$$25 = (0, _Types2.Util$002ECache$00601$$GetOrAdd$$43981464)(_Types2.Util$$$CachedEncoders, key$$2, function () {
    return autoEncoder(makeExtra(extra$$4), caseStrategy$$3, skipNullField$$3, t$$8);
  });
  return d$$25;
}

function Auto$$$generateEncoder$$Z127D9D79(caseStrategy$$4, extra$$5, skipNullField$$4, resolver$$2) {
  const caseStrategy$$5 = (0, _Option.defaultArg)(caseStrategy$$4, new _Types2.CaseStrategy(0, "PascalCase"));
  const skipNullField$$5 = (0, _Option.defaultArg)(skipNullField$$4, true);
  let d$$27;
  const t$$9 = resolver$$2.ResolveType();
  const extra$$6 = makeExtra(extra$$5);
  d$$27 = autoEncoder(extra$$6, caseStrategy$$5, skipNullField$$5, t$$9);
  return d$$27;
}

function Auto$$$toString$$5A41365E(space$$1, value$$75, caseStrategy$$6, extra$$7, skipNullField$$6, resolver$$4) {
  const encoder$$6 = Auto$$$generateEncoder$$Z127D9D79(caseStrategy$$6, extra$$7, skipNullField$$6, resolver$$4);
  const value$$76 = encoder$$6(value$$75);
  return toString(space$$1, value$$76);
}

function encode(space$$2, value$$77) {
  return toString(space$$2, value$$77);
}