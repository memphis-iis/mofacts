(function () {

/* Imports */
var CachingCompiler = Package['caching-compiler'].CachingCompiler;
var MultiFileCachingCompiler = Package['caching-compiler'].MultiFileCachingCompiler;
var ECMAScript = Package.ecmascript.ECMAScript;
var meteorInstall = Package.modules.meteorInstall;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;

var require = meteorInstall({"node_modules":{"meteor":{"compileScssBatch":{"plugin":{"compile-scss.js":function(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                   //
// packages/compileScssBatch/plugin/compile-scss.js                                                  //
//                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                     //
let sass;
module.link("node-sass", {
  default(v) {
    sass = v;
  }

}, 0);
let promisify;
module.link("util", {
  promisify(v) {
    promisify = v;
  }

}, 1);
const path = Plugin.path;
const fs = Plugin.fs;
const compileSass = promisify(sass.render);

let _includePaths;

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

  compileOneFileLater(inputFile, getResult) {
    inputFile.addStylesheet({
      path: inputFile.getPathInPackage()
    }, () => Promise.asyncApply(() => {
      const result = Promise.await(getResult());
      return result && {
        data: result.css,
        sourceMap: result.sourceMap
      };
    }));
  }

  compileOneFile(inputFile, allFiles) {
    return Promise.asyncApply(() => {
      const referencedImportPaths = [];
      var totalImportPath = [];
      var sourceMapPaths = [`.${inputFile.getDisplayPath()}`];

      const addUnderscore = file => {
        if (!this.hasUnderscore(file)) {
          file = path.join(path.dirname(file), `_${path.basename(file)}`);
        }

        return file;
      };

      const getRealImportPath = importPath => {
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
          if (!this.hasUnderscore(possibleFile)) {
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


      const options = {
        sourceMap: true,
        sourceMapContents: true,
        sourceMapEmbed: false,
        sourceComments: false,
        omitSourceMapUrl: true,
        sourceMapRoot: '.',
        indentedSyntax: inputFile.getExtension() === 'sass',
        outFile: `.${inputFile.getBasename()}`,
        importer,
        includePaths: [],
        precision: 10
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
      }

      let output;

      try {
        output = Promise.await(compileSass(options));
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
    });
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
///////////////////////////////////////////////////////////////////////////////////////////////////////

}},"node_modules":{"node-sass":{"package.json":function(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                   //
// node_modules/meteor/compileScssBatch/node_modules/node-sass/package.json                          //
//                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                     //
module.exports = {
  "name": "node-sass",
  "version": "4.12.0",
  "main": "lib/index.js"
};

///////////////////////////////////////////////////////////////////////////////////////////////////////

},"lib":{"index.js":function(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                   //
// node_modules/meteor/compileScssBatch/node_modules/node-sass/lib/index.js                          //
//                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                     //
module.useNode();
///////////////////////////////////////////////////////////////////////////////////////////////////////

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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvY29tcGlsZVNjc3NCYXRjaC9wbHVnaW4vY29tcGlsZS1zY3NzLmpzIl0sIm5hbWVzIjpbInNhc3MiLCJtb2R1bGUiLCJsaW5rIiwiZGVmYXVsdCIsInYiLCJwcm9taXNpZnkiLCJwYXRoIiwiUGx1Z2luIiwiZnMiLCJjb21waWxlU2FzcyIsInJlbmRlciIsIl9pbmNsdWRlUGF0aHMiLCJyZWdpc3RlckNvbXBpbGVyIiwiZXh0ZW5zaW9ucyIsImFyY2hNYXRjaGluZyIsIlNhc3NDb21waWxlciIsInRvUG9zaXhQYXRoIiwicCIsInBhcnRpYWxQYXRoIiwicHJvY2VzcyIsImVudiIsIlN5c3RlbURyaXZlIiwicmVwbGFjZSIsInNsaWNlIiwiY29udmVydFRvU3RhbmRhcmRQYXRoIiwib3NQYXRoIiwicGxhdGZvcm0iLCJNdWx0aUZpbGVDYWNoaW5nQ29tcGlsZXIiLCJjb25zdHJ1Y3RvciIsImNvbXBpbGVyTmFtZSIsImRlZmF1bHRDYWNoZVNpemUiLCJnZXRDYWNoZUtleSIsImlucHV0RmlsZSIsImdldFNvdXJjZUhhc2giLCJjb21waWxlUmVzdWx0U2l6ZSIsImNvbXBpbGVSZXN1bHQiLCJjc3MiLCJsZW5ndGgiLCJzb3VyY2VNYXBTaXplIiwic291cmNlTWFwIiwiaXNSb290IiwiZmlsZU9wdGlvbnMiLCJnZXRGaWxlT3B0aW9ucyIsImhhc093blByb3BlcnR5IiwiaXNJbXBvcnQiLCJwYXRoSW5QYWNrYWdlIiwiZ2V0UGF0aEluUGFja2FnZSIsImhhc1VuZGVyc2NvcmUiLCJmaWxlIiwiYmFzZW5hbWUiLCJzdGFydHNXaXRoIiwiY29tcGlsZU9uZUZpbGVMYXRlciIsImdldFJlc3VsdCIsImFkZFN0eWxlc2hlZXQiLCJyZXN1bHQiLCJkYXRhIiwiY29tcGlsZU9uZUZpbGUiLCJhbGxGaWxlcyIsInJlZmVyZW5jZWRJbXBvcnRQYXRocyIsInRvdGFsSW1wb3J0UGF0aCIsInNvdXJjZU1hcFBhdGhzIiwiZ2V0RGlzcGxheVBhdGgiLCJhZGRVbmRlcnNjb3JlIiwiam9pbiIsImRpcm5hbWUiLCJnZXRSZWFsSW1wb3J0UGF0aCIsImltcG9ydFBhdGgiLCJpc0Fic29sdXRlIiwicG9zc2libGVGaWxlcyIsInBvc3NpYmxlRXh0ZW5zaW9ucyIsIm1hdGNoIiwiZ2V0RXh0ZW5zaW9uIiwiZmlsdGVyIiwiZSIsImV4dGVuc2lvbiIsInB1c2giLCJwb3NzaWJsZUZpbGUiLCJmaWxlRXhpc3RzIiwiaGFzIiwiYWJzb2x1dGUiLCJpbXBvcnRlciIsInVybCIsInByZXYiLCJkb25lIiwic3BsaWNlIiwiaW5kZXhPZiIsImkiLCJhY2NQb3NpdGlvbiIsInN1YnN0ciIsInBhcnNlZCIsIl9nZXRSZWFsSW1wb3J0UGF0aEZyb21JbmNsdWRlcyIsIkVycm9yIiwiY29udGVudHMiLCJyZWFkRmlsZVN5bmMiLCJkZWNvZGVGaWxlUGF0aCIsImdldCIsImdldENvbnRlbnRzQXNTdHJpbmciLCJvcHRpb25zIiwic291cmNlTWFwQ29udGVudHMiLCJzb3VyY2VNYXBFbWJlZCIsInNvdXJjZUNvbW1lbnRzIiwib21pdFNvdXJjZU1hcFVybCIsInNvdXJjZU1hcFJvb3QiLCJpbmRlbnRlZFN5bnRheCIsIm91dEZpbGUiLCJnZXRCYXNlbmFtZSIsImluY2x1ZGVQYXRocyIsInByZWNpc2lvbiIsImdldEFic29sdXRlSW1wb3J0UGF0aCIsImdldENvbnRlbnRzQXNCdWZmZXIiLCJ0b1N0cmluZyIsInRyaW0iLCJvdXRwdXQiLCJlcnJvciIsIm1lc3NhZ2UiLCJmb3JtYXR0ZWQiLCJzb3VyY2VQYXRoIiwibWFwIiwiSlNPTiIsInBhcnNlIiwic291cmNlcyIsImFkZENvbXBpbGVSZXN1bHQiLCJnZXRSZWFsSW1wb3J0UGF0aEZuIiwiX3ByZXBhcmVOb2RlU2Fzc09wdGlvbnMiLCJwb3NzaWJsZUZpbGVQYXRoIiwiZm91bmRGaWxlIiwiaW5jbHVkZVBhdGgiLCJjb25maWciLCJfbG9hZENvbmZpZ3VyYXRpb25GaWxlIiwiX2xvYWRJbmNsdWRlUGF0aHMiLCJBcnJheSIsImlzQXJyYXkiLCJfZ2V0Q29uZmlnIiwiY29uZmlnRmlsZU5hbWUiLCJhcHBkaXIiLCJQV0QiLCJjd2QiLCJjdXN0b21fY29uZmlnX2ZpbGVuYW1lIiwidXNlckNvbmZpZyIsImVuY29kaW5nIiwiZmlsZVBhdGgiLCJzdGF0U3luYyIsImV4aXN0c1N5bmMiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLElBQUlBLElBQUo7QUFBU0MsTUFBTSxDQUFDQyxJQUFQLENBQVksV0FBWixFQUF3QjtBQUFDQyxTQUFPLENBQUNDLENBQUQsRUFBRztBQUFDSixRQUFJLEdBQUNJLENBQUw7QUFBTzs7QUFBbkIsQ0FBeEIsRUFBNkMsQ0FBN0M7QUFBZ0QsSUFBSUMsU0FBSjtBQUFjSixNQUFNLENBQUNDLElBQVAsQ0FBWSxNQUFaLEVBQW1CO0FBQUNHLFdBQVMsQ0FBQ0QsQ0FBRCxFQUFHO0FBQUNDLGFBQVMsR0FBQ0QsQ0FBVjtBQUFZOztBQUExQixDQUFuQixFQUErQyxDQUEvQztBQUV2RSxNQUFNRSxJQUFJLEdBQUdDLE1BQU0sQ0FBQ0QsSUFBcEI7QUFDQSxNQUFNRSxFQUFFLEdBQUdELE1BQU0sQ0FBQ0MsRUFBbEI7QUFFQSxNQUFNQyxXQUFXLEdBQUdKLFNBQVMsQ0FBQ0wsSUFBSSxDQUFDVSxNQUFOLENBQTdCOztBQUNBLElBQUlDLGFBQUo7O0FBRUFKLE1BQU0sQ0FBQ0ssZ0JBQVAsQ0FBd0I7QUFDdEJDLFlBQVUsRUFBRSxDQUFDLE1BQUQsRUFBUyxNQUFULENBRFU7QUFFdEJDLGNBQVksRUFBRTtBQUZRLENBQXhCLEVBR0csTUFBTSxJQUFJQyxZQUFKLEVBSFQ7O0FBS0EsTUFBTUMsV0FBVyxHQUFHLFNBQVNBLFdBQVQsQ0FBcUJDLENBQXJCLEVBQXdCQyxXQUF4QixFQUFxQztBQUN2RDtBQUNBO0FBQ0EsTUFBSUQsQ0FBQyxDQUFDLENBQUQsQ0FBRCxLQUFTLElBQVQsSUFBa0IsQ0FBQ0MsV0FBdkIsRUFBcUM7QUFDbkNELEtBQUMsR0FBR0UsT0FBTyxD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LENBQWM5RixJQUFkLENBQVA7QUFDRDtBQUNGLEMiLCJmaWxlIjoiL3BhY2thZ2VzL2NvbXBpbGVTY3NzQmF0Y2hfcGx1Z2luLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHNhc3MgZnJvbSAnbm9kZS1zYXNzJztcbmltcG9ydCB7IHByb21pc2lmeSB9IGZyb20gJ3V0aWwnO1xuY29uc3QgcGF0aCA9IFBsdWdpbi5wYXRoO1xuY29uc3QgZnMgPSBQbHVnaW4uZnM7XG5cbmNvbnN0IGNvbXBpbGVTYXNzID0gcHJvbWlzaWZ5KHNhc3MucmVuZGVyKTtcbmxldCBfaW5jbHVkZVBhdGhzO1xuXG5QbHVnaW4ucmVnaXN0ZXJDb21waWxlcih7XG4gIGV4dGVuc2lvbnM6IFsnc2NzcycsICdzYXNzJ10sXG4gIGFyY2hNYXRjaGluZzogJ3dlYidcbn0sICgpID0+IG5ldyBTYXNzQ29tcGlsZXIoKSk7XG5cbmNvbnN0IHRvUG9zaXhQYXRoID0gZnVuY3Rpb24gdG9Qb3NpeFBhdGgocCwgcGFydGlhbFBhdGgpIHtcbiAgLy8gU29tZXRpbWVzLCB5b3UgY2FuIGhhdmUgYSBwYXRoIGxpa2UgXFxVc2Vyc1xcSUVVc2VyIG9uIHdpbmRvd3MsIGFuZCB0aGlzXG4gIC8vIGFjdHVhbGx5IG1lYW5zIHlvdSB3YW50IEM6XFxVc2Vyc1xcSUVVc2VyXG4gIGlmIChwWzBdID09PSBcIlxcXFxcIiAmJiAoIXBhcnRpYWxQYXRoKSkge1xuICAgIHAgPSBwcm9jZXNzLmVudi5TeXN0ZW1Ecml2ZSArIHA7XG4gIH1cblxuICBwID0gcC5yZXBsYWNlKC9cXFxcL2csICcvJyk7XG4gIGlmIChwWzFdID09PSAnOicgJiYgIXBhcnRpYWxQYXRoKSB7XG4gICAgLy8gdHJhbnNmb3JtIFwiQzovYmxhL2JsYVwiIHRvIFwiL2MvYmxhL2JsYVwiXG4gICAgcCA9IGAvJHtwWzBdfSR7cC5zbGljZSgyKX1gO1xuICB9XG5cbiAgcmV0dXJuIHA7XG59O1xuXG5jb25zdCBjb252ZXJ0VG9TdGFuZGFyZFBhdGggPSBmdW5jdGlvbiBjb252ZXJ0VG9TdGFuZGFyZFBhdGgob3NQYXRoLCBwYXJ0aWFsUGF0aCkge1xuICBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gXCJ3aW4zMlwiKSB7XG4gICAgcmV0dXJuIHRvUG9zaXhQYXRoKG9zUGF0aCwgcGFydGlhbFBhdGgpO1xuICB9XG5cbiAgcmV0dXJuIG9zUGF0aDtcbn1cblxuLy8gQ29tcGlsZVJlc3VsdCBpcyB7Y3NzLCBzb3VyY2VNYXB9LlxuY2xhc3MgU2Fzc0NvbXBpbGVyIGV4dGVuZHMgTXVsdGlGaWxlQ2FjaGluZ0NvbXBpbGVyIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoe1xuICAgICAgY29tcGlsZXJOYW1lOiAnc2FzcycsXG4gICAgICBkZWZhdWx0Q2FjaGVTaXplOiAxMDI0KjEwMjQqMTAsXG4gICAgfSk7XG4gIH1cblxuICBnZXRDYWNoZUtleShpbnB1dEZpbGUpIHtcbiAgICByZXR1cm4gaW5wdXRGaWxlLmdldFNvdXJjZUhhc2goKTtcbiAgfVxuXG4gIGNvbXBpbGVSZXN1bHRTaXplKGNvbXBpbGVSZXN1bHQpIHtcbiAgICByZXR1cm4gY29tcGlsZVJlc3VsdC5jc3MubGVuZ3RoICtcbiAgICAgIHRoaXMuc291cmNlTWFwU2l6ZShjb21waWxlUmVzdWx0LnNvdXJjZU1hcCk7XG4gIH1cblxuICAvLyBUaGUgaGV1cmlzdGljIGlzIHRoYXQgYSBmaWxlIGlzIGFuIGltcG9ydCAoaWUsIGlzIG5vdCBpdHNlbGYgcHJvY2Vzc2VkIGFzIGFcbiAgLy8gcm9vdCkgaWYgaXQgbWF0Y2hlcyBfKi5zYXNzLCBfKi5zY3NzXG4gIC8vIFRoaXMgY2FuIGJlIG92ZXJyaWRkZW4gaW4gZWl0aGVyIGRpcmVjdGlvbiB2aWEgYW4gZXhwbGljaXRcbiAgLy8gYGlzSW1wb3J0YCBmaWxlIG9wdGlvbiBpbiBhcGkuYWRkRmlsZXMuXG4gIGlzUm9vdChpbnB1dEZpbGUpIHtcbiAgICBjb25zdCBmaWxlT3B0aW9ucyA9IGlucHV0RmlsZS5nZXRGaWxlT3B0aW9ucygpO1xuXG4gICAgaWYgKGZpbGVPcHRpb25zLmhhc093blByb3BlcnR5KCdpc0ltcG9ydCcpKSB7XG4gICAgICByZXR1cm4gIWZpbGVPcHRpb25zLmlzSW1wb3J0O1xuICAgIH1cblxuICAgIGNvbnN0IHBhdGhJblBhY2thZ2UgPSBpbnB1dEZpbGUuZ2V0UGF0aEluUGFja2FnZSgpO1xuICAgIHJldHVybiAhdGhpcy5oYXNVbmRlcnNjb3JlKHBhdGhJblBhY2thZ2UpO1xuICB9XG5cbiAgaGFzVW5kZXJzY29yZShmaWxlKSB7XG4gICAgcmV0dXJuIHBhdGguYmFzZW5hbWUoZmlsZSkuc3RhcnRzV2l0aCgnXycpO1xuICB9XG5cbiAgY29tcGlsZU9uZUZpbGVMYXRlcihpbnB1dEZpbGUsIGdldFJlc3VsdCkge1xuICAgIGlucHV0RmlsZS5hZGRTdHlsZXNoZWV0KHtcbiAgICAgIHBhdGg6IGlucHV0RmlsZS5nZXRQYXRoSW5QYWNrYWdlKCksXG4gICAgfSwgYXN5bmMgKCkgPT4ge1xuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZ2V0UmVzdWx0KCk7XG4gICAgICByZXR1cm4gcmVzdWx0ICYmIHtcbiAgICAgICAgZGF0YTogcmVzdWx0LmNzcyxcbiAgICAgICAgc291cmNlTWFwOiByZXN1bHQuc291cmNlTWFwLFxuICAgICAgICB9O1xuICAgIH0pO1xuICB9XG5cbiAgYXN5bmMgY29tcGlsZU9uZUZpbGUoaW5wdXRGaWxlLCBhbGxGaWxlcykge1xuXG4gICAgY29uc3QgcmVmZXJlbmNlZEltcG9ydFBhdGhzID0gW107XG5cbiAgICB2YXIgdG90YWxJbXBvcnRQYXRoID0gW107XG4gICAgdmFyIHNvdXJjZU1hcFBhdGhzID0gW2AuJHtpbnB1dEZpbGUuZ2V0RGlzcGxheVBhdGgoKX1gXTtcblxuICAgIGNvbnN0IGFkZFVuZGVyc2NvcmUgPSAoZmlsZSkgPT4ge1xuICAgICAgaWYgKCF0aGlzLmhhc1VuZGVyc2NvcmUoZmlsZSkpIHtcbiAgICAgICAgZmlsZSA9IHBhdGguam9pbihwYXRoLmRpcm5hbWUoZmlsZSksIGBfJHtwYXRoLmJhc2VuYW1lKGZpbGUpfWApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGZpbGU7XG4gICAgfVxuXG4gICAgY29uc3QgZ2V0UmVhbEltcG9ydFBhdGggPSAoaW1wb3J0UGF0aCkgPT4ge1xuICAgICAgY29uc3QgaXNBYnNvbHV0ZSA9IGltcG9ydFBhdGguc3RhcnRzV2l0aCgnLycpO1xuXG4gICAgICAvL1NBU1MgaGFzIGEgd2hvbGUgcmFuZ2Ugb2YgcG9zc2libGUgaW1wb3J0IGZpbGVzIGZyb20gb25lIGltcG9ydCBzdGF0ZW1lbnQsIHRyeSBlYWNoIG9mIHRoZW1cbiAgICAgIGNvbnN0IHBvc3NpYmxlRmlsZXMgPSBbXTtcblxuICAgICAgLy9JZiB0aGUgcmVmZXJlbmNlZCBmaWxlIGhhcyBubyBleHRlbnNpb24sIHRyeSBwb3NzaWJsZSBleHRlbnNpb25zLCBzdGFydGluZyB3aXRoIGV4dGVuc2lvbiBvZiB0aGUgcGFyZW50IGZpbGUuXG4gICAgICBsZXQgcG9zc2libGVFeHRlbnNpb25zID0gWydzY3NzJywnc2FzcycsJ2NzcyddO1xuXG4gICAgICBpZighIGltcG9ydFBhdGgubWF0Y2goL1xcLnM/KGF8YylzcyQvKSl7XG4gICAgICAgIHBvc3NpYmxlRXh0ZW5zaW9ucyA9IFtcbiAgICAgICAgICBpbnB1dEZpbGUuZ2V0RXh0ZW5zaW9uKCksXG4gICAgICAgICAgLi4ucG9zc2libGVFeHRlbnNpb25zLmZpbHRlcihlID0+IGUgIT09IGlucHV0RmlsZS5nZXRFeHRlbnNpb24oKSlcbiAgICAgICAgICBdXG4gICAgICAgIGZvciAoY29uc3QgZXh0ZW5zaW9uIG9mIHBvc3NpYmxlRXh0ZW5zaW9ucyl7XG4gICAgICAgICAgcG9zc2libGVGaWxlcy5wdXNoKGAke2ltcG9ydFBhdGh9LiR7ZXh0ZW5zaW9ufWApO1xuICAgICAgICB9XG4gICAgICB9ZWxzZXtcbiAgICAgICAgcG9zc2libGVGaWxlcy5wdXNoKGltcG9ydFBhdGgpO1xuICAgICAgfVxuXG4gICAgICAvL1RyeSBmaWxlcyBwcmVmaXhlZCB3aXRoIHVuZGVyc2NvcmVcbiAgICAgIGZvciAoY29uc3QgcG9zc2libGVGaWxlIG9mIHBvc3NpYmxlRmlsZXMpIHtcbiAgICAgICAgaWYgKCEgdGhpcy5oYXNVbmRlcnNjb3JlKHBvc3NpYmxlRmlsZSkpIHtcbiAgICAgICAgICBwb3NzaWJsZUZpbGVzLnB1c2goYWRkVW5kZXJzY29yZShwb3NzaWJsZUZpbGUpKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvL1RyeSBpZiBvbmUgb2YgdGhlIHBvc3NpYmxlIGZpbGVzIGV4aXN0c1xuICAgICAgZm9yIChjb25zdCBwb3NzaWJsZUZpbGUgb2YgcG9zc2libGVGaWxlcykge1xuICAgICAgICBpZiAoKGlzQWJzb2x1dGUgJiYgZmlsZUV4aXN0cyhwb3NzaWJsZUZpbGUpKSB8fCAoIWlzQWJzb2x1dGUgJiYgYWxsRmlsZXMuaGFzKHBvc3NpYmxlRmlsZSkpKSB7XG4gICAgICAgICAgICByZXR1cm4geyBhYnNvbHV0ZTogaXNBYnNvbHV0ZSwgcGF0aDogcG9zc2libGVGaWxlIH07XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy9Ob3RoaW5nIGZvdW5kLi4uXG4gICAgICByZXR1cm4gbnVsbDtcblxuICAgIH07XG5cbiAgICAvL0hhbmRsZSBpbXBvcnQgc3RhdGVtZW50cyBmb3VuZCBieSB0aGUgc2FzcyBjb21waWxlciwgdXNlZCB0byBoYW5kbGUgY3Jvc3MtcGFja2FnZSBpbXBvcnRzXG4gICAgY29uc3QgaW1wb3J0ZXIgPSBmdW5jdGlvbih1cmwsIHByZXYsIGRvbmUpIHtcblxuICAgICAgaWYgKCF0b3RhbEltcG9ydFBhdGgubGVuZ3RoKSB7XG4gICAgICAgIHRvdGFsSW1wb3J0UGF0aC5wdXNoKHByZXYpO1xuICAgICAgfVxuXG4gICAgICBpZiAodG90YWxJbXBvcnRQYXRoW3RvdGFsSW1wb3J0UGF0aC5sZW5ndGhdICE9PSBwcmV2KSB7XG4gICAgICAgIC8vYmFja3RyYWNrZWQsIHNwbGljZSBvZiBwYXJ0IHdlIGRvbid0IG5lZWQgYW55bW9yZVxuICAgICAgICAvLyAoWFhYOiB0aGlzIG1pZ2h0IGdpdmUgcHJvYmxlbXMgd2hlbiBtdWx0aXBsZSBwYXJ0cyBvZiB0aGUgcGF0aCBoYXZlIHRoZSBzYW1lIG5hbWUpXG4gICAgICAgIHRvdGFsSW1wb3J0UGF0aC5zcGxpY2UodG90YWxJbXBvcnRQYXRoLmluZGV4T2YocHJldikgKyAxLCB0b3RhbEltcG9ydFBhdGgubGVuZ3RoKTtcbiAgICAgIH1cblxuICAgICAgbGV0IGltcG9ydFBhdGggPSB1cmw7XG4gICAgICBmb3IgKGxldCBpID0gdG90YWxJbXBvcnRQYXRoLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgIGlmIChpbXBvcnRQYXRoLnN0YXJ0c1dpdGgoJy8nKSB8fCBpbXBvcnRQYXRoLnN0YXJ0c1dpdGgoJ3snKSkge1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGltcG9ydFBhdGggPSBwYXRoLmpvaW4ocGF0aC5kaXJuYW1lKHRvdGFsSW1wb3J0UGF0aFtpXSksaW1wb3J0UGF0aCk7XG4gICAgICB9XG4gICAgICB0b3RhbEltcG9ydFBhdGgucHVzaCh1cmwpO1xuXG4gICAgICBsZXQgYWNjUG9zaXRpb24gPSBpbXBvcnRQYXRoLmluZGV4T2YoJ3snKTtcbiAgICAgIGlmIChhY2NQb3NpdGlvbiA+IC0xKSB7XG4gICAgICAgIGltcG9ydFBhdGggPSBpbXBvcnRQYXRoLnN1YnN0cihhY2NQb3NpdGlvbixpbXBvcnRQYXRoLmxlbmd0aCk7XG4gICAgICB9XG5cbiAgICAgIHRyeSB7XG4gICAgICAgIGxldCBwYXJzZWQgPSBnZXRSZWFsSW1wb3J0UGF0aChpbXBvcnRQYXRoKTtcblxuICAgICAgICBpZiAoIXBhcnNlZCkge1xuICAgICAgICAgIHBhcnNlZCA9IF9nZXRSZWFsSW1wb3J0UGF0aEZyb21JbmNsdWRlcyh1cmwsIGdldFJlYWxJbXBvcnRQYXRoKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIXBhcnNlZCkge1xuICAgICAgICAgIC8vTm90aGluZyBmb3VuZC4uLlxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgRmlsZSB0byBpbXBvcnQ6ICR7dXJsfSBub3QgZm91bmQgaW4gZmlsZTogJHt0b3RhbEltcG9ydFBhdGhbdG90YWxJbXBvcnRQYXRoLmxlbmd0aCAtIDJdfWApO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHBhcnNlZC5hYnNvbHV0ZSkge1xuICAgICAgICAgIHNvdXJjZU1hcFBhdGhzLnB1c2gocGFyc2VkLnBhdGgpO1xuICAgICAgICAgIGRvbmUoeyBjb250ZW50czogZnMucmVhZEZpbGVTeW5jKHBhcnNlZC5wYXRoLCAndXRmOCcpfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmVmZXJlbmNlZEltcG9ydFBhdGhzLnB1c2gocGFyc2VkLnBhdGgpO1xuICAgICAgICAgIHNvdXJjZU1hcFBhdGhzLnB1c2goZGVjb2RlRmlsZVBhdGgocGFyc2VkLnBhdGgpKTtcbiAgICAgICAgICBkb25lKHsgY29udGVudHM6IGFsbEZpbGVzLmdldChwYXJzZWQucGF0aCkuZ2V0Q29udGVudHNBc1N0cmluZygpfSk7XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgcmV0dXJuIGRvbmUoZSk7XG4gICAgICB9XG5cbiAgICB9XG5cbiAgICAvL1N0YXJ0IGNvbXBpbGUgc2FzcyAoYXN5bmMpXG4gICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgIHNvdXJjZU1hcDogdHJ1ZSxcbiAgICAgIHNvdXJjZU1hcENvbnRlbnRzOiB0cnVlLFxuICAgICAgc291cmNlTWFwRW1iZWQ6IGZhbHNlLFxuICAgICAgc291cmNlQ29tbWVudHM6IGZhbHNlLFxuICAgICAgb21pdFNvdXJjZU1hcFVybDogdHJ1ZSxcbiAgICAgIHNvdXJjZU1hcFJvb3Q6ICcuJyxcbiAgICAgIGluZGVudGVkU3ludGF4IDogaW5wdXRGaWxlLmdldEV4dGVuc2lvbigpID09PSAnc2FzcycsXG4gICAgICBvdXRGaWxlOiBgLiR7aW5wdXRGaWxlLmdldEJhc2VuYW1lKCl9YCxcbiAgICAgIGltcG9ydGVyLFxuICAgICAgaW5jbHVkZVBhdGhzOiBbXSxcbiAgICAgIHByZWNpc2lvbjogMTAsXG4gICAgfTtcblxuICAgIG9wdGlvbnMuZmlsZSA9IHRoaXMuZ2V0QWJzb2x1dGVJbXBvcnRQYXRoKGlucHV0RmlsZSk7XG5cbiAgICBvcHRpb25zLmRhdGEgPSBpbnB1dEZpbGUuZ2V0Q29udGVudHNBc0J1ZmZlcigpLnRvU3RyaW5nKCd1dGY4Jyk7XG5cbiAgICAvL0lmIHRoZSBmaWxlIGlzIGVtcHR5LCBvcHRpb25zLmRhdGEgaXMgYW4gZW1wdHkgc3RyaW5nXG4gICAgLy8gSW4gdGhhdCBjYXNlIG9wdGlvbnMuZmlsZSB3aWxsIGJlIHVzZWQgYnkgbm9kZS1zYXNzLFxuICAgIC8vIHdoaWNoIGl0IGNhbiBub3QgcmVhZCBzaW5jZSBpdCB3aWxsIGNvbnRhaW4gYSBtZXRlb3IgcGFja2FnZSBvciBhcHAgcmVmZXJlbmNlICd7fSdcbiAgICAvLyBUaGlzIGlzIG9uZSB3b3JrYXJvdW5kLCBhbm90aGVyIG9uZSB3b3VsZCBiZSB0byBub3Qgc2V0IG9wdGlvbnMuZmlsZSwgaW4gd2hpY2ggY2FzZSB0aGUgaW1wb3J0ZXIgJ3ByZXYnIHdpbGwgYmUgJ3N0ZGluJ1xuICAgIC8vIEhvd2V2ZXIsIHRoaXMgd291bGQgcmVzdWx0IGluIHByb2JsZW1zIGlmIGEgZmlsZSBuYW1lZCBzdGTDrW4uc2NzcyB3b3VsZCBleGlzdC5cbiAgICAvLyBOb3QgdGhlIG1vc3QgZWxlZ2FudCBvZiBzb2x1dGlvbnMsIGJ1dCBpdCB3b3Jrcy5cbiAgICBpZiAoIW9wdGlvbnMuZGF0YS50cmltKCkpIHtcbiAgICAgIG9wdGlvbnMuZGF0YSA9ICckZmFrZXZhcmlhYmxlX2FlN2JzbHZicDJ5cWxmYmEgOiBibHVlOyc7XG4gICAgfVxuXG4gICAgbGV0IG91dHB1dDtcbiAgICB0cnkge1xuICAgICAgb3V0cHV0ID0gYXdhaXQgY29tcGlsZVNhc3Mob3B0aW9ucyk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgaW5wdXRGaWxlLmVycm9yKHtcbiAgICAgICAgbWVzc2FnZTogYFNjc3MgY29tcGlsZXIgZXJyb3I6ICR7ZS5mb3JtYXR0ZWR9XFxuYCxcbiAgICAgICAgc291cmNlUGF0aDogaW5wdXRGaWxlLmdldERpc3BsYXlQYXRoKClcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIC8vRW5kIGNvbXBpbGUgc2Fzc1xuXG4gICAgLy9TdGFydCBmaXggc291cmNlbWFwIHJlZmVyZW5jZXNcbiAgICBpZiAob3V0cHV0Lm1hcCkge1xuICAgICAgY29uc3QgbWFwID0gSlNPTi5wYXJzZShvdXRwdXQubWFwLnRvU3RyaW5nKCd1dGYtOCcpKTtcbiAgICAgIG1hcC5zb3VyY2VzID0gc291cmNlTWFwUGF0aHM7XG4gICAgICBvdXRwdXQubWFwID0gbWFwO1xuICAgIH1cbiAgICAvL0VuZCBmaXggc291cmNlbWFwIHJlZmVyZW5jZXNcblxuICAgIGNvbnN0IGNvbXBpbGVSZXN1bHQgPSB7IGNzczogb3V0cHV0LmNzcy50b1N0cmluZygndXRmLTgnKSwgc291cmNlTWFwOiBvdXRwdXQubWFwIH07XG4gICAgcmV0dXJuIHsgY29tcGlsZVJlc3VsdCwgcmVmZXJlbmNlZEltcG9ydFBhdGhzIH07XG4gIH1cblxuICBhZGRDb21waWxlUmVzdWx0KGlucHV0RmlsZSwgY29tcGlsZVJlc3VsdCkge1xuICAgIGlucHV0RmlsZS5hZGRTdHlsZXNoZWV0KHtcbiAgICAgIGRhdGE6IGNvbXBpbGVSZXN1bHQuY3NzLFxuICAgICAgcGF0aDogYCR7aW5wdXRGaWxlLmdldFBhdGhJblBhY2thZ2UoKX0uY3NzYCxcbiAgICAgIHNvdXJjZU1hcDogY29tcGlsZVJlc3VsdC5zb3VyY2VNYXAsXG4gICAgfSk7XG4gIH1cbn1cblxuXG5mdW5jdGlvbiBfZ2V0UmVhbEltcG9ydFBhdGhGcm9tSW5jbHVkZXMoaW1wb3J0UGF0aCwgZ2V0UmVhbEltcG9ydFBhdGhGbil7XG5cbiAgX3ByZXBhcmVOb2RlU2Fzc09wdGlvbnMoKTtcblxuICBsZXQgcG9zc2libGVGaWxlUGF0aCwgZm91bmRGaWxlO1xuXG4gIGZvciAobGV0IGluY2x1ZGVQYXRoIG9mIF9pbmNsdWRlUGF0aHMpIHtcbiAgICBwb3NzaWJsZUZpbGVQYXRoID0gcGF0aC5qb2luKGluY2x1ZGVQYXRoLCBpbXBvcnRQYXRoKTtcbiAgICBmb3VuZEZpbGUgPSBnZXRSZWFsSW1wb3J0UGF0aEZuKHBvc3NpYmxlRmlsZVBhdGgpO1xuXG4gICAgaWYgKGZvdW5kRmlsZSkge1xuICAgICAgcmV0dXJuIGZvdW5kRmlsZTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gbnVsbDtcbn1cblxuLyoqXG4gKiBJZiBub3QgbG9hZGVkIHlldCwgbG9hZCBjb25maWd1cmF0aW9uIGFuZCBpbmNsdWRlUGF0aHMuXG4gKiBAcHJpdmF0ZVxuICovXG5mdW5jdGlvbiBfcHJlcGFyZU5vZGVTYXNzT3B0aW9ucygpIHtcbiAgY29uc3QgY29uZmlnID0gX2xvYWRDb25maWd1cmF0aW9uRmlsZSgpO1xuICBpZiAodHlwZW9mIF9pbmNsdWRlUGF0aHMgPT09ICd1bmRlZmluZWQnICYmIGNvbmZpZy5pbmNsdWRlUGF0aHMpIHtcbiAgICBfbG9hZEluY2x1ZGVQYXRocyhjb25maWcpO1xuICB9XG59XG5cbi8qKlxuICogRXh0cmFjdCB0aGUgJ2luY2x1ZGVQYXRocycga2V5IGZyb20gc3BlY2lmaWVkIGNvbmZpZ3VyYXRpb24sIGlmIGFueSwgYW5kXG4gKiBzdG9yZSBpdCBpbnRvIF9pbmNsdWRlUGF0aHMuXG4gKiBAcGFyYW0gY29uZmlnXG4gKiBAcHJpdmF0ZVxuICovXG5mdW5jdGlvbiBfbG9hZEluY2x1ZGVQYXRocyhjb25maWcpIHtcbiAgLy8gRXh0cmFjdCBpbmNsdWRlUGF0aHMsIGlmIGFueVxuICBjb25zdCBpbmNsdWRlUGF0aHMgPSBjb25maWdbJ2luY2x1ZGVQYXRocyddO1xuXG4gIGlmIChpbmNsdWRlUGF0aHMgJiYgQXJyYXkuaXNBcnJheShpbmNsdWRlUGF0aHMpKSB7XG4gICAgX2luY2x1ZGVQYXRocyA9IGluY2x1ZGVQYXRocztcbiAgfSBlbHNlIHtcbiAgICBfaW5jbHVkZVBhdGhzID0gW107XG4gIH1cbn1cblxuLyoqXG4gKiBSZWFkIHRoZSBjb250ZW50IG9mICdzY3NzLWNvbmZpZy5qc29uJyBmaWxlIChpZiBhbnkpXG4gKiBAcmV0dXJucyB7e319XG4gKiBAcHJpdmF0ZVxuICovXG5mdW5jdGlvbiBfbG9hZENvbmZpZ3VyYXRpb25GaWxlKCkge1xuICByZXR1cm4gX2dldENvbmZpZygnc2Nzcy1jb25maWcuanNvbicpIHx8IHt9O1xufVxuXG4vKipcbiAqIEJ1aWxkIGEgcGF0aCBmcm9tIGN1cnJlbnQgcHJvY2VzcyB3b3JraW5nIGRpcmVjdG9yeSAoaS5lLiBtZXRlb3IgcHJvamVjdFxuICogcm9vdCkgYW5kIHNwZWNpZmllZCBmaWxlIG5hbWUsIHRyeSB0byBnZXQgdGhlIGZpbGUgYW5kIHBhcnNlIGl0cyBjb250ZW50LlxuICogQHBhcmFtIGNvbmZpZ0ZpbGVOYW1lXG4gKiBAcmV0dXJucyB7e319XG4gKiBAcHJpdmF0ZVxuICovXG5mdW5jdGlvbiBfZ2V0Q29uZmlnKGNvbmZpZ0ZpbGVOYW1lKSB7XG4gIGNvbnN0IGFwcGRpciA9IHByb2Nlc3MuZW52LlBXRCB8fCBwcm9jZXNzLmN3ZCgpO1xuICBjb25zdCBjdXN0b21fY29uZmlnX2ZpbGVuYW1lID0gcGF0aC5qb2luKGFwcGRpciwgY29uZmlnRmlsZU5hbWUpO1xuICBsZXQgdXNlckNvbmZpZyA9IHt9O1xuXG4gIGlmIChmaWxlRXhpc3RzKGN1c3RvbV9jb25maWdfZmlsZW5hbWUpKSB7XG4gICAgdXNlckNvbmZpZyA9IGZzLnJlYWRGaWxlU3luYyhjdXN0b21fY29uZmlnX2ZpbGVuYW1lLCB7XG4gICAgICBlbmNvZGluZzogJ3V0ZjgnXG4gICAgfSk7XG4gICAgdXNlckNvbmZpZyA9IEpTT04ucGFyc2UodXNlckNvbmZpZyk7XG4gIH0gZWxzZSB7XG4gICAgLy9jb25zb2xlLndhcm4oJ0NvdWxkIG5vdCBmaW5kIGNvbmZpZ3VyYXRpb24gZmlsZSBhdCAnICsgY3VzdG9tX2NvbmZpZ19maWxlbmFtZSk7XG4gIH1cbiAgcmV0dXJuIHVzZXJDb25maWc7XG59XG5cbmZ1bmN0aW9uIGRlY29kZUZpbGVQYXRoIChmaWxlUGF0aCkge1xuICBjb25zdCBtYXRjaCA9IGZpbGVQYXRoLm1hdGNoKC97KC4qKX1cXC8oLiopJC8pO1xuICBpZiAoIW1hdGNoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBGYWlsZWQgdG8gZGVjb2RlIHNhc3MgcGF0aDogJHtmaWxlUGF0aH1gKTtcbiAgfVxuXG4gIGlmIChtYXRjaFsxXSA9PT0gJycpIHtcbiAgICAvLyBhcHBcbiAgICByZXR1cm4gbWF0Y2hbMl07XG4gIH1cblxuICByZXR1cm4gYHBhY2thZ2VzLyR7bWF0Y2hbMV19LyR7bWF0Y2hbMl19YDtcbn1cblxuZnVuY3Rpb24gZmlsZUV4aXN0cyhmaWxlKSB7XG4gIGlmIChmcy5zdGF0U3luYyl7XG4gICAgdHJ5IHtcbiAgICAgIGZzLnN0YXRTeW5jKGZpbGUpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG4gIH0gZWxzZSBpZiAoZnMuZXhpc3RzU3luYykge1xuICAgIHJldHVybiBmcy5leGlzdHNTeW5jKGZpbGUpO1xuICB9XG59Il19
