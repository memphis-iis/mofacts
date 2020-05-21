"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.some = some;
exports.value = value;
exports.tryValue = tryValue;
exports.toArray = toArray;
exports.defaultArg = defaultArg;
exports.defaultArgWith = defaultArgWith;
exports.filter = filter;
exports.map = map;
exports.map2 = map2;
exports.map3 = map3;
exports.bind = bind;
exports.tryOp = tryOp;
exports.choice1 = choice1;
exports.choice2 = choice2;
exports.tryValueIfChoice1 = tryValueIfChoice1;
exports.tryValueIfChoice2 = tryValueIfChoice2;
exports.ok = ok;
exports.error = error;
exports.mapOk = mapOk;
exports.mapError = mapError;
exports.bindOk = bindOk;
exports.Result = exports.Choice = exports.Some = void 0;

var _Types = require("./Types");

var _Util = require("./Util");

// Using a class here for better compatibility with TS files importing Some
class Some {
  constructor(value) {
    this.value = value;
  } // Don't add "Some" for consistency with erased options


  toString() {
    return String(this.value);
  }

  toJSON() {
    return this.value;
  }

  GetHashCode() {
    return (0, _Util.structuralHash)(this.value);
  }

  Equals(other) {
    if (other == null) {
      return false;
    } else {
      return (0, _Util.equals)(this.value, other instanceof Some ? other.value : other);
    }
  }

  CompareTo(other) {
    if (other == null) {
      return 1;
    } else {
      return (0, _Util.compare)(this.value, other instanceof Some ? other.value : other);
    }
  }

}

exports.Some = Some;

function some(x) {
  return x == null || x instanceof Some ? new Some(x) : x;
}

function value(x) {
  if (x == null) {
    throw new Error("Option has no value");
  } else {
    return x instanceof Some ? x.value : x;
  }
}

function tryValue(x) {
  return x instanceof Some ? x.value : x;
}

function toArray(opt) {
  return opt == null ? [] : [value(opt)];
}

function defaultArg(opt, defaultValue) {
  return opt != null ? value(opt) : defaultValue;
}

function defaultArgWith(opt, defThunk) {
  return opt != null ? value(opt) : defThunk();
}

function filter(predicate, opt) {
  return opt != null ? predicate(value(opt)) ? opt : null : opt;
}

function map(mapping, opt) {
  return opt != null ? some(mapping(value(opt))) : null;
}

function map2(mapping, opt1, opt2) {
  return opt1 != null && opt2 != null ? mapping(value(opt1), value(opt2)) : null;
}

function map3(mapping, opt1, opt2, opt3) {
  return opt1 != null && opt2 != null && opt3 != null ? mapping(value(opt1), value(opt2), value(opt3)) : null;
}

function bind(binder, opt) {
  return opt != null ? binder(value(opt)) : null;
}

function tryOp(op, arg) {
  try {
    return some(op(arg));
  } catch (_a) {
    return null;
  }
}

const Choice = (0, _Types.declare)(function Choice(tag, name, field) {
  _Types.Union.call(this, tag, name, field);
}, _Types.Union);
exports.Choice = Choice;

function choice1(x) {
  return new Choice(0, "Choice1Of2", x);
}

function choice2(x) {
  return new Choice(1, "Choice2Of2", x);
}

function tryValueIfChoice1(x) {
  return x.tag === 0 ? some(x.fields[0]) : null;
}

function tryValueIfChoice2(x) {
  return x.tag === 1 ? some(x.fields[0]) : null;
}

const Result = (0, _Types.declare)(function Result(tag, name, field) {
  _Types.Union.call(this, tag, name, field);
}, _Types.Union);
exports.Result = Result;

function ok(x) {
  return new Result(0, "Ok", x);
}

function error(x) {
  return new Result(1, "Error", x);
}

function mapOk(f, result) {
  return result.tag === 0 ? ok(f(result.fields[0])) : result;
}

function mapError(f, result) {
  return result.tag === 1 ? error(f(result.fields[0])) : result;
}

function bindOk(f, result) {
  return result.tag === 0 ? f(result.fields[0]) : result;
}