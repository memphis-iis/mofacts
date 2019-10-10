"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.isBigInt = isBigInt;
exports.tryParse = tryParse;
exports.parse = parse;
exports.divRem = divRem;
exports.greatestCommonDivisor = greatestCommonDivisor;
exports.pow = pow;
exports.abs = abs;
exports.fromString = fromString;
exports.fromZero = fromZero;
exports.fromOne = fromOne;
exports.fromInt64 = fromInt64;
exports.fromInt32 = fromInt32;
exports.toSByte = toSByte;
exports.toByte = toByte;
exports.toInt16 = toInt16;
exports.toUInt16 = toUInt16;
exports.toInt32 = toInt32;
exports.toUInt32 = toUInt32;
exports.toInt64 = toInt64;
exports.toUInt64 = toUInt64;
exports.toSingle = toSingle;
exports.toDouble = toDouble;
exports.toDecimal = toDecimal;
exports.sign = sign;
exports.isZero = isZero;
exports.isOne = isOne;
exports.hash = hash;
exports.compare = compare;
exports.equals = equals;
exports.toString = toString;
exports.op_Addition = op_Addition;
exports.op_Subtraction = op_Subtraction;
exports.op_Multiply = op_Multiply;
exports.op_Division = op_Division;
exports.op_Modulus = op_Modulus;
exports.op_UnaryNegation = op_UnaryNegation;
exports.op_UnaryPlus = op_UnaryPlus;
exports.op_RightShift = op_RightShift;
exports.op_LeftShift = op_LeftShift;
exports.op_BitwiseAnd = op_BitwiseAnd;
exports.op_BitwiseOr = op_BitwiseOr;
exports.op_ExclusiveOr = op_ExclusiveOr;
exports.op_LessThan = op_LessThan;
exports.op_LessThanOrEqual = op_LessThanOrEqual;
exports.op_GreaterThan = op_GreaterThan;
exports.op_GreaterThanOrEqual = op_GreaterThanOrEqual;
exports.op_Equality = op_Equality;
exports.op_Inequality = op_Inequality;
exports.toByteArray = toByteArray;
exports.fromByteArray = fromByteArray;
exports.get_One = exports.get_Zero = exports.two = exports.one = exports.zero = void 0;

var _z = require("../BigInt/z");

var _Long = require("./Long");

var _Util = require("./Util");

var _Seq = require("./Seq");

var _List = require("./List");

var _Types = require("./Types");

var _Array = require("./Array");

function isBigInt(x) {
  return x instanceof _z.BigInteger;
}

function tryParse(str) {
  try {
    const res = (0, _z.BigInteger$$$Parse$$Z721C83C5)(str);
    return [true, res];
  } catch (matchValue) {
    return [false, (0, _z.BigInteger$$$get_Zero)()];
  }
}

function parse(arg00) {
  return (0, _z.BigInteger$$$Parse$$Z721C83C5)(arg00);
}

function divRem(arg00$$1, arg01) {
  return (0, _z.BigInteger$$$DivRem$$56F059C0)(arg00$$1, arg01);
}

function greatestCommonDivisor(arg00$$2, arg01$$1) {
  return (0, _z.BigInteger$$$GreatestCommonDivisor$$56F059C0)(arg00$$2, arg01$$1);
}

function pow(arg00$$3, arg01$$2) {
  return (0, _z.BigInteger$$$Pow$$62E082A2)(arg00$$3, arg01$$2);
}

function abs(arg00$$4) {
  return (0, _z.BigInteger$$$Abs$$Z665282C2)(arg00$$4);
}

const zero = (0, _z.BigInteger$$$get_Zero)();
exports.zero = zero;
const one = (0, _z.BigInteger$$$get_One)();
exports.one = one;
const two = (0, _z.BigInteger$$$get_Two)();
exports.two = two;

function fromString(s) {
  return (0, _z.BigInteger$$$Parse$$Z721C83C5)(s);
}

function fromZero() {
  return (0, _z.BigInteger$$$get_Zero)();
}

function fromOne() {
  return (0, _z.BigInteger$$$get_One)();
}

function fromInt64(i) {
  return (0, _z.BigInteger$$$$002Ector$$Z524259C1)(i);
}

function fromInt32(i$$1) {
  if (i$$1 > 2147483647) {
    return (0, _z.BigInteger$$$$002Ector$$Z524259C1)((0, _Long.fromInteger)(i$$1, false, 6));
  } else {
    return (0, _z.BigInteger$$$$002Ector$$Z524259A4)(i$$1);
  }
}

