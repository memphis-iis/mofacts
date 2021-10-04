(function () {

/* Imports */
var CachingCompiler = Package['caching-compiler'].CachingCompiler;
var MultiFileCachingCompiler = Package['caching-compiler'].MultiFileCachingCompiler;
var ECMAScript = Package.ecmascript.ECMAScript;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

var require = meteorInstall({"node_modules":{"meteor":{"compileScssBatch":{"plugin":{"compile-scss.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                     //
// packages/compileScssBatch/plugin/compile-scss.js                                                    //
//                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                       //
!function (module1) {
  let sass;
  module1.link("node-sass", {
    default(v) {
      sass = v;
    }

  }, 0);
  let promisify;
  module1.link("util", {
    promisify(v) {
      promisify = v;
    }

  }, 1);
  const path = Plugin.path;
  const fs = Plugin.fs;
  const compileSass = promisify(sass.render);
  const rootDir = (process.env.PWD || process.cwd()) + "/";

  const {
    includePaths
  } = _getConfig('scss-config.json');

  const _includePaths = Array.isArray(includePaths) ? includePaths : [];

  Plugin.registerCompiler({
    extensions: ['scss', 'sass'],
    archMatching: 'web'
  }, () => new SassCompiler()); // CompileResult is {css, sourceMap}.

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
        var sourceMapPaths = [".".concat(inputFile.getDisplayPath())];

        const addUnderscore = file => {
          if (!this.hasUnderscore(file)) {
            file = path.join(path.dirname(file), "_".concat(path.basename(file)));
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
              possibleFiles.push("".concat(importPath, ".").concat(extension));
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
        };

        const fixTilde = function (thePath) {
          let newPath = thePath; // replace ~ with {}/....

          if (newPath.startsWith('~')) {
            newPath = newPath.replace('~', '{}/node_modules/');
          } // add {}/ if starts with node_modules


          if (!newPath.startsWith('{')) {
            if (newPath.startsWith('node_modules')) {
              newPath = '{}/' + newPath;
            }

            if (newPath.startsWith('/node_modules')) {
              newPath = '{}' + newPath;
            }
          }

          return newPath;
        }; //Handle import statements found by the sass compiler, used to handle cross-package imports


        const importer = function (url, prev, done) {
          prev = fixTilde(prev);

          if (!totalImportPath.length) {
            totalImportPath.push(prev);
          }

          if (prev !== undefined) {
            // iterate backwards over totalImportPath and remove paths that don't equal the prev url
            for (let i = totalImportPath.length - 1; i >= 0; i--) {
              // check if importPath contains prev, if it doesn't, remove it. Up until we find a path that does contain it
              if (totalImportPath[i] == prev) {
                break;
              } else {
                // remove last item (which has to be item i because we are iterating backwards)
                totalImportPath.splice(i, 1);
              }
            }
          }

          let importPath = fixTilde(url);

          for (let i = totalImportPath.length - 1; i >= 0; i--) {
            if (importPath.startsWith('/') || importPath.startsWith('{')) {
              break;
            } // 'path' is the nodejs path module


            importPath = path.join(path.dirname(totalImportPath[i]), importPath);
          }

          let accPosition = importPath.indexOf('{');

          if (accPosition > -1) {
            importPath = importPath.substr(accPosition, importPath.length);
          } // TODO: This fix works.. BUT if you edit the scss/css file it doesn't recompile! Probably because of the absolute path problem


          if (importPath.startsWith('{')) {
            // replace {}/node_modules/ for rootDir + "node_modules/"
            importPath = importPath.replace(/^(\{\}\/node_modules\/)/, rootDir + "node_modules/"); // importPath = importPath.replace('{}/node_modules/', rootDir + "node_modules/");

            if (importPath.endsWith('.css')) {
              // .css files aren't in allFiles. Replace {}/ for absolute path.
              importPath = importPath.replace(/^(\{\}\/)/, rootDir);
            }
          }

          try {
            let parsed = getRealImportPath(importPath);

            if (!parsed) {
              parsed = _getRealImportPathFromIncludes(url, getRealImportPath);
            }

            if (!parsed) {
              //Nothing found...
              throw new Error("File to import: ".concat(url, " not found in file: ").concat(totalImportPath[totalImportPath.length - 2]));
            }

            totalImportPath.push(parsed.path);

            if (parsed.absolute) {
              sourceMapPaths.push(parsed.path);
              done({
                contents: fs.readFileSync(parsed.path, 'utf8'),
                file: parsed.path
              });
            } else {
              referencedImportPaths.push(parsed.path);
              sourceMapPaths.push(decodeFilePath(parsed.path));
              done({
                contents: allFiles.get(parsed.path).getContentsAsString(),
                file: parsed.path
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
          outFile: ".".concat(inputFile.getBasename()),
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
            message: "Scss compiler error: ".concat(e.formatted, "\n"),
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
        path: "".concat(inputFile.getPathInPackage(), ".css"),
        sourceMap: compileResult.sourceMap
      });
    }

  }

  function _getRealImportPathFromIncludes(importPath, getRealImportPathFn) {
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
      throw new Error("Failed to decode sass path: ".concat(filePath));
    }

    if (match[1] === '') {
      // app
      return match[2];
    }

    return "packages/".concat(match[1], "/").concat(match[2]);
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
}.call(this, module);
/////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"node_modules":{"node-sass":{"package.json":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                     //
// node_modules/meteor/compileScssBatch/node_modules/node-sass/package.json                            //
//                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                       //
module.exports = {
  "name": "node-sass",
  "version": "4.14.1",
  "main": "lib/index.js"
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////

},"lib":{"index.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                     //
// node_modules/meteor/compileScssBatch/node_modules/node-sass/lib/index.js                            //
//                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                       //
module.useNode();
/////////////////////////////////////////////////////////////////////////////////////////////////////////

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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvY29tcGlsZVNjc3NCYXRjaC9wbHVnaW4vY29tcGlsZS1zY3NzLmpzIl0sIm5hbWVzIjpbInNhc3MiLCJtb2R1bGUxIiwibGluayIsImRlZmF1bHQiLCJ2IiwicHJvbWlzaWZ5IiwicGF0aCIsIlBsdWdpbiIsImZzIiwiY29tcGlsZVNhc3MiLCJyZW5kZXIiLCJyb290RGlyIiwicHJvY2VzcyIsImVudiIsIlBXRCIsImN3ZCIsImluY2x1ZGVQYXRocyIsIl9nZXRDb25maWciLCJfaW5jbHVkZVBhdGhzIiwiQXJyYXkiLCJpc0FycmF5IiwicmVnaXN0ZXJDb21waWxlciIsImV4dGVuc2lvbnMiLCJhcmNoTWF0Y2hpbmciLCJTYXNzQ29tcGlsZXIiLCJNdWx0aUZpbGVDYWNoaW5nQ29tcGlsZXIiLCJjb25zdHJ1Y3RvciIsImNvbXBpbGVyTmFtZSIsImRlZmF1bHRDYWNoZVNpemUiLCJnZXRDYWNoZUtleSIsImlucHV0RmlsZSIsImdldFNvdXJjZUhhc2giLCJjb21waWxlUmVzdWx0U2l6ZSIsImNvbXBpbGVSZXN1bHQiLCJjc3MiLCJsZW5ndGgiLCJzb3VyY2VNYXBTaXplIiwic291cmNlTWFwIiwiaXNSb290IiwiZmlsZU9wdGlvbnMiLCJnZXRGaWxlT3B0aW9ucyIsImhhc093blByb3BlcnR5IiwiaXNJbXBvcnQiLCJwYXRoSW5QYWNrYWdlIiwiZ2V0UGF0aEluUGFja2FnZSIsImhhc1VuZGVyc2NvcmUiLCJmaWxlIiwiYmFzZW5hbWUiLCJzdGFydHNXaXRoIiwiY29tcGlsZU9uZUZpbGVMYXRlciIsImdldFJlc3VsdCIsImFkZFN0eWxlc2hlZXQiLCJyZXN1bHQiLCJkYXRhIiwiY29tcGlsZU9uZUZpbGUiLCJhbGxGaWxlcyIsInJlZmVyZW5jZWRJbXBvcnRQYXRocyIsInRvdGFsSW1wb3J0UGF0aCIsInNvdXJjZU1hcFBhdGhzIiwiZ2V0RGlzcGxheVBhdGgiLCJhZGRVbmRlcnNjb3JlIiwiam9pbiIsImRpcm5hbWUiLCJnZXRSZWFsSW1wb3J0UGF0aCIsImltcG9ydFBhdGgiLCJpc0Fic29sdXRlIiwicG9zc2libGVGaWxlcyIsInBvc3NpYmxlRXh0ZW5zaW9ucyIsIm1hdGNoIiwiZ2V0RXh0ZW5zaW9uIiwiZmlsdGVyIiwiZSIsImV4dGVuc2lvbiIsInB1c2giLCJwb3NzaWJsZUZpbGUiLCJmaWxlRXhpc3RzIiwiaGFzIiwiYWJzb2x1dGUiLCJmaXhUaWxkZSIsInRoZVBhdGgiLCJuZXdQYXRoIiwicmVwbGFjZSIsImltcG9ydGVyIiwidXJsIiwicHJldiIsImRvbmUiLCJ1bmRlZmluZWQiLCJpIiwic3BsaWNlIiwiYWNjUG9zaXRpb24iLCJpbmRleE9mIiwic3Vic3RyIiwiZW5kc1dpdGgiLCJwYXJzZWQiLCJfZ2V0UmVhbEltcG9ydFBhdGhGcm9tSW5jbHVkZXMiLCJFcnJvciIsImNvbnRlbnRzIiwicmVhZEZpbGVTeW5jIiwiZGVjb2RlRmlsZVBhdGgiLCJnZXQiLCJnZXRDb250ZW50c0FzU3RyaW5nIiwib3B0aW9ucyIsInNvdXJjZU1hcENvbnRlbnRzIiwic291cmNlTWFwRW1iZWQiLCJzb3VyY2VDb21tZW50cyIsIm9taXRTb3VyY2VNYXBVcmwiLCJzb3VyY2VNYXBSb290IiwiaW5kZW50ZWRTeW50YXgiLCJvdXRGaWxlIiwiZ2V0QmFzZW5hbWUiLCJwcmVjaXNpb24iLCJnZXRBYnNvbHV0ZUltcG9ydFBhdGgiLCJnZXRDb250ZW50c0FzQnVmZmVyIiwidG9TdHJpbmciLCJ0cmltIiwib3V0cHV0IiwiZXJyb3IiLCJtZXNzYWdlIiwiZm9ybWF0dGVkIiwic291cmNlUGF0aCIsIm1hcCIsIkpTT04iLCJwYXJzZSIsInNvdXJjZXMiLCJhZGRDb21waWxlUmVzdWx0IiwiZ2V0UmVhbEltcG9ydFBhdGhGbiIsInBvc3NpYmxlRmlsZVBhdGgiLCJmb3VuZEZpbGUiLCJpbmNsdWRlUGF0aCIsImNvbmZpZ0ZpbGVOYW1lIiwiYXBwZGlyIiwiY3VzdG9tX2NvbmZpZ19maWxlbmFtZSIsInVzZXJDb25maWci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L3BhY2thZ2VzL2NvbXBpbGVTY3NzQmF0Y2hfcGx1Z2luLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHNhc3MgZnJvbSAnbm9kZS1zYXNzJztcbmltcG9ydCB7IHByb21pc2lmeSB9IGZyb20gJ3V0aWwnO1xuY29uc3QgcGF0aCA9IFBsdWdpbi5wYXRoO1xuY29uc3QgZnMgPSBQbHVnaW4uZnM7XG5cbmNvbnN0IGNvbXBpbGVTYXNzID0gcHJvbWlzaWZ5KHNhc3MucmVuZGVyKTtcbmNvbnN0IHJvb3REaXIgPSAocHJvY2Vzcy5lbnYuUFdEIHx8IHByb2Nlc3MuY3dkKCkpICsgXCIvXCI7XG5cbmNvbnN0IHsgaW5jbHVkZVBhdGhzIH0gPSBfZ2V0Q29uZmlnKCdzY3NzLWNvbmZpZy5qc29uJyk7XG5jb25zdCBfaW5jbHVkZVBhdGhzID0gQXJyYXkuaXNBcnJheShpbmNsdWRlUGF0aHMpID8gaW5jbHVkZVBhdGhzIDogW107XG5cblBsdWdpbi5yZWdpc3RlckNvbXBpbGVyKHtcbiAgZXh0ZW5zaW9uczogWydzY3NzJywgJ3Nhc3MnXSxcbiAgYXJjaE1hdGNoaW5nOiAnd2ViJ1xufSwgKCkgPT4gbmV3IFNhc3NDb21waWxlcigpKTtcblxuLy8gQ29tcGlsZVJlc3VsdCBpcyB7Y3NzLCBzb3VyY2VNYXB9LlxuY2xhc3MgU2Fzc0NvbXBpbGVyIGV4dGVuZHMgTXVsdGlGaWxlQ2FjaGluZ0NvbXBpbGVyIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoe1xuICAgICAgY29tcGlsZXJOYW1lOiAnc2FzcycsXG4gICAgICBkZWZhdWx0Q2FjaGVTaXplOiAxMDI0KjEwMjQqMTAsXG4gICAgfSk7XG4gIH1cblxuICBnZXRDYWNoZUtleShpbnB1dEZpbGUpIHtcbiAgICByZXR1cm4gaW5wdXRGaWxlLmdldFNvdXJjZUhhc2goKTtcbiAgfVxuXG4gIGNvbXBpbGVSZXN1bHRTaXplKGNvbXBpbGVSZXN1bHQpIHtcbiAgICByZXR1cm4gY29tcGlsZVJlc3VsdC5jc3MubGVuZ3RoICtcbiAgICAgIHRoaXMuc291cmNlTWFwU2l6ZShjb21waWxlUmVzdWx0LnNvdXJjZU1hcCk7XG4gIH1cblxuICAvLyBUaGUgaGV1cmlzdGljIGlzIHRoYXQgYSBmaWxlIGlzIGFuIGltcG9ydCAoaWUsIGlzIG5vdCBpdHNlbGYgcHJvY2Vzc2VkIGFzIGFcbiAgLy8gcm9vdCkgaWYgaXQgbWF0Y2hlcyBfKi5zYXNzLCBfKi5zY3NzXG4gIC8vIFRoaXMgY2FuIGJlIG92ZXJyaWRkZW4gaW4gZWl0aGVyIGRpcmVjdGlvbiB2aWEgYW4gZXhwbGljaXRcbiAgLy8gYGlzSW1wb3J0YCBmaWxlIG9wdGlvbiBpbiBhcGkuYWRkRmlsZXMuXG4gIGlzUm9vdChpbnB1dEZpbGUpIHtcbiAgICBjb25zdCBmaWxlT3B0aW9ucyA9IGlucHV0RmlsZS5nZXRGaWxlT3B0aW9ucygpO1xuXG4gICAgaWYgKGZpbGVPcHRpb25zLmhhc093blByb3BlcnR5KCdpc0ltcG9ydCcpKSB7XG4gICAgICByZXR1cm4gIWZpbGVPcHRpb25zLmlzSW1wb3J0O1xuICAgIH1cblxuICAgIGNvbnN0IHBhdGhJblBhY2thZ2UgPSBpbnB1dEZpbGUuZ2V0UGF0aEluUGFja2FnZSgpO1xuICAgIHJldHVybiAhdGhpcy5oYXNVbmRlcnNjb3JlKHBhdGhJblBhY2thZ2UpO1xuICB9XG5cbiAgaGFzVW5kZXJzY29yZShmaWxlKSB7XG4gICAgcmV0dXJuIHBhdGguYmFzZW5hbWUoZmlsZSkuc3RhcnRzV2l0aCgnXycpO1xuICB9XG5cbiAgY29tcGlsZU9uZUZpbGVMYXRlcihpbnB1dEZpbGUsIGdldFJlc3VsdCkge1xuICAgIGlucHV0RmlsZS5hZGRTdHlsZXNoZWV0KHtcbiAgICAgIHBhdGg6IGlucHV0RmlsZS5nZXRQYXRoSW5QYWNrYWdlKCksXG4gICAgfSwgYXN5bmMgKCkgPT4ge1xuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZ2V0UmVzdWx0KCk7XG4gICAgICByZXR1cm4gcmVzdWx0ICYmIHtcbiAgICAgICAgZGF0YTogcmVzdWx0LmNzcyxcbiAgICAgICAgc291cmNlTWFwOiByZXN1bHQuc291cmNlTWFwLFxuICAgICAgICB9O1xuICAgIH0pO1xuICB9XG5cbiAgYXN5bmMgY29tcGlsZU9uZUZpbGUoaW5wdXRGaWxlLCBhbGxGaWxlcykge1xuICAgIGNvbnN0IHJlZmVyZW5jZWRJbXBvcnRQYXRocyA9IFtdO1xuXG4gICAgdmFyIHRvdGFsSW1wb3J0UGF0aCA9IFtdO1xuICAgIHZhciBzb3VyY2VNYXBQYXRocyA9IFtgLiR7aW5wdXRGaWxlLmdldERpc3BsYXlQYXRoKCl9YF07XG5cbiAgICBjb25zdCBhZGRVbmRlcnNjb3JlID0gKGZpbGUpID0+IHtcbiAgICAgIGlmICghdGhpcy5oYXNVbmRlcnNjb3JlKGZpbGUpKSB7XG4gICAgICAgIGZpbGUgPSBwYXRoLmpvaW4ocGF0aC5kaXJuYW1lKGZpbGUpLCBgXyR7cGF0aC5iYXNlbmFtZShmaWxlKX1gKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBmaWxlO1xuICAgIH1cblxuICAgIGNvbnN0IGdldFJlYWxJbXBvcnRQYXRoID0gKGltcG9ydFBhdGgpID0+IHtcbiAgICAgIGNvbnN0IGlzQWJzb2x1dGUgPSBpbXBvcnRQYXRoLnN0YXJ0c1dpdGgoJy8nKTtcblxuICAgICAgLy9TQVNTIGhhcyBhIHdob2xlIHJhbmdlIG9mIHBvc3NpYmxlIGltcG9ydCBmaWxlcyBmcm9tIG9uZSBpbXBvcnQgc3RhdGVtZW50LCB0cnkgZWFjaCBvZiB0aGVtXG4gICAgICBjb25zdCBwb3NzaWJsZUZpbGVzID0gW107XG5cbiAgICAgIC8vSWYgdGhlIHJlZmVyZW5jZWQgZmlsZSBoYXMgbm8gZXh0ZW5zaW9uLCB0cnkgcG9zc2libGUgZXh0ZW5zaW9ucywgc3RhcnRpbmcgd2l0aCBleHRlbnNpb24gb2YgdGhlIHBhcmVudCBmaWxlLlxuICAgICAgbGV0IHBvc3NpYmxlRXh0ZW5zaW9ucyA9IFsnc2NzcycsJ3Nhc3MnLCdjc3MnXTtcblxuICAgICAgaWYoISBpbXBvcnRQYXRoLm1hdGNoKC9cXC5zPyhhfGMpc3MkLykpe1xuICAgICAgICBwb3NzaWJsZUV4dGVuc2lvbnMgPSBbXG4gICAgICAgICAgaW5wdXRGaWxlLmdldEV4dGVuc2lvbigpLFxuICAgICAgICAgIC4uLnBvc3NpYmxlRXh0ZW5zaW9ucy5maWx0ZXIoZSA9PiBlICE9PSBpbnB1dEZpbGUuZ2V0RXh0ZW5zaW9uKCkpXG4gICAgICAgICAgXVxuICAgICAgICBmb3IgKGNvbnN0IGV4dGVuc2lvbiBvZiBwb3NzaWJsZUV4dGVuc2lvbnMpe1xuICAgICAgICAgIHBvc3NpYmxlRmlsZXMucHVzaChgJHtpbXBvcnRQYXRofS4ke2V4dGVuc2lvbn1gKTtcbiAgICAgICAgfVxuICAgICAgfWVsc2V7XG4gICAgICAgIHBvc3NpYmxlRmlsZXMucHVzaChpbXBvcnRQYXRoKTtcbiAgICAgIH1cblxuICAgICAgLy9UcnkgZmlsZXMgcHJlZml4ZWQgd2l0aCB1bmRlcnNjb3JlXG4gICAgICBmb3IgKGNvbnN0IHBvc3NpYmxlRmlsZSBvZiBwb3NzaWJsZUZpbGVzKSB7XG4gICAgICAgIGlmICghIHRoaXMuaGFzVW5kZXJzY29yZShwb3NzaWJsZUZpbGUpKSB7XG4gICAgICAgICAgcG9zc2libGVGaWxlcy5wdXNoKGFkZFVuZGVyc2NvcmUocG9zc2libGVGaWxlKSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy9UcnkgaWYgb25lIG9mIHRoZSBwb3NzaWJsZSBmaWxlcyBleGlzdHNcbiAgICAgIGZvciAoY29uc3QgcG9zc2libGVGaWxlIG9mIHBvc3NpYmxlRmlsZXMpIHtcbiAgICAgICAgaWYgKChpc0Fic29sdXRlICYmIGZpbGVFeGlzdHMocG9zc2libGVGaWxlKSkgfHwgKCFpc0Fic29sdXRlICYmIGFsbEZpbGVzLmhhcyhwb3NzaWJsZUZpbGUpKSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgYWJzb2x1dGU6IGlzQWJzb2x1dGUsIHBhdGg6IHBvc3NpYmxlRmlsZSB9O1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvL05vdGhpbmcgZm91bmQuLi5cbiAgICAgIHJldHVybiBudWxsO1xuXG4gICAgfTtcblxuXG4gICAgY29uc3QgZml4VGlsZGUgPSBmdW5jdGlvbih0aGVQYXRoKSB7XG4gICAgICBsZXQgbmV3UGF0aCA9IHRoZVBhdGg7XG4gICAgICAvLyByZXBsYWNlIH4gd2l0aCB7fS8uLi4uXG4gICAgICBpZiAobmV3UGF0aC5zdGFydHNXaXRoKCd+JykpIHtcbiAgICAgICAgbmV3UGF0aCA9IG5ld1BhdGgucmVwbGFjZSgnficsICd7fS9ub2RlX21vZHVsZXMvJyk7XG4gICAgICB9XG5cbiAgICAgIC8vIGFkZCB7fS8gaWYgc3RhcnRzIHdpdGggbm9kZV9tb2R1bGVzXG4gICAgICBpZiAoIW5ld1BhdGguc3RhcnRzV2l0aCgneycpKSB7XG4gICAgICAgIGlmIChuZXdQYXRoLnN0YXJ0c1dpdGgoJ25vZGVfbW9kdWxlcycpKSB7XG4gICAgICAgICAgbmV3UGF0aCA9ICd7fS8nICsgbmV3UGF0aDtcbiAgICAgICAgfVxuICAgICAgICBpZiAobmV3UGF0aC5zdGFydHNXaXRoKCcvbm9kZV9tb2R1bGVzJykpIHtcbiAgICAgICAgICBuZXdQYXRoID0gJ3t9JyArIG5ld1BhdGg7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIG5ld1BhdGg7XG4gICAgfVxuXG4gICAgLy9IYW5kbGUgaW1wb3J0IHN0YXRlbWVudHMgZm91bmQgYnkgdGhlIHNhc3MgY29tcGlsZXIsIHVzZWQgdG8gaGFuZGxlIGNyb3NzLXBhY2thZ2UgaW1wb3J0c1xuICAgIGNvbnN0IGltcG9ydGVyID0gZnVuY3Rpb24odXJsLCBwcmV2LCBkb25lKSB7XG5cbiAgICAgIHByZXYgPSBmaXhUaWxkZShwcmV2KTtcbiAgICAgIGlmICghdG90YWxJbXBvcnRQYXRoLmxlbmd0aCkge1xuICAgICAgICB0b3RhbEltcG9ydFBhdGgucHVzaChwcmV2KTtcbiAgICAgIH1cblxuICAgICAgaWYgKHByZXYgIT09IHVuZGVmaW5lZCkge1xuXG4gICAgICAgIC8vIGl0ZXJhdGUgYmFja3dhcmRzIG92ZXIgdG90YWxJbXBvcnRQYXRoIGFuZCByZW1vdmUgcGF0aHMgdGhhdCBkb24ndCBlcXVhbCB0aGUgcHJldiB1cmxcbiAgICAgICAgZm9yIChsZXQgaSA9IHRvdGFsSW1wb3J0UGF0aC5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuXG4gICAgICAgICAgLy8gY2hlY2sgaWYgaW1wb3J0UGF0aCBjb250YWlucyBwcmV2LCBpZiBpdCBkb2Vzbid0LCByZW1vdmUgaXQuIFVwIHVudGlsIHdlIGZpbmQgYSBwYXRoIHRoYXQgZG9lcyBjb250YWluIGl0XG4gICAgICAgICAgaWYgKHRvdGFsSW1wb3J0UGF0aFtpXSA9PSBwcmV2KSB7XG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyByZW1vdmUgbGFzdCBpdGVtICh3aGljaCBoYXMgdG8gYmUgaXRlbSBpIGJlY2F1c2Ugd2UgYXJlIGl0ZXJhdGluZyBiYWNrd2FyZHMpXG4gICAgICAgICAgICB0b3RhbEltcG9ydFBhdGguc3BsaWNlKGksMSlcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgfVxuXG4gICAgICBsZXQgaW1wb3J0UGF0aCA9IGZpeFRpbGRlKHVybCk7XG4gICAgICBmb3IgKGxldCBpID0gdG90YWxJbXBvcnRQYXRoLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgIGlmIChpbXBvcnRQYXRoLnN0YXJ0c1dpdGgoJy8nKSB8fCBpbXBvcnRQYXRoLnN0YXJ0c1dpdGgoJ3snKSkge1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIC8vICdwYXRoJyBpcyB0aGUgbm9kZWpzIHBhdGggbW9kdWxlXG4gICAgICAgIGltcG9ydFBhdGggPSBwYXRoLmpvaW4ocGF0aC5kaXJuYW1lKHRvdGFsSW1wb3J0UGF0aFtpXSksaW1wb3J0UGF0aCk7XG4gICAgICB9XG5cbiAgICAgIGxldCBhY2NQb3NpdGlvbiA9IGltcG9ydFBhdGguaW5kZXhPZigneycpO1xuICAgICAgaWYgKGFjY1Bvc2l0aW9uID4gLTEpIHtcbiAgICAgICAgaW1wb3J0UGF0aCA9IGltcG9ydFBhdGguc3Vic3RyKGFjY1Bvc2l0aW9uLGltcG9ydFBhdGgubGVuZ3RoKTtcbiAgICAgIH1cblxuICAgICAgLy8gVE9ETzogVGhpcyBmaXggd29ya3MuLiBCVVQgaWYgeW91IGVkaXQgdGhlIHNjc3MvY3NzIGZpbGUgaXQgZG9lc24ndCByZWNvbXBpbGUhIFByb2JhYmx5IGJlY2F1c2Ugb2YgdGhlIGFic29sdXRlIHBhdGggcHJvYmxlbVxuICAgICAgaWYgKGltcG9ydFBhdGguc3RhcnRzV2l0aCgneycpKSB7XG4gICAgICAgIC8vIHJlcGxhY2Uge30vbm9kZV9tb2R1bGVzLyBmb3Igcm9vdERpciArIFwibm9kZV9tb2R1bGVzL1wiXG4gICAgICAgIGltcG9ydFBhdGggPSBpbXBvcnRQYXRoLnJlcGxhY2UoL14oXFx7XFx9XFwvbm9kZV9tb2R1bGVzXFwvKS8sIHJvb3REaXIgKyBcIm5vZGVfbW9kdWxlcy9cIik7XG4gICAgICAgIC8vIGltcG9ydFBhdGggPSBpbXBvcnRQYXRoLnJlcGxhY2UoJ3t9L25vZGVfbW9kdWxlcy8nLCByb290RGlyICsgXCJub2RlX21vZHVsZXMvXCIpO1xuICAgICAgICBpZiAoaW1wb3J0UGF0aC5lbmRzV2l0aCgnLmNzcycpKSB7XG4gICAgICAgICAgLy8gLmNzcyBmaWxlcyBhcmVuJ3QgaW4gYWxsRmlsZXMuIFJlcGxhY2Uge30vIGZvciBhYnNvbHV0ZSBwYXRoLlxuICAgICAgICAgIGltcG9ydFBhdGggPSBpbXBvcnRQYXRoLnJlcGxhY2UoL14oXFx7XFx9XFwvKS8sIHJvb3REaXIpXG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgdHJ5IHtcbiAgICAgICAgbGV0IHBhcnNlZCA9IGdldFJlYWxJbXBvcnRQYXRoKGltcG9ydFBhdGgpO1xuXG4gICAgICAgIGlmICghcGFyc2VkKSB7XG4gICAgICAgICAgcGFyc2VkID0gX2dldFJlYWxJbXBvcnRQYXRoRnJvbUluY2x1ZGVzKHVybCwgZ2V0UmVhbEltcG9ydFBhdGgpO1xuICAgICAgICB9XG4gICAgICAgIGlmICghcGFyc2VkKSB7XG4gICAgICAgICAgLy9Ob3RoaW5nIGZvdW5kLi4uXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBGaWxlIHRvIGltcG9ydDogJHt1cmx9IG5vdCBmb3VuZCBpbiBmaWxlOiAke3RvdGFsSW1wb3J0UGF0aFt0b3RhbEltcG9ydFBhdGgubGVuZ3RoIC0gMl19YCk7XG4gICAgICAgIH1cbiAgICAgICAgdG90YWxJbXBvcnRQYXRoLnB1c2gocGFyc2VkLnBhdGgpO1xuXG4gICAgICAgIGlmIChwYXJzZWQuYWJzb2x1dGUpIHtcbiAgICAgICAgICBzb3VyY2VNYXBQYXRocy5wdXNoKHBhcnNlZC5wYXRoKTtcbiAgICAgICAgICBkb25lKHsgY29udGVudHM6IGZzLnJlYWRGaWxlU3luYyhwYXJzZWQucGF0aCwgJ3V0ZjgnKSwgZmlsZTogcGFyc2VkLnBhdGh9KTtcblxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJlZmVyZW5jZWRJbXBvcnRQYXRocy5wdXNoKHBhcnNlZC5wYXRoKTtcbiAgICAgICAgICBzb3VyY2VNYXBQYXRocy5wdXNoKGRlY29kZUZpbGVQYXRoKHBhcnNlZC5wYXRoKSk7XG4gICAgICAgICAgZG9uZSh7IGNvbnRlbnRzOiBhbGxGaWxlcy5nZXQocGFyc2VkLnBhdGgpLmdldENvbnRlbnRzQXNTdHJpbmcoKSwgZmlsZTogcGFyc2VkLnBhdGh9KTtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICByZXR1cm4gZG9uZShlKTtcbiAgICAgIH1cblxuICAgIH1cblxuICAgIC8vU3RhcnQgY29tcGlsZSBzYXNzIChhc3luYylcbiAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgc291cmNlTWFwOiB0cnVlLFxuICAgICAgc291cmNlTWFwQ29udGVudHM6IHRydWUsXG4gICAgICBzb3VyY2VNYXBFbWJlZDogZmFsc2UsXG4gICAgICBzb3VyY2VDb21tZW50czogZmFsc2UsXG4gICAgICBvbWl0U291cmNlTWFwVXJsOiB0cnVlLFxuICAgICAgc291cmNlTWFwUm9vdDogJy4nLFxuICAgICAgaW5kZW50ZWRTeW50YXggOiBpbnB1dEZpbGUuZ2V0RXh0ZW5zaW9uKCkgPT09ICdzYXNzJyxcbiAgICAgIG91dEZpbGU6IGAuJHtpbnB1dEZpbGUuZ2V0QmFzZW5hbWUoKX1gLFxuICAgICAgaW1wb3J0ZXIsXG4gICAgICBpbmNsdWRlUGF0aHM6IFtdLFxuICAgICAgcHJlY2lzaW9uOiAxMCxcbiAgICB9O1xuXG4gICAgb3B0aW9ucy5maWxlID0gdGhpcy5nZXRBYnNvbHV0ZUltcG9ydFBhdGgoaW5wdXRGaWxlKTtcblxuICAgIG9wdGlvbnMuZGF0YSA9IGlucHV0RmlsZS5nZXRDb250ZW50c0FzQnVmZmVyKCkudG9TdHJpbmcoJ3V0ZjgnKTtcblxuICAgIC8vSWYgdGhlIGZpbGUgaXMgZW1wdHksIG9wdGlvbnMuZGF0YSBpcyBhbiBlbXB0eSBzdHJpbmdcbiAgICAvLyBJbiB0aGF0IGNhc2Ugb3B0aW9ucy5maWxlIHdpbGwgYmUgdXNlZCBieSBub2RlLXNhc3MsXG4gICAgLy8gd2hpY2ggaXQgY2FuIG5vdCByZWFkIHNpbmNlIGl0IHdpbGwgY29udGFpbiBhIG1ldGVvciBwYWNrYWdlIG9yIGFwcCByZWZlcmVuY2UgJ3t9J1xuICAgIC8vIFRoaXMgaXMgb25lIHdvcmthcm91bmQsIGFub3RoZXIgb25lIHdvdWxkIGJlIHRvIG5vdCBzZXQgb3B0aW9ucy5maWxlLCBpbiB3aGljaCBjYXNlIHRoZSBpbXBvcnRlciAncHJldicgd2lsbCBiZSAnc3RkaW4nXG4gICAgLy8gSG93ZXZlciwgdGhpcyB3b3VsZCByZXN1bHQgaW4gcHJvYmxlbXMgaWYgYSBmaWxlIG5hbWVkIHN0ZMOtbi5zY3NzIHdvdWxkIGV4aXN0LlxuICAgIC8vIE5vdCB0aGUgbW9zdCBlbGVnYW50IG9mIHNvbHV0aW9ucywgYnV0IGl0IHdvcmtzLlxuICAgIGlmICghb3B0aW9ucy5kYXRhLnRyaW0oKSkge1xuICAgICAgb3B0aW9ucy5kYXRhID0gJyRmYWtldmFyaWFibGVfYWU3YnNsdmJwMnlxbGZiYSA6IGJsdWU7JztcbiAgICB9XG5cbiAgICBsZXQgb3V0cHV0O1xuICAgIHRyeSB7XG4gICAgICBvdXRwdXQgPSBhd2FpdCBjb21waWxlU2FzcyhvcHRpb25zKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBpbnB1dEZpbGUuZXJyb3Ioe1xuICAgICAgICBtZXNzYWdlOiBgU2NzcyBjb21waWxlciBlcnJvcjogJHtlLmZvcm1hdHRlZH1cXG5gLFxuICAgICAgICBzb3VyY2VQYXRoOiBpbnB1dEZpbGUuZ2V0RGlzcGxheVBhdGgoKVxuICAgICAgfSk7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgLy9FbmQgY29tcGlsZSBzYXNzXG5cbiAgICAvL1N0YXJ0IGZpeCBzb3VyY2VtYXAgcmVmZXJlbmNlc1xuICAgIGlmIChvdXRwdXQubWFwKSB7XG4gICAgICBjb25zdCBtYXAgPSBKU09OLnBhcnNlKG91dHB1dC5tYXAudG9TdHJpbmcoJ3V0Zi04JykpO1xuICAgICAgbWFwLnNvdXJjZXMgPSBzb3VyY2VNYXBQYXRocztcbiAgICAgIG91dHB1dC5tYXAgPSBtYXA7XG4gICAgfVxuICAgIC8vRW5kIGZpeCBzb3VyY2VtYXAgcmVmZXJlbmNlc1xuXG4gICAgY29uc3QgY29tcGlsZVJlc3VsdCA9IHsgY3NzOiBvdXRwdXQuY3NzLnRvU3RyaW5nKCd1dGYtOCcpLCBzb3VyY2VNYXA6IG91dHB1dC5tYXAgfTtcbiAgICByZXR1cm4geyBjb21waWxlUmVzdWx0LCByZWZlcmVuY2VkSW1wb3J0UGF0aHMgfTtcbiAgfVxuXG4gIGFkZENvbXBpbGVSZXN1bHQoaW5wdXRGaWxlLCBjb21waWxlUmVzdWx0KSB7XG4gICAgaW5wdXRGaWxlLmFkZFN0eWxlc2hlZXQoe1xuICAgICAgZGF0YTogY29tcGlsZVJlc3VsdC5jc3MsXG4gICAgICBwYXRoOiBgJHtpbnB1dEZpbGUuZ2V0UGF0aEluUGFja2FnZSgpfS5jc3NgLFxuICAgICAgc291cmNlTWFwOiBjb21waWxlUmVzdWx0LnNvdXJjZU1hcCxcbiAgICB9KTtcbiAgfVxufVxuXG5mdW5jdGlvbiBfZ2V0UmVhbEltcG9ydFBhdGhGcm9tSW5jbHVkZXMoaW1wb3J0UGF0aCwgZ2V0UmVhbEltcG9ydFBhdGhGbil7XG4gIGxldCBwb3NzaWJsZUZpbGVQYXRoLCBmb3VuZEZpbGU7XG5cbiAgZm9yIChsZXQgaW5jbHVkZVBhdGggb2YgX2luY2x1ZGVQYXRocykge1xuICAgIHBvc3NpYmxlRmlsZVBhdGggPSBwYXRoLmpvaW4oaW5jbHVkZVBhdGgsIGltcG9ydFBhdGgpO1xuICAgIGZvdW5kRmlsZSA9IGdldFJlYWxJbXBvcnRQYXRoRm4ocG9zc2libGVGaWxlUGF0aCk7XG5cbiAgICBpZiAoZm91bmRGaWxlKSB7XG4gICAgICByZXR1cm4gZm91bmRGaWxlO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBudWxsO1xufVxuXG4vKipcbiAqIEJ1aWxkIGEgcGF0aCBmcm9tIGN1cnJlbnQgcHJvY2VzcyB3b3JraW5nIGRpcmVjdG9yeSAoaS5lLiBtZXRlb3IgcHJvamVjdFxuICogcm9vdCkgYW5kIHNwZWNpZmllZCBmaWxlIG5hbWUsIHRyeSB0byBnZXQgdGhlIGZpbGUgYW5kIHBhcnNlIGl0cyBjb250ZW50LlxuICogQHBhcmFtIGNvbmZpZ0ZpbGVOYW1lXG4gKiBAcmV0dXJucyB7e319XG4gKiBAcHJpdmF0ZVxuICovXG5mdW5jdGlvbiBfZ2V0Q29uZmlnKGNvbmZpZ0ZpbGVOYW1lKSB7XG4gIGNvbnN0IGFwcGRpciA9IHByb2Nlc3MuZW52LlBXRCB8fCBwcm9jZXNzLmN3ZCgpO1xuICBjb25zdCBjdXN0b21fY29uZmlnX2ZpbGVuYW1lID0gcGF0aC5qb2luKGFwcGRpciwgY29uZmlnRmlsZU5hbWUpO1xuICBsZXQgdXNlckNvbmZpZyA9IHt9O1xuXG4gIGlmIChmaWxlRXhpc3RzKGN1c3RvbV9jb25maWdfZmlsZW5hbWUpKSB7XG4gICAgdXNlckNvbmZpZyA9IGZzLnJlYWRGaWxlU3luYyhjdXN0b21fY29uZmlnX2ZpbGVuYW1lLCB7XG4gICAgICBlbmNvZGluZzogJ3V0ZjgnXG4gICAgfSk7XG4gICAgdXNlckNvbmZpZyA9IEpTT04ucGFyc2UodXNlckNvbmZpZyk7XG4gIH0gZWxzZSB7XG4gICAgLy9jb25zb2xlLndhcm4oJ0NvdWxkIG5vdCBmaW5kIGNvbmZpZ3VyYXRpb24gZmlsZSBhdCAnICsgY3VzdG9tX2NvbmZpZ19maWxlbmFtZSk7XG4gIH1cbiAgcmV0dXJuIHVzZXJDb25maWc7XG59XG5cbmZ1bmN0aW9uIGRlY29kZUZpbGVQYXRoIChmaWxlUGF0aCkge1xuICBjb25zdCBtYXRjaCA9IGZpbGVQYXRoLm1hdGNoKC97KC4qKX1cXC8oLiopJC8pO1xuICBpZiAoIW1hdGNoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBGYWlsZWQgdG8gZGVjb2RlIHNhc3MgcGF0aDogJHtmaWxlUGF0aH1gKTtcbiAgfVxuXG4gIGlmIChtYXRjaFsxXSA9PT0gJycpIHtcbiAgICAvLyBhcHBcbiAgICByZXR1cm4gbWF0Y2hbMl07XG4gIH1cblxuICByZXR1cm4gYHBhY2thZ2VzLyR7bWF0Y2hbMV19LyR7bWF0Y2hbMl19YDtcbn1cblxuZnVuY3Rpb24gZmlsZUV4aXN0cyhmaWxlKSB7XG4gIGlmIChmcy5zdGF0U3luYyl7XG4gICAgdHJ5IHtcbiAgICAgIGZzLnN0YXRTeW5jKGZpbGUpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG4gIH0gZWxzZSBpZiAoZnMuZXhpc3RzU3luYykge1xuICAgIHJldHVybiBmcy5leGlzdHNTeW5jKGZpbGUpO1xuICB9XG59Il19
