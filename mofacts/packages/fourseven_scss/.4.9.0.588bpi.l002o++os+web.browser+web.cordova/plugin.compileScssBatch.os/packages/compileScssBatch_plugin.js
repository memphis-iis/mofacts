(function () {

/* Imports */
var CachingCompiler = Package['caching-compiler'].CachingCompiler;
var MultiFileCachingCompiler = Package['caching-compiler'].MultiFileCachingCompiler;
var ECMAScript = Package.ecmascript.ECMAScript;
var meteorInstall = Package.modules.meteorInstall;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;

var require = meteorInstall({"node_modules":{"meteor":{"compileScssBatch":{"plugin":{"compile-scss.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/compileScssBatch/plugin/compile-scss.js                                                                    //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let sass;
module.watch(require("node-sass"), {
  default(v) {
    sass = v;
  }

}, 0);
let Future;
module.watch(require("fibers/future"), {
  default(v) {
    Future = v;
  }

}, 1);
const files = Plugin.files;
const path = Plugin.path;
const fs = Plugin.fs;

let _includePaths;

let _data;

Plugin.registerCompiler({
  extensions: ['scss', 'sass'],
  archMatching: 'web'
}, () => new SassCompiler());

const toPosixPath = function toPosixPath(p, partialPath) {
  // Sometimes, you can have a path like \Users\IEUser on windows, and this
  // actually means you want C:\Users\IEUser
  if (p[0] === "\\" && !partialPath) {
    p = process.env.SystemDrive + p;
  }

  p = p.replace(/\\/g, '/');

  if (p[1] === ':' && !partialPath) {
    // transform "C:/bla/bla" to "/c/bla/bla"
    p = `/${p[0]}${p.slice(2)}`;
  }

  return p;
};

const convertToStandardPath = function convertToStandardPath(osPath, partialPath) {
  if (process.platform === "win32") {
    return toPosixPath(osPath, partialPath);
  }

  return osPath;
}; // CompileResult is {css, sourceMap}.


class SassCompiler extends MultiFileCachingCompiler {
  constructor() {
    super({
      compilerName: 'sass',
      defaultCacheSize: 1024 * 1024 * 10
    });
  }

  getCacheKey(inputFile) {
    return inputFile.getSourceHash();
  }

  compileResultSize(compileResult) {
    return compileResult.css.length + this.sourceMapSize(compileResult.sourceMap);
  } // The heuristic is that a file is an import (ie, is not itself processed as a
  // root) if it matches _*.sass, _*.scss
  // This can be overridden in either direction via an explicit
  // `isImport` file option in api.addFiles.


  isRoot(inputFile) {
    const fileOptions = inputFile.getFileOptions();

    if (fileOptions.hasOwnProperty('isImport')) {
      return !fileOptions.isImport;
    }

    const pathInPackage = inputFile.getPathInPackage();
    return !this.hasUnderscore(pathInPackage);
  }

  hasUnderscore(file) {
    return path.basename(file).startsWith('_');
  }

  compileOneFile(inputFile, allFiles) {
    const referencedImportPaths = [];
    const self = this;
    var totalImportPath = [];
    var sourceMapPaths = [`.${inputFile.getDisplayPath()}`];

    function addUnderscore(file) {
      if (!self.hasUnderscore(file)) {
        file = path.join(path.dirname(file), `_${path.basename(file)}`);
      }

      return file;
    }

    const getRealImportPath = function (importPath) {
      const rawImportPath = importPath;
      const isAbsolute = importPath.startsWith('/'); //SASS has a whole range of possible import files from one import statement, try each of them

      const possibleFiles = []; //If the referenced file has no extension, try possible extensions, starting with extension of the parent file.

      let possibleExtensions = ['scss', 'sass', 'css'];

      if (!importPath.match(/\.s?(a|c)ss$/)) {
        possibleExtensions = [inputFile.getExtension(), ...possibleExtensions.filter(e => e !== inputFile.getExtension())];

        for (const extension of possibleExtensions) {
          possibleFiles.push(`${importPath}.${extension}`);
        }
      } else {
        possibleFiles.push(importPath);
      } //Try files prefixed with underscore


      for (const possibleFile of possibleFiles) {
        if (!self.hasUnderscore(possibleFile)) {
          possibleFiles.push(addUnderscore(possibleFile));
        }
      } //Try if one of the possible files exists


      for (const possibleFile of possibleFiles) {
        if (isAbsolute && fileExists(possibleFile) || !isAbsolute && allFiles.has(possibleFile)) {
          return {
            absolute: isAbsolute,
            path: possibleFile
          };
        }
      } //Nothing found...


      return null;
    }; //Handle import statements found by the sass compiler, used to handle cross-package imports


    const importer = function (url, prev, done) {
      if (!totalImportPath.length) {
        totalImportPath.push(prev);
      }

      if (totalImportPath[totalImportPath.length] !== prev) {
        //backtracked, splice of part we don't need anymore
        // (XXX: this might give problems when multiple parts of the path have the same name)
        totalImportPath.splice(totalImportPath.indexOf(prev) + 1, totalImportPath.length);
      }

      let importPath = url;

      for (let i = totalImportPath.length - 1; i >= 0; i--) {
        if (importPath.startsWith('/') || importPath.startsWith('{')) {
          break;
        }

        importPath = path.join(path.dirname(totalImportPath[i]), importPath);
      }

      totalImportPath.push(url);
      let accPosition = importPath.indexOf('{');

      if (accPosition > -1) {
        importPath = importPath.substr(accPosition, importPath.length);
      }

      try {
        let parsed = getRealImportPath(importPath);

        if (!parsed) {
          parsed = _getRealImportPathFromIncludes(url, getRealImportPath);
        }

        if (!parsed) {
          //Nothing found...
          throw new Error(`File to import: ${url} not found in file: ${totalImportPath[totalImportPath.length - 2]}`);
        }

        if (parsed.absolute) {
          sourceMapPaths.push(parsed.path);
          done({
            contents: fs.readFileSync(parsed.path, 'utf8')
          });
        } else {
          referencedImportPaths.push(parsed.path);
          sourceMapPaths.push(decodeFilePath(parsed.path));
          done({
            contents: allFiles.get(parsed.path).getContentsAsString()
          });
        }
      } catch (e) {
        return done(e);
      }
    }; //Start compile sass (async)


    const f = new Future();
    const options = {
      sourceMap: true,
      sourceMapContents: true,
      sourceMapEmbed: false,
      sourceComments: false,
      omitSourceMapUrl: true,
      sourceMapRoot: '.',
      indentedSyntax: inputFile.getExtension() === 'sass',
      outFile: `.${inputFile.getBasename()}`,
      importer: importer,
      includePaths: []
    };
    options.file = this.getAbsoluteImportPath(inputFile);
    options.data = inputFile.getContentsAsBuffer().toString('utf8'); //If the file is empty, options.data is an empty string
    // In that case options.file will be used by node-sass,
    // which it can not read since it will contain a meteor package or app reference '{}'
    // This is one workaround, another one would be to not set options.file, in which case the importer 'prev' will be 'stdin'
    // However, this would result in problems if a file named stdín.scss would exist.
    // Not the most elegant of solutions, but it works.

    if (!options.data.trim()) {
      options.data = '$fakevariable_ae7bslvbp2yqlfba : blue;';
    } else if (typeof _data === 'string') {
      options.data = _data.concat(options.data);
    }

    let output;

    try {
      sass.render(options, f.resolver());
      output = f.wait();
    } catch (e) {
      inputFile.error({
        message: `Scss compiler error: ${e.formatted}\n`,
        sourcePath: inputFile.getDisplayPath()
      });
      return null;
    } //End compile sass
    //Start fix sourcemap references


    if (output.map) {
      const map = JSON.parse(output.map.toString('utf-8'));
      map.sources = sourceMapPaths;
      output.map = map;
    } //End fix sourcemap references


    const compileResult = {
      css: output.css.toString('utf-8'),
      sourceMap: output.map
    };
    return {
      compileResult,
      referencedImportPaths
    };
  }

  addCompileResult(inputFile, compileResult) {
    inputFile.addStylesheet({
      data: compileResult.css,
      path: `${inputFile.getPathInPackage()}.css`,
      sourceMap: compileResult.sourceMap
    });
  }

}

function _getRealImportPathFromIncludes(importPath, getRealImportPathFn) {
  _prepareNodeSassOptions();

  let possibleFilePath, foundFile;

  for (let includePath of _includePaths) {
    possibleFilePath = path.join(includePath, importPath);
    foundFile = getRealImportPathFn(possibleFilePath);

    if (foundFile) {
      return foundFile;
    }
  }

  return null;
}
/**
 * If not loaded yet, load configuration and includePaths.
 * @private
 */


function _prepareNodeSassOptions() {
  const config = _loadConfigurationFile();

  if (typeof _includePaths === 'undefined' && config.includePaths) {
    _loadIncludePaths(config);
  }

  if (typeof _data === 'undefined' && config.data) {
    _data = config.data;
  }
}
/**
 * Extract the 'includePaths' key from specified configuration, if any, and
 * store it into _includePaths.
 * @param config
 * @private
 */


function _loadIncludePaths(config) {
  // Extract includePaths, if any
  const includePaths = config['includePaths'];

  if (includePaths && Array.isArray(includePaths)) {
    _includePaths = includePaths;
  } else {
    _includePaths = [];
  }
}
/**
 * Read the content of 'scss-config.json' file (if any)
 * @returns {{}}
 * @private
 */


function _loadConfigurationFile() {
  return _getConfig('scss-config.json') || {};
}
/**
 * Build a path from current process working directory (i.e. meteor project
 * root) and specified file name, try to get the file and parse its content.
 * @param configFileName
 * @returns {{}}
 * @private
 */


function _getConfig(configFileName) {
  const appdir = process.env.PWD || process.cwd();
  const custom_config_filename = path.join(appdir, configFileName);
  let userConfig = {};

  if (fileExists(custom_config_filename)) {
    userConfig = fs.readFileSync(custom_config_filename, {
      encoding: 'utf8'
    });
    userConfig = JSON.parse(userConfig);
  } else {//console.warn('Could not find configuration file at ' + custom_config_filename);
  }

  return userConfig;
}

function decodeFilePath(filePath) {
  const match = filePath.match(/{(.*)}\/(.*)$/);

  if (!match) {
    throw new Error(`Failed to decode sass path: ${filePath}`);
  }

  if (match[1] === '') {
    // app
    return match[2];
  }

  return `packages/${match[1]}/${match[2]}`;
}

function fileExists(file) {
  if (fs.statSync) {
    try {
      fs.statSync(file);
    } catch (e) {
      return false;
    }

    return true;
  } else if (fs.existsSync) {
    return fs.existsSync(file);
  }
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"node_modules":{"node-sass":{"package.json":function(require,exports){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/compileScssBatch/node_modules/node-sass/package.json                                            //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
exports.name = "node-sass";
exports.version = "4.9.0";
exports.main = "lib/index.js";

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"lib":{"index.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/compileScssBatch/node_modules/node-sass/lib/index.js                                            //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
/*!
 * node-sass: lib/index.js
 */

var path = require('path'),
  clonedeep = require('lodash.clonedeep'),
  assign = require('lodash.assign'),
  sass = require('./extensions');

/**
 * Require binding
 */

var binding = require('./binding')(sass);

/**
 * Get input file
 *
 * @param {Object} options
 * @api private
 */

function getInputFile(options) {
  return options.file ? path.resolve(options.file) : null;
}

/**
 * Get output file
 *
 * @param {Object} options
 * @api private
 */

function getOutputFile(options) {
  var outFile = options.outFile;

  if (!outFile || typeof outFile !== 'string' || (!options.data && !options.file)) {
    return null;
  }

  return path.resolve(outFile);
}

/**
 * Get source map
 *
 * @param {Object} options
 * @api private
 */

function getSourceMap(options) {
  var sourceMap = options.sourceMap;

  if (sourceMap && typeof sourceMap !== 'string' && options.outFile) {
    sourceMap = options.outFile + '.map';
  }

  return sourceMap && typeof sourceMap === 'string' ? path.resolve(sourceMap) : null;
}

/**
 * Get stats
 *
 * @param {Object} options
 * @api private
 */

function getStats(options) {
  var stats = {};

  stats.entry = options.file || 'data';
  stats.start = Date.now();

  return stats;
}

/**
 * End stats
 *
 * @param {Object} stats
 * @param {Object} sourceMap
 * @api private
 */

function endStats(stats) {
  stats.end = Date.now();
  stats.duration = stats.end - stats.start;

  return stats;
}

/**
 * Get style
 *
 * @param {Object} options
 * @api private
 */

function getStyle(options) {
  var styles = {
    nested: 0,
    expanded: 1,
    compact: 2,
    compressed: 3
  };

  return styles[options.outputStyle] || 0;
}

/**
 * Get indent width
 *
 * @param {Object} options
 * @api private
 */

function getIndentWidth(options) {
  var width = parseInt(options.indentWidth) || 2;

  return width > 10 ? 2 : width;
}

/**
 * Get indent type
 *
 * @param {Object} options
 * @api private
 */

function getIndentType(options) {
  var types = {
    space: 0,
    tab: 1
  };

  return types[options.indentType] || 0;
}

/**
 * Get linefeed
 *
 * @param {Object} options
 * @api private
 */

function getLinefeed(options) {
  var feeds = {
    cr: '\r',
    crlf: '\r\n',
    lf: '\n',
    lfcr: '\n\r'
  };

  return feeds[options.linefeed] || '\n';
}

/**
 * Build an includePaths string
 * from the options.includePaths array and the SASS_PATH environment variable
 *
 * @param {Object} options
 * @api private
 */

function buildIncludePaths(options) {
  options.includePaths = options.includePaths || [];

  if (process.env.hasOwnProperty('SASS_PATH')) {
    options.includePaths = options.includePaths.concat(
      process.env.SASS_PATH.split(path.delimiter)
    );
  }

  // Preserve the behaviour people have come to expect.
  // This behaviour was removed from Sass in 3.4 and
  // LibSass in 3.5.
  options.includePaths.unshift(process.cwd());

  return options.includePaths.join(path.delimiter);
}

/**
 * Get options
 *
 * @param {Object} options
 * @api private
 */

function getOptions(opts, cb) {
  if (typeof opts !== 'object') {
    throw new Error('Invalid: options is not an object.');
  }
  var options = clonedeep(opts || {});

  options.sourceComments = options.sourceComments || false;
  if (options.hasOwnProperty('file')) {
    options.file = getInputFile(options);
  }
  options.outFile = getOutputFile(options);
  options.includePaths = buildIncludePaths(options);
  options.precision = parseInt(options.precision) || 5;
  options.sourceMap = getSourceMap(options);
  options.style = getStyle(options);
  options.indentWidth = getIndentWidth(options);
  options.indentType = getIndentType(options);
  options.linefeed = getLinefeed(options);

  // context object represents node-sass environment
  options.context = { options: options, callback: cb };

  options.result = {
    stats: getStats(options)
  };

  return options;
}

/**
 * Executes a callback and transforms any exception raised into a sass error
 *
 * @param {Function} callback
 * @param {Array} arguments
 * @api private
 */

function tryCallback(callback, args) {
  try {
    return callback.apply(this, args);
  } catch (e) {
    if (typeof e === 'string') {
      return new binding.types.Error(e);
    } else if (e instanceof Error) {
      return new binding.types.Error(e.message);
    } else {
      return new binding.types.Error('An unexpected error occurred');
    }
  }
}

/**
 * Normalizes the signature of custom functions to make it possible to just supply the
 * function name and have the signature default to `fn(...)`. The callback is adjusted
 * to transform the input sass list into discrete arguments.
 *
 * @param {String} signature
 * @param {Function} callback
 * @return {Object}
 * @api private
 */

function normalizeFunctionSignature(signature, callback) {
  if (!/^\*|@warn|@error|@debug|\w+\(.*\)$/.test(signature)) {
    if (!/\w+/.test(signature)) {
      throw new Error('Invalid function signature format "' + signature + '"');
    }

    return {
      signature: signature + '(...)',
      callback: function() {
        var args = Array.prototype.slice.call(arguments),
          list = args.shift(),
          i;

        for (i = list.getLength() - 1; i >= 0; i--) {
          args.unshift(list.getValue(i));
        }

        return callback.apply(this, args);
      }
    };
  }

  return {
    signature: signature,
    callback: callback
  };
}

/**
 * Render
 *
 * @param {Object} options
 * @api public
 */

module.exports.render = function(opts, cb) {
  var options = getOptions(opts, cb);

  // options.error and options.success are for libsass binding
  options.error = function(err) {
    var payload = assign(new Error(), JSON.parse(err));

    if (cb) {
      options.context.callback.call(options.context, payload, null);
    }
  };

  options.success = function() {
    var result = options.result;
    var stats = endStats(result.stats);
    var payload = {
      css: result.css,
      map: result.map,
      stats: stats
    };

    if (cb) {
      options.context.callback.call(options.context, null, payload);
    }
  };

  var importer = options.importer;

  if (importer) {
    if (Array.isArray(importer)) {
      options.importer = [];
      importer.forEach(function(subject, index) {
        options.importer[index] = function(file, prev, bridge) {
          function done(result) {
            bridge.success(result === module.exports.NULL ? null : result);
          }

          var result = subject.call(options.context, file, prev, done);

          if (result !== undefined) {
            done(result);
          }
        };
      });
    } else {
      options.importer = function(file, prev, bridge) {
        function done(result) {
          bridge.success(result === module.exports.NULL ? null : result);
        }

        var result = importer.call(options.context, file, prev, done);

        if (result !== undefined) {
          done(result);
        }
      };
    }
  }

  var functions = clonedeep(options.functions);

  if (functions) {
    options.functions = {};

    Object.keys(functions).forEach(function(subject) {
      var cb = normalizeFunctionSignature(subject, functions[subject]);

      options.functions[cb.signature] = function() {
        var args = Array.prototype.slice.call(arguments),
          bridge = args.pop();

        function done(data) {
          bridge.success(data);
        }

        var result = tryCallback(cb.callback.bind(options.context), args.concat(done));

        if (result) {
          done(result);
        }
      };
    });
  }

  if (options.data) {
    binding.render(options);
  } else if (options.file) {
    binding.renderFile(options);
  } else {
    cb({status: 3, message: 'No input specified: provide a file name or a source string to process' });
  }
};

/**
 * Render sync
 *
 * @param {Object} options
 * @api public
 */

module.exports.renderSync = function(opts) {
  var options = getOptions(opts);
  var importer = options.importer;

  if (importer) {
    if (Array.isArray(importer)) {
      options.importer = [];
      importer.forEach(function(subject, index) {
        options.importer[index] = function(file, prev) {
          var result = subject.call(options.context, file, prev);

          return result === module.exports.NULL ? null : result;
        };
      });
    } else {
      options.importer = function(file, prev) {
        var result = importer.call(options.context, file, prev);

        return result === module.exports.NULL ? null : result;
      };
    }
  }

  var functions = clonedeep(options.functions);

  if (options.functions) {
    options.functions = {};

    Object.keys(functions).forEach(function(signature) {
      var cb = normalizeFunctionSignature(signature, functions[signature]);

      options.functions[cb.signature] = function() {
        return tryCallback(cb.callback.bind(options.context), arguments);
      };
    });
  }

  var status;
  if (options.data) {
    status = binding.renderSync(options);
  } else if (options.file) {
    status = binding.renderFileSync(options);
  } else {
    throw new Error('No input specified: provide a file name or a source string to process');
  }

  var result = options.result;

  if (status) {
    result.stats = endStats(result.stats);
    return result;
  }

  throw assign(new Error(), JSON.parse(result.error));
};

/**
 * API Info
 *
 * @api public
 */

module.exports.info = sass.getVersionInfo(binding);

/**
 * Expose sass types
 */

module.exports.types = binding.types;
module.exports.TRUE = binding.types.Boolean.TRUE;
module.exports.FALSE = binding.types.Boolean.FALSE;
module.exports.NULL = binding.types.Null.NULL;

/**
 * Polyfill the old API
 *
 * TODO: remove for 4.0
 */

function processSassDeprecationMessage() {
  console.log('Deprecation warning: `process.sass` is an undocumented internal that will be removed in future versions of Node Sass.');
}

process.sass = process.sass || {
  get versionInfo()   { processSassDeprecationMessage(); return module.exports.info; },
  get binaryName()    { processSassDeprecationMessage(); return sass.getBinaryName(); },
  get binaryUrl()     { processSassDeprecationMessage(); return sass.getBinaryUrl(); },
  get binaryPath()    { processSassDeprecationMessage(); return sass.getBinaryPath(); },
  get getBinaryPath() { processSassDeprecationMessage(); return sass.getBinaryPath; },
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("/node_modules/meteor/compileScssBatch/plugin/compile-scss.js");

/* Exports */
Package._define("compileScssBatch");

})();







//# sourceURL=meteor://💻app/packages/compileScssBatch_plugin.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvY29tcGlsZVNjc3NCYXRjaC9wbHVnaW4vY29tcGlsZS1zY3NzLmpzIl0sIm5hbWVzIjpbInNhc3MiLCJtb2R1bGUiLCJ3YXRjaCIsInJlcXVpcmUiLCJkZWZhdWx0IiwidiIsIkZ1dHVyZSIsImZpbGVzIiwiUGx1Z2luIiwicGF0aCIsImZzIiwiX2luY2x1ZGVQYXRocyIsIl9kYXRhIiwicmVnaXN0ZXJDb21waWxlciIsImV4dGVuc2lvbnMiLCJhcmNoTWF0Y2hpbmciLCJTYXNzQ29tcGlsZXIiLCJ0b1Bvc2l4UGF0aCIsInAiLCJwYXJ0aWFsUGF0aCIsInByb2Nlc3MiLCJlbnYiLCJTeXN0ZW1Ecml2ZSIsInJlcGxhY2UiLCJzbGljZSIsImNvbnZlcnRUb1N0YW5kYXJkUGF0aCIsIm9zUGF0aCIsInBsYXRmb3JtIiwiTXVsdGlGaWxlQ2FjaGluZ0NvbXBpbGVyIiwiY29uc3RydWN0b3IiLCJjb21waWxlck5hbWUiLCJkZWZhdWx0Q2FjaGVTaXplIiwiZ2V0Q2FjaGVLZXkiLCJpbnB1dEZpbGUiLCJnZXRTb3VyY2VIYXNoIiwiY29tcGlsZVJlc3VsdFNpemUiLCJjb21waWxlUmVzdWx0IiwiY3NzIiwibGVuZ3RoIiwic291cmNlTWFwU2l6ZSIsInNvdXJjZU1hcCIsImlzUm9vdCIsImZpbGVPcHRpb25zIiwiZ2V0RmlsZU9wdGlvbnMiLCJoYXNPd25Qcm9wZXJ0eSIsImlzSW1wb3J0IiwicGF0aEluUGFja2FnZSIsImdldFBhdGhJblBhY2thZ2UiLCJoYXNVbmRlcnNjb3JlIiwiZmlsZSIsImJhc2VuYW1lIiwic3RhcnRzV2l0aCIsImNvbXBpbGVPbmVGaWxlIiwiYWxsRmlsZXMiLCJyZWZlcmVuY2VkSW1wb3J0UGF0aHMiLCJzZWxmIiwidG90YWxJbXBvcnRQYXRoIiwic291cmNlTWFwUGF0aHMiLCJnZXREaXNwbGF5UGF0aCIsImFkZFVuZGVyc2NvcmUiLCJqb2luIiwiZGlybmFtZSIsImdldFJlYWxJbXBvcnRQYXRoIiwiaW1wb3J0UGF0aCIsInJhd0ltcG9ydFBhdGgiLCJpc0Fic29sdXRlIiwicG9zc2libGVGaWxlcyIsInBvc3NpYmxlRXh0ZW5zaW9ucyIsIm1hdGNoIiwiZ2V0RXh0ZW5zaW9uIiwiZmlsdGVyIiwiZSIsImV4dGVuc2lvbiIsInB1c2giLCJwb3NzaWJsZUZpbGUiLCJmaWxlRXhpc3RzIiwiaGFzIiwiYWJzb2x1dGUiLCJpbXBvcnRlciIsInVybCIsInByZXYiLCJkb25lIiwic3BsaWNlIiwiaW5kZXhPZiIsImkiLCJhY2NQb3NpdGlvbiIsInN1YnN0ciIsInBhcnNlZCIsIl9nZXRSZWFsSW1wb3J0UGF0aEZyb21JbmNsdWRlcyIsIkVycm9yIiwiY29udGVudHMiLCJyZWFkRmlsZVN5bmMiLCJkZWNvZGVGaWxlUGF0aCIsImdldCIsImdldENvbnRlbnRzQXNTdHJpbmciLCJmIiwib3B0aW9ucyIsInNvdXJjZU1hcENvbnRlbnRzIiwic291cmNlTWFwRW1iZWQiLCJzb3VyY2VDb21tZW50cyIsIm9taXRTb3VyY2VNYXBVcmwiLCJzb3VyY2VNYXBSb290IiwiaW5kZW50ZWRTeW50YXgiLCJvdXRGaWxlIiwiZ2V0QmFzZW5hbWUiLCJpbmNsdWRlUGF0aHMiLCJnZXRBYnNvbHV0ZUltcG9ydFBhdGgiLCJkYXRhIiwiZ2V0Q29udGVudHNBc0J1ZmZlciIsInRvU3RyaW5nIiwidHJpbSIsImNvbmNhdCIsIm91dHB1dCIsInJlbmRlciIsInJlc29sdmVyIiwid2FpdCIsImVycm9yIiwibWVzc2FnZSIsImZvcm1hdHRlZCIsInNvdXJjZVBhdGgiLCJtYXAiLCJKU09OIiwicGFyc2UiLCJzb3VyY2VzIiwiYWRkQ29tcGlsZVJlc3VsdCIsImFkZFN0eWxlc2hlZXQiLCJnZXRSZWFsSW1wb3J0UGF0aEZuIiwiX3ByZXBhcmVOb2RlU2Fzc09wdGlvbnMiLCJwb3NzaWJsZUZpbGVQYXRoIiwiZm91bmRGaWxlIiwiaW5jbHVkZVBhdGgiLCJjb25maWciLCJfbG9hZENvbmZpZ3VyYXRpb25GaWxlIiwiX2xvYWRJbmNsdWRlUGF0aHMiLCJBcnJheSIsImlzQXJyYXkiLCJfZ2V0Q29uZmlnIiwiY29uZmlnRmlsZU5hbWUiLCJhcHBkaXIiLCJQV0QiLCJjd2QiLCJjdXN0b21fY29uZmlnX2ZpbGVuYW1lIiwidXNlckNvbmZpZyIsImVuY29kaW5nIiwiZmlsZVBhdGgiLCJzdGF0U3luYyIsImV4aXN0c1N5bmMiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLElBQUlBLElBQUo7QUFBU0MsT0FBT0MsS0FBUCxDQUFhQyxRQUFRLFdBQVIsQ0FBYixFQUFrQztBQUFDQyxVQUFRQyxDQUFSLEVBQVU7QUFBQ0wsV0FBS0ssQ0FBTDtBQUFPOztBQUFuQixDQUFsQyxFQUF1RCxDQUF2RDtBQUEwRCxJQUFJQyxNQUFKO0FBQVdMLE9BQU9DLEtBQVAsQ0FBYUMsUUFBUSxlQUFSLENBQWIsRUFBc0M7QUFBQ0MsVUFBUUMsQ0FBUixFQUFVO0FBQUNDLGFBQU9ELENBQVA7QUFBUzs7QUFBckIsQ0FBdEMsRUFBNkQsQ0FBN0Q7QUFHOUUsTUFBTUUsUUFBUUMsT0FBT0QsS0FBckI7QUFDQSxNQUFNRSxPQUFPRCxPQUFPQyxJQUFwQjtBQUNBLE1BQU1DLEtBQUtGLE9BQU9FLEVBQWxCOztBQUVBLElBQUlDLGFBQUo7O0FBQ0EsSUFBSUMsS0FBSjs7QUFFQUosT0FBT0ssZ0JBQVAsQ0FBd0I7QUFDdEJDLGNBQVksQ0FBQyxNQUFELEVBQVMsTUFBVCxDQURVO0FBRXRCQyxnQkFBYztBQUZRLENBQXhCLEVBR0csTUFBTSxJQUFJQyxZQUFKLEVBSFQ7O0FBS0EsTUFBTUMsY0FBYyxTQUFTQSxXQUFULENBQXFCQyxDQUFyQixFQUF3QkMsV0FBeEIsRUFBcUM7QUFDdkQ7QUFDQTtBQUNBLE1BQUlELEVBQUUsQ0FBRixNQUFTLElBQVQsSUFBa0IsQ0FBQ0MsV0FBdkIsRUFBcUM7QUFDbkNELFFBQUlFLFFBQVFDLEdBQVIsQ0FBWUMsV0FBWixHQUEwQkosQ0FBOUI7QUFDRDs7QUFFREEsTUFBSUEsRUFBRUssT0FBRixDQUFV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c291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHNhc3MgZnJvbSAnbm9kZS1zYXNzJztcbmltcG9ydCBGdXR1cmUgZnJvbSAnZmliZXJzL2Z1dHVyZSc7XG5cbmNvbnN0IGZpbGVzID0gUGx1Z2luLmZpbGVzO1xuY29uc3QgcGF0aCA9IFBsdWdpbi5wYXRoO1xuY29uc3QgZnMgPSBQbHVnaW4uZnM7XG5cbmxldCBfaW5jbHVkZVBhdGhzO1xubGV0IF9kYXRhO1xuXG5QbHVnaW4ucmVnaXN0ZXJDb21waWxlcih7XG4gIGV4dGVuc2lvbnM6IFsnc2NzcycsICdzYXNzJ10sXG4gIGFyY2hNYXRjaGluZzogJ3dlYidcbn0sICgpID0+IG5ldyBTYXNzQ29tcGlsZXIoKSk7XG5cbmNvbnN0IHRvUG9zaXhQYXRoID0gZnVuY3Rpb24gdG9Qb3NpeFBhdGgocCwgcGFydGlhbFBhdGgpIHtcbiAgLy8gU29tZXRpbWVzLCB5b3UgY2FuIGhhdmUgYSBwYXRoIGxpa2UgXFxVc2Vyc1xcSUVVc2VyIG9uIHdpbmRvd3MsIGFuZCB0aGlzXG4gIC8vIGFjdHVhbGx5IG1lYW5zIHlvdSB3YW50IEM6XFxVc2Vyc1xcSUVVc2VyXG4gIGlmIChwWzBdID09PSBcIlxcXFxcIiAmJiAoIXBhcnRpYWxQYXRoKSkge1xuICAgIHAgPSBwcm9jZXNzLmVudi5TeXN0ZW1Ecml2ZSArIHA7XG4gIH1cblxuICBwID0gcC5yZXBsYWNlKC9cXFxcL2csICcvJyk7XG4gIGlmIChwWzFdID09PSAnOicgJiYgIXBhcnRpYWxQYXRoKSB7XG4gICAgLy8gdHJhbnNmb3JtIFwiQzovYmxhL2JsYVwiIHRvIFwiL2MvYmxhL2JsYVwiXG4gICAgcCA9IGAvJHtwWzBdfSR7cC5zbGljZSgyKX1gO1xuICB9XG5cbiAgcmV0dXJuIHA7XG59O1xuXG5jb25zdCBjb252ZXJ0VG9TdGFuZGFyZFBhdGggPSBmdW5jdGlvbiBjb252ZXJ0VG9TdGFuZGFyZFBhdGgob3NQYXRoLCBwYXJ0aWFsUGF0aCkge1xuICBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gXCJ3aW4zMlwiKSB7XG4gICAgcmV0dXJuIHRvUG9zaXhQYXRoKG9zUGF0aCwgcGFydGlhbFBhdGgpO1xuICB9XG5cbiAgcmV0dXJuIG9zUGF0aDtcbn1cblxuLy8gQ29tcGlsZVJlc3VsdCBpcyB7Y3NzLCBzb3VyY2VNYXB9LlxuY2xhc3MgU2Fzc0NvbXBpbGVyIGV4dGVuZHMgTXVsdGlGaWxlQ2FjaGluZ0NvbXBpbGVyIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoe1xuICAgICAgY29tcGlsZXJOYW1lOiAnc2FzcycsXG4gICAgICBkZWZhdWx0Q2FjaGVTaXplOiAxMDI0KjEwMjQqMTAsXG4gICAgfSk7XG4gIH1cblxuICBnZXRDYWNoZUtleShpbnB1dEZpbGUpIHtcbiAgICByZXR1cm4gaW5wdXRGaWxlLmdldFNvdXJjZUhhc2goKTtcbiAgfVxuXG4gIGNvbXBpbGVSZXN1bHRTaXplKGNvbXBpbGVSZXN1bHQpIHtcbiAgICByZXR1cm4gY29tcGlsZVJlc3VsdC5jc3MubGVuZ3RoICtcbiAgICAgIHRoaXMuc291cmNlTWFwU2l6ZShjb21waWxlUmVzdWx0LnNvdXJjZU1hcCk7XG4gIH1cblxuICAvLyBUaGUgaGV1cmlzdGljIGlzIHRoYXQgYSBmaWxlIGlzIGFuIGltcG9ydCAoaWUsIGlzIG5vdCBpdHNlbGYgcHJvY2Vzc2VkIGFzIGFcbiAgLy8gcm9vdCkgaWYgaXQgbWF0Y2hlcyBfKi5zYXNzLCBfKi5zY3NzXG4gIC8vIFRoaXMgY2FuIGJlIG92ZXJyaWRkZW4gaW4gZWl0aGVyIGRpcmVjdGlvbiB2aWEgYW4gZXhwbGljaXRcbiAgLy8gYGlzSW1wb3J0YCBmaWxlIG9wdGlvbiBpbiBhcGkuYWRkRmlsZXMuXG4gIGlzUm9vdChpbnB1dEZpbGUpIHtcbiAgICBjb25zdCBmaWxlT3B0aW9ucyA9IGlucHV0RmlsZS5nZXRGaWxlT3B0aW9ucygpO1xuICAgIGlmIChmaWxlT3B0aW9ucy5oYXNPd25Qcm9wZXJ0eSgnaXNJbXBvcnQnKSkge1xuICAgICAgcmV0dXJuICFmaWxlT3B0aW9ucy5pc0ltcG9ydDtcbiAgICB9XG5cbiAgICBjb25zdCBwYXRoSW5QYWNrYWdlID0gaW5wdXRGaWxlLmdldFBhdGhJblBhY2thZ2UoKTtcbiAgICByZXR1cm4gIXRoaXMuaGFzVW5kZXJzY29yZShwYXRoSW5QYWNrYWdlKTtcbiAgfVxuXG4gIGhhc1VuZGVyc2NvcmUoZmlsZSkge1xuICAgIHJldHVybiBwYXRoLmJhc2VuYW1lKGZpbGUpLnN0YXJ0c1dpdGgoJ18nKTtcbiAgfVxuXG4gIGNvbXBpbGVPbmVGaWxlKGlucHV0RmlsZSwgYWxsRmlsZXMpIHtcblxuICAgIGNvbnN0IHJlZmVyZW5jZWRJbXBvcnRQYXRocyA9IFtdO1xuXG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG5cbiAgICB2YXIgdG90YWxJbXBvcnRQYXRoID0gW107XG4gICAgdmFyIHNvdXJjZU1hcFBhdGhzID0gW2AuJHtpbnB1dEZpbGUuZ2V0RGlzcGxheVBhdGgoKX1gXTtcblxuICAgIGZ1bmN0aW9uIGFkZFVuZGVyc2NvcmUoZmlsZSkge1xuICAgICAgaWYgKCFzZWxmLmhhc1VuZGVyc2NvcmUoZmlsZSkpIHtcbiAgICAgICAgZmlsZSA9IHBhdGguam9pbihwYXRoLmRpcm5hbWUoZmlsZSksIGBfJHtwYXRoLmJhc2VuYW1lKGZpbGUpfWApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGZpbGU7XG4gICAgfVxuXG4gICAgY29uc3QgZ2V0UmVhbEltcG9ydFBhdGggPSBmdW5jdGlvbihpbXBvcnRQYXRoKSB7XG4gICAgICBjb25zdCByYXdJbXBvcnRQYXRoID0gaW1wb3J0UGF0aDtcbiAgICAgIGNvbnN0IGlzQWJzb2x1dGUgPSBpbXBvcnRQYXRoLnN0YXJ0c1dpdGgoJy8nKTtcblxuICAgICAgLy9TQVNTIGhhcyBhIHdob2xlIHJhbmdlIG9mIHBvc3NpYmxlIGltcG9ydCBmaWxlcyBmcm9tIG9uZSBpbXBvcnQgc3RhdGVtZW50LCB0cnkgZWFjaCBvZiB0aGVtXG4gICAgICBjb25zdCBwb3NzaWJsZUZpbGVzID0gW107XG5cbiAgICAgIC8vSWYgdGhlIHJlZmVyZW5jZWQgZmlsZSBoYXMgbm8gZXh0ZW5zaW9uLCB0cnkgcG9zc2libGUgZXh0ZW5zaW9ucywgc3RhcnRpbmcgd2l0aCBleHRlbnNpb24gb2YgdGhlIHBhcmVudCBmaWxlLlxuICAgICAgbGV0IHBvc3NpYmxlRXh0ZW5zaW9ucyA9IFsnc2NzcycsJ3Nhc3MnLCdjc3MnXTtcblxuICAgICAgaWYoISBpbXBvcnRQYXRoLm1hdGNoKC9cXC5zPyhhfGMpc3MkLykpe1xuICAgICAgICBwb3NzaWJsZUV4dGVuc2lvbnMgPSBbXG4gICAgICAgICAgaW5wdXRGaWxlLmdldEV4dGVuc2lvbigpLFxuICAgICAgICAgIC4uLnBvc3NpYmxlRXh0ZW5zaW9ucy5maWx0ZXIoZSA9PiBlICE9PSBpbnB1dEZpbGUuZ2V0RXh0ZW5zaW9uKCkpXG4gICAgICAgICAgXVxuICAgICAgICBmb3IgKGNvbnN0IGV4dGVuc2lvbiBvZiBwb3NzaWJsZUV4dGVuc2lvbnMpe1xuICAgICAgICAgIHBvc3NpYmxlRmlsZXMucHVzaChgJHtpbXBvcnRQYXRofS4ke2V4dGVuc2lvbn1gKTtcbiAgICAgICAgfVxuICAgICAgfWVsc2V7XG4gICAgICAgIHBvc3NpYmxlRmlsZXMucHVzaChpbXBvcnRQYXRoKTtcbiAgICAgIH1cblxuICAgICAgLy9UcnkgZmlsZXMgcHJlZml4ZWQgd2l0aCB1bmRlcnNjb3JlXG4gICAgICBmb3IgKGNvbnN0IHBvc3NpYmxlRmlsZSBvZiBwb3NzaWJsZUZpbGVzKSB7XG4gICAgICAgIGlmICghIHNlbGYuaGFzVW5kZXJzY29yZShwb3NzaWJsZUZpbGUpKSB7XG4gICAgICAgICAgcG9zc2libGVGaWxlcy5wdXNoKGFkZFVuZGVyc2NvcmUocG9zc2libGVGaWxlKSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy9UcnkgaWYgb25lIG9mIHRoZSBwb3NzaWJsZSBmaWxlcyBleGlzdHNcbiAgICAgIGZvciAoY29uc3QgcG9zc2libGVGaWxlIG9mIHBvc3NpYmxlRmlsZXMpIHtcbiAgICAgICAgaWYgKChpc0Fic29sdXRlICYmIGZpbGVFeGlzdHMocG9zc2libGVGaWxlKSkgfHwgKCFpc0Fic29sdXRlICYmIGFsbEZpbGVzLmhhcyhwb3NzaWJsZUZpbGUpKSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgYWJzb2x1dGU6IGlzQWJzb2x1dGUsIHBhdGg6IHBvc3NpYmxlRmlsZSB9O1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vTm90aGluZyBmb3VuZC4uLlxuICAgICAgcmV0dXJuIG51bGw7XG5cbiAgICB9O1xuXG4gICAgLy9IYW5kbGUgaW1wb3J0IHN0YXRlbWVudHMgZm91bmQgYnkgdGhlIHNhc3MgY29tcGlsZXIsIHVzZWQgdG8gaGFuZGxlIGNyb3NzLXBhY2thZ2UgaW1wb3J0c1xuICAgIGNvbnN0IGltcG9ydGVyID0gZnVuY3Rpb24odXJsLCBwcmV2LCBkb25lKSB7XG5cbiAgICAgIGlmICghdG90YWxJbXBvcnRQYXRoLmxlbmd0aCkge1xuICAgICAgICB0b3RhbEltcG9ydFBhdGgucHVzaChwcmV2KTtcbiAgICAgIH1cblxuICAgICAgaWYgKHRvdGFsSW1wb3J0UGF0aFt0b3RhbEltcG9ydFBhdGgubGVuZ3RoXSAhPT0gcHJldikge1xuICAgICAgICAvL2JhY2t0cmFja2VkLCBzcGxpY2Ugb2YgcGFydCB3ZSBkb24ndCBuZWVkIGFueW1vcmVcbiAgICAgICAgLy8gKFhYWDogdGhpcyBtaWdodCBnaXZlIHByb2JsZW1zIHdoZW4gbXVsdGlwbGUgcGFydHMgb2YgdGhlIHBhdGggaGF2ZSB0aGUgc2FtZSBuYW1lKVxuICAgICAgICB0b3RhbEltcG9ydFBhdGguc3BsaWNlKHRvdGFsSW1wb3J0UGF0aC5pbmRleE9mKHByZXYpICsgMSwgdG90YWxJbXBvcnRQYXRoLmxlbmd0aCk7XG4gICAgICB9XG5cbiAgICAgIGxldCBpbXBvcnRQYXRoID0gdXJsO1xuICAgICAgZm9yIChsZXQgaSA9IHRvdGFsSW1wb3J0UGF0aC5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgICBpZiAoaW1wb3J0UGF0aC5zdGFydHNXaXRoKCcvJykgfHwgaW1wb3J0UGF0aC5zdGFydHNXaXRoKCd7JykpIHtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBpbXBvcnRQYXRoID0gcGF0aC5qb2luKHBhdGguZGlybmFtZSh0b3RhbEltcG9ydFBhdGhbaV0pLGltcG9ydFBhdGgpO1xuICAgICAgfVxuICAgICAgdG90YWxJbXBvcnRQYXRoLnB1c2godXJsKTtcblxuICAgICAgbGV0IGFjY1Bvc2l0aW9uID0gaW1wb3J0UGF0aC5pbmRleE9mKCd7Jyk7XG4gICAgICBpZiAoYWNjUG9zaXRpb24gPiAtMSkge1xuICAgICAgICBpbXBvcnRQYXRoID0gaW1wb3J0UGF0aC5zdWJzdHIoYWNjUG9zaXRpb24saW1wb3J0UGF0aC5sZW5ndGgpO1xuICAgICAgfVxuXG4gICAgICB0cnkge1xuICAgICAgICBsZXQgcGFyc2VkID0gZ2V0UmVhbEltcG9ydFBhdGgoaW1wb3J0UGF0aCk7XG5cbiAgICAgICAgaWYgKCFwYXJzZWQpIHtcbiAgICAgICAgICBwYXJzZWQgPSBfZ2V0UmVhbEltcG9ydFBhdGhGcm9tSW5jbHVkZXModXJsLCBnZXRSZWFsSW1wb3J0UGF0aCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFwYXJzZWQpIHtcbiAgICAgICAgICAvL05vdGhpbmcgZm91bmQuLi5cbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEZpbGUgdG8gaW1wb3J0OiAke3VybH0gbm90IGZvdW5kIGluIGZpbGU6ICR7dG90YWxJbXBvcnRQYXRoW3RvdGFsSW1wb3J0UGF0aC5sZW5ndGggLSAyXX1gKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChwYXJzZWQuYWJzb2x1dGUpIHtcbiAgICAgICAgICBzb3VyY2VNYXBQYXRocy5wdXNoKHBhcnNlZC5wYXRoKTtcbiAgICAgICAgICBkb25lKHsgY29udGVudHM6IGZzLnJlYWRGaWxlU3luYyhwYXJzZWQucGF0aCwgJ3V0ZjgnKX0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJlZmVyZW5jZWRJbXBvcnRQYXRocy5wdXNoKHBhcnNlZC5wYXRoKTtcbiAgICAgICAgICBzb3VyY2VNYXBQYXRocy5wdXNoKGRlY29kZUZpbGVQYXRoKHBhcnNlZC5wYXRoKSk7XG4gICAgICAgICAgZG9uZSh7IGNvbnRlbnRzOiBhbGxGaWxlcy5nZXQocGFyc2VkLnBhdGgpLmdldENvbnRlbnRzQXNTdHJpbmcoKX0pO1xuICAgICAgICB9XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHJldHVybiBkb25lKGUpO1xuICAgICAgfVxuXG4gICAgfVxuXG4gICAgLy9TdGFydCBjb21waWxlIHNhc3MgKGFzeW5jKVxuICAgIGNvbnN0IGYgPSBuZXcgRnV0dXJlO1xuXG4gICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgIHNvdXJjZU1hcDogICAgICAgICB0cnVlLFxuICAgICAgc291cmNlTWFwQ29udGVudHM6IHRydWUsXG4gICAgICBzb3VyY2VNYXBFbWJlZDogICAgZmFsc2UsXG4gICAgICBzb3VyY2VDb21tZW50czogICAgZmFsc2UsXG4gICAgICBvbWl0U291cmNlTWFwVXJsOiAgdHJ1ZSxcbiAgICAgIHNvdXJjZU1hcFJvb3Q6ICcuJyxcbiAgICAgIGluZGVudGVkU3ludGF4IDogaW5wdXRGaWxlLmdldEV4dGVuc2lvbigpID09PSAnc2FzcycsXG4gICAgICBvdXRGaWxlOiBgLiR7aW5wdXRGaWxlLmdldEJhc2VuYW1lKCl9YCxcbiAgICAgIGltcG9ydGVyOiBpbXBvcnRlcixcbiAgICAgIGluY2x1ZGVQYXRoczogICAgICBbXSxcbiAgICB9O1xuXG4gICAgb3B0aW9ucy5maWxlID0gdGhpcy5nZXRBYnNvbHV0ZUltcG9ydFBhdGgoaW5wdXRGaWxlKTtcblxuICAgIG9wdGlvbnMuZGF0YSA9IGlucHV0RmlsZS5nZXRDb250ZW50c0FzQnVmZmVyKCkudG9TdHJpbmcoJ3V0ZjgnKTtcblxuICAgIC8vSWYgdGhlIGZpbGUgaXMgZW1wdHksIG9wdGlvbnMuZGF0YSBpcyBhbiBlbXB0eSBzdHJpbmdcbiAgICAvLyBJbiB0aGF0IGNhc2Ugb3B0aW9ucy5maWxlIHdpbGwgYmUgdXNlZCBieSBub2RlLXNhc3MsXG4gICAgLy8gd2hpY2ggaXQgY2FuIG5vdCByZWFkIHNpbmNlIGl0IHdpbGwgY29udGFpbiBhIG1ldGVvciBwYWNrYWdlIG9yIGFwcCByZWZlcmVuY2UgJ3t9J1xuICAgIC8vIFRoaXMgaXMgb25lIHdvcmthcm91bmQsIGFub3RoZXIgb25lIHdvdWxkIGJlIHRvIG5vdCBzZXQgb3B0aW9ucy5maWxlLCBpbiB3aGljaCBjYXNlIHRoZSBpbXBvcnRlciAncHJldicgd2lsbCBiZSAnc3RkaW4nXG4gICAgLy8gSG93ZXZlciwgdGhpcyB3b3VsZCByZXN1bHQgaW4gcHJvYmxlbXMgaWYgYSBmaWxlIG5hbWVkIHN0ZMOtbi5zY3NzIHdvdWxkIGV4aXN0LlxuICAgIC8vIE5vdCB0aGUgbW9zdCBlbGVnYW50IG9mIHNvbHV0aW9ucywgYnV0IGl0IHdvcmtzLlxuICAgIGlmICghb3B0aW9ucy5kYXRhLnRyaW0oKSkge1xuICAgICAgb3B0aW9ucy5kYXRhID0gJyRmYWtldmFyaWFibGVfYWU3YnNsdmJwMnlxbGZiYSA6IGJsdWU7JztcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBfZGF0YSA9PT0gJ3N0cmluZycpIHtcbiAgICAgIG9wdGlvbnMuZGF0YSA9IF9kYXRhLmNvbmNhdChvcHRpb25zLmRhdGEpO1xuICAgIH1cblxuICAgIGxldCBvdXRwdXQ7XG4gICAgdHJ5IHtcbiAgICAgIHNhc3MucmVuZGVyKG9wdGlvbnMsZi5yZXNvbHZlcigpKTtcbiAgICAgIG91dHB1dCA9IGYud2FpdCgpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGlucHV0RmlsZS5lcnJvcih7XG4gICAgICAgIG1lc3NhZ2U6IGBTY3NzIGNvbXBpbGVyIGVycm9yOiAke2UuZm9ybWF0dGVkfVxcbmAsXG4gICAgICAgIHNvdXJjZVBhdGg6IGlucHV0RmlsZS5nZXREaXNwbGF5UGF0aCgpXG4gICAgICB9KTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICAvL0VuZCBjb21waWxlIHNhc3NcblxuICAgIC8vU3RhcnQgZml4IHNvdXJjZW1hcCByZWZlcmVuY2VzXG4gICAgaWYgKG91dHB1dC5tYXApIHtcbiAgICAgIGNvbnN0IG1hcCA9IEpTT04ucGFyc2Uob3V0cHV0Lm1hcC50b1N0cmluZygndXRmLTgnKSk7XG4gICAgICBtYXAuc291cmNlcyA9IHNvdXJjZU1hcFBhdGhzO1xuICAgICAgb3V0cHV0Lm1hcCA9IG1hcDtcbiAgICB9XG4gICAgLy9FbmQgZml4IHNvdXJjZW1hcCByZWZlcmVuY2VzXG5cbiAgICBjb25zdCBjb21waWxlUmVzdWx0ID0geyBjc3M6IG91dHB1dC5jc3MudG9TdHJpbmcoJ3V0Zi04JyksIHNvdXJjZU1hcDogb3V0cHV0Lm1hcCB9O1xuICAgIHJldHVybiB7IGNvbXBpbGVSZXN1bHQsIHJlZmVyZW5jZWRJbXBvcnRQYXRocyB9O1xuICB9XG5cbiAgYWRkQ29tcGlsZVJlc3VsdChpbnB1dEZpbGUsIGNvbXBpbGVSZXN1bHQpIHtcbiAgICBpbnB1dEZpbGUuYWRkU3R5bGVzaGVldCh7XG4gICAgICBkYXRhOiBjb21waWxlUmVzdWx0LmNzcyxcbiAgICAgIHBhdGg6IGAke2lucHV0RmlsZS5nZXRQYXRoSW5QYWNrYWdlKCl9LmNzc2AsXG4gICAgICBzb3VyY2VNYXA6IGNvbXBpbGVSZXN1bHQuc291cmNlTWFwLFxuICAgIH0pO1xuICB9XG59XG5cblxuZnVuY3Rpb24gX2dldFJlYWxJbXBvcnRQYXRoRnJvbUluY2x1ZGVzKGltcG9ydFBhdGgsIGdldFJlYWxJbXBvcnRQYXRoRm4pe1xuXG4gIF9wcmVwYXJlTm9kZVNhc3NPcHRpb25zKCk7XG5cbiAgbGV0IHBvc3NpYmxlRmlsZVBhdGgsIGZvdW5kRmlsZTtcblxuICBmb3IgKGxldCBpbmNsdWRlUGF0aCBvZiBfaW5jbHVkZVBhdGhzKSB7XG4gICAgcG9zc2libGVGaWxlUGF0aCA9IHBhdGguam9pbihpbmNsdWRlUGF0aCwgaW1wb3J0UGF0aCk7XG4gICAgZm91bmRGaWxlID0gZ2V0UmVhbEltcG9ydFBhdGhGbihwb3NzaWJsZUZpbGVQYXRoKTtcblxuICAgIGlmIChmb3VuZEZpbGUpIHtcbiAgICAgIHJldHVybiBmb3VuZEZpbGU7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG51bGw7XG59XG5cbi8qKlxuICogSWYgbm90IGxvYWRlZCB5ZXQsIGxvYWQgY29uZmlndXJhdGlvbiBhbmQgaW5jbHVkZVBhdGhzLlxuICogQHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gX3ByZXBhcmVOb2RlU2Fzc09wdGlvbnMoKSB7XG4gIGNvbnN0IGNvbmZpZyA9IF9sb2FkQ29uZmlndXJhdGlvbkZpbGUoKTtcbiAgaWYgKHR5cGVvZiBfaW5jbHVkZVBhdGhzID09PSAndW5kZWZpbmVkJyAmJiBjb25maWcuaW5jbHVkZVBhdGhzKSB7XG4gICAgX2xvYWRJbmNsdWRlUGF0aHMoY29uZmlnKTtcbiAgfVxuICBpZiAodHlwZW9mIF9kYXRhID09PSAndW5kZWZpbmVkJyAmJiBjb25maWcuZGF0YSkge1xuICAgIF9kYXRhID0gY29uZmlnLmRhdGFcbiAgfVxufVxuXG4vKipcbiAqIEV4dHJhY3QgdGhlICdpbmNsdWRlUGF0aHMnIGtleSBmcm9tIHNwZWNpZmllZCBjb25maWd1cmF0aW9uLCBpZiBhbnksIGFuZFxuICogc3RvcmUgaXQgaW50byBfaW5jbHVkZVBhdGhzLlxuICogQHBhcmFtIGNvbmZpZ1xuICogQHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gX2xvYWRJbmNsdWRlUGF0aHMoY29uZmlnKSB7XG4gIC8vIEV4dHJhY3QgaW5jbHVkZVBhdGhzLCBpZiBhbnlcbiAgY29uc3QgaW5jbHVkZVBhdGhzID0gY29uZmlnWydpbmNsdWRlUGF0aHMnXTtcblxuICBpZiAoaW5jbHVkZVBhdGhzICYmIEFycmF5LmlzQXJyYXkoaW5jbHVkZVBhdGhzKSkge1xuICAgIF9pbmNsdWRlUGF0aHMgPSBpbmNsdWRlUGF0aHM7XG4gIH0gZWxzZSB7XG4gICAgX2luY2x1ZGVQYXRocyA9IFtdO1xuICB9XG59XG5cbi8qKlxuICogUmVhZCB0aGUgY29udGVudCBvZiAnc2Nzcy1jb25maWcuanNvbicgZmlsZSAoaWYgYW55KVxuICogQHJldHVybnMge3t9fVxuICogQHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gX2xvYWRDb25maWd1cmF0aW9uRmlsZSgpIHtcbiAgcmV0dXJuIF9nZXRDb25maWcoJ3Njc3MtY29uZmlnLmpzb24nKSB8fCB7fTtcbn1cblxuLyoqXG4gKiBCdWlsZCBhIHBhdGggZnJvbSBjdXJyZW50IHByb2Nlc3Mgd29ya2luZyBkaXJlY3RvcnkgKGkuZS4gbWV0ZW9yIHByb2plY3RcbiAqIHJvb3QpIGFuZCBzcGVjaWZpZWQgZmlsZSBuYW1lLCB0cnkgdG8gZ2V0IHRoZSBmaWxlIGFuZCBwYXJzZSBpdHMgY29udGVudC5cbiAqIEBwYXJhbSBjb25maWdGaWxlTmFtZVxuICogQHJldHVybnMge3t9fVxuICogQHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gX2dldENvbmZpZyhjb25maWdGaWxlTmFtZSkge1xuICBjb25zdCBhcHBkaXIgPSBwcm9jZXNzLmVudi5QV0QgfHwgcHJvY2Vzcy5jd2QoKTtcbiAgY29uc3QgY3VzdG9tX2NvbmZpZ19maWxlbmFtZSA9IHBhdGguam9pbihhcHBkaXIsIGNvbmZpZ0ZpbGVOYW1lKTtcbiAgbGV0IHVzZXJDb25maWcgPSB7fTtcblxuICBpZiAoZmlsZUV4aXN0cyhjdXN0b21fY29uZmlnX2ZpbGVuYW1lKSkge1xuICAgIHVzZXJDb25maWcgPSBmcy5yZWFkRmlsZVN5bmMoY3VzdG9tX2NvbmZpZ19maWxlbmFtZSwge1xuICAgICAgZW5jb2Rpbmc6ICd1dGY4J1xuICAgIH0pO1xuICAgIHVzZXJDb25maWcgPSBKU09OLnBhcnNlKHVzZXJDb25maWcpO1xuICB9IGVsc2Uge1xuICAgIC8vY29uc29sZS53YXJuKCdDb3VsZCBub3QgZmluZCBjb25maWd1cmF0aW9uIGZpbGUgYXQgJyArIGN1c3RvbV9jb25maWdfZmlsZW5hbWUpO1xuICB9XG4gIHJldHVybiB1c2VyQ29uZmlnO1xufVxuXG5mdW5jdGlvbiBkZWNvZGVGaWxlUGF0aCAoZmlsZVBhdGgpIHtcbiAgY29uc3QgbWF0Y2ggPSBmaWxlUGF0aC5tYXRjaCgveyguKil9XFwvKC4qKSQvKTtcbiAgaWYgKCFtYXRjaCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgRmFpbGVkIHRvIGRlY29kZSBzYXNzIHBhdGg6ICR7ZmlsZVBhdGh9YCk7XG4gIH1cblxuICBpZiAobWF0Y2hbMV0gPT09ICcnKSB7XG4gICAgLy8gYXBwXG4gICAgcmV0dXJuIG1hdGNoWzJdO1xuICB9XG5cbiAgcmV0dXJuIGBwYWNrYWdlcy8ke21hdGNoWzFdfS8ke21hdGNoWzJdfWA7XG59XG5cbmZ1bmN0aW9uIGZpbGVFeGlzdHMoZmlsZSkge1xuICBpZiAoZnMuc3RhdFN5bmMpe1xuICAgIHRyeSB7XG4gICAgICBmcy5zdGF0U3luYyhmaWxlKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xuICB9IGVsc2UgaWYgKGZzLmV4aXN0c1N5bmMpIHtcbiAgICByZXR1cm4gZnMuZXhpc3RzU3luYyhmaWxlKTtcbiAgfVxufSJdfQ==
