(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var ECMAScript = Package.ecmascript.ECMAScript;
var Random = Package.random.Random;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var CachingCompilerBase, CachingCompiler, MultiFileCachingCompiler;

var require = meteorInstall({"node_modules":{"meteor":{"caching-compiler":{"caching-compiler.js":function module(require){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                  //
// packages/caching-compiler/caching-compiler.js                                                                    //
//                                                                                                                  //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                    //
const fs = Plugin.fs;
const path = Plugin.path;

const createHash = Npm.require('crypto').createHash;

const assert = Npm.require('assert');

const LRU = Npm.require('lru-cache'); // Base class for CachingCompiler and MultiFileCachingCompiler.


CachingCompilerBase = class CachingCompilerBase {
  constructor(_ref) {
    let {
      compilerName,
      defaultCacheSize,
      maxParallelism = 20
    } = _ref;
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
    console.log("CACHE(".concat(this._compilerName, "): ").concat(message));
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
  } // Write the file atomically.


  _writeFile(filename, contents) {
    const tempFilename = filename + '.tmp.' + Random.id();

    try {
      fs.writeFileSync(tempFilename, contents);
      fs.renameSync(tempFilename, filename);
    } catch (e) {
      // ignore errors, it's just a cache
      this._cacheDebug(e);
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
  constructor(_ref2) {
    let {
      compilerName,
      defaultCacheSize,
      maxParallelism = 20
    } = _ref2;
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
              this._cacheDebug("Loaded ".concat(inputFile.getDisplayPath()));
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

          this._cacheDebug("Ran (#".concat(++this._callCount, ") on: ").concat(JSON.stringify(cacheMisses), " ").concat(JSON.stringify(Object.keys(arches).sort())));
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

    this._writeFile(cacheFilename, cacheContents);
  } // Returns null if the file does not exist or can't be parsed; otherwise
  // returns the parsed compileResult in the file.


  _readAndParseCompileResultOrNull(filename) {
    const raw = this._readFileOrNull(filename);

    return this.parseCompileResult(raw);
  }

};
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"multi-file-caching-compiler.js":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                  //
// packages/caching-compiler/multi-file-caching-compiler.js                                                         //
//                                                                                                                  //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                    //
!function (module1) {
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
    constructor(_ref) {
      let {
        compilerName,
        defaultCacheSize,
        maxParallelism
      } = _ref;
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
                this._cacheDebug("Loaded ".concat(absoluteImportPath));
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
                  throw Error("Unknown absolute import path ".concat(path));
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

            this._cacheDebug("Ran (#".concat(++this._callCount, ") on: ").concat(JSON.stringify(cacheMisses), " ").concat(JSON.stringify(Object.keys(arches).sort())));
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

      this._writeFile(cacheFilename, cacheContents);
    }

  };
}.call(this, module);
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvY2FjaGluZy1jb21waWxlci9jYWNoaW5nLWNvbXBpbGVyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9jYWNoaW5nLWNvbXBpbGVyL211bHRpLWZpbGUtY2FjaGluZy1jb21waWxlci5qcyJdLCJuYW1lcyI6WyJmcyIsIlBsdWdpbiIsInBhdGgiLCJjcmVhdGVIYXNoIiwiTnBtIiwicmVxdWlyZSIsImFzc2VydCIsIkxSVSIsIkNhY2hpbmdDb21waWxlckJhc2UiLCJjb25zdHJ1Y3RvciIsImNvbXBpbGVyTmFtZSIsImRlZmF1bHRDYWNoZVNpemUiLCJtYXhQYXJhbGxlbGlzbSIsIl9jb21waWxlck5hbWUiLCJfbWF4UGFyYWxsZWxpc20iLCJjb21waWxlck5hbWVGb3JFbnZhciIsInRvVXBwZXJDYXNlIiwicmVwbGFjZSIsImVudlZhclByZWZpeCIsImRlYnVnRW52VmFyIiwiX2NhY2hlRGVidWdFbmFibGVkIiwicHJvY2VzcyIsImVudiIsImNhY2hlU2l6ZUVudlZhciIsIl9jYWNoZVNpemUiLCJfZGlza0NhY2hlIiwiX2NhbGxDb3VudCIsIl9hZnRlckxpbmtDYWxsYmFja3MiLCJnZXRDYWNoZUtleSIsImlucHV0RmlsZSIsIkVycm9yIiwiYWRkQ29tcGlsZVJlc3VsdCIsImNvbXBpbGVSZXN1bHQiLCJjb21waWxlUmVzdWx0U2l6ZSIsInN0cmluZ2lmeUNvbXBpbGVSZXN1bHQiLCJKU09OIiwic3RyaW5naWZ5IiwicGFyc2VDb21waWxlUmVzdWx0Iiwic3RyaW5naWZpZWRDb21waWxlUmVzdWx0IiwiX3BhcnNlSlNPTk9yTnVsbCIsImpzb24iLCJwYXJzZSIsImUiLCJTeW50YXhFcnJvciIsIl9jYWNoZURlYnVnIiwibWVzc2FnZSIsImNvbnNvbGUiLCJsb2ciLCJzZXREaXNrQ2FjaGVEaXJlY3RvcnkiLCJkaXNrQ2FjaGUiLCJzb3VyY2VNYXBTaXplIiwic20iLCJtYXBwaW5ncyIsImxlbmd0aCIsInNvdXJjZXNDb250ZW50IiwicmVkdWNlIiwic29GYXIiLCJjdXJyZW50IiwiYWZ0ZXJMaW5rIiwic3BsaWNlIiwiZm9yRWFjaCIsImNhbGxiYWNrIiwiX2RlZXBIYXNoIiwidmFsIiwiaGFzaCIsInR5cGUiLCJ1cGRhdGUiLCJrZXlzIiwiT2JqZWN0IiwiQXJyYXkiLCJpc0FycmF5Iiwic29ydCIsImtleSIsIm9rIiwiZGlnZXN0IiwiX3dyaXRlRmlsZSIsImZpbGVuYW1lIiwiY29udGVudHMiLCJ0ZW1wRmlsZW5hbWUiLCJSYW5kb20iLCJpZCIsIndyaXRlRmlsZVN5bmMiLCJyZW5hbWVTeW5jIiwiX3JlYWRGaWxlT3JOdWxsIiwicmVhZEZpbGVTeW5jIiwiY29kZSIsIkNhY2hpbmdDb21waWxlciIsIl9jYWNoZSIsIm1heCIsInZhbHVlIiwiY29tcGlsZU9uZUZpbGUiLCJwcm9jZXNzRmlsZXNGb3JUYXJnZXQiLCJpbnB1dEZpbGVzIiwiY2FjaGVNaXNzZXMiLCJhcmNoZXMiLCJjcmVhdGUiLCJnZXRBcmNoIiwiZ2V0UmVzdWx0IiwiY2FjaGVLZXkiLCJnZXQiLCJfcmVhZENhY2hlIiwiZ2V0RGlzcGxheVBhdGgiLCJwdXNoIiwiUHJvbWlzZSIsImF3YWl0Iiwic2V0IiwiX3dyaXRlQ2FjaGVBc3luYyIsImNvbXBpbGVPbmVGaWxlTGF0ZXIiLCJzdXBwb3J0c0xhenlDb21waWxhdGlvbiIsInJlc3VsdCIsIl9jYWNoZUZpbGVuYW1lIiwidGVzdCIsImpvaW4iLCJjYWNoZUZpbGVuYW1lIiwiX3JlYWRBbmRQYXJzZUNvbXBpbGVSZXN1bHRPck51bGwiLCJjYWNoZUNvbnRlbnRzIiwicmF3IiwiTXVsdGlGaWxlQ2FjaGluZ0NvbXBpbGVyIiwiYWxsRmlsZXMiLCJpc1Jvb3QiLCJnZXRBYnNvbHV0ZUltcG9ydFBhdGgiLCJnZXRQYWNrYWdlTmFtZSIsImdldFBhdGhJblBhY2thZ2UiLCJNYXAiLCJjYWNoZUtleU1hcCIsImltcG9ydFBhdGgiLCJfZ2V0Q2FjaGVLZXlXaXRoUGF0aCIsImFic29sdXRlSW1wb3J0UGF0aCIsImNhY2hlRW50cnkiLCJfY2FjaGVFbnRyeVZhbGlkIiwiY29tcGlsZU9uZUZpbGVSZXR1cm4iLCJyZWZlcmVuY2VkSW1wb3J0UGF0aHMiLCJjYWNoZUtleXMiLCJoYXMiLCJnZXRGaWxlT3B0aW9ucyIsImxhenkiLCJldmVyeSIsIm5ld2xpbmVJbmRleCIsImluZGV4T2YiLCJjYWNoZUtleXNTdHJpbmciLCJzdWJzdHJpbmciLCJjb21waWxlUmVzdWx0U3RyaW5nIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsTUFBTUEsRUFBRSxHQUFHQyxNQUFNLENBQUNELEVBQWxCO0FBQ0EsTUFBTUUsSUFBSSxHQUFHRCxNQUFNLENBQUNDLElBQXBCOztBQUNBLE1BQU1DLFVBQVUsR0FBR0MsR0FBRyxDQUFDQyxPQUFKLENBQVksUUFBWixFQUFzQkYsVUFBekM7O0FBQ0EsTUFBTUcsTUFBTSxHQUFHRixHQUFHLENBQUNDLE9BQUosQ0FBWSxRQUFaLENBQWY7O0FBQ0EsTUFBTUUsR0FBRyxHQUFHSCxHQUFHLENBQUNDLE9BQUosQ0FBWSxXQUFaLENBQVosQyxDQUVBOzs7QUFDQUcsbUJBQW1CLEdBQUcsTUFBTUEsbUJBQU4sQ0FBMEI7QUFDOUNDLGFBQVcsT0FJUjtBQUFBLFFBSlM7QUFDVkMsa0JBRFU7QUFFVkMsc0JBRlU7QUFHVkMsb0JBQWMsR0FBRztBQUhQLEtBSVQ7QUFDRCxTQUFLQyxhQUFMLEdBQXFCSCxZQUFyQjtBQUNBLFNBQUtJLGVBQUwsR0FBdUJGLGNBQXZCO0FBQ0EsVUFBTUcsb0JBQW9CLEdBQUdMLFlBQVksQ0FBQ00sV0FBYixHQUMxQkMsT0FEMEIsQ0FDbEIsTUFEa0IsRUFDVixHQURVLEVBQ0xBLE9BREssQ0FDRyxhQURILEVBQ2tCLEVBRGxCLENBQTdCO0FBRUEsVUFBTUMsWUFBWSxHQUFHLFlBQVlILG9CQUFaLEdBQW1DLFNBQXhEO0FBRUEsVUFBTUksV0FBVyxHQUFHRCxZQUFZLEdBQUcsT0FBbkM7QUFDQSxTQUFLRSxrQkFBTCxH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QUFDRDs7QUFsUHlCLEdBRDVCIiwiZmlsZSI6Ii9wYWNrYWdlcy9jYWNoaW5nLWNvbXBpbGVyLmpzIiwic291cmNlc0NvbnRlbnQiOlsiY29uc3QgZnMgPSBQbHVnaW4uZnM7XG5jb25zdCBwYXRoID0gUGx1Z2luLnBhdGg7XG5jb25zdCBjcmVhdGVIYXNoID0gTnBtLnJlcXVpcmUoJ2NyeXB0bycpLmNyZWF0ZUhhc2g7XG5jb25zdCBhc3NlcnQgPSBOcG0ucmVxdWlyZSgnYXNzZXJ0Jyk7XG5jb25zdCBMUlUgPSBOcG0ucmVxdWlyZSgnbHJ1LWNhY2hlJyk7XG5cbi8vIEJhc2UgY2xhc3MgZm9yIENhY2hpbmdDb21waWxlciBhbmQgTXVsdGlGaWxlQ2FjaGluZ0NvbXBpbGVyLlxuQ2FjaGluZ0NvbXBpbGVyQmFzZSA9IGNsYXNzIENhY2hpbmdDb21waWxlckJhc2Uge1xuICBjb25zdHJ1Y3Rvcih7XG4gICAgY29tcGlsZXJOYW1lLFxuICAgIGRlZmF1bHRDYWNoZVNpemUsXG4gICAgbWF4UGFyYWxsZWxpc20gPSAyMCxcbiAgfSkge1xuICAgIHRoaXMuX2NvbXBpbGVyTmFtZSA9IGNvbXBpbGVyTmFtZTtcbiAgICB0aGlzLl9tYXhQYXJhbGxlbGlzbSA9IG1heFBhcmFsbGVsaXNtO1xuICAgIGNvbnN0IGNvbXBpbGVyTmFtZUZvckVudmFyID0gY29tcGlsZXJOYW1lLnRvVXBwZXJDYXNlKClcbiAgICAgIC5yZXBsYWNlKCcvLS9nJywgJ18nKS5yZXBsYWNlKC9bXkEtWjAtOV9dL2csICcnKTtcbiAgICBjb25zdCBlbnZWYXJQcmVmaXggPSAnTUVURU9SXycgKyBjb21waWxlck5hbWVGb3JFbnZhciArICdfQ0FDSEVfJztcblxuICAgIGNvbnN0IGRlYnVnRW52VmFyID0gZW52VmFyUHJlZml4ICsgJ0RFQlVHJztcbiAgICB0aGlzLl9jYWNoZURlYnVnRW5hYmxlZCA9ICEhIHByb2Nlc3MuZW52W2RlYnVnRW52VmFyXTtcblxuICAgIGNvbnN0IGNhY2hlU2l6ZUVudlZhciA9IGVudlZhclByZWZpeCArICdTSVpFJztcbiAgICB0aGlzLl9jYWNoZVNpemUgPSArcHJvY2Vzcy5lbnZbY2FjaGVTaXplRW52VmFyXSB8fCBkZWZhdWx0Q2FjaGVTaXplO1xuXG4gICAgdGhpcy5fZGlza0NhY2hlID0gbnVsbDtcblxuICAgIC8vIEZvciB0ZXN0aW5nLlxuICAgIHRoaXMuX2NhbGxDb3VudCA9IDA7XG5cbiAgICAvLyBDYWxsYmFja3MgdGhhdCB3aWxsIGJlIGNhbGxlZCBhZnRlciB0aGUgbGlua2VyIGlzIGRvbmUgcHJvY2Vzc2luZ1xuICAgIC8vIGZpbGVzLCBhZnRlciBhbGwgbGF6eSBjb21waWxhdGlvbiBoYXMgZmluaXNoZWQuXG4gICAgdGhpcy5fYWZ0ZXJMaW5rQ2FsbGJhY2tzID0gW107XG4gIH1cblxuICAvLyBZb3VyIHN1YmNsYXNzIG11c3Qgb3ZlcnJpZGUgdGhpcyBtZXRob2QgdG8gZGVmaW5lIHRoZSBrZXkgdXNlZCB0byBpZGVudGlmeVxuICAvLyBhIHBhcnRpY3VsYXIgdmVyc2lvbiBvZiBhbiBJbnB1dEZpbGUuXG4gIC8vXG4gIC8vIEdpdmVuIGFuIElucHV0RmlsZSAodGhlIGRhdGEgdHlwZSBwYXNzZWQgdG8gcHJvY2Vzc0ZpbGVzRm9yVGFyZ2V0IGFzIHBhcnRcbiAgLy8gb2YgdGhlIFBsdWdpbi5yZWdpc3RlckNvbXBpbGVyIEFQSSksIHJldHVybnMgYSBjYWNoZSBrZXkgdGhhdCByZXByZXNlbnRzXG4gIC8vIGl0LiBUaGlzIGNhY2hlIGtleSBjYW4gYmUgYW55IEpTT04gdmFsdWUgKGl0IHdpbGwgYmUgY29udmVydGVkIGludGVybmFsbHlcbiAgLy8gaW50byBhIGhhc2gpLiAgVGhpcyBzaG91bGQgcmVmbGVjdCBhbnkgYXNwZWN0IG9mIHRoZSBJbnB1dEZpbGUgdGhhdCBhZmZlY3RzXG4gIC8vIHRoZSBvdXRwdXQgb2YgYGNvbXBpbGVPbmVGaWxlYC4gVHlwaWNhbGx5IHlvdSdsbCB3YW50IHRvIGluY2x1ZGVcbiAgLy8gYGlucHV0RmlsZS5nZXREZWNsYXJlZEV4cG9ydHMoKWAsIGFuZCBwZXJoYXBzXG4gIC8vIGBpbnB1dEZpbGUuZ2V0UGF0aEluUGFja2FnZSgpYCBvciBgaW5wdXRGaWxlLmdldERlY2xhcmVkRXhwb3J0c2AgaWZcbiAgLy8gYGNvbXBpbGVPbmVGaWxlYCBwYXlzIGF0dGVudGlvbiB0byB0aGVtLlxuICAvL1xuICAvLyBOb3RlIHRoYXQgZm9yIE11bHRpRmlsZUNhY2hpbmdDb21waWxlciwgeW91ciBjYWNoZSBrZXkgZG9lc24ndCBuZWVkIHRvXG4gIC8vIGluY2x1ZGUgdGhlIGZpbGUncyBwYXRoLCBiZWNhdXNlIHRoYXQgaXMgYXV0b21hdGljYWxseSB0YWtlbiBpbnRvIGFjY291bnRcbiAgLy8gYnkgdGhlIGltcGxlbWVudGF0aW9uLiBDYWNoaW5nQ29tcGlsZXIgc3ViY2xhc3NlcyBjYW4gY2hvb3NlIHdoZXRoZXIgb3Igbm90XG4gIC8vIHRvIGluY2x1ZGUgdGhlIGZpbGUncyBwYXRoIGluIHRoZSBjYWNoZSBrZXkuXG4gIGdldENhY2hlS2V5KGlucHV0RmlsZSkge1xuICAgIHRocm93IEVycm9yKCdDYWNoaW5nQ29tcGlsZXIgc3ViY2xhc3Mgc2hvdWxkIGltcGxlbWVudCBnZXRDYWNoZUtleSEnKTtcbiAgfVxuXG4gIC8vIFlvdXIgc3ViY2xhc3MgbXVzdCBvdmVycmlkZSB0aGlzIG1ldGhvZCB0byBkZWZpbmUgaG93IGEgQ29tcGlsZVJlc3VsdFxuICAvLyB0cmFuc2xhdGVzIGludG8gYWRkaW5nIGFzc2V0cyB0byB0aGUgYnVuZGxlLlxuICAvL1xuICAvLyBUaGlzIG1ldGhvZCBpcyBnaXZlbiBhbiBJbnB1dEZpbGUgKHRoZSBkYXRhIHR5cGUgcGFzc2VkIHRvXG4gIC8vIHByb2Nlc3NGaWxlc0ZvclRhcmdldCBhcyBwYXJ0IG9mIHRoZSBQbHVnaW4ucmVnaXN0ZXJDb21waWxlciBBUEkpIGFuZCBhXG4gIC8vIENvbXBpbGVSZXN1bHQgKGVpdGhlciByZXR1cm5lZCBkaXJlY3RseSBmcm9tIGNvbXBpbGVPbmVGaWxlIG9yIHJlYWQgZnJvbVxuICAvLyB0aGUgY2FjaGUpLiAgSXQgc2hvdWxkIGNhbGwgbWV0aG9kcyBsaWtlIGBpbnB1dEZpbGUuYWRkSmF2YVNjcmlwdGBcbiAgLy8gYW5kIGBpbnB1dEZpbGUuZXJyb3JgLlxuICBhZGRDb21waWxlUmVzdWx0KGlucHV0RmlsZSwgY29tcGlsZVJlc3VsdCkge1xuICAgIHRocm93IEVycm9yKCdDYWNoaW5nQ29tcGlsZXIgc3ViY2xhc3Mgc2hvdWxkIGltcGxlbWVudCBhZGRDb21waWxlUmVzdWx0IScpO1xuICB9XG5cbiAgLy8gWW91ciBzdWJjbGFzcyBtdXN0IG92ZXJyaWRlIHRoaXMgbWV0aG9kIHRvIGRlZmluZSB0aGUgc2l6ZSBvZiBhXG4gIC8vIENvbXBpbGVyUmVzdWx0ICh1c2VkIGJ5IHRoZSBpbi1tZW1vcnkgY2FjaGUgdG8gbGltaXQgdGhlIHRvdGFsIGFtb3VudCBvZlxuICAvLyBkYXRhIGNhY2hlZCkuXG4gIGNvbXBpbGVSZXN1bHRTaXplKGNvbXBpbGVSZXN1bHQpIHtcbiAgICB0aHJvdyBFcnJvcignQ2FjaGluZ0NvbXBpbGVyIHN1YmNsYXNzIHNob3VsZCBpbXBsZW1lbnQgY29tcGlsZVJlc3VsdFNpemUhJyk7XG4gIH1cblxuICAvLyBZb3VyIHN1YmNsYXNzIG1heSBvdmVycmlkZSB0aGlzIG1ldGhvZCB0byBkZWZpbmUgYW4gYWx0ZXJuYXRlIHdheSBvZlxuICAvLyBzdHJpbmdpZnlpbmcgQ29tcGlsZXJSZXN1bHRzLiAgVGFrZXMgYSBDb21waWxlUmVzdWx0IGFuZCByZXR1cm5zIGEgc3RyaW5nLlxuICBzdHJpbmdpZnlDb21waWxlUmVzdWx0KGNvbXBpbGVSZXN1bHQpIHtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoY29tcGlsZVJlc3VsdCk7XG4gIH1cbiAgLy8gWW91ciBzdWJjbGFzcyBtYXkgb3ZlcnJpZGUgdGhpcyBtZXRob2QgdG8gZGVmaW5lIGFuIGFsdGVybmF0ZSB3YXkgb2ZcbiAgLy8gcGFyc2luZyBDb21waWxlclJlc3VsdHMgZnJvbSBzdHJpbmcuICBUYWtlcyBhIHN0cmluZyBhbmQgcmV0dXJucyBhXG4gIC8vIENvbXBpbGVSZXN1bHQuICBJZiB0aGUgc3RyaW5nIGRvZXNuJ3QgcmVwcmVzZW50IGEgdmFsaWQgQ29tcGlsZVJlc3VsdCwgeW91XG4gIC8vIG1heSB3YW50IHRvIHJldHVybiBudWxsIGluc3RlYWQgb2YgdGhyb3dpbmcsIHdoaWNoIHdpbGwgbWFrZVxuICAvLyBDYWNoaW5nQ29tcGlsZXIgaWdub3JlIHRoZSBjYWNoZS5cbiAgcGFyc2VDb21waWxlUmVzdWx0KHN0cmluZ2lmaWVkQ29tcGlsZVJlc3VsdCkge1xuICAgIHJldHVybiB0aGlzLl9wYXJzZUpTT05Pck51bGwoc3RyaW5naWZpZWRDb21waWxlUmVzdWx0KTtcbiAgfVxuICBfcGFyc2VKU09OT3JOdWxsKGpzb24pIHtcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIEpTT04ucGFyc2UoanNvbik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgaWYgKGUgaW5zdGFuY2VvZiBTeW50YXhFcnJvcilcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB0aHJvdyBlO1xuICAgIH1cbiAgfVxuXG4gIF9jYWNoZURlYnVnKG1lc3NhZ2UpIHtcbiAgICBpZiAoIXRoaXMuX2NhY2hlRGVidWdFbmFibGVkKVxuICAgICAgcmV0dXJuO1xuICAgIGNvbnNvbGUubG9nKGBDQUNIRSgkeyB0aGlzLl9jb21waWxlck5hbWUgfSk6ICR7IG1lc3NhZ2UgfWApO1xuICB9XG5cbiAgc2V0RGlza0NhY2hlRGlyZWN0b3J5KGRpc2tDYWNoZSkge1xuICAgIGlmICh0aGlzLl9kaXNrQ2FjaGUpXG4gICAgICB0aHJvdyBFcnJvcignc2V0RGlza0NhY2hlRGlyZWN0b3J5IGNhbGxlZCB0d2ljZT8nKTtcbiAgICB0aGlzLl9kaXNrQ2FjaGUgPSBkaXNrQ2FjaGU7XG4gIH1cblxuICAvLyBTaW5jZSBzbyBtYW55IGNvbXBpbGVycyB3aWxsIG5lZWQgdG8gY2FsY3VsYXRlIHRoZSBzaXplIG9mIGEgU291cmNlTWFwIGluXG4gIC8vIHRoZWlyIGNvbXBpbGVSZXN1bHRTaXplLCB0aGlzIG1ldGhvZCBpcyBwcm92aWRlZC5cbiAgc291cmNlTWFwU2l6ZShzbSkge1xuICAgIGlmICghIHNtKSByZXR1cm4gMDtcbiAgICAvLyBzdW0gdGhlIGxlbmd0aCBvZiBzb3VyY2VzIGFuZCB0aGUgbWFwcGluZ3MsIHRoZSBzaXplIG9mXG4gICAgLy8gbWV0YWRhdGEgaXMgaWdub3JlZCwgYnV0IGl0IGlzIG5vdCBhIGJpZyBkZWFsXG4gICAgcmV0dXJuIHNtLm1hcHBpbmdzLmxlbmd0aFxuICAgICAgKyAoc20uc291cmNlc0NvbnRlbnQgfHwgW10pLnJlZHVjZShmdW5jdGlvbiAoc29GYXIsIGN1cnJlbnQpIHtcbiAgICAgICAgcmV0dXJuIHNvRmFyICsgKGN1cnJlbnQgPyBjdXJyZW50Lmxlbmd0aCA6IDApO1xuICAgICAgfSwgMCk7XG4gIH1cblxuICAvLyBDYWxsZWQgYnkgdGhlIGNvbXBpbGVyIHBsdWdpbnMgc3lzdGVtIGFmdGVyIGFsbCBsaW5raW5nIGFuZCBsYXp5XG4gIC8vIGNvbXBpbGF0aW9uIGhhcyBmaW5pc2hlZC5cbiAgYWZ0ZXJMaW5rKCkge1xuICAgIHRoaXMuX2FmdGVyTGlua0NhbGxiYWNrcy5zcGxpY2UoMCkuZm9yRWFjaChjYWxsYmFjayA9PiB7XG4gICAgICBjYWxsYmFjaygpO1xuICAgIH0pO1xuICB9XG5cbiAgLy8gQm9ycm93ZWQgZnJvbSBhbm90aGVyIE1JVC1saWNlbnNlZCBwcm9qZWN0IHRoYXQgYmVuamFtbiB3cm90ZTpcbiAgLy8gaHR0cHM6Ly9naXRodWIuY29tL3JlYWN0anMvY29tbW9uZXIvYmxvYi8yMzVkNTRhMTJjL2xpYi91dGlsLmpzI0wxMzYtTDE2OFxuICBfZGVlcEhhc2godmFsKSB7XG4gICAgY29uc3QgaGFzaCA9IGNyZWF0ZUhhc2goJ3NoYTEnKTtcbiAgICBsZXQgdHlwZSA9IHR5cGVvZiB2YWw7XG5cbiAgICBpZiAodmFsID09PSBudWxsKSB7XG4gICAgICB0eXBlID0gJ251bGwnO1xuICAgIH1cbiAgICBoYXNoLnVwZGF0ZSh0eXBlICsgJ1xcMCcpO1xuXG4gICAgc3dpdGNoICh0eXBlKSB7XG4gICAgY2FzZSAnb2JqZWN0JzpcbiAgICAgIGNvbnN0IGtleXMgPSBPYmplY3Qua2V5cyh2YWwpO1xuXG4gICAgICAvLyBBcnJheSBrZXlzIHdpbGwgYWxyZWFkeSBiZSBzb3J0ZWQuXG4gICAgICBpZiAoISBBcnJheS5pc0FycmF5KHZhbCkpIHtcbiAgICAgICAga2V5cy5zb3J0KCk7XG4gICAgICB9XG5cbiAgICAgIGtleXMuZm9yRWFjaCgoa2V5KSA9PiB7XG4gICAgICAgIGlmICh0eXBlb2YgdmFsW2tleV0gPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAvLyBTaWxlbnRseSBpZ25vcmUgbmVzdGVkIG1ldGhvZHMsIGJ1dCBuZXZlcnRoZWxlc3MgY29tcGxhaW4gYmVsb3dcbiAgICAgICAgICAvLyBpZiB0aGUgcm9vdCB2YWx1ZSBpcyBhIGZ1bmN0aW9uLlxuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGhhc2gudXBkYXRlKGtleSArICdcXDAnKS51cGRhdGUodGhpcy5fZGVlcEhhc2godmFsW2tleV0pKTtcbiAgICAgIH0pO1xuXG4gICAgICBicmVhaztcblxuICAgIGNhc2UgJ2Z1bmN0aW9uJzpcbiAgICAgIGFzc2VydC5vayhmYWxzZSwgJ2Nhbm5vdCBoYXNoIGZ1bmN0aW9uIG9iamVjdHMnKTtcbiAgICAgIGJyZWFrO1xuXG4gICAgZGVmYXVsdDpcbiAgICAgIGhhc2gudXBkYXRlKCcnICsgdmFsKTtcbiAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIHJldHVybiBoYXNoLmRpZ2VzdCgnaGV4Jyk7XG4gIH1cblxuICAvLyBXcml0ZSB0aGUgZmlsZSBhdG9taWNhbGx5LlxuICBfd3JpdGVGaWxlKGZpbGVuYW1lLCBjb250ZW50cykge1xuICAgIGNvbnN0IHRlbXBGaWxlbmFtZSA9IGZpbGVuYW1lICsgJy50bXAuJyArIFJhbmRvbS5pZCgpO1xuXG4gICAgdHJ5IHtcbiAgICAgIGZzLndyaXRlRmlsZVN5bmModGVtcEZpbGVuYW1lLCBjb250ZW50cyk7XG4gICAgICBmcy5yZW5hbWVTeW5jKHRlbXBGaWxlbmFtZSwgZmlsZW5hbWUpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIC8vIGlnbm9yZSBlcnJvcnMsIGl0J3MganVzdCBhIGNhY2hlXG4gICAgICB0aGlzLl9jYWNoZURlYnVnKGUpO1xuICAgIH1cbiAgfVxuXG4gIC8vIEhlbHBlciBmdW5jdGlvbi4gUmV0dXJucyB0aGUgYm9keSBvZiB0aGUgZmlsZSBhcyBhIHN0cmluZywgb3IgbnVsbCBpZiBpdFxuICAvLyBkb2Vzbid0IGV4aXN0LlxuICBfcmVhZEZpbGVPck51bGwoZmlsZW5hbWUpIHtcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIGZzLnJlYWRGaWxlU3luYyhmaWxlbmFtZSwgJ3V0ZjgnKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBpZiAoZSAmJiBlLmNvZGUgPT09ICdFTk9FTlQnKVxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIHRocm93IGU7XG4gICAgfVxuICB9XG59XG5cbi8vIENhY2hpbmdDb21waWxlciBpcyBhIGNsYXNzIGRlc2lnbmVkIHRvIGJlIHVzZWQgd2l0aCBQbHVnaW4ucmVnaXN0ZXJDb21waWxlclxuLy8gd2hpY2ggaW1wbGVtZW50cyBpbi1tZW1vcnkgYW5kIG9uLWRpc2sgY2FjaGVzIGZvciB0aGUgZmlsZXMgdGhhdCBpdFxuLy8gcHJvY2Vzc2VzLiAgWW91IHNob3VsZCBzdWJjbGFzcyBDYWNoaW5nQ29tcGlsZXIgYW5kIGRlZmluZSB0aGUgZm9sbG93aW5nXG4vLyBtZXRob2RzOiBnZXRDYWNoZUtleSwgY29tcGlsZU9uZUZpbGUsIGFkZENvbXBpbGVSZXN1bHQsIGFuZFxuLy8gY29tcGlsZVJlc3VsdFNpemUuXG4vL1xuLy8gQ2FjaGluZ0NvbXBpbGVyIGFzc3VtZXMgdGhhdCBmaWxlcyBhcmUgcHJvY2Vzc2VkIGluZGVwZW5kZW50bHkgb2YgZWFjaCBvdGhlcjtcbi8vIHRoZXJlIGlzIG5vICdpbXBvcnQnIGRpcmVjdGl2ZSBhbGxvd2luZyBvbmUgZmlsZSB0byByZWZlcmVuY2UgYW5vdGhlci4gIFRoYXRcbi8vIGlzLCBlZGl0aW5nIG9uZSBmaWxlIHNob3VsZCBvbmx5IHJlcXVpcmUgdGhhdCBmaWxlIHRvIGJlIHJlYnVpbHQsIG5vdCBvdGhlclxuLy8gZmlsZXMuXG4vL1xuLy8gVGhlIGRhdGEgdGhhdCBpcyBjYWNoZWQgZm9yIGVhY2ggZmlsZSBpcyBvZiBhIHR5cGUgdGhhdCBpcyAoaW1wbGljaXRseSlcbi8vIGRlZmluZWQgYnkgeW91ciBzdWJjbGFzcy4gQ2FjaGluZ0NvbXBpbGVyIHJlZmVycyB0byB0aGlzIHR5cGUgYXNcbi8vIGBDb21waWxlUmVzdWx0YCwgYnV0IHRoaXMgaXNuJ3QgYSBzaW5nbGUgdHlwZTogaXQncyB1cCB0byB5b3VyIHN1YmNsYXNzIHRvXG4vLyBkZWNpZGUgd2hhdCB0eXBlIG9mIGRhdGEgdGhpcyBpcy4gIFlvdSBzaG91bGQgZG9jdW1lbnQgd2hhdCB5b3VyIHN1YmNsYXNzJ3Ncbi8vIENvbXBpbGVSZXN1bHQgdHlwZSBpcy5cbi8vXG4vLyBZb3VyIHN1YmNsYXNzJ3MgY29tcGlsZXIgc2hvdWxkIGNhbGwgdGhlIHN1cGVyY2xhc3MgY29tcGlsZXIgc3BlY2lmeWluZyB0aGVcbi8vIGNvbXBpbGVyIG5hbWUgKHVzZWQgdG8gZ2VuZXJhdGUgZW52aXJvbm1lbnQgdmFyaWFibGVzIGZvciBkZWJ1Z2dpbmcgYW5kXG4vLyB0d2Vha2luZyBpbi1tZW1vcnkgY2FjaGUgc2l6ZSkgYW5kIHRoZSBkZWZhdWx0IGNhY2hlIHNpemUuXG4vL1xuLy8gQnkgZGVmYXVsdCwgQ2FjaGluZ0NvbXBpbGVyIHByb2Nlc3NlcyBlYWNoIGZpbGUgaW4gXCJwYXJhbGxlbFwiLiBUaGF0IGlzLCBpZiBpdFxuLy8gbmVlZHMgdG8geWllbGQgdG8gcmVhZCBmcm9tIHRoZSBkaXNrIGNhY2hlLCBvciBpZiBnZXRDYWNoZUtleSxcbi8vIGNvbXBpbGVPbmVGaWxlLCBvciBhZGRDb21waWxlUmVzdWx0IHlpZWxkcywgaXQgd2lsbCBzdGFydCBwcm9jZXNzaW5nIHRoZSBuZXh0XG4vLyBmZXcgZmlsZXMuIFRvIHNldCBob3cgbWFueSBmaWxlcyBjYW4gYmUgcHJvY2Vzc2VkIGluIHBhcmFsbGVsIChpbmNsdWRpbmdcbi8vIHNldHRpbmcgaXQgdG8gMSBpZiB5b3VyIHN1YmNsYXNzIGRvZXNuJ3Qgc3VwcG9ydCBhbnkgcGFyYWxsZWxpc20pLCBwYXNzIHRoZVxuLy8gbWF4UGFyYWxsZWxpc20gb3B0aW9uIHRvIHRoZSBzdXBlcmNsYXNzIGNvbnN0cnVjdG9yLlxuLy9cbi8vIEZvciBleGFtcGxlICh1c2luZyBFUzIwMTUgdmlhIHRoZSBlY21hc2NyaXB0IHBhY2thZ2UpOlxuLy9cbi8vICAgY2xhc3MgQXdlc29tZUNvbXBpbGVyIGV4dGVuZHMgQ2FjaGluZ0NvbXBpbGVyIHtcbi8vICAgICBjb25zdHJ1Y3RvcigpIHtcbi8vICAgICAgIHN1cGVyKHtcbi8vICAgICAgICAgY29tcGlsZXJOYW1lOiAnYXdlc29tZScsXG4vLyAgICAgICAgIGRlZmF1bHRDYWNoZVNpemU6IDEwMjQqMTAyNCoxMCxcbi8vICAgICAgIH0pO1xuLy8gICAgIH1cbi8vICAgICAvLyAuLi4gZGVmaW5lIHRoZSBvdGhlciBtZXRob2RzXG4vLyAgIH1cbi8vICAgUGx1Z2luLnJlZ2lzdGVyQ29tcGlsZSh7XG4vLyAgICAgZXh0ZW5zaW9uczogWydhd2Vzb21lJ10sXG4vLyAgIH0sICgpID0+IG5ldyBBd2Vzb21lQ29tcGlsZXIoKSk7XG4vL1xuLy8gWFhYIG1heWJlIGNvbXBpbGVSZXN1bHRTaXplIGFuZCBzdHJpbmdpZnlDb21waWxlUmVzdWx0IHNob3VsZCBqdXN0IGJlIG1ldGhvZHNcbi8vIG9uIENvbXBpbGVSZXN1bHQ/IFNvcnQgb2YgaGFyZCB0byBkbyB0aGF0IHdpdGggcGFyc2VDb21waWxlUmVzdWx0LlxuQ2FjaGluZ0NvbXBpbGVyID0gY2xhc3MgQ2FjaGluZ0NvbXBpbGVyIGV4dGVuZHMgQ2FjaGluZ0NvbXBpbGVyQmFzZSB7XG4gIGNvbnN0cnVjdG9yKHtcbiAgICBjb21waWxlck5hbWUsXG4gICAgZGVmYXVsdENhY2hlU2l6ZSxcbiAgICBtYXhQYXJhbGxlbGlzbSA9IDIwLFxuICB9KSB7XG4gICAgc3VwZXIoe2NvbXBpbGVyTmFtZSwgZGVmYXVsdENhY2hlU2l6ZSwgbWF4UGFyYWxsZWxpc219KTtcblxuICAgIC8vIE1hcHMgZnJvbSBhIGhhc2hlZCBjYWNoZSBrZXkgdG8gYSBjb21waWxlUmVzdWx0LlxuICAgIHRoaXMuX2NhY2hlID0gbmV3IExSVSh7XG4gICAgICBtYXg6IHRoaXMuX2NhY2hlU2l6ZSxcbiAgICAgIGxlbmd0aDogKHZhbHVlKSA9PiB0aGlzLmNvbXBpbGVSZXN1bHRTaXplKHZhbHVlKSxcbiAgICB9KTtcbiAgfVxuXG4gIC8vIFlvdXIgc3ViY2xhc3MgbXVzdCBvdmVycmlkZSB0aGlzIG1ldGhvZCB0byBkZWZpbmUgdGhlIHRyYW5zZm9ybWF0aW9uIGZyb21cbiAgLy8gSW5wdXRGaWxlIHRvIGl0cyBjYWNoZWFibGUgQ29tcGlsZVJlc3VsdCkuXG4gIC8vXG4gIC8vIEdpdmVuIGFuIElucHV0RmlsZSAodGhlIGRhdGEgdHlwZSBwYXNzZWQgdG8gcHJvY2Vzc0ZpbGVzRm9yVGFyZ2V0IGFzIHBhcnRcbiAgLy8gb2YgdGhlIFBsdWdpbi5yZWdpc3RlckNvbXBpbGVyIEFQSSksIGNvbXBpbGVzIHRoZSBmaWxlIGFuZCByZXR1cm5zIGFcbiAgLy8gQ29tcGlsZVJlc3VsdCAodGhlIGNhY2hlYWJsZSBkYXRhIHR5cGUgc3BlY2lmaWMgdG8geW91ciBzdWJjbGFzcykuXG4gIC8vXG4gIC8vIFRoaXMgbWV0aG9kIGlzIG5vdCBjYWxsZWQgb24gZmlsZXMgd2hlbiBhIHZhbGlkIGNhY2hlIGVudHJ5IGV4aXN0cyBpblxuICAvLyBtZW1vcnkgb3Igb24gZGlzay5cbiAgLy9cbiAgLy8gT24gYSBjb21waWxlIGVycm9yLCB5b3Ugc2hvdWxkIGNhbGwgYGlucHV0RmlsZS5lcnJvcmAgYXBwcm9wcmlhdGVseSBhbmRcbiAgLy8gcmV0dXJuIG51bGw7IHRoaXMgd2lsbCBub3QgYmUgY2FjaGVkLlxuICAvL1xuICAvLyBUaGlzIG1ldGhvZCBzaG91bGQgbm90IGNhbGwgYGlucHV0RmlsZS5hZGRKYXZhU2NyaXB0YCBhbmQgc2ltaWxhciBmaWxlcyFcbiAgLy8gVGhhdCdzIHdoYXQgYWRkQ29tcGlsZVJlc3VsdCBpcyBmb3IuXG4gIGNvbXBpbGVPbmVGaWxlKGlucHV0RmlsZSkge1xuICAgIHRocm93IEVycm9yKCdDYWNoaW5nQ29tcGlsZXIgc3ViY2xhc3Mgc2hvdWxkIGltcGxlbWVudCBjb21waWxlT25lRmlsZSEnKTtcbiAgfVxuXG4gIC8vIFRoZSBwcm9jZXNzRmlsZXNGb3JUYXJnZXQgbWV0aG9kIGZyb20gdGhlIFBsdWdpbi5yZWdpc3RlckNvbXBpbGVyIEFQSS4gSWZcbiAgLy8geW91IGhhdmUgcHJvY2Vzc2luZyB5b3Ugd2FudCB0byBwZXJmb3JtIGF0IHRoZSBiZWdpbm5pbmcgb3IgZW5kIG9mIGFcbiAgLy8gcHJvY2Vzc2luZyBwaGFzZSwgeW91IG1heSB3YW50IHRvIG92ZXJyaWRlIHRoaXMgbWV0aG9kIGFuZCBjYWxsIHRoZVxuICAvLyBzdXBlcmNsYXNzIGltcGxlbWVudGF0aW9uIGZyb20gd2l0aGluIHlvdXIgbWV0aG9kLlxuICBhc3luYyBwcm9jZXNzRmlsZXNGb3JUYXJnZXQoaW5wdXRGaWxlcykge1xuICAgIGNvbnN0IGNhY2hlTWlzc2VzID0gW107XG4gICAgY29uc3QgYXJjaGVzID0gdGhpcy5fY2FjaGVEZWJ1Z0VuYWJsZWQgJiYgT2JqZWN0LmNyZWF0ZShudWxsKTtcblxuICAgIGlucHV0RmlsZXMuZm9yRWFjaChpbnB1dEZpbGUgPT4ge1xuICAgICAgaWYgKGFyY2hlcykge1xuICAgICAgICBhcmNoZXNbaW5wdXRGaWxlLmdldEFyY2goKV0gPSAxO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBnZXRSZXN1bHQgPSAoKSA9PiB7XG4gICAgICAgIGNvbnN0IGNhY2hlS2V5ID0gdGhpcy5fZGVlcEhhc2godGhpcy5nZXRDYWNoZUtleShpbnB1dEZpbGUpKTtcbiAgICAgICAgbGV0IGNvbXBpbGVSZXN1bHQgPSB0aGlzLl9jYWNoZS5nZXQoY2FjaGVLZXkpO1xuXG4gICAgICAgIGlmICghIGNvbXBpbGVSZXN1bHQpIHtcbiAgICAgICAgICBjb21waWxlUmVzdWx0ID0gdGhpcy5fcmVhZENhY2hlKGNhY2hlS2V5KTtcbiAgICAgICAgICBpZiAoY29tcGlsZVJlc3VsdCkge1xuICAgICAgICAgICAgdGhpcy5fY2FjaGVEZWJ1ZyhgTG9hZGVkICR7IGlucHV0RmlsZS5nZXREaXNwbGF5UGF0aCgpIH1gKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoISBjb21waWxlUmVzdWx0KSB7XG4gICAgICAgICAgY2FjaGVNaXNzZXMucHVzaChpbnB1dEZpbGUuZ2V0RGlzcGxheVBhdGgoKSk7XG4gICAgICAgICAgY29tcGlsZVJlc3VsdCA9IFByb21pc2UuYXdhaXQodGhpcy5jb21waWxlT25lRmlsZShpbnB1dEZpbGUpKTtcblxuICAgICAgICAgIGlmICghIGNvbXBpbGVSZXN1bHQpIHtcbiAgICAgICAgICAgIC8vIGNvbXBpbGVPbmVGaWxlIHNob3VsZCBoYXZlIGNhbGxlZCBpbnB1dEZpbGUuZXJyb3IuXG4gICAgICAgICAgICAvLyAgV2UgZG9uJ3QgY2FjaGUgZmFpbHVyZXMgZm9yIG5vdy5cbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBTYXZlIHdoYXQgd2UndmUgY29tcGlsZWQuXG4gICAgICAgICAgdGhpcy5fY2FjaGUuc2V0KGNhY2hlS2V5LCBjb21waWxlUmVzdWx0KTtcbiAgICAgICAgICB0aGlzLl93cml0ZUNhY2hlQXN5bmMoY2FjaGVLZXksIGNvbXBpbGVSZXN1bHQpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGNvbXBpbGVSZXN1bHQ7XG4gICAgICB9O1xuXG4gICAgICBpZiAodGhpcy5jb21waWxlT25lRmlsZUxhdGVyICYmXG4gICAgICAgICAgaW5wdXRGaWxlLnN1cHBvcnRzTGF6eUNvbXBpbGF0aW9uKSB7XG4gICAgICAgIHRoaXMuY29tcGlsZU9uZUZpbGVMYXRlcihpbnB1dEZpbGUsIGdldFJlc3VsdCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBnZXRSZXN1bHQoKTtcbiAgICAgICAgaWYgKHJlc3VsdCkge1xuICAgICAgICAgIHRoaXMuYWRkQ29tcGlsZVJlc3VsdChpbnB1dEZpbGUsIHJlc3VsdCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGlmICh0aGlzLl9jYWNoZURlYnVnRW5hYmxlZCkge1xuICAgICAgdGhpcy5fYWZ0ZXJMaW5rQ2FsbGJhY2tzLnB1c2goKCkgPT4ge1xuICAgICAgICBjYWNoZU1pc3Nlcy5zb3J0KCk7XG5cbiAgICAgICAgdGhpcy5fY2FjaGVEZWJ1ZyhcbiAgICAgICAgICBgUmFuICgjJHtcbiAgICAgICAgICAgICsrdGhpcy5fY2FsbENvdW50XG4gICAgICAgICAgfSkgb246ICR7XG4gICAgICAgICAgICBKU09OLnN0cmluZ2lmeShjYWNoZU1pc3NlcylcbiAgICAgICAgICB9ICR7XG4gICAgICAgICAgICBKU09OLnN0cmluZ2lmeShPYmplY3Qua2V5cyhhcmNoZXMpLnNvcnQoKSlcbiAgICAgICAgICB9YFxuICAgICAgICApO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgX2NhY2hlRmlsZW5hbWUoY2FjaGVLZXkpIHtcbiAgICAvLyBXZSB3YW50IGNhY2hlS2V5cyB0byBiZSBoZXggc28gdGhhdCB0aGV5IHdvcmsgb24gYW55IEZTIGFuZCBuZXZlciBlbmQgaW5cbiAgICAvLyAuY2FjaGUuXG4gICAgaWYgKCEvXlthLWYwLTldKyQvLnRlc3QoY2FjaGVLZXkpKSB7XG4gICAgICB0aHJvdyBFcnJvcignYmFkIGNhY2hlS2V5OiAnICsgY2FjaGVLZXkpO1xuICAgIH1cbiAgICByZXR1cm4gcGF0aC5qb2luKHRoaXMuX2Rpc2tDYWNoZSwgY2FjaGVLZXkgKyAnLmNhY2hlJyk7XG4gIH1cbiAgLy8gTG9hZCBhIGNhY2hlIGVudHJ5IGZyb20gZGlzay4gUmV0dXJucyB0aGUgY29tcGlsZVJlc3VsdCBvYmplY3RcbiAgLy8gYW5kIGxvYWRzIGl0IGludG8gdGhlIGluLW1lbW9yeSBjYWNoZSB0b28uXG4gIF9yZWFkQ2FjaGUoY2FjaGVLZXkpIHtcbiAgICBpZiAoISB0aGlzLl9kaXNrQ2FjaGUpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBjb25zdCBjYWNoZUZpbGVuYW1lID0gdGhpcy5fY2FjaGVGaWxlbmFtZShjYWNoZUtleSk7XG4gICAgY29uc3QgY29tcGlsZVJlc3VsdCA9IHRoaXMuX3JlYWRBbmRQYXJzZUNvbXBpbGVSZXN1bHRPck51bGwoY2FjaGVGaWxlbmFtZSk7XG4gICAgaWYgKCEgY29tcGlsZVJlc3VsdCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIHRoaXMuX2NhY2hlLnNldChjYWNoZUtleSwgY29tcGlsZVJlc3VsdCk7XG4gICAgcmV0dXJuIGNvbXBpbGVSZXN1bHQ7XG4gIH1cbiAgX3dyaXRlQ2FjaGVBc3luYyhjYWNoZUtleSwgY29tcGlsZVJlc3VsdCkge1xuICAgIGlmICghIHRoaXMuX2Rpc2tDYWNoZSlcbiAgICAgIHJldHVybjtcbiAgICBjb25zdCBjYWNoZUZpbGVuYW1lID0gdGhpcy5fY2FjaGVGaWxlbmFtZShjYWNoZUtleSk7XG4gICAgY29uc3QgY2FjaGVDb250ZW50cyA9IHRoaXMuc3RyaW5naWZ5Q29tcGlsZVJlc3VsdChjb21waWxlUmVzdWx0KTtcbiAgICB0aGlzLl93cml0ZUZpbGUoY2FjaGVGaWxlbmFtZSwgY2FjaGVDb250ZW50cyk7XG4gIH1cblxuICAvLyBSZXR1cm5zIG51bGwgaWYgdGhlIGZpbGUgZG9lcyBub3QgZXhpc3Qgb3IgY2FuJ3QgYmUgcGFyc2VkOyBvdGhlcndpc2VcbiAgLy8gcmV0dXJucyB0aGUgcGFyc2VkIGNvbXBpbGVSZXN1bHQgaW4gdGhlIGZpbGUuXG4gIF9yZWFkQW5kUGFyc2VDb21waWxlUmVzdWx0T3JOdWxsKGZpbGVuYW1lKSB7XG4gICAgY29uc3QgcmF3ID0gdGhpcy5fcmVhZEZpbGVPck51bGwoZmlsZW5hbWUpO1xuICAgIHJldHVybiB0aGlzLnBhcnNlQ29tcGlsZVJlc3VsdChyYXcpO1xuICB9XG59XG4iLCJjb25zdCBwYXRoID0gUGx1Z2luLnBhdGg7XG5jb25zdCBMUlUgPSBOcG0ucmVxdWlyZSgnbHJ1LWNhY2hlJyk7XG5cbi8vIE11bHRpRmlsZUNhY2hpbmdDb21waWxlciBpcyBsaWtlIENhY2hpbmdDb21waWxlciwgYnV0IGZvciBpbXBsZW1lbnRpbmdcbi8vIGxhbmd1YWdlcyB3aGljaCBhbGxvdyBmaWxlcyB0byByZWZlcmVuY2UgZWFjaCBvdGhlciwgc3VjaCBhcyBDU1Ncbi8vIHByZXByb2Nlc3NvcnMgd2l0aCBgQGltcG9ydGAgZGlyZWN0aXZlcy5cbi8vXG4vLyBMaWtlIENhY2hpbmdDb21waWxlciwgeW91IHNob3VsZCBzdWJjbGFzcyBNdWx0aUZpbGVDYWNoaW5nQ29tcGlsZXIgYW5kIGRlZmluZVxuLy8gdGhlIGZvbGxvd2luZyBtZXRob2RzOiBnZXRDYWNoZUtleSwgY29tcGlsZU9uZUZpbGUsIGFkZENvbXBpbGVSZXN1bHQsIGFuZFxuLy8gY29tcGlsZVJlc3VsdFNpemUuICBjb21waWxlT25lRmlsZSBnZXRzIGFuIGFkZGl0aW9uYWwgYWxsRmlsZXMgYXJndW1lbnQgYW5kXG4vLyByZXR1cm5zIGFuIGFycmF5IG9mIHJlZmVyZW5jZWQgaW1wb3J0IHBhdGhzIGluIGFkZGl0aW9uIHRvIHRoZSBDb21waWxlUmVzdWx0LlxuLy8gWW91IG1heSBhbHNvIG92ZXJyaWRlIGlzUm9vdCBhbmQgZ2V0QWJzb2x1dGVJbXBvcnRQYXRoIHRvIGN1c3RvbWl6ZVxuLy8gTXVsdGlGaWxlQ2FjaGluZ0NvbXBpbGVyIGZ1cnRoZXIuXG5NdWx0aUZpbGVDYWNoaW5nQ29tcGlsZXIgPSBjbGFzcyBNdWx0aUZpbGVDYWNoaW5nQ29tcGlsZXJcbmV4dGVuZHMgQ2FjaGluZ0NvbXBpbGVyQmFzZSB7XG4gIGNvbnN0cnVjdG9yKHtcbiAgICBjb21waWxlck5hbWUsXG4gICAgZGVmYXVsdENhY2hlU2l6ZSxcbiAgICBtYXhQYXJhbGxlbGlzbVxuICB9KSB7XG4gICAgc3VwZXIoe2NvbXBpbGVyTmFtZSwgZGVmYXVsdENhY2hlU2l6ZSwgbWF4UGFyYWxsZWxpc219KTtcblxuICAgIC8vIE1hcHMgZnJvbSBjYWNoZSBrZXkgdG8geyBjb21waWxlUmVzdWx0LCBjYWNoZUtleXMgfSwgd2hlcmVcbiAgICAvLyBjYWNoZUtleXMgaXMgYW4gb2JqZWN0IG1hcHBpbmcgZnJvbSBhYnNvbHV0ZSBpbXBvcnQgcGF0aCB0byBoYXNoZWRcbiAgICAvLyBjYWNoZUtleSBmb3IgZWFjaCBmaWxlIHJlZmVyZW5jZWQgYnkgdGhpcyBmaWxlIChpbmNsdWRpbmcgaXRzZWxmKS5cbiAgICB0aGlzLl9jYWNoZSA9IG5ldyBMUlUoe1xuICAgICAgbWF4OiB0aGlzLl9jYWNoZVNpemUsXG4gICAgICAvLyBXZSBpZ25vcmUgdGhlIHNpemUgb2YgY2FjaGVLZXlzIGhlcmUuXG4gICAgICBsZW5ndGg6ICh2YWx1ZSkgPT4gdGhpcy5jb21waWxlUmVzdWx0U2l6ZSh2YWx1ZS5jb21waWxlUmVzdWx0KSxcbiAgICB9KTtcbiAgfVxuXG4gIC8vIFlvdXIgc3ViY2xhc3MgbXVzdCBvdmVycmlkZSB0aGlzIG1ldGhvZCB0byBkZWZpbmUgdGhlIHRyYW5zZm9ybWF0aW9uIGZyb21cbiAgLy8gSW5wdXRGaWxlIHRvIGl0cyBjYWNoZWFibGUgQ29tcGlsZVJlc3VsdCkuXG4gIC8vXG4gIC8vIEFyZ3VtZW50czpcbiAgLy8gICAtIGlucHV0RmlsZSBpcyB0aGUgSW5wdXRGaWxlIHRvIHByb2Nlc3NcbiAgLy8gICAtIGFsbEZpbGVzIGlzIGEgYSBNYXAgbWFwcGluZyBmcm9tIGFic29sdXRlIGltcG9ydCBwYXRoIHRvIElucHV0RmlsZSBvZlxuICAvLyAgICAgYWxsIGZpbGVzIGJlaW5nIHByb2Nlc3NlZCBpbiB0aGUgdGFyZ2V0XG4gIC8vIFJldHVybnMgYW4gb2JqZWN0IHdpdGgga2V5czpcbiAgLy8gICAtIGNvbXBpbGVSZXN1bHQ6IHRoZSBDb21waWxlUmVzdWx0ICh0aGUgY2FjaGVhYmxlIGRhdGEgdHlwZSBzcGVjaWZpYyB0b1xuICAvLyAgICAgeW91ciBzdWJjbGFzcykuXG4gIC8vICAgLSByZWZlcmVuY2VkSW1wb3J0UGF0aHM6IGFuIGFycmF5IG9mIGFic29sdXRlIGltcG9ydCBwYXRocyBvZiBmaWxlc1xuICAvLyAgICAgd2hpY2ggd2VyZSByZWZlcmVyZW5jZWQgYnkgdGhlIGN1cnJlbnQgZmlsZS4gIFRoZSBjdXJyZW50IGZpbGVcbiAgLy8gICAgIGlzIGluY2x1ZGVkIGltcGxpY2l0bHkuXG4gIC8vXG4gIC8vIFRoaXMgbWV0aG9kIGlzIG5vdCBjYWxsZWQgb24gZmlsZXMgd2hlbiBhIHZhbGlkIGNhY2hlIGVudHJ5IGV4aXN0cyBpblxuICAvLyBtZW1vcnkgb3Igb24gZGlzay5cbiAgLy9cbiAgLy8gT24gYSBjb21waWxlIGVycm9yLCB5b3Ugc2hvdWxkIGNhbGwgYGlucHV0RmlsZS5lcnJvcmAgYXBwcm9wcmlhdGVseSBhbmRcbiAgLy8gcmV0dXJuIG51bGw7IHRoaXMgd2lsbCBub3QgYmUgY2FjaGVkLlxuICAvL1xuICAvLyBUaGlzIG1ldGhvZCBzaG91bGQgbm90IGNhbGwgYGlucHV0RmlsZS5hZGRKYXZhU2NyaXB0YCBhbmQgc2ltaWxhciBmaWxlcyFcbiAgLy8gVGhhdCdzIHdoYXQgYWRkQ29tcGlsZVJlc3VsdCBpcyBmb3IuXG4gIGNvbXBpbGVPbmVGaWxlKGlucHV0RmlsZSwgYWxsRmlsZXMpIHtcbiAgICB0aHJvdyBFcnJvcihcbiAgICAgICdNdWx0aUZpbGVDYWNoaW5nQ29tcGlsZXIgc3ViY2xhc3Mgc2hvdWxkIGltcGxlbWVudCBjb21waWxlT25lRmlsZSEnKTtcbiAgfVxuXG4gIC8vIFlvdXIgc3ViY2xhc3MgbWF5IG92ZXJyaWRlIHRoaXMgdG8gZGVjbGFyZSB0aGF0IGEgZmlsZSBpcyBub3QgYSBcInJvb3RcIiAtLS1cbiAgLy8gaWUsIGl0IGNhbiBiZSBpbmNsdWRlZCBmcm9tIG90aGVyIGZpbGVzIGJ1dCBpcyBub3QgcHJvY2Vzc2VkIG9uIGl0cyBvd24uIEluXG4gIC8vIHRoaXMgY2FzZSwgTXVsdGlGaWxlQ2FjaGluZ0NvbXBpbGVyIHdvbid0IHdhc3RlIHRpbWUgdHJ5aW5nIHRvIGxvb2sgZm9yIGFcbiAgLy8gY2FjaGUgZm9yIGl0cyBjb21waWxhdGlvbiBvbiBkaXNrLlxuICBpc1Jvb3QoaW5wdXRGaWxlKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICAvLyBSZXR1cm5zIHRoZSBhYnNvbHV0ZSBpbXBvcnQgcGF0aCBmb3IgYW4gSW5wdXRGaWxlLiBCeSBkZWZhdWx0LCB0aGlzIGlzIGFcbiAgLy8gcGF0aCBpcyBhIHBhdGggb2YgdGhlIGZvcm0gXCJ7cGFja2FnZX0vcGF0aC90by9maWxlXCIgZm9yIGZpbGVzIGluIHBhY2thZ2VzXG4gIC8vIGFuZCBcInt9L3BhdGgvdG8vZmlsZVwiIGZvciBmaWxlcyBpbiBhcHBzLiBZb3VyIHN1YmNsYXNzIG1heSBvdmVycmlkZSBhbmQvb3JcbiAgLy8gY2FsbCB0aGlzIG1ldGhvZC5cbiAgZ2V0QWJzb2x1dGVJbXBvcnRQYXRoKGlucHV0RmlsZSkge1xuICAgIGlmIChpbnB1dEZpbGUuZ2V0UGFja2FnZU5hbWUoKSA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuICd7fS8nICsgaW5wdXRGaWxlLmdldFBhdGhJblBhY2thZ2UoKTtcbiAgICB9XG4gICAgcmV0dXJuICd7JyArIGlucHV0RmlsZS5nZXRQYWNrYWdlTmFtZSgpICsgJ30vJ1xuICAgICAgKyBpbnB1dEZpbGUuZ2V0UGF0aEluUGFja2FnZSgpO1xuICB9XG5cbiAgLy8gVGhlIHByb2Nlc3NGaWxlc0ZvclRhcmdldCBtZXRob2QgZnJvbSB0aGUgUGx1Z2luLnJlZ2lzdGVyQ29tcGlsZXIgQVBJLlxuICBhc3luYyBwcm9jZXNzRmlsZXNGb3JUYXJnZXQoaW5wdXRGaWxlcykge1xuICAgIGNvbnN0IGFsbEZpbGVzID0gbmV3IE1hcDtcbiAgICBjb25zdCBjYWNoZUtleU1hcCA9IG5ldyBNYXA7XG4gICAgY29uc3QgY2FjaGVNaXNzZXMgPSBbXTtcbiAgICBjb25zdCBhcmNoZXMgPSB0aGlzLl9jYWNoZURlYnVnRW5hYmxlZCAmJiBPYmplY3QuY3JlYXRlKG51bGwpO1xuXG4gICAgaW5wdXRGaWxlcy5mb3JFYWNoKChpbnB1dEZpbGUpID0+IHtcbiAgICAgIGNvbnN0IGltcG9ydFBhdGggPSB0aGlzLmdldEFic29sdXRlSW1wb3J0UGF0aChpbnB1dEZpbGUpO1xuICAgICAgYWxsRmlsZXMuc2V0KGltcG9ydFBhdGgsIGlucHV0RmlsZSk7XG4gICAgICBjYWNoZUtleU1hcC5zZXQoaW1wb3J0UGF0aCwgdGhpcy5fZ2V0Q2FjaGVLZXlXaXRoUGF0aChpbnB1dEZpbGUpKTtcbiAgICB9KTtcblxuICAgIGlucHV0RmlsZXMuZm9yRWFjaChpbnB1dEZpbGUgPT4ge1xuICAgICAgaWYgKGFyY2hlcykge1xuICAgICAgICBhcmNoZXNbaW5wdXRGaWxlLmdldEFyY2goKV0gPSAxO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBnZXRSZXN1bHQgPSAoKSA9PiB7XG4gICAgICAgIGNvbnN0IGFic29sdXRlSW1wb3J0UGF0aCA9IHRoaXMuZ2V0QWJzb2x1dGVJbXBvcnRQYXRoKGlucHV0RmlsZSk7XG4gICAgICAgIGNvbnN0IGNhY2hlS2V5ID0gY2FjaGVLZXlNYXAuZ2V0KGFic29sdXRlSW1wb3J0UGF0aCk7XG4gICAgICAgIGxldCBjYWNoZUVudHJ5ID0gdGhpcy5fY2FjaGUuZ2V0KGNhY2hlS2V5KTtcbiAgICAgICAgaWYgKCEgY2FjaGVFbnRyeSkge1xuICAgICAgICAgIGNhY2hlRW50cnkgPSB0aGlzLl9yZWFkQ2FjaGUoY2FjaGVLZXkpO1xuICAgICAgICAgIGlmIChjYWNoZUVudHJ5KSB7XG4gICAgICAgICAgICB0aGlzLl9jYWNoZURlYnVnKGBMb2FkZWQgJHsgYWJzb2x1dGVJbXBvcnRQYXRoIH1gKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoISAoY2FjaGVFbnRyeSAmJiB0aGlzLl9jYWNoZUVudHJ5VmFsaWQoY2FjaGVFbnRyeSwgY2FjaGVLZXlNYXApKSkge1xuICAgICAgICAgIGNhY2hlTWlzc2VzLnB1c2goaW5wdXRGaWxlLmdldERpc3BsYXlQYXRoKCkpO1xuXG4gICAgICAgICAgY29uc3QgY29tcGlsZU9uZUZpbGVSZXR1cm4gPVxuICAgICAgICAgICAgUHJvbWlzZS5hd2FpdCh0aGlzLmNvbXBpbGVPbmVGaWxlKGlucHV0RmlsZSwgYWxsRmlsZXMpKTtcblxuICAgICAgICAgIGlmICghIGNvbXBpbGVPbmVGaWxlUmV0dXJuKSB7XG4gICAgICAgICAgICAvLyBjb21waWxlT25lRmlsZSBzaG91bGQgaGF2ZSBjYWxsZWQgaW5wdXRGaWxlLmVycm9yLlxuICAgICAgICAgICAgLy8gV2UgZG9uJ3QgY2FjaGUgZmFpbHVyZXMgZm9yIG5vdy5cbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCB7XG4gICAgICAgICAgICBjb21waWxlUmVzdWx0LFxuICAgICAgICAgICAgcmVmZXJlbmNlZEltcG9ydFBhdGhzLFxuICAgICAgICAgIH0gPSBjb21waWxlT25lRmlsZVJldHVybjtcblxuICAgICAgICAgIGNhY2hlRW50cnkgPSB7XG4gICAgICAgICAgICBjb21waWxlUmVzdWx0LFxuICAgICAgICAgICAgY2FjaGVLZXlzOiB7XG4gICAgICAgICAgICAgIC8vIEluY2x1ZGUgdGhlIGhhc2hlZCBjYWNoZSBrZXkgb2YgdGhlIGZpbGUgaXRzZWxmLi4uXG4gICAgICAgICAgICAgIFthYnNvbHV0ZUltcG9ydFBhdGhdOiBjYWNoZUtleU1hcC5nZXQoYWJzb2x1dGVJbXBvcnRQYXRoKVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH07XG5cbiAgICAgICAgICAvLyAuLi4gYW5kIG9mIHRoZSBvdGhlciByZWZlcmVuY2VkIGZpbGVzLlxuICAgICAgICAgIHJlZmVyZW5jZWRJbXBvcnRQYXRocy5mb3JFYWNoKChwYXRoKSA9PiB7XG4gICAgICAgICAgICBpZiAoIWNhY2hlS2V5TWFwLmhhcyhwYXRoKSkge1xuICAgICAgICAgICAgICB0aHJvdyBFcnJvcihgVW5rbm93biBhYnNvbHV0ZSBpbXBvcnQgcGF0aCAkeyBwYXRoIH1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhY2hlRW50cnkuY2FjaGVLZXlzW3BhdGhdID0gY2FjaGVLZXlNYXAuZ2V0KHBhdGgpO1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgLy8gU2F2ZSB0aGUgY2FjaGUgZW50cnkuXG4gICAgICAgICAgdGhpcy5fY2FjaGUuc2V0KGNhY2hlS2V5LCBjYWNoZUVudHJ5KTtcbiAgICAgICAgICB0aGlzLl93cml0ZUNhY2hlQXN5bmMoY2FjaGVLZXksIGNhY2hlRW50cnkpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGNhY2hlRW50cnkuY29tcGlsZVJlc3VsdDtcbiAgICAgIH07XG5cbiAgICAgIGlmICh0aGlzLmNvbXBpbGVPbmVGaWxlTGF0ZXIgJiZcbiAgICAgICAgICBpbnB1dEZpbGUuc3VwcG9ydHNMYXp5Q29tcGlsYXRpb24pIHtcbiAgICAgICAgaWYgKCEgdGhpcy5pc1Jvb3QoaW5wdXRGaWxlKSkge1xuICAgICAgICAgIC8vIElmIHRoaXMgaW5wdXRGaWxlIGlzIGRlZmluaXRlbHkgbm90IGEgcm9vdCwgdGhlbiBpdCBtdXN0IGJlXG4gICAgICAgICAgLy8gbGF6eSwgYW5kIHRoaXMgaXMgb3VyIGxhc3QgY2hhbmNlIHRvIG1hcmsgaXQgYXMgc3VjaCwgc28gdGhhdFxuICAgICAgICAgIC8vIHRoZSByZXN0IG9mIHRoZSBjb21waWxlciBwbHVnaW4gc3lzdGVtIGNhbiBhdm9pZCB3b3JyeWluZ1xuICAgICAgICAgIC8vIGFib3V0IHRoZSBNdWx0aUZpbGVDYWNoaW5nQ29tcGlsZXItc3BlY2lmaWMgY29uY2VwdCBvZiBhXG4gICAgICAgICAgLy8gXCJyb290LlwiIElmIHRoaXMuaXNSb290KGlucHV0RmlsZSkgcmV0dXJucyB0cnVlIGluc3RlYWQsIHRoYXRcbiAgICAgICAgICAvLyBjbGFzc2lmaWNhdGlvbiBtYXkgbm90IGJlIHRydXN0d29ydGh5LCBzaW5jZSByZXR1cm5pbmcgdHJ1ZVxuICAgICAgICAgIC8vIHVzZWQgdG8gYmUgdGhlIG9ubHkgd2F5IHRvIGdldCB0aGUgZmlsZSB0byBiZSBjb21waWxlZCwgc29cbiAgICAgICAgICAvLyB0aGF0IGl0IGNvdWxkIGJlIGltcG9ydGVkIGxhdGVyIGJ5IGEgSlMgbW9kdWxlLiBOb3cgdGhhdFxuICAgICAgICAgIC8vIGZpbGVzIGNhbiBiZSBjb21waWxlZCBvbi1kZW1hbmQsIGl0J3Mgc2FmZSB0byBwYXNzIGFsbCBmaWxlc1xuICAgICAgICAgIC8vIHRoYXQgbWlnaHQgYmUgcm9vdHMgdG8gdGhpcy5jb21waWxlT25lRmlsZUxhdGVyLlxuICAgICAgICAgIGlucHV0RmlsZS5nZXRGaWxlT3B0aW9ucygpLmxhenkgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuY29tcGlsZU9uZUZpbGVMYXRlcihpbnB1dEZpbGUsIGdldFJlc3VsdCk7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuaXNSb290KGlucHV0RmlsZSkpIHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gZ2V0UmVzdWx0KCk7XG4gICAgICAgIGlmIChyZXN1bHQpIHtcbiAgICAgICAgICB0aGlzLmFkZENvbXBpbGVSZXN1bHQoaW5wdXRGaWxlLCByZXN1bHQpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBpZiAodGhpcy5fY2FjaGVEZWJ1Z0VuYWJsZWQpIHtcbiAgICAgIHRoaXMuX2FmdGVyTGlua0NhbGxiYWNrcy5wdXNoKCgpID0+IHtcbiAgICAgICAgY2FjaGVNaXNzZXMuc29ydCgpO1xuXG4gICAgICAgIHRoaXMuX2NhY2hlRGVidWcoXG4gICAgICAgICAgYFJhbiAoIyR7XG4gICAgICAgICAgICArK3RoaXMuX2NhbGxDb3VudFxuICAgICAgICAgIH0pIG9uOiAke1xuICAgICAgICAgICAgSlNPTi5zdHJpbmdpZnkoY2FjaGVNaXNzZXMpXG4gICAgICAgICAgfSAke1xuICAgICAgICAgICAgSlNPTi5zdHJpbmdpZnkoT2JqZWN0LmtleXMoYXJjaGVzKS5zb3J0KCkpXG4gICAgICAgICAgfWBcbiAgICAgICAgKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8vIFJldHVybnMgYSBoYXNoIHRoYXQgaW5jb3Jwb3JhdGVzIGJvdGggdGhpcy5nZXRDYWNoZUtleShpbnB1dEZpbGUpIGFuZFxuICAvLyB0aGlzLmdldEFic29sdXRlSW1wb3J0UGF0aChpbnB1dEZpbGUpLCBzaW5jZSB0aGUgZmlsZSBwYXRoIG1pZ2h0IGJlXG4gIC8vIHJlbGV2YW50IHRvIHRoZSBjb21waWxlZCBvdXRwdXQgd2hlbiB1c2luZyBNdWx0aUZpbGVDYWNoaW5nQ29tcGlsZXIuXG4gIF9nZXRDYWNoZUtleVdpdGhQYXRoKGlucHV0RmlsZSkge1xuICAgIHJldHVybiB0aGlzLl9kZWVwSGFzaChbXG4gICAgICB0aGlzLmdldEFic29sdXRlSW1wb3J0UGF0aChpbnB1dEZpbGUpLFxuICAgICAgdGhpcy5nZXRDYWNoZUtleShpbnB1dEZpbGUpLFxuICAgIF0pO1xuICB9XG5cbiAgX2NhY2hlRW50cnlWYWxpZChjYWNoZUVudHJ5LCBjYWNoZUtleU1hcCkge1xuICAgIHJldHVybiBPYmplY3Qua2V5cyhjYWNoZUVudHJ5LmNhY2hlS2V5cykuZXZlcnkoXG4gICAgICAocGF0aCkgPT4gY2FjaGVFbnRyeS5jYWNoZUtleXNbcGF0aF0gPT09IGNhY2hlS2V5TWFwLmdldChwYXRoKVxuICAgICk7XG4gIH1cblxuICAvLyBUaGUgZm9ybWF0IG9mIGEgY2FjaGUgZmlsZSBvbiBkaXNrIGlzIHRoZSBKU09OLXN0cmluZ2lmaWVkIGNhY2hlS2V5c1xuICAvLyBvYmplY3QsIGEgbmV3bGluZSwgZm9sbG93ZWQgYnkgdGhlIENvbXBpbGVSZXN1bHQgYXMgcmV0dXJuZWQgZnJvbVxuICAvLyB0aGlzLnN0cmluZ2lmeUNvbXBpbGVSZXN1bHQuXG4gIF9jYWNoZUZpbGVuYW1lKGNhY2hlS2V5KSB7XG4gICAgcmV0dXJuIHBhdGguam9pbih0aGlzLl9kaXNrQ2FjaGUsIGNhY2hlS2V5ICsgXCIuY2FjaGVcIik7XG4gIH1cblxuICAvLyBMb2FkcyBhIHtjb21waWxlUmVzdWx0LCBjYWNoZUtleXN9IGNhY2hlIGVudHJ5IGZyb20gZGlzay4gUmV0dXJucyB0aGUgd2hvbGVcbiAgLy8gY2FjaGUgZW50cnkgYW5kIGxvYWRzIGl0IGludG8gdGhlIGluLW1lbW9yeSBjYWNoZSB0b28uXG4gIF9yZWFkQ2FjaGUoY2FjaGVLZXkpIHtcbiAgICBpZiAoISB0aGlzLl9kaXNrQ2FjaGUpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBjb25zdCBjYWNoZUZpbGVuYW1lID0gdGhpcy5fY2FjaGVGaWxlbmFtZShjYWNoZUtleSk7XG4gICAgY29uc3QgcmF3ID0gdGhpcy5fcmVhZEZpbGVPck51bGwoY2FjaGVGaWxlbmFtZSk7XG4gICAgaWYgKCFyYXcpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8vIFNwbGl0IG9uIG5ld2xpbmUuXG4gICAgY29uc3QgbmV3bGluZUluZGV4ID0gcmF3LmluZGV4T2YoJ1xcbicpO1xuICAgIGlmIChuZXdsaW5lSW5kZXggPT09IC0xKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgY29uc3QgY2FjaGVLZXlzU3RyaW5nID0gcmF3LnN1YnN0cmluZygwLCBuZXdsaW5lSW5kZXgpO1xuICAgIGNvbnN0IGNvbXBpbGVSZXN1bHRTdHJpbmcgPSByYXcuc3Vic3RyaW5nKG5ld2xpbmVJbmRleCArIDEpO1xuXG4gICAgY29uc3QgY2FjaGVLZXlzID0gdGhpcy5fcGFyc2VKU09OT3JOdWxsKGNhY2hlS2V5c1N0cmluZyk7XG4gICAgaWYgKCFjYWNoZUtleXMpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBjb25zdCBjb21waWxlUmVzdWx0ID0gdGhpcy5wYXJzZUNvbXBpbGVSZXN1bHQoY29tcGlsZVJlc3VsdFN0cmluZyk7XG4gICAgaWYgKCEgY29tcGlsZVJlc3VsdCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3QgY2FjaGVFbnRyeSA9IHtjb21waWxlUmVzdWx0LCBjYWNoZUtleXN9O1xuICAgIHRoaXMuX2NhY2hlLnNldChjYWNoZUtleSwgY2FjaGVFbnRyeSk7XG4gICAgcmV0dXJuIGNhY2hlRW50cnk7XG4gIH1cblxuICBfd3JpdGVDYWNoZUFzeW5jKGNhY2hlS2V5LCBjYWNoZUVudHJ5KSB7XG4gICAgaWYgKCEgdGhpcy5fZGlza0NhY2hlKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgY29uc3QgY2FjaGVGaWxlbmFtZSA9IHRoaXMuX2NhY2hlRmlsZW5hbWUoY2FjaGVLZXkpO1xuICAgIGNvbnN0IGNhY2hlQ29udGVudHMgPVxuICAgICAgSlNPTi5zdHJpbmdpZnkoY2FjaGVFbnRyeS5jYWNoZUtleXMpICsgJ1xcbicgK1xuICAgICAgdGhpcy5zdHJpbmdpZnlDb21waWxlUmVzdWx0KGNhY2hlRW50cnkuY29tcGlsZVJlc3VsdCk7XG4gICAgdGhpcy5fd3JpdGVGaWxlKGNhY2hlRmlsZW5hbWUsIGNhY2hlQ29udGVudHMpO1xuICB9XG59XG4iXX0=
