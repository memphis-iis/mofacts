(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var CachingCompiler = Package['caching-compiler'].CachingCompiler;
var MultiFileCachingCompiler = Package['caching-compiler'].MultiFileCachingCompiler;
var ECMAScript = Package.ecmascript.ECMAScript;
var TemplatingTools = Package['templating-tools'].TemplatingTools;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var CachingHtmlCompiler;

var require = meteorInstall({"node_modules":{"meteor":{"caching-html-compiler":{"caching-html-compiler.js":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                               //
// packages/caching-html-compiler/caching-html-compiler.js                                                       //
//                                                                                                               //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                 //
let isEmpty;
module.link("lodash.isempty", {
  default(v) {
    isEmpty = v;
  }

}, 0);
const path = Plugin.path; // The CompileResult type for this CachingCompiler is the return value of
// htmlScanner.scan: a {js, head, body, bodyAttrs} object.

CachingHtmlCompiler = class CachingHtmlCompiler extends CachingCompiler {
  /**
   * Constructor for CachingHtmlCompiler
   * @param  {String} name The name of the compiler, printed in errors -
   * should probably always be the same as the name of the build
   * plugin/package
   * @param  {Function} tagScannerFunc Transforms a template file (commonly
   * .html) into an array of Tags
   * @param  {Function} tagHandlerFunc Transforms an array of tags into a
   * results object with js, body, head, and bodyAttrs properties
   */
  constructor(name, tagScannerFunc, tagHandlerFunc) {
    super({
      compilerName: name,
      defaultCacheSize: 1024 * 1024 * 10
    });
    this._bodyAttrInfo = null;
    this.tagScannerFunc = tagScannerFunc;
    this.tagHandlerFunc = tagHandlerFunc;
  } // Implements method from CachingCompilerBase


  compileResultSize(compileResult) {
    function lengthOrZero(field) {
      return field ? field.length : 0;
    }

    return lengthOrZero(compileResult.head) + lengthOrZero(compileResult.body) + lengthOrZero(compileResult.js);
  } // Overrides method from CachingCompiler


  processFilesForTarget(inputFiles) {
    this._bodyAttrInfo = {};
    return super.processFilesForTarget(inputFiles);
  } // Implements method from CachingCompilerBase


  getCacheKey(inputFile) {
    // Note: the path is only used for errors, so it doesn't have to be part
    // of the cache key.
    return [inputFile.getArch(), inputFile.getSourceHash(), inputFile.hmrAvailable && inputFile.hmrAvailable()];
  } // Implements method from CachingCompiler


  compileOneFile(inputFile) {
    const contents = inputFile.getContentsAsString();
    const inputPath = inputFile.getPathInPackage();

    try {
      const tags = this.tagScannerFunc({
        sourceName: inputPath,
        contents: contents,
        tagNames: ["body", "head", "template"]
      });
      return this.tagHandlerFunc(tags, inputFile.hmrAvailable && inputFile.hmrAvailable());
    } catch (e) {
      if (e instanceof TemplatingTools.CompileError) {
        inputFile.error({
          message: e.message,
          line: e.line
        });
        return null;
      } else {
        throw e;
      }
    }
  } // Implements method from CachingCompilerBase


  addCompileResult(inputFile, compileResult) {
    let allJavaScript = "";

    if (compileResult.head) {
      inputFile.addHtml({
        section: "head",
        data: compileResult.head
      });
    }

    if (compileResult.body) {
      inputFile.addHtml({
        section: "body",
        data: compileResult.body
      });
    }

    if (compileResult.js) {
      allJavaScript += compileResult.js;
    }

    if (!isEmpty(compileResult.bodyAttrs)) {
      Object.keys(compileResult.bodyAttrs).forEach(attr => {
        const value = compileResult.bodyAttrs[attr];

        if (this._bodyAttrInfo.hasOwnProperty(attr) && this._bodyAttrInfo[attr].value !== value) {
          // two conflicting attributes on <body> tags in two different template
          // files
          inputFile.error({
            message: "<body> declarations have conflicting values for the '".concat(attr, "' ") + "attribute in the following files: " + this._bodyAttrInfo[attr].inputFile.getPathInPackage() + ", ".concat(inputFile.getPathInPackage())
          });
        } else {
          this._bodyAttrInfo[attr] = {
            inputFile,
            value
          };
        }
      }); // Add JavaScript code to set attributes on body

      allJavaScript += "Meteor.startup(function() {\n  var attrs = ".concat(JSON.stringify(compileResult.bodyAttrs), ";\n  for (var prop in attrs) {\n    document.body.setAttribute(prop, attrs[prop]);\n  }\n});\n");
    }

    if (allJavaScript) {
      const filePath = inputFile.getPathInPackage(); // XXX this path manipulation may be unnecessarily complex

      let pathPart = path.dirname(filePath);
      if (pathPart === '.') pathPart = '';
      if (pathPart.length && pathPart !== path.sep) pathPart = pathPart + path.sep;
      const ext = path.extname(filePath);
      const basename = path.basename(filePath, ext); // XXX generate a source map

      inputFile.addJavaScript({
        path: path.join(pathPart, "template." + basename + ".js"),
        data: allJavaScript
      });
    }
  }

};
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"node_modules":{"lodash.isempty":{"package.json":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                               //
// node_modules/meteor/caching-html-compiler/node_modules/lodash.isempty/package.json                            //
//                                                                                                               //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                 //
module.exports = {
  "name": "lodash.isempty",
  "version": "4.4.0"
};

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                               //
// node_modules/meteor/caching-html-compiler/node_modules/lodash.isempty/index.js                                //
//                                                                                                               //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                 //
module.useNode();
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});

require("/node_modules/meteor/caching-html-compiler/caching-html-compiler.js");

/* Exports */
Package._define("caching-html-compiler", {
  CachingHtmlCompiler: CachingHtmlCompiler
});

})();




//# sourceURL=meteor://💻app/packages/caching-html-compiler.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvY2FjaGluZy1odG1sLWNvbXBpbGVyL2NhY2hpbmctaHRtbC1jb21waWxlci5qcyJdLCJuYW1lcyI6WyJpc0VtcHR5IiwibW9kdWxlIiwibGluayIsImRlZmF1bHQiLCJ2IiwicGF0aCIsIlBsdWdpbiIsIkNhY2hpbmdIdG1sQ29tcGlsZXIiLCJDYWNoaW5nQ29tcGlsZXIiLCJjb25zdHJ1Y3RvciIsIm5hbWUiLCJ0YWdTY2FubmVyRnVuYyIsInRhZ0hhbmRsZXJGdW5jIiwiY29tcGlsZXJOYW1lIiwiZGVmYXVsdENhY2hlU2l6ZSIsIl9ib2R5QXR0ckluZm8iLCJjb21waWxlUmVzdWx0U2l6ZSIsImNvbXBpbGVSZXN1bHQiLCJsZW5ndGhPclplcm8iLCJmaWVsZCIsImxlbmd0aCIsImhlYWQiLCJib2R5IiwianMiLCJwcm9jZXNzRmlsZXNGb3JUYXJnZXQiLCJpbnB1dEZpbGVzIiwiZ2V0Q2FjaGVLZXkiLCJpbnB1dEZpbGUiLCJnZXRBcmNoIiwiZ2V0U291cmNlSGFzaCIsImhtckF2YWlsYWJsZSIsImNvbXBpbGVPbmVGaWxlIiwiY29udGVudHMiLCJnZXRDb250ZW50c0FzU3RyaW5nIiwiaW5wdXRQYXRoIiwiZ2V0UGF0aEluUGFja2FnZSIsInRhZ3MiLCJzb3VyY2VOYW1lIiwidGFnTmFtZXMiLCJlIiwiVGVtcGxhdGluZ1Rvb2xzIiwiQ29tcGlsZUVycm9yIiwiZXJyb3IiLCJtZXNzYWdlIiwibGluZSIsImFkZENvbXBpbGVSZXN1bHQiLCJhbGxKYXZhU2NyaXB0IiwiYWRkSHRtbCIsInNlY3Rpb24iLCJkYXRhIiwiYm9keUF0dHJzIiwiT2JqZWN0Iiwia2V5cyIsImZvckVhY2giLCJhdHRyIiwidmFsdWUiLCJoYXNPd25Qcm9wZXJ0eSIsIkpTT04iLCJzdHJpbmdpZnkiLCJmaWxlUGF0aCIsInBhdGhQYXJ0IiwiZGlybmFtZSIsInNlcCIsImV4dCIsImV4dG5hbWUiLCJiYXNlbmFtZSIsImFkZEphdmFT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YUFBTCxDQUFtQnVDLElBQW5CLElBQTJCO0FBQUMzQixxQkFBRDtBQUFZNEI7QUFBWixXQUEzQjtBQUNEO0FBQ0YsT0FoQkQsRUFEcUMsQ0FtQnJDOztBQUNBVCxtQkFBYSx5REFFSFcsSUFBSSxDQUFDQyxTQUFMLENBQWV6QyxhQUFhLENBQUNpQyxTQUE3QixDQUZHLG1HQUFiO0FBUUQ7O0FBR0QsUUFBSUosYUFBSixFQUFtQjtBQUNqQixZQUFNYSxRQUFRLEdBQUdoQyxTQUFTLENBQUNRLGdCQUFWLEVBQWpCLENBRGlCLENBRWpCOztBQUNBLFVBQUl5QixRQUFRLEdBQUd2RCxJQUFJLENBQUN3RCxPQUFMLENBQWFGLFFBQWIsQ0FBZjtBQUNBLFVBQUlDLFFBQVEsS0FBSyxHQUFqQixFQUNFQSxRQUFRLEdBQUcsRUFBWDtBQUNGLFVBQUlBLFFBQVEsQ0FBQ3hDLE1BQVQsSUFBbUJ3QyxRQUFRLEtBQUt2RCxJQUFJLENBQUN5RCxHQUF6QyxFQUNFRixRQUFRLEdBQUdBLFFBQVEsR0FBR3ZELElBQUksQ0FBQ3lELEdBQTNCO0FBQ0YsWUFBTUMsR0FBRyxHQUFHMUQsSUFBSSxDQUFDMkQsT0FBTCxDQUFhTCxRQUFiLENBQVo7QUFDQSxZQUFNTSxRQUFRLEdBQUc1RCxJQUFJLENBQUM0RCxRQUFMLENBQWNOLFFBQWQsRUFBd0JJLEdBQXhCLENBQWpCLENBVGlCLENBV2pCOztBQUVBcEMsZUFBUyxDQUFDdUMsYUFBVixDQUF3QjtBQUN0QjdELFlBQUksRUFBRUEsSUFBSSxDQUFDOEQsSUFBTCxDQUFVUCxRQUFWLEVBQW9CLGNBQWNLLFFBQWQsR0FBeUIsS0FBN0MsQ0FEZ0I7QUFFdEJoQixZQUFJLEVBQUVIO0FBRmdCLE9BQXhCO0FBSUQ7QUFDRjs7QUEzSXFFLENBQXhFLEMiLCJmaWxlIjoiL3BhY2thZ2VzL2NhY2hpbmctaHRtbC1jb21waWxlci5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBpc0VtcHR5IGZyb20gJ2xvZGFzaC5pc2VtcHR5JztcblxuY29uc3QgcGF0aCA9IFBsdWdpbi5wYXRoO1xuXG4vLyBUaGUgQ29tcGlsZVJlc3VsdCB0eXBlIGZvciB0aGlzIENhY2hpbmdDb21waWxlciBpcyB0aGUgcmV0dXJuIHZhbHVlIG9mXG4vLyBodG1sU2Nhbm5lci5zY2FuOiBhIHtqcywgaGVhZCwgYm9keSwgYm9keUF0dHJzfSBvYmplY3QuXG5DYWNoaW5nSHRtbENvbXBpbGVyID0gY2xhc3MgQ2FjaGluZ0h0bWxDb21waWxlciBleHRlbmRzIENhY2hpbmdDb21waWxlciB7XG4gIC8qKlxuICAgKiBDb25zdHJ1Y3RvciBmb3IgQ2FjaGluZ0h0bWxDb21waWxlclxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IG5hbWUgVGhlIG5hbWUgb2YgdGhlIGNvbXBpbGVyLCBwcmludGVkIGluIGVycm9ycyAtXG4gICAqIHNob3VsZCBwcm9iYWJseSBhbHdheXMgYmUgdGhlIHNhbWUgYXMgdGhlIG5hbWUgb2YgdGhlIGJ1aWxkXG4gICAqIHBsdWdpbi9wYWNrYWdlXG4gICAqIEBwYXJhbSAge0Z1bmN0aW9ufSB0YWdTY2FubmVyRnVuYyBUcmFuc2Zvcm1zIGEgdGVtcGxhdGUgZmlsZSAoY29tbW9ubHlcbiAgICogLmh0bWwpIGludG8gYW4gYXJyYXkgb2YgVGFnc1xuICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gdGFnSGFuZGxlckZ1bmMgVHJhbnNmb3JtcyBhbiBhcnJheSBvZiB0YWdzIGludG8gYVxuICAgKiByZXN1bHRzIG9iamVjdCB3aXRoIGpzLCBib2R5LCBoZWFkLCBhbmQgYm9keUF0dHJzIHByb3BlcnRpZXNcbiAgICovXG4gIGNvbnN0cnVjdG9yKG5hbWUsIHRhZ1NjYW5uZXJGdW5jLCB0YWdIYW5kbGVyRnVuYykge1xuICAgIHN1cGVyKHtcbiAgICAgIGNvbXBpbGVyTmFtZTogbmFtZSxcbiAgICAgIGRlZmF1bHRDYWNoZVNpemU6IDEwMjQqMTAyNCoxMCxcbiAgICB9KTtcblxuICAgIHRoaXMuX2JvZHlBdHRySW5mbyA9IG51bGw7XG5cbiAgICB0aGlzLnRhZ1NjYW5uZXJGdW5jID0gdGFnU2Nhbm5lckZ1bmM7XG4gICAgdGhpcy50YWdIYW5kbGVyRnVuYyA9IHRhZ0hhbmRsZXJGdW5jO1xuICB9XG5cbiAgLy8gSW1wbGVtZW50cyBtZXRob2QgZnJvbSBDYWNoaW5nQ29tcGlsZXJCYXNlXG4gIGNvbXBpbGVSZXN1bHRTaXplKGNvbXBpbGVSZXN1bHQpIHtcbiAgICBmdW5jdGlvbiBsZW5ndGhPclplcm8oZmllbGQpIHtcbiAgICAgIHJldHVybiBmaWVsZCA/IGZpZWxkLmxlbmd0aCA6IDA7XG4gICAgfVxuICAgIHJldHVybiBsZW5ndGhPclplcm8oY29tcGlsZVJlc3VsdC5oZWFkKSArIGxlbmd0aE9yWmVybyhjb21waWxlUmVzdWx0LmJvZHkpICtcbiAgICAgIGxlbmd0aE9yWmVybyhjb21waWxlUmVzdWx0LmpzKTtcbiAgfVxuXG4gIC8vIE92ZXJyaWRlcyBtZXRob2QgZnJvbSBDYWNoaW5nQ29tcGlsZXJcbiAgcHJvY2Vzc0ZpbGVzRm9yVGFyZ2V0KGlucHV0RmlsZXMpIHtcbiAgICB0aGlzLl9ib2R5QXR0ckluZm8gPSB7fTtcbiAgICByZXR1cm4gc3VwZXIucHJvY2Vzc0ZpbGVzRm9yVGFyZ2V0KGlucHV0RmlsZXMpO1xuICB9XG5cbiAgLy8gSW1wbGVtZW50cyBtZXRob2QgZnJvbSBDYWNoaW5nQ29tcGlsZXJCYXNlXG4gIGdldENhY2hlS2V5KGlucHV0RmlsZSkge1xuICAgIC8vIE5vdGU6IHRoZSBwYXRoIGlzIG9ubHkgdXNlZCBmb3IgZXJyb3JzLCBzbyBpdCBkb2Vzbid0IGhhdmUgdG8gYmUgcGFydFxuICAgIC8vIG9mIHRoZSBjYWNoZSBrZXkuXG4gICAgcmV0dXJuIFtcbiAgICAgIGlucHV0RmlsZS5nZXRBcmNoKCksXG4gICAgICBpbnB1dEZpbGUuZ2V0U291cmNlSGFzaCgpLFxuICAgICAgaW5wdXRGaWxlLmhtckF2YWlsYWJsZSAmJiBpbnB1dEZpbGUuaG1yQXZhaWxhYmxlKClcbiAgICBdO1xuICB9XG5cbiAgLy8gSW1wbGVtZW50cyBtZXRob2QgZnJvbSBDYWNoaW5nQ29tcGlsZXJcbiAgY29tcGlsZU9uZUZpbGUoaW5wdXRGaWxlKSB7XG4gICAgY29uc3QgY29udGVudHMgPSBpbnB1dEZpbGUuZ2V0Q29udGVudHNBc1N0cmluZygpO1xuICAgIGNvbnN0IGlucHV0UGF0aCA9IGlucHV0RmlsZS5nZXRQYXRoSW5QYWNrYWdlKCk7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHRhZ3MgPSB0aGlzLnRhZ1NjYW5uZXJGdW5jKHtcbiAgICAgICAgc291cmNlTmFtZTogaW5wdXRQYXRoLFxuICAgICAgICBjb250ZW50czogY29udGVudHMsXG4gICAgICAgIHRhZ05hbWVzOiBbXCJib2R5XCIsIFwiaGVhZFwiLCBcInRlbXBsYXRlXCJdXG4gICAgICB9KTtcblxuICAgICAgcmV0dXJuIHRoaXMudGFnSGFuZGxlckZ1bmModGFncywgaW5wdXRGaWxlLmhtckF2YWlsYWJsZSAmJiBpbnB1dEZpbGUuaG1yQXZhaWxhYmxlKCkpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGlmIChlIGluc3RhbmNlb2YgVGVtcGxhdGluZ1Rvb2xzLkNvbXBpbGVFcnJvcikge1xuICAgICAgICBpbnB1dEZpbGUuZXJyb3Ioe1xuICAgICAgICAgIG1lc3NhZ2U6IGUubWVzc2FnZSxcbiAgICAgICAgICBsaW5lOiBlLmxpbmVcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgZTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBJbXBsZW1lbnRzIG1ldGhvZCBmcm9tIENhY2hpbmdDb21waWxlckJhc2VcbiAgYWRkQ29tcGlsZVJlc3VsdChpbnB1dEZpbGUsIGNvbXBpbGVSZXN1bHQpIHtcbiAgICBsZXQgYWxsSmF2YVNjcmlwdCA9IFwiXCI7XG5cbiAgICBpZiAoY29tcGlsZVJlc3VsdC5oZWFkKSB7XG4gICAgICBpbnB1dEZpbGUuYWRkSHRtbCh7IHNlY3Rpb246IFwiaGVhZFwiLCBkYXRhOiBjb21waWxlUmVzdWx0LmhlYWQgfSk7XG4gICAgfVxuXG4gICAgaWYgKGNvbXBpbGVSZXN1bHQuYm9keSkge1xuICAgICAgaW5wdXRGaWxlLmFkZEh0bWwoeyBzZWN0aW9uOiBcImJvZHlcIiwgZGF0YTogY29tcGlsZVJlc3VsdC5ib2R5IH0pO1xuICAgIH1cblxuICAgIGlmIChjb21waWxlUmVzdWx0LmpzKSB7XG4gICAgICBhbGxKYXZhU2NyaXB0ICs9IGNvbXBpbGVSZXN1bHQuanM7XG4gICAgfVxuXG4gICAgaWYgKCFpc0VtcHR5KGNvbXBpbGVSZXN1bHQuYm9keUF0dHJzKSkge1xuICAgICAgT2JqZWN0LmtleXMoY29tcGlsZVJlc3VsdC5ib2R5QXR0cnMpLmZvckVhY2goKGF0dHIpID0+IHtcbiAgICAgICAgY29uc3QgdmFsdWUgPSBjb21waWxlUmVzdWx0LmJvZHlBdHRyc1thdHRyXTtcbiAgICAgICAgaWYgKHRoaXMuX2JvZHlBdHRySW5mby5oYXNPd25Qcm9wZXJ0eShhdHRyKSAmJlxuICAgICAgICAgICAgdGhpcy5fYm9keUF0dHJJbmZvW2F0dHJdLnZhbHVlICE9PSB2YWx1ZSkge1xuICAgICAgICAgIC8vIHR3byBjb25mbGljdGluZyBhdHRyaWJ1dGVzIG9uIDxib2R5PiB0YWdzIGluIHR3byBkaWZmZXJlbnQgdGVtcGxhdGVcbiAgICAgICAgICAvLyBmaWxlc1xuICAgICAgICAgIGlucHV0RmlsZS5lcnJvcih7XG4gICAgICAgICAgICBtZXNzYWdlOlxuICAgICAgICAgICAgYDxib2R5PiBkZWNsYXJhdGlvbnMgaGF2ZSBjb25mbGljdGluZyB2YWx1ZXMgZm9yIHRoZSAnJHsgYXR0ciB9JyBgICtcbiAgICAgICAgICAgICAgYGF0dHJpYnV0ZSBpbiB0aGUgZm9sbG93aW5nIGZpbGVzOiBgICtcbiAgICAgICAgICAgICAgdGhpcy5fYm9keUF0dHJJbmZvW2F0dHJdLmlucHV0RmlsZS5nZXRQYXRoSW5QYWNrYWdlKCkgK1xuICAgICAgICAgICAgICBgLCAkeyBpbnB1dEZpbGUuZ2V0UGF0aEluUGFja2FnZSgpIH1gXG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5fYm9keUF0dHJJbmZvW2F0dHJdID0ge2lucHV0RmlsZSwgdmFsdWV9O1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgLy8gQWRkIEphdmFTY3JpcHQgY29kZSB0byBzZXQgYXR0cmlidXRlcyBvbiBib2R5XG4gICAgICBhbGxKYXZhU2NyaXB0ICs9XG5gTWV0ZW9yLnN0YXJ0dXAoZnVuY3Rpb24oKSB7XG4gIHZhciBhdHRycyA9ICR7SlNPTi5zdHJpbmdpZnkoY29tcGlsZVJlc3VsdC5ib2R5QXR0cnMpfTtcbiAgZm9yICh2YXIgcHJvcCBpbiBhdHRycykge1xuICAgIGRvY3VtZW50LmJvZHkuc2V0QXR0cmlidXRlKHByb3AsIGF0dHJzW3Byb3BdKTtcbiAgfVxufSk7XG5gO1xuICAgIH1cbiAgICBcblxuICAgIGlmIChhbGxKYXZhU2NyaXB0KSB7XG4gICAgICBjb25zdCBmaWxlUGF0aCA9IGlucHV0RmlsZS5nZXRQYXRoSW5QYWNrYWdlKCk7XG4gICAgICAvLyBYWFggdGhpcyBwYXRoIG1hbmlwdWxhdGlvbiBtYXkgYmUgdW5uZWNlc3NhcmlseSBjb21wbGV4XG4gICAgICBsZXQgcGF0aFBhcnQgPSBwYXRoLmRpcm5hbWUoZmlsZVBhdGgpO1xuICAgICAgaWYgKHBhdGhQYXJ0ID09PSAnLicpXG4gICAgICAgIHBhdGhQYXJ0ID0gJyc7XG4gICAgICBpZiAocGF0aFBhcnQubGVuZ3RoICYmIHBhdGhQYXJ0ICE9PSBwYXRoLnNlcClcbiAgICAgICAgcGF0aFBhcnQgPSBwYXRoUGFydCArIHBhdGguc2VwO1xuICAgICAgY29uc3QgZXh0ID0gcGF0aC5leHRuYW1lKGZpbGVQYXRoKTtcbiAgICAgIGNvbnN0IGJhc2VuYW1lID0gcGF0aC5iYXNlbmFtZShmaWxlUGF0aCwgZXh0KTtcblxuICAgICAgLy8gWFhYIGdlbmVyYXRlIGEgc291cmNlIG1hcFxuXG4gICAgICBpbnB1dEZpbGUuYWRkSmF2YVNjcmlwdCh7XG4gICAgICAgIHBhdGg6IHBhdGguam9pbihwYXRoUGFydCwgXCJ0ZW1wbGF0ZS5cIiArIGJhc2VuYW1lICsgXCIuanNcIiksXG4gICAgICAgIGRhdGE6IGFsbEphdmFTY3JpcHRcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxufVxuIl19
