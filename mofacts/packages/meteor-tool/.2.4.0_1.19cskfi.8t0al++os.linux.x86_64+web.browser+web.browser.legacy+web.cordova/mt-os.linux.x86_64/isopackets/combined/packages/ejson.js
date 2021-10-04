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

var require = meteorInstall({"node_modules":{"meteor":{"ejson":{"ejson.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                             //
// packages/ejson/ejson.js                                                                                     //
//                                                                                                             //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                               //
module.export({
  EJSON: () => EJSON
});
let isFunction, isObject, keysOf, lengthOf, hasOwn, convertMapToObject, isArguments, isInfOrNaN, handleError;
module.link("./utils", {
  isFunction(v) {
    isFunction = v;
  },

  isObject(v) {
    isObject = v;
  },

  keysOf(v) {
    keysOf = v;
  },

  lengthOf(v) {
    lengthOf = v;
  },

  hasOwn(v) {
    hasOwn = v;
  },

  convertMapToObject(v) {
    convertMapToObject = v;
  },

  isArguments(v) {
    isArguments = v;
  },

  isInfOrNaN(v) {
    isInfOrNaN = v;
  },

  handleError(v) {
    handleError = v;
  }

}, 0);

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

const customTypes = new Map(); // Add a custom type, using a method of your choice to get to and
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
  if (customTypes.has(name)) {
    throw new Error("Type ".concat(name, " already present"));
  }

  customTypes.set(name, factory);
};

const builtinConverters = [{
  // Date
  matchJSONValue(obj) {
    return hasOwn(obj, '$date') && lengthOf(obj) === 1;
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
    return hasOwn(obj, '$regexp') && hasOwn(obj, '$flags') && lengthOf(obj) === 2;
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
    return hasOwn(obj, '$InfNaN') && lengthOf(obj) === 1;
  },

  matchObject: isInfOrNaN,

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
    return hasOwn(obj, '$binary') && lengthOf(obj) === 1;
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
    return hasOwn(obj, '$escape') && lengthOf(obj) === 1;
  },

  matchObject(obj) {
    let match = false;

    if (obj) {
      const keyCount = lengthOf(obj);

      if (keyCount === 1 || keyCount === 2) {
        match = builtinConverters.some(converter => converter.matchJSONValue(obj));
      }
    }

    return match;
  },

  toJSONValue(obj) {
    const newObj = {};
    keysOf(obj).forEach(key => {
      newObj[key] = EJSON.toJSONValue(obj[key]);
    });
    return {
      $escape: newObj
    };
  },

  fromJSONValue(obj) {
    const newObj = {};
    keysOf(obj.$escape).forEach(key => {
      newObj[key] = EJSON.fromJSONValue(obj.$escape[key]);
    });
    return newObj;
  }

}, {
  // Custom
  matchJSONValue(obj) {
    return hasOwn(obj, '$type') && hasOwn(obj, '$value') && lengthOf(obj) === 2;
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

    if (!customTypes.has(typeName)) {
      throw new Error("Custom EJSON type ".concat(typeName, " is not defined"));
    }

    const converter = customTypes.get(typeName);
    return Meteor._noYieldsAllowed(() => converter(obj.$value));
  }

}];

EJSON._isCustomType = obj => obj && isFunction(obj.toJSONValue) && isFunction(obj.typeName) && customTypes.has(obj.typeName());

EJSON._getTypes = function () {
  let isOriginal = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;
  return isOriginal ? customTypes : convertMapToObject(customTypes);
};

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


  if (!isObject(obj)) {
    return obj;
  } // Iterate over array or object structure.


  keysOf(obj).forEach(key => {
    const value = obj[key];

    if (!isObject(value) && value !== undefined && !isInfOrNaN(value)) {
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

  if (isObject(item)) {
    newItem = EJSON.clone(item);
    adjustTypesToJSONValue(newItem);
  }

  return newItem;
}; // Either return the argument changed to have the non-json
// rep of itself (the Object version) or the argument itself.
// DOES NOT RECURSE.  For actually getting the fully-changed value, use
// EJSON.fromJSONValue


const fromJSONValueHelper = value => {
  if (isObject(value) && value !== null) {
    const keys = keysOf(value);

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


  if (!isObject(obj)) {
    return obj;
  }

  keysOf(obj).forEach(key => {
    const value = obj[key];

    if (isObject(value)) {
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

  if (changed === item && isObject(item)) {
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


EJSON.stringify = handleError((item, options) => {
  let serialized;
  const json = EJSON.toJSONValue(item);

  if (options && (options.canonical || options.indent)) {
    let canonicalStringify;
    module.link("./stringify", {
      default(v) {
        canonicalStringify = v;
      }

    }, 1);
    serialized = canonicalStringify(json, options);
  } else {
    serialized = JSON.stringify(json);
  }

  return serialized;
});
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

  if (!(isObject(a) && isObject(b))) {
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

  if (isFunction(a.equals)) {
    return a.equals(b, options);
  }

  if (isFunction(b.equals)) {
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
  const aKeys = keysOf(a);
  const bKeys = keysOf(b);

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

  if (!isObject(v)) {
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
    return v.map(EJSON.clone);
  }

  if (isArguments(v)) {
    return Array.from(v).map(EJSON.clone);
  } // handle general user-defined typed Objects if they have a clone method


  if (isFunction(v.clone)) {
    return v.clone();
  } // handle other custom types


  if (EJSON._isCustomType(v)) {
    return EJSON.fromJSONValue(EJSON.clone(EJSON.toJSONValue(v)), true);
  } // handle other objects


  ret = {};
  keysOf(v).forEach(key => {
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

},"stringify.js":function module(require,exports,module){

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

},"utils.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                             //
// packages/ejson/utils.js                                                                                     //
//                                                                                                             //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                               //
module.export({
  isFunction: () => isFunction,
  isObject: () => isObject,
  keysOf: () => keysOf,
  lengthOf: () => lengthOf,
  hasOwn: () => hasOwn,
  convertMapToObject: () => convertMapToObject,
  isArguments: () => isArguments,
  isInfOrNaN: () => isInfOrNaN,
  checkError: () => checkError,
  handleError: () => handleError
});

const isFunction = fn => typeof fn === 'function';

const isObject = fn => typeof fn === 'object';

const keysOf = obj => Object.keys(obj);

const lengthOf = obj => Object.keys(obj).length;

const hasOwn = (obj, prop) => Object.prototype.hasOwnProperty.call(obj, prop);

const convertMapToObject = map => Array.from(map).reduce((acc, _ref) => {
  let [key, value] = _ref;
  // reassign to not create new object
  acc[key] = value;
  return acc;
}, {});

const isArguments = obj => obj != null && hasOwn(obj, 'callee');

const isInfOrNaN = obj => Number.isNaN(obj) || obj === Infinity || obj === -Infinity;

const checkError = {
  maxStack: msgError => new RegExp('Maximum call stack size exceeded', 'g').test(msgError)
};

const handleError = fn => function () {
  try {
    return fn.apply(this, arguments);
  } catch (error) {
    const isMaxStack = checkError.maxStack(error.message);

    if (isMaxStack) {
      throw new Error('Converting circular structure to JSON');
    }

    throw error;
  }
};
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvZWpzb24vZWpzb24uanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL2Vqc29uL3N0cmluZ2lmeS5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvZWpzb24vdXRpbHMuanMiXSwibmFtZXMiOlsibW9kdWxlIiwiZXhwb3J0IiwiRUpTT04iLCJpc0Z1bmN0aW9uIiwiaXNPYmplY3QiLCJrZXlzT2YiLCJsZW5ndGhPZiIsImhhc093biIsImNvbnZlcnRNYXBUb09iamVjdCIsImlzQXJndW1lbnRzIiwiaXNJbmZPck5hTiIsImhhbmRsZUVycm9yIiwibGluayIsInYiLCJjdXN0b21UeXBlcyIsIk1hcCIsImFkZFR5cGUiLCJuYW1lIiwiZmFjdG9yeSIsImhhcyIsIkVycm9yIiwic2V0IiwiYnVpbHRpbkNvbnZlcnRlcnMiLCJtYXRjaEpTT05WYWx1ZSIsIm9iaiIsIm1hdGNoT2JqZWN0IiwiRGF0ZSIsInRvSlNPTlZhbHVlIiwiJGRhdGUiLCJnZXRUaW1lIiwiZnJvbUpTT05WYWx1ZSIsIlJlZ0V4cCIsInJlZ2V4cCIsIiRyZWdleHAiLCJzb3VyY2UiLCIkZmxhZ3MiLCJmbGFncyIsInNsaWNlIiwicmVwbGFjZSIsInNpZ24iLCJOdW1iZXIiLCJpc05hTiIsIkluZmluaXR5IiwiJEluZk5hTiIsIlVpbnQ4QXJyYXkiLCIkYmluYXJ5IiwiQmFzZTY0IiwiZW5jb2RlIiwiZGVjb2RlIiwibWF0Y2giLCJrZXlDb3VudCIsInNvbWUiLCJjb252ZXJ0ZXIiLCJuZXdPYmoiLCJmb3JFYWNoIiwia2V5IiwiJGVzY2FwZSIsIl9pc0N1c3RvbVR5cGUiLCJqc29uVmFsdWUiLCJNZXRlb3IiLCJfbm9ZaWVsZHNBbGxvd2VkIiwiJHR5cGUiLCJ0eXBlTmFtZSIsIiR2YWx1ZSIsImdldCIsIl9nZXRUeXBlcyIsImlzT3JpZ2luYWwiLCJfZ2V0Q29udmVydGVycyIsInRvSlNPTlZhbHVlSGVscGVyIiwiaXRlbSIsImkiLCJsZW5ndGgiLCJ1bmRlZmluZWQiLCJhZGp1c3RUeXBlc1RvSlNPTlZhbHVlIiwibWF5YmVDaGFuZ2VkIiwidmFsdWUiLCJjaGFuZ2VkIiwiX2FkanVzdFR5cGVzVG9KU09OVmFsdWUiLCJuZXdJdGVtIiwiY2xvbmUiLCJmcm9tSlNPTlZhbHVlSGVscGVyIiwia2V5cyIsImV2ZXJ5IiwiayIsInN1YnN0ciIsImFkanVzdFR5cGVzRnJvbUpTT05WYWx1ZSIsIl9hZGp1c3RUeXBlc0Zyb21KU09OVmFsdWUiLCJzdHJpbmdpZnkiLCJvcHRpb25zIiwic2VyaWFsaXplZCIsImpzb24iLCJjYW5vbmljYWwiLCJpbmRlbnQiLCJjYW5vbmljYWxTdHJpbmdpZnkiLCJkZWZhdWx0IiwiSlNPTiIsInBhcnNlIiwiaXNCaW5hcnkiLCIkVWludDhBcnJheVBvbHlmaWxsIiwiZXF1YWxzIiwiYSIsImIiLCJrZXlPcmRlclNlbnNpdGl2ZSIsInZhbHVlT2YiLCJBcnJheSIsInJldCIsImFLZXlzIiwiYktleXMiLCJuZXdCaW5hcnkiLCJpc0FycmF5IiwibWFwIiwiZnJvbSIsInF1b3RlIiwic3RyaW5nIiwic3RyIiwiaG9sZGVyIiwic2luZ2xlSW5kZW50Iiwib3V0ZXJJbmRlbnQiLCJpc0Zpbml0ZSIsIlN0cmluZyIsImlubmVySW5kZW50IiwicGFydGlhbCIsImhhc093blByb3BlcnR5IiwiY2FsbCIsImpvaW4iLCJPYmplY3QiLCJzb3J0IiwicHVzaCIsImFsbE9wdGlvbnMiLCJhc3NpZ24iLCJuZXdJbmRlbnQiLCJleHBvcnREZWZhdWx0IiwiY2hlY2tFcnJvciIsImZuIiwicHJvcCIsInByb3RvdHlwZSIsInJlZHVjZSIsImFjYyIsIm1heFN0YWNrIiwibXNnRXJyb3IiLCJ0ZXN0IiwiYXBwbHkiLCJhcmd1bWVudHMiLCJlcnJvciIsImlzTWF4U3RhY2siLCJtZXNzYWdlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUFBLE1BQU0sQ0FBQ0MsTUFBUCxDQUFjO0FBQUNDLE9BQUssRUFB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XG4gIGlzRnVuY3Rpb24sXG4gIGlzT2JqZWN0LFxuICBrZXlzT2YsXG4gIGxlbmd0aE9mLFxuICBoYXNPd24sXG4gIGNvbnZlcnRNYXBUb09iamVjdCxcbiAgaXNBcmd1bWVudHMsXG4gIGlzSW5mT3JOYU4sXG4gIGhhbmRsZUVycm9yLFxufSBmcm9tICcuL3V0aWxzJztcblxuLyoqXG4gKiBAbmFtZXNwYWNlXG4gKiBAc3VtbWFyeSBOYW1lc3BhY2UgZm9yIEVKU09OIGZ1bmN0aW9uc1xuICovXG5jb25zdCBFSlNPTiA9IHt9O1xuXG4vLyBDdXN0b20gdHlwZSBpbnRlcmZhY2UgZGVmaW5pdGlvblxuLyoqXG4gKiBAY2xhc3MgQ3VzdG9tVHlwZVxuICogQGluc3RhbmNlTmFtZSBjdXN0b21UeXBlXG4gKiBAbWVtYmVyT2YgRUpTT05cbiAqIEBzdW1tYXJ5IFRoZSBpbnRlcmZhY2UgdGhhdCBhIGNsYXNzIG11c3Qgc2F0aXNmeSB0byBiZSBhYmxlIHRvIGJlY29tZSBhblxuICogRUpTT04gY3VzdG9tIHR5cGUgdmlhIEVKU09OLmFkZFR5cGUuXG4gKi9cblxuLyoqXG4gKiBAZnVuY3Rpb24gdHlwZU5hbWVcbiAqIEBtZW1iZXJPZiBFSlNPTi5DdXN0b21UeXBlXG4gKiBAc3VtbWFyeSBSZXR1cm4gdGhlIHRhZyB1c2VkIHRvIGlkZW50aWZ5IHRoaXMgdHlwZS4gIFRoaXMgbXVzdCBtYXRjaCB0aGVcbiAqICAgICAgICAgIHRhZyB1c2VkIHRvIHJlZ2lzdGVyIHRoaXMgdHlwZSB3aXRoXG4gKiAgICAgICAgICBbYEVKU09OLmFkZFR5cGVgXSgjZWpzb25fYWRkX3R5cGUpLlxuICogQGxvY3VzIEFueXdoZXJlXG4gKiBAaW5zdGFuY2VcbiAqL1xuXG4vKipcbiAqIEBmdW5jdGlvbiB0b0pTT05WYWx1ZVxuICogQG1lbWJlck9mIEVKU09OLkN1c3RvbVR5cGVcbiAqIEBzdW1tYXJ5IFNlcmlhbGl6ZSB0aGlzIGluc3RhbmNlIGludG8gYSBKU09OLWNvbXBhdGlibGUgdmFsdWUuXG4gKiBAbG9jdXMgQW55d2hlcmVcbiAqIEBpbnN0YW5jZVxuICovXG5cbi8qKlxuICogQGZ1bmN0aW9uIGNsb25lXG4gKiBAbWVtYmVyT2YgRUpTT04uQ3VzdG9tVHlwZVxuICogQHN1bW1hcnkgUmV0dXJuIGEgdmFsdWUgYHJgIHN1Y2ggdGhhdCBgdGhpcy5lcXVhbHMocilgIGlzIHRydWUsIGFuZFxuICogICAgICAgICAgbW9kaWZpY2F0aW9ucyB0byBgcmAgZG8gbm90IGFmZmVjdCBgdGhpc2AgYW5kIHZpY2UgdmVyc2EuXG4gKiBAbG9jdXMgQW55d2hlcmVcbiAqIEBpbnN0YW5jZVxuICovXG5cbi8qKlxuICogQGZ1bmN0aW9uIGVxdWFsc1xuICogQG1lbWJlck9mIEVKU09OLkN1c3RvbVR5cGVcbiAqIEBzdW1tYXJ5IFJldHVybiBgdHJ1ZWAgaWYgYG90aGVyYCBoYXMgYSB2YWx1ZSBlcXVhbCB0byBgdGhpc2A7IGBmYWxzZWBcbiAqICAgICAgICAgIG90aGVyd2lzZS5cbiAqIEBsb2N1cyBBbnl3aGVyZVxuICogQHBhcmFtIHtPYmplY3R9IG90aGVyIEFub3RoZXIgb2JqZWN0IHRvIGNvbXBhcmUgdGhpcyB0by5cbiAqIEBpbnN0YW5jZVxuICovXG5cbmNvbnN0IGN1c3RvbVR5cGVzID0gbmV3IE1hcCgpO1xuXG4vLyBBZGQgYSBjdXN0b20gdHlwZSwgdXNpbmcgYSBtZXRob2Qgb2YgeW91ciBjaG9pY2UgdG8gZ2V0IHRvIGFuZFxuLy8gZnJvbSBhIGJhc2ljIEpTT04tYWJsZSByZXByZXNlbnRhdGlvbi4gIFRoZSBmYWN0b3J5IGFyZ3VtZW50XG4vLyBpcyBhIGZ1bmN0aW9uIG9mIEpTT04tYWJsZSAtLT4geW91ciBvYmplY3Rcbi8vIFRoZSB0eXBlIHlvdSBhZGQgbXVzdCBoYXZlOlxuLy8gLSBBIHRvSlNPTlZhbHVlKCkgbWV0aG9kLCBzbyB0aGF0IE1ldGVvciBjYW4gc2VyaWFsaXplIGl0XG4vLyAtIGEgdHlwZU5hbWUoKSBtZXRob2QsIHRvIHNob3cgaG93IHRvIGxvb2sgaXQgdXAgaW4gb3VyIHR5cGUgdGFibGUuXG4vLyBJdCBpcyBva2F5IGlmIHRoZXNlIG1ldGhvZHMgYXJlIG1vbmtleS1wYXRjaGVkIG9uLlxuLy8gRUpTT04uY2xvbmUgd2lsbCB1c2UgdG9KU09OVmFsdWUgYW5kIHRoZSBnaXZlbiBmYWN0b3J5IHRvIHByb2R1Y2Vcbi8vIGEgY2xvbmUsIGJ1dCB5b3UgbWF5IHNwZWNpZnkgYSBtZXRob2QgY2xvbmUoKSB0aGF0IHdpbGwgYmVcbi8vIHVzZWQgaW5zdGVhZC5cbi8vIFNpbWlsYXJseSwgRUpTT04uZXF1YWxzIHdpbGwgdXNlIHRvSlNPTlZhbHVlIHRvIG1ha2UgY29tcGFyaXNvbnMsXG4vLyBidXQgeW91IG1heSBwcm92aWRlIGEgbWV0aG9kIGVxdWFscygpIGluc3RlYWQuXG4vKipcbiAqIEBzdW1tYXJ5IEFkZCBhIGN1c3RvbSBkYXRhdHlwZSB0byBFSlNPTi5cbiAqIEBsb2N1cyBBbnl3aGVyZVxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgQSB0YWcgZm9yIHlvdXIgY3VzdG9tIHR5cGU7IG11c3QgYmUgdW5pcXVlIGFtb25nXG4gKiAgICAgICAgICAgICAgICAgICAgICBjdXN0b20gZGF0YSB0eXBlcyBkZWZpbmVkIGluIHlvdXIgcHJvamVjdCwgYW5kIG11c3RcbiAqICAgICAgICAgICAgICAgICAgICAgIG1hdGNoIHRoZSByZXN1bHQgb2YgeW91ciB0eXBlJ3MgYHR5cGVOYW1lYCBtZXRob2QuXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmYWN0b3J5IEEgZnVuY3Rpb24gdGhhdCBkZXNlcmlhbGl6ZXMgYSBKU09OLWNvbXBhdGlibGVcbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWUgaW50byBhbiBpbnN0YW5jZSBvZiB5b3VyIHR5cGUuICBUaGlzIHNob3VsZFxuICogICAgICAgICAgICAgICAgICAgICAgICAgICBtYXRjaCB0aGUgc2VyaWFsaXphdGlvbiBwZXJmb3JtZWQgYnkgeW91clxuICogICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlJ3MgYHRvSlNPTlZhbHVlYCBtZXRob2QuXG4gKi9cbkVKU09OLmFkZFR5cGUgPSAobmFtZSwgZmFjdG9yeSkgPT4ge1xuICBpZiAoY3VzdG9tVHlwZXMuaGFzKG5hbWUpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBUeXBlICR7bmFtZX0gYWxyZWFkeSBwcmVzZW50YCk7XG4gIH1cbiAgY3VzdG9tVHlwZXMuc2V0KG5hbWUsIGZhY3RvcnkpO1xufTtcblxuY29uc3QgYnVpbHRpbkNvbnZlcnRlcnMgPSBbXG4gIHsgLy8gRGF0ZVxuICAgIG1hdGNoSlNPTlZhbHVlKG9iaikge1xuICAgICAgcmV0dXJuIGhhc093bihvYmosICckZGF0ZScpICYmIGxlbmd0aE9mKG9iaikgPT09IDE7XG4gICAgfSxcbiAgICBtYXRjaE9iamVjdChvYmopIHtcbiAgICAgIHJldHVybiBvYmogaW5zdGFuY2VvZiBEYXRlO1xuICAgIH0sXG4gICAgdG9KU09OVmFsdWUob2JqKSB7XG4gICAgICByZXR1cm4geyRkYXRlOiBvYmouZ2V0VGltZSgpfTtcbiAgICB9LFxuICAgIGZyb21KU09OVmFsdWUob2JqKSB7XG4gICAgICByZXR1cm4gbmV3IERhdGUob2JqLiRkYXRlKTtcbiAgICB9LFxuICB9LFxuICB7IC8vIFJlZ0V4cFxuICAgIG1hdGNoSlNPTlZhbHVlKG9iaikge1xuICAgICAgcmV0dXJuIGhhc093bihvYmosICckcmVnZXhwJylcbiAgICAgICAgJiYgaGFzT3duKG9iaiwgJyRmbGFncycpXG4gICAgICAgICYmIGxlbmd0aE9mKG9iaikgPT09IDI7XG4gICAgfSxcbiAgICBtYXRjaE9iamVjdChvYmopIHtcbiAgICAgIHJldHVybiBvYmogaW5zdGFuY2VvZiBSZWdFeHA7XG4gICAgfSxcbiAgICB0b0pTT05WYWx1ZShyZWdleHApIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgICRyZWdleHA6IHJlZ2V4cC5zb3VyY2UsXG4gICAgICAgICRmbGFnczogcmVnZXhwLmZsYWdzXG4gICAgICB9O1xuICAgIH0sXG4gICAgZnJvbUpTT05WYWx1ZShvYmopIHtcbiAgICAgIC8vIFJlcGxhY2VzIGR1cGxpY2F0ZSAvIGludmFsaWQgZmxhZ3MuXG4gICAgICByZXR1cm4gbmV3IFJlZ0V4cChcbiAgICAgICAgb2JqLiRyZWdleHAsXG4gICAgICAgIG9iai4kZmxhZ3NcbiAgICAgICAgICAvLyBDdXQgb2ZmIGZsYWdzIGF0IDUwIGNoYXJzIHRvIGF2b2lkIGFidXNpbmcgUmVnRXhwIGZvciBET1MuXG4gICAgICAgICAgLnNsaWNlKDAsIDUwKVxuICAgICAgICAgIC5yZXBsYWNlKC9bXmdpbXV5XS9nLCcnKVxuICAgICAgICAgIC5yZXBsYWNlKC8oLikoPz0uKlxcMSkvZywgJycpXG4gICAgICApO1xuICAgIH0sXG4gIH0sXG4gIHsgLy8gTmFOLCBJbmYsIC1JbmYuIChUaGVzZSBhcmUgdGhlIG9ubHkgb2JqZWN0cyB3aXRoIHR5cGVvZiAhPT0gJ29iamVjdCdcbiAgICAvLyB3aGljaCB3ZSBtYXRjaC4pXG4gICAgbWF0Y2hKU09OVmFsdWUob2JqKSB7XG4gICAgICByZXR1cm4gaGFzT3duKG9iaiwgJyRJbmZOYU4nKSAmJiBsZW5ndGhPZihvYmopID09PSAxO1xuICAgIH0sXG4gICAgbWF0Y2hPYmplY3Q6IGlzSW5mT3JOYU4sXG4gICAgdG9KU09OVmFsdWUob2JqKSB7XG4gICAgICBsZXQgc2lnbjtcbiAgICAgIGlmIChOdW1iZXIuaXNOYU4ob2JqKSkge1xuICAgICAgICBzaWduID0gMDtcbiAgICAgIH0gZWxzZSBpZiAob2JqID09PSBJbmZpbml0eSkge1xuICAgICAgICBzaWduID0gMTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHNpZ24gPSAtMTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB7JEluZk5hTjogc2lnbn07XG4gICAgfSxcbiAgICBmcm9tSlNPTlZhbHVlKG9iaikge1xuICAgICAgcmV0dXJuIG9iai4kSW5mTmFOIC8gMDtcbiAgICB9LFxuICB9LFxuICB7IC8vIEJpbmFyeVxuICAgIG1hdGNoSlNPTlZhbHVlKG9iaikge1xuICAgICAgcmV0dXJuIGhhc093bihvYmosICckYmluYXJ5JykgJiYgbGVuZ3RoT2Yob2JqKSA9PT0gMTtcbiAgICB9LFxuICAgIG1hdGNoT2JqZWN0KG9iaikge1xuICAgICAgcmV0dXJuIHR5cGVvZiBVaW50OEFycmF5ICE9PSAndW5kZWZpbmVkJyAmJiBvYmogaW5zdGFuY2VvZiBVaW50OEFycmF5XG4gICAgICAgIHx8IChvYmogJiYgaGFzT3duKG9iaiwgJyRVaW50OEFycmF5UG9seWZpbGwnKSk7XG4gICAgfSxcbiAgICB0b0pTT05WYWx1ZShvYmopIHtcbiAgICAgIHJldHVybiB7JGJpbmFyeTogQmFzZTY0LmVuY29kZShvYmopfTtcbiAgICB9LFxuICAgIGZyb21KU09OVmFsdWUob2JqKSB7XG4gICAgICByZXR1cm4gQmFzZTY0LmRlY29kZShvYmouJGJpbmFyeSk7XG4gICAgfSxcbiAgfSxcbiAgeyAvLyBFc2NhcGluZyBvbmUgbGV2ZWxcbiAgICBtYXRjaEpTT05WYWx1ZShvYmopIHtcbiAgICAgIHJldHVybiBoYXNPd24ob2JqLCAnJGVzY2FwZScpICYmIGxlbmd0aE9mKG9iaikgPT09IDE7XG4gICAgfSxcbiAgICBtYXRjaE9iamVjdChvYmopIHtcbiAgICAgIGxldCBtYXRjaCA9IGZhbHNlO1xuICAgICAgaWYgKG9iaikge1xuICAgICAgICBjb25zdCBrZXlDb3VudCA9IGxlbmd0aE9mKG9iaik7XG4gICAgICAgIGlmIChrZXlDb3VudCA9PT0gMSB8fCBrZXlDb3VudCA9PT0gMikge1xuICAgICAgICAgIG1hdGNoID1cbiAgICAgICAgICAgIGJ1aWx0aW5Db252ZXJ0ZXJzLnNvbWUoY29udmVydGVyID0+IGNvbnZlcnRlci5tYXRjaEpTT05WYWx1ZShvYmopKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIG1hdGNoO1xuICAgIH0sXG4gICAgdG9KU09OVmFsdWUob2JqKSB7XG4gICAgICBjb25zdCBuZXdPYmogPSB7fTtcbiAgICAgIGtleXNPZihvYmopLmZvckVhY2goa2V5ID0+IHtcbiAgICAgICAgbmV3T2JqW2tleV0gPSBFSlNPTi50b0pTT05WYWx1ZShvYmpba2V5XSk7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiB7JGVzY2FwZTogbmV3T2JqfTtcbiAgICB9LFxuICAgIGZyb21KU09OVmFsdWUob2JqKSB7XG4gICAgICBjb25zdCBuZXdPYmogPSB7fTtcbiAgICAgIGtleXNPZihvYmouJGVzY2FwZSkuZm9yRWFjaChrZXkgPT4ge1xuICAgICAgICBuZXdPYmpba2V5XSA9IEVKU09OLmZyb21KU09OVmFsdWUob2JqLiRlc2NhcGVba2V5XSk7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiBuZXdPYmo7XG4gICAgfSxcbiAgfSxcbiAgeyAvLyBDdXN0b21cbiAgICBtYXRjaEpTT05WYWx1ZShvYmopIHtcbiAgICAgIHJldHVybiBoYXNPd24ob2JqLCAnJHR5cGUnKVxuICAgICAgICAmJiBoYXNPd24ob2JqLCAnJHZhbHVlJykgJiYgbGVuZ3RoT2Yob2JqKSA9PT0gMjtcbiAgICB9LFxuICAgIG1hdGNoT2JqZWN0KG9iaikge1xuICAgICAgcmV0dXJuIEVKU09OLl9pc0N1c3RvbVR5cGUob2JqKTtcbiAgICB9LFxuICAgIHRvSlNPTlZhbHVlKG9iaikge1xuICAgICAgY29uc3QganNvblZhbHVlID0gTWV0ZW9yLl9ub1lpZWxkc0FsbG93ZWQoKCkgPT4gb2JqLnRvSlNPTlZhbHVlKCkpO1xuICAgICAgcmV0dXJuIHskdHlwZTogb2JqLnR5cGVOYW1lKCksICR2YWx1ZToganNvblZhbHVlfTtcbiAgICB9LFxuICAgIGZyb21KU09OVmFsdWUob2JqKSB7XG4gICAgICBjb25zdCB0eXBlTmFtZSA9IG9iai4kdHlwZTtcbiAgICAgIGlmICghY3VzdG9tVHlwZXMuaGFzKHR5cGVOYW1lKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEN1c3RvbSBFSlNPTiB0eXBlICR7dHlwZU5hbWV9IGlzIG5vdCBkZWZpbmVkYCk7XG4gICAgICB9XG4gICAgICBjb25zdCBjb252ZXJ0ZXIgPSBjdXN0b21UeXBlcy5nZXQodHlwZU5hbWUpO1xuICAgICAgcmV0dXJuIE1ldGVvci5fbm9ZaWVsZHNBbGxvd2VkKCgpID0+IGNvbnZlcnRlcihvYmouJHZhbHVlKSk7XG4gICAgfSxcbiAgfSxcbl07XG5cbkVKU09OLl9pc0N1c3RvbVR5cGUgPSAob2JqKSA9PiAoXG4gIG9iaiAmJlxuICBpc0Z1bmN0aW9uKG9iai50b0pTT05WYWx1ZSkgJiZcbiAgaXNGdW5jdGlvbihvYmoudHlwZU5hbWUpICYmXG4gIGN1c3RvbVR5cGVzLmhhcyhvYmoudHlwZU5hbWUoKSlcbik7XG5cbkVKU09OLl9nZXRUeXBlcyA9IChpc09yaWdpbmFsID0gZmFsc2UpID0+IChpc09yaWdpbmFsID8gY3VzdG9tVHlwZXMgOiBjb252ZXJ0TWFwVG9PYmplY3QoY3VzdG9tVHlwZXMpKTtcblxuRUpTT04uX2dldENvbnZlcnRlcnMgPSAoKSA9PiBidWlsdGluQ29udmVydGVycztcblxuLy8gRWl0aGVyIHJldHVybiB0aGUgSlNPTi1jb21wYXRpYmxlIHZlcnNpb24gb2YgdGhlIGFyZ3VtZW50LCBvciB1bmRlZmluZWQgKGlmXG4vLyB0aGUgaXRlbSBpc24ndCBpdHNlbGYgcmVwbGFjZWFibGUsIGJ1dCBtYXliZSBzb21lIGZpZWxkcyBpbiBpdCBhcmUpXG5jb25zdCB0b0pTT05WYWx1ZUhlbHBlciA9IGl0ZW0gPT4ge1xuICBmb3IgKGxldCBpID0gMDsgaSA8IGJ1aWx0aW5Db252ZXJ0ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgY29udmVydGVyID0gYnVpbHRpbkNvbnZlcnRlcnNbaV07XG4gICAgaWYgKGNvbnZlcnRlci5tYXRjaE9iamVjdChpdGVtKSkge1xuICAgICAgcmV0dXJuIGNvbnZlcnRlci50b0pTT05WYWx1ZShpdGVtKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHVuZGVmaW5lZDtcbn07XG5cbi8vIGZvciBib3RoIGFycmF5cyBhbmQgb2JqZWN0cywgaW4tcGxhY2UgbW9kaWZpY2F0aW9uLlxuY29uc3QgYWRqdXN0VHlwZXNUb0pTT05WYWx1ZSA9IG9iaiA9PiB7XG4gIC8vIElzIGl0IGFuIGF0b20gdGhhdCB3ZSBuZWVkIHRvIGFkanVzdD9cbiAgaWYgKG9iaiA9PT0gbnVsbCkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgY29uc3QgbWF5YmVDaGFuZ2VkID0gdG9KU09OVmFsdWVIZWxwZXIob2JqKTtcbiAgaWYgKG1heWJlQ2hhbmdlZCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuIG1heWJlQ2hhbmdlZDtcbiAgfVxuXG4gIC8vIE90aGVyIGF0b21zIGFyZSB1bmNoYW5nZWQuXG4gIGlmICghaXNPYmplY3Qob2JqKSkge1xuICAgIHJldHVybiBvYmo7XG4gIH1cblxuICAvLyBJdGVyYXRlIG92ZXIgYXJyYXkgb3Igb2JqZWN0IHN0cnVjdHVyZS5cbiAga2V5c09mKG9iaikuZm9yRWFjaChrZXkgPT4ge1xuICAgIGNvbnN0IHZhbHVlID0gb2JqW2tleV07XG4gICAgaWYgKCFpc09iamVjdCh2YWx1ZSkgJiYgdmFsdWUgIT09IHVuZGVmaW5lZCAmJlxuICAgICAgICAhaXNJbmZPck5hTih2YWx1ZSkpIHtcbiAgICAgIHJldHVybjsgLy8gY29udGludWVcbiAgICB9XG5cbiAgICBjb25zdCBjaGFuZ2VkID0gdG9KU09OVmFsdWVIZWxwZXIodmFsdWUpO1xuICAgIGlmIChjaGFuZ2VkKSB7XG4gICAgICBvYmpba2V5XSA9IGNoYW5nZWQ7XG4gICAgICByZXR1cm47IC8vIG9uIHRvIHRoZSBuZXh0IGtleVxuICAgIH1cbiAgICAvLyBpZiB3ZSBnZXQgaGVyZSwgdmFsdWUgaXMgYW4gb2JqZWN0IGJ1dCBub3QgYWRqdXN0YWJsZVxuICAgIC8vIGF0IHRoaXMgbGV2ZWwuICByZWN1cnNlLlxuICAgIGFkanVzdFR5cGVzVG9KU09OVmFsdWUodmFsdWUpO1xuICB9KTtcbiAgcmV0dXJuIG9iajtcbn07XG5cbkVKU09OLl9hZGp1c3RUeXBlc1RvSlNPTlZhbHVlID0gYWRqdXN0VHlwZXNUb0pTT05WYWx1ZTtcblxuLyoqXG4gKiBAc3VtbWFyeSBTZXJpYWxpemUgYW4gRUpTT04tY29tcGF0aWJsZSB2YWx1ZSBpbnRvIGl0cyBwbGFpbiBKU09OXG4gKiAgICAgICAgICByZXByZXNlbnRhdGlvbi5cbiAqIEBsb2N1cyBBbnl3aGVyZVxuICogQHBhcmFtIHtFSlNPTn0gdmFsIEEgdmFsdWUgdG8gc2VyaWFsaXplIHRvIHBsYWluIEpTT04uXG4gKi9cbkVKU09OLnRvSlNPTlZhbHVlID0gaXRlbSA9PiB7XG4gIGNvbnN0IGNoYW5nZWQgPSB0b0pTT05WYWx1ZUhlbHBlcihpdGVtKTtcbiAgaWYgKGNoYW5nZWQgIT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiBjaGFuZ2VkO1xuICB9XG5cbiAgbGV0IG5ld0l0ZW0gPSBpdGVtO1xuICBpZiAoaXNPYmplY3QoaXRlbSkpIHtcbiAgICBuZXdJdGVtID0gRUpTT04uY2xvbmUoaXRlbSk7XG4gICAgYWRqdXN0VHlwZXNUb0pTT05WYWx1ZShuZXdJdGVtKTtcbiAgfVxuICByZXR1cm4gbmV3SXRlbTtcbn07XG5cbi8vIEVpdGhlciByZXR1cm4gdGhlIGFyZ3VtZW50IGNoYW5nZWQgdG8gaGF2ZSB0aGUgbm9uLWpzb25cbi8vIHJlcCBvZiBpdHNlbGYgKHRoZSBPYmplY3QgdmVyc2lvbikgb3IgdGhlIGFyZ3VtZW50IGl0c2VsZi5cbi8vIERPRVMgTk9UIFJFQ1VSU0UuICBGb3IgYWN0dWFsbHkgZ2V0dGluZyB0aGUgZnVsbHktY2hhbmdlZCB2YWx1ZSwgdXNlXG4vLyBFSlNPTi5mcm9tSlNPTlZhbHVlXG5jb25zdCBmcm9tSlNPTlZhbHVlSGVscGVyID0gdmFsdWUgPT4ge1xuICBpZiAoaXNPYmplY3QodmFsdWUpICYmIHZhbHVlICE9PSBudWxsKSB7XG4gICAgY29uc3Qga2V5cyA9IGtleXNPZih2YWx1ZSk7XG4gICAgaWYgKGtleXMubGVuZ3RoIDw9IDJcbiAgICAgICAgJiYga2V5cy5ldmVyeShrID0+IHR5cGVvZiBrID09PSAnc3RyaW5nJyAmJiBrLnN1YnN0cigwLCAxKSA9PT0gJyQnKSkge1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBidWlsdGluQ29udmVydGVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBjb252ZXJ0ZXIgPSBidWlsdGluQ29udmVydGVyc1tpXTtcbiAgICAgICAgaWYgKGNvbnZlcnRlci5tYXRjaEpTT05WYWx1ZSh2YWx1ZSkpIHtcbiAgICAgICAgICByZXR1cm4gY29udmVydGVyLmZyb21KU09OVmFsdWUodmFsdWUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHJldHVybiB2YWx1ZTtcbn07XG5cbi8vIGZvciBib3RoIGFycmF5cyBhbmQgb2JqZWN0cy4gVHJpZXMgaXRzIGJlc3QgdG8ganVzdFxuLy8gdXNlIHRoZSBvYmplY3QgeW91IGhhbmQgaXQsIGJ1dCBtYXkgcmV0dXJuIHNvbWV0aGluZ1xuLy8gZGlmZmVyZW50IGlmIHRoZSBvYmplY3QgeW91IGhhbmQgaXQgaXRzZWxmIG5lZWRzIGNoYW5naW5nLlxuY29uc3QgYWRqdXN0VHlwZXNGcm9tSlNPTlZhbHVlID0gb2JqID0+IHtcbiAgaWYgKG9iaiA9PT0gbnVsbCkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgY29uc3QgbWF5YmVDaGFuZ2VkID0gZnJvbUpTT05WYWx1ZUhlbHBlcihvYmopO1xuICBpZiAobWF5YmVDaGFuZ2VkICE9PSBvYmopIHtcbiAgICByZXR1cm4gbWF5YmVDaGFuZ2VkO1xuICB9XG5cbiAgLy8gT3RoZXIgYXRvbXMgYXJlIHVuY2hhbmdlZC5cbiAgaWYgKCFpc09iamVjdChvYmopKSB7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuXG4gIGtleXNPZihvYmopLmZvckVhY2goa2V5ID0+IHtcbiAgICBjb25zdCB2YWx1ZSA9IG9ialtrZXldO1xuICAgIGlmIChpc09iamVjdCh2YWx1ZSkpIHtcbiAgICAgIGNvbnN0IGNoYW5nZWQgPSBmcm9tSlNPTlZhbHVlSGVscGVyKHZhbHVlKTtcbiAgICAgIGlmICh2YWx1ZSAhPT0gY2hhbmdlZCkge1xuICAgICAgICBvYmpba2V5XSA9IGNoYW5nZWQ7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIC8vIGlmIHdlIGdldCBoZXJlLCB2YWx1ZSBpcyBhbiBvYmplY3QgYnV0IG5vdCBhZGp1c3RhYmxlXG4gICAgICAvLyBhdCB0aGlzIGxldmVsLiAgcmVjdXJzZS5cbiAgICAgIGFkanVzdFR5cGVzRnJvbUpTT05WYWx1ZSh2YWx1ZSk7XG4gICAgfVxuICB9KTtcbiAgcmV0dXJuIG9iajtcbn07XG5cbkVKU09OLl9hZGp1c3RUeXBlc0Zyb21KU09OVmFsdWUgPSBhZGp1c3RUeXBlc0Zyb21KU09OVmFsdWU7XG5cbi8qKlxuICogQHN1bW1hcnkgRGVzZXJpYWxpemUgYW4gRUpTT04gdmFsdWUgZnJvbSBpdHMgcGxhaW4gSlNPTiByZXByZXNlbnRhdGlvbi5cbiAqIEBsb2N1cyBBbnl3aGVyZVxuICogQHBhcmFtIHtKU09OQ29tcGF0aWJsZX0gdmFsIEEgdmFsdWUgdG8gZGVzZXJpYWxpemUgaW50byBFSlNPTi5cbiAqL1xuRUpTT04uZnJvbUpTT05WYWx1ZSA9IGl0ZW0gPT4ge1xuICBsZXQgY2hhbmdlZCA9IGZyb21KU09OVmFsdWVIZWxwZXIoaXRlbSk7XG4gIGlmIChjaGFuZ2VkID09PSBpdGVtICYmIGlzT2JqZWN0KGl0ZW0pKSB7XG4gICAgY2hhbmdlZCA9IEVKU09OLmNsb25lKGl0ZW0pO1xuICAgIGFkanVzdFR5cGVzRnJvbUpTT05WYWx1ZShjaGFuZ2VkKTtcbiAgfVxuICByZXR1cm4gY2hhbmdlZDtcbn07XG5cbi8qKlxuICogQHN1bW1hcnkgU2VyaWFsaXplIGEgdmFsdWUgdG8gYSBzdHJpbmcuIEZvciBFSlNPTiB2YWx1ZXMsIHRoZSBzZXJpYWxpemF0aW9uXG4gKiAgICAgICAgICBmdWxseSByZXByZXNlbnRzIHRoZSB2YWx1ZS4gRm9yIG5vbi1FSlNPTiB2YWx1ZXMsIHNlcmlhbGl6ZXMgdGhlXG4gKiAgICAgICAgICBzYW1lIHdheSBhcyBgSlNPTi5zdHJpbmdpZnlgLlxuICogQGxvY3VzIEFueXdoZXJlXG4gKiBAcGFyYW0ge0VKU09OfSB2YWwgQSB2YWx1ZSB0byBzdHJpbmdpZnkuXG4gKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdXG4gKiBAcGFyYW0ge0Jvb2xlYW4gfCBJbnRlZ2VyIHwgU3RyaW5nfSBvcHRpb25zLmluZGVudCBJbmRlbnRzIG9iamVjdHMgYW5kXG4gKiBhcnJheXMgZm9yIGVhc3kgcmVhZGFiaWxpdHkuICBXaGVuIGB0cnVlYCwgaW5kZW50cyBieSAyIHNwYWNlczsgd2hlbiBhblxuICogaW50ZWdlciwgaW5kZW50cyBieSB0aGF0IG51bWJlciBvZiBzcGFjZXM7IGFuZCB3aGVuIGEgc3RyaW5nLCB1c2VzIHRoZVxuICogc3RyaW5nIGFzIHRoZSBpbmRlbnRhdGlvbiBwYXR0ZXJuLlxuICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLmNhbm9uaWNhbCBXaGVuIGB0cnVlYCwgc3RyaW5naWZpZXMga2V5cyBpbiBhblxuICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvYmplY3QgaW4gc29ydGVkIG9yZGVyLlxuICovXG5FSlNPTi5zdHJpbmdpZnkgPSBoYW5kbGVFcnJvcigoaXRlbSwgb3B0aW9ucykgPT4ge1xuICBsZXQgc2VyaWFsaXplZDtcbiAgY29uc3QganNvbiA9IEVKU09OLnRvSlNPTlZhbHVlKGl0ZW0pO1xuICBpZiAob3B0aW9ucyAmJiAob3B0aW9ucy5jYW5vbmljYWwgfHwgb3B0aW9ucy5pbmRlbnQpKSB7XG4gICAgaW1wb3J0IGNhbm9uaWNhbFN0cmluZ2lmeSBmcm9tICcuL3N0cmluZ2lmeSc7XG4gICAgc2VyaWFsaXplZCA9IGNhbm9uaWNhbFN0cmluZ2lmeShqc29uLCBvcHRpb25zKTtcbiAgfSBlbHNlIHtcbiAgICBzZXJpYWxpemVkID0gSlNPTi5zdHJpbmdpZnkoanNvbik7XG4gIH1cbiAgcmV0dXJuIHNlcmlhbGl6ZWQ7XG59KTtcblxuLyoqXG4gKiBAc3VtbWFyeSBQYXJzZSBhIHN0cmluZyBpbnRvIGFuIEVKU09OIHZhbHVlLiBUaHJvd3MgYW4gZXJyb3IgaWYgdGhlIHN0cmluZ1xuICogICAgICAgICAgaXMgbm90IHZhbGlkIEVKU09OLlxuICogQGxvY3VzIEFueXdoZXJlXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyIEEgc3RyaW5nIHRvIHBhcnNlIGludG8gYW4gRUpTT04gdmFsdWUuXG4gKi9cbkVKU09OLnBhcnNlID0gaXRlbSA9PiB7XG4gIGlmICh0eXBlb2YgaXRlbSAhPT0gJ3N0cmluZycpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0VKU09OLnBhcnNlIGFyZ3VtZW50IHNob3VsZCBiZSBhIHN0cmluZycpO1xuICB9XG4gIHJldHVybiBFSlNPTi5mcm9tSlNPTlZhbHVlKEpTT04ucGFyc2UoaXRlbSkpO1xufTtcblxuLyoqXG4gKiBAc3VtbWFyeSBSZXR1cm5zIHRydWUgaWYgYHhgIGlzIGEgYnVmZmVyIG9mIGJpbmFyeSBkYXRhLCBhcyByZXR1cm5lZCBmcm9tXG4gKiAgICAgICAgICBbYEVKU09OLm5ld0JpbmFyeWBdKCNlanNvbl9uZXdfYmluYXJ5KS5cbiAqIEBwYXJhbSB7T2JqZWN0fSB4IFRoZSB2YXJpYWJsZSB0byBjaGVjay5cbiAqIEBsb2N1cyBBbnl3aGVyZVxuICovXG5FSlNPTi5pc0JpbmFyeSA9IG9iaiA9PiB7XG4gIHJldHVybiAhISgodHlwZW9mIFVpbnQ4QXJyYXkgIT09ICd1bmRlZmluZWQnICYmIG9iaiBpbnN0YW5jZW9mIFVpbnQ4QXJyYXkpIHx8XG4gICAgKG9iaiAmJiBvYmouJFVpbnQ4QXJyYXlQb2x5ZmlsbCkpO1xufTtcblxuLyoqXG4gKiBAc3VtbWFyeSBSZXR1cm4gdHJ1ZSBpZiBgYWAgYW5kIGBiYCBhcmUgZXF1YWwgdG8gZWFjaCBvdGhlci4gIFJldHVybiBmYWxzZVxuICogICAgICAgICAgb3RoZXJ3aXNlLiAgVXNlcyB0aGUgYGVxdWFsc2AgbWV0aG9kIG9uIGBhYCBpZiBwcmVzZW50LCBvdGhlcndpc2VcbiAqICAgICAgICAgIHBlcmZvcm1zIGEgZGVlcCBjb21wYXJpc29uLlxuICogQGxvY3VzIEFueXdoZXJlXG4gKiBAcGFyYW0ge0VKU09OfSBhXG4gKiBAcGFyYW0ge0VKU09OfSBiXG4gKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdXG4gKiBAcGFyYW0ge0Jvb2xlYW59IG9wdGlvbnMua2V5T3JkZXJTZW5zaXRpdmUgQ29tcGFyZSBpbiBrZXkgc2Vuc2l0aXZlIG9yZGVyLFxuICogaWYgc3VwcG9ydGVkIGJ5IHRoZSBKYXZhU2NyaXB0IGltcGxlbWVudGF0aW9uLiAgRm9yIGV4YW1wbGUsIGB7YTogMSwgYjogMn1gXG4gKiBpcyBlcXVhbCB0byBge2I6IDIsIGE6IDF9YCBvbmx5IHdoZW4gYGtleU9yZGVyU2Vuc2l0aXZlYCBpcyBgZmFsc2VgLiAgVGhlXG4gKiBkZWZhdWx0IGlzIGBmYWxzZWAuXG4gKi9cbkVKU09OLmVxdWFscyA9IChhLCBiLCBvcHRpb25zKSA9PiB7XG4gIGxldCBpO1xuICBjb25zdCBrZXlPcmRlclNlbnNpdGl2ZSA9ICEhKG9wdGlvbnMgJiYgb3B0aW9ucy5rZXlPcmRlclNlbnNpdGl2ZSk7XG4gIGlmIChhID09PSBiKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICAvLyBUaGlzIGRpZmZlcnMgZnJvbSB0aGUgSUVFRSBzcGVjIGZvciBOYU4gZXF1YWxpdHksIGIvYyB3ZSBkb24ndCB3YW50XG4gIC8vIGFueXRoaW5nIGV2ZXIgd2l0aCBhIE5hTiB0byBiZSBwb2lzb25lZCBmcm9tIGJlY29taW5nIGVxdWFsIHRvIGFueXRoaW5nLlxuICBpZiAoTnVtYmVyLmlzTmFOKGEpICYmIE51bWJlci5pc05hTihiKSkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLy8gaWYgZWl0aGVyIG9uZSBpcyBmYWxzeSwgdGhleSdkIGhhdmUgdG8gYmUgPT09IHRvIGJlIGVxdWFsXG4gIGlmICghYSB8fCAhYikge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGlmICghKGlzT2JqZWN0KGEpICYmIGlzT2JqZWN0KGIpKSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGlmIChhIGluc3RhbmNlb2YgRGF0ZSAmJiBiIGluc3RhbmNlb2YgRGF0ZSkge1xuICAgIHJldHVybiBhLnZhbHVlT2YoKSA9PT0gYi52YWx1ZU9mKCk7XG4gIH1cblxuICBpZiAoRUpTT04uaXNCaW5hcnkoYSkgJiYgRUpTT04uaXNCaW5hcnkoYikpIHtcbiAgICBpZiAoYS5sZW5ndGggIT09IGIubGVuZ3RoKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGZvciAoaSA9IDA7IGkgPCBhLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoYVtpXSAhPT0gYltpXSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgaWYgKGlzRnVuY3Rpb24oYS5lcXVhbHMpKSB7XG4gICAgcmV0dXJuIGEuZXF1YWxzKGIsIG9wdGlvbnMpO1xuICB9XG5cbiAgaWYgKGlzRnVuY3Rpb24oYi5lcXVhbHMpKSB7XG4gICAgcmV0dXJuIGIuZXF1YWxzKGEsIG9wdGlvbnMpO1xuICB9XG5cbiAgaWYgKGEgaW5zdGFuY2VvZiBBcnJheSkge1xuICAgIGlmICghKGIgaW5zdGFuY2VvZiBBcnJheSkpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgaWYgKGEubGVuZ3RoICE9PSBiLmxlbmd0aCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBmb3IgKGkgPSAwOyBpIDwgYS5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKCFFSlNPTi5lcXVhbHMoYVtpXSwgYltpXSwgb3B0aW9ucykpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIC8vIGZhbGxiYWNrIGZvciBjdXN0b20gdHlwZXMgdGhhdCBkb24ndCBpbXBsZW1lbnQgdGhlaXIgb3duIGVxdWFsc1xuICBzd2l0Y2ggKEVKU09OLl9pc0N1c3RvbVR5cGUoYSkgKyBFSlNPTi5faXNDdXN0b21UeXBlKGIpKSB7XG4gICAgY2FzZSAxOiByZXR1cm4gZmFsc2U7XG4gICAgY2FzZSAyOiByZXR1cm4gRUpTT04uZXF1YWxzKEVKU09OLnRvSlNPTlZhbHVlKGEpLCBFSlNPTi50b0pTT05WYWx1ZShiKSk7XG4gICAgZGVmYXVsdDogLy8gRG8gbm90aGluZ1xuICB9XG5cbiAgLy8gZmFsbCBiYWNrIHRvIHN0cnVjdHVyYWwgZXF1YWxpdHkgb2Ygb2JqZWN0c1xuICBsZXQgcmV0O1xuICBjb25zdCBhS2V5cyA9IGtleXNPZihhKTtcbiAgY29uc3QgYktleXMgPSBrZXlzT2YoYik7XG4gIGlmIChrZXlPcmRlclNlbnNpdGl2ZSkge1xuICAgIGkgPSAwO1xuICAgIHJldCA9IGFLZXlzLmV2ZXJ5KGtleSA9PiB7XG4gICAgICBpZiAoaSA+PSBiS2V5cy5sZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgaWYgKGtleSAhPT0gYktleXNbaV0pIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgaWYgKCFFSlNPTi5lcXVhbHMoYVtrZXldLCBiW2JLZXlzW2ldXSwgb3B0aW9ucykpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgaSsrO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSk7XG4gIH0gZWxzZSB7XG4gICAgaSA9IDA7XG4gICAgcmV0ID0gYUtleXMuZXZlcnkoa2V5ID0+IHtcbiAgICAgIGlmICghaGFzT3duKGIsIGtleSkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgaWYgKCFFSlNPTi5lcXVhbHMoYVtrZXldLCBiW2tleV0sIG9wdGlvbnMpKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICAgIGkrKztcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0pO1xuICB9XG4gIHJldHVybiByZXQgJiYgaSA9PT0gYktleXMubGVuZ3RoO1xufTtcblxuLyoqXG4gKiBAc3VtbWFyeSBSZXR1cm4gYSBkZWVwIGNvcHkgb2YgYHZhbGAuXG4gKiBAbG9jdXMgQW55d2hlcmVcbiAqIEBwYXJhbSB7RUpTT059IHZhbCBBIHZhbHVlIHRvIGNvcHkuXG4gKi9cbkVKU09OLmNsb25lID0gdiA9PiB7XG4gIGxldCByZXQ7XG4gIGlmICghaXNPYmplY3QodikpIHtcbiAgICByZXR1cm4gdjtcbiAgfVxuXG4gIGlmICh2ID09PSBudWxsKSB7XG4gICAgcmV0dXJuIG51bGw7IC8vIG51bGwgaGFzIHR5cGVvZiBcIm9iamVjdFwiXG4gIH1cblxuICBpZiAodiBpbnN0YW5jZW9mIERhdGUpIHtcbiAgICByZXR1cm4gbmV3IERhdGUodi5nZXRUaW1lKCkpO1xuICB9XG5cbiAgLy8gUmVnRXhwcyBhcmUgbm90IHJlYWxseSBFSlNPTiBlbGVtZW50cyAoZWcgd2UgZG9uJ3QgZGVmaW5lIGEgc2VyaWFsaXphdGlvblxuICAvLyBmb3IgdGhlbSksIGJ1dCB0aGV5J3JlIGltbXV0YWJsZSBhbnl3YXksIHNvIHdlIGNhbiBzdXBwb3J0IHRoZW0gaW4gY2xvbmUuXG4gIGlmICh2IGluc3RhbmNlb2YgUmVnRXhwKSB7XG4gICAgcmV0dXJuIHY7XG4gIH1cblxuICBpZiAoRUpTT04uaXNCaW5hcnkodikpIHtcbiAgICByZXQgPSBFSlNPTi5uZXdCaW5hcnkodi5sZW5ndGgpO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdi5sZW5ndGg7IGkrKykge1xuICAgICAgcmV0W2ldID0gdltpXTtcbiAgICB9XG4gICAgcmV0dXJuIHJldDtcbiAgfVxuXG4gIGlmIChBcnJheS5pc0FycmF5KHYpKSB7XG4gICAgcmV0dXJuIHYubWFwKEVKU09OLmNsb25lKTtcbiAgfVxuXG4gIGlmIChpc0FyZ3VtZW50cyh2KSkge1xuICAgIHJldHVybiBBcnJheS5mcm9tKHYpLm1hcChFSlNPTi5jbG9uZSk7XG4gIH1cblxuICAvLyBoYW5kbGUgZ2VuZXJhbCB1c2VyLWRlZmluZWQgdHlwZWQgT2JqZWN0cyBpZiB0aGV5IGhhdmUgYSBjbG9uZSBtZXRob2RcbiAgaWYgKGlzRnVuY3Rpb24odi5jbG9uZSkpIHtcbiAgICByZXR1cm4gdi5jbG9uZSgpO1xuICB9XG5cbiAgLy8gaGFuZGxlIG90aGVyIGN1c3RvbSB0eXBlc1xuICBpZiAoRUpTT04uX2lzQ3VzdG9tVHlwZSh2KSkge1xuICAgIHJldHVybiBFSlNPTi5mcm9tSlNPTlZhbHVlKEVKU09OLmNsb25lKEVKU09OLnRvSlNPTlZhbHVlKHYpKSwgdHJ1ZSk7XG4gIH1cblxuICAvLyBoYW5kbGUgb3RoZXIgb2JqZWN0c1xuICByZXQgPSB7fTtcbiAga2V5c09mKHYpLmZvckVhY2goKGtleSkgPT4ge1xuICAgIHJldFtrZXldID0gRUpTT04uY2xvbmUodltrZXldKTtcbiAgfSk7XG4gIHJldHVybiByZXQ7XG59O1xuXG4vKipcbiAqIEBzdW1tYXJ5IEFsbG9jYXRlIGEgbmV3IGJ1ZmZlciBvZiBiaW5hcnkgZGF0YSB0aGF0IEVKU09OIGNhbiBzZXJpYWxpemUuXG4gKiBAbG9jdXMgQW55d2hlcmVcbiAqIEBwYXJhbSB7TnVtYmVyfSBzaXplIFRoZSBudW1iZXIgb2YgYnl0ZXMgb2YgYmluYXJ5IGRhdGEgdG8gYWxsb2NhdGUuXG4gKi9cbi8vIEVKU09OLm5ld0JpbmFyeSBpcyB0aGUgcHVibGljIGRvY3VtZW50ZWQgQVBJIGZvciB0aGlzIGZ1bmN0aW9uYWxpdHksXG4vLyBidXQgdGhlIGltcGxlbWVudGF0aW9uIGlzIGluIHRoZSAnYmFzZTY0JyBwYWNrYWdlIHRvIGF2b2lkXG4vLyBpbnRyb2R1Y2luZyBhIGNpcmN1bGFyIGRlcGVuZGVuY3kuIChJZiB0aGUgaW1wbGVtZW50YXRpb24gd2VyZSBoZXJlLFxuLy8gdGhlbiAnYmFzZTY0JyB3b3VsZCBoYXZlIHRvIHVzZSBFSlNPTi5uZXdCaW5hcnksIGFuZCAnZWpzb24nIHdvdWxkXG4vLyBhbHNvIGhhdmUgdG8gdXNlICdiYXNlNjQnLilcbkVKU09OLm5ld0JpbmFyeSA9IEJhc2U2NC5uZXdCaW5hcnk7XG5cbmV4cG9ydCB7IEVKU09OIH07XG4iLCIvLyBCYXNlZCBvbiBqc29uMi5qcyBmcm9tIGh0dHBzOi8vZ2l0aHViLmNvbS9kb3VnbGFzY3JvY2tmb3JkL0pTT04tanNcbi8vXG4vLyAgICBqc29uMi5qc1xuLy8gICAgMjAxMi0xMC0wOFxuLy9cbi8vICAgIFB1YmxpYyBEb21haW4uXG4vL1xuLy8gICAgTk8gV0FSUkFOVFkgRVhQUkVTU0VEIE9SIElNUExJRUQuIFVTRSBBVCBZT1VSIE9XTiBSSVNLLlxuXG5mdW5jdGlvbiBxdW90ZShzdHJpbmcpIHtcbiAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHN0cmluZyk7XG59XG5cbmNvbnN0IHN0ciA9IChrZXksIGhvbGRlciwgc2luZ2xlSW5kZW50LCBvdXRlckluZGVudCwgY2Fub25pY2FsKSA9PiB7XG4gIGNvbnN0IHZhbHVlID0gaG9sZGVyW2tleV07XG5cbiAgLy8gV2hhdCBoYXBwZW5zIG5leHQgZGVwZW5kcyBvbiB0aGUgdmFsdWUncyB0eXBlLlxuICBzd2l0Y2ggKHR5cGVvZiB2YWx1ZSkge1xuICBjYXNlICdzdHJpbmcnOlxuICAgIHJldHVybiBxdW90ZSh2YWx1ZSk7XG4gIGNhc2UgJ251bWJlcic6XG4gICAgLy8gSlNPTiBudW1iZXJzIG11c3QgYmUgZmluaXRlLiBFbmNvZGUgbm9uLWZpbml0ZSBudW1iZXJzIGFzIG51bGwuXG4gICAgcmV0dXJuIGlzRmluaXRlKHZhbHVlKSA/IFN0cmluZyh2YWx1ZSkgOiAnbnVsbCc7XG4gIGNhc2UgJ2Jvb2xlYW4nOlxuICAgIHJldHVybiBTdHJpbmcodmFsdWUpO1xuICAvLyBJZiB0aGUgdHlwZSBpcyAnb2JqZWN0Jywgd2UgbWlnaHQgYmUgZGVhbGluZyB3aXRoIGFuIG9iamVjdCBvciBhbiBhcnJheSBvclxuICAvLyBudWxsLlxuICBjYXNlICdvYmplY3QnOiB7XG4gICAgLy8gRHVlIHRvIGEgc3BlY2lmaWNhdGlvbiBibHVuZGVyIGluIEVDTUFTY3JpcHQsIHR5cGVvZiBudWxsIGlzICdvYmplY3QnLFxuICAgIC8vIHNvIHdhdGNoIG91dCBmb3IgdGhhdCBjYXNlLlxuICAgIGlmICghdmFsdWUpIHtcbiAgICAgIHJldHVybiAnbnVsbCc7XG4gICAgfVxuICAgIC8vIE1ha2UgYW4gYXJyYXkgdG8gaG9sZCB0aGUgcGFydGlhbCByZXN1bHRzIG9mIHN0cmluZ2lmeWluZyB0aGlzIG9iamVjdFxuICAgIC8vIHZhbHVlLlxuICAgIGNvbnN0IGlubmVySW5kZW50ID0gb3V0ZXJJbmRlbnQgKyBzaW5nbGVJbmRlbnQ7XG4gICAgY29uc3QgcGFydGlhbCA9IFtdO1xuICAgIGxldCB2O1xuXG4gICAgLy8gSXMgdGhlIHZhbHVlIGFuIGFycmF5P1xuICAgIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSB8fCAoe30pLmhhc093blByb3BlcnR5LmNhbGwodmFsdWUsICdjYWxsZWUnKSkge1xuICAgICAgLy8gVGhlIHZhbHVlIGlzIGFuIGFycmF5LiBTdHJpbmdpZnkgZXZlcnkgZWxlbWVudC4gVXNlIG51bGwgYXMgYVxuICAgICAgLy8gcGxhY2Vob2xkZXIgZm9yIG5vbi1KU09OIHZhbHVlcy5cbiAgICAgIGNvbnN0IGxlbmd0aCA9IHZhbHVlLmxlbmd0aDtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuZ3RoOyBpICs9IDEpIHtcbiAgICAgICAgcGFydGlhbFtpXSA9XG4gICAgICAgICAgc3RyKGksIHZhbHVlLCBzaW5nbGVJbmRlbnQsIGlubmVySW5kZW50LCBjYW5vbmljYWwpIHx8ICdudWxsJztcbiAgICAgIH1cblxuICAgICAgLy8gSm9pbiBhbGwgb2YgdGhlIGVsZW1lbnRzIHRvZ2V0aGVyLCBzZXBhcmF0ZWQgd2l0aCBjb21tYXMsIGFuZCB3cmFwXG4gICAgICAvLyB0aGVtIGluIGJyYWNrZXRzLlxuICAgICAgaWYgKHBhcnRpYWwubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHYgPSAnW10nO1xuICAgICAgfSBlbHNlIGlmIChpbm5lckluZGVudCkge1xuICAgICAgICB2ID0gJ1tcXG4nICtcbiAgICAgICAgICBpbm5lckluZGVudCArXG4gICAgICAgICAgcGFydGlhbC5qb2luKCcsXFxuJyArXG4gICAgICAgICAgaW5uZXJJbmRlbnQpICtcbiAgICAgICAgICAnXFxuJyArXG4gICAgICAgICAgb3V0ZXJJbmRlbnQgK1xuICAgICAgICAgICddJztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHYgPSAnWycgKyBwYXJ0aWFsLmpvaW4oJywnKSArICddJztcbiAgICAgIH1cbiAgICAgIHJldHVybiB2O1xuICAgIH1cblxuICAgIC8vIEl0ZXJhdGUgdGhyb3VnaCBhbGwgb2YgdGhlIGtleXMgaW4gdGhlIG9iamVjdC5cbiAgICBsZXQga2V5cyA9IE9iamVjdC5rZXlzKHZhbHVlKTtcbiAgICBpZiAoY2Fub25pY2FsKSB7XG4gICAgICBrZXlzID0ga2V5cy5zb3J0KCk7XG4gICAgfVxuICAgIGtleXMuZm9yRWFjaChrID0+IHtcbiAgICAgIHYgPSBzdHIoaywgdmFsdWUsIHNpbmdsZUluZGVudCwgaW5uZXJJbmRlbnQsIGNhbm9uaWNhbCk7XG4gICAgICBpZiAodikge1xuICAgICAgICBwYXJ0aWFsLnB1c2gocXVvdGUoaykgKyAoaW5uZXJJbmRlbnQgPyAnOiAnIDogJzonKSArIHYpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gSm9pbiBhbGwgb2YgdGhlIG1lbWJlciB0ZXh0cyB0b2dldGhlciwgc2VwYXJhdGVkIHdpdGggY29tbWFzLFxuICAgIC8vIGFuZCB3cmFwIHRoZW0gaW4gYnJhY2VzLlxuICAgIGlmIChwYXJ0aWFsLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdiA9ICd7fSc7XG4gICAgfSBlbHNlIGlmIChpbm5lckluZGVudCkge1xuICAgICAgdiA9ICd7XFxuJyArXG4gICAgICAgIGlubmVySW5kZW50ICtcbiAgICAgICAgcGFydGlhbC5qb2luKCcsXFxuJyArXG4gICAgICAgIGlubmVySW5kZW50KSArXG4gICAgICAgICdcXG4nICtcbiAgICAgICAgb3V0ZXJJbmRlbnQgK1xuICAgICAgICAnfSc7XG4gICAgfSBlbHNlIHtcbiAgICAgIHYgPSAneycgKyBwYXJ0aWFsLmpvaW4oJywnKSArICd9JztcbiAgICB9XG4gICAgcmV0dXJuIHY7XG4gIH1cblxuICBkZWZhdWx0OiAvLyBEbyBub3RoaW5nXG4gIH1cbn07XG5cbi8vIElmIHRoZSBKU09OIG9iamVjdCBkb2VzIG5vdCB5ZXQgaGF2ZSBhIHN0cmluZ2lmeSBtZXRob2QsIGdpdmUgaXQgb25lLlxuY29uc3QgY2Fub25pY2FsU3RyaW5naWZ5ID0gKHZhbHVlLCBvcHRpb25zKSA9PiB7XG4gIC8vIE1ha2UgYSBmYWtlIHJvb3Qgb2JqZWN0IGNvbnRhaW5pbmcgb3VyIHZhbHVlIHVuZGVyIHRoZSBrZXkgb2YgJycuXG4gIC8vIFJldHVybiB0aGUgcmVzdWx0IG9mIHN0cmluZ2lmeWluZyB0aGUgdmFsdWUuXG4gIGNvbnN0IGFsbE9wdGlvbnMgPSBPYmplY3QuYXNzaWduKHtcbiAgICBpbmRlbnQ6ICcnLFxuICAgIGNhbm9uaWNhbDogZmFsc2UsXG4gIH0sIG9wdGlvbnMpO1xuICBpZiAoYWxsT3B0aW9ucy5pbmRlbnQgPT09IHRydWUpIHtcbiAgICBhbGxPcHRpb25zLmluZGVudCA9ICcgICc7XG4gIH0gZWxzZSBpZiAodHlwZW9mIGFsbE9wdGlvbnMuaW5kZW50ID09PSAnbnVtYmVyJykge1xuICAgIGxldCBuZXdJbmRlbnQgPSAnJztcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGFsbE9wdGlvbnMuaW5kZW50OyBpKyspIHtcbiAgICAgIG5ld0luZGVudCArPSAnICc7XG4gICAgfVxuICAgIGFsbE9wdGlvbnMuaW5kZW50ID0gbmV3SW5kZW50O1xuICB9XG4gIHJldHVybiBzdHIoJycsIHsnJzogdmFsdWV9LCBhbGxPcHRpb25zLmluZGVudCwgJycsIGFsbE9wdGlvbnMuY2Fub25pY2FsKTtcbn07XG5cbmV4cG9ydCBkZWZhdWx0IGNhbm9uaWNhbFN0cmluZ2lmeTtcbiIsImV4cG9ydCBjb25zdCBpc0Z1bmN0aW9uID0gKGZuKSA9PiB0eXBlb2YgZm4gPT09ICdmdW5jdGlvbic7XG5cbmV4cG9ydCBjb25zdCBpc09iamVjdCA9IChmbikgPT4gdHlwZW9mIGZuID09PSAnb2JqZWN0JztcblxuZXhwb3J0IGNvbnN0IGtleXNPZiA9IChvYmopID0+IE9iamVjdC5rZXlzKG9iaik7XG5cbmV4cG9ydCBjb25zdCBsZW5ndGhPZiA9IChvYmopID0+IE9iamVjdC5rZXlzKG9iaikubGVuZ3RoO1xuXG5leHBvcnQgY29uc3QgaGFzT3duID0gKG9iaiwgcHJvcCkgPT4gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iaiwgcHJvcCk7XG5cbmV4cG9ydCBjb25zdCBjb252ZXJ0TWFwVG9PYmplY3QgPSAobWFwKSA9PiBBcnJheS5mcm9tKG1hcCkucmVkdWNlKChhY2MsIFtrZXksIHZhbHVlXSkgPT4ge1xuICAvLyByZWFzc2lnbiB0byBub3QgY3JlYXRlIG5ldyBvYmplY3RcbiAgYWNjW2tleV0gPSB2YWx1ZTtcbiAgcmV0dXJuIGFjYztcbn0sIHt9KTtcblxuZXhwb3J0IGNvbnN0IGlzQXJndW1lbnRzID0gb2JqID0+IG9iaiAhPSBudWxsICYmIGhhc093bihvYmosICdjYWxsZWUnKTtcblxuZXhwb3J0IGNvbnN0IGlzSW5mT3JOYU4gPVxuICBvYmogPT4gTnVtYmVyLmlzTmFOKG9iaikgfHwgb2JqID09PSBJbmZpbml0eSB8fCBvYmogPT09IC1JbmZpbml0eTtcblxuZXhwb3J0IGNvbnN0IGNoZWNrRXJyb3IgPSB7XG4gIG1heFN0YWNrOiAobXNnRXJyb3IpID0+IG5ldyBSZWdFeHAoJ01heGltdW0gY2FsbCBzdGFjayBzaXplIGV4Y2VlZGVkJywgJ2cnKS50ZXN0KG1zZ0Vycm9yKSxcbn07XG5cbmV4cG9ydCBjb25zdCBoYW5kbGVFcnJvciA9IChmbikgPT4gZnVuY3Rpb24oKSB7XG4gIHRyeSB7XG4gICAgcmV0dXJuIGZuLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc3QgaXNNYXhTdGFjayA9IGNoZWNrRXJyb3IubWF4U3RhY2soZXJyb3IubWVzc2FnZSk7XG4gICAgaWYgKGlzTWF4U3RhY2spIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQ29udmVydGluZyBjaXJjdWxhciBzdHJ1Y3R1cmUgdG8gSlNPTicpXG4gICAgfVxuICAgIHRocm93IGVycm9yO1xuICB9XG59O1xuIl19
