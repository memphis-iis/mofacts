(function () {

/* Imports */
var meteorJsMinify = Package['minifier-js'].meteorJsMinify;
var Babel = Package['babel-compiler'].Babel;
var BabelCompiler = Package['babel-compiler'].BabelCompiler;
var ECMAScript = Package.ecmascript.ECMAScript;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

var require = meteorInstall({"node_modules":{"meteor":{"minifyStdJS":{"plugin":{"minify-js.js":function(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/minifyStdJS/plugin/minify-js.js                                                                       //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
let extractModuleSizesTree;
module.link("./stats.js", {
  extractModuleSizesTree(v) {
    extractModuleSizesTree = v;
  }

}, 0);
Plugin.registerMinifier({
  extensions: ['js'],
  archMatching: 'web'
}, function () {
  var minifier = new MeteorBabelMinifier();
  return minifier;
});

function MeteorBabelMinifier() {}

;

MeteorBabelMinifier.prototype.processFilesForBundle = function (files, options) {
  var mode = options.minifyMode; // don't minify anything for development

  if (mode === 'development') {
    files.forEach(function (file) {
      file.addJavaScript({
        data: file.getContentsAsBuffer(),
        sourceMap: file.getSourceMap(),
        path: file.getPathInBundle()
      });
    });
    return;
  }

  function maybeThrowMinifyErrorBySourceFile(error, file) {
    var minifierErrorRegex = /^(.*?)\s?\((\d+):(\d+)\)$/;
    var parseError = minifierErrorRegex.exec(error.message);

    if (!parseError) {
      // If we were unable to parse it, just let the usual error handling work.
      return;
    }

    var lineErrorMessage = parseError[1];
    var lineErrorLineNumber = parseError[2];
    var parseErrorContentIndex = lineErrorLineNumber - 1; // Unlikely, since we have a multi-line fixed header in this file.

    if (parseErrorContentIndex < 0) {
      return;
    }
    /*
     What we're parsing looks like this:
     /////////////////////////////////////////
    //                                     //
    // path/to/file.js                     //
    //                                     //
    /////////////////////////////////////////
                                           // 1
       var illegalECMAScript = true;       // 2
                                           // 3
    /////////////////////////////////////////
     Btw, the above code is intentionally not newer ECMAScript so
    we don't break ourselves.
     */


    var contents = file.getContentsAsString().split(/\n/);
    var lineContent = contents[parseErrorContentIndex]; // Try to grab the line number, which sometimes doesn't exist on
    // line, abnormally-long lines in a larger block.

    var lineSrcLineParts = /^(.*?)(?:\s*\/\/ (\d+))?$/.exec(lineContent); // The line didn't match at all?  Let's just not try.

    if (!lineSrcLineParts) {
      return;
    }

    var lineSrcLineContent = lineSrcLineParts[1];
    var lineSrcLineNumber = lineSrcLineParts[2]; // Count backward from the failed line to find the filename.

    for (var c = parseErrorContentIndex - 1; c >= 0; c--) {
      var sourceLine = contents[c]; // If the line is a boatload of slashes, we're in the right place.

      if (/^\/\/\/{6,}$/.test(sourceLine)) {
        // If 4 lines back is the same exact line, we've found the framing.
        if (contents[c - 4] === sourceLine) {
          // So in that case, 2 lines back is the file path.
          var parseErrorPath = contents[c - 2].substring(3).replace(/\s+\/\//, "");
          var minError = new Error("Babili minification error " + "within " + file.getPathInBundle() + ":\n" + parseErrorPath + (lineSrcLineNumber ? ", line " + lineSrcLineNumber : "") + "\n" + "\n" + lineErrorMessage + ":\n" + "\n" + lineSrcLineContent + "\n");
          throw minError;
        }
      }
    }
  }

  const toBeAdded = {
    data: "",
    stats: Object.create(null)
  };
  files.forEach(file => {
    // Don't reminify *.min.js.
    if (/\.min\.js$/.test(file.getPathInBundle())) {
      toBeAdded.data += file.getContentsAsString();
    } else {
      var minified;

      try {
        minified = meteorJsMinify(file.getContentsAsString());

        if (!(minified && typeof minified.code === "string")) {
          throw new Error();
        }
      } catch (err) {
        var filePath = file.getPathInBundle();
        maybeThrowMinifyErrorBySourceFile(err, file);
        err.message += " while minifying " + filePath;
        throw err;
      }

      const tree = extractModuleSizesTree(minified.code);

      if (tree) {
        toBeAdded.stats[file.getPathInBundle()] = [Buffer.byteLength(minified.code), tree];
      } else {
        toBeAdded.stats[file.getPathInBundle()] = Buffer.byteLength(minified.code);
      }

      toBeAdded.data += minified.code;
    }

    toBeAdded.data += '\n\n';
    Plugin.nudge();
  });

  if (files.length) {
    files[0].addJavaScript(toBeAdded);
  }
};
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"stats.js":function(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/minifyStdJS/plugin/stats.js                                                                           //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
module.export({
  extractModuleSizesTree: () => extractModuleSizesTree
});
let Visitor;
module.link("reify/lib/visitor.js", {
  default(v) {
    Visitor = v;
  }

}, 0);
let findPossibleIndexes;
module.link("reify/lib/utils.js", {
  findPossibleIndexes(v) {
    findPossibleIndexes = v;
  }

}, 1);
// This RegExp will be used to scan the source for calls to meteorInstall,
// taking into consideration that the function name may have been mangled
// to something other than "meteorInstall" by the minifier.
const meteorInstallRegExp = new RegExp([// If meteorInstall is called by its unminified name, then that's what
// we should be looking for in the AST.
/\b(meteorInstall)\(\{/, // If the meteorInstall function name has been minified, we can figure
// out its mangled name by examining the import assingment.
/\b(\w+)=Package\.modules\.meteorInstall\b/, /\b(\w+)=Package\["modules-runtime"\].meteorInstall\b/, // Sometimes uglify-es will inline (0,Package.modules.meteorInstall) as
// a call expression.
/\(0,Package\.modules\.(meteorInstall)\)\(/, /\(0,Package\["modules-runtime"\]\.(meteorInstall)\)\(/].map(exp => exp.source).join("|"));

function extractModuleSizesTree(source) {
  const match = meteorInstallRegExp.exec(source);

  if (match) {
    const ast = Babel.parse(source);
    let meteorInstallName = "meteorInstall"; // The minifier may have renamed meteorInstall to something shorter.

    match.some((name, i) => i > 0 && (meteorInstallName = name));
    meteorInstallVisitor.visit(ast, meteorInstallName, source);
    return meteorInstallVisitor.tree;
  }
}

const meteorInstallVisitor = new class extends Visitor {
  reset(root, meteorInstallName, source) {
    this.name = meteorInstallName;
    this.source = source;
    this.tree = Object.create(null); // Optimization to abandon entire subtrees of the AST that contain
    // nothing like the meteorInstall identifier we're looking for.

    this.possibleIndexes = findPossibleIndexes(source, [meteorInstallName]);
  }

  visitCallExpression(path) {
    const node = path.getValue();

    if (hasIdWithName(node.callee, this.name)) {
      const source = this.source;

      function walk(tree, expr) {
        if (expr.type !== "ObjectExpression") {
          return Buffer.byteLength(source.slice(expr.start, expr.end));
        }

        tree = tree || Object.create(null);
        expr.properties.forEach(prop => {
          const keyName = getKeyName(prop.key);

          if (typeof keyName === "string") {
            tree[keyName] = walk(tree[keyName], prop.value);
          }
        });
        return tree;
      }

      walk(this.tree, node.arguments[0]);
    } else {
      this.visitChildren(path);
    }
  }

}();

function hasIdWithName(node, name) {
  switch (node && node.type) {
    case "SequenceExpression":
      const last = node.expressions[node.expressions.length - 1];
      return hasIdWithName(last, name);

    case "MemberExpression":
      return hasIdWithName(node.property, name);

    case "Identifier":
      return node.name === name;

    default:
      return false;
  }
}

function getKeyName(key) {
  if (key.type === "Identifier") {
    return key.name;
  }

  if (key.type === "StringLiteral" || key.type === "Literal") {
    return key.value;
  }

  return null;
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"utils.js":function(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/minifyStdJS/plugin/utils.js                                                                           //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
"use strict";

module.export({
  isObject: () => isObject,
  isNodeLike: () => isNodeLike
});
const codeOfA = "A".charCodeAt(0);
const codeOfZ = "Z".charCodeAt(0);

function isObject(value) {
  return typeof value === "object" && value !== null;
}

function isNodeLike(value) {
  return isObject(value) && !Array.isArray(value) && isCapitalized(value.type);
}

function isCapitalized(string) {
  if (typeof string !== "string") {
    return false;
  }

  const code = string.charCodeAt(0);
  return code >= codeOfA && code <= codeOfZ;
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});

require("/node_modules/meteor/minifyStdJS/plugin/minify-js.js");
require("/node_modules/meteor/minifyStdJS/plugin/stats.js");
require("/node_modules/meteor/minifyStdJS/plugin/utils.js");

/* Exports */
Package._define("minifyStdJS");

})();




//# sourceURL=meteor://💻app/packages/minifyStdJS_plugin.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvbWluaWZ5U3RkSlMvcGx1Z2luL21pbmlmeS1qcy5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvbWluaWZ5U3RkSlMvcGx1Z2luL3N0YXRzLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9taW5pZnlTdGRKUy9wbHVnaW4vdXRpbHMuanMiXSwibmFtZXMiOlsiZXh0cmFjdE1vZHVsZVNpemVzVHJlZSIsIm1vZHVsZSIsImxpbmsiLCJ2IiwiUGx1Z2luIiwicmVnaXN0ZXJNaW5pZmllciIsImV4dGVuc2lvbnMiLCJhcmNoTWF0Y2hpbmciLCJtaW5pZmllciIsIk1ldGVvckJhYmVsTWluaWZpZXIiLCJwcm90b3R5cGUiLCJwcm9jZXNzRmlsZXNGb3JCdW5kbGUiLCJmaWxlcyIsIm9wdGlvbnMiLCJtb2RlIiwibWluaWZ5TW9kZSIsImZvckVhY2giLCJmaWxlIiwiYWRkSmF2YVNjcmlwdCIsImRhdGEiLCJnZXRDb250ZW50c0FzQnVmZmVyIiwic291cmNlTWFwIiwiZ2V0U291cmNlTWFwIiwicGF0aCIsImdldFBhdGhJbkJ1bmRsZSIsIm1heWJlVGhyb3dNaW5pZnlFcnJvckJ5U291cmNlRmlsZSIsImVycm9yIiwibWluaWZpZXJFcnJvclJlZ2V4IiwicGFyc2VFcnJvciIsImV4ZWMiLCJtZXNzYWdlIiwibGluZUVycm9yTWVzc2FnZSIsImxpbmVFcnJvckxpbmVOdW1iZXIiLCJwYXJzZUVycm9yQ29udGVudEluZGV4IiwiY29udGVudHMiLCJnZXRDb250ZW50c0FzU3RyaW5nIiwic3BsaXQiLCJsaW5lQ29udGVudCIsImxpbmVTcmNMaW5lUGFydHMiLCJsaW5lU3JjTGluZUNvbnRlbnQiLCJsaW5lU3JjTGluZU51bWJlciIsImMiLCJzb3VyY2VMaW5lIiwidGVzdCIsInBhcnNlRXJyb3JQYXRoIiwic3Vic3RyaW5nIiwicmVwbGFjZSIsIm1pbkVycm9yIiwiRXJyb3IiLCJ0b0JlQWRkZWQiLCJzdGF0cyIsIk9iamVjdCIsImNyZWF0ZSIsIm1pbmlmaWVkIiwibWV0ZW9ySnNNaW5pZnkiLCJjb2RlIiwiZXJyIiwiZmlsZVBhdGgiLCJ0cmVlIiwiQnVmZmVyIiwiYnl0ZUxlbmd0aCIsIm51ZGdlIiwibGVuZ3RoIiwiZXhwb3J0IiwiVmlzaXRvciIsImRlZmF1bHQiLCJmaW5kUG9zc2libGVJbmRleGVzIiwibWV0ZW9ySW5zdGFsbFJlZ0V4cCIsIlJlZ0V4cCIsIm1hcCIsImV4cCIsInNvdXJjZSIsImpvaW4iLCJtYXRjaCIsImFzdCIsIkJhYmVsIiwicGFyc2UiLCJtZXRlb3JJbnN0YWxsTmFtZSIsInNvbWUiLCJuYW1lIiwiaSIsIm1ldGVvckluc3RhbGxWaXNpdG9yIiwidmlzaXQiLCJyZXNldCIsInJvb3QiLCJwb3NzaWJsZUluZGV4ZXMiLCJ2aXNpdENhbGxFeHByZXNzaW9uIiwibm9kZSIsImdldFZhbHVlIiwiaGFzSWRXaXRoTmFtZSIsImNhbGxlZSIsIndhbGsiLCJleHByIiwidHlwZSIsInNsaWNlIiwic3RhcnQiLCJlbmQiLCJwcm9wZXJ0aWVzIiwicHJvcCIsImtleU5hbWUiLCJnZXRLZXlOYW1lIiwia2V5IiwidmFsdWUiLCJhcmd1bWVudHMiLCJ2aXNpdENoaWxkcmVuIiwibGFzdCIsImV4cHJlc3Npb25zIiwicHJvcGVydHkiLCJpc09iamVjdCIsImlzTm9kZUxpa2UiLCJjb2RlT2ZBIiwiY2hhckNvZGVBdCIsImNvZGVPZloiLCJBcnJheSIsImlzQXJyYXkiLCJpc0NhcGl0YWxpemVkIiwic3RyaW5nIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxJQUFJQSxzQkFBSjtBQUEyQkMsTUFBTSxDQUFDQyxJQUFQLENBQVksWUFBWixFQUF5QjtBQUFDRix3QkFBc0IsQ0FBQ0csQ0FBRCxFQUFHO0FBQUNILDBCQUFzQixHQUFDRyxDQUF2QjtBQUF5Qjs7QUFBcEQsQ0FBekIsRUFBK0UsQ0FBL0U7QUFFM0JDLE1BQU0sQ0FBQ0MsZ0JBQVAsQ0FBd0I7QUFDdEJDLFlB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O0FBQzlCLFNBQU8sT0FBT0EsS0FBUCxLQUFpQixRQUFqQixJQUE2QkEsS0FBSyxLQUFLLElBQTlDO0FBQ0Q7O0FBTU0sU0FBU08sVUFBVCxDQUFvQlAsS0FBcEIsRUFBMkI7QUFDaEMsU0FBT00sUUFBUSxDQUFDTixLQUFELENBQVIsSUFDTCxDQUFFVyxLQUFLLENBQUNDLE9BQU4sQ0FBY1osS0FBZCxDQURHLElBRUxhLGFBQWEsQ0FBQ2IsS0FBSyxDQUFDVCxJQUFQLENBRmY7QUFHRDs7QUFFRCxTQUFTc0IsYUFBVCxDQUF1QkMsTUFBdkIsRUFBK0I7QUFDN0IsTUFBSSxPQUFPQSxNQUFQLEtBQWtCLFFBQXRCLEVBQWdDO0FBQzlCLFdBQU8sS0FBUDtBQUNEOztBQUNELFFBQU03RCxJQUFJLEdBQUc2RCxNQUFNLENBQUNMLFVBQVAsQ0FBa0IsQ0FBbEIsQ0FBYjtBQUNBLFNBQU94RCxJQUFJLElBQUl1RCxPQUFSLElBQW1CdkQsSUFBSSxJQUFJeUQsT0FBbEM7QUFDRCxDIiwiZmlsZSI6Ii9wYWNrYWdlcy9taW5pZnlTdGRKU19wbHVnaW4uanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBleHRyYWN0TW9kdWxlU2l6ZXNUcmVlIH0gZnJvbSBcIi4vc3RhdHMuanNcIjtcblxuUGx1Z2luLnJlZ2lzdGVyTWluaWZpZXIoe1xuICBleHRlbnNpb25zOiBbJ2pzJ10sXG4gIGFyY2hNYXRjaGluZzogJ3dlYidcbn0sIGZ1bmN0aW9uICgpIHtcbiAgdmFyIG1pbmlmaWVyID0gbmV3IE1ldGVvckJhYmVsTWluaWZpZXIoKTtcbiAgcmV0dXJuIG1pbmlmaWVyO1xufSk7XG5cbmZ1bmN0aW9uIE1ldGVvckJhYmVsTWluaWZpZXIgKCkge307XG5cbk1ldGVvckJhYmVsTWluaWZpZXIucHJvdG90eXBlLnByb2Nlc3NGaWxlc0ZvckJ1bmRsZSA9IGZ1bmN0aW9uKGZpbGVzLCBvcHRpb25zKSB7XG4gIHZhciBtb2RlID0gb3B0aW9ucy5taW5pZnlNb2RlO1xuXG4gIC8vIGRvbid0IG1pbmlmeSBhbnl0aGluZyBmb3IgZGV2ZWxvcG1lbnRcbiAgaWYgKG1vZGUgPT09ICdkZXZlbG9wbWVudCcpIHtcbiAgICBmaWxlcy5mb3JFYWNoKGZ1bmN0aW9uIChmaWxlKSB7XG4gICAgICBmaWxlLmFkZEphdmFTY3JpcHQoe1xuICAgICAgICBkYXRhOiBmaWxlLmdldENvbnRlbnRzQXNCdWZmZXIoKSxcbiAgICAgICAgc291cmNlTWFwOiBmaWxlLmdldFNvdXJjZU1hcCgpLFxuICAgICAgICBwYXRoOiBmaWxlLmdldFBhdGhJbkJ1bmRsZSgpLFxuICAgICAgfSk7XG4gICAgfSk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgZnVuY3Rpb24gbWF5YmVUaHJvd01pbmlmeUVycm9yQnlTb3VyY2VGaWxlKGVycm9yLCBmaWxlKSB7XG4gICAgdmFyIG1pbmlmaWVyRXJyb3JSZWdleCA9IC9eKC4qPylcXHM/XFwoKFxcZCspOihcXGQrKVxcKSQvO1xuICAgIHZhciBwYXJzZUVycm9yID0gbWluaWZpZXJFcnJvclJlZ2V4LmV4ZWMoZXJyb3IubWVzc2FnZSk7XG5cbiAgICBpZiAoIXBhcnNlRXJyb3IpIHtcbiAgICAgIC8vIElmIHdlIHdlcmUgdW5hYmxlIHRvIHBhcnNlIGl0LCBqdXN0IGxldCB0aGUgdXN1YWwgZXJyb3IgaGFuZGxpbmcgd29yay5cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2YXIgbGluZUVycm9yTWVzc2FnZSA9IHBhcnNlRXJyb3JbMV07XG4gICAgdmFyIGxpbmVFcnJvckxpbmVOdW1iZXIgPSBwYXJzZUVycm9yWzJdO1xuXG4gICAgdmFyIHBhcnNlRXJyb3JDb250ZW50SW5kZXggPSBsaW5lRXJyb3JMaW5lTnVtYmVyIC0gMTtcblxuICAgIC8vIFVubGlrZWx5LCBzaW5jZSB3ZSBoYXZlIGEgbXVsdGktbGluZSBmaXhlZCBoZWFkZXIgaW4gdGhpcyBmaWxlLlxuICAgIGlmIChwYXJzZUVycm9yQ29udGVudEluZGV4IDwgMCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8qXG5cbiAgICBXaGF0IHdlJ3JlIHBhcnNpbmcgbG9va3MgbGlrZSB0aGlzOlxuXG4gICAgLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cbiAgICAvLyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvL1xuICAgIC8vIHBhdGgvdG8vZmlsZS5qcyAgICAgICAgICAgICAgICAgICAgIC8vXG4gICAgLy8gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy9cbiAgICAvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIDFcbiAgICAgICB2YXIgaWxsZWdhbEVDTUFTY3JpcHQgPSB0cnVlOyAgICAgICAvLyAyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gM1xuICAgIC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG5cbiAgICBCdHcsIHRoZSBhYm92ZSBjb2RlIGlzIGludGVudGlvbmFsbHkgbm90IG5ld2VyIEVDTUFTY3JpcHQgc29cbiAgICB3ZSBkb24ndCBicmVhayBvdXJzZWx2ZXMuXG5cbiAgICAqL1xuXG4gICAgdmFyIGNvbnRlbnRzID0gZmlsZS5nZXRDb250ZW50c0FzU3RyaW5nKCkuc3BsaXQoL1xcbi8pO1xuICAgIHZhciBsaW5lQ29udGVudCA9IGNvbnRlbnRzW3BhcnNlRXJyb3JDb250ZW50SW5kZXhdO1xuXG4gICAgLy8gVHJ5IHRvIGdyYWIgdGhlIGxpbmUgbnVtYmVyLCB3aGljaCBzb21ldGltZXMgZG9lc24ndCBleGlzdCBvblxuICAgIC8vIGxpbmUsIGFibm9ybWFsbHktbG9uZyBsaW5lcyBpbiBhIGxhcmdlciBibG9jay5cbiAgICB2YXIgbGluZVNyY0xpbmVQYXJ0cyA9IC9eKC4qPykoPzpcXHMqXFwvXFwvIChcXGQrKSk/JC8uZXhlYyhsaW5lQ29udGVudCk7XG5cbiAgICAvLyBUaGUgbGluZSBkaWRuJ3QgbWF0Y2ggYXQgYWxsPyAgTGV0J3MganVzdCBub3QgdHJ5LlxuICAgIGlmICghbGluZVNyY0xpbmVQYXJ0cykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBsaW5lU3JjTGluZUNvbnRlbnQgPSBsaW5lU3JjTGluZVBhcnRzWzFdO1xuICAgIHZhciBsaW5lU3JjTGluZU51bWJlciA9IGxpbmVTcmNMaW5lUGFydHNbMl07XG5cbiAgICAvLyBDb3VudCBiYWNrd2FyZCBmcm9tIHRoZSBmYWlsZWQgbGluZSB0byBmaW5kIHRoZSBmaWxlbmFtZS5cbiAgICBmb3IgKHZhciBjID0gcGFyc2VFcnJvckNvbnRlbnRJbmRleCAtIDE7IGMgPj0gMDsgYy0tKSB7XG4gICAgICB2YXIgc291cmNlTGluZSA9IGNvbnRlbnRzW2NdO1xuXG4gICAgICAvLyBJZiB0aGUgbGluZSBpcyBhIGJvYXRsb2FkIG9mIHNsYXNoZXMsIHdlJ3JlIGluIHRoZSByaWdodCBwbGFjZS5cbiAgICAgIGlmICgvXlxcL1xcL1xcL3s2LH0kLy50ZXN0KHNvdXJjZUxpbmUpKSB7XG5cbiAgICAgICAgLy8gSWYgNCBsaW5lcyBiYWNrIGlzIHRoZSBzYW1lIGV4YWN0IGxpbmUsIHdlJ3ZlIGZvdW5kIHRoZSBmcmFtaW5nLlxuICAgICAgICBpZiAoY29udGVudHNbYyAtIDRdID09PSBzb3VyY2VMaW5lKSB7XG5cbiAgICAgICAgICAvLyBTbyBpbiB0aGF0IGNhc2UsIDIgbGluZXMgYmFjayBpcyB0aGUgZmlsZSBwYXRoLlxuICAgICAgICAgIHZhciBwYXJzZUVycm9yUGF0aCA9IGNvbnRlbnRzW2MgLSAyXVxuICAgICAgICAgICAgLnN1YnN0cmluZygzKVxuICAgICAgICAgICAgLnJlcGxhY2UoL1xccytcXC9cXC8vLCBcIlwiKTtcblxuICAgICAgICAgIHZhciBtaW5FcnJvciA9IG5ldyBFcnJvcihcbiAgICAgICAgICAgIFwiQmFiaWxpIG1pbmlmaWNhdGlvbiBlcnJvciBcIiArXG4gICAgICAgICAgICBcIndpdGhpbiBcIiArIGZpbGUuZ2V0UGF0aEluQnVuZGxlKCkgKyBcIjpcXG5cIiArXG4gICAgICAgICAgICBwYXJzZUVycm9yUGF0aCArXG4gICAgICAgICAgICAobGluZVNyY0xpbmVOdW1iZXIgPyBcIiwgbGluZSBcIiArIGxpbmVTcmNMaW5lTnVtYmVyIDogXCJcIikgKyBcIlxcblwiICtcbiAgICAgICAgICAgIFwiXFxuXCIgK1xuICAgICAgICAgICAgbGluZUVycm9yTWVzc2FnZSArIFwiOlxcblwiICtcbiAgICAgICAgICAgIFwiXFxuXCIgK1xuICAgICAgICAgICAgbGluZVNyY0xpbmVDb250ZW50ICsgXCJcXG5cIlxuICAgICAgICAgICk7XG5cbiAgICAgICAgICB0aHJvdyBtaW5FcnJvcjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGNvbnN0IHRvQmVBZGRlZCA9IHtcbiAgICBkYXRhOiBcIlwiLFxuICAgIHN0YXRzOiBPYmplY3QuY3JlYXRlKG51bGwpXG4gIH07XG5cbiAgZmlsZXMuZm9yRWFjaChmaWxlID0+IHtcbiAgICAvLyBEb24ndCByZW1pbmlmeSAqLm1pbi5qcy5cbiAgICBpZiAoL1xcLm1pblxcLmpzJC8udGVzdChmaWxlLmdldFBhdGhJbkJ1bmRsZSgpKSkge1xuICAgICAgdG9CZUFkZGVkLmRhdGEgKz0gZmlsZS5nZXRDb250ZW50c0FzU3RyaW5nKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBtaW5pZmllZDtcblxuICAgICAgdHJ5IHtcbiAgICAgICAgbWluaWZpZWQgPSBtZXRlb3JKc01pbmlmeShmaWxlLmdldENvbnRlbnRzQXNTdHJpbmcoKSk7XG5cbiAgICAgICAgaWYgKCEobWluaWZpZWQgJiYgdHlwZW9mIG1pbmlmaWVkLmNvZGUgPT09IFwic3RyaW5nXCIpKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCk7XG4gICAgICAgIH1cblxuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIHZhciBmaWxlUGF0aCA9IGZpbGUuZ2V0UGF0aEluQnVuZGxlKCk7XG5cbiAgICAgICAgbWF5YmVUaHJvd01pbmlmeUVycm9yQnlTb3VyY2VGaWxlKGVyciwgZmlsZSk7XG5cbiAgICAgICAgZXJyLm1lc3NhZ2UgKz0gXCIgd2hpbGUgbWluaWZ5aW5nIFwiICsgZmlsZVBhdGg7XG4gICAgICAgIHRocm93IGVycjtcbiAgICAgIH1cblxuICAgICAgY29uc3QgdHJlZSA9IGV4dHJhY3RNb2R1bGVTaXplc1RyZWUobWluaWZpZWQuY29kZSk7XG4gICAgICBpZiAodHJlZSkge1xuICAgICAgICB0b0JlQWRkZWQuc3RhdHNbZmlsZS5nZXRQYXRoSW5CdW5kbGUoKV0gPVxuICAgICAgICAgIFtCdWZmZXIuYnl0ZUxlbmd0aChtaW5pZmllZC5jb2RlKSwgdHJlZV07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0b0JlQWRkZWQuc3RhdHNbZmlsZS5nZXRQYXRoSW5CdW5kbGUoKV0gPVxuICAgICAgICAgIEJ1ZmZlci5ieXRlTGVuZ3RoKG1pbmlmaWVkLmNvZGUpO1xuICAgICAgfVxuXG4gICAgICB0b0JlQWRkZWQuZGF0YSArPSBtaW5pZmllZC5jb2RlO1xuICAgIH1cblxuICAgIHRvQmVBZGRlZC5kYXRhICs9ICdcXG5cXG4nO1xuXG4gICAgUGx1Z2luLm51ZGdlKCk7XG4gIH0pO1xuXG4gIGlmIChmaWxlcy5sZW5ndGgpIHtcbiAgICBmaWxlc1swXS5hZGRKYXZhU2NyaXB0KHRvQmVBZGRlZCk7XG4gIH1cbn07XG4iLCJpbXBvcnQgVmlzaXRvciBmcm9tIFwicmVpZnkvbGliL3Zpc2l0b3IuanNcIjtcbmltcG9ydCB7IGZpbmRQb3NzaWJsZUluZGV4ZXMgfSBmcm9tIFwicmVpZnkvbGliL3V0aWxzLmpzXCI7XG5cbi8vIFRoaXMgUmVnRXhwIHdpbGwgYmUgdXNlZCB0byBzY2FuIHRoZSBzb3VyY2UgZm9yIGNhbGxzIHRvIG1ldGVvckluc3RhbGwsXG4vLyB0YWtpbmcgaW50byBjb25zaWRlcmF0aW9uIHRoYXQgdGhlIGZ1bmN0aW9uIG5hbWUgbWF5IGhhdmUgYmVlbiBtYW5nbGVkXG4vLyB0byBzb21ldGhpbmcgb3RoZXIgdGhhbiBcIm1ldGVvckluc3RhbGxcIiBieSB0aGUgbWluaWZpZXIuXG5jb25zdCBtZXRlb3JJbnN0YWxsUmVnRXhwID0gbmV3IFJlZ0V4cChbXG4gIC8vIElmIG1ldGVvckluc3RhbGwgaXMgY2FsbGVkIGJ5IGl0cyB1bm1pbmlmaWVkIG5hbWUsIHRoZW4gdGhhdCdzIHdoYXRcbiAgLy8gd2Ugc2hvdWxkIGJlIGxvb2tpbmcgZm9yIGluIHRoZSBBU1QuXG4gIC9cXGIobWV0ZW9ySW5zdGFsbClcXChcXHsvLFxuICAvLyBJZiB0aGUgbWV0ZW9ySW5zdGFsbCBmdW5jdGlvbiBuYW1lIGhhcyBiZWVuIG1pbmlmaWVkLCB3ZSBjYW4gZmlndXJlXG4gIC8vIG91dCBpdHMgbWFuZ2xlZCBuYW1lIGJ5IGV4YW1pbmluZyB0aGUgaW1wb3J0IGFzc2luZ21lbnQuXG4gIC9cXGIoXFx3Kyk9UGFja2FnZVxcLm1vZHVsZXNcXC5tZXRlb3JJbnN0YWxsXFxiLyxcbiAgL1xcYihcXHcrKT1QYWNrYWdlXFxbXCJtb2R1bGVzLXJ1bnRpbWVcIlxcXS5tZXRlb3JJbnN0YWxsXFxiLyxcbiAgLy8gU29tZXRpbWVzIHVnbGlmeS1lcyB3aWxsIGlubGluZSAoMCxQYWNrYWdlLm1vZHVsZXMubWV0ZW9ySW5zdGFsbCkgYXNcbiAgLy8gYSBjYWxsIGV4cHJlc3Npb24uXG4gIC9cXCgwLFBhY2thZ2VcXC5tb2R1bGVzXFwuKG1ldGVvckluc3RhbGwpXFwpXFwoLyxcbiAgL1xcKDAsUGFja2FnZVxcW1wibW9kdWxlcy1ydW50aW1lXCJcXF1cXC4obWV0ZW9ySW5zdGFsbClcXClcXCgvLFxuXS5tYXAoZXhwID0+IGV4cC5zb3VyY2UpLmpvaW4oXCJ8XCIpKTtcblxuZXhwb3J0IGZ1bmN0aW9uIGV4dHJhY3RNb2R1bGVTaXplc1RyZWUoc291cmNlKSB7XG4gIGNvbnN0IG1hdGNoID0gbWV0ZW9ySW5zdGFsbFJlZ0V4cC5leGVjKHNvdXJjZSk7XG4gIGlmIChtYXRjaCkge1xuICAgIGNvbnN0IGFzdCA9IEJhYmVsLnBhcnNlKHNvdXJjZSk7XG4gICAgbGV0IG1ldGVvckluc3RhbGxOYW1lID0gXCJtZXRlb3JJbnN0YWxsXCI7XG4gICAgLy8gVGhlIG1pbmlmaWVyIG1heSBoYXZlIHJlbmFtZWQgbWV0ZW9ySW5zdGFsbCB0byBzb21ldGhpbmcgc2hvcnRlci5cbiAgICBtYXRjaC5zb21lKChuYW1lLCBpKSA9PiAoaSA+IDAgJiYgKG1ldGVvckluc3RhbGxOYW1lID0gbmFtZSkpKTtcbiAgICBtZXRlb3JJbnN0YWxsVmlzaXRvci52aXNpdChhc3QsIG1ldGVvckluc3RhbGxOYW1lLCBzb3VyY2UpO1xuICAgIHJldHVybiBtZXRlb3JJbnN0YWxsVmlzaXRvci50cmVlO1xuICB9XG59XG5cbmNvbnN0IG1ldGVvckluc3RhbGxWaXNpdG9yID0gbmV3IChjbGFzcyBleHRlbmRzIFZpc2l0b3Ige1xuICByZXNldChyb290LCBtZXRlb3JJbnN0YWxsTmFtZSwgc291cmNlKSB7XG4gICAgdGhpcy5uYW1lID0gbWV0ZW9ySW5zdGFsbE5hbWU7XG4gICAgdGhpcy5zb3VyY2UgPSBzb3VyY2U7XG4gICAgdGhpcy50cmVlID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgICAvLyBPcHRpbWl6YXRpb24gdG8gYWJhbmRvbiBlbnRpcmUgc3VidHJlZXMgb2YgdGhlIEFTVCB0aGF0IGNvbnRhaW5cbiAgICAvLyBub3RoaW5nIGxpa2UgdGhlIG1ldGVvckluc3RhbGwgaWRlbnRpZmllciB3ZSdyZSBsb29raW5nIGZvci5cbiAgICB0aGlzLnBvc3NpYmxlSW5kZXhlcyA9IGZpbmRQb3NzaWJsZUluZGV4ZXMoc291cmNlLCBbXG4gICAgICBtZXRlb3JJbnN0YWxsTmFtZSxcbiAgICBdKTtcbiAgfVxuXG4gIHZpc2l0Q2FsbEV4cHJlc3Npb24ocGF0aCkge1xuICAgIGNvbnN0IG5vZGUgPSBwYXRoLmdldFZhbHVlKCk7XG5cbiAgICBpZiAoaGFzSWRXaXRoTmFtZShub2RlLmNhbGxlZSwgdGhpcy5uYW1lKSkge1xuICAgICAgY29uc3Qgc291cmNlID0gdGhpcy5zb3VyY2U7XG5cbiAgICAgIGZ1bmN0aW9uIHdhbGsodHJlZSwgZXhwcikge1xuICAgICAgICBpZiAoZXhwci50eXBlICE9PSBcIk9iamVjdEV4cHJlc3Npb25cIikge1xuICAgICAgICAgIHJldHVybiBCdWZmZXIuYnl0ZUxlbmd0aChzb3VyY2Uuc2xpY2UoZXhwci5zdGFydCwgZXhwci5lbmQpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRyZWUgPSB0cmVlIHx8IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cbiAgICAgICAgZXhwci5wcm9wZXJ0aWVzLmZvckVhY2gocHJvcCA9PiB7XG4gICAgICAgICAgY29uc3Qga2V5TmFtZSA9IGdldEtleU5hbWUocHJvcC5rZXkpO1xuICAgICAgICAgIGlmICh0eXBlb2Yga2V5TmFtZSA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgICAgICAgdHJlZVtrZXlOYW1lXSA9IHdhbGsodHJlZVtrZXlOYW1lXSwgcHJvcC52YWx1ZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gdHJlZTtcbiAgICAgIH1cblxuICAgICAgd2Fsayh0aGlzLnRyZWUsIG5vZGUuYXJndW1lbnRzWzBdKTtcblxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnZpc2l0Q2hpbGRyZW4ocGF0aCk7XG4gICAgfVxuICB9XG59KTtcblxuZnVuY3Rpb24gaGFzSWRXaXRoTmFtZShub2RlLCBuYW1lKSB7XG4gIHN3aXRjaCAobm9kZSAmJiBub2RlLnR5cGUpIHtcbiAgY2FzZSBcIlNlcXVlbmNlRXhwcmVzc2lvblwiOlxuICAgIGNvbnN0IGxhc3QgPSBub2RlLmV4cHJlc3Npb25zW25vZGUuZXhwcmVzc2lvbnMubGVuZ3RoIC0gMV07XG4gICAgcmV0dXJuIGhhc0lkV2l0aE5hbWUobGFzdCwgbmFtZSk7XG4gIGNhc2UgXCJNZW1iZXJFeHByZXNzaW9uXCI6XG4gICAgcmV0dXJuIGhhc0lkV2l0aE5hbWUobm9kZS5wcm9wZXJ0eSwgbmFtZSk7XG4gIGNhc2UgXCJJZGVudGlmaWVyXCI6XG4gICAgcmV0dXJuIG5vZGUubmFtZSA9PT0gbmFtZTtcbiAgZGVmYXVsdDpcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0S2V5TmFtZShrZXkpIHtcbiAgaWYgKGtleS50eXBlID09PSBcIklkZW50aWZpZXJcIikge1xuICAgIHJldHVybiBrZXkubmFtZTtcbiAgfVxuXG4gIGlmIChrZXkudHlwZSA9PT0gXCJTdHJpbmdMaXRlcmFsXCIgfHxcbiAgICAgIGtleS50eXBlID09PSBcIkxpdGVyYWxcIikge1xuICAgIHJldHVybiBrZXkudmFsdWU7XG4gIH1cblxuICByZXR1cm4gbnVsbDtcbn0iLCJcInVzZSBzdHJpY3RcIjtcblxuY29uc3QgY29kZU9mQSA9IFwiQVwiLmNoYXJDb2RlQXQoMCk7XG5jb25zdCBjb2RlT2ZaID0gXCJaXCIuY2hhckNvZGVBdCgwKTtcblxuZXhwb3J0IGZ1bmN0aW9uIGlzT2JqZWN0KHZhbHVlKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09IFwib2JqZWN0XCIgJiYgdmFsdWUgIT09IG51bGw7XG59XG5cbi8vIFdpdGhvdXQgYSBjb21wbGV0ZSBsaXN0IG9mIE5vZGUgLnR5cGUgbmFtZXMsIHdlIGhhdmUgdG8gc2V0dGxlIGZvciB0aGlzXG4vLyBmdXp6eSBtYXRjaGluZyBvZiBvYmplY3Qgc2hhcGVzLiBIb3dldmVyLCB0aGUgaW5mZWFzaWJpbGl0eSBvZlxuLy8gbWFpbnRhaW5pbmcgYSBjb21wbGV0ZSBsaXN0IG9mIHR5cGUgbmFtZXMgaXMgb25lIG9mIHRoZSByZWFzb25zIHdlJ3JlXG4vLyB1c2luZyB0aGUgRmFzdFBhdGgvVmlzaXRvciBhYnN0cmFjdGlvbiBpbiB0aGUgZmlyc3QgcGxhY2UuXG5leHBvcnQgZnVuY3Rpb24gaXNOb2RlTGlrZSh2YWx1ZSkge1xuICByZXR1cm4gaXNPYmplY3QodmFsdWUpICYmXG4gICAgISBBcnJheS5pc0FycmF5KHZhbHVlKSAmJlxuICAgIGlzQ2FwaXRhbGl6ZWQodmFsdWUudHlwZSk7XG59XG5cbmZ1bmN0aW9uIGlzQ2FwaXRhbGl6ZWQoc3RyaW5nKSB7XG4gIGlmICh0eXBlb2Ygc3RyaW5nICE9PSBcInN0cmluZ1wiKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGNvbnN0IGNvZGUgPSBzdHJpbmcuY2hhckNvZGVBdCgwKTtcbiAgcmV0dXJuIGNvZGUgPj0gY29kZU9mQSAmJiBjb2RlIDw9IGNvZGVPZlo7XG59XG4iXX0=
