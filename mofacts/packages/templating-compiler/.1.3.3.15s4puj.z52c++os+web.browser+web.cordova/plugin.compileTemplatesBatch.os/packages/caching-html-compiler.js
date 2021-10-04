(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var _ = Package.underscore._;
var CachingCompiler = Package['caching-compiler'].CachingCompiler;
var MultiFileCachingCompiler = Package['caching-compiler'].MultiFileCachingCompiler;
var ECMAScript = Package.ecmascript.ECMAScript;
var TemplatingTools = Package['templating-tools'].TemplatingTools;
var meteorInstall = Package.modules.meteorInstall;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;
var Symbol = Package['ecmascript-runtime-server'].Symbol;
var Map = Package['ecmascript-runtime-server'].Map;
var Set = Package['ecmascript-runtime-server'].Set;

/* Package-scope variables */
var CachingHtmlCompiler;

var require = meteorInstall({"node_modules":{"meteor":{"caching-html-compiler":{"caching-html-compiler.js":function(require){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                 //
// packages/caching-html-compiler/caching-html-compiler.js                                                         //
//                                                                                                                 //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                   //
var _classCallCheck2 = require("babel-runtime/helpers/classCallCheck");                                            //
                                                                                                                   //
var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);                                                   //
                                                                                                                   //
var _possibleConstructorReturn2 = require("babel-runtime/helpers/possibleConstructorReturn");                      //
                                                                                                                   //
var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);                             //
                                                                                                                   //
var _inherits2 = require("babel-runtime/helpers/inherits");                                                        //
                                                                                                                   //
var _inherits3 = _interopRequireDefault(_inherits2);                                                               //
                                                                                                                   //
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }                  //
                                                                                                                   //
var path = Plugin.path; // The CompileResult type for this CachingCompiler is the return value of                  // 1
// htmlScanner.scan: a {js, head, body, bodyAttrs} object.                                                         // 4
                                                                                                                   //
CachingHtmlCompiler = function (_CachingCompiler) {                                                                // 5
  (0, _inherits3.default)(CachingHtmlCompiler, _CachingCompiler);                                                  // 5
                                                                                                                   //
  /**                                                                                                              // 6
   * Constructor for CachingHtmlCompiler                                                                           //
   * @param  {String} name The name of the compiler, printed in errors -                                           //
   * should probably always be the same as the name of the build                                                   //
   * plugin/package                                                                                                //
   * @param  {Function} tagScannerFunc Transforms a template file (commonly                                        //
   * .html) into an array of Tags                                                                                  //
   * @param  {Function} tagHandlerFunc Transforms an array of tags into a                                          //
   * results object with js, body, head, and bodyAttrs properties                                                  //
   */function CachingHtmlCompiler(name, tagScannerFunc, tagHandlerFunc) {                                          //
    (0, _classCallCheck3.default)(this, CachingHtmlCompiler);                                                      // 16
                                                                                                                   //
    var _this = (0, _possibleConstructorReturn3.default)(this, _CachingCompiler.call(this, {                       // 16
      compilerName: name,                                                                                          // 18
      defaultCacheSize: 1024 * 1024 * 10                                                                           // 19
    }));                                                                                                           // 17
                                                                                                                   //
    _this._bodyAttrInfo = null;                                                                                    // 22
    _this.tagScannerFunc = tagScannerFunc;                                                                         // 24
    _this.tagHandlerFunc = tagHandlerFunc;                                                                         // 25
    return _this;                                                                                                  // 16
  } // Implements method from CachingCompilerBase                                                                  // 26
                                                                                                                   //
                                                                                                                   //
  CachingHtmlCompiler.prototype.compileResultSize = function () {                                                  // 5
    function compileResultSize(compileResult) {                                                                    // 5
      function lengthOrZero(field) {                                                                               // 30
        return field ? field.length : 0;                                                                           // 31
      }                                                                                                            // 32
                                                                                                                   //
      return lengthOrZero(compileResult.head) + lengthOrZero(compileResult.body) + lengthOrZero(compileResult.js);
    }                                                                                                              // 35
                                                                                                                   //
    return compileResultSize;                                                                                      // 5
  }(); // Overrides method from CachingCompiler                                                                    // 5
                                                                                                                   //
                                                                                                                   //
  CachingHtmlCompiler.prototype.processFilesForTarget = function () {                                              // 5
    function processFilesForTarget(inputFiles) {                                                                   // 5
      this._bodyAttrInfo = {};                                                                                     // 39
                                                                                                                   //
      _CachingCompiler.prototype.processFilesForTarget.call(this, inputFiles);                                     // 40
    }                                                                                                              // 41
                                                                                                                   //
    return processFilesForTarget;                                                                                  // 5
  }(); // Implements method from CachingCompilerBase                                                               // 5
                                                                                                                   //
                                                                                                                   //
  CachingHtmlCompiler.prototype.getCacheKey = function () {                                                        // 5
    function getCacheKey(inputFile) {                                                                              // 5
      // Note: the path is only used for errors, so it doesn't have to be part                                     // 45
      // of the cache key.                                                                                         // 46
      return inputFile.getSourceHash();                                                                            // 47
    }                                                                                                              // 48
                                                                                                                   //
    return getCacheKey;                                                                                            // 5
  }(); // Implements method from CachingCompiler                                                                   // 5
                                                                                                                   //
                                                                                                                   //
  CachingHtmlCompiler.prototype.compileOneFile = function () {                                                     // 5
    function compileOneFile(inputFile) {                                                                           // 5
      var contents = inputFile.getContentsAsString();                                                              // 52
      var inputPath = inputFile.getPathInPackage();                                                                // 53
                                                                                                                   //
      try {                                                                                                        // 54
        var tags = this.tagScannerFunc({                                                                           // 55
          sourceName: inputPath,                                                                                   // 56
          contents: contents,                                                                                      // 57
          tagNames: ["body", "head", "template"]                                                                   // 58
        });                                                                                                        // 55
        return this.tagHandlerFunc(tags);                                                                          // 61
      } catch (e) {                                                                                                // 62
        if (e instanceof TemplatingTools.CompileError) {                                                           // 63
          inputFile.error({                                                                                        // 64
            message: e.message,                                                                                    // 65
            line: e.line                                                                                           // 66
          });                                                                                                      // 64
          return null;                                                                                             // 68
        } else {                                                                                                   // 69
          throw e;                                                                                                 // 70
        }                                                                                                          // 71
      }                                                                                                            // 72
    }                                                                                                              // 73
                                                                                                                   //
    return compileOneFile;                                                                                         // 5
  }(); // Implements method from CachingCompilerBase                                                               // 5
                                                                                                                   //
                                                                                                                   //
  CachingHtmlCompiler.prototype.addCompileResult = function () {                                                   // 5
    function addCompileResult(inputFile, compileResult) {                                                          // 5
      var _this2 = this;                                                                                           // 76
                                                                                                                   //
      var allJavaScript = "";                                                                                      // 77
                                                                                                                   //
      if (compileResult.head) {                                                                                    // 79
        inputFile.addHtml({                                                                                        // 80
          section: "head",                                                                                         // 80
          data: compileResult.head                                                                                 // 80
        });                                                                                                        // 80
      }                                                                                                            // 81
                                                                                                                   //
      if (compileResult.body) {                                                                                    // 83
        inputFile.addHtml({                                                                                        // 84
          section: "body",                                                                                         // 84
          data: compileResult.body                                                                                 // 84
        });                                                                                                        // 84
      }                                                                                                            // 85
                                                                                                                   //
      if (compileResult.js) {                                                                                      // 87
        allJavaScript += compileResult.js;                                                                         // 88
      }                                                                                                            // 89
                                                                                                                   //
      if (!_.isEmpty(compileResult.bodyAttrs)) {                                                                   // 91
        Object.keys(compileResult.bodyAttrs).forEach(function (attr) {                                             // 92
          var value = compileResult.bodyAttrs[attr];                                                               // 93
                                                                                                                   //
          if (_this2._bodyAttrInfo.hasOwnProperty(attr) && _this2._bodyAttrInfo[attr].value !== value) {           // 94
            // two conflicting attributes on <body> tags in two different template                                 // 96
            // files                                                                                               // 97
            inputFile.error({                                                                                      // 98
              message: "<body> declarations have conflicting values for the '" + attr + "' " + "attribute in the following files: " + _this2._bodyAttrInfo[attr].inputFile.getPathInPackage() + (", " + inputFile.getPathInPackage())
            });                                                                                                    // 98
          } else {                                                                                                 // 105
            _this2._bodyAttrInfo[attr] = {                                                                         // 106
              inputFile: inputFile,                                                                                // 106
              value: value                                                                                         // 106
            };                                                                                                     // 106
          }                                                                                                        // 107
        }); // Add JavaScript code to set attributes on body                                                       // 108
                                                                                                                   //
        allJavaScript += "Meteor.startup(function() {\n  var attrs = " + JSON.stringify(compileResult.bodyAttrs) + ";\n  for (var prop in attrs) {\n    document.body.setAttribute(prop, attrs[prop]);\n  }\n});\n";
      }                                                                                                            // 119
                                                                                                                   //
      if (allJavaScript) {                                                                                         // 122
        var filePath = inputFile.getPathInPackage(); // XXX this path manipulation may be unnecessarily complex    // 123
                                                                                                                   //
        var pathPart = path.dirname(filePath);                                                                     // 125
        if (pathPart === '.') pathPart = '';                                                                       // 126
        if (pathPart.length && pathPart !== path.sep) pathPart = pathPart + path.sep;                              // 128
        var ext = path.extname(filePath);                                                                          // 130
        var basename = path.basename(filePath, ext); // XXX generate a source map                                  // 131
                                                                                                                   //
        inputFile.addJavaScript({                                                                                  // 135
          path: path.join(pathPart, "template." + basename + ".js"),                                               // 136
          data: allJavaScript                                                                                      // 137
        });                                                                                                        // 135
      }                                                                                                            // 139
    }                                                                                                              // 140
                                                                                                                   //
    return addCompileResult;                                                                                       // 5
  }();                                                                                                             // 5
                                                                                                                   //
  return CachingHtmlCompiler;                                                                                      // 5
}(CachingCompiler);                                                                                                // 5
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/caching-html-compiler/caching-html-compiler.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
(function (pkg, symbols) {
  for (var s in symbols)
    (s in pkg) || (pkg[s] = symbols[s]);
})(Package['caching-html-compiler'] = {}, {
  CachingHtmlCompiler: CachingHtmlCompiler
});

})();





//# sourceURL=meteor://💻app/packages/caching-html-compiler.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvY2FjaGluZy1odG1sLWNvbXBpbGVyL2NhY2hpbmctaHRtbC1jb21waWxlci5qcyJdLCJuYW1lcyI6WyJwYXRoIiwiUGx1Z2luIiwiQ2FjaGluZ0h0bWxDb21waWxlciIsIm5hbWUiLCJ0YWdTY2FubmVyRnVuYyIsInRhZ0hhbmRsZXJGdW5jIiwiY29tcGlsZXJOYW1lIiwiZGVmYXVsdENhY2hlU2l6ZSIsIl9ib2R5QXR0ckluZm8iLCJjb21waWxlUmVzdWx0U2l6ZSIsImNvbXBpbGVSZXN1bHQiLCJsZW5ndGhPclplcm8iLCJmaWVsZCIsImxlbmd0aCIsImhlYWQiLCJib2R5IiwianMiLCJwcm9jZXNzRmlsZXNGb3JUYXJnZXQiLCJpbnB1dEZpbGVzIiwiZ2V0Q2FjaGVLZXkiLCJpbnB1dEZpbGUiLCJnZXRTb3VyY2VIYXNoIiwiY29tcGlsZU9uZUZpbGUiLCJjb250ZW50cyIsImdldENvbnRlbnRzQXNTdHJpbmciLCJpbnB1dFBhdGgiLCJnZXRQYXRoSW5QYWNrYWdlIiwidGFncyIsInNvdXJjZU5hbWUiLCJ0YWdOYW1lcyIsImUiLCJUZW1wbGF0aW5nVG9vbHMiLCJDb21waWxlRXJyb3IiLCJlcnJvciIsIm1lc3NhZ2UiLCJsaW5lIiwiYWRkQ29tcGlsZVJlc3VsdCIsImFsbEphdmFTY3JpcHQiLCJhZGRIdG1sIiwic2VjdGlvbiIsImRhdGEiLCJfIiwiaXNFbXB0eSIsImJvZHlBdHRycyIsIk9iamVjdCIsImtleXMiLCJmb3JFYWNoIiwiYXR0ciIsInZhbHVlIiwiaGFzT3duUHJvcGVydHkiLCJKU09OIiwic3RyaW5naWZ5IiwiZmlsZVBhdGgiLCJwYXRoUGFydCIsImRpcm5hbWUiLCJzZXAiLCJleHQiLCJleHRuYW1lIiwiYmFzZW5hbWUiLCJhZGRKYXZhU2NyaXB0Iiwiam9pbiIsIkNhY2hpbmdDb21waWxlciJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7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QUFqQixDQVRpQixDQVdqQjs7QUFFQXBDLGtCQUFVdUMsYUFBVixDQUF3QjtBQUN0QjNELGdCQUFNQSxLQUFLNEQsSUFBTCxDQUFVUCxRQUFWLEVBQW9CLGNBQWNLLFFBQWQsR0FBeUIsS0FBN0MsQ0FEZ0I7QUFFdEJsQixnQkFBTUg7QUFGZ0IsU0FBeEI7QUFJRDtBQUNGOztBQXZJSDtBQUFBOztBQUFBO0FBQUEsRUFBd0R3QixlQUF4RCxzRyIsImZpbGUiOiIvcGFja2FnZXMvY2FjaGluZy1odG1sLWNvbXBpbGVyLmpzIiwic291cmNlc0NvbnRlbnQiOlsiY29uc3QgcGF0aCA9IFBsdWdpbi5wYXRoO1xuXG4vLyBUaGUgQ29tcGlsZVJlc3VsdCB0eXBlIGZvciB0aGlzIENhY2hpbmdDb21waWxlciBpcyB0aGUgcmV0dXJuIHZhbHVlIG9mXG4vLyBodG1sU2Nhbm5lci5zY2FuOiBhIHtqcywgaGVhZCwgYm9keSwgYm9keUF0dHJzfSBvYmplY3QuXG5DYWNoaW5nSHRtbENvbXBpbGVyID0gY2xhc3MgQ2FjaGluZ0h0bWxDb21waWxlciBleHRlbmRzIENhY2hpbmdDb21waWxlciB7XG4gIC8qKlxuICAgKiBDb25zdHJ1Y3RvciBmb3IgQ2FjaGluZ0h0bWxDb21waWxlclxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IG5hbWUgVGhlIG5hbWUgb2YgdGhlIGNvbXBpbGVyLCBwcmludGVkIGluIGVycm9ycyAtXG4gICAqIHNob3VsZCBwcm9iYWJseSBhbHdheXMgYmUgdGhlIHNhbWUgYXMgdGhlIG5hbWUgb2YgdGhlIGJ1aWxkXG4gICAqIHBsdWdpbi9wYWNrYWdlXG4gICAqIEBwYXJhbSAge0Z1bmN0aW9ufSB0YWdTY2FubmVyRnVuYyBUcmFuc2Zvcm1zIGEgdGVtcGxhdGUgZmlsZSAoY29tbW9ubHlcbiAgICogLmh0bWwpIGludG8gYW4gYXJyYXkgb2YgVGFnc1xuICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gdGFnSGFuZGxlckZ1bmMgVHJhbnNmb3JtcyBhbiBhcnJheSBvZiB0YWdzIGludG8gYVxuICAgKiByZXN1bHRzIG9iamVjdCB3aXRoIGpzLCBib2R5LCBoZWFkLCBhbmQgYm9keUF0dHJzIHByb3BlcnRpZXNcbiAgICovXG4gIGNvbnN0cnVjdG9yKG5hbWUsIHRhZ1NjYW5uZXJGdW5jLCB0YWdIYW5kbGVyRnVuYykge1xuICAgIHN1cGVyKHtcbiAgICAgIGNvbXBpbGVyTmFtZTogbmFtZSxcbiAgICAgIGRlZmF1bHRDYWNoZVNpemU6IDEwMjQqMTAyNCoxMCxcbiAgICB9KTtcblxuICAgIHRoaXMuX2JvZHlBdHRySW5mbyA9IG51bGw7XG5cbiAgICB0aGlzLnRhZ1NjYW5uZXJGdW5jID0gdGFnU2Nhbm5lckZ1bmM7XG4gICAgdGhpcy50YWdIYW5kbGVyRnVuYyA9IHRhZ0hhbmRsZXJGdW5jO1xuICB9XG5cbiAgLy8gSW1wbGVtZW50cyBtZXRob2QgZnJvbSBDYWNoaW5nQ29tcGlsZXJCYXNlXG4gIGNvbXBpbGVSZXN1bHRTaXplKGNvbXBpbGVSZXN1bHQpIHtcbiAgICBmdW5jdGlvbiBsZW5ndGhPclplcm8oZmllbGQpIHtcbiAgICAgIHJldHVybiBmaWVsZCA/IGZpZWxkLmxlbmd0aCA6IDA7XG4gICAgfVxuICAgIHJldHVybiBsZW5ndGhPclplcm8oY29tcGlsZVJlc3VsdC5oZWFkKSArIGxlbmd0aE9yWmVybyhjb21waWxlUmVzdWx0LmJvZHkpICtcbiAgICAgIGxlbmd0aE9yWmVybyhjb21waWxlUmVzdWx0LmpzKTtcbiAgfVxuXG4gIC8vIE92ZXJyaWRlcyBtZXRob2QgZnJvbSBDYWNoaW5nQ29tcGlsZXJcbiAgcHJvY2Vzc0ZpbGVzRm9yVGFyZ2V0KGlucHV0RmlsZXMpIHtcbiAgICB0aGlzLl9ib2R5QXR0ckluZm8gPSB7fTtcbiAgICBzdXBlci5wcm9jZXNzRmlsZXNGb3JUYXJnZXQoaW5wdXRGaWxlcyk7XG4gIH1cblxuICAvLyBJbXBsZW1lbnRzIG1ldGhvZCBmcm9tIENhY2hpbmdDb21waWxlckJhc2VcbiAgZ2V0Q2FjaGVLZXkoaW5wdXRGaWxlKSB7XG4gICAgLy8gTm90ZTogdGhlIHBhdGggaXMgb25seSB1c2VkIGZvciBlcnJvcnMsIHNvIGl0IGRvZXNuJ3QgaGF2ZSB0byBiZSBwYXJ0XG4gICAgLy8gb2YgdGhlIGNhY2hlIGtleS5cbiAgICByZXR1cm4gaW5wdXRGaWxlLmdldFNvdXJjZUhhc2goKTtcbiAgfVxuXG4gIC8vIEltcGxlbWVudHMgbWV0aG9kIGZyb20gQ2FjaGluZ0NvbXBpbGVyXG4gIGNvbXBpbGVPbmVGaWxlKGlucHV0RmlsZSkge1xuICAgIGNvbnN0IGNvbnRlbnRzID0gaW5wdXRGaWxlLmdldENvbnRlbnRzQXNTdHJpbmcoKTtcbiAgICBjb25zdCBpbnB1dFBhdGggPSBpbnB1dEZpbGUuZ2V0UGF0aEluUGFja2FnZSgpO1xuICAgIHRyeSB7XG4gICAgICBjb25zdCB0YWdzID0gdGhpcy50YWdTY2FubmVyRnVuYyh7XG4gICAgICAgIHNvdXJjZU5hbWU6IGlucHV0UGF0aCxcbiAgICAgICAgY29udGVudHM6IGNvbnRlbnRzLFxuICAgICAgICB0YWdOYW1lczogW1wiYm9keVwiLCBcImhlYWRcIiwgXCJ0ZW1wbGF0ZVwiXVxuICAgICAgfSk7XG5cbiAgICAgIHJldHVybiB0aGlzLnRhZ0hhbmRsZXJGdW5jKHRhZ3MpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGlmIChlIGluc3RhbmNlb2YgVGVtcGxhdGluZ1Rvb2xzLkNvbXBpbGVFcnJvcikge1xuICAgICAgICBpbnB1dEZpbGUuZXJyb3Ioe1xuICAgICAgICAgIG1lc3NhZ2U6IGUubWVzc2FnZSxcbiAgICAgICAgICBsaW5lOiBlLmxpbmVcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgZTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBJbXBsZW1lbnRzIG1ldGhvZCBmcm9tIENhY2hpbmdDb21waWxlckJhc2VcbiAgYWRkQ29tcGlsZVJlc3VsdChpbnB1dEZpbGUsIGNvbXBpbGVSZXN1bHQpIHtcbiAgICBsZXQgYWxsSmF2YVNjcmlwdCA9IFwiXCI7XG5cbiAgICBpZiAoY29tcGlsZVJlc3VsdC5oZWFkKSB7XG4gICAgICBpbnB1dEZpbGUuYWRkSHRtbCh7IHNlY3Rpb246IFwiaGVhZFwiLCBkYXRhOiBjb21waWxlUmVzdWx0LmhlYWQgfSk7XG4gICAgfVxuXG4gICAgaWYgKGNvbXBpbGVSZXN1bHQuYm9keSkge1xuICAgICAgaW5wdXRGaWxlLmFkZEh0bWwoeyBzZWN0aW9uOiBcImJvZHlcIiwgZGF0YTogY29tcGlsZVJlc3VsdC5ib2R5IH0pO1xuICAgIH1cblxuICAgIGlmIChjb21waWxlUmVzdWx0LmpzKSB7XG4gICAgICBhbGxKYXZhU2NyaXB0ICs9IGNvbXBpbGVSZXN1bHQuanM7XG4gICAgfVxuXG4gICAgaWYgKCEgXy5pc0VtcHR5KGNvbXBpbGVSZXN1bHQuYm9keUF0dHJzKSkge1xuICAgICAgT2JqZWN0LmtleXMoY29tcGlsZVJlc3VsdC5ib2R5QXR0cnMpLmZvckVhY2goKGF0dHIpID0+IHtcbiAgICAgICAgY29uc3QgdmFsdWUgPSBjb21waWxlUmVzdWx0LmJvZHlBdHRyc1thdHRyXTtcbiAgICAgICAgaWYgKHRoaXMuX2JvZHlBdHRySW5mby5oYXNPd25Qcm9wZXJ0eShhdHRyKSAmJlxuICAgICAgICAgICAgdGhpcy5fYm9keUF0dHJJbmZvW2F0dHJdLnZhbHVlICE9PSB2YWx1ZSkge1xuICAgICAgICAgIC8vIHR3byBjb25mbGljdGluZyBhdHRyaWJ1dGVzIG9uIDxib2R5PiB0YWdzIGluIHR3byBkaWZmZXJlbnQgdGVtcGxhdGVcbiAgICAgICAgICAvLyBmaWxlc1xuICAgICAgICAgIGlucHV0RmlsZS5lcnJvcih7XG4gICAgICAgICAgICBtZXNzYWdlOlxuICAgICAgICAgICAgYDxib2R5PiBkZWNsYXJhdGlvbnMgaGF2ZSBjb25mbGljdGluZyB2YWx1ZXMgZm9yIHRoZSAnJHsgYXR0ciB9JyBgICtcbiAgICAgICAgICAgICAgYGF0dHJpYnV0ZSBpbiB0aGUgZm9sbG93aW5nIGZpbGVzOiBgICtcbiAgICAgICAgICAgICAgdGhpcy5fYm9keUF0dHJJbmZvW2F0dHJdLmlucHV0RmlsZS5nZXRQYXRoSW5QYWNrYWdlKCkgK1xuICAgICAgICAgICAgICBgLCAkeyBpbnB1dEZpbGUuZ2V0UGF0aEluUGFja2FnZSgpIH1gXG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5fYm9keUF0dHJJbmZvW2F0dHJdID0ge2lucHV0RmlsZSwgdmFsdWV9O1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgLy8gQWRkIEphdmFTY3JpcHQgY29kZSB0byBzZXQgYXR0cmlidXRlcyBvbiBib2R5XG4gICAgICBhbGxKYXZhU2NyaXB0ICs9XG5gTWV0ZW9yLnN0YXJ0dXAoZnVuY3Rpb24oKSB7XG4gIHZhciBhdHRycyA9ICR7SlNPTi5zdHJpbmdpZnkoY29tcGlsZVJlc3VsdC5ib2R5QXR0cnMpfTtcbiAgZm9yICh2YXIgcHJvcCBpbiBhdHRycykge1xuICAgIGRvY3VtZW50LmJvZHkuc2V0QXR0cmlidXRlKHByb3AsIGF0dHJzW3Byb3BdKTtcbiAgfVxufSk7XG5gO1xuICAgIH1cbiAgICBcblxuICAgIGlmIChhbGxKYXZhU2NyaXB0KSB7XG4gICAgICBjb25zdCBmaWxlUGF0aCA9IGlucHV0RmlsZS5nZXRQYXRoSW5QYWNrYWdlKCk7XG4gICAgICAvLyBYWFggdGhpcyBwYXRoIG1hbmlwdWxhdGlvbiBtYXkgYmUgdW5uZWNlc3NhcmlseSBjb21wbGV4XG4gICAgICBsZXQgcGF0aFBhcnQgPSBwYXRoLmRpcm5hbWUoZmlsZVBhdGgpO1xuICAgICAgaWYgKHBhdGhQYXJ0ID09PSAnLicpXG4gICAgICAgIHBhdGhQYXJ0ID0gJyc7XG4gICAgICBpZiAocGF0aFBhcnQubGVuZ3RoICYmIHBhdGhQYXJ0ICE9PSBwYXRoLnNlcClcbiAgICAgICAgcGF0aFBhcnQgPSBwYXRoUGFydCArIHBhdGguc2VwO1xuICAgICAgY29uc3QgZXh0ID0gcGF0aC5leHRuYW1lKGZpbGVQYXRoKTtcbiAgICAgIGNvbnN0IGJhc2VuYW1lID0gcGF0aC5iYXNlbmFtZShmaWxlUGF0aCwgZXh0KTtcblxuICAgICAgLy8gWFhYIGdlbmVyYXRlIGEgc291cmNlIG1hcFxuXG4gICAgICBpbnB1dEZpbGUuYWRkSmF2YVNjcmlwdCh7XG4gICAgICAgIHBhdGg6IHBhdGguam9pbihwYXRoUGFydCwgXCJ0ZW1wbGF0ZS5cIiArIGJhc2VuYW1lICsgXCIuanNcIiksXG4gICAgICAgIGRhdGE6IGFsbEphdmFTY3JpcHRcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxufVxuIl19
