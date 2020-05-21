"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Helpers$$$isUndefined = Helpers$$$isUndefined;
exports.fromValue = fromValue;
exports.fromString = fromString;
exports.unsafeFromString = unsafeFromString;
exports.decodeValue = decodeValue;
exports.decodeString = decodeString;
exports.string = string;
exports.guid = guid;
exports.unit = unit;
exports.sbyte = sbyte;
exports.byte$ = byte$;
exports.int16 = int16;
exports.uint16 = uint16;
exports.int$ = int$;
exports.uint32 = uint32;
exports.bigint = bigint;
exports.bool = bool;
exports.float$ = float$;
exports.float32 = float32;
exports.decimal = decimal;
exports.datetime = datetime;
exports.datetimeOffset = datetimeOffset;
exports.timespan = timespan;
exports.optional = optional;
exports.optionalAt = optionalAt;
exports.field = field;
exports.at = at;
exports.index = index;
exports.option = option;
exports.list = list;
exports.seq = seq;
exports.array = array;
exports.keyValuePairs = keyValuePairs;
exports.oneOf = oneOf;
exports.nil = nil;
exports.value = value;
exports.succeed = succeed;
exports.fail = fail;
exports.andThen = andThen;
exports.map = map;
exports.map2 = map2;
exports.map3 = map3;
exports.map4 = map4;
exports.map5 = map5;
exports.map6 = map6;
exports.map7 = map7;
exports.map8 = map8;
exports.dict = dict;
exports.Getters$00601$reflection = Getters$00601$reflection;
exports.Getters$00601$$$$002Ector$$4A51B60E = Getters$00601$$$$002Ector$$4A51B60E;
exports.Getters$00601$$get_Errors = Getters$00601$$get_Errors;
exports.object = object;
exports.tuple2 = tuple2;
exports.tuple3 = tuple3;
exports.tuple4 = tuple4;
exports.tuple5 = tuple5;
exports.tuple6 = tuple6;
exports.tuple7 = tuple7;
exports.tuple8 = tuple8;
exports.Auto$reflection = Auto$reflection;
exports.Auto$$$generateDecoderCached$$7848D058 = Auto$$$generateDecoderCached$$7848D058;
exports.Auto$$$generateDecoder$$7848D058 = Auto$$$generateDecoder$$7848D058;
exports.Auto$$$fromString$$Z5CB6BD = Auto$$$fromString$$Z5CB6BD;
exports.Auto$$$unsafeFromString$$Z5CB6BD = Auto$$$unsafeFromString$$Z5CB6BD;
exports.Auto = exports.Getters$00601 = exports.uint64 = exports.int64 = void 0;

var _String = require("../fable-library.2.8.4/String");

var _Util = require("../fable-library.2.8.4/Util");

var _Option = require("../fable-library.2.8.4/Option");

var _Types = require("./Types");

var _Int = require("../fable-library.2.8.4/Int32");

var _Long = require("../fable-library.2.8.4/Long");

var _BigInt = require("../fable-library.2.8.4/BigInt");

var _Decimal = _interopRequireWildcard(require("../fable-library.2.8.4/Decimal"));

var _Date = require("../fable-library.2.8.4/Date");

var _DateOffset = require("../fable-library.2.8.4/DateOffset");

var _TimeSpan = require("../fable-library.2.8.4/TimeSpan");

var _Types2 = require("../fable-library.2.8.4/Types");

var _List = require("../fable-library.2.8.4/List");

var _Array = require("../fable-library.2.8.4/Array");

var _Seq = require("../fable-library.2.8.4/Seq");

var _Map = require("../fable-library.2.8.4/Map");

var _Reflection = require("../fable-library.2.8.4/Reflection");

var _Set = require("../fable-library.2.8.4/Set");

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : {}; if (desc.get || desc.set) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } } newObj.default = obj; return newObj; } }

function Helpers$$$isUndefined(o) {
  return typeof o === "undefined";
}

function genericMsg(msg, value$$1, newLine) {
  try {
    return "Expecting " + msg + " but instead got:" + (newLine ? "\n" : " ") + (JSON.stringify(value$$1, null, 4) + "");
  } catch (matchValue) {
    return "Expecting " + msg + " but decoder failed. Couldn't report given value due to circular structure." + (newLine ? "\n" : " ");
  }
}

function errorToString(path, error) {
  const reason$$1 = error.tag === 2 ? genericMsg(error.fields[0], error.fields[1], true) : error.tag === 1 ? genericMsg(error.fields[0], error.fields[1], false) + "\nReason: " + error.fields[2] : error.tag === 3 ? genericMsg(error.fields[0], error.fields[1], true) : error.tag === 4 ? genericMsg(error.fields[0], error.fields[1], true) + ("\nNode `" + error.fields[2] + "` is unkown.") : error.tag === 5 ? "Expecting " + error.fields[0] + ".\n" + (JSON.stringify(error.fields[1], null, 4) + "") : error.tag === 7 ? "The following errors were found:\n\n" + (0, _String.join)("\n\n", error.fields[0]) : error.tag === 6 ? "The following `failure` occurred with the decoder: " + error.fields[0] : genericMsg(error.fields[0], error.fields[1], false);

  if (error.tag === 7) {
    return reason$$1;
  } else {
    return "Error at: `" + path + "`\n" + reason$$1;
  }
}

function fromValue(path$$1, decoder, value$$8) {
  let matchValue$$1;
  const clo1 = (0, _Util.partialApply)(1, decoder, [path$$1]);
  matchValue$$1 = clo1(value$$8);

  if (matchValue$$1.tag === 1) {
    return new _Option.Result(1, "Error", errorToString(matchValue$$1.fields[0][0], matchValue$$1.fields[0][1]));
  } else {
    return new _Option.Result(0, "Ok", matchValue$$1.fields[0]);
  }
}

function fromString(decoder$$1, value$$9) {
  try {
    const json = JSON.parse(value$$9);
    return fromValue("$", decoder$$1, json);
  } catch (matchValue$$2) {
    if (matchValue$$2 instanceof SyntaxError) {
      return new _Option.Result(1, "Error", "Given an invalid JSON: " + matchValue$$2.message);
    } else {
      throw matchValue$$2;
    }
  }
}

function unsafeFromString(decoder$$2, value$$10) {
  const matchValue$$3 = fromString(decoder$$2, value$$10);

  if (matchValue$$3.tag === 1) {
    throw new Error(matchValue$$3.fields[0]);
  } else {
    return matchValue$$3.fields[0];
  }
}

function decodeValue(path$$3, decoder$$3) {
  return function (value$$11) {
    return fromValue(path$$3, decoder$$3, value$$11);
  };
}

function decodeString(decoder$$5) {
  return function (value$$12) {
    return fromString(decoder$$5, value$$12);
  };
}

function string(path$$4, value$$13) {
  if (typeof value$$13 === "string") {
    return new _Option.Result(0, "Ok", value$$13);
  } else {
    const arg0 = [path$$4, new _Types.ErrorReason(0, "BadPrimitive", "a string", value$$13)];
    return new _Option.Result(1, "Error", arg0);
  }
}

function guid(path$$5, value$$14) {
  if (typeof value$$14 === "string") {
    const matchValue$$4 = (0, _String.validateGuid)(value$$14, true);

    if (matchValue$$4[0]) {
      return new _Option.Result(0, "Ok", matchValue$$4[1]);
    } else {
      const arg0$$1 = [path$$5, new _Types.ErrorReason(0, "BadPrimitive", "a guid", value$$14)];
      return new _Option.Result(1, "Error", arg0$$1);
    }
  } else {
    const arg0$$2 = [path$$5, new _Types.ErrorReason(0, "BadPrimitive", "a guid", value$$14)];
    return new _Option.Result(1, "Error", arg0$$2);
  }
}

function unit(path$$6, value$$15) {
  if (value$$15 == null) {
    return new _Option.Result(0, "Ok", null);
  } else {
    const arg0$$3 = [path$$6, new _Types.ErrorReason(0, "BadPrimitive", "null", value$$15)];
    return new _Option.Result(1, "Error", arg0$$3);
  }
}

function sbyte(path$$7) {
  return function (value$$17) {
    if (typeof value$$17 === "number") {
      const value$$19 = value$$17;

      if (isFinite(value$$19) && Math.floor(value$$19) === value$$19) {
        if (-128 <= value$$19 ? value$$19 <= 127 : false) {
          return new _Option.Result(0, "Ok", ((value$$19 + 0x80 & 0xFF) - 0x80));
        } else {
          const arg0$$4 = [path$$7, new _Types.ErrorReason(1, "BadPrimitiveExtra", "a sbyte", value$$19, "Value was either too large or too small for a sbyte")];
          return new _Option.Result(1, "Error", arg0$$4);
        }
      } else {
        const arg0$$5 = [path$$7, new _Types.ErrorReason(1, "BadPrimitiveExtra", "a sbyte", value$$19, "Value is not an integral value")];
        return new _Option.Result(1, "Error", arg0$$5);
      }
    } else if (typeof value$$17 === "string") {
      let matchValue$$5;
      const arg00$$1 = value$$17;
      matchValue$$5 = (0, _Int.tryParse)(arg00$$1, 511, false, 8);

      if (matchValue$$5[0]) {
        return new _Option.Result(0, "Ok", matchValue$$5[1]);
      } else {
        const arg0$$6 = [path$$7, new _Types.ErrorReason(0, "BadPrimitive", "a sbyte", value$$17)];
        return new _Option.Result(1, "Error", arg0$$6);
      }
    } else {
      const arg0$$7 = [path$$7, new _Types.ErrorReason(0, "BadPrimitive", "a sbyte", value$$17)];
      return new _Option.Result(1, "Error", arg0$$7);
    }
  };
}

function byte$(path$$9) {
  return function (value$$21) {
    if (typeof value$$21 === "number") {
      const value$$23 = value$$21;

      if (isFinite(value$$23) && Math.floor(value$$23) === value$$23) {
        if (0 <= value$$23 ? value$$23 <= 255 : false) {
          return new _Option.Result(0, "Ok", (value$$23 & 0xFF));
        } else {
          const arg0$$8 = [path$$9, new _Types.ErrorReason(1, "BadPrimitiveExtra", "a byte", value$$23, "Value was either too large or too small for a byte")];
          return new _Option.Result(1, "Error", arg0$$8);
        }
      } else {
        const arg0$$9 = [path$$9, new _Types.ErrorReason(1, "BadPrimitiveExtra", "a byte", value$$23, "Value is not an integral value")];
        return new _Option.Result(1, "Error", arg0$$9);
      }
    } else if (typeof value$$21 === "string") {
      let matchValue$$6;
      const arg00$$2 = value$$21;
      matchValue$$6 = (0, _Int.tryParse)(arg00$$2, 511, true, 8);

      if (matchValue$$6[0]) {
        return new _Option.Result(0, "Ok", matchValue$$6[1]);
      } else {
        const arg0$$10 = [path$$9, new _Types.ErrorReason(0, "BadPrimitive", "a byte", value$$21)];
        return new _Option.Result(1, "Error", arg0$$10);
      }
    } else {
      const arg0$$11 = [path$$9, new _Types.ErrorReason(0, "BadPrimitive", "a byte", value$$21)];
      return new _Option.Result(1, "Error", arg0$$11);
    }
  };
}

