(function () {

/* Imports */
var meteorJsMinify = Package['minifier-js'].meteorJsMinify;
var ECMAScript = Package.ecmascript.ECMAScript;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

var require = meteorInstall({"node_modules":{"meteor":{"minifyStdJS":{"plugin":{"minify-js.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                 //
// packages/minifyStdJS/plugin/minify-js.js                                                                        //
//                                                                                                                 //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
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
}, () => new MeteorMinifier());

class MeteorMinifier {
  processFilesForBundle(files, options) {
    const mode = options.minifyMode; // don't minify anything for development

    if (mode === 'development') {
      files.forEach(function (file) {
        file.addJavaScript({
          data: file.getContentsAsBuffer(),
          sourceMap: file.getSourceMap(),
          path: file.getPathInBundle()
        });
      });
      return;
    } // this function tries its best to locate the original source file
    // that the error being reported was located inside of


    function maybeThrowMinifyErrorBySourceFile(error, file) {
      const lines = file.getContentsAsString().split(/\n/);
      const lineContent = lines[error.line - 1];
      let originalSourceFileLineNumber = 0; // Count backward from the failed line to find the oringal filename

      for (let i = error.line - 1; i >= 0; i--) {
        let currentLine = lines[i]; // If the line is a boatload of slashes (8 or more), we're in the right place.

        if (/^\/\/\/{6,}$/.test(currentLine)) {
          // If 4 lines back is the same exact line, we've found the framing.
          if (lines[i - 4] === currentLine) {
            // So in that case, 2 lines back is the file path.
            let originalFilePath = lines[i - 2].substring(3).replace(/\s+\/\//, "");
            throw new Error("terser minification error (".concat(error.name, ":").concat(error.message, ")\n") + "Source file: ".concat(originalFilePath, "  (").concat(originalSourceFileLineNumber, ":").concat(error.col, ")\n") + "Line content: ".concat(lineContent, "\n"));
          }
        }

        originalSourceFileLineNumber++;
      }
    } // this object will collect all the minified code in the
    // data field and post-minfiication file sizes in the stats field


    const toBeAdded = {
      data: "",
      stats: Object.create(null)
    };
    files.forEach(file => {
      // Don't reminify *.min.js.
      if (/\.min\.js$/.test(file.getPathInBundle())) {
        toBeAdded.data += file.getContentsAsString();
      } else {
        let minified;

        try {
          minified = meteorJsMinify(file.getContentsAsString());
        } catch (err) {
          maybeThrowMinifyErrorBySourceFile(err, file);
          throw new Error("terser minification error (".concat(err.name, ":").concat(err.message, ")\n") + "Bundled file: ".concat(file.getPathInBundle(), "  (").concat(err.line, ":").concat(err.col, ")\n"));
        }

        const ast = extractModuleSizesTree(minified.code);

        if (ast) {
          toBeAdded.stats[file.getPathInBundle()] = [Buffer.byteLength(minified.code), ast];
        } else {
          toBeAdded.stats[file.getPathInBundle()] = Buffer.byteLength(minified.code);
        } // append the minified code to the "running sum"
        // of code being minified


        toBeAdded.data += minified.code;
      }

      toBeAdded.data += '\n\n';
      Plugin.nudge();
    }); // this is where the minified code gets added to one
    // JS file that is delivered to the client

    if (files.length) {
      files[0].addJavaScript(toBeAdded);
    }
  }

}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"stats.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                 //
// packages/minifyStdJS/plugin/stats.js                                                                            //
//                                                                                                                 //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
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
let Babel;
module.link("meteor/babel-compiler", {
  Babel(v) {
    Babel = v;
  }

}, 2);
// This RegExp will be used to scan the source for calls to meteorInstall,
// taking into consideration that the function name may have been mangled
// to something other than "meteorInstall" by the minifier.
const meteorInstallRegExp = new RegExp([// If meteorInstall is called by its unminified name, then that's what
// we should be looking for in the AST.
/\b(meteorInstall)\(\{/, // If the meteorInstall function name has been minified, we can figure
// out its mangled name by examining the import assignment.
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
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});

require("/node_modules/meteor/minifyStdJS/plugin/minify-js.js");
require("/node_modules/meteor/minifyStdJS/plugin/stats.js");

/* Exports */
Package._define("minifyStdJS");

})();




//# sourceURL=meteor://💻app/packages/minifyStdJS_plugin.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvbWluaWZ5U3RkSlMvcGx1Z2luL21pbmlmeS1qcy5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvbWluaWZ5U3RkSlMvcGx1Z2luL3N0YXRzLmpzIl0sIm5hbWVzIjpbImV4dHJhY3RNb2R1bGVTaXplc1RyZWUiLCJtb2R1bGUiLCJsaW5rIiwidiIsIlBsdWdpbiIsInJlZ2lzdGVyTWluaWZpZXIiLCJleHRlbnNpb25zIiwiYXJjaE1hdGNoaW5nIiwiTWV0ZW9yTWluaWZpZXIiLCJwcm9jZXNzRmlsZXNGb3JCdW5kbGUiLCJmaWxlcyIsIm9wdGlvbnMiLCJtb2RlIiwibWluaWZ5TW9kZSIsImZvckVhY2giLCJmaWxlIiwiYWRkSmF2YVNjcmlwdCIsImRhdGEiLCJnZXRDb250ZW50c0FzQnVmZmVyIiwic291cmNlTWFwIiwiZ2V0U291cmNlTWFwIiwicGF0aCIsImdldFBhdGhJbkJ1bmRsZSIsIm1heWJlVGhyb3dNaW5pZnlFcnJvckJ5U291cmNlRmlsZSIsImVycm9yIiwibGluZXMiLCJnZXRDb250ZW50c0FzU3RyaW5nIiwic3BsaXQiLCJsaW5lQ29udGVudCIsImxpbmUiLCJvcmlnaW5hbFNvdXJjZUZpbGVMaW5lTnVtYmVyIiwiaSIsImN1cnJlbnRMaW5lIiwidGVzdCIsIm9yaWdpbmFsRmlsZVBhdGgiLCJzdWJzdHJpbmciLCJyZXBsYWNlIiwiRXJyb3IiLCJuYW1lIiwibWVzc2FnZSIsImNvbCIsInRvQmVBZGRlZCIsInN0YXRzIiwiT2JqZWN0IiwiY3JlYXRlIiwibWluaWZpZWQiLCJtZXRlb3JKc01pbmlmeSIsImVyciIsImFzdCIsImNvZGUiLCJCdWZmZXIiLCJieXRlTGVuZ3RoIiwibnVkZ2UiLCJsZW5ndGgiLCJleHBvcnQiLCJWaXNpdG9yIiwiZGVmYXVsdCIsImZpbmRQb3NzaWJsZUluZGV4ZXMiLCJCYWJlbCIsIm1ldGVvckluc3RhbGxSZWdFeHAiLCJSZWdFeHAiLCJtYXAiLCJleHAiLCJzb3VyY2UiLCJqb2luIiwibWF0Y2giLCJleGVjIiwicGFyc2UiLCJtZXRlb3JJbnN0YWxsTmFtZSIsInNvbWUiLCJtZXRlb3JJbnN0YWxsVmlzaXRvciIsInZpc2l0IiwidHJlZSIsInJlc2V0Iiwicm9vdCIsInBvc3NpYmxlSW5kZXhlcyIsInZpc2l0Q2FsbEV4cHJlc3Npb24iLCJub2RlIiwiZ2V0VmFsdWUiLCJoYXNJZFdpdGhOYW1lIiwiY2FsbGVlIiwid2FsayIsImV4cHIiLCJ0eXBlIiwic2xpY2UiLCJzdGFydCIsImVuZCIsInByb3BlcnRpZXMiLCJwcm9wIiwia2V5TmFtZSIsImdldEtleU5hbWUiLCJrZXkiLCJ2YWx1ZSIsImFyZ3VtZW50cyIsInZpc2l0Q2hpbGRyZW4iLCJsYXN0IiwiZXhwcmVzc2lvbnMiLCJwcm9wZXJ0eSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLElBQUlBLHNCQUFKO0FBQTJCQyxNQUFNLENBQUNDLElBQVAsQ0FBWSxZQUFaLEVBQXlCO0FBQUNGLHdCQUFzQixDQUFDRyxDQUFELEVBQUc7QUFBQ0gsMEJBQXNCLEdBQUNHLENBQXZCO0FBQXlCOztBQUFwRCxDQUF6QixFQUErRSxDQUEvRTtBQUUzQkMsTUFBTSxDQUFDQyxnQkFBUCxDQUF3QjtBQUNwQkMsWUFBVSxFQUFFLENBQUMsSUFBRCxDQURRO0FBRXBCQyxjQUFZLEVBQUU7QUFGTSxDQUF4QixFQUlFLE1BQU0sSUFBSUMsY0FBSixFQUpSOztBQU9BLE1BQU1BLGNBQU4sQ0FBcUI7QUFFbkJDLHVCQUFxQixDQUFFQyxLQUFGLEVBQVNDLE9BQVQsRUFBa0I7QUFDckMsVUFBTUMsSUFBSSxHQUFHRCxPQUFPLENBQUNFLFVBQXJCLENBRHFDLENBR3JDOztBQUNBLFFBQUlELElBQUksS0FBSyxhQUFiLEVBQTRCO0FBQzFCRixXQUFLLENBQUNJLE9BQU4sQ0FBYyxVQUFVQyxJQUFWLEVBQWdCO0FBQzVCQSxZQUFJLENBQUNDLGFBQUwsQ0FBbUI7QUFDakJDLGNBQUksRUFBRUYsSUFBSSxDQUFD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TUFzQk87QUFDTCxXQUFLQyxhQUFMLENBQW1CekUsSUFBbkI7QUFDRDtBQUNGOztBQXhDcUQsQ0FBM0IsRUFBN0I7O0FBMkNBLFNBQVMwRCxhQUFULENBQXVCRixJQUF2QixFQUE2QnZDLElBQTdCLEVBQW1DO0FBQ2pDLFVBQVF1QyxJQUFJLElBQUlBLElBQUksQ0FBQ00sSUFBckI7QUFDQSxTQUFLLG9CQUFMO0FBQ0UsWUFBTVksSUFBSSxHQUFHbEIsSUFBSSxDQUFDbUIsV0FBTCxDQUFpQm5CLElBQUksQ0FBQ21CLFdBQUwsQ0FBaUIzQyxNQUFqQixHQUEwQixDQUEzQyxDQUFiO0FBQ0EsYUFBTzBCLGFBQWEsQ0FBQ2dCLElBQUQsRUFBT3pELElBQVAsQ0FBcEI7O0FBQ0YsU0FBSyxrQkFBTDtBQUNFLGFBQU95QyxhQUFhLENBQUNGLElBQUksQ0FBQ29CLFFBQU4sRUFBZ0IzRCxJQUFoQixDQUFwQjs7QUFDRixTQUFLLFlBQUw7QUFDRSxhQUFPdUMsSUFBSSxDQUFDdkMsSUFBTCxLQUFjQSxJQUFyQjs7QUFDRjtBQUNFLGFBQU8sS0FBUDtBQVRGO0FBV0Q7O0FBRUQsU0FBU29ELFVBQVQsQ0FBb0JDLEdBQXBCLEVBQXlCO0FBQ3ZCLE1BQUlBLEdBQUcsQ0FBQ1IsSUFBSixLQUFhLFlBQWpCLEVBQStCO0FBQzdCLFdBQU9RLEdBQUcsQ0FBQ3JELElBQVg7QUFDRDs7QUFFRCxNQUFJcUQsR0FBRyxDQUFDUixJQUFKLEtBQWEsZUFBYixJQUNBUSxHQUFHLENBQUNSLElBQUosS0FBYSxTQURqQixFQUM0QjtBQUMxQixXQUFPUSxHQUFHLENBQUNDLEtBQVg7QUFDRDs7QUFFRCxTQUFPLElBQVA7QUFDRCxDIiwiZmlsZSI6Ii9wYWNrYWdlcy9taW5pZnlTdGRKU19wbHVnaW4uanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBleHRyYWN0TW9kdWxlU2l6ZXNUcmVlIH0gZnJvbSBcIi4vc3RhdHMuanNcIjtcblxuUGx1Z2luLnJlZ2lzdGVyTWluaWZpZXIoe1xuICAgIGV4dGVuc2lvbnM6IFsnanMnXSxcbiAgICBhcmNoTWF0Y2hpbmc6ICd3ZWInLFxuICB9LFxuICAoKSA9PiBuZXcgTWV0ZW9yTWluaWZpZXIoKVxuKTtcblxuY2xhc3MgTWV0ZW9yTWluaWZpZXIge1xuXG4gIHByb2Nlc3NGaWxlc0ZvckJ1bmRsZSAoZmlsZXMsIG9wdGlvbnMpIHtcbiAgICBjb25zdCBtb2RlID0gb3B0aW9ucy5taW5pZnlNb2RlO1xuXG4gICAgLy8gZG9uJ3QgbWluaWZ5IGFueXRoaW5nIGZvciBkZXZlbG9wbWVudFxuICAgIGlmIChtb2RlID09PSAnZGV2ZWxvcG1lbnQnKSB7XG4gICAgICBmaWxlcy5mb3JFYWNoKGZ1bmN0aW9uIChmaWxlKSB7XG4gICAgICAgIGZpbGUuYWRkSmF2YVNjcmlwdCh7XG4gICAgICAgICAgZGF0YTogZmlsZS5nZXRDb250ZW50c0FzQnVmZmVyKCksXG4gICAgICAgICAgc291cmNlTWFwOiBmaWxlLmdldFNvdXJjZU1hcCgpLFxuICAgICAgICAgIHBhdGg6IGZpbGUuZ2V0UGF0aEluQnVuZGxlKCksXG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gdGhpcyBmdW5jdGlvbiB0cmllcyBpdHMgYmVzdCB0byBsb2NhdGUgdGhlIG9yaWdpbmFsIHNvdXJjZSBmaWxlXG4gICAgLy8gdGhhdCB0aGUgZXJyb3IgYmVpbmcgcmVwb3J0ZWQgd2FzIGxvY2F0ZWQgaW5zaWRlIG9mXG4gICAgZnVuY3Rpb24gbWF5YmVUaHJvd01pbmlmeUVycm9yQnlTb3VyY2VGaWxlKGVycm9yLCBmaWxlKSB7XG5cbiAgICAgIGNvbnN0IGxpbmVzID0gZmlsZS5nZXRDb250ZW50c0FzU3RyaW5nKCkuc3BsaXQoL1xcbi8pO1xuICAgICAgY29uc3QgbGluZUNvbnRlbnQgPSBsaW5lc1tlcnJvci5saW5lIC0gMV07XG5cbiAgICAgIGxldCBvcmlnaW5hbFNvdXJjZUZpbGVMaW5lTnVtYmVyID0gMDtcblxuICAgICAgLy8gQ291bnQgYmFja3dhcmQgZnJvbSB0aGUgZmFpbGVkIGxpbmUgdG8gZmluZCB0aGUgb3JpbmdhbCBmaWxlbmFtZVxuICAgICAgZm9yIChsZXQgaSA9IChlcnJvci5saW5lIC0gMSk7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgICAgbGV0IGN1cnJlbnRMaW5lID0gbGluZXNbaV07XG5cbiAgICAgICAgICAvLyBJZiB0aGUgbGluZSBpcyBhIGJvYXRsb2FkIG9mIHNsYXNoZXMgKDggb3IgbW9yZSksIHdlJ3JlIGluIHRoZSByaWdodCBwbGFjZS5cbiAgICAgICAgICBpZiAoL15cXC9cXC9cXC97Nix9JC8udGVzdChjdXJyZW50TGluZSkpIHtcblxuICAgICAgICAgICAgICAvLyBJZiA0IGxpbmVzIGJhY2sgaXMgdGhlIHNhbWUgZXhhY3QgbGluZSwgd2UndmUgZm91bmQgdGhlIGZyYW1pbmcuXG4gICAgICAgICAgICAgIGlmIChsaW5lc1tpIC0gNF0gPT09IGN1cnJlbnRMaW5lKSB7XG5cbiAgICAgICAgICAgICAgICAgIC8vIFNvIGluIHRoYXQgY2FzZSwgMiBsaW5lcyBiYWNrIGlzIHRoZSBmaWxlIHBhdGguXG4gICAgICAgICAgICAgICAgICBsZXQgb3JpZ2luYWxGaWxlUGF0aCA9IGxpbmVzW2kgLSAyXS5zdWJzdHJpbmcoMykucmVwbGFjZSgvXFxzK1xcL1xcLy8sIFwiXCIpO1xuXG4gICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICAgICAgICAgICAgYHRlcnNlciBtaW5pZmljYXRpb24gZXJyb3IgKCR7ZXJyb3IubmFtZX06JHtlcnJvci5tZXNzYWdlfSlcXG5gICtcbiAgICAgICAgICAgICAgICAgICAgICBgU291cmNlIGZpbGU6ICR7b3JpZ2luYWxGaWxlUGF0aH0gICgke29yaWdpbmFsU291cmNlRmlsZUxpbmVOdW1iZXJ9OiR7ZXJyb3IuY29sfSlcXG5gICtcbiAgICAgICAgICAgICAgICAgICAgICBgTGluZSBjb250ZW50OiAke2xpbmVDb250ZW50fVxcbmApO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIG9yaWdpbmFsU291cmNlRmlsZUxpbmVOdW1iZXIrKztcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyB0aGlzIG9iamVjdCB3aWxsIGNvbGxlY3QgYWxsIHRoZSBtaW5pZmllZCBjb2RlIGluIHRoZVxuICAgIC8vIGRhdGEgZmllbGQgYW5kIHBvc3QtbWluZmlpY2F0aW9uIGZpbGUgc2l6ZXMgaW4gdGhlIHN0YXRzIGZpZWxkXG4gICAgY29uc3QgdG9CZUFkZGVkID0ge1xuICAgICAgZGF0YTogXCJcIixcbiAgICAgIHN0YXRzOiBPYmplY3QuY3JlYXRlKG51bGwpXG4gICAgfTtcblxuICAgIGZpbGVzLmZvckVhY2goZmlsZSA9PiB7XG4gICAgICAvLyBEb24ndCByZW1pbmlmeSAqLm1pbi5qcy5cbiAgICAgIGlmICgvXFwubWluXFwuanMkLy50ZXN0KGZpbGUuZ2V0UGF0aEluQnVuZGxlKCkpKSB7XG4gICAgICAgIHRvQmVBZGRlZC5kYXRhICs9IGZpbGUuZ2V0Q29udGVudHNBc1N0cmluZygpO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIGxldCBtaW5pZmllZDtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBtaW5pZmllZCA9IG1ldGVvckpzTWluaWZ5KGZpbGUuZ2V0Q29udGVudHNBc1N0cmluZygpKTtcbiAgICAgICAgfVxuICAgICAgICBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgbWF5YmVUaHJvd01pbmlmeUVycm9yQnlTb3VyY2VGaWxlKGVyciwgZmlsZSk7XG5cbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHRlcnNlciBtaW5pZmljYXRpb24gZXJyb3IgKCR7ZXJyLm5hbWV9OiR7ZXJyLm1lc3NhZ2V9KVxcbmAgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICBgQnVuZGxlZCBmaWxlOiAke2ZpbGUuZ2V0UGF0aEluQnVuZGxlKCl9ICAoJHtlcnIubGluZX06JHtlcnIuY29sfSlcXG5gKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGFzdCA9IGV4dHJhY3RNb2R1bGVTaXplc1RyZWUobWluaWZpZWQuY29kZSk7XG5cbiAgICAgICAgaWYgKGFzdCkge1xuICAgICAgICAgIHRvQmVBZGRlZC5zdGF0c1tmaWxlLmdldFBhdGhJbkJ1bmRsZSgpXSA9IFtCdWZmZXIuYnl0ZUxlbmd0aChtaW5pZmllZC5jb2RlKSwgYXN0XTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0b0JlQWRkZWQuc3RhdHNbZmlsZS5nZXRQYXRoSW5CdW5kbGUoKV0gPSBCdWZmZXIuYnl0ZUxlbmd0aChtaW5pZmllZC5jb2RlKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBhcHBlbmQgdGhlIG1pbmlmaWVkIGNvZGUgdG8gdGhlIFwicnVubmluZyBzdW1cIlxuICAgICAgICAvLyBvZiBjb2RlIGJlaW5nIG1pbmlmaWVkXG4gICAgICAgIHRvQmVBZGRlZC5kYXRhICs9IG1pbmlmaWVkLmNvZGU7XG4gICAgICB9XG4gICAgICB0b0JlQWRkZWQuZGF0YSArPSAnXFxuXFxuJztcblxuICAgICAgUGx1Z2luLm51ZGdlKCk7XG4gICAgfSk7XG5cbiAgICAvLyB0aGlzIGlzIHdoZXJlIHRoZSBtaW5pZmllZCBjb2RlIGdldHMgYWRkZWQgdG8gb25lXG4gICAgLy8gSlMgZmlsZSB0aGF0IGlzIGRlbGl2ZXJlZCB0byB0aGUgY2xpZW50XG4gICAgaWYgKGZpbGVzLmxlbmd0aCkge1xuICAgICAgZmlsZXNbMF0uYWRkSmF2YVNjcmlwdCh0b0JlQWRkZWQpO1xuICAgIH1cbiAgfVxufVxuIiwiaW1wb3J0IFZpc2l0b3IgZnJvbSBcInJlaWZ5L2xpYi92aXNpdG9yLmpzXCI7XG5pbXBvcnQgeyBmaW5kUG9zc2libGVJbmRleGVzIH0gZnJvbSBcInJlaWZ5L2xpYi91dGlscy5qc1wiO1xuaW1wb3J0IHsgQmFiZWwgfSBmcm9tIFwibWV0ZW9yL2JhYmVsLWNvbXBpbGVyXCI7XG5cbi8vIFRoaXMgUmVnRXhwIHdpbGwgYmUgdXNlZCB0byBzY2FuIHRoZSBzb3VyY2UgZm9yIGNhbGxzIHRvIG1ldGVvckluc3RhbGwsXG4vLyB0YWtpbmcgaW50byBjb25zaWRlcmF0aW9uIHRoYXQgdGhlIGZ1bmN0aW9uIG5hbWUgbWF5IGhhdmUgYmVlbiBtYW5nbGVkXG4vLyB0byBzb21ldGhpbmcgb3RoZXIgdGhhbiBcIm1ldGVvckluc3RhbGxcIiBieSB0aGUgbWluaWZpZXIuXG5jb25zdCBtZXRlb3JJbnN0YWxsUmVnRXhwID0gbmV3IFJlZ0V4cChbXG4gIC8vIElmIG1ldGVvckluc3RhbGwgaXMgY2FsbGVkIGJ5IGl0cyB1bm1pbmlmaWVkIG5hbWUsIHRoZW4gdGhhdCdzIHdoYXRcbiAgLy8gd2Ugc2hvdWxkIGJlIGxvb2tpbmcgZm9yIGluIHRoZSBBU1QuXG4gIC9cXGIobWV0ZW9ySW5zdGFsbClcXChcXHsvLFxuICAvLyBJZiB0aGUgbWV0ZW9ySW5zdGFsbCBmdW5jdGlvbiBuYW1lIGhhcyBiZWVuIG1pbmlmaWVkLCB3ZSBjYW4gZmlndXJlXG4gIC8vIG91dCBpdHMgbWFuZ2xlZCBuYW1lIGJ5IGV4YW1pbmluZyB0aGUgaW1wb3J0IGFzc2lnbm1lbnQuXG4gIC9cXGIoXFx3Kyk9UGFja2FnZVxcLm1vZHVsZXNcXC5tZXRlb3JJbnN0YWxsXFxiLyxcbiAgL1xcYihcXHcrKT1QYWNrYWdlXFxbXCJtb2R1bGVzLXJ1bnRpbWVcIlxcXS5tZXRlb3JJbnN0YWxsXFxiLyxcbiAgLy8gU29tZXRpbWVzIHVnbGlmeS1lcyB3aWxsIGlubGluZSAoMCxQYWNrYWdlLm1vZHVsZXMubWV0ZW9ySW5zdGFsbCkgYXNcbiAgLy8gYSBjYWxsIGV4cHJlc3Npb24uXG4gIC9cXCgwLFBhY2thZ2VcXC5tb2R1bGVzXFwuKG1ldGVvckluc3RhbGwpXFwpXFwoLyxcbiAgL1xcKDAsUGFja2FnZVxcW1wibW9kdWxlcy1ydW50aW1lXCJcXF1cXC4obWV0ZW9ySW5zdGFsbClcXClcXCgvLFxuXS5tYXAoZXhwID0+IGV4cC5zb3VyY2UpLmpvaW4oXCJ8XCIpKTtcblxuZXhwb3J0IGZ1bmN0aW9uIGV4dHJhY3RNb2R1bGVTaXplc1RyZWUoc291cmNlKSB7XG4gIGNvbnN0IG1hdGNoID0gbWV0ZW9ySW5zdGFsbFJlZ0V4cC5leGVjKHNvdXJjZSk7XG4gIGlmIChtYXRjaCkge1xuICAgIGNvbnN0IGFzdCA9IEJhYmVsLnBhcnNlKHNvdXJjZSk7XG4gICAgbGV0IG1ldGVvckluc3RhbGxOYW1lID0gXCJtZXRlb3JJbnN0YWxsXCI7XG4gICAgLy8gVGhlIG1pbmlmaWVyIG1heSBoYXZlIHJlbmFtZWQgbWV0ZW9ySW5zdGFsbCB0byBzb21ldGhpbmcgc2hvcnRlci5cbiAgICBtYXRjaC5zb21lKChuYW1lLCBpKSA9PiAoaSA+IDAgJiYgKG1ldGVvckluc3RhbGxOYW1lID0gbmFtZSkpKTtcbiAgICBtZXRlb3JJbnN0YWxsVmlzaXRvci52aXNpdChhc3QsIG1ldGVvckluc3RhbGxOYW1lLCBzb3VyY2UpO1xuICAgIHJldHVybiBtZXRlb3JJbnN0YWxsVmlzaXRvci50cmVlO1xuICB9XG59XG5cbmNvbnN0IG1ldGVvckluc3RhbGxWaXNpdG9yID0gbmV3IChjbGFzcyBleHRlbmRzIFZpc2l0b3Ige1xuICByZXNldChyb290LCBtZXRlb3JJbnN0YWxsTmFtZSwgc291cmNlKSB7XG4gICAgdGhpcy5uYW1lID0gbWV0ZW9ySW5zdGFsbE5hbWU7XG4gICAgdGhpcy5zb3VyY2UgPSBzb3VyY2U7XG4gICAgdGhpcy50cmVlID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgICAvLyBPcHRpbWl6YXRpb24gdG8gYWJhbmRvbiBlbnRpcmUgc3VidHJlZXMgb2YgdGhlIEFTVCB0aGF0IGNvbnRhaW5cbiAgICAvLyBub3RoaW5nIGxpa2UgdGhlIG1ldGVvckluc3RhbGwgaWRlbnRpZmllciB3ZSdyZSBsb29raW5nIGZvci5cbiAgICB0aGlzLnBvc3NpYmxlSW5kZXhlcyA9IGZpbmRQb3NzaWJsZUluZGV4ZXMoc291cmNlLCBbXG4gICAgICBtZXRlb3JJbnN0YWxsTmFtZSxcbiAgICBdKTtcbiAgfVxuXG4gIHZpc2l0Q2FsbEV4cHJlc3Npb24ocGF0aCkge1xuICAgIGNvbnN0IG5vZGUgPSBwYXRoLmdldFZhbHVlKCk7XG5cbiAgICBpZiAoaGFzSWRXaXRoTmFtZShub2RlLmNhbGxlZSwgdGhpcy5uYW1lKSkge1xuICAgICAgY29uc3Qgc291cmNlID0gdGhpcy5zb3VyY2U7XG5cbiAgICAgIGZ1bmN0aW9uIHdhbGsodHJlZSwgZXhwcikge1xuICAgICAgICBpZiAoZXhwci50eXBlICE9PSBcIk9iamVjdEV4cHJlc3Npb25cIikge1xuICAgICAgICAgIHJldHVybiBCdWZmZXIuYnl0ZUxlbmd0aChzb3VyY2Uuc2xpY2UoZXhwci5zdGFydCwgZXhwci5lbmQpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRyZWUgPSB0cmVlIHx8IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cbiAgICAgICAgZXhwci5wcm9wZXJ0aWVzLmZvckVhY2gocHJvcCA9PiB7XG4gICAgICAgICAgY29uc3Qga2V5TmFtZSA9IGdldEtleU5hbWUocHJvcC5rZXkpO1xuICAgICAgICAgIGlmICh0eXBlb2Yga2V5TmFtZSA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgICAgICAgdHJlZVtrZXlOYW1lXSA9IHdhbGsodHJlZVtrZXlOYW1lXSwgcHJvcC52YWx1ZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gdHJlZTtcbiAgICAgIH1cblxuICAgICAgd2Fsayh0aGlzLnRyZWUsIG5vZGUuYXJndW1lbnRzWzBdKTtcblxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnZpc2l0Q2hpbGRyZW4ocGF0aCk7XG4gICAgfVxuICB9XG59KTtcblxuZnVuY3Rpb24gaGFzSWRXaXRoTmFtZShub2RlLCBuYW1lKSB7XG4gIHN3aXRjaCAobm9kZSAmJiBub2RlLnR5cGUpIHtcbiAgY2FzZSBcIlNlcXVlbmNlRXhwcmVzc2lvblwiOlxuICAgIGNvbnN0IGxhc3QgPSBub2RlLmV4cHJlc3Npb25zW25vZGUuZXhwcmVzc2lvbnMubGVuZ3RoIC0gMV07XG4gICAgcmV0dXJuIGhhc0lkV2l0aE5hbWUobGFzdCwgbmFtZSk7XG4gIGNhc2UgXCJNZW1iZXJFeHByZXNzaW9uXCI6XG4gICAgcmV0dXJuIGhhc0lkV2l0aE5hbWUobm9kZS5wcm9wZXJ0eSwgbmFtZSk7XG4gIGNhc2UgXCJJZGVudGlmaWVyXCI6XG4gICAgcmV0dXJuIG5vZGUubmFtZSA9PT0gbmFtZTtcbiAgZGVmYXVsdDpcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0S2V5TmFtZShrZXkpIHtcbiAgaWYgKGtleS50eXBlID09PSBcIklkZW50aWZpZXJcIikge1xuICAgIHJldHVybiBrZXkubmFtZTtcbiAgfVxuXG4gIGlmIChrZXkudHlwZSA9PT0gXCJTdHJpbmdMaXRlcmFsXCIgfHxcbiAgICAgIGtleS50eXBlID09PSBcIkxpdGVyYWxcIikge1xuICAgIHJldHVybiBrZXkudmFsdWU7XG4gIH1cblxuICByZXR1cm4gbnVsbDtcbn1cbiJdfQ==
