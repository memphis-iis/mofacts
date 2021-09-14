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

const LRU = Npm.require('lru-cache'); // Base class for CachingCompiler and MultiFileCachingCompiler.


CachingCompilerBase = class CachingCompilerBase {
  constructor({
    compilerName,
    defaultCacheSize,
    maxParallelism = 20
  }) {
    this._compilerName = compilerName;
    this._maxParallelism = maxParallelism;
    const compilerNameForEnvar = compilerName.toUpperCase().replace('/-/g', '_').replace(/[^A-Z0-9_]/g, '');
    const envVarPrefix = 'METEOR_' + compilerNameForEnvar + '_CACHE_';
    const debugEnvVar = envVarPrefix + 'DEBUG';
    this._cacheDebugEnabled = !!process.env[debugEnvVar];
    const cacheSizeEnvVar = envVarPrefix + 'SIZE';
    this._cacheSize = +process.env[cacheSizeEnvVar] || defaultCacheSize;
    this._diskCache = null; // For testing.

    this._callCount = 0; // Callbacks that will be called after the linker is done processing
    // files, after all lazy compilation has finished.

    this._afterLinkCallbacks = [];
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
  } // Called by the compiler plugins system after all linking and lazy
  // compilation has finished.


  afterLink() {
    this._afterLinkCallbacks.splice(0).forEach(callback => {
      callback();
    });
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
      fs.writeFile(tempFilename, contents, writeError => {
        if (writeError) return;

        try {
          fs.renameSync(tempFilename, filename);
        } catch (renameError) {// ignore errors, it's just a cache
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
    return Promise.asyncApply(() => {
      const cacheMisses = [];
      const arches = this._cacheDebugEnabled && Object.create(null);
      inputFiles.forEach(inputFile => {
        if (arches) {
          arches[inputFile.getArch()] = 1;
        }

        const getResult = () => {
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
            compileResult = Promise.await(this.compileOneFile(inputFile));

            if (!compileResult) {
              // compileOneFile should have called inputFile.error.
              //  We don't cache failures for now.
              return;
            } // Save what we've compiled.


            this._cache.set(cacheKey, compileResult);

            this._writeCacheAsync(cacheKey, compileResult);
          }

          return compileResult;
        };

        if (this.compileOneFileLater && inputFile.supportsLazyCompilation) {
          this.compileOneFileLater(inputFile, getResult);
        } else {
          const result = getResult();

          if (result) {
            this.addCompileResult(inputFile, result);
          }
        }
      });

      if (this._cacheDebugEnabled) {
        this._afterLinkCallbacks.push(() => {
          cacheMisses.sort();

          this._cacheDebug(`Ran (#${++this._callCount}) on: ${JSON.stringify(cacheMisses)} ${JSON.stringify(Object.keys(arches).sort())}`);
        });
      }
    });
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

},"multi-file-caching-compiler.js":function(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/caching-compiler/multi-file-caching-compiler.js                                                       //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
const path = Plugin.path;

const LRU = Npm.require('lru-cache'); // MultiFileCachingCompiler is like CachingCompiler, but for implementing
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
    }); // Maps from cache key to { compileResult, cacheKeys }, where
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
    return Promise.asyncApply(() => {
      const allFiles = new Map();
      const cacheKeyMap = new Map();
      const cacheMisses = [];
      const arches = this._cacheDebugEnabled && Object.create(null);
      inputFiles.forEach(inputFile => {
        const importPath = this.getAbsoluteImportPath(inputFile);
        allFiles.set(importPath, inputFile);
        cacheKeyMap.set(importPath, this._getCacheKeyWithPath(inputFile));
      });
      inputFiles.forEach(inputFile => {
        if (arches) {
          arches[inputFile.getArch()] = 1;
        }

        const getResult = () => {
          const absoluteImportPath = this.getAbsoluteImportPath(inputFile);
          const cacheKey = cacheKeyMap.get(absoluteImportPath);

          let cacheEntry = this._cache.get(cacheKey);

          if (!cacheEntry) {
            cacheEntry = this._readCache(cacheKey);

            if (cacheEntry) {
              this._cacheDebug(`Loaded ${absoluteImportPath}`);
            }
          }

          if (!(cacheEntry && this._cacheEntryValid(cacheEntry, cacheKeyMap))) {
            cacheMisses.push(inputFile.getDisplayPath());
            const compileOneFileReturn = Promise.await(this.compileOneFile(inputFile, allFiles));

            if (!compileOneFileReturn) {
              // compileOneFile should have called inputFile.error.
              // We don't cache failures for now.
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

            this._cache.set(cacheKey, cacheEntry);

            this._writeCacheAsync(cacheKey, cacheEntry);
          }

          return cacheEntry.compileResult;
        };

        if (this.compileOneFileLater && inputFile.supportsLazyCompilation) {
          if (!this.isRoot(inputFile)) {
            // If this inputFile is definitely not a root, then it must be
            // lazy, and this is our last chance to mark it as such, so that
            // the rest of the compiler plugin system can avoid worrying
            // about the MultiFileCachingCompiler-specific concept of a
            // "root." If this.isRoot(inputFile) returns true instead, that
            // classification may not be trustworthy, since returning true
            // used to be the only way to get the file to be compiled, so
            // that it could be imported later by a JS module. Now that
            // files can be compiled on-demand, it's safe to pass all files
            // that might be roots to this.compileOneFileLater.
            inputFile.getFileOptions().lazy = true;
          }

          this.compileOneFileLater(inputFile, getResult);
        } else if (this.isRoot(inputFile)) {
          const result = getResult();

          if (result) {
            this.addCompileResult(inputFile, result);
          }
        }
      });

      if (this._cacheDebugEnabled) {
        this._afterLinkCallbacks.push(() => {
          cacheMisses.sort();

          this._cacheDebug(`Ran (#${++this._callCount}) on: ${JSON.stringify(cacheMisses)} ${JSON.stringify(Object.keys(arches).sort())}`);
        });
      }
    });
  } // Returns a hash that incorporates both this.getCacheKey(inputFile) and
  // this.getAbsoluteImportPath(inputFile), since the file path might be
  // relevant to the compiled output when using MultiFileCachingCompiler.


  _getCacheKeyWithPath(inputFile) {
    return this._deepHash([this.getAbsoluteImportPath(inputFile), this.getCacheKey(inputFile)]);
  }

  _cacheEntryValid(cacheEntry, cacheKeyMap) {
    return Object.keys(cacheEntry.cacheKeys).every(path => cacheEntry.cacheKeys[path] === cacheKeyMap.get(path));
  } // The format of a cache file on disk is the JSON-stringified cacheKeys
  // object, a newline, followed by the CompileResult as returned from
  // this.stringifyCompileResult.


  _cacheFilename(cacheKey) {
    return path.join(this._diskCache, cacheKey + ".cache");
  } // Loads a {compileResult, cacheKeys} cache entry from disk. Returns the whole
  // cache entry and loads it into the in-memory cache too.


  _readCache(cacheKey) {
    if (!this._diskCache) {
      return null;
    }

    const cacheFilename = this._cacheFilename(cacheKey);

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

    this._cache.set(cacheKey, cacheEntry);

    return cacheEntry;
  }

  _writeCacheAsync(cacheKey, cacheEntry) {
    if (!this._diskCache) {
      return null;
    }

    const cacheFilename = this._cacheFilename(cacheKey);

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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvY2FjaGluZy1jb21waWxlci9jYWNoaW5nLWNvbXBpbGVyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9jYWNoaW5nLWNvbXBpbGVyL211bHRpLWZpbGUtY2FjaGluZy1jb21waWxlci5qcyJdLCJuYW1lcyI6WyJmcyIsIlBsdWdpbiIsInBhdGgiLCJjcmVhdGVIYXNoIiwiTnBtIiwicmVxdWlyZSIsImFzc2VydCIsIkxSVSIsIkNhY2hpbmdDb21waWxlckJhc2UiLCJjb25zdHJ1Y3RvciIsImNvbXBpbGVyTmFtZSIsImRlZmF1bHRDYWNoZVNpemUiLCJtYXhQYXJhbGxlbGlzbSIsIl9jb21waWxlck5hbWUiLCJfbWF4UGFyYWxsZWxpc20iLCJjb21waWxlck5hbWVGb3JFbnZhciIsInRvVXBwZXJDYXNlIiwicmVwbGFjZSIsImVudlZhclByZWZpeCIsImRlYnVnRW52VmFyIiwiX2NhY2hlRGVidWdFbmFibGVkIiwicHJvY2VzcyIsImVudiIsImNhY2hlU2l6ZUVudlZhciIsIl9jYWNoZVNpemUiLCJfZGlza0NhY2hlIiwiX2NhbGxDb3VudCIsIl9hZnRlckxpbmtDYWxsYmFja3MiLCJnZXRDYWNoZUtleSIsImlucHV0RmlsZSIsIkVycm9yIiwiYWRkQ29tcGlsZVJlc3VsdCIsImNvbXBpbGVSZXN1bHQiLCJjb21waWxlUmVzdWx0U2l6ZSIsInN0cmluZ2lmeUNvbXBpbGVSZXN1bHQiLCJKU09OIiwic3RyaW5naWZ5IiwicGFyc2VDb21waWxlUmVzdWx0Iiwic3RyaW5naWZpZWRDb21waWxlUmVzdWx0IiwiX3BhcnNlSlNPTk9yTnVsbCIsImpzb24iLCJwYXJzZSIsImUiLCJTeW50YXhFcnJvciIsIl9jYWNoZURlYnVnIiwibWVzc2FnZSIsImNvbnNvbGUiLCJsb2ciLCJzZXREaXNrQ2FjaGVEaXJlY3RvcnkiLCJkaXNrQ2FjaGUiLCJzb3VyY2VNYXBTaXplIiwic20iLCJtYXBwaW5ncyIsImxlbmd0aCIsInNvdXJjZXNDb250ZW50IiwicmVkdWNlIiwic29GYXIiLCJjdXJyZW50IiwiYWZ0ZXJMaW5rIiwic3BsaWNlIiwiZm9yRWFjaCIsImNhbGxiYWNrIiwiX2RlZXBIYXNoIiwidmFsIiwiaGFzaCIsInR5cGUiLCJ1cGRhdGUiLCJrZXlzIiwiT2JqZWN0IiwiQXJyYXkiLCJpc0FycmF5Iiwic29ydCIsImtleSIsIm9rIiwiZGlnZXN0IiwiX3dyaXRlRmlsZUFzeW5jIiwiZmlsZW5hbWUiLCJjb250ZW50cyIsInRlbXBGaWxlbmFtZSIsIlJhbmRvbSIsImlkIiwid3JpdGVGaWxlU3luYyIsInJlbmFtZVN5bmMiLCJ3cml0ZUZpbGUiLCJ3cml0ZUVycm9yIiwicmVuYW1lRXJyb3IiLCJfcmVhZEZpbGVPck51bGwiLCJyZWFkRmlsZVN5bmMiLCJjb2RlIiwiQ2FjaGluZ0NvbXBpbGVyIiwiX2NhY2hlIiwibWF4IiwidmFsdWUiLCJjb21waWxlT25lRmlsZSIsInByb2Nlc3NGaWxlc0ZvclRhcmdldCIsImlucHV0RmlsZXMiLCJjYWNoZU1pc3NlcyIsImFyY2hlcyIsImNyZWF0ZSIsImdldEFyY2giLCJnZXRSZXN1bHQiLCJjYWNoZUtleSIsImdldCIsIl9yZWFkQ2FjaGUiLCJnZXREaXNwbGF5UGF0aCIsInB1c2giLCJQcm9taXNlIiwiYXdhaXQiLCJzZXQiLCJfd3JpdGVDYWNoZUFzeW5jIiwiY29tcGlsZU9uZUZpbGVMYXRlciIsInN1cHBvcnRzTGF6eUNvbXBpbGF0aW9uIiwicmVzdWx0IiwiX2NhY2hlRmlsZW5hbWUiLCJ0ZXN0Iiwiam9pbiIsImNhY2hlRmlsZW5hbWUiLCJfcmVhZEFuZFBhcnNlQ29tcGlsZVJlc3VsdE9yTnVsbCIsImNhY2hlQ29udGVudHMiLCJyYXciLCJNdWx0aUZpbGVDYWNoaW5nQ29tcGlsZXIiLCJhbGxGaWxlcyIsImlzUm9vdCIsImdldEFic29sdXRlSW1wb3J0UGF0aCIsImdldFBhY2thZ2VOYW1lIiwiZ2V0UGF0aEluUGFja2FnZSIsIk1hcCIsImNhY2hlS2V5TWFwIiwiaW1wb3J0UGF0aCIsIl9nZXRDYWNoZUtleVdpdGhQYXRoIiwiYWJzb2x1dGVJbXBvcnRQYXRoIiwiY2FjaGVFbnRyeSIsIl9jYWNoZUVudHJ5VmFsaWQiLCJjb21waWxlT25lRmlsZVJldHVybiIsInJlZmVyZW5jZWRJbXBvcnRQYXRocyIsImNhY2hlS2V5cyIsImhhcyIsImdldEZpbGVPcHRpb25zIiwibGF6eSIsImV2ZXJ5IiwibmV3bGluZUluZGV4IiwiaW5kZXhPZiIsImNhY2hlS2V5c1N0cmluZyIsInN1YnN0cmluZyIsImNvbXBpbGVSZXN1bHRTdHJpbmciXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsTUFBTUEsRUFBRSxHQUFHQyxNQUFNLENBQUNELEVBQWxCO0FBQ0EsTUFBTUUsSUFBSSxHQUFHRCxNQUFNLENBQUNDLElBQXBCOztBQUNBLE1BQU1DLFVBQVUsR0FBR0MsR0FBRyxDQUFDQyxPQUFKLENBQVksUUFBWixFQUFzQkYsVUFBekM7O0FBQ0EsTUFBTUcsTUFBTSxHQUFHRixHQUFHLENBQUNDLE9BQUosQ0FBWSxRQUFaLENBQWY7O0FBQ0EsTUFBTUUsR0FBRyxHQUFHSCxHQUFHLENBQUNDLE9BQUosQ0FBWSxXQUFaLENBQVosQyxDQUVBOzs7QUFDQUcsbUJBQW1CLEdBQUcsTUFBTUEsbUJBQU4sQ0FBMEI7QUFDOUNDLGFBQVcsQ0FBQztBQUNWQyxnQkFEVTtBQUVWQyxvQkFGVTtBQUdWQyxrQkFBYyxHQUFHO0FBSFAsR0FBRCxFQUlSO0FBQ0QsU0FBS0MsYUFBTCxHQUFxQkgsWUFBckI7QUFDQSxTQUFLSSxlQUFMLEdBQXVCRixjQUF2QjtBQUNBLFVBQU1HLG9CQUFvQixHQUFHTCxZQUFZLENBQUNNLFdBQWIsR0FDMUJDLE9BRDBCLENBQ2xCLE1BRGtCLEVBQ1YsR0FEVSxFQUNMQSxPQURLLENBQ0csYUFESCxFQUNrQixFQURsQixDQUE3QjtBQUVBLFVBQU1DLFlBQVksR0FBRyxZQUFZSCxvQkFBWixHQUFtQyxTQUF4RDtBQUVBLFVBQU1JLFdBQVcsR0FBR0QsWUFBWSxHQUFHLE9BQW5DO0FBQ0EsU0FBS0Usa0JBQUwsR0FBMEIsQ0FBQyxDQUFFQyxPQUFPLENBQUNDLEdBQVIsQ0FBWUgsV0FBWixDQUE3QjtBQUVBLFVBQU1JLGVBQWUsR0FBR0wsWUFBWSxHQUFHLE1BQXZDO0FBQ0EsU0FBS00sVUFBTCxHQUFrQixDQUFDSCxPQUFPLENBQUNDLEdBQVIsQ0FBWUMsZUFBWixDQUFELElBQWlDWixnQkFBbkQ7QUFFQSxTQUFLYyxVQUFMLEdBQWtCLElBQWxCLENBYkMsQ0FlRDs7QUFDQSxTQUFLQyxVQUFMLEdBQWtCLENBQWxCLENBaEJDLENBa0JEO0FBQ0E7O0FBQ0EsU0FBS0MsbUJBQUwsR0FBMkIsRUFBM0I7QUFDRCxHQTFCNkMsQ0E0QjlDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUFDQUMsYUFBVyxDQUFDQyxTQUFELEVBQVk7QUFDckIsVUFBTUMsS0FBSyxDQUFDLHdEQUFELENBQVg7QUFDRCxHQTlDNkMsQ0FnRDlDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQUNBQyxrQkFBZ0IsQ0FBQ0YsU0FBRCxFQUFZRyxhQUFaLEVBQTJCO0FBQ3pDLFVBQU1GLEtBQUssQ0FBQyw2REFBRCxDQUFYO0FBQ0QsR0ExRDZDLENBNEQ5QztBQUNBO0FBQ0E7OztBQUNBRyxtQkFBaUIsQ0FBQ0QsYUFBRCxFQUFnQjtBQUMvQixVQUFNRixLQUFLLENBQUMsOERBQUQsQ0FBWDtBQUNELEdBakU2QyxDQW1FOUM7QUFDQTs7O0FBQ0FJLHdCQUFzQixDQUFDRixhQUFELEVBQWdCO0FBQ3BDLFdBQU9HLElBQUksQ0FBQ0MsU0FBTCxDQUFlSixhQUFmLENBQVA7QUFDRCxHQXZFNkMsQ0F3RTlDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQUNBSyxvQkFBa0IsQ0FBQ0Msd0JBQUQsRUFBMkI7QUFDM0MsV0FBTyxLQUFLQyxnQkFBTCxDQUFzQkQsd0JBQXRCLENBQVA7QUFDRDs7QUFDREMsa0JBQWdCLENBQUNDLElBQUQsRUFBTztBQUNyQixRQUFJO0FBQ0YsYUFBT0wsSUFBSSxDQUFDTSxLQUFMLENBQVdELElBQVgsQ0FBUDtBQUNELEtBRkQsQ0FFRSxPQUFPRSxDQUFQLEVBQVU7QUFDVixVQUFJQSxDQUFDLFlBQVlDLFdBQWpCLEVBQ0UsT0FBTyxJQUFQO0FBQ0YsWUFBTUQsQ0FBTjtBQUNEO0FBQ0Y7O0FBRURFLGFBQVcsQ0FBQ0MsT0FBRCxFQUFVO0FBQ25CLFFBQUksQ0FBQyxLQUFLekIsa0JBQVYsRUFDRTtBQUNGMEIsV0FBTyxDQUFDQyxHQUFSLENBQWEsU0FBUyxLQUFLbEMsYUFBZSxNQUFNZ0MsT0FBUyxFQUF6RDtBQUNEOztBQUVERyx1QkFBcUIsQ0FBQ0MsU0FBRCxFQUFZO0FBQy9CLFFBQUksS0FBS3hCLFVBQVQsRUFDRSxNQUFNSyxLQUFLLENBQUMscUNBQUQsQ0FBWDtBQUNGLFNBQUtMLFVBQUwsR0FBa0J3QixTQUFsQjtBQUNELEdBcEc2QyxDQXNHOUM7QUFDQTs7O0FBQ0FDLGVBQWEsQ0FBQ0MsRUFBRCxFQUFLO0FBQ2hCLFFBQUksQ0FBRUEsRUFBTixFQUFVLE9BQU8sQ0FBUCxDQURNLENBRWhCO0FBQ0E7O0FBQ0EsV0FBT0EsRUFBRSxDQUFDQyxRQUFILENBQVlDLE1BQVosR0FDSCxDQUFDRixFQUFFLENBQUNHLGNBQUgsSUFBcUIsRUFBdEIsRUFBMEJDLE1BQTFCLENBQWlDLFVBQVVDLEtBQVYsRUFBaUJDLE9BQWpCLEVBQTBCO0FBQzNELGFBQU9ELEtBQUssSUFBSUMsT0FBTyxHQUFHQSxPQUFPLENBQUNKLE1BQVgsR0FBb0IsQ0FBL0IsQ0FBWjtBQUNELEtBRkMsRUFFQyxDQUZELENBREo7QUFJRCxHQWhINkMsQ0FrSDlDO0FBQ0E7OztBQUNBSyxXQUFTLEdBQUc7QUFDVixTQUFLL0IsbUJBQUwsQ0FBeUJnQyxNQUF6QixDQUFnQyxDQUFoQyxFQUFtQ0MsT0FBbkMsQ0FBMkNDLFFBQVEsSUFBSTtBQUNyREEsY0FBUTtBQUNULEtBRkQ7QUFHRCxHQXhINkMsQ0EwSDlDO0FBQ0E7OztBQUNBQyxXQUFTLENBQUNDLEdBQUQsRUFBTTtBQUNiLFVBQU1DLElBQUksR0FBRzdELFVBQVUsQ0FBQyxNQUFELENBQXZCO0FBQ0EsUUFBSThELElBQUksR0FBRyxPQUFPRixHQUFsQjs7QUFFQSxRQUFJQSxHQUFHLEtBQUssSUFBWixFQUFrQjtBQUNoQkUsVUFBSSxHQUFHLE1BQVA7QUFDRDs7QUFDREQsUUFBSSxDQUFDRSxNQUFMLENBQVlELElBQUksR0FBRyxJQUFuQjs7QUFFQSxZQUFRQSxJQUFSO0FBQ0EsV0FBSyxRQUFMO0FBQ0UsY0FBTUUsSUFBSSxHQUFHQyxNQUFNLENBQUNELElBQVAsQ0FBWUosR0FBWixDQUFiLENBREYsQ0FHRTs7QUFDQSxZQUFJLENBQUVNLEtBQUssQ0FBQ0MsT0FBTixDQUFjUCxHQUFkLENBQU4sRUFBMEI7QUFDeEJJLGNBQUksQ0FBQ0ksSUFBTDtBQUNEOztBQUVESixZQUFJLENBQUNQLE9BQUwsQ0FBY1ksR0FBRCxJQUFTO0FBQ3BCLGNBQUksT0FBT1QsR0FBRyxDQUFDUyxHQUFELENBQVYsS0FBb0IsVUFBeEIsRUFBb0M7QUFDbEM7QUFDQTtBQUNBO0FBQ0Q7O0FBRURSLGNBQUksQ0FBQ0UsTUFBTCxDQUFZTSxHQUFHLEdBQUcsSUFBbEIsRUFBd0JOLE1BQXhCLENBQStCLEtBQUtKLFNBQUwsQ0FBZUMsR0FBRyxDQUFDUyxHQUFELENBQWxCLENBQS9CO0FBQ0QsU0FSRDtBQVVBOztBQUVGLFdBQUssVUFBTDtBQUNFbEUsY0FBTSxDQUFDbUUsRUFBUCxDQUFVLEtBQVYsRUFBaUIsOEJBQWpCO0FBQ0E7O0FBRUY7QUFDRVQsWUFBSSxDQUFDRSxNQUFMLENBQVksS0FBS0gsR0FBakI7QUFDQTtBQTNCRjs7QUE4QkEsV0FBT0MsSUFBSSxDQUFDVSxNQUFMLENBQVksS0FBWixDQUFQO0FBQ0QsR0FwSzZDLENBc0s5QztBQUNBOzs7QUFDQUMsaUJBQWUsQ0FBQ0MsUUFBRCxFQUFXQyxRQUFYLEVBQXFCO0FBQ2xDLFVBQU1DLFlBQVksR0FBR0YsUUFBUSxHQUFHLE9BQVgsR0FBcUJHLE1BQU0sQ0FBQ0MsRUFBUCxFQUExQzs7QUFDQSxRQUFJLEtBQUs1RCxrQkFBVCxFQUE2QjtBQUMzQjtBQUNBLFVBQUk7QUFDRnBCLFVBQUUsQ0FBQ2lGLGFBQUgsQ0FBaUJILFlBQWpCLEVBQStCRCxRQUEvQjtBQUNBN0UsVUFBRSxDQUFDa0YsVUFBSCxDQUFjSixZQUFkLEVBQTRCRixRQUE1QjtBQUNELE9BSEQsQ0FHRSxPQUFPbEMsQ0FBUCxFQUFVLENBQ1Y7QUFDRDtBQUNGLEtBUkQsTUFRTztBQUNMMUMsUUFBRSxDQUFDbUYsU0FBSCxDQUFhTCxZQUFiLEVBQTJCRCxRQUEzQixFQUFxQ08sVUFBVSxJQUFJO0FBQ2pELFlBQUlBLFVBQUosRUFBZ0I7O0FBQ2hCLFlBQUk7QUFDRnBGLFlBQUUsQ0FBQ2tGLFVBQUgsQ0FBY0osWUFBZCxFQUE0QkYsUUFBNUI7QUFDRCxTQUZELENBRUUsT0FBT1MsV0FBUCxFQUFvQixDQUNwQjtBQUNEO0FBQ0YsT0FQRDtBQVFEO0FBQ0YsR0E1TDZDLENBOEw5QztBQUNBOzs7QUFDQUMsaUJBQWUsQ0FBQ1YsUUFBRCxFQUFXO0FBQ3hCLFFBQUk7QUFDRixhQUFPNUUsRUFBRSxDQUFDdUYsWUFBSCxDQUFnQlgsUUFBaEIsRUFBMEIsTUFBMUIsQ0FBUDtBQUNELEtBRkQsQ0FFRSxPQUFPbEMsQ0FBUCxFQUFVO0FBQ1YsVUFBSUEsQ0FBQyxJQUFJQSxDQUFDLENBQUM4QyxJQUFGLEtBQVcsUUFBcEIsRUFDRSxPQUFPLElBQVA7QUFDRixZQUFNOUMsQ0FBTjtBQUNEO0FBQ0Y7O0FBeE02QyxDQUFoRCxDLENBMk1BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFDQStDLGVBQWUsR0FBRyxNQUFNQSxlQUFOLFNBQThCakYsbUJBQTlCLENBQWtEO0FBQ2xFQyxhQUFXLENBQUM7QUFDVkMsZ0JBRFU7QUFFVkMsb0JBRlU7QUFHVkMsa0JBQWMsR0FBRztBQUhQLEdBQUQsRUFJUjtBQUNELFVBQU07QUFBQ0Ysa0JBQUQ7QUFBZUMsc0JBQWY7QUFBaUNDO0FBQWpDLEtBQU4sRUFEQyxDQUdEOztBQUNBLFNBQUs4RSxNQUFMLEdBQWMsSUFBSW5GLEdBQUosQ0FBUTtBQUNwQm9GLFNBQUcsRUFBRSxLQUFLbkUsVUFEVTtBQUVwQjZCLFlBQU0sRUFBR3VDLEtBQUQsSUFBVyxLQUFLM0QsaUJBQUwsQ0FBdUIyRCxLQUF2QjtBQUZDLEtBQVIsQ0FBZDtBQUlELEdBYmlFLENBZWxFO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FBQ0FDLGdCQUFjLENBQUNoRSxTQUFELEVBQVk7QUFDeEIsVUFBTUMsS0FBSyxDQUFDLDJEQUFELENBQVg7QUFDRCxHQWhDaUUsQ0FrQ2xFO0FBQ0E7QUFDQTtBQUNBOzs7QUFDTWdFLHVCQUFOLENBQTRCQyxVQUE1QjtBQUFBLG9DQUF3QztBQUN0QyxZQUFNQyxXQUFXLEdBQUcsRUFBcEI7QUFDQSxZQUFNQyxNQUFNLEdBQUcsS0FBSzdFLGtCQUFMLElBQTJCZ0QsTUFBTSxDQUFDOEIsTUFBUCxDQUFjLElBQWQsQ0FBMUM7QUFFQUgsZ0JBQVUsQ0FBQ25DLE9BQVgsQ0FBbUIvQixTQUFTLElBQUk7QUFDOUIsWUFBSW9FLE1BQUosRUFBWTtBQUNWQSxnQkFBTSxDQUFDcEUsU0FBUyxDQUFDc0UsT0FBVixFQUFELENBQU4sR0FBOEIsQ0FBOUI7QUFDRDs7QUFFRCxjQUFNQyxTQUFTLEdBQUcsTUFBTTtBQUN0QixnQkFBTUMsUUFBUSxHQUFHLEtBQUt2QyxTQUFMLENBQWUsS0FBS2xDLFdBQUwsQ0FBaUJDLFNBQWpCLENBQWYsQ0FBakI7O0FBQ0EsY0FBSUcsYUFBYSxHQUFHLEtBQUswRCxNQUFMLENBQVlZLEdBQVosQ0FBZ0JELFFBQWhCLENBQXBCOztBQUVBLGNBQUksQ0FBRXJFLGFBQU4sRUFBcUI7QUFDbkJBLHlCQUFhLEdBQUcsS0FBS3VFLFVBQUwsQ0FBZ0JGLFFBQWhCLENBQWhCOztBQUNBLGdCQUFJckUsYUFBSixFQUFtQjtBQUNqQixtQkFBS1ksV0FBTCxDQUFrQixVQUFVZixTQUFTLENBQUMyRSxjQUFWLEVBQTRCLEVBQXhEO0FBQ0Q7QUFDRjs7QUFFRCxjQUFJLENBQUV4RSxhQUFOLEVBQXFCO0FBQ25CZ0UsdUJBQVcsQ0FBQ1MsSUFBWixDQUFpQjVFLFNBQVMsQ0FBQzJFLGNBQVYsRUFBakI7QUFDQXhFLHlCQUFhLEdBQUcwRSxPQUFPLENBQUNDLEtBQVIsQ0FBYyxLQUFLZCxjQUFMLENBQW9CaEUsU0FBcEIsQ0FBZCxDQUFoQjs7QUFFQSxnQkFBSSxDQUFFRyxhQUFOLEVBQXFCO0FBQ25CO0FBQ0E7QUFDQTtBQUNELGFBUmtCLENBVW5COzs7QUFDQSxpQkFBSzBELE1BQUwsQ0FBWWtCLEdBQVosQ0FBZ0JQLFFBQWhCLEVBQTBCckUsYUFBMUI7O0FBQ0EsaUJBQUs2RSxnQkFBTCxDQUFzQlIsUUFBdEIsRUFBZ0NyRSxhQUFoQztBQUNEOztBQUVELGlCQUFPQSxhQUFQO0FBQ0QsU0EzQkQ7O0FBNkJBLFlBQUksS0FBSzhFLG1CQUFMLElBQ0FqRixTQUFTLENBQUNrRix1QkFEZCxFQUN1QztBQUNyQyxlQUFLRCxtQkFBTCxDQUF5QmpGLFNBQXpCLEVBQW9DdUUsU0FBcEM7QUFDRCxTQUhELE1BR087QUFDTCxnQkFBTVksTUFBTSxHQUFHWixTQUFTLEVBQXhCOztBQUNBLGNBQUlZLE1BQUosRUFBWTtBQUNWLGlCQUFLakYsZ0JBQUwsQ0FBc0JGLFNBQXRCLEVBQWlDbUYsTUFBakM7QUFDRDtBQUNGO0FBQ0YsT0EzQ0Q7O0FBNkNBLFVBQUksS0FBSzVGLGtCQUFULEVBQTZCO0FBQzNCLGFBQUtPLG1CQUFMLENBQXlCOEUsSUFBekIsQ0FBOEIsTUFBTTtBQUNsQ1QscUJBQVcsQ0FBQ3pCLElBQVo7O0FBRUEsZUFBSzNCLFdBQUwsQ0FDRyxTQUNDLEVBQUUsS0FBS2xCLFVBQ1IsU0FDQ1MsSUFBSSxDQUFDQyxTQUFMLENBQWU0RCxXQUFmLENBQ0QsSUFDQzdELElBQUksQ0FBQ0MsU0FBTCxDQUFlZ0MsTUFBTSxDQUFDRCxJQUFQLENBQVk4QixNQUFaLEVBQW9CMUIsSUFBcEIsRUFBZixDQUNELEVBUEg7QUFTRCxTQVpEO0FBYUQ7QUFDRixLQWhFRDtBQUFBOztBQWtFQTBDLGdCQUFjLENBQUNaLFFBQUQsRUFBVztBQUN2QjtBQUNBO0FBQ0EsUUFBSSxDQUFDLGNBQWNhLElBQWQsQ0FBbUJiLFFBQW5CLENBQUwsRUFBbUM7QUFDakMsWUFBTXZFLEtBQUssQ0FBQyxtQkFBbUJ1RSxRQUFwQixDQUFYO0FBQ0Q7O0FBQ0QsV0FBT25HLElBQUksQ0FBQ2lILElBQUwsQ0FBVSxLQUFLMUYsVUFBZixFQUEyQjRFLFFBQVEsR0FBRyxRQUF0QyxDQUFQO0FBQ0QsR0EvR2lFLENBZ0hsRTtBQUNBOzs7QUFDQUUsWUFBVSxDQUFDRixRQUFELEVBQVc7QUFDbkIsUUFBSSxDQUFFLEtBQUs1RSxVQUFYLEVBQXVCO0FBQ3JCLGFBQU8sSUFBUDtBQUNEOztBQUNELFVBQU0yRixhQUFhLEdBQUcsS0FBS0gsY0FBTCxDQUFvQlosUUFBcEIsQ0FBdEI7O0FBQ0EsVUFBTXJFLGFBQWEsR0FBRyxLQUFLcUYsZ0NBQUwsQ0FBc0NELGFBQXRDLENBQXRCOztBQUNBLFFBQUksQ0FBRXBGLGFBQU4sRUFBcUI7QUFDbkIsYUFBTyxJQUFQO0FBQ0Q7O0FBQ0QsU0FBSzBELE1BQUwsQ0FBWWtCLEdBQVosQ0FBZ0JQLFFBQWhCLEVBQTBCckUsYUFBMUI7O0FBQ0EsV0FBT0EsYUFBUDtBQUNEOztBQUNENkUsa0JBQWdCLENBQUNSLFFBQUQsRUFBV3JFLGFBQVgsRUFBMEI7QUFDeEMsUUFBSSxDQUFFLEtBQUtQLFVBQVgsRUFDRTs7QUFDRixVQUFNMkYsYUFBYSxHQUFHLEtBQUtILGNBQUwsQ0FBb0JaLFFBQXBCLENBQXRCOztBQUNBLFVBQU1pQixhQUFhLEdBQUcsS0FBS3BGLHNCQUFMLENBQTRCRixhQUE1QixDQUF0Qjs7QUFDQSxTQUFLMkMsZUFBTCxDQUFxQnlDLGFBQXJCLEVBQW9DRSxhQUFwQztBQUNELEdBcElpRSxDQXNJbEU7QUFDQTs7O0FBQ0FELGtDQUFnQyxDQUFDekMsUUFBRCxFQUFXO0FBQ3pDLFVBQU0yQyxHQUFHLEdBQUcsS0FBS2pDLGVBQUwsQ0FBcUJWLFFBQXJCLENBQVo7O0FBQ0EsV0FBTyxLQUFLdkMsa0JBQUwsQ0FBd0JrRixHQUF4QixDQUFQO0FBQ0Q7O0FBM0lpRSxDQUFwRSxDOzs7Ozs7Ozs7OztBQy9QQSxNQUFNckgsSUFBSSxHQUFHRCxNQUFNLENBQUNDLElBQXBCOztBQUNBLE1BQU1LLEdBQUcsR0FBR0gsR0FBRyxDQUFDQyxPQUFKLENBQVksV0FBWixDQUFaLEMsQ0FFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FBQ0FtSCx3QkFBd0IsR0FBRyxNQUFNQSx3QkFBTixTQUNuQmhILG1CQURtQixDQUNDO0FBQzFCQyxhQUFXLENBQUM7QUFDVkMsZ0JBRFU7QUFFVkMsb0JBRlU7QUFHVkM7QUFIVSxHQUFELEVBSVI7QUFDRCxVQUFNO0FBQUNGLGtCQUFEO0FBQWVDLHNCQUFmO0FBQWlDQztBQUFqQyxLQUFOLEVBREMsQ0FHRDtBQUNBO0FBQ0E7O0FBQ0EsU0FBSzhFLE1BQUwsR0FBYyxJQUFJbkYsR0FBSixDQUFRO0FBQ3BCb0YsU0FBRyxFQUFFLEtBQUtuRSxVQURVO0FBRXBCO0FBQ0E2QixZQUFNLEVBQUd1QyxLQUFELElBQVcsS0FBSzNELGlCQUFMLENBQXVCMkQsS0FBSyxDQUFDNUQsYUFBN0I7QUFIQyxLQUFSLENBQWQ7QUFLRCxHQWhCeUIsQ0FrQjFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUFDQTZELGdCQUFjLENBQUNoRSxTQUFELEVBQVk0RixRQUFaLEVBQXNCO0FBQ2xDLFVBQU0zRixLQUFLLENBQ1Qsb0VBRFMsQ0FBWDtBQUVELEdBM0N5QixDQTZDMUI7QUFDQTtBQUNBO0FBQ0E7OztBQUNBNEYsUUFBTSxDQUFDN0YsU0FBRCxFQUFZO0FBQ2hCLFdBQU8sSUFBUDtBQUNELEdBbkR5QixDQXFEMUI7QUFDQTtBQUNBO0FBQ0E7OztBQUNBOEYsdUJBQXFCLENBQUM5RixTQUFELEVBQVk7QUFDL0IsUUFBSUEsU0FBUyxDQUFDK0YsY0FBVixPQUErQixJQUFuQyxFQUF5QztBQUN2QyxhQUFPLFFBQVEvRixTQUFTLENBQUNnRyxnQkFBVixFQUFmO0FBQ0Q7O0FBQ0QsV0FBTyxNQUFNaEcsU0FBUyxDQUFDK0YsY0FBVixFQUFOLEdBQW1DLElBQW5DLEdBQ0gvRixTQUFTLENBQUNnRyxnQkFBVixFQURKO0FBRUQsR0EvRHlCLENBaUUxQjs7O0FBQ00vQix1QkFBTixDQUE0QkMsVUFBNUI7QUFBQSxvQ0FBd0M7QUFDdEMsWUFBTTBCLFFBQVEsR0FBRyxJQUFJSyxHQUFKLEVBQWpCO0FBQ0EsWUFBTUMsV0FBVyxHQUFHLElBQUlELEdBQUosRUFBcEI7QUFDQSxZQUFNOUIsV0FBVyxHQUFHLEVBQXBCO0FBQ0EsWUFBTUMsTUFBTSxHQUFHLEtBQUs3RSxrQkFBTCxJQUEyQmdELE1BQU0sQ0FBQzhCLE1BQVAsQ0FBYyxJQUFkLENBQTFDO0FBRUFILGdCQUFVLENBQUNuQyxPQUFYLENBQW9CL0IsU0FBRCxJQUFlO0FBQ2hDLGNBQU1tRyxVQUFVLEdBQUcsS0FBS0wscUJBQUwsQ0FBMkI5RixTQUEzQixDQUFuQjtBQUNBNEYsZ0JBQVEsQ0FBQ2IsR0FBVCxDQUFhb0IsVUFBYixFQUF5Qm5HLFNBQXpCO0FBQ0FrRyxtQkFBVyxDQUFDbkIsR0FBWixDQUFnQm9CLFVBQWhCLEVBQTRCLEtBQUtDLG9CQUFMLENBQTBCcEcsU0FBMUIsQ0FBNUI7QUFDRCxPQUpEO0FBTUFrRSxnQkFBVSxDQUFDbkMsT0FBWCxDQUFtQi9CLFNBQVMsSUFBSTtBQUM5QixZQUFJb0UsTUFBSixFQUFZO0FBQ1ZBLGdCQUFNLENBQUNwRSxTQUFTLENBQUNzRSxPQUFWLEVBQUQsQ0FBTixHQUE4QixDQUE5QjtBQUNEOztBQUVELGNBQU1DLFNBQVMsR0FBRyxNQUFNO0FBQ3RCLGdCQUFNOEIsa0JBQWtCLEdBQUcsS0FBS1AscUJBQUwsQ0FBMkI5RixTQUEzQixDQUEzQjtBQUNBLGdCQUFNd0UsUUFBUSxHQUFHMEIsV0FBVyxDQUFDekIsR0FBWixDQUFnQjRCLGtCQUFoQixDQUFqQjs7QUFDQSxjQUFJQyxVQUFVLEdBQUcsS0FBS3pDLE1BQUwsQ0FBWVksR0FBWixDQUFnQkQsUUFBaEIsQ0FBakI7O0FBQ0EsY0FBSSxDQUFFOEIsVUFBTixFQUFrQjtBQUNoQkEsc0JBQVUsR0FBRyxLQUFLNUIsVUFBTCxDQUFnQkYsUUFBaEIsQ0FBYjs7QUFDQSxnQkFBSThCLFVBQUosRUFBZ0I7QUFDZCxtQkFBS3ZGLFdBQUwsQ0FBa0IsVUFBVXNGLGtCQUFvQixFQUFoRDtBQUNEO0FBQ0Y7O0FBRUQsY0FBSSxFQUFHQyxVQUFVLElBQUksS0FBS0MsZ0JBQUwsQ0FBc0JELFVBQXRCLEVBQWtDSixXQUFsQyxDQUFqQixDQUFKLEVBQXNFO0FBQ3BFL0IsdUJBQVcsQ0FBQ1MsSUFBWixDQUFpQjVFLFNBQVMsQ0FBQzJFLGNBQVYsRUFBakI7QUFFQSxrQkFBTTZCLG9CQUFvQixHQUN4QjNCLE9BQU8sQ0FBQ0MsS0FBUixDQUFjLEtBQUtkLGNBQUwsQ0FBb0JoRSxTQUFwQixFQUErQjRGLFFBQS9CLENBQWQsQ0FERjs7QUFHQSxnQkFBSSxDQUFFWSxvQkFBTixFQUE0QjtBQUMxQjtBQUNBO0FBQ0E7QUFDRDs7QUFFRCxrQkFBTTtBQUNKckcsMkJBREk7QUFFSnNHO0FBRkksZ0JBR0ZELG9CQUhKO0FBS0FGLHNCQUFVLEdBQUc7QUFDWG5HLDJCQURXO0FBRVh1Ryx1QkFBUyxFQUFFO0FBQ1Q7QUFDQSxpQkFBQ0wsa0JBQUQsR0FBc0JILFdBQVcsQ0FBQ3pCLEdBQVosQ0FBZ0I0QixrQkFBaEI7QUFGYjtBQUZBLGFBQWIsQ0FqQm9FLENBeUJwRTs7QUFDQUksaUNBQXFCLENBQUMxRSxPQUF0QixDQUErQjFELElBQUQsSUFBVTtBQUN0QyxrQkFBSSxDQUFDNkgsV0FBVyxDQUFDUyxHQUFaLENBQWdCdEksSUFBaEIsQ0FBTCxFQUE0QjtBQUMxQixzQkFBTTRCLEtBQUssQ0FBRSxnQ0FBZ0M1QixJQUFNLEVBQXhDLENBQVg7QUFDRDs7QUFDRGlJLHdCQUFVLENBQUNJLFNBQVgsQ0FBcUJySSxJQUFyQixJQUE2QjZILFdBQVcsQ0FBQ3pCLEdBQVosQ0FBZ0JwRyxJQUFoQixDQUE3QjtBQUNELGFBTEQsRUExQm9FLENBaUNwRTs7QUFDQSxpQkFBS3dGLE1BQUwsQ0FBWWtCLEdBQVosQ0FBZ0JQLFFBQWhCLEVBQTBCOEIsVUFBMUI7O0FBQ0EsaUJBQUt0QixnQkFBTCxDQUFzQlIsUUFBdEIsRUFBZ0M4QixVQUFoQztBQUNEOztBQUVELGlCQUFPQSxVQUFVLENBQUNuRyxhQUFsQjtBQUNELFNBbEREOztBQW9EQSxZQUFJLEtBQUs4RSxtQkFBTCxJQUNBakYsU0FBUyxDQUFDa0YsdUJBRGQsRUFDdUM7QUFDckMsY0FBSSxDQUFFLEtBQUtXLE1BQUwsQ0FBWTdGLFNBQVosQ0FBTixFQUE4QjtBQUM1QjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBQSxxQkFBUyxDQUFDNEcsY0FBVixHQUEyQkMsSUFBM0IsR0FBa0MsSUFBbEM7QUFDRDs7QUFDRCxlQUFLNUIsbUJBQUwsQ0FBeUJqRixTQUF6QixFQUFvQ3VFLFNBQXBDO0FBQ0QsU0FoQkQsTUFnQk8sSUFBSSxLQUFLc0IsTUFBTCxDQUFZN0YsU0FBWixDQUFKLEVBQTRCO0FBQ2pDLGdCQUFNbUYsTUFBTSxHQUFHWixTQUFTLEVBQXhCOztBQUNBLGNBQUlZLE1BQUosRUFBWTtBQUNWLGlCQUFLakYsZ0JBQUwsQ0FBc0JGLFNBQXRCLEVBQWlDbUYsTUFBakM7QUFDRDtBQUNGO0FBQ0YsT0EvRUQ7O0FBaUZBLFVBQUksS0FBSzVGLGtCQUFULEVBQTZCO0FBQzNCLGFBQUtPLG1CQUFMLENBQXlCOEUsSUFBekIsQ0FBOEIsTUFBTTtBQUNsQ1QscUJBQVcsQ0FBQ3pCLElBQVo7O0FBRUEsZUFBSzNCLFdBQUwsQ0FDRyxTQUNDLEVBQUUsS0FBS2xCLFVBQ1IsU0FDQ1MsSUFBSSxDQUFDQyxTQUFMLENBQWU0RCxXQUFmLENBQ0QsSUFDQzdELElBQUksQ0FBQ0MsU0FBTCxDQUFlZ0MsTUFBTSxDQUFDRCxJQUFQLENBQVk4QixNQUFaLEVBQW9CMUIsSUFBcEIsRUFBZixDQUNELEVBUEg7QUFTRCxTQVpEO0FBYUQ7QUFDRixLQTVHRDtBQUFBLEdBbEUwQixDQWdMMUI7QUFDQTtBQUNBOzs7QUFDQTBELHNCQUFvQixDQUFDcEcsU0FBRCxFQUFZO0FBQzlCLFdBQU8sS0FBS2lDLFNBQUwsQ0FBZSxDQUNwQixLQUFLNkQscUJBQUwsQ0FBMkI5RixTQUEzQixDQURvQixFQUVwQixLQUFLRCxXQUFMLENBQWlCQyxTQUFqQixDQUZvQixDQUFmLENBQVA7QUFJRDs7QUFFRHVHLGtCQUFnQixDQUFDRCxVQUFELEVBQWFKLFdBQWIsRUFBMEI7QUFDeEMsV0FBTzNELE1BQU0sQ0FBQ0QsSUFBUCxDQUFZZ0UsVUFBVSxDQUFDSSxTQUF2QixFQUFrQ0ksS0FBbEMsQ0FDSnpJLElBQUQsSUFBVWlJLFVBQVUsQ0FBQ0ksU0FBWCxDQUFxQnJJLElBQXJCLE1BQStCNkgsV0FBVyxDQUFDekIsR0FBWixDQUFnQnBHLElBQWhCLENBRHBDLENBQVA7QUFHRCxHQTlMeUIsQ0FnTTFCO0FBQ0E7QUFDQTs7O0FBQ0ErRyxnQkFBYyxDQUFDWixRQUFELEVBQVc7QUFDdkIsV0FBT25HLElBQUksQ0FBQ2lILElBQUwsQ0FBVSxLQUFLMUYsVUFBZixFQUEyQjRFLFFBQVEsR0FBRyxRQUF0QyxDQUFQO0FBQ0QsR0FyTXlCLENBdU0xQjtBQUNBOzs7QUFDQUUsWUFBVSxDQUFDRixRQUFELEVBQVc7QUFDbkIsUUFBSSxDQUFFLEtBQUs1RSxVQUFYLEVBQXVCO0FBQ3JCLGFBQU8sSUFBUDtBQUNEOztBQUNELFVBQU0yRixhQUFhLEdBQUcsS0FBS0gsY0FBTCxDQUFvQlosUUFBcEIsQ0FBdEI7O0FBQ0EsVUFBTWtCLEdBQUcsR0FBRyxLQUFLakMsZUFBTCxDQUFxQjhCLGFBQXJCLENBQVo7O0FBQ0EsUUFBSSxDQUFDRyxHQUFMLEVBQVU7QUFDUixhQUFPLElBQVA7QUFDRCxLQVJrQixDQVVuQjs7O0FBQ0EsVUFBTXFCLFlBQVksR0FBR3JCLEdBQUcsQ0FBQ3NCLE9BQUosQ0FBWSxJQUFaLENBQXJCOztBQUNBLFFBQUlELFlBQVksS0FBSyxDQUFDLENBQXRCLEVBQXlCO0FBQ3ZCLGFBQU8sSUFBUDtBQUNEOztBQUNELFVBQU1FLGVBQWUsR0FBR3ZCLEdBQUcsQ0FBQ3dCLFNBQUosQ0FBYyxDQUFkLEVBQWlCSCxZQUFqQixDQUF4QjtBQUNBLFVBQU1JLG1CQUFtQixHQUFHekIsR0FBRyxDQUFDd0IsU0FBSixDQUFjSCxZQUFZLEdBQUcsQ0FBN0IsQ0FBNUI7O0FBRUEsVUFBTUwsU0FBUyxHQUFHLEtBQUtoRyxnQkFBTCxDQUFzQnVHLGVBQXRCLENBQWxCOztBQUNBLFFBQUksQ0FBQ1AsU0FBTCxFQUFnQjtBQUNkLGFBQU8sSUFBUDtBQUNEOztBQUNELFVBQU12RyxhQUFhLEdBQUcsS0FBS0ssa0JBQUwsQ0FBd0IyRyxtQkFBeEIsQ0FBdEI7O0FBQ0EsUUFBSSxDQUFFaEgsYUFBTixFQUFxQjtBQUNuQixhQUFPLElBQVA7QUFDRDs7QUFFRCxVQUFNbUcsVUFBVSxHQUFHO0FBQUNuRyxtQkFBRDtBQUFnQnVHO0FBQWhCLEtBQW5COztBQUNBLFNBQUs3QyxNQUFMLENBQVlrQixHQUFaLENBQWdCUCxRQUFoQixFQUEwQjhCLFVBQTFCOztBQUNBLFdBQU9BLFVBQVA7QUFDRDs7QUFFRHRCLGtCQUFnQixDQUFDUixRQUFELEVBQVc4QixVQUFYLEVBQXVCO0FBQ3JDLFFBQUksQ0FBRSxLQUFLMUcsVUFBWCxFQUF1QjtBQUNyQixhQUFPLElBQVA7QUFDRDs7QUFDRCxVQUFNMkYsYUFBYSxHQUFHLEtBQUtILGNBQUwsQ0FBb0JaLFFBQXBCLENBQXRCOztBQUNBLFVBQU1pQixhQUFhLEdBQ2pCbkYsSUFBSSxDQUFDQyxTQUFMLENBQWUrRixVQUFVLENBQUNJLFNBQTFCLElBQXVDLElBQXZDLEdBQ0EsS0FBS3JHLHNCQUFMLENBQTRCaUcsVUFBVSxDQUFDbkcsYUFBdkMsQ0FGRjs7QUFHQSxTQUFLMkMsZUFBTCxDQUFxQnlDLGFBQXJCLEVBQW9DRSxhQUFwQztBQUNEOztBQWxQeUIsQ0FENUIsQyIsImZpbGUiOiIvcGFja2FnZXMvY2FjaGluZy1jb21waWxlci5qcyIsInNvdXJjZXNDb250ZW50IjpbImNvbnN0IGZzID0gUGx1Z2luLmZzO1xuY29uc3QgcGF0aCA9IFBsdWdpbi5wYXRoO1xuY29uc3QgY3JlYXRlSGFzaCA9IE5wbS5yZXF1aXJlKCdjcnlwdG8nKS5jcmVhdGVIYXNoO1xuY29uc3QgYXNzZXJ0ID0gTnBtLnJlcXVpcmUoJ2Fzc2VydCcpO1xuY29uc3QgTFJVID0gTnBtLnJlcXVpcmUoJ2xydS1jYWNoZScpO1xuXG4vLyBCYXNlIGNsYXNzIGZvciBDYWNoaW5nQ29tcGlsZXIgYW5kIE11bHRpRmlsZUNhY2hpbmdDb21waWxlci5cbkNhY2hpbmdDb21waWxlckJhc2UgPSBjbGFzcyBDYWNoaW5nQ29tcGlsZXJCYXNlIHtcbiAgY29uc3RydWN0b3Ioe1xuICAgIGNvbXBpbGVyTmFtZSxcbiAgICBkZWZhdWx0Q2FjaGVTaXplLFxuICAgIG1heFBhcmFsbGVsaXNtID0gMjAsXG4gIH0pIHtcbiAgICB0aGlzLl9jb21waWxlck5hbWUgPSBjb21waWxlck5hbWU7XG4gICAgdGhpcy5fbWF4UGFyYWxsZWxpc20gPSBtYXhQYXJhbGxlbGlzbTtcbiAgICBjb25zdCBjb21waWxlck5hbWVGb3JFbnZhciA9IGNvbXBpbGVyTmFtZS50b1VwcGVyQ2FzZSgpXG4gICAgICAucmVwbGFjZSgnLy0vZycsICdfJykucmVwbGFjZSgvW15BLVowLTlfXS9nLCAnJyk7XG4gICAgY29uc3QgZW52VmFyUHJlZml4ID0gJ01FVEVPUl8nICsgY29tcGlsZXJOYW1lRm9yRW52YXIgKyAnX0NBQ0hFXyc7XG5cbiAgICBjb25zdCBkZWJ1Z0VudlZhciA9IGVudlZhclByZWZpeCArICdERUJVRyc7XG4gICAgdGhpcy5fY2FjaGVEZWJ1Z0VuYWJsZWQgPSAhISBwcm9jZXNzLmVudltkZWJ1Z0VudlZhcl07XG5cbiAgICBjb25zdCBjYWNoZVNpemVFbnZWYXIgPSBlbnZWYXJQcmVmaXggKyAnU0laRSc7XG4gICAgdGhpcy5fY2FjaGVTaXplID0gK3Byb2Nlc3MuZW52W2NhY2hlU2l6ZUVudlZhcl0gfHwgZGVmYXVsdENhY2hlU2l6ZTtcblxuICAgIHRoaXMuX2Rpc2tDYWNoZSA9IG51bGw7XG5cbiAgICAvLyBGb3IgdGVzdGluZy5cbiAgICB0aGlzLl9jYWxsQ291bnQgPSAwO1xuXG4gICAgLy8gQ2FsbGJhY2tzIHRoYXQgd2lsbCBiZSBjYWxsZWQgYWZ0ZXIgdGhlIGxpbmtlciBpcyBkb25lIHByb2Nlc3NpbmdcbiAgICAvLyBmaWxlcywgYWZ0ZXIgYWxsIGxhenkgY29tcGlsYXRpb24gaGFzIGZpbmlzaGVkLlxuICAgIHRoaXMuX2FmdGVyTGlua0NhbGxiYWNrcyA9IFtdO1xuICB9XG5cbiAgLy8gWW91ciBzdWJjbGFzcyBtdXN0IG92ZXJyaWRlIHRoaXMgbWV0aG9kIHRvIGRlZmluZSB0aGUga2V5IHVzZWQgdG8gaWRlbnRpZnlcbiAgLy8gYSBwYXJ0aWN1bGFyIHZlcnNpb24gb2YgYW4gSW5wdXRGaWxlLlxuICAvL1xuICAvLyBHaXZlbiBhbiBJbnB1dEZpbGUgKHRoZSBkYXRhIHR5cGUgcGFzc2VkIHRvIHByb2Nlc3NGaWxlc0ZvclRhcmdldCBhcyBwYXJ0XG4gIC8vIG9mIHRoZSBQbHVnaW4ucmVnaXN0ZXJDb21waWxlciBBUEkpLCByZXR1cm5zIGEgY2FjaGUga2V5IHRoYXQgcmVwcmVzZW50c1xuICAvLyBpdC4gVGhpcyBjYWNoZSBrZXkgY2FuIGJlIGFueSBKU09OIHZhbHVlIChpdCB3aWxsIGJlIGNvbnZlcnRlZCBpbnRlcm5hbGx5XG4gIC8vIGludG8gYSBoYXNoKS4gIFRoaXMgc2hvdWxkIHJlZmxlY3QgYW55IGFzcGVjdCBvZiB0aGUgSW5wdXRGaWxlIHRoYXQgYWZmZWN0c1xuICAvLyB0aGUgb3V0cHV0IG9mIGBjb21waWxlT25lRmlsZWAuIFR5cGljYWxseSB5b3UnbGwgd2FudCB0byBpbmNsdWRlXG4gIC8vIGBpbnB1dEZpbGUuZ2V0RGVjbGFyZWRFeHBvcnRzKClgLCBhbmQgcGVyaGFwc1xuICAvLyBgaW5wdXRGaWxlLmdldFBhdGhJblBhY2thZ2UoKWAgb3IgYGlucHV0RmlsZS5nZXREZWNsYXJlZEV4cG9ydHNgIGlmXG4gIC8vIGBjb21waWxlT25lRmlsZWAgcGF5cyBhdHRlbnRpb24gdG8gdGhlbS5cbiAgLy9cbiAgLy8gTm90ZSB0aGF0IGZvciBNdWx0aUZpbGVDYWNoaW5nQ29tcGlsZXIsIHlvdXIgY2FjaGUga2V5IGRvZXNuJ3QgbmVlZCB0b1xuICAvLyBpbmNsdWRlIHRoZSBmaWxlJ3MgcGF0aCwgYmVjYXVzZSB0aGF0IGlzIGF1dG9tYXRpY2FsbHkgdGFrZW4gaW50byBhY2NvdW50XG4gIC8vIGJ5IHRoZSBpbXBsZW1lbnRhdGlvbi4gQ2FjaGluZ0NvbXBpbGVyIHN1YmNsYXNzZXMgY2FuIGNob29zZSB3aGV0aGVyIG9yIG5vdFxuICAvLyB0byBpbmNsdWRlIHRoZSBmaWxlJ3MgcGF0aCBpbiB0aGUgY2FjaGUga2V5LlxuICBnZXRDYWNoZUtleShpbnB1dEZpbGUpIHtcbiAgICB0aHJvdyBFcnJvcignQ2FjaGluZ0NvbXBpbGVyIHN1YmNsYXNzIHNob3VsZCBpbXBsZW1lbnQgZ2V0Q2FjaGVLZXkhJyk7XG4gIH1cblxuICAvLyBZb3VyIHN1YmNsYXNzIG11c3Qgb3ZlcnJpZGUgdGhpcyBtZXRob2QgdG8gZGVmaW5lIGhvdyBhIENvbXBpbGVSZXN1bHRcbiAgLy8gdHJhbnNsYXRlcyBpbnRvIGFkZGluZyBhc3NldHMgdG8gdGhlIGJ1bmRsZS5cbiAgLy9cbiAgLy8gVGhpcyBtZXRob2QgaXMgZ2l2ZW4gYW4gSW5wdXRGaWxlICh0aGUgZGF0YSB0eXBlIHBhc3NlZCB0b1xuICAvLyBwcm9jZXNzRmlsZXNGb3JUYXJnZXQgYXMgcGFydCBvZiB0aGUgUGx1Z2luLnJlZ2lzdGVyQ29tcGlsZXIgQVBJKSBhbmQgYVxuICAvLyBDb21waWxlUmVzdWx0IChlaXRoZXIgcmV0dXJuZWQgZGlyZWN0bHkgZnJvbSBjb21waWxlT25lRmlsZSBvciByZWFkIGZyb21cbiAgLy8gdGhlIGNhY2hlKS4gIEl0IHNob3VsZCBjYWxsIG1ldGhvZHMgbGlrZSBgaW5wdXRGaWxlLmFkZEphdmFTY3JpcHRgXG4gIC8vIGFuZCBgaW5wdXRGaWxlLmVycm9yYC5cbiAgYWRkQ29tcGlsZVJlc3VsdChpbnB1dEZpbGUsIGNvbXBpbGVSZXN1bHQpIHtcbiAgICB0aHJvdyBFcnJvcignQ2FjaGluZ0NvbXBpbGVyIHN1YmNsYXNzIHNob3VsZCBpbXBsZW1lbnQgYWRkQ29tcGlsZVJlc3VsdCEnKTtcbiAgfVxuXG4gIC8vIFlvdXIgc3ViY2xhc3MgbXVzdCBvdmVycmlkZSB0aGlzIG1ldGhvZCB0byBkZWZpbmUgdGhlIHNpemUgb2YgYVxuICAvLyBDb21waWxlclJlc3VsdCAodXNlZCBieSB0aGUgaW4tbWVtb3J5IGNhY2hlIHRvIGxpbWl0IHRoZSB0b3RhbCBhbW91bnQgb2ZcbiAgLy8gZGF0YSBjYWNoZWQpLlxuICBjb21waWxlUmVzdWx0U2l6ZShjb21waWxlUmVzdWx0KSB7XG4gICAgdGhyb3cgRXJyb3IoJ0NhY2hpbmdDb21waWxlciBzdWJjbGFzcyBzaG91bGQgaW1wbGVtZW50IGNvbXBpbGVSZXN1bHRTaXplIScpO1xuICB9XG5cbiAgLy8gWW91ciBzdWJjbGFzcyBtYXkgb3ZlcnJpZGUgdGhpcyBtZXRob2QgdG8gZGVmaW5lIGFuIGFsdGVybmF0ZSB3YXkgb2ZcbiAgLy8gc3RyaW5naWZ5aW5nIENvbXBpbGVyUmVzdWx0cy4gIFRha2VzIGEgQ29tcGlsZVJlc3VsdCBhbmQgcmV0dXJucyBhIHN0cmluZy5cbiAgc3RyaW5naWZ5Q29tcGlsZVJlc3VsdChjb21waWxlUmVzdWx0KSB7XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KGNvbXBpbGVSZXN1bHQpO1xuICB9XG4gIC8vIFlvdXIgc3ViY2xhc3MgbWF5IG92ZXJyaWRlIHRoaXMgbWV0aG9kIHRvIGRlZmluZSBhbiBhbHRlcm5hdGUgd2F5IG9mXG4gIC8vIHBhcnNpbmcgQ29tcGlsZXJSZXN1bHRzIGZyb20gc3RyaW5nLiAgVGFrZXMgYSBzdHJpbmcgYW5kIHJldHVybnMgYVxuICAvLyBDb21waWxlUmVzdWx0LiAgSWYgdGhlIHN0cmluZyBkb2Vzbid0IHJlcHJlc2VudCBhIHZhbGlkIENvbXBpbGVSZXN1bHQsIHlvdVxuICAvLyBtYXkgd2FudCB0byByZXR1cm4gbnVsbCBpbnN0ZWFkIG9mIHRocm93aW5nLCB3aGljaCB3aWxsIG1ha2VcbiAgLy8gQ2FjaGluZ0NvbXBpbGVyIGlnbm9yZSB0aGUgY2FjaGUuXG4gIHBhcnNlQ29tcGlsZVJlc3VsdChzdHJpbmdpZmllZENvbXBpbGVSZXN1bHQpIHtcbiAgICByZXR1cm4gdGhpcy5fcGFyc2VKU09OT3JOdWxsKHN0cmluZ2lmaWVkQ29tcGlsZVJlc3VsdCk7XG4gIH1cbiAgX3BhcnNlSlNPTk9yTnVsbChqc29uKSB7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiBKU09OLnBhcnNlKGpzb24pO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGlmIChlIGluc3RhbmNlb2YgU3ludGF4RXJyb3IpXG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgdGhyb3cgZTtcbiAgICB9XG4gIH1cblxuICBfY2FjaGVEZWJ1ZyhtZXNzYWdlKSB7XG4gICAgaWYgKCF0aGlzLl9jYWNoZURlYnVnRW5hYmxlZClcbiAgICAgIHJldHVybjtcbiAgICBjb25zb2xlLmxvZyhgQ0FDSEUoJHsgdGhpcy5fY29tcGlsZXJOYW1lIH0pOiAkeyBtZXNzYWdlIH1gKTtcbiAgfVxuXG4gIHNldERpc2tDYWNoZURpcmVjdG9yeShkaXNrQ2FjaGUpIHtcbiAgICBpZiAodGhpcy5fZGlza0NhY2hlKVxuICAgICAgdGhyb3cgRXJyb3IoJ3NldERpc2tDYWNoZURpcmVjdG9yeSBjYWxsZWQgdHdpY2U/Jyk7XG4gICAgdGhpcy5fZGlza0NhY2hlID0gZGlza0NhY2hlO1xuICB9XG5cbiAgLy8gU2luY2Ugc28gbWFueSBjb21waWxlcnMgd2lsbCBuZWVkIHRvIGNhbGN1bGF0ZSB0aGUgc2l6ZSBvZiBhIFNvdXJjZU1hcCBpblxuICAvLyB0aGVpciBjb21waWxlUmVzdWx0U2l6ZSwgdGhpcyBtZXRob2QgaXMgcHJvdmlkZWQuXG4gIHNvdXJjZU1hcFNpemUoc20pIHtcbiAgICBpZiAoISBzbSkgcmV0dXJuIDA7XG4gICAgLy8gc3VtIHRoZSBsZW5ndGggb2Ygc291cmNlcyBhbmQgdGhlIG1hcHBpbmdzLCB0aGUgc2l6ZSBvZlxuICAgIC8vIG1ldGFkYXRhIGlzIGlnbm9yZWQsIGJ1dCBpdCBpcyBub3QgYSBiaWcgZGVhbFxuICAgIHJldHVybiBzbS5tYXBwaW5ncy5sZW5ndGhcbiAgICAgICsgKHNtLnNvdXJjZXNDb250ZW50IHx8IFtdKS5yZWR1Y2UoZnVuY3Rpb24gKHNvRmFyLCBjdXJyZW50KSB7XG4gICAgICAgIHJldHVybiBzb0ZhciArIChjdXJyZW50ID8gY3VycmVudC5sZW5ndGggOiAwKTtcbiAgICAgIH0sIDApO1xuICB9XG5cbiAgLy8gQ2FsbGVkIGJ5IHRoZSBjb21waWxlciBwbHVnaW5zIHN5c3RlbSBhZnRlciBhbGwgbGlua2luZyBhbmQgbGF6eVxuICAvLyBjb21waWxhdGlvbiBoYXMgZmluaXNoZWQuXG4gIGFmdGVyTGluaygpIHtcbiAgICB0aGlzLl9hZnRlckxpbmtDYWxsYmFja3Muc3BsaWNlKDApLmZvckVhY2goY2FsbGJhY2sgPT4ge1xuICAgICAgY2FsbGJhY2soKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8vIEJvcnJvd2VkIGZyb20gYW5vdGhlciBNSVQtbGljZW5zZWQgcHJvamVjdCB0aGF0IGJlbmphbW4gd3JvdGU6XG4gIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9yZWFjdGpzL2NvbW1vbmVyL2Jsb2IvMjM1ZDU0YTEyYy9saWIvdXRpbC5qcyNMMTM2LUwxNjhcbiAgX2RlZXBIYXNoKHZhbCkge1xuICAgIGNvbnN0IGhhc2ggPSBjcmVhdGVIYXNoKCdzaGExJyk7XG4gICAgbGV0IHR5cGUgPSB0eXBlb2YgdmFsO1xuXG4gICAgaWYgKHZhbCA9PT0gbnVsbCkge1xuICAgICAgdHlwZSA9ICdudWxsJztcbiAgICB9XG4gICAgaGFzaC51cGRhdGUodHlwZSArICdcXDAnKTtcblxuICAgIHN3aXRjaCAodHlwZSkge1xuICAgIGNhc2UgJ29iamVjdCc6XG4gICAgICBjb25zdCBrZXlzID0gT2JqZWN0LmtleXModmFsKTtcblxuICAgICAgLy8gQXJyYXkga2V5cyB3aWxsIGFscmVhZHkgYmUgc29ydGVkLlxuICAgICAgaWYgKCEgQXJyYXkuaXNBcnJheSh2YWwpKSB7XG4gICAgICAgIGtleXMuc29ydCgpO1xuICAgICAgfVxuXG4gICAgICBrZXlzLmZvckVhY2goKGtleSkgPT4ge1xuICAgICAgICBpZiAodHlwZW9mIHZhbFtrZXldID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgLy8gU2lsZW50bHkgaWdub3JlIG5lc3RlZCBtZXRob2RzLCBidXQgbmV2ZXJ0aGVsZXNzIGNvbXBsYWluIGJlbG93XG4gICAgICAgICAgLy8gaWYgdGhlIHJvb3QgdmFsdWUgaXMgYSBmdW5jdGlvbi5cbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBoYXNoLnVwZGF0ZShrZXkgKyAnXFwwJykudXBkYXRlKHRoaXMuX2RlZXBIYXNoKHZhbFtrZXldKSk7XG4gICAgICB9KTtcblxuICAgICAgYnJlYWs7XG5cbiAgICBjYXNlICdmdW5jdGlvbic6XG4gICAgICBhc3NlcnQub2soZmFsc2UsICdjYW5ub3QgaGFzaCBmdW5jdGlvbiBvYmplY3RzJyk7XG4gICAgICBicmVhaztcblxuICAgIGRlZmF1bHQ6XG4gICAgICBoYXNoLnVwZGF0ZSgnJyArIHZhbCk7XG4gICAgICBicmVhaztcbiAgICB9XG5cbiAgICByZXR1cm4gaGFzaC5kaWdlc3QoJ2hleCcpO1xuICB9XG5cbiAgLy8gV2Ugd2FudCB0byB3cml0ZSB0aGUgZmlsZSBhdG9taWNhbGx5LiBCdXQgd2UgYWxzbyBkb24ndCB3YW50IHRvIGJsb2NrXG4gIC8vIHByb2Nlc3Npbmcgb24gdGhlIGZpbGUgd3JpdGUuXG4gIF93cml0ZUZpbGVBc3luYyhmaWxlbmFtZSwgY29udGVudHMpIHtcbiAgICBjb25zdCB0ZW1wRmlsZW5hbWUgPSBmaWxlbmFtZSArICcudG1wLicgKyBSYW5kb20uaWQoKTtcbiAgICBpZiAodGhpcy5fY2FjaGVEZWJ1Z0VuYWJsZWQpIHtcbiAgICAgIC8vIFdyaXRlIGNhY2hlIGZpbGUgc3luY2hyb25vdXNseSB3aGVuIGNhY2hlIGRlYnVnZ2luZyBlbmFibGVkLlxuICAgICAgdHJ5IHtcbiAgICAgICAgZnMud3JpdGVGaWxlU3luYyh0ZW1wRmlsZW5hbWUsIGNvbnRlbnRzKTtcbiAgICAgICAgZnMucmVuYW1lU3luYyh0ZW1wRmlsZW5hbWUsIGZpbGVuYW1lKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgLy8gaWdub3JlIGVycm9ycywgaXQncyBqdXN0IGEgY2FjaGVcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgZnMud3JpdGVGaWxlKHRlbXBGaWxlbmFtZSwgY29udGVudHMsIHdyaXRlRXJyb3IgPT4ge1xuICAgICAgICBpZiAod3JpdGVFcnJvcikgcmV0dXJuO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGZzLnJlbmFtZVN5bmModGVtcEZpbGVuYW1lLCBmaWxlbmFtZSk7XG4gICAgICAgIH0gY2F0Y2ggKHJlbmFtZUVycm9yKSB7XG4gICAgICAgICAgLy8gaWdub3JlIGVycm9ycywgaXQncyBqdXN0IGEgY2FjaGVcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgLy8gSGVscGVyIGZ1bmN0aW9uLiBSZXR1cm5zIHRoZSBib2R5IG9mIHRoZSBmaWxlIGFzIGEgc3RyaW5nLCBvciBudWxsIGlmIGl0XG4gIC8vIGRvZXNuJ3QgZXhpc3QuXG4gIF9yZWFkRmlsZU9yTnVsbChmaWxlbmFtZSkge1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4gZnMucmVhZEZpbGVTeW5jKGZpbGVuYW1lLCAndXRmOCcpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGlmIChlICYmIGUuY29kZSA9PT0gJ0VOT0VOVCcpXG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgdGhyb3cgZTtcbiAgICB9XG4gIH1cbn1cblxuLy8gQ2FjaGluZ0NvbXBpbGVyIGlzIGEgY2xhc3MgZGVzaWduZWQgdG8gYmUgdXNlZCB3aXRoIFBsdWdpbi5yZWdpc3RlckNvbXBpbGVyXG4vLyB3aGljaCBpbXBsZW1lbnRzIGluLW1lbW9yeSBhbmQgb24tZGlzayBjYWNoZXMgZm9yIHRoZSBmaWxlcyB0aGF0IGl0XG4vLyBwcm9jZXNzZXMuICBZb3Ugc2hvdWxkIHN1YmNsYXNzIENhY2hpbmdDb21waWxlciBhbmQgZGVmaW5lIHRoZSBmb2xsb3dpbmdcbi8vIG1ldGhvZHM6IGdldENhY2hlS2V5LCBjb21waWxlT25lRmlsZSwgYWRkQ29tcGlsZVJlc3VsdCwgYW5kXG4vLyBjb21waWxlUmVzdWx0U2l6ZS5cbi8vXG4vLyBDYWNoaW5nQ29tcGlsZXIgYXNzdW1lcyB0aGF0IGZpbGVzIGFyZSBwcm9jZXNzZWQgaW5kZXBlbmRlbnRseSBvZiBlYWNoIG90aGVyO1xuLy8gdGhlcmUgaXMgbm8gJ2ltcG9ydCcgZGlyZWN0aXZlIGFsbG93aW5nIG9uZSBmaWxlIHRvIHJlZmVyZW5jZSBhbm90aGVyLiAgVGhhdFxuLy8gaXMsIGVkaXRpbmcgb25lIGZpbGUgc2hvdWxkIG9ubHkgcmVxdWlyZSB0aGF0IGZpbGUgdG8gYmUgcmVidWlsdCwgbm90IG90aGVyXG4vLyBmaWxlcy5cbi8vXG4vLyBUaGUgZGF0YSB0aGF0IGlzIGNhY2hlZCBmb3IgZWFjaCBmaWxlIGlzIG9mIGEgdHlwZSB0aGF0IGlzIChpbXBsaWNpdGx5KVxuLy8gZGVmaW5lZCBieSB5b3VyIHN1YmNsYXNzLiBDYWNoaW5nQ29tcGlsZXIgcmVmZXJzIHRvIHRoaXMgdHlwZSBhc1xuLy8gYENvbXBpbGVSZXN1bHRgLCBidXQgdGhpcyBpc24ndCBhIHNpbmdsZSB0eXBlOiBpdCdzIHVwIHRvIHlvdXIgc3ViY2xhc3MgdG9cbi8vIGRlY2lkZSB3aGF0IHR5cGUgb2YgZGF0YSB0aGlzIGlzLiAgWW91IHNob3VsZCBkb2N1bWVudCB3aGF0IHlvdXIgc3ViY2xhc3Mnc1xuLy8gQ29tcGlsZVJlc3VsdCB0eXBlIGlzLlxuLy9cbi8vIFlvdXIgc3ViY2xhc3MncyBjb21waWxlciBzaG91bGQgY2FsbCB0aGUgc3VwZXJjbGFzcyBjb21waWxlciBzcGVjaWZ5aW5nIHRoZVxuLy8gY29tcGlsZXIgbmFtZSAodXNlZCB0byBnZW5lcmF0ZSBlbnZpcm9ubWVudCB2YXJpYWJsZXMgZm9yIGRlYnVnZ2luZyBhbmRcbi8vIHR3ZWFraW5nIGluLW1lbW9yeSBjYWNoZSBzaXplKSBhbmQgdGhlIGRlZmF1bHQgY2FjaGUgc2l6ZS5cbi8vXG4vLyBCeSBkZWZhdWx0LCBDYWNoaW5nQ29tcGlsZXIgcHJvY2Vzc2VzIGVhY2ggZmlsZSBpbiBcInBhcmFsbGVsXCIuIFRoYXQgaXMsIGlmIGl0XG4vLyBuZWVkcyB0byB5aWVsZCB0byByZWFkIGZyb20gdGhlIGRpc2sgY2FjaGUsIG9yIGlmIGdldENhY2hlS2V5LFxuLy8gY29tcGlsZU9uZUZpbGUsIG9yIGFkZENvbXBpbGVSZXN1bHQgeWllbGRzLCBpdCB3aWxsIHN0YXJ0IHByb2Nlc3NpbmcgdGhlIG5leHRcbi8vIGZldyBmaWxlcy4gVG8gc2V0IGhvdyBtYW55IGZpbGVzIGNhbiBiZSBwcm9jZXNzZWQgaW4gcGFyYWxsZWwgKGluY2x1ZGluZ1xuLy8gc2V0dGluZyBpdCB0byAxIGlmIHlvdXIgc3ViY2xhc3MgZG9lc24ndCBzdXBwb3J0IGFueSBwYXJhbGxlbGlzbSksIHBhc3MgdGhlXG4vLyBtYXhQYXJhbGxlbGlzbSBvcHRpb24gdG8gdGhlIHN1cGVyY2xhc3MgY29uc3RydWN0b3IuXG4vL1xuLy8gRm9yIGV4YW1wbGUgKHVzaW5nIEVTMjAxNSB2aWEgdGhlIGVjbWFzY3JpcHQgcGFja2FnZSk6XG4vL1xuLy8gICBjbGFzcyBBd2Vzb21lQ29tcGlsZXIgZXh0ZW5kcyBDYWNoaW5nQ29tcGlsZXIge1xuLy8gICAgIGNvbnN0cnVjdG9yKCkge1xuLy8gICAgICAgc3VwZXIoe1xuLy8gICAgICAgICBjb21waWxlck5hbWU6ICdhd2Vzb21lJyxcbi8vICAgICAgICAgZGVmYXVsdENhY2hlU2l6ZTogMTAyNCoxMDI0KjEwLFxuLy8gICAgICAgfSk7XG4vLyAgICAgfVxuLy8gICAgIC8vIC4uLiBkZWZpbmUgdGhlIG90aGVyIG1ldGhvZHNcbi8vICAgfVxuLy8gICBQbHVnaW4ucmVnaXN0ZXJDb21waWxlKHtcbi8vICAgICBleHRlbnNpb25zOiBbJ2F3ZXNvbWUnXSxcbi8vICAgfSwgKCkgPT4gbmV3IEF3ZXNvbWVDb21waWxlcigpKTtcbi8vXG4vLyBYWFggbWF5YmUgY29tcGlsZVJlc3VsdFNpemUgYW5kIHN0cmluZ2lmeUNvbXBpbGVSZXN1bHQgc2hvdWxkIGp1c3QgYmUgbWV0aG9kc1xuLy8gb24gQ29tcGlsZVJlc3VsdD8gU29ydCBvZiBoYXJkIHRvIGRvIHRoYXQgd2l0aCBwYXJzZUNvbXBpbGVSZXN1bHQuXG5DYWNoaW5nQ29tcGlsZXIgPSBjbGFzcyBDYWNoaW5nQ29tcGlsZXIgZXh0ZW5kcyBDYWNoaW5nQ29tcGlsZXJCYXNlIHtcbiAgY29uc3RydWN0b3Ioe1xuICAgIGNvbXBpbGVyTmFtZSxcbiAgICBkZWZhdWx0Q2FjaGVTaXplLFxuICAgIG1heFBhcmFsbGVsaXNtID0gMjAsXG4gIH0pIHtcbiAgICBzdXBlcih7Y29tcGlsZXJOYW1lLCBkZWZhdWx0Q2FjaGVTaXplLCBtYXhQYXJhbGxlbGlzbX0pO1xuXG4gICAgLy8gTWFwcyBmcm9tIGEgaGFzaGVkIGNhY2hlIGtleSB0byBhIGNvbXBpbGVSZXN1bHQuXG4gICAgdGhpcy5fY2FjaGUgPSBuZXcgTFJVKHtcbiAgICAgIG1heDogdGhpcy5fY2FjaGVTaXplLFxuICAgICAgbGVuZ3RoOiAodmFsdWUpID0+IHRoaXMuY29tcGlsZVJlc3VsdFNpemUodmFsdWUpLFxuICAgIH0pO1xuICB9XG5cbiAgLy8gWW91ciBzdWJjbGFzcyBtdXN0IG92ZXJyaWRlIHRoaXMgbWV0aG9kIHRvIGRlZmluZSB0aGUgdHJhbnNmb3JtYXRpb24gZnJvbVxuICAvLyBJbnB1dEZpbGUgdG8gaXRzIGNhY2hlYWJsZSBDb21waWxlUmVzdWx0KS5cbiAgLy9cbiAgLy8gR2l2ZW4gYW4gSW5wdXRGaWxlICh0aGUgZGF0YSB0eXBlIHBhc3NlZCB0byBwcm9jZXNzRmlsZXNGb3JUYXJnZXQgYXMgcGFydFxuICAvLyBvZiB0aGUgUGx1Z2luLnJlZ2lzdGVyQ29tcGlsZXIgQVBJKSwgY29tcGlsZXMgdGhlIGZpbGUgYW5kIHJldHVybnMgYVxuICAvLyBDb21waWxlUmVzdWx0ICh0aGUgY2FjaGVhYmxlIGRhdGEgdHlwZSBzcGVjaWZpYyB0byB5b3VyIHN1YmNsYXNzKS5cbiAgLy9cbiAgLy8gVGhpcyBtZXRob2QgaXMgbm90IGNhbGxlZCBvbiBmaWxlcyB3aGVuIGEgdmFsaWQgY2FjaGUgZW50cnkgZXhpc3RzIGluXG4gIC8vIG1lbW9yeSBvciBvbiBkaXNrLlxuICAvL1xuICAvLyBPbiBhIGNvbXBpbGUgZXJyb3IsIHlvdSBzaG91bGQgY2FsbCBgaW5wdXRGaWxlLmVycm9yYCBhcHByb3ByaWF0ZWx5IGFuZFxuICAvLyByZXR1cm4gbnVsbDsgdGhpcyB3aWxsIG5vdCBiZSBjYWNoZWQuXG4gIC8vXG4gIC8vIFRoaXMgbWV0aG9kIHNob3VsZCBub3QgY2FsbCBgaW5wdXRGaWxlLmFkZEphdmFTY3JpcHRgIGFuZCBzaW1pbGFyIGZpbGVzIVxuICAvLyBUaGF0J3Mgd2hhdCBhZGRDb21waWxlUmVzdWx0IGlzIGZvci5cbiAgY29tcGlsZU9uZUZpbGUoaW5wdXRGaWxlKSB7XG4gICAgdGhyb3cgRXJyb3IoJ0NhY2hpbmdDb21waWxlciBzdWJjbGFzcyBzaG91bGQgaW1wbGVtZW50IGNvbXBpbGVPbmVGaWxlIScpO1xuICB9XG5cbiAgLy8gVGhlIHByb2Nlc3NGaWxlc0ZvclRhcmdldCBtZXRob2QgZnJvbSB0aGUgUGx1Z2luLnJlZ2lzdGVyQ29tcGlsZXIgQVBJLiBJZlxuICAvLyB5b3UgaGF2ZSBwcm9jZXNzaW5nIHlvdSB3YW50IHRvIHBlcmZvcm0gYXQgdGhlIGJlZ2lubmluZyBvciBlbmQgb2YgYVxuICAvLyBwcm9jZXNzaW5nIHBoYXNlLCB5b3UgbWF5IHdhbnQgdG8gb3ZlcnJpZGUgdGhpcyBtZXRob2QgYW5kIGNhbGwgdGhlXG4gIC8vIHN1cGVyY2xhc3MgaW1wbGVtZW50YXRpb24gZnJvbSB3aXRoaW4geW91ciBtZXRob2QuXG4gIGFzeW5jIHByb2Nlc3NGaWxlc0ZvclRhcmdldChpbnB1dEZpbGVzKSB7XG4gICAgY29uc3QgY2FjaGVNaXNzZXMgPSBbXTtcbiAgICBjb25zdCBhcmNoZXMgPSB0aGlzLl9jYWNoZURlYnVnRW5hYmxlZCAmJiBPYmplY3QuY3JlYXRlKG51bGwpO1xuXG4gICAgaW5wdXRGaWxlcy5mb3JFYWNoKGlucHV0RmlsZSA9PiB7XG4gICAgICBpZiAoYXJjaGVzKSB7XG4gICAgICAgIGFyY2hlc1tpbnB1dEZpbGUuZ2V0QXJjaCgpXSA9IDE7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGdldFJlc3VsdCA9ICgpID0+IHtcbiAgICAgICAgY29uc3QgY2FjaGVLZXkgPSB0aGlzLl9kZWVwSGFzaCh0aGlzLmdldENhY2hlS2V5KGlucHV0RmlsZSkpO1xuICAgICAgICBsZXQgY29tcGlsZVJlc3VsdCA9IHRoaXMuX2NhY2hlLmdldChjYWNoZUtleSk7XG5cbiAgICAgICAgaWYgKCEgY29tcGlsZVJlc3VsdCkge1xuICAgICAgICAgIGNvbXBpbGVSZXN1bHQgPSB0aGlzLl9yZWFkQ2FjaGUoY2FjaGVLZXkpO1xuICAgICAgICAgIGlmIChjb21waWxlUmVzdWx0KSB7XG4gICAgICAgICAgICB0aGlzLl9jYWNoZURlYnVnKGBMb2FkZWQgJHsgaW5wdXRGaWxlLmdldERpc3BsYXlQYXRoKCkgfWApO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghIGNvbXBpbGVSZXN1bHQpIHtcbiAgICAgICAgICBjYWNoZU1pc3Nlcy5wdXNoKGlucHV0RmlsZS5nZXREaXNwbGF5UGF0aCgpKTtcbiAgICAgICAgICBjb21waWxlUmVzdWx0ID0gUHJvbWlzZS5hd2FpdCh0aGlzLmNvbXBpbGVPbmVGaWxlKGlucHV0RmlsZSkpO1xuXG4gICAgICAgICAgaWYgKCEgY29tcGlsZVJlc3VsdCkge1xuICAgICAgICAgICAgLy8gY29tcGlsZU9uZUZpbGUgc2hvdWxkIGhhdmUgY2FsbGVkIGlucHV0RmlsZS5lcnJvci5cbiAgICAgICAgICAgIC8vICBXZSBkb24ndCBjYWNoZSBmYWlsdXJlcyBmb3Igbm93LlxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIFNhdmUgd2hhdCB3ZSd2ZSBjb21waWxlZC5cbiAgICAgICAgICB0aGlzLl9jYWNoZS5zZXQoY2FjaGVLZXksIGNvbXBpbGVSZXN1bHQpO1xuICAgICAgICAgIHRoaXMuX3dyaXRlQ2FjaGVBc3luYyhjYWNoZUtleSwgY29tcGlsZVJlc3VsdCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gY29tcGlsZVJlc3VsdDtcbiAgICAgIH07XG5cbiAgICAgIGlmICh0aGlzLmNvbXBpbGVPbmVGaWxlTGF0ZXIgJiZcbiAgICAgICAgICBpbnB1dEZpbGUuc3VwcG9ydHNMYXp5Q29tcGlsYXRpb24pIHtcbiAgICAgICAgdGhpcy5jb21waWxlT25lRmlsZUxhdGVyKGlucHV0RmlsZSwgZ2V0UmVzdWx0KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGdldFJlc3VsdCgpO1xuICAgICAgICBpZiAocmVzdWx0KSB7XG4gICAgICAgICAgdGhpcy5hZGRDb21waWxlUmVzdWx0KGlucHV0RmlsZSwgcmVzdWx0KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgaWYgKHRoaXMuX2NhY2hlRGVidWdFbmFibGVkKSB7XG4gICAgICB0aGlzLl9hZnRlckxpbmtDYWxsYmFja3MucHVzaCgoKSA9PiB7XG4gICAgICAgIGNhY2hlTWlzc2VzLnNvcnQoKTtcblxuICAgICAgICB0aGlzLl9jYWNoZURlYnVnKFxuICAgICAgICAgIGBSYW4gKCMke1xuICAgICAgICAgICAgKyt0aGlzLl9jYWxsQ291bnRcbiAgICAgICAgICB9KSBvbjogJHtcbiAgICAgICAgICAgIEpTT04uc3RyaW5naWZ5KGNhY2hlTWlzc2VzKVxuICAgICAgICAgIH0gJHtcbiAgICAgICAgICAgIEpTT04uc3RyaW5naWZ5KE9iamVjdC5rZXlzKGFyY2hlcykuc29ydCgpKVxuICAgICAgICAgIH1gXG4gICAgICAgICk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICBfY2FjaGVGaWxlbmFtZShjYWNoZUtleSkge1xuICAgIC8vIFdlIHdhbnQgY2FjaGVLZXlzIHRvIGJlIGhleCBzbyB0aGF0IHRoZXkgd29yayBvbiBhbnkgRlMgYW5kIG5ldmVyIGVuZCBpblxuICAgIC8vIC5jYWNoZS5cbiAgICBpZiAoIS9eW2EtZjAtOV0rJC8udGVzdChjYWNoZUtleSkpIHtcbiAgICAgIHRocm93IEVycm9yKCdiYWQgY2FjaGVLZXk6ICcgKyBjYWNoZUtleSk7XG4gICAgfVxuICAgIHJldHVybiBwYXRoLmpvaW4odGhpcy5fZGlza0NhY2hlLCBjYWNoZUtleSArICcuY2FjaGUnKTtcbiAgfVxuICAvLyBMb2FkIGEgY2FjaGUgZW50cnkgZnJvbSBkaXNrLiBSZXR1cm5zIHRoZSBjb21waWxlUmVzdWx0IG9iamVjdFxuICAvLyBhbmQgbG9hZHMgaXQgaW50byB0aGUgaW4tbWVtb3J5IGNhY2hlIHRvby5cbiAgX3JlYWRDYWNoZShjYWNoZUtleSkge1xuICAgIGlmICghIHRoaXMuX2Rpc2tDYWNoZSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGNvbnN0IGNhY2hlRmlsZW5hbWUgPSB0aGlzLl9jYWNoZUZpbGVuYW1lKGNhY2hlS2V5KTtcbiAgICBjb25zdCBjb21waWxlUmVzdWx0ID0gdGhpcy5fcmVhZEFuZFBhcnNlQ29tcGlsZVJlc3VsdE9yTnVsbChjYWNoZUZpbGVuYW1lKTtcbiAgICBpZiAoISBjb21waWxlUmVzdWx0KSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgdGhpcy5fY2FjaGUuc2V0KGNhY2hlS2V5LCBjb21waWxlUmVzdWx0KTtcbiAgICByZXR1cm4gY29tcGlsZVJlc3VsdDtcbiAgfVxuICBfd3JpdGVDYWNoZUFzeW5jKGNhY2hlS2V5LCBjb21waWxlUmVzdWx0KSB7XG4gICAgaWYgKCEgdGhpcy5fZGlza0NhY2hlKVxuICAgICAgcmV0dXJuO1xuICAgIGNvbnN0IGNhY2hlRmlsZW5hbWUgPSB0aGlzLl9jYWNoZUZpbGVuYW1lKGNhY2hlS2V5KTtcbiAgICBjb25zdCBjYWNoZUNvbnRlbnRzID0gdGhpcy5zdHJpbmdpZnlDb21waWxlUmVzdWx0KGNvbXBpbGVSZXN1bHQpO1xuICAgIHRoaXMuX3dyaXRlRmlsZUFzeW5jKGNhY2hlRmlsZW5hbWUsIGNhY2hlQ29udGVudHMpO1xuICB9XG5cbiAgLy8gUmV0dXJucyBudWxsIGlmIHRoZSBmaWxlIGRvZXMgbm90IGV4aXN0IG9yIGNhbid0IGJlIHBhcnNlZDsgb3RoZXJ3aXNlXG4gIC8vIHJldHVybnMgdGhlIHBhcnNlZCBjb21waWxlUmVzdWx0IGluIHRoZSBmaWxlLlxuICBfcmVhZEFuZFBhcnNlQ29tcGlsZVJlc3VsdE9yTnVsbChmaWxlbmFtZSkge1xuICAgIGNvbnN0IHJhdyA9IHRoaXMuX3JlYWRGaWxlT3JOdWxsKGZpbGVuYW1lKTtcbiAgICByZXR1cm4gdGhpcy5wYXJzZUNvbXBpbGVSZXN1bHQocmF3KTtcbiAgfVxufVxuIiwiY29uc3QgcGF0aCA9IFBsdWdpbi5wYXRoO1xuY29uc3QgTFJVID0gTnBtLnJlcXVpcmUoJ2xydS1jYWNoZScpO1xuXG4vLyBNdWx0aUZpbGVDYWNoaW5nQ29tcGlsZXIgaXMgbGlrZSBDYWNoaW5nQ29tcGlsZXIsIGJ1dCBmb3IgaW1wbGVtZW50aW5nXG4vLyBsYW5ndWFnZXMgd2hpY2ggYWxsb3cgZmlsZXMgdG8gcmVmZXJlbmNlIGVhY2ggb3RoZXIsIHN1Y2ggYXMgQ1NTXG4vLyBwcmVwcm9jZXNzb3JzIHdpdGggYEBpbXBvcnRgIGRpcmVjdGl2ZXMuXG4vL1xuLy8gTGlrZSBDYWNoaW5nQ29tcGlsZXIsIHlvdSBzaG91bGQgc3ViY2xhc3MgTXVsdGlGaWxlQ2FjaGluZ0NvbXBpbGVyIGFuZCBkZWZpbmVcbi8vIHRoZSBmb2xsb3dpbmcgbWV0aG9kczogZ2V0Q2FjaGVLZXksIGNvbXBpbGVPbmVGaWxlLCBhZGRDb21waWxlUmVzdWx0LCBhbmRcbi8vIGNvbXBpbGVSZXN1bHRTaXplLiAgY29tcGlsZU9uZUZpbGUgZ2V0cyBhbiBhZGRpdGlvbmFsIGFsbEZpbGVzIGFyZ3VtZW50IGFuZFxuLy8gcmV0dXJucyBhbiBhcnJheSBvZiByZWZlcmVuY2VkIGltcG9ydCBwYXRocyBpbiBhZGRpdGlvbiB0byB0aGUgQ29tcGlsZVJlc3VsdC5cbi8vIFlvdSBtYXkgYWxzbyBvdmVycmlkZSBpc1Jvb3QgYW5kIGdldEFic29sdXRlSW1wb3J0UGF0aCB0byBjdXN0b21pemVcbi8vIE11bHRpRmlsZUNhY2hpbmdDb21waWxlciBmdXJ0aGVyLlxuTXVsdGlGaWxlQ2FjaGluZ0NvbXBpbGVyID0gY2xhc3MgTXVsdGlGaWxlQ2FjaGluZ0NvbXBpbGVyXG5leHRlbmRzIENhY2hpbmdDb21waWxlckJhc2Uge1xuICBjb25zdHJ1Y3Rvcih7XG4gICAgY29tcGlsZXJOYW1lLFxuICAgIGRlZmF1bHRDYWNoZVNpemUsXG4gICAgbWF4UGFyYWxsZWxpc21cbiAgfSkge1xuICAgIHN1cGVyKHtjb21waWxlck5hbWUsIGRlZmF1bHRDYWNoZVNpemUsIG1heFBhcmFsbGVsaXNtfSk7XG5cbiAgICAvLyBNYXBzIGZyb20gY2FjaGUga2V5IHRvIHsgY29tcGlsZVJlc3VsdCwgY2FjaGVLZXlzIH0sIHdoZXJlXG4gICAgLy8gY2FjaGVLZXlzIGlzIGFuIG9iamVjdCBtYXBwaW5nIGZyb20gYWJzb2x1dGUgaW1wb3J0IHBhdGggdG8gaGFzaGVkXG4gICAgLy8gY2FjaGVLZXkgZm9yIGVhY2ggZmlsZSByZWZlcmVuY2VkIGJ5IHRoaXMgZmlsZSAoaW5jbHVkaW5nIGl0c2VsZikuXG4gICAgdGhpcy5fY2FjaGUgPSBuZXcgTFJVKHtcbiAgICAgIG1heDogdGhpcy5fY2FjaGVTaXplLFxuICAgICAgLy8gV2UgaWdub3JlIHRoZSBzaXplIG9mIGNhY2hlS2V5cyBoZXJlLlxuICAgICAgbGVuZ3RoOiAodmFsdWUpID0+IHRoaXMuY29tcGlsZVJlc3VsdFNpemUodmFsdWUuY29tcGlsZVJlc3VsdCksXG4gICAgfSk7XG4gIH1cblxuICAvLyBZb3VyIHN1YmNsYXNzIG11c3Qgb3ZlcnJpZGUgdGhpcyBtZXRob2QgdG8gZGVmaW5lIHRoZSB0cmFuc2Zvcm1hdGlvbiBmcm9tXG4gIC8vIElucHV0RmlsZSB0byBpdHMgY2FjaGVhYmxlIENvbXBpbGVSZXN1bHQpLlxuICAvL1xuICAvLyBBcmd1bWVudHM6XG4gIC8vICAgLSBpbnB1dEZpbGUgaXMgdGhlIElucHV0RmlsZSB0byBwcm9jZXNzXG4gIC8vICAgLSBhbGxGaWxlcyBpcyBhIGEgTWFwIG1hcHBpbmcgZnJvbSBhYnNvbHV0ZSBpbXBvcnQgcGF0aCB0byBJbnB1dEZpbGUgb2ZcbiAgLy8gICAgIGFsbCBmaWxlcyBiZWluZyBwcm9jZXNzZWQgaW4gdGhlIHRhcmdldFxuICAvLyBSZXR1cm5zIGFuIG9iamVjdCB3aXRoIGtleXM6XG4gIC8vICAgLSBjb21waWxlUmVzdWx0OiB0aGUgQ29tcGlsZVJlc3VsdCAodGhlIGNhY2hlYWJsZSBkYXRhIHR5cGUgc3BlY2lmaWMgdG9cbiAgLy8gICAgIHlvdXIgc3ViY2xhc3MpLlxuICAvLyAgIC0gcmVmZXJlbmNlZEltcG9ydFBhdGhzOiBhbiBhcnJheSBvZiBhYnNvbHV0ZSBpbXBvcnQgcGF0aHMgb2YgZmlsZXNcbiAgLy8gICAgIHdoaWNoIHdlcmUgcmVmZXJlcmVuY2VkIGJ5IHRoZSBjdXJyZW50IGZpbGUuICBUaGUgY3VycmVudCBmaWxlXG4gIC8vICAgICBpcyBpbmNsdWRlZCBpbXBsaWNpdGx5LlxuICAvL1xuICAvLyBUaGlzIG1ldGhvZCBpcyBub3QgY2FsbGVkIG9uIGZpbGVzIHdoZW4gYSB2YWxpZCBjYWNoZSBlbnRyeSBleGlzdHMgaW5cbiAgLy8gbWVtb3J5IG9yIG9uIGRpc2suXG4gIC8vXG4gIC8vIE9uIGEgY29tcGlsZSBlcnJvciwgeW91IHNob3VsZCBjYWxsIGBpbnB1dEZpbGUuZXJyb3JgIGFwcHJvcHJpYXRlbHkgYW5kXG4gIC8vIHJldHVybiBudWxsOyB0aGlzIHdpbGwgbm90IGJlIGNhY2hlZC5cbiAgLy9cbiAgLy8gVGhpcyBtZXRob2Qgc2hvdWxkIG5vdCBjYWxsIGBpbnB1dEZpbGUuYWRkSmF2YVNjcmlwdGAgYW5kIHNpbWlsYXIgZmlsZXMhXG4gIC8vIFRoYXQncyB3aGF0IGFkZENvbXBpbGVSZXN1bHQgaXMgZm9yLlxuICBjb21waWxlT25lRmlsZShpbnB1dEZpbGUsIGFsbEZpbGVzKSB7XG4gICAgdGhyb3cgRXJyb3IoXG4gICAgICAnTXVsdGlGaWxlQ2FjaGluZ0NvbXBpbGVyIHN1YmNsYXNzIHNob3VsZCBpbXBsZW1lbnQgY29tcGlsZU9uZUZpbGUhJyk7XG4gIH1cblxuICAvLyBZb3VyIHN1YmNsYXNzIG1heSBvdmVycmlkZSB0aGlzIHRvIGRlY2xhcmUgdGhhdCBhIGZpbGUgaXMgbm90IGEgXCJyb290XCIgLS0tXG4gIC8vIGllLCBpdCBjYW4gYmUgaW5jbHVkZWQgZnJvbSBvdGhlciBmaWxlcyBidXQgaXMgbm90IHByb2Nlc3NlZCBvbiBpdHMgb3duLiBJblxuICAvLyB0aGlzIGNhc2UsIE11bHRpRmlsZUNhY2hpbmdDb21waWxlciB3b24ndCB3YXN0ZSB0aW1lIHRyeWluZyB0byBsb29rIGZvciBhXG4gIC8vIGNhY2hlIGZvciBpdHMgY29tcGlsYXRpb24gb24gZGlzay5cbiAgaXNSb290KGlucHV0RmlsZSkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLy8gUmV0dXJucyB0aGUgYWJzb2x1dGUgaW1wb3J0IHBhdGggZm9yIGFuIElucHV0RmlsZS4gQnkgZGVmYXVsdCwgdGhpcyBpcyBhXG4gIC8vIHBhdGggaXMgYSBwYXRoIG9mIHRoZSBmb3JtIFwie3BhY2thZ2V9L3BhdGgvdG8vZmlsZVwiIGZvciBmaWxlcyBpbiBwYWNrYWdlc1xuICAvLyBhbmQgXCJ7fS9wYXRoL3RvL2ZpbGVcIiBmb3IgZmlsZXMgaW4gYXBwcy4gWW91ciBzdWJjbGFzcyBtYXkgb3ZlcnJpZGUgYW5kL29yXG4gIC8vIGNhbGwgdGhpcyBtZXRob2QuXG4gIGdldEFic29sdXRlSW1wb3J0UGF0aChpbnB1dEZpbGUpIHtcbiAgICBpZiAoaW5wdXRGaWxlLmdldFBhY2thZ2VOYW1lKCkgPT09IG51bGwpIHtcbiAgICAgIHJldHVybiAne30vJyArIGlucHV0RmlsZS5nZXRQYXRoSW5QYWNrYWdlKCk7XG4gICAgfVxuICAgIHJldHVybiAneycgKyBpbnB1dEZpbGUuZ2V0UGFja2FnZU5hbWUoKSArICd9LydcbiAgICAgICsgaW5wdXRGaWxlLmdldFBhdGhJblBhY2thZ2UoKTtcbiAgfVxuXG4gIC8vIFRoZSBwcm9jZXNzRmlsZXNGb3JUYXJnZXQgbWV0aG9kIGZyb20gdGhlIFBsdWdpbi5yZWdpc3RlckNvbXBpbGVyIEFQSS5cbiAgYXN5bmMgcHJvY2Vzc0ZpbGVzRm9yVGFyZ2V0KGlucHV0RmlsZXMpIHtcbiAgICBjb25zdCBhbGxGaWxlcyA9IG5ldyBNYXA7XG4gICAgY29uc3QgY2FjaGVLZXlNYXAgPSBuZXcgTWFwO1xuICAgIGNvbnN0IGNhY2hlTWlzc2VzID0gW107XG4gICAgY29uc3QgYXJjaGVzID0gdGhpcy5fY2FjaGVEZWJ1Z0VuYWJsZWQgJiYgT2JqZWN0LmNyZWF0ZShudWxsKTtcblxuICAgIGlucHV0RmlsZXMuZm9yRWFjaCgoaW5wdXRGaWxlKSA9PiB7XG4gICAgICBjb25zdCBpbXBvcnRQYXRoID0gdGhpcy5nZXRBYnNvbHV0ZUltcG9ydFBhdGgoaW5wdXRGaWxlKTtcbiAgICAgIGFsbEZpbGVzLnNldChpbXBvcnRQYXRoLCBpbnB1dEZpbGUpO1xuICAgICAgY2FjaGVLZXlNYXAuc2V0KGltcG9ydFBhdGgsIHRoaXMuX2dldENhY2hlS2V5V2l0aFBhdGgoaW5wdXRGaWxlKSk7XG4gICAgfSk7XG5cbiAgICBpbnB1dEZpbGVzLmZvckVhY2goaW5wdXRGaWxlID0+IHtcbiAgICAgIGlmIChhcmNoZXMpIHtcbiAgICAgICAgYXJjaGVzW2lucHV0RmlsZS5nZXRBcmNoKCldID0gMTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgZ2V0UmVzdWx0ID0gKCkgPT4ge1xuICAgICAgICBjb25zdCBhYnNvbHV0ZUltcG9ydFBhdGggPSB0aGlzLmdldEFic29sdXRlSW1wb3J0UGF0aChpbnB1dEZpbGUpO1xuICAgICAgICBjb25zdCBjYWNoZUtleSA9IGNhY2hlS2V5TWFwLmdldChhYnNvbHV0ZUltcG9ydFBhdGgpO1xuICAgICAgICBsZXQgY2FjaGVFbnRyeSA9IHRoaXMuX2NhY2hlLmdldChjYWNoZUtleSk7XG4gICAgICAgIGlmICghIGNhY2hlRW50cnkpIHtcbiAgICAgICAgICBjYWNoZUVudHJ5ID0gdGhpcy5fcmVhZENhY2hlKGNhY2hlS2V5KTtcbiAgICAgICAgICBpZiAoY2FjaGVFbnRyeSkge1xuICAgICAgICAgICAgdGhpcy5fY2FjaGVEZWJ1ZyhgTG9hZGVkICR7IGFic29sdXRlSW1wb3J0UGF0aCB9YCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCEgKGNhY2hlRW50cnkgJiYgdGhpcy5fY2FjaGVFbnRyeVZhbGlkKGNhY2hlRW50cnksIGNhY2hlS2V5TWFwKSkpIHtcbiAgICAgICAgICBjYWNoZU1pc3Nlcy5wdXNoKGlucHV0RmlsZS5nZXREaXNwbGF5UGF0aCgpKTtcblxuICAgICAgICAgIGNvbnN0IGNvbXBpbGVPbmVGaWxlUmV0dXJuID1cbiAgICAgICAgICAgIFByb21pc2UuYXdhaXQodGhpcy5jb21waWxlT25lRmlsZShpbnB1dEZpbGUsIGFsbEZpbGVzKSk7XG5cbiAgICAgICAgICBpZiAoISBjb21waWxlT25lRmlsZVJldHVybikge1xuICAgICAgICAgICAgLy8gY29tcGlsZU9uZUZpbGUgc2hvdWxkIGhhdmUgY2FsbGVkIGlucHV0RmlsZS5lcnJvci5cbiAgICAgICAgICAgIC8vIFdlIGRvbid0IGNhY2hlIGZhaWx1cmVzIGZvciBub3cuXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3Qge1xuICAgICAgICAgICAgY29tcGlsZVJlc3VsdCxcbiAgICAgICAgICAgIHJlZmVyZW5jZWRJbXBvcnRQYXRocyxcbiAgICAgICAgICB9ID0gY29tcGlsZU9uZUZpbGVSZXR1cm47XG5cbiAgICAgICAgICBjYWNoZUVudHJ5ID0ge1xuICAgICAgICAgICAgY29tcGlsZVJlc3VsdCxcbiAgICAgICAgICAgIGNhY2hlS2V5czoge1xuICAgICAgICAgICAgICAvLyBJbmNsdWRlIHRoZSBoYXNoZWQgY2FjaGUga2V5IG9mIHRoZSBmaWxlIGl0c2VsZi4uLlxuICAgICAgICAgICAgICBbYWJzb2x1dGVJbXBvcnRQYXRoXTogY2FjaGVLZXlNYXAuZ2V0KGFic29sdXRlSW1wb3J0UGF0aClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9O1xuXG4gICAgICAgICAgLy8gLi4uIGFuZCBvZiB0aGUgb3RoZXIgcmVmZXJlbmNlZCBmaWxlcy5cbiAgICAgICAgICByZWZlcmVuY2VkSW1wb3J0UGF0aHMuZm9yRWFjaCgocGF0aCkgPT4ge1xuICAgICAgICAgICAgaWYgKCFjYWNoZUtleU1hcC5oYXMocGF0aCkpIHtcbiAgICAgICAgICAgICAgdGhyb3cgRXJyb3IoYFVua25vd24gYWJzb2x1dGUgaW1wb3J0IHBhdGggJHsgcGF0aCB9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYWNoZUVudHJ5LmNhY2hlS2V5c1twYXRoXSA9IGNhY2hlS2V5TWFwLmdldChwYXRoKTtcbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIC8vIFNhdmUgdGhlIGNhY2hlIGVudHJ5LlxuICAgICAgICAgIHRoaXMuX2NhY2hlLnNldChjYWNoZUtleSwgY2FjaGVFbnRyeSk7XG4gICAgICAgICAgdGhpcy5fd3JpdGVDYWNoZUFzeW5jKGNhY2hlS2V5LCBjYWNoZUVudHJ5KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBjYWNoZUVudHJ5LmNvbXBpbGVSZXN1bHQ7XG4gICAgICB9O1xuXG4gICAgICBpZiAodGhpcy5jb21waWxlT25lRmlsZUxhdGVyICYmXG4gICAgICAgICAgaW5wdXRGaWxlLnN1cHBvcnRzTGF6eUNvbXBpbGF0aW9uKSB7XG4gICAgICAgIGlmICghIHRoaXMuaXNSb290KGlucHV0RmlsZSkpIHtcbiAgICAgICAgICAvLyBJZiB0aGlzIGlucHV0RmlsZSBpcyBkZWZpbml0ZWx5IG5vdCBhIHJvb3QsIHRoZW4gaXQgbXVzdCBiZVxuICAgICAgICAgIC8vIGxhenksIGFuZCB0aGlzIGlzIG91ciBsYXN0IGNoYW5jZSB0byBtYXJrIGl0IGFzIHN1Y2gsIHNvIHRoYXRcbiAgICAgICAgICAvLyB0aGUgcmVzdCBvZiB0aGUgY29tcGlsZXIgcGx1Z2luIHN5c3RlbSBjYW4gYXZvaWQgd29ycnlpbmdcbiAgICAgICAgICAvLyBhYm91dCB0aGUgTXVsdGlGaWxlQ2FjaGluZ0NvbXBpbGVyLXNwZWNpZmljIGNvbmNlcHQgb2YgYVxuICAgICAgICAgIC8vIFwicm9vdC5cIiBJZiB0aGlzLmlzUm9vdChpbnB1dEZpbGUpIHJldHVybnMgdHJ1ZSBpbnN0ZWFkLCB0aGF0XG4gICAgICAgICAgLy8gY2xhc3NpZmljYXRpb24gbWF5IG5vdCBiZSB0cnVzdHdvcnRoeSwgc2luY2UgcmV0dXJuaW5nIHRydWVcbiAgICAgICAgICAvLyB1c2VkIHRvIGJlIHRoZSBvbmx5IHdheSB0byBnZXQgdGhlIGZpbGUgdG8gYmUgY29tcGlsZWQsIHNvXG4gICAgICAgICAgLy8gdGhhdCBpdCBjb3VsZCBiZSBpbXBvcnRlZCBsYXRlciBieSBhIEpTIG1vZHVsZS4gTm93IHRoYXRcbiAgICAgICAgICAvLyBmaWxlcyBjYW4gYmUgY29tcGlsZWQgb24tZGVtYW5kLCBpdCdzIHNhZmUgdG8gcGFzcyBhbGwgZmlsZXNcbiAgICAgICAgICAvLyB0aGF0IG1pZ2h0IGJlIHJvb3RzIHRvIHRoaXMuY29tcGlsZU9uZUZpbGVMYXRlci5cbiAgICAgICAgICBpbnB1dEZpbGUuZ2V0RmlsZU9wdGlvbnMoKS5sYXp5ID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmNvbXBpbGVPbmVGaWxlTGF0ZXIoaW5wdXRGaWxlLCBnZXRSZXN1bHQpO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLmlzUm9vdChpbnB1dEZpbGUpKSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGdldFJlc3VsdCgpO1xuICAgICAgICBpZiAocmVzdWx0KSB7XG4gICAgICAgICAgdGhpcy5hZGRDb21waWxlUmVzdWx0KGlucHV0RmlsZSwgcmVzdWx0KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgaWYgKHRoaXMuX2NhY2hlRGVidWdFbmFibGVkKSB7XG4gICAgICB0aGlzLl9hZnRlckxpbmtDYWxsYmFja3MucHVzaCgoKSA9PiB7XG4gICAgICAgIGNhY2hlTWlzc2VzLnNvcnQoKTtcblxuICAgICAgICB0aGlzLl9jYWNoZURlYnVnKFxuICAgICAgICAgIGBSYW4gKCMke1xuICAgICAgICAgICAgKyt0aGlzLl9jYWxsQ291bnRcbiAgICAgICAgICB9KSBvbjogJHtcbiAgICAgICAgICAgIEpTT04uc3RyaW5naWZ5KGNhY2hlTWlzc2VzKVxuICAgICAgICAgIH0gJHtcbiAgICAgICAgICAgIEpTT04uc3RyaW5naWZ5KE9iamVjdC5rZXlzKGFyY2hlcykuc29ydCgpKVxuICAgICAgICAgIH1gXG4gICAgICAgICk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICAvLyBSZXR1cm5zIGEgaGFzaCB0aGF0IGluY29ycG9yYXRlcyBib3RoIHRoaXMuZ2V0Q2FjaGVLZXkoaW5wdXRGaWxlKSBhbmRcbiAgLy8gdGhpcy5nZXRBYnNvbHV0ZUltcG9ydFBhdGgoaW5wdXRGaWxlKSwgc2luY2UgdGhlIGZpbGUgcGF0aCBtaWdodCBiZVxuICAvLyByZWxldmFudCB0byB0aGUgY29tcGlsZWQgb3V0cHV0IHdoZW4gdXNpbmcgTXVsdGlGaWxlQ2FjaGluZ0NvbXBpbGVyLlxuICBfZ2V0Q2FjaGVLZXlXaXRoUGF0aChpbnB1dEZpbGUpIHtcbiAgICByZXR1cm4gdGhpcy5fZGVlcEhhc2goW1xuICAgICAgdGhpcy5nZXRBYnNvbHV0ZUltcG9ydFBhdGgoaW5wdXRGaWxlKSxcbiAgICAgIHRoaXMuZ2V0Q2FjaGVLZXkoaW5wdXRGaWxlKSxcbiAgICBdKTtcbiAgfVxuXG4gIF9jYWNoZUVudHJ5VmFsaWQoY2FjaGVFbnRyeSwgY2FjaGVLZXlNYXApIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXMoY2FjaGVFbnRyeS5jYWNoZUtleXMpLmV2ZXJ5KFxuICAgICAgKHBhdGgpID0+IGNhY2hlRW50cnkuY2FjaGVLZXlzW3BhdGhdID09PSBjYWNoZUtleU1hcC5nZXQocGF0aClcbiAgICApO1xuICB9XG5cbiAgLy8gVGhlIGZvcm1hdCBvZiBhIGNhY2hlIGZpbGUgb24gZGlzayBpcyB0aGUgSlNPTi1zdHJpbmdpZmllZCBjYWNoZUtleXNcbiAgLy8gb2JqZWN0LCBhIG5ld2xpbmUsIGZvbGxvd2VkIGJ5IHRoZSBDb21waWxlUmVzdWx0IGFzIHJldHVybmVkIGZyb21cbiAgLy8gdGhpcy5zdHJpbmdpZnlDb21waWxlUmVzdWx0LlxuICBfY2FjaGVGaWxlbmFtZShjYWNoZUtleSkge1xuICAgIHJldHVybiBwYXRoLmpvaW4odGhpcy5fZGlza0NhY2hlLCBjYWNoZUtleSArIFwiLmNhY2hlXCIpO1xuICB9XG5cbiAgLy8gTG9hZHMgYSB7Y29tcGlsZVJlc3VsdCwgY2FjaGVLZXlzfSBjYWNoZSBlbnRyeSBmcm9tIGRpc2suIFJldHVybnMgdGhlIHdob2xlXG4gIC8vIGNhY2hlIGVudHJ5IGFuZCBsb2FkcyBpdCBpbnRvIHRoZSBpbi1tZW1vcnkgY2FjaGUgdG9vLlxuICBfcmVhZENhY2hlKGNhY2hlS2V5KSB7XG4gICAgaWYgKCEgdGhpcy5fZGlza0NhY2hlKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgY29uc3QgY2FjaGVGaWxlbmFtZSA9IHRoaXMuX2NhY2hlRmlsZW5hbWUoY2FjaGVLZXkpO1xuICAgIGNvbnN0IHJhdyA9IHRoaXMuX3JlYWRGaWxlT3JOdWxsKGNhY2hlRmlsZW5hbWUpO1xuICAgIGlmICghcmF3KSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvLyBTcGxpdCBvbiBuZXdsaW5lLlxuICAgIGNvbnN0IG5ld2xpbmVJbmRleCA9IHJhdy5pbmRleE9mKCdcXG4nKTtcbiAgICBpZiAobmV3bGluZUluZGV4ID09PSAtMSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGNvbnN0IGNhY2hlS2V5c1N0cmluZyA9IHJhdy5zdWJzdHJpbmcoMCwgbmV3bGluZUluZGV4KTtcbiAgICBjb25zdCBjb21waWxlUmVzdWx0U3RyaW5nID0gcmF3LnN1YnN0cmluZyhuZXdsaW5lSW5kZXggKyAxKTtcblxuICAgIGNvbnN0IGNhY2hlS2V5cyA9IHRoaXMuX3BhcnNlSlNPTk9yTnVsbChjYWNoZUtleXNTdHJpbmcpO1xuICAgIGlmICghY2FjaGVLZXlzKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgY29uc3QgY29tcGlsZVJlc3VsdCA9IHRoaXMucGFyc2VDb21waWxlUmVzdWx0KGNvbXBpbGVSZXN1bHRTdHJpbmcpO1xuICAgIGlmICghIGNvbXBpbGVSZXN1bHQpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IGNhY2hlRW50cnkgPSB7Y29tcGlsZVJlc3VsdCwgY2FjaGVLZXlzfTtcbiAgICB0aGlzLl9jYWNoZS5zZXQoY2FjaGVLZXksIGNhY2hlRW50cnkpO1xuICAgIHJldHVybiBjYWNoZUVudHJ5O1xuICB9XG5cbiAgX3dyaXRlQ2FjaGVBc3luYyhjYWNoZUtleSwgY2FjaGVFbnRyeSkge1xuICAgIGlmICghIHRoaXMuX2Rpc2tDYWNoZSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGNvbnN0IGNhY2hlRmlsZW5hbWUgPSB0aGlzLl9jYWNoZUZpbGVuYW1lKGNhY2hlS2V5KTtcbiAgICBjb25zdCBjYWNoZUNvbnRlbnRzID1cbiAgICAgIEpTT04uc3RyaW5naWZ5KGNhY2hlRW50cnkuY2FjaGVLZXlzKSArICdcXG4nICtcbiAgICAgIHRoaXMuc3RyaW5naWZ5Q29tcGlsZVJlc3VsdChjYWNoZUVudHJ5LmNvbXBpbGVSZXN1bHQpO1xuICAgIHRoaXMuX3dyaXRlRmlsZUFzeW5jKGNhY2hlRmlsZW5hbWUsIGNhY2hlQ29udGVudHMpO1xuICB9XG59XG4iXX0=
