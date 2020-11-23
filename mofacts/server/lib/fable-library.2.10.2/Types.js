"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.declare = declare;
exports.anonRecord = anonRecord;
exports.isException = isException;
exports.Attribute = exports.MatchFailureException = exports.FSharpException = exports.Exception = exports.FSharpRef = exports.Record = exports.Union = exports.List = exports.SystemObject = void 0;

var _Util = require("./Util");

// tslint:disable: space-before-function-paren
function sameType(x, y) {
  return y != null && Object.getPrototypeOf(x).constructor === Object.getPrototypeOf(y).constructor;
} // Taken from Babel helpers


function inherits(subClass, superClass) {
  // if (typeof superClass !== "function" && superClass !== null) {
  //   throw new TypeError(
  //     "Super expression must either be null or a function, not " +
  //       typeof superClass
  //   );
  // }
  subClass.prototype = Object.create(superClass && superClass.prototype, {
    constructor: {
      value: subClass,
      enumerable: false,
      writable: true,
      configurable: true
    }
  }); // if (superClass)
  //   Object.setPrototypeOf
  //     ? Object.setPrototypeOf(subClass, superClass)
  //     : (subClass.__proto__ = superClass);
}

function declare(cons, superClass) {
  inherits(cons, superClass || SystemObject);
  return cons;
}

class SystemObject {
  toString() {
    return "{" + Object.entries(this).map(([k, v]) => k + " = " + String(v)).join(";\n ") + "}";
  }

  GetHashCode(x) {
    return (0, _Util.identityHash)(x !== null && x !== void 0 ? x : this);
  }

  Equals(x, y) {
    return x === (y !== null && y !== void 0 ? y : this);
  }

}

exports.SystemObject = SystemObject;

function compareList(self, other) {
  if (self === other) {
    return 0;
  } else {
    if (other == null) {
      return -1;
    }

    while (self.tail != null) {
      if (other.tail == null) {
        return 1;
      }

      const res = (0, _Util.compare)(self.head, other.head);

      if (res !== 0) {
        return res;
      }

      self = self.tail;
      other = other.tail;
    }

    return other.tail == null ? 0 : -1;
  }
}

class List {
  constructor(head, tail) {
    this.head = head;
    this.tail = tail;
  }

  toString() {
    return "[" + Array.from(this).join("; ") + "]";
  }

  toJSON() {
    return Array.from(this);
  }

  [Symbol.iterator]() {
    let cur = this;
    return {
      next: () => {
        const value = cur === null || cur === void 0 ? void 0 : cur.head;
        const done = (cur === null || cur === void 0 ? void 0 : cur.tail) == null;
        cur = cur === null || cur === void 0 ? void 0 : cur.tail;
        return {
          done,
          value
        };
      }
    };
  }

  GetHashCode() {
    const hashes = Array.from(this).map(_Util.structuralHash);
    return (0, _Util.combineHashCodes)(hashes);
  }

  Equals(other) {
    return compareList(this, other) === 0;
  }

  CompareTo(other) {
    return compareList(this, other);
  }

}

exports.List = List;

class Union extends SystemObject {
  constructor(tag, name, ...fields) {
    super();
    this.tag = tag | 0;
    this.name = name;
    this.fields = fields;
  }

  toString() {
    const len = this.fields.length;

    if (len === 0) {
      return this.name;
    } else if (len === 1) {
      return this.name + " " + String(this.fields[0]);
    } else {
      return this.name + " (" + this.fields.map(x => String(x)).join(",") + ")";
    }
  }

  toJSON() {
    return this.fields.length === 0 ? this.name : [this.name].concat(this.fields);
  }

  GetHashCode() {
    const hashes = this.fields.map(x => (0, _Util.structuralHash)(x));
    hashes.splice(0, 0, (0, _Util.numberHash)(this.tag));
    return (0, _Util.combineHashCodes)(hashes);
  }

  Equals(other) {
    return this === other || sameType(this, other) && this.tag === other.tag && (0, _Util.equalArrays)(this.fields, other.fields);
  }

