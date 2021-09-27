(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var ECMAScript = Package.ecmascript.ECMAScript;
var Random = Package.random.Random;
var meteorInstall = Package.modules.meteorInstall;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;
var Symbol = Package['ecmascript-runtime-server'].Symbol;
var Map = Package['ecmascript-runtime-server'].Map;
var Set = Package['ecmascript-runtime-server'].Set;

/* Package-scope variables */
var CachingCompilerBase, CachingCompiler, MultiFileCachingCompiler;

var require = meteorInstall({"node_modules":{"meteor":{"caching-compiler":{"caching-compiler.js":function(require){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                          //
// packages/caching-compiler/caching-compiler.js                                                            //
//                                                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                            //
var _possibleConstructorReturn2 = require("babel-runtime/helpers/possibleConstructorReturn");               //
                                                                                                            //
var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);                      //
                                                                                                            //
var _inherits2 = require("babel-runtime/helpers/inherits");                                                 //
                                                                                                            //
var _inherits3 = _interopRequireDefault(_inherits2);                                                        //
                                                                                                            //
var _typeof2 = require("babel-runtime/helpers/typeof");                                                     //
                                                                                                            //
var _typeof3 = _interopRequireDefault(_typeof2);                                                            //
                                                                                                            //
var _classCallCheck2 = require("babel-runtime/helpers/classCallCheck");                                     //
                                                                                                            //
var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);                                            //
                                                                                                            //
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }           //
                                                                                                            //
var fs = Plugin.fs;                                                                                         // 1
var path = Plugin.path;                                                                                     // 2
                                                                                                            //
var createHash = Npm.require('crypto').createHash;                                                          // 3
                                                                                                            //
var assert = Npm.require('assert');                                                                         // 4
                                                                                                            //
var Future = Npm.require('fibers/future');                                                                  // 5
                                                                                                            //
var LRU = Npm.require('lru-cache');                                                                         // 6
                                                                                                            //
var async = Npm.require('async'); // Base class for CachingCompiler and MultiFileCachingCompiler.           // 7
                                                                                                            //
                                                                                                            //
CachingCompilerBase = function () {                                                                         // 10
  function CachingCompilerBase(_ref) {                                                                      // 11
    var compilerName = _ref.compilerName,                                                                   // 15
        defaultCacheSize = _ref.defaultCacheSize,                                                           // 15
        _ref$maxParallelism = _ref.maxParallelism,                                                          // 15
        maxParallelism = _ref$maxParallelism === undefined ? 20 : _ref$maxParallelism;                      // 15
    (0, _classCallCheck3.default)(this, CachingCompilerBase);                                               // 15
    this._compilerName = compilerName;                                                                      // 16
    this._maxParallelism = maxParallelism;                                                                  // 17
    var envVarPrefix = 'METEOR_' + compilerName.toUpperCase() + '_CACHE_';                                  // 18
    var debugEnvVar = envVarPrefix + 'DEBUG';                                                               // 20
    this._cacheDebugEnabled = !!process.env[debugEnvVar];                                                   // 21
    var cacheSizeEnvVar = envVarPrefix + 'SIZE';                                                            // 23
    this._cacheSize = +process.env[cacheSizeEnvVar] || defaultCacheSize;                                    // 24
    this._diskCache = null; // For testing.                                                                 // 26
                                                                                                            //
    this._callCount = 0;                                                                                    // 29
  } // Your subclass must override this method to define the key used to identify                           // 30
  // a particular version of an InputFile.                                                                  // 33
  //                                                                                                        // 34
  // Given an InputFile (the data type passed to processFilesForTarget as part                              // 35
  // of the Plugin.registerCompiler API), returns a cache key that represents                               // 36
  // it. This cache key can be any JSON value (it will be converted internally                              // 37
  // into a hash).  This should reflect any aspect of the InputFile that affects                            // 38
  // the output of `compileOneFile`. Typically you'll want to include                                       // 39
  // `inputFile.getDeclaredExports()`, and perhaps                                                          // 40
  // `inputFile.getPathInPackage()` or `inputFile.getDeclaredExports` if                                    // 41
  // `compileOneFile` pays attention to them.                                                               // 42
  //                                                                                                        // 43
  // Note that for MultiFileCachingCompiler, your cache key doesn't need to                                 // 44
  // include the file's path, because that is automatically taken into account                              // 45
  // by the implementation. CachingCompiler subclasses can choose whether or not                            // 46
  // to include the file's path in the cache key.                                                           // 47
                                                                                                            //
                                                                                                            //
  CachingCompilerBase.prototype.getCacheKey = function () {                                                 // 10
    function getCacheKey(inputFile) {                                                                       // 10
      throw Error('CachingCompiler subclass should implement getCacheKey!');                                // 49
    }                                                                                                       // 50
                                                                                                            //
    return getCacheKey;                                                                                     // 10
  }(); // Your subclass must override this method to define how a CompileResult                             // 10
  // translates into adding assets to the bundle.                                                           // 53
  //                                                                                                        // 54
  // This method is given an InputFile (the data type passed to                                             // 55
  // processFilesForTarget as part of the Plugin.registerCompiler API) and a                                // 56
  // CompileResult (either returned directly from compileOneFile or read from                               // 57
  // the cache).  It should call methods like `inputFile.addJavaScript`                                     // 58
  // and `inputFile.error`.                                                                                 // 59
                                                                                                            //
                                                                                                            //
  CachingCompilerBase.prototype.addCompileResult = function () {                                            // 10
    function addCompileResult(inputFile, compileResult) {                                                   // 10
      throw Error('CachingCompiler subclass should implement addCompileResult!');                           // 61
    }                                                                                                       // 62
                                                                                                            //
    return addCompileResult;                                                                                // 10
  }(); // Your subclass must override this method to define the size of a                                   // 10
  // CompilerResult (used by the in-memory cache to limit the total amount of                               // 65
  // data cached).                                                                                          // 66
                                                                                                            //
                                                                                                            //
  CachingCompilerBase.prototype.compileResultSize = function () {                                           // 10
    function compileResultSize(compileResult) {                                                             // 10
      throw Error('CachingCompiler subclass should implement compileResultSize!');                          // 68
    }                                                                                                       // 69
                                                                                                            //
    return compileResultSize;                                                                               // 10
  }(); // Your subclass may override this method to define an alternate way of                              // 10
  // stringifying CompilerResults.  Takes a CompileResult and returns a string.                             // 72
                                                                                                            //
                                                                                                            //
  CachingCompilerBase.prototype.stringifyCompileResult = function () {                                      // 10
    function stringifyCompileResult(compileResult) {                                                        // 10
      return JSON.stringify(compileResult);                                                                 // 74
    }                                                                                                       // 75
                                                                                                            //
    return stringifyCompileResult;                                                                          // 10
  }(); // Your subclass may override this method to define an alternate way of                              // 10
  // parsing CompilerResults from string.  Takes a string and returns a                                     // 77
  // CompileResult.  If the string doesn't represent a valid CompileResult, you                             // 78
  // may want to return null instead of throwing, which will make                                           // 79
  // CachingCompiler ignore the cache.                                                                      // 80
                                                                                                            //
                                                                                                            //
  CachingCompilerBase.prototype.parseCompileResult = function () {                                          // 10
    function parseCompileResult(stringifiedCompileResult) {                                                 // 10
      return this._parseJSONOrNull(stringifiedCompileResult);                                               // 82
    }                                                                                                       // 83
                                                                                                            //
    return parseCompileResult;                                                                              // 10
  }();                                                                                                      // 10
                                                                                                            //
  CachingCompilerBase.prototype._parseJSONOrNull = function () {                                            // 10
    function _parseJSONOrNull(json) {                                                                       // 10
      try {                                                                                                 // 85
        return JSON.parse(json);                                                                            // 86
      } catch (e) {                                                                                         // 87
        if (e instanceof SyntaxError) return null;                                                          // 88
        throw e;                                                                                            // 90
      }                                                                                                     // 91
    }                                                                                                       // 92
                                                                                                            //
    return _parseJSONOrNull;                                                                                // 10
  }();                                                                                                      // 10
                                                                                                            //
  CachingCompilerBase.prototype._cacheDebug = function () {                                                 // 10
    function _cacheDebug(message) {                                                                         // 10
      if (!this._cacheDebugEnabled) return;                                                                 // 95
      console.log("CACHE(" + this._compilerName + "): " + message);                                         // 97
    }                                                                                                       // 98
                                                                                                            //
    return _cacheDebug;                                                                                     // 10
  }();                                                                                                      // 10
                                                                                                            //
  CachingCompilerBase.prototype.setDiskCacheDirectory = function () {                                       // 10
    function setDiskCacheDirectory(diskCache) {                                                             // 10
      if (this._diskCache) throw Error('setDiskCacheDirectory called twice?');                              // 101
      this._diskCache = diskCache;                                                                          // 103
    }                                                                                                       // 104
                                                                                                            //
    return setDiskCacheDirectory;                                                                           // 10
  }(); // Since so many compilers will need to calculate the size of a SourceMap in                         // 10
  // their compileResultSize, this method is provided.                                                      // 107
                                                                                                            //
                                                                                                            //
  CachingCompilerBase.prototype.sourceMapSize = function () {                                               // 10
    function sourceMapSize(sm) {                                                                            // 10
      if (!sm) return 0; // sum the length of sources and the mappings, the size of                         // 109
      // metadata is ignored, but it is not a big deal                                                      // 111
                                                                                                            //
      return sm.mappings.length + (sm.sourcesContent || []).reduce(function (soFar, current) {              // 112
        return soFar + (current ? current.length : 0);                                                      // 114
      }, 0);                                                                                                // 115
    }                                                                                                       // 116
                                                                                                            //
    return sourceMapSize;                                                                                   // 10
  }(); // Borrowed from another MIT-licensed project that benjamn wrote:                                    // 10
  // https://github.com/reactjs/commoner/blob/235d54a12c/lib/util.js#L136-L168                              // 119
                                                                                                            //
                                                                                                            //
  CachingCompilerBase.prototype._deepHash = function () {                                                   // 10
    function _deepHash(val) {                                                                               // 10
      var _this = this;                                                                                     // 120
                                                                                                            //
      var hash = createHash('sha1');                                                                        // 121
      var type = typeof val === "undefined" ? "undefined" : (0, _typeof3.default)(val);                     // 122
                                                                                                            //
      if (val === null) {                                                                                   // 124
        type = 'null';                                                                                      // 125
      }                                                                                                     // 126
                                                                                                            //
      hash.update(type + '\0');                                                                             // 127
                                                                                                            //
      switch (type) {                                                                                       // 129
        case 'object':                                                                                      // 130
          var keys = Object.keys(val); // Array keys will already be sorted.                                // 131
                                                                                                            //
          if (!Array.isArray(val)) {                                                                        // 134
            keys.sort();                                                                                    // 135
          }                                                                                                 // 136
                                                                                                            //
          keys.forEach(function (key) {                                                                     // 138
            if (typeof val[key] === 'function') {                                                           // 139
              // Silently ignore nested methods, but nevertheless complain below                            // 140
              // if the root value is a function.                                                           // 141
              return;                                                                                       // 142
            }                                                                                               // 143
                                                                                                            //
            hash.update(key + '\0').update(_this._deepHash(val[key]));                                      // 145
          });                                                                                               // 146
          break;                                                                                            // 148
                                                                                                            //
        case 'function':                                                                                    // 150
          assert.ok(false, 'cannot hash function objects');                                                 // 151
          break;                                                                                            // 152
                                                                                                            //
        default:                                                                                            // 154
          hash.update('' + val);                                                                            // 155
          break;                                                                                            // 156
      }                                                                                                     // 129
                                                                                                            //
      return hash.digest('hex');                                                                            // 159
    }                                                                                                       // 160
                                                                                                            //
    return _deepHash;                                                                                       // 10
  }(); // We want to write the file atomically. But we also don't want to block                             // 10
  // processing on the file write.                                                                          // 163
                                                                                                            //
                                                                                                            //
  CachingCompilerBase.prototype._writeFileAsync = function () {                                             // 10
    function _writeFileAsync(filename, contents) {                                                          // 10
      var tempFilename = filename + '.tmp.' + Random.id();                                                  // 165
                                                                                                            //
      if (this._cacheDebugEnabled) {                                                                        // 166
        // Write cache file synchronously when cache debugging enabled.                                     // 167
        try {                                                                                               // 168
          fs.writeFileSync(tempFilename, contents);                                                         // 169
          fs.renameSync(tempFilename, filename);                                                            // 170
        } catch (e) {// ignore errors, it's just a cache                                                    // 171
        }                                                                                                   // 173
      } else {                                                                                              // 174
        fs.writeFile(tempFilename, contents, function (err) {                                               // 175
          // ignore errors, it's just a cache                                                               // 176
          if (!err) {                                                                                       // 177
            fs.rename(tempFilename, filename, function (err) {});                                           // 178
          }                                                                                                 // 179
        });                                                                                                 // 180
      }                                                                                                     // 181
    }                                                                                                       // 182
                                                                                                            //
    return _writeFileAsync;                                                                                 // 10
  }(); // Helper function. Returns the body of the file as a string, or null if it                          // 10
  // doesn't exist.                                                                                         // 185
                                                                                                            //
                                                                                                            //
  CachingCompilerBase.prototype._readFileOrNull = function () {                                             // 10
    function _readFileOrNull(filename) {                                                                    // 10
      try {                                                                                                 // 187
        return fs.readFileSync(filename, 'utf8');                                                           // 188
      } catch (e) {                                                                                         // 189
        if (e && e.code === 'ENOENT') return null;                                                          // 190
        throw e;                                                                                            // 192
      }                                                                                                     // 193
    }                                                                                                       // 194
                                                                                                            //
    return _readFileOrNull;                                                                                 // 10
  }();                                                                                                      // 10
                                                                                                            //
  return CachingCompilerBase;                                                                               // 10
}(); // CachingCompiler is a class designed to be used with Plugin.registerCompiler                         // 10
// which implements in-memory and on-disk caches for the files that it                                      // 198
// processes.  You should subclass CachingCompiler and define the following                                 // 199
// methods: getCacheKey, compileOneFile, addCompileResult, and                                              // 200
// compileResultSize.                                                                                       // 201
//                                                                                                          // 202
// CachingCompiler assumes that files are processed independently of each other;                            // 203
// there is no 'import' directive allowing one file to reference another.  That                             // 204
// is, editing one file should only require that file to be rebuilt, not other                              // 205
// files.                                                                                                   // 206
//                                                                                                          // 207
// The data that is cached for each file is of a type that is (implicitly)                                  // 208
// defined by your subclass. CachingCompiler refers to this type as                                         // 209
// `CompileResult`, but this isn't a single type: it's up to your subclass to                               // 210
// decide what type of data this is.  You should document what your subclass's                              // 211
// CompileResult type is.                                                                                   // 212
//                                                                                                          // 213
// Your subclass's compiler should call the superclass compiler specifying the                              // 214
// compiler name (used to generate environment variables for debugging and                                  // 215
// tweaking in-memory cache size) and the default cache size.                                               // 216
//                                                                                                          // 217
// By default, CachingCompiler processes each file in "parallel". That is, if it                            // 218
// needs to yield to read from the disk cache, or if getCacheKey,                                           // 219
// compileOneFile, or addCompileResult yields, it will start processing the next                            // 220
// few files. To set how many files can be processed in parallel (including                                 // 221
// setting it to 1 if your subclass doesn't support any parallelism), pass the                              // 222
// maxParallelism option to the superclass constructor.                                                     // 223
//                                                                                                          // 224
// For example (using ES2015 via the ecmascript package):                                                   // 225
//                                                                                                          // 226
//   class AwesomeCompiler extends CachingCompiler {                                                        // 227
//     constructor() {                                                                                      // 228
//       super({                                                                                            // 229
//         compilerName: 'awesome',                                                                         // 230
//         defaultCacheSize: 1024*1024*10,                                                                  // 231
//       });                                                                                                // 232
//     }                                                                                                    // 233
//     // ... define the other methods                                                                      // 234
//   }                                                                                                      // 235
//   Plugin.registerCompile({                                                                               // 236
//     extensions: ['awesome'],                                                                             // 237
//   }, () => new AwesomeCompiler());                                                                       // 238
//                                                                                                          // 239
// XXX maybe compileResultSize and stringifyCompileResult should just be methods                            // 240
// on CompileResult? Sort of hard to do that with parseCompileResult.                                       // 241
                                                                                                            //
                                                                                                            //
CachingCompiler = function (_CachingCompilerBase) {                                                         // 242
  (0, _inherits3.default)(CachingCompiler, _CachingCompilerBase);                                           // 242
                                                                                                            //
  function CachingCompiler(_ref2) {                                                                         // 243
    var compilerName = _ref2.compilerName,                                                                  // 247
        defaultCacheSize = _ref2.defaultCacheSize,                                                          // 247
        _ref2$maxParallelism = _ref2.maxParallelism,                                                        // 247
        maxParallelism = _ref2$maxParallelism === undefined ? 20 : _ref2$maxParallelism;                    // 247
    (0, _classCallCheck3.default)(this, CachingCompiler);                                                   // 247
                                                                                                            //
    // Maps from a hashed cache key to a compileResult.                                                     // 250
    var _this2 = (0, _possibleConstructorReturn3.default)(this, _CachingCompilerBase.call(this, {           // 247
      compilerName: compilerName,                                                                           // 248
      defaultCacheSize: defaultCacheSize,                                                                   // 248
      maxParallelism: maxParallelism                                                                        // 248
    }));                                                                                                    // 248
                                                                                                            //
    _this2._cache = new LRU({                                                                               // 251
      max: _this2._cacheSize,                                                                               // 252
      length: function (value) {                                                                            // 253
        return _this2.compileResultSize(value);                                                             // 253
      }                                                                                                     // 253
    });                                                                                                     // 251
    return _this2;                                                                                          // 247
  } // Your subclass must override this method to define the transformation from                            // 255
  // InputFile to its cacheable CompileResult).                                                             // 258
  //                                                                                                        // 259
  // Given an InputFile (the data type passed to processFilesForTarget as part                              // 260
  // of the Plugin.registerCompiler API), compiles the file and returns a                                   // 261
  // CompileResult (the cacheable data type specific to your subclass).                                     // 262
  //                                                                                                        // 263
  // This method is not called on files when a valid cache entry exists in                                  // 264
  // memory or on disk.                                                                                     // 265
  //                                                                                                        // 266
  // On a compile error, you should call `inputFile.error` appropriately and                                // 267
  // return null; this will not be cached.                                                                  // 268
  //                                                                                                        // 269
  // This method should not call `inputFile.addJavaScript` and similar files!                               // 270
  // That's what addCompileResult is for.                                                                   // 271
                                                                                                            //
                                                                                                            //
  CachingCompiler.prototype.compileOneFile = function () {                                                  // 242
    function compileOneFile(inputFile) {                                                                    // 242
      throw Error('CachingCompiler subclass should implement compileOneFile!');                             // 273
    }                                                                                                       // 274
                                                                                                            //
    return compileOneFile;                                                                                  // 242
  }(); // The processFilesForTarget method from the Plugin.registerCompiler API. If                         // 242
  // you have processing you want to perform at the beginning or end of a                                   // 277
  // processing phase, you may want to override this method and call the                                    // 278
  // superclass implementation from within your method.                                                     // 279
                                                                                                            //
                                                                                                            //
  CachingCompiler.prototype.processFilesForTarget = function () {                                           // 242
    function processFilesForTarget(inputFiles) {                                                            // 242
      var _this3 = this;                                                                                    // 280
                                                                                                            //
      var cacheMisses = [];                                                                                 // 281
      var future = new Future();                                                                            // 283
      async.eachLimit(inputFiles, this._maxParallelism, function (inputFile, cb) {                          // 284
        var error = null;                                                                                   // 285
                                                                                                            //
        try {                                                                                               // 286
          var cacheKey = _this3._deepHash(_this3.getCacheKey(inputFile));                                   // 287
                                                                                                            //
          var compileResult = _this3._cache.get(cacheKey);                                                  // 288
                                                                                                            //
          if (!compileResult) {                                                                             // 290
            compileResult = _this3._readCache(cacheKey);                                                    // 291
                                                                                                            //
            if (compileResult) {                                                                            // 292
              _this3._cacheDebug("Loaded " + inputFile.getDisplayPath());                                   // 293
            }                                                                                               // 294
          }                                                                                                 // 295
                                                                                                            //
          if (!compileResult) {                                                                             // 297
            cacheMisses.push(inputFile.getDisplayPath());                                                   // 298
            compileResult = _this3.compileOneFile(inputFile);                                               // 299
                                                                                                            //
            if (!compileResult) {                                                                           // 301
              // compileOneFile should have called inputFile.error.                                         // 302
              //  We don't cache failures for now.                                                          // 303
              return;                                                                                       // 304
            } // Save what we've compiled.                                                                  // 305
                                                                                                            //
                                                                                                            //
            _this3._cache.set(cacheKey, compileResult);                                                     // 308
                                                                                                            //
            _this3._writeCacheAsync(cacheKey, compileResult);                                               // 309
          }                                                                                                 // 310
                                                                                                            //
          _this3.addCompileResult(inputFile, compileResult);                                                // 312
        } catch (e) {                                                                                       // 313
          error = e;                                                                                        // 314
        } finally {                                                                                         // 315
          cb(error);                                                                                        // 316
        }                                                                                                   // 317
      }, future.resolver());                                                                                // 318
      future.wait();                                                                                        // 319
                                                                                                            //
      if (this._cacheDebugEnabled) {                                                                        // 321
        cacheMisses.sort();                                                                                 // 322
                                                                                                            //
        this._cacheDebug("Ran (#" + ++this._callCount + ") on: " + JSON.stringify(cacheMisses));            // 323
      }                                                                                                     // 325
    }                                                                                                       // 326
                                                                                                            //
    return processFilesForTarget;                                                                           // 242
  }();                                                                                                      // 242
                                                                                                            //
  CachingCompiler.prototype._cacheFilename = function () {                                                  // 242
    function _cacheFilename(cacheKey) {                                                                     // 242
      // We want cacheKeys to be hex so that they work on any FS and never end in                           // 329
      // .cache.                                                                                            // 330
      if (!/^[a-f0-9]+$/.test(cacheKey)) {                                                                  // 331
        throw Error('bad cacheKey: ' + cacheKey);                                                           // 332
      }                                                                                                     // 333
                                                                                                            //
      return path.join(this._diskCache, cacheKey + '.cache');                                               // 334
    }                                                                                                       // 335
                                                                                                            //
    return _cacheFilename;                                                                                  // 242
  }(); // Load a cache entry from disk. Returns the compileResult object                                    // 242
  // and loads it into the in-memory cache too.                                                             // 337
                                                                                                            //
                                                                                                            //
  CachingCompiler.prototype._readCache = function () {                                                      // 242
    function _readCache(cacheKey) {                                                                         // 242
      if (!this._diskCache) {                                                                               // 339
        return null;                                                                                        // 340
      }                                                                                                     // 341
                                                                                                            //
      var cacheFilename = this._cacheFilename(cacheKey);                                                    // 342
                                                                                                            //
      var compileResult = this._readAndParseCompileResultOrNull(cacheFilename);                             // 343
                                                                                                            //
      if (!compileResult) {                                                                                 // 344
        return null;                                                                                        // 345
      }                                                                                                     // 346
                                                                                                            //
      this._cache.set(cacheKey, compileResult);                                                             // 347
                                                                                                            //
      return compileResult;                                                                                 // 348
    }                                                                                                       // 349
                                                                                                            //
    return _readCache;                                                                                      // 242
  }();                                                                                                      // 242
                                                                                                            //
  CachingCompiler.prototype._writeCacheAsync = function () {                                                // 242
    function _writeCacheAsync(cacheKey, compileResult) {                                                    // 242
      if (!this._diskCache) return;                                                                         // 351
                                                                                                            //
      var cacheFilename = this._cacheFilename(cacheKey);                                                    // 353
                                                                                                            //
      var cacheContents = this.stringifyCompileResult(compileResult);                                       // 354
                                                                                                            //
      this._writeFileAsync(cacheFilename, cacheContents);                                                   // 355
    }                                                                                                       // 356
                                                                                                            //
    return _writeCacheAsync;                                                                                // 242
  }(); // Returns null if the file does not exist or can't be parsed; otherwise                             // 242
  // returns the parsed compileResult in the file.                                                          // 359
                                                                                                            //
                                                                                                            //
  CachingCompiler.prototype._readAndParseCompileResultOrNull = function () {                                // 242
    function _readAndParseCompileResultOrNull(filename) {                                                   // 242
      var raw = this._readFileOrNull(filename);                                                             // 361
                                                                                                            //
      return this.parseCompileResult(raw);                                                                  // 362
    }                                                                                                       // 363
                                                                                                            //
    return _readAndParseCompileResultOrNull;                                                                // 242
  }();                                                                                                      // 242
                                                                                                            //
  return CachingCompiler;                                                                                   // 242
}(CachingCompilerBase);                                                                                     // 242
//////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"multi-file-caching-compiler.js":function(require){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                          //
// packages/caching-compiler/multi-file-caching-compiler.js                                                 //
//                                                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                            //
var _classCallCheck2 = require("babel-runtime/helpers/classCallCheck");                                     //
                                                                                                            //
var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);                                            //
                                                                                                            //
var _possibleConstructorReturn2 = require("babel-runtime/helpers/possibleConstructorReturn");               //
                                                                                                            //
var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);                      //
                                                                                                            //
var _inherits2 = require("babel-runtime/helpers/inherits");                                                 //
                                                                                                            //
var _inherits3 = _interopRequireDefault(_inherits2);                                                        //
                                                                                                            //
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }           //
                                                                                                            //
var path = Plugin.path;                                                                                     // 1
                                                                                                            //
var Future = Npm.require('fibers/future');                                                                  // 2
                                                                                                            //
var LRU = Npm.require('lru-cache');                                                                         // 3
                                                                                                            //
var async = Npm.require('async'); // MultiFileCachingCompiler is like CachingCompiler, but for implementing
// languages which allow files to reference each other, such as CSS                                         // 7
// preprocessors with `@import` directives.                                                                 // 8
//                                                                                                          // 9
// Like CachingCompiler, you should subclass MultiFileCachingCompiler and define                            // 10
// the following methods: getCacheKey, compileOneFile, addCompileResult, and                                // 11
// compileResultSize.  compileOneFile gets an additional allFiles argument and                              // 12
// returns an array of referenced import paths in addition to the CompileResult.                            // 13
// You may also override isRoot and getAbsoluteImportPath to customize                                      // 14
// MultiFileCachingCompiler further.                                                                        // 15
                                                                                                            //
                                                                                                            //
MultiFileCachingCompiler = function (_CachingCompilerBase) {                                                // 16
  (0, _inherits3.default)(MultiFileCachingCompiler, _CachingCompilerBase);                                  // 16
                                                                                                            //
  function MultiFileCachingCompiler(_ref) {                                                                 // 18
    var compilerName = _ref.compilerName,                                                                   // 22
        defaultCacheSize = _ref.defaultCacheSize,                                                           // 22
        maxParallelism = _ref.maxParallelism;                                                               // 22
    (0, _classCallCheck3.default)(this, MultiFileCachingCompiler);                                          // 22
                                                                                                            //
    // Maps from absolute import path to { compileResult, cacheKeys }, where                                // 25
    // cacheKeys is an object mapping from absolute import path to hashed                                   // 26
    // cacheKey for each file referenced by this file (including itself).                                   // 27
    var _this = (0, _possibleConstructorReturn3.default)(this, _CachingCompilerBase.call(this, {            // 22
      compilerName: compilerName,                                                                           // 23
      defaultCacheSize: defaultCacheSize,                                                                   // 23
      maxParallelism: maxParallelism                                                                        // 23
    }));                                                                                                    // 23
                                                                                                            //
    _this._cache = new LRU({                                                                                // 28
      max: _this._cacheSize,                                                                                // 29
      // We ignore the size of cacheKeys here.                                                              // 30
      length: function (value) {                                                                            // 31
        return _this.compileResultSize(value.compileResult);                                                // 31
      }                                                                                                     // 31
    });                                                                                                     // 28
    return _this;                                                                                           // 22
  } // Your subclass must override this method to define the transformation from                            // 33
  // InputFile to its cacheable CompileResult).                                                             // 36
  //                                                                                                        // 37
  // Arguments:                                                                                             // 38
  //   - inputFile is the InputFile to process                                                              // 39
  //   - allFiles is a a Map mapping from absolute import path to InputFile of                              // 40
  //     all files being processed in the target                                                            // 41
  // Returns an object with keys:                                                                           // 42
  //   - compileResult: the CompileResult (the cacheable data type specific to                              // 43
  //     your subclass).                                                                                    // 44
  //   - referencedImportPaths: an array of absolute import paths of files                                  // 45
  //     which were refererenced by the current file.  The current file                                     // 46
  //     is included implicitly.                                                                            // 47
  //                                                                                                        // 48
  // This method is not called on files when a valid cache entry exists in                                  // 49
  // memory or on disk.                                                                                     // 50
  //                                                                                                        // 51
  // On a compile error, you should call `inputFile.error` appropriately and                                // 52
  // return null; this will not be cached.                                                                  // 53
  //                                                                                                        // 54
  // This method should not call `inputFile.addJavaScript` and similar files!                               // 55
  // That's what addCompileResult is for.                                                                   // 56
                                                                                                            //
                                                                                                            //
  MultiFileCachingCompiler.prototype.compileOneFile = function () {                                         // 16
    function compileOneFile(inputFile, allFiles) {                                                          // 16
      throw Error('MultiFileCachingCompiler subclass should implement compileOneFile!');                    // 58
    }                                                                                                       // 60
                                                                                                            //
    return compileOneFile;                                                                                  // 16
  }(); // Your subclass may override this to declare that a file is not a "root" ---                        // 16
  // ie, it can be included from other files but is not processed on its own. In                            // 63
  // this case, MultiFileCachingCompiler won't waste time trying to look for a                              // 64
  // cache for its compilation on disk.                                                                     // 65
                                                                                                            //
                                                                                                            //
  MultiFileCachingCompiler.prototype.isRoot = function () {                                                 // 16
    function isRoot(inputFile) {                                                                            // 16
      return true;                                                                                          // 67
    }                                                                                                       // 68
                                                                                                            //
    return isRoot;                                                                                          // 16
  }(); // Returns the absolute import path for an InputFile. By default, this is a                          // 16
  // path is a path of the form "{package}/path/to/file" for files in packages                              // 71
  // and "{}/path/to/file" for files in apps. Your subclass may override and/or                             // 72
  // call this method.                                                                                      // 73
                                                                                                            //
                                                                                                            //
  MultiFileCachingCompiler.prototype.getAbsoluteImportPath = function () {                                  // 16
    function getAbsoluteImportPath(inputFile) {                                                             // 16
      if (inputFile.getPackageName() === null) {                                                            // 75
        return '{}/' + inputFile.getPathInPackage();                                                        // 76
      }                                                                                                     // 77
                                                                                                            //
      return '{' + inputFile.getPackageName() + '}/' + inputFile.getPathInPackage();                        // 78
    }                                                                                                       // 80
                                                                                                            //
    return getAbsoluteImportPath;                                                                           // 16
  }(); // The processFilesForTarget method from the Plugin.registerCompiler API.                            // 16
                                                                                                            //
                                                                                                            //
  MultiFileCachingCompiler.prototype.processFilesForTarget = function () {                                  // 16
    function processFilesForTarget(inputFiles) {                                                            // 16
      var _this2 = this;                                                                                    // 83
                                                                                                            //
      var allFiles = new Map();                                                                             // 84
      var cacheKeyMap = new Map();                                                                          // 85
      var cacheMisses = [];                                                                                 // 86
      inputFiles.forEach(function (inputFile) {                                                             // 88
        var importPath = _this2.getAbsoluteImportPath(inputFile);                                           // 89
                                                                                                            //
        allFiles.set(importPath, inputFile);                                                                // 90
        cacheKeyMap.set(importPath, _this2._deepHash(_this2.getCacheKey(inputFile)));                       // 91
      });                                                                                                   // 92
      var allProcessedFuture = new Future();                                                                // 94
      async.eachLimit(inputFiles, this._maxParallelism, function (inputFile, cb) {                          // 95
        var error = null;                                                                                   // 96
                                                                                                            //
        try {                                                                                               // 97
          // If this isn't a root, skip it (and definitely don't waste time                                 // 98
          // looking for a cache file that won't be there).                                                 // 99
          if (!_this2.isRoot(inputFile)) {                                                                  // 100
            return;                                                                                         // 101
          }                                                                                                 // 102
                                                                                                            //
          var absoluteImportPath = _this2.getAbsoluteImportPath(inputFile);                                 // 104
                                                                                                            //
          var cacheEntry = _this2._cache.get(absoluteImportPath);                                           // 105
                                                                                                            //
          if (!cacheEntry) {                                                                                // 106
            cacheEntry = _this2._readCache(absoluteImportPath);                                             // 107
                                                                                                            //
            if (cacheEntry) {                                                                               // 108
              _this2._cacheDebug("Loaded " + absoluteImportPath);                                           // 109
            }                                                                                               // 110
          }                                                                                                 // 111
                                                                                                            //
          if (!(cacheEntry && _this2._cacheEntryValid(cacheEntry, cacheKeyMap))) {                          // 112
            var _cacheKeys;                                                                                 // 112
                                                                                                            //
            cacheMisses.push(inputFile.getDisplayPath());                                                   // 113
                                                                                                            //
            var compileOneFileReturn = _this2.compileOneFile(inputFile, allFiles);                          // 115
                                                                                                            //
            if (!compileOneFileReturn) {                                                                    // 116
              // compileOneFile should have called inputFile.error.                                         // 117
              //  We don't cache failures for now.                                                          // 118
              return;                                                                                       // 119
            }                                                                                               // 120
                                                                                                            //
            var compileResult = compileOneFileReturn.compileResult,                                         // 112
                referencedImportPaths = compileOneFileReturn.referencedImportPaths;                         // 112
            cacheEntry = {                                                                                  // 123
              compileResult: compileResult,                                                                 // 124
              cacheKeys: (_cacheKeys = {}, _cacheKeys[absoluteImportPath] = cacheKeyMap.get(absoluteImportPath), _cacheKeys)
            }; // ... and of the other referenced files.                                                    // 123
                                                                                                            //
            referencedImportPaths.forEach(function (path) {                                                 // 132
              if (!cacheKeyMap.has(path)) {                                                                 // 133
                throw Error("Unknown absolute import path " + path);                                        // 134
              }                                                                                             // 135
                                                                                                            //
              cacheEntry.cacheKeys[path] = cacheKeyMap.get(path);                                           // 136
            }); // Save the cache entry.                                                                    // 137
                                                                                                            //
            _this2._cache.set(absoluteImportPath, cacheEntry);                                              // 140
                                                                                                            //
            _this2._writeCacheAsync(absoluteImportPath, cacheEntry);                                        // 141
          }                                                                                                 // 142
                                                                                                            //
          _this2.addCompileResult(inputFile, cacheEntry.compileResult);                                     // 144
        } catch (e) {                                                                                       // 145
          error = e;                                                                                        // 146
        } finally {                                                                                         // 147
          cb(error);                                                                                        // 148
        }                                                                                                   // 149
      }, allProcessedFuture.resolver());                                                                    // 150
      allProcessedFuture.wait();                                                                            // 151
                                                                                                            //
      if (this._cacheDebugEnabled) {                                                                        // 153
        cacheMisses.sort();                                                                                 // 154
                                                                                                            //
        this._cacheDebug("Ran (#" + ++this._callCount + ") on: " + JSON.stringify(cacheMisses));            // 155
      }                                                                                                     // 157
    }                                                                                                       // 158
                                                                                                            //
    return processFilesForTarget;                                                                           // 16
  }();                                                                                                      // 16
                                                                                                            //
  MultiFileCachingCompiler.prototype._cacheEntryValid = function () {                                       // 16
    function _cacheEntryValid(cacheEntry, cacheKeyMap) {                                                    // 16
      return Object.keys(cacheEntry.cacheKeys).every(function (path) {                                      // 161
        return cacheEntry.cacheKeys[path] === cacheKeyMap.get(path);                                        // 162
      });                                                                                                   // 162
    }                                                                                                       // 164
                                                                                                            //
    return _cacheEntryValid;                                                                                // 16
  }(); // The format of a cache file on disk is the JSON-stringified cacheKeys                              // 16
  // object, a newline, followed by the CompileResult as returned from                                      // 167
  // this.stringifyCompileResult.                                                                           // 168
                                                                                                            //
                                                                                                            //
  MultiFileCachingCompiler.prototype._cacheFilename = function () {                                         // 16
    function _cacheFilename(absoluteImportPath) {                                                           // 16
      return path.join(this._diskCache, this._deepHash(absoluteImportPath) + '.cache');                     // 170
    }                                                                                                       // 172
                                                                                                            //
    return _cacheFilename;                                                                                  // 16
  }(); // Loads a {compileResult, cacheKeys} cache entry from disk. Returns the whole                       // 16
  // cache entry and loads it into the in-memory cache too.                                                 // 174
                                                                                                            //
                                                                                                            //
  MultiFileCachingCompiler.prototype._readCache = function () {                                             // 16
    function _readCache(absoluteImportPath) {                                                               // 16
      if (!this._diskCache) {                                                                               // 176
        return null;                                                                                        // 177
      }                                                                                                     // 178
                                                                                                            //
      var cacheFilename = this._cacheFilename(absoluteImportPath);                                          // 179
                                                                                                            //
      var raw = this._readFileOrNull(cacheFilename);                                                        // 180
                                                                                                            //
      if (!raw) {                                                                                           // 181
        return null;                                                                                        // 182
      } // Split on newline.                                                                                // 183
                                                                                                            //
                                                                                                            //
      var newlineIndex = raw.indexOf('\n');                                                                 // 186
                                                                                                            //
      if (newlineIndex === -1) {                                                                            // 187
        return null;                                                                                        // 188
      }                                                                                                     // 189
                                                                                                            //
      var cacheKeysString = raw.substring(0, newlineIndex);                                                 // 190
      var compileResultString = raw.substring(newlineIndex + 1);                                            // 191
                                                                                                            //
      var cacheKeys = this._parseJSONOrNull(cacheKeysString);                                               // 193
                                                                                                            //
      if (!cacheKeys) {                                                                                     // 194
        return null;                                                                                        // 195
      }                                                                                                     // 196
                                                                                                            //
      var compileResult = this.parseCompileResult(compileResultString);                                     // 197
                                                                                                            //
      if (!compileResult) {                                                                                 // 198
        return null;                                                                                        // 199
      }                                                                                                     // 200
                                                                                                            //
      var cacheEntry = {                                                                                    // 202
        compileResult: compileResult,                                                                       // 202
        cacheKeys: cacheKeys                                                                                // 202
      };                                                                                                    // 202
                                                                                                            //
      this._cache.set(absoluteImportPath, cacheEntry);                                                      // 203
                                                                                                            //
      return cacheEntry;                                                                                    // 204
    }                                                                                                       // 205
                                                                                                            //
    return _readCache;                                                                                      // 16
  }();                                                                                                      // 16
                                                                                                            //
  MultiFileCachingCompiler.prototype._writeCacheAsync = function () {                                       // 16
    function _writeCacheAsync(absoluteImportPath, cacheEntry) {                                             // 16
      if (!this._diskCache) {                                                                               // 207
        return null;                                                                                        // 208
      }                                                                                                     // 209
                                                                                                            //
      var cacheFilename = this._cacheFilename(absoluteImportPath);                                          // 210
                                                                                                            //
      var cacheContents = JSON.stringify(cacheEntry.cacheKeys) + '\n' + this.stringifyCompileResult(cacheEntry.compileResult);
                                                                                                            //
      this._writeFileAsync(cacheFilename, cacheContents);                                                   // 214
    }                                                                                                       // 215
                                                                                                            //
    return _writeCacheAsync;                                                                                // 16
  }();                                                                                                      // 16
                                                                                                            //
  return MultiFileCachingCompiler;                                                                          // 16
}(CachingCompilerBase);                                                                                     // 16
//////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/caching-compiler/caching-compiler.js");
require("./node_modules/meteor/caching-compiler/multi-file-caching-compiler.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
(function (pkg, symbols) {
  for (var s in symbols)
    (s in pkg) || (pkg[s] = symbols[s]);
})(Package['caching-compiler'] = {}, {
  CachingCompiler: CachingCompiler,
  MultiFileCachingCompiler: MultiFileCachingCompiler
});

})();