function int16(path$$11) {
  return function (value$$25) {
    if (typeof value$$25 === "number") {
      const value$$27 = value$$25;

      if (isFinite(value$$27) && Math.floor(value$$27) === value$$27) {
        if (-32768 <= value$$27 ? value$$27 <= 32767 : false) {
          return new _Option.Result(0, "Ok", ((value$$27 + 0x8000 & 0xFFFF) - 0x8000));
        } else {
          const arg0$$12 = [path$$11, new _Types.ErrorReason(1, "BadPrimitiveExtra", "an int16", value$$27, "Value was either too large or too small for an int16")];
          return new _Option.Result(1, "Error", arg0$$12);
        }
      } else {
        const arg0$$13 = [path$$11, new _Types.ErrorReason(1, "BadPrimitiveExtra", "an int16", value$$27, "Value is not an integral value")];
        return new _Option.Result(1, "Error", arg0$$13);
      }
    } else if (typeof value$$25 === "string") {
      let matchValue$$7;
      const arg00$$3 = value$$25;
      matchValue$$7 = (0, _Int.tryParse)(arg00$$3, 511, false, 16);

      if (matchValue$$7[0]) {
        return new _Option.Result(0, "Ok", matchValue$$7[1]);
      } else {
        const arg0$$14 = [path$$11, new _Types.ErrorReason(0, "BadPrimitive", "an int16", value$$25)];
        return new _Option.Result(1, "Error", arg0$$14);
      }
    } else {
      const arg0$$15 = [path$$11, new _Types.ErrorReason(0, "BadPrimitive", "an int16", value$$25)];
      return new _Option.Result(1, "Error", arg0$$15);
    }
  };
}

function uint16(path$$13) {
  return function (value$$29) {
    if (typeof value$$29 === "number") {
      const value$$31 = value$$29;

      if (isFinite(value$$31) && Math.floor(value$$31) === value$$31) {
        if (0 <= value$$31 ? value$$31 <= 65535 : false) {
          return new _Option.Result(0, "Ok", (value$$31 & 0xFFFF));
        } else {
          const arg0$$16 = [path$$13, new _Types.ErrorReason(1, "BadPrimitiveExtra", "an uint16", value$$31, "Value was either too large or too small for an uint16")];
          return new _Option.Result(1, "Error", arg0$$16);
        }
      } else {
        const arg0$$17 = [path$$13, new _Types.ErrorReason(1, "BadPrimitiveExtra", "an uint16", value$$31, "Value is not an integral value")];
        return new _Option.Result(1, "Error", arg0$$17);
      }
    } else if (typeof value$$29 === "string") {
      let matchValue$$8;
      const arg00$$4 = value$$29;
      matchValue$$8 = (0, _Int.tryParse)(arg00$$4, 511, true, 16);

      if (matchValue$$8[0]) {
        return new _Option.Result(0, "Ok", matchValue$$8[1]);
      } else {
        const arg0$$18 = [path$$13, new _Types.ErrorReason(0, "BadPrimitive", "an uint16", value$$29)];
        return new _Option.Result(1, "Error", arg0$$18);
      }
    } else {
      const arg0$$19 = [path$$13, new _Types.ErrorReason(0, "BadPrimitive", "an uint16", value$$29)];
      return new _Option.Result(1, "Error", arg0$$19);
    }
  };
}

function int$(path$$15) {
  return function (value$$33) {
    if (typeof value$$33 === "number") {
      const value$$35 = value$$33;

      if (isFinite(value$$35) && Math.floor(value$$35) === value$$35) {
        if (-2147483648 <= value$$35 ? value$$35 <= 2147483647 : false) {
          return new _Option.Result(0, "Ok", (~~value$$35));
        } else {
          const arg0$$20 = [path$$15, new _Types.ErrorReason(1, "BadPrimitiveExtra", "an int", value$$35, "Value was either too large or too small for an int")];
          return new _Option.Result(1, "Error", arg0$$20);
        }
      } else {
        const arg0$$21 = [path$$15, new _Types.ErrorReason(1, "BadPrimitiveExtra", "an int", value$$35, "Value is not an integral value")];
        return new _Option.Result(1, "Error", arg0$$21);
      }
    } else if (typeof value$$33 === "string") {
      let matchValue$$9;
      const arg00$$5 = value$$33;
      matchValue$$9 = (0, _Int.tryParse)(arg00$$5, 511, false, 32);

      if (matchValue$$9[0]) {
        return new _Option.Result(0, "Ok", matchValue$$9[1]);
      } else {
        const arg0$$22 = [path$$15, new _Types.ErrorReason(0, "BadPrimitive", "an int", value$$33)];
        return new _Option.Result(1, "Error", arg0$$22);
      }
    } else {
      const arg0$$23 = [path$$15, new _Types.ErrorReason(0, "BadPrimitive", "an int", value$$33)];
      return new _Option.Result(1, "Error", arg0$$23);
    }
  };
}

function uint32(path$$17) {
  return function (value$$37) {
    if (typeof value$$37 === "number") {
      const value$$39 = value$$37;

      if (isFinite(value$$39) && Math.floor(value$$39) === value$$39) {
        if (0 <= value$$39 ? value$$39 <= 4294967295 : false) {
          return new _Option.Result(0, "Ok", (value$$39 >>> 0));
        } else {
          const arg0$$24 = [path$$17, new _Types.ErrorReason(1, "BadPrimitiveExtra", "an uint32", value$$39, "Value was either too large or too small for an uint32")];
          return new _Option.Result(1, "Error", arg0$$24);
        }
      } else {
        const arg0$$25 = [path$$17, new _Types.ErrorReason(1, "BadPrimitiveExtra", "an uint32", value$$39, "Value is not an integral value")];
        return new _Option.Result(1, "Error", arg0$$25);
      }
    } else if (typeof value$$37 === "string") {
      let matchValue$$10;
      const arg00$$6 = value$$37;
      matchValue$$10 = (0, _Int.tryParse)(arg00$$6, 511, true, 32);

      if (matchValue$$10[0]) {
        return new _Option.Result(0, "Ok", matchValue$$10[1]);
      } else {
        const arg0$$26 = [path$$17, new _Types.ErrorReason(0, "BadPrimitive", "an uint32", value$$37)];
        return new _Option.Result(1, "Error", arg0$$26);
      }
    } else {
      const arg0$$27 = [path$$17, new _Types.ErrorReason(0, "BadPrimitive", "an uint32", value$$37)];
      return new _Option.Result(1, "Error", arg0$$27);
    }
  };
}

const int64 = (() => {
  const min$$12 = (0, _Long.fromBits)(0, 2147483648, false);
  const max$$12 = (0, _Long.fromBits)(4294967295, 2147483647, false);
  return function (path$$19) {
    return function (value$$41) {
      if (typeof value$$41 === "number") {
        const value$$43 = value$$41;

        if (isFinite(value$$43) && Math.floor(value$$43) === value$$43) {
          if ((0, _Long.toNumber)(min$$12) <= value$$43 ? value$$43 <= (0, _Long.toNumber)(max$$12) : false) {
            return new _Option.Result(0, "Ok", ((0, _Long.fromNumber)(value$$43, false)));
          } else {
            const arg0$$28 = [path$$19, new _Types.ErrorReason(1, "BadPrimitiveExtra", "an int64", value$$43, "Value was either too large or too small for an int64")];
            return new _Option.Result(1, "Error", arg0$$28);
          }
        } else {
          const arg0$$29 = [path$$19, new _Types.ErrorReason(1, "BadPrimitiveExtra", "an int64", value$$43, "Value is not an integral value")];
          return new _Option.Result(1, "Error", arg0$$29);
        }
      } else if (typeof value$$41 === "string") {
        let matchValue$$11;
        const arg00$$7 = value$$41;
        matchValue$$11 = (0, _Long.tryParse)(arg00$$7, 511, false, 64);

        if (matchValue$$11[0]) {
          return new _Option.Result(0, "Ok", matchValue$$11[1]);
        } else {
          const arg0$$30 = [path$$19, new _Types.ErrorReason(0, "BadPrimitive", "an int64", value$$41)];
          return new _Option.Result(1, "Error", arg0$$30);
        }
      } else {
        const arg0$$31 = [path$$19, new _Types.ErrorReason(0, "BadPrimitive", "an int64", value$$41)];
        return new _Option.Result(1, "Error", arg0$$31);
      }
    };
  };
})();

exports.int64 = int64;

const uint64 = (() => {
  const min$$14 = (0, _Long.fromBits)(0, 0, true);
  const max$$14 = (0, _Long.fromBits)(4294967295, 4294967295, true);
  return function (path$$21) {
    return function (value$$45) {
      if (typeof value$$45 === "number") {
        const value$$47 = value$$45;

        if (isFinite(value$$47) && Math.floor(value$$47) === value$$47) {
          if ((0, _Long.toNumber)(min$$14) <= value$$47 ? value$$47 <= (0, _Long.toNumber)(max$$14) : false) {
            return new _Option.Result(0, "Ok", ((0, _Long.fromNumber)(value$$47, true)));
          } else {
            const arg0$$32 = [path$$21, new _Types.ErrorReason(1, "BadPrimitiveExtra", "an uint64", value$$47, "Value was either too large or too small for an uint64")];
            return new _Option.Result(1, "Error", arg0$$32);
          }
        } else {
          const arg0$$33 = [path$$21, new _Types.ErrorReason(1, "BadPrimitiveExtra", "an uint64", value$$47, "Value is not an integral value")];
          return new _Option.Result(1, "Error", arg0$$33);
        }
      } else if (typeof value$$45 === "string") {
        let matchValue$$12;
        const arg00$$8 = value$$45;
        matchValue$$12 = (0, _Long.tryParse)(arg00$$8, 511, true, 64);

        if (matchValue$$12[0]) {
          return new _Option.Result(0, "Ok", matchValue$$12[1]);
        } else {
          const arg0$$34 = [path$$21, new _Types.ErrorReason(0, "BadPrimitive", "an uint64", value$$45)];
          return new _Option.Result(1, "Error", arg0$$34);
        }
      } else {
        const arg0$$35 = [path$$21, new _Types.ErrorReason(0, "BadPrimitive", "an uint64", value$$45)];
        return new _Option.Result(1, "Error", arg0$$35);
      }
    };
  };
})();

exports.uint64 = uint64;

function bigint(path$$23, value$$48) {
  if (typeof value$$48 === "number") {
    let arg0$$36;
    const arg00$$9 = value$$48 | 0;
    arg0$$36 = (0, _BigInt.fromInt32)(arg00$$9);
    return new _Option.Result(0, "Ok", arg0$$36);
  } else if (typeof value$$48 === "string") {
    try {
      const arg0$$37 = (0, _BigInt.parse)(value$$48);
      return new _Option.Result(0, "Ok", arg0$$37);
    } catch (matchValue$$13) {
      const arg0$$38 = [path$$23, new _Types.ErrorReason(0, "BadPrimitive", "a bigint", value$$48)];
      return new _Option.Result(1, "Error", arg0$$38);
    }
  } else {
    const arg0$$39 = [path$$23, new _Types.ErrorReason(0, "BadPrimitive", "a bigint", value$$48)];
    return new _Option.Result(1, "Error", arg0$$39);
  }
}

