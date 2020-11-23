"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.create = create;
exports.fromTicks = fromTicks;
exports.fromDays = fromDays;
exports.fromHours = fromHours;
exports.fromMinutes = fromMinutes;
exports.fromSeconds = fromSeconds;
exports.days = days;
exports.hours = hours;
exports.minutes = minutes;
exports.seconds = seconds;
exports.milliseconds = milliseconds;
exports.ticks = ticks;
exports.totalDays = totalDays;
exports.totalHours = totalHours;
exports.totalMinutes = totalMinutes;
exports.totalSeconds = totalSeconds;
exports.negate = negate;
exports.add = add;
exports.subtract = subtract;
exports.duration = duration;
exports.toString = toString;
exports.parse = parse;
exports.tryParse = tryParse;
exports.compareTo = exports.compare = exports.op_Subtraction = exports.op_Addition = void 0;

var _Long = require("./Long");

var _Util = require("./Util");

// tslint:disable:max-line-length
// TimeSpan in runtime just becomes a number representing milliseconds

/**
 * Calls:
 * - `Math.ceil` if the `value` is **negative**
 * - `Math.floor` if the `value` is **positive**
 * @param value Value to round
 */
function signedRound(value) {
  return value < 0 ? Math.ceil(value) : Math.floor(value);
}

function create(d = 0, h = 0, m = 0, s = 0, ms = 0) {
  switch (arguments.length) {
    case 1:
      // ticks
      return fromTicks(arguments[0]);

    case 3:
      // h,m,s
      d = 0, h = arguments[0], m = arguments[1], s = arguments[2], ms = 0;
      break;

    default:
      // d,h,m,s,ms
      break;
  }

  return d * 86400000 + h * 3600000 + m * 60000 + s * 1000 + ms;
}

function fromTicks(ticks) {
  return (0, _Long.toNumber)((0, _Long.op_Division)(ticks, 10000));
}

function fromDays(d) {
  return create(d, 0, 0, 0);
}

function fromHours(h) {
  return create(h, 0, 0);
}

function fromMinutes(m) {
  return create(0, m, 0);
}

function fromSeconds(s) {
  return create(0, 0, s);
}

function days(ts) {
  return signedRound(ts / 86400000);
}

function hours(ts) {
  return signedRound(ts % 86400000 / 3600000);
}

function minutes(ts) {
  return signedRound(ts % 3600000 / 60000);
}

function seconds(ts) {
  return signedRound(ts % 60000 / 1000);
}

function milliseconds(ts) {
  return signedRound(ts % 1000);
}

function ticks(ts) {
  return (0, _Long.op_Multiply)((0, _Long.fromNumber)(ts), 10000);
}

function totalDays(ts) {
  return ts / 86400000;
}

function totalHours(ts) {
  return ts / 3600000;
}

function totalMinutes(ts) {
  return ts / 60000;
}

function totalSeconds(ts) {
  return ts / 1000;
}

function negate(ts) {
  return ts * -1;
}

function add(ts1, ts2) {
  return ts1 + ts2;
}

function subtract(ts1, ts2) {
  return ts1 - ts2;
}

const op_Addition = add;
exports.op_Addition = op_Addition;
const op_Subtraction = subtract;
exports.op_Subtraction = op_Subtraction;
const compare = _Util.comparePrimitives;
exports.compare = compare;
const compareTo = _Util.comparePrimitives;
exports.compareTo = compareTo;

function duration(x) {
  return Math.abs(x);
}

function toString(ts, format = "c", _provider) {
  if (["c", "g", "G"].indexOf(format) === -1) {
    throw new Error("Custom formats are not supported");
  }

  const d = Math.abs(days(ts));
  const h = Math.abs(hours(ts));
  const m = Math.abs(minutes(ts));
  const s = Math.abs(seconds(ts));
  const ms = Math.abs(milliseconds(ts));
  const sign = ts < 0 ? "-" : "";
  return `${sign}${d === 0 && (format === "c" || format === "g") ? "" : format === "c" ? d + "." : d + ":"}${format === "g" ? h : (0, _Util.padWithZeros)(h, 2)}:${(0, _Util.padWithZeros)(m, 2)}:${(0, _Util.padWithZeros)(s, 2)}${ms === 0 && (format === "c" || format === "g") ? "" : format === "g" ? "." + (0, _Util.padWithZeros)(ms, 3) : "." + (0, _Util.padLeftAndRightWithZeros)(ms, 3, 7)}`;
}

function parse(str) {
  const firstDot = str.search("\\.");
  const firstColon = str.search("\\:");

  if (firstDot === -1 && firstColon === -1) {
    // There is only a day ex: 4
    const d = parseInt(str, 0);

    if (isNaN(d)) {
      throw new Error(`String '${str}' was not recognized as a valid TimeSpan.`);
    } else {
      return create(d, 0, 0, 0, 0);
    }
  }

  if (firstColon > 0) {
    // process time part
    // WIP: (-?)(((\d+)\.)?([0-9]|0[0-9]|1[0-9]|2[0-3]):(\d+)(:\d+(\.\d{1,7})?)?|\d+(?:(?!\.)))
    const r = /^(-?)((\d+)\.)?(?:0*)([0-9]|0[0-9]|1[0-9]|2[0-3]):(?:0*)([0-5][0-9]|[0-9])(:(?:0*)([0-5][0-9]|[0-9]))?\.?(\d+)?$/.exec(str);

    if (r != null && r[4] != null && r[5] != null) {
      let d = 0;
      let ms = 0;
      let s = 0;
      const sign = r[1] != null && r[1] === "-" ? -1 : 1;
      const h = +r[4];
      const m = +r[5];

      if (r[3] != null) {
        d = +r[3];
      }

      if (r[7] != null) {
        s = +r[7];
      }

      if (r[8] != null) {
        // Depending on the number of decimals passed, we need to adapt the numbers
        switch (r[8].length) {
          case 1:
            ms = +r[8] * 100;
            break;

          case 2:
            ms = +r[8] * 10;
            break;

          case 3:
            ms = +r[8];
            break;

          case 4:
            ms = +r[8] / 10;
            break;

          case 5:
            ms = +r[8] / 100;
            break;

          case 6:
            ms = +r[8] / 1000;
            break;

          case 7:
            ms = +r[8] / 10000;
            break;

          default:
            throw new Error(`String '${str}' was not recognized as a valid TimeSpan.`);
        }
      }

      return sign * create(d, h, m, s, ms);
    }
  }

  throw new Error(`String '${str}' was not recognized as a valid TimeSpan.`);
}

function tryParse(v, _refValue) {
  try {
    return [true, parse(v)];
  } catch (_err) {
    return [false, 0];
  }
}