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
exports.int$ = int$;
exports.int64 = int64;
exports.uint32 = uint32;
exports.uint64 = uint64;
exports.bigint = bigint;
exports.bool = bool;
exports.float$ = float$;
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
exports.Auto$$$generateDecoderCached$$4AE6C623 = Auto$$$generateDecoderCached$$4AE6C623;
exports.Auto$$$generateDecoder$$4AE6C623 = Auto$$$generateDecoder$$4AE6C623;
exports.Auto$$$fromString$$Z33228D48 = Auto$$$fromString$$Z33228D48;
exports.Auto$$$unsafeFromString$$Z33228D48 = Auto$$$unsafeFromString$$Z33228D48;
exports.Auto = exports.Getters$00601 = void 0;

var _String = require("../fable-library.2.3.11/String");

var _Util = require("../fable-library.2.3.11/Util");

var _Option = require("../fable-library.2.3.11/Option");

var _Types = require("./Types");

var _Int = require("../fable-library.2.3.11/Int32");

var _Long = require("../fable-library.2.3.11/Long");

var _BigInt = require("../fable-library.2.3.11/BigInt");

var _Decimal = _interopRequireWildcard(require("../fable-library.2.3.11/Decimal"));

var _Date = require("../fable-library.2.3.11/Date");

var _DateOffset = require("../fable-library.2.3.11/DateOffset");

var _TimeSpan = require("../fable-library.2.3.11/TimeSpan");

var _Types2 = require("../fable-library.2.3.11/Types");

var _List = require("../fable-library.2.3.11/List");

var _Array = require("../fable-library.2.3.11/Array");

var _Seq = require("../fable-library.2.3.11/Seq");

var _Map = require("../fable-library.2.3.11/Map");

var _Reflection = require("../fable-library.2.3.11/Reflection");

var _Set = require("../fable-library.2.3.11/Set");

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
  let reason$$1;

  switch (error.tag) {
    case 2:
      {
        const value$$3 = error.fields[1];
        const msg$$2 = error.fields[0];
        reason$$1 = genericMsg(msg$$2, value$$3, true);
        break;
      }

    case 1:
      {
        const value$$4 = error.fields[1];
        const reason = error.fields[2];
        const msg$$3 = error.fields[0];
        reason$$1 = genericMsg(msg$$3, value$$4, false) + "\nReason: " + reason;
        break;
      }

    case 3:
      {
        const value$$5 = error.fields[1];
        const msg$$4 = error.fields[0];
        reason$$1 = genericMsg(msg$$4, value$$5, true);
        break;
      }

    case 4:
      {
        const value$$6 = error.fields[1];
        const msg$$5 = error.fields[0];
        const fieldName = error.fields[2];
        reason$$1 = genericMsg(msg$$5, value$$6, true) + ("\nNode `" + fieldName + "` is unkown.");
        break;
      }

    case 5:
      {
        const value$$7 = error.fields[1];
        const msg$$6 = error.fields[0];
        reason$$1 = "Expecting " + msg$$6 + ".\n" + (JSON.stringify(value$$7, null, 4) + "");
        break;
      }

    case 7:
      {
        const messages = error.fields[0];
        reason$$1 = "The following errors were found:\n\n" + (0, _String.join)("\n\n", ...messages);
        break;
      }

    case 6:
      {
        const msg$$7 = error.fields[0];
        reason$$1 = "The following `failure` occurred with the decoder: " + msg$$7;
        break;
      }

    default:
      {
        const value$$2 = error.fields[1];
        const msg$$1 = error.fields[0];
        reason$$1 = genericMsg(msg$$1, value$$2, false);
      }
  }

  if (error.tag === 7) {
    return reason$$1;
  } else {
    return "Error at: `" + path + "`\n" + reason$$1;
  }
}

function fromValue(path$$1, decoder, value$$8) {
  const matchValue$$1 = function (arg00) {
    const clo1 = (0, _Util.partialApply)(1, decoder, [arg00]);
    return function (arg10) {
      return clo1(arg10);
    };
  }(path$$1)(value$$8);

  if (matchValue$$1.tag === 1) {
    const error$$1 = matchValue$$1.fields[0];
    return new _Option.Result(1, "Error", errorToString(error$$1[0], error$$1[1]));
  } else {
    const success = matchValue$$1.fields[0];
    return new _Option.Result(0, "Ok", success);
  }
}

function fromString(decoder$$1, value$$9) {
  var ex;

  try {
    const json = JSON.parse(value$$9);
    return fromValue("$", decoder$$1, json);
  } catch (matchValue$$2) {
    if (ex = matchValue$$2, ex instanceof SyntaxError) {
      const ex$$1 = matchValue$$2;
      return new _Option.Result(1, "Error", "Given an invalid JSON: " + ex$$1.message);
    } else {
      throw matchValue$$2;
    }
  }
}

function unsafeFromString(decoder$$2, value$$10) {
  const matchValue$$3 = fromString(decoder$$2, value$$10);

  if (matchValue$$3.tag === 1) {
    const msg$$8 = matchValue$$3.fields[0];
    throw new Error(msg$$8);
  } else {
    const x = matchValue$$3.fields[0];
    return x;
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
    return new _Option.Result(1, "Error", [path$$4, new _Types.ErrorReason(0, "BadPrimitive", "a string", value$$13)]);
  }
}

function guid(path$$5, value$$14) {
  if (typeof value$$14 === "string") {
    const matchValue$$4 = (0, _String.validateGuid)(value$$14, true);

    if (matchValue$$4[0]) {
      return new _Option.Result(0, "Ok", matchValue$$4[1]);
    } else {
      return new _Option.Result(1, "Error", [path$$5, new _Types.ErrorReason(0, "BadPrimitive", "a guid", value$$14)]);
    }
  } else {
    return new _Option.Result(1, "Error", [path$$5, new _Types.ErrorReason(0, "BadPrimitive", "a guid", value$$14)]);
  }
}

function int$(path$$6, value$$15) {
  if (typeof value$$15 === "number") {
    if (-2147483648 < value$$15 && value$$15 < 2147483647 && (value$$15 | 0) === value$$15) {
      return new _Option.Result(0, "Ok", value$$15);
    } else {
      return new _Option.Result(1, "Error", [path$$6, new _Types.ErrorReason(1, "BadPrimitiveExtra", "an int", value$$15, "Value was either too large or too small for an int")]);
    }
  } else if (typeof value$$15 === "string") {
    const matchValue$$5 = (0, _Int.tryParse)(value$$15, 511, false, 32);

    if (matchValue$$5[0]) {
      return new _Option.Result(0, "Ok", matchValue$$5[1]);
    } else {
      return new _Option.Result(1, "Error", [path$$6, new _Types.ErrorReason(0, "BadPrimitive", "an int", value$$15)]);
    }
  } else {
    return new _Option.Result(1, "Error", [path$$6, new _Types.ErrorReason(0, "BadPrimitive", "an int", value$$15)]);
  }
}

function int64(path$$7, value$$16) {
  if (typeof value$$16 === "number") {
    return new _Option.Result(0, "Ok", (0, _Long.fromInteger)(value$$16, false, 2));
  } else if (typeof value$$16 === "string") {
    const matchValue$$6 = (0, _Long.tryParse)(value$$16, 511, false, 64);

    if (matchValue$$6[0]) {
      return new _Option.Result(0, "Ok", matchValue$$6[1]);
    } else {
      return new _Option.Result(1, "Error", [path$$7, new _Types.ErrorReason(0, "BadPrimitive", "an int64", value$$16)]);
    }
  } else {
    return new _Option.Result(1, "Error", [path$$7, new _Types.ErrorReason(0, "BadPrimitive", "an int64", value$$16)]);
  }
}

function uint32(path$$8, value$$18) {
  if (typeof value$$18 === "number") {
    const x$$4 = value$$18;

    if (x$$4 >= 0 ? x$$4 <= 4294967295 : false) {
      return new _Option.Result(0, "Ok", value$$18 >>> 0);
    } else {
      return new _Option.Result(1, "Error", [path$$8, new _Types.ErrorReason(1, "BadPrimitiveExtra", "an uint32", value$$18, "Value was either too large or too small for an uint32")]);
    }
  } else if (typeof value$$18 === "string") {
    const matchValue$$7 = (0, _Int.tryParse)(value$$18, 511, true, 32);

    if (matchValue$$7[0]) {
      return new _Option.Result(0, "Ok", matchValue$$7[1]);
    } else {
      return new _Option.Result(1, "Error", [path$$8, new _Types.ErrorReason(0, "BadPrimitive", "an uint32", value$$18)]);
    }
  } else {
    return new _Option.Result(1, "Error", [path$$8, new _Types.ErrorReason(0, "BadPrimitive", "an uint32", value$$18)]);
  }
}

function uint64(path$$9, value$$20) {
  if (typeof value$$20 === "number") {
    const x$$6 = value$$20;

    if (x$$6 >= 0 ? x$$6 <= (0, _Long.toNumber)((0, _Long.fromBits)(4294967295, 4294967295, true)) : false) {
      return new _Option.Result(0, "Ok", (0, _Long.fromInteger)(value$$20, true, 2));
    } else {
      return new _Option.Result(1, "Error", [path$$9, new _Types.ErrorReason(1, "BadPrimitiveExtra", "an uint64", value$$20, "Value was either too large or too small for an uint64")]);
    }
  } else if (typeof value$$20 === "string") {
    const matchValue$$8 = (0, _Long.tryParse)(value$$20, 511, true, 64);

    if (matchValue$$8[0]) {
      return new _Option.Result(0, "Ok", matchValue$$8[1]);
    } else {
      return new _Option.Result(1, "Error", [path$$9, new _Types.ErrorReason(0, "BadPrimitive", "an uint64", value$$20)]);
    }
  } else {
    return new _Option.Result(1, "Error", [path$$9, new _Types.ErrorReason(0, "BadPrimitive", "an uint64", value$$20)]);
  }
}

function bigint(path$$10, value$$22) {
  if (typeof value$$22 === "number") {
    return new _Option.Result(0, "Ok", (0, _BigInt.fromInt32)(value$$22));
  } else if (typeof value$$22 === "string") {
    try {
      return new _Option.Result(0, "Ok", (0, _BigInt.parse)(value$$22));
    } catch (matchValue$$9) {
      return new _Option.Result(1, "Error", [path$$10, new _Types.ErrorReason(0, "BadPrimitive", "a bigint", value$$22)]);
    }
  } else {
    return new _Option.Result(1, "Error", [path$$10, new _Types.ErrorReason(0, "BadPrimitive", "a bigint", value$$22)]);
  }
}

function bool(path$$11, value$$23) {
  if (typeof value$$23 === "boolean") {
    return new _Option.Result(0, "Ok", value$$23);
  } else {
    return new _Option.Result(1, "Error", [path$$11, new _Types.ErrorReason(0, "BadPrimitive", "a boolean", value$$23)]);
  }
}

function float$(path$$12, value$$24) {
  if (typeof value$$24 === "number") {
    return new _Option.Result(0, "Ok", value$$24);
  } else {
    return new _Option.Result(1, "Error", [path$$12, new _Types.ErrorReason(0, "BadPrimitive", "a float", value$$24)]);
  }
}

function decimal(path$$13, value$$25) {
  if (typeof value$$25 === "number") {
    return new _Option.Result(0, "Ok", new _Decimal.default(value$$25));
  } else if (typeof value$$25 === "string") {
    const matchValue$$10 = (0, _Decimal.tryParse)(value$$25);

    if (matchValue$$10[0]) {
      return new _Option.Result(0, "Ok", matchValue$$10[1]);
    } else {
      return new _Option.Result(1, "Error", [path$$13, new _Types.ErrorReason(0, "BadPrimitive", "a decimal", value$$25)]);
    }
  } else {
    return new _Option.Result(1, "Error", [path$$13, new _Types.ErrorReason(0, "BadPrimitive", "a decimal", value$$25)]);
  }
}

function datetime(path$$14, value$$27) {
  if (typeof value$$27 === "string") {
    const matchValue$$11 = (0, _Date.tryParse)(value$$27, null);

    if (matchValue$$11[0]) {
      return new _Option.Result(0, "Ok", (0, _Date.toUniversalTime)(matchValue$$11[1]));
    } else {
      return new _Option.Result(1, "Error", [path$$14, new _Types.ErrorReason(0, "BadPrimitive", "a datetime", value$$27)]);
    }
  } else {
    return new _Option.Result(1, "Error", [path$$14, new _Types.ErrorReason(0, "BadPrimitive", "a datetime", value$$27)]);
  }
}

function datetimeOffset(path$$15, value$$28) {
  if (typeof value$$28 === "string") {
    const matchValue$$12 = (0, _DateOffset.tryParse)(value$$28, null);

    if (matchValue$$12[0]) {
      return new _Option.Result(0, "Ok", matchValue$$12[1]);
    } else {
      return new _Option.Result(1, "Error", [path$$15, new _Types.ErrorReason(0, "BadPrimitive", "a datetimeoffset", value$$28)]);
    }
  } else {
    return new _Option.Result(1, "Error", [path$$15, new _Types.ErrorReason(0, "BadPrimitive", "a datetime", value$$28)]);
  }
}

function timespan(path$$16, value$$29) {
  if (typeof value$$29 === "string") {
    const matchValue$$13 = (0, _TimeSpan.tryParse)(value$$29, null);

    if (matchValue$$13[0]) {
      return new _Option.Result(0, "Ok", matchValue$$13[1]);
    } else {
      return new _Option.Result(1, "Error", [path$$16, new _Types.ErrorReason(0, "BadPrimitive", "a timespan", value$$29)]);
    }
  } else {
    return new _Option.Result(1, "Error", [path$$16, new _Types.ErrorReason(0, "BadPrimitive", "a timespan", value$$29)]);
  }
}

function decodeMaybeNull(path$$17, decoder$$7, value$$30) {
  const matchValue$$14 = function (arg00$$2) {
    const clo1$$1 = (0, _Util.partialApply)(1, decoder$$7, [arg00$$2]);
    return function (arg10$$1) {
      return clo1$$1(arg10$$1);
    };
  }(path$$17)(value$$30);

  if (matchValue$$14.tag === 1) {
    if (value$$30 == null) {
      return new _Option.Result(0, "Ok", null);
    } else {
      if (matchValue$$14.tag === 1) {
        const er = matchValue$$14.fields[0];
        return new _Option.Result(1, "Error", er);
      } else {
        throw new Error("The match cases were incomplete");
      }
    }
  } else {
    const v = matchValue$$14.fields[0];
    return new _Option.Result(0, "Ok", (0, _Option.some)(v));
  }
}

function optional(fieldName$$1, decoder$$8, path$$18, value$$31) {
  if (value$$31 === null ? false : Object.getPrototypeOf(value$$31 || false) === Object.prototype) {
    const fieldValue = value$$31[fieldName$$1];

    if (Helpers$$$isUndefined(fieldValue)) {
      return new _Option.Result(0, "Ok", null);
    } else {
      return decodeMaybeNull(path$$18 + "." + fieldName$$1, decoder$$8, fieldValue);
    }
  } else {
    return new _Option.Result(1, "Error", [path$$18, new _Types.ErrorReason(2, "BadType", "an object", value$$31)]);
  }
}

function badPathError(fieldNames, currentPath, value$$32) {
  const currentPath$$1 = (0, _Option.defaultArg)(currentPath, (0, _String.join)(".", ...new _Types2.List("$", fieldNames)));
  const msg$$9 = "an object with path `" + (0, _String.join)(".", ...fieldNames) + "`";
  return new _Option.Result(1, "Error", [currentPath$$1, new _Types.ErrorReason(4, "BadPath", msg$$9, value$$32, (0, _Option.defaultArg)((0, _List.tryLast)(fieldNames), ""))]);
}

function optionalAt(fieldNames$$1, decoder$$9, firstPath, firstValue) {
  const _arg1 = (0, _List.fold)(function folder(tupledArg, field$$1) {
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
  }, [firstPath, firstValue, null], fieldNames$$1);

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

function field(fieldName$$4, decoder$$10, path$$19, value$$34) {
  if (value$$34 === null ? false : Object.getPrototypeOf(value$$34 || false) === Object.prototype) {
    const fieldValue$$1 = value$$34[fieldName$$4];

    if (Helpers$$$isUndefined(fieldValue$$1)) {
      return new _Option.Result(1, "Error", [path$$19, new _Types.ErrorReason(3, "BadField", "an object with a field named `" + fieldName$$4 + "`", value$$34)]);
    } else {
      return decoder$$10(path$$19 + "." + fieldName$$4, fieldValue$$1);
    }
  } else {
    return new _Option.Result(1, "Error", [path$$19, new _Types.ErrorReason(2, "BadType", "an object", value$$34)]);
  }
}

function at(fieldNames$$2, decoder$$11, firstPath$$1, firstValue$$1) {
  const _arg1$$1 = (0, _List.fold)(function folder$$1(tupledArg$$1, field$$2) {
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
  }, [firstPath$$1, firstValue$$1, null], fieldNames$$2);

  if (_arg1$$1[2] == null) {
    return decoder$$11(_arg1$$1[0], _arg1$$1[1]);
  } else {
    const res$$8 = _arg1$$1[2];
    return res$$8;
  }
}

function index(requestedIndex, decoder$$12, path$$20, value$$35) {
  var copyOfStruct;
  const currentPath$$2 = path$$20 + ".[" + (0, _Util.int32ToString)(requestedIndex) + "]";

  if (Array.isArray(value$$35)) {
    const vArray = value$$35;

    if (requestedIndex < vArray.length) {
      return decoder$$12(currentPath$$2, vArray[requestedIndex]);
    } else {
      const msg$$10 = "a longer array. Need index `" + (0, _Util.int32ToString)(requestedIndex) + "` but there are only `" + (copyOfStruct = vArray.length | 0, (0, _Util.int32ToString)(copyOfStruct)) + "` entries";
      return new _Option.Result(1, "Error", [currentPath$$2, new _Types.ErrorReason(5, "TooSmallArray", msg$$10, value$$35)]);
    }
  } else {
    return new _Option.Result(1, "Error", [currentPath$$2, new _Types.ErrorReason(0, "BadPrimitive", "an array", value$$35)]);
  }
}

function option(decoder$$13, path$$21, value$$36) {
  if (value$$36 == null) {
    return new _Option.Result(0, "Ok", null);
  } else {
    return (0, _Option.mapOk)(function mapping(arg0$$35) {
      return (0, _Option.some)(arg0$$35);
    }, decoder$$13(path$$21, value$$36));
  }
}

function list(decoder$$14, path$$22, value$$37) {
  if (Array.isArray(value$$37)) {
    let i = -1 | 0;
    const tokens = value$$37;
    return (0, _Option.mapOk)(_List.reverse, (0, _Array.fold)(function folder$$2(acc, value$$38) {
      i = i + 1;

      if (acc.tag === 0) {
        const acc$$1 = acc.fields[0];
        const matchValue$$15 = decoder$$14(path$$22 + ".[" + (0, _Util.int32ToString)(i) + "]", value$$38);

        if (matchValue$$15.tag === 0) {
          const value$$39 = matchValue$$15.fields[0];
          return new _Option.Result(0, "Ok", new _Types2.List(value$$39, acc$$1));
        } else {
          const er$$1 = matchValue$$15.fields[0];
          return new _Option.Result(1, "Error", er$$1);
        }
      } else {
        return acc;
      }
    }, new _Option.Result(0, "Ok", new _Types2.List()), tokens));
  } else {
    return new _Option.Result(1, "Error", [path$$22, new _Types.ErrorReason(0, "BadPrimitive", "a list", value$$37)]);
  }
}

function array(decoder$$15, path$$23, value$$40) {
  if (Array.isArray(value$$40)) {
    let i$$1 = -1 | 0;
    const tokens$$1 = value$$40;
    const arr = (0, _Array.fill)(new Array(tokens$$1.length), 0, tokens$$1.length, null);
    return (0, _Array.fold)(function folder$$3(acc$$2, value$$41) {
      i$$1 = i$$1 + 1;

      if (acc$$2.tag === 0) {
        const acc$$3 = acc$$2.fields[0];
        const matchValue$$16 = decoder$$15(path$$23 + ".[" + (0, _Util.int32ToString)(i$$1) + "]", value$$41);

        if (matchValue$$16.tag === 0) {
          const value$$42 = matchValue$$16.fields[0];
          acc$$3[i$$1] = value$$42;
          return new _Option.Result(0, "Ok", acc$$3);
        } else {
          const er$$2 = matchValue$$16.fields[0];
          return new _Option.Result(1, "Error", er$$2);
        }
      } else {
        return acc$$2;
      }
    }, new _Option.Result(0, "Ok", arr), tokens$$1);
  } else {
    return new _Option.Result(1, "Error", [path$$23, new _Types.ErrorReason(0, "BadPrimitive", "an array", value$$40)]);
  }
}

function keyValuePairs(decoder$$16, path$$24, value$$43) {
  if (value$$43 === null ? false : Object.getPrototypeOf(value$$43 || false) === Object.prototype) {
    return (0, _Option.mapOk)(_List.reverse, (0, _Seq.fold)(function folder$$4(acc$$4, prop) {
      if (acc$$4.tag === 0) {
        const acc$$5 = acc$$4.fields[0];
        const matchValue$$17 = decoder$$16(path$$24, value$$43[prop]);

        if (matchValue$$17.tag === 0) {
          const value$$44 = matchValue$$17.fields[0];
          return new _Option.Result(0, "Ok", new _Types2.List([prop, value$$44], acc$$5));
        } else {
          const er$$3 = matchValue$$17.fields[0];
          return new _Option.Result(1, "Error", er$$3);
        }
      } else {
        return acc$$4;
      }
    }, new _Option.Result(0, "Ok", new _Types2.List()), Object.keys(value$$43)));
  } else {
    return new _Option.Result(1, "Error", [path$$24, new _Types.ErrorReason(0, "BadPrimitive", "an object", value$$43)]);
  }
}

function oneOf(decoders, path$$25, value$$45) {
  const runner = function runner(decoders$$1, errors) {
    runner: while (true) {
      if (decoders$$1.tail == null) {
        return new _Option.Result(1, "Error", [path$$25, new _Types.ErrorReason(7, "BadOneOf", errors)]);
      } else {
        const tail = decoders$$1.tail;
        const head = decoders$$1.head;
        const matchValue$$18 = fromValue(path$$25, (0, _Util.uncurry)(2, head), value$$45);

        if (matchValue$$18.tag === 1) {
          const error$$3 = matchValue$$18.fields[0];
          const $errors$$55 = errors;
          decoders$$1 = tail;
          errors = (0, _List.append)($errors$$55, new _Types2.List(error$$3, new _Types2.List()));
          continue runner;
        } else {
          const v$$1 = matchValue$$18.fields[0];
          return new _Option.Result(0, "Ok", v$$1);
        }
      }

      break;
    }
  };

  return runner(decoders, new _Types2.List());
}

function nil(output, path$$26, value$$46) {
  if (value$$46 == null) {
    return new _Option.Result(0, "Ok", output);
  } else {
    return new _Option.Result(1, "Error", [path$$26, new _Types.ErrorReason(0, "BadPrimitive", "null", value$$46)]);
  }
}

function value(_arg1$$2, v$$2) {
  return new _Option.Result(0, "Ok", v$$2);
}

function succeed(output$$1, _arg2, _arg1$$3) {
  return new _Option.Result(0, "Ok", output$$1);
}

function fail(msg$$11, path$$27, _arg1$$4) {
  return new _Option.Result(1, "Error", [path$$27, new _Types.ErrorReason(6, "FailMessage", msg$$11)]);
}

function andThen(cb, decoder$$17, path$$28, value$$47) {
  const matchValue$$19 = decoder$$17(path$$28, value$$47);

  if (matchValue$$19.tag === 0) {
    const result$$3 = matchValue$$19.fields[0];
    return cb(result$$3, path$$28, value$$47);
  } else {
    const error$$4 = matchValue$$19.fields[0];
    return new _Option.Result(1, "Error", error$$4);
  }
}

function map(ctor, d1, path$$29, value$$48) {
  const matchValue$$20 = d1(path$$29, value$$48);

  if (matchValue$$20.tag === 1) {
    const er$$4 = matchValue$$20.fields[0];
    return new _Option.Result(1, "Error", er$$4);
  } else {
    const v1 = matchValue$$20.fields[0];
    return new _Option.Result(0, "Ok", ctor(v1));
  }
}

function map2(ctor$$1, d1$$1, d2, path$$30, value$$49) {
  const matchValue$$21 = [d1$$1(path$$30, value$$49), d2(path$$30, value$$49)];

  if (matchValue$$21[0].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$21[0].fields[0]);
  } else if (matchValue$$21[1].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$21[1].fields[0]);
  } else {
    return new _Option.Result(0, "Ok", ctor$$1(matchValue$$21[0].fields[0], matchValue$$21[1].fields[0]));
  }
}

function map3(ctor$$2, d1$$2, d2$$1, d3, path$$31, value$$50) {
  const matchValue$$22 = [d1$$2(path$$31, value$$50), d2$$1(path$$31, value$$50), d3(path$$31, value$$50)];

  if (matchValue$$22[0].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$22[0].fields[0]);
  } else if (matchValue$$22[1].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$22[1].fields[0]);
  } else if (matchValue$$22[2].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$22[2].fields[0]);
  } else {
    return new _Option.Result(0, "Ok", ctor$$2(matchValue$$22[0].fields[0], matchValue$$22[1].fields[0], matchValue$$22[2].fields[0]));
  }
}

function map4(ctor$$3, d1$$3, d2$$2, d3$$1, d4, path$$32, value$$51) {
  const matchValue$$23 = [d1$$3(path$$32, value$$51), d2$$2(path$$32, value$$51), d3$$1(path$$32, value$$51), d4(path$$32, value$$51)];

  if (matchValue$$23[0].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$23[0].fields[0]);
  } else if (matchValue$$23[1].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$23[1].fields[0]);
  } else if (matchValue$$23[2].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$23[2].fields[0]);
  } else if (matchValue$$23[3].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$23[3].fields[0]);
  } else {
    return new _Option.Result(0, "Ok", ctor$$3(matchValue$$23[0].fields[0], matchValue$$23[1].fields[0], matchValue$$23[2].fields[0], matchValue$$23[3].fields[0]));
  }
}

function map5(ctor$$4, d1$$4, d2$$3, d3$$2, d4$$1, d5, path$$33, value$$52) {
  const matchValue$$24 = [d1$$4(path$$33, value$$52), d2$$3(path$$33, value$$52), d3$$2(path$$33, value$$52), d4$$1(path$$33, value$$52), d5(path$$33, value$$52)];

  if (matchValue$$24[0].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$24[0].fields[0]);
  } else if (matchValue$$24[1].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$24[1].fields[0]);
  } else if (matchValue$$24[2].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$24[2].fields[0]);
  } else if (matchValue$$24[3].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$24[3].fields[0]);
  } else if (matchValue$$24[4].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$24[4].fields[0]);
  } else {
    return new _Option.Result(0, "Ok", ctor$$4(matchValue$$24[0].fields[0], matchValue$$24[1].fields[0], matchValue$$24[2].fields[0], matchValue$$24[3].fields[0], matchValue$$24[4].fields[0]));
  }
}

function map6(ctor$$5, d1$$5, d2$$4, d3$$3, d4$$2, d5$$1, d6, path$$34, value$$53) {
  const matchValue$$25 = [d1$$5(path$$34, value$$53), d2$$4(path$$34, value$$53), d3$$3(path$$34, value$$53), d4$$2(path$$34, value$$53), d5$$1(path$$34, value$$53), d6(path$$34, value$$53)];

  if (matchValue$$25[0].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$25[0].fields[0]);
  } else if (matchValue$$25[1].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$25[1].fields[0]);
  } else if (matchValue$$25[2].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$25[2].fields[0]);
  } else if (matchValue$$25[3].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$25[3].fields[0]);
  } else if (matchValue$$25[4].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$25[4].fields[0]);
  } else if (matchValue$$25[5].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$25[5].fields[0]);
  } else {
    return new _Option.Result(0, "Ok", ctor$$5(matchValue$$25[0].fields[0], matchValue$$25[1].fields[0], matchValue$$25[2].fields[0], matchValue$$25[3].fields[0], matchValue$$25[4].fields[0], matchValue$$25[5].fields[0]));
  }
}

function map7(ctor$$6, d1$$6, d2$$5, d3$$4, d4$$3, d5$$2, d6$$1, d7, path$$35, value$$54) {
  const matchValue$$26 = [d1$$6(path$$35, value$$54), d2$$5(path$$35, value$$54), d3$$4(path$$35, value$$54), d4$$3(path$$35, value$$54), d5$$2(path$$35, value$$54), d6$$1(path$$35, value$$54), d7(path$$35, value$$54)];

  if (matchValue$$26[0].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$26[0].fields[0]);
  } else if (matchValue$$26[1].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$26[1].fields[0]);
  } else if (matchValue$$26[2].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$26[2].fields[0]);
  } else if (matchValue$$26[3].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$26[3].fields[0]);
  } else if (matchValue$$26[4].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$26[4].fields[0]);
  } else if (matchValue$$26[5].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$26[5].fields[0]);
  } else if (matchValue$$26[6].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$26[6].fields[0]);
  } else {
    return new _Option.Result(0, "Ok", ctor$$6(matchValue$$26[0].fields[0], matchValue$$26[1].fields[0], matchValue$$26[2].fields[0], matchValue$$26[3].fields[0], matchValue$$26[4].fields[0], matchValue$$26[5].fields[0], matchValue$$26[6].fields[0]));
  }
}

function map8(ctor$$7, d1$$7, d2$$6, d3$$5, d4$$4, d5$$3, d6$$2, d7$$1, d8, path$$36, value$$55) {
  const matchValue$$27 = [d1$$7(path$$36, value$$55), d2$$6(path$$36, value$$55), d3$$5(path$$36, value$$55), d4$$4(path$$36, value$$55), d5$$3(path$$36, value$$55), d6$$2(path$$36, value$$55), d7$$1(path$$36, value$$55), d8(path$$36, value$$55)];

  if (matchValue$$27[0].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$27[0].fields[0]);
  } else if (matchValue$$27[1].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$27[1].fields[0]);
  } else if (matchValue$$27[2].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$27[2].fields[0]);
  } else if (matchValue$$27[3].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$27[3].fields[0]);
  } else if (matchValue$$27[4].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$27[4].fields[0]);
  } else if (matchValue$$27[5].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$27[5].fields[0]);
  } else if (matchValue$$27[6].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$27[6].fields[0]);
  } else if (matchValue$$27[7].tag === 1) {
    return new _Option.Result(1, "Error", matchValue$$27[7].fields[0]);
  } else {
    return new _Option.Result(0, "Ok", ctor$$7(matchValue$$27[0].fields[0], matchValue$$27[1].fields[0], matchValue$$27[2].fields[0], matchValue$$27[3].fields[0], matchValue$$27[4].fields[0], matchValue$$27[5].fields[0], matchValue$$27[6].fields[0], matchValue$$27[7].fields[0]));
  }
}

function dict(decoder$$18) {
  return function (path$$38) {
    return function (value$$57) {
      return map(function ctor$$8(elements) {
        return (0, _Map.ofList)(elements, {
          Compare: _Util.comparePrimitives
        });
      }, function d1$$8(path$$37, value$$56) {
        return keyValuePairs(decoder$$18, path$$37, value$$56);
      }, path$$38, value$$57);
    };
  };
}

function unwrapWith(errors$$1, path$$39, decoder$$20, value$$58) {
  const matchValue$$28 = function (arg00$$3) {
    const clo1$$2 = (0, _Util.partialApply)(1, decoder$$20, [arg00$$3]);
    return function (arg10$$2) {
      return clo1$$2(arg10$$2);
    };
  }(path$$39)(value$$58);

  if (matchValue$$28.tag === 1) {
    const er$$40 = matchValue$$28.fields[0];
    errors$$1.push(er$$40);
    return null;
  } else {
    const v$$3 = matchValue$$28.fields[0];
    return v$$3;
  }
}

const Getters$00601 = (0, _Types2.declare)(function Thoth_Json_Decode_Getters(path$$40, v$$4) {
  const $this$$3 = this;
  $this$$3.errors = [];
  $this$$3.required = {
    Field(fieldName$$8, decoder$$21) {
      return unwrapWith($this$$3.errors, path$$40, function (path$$41, value$$59) {
        return field(fieldName$$8, decoder$$21, path$$41, value$$59);
      }, v$$4);
    },

    At(fieldNames$$3, decoder$$23) {
      return unwrapWith($this$$3.errors, path$$40, function (firstPath$$2, firstValue$$2) {
        return at(fieldNames$$3, decoder$$23, firstPath$$2, firstValue$$2);
      }, v$$4);
    },

    Raw(decoder$$25) {
      return unwrapWith($this$$3.errors, path$$40, decoder$$25, v$$4);
    }

  };
  $this$$3.optional = {
    Field(fieldName$$9, decoder$$26) {
      return unwrapWith($this$$3.errors, path$$40, function (path$$42, value$$60) {
        return optional(fieldName$$9, decoder$$26, path$$42, value$$60);
      }, v$$4);
    },

    At(fieldNames$$4, decoder$$28) {
      return unwrapWith($this$$3.errors, path$$40, function (firstPath$$3, firstValue$$3) {
        return optionalAt(fieldNames$$4, decoder$$28, firstPath$$3, firstValue$$3);
      }, v$$4);
    },

    Raw(decoder$$30) {
      const matchValue$$29 = function (arg00$$4) {
        const clo1$$3 = (0, _Util.partialApply)(1, decoder$$30, [arg00$$4]);
        return function (arg10$$3) {
          return clo1$$3(arg10$$3);
        };
      }(path$$40)(v$$4);

      if (matchValue$$29.tag === 1) {
        const reason$$2 = matchValue$$29.fields[0][1];
        const error$$5 = matchValue$$29.fields[0];
        var $target$$125, v$$6;

        switch (reason$$2.tag) {
          case 1:
            $target$$125 = 0;
            v$$6 = reason$$2.fields[1];
            break;

          case 2:
            $target$$125 = 0;
            v$$6 = reason$$2.fields[1];
            break;

          case 3:
          case 4:
            $target$$125 = 1;
            break;

          case 5:
          case 6:
          case 7:
            $target$$125 = 2;
            break;

          default:
            $target$$125 = 0;
            v$$6 = reason$$2.fields[1];
        }

        switch ($target$$125) {
          case 0:
            {
              if (v$$6 == null) {
                return null;
              } else {
                $this$$3.errors.push(error$$5);
                return null;
              }
            }

          case 1:
            {
              return null;
            }

          case 2:
            {
              $this$$3.errors.push(error$$5);
              return null;
            }
        }
      } else {
        const v$$5 = matchValue$$29.fields[0];
        return (0, _Option.some)(v$$5);
      }
    }

  };
});
exports.Getters$00601 = Getters$00601;

function Getters$00601$reflection($gen$$126) {
  return (0, _Reflection.type)("Thoth.Json.Decode.Getters`1", [$gen$$126]);
}

function Getters$00601$$$$002Ector$$4A51B60E(path$$40, v$$4) {
  return this instanceof Getters$00601 ? Getters$00601.call(this, path$$40, v$$4) : new Getters$00601(path$$40, v$$4);
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

function object(builder, path$$43, v$$7) {
  const getters = Getters$00601$$$$002Ector$$4A51B60E(path$$43, v$$7);
  const result$$4 = builder(getters);
  const matchValue$$30 = Getters$00601$$get_Errors(getters);

  if (matchValue$$30.tail != null) {
    const fst = matchValue$$30.head;
    const errors$$2 = matchValue$$30;

    if ((0, _List.length)(errors$$2) > 1) {
      const errors$$3 = (0, _List.map)(function (tupledArg$$2) {
        return errorToString(tupledArg$$2[0], tupledArg$$2[1]);
      }, errors$$2);
      return new _Option.Result(1, "Error", [path$$43, new _Types.ErrorReason(7, "BadOneOf", errors$$3)]);
    } else {
      return new _Option.Result(1, "Error", fst);
    }
  } else {
    return new _Option.Result(0, "Ok", result$$4);
  }
}

function tuple2(decoder1, decoder2) {
  return function (path$$48) {
    return function (value$$64) {
      return andThen(function cb$$2(v1$$8, path$$47, value$$63) {
        return andThen((0, _Util.uncurry)(3, function cb$$1(v2$$7) {
          const output$$2 = [v1$$8, v2$$7];
          return function (arg10$0040) {
            return function (arg20$0040) {
              return succeed(output$$2, arg10$0040, arg20$0040);
            };
          };
        }), function (path$$46, value$$62) {
          return index(1, decoder2, path$$46, value$$62);
        }, path$$47, value$$63);
      }, function (path$$45, value$$61) {
        return index(0, decoder1, path$$45, value$$61);
      }, path$$48, value$$64);
    };
  };
}

function tuple3(decoder1$$1, decoder2$$1, decoder3) {
  return function (path$$54) {
    return function (value$$70) {
      return andThen(function cb$$5(v1$$9, path$$53, value$$69) {
        return andThen(function cb$$4(v2$$8, path$$52, value$$68) {
          return andThen((0, _Util.uncurry)(3, function cb$$3(v3$$6) {
            const output$$3 = [v1$$9, v2$$8, v3$$6];
            return function (arg10$0040$$1) {
              return function (arg20$0040$$1) {
                return succeed(output$$3, arg10$0040$$1, arg20$0040$$1);
              };
            };
          }), function (path$$51, value$$67) {
            return index(2, decoder3, path$$51, value$$67);
          }, path$$52, value$$68);
        }, function (path$$50, value$$66) {
          return index(1, decoder2$$1, path$$50, value$$66);
        }, path$$53, value$$69);
      }, function (path$$49, value$$65) {
        return index(0, decoder1$$1, path$$49, value$$65);
      }, path$$54, value$$70);
    };
  };
}

function tuple4(decoder1$$2, decoder2$$2, decoder3$$1, decoder4) {
  return function (path$$62) {
    return function (value$$78) {
      return andThen(function cb$$9(v1$$10, path$$61, value$$77) {
        return andThen(function cb$$8(v2$$9, path$$60, value$$76) {
          return andThen(function cb$$7(v3$$7, path$$59, value$$75) {
            return andThen((0, _Util.uncurry)(3, function cb$$6(v4$$5) {
              const output$$4 = [v1$$10, v2$$9, v3$$7, v4$$5];
              return function (arg10$0040$$2) {
                return function (arg20$0040$$2) {
                  return succeed(output$$4, arg10$0040$$2, arg20$0040$$2);
                };
              };
            }), function (path$$58, value$$74) {
              return index(3, decoder4, path$$58, value$$74);
            }, path$$59, value$$75);
          }, function (path$$57, value$$73) {
            return index(2, decoder3$$1, path$$57, value$$73);
          }, path$$60, value$$76);
        }, function (path$$56, value$$72) {
          return index(1, decoder2$$2, path$$56, value$$72);
        }, path$$61, value$$77);
      }, function (path$$55, value$$71) {
        return index(0, decoder1$$2, path$$55, value$$71);
      }, path$$62, value$$78);
    };
  };
}

function tuple5(decoder1$$3, decoder2$$3, decoder3$$2, decoder4$$1, decoder5) {
  return function (path$$72) {
    return function (value$$88) {
      return andThen(function cb$$14(v1$$11, path$$71, value$$87) {
        return andThen(function cb$$13(v2$$10, path$$70, value$$86) {
          return andThen(function cb$$12(v3$$8, path$$69, value$$85) {
            return andThen(function cb$$11(v4$$6, path$$68, value$$84) {
              return andThen((0, _Util.uncurry)(3, function cb$$10(v5$$4) {
                const output$$5 = [v1$$11, v2$$10, v3$$8, v4$$6, v5$$4];
                return function (arg10$0040$$3) {
                  return function (arg20$0040$$3) {
                    return succeed(output$$5, arg10$0040$$3, arg20$0040$$3);
                  };
                };
              }), function (path$$67, value$$83) {
                return index(4, decoder5, path$$67, value$$83);
              }, path$$68, value$$84);
            }, function (path$$66, value$$82) {
              return index(3, decoder4$$1, path$$66, value$$82);
            }, path$$69, value$$85);
          }, function (path$$65, value$$81) {
            return index(2, decoder3$$2, path$$65, value$$81);
          }, path$$70, value$$86);
        }, function (path$$64, value$$80) {
          return index(1, decoder2$$3, path$$64, value$$80);
        }, path$$71, value$$87);
      }, function (path$$63, value$$79) {
        return index(0, decoder1$$3, path$$63, value$$79);
      }, path$$72, value$$88);
    };
  };
}

function tuple6(decoder1$$4, decoder2$$4, decoder3$$3, decoder4$$2, decoder5$$1, decoder6) {
  return function (path$$84) {
    return function (value$$100) {
      return andThen(function cb$$20(v1$$12, path$$83, value$$99) {
        return andThen(function cb$$19(v2$$11, path$$82, value$$98) {
          return andThen(function cb$$18(v3$$9, path$$81, value$$97) {
            return andThen(function cb$$17(v4$$7, path$$80, value$$96) {
              return andThen(function cb$$16(v5$$5, path$$79, value$$95) {
                return andThen((0, _Util.uncurry)(3, function cb$$15(v6$$3) {
                  const output$$6 = [v1$$12, v2$$11, v3$$9, v4$$7, v5$$5, v6$$3];
                  return function (arg10$0040$$4) {
                    return function (arg20$0040$$4) {
                      return succeed(output$$6, arg10$0040$$4, arg20$0040$$4);
                    };
                  };
                }), function (path$$78, value$$94) {
                  return index(5, decoder6, path$$78, value$$94);
                }, path$$79, value$$95);
              }, function (path$$77, value$$93) {
                return index(4, decoder5$$1, path$$77, value$$93);
              }, path$$80, value$$96);
            }, function (path$$76, value$$92) {
              return index(3, decoder4$$2, path$$76, value$$92);
            }, path$$81, value$$97);
          }, function (path$$75, value$$91) {
            return index(2, decoder3$$3, path$$75, value$$91);
          }, path$$82, value$$98);
        }, function (path$$74, value$$90) {
          return index(1, decoder2$$4, path$$74, value$$90);
        }, path$$83, value$$99);
      }, function (path$$73, value$$89) {
        return index(0, decoder1$$4, path$$73, value$$89);
      }, path$$84, value$$100);
    };
  };
}

function tuple7(decoder1$$5, decoder2$$5, decoder3$$4, decoder4$$3, decoder5$$2, decoder6$$1, decoder7) {
  return function (path$$98) {
    return function (value$$114) {
      return andThen(function cb$$27(v1$$13, path$$97, value$$113) {
        return andThen(function cb$$26(v2$$12, path$$96, value$$112) {
          return andThen(function cb$$25(v3$$10, path$$95, value$$111) {
            return andThen(function cb$$24(v4$$8, path$$94, value$$110) {
              return andThen(function cb$$23(v5$$6, path$$93, value$$109) {
                return andThen(function cb$$22(v6$$4, path$$92, value$$108) {
                  return andThen((0, _Util.uncurry)(3, function cb$$21(v7$$2) {
                    const output$$7 = [v1$$13, v2$$12, v3$$10, v4$$8, v5$$6, v6$$4, v7$$2];
                    return function (arg10$0040$$5) {
                      return function (arg20$0040$$5) {
                        return succeed(output$$7, arg10$0040$$5, arg20$0040$$5);
                      };
                    };
                  }), function (path$$91, value$$107) {
                    return index(6, decoder7, path$$91, value$$107);
                  }, path$$92, value$$108);
                }, function (path$$90, value$$106) {
                  return index(5, decoder6$$1, path$$90, value$$106);
                }, path$$93, value$$109);
              }, function (path$$89, value$$105) {
                return index(4, decoder5$$2, path$$89, value$$105);
              }, path$$94, value$$110);
            }, function (path$$88, value$$104) {
              return index(3, decoder4$$3, path$$88, value$$104);
            }, path$$95, value$$111);
          }, function (path$$87, value$$103) {
            return index(2, decoder3$$4, path$$87, value$$103);
          }, path$$96, value$$112);
        }, function (path$$86, value$$102) {
          return index(1, decoder2$$5, path$$86, value$$102);
        }, path$$97, value$$113);
      }, function (path$$85, value$$101) {
        return index(0, decoder1$$5, path$$85, value$$101);
      }, path$$98, value$$114);
    };
  };
}

function tuple8(decoder1$$6, decoder2$$6, decoder3$$5, decoder4$$4, decoder5$$3, decoder6$$2, decoder7$$1, decoder8) {
  return function (path$$114) {
    return function (value$$130) {
      return andThen(function cb$$35(v1$$14, path$$113, value$$129) {
        return andThen(function cb$$34(v2$$13, path$$112, value$$128) {
          return andThen(function cb$$33(v3$$11, path$$111, value$$127) {
            return andThen(function cb$$32(v4$$9, path$$110, value$$126) {
              return andThen(function cb$$31(v5$$7, path$$109, value$$125) {
                return andThen(function cb$$30(v6$$5, path$$108, value$$124) {
                  return andThen(function cb$$29(v7$$3, path$$107, value$$123) {
                    return andThen((0, _Util.uncurry)(3, function cb$$28(v8$$1) {
                      const output$$8 = [v1$$14, v2$$13, v3$$11, v4$$9, v5$$7, v6$$5, v7$$3, v8$$1];
                      return function (arg10$0040$$6) {
                        return function (arg20$0040$$6) {
                          return succeed(output$$8, arg10$0040$$6, arg20$0040$$6);
                        };
                      };
                    }), function (path$$106, value$$122) {
                      return index(7, decoder8, path$$106, value$$122);
                    }, path$$107, value$$123);
                  }, function (path$$105, value$$121) {
                    return index(6, decoder7$$1, path$$105, value$$121);
                  }, path$$108, value$$124);
                }, function (path$$104, value$$120) {
                  return index(5, decoder6$$2, path$$104, value$$120);
                }, path$$109, value$$125);
              }, function (path$$103, value$$119) {
                return index(4, decoder5$$3, path$$103, value$$119);
              }, path$$110, value$$126);
            }, function (path$$102, value$$118) {
              return index(3, decoder4$$4, path$$102, value$$118);
            }, path$$111, value$$127);
          }, function (path$$101, value$$117) {
            return index(2, decoder3$$5, path$$101, value$$117);
          }, path$$112, value$$128);
        }, function (path$$100, value$$116) {
          return index(1, decoder2$$6, path$$100, value$$116);
        }, path$$113, value$$129);
      }, function (path$$99, value$$115) {
        return index(0, decoder1$$6, path$$99, value$$115);
      }, path$$114, value$$130);
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

function autoObject(decoderInfos, path$$115, value$$131) {
  if (!(value$$131 === null ? false : Object.getPrototypeOf(value$$131 || false) === Object.prototype)) {
    return new _Option.Result(1, "Error", [path$$115, new _Types.ErrorReason(0, "BadPrimitive", "an object", value$$131)]);
  } else {
    return (0, _Array.foldBack)(function folder$$5(tupledArg$$3, acc$$6) {
      if (acc$$6.tag === 0) {
        const result$$5 = acc$$6.fields[0];
        return (0, _Option.mapOk)(function mapping$$3(v$$8) {
          return new _Types2.List(v$$8, result$$5);
        }, tupledArg$$3[1](path$$115 + "." + tupledArg$$3[0])(value$$131[tupledArg$$3[0]]));
      } else {
        return acc$$6;
      }
    }, decoderInfos, new _Option.Result(0, "Ok", new _Types2.List()));
  }
}

function autoObject2(keyDecoder, valueDecoder, path$$116, value$$132) {
  if (!(value$$132 === null ? false : Object.getPrototypeOf(value$$132 || false) === Object.prototype)) {
    return new _Option.Result(1, "Error", [path$$116, new _Types.ErrorReason(0, "BadPrimitive", "an object", value$$132)]);
  } else {
    return (0, _Seq.fold)(function folder$$6(acc$$7, name$$1) {
      if (acc$$7.tag === 0) {
        const acc$$8 = acc$$7.fields[0];

        const matchValue$$31 = function (arg00$$6) {
          const clo1$$4 = (0, _Util.partialApply)(1, keyDecoder, [arg00$$6]);
          return function (arg10$$4) {
            return clo1$$4(arg10$$4);
          };
        }(path$$116)(name$$1);

        if (matchValue$$31.tag === 0) {
          const k = matchValue$$31.fields[0];

          const _arg1$$5 = valueDecoder(path$$116 + "." + name$$1, value$$132[name$$1]);

          if (_arg1$$5.tag === 0) {
            const v$$9 = _arg1$$5.fields[0];
            return new _Option.Result(0, "Ok", new _Types2.List([k, v$$9], acc$$8));
          } else {
            const er$$42 = _arg1$$5.fields[0];
            return new _Option.Result(1, "Error", er$$42);
          }
        } else {
          const er$$41 = matchValue$$31.fields[0];
          return new _Option.Result(1, "Error", er$$41);
        }
      } else {
        return acc$$7;
      }
    }, new _Option.Result(0, "Ok", new _Types2.List()), Object.keys(value$$132));
  }
}

function mixedArray(msg$$12, decoders$$2, path$$117, values) {
  if (decoders$$2.length !== values.length) {
    return new _Option.Result(1, "Error", [path$$117, new _Types.ErrorReason(6, "FailMessage", (0, _String.toText)((0, _String.printf)("Expected %i %s but got %i"))(decoders$$2.length)(msg$$12)(values.length))]);
  } else {
    return (0, _Array.foldBack2)((0, _Util.uncurry)(3, (0, _Util.mapCurriedArgs)(function folder$$7(value$$133) {
      return function (decoder$$102) {
        return function (acc$$9) {
          if (acc$$9.tag === 0) {
            const result$$7 = acc$$9.fields[0];
            return (0, _Option.mapOk)(function mapping$$4(v$$10) {
              return new _Types2.List(v$$10, result$$7);
            }, decoder$$102(path$$117, value$$133));
          } else {
            return acc$$9;
          }
        };
      };
    }, [0, [0, 2], 0])), values, decoders$$2, new _Option.Result(0, "Ok", new _Types2.List()));
  }
}

function makeUnion(extra, isCamelCase, t, name$$2, path$$118, values$$1) {
  const uci = (0, _Array.tryFind)(function predicate(x$$12) {
    return (0, _Reflection.name)(x$$12) === name$$2;
  }, (0, _Reflection.getUnionCases)(t, true));

  if (uci != null) {
    const uci$$1 = uci;

    if (values$$1.length === 0) {
      return new _Option.Result(0, "Ok", (0, _Reflection.makeUnion)(uci$$1, [], true));
    } else {
      const decoders$$3 = (0, _Array.map)(function mapping$$5(fi) {
        return autoDecoder(extra, isCamelCase, false, fi[1]);
      }, (0, _Reflection.getUnionCaseFields)(uci$$1), Array);
      return (0, _Option.mapOk)(function mapping$$6(values$$2) {
        return (0, _Reflection.makeUnion)(uci$$1, (0, _Array.ofList)(values$$2, Array), true);
      }, mixedArray("union fields", decoders$$3, path$$118, values$$1));
    }
  } else {
    return new _Option.Result(1, "Error", [path$$118, new _Types.ErrorReason(6, "FailMessage", "Cannot find case " + name$$2 + " in " + (0, _Reflection.fullName)(t))]);
  }
}

function autoDecodeRecordsAndUnions(extra$$1, isCamelCase$$1, isOptional, t$$1) {
  const decoderRef = new _Types2.FSharpRef(null);
  const extra$$2 = (0, _Map.add)((0, _Reflection.fullName)(t$$1), decoderRef, extra$$1);
  let decoder$$103;

  if ((0, _Reflection.isRecord)(t$$1, true)) {
    const decoders$$4 = (0, _Array.map)(function mapping$$7(fi$$1) {
      const name$$3 = isCamelCase$$1 ? (0, _Reflection.name)(fi$$1).slice(null, 0 + 1).toLowerCase() + (0, _Reflection.name)(fi$$1).slice(1, (0, _Reflection.name)(fi$$1).length) : (0, _Reflection.name)(fi$$1);
      return [name$$3, autoDecoder(extra$$2, isCamelCase$$1, false, fi$$1[1])];
    }, (0, _Reflection.getRecordElements)(t$$1, true), Array);

    decoder$$103 = function (path$$119) {
      return function (value$$134) {
        return (0, _Option.mapOk)(function mapping$$8(xs$$2) {
          return (0, _Reflection.makeRecord)(t$$1, (0, _Array.ofList)(xs$$2, Array), true);
        }, autoObject(decoders$$4, path$$119, value$$134));
      };
    };
  } else if ((0, _Reflection.isUnion)(t$$1, true)) {
    decoder$$103 = function (path$$120) {
      return function (value$$135) {
        if (typeof value$$135 === "string") {
          const name$$4 = value$$135;
          return makeUnion(extra$$2, isCamelCase$$1, t$$1, name$$4, path$$120, []);
        } else if (Array.isArray(value$$135)) {
          const values$$3 = value$$135;
          const name$$5 = values$$3[0];
          return makeUnion(extra$$2, isCamelCase$$1, t$$1, name$$5, path$$120, values$$3.slice(1, values$$3.length));
        } else {
          return new _Option.Result(1, "Error", [path$$120, new _Types.ErrorReason(0, "BadPrimitive", "a string or array", value$$135)]);
        }
      };
    };
  } else if (isOptional) {
    decoder$$103 = function (path$$121) {
      return function (value$$136) {
        return new _Option.Result(1, "Error", [path$$121, new _Types.ErrorReason(2, "BadType", "an extra coder for " + (0, _Reflection.fullName)(t$$1), value$$136)]);
      };
    };
  } else {
    decoder$$103 = function (message) {
      throw new Error(message);
    }((0, _String.toText)((0, _String.printf)("Cannot generate auto decoder for %s. Please pass an extra decoder."))((0, _Reflection.fullName)(t$$1)));
  }

  decoderRef.contents = decoder$$103;
  return decoder$$103;
}

function autoDecoder(extra$$3, isCamelCase$$2, isOptional$$1, t$$2) {
  var decoder$$105, decoder$$106, decoder$$107;
  const fullname = (0, _Reflection.fullName)(t$$2);
  const matchValue$$32 = (0, _Map.tryFind)(fullname, extra$$3);

  if (matchValue$$32 == null) {
    if ((0, _Reflection.isArray)(t$$2)) {
      const decoder$$104 = function (t$$3) {
        return autoDecoder(extra$$3, isCamelCase$$2, false, t$$3);
      }((0, _Reflection.getElementType)(t$$2));

      return function (d$$1) {
        return (0, _Util.curry)(2, d$$1);
      }(function (path$$123, value$$138) {
        return array((0, _Util.uncurry)(2, decoder$$104), path$$123, value$$138);
      });
    } else if ((0, _Reflection.isGenericType)(t$$2)) {
      if ((0, _Reflection.isTuple)(t$$2)) {
        const decoders$$5 = (0, _Array.map)(function mapping$$9(t$$4) {
          return autoDecoder(extra$$3, isCamelCase$$2, false, t$$4);
        }, (0, _Reflection.getTupleElements)(t$$2), Array);
        return function (path$$124) {
          return function (value$$139) {
            return Array.isArray(value$$139) ? (0, _Option.mapOk)(function mapping$$10(xs$$3) {
              return (0, _Reflection.makeTuple)((0, _Array.ofList)(xs$$3, Array), t$$2);
            }, mixedArray("tuple elements", decoders$$5, path$$124, value$$139)) : new _Option.Result(1, "Error", [path$$124, new _Types.ErrorReason(0, "BadPrimitive", "an array", value$$139)]);
          };
        };
      } else {
        const fullname$$1 = (0, _Reflection.fullName)((0, _Reflection.getGenericTypeDefinition)(t$$2));

        if (fullname$$1 === "Microsoft.FSharp.Core.FSharpOption`1[System.Object]") {
          return function (d$$3) {
            return (0, _Util.curry)(2, d$$3);
          }((0, _Util.uncurry)(2, (decoder$$105 = function (t$$5) {
            return autoDecoder(extra$$3, isCamelCase$$2, true, t$$5);
          }((0, _Reflection.getGenerics)(t$$2)[0]), function (path$$125) {
            return function (value$$140) {
              return option((0, _Util.uncurry)(2, decoder$$105), path$$125, value$$140);
            };
          })));
        } else if (fullname$$1 === "Microsoft.FSharp.Collections.FSharpList`1[System.Object]") {
          return function (d$$5) {
            return (0, _Util.curry)(2, d$$5);
          }((0, _Util.uncurry)(2, (decoder$$106 = function (t$$6) {
            return autoDecoder(extra$$3, isCamelCase$$2, false, t$$6);
          }((0, _Reflection.getGenerics)(t$$2)[0]), function (path$$126) {
            return function (value$$141) {
              return list((0, _Util.uncurry)(2, decoder$$106), path$$126, value$$141);
            };
          })));
        } else if (fullname$$1 === "Microsoft.FSharp.Collections.FSharpMap`2[System.Object,System.Object]") {
          const keyDecoder$$1 = function (t$$7) {
            return autoDecoder(extra$$3, isCamelCase$$2, false, t$$7);
          }((0, _Reflection.getGenerics)(t$$2)[0]);

          const valueDecoder$$1 = function (t$$8) {
            return autoDecoder(extra$$3, isCamelCase$$2, false, t$$8);
          }((0, _Reflection.getGenerics)(t$$2)[1]);

          let d1$$9;
          const decoders$$6 = (0, _List.ofArray)([function (path$$127) {
            return function (value$$142) {
              return autoObject2((0, _Util.uncurry)(2, keyDecoder$$1), (0, _Util.uncurry)(2, valueDecoder$$1), path$$127, value$$142);
            };
          }, (decoder$$107 = tuple2((0, _Util.uncurry)(2, keyDecoder$$1), (0, _Util.uncurry)(2, valueDecoder$$1)), function (path$$128) {
            return function (value$$143) {
              return list((0, _Util.uncurry)(2, decoder$$107), path$$128, value$$143);
            };
          })]);

          d1$$9 = function (path$$129) {
            return function (value$$144) {
              return oneOf(decoders$$6, path$$129, value$$144);
            };
          };

          return function (path$$130) {
            return function (value$$146) {
              return map(function ctor$$9(ar) {
                return toMap(ar);
              }, (0, _Util.uncurry)(2, d1$$9), path$$130, value$$146);
            };
          };
        } else if (fullname$$1 === "Microsoft.FSharp.Collections.FSharpSet`1[System.Object]") {
          const decoder$$108 = function (t$$9) {
            return autoDecoder(extra$$3, isCamelCase$$2, false, t$$9);
          }((0, _Reflection.getGenerics)(t$$2)[0]);

          return function (path$$131) {
            return function (value$$147) {
              const matchValue$$33 = array((0, _Util.uncurry)(2, decoder$$108), path$$131, value$$147);

              if (matchValue$$33.tag === 0) {
                const ar$$1 = matchValue$$33.fields[0];
                return new _Option.Result(0, "Ok", toSet(ar$$1));
              } else {
                const er$$43 = matchValue$$33.fields[0];
                return new _Option.Result(1, "Error", er$$43);
              }
            };
          };
        } else {
          return autoDecodeRecordsAndUnions(extra$$3, isCamelCase$$2, isOptional$$1, t$$2);
        }
      }
    } else if (fullname === "System.Boolean") {
      return function (path$$132) {
        return function (value$$149) {
          return bool(path$$132, value$$149);
        };
      };
    } else if (fullname === "System.String") {
      return function (path$$133) {
        return function (value$$150) {
          return string(path$$133, value$$150);
        };
      };
    } else if (fullname === "System.Int32") {
      return function (path$$134) {
        return function (value$$151) {
          return int$(path$$134, value$$151);
        };
      };
    } else if (fullname === "System.UInt32") {
      return function (path$$135) {
        return function (value$$152) {
          return uint32(path$$135, value$$152);
        };
      };
    } else if (fullname === "System.Double") {
      return function (path$$136) {
        return function (value$$153) {
          return float$(path$$136, value$$153);
        };
      };
    } else if (fullname === "System.DateTime") {
      return function (path$$137) {
        return function (value$$154) {
          return datetime(path$$137, value$$154);
        };
      };
    } else if (fullname === "System.DateTimeOffset") {
      return function (path$$138) {
        return function (value$$155) {
          return datetimeOffset(path$$138, value$$155);
        };
      };
    } else if (fullname === "System.TimeSpan") {
      return function (path$$139) {
        return function (value$$156) {
          return timespan(path$$139, value$$156);
        };
      };
    } else if (fullname === "System.Guid") {
      return function (path$$140) {
        return function (value$$157) {
          return guid(path$$140, value$$157);
        };
      };
    } else if (fullname === "System.Object") {
      return function (_arg1$$6) {
        return function (v$$11) {
          return new _Option.Result(0, "Ok", v$$11);
        };
      };
    } else {
      return autoDecodeRecordsAndUnions(extra$$3, isCamelCase$$2, isOptional$$1, t$$2);
    }
  } else {
    const decoderRef$$1 = matchValue$$32;
    return function (path$$122) {
      return function (value$$137) {
        return decoderRef$$1.contents(path$$122)(value$$137);
      };
    };
  }
}

function makeExtra(extra$$4) {
  if (extra$$4 != null) {
    const e = extra$$4;
    return (0, _Map.map)(function (_arg2$$1, tupledArg$$4) {
      return new _Types2.FSharpRef(tupledArg$$4[1]);
    }, e);
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

function Auto$$$generateDecoderCached$$4AE6C623(isCamelCase$$3, extra$$5, resolver) {
  const t$$10 = resolver.ResolveType();
  return function (d$$16) {
    return (0, _Util.curry)(2, d$$16);
  }((0, _Util.uncurry)(2, (0, _Types.Util$002ECache$00601$$GetOrAdd$$43981464)(_Types.Util$$$CachedDecoders, (0, _Reflection.fullName)(t$$10), function () {
    const isCamelCase$$4 = (0, _Option.defaultArg)(isCamelCase$$3, false);
    return autoDecoder(makeExtra(extra$$5), isCamelCase$$4, false, t$$10);
  })));
}

function Auto$$$generateDecoder$$4AE6C623(isCamelCase$$5, extra$$6, resolver$$2) {
  const isCamelCase$$6 = (0, _Option.defaultArg)(isCamelCase$$5, false);
  return function (d$$18) {
    return (0, _Util.curry)(2, d$$18);
  }((0, _Util.uncurry)(2, autoDecoder(makeExtra(extra$$6), isCamelCase$$6, false, resolver$$2.ResolveType())));
}

function Auto$$$fromString$$Z33228D48(json$$1, isCamelCase$$7, extra$$8, resolver$$4) {
  const decoder$$109 = Auto$$$generateDecoder$$4AE6C623(isCamelCase$$7, extra$$8, resolver$$4);
  return fromString((0, _Util.uncurry)(2, decoder$$109), json$$1);
}

function Auto$$$unsafeFromString$$Z33228D48(json$$2, isCamelCase$$8, extra$$9, resolver$$5) {
  const decoder$$110 = Auto$$$generateDecoder$$4AE6C623(isCamelCase$$8, extra$$9, resolver$$5);
  const matchValue$$34 = fromString((0, _Util.uncurry)(2, decoder$$110), json$$2);

  if (matchValue$$34.tag === 1) {
    const msg$$13 = matchValue$$34.fields[0];
    throw new Error(msg$$13);
  } else {
    const x$$13 = matchValue$$34.fields[0];
    return x$$13;
  }
}