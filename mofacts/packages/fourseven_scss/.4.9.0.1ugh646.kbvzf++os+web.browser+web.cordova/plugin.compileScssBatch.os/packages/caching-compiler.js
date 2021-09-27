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

/* Package-scope variables */
var CachingCompilerBase, CachingCompiler, MultiFileCachingCompiler;

var require = meteorInstall({"node_modules":{"meteor":{"caching-compiler":{"caching-compiler.js":function(require){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/caching-compiler/caching-compiler.js                                                                  //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
const fs = Plugin.fs;
const path = Plugin.path;

const createHash = Npm.require('crypto').createHash;

const assert = Npm.require('assert');

const Future = Npm.require('fibers/future');

const LRU = Npm.require('lru-cache');

const async = Npm.require('async'); // Base class for CachingCompiler and MultiFileCachingCompiler.


CachingCompilerBase = class CachingCompilerBase {
  constructor({
    compilerName,
    defaultCacheSize,
    maxParallelism = 20
  }) {
    this._compilerName = compilerName;
    this._maxParallelism = maxParallelism;
    const envVarPrefix = 'METEOR_' + compilerName.toUpperCase() + '_CACHE_';
    const debugEnvVar = envVarPrefix + 'DEBUG';
    this._cacheDebugEnabled = !!process.env[debugEnvVar];
    const cacheSizeEnvVar = envVarPrefix + 'SIZE';
    this._cacheSize = +process.env[cacheSizeEnvVar] || defaultCacheSize;
    this._diskCache = null; // For testing.

    this._callCount = 0;
  } // Your subclass must override this method to define the key used to identify
  // a particular version of an InputFile.
  //
  // Given an InputFile (the data type passed to processFilesForTarget as part
  // of the Plugin.registerCompiler API), returns a cache key that represents
  // it. This cache key can be any JSON value (it will be converted internally
  // into a hash).  This should reflect any aspect of the InputFile that affects
  // the output of `compileOneFile`. Typically you'll want to include
  // `inputFile.getDeclaredExports()`, and perhaps
  // `inputFile.getPathInPackage()` or `inputFile.getDeclaredExports` if
  // `compileOneFile` pays attention to them.
  //
  // Note that for MultiFileCachingCompiler, your cache key doesn't need to
  // include the file's path, because that is automatically taken into account
  // by the implementation. CachingCompiler subclasses can choose whether or not
  // to include the file's path in the cache key.


  getCacheKey(inputFile) {
    throw Error('CachingCompiler subclass should implement getCacheKey!');
  } // Your subclass must override this method to define how a CompileResult
  // translates into adding assets to the bundle.
  //
  // This method is given an InputFile (the data type passed to
  // processFilesForTarget as part of the Plugin.registerCompiler API) and a
  // CompileResult (either returned directly from compileOneFile or read from
  // the cache).  It should call methods like `inputFile.addJavaScript`
  // and `inputFile.error`.


  addCompileResult(inputFile, compileResult) {
    throw Error('CachingCompiler subclass should implement addCompileResult!');
  } // Your subclass must override this method to define the size of a
  // CompilerResult (used by the in-memory cache to limit the total amount of
  // data cached).


  compileResultSize(compileResult) {
    throw Error('CachingCompiler subclass should implement compileResultSize!');
  } // Your subclass may override this method to define an alternate way of
  // stringifying CompilerResults.  Takes a CompileResult and returns a string.


  stringifyCompileResult(compileResult) {
    return JSON.stringify(compileResult);
  } // Your subclass may override this method to define an alternate way of
  // parsing CompilerResults from string.  Takes a string and returns a
  // CompileResult.  If the string doesn't represent a valid CompileResult, you
  // may want to return null instead of throwing, which will make
  // CachingCompiler ignore the cache.


  parseCompileResult(stringifiedCompileResult) {
    return this._parseJSONOrNull(stringifiedCompileResult);
  }

  _parseJSONOrNull(json) {
    try {
      return JSON.parse(json);
    } catch (e) {
      if (e instanceof SyntaxError) return null;
      throw e;
    }
  }

  _cacheDebug(message) {
    if (!this._cacheDebugEnabled) return;
    console.log(`CACHE(${this._compilerName}): ${message}`);
  }

  setDiskCacheDirectory(diskCache) {
    if (this._diskCache) throw Error('setDiskCacheDirectory called twice?');
    this._diskCache = diskCache;
  } // Since so many compilers will need to calculate the size of a SourceMap in
  // their compileResultSize, this method is provided.


  sourceMapSize(sm) {
    if (!sm) return 0; // sum the length of sources and the mappings, the size of
    // metadata is ignored, but it is not a big deal

    return sm.mappings.length + (sm.sourcesContent || []).reduce(function (soFar, current) {
      return soFar + (current ? current.length : 0);
    }, 0);
  } // Borrowed from another MIT-licensed project that benjamn wrote:
  // https://github.com/reactjs/commoner/blob/235d54a12c/lib/util.js#L136-L168


  _deepHash(val) {
    const hash = createHash('sha1');
    let type = typeof val;

    if (val === null) {
      type = 'null';
    }

    hash.update(type + '\0');

    switch (type) {
      case 'object':
        const keys = Object.keys(val); // Array keys will already be sorted.

        if (!Array.isArray(val)) {
          keys.sort();
        }

        keys.forEach(key => {
          if (typeof val[key] === 'function') {
            // Silently ignore nested methods, but nevertheless complain below
            // if the root value is a function.
            return;
          }

          hash.update(key + '\0').update(this._deepHash(val[key]));
        });
        break;

      case 'function':
        assert.ok(false, 'cannot hash function objects');
        break;

      default:
        hash.update('' + val);
        break;
    }

    return hash.digest('hex');
  } // We want to write the file atomically. But we also don't want to block
  // processing on the file write.


  _writeFileAsync(filename, contents) {
    const tempFilename = filename + '.tmp.' + Random.id();

    if (this._cacheDebugEnabled) {
      // Write cache file synchronously when cache debugging enabled.
      try {
        fs.writeFileSync(tempFilename, contents);
        fs.renameSync(tempFilename, filename);
      } catch (e) {// ignore errors, it's just a cache
      }
    } else {
      fs.writeFile(tempFilename, contents, err => {
        // ignore errors, it's just a cache
        if (!err) {
          fs.rename(tempFilename, filename, err => {});
        }
      });
    }
  } // Helper function. Returns the body of the file as a string, or null if it
  // doesn't exist.


  _readFileOrNull(filename) {
    try {
      return fs.readFileSync(filename, 'utf8');
    } catch (e) {
      if (e && e.code === 'ENOENT') return null;
      throw e;
    }
  }

}; // CachingCompiler is a class designed to be used with Plugin.registerCompiler
// which implements in-memory and on-disk caches for the files that it
// processes.  You should subclass CachingCompiler and define the following
// methods: getCacheKey, compileOneFile, addCompileResult, and
// compileResultSize.
//
// CachingCompiler assumes that files are processed independently of each other;
// there is no 'import' directive allowing one file to reference another.  That
// is, editing one file should only require that file to be rebuilt, not other
// files.
//
// The data that is cached for each file is of a type that is (implicitly)
// defined by your subclass. CachingCompiler refers to this type as
// `CompileResult`, but this isn't a single type: it's up to your subclass to
// decide what type of data this is.  You should document what your subclass's
// CompileResult type is.
//
// Your subclass's compiler should call the superclass compiler specifying the
// compiler name (used to generate environment variables for debugging and
// tweaking in-memory cache size) and the default cache size.
//
// By default, CachingCompiler processes each file in "parallel". That is, if it
// needs to yield to read from the disk cache, or if getCacheKey,
// compileOneFile, or addCompileResult yields, it will start processing the next
// few files. To set how many files can be processed in parallel (including
// setting it to 1 if your subclass doesn't support any parallelism), pass the
// maxParallelism option to the superclass constructor.
//
// For example (using ES2015 via the ecmascript package):
//
//   class AwesomeCompiler extends CachingCompiler {
//     constructor() {
//       super({
//         compilerName: 'awesome',
//         defaultCacheSize: 1024*1024*10,
//       });
//     }
//     // ... define the other methods
//   }
//   Plugin.registerCompile({
//     extensions: ['awesome'],
//   }, () => new AwesomeCompiler());
//
// XXX maybe compileResultSize and stringifyCompileResult should just be methods
// on CompileResult? Sort of hard to do that with parseCompileResult.

CachingCompiler = class CachingCompiler extends CachingCompilerBase {
  constructor({
    compilerName,
    defaultCacheSize,
    maxParallelism = 20
  }) {
    super({
      compilerName,
      defaultCacheSize,
      maxParallelism
    }); // Maps from a hashed cache key to a compileResult.

    this._cache = new LRU({
      max: this._cacheSize,
      length: value => this.compileResultSize(value)
    });
  } // Your subclass must override this method to define the transformation from
  // InputFile to its cacheable CompileResult).
  //
  // Given an InputFile (the data type passed to processFilesForTarget as part
  // of the Plugin.registerCompiler API), compiles the file and returns a
  // CompileResult (the cacheable data type specific to your subclass).
  //
  // This method is not called on files when a valid cache entry exists in
  // memory or on disk.
  //
  // On a compile error, you should call `inputFile.error` appropriately and
  // return null; this will not be cached.
  //
  // This method should not call `inputFile.addJavaScript` and similar files!
  // That's what addCompileResult is for.


  compileOneFile(inputFile) {
    throw Error('CachingCompiler subclass should implement compileOneFile!');
  } // The processFilesForTarget method from the Plugin.registerCompiler API. If
  // you have processing you want to perform at the beginning or end of a
  // processing phase, you may want to override this method and call the
  // superclass implementation from within your method.


  processFilesForTarget(inputFiles) {
    const cacheMisses = [];
    const future = new Future();
    async.eachLimit(inputFiles, this._maxParallelism, (inputFile, cb) => {
      let error = null;

      try {
        const cacheKey = this._deepHash(this.getCacheKey(inputFile));

        let compileResult = this._cache.get(cacheKey);

        if (!compileResult) {
          compileResult = this._readCache(cacheKey);

          if (compileResult) {
            this._cacheDebug(`Loaded ${inputFile.getDisplayPath()}`);
          }
        }

        if (!compileResult) {
          cacheMisses.push(inputFile.getDisplayPath());
          compileResult = this.compileOneFile(inputFile);

          if (!compileResult) {
            // compileOneFile should have called inputFile.error.
            //  We don't cache failures for now.
            return;
          } // Save what we've compiled.


          this._cache.set(cacheKey, compileResult);

          this._writeCacheAsync(cacheKey, compileResult);
        }

        this.addCompileResult(inputFile, compileResult);
      } catch (e) {
        error = e;
      } finally {
        cb(error);
      }
    }, future.resolver());
    future.wait();

    if (this._cacheDebugEnabled) {
      cacheMisses.sort();

      this._cacheDebug(`Ran (#${++this._callCount}) on: ${JSON.stringify(cacheMisses)}`);
    }
  }

  _cacheFilename(cacheKey) {
    // We want cacheKeys to be hex so that they work on any FS and never end in
    // .cache.
    if (!/^[a-f0-9]+$/.test(cacheKey)) {
      throw Error('bad cacheKey: ' + cacheKey);
    }

    return path.join(this._diskCache, cacheKey + '.cache');
  } // Load a cache entry from disk. Returns the compileResult object
  // and loads it into the in-memory cache too.


  _readCache(cacheKey) {
    if (!this._diskCache) {
      return null;
    }

    const cacheFilename = this._cacheFilename(cacheKey);

    const compileResult = this._readAndParseCompileResultOrNull(cacheFilename);

    if (!compileResult) {
      return null;
    }

    this._cache.set(cacheKey, compileResult);

    return compileResult;
  }

  _writeCacheAsync(cacheKey, compileResult) {
    if (!this._diskCache) return;

    const cacheFilename = this._cacheFilename(cacheKey);

    const cacheContents = this.stringifyCompileResult(compileResult);

    this._writeFileAsync(cacheFilename, cacheContents);
  } // Returns null if the file does not exist or can't be parsed; otherwise
  // returns the parsed compileResult in the file.


  _readAndParseCompileResultOrNull(filename) {
    const raw = this._readFileOrNull(filename);

    return this.parseCompileResult(raw);
  }

};
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"multi-file-caching-compiler.js":function(require){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/caching-compiler/multi-file-caching-compiler.js                                                       //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
const path = Plugin.path;

const Future = Npm.require('fibers/future');

const LRU = Npm.require('lru-cache');

const async = Npm.require('async'); // MultiFileCachingCompiler is like CachingCompiler, but for implementing
// languages which allow files to reference each other, such as CSS
// preprocessors with `@import` directives.
//
// Like CachingCompiler, you should subclass MultiFileCachingCompiler and define
// the following methods: getCacheKey, compileOneFile, addCompileResult, and
// compileResultSize.  compileOneFile gets an additional allFiles argument and
// returns an array of referenced import paths in addition to the CompileResult.
// You may also override isRoot and getAbsoluteImportPath to customize
// MultiFileCachingCompiler further.


MultiFileCachingCompiler = class MultiFileCachingCompiler extends CachingCompilerBase {
  constructor({
    compilerName,
    defaultCacheSize,
    maxParallelism
  }) {
    super({
      compilerName,
      defaultCacheSize,
      maxParallelism
    }); // Maps from absolute import path to { compileResult, cacheKeys }, where
    // cacheKeys is an object mapping from absolute import path to hashed
    // cacheKey for each file referenced by this file (including itself).

    this._cache = new LRU({
      max: this._cacheSize,
      // We ignore the size of cacheKeys here.
      length: value => this.compileResultSize(value.compileResult)
    });
  } // Your subclass must override this method to define the transformation from
  // InputFile to its cacheable CompileResult).
  //
  // Arguments:
  //   - inputFile is the InputFile to process
  //   - allFiles is a a Map mapping from absolute import path to InputFile of
  //     all files being processed in the target
  // Returns an object with keys:
  //   - compileResult: the CompileResult (the cacheable data type specific to
  //     your subclass).
  //   - referencedImportPaths: an array of absolute import paths of files
  //     which were refererenced by the current file.  The current file
  //     is included implicitly.
  //
  // This method is not called on files when a valid cache entry exists in
  // memory or on disk.
  //
  // On a compile error, you should call `inputFile.error` appropriately and
  // return null; this will not be cached.
  //
  // This method should not call `inputFile.addJavaScript` and similar files!
  // That's what addCompileResult is for.


  compileOneFile(inputFile, allFiles) {
    throw Error('MultiFileCachingCompiler subclass should implement compileOneFile!');
  } // Your subclass may override this to declare that a file is not a "root" ---
  // ie, it can be included from other files but is not processed on its own. In
  // this case, MultiFileCachingCompiler won't waste time trying to look for a
  // cache for its compilation on disk.


  isRoot(inputFile) {
    return true;
  } // Returns the absolute import path for an InputFile. By default, this is a
  // path is a path of the form "{package}/path/to/file" for files in packages
  // and "{}/path/to/file" for files in apps. Your subclass may override and/or
  // call this method.


  getAbsoluteImportPath(inputFile) {
    if (inputFile.getPackageName() === null) {
      return '{}/' + inputFile.getPathInPackage();
    }

    return '{' + inputFile.getPackageName() + '}/' + inputFile.getPathInPackage();
  } // The processFilesForTarget method from the Plugin.registerCompiler API.


  processFilesForTarget(inputFiles) {
    const allFiles = new Map();
    const cacheKeyMap = new Map();
    const cacheMisses = [];
    inputFiles.forEach(inputFile => {
      const importPath = this.getAbsoluteImportPath(inputFile);
      allFiles.set(importPath, inputFile);
      cacheKeyMap.set(importPath, this._deepHash(this.getCacheKey(inputFile)));
    });
    const allProcessedFuture = new Future();
    async.eachLimit(inputFiles, this._maxParallelism, (inputFile, cb) => {
      let error = null;

      try {
        // If this isn't a root, skip it (and definitely don't waste time
        // looking for a cache file that won't be there).
        if (!this.isRoot(inputFile)) {
          return;
        }

        const absoluteImportPath = this.getAbsoluteImportPath(inputFile);

        let cacheEntry = this._cache.get(absoluteImportPath);

        if (!cacheEntry) {
          cacheEntry = this._readCache(absoluteImportPath);

          if (cacheEntry) {
            this._cacheDebug(`Loaded ${absoluteImportPath}`);
          }
        }

        if (!(cacheEntry && this._cacheEntryValid(cacheEntry, cacheKeyMap))) {
          cacheMisses.push(inputFile.getDisplayPath());
          const compileOneFileReturn = this.compileOneFile(inputFile, allFiles);

          if (!compileOneFileReturn) {
            // compileOneFile should have called inputFile.error.
            //  We don't cache failures for now.
            return;
          }

          const {
            compileResult,
            referencedImportPaths
          } = compileOneFileReturn;
          cacheEntry = {
            compileResult,
            cacheKeys: {
              // Include the hashed cache key of the file itself...
              [absoluteImportPath]: cacheKeyMap.get(absoluteImportPath)
            }
          }; // ... and of the other referenced files.

          referencedImportPaths.forEach(path => {
            if (!cacheKeyMap.has(path)) {
              throw Error(`Unknown absolute import path ${path}`);
            }

            cacheEntry.cacheKeys[path] = cacheKeyMap.get(path);
          }); // Save the cache entry.

          this._cache.set(absoluteImportPath, cacheEntry);

          this._writeCacheAsync(absoluteImportPath, cacheEntry);
        }

        this.addCompileResult(inputFile, cacheEntry.compileResult);
      } catch (e) {
        error = e;
      } finally {
        cb(error);
      }
    }, allProcessedFuture.resolver());
    allProcessedFuture.wait();

    if (this._cacheDebugEnabled) {
      cacheMisses.sort();

      this._cacheDebug(`Ran (#${++this._callCount}) on: ${JSON.stringify(cacheMisses)}`);
    }
  }

  _cacheEntryValid(cacheEntry, cacheKeyMap) {
    return Object.keys(cacheEntry.cacheKeys).every(path => cacheEntry.cacheKeys[path] === cacheKeyMap.get(path));
  } // The format of a cache file on disk is the JSON-stringified cacheKeys
  // object, a newline, followed by the CompileResult as returned from
  // this.stringifyCompileResult.


  _cacheFilename(absoluteImportPath) {
    return path.join(this._diskCache, this._deepHash(absoluteImportPath) + '.cache');
  } // Loads a {compileResult, cacheKeys} cache entry from disk. Returns the whole
  // cache entry and loads it into the in-memory cache too.


  _readCache(absoluteImportPath) {
    if (!this._diskCache) {
      return null;
    }

    const cacheFilename = this._cacheFilename(absoluteImportPath);

    const raw = this._readFileOrNull(cacheFilename);

    if (!raw) {
      return null;
    } // Split on newline.


    const newlineIndex = raw.indexOf('\n');

    if (newlineIndex === -1) {
      return null;
    }

    const cacheKeysString = raw.substring(0, newlineIndex);
    const compileResultString = raw.substring(newlineIndex + 1);

    const cacheKeys = this._parseJSONOrNull(cacheKeysString);

    if (!cacheKeys) {
      return null;
    }

    const compileResult = this.parseCompileResult(compileResultString);

    if (!compileResult) {
      return null;
    }

    const cacheEntry = {
      compileResult,
      cacheKeys
    };

    this._cache.set(absoluteImportPath, cacheEntry);

    return cacheEntry;
  }

  _writeCacheAsync(absoluteImportPath, cacheEntry) {
    if (!this._diskCache) {
      return null;
    }

    const cacheFilename = this._cacheFilename(absoluteImportPath);

    const cacheContents = JSON.stringify(cacheEntry.cacheKeys) + '\n' + this.stringifyCompileResult(cacheEntry.compileResult);

    this._writeFileAsync(cacheFilename, cacheContents);
  }

};
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("/node_modules/meteor/caching-compiler/caching-compiler.js");
require("/node_modules/meteor/caching-compiler/multi-file-caching-compiler.js");

/* Exports */
Package._define("caching-compiler", {
  CachingCompiler: CachingCompiler,
  MultiFileCachingCompiler: MultiFileCachingCompiler
});

})();







//# sourceURL=meteor://💻app/packages/caching-compiler.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvY2FjaGluZy1jb21waWxlci9jYWNoaW5nLWNvbXBpbGVyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9jYWNoaW5nLWNvbXBpbGVyL211bHRpLWZpbGUtY2FjaGluZy1jb21waWxlci5qcyJdLCJuYW1lcyI6WyJmcyIsIlBsdWdpbiIsInBhdGgiLCJjcmVhdGVIYXNoIiwiTnBtIiwicmVxdWlyZSIsImFzc2VydCIsIkZ1dHVyZSIsIkxSVSIsImFzeW5jIiwiQ2FjaGluZ0NvbXBpbGVyQmFzZSIsImNvbnN0cnVjdG9yIiwiY29tcGlsZXJOYW1lIiwiZGVmYXVsdENhY2hlU2l6ZSIsIm1heFBhcmFsbGVsaXNtIiwiX2NvbXBpbGVyTmFtZSIsIl9tYXhQYXJhbGxlbGlzbSIsImVudlZhclByZWZpeCIsInRvVXBwZXJDYXNlIiwiZGVidWdFbnZWYXIiLCJfY2FjaGVEZWJ1Z0VuYWJsZWQiLCJwcm9jZXNzIiwiZW52IiwiY2FjaGVTaXplRW52VmFyIiwiX2NhY2hlU2l6ZSIsIl9kaXNrQ2FjaGUiLCJfY2FsbENvdW50IiwiZ2V0Q2FjaGVLZXkiLCJpbnB1dEZpbGUiLCJFcnJvciIsImFkZENvbXBpbGVSZXN1bHQiLCJjb21waWxlUmVzdWx0IiwiY29tcGlsZVJlc3VsdFNpemUiLCJzdHJpbmdpZnlDb21waWxlUmVzdWx0IiwiSlNPTiIsInN0cmluZ2lmeSIsInBhcnNlQ29tcGlsZVJlc3VsdCIsInN0cmluZ2lmaWVkQ29tcGlsZVJlc3VsdCIsIl9wYXJzZUpTT05Pck51bGwiLCJqc29uIiwicGFyc2UiLCJlIiwiU3ludGF4RXJyb3IiLCJfY2FjaGVEZWJ1ZyIsIm1lc3NhZ2UiLCJjb25zb2xlIiwibG9nIiwic2V0RGlza0NhY2hlRGlyZWN0b3J5IiwiZGlza0NhY2hlIiwic291cmNlTWFwU2l6ZSIsInNtIiwibWFwcGluZ3MiLCJsZW5ndGgiLCJzb3VyY2VzQ29udGVudCIsInJlZHVjZSIsInNvRmFyIiwiY3VycmVudCIsIl9kZWVwSGFzaCIsInZhbCIsImhhc2giLCJ0eXBlIiwidXBkYXRlIiwia2V5cyIsIk9iamVjdCIsIkFycmF5IiwiaXNBcnJheSIsInNvcnQiLCJmb3JFYWNoIiwia2V5Iiwib2siLCJkaWdlc3QiLCJfd3JpdGVGaWxlQXN5bmMiLCJmaWxlbmFtZSIsImNvbnRlbnRzIiwidGVtcEZpbGVuYW1lIiwiUmFuZG9tIiwiaWQiLCJ3cml0ZUZpbGVTeW5jIiwicmVuYW1lU3luYyIsIndyaXRlRmlsZSIsImVyciIsInJlbmFtZSIsIl9yZWFkRmlsZU9yTnVsbCIsInJlYWRGaWxlU3luYyIsImNvZGUiLCJDYWNoaW5nQ29tcGlsZXIiLCJfY2FjaGUiLCJtYXgiLCJ2YWx1ZSIsImNvbXBpbGVPbmVGaWxlIiwicHJvY2Vzc0ZpbGVzRm9yVGFyZ2V0IiwiaW5wdXRGaWxlcyIsImNhY2hlTWlzc2VzIiwiZnV0dXJlIiwiZWFjaExpbWl0IiwiY2IiLCJlcnJvciIsImNhY2hlS2V5IiwiZ2V0IiwiX3JlYWRDYWNoZSIsImdldERpc3BsYXlQYXRoIiwicHVzaCIsInNldCIsIl93cml0ZUNhY2hlQXN5bmMiLCJyZXNvbHZlciIsIndhaXQiLCJfY2FjaGVGaWxlbmFtZSIsInRlc3QiLCJqb2luIiwiY2FjaGVGaWxlbmFtZSIsIl9yZWFkQW5kUGFyc2VDb21waWxlUmVzdWx0T3JOdWxsIiwiY2FjaGVDb250ZW50cyIsInJhdyIsIk11bHRpRmlsZUNhY2hpbmdDb21waWxlciIsImFsbEZpbGVzIiwiaXNSb290IiwiZ2V0QWJzb2x1dGVJbXBvcnRQYXRoIiwiZ2V0UGFja2FnZU5hbWUiLCJnZXRQYXRoSW5QYWNrYWdlIiwiTWFwIiwiY2FjaGVLZXlNYXAiLCJpbXBvcnRQYXRoIiwiYWxsUHJvY2Vzc2VkRnV0dXJlIiwiYWJzb2x1dGVJbXBvcnRQYXRoIiwiY2FjaGVFbnRyeSIsIl9jYWNoZUVudHJ5VmFsaWQiLCJjb21waWxlT25lRmlsZVJldHVybiIsInJlZmVyZW5jZWRJbXBvcnRQYXRocyIsImNhY2hlS2V5cyIsImhhcyIsImV2ZXJ5IiwibmV3bGluZUluZGV4IiwiaW5kZXhPZiIsImNhY2hlS2V5c1N0cmluZyIsInN1YnN0cmluZyIsImNvbXBpbGVSZXN1bHRTdHJpbmciXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsTUFBTUEsS0FBS0MsT0FBT0QsRUFBbEI7QUFDQSxNQUFNRSxPQUFPRCxPQUFPQyxJQUFwQjs7QUFDQSxNQUFNQyxhQUFhQyxJQUFJQyxPQUFKLENBQVksUUFBWixFQUFzQkYsVUFBekM7O0FBQ0EsTUFBTUcsU0FBU0YsSUFBSUMsT0FBSixDQUFZLFFBQVosQ0FBZjs7QUFDQSxNQUFNRSxTQUFTSCxJQUFJQyxPQUFKLENBQVksZUFBWixDQUFmOztBQUNBLE1BQU1HLE1BQU1KLElBQUlDLE9BQUosQ0FBWSxXQUFaLENBQVo7O0FBQ0EsTUFBTUksUUFBUUwsSUFBSUMsT0FBSixDQUFZLE9BQVosQ0FBZCxDLENBRUE7OztBQUNBSyxzQkFBc0IsTUFBTUEsbUJBQU4sQ0FBMEI7QUFDOUNDLGNBQVk7QUFDVkMsZ0JBRFU7QUFFVkMsb0JBRlU7QUFHVkMscUJBQWlCO0FBSFAsR0FBWixFQUlHO0FBQ0QsU0FBS0MsYUFBTCxHQUFxQkgsWUFBckI7QUFDQSxTQUFLSSxlQUFMLEdBQXVCRixjQUF2QjtBQUNBLFVBQU1HLGVBQWUsWUFBWUwsYUFBYU0sV0FBYixFQUFaLEdBQXlDLFNBQTlEO0FBRUEsVUFBTUMsY0FBY0YsZUFBZSxPQUFuQztBQUNBLFNBQUtHLGtCQUFMLEdBQTBCLENBQUMsQ0FBRUMsUUFBUUMsR0FBUixDQUFZSCxXQUFaLENBQTdCO0FBRUEsVUFBTUksa0JBQWtCTixlQUFlLE1BQXZDO0FBQ0EsU0FBS08sVUFBTCxHQUFrQixDQUFDSCxRQUFRQyxHQUFSLENBQVlDLGVBQVosQ0FBRCxJQUFpQ1YsZ0JBQW5EO0FBRUEsU0FBS1ksVUFBTCxHQUFrQixJQUFsQixDQVhDLENBYUQ7O0FBQ0EsU0FBS0MsVUFBTCxHQUFrQixDQUFsQjtBQUNELEdBcEI2QyxDQXNCOUM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQUNBQyxjQUFZQyxTQUFaLEVBQXVCO0FBQ3JCLFVBQU1DLE1BQU0sd0RBQU4sQ0FBTjtBQUNELEdBeEM2QyxDQTBDOUM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FBQ0FDLG1CQUFpQkYsU0FBakIsRUFBNEJHLGFBQTVCLEVBQTJDO0FBQ3pDLFVBQU1GLE1BQU0sNkRBQU4sQ0FBTjtBQUNELEdBcEQ2QyxDQXNEOUM7QUFDQTtBQUNBOzs7QUFDQUcsb0JBQWtCRCxhQUFsQixFQUFpQztBQUMvQixVQUFNRixNQUFNLDhEQUFOLENBQU47QUFDRCxHQTNENkMsQ0E2RDlDO0FBQ0E7OztBQUNBSSx5QkFBdUJGLGFBQXZCLEVBQXNDO0FBQ3BDLFdBQU9HLEtBQUtDLFNBQUwsQ0FBZUosYUFBZixDQUFQO0FBQ0QsR0FqRTZDLENBa0U5QztBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUFDQUsscUJBQW1CQyx3QkFBbkIsRUFBNkM7QUFDM0MsV0FBTyxLQUFLQyxnQkFBTCxDQUFzQkQsd0JBQXRCLENBQVA7QUFDRDs7QUFDREMsbUJBQWlCQyxJQUFqQixFQUF1QjtBQUNyQixRQUFJO0FBQ0YsYUFBT0wsS0FBS00sS0FBTCxDQUFXRCxJQUFYLENBQVA7QUFDRCxLQUZELENBRUUsT0FBT0UsQ0FBUCxFQUFVO0FBQ1YsVUFBSUEsYUFBYUMsV0FBakIsRUFDRSxPQUFPLElBQVA7QUFDRixZQUFNRCxDQUFOO0FBQ0Q7QUFDRjs7QUFFREUsY0FBWUMsT0FBWixFQUFxQjtBQUNuQixRQUFJLENBQUMsS0FBS3hCLGtCQUFWLEVBQ0U7QUFDRnlCLFlBQVFDLEdBQVIsQ0FBYSxTQUFTLEtBQUsvQixhQUFlLE1BQU02QixPQUFTLEVBQXpEO0FBQ0Q7O0FBRURHLHdCQUFzQkMsU0FBdEIsRUFBaUM7QUFDL0IsUUFBSSxLQUFLdkIsVUFBVCxFQUNFLE1BQU1JLE1BQU0scUNBQU4sQ0FBTjtBQUNGLFNBQUtKLFVBQUwsR0FBa0J1QixTQUFsQjtBQUNELEdBOUY2QyxDQWdHOUM7QUFDQTs7O0FBQ0FDLGdCQUFjQyxFQUFkLEVBQWtCO0FBQ2hCLFFBQUksQ0FBRUEsRUFBTixFQUFVLE9BQU8sQ0FBUCxDQURNLENBRWhCO0FBQ0E7O0FBQ0EsV0FBT0EsR0FBR0MsUUFBSCxDQUFZQyxNQUFaLEdBQ0gsQ0FBQ0YsR0FBR0csY0FBSCxJQUFxQixFQUF0QixFQUEwQkMsTUFBMUIsQ0FBaUMsVUFBVUMsS0FBVixFQUFpQkMsT0FBakIsRUFBMEI7QUFDM0QsYUFBT0QsU0FBU0MsVUFBVUEsUUFBUUosTUFBbEIsR0FBMkIsQ0FBcEMsQ0FBUDtBQUNELEtBRkMsRUFFQyxDQUZELENBREo7QUFJRCxHQTFHNkMsQ0E0RzlDO0FBQ0E7OztBQUNBSyxZQUFVQyxHQUFWLEVBQWU7QUFDYixVQUFNQyxPQUFPeEQsV0FBVyxNQUFYLENBQWI7QUFDQSxRQUFJeUQsT0FBTyxPQUFPRixHQUFsQjs7QUFFQSxRQUFJQSxRQUFRLElBQVosRUFBa0I7QUFDaEJFLGFBQU8sTUFBUDtBQUNEOztBQUNERCxTQUFLRSxNQUFMLENBQVlELE9BQU8sSUFBbkI7O0FBRUEsWUFBUUEsSUFBUjtBQUNBLFdBQUssUUFBTDtBQUNFLGNBQU1FLE9BQU9DLE9BQU9ELElBQVAsQ0FBWUosR0FBWixDQUFiLENBREYsQ0FHRTs7QUFDQSxZQUFJLENBQUVNLE1BQU1DLE9BQU4sQ0FBY1AsR0FBZCxDQUFOLEVBQTBCO0FBQ3hCSSxlQUFLSSxJQUFMO0FBQ0Q7O0FBRURKLGFBQUtLLE9BQUwsQ0FBY0MsR0FBRCxJQUFTO0FBQ3BCLGNBQUksT0FBT1YsSUFBSVUsR0FBSixDQUFQLEtBQW9CLFVBQXhCLEVBQW9DO0FBQ2xDO0FBQ0E7QUFDQTtBQUNEOztBQUVEVCxlQUFLRSxNQUFMLENBQVlPLE1BQU0sSUFBbEIsRUFBd0JQLE1BQXhCLENBQStCLEtBQUtKLFNBQUwsQ0FBZUMsSUFBSVUsR0FBSixDQUFmLENBQS9CO0FBQ0QsU0FSRDtBQVVBOztBQUVGLFdBQUssVUFBTDtBQUNFOUQsZUFBTytELEVBQVAsQ0FBVSxLQUFWLEVBQWlCLDhCQUFqQjtBQUNBOztBQUVGO0FBQ0VWLGFBQUtFLE1BQUwsQ0FBWSxLQUFLSCxHQUFqQjtBQUNBO0FBM0JGOztBQThCQSxXQUFPQyxLQUFLVyxNQUFMLENBQVksS0FBWixDQUFQO0FBQ0QsR0F0SjZDLENBd0o5QztBQUNBOzs7QUFDQUMsa0JBQWdCQyxRQUFoQixFQUEwQkMsUUFBMUIsRUFBb0M7QUFDbEMsVUFBTUMsZUFBZUYsV0FBVyxPQUFYLEdBQXFCRyxPQUFPQyxFQUFQLEVBQTFDOztBQUNBLFFBQUksS0FBS3hELGtCQUFULEVBQTZCO0FBQzNCO0FBQ0EsVUFBSTtBQUNGcEIsV0FBRzZFLGFBQUgsQ0FBaUJILFlBQWpCLEVBQStCRCxRQUEvQjtBQUNBekUsV0FBRzhFLFVBQUgsQ0FBY0osWUFBZCxFQUE0QkYsUUFBNUI7QUFDRCxPQUhELENBR0UsT0FBTy9CLENBQVAsRUFBVSxDQUNWO0FBQ0Q7QUFDRixLQVJELE1BUU87QUFDTHpDLFNBQUcrRSxTQUFILENBQWFMLFlBQWIsRUFBMkJELFFBQTNCLEVBQXFDTyxPQUFPO0FBQzFDO0FBQ0EsWUFBSSxDQUFFQSxHQUFOLEVBQVc7QUFDVGhGLGFBQUdpRixNQUFILENBQVVQLFlBQVYsRUFBd0JGLFFBQXhCLEVBQWtDUSxPQUFPLENBQUUsQ0FBM0M7QUFDRDtBQUNGLE9BTEQ7QUFNRDtBQUNGLEdBNUs2QyxDQThLOUM7QUFDQTs7O0FBQ0FFLGtCQUFnQlYsUUFBaEIsRUFBMEI7QUFDeEIsUUFBSTtBQUNGLGFBQU94RSxHQUFHbUYsWUFBSCxDQUFnQlgsUUFBaEIsRUFBMEIsTUFBMUIsQ0FBUDtBQUNELEtBRkQsQ0FFRSxPQUFPL0IsQ0FBUCxFQUFVO0FBQ1YsVUFBSUEsS0FBS0EsRUFBRTJDLElBQUYsS0FBVyxRQUFwQixFQUNFLE9BQU8sSUFBUDtBQUNGLFlBQU0zQyxDQUFOO0FBQ0Q7QUFDRjs7QUF4TDZDLENBQWhELEMsQ0EyTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUNBNEMsa0JBQWtCLE1BQU1BLGVBQU4sU0FBOEIzRSxtQkFBOUIsQ0FBa0Q7QUFDbEVDLGNBQVk7QUFDVkMsZ0JBRFU7QUFFVkMsb0JBRlU7QUFHVkMscUJBQWlCO0FBSFAsR0FBWixFQUlHO0FBQ0QsVUFBTTtBQUFDRixrQkFBRDtBQUFlQyxzQkFBZjtBQUFpQ0M7QUFBakMsS0FBTixFQURDLENBR0Q7O0FBQ0EsU0FBS3dFLE1BQUwsR0FBYyxJQUFJOUUsR0FBSixDQUFRO0FBQ3BCK0UsV0FBSyxLQUFLL0QsVUFEVTtBQUVwQjRCLGNBQVNvQyxLQUFELElBQVcsS0FBS3hELGlCQUFMLENBQXVCd0QsS0FBdkI7QUFGQyxLQUFSLENBQWQ7QUFJRCxHQWJpRSxDQWVsRTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQUNBQyxpQkFBZTdELFNBQWYsRUFBMEI7QUFDeEIsVUFBTUMsTUFBTSwyREFBTixDQUFOO0FBQ0QsR0FoQ2lFLENBa0NsRTtBQUNBO0FBQ0E7QUFDQTs7O0FBQ0E2RCx3QkFBc0JDLFVBQXRCLEVBQWtDO0FBQ2hDLFVBQU1DLGNBQWMsRUFBcEI7QUFFQSxVQUFNQyxTQUFTLElBQUl0RixNQUFKLEVBQWY7QUFDQUUsVUFBTXFGLFNBQU4sQ0FBZ0JILFVBQWhCLEVBQTRCLEtBQUszRSxlQUFqQyxFQUFrRCxDQUFDWSxTQUFELEVBQVltRSxFQUFaLEtBQW1CO0FBQ25FLFVBQUlDLFFBQVEsSUFBWjs7QUFDQSxVQUFJO0FBQ0YsY0FBTUMsV0FBVyxLQUFLeEMsU0FBTCxDQUFlLEtBQUs5QixXQUFMLENBQWlCQyxTQUFqQixDQUFmLENBQWpCOztBQUNBLFlBQUlHLGdCQUFnQixLQUFLdUQsTUFBTCxDQUFZWSxHQUFaLENBQWdCRCxRQUFoQixDQUFwQjs7QUFFQSxZQUFJLENBQUVsRSxhQUFOLEVBQXFCO0FBQ25CQSwwQkFBZ0IsS0FBS29FLFVBQUwsQ0FBZ0JGLFFBQWhCLENBQWhCOztBQUNBLGNBQUlsRSxhQUFKLEVBQW1CO0FBQ2pCLGlCQUFLWSxXQUFMLENBQWtCLFVBQVVmLFVBQVV3RSxjQUFWLEVBQTRCLEVBQXhEO0FBQ0Q7QUFDRjs7QUFFRCxZQUFJLENBQUVyRSxhQUFOLEVBQXFCO0FBQ25CNkQsc0JBQVlTLElBQVosQ0FBaUJ6RSxVQUFVd0UsY0FBVixFQUFqQjtBQUNBckUsMEJBQWdCLEtBQUswRCxjQUFMLENBQW9CN0QsU0FBcEIsQ0FBaEI7O0FBRUEsY0FBSSxDQUFFRyxhQUFOLEVBQXFCO0FBQ25CO0FBQ0E7QUFDQTtBQUNELFdBUmtCLENBVW5COzs7QUFDQSxlQUFLdUQsTUFBTCxDQUFZZ0IsR0FBWixDQUFnQkwsUUFBaEIsRUFBMEJsRSxhQUExQjs7QUFDQSxlQUFLd0UsZ0JBQUwsQ0FBc0JOLFFBQXRCLEVBQWdDbEUsYUFBaEM7QUFDRDs7QUFFRCxhQUFLRCxnQkFBTCxDQUFzQkYsU0FBdEIsRUFBaUNHLGFBQWpDO0FBQ0QsT0EzQkQsQ0EyQkUsT0FBT1UsQ0FBUCxFQUFVO0FBQ1Z1RCxnQkFBUXZELENBQVI7QUFDRCxPQTdCRCxTQTZCVTtBQUNSc0QsV0FBR0MsS0FBSDtBQUNEO0FBQ0YsS0FsQ0QsRUFrQ0dILE9BQU9XLFFBQVAsRUFsQ0g7QUFtQ0FYLFdBQU9ZLElBQVA7O0FBRUEsUUFBSSxLQUFLckYsa0JBQVQsRUFBNkI7QUFDM0J3RSxrQkFBWTFCLElBQVo7O0FBQ0EsV0FBS3ZCLFdBQUwsQ0FDRyxTQUFTLEVBQUUsS0FBS2pCLFVBQVksU0FBU1EsS0FBS0MsU0FBTCxDQUFleUQsV0FBZixDQUE2QixFQURyRTtBQUVEO0FBQ0Y7O0FBRURjLGlCQUFlVCxRQUFmLEVBQXlCO0FBQ3ZCO0FBQ0E7QUFDQSxRQUFJLENBQUMsY0FBY1UsSUFBZCxDQUFtQlYsUUFBbkIsQ0FBTCxFQUFtQztBQUNqQyxZQUFNcEUsTUFBTSxtQkFBbUJvRSxRQUF6QixDQUFOO0FBQ0Q7O0FBQ0QsV0FBTy9GLEtBQUswRyxJQUFMLENBQVUsS0FBS25GLFVBQWYsRUFBMkJ3RSxXQUFXLFFBQXRDLENBQVA7QUFDRCxHQTdGaUUsQ0E4RmxFO0FBQ0E7OztBQUNBRSxhQUFXRixRQUFYLEVBQXFCO0FBQ25CLFFBQUksQ0FBRSxLQUFLeEUsVUFBWCxFQUF1QjtBQUNyQixhQUFPLElBQVA7QUFDRDs7QUFDRCxVQUFNb0YsZ0JBQWdCLEtBQUtILGNBQUwsQ0FBb0JULFFBQXBCLENBQXRCOztBQUNBLFVBQU1sRSxnQkFBZ0IsS0FBSytFLGdDQUFMLENBQXNDRCxhQUF0QyxDQUF0Qjs7QUFDQSxRQUFJLENBQUU5RSxhQUFOLEVBQXFCO0FBQ25CLGFBQU8sSUFBUDtBQUNEOztBQUNELFNBQUt1RCxNQUFMLENBQVlnQixHQUFaLENBQWdCTCxRQUFoQixFQUEwQmxFLGFBQTFCOztBQUNBLFdBQU9BLGFBQVA7QUFDRDs7QUFDRHdFLG1CQUFpQk4sUUFBakIsRUFBMkJsRSxhQUEzQixFQUEwQztBQUN4QyxRQUFJLENBQUUsS0FBS04sVUFBWCxFQUNFOztBQUNGLFVBQU1vRixnQkFBZ0IsS0FBS0gsY0FBTCxDQUFvQlQsUUFBcEIsQ0FBdEI7O0FBQ0EsVUFBTWMsZ0JBQWdCLEtBQUs5RSxzQkFBTCxDQUE0QkYsYUFBNUIsQ0FBdEI7O0FBQ0EsU0FBS3dDLGVBQUwsQ0FBcUJzQyxhQUFyQixFQUFvQ0UsYUFBcEM7QUFDRCxHQWxIaUUsQ0FvSGxFO0FBQ0E7OztBQUNBRCxtQ0FBaUN0QyxRQUFqQyxFQUEyQztBQUN6QyxVQUFNd0MsTUFBTSxLQUFLOUIsZUFBTCxDQUFxQlYsUUFBckIsQ0FBWjs7QUFDQSxXQUFPLEtBQUtwQyxrQkFBTCxDQUF3QjRFLEdBQXhCLENBQVA7QUFDRDs7QUF6SGlFLENBQXBFLEM7Ozs7Ozs7Ozs7O0FDalBBLE1BQU05RyxPQUFPRCxPQUFPQyxJQUFwQjs7QUFDQSxNQUFNSyxTQUFTSCxJQUFJQyxPQUFKLENBQVksZUFBWixDQUFmOztBQUNBLE1BQU1HLE1BQU1KLElBQUlDLE9BQUosQ0FBWSxXQUFaLENBQVo7O0FBQ0EsTUFBTUksUUFBUUwsSUFBSUMsT0FBSixDQUFZLE9BQVosQ0FBZCxDLENBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQUNBNEcsMkJBQTJCLE1BQU1BLHdCQUFOLFNBQ25CdkcsbUJBRG1CLENBQ0M7QUFDMUJDLGNBQVk7QUFDVkMsZ0JBRFU7QUFFVkMsb0JBRlU7QUFHVkM7QUFIVSxHQUFaLEVBSUc7QUFDRCxVQUFNO0FBQUNGLGtCQUFEO0FBQWVDLHNCQUFmO0FBQWlDQztBQUFqQyxLQUFOLEVBREMsQ0FHRDtBQUNBO0FBQ0E7O0FBQ0EsU0FBS3dFLE1BQUwsR0FBYyxJQUFJOUUsR0FBSixDQUFRO0FBQ3BCK0UsV0FBSyxLQUFLL0QsVUFEVTtBQUVwQjtBQUNBNEIsY0FBU29DLEtBQUQsSUFBVyxLQUFLeEQsaUJBQUwsQ0FBdUJ3RCxNQUFNekQsYUFBN0I7QUFIQyxLQUFSLENBQWQ7QUFLRCxHQWhCeUIsQ0FrQjFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUFDQTBELGlCQUFlN0QsU0FBZixFQUEwQnNGLFFBQTFCLEVBQW9DO0FBQ2xDLFVBQU1yRixNQUNKLG9FQURJLENBQU47QUFFRCxHQTNDeUIsQ0E2QzFCO0FBQ0E7QUFDQTtBQUNBOzs7QUFDQXNGLFNBQU92RixTQUFQLEVBQWtCO0FBQ2hCLFdBQU8sSUFBUDtBQUNELEdBbkR5QixDQXFEMUI7QUFDQTtBQUNBO0FBQ0E7OztBQUNBd0Ysd0JBQXNCeEYsU0FBdEIsRUFBaUM7QUFDL0IsUUFBSUEsVUFBVXlGLGNBQVYsT0FBK0IsSUFBbkMsRUFBeUM7QUFDdkMsYUFBTyxRQUFRekYsVUFBVTBGLGdCQUFWLEVBQWY7QUFDRDs7QUFDRCxXQUFPLE1BQU0xRixVQUFVeUYsY0FBVixFQUFOLEdBQW1DLElBQW5DLEdBQ0h6RixVQUFVMEYsZ0JBQVYsRUFESjtBQUVELEdBL0R5QixDQWlFMUI7OztBQUNBNUIsd0JBQXNCQyxVQUF0QixFQUFrQztBQUNoQyxVQUFNdUIsV0FBVyxJQUFJSyxHQUFKLEVBQWpCO0FBQ0EsVUFBTUMsY0FBYyxJQUFJRCxHQUFKLEVBQXBCO0FBQ0EsVUFBTTNCLGNBQWMsRUFBcEI7QUFFQUQsZUFBV3hCLE9BQVgsQ0FBb0J2QyxTQUFELElBQWU7QUFDaEMsWUFBTTZGLGFBQWEsS0FBS0wscUJBQUwsQ0FBMkJ4RixTQUEzQixDQUFuQjtBQUNBc0YsZUFBU1osR0FBVCxDQUFhbUIsVUFBYixFQUF5QjdGLFNBQXpCO0FBQ0E0RixrQkFBWWxCLEdBQVosQ0FBZ0JtQixVQUFoQixFQUE0QixLQUFLaEUsU0FBTCxDQUFlLEtBQUs5QixXQUFMLENBQWlCQyxTQUFqQixDQUFmLENBQTVCO0FBQ0QsS0FKRDtBQU1BLFVBQU04RixxQkFBcUIsSUFBSW5ILE1BQUosRUFBM0I7QUFDQUUsVUFBTXFGLFNBQU4sQ0FBZ0JILFVBQWhCLEVBQTRCLEtBQUszRSxlQUFqQyxFQUFrRCxDQUFDWSxTQUFELEVBQVltRSxFQUFaLEtBQW1CO0FBQ25FLFVBQUlDLFFBQVEsSUFBWjs7QUFDQSxVQUFJO0FBQ0Y7QUFDQTtBQUNBLFlBQUksQ0FBQyxLQUFLbUIsTUFBTCxDQUFZdkYsU0FBWixDQUFMLEVBQTZCO0FBQzNCO0FBQ0Q7O0FBRUQsY0FBTStGLHFCQUFxQixLQUFLUCxxQkFBTCxDQUEyQnhGLFNBQTNCLENBQTNCOztBQUNBLFlBQUlnRyxhQUFhLEtBQUt0QyxNQUFMLENBQVlZLEdBQVosQ0FBZ0J5QixrQkFBaEIsQ0FBakI7O0FBQ0EsWUFBSSxDQUFFQyxVQUFOLEVBQWtCO0FBQ2hCQSx1QkFBYSxLQUFLekIsVUFBTCxDQUFnQndCLGtCQUFoQixDQUFiOztBQUNBLGNBQUlDLFVBQUosRUFBZ0I7QUFDZCxpQkFBS2pGLFdBQUwsQ0FBa0IsVUFBVWdGLGtCQUFvQixFQUFoRDtBQUNEO0FBQ0Y7O0FBQ0QsWUFBSSxFQUFHQyxjQUFjLEtBQUtDLGdCQUFMLENBQXNCRCxVQUF0QixFQUFrQ0osV0FBbEMsQ0FBakIsQ0FBSixFQUFzRTtBQUNwRTVCLHNCQUFZUyxJQUFaLENBQWlCekUsVUFBVXdFLGNBQVYsRUFBakI7QUFFQSxnQkFBTTBCLHVCQUF1QixLQUFLckMsY0FBTCxDQUFvQjdELFNBQXBCLEVBQStCc0YsUUFBL0IsQ0FBN0I7O0FBQ0EsY0FBSSxDQUFFWSxvQkFBTixFQUE0QjtBQUMxQjtBQUNBO0FBQ0E7QUFDRDs7QUFDRCxnQkFBTTtBQUFDL0YseUJBQUQ7QUFBZ0JnRztBQUFoQixjQUF5Q0Qsb0JBQS9DO0FBRUFGLHVCQUFhO0FBQ1g3Rix5QkFEVztBQUVYaUcsdUJBQVc7QUFDVDtBQUNBLGVBQUNMLGtCQUFELEdBQXNCSCxZQUFZdEIsR0FBWixDQUFnQnlCLGtCQUFoQjtBQUZiO0FBRkEsV0FBYixDQVhvRSxDQW1CcEU7O0FBQ0FJLGdDQUFzQjVELE9BQXRCLENBQStCakUsSUFBRCxJQUFVO0FBQ3RDLGdCQUFJLENBQUNzSCxZQUFZUyxHQUFaLENBQWdCL0gsSUFBaEIsQ0FBTCxFQUE0QjtBQUMxQixvQkFBTTJCLE1BQU8sZ0NBQWdDM0IsSUFBTSxFQUE3QyxDQUFOO0FBQ0Q7O0FBQ0QwSCx1QkFBV0ksU0FBWCxDQUFxQjlILElBQXJCLElBQTZCc0gsWUFBWXRCLEdBQVosQ0FBZ0JoRyxJQUFoQixDQUE3QjtBQUNELFdBTEQsRUFwQm9FLENBMkJwRTs7QUFDQSxlQUFLb0YsTUFBTCxDQUFZZ0IsR0FBWixDQUFnQnFCLGtCQUFoQixFQUFvQ0MsVUFBcEM7O0FBQ0EsZUFBS3JCLGdCQUFMLENBQXNCb0Isa0JBQXRCLEVBQTBDQyxVQUExQztBQUNEOztBQUVELGFBQUs5RixnQkFBTCxDQUFzQkYsU0FBdEIsRUFBaUNnRyxXQUFXN0YsYUFBNUM7QUFDRCxPQWhERCxDQWdERSxPQUFPVSxDQUFQLEVBQVU7QUFDVnVELGdCQUFRdkQsQ0FBUjtBQUNELE9BbERELFNBa0RVO0FBQ1JzRCxXQUFHQyxLQUFIO0FBQ0Q7QUFDRixLQXZERCxFQXVERzBCLG1CQUFtQmxCLFFBQW5CLEVBdkRIO0FBd0RBa0IsdUJBQW1CakIsSUFBbkI7O0FBRUEsUUFBSSxLQUFLckYsa0JBQVQsRUFBNkI7QUFDM0J3RSxrQkFBWTFCLElBQVo7O0FBQ0EsV0FBS3ZCLFdBQUwsQ0FDRyxTQUFTLEVBQUUsS0FBS2pCLFVBQVksU0FBU1EsS0FBS0MsU0FBTCxDQUFleUQsV0FBZixDQUE2QixFQURyRTtBQUVEO0FBQ0Y7O0FBRURpQyxtQkFBaUJELFVBQWpCLEVBQTZCSixXQUE3QixFQUEwQztBQUN4QyxXQUFPekQsT0FBT0QsSUFBUCxDQUFZOEQsV0FBV0ksU0FBdkIsRUFBa0NFLEtBQWxDLENBQ0poSSxJQUFELElBQVUwSCxXQUFXSSxTQUFYLENBQXFCOUgsSUFBckIsTUFBK0JzSCxZQUFZdEIsR0FBWixDQUFnQmhHLElBQWhCLENBRHBDLENBQVA7QUFHRCxHQW5KeUIsQ0FxSjFCO0FBQ0E7QUFDQTs7O0FBQ0F3RyxpQkFBZWlCLGtCQUFmLEVBQW1DO0FBQ2pDLFdBQU96SCxLQUFLMEcsSUFBTCxDQUFVLEtBQUtuRixVQUFmLEVBQ1UsS0FBS2dDLFNBQUwsQ0FBZWtFLGtCQUFmLElBQXFDLFFBRC9DLENBQVA7QUFFRCxHQTNKeUIsQ0E0SjFCO0FBQ0E7OztBQUNBeEIsYUFBV3dCLGtCQUFYLEVBQStCO0FBQzdCLFFBQUksQ0FBRSxLQUFLbEcsVUFBWCxFQUF1QjtBQUNyQixhQUFPLElBQVA7QUFDRDs7QUFDRCxVQUFNb0YsZ0JBQWdCLEtBQUtILGNBQUwsQ0FBb0JpQixrQkFBcEIsQ0FBdEI7O0FBQ0EsVUFBTVgsTUFBTSxLQUFLOUIsZUFBTCxDQUFxQjJCLGFBQXJCLENBQVo7O0FBQ0EsUUFBSSxDQUFDRyxHQUFMLEVBQVU7QUFDUixhQUFPLElBQVA7QUFDRCxLQVI0QixDQVU3Qjs7O0FBQ0EsVUFBTW1CLGVBQWVuQixJQUFJb0IsT0FBSixDQUFZLElBQVosQ0FBckI7O0FBQ0EsUUFBSUQsaUJBQWlCLENBQUMsQ0FBdEIsRUFBeUI7QUFDdkIsYUFBTyxJQUFQO0FBQ0Q7O0FBQ0QsVUFBTUUsa0JBQWtCckIsSUFBSXNCLFNBQUosQ0FBYyxDQUFkLEVBQWlCSCxZQUFqQixDQUF4QjtBQUNBLFVBQU1JLHNCQUFzQnZCLElBQUlzQixTQUFKLENBQWNILGVBQWUsQ0FBN0IsQ0FBNUI7O0FBRUEsVUFBTUgsWUFBWSxLQUFLMUYsZ0JBQUwsQ0FBc0IrRixlQUF0QixDQUFsQjs7QUFDQSxRQUFJLENBQUNMLFNBQUwsRUFBZ0I7QUFDZCxhQUFPLElBQVA7QUFDRDs7QUFDRCxVQUFNakcsZ0JBQWdCLEtBQUtLLGtCQUFMLENBQXdCbUcsbUJBQXhCLENBQXRCOztBQUNBLFFBQUksQ0FBRXhHLGFBQU4sRUFBcUI7QUFDbkIsYUFBTyxJQUFQO0FBQ0Q7O0FBRUQsVUFBTTZGLGFBQWE7QUFBQzdGLG1CQUFEO0FBQWdCaUc7QUFBaEIsS0FBbkI7O0FBQ0EsU0FBSzFDLE1BQUwsQ0FBWWdCLEdBQVosQ0FBZ0JxQixrQkFBaEIsRUFBb0NDLFVBQXBDOztBQUNBLFdBQU9BLFVBQVA7QUFDRDs7QUFDRHJCLG1CQUFpQm9CLGtCQUFqQixFQUFxQ0MsVUFBckMsRUFBaUQ7QUFDL0MsUUFBSSxDQUFFLEtBQUtuRyxVQUFYLEVBQXVCO0FBQ3JCLGFBQU8sSUFBUDtBQUNEOztBQUNELFVBQU1vRixnQkFBZ0IsS0FBS0gsY0FBTCxDQUFvQmlCLGtCQUFwQixDQUF0Qjs7QUFDQSxVQUFNWixnQkFDRTdFLEtBQUtDLFNBQUwsQ0FBZXlGLFdBQVdJLFNBQTFCLElBQXVDLElBQXZDLEdBQ0UsS0FBSy9GLHNCQUFMLENBQTRCMkYsV0FBVzdGLGFBQXZDLENBRlY7O0FBR0EsU0FBS3dDLGVBQUwsQ0FBcUJzQyxhQUFyQixFQUFvQ0UsYUFBcEM7QUFDRDs7QUF0TXlCLENBRDVCLEMiLCJmaWxlIjoiL3BhY2thZ2VzL2NhY2hpbmctY29tcGlsZXIuanMiLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBmcyA9IFBsdWdpbi5mcztcbmNvbnN0IHBhdGggPSBQbHVnaW4ucGF0aDtcbmNvbnN0IGNyZWF0ZUhhc2ggPSBOcG0ucmVxdWlyZSgnY3J5cHRvJykuY3JlYXRlSGFzaDtcbmNvbnN0IGFzc2VydCA9IE5wbS5yZXF1aXJlKCdhc3NlcnQnKTtcbmNvbnN0IEZ1dHVyZSA9IE5wbS5yZXF1aXJlKCdmaWJlcnMvZnV0dXJlJyk7XG5jb25zdCBMUlUgPSBOcG0ucmVxdWlyZSgnbHJ1LWNhY2hlJyk7XG5jb25zdCBhc3luYyA9IE5wbS5yZXF1aXJlKCdhc3luYycpO1xuXG4vLyBCYXNlIGNsYXNzIGZvciBDYWNoaW5nQ29tcGlsZXIgYW5kIE11bHRpRmlsZUNhY2hpbmdDb21waWxlci5cbkNhY2hpbmdDb21waWxlckJhc2UgPSBjbGFzcyBDYWNoaW5nQ29tcGlsZXJCYXNlIHtcbiAgY29uc3RydWN0b3Ioe1xuICAgIGNvbXBpbGVyTmFtZSxcbiAgICBkZWZhdWx0Q2FjaGVTaXplLFxuICAgIG1heFBhcmFsbGVsaXNtID0gMjAsXG4gIH0pIHtcbiAgICB0aGlzLl9jb21waWxlck5hbWUgPSBjb21waWxlck5hbWU7XG4gICAgdGhpcy5fbWF4UGFyYWxsZWxpc20gPSBtYXhQYXJhbGxlbGlzbTtcbiAgICBjb25zdCBlbnZWYXJQcmVmaXggPSAnTUVURU9SXycgKyBjb21waWxlck5hbWUudG9VcHBlckNhc2UoKSArICdfQ0FDSEVfJztcblxuICAgIGNvbnN0IGRlYnVnRW52VmFyID0gZW52VmFyUHJlZml4ICsgJ0RFQlVHJztcbiAgICB0aGlzLl9jYWNoZURlYnVnRW5hYmxlZCA9ICEhIHByb2Nlc3MuZW52W2RlYnVnRW52VmFyXTtcblxuICAgIGNvbnN0IGNhY2hlU2l6ZUVudlZhciA9IGVudlZhclByZWZpeCArICdTSVpFJztcbiAgICB0aGlzLl9jYWNoZVNpemUgPSArcHJvY2Vzcy5lbnZbY2FjaGVTaXplRW52VmFyXSB8fCBkZWZhdWx0Q2FjaGVTaXplO1xuXG4gICAgdGhpcy5fZGlza0NhY2hlID0gbnVsbDtcblxuICAgIC8vIEZvciB0ZXN0aW5nLlxuICAgIHRoaXMuX2NhbGxDb3VudCA9IDA7XG4gIH1cblxuICAvLyBZb3VyIHN1YmNsYXNzIG11c3Qgb3ZlcnJpZGUgdGhpcyBtZXRob2QgdG8gZGVmaW5lIHRoZSBrZXkgdXNlZCB0byBpZGVudGlmeVxuICAvLyBhIHBhcnRpY3VsYXIgdmVyc2lvbiBvZiBhbiBJbnB1dEZpbGUuXG4gIC8vXG4gIC8vIEdpdmVuIGFuIElucHV0RmlsZSAodGhlIGRhdGEgdHlwZSBwYXNzZWQgdG8gcHJvY2Vzc0ZpbGVzRm9yVGFyZ2V0IGFzIHBhcnRcbiAgLy8gb2YgdGhlIFBsdWdpbi5yZWdpc3RlckNvbXBpbGVyIEFQSSksIHJldHVybnMgYSBjYWNoZSBrZXkgdGhhdCByZXByZXNlbnRzXG4gIC8vIGl0LiBUaGlzIGNhY2hlIGtleSBjYW4gYmUgYW55IEpTT04gdmFsdWUgKGl0IHdpbGwgYmUgY29udmVydGVkIGludGVybmFsbHlcbiAgLy8gaW50byBhIGhhc2gpLiAgVGhpcyBzaG91bGQgcmVmbGVjdCBhbnkgYXNwZWN0IG9mIHRoZSBJbnB1dEZpbGUgdGhhdCBhZmZlY3RzXG4gIC8vIHRoZSBvdXRwdXQgb2YgYGNvbXBpbGVPbmVGaWxlYC4gVHlwaWNhbGx5IHlvdSdsbCB3YW50IHRvIGluY2x1ZGVcbiAgLy8gYGlucHV0RmlsZS5nZXREZWNsYXJlZEV4cG9ydHMoKWAsIGFuZCBwZXJoYXBzXG4gIC8vIGBpbnB1dEZpbGUuZ2V0UGF0aEluUGFja2FnZSgpYCBvciBgaW5wdXRGaWxlLmdldERlY2xhcmVkRXhwb3J0c2AgaWZcbiAgLy8gYGNvbXBpbGVPbmVGaWxlYCBwYXlzIGF0dGVudGlvbiB0byB0aGVtLlxuICAvL1xuICAvLyBOb3RlIHRoYXQgZm9yIE11bHRpRmlsZUNhY2hpbmdDb21waWxlciwgeW91ciBjYWNoZSBrZXkgZG9lc24ndCBuZWVkIHRvXG4gIC8vIGluY2x1ZGUgdGhlIGZpbGUncyBwYXRoLCBiZWNhdXNlIHRoYXQgaXMgYXV0b21hdGljYWxseSB0YWtlbiBpbnRvIGFjY291bnRcbiAgLy8gYnkgdGhlIGltcGxlbWVudGF0aW9uLiBDYWNoaW5nQ29tcGlsZXIgc3ViY2xhc3NlcyBjYW4gY2hvb3NlIHdoZXRoZXIgb3Igbm90XG4gIC8vIHRvIGluY2x1ZGUgdGhlIGZpbGUncyBwYXRoIGluIHRoZSBjYWNoZSBrZXkuXG4gIGdldENhY2hlS2V5KGlucHV0RmlsZSkge1xuICAgIHRocm93IEVycm9yKCdDYWNoaW5nQ29tcGlsZXIgc3ViY2xhc3Mgc2hvdWxkIGltcGxlbWVudCBnZXRDYWNoZUtleSEnKTtcbiAgfVxuXG4gIC8vIFlvdXIgc3ViY2xhc3MgbXVzdCBvdmVycmlkZSB0aGlzIG1ldGhvZCB0byBkZWZpbmUgaG93IGEgQ29tcGlsZVJlc3VsdFxuICAvLyB0cmFuc2xhdGVzIGludG8gYWRkaW5nIGFzc2V0cyB0byB0aGUgYnVuZGxlLlxuICAvL1xuICAvLyBUaGlzIG1ldGhvZCBpcyBnaXZlbiBhbiBJbnB1dEZpbGUgKHRoZSBkYXRhIHR5cGUgcGFzc2VkIHRvXG4gIC8vIHByb2Nlc3NGaWxlc0ZvclRhcmdldCBhcyBwYXJ0IG9mIHRoZSBQbHVnaW4ucmVnaXN0ZXJDb21waWxlciBBUEkpIGFuZCBhXG4gIC8vIENvbXBpbGVSZXN1bHQgKGVpdGhlciByZXR1cm5lZCBkaXJlY3RseSBmcm9tIGNvbXBpbGVPbmVGaWxlIG9yIHJlYWQgZnJvbVxuICAvLyB0aGUgY2FjaGUpLiAgSXQgc2hvdWxkIGNhbGwgbWV0aG9kcyBsaWtlIGBpbnB1dEZpbGUuYWRkSmF2YVNjcmlwdGBcbiAgLy8gYW5kIGBpbnB1dEZpbGUuZXJyb3JgLlxuICBhZGRDb21waWxlUmVzdWx0KGlucHV0RmlsZSwgY29tcGlsZVJlc3VsdCkge1xuICAgIHRocm93IEVycm9yKCdDYWNoaW5nQ29tcGlsZXIgc3ViY2xhc3Mgc2hvdWxkIGltcGxlbWVudCBhZGRDb21waWxlUmVzdWx0IScpO1xuICB9XG5cbiAgLy8gWW91ciBzdWJjbGFzcyBtdXN0IG92ZXJyaWRlIHRoaXMgbWV0aG9kIHRvIGRlZmluZSB0aGUgc2l6ZSBvZiBhXG4gIC8vIENvbXBpbGVyUmVzdWx0ICh1c2VkIGJ5IHRoZSBpbi1tZW1vcnkgY2FjaGUgdG8gbGltaXQgdGhlIHRvdGFsIGFtb3VudCBvZlxuICAvLyBkYXRhIGNhY2hlZCkuXG4gIGNvbXBpbGVSZXN1bHRTaXplKGNvbXBpbGVSZXN1bHQpIHtcbiAgICB0aHJvdyBFcnJvcignQ2FjaGluZ0NvbXBpbGVyIHN1YmNsYXNzIHNob3VsZCBpbXBsZW1lbnQgY29tcGlsZVJlc3VsdFNpemUhJyk7XG4gIH1cblxuICAvLyBZb3VyIHN1YmNsYXNzIG1heSBvdmVycmlkZSB0aGlzIG1ldGhvZCB0byBkZWZpbmUgYW4gYWx0ZXJuYXRlIHdheSBvZlxuICAvLyBzdHJpbmdpZnlpbmcgQ29tcGlsZXJSZXN1bHRzLiAgVGFrZXMgYSBDb21waWxlUmVzdWx0IGFuZCByZXR1cm5zIGEgc3RyaW5nLlxuICBzdHJpbmdpZnlDb21waWxlUmVzdWx0KGNvbXBpbGVSZXN1bHQpIHtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoY29tcGlsZVJlc3VsdCk7XG4gIH1cbiAgLy8gWW91ciBzdWJjbGFzcyBtYXkgb3ZlcnJpZGUgdGhpcyBtZXRob2QgdG8gZGVmaW5lIGFuIGFsdGVybmF0ZSB3YXkgb2ZcbiAgLy8gcGFyc2luZyBDb21waWxlclJlc3VsdHMgZnJvbSBzdHJpbmcuICBUYWtlcyBhIHN0cmluZyBhbmQgcmV0dXJucyBhXG4gIC8vIENvbXBpbGVSZXN1bHQuICBJZiB0aGUgc3RyaW5nIGRvZXNuJ3QgcmVwcmVzZW50IGEgdmFsaWQgQ29tcGlsZVJlc3VsdCwgeW91XG4gIC8vIG1heSB3YW50IHRvIHJldHVybiBudWxsIGluc3RlYWQgb2YgdGhyb3dpbmcsIHdoaWNoIHdpbGwgbWFrZVxuICAvLyBDYWNoaW5nQ29tcGlsZXIgaWdub3JlIHRoZSBjYWNoZS5cbiAgcGFyc2VDb21waWxlUmVzdWx0KHN0cmluZ2lmaWVkQ29tcGlsZVJlc3VsdCkge1xuICAgIHJldHVybiB0aGlzLl9wYXJzZUpTT05Pck51bGwoc3RyaW5naWZpZWRDb21waWxlUmVzdWx0KTtcbiAgfVxuICBfcGFyc2VKU09OT3JOdWxsKGpzb24pIHtcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIEpTT04ucGFyc2UoanNvbik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgaWYgKGUgaW5zdGFuY2VvZiBTeW50YXhFcnJvcilcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB0aHJvdyBlO1xuICAgIH1cbiAgfVxuXG4gIF9jYWNoZURlYnVnKG1lc3NhZ2UpIHtcbiAgICBpZiAoIXRoaXMuX2NhY2hlRGVidWdFbmFibGVkKVxuICAgICAgcmV0dXJuO1xuICAgIGNvbnNvbGUubG9nKGBDQUNIRSgkeyB0aGlzLl9jb21waWxlck5hbWUgfSk6ICR7IG1lc3NhZ2UgfWApO1xuICB9XG5cbiAgc2V0RGlza0NhY2hlRGlyZWN0b3J5KGRpc2tDYWNoZSkge1xuICAgIGlmICh0aGlzLl9kaXNrQ2FjaGUpXG4gICAgICB0aHJvdyBFcnJvcignc2V0RGlza0NhY2hlRGlyZWN0b3J5IGNhbGxlZCB0d2ljZT8nKTtcbiAgICB0aGlzLl9kaXNrQ2FjaGUgPSBkaXNrQ2FjaGU7XG4gIH1cblxuICAvLyBTaW5jZSBzbyBtYW55IGNvbXBpbGVycyB3aWxsIG5lZWQgdG8gY2FsY3VsYXRlIHRoZSBzaXplIG9mIGEgU291cmNlTWFwIGluXG4gIC8vIHRoZWlyIGNvbXBpbGVSZXN1bHRTaXplLCB0aGlzIG1ldGhvZCBpcyBwcm92aWRlZC5cbiAgc291cmNlTWFwU2l6ZShzbSkge1xuICAgIGlmICghIHNtKSByZXR1cm4gMDtcbiAgICAvLyBzdW0gdGhlIGxlbmd0aCBvZiBzb3VyY2VzIGFuZCB0aGUgbWFwcGluZ3MsIHRoZSBzaXplIG9mXG4gICAgLy8gbWV0YWRhdGEgaXMgaWdub3JlZCwgYnV0IGl0IGlzIG5vdCBhIGJpZyBkZWFsXG4gICAgcmV0dXJuIHNtLm1hcHBpbmdzLmxlbmd0aFxuICAgICAgKyAoc20uc291cmNlc0NvbnRlbnQgfHwgW10pLnJlZHVjZShmdW5jdGlvbiAoc29GYXIsIGN1cnJlbnQpIHtcbiAgICAgICAgcmV0dXJuIHNvRmFyICsgKGN1cnJlbnQgPyBjdXJyZW50Lmxlbmd0aCA6IDApO1xuICAgICAgfSwgMCk7XG4gIH1cblxuICAvLyBCb3Jyb3dlZCBmcm9tIGFub3RoZXIgTUlULWxpY2Vuc2VkIHByb2plY3QgdGhhdCBiZW5qYW1uIHdyb3RlOlxuICAvLyBodHRwczovL2dpdGh1Yi5jb20vcmVhY3Rqcy9jb21tb25lci9ibG9iLzIzNWQ1NGExMmMvbGliL3V0aWwuanMjTDEzNi1MMTY4XG4gIF9kZWVwSGFzaCh2YWwpIHtcbiAgICBjb25zdCBoYXNoID0gY3JlYXRlSGFzaCgnc2hhMScpO1xuICAgIGxldCB0eXBlID0gdHlwZW9mIHZhbDtcblxuICAgIGlmICh2YWwgPT09IG51bGwpIHtcbiAgICAgIHR5cGUgPSAnbnVsbCc7XG4gICAgfVxuICAgIGhhc2gudXBkYXRlKHR5cGUgKyAnXFwwJyk7XG5cbiAgICBzd2l0Y2ggKHR5cGUpIHtcbiAgICBjYXNlICdvYmplY3QnOlxuICAgICAgY29uc3Qga2V5cyA9IE9iamVjdC5rZXlzKHZhbCk7XG5cbiAgICAgIC8vIEFycmF5IGtleXMgd2lsbCBhbHJlYWR5IGJlIHNvcnRlZC5cbiAgICAgIGlmICghIEFycmF5LmlzQXJyYXkodmFsKSkge1xuICAgICAgICBrZXlzLnNvcnQoKTtcbiAgICAgIH1cblxuICAgICAga2V5cy5mb3JFYWNoKChrZXkpID0+IHtcbiAgICAgICAgaWYgKHR5cGVvZiB2YWxba2V5XSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgIC8vIFNpbGVudGx5IGlnbm9yZSBuZXN0ZWQgbWV0aG9kcywgYnV0IG5ldmVydGhlbGVzcyBjb21wbGFpbiBiZWxvd1xuICAgICAgICAgIC8vIGlmIHRoZSByb290IHZhbHVlIGlzIGEgZnVuY3Rpb24uXG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaGFzaC51cGRhdGUoa2V5ICsgJ1xcMCcpLnVwZGF0ZSh0aGlzLl9kZWVwSGFzaCh2YWxba2V5XSkpO1xuICAgICAgfSk7XG5cbiAgICAgIGJyZWFrO1xuXG4gICAgY2FzZSAnZnVuY3Rpb24nOlxuICAgICAgYXNzZXJ0Lm9rKGZhbHNlLCAnY2Fubm90IGhhc2ggZnVuY3Rpb24gb2JqZWN0cycpO1xuICAgICAgYnJlYWs7XG5cbiAgICBkZWZhdWx0OlxuICAgICAgaGFzaC51cGRhdGUoJycgKyB2YWwpO1xuICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgcmV0dXJuIGhhc2guZGlnZXN0KCdoZXgnKTtcbiAgfVxuXG4gIC8vIFdlIHdhbnQgdG8gd3JpdGUgdGhlIGZpbGUgYXRvbWljYWxseS4gQnV0IHdlIGFsc28gZG9uJ3Qgd2FudCB0byBibG9ja1xuICAvLyBwcm9jZXNzaW5nIG9uIHRoZSBmaWxlIHdyaXRlLlxuICBfd3JpdGVGaWxlQXN5bmMoZmlsZW5hbWUsIGNvbnRlbnRzKSB7XG4gICAgY29uc3QgdGVtcEZpbGVuYW1lID0gZmlsZW5hbWUgKyAnLnRtcC4nICsgUmFuZG9tLmlkKCk7XG4gICAgaWYgKHRoaXMuX2NhY2hlRGVidWdFbmFibGVkKSB7XG4gICAgICAvLyBXcml0ZSBjYWNoZSBmaWxlIHN5bmNocm9ub3VzbHkgd2hlbiBjYWNoZSBkZWJ1Z2dpbmcgZW5hYmxlZC5cbiAgICAgIHRyeSB7XG4gICAgICAgIGZzLndyaXRlRmlsZVN5bmModGVtcEZpbGVuYW1lLCBjb250ZW50cyk7XG4gICAgICAgIGZzLnJlbmFtZVN5bmModGVtcEZpbGVuYW1lLCBmaWxlbmFtZSk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIC8vIGlnbm9yZSBlcnJvcnMsIGl0J3MganVzdCBhIGNhY2hlXG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGZzLndyaXRlRmlsZSh0ZW1wRmlsZW5hbWUsIGNvbnRlbnRzLCBlcnIgPT4ge1xuICAgICAgICAvLyBpZ25vcmUgZXJyb3JzLCBpdCdzIGp1c3QgYSBjYWNoZVxuICAgICAgICBpZiAoISBlcnIpIHtcbiAgICAgICAgICBmcy5yZW5hbWUodGVtcEZpbGVuYW1lLCBmaWxlbmFtZSwgZXJyID0+IHt9KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgLy8gSGVscGVyIGZ1bmN0aW9uLiBSZXR1cm5zIHRoZSBib2R5IG9mIHRoZSBmaWxlIGFzIGEgc3RyaW5nLCBvciBudWxsIGlmIGl0XG4gIC8vIGRvZXNuJ3QgZXhpc3QuXG4gIF9yZWFkRmlsZU9yTnVsbChmaWxlbmFtZSkge1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4gZnMucmVhZEZpbGVTeW5jKGZpbGVuYW1lLCAndXRmOCcpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGlmIChlICYmIGUuY29kZSA9PT0gJ0VOT0VOVCcpXG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgdGhyb3cgZTtcbiAgICB9XG4gIH1cbn1cblxuLy8gQ2FjaGluZ0NvbXBpbGVyIGlzIGEgY2xhc3MgZGVzaWduZWQgdG8gYmUgdXNlZCB3aXRoIFBsdWdpbi5yZWdpc3RlckNvbXBpbGVyXG4vLyB3aGljaCBpbXBsZW1lbnRzIGluLW1lbW9yeSBhbmQgb24tZGlzayBjYWNoZXMgZm9yIHRoZSBmaWxlcyB0aGF0IGl0XG4vLyBwcm9jZXNzZXMuICBZb3Ugc2hvdWxkIHN1YmNsYXNzIENhY2hpbmdDb21waWxlciBhbmQgZGVmaW5lIHRoZSBmb2xsb3dpbmdcbi8vIG1ldGhvZHM6IGdldENhY2hlS2V5LCBjb21waWxlT25lRmlsZSwgYWRkQ29tcGlsZVJlc3VsdCwgYW5kXG4vLyBjb21waWxlUmVzdWx0U2l6ZS5cbi8vXG4vLyBDYWNoaW5nQ29tcGlsZXIgYXNzdW1lcyB0aGF0IGZpbGVzIGFyZSBwcm9jZXNzZWQgaW5kZXBlbmRlbnRseSBvZiBlYWNoIG90aGVyO1xuLy8gdGhlcmUgaXMgbm8gJ2ltcG9ydCcgZGlyZWN0aXZlIGFsbG93aW5nIG9uZSBmaWxlIHRvIHJlZmVyZW5jZSBhbm90aGVyLiAgVGhhdFxuLy8gaXMsIGVkaXRpbmcgb25lIGZpbGUgc2hvdWxkIG9ubHkgcmVxdWlyZSB0aGF0IGZpbGUgdG8gYmUgcmVidWlsdCwgbm90IG90aGVyXG4vLyBmaWxlcy5cbi8vXG4vLyBUaGUgZGF0YSB0aGF0IGlzIGNhY2hlZCBmb3IgZWFjaCBmaWxlIGlzIG9mIGEgdHlwZSB0aGF0IGlzIChpbXBsaWNpdGx5KVxuLy8gZGVmaW5lZCBieSB5b3VyIHN1YmNsYXNzLiBDYWNoaW5nQ29tcGlsZXIgcmVmZXJzIHRvIHRoaXMgdHlwZSBhc1xuLy8gYENvbXBpbGVSZXN1bHRgLCBidXQgdGhpcyBpc24ndCBhIHNpbmdsZSB0eXBlOiBpdCdzIHVwIHRvIHlvdXIgc3ViY2xhc3MgdG9cbi8vIGRlY2lkZSB3aGF0IHR5cGUgb2YgZGF0YSB0aGlzIGlzLiAgWW91IHNob3VsZCBkb2N1bWVudCB3aGF0IHlvdXIgc3ViY2xhc3Mnc1xuLy8gQ29tcGlsZVJlc3VsdCB0eXBlIGlzLlxuLy9cbi8vIFlvdXIgc3ViY2xhc3MncyBjb21waWxlciBzaG91bGQgY2FsbCB0aGUgc3VwZXJjbGFzcyBjb21waWxlciBzcGVjaWZ5aW5nIHRoZVxuLy8gY29tcGlsZXIgbmFtZSAodXNlZCB0byBnZW5lcmF0ZSBlbnZpcm9ubWVudCB2YXJpYWJsZXMgZm9yIGRlYnVnZ2luZyBhbmRcbi8vIHR3ZWFraW5nIGluLW1lbW9yeSBjYWNoZSBzaXplKSBhbmQgdGhlIGRlZmF1bHQgY2FjaGUgc2l6ZS5cbi8vXG4vLyBCeSBkZWZhdWx0LCBDYWNoaW5nQ29tcGlsZXIgcHJvY2Vzc2VzIGVhY2ggZmlsZSBpbiBcInBhcmFsbGVsXCIuIFRoYXQgaXMsIGlmIGl0XG4vLyBuZWVkcyB0byB5aWVsZCB0byByZWFkIGZyb20gdGhlIGRpc2sgY2FjaGUsIG9yIGlmIGdldENhY2hlS2V5LFxuLy8gY29tcGlsZU9uZUZpbGUsIG9yIGFkZENvbXBpbGVSZXN1bHQgeWllbGRzLCBpdCB3aWxsIHN0YXJ0IHByb2Nlc3NpbmcgdGhlIG5leHRcbi8vIGZldyBmaWxlcy4gVG8gc2V0IGhvdyBtYW55IGZpbGVzIGNhbiBiZSBwcm9jZXNzZWQgaW4gcGFyYWxsZWwgKGluY2x1ZGluZ1xuLy8gc2V0dGluZyBpdCB0byAxIGlmIHlvdXIgc3ViY2xhc3MgZG9lc24ndCBzdXBwb3J0IGFueSBwYXJhbGxlbGlzbSksIHBhc3MgdGhlXG4vLyBtYXhQYXJhbGxlbGlzbSBvcHRpb24gdG8gdGhlIHN1cGVyY2xhc3MgY29uc3RydWN0b3IuXG4vL1xuLy8gRm9yIGV4YW1wbGUgKHVzaW5nIEVTMjAxNSB2aWEgdGhlIGVjbWFzY3JpcHQgcGFja2FnZSk6XG4vL1xuLy8gICBjbGFzcyBBd2Vzb21lQ29tcGlsZXIgZXh0ZW5kcyBDYWNoaW5nQ29tcGlsZXIge1xuLy8gICAgIGNvbnN0cnVjdG9yKCkge1xuLy8gICAgICAgc3VwZXIoe1xuLy8gICAgICAgICBjb21waWxlck5hbWU6ICdhd2Vzb21lJyxcbi8vICAgICAgICAgZGVmYXVsdENhY2hlU2l6ZTogMTAyNCoxMDI0KjEwLFxuLy8gICAgICAgfSk7XG4vLyAgICAgfVxuLy8gICAgIC8vIC4uLiBkZWZpbmUgdGhlIG90aGVyIG1ldGhvZHNcbi8vICAgfVxuLy8gICBQbHVnaW4ucmVnaXN0ZXJDb21waWxlKHtcbi8vICAgICBleHRlbnNpb25zOiBbJ2F3ZXNvbWUnXSxcbi8vICAgfSwgKCkgPT4gbmV3IEF3ZXNvbWVDb21waWxlcigpKTtcbi8vXG4vLyBYWFggbWF5YmUgY29tcGlsZVJlc3VsdFNpemUgYW5kIHN0cmluZ2lmeUNvbXBpbGVSZXN1bHQgc2hvdWxkIGp1c3QgYmUgbWV0aG9kc1xuLy8gb24gQ29tcGlsZVJlc3VsdD8gU29ydCBvZiBoYXJkIHRvIGRvIHRoYXQgd2l0aCBwYXJzZUNvbXBpbGVSZXN1bHQuXG5DYWNoaW5nQ29tcGlsZXIgPSBjbGFzcyBDYWNoaW5nQ29tcGlsZXIgZXh0ZW5kcyBDYWNoaW5nQ29tcGlsZXJCYXNlIHtcbiAgY29uc3RydWN0b3Ioe1xuICAgIGNvbXBpbGVyTmFtZSxcbiAgICBkZWZhdWx0Q2FjaGVTaXplLFxuICAgIG1heFBhcmFsbGVsaXNtID0gMjAsXG4gIH0pIHtcbiAgICBzdXBlcih7Y29tcGlsZXJOYW1lLCBkZWZhdWx0Q2FjaGVTaXplLCBtYXhQYXJhbGxlbGlzbX0pO1xuXG4gICAgLy8gTWFwcyBmcm9tIGEgaGFzaGVkIGNhY2hlIGtleSB0byBhIGNvbXBpbGVSZXN1bHQuXG4gICAgdGhpcy5fY2FjaGUgPSBuZXcgTFJVKHtcbiAgICAgIG1heDogdGhpcy5fY2FjaGVTaXplLFxuICAgICAgbGVuZ3RoOiAodmFsdWUpID0+IHRoaXMuY29tcGlsZVJlc3VsdFNpemUodmFsdWUpLFxuICAgIH0pO1xuICB9XG5cbiAgLy8gWW91ciBzdWJjbGFzcyBtdXN0IG92ZXJyaWRlIHRoaXMgbWV0aG9kIHRvIGRlZmluZSB0aGUgdHJhbnNmb3JtYXRpb24gZnJvbVxuICAvLyBJbnB1dEZpbGUgdG8gaXRzIGNhY2hlYWJsZSBDb21waWxlUmVzdWx0KS5cbiAgLy9cbiAgLy8gR2l2ZW4gYW4gSW5wdXRGaWxlICh0aGUgZGF0YSB0eXBlIHBhc3NlZCB0byBwcm9jZXNzRmlsZXNGb3JUYXJnZXQgYXMgcGFydFxuICAvLyBvZiB0aGUgUGx1Z2luLnJlZ2lzdGVyQ29tcGlsZXIgQVBJKSwgY29tcGlsZXMgdGhlIGZpbGUgYW5kIHJldHVybnMgYVxuICAvLyBDb21waWxlUmVzdWx0ICh0aGUgY2FjaGVhYmxlIGRhdGEgdHlwZSBzcGVjaWZpYyB0byB5b3VyIHN1YmNsYXNzKS5cbiAgLy9cbiAgLy8gVGhpcyBtZXRob2QgaXMgbm90IGNhbGxlZCBvbiBmaWxlcyB3aGVuIGEgdmFsaWQgY2FjaGUgZW50cnkgZXhpc3RzIGluXG4gIC8vIG1lbW9yeSBvciBvbiBkaXNrLlxuICAvL1xuICAvLyBPbiBhIGNvbXBpbGUgZXJyb3IsIHlvdSBzaG91bGQgY2FsbCBgaW5wdXRGaWxlLmVycm9yYCBhcHByb3ByaWF0ZWx5IGFuZFxuICAvLyByZXR1cm4gbnVsbDsgdGhpcyB3aWxsIG5vdCBiZSBjYWNoZWQuXG4gIC8vXG4gIC8vIFRoaXMgbWV0aG9kIHNob3VsZCBub3QgY2FsbCBgaW5wdXRGaWxlLmFkZEphdmFTY3JpcHRgIGFuZCBzaW1pbGFyIGZpbGVzIVxuICAvLyBUaGF0J3Mgd2hhdCBhZGRDb21waWxlUmVzdWx0IGlzIGZvci5cbiAgY29tcGlsZU9uZUZpbGUoaW5wdXRGaWxlKSB7XG4gICAgdGhyb3cgRXJyb3IoJ0NhY2hpbmdDb21waWxlciBzdWJjbGFzcyBzaG91bGQgaW1wbGVtZW50IGNvbXBpbGVPbmVGaWxlIScpO1xuICB9XG5cbiAgLy8gVGhlIHByb2Nlc3NGaWxlc0ZvclRhcmdldCBtZXRob2QgZnJvbSB0aGUgUGx1Z2luLnJlZ2lzdGVyQ29tcGlsZXIgQVBJLiBJZlxuICAvLyB5b3UgaGF2ZSBwcm9jZXNzaW5nIHlvdSB3YW50IHRvIHBlcmZvcm0gYXQgdGhlIGJlZ2lubmluZyBvciBlbmQgb2YgYVxuICAvLyBwcm9jZXNzaW5nIHBoYXNlLCB5b3UgbWF5IHdhbnQgdG8gb3ZlcnJpZGUgdGhpcyBtZXRob2QgYW5kIGNhbGwgdGhlXG4gIC8vIHN1cGVyY2xhc3MgaW1wbGVtZW50YXRpb24gZnJvbSB3aXRoaW4geW91ciBtZXRob2QuXG4gIHByb2Nlc3NGaWxlc0ZvclRhcmdldChpbnB1dEZpbGVzKSB7XG4gICAgY29uc3QgY2FjaGVNaXNzZXMgPSBbXTtcblxuICAgIGNvbnN0IGZ1dHVyZSA9IG5ldyBGdXR1cmU7XG4gICAgYXN5bmMuZWFjaExpbWl0KGlucHV0RmlsZXMsIHRoaXMuX21heFBhcmFsbGVsaXNtLCAoaW5wdXRGaWxlLCBjYikgPT4ge1xuICAgICAgbGV0IGVycm9yID0gbnVsbDtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGNhY2hlS2V5ID0gdGhpcy5fZGVlcEhhc2godGhpcy5nZXRDYWNoZUtleShpbnB1dEZpbGUpKTtcbiAgICAgICAgbGV0IGNvbXBpbGVSZXN1bHQgPSB0aGlzLl9jYWNoZS5nZXQoY2FjaGVLZXkpO1xuXG4gICAgICAgIGlmICghIGNvbXBpbGVSZXN1bHQpIHtcbiAgICAgICAgICBjb21waWxlUmVzdWx0ID0gdGhpcy5fcmVhZENhY2hlKGNhY2hlS2V5KTtcbiAgICAgICAgICBpZiAoY29tcGlsZVJlc3VsdCkge1xuICAgICAgICAgICAgdGhpcy5fY2FjaGVEZWJ1ZyhgTG9hZGVkICR7IGlucHV0RmlsZS5nZXREaXNwbGF5UGF0aCgpIH1gKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoISBjb21waWxlUmVzdWx0KSB7XG4gICAgICAgICAgY2FjaGVNaXNzZXMucHVzaChpbnB1dEZpbGUuZ2V0RGlzcGxheVBhdGgoKSk7XG4gICAgICAgICAgY29tcGlsZVJlc3VsdCA9IHRoaXMuY29tcGlsZU9uZUZpbGUoaW5wdXRGaWxlKTtcblxuICAgICAgICAgIGlmICghIGNvbXBpbGVSZXN1bHQpIHtcbiAgICAgICAgICAgIC8vIGNvbXBpbGVPbmVGaWxlIHNob3VsZCBoYXZlIGNhbGxlZCBpbnB1dEZpbGUuZXJyb3IuXG4gICAgICAgICAgICAvLyAgV2UgZG9uJ3QgY2FjaGUgZmFpbHVyZXMgZm9yIG5vdy5cbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBTYXZlIHdoYXQgd2UndmUgY29tcGlsZWQuXG4gICAgICAgICAgdGhpcy5fY2FjaGUuc2V0KGNhY2hlS2V5LCBjb21waWxlUmVzdWx0KTtcbiAgICAgICAgICB0aGlzLl93cml0ZUNhY2hlQXN5bmMoY2FjaGVLZXksIGNvbXBpbGVSZXN1bHQpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5hZGRDb21waWxlUmVzdWx0KGlucHV0RmlsZSwgY29tcGlsZVJlc3VsdCk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGVycm9yID0gZTtcbiAgICAgIH0gZmluYWxseSB7XG4gICAgICAgIGNiKGVycm9yKTtcbiAgICAgIH1cbiAgICB9LCBmdXR1cmUucmVzb2x2ZXIoKSk7XG4gICAgZnV0dXJlLndhaXQoKTtcblxuICAgIGlmICh0aGlzLl9jYWNoZURlYnVnRW5hYmxlZCkge1xuICAgICAgY2FjaGVNaXNzZXMuc29ydCgpO1xuICAgICAgdGhpcy5fY2FjaGVEZWJ1ZyhcbiAgICAgICAgYFJhbiAoIyR7ICsrdGhpcy5fY2FsbENvdW50IH0pIG9uOiAkeyBKU09OLnN0cmluZ2lmeShjYWNoZU1pc3NlcykgfWApO1xuICAgIH1cbiAgfVxuXG4gIF9jYWNoZUZpbGVuYW1lKGNhY2hlS2V5KSB7XG4gICAgLy8gV2Ugd2FudCBjYWNoZUtleXMgdG8gYmUgaGV4IHNvIHRoYXQgdGhleSB3b3JrIG9uIGFueSBGUyBhbmQgbmV2ZXIgZW5kIGluXG4gICAgLy8gLmNhY2hlLlxuICAgIGlmICghL15bYS1mMC05XSskLy50ZXN0KGNhY2hlS2V5KSkge1xuICAgICAgdGhyb3cgRXJyb3IoJ2JhZCBjYWNoZUtleTogJyArIGNhY2hlS2V5KTtcbiAgICB9XG4gICAgcmV0dXJuIHBhdGguam9pbih0aGlzLl9kaXNrQ2FjaGUsIGNhY2hlS2V5ICsgJy5jYWNoZScpO1xuICB9XG4gIC8vIExvYWQgYSBjYWNoZSBlbnRyeSBmcm9tIGRpc2suIFJldHVybnMgdGhlIGNvbXBpbGVSZXN1bHQgb2JqZWN0XG4gIC8vIGFuZCBsb2FkcyBpdCBpbnRvIHRoZSBpbi1tZW1vcnkgY2FjaGUgdG9vLlxuICBfcmVhZENhY2hlKGNhY2hlS2V5KSB7XG4gICAgaWYgKCEgdGhpcy5fZGlza0NhY2hlKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgY29uc3QgY2FjaGVGaWxlbmFtZSA9IHRoaXMuX2NhY2hlRmlsZW5hbWUoY2FjaGVLZXkpO1xuICAgIGNvbnN0IGNvbXBpbGVSZXN1bHQgPSB0aGlzLl9yZWFkQW5kUGFyc2VDb21waWxlUmVzdWx0T3JOdWxsKGNhY2hlRmlsZW5hbWUpO1xuICAgIGlmICghIGNvbXBpbGVSZXN1bHQpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICB0aGlzLl9jYWNoZS5zZXQoY2FjaGVLZXksIGNvbXBpbGVSZXN1bHQpO1xuICAgIHJldHVybiBjb21waWxlUmVzdWx0O1xuICB9XG4gIF93cml0ZUNhY2hlQXN5bmMoY2FjaGVLZXksIGNvbXBpbGVSZXN1bHQpIHtcbiAgICBpZiAoISB0aGlzLl9kaXNrQ2FjaGUpXG4gICAgICByZXR1cm47XG4gICAgY29uc3QgY2FjaGVGaWxlbmFtZSA9IHRoaXMuX2NhY2hlRmlsZW5hbWUoY2FjaGVLZXkpO1xuICAgIGNvbnN0IGNhY2hlQ29udGVudHMgPSB0aGlzLnN0cmluZ2lmeUNvbXBpbGVSZXN1bHQoY29tcGlsZVJlc3VsdCk7XG4gICAgdGhpcy5fd3JpdGVGaWxlQXN5bmMoY2FjaGVGaWxlbmFtZSwgY2FjaGVDb250ZW50cyk7XG4gIH1cblxuICAvLyBSZXR1cm5zIG51bGwgaWYgdGhlIGZpbGUgZG9lcyBub3QgZXhpc3Qgb3IgY2FuJ3QgYmUgcGFyc2VkOyBvdGhlcndpc2VcbiAgLy8gcmV0dXJucyB0aGUgcGFyc2VkIGNvbXBpbGVSZXN1bHQgaW4gdGhlIGZpbGUuXG4gIF9yZWFkQW5kUGFyc2VDb21waWxlUmVzdWx0T3JOdWxsKGZpbGVuYW1lKSB7XG4gICAgY29uc3QgcmF3ID0gdGhpcy5fcmVhZEZpbGVPck51bGwoZmlsZW5hbWUpO1xuICAgIHJldHVybiB0aGlzLnBhcnNlQ29tcGlsZVJlc3VsdChyYXcpO1xuICB9XG59XG4iLCJjb25zdCBwYXRoID0gUGx1Z2luLnBhdGg7XG5jb25zdCBGdXR1cmUgPSBOcG0ucmVxdWlyZSgnZmliZXJzL2Z1dHVyZScpO1xuY29uc3QgTFJVID0gTnBtLnJlcXVpcmUoJ2xydS1jYWNoZScpO1xuY29uc3QgYXN5bmMgPSBOcG0ucmVxdWlyZSgnYXN5bmMnKTtcblxuLy8gTXVsdGlGaWxlQ2FjaGluZ0NvbXBpbGVyIGlzIGxpa2UgQ2FjaGluZ0NvbXBpbGVyLCBidXQgZm9yIGltcGxlbWVudGluZ1xuLy8gbGFuZ3VhZ2VzIHdoaWNoIGFsbG93IGZpbGVzIHRvIHJlZmVyZW5jZSBlYWNoIG90aGVyLCBzdWNoIGFzIENTU1xuLy8gcHJlcHJvY2Vzc29ycyB3aXRoIGBAaW1wb3J0YCBkaXJlY3RpdmVzLlxuLy9cbi8vIExpa2UgQ2FjaGluZ0NvbXBpbGVyLCB5b3Ugc2hvdWxkIHN1YmNsYXNzIE11bHRpRmlsZUNhY2hpbmdDb21waWxlciBhbmQgZGVmaW5lXG4vLyB0aGUgZm9sbG93aW5nIG1ldGhvZHM6IGdldENhY2hlS2V5LCBjb21waWxlT25lRmlsZSwgYWRkQ29tcGlsZVJlc3VsdCwgYW5kXG4vLyBjb21waWxlUmVzdWx0U2l6ZS4gIGNvbXBpbGVPbmVGaWxlIGdldHMgYW4gYWRkaXRpb25hbCBhbGxGaWxlcyBhcmd1bWVudCBhbmRcbi8vIHJldHVybnMgYW4gYXJyYXkgb2YgcmVmZXJlbmNlZCBpbXBvcnQgcGF0aHMgaW4gYWRkaXRpb24gdG8gdGhlIENvbXBpbGVSZXN1bHQuXG4vLyBZb3UgbWF5IGFsc28gb3ZlcnJpZGUgaXNSb290IGFuZCBnZXRBYnNvbHV0ZUltcG9ydFBhdGggdG8gY3VzdG9taXplXG4vLyBNdWx0aUZpbGVDYWNoaW5nQ29tcGlsZXIgZnVydGhlci5cbk11bHRpRmlsZUNhY2hpbmdDb21waWxlciA9IGNsYXNzIE11bHRpRmlsZUNhY2hpbmdDb21waWxlclxuZXh0ZW5kcyBDYWNoaW5nQ29tcGlsZXJCYXNlIHtcbiAgY29uc3RydWN0b3Ioe1xuICAgIGNvbXBpbGVyTmFtZSxcbiAgICBkZWZhdWx0Q2FjaGVTaXplLFxuICAgIG1heFBhcmFsbGVsaXNtXG4gIH0pIHtcbiAgICBzdXBlcih7Y29tcGlsZXJOYW1lLCBkZWZhdWx0Q2FjaGVTaXplLCBtYXhQYXJhbGxlbGlzbX0pO1xuXG4gICAgLy8gTWFwcyBmcm9tIGFic29sdXRlIGltcG9ydCBwYXRoIHRvIHsgY29tcGlsZVJlc3VsdCwgY2FjaGVLZXlzIH0sIHdoZXJlXG4gICAgLy8gY2FjaGVLZXlzIGlzIGFuIG9iamVjdCBtYXBwaW5nIGZyb20gYWJzb2x1dGUgaW1wb3J0IHBhdGggdG8gaGFzaGVkXG4gICAgLy8gY2FjaGVLZXkgZm9yIGVhY2ggZmlsZSByZWZlcmVuY2VkIGJ5IHRoaXMgZmlsZSAoaW5jbHVkaW5nIGl0c2VsZikuXG4gICAgdGhpcy5fY2FjaGUgPSBuZXcgTFJVKHtcbiAgICAgIG1heDogdGhpcy5fY2FjaGVTaXplLFxuICAgICAgLy8gV2UgaWdub3JlIHRoZSBzaXplIG9mIGNhY2hlS2V5cyBoZXJlLlxuICAgICAgbGVuZ3RoOiAodmFsdWUpID0+IHRoaXMuY29tcGlsZVJlc3VsdFNpemUodmFsdWUuY29tcGlsZVJlc3VsdCksXG4gICAgfSk7XG4gIH1cblxuICAvLyBZb3VyIHN1YmNsYXNzIG11c3Qgb3ZlcnJpZGUgdGhpcyBtZXRob2QgdG8gZGVmaW5lIHRoZSB0cmFuc2Zvcm1hdGlvbiBmcm9tXG4gIC8vIElucHV0RmlsZSB0byBpdHMgY2FjaGVhYmxlIENvbXBpbGVSZXN1bHQpLlxuICAvL1xuICAvLyBBcmd1bWVudHM6XG4gIC8vICAgLSBpbnB1dEZpbGUgaXMgdGhlIElucHV0RmlsZSB0byBwcm9jZXNzXG4gIC8vICAgLSBhbGxGaWxlcyBpcyBhIGEgTWFwIG1hcHBpbmcgZnJvbSBhYnNvbHV0ZSBpbXBvcnQgcGF0aCB0byBJbnB1dEZpbGUgb2ZcbiAgLy8gICAgIGFsbCBmaWxlcyBiZWluZyBwcm9jZXNzZWQgaW4gdGhlIHRhcmdldFxuICAvLyBSZXR1cm5zIGFuIG9iamVjdCB3aXRoIGtleXM6XG4gIC8vICAgLSBjb21waWxlUmVzdWx0OiB0aGUgQ29tcGlsZVJlc3VsdCAodGhlIGNhY2hlYWJsZSBkYXRhIHR5cGUgc3BlY2lmaWMgdG9cbiAgLy8gICAgIHlvdXIgc3ViY2xhc3MpLlxuICAvLyAgIC0gcmVmZXJlbmNlZEltcG9ydFBhdGhzOiBhbiBhcnJheSBvZiBhYnNvbHV0ZSBpbXBvcnQgcGF0aHMgb2YgZmlsZXNcbiAgLy8gICAgIHdoaWNoIHdlcmUgcmVmZXJlcmVuY2VkIGJ5IHRoZSBjdXJyZW50IGZpbGUuICBUaGUgY3VycmVudCBmaWxlXG4gIC8vICAgICBpcyBpbmNsdWRlZCBpbXBsaWNpdGx5LlxuICAvL1xuICAvLyBUaGlzIG1ldGhvZCBpcyBub3QgY2FsbGVkIG9uIGZpbGVzIHdoZW4gYSB2YWxpZCBjYWNoZSBlbnRyeSBleGlzdHMgaW5cbiAgLy8gbWVtb3J5IG9yIG9uIGRpc2suXG4gIC8vXG4gIC8vIE9uIGEgY29tcGlsZSBlcnJvciwgeW91IHNob3VsZCBjYWxsIGBpbnB1dEZpbGUuZXJyb3JgIGFwcHJvcHJpYXRlbHkgYW5kXG4gIC8vIHJldHVybiBudWxsOyB0aGlzIHdpbGwgbm90IGJlIGNhY2hlZC5cbiAgLy9cbiAgLy8gVGhpcyBtZXRob2Qgc2hvdWxkIG5vdCBjYWxsIGBpbnB1dEZpbGUuYWRkSmF2YVNjcmlwdGAgYW5kIHNpbWlsYXIgZmlsZXMhXG4gIC8vIFRoYXQncyB3aGF0IGFkZENvbXBpbGVSZXN1bHQgaXMgZm9yLlxuICBjb21waWxlT25lRmlsZShpbnB1dEZpbGUsIGFsbEZpbGVzKSB7XG4gICAgdGhyb3cgRXJyb3IoXG4gICAgICAnTXVsdGlGaWxlQ2FjaGluZ0NvbXBpbGVyIHN1YmNsYXNzIHNob3VsZCBpbXBsZW1lbnQgY29tcGlsZU9uZUZpbGUhJyk7XG4gIH1cblxuICAvLyBZb3VyIHN1YmNsYXNzIG1heSBvdmVycmlkZSB0aGlzIHRvIGRlY2xhcmUgdGhhdCBhIGZpbGUgaXMgbm90IGEgXCJyb290XCIgLS0tXG4gIC8vIGllLCBpdCBjYW4gYmUgaW5jbHVkZWQgZnJvbSBvdGhlciBmaWxlcyBidXQgaXMgbm90IHByb2Nlc3NlZCBvbiBpdHMgb3duLiBJblxuICAvLyB0aGlzIGNhc2UsIE11bHRpRmlsZUNhY2hpbmdDb21waWxlciB3b24ndCB3YXN0ZSB0aW1lIHRyeWluZyB0byBsb29rIGZvciBhXG4gIC8vIGNhY2hlIGZvciBpdHMgY29tcGlsYXRpb24gb24gZGlzay5cbiAgaXNSb290KGlucHV0RmlsZSkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLy8gUmV0dXJucyB0aGUgYWJzb2x1dGUgaW1wb3J0IHBhdGggZm9yIGFuIElucHV0RmlsZS4gQnkgZGVmYXVsdCwgdGhpcyBpcyBhXG4gIC8vIHBhdGggaXMgYSBwYXRoIG9mIHRoZSBmb3JtIFwie3BhY2thZ2V9L3BhdGgvdG8vZmlsZVwiIGZvciBmaWxlcyBpbiBwYWNrYWdlc1xuICAvLyBhbmQgXCJ7fS9wYXRoL3RvL2ZpbGVcIiBmb3IgZmlsZXMgaW4gYXBwcy4gWW91ciBzdWJjbGFzcyBtYXkgb3ZlcnJpZGUgYW5kL29yXG4gIC8vIGNhbGwgdGhpcyBtZXRob2QuXG4gIGdldEFic29sdXRlSW1wb3J0UGF0aChpbnB1dEZpbGUpIHtcbiAgICBpZiAoaW5wdXRGaWxlLmdldFBhY2thZ2VOYW1lKCkgPT09IG51bGwpIHtcbiAgICAgIHJldHVybiAne30vJyArIGlucHV0RmlsZS5nZXRQYXRoSW5QYWNrYWdlKCk7XG4gICAgfVxuICAgIHJldHVybiAneycgKyBpbnB1dEZpbGUuZ2V0UGFja2FnZU5hbWUoKSArICd9LydcbiAgICAgICsgaW5wdXRGaWxlLmdldFBhdGhJblBhY2thZ2UoKTtcbiAgfVxuXG4gIC8vIFRoZSBwcm9jZXNzRmlsZXNGb3JUYXJnZXQgbWV0aG9kIGZyb20gdGhlIFBsdWdpbi5yZWdpc3RlckNvbXBpbGVyIEFQSS5cbiAgcHJvY2Vzc0ZpbGVzRm9yVGFyZ2V0KGlucHV0RmlsZXMpIHtcbiAgICBjb25zdCBhbGxGaWxlcyA9IG5ldyBNYXA7XG4gICAgY29uc3QgY2FjaGVLZXlNYXAgPSBuZXcgTWFwO1xuICAgIGNvbnN0IGNhY2hlTWlzc2VzID0gW107XG5cbiAgICBpbnB1dEZpbGVzLmZvckVhY2goKGlucHV0RmlsZSkgPT4ge1xuICAgICAgY29uc3QgaW1wb3J0UGF0aCA9IHRoaXMuZ2V0QWJzb2x1dGVJbXBvcnRQYXRoKGlucHV0RmlsZSk7XG4gICAgICBhbGxGaWxlcy5zZXQoaW1wb3J0UGF0aCwgaW5wdXRGaWxlKTtcbiAgICAgIGNhY2hlS2V5TWFwLnNldChpbXBvcnRQYXRoLCB0aGlzLl9kZWVwSGFzaCh0aGlzLmdldENhY2hlS2V5KGlucHV0RmlsZSkpKTtcbiAgICB9KTtcblxuICAgIGNvbnN0IGFsbFByb2Nlc3NlZEZ1dHVyZSA9IG5ldyBGdXR1cmU7XG4gICAgYXN5bmMuZWFjaExpbWl0KGlucHV0RmlsZXMsIHRoaXMuX21heFBhcmFsbGVsaXNtLCAoaW5wdXRGaWxlLCBjYikgPT4ge1xuICAgICAgbGV0IGVycm9yID0gbnVsbDtcbiAgICAgIHRyeSB7XG4gICAgICAgIC8vIElmIHRoaXMgaXNuJ3QgYSByb290LCBza2lwIGl0IChhbmQgZGVmaW5pdGVseSBkb24ndCB3YXN0ZSB0aW1lXG4gICAgICAgIC8vIGxvb2tpbmcgZm9yIGEgY2FjaGUgZmlsZSB0aGF0IHdvbid0IGJlIHRoZXJlKS5cbiAgICAgICAgaWYgKCF0aGlzLmlzUm9vdChpbnB1dEZpbGUpKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgYWJzb2x1dGVJbXBvcnRQYXRoID0gdGhpcy5nZXRBYnNvbHV0ZUltcG9ydFBhdGgoaW5wdXRGaWxlKTtcbiAgICAgICAgbGV0IGNhY2hlRW50cnkgPSB0aGlzLl9jYWNoZS5nZXQoYWJzb2x1dGVJbXBvcnRQYXRoKTtcbiAgICAgICAgaWYgKCEgY2FjaGVFbnRyeSkge1xuICAgICAgICAgIGNhY2hlRW50cnkgPSB0aGlzLl9yZWFkQ2FjaGUoYWJzb2x1dGVJbXBvcnRQYXRoKTtcbiAgICAgICAgICBpZiAoY2FjaGVFbnRyeSkge1xuICAgICAgICAgICAgdGhpcy5fY2FjaGVEZWJ1ZyhgTG9hZGVkICR7IGFic29sdXRlSW1wb3J0UGF0aCB9YCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmICghIChjYWNoZUVudHJ5ICYmIHRoaXMuX2NhY2hlRW50cnlWYWxpZChjYWNoZUVudHJ5LCBjYWNoZUtleU1hcCkpKSB7XG4gICAgICAgICAgY2FjaGVNaXNzZXMucHVzaChpbnB1dEZpbGUuZ2V0RGlzcGxheVBhdGgoKSk7XG5cbiAgICAgICAgICBjb25zdCBjb21waWxlT25lRmlsZVJldHVybiA9IHRoaXMuY29tcGlsZU9uZUZpbGUoaW5wdXRGaWxlLCBhbGxGaWxlcyk7XG4gICAgICAgICAgaWYgKCEgY29tcGlsZU9uZUZpbGVSZXR1cm4pIHtcbiAgICAgICAgICAgIC8vIGNvbXBpbGVPbmVGaWxlIHNob3VsZCBoYXZlIGNhbGxlZCBpbnB1dEZpbGUuZXJyb3IuXG4gICAgICAgICAgICAvLyAgV2UgZG9uJ3QgY2FjaGUgZmFpbHVyZXMgZm9yIG5vdy5cbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc3Qge2NvbXBpbGVSZXN1bHQsIHJlZmVyZW5jZWRJbXBvcnRQYXRoc30gPSBjb21waWxlT25lRmlsZVJldHVybjtcblxuICAgICAgICAgIGNhY2hlRW50cnkgPSB7XG4gICAgICAgICAgICBjb21waWxlUmVzdWx0LFxuICAgICAgICAgICAgY2FjaGVLZXlzOiB7XG4gICAgICAgICAgICAgIC8vIEluY2x1ZGUgdGhlIGhhc2hlZCBjYWNoZSBrZXkgb2YgdGhlIGZpbGUgaXRzZWxmLi4uXG4gICAgICAgICAgICAgIFthYnNvbHV0ZUltcG9ydFBhdGhdOiBjYWNoZUtleU1hcC5nZXQoYWJzb2x1dGVJbXBvcnRQYXRoKVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH07XG5cbiAgICAgICAgICAvLyAuLi4gYW5kIG9mIHRoZSBvdGhlciByZWZlcmVuY2VkIGZpbGVzLlxuICAgICAgICAgIHJlZmVyZW5jZWRJbXBvcnRQYXRocy5mb3JFYWNoKChwYXRoKSA9PiB7XG4gICAgICAgICAgICBpZiAoIWNhY2hlS2V5TWFwLmhhcyhwYXRoKSkge1xuICAgICAgICAgICAgICB0aHJvdyBFcnJvcihgVW5rbm93biBhYnNvbHV0ZSBpbXBvcnQgcGF0aCAkeyBwYXRoIH1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhY2hlRW50cnkuY2FjaGVLZXlzW3BhdGhdID0gY2FjaGVLZXlNYXAuZ2V0KHBhdGgpO1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgLy8gU2F2ZSB0aGUgY2FjaGUgZW50cnkuXG4gICAgICAgICAgdGhpcy5fY2FjaGUuc2V0KGFic29sdXRlSW1wb3J0UGF0aCwgY2FjaGVFbnRyeSk7XG4gICAgICAgICAgdGhpcy5fd3JpdGVDYWNoZUFzeW5jKGFic29sdXRlSW1wb3J0UGF0aCwgY2FjaGVFbnRyeSk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmFkZENvbXBpbGVSZXN1bHQoaW5wdXRGaWxlLCBjYWNoZUVudHJ5LmNvbXBpbGVSZXN1bHQpO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBlcnJvciA9IGU7XG4gICAgICB9IGZpbmFsbHkge1xuICAgICAgICBjYihlcnJvcik7XG4gICAgICB9XG4gICAgfSwgYWxsUHJvY2Vzc2VkRnV0dXJlLnJlc29sdmVyKCkpO1xuICAgIGFsbFByb2Nlc3NlZEZ1dHVyZS53YWl0KCk7XG5cbiAgICBpZiAodGhpcy5fY2FjaGVEZWJ1Z0VuYWJsZWQpIHtcbiAgICAgIGNhY2hlTWlzc2VzLnNvcnQoKTtcbiAgICAgIHRoaXMuX2NhY2hlRGVidWcoXG4gICAgICAgIGBSYW4gKCMkeyArK3RoaXMuX2NhbGxDb3VudCB9KSBvbjogJHsgSlNPTi5zdHJpbmdpZnkoY2FjaGVNaXNzZXMpIH1gKTtcbiAgICB9XG4gIH1cblxuICBfY2FjaGVFbnRyeVZhbGlkKGNhY2hlRW50cnksIGNhY2hlS2V5TWFwKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKGNhY2hlRW50cnkuY2FjaGVLZXlzKS5ldmVyeShcbiAgICAgIChwYXRoKSA9PiBjYWNoZUVudHJ5LmNhY2hlS2V5c1twYXRoXSA9PT0gY2FjaGVLZXlNYXAuZ2V0KHBhdGgpXG4gICAgKTtcbiAgfVxuXG4gIC8vIFRoZSBmb3JtYXQgb2YgYSBjYWNoZSBmaWxlIG9uIGRpc2sgaXMgdGhlIEpTT04tc3RyaW5naWZpZWQgY2FjaGVLZXlzXG4gIC8vIG9iamVjdCwgYSBuZXdsaW5lLCBmb2xsb3dlZCBieSB0aGUgQ29tcGlsZVJlc3VsdCBhcyByZXR1cm5lZCBmcm9tXG4gIC8vIHRoaXMuc3RyaW5naWZ5Q29tcGlsZVJlc3VsdC5cbiAgX2NhY2hlRmlsZW5hbWUoYWJzb2x1dGVJbXBvcnRQYXRoKSB7XG4gICAgcmV0dXJuIHBhdGguam9pbih0aGlzLl9kaXNrQ2FjaGUsXG4gICAgICAgICAgICAgICAgICAgICB0aGlzLl9kZWVwSGFzaChhYnNvbHV0ZUltcG9ydFBhdGgpICsgJy5jYWNoZScpO1xuICB9XG4gIC8vIExvYWRzIGEge2NvbXBpbGVSZXN1bHQsIGNhY2hlS2V5c30gY2FjaGUgZW50cnkgZnJvbSBkaXNrLiBSZXR1cm5zIHRoZSB3aG9sZVxuICAvLyBjYWNoZSBlbnRyeSBhbmQgbG9hZHMgaXQgaW50byB0aGUgaW4tbWVtb3J5IGNhY2hlIHRvby5cbiAgX3JlYWRDYWNoZShhYnNvbHV0ZUltcG9ydFBhdGgpIHtcbiAgICBpZiAoISB0aGlzLl9kaXNrQ2FjaGUpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBjb25zdCBjYWNoZUZpbGVuYW1lID0gdGhpcy5fY2FjaGVGaWxlbmFtZShhYnNvbHV0ZUltcG9ydFBhdGgpO1xuICAgIGNvbnN0IHJhdyA9IHRoaXMuX3JlYWRGaWxlT3JOdWxsKGNhY2hlRmlsZW5hbWUpO1xuICAgIGlmICghcmF3KSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvLyBTcGxpdCBvbiBuZXdsaW5lLlxuICAgIGNvbnN0IG5ld2xpbmVJbmRleCA9IHJhdy5pbmRleE9mKCdcXG4nKTtcbiAgICBpZiAobmV3bGluZUluZGV4ID09PSAtMSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGNvbnN0IGNhY2hlS2V5c1N0cmluZyA9IHJhdy5zdWJzdHJpbmcoMCwgbmV3bGluZUluZGV4KTtcbiAgICBjb25zdCBjb21waWxlUmVzdWx0U3RyaW5nID0gcmF3LnN1YnN0cmluZyhuZXdsaW5lSW5kZXggKyAxKTtcblxuICAgIGNvbnN0IGNhY2hlS2V5cyA9IHRoaXMuX3BhcnNlSlNPTk9yTnVsbChjYWNoZUtleXNTdHJpbmcpO1xuICAgIGlmICghY2FjaGVLZXlzKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgY29uc3QgY29tcGlsZVJlc3VsdCA9IHRoaXMucGFyc2VDb21waWxlUmVzdWx0KGNvbXBpbGVSZXN1bHRTdHJpbmcpO1xuICAgIGlmICghIGNvbXBpbGVSZXN1bHQpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IGNhY2hlRW50cnkgPSB7Y29tcGlsZVJlc3VsdCwgY2FjaGVLZXlzfTtcbiAgICB0aGlzLl9jYWNoZS5zZXQoYWJzb2x1dGVJbXBvcnRQYXRoLCBjYWNoZUVudHJ5KTtcbiAgICByZXR1cm4gY2FjaGVFbnRyeTtcbiAgfVxuICBfd3JpdGVDYWNoZUFzeW5jKGFic29sdXRlSW1wb3J0UGF0aCwgY2FjaGVFbnRyeSkge1xuICAgIGlmICghIHRoaXMuX2Rpc2tDYWNoZSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGNvbnN0IGNhY2hlRmlsZW5hbWUgPSB0aGlzLl9jYWNoZUZpbGVuYW1lKGFic29sdXRlSW1wb3J0UGF0aCk7XG4gICAgY29uc3QgY2FjaGVDb250ZW50cyA9XG4gICAgICAgICAgICBKU09OLnN0cmluZ2lmeShjYWNoZUVudHJ5LmNhY2hlS2V5cykgKyAnXFxuJ1xuICAgICAgICAgICAgKyB0aGlzLnN0cmluZ2lmeUNvbXBpbGVSZXN1bHQoY2FjaGVFbnRyeS5jb21waWxlUmVzdWx0KTtcbiAgICB0aGlzLl93cml0ZUZpbGVBc3luYyhjYWNoZUZpbGVuYW1lLCBjYWNoZUNvbnRlbnRzKTtcbiAgfVxufVxuIl19
