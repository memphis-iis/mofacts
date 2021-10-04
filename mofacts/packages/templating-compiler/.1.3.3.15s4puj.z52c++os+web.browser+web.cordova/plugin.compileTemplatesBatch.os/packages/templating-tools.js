(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var _ = Package.underscore._;
var ECMAScript = Package.ecmascript.ECMAScript;
var SpacebarsCompiler = Package['spacebars-compiler'].SpacebarsCompiler;
var meteorInstall = Package.modules.meteorInstall;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;
var Symbol = Package['ecmascript-runtime-server'].Symbol;
var Map = Package['ecmascript-runtime-server'].Map;
var Set = Package['ecmascript-runtime-server'].Set;

/* Package-scope variables */
var TemplatingTools, tagNameRegex;

var require = meteorInstall({"node_modules":{"meteor":{"templating-tools":{"templating-tools.js":function(require){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/templating-tools/templating-tools.js                                                                     //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
var _classCallCheck2 = require("babel-runtime/helpers/classCallCheck");                                              //
                                                                                                                     //
var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);                                                     //
                                                                                                                     //
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }                    //
                                                                                                                     //
TemplatingTools = {                                                                                                  // 1
  // This type of error should be thrown during compilation                                                          // 2
  CompileError: function () {                                                                                        // 3
    function CompileError() {                                                                                        // 3
      (0, _classCallCheck3.default)(this, CompileError);                                                             // 3
    }                                                                                                                // 3
                                                                                                                     //
    return CompileError;                                                                                             // 3
  }()                                                                                                                // 3
};                                                                                                                   // 1
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"html-scanner.js":function(require){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/templating-tools/html-scanner.js                                                                         //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
var _classCallCheck2 = require("babel-runtime/helpers/classCallCheck");                                              //
                                                                                                                     //
var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);                                                     //
                                                                                                                     //
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }                    //
                                                                                                                     //
TemplatingTools.scanHtmlForTags = function () {                                                                      // 1
  function scanHtmlForTags(options) {                                                                                // 1
    var scan = new HtmlScan(options);                                                                                // 2
    return scan.getTags();                                                                                           // 3
  }                                                                                                                  // 4
                                                                                                                     //
  return scanHtmlForTags;                                                                                            // 1
}(); /**                                                                                                             // 1
      * Scan an HTML file for top-level tags and extract their contents. Pass them to                                //
      * a tag handler (an object with a handleTag method)                                                            //
      *                                                                                                              //
      * This is a primitive, regex-based scanner.  It scans                                                          //
      * top-level tags, which are allowed to have attributes,                                                        //
      * and ignores top-level HTML comments.                                                                         //
      */                                                                                                             //
                                                                                                                     //
var HtmlScan = function () {                                                                                         //
  /**                                                                                                                // 15
   * Initialize and run a scan of a single file                                                                      //
   * @param  {String} sourceName The filename, used in errors only                                                   //
   * @param  {String} contents   The contents of the file                                                            //
   * @param  {String[]} tagNames An array of tag names that are accepted at the                                      //
   * top level. If any other tag is encountered, an error is thrown.                                                 //
   */function HtmlScan(_ref) {                                                                                       //
    var sourceName = _ref.sourceName,                                                                                // 26
        contents = _ref.contents,                                                                                    // 26
        tagNames = _ref.tagNames;                                                                                    // 26
    (0, _classCallCheck3.default)(this, HtmlScan);                                                                   // 26
    this.sourceName = sourceName;                                                                                    // 27
    this.contents = contents;                                                                                        // 28
    this.tagNames = tagNames;                                                                                        // 29
    this.rest = contents;                                                                                            // 31
    this.index = 0;                                                                                                  // 32
    this.tags = [];                                                                                                  // 34
    tagNameRegex = this.tagNames.join("|");                                                                          // 36
    var openTagRegex = new RegExp("^((<(" + tagNameRegex + ")\\b)|(<!--)|(<!DOCTYPE|{{!)|$)", "i");                  // 37
                                                                                                                     //
    while (this.rest) {                                                                                              // 39
      // skip whitespace first (for better line numbers)                                                             // 40
      this.advance(this.rest.match(/^\s*/)[0].length);                                                               // 41
      var match = openTagRegex.exec(this.rest);                                                                      // 43
                                                                                                                     //
      if (!match) {                                                                                                  // 45
        this.throwCompileError("Expected one of: <" + this.tagNames.join('>, <') + ">");                             // 46
      }                                                                                                              // 47
                                                                                                                     //
      var matchToken = match[1];                                                                                     // 49
      var matchTokenTagName = match[3];                                                                              // 50
      var matchTokenComment = match[4];                                                                              // 51
      var matchTokenUnsupported = match[5];                                                                          // 52
      var tagStartIndex = this.index;                                                                                // 54
      this.advance(match.index + match[0].length);                                                                   // 55
                                                                                                                     //
      if (!matchToken) {                                                                                             // 57
        break; // matched $ (end of file)                                                                            // 58
      }                                                                                                              // 59
                                                                                                                     //
      if (matchTokenComment === '<!--') {                                                                            // 61
        // top-level HTML comment                                                                                    // 62
        var commentEnd = /--\s*>/.exec(this.rest);                                                                   // 63
        if (!commentEnd) this.throwCompileError("unclosed HTML comment in template file");                           // 64
        this.advance(commentEnd.index + commentEnd[0].length);                                                       // 66
        continue;                                                                                                    // 67
      }                                                                                                              // 68
                                                                                                                     //
      if (matchTokenUnsupported) {                                                                                   // 70
        switch (matchTokenUnsupported.toLowerCase()) {                                                               // 71
          case '<!doctype':                                                                                          // 72
            this.throwCompileError("Can't set DOCTYPE here.  (Meteor sets <!DOCTYPE html> for you)");                // 73
                                                                                                                     //
          case '{{!':                                                                                                // 75
            this.throwCompileError("Can't use '{{! }}' outside a template.  Use '<!-- -->'.");                       // 76
        }                                                                                                            // 71
                                                                                                                     //
        this.throwCompileError();                                                                                    // 80
      } // otherwise, a <tag>                                                                                        // 81
                                                                                                                     //
                                                                                                                     //
      var tagName = matchTokenTagName.toLowerCase();                                                                 // 84
      var tagAttribs = {}; // bare name -> value dict                                                                // 85
                                                                                                                     //
      var tagPartRegex = /^\s*((([a-zA-Z0-9:_-]+)\s*=\s*(["'])(.*?)\4)|(>))/; // read attributes                     // 86
                                                                                                                     //
      var attr = void 0;                                                                                             // 89
                                                                                                                     //
      while (attr = tagPartRegex.exec(this.rest)) {                                                                  // 90
        var attrToken = attr[1];                                                                                     // 91
        var attrKey = attr[3];                                                                                       // 92
        var attrValue = attr[5];                                                                                     // 93
        this.advance(attr.index + attr[0].length);                                                                   // 94
                                                                                                                     //
        if (attrToken === '>') {                                                                                     // 96
          break;                                                                                                     // 97
        } // XXX we don't HTML unescape the attribute value                                                          // 98
        // (e.g. to allow "abcd&quot;efg") or protect against                                                        // 101
        // collisions with methods of tagAttribs (e.g. for                                                           // 102
        // a property named toString)                                                                                // 103
                                                                                                                     //
                                                                                                                     //
        attrValue = attrValue.match(/^\s*([\s\S]*?)\s*$/)[1]; // trim                                                // 104
                                                                                                                     //
        tagAttribs[attrKey] = attrValue;                                                                             // 105
      }                                                                                                              // 106
                                                                                                                     //
      if (!attr) {                                                                                                   // 108
        // didn't end on '>'                                                                                         // 108
        this.throwCompileError("Parse error in tag");                                                                // 109
      } // find </tag>                                                                                               // 110
                                                                                                                     //
                                                                                                                     //
      var end = new RegExp('</' + tagName + '\\s*>', 'i').exec(this.rest);                                           // 113
                                                                                                                     //
      if (!end) {                                                                                                    // 114
        this.throwCompileError("unclosed <" + tagName + ">");                                                        // 115
      }                                                                                                              // 116
                                                                                                                     //
      var tagContents = this.rest.slice(0, end.index);                                                               // 118
      var contentsStartIndex = this.index; // trim the tag contents.                                                 // 119
      // this is a courtesy and is also relied on by some unit tests.                                                // 122
                                                                                                                     //
      var m = tagContents.match(/^([ \t\r\n]*)([\s\S]*?)[ \t\r\n]*$/);                                               // 123
      var trimmedContentsStartIndex = contentsStartIndex + m[1].length;                                              // 124
      var trimmedTagContents = m[2];                                                                                 // 125
      var tag = {                                                                                                    // 127
        tagName: tagName,                                                                                            // 128
        attribs: tagAttribs,                                                                                         // 129
        contents: trimmedTagContents,                                                                                // 130
        contentsStartIndex: trimmedContentsStartIndex,                                                               // 131
        tagStartIndex: tagStartIndex,                                                                                // 132
        fileContents: this.contents,                                                                                 // 133
        sourceName: this.sourceName                                                                                  // 134
      }; // save the tag                                                                                             // 127
                                                                                                                     //
      this.tags.push(tag); // advance afterwards, so that line numbers in errors are correct                         // 138
                                                                                                                     //
      this.advance(end.index + end[0].length);                                                                       // 141
    }                                                                                                                // 142
  } /**                                                                                                              // 143
     * Advance the parser                                                                                            //
     * @param  {Number} amount The amount of characters to advance                                                   //
     */                                                                                                              //
                                                                                                                     //
  HtmlScan.prototype.advance = function () {                                                                         //
    function advance(amount) {                                                                                       //
      this.rest = this.rest.substring(amount);                                                                       // 150
      this.index += amount;                                                                                          // 151
    }                                                                                                                // 152
                                                                                                                     //
    return advance;                                                                                                  //
  }();                                                                                                               //
                                                                                                                     //
  HtmlScan.prototype.throwCompileError = function () {                                                               //
    function throwCompileError(msg, overrideIndex) {                                                                 //
      var finalIndex = typeof overrideIndex === 'number' ? overrideIndex : this.index;                               // 155
      var err = new TemplatingTools.CompileError();                                                                  // 157
      err.message = msg || "bad formatting in template file";                                                        // 158
      err.file = this.sourceName;                                                                                    // 159
      err.line = this.contents.substring(0, finalIndex).split('\n').length;                                          // 160
      throw err;                                                                                                     // 162
    }                                                                                                                // 163
                                                                                                                     //
    return throwCompileError;                                                                                        //
  }();                                                                                                               //
                                                                                                                     //
  HtmlScan.prototype.throwBodyAttrsError = function () {                                                             //
    function throwBodyAttrsError(msg) {                                                                              //
      this.parseError(msg);                                                                                          // 166
    }                                                                                                                // 167
                                                                                                                     //
    return throwBodyAttrsError;                                                                                      //
  }();                                                                                                               //
                                                                                                                     //
  HtmlScan.prototype.getTags = function () {                                                                         //
    function getTags() {                                                                                             //
      return this.tags;                                                                                              // 170
    }                                                                                                                // 171
                                                                                                                     //
    return getTags;                                                                                                  //
  }();                                                                                                               //
                                                                                                                     //
  return HtmlScan;                                                                                                   //
}();                                                                                                                 //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"compile-tags-with-spacebars.js":function(require){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/templating-tools/compile-tags-with-spacebars.js                                                          //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
var _classCallCheck2 = require("babel-runtime/helpers/classCallCheck");                                              //
                                                                                                                     //
var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);                                                     //
                                                                                                                     //
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }                    //
                                                                                                                     //
TemplatingTools.compileTagsWithSpacebars = function () {                                                             // 1
  function compileTagsWithSpacebars(tags) {                                                                          // 1
    var handler = new SpacebarsTagCompiler();                                                                        // 2
    tags.forEach(function (tag) {                                                                                    // 4
      handler.addTagToResults(tag);                                                                                  // 5
    });                                                                                                              // 6
    return handler.getResults();                                                                                     // 8
  }                                                                                                                  // 9
                                                                                                                     //
  return compileTagsWithSpacebars;                                                                                   // 1
}();                                                                                                                 // 1
                                                                                                                     //
var SpacebarsTagCompiler = function () {                                                                             //
  function SpacebarsTagCompiler() {                                                                                  // 12
    (0, _classCallCheck3.default)(this, SpacebarsTagCompiler);                                                       // 12
    this.results = {                                                                                                 // 13
      head: '',                                                                                                      // 14
      body: '',                                                                                                      // 15
      js: '',                                                                                                        // 16
      bodyAttrs: {}                                                                                                  // 17
    };                                                                                                               // 13
  }                                                                                                                  // 19
                                                                                                                     //
  SpacebarsTagCompiler.prototype.getResults = function () {                                                          //
    function getResults() {                                                                                          //
      return this.results;                                                                                           // 22
    }                                                                                                                // 23
                                                                                                                     //
    return getResults;                                                                                               //
  }();                                                                                                               //
                                                                                                                     //
  SpacebarsTagCompiler.prototype.addTagToResults = function () {                                                     //
    function addTagToResults(tag) {                                                                                  //
      this.tag = tag; // do we have 1 or more attributes?                                                            // 26
                                                                                                                     //
      var hasAttribs = !_.isEmpty(this.tag.attribs);                                                                 // 29
                                                                                                                     //
      if (this.tag.tagName === "head") {                                                                             // 31
        if (hasAttribs) {                                                                                            // 32
          this.throwCompileError("Attributes on <head> not supported");                                              // 33
        }                                                                                                            // 34
                                                                                                                     //
        this.results.head += this.tag.contents;                                                                      // 36
        return;                                                                                                      // 37
      } // <body> or <template>                                                                                      // 38
                                                                                                                     //
                                                                                                                     //
      try {                                                                                                          // 43
        if (this.tag.tagName === "template") {                                                                       // 44
          var name = this.tag.attribs.name;                                                                          // 45
                                                                                                                     //
          if (!name) {                                                                                               // 47
            this.throwCompileError("Template has no 'name' attribute");                                              // 48
          }                                                                                                          // 49
                                                                                                                     //
          if (SpacebarsCompiler.isReservedName(name)) {                                                              // 51
            this.throwCompileError("Template can't be named \"" + name + "\"");                                      // 52
          }                                                                                                          // 53
                                                                                                                     //
          var renderFuncCode = SpacebarsCompiler.compile(this.tag.contents, {                                        // 55
            isTemplate: true,                                                                                        // 56
            sourceName: "Template \"" + name + "\""                                                                  // 57
          });                                                                                                        // 55
          this.results.js += TemplatingTools.generateTemplateJS(name, renderFuncCode);                               // 60
        } else if (this.tag.tagName === "body") {                                                                    // 62
          this.addBodyAttrs(this.tag.attribs);                                                                       // 63
                                                                                                                     //
          var _renderFuncCode = SpacebarsCompiler.compile(this.tag.contents, {                                       // 65
            isBody: true,                                                                                            // 66
            sourceName: "<body>"                                                                                     // 67
          }); // We may be one of many `<body>` tags.                                                                // 65
                                                                                                                     //
                                                                                                                     //
          this.results.js += TemplatingTools.generateBodyJS(_renderFuncCode);                                        // 71
        } else {                                                                                                     // 72
          this.throwCompileError("Expected <template>, <head>, or <body> tag in template file", tagStartIndex);      // 73
        }                                                                                                            // 74
      } catch (e) {                                                                                                  // 75
        if (e.scanner) {                                                                                             // 76
          // The error came from Spacebars                                                                           // 77
          this.throwCompileError(e.message, this.tag.contentsStartIndex + e.offset);                                 // 78
        } else {                                                                                                     // 79
          throw e;                                                                                                   // 80
        }                                                                                                            // 81
      }                                                                                                              // 82
    }                                                                                                                // 83
                                                                                                                     //
    return addTagToResults;                                                                                          //
  }();                                                                                                               //
                                                                                                                     //
  SpacebarsTagCompiler.prototype.addBodyAttrs = function () {                                                        //
    function addBodyAttrs(attrs) {                                                                                   //
      var _this = this;                                                                                              // 85
                                                                                                                     //
      Object.keys(attrs).forEach(function (attr) {                                                                   // 86
        var val = attrs[attr]; // This check is for conflicting body attributes in the same file;                    // 87
        // we check across multiple files in caching-html-compiler using the                                         // 90
        // attributes on results.bodyAttrs                                                                           // 91
                                                                                                                     //
        if (_this.results.bodyAttrs.hasOwnProperty(attr) && _this.results.bodyAttrs[attr] !== val) {                 // 92
          _this.throwCompileError("<body> declarations have conflicting values for the '" + attr + "' attribute.");  // 93
        }                                                                                                            // 95
                                                                                                                     //
        _this.results.bodyAttrs[attr] = val;                                                                         // 97
      });                                                                                                            // 98
    }                                                                                                                // 99
                                                                                                                     //
    return addBodyAttrs;                                                                                             //
  }();                                                                                                               //
                                                                                                                     //
  SpacebarsTagCompiler.prototype.throwCompileError = function () {                                                   //
    function throwCompileError(message, overrideIndex) {                                                             //
      TemplatingTools.throwCompileError(this.tag, message, overrideIndex);                                           // 102
    }                                                                                                                // 103
                                                                                                                     //
    return throwCompileError;                                                                                        //
  }();                                                                                                               //
                                                                                                                     //
  return SpacebarsTagCompiler;                                                                                       //
}();                                                                                                                 //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"throw-compile-error.js":function(){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/templating-tools/throw-compile-error.js                                                                  //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
TemplatingTools.throwCompileError = function () {                                                                    // 1
  function throwCompileError(tag, message, overrideIndex) {                                                          // 2
    var finalIndex = typeof overrideIndex === 'number' ? overrideIndex : tag.tagStartIndex;                          // 3
    var err = new TemplatingTools.CompileError();                                                                    // 6
    err.message = message || "bad formatting in template file";                                                      // 7
    err.file = tag.sourceName;                                                                                       // 8
    err.line = tag.fileContents.substring(0, finalIndex).split('\n').length;                                         // 9
    throw err;                                                                                                       // 10
  }                                                                                                                  // 11
                                                                                                                     //
  return throwCompileError;                                                                                          // 1
}();                                                                                                                 // 1
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"code-generation.js":function(){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/templating-tools/code-generation.js                                                                      //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
TemplatingTools.generateTemplateJS = function () {                                                                   // 1
  function generateTemplateJS(name, renderFuncCode) {                                                                // 2
    var nameLiteral = JSON.stringify(name);                                                                          // 3
    var templateDotNameLiteral = JSON.stringify("Template." + name);                                                 // 4
    return "\nTemplate.__checkName(" + nameLiteral + ");\nTemplate[" + nameLiteral + "] = new Template(" + templateDotNameLiteral + ", " + renderFuncCode + ");\n";
  }                                                                                                                  // 10
                                                                                                                     //
  return generateTemplateJS;                                                                                         // 1
}();                                                                                                                 // 1
                                                                                                                     //
TemplatingTools.generateBodyJS = function () {                                                                       // 12
  function generateBodyJS(renderFuncCode) {                                                                          // 13
    return "\nTemplate.body.addContent(" + renderFuncCode + ");\nMeteor.startup(Template.body.renderToDocument);\n";
  }                                                                                                                  // 18
                                                                                                                     //
  return generateBodyJS;                                                                                             // 12
}();                                                                                                                 // 12
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/templating-tools/templating-tools.js");
require("./node_modules/meteor/templating-tools/html-scanner.js");
require("./node_modules/meteor/templating-tools/compile-tags-with-spacebars.js");
require("./node_modules/meteor/templating-tools/throw-compile-error.js");
require("./node_modules/meteor/templating-tools/code-generation.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
(function (pkg, symbols) {
  for (var s in symbols)
    (s in pkg) || (pkg[s] = symbols[s]);
})(Package['templating-tools'] = {}, {
  TemplatingTools: TemplatingTools
});

})();





//# sourceURL=meteor://💻app/packages/templating-tools.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvdGVtcGxhdGluZy10b29scy90ZW1wbGF0aW5nLXRvb2xzLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy90ZW1wbGF0aW5nLXRvb2xzL2h0bWwtc2Nhbm5lci5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvdGVtcGxhdGluZy10b29scy9jb21waWxlLXRhZ3Mtd2l0aC1zcGFjZWJhcnMuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3RlbXBsYXRpbmctdG9vbHMvdGhyb3ctY29tcGlsZS1lcnJvci5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvdGVtcGxhdGluZy10b29scy9jb2RlLWdlbmVyYXRpb24uanMiXSwibmFtZXMiOlsiVGVtcGxhdGluZ1Rvb2xzIiwiQ29tcGlsZUVycm9yIiwic2Nhbkh0bWxGb3JUYWdzIiwib3B0aW9ucyIsInNjYW4iLCJIdG1sU2NhbiIsImdldFRhZ3MiLCJzb3VyY2VOYW1lIiwiY29udGVudHMiLCJ0YWdOYW1lcyIsInJlc3QiLCJpbmRleCIsInRhZ3MiLCJ0YWdOYW1lUmVnZXgiLCJqb2luIiwib3BlblRhZ1JlZ2V4IiwiUmVnRXhwIiwiYWR2YW5jZSIsIm1hdGNoIiwibGVuZ3RoIiwiZXhlYyIsInRocm93Q29tcGlsZUVycm9yIiwibWF0Y2hUb2tlbiIsIm1hdGNoVG9rZW5UYWdOYW1lIiwibWF0Y2hUb2tlbkNvbW1lbnQiLCJtYXRjaFRva2VuVW5zdXBwb3J0ZWQiLCJ0YWdTdGFydEluZGV4IiwiY29tbWVudEVuZCIsInRvTG93ZXJDYXNlIiwidGFnTmFtZSIsInRhZ0F0dHJpYnMiLCJ0YWdQYXJ0UmVnZXgiLCJhdHRyIiwiYXR0clRva2VuIiwiYXR0cktleSIsImF0dHJWYWx1ZSIsImVuZCIsInRhZ0NvbnRlbnRzIiwic2xpY2UiLCJjb250ZW50c1N0YXJ0SW5kZXgiLCJtIiwidHJpbW1lZENvbnRlbnRzU3RhcnRJbmRleCIsInRyaW1tZWRUYWdDb250ZW50cyIsInRhZyIsImF0dHJpYnMiLCJmaWxlQ29udGVudHMiLCJwdXNoIiwiYW1vdW50Iiwic3Vic3RyaW5nIiwibXNnIiwib3ZlcnJpZGVJbmRleCIsImZpbmFsSW5kZXgiLCJlcnIiLCJtZXNzYWdlIiwiZmlsZSIsImxpbmUiLCJzcGxpdCIsInRocm93Qm9keUF0dHJzRXJyb3IiLCJwYXJzZUVycm9yIiwiY29tcGlsZVRhZ3NXaXRoU3BhY2ViYXJzIiwiaGFuZGxlciIsIlNwYWNlYmFyc1RhZ0NvbXBpbGVyIiwiZm9yRWFjaCIsImFkZFRhZ1RvUmVzdWx0cyIsImdldFJlc3VsdHMiLCJyZXN1bHRzIiwiaGVhZCIsImJvZHkiLCJqcyIsImJvZHlBdHRycyIsImhhc0F0dHJpYnMiLCJfIiwiaXNFbXB0eSIsIm5hbWUiLCJTcGFjZWJhcnNDb21waWxlciIsImlzUmVzZXJ2ZWROYW1lIiwicmVuZGVyRnVuY0NvZGUiLCJjb21waWxlIiwiaXNUZW1wbGF0ZSIsImdlbmVyYXRlVGVtcGxhdGVKUyIsImFkZEJvZHlBdHRycyIsImlzQm9keSIsImdlbmVyYXRlQm9keUpTIiwiZSIsInNjYW5uZXIiLCJvZmZzZXQiLCJhdHRycyIsIk9iamVjdCIsImtleXMiLCJ2YWwiLCJoYXNPd25Qcm9wZXJ0eSIsIm5hbWVMaXRlcmFsIiwiSlNPTiIsInN0cmluZ2lmeSIsInRlbXBsYXRlRG90TmFtZUxpdGVyYWwiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBQSxrQkFBa0I7QUFDaEI7QUFDQUM7QUFBQTtBQUFBO0FBQUE7O0FBQUE7QUFBQTtBQUZnQixDQUFsQix3SDs7Ozs7Ozs7Ozs7Ozs7Ozs7QUNBQUQsZ0JBQWdCRSxlQUFoQjtBQUFrQyxXQUFTQSxlQUFULENBQXlCQyxPQUF6QixFQUFrQztBQUNsRSxRQUFNQyxPQUFPLElBQUlDLFFBQUosQ0FBYUYsT0FBYixDQUFiO0FBQ0EsV0FBT0MsS0FBS0UsT0FBTCxFQUFQO0FBQ0Q7O0FBSEQsU0FBMkNKLGVB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LFdBRHJCLHFCQUVTQSxXQUZULHlCQUV3Q0csc0JBRnhDLFVBRW1FbEIsY0FGbkU7QUFJRDs7QUFURCxTQUNTRyxrQkFEVDtBQUFBOztBQVdBL0UsZ0JBQWdCa0YsY0FBaEI7QUFDQSxXQUFTQSxjQUFULENBQXdCTixjQUF4QixFQUF3QztBQUN0QywyQ0FDeUJBLGNBRHpCO0FBSUQ7O0FBTkQsU0FDU00sY0FEVDtBQUFBLDBIIiwiZmlsZSI6Ii9wYWNrYWdlcy90ZW1wbGF0aW5nLXRvb2xzLmpzIiwic291cmNlc0NvbnRlbnQiOlsiVGVtcGxhdGluZ1Rvb2xzID0ge1xuICAvLyBUaGlzIHR5cGUgb2YgZXJyb3Igc2hvdWxkIGJlIHRocm93biBkdXJpbmcgY29tcGlsYXRpb25cbiAgQ29tcGlsZUVycm9yOiBjbGFzcyBDb21waWxlRXJyb3Ige31cbn07XG4iLCJUZW1wbGF0aW5nVG9vbHMuc2Nhbkh0bWxGb3JUYWdzID0gZnVuY3Rpb24gc2Nhbkh0bWxGb3JUYWdzKG9wdGlvbnMpIHtcbiAgY29uc3Qgc2NhbiA9IG5ldyBIdG1sU2NhbihvcHRpb25zKTtcbiAgcmV0dXJuIHNjYW4uZ2V0VGFncygpO1xufTtcblxuLyoqXG4gKiBTY2FuIGFuIEhUTUwgZmlsZSBmb3IgdG9wLWxldmVsIHRhZ3MgYW5kIGV4dHJhY3QgdGhlaXIgY29udGVudHMuIFBhc3MgdGhlbSB0b1xuICogYSB0YWcgaGFuZGxlciAoYW4gb2JqZWN0IHdpdGggYSBoYW5kbGVUYWcgbWV0aG9kKVxuICpcbiAqIFRoaXMgaXMgYSBwcmltaXRpdmUsIHJlZ2V4LWJhc2VkIHNjYW5uZXIuICBJdCBzY2FucyBcbiAqIHRvcC1sZXZlbCB0YWdzLCB3aGljaCBhcmUgYWxsb3dlZCB0byBoYXZlIGF0dHJpYnV0ZXMsXG4gKiBhbmQgaWdub3JlcyB0b3AtbGV2ZWwgSFRNTCBjb21tZW50cy5cbiAqL1xuY2xhc3MgSHRtbFNjYW4ge1xuICAvKipcbiAgICogSW5pdGlhbGl6ZSBhbmQgcnVuIGEgc2NhbiBvZiBhIHNpbmdsZSBmaWxlXG4gICAqIEBwYXJhbSAge1N0cmluZ30gc291cmNlTmFtZSBUaGUgZmlsZW5hbWUsIHVzZWQgaW4gZXJyb3JzIG9ubHlcbiAgICogQHBhcmFtICB7U3RyaW5nfSBjb250ZW50cyAgIFRoZSBjb250ZW50cyBvZiB0aGUgZmlsZVxuICAgKiBAcGFyYW0gIHtTdHJpbmdbXX0gdGFnTmFtZXMgQW4gYXJyYXkgb2YgdGFnIG5hbWVzIHRoYXQgYXJlIGFjY2VwdGVkIGF0IHRoZVxuICAgKiB0b3AgbGV2ZWwuIElmIGFueSBvdGhlciB0YWcgaXMgZW5jb3VudGVyZWQsIGFuIGVycm9yIGlzIHRocm93bi5cbiAgICovXG4gIGNvbnN0cnVjdG9yKHtcbiAgICAgICAgc291cmNlTmFtZSxcbiAgICAgICAgY29udGVudHMsXG4gICAgICAgIHRhZ05hbWVzXG4gICAgICB9KSB7XG4gICAgdGhpcy5zb3VyY2VOYW1lID0gc291cmNlTmFtZTtcbiAgICB0aGlzLmNvbnRlbnRzID0gY29udGVudHM7XG4gICAgdGhpcy50YWdOYW1lcyA9IHRhZ05hbWVzO1xuXG4gICAgdGhpcy5yZXN0ID0gY29udGVudHM7XG4gICAgdGhpcy5pbmRleCA9IDA7XG5cbiAgICB0aGlzLnRhZ3MgPSBbXTtcblxuICAgIHRhZ05hbWVSZWdleCA9IHRoaXMudGFnTmFtZXMuam9pbihcInxcIik7XG4gICAgY29uc3Qgb3BlblRhZ1JlZ2V4ID0gbmV3IFJlZ0V4cChgXigoPCgke3RhZ05hbWVSZWdleH0pXFxcXGIpfCg8IS0tKXwoPCFET0NUWVBFfHt7ISl8JClgLCBcImlcIik7XG5cbiAgICB3aGlsZSAodGhpcy5yZXN0KSB7XG4gICAgICAvLyBza2lwIHdoaXRlc3BhY2UgZmlyc3QgKGZvciBiZXR0ZXIgbGluZSBudW1iZXJzKVxuICAgICAgdGhpcy5hZHZhbmNlKHRoaXMucmVzdC5tYXRjaCgvXlxccyovKVswXS5sZW5ndGgpO1xuXG4gICAgICBjb25zdCBtYXRjaCA9IG9wZW5UYWdSZWdleC5leGVjKHRoaXMucmVzdCk7XG5cbiAgICAgIGlmICghIG1hdGNoKSB7XG4gICAgICAgIHRoaXMudGhyb3dDb21waWxlRXJyb3IoYEV4cGVjdGVkIG9uZSBvZjogPCR7dGhpcy50YWdOYW1lcy5qb2luKCc+LCA8Jyl9PmApO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBtYXRjaFRva2VuID0gbWF0Y2hbMV07XG4gICAgICBjb25zdCBtYXRjaFRva2VuVGFnTmFtZSA9ICBtYXRjaFszXTtcbiAgICAgIGNvbnN0IG1hdGNoVG9rZW5Db21tZW50ID0gbWF0Y2hbNF07XG4gICAgICBjb25zdCBtYXRjaFRva2VuVW5zdXBwb3J0ZWQgPSBtYXRjaFs1XTtcblxuICAgICAgY29uc3QgdGFnU3RhcnRJbmRleCA9IHRoaXMuaW5kZXg7XG4gICAgICB0aGlzLmFkdmFuY2UobWF0Y2guaW5kZXggKyBtYXRjaFswXS5sZW5ndGgpO1xuXG4gICAgICBpZiAoISBtYXRjaFRva2VuKSB7XG4gICAgICAgIGJyZWFrOyAvLyBtYXRjaGVkICQgKGVuZCBvZiBmaWxlKVxuICAgICAgfVxuXG4gICAgICBpZiAobWF0Y2hUb2tlbkNvbW1lbnQgPT09ICc8IS0tJykge1xuICAgICAgICAvLyB0b3AtbGV2ZWwgSFRNTCBjb21tZW50XG4gICAgICAgIGNvbnN0IGNvbW1lbnRFbmQgPSAvLS1cXHMqPi8uZXhlYyh0aGlzLnJlc3QpO1xuICAgICAgICBpZiAoISBjb21tZW50RW5kKVxuICAgICAgICAgIHRoaXMudGhyb3dDb21waWxlRXJyb3IoXCJ1bmNsb3NlZCBIVE1MIGNvbW1lbnQgaW4gdGVtcGxhdGUgZmlsZVwiKTtcbiAgICAgICAgdGhpcy5hZHZhbmNlKGNvbW1lbnRFbmQuaW5kZXggKyBjb21tZW50RW5kWzBdLmxlbmd0aCk7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAobWF0Y2hUb2tlblVuc3VwcG9ydGVkKSB7XG4gICAgICAgIHN3aXRjaCAobWF0Y2hUb2tlblVuc3VwcG9ydGVkLnRvTG93ZXJDYXNlKCkpIHtcbiAgICAgICAgY2FzZSAnPCFkb2N0eXBlJzpcbiAgICAgICAgICB0aGlzLnRocm93Q29tcGlsZUVycm9yKFxuICAgICAgICAgICAgXCJDYW4ndCBzZXQgRE9DVFlQRSBoZXJlLiAgKE1ldGVvciBzZXRzIDwhRE9DVFlQRSBodG1sPiBmb3IgeW91KVwiKTtcbiAgICAgICAgY2FzZSAne3shJzpcbiAgICAgICAgICB0aGlzLnRocm93Q29tcGlsZUVycm9yKFxuICAgICAgICAgICAgXCJDYW4ndCB1c2UgJ3t7ISB9fScgb3V0c2lkZSBhIHRlbXBsYXRlLiAgVXNlICc8IS0tIC0tPicuXCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy50aHJvd0NvbXBpbGVFcnJvcigpO1xuICAgICAgfVxuXG4gICAgICAvLyBvdGhlcndpc2UsIGEgPHRhZz5cbiAgICAgIGNvbnN0IHRhZ05hbWUgPSBtYXRjaFRva2VuVGFnTmFtZS50b0xvd2VyQ2FzZSgpO1xuICAgICAgY29uc3QgdGFnQXR0cmlicyA9IHt9OyAvLyBiYXJlIG5hbWUgLT4gdmFsdWUgZGljdFxuICAgICAgY29uc3QgdGFnUGFydFJlZ2V4ID0gL15cXHMqKCgoW2EtekEtWjAtOTpfLV0rKVxccyo9XFxzKihbXCInXSkoLio/KVxcNCl8KD4pKS87XG5cbiAgICAgIC8vIHJlYWQgYXR0cmlidXRlc1xuICAgICAgbGV0IGF0dHI7XG4gICAgICB3aGlsZSAoKGF0dHIgPSB0YWdQYXJ0UmVnZXguZXhlYyh0aGlzLnJlc3QpKSkge1xuICAgICAgICBjb25zdCBhdHRyVG9rZW4gPSBhdHRyWzFdO1xuICAgICAgICBjb25zdCBhdHRyS2V5ID0gYXR0clszXTtcbiAgICAgICAgbGV0IGF0dHJWYWx1ZSA9IGF0dHJbNV07XG4gICAgICAgIHRoaXMuYWR2YW5jZShhdHRyLmluZGV4ICsgYXR0clswXS5sZW5ndGgpO1xuXG4gICAgICAgIGlmIChhdHRyVG9rZW4gPT09ICc+Jykge1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gWFhYIHdlIGRvbid0IEhUTUwgdW5lc2NhcGUgdGhlIGF0dHJpYnV0ZSB2YWx1ZVxuICAgICAgICAvLyAoZS5nLiB0byBhbGxvdyBcImFiY2QmcXVvdDtlZmdcIikgb3IgcHJvdGVjdCBhZ2FpbnN0XG4gICAgICAgIC8vIGNvbGxpc2lvbnMgd2l0aCBtZXRob2RzIG9mIHRhZ0F0dHJpYnMgKGUuZy4gZm9yXG4gICAgICAgIC8vIGEgcHJvcGVydHkgbmFtZWQgdG9TdHJpbmcpXG4gICAgICAgIGF0dHJWYWx1ZSA9IGF0dHJWYWx1ZS5tYXRjaCgvXlxccyooW1xcc1xcU10qPylcXHMqJC8pWzFdOyAvLyB0cmltXG4gICAgICAgIHRhZ0F0dHJpYnNbYXR0cktleV0gPSBhdHRyVmFsdWU7XG4gICAgICB9XG5cbiAgICAgIGlmICghIGF0dHIpIHsgLy8gZGlkbid0IGVuZCBvbiAnPidcbiAgICAgICAgdGhpcy50aHJvd0NvbXBpbGVFcnJvcihcIlBhcnNlIGVycm9yIGluIHRhZ1wiKTtcbiAgICAgIH1cblxuICAgICAgLy8gZmluZCA8L3RhZz5cbiAgICAgIGNvbnN0IGVuZCA9IChuZXcgUmVnRXhwKCc8LycrdGFnTmFtZSsnXFxcXHMqPicsICdpJykpLmV4ZWModGhpcy5yZXN0KTtcbiAgICAgIGlmICghIGVuZCkge1xuICAgICAgICB0aGlzLnRocm93Q29tcGlsZUVycm9yKFwidW5jbG9zZWQgPFwiK3RhZ05hbWUrXCI+XCIpO1xuICAgICAgfVxuXG4gICAgICBjb25zdCB0YWdDb250ZW50cyA9IHRoaXMucmVzdC5zbGljZSgwLCBlbmQuaW5kZXgpO1xuICAgICAgY29uc3QgY29udGVudHNTdGFydEluZGV4ID0gdGhpcy5pbmRleDtcblxuICAgICAgLy8gdHJpbSB0aGUgdGFnIGNvbnRlbnRzLlxuICAgICAgLy8gdGhpcyBpcyBhIGNvdXJ0ZXN5IGFuZCBpcyBhbHNvIHJlbGllZCBvbiBieSBzb21lIHVuaXQgdGVzdHMuXG4gICAgICB2YXIgbSA9IHRhZ0NvbnRlbnRzLm1hdGNoKC9eKFsgXFx0XFxyXFxuXSopKFtcXHNcXFNdKj8pWyBcXHRcXHJcXG5dKiQvKTtcbiAgICAgIGNvbnN0IHRyaW1tZWRDb250ZW50c1N0YXJ0SW5kZXggPSBjb250ZW50c1N0YXJ0SW5kZXggKyBtWzFdLmxlbmd0aDtcbiAgICAgIGNvbnN0IHRyaW1tZWRUYWdDb250ZW50cyA9IG1bMl07XG5cbiAgICAgIGNvbnN0IHRhZyA9IHtcbiAgICAgICAgdGFnTmFtZTogdGFnTmFtZSxcbiAgICAgICAgYXR0cmliczogdGFnQXR0cmlicyxcbiAgICAgICAgY29udGVudHM6IHRyaW1tZWRUYWdDb250ZW50cyxcbiAgICAgICAgY29udGVudHNTdGFydEluZGV4OiB0cmltbWVkQ29udGVudHNTdGFydEluZGV4LFxuICAgICAgICB0YWdTdGFydEluZGV4OiB0YWdTdGFydEluZGV4LFxuICAgICAgICBmaWxlQ29udGVudHM6IHRoaXMuY29udGVudHMsXG4gICAgICAgIHNvdXJjZU5hbWU6IHRoaXMuc291cmNlTmFtZVxuICAgICAgfTtcblxuICAgICAgLy8gc2F2ZSB0aGUgdGFnXG4gICAgICB0aGlzLnRhZ3MucHVzaCh0YWcpO1xuXG4gICAgICAvLyBhZHZhbmNlIGFmdGVyd2FyZHMsIHNvIHRoYXQgbGluZSBudW1iZXJzIGluIGVycm9ycyBhcmUgY29ycmVjdFxuICAgICAgdGhpcy5hZHZhbmNlKGVuZC5pbmRleCArIGVuZFswXS5sZW5ndGgpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBBZHZhbmNlIHRoZSBwYXJzZXJcbiAgICogQHBhcmFtICB7TnVtYmVyfSBhbW91bnQgVGhlIGFtb3VudCBvZiBjaGFyYWN0ZXJzIHRvIGFkdmFuY2VcbiAgICovXG4gIGFkdmFuY2UoYW1vdW50KSB7XG4gICAgdGhpcy5yZXN0ID0gdGhpcy5yZXN0LnN1YnN0cmluZyhhbW91bnQpO1xuICAgIHRoaXMuaW5kZXggKz0gYW1vdW50O1xuICB9XG5cbiAgdGhyb3dDb21waWxlRXJyb3IobXNnLCBvdmVycmlkZUluZGV4KSB7XG4gICAgY29uc3QgZmluYWxJbmRleCA9ICh0eXBlb2Ygb3ZlcnJpZGVJbmRleCA9PT0gJ251bWJlcicgPyBvdmVycmlkZUluZGV4IDogdGhpcy5pbmRleCk7XG5cbiAgICBjb25zdCBlcnIgPSBuZXcgVGVtcGxhdGluZ1Rvb2xzLkNvbXBpbGVFcnJvcigpO1xuICAgIGVyci5tZXNzYWdlID0gbXNnIHx8IFwiYmFkIGZvcm1hdHRpbmcgaW4gdGVtcGxhdGUgZmlsZVwiO1xuICAgIGVyci5maWxlID0gdGhpcy5zb3VyY2VOYW1lO1xuICAgIGVyci5saW5lID0gdGhpcy5jb250ZW50cy5zdWJzdHJpbmcoMCwgZmluYWxJbmRleCkuc3BsaXQoJ1xcbicpLmxlbmd0aDtcblxuICAgIHRocm93IGVycjtcbiAgfVxuXG4gIHRocm93Qm9keUF0dHJzRXJyb3IobXNnKSB7XG4gICAgdGhpcy5wYXJzZUVycm9yKG1zZyk7XG4gIH1cblxuICBnZXRUYWdzKCkge1xuICAgIHJldHVybiB0aGlzLnRhZ3M7XG4gIH1cbn1cbiIsIlRlbXBsYXRpbmdUb29scy5jb21waWxlVGFnc1dpdGhTcGFjZWJhcnMgPSBmdW5jdGlvbiBjb21waWxlVGFnc1dpdGhTcGFjZWJhcnModGFncykge1xuICB2YXIgaGFuZGxlciA9IG5ldyBTcGFjZWJhcnNUYWdDb21waWxlcigpO1xuXG4gIHRhZ3MuZm9yRWFjaCgodGFnKSA9PiB7XG4gICAgaGFuZGxlci5hZGRUYWdUb1Jlc3VsdHModGFnKTtcbiAgfSk7XG5cbiAgcmV0dXJuIGhhbmRsZXIuZ2V0UmVzdWx0cygpO1xufTtcblxuY2xhc3MgU3BhY2ViYXJzVGFnQ29tcGlsZXIge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLnJlc3VsdHMgPSB7XG4gICAgICBoZWFkOiAnJyxcbiAgICAgIGJvZHk6ICcnLFxuICAgICAganM6ICcnLFxuICAgICAgYm9keUF0dHJzOiB7fVxuICAgIH07XG4gIH1cblxuICBnZXRSZXN1bHRzKCkge1xuICAgIHJldHVybiB0aGlzLnJlc3VsdHM7XG4gIH1cblxuICBhZGRUYWdUb1Jlc3VsdHModGFnKSB7XG4gICAgdGhpcy50YWcgPSB0YWc7XG5cbiAgICAvLyBkbyB3ZSBoYXZlIDEgb3IgbW9yZSBhdHRyaWJ1dGVzP1xuICAgIGNvbnN0IGhhc0F0dHJpYnMgPSAhIF8uaXNFbXB0eSh0aGlzLnRhZy5hdHRyaWJzKTtcblxuICAgIGlmICh0aGlzLnRhZy50YWdOYW1lID09PSBcImhlYWRcIikge1xuICAgICAgaWYgKGhhc0F0dHJpYnMpIHtcbiAgICAgICAgdGhpcy50aHJvd0NvbXBpbGVFcnJvcihcIkF0dHJpYnV0ZXMgb24gPGhlYWQ+IG5vdCBzdXBwb3J0ZWRcIik7XG4gICAgICB9XG5cbiAgICAgIHRoaXMucmVzdWx0cy5oZWFkICs9IHRoaXMudGFnLmNvbnRlbnRzO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuXG4gICAgLy8gPGJvZHk+IG9yIDx0ZW1wbGF0ZT5cblxuICAgIHRyeSB7XG4gICAgICBpZiAodGhpcy50YWcudGFnTmFtZSA9PT0gXCJ0ZW1wbGF0ZVwiKSB7XG4gICAgICAgIGNvbnN0IG5hbWUgPSB0aGlzLnRhZy5hdHRyaWJzLm5hbWU7XG5cbiAgICAgICAgaWYgKCEgbmFtZSkge1xuICAgICAgICAgIHRoaXMudGhyb3dDb21waWxlRXJyb3IoXCJUZW1wbGF0ZSBoYXMgbm8gJ25hbWUnIGF0dHJpYnV0ZVwiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChTcGFjZWJhcnNDb21waWxlci5pc1Jlc2VydmVkTmFtZShuYW1lKSkge1xuICAgICAgICAgIHRoaXMudGhyb3dDb21waWxlRXJyb3IoYFRlbXBsYXRlIGNhbid0IGJlIG5hbWVkIFwiJHtuYW1lfVwiYCk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCByZW5kZXJGdW5jQ29kZSA9IFNwYWNlYmFyc0NvbXBpbGVyLmNvbXBpbGUodGhpcy50YWcuY29udGVudHMsIHtcbiAgICAgICAgICBpc1RlbXBsYXRlOiB0cnVlLFxuICAgICAgICAgIHNvdXJjZU5hbWU6IGBUZW1wbGF0ZSBcIiR7bmFtZX1cImBcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5yZXN1bHRzLmpzICs9IFRlbXBsYXRpbmdUb29scy5nZW5lcmF0ZVRlbXBsYXRlSlMoXG4gICAgICAgICAgbmFtZSwgcmVuZGVyRnVuY0NvZGUpO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLnRhZy50YWdOYW1lID09PSBcImJvZHlcIikge1xuICAgICAgICB0aGlzLmFkZEJvZHlBdHRycyh0aGlzLnRhZy5hdHRyaWJzKTtcblxuICAgICAgICBjb25zdCByZW5kZXJGdW5jQ29kZSA9IFNwYWNlYmFyc0NvbXBpbGVyLmNvbXBpbGUodGhpcy50YWcuY29udGVudHMsIHtcbiAgICAgICAgICBpc0JvZHk6IHRydWUsXG4gICAgICAgICAgc291cmNlTmFtZTogXCI8Ym9keT5cIlxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBXZSBtYXkgYmUgb25lIG9mIG1hbnkgYDxib2R5PmAgdGFncy5cbiAgICAgICAgdGhpcy5yZXN1bHRzLmpzICs9IFRlbXBsYXRpbmdUb29scy5nZW5lcmF0ZUJvZHlKUyhyZW5kZXJGdW5jQ29kZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnRocm93Q29tcGlsZUVycm9yKFwiRXhwZWN0ZWQgPHRlbXBsYXRlPiwgPGhlYWQ+LCBvciA8Ym9keT4gdGFnIGluIHRlbXBsYXRlIGZpbGVcIiwgdGFnU3RhcnRJbmRleCk7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgaWYgKGUuc2Nhbm5lcikge1xuICAgICAgICAvLyBUaGUgZXJyb3IgY2FtZSBmcm9tIFNwYWNlYmFyc1xuICAgICAgICB0aGlzLnRocm93Q29tcGlsZUVycm9yKGUubWVzc2FnZSwgdGhpcy50YWcuY29udGVudHNTdGFydEluZGV4ICsgZS5vZmZzZXQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgZTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBhZGRCb2R5QXR0cnMoYXR0cnMpIHtcbiAgICBPYmplY3Qua2V5cyhhdHRycykuZm9yRWFjaCgoYXR0cikgPT4ge1xuICAgICAgY29uc3QgdmFsID0gYXR0cnNbYXR0cl07XG5cbiAgICAgIC8vIFRoaXMgY2hlY2sgaXMgZm9yIGNvbmZsaWN0aW5nIGJvZHkgYXR0cmlidXRlcyBpbiB0aGUgc2FtZSBmaWxlO1xuICAgICAgLy8gd2UgY2hlY2sgYWNyb3NzIG11bHRpcGxlIGZpbGVzIGluIGNhY2hpbmctaHRtbC1jb21waWxlciB1c2luZyB0aGVcbiAgICAgIC8vIGF0dHJpYnV0ZXMgb24gcmVzdWx0cy5ib2R5QXR0cnNcbiAgICAgIGlmICh0aGlzLnJlc3VsdHMuYm9keUF0dHJzLmhhc093blByb3BlcnR5KGF0dHIpICYmIHRoaXMucmVzdWx0cy5ib2R5QXR0cnNbYXR0cl0gIT09IHZhbCkge1xuICAgICAgICB0aGlzLnRocm93Q29tcGlsZUVycm9yKFxuICAgICAgICAgIGA8Ym9keT4gZGVjbGFyYXRpb25zIGhhdmUgY29uZmxpY3RpbmcgdmFsdWVzIGZvciB0aGUgJyR7YXR0cn0nIGF0dHJpYnV0ZS5gKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5yZXN1bHRzLmJvZHlBdHRyc1thdHRyXSA9IHZhbDtcbiAgICB9KTtcbiAgfVxuXG4gIHRocm93Q29tcGlsZUVycm9yKG1lc3NhZ2UsIG92ZXJyaWRlSW5kZXgpIHtcbiAgICBUZW1wbGF0aW5nVG9vbHMudGhyb3dDb21waWxlRXJyb3IodGhpcy50YWcsIG1lc3NhZ2UsIG92ZXJyaWRlSW5kZXgpO1xuICB9XG59XG4iLCJUZW1wbGF0aW5nVG9vbHMudGhyb3dDb21waWxlRXJyb3IgPVxuZnVuY3Rpb24gdGhyb3dDb21waWxlRXJyb3IodGFnLCBtZXNzYWdlLCBvdmVycmlkZUluZGV4KSB7XG4gIGNvbnN0IGZpbmFsSW5kZXggPSAodHlwZW9mIG92ZXJyaWRlSW5kZXggPT09ICdudW1iZXInID9cbiAgICBvdmVycmlkZUluZGV4IDogdGFnLnRhZ1N0YXJ0SW5kZXgpO1xuXG4gIGNvbnN0IGVyciA9IG5ldyBUZW1wbGF0aW5nVG9vbHMuQ29tcGlsZUVycm9yKCk7XG4gIGVyci5tZXNzYWdlID0gbWVzc2FnZSB8fCBcImJhZCBmb3JtYXR0aW5nIGluIHRlbXBsYXRlIGZpbGVcIjtcbiAgZXJyLmZpbGUgPSB0YWcuc291cmNlTmFtZTtcbiAgZXJyLmxpbmUgPSB0YWcuZmlsZUNvbnRlbnRzLnN1YnN0cmluZygwLCBmaW5hbEluZGV4KS5zcGxpdCgnXFxuJykubGVuZ3RoO1xuICB0aHJvdyBlcnI7XG59XG4iLCJUZW1wbGF0aW5nVG9vbHMuZ2VuZXJhdGVUZW1wbGF0ZUpTID1cbmZ1bmN0aW9uIGdlbmVyYXRlVGVtcGxhdGVKUyhuYW1lLCByZW5kZXJGdW5jQ29kZSkge1xuICBjb25zdCBuYW1lTGl0ZXJhbCA9IEpTT04uc3RyaW5naWZ5KG5hbWUpO1xuICBjb25zdCB0ZW1wbGF0ZURvdE5hbWVMaXRlcmFsID0gSlNPTi5zdHJpbmdpZnkoYFRlbXBsYXRlLiR7bmFtZX1gKTtcblxuICByZXR1cm4gYFxuVGVtcGxhdGUuX19jaGVja05hbWUoJHtuYW1lTGl0ZXJhbH0pO1xuVGVtcGxhdGVbJHtuYW1lTGl0ZXJhbH1dID0gbmV3IFRlbXBsYXRlKCR7dGVtcGxhdGVEb3ROYW1lTGl0ZXJhbH0sICR7cmVuZGVyRnVuY0NvZGV9KTtcbmA7XG59XG5cblRlbXBsYXRpbmdUb29scy5nZW5lcmF0ZUJvZHlKUyA9XG5mdW5jdGlvbiBnZW5lcmF0ZUJvZHlKUyhyZW5kZXJGdW5jQ29kZSkge1xuICByZXR1cm4gYFxuVGVtcGxhdGUuYm9keS5hZGRDb250ZW50KCR7cmVuZGVyRnVuY0NvZGV9KTtcbk1ldGVvci5zdGFydHVwKFRlbXBsYXRlLmJvZHkucmVuZGVyVG9Eb2N1bWVudCk7XG5gO1xufVxuIl19