function bool(path$$24, value$$49) {
  if (typeof value$$49 === "boolean") {
    return new _Option.Result(0, "Ok", value$$49);
  } else {
    const arg0$$40 = [path$$24, new _Types.ErrorReason(0, "BadPrimitive", "a boolean", value$$49)];
    return new _Option.Result(1, "Error", arg0$$40);
  }
}

function float$(path$$25, value$$50) {
  if (typeof value$$50 === "number") {
    return new _Option.Result(0, "Ok", value$$50);
  } else {
    const arg0$$41 = [path$$25, new _Types.ErrorReason(0, "BadPrimitive", "a float", value$$50)];
    return new _Option.Result(1, "Error", arg0$$41);
  }
}

function float32(path$$26, value$$51) {
  if (typeof value$$51 === "number") {
    return new _Option.Result(0, "Ok", value$$51);
  } else {
    const arg0$$42 = [path$$26, new _Types.ErrorReason(0, "BadPrimitive", "a float32", value$$51)];
    return new _Option.Result(1, "Error", arg0$$42);
  }
}

function decimal(path$$27, value$$52) {
  if (typeof value$$52 === "number") {
    let arg0$$43;
    const value$$53 = value$$52;
    arg0$$43 = new _Decimal.default(value$$53);
    return new _Option.Result(0, "Ok", arg0$$43);
  } else if (typeof value$$52 === "string") {
    const matchValue$$14 = (0, _Decimal.tryParse)(value$$52);

    if (matchValue$$14[0]) {
      return new _Option.Result(0, "Ok", matchValue$$14[1]);
    } else {
      const arg0$$44 = [path$$27, new _Types.ErrorReason(0, "BadPrimitive", "a decimal", value$$52)];
      return new _Option.Result(1, "Error", arg0$$44);
    }
  } else {
    const arg0$$45 = [path$$27, new _Types.ErrorReason(0, "BadPrimitive", "a decimal", value$$52)];
    return new _Option.Result(1, "Error", arg0$$45);
  }
}

function datetime(path$$28, value$$54) {
  if (typeof value$$54 === "string") {
    const matchValue$$15 = (0, _Date.tryParse)(value$$54, (0, _Date.minValue)());

    if (matchValue$$15[0]) {
      const arg0$$46 = (0, _Date.toUniversalTime)(matchValue$$15[1]);
      return new _Option.Result(0, "Ok", arg0$$46);
    } else {
      const arg0$$47 = [path$$28, new _Types.ErrorReason(0, "BadPrimitive", "a datetime", value$$54)];
      return new _Option.Result(1, "Error", arg0$$47);
    }
  } else {
    const arg0$$48 = [path$$28, new _Types.ErrorReason(0, "BadPrimitive", "a datetime", value$$54)];
    return new _Option.Result(1, "Error", arg0$$48);
  }
}

function datetimeOffset(path$$29, value$$55) {
  if (typeof value$$55 === "string") {
    const matchValue$$16 = (0, _DateOffset.tryParse)(value$$55, (0, _DateOffset.minValue)());

    if (matchValue$$16[0]) {
      return new _Option.Result(0, "Ok", matchValue$$16[1]);
    } else {
      const arg0$$49 = [path$$29, new _Types.ErrorReason(0, "BadPrimitive", "a datetimeoffset", value$$55)];
      return new _Option.Result(1, "Error", arg0$$49);
    }
  } else {
    const arg0$$50 = [path$$29, new _Types.ErrorReason(0, "BadPrimitive", "a datetime", value$$55)];
    return new _Option.Result(1, "Error", arg0$$50);
  }
}

function timespan(path$$30, value$$56) {
  if (typeof value$$56 === "string") {
    const matchValue$$17 = (0, _TimeSpan.tryParse)(value$$56, 0);

    if (matchValue$$17[0]) {
      return new _Option.Result(0, "Ok", matchValue$$17[1]);
    } else {
      const arg0$$51 = [path$$30, new _Types.ErrorReason(0, "BadPrimitive", "a timespan", value$$56)];
      return new _Option.Result(1, "Error", arg0$$51);
    }
  } else {
    const arg0$$52 = [path$$30, new _Types.ErrorReason(0, "BadPrimitive", "a timespan", value$$56)];
    return new _Option.Result(1, "Error", arg0$$52);
  }
}

function decodeMaybeNull(path$$31, decoder$$7, value$$57) {
  var o$$50;
  let matchValue$$18;
  const clo1$$1 = (0, _Util.partialApply)(1, decoder$$7, [path$$31]);
  matchValue$$18 = clo1$$1(value$$57);

  if (matchValue$$18.tag === 1) {
    if (o$$50 = value$$57, o$$50 == null) {
      return new _Option.Result(0, "Ok", null);
    } else {
      if (matchValue$$18.tag === 1) {
        return new _Option.Result(1, "Error", matchValue$$18.fields[0]);
      } else {
        throw new Error("The match cases were incomplete");
      }
    }
  } else {
    return new _Option.Result(0, "Ok", (0, _Option.some)(matchValue$$18.fields[0]));
  }
}

function optional(fieldName$$1, decoder$$8, path$$32, value$$58) {
  if (value$$58 === null ? false : Object.getPrototypeOf(value$$58 || false) === Object.prototype) {
    const fieldValue = value$$58[fieldName$$1];

    if (Helpers$$$isUndefined(fieldValue)) {
      return new _Option.Result(0, "Ok", null);
    } else {
      return decodeMaybeNull(path$$32 + "." + fieldName$$1, decoder$$8, fieldValue);
    }
  } else {
    return new _Option.Result(1, "Error", [path$$32, new _Types.ErrorReason(2, "BadType", "an object", value$$58)]);
  }
}

function badPathError(fieldNames, currentPath, value$$59) {
  var strings, option$$1;
  const currentPath$$1 = (0, _Option.defaultArg)(currentPath, (strings = new _Types2.List("$", fieldNames), ((0, _String.join)(".", strings))));
  const msg$$9 = "an object with path `" + (0, _String.join)(".", fieldNames) + "`";
  return new _Option.Result(1, "Error", [currentPath$$1, new _Types.ErrorReason(4, "BadPath", msg$$9, value$$59, (option$$1 = (0, _List.tryLast)(fieldNames), ((0, _Option.defaultArg)(option$$1, ""))))]);
}

function optionalAt(fieldNames$$1, decoder$$9, firstPath, firstValue) {
  let _arg1;

  const state = [firstPath, firstValue, null];
  _arg1 = (0, _List.fold)(function folder(tupledArg, field$$1) {
    if (tupledArg[2] == null) {
      if (tupledArg[1] == null) {
        const res$$1 = badPathError(fieldNames$$1, tupledArg[0], firstValue);
        return [tupledArg[0], tupledArg[1], res$$1];
      } else if (tupledArg[1] === null ? false : Object.getPrototypeOf(tupledArg[1] || false) === Object.prototype) {
        const curValue$$1 = tupledArg[1][field$$1];
        return [tupledArg[0] + "." + field$$1, curValue$$1, null];
      } else {
        const res$$2 = new _Option.Result(1, "Error", [tupledArg[0], new _Types.ErrorReason(2, "BadType", "an object", tupledArg[1])]);
        return [tupledArg[0], tupledArg[1], res$$2];
      }
    } else {
      return [tupledArg[0], tupledArg[1], tupledArg[2]];
    }
  }, state, fieldNames$$1);

  if (_arg1[2] == null) {
    if (Helpers$$$isUndefined(_arg1[1])) {
      return new _Option.Result(0, "Ok", null);
    } else {
      return decodeMaybeNull(_arg1[0], decoder$$9, _arg1[1]);
    }
  } else {
    const res$$3 = _arg1[2];
    return res$$3;
  }
}

function field(fieldName$$4, decoder$$10, path$$33, value$$61) {
  if (value$$61 === null ? false : Object.getPrototypeOf(value$$61 || false) === Object.prototype) {
    const fieldValue$$1 = value$$61[fieldName$$4];

    if (Helpers$$$isUndefined(fieldValue$$1)) {
      return new _Option.Result(1, "Error", [path$$33, new _Types.ErrorReason(3, "BadField", "an object with a field named `" + fieldName$$4 + "`", value$$61)]);
    } else {
      return decoder$$10(path$$33 + "." + fieldName$$4, fieldValue$$1);
    }
  } else {
    return new _Option.Result(1, "Error", [path$$33, new _Types.ErrorReason(2, "BadType", "an object", value$$61)]);
  }
}

function at(fieldNames$$2, decoder$$11, firstPath$$1, firstValue$$1) {
  let _arg1$$1;

  const state$$1 = [firstPath$$1, firstValue$$1, null];
  _arg1$$1 = (0, _List.fold)(function folder$$1(tupledArg$$1, field$$2) {
    if (tupledArg$$1[2] == null) {
      if (tupledArg$$1[1] == null) {
        const res$$5 = badPathError(fieldNames$$2, tupledArg$$1[0], firstValue$$1);
        return [tupledArg$$1[0], tupledArg$$1[1], res$$5];
      } else if (tupledArg$$1[1] === null ? false : Object.getPrototypeOf(tupledArg$$1[1] || false) === Object.prototype) {
        const curValue$$3 = tupledArg$$1[1][field$$2];

        if (Helpers$$$isUndefined(curValue$$3)) {
          const res$$6 = badPathError(fieldNames$$2, null, firstValue$$1);
          return [tupledArg$$1[0], curValue$$3, res$$6];
        } else {
          return [tupledArg$$1[0] + "." + field$$2, curValue$$3, null];
        }
      } else {
        const res$$7 = new _Option.Result(1, "Error", [tupledArg$$1[0], new _Types.ErrorReason(2, "BadType", "an object", tupledArg$$1[1])]);
        return [tupledArg$$1[0], tupledArg$$1[1], res$$7];
      }
    } else {
      return [tupledArg$$1[0], tupledArg$$1[1], tupledArg$$1[2]];
    }
  }, state$$1, fieldNames$$2);

  if (_arg1$$1[2] == null) {
    return decoder$$11(_arg1$$1[0], _arg1$$1[1]);
  } else {
    const res$$8 = _arg1$$1[2];
    return res$$8;
  }
}

function index(requestedIndex, decoder$$12, path$$34, value$$62) {
  var copyOfStruct;
  const currentPath$$2 = path$$34 + ".[" + (0, _Util.int32ToString)(requestedIndex) + "]";

  if (Array.isArray(value$$62)) {
    const vArray = value$$62;

    if (requestedIndex < vArray.length) {
      return decoder$$12(currentPath$$2, vArray[requestedIndex]);
    } else {
      const msg$$10 = "a longer array. Need index `" + (0, _Util.int32ToString)(requestedIndex) + "` but there are only `" + (copyOfStruct = vArray.length | 0, (0, _Util.int32ToString)(copyOfStruct)) + "` entries";
      const arg0$$53 = [currentPath$$2, new _Types.ErrorReason(5, "TooSmallArray", msg$$10, value$$62)];
      return new _Option.Result(1, "Error", arg0$$53);
    }
  } else {
    const arg0$$54 = [currentPath$$2, new _Types.ErrorReason(0, "BadPrimitive", "an array", value$$62)];
    return new _Option.Result(1, "Error", arg0$$54);
  }
}