function toSByte(x$$1) {
  return (0, _z.BigInteger$$get_ToSByte)(x$$1);
}

function toByte(x$$2) {
  return (0, _z.BigInteger$$get_ToByte)(x$$2);
}

function toInt16(x$$3) {
  return (0, _z.BigInteger$$get_ToInt16)(x$$3);
}

function toUInt16(x$$4) {
  return (0, _z.BigInteger$$get_ToUInt16)(x$$4);
}

function toInt32(x$$5) {
  return (0, _z.BigInteger$$get_ToInt32)(x$$5);
}

function toUInt32(x$$6) {
  return (0, _z.BigInteger$$get_ToUInt32)(x$$6);
}

function toInt64(x$$7) {
  return (0, _z.BigInteger$$get_ToInt64)(x$$7);
}

function toUInt64(x$$8) {
  return (0, _z.BigInteger$$get_ToUInt64)(x$$8);
}

function toSingle(x$$9) {
  return (0, _z.BigInteger$$get_ToSingle)(x$$9);
}

function toDouble(x$$10) {
  return (0, _z.BigInteger$$get_ToDouble)(x$$10);
}

function toDecimal(x$$11) {
  return (0, _z.BigInteger$$get_ToDecimal)(x$$11);
}

function sign(x$$12) {
  return (0, _z.BigInteger$$get_Sign)(x$$12);
}

function isZero(x$$13) {
  return (0, _z.BigInteger$$get_IsZero)(x$$13);
}

function isOne(x$$14) {
  return (0, _z.BigInteger$$get_IsOne)(x$$14);
}

function hash(x$$15) {
  return (0, _Util.structuralHash)(x$$15);
}

function compare(x$$16, y) {
  return x$$16.CompareTo(y);
}

function equals(x$$17, y$$1) {
  return (0, _Util.equals)(x$$17, y$$1);
}

function toString(x$$18) {
  return String(x$$18);
}

const get_Zero = (0, _z.BigInteger$$$get_Zero)();
exports.get_Zero = get_Zero;
const get_One = (0, _z.BigInteger$$$get_One)();
exports.get_One = get_One;

function op_Addition(arg00$$5, arg01$$3) {
  return (0, _z.BigInteger$$$op_Addition$$56F059C0)(arg00$$5, arg01$$3);
}

function op_Subtraction(arg00$$6, arg01$$4) {
  return (0, _z.BigInteger$$$op_Subtraction$$56F059C0)(arg00$$6, arg01$$4);
}

function op_Multiply(arg00$$7, arg01$$5) {
  return (0, _z.BigInteger$$$op_Multiply$$56F059C0)(arg00$$7, arg01$$5);
}

function op_Division(arg00$$8, arg01$$6) {
  return (0, _z.BigInteger$$$op_Division$$56F059C0)(arg00$$8, arg01$$6);
}

function op_Modulus(arg00$$9, arg01$$7) {
  return (0, _z.BigInteger$$$op_Modulus$$56F059C0)(arg00$$9, arg01$$7);
}

function op_UnaryNegation(arg00$$10) {
  return (0, _z.BigInteger$$$op_UnaryNegation$$Z665282C2)(arg00$$10);
}

function op_UnaryPlus(arg00$$11) {
  return (0, _z.BigInteger$$$op_UnaryPlus$$Z665282C2)(arg00$$11);
}

function op_RightShift(arg00$$12, arg01$$8) {
  return (0, _z.BigInteger$$$op_RightShift$$62E082A2)(arg00$$12, arg01$$8);
}

function op_LeftShift(arg00$$13, arg01$$9) {
  return (0, _z.BigInteger$$$op_LeftShift$$62E082A2)(arg00$$13, arg01$$9);
}

function op_BitwiseAnd(arg00$$14, arg01$$10) {
  return (0, _z.BigInteger$$$op_BitwiseAnd$$56F059C0)(arg00$$14, arg01$$10);
}

function op_BitwiseOr(arg00$$15, arg01$$11) {
  return (0, _z.BigInteger$$$op_BitwiseOr$$56F059C0)(arg00$$15, arg01$$11);
}

function op_ExclusiveOr(arg00$$16, arg01$$12) {
  return (0, _z.BigInteger$$$op_ExclusiveOr$$56F059C0)(arg00$$16, arg01$$12);
}

