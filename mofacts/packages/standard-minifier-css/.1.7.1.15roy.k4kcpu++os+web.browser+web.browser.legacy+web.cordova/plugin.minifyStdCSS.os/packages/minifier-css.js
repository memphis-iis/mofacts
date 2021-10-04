(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var ECMAScript = Package.ecmascript.ECMAScript;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var transformResult, CssTools;

var require = meteorInstall({"node_modules":{"meteor":{"minifier-css":{"minifier.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                 //
// packages/minifier-css/minifier.js                                                                               //
//                                                                                                                 //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                   //
!function (module1) {
  module1.export({
    CssTools: () => CssTools
  });
  let path;
  module1.link("path", {
    default(v) {
      path = v;
    }

  }, 0);
  let url;
  module1.link("url", {
    default(v) {
      url = v;
    }

  }, 1);
  let Future;
  module1.link("fibers/future", {
    default(v) {
      Future = v;
    }

  }, 2);
  let postcss;
  module1.link("postcss", {
    default(v) {
      postcss = v;
    }

  }, 3);
  let cssnano;
  module1.link("cssnano", {
    default(v) {
      cssnano = v;
    }

  }, 4);
  const CssTools = {
    /**
     * Parse the incoming CSS string; return a CSS AST.
     *
     * @param {string} cssText The CSS string to be parsed.
     * @param {Object} options Options to pass to the PostCSS parser.
     * @return {postcss#Root} PostCSS Root AST.
     */
    parseCss(cssText) {
      let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      // This function previously used the `css-parse` npm package, which
      // set the name of the css file being pased using  { source: 'filename' }.
      // If included, we'll convert this to the `postcss` equivalent, to maintain
      // backwards compatibility.
      if (options.source) {
        options.from = options.source;
        delete options.source;
      }

      return postcss.parse(cssText, options);
    },

    /**
     * Using the incoming CSS AST, create and return a new object with the
     * generated CSS string, and optional sourcemap details.
     *
     * @param {postcss#Root} cssAst PostCSS Root AST.
     * @param {Object} options Options to pass to the PostCSS parser.
     * @return {Object} Format: { code: 'css string', map: 'sourcemap deatils' }.
     */
    stringifyCss(cssAst) {
      let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      // This function previously used the `css-stringify` npm package, which
      // controlled sourcemap generation by passing in { sourcemap: true }.
      // If included, we'll convert this to the `postcss` equivalent, to maintain
      // backwards compatibility.
      if (options.sourcemap) {
        options.map = {
          inline: false,
          annotation: false,
          sourcesContent: false
        };
        delete options.sourcemap;
      } // explicitly set from to undefined to prevent postcss warnings


      if (!options.from) {
        options.from = void 0;
      }

      transformResult = cssAst.toResult(options);
      return {
        code: transformResult.css,
        map: transformResult.map ? transformResult.map.toJSON() : null
      };
    },

    /**
     * Minify the passed in CSS string.
     *
     * @param {string} cssText CSS string to minify.
     * @return {String[]} Array containing the minified CSS.
     */
    minifyCss(cssText) {
      const f = new Future();
      postcss([cssnano({
        safe: true
      })]).process(cssText, {
        from: void 0
      }).then(result => {
        f.return(result.css);
      }).catch(error => {
        f.throw(error);
      });
      const minifiedCss = f.wait(); // Since this function has always returned an array, we'll wrap the
      // minified css string in an array before returning, even though we're
      // only ever returning one minified css string in that array (maintaining
      // backwards compatibility).

      return [minifiedCss];
    },

    /**
     * Merge multiple CSS AST's into one.
     *
     * @param {postcss#Root[]} cssAsts Array of PostCSS Root objects.
     * @callback warnCb Callback used to handle warning messages.
     * @return {postcss#Root} PostCSS Root object.
     */
    mergeCssAsts(cssAsts, warnCb) {
      const rulesPredicate = function (rules) {
        let exclude = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

        if (!Array.isArray(rules)) {
          rules = [rules];
        }

        return node => {
          // PostCSS AtRule nodes have `type: 'atrule'` and a descriptive name,
          // e.g. 'import' or 'charset', while Comment nodes have type only.
          const nodeMatchesRule = rules.includes(node.name || node.type);
          return exclude ? !nodeMatchesRule : nodeMatchesRule;
        };
      }; // Simple concatenation of CSS files would break @import rules
      // located in the beginning of a file. Before concatenation, pull
      // @import rules to the beginning of a new syntax tree so they always
      // precede other rules.


      const newAst = postcss.root();
      cssAsts.forEach(ast => {
        if (ast.nodes) {
          // Pick only the imports from the beginning of file ignoring @charset
          // rules as every file is assumed to be in UTF-8.
          const charsetRules = ast.nodes.filter(rulesPredicate('charset'));

          if (charsetRules.some(rule => {
            // According to MDN, only 'UTF-8' and "UTF-8" are the correct
            // encoding directives representing UTF-8.
            return !/^(['"])UTF-8\1$/.test(rule.params);
          })) {
            warnCb(ast.filename, '@charset rules in this file will be ignored as UTF-8 is the ' + 'only encoding supported');
          }

          ast.nodes = ast.nodes.filter(rulesPredicate('charset', true));
          let importCount = 0;

          for (let i = 0; i < ast.nodes.length; i++) {
            if (!rulesPredicate(['import', 'comment'])(ast.nodes[i])) {
              importCount = i;
              break;
            }
          }

          CssTools.rewriteCssUrls(ast);
          const imports = ast.nodes.splice(0, importCount);
          newAst.nodes.push(...imports); // If there are imports left in the middle of a file, warn users as it
          // might be a potential bug (imports are only valid at the beginning of
          // a file).

          if (ast.nodes.some(rulesPredicate('import'))) {
            warnCb(ast.filename, 'There are some @import rules in the middle of a file. This ' + 'might be a bug, as imports are only valid at the beginning of ' + 'a file.');
          }
        }
      }); // Now we can put the rest of CSS rules into new AST.

      cssAsts.forEach(ast => {
        if (ast.nodes) {
          newAst.nodes.push(...ast.nodes);
        }
      });
      return newAst;
    },

    /**
     * We are looking for all relative urls defined with the `url()` functional
     * notation and rewriting them to the equivalent absolute url using the
     * `source` path provided by postcss. For performance reasons this function
     * acts by side effect by modifying the given AST without doing a deep copy.
     *
     * @param {postcss#Root} ast PostCSS Root object.
     * @return Modifies the ast param in place.
     */
    rewriteCssUrls(ast) {
      const mergedCssPath = '/';
      rewriteRules(ast.nodes, mergedCssPath);
    }

  };

  if (typeof Profile !== 'undefined') {
    ['parseCss', 'stringifyCss', 'minifyCss', 'mergeCssAsts', 'rewriteCssUrls'].forEach(funcName => {
      CssTools[funcName] = Profile("CssTools.".concat(funcName), CssTools[funcName]);
    });
  }

  const hasOwn = Object.prototype.hasOwnProperty;

  const rewriteRules = (rules, mergedCssPath) => {
    rules.forEach(rule => {
      // Recurse if there are sub-rules. An example:
      //     @media (...) {
      //         .rule { url(...); }
      //     }
      if (hasOwn.call(rule, 'nodes')) {
        rewriteRules(rule.nodes, mergedCssPath);
      }

      const appDir = process.cwd();
      const sourceFile = rule.source.input.file;
      const sourceFileFromAppRoot = sourceFile ? sourceFile.replace(appDir, '') : '';
      let basePath = pathJoin('/', pathDirname(sourceFileFromAppRoot)); // Set the correct basePath based on how the linked asset will be served.
      // XXX This is wrong. We are coupling the information about how files will
      // be served by the web server to the information how they were stored
      // originally on the filesystem in the project structure. Ideally, there
      // should be some module that tells us precisely how each asset will be
      // served but for now we are just assuming that everything that comes from
      // a folder starting with "/packages/" is served on the same path as
      // it was on the filesystem and everything else is served on root "/".

      if (!basePath.match(/^\/?packages\//i)) {
        basePath = "/";
      }

      let value = rule.value; // Match css values containing some functional calls to `url(URI)` where
      // URI is optionally quoted.
      // Note that a css value can contains other elements, for instance:
      //   background: top center url("background.png") black;
      // or even multiple url(), for instance for multiple backgrounds.

      var cssUrlRegex = /url\s*\(\s*(['"]?)(.+?)\1\s*\)/gi;
      let parts;

      while (parts = cssUrlRegex.exec(value)) {
        const oldCssUrl = parts[0];
        const quote = parts[1];
        const resource = url.parse(parts[2]); // We don't rewrite URLs starting with a protocol definition such as
        // http, https, or data, or those with network-path references
        // i.e. //img.domain.com/cat.gif

        if (resource.protocol !== null || resource.href.startsWith('//') || resource.href.startsWith('#')) {
          continue;
        } // Rewrite relative paths (that refers to the internal application tree)
        // to absolute paths (addressable from the public build).


        let absolutePath = isRelative(resource.path) ? pathJoin(basePath, resource.path) : resource.path;

        if (resource.hash) {
          absolutePath += resource.hash;
        } // We used to finish the rewriting process at the absolute path step
        // above. But it didn't work in case the Meteor application was deployed
        // under a sub-path (eg `ROOT_URL=http://localhost:3000/myapp meteor`)
        // in which case the resources linked in the merged CSS file would miss
        // the `myapp/` prefix. Since this path prefix is only known at launch
        // time (rather than build time) we can't use absolute paths to link
        // resources in the generated CSS.
        //
        // Instead we transform absolute paths to make them relative to the
        // merged CSS, leaving to the browser the responsibility to calculate
        // the final resource links (by adding the application deployment
        // prefix, here `myapp/`, if applicable).


        const relativeToMergedCss = pathRelative(mergedCssPath, absolutePath);
        const newCssUrl = "url(".concat(quote).concat(relativeToMergedCss).concat(quote, ")");
        value = value.replace(oldCssUrl, newCssUrl);
      }

      rule.value = value;
    });
  };

  const isRelative = path => path && path.charAt(0) !== '/'; // These are duplicates of functions in tools/files.js, because we don't have
  // a good way of exporting them into packages.
  // XXX deduplicate files.js into a package at some point so that we can use it
  // in core


  const toOSPath = p => process.platform === 'win32' ? p.replace(/\//g, '\\') : p;

  const toStandardPath = p => process.platform === 'win32' ? p.replace(/\\/g, '/') : p;

  const pathJoin = (a, b) => toStandardPath(path.join(toOSPath(a), toOSPath(b)));

  const pathDirname = p => toStandardPath(path.dirname(toOSPath(p)));

  const pathRelative = (p1, p2) => toStandardPath(path.relative(toOSPath(p1), toOSPath(p2)));
}.call(this, module);
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"node_modules":{"postcss":{"package.json":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                 //
// node_modules/meteor/minifier-css/node_modules/postcss/package.json                                              //
//                                                                                                                 //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                   //
module.exports = {
  "name": "postcss",
  "version": "7.0.32",
  "main": "lib/postcss"
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"lib":{"postcss.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                 //
// node_modules/meteor/minifier-css/node_modules/postcss/lib/postcss.js                                            //
//                                                                                                                 //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                   //
module.useNode();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}},"cssnano":{"package.json":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                 //
// node_modules/meteor/minifier-css/node_modules/cssnano/package.json                                              //
//                                                                                                                 //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                   //
module.exports = {
  "name": "cssnano",
  "version": "4.1.10",
  "main": "dist/index.js"
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"dist":{"index.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                 //
// node_modules/meteor/minifier-css/node_modules/cssnano/dist/index.js                                             //
//                                                                                                                 //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                   //
module.useNode();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});

var exports = require("/node_modules/meteor/minifier-css/minifier.js");

/* Exports */
Package._define("minifier-css", exports, {
  CssTools: CssTools
});

})();




//# sourceURL=meteor://💻app/packages/minifier-css.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvbWluaWZpZXItY3NzL21pbmlmaWVyLmpzIl0sIm5hbWVzIjpbIm1vZHVsZTEiLCJleHBvcnQiLCJDc3NUb29scyIsInBhdGgiLCJsaW5rIiwiZGVmYXVsdCIsInYiLCJ1cmwiLCJGdXR1cmUiLCJwb3N0Y3NzIiwiY3NzbmFubyIsInBhcnNlQ3NzIiwiY3NzVGV4dCIsIm9wdGlvbnMiLCJzb3VyY2UiLCJmcm9tIiwicGFyc2UiLCJzdHJpbmdpZnlDc3MiLCJjc3NBc3QiLCJzb3VyY2VtYXAiLCJtYXAiLCJpbmxpbmUiLCJhbm5vdGF0aW9uIiwic291cmNlc0NvbnRlbnQiLCJ0cmFuc2Zvcm1SZXN1bHQiLCJ0b1Jlc3VsdCIsImNvZGUiLCJjc3MiLCJ0b0pTT04iLCJtaW5pZnlDc3MiLCJmIiwic2FmZSIsInByb2Nlc3MiLCJ0aGVuIiwicmVzdWx0IiwicmV0dXJuIiwiY2F0Y2giLCJlcnJvciIsInRocm93IiwibWluaWZpZWRDc3MiLCJ3YWl0IiwibWVyZ2VDc3NBc3RzIiwiY3NzQXN0cyIsIndhcm5DYiIsInJ1bGVzUHJlZGljYXRlIiwicnVsZXMiLCJleGNsdWRlIiwiQXJyYXkiLCJpc0FycmF5Iiwibm9kZSIsIm5vZGVNYXRjaGVzUnVsZSIsImluY2x1ZGVzIiwibmFtZSIsInR5cGUiLCJuZXdBc3QiLCJyb290IiwiZm9yRWFjaCIsImFzdCIsIm5vZGVzIiwiY2hhcnNldFJ1bGVzIiwiZmlsdGVyIiwic29tZSIsInJ1bGUiLCJ0ZXN0IiwicGFyYW1zIiwiZmlsZW5hbWUiLCJpbXBvcnRDb3VudCIsImkiLCJsZW5ndGgiLCJyZXdyaXRlQ3NzVXJscyIsImltcG9ydHMiLCJzcGxpY2UiLCJwdXNoIiwibWVyZ2VkQ3NzUGF0aCIsInJld3JpdGVSdWxlcyIsIlByb2ZpbGUiLCJmdW5jTmFtZSIsImhhc093biIsIk9iamVjdCIsInByb3RvdHlwZSIsImhhc093blByb3BlcnR5IiwiY2FsbCIsImFwcERpciIsImN3ZCIsInNvdXJjZUZpbGUiLCJpbnB1dCIsImZpbGUiLCJzb3VyY2VGaWxlRnJvbUFwcFJvb3QiLCJyZXBsYWNlIiwiYmFzZVBhdGgiLCJwYXRoSm9pbiIsInBhdGhEaXJuYW1lIiwibWF0Y2giLCJ2YWx1ZSIsImNzc1VybFJlZ2V4IiwicGFydHMiLCJleGVjIiwib2xkQ3NzVXJsIiwicXVvdGUiLCJyZXNvdXJjZSIsInByb3RvY29sIiwiaHJlZiIsInN0YXJ0c1dpdGgiLCJhYnNvbHV0ZVBhdGgiLCJpc1JlbGF0aXZlIiwiaGFzaCIsInJlbGF0aXZlVG9NZXJnZWRDc3MiLCJwYXRoUmVsYXRpdmUiLCJuZXdDc3NVcmwiLCJjaGFyQXQiLCJ0b09TUGF0aCIsInAiLCJwbGF0Zm9ybSIsInRvU3RhbmRhcmRQYXRoIiwiYSIsImIiLCJqb2luIiwiZGlybmFtZSIsInAxIiwicDIiLCJyZWxhdGl2ZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBQSxTQUFPLENBQUNDLE1BQVIsQ0FBZTtBQUFDQyxZQUFRLEVBQUMsTUFBSUE7QUFBZCxHQUFmO0FBQXdDLE1BQUlDLElBQUo7QUFBU0gsU0FBTyxDQUFDSSxJQUFSLENBQWEsTUFBYixFQUFvQjtBQUFDQyxXQUFPLENBQUNDLENBQUQsRUFBRztBQUFDSCxVQUFJLEdBQUNHLENBQUw7QUFBTzs7QUFBbkIsR0FBcEIsRUFBeUMsQ0FBekM7QUFBNEMsTUFBSUMsR0FBSjtBQUFRUCxTQUFPLENBQUNJLElBQVIsQ0FBYSxLQUFiLEVBQW1CO0FBQUNDLFdBQU8sQ0FBQ0MsQ0FBRCxFQUFHO0FBQUNDLFNBQUcsR0FBQ0QsQ0FBSjtBQUFNOztBQUFsQixHQUFuQixFQUF1QyxDQUF2QztBQUEwQyxNQUFJRSxNQUFKO0FBQVdSLFNBQU8sQ0FBQ0ksSUFBUixDQUFhLGVBQWIsRUFBNkI7QUFBQ0MsV0FBTyxDQUFDQyxDQUFELEVBQUc7QUFBQ0UsWUFBTSxHQUFDRixDQUFQO0FBQVM7O0FBQXJCLEdBQTdCLEVBQW9ELENBQXBEO0FBQXVELE1BQUlHLE9B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Q0FBQ3FILFFBQUwsQ0FBY1YsUUFBUSxDQUFDUSxFQUFELENBQXRCLEVBQTRCUixRQUFRLENBQUNTLEVBQUQsQ0FBcEMsQ0FBRCxDQUQ1QiIsImZpbGUiOiIvcGFja2FnZXMvbWluaWZpZXItY3NzLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgdXJsIGZyb20gJ3VybCc7XG5pbXBvcnQgRnV0dXJlIGZyb20gJ2ZpYmVycy9mdXR1cmUnO1xuaW1wb3J0IHBvc3Rjc3MgZnJvbSAncG9zdGNzcyc7XG5pbXBvcnQgY3NzbmFubyBmcm9tICdjc3NuYW5vJztcblxuY29uc3QgQ3NzVG9vbHMgPSB7XG4gIC8qKlxuICAgKiBQYXJzZSB0aGUgaW5jb21pbmcgQ1NTIHN0cmluZzsgcmV0dXJuIGEgQ1NTIEFTVC5cbiAgICpcbiAgICogQHBhcmFtIHtzdHJpbmd9IGNzc1RleHQgVGhlIENTUyBzdHJpbmcgdG8gYmUgcGFyc2VkLlxuICAgKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucyBPcHRpb25zIHRvIHBhc3MgdG8gdGhlIFBvc3RDU1MgcGFyc2VyLlxuICAgKiBAcmV0dXJuIHtwb3N0Y3NzI1Jvb3R9IFBvc3RDU1MgUm9vdCBBU1QuXG4gICAqL1xuICBwYXJzZUNzcyhjc3NUZXh0LCBvcHRpb25zID0ge30pIHtcbiAgICAvLyBUaGlzIGZ1bmN0aW9uIHByZXZpb3VzbHkgdXNlZCB0aGUgYGNzcy1wYXJzZWAgbnBtIHBhY2thZ2UsIHdoaWNoXG4gICAgLy8gc2V0IHRoZSBuYW1lIG9mIHRoZSBjc3MgZmlsZSBiZWluZyBwYXNlZCB1c2luZyAgeyBzb3VyY2U6ICdmaWxlbmFtZScgfS5cbiAgICAvLyBJZiBpbmNsdWRlZCwgd2UnbGwgY29udmVydCB0aGlzIHRvIHRoZSBgcG9zdGNzc2AgZXF1aXZhbGVudCwgdG8gbWFpbnRhaW5cbiAgICAvLyBiYWNrd2FyZHMgY29tcGF0aWJpbGl0eS5cbiAgICBpZiAob3B0aW9ucy5zb3VyY2UpIHtcbiAgICAgIG9wdGlvbnMuZnJvbSA9IG9wdGlvbnMuc291cmNlO1xuICAgICAgZGVsZXRlIG9wdGlvbnMuc291cmNlO1xuICAgIH1cbiAgICByZXR1cm4gcG9zdGNzcy5wYXJzZShjc3NUZXh0LCBvcHRpb25zKTtcbiAgfSxcblxuICAvKipcbiAgICogVXNpbmcgdGhlIGluY29taW5nIENTUyBBU1QsIGNyZWF0ZSBhbmQgcmV0dXJuIGEgbmV3IG9iamVjdCB3aXRoIHRoZVxuICAgKiBnZW5lcmF0ZWQgQ1NTIHN0cmluZywgYW5kIG9wdGlvbmFsIHNvdXJjZW1hcCBkZXRhaWxzLlxuICAgKlxuICAgKiBAcGFyYW0ge3Bvc3Rjc3MjUm9vdH0gY3NzQXN0IFBvc3RDU1MgUm9vdCBBU1QuXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zIE9wdGlvbnMgdG8gcGFzcyB0byB0aGUgUG9zdENTUyBwYXJzZXIuXG4gICAqIEByZXR1cm4ge09iamVjdH0gRm9ybWF0OiB7IGNvZGU6ICdjc3Mgc3RyaW5nJywgbWFwOiAnc291cmNlbWFwIGRlYXRpbHMnIH0uXG4gICAqL1xuICBzdHJpbmdpZnlDc3MoY3NzQXN0LCBvcHRpb25zID0ge30pIHtcbiAgICAvLyBUaGlzIGZ1bmN0aW9uIHByZXZpb3VzbHkgdXNlZCB0aGUgYGNzcy1zdHJpbmdpZnlgIG5wbSBwYWNrYWdlLCB3aGljaFxuICAgIC8vIGNvbnRyb2xsZWQgc291cmNlbWFwIGdlbmVyYXRpb24gYnkgcGFzc2luZyBpbiB7IHNvdXJjZW1hcDogdHJ1ZSB9LlxuICAgIC8vIElmIGluY2x1ZGVkLCB3ZSdsbCBjb252ZXJ0IHRoaXMgdG8gdGhlIGBwb3N0Y3NzYCBlcXVpdmFsZW50LCB0byBtYWludGFpblxuICAgIC8vIGJhY2t3YXJkcyBjb21wYXRpYmlsaXR5LlxuICAgIGlmIChvcHRpb25zLnNvdXJjZW1hcCkge1xuICAgICAgb3B0aW9ucy5tYXAgPSB7XG4gICAgICAgIGlubGluZTogZmFsc2UsXG4gICAgICAgIGFubm90YXRpb246IGZhbHNlLFxuICAgICAgICBzb3VyY2VzQ29udGVudDogZmFsc2UsXG4gICAgICB9O1xuICAgICAgZGVsZXRlIG9wdGlvbnMuc291cmNlbWFwO1xuICAgIH1cbiAgICAvLyBleHBsaWNpdGx5IHNldCBmcm9tIHRvIHVuZGVmaW5lZCB0byBwcmV2ZW50IHBvc3Rjc3Mgd2FybmluZ3NcbiAgICBpZiAoIW9wdGlvbnMuZnJvbSl7XG4gICAgICBvcHRpb25zLmZyb20gPSB2b2lkIDA7XG4gICAgfVxuXG4gICAgdHJhbnNmb3JtUmVzdWx0ID0gY3NzQXN0LnRvUmVzdWx0KG9wdGlvbnMpO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGNvZGU6IHRyYW5zZm9ybVJlc3VsdC5jc3MsXG4gICAgICBtYXA6IHRyYW5zZm9ybVJlc3VsdC5tYXAgPyB0cmFuc2Zvcm1SZXN1bHQubWFwLnRvSlNPTigpIDogbnVsbCxcbiAgICB9O1xuICB9LFxuXG4gIC8qKlxuICAgKiBNaW5pZnkgdGhlIHBhc3NlZCBpbiBDU1Mgc3RyaW5nLlxuICAgKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gY3NzVGV4dCBDU1Mgc3RyaW5nIHRvIG1pbmlmeS5cbiAgICogQHJldHVybiB7U3RyaW5nW119IEFycmF5IGNvbnRhaW5pbmcgdGhlIG1pbmlmaWVkIENTUy5cbiAgICovXG4gIG1pbmlmeUNzcyhjc3NUZXh0KSB7XG4gICAgY29uc3QgZiA9IG5ldyBGdXR1cmU7XG4gICAgcG9zdGNzcyhbXG4gICAgICBjc3NuYW5vKHsgc2FmZTogdHJ1ZSB9KSxcbiAgICBdKS5wcm9jZXNzKGNzc1RleHQsIHtcbiAgICAgIGZyb206IHZvaWQgMCxcbiAgICB9KS50aGVuKHJlc3VsdCA9PiB7XG4gICAgICBmLnJldHVybihyZXN1bHQuY3NzKTtcbiAgICB9KS5jYXRjaChlcnJvciA9PiB7XG4gICAgICBmLnRocm93KGVycm9yKTtcbiAgICB9KTtcbiAgICBjb25zdCBtaW5pZmllZENzcyA9IGYud2FpdCgpO1xuXG4gICAgLy8gU2luY2UgdGhpcyBmdW5jdGlvbiBoYXMgYWx3YXlzIHJldHVybmVkIGFuIGFycmF5LCB3ZSdsbCB3cmFwIHRoZVxuICAgIC8vIG1pbmlmaWVkIGNzcyBzdHJpbmcgaW4gYW4gYXJyYXkgYmVmb3JlIHJldHVybmluZywgZXZlbiB0aG91Z2ggd2UncmVcbiAgICAvLyBvbmx5IGV2ZXIgcmV0dXJuaW5nIG9uZSBtaW5pZmllZCBjc3Mgc3RyaW5nIGluIHRoYXQgYXJyYXkgKG1haW50YWluaW5nXG4gICAgLy8gYmFja3dhcmRzIGNvbXBhdGliaWxpdHkpLlxuICAgIHJldHVybiBbbWluaWZpZWRDc3NdO1xuICB9LFxuXG4gIC8qKlxuICAgKiBNZXJnZSBtdWx0aXBsZSBDU1MgQVNUJ3MgaW50byBvbmUuXG4gICAqXG4gICAqIEBwYXJhbSB7cG9zdGNzcyNSb290W119IGNzc0FzdHMgQXJyYXkgb2YgUG9zdENTUyBSb290IG9iamVjdHMuXG4gICAqIEBjYWxsYmFjayB3YXJuQ2IgQ2FsbGJhY2sgdXNlZCB0byBoYW5kbGUgd2FybmluZyBtZXNzYWdlcy5cbiAgICogQHJldHVybiB7cG9zdGNzcyNSb290fSBQb3N0Q1NTIFJvb3Qgb2JqZWN0LlxuICAgKi9cbiAgbWVyZ2VDc3NBc3RzKGNzc0FzdHMsIHdhcm5DYikge1xuICAgIGNvbnN0IHJ1bGVzUHJlZGljYXRlID0gKHJ1bGVzLCBleGNsdWRlID0gZmFsc2UpID0+IHtcbiAgICAgIGlmICghIEFycmF5LmlzQXJyYXkocnVsZXMpKSB7XG4gICAgICAgIHJ1bGVzID0gW3J1bGVzXTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBub2RlID0+IHtcbiAgICAgICAgLy8gUG9zdENTUyBBdFJ1bGUgbm9kZXMgaGF2ZSBgdHlwZTogJ2F0cnVsZSdgIGFuZCBhIGRlc2NyaXB0aXZlIG5hbWUsXG4gICAgICAgIC8vIGUuZy4gJ2ltcG9ydCcgb3IgJ2NoYXJzZXQnLCB3aGlsZSBDb21tZW50IG5vZGVzIGhhdmUgdHlwZSBvbmx5LlxuICAgICAgICBjb25zdCBub2RlTWF0Y2hlc1J1bGUgPSBydWxlcy5pbmNsdWRlcyhub2RlLm5hbWUgfHwgbm9kZS50eXBlKTtcblxuICAgICAgICByZXR1cm4gZXhjbHVkZSA/ICFub2RlTWF0Y2hlc1J1bGUgOiBub2RlTWF0Y2hlc1J1bGU7XG4gICAgICB9XG4gICAgfTtcblxuICAgIC8vIFNpbXBsZSBjb25jYXRlbmF0aW9uIG9mIENTUyBmaWxlcyB3b3VsZCBicmVhayBAaW1wb3J0IHJ1bGVzXG4gICAgLy8gbG9jYXRlZCBpbiB0aGUgYmVnaW5uaW5nIG9mIGEgZmlsZS4gQmVmb3JlIGNvbmNhdGVuYXRpb24sIHB1bGxcbiAgICAvLyBAaW1wb3J0IHJ1bGVzIHRvIHRoZSBiZWdpbm5pbmcgb2YgYSBuZXcgc3ludGF4IHRyZWUgc28gdGhleSBhbHdheXNcbiAgICAvLyBwcmVjZWRlIG90aGVyIHJ1bGVzLlxuICAgIGNvbnN0IG5ld0FzdCA9IHBvc3Rjc3Mucm9vdCgpO1xuXG4gICAgY3NzQXN0cy5mb3JFYWNoKChhc3QpID0+IHtcbiAgICAgIGlmIChhc3Qubm9kZXMpIHtcbiAgICAgICAgLy8gUGljayBvbmx5IHRoZSBpbXBvcnRzIGZyb20gdGhlIGJlZ2lubmluZyBvZiBmaWxlIGlnbm9yaW5nIEBjaGFyc2V0XG4gICAgICAgIC8vIHJ1bGVzIGFzIGV2ZXJ5IGZpbGUgaXMgYXNzdW1lZCB0byBiZSBpbiBVVEYtOC5cbiAgICAgICAgY29uc3QgY2hhcnNldFJ1bGVzID0gYXN0Lm5vZGVzLmZpbHRlcihydWxlc1ByZWRpY2F0ZSgnY2hhcnNldCcpKTtcblxuICAgICAgICBpZiAoY2hhcnNldFJ1bGVzLnNvbWUoKHJ1bGUpID0+IHtcbiAgICAgICAgICAvLyBBY2NvcmRpbmcgdG8gTUROLCBvbmx5ICdVVEYtOCcgYW5kIFwiVVRGLThcIiBhcmUgdGhlIGNvcnJlY3RcbiAgICAgICAgICAvLyBlbmNvZGluZyBkaXJlY3RpdmVzIHJlcHJlc2VudGluZyBVVEYtOC5cbiAgICAgICAgICByZXR1cm4gISAvXihbJ1wiXSlVVEYtOFxcMSQvLnRlc3QocnVsZS5wYXJhbXMpO1xuICAgICAgICB9KSkge1xuICAgICAgICAgIHdhcm5DYihcbiAgICAgICAgICAgIGFzdC5maWxlbmFtZSxcbiAgICAgICAgICAgICdAY2hhcnNldCBydWxlcyBpbiB0aGlzIGZpbGUgd2lsbCBiZSBpZ25vcmVkIGFzIFVURi04IGlzIHRoZSAnICtcbiAgICAgICAgICAgICdvbmx5IGVuY29kaW5nIHN1cHBvcnRlZCdcbiAgICAgICAgICApO1xuICAgICAgICB9XG5cbiAgICAgICAgYXN0Lm5vZGVzID0gYXN0Lm5vZGVzLmZpbHRlcihydWxlc1ByZWRpY2F0ZSgnY2hhcnNldCcsIHRydWUpKTtcbiAgICAgICAgbGV0IGltcG9ydENvdW50ID0gMDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhc3Qubm9kZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBpZiAoISBydWxlc1ByZWRpY2F0ZShbJ2ltcG9ydCcsICdjb21tZW50J10pKGFzdC5ub2Rlc1tpXSkpIHtcbiAgICAgICAgICAgIGltcG9ydENvdW50ID0gaTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIENzc1Rvb2xzLnJld3JpdGVDc3NVcmxzKGFzdCk7XG5cbiAgICAgICAgY29uc3QgaW1wb3J0cyA9IGFzdC5ub2Rlcy5zcGxpY2UoMCwgaW1wb3J0Q291bnQpO1xuICAgICAgICBuZXdBc3Qubm9kZXMucHVzaCguLi5pbXBvcnRzKTtcblxuICAgICAgICAvLyBJZiB0aGVyZSBhcmUgaW1wb3J0cyBsZWZ0IGluIHRoZSBtaWRkbGUgb2YgYSBmaWxlLCB3YXJuIHVzZXJzIGFzIGl0XG4gICAgICAgIC8vIG1pZ2h0IGJlIGEgcG90ZW50aWFsIGJ1ZyAoaW1wb3J0cyBhcmUgb25seSB2YWxpZCBhdCB0aGUgYmVnaW5uaW5nIG9mXG4gICAgICAgIC8vIGEgZmlsZSkuXG4gICAgICAgIGlmIChhc3Qubm9kZXMuc29tZShydWxlc1ByZWRpY2F0ZSgnaW1wb3J0JykpKSB7XG4gICAgICAgICAgd2FybkNiKFxuICAgICAgICAgICAgYXN0LmZpbGVuYW1lLFxuICAgICAgICAgICAgJ1RoZXJlIGFyZSBzb21lIEBpbXBvcnQgcnVsZXMgaW4gdGhlIG1pZGRsZSBvZiBhIGZpbGUuIFRoaXMgJyArXG4gICAgICAgICAgICAnbWlnaHQgYmUgYSBidWcsIGFzIGltcG9ydHMgYXJlIG9ubHkgdmFsaWQgYXQgdGhlIGJlZ2lubmluZyBvZiAnICtcbiAgICAgICAgICAgICdhIGZpbGUuJ1xuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIE5vdyB3ZSBjYW4gcHV0IHRoZSByZXN0IG9mIENTUyBydWxlcyBpbnRvIG5ldyBBU1QuXG4gICAgY3NzQXN0cy5mb3JFYWNoKChhc3QpID0+IHtcbiAgICAgIGlmIChhc3Qubm9kZXMpIHtcbiAgICAgICAgbmV3QXN0Lm5vZGVzLnB1c2goLi4uYXN0Lm5vZGVzKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHJldHVybiBuZXdBc3Q7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFdlIGFyZSBsb29raW5nIGZvciBhbGwgcmVsYXRpdmUgdXJscyBkZWZpbmVkIHdpdGggdGhlIGB1cmwoKWAgZnVuY3Rpb25hbFxuICAgKiBub3RhdGlvbiBhbmQgcmV3cml0aW5nIHRoZW0gdG8gdGhlIGVxdWl2YWxlbnQgYWJzb2x1dGUgdXJsIHVzaW5nIHRoZVxuICAgKiBgc291cmNlYCBwYXRoIHByb3ZpZGVkIGJ5IHBvc3Rjc3MuIEZvciBwZXJmb3JtYW5jZSByZWFzb25zIHRoaXMgZnVuY3Rpb25cbiAgICogYWN0cyBieSBzaWRlIGVmZmVjdCBieSBtb2RpZnlpbmcgdGhlIGdpdmVuIEFTVCB3aXRob3V0IGRvaW5nIGEgZGVlcCBjb3B5LlxuICAgKlxuICAgKiBAcGFyYW0ge3Bvc3Rjc3MjUm9vdH0gYXN0IFBvc3RDU1MgUm9vdCBvYmplY3QuXG4gICAqIEByZXR1cm4gTW9kaWZpZXMgdGhlIGFzdCBwYXJhbSBpbiBwbGFjZS5cbiAgICovXG4gIHJld3JpdGVDc3NVcmxzKGFzdCkge1xuICAgIGNvbnN0IG1lcmdlZENzc1BhdGggPSAnLyc7XG4gICAgcmV3cml0ZVJ1bGVzKGFzdC5ub2RlcywgbWVyZ2VkQ3NzUGF0aCk7XG4gIH1cbn07XG5cbmlmICh0eXBlb2YgUHJvZmlsZSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgW1xuICAgICdwYXJzZUNzcycsXG4gICAgJ3N0cmluZ2lmeUNzcycsXG4gICAgJ21pbmlmeUNzcycsXG4gICAgJ21lcmdlQ3NzQXN0cycsXG4gICAgJ3Jld3JpdGVDc3NVcmxzJyxcbiAgXS5mb3JFYWNoKGZ1bmNOYW1lID0+IHtcbiAgICBDc3NUb29sc1tmdW5jTmFtZV0gPSBQcm9maWxlKGBDc3NUb29scy4ke2Z1bmNOYW1lfWAsIENzc1Rvb2xzW2Z1bmNOYW1lXSk7XG4gIH0pO1xufVxuXG5leHBvcnQgeyBDc3NUb29scyB9O1xuXG5jb25zdCBoYXNPd24gPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xuXG5jb25zdCByZXdyaXRlUnVsZXMgPSAocnVsZXMsIG1lcmdlZENzc1BhdGgpID0+IHtcbiAgcnVsZXMuZm9yRWFjaCgocnVsZSkgPT4ge1xuICAgIC8vIFJlY3Vyc2UgaWYgdGhlcmUgYXJlIHN1Yi1ydWxlcy4gQW4gZXhhbXBsZTpcbiAgICAvLyAgICAgQG1lZGlhICguLi4pIHtcbiAgICAvLyAgICAgICAgIC5ydWxlIHsgdXJsKC4uLik7IH1cbiAgICAvLyAgICAgfVxuICAgIGlmIChoYXNPd24uY2FsbChydWxlLCAnbm9kZXMnKSkge1xuICAgICAgcmV3cml0ZVJ1bGVzKHJ1bGUubm9kZXMsIG1lcmdlZENzc1BhdGgpO1xuICAgIH1cblxuICAgIGNvbnN0IGFwcERpciA9IHByb2Nlc3MuY3dkKCk7XG4gICAgY29uc3Qgc291cmNlRmlsZSA9IHJ1bGUuc291cmNlLmlucHV0LmZpbGU7XG4gICAgY29uc3Qgc291cmNlRmlsZUZyb21BcHBSb290ID1cbiAgICAgIHNvdXJjZUZpbGUgPyBzb3VyY2VGaWxlLnJlcGxhY2UoYXBwRGlyLCAnJykgOiAnJztcbiAgICBsZXQgYmFzZVBhdGggPSBwYXRoSm9pbignLycsIHBhdGhEaXJuYW1lKHNvdXJjZUZpbGVGcm9tQXBwUm9vdCkpO1xuXG4gICAgLy8gU2V0IHRoZSBjb3JyZWN0IGJhc2VQYXRoIGJhc2VkIG9uIGhvdyB0aGUgbGlua2VkIGFzc2V0IHdpbGwgYmUgc2VydmVkLlxuICAgIC8vIFhYWCBUaGlzIGlzIHdyb25nLiBXZSBhcmUgY291cGxpbmcgdGhlIGluZm9ybWF0aW9uIGFib3V0IGhvdyBmaWxlcyB3aWxsXG4gICAgLy8gYmUgc2VydmVkIGJ5IHRoZSB3ZWIgc2VydmVyIHRvIHRoZSBpbmZvcm1hdGlvbiBob3cgdGhleSB3ZXJlIHN0b3JlZFxuICAgIC8vIG9yaWdpbmFsbHkgb24gdGhlIGZpbGVzeXN0ZW0gaW4gdGhlIHByb2plY3Qgc3RydWN0dXJlLiBJZGVhbGx5LCB0aGVyZVxuICAgIC8vIHNob3VsZCBiZSBzb21lIG1vZHVsZSB0aGF0IHRlbGxzIHVzIHByZWNpc2VseSBob3cgZWFjaCBhc3NldCB3aWxsIGJlXG4gICAgLy8gc2VydmVkIGJ1dCBmb3Igbm93IHdlIGFyZSBqdXN0IGFzc3VtaW5nIHRoYXQgZXZlcnl0aGluZyB0aGF0IGNvbWVzIGZyb21cbiAgICAvLyBhIGZvbGRlciBzdGFydGluZyB3aXRoIFwiL3BhY2thZ2VzL1wiIGlzIHNlcnZlZCBvbiB0aGUgc2FtZSBwYXRoIGFzXG4gICAgLy8gaXQgd2FzIG9uIHRoZSBmaWxlc3lzdGVtIGFuZCBldmVyeXRoaW5nIGVsc2UgaXMgc2VydmVkIG9uIHJvb3QgXCIvXCIuXG4gICAgaWYgKCEgYmFzZVBhdGgubWF0Y2goL15cXC8/cGFja2FnZXNcXC8vaSkpIHtcbiAgICAgIGJhc2VQYXRoID0gXCIvXCI7XG4gICAgfVxuXG4gICAgbGV0IHZhbHVlID0gcnVsZS52YWx1ZTtcblxuICAgIC8vIE1hdGNoIGNzcyB2YWx1ZXMgY29udGFpbmluZyBzb21lIGZ1bmN0aW9uYWwgY2FsbHMgdG8gYHVybChVUkkpYCB3aGVyZVxuICAgIC8vIFVSSSBpcyBvcHRpb25hbGx5IHF1b3RlZC5cbiAgICAvLyBOb3RlIHRoYXQgYSBjc3MgdmFsdWUgY2FuIGNvbnRhaW5zIG90aGVyIGVsZW1lbnRzLCBmb3IgaW5zdGFuY2U6XG4gICAgLy8gICBiYWNrZ3JvdW5kOiB0b3AgY2VudGVyIHVybChcImJhY2tncm91bmQucG5nXCIpIGJsYWNrO1xuICAgIC8vIG9yIGV2ZW4gbXVsdGlwbGUgdXJsKCksIGZvciBpbnN0YW5jZSBmb3IgbXVsdGlwbGUgYmFja2dyb3VuZHMuXG4gICAgdmFyIGNzc1VybFJlZ2V4ID0gL3VybFxccypcXChcXHMqKFsnXCJdPykoLis/KVxcMVxccypcXCkvZ2k7XG4gICAgbGV0IHBhcnRzO1xuICAgIHdoaWxlIChwYXJ0cyA9IGNzc1VybFJlZ2V4LmV4ZWModmFsdWUpKSB7XG4gICAgICBjb25zdCBvbGRDc3NVcmwgPSBwYXJ0c1swXTtcbiAgICAgIGNvbnN0IHF1b3RlID0gcGFydHNbMV07XG4gICAgICBjb25zdCByZXNvdXJjZSA9IHVybC5wYXJzZShwYXJ0c1syXSk7XG5cbiAgICAgIC8vIFdlIGRvbid0IHJld3JpdGUgVVJMcyBzdGFydGluZyB3aXRoIGEgcHJvdG9jb2wgZGVmaW5pdGlvbiBzdWNoIGFzXG4gICAgICAvLyBodHRwLCBodHRwcywgb3IgZGF0YSwgb3IgdGhvc2Ugd2l0aCBuZXR3b3JrLXBhdGggcmVmZXJlbmNlc1xuICAgICAgLy8gaS5lLiAvL2ltZy5kb21haW4uY29tL2NhdC5naWZcbiAgICAgIGlmIChyZXNvdXJjZS5wcm90b2NvbCAhPT0gbnVsbCB8fFxuICAgICAgICAgIHJlc291cmNlLmhyZWYuc3RhcnRzV2l0aCgnLy8nKSB8fFxuICAgICAgICAgIHJlc291cmNlLmhyZWYuc3RhcnRzV2l0aCgnIycpKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICAvLyBSZXdyaXRlIHJlbGF0aXZlIHBhdGhzICh0aGF0IHJlZmVycyB0byB0aGUgaW50ZXJuYWwgYXBwbGljYXRpb24gdHJlZSlcbiAgICAgIC8vIHRvIGFic29sdXRlIHBhdGhzIChhZGRyZXNzYWJsZSBmcm9tIHRoZSBwdWJsaWMgYnVpbGQpLlxuICAgICAgbGV0IGFic29sdXRlUGF0aCA9IGlzUmVsYXRpdmUocmVzb3VyY2UucGF0aClcbiAgICAgICAgPyBwYXRoSm9pbihiYXNlUGF0aCwgcmVzb3VyY2UucGF0aClcbiAgICAgICAgOiByZXNvdXJjZS5wYXRoO1xuXG4gICAgICBpZiAocmVzb3VyY2UuaGFzaCkge1xuICAgICAgICBhYnNvbHV0ZVBhdGggKz0gcmVzb3VyY2UuaGFzaDtcbiAgICAgIH1cblxuICAgICAgLy8gV2UgdXNlZCB0byBmaW5pc2ggdGhlIHJld3JpdGluZyBwcm9jZXNzIGF0IHRoZSBhYnNvbHV0ZSBwYXRoIHN0ZXBcbiAgICAgIC8vIGFib3ZlLiBCdXQgaXQgZGlkbid0IHdvcmsgaW4gY2FzZSB0aGUgTWV0ZW9yIGFwcGxpY2F0aW9uIHdhcyBkZXBsb3llZFxuICAgICAgLy8gdW5kZXIgYSBzdWItcGF0aCAoZWcgYFJPT1RfVVJMPWh0dHA6Ly9sb2NhbGhvc3Q6MzAwMC9teWFwcCBtZXRlb3JgKVxuICAgICAgLy8gaW4gd2hpY2ggY2FzZSB0aGUgcmVzb3VyY2VzIGxpbmtlZCBpbiB0aGUgbWVyZ2VkIENTUyBmaWxlIHdvdWxkIG1pc3NcbiAgICAgIC8vIHRoZSBgbXlhcHAvYCBwcmVmaXguIFNpbmNlIHRoaXMgcGF0aCBwcmVmaXggaXMgb25seSBrbm93biBhdCBsYXVuY2hcbiAgICAgIC8vIHRpbWUgKHJhdGhlciB0aGFuIGJ1aWxkIHRpbWUpIHdlIGNhbid0IHVzZSBhYnNvbHV0ZSBwYXRocyB0byBsaW5rXG4gICAgICAvLyByZXNvdXJjZXMgaW4gdGhlIGdlbmVyYXRlZCBDU1MuXG4gICAgICAvL1xuICAgICAgLy8gSW5zdGVhZCB3ZSB0cmFuc2Zvcm0gYWJzb2x1dGUgcGF0aHMgdG8gbWFrZSB0aGVtIHJlbGF0aXZlIHRvIHRoZVxuICAgICAgLy8gbWVyZ2VkIENTUywgbGVhdmluZyB0byB0aGUgYnJvd3NlciB0aGUgcmVzcG9uc2liaWxpdHkgdG8gY2FsY3VsYXRlXG4gICAgICAvLyB0aGUgZmluYWwgcmVzb3VyY2UgbGlua3MgKGJ5IGFkZGluZyB0aGUgYXBwbGljYXRpb24gZGVwbG95bWVudFxuICAgICAgLy8gcHJlZml4LCBoZXJlIGBteWFwcC9gLCBpZiBhcHBsaWNhYmxlKS5cbiAgICAgIGNvbnN0IHJlbGF0aXZlVG9NZXJnZWRDc3MgPSBwYXRoUmVsYXRpdmUobWVyZ2VkQ3NzUGF0aCwgYWJzb2x1dGVQYXRoKTtcbiAgICAgIGNvbnN0IG5ld0Nzc1VybCA9IGB1cmwoJHtxdW90ZX0ke3JlbGF0aXZlVG9NZXJnZWRDc3N9JHtxdW90ZX0pYDtcbiAgICAgIHZhbHVlID0gdmFsdWUucmVwbGFjZShvbGRDc3NVcmwsIG5ld0Nzc1VybCk7XG4gICAgfVxuXG4gICAgcnVsZS52YWx1ZSA9IHZhbHVlO1xuICB9KTtcbn07XG5cbmNvbnN0IGlzUmVsYXRpdmUgPSBwYXRoID0+IHBhdGggJiYgcGF0aC5jaGFyQXQoMCkgIT09ICcvJztcblxuLy8gVGhlc2UgYXJlIGR1cGxpY2F0ZXMgb2YgZnVuY3Rpb25zIGluIHRvb2xzL2ZpbGVzLmpzLCBiZWNhdXNlIHdlIGRvbid0IGhhdmVcbi8vIGEgZ29vZCB3YXkgb2YgZXhwb3J0aW5nIHRoZW0gaW50byBwYWNrYWdlcy5cbi8vIFhYWCBkZWR1cGxpY2F0ZSBmaWxlcy5qcyBpbnRvIGEgcGFja2FnZSBhdCBzb21lIHBvaW50IHNvIHRoYXQgd2UgY2FuIHVzZSBpdFxuLy8gaW4gY29yZVxuY29uc3QgdG9PU1BhdGggPVxuICBwID0+IHByb2Nlc3MucGxhdGZvcm0gPT09ICd3aW4zMicgPyBwLnJlcGxhY2UoL1xcLy9nLCAnXFxcXCcpIDogcDtcbmNvbnN0IHRvU3RhbmRhcmRQYXRoID1cbiAgcCA9PiBwcm9jZXNzLnBsYXRmb3JtID09PSAnd2luMzInID8gcC5yZXBsYWNlKC9cXFxcL2csICcvJykgOiBwO1xuY29uc3QgcGF0aEpvaW4gPVxuICAoYSwgYikgPT4gdG9TdGFuZGFyZFBhdGgocGF0aC5qb2luKHRvT1NQYXRoKGEpLCB0b09TUGF0aChiKSkpO1xuY29uc3QgcGF0aERpcm5hbWUgPVxuICBwID0+IHRvU3RhbmRhcmRQYXRoKHBhdGguZGlybmFtZSh0b09TUGF0aChwKSkpO1xuY29uc3QgcGF0aFJlbGF0aXZlID1cbiAgKHAxLCBwMikgPT4gdG9TdGFuZGFyZFBhdGgocGF0aC5yZWxhdGl2ZSh0b09TUGF0aChwMSksIHRvT1NQYXRoKHAyKSkpO1xuIl19