function option(decoder$$13, path$$35, value$$63) {
  if (value$$63 == null) {
    return new _Option.Result(0, "Ok", null);
  } else {
    const result = decoder$$13(path$$35, value$$63);
    return (0, _Option.mapOk)(function mapping(arg0$$55) {
      return (0, _Option.some)(arg0$$55);
    }, result);
  }
}

function list(decoder$$14, path$$36, value$$64) {
  if (Array.isArray(value$$64)) {
    let i = -1 | 0;
    const tokens = value$$64;
    let result$$1;
    const state$$2 = new _Option.Result(0, "Ok", new _Types2.List());
    result$$1 = (0, _Array.fold)(function folder$$2(acc, value$$65) {
      i = i + 1;

      if (acc.tag === 0) {
        const matchValue$$19 = decoder$$14(path$$36 + ".[" + (0, _Util.int32ToString)(i) + "]", value$$65);

        if (matchValue$$19.tag === 0) {
          return new _Option.Result(0, "Ok", new _Types2.List(matchValue$$19.fields[0], acc.fields[0]));
        } else {
          return new _Option.Result(1, "Error", matchValue$$19.fields[0]);
        }
      } else {
        return acc;
      }
    }, state$$2, tokens);
    return (0, _Option.mapOk)(_List.reverse, result$$1);
  } else {
    const arg0$$56 = [path$$36, new _Types.ErrorReason(0, "BadPrimitive", "a list", value$$64)];
    return new _Option.Result(1, "Error", arg0$$56);
  }
}

function seq(decoder$$15, path$$37, value$$67) {
  if (Array.isArray(value$$67)) {
    let i$$1 = -1 | 0;
    const tokens$$1 = value$$67;
    let result$$2;
    const state$$3 = new _Option.Result(0, "Ok", []);
    result$$2 = (0, _Array.fold)(function folder$$3(acc$$2, value$$68) {
      i$$1 = i$$1 + 1;

      if (acc$$2.tag === 0) {
        const matchValue$$20 = decoder$$15(path$$37 + ".[" + (0, _Util.int32ToString)(i$$1) + "]", value$$68);

        if (matchValue$$20.tag === 0) {
          return new _Option.Result(0, "Ok", (0, _Seq.append)([matchValue$$20.fields[0]], acc$$2.fields[0]));
        } else {
          return new _Option.Result(1, "Error", matchValue$$20.fields[0]);
        }
      } else {
        return acc$$2;
      }
    }, state$$3, tokens$$1);
    return (0, _Option.mapOk)(_Seq.reverse, result$$2);
  } else {
    const arg0$$57 = [path$$37, new _Types.ErrorReason(0, "BadPrimitive", "a seq", value$$67)];
    return new _Option.Result(1, "Error", arg0$$57);
  }
}

function array(decoder$$16, path$$38, value$$70) {
  if (Array.isArray(value$$70)) {
    let i$$2 = -1 | 0;
    const tokens$$2 = value$$70;
    const arr = (0, _Array.fill)(new Array(tokens$$2.length), 0, tokens$$2.length, null);
    const state$$4 = new _Option.Result(0, "Ok", arr);
    return (0, _Array.fold)(function folder$$4(acc$$4, value$$71) {
      i$$2 = i$$2 + 1;

      if (acc$$4.tag === 0) {
        const matchValue$$21 = decoder$$16(path$$38 + ".[" + (0, _Util.int32ToString)(i$$2) + "]", value$$71);

        if (matchValue$$21.tag === 0) {
          acc$$4.fields[0][i$$2] = matchValue$$21.fields[0];
          return new _Option.Result(0, "Ok", acc$$4.fields[0]);
        } else {
          return new _Option.Result(1, "Error", matchValue$$21.fields[0]);
        }
      } else {
        return acc$$4;
      }
    }, state$$4, tokens$$2);
  } else {
    const arg0$$58 = [path$$38, new _Types.ErrorReason(0, "BadPrimitive", "an array", value$$70)];
    return new _Option.Result(1, "Error", arg0$$58);
  }
}

function keyValuePairs(decoder$$17, path$$39, value$$73) {
  if (value$$73 === null ? false : Object.getPrototypeOf(value$$73 || false) === Object.prototype) {
    let result$$3;
    const state$$5 = new _Option.Result(0, "Ok", new _Types2.List());
    const source$$1 = Object.keys(value$$73);
    result$$3 = (0, _Seq.fold)(function folder$$5(acc$$6, prop) {
      if (acc$$6.tag === 0) {
        const matchValue$$22 = decoder$$17(path$$39, value$$73[prop]);

        if (matchValue$$22.tag === 0) {
          const arg0$$59 = new _Types2.List([prop, matchValue$$22.fields[0]], acc$$6.fields[0]);
          return new _Option.Result(0, "Ok", arg0$$59);
        } else {
          return new _Option.Result(1, "Error", matchValue$$22.fields[0]);
        }
      } else {
        return acc$$6;
      }
    }, state$$5, source$$1);
    return (0, _Option.mapOk)(_List.reverse, result$$3);
  } else {
    const arg0$$60 = [path$$39, new _Types.ErrorReason(0, "BadPrimitive", "an object", value$$73)];
    return new _Option.Result(1, "Error", arg0$$60);
  }
}

function oneOf(decoders, path$$40, value$$75) {
  const runner = function runner($decoders$$1$$105, $errors$$106) {
    runner: while (true) {
      const decoders$$1 = $decoders$$1$$105,
            errors = $errors$$106;

      if (decoders$$1.tail == null) {
        const arg0$$61 = [path$$40, new _Types.ErrorReason(7, "BadOneOf", errors)];
        return new _Option.Result(1, "Error", arg0$$61);
      } else {
        const matchValue$$23 = fromValue(path$$40, (0, _Util.uncurry)(2, decoders$$1.head), value$$75);

        if (matchValue$$23.tag === 1) {
          $decoders$$1$$105 = decoders$$1.tail;
          $errors$$106 = (0, _List.append)(errors, new _Types2.List(matchValue$$23.fields[0], new _Types2.List()));
          continue runner;
        } else {
          return new _Option.Result(0, "Ok", matchValue$$23.fields[0]);
        }
      }

      break;
    }
  };

  return runner(decoders, new _Types2.List());
}

function nil(output, path$$41, value$$76) {
  if (value$$76 == null) {
    return new _Option.Result(0, "Ok", output);
  } else {
    const arg0$$62 = [path$$41, new _Types.ErrorReason(0, "BadPrimitive", "null", value$$76)];
    return new _Option.Result(1, "Error", arg0$$62);
  }
}

function value(_arg1$$2, v$$2) {
  return new _Option.Result(0, "Ok", v$$2);
}

function succeed(output$$1, _arg2, _arg1$$3) {
  return new _Option.Result(0, "Ok", output$$1);
}

function fail(msg$$11, path$$42, _arg1$$4) {
  const arg0$$63 = [path$$42, new _Types.ErrorReason(6, "FailMessage", msg$$11)];
  return new _Option.Result(1, "Error", arg0$$63);
}

function andThen(cb, decoder$$18, path$$43, value$$77) {
  const matchValue$$24 = decoder$$18(path$$43, value$$77);

  if (matchValue$$24.tag === 0) {
    return cb(matchValue$$24.fields[0], path$$43, value$$77);
  } else {
    return new _Option.Result(1, "Error", matchValue$$24.fields[0]);
  }
}

function map(ctor, d1, path$$44, value$$78) {
  const matchValue$$25 = d1(path$$44, value$$78);

  if (matchValue$$25.tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$25.fields[0]);
  } else {
    return new _Option.Result(0, "Ok", ctor(matchValue$$25.fields[0]));
  }
}

function map2(ctor$$1, d1$$1, d2, path$$45, value$$79) {
  const matchValue$$26 = [d1$$1(path$$45, value$$79), d2(path$$45, value$$79)];

  if (matchValue$$26[0].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$26[0].fields[0]);
  } else if (matchValue$$26[1].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$26[1].fields[0]);
  } else {
    return new _Option.Result(0, "Ok", ctor$$1(matchValue$$26[0].fields[0], matchValue$$26[1].fields[0]));
  }
}

function map3(ctor$$2, d1$$2, d2$$1, d3, path$$46, value$$80) {
  const matchValue$$27 = [d1$$2(path$$46, value$$80), d2$$1(path$$46, value$$80), d3(path$$46, value$$80)];

  if (matchValue$$27[0].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$27[0].fields[0]);
  } else if (matchValue$$27[1].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$27[1].fields[0]);
  } else if (matchValue$$27[2].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$27[2].fields[0]);
  } else {
    return new _Option.Result(0, "Ok", ctor$$2(matchValue$$27[0].fields[0], matchValue$$27[1].fields[0], matchValue$$27[2].fields[0]));
  }
}

function map4(ctor$$3, d1$$3, d2$$2, d3$$1, d4, path$$47, value$$81) {
  const matchValue$$28 = [d1$$3(path$$47, value$$81), d2$$2(path$$47, value$$81), d3$$1(path$$47, value$$81), d4(path$$47, value$$81)];

  if (matchValue$$28[0].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$28[0].fields[0]);
  } else if (matchValue$$28[1].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$28[1].fields[0]);
  } else if (matchValue$$28[2].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$28[2].fields[0]);
  } else if (matchValue$$28[3].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$28[3].fields[0]);
  } else {
    return new _Option.Result(0, "Ok", ctor$$3(matchValue$$28[0].fields[0], matchValue$$28[1].fields[0], matchValue$$28[2].fields[0], matchValue$$28[3].fields[0]));
  }
}

function map5(ctor$$4, d1$$4, d2$$3, d3$$2, d4$$1, d5, path$$48, value$$82) {
  const matchValue$$29 = [d1$$4(path$$48, value$$82), d2$$3(path$$48, value$$82), d3$$2(path$$48, value$$82), d4$$1(path$$48, value$$82), d5(path$$48, value$$82)];

  if (matchValue$$29[0].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$29[0].fields[0]);
  } else if (matchValue$$29[1].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$29[1].fields[0]);
  } else if (matchValue$$29[2].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$29[2].fields[0]);
  } else if (matchValue$$29[3].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$29[3].fields[0]);
  } else if (matchValue$$29[4].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$29[4].fields[0]);
  } else {
    return new _Option.Result(0, "Ok", ctor$$4(matchValue$$29[0].fields[0], matchValue$$29[1].fields[0], matchValue$$29[2].fields[0], matchValue$$29[3].fields[0], matchValue$$29[4].fields[0]));
  }
}

function map6(ctor$$5, d1$$5, d2$$4, d3$$3, d4$$2, d5$$1, d6, path$$49, value$$83) {
  const matchValue$$30 = [d1$$5(path$$49, value$$83), d2$$4(path$$49, value$$83), d3$$3(path$$49, value$$83), d4$$2(path$$49, value$$83), d5$$1(path$$49, value$$83), d6(path$$49, value$$83)];

  if (matchValue$$30[0].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$30[0].fields[0]);
  } else if (matchValue$$30[1].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$30[1].fields[0]);
  } else if (matchValue$$30[2].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$30[2].fields[0]);
  } else if (matchValue$$30[3].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$30[3].fields[0]);
  } else if (matchValue$$30[4].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$30[4].fields[0]);
  } else if (matchValue$$30[5].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$30[5].fields[0]);
  } else {
    return new _Option.Result(0, "Ok", ctor$$5(matchValue$$30[0].fields[0], matchValue$$30[1].fields[0], matchValue$$30[2].fields[0], matchValue$$30[3].fields[0], matchValue$$30[4].fields[0], matchValue$$30[5].fields[0]));
  }
}

function map7(ctor$$6, d1$$6, d2$$5, d3$$4, d4$$3, d5$$2, d6$$1, d7, path$$50, value$$84) {
  const matchValue$$31 = [d1$$6(path$$50, value$$84), d2$$5(path$$50, value$$84), d3$$4(path$$50, value$$84), d4$$3(path$$50, value$$84), d5$$2(path$$50, value$$84), d6$$1(path$$50, value$$84), d7(path$$50, value$$84)];

  if (matchValue$$31[0].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$31[0].fields[0]);
  } else if (matchValue$$31[1].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$31[1].fields[0]);
  } else if (matchValue$$31[2].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$31[2].fields[0]);
  } else if (matchValue$$31[3].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$31[3].fields[0]);
  } else if (matchValue$$31[4].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$31[4].fields[0]);
  } else if (matchValue$$31[5].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$31[5].fields[0]);
  } else if (matchValue$$31[6].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$31[6].fields[0]);
  } else {
    return new _Option.Result(0, "Ok", ctor$$6(matchValue$$31[0].fields[0], matchValue$$31[1].fields[0], matchValue$$31[2].fields[0], matchValue$$31[3].fields[0], matchValue$$31[4].fields[0], matchValue$$31[5].fields[0], matchValue$$31[6].fields[0]));
  }
}

function map8(ctor$$7, d1$$7, d2$$6, d3$$5, d4$$4, d5$$3, d6$$2, d7$$1, d8, path$$51, value$$85) {
  const matchValue$$32 = [d1$$7(path$$51, value$$85), d2$$6(path$$51, value$$85), d3$$5(path$$51, value$$85), d4$$4(path$$51, value$$85), d5$$3(path$$51, value$$85), d6$$2(path$$51, value$$85), d7$$1(path$$51, value$$85), d8(path$$51, value$$85)];

  if (matchValue$$32[0].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$32[0].fields[0]);
  } else if (matchValue$$32[1].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$32[1].fields[0]);
  } else if (matchValue$$32[2].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$32[2].fields[0]);
  } else if (matchValue$$32[3].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$32[3].fields[0]);
  } else if (matchValue$$32[4].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$32[4].fields[0]);
  } else if (matchValue$$32[5].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$32[5].fields[0]);
  } else if (matchValue$$32[6].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$32[6].fields[0]);
  } else if (matchValue$$32[7].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$32[7].fields[0]);
  } else {
    return new _Option.Result(0, "Ok", ctor$$7(matchValue$$32[0].fields[0], matchValue$$32[1].fields[0], matchValue$$32[2].fields[0], matchValue$$32[3].fields[0], matchValue$$32[4].fields[0], matchValue$$32[5].fields[0], matchValue$$32[6].fields[0], matchValue$$32[7].fields[0]));
  }
}

function dict(decoder$$19) {
  return function (path$$53) {
    return function (value$$87) {
      return map(function ctor$$8(elements) {
        return (0, _Map.ofList)(elements, {
          Compare: _Util.comparePrimitives
        });
      }, function d1$$8(path$$52, value$$86) {
        return keyValuePairs(decoder$$19, path$$52, value$$86);
      }, path$$53, value$$87);
    };
  };
}

function unwrapWith(errors$$1, path$$54, decoder$$21, value$$88) {
  let matchValue$$33;
  const clo1$$2 = (0, _Util.partialApply)(1, decoder$$21, [path$$54]);
  matchValue$$33 = clo1$$2(value$$88);

  if (matchValue$$33.tag === 1) {
    void errors$$1.push(matchValue$$33.fields[0]);
    return null;
  } else {
    return matchValue$$33.fields[0];
  }
}

const Getters$00601 = (0, _Types2.declare)(function Thoth_Json_Decode_Getters(path$$55, v$$4) {
  const $this$$3 = this;
  $this$$3.errors = [];
  $this$$3.required = {
    Field(fieldName$$8, decoder$$22) {
      return unwrapWith($this$$3.errors, path$$55, function (path$$56, value$$89) {
        return field(fieldName$$8, decoder$$22, path$$56, value$$89);
      }, v$$4);
    },

    At(fieldNames$$3, decoder$$24) {
      return unwrapWith($this$$3.errors, path$$55, function (firstPath$$2, firstValue$$2) {
        return at(fieldNames$$3, decoder$$24, firstPath$$2, firstValue$$2);
      }, v$$4);
    },

    Raw(decoder$$26) {
      return unwrapWith($this$$3.errors, path$$55, decoder$$26, v$$4);
    }

  };
  $this$$3.optional = {
    Field(fieldName$$9, decoder$$27) {
      return unwrapWith($this$$3.errors, path$$55, function (path$$57, value$$90) {
        return optional(fieldName$$9, decoder$$27, path$$57, value$$90);
      }, v$$4);
    },

    At(fieldNames$$4, decoder$$29) {
      return unwrapWith($this$$3.errors, path$$55, function (firstPath$$3, firstValue$$3) {
        return optionalAt(fieldNames$$4, decoder$$29, firstPath$$3, firstValue$$3);
      }, v$$4);
    },

    Raw(decoder$$31) {
      let matchValue$$34;
      const clo1$$3 = (0, _Util.partialApply)(1, decoder$$31, [path$$55]);
      matchValue$$34 = clo1$$3(v$$4);

      if (matchValue$$34.tag === 1) {
        var $target$$190, v$$6;

        if (matchValue$$34.fields[0][1].tag === 1) {
          $target$$190 = 0;
          v$$6 = matchValue$$34.fields[0][1].fields[1];
        } else if (matchValue$$34.fields[0][1].tag === 2) {
          $target$$190 = 0;
          v$$6 = matchValue$$34.fields[0][1].fields[1];
        } else if (matchValue$$34.fields[0][1].tag === 3) {
          $target$$190 = 1;
        } else if (matchValue$$34.fields[0][1].tag === 4) {
          $target$$190 = 1;
        } else if (matchValue$$34.fields[0][1].tag === 5) {
          $target$$190 = 2;
        } else if (matchValue$$34.fields[0][1].tag === 6) {
          $target$$190 = 2;
        } else if (matchValue$$34.fields[0][1].tag === 7) {
          $target$$190 = 2;
        } else {
          $target$$190 = 0;
          v$$6 = matchValue$$34.fields[0][1].fields[1];
        }

        switch ($target$$190) {
          case 0:
            {
              if (v$$6 == null) {
                return null;
              } else {
                void $this$$3.errors.push(matchValue$$34.fields[0]);
                return null;
              }
            }

          case 1:
            {
              return null;
            }

          case 2:
            {
              void $this$$3.errors.push(matchValue$$34.fields[0]);
              return null;
            }
        }
      } else {
        return (0, _Option.some)(matchValue$$34.fields[0]);
      }
    }

  };
});
exports.Getters$00601 = Getters$00601;

function Getters$00601$reflection($gen$$191) {
  return (0, _Reflection.type)("Thoth.Json.Decode.Getters`1", [$gen$$191]);
}

function Getters$00601$$$$002Ector$$4A51B60E(path$$55, v$$4) {
  return this instanceof Getters$00601 ? Getters$00601.call(this, path$$55, v$$4) : new Getters$00601(path$$55, v$$4);
}

function Getters$00601$$get_Errors(__$$6) {
  return (0, _List.ofSeq)(__$$6.errors);
}

Object.defineProperty(Getters$00601.prototype, "Required", {
  "get": function () {
    const __$$7 = this;
    return __$$7.required;
  }
});
Object.defineProperty(Getters$00601.prototype, "Optional", {
  "get": function () {
    const __$$8 = this;
    return __$$8.optional;
  }
});

function object(builder, path$$58, v$$7) {
  const getters = Getters$00601$$$$002Ector$$4A51B60E(path$$58, v$$7);
  let result$$5;
  result$$5 = builder(getters);
  const matchValue$$35 = Getters$00601$$get_Errors(getters);

  if (matchValue$$35.tail != null) {
    if ((0, _List.length)(matchValue$$35) > 1) {
      const errors$$3 = (0, _List.map)(function (tupledArg$$2) {
        return errorToString(tupledArg$$2[0], tupledArg$$2[1]);
      }, matchValue$$35);
      const arg0$$64 = [path$$58, new _Types.ErrorReason(7, "BadOneOf", errors$$3)];
      return new _Option.Result(1, "Error", arg0$$64);
    } else {
      return new _Option.Result(1, "Error", matchValue$$35.head);
    }
  } else {
    return new _Option.Result(0, "Ok", result$$5);
  }
}

function tuple2(decoder1, decoder2) {
  return function (path$$63) {
    return function (value$$94) {
      return andThen(function cb$$2(v1$$8, path$$62, value$$93) {
        return andThen(function cb$$1(v2$$7, arg10$0040, arg20$0040) {
          return succeed([v1$$8, v2$$7], arg10$0040, arg20$0040);
        }, function (path$$61, value$$92) {
          return index(1, decoder2, path$$61, value$$92);
        }, path$$62, value$$93);
      }, function (path$$60, value$$91) {
        return index(0, decoder1, path$$60, value$$91);
      }, path$$63, value$$94);
    };
  };
}

function tuple3(decoder1$$1, decoder2$$1, decoder3) {
  return function (path$$69) {
    return function (value$$100) {
      return andThen(function cb$$5(v1$$9, path$$68, value$$99) {
        return andThen(function cb$$4(v2$$8, path$$67, value$$98) {
          return andThen(function cb$$3(v3$$6, arg10$0040$$1, arg20$0040$$1) {
            return succeed([v1$$9, v2$$8, v3$$6], arg10$0040$$1, arg20$0040$$1);
          }, function (path$$66, value$$97) {
            return index(2, decoder3, path$$66, value$$97);
          }, path$$67, value$$98);
        }, function (path$$65, value$$96) {
          return index(1, decoder2$$1, path$$65, value$$96);
        }, path$$68, value$$99);
      }, function (path$$64, value$$95) {
        return index(0, decoder1$$1, path$$64, value$$95);
      }, path$$69, value$$100);
    };
  };
}

function tuple4(decoder1$$2, decoder2$$2, decoder3$$1, decoder4) {
  return function (path$$77) {
    return function (value$$108) {
      return andThen(function cb$$9(v1$$10, path$$76, value$$107) {
        return andThen(function cb$$8(v2$$9, path$$75, value$$106) {
          return andThen(function cb$$7(v3$$7, path$$74, value$$105) {
            return andThen(function cb$$6(v4$$5, arg10$0040$$2, arg20$0040$$2) {
              return succeed([v1$$10, v2$$9, v3$$7, v4$$5], arg10$0040$$2, arg20$0040$$2);
            }, function (path$$73, value$$104) {
              return index(3, decoder4, path$$73, value$$104);
            }, path$$74, value$$105);
          }, function (path$$72, value$$103) {
            return index(2, decoder3$$1, path$$72, value$$103);
          }, path$$75, value$$106);
        }, function (path$$71, value$$102) {
          return index(1, decoder2$$2, path$$71, value$$102);
        }, path$$76, value$$107);
      }, function (path$$70, value$$101) {
        return index(0, decoder1$$2, path$$70, value$$101);
      }, path$$77, value$$108);
    };
  };
}

