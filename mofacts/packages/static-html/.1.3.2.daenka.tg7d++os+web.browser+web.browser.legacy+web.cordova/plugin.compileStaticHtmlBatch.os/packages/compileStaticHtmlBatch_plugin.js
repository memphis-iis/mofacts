(function () {

/* Imports */
var ECMAScript = Package.ecmascript.ECMAScript;
var CachingHtmlCompiler = Package['caching-html-compiler'].CachingHtmlCompiler;
var TemplatingTools = Package['templating-tools'].TemplatingTools;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

var require = meteorInstall({"node_modules":{"meteor":{"compileStaticHtmlBatch":{"static-html.js":function module(){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/compileStaticHtmlBatch/static-html.js                                                                     //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
Plugin.registerCompiler({
  extensions: ['html'],
  archMatching: 'web',
  isTemplate: true
}, () => new CachingHtmlCompiler("static-html", TemplatingTools.scanHtmlForTags, compileTagsToStaticHtml)); // Same API as TutorialTools.compileTagsWithSpacebars, but instead of compiling
// with Spacebars, it just returns static HTML

function compileTagsToStaticHtml(tags) {
  var handler = new StaticHtmlTagHandler();
  tags.forEach(tag => {
    handler.addTagToResults(tag);
  });
  return handler.getResults();
}

;

var isEmpty = obj => [Object, Array].includes((obj || {}).constructor) && !Object.entries(obj || {}).length;

class StaticHtmlTagHandler {
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

  addTagToResults(tag) {
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
      if (this.tag.tagName === "body") {
        this.addBodyAttrs(this.tag.attribs); // We may be one of many `<body>` tags.

        this.results.body += this.tag.contents;
      } else {
        this.throwCompileError("Expected <head> or <body> tag", this.tag.tagStartIndex);
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
    TemplatingTools.throwCompileError(this.tag, message, overrideIndex);
  }

}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});

require("/node_modules/meteor/compileStaticHtmlBatch/static-html.js");

/* Exports */
Package._define("compileStaticHtmlBatch");

})();




//# sourceURL=meteor://💻app/packages/compileStaticHtmlBatch_plugin.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvY29tcGlsZVN0YXRpY0h0bWxCYXRjaC9zdGF0aWMtaHRtbC5qcyJdLCJuYW1lcyI6WyJQbHVnaW4iLCJyZWdpc3RlckNvbXBpbGVyIiwiZXh0ZW5zaW9ucyIsImFyY2hNYXRjaGluZyIsImlzVGVtcGxhdGUiLCJDYWNoaW5nSHRtbENvbXBpbGVyIiwiVGVtcGxhdGluZ1Rvb2xzIiwic2Nhbkh0bWxGb3JUYWdzIiwiY29tcGlsZVRhZ3NUb1N0YXRpY0h0bWwiLCJ0YWdzIiwiaGFuZGxlciIsIlN0YXRpY0h0bWxUYWdIYW5kbGVyIiwiZm9yRWFjaCIsInRhZyIsImFkZFRhZ1RvUmVzdWx0cyIsImdldFJlc3VsdHMiLCJpc0VtcHR5Iiwib2JqIiwiT2JqZWN0IiwiQXJyYXkiLCJpbmNsdWRlcyIsImNvbnN0cnVjdG9yIiwiZW50cmllcyIsImxlbmd0aCIsInJlc3VsdHMiLCJoZWFkIiwiYm9keSIsImpzIiwiYm9keUF0dHJzIiwiaGFzQXR0cmlicyIsImF0dHJpYnMiLCJ0YWdOYW1lIiwidGhyb3dDb21waWxlRXJyb3IiLCJjb250ZW50cyIsImFkZEJvZHlBdHRycyIsInRhZ1N0YXJ0SW5kZXgiLCJlIiwic2Nhbm5lciIsIm1lc3NhZ2UiLCJjb250ZW50c1N0YXJ0SW5kZXgiLCJvZmZzZXQiLCJhdHRycyIsImtleXMiLCJhdHRyIiwidmFsIiwiaGFzT3duUHJvcGVydHkiLCJvdmVycmlkZUluZGV4Il0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7OztBQUFBQSxNQUFNLENBQUNDLGdCQUFQLENBQXdCO0FBQ3RCQyxZQUFVLEVBQUUsQ0FBQyxNQUFELENBRFU7QUFFdEJDLGNBQVksRUFBRSxLQUZRO0FBR3RCQyxZQUFVLEVBQUU7QUFIVSxDQUF4QixFQUlHLE1BQU0sSUFBSUMsbUJBQUosQ0FBd0IsYUFBeEIsRUFBdUNDLGVBQWUsQ0FBQ0MsZUFBdkQsRUFBd0VDLHVCQUF4RSxDQUpULEUsQ0FNQTtBQUNBOztB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LEVBQXlCO0FBQ3hDeEMsbUJBQWUsQ0FBQzBCLGlCQUFoQixDQUFrQyxLQUFLbkIsR0FBdkMsRUFBNEN5QixPQUE1QyxFQUFxRFEsYUFBckQ7QUFDRDs7QUFyRXdCLEMiLCJmaWxlIjoiL3BhY2thZ2VzL2NvbXBpbGVTdGF0aWNIdG1sQmF0Y2hfcGx1Z2luLmpzIiwic291cmNlc0NvbnRlbnQiOlsiUGx1Z2luLnJlZ2lzdGVyQ29tcGlsZXIoe1xuICBleHRlbnNpb25zOiBbJ2h0bWwnXSxcbiAgYXJjaE1hdGNoaW5nOiAnd2ViJyxcbiAgaXNUZW1wbGF0ZTogdHJ1ZVxufSwgKCkgPT4gbmV3IENhY2hpbmdIdG1sQ29tcGlsZXIoXCJzdGF0aWMtaHRtbFwiLCBUZW1wbGF0aW5nVG9vbHMuc2Nhbkh0bWxGb3JUYWdzLCBjb21waWxlVGFnc1RvU3RhdGljSHRtbCkpO1xuXG4vLyBTYW1lIEFQSSBhcyBUdXRvcmlhbFRvb2xzLmNvbXBpbGVUYWdzV2l0aFNwYWNlYmFycywgYnV0IGluc3RlYWQgb2YgY29tcGlsaW5nXG4vLyB3aXRoIFNwYWNlYmFycywgaXQganVzdCByZXR1cm5zIHN0YXRpYyBIVE1MXG5mdW5jdGlvbiBjb21waWxlVGFnc1RvU3RhdGljSHRtbCh0YWdzKSB7XG4gIHZhciBoYW5kbGVyID0gbmV3IFN0YXRpY0h0bWxUYWdIYW5kbGVyKCk7XG5cbiAgdGFncy5mb3JFYWNoKCh0YWcpID0+IHtcbiAgICBoYW5kbGVyLmFkZFRhZ1RvUmVzdWx0cyh0YWcpO1xuICB9KTtcblxuICByZXR1cm4gaGFuZGxlci5nZXRSZXN1bHRzKCk7XG59O1xuXG52YXIgaXNFbXB0eSA9IG9iaiA9PiBbT2JqZWN0LCBBcnJheV0uaW5jbHVkZXMoKG9iaiB8fCB7fSkuY29uc3RydWN0b3IpICYmICFPYmplY3QuZW50cmllcygob2JqIHx8IHt9KSkubGVuZ3RoO1xuXG5jbGFzcyBTdGF0aWNIdG1sVGFnSGFuZGxlciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMucmVzdWx0cyA9IHtcbiAgICAgIGhlYWQ6ICcnLFxuICAgICAgYm9keTogJycsXG4gICAgICBqczogJycsXG4gICAgICBib2R5QXR0cnM6IHt9XG4gICAgfTtcbiAgfVxuXG4gIGdldFJlc3VsdHMoKSB7XG4gICAgcmV0dXJuIHRoaXMucmVzdWx0cztcbiAgfVxuXG4gIGFkZFRhZ1RvUmVzdWx0cyh0YWcpIHtcbiAgICB0aGlzLnRhZyA9IHRhZztcblxuICAgIC8vIGRvIHdlIGhhdmUgMSBvciBtb3JlIGF0dHJpYnV0ZXM/XG4gICAgY29uc3QgaGFzQXR0cmlicyA9ICEgaXNFbXB0eSh0aGlzLnRhZy5hdHRyaWJzKTtcblxuICAgIGlmICh0aGlzLnRhZy50YWdOYW1lID09PSBcImhlYWRcIikge1xuICAgICAgaWYgKGhhc0F0dHJpYnMpIHtcbiAgICAgICAgdGhpcy50aHJvd0NvbXBpbGVFcnJvcihcIkF0dHJpYnV0ZXMgb24gPGhlYWQ+IG5vdCBzdXBwb3J0ZWRcIik7XG4gICAgICB9XG5cbiAgICAgIHRoaXMucmVzdWx0cy5oZWFkICs9IHRoaXMudGFnLmNvbnRlbnRzO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuXG4gICAgLy8gPGJvZHk+IG9yIDx0ZW1wbGF0ZT5cblxuICAgIHRyeSB7XG4gICAgICBpZiAodGhpcy50YWcudGFnTmFtZSA9PT0gXCJib2R5XCIpIHtcbiAgICAgICAgdGhpcy5hZGRCb2R5QXR0cnModGhpcy50YWcuYXR0cmlicyk7XG5cbiAgICAgICAgLy8gV2UgbWF5IGJlIG9uZSBvZiBtYW55IGA8Ym9keT5gIHRhZ3MuXG4gICAgICAgIHRoaXMucmVzdWx0cy5ib2R5ICs9IHRoaXMudGFnLmNvbnRlbnRzO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy50aHJvd0NvbXBpbGVFcnJvcihcIkV4cGVjdGVkIDxoZWFkPiBvciA8Ym9keT4gdGFnXCIsIHRoaXMudGFnLnRhZ1N0YXJ0SW5kZXgpO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGlmIChlLnNjYW5uZXIpIHtcbiAgICAgICAgLy8gVGhlIGVycm9yIGNhbWUgZnJvbSBTcGFjZWJhcnNcbiAgICAgICAgdGhpcy50aHJvd0NvbXBpbGVFcnJvcihlLm1lc3NhZ2UsIHRoaXMudGFnLmNvbnRlbnRzU3RhcnRJbmRleCArIGUub2Zmc2V0KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IGU7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgYWRkQm9keUF0dHJzKGF0dHJzKSB7XG4gICAgT2JqZWN0LmtleXMoYXR0cnMpLmZvckVhY2goKGF0dHIpID0+IHtcbiAgICAgIGNvbnN0IHZhbCA9IGF0dHJzW2F0dHJdO1xuXG4gICAgICAvLyBUaGlzIGNoZWNrIGlzIGZvciBjb25mbGljdGluZyBib2R5IGF0dHJpYnV0ZXMgaW4gdGhlIHNhbWUgZmlsZTtcbiAgICAgIC8vIHdlIGNoZWNrIGFjcm9zcyBtdWx0aXBsZSBmaWxlcyBpbiBjYWNoaW5nLWh0bWwtY29tcGlsZXIgdXNpbmcgdGhlXG4gICAgICAvLyBhdHRyaWJ1dGVzIG9uIHJlc3VsdHMuYm9keUF0dHJzXG4gICAgICBpZiAodGhpcy5yZXN1bHRzLmJvZHlBdHRycy5oYXNPd25Qcm9wZXJ0eShhdHRyKSAmJiB0aGlzLnJlc3VsdHMuYm9keUF0dHJzW2F0dHJdICE9PSB2YWwpIHtcbiAgICAgICAgdGhpcy50aHJvd0NvbXBpbGVFcnJvcihcbiAgICAgICAgICBgPGJvZHk+IGRlY2xhcmF0aW9ucyBoYXZlIGNvbmZsaWN0aW5nIHZhbHVlcyBmb3IgdGhlICcke2F0dHJ9JyBhdHRyaWJ1dGUuYCk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMucmVzdWx0cy5ib2R5QXR0cnNbYXR0cl0gPSB2YWw7XG4gICAgfSk7XG4gIH1cblxuICB0aHJvd0NvbXBpbGVFcnJvcihtZXNzYWdlLCBvdmVycmlkZUluZGV4KSB7XG4gICAgVGVtcGxhdGluZ1Rvb2xzLnRocm93Q29tcGlsZUVycm9yKHRoaXMudGFnLCBtZXNzYWdlLCBvdmVycmlkZUluZGV4KTtcbiAgfVxufVxuXG4iXX0=