//# sourceURL=meteor://💻app/packages/caching-compiler.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvY2FjaGluZy1jb21waWxlci9jYWNoaW5nLWNvbXBpbGVyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9jYWNoaW5nLWNvbXBpbGVyL211bHRpLWZpbGUtY2FjaGluZy1jb21waWxlci5qcyJdLCJuYW1lcyI6WyJmcyIsIlBsdWdpbiIsInBhdGgiLCJjcmVhdGVIYXNoIiwiTnBtIiwicmVxdWlyZSIsImFzc2VydCIsIkZ1dHVyZSIsIkxSVSIsImFzeW5jIiwiQ2FjaGluZ0NvbXBpbGVyQmFzZSIsImNvbXBpbGVyTmFtZSIsImRlZmF1bHRDYWNoZVNpemUiLCJtYXhQYXJhbGxlbGlzbSIsIl9jb21waWxlck5hbWUiLCJfbWF4UGFyYWxsZWxpc20iLCJlbnZWYXJQcmVmaXgiLCJ0b1VwcGVyQ2FzZSIsImRlYnVnRW52VmFyIiwiX2NhY2hlRGVidWdFbmFibGVkIiwicHJvY2VzcyIsImVudiIsImNhY2hlU2l6ZUVudlZhciIsIl9jYWNoZVNpemUiLCJfZGlza0NhY2hlIiwiX2NhbGxDb3VudCIsImdldENhY2hlS2V5IiwiaW5wdXRGaWxlIiwiRXJyb3IiLCJhZGRDb21waWxlUmVzdWx0IiwiY29tcGlsZVJlc3VsdCIsImNvbXBpbGVSZXN1bHRTaXplIiwic3RyaW5naWZ5Q29tcGlsZVJlc3VsdCIsIkpTT04iLCJzdHJpbmdpZnkiLCJwYXJzZUNvbXBpbGVSZXN1bHQiLCJzdHJpbmdpZmllZENvbXBpbGVSZXN1bHQiLCJfcGFyc2VKU09OT3JOdWxsIiwianNvbiIsInBhcnNlIiwiZSIsIlN5bnRheEVycm9yIiwiX2NhY2hlRGVidWciLCJtZXNzYWdlIiwiY29uc29sZSIsImxvZyIsInNldERpc2tDYWNoZURpcmVjdG9yeSIsImRpc2tDYWNoZSIsInNvdXJjZU1hcFNpemUiLCJzbSIsIm1hcHBpbmdzIiwibGVuZ3RoIiwic291cmNlc0NvbnRlbnQiLCJyZWR1Y2UiLCJzb0ZhciIsImN1cnJlbnQiLCJfZGVlcEhhc2giLCJ2YWwiLCJoYXNoIiwidHlwZSIsInVwZGF0ZSIsImtleXMiLCJPYmplY3QiLCJBcnJheSIsImlzQXJyYXkiLCJzb3J0IiwiZm9yRWFjaCIsImtleSIsIm9rIiwiZGlnZXN0IiwiX3dyaXRlRmlsZUFzeW5jIiwiZmlsZW5hbWUiLCJjb250ZW50cyIsInRlbXBGaWxlbmFtZSIsIlJhbmRvbSIsImlkIiwid3JpdGVGaWxlU3luYyIsInJlbmFtZVN5bmMiLCJ3cml0ZUZpbGUiLCJlcnIiLCJyZW5hbWUiLCJfcmVhZEZpbGVPck51bGwiLCJyZWFkRmlsZVN5bmMiLCJjb2RlIiwiQ2FjaGluZ0NvbXBpbGVyIiwiX2NhY2hlIiwibWF4IiwidmFsdWUiLCJjb21waWxlT25lRmlsZSIsInByb2Nlc3NGaWxlc0ZvclRhcmdldCIsImlucHV0RmlsZXMiLCJjYWNoZU1pc3NlcyIsImZ1dHVyZSIsImVhY2hMaW1pdCIsImNiIiwiZXJyb3IiLCJjYWNoZUtleSIsImdldCIsIl9yZWFkQ2FjaGUiLCJnZXREaXNwbGF5UGF0aCIsInB1c2giLCJzZXQiLCJfd3JpdGVDYWNoZUFzeW5jIiwicmVzb2x2ZXIiLCJ3YWl0IiwiX2NhY2hlRmlsZW5hbWUiLCJ0ZXN0Iiwiam9pbiIsImNhY2hlRmlsZW5hbWUiLCJfcmVhZEFuZFBhcnNlQ29tcGlsZVJlc3VsdE9yTnVsbCIsImNhY2hlQ29udGVudHMiLCJyYXciLCJNdWx0aUZpbGVDYWNoaW5nQ29tcGlsZXIiLCJhbGxGaWxlcyIsImlzUm9vdCIsImdldEFic29sdXRlSW1wb3J0UGF0aCIsImdldFBhY2thZ2VOYW1lIiwiZ2V0UGF0aEluUGFja2FnZSIsIk1hcCIsImNhY2hlS2V5TWFwIiwiaW1wb3J0UGF0aCIsImFsbFByb2Nlc3NlZEZ1dHVyZSIsImFic29sdXRlSW1wb3J0UGF0aCIsImNhY2hlRW50cnkiLCJfY2FjaGVFbnRyeVZhbGlkIiwiY29tcGlsZU9uZUZpbGVSZXR1cm4iLCJyZWZlcmVuY2VkSW1wb3J0UGF0aHMiLCJjYWNoZUtleXMiLCJoYXMiLCJldmVyeSIsIm5ld2xpbmVJbmRleCIsImluZGV4T2YiLCJjYWNoZUtleXNTdHJpbmciLCJzdWJzdHJpbmciLCJjb21waWxlUmVzdWx0U3RyaW5nIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLElBQU1BLEtBQUtDLE9BQU9ELEVBQWxCO0FBQ0EsSUFBTUUsT0FBT0QsT0FBT0MsSUFBcEI7O0FBQ0EsSUFBTUMsYUFBYUMsSUFBSUMsT0FBSixDQUFZLFFBQVosRUFBc0JGLFVBQXpDOztBQUNBLElBQU1HLFNBQVNGLElBQUlDLE9BQUosQ0FBWSxRQUFaLENBQWY7O0FBQ0EsSUFBTUUsU0FBU0gsSUFBSUMsT0FBSixDQUFZLGVBQVosQ0FBZjs7QUFDQSxJQUFNRyxNQUFNSixJQUFJQyxPQUFKLENBQVksV0FBWixDQUFaOztBQUNBLElBQU1JLFFBQVFMLElBQUlDLE9BQUosQ0FBWSxPQUFaLENBQWQsQyxDQUVBOzs7QUFDQUs7QUFDRSxxQ0FJRztBQUFBLFFBSERDLFlBR0MsUUFIREEsWUFHQztBQUFBLFFBRkRDLGdCQUVDLFFBRkRBLGdCQUVDO0FBQUEsbUNBRERDLGNBQ0M7QUFBQSxRQUREQSxjQUNDLHVDQURnQixFQUNoQjtBQUFBO0FBQ0QsU0FBS0MsYUFBTCxHQUFxQkgsWUFBckI7QUFDQSxTQUFLSSxlQUFMLEdBQXVCRixjQUF2QjtBQUNBLFFBQU1HLGVBQWUsWUFBWUwsYUFBYU0sV0FBYixFQUFaLEdBQXlDLFNBQTlEO0FBRUEsUUFBTUMsY0FBY0YsZUFBZSxPQUFuQztBQUNBLFNBQUtHLGtCQUFMLEdBQTBCLENBQUMsQ0FBRUMsUUFBUUMsR0FBUixDQUFZSCxXQUFaLENBQTdCO0FBRUEsUUFBTUksa0JBQWtCTixlQUFlLE1BQXZDO0FBQ0EsU0FBS08sVUFBTCxHQUFrQixDQUFDSCxRQUFRQyxHQUFSLENBQVlDLGVBQVosQ0FBRCxJQUFpQ1YsZ0JBQW5EO0FBRUEsU0FBS1ksVUFBTCxHQUFrQixJQUFsQixDQVhDLENBYUQ7O0FBQ0EsU0FB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QUExQixJQUF1QyxJQUF2QyxHQUNFLEtBQUsvRixzQkFBTCxDQUE0QjJGLFdBQVc3RixhQUF2QyxDQUZWOztBQUdBLFdBQUt3QyxlQUFMLENBQXFCc0MsYUFBckIsRUFBb0NFLGFBQXBDO0FBQ0Q7O0FBdk1IO0FBQUE7O0FBQUE7QUFBQSxFQUNRcEcsbUJBRFIsNEYiLCJmaWxlIjoiL3BhY2thZ2VzL2NhY2hpbmctY29tcGlsZXIuanMiLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBmcyA9IFBsdWdpbi5mcztcbmNvbnN0IHBhdGggPSBQbHVnaW4ucGF0aDtcbmNvbnN0IGNyZWF0ZUhhc2ggPSBOcG0ucmVxdWlyZSgnY3J5cHRvJykuY3JlYXRlSGFzaDtcbmNvbnN0IGFzc2VydCA9IE5wbS5yZXF1aXJlKCdhc3NlcnQnKTtcbmNvbnN0IEZ1dHVyZSA9IE5wbS5yZXF1aXJlKCdmaWJlcnMvZnV0dXJlJyk7XG5jb25zdCBMUlUgPSBOcG0ucmVxdWlyZSgnbHJ1LWNhY2hlJyk7XG5jb25zdCBhc3luYyA9IE5wbS5yZXF1aXJlKCdhc3luYycpO1xuXG4vLyBCYXNlIGNsYXNzIGZvciBDYWNoaW5nQ29tcGlsZXIgYW5kIE11bHRpRmlsZUNhY2hpbmdDb21waWxlci5cbkNhY2hpbmdDb21waWxlckJhc2UgPSBjbGFzcyBDYWNoaW5nQ29tcGlsZXJCYXNlIHtcbiAgY29uc3RydWN0b3Ioe1xuICAgIGNvbXBpbGVyTmFtZSxcbiAgICBkZWZhdWx0Q2FjaGVTaXplLFxuICAgIG1heFBhcmFsbGVsaXNtID0gMjAsXG4gIH0pIHtcbiAgICB0aGlzLl9jb21waWxlck5hbWUgPSBjb21waWxlck5hbWU7XG4gICAgdGhpcy5fbWF4UGFyYWxsZWxpc20gPSBtYXhQYXJhbGxlbGlzbTtcbiAgICBjb25zdCBlbnZWYXJQcmVmaXggPSAnTUVURU9SXycgKyBjb21waWxlck5hbWUudG9VcHBlckNhc2UoKSArICdfQ0FDSEVfJztcblxuICAgIGNvbnN0IGRlYnVnRW52VmFyID0gZW52VmFyUHJlZml4ICsgJ0RFQlVHJztcbiAgICB0aGlzLl9jYWNoZURlYnVnRW5hYmxlZCA9ICEhIHByb2Nlc3MuZW52W2RlYnVnRW52VmFyXTtcblxuICAgIGNvbnN0IGNhY2hlU2l6ZUVudlZhciA9IGVudlZhclByZWZpeCArICdTSVpFJztcbiAgICB0aGlzLl9jYWNoZVNpemUgPSArcHJvY2Vzcy5lbnZbY2FjaGVTaXplRW52VmFyXSB8fCBkZWZhdWx0Q2FjaGVTaXplO1xuXG4gICAgdGhpcy5fZGlza0NhY2hlID0gbnVsbDtcblxuICAgIC8vIEZvciB0ZXN0aW5nLlxuICAgIHRoaXMuX2NhbGxDb3VudCA9IDA7XG4gIH1cblxuICAvLyBZb3VyIHN1YmNsYXNzIG11c3Qgb3ZlcnJpZGUgdGhpcyBtZXRob2QgdG8gZGVmaW5lIHRoZSBrZXkgdXNlZCB0byBpZGVudGlmeVxuICAvLyBhIHBhcnRpY3VsYXIgdmVyc2lvbiBvZiBhbiBJbnB1dEZpbGUuXG4gIC8vXG4gIC8vIEdpdmVuIGFuIElucHV0RmlsZSAodGhlIGRhdGEgdHlwZSBwYXNzZWQgdG8gcHJvY2Vzc0ZpbGVzRm9yVGFyZ2V0IGFzIHBhcnRcbiAgLy8gb2YgdGhlIFBsdWdpbi5yZWdpc3RlckNvbXBpbGVyIEFQSSksIHJldHVybnMgYSBjYWNoZSBrZXkgdGhhdCByZXByZXNlbnRzXG4gIC8vIGl0LiBUaGlzIGNhY2hlIGtleSBjYW4gYmUgYW55IEpTT04gdmFsdWUgKGl0IHdpbGwgYmUgY29udmVydGVkIGludGVybmFsbHlcbiAgLy8gaW50byBhIGhhc2gpLiAgVGhpcyBzaG91bGQgcmVmbGVjdCBhbnkgYXNwZWN0IG9mIHRoZSBJbnB1dEZpbGUgdGhhdCBhZmZlY3RzXG4gIC8vIHRoZSBvdXRwdXQgb2YgYGNvbXBpbGVPbmVGaWxlYC4gVHlwaWNhbGx5IHlvdSdsbCB3YW50IHRvIGluY2x1ZGVcbiAgLy8gYGlucHV0RmlsZS5nZXREZWNsYXJlZEV4cG9ydHMoKWAsIGFuZCBwZXJoYXBzXG4gIC8vIGBpbnB1dEZpbGUuZ2V0UGF0aEluUGFja2FnZSgpYCBvciBgaW5wdXRGaWxlLmdldERlY2xhcmVkRXhwb3J0c2AgaWZcbiAgLy8gYGNvbXBpbGVPbmVGaWxlYCBwYXlzIGF0dGVudGlvbiB0byB0aGVtLlxuICAvL1xuICAvLyBOb3RlIHRoYXQgZm9yIE11bHRpRmlsZUNhY2hpbmdDb21waWxlciwgeW91ciBjYWNoZSBrZXkgZG9lc24ndCBuZWVkIHRvXG4gIC8vIGluY2x1ZGUgdGhlIGZpbGUncyBwYXRoLCBiZWNhdXNlIHRoYXQgaXMgYXV0b21hdGljYWxseSB0YWtlbiBpbnRvIGFjY291bnRcbiAgLy8gYnkgdGhlIGltcGxlbWVudGF0aW9uLiBDYWNoaW5nQ29tcGlsZXIgc3ViY2xhc3NlcyBjYW4gY2hvb3NlIHdoZXRoZXIgb3Igbm90XG4gIC8vIHRvIGluY2x1ZGUgdGhlIGZpbGUncyBwYXRoIGluIHRoZSBjYWNoZSBrZXkuXG4gIGdldENhY2hlS2V5KGlucHV0RmlsZSkge1xuICAgIHRocm93IEVycm9yKCdDYWNoaW5nQ29tcGlsZXIgc3ViY2xhc3Mgc2hvdWxkIGltcGxlbWVudCBnZXRDYWNoZUtleSEnKTtcbiAgfVxuXG4gIC8vIFlvdXIgc3ViY2xhc3MgbXVzdCBvdmVycmlkZSB0aGlzIG1ldGhvZCB0byBkZWZpbmUgaG93IGEgQ29tcGlsZVJlc3VsdFxuICAvLyB0cmFuc2xhdGVzIGludG8gYWRkaW5nIGFzc2V0cyB0byB0aGUgYnVuZGxlLlxuICAvL1xuICAvLyBUaGlzIG1ldGhvZCBpcyBnaXZlbiBhbiBJbnB1dEZpbGUgKHRoZSBkYXRhIHR5cGUgcGFzc2VkIHRvXG4gIC8vIHByb2Nlc3NGaWxlc0ZvclRhcmdldCBhcyBwYXJ0IG9mIHRoZSBQbHVnaW4ucmVnaXN0ZXJDb21waWxlciBBUEkpIGFuZCBhXG4gIC8vIENvbXBpbGVSZXN1bHQgKGVpdGhlciByZXR1cm5lZCBkaXJlY3RseSBmcm9tIGNvbXBpbGVPbmVGaWxlIG9yIHJlYWQgZnJvbVxuICAvLyB0aGUgY2FjaGUpLiAgSXQgc2hvdWxkIGNhbGwgbWV0aG9kcyBsaWtlIGBpbnB1dEZpbGUuYWRkSmF2YVNjcmlwdGBcbiAgLy8gYW5kIGBpbnB1dEZpbGUuZXJyb3JgLlxuICBhZGRDb21waWxlUmVzdWx0KGlucHV0RmlsZSwgY29tcGlsZVJlc3VsdCkge1xuICAgIHRocm93IEVycm9yKCdDYWNoaW5nQ29tcGlsZXIgc3ViY2xhc3Mgc2hvdWxkIGltcGxlbWVudCBhZGRDb21waWxlUmVzdWx0IScpO1xuICB9XG5cbiAgLy8gWW91ciBzdWJjbGFzcyBtdXN0IG92ZXJyaWRlIHRoaXMgbWV0aG9kIHRvIGRlZmluZSB0aGUgc2l6ZSBvZiBhXG4gIC8vIENvbXBpbGVyUmVzdWx0ICh1c2VkIGJ5IHRoZSBpbi1tZW1vcnkgY2FjaGUgdG8gbGltaXQgdGhlIHRvdGFsIGFtb3VudCBvZlxuICAvLyBkYXRhIGNhY2hlZCkuXG4gIGNvbXBpbGVSZXN1bHRTaXplKGNvbXBpbGVSZXN1bHQpIHtcbiAgICB0aHJvdyBFcnJvcignQ2FjaGluZ0NvbXBpbGVyIHN1YmNsYXNzIHNob3VsZCBpbXBsZW1lbnQgY29tcGlsZVJlc3VsdFNpemUhJyk7XG4gIH1cblxuICAvLyBZb3VyIHN1YmNsYXNzIG1heSBvdmVycmlkZSB0aGlzIG1ldGhvZCB0byBkZWZpbmUgYW4gYWx0ZXJuYXRlIHdheSBvZlxuICAvLyBzdHJpbmdpZnlpbmcgQ29tcGlsZXJSZXN1bHRzLiAgVGFrZXMgYSBDb21waWxlUmVzdWx0IGFuZCByZXR1cm5zIGEgc3RyaW5nLlxuICBzdHJpbmdpZnlDb21waWxlUmVzdWx0KGNvbXBpbGVSZXN1bHQpIHtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoY29tcGlsZVJlc3VsdCk7XG4gIH1cbiAgLy8gWW91ciBzdWJjbGFzcyBtYXkgb3ZlcnJpZGUgdGhpcyBtZXRob2QgdG8gZGVmaW5lIGFuIGFsdGVybmF0ZSB3YXkgb2ZcbiAgLy8gcGFyc2luZyBDb21waWxlclJlc3VsdHMgZnJvbSBzdHJpbmcuICBUYWtlcyBhIHN0cmluZyBhbmQgcmV0dXJucyBhXG4gIC8vIENvbXBpbGVSZXN1bHQuICBJZiB0aGUgc3RyaW5nIGRvZXNuJ3QgcmVwcmVzZW50IGEgdmFsaWQgQ29tcGlsZVJlc3VsdCwgeW91XG4gIC8vIG1heSB3YW50IHRvIHJldHVybiBudWxsIGluc3RlYWQgb2YgdGhyb3dpbmcsIHdoaWNoIHdpbGwgbWFrZVxuICAvLyBDYWNoaW5nQ29tcGlsZXIgaWdub3JlIHRoZSBjYWNoZS5cbiAgcGFyc2VDb21waWxlUmVzdWx0KHN0cmluZ2lmaWVkQ29tcGlsZVJlc3VsdCkge1xuICAgIHJldHVybiB0aGlzLl9wYXJzZUpTT05Pck51bGwoc3RyaW5naWZpZWRDb21waWxlUmVzdWx0KTtcbiAgfVxuICBfcGFyc2VKU09OT3JOdWxsKGpzb24pIHtcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIEpTT04ucGFyc2UoanNvbik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgaWYgKGUgaW5zdGFuY2VvZiBTeW50YXhFcnJvcilcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB0aHJvdyBlO1xuICAgIH1cbiAgfVxuXG4gIF9jYWNoZURlYnVnKG1lc3NhZ2UpIHtcbiAgICBpZiAoIXRoaXMuX2NhY2hlRGVidWdFbmFibGVkKVxuICAgICAgcmV0dXJuO1xuICAgIGNvbnNvbGUubG9nKGBDQUNIRSgkeyB0aGlzLl9jb21waWxlck5hbWUgfSk6ICR7IG1lc3NhZ2UgfWApO1xuICB9XG5cbiAgc2V0RGlza0NhY2hlRGlyZWN0b3J5KGRpc2tDYWNoZSkge1xuICAgIGlmICh0aGlzLl9kaXNrQ2FjaGUpXG4gICAgICB0aHJvdyBFcnJvcignc2V0RGlza0NhY2hlRGlyZWN0b3J5IGNhbGxlZCB0d2ljZT8nKTtcbiAgICB0aGlzLl9kaXNrQ2FjaGUgPSBkaXNrQ2FjaGU7XG4gIH1cblxuICAvLyBTaW5jZSBzbyBtYW55IGNvbXBpbGVycyB3aWxsIG5lZWQgdG8gY2FsY3VsYXRlIHRoZSBzaXplIG9mIGEgU291cmNlTWFwIGluXG4gIC8vIHRoZWlyIGNvbXBpbGVSZXN1bHRTaXplLCB0aGlzIG1ldGhvZCBpcyBwcm92aWRlZC5cbiAgc291cmNlTWFwU2l6ZShzbSkge1xuICAgIGlmICghIHNtKSByZXR1cm4gMDtcbiAgICAvLyBzdW0gdGhlIGxlbmd0aCBvZiBzb3VyY2VzIGFuZCB0aGUgbWFwcGluZ3MsIHRoZSBzaXplIG9mXG4gICAgLy8gbWV0YWRhdGEgaXMgaWdub3JlZCwgYnV0IGl0IGlzIG5vdCBhIGJpZyBkZWFsXG4gICAgcmV0dXJuIHNtLm1hcHBpbmdzLmxlbmd0aFxuICAgICAgKyAoc20uc291cmNlc0NvbnRlbnQgfHwgW10pLnJlZHVjZShmdW5jdGlvbiAoc29GYXIsIGN1cnJlbnQpIHtcbiAgICAgICAgcmV0dXJuIHNvRmFyICsgKGN1cnJlbnQgPyBjdXJyZW50Lmxlbmd0aCA6IDApO1xuICAgICAgfSwgMCk7XG4gIH1cblxuICAvLyBCb3Jyb3dlZCBmcm9tIGFub3RoZXIgTUlULWxpY2Vuc2VkIHByb2plY3QgdGhhdCBiZW5qYW1uIHdyb3RlOlxuICAvLyBodHRwczovL2dpdGh1Yi5jb20vcmVhY3Rqcy9jb21tb25lci9ibG9iLzIzNWQ1NGExMmMvbGliL3V0aWwuanMjTDEzNi1MMTY4XG4gIF9kZWVwSGFzaCh2YWwpIHtcbiAgICBjb25zdCBoYXNoID0gY3JlYXRlSGFzaCgnc2hhMScpO1xuICAgIGxldCB0eXBlID0gdHlwZW9mIHZhbDtcblxuICAgIGlmICh2YWwgPT09IG51bGwpIHtcbiAgICAgIHR5cGUgPSAnbnVsbCc7XG4gICAgfVxuICAgIGhhc2gudXBkYXRlKHR5cGUgKyAnXFwwJyk7XG5cbiAgICBzd2l0Y2ggKHR5cGUpIHtcbiAgICBjYXNlICdvYmplY3QnOlxuICAgICAgY29uc3Qga2V5cyA9IE9iamVjdC5rZXlzKHZhbCk7XG5cbiAgICAgIC8vIEFycmF5IGtleXMgd2lsbCBhbHJlYWR5IGJlIHNvcnRlZC5cbiAgICAgIGlmICghIEFycmF5LmlzQXJyYXkodmFsKSkge1xuICAgICAgICBrZXlzLnNvcnQoKTtcbiAgICAgIH1cblxuICAgICAga2V5cy5mb3JFYWNoKChrZXkpID0+IHtcbiAgICAgICAgaWYgKHR5cGVvZiB2YWxba2V5XSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgIC8vIFNpbGVudGx5IGlnbm9yZSBuZXN0ZWQgbWV0aG9kcywgYnV0IG5ldmVydGhlbGVzcyBjb21wbGFpbiBiZWxvd1xuICAgICAgICAgIC8vIGlmIHRoZSByb290IHZhbHVlIGlzIGEgZnVuY3Rpb24uXG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaGFzaC51cGRhdGUoa2V5ICsgJ1xcMCcpLnVwZGF0ZSh0aGlzLl9kZWVwSGFzaCh2YWxba2V5XSkpO1xuICAgICAgfSk7XG5cbiAgICAgIGJyZWFrO1xuXG4gICAgY2FzZSAnZnVuY3Rpb24nOlxuICAgICAgYXNzZXJ0Lm9rKGZhbHNlLCAnY2Fubm90IGhhc2ggZnVuY3Rpb24gb2JqZWN0cycpO1xuICAgICAgYnJlYWs7XG5cbiAgICBkZWZhdWx0OlxuICAgICAgaGFzaC51cGRhdGUoJycgKyB2YWwpO1xuICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgcmV0dXJuIGhhc2guZGlnZXN0KCdoZXgnKTtcbiAgfVxuXG4gIC8vIFdlIHdhbnQgdG8gd3JpdGUgdGhlIGZpbGUgYXRvbWljYWxseS4gQnV0IHdlIGFsc28gZG9uJ3Qgd2FudCB0byBibG9ja1xuICAvLyBwcm9jZXNzaW5nIG9uIHRoZSBmaWxlIHdyaXRlLlxuICBfd3JpdGVGaWxlQXN5bmMoZmlsZW5hbWUsIGNvbnRlbnRzKSB7XG4gICAgY29uc3QgdGVtcEZpbGVuYW1lID0gZmlsZW5hbWUgKyAnLnRtcC4nICsgUmFuZG9tLmlkKCk7XG4gICAgaWYgKHRoaXMuX2NhY2hlRGVidWdFbmFibGVkKSB7XG4gICAgICAvLyBXcml0ZSBjYWNoZSBmaWxlIHN5bmNocm9ub3VzbHkgd2hlbiBjYWNoZSBkZWJ1Z2dpbmcgZW5hYmxlZC5cbiAgICAgIHRyeSB7XG4gICAgICAgIGZzLndyaXRlRmlsZVN5bmModGVtcEZpbGVuYW1lLCBjb250ZW50cyk7XG4gICAgICAgIGZzLnJlbmFtZVN5bmModGVtcEZpbGVuYW1lLCBmaWxlbmFtZSk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIC8vIGlnbm9yZSBlcnJvcnMsIGl0J3MganVzdCBhIGNhY2hlXG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGZzLndyaXRlRmlsZSh0ZW1wRmlsZW5hbWUsIGNvbnRlbnRzLCBlcnIgPT4ge1xuICAgICAgICAvLyBpZ25vcmUgZXJyb3JzLCBpdCdzIGp1c3QgYSBjYWNoZVxuICAgICAgICBpZiAoISBlcnIpIHtcbiAgICAgICAgICBmcy5yZW5hbWUodGVtcEZpbGVuYW1lLCBmaWxlbmFtZSwgZXJyID0+IHt9KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgLy8gSGVscGVyIGZ1bmN0aW9uLiBSZXR1cm5zIHRoZSBib2R5IG9mIHRoZSBmaWxlIGFzIGEgc3RyaW5nLCBvciBudWxsIGlmIGl0XG4gIC8vIGRvZXNuJ3QgZXhpc3QuXG4gIF9yZWFkRmlsZU9yTnVsbChmaWxlbmFtZSkge1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4gZnMucmVhZEZpbGVTeW5jKGZpbGVuYW1lLCAndXRmOCcpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGlmIChlICYmIGUuY29kZSA9PT0gJ0VOT0VOVCcpXG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgdGhyb3cgZTtcbiAgICB9XG4gIH1cbn1cblxuLy8gQ2FjaGluZ0NvbXBpbGVyIGlzIGEgY2xhc3MgZGVzaWduZWQgdG8gYmUgdXNlZCB3aXRoIFBsdWdpbi5yZWdpc3RlckNvbXBpbGVyXG4vLyB3aGljaCBpbXBsZW1lbnRzIGluLW1lbW9yeSBhbmQgb24tZGlzayBjYWNoZXMgZm9yIHRoZSBmaWxlcyB0aGF0IGl0XG4vLyBwcm9jZXNzZXMuICBZb3Ugc2hvdWxkIHN1YmNsYXNzIENhY2hpbmdDb21waWxlciBhbmQgZGVmaW5lIHRoZSBmb2xsb3dpbmdcbi8vIG1ldGhvZHM6IGdldENhY2hlS2V5LCBjb21waWxlT25lRmlsZSwgYWRkQ29tcGlsZVJlc3VsdCwgYW5kXG4vLyBjb21waWxlUmVzdWx0U2l6ZS5cbi8vXG4vLyBDYWNoaW5nQ29tcGlsZXIgYXNzdW1lcyB0aGF0IGZpbGVzIGFyZSBwcm9jZXNzZWQgaW5kZXBlbmRlbnRseSBvZiBlYWNoIG90aGVyO1xuLy8gdGhlcmUgaXMgbm8gJ2ltcG9ydCcgZGlyZWN0aXZlIGFsbG93aW5nIG9uZSBmaWxlIHRvIHJlZmVyZW5jZSBhbm90aGVyLiAgVGhhdFxuLy8gaXMsIGVkaXRpbmcgb25lIGZpbGUgc2hvdWxkIG9ubHkgcmVxdWlyZSB0aGF0IGZpbGUgdG8gYmUgcmVidWlsdCwgbm90IG90aGVyXG4vLyBmaWxlcy5cbi8vXG4vLyBUaGUgZGF0YSB0aGF0IGlzIGNhY2hlZCBmb3IgZWFjaCBmaWxlIGlzIG9mIGEgdHlwZSB0aGF0IGlzIChpbXBsaWNpdGx5KVxuLy8gZGVmaW5lZCBieSB5b3VyIHN1YmNsYXNzLiBDYWNoaW5nQ29tcGlsZXIgcmVmZXJzIHRvIHRoaXMgdHlwZSBhc1xuLy8gYENvbXBpbGVSZXN1bHRgLCBidXQgdGhpcyBpc24ndCBhIHNpbmdsZSB0eXBlOiBpdCdzIHVwIHRvIHlvdXIgc3ViY2xhc3MgdG9cbi8vIGRlY2lkZSB3aGF0IHR5cGUgb2YgZGF0YSB0aGlzIGlzLiAgWW91IHNob3VsZCBkb2N1bWVudCB3aGF0IHlvdXIgc3ViY2xhc3Mnc1xuLy8gQ29tcGlsZVJlc3VsdCB0eXBlIGlzLlxuLy9cbi8vIFlvdXIgc3ViY2xhc3MncyBjb21waWxlciBzaG91bGQgY2FsbCB0aGUgc3VwZXJjbGFzcyBjb21waWxlciBzcGVjaWZ5aW5nIHRoZVxuLy8gY29tcGlsZXIgbmFtZSAodXNlZCB0byBnZW5lcmF0ZSBlbnZpcm9ubWVudCB2YXJpYWJsZXMgZm9yIGRlYnVnZ2luZyBhbmRcbi8vIHR3ZWFraW5nIGluLW1lbW9yeSBjYWNoZSBzaXplKSBhbmQgdGhlIGRlZmF1bHQgY2FjaGUgc2l6ZS5cbi8vXG4vLyBCeSBkZWZhdWx0LCBDYWNoaW5nQ29tcGlsZXIgcHJvY2Vzc2VzIGVhY2ggZmlsZSBpbiBcInBhcmFsbGVsXCIuIFRoYXQgaXMsIGlmIGl0XG4vLyBuZWVkcyB0byB5aWVsZCB0byByZWFkIGZyb20gdGhlIGRpc2sgY2FjaGUsIG9yIGlmIGdldENhY2hlS2V5LFxuLy8gY29tcGlsZU9uZUZpbGUsIG9yIGFkZENvbXBpbGVSZXN1bHQgeWllbGRzLCBpdCB3aWxsIHN0YXJ0IHByb2Nlc3NpbmcgdGhlIG5leHRcbi8vIGZldyBmaWxlcy4gVG8gc2V0IGhvdyBtYW55IGZpbGVzIGNhbiBiZSBwcm9jZXNzZWQgaW4gcGFyYWxsZWwgKGluY2x1ZGluZ1xuLy8gc2V0dGluZyBpdCB0byAxIGlmIHlvdXIgc3ViY2xhc3MgZG9lc24ndCBzdXBwb3J0IGFueSBwYXJhbGxlbGlzbSksIHBhc3MgdGhlXG4vLyBtYXhQYXJhbGxlbGlzbSBvcHRpb24gdG8gdGhlIHN1cGVyY2xhc3MgY29uc3RydWN0b3IuXG4vL1xuLy8gRm9yIGV4YW1wbGUgKHVzaW5nIEVTMjAxNSB2aWEgdGhlIGVjbWFzY3JpcHQgcGFja2FnZSk6XG4vL1xuLy8gICBjbGFzcyBBd2Vzb21lQ29tcGlsZXIgZXh0ZW5kcyBDYWNoaW5nQ29tcGlsZXIge1xuLy8gICAgIGNvbnN0cnVjdG9yKCkge1xuLy8gICAgICAgc3VwZXIoe1xuLy8gICAgICAgICBjb21waWxlck5hbWU6ICdhd2Vzb21lJyxcbi8vICAgICAgICAgZGVmYXVsdENhY2hlU2l6ZTogMTAyNCoxMDI0KjEwLFxuLy8gICAgICAgfSk7XG4vLyAgICAgfVxuLy8gICAgIC8vIC4uLiBkZWZpbmUgdGhlIG90aGVyIG1ldGhvZHNcbi8vICAgfVxuLy8gICBQbHVnaW4ucmVnaXN0ZXJDb21waWxlKHtcbi8vICAgICBleHRlbnNpb25zOiBbJ2F3ZXNvbWUnXSxcbi8vICAgfSwgKCkgPT4gbmV3IEF3ZXNvbWVDb21waWxlcigpKTtcbi8vXG4vLyBYWFggbWF5YmUgY29tcGlsZVJlc3VsdFNpemUgYW5kIHN0cmluZ2lmeUNvbXBpbGVSZXN1bHQgc2hvdWxkIGp1c3QgYmUgbWV0aG9kc1xuLy8gb24gQ29tcGlsZVJlc3VsdD8gU29ydCBvZiBoYXJkIHRvIGRvIHRoYXQgd2l0aCBwYXJzZUNvbXBpbGVSZXN1bHQuXG5DYWNoaW5nQ29tcGlsZXIgPSBjbGFzcyBDYWNoaW5nQ29tcGlsZXIgZXh0ZW5kcyBDYWNoaW5nQ29tcGlsZXJCYXNlIHtcbiAgY29uc3RydWN0b3Ioe1xuICAgIGNvbXBpbGVyTmFtZSxcbiAgICBkZWZhdWx0Q2FjaGVTaXplLFxuICAgIG1heFBhcmFsbGVsaXNtID0gMjAsXG4gIH0pIHtcbiAgICBzdXBlcih7Y29tcGlsZXJOYW1lLCBkZWZhdWx0Q2FjaGVTaXplLCBtYXhQYXJhbGxlbGlzbX0pO1xuXG4gICAgLy8gTWFwcyBmcm9tIGEgaGFzaGVkIGNhY2hlIGtleSB0byBhIGNvbXBpbGVSZXN1bHQuXG4gICAgdGhpcy5fY2FjaGUgPSBuZXcgTFJVKHtcbiAgICAgIG1heDogdGhpcy5fY2FjaGVTaXplLFxuICAgICAgbGVuZ3RoOiAodmFsdWUpID0+IHRoaXMuY29tcGlsZVJlc3VsdFNpemUodmFsdWUpLFxuICAgIH0pO1xuICB9XG5cbiAgLy8gWW91ciBzdWJjbGFzcyBtdXN0IG92ZXJyaWRlIHRoaXMgbWV0aG9kIHRvIGRlZmluZSB0aGUgdHJhbnNmb3JtYXRpb24gZnJvbVxuICAvLyBJbnB1dEZpbGUgdG8gaXRzIGNhY2hlYWJsZSBDb21waWxlUmVzdWx0KS5cbiAgLy9cbiAgLy8gR2l2ZW4gYW4gSW5wdXRGaWxlICh0aGUgZGF0YSB0eXBlIHBhc3NlZCB0byBwcm9jZXNzRmlsZXNGb3JUYXJnZXQgYXMgcGFydFxuICAvLyBvZiB0aGUgUGx1Z2luLnJlZ2lzdGVyQ29tcGlsZXIgQVBJKSwgY29tcGlsZXMgdGhlIGZpbGUgYW5kIHJldHVybnMgYVxuICAvLyBDb21waWxlUmVzdWx0ICh0aGUgY2FjaGVhYmxlIGRhdGEgdHlwZSBzcGVjaWZpYyB0byB5b3VyIHN1YmNsYXNzKS5cbiAgLy9cbiAgLy8gVGhpcyBtZXRob2QgaXMgbm90IGNhbGxlZCBvbiBmaWxlcyB3aGVuIGEgdmFsaWQgY2FjaGUgZW50cnkgZXhpc3RzIGluXG4gIC8vIG1lbW9yeSBvciBvbiBkaXNrLlxuICAvL1xuICAvLyBPbiBhIGNvbXBpbGUgZXJyb3IsIHlvdSBzaG91bGQgY2FsbCBgaW5wdXRGaWxlLmVycm9yYCBhcHByb3ByaWF0ZWx5IGFuZFxuICAvLyByZXR1cm4gbnVsbDsgdGhpcyB3aWxsIG5vdCBiZSBjYWNoZWQuXG4gIC8vXG4gIC8vIFRoaXMgbWV0aG9kIHNob3VsZCBub3QgY2FsbCBgaW5wdXRGaWxlLmFkZEphdmFTY3JpcHRgIGFuZCBzaW1pbGFyIGZpbGVzIVxuICAvLyBUaGF0J3Mgd2hhdCBhZGRDb21waWxlUmVzdWx0IGlzIGZvci5cbiAgY29tcGlsZU9uZUZpbGUoaW5wdXRGaWxlKSB7XG4gICAgdGhyb3cgRXJyb3IoJ0NhY2hpbmdDb21waWxlciBzdWJjbGFzcyBzaG91bGQgaW1wbGVtZW50IGNvbXBpbGVPbmVGaWxlIScpO1xuICB9XG5cbiAgLy8gVGhlIHByb2Nlc3NGaWxlc0ZvclRhcmdldCBtZXRob2QgZnJvbSB0aGUgUGx1Z2luLnJlZ2lzdGVyQ29tcGlsZXIgQVBJLiBJZlxuICAvLyB5b3UgaGF2ZSBwcm9jZXNzaW5nIHlvdSB3YW50IHRvIHBlcmZvcm0gYXQgdGhlIGJlZ2lubmluZyBvciBlbmQgb2YgYVxuICAvLyBwcm9jZXNzaW5nIHBoYXNlLCB5b3UgbWF5IHdhbnQgdG8gb3ZlcnJpZGUgdGhpcyBtZXRob2QgYW5kIGNhbGwgdGhlXG4gIC8vIHN1cGVyY2xhc3MgaW1wbGVtZW50YXRpb24gZnJvbSB3aXRoaW4geW91ciBtZXRob2QuXG4gIHByb2Nlc3NGaWxlc0ZvclRhcmdldChpbnB1dEZpbGVzKSB7XG4gICAgY29uc3QgY2FjaGVNaXNzZXMgPSBbXTtcblxuICAgIGNvbnN0IGZ1dHVyZSA9IG5ldyBGdXR1cmU7XG4gICAgYXN5bmMuZWFjaExpbWl0KGlucHV0RmlsZXMsIHRoaXMuX21heFBhcmFsbGVsaXNtLCAoaW5wdXRGaWxlLCBjYikgPT4ge1xuICAgICAgbGV0IGVycm9yID0gbnVsbDtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGNhY2hlS2V5ID0gdGhpcy5fZGVlcEhhc2godGhpcy5nZXRDYWNoZUtleShpbnB1dEZpbGUpKTtcbiAgICAgICAgbGV0IGNvbXBpbGVSZXN1bHQgPSB0aGlzLl9jYWNoZS5nZXQoY2FjaGVLZXkpO1xuXG4gICAgICAgIGlmICghIGNvbXBpbGVSZXN1bHQpIHtcbiAgICAgICAgICBjb21waWxlUmVzdWx0ID0gdGhpcy5fcmVhZENhY2hlKGNhY2hlS2V5KTtcbiAgICAgICAgICBpZiAoY29tcGlsZVJlc3VsdCkge1xuICAgICAgICAgICAgdGhpcy5fY2FjaGVEZWJ1ZyhgTG9hZGVkICR7IGlucHV0RmlsZS5nZXREaXNwbGF5UGF0aCgpIH1gKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoISBjb21waWxlUmVzdWx0KSB7XG4gICAgICAgICAgY2FjaGVNaXNzZXMucHVzaChpbnB1dEZpbGUuZ2V0RGlzcGxheVBhdGgoKSk7XG4gICAgICAgICAgY29tcGlsZVJlc3VsdCA9IHRoaXMuY29tcGlsZU9uZUZpbGUoaW5wdXRGaWxlKTtcblxuICAgICAgICAgIGlmICghIGNvbXBpbGVSZXN1bHQpIHtcbiAgICAgICAgICAgIC8vIGNvbXBpbGVPbmVGaWxlIHNob3VsZCBoYXZlIGNhbGxlZCBpbnB1dEZpbGUuZXJyb3IuXG4gICAgICAgICAgICAvLyAgV2UgZG9uJ3QgY2FjaGUgZmFpbHVyZXMgZm9yIG5vdy5cbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBTYXZlIHdoYXQgd2UndmUgY29tcGlsZWQuXG4gICAgICAgICAgdGhpcy5fY2FjaGUuc2V0KGNhY2hlS2V5LCBjb21waWxlUmVzdWx0KTtcbiAgICAgICAgICB0aGlzLl93cml0ZUNhY2hlQXN5bmMoY2FjaGVLZXksIGNvbXBpbGVSZXN1bHQpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5hZGRDb21waWxlUmVzdWx0KGlucHV0RmlsZSwgY29tcGlsZVJlc3VsdCk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGVycm9yID0gZTtcbiAgICAgIH0gZmluYWxseSB7XG4gICAgICAgIGNiKGVycm9yKTtcbiAgICAgIH1cbiAgICB9LCBmdXR1cmUucmVzb2x2ZXIoKSk7XG4gICAgZnV0dXJlLndhaXQoKTtcblxuICAgIGlmICh0aGlzLl9jYWNoZURlYnVnRW5hYmxlZCkge1xuICAgICAgY2FjaGVNaXNzZXMuc29ydCgpO1xuICAgICAgdGhpcy5fY2FjaGVEZWJ1ZyhcbiAgICAgICAgYFJhbiAoIyR7ICsrdGhpcy5fY2FsbENvdW50IH0pIG9uOiAkeyBKU09OLnN0cmluZ2lmeShjYWNoZU1pc3NlcykgfWApO1xuICAgIH1cbiAgfVxuXG4gIF9jYWNoZUZpbGVuYW1lKGNhY2hlS2V5KSB7XG4gICAgLy8gV2Ugd2FudCBjYWNoZUtleXMgdG8gYmUgaGV4IHNvIHRoYXQgdGhleSB3b3JrIG9uIGFueSBGUyBhbmQgbmV2ZXIgZW5kIGluXG4gICAgLy8gLmNhY2hlLlxuICAgIGlmICghL15bYS1mMC05XSskLy50ZXN0KGNhY2hlS2V5KSkge1xuICAgICAgdGhyb3cgRXJyb3IoJ2JhZCBjYWNoZUtleTogJyArIGNhY2hlS2V5KTtcbiAgICB9XG4gICAgcmV0dXJuIHBhdGguam9pbih0aGlzLl9kaXNrQ2FjaGUsIGNhY2hlS2V5ICsgJy5jYWNoZScpO1xuICB9XG4gIC8vIExvYWQgYSBjYWNoZSBlbnRyeSBmcm9tIGRpc2suIFJldHVybnMgdGhlIGNvbXBpbGVSZXN1bHQgb2JqZWN0XG4gIC8vIGFuZCBsb2FkcyBpdCBpbnRvIHRoZSBpbi1tZW1vcnkgY2FjaGUgdG9vLlxuICBfcmVhZENhY2hlKGNhY2hlS2V5KSB7XG4gICAgaWYgKCEgdGhpcy5fZGlza0NhY2hlKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgY29uc3QgY2FjaGVGaWxlbmFtZSA9IHRoaXMuX2NhY2hlRmlsZW5hbWUoY2FjaGVLZXkpO1xuICAgIGNvbnN0IGNvbXBpbGVSZXN1bHQgPSB0aGlzLl9yZWFkQW5kUGFyc2VDb21waWxlUmVzdWx0T3JOdWxsKGNhY2hlRmlsZW5hbWUpO1xuICAgIGlmICghIGNvbXBpbGVSZXN1bHQpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICB0aGlzLl9jYWNoZS5zZXQoY2FjaGVLZXksIGNvbXBpbGVSZXN1bHQpO1xuICAgIHJldHVybiBjb21waWxlUmVzdWx0O1xuICB9XG4gIF93cml0ZUNhY2hlQXN5bmMoY2FjaGVLZXksIGNvbXBpbGVSZXN1bHQpIHtcbiAgICBpZiAoISB0aGlzLl9kaXNrQ2FjaGUpXG4gICAgICByZXR1cm47XG4gICAgY29uc3QgY2FjaGVGaWxlbmFtZSA9IHRoaXMuX2NhY2hlRmlsZW5hbWUoY2FjaGVLZXkpO1xuICAgIGNvbnN0IGNhY2hlQ29udGVudHMgPSB0aGlzLnN0cmluZ2lmeUNvbXBpbGVSZXN1bHQoY29tcGlsZVJlc3VsdCk7XG4gICAgdGhpcy5fd3JpdGVGaWxlQXN5bmMoY2FjaGVGaWxlbmFtZSwgY2FjaGVDb250ZW50cyk7XG4gIH1cblxuICAvLyBSZXR1cm5zIG51bGwgaWYgdGhlIGZpbGUgZG9lcyBub3QgZXhpc3Qgb3IgY2FuJ3QgYmUgcGFyc2VkOyBvdGhlcndpc2VcbiAgLy8gcmV0dXJucyB0aGUgcGFyc2VkIGNvbXBpbGVSZXN1bHQgaW4gdGhlIGZpbGUuXG4gIF9yZWFkQW5kUGFyc2VDb21waWxlUmVzdWx0T3JOdWxsKGZpbGVuYW1lKSB7XG4gICAgY29uc3QgcmF3ID0gdGhpcy5fcmVhZEZpbGVPck51bGwoZmlsZW5hbWUpO1xuICAgIHJldHVybiB0aGlzLnBhcnNlQ29tcGlsZVJlc3VsdChyYXcpO1xuICB9XG59XG4iLCJjb25zdCBwYXRoID0gUGx1Z2luLnBhdGg7XG5jb25zdCBGdXR1cmUgPSBOcG0ucmVxdWlyZSgnZmliZXJzL2Z1dHVyZScpO1xuY29uc3QgTFJVID0gTnBtLnJlcXVpcmUoJ2xydS1jYWNoZScpO1xuY29uc3QgYXN5bmMgPSBOcG0ucmVxdWlyZSgnYXN5bmMnKTtcblxuLy8gTXVsdGlGaWxlQ2FjaGluZ0NvbXBpbGVyIGlzIGxpa2UgQ2FjaGluZ0NvbXBpbGVyLCBidXQgZm9yIGltcGxlbWVudGluZ1xuLy8gbGFuZ3VhZ2VzIHdoaWNoIGFsbG93IGZpbGVzIHRvIHJlZmVyZW5jZSBlYWNoIG90aGVyLCBzdWNoIGFzIENTU1xuLy8gcHJlcHJvY2Vzc29ycyB3aXRoIGBAaW1wb3J0YCBkaXJlY3RpdmVzLlxuLy9cbi8vIExpa2UgQ2FjaGluZ0NvbXBpbGVyLCB5b3Ugc2hvdWxkIHN1YmNsYXNzIE11bHRpRmlsZUNhY2hpbmdDb21waWxlciBhbmQgZGVmaW5lXG4vLyB0aGUgZm9sbG93aW5nIG1ldGhvZHM6IGdldENhY2hlS2V5LCBjb21waWxlT25lRmlsZSwgYWRkQ29tcGlsZVJlc3VsdCwgYW5kXG4vLyBjb21waWxlUmVzdWx0U2l6ZS4gIGNvbXBpbGVPbmVGaWxlIGdldHMgYW4gYWRkaXRpb25hbCBhbGxGaWxlcyBhcmd1bWVudCBhbmRcbi8vIHJldHVybnMgYW4gYXJyYXkgb2YgcmVmZXJlbmNlZCBpbXBvcnQgcGF0aHMgaW4gYWRkaXRpb24gdG8gdGhlIENvbXBpbGVSZXN1bHQuXG4vLyBZb3UgbWF5IGFsc28gb3ZlcnJpZGUgaXNSb290IGFuZCBnZXRBYnNvbHV0ZUltcG9ydFBhdGggdG8gY3VzdG9taXplXG4vLyBNdWx0aUZpbGVDYWNoaW5nQ29tcGlsZXIgZnVydGhlci5cbk11bHRpRmlsZUNhY2hpbmdDb21waWxlciA9IGNsYXNzIE11bHRpRmlsZUNhY2hpbmdDb21waWxlclxuZXh0ZW5kcyBDYWNoaW5nQ29tcGlsZXJCYXNlIHtcbiAgY29uc3RydWN0b3Ioe1xuICAgIGNvbXBpbGVyTmFtZSxcbiAgICBkZWZhdWx0Q2FjaGVTaXplLFxuICAgIG1heFBhcmFsbGVsaXNtXG4gIH0pIHtcbiAgICBzdXBlcih7Y29tcGlsZXJOYW1lLCBkZWZhdWx0Q2FjaGVTaXplLCBtYXhQYXJhbGxlbGlzbX0pO1xuXG4gICAgLy8gTWFwcyBmcm9tIGFic29sdXRlIGltcG9ydCBwYXRoIHRvIHsgY29tcGlsZVJlc3VsdCwgY2FjaGVLZXlzIH0sIHdoZXJlXG4gICAgLy8gY2FjaGVLZXlzIGlzIGFuIG9iamVjdCBtYXBwaW5nIGZyb20gYWJzb2x1dGUgaW1wb3J0IHBhdGggdG8gaGFzaGVkXG4gICAgLy8gY2FjaGVLZXkgZm9yIGVhY2ggZmlsZSByZWZlcmVuY2VkIGJ5IHRoaXMgZmlsZSAoaW5jbHVkaW5nIGl0c2VsZikuXG4gICAgdGhpcy5fY2FjaGUgPSBuZXcgTFJVKHtcbiAgICAgIG1heDogdGhpcy5fY2FjaGVTaXplLFxuICAgICAgLy8gV2UgaWdub3JlIHRoZSBzaXplIG9mIGNhY2hlS2V5cyBoZXJlLlxuICAgICAgbGVuZ3RoOiAodmFsdWUpID0+IHRoaXMuY29tcGlsZVJlc3VsdFNpemUodmFsdWUuY29tcGlsZVJlc3VsdCksXG4gICAgfSk7XG4gIH1cblxuICAvLyBZb3VyIHN1YmNsYXNzIG11c3Qgb3ZlcnJpZGUgdGhpcyBtZXRob2QgdG8gZGVmaW5lIHRoZSB0cmFuc2Zvcm1hdGlvbiBmcm9tXG4gIC8vIElucHV0RmlsZSB0byBpdHMgY2FjaGVhYmxlIENvbXBpbGVSZXN1bHQpLlxuICAvL1xuICAvLyBBcmd1bWVudHM6XG4gIC8vICAgLSBpbnB1dEZpbGUgaXMgdGhlIElucHV0RmlsZSB0byBwcm9jZXNzXG4gIC8vICAgLSBhbGxGaWxlcyBpcyBhIGEgTWFwIG1hcHBpbmcgZnJvbSBhYnNvbHV0ZSBpbXBvcnQgcGF0aCB0byBJbnB1dEZpbGUgb2ZcbiAgLy8gICAgIGFsbCBmaWxlcyBiZWluZyBwcm9jZXNzZWQgaW4gdGhlIHRhcmdldFxuICAvLyBSZXR1cm5zIGFuIG9iamVjdCB3aXRoIGtleXM6XG4gIC8vICAgLSBjb21waWxlUmVzdWx0OiB0aGUgQ29tcGlsZVJlc3VsdCAodGhlIGNhY2hlYWJsZSBkYXRhIHR5cGUgc3BlY2lmaWMgdG9cbiAgLy8gICAgIHlvdXIgc3ViY2xhc3MpLlxuICAvLyAgIC0gcmVmZXJlbmNlZEltcG9ydFBhdGhzOiBhbiBhcnJheSBvZiBhYnNvbHV0ZSBpbXBvcnQgcGF0aHMgb2YgZmlsZXNcbiAgLy8gICAgIHdoaWNoIHdlcmUgcmVmZXJlcmVuY2VkIGJ5IHRoZSBjdXJyZW50IGZpbGUuICBUaGUgY3VycmVudCBmaWxlXG4gIC8vICAgICBpcyBpbmNsdWRlZCBpbXBsaWNpdGx5LlxuICAvL1xuICAvLyBUaGlzIG1ldGhvZCBpcyBub3QgY2FsbGVkIG9uIGZpbGVzIHdoZW4gYSB2YWxpZCBjYWNoZSBlbnRyeSBleGlzdHMgaW5cbiAgLy8gbWVtb3J5IG9yIG9uIGRpc2suXG4gIC8vXG4gIC8vIE9uIGEgY29tcGlsZSBlcnJvciwgeW91IHNob3VsZCBjYWxsIGBpbnB1dEZpbGUuZXJyb3JgIGFwcHJvcHJpYXRlbHkgYW5kXG4gIC8vIHJldHVybiBudWxsOyB0aGlzIHdpbGwgbm90IGJlIGNhY2hlZC5cbiAgLy9cbiAgLy8gVGhpcyBtZXRob2Qgc2hvdWxkIG5vdCBjYWxsIGBpbnB1dEZpbGUuYWRkSmF2YVNjcmlwdGAgYW5kIHNpbWlsYXIgZmlsZXMhXG4gIC8vIFRoYXQncyB3aGF0IGFkZENvbXBpbGVSZXN1bHQgaXMgZm9yLlxuICBjb21waWxlT25lRmlsZShpbnB1dEZpbGUsIGFsbEZpbGVzKSB7XG4gICAgdGhyb3cgRXJyb3IoXG4gICAgICAnTXVsdGlGaWxlQ2FjaGluZ0NvbXBpbGVyIHN1YmNsYXNzIHNob3VsZCBpbXBsZW1lbnQgY29tcGlsZU9uZUZpbGUhJyk7XG4gIH1cblxuICAvLyBZb3VyIHN1YmNsYXNzIG1heSBvdmVycmlkZSB0aGlzIHRvIGRlY2xhcmUgdGhhdCBhIGZpbGUgaXMgbm90IGEgXCJyb290XCIgLS0tXG4gIC8vIGllLCBpdCBjYW4gYmUgaW5jbHVkZWQgZnJvbSBvdGhlciBmaWxlcyBidXQgaXMgbm90IHByb2Nlc3NlZCBvbiBpdHMgb3duLiBJblxuICAvLyB0aGlzIGNhc2UsIE11bHRpRmlsZUNhY2hpbmdDb21waWxlciB3b24ndCB3YXN0ZSB0aW1lIHRyeWluZyB0byBsb29rIGZvciBhXG4gIC8vIGNhY2hlIGZvciBpdHMgY29tcGlsYXRpb24gb24gZGlzay5cbiAgaXNSb290KGlucHV0RmlsZSkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLy8gUmV0dXJucyB0aGUgYWJzb2x1dGUgaW1wb3J0IHBhdGggZm9yIGFuIElucHV0RmlsZS4gQnkgZGVmYXVsdCwgdGhpcyBpcyBhXG4gIC8vIHBhdGggaXMgYSBwYXRoIG9mIHRoZSBmb3JtIFwie3BhY2thZ2V9L3BhdGgvdG8vZmlsZVwiIGZvciBmaWxlcyBpbiBwYWNrYWdlc1xuICAvLyBhbmQgXCJ7fS9wYXRoL3RvL2ZpbGVcIiBmb3IgZmlsZXMgaW4gYXBwcy4gWW91ciBzdWJjbGFzcyBtYXkgb3ZlcnJpZGUgYW5kL29yXG4gIC8vIGNhbGwgdGhpcyBtZXRob2QuXG4gIGdldEFic29sdXRlSW1wb3J0UGF0aChpbnB1dEZpbGUpIHtcbiAgICBpZiAoaW5wdXRGaWxlLmdldFBhY2thZ2VOYW1lKCkgPT09IG51bGwpIHtcbiAgICAgIHJldHVybiAne30vJyArIGlucHV0RmlsZS5nZXRQYXRoSW5QYWNrYWdlKCk7XG4gICAgfVxuICAgIHJldHVybiAneycgKyBpbnB1dEZpbGUuZ2V0UGFja2FnZU5hbWUoKSArICd9LydcbiAgICAgICsgaW5wdXRGaWxlLmdldFBhdGhJblBhY2thZ2UoKTtcbiAgfVxuXG4gIC8vIFRoZSBwcm9jZXNzRmlsZXNGb3JUYXJnZXQgbWV0aG9kIGZyb20gdGhlIFBsdWdpbi5yZWdpc3RlckNvbXBpbGVyIEFQSS5cbiAgcHJvY2Vzc0ZpbGVzRm9yVGFyZ2V0KGlucHV0RmlsZXMpIHtcbiAgICBjb25zdCBhbGxGaWxlcyA9IG5ldyBNYXA7XG4gICAgY29uc3QgY2FjaGVLZXlNYXAgPSBuZXcgTWFwO1xuICAgIGNvbnN0IGNhY2hlTWlzc2VzID0gW107XG5cbiAgICBpbnB1dEZpbGVzLmZvckVhY2goKGlucHV0RmlsZSkgPT4ge1xuICAgICAgY29uc3QgaW1wb3J0UGF0aCA9IHRoaXMuZ2V0QWJzb2x1dGVJbXBvcnRQYXRoKGlucHV0RmlsZSk7XG4gICAgICBhbGxGaWxlcy5zZXQoaW1wb3J0UGF0aCwgaW5wdXRGaWxlKTtcbiAgICAgIGNhY2hlS2V5TWFwLnNldChpbXBvcnRQYXRoLCB0aGlzLl9kZWVwSGFzaCh0aGlzLmdldENhY2hlS2V5KGlucHV0RmlsZSkpKTtcbiAgICB9KTtcblxuICAgIGNvbnN0IGFsbFByb2Nlc3NlZEZ1dHVyZSA9IG5ldyBGdXR1cmU7XG4gICAgYXN5bmMuZWFjaExpbWl0KGlucHV0RmlsZXMsIHRoaXMuX21heFBhcmFsbGVsaXNtLCAoaW5wdXRGaWxlLCBjYikgPT4ge1xuICAgICAgbGV0IGVycm9yID0gbnVsbDtcbiAgICAgIHRyeSB7XG4gICAgICAgIC8vIElmIHRoaXMgaXNuJ3QgYSByb290LCBza2lwIGl0IChhbmQgZGVmaW5pdGVseSBkb24ndCB3YXN0ZSB0aW1lXG4gICAgICAgIC8vIGxvb2tpbmcgZm9yIGEgY2FjaGUgZmlsZSB0aGF0IHdvbid0IGJlIHRoZXJlKS5cbiAgICAgICAgaWYgKCF0aGlzLmlzUm9vdChpbnB1dEZpbGUpKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgYWJzb2x1dGVJbXBvcnRQYXRoID0gdGhpcy5nZXRBYnNvbHV0ZUltcG9ydFBhdGgoaW5wdXRGaWxlKTtcbiAgICAgICAgbGV0IGNhY2hlRW50cnkgPSB0aGlzLl9jYWNoZS5nZXQoYWJzb2x1dGVJbXBvcnRQYXRoKTtcbiAgICAgICAgaWYgKCEgY2FjaGVFbnRyeSkge1xuICAgICAgICAgIGNhY2hlRW50cnkgPSB0aGlzLl9yZWFkQ2FjaGUoYWJzb2x1dGVJbXBvcnRQYXRoKTtcbiAgICAgICAgICBpZiAoY2FjaGVFbnRyeSkge1xuICAgICAgICAgICAgdGhpcy5fY2FjaGVEZWJ1ZyhgTG9hZGVkICR7IGFic29sdXRlSW1wb3J0UGF0aCB9YCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmICghIChjYWNoZUVudHJ5ICYmIHRoaXMuX2NhY2hlRW50cnlWYWxpZChjYWNoZUVudHJ5LCBjYWNoZUtleU1hcCkpKSB7XG4gICAgICAgICAgY2FjaGVNaXNzZXMucHVzaChpbnB1dEZpbGUuZ2V0RGlzcGxheVBhdGgoKSk7XG5cbiAgICAgICAgICBjb25zdCBjb21waWxlT25lRmlsZVJldHVybiA9IHRoaXMuY29tcGlsZU9uZUZpbGUoaW5wdXRGaWxlLCBhbGxGaWxlcyk7XG4gICAgICAgICAgaWYgKCEgY29tcGlsZU9uZUZpbGVSZXR1cm4pIHtcbiAgICAgICAgICAgIC8vIGNvbXBpbGVPbmVGaWxlIHNob3VsZCBoYXZlIGNhbGxlZCBpbnB1dEZpbGUuZXJyb3IuXG4gICAgICAgICAgICAvLyAgV2UgZG9uJ3QgY2FjaGUgZmFpbHVyZXMgZm9yIG5vdy5cbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc3Qge2NvbXBpbGVSZXN1bHQsIHJlZmVyZW5jZWRJbXBvcnRQYXRoc30gPSBjb21waWxlT25lRmlsZVJldHVybjtcblxuICAgICAgICAgIGNhY2hlRW50cnkgPSB7XG4gICAgICAgICAgICBjb21waWxlUmVzdWx0LFxuICAgICAgICAgICAgY2FjaGVLZXlzOiB7XG4gICAgICAgICAgICAgIC8vIEluY2x1ZGUgdGhlIGhhc2hlZCBjYWNoZSBrZXkgb2YgdGhlIGZpbGUgaXRzZWxmLi4uXG4gICAgICAgICAgICAgIFthYnNvbHV0ZUltcG9ydFBhdGhdOiBjYWNoZUtleU1hcC5nZXQoYWJzb2x1dGVJbXBvcnRQYXRoKVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH07XG5cbiAgICAgICAgICAvLyAuLi4gYW5kIG9mIHRoZSBvdGhlciByZWZlcmVuY2VkIGZpbGVzLlxuICAgICAgICAgIHJlZmVyZW5jZWRJbXBvcnRQYXRocy5mb3JFYWNoKChwYXRoKSA9PiB7XG4gICAgICAgICAgICBpZiAoIWNhY2hlS2V5TWFwLmhhcyhwYXRoKSkge1xuICAgICAgICAgICAgICB0aHJvdyBFcnJvcihgVW5rbm93biBhYnNvbHV0ZSBpbXBvcnQgcGF0aCAkeyBwYXRoIH1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhY2hlRW50cnkuY2FjaGVLZXlzW3BhdGhdID0gY2FjaGVLZXlNYXAuZ2V0KHBhdGgpO1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgLy8gU2F2ZSB0aGUgY2FjaGUgZW50cnkuXG4gICAgICAgICAgdGhpcy5fY2FjaGUuc2V0KGFic29sdXRlSW1wb3J0UGF0aCwgY2FjaGVFbnRyeSk7XG4gICAgICAgICAgdGhpcy5fd3JpdGVDYWNoZUFzeW5jKGFic29sdXRlSW1wb3J0UGF0aCwgY2FjaGVFbnRyeSk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmFkZENvbXBpbGVSZXN1bHQoaW5wdXRGaWxlLCBjYWNoZUVudHJ5LmNvbXBpbGVSZXN1bHQpO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBlcnJvciA9IGU7XG4gICAgICB9IGZpbmFsbHkge1xuICAgICAgICBjYihlcnJvcik7XG4gICAgICB9XG4gICAgfSwgYWxsUHJvY2Vzc2VkRnV0dXJlLnJlc29sdmVyKCkpO1xuICAgIGFsbFByb2Nlc3NlZEZ1dHVyZS53YWl0KCk7XG5cbiAgICBpZiAodGhpcy5fY2FjaGVEZWJ1Z0VuYWJsZWQpIHtcbiAgICAgIGNhY2hlTWlzc2VzLnNvcnQoKTtcbiAgICAgIHRoaXMuX2NhY2hlRGVidWcoXG4gICAgICAgIGBSYW4gKCMkeyArK3RoaXMuX2NhbGxDb3VudCB9KSBvbjogJHsgSlNPTi5zdHJpbmdpZnkoY2FjaGVNaXNzZXMpIH1gKTtcbiAgICB9XG4gIH1cblxuICBfY2FjaGVFbnRyeVZhbGlkKGNhY2hlRW50cnksIGNhY2hlS2V5TWFwKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKGNhY2hlRW50cnkuY2FjaGVLZXlzKS5ldmVyeShcbiAgICAgIChwYXRoKSA9PiBjYWNoZUVudHJ5LmNhY2hlS2V5c1twYXRoXSA9PT0gY2FjaGVLZXlNYXAuZ2V0KHBhdGgpXG4gICAgKTtcbiAgfVxuXG4gIC8vIFRoZSBmb3JtYXQgb2YgYSBjYWNoZSBmaWxlIG9uIGRpc2sgaXMgdGhlIEpTT04tc3RyaW5naWZpZWQgY2FjaGVLZXlzXG4gIC8vIG9iamVjdCwgYSBuZXdsaW5lLCBmb2xsb3dlZCBieSB0aGUgQ29tcGlsZVJlc3VsdCBhcyByZXR1cm5lZCBmcm9tXG4gIC8vIHRoaXMuc3RyaW5naWZ5Q29tcGlsZVJlc3VsdC5cbiAgX2NhY2hlRmlsZW5hbWUoYWJzb2x1dGVJbXBvcnRQYXRoKSB7XG4gICAgcmV0dXJuIHBhdGguam9pbih0aGlzLl9kaXNrQ2FjaGUsXG4gICAgICAgICAgICAgICAgICAgICB0aGlzLl9kZWVwSGFzaChhYnNvbHV0ZUltcG9ydFBhdGgpICsgJy5jYWNoZScpO1xuICB9XG4gIC8vIExvYWRzIGEge2NvbXBpbGVSZXN1bHQsIGNhY2hlS2V5c30gY2FjaGUgZW50cnkgZnJvbSBkaXNrLiBSZXR1cm5zIHRoZSB3aG9sZVxuICAvLyBjYWNoZSBlbnRyeSBhbmQgbG9hZHMgaXQgaW50byB0aGUgaW4tbWVtb3J5IGNhY2hlIHRvby5cbiAgX3JlYWRDYWNoZShhYnNvbHV0ZUltcG9ydFBhdGgpIHtcbiAgICBpZiAoISB0aGlzLl9kaXNrQ2FjaGUpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBjb25zdCBjYWNoZUZpbGVuYW1lID0gdGhpcy5fY2FjaGVGaWxlbmFtZShhYnNvbHV0ZUltcG9ydFBhdGgpO1xuICAgIGNvbnN0IHJhdyA9IHRoaXMuX3JlYWRGaWxlT3JOdWxsKGNhY2hlRmlsZW5hbWUpO1xuICAgIGlmICghcmF3KSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvLyBTcGxpdCBvbiBuZXdsaW5lLlxuICAgIGNvbnN0IG5ld2xpbmVJbmRleCA9IHJhdy5pbmRleE9mKCdcXG4nKTtcbiAgICBpZiAobmV3bGluZUluZGV4ID09PSAtMSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGNvbnN0IGNhY2hlS2V5c1N0cmluZyA9IHJhdy5zdWJzdHJpbmcoMCwgbmV3bGluZUluZGV4KTtcbiAgICBjb25zdCBjb21waWxlUmVzdWx0U3RyaW5nID0gcmF3LnN1YnN0cmluZyhuZXdsaW5lSW5kZXggKyAxKTtcblxuICAgIGNvbnN0IGNhY2hlS2V5cyA9IHRoaXMuX3BhcnNlSlNPTk9yTnVsbChjYWNoZUtleXNTdHJpbmcpO1xuICAgIGlmICghY2FjaGVLZXlzKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgY29uc3QgY29tcGlsZVJlc3VsdCA9IHRoaXMucGFyc2VDb21waWxlUmVzdWx0KGNvbXBpbGVSZXN1bHRTdHJpbmcpO1xuICAgIGlmICghIGNvbXBpbGVSZXN1bHQpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IGNhY2hlRW50cnkgPSB7Y29tcGlsZVJlc3VsdCwgY2FjaGVLZXlzfTtcbiAgICB0aGlzLl9jYWNoZS5zZXQoYWJzb2x1dGVJbXBvcnRQYXRoLCBjYWNoZUVudHJ5KTtcbiAgICByZXR1cm4gY2FjaGVFbnRyeTtcbiAgfVxuICBfd3JpdGVDYWNoZUFzeW5jKGFic29sdXRlSW1wb3J0UGF0aCwgY2FjaGVFbnRyeSkge1xuICAgIGlmICghIHRoaXMuX2Rpc2tDYWNoZSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGNvbnN0IGNhY2hlRmlsZW5hbWUgPSB0aGlzLl9jYWNoZUZpbGVuYW1lKGFic29sdXRlSW1wb3J0UGF0aCk7XG4gICAgY29uc3QgY2FjaGVDb250ZW50cyA9XG4gICAgICAgICAgICBKU09OLnN0cmluZ2lmeShjYWNoZUVudHJ5LmNhY2hlS2V5cykgKyAnXFxuJ1xuICAgICAgICAgICAgKyB0aGlzLnN0cmluZ2lmeUNvbXBpbGVSZXN1bHQoY2FjaGVFbnRyeS5jb21waWxlUmVzdWx0KTtcbiAgICB0aGlzLl93cml0ZUZpbGVBc3luYyhjYWNoZUZpbGVuYW1lLCBjYWNoZUNvbnRlbnRzKTtcbiAgfVxufVxuIl19
