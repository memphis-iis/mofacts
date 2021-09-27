(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var ECMAScript = Package.ecmascript.ECMAScript;
var SpacebarsCompiler = Package['spacebars-compiler'].SpacebarsCompiler;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var TemplatingTools;

var require = meteorInstall({"node_modules":{"meteor":{"templating-tools":{"templating-tools.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/templating-tools/templating-tools.js                                                                      //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
module.export({
  TemplatingTools: () => TemplatingTools
});
let scanHtmlForTags;
module.link("./html-scanner", {
  scanHtmlForTags(v) {
    scanHtmlForTags = v;
  }

}, 0);
let compileTagsWithSpacebars;
module.link("./compile-tags-with-spacebars", {
  compileTagsWithSpacebars(v) {
    compileTagsWithSpacebars = v;
  }

}, 1);
let generateTemplateJS, generateBodyJS;
module.link("./code-generation", {
  generateTemplateJS(v) {
    generateTemplateJS = v;
  },

  generateBodyJS(v) {
    generateBodyJS = v;
  }

}, 2);
let CompileError, throwCompileError;
module.link("./throw-compile-error", {
  CompileError(v) {
    CompileError = v;
  },

  throwCompileError(v) {
    throwCompileError = v;
  }

}, 3);
const TemplatingTools = {
  scanHtmlForTags,
  compileTagsWithSpacebars,
  generateTemplateJS,
  generateBodyJS,
  CompileError,
  throwCompileError
};
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"code-generation.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/templating-tools/code-generation.js                                                                       //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
!function (module1) {
  module1.export({
    generateTemplateJS: () => generateTemplateJS,
    generateBodyJS: () => generateBodyJS
  });

  function generateTemplateJS(name, renderFuncCode, useHMR) {
    const nameLiteral = JSON.stringify(name);
    const templateDotNameLiteral = JSON.stringify("Template.".concat(name));

    if (useHMR) {
      // module.hot.data is used to make sure Template.__checkName can still
      // detect duplicates
      return "\nTemplate._migrateTemplate(\n  ".concat(nameLiteral, ",\n  new Template(").concat(templateDotNameLiteral, ", ").concat(renderFuncCode, "),\n);\nif (typeof module === \"object\" && module.hot) {\n  module.hot.accept();\n  module.hot.dispose(function () {\n    Template.__pendingReplacement.push(").concat(nameLiteral, ");\n    Template._applyHmrChanges(").concat(nameLiteral, ");\n  });\n}\n");
    }

    return "\nTemplate.__checkName(".concat(nameLiteral, ");\nTemplate[").concat(nameLiteral, "] = new Template(").concat(templateDotNameLiteral, ", ").concat(renderFuncCode, ");\n");
  }

  function generateBodyJS(renderFuncCode, useHMR) {
    if (useHMR) {
      return "\n(function () {\n  var renderFunc = ".concat(renderFuncCode, ";\n  Template.body.addContent(renderFunc);\n  Meteor.startup(Template.body.renderToDocument);\n  if (typeof module === \"object\" && module.hot) {\n    module.hot.accept();\n    module.hot.dispose(function () {\n      var index = Template.body.contentRenderFuncs.indexOf(renderFunc)\n      Template.body.contentRenderFuncs.splice(index, 1);\n      Template._applyHmrChanges();\n    });\n  }\n})();\n");
    }

    return "\nTemplate.body.addContent(".concat(renderFuncCode, ");\nMeteor.startup(Template.body.renderToDocument);\n");
  }
}.call(this, module);
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"compile-tags-with-spacebars.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/templating-tools/compile-tags-with-spacebars.js                                                           //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
let _objectWithoutProperties;

module.link("@babel/runtime/helpers/objectWithoutProperties", {
  default(v) {
    _objectWithoutProperties = v;
  }

}, 0);
module.export({
  compileTagsWithSpacebars: () => compileTagsWithSpacebars
});
let isEmpty;
module.link("lodash.isempty", {
  default(v) {
    isEmpty = v;
  }

}, 0);
let SpacebarsCompiler;
module.link("meteor/spacebars-compiler", {
  SpacebarsCompiler(v) {
    SpacebarsCompiler = v;
  }

}, 1);
let generateBodyJS, generateTemplateJS;
module.link("./code-generation", {
  generateBodyJS(v) {
    generateBodyJS = v;
  },

  generateTemplateJS(v) {
    generateTemplateJS = v;
  }

}, 2);
let throwCompileError;
module.link("./throw-compile-error", {
  throwCompileError(v) {
    throwCompileError = v;
  }

}, 3);

function compileTagsWithSpacebars(tags, hmrAvailable) {
  var handler = new SpacebarsTagCompiler();
  tags.forEach(tag => {
    handler.addTagToResults(tag, hmrAvailable);
  });
  return handler.getResults();
}

class SpacebarsTagCompiler {
  constructor() {
    this.results = {
      head: '',
      body: '',
      js: '',
      bodyAttrs: {}
    };
  }

  getResults() {
    return this.results;
  }

  addTagToResults(tag, hmrAvailable) {
    this.tag = tag; // do we have 1 or more attributes?

    const hasAttribs = !isEmpty(this.tag.attribs);

    if (this.tag.tagName === "head") {
      if (hasAttribs) {
        this.throwCompileError("Attributes on <head> not supported");
      }

      this.results.head += this.tag.contents;
      return;
    } // <body> or <template>


    try {
      if (this.tag.tagName === "template") {
        const name = this.tag.attribs.name;

        if (!name) {
          this.throwCompileError("Template has no 'name' attribute");
        }

        if (SpacebarsCompiler.isReservedName(name)) {
          this.throwCompileError("Template can't be named \"".concat(name, "\""));
        }

        const whitespace = this.tag.attribs.whitespace || '';
        const renderFuncCode = SpacebarsCompiler.compile(this.tag.contents, {
          whitespace,
          isTemplate: true,
          sourceName: "Template \"".concat(name, "\"")
        });
        this.results.js += generateTemplateJS(name, renderFuncCode, hmrAvailable);
      } else if (this.tag.tagName === "body") {
        const _this$tag$attribs = this.tag.attribs,
              {
          whitespace = ''
        } = _this$tag$attribs,
              attribs = _objectWithoutProperties(_this$tag$attribs, ["whitespace"]);

        this.addBodyAttrs(attribs);
        const renderFuncCode = SpacebarsCompiler.compile(this.tag.contents, {
          whitespace,
          isBody: true,
          sourceName: "<body>"
        }); // We may be one of many `<body>` tags.

        this.results.js += generateBodyJS(renderFuncCode, hmrAvailable);
      } else {
        this.throwCompileError("Expected <template>, <head>, or <body> tag in template file", tagStartIndex);
      }
    } catch (e) {
      if (e.scanner) {
        // The error came from Spacebars
        this.throwCompileError(e.message, this.tag.contentsStartIndex + e.offset);
      } else {
        throw e;
      }
    }
  }

  addBodyAttrs(attrs) {
    Object.keys(attrs).forEach(attr => {
      const val = attrs[attr]; // This check is for conflicting body attributes in the same file;
      // we check across multiple files in caching-html-compiler using the
      // attributes on results.bodyAttrs

      if (this.results.bodyAttrs.hasOwnProperty(attr) && this.results.bodyAttrs[attr] !== val) {
        this.throwCompileError("<body> declarations have conflicting values for the '".concat(attr, "' attribute."));
      }

      this.results.bodyAttrs[attr] = val;
    });
  }

  throwCompileError(message, overrideIndex) {
    throwCompileError(this.tag, message, overrideIndex);
  }

}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"html-scanner.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/templating-tools/html-scanner.js                                                                          //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
module.export({
  scanHtmlForTags: () => scanHtmlForTags
});
let CompileError;
module.link("./throw-compile-error", {
  CompileError(v) {
    CompileError = v;
  }

}, 0);

function scanHtmlForTags(options) {
  const scan = new HtmlScan(options);
  return scan.getTags();
}

/**
 * Scan an HTML file for top-level tags and extract their contents. Pass them to
 * a tag handler (an object with a handleTag method)
 *
 * This is a primitive, regex-based scanner.  It scans
 * top-level tags, which are allowed to have attributes,
 * and ignores top-level HTML comments.
 */
class HtmlScan {
  /**
   * Initialize and run a scan of a single file
   * @param  {String} sourceName The filename, used in errors only
   * @param  {String} contents   The contents of the file
   * @param  {String[]} tagNames An array of tag names that are accepted at the
   * top level. If any other tag is encountered, an error is thrown.
   */
  constructor(_ref) {
    let {
      sourceName,
      contents,
      tagNames
    } = _ref;
    this.sourceName = sourceName;
    this.contents = contents;
    this.tagNames = tagNames;
    this.rest = contents;
    this.index = 0;
    this.tags = [];
    const tagNameRegex = this.tagNames.join("|");
    const openTagRegex = new RegExp("^((<(".concat(tagNameRegex, ")\\b)|(<!--)|(<!DOCTYPE|{{!)|$)"), "i");

    while (this.rest) {
      // skip whitespace first (for better line numbers)
      this.advance(this.rest.match(/^\s*/)[0].length);
      const match = openTagRegex.exec(this.rest);

      if (!match) {
        this.throwCompileError("Expected one of: <".concat(this.tagNames.join('>, <'), ">"));
      }

      const matchToken = match[1];
      const matchTokenTagName = match[3];
      const matchTokenComment = match[4];
      const matchTokenUnsupported = match[5];
      const tagStartIndex = this.index;
      this.advance(match.index + match[0].length);

      if (!matchToken) {
        break; // matched $ (end of file)
      }

      if (matchTokenComment === '<!--') {
        // top-level HTML comment
        const commentEnd = /--\s*>/.exec(this.rest);
        if (!commentEnd) this.throwCompileError("unclosed HTML comment in template file");
        this.advance(commentEnd.index + commentEnd[0].length);
        continue;
      }

      if (matchTokenUnsupported) {
        switch (matchTokenUnsupported.toLowerCase()) {
          case '<!doctype':
            this.throwCompileError("Can't set DOCTYPE here.  (Meteor sets <!DOCTYPE html> for you)");

          case '{{!':
            this.throwCompileError("Can't use '{{! }}' outside a template.  Use '<!-- -->'.");
        }

        this.throwCompileError();
      } // otherwise, a <tag>


      const tagName = matchTokenTagName.toLowerCase();
      const tagAttribs = {}; // bare name -> value dict

      const tagPartRegex = /^\s*((([a-zA-Z0-9:_-]+)\s*=\s*(["'])(.*?)\4)|(>))/; // read attributes

      let attr;

      while (attr = tagPartRegex.exec(this.rest)) {
        const attrToken = attr[1];
        const attrKey = attr[3];
        let attrValue = attr[5];
        this.advance(attr.index + attr[0].length);

        if (attrToken === '>') {
          break;
        } // XXX we don't HTML unescape the attribute value
        // (e.g. to allow "abcd&quot;efg") or protect against
        // collisions with methods of tagAttribs (e.g. for
        // a property named toString)


        attrValue = attrValue.match(/^\s*([\s\S]*?)\s*$/)[1]; // trim

        tagAttribs[attrKey] = attrValue;
      }

      if (!attr) {
        // didn't end on '>'
        this.throwCompileError("Parse error in tag");
      } // find </tag>


      const end = new RegExp('</' + tagName + '\\s*>', 'i').exec(this.rest);

      if (!end) {
        this.throwCompileError("unclosed <" + tagName + ">");
      }

      const tagContents = this.rest.slice(0, end.index);
      const contentsStartIndex = this.index; // trim the tag contents.
      // this is a courtesy and is also relied on by some unit tests.

      var m = tagContents.match(/^([ \t\r\n]*)([\s\S]*?)[ \t\r\n]*$/);
      const trimmedContentsStartIndex = contentsStartIndex + m[1].length;
      const trimmedTagContents = m[2];
      const tag = {
        tagName: tagName,
        attribs: tagAttribs,
        contents: trimmedTagContents,
        contentsStartIndex: trimmedContentsStartIndex,
        tagStartIndex: tagStartIndex,
        fileContents: this.contents,
        sourceName: this.sourceName
      }; // save the tag

      this.tags.push(tag); // advance afterwards, so that line numbers in errors are correct

      this.advance(end.index + end[0].length);
    }
  }
  /**
   * Advance the parser
   * @param  {Number} amount The amount of characters to advance
   */


  advance(amount) {
    this.rest = this.rest.substring(amount);
    this.index += amount;
  }

  throwCompileError(msg, overrideIndex) {
    const finalIndex = typeof overrideIndex === 'number' ? overrideIndex : this.index;
    const err = new CompileError();
    err.message = msg || "bad formatting in template file";
    err.file = this.sourceName;
    err.line = this.contents.substring(0, finalIndex).split('\n').length;
    throw err;
  }

  throwBodyAttrsError(msg) {
    this.parseError(msg);
  }

  getTags() {
    return this.tags;
  }

}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"throw-compile-error.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/templating-tools/throw-compile-error.js                                                                   //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
module.export({
  CompileError: () => CompileError,
  throwCompileError: () => throwCompileError
});

class CompileError {}

function throwCompileError(tag, message, overrideIndex) {
  const finalIndex = typeof overrideIndex === 'number' ? overrideIndex : tag.tagStartIndex;
  const err = new CompileError();
  err.message = message || "bad formatting in template file";
  err.file = tag.sourceName;
  err.line = tag.fileContents.substring(0, finalIndex).split('\n').length;
  throw err;
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"node_modules":{"lodash.isempty":{"package.json":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// node_modules/meteor/templating-tools/node_modules/lodash.isempty/package.json                                      //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
module.exports = {
  "name": "lodash.isempty",
  "version": "4.4.0"
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// node_modules/meteor/templating-tools/node_modules/lodash.isempty/index.js                                          //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
module.useNode();
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});

var exports = require("/node_modules/meteor/templating-tools/templating-tools.js");

/* Exports */
Package._define("templating-tools", exports, {
  TemplatingTools: TemplatingTools
});

})();




//# sourceURL=meteor://💻app/packages/templating-tools.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvdGVtcGxhdGluZy10b29scy90ZW1wbGF0aW5nLXRvb2xzLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy90ZW1wbGF0aW5nLXRvb2xzL2NvZGUtZ2VuZXJhdGlvbi5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvdGVtcGxhdGluZy10b29scy9jb21waWxlLXRhZ3Mtd2l0aC1zcGFjZWJhcnMuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3RlbXBsYXRpbmctdG9vbHMvaHRtbC1zY2FubmVyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy90ZW1wbGF0aW5nLXRvb2xzL3Rocm93LWNvbXBpbGUtZXJyb3IuanMiXSwibmFtZXMiOlsibW9kdWxlIiwiZXhwb3J0IiwiVGVtcGxhdGluZ1Rvb2xzIiwic2Nhbkh0bWxGb3JUYWdzIiwibGluayIsInYiLCJjb21waWxlVGFnc1dpdGhTcGFjZWJhcnMiLCJnZW5lcmF0ZVRlbXBsYXRlSlMiLCJnZW5lcmF0ZUJvZHlKUyIsIkNvbXBpbGVFcnJvciIsInRocm93Q29tcGlsZUVycm9yIiwibW9kdWxlMSIsIm5hbWUiLCJyZW5kZXJGdW5jQ29kZSIsInVzZUhNUiIsIm5hbWVMaXRlcmFsIiwiSlNPTiIsInN0cmluZ2lmeSIsInRlbXBsYXRlRG90TmFtZUxpdGVyYWwiLCJfb2JqZWN0V2l0aG91dFByb3BlcnRpZXMiLCJkZWZhdWx0IiwiaXNFbXB0eSIsIlNwYWNlYmFyc0NvbXBpbGVyIiwidGFncyIsImhtckF2YWlsYWJsZSIsImhhbmRsZXIiLCJTcGFjZWJhcnNUYWdDb21waWxlciIsImZvckVhY2giLCJ0YWciLCJhZGRUYWdUb1Jlc3VsdHMiLCJnZXRSZXN1bHRzIiwiY29uc3RydWN0b3IiLCJyZXN1bHRzIiwiaGVhZCIsImJvZHkiLCJqcyIsImJvZHlBdHRycyIsImhhc0F0dHJpYnMiLCJhdHRyaWJzIiwidGFnTmFtZSIsImNvbnRlbnRzIiwiaXNSZXNlcnZlZE5hbWUiLCJ3aGl0ZXNwYWNlIiwiY29tcGlsZSIsImlzVGVtcGxhdGUiLCJzb3VyY2VOYW1lIiwiYWRkQm9keUF0dHJzIiwiaXNCb2R5IiwidGFnU3RhcnRJbmRleCIsImUiLCJzY2FubmVyIiwibWVzc2FnZSIsImNvbnRlbnRzU3RhcnRJbmRleCIsIm9mZnNldCIsImF0dHJzIiwiT2JqZWN0Iiwia2V5cyIsImF0dHIiLCJ2YWwiLCJoYXNPd25Qcm9wZXJ0eSIsIm92ZXJyaWRlSW5kZXgiLCJvcHRpb25zIiwic2NhbiIsIkh0bWxTY2FuIiwiZ2V0VGFncyIsInRhZ05hbWVzIiwicmVzdCIsImluZGV4IiwidGFnTmFtZVJlZ2V4Iiwiam9pbiIsIm9wZW5UYWdSZWdleCIsIlJlZ0V4cCIsImFkdmFuY2UiLCJtYXRjaCIsImxlbmd0aCIsImV4ZWMiLCJtYXRjaFRva2VuIiwibWF0Y2hUb2tlblRhZ05hbWUiLCJtYXRjaFRva2VuQ29tbWVudCIsIm1hdGNoVG9rZW5VbnN1cHBvcnRlZCIsImNvbW1lbnRFbmQiLCJ0b0xvd2VyQ2FzZSIsInRhZ0F0dHJpYnMiLCJ0YWdQYXJ0UmVnZXgiLCJhdHRyVG9rZW4iLCJhdHRyS2V5IiwiYXR0clZhbHVlIiwiZW5kIiwidGFnQ29udGVudHMiLCJzbGljZSIsIm0iLCJ0cmltbWVkQ29udGVudHNTdGFydEluZGV4IiwidHJpbW1lZFRhZ0NvbnRlbnRzIiwiZmlsZUNvbnRlbnRzIiwicHVzaCIsImFtb3VudCIsInN1YnN0cmluZyIsIm1zZyIsImZpbmFsSW5kZXgiLCJlcnIiLCJmaWxlIiwibGluZSIsInNwbGl0IiwidGhyb3dCb2R5QXR0cnNFcnJvciIsInBhcnNlRXJyb3IiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQUEsTUFBTSxDQUFDQyxNQUFQLENBQWM7QUFBQ0MsaUJBQWUsRUFBQyxNQUFJQTtBQUFyQixDQUFkO0FBQXFELElBQUlDLGVBQUo7QUFBb0JILE1BQU0sQ0FBQ0ksSUFBUCxDQUFZLGdCQUFaLEVBQTZC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RCxZQUFOLENBQW1COztBQUVuQixTQUFTQyxpQkFBVCxDQUEyQmtCLEdBQTNCLEVBQWdDdUIsT0FBaEMsRUFBeUNTLGFBQXpDLEVBQXdEO0FBQzdELFFBQU1zQyxVQUFVLEdBQUksT0FBT3RDLGFBQVAsS0FBeUIsUUFBekIsR0FDbEJBLGFBRGtCLEdBQ0ZoQyxHQUFHLENBQUNvQixhQUR0QjtBQUdBLFFBQU1tRCxHQUFHLEdBQUcsSUFBSTFGLFlBQUosRUFBWjtBQUNBMEYsS0FBRyxDQUFDaEQsT0FBSixHQUFjQSxPQUFPLElBQUksaUNBQXpCO0FBQ0FnRCxLQUFHLENBQUNDLElBQUosR0FBV3hFLEdBQUcsQ0FBQ2lCLFVBQWY7QUFDQXNELEtBQUcsQ0FBQ0UsSUFBSixHQUFXekUsR0FBRyxDQUFDaUUsWUFBSixDQUFpQkcsU0FBakIsQ0FBMkIsQ0FBM0IsRUFBOEJFLFVBQTlCLEVBQTBDSSxLQUExQyxDQUFnRCxJQUFoRCxFQUFzRDVCLE1BQWpFO0FBQ0EsUUFBTXlCLEdBQU47QUFDRCxDIiwiZmlsZSI6Ii9wYWNrYWdlcy90ZW1wbGF0aW5nLXRvb2xzLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgc2Nhbkh0bWxGb3JUYWdzIH0gZnJvbSAnLi9odG1sLXNjYW5uZXInO1xuaW1wb3J0IHsgY29tcGlsZVRhZ3NXaXRoU3BhY2ViYXJzIH0gZnJvbSAnLi9jb21waWxlLXRhZ3Mtd2l0aC1zcGFjZWJhcnMnO1xuaW1wb3J0IHsgZ2VuZXJhdGVUZW1wbGF0ZUpTLCBnZW5lcmF0ZUJvZHlKUyB9IGZyb20gJy4vY29kZS1nZW5lcmF0aW9uJ1xuaW1wb3J0IHsgQ29tcGlsZUVycm9yLCB0aHJvd0NvbXBpbGVFcnJvcn0gZnJvbSAnLi90aHJvdy1jb21waWxlLWVycm9yJztcblxuZXhwb3J0IGNvbnN0IFRlbXBsYXRpbmdUb29scyAgPSB7XG4gIHNjYW5IdG1sRm9yVGFncyxcbiAgY29tcGlsZVRhZ3NXaXRoU3BhY2ViYXJzLFxuICBnZW5lcmF0ZVRlbXBsYXRlSlMsXG4gIGdlbmVyYXRlQm9keUpTLFxuICBDb21waWxlRXJyb3IsXG4gIHRocm93Q29tcGlsZUVycm9yXG59O1xuIiwiZXhwb3J0IGZ1bmN0aW9uIGdlbmVyYXRlVGVtcGxhdGVKUyhuYW1lLCByZW5kZXJGdW5jQ29kZSwgdXNlSE1SKSB7XG4gIGNvbnN0IG5hbWVMaXRlcmFsID0gSlNPTi5zdHJpbmdpZnkobmFtZSk7XG4gIGNvbnN0IHRlbXBsYXRlRG90TmFtZUxpdGVyYWwgPSBKU09OLnN0cmluZ2lmeShgVGVtcGxhdGUuJHtuYW1lfWApO1xuXG4gIGlmICh1c2VITVIpIHtcbiAgICAvLyBtb2R1bGUuaG90LmRhdGEgaXMgdXNlZCB0byBtYWtlIHN1cmUgVGVtcGxhdGUuX19jaGVja05hbWUgY2FuIHN0aWxsXG4gICAgLy8gZGV0ZWN0IGR1cGxpY2F0ZXNcbiAgICByZXR1cm4gYFxuVGVtcGxhdGUuX21pZ3JhdGVUZW1wbGF0ZShcbiAgJHtuYW1lTGl0ZXJhbH0sXG4gIG5ldyBUZW1wbGF0ZSgke3RlbXBsYXRlRG90TmFtZUxpdGVyYWx9LCAke3JlbmRlckZ1bmNDb2RlfSksXG4pO1xuaWYgKHR5cGVvZiBtb2R1bGUgPT09IFwib2JqZWN0XCIgJiYgbW9kdWxlLmhvdCkge1xuICBtb2R1bGUuaG90LmFjY2VwdCgpO1xuICBtb2R1bGUuaG90LmRpc3Bvc2UoZnVuY3Rpb24gKCkge1xuICAgIFRlbXBsYXRlLl9fcGVuZGluZ1JlcGxhY2VtZW50LnB1c2goJHtuYW1lTGl0ZXJhbH0pO1xuICAgIFRlbXBsYXRlLl9hcHBseUhtckNoYW5nZXMoJHtuYW1lTGl0ZXJhbH0pO1xuICB9KTtcbn1cbmBcbiAgfVxuXG4gIHJldHVybiBgXG5UZW1wbGF0ZS5fX2NoZWNrTmFtZSgke25hbWVMaXRlcmFsfSk7XG5UZW1wbGF0ZVske25hbWVMaXRlcmFsfV0gPSBuZXcgVGVtcGxhdGUoJHt0ZW1wbGF0ZURvdE5hbWVMaXRlcmFsfSwgJHtyZW5kZXJGdW5jQ29kZX0pO1xuYDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdlbmVyYXRlQm9keUpTKHJlbmRlckZ1bmNDb2RlLCB1c2VITVIpIHtcbiAgaWYgKHVzZUhNUikge1xuICAgIHJldHVybiBgXG4oZnVuY3Rpb24gKCkge1xuICB2YXIgcmVuZGVyRnVuYyA9ICR7cmVuZGVyRnVuY0NvZGV9O1xuICBUZW1wbGF0ZS5ib2R5LmFkZENvbnRlbnQocmVuZGVyRnVuYyk7XG4gIE1ldGVvci5zdGFydHVwKFRlbXBsYXRlLmJvZHkucmVuZGVyVG9Eb2N1bWVudCk7XG4gIGlmICh0eXBlb2YgbW9kdWxlID09PSBcIm9iamVjdFwiICYmIG1vZHVsZS5ob3QpIHtcbiAgICBtb2R1bGUuaG90LmFjY2VwdCgpO1xuICAgIG1vZHVsZS5ob3QuZGlzcG9zZShmdW5jdGlvbiAoKSB7XG4gICAgICB2YXIgaW5kZXggPSBUZW1wbGF0ZS5ib2R5LmNvbnRlbnRSZW5kZXJGdW5jcy5pbmRleE9mKHJlbmRlckZ1bmMpXG4gICAgICBUZW1wbGF0ZS5ib2R5LmNvbnRlbnRSZW5kZXJGdW5jcy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgVGVtcGxhdGUuX2FwcGx5SG1yQ2hhbmdlcygpO1xuICAgIH0pO1xuICB9XG59KSgpO1xuYFxuICB9XG5cbiAgcmV0dXJuIGBcblRlbXBsYXRlLmJvZHkuYWRkQ29udGVudCgke3JlbmRlckZ1bmNDb2RlfSk7XG5NZXRlb3Iuc3RhcnR1cChUZW1wbGF0ZS5ib2R5LnJlbmRlclRvRG9jdW1lbnQpO1xuYDtcbn1cbiIsImltcG9ydCBpc0VtcHR5IGZyb20gJ2xvZGFzaC5pc2VtcHR5JztcbmltcG9ydCB7IFNwYWNlYmFyc0NvbXBpbGVyIH0gZnJvbSAnbWV0ZW9yL3NwYWNlYmFycy1jb21waWxlcic7XG5pbXBvcnQgeyBnZW5lcmF0ZUJvZHlKUywgZ2VuZXJhdGVUZW1wbGF0ZUpTIH0gZnJvbSAnLi9jb2RlLWdlbmVyYXRpb24nO1xuaW1wb3J0IHsgdGhyb3dDb21waWxlRXJyb3IgfSBmcm9tICcuL3Rocm93LWNvbXBpbGUtZXJyb3InO1xuXG5leHBvcnQgZnVuY3Rpb24gY29tcGlsZVRhZ3NXaXRoU3BhY2ViYXJzKHRhZ3MsIGhtckF2YWlsYWJsZSkge1xuICB2YXIgaGFuZGxlciA9IG5ldyBTcGFjZWJhcnNUYWdDb21waWxlcigpO1xuXG4gIHRhZ3MuZm9yRWFjaCgodGFnKSA9PiB7XG4gICAgaGFuZGxlci5hZGRUYWdUb1Jlc3VsdHModGFnLCBobXJBdmFpbGFibGUpO1xuICB9KTtcblxuICByZXR1cm4gaGFuZGxlci5nZXRSZXN1bHRzKCk7XG59XG5cblxuY2xhc3MgU3BhY2ViYXJzVGFnQ29tcGlsZXIge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLnJlc3VsdHMgPSB7XG4gICAgICBoZWFkOiAnJyxcbiAgICAgIGJvZHk6ICcnLFxuICAgICAganM6ICcnLFxuICAgICAgYm9keUF0dHJzOiB7fVxuICAgIH07XG4gIH1cblxuICBnZXRSZXN1bHRzKCkge1xuICAgIHJldHVybiB0aGlzLnJlc3VsdHM7XG4gIH1cblxuICBhZGRUYWdUb1Jlc3VsdHModGFnLCBobXJBdmFpbGFibGUpIHtcbiAgICB0aGlzLnRhZyA9IHRhZztcblxuICAgIC8vIGRvIHdlIGhhdmUgMSBvciBtb3JlIGF0dHJpYnV0ZXM/XG4gICAgY29uc3QgaGFzQXR0cmlicyA9ICFpc0VtcHR5KHRoaXMudGFnLmF0dHJpYnMpO1xuXG4gICAgaWYgKHRoaXMudGFnLnRhZ05hbWUgPT09IFwiaGVhZFwiKSB7XG4gICAgICBpZiAoaGFzQXR0cmlicykge1xuICAgICAgICB0aGlzLnRocm93Q29tcGlsZUVycm9yKFwiQXR0cmlidXRlcyBvbiA8aGVhZD4gbm90IHN1cHBvcnRlZFwiKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5yZXN1bHRzLmhlYWQgKz0gdGhpcy50YWcuY29udGVudHM7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG5cbiAgICAvLyA8Ym9keT4gb3IgPHRlbXBsYXRlPlxuXG4gICAgdHJ5IHtcbiAgICAgIGlmICh0aGlzLnRhZy50YWdOYW1lID09PSBcInRlbXBsYXRlXCIpIHtcbiAgICAgICAgY29uc3QgbmFtZSA9IHRoaXMudGFnLmF0dHJpYnMubmFtZTtcblxuICAgICAgICBpZiAoISBuYW1lKSB7XG4gICAgICAgICAgdGhpcy50aHJvd0NvbXBpbGVFcnJvcihcIlRlbXBsYXRlIGhhcyBubyAnbmFtZScgYXR0cmlidXRlXCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKFNwYWNlYmFyc0NvbXBpbGVyLmlzUmVzZXJ2ZWROYW1lKG5hbWUpKSB7XG4gICAgICAgICAgdGhpcy50aHJvd0NvbXBpbGVFcnJvcihgVGVtcGxhdGUgY2FuJ3QgYmUgbmFtZWQgXCIke25hbWV9XCJgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHdoaXRlc3BhY2UgPSB0aGlzLnRhZy5hdHRyaWJzLndoaXRlc3BhY2UgfHwgJyc7XG5cbiAgICAgICAgY29uc3QgcmVuZGVyRnVuY0NvZGUgPSBTcGFjZWJhcnNDb21waWxlci5jb21waWxlKHRoaXMudGFnLmNvbnRlbnRzLCB7XG4gICAgICAgICAgd2hpdGVzcGFjZSxcbiAgICAgICAgICBpc1RlbXBsYXRlOiB0cnVlLFxuICAgICAgICAgIHNvdXJjZU5hbWU6IGBUZW1wbGF0ZSBcIiR7bmFtZX1cImBcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5yZXN1bHRzLmpzICs9IGdlbmVyYXRlVGVtcGxhdGVKUyhcbiAgICAgICAgICBuYW1lLCByZW5kZXJGdW5jQ29kZSwgaG1yQXZhaWxhYmxlKTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy50YWcudGFnTmFtZSA9PT0gXCJib2R5XCIpIHtcbiAgICAgICAgY29uc3QgeyB3aGl0ZXNwYWNlID0gJycsIC4uLmF0dHJpYnMgfSA9IHRoaXMudGFnLmF0dHJpYnM7XG4gICAgICAgIHRoaXMuYWRkQm9keUF0dHJzKGF0dHJpYnMpO1xuXG4gICAgICAgIGNvbnN0IHJlbmRlckZ1bmNDb2RlID0gU3BhY2ViYXJzQ29tcGlsZXIuY29tcGlsZSh0aGlzLnRhZy5jb250ZW50cywge1xuICAgICAgICAgIHdoaXRlc3BhY2UsXG4gICAgICAgICAgaXNCb2R5OiB0cnVlLFxuICAgICAgICAgIHNvdXJjZU5hbWU6IFwiPGJvZHk+XCJcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gV2UgbWF5IGJlIG9uZSBvZiBtYW55IGA8Ym9keT5gIHRhZ3MuXG4gICAgICAgIHRoaXMucmVzdWx0cy5qcyArPSBnZW5lcmF0ZUJvZHlKUyhyZW5kZXJGdW5jQ29kZSwgaG1yQXZhaWxhYmxlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMudGhyb3dDb21waWxlRXJyb3IoXCJFeHBlY3RlZCA8dGVtcGxhdGU+LCA8aGVhZD4sIG9yIDxib2R5PiB0YWcgaW4gdGVtcGxhdGUgZmlsZVwiLCB0YWdTdGFydEluZGV4KTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBpZiAoZS5zY2FubmVyKSB7XG4gICAgICAgIC8vIFRoZSBlcnJvciBjYW1lIGZyb20gU3BhY2ViYXJzXG4gICAgICAgIHRoaXMudGhyb3dDb21waWxlRXJyb3IoZS5tZXNzYWdlLCB0aGlzLnRhZy5jb250ZW50c1N0YXJ0SW5kZXggKyBlLm9mZnNldCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBlO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGFkZEJvZHlBdHRycyhhdHRycykge1xuICAgIE9iamVjdC5rZXlzKGF0dHJzKS5mb3JFYWNoKChhdHRyKSA9PiB7XG4gICAgICBjb25zdCB2YWwgPSBhdHRyc1thdHRyXTtcblxuICAgICAgLy8gVGhpcyBjaGVjayBpcyBmb3IgY29uZmxpY3RpbmcgYm9keSBhdHRyaWJ1dGVzIGluIHRoZSBzYW1lIGZpbGU7XG4gICAgICAvLyB3ZSBjaGVjayBhY3Jvc3MgbXVsdGlwbGUgZmlsZXMgaW4gY2FjaGluZy1odG1sLWNvbXBpbGVyIHVzaW5nIHRoZVxuICAgICAgLy8gYXR0cmlidXRlcyBvbiByZXN1bHRzLmJvZHlBdHRyc1xuICAgICAgaWYgKHRoaXMucmVzdWx0cy5ib2R5QXR0cnMuaGFzT3duUHJvcGVydHkoYXR0cikgJiYgdGhpcy5yZXN1bHRzLmJvZHlBdHRyc1thdHRyXSAhPT0gdmFsKSB7XG4gICAgICAgIHRoaXMudGhyb3dDb21waWxlRXJyb3IoXG4gICAgICAgICAgYDxib2R5PiBkZWNsYXJhdGlvbnMgaGF2ZSBjb25mbGljdGluZyB2YWx1ZXMgZm9yIHRoZSAnJHthdHRyfScgYXR0cmlidXRlLmApO1xuICAgICAgfVxuXG4gICAgICB0aGlzLnJlc3VsdHMuYm9keUF0dHJzW2F0dHJdID0gdmFsO1xuICAgIH0pO1xuICB9XG5cbiAgdGhyb3dDb21waWxlRXJyb3IobWVzc2FnZSwgb3ZlcnJpZGVJbmRleCkge1xuICAgIHRocm93Q29tcGlsZUVycm9yKHRoaXMudGFnLCBtZXNzYWdlLCBvdmVycmlkZUluZGV4KTtcbiAgfVxufVxuIiwiaW1wb3J0IHsgQ29tcGlsZUVycm9yIH0gZnJvbSAnLi90aHJvdy1jb21waWxlLWVycm9yJztcblxuZXhwb3J0IGZ1bmN0aW9uIHNjYW5IdG1sRm9yVGFncyhvcHRpb25zKSB7XG4gIGNvbnN0IHNjYW4gPSBuZXcgSHRtbFNjYW4ob3B0aW9ucyk7XG4gIHJldHVybiBzY2FuLmdldFRhZ3MoKTtcbn1cblxuLyoqXG4gKiBTY2FuIGFuIEhUTUwgZmlsZSBmb3IgdG9wLWxldmVsIHRhZ3MgYW5kIGV4dHJhY3QgdGhlaXIgY29udGVudHMuIFBhc3MgdGhlbSB0b1xuICogYSB0YWcgaGFuZGxlciAoYW4gb2JqZWN0IHdpdGggYSBoYW5kbGVUYWcgbWV0aG9kKVxuICpcbiAqIFRoaXMgaXMgYSBwcmltaXRpdmUsIHJlZ2V4LWJhc2VkIHNjYW5uZXIuICBJdCBzY2Fuc1xuICogdG9wLWxldmVsIHRhZ3MsIHdoaWNoIGFyZSBhbGxvd2VkIHRvIGhhdmUgYXR0cmlidXRlcyxcbiAqIGFuZCBpZ25vcmVzIHRvcC1sZXZlbCBIVE1MIGNvbW1lbnRzLlxuICovXG5jbGFzcyBIdG1sU2NhbiB7XG4gIC8qKlxuICAgKiBJbml0aWFsaXplIGFuZCBydW4gYSBzY2FuIG9mIGEgc2luZ2xlIGZpbGVcbiAgICogQHBhcmFtICB7U3RyaW5nfSBzb3VyY2VOYW1lIFRoZSBmaWxlbmFtZSwgdXNlZCBpbiBlcnJvcnMgb25seVxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IGNvbnRlbnRzICAgVGhlIGNvbnRlbnRzIG9mIHRoZSBmaWxlXG4gICAqIEBwYXJhbSAge1N0cmluZ1tdfSB0YWdOYW1lcyBBbiBhcnJheSBvZiB0YWcgbmFtZXMgdGhhdCBhcmUgYWNjZXB0ZWQgYXQgdGhlXG4gICAqIHRvcCBsZXZlbC4gSWYgYW55IG90aGVyIHRhZyBpcyBlbmNvdW50ZXJlZCwgYW4gZXJyb3IgaXMgdGhyb3duLlxuICAgKi9cbiAgY29uc3RydWN0b3Ioe1xuICAgICAgICBzb3VyY2VOYW1lLFxuICAgICAgICBjb250ZW50cyxcbiAgICAgICAgdGFnTmFtZXNcbiAgICAgIH0pIHtcbiAgICB0aGlzLnNvdXJjZU5hbWUgPSBzb3VyY2VOYW1lO1xuICAgIHRoaXMuY29udGVudHMgPSBjb250ZW50cztcbiAgICB0aGlzLnRhZ05hbWVzID0gdGFnTmFtZXM7XG5cbiAgICB0aGlzLnJlc3QgPSBjb250ZW50cztcbiAgICB0aGlzLmluZGV4ID0gMDtcblxuICAgIHRoaXMudGFncyA9IFtdO1xuXG4gICAgY29uc3QgdGFnTmFtZVJlZ2V4ID0gdGhpcy50YWdOYW1lcy5qb2luKFwifFwiKTtcbiAgICBjb25zdCBvcGVuVGFnUmVnZXggPSBuZXcgUmVnRXhwKGBeKCg8KCR7dGFnTmFtZVJlZ2V4fSlcXFxcYil8KDwhLS0pfCg8IURPQ1RZUEV8e3shKXwkKWAsIFwiaVwiKTtcblxuICAgIHdoaWxlICh0aGlzLnJlc3QpIHtcbiAgICAgIC8vIHNraXAgd2hpdGVzcGFjZSBmaXJzdCAoZm9yIGJldHRlciBsaW5lIG51bWJlcnMpXG4gICAgICB0aGlzLmFkdmFuY2UodGhpcy5yZXN0Lm1hdGNoKC9eXFxzKi8pWzBdLmxlbmd0aCk7XG5cbiAgICAgIGNvbnN0IG1hdGNoID0gb3BlblRhZ1JlZ2V4LmV4ZWModGhpcy5yZXN0KTtcblxuICAgICAgaWYgKCEgbWF0Y2gpIHtcbiAgICAgICAgdGhpcy50aHJvd0NvbXBpbGVFcnJvcihgRXhwZWN0ZWQgb25lIG9mOiA8JHt0aGlzLnRhZ05hbWVzLmpvaW4oJz4sIDwnKX0+YCk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IG1hdGNoVG9rZW4gPSBtYXRjaFsxXTtcbiAgICAgIGNvbnN0IG1hdGNoVG9rZW5UYWdOYW1lID0gIG1hdGNoWzNdO1xuICAgICAgY29uc3QgbWF0Y2hUb2tlbkNvbW1lbnQgPSBtYXRjaFs0XTtcbiAgICAgIGNvbnN0IG1hdGNoVG9rZW5VbnN1cHBvcnRlZCA9IG1hdGNoWzVdO1xuXG4gICAgICBjb25zdCB0YWdTdGFydEluZGV4ID0gdGhpcy5pbmRleDtcbiAgICAgIHRoaXMuYWR2YW5jZShtYXRjaC5pbmRleCArIG1hdGNoWzBdLmxlbmd0aCk7XG5cbiAgICAgIGlmICghIG1hdGNoVG9rZW4pIHtcbiAgICAgICAgYnJlYWs7IC8vIG1hdGNoZWQgJCAoZW5kIG9mIGZpbGUpXG4gICAgICB9XG5cbiAgICAgIGlmIChtYXRjaFRva2VuQ29tbWVudCA9PT0gJzwhLS0nKSB7XG4gICAgICAgIC8vIHRvcC1sZXZlbCBIVE1MIGNvbW1lbnRcbiAgICAgICAgY29uc3QgY29tbWVudEVuZCA9IC8tLVxccyo+Ly5leGVjKHRoaXMucmVzdCk7XG4gICAgICAgIGlmICghIGNvbW1lbnRFbmQpXG4gICAgICAgICAgdGhpcy50aHJvd0NvbXBpbGVFcnJvcihcInVuY2xvc2VkIEhUTUwgY29tbWVudCBpbiB0ZW1wbGF0ZSBmaWxlXCIpO1xuICAgICAgICB0aGlzLmFkdmFuY2UoY29tbWVudEVuZC5pbmRleCArIGNvbW1lbnRFbmRbMF0ubGVuZ3RoKTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGlmIChtYXRjaFRva2VuVW5zdXBwb3J0ZWQpIHtcbiAgICAgICAgc3dpdGNoIChtYXRjaFRva2VuVW5zdXBwb3J0ZWQudG9Mb3dlckNhc2UoKSkge1xuICAgICAgICBjYXNlICc8IWRvY3R5cGUnOlxuICAgICAgICAgIHRoaXMudGhyb3dDb21waWxlRXJyb3IoXG4gICAgICAgICAgICBcIkNhbid0IHNldCBET0NUWVBFIGhlcmUuICAoTWV0ZW9yIHNldHMgPCFET0NUWVBFIGh0bWw+IGZvciB5b3UpXCIpO1xuICAgICAgICBjYXNlICd7eyEnOlxuICAgICAgICAgIHRoaXMudGhyb3dDb21waWxlRXJyb3IoXG4gICAgICAgICAgICBcIkNhbid0IHVzZSAne3shIH19JyBvdXRzaWRlIGEgdGVtcGxhdGUuICBVc2UgJzwhLS0gLS0+Jy5cIik7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnRocm93Q29tcGlsZUVycm9yKCk7XG4gICAgICB9XG5cbiAgICAgIC8vIG90aGVyd2lzZSwgYSA8dGFnPlxuICAgICAgY29uc3QgdGFnTmFtZSA9IG1hdGNoVG9rZW5UYWdOYW1lLnRvTG93ZXJDYXNlKCk7XG4gICAgICBjb25zdCB0YWdBdHRyaWJzID0ge307IC8vIGJhcmUgbmFtZSAtPiB2YWx1ZSBkaWN0XG4gICAgICBjb25zdCB0YWdQYXJ0UmVnZXggPSAvXlxccyooKChbYS16QS1aMC05Ol8tXSspXFxzKj1cXHMqKFtcIiddKSguKj8pXFw0KXwoPikpLztcblxuICAgICAgLy8gcmVhZCBhdHRyaWJ1dGVzXG4gICAgICBsZXQgYXR0cjtcbiAgICAgIHdoaWxlICgoYXR0ciA9IHRhZ1BhcnRSZWdleC5leGVjKHRoaXMucmVzdCkpKSB7XG4gICAgICAgIGNvbnN0IGF0dHJUb2tlbiA9IGF0dHJbMV07XG4gICAgICAgIGNvbnN0IGF0dHJLZXkgPSBhdHRyWzNdO1xuICAgICAgICBsZXQgYXR0clZhbHVlID0gYXR0cls1XTtcbiAgICAgICAgdGhpcy5hZHZhbmNlKGF0dHIuaW5kZXggKyBhdHRyWzBdLmxlbmd0aCk7XG5cbiAgICAgICAgaWYgKGF0dHJUb2tlbiA9PT0gJz4nKSB7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBYWFggd2UgZG9uJ3QgSFRNTCB1bmVzY2FwZSB0aGUgYXR0cmlidXRlIHZhbHVlXG4gICAgICAgIC8vIChlLmcuIHRvIGFsbG93IFwiYWJjZCZxdW90O2VmZ1wiKSBvciBwcm90ZWN0IGFnYWluc3RcbiAgICAgICAgLy8gY29sbGlzaW9ucyB3aXRoIG1ldGhvZHMgb2YgdGFnQXR0cmlicyAoZS5nLiBmb3JcbiAgICAgICAgLy8gYSBwcm9wZXJ0eSBuYW1lZCB0b1N0cmluZylcbiAgICAgICAgYXR0clZhbHVlID0gYXR0clZhbHVlLm1hdGNoKC9eXFxzKihbXFxzXFxTXSo/KVxccyokLylbMV07IC8vIHRyaW1cbiAgICAgICAgdGFnQXR0cmlic1thdHRyS2V5XSA9IGF0dHJWYWx1ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKCEgYXR0cikgeyAvLyBkaWRuJ3QgZW5kIG9uICc+J1xuICAgICAgICB0aGlzLnRocm93Q29tcGlsZUVycm9yKFwiUGFyc2UgZXJyb3IgaW4gdGFnXCIpO1xuICAgICAgfVxuXG4gICAgICAvLyBmaW5kIDwvdGFnPlxuICAgICAgY29uc3QgZW5kID0gKG5ldyBSZWdFeHAoJzwvJyt0YWdOYW1lKydcXFxccyo+JywgJ2knKSkuZXhlYyh0aGlzLnJlc3QpO1xuICAgICAgaWYgKCEgZW5kKSB7XG4gICAgICAgIHRoaXMudGhyb3dDb21waWxlRXJyb3IoXCJ1bmNsb3NlZCA8XCIrdGFnTmFtZStcIj5cIik7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHRhZ0NvbnRlbnRzID0gdGhpcy5yZXN0LnNsaWNlKDAsIGVuZC5pbmRleCk7XG4gICAgICBjb25zdCBjb250ZW50c1N0YXJ0SW5kZXggPSB0aGlzLmluZGV4O1xuXG4gICAgICAvLyB0cmltIHRoZSB0YWcgY29udGVudHMuXG4gICAgICAvLyB0aGlzIGlzIGEgY291cnRlc3kgYW5kIGlzIGFsc28gcmVsaWVkIG9uIGJ5IHNvbWUgdW5pdCB0ZXN0cy5cbiAgICAgIHZhciBtID0gdGFnQ29udGVudHMubWF0Y2goL14oWyBcXHRcXHJcXG5dKikoW1xcc1xcU10qPylbIFxcdFxcclxcbl0qJC8pO1xuICAgICAgY29uc3QgdHJpbW1lZENvbnRlbnRzU3RhcnRJbmRleCA9IGNvbnRlbnRzU3RhcnRJbmRleCArIG1bMV0ubGVuZ3RoO1xuICAgICAgY29uc3QgdHJpbW1lZFRhZ0NvbnRlbnRzID0gbVsyXTtcblxuICAgICAgY29uc3QgdGFnID0ge1xuICAgICAgICB0YWdOYW1lOiB0YWdOYW1lLFxuICAgICAgICBhdHRyaWJzOiB0YWdBdHRyaWJzLFxuICAgICAgICBjb250ZW50czogdHJpbW1lZFRhZ0NvbnRlbnRzLFxuICAgICAgICBjb250ZW50c1N0YXJ0SW5kZXg6IHRyaW1tZWRDb250ZW50c1N0YXJ0SW5kZXgsXG4gICAgICAgIHRhZ1N0YXJ0SW5kZXg6IHRhZ1N0YXJ0SW5kZXgsXG4gICAgICAgIGZpbGVDb250ZW50czogdGhpcy5jb250ZW50cyxcbiAgICAgICAgc291cmNlTmFtZTogdGhpcy5zb3VyY2VOYW1lXG4gICAgICB9O1xuXG4gICAgICAvLyBzYXZlIHRoZSB0YWdcbiAgICAgIHRoaXMudGFncy5wdXNoKHRhZyk7XG5cbiAgICAgIC8vIGFkdmFuY2UgYWZ0ZXJ3YXJkcywgc28gdGhhdCBsaW5lIG51bWJlcnMgaW4gZXJyb3JzIGFyZSBjb3JyZWN0XG4gICAgICB0aGlzLmFkdmFuY2UoZW5kLmluZGV4ICsgZW5kWzBdLmxlbmd0aCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEFkdmFuY2UgdGhlIHBhcnNlclxuICAgKiBAcGFyYW0gIHtOdW1iZXJ9IGFtb3VudCBUaGUgYW1vdW50IG9mIGNoYXJhY3RlcnMgdG8gYWR2YW5jZVxuICAgKi9cbiAgYWR2YW5jZShhbW91bnQpIHtcbiAgICB0aGlzLnJlc3QgPSB0aGlzLnJlc3Quc3Vic3RyaW5nKGFtb3VudCk7XG4gICAgdGhpcy5pbmRleCArPSBhbW91bnQ7XG4gIH1cblxuICB0aHJvd0NvbXBpbGVFcnJvcihtc2csIG92ZXJyaWRlSW5kZXgpIHtcbiAgICBjb25zdCBmaW5hbEluZGV4ID0gKHR5cGVvZiBvdmVycmlkZUluZGV4ID09PSAnbnVtYmVyJyA/IG92ZXJyaWRlSW5kZXggOiB0aGlzLmluZGV4KTtcblxuICAgIGNvbnN0IGVyciA9IG5ldyBDb21waWxlRXJyb3IoKTtcbiAgICBlcnIubWVzc2FnZSA9IG1zZyB8fCBcImJhZCBmb3JtYXR0aW5nIGluIHRlbXBsYXRlIGZpbGVcIjtcbiAgICBlcnIuZmlsZSA9IHRoaXMuc291cmNlTmFtZTtcbiAgICBlcnIubGluZSA9IHRoaXMuY29udGVudHMuc3Vic3RyaW5nKDAsIGZpbmFsSW5kZXgpLnNwbGl0KCdcXG4nKS5sZW5ndGg7XG5cbiAgICB0aHJvdyBlcnI7XG4gIH1cblxuICB0aHJvd0JvZHlBdHRyc0Vycm9yKG1zZykge1xuICAgIHRoaXMucGFyc2VFcnJvcihtc2cpO1xuICB9XG5cbiAgZ2V0VGFncygpIHtcbiAgICByZXR1cm4gdGhpcy50YWdzO1xuICB9XG59XG4iLCJleHBvcnQgY2xhc3MgQ29tcGlsZUVycm9yIHt9XG5cbmV4cG9ydCBmdW5jdGlvbiB0aHJvd0NvbXBpbGVFcnJvcih0YWcsIG1lc3NhZ2UsIG92ZXJyaWRlSW5kZXgpIHtcbiAgY29uc3QgZmluYWxJbmRleCA9ICh0eXBlb2Ygb3ZlcnJpZGVJbmRleCA9PT0gJ251bWJlcicgP1xuICAgIG92ZXJyaWRlSW5kZXggOiB0YWcudGFnU3RhcnRJbmRleCk7XG5cbiAgY29uc3QgZXJyID0gbmV3IENvbXBpbGVFcnJvcigpO1xuICBlcnIubWVzc2FnZSA9IG1lc3NhZ2UgfHwgXCJiYWQgZm9ybWF0dGluZyBpbiB0ZW1wbGF0ZSBmaWxlXCI7XG4gIGVyci5maWxlID0gdGFnLnNvdXJjZU5hbWU7XG4gIGVyci5saW5lID0gdGFnLmZpbGVDb250ZW50cy5zdWJzdHJpbmcoMCwgZmluYWxJbmRleCkuc3BsaXQoJ1xcbicpLmxlbmd0aDtcbiAgdGhyb3cgZXJyO1xufVxuIl19