  CompareTo(other) {
    if (this === other) {
      return 0;
    } else if (!sameType(this, other)) {
      return -1;
    } else if (this.tag === other.tag) {
      return (0, _Util.compareArrays)(this.fields, other.fields);
    } else {
      return this.tag < other.tag ? -1 : 1;
    }
  }

}

exports.Union = Union;

function recordToJson(record, getFieldNames) {
  const o = {};
  const keys = getFieldNames == null ? Object.keys(record) : getFieldNames(record);

  for (let i = 0; i < keys.length; i++) {
    o[keys[i]] = record[keys[i]];
  }

  return o;
}

function recordEquals(self, other, getFieldNames) {
  if (self === other) {
    return true;
  } else if (!sameType(self, other)) {
    return false;
  } else {
    const thisNames = getFieldNames == null ? Object.keys(self) : getFieldNames(self);

    for (let i = 0; i < thisNames.length; i++) {
      if (!(0, _Util.equals)(self[thisNames[i]], other[thisNames[i]])) {
        return false;
      }
    }

    return true;
  }
}

function recordCompare(self, other, getFieldNames) {
  if (self === other) {
    return 0;
  } else if (!sameType(self, other)) {
    return -1;
  } else {
    const thisNames = getFieldNames == null ? Object.keys(self) : getFieldNames(self);

    for (let i = 0; i < thisNames.length; i++) {
      const result = (0, _Util.compare)(self[thisNames[i]], other[thisNames[i]]);

      if (result !== 0) {
        return result;
      }
    }

    return 0;
  }
}

class Record extends SystemObject {
  toString() {
    return "{" + Object.entries(this).map(([k, v]) => k + " = " + String(v)).join(";\n ") + "}";
  }

  toJSON() {
    return recordToJson(this);
  }

  GetHashCode() {
    const hashes = Object.values(this).map(v => (0, _Util.structuralHash)(v));
    return (0, _Util.combineHashCodes)(hashes);
  }

  Equals(other) {
    return recordEquals(this, other);
  }

  CompareTo(other) {
    return recordCompare(this, other);
  }

}

exports.Record = Record;

function anonRecord(o) {
  return Object.assign(Object.create(Record.prototype), o);
}

class FSharpRef extends Record {
  constructor(contents) {
    super();
    this.contents = contents;
  }

}

exports.FSharpRef = FSharpRef;
const Exception = declare(function Exception(message) {
  this.stack = Error().stack;
  this.message = message;
}, SystemObject);
exports.Exception = Exception;

function isException(x) {
  return x instanceof Error || x instanceof Exception;
}

function getFSharpExceptionFieldNames(self) {
  return Object.keys(self).filter(k => k !== "message" && k !== "stack");
}

class FSharpException extends Exception {
  toString() {
    var _a; // const fieldNames = getFSharpExceptionFieldNames(this);


    const fields = Object.entries(this).filter(([k, _]) => k !== "message" && k !== "stack");
    const len = fields.length;

    if (len === 0) {
      return (_a = this.message) !== null && _a !== void 0 ? _a : "";
    } else if (len === 1) {
      return this.message + " " + String(fields[1]);
    } else {
      return this.message + " (" + fields.map(([_, v]) => String(v)).join(",") + ")";
    }
  }

  toJSON() {
    return recordToJson(this, getFSharpExceptionFieldNames);
  }

  GetHashCode() {
    const fields = Object.entries(this).filter(([k, _]) => k !== "message" && k !== "stack");
    const hashes = fields.map(([_, v]) => (0, _Util.structuralHash)(v));
    return (0, _Util.combineHashCodes)(hashes);
  }

  Equals(other) {
    return recordEquals(this, other, getFSharpExceptionFieldNames);
  }

  CompareTo(other) {
    return recordCompare(this, other, getFSharpExceptionFieldNames);
  }

}

exports.FSharpException = FSharpException;

class MatchFailureException extends FSharpException {
  constructor(arg1, arg2, arg3) {
    super();
    this.arg1 = arg1;
    this.arg2 = arg2 | 0;
    this.arg3 = arg3 | 0;
    this.message = "The match cases were incomplete";
  }

}

exports.MatchFailureException = MatchFailureException;
const Attribute = declare(function Attribute() {
  return;
}, SystemObject);
exports.Attribute = Attribute;