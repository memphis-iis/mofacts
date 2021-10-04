(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var ECMAScript = Package.ecmascript.ECMAScript;
var Base64 = Package.base64.Base64;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var EJSON;

var require = meteorInstall({"node_modules":{"meteor":{"ejson":{"ejson.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                             //
// packages/ejson/ejson.js                                                                                     //
//                                                                                                             //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                               //
module.export({
  EJSON: () => EJSON
});

/**
 * @namespace
 * @summary Namespace for EJSON functions
 */
const EJSON = {}; // Custom type interface definition

/**
 * @class CustomType
 * @instanceName customType
 * @memberOf EJSON
 * @summary The interface that a class must satisfy to be able to become an
 * EJSON custom type via EJSON.addType.
 */

/**
 * @function typeName
 * @memberOf EJSON.CustomType
 * @summary Return the tag used to identify this type.  This must match the
 *          tag used to register this type with
 *          [`EJSON.addType`](#ejson_add_type).
 * @locus Anywhere
 * @instance
 */

/**
 * @function toJSONValue
 * @memberOf EJSON.CustomType
 * @summary Serialize this instance into a JSON-compatible value.
 * @locus Anywhere
 * @instance
 */

/**
 * @function clone
 * @memberOf EJSON.CustomType
 * @summary Return a value `r` such that `this.equals(r)` is true, and
 *          modifications to `r` do not affect `this` and vice versa.
 * @locus Anywhere
 * @instance
 */

/**
 * @function equals
 * @memberOf EJSON.CustomType
 * @summary Return `true` if `other` has a value equal to `this`; `false`
 *          otherwise.
 * @locus Anywhere
 * @param {Object} other Another object to compare this to.
 * @instance
 */

const customTypes = {};

const hasOwn = (obj, prop) => ({}).hasOwnProperty.call(obj, prop);

const isArguments = obj => obj != null && hasOwn(obj, 'callee');

const isInfOrNan = obj => Number.isNaN(obj) || obj === Infinity || obj === -Infinity; // Add a custom type, using a method of your choice to get to and
// from a basic JSON-able representation.  The factory argument
// is a function of JSON-able --> your object
// The type you add must have:
// - A toJSONValue() method, so that Meteor can serialize it
// - a typeName() method, to show how to look it up in our type table.
// It is okay if these methods are monkey-patched on.
// EJSON.clone will use toJSONValue and the given factory to produce
// a clone, but you may specify a method clone() that will be
// used instead.
// Similarly, EJSON.equals will use toJSONValue to make comparisons,
// but you may provide a method equals() instead.

/**
 * @summary Add a custom datatype to EJSON.
 * @locus Anywhere
 * @param {String} name A tag for your custom type; must be unique among
 *                      custom data types defined in your project, and must
 *                      match the result of your type's `typeName` method.
 * @param {Function} factory A function that deserializes a JSON-compatible
 *                           value into an instance of your type.  This should
 *                           match the serialization performed by your
 *                           type's `toJSONValue` method.
 */


EJSON.addType = (name, factory) => {
  if (hasOwn(customTypes, name)) {
    throw new Error("Type ".concat(name, " already present"));
  }

  customTypes[name] = factory;
};

const builtinConverters = [{
  // Date
  matchJSONValue(obj) {
    return hasOwn(obj, '$date') && Object.keys(obj).length === 1;
  },

  matchObject(obj) {
    return obj instanceof Date;
  },

  toJSONValue(obj) {
    return {
      $date: obj.getTime()
    };
  },

  fromJSONValue(obj) {
    return new Date(obj.$date);
  }

}, {
  // RegExp
  matchJSONValue(obj) {
    return hasOwn(obj, '$regexp') && hasOwn(obj, '$flags') && Object.keys(obj).length === 2;
  },

  matchObject(obj) {
    return obj instanceof RegExp;
  },

  toJSONValue(regexp) {
    return {
      $regexp: regexp.source,
      $flags: regexp.flags
    };
  },

  fromJSONValue(obj) {
    // Replaces duplicate / invalid flags.
    return new RegExp(obj.$regexp, obj.$flags // Cut off flags at 50 chars to avoid abusing RegExp for DOS.
    .slice(0, 50).replace(/[^gimuy]/g, '').replace(/(.)(?=.*\1)/g, ''));
  }

}, {
  // NaN, Inf, -Inf. (These are the only objects with typeof !== 'object'
  // which we match.)
  matchJSONValue(obj) {
    return hasOwn(obj, '$InfNaN') && Object.keys(obj).length === 1;
  },

  matchObject: isInfOrNan,

  toJSONValue(obj) {
    let sign;

    if (Number.isNaN(obj)) {
      sign = 0;
    } else if (obj === Infinity) {
      sign = 1;
    } else {
      sign = -1;
    }

    return {
      $InfNaN: sign
    };
  },

  fromJSONValue(obj) {
    return obj.$InfNaN / 0;
  }

}, {
  // Binary
  matchJSONValue(obj) {
    return hasOwn(obj, '$binary') && Object.keys(obj).length === 1;
  },

  matchObject(obj) {
    return typeof Uint8Array !== 'undefined' && obj instanceof Uint8Array || obj && hasOwn(obj, '$Uint8ArrayPolyfill');
  },

  toJSONValue(obj) {
    return {
      $binary: Base64.encode(obj)
    };
  },

  fromJSONValue(obj) {
    return Base64.decode(obj.$binary);
  }

}, {
  // Escaping one level
  matchJSONValue(obj) {
    return hasOwn(obj, '$escape') && Object.keys(obj).length === 1;
  },

  matchObject(obj) {
    let match = false;

    if (obj) {
      const keyCount = Object.keys(obj).length;

      if (keyCount === 1 || keyCount === 2) {
        match = builtinConverters.some(converter => converter.matchJSONValue(obj));
      }
    }

    return match;
  },

  toJSONValue(obj) {
    const newObj = {};
    Object.keys(obj).forEach(key => {
      newObj[key] = EJSON.toJSONValue(obj[key]);
    });
    return {
      $escape: newObj
    };
  },

  fromJSONValue(obj) {
    const newObj = {};
    Object.keys(obj.$escape).forEach(key => {
      newObj[key] = EJSON.fromJSONValue(obj.$escape[key]);
    });
    return newObj;
  }

}, {
  // Custom
  matchJSONValue(obj) {
    return hasOwn(obj, '$type') && hasOwn(obj, '$value') && Object.keys(obj).length === 2;
  },

  matchObject(obj) {
    return EJSON._isCustomType(obj);
  },

  toJSONValue(obj) {
    const jsonValue = Meteor._noYieldsAllowed(() => obj.toJSONValue());

    return {
      $type: obj.typeName(),
      $value: jsonValue
    };
  },

  fromJSONValue(obj) {
    const typeName = obj.$type;

    if (!hasOwn(customTypes, typeName)) {
      throw new Error("Custom EJSON type ".concat(typeName, " is not defined"));
    }

    const converter = customTypes[typeName];
    return Meteor._noYieldsAllowed(() => converter(obj.$value));
  }

}];

EJSON._isCustomType = obj => obj && typeof obj.toJSONValue === 'function' && typeof obj.typeName === 'function' && hasOwn(customTypes, obj.typeName());

EJSON._getTypes = () => customTypes;

EJSON._getConverters = () => builtinConverters; // Either return the JSON-compatible version of the argument, or undefined (if
// the item isn't itself replaceable, but maybe some fields in it are)


const toJSONValueHelper = item => {
  for (let i = 0; i < builtinConverters.length; i++) {
    const converter = builtinConverters[i];

    if (converter.matchObject(item)) {
      return converter.toJSONValue(item);
    }
  }

  return undefined;
}; // for both arrays and objects, in-place modification.


const adjustTypesToJSONValue = obj => {
  // Is it an atom that we need to adjust?
  if (obj === null) {
    return null;
  }

  const maybeChanged = toJSONValueHelper(obj);

  if (maybeChanged !== undefined) {
    return maybeChanged;
  } // Other atoms are unchanged.


  if (typeof obj !== 'object') {
    return obj;
  } // Iterate over array or object structure.


  Object.keys(obj).forEach(key => {
    const value = obj[key];

    if (typeof value !== 'object' && value !== undefined && !isInfOrNan(value)) {
      return; // continue
    }

    const changed = toJSONValueHelper(value);

    if (changed) {
      obj[key] = changed;
      return; // on to the next key
    } // if we get here, value is an object but not adjustable
    // at this level.  recurse.


    adjustTypesToJSONValue(value);
  });
  return obj;
};

EJSON._adjustTypesToJSONValue = adjustTypesToJSONValue;
/**
 * @summary Serialize an EJSON-compatible value into its plain JSON
 *          representation.
 * @locus Anywhere
 * @param {EJSON} val A value to serialize to plain JSON.
 */

EJSON.toJSONValue = item => {
  const changed = toJSONValueHelper(item);

  if (changed !== undefined) {
    return changed;
  }

  let newItem = item;

  if (typeof item === 'object') {
    newItem = EJSON.clone(item);
    adjustTypesToJSONValue(newItem);
  }

  return newItem;
}; // Either return the argument changed to have the non-json
// rep of itself (the Object version) or the argument itself.
// DOES NOT RECURSE.  For actually getting the fully-changed value, use
// EJSON.fromJSONValue


const fromJSONValueHelper = value => {
  if (typeof value === 'object' && value !== null) {
    const keys = Object.keys(value);

    if (keys.length <= 2 && keys.every(k => typeof k === 'string' && k.substr(0, 1) === '$')) {
      for (let i = 0; i < builtinConverters.length; i++) {
        const converter = builtinConverters[i];

        if (converter.matchJSONValue(value)) {
          return converter.fromJSONValue(value);
        }
      }
    }
  }

  return value;
}; // for both arrays and objects. Tries its best to just
// use the object you hand it, but may return something
// different if the object you hand it itself needs changing.


const adjustTypesFromJSONValue = obj => {
  if (obj === null) {
    return null;
  }

  const maybeChanged = fromJSONValueHelper(obj);

  if (maybeChanged !== obj) {
    return maybeChanged;
  } // Other atoms are unchanged.


  if (typeof obj !== 'object') {
    return obj;
  }

  Object.keys(obj).forEach(key => {
    const value = obj[key];

    if (typeof value === 'object') {
      const changed = fromJSONValueHelper(value);

      if (value !== changed) {
        obj[key] = changed;
        return;
      } // if we get here, value is an object but not adjustable
      // at this level.  recurse.


      adjustTypesFromJSONValue(value);
    }
  });
  return obj;
};

EJSON._adjustTypesFromJSONValue = adjustTypesFromJSONValue;
/**
 * @summary Deserialize an EJSON value from its plain JSON representation.
 * @locus Anywhere
 * @param {JSONCompatible} val A value to deserialize into EJSON.
 */

EJSON.fromJSONValue = item => {
  let changed = fromJSONValueHelper(item);

  if (changed === item && typeof item === 'object') {
    changed = EJSON.clone(item);
    adjustTypesFromJSONValue(changed);
  }

  return changed;
};
/**
 * @summary Serialize a value to a string. For EJSON values, the serialization
 *          fully represents the value. For non-EJSON values, serializes the
 *          same way as `JSON.stringify`.
 * @locus Anywhere
 * @param {EJSON} val A value to stringify.
 * @param {Object} [options]
 * @param {Boolean | Integer | String} options.indent Indents objects and
 * arrays for easy readability.  When `true`, indents by 2 spaces; when an
 * integer, indents by that number of spaces; and when a string, uses the
 * string as the indentation pattern.
 * @param {Boolean} options.canonical When `true`, stringifies keys in an
 *                                    object in sorted order.
 */


EJSON.stringify = (item, options) => {
  let serialized;
  const json = EJSON.toJSONValue(item);

  if (options && (options.canonical || options.indent)) {
    let canonicalStringify;
    module.link("./stringify", {
      default(v) {
        canonicalStringify = v;
      }

    }, 0);
    serialized = canonicalStringify(json, options);
  } else {
    serialized = JSON.stringify(json);
  }

  return serialized;
};
/**
 * @summary Parse a string into an EJSON value. Throws an error if the string
 *          is not valid EJSON.
 * @locus Anywhere
 * @param {String} str A string to parse into an EJSON value.
 */


EJSON.parse = item => {
  if (typeof item !== 'string') {
    throw new Error('EJSON.parse argument should be a string');
  }

  return EJSON.fromJSONValue(JSON.parse(item));
};
/**
 * @summary Returns true if `x` is a buffer of binary data, as returned from
 *          [`EJSON.newBinary`](#ejson_new_binary).
 * @param {Object} x The variable to check.
 * @locus Anywhere
 */


EJSON.isBinary = obj => {
  return !!(typeof Uint8Array !== 'undefined' && obj instanceof Uint8Array || obj && obj.$Uint8ArrayPolyfill);
};
/**
 * @summary Return true if `a` and `b` are equal to each other.  Return false
 *          otherwise.  Uses the `equals` method on `a` if present, otherwise
 *          performs a deep comparison.
 * @locus Anywhere
 * @param {EJSON} a
 * @param {EJSON} b
 * @param {Object} [options]
 * @param {Boolean} options.keyOrderSensitive Compare in key sensitive order,
 * if supported by the JavaScript implementation.  For example, `{a: 1, b: 2}`
 * is equal to `{b: 2, a: 1}` only when `keyOrderSensitive` is `false`.  The
 * default is `false`.
 */


EJSON.equals = (a, b, options) => {
  let i;
  const keyOrderSensitive = !!(options && options.keyOrderSensitive);

  if (a === b) {
    return true;
  } // This differs from the IEEE spec for NaN equality, b/c we don't want
  // anything ever with a NaN to be poisoned from becoming equal to anything.


  if (Number.isNaN(a) && Number.isNaN(b)) {
    return true;
  } // if either one is falsy, they'd have to be === to be equal


  if (!a || !b) {
    return false;
  }

  if (!(typeof a === 'object' && typeof b === 'object')) {
    return false;
  }

  if (a instanceof Date && b instanceof Date) {
    return a.valueOf() === b.valueOf();
  }

  if (EJSON.isBinary(a) && EJSON.isBinary(b)) {
    if (a.length !== b.length) {
      return false;
    }

    for (i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        return false;
      }
    }

    return true;
  }

  if (typeof a.equals === 'function') {
    return a.equals(b, options);
  }

  if (typeof b.equals === 'function') {
    return b.equals(a, options);
  }

  if (a instanceof Array) {
    if (!(b instanceof Array)) {
      return false;
    }

    if (a.length !== b.length) {
      return false;
    }

    for (i = 0; i < a.length; i++) {
      if (!EJSON.equals(a[i], b[i], options)) {
        return false;
      }
    }

    return true;
  } // fallback for custom types that don't implement their own equals


  switch (EJSON._isCustomType(a) + EJSON._isCustomType(b)) {
    case 1:
      return false;

    case 2:
      return EJSON.equals(EJSON.toJSONValue(a), EJSON.toJSONValue(b));

    default: // Do nothing

  } // fall back to structural equality of objects


  let ret;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);

  if (keyOrderSensitive) {
    i = 0;
    ret = aKeys.every(key => {
      if (i >= bKeys.length) {
        return false;
      }

      if (key !== bKeys[i]) {
        return false;
      }

      if (!EJSON.equals(a[key], b[bKeys[i]], options)) {
        return false;
      }

      i++;
      return true;
    });
  } else {
    i = 0;
    ret = aKeys.every(key => {
      if (!hasOwn(b, key)) {
        return false;
      }

      if (!EJSON.equals(a[key], b[key], options)) {
        return false;
      }

      i++;
      return true;
    });
  }

  return ret && i === bKeys.length;
};
/**
 * @summary Return a deep copy of `val`.
 * @locus Anywhere
 * @param {EJSON} val A value to copy.
 */


EJSON.clone = v => {
  let ret;

  if (typeof v !== 'object') {
    return v;
  }

  if (v === null) {
    return null; // null has typeof "object"
  }

  if (v instanceof Date) {
    return new Date(v.getTime());
  } // RegExps are not really EJSON elements (eg we don't define a serialization
  // for them), but they're immutable anyway, so we can support them in clone.


  if (v instanceof RegExp) {
    return v;
  }

  if (EJSON.isBinary(v)) {
    ret = EJSON.newBinary(v.length);

    for (let i = 0; i < v.length; i++) {
      ret[i] = v[i];
    }

    return ret;
  }

  if (Array.isArray(v)) {
    return v.map(value => EJSON.clone(value));
  }

  if (isArguments(v)) {
    return Array.from(v).map(value => EJSON.clone(value));
  } // handle general user-defined typed Objects if they have a clone method


  if (typeof v.clone === 'function') {
    return v.clone();
  } // handle other custom types


  if (EJSON._isCustomType(v)) {
    return EJSON.fromJSONValue(EJSON.clone(EJSON.toJSONValue(v)), true);
  } // handle other objects


  ret = {};
  Object.keys(v).forEach(key => {
    ret[key] = EJSON.clone(v[key]);
  });
  return ret;
};
/**
 * @summary Allocate a new buffer of binary data that EJSON can serialize.
 * @locus Anywhere
 * @param {Number} size The number of bytes of binary data to allocate.
 */
// EJSON.newBinary is the public documented API for this functionality,
// but the implementation is in the 'base64' package to avoid
// introducing a circular dependency. (If the implementation were here,
// then 'base64' would have to use EJSON.newBinary, and 'ejson' would
// also have to use 'base64'.)


EJSON.newBinary = Base64.newBinary;
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"stringify.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                             //
// packages/ejson/stringify.js                                                                                 //
//                                                                                                             //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                               //
// Based on json2.js from https://github.com/douglascrockford/JSON-js
//
//    json2.js
//    2012-10-08
//
//    Public Domain.
//
//    NO WARRANTY EXPRESSED OR IMPLIED. USE AT YOUR OWN RISK.
function quote(string) {
  return JSON.stringify(string);
}

const str = (key, holder, singleIndent, outerIndent, canonical) => {
  const value = holder[key]; // What happens next depends on the value's type.

  switch (typeof value) {
    case 'string':
      return quote(value);

    case 'number':
      // JSON numbers must be finite. Encode non-finite numbers as null.
      return isFinite(value) ? String(value) : 'null';

    case 'boolean':
      return String(value);
    // If the type is 'object', we might be dealing with an object or an array or
    // null.

    case 'object':
      {
        // Due to a specification blunder in ECMAScript, typeof null is 'object',
        // so watch out for that case.
        if (!value) {
          return 'null';
        } // Make an array to hold the partial results of stringifying this object
        // value.


        const innerIndent = outerIndent + singleIndent;
        const partial = [];
        let v; // Is the value an array?

        if (Array.isArray(value) || {}.hasOwnProperty.call(value, 'callee')) {
          // The value is an array. Stringify every element. Use null as a
          // placeholder for non-JSON values.
          const length = value.length;

          for (let i = 0; i < length; i += 1) {
            partial[i] = str(i, value, singleIndent, innerIndent, canonical) || 'null';
          } // Join all of the elements together, separated with commas, and wrap
          // them in brackets.


          if (partial.length === 0) {
            v = '[]';
          } else if (innerIndent) {
            v = '[\n' + innerIndent + partial.join(',\n' + innerIndent) + '\n' + outerIndent + ']';
          } else {
            v = '[' + partial.join(',') + ']';
          }

          return v;
        } // Iterate through all of the keys in the object.


        let keys = Object.keys(value);

        if (canonical) {
          keys = keys.sort();
        }

        keys.forEach(k => {
          v = str(k, value, singleIndent, innerIndent, canonical);

          if (v) {
            partial.push(quote(k) + (innerIndent ? ': ' : ':') + v);
          }
        }); // Join all of the member texts together, separated with commas,
        // and wrap them in braces.

        if (partial.length === 0) {
          v = '{}';
        } else if (innerIndent) {
          v = '{\n' + innerIndent + partial.join(',\n' + innerIndent) + '\n' + outerIndent + '}';
        } else {
          v = '{' + partial.join(',') + '}';
        }

        return v;
      }

    default: // Do nothing

  }
}; // If the JSON object does not yet have a stringify method, give it one.


const canonicalStringify = (value, options) => {
  // Make a fake root object containing our value under the key of ''.
  // Return the result of stringifying the value.
  const allOptions = Object.assign({
    indent: '',
    canonical: false
  }, options);

  if (allOptions.indent === true) {
    allOptions.indent = '  ';
  } else if (typeof allOptions.indent === 'number') {
    let newIndent = '';

    for (let i = 0; i < allOptions.indent; i++) {
      newIndent += ' ';
    }

    allOptions.indent = newIndent;
  }

  return str('', {
    '': value
  }, allOptions.indent, '', allOptions.canonical);
};

module.exportDefault(canonicalStringify);
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});

var exports = require("/node_modules/meteor/ejson/ejson.js");

/* Exports */
Package._define("ejson", exports, {
  EJSON: EJSON
});

})();

//# sourceURL=meteor://💻app/packages/ejson.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvZWpzb24vZWpzb24uanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL2Vqc29uL3N0cmluZ2lmeS5qcyJdLCJuYW1lcyI6WyJtb2R1bGUiLCJleHBvcnQiLCJFSlNPTiIsImN1c3RvbVR5cGVzIiwiaGFzT3duIiwib2JqIiwicHJvcCIsImhhc093blByb3BlcnR5IiwiY2FsbCIsImlzQXJndW1lbnRzIiwiaXNJbmZPck5hbiIsIk51bWJlciIsImlzTmFOIiwiSW5maW5pdHkiLCJhZGRUeXBlIiwibmFtZSIsImZhY3RvcnkiLCJFcnJvciIsImJ1aWx0aW5Db252ZXJ0ZXJzIiwibWF0Y2hKU09OVmFsdWUiLCJPYmplY3QiLCJrZXlzIiwibGVuZ3RoIiwibWF0Y2hPYmplY3QiLCJEYXRlIiwidG9KU09OVmFsdWUiLCIkZGF0ZSIsImdldFRpbWUiLCJmcm9tSlNPTlZhbHVlIiwiUmVnRXhwIiwicmVnZXhwIiwiJHJlZ2V4cCIsInNvdXJjZSIsIiRmbGFncyIsImZsYWdzIiwic2xpY2UiLCJyZXBsYWNlIiwic2lnbiIsIiRJbmZOYU4iLCJVaW50OEFycmF5IiwiJGJpbmFyeSIsIkJhc2U2NCIsImVuY29kZSIsImRlY29kZSIsIm1hdGNoIiwia2V5Q291bnQiLCJzb21lIiwiY29udmVydGVyIiwibmV3T2JqIiwiZm9yRWFjaCIsImtleSIsIiRlc2NhcGUiLCJfaXNDdXN0b21UeXBlIiwianNvblZhbHVlIiwiTWV0ZW9yIiwiX25vWWllbGRzQWxsb3dlZCIsIiR0eXBlIiwidHlwZU5hbWUiLCIkdmFsdWUiLCJfZ2V0VHlwZXMiLCJfZ2V0Q29udmVydGVycyIsInRvSlNPTlZhbHVlSGVscGVyIiwiaXRlbSIsImkiLCJ1bmRlZmluZWQiLCJhZGp1c3RUeXBlc1RvSlNPTlZhbHVlIiwibWF5YmVDaGFuZ2VkIiwidmFsdWUiLCJjaGFuZ2VkIiwiX2FkanVzdFR5cGVzVG9KU09OVmFsdWUiLCJuZXdJdGVtIiwiY2xvbmUiLCJmcm9tSlNPTlZhbHVlSGVscGVyIiwiZXZlcnkiLCJrIiwic3Vic3RyIiwiYWRqdXN0VHlwZXNGcm9tSlNPTlZhbHVlIiwiX2FkanVzdFR5cGVzRnJvbUpTT05WYWx1ZSIsInN0cmluZ2lmeSIsIm9wdGlvbnMiLCJzZXJpYWxpemVkIiwianNvbiIsImNhbm9uaWNhbCIsImluZGVudCIsImNhbm9uaWNhbFN0cmluZ2lmeSIsImxpbmsiLCJkZWZhdWx0IiwidiIsIkpTT04iLCJwYXJzZSIsImlzQmluYXJ5IiwiJFVpbnQ4QXJyYXlQb2x5ZmlsbCIsImVxdWFscyIsImEiLCJiIiwia2V5T3JkZXJTZW5zaXRpdmUiLCJ2YWx1ZU9mIiwiQXJyYXkiLCJyZXQiLCJhS2V5cyIsImJLZXlzIiwibmV3QmluYXJ5IiwiaXNBcnJheSIsIm1hcCIsImZyb20iLCJxdW90ZSIsInN0cmluZyIsInN0ciIsImhvbGRlciIsInNpbmdsZUluZGVudCIsIm91dGVySW5kZW50IiwiaXNGaW5pdGUiLCJTdHJpbmciLCJpbm5lckluZGVudCIsInBhcnRpYWwiLCJqb2luIiwic29ydCIsInB1c2giLCJhbGxPcHRpb25zIiwiYXNzaWduIiwibmV3SW5kZW50IiwiZXhwb3J0RGVmYXVsdCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBQSxNQUFNLENBQUNDLE1BQVAsQ0FBYztBQUFDQyxPQUFLLEVBQUMsTUFBSUE7QUFBWCxDQUFkOztBQUFBOzs7O0FBSUEsTUFBTUEsS0FBSyxHQUFHLEVBQWQsQyxDQUVBOztBQUNBOzs7Ozs7OztBQVFBOzs7Ozs7Ozs7O0FBVUE7Ozs7Ozs7O0FBUUE7Ozs7Ozs7OztBQVNBOzs7Ozs7Ozs7O0FBVUEsTUFBTUMsV0FBVyxHQUFHLEVBQXBCOztBQUVBLE1BQU1DLE1BQU0sR0FBRyxDQUFDQyxHQUFELEVBQU1DLElBQU4sS0FBZSxDQUFDLEVBQUQsRUFBS0MsY0FBTCxDQUFvQkMsSUFBcEIsQ0FBeUJILEdBQXpCLEVBQThCQyxJQUE5QixDQUE5Qjs7QUFFQSxNQUFNRyxXQUFX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QUFNLENBQUN5SCxhQUFQLENBeUhlckMsa0JBekhmLEUiLCJmaWxlIjoiL3BhY2thZ2VzL2Vqc29uLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbmFtZXNwYWNlXG4gKiBAc3VtbWFyeSBOYW1lc3BhY2UgZm9yIEVKU09OIGZ1bmN0aW9uc1xuICovXG5jb25zdCBFSlNPTiA9IHt9O1xuXG4vLyBDdXN0b20gdHlwZSBpbnRlcmZhY2UgZGVmaW5pdGlvblxuLyoqXG4gKiBAY2xhc3MgQ3VzdG9tVHlwZVxuICogQGluc3RhbmNlTmFtZSBjdXN0b21UeXBlXG4gKiBAbWVtYmVyT2YgRUpTT05cbiAqIEBzdW1tYXJ5IFRoZSBpbnRlcmZhY2UgdGhhdCBhIGNsYXNzIG11c3Qgc2F0aXNmeSB0byBiZSBhYmxlIHRvIGJlY29tZSBhblxuICogRUpTT04gY3VzdG9tIHR5cGUgdmlhIEVKU09OLmFkZFR5cGUuXG4gKi9cblxuLyoqXG4gKiBAZnVuY3Rpb24gdHlwZU5hbWVcbiAqIEBtZW1iZXJPZiBFSlNPTi5DdXN0b21UeXBlXG4gKiBAc3VtbWFyeSBSZXR1cm4gdGhlIHRhZyB1c2VkIHRvIGlkZW50aWZ5IHRoaXMgdHlwZS4gIFRoaXMgbXVzdCBtYXRjaCB0aGVcbiAqICAgICAgICAgIHRhZyB1c2VkIHRvIHJlZ2lzdGVyIHRoaXMgdHlwZSB3aXRoXG4gKiAgICAgICAgICBbYEVKU09OLmFkZFR5cGVgXSgjZWpzb25fYWRkX3R5cGUpLlxuICogQGxvY3VzIEFueXdoZXJlXG4gKiBAaW5zdGFuY2VcbiAqL1xuXG4vKipcbiAqIEBmdW5jdGlvbiB0b0pTT05WYWx1ZVxuICogQG1lbWJlck9mIEVKU09OLkN1c3RvbVR5cGVcbiAqIEBzdW1tYXJ5IFNlcmlhbGl6ZSB0aGlzIGluc3RhbmNlIGludG8gYSBKU09OLWNvbXBhdGlibGUgdmFsdWUuXG4gKiBAbG9jdXMgQW55d2hlcmVcbiAqIEBpbnN0YW5jZVxuICovXG5cbi8qKlxuICogQGZ1bmN0aW9uIGNsb25lXG4gKiBAbWVtYmVyT2YgRUpTT04uQ3VzdG9tVHlwZVxuICogQHN1bW1hcnkgUmV0dXJuIGEgdmFsdWUgYHJgIHN1Y2ggdGhhdCBgdGhpcy5lcXVhbHMocilgIGlzIHRydWUsIGFuZFxuICogICAgICAgICAgbW9kaWZpY2F0aW9ucyB0byBgcmAgZG8gbm90IGFmZmVjdCBgdGhpc2AgYW5kIHZpY2UgdmVyc2EuXG4gKiBAbG9jdXMgQW55d2hlcmVcbiAqIEBpbnN0YW5jZVxuICovXG5cbi8qKlxuICogQGZ1bmN0aW9uIGVxdWFsc1xuICogQG1lbWJlck9mIEVKU09OLkN1c3RvbVR5cGVcbiAqIEBzdW1tYXJ5IFJldHVybiBgdHJ1ZWAgaWYgYG90aGVyYCBoYXMgYSB2YWx1ZSBlcXVhbCB0byBgdGhpc2A7IGBmYWxzZWBcbiAqICAgICAgICAgIG90aGVyd2lzZS5cbiAqIEBsb2N1cyBBbnl3aGVyZVxuICogQHBhcmFtIHtPYmplY3R9IG90aGVyIEFub3RoZXIgb2JqZWN0IHRvIGNvbXBhcmUgdGhpcyB0by5cbiAqIEBpbnN0YW5jZVxuICovXG5cbmNvbnN0IGN1c3RvbVR5cGVzID0ge307XG5cbmNvbnN0IGhhc093biA9IChvYmosIHByb3ApID0+ICh7fSkuaGFzT3duUHJvcGVydHkuY2FsbChvYmosIHByb3ApO1xuXG5jb25zdCBpc0FyZ3VtZW50cyA9IG9iaiA9PiBvYmogIT0gbnVsbCAmJiBoYXNPd24ob2JqLCAnY2FsbGVlJyk7XG5cbmNvbnN0IGlzSW5mT3JOYW4gPVxuICBvYmogPT4gTnVtYmVyLmlzTmFOKG9iaikgfHwgb2JqID09PSBJbmZpbml0eSB8fCBvYmogPT09IC1JbmZpbml0eTtcblxuLy8gQWRkIGEgY3VzdG9tIHR5cGUsIHVzaW5nIGEgbWV0aG9kIG9mIHlvdXIgY2hvaWNlIHRvIGdldCB0byBhbmRcbi8vIGZyb20gYSBiYXNpYyBKU09OLWFibGUgcmVwcmVzZW50YXRpb24uICBUaGUgZmFjdG9yeSBhcmd1bWVudFxuLy8gaXMgYSBmdW5jdGlvbiBvZiBKU09OLWFibGUgLS0+IHlvdXIgb2JqZWN0XG4vLyBUaGUgdHlwZSB5b3UgYWRkIG11c3QgaGF2ZTpcbi8vIC0gQSB0b0pTT05WYWx1ZSgpIG1ldGhvZCwgc28gdGhhdCBNZXRlb3IgY2FuIHNlcmlhbGl6ZSBpdFxuLy8gLSBhIHR5cGVOYW1lKCkgbWV0aG9kLCB0byBzaG93IGhvdyB0byBsb29rIGl0IHVwIGluIG91ciB0eXBlIHRhYmxlLlxuLy8gSXQgaXMgb2theSBpZiB0aGVzZSBtZXRob2RzIGFyZSBtb25rZXktcGF0Y2hlZCBvbi5cbi8vIEVKU09OLmNsb25lIHdpbGwgdXNlIHRvSlNPTlZhbHVlIGFuZCB0aGUgZ2l2ZW4gZmFjdG9yeSB0byBwcm9kdWNlXG4vLyBhIGNsb25lLCBidXQgeW91IG1heSBzcGVjaWZ5IGEgbWV0aG9kIGNsb25lKCkgdGhhdCB3aWxsIGJlXG4vLyB1c2VkIGluc3RlYWQuXG4vLyBTaW1pbGFybHksIEVKU09OLmVxdWFscyB3aWxsIHVzZSB0b0pTT05WYWx1ZSB0byBtYWtlIGNvbXBhcmlzb25zLFxuLy8gYnV0IHlvdSBtYXkgcHJvdmlkZSBhIG1ldGhvZCBlcXVhbHMoKSBpbnN0ZWFkLlxuLyoqXG4gKiBAc3VtbWFyeSBBZGQgYSBjdXN0b20gZGF0YXR5cGUgdG8gRUpTT04uXG4gKiBAbG9jdXMgQW55d2hlcmVcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIEEgdGFnIGZvciB5b3VyIGN1c3RvbSB0eXBlOyBtdXN0IGJlIHVuaXF1ZSBhbW9uZ1xuICogICAgICAgICAgICAgICAgICAgICAgY3VzdG9tIGRhdGEgdHlwZXMgZGVmaW5lZCBpbiB5b3VyIHByb2plY3QsIGFuZCBtdXN0XG4gKiAgICAgICAgICAgICAgICAgICAgICBtYXRjaCB0aGUgcmVzdWx0IG9mIHlvdXIgdHlwZSdzIGB0eXBlTmFtZWAgbWV0aG9kLlxuICogQHBhcmFtIHtGdW5jdGlvbn0gZmFjdG9yeSBBIGZ1bmN0aW9uIHRoYXQgZGVzZXJpYWxpemVzIGEgSlNPTi1jb21wYXRpYmxlXG4gKiAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlIGludG8gYW4gaW5zdGFuY2Ugb2YgeW91ciB0eXBlLiAgVGhpcyBzaG91bGRcbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgbWF0Y2ggdGhlIHNlcmlhbGl6YXRpb24gcGVyZm9ybWVkIGJ5IHlvdXJcbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZSdzIGB0b0pTT05WYWx1ZWAgbWV0aG9kLlxuICovXG5FSlNPTi5hZGRUeXBlID0gKG5hbWUsIGZhY3RvcnkpID0+IHtcbiAgaWYgKGhhc093bihjdXN0b21UeXBlcywgbmFtZSkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFR5cGUgJHtuYW1lfSBhbHJlYWR5IHByZXNlbnRgKTtcbiAgfVxuICBjdXN0b21UeXBlc1tuYW1lXSA9IGZhY3Rvcnk7XG59O1xuXG5jb25zdCBidWlsdGluQ29udmVydGVycyA9IFtcbiAgeyAvLyBEYXRlXG4gICAgbWF0Y2hKU09OVmFsdWUob2JqKSB7XG4gICAgICByZXR1cm4gaGFzT3duKG9iaiwgJyRkYXRlJykgJiYgT2JqZWN0LmtleXMob2JqKS5sZW5ndGggPT09IDE7XG4gICAgfSxcbiAgICBtYXRjaE9iamVjdChvYmopIHtcbiAgICAgIHJldHVybiBvYmogaW5zdGFuY2VvZiBEYXRlO1xuICAgIH0sXG4gICAgdG9KU09OVmFsdWUob2JqKSB7XG4gICAgICByZXR1cm4geyRkYXRlOiBvYmouZ2V0VGltZSgpfTtcbiAgICB9LFxuICAgIGZyb21KU09OVmFsdWUob2JqKSB7XG4gICAgICByZXR1cm4gbmV3IERhdGUob2JqLiRkYXRlKTtcbiAgICB9LFxuICB9LFxuICB7IC8vIFJlZ0V4cFxuICAgIG1hdGNoSlNPTlZhbHVlKG9iaikge1xuICAgICAgcmV0dXJuIGhhc093bihvYmosICckcmVnZXhwJylcbiAgICAgICAgJiYgaGFzT3duKG9iaiwgJyRmbGFncycpXG4gICAgICAgICYmIE9iamVjdC5rZXlzKG9iaikubGVuZ3RoID09PSAyO1xuICAgIH0sXG4gICAgbWF0Y2hPYmplY3Qob2JqKSB7XG4gICAgICByZXR1cm4gb2JqIGluc3RhbmNlb2YgUmVnRXhwO1xuICAgIH0sXG4gICAgdG9KU09OVmFsdWUocmVnZXhwKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICAkcmVnZXhwOiByZWdleHAuc291cmNlLFxuICAgICAgICAkZmxhZ3M6IHJlZ2V4cC5mbGFnc1xuICAgICAgfTtcbiAgICB9LFxuICAgIGZyb21KU09OVmFsdWUob2JqKSB7XG4gICAgICAvLyBSZXBsYWNlcyBkdXBsaWNhdGUgLyBpbnZhbGlkIGZsYWdzLlxuICAgICAgcmV0dXJuIG5ldyBSZWdFeHAoXG4gICAgICAgIG9iai4kcmVnZXhwLFxuICAgICAgICBvYmouJGZsYWdzXG4gICAgICAgICAgLy8gQ3V0IG9mZiBmbGFncyBhdCA1MCBjaGFycyB0byBhdm9pZCBhYnVzaW5nIFJlZ0V4cCBmb3IgRE9TLlxuICAgICAgICAgIC5zbGljZSgwLCA1MClcbiAgICAgICAgICAucmVwbGFjZSgvW15naW11eV0vZywnJylcbiAgICAgICAgICAucmVwbGFjZSgvKC4pKD89LipcXDEpL2csICcnKVxuICAgICAgKTtcbiAgICB9LFxuICB9LFxuICB7IC8vIE5hTiwgSW5mLCAtSW5mLiAoVGhlc2UgYXJlIHRoZSBvbmx5IG9iamVjdHMgd2l0aCB0eXBlb2YgIT09ICdvYmplY3QnXG4gICAgLy8gd2hpY2ggd2UgbWF0Y2guKVxuICAgIG1hdGNoSlNPTlZhbHVlKG9iaikge1xuICAgICAgcmV0dXJuIGhhc093bihvYmosICckSW5mTmFOJykgJiYgT2JqZWN0LmtleXMob2JqKS5sZW5ndGggPT09IDE7XG4gICAgfSxcbiAgICBtYXRjaE9iamVjdDogaXNJbmZPck5hbixcbiAgICB0b0pTT05WYWx1ZShvYmopIHtcbiAgICAgIGxldCBzaWduO1xuICAgICAgaWYgKE51bWJlci5pc05hTihvYmopKSB7XG4gICAgICAgIHNpZ24gPSAwO1xuICAgICAgfSBlbHNlIGlmIChvYmogPT09IEluZmluaXR5KSB7XG4gICAgICAgIHNpZ24gPSAxO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc2lnbiA9IC0xO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHskSW5mTmFOOiBzaWdufTtcbiAgICB9LFxuICAgIGZyb21KU09OVmFsdWUob2JqKSB7XG4gICAgICByZXR1cm4gb2JqLiRJbmZOYU4gLyAwO1xuICAgIH0sXG4gIH0sXG4gIHsgLy8gQmluYXJ5XG4gICAgbWF0Y2hKU09OVmFsdWUob2JqKSB7XG4gICAgICByZXR1cm4gaGFzT3duKG9iaiwgJyRiaW5hcnknKSAmJiBPYmplY3Qua2V5cyhvYmopLmxlbmd0aCA9PT0gMTtcbiAgICB9LFxuICAgIG1hdGNoT2JqZWN0KG9iaikge1xuICAgICAgcmV0dXJuIHR5cGVvZiBVaW50OEFycmF5ICE9PSAndW5kZWZpbmVkJyAmJiBvYmogaW5zdGFuY2VvZiBVaW50OEFycmF5XG4gICAgICAgIHx8IChvYmogJiYgaGFzT3duKG9iaiwgJyRVaW50OEFycmF5UG9seWZpbGwnKSk7XG4gICAgfSxcbiAgICB0b0pTT05WYWx1ZShvYmopIHtcbiAgICAgIHJldHVybiB7JGJpbmFyeTogQmFzZTY0LmVuY29kZShvYmopfTtcbiAgICB9LFxuICAgIGZyb21KU09OVmFsdWUob2JqKSB7XG4gICAgICByZXR1cm4gQmFzZTY0LmRlY29kZShvYmouJGJpbmFyeSk7XG4gICAgfSxcbiAgfSxcbiAgeyAvLyBFc2NhcGluZyBvbmUgbGV2ZWxcbiAgICBtYXRjaEpTT05WYWx1ZShvYmopIHtcbiAgICAgIHJldHVybiBoYXNPd24ob2JqLCAnJGVzY2FwZScpICYmIE9iamVjdC5rZXlzKG9iaikubGVuZ3RoID09PSAxO1xuICAgIH0sXG4gICAgbWF0Y2hPYmplY3Qob2JqKSB7XG4gICAgICBsZXQgbWF0Y2ggPSBmYWxzZTtcbiAgICAgIGlmIChvYmopIHtcbiAgICAgICAgY29uc3Qga2V5Q291bnQgPSBPYmplY3Qua2V5cyhvYmopLmxlbmd0aDtcbiAgICAgICAgaWYgKGtleUNvdW50ID09PSAxIHx8IGtleUNvdW50ID09PSAyKSB7XG4gICAgICAgICAgbWF0Y2ggPVxuICAgICAgICAgICAgYnVpbHRpbkNvbnZlcnRlcnMuc29tZShjb252ZXJ0ZXIgPT4gY29udmVydGVyLm1hdGNoSlNPTlZhbHVlKG9iaikpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gbWF0Y2g7XG4gICAgfSxcbiAgICB0b0pTT05WYWx1ZShvYmopIHtcbiAgICAgIGNvbnN0IG5ld09iaiA9IHt9O1xuICAgICAgT2JqZWN0LmtleXMob2JqKS5mb3JFYWNoKGtleSA9PiB7XG4gICAgICAgIG5ld09ialtrZXldID0gRUpTT04udG9KU09OVmFsdWUob2JqW2tleV0pO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4geyRlc2NhcGU6IG5ld09ian07XG4gICAgfSxcbiAgICBmcm9tSlNPTlZhbHVlKG9iaikge1xuICAgICAgY29uc3QgbmV3T2JqID0ge307XG4gICAgICBPYmplY3Qua2V5cyhvYmouJGVzY2FwZSkuZm9yRWFjaChrZXkgPT4ge1xuICAgICAgICBuZXdPYmpba2V5XSA9IEVKU09OLmZyb21KU09OVmFsdWUob2JqLiRlc2NhcGVba2V5XSk7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiBuZXdPYmo7XG4gICAgfSxcbiAgfSxcbiAgeyAvLyBDdXN0b21cbiAgICBtYXRjaEpTT05WYWx1ZShvYmopIHtcbiAgICAgIHJldHVybiBoYXNPd24ob2JqLCAnJHR5cGUnKVxuICAgICAgICAmJiBoYXNPd24ob2JqLCAnJHZhbHVlJykgJiYgT2JqZWN0LmtleXMob2JqKS5sZW5ndGggPT09IDI7XG4gICAgfSxcbiAgICBtYXRjaE9iamVjdChvYmopIHtcbiAgICAgIHJldHVybiBFSlNPTi5faXNDdXN0b21UeXBlKG9iaik7XG4gICAgfSxcbiAgICB0b0pTT05WYWx1ZShvYmopIHtcbiAgICAgIGNvbnN0IGpzb25WYWx1ZSA9IE1ldGVvci5fbm9ZaWVsZHNBbGxvd2VkKCgpID0+IG9iai50b0pTT05WYWx1ZSgpKTtcbiAgICAgIHJldHVybiB7JHR5cGU6IG9iai50eXBlTmFtZSgpLCAkdmFsdWU6IGpzb25WYWx1ZX07XG4gICAgfSxcbiAgICBmcm9tSlNPTlZhbHVlKG9iaikge1xuICAgICAgY29uc3QgdHlwZU5hbWUgPSBvYmouJHR5cGU7XG4gICAgICBpZiAoIWhhc093bihjdXN0b21UeXBlcywgdHlwZU5hbWUpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgQ3VzdG9tIEVKU09OIHR5cGUgJHt0eXBlTmFtZX0gaXMgbm90IGRlZmluZWRgKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGNvbnZlcnRlciA9IGN1c3RvbVR5cGVzW3R5cGVOYW1lXTtcbiAgICAgIHJldHVybiBNZXRlb3IuX25vWWllbGRzQWxsb3dlZCgoKSA9PiBjb252ZXJ0ZXIob2JqLiR2YWx1ZSkpO1xuICAgIH0sXG4gIH0sXG5dO1xuXG5FSlNPTi5faXNDdXN0b21UeXBlID0gKG9iaikgPT4gKFxuICBvYmogJiZcbiAgdHlwZW9mIG9iai50b0pTT05WYWx1ZSA9PT0gJ2Z1bmN0aW9uJyAmJlxuICB0eXBlb2Ygb2JqLnR5cGVOYW1lID09PSAnZnVuY3Rpb24nICYmXG4gIGhhc093bihjdXN0b21UeXBlcywgb2JqLnR5cGVOYW1lKCkpXG4pO1xuXG5FSlNPTi5fZ2V0VHlwZXMgPSAoKSA9PiBjdXN0b21UeXBlcztcblxuRUpTT04uX2dldENvbnZlcnRlcnMgPSAoKSA9PiBidWlsdGluQ29udmVydGVycztcblxuLy8gRWl0aGVyIHJldHVybiB0aGUgSlNPTi1jb21wYXRpYmxlIHZlcnNpb24gb2YgdGhlIGFyZ3VtZW50LCBvciB1bmRlZmluZWQgKGlmXG4vLyB0aGUgaXRlbSBpc24ndCBpdHNlbGYgcmVwbGFjZWFibGUsIGJ1dCBtYXliZSBzb21lIGZpZWxkcyBpbiBpdCBhcmUpXG5jb25zdCB0b0pTT05WYWx1ZUhlbHBlciA9IGl0ZW0gPT4ge1xuICBmb3IgKGxldCBpID0gMDsgaSA8IGJ1aWx0aW5Db252ZXJ0ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgY29udmVydGVyID0gYnVpbHRpbkNvbnZlcnRlcnNbaV07XG4gICAgaWYgKGNvbnZlcnRlci5tYXRjaE9iamVjdChpdGVtKSkge1xuICAgICAgcmV0dXJuIGNvbnZlcnRlci50b0pTT05WYWx1ZShpdGVtKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHVuZGVmaW5lZDtcbn07XG5cbi8vIGZvciBib3RoIGFycmF5cyBhbmQgb2JqZWN0cywgaW4tcGxhY2UgbW9kaWZpY2F0aW9uLlxuY29uc3QgYWRqdXN0VHlwZXNUb0pTT05WYWx1ZSA9IG9iaiA9PiB7XG4gIC8vIElzIGl0IGFuIGF0b20gdGhhdCB3ZSBuZWVkIHRvIGFkanVzdD9cbiAgaWYgKG9iaiA9PT0gbnVsbCkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgY29uc3QgbWF5YmVDaGFuZ2VkID0gdG9KU09OVmFsdWVIZWxwZXIob2JqKTtcbiAgaWYgKG1heWJlQ2hhbmdlZCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuIG1heWJlQ2hhbmdlZDtcbiAgfVxuXG4gIC8vIE90aGVyIGF0b21zIGFyZSB1bmNoYW5nZWQuXG4gIGlmICh0eXBlb2Ygb2JqICE9PSAnb2JqZWN0Jykge1xuICAgIHJldHVybiBvYmo7XG4gIH1cblxuICAvLyBJdGVyYXRlIG92ZXIgYXJyYXkgb3Igb2JqZWN0IHN0cnVjdHVyZS5cbiAgT2JqZWN0LmtleXMob2JqKS5mb3JFYWNoKGtleSA9PiB7XG4gICAgY29uc3QgdmFsdWUgPSBvYmpba2V5XTtcbiAgICBpZiAodHlwZW9mIHZhbHVlICE9PSAnb2JqZWN0JyAmJiB2YWx1ZSAhPT0gdW5kZWZpbmVkICYmXG4gICAgICAgICFpc0luZk9yTmFuKHZhbHVlKSkge1xuICAgICAgcmV0dXJuOyAvLyBjb250aW51ZVxuICAgIH1cblxuICAgIGNvbnN0IGNoYW5nZWQgPSB0b0pTT05WYWx1ZUhlbHBlcih2YWx1ZSk7XG4gICAgaWYgKGNoYW5nZWQpIHtcbiAgICAgIG9ialtrZXldID0gY2hhbmdlZDtcbiAgICAgIHJldHVybjsgLy8gb24gdG8gdGhlIG5leHQga2V5XG4gICAgfVxuICAgIC8vIGlmIHdlIGdldCBoZXJlLCB2YWx1ZSBpcyBhbiBvYmplY3QgYnV0IG5vdCBhZGp1c3RhYmxlXG4gICAgLy8gYXQgdGhpcyBsZXZlbC4gIHJlY3Vyc2UuXG4gICAgYWRqdXN0VHlwZXNUb0pTT05WYWx1ZSh2YWx1ZSk7XG4gIH0pO1xuICByZXR1cm4gb2JqO1xufTtcblxuRUpTT04uX2FkanVzdFR5cGVzVG9KU09OVmFsdWUgPSBhZGp1c3RUeXBlc1RvSlNPTlZhbHVlO1xuXG4vKipcbiAqIEBzdW1tYXJ5IFNlcmlhbGl6ZSBhbiBFSlNPTi1jb21wYXRpYmxlIHZhbHVlIGludG8gaXRzIHBsYWluIEpTT05cbiAqICAgICAgICAgIHJlcHJlc2VudGF0aW9uLlxuICogQGxvY3VzIEFueXdoZXJlXG4gKiBAcGFyYW0ge0VKU09OfSB2YWwgQSB2YWx1ZSB0byBzZXJpYWxpemUgdG8gcGxhaW4gSlNPTi5cbiAqL1xuRUpTT04udG9KU09OVmFsdWUgPSBpdGVtID0+IHtcbiAgY29uc3QgY2hhbmdlZCA9IHRvSlNPTlZhbHVlSGVscGVyKGl0ZW0pO1xuICBpZiAoY2hhbmdlZCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuIGNoYW5nZWQ7XG4gIH1cblxuICBsZXQgbmV3SXRlbSA9IGl0ZW07XG4gIGlmICh0eXBlb2YgaXRlbSA9PT0gJ29iamVjdCcpIHtcbiAgICBuZXdJdGVtID0gRUpTT04uY2xvbmUoaXRlbSk7XG4gICAgYWRqdXN0VHlwZXNUb0pTT05WYWx1ZShuZXdJdGVtKTtcbiAgfVxuICByZXR1cm4gbmV3SXRlbTtcbn07XG5cbi8vIEVpdGhlciByZXR1cm4gdGhlIGFyZ3VtZW50IGNoYW5nZWQgdG8gaGF2ZSB0aGUgbm9uLWpzb25cbi8vIHJlcCBvZiBpdHNlbGYgKHRoZSBPYmplY3QgdmVyc2lvbikgb3IgdGhlIGFyZ3VtZW50IGl0c2VsZi5cbi8vIERPRVMgTk9UIFJFQ1VSU0UuICBGb3IgYWN0dWFsbHkgZ2V0dGluZyB0aGUgZnVsbHktY2hhbmdlZCB2YWx1ZSwgdXNlXG4vLyBFSlNPTi5mcm9tSlNPTlZhbHVlXG5jb25zdCBmcm9tSlNPTlZhbHVlSGVscGVyID0gdmFsdWUgPT4ge1xuICBpZiAodHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJiB2YWx1ZSAhPT0gbnVsbCkge1xuICAgIGNvbnN0IGtleXMgPSBPYmplY3Qua2V5cyh2YWx1ZSk7XG4gICAgaWYgKGtleXMubGVuZ3RoIDw9IDJcbiAgICAgICAgJiYga2V5cy5ldmVyeShrID0+IHR5cGVvZiBrID09PSAnc3RyaW5nJyAmJiBrLnN1YnN0cigwLCAxKSA9PT0gJyQnKSkge1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBidWlsdGluQ29udmVydGVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBjb252ZXJ0ZXIgPSBidWlsdGluQ29udmVydGVyc1tpXTtcbiAgICAgICAgaWYgKGNvbnZlcnRlci5tYXRjaEpTT05WYWx1ZSh2YWx1ZSkpIHtcbiAgICAgICAgICByZXR1cm4gY29udmVydGVyLmZyb21KU09OVmFsdWUodmFsdWUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHJldHVybiB2YWx1ZTtcbn07XG5cbi8vIGZvciBib3RoIGFycmF5cyBhbmQgb2JqZWN0cy4gVHJpZXMgaXRzIGJlc3QgdG8ganVzdFxuLy8gdXNlIHRoZSBvYmplY3QgeW91IGhhbmQgaXQsIGJ1dCBtYXkgcmV0dXJuIHNvbWV0aGluZ1xuLy8gZGlmZmVyZW50IGlmIHRoZSBvYmplY3QgeW91IGhhbmQgaXQgaXRzZWxmIG5lZWRzIGNoYW5naW5nLlxuY29uc3QgYWRqdXN0VHlwZXNGcm9tSlNPTlZhbHVlID0gb2JqID0+IHtcbiAgaWYgKG9iaiA9PT0gbnVsbCkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgY29uc3QgbWF5YmVDaGFuZ2VkID0gZnJvbUpTT05WYWx1ZUhlbHBlcihvYmopO1xuICBpZiAobWF5YmVDaGFuZ2VkICE9PSBvYmopIHtcbiAgICByZXR1cm4gbWF5YmVDaGFuZ2VkO1xuICB9XG5cbiAgLy8gT3RoZXIgYXRvbXMgYXJlIHVuY2hhbmdlZC5cbiAgaWYgKHR5cGVvZiBvYmogIT09ICdvYmplY3QnKSB7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuXG4gIE9iamVjdC5rZXlzKG9iaikuZm9yRWFjaChrZXkgPT4ge1xuICAgIGNvbnN0IHZhbHVlID0gb2JqW2tleV07XG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgIGNvbnN0IGNoYW5nZWQgPSBmcm9tSlNPTlZhbHVlSGVscGVyKHZhbHVlKTtcbiAgICAgIGlmICh2YWx1ZSAhPT0gY2hhbmdlZCkge1xuICAgICAgICBvYmpba2V5XSA9IGNoYW5nZWQ7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIC8vIGlmIHdlIGdldCBoZXJlLCB2YWx1ZSBpcyBhbiBvYmplY3QgYnV0IG5vdCBhZGp1c3RhYmxlXG4gICAgICAvLyBhdCB0aGlzIGxldmVsLiAgcmVjdXJzZS5cbiAgICAgIGFkanVzdFR5cGVzRnJvbUpTT05WYWx1ZSh2YWx1ZSk7XG4gICAgfVxuICB9KTtcbiAgcmV0dXJuIG9iajtcbn07XG5cbkVKU09OLl9hZGp1c3RUeXBlc0Zyb21KU09OVmFsdWUgPSBhZGp1c3RUeXBlc0Zyb21KU09OVmFsdWU7XG5cbi8qKlxuICogQHN1bW1hcnkgRGVzZXJpYWxpemUgYW4gRUpTT04gdmFsdWUgZnJvbSBpdHMgcGxhaW4gSlNPTiByZXByZXNlbnRhdGlvbi5cbiAqIEBsb2N1cyBBbnl3aGVyZVxuICogQHBhcmFtIHtKU09OQ29tcGF0aWJsZX0gdmFsIEEgdmFsdWUgdG8gZGVzZXJpYWxpemUgaW50byBFSlNPTi5cbiAqL1xuRUpTT04uZnJvbUpTT05WYWx1ZSA9IGl0ZW0gPT4ge1xuICBsZXQgY2hhbmdlZCA9IGZyb21KU09OVmFsdWVIZWxwZXIoaXRlbSk7XG4gIGlmIChjaGFuZ2VkID09PSBpdGVtICYmIHR5cGVvZiBpdGVtID09PSAnb2JqZWN0Jykge1xuICAgIGNoYW5nZWQgPSBFSlNPTi5jbG9uZShpdGVtKTtcbiAgICBhZGp1c3RUeXBlc0Zyb21KU09OVmFsdWUoY2hhbmdlZCk7XG4gIH1cbiAgcmV0dXJuIGNoYW5nZWQ7XG59O1xuXG4vKipcbiAqIEBzdW1tYXJ5IFNlcmlhbGl6ZSBhIHZhbHVlIHRvIGEgc3RyaW5nLiBGb3IgRUpTT04gdmFsdWVzLCB0aGUgc2VyaWFsaXphdGlvblxuICogICAgICAgICAgZnVsbHkgcmVwcmVzZW50cyB0aGUgdmFsdWUuIEZvciBub24tRUpTT04gdmFsdWVzLCBzZXJpYWxpemVzIHRoZVxuICogICAgICAgICAgc2FtZSB3YXkgYXMgYEpTT04uc3RyaW5naWZ5YC5cbiAqIEBsb2N1cyBBbnl3aGVyZVxuICogQHBhcmFtIHtFSlNPTn0gdmFsIEEgdmFsdWUgdG8gc3RyaW5naWZ5LlxuICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXVxuICogQHBhcmFtIHtCb29sZWFuIHwgSW50ZWdlciB8IFN0cmluZ30gb3B0aW9ucy5pbmRlbnQgSW5kZW50cyBvYmplY3RzIGFuZFxuICogYXJyYXlzIGZvciBlYXN5IHJlYWRhYmlsaXR5LiAgV2hlbiBgdHJ1ZWAsIGluZGVudHMgYnkgMiBzcGFjZXM7IHdoZW4gYW5cbiAqIGludGVnZXIsIGluZGVudHMgYnkgdGhhdCBudW1iZXIgb2Ygc3BhY2VzOyBhbmQgd2hlbiBhIHN0cmluZywgdXNlcyB0aGVcbiAqIHN0cmluZyBhcyB0aGUgaW5kZW50YXRpb24gcGF0dGVybi5cbiAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy5jYW5vbmljYWwgV2hlbiBgdHJ1ZWAsIHN0cmluZ2lmaWVzIGtleXMgaW4gYW5cbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2JqZWN0IGluIHNvcnRlZCBvcmRlci5cbiAqL1xuRUpTT04uc3RyaW5naWZ5ID0gKGl0ZW0sIG9wdGlvbnMpID0+IHtcbiAgbGV0IHNlcmlhbGl6ZWQ7XG4gIGNvbnN0IGpzb24gPSBFSlNPTi50b0pTT05WYWx1ZShpdGVtKTtcbiAgaWYgKG9wdGlvbnMgJiYgKG9wdGlvbnMuY2Fub25pY2FsIHx8IG9wdGlvbnMuaW5kZW50KSkge1xuICAgIGltcG9ydCBjYW5vbmljYWxTdHJpbmdpZnkgZnJvbSAnLi9zdHJpbmdpZnknO1xuICAgIHNlcmlhbGl6ZWQgPSBjYW5vbmljYWxTdHJpbmdpZnkoanNvbiwgb3B0aW9ucyk7XG4gIH0gZWxzZSB7XG4gICAgc2VyaWFsaXplZCA9IEpTT04uc3RyaW5naWZ5KGpzb24pO1xuICB9XG4gIHJldHVybiBzZXJpYWxpemVkO1xufTtcblxuLyoqXG4gKiBAc3VtbWFyeSBQYXJzZSBhIHN0cmluZyBpbnRvIGFuIEVKU09OIHZhbHVlLiBUaHJvd3MgYW4gZXJyb3IgaWYgdGhlIHN0cmluZ1xuICogICAgICAgICAgaXMgbm90IHZhbGlkIEVKU09OLlxuICogQGxvY3VzIEFueXdoZXJlXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyIEEgc3RyaW5nIHRvIHBhcnNlIGludG8gYW4gRUpTT04gdmFsdWUuXG4gKi9cbkVKU09OLnBhcnNlID0gaXRlbSA9PiB7XG4gIGlmICh0eXBlb2YgaXRlbSAhPT0gJ3N0cmluZycpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0VKU09OLnBhcnNlIGFyZ3VtZW50IHNob3VsZCBiZSBhIHN0cmluZycpO1xuICB9XG4gIHJldHVybiBFSlNPTi5mcm9tSlNPTlZhbHVlKEpTT04ucGFyc2UoaXRlbSkpO1xufTtcblxuLyoqXG4gKiBAc3VtbWFyeSBSZXR1cm5zIHRydWUgaWYgYHhgIGlzIGEgYnVmZmVyIG9mIGJpbmFyeSBkYXRhLCBhcyByZXR1cm5lZCBmcm9tXG4gKiAgICAgICAgICBbYEVKU09OLm5ld0JpbmFyeWBdKCNlanNvbl9uZXdfYmluYXJ5KS5cbiAqIEBwYXJhbSB7T2JqZWN0fSB4IFRoZSB2YXJpYWJsZSB0byBjaGVjay5cbiAqIEBsb2N1cyBBbnl3aGVyZVxuICovXG5FSlNPTi5pc0JpbmFyeSA9IG9iaiA9PiB7XG4gIHJldHVybiAhISgodHlwZW9mIFVpbnQ4QXJyYXkgIT09ICd1bmRlZmluZWQnICYmIG9iaiBpbnN0YW5jZW9mIFVpbnQ4QXJyYXkpIHx8XG4gICAgKG9iaiAmJiBvYmouJFVpbnQ4QXJyYXlQb2x5ZmlsbCkpO1xufTtcblxuLyoqXG4gKiBAc3VtbWFyeSBSZXR1cm4gdHJ1ZSBpZiBgYWAgYW5kIGBiYCBhcmUgZXF1YWwgdG8gZWFjaCBvdGhlci4gIFJldHVybiBmYWxzZVxuICogICAgICAgICAgb3RoZXJ3aXNlLiAgVXNlcyB0aGUgYGVxdWFsc2AgbWV0aG9kIG9uIGBhYCBpZiBwcmVzZW50LCBvdGhlcndpc2VcbiAqICAgICAgICAgIHBlcmZvcm1zIGEgZGVlcCBjb21wYXJpc29uLlxuICogQGxvY3VzIEFueXdoZXJlXG4gKiBAcGFyYW0ge0VKU09OfSBhXG4gKiBAcGFyYW0ge0VKU09OfSBiXG4gKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdXG4gKiBAcGFyYW0ge0Jvb2xlYW59IG9wdGlvbnMua2V5T3JkZXJTZW5zaXRpdmUgQ29tcGFyZSBpbiBrZXkgc2Vuc2l0aXZlIG9yZGVyLFxuICogaWYgc3VwcG9ydGVkIGJ5IHRoZSBKYXZhU2NyaXB0IGltcGxlbWVudGF0aW9uLiAgRm9yIGV4YW1wbGUsIGB7YTogMSwgYjogMn1gXG4gKiBpcyBlcXVhbCB0byBge2I6IDIsIGE6IDF9YCBvbmx5IHdoZW4gYGtleU9yZGVyU2Vuc2l0aXZlYCBpcyBgZmFsc2VgLiAgVGhlXG4gKiBkZWZhdWx0IGlzIGBmYWxzZWAuXG4gKi9cbkVKU09OLmVxdWFscyA9IChhLCBiLCBvcHRpb25zKSA9PiB7XG4gIGxldCBpO1xuICBjb25zdCBrZXlPcmRlclNlbnNpdGl2ZSA9ICEhKG9wdGlvbnMgJiYgb3B0aW9ucy5rZXlPcmRlclNlbnNpdGl2ZSk7XG4gIGlmIChhID09PSBiKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICAvLyBUaGlzIGRpZmZlcnMgZnJvbSB0aGUgSUVFRSBzcGVjIGZvciBOYU4gZXF1YWxpdHksIGIvYyB3ZSBkb24ndCB3YW50XG4gIC8vIGFueXRoaW5nIGV2ZXIgd2l0aCBhIE5hTiB0byBiZSBwb2lzb25lZCBmcm9tIGJlY29taW5nIGVxdWFsIHRvIGFueXRoaW5nLlxuICBpZiAoTnVtYmVyLmlzTmFOKGEpICYmIE51bWJlci5pc05hTihiKSkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLy8gaWYgZWl0aGVyIG9uZSBpcyBmYWxzeSwgdGhleSdkIGhhdmUgdG8gYmUgPT09IHRvIGJlIGVxdWFsXG4gIGlmICghYSB8fCAhYikge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGlmICghKHR5cGVvZiBhID09PSAnb2JqZWN0JyAmJiB0eXBlb2YgYiA9PT0gJ29iamVjdCcpKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgaWYgKGEgaW5zdGFuY2VvZiBEYXRlICYmIGIgaW5zdGFuY2VvZiBEYXRlKSB7XG4gICAgcmV0dXJuIGEudmFsdWVPZigpID09PSBiLnZhbHVlT2YoKTtcbiAgfVxuXG4gIGlmIChFSlNPTi5pc0JpbmFyeShhKSAmJiBFSlNPTi5pc0JpbmFyeShiKSkge1xuICAgIGlmIChhLmxlbmd0aCAhPT0gYi5sZW5ndGgpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgZm9yIChpID0gMDsgaSA8IGEubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChhW2ldICE9PSBiW2ldKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBpZiAodHlwZW9mIChhLmVxdWFscykgPT09ICdmdW5jdGlvbicpIHtcbiAgICByZXR1cm4gYS5lcXVhbHMoYiwgb3B0aW9ucyk7XG4gIH1cblxuICBpZiAodHlwZW9mIChiLmVxdWFscykgPT09ICdmdW5jdGlvbicpIHtcbiAgICByZXR1cm4gYi5lcXVhbHMoYSwgb3B0aW9ucyk7XG4gIH1cblxuICBpZiAoYSBpbnN0YW5jZW9mIEFycmF5KSB7XG4gICAgaWYgKCEoYiBpbnN0YW5jZW9mIEFycmF5KSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBpZiAoYS5sZW5ndGggIT09IGIubGVuZ3RoKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGZvciAoaSA9IDA7IGkgPCBhLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoIUVKU09OLmVxdWFscyhhW2ldLCBiW2ldLCBvcHRpb25zKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLy8gZmFsbGJhY2sgZm9yIGN1c3RvbSB0eXBlcyB0aGF0IGRvbid0IGltcGxlbWVudCB0aGVpciBvd24gZXF1YWxzXG4gIHN3aXRjaCAoRUpTT04uX2lzQ3VzdG9tVHlwZShhKSArIEVKU09OLl9pc0N1c3RvbVR5cGUoYikpIHtcbiAgICBjYXNlIDE6IHJldHVybiBmYWxzZTtcbiAgICBjYXNlIDI6IHJldHVybiBFSlNPTi5lcXVhbHMoRUpTT04udG9KU09OVmFsdWUoYSksIEVKU09OLnRvSlNPTlZhbHVlKGIpKTtcbiAgICBkZWZhdWx0OiAvLyBEbyBub3RoaW5nXG4gIH1cblxuICAvLyBmYWxsIGJhY2sgdG8gc3RydWN0dXJhbCBlcXVhbGl0eSBvZiBvYmplY3RzXG4gIGxldCByZXQ7XG4gIGNvbnN0IGFLZXlzID0gT2JqZWN0LmtleXMoYSk7XG4gIGNvbnN0IGJLZXlzID0gT2JqZWN0LmtleXMoYik7XG4gIGlmIChrZXlPcmRlclNlbnNpdGl2ZSkge1xuICAgIGkgPSAwO1xuICAgIHJldCA9IGFLZXlzLmV2ZXJ5KGtleSA9PiB7XG4gICAgICBpZiAoaSA+PSBiS2V5cy5sZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgaWYgKGtleSAhPT0gYktleXNbaV0pIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgaWYgKCFFSlNPTi5lcXVhbHMoYVtrZXldLCBiW2JLZXlzW2ldXSwgb3B0aW9ucykpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgaSsrO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSk7XG4gIH0gZWxzZSB7XG4gICAgaSA9IDA7XG4gICAgcmV0ID0gYUtleXMuZXZlcnkoa2V5ID0+IHtcbiAgICAgIGlmICghaGFzT3duKGIsIGtleSkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgaWYgKCFFSlNPTi5lcXVhbHMoYVtrZXldLCBiW2tleV0sIG9wdGlvbnMpKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICAgIGkrKztcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0pO1xuICB9XG4gIHJldHVybiByZXQgJiYgaSA9PT0gYktleXMubGVuZ3RoO1xufTtcblxuLyoqXG4gKiBAc3VtbWFyeSBSZXR1cm4gYSBkZWVwIGNvcHkgb2YgYHZhbGAuXG4gKiBAbG9jdXMgQW55d2hlcmVcbiAqIEBwYXJhbSB7RUpTT059IHZhbCBBIHZhbHVlIHRvIGNvcHkuXG4gKi9cbkVKU09OLmNsb25lID0gdiA9PiB7XG4gIGxldCByZXQ7XG4gIGlmICh0eXBlb2YgdiAhPT0gJ29iamVjdCcpIHtcbiAgICByZXR1cm4gdjtcbiAgfVxuXG4gIGlmICh2ID09PSBudWxsKSB7XG4gICAgcmV0dXJuIG51bGw7IC8vIG51bGwgaGFzIHR5cGVvZiBcIm9iamVjdFwiXG4gIH1cblxuICBpZiAodiBpbnN0YW5jZW9mIERhdGUpIHtcbiAgICByZXR1cm4gbmV3IERhdGUodi5nZXRUaW1lKCkpO1xuICB9XG5cbiAgLy8gUmVnRXhwcyBhcmUgbm90IHJlYWxseSBFSlNPTiBlbGVtZW50cyAoZWcgd2UgZG9uJ3QgZGVmaW5lIGEgc2VyaWFsaXphdGlvblxuICAvLyBmb3IgdGhlbSksIGJ1dCB0aGV5J3JlIGltbXV0YWJsZSBhbnl3YXksIHNvIHdlIGNhbiBzdXBwb3J0IHRoZW0gaW4gY2xvbmUuXG4gIGlmICh2IGluc3RhbmNlb2YgUmVnRXhwKSB7XG4gICAgcmV0dXJuIHY7XG4gIH1cblxuICBpZiAoRUpTT04uaXNCaW5hcnkodikpIHtcbiAgICByZXQgPSBFSlNPTi5uZXdCaW5hcnkodi5sZW5ndGgpO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdi5sZW5ndGg7IGkrKykge1xuICAgICAgcmV0W2ldID0gdltpXTtcbiAgICB9XG4gICAgcmV0dXJuIHJldDtcbiAgfVxuXG4gIGlmIChBcnJheS5pc0FycmF5KHYpKSB7XG4gICAgcmV0dXJuIHYubWFwKHZhbHVlID0+IEVKU09OLmNsb25lKHZhbHVlKSk7XG4gIH1cblxuICBpZiAoaXNBcmd1bWVudHModikpIHtcbiAgICByZXR1cm4gQXJyYXkuZnJvbSh2KS5tYXAodmFsdWUgPT4gRUpTT04uY2xvbmUodmFsdWUpKTtcbiAgfVxuXG4gIC8vIGhhbmRsZSBnZW5lcmFsIHVzZXItZGVmaW5lZCB0eXBlZCBPYmplY3RzIGlmIHRoZXkgaGF2ZSBhIGNsb25lIG1ldGhvZFxuICBpZiAodHlwZW9mIHYuY2xvbmUgPT09ICdmdW5jdGlvbicpIHtcbiAgICByZXR1cm4gdi5jbG9uZSgpO1xuICB9XG5cbiAgLy8gaGFuZGxlIG90aGVyIGN1c3RvbSB0eXBlc1xuICBpZiAoRUpTT04uX2lzQ3VzdG9tVHlwZSh2KSkge1xuICAgIHJldHVybiBFSlNPTi5mcm9tSlNPTlZhbHVlKEVKU09OLmNsb25lKEVKU09OLnRvSlNPTlZhbHVlKHYpKSwgdHJ1ZSk7XG4gIH1cblxuICAvLyBoYW5kbGUgb3RoZXIgb2JqZWN0c1xuICByZXQgPSB7fTtcbiAgT2JqZWN0LmtleXModikuZm9yRWFjaCgoa2V5KSA9PiB7XG4gICAgcmV0W2tleV0gPSBFSlNPTi5jbG9uZSh2W2tleV0pO1xuICB9KTtcbiAgcmV0dXJuIHJldDtcbn07XG5cbi8qKlxuICogQHN1bW1hcnkgQWxsb2NhdGUgYSBuZXcgYnVmZmVyIG9mIGJpbmFyeSBkYXRhIHRoYXQgRUpTT04gY2FuIHNlcmlhbGl6ZS5cbiAqIEBsb2N1cyBBbnl3aGVyZVxuICogQHBhcmFtIHtOdW1iZXJ9IHNpemUgVGhlIG51bWJlciBvZiBieXRlcyBvZiBiaW5hcnkgZGF0YSB0byBhbGxvY2F0ZS5cbiAqL1xuLy8gRUpTT04ubmV3QmluYXJ5IGlzIHRoZSBwdWJsaWMgZG9jdW1lbnRlZCBBUEkgZm9yIHRoaXMgZnVuY3Rpb25hbGl0eSxcbi8vIGJ1dCB0aGUgaW1wbGVtZW50YXRpb24gaXMgaW4gdGhlICdiYXNlNjQnIHBhY2thZ2UgdG8gYXZvaWRcbi8vIGludHJvZHVjaW5nIGEgY2lyY3VsYXIgZGVwZW5kZW5jeS4gKElmIHRoZSBpbXBsZW1lbnRhdGlvbiB3ZXJlIGhlcmUsXG4vLyB0aGVuICdiYXNlNjQnIHdvdWxkIGhhdmUgdG8gdXNlIEVKU09OLm5ld0JpbmFyeSwgYW5kICdlanNvbicgd291bGRcbi8vIGFsc28gaGF2ZSB0byB1c2UgJ2Jhc2U2NCcuKVxuRUpTT04ubmV3QmluYXJ5ID0gQmFzZTY0Lm5ld0JpbmFyeTtcblxuZXhwb3J0IHsgRUpTT04gfTtcbiIsIi8vIEJhc2VkIG9uIGpzb24yLmpzIGZyb20gaHR0cHM6Ly9naXRodWIuY29tL2RvdWdsYXNjcm9ja2ZvcmQvSlNPTi1qc1xuLy9cbi8vICAgIGpzb24yLmpzXG4vLyAgICAyMDEyLTEwLTA4XG4vL1xuLy8gICAgUHVibGljIERvbWFpbi5cbi8vXG4vLyAgICBOTyBXQVJSQU5UWSBFWFBSRVNTRUQgT1IgSU1QTElFRC4gVVNFIEFUIFlPVVIgT1dOIFJJU0suXG5cbmZ1bmN0aW9uIHF1b3RlKHN0cmluZykge1xuICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoc3RyaW5nKTtcbn1cblxuY29uc3Qgc3RyID0gKGtleSwgaG9sZGVyLCBzaW5nbGVJbmRlbnQsIG91dGVySW5kZW50LCBjYW5vbmljYWwpID0+IHtcbiAgY29uc3QgdmFsdWUgPSBob2xkZXJba2V5XTtcblxuICAvLyBXaGF0IGhhcHBlbnMgbmV4dCBkZXBlbmRzIG9uIHRoZSB2YWx1ZSdzIHR5cGUuXG4gIHN3aXRjaCAodHlwZW9mIHZhbHVlKSB7XG4gIGNhc2UgJ3N0cmluZyc6XG4gICAgcmV0dXJuIHF1b3RlKHZhbHVlKTtcbiAgY2FzZSAnbnVtYmVyJzpcbiAgICAvLyBKU09OIG51bWJlcnMgbXVzdCBiZSBmaW5pdGUuIEVuY29kZSBub24tZmluaXRlIG51bWJlcnMgYXMgbnVsbC5cbiAgICByZXR1cm4gaXNGaW5pdGUodmFsdWUpID8gU3RyaW5nKHZhbHVlKSA6ICdudWxsJztcbiAgY2FzZSAnYm9vbGVhbic6XG4gICAgcmV0dXJuIFN0cmluZyh2YWx1ZSk7XG4gIC8vIElmIHRoZSB0eXBlIGlzICdvYmplY3QnLCB3ZSBtaWdodCBiZSBkZWFsaW5nIHdpdGggYW4gb2JqZWN0IG9yIGFuIGFycmF5IG9yXG4gIC8vIG51bGwuXG4gIGNhc2UgJ29iamVjdCc6IHtcbiAgICAvLyBEdWUgdG8gYSBzcGVjaWZpY2F0aW9uIGJsdW5kZXIgaW4gRUNNQVNjcmlwdCwgdHlwZW9mIG51bGwgaXMgJ29iamVjdCcsXG4gICAgLy8gc28gd2F0Y2ggb3V0IGZvciB0aGF0IGNhc2UuXG4gICAgaWYgKCF2YWx1ZSkge1xuICAgICAgcmV0dXJuICdudWxsJztcbiAgICB9XG4gICAgLy8gTWFrZSBhbiBhcnJheSB0byBob2xkIHRoZSBwYXJ0aWFsIHJlc3VsdHMgb2Ygc3RyaW5naWZ5aW5nIHRoaXMgb2JqZWN0XG4gICAgLy8gdmFsdWUuXG4gICAgY29uc3QgaW5uZXJJbmRlbnQgPSBvdXRlckluZGVudCArIHNpbmdsZUluZGVudDtcbiAgICBjb25zdCBwYXJ0aWFsID0gW107XG4gICAgbGV0IHY7XG5cbiAgICAvLyBJcyB0aGUgdmFsdWUgYW4gYXJyYXk/XG4gICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpIHx8ICh7fSkuaGFzT3duUHJvcGVydHkuY2FsbCh2YWx1ZSwgJ2NhbGxlZScpKSB7XG4gICAgICAvLyBUaGUgdmFsdWUgaXMgYW4gYXJyYXkuIFN0cmluZ2lmeSBldmVyeSBlbGVtZW50LiBVc2UgbnVsbCBhcyBhXG4gICAgICAvLyBwbGFjZWhvbGRlciBmb3Igbm9uLUpTT04gdmFsdWVzLlxuICAgICAgY29uc3QgbGVuZ3RoID0gdmFsdWUubGVuZ3RoO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW5ndGg7IGkgKz0gMSkge1xuICAgICAgICBwYXJ0aWFsW2ldID1cbiAgICAgICAgICBzdHIoaSwgdmFsdWUsIHNpbmdsZUluZGVudCwgaW5uZXJJbmRlbnQsIGNhbm9uaWNhbCkgfHwgJ251bGwnO1xuICAgICAgfVxuXG4gICAgICAvLyBKb2luIGFsbCBvZiB0aGUgZWxlbWVudHMgdG9nZXRoZXIsIHNlcGFyYXRlZCB3aXRoIGNvbW1hcywgYW5kIHdyYXBcbiAgICAgIC8vIHRoZW0gaW4gYnJhY2tldHMuXG4gICAgICBpZiAocGFydGlhbC5sZW5ndGggPT09IDApIHtcbiAgICAgICAgdiA9ICdbXSc7XG4gICAgICB9IGVsc2UgaWYgKGlubmVySW5kZW50KSB7XG4gICAgICAgIHYgPSAnW1xcbicgK1xuICAgICAgICAgIGlubmVySW5kZW50ICtcbiAgICAgICAgICBwYXJ0aWFsLmpvaW4oJyxcXG4nICtcbiAgICAgICAgICBpbm5lckluZGVudCkgK1xuICAgICAgICAgICdcXG4nICtcbiAgICAgICAgICBvdXRlckluZGVudCArXG4gICAgICAgICAgJ10nO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdiA9ICdbJyArIHBhcnRpYWwuam9pbignLCcpICsgJ10nO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHY7XG4gICAgfVxuXG4gICAgLy8gSXRlcmF0ZSB0aHJvdWdoIGFsbCBvZiB0aGUga2V5cyBpbiB0aGUgb2JqZWN0LlxuICAgIGxldCBrZXlzID0gT2JqZWN0LmtleXModmFsdWUpO1xuICAgIGlmIChjYW5vbmljYWwpIHtcbiAgICAgIGtleXMgPSBrZXlzLnNvcnQoKTtcbiAgICB9XG4gICAga2V5cy5mb3JFYWNoKGsgPT4ge1xuICAgICAgdiA9IHN0cihrLCB2YWx1ZSwgc2luZ2xlSW5kZW50LCBpbm5lckluZGVudCwgY2Fub25pY2FsKTtcbiAgICAgIGlmICh2KSB7XG4gICAgICAgIHBhcnRpYWwucHVzaChxdW90ZShrKSArIChpbm5lckluZGVudCA/ICc6ICcgOiAnOicpICsgdik7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBKb2luIGFsbCBvZiB0aGUgbWVtYmVyIHRleHRzIHRvZ2V0aGVyLCBzZXBhcmF0ZWQgd2l0aCBjb21tYXMsXG4gICAgLy8gYW5kIHdyYXAgdGhlbSBpbiBicmFjZXMuXG4gICAgaWYgKHBhcnRpYWwubGVuZ3RoID09PSAwKSB7XG4gICAgICB2ID0gJ3t9JztcbiAgICB9IGVsc2UgaWYgKGlubmVySW5kZW50KSB7XG4gICAgICB2ID0gJ3tcXG4nICtcbiAgICAgICAgaW5uZXJJbmRlbnQgK1xuICAgICAgICBwYXJ0aWFsLmpvaW4oJyxcXG4nICtcbiAgICAgICAgaW5uZXJJbmRlbnQpICtcbiAgICAgICAgJ1xcbicgK1xuICAgICAgICBvdXRlckluZGVudCArXG4gICAgICAgICd9JztcbiAgICB9IGVsc2Uge1xuICAgICAgdiA9ICd7JyArIHBhcnRpYWwuam9pbignLCcpICsgJ30nO1xuICAgIH1cbiAgICByZXR1cm4gdjtcbiAgfVxuXG4gIGRlZmF1bHQ6IC8vIERvIG5vdGhpbmdcbiAgfVxufTtcblxuLy8gSWYgdGhlIEpTT04gb2JqZWN0IGRvZXMgbm90IHlldCBoYXZlIGEgc3RyaW5naWZ5IG1ldGhvZCwgZ2l2ZSBpdCBvbmUuXG5jb25zdCBjYW5vbmljYWxTdHJpbmdpZnkgPSAodmFsdWUsIG9wdGlvbnMpID0+IHtcbiAgLy8gTWFrZSBhIGZha2Ugcm9vdCBvYmplY3QgY29udGFpbmluZyBvdXIgdmFsdWUgdW5kZXIgdGhlIGtleSBvZiAnJy5cbiAgLy8gUmV0dXJuIHRoZSByZXN1bHQgb2Ygc3RyaW5naWZ5aW5nIHRoZSB2YWx1ZS5cbiAgY29uc3QgYWxsT3B0aW9ucyA9IE9iamVjdC5hc3NpZ24oe1xuICAgIGluZGVudDogJycsXG4gICAgY2Fub25pY2FsOiBmYWxzZSxcbiAgfSwgb3B0aW9ucyk7XG4gIGlmIChhbGxPcHRpb25zLmluZGVudCA9PT0gdHJ1ZSkge1xuICAgIGFsbE9wdGlvbnMuaW5kZW50ID0gJyAgJztcbiAgfSBlbHNlIGlmICh0eXBlb2YgYWxsT3B0aW9ucy5pbmRlbnQgPT09ICdudW1iZXInKSB7XG4gICAgbGV0IG5ld0luZGVudCA9ICcnO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYWxsT3B0aW9ucy5pbmRlbnQ7IGkrKykge1xuICAgICAgbmV3SW5kZW50ICs9ICcgJztcbiAgICB9XG4gICAgYWxsT3B0aW9ucy5pbmRlbnQgPSBuZXdJbmRlbnQ7XG4gIH1cbiAgcmV0dXJuIHN0cignJywgeycnOiB2YWx1ZX0sIGFsbE9wdGlvbnMuaW5kZW50LCAnJywgYWxsT3B0aW9ucy5jYW5vbmljYWwpO1xufTtcblxuZXhwb3J0IGRlZmF1bHQgY2Fub25pY2FsU3RyaW5naWZ5O1xuIl19