function tuple5(decoder1$$3, decoder2$$3, decoder3$$2, decoder4$$1, decoder5) {
  return function (path$$87) {
    return function (value$$118) {
      return andThen(function cb$$14(v1$$11, path$$86, value$$117) {
        return andThen(function cb$$13(v2$$10, path$$85, value$$116) {
          return andThen(function cb$$12(v3$$8, path$$84, value$$115) {
            return andThen(function cb$$11(v4$$6, path$$83, value$$114) {
              return andThen(function cb$$10(v5$$4, arg10$0040$$3, arg20$0040$$3) {
                return succeed([v1$$11, v2$$10, v3$$8, v4$$6, v5$$4], arg10$0040$$3, arg20$0040$$3);
              }, function (path$$82, value$$113) {
                return index(4, decoder5, path$$82, value$$113);
              }, path$$83, value$$114);
            }, function (path$$81, value$$112) {
              return index(3, decoder4$$1, path$$81, value$$112);
            }, path$$84, value$$115);
          }, function (path$$80, value$$111) {
            return index(2, decoder3$$2, path$$80, value$$111);
          }, path$$85, value$$116);
        }, function (path$$79, value$$110) {
          return index(1, decoder2$$3, path$$79, value$$110);
        }, path$$86, value$$117);
      }, function (path$$78, value$$109) {
        return index(0, decoder1$$3, path$$78, value$$109);
      }, path$$87, value$$118);
    };
  };
}

function tuple6(decoder1$$4, decoder2$$4, decoder3$$3, decoder4$$2, decoder5$$1, decoder6) {
  return function (path$$99) {
    return function (value$$130) {
      return andThen(function cb$$20(v1$$12, path$$98, value$$129) {
        return andThen(function cb$$19(v2$$11, path$$97, value$$128) {
          return andThen(function cb$$18(v3$$9, path$$96, value$$127) {
            return andThen(function cb$$17(v4$$7, path$$95, value$$126) {
              return andThen(function cb$$16(v5$$5, path$$94, value$$125) {
                return andThen(function cb$$15(v6$$3, arg10$0040$$4, arg20$0040$$4) {
                  return succeed([v1$$12, v2$$11, v3$$9, v4$$7, v5$$5, v6$$3], arg10$0040$$4, arg20$0040$$4);
                }, function (path$$93, value$$124) {
                  return index(5, decoder6, path$$93, value$$124);
                }, path$$94, value$$125);
              }, function (path$$92, value$$123) {
                return index(4, decoder5$$1, path$$92, value$$123);
              }, path$$95, value$$126);
            }, function (path$$91, value$$122) {
              return index(3, decoder4$$2, path$$91, value$$122);
            }, path$$96, value$$127);
          }, function (path$$90, value$$121) {
            return index(2, decoder3$$3, path$$90, value$$121);
          }, path$$97, value$$128);
        }, function (path$$89, value$$120) {
          return index(1, decoder2$$4, path$$89, value$$120);
        }, path$$98, value$$129);
      }, function (path$$88, value$$119) {
        return index(0, decoder1$$4, path$$88, value$$119);
      }, path$$99, value$$130);
    };
  };
}

function tuple7(decoder1$$5, decoder2$$5, decoder3$$4, decoder4$$3, decoder5$$2, decoder6$$1, decoder7) {
  return function (path$$113) {
    return function (value$$144) {
      return andThen(function cb$$27(v1$$13, path$$112, value$$143) {
        return andThen(function cb$$26(v2$$12, path$$111, value$$142) {
          return andThen(function cb$$25(v3$$10, path$$110, value$$141) {
            return andThen(function cb$$24(v4$$8, path$$109, value$$140) {
              return andThen(function cb$$23(v5$$6, path$$108, value$$139) {
                return andThen(function cb$$22(v6$$4, path$$107, value$$138) {
                  return andThen(function cb$$21(v7$$2, arg10$0040$$5, arg20$0040$$5) {
                    return succeed([v1$$13, v2$$12, v3$$10, v4$$8, v5$$6, v6$$4, v7$$2], arg10$0040$$5, arg20$0040$$5);
                  }, function (path$$106, value$$137) {
                    return index(6, decoder7, path$$106, value$$137);
                  }, path$$107, value$$138);
                }, function (path$$105, value$$136) {
                  return index(5, decoder6$$1, path$$105, value$$136);
                }, path$$108, value$$139);
              }, function (path$$104, value$$135) {
                return index(4, decoder5$$2, path$$104, value$$135);
              }, path$$109, value$$140);
            }, function (path$$103, value$$134) {
              return index(3, decoder4$$3, path$$103, value$$134);
            }, path$$110, value$$141);
          }, function (path$$102, value$$133) {
            return index(2, decoder3$$4, path$$102, value$$133);
          }, path$$111, value$$142);
        }, function (path$$101, value$$132) {
          return index(1, decoder2$$5, path$$101, value$$132);
        }, path$$112, value$$143);
      }, function (path$$100, value$$131) {
        return index(0, decoder1$$5, path$$100, value$$131);
      }, path$$113, value$$144);
    };
  };
}

function tuple8(decoder1$$6, decoder2$$6, decoder3$$5, decoder4$$4, decoder5$$3, decoder6$$2, decoder7$$1, decoder8) {
  return function (path$$129) {
    return function (value$$160) {
      return andThen(function cb$$35(v1$$14, path$$128, value$$159) {
        return andThen(function cb$$34(v2$$13, path$$127, value$$158) {
          return andThen(function cb$$33(v3$$11, path$$126, value$$157) {
            return andThen(function cb$$32(v4$$9, path$$125, value$$156) {
              return andThen(function cb$$31(v5$$7, path$$124, value$$155) {
                return andThen(function cb$$30(v6$$5, path$$123, value$$154) {
                  return andThen(function cb$$29(v7$$3, path$$122, value$$153) {
                    return andThen(function cb$$28(v8$$1, arg10$0040$$6, arg20$0040$$6) {
                      return succeed([v1$$14, v2$$13, v3$$11, v4$$9, v5$$7, v6$$5, v7$$3, v8$$1], arg10$0040$$6, arg20$0040$$6);
                    }, function (path$$121, value$$152) {
                      return index(7, decoder8, path$$121, value$$152);
                    }, path$$122, value$$153);
                  }, function (path$$120, value$$151) {
                    return index(6, decoder7$$1, path$$120, value$$151);
                  }, path$$123, value$$154);
                }, function (path$$119, value$$150) {
                  return index(5, decoder6$$2, path$$119, value$$150);
                }, path$$124, value$$155);
              }, function (path$$118, value$$149) {
                return index(4, decoder5$$3, path$$118, value$$149);
              }, path$$125, value$$156);
            }, function (path$$117, value$$148) {
              return index(3, decoder4$$4, path$$117, value$$148);
            }, path$$126, value$$157);
          }, function (path$$116, value$$147) {
            return index(2, decoder3$$5, path$$116, value$$147);
          }, path$$127, value$$158);
        }, function (path$$115, value$$146) {
          return index(1, decoder2$$6, path$$115, value$$146);
        }, path$$128, value$$159);
      }, function (path$$114, value$$145) {
        return index(0, decoder1$$6, path$$114, value$$145);
      }, path$$129, value$$160);
    };
  };
}

function toMap(xs) {
  return (0, _Map.ofSeq)(xs, {
    Compare: _Util.compare
  });
}

function toSet(xs$$1) {
  return (0, _Set.ofSeq)(xs$$1, {
    Compare: _Util.compare
  });
}

function autoObject(decoderInfos, path$$130, value$$161) {
  if (!(value$$161 === null ? false : Object.getPrototypeOf(value$$161 || false) === Object.prototype)) {
    const arg0$$65 = [path$$130, new _Types.ErrorReason(0, "BadPrimitive", "an object", value$$161)];
    return new _Option.Result(1, "Error", arg0$$65);
  } else {
    const state$$6 = new _Option.Result(0, "Ok", new _Types2.List());
    return (0, _Array.foldBack)(function folder$$6(tupledArg$$3, acc$$8) {
      if (acc$$8.tag === 0) {
        const result$$7 = tupledArg$$3[1](path$$130 + "." + tupledArg$$3[0])(value$$161[tupledArg$$3[0]]);
        return (0, _Option.mapOk)(function mapping$$4(v$$8) {
          return new _Types2.List(v$$8, acc$$8.fields[0]);
        }, result$$7);
      } else {
        return acc$$8;
      }
    }, decoderInfos, state$$6);
  }
}

function autoObject2(keyDecoder, valueDecoder, path$$131, value$$162) {
  if (!(value$$162 === null ? false : Object.getPrototypeOf(value$$162 || false) === Object.prototype)) {
    const arg0$$66 = [path$$131, new _Types.ErrorReason(0, "BadPrimitive", "an object", value$$162)];
    return new _Option.Result(1, "Error", arg0$$66);
  } else {
    const state$$7 = new _Option.Result(0, "Ok", new _Types2.List());
    const source$$2 = Object.keys(value$$162);
    return (0, _Seq.fold)(function folder$$7(acc$$9, name$$17) {
      if (acc$$9.tag === 0) {
        let matchValue$$36;
        const clo1$$4 = (0, _Util.partialApply)(1, keyDecoder, [path$$131]);
        matchValue$$36 = clo1$$4(name$$17);

        if (matchValue$$36.tag === 0) {
          const _arg1$$5 = valueDecoder(path$$131 + "." + name$$17, value$$162[name$$17]);

          if (_arg1$$5.tag === 0) {
            const arg0$$67 = new _Types2.List([matchValue$$36.fields[0], _arg1$$5.fields[0]], acc$$9.fields[0]);
            return new _Option.Result(0, "Ok", arg0$$67);
          } else {
            return new _Option.Result(1, "Error", _arg1$$5.fields[0]);
          }
        } else {
          return new _Option.Result(1, "Error", matchValue$$36.fields[0]);
        }
      } else {
        return acc$$9;
      }
    }, state$$7, source$$2);
  }
}

function mixedArray(msg$$12, decoders$$2, path$$132, values) {
  var arg0$$68, arg10$$5, arg30, clo1$$5, clo2, clo3;

  if (decoders$$2.length !== values.length) {
    const arg0$$69 = [path$$132, (arg0$$68 = (arg10$$5 = decoders$$2.length | 0, arg30 = values.length | 0, (clo1$$5 = (0, _String.toText)((0, _String.printf)("Expected %i %s but got %i")), clo2 = clo1$$5(arg10$$5), clo3 = clo2(msg$$12), clo3(arg30))), (new _Types.ErrorReason(6, "FailMessage", arg0$$68)))];
    return new _Option.Result(1, "Error", arg0$$69);
  } else {
    const state$$8 = new _Option.Result(0, "Ok", new _Types2.List());
    return (0, _Array.foldBack2)((0, _Util.uncurry)(3, (0, _Util.mapCurriedArgs)(function folder$$8(value$$163) {
      return function (decoder$$103) {
        return function (acc$$11) {
          if (acc$$11.tag === 0) {
            const result$$9 = decoder$$103(path$$132, value$$163);
            return (0, _Option.mapOk)(function mapping$$5(v$$10) {
              return new _Types2.List(v$$10, acc$$11.fields[0]);
            }, result$$9);
          } else {
            return acc$$11;
          }
        };
      };
    }, [0, [0, 2], 0])), values, decoders$$2, state$$8);
  }
}

