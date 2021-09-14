(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var _ = Package.underscore._;
var ECMAScript = Package.ecmascript.ECMAScript;
var meteorInstall = Package.modules.meteorInstall;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;
var Symbol = Package['ecmascript-runtime-server'].Symbol;
var Map = Package['ecmascript-runtime-server'].Map;
var Set = Package['ecmascript-runtime-server'].Set;

/* Package-scope variables */
var Random;

var require = meteorInstall({"node_modules":{"meteor":{"random":{"random.js":function(require){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                               //
// packages/random/random.js                                                                                     //
//                                                                                                               //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                 //
// We use cryptographically strong PRNGs (crypto.getRandomBytes() on the server,                                 // 1
// window.crypto.getRandomValues() in the browser) when available. If these                                      // 2
// PRNGs fail, we fall back to the Alea PRNG, which is not cryptographically                                     // 3
// strong, and we seed it with various sources such as the date, Math.random,                                    // 4
// and window size on the client.  When using crypto.getRandomValues(), our                                      // 5
// primitive is hexString(), from which we construct fraction(). When using                                      // 6
// window.crypto.getRandomValues() or alea, the primitive is fraction and we use                                 // 7
// that to construct hex string.                                                                                 // 8
if (Meteor.isServer) var nodeCrypto = Npm.require('crypto'); // see http://baagoe.org/en/wiki/Better_random_numbers_for_javascript
// for a full discussion and Alea implementation.                                                                // 14
                                                                                                                 //
var Alea = function () {                                                                                         // 15
  function Mash() {                                                                                              // 16
    var n = 0xefc8249d;                                                                                          // 17
                                                                                                                 //
    var mash = function (data) {                                                                                 // 19
      data = data.toString();                                                                                    // 20
                                                                                                                 //
      for (var i = 0; i < data.length; i++) {                                                                    // 21
        n += data.charCodeAt(i);                                                                                 // 22
        var h = 0.02519603282416938 * n;                                                                         // 23
        n = h >>> 0;                                                                                             // 24
        h -= n;                                                                                                  // 25
        h *= n;                                                                                                  // 26
        n = h >>> 0;                                                                                             // 27
        h -= n;                                                                                                  // 28
        n += h * 0x100000000; // 2^32                                                                            // 29
      }                                                                                                          // 30
                                                                                                                 //
      return (n >>> 0) * 2.3283064365386963e-10; // 2^-32                                                        // 31
    };                                                                                                           // 32
                                                                                                                 //
    mash.version = 'Mash 0.9';                                                                                   // 34
    return mash;                                                                                                 // 35
  }                                                                                                              // 36
                                                                                                                 //
  return function (args) {                                                                                       // 38
    var s0 = 0;                                                                                                  // 39
    var s1 = 0;                                                                                                  // 40
    var s2 = 0;                                                                                                  // 41
    var c = 1;                                                                                                   // 42
                                                                                                                 //
    if (args.length == 0) {                                                                                      // 44
      args = [+new Date()];                                                                                      // 45
    }                                                                                                            // 46
                                                                                                                 //
    var mash = Mash();                                                                                           // 47
    s0 = mash(' ');                                                                                              // 48
    s1 = mash(' ');                                                                                              // 49
    s2 = mash(' ');                                                                                              // 50
                                                                                                                 //
    for (var i = 0; i < args.length; i++) {                                                                      // 52
      s0 -= mash(args[i]);                                                                                       // 53
                                                                                                                 //
      if (s0 < 0) {                                                                                              // 54
        s0 += 1;                                                                                                 // 55
      }                                                                                                          // 56
                                                                                                                 //
      s1 -= mash(args[i]);                                                                                       // 57
                                                                                                                 //
      if (s1 < 0) {                                                                                              // 58
        s1 += 1;                                                                                                 // 59
      }                                                                                                          // 60
                                                                                                                 //
      s2 -= mash(args[i]);                                                                                       // 61
                                                                                                                 //
      if (s2 < 0) {                                                                                              // 62
        s2 += 1;                                                                                                 // 63
      }                                                                                                          // 64
    }                                                                                                            // 65
                                                                                                                 //
    mash = null;                                                                                                 // 66
                                                                                                                 //
    var random = function () {                                                                                   // 68
      var t = 2091639 * s0 + c * 2.3283064365386963e-10; // 2^-32                                                // 69
                                                                                                                 //
      s0 = s1;                                                                                                   // 70
      s1 = s2;                                                                                                   // 71
      return s2 = t - (c = t | 0);                                                                               // 72
    };                                                                                                           // 73
                                                                                                                 //
    random.uint32 = function () {                                                                                // 74
      return random() * 0x100000000; // 2^32                                                                     // 75
    };                                                                                                           // 76
                                                                                                                 //
    random.fract53 = function () {                                                                               // 77
      return random() + (random() * 0x200000 | 0) * 1.1102230246251565e-16; // 2^-53                             // 78
    };                                                                                                           // 80
                                                                                                                 //
    random.version = 'Alea 0.9';                                                                                 // 81
    random.args = args;                                                                                          // 82
    return random;                                                                                               // 83
  }(Array.prototype.slice.call(arguments));                                                                      // 85
};                                                                                                               // 86
                                                                                                                 //
var UNMISTAKABLE_CHARS = "23456789ABCDEFGHJKLMNPQRSTWXYZabcdefghijkmnopqrstuvwxyz";                              // 88
var BASE64_CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ" + "0123456789-_"; // `type` is one of `RandomGenerator.Type` as defined below.
//                                                                                                               // 93
// options:                                                                                                      // 94
// - seeds: (required, only for RandomGenerator.Type.ALEA) an array                                              // 95
//   whose items will be `toString`ed and used as the seed to the Alea                                           // 96
//   algorithm                                                                                                   // 97
                                                                                                                 //
var RandomGenerator = function (type, options) {                                                                 // 98
  var self = this;                                                                                               // 99
  self.type = type;                                                                                              // 100
                                                                                                                 //
  if (!RandomGenerator.Type[type]) {                                                                             // 102
    throw new Error("Unknown random generator type: " + type);                                                   // 103
  }                                                                                                              // 104
                                                                                                                 //
  if (type === RandomGenerator.Type.ALEA) {                                                                      // 106
    if (!options.seeds) {                                                                                        // 107
      throw new Error("No seeds were provided for Alea PRNG");                                                   // 108
    }                                                                                                            // 109
                                                                                                                 //
    self.alea = Alea.apply(null, options.seeds);                                                                 // 110
  }                                                                                                              // 111
}; // Types of PRNGs supported by the `RandomGenerator` class                                                    // 112
                                                                                                                 //
                                                                                                                 //
RandomGenerator.Type = {                                                                                         // 115
  // Use Node's built-in `crypto.getRandomBytes` (cryptographically                                              // 116
  // secure but not seedable, runs only on the server). Reverts to                                               // 117
  // `crypto.getPseudoRandomBytes` in the extremely uncommon case that                                           // 118
  // there isn't enough entropy yet                                                                              // 119
  NODE_CRYPTO: "NODE_CRYPTO",                                                                                    // 120
  // Use non-IE browser's built-in `window.crypto.getRandomValues`                                               // 122
  // (cryptographically secure but not seedable, runs only in the                                                // 123
  // browser).                                                                                                   // 124
  BROWSER_CRYPTO: "BROWSER_CRYPTO",                                                                              // 125
  // Use the *fast*, seedaable and not cryptographically secure                                                  // 127
  // Alea algorithm                                                                                              // 128
  ALEA: "ALEA"                                                                                                   // 129
}; /**                                                                                                           // 115
    * @name Random.fraction                                                                                      //
    * @summary Return a number between 0 and 1, like `Math.random`.                                              //
    * @locus Anywhere                                                                                            //
    */                                                                                                           //
                                                                                                                 //
RandomGenerator.prototype.fraction = function () {                                                               // 137
  var self = this;                                                                                               // 138
                                                                                                                 //
  if (self.type === RandomGenerator.Type.ALEA) {                                                                 // 139
    return self.alea();                                                                                          // 140
  } else if (self.type === RandomGenerator.Type.NODE_CRYPTO) {                                                   // 141
    var numerator = parseInt(self.hexString(8), 16);                                                             // 142
    return numerator * 2.3283064365386963e-10; // 2^-32                                                          // 143
  } else if (self.type === RandomGenerator.Type.BROWSER_CRYPTO) {                                                // 144
    var array = new Uint32Array(1);                                                                              // 145
    window.crypto.getRandomValues(array);                                                                        // 146
    return array[0] * 2.3283064365386963e-10; // 2^-32                                                           // 147
  } else {                                                                                                       // 148
    throw new Error('Unknown random generator type: ' + self.type);                                              // 149
  }                                                                                                              // 150
}; /**                                                                                                           // 151
    * @name Random.hexString                                                                                     //
    * @summary Return a random string of `n` hexadecimal digits.                                                 //
    * @locus Anywhere                                                                                            //
    * @param {Number} n Length of the string                                                                     //
    */                                                                                                           //
                                                                                                                 //
RandomGenerator.prototype.hexString = function (digits) {                                                        // 159
  var self = this;                                                                                               // 160
                                                                                                                 //
  if (self.type === RandomGenerator.Type.NODE_CRYPTO) {                                                          // 161
    var numBytes = Math.ceil(digits / 2);                                                                        // 162
    var bytes; // Try to get cryptographically strong randomness. Fall back to                                   // 163
    // non-cryptographically strong if not available.                                                            // 165
                                                                                                                 //
    try {                                                                                                        // 166
      bytes = nodeCrypto.randomBytes(numBytes);                                                                  // 167
    } catch (e) {                                                                                                // 168
      // XXX should re-throw any error except insufficient entropy                                               // 169
      bytes = nodeCrypto.pseudoRandomBytes(numBytes);                                                            // 170
    }                                                                                                            // 171
                                                                                                                 //
    var result = bytes.toString("hex"); // If the number of digits is odd, we'll have generated an extra 4 bits  // 172
    // of randomness, so we need to trim the last digit.                                                         // 174
                                                                                                                 //
    return result.substring(0, digits);                                                                          // 175
  } else {                                                                                                       // 176
    return this._randomString(digits, "0123456789abcdef");                                                       // 177
  }                                                                                                              // 178
};                                                                                                               // 179
                                                                                                                 //
RandomGenerator.prototype._randomString = function (charsCount, alphabet) {                                      // 181
  var self = this;                                                                                               // 183
  var digits = [];                                                                                               // 184
                                                                                                                 //
  for (var i = 0; i < charsCount; i++) {                                                                         // 185
    digits[i] = self.choice(alphabet);                                                                           // 186
  }                                                                                                              // 187
                                                                                                                 //
  return digits.join("");                                                                                        // 188
}; /**                                                                                                           // 189
    * @name Random.id                                                                                            //
    * @summary Return a unique identifier, such as `"Jjwjg6gouWLXhMGKW"`, that is                                //
    * likely to be unique in the whole world.                                                                    //
    * @locus Anywhere                                                                                            //
    * @param {Number} [n] Optional length of the identifier in characters                                        //
    *   (defaults to 17)                                                                                         //
    */                                                                                                           //
                                                                                                                 //
RandomGenerator.prototype.id = function (charsCount) {                                                           // 199
  var self = this; // 17 characters is around 96 bits of entropy, which is the amount of                         // 200
  // state in the Alea PRNG.                                                                                     // 202
                                                                                                                 //
  if (charsCount === undefined) charsCount = 17;                                                                 // 203
  return self._randomString(charsCount, UNMISTAKABLE_CHARS);                                                     // 206
}; /**                                                                                                           // 207
    * @name Random.secret                                                                                        //
    * @summary Return a random string of printable characters with 6 bits of                                     //
    * entropy per character. Use `Random.secret` for security-critical secrets                                   //
    * that are intended for machine, rather than human, consumption.                                             //
    * @locus Anywhere                                                                                            //
    * @param {Number} [n] Optional length of the secret string (defaults to 43                                   //
    *   characters, or 256 bits of entropy)                                                                      //
    */                                                                                                           //
                                                                                                                 //
RandomGenerator.prototype.secret = function (charsCount) {                                                       // 218
  var self = this; // Default to 256 bits of entropy, or 43 characters at 6 bits per                             // 219
  // character.                                                                                                  // 221
                                                                                                                 //
  if (charsCount === undefined) charsCount = 43;                                                                 // 222
  return self._randomString(charsCount, BASE64_CHARS);                                                           // 224
}; /**                                                                                                           // 225
    * @name Random.choice                                                                                        //
    * @summary Return a random element of the given array or string.                                             //
    * @locus Anywhere                                                                                            //
    * @param {Array|String} arrayOrString Array or string to choose from                                         //
    */                                                                                                           //
                                                                                                                 //
RandomGenerator.prototype.choice = function (arrayOrString) {                                                    // 233
  var index = Math.floor(this.fraction() * arrayOrString.length);                                                // 234
  if (typeof arrayOrString === "string") return arrayOrString.substr(index, 1);else return arrayOrString[index];
}; // instantiate RNG.  Heuristically collect entropy from various sources when a                                // 239
// cryptographic PRNG isn't available.                                                                           // 242
// client sources                                                                                                // 244
                                                                                                                 //
                                                                                                                 //
var height = typeof window !== 'undefined' && window.innerHeight || typeof document !== 'undefined' && document.documentElement && document.documentElement.clientHeight || typeof document !== 'undefined' && document.body && document.body.clientHeight || 1;
var width = typeof window !== 'undefined' && window.innerWidth || typeof document !== 'undefined' && document.documentElement && document.documentElement.clientWidth || typeof document !== 'undefined' && document.body && document.body.clientWidth || 1;
var agent = typeof navigator !== 'undefined' && navigator.userAgent || "";                                       // 263
                                                                                                                 //
function createAleaGeneratorWithGeneratedSeed() {                                                                // 265
  return new RandomGenerator(RandomGenerator.Type.ALEA, {                                                        // 266
    seeds: [new Date(), height, width, agent, Math.random()]                                                     // 268
  });                                                                                                            // 268
}                                                                                                                // 269
                                                                                                                 //
;                                                                                                                // 269
                                                                                                                 //
if (Meteor.isServer) {                                                                                           // 271
  Random = new RandomGenerator(RandomGenerator.Type.NODE_CRYPTO);                                                // 272
} else {                                                                                                         // 273
  if (typeof window !== "undefined" && window.crypto && window.crypto.getRandomValues) {                         // 274
    Random = new RandomGenerator(RandomGenerator.Type.BROWSER_CRYPTO);                                           // 276
  } else {                                                                                                       // 277
    // On IE 10 and below, there's no browser crypto API                                                         // 278
    // available. Fall back to Alea                                                                              // 279
    //                                                                                                           // 280
    // XXX looks like at the moment, we use Alea in IE 11 as well,                                               // 281
    // which has `window.msCrypto` instead of `window.crypto`.                                                   // 282
    Random = createAleaGeneratorWithGeneratedSeed();                                                             // 283
  }                                                                                                              // 284
} // Create a non-cryptographically secure PRNG with a given seed (using                                         // 285
// the Alea algorithm)                                                                                           // 288
                                                                                                                 //
                                                                                                                 //
Random.createWithSeeds = function () {                                                                           // 289
  for (var _len = arguments.length, seeds = Array(_len), _key = 0; _key < _len; _key++) {                        // 289
    seeds[_key] = arguments[_key];                                                                               // 289
  }                                                                                                              // 289
                                                                                                                 //
  if (seeds.length === 0) {                                                                                      // 290
    throw new Error("No seeds were provided");                                                                   // 291
  }                                                                                                              // 292
                                                                                                                 //
  return new RandomGenerator(RandomGenerator.Type.ALEA, {                                                        // 293
    seeds: seeds                                                                                                 // 293
  });                                                                                                            // 293
}; // Used like `Random`, but much faster and not cryptographically                                              // 294
// secure                                                                                                        // 297
                                                                                                                 //
                                                                                                                 //
Random.insecure = createAleaGeneratorWithGeneratedSeed();                                                        // 298
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"deprecated.js":function(){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                               //
// packages/random/deprecated.js                                                                                 //
//                                                                                                               //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                 //
// Before this package existed, we used to use this Meteor.uuid()                                                // 1
// implementing the RFC 4122 v4 UUID. It is no longer documented                                                 // 2
// and will go away.                                                                                             // 3
// XXX COMPAT WITH 0.5.6                                                                                         // 4
Meteor.uuid = function () {                                                                                      // 5
  var HEX_DIGITS = "0123456789abcdef";                                                                           // 6
  var s = [];                                                                                                    // 7
                                                                                                                 //
  for (var i = 0; i < 36; i++) {                                                                                 // 8
    s[i] = Random.choice(HEX_DIGITS);                                                                            // 9
  }                                                                                                              // 10
                                                                                                                 //
  s[14] = "4";                                                                                                   // 11
  s[19] = HEX_DIGITS.substr(parseInt(s[19], 16) & 0x3 | 0x8, 1);                                                 // 12
  s[8] = s[13] = s[18] = s[23] = "-";                                                                            // 13
  var uuid = s.join("");                                                                                         // 15
  return uuid;                                                                                                   // 16
};                                                                                                               // 17
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/random/random.js");
require("./node_modules/meteor/random/deprecated.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
(function (pkg, symbols) {
  for (var s in symbols)
    (s in pkg) || (pkg[s] = symbols[s]);
})(Package.random = {}, {
  Random: Random
});

})();





//# sourceURL=meteor://💻app/packages/random.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcmFuZG9tL3JhbmRvbS5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcmFuZG9tL2RlcHJlY2F0ZWQuanMiXSwibmFtZXMiOlsiTWV0ZW9yIiwiaXNTZXJ2ZXIiLCJub2RlQ3J5cHRvIiwiTnBtIiwicmVxdWlyZSIsIkFsZWEiLCJNYXNoIiwibiIsIm1hc2giLCJkYXRhIiwidG9TdHJpbmciLCJpIiwibGVuZ3RoIiwiY2hhckNvZGVBdCIsImgiLCJ2ZXJzaW9uIiwiYXJncyIsInMwIiwiczEiLCJzMiIsImMiLCJEYXRlIiwicmFuZG9tIiwidCIsInVpbnQzMiIsImZyYWN0NTMiLCJBcnJheSIsInByb3RvdHlwZSIsInNsaWNlIiwiY2FsbCIsImFyZ3VtZW50cyIsIlVOTUlTVEFLQUJMRV9DSEFSUyIsIkJBU0U2NF9DSEFSUyIsIlJhbmRvbUdlbmVyYXRvciIsInR5cGUiLCJvcHRpb25zIiwic2VsZiIsIlR5cGUiLCJFcnJvciIsIkFMRUEiLCJzZWVkcyIsImFsZWEiLCJhcHBseSIsIk5PREVfQ1JZUFRPIiwiQlJPV1NFUl9DUllQVE8iLCJmcmFjdGlvbiIsIm51bWVyYXRvciIsInBhcnNlSW50IiwiaGV4U3RyaW5nIiwiYXJyYXkiLCJVaW50MzJBcnJheSIsIndpbmRvdyIsImNyeXB0byIsImdldFJhbmRvbVZhbHVlcyIsImRpZ2l0cyIsIm51bUJ5dGVzIiwiTWF0aCIsImNlaWwiLCJieXRlcyIsInJhbmRvbUJ5dGVzIiwiZSIsInBzZXVkb1JhbmRvbUJ5dGVzIiwicmVzdWx0Iiwic3Vic3RyaW5nIiwiX3JhbmRvbVN0cmluZyIsImNoYXJzQ291bnQiLCJhbHBoYWJldCIsImNob2ljZSIsImpvaW4iLCJpZCIsInVuZGVmaW5lZCIsInNlY3JldCIsImFycmF5T3JTdHJpbmciLCJpbmRleCIsImZsb29yIiwic3Vic3RyIiwiaGVpZ2h0IiwiaW5uZXJIZWlnaHQiLCJkb2N1bWVudCIsImRvY3VtZW50RWxlbWVudCIsImNsaWVudEhlaWdodCIsImJvZHkiLCJ3aWR0aCIsImlubmVyV2lkdGgiLCJjbGllbnRXaWR0aCIsImFnZW50IiwibmF2aWdhdG9yIiwidXNlckFnZW50IiwiY3JlYXRlQWxlYUdlbmVyYXRvcldpdGhHZW5lcmF0ZWRTZWVkIiwiUmFuZG9tIiwiY3JlYXRlV2l0aFNlZWRzIiwiaW5zZWN1cmUiLCJ1dWlkIiwiSEVYX0RJR0lUUyIsInMiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUVBLElBQUlBLE9BQU9DLFFBQVgsRUFDRSxJQUFJQyxhQUFhQyxJQUFJQyxPQUFKLENBQVksUUFBWixDQUFqQixDLENBRUY7QUFDQTs7QUFDQSxJQUFJQyxPQUFPLFlBQVk7QUFDckIsV0FBU0MsSUFBVCxHQUFnQjtBQUNkLFFBQUlDLElBQUksVUFBUjs7QUFFQSxRQUFJQyxPQUFPLFVBQVNDLElBQVQsRUFBZTtBQUN4QkEsYUFBT0EsS0FBS0MsUUFBTCxFQUFQOztBQUNBLFdBQUssSUFBSUMsSUFBSSxDQUFiLEVBQWdCQSxJQUFJRixLQUFLRyxNQUF6QixFQUFpQ0QsR0FBakMsRUFBc0M7QUFDcENKLGFBQUtFLEtBQUtJLFVBQUwsQ0FBZ0JGLENBQWhCLENBQUw7QUFDQSxZQUFJRyxJQUFJLHNCQUFzQlAsQ0FBOUI7QUFDQUEsWUFBSU8sTUFBTSxDQUFWO0FBQ0FBLGFBQUtQLENBQUw7QUFDQU8sYUFBS1AsQ0FBTDtBQUNBQSxZQUFJTyxNQUFNLENBQVY7QUFDQUEsYUFBS1AsQ0FBTDtBQUNBQSxhQUFLTyxJQUFJLFdBQVQsQ0FSb0MsQ0FRZDtBQUN2Qjs7QUFDRCxhQUFPLENBQUNQLE1BQU0sQ0FBUCxJQUFZLHNCQUFuQixDQVp3QixDQVltQjtBQUM1QyxLQWJEOztBQWVBQyxTQUFLTyxPQUFMLEdBQWUsVUFBZjtBQUNBLFdBQU9QLElBQVA7QUFDRDs7QUFFRCxTQUFRLFVBQVVRLElBQVYsRUFBZ0I7QUFD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QUNBO0FBQ0E7QUFDQTtBQUNBeEYsT0FBTzRGLElBQVAsR0FBYyxZQUFZO0FBQ3hCLE1BQUlDLGFBQWEsa0JBQWpCO0FBQ0EsTUFBSUMsSUFBSSxFQUFSOztBQUNBLE9BQUssSUFBSW5GLElBQUksQ0FBYixFQUFnQkEsSUFBSSxFQUFwQixFQUF3QkEsR0FBeEIsRUFBNkI7QUFDM0JtRixNQUFFbkYsQ0FBRixJQUFPOEUsT0FBT3RCLE1BQVAsQ0FBYzBCLFVBQWQsQ0FBUDtBQUNEOztBQUNEQyxJQUFFLEVBQUYsSUFBUSxHQUFSO0FBQ0FBLElBQUUsRUFBRixJQUFRRCxXQUFXbEIsTUFBWCxDQUFtQjVCLFNBQVMrQyxFQUFFLEVBQUYsQ0FBVCxFQUFlLEVBQWYsSUFBcUIsR0FBdEIsR0FBNkIsR0FBL0MsRUFBb0QsQ0FBcEQsQ0FBUjtBQUNBQSxJQUFFLENBQUYsSUFBT0EsRUFBRSxFQUFGLElBQVFBLEVBQUUsRUFBRixJQUFRQSxFQUFFLEVBQUYsSUFBUSxHQUEvQjtBQUVBLE1BQUlGLE9BQU9FLEVBQUUxQixJQUFGLENBQU8sRUFBUCxDQUFYO0FBQ0EsU0FBT3dCLElBQVA7QUFDRCxDQVpELHFIIiwiZmlsZSI6Ii9wYWNrYWdlcy9yYW5kb20uanMiLCJzb3VyY2VzQ29udGVudCI6WyIvLyBXZSB1c2UgY3J5cHRvZ3JhcGhpY2FsbHkgc3Ryb25nIFBSTkdzIChjcnlwdG8uZ2V0UmFuZG9tQnl0ZXMoKSBvbiB0aGUgc2VydmVyLFxuLy8gd2luZG93LmNyeXB0by5nZXRSYW5kb21WYWx1ZXMoKSBpbiB0aGUgYnJvd3Nlcikgd2hlbiBhdmFpbGFibGUuIElmIHRoZXNlXG4vLyBQUk5HcyBmYWlsLCB3ZSBmYWxsIGJhY2sgdG8gdGhlIEFsZWEgUFJORywgd2hpY2ggaXMgbm90IGNyeXB0b2dyYXBoaWNhbGx5XG4vLyBzdHJvbmcsIGFuZCB3ZSBzZWVkIGl0IHdpdGggdmFyaW91cyBzb3VyY2VzIHN1Y2ggYXMgdGhlIGRhdGUsIE1hdGgucmFuZG9tLFxuLy8gYW5kIHdpbmRvdyBzaXplIG9uIHRoZSBjbGllbnQuICBXaGVuIHVzaW5nIGNyeXB0by5nZXRSYW5kb21WYWx1ZXMoKSwgb3VyXG4vLyBwcmltaXRpdmUgaXMgaGV4U3RyaW5nKCksIGZyb20gd2hpY2ggd2UgY29uc3RydWN0IGZyYWN0aW9uKCkuIFdoZW4gdXNpbmdcbi8vIHdpbmRvdy5jcnlwdG8uZ2V0UmFuZG9tVmFsdWVzKCkgb3IgYWxlYSwgdGhlIHByaW1pdGl2ZSBpcyBmcmFjdGlvbiBhbmQgd2UgdXNlXG4vLyB0aGF0IHRvIGNvbnN0cnVjdCBoZXggc3RyaW5nLlxuXG5pZiAoTWV0ZW9yLmlzU2VydmVyKVxuICB2YXIgbm9kZUNyeXB0byA9IE5wbS5yZXF1aXJlKCdjcnlwdG8nKTtcblxuLy8gc2VlIGh0dHA6Ly9iYWFnb2Uub3JnL2VuL3dpa2kvQmV0dGVyX3JhbmRvbV9udW1iZXJzX2Zvcl9qYXZhc2NyaXB0XG4vLyBmb3IgYSBmdWxsIGRpc2N1c3Npb24gYW5kIEFsZWEgaW1wbGVtZW50YXRpb24uXG52YXIgQWxlYSA9IGZ1bmN0aW9uICgpIHtcbiAgZnVuY3Rpb24gTWFzaCgpIHtcbiAgICB2YXIgbiA9IDB4ZWZjODI0OWQ7XG5cbiAgICB2YXIgbWFzaCA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgIGRhdGEgPSBkYXRhLnRvU3RyaW5nKCk7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGRhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgbiArPSBkYXRhLmNoYXJDb2RlQXQoaSk7XG4gICAgICAgIHZhciBoID0gMC4wMjUxOTYwMzI4MjQxNjkzOCAqIG47XG4gICAgICAgIG4gPSBoID4+PiAwO1xuICAgICAgICBoIC09IG47XG4gICAgICAgIGggKj0gbjtcbiAgICAgICAgbiA9IGggPj4+IDA7XG4gICAgICAgIGggLT0gbjtcbiAgICAgICAgbiArPSBoICogMHgxMDAwMDAwMDA7IC8vIDJeMzJcbiAgICAgIH1cbiAgICAgIHJldHVybiAobiA+Pj4gMCkgKiAyLjMyODMwNjQzNjUzODY5NjNlLTEwOyAvLyAyXi0zMlxuICAgIH07XG5cbiAgICBtYXNoLnZlcnNpb24gPSAnTWFzaCAwLjknO1xuICAgIHJldHVybiBtYXNoO1xuICB9XG5cbiAgcmV0dXJuIChmdW5jdGlvbiAoYXJncykge1xuICAgIHZhciBzMCA9IDA7XG4gICAgdmFyIHMxID0gMDtcbiAgICB2YXIgczIgPSAwO1xuICAgIHZhciBjID0gMTtcblxuICAgIGlmIChhcmdzLmxlbmd0aCA9PSAwKSB7XG4gICAgICBhcmdzID0gWytuZXcgRGF0ZV07XG4gICAgfVxuICAgIHZhciBtYXNoID0gTWFzaCgpO1xuICAgIHMwID0gbWFzaCgnICcpO1xuICAgIHMxID0gbWFzaCgnICcpO1xuICAgIHMyID0gbWFzaCgnICcpO1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcmdzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBzMCAtPSBtYXNoKGFyZ3NbaV0pO1xuICAgICAgaWYgKHMwIDwgMCkge1xuICAgICAgICBzMCArPSAxO1xuICAgICAgfVxuICAgICAgczEgLT0gbWFzaChhcmdzW2ldKTtcbiAgICAgIGlmIChzMSA8IDApIHtcbiAgICAgICAgczEgKz0gMTtcbiAgICAgIH1cbiAgICAgIHMyIC09IG1hc2goYXJnc1tpXSk7XG4gICAgICBpZiAoczIgPCAwKSB7XG4gICAgICAgIHMyICs9IDE7XG4gICAgICB9XG4gICAgfVxuICAgIG1hc2ggPSBudWxsO1xuXG4gICAgdmFyIHJhbmRvbSA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHQgPSAyMDkxNjM5ICogczAgKyBjICogMi4zMjgzMDY0MzY1Mzg2OTYzZS0xMDsgLy8gMl4tMzJcbiAgICAgIHMwID0gczE7XG4gICAgICBzMSA9IHMyO1xuICAgICAgcmV0dXJuIHMyID0gdCAtIChjID0gdCB8IDApO1xuICAgIH07XG4gICAgcmFuZG9tLnVpbnQzMiA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHJhbmRvbSgpICogMHgxMDAwMDAwMDA7IC8vIDJeMzJcbiAgICB9O1xuICAgIHJhbmRvbS5mcmFjdDUzID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gcmFuZG9tKCkgK1xuICAgICAgICAocmFuZG9tKCkgKiAweDIwMDAwMCB8IDApICogMS4xMTAyMjMwMjQ2MjUxNTY1ZS0xNjsgLy8gMl4tNTNcbiAgICB9O1xuICAgIHJhbmRvbS52ZXJzaW9uID0gJ0FsZWEgMC45JztcbiAgICByYW5kb20uYXJncyA9IGFyZ3M7XG4gICAgcmV0dXJuIHJhbmRvbTtcblxuICB9IChBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpKSk7XG59O1xuXG52YXIgVU5NSVNUQUtBQkxFX0NIQVJTID0gXCIyMzQ1Njc4OUFCQ0RFRkdISktMTU5QUVJTVFdYWVphYmNkZWZnaGlqa21ub3BxcnN0dXZ3eHl6XCI7XG52YXIgQkFTRTY0X0NIQVJTID0gXCJhYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ekFCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaXCIgK1xuICBcIjAxMjM0NTY3ODktX1wiO1xuXG4vLyBgdHlwZWAgaXMgb25lIG9mIGBSYW5kb21HZW5lcmF0b3IuVHlwZWAgYXMgZGVmaW5lZCBiZWxvdy5cbi8vXG4vLyBvcHRpb25zOlxuLy8gLSBzZWVkczogKHJlcXVpcmVkLCBvbmx5IGZvciBSYW5kb21HZW5lcmF0b3IuVHlwZS5BTEVBKSBhbiBhcnJheVxuLy8gICB3aG9zZSBpdGVtcyB3aWxsIGJlIGB0b1N0cmluZ2BlZCBhbmQgdXNlZCBhcyB0aGUgc2VlZCB0byB0aGUgQWxlYVxuLy8gICBhbGdvcml0aG1cbnZhciBSYW5kb21HZW5lcmF0b3IgPSBmdW5jdGlvbiAodHlwZSwgb3B0aW9ucykge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHNlbGYudHlwZSA9IHR5cGU7XG5cbiAgaWYgKCFSYW5kb21HZW5lcmF0b3IuVHlwZVt0eXBlXSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIlVua25vd24gcmFuZG9tIGdlbmVyYXRvciB0eXBlOiBcIiArIHR5cGUpO1xuICB9XG5cbiAgaWYgKHR5cGUgPT09IFJhbmRvbUdlbmVyYXRvci5UeXBlLkFMRUEpIHtcbiAgICBpZiAoIW9wdGlvbnMuc2VlZHMpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIk5vIHNlZWRzIHdlcmUgcHJvdmlkZWQgZm9yIEFsZWEgUFJOR1wiKTtcbiAgICB9XG4gICAgc2VsZi5hbGVhID0gQWxlYS5hcHBseShudWxsLCBvcHRpb25zLnNlZWRzKTtcbiAgfVxufTtcblxuLy8gVHlwZXMgb2YgUFJOR3Mgc3VwcG9ydGVkIGJ5IHRoZSBgUmFuZG9tR2VuZXJhdG9yYCBjbGFzc1xuUmFuZG9tR2VuZXJhdG9yLlR5cGUgPSB7XG4gIC8vIFVzZSBOb2RlJ3MgYnVpbHQtaW4gYGNyeXB0by5nZXRSYW5kb21CeXRlc2AgKGNyeXB0b2dyYXBoaWNhbGx5XG4gIC8vIHNlY3VyZSBidXQgbm90IHNlZWRhYmxlLCBydW5zIG9ubHkgb24gdGhlIHNlcnZlcikuIFJldmVydHMgdG9cbiAgLy8gYGNyeXB0by5nZXRQc2V1ZG9SYW5kb21CeXRlc2AgaW4gdGhlIGV4dHJlbWVseSB1bmNvbW1vbiBjYXNlIHRoYXRcbiAgLy8gdGhlcmUgaXNuJ3QgZW5vdWdoIGVudHJvcHkgeWV0XG4gIE5PREVfQ1JZUFRPOiBcIk5PREVfQ1JZUFRPXCIsXG5cbiAgLy8gVXNlIG5vbi1JRSBicm93c2VyJ3MgYnVpbHQtaW4gYHdpbmRvdy5jcnlwdG8uZ2V0UmFuZG9tVmFsdWVzYFxuICAvLyAoY3J5cHRvZ3JhcGhpY2FsbHkgc2VjdXJlIGJ1dCBub3Qgc2VlZGFibGUsIHJ1bnMgb25seSBpbiB0aGVcbiAgLy8gYnJvd3NlcikuXG4gIEJST1dTRVJfQ1JZUFRPOiBcIkJST1dTRVJfQ1JZUFRPXCIsXG5cbiAgLy8gVXNlIHRoZSAqZmFzdCosIHNlZWRhYWJsZSBhbmQgbm90IGNyeXB0b2dyYXBoaWNhbGx5IHNlY3VyZVxuICAvLyBBbGVhIGFsZ29yaXRobVxuICBBTEVBOiBcIkFMRUFcIixcbn07XG5cbi8qKlxuICogQG5hbWUgUmFuZG9tLmZyYWN0aW9uXG4gKiBAc3VtbWFyeSBSZXR1cm4gYSBudW1iZXIgYmV0d2VlbiAwIGFuZCAxLCBsaWtlIGBNYXRoLnJhbmRvbWAuXG4gKiBAbG9jdXMgQW55d2hlcmVcbiAqL1xuUmFuZG9tR2VuZXJhdG9yLnByb3RvdHlwZS5mcmFjdGlvbiA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBpZiAoc2VsZi50eXBlID09PSBSYW5kb21HZW5lcmF0b3IuVHlwZS5BTEVBKSB7XG4gICAgcmV0dXJuIHNlbGYuYWxlYSgpO1xuICB9IGVsc2UgaWYgKHNlbGYudHlwZSA9PT0gUmFuZG9tR2VuZXJhdG9yLlR5cGUuTk9ERV9DUllQVE8pIHtcbiAgICB2YXIgbnVtZXJhdG9yID0gcGFyc2VJbnQoc2VsZi5oZXhTdHJpbmcoOCksIDE2KTtcbiAgICByZXR1cm4gbnVtZXJhdG9yICogMi4zMjgzMDY0MzY1Mzg2OTYzZS0xMDsgLy8gMl4tMzJcbiAgfSBlbHNlIGlmIChzZWxmLnR5cGUgPT09IFJhbmRvbUdlbmVyYXRvci5UeXBlLkJST1dTRVJfQ1JZUFRPKSB7XG4gICAgdmFyIGFycmF5ID0gbmV3IFVpbnQzMkFycmF5KDEpO1xuICAgIHdpbmRvdy5jcnlwdG8uZ2V0UmFuZG9tVmFsdWVzKGFycmF5KTtcbiAgICByZXR1cm4gYXJyYXlbMF0gKiAyLjMyODMwNjQzNjUzODY5NjNlLTEwOyAvLyAyXi0zMlxuICB9IGVsc2Uge1xuICAgIHRocm93IG5ldyBFcnJvcignVW5rbm93biByYW5kb20gZ2VuZXJhdG9yIHR5cGU6ICcgKyBzZWxmLnR5cGUpO1xuICB9XG59O1xuXG4vKipcbiAqIEBuYW1lIFJhbmRvbS5oZXhTdHJpbmdcbiAqIEBzdW1tYXJ5IFJldHVybiBhIHJhbmRvbSBzdHJpbmcgb2YgYG5gIGhleGFkZWNpbWFsIGRpZ2l0cy5cbiAqIEBsb2N1cyBBbnl3aGVyZVxuICogQHBhcmFtIHtOdW1iZXJ9IG4gTGVuZ3RoIG9mIHRoZSBzdHJpbmdcbiAqL1xuUmFuZG9tR2VuZXJhdG9yLnByb3RvdHlwZS5oZXhTdHJpbmcgPSBmdW5jdGlvbiAoZGlnaXRzKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgaWYgKHNlbGYudHlwZSA9PT0gUmFuZG9tR2VuZXJhdG9yLlR5cGUuTk9ERV9DUllQVE8pIHtcbiAgICB2YXIgbnVtQnl0ZXMgPSBNYXRoLmNlaWwoZGlnaXRzIC8gMik7XG4gICAgdmFyIGJ5dGVzO1xuICAgIC8vIFRyeSB0byBnZXQgY3J5cHRvZ3JhcGhpY2FsbHkgc3Ryb25nIHJhbmRvbW5lc3MuIEZhbGwgYmFjayB0b1xuICAgIC8vIG5vbi1jcnlwdG9ncmFwaGljYWxseSBzdHJvbmcgaWYgbm90IGF2YWlsYWJsZS5cbiAgICB0cnkge1xuICAgICAgYnl0ZXMgPSBub2RlQ3J5cHRvLnJhbmRvbUJ5dGVzKG51bUJ5dGVzKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAvLyBYWFggc2hvdWxkIHJlLXRocm93IGFueSBlcnJvciBleGNlcHQgaW5zdWZmaWNpZW50IGVudHJvcHlcbiAgICAgIGJ5dGVzID0gbm9kZUNyeXB0by5wc2V1ZG9SYW5kb21CeXRlcyhudW1CeXRlcyk7XG4gICAgfVxuICAgIHZhciByZXN1bHQgPSBieXRlcy50b1N0cmluZyhcImhleFwiKTtcbiAgICAvLyBJZiB0aGUgbnVtYmVyIG9mIGRpZ2l0cyBpcyBvZGQsIHdlJ2xsIGhhdmUgZ2VuZXJhdGVkIGFuIGV4dHJhIDQgYml0c1xuICAgIC8vIG9mIHJhbmRvbW5lc3MsIHNvIHdlIG5lZWQgdG8gdHJpbSB0aGUgbGFzdCBkaWdpdC5cbiAgICByZXR1cm4gcmVzdWx0LnN1YnN0cmluZygwLCBkaWdpdHMpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiB0aGlzLl9yYW5kb21TdHJpbmcoZGlnaXRzLCBcIjAxMjM0NTY3ODlhYmNkZWZcIik7XG4gIH1cbn07XG5cblJhbmRvbUdlbmVyYXRvci5wcm90b3R5cGUuX3JhbmRvbVN0cmluZyA9IGZ1bmN0aW9uIChjaGFyc0NvdW50LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFscGhhYmV0KSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgdmFyIGRpZ2l0cyA9IFtdO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGNoYXJzQ291bnQ7IGkrKykge1xuICAgIGRpZ2l0c1tpXSA9IHNlbGYuY2hvaWNlKGFscGhhYmV0KTtcbiAgfVxuICByZXR1cm4gZGlnaXRzLmpvaW4oXCJcIik7XG59O1xuXG4vKipcbiAqIEBuYW1lIFJhbmRvbS5pZFxuICogQHN1bW1hcnkgUmV0dXJuIGEgdW5pcXVlIGlkZW50aWZpZXIsIHN1Y2ggYXMgYFwiSmp3amc2Z291V0xYaE1HS1dcImAsIHRoYXQgaXNcbiAqIGxpa2VseSB0byBiZSB1bmlxdWUgaW4gdGhlIHdob2xlIHdvcmxkLlxuICogQGxvY3VzIEFueXdoZXJlXG4gKiBAcGFyYW0ge051bWJlcn0gW25dIE9wdGlvbmFsIGxlbmd0aCBvZiB0aGUgaWRlbnRpZmllciBpbiBjaGFyYWN0ZXJzXG4gKiAgIChkZWZhdWx0cyB0byAxNylcbiAqL1xuUmFuZG9tR2VuZXJhdG9yLnByb3RvdHlwZS5pZCA9IGZ1bmN0aW9uIChjaGFyc0NvdW50KSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgLy8gMTcgY2hhcmFjdGVycyBpcyBhcm91bmQgOTYgYml0cyBvZiBlbnRyb3B5LCB3aGljaCBpcyB0aGUgYW1vdW50IG9mXG4gIC8vIHN0YXRlIGluIHRoZSBBbGVhIFBSTkcuXG4gIGlmIChjaGFyc0NvdW50ID09PSB1bmRlZmluZWQpXG4gICAgY2hhcnNDb3VudCA9IDE3O1xuXG4gIHJldHVybiBzZWxmLl9yYW5kb21TdHJpbmcoY2hhcnNDb3VudCwgVU5NSVNUQUtBQkxFX0NIQVJTKTtcbn07XG5cbi8qKlxuICogQG5hbWUgUmFuZG9tLnNlY3JldFxuICogQHN1bW1hcnkgUmV0dXJuIGEgcmFuZG9tIHN0cmluZyBvZiBwcmludGFibGUgY2hhcmFjdGVycyB3aXRoIDYgYml0cyBvZlxuICogZW50cm9weSBwZXIgY2hhcmFjdGVyLiBVc2UgYFJhbmRvbS5zZWNyZXRgIGZvciBzZWN1cml0eS1jcml0aWNhbCBzZWNyZXRzXG4gKiB0aGF0IGFyZSBpbnRlbmRlZCBmb3IgbWFjaGluZSwgcmF0aGVyIHRoYW4gaHVtYW4sIGNvbnN1bXB0aW9uLlxuICogQGxvY3VzIEFueXdoZXJlXG4gKiBAcGFyYW0ge051bWJlcn0gW25dIE9wdGlvbmFsIGxlbmd0aCBvZiB0aGUgc2VjcmV0IHN0cmluZyAoZGVmYXVsdHMgdG8gNDNcbiAqICAgY2hhcmFjdGVycywgb3IgMjU2IGJpdHMgb2YgZW50cm9weSlcbiAqL1xuUmFuZG9tR2VuZXJhdG9yLnByb3RvdHlwZS5zZWNyZXQgPSBmdW5jdGlvbiAoY2hhcnNDb3VudCkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIC8vIERlZmF1bHQgdG8gMjU2IGJpdHMgb2YgZW50cm9weSwgb3IgNDMgY2hhcmFjdGVycyBhdCA2IGJpdHMgcGVyXG4gIC8vIGNoYXJhY3Rlci5cbiAgaWYgKGNoYXJzQ291bnQgPT09IHVuZGVmaW5lZClcbiAgICBjaGFyc0NvdW50ID0gNDM7XG4gIHJldHVybiBzZWxmLl9yYW5kb21TdHJpbmcoY2hhcnNDb3VudCwgQkFTRTY0X0NIQVJTKTtcbn07XG5cbi8qKlxuICogQG5hbWUgUmFuZG9tLmNob2ljZVxuICogQHN1bW1hcnkgUmV0dXJuIGEgcmFuZG9tIGVsZW1lbnQgb2YgdGhlIGdpdmVuIGFycmF5IG9yIHN0cmluZy5cbiAqIEBsb2N1cyBBbnl3aGVyZVxuICogQHBhcmFtIHtBcnJheXxTdHJpbmd9IGFycmF5T3JTdHJpbmcgQXJyYXkgb3Igc3RyaW5nIHRvIGNob29zZSBmcm9tXG4gKi9cblJhbmRvbUdlbmVyYXRvci5wcm90b3R5cGUuY2hvaWNlID0gZnVuY3Rpb24gKGFycmF5T3JTdHJpbmcpIHtcbiAgdmFyIGluZGV4ID0gTWF0aC5mbG9vcih0aGlzLmZyYWN0aW9uKCkgKiBhcnJheU9yU3RyaW5nLmxlbmd0aCk7XG4gIGlmICh0eXBlb2YgYXJyYXlPclN0cmluZyA9PT0gXCJzdHJpbmdcIilcbiAgICByZXR1cm4gYXJyYXlPclN0cmluZy5zdWJzdHIoaW5kZXgsIDEpO1xuICBlbHNlXG4gICAgcmV0dXJuIGFycmF5T3JTdHJpbmdbaW5kZXhdO1xufTtcblxuLy8gaW5zdGFudGlhdGUgUk5HLiAgSGV1cmlzdGljYWxseSBjb2xsZWN0IGVudHJvcHkgZnJvbSB2YXJpb3VzIHNvdXJjZXMgd2hlbiBhXG4vLyBjcnlwdG9ncmFwaGljIFBSTkcgaXNuJ3QgYXZhaWxhYmxlLlxuXG4vLyBjbGllbnQgc291cmNlc1xudmFyIGhlaWdodCA9ICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiB3aW5kb3cuaW5uZXJIZWlnaHQpIHx8XG4gICAgICAodHlwZW9mIGRvY3VtZW50ICE9PSAndW5kZWZpbmVkJ1xuICAgICAgICYmIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudFxuICAgICAgICYmIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jbGllbnRIZWlnaHQpIHx8XG4gICAgICAodHlwZW9mIGRvY3VtZW50ICE9PSAndW5kZWZpbmVkJ1xuICAgICAgICYmIGRvY3VtZW50LmJvZHlcbiAgICAgICAmJiBkb2N1bWVudC5ib2R5LmNsaWVudEhlaWdodCkgfHxcbiAgICAgIDE7XG5cbnZhciB3aWR0aCA9ICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiB3aW5kb3cuaW5uZXJXaWR0aCkgfHxcbiAgICAgICh0eXBlb2YgZG9jdW1lbnQgIT09ICd1bmRlZmluZWQnXG4gICAgICAgJiYgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50XG4gICAgICAgJiYgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmNsaWVudFdpZHRoKSB8fFxuICAgICAgKHR5cGVvZiBkb2N1bWVudCAhPT0gJ3VuZGVmaW5lZCdcbiAgICAgICAmJiBkb2N1bWVudC5ib2R5XG4gICAgICAgJiYgZG9jdW1lbnQuYm9keS5jbGllbnRXaWR0aCkgfHxcbiAgICAgIDE7XG5cbnZhciBhZ2VudCA9ICh0eXBlb2YgbmF2aWdhdG9yICE9PSAndW5kZWZpbmVkJyAmJiBuYXZpZ2F0b3IudXNlckFnZW50KSB8fCBcIlwiO1xuXG5mdW5jdGlvbiBjcmVhdGVBbGVhR2VuZXJhdG9yV2l0aEdlbmVyYXRlZFNlZWQoKSB7XG4gIHJldHVybiBuZXcgUmFuZG9tR2VuZXJhdG9yKFxuICAgIFJhbmRvbUdlbmVyYXRvci5UeXBlLkFMRUEsXG4gICAge3NlZWRzOiBbbmV3IERhdGUsIGhlaWdodCwgd2lkdGgsIGFnZW50LCBNYXRoLnJhbmRvbSgpXX0pO1xufTtcblxuaWYgKE1ldGVvci5pc1NlcnZlcikge1xuICBSYW5kb20gPSBuZXcgUmFuZG9tR2VuZXJhdG9yKFJhbmRvbUdlbmVyYXRvci5UeXBlLk5PREVfQ1JZUFRPKTtcbn0gZWxzZSB7XG4gIGlmICh0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiICYmIHdpbmRvdy5jcnlwdG8gJiZcbiAgICAgIHdpbmRvdy5jcnlwdG8uZ2V0UmFuZG9tVmFsdWVzKSB7XG4gICAgUmFuZG9tID0gbmV3IFJhbmRvbUdlbmVyYXRvcihSYW5kb21HZW5lcmF0b3IuVHlwZS5CUk9XU0VSX0NSWVBUTyk7XG4gIH0gZWxzZSB7XG4gICAgLy8gT24gSUUgMTAgYW5kIGJlbG93LCB0aGVyZSdzIG5vIGJyb3dzZXIgY3J5cHRvIEFQSVxuICAgIC8vIGF2YWlsYWJsZS4gRmFsbCBiYWNrIHRvIEFsZWFcbiAgICAvL1xuICAgIC8vIFhYWCBsb29rcyBsaWtlIGF0IHRoZSBtb21lbnQsIHdlIHVzZSBBbGVhIGluIElFIDExIGFzIHdlbGwsXG4gICAgLy8gd2hpY2ggaGFzIGB3aW5kb3cubXNDcnlwdG9gIGluc3RlYWQgb2YgYHdpbmRvdy5jcnlwdG9gLlxuICAgIFJhbmRvbSA9IGNyZWF0ZUFsZWFHZW5lcmF0b3JXaXRoR2VuZXJhdGVkU2VlZCgpO1xuICB9XG59XG5cbi8vIENyZWF0ZSBhIG5vbi1jcnlwdG9ncmFwaGljYWxseSBzZWN1cmUgUFJORyB3aXRoIGEgZ2l2ZW4gc2VlZCAodXNpbmdcbi8vIHRoZSBBbGVhIGFsZ29yaXRobSlcblJhbmRvbS5jcmVhdGVXaXRoU2VlZHMgPSBmdW5jdGlvbiAoLi4uc2VlZHMpIHtcbiAgaWYgKHNlZWRzLmxlbmd0aCA9PT0gMCkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIk5vIHNlZWRzIHdlcmUgcHJvdmlkZWRcIik7XG4gIH1cbiAgcmV0dXJuIG5ldyBSYW5kb21HZW5lcmF0b3IoUmFuZG9tR2VuZXJhdG9yLlR5cGUuQUxFQSwge3NlZWRzOiBzZWVkc30pO1xufTtcblxuLy8gVXNlZCBsaWtlIGBSYW5kb21gLCBidXQgbXVjaCBmYXN0ZXIgYW5kIG5vdCBjcnlwdG9ncmFwaGljYWxseVxuLy8gc2VjdXJlXG5SYW5kb20uaW5zZWN1cmUgPSBjcmVhdGVBbGVhR2VuZXJhdG9yV2l0aEdlbmVyYXRlZFNlZWQoKTtcbiIsIi8vIEJlZm9yZSB0aGlzIHBhY2thZ2UgZXhpc3RlZCwgd2UgdXNlZCB0byB1c2UgdGhpcyBNZXRlb3IudXVpZCgpXG4vLyBpbXBsZW1lbnRpbmcgdGhlIFJGQyA0MTIyIHY0IFVVSUQuIEl0IGlzIG5vIGxvbmdlciBkb2N1bWVudGVkXG4vLyBhbmQgd2lsbCBnbyBhd2F5LlxuLy8gWFhYIENPTVBBVCBXSVRIIDAuNS42XG5NZXRlb3IudXVpZCA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIEhFWF9ESUdJVFMgPSBcIjAxMjM0NTY3ODlhYmNkZWZcIjtcbiAgdmFyIHMgPSBbXTtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCAzNjsgaSsrKSB7XG4gICAgc1tpXSA9IFJhbmRvbS5jaG9pY2UoSEVYX0RJR0lUUyk7XG4gIH1cbiAgc1sxNF0gPSBcIjRcIjtcbiAgc1sxOV0gPSBIRVhfRElHSVRTLnN1YnN0cigocGFyc2VJbnQoc1sxOV0sMTYpICYgMHgzKSB8IDB4OCwgMSk7XG4gIHNbOF0gPSBzWzEzXSA9IHNbMThdID0gc1syM10gPSBcIi1cIjtcblxuICB2YXIgdXVpZCA9IHMuam9pbihcIlwiKTtcbiAgcmV0dXJuIHV1aWQ7XG59O1xuIl19