function op_LessThan(arg00$$17, arg01$$13) {
  return (0, _z.BigInteger$$$op_LessThan$$56F059C0)(arg00$$17, arg01$$13);
}

function op_LessThanOrEqual(arg00$$18, arg01$$14) {
  return (0, _z.BigInteger$$$op_LessThanOrEqual$$56F059C0)(arg00$$18, arg01$$14);
}

function op_GreaterThan(arg00$$19, arg01$$15) {
  return (0, _z.BigInteger$$$op_GreaterThan$$56F059C0)(arg00$$19, arg01$$15);
}

function op_GreaterThanOrEqual(arg00$$20, arg01$$16) {
  return (0, _z.BigInteger$$$op_GreaterThanOrEqual$$56F059C0)(arg00$$20, arg01$$16);
}

function op_Equality(arg00$$21, arg01$$17) {
  return (0, _z.BigInteger$$$op_Equality$$56F059C0)(arg00$$21, arg01$$17);
}

function op_Inequality(arg00$$22, arg01$$18) {
  return (0, _z.BigInteger$$$op_Inequality$$56F059C0)(arg00$$22, arg01$$18);
}

function flipTwosComplement(currByte, lowBitFound) {
  const matchValue$$1 = [currByte, lowBitFound];

  if (matchValue$$1[1]) {
    return [(currByte ^ 255) & 255, true];
  } else if (matchValue$$1[0] === 0) {
    return [0, false];
  } else {
    const firstBitIndex = (0, _List.find)(function predicate(i$$2) {
      return (currByte & 1 << i$$2) > 0;
    }, (0, _List.ofSeq)((0, _Seq.rangeNumber)(0, 1, 7))) | 0;
    return [(currByte ^ 254 << firstBitIndex) & 255, true];
  }
}

function toByteArray(value$$1) {
  if ((0, _Util.equals)(value$$1, zero)) {
    return new Uint8Array([0]);
  } else {
    const isPositive = value$$1.CompareTo(zero) > 0;
    const value$$2 = isPositive ? value$$1 : (0, _z.BigInteger$$$op_Multiply$$56F059C0)((0, _z.BigInteger$$$$002Ector$$Z524259A4)(-1), value$$1);
    const mask32 = fromInt64((0, _Long.fromInteger)(4294967295, false, 6));

    const loop = function loop(accumBytes, consumeValue, lowBitFound$$1) {
      loop: while (true) {
        if (consumeValue.CompareTo(zero) <= 0) {
          const accumBytes$$1 = isPositive ? (0, _List.skipWhile)(function predicate$$1(b) {
            return b === 0;
          }, accumBytes) : (0, _List.skipWhile)(function predicate$$2(b$$1) {
            return b$$1 === 255;
          }, accumBytes);
          const isHighBitOne = ((0, _List.head)(accumBytes$$1) & 128) !== 0;
          const accumBytes$$2 = (isPositive ? isHighBitOne : false) ? new _Types.List(0, accumBytes$$1) : (!isPositive ? !isHighBitOne : false) ? new _Types.List(255, accumBytes$$1) : accumBytes$$1;
          return (0, _Array.reverse)((0, _Array.ofList)(accumBytes$$2, Uint8Array), Uint8Array);
        } else {
          const currValue = toUInt32((0, _z.BigInteger$$$op_BitwiseAnd$$56F059C0)(consumeValue, mask32));

          if (isPositive) {
            const b0 = currValue & 0xFF;
            const b1 = currValue >>> 8 & 0xFF;
            const b2 = currValue >>> 16 & 0xFF;
            const b3 = currValue >>> 24 & 0xFF;
            const $accumBytes$$3 = accumBytes;
            const $consumeValue$$4 = consumeValue;
            accumBytes = new _Types.List(b3, new _Types.List(b2, new _Types.List(b1, new _Types.List(b0, $accumBytes$$3))));
            consumeValue = (0, _z.BigInteger$$$op_RightShift$$62E082A2)($consumeValue$$4, 32);
            lowBitFound$$1 = false;
            continue loop;
          } else {
            const patternInput = flipTwosComplement(currValue & 0xFF, lowBitFound$$1);
            const patternInput$$1 = flipTwosComplement(currValue >>> 8 & 0xFF, patternInput[1]);
            const patternInput$$2 = flipTwosComplement(currValue >>> 16 & 0xFF, patternInput$$1[1]);
            const patternInput$$3 = flipTwosComplement(currValue >>> 24 & 0xFF, patternInput$$2[1]);
            const $accumBytes$$5 = accumBytes;
            const $consumeValue$$6 = consumeValue;
            accumBytes = new _Types.List(patternInput$$3[0], new _Types.List(patternInput$$2[0], new _Types.List(patternInput$$1[0], new _Types.List(patternInput[0], $accumBytes$$5))));
            consumeValue = (0, _z.BigInteger$$$op_RightShift$$62E082A2)($consumeValue$$6, 32);
            lowBitFound$$1 = patternInput$$3[1];
            continue loop;
          }
        }

        break;
      }
    };

    return loop(new _Types.List(), value$$2, false);
  }
}

function fromByteArray(bytes) {
  if (bytes == null) {
    throw new Error("bytes");
  }

  if (bytes.length === 0) {
    return zero;
  } else {
    const isPositive$$1 = (bytes[bytes.length - 1] & 128) === 0;
    const buffer = (0, _Array.fill)(new Uint8Array(4), 0, 4, 0);

    const loop$$1 = function loop$$1(accumUInt32, currIndex, bytesRemaining, lowBitFound$$6) {
      loop$$1: while (true) {
        if (bytesRemaining === 0) {
          const value$$14 = (0, _List.fold)(function folder(acc, value$$12) {
            return (0, _z.BigInteger$$$op_Addition$$56F059C0)((0, _z.BigInteger$$$op_LeftShift$$62E082A2)(acc, 32), fromInt64((0, _Long.fromInteger)(value$$12, false, 6)));
          }, zero, accumUInt32);

          if (isPositive$$1) {
            return value$$14;
          } else {
            return (0, _z.BigInteger$$$op_Multiply$$56F059C0)((0, _z.BigInteger$$$$002Ector$$Z524259A4)(-1), value$$14);
          }
        } else {
          const bytesToProcess = (0, _Util.min)(_Util.comparePrimitives, bytesRemaining, 4) | 0;

          for (let i$$5 = 0; i$$5 <= bytesToProcess - 1; i$$5++) {
            buffer[i$$5] = bytes[currIndex + i$$5];
          }

          if (isPositive$$1) {
            (0, _Array.fill)(buffer, bytesToProcess, 4 - bytesToProcess, 0);
            const value$$15 = (((buffer[0] | buffer[1] << 8 >>> 0) >>> 0 | buffer[2] << 16 >>> 0) >>> 0 | buffer[3] << 24 >>> 0) >>> 0;
            const $accumUInt32$$7 = accumUInt32;
            const $bytesRemaining$$9 = bytesRemaining;
            const $currIndex$$8 = currIndex;
            accumUInt32 = new _Types.List(value$$15, $accumUInt32$$7);
            currIndex = $currIndex$$8 + bytesToProcess;
            bytesRemaining = $bytesRemaining$$9 - bytesToProcess;
            lowBitFound$$6 = false;
            continue loop$$1;
          } else {
            (0, _Array.fill)(buffer, bytesToProcess, 4 - bytesToProcess, 255);
            const patternInput$$4 = flipTwosComplement(buffer[0], lowBitFound$$6);
            const patternInput$$5 = flipTwosComplement(buffer[1], patternInput$$4[1]);
            const patternInput$$6 = flipTwosComplement(buffer[2], patternInput$$5[1]);
            const patternInput$$7 = flipTwosComplement(buffer[3], patternInput$$6[1]);
            const value$$16 = (((patternInput$$4[0] | patternInput$$5[0] << 8 >>> 0) >>> 0 | patternInput$$6[0] << 16 >>> 0) >>> 0 | patternInput$$7[0] << 24 >>> 0) >>> 0;
            const $accumUInt32$$10 = accumUInt32;
            const $bytesRemaining$$12 = bytesRemaining;
            const $currIndex$$11 = currIndex;
            accumUInt32 = new _Types.List(value$$16, $accumUInt32$$10);
            currIndex = $currIndex$$11 + bytesToProcess;
            bytesRemaining = $bytesRemaining$$12 - bytesToProcess;
            lowBitFound$$6 = patternInput$$7[1];
            continue loop$$1;
          }
        }

        break;
      }
    };

    return loop$$1(new _Types.List(), 0, bytes.length, false);
  }
}