function makeUnion(extra, caseStrategy, t, name$$18, path$$133, values$$1) {
  let uci;
  const array$$5 = (0, _Reflection.getUnionCases)(t, true);
  uci = (0, _Array.tryFind)(function predicate(x$$14) {
    return (0, _Reflection.name)(x$$14) === name$$18;
  }, array$$5);

  if (uci != null) {
    const uci$$1 = uci;

    if (values$$1.length === 0) {
      const arg0$$71 = (0, _Reflection.makeUnion)(uci$$1, [], true);
      return new _Option.Result(0, "Ok", arg0$$71);
    } else {
      let decoders$$3;
      const array$$6 = (0, _Reflection.getUnionCaseFields)(uci$$1);
      decoders$$3 = (0, _Array.map)(function mapping$$6(fi) {
        return autoDecoder(extra, caseStrategy, false, fi[1]);
      }, array$$6, Array);
      const result$$10 = mixedArray("union fields", decoders$$3, path$$133, values$$1);
      return (0, _Option.mapOk)(function mapping$$7(values$$2) {
        return (0, _Reflection.makeUnion)(uci$$1, (0, _Array.ofList)(values$$2, Array), true);
      }, result$$10);
    }
  } else {
    const arg0$$70 = [path$$133, new _Types.ErrorReason(6, "FailMessage", "Cannot find case " + name$$18 + " in " + (0, _Reflection.fullName)(t))];
    return new _Option.Result(1, "Error", arg0$$70);
  }
}

function autoDecodeRecordsAndUnions(extra$$1, caseStrategy$$1, isOptional, t$$1) {
  const decoderRef = new _Types2.FSharpRef(null);
  let extra$$2;
  const key = (0, _Reflection.fullName)(t$$1);
  extra$$2 = (0, _Map.add)(key, decoderRef, extra$$1);
  let decoder$$104;

  if ((0, _Reflection.isRecord)(t$$1, true)) {
    let decoders$$4;
    const array$$7 = (0, _Reflection.getRecordElements)(t$$1, true);
    decoders$$4 = (0, _Array.map)(function mapping$$8(fi$$1) {
      const name$$19 = (0, _Types.Util$002ECasing$$$convert)(caseStrategy$$1, (0, _Reflection.name)(fi$$1));
      return [name$$19, autoDecoder(extra$$2, caseStrategy$$1, false, fi$$1[1])];
    }, array$$7, Array);

    decoder$$104 = function (path$$134) {
      return function (value$$164) {
        const result$$11 = autoObject(decoders$$4, path$$134, value$$164);
        return (0, _Option.mapOk)(function mapping$$9(xs$$2) {
          return (0, _Reflection.makeRecord)(t$$1, (0, _Array.ofList)(xs$$2, Array), true);
        }, result$$11);
      };
    };
  } else if ((0, _Reflection.isUnion)(t$$1, true)) {
    decoder$$104 = function (path$$135) {
      return function (value$$165) {
        if (typeof value$$165 === "string") {
          const name$$20 = value$$165;
          return makeUnion(extra$$2, caseStrategy$$1, t$$1, name$$20, path$$135, []);
        } else if (Array.isArray(value$$165)) {
          const values$$3 = value$$165;
          let name$$21;
          const o$$77 = values$$3[0];
          name$$21 = o$$77;
          return makeUnion(extra$$2, caseStrategy$$1, t$$1, name$$21, path$$135, values$$3.slice(1, values$$3.length));
        } else {
          const arg0$$72 = [path$$135, new _Types.ErrorReason(0, "BadPrimitive", "a string or array", value$$165)];
          return new _Option.Result(1, "Error", arg0$$72);
        }
      };
    };
  } else if (isOptional) {
    decoder$$104 = function d(path$$136) {
      return function (value$$166) {
        return new _Option.Result(1, "Error", [path$$136, new _Types.ErrorReason(2, "BadType", "an extra coder for " + (0, _Reflection.fullName)(t$$1), value$$166)]);
      };
    };
  } else {
    let message;
    const arg10$$6 = (0, _Reflection.fullName)(t$$1);
    const clo1$$6 = (0, _String.toText)((0, _String.printf)("Cannot generate auto decoder for %s. Please pass an extra decoder."));
    message = clo1$$6(arg10$$6);
    throw new Error(message);
  }

  decoderRef.contents = decoder$$104;
  return decoder$$104;
}

function autoDecoder(extra$$3, caseStrategy$$2, isOptional$$1, t$$2) {
  var clo1$$7, decoder$$120;
  const fullname = (0, _Reflection.fullName)(t$$2);
  const matchValue$$37 = (0, _Map.tryFind)(fullname, extra$$3);

  if (matchValue$$37 == null) {
    if ((0, _Reflection.isArray)(t$$2)) {
      let decoder$$105;
      const t$$3 = (0, _Reflection.getElementType)(t$$2);
      decoder$$105 = autoDecoder(extra$$3, caseStrategy$$2, false, t$$3);
      return function (path$$138) {
        return function (value$$168) {
          return array((0, _Util.uncurry)(2, decoder$$105), path$$138, value$$168);
        };
      };
    } else if ((0, _Reflection.isEnum)(t$$2)) {
      const enumType = (0, _Reflection.fullName)((0, _Reflection.getEnumUnderlyingType)(t$$2));

      if (enumType === "System.SByte") {
        return function (path$$139) {
          return function (value$$170) {
            const matchValue$$38 = sbyte(path$$139)(value$$170);

            if (matchValue$$38.tag === 1) {
              return new _Option.Result(1, "Error", matchValue$$38.fields[0]);
            } else {
              let _arg1$$6;

              let source$$4;
              const source$$3 = (0, _Reflection.getEnumValues)(t$$2);
              source$$4 = source$$3;
              _arg1$$6 = (0, _Seq.contains)(matchValue$$38.fields[0], source$$4);

              if (_arg1$$6) {
                const arg0$$73 = (0, _Reflection.parseEnum)(t$$2, (matchValue$$38.fields[0].toString()));
                return new _Option.Result(0, "Ok", arg0$$73);
              } else {
                const arg0$$74 = [path$$139, new _Types.ErrorReason(1, "BadPrimitiveExtra", (0, _Reflection.fullName)(t$$2), value$$170, "Unkown value provided for the enum")];
                return new _Option.Result(1, "Error", arg0$$74);
              }
            }
          };
        };
      } else if (enumType === "System.Byte") {
        return function (path$$141) {
          return function (value$$173) {
            const matchValue$$39 = byte$(path$$141)(value$$173);

            if (matchValue$$39.tag === 1) {
              return new _Option.Result(1, "Error", matchValue$$39.fields[0]);
            } else {
              let _arg1$$7;

              let source$$6;
              const source$$5 = (0, _Reflection.getEnumValues)(t$$2);
              source$$6 = source$$5;
              _arg1$$7 = (0, _Seq.contains)(matchValue$$39.fields[0], source$$6);

              if (_arg1$$7) {
                const arg0$$75 = (0, _Reflection.parseEnum)(t$$2, (matchValue$$39.fields[0].toString()));
                return new _Option.Result(0, "Ok", arg0$$75);
              } else {
                const arg0$$76 = [path$$141, new _Types.ErrorReason(1, "BadPrimitiveExtra", (0, _Reflection.fullName)(t$$2), value$$173, "Unkown value provided for the enum")];
                return new _Option.Result(1, "Error", arg0$$76);
              }
            }
          };
        };
      } else if (enumType === "System.Int16") {
        return function (path$$143) {
          return function (value$$176) {
            const matchValue$$40 = int16(path$$143)(value$$176);

            if (matchValue$$40.tag === 1) {
              return new _Option.Result(1, "Error", matchValue$$40.fields[0]);
            } else {
              let _arg1$$8;

              let source$$8;
              const source$$7 = (0, _Reflection.getEnumValues)(t$$2);
              source$$8 = source$$7;
              _arg1$$8 = (0, _Seq.contains)(matchValue$$40.fields[0], source$$8);

              if (_arg1$$8) {
                const arg0$$77 = (0, _Reflection.parseEnum)(t$$2, ((0, _Util.int16ToString)(matchValue$$40.fields[0])));
                return new _Option.Result(0, "Ok", arg0$$77);
              } else {
                const arg0$$78 = [path$$143, new _Types.ErrorReason(1, "BadPrimitiveExtra", (0, _Reflection.fullName)(t$$2), value$$176, "Unkown value provided for the enum")];
                return new _Option.Result(1, "Error", arg0$$78);
              }
            }
          };
        };
      } else if (enumType === "System.UInt16") {
        return function (path$$145) {
          return function (value$$179) {
            const matchValue$$41 = uint16(path$$145)(value$$179);

            if (matchValue$$41.tag === 1) {
              return new _Option.Result(1, "Error", matchValue$$41.fields[0]);
            } else {
              let _arg1$$9;

              let source$$10;
              const source$$9 = (0, _Reflection.getEnumValues)(t$$2);
              source$$10 = source$$9;
              _arg1$$9 = (0, _Seq.contains)(matchValue$$41.fields[0], source$$10);

              if (_arg1$$9) {
                const arg0$$79 = (0, _Reflection.parseEnum)(t$$2, (matchValue$$41.fields[0].toString()));
                return new _Option.Result(0, "Ok", arg0$$79);
              } else {
                const arg0$$80 = [path$$145, new _Types.ErrorReason(1, "BadPrimitiveExtra", (0, _Reflection.fullName)(t$$2), value$$179, "Unkown value provided for the enum")];
                return new _Option.Result(1, "Error", arg0$$80);
              }
            }
          };
        };
      } else if (enumType === "System.Int32") {
        return function (path$$147) {
          return function (value$$182) {
            const matchValue$$42 = int$(path$$147)(value$$182);

            if (matchValue$$42.tag === 1) {
              return new _Option.Result(1, "Error", matchValue$$42.fields[0]);
            } else {
              let _arg1$$10;

              let source$$12;
              const source$$11 = (0, _Reflection.getEnumValues)(t$$2);
              source$$12 = source$$11;
              _arg1$$10 = (0, _Seq.contains)(matchValue$$42.fields[0], source$$12);

              if (_arg1$$10) {
                const arg0$$81 = (0, _Reflection.parseEnum)(t$$2, ((0, _Util.int32ToString)(matchValue$$42.fields[0])));
                return new _Option.Result(0, "Ok", arg0$$81);
              } else {
                const arg0$$82 = [path$$147, new _Types.ErrorReason(1, "BadPrimitiveExtra", (0, _Reflection.fullName)(t$$2), value$$182, "Unkown value provided for the enum")];
                return new _Option.Result(1, "Error", arg0$$82);
              }
            }
          };
        };
      } else if (enumType === "System.UInt32") {
        return function (path$$149) {
          return function (value$$185) {
            const matchValue$$43 = uint32(path$$149)(value$$185);

            if (matchValue$$43.tag === 1) {
              return new _Option.Result(1, "Error", matchValue$$43.fields[0]);
            } else {
              let _arg1$$11;

              let source$$14;
              const source$$13 = (0, _Reflection.getEnumValues)(t$$2);
              source$$14 = source$$13;
              _arg1$$11 = (0, _Seq.contains)(matchValue$$43.fields[0], source$$14);

              if (_arg1$$11) {
                const arg0$$83 = (0, _Reflection.parseEnum)(t$$2, (matchValue$$43.fields[0].toString()));
                return new _Option.Result(0, "Ok", arg0$$83);
              } else {
                const arg0$$84 = [path$$149, new _Types.ErrorReason(1, "BadPrimitiveExtra", (0, _Reflection.fullName)(t$$2), value$$185, "Unkown value provided for the enum")];
                return new _Option.Result(1, "Error", arg0$$84);
              }
            }
          };
        };
      } else {
        return (clo1$$7 = (0, _String.toFail)((0, _String.printf)("Cannot generate auto decoder for %s.\nThoth.Json.Net only support the folluwing enum types:\n- sbyte\n- byte\n- int16\n- uint16\n- int\n- uint32\nIf you can't use one of these types, please pass an extra decoder.\n                    ")), function (arg10$$7) {
          const clo2$$1 = clo1$$7(arg10$$7);
          return function (arg20$$1) {
            const clo3$$1 = clo2$$1(arg20$$1);
            return function (arg30$$1) {
              return clo3$$1(arg30$$1);
            };
          };
        })((0, _Reflection.fullName)(t$$2));
      }
    } else if ((0, _Reflection.isGenericType)(t$$2)) {
      if ((0, _Reflection.isTuple)(t$$2)) {
        let decoders$$5;
        const array$$8 = (0, _Reflection.getTupleElements)(t$$2);
        decoders$$5 = (0, _Array.map)(function mapping$$10(t$$10) {
          return autoDecoder(extra$$3, caseStrategy$$2, false, t$$10);
        }, array$$8, Array);
        return function (path$$151) {
          return function (value$$187) {
            if (Array.isArray(value$$187)) {
              const result$$12 = mixedArray("tuple elements", decoders$$5, path$$151, value$$187);
              return (0, _Option.mapOk)(function mapping$$11(xs$$3) {
                return (0, _Reflection.makeTuple)((0, _Array.ofList)(xs$$3, Array), t$$2);
              }, result$$12);
            } else {
              const arg0$$85 = [path$$151, new _Types.ErrorReason(0, "BadPrimitive", "an array", value$$187)];
              return new _Option.Result(1, "Error", arg0$$85);
            }
          };
        };
      } else {
        const fullname$$1 = (0, _Reflection.fullName)((0, _Reflection.getGenericTypeDefinition)(t$$2));

        if (fullname$$1 === "Microsoft.FSharp.Core.FSharpOption`1[System.Object]") {
          let d$$15;
          let decoder$$118;
          const t$$11 = (0, _Reflection.getGenerics)(t$$2)[0];
          decoder$$118 = autoDecoder(extra$$3, caseStrategy$$2, true, t$$11);

          d$$15 = function (path$$152) {
            return function (value$$188) {
              return option((0, _Util.uncurry)(2, decoder$$118), path$$152, value$$188);
            };
          };

          return d$$15;
        } else if (fullname$$1 === "Microsoft.FSharp.Collections.FSharpList`1[System.Object]") {
          let d$$17;
          let decoder$$119;
          const t$$12 = (0, _Reflection.getGenerics)(t$$2)[0];
          decoder$$119 = autoDecoder(extra$$3, caseStrategy$$2, false, t$$12);

          d$$17 = function (path$$153) {
            return function (value$$189) {
              return list((0, _Util.uncurry)(2, decoder$$119), path$$153, value$$189);
            };
          };

          return d$$17;
        } else if (fullname$$1 === "Microsoft.FSharp.Collections.FSharpMap`2[System.Object,System.Object]") {
          let keyDecoder$$1;
          const t$$13 = (0, _Reflection.getGenerics)(t$$2)[0];
          keyDecoder$$1 = autoDecoder(extra$$3, caseStrategy$$2, false, t$$13);
          let valueDecoder$$1;
          const t$$14 = (0, _Reflection.getGenerics)(t$$2)[1];
          valueDecoder$$1 = autoDecoder(extra$$3, caseStrategy$$2, false, t$$14);
          let d1$$9;
          const decoders$$6 = (0, _List.ofArray)([function (path$$154) {
            return function (value$$190) {
              return autoObject2((0, _Util.uncurry)(2, keyDecoder$$1), (0, _Util.uncurry)(2, valueDecoder$$1), path$$154, value$$190);
            };
          }, (decoder$$120 = tuple2((0, _Util.uncurry)(2, keyDecoder$$1), (0, _Util.uncurry)(2, valueDecoder$$1)), function (path$$155) {
            return function (value$$191) {
              return list((0, _Util.uncurry)(2, decoder$$120), path$$155, value$$191);
            };
          })]);

          d1$$9 = function (path$$156) {
            return function (value$$192) {
              return oneOf(decoders$$6, path$$156, value$$192);
            };
          };

          return function (path$$157) {
            return function (value$$194) {
              return map(function ctor$$9(ar) {
                const value$$193 = toMap(ar);
                return value$$193;
              }, (0, _Util.uncurry)(2, d1$$9), path$$157, value$$194);
            };
          };
        } else if (fullname$$1 === "Microsoft.FSharp.Collections.FSharpSet`1[System.Object]") {
          let decoder$$121;
          const t$$15 = (0, _Reflection.getGenerics)(t$$2)[0];
          decoder$$121 = autoDecoder(extra$$3, caseStrategy$$2, false, t$$15);
          return function (path$$158) {
            return function (value$$195) {
              const matchValue$$44 = array((0, _Util.uncurry)(2, decoder$$121), path$$158, value$$195);

              if (matchValue$$44.tag === 0) {
                let arg0$$86;
                const value$$196 = toSet(matchValue$$44.fields[0]);
                arg0$$86 = value$$196;
                return new _Option.Result(0, "Ok", arg0$$86);
              } else {
                return new _Option.Result(1, "Error", matchValue$$44.fields[0]);
              }
            };
          };
        } else {
          return autoDecodeRecordsAndUnions(extra$$3, caseStrategy$$2, isOptional$$1, t$$2);
        }
      }
    } else if (fullname === "System.Boolean") {
      return function d$$19(path$$159) {
        return function (value$$197) {
          return bool(path$$159, value$$197);
        };
      };
    } else if (fullname === "Microsoft.FSharp.Core.Unit") {
      return function d$$20(path$$160) {
        return function (value$$198) {
          return unit(path$$160, value$$198);
        };
      };
    } else if (fullname === "System.String") {
      return function d$$21(path$$161) {
        return function (value$$199) {
          return string(path$$161, value$$199);
        };
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
      return int$;
    } else if (fullname === "System.UInt32") {
      return uint32;
    } else if (fullname === "System.Double") {
      return function d$$28(path$$162) {
        return function (value$$200) {
          return float$(path$$162, value$$200);
        };
      };
    } else if (fullname === "System.Single") {
      return function d$$29(path$$163) {
        return function (value$$201) {
          return float32(path$$163, value$$201);
        };
      };
    } else if (fullname === "System.DateTime") {
      return function d$$30(path$$164) {
        return function (value$$202) {
          return datetime(path$$164, value$$202);
        };
      };
    } else if (fullname === "System.DateTimeOffset") {
      return function d$$31(path$$165) {
        return function (value$$203) {
          return datetimeOffset(path$$165, value$$203);
        };
      };
    } else if (fullname === "System.TimeSpan") {
      return function d$$32(path$$166) {
        return function (value$$204) {
          return timespan(path$$166, value$$204);
        };
      };
    } else if (fullname === "System.Guid") {
      return function d$$33(path$$167) {
        return function (value$$205) {
          return guid(path$$167, value$$205);
        };
      };
    } else if (fullname === "System.Object") {
      return function (_arg1$$12) {
        return function (v$$11) {
          return new _Option.Result(0, "Ok", v$$11);
        };
      };
    } else {
      return autoDecodeRecordsAndUnions(extra$$3, caseStrategy$$2, isOptional$$1, t$$2);
    }
  } else {
    const decoderRef$$1 = matchValue$$37;
    return function (path$$137) {
      return function (value$$167) {
        return decoderRef$$1.contents(path$$137)(value$$167);
      };
    };
  }
}

function makeExtra(extra$$4) {
  if (extra$$4 != null) {
    const e = extra$$4;
    return (0, _Map.map)(function (_arg2$$1, tupledArg$$4) {
      return new _Types2.FSharpRef(tupledArg$$4[1]);
    }, e.Coders);
  } else {
    return (0, _Map.empty)({
      Compare: _Util.comparePrimitives
    });
  }
}

const Auto = (0, _Types2.declare)(function Thoth_Json_Decode_Auto() {});
exports.Auto = Auto;

function Auto$reflection() {
  return (0, _Reflection.type)("Thoth.Json.Decode.Auto");
}

function Auto$$$generateDecoderCached$$7848D058(caseStrategy$$3, extra$$5, resolver) {
  const t$$16 = resolver.ResolveType();
  const caseStrategy$$4 = (0, _Option.defaultArg)(caseStrategy$$3, new _Types.CaseStrategy(0, "PascalCase"));
  let key$$1;
  let y$$1;
  const y = (0, _Reflection.fullName)(t$$16);
  const x$$15 = String(caseStrategy$$4);
  y$$1 = x$$15 + y;
  let x$$16;
  let option$$3;
  option$$3 = (0, _Option.map)(function mapping$$12(e$$1) {
    return e$$1.Hash;
  }, extra$$5);
  x$$16 = (0, _Option.defaultArg)(option$$3, "");
  key$$1 = x$$16 + y$$1;
  const d$$34 = (0, _Types.Util$002ECache$00601$$GetOrAdd$$43981464)(_Types.Util$$$CachedDecoders, key$$1, function () {
    return autoDecoder(makeExtra(extra$$5), caseStrategy$$4, false, t$$16);
  });
  return d$$34;
}

function Auto$$$generateDecoder$$7848D058(caseStrategy$$5, extra$$6, resolver$$2) {
  const caseStrategy$$6 = (0, _Option.defaultArg)(caseStrategy$$5, new _Types.CaseStrategy(0, "PascalCase"));
  let d$$36;
  const t$$17 = resolver$$2.ResolveType();
  const extra$$7 = makeExtra(extra$$6);
  d$$36 = autoDecoder(extra$$7, caseStrategy$$6, false, t$$17);
  return d$$36;
}

function Auto$$$fromString$$Z5CB6BD(json$$1, caseStrategy$$7, extra$$8, resolver$$4) {
  const decoder$$122 = Auto$$$generateDecoder$$7848D058(caseStrategy$$7, extra$$8, resolver$$4);
  return fromString((0, _Util.uncurry)(2, decoder$$122), json$$1);
}

function Auto$$$unsafeFromString$$Z5CB6BD(json$$2, caseStrategy$$8, extra$$9, resolver$$5) {
  const decoder$$123 = Auto$$$generateDecoder$$7848D058(caseStrategy$$8, extra$$9, resolver$$5);
  const matchValue$$45 = fromString((0, _Util.uncurry)(2, decoder$$123), json$$2);

  if (matchValue$$45.tag === 1) {
    throw new Error(matchValue$$45.fields[0]);
  } else {
    return matchValue$$45.fields[0];
  }
}