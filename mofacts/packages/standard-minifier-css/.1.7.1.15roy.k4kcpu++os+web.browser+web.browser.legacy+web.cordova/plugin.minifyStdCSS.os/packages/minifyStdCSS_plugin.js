(function () {

/* Imports */
var CssTools = Package['minifier-css'].CssTools;
var ECMAScript = Package.ecmascript.ECMAScript;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

var require = meteorInstall({"node_modules":{"meteor":{"minifyStdCSS":{"plugin":{"minify-css.js":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                   //
// packages/minifyStdCSS/plugin/minify-css.js                                                        //
//                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                     //
let sourcemap;
module.link("source-map", {
  default(v) {
    sourcemap = v;
  }

}, 0);
let createHash;
module.link("crypto", {
  createHash(v) {
    createHash = v;
  }

}, 1);
let LRU;
module.link("lru-cache", {
  default(v) {
    LRU = v;
  }

}, 2);
Plugin.registerMinifier({
  extensions: ["css"],
  archMatching: "web"
}, function () {
  const minifier = new CssToolsMinifier();
  return minifier;
});

class CssToolsMinifier {
  processFilesForBundle(files, options) {
    return Promise.asyncApply(() => {
      const mode = options.minifyMode;
      if (!files.length) return;
      const merged = Promise.await(mergeCss(files));

      if (mode === 'development') {
        files[0].addStylesheet({
          data: merged.code,
          sourceMap: merged.sourceMap,
          path: 'merged-stylesheets.css'
        });
        return;
      }

      const minifiedFiles = CssTools.minifyCss(merged.code);

      if (files.length) {
        minifiedFiles.forEach(function (minified) {
          files[0].addStylesheet({
            data: minified
          });
        });
      }
    });
  }

}

const mergeCache = new LRU({
  max: 100
});
const hashFiles = Profile("hashFiles", function (files) {
  const hash = createHash("sha1");
  files.forEach(f => {
    hash.update(f.getSourceHash()).update("\0");
  });
  return hash.digest("hex");
});

function disableSourceMappingURLs(css) {
  return css.replace(/# sourceMappingURL=/g, "# sourceMappingURL_DISABLED=");
} // Lints CSS files and merges them into one file, fixing up source maps and
// pulling any @import directives up to the top since the CSS spec does not
// allow them to appear in the middle of a file.


const mergeCss = Profile("mergeCss", function (css) {
  return Promise.asyncApply(() => {
    const hashOfFiles = hashFiles(css);
    let merged = mergeCache.get(hashOfFiles);

    if (merged) {
      return merged;
    } // Filenames passed to AST manipulator mapped to their original files


    const originals = {};
    const cssAsts = css.map(function (file) {
      const filename = file.getPathInBundle();
      originals[filename] = file;
      let ast;

      try {
        const parseOptions = {
          source: filename,
          position: true
        };
        const css = disableSourceMappingURLs(file.getContentsAsString());
        ast = CssTools.parseCss(css, parseOptions);
        ast.filename = filename;
      } catch (e) {
        if (e.reason) {
          file.error({
            message: e.reason,
            line: e.line,
            column: e.column
          });
        } else {
          // Just in case it's not the normal error the library makes.
          file.error({
            message: e.message
          });
        }

        return {
          type: "stylesheet",
          stylesheet: {
            rules: []
          },
          filename
        };
      }

      return ast;
    });

    const warnCb = (filename, msg) => {
      // XXX make this a buildmessage.warning call rather than a random log.
      //     this API would be like buildmessage.error, but wouldn't cause
      //     the build to fail.
      console.log("".concat(filename, ": warn: ").concat(msg));
    };

    const mergedCssAst = CssTools.mergeCssAsts(cssAsts, warnCb); // Overwrite the CSS files list with the new concatenated file

    const stringifiedCss = CssTools.stringifyCss(mergedCssAst, {
      sourcemap: true,
      // don't try to read the referenced sourcemaps from the input
      inputSourcemaps: false
    });

    if (!stringifiedCss.code) {
      mergeCache.set(hashOfFiles, merged = {
        code: ''
      });
      return merged;
    } // Add the contents of the input files to the source map of the new file


    stringifiedCss.map.sourcesContent = stringifiedCss.map.sources.map(function (filename) {
      const file = originals[filename] || null;
      return file && file.getContentsAsString();
    }); // Compose the concatenated file's source map with source maps from the
    // previous build step if necessary.

    const newMap = Promise.await(Profile.time("composing source maps", function () {
      return Promise.asyncApply(() => {
        const newMap = new sourcemap.SourceMapGenerator();
        const concatConsumer = Promise.await(new sourcemap.SourceMapConsumer(stringifiedCss.map)); // Create a dictionary of source map consumers for fast access

        const consumers = Object.create(null);
        Promise.await(Promise.all(Object.entries(originals).map((_ref) => Promise.asyncApply(() => {
          let [name, file] = _ref;
          const sourceMap = file.getSourceMap();

          if (sourceMap) {
            try {
              consumers[name] = Promise.await(new sourcemap.SourceMapConsumer(sourceMap));
            } catch (err) {// If we can't apply the source map, silently drop it.
              //
              // XXX This is here because there are some less files that
              // produce source maps that throw when consumed. We should
              // figure out exactly why and fix it, but this will do for now.
            }
          }
        })))); // Maps each original source file name to the SourceMapConsumer that
        // can provide its content.

        const sourceToConsumerMap = Object.create(null); // Find mappings from the concatenated file back to the original files

        concatConsumer.eachMapping(mapping => {
          let {
            source
          } = mapping;
          const consumer = consumers[source];
          let original = {
            line: mapping.originalLine,
            column: mapping.originalColumn
          }; // If there is a source map for the original file, e.g., if it has been
          // compiled from Less to CSS, find the source location in the original's
          // original file. Otherwise, use the mapping of the concatenated file's
          // source map.

          if (consumer) {
            const newOriginal = consumer.originalPositionFor(original); // Finding the original position should always be possible (otherwise,
            // one of the source maps would have incorrect mappings). However, in
            // case there is something wrong, use the intermediate mapping.

            if (newOriginal.source !== null) {
              original = newOriginal;
              source = original.source;

              if (source) {
                // Since the new consumer provided a different
                // original.source, we should ask it for the original source
                // content instead of asking the concatConsumer.
                sourceToConsumerMap[source] = consumer;
              }
            }
          }

          if (source && !sourceToConsumerMap[source]) {
            // If we didn't set sourceToConsumerMap[source] = consumer above,
            // use the concatConsumer to determine the original content.
            sourceToConsumerMap[source] = concatConsumer;
          } // Add a new mapping to the final source map


          newMap.addMapping({
            generated: {
              line: mapping.generatedLine,
              column: mapping.generatedColumn
            },
            original,
            source
          });
        }); // The consumer.sourceContentFor and newMap.setSourceContent methods
        // are relatively fast, but not entirely trivial, so it's better to
        // call them only once per source, rather than calling them every time
        // we call newMap.addMapping in the loop above.

        Object.entries(sourceToConsumerMap).forEach((_ref2) => {
          let [source, consumer] = _ref2;
          const content = consumer.sourceContentFor(source);
          newMap.setSourceContent(source, content);
        });
        concatConsumer.destroy();
        Object.values(consumers).forEach(consumer => consumer.destroy());
        return newMap;
      });
    }));
    mergeCache.set(hashOfFiles, merged = {
      code: stringifiedCss.code,
      sourceMap: newMap.toString()
    });
    return merged;
  });
});
///////////////////////////////////////////////////////////////////////////////////////////////////////

}},"node_modules":{"source-map":{"package.json":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                   //
// node_modules/meteor/minifyStdCSS/node_modules/source-map/package.json                             //
//                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                     //
module.exports = {
  "name": "source-map",
  "version": "0.7.3",
  "main": "./source-map.js"
};

///////////////////////////////////////////////////////////////////////////////////////////////////////

},"source-map.js":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                   //
// node_modules/meteor/minifyStdCSS/node_modules/source-map/source-map.js                            //
//                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                     //
module.useNode();
///////////////////////////////////////////////////////////////////////////////////////////////////////

}},"lru-cache":{"package.json":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                   //
// node_modules/meteor/minifyStdCSS/node_modules/lru-cache/package.json                              //
//                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                     //
module.exports = {
  "name": "lru-cache",
  "version": "6.0.0",
  "main": "index.js"
};

///////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                   //
// node_modules/meteor/minifyStdCSS/node_modules/lru-cache/index.js                                  //
//                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                     //
module.useNode();
///////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});

require("/node_modules/meteor/minifyStdCSS/plugin/minify-css.js");

/* Exports */
Package._define("minifyStdCSS");

})();




//# sourceURL=meteor://💻app/packages/minifyStdCSS_plugin.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvbWluaWZ5U3RkQ1NTL3BsdWdpbi9taW5pZnktY3NzLmpzIl0sIm5hbWVzIjpbInNvdXJjZW1hcCIsIm1vZHVsZSIsImxpbmsiLCJkZWZhdWx0IiwidiIsImNyZWF0ZUhhc2giLCJMUlUiLCJQbHVnaW4iLCJyZWdpc3Rlck1pbmlmaWVyIiwiZXh0ZW5zaW9ucyIsImFyY2hNYXRjaGluZyIsIm1pbmlmaWVyIiwiQ3NzVG9vbHNNaW5pZmllciIsInByb2Nlc3NGaWxlc0ZvckJ1bmRsZSIsImZpbGVzIiwib3B0aW9ucyIsIm1vZGUiLCJtaW5pZnlNb2RlIiwibGVuZ3RoIiwibWVyZ2VkIiwibWVyZ2VDc3MiLCJhZGRTdHlsZXNoZWV0IiwiZGF0YSIsImNvZGUiLCJzb3VyY2VNYXAiLCJwYXRoIiwibWluaWZpZWRGaWxlcyIsIkNzc1Rvb2xzIiwibWluaWZ5Q3NzIiwiZm9yRWFjaCIsIm1pbmlmaWVkIiwibWVyZ2VDYWNoZSIsIm1heCIsImhhc2hGaWxlcyIsIlByb2ZpbGUiLCJoYXNoIiwiZiIsInVwZGF0ZSIsImdldFNvdXJjZUhhc2giLCJkaWdlc3QiLCJkaXNhYmxlU291cmNlTWFwcGluZ1VSTHMiLCJjc3MiLCJyZXBsYWNlIiwiaGFzaE9mRmlsZXMiLCJnZXQiLCJvcmlnaW5hbHMiLCJjc3NBc3RzIiwibWFwIiwiZmlsZSIsImZpbGVuYW1lIiwiZ2V0UGF0aEluQnVuZGxlIiwiYXN0IiwicGFyc2VPcHRpb25zIiwic291cmNlIiwicG9zaXRpb24iLCJnZXRDb250ZW50c0FzU3RyaW5nIiwicGFyc2VDc3MiLCJlIiwicmVhc29uIiwiZXJyb3IiLCJtZXNzYWdlIiwibGluZSIsImNvbHVtbiIsInR5cGUiLCJzdHlsZXNoZWV0IiwicnVsZXMiLCJ3YXJuQ2IiLCJtc2ciLCJjb25zb2xlIiwibG9nIiwibWVyZ2VkQ3NzQXN0IiwibWVyZ2VDc3NBc3RzIiwic3RyaW5naWZpZWRDc3MiLCJzdHJpbmdpZnlDc3MiLCJpbnB1dFNvdXJjZW1hcHMiLCJzZXQiLCJzb3VyY2VzQ29udGVudCIsInNvdXJjZXMiLCJuZXdNYXAiLCJ0aW1lIiwiU291cmNlTWFwR2VuZXJhdG9yIiwiY29uY2F0Q29uc3VtZXIiLCJTb3VyY2VNYXBDb25zdW1lciIsImNvbnN1bWVycyIsIk9iamVjdCIsImNyZWF0ZSIsIlByb21pc2UiLCJhbGwiLCJlbnRyaWVzIiwibmFtZSIsImdldFNvdXJjZU1hcCIsImVyciIsInNvdXJjZVRvQ29uc3VtZXJNYXAiLCJlYWNoTWFwcGluZyIsIm1hcHBpbmciLCJjb25zdW1lciIsIm9yaWdpbmFsIiwib3JpZ2luYWxMaW5lIiwib3JpZ2luYWxDb2x1bW4iLCJuZXdPcmlnaW5hbCIsIm9yaWdpbmFsUG9zaXRpb25Gb3IiLCJhZGRNYXBwaW5nIiwiZ2VuZXJhdGVkIiwiZ2VuZXJhdGVkTGluZSIsImdlbmVyYXRlZENvbHVtbiIsImNvbnRlbnQiLCJzb3VyY2VDb250ZW50Rm9yIiwic2V0U291cmNlQ29udGVudCIsImRlc3Ryb3kiLCJ2YWx1ZXMiLCJ0b1N0cmluZyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLElBQUlBLFNBQUo7QUFBY0MsTUFBTSxDQUFDQyxJQUFQLENBQVksWUFBWixFQUF5QjtBQUFDQyxTQUFPLENBQUNDLENBQUQsRUFBRztBQUFDSixhQUFTLEdBQUNJLENBQVY7QUFBWTs7QUFBeEIsQ0FBekIsRUFBbUQsQ0FBbkQ7QUFBc0QsSUFBSUMsVUFBSjtBQUFlSixNQUFNLENBQUNDLElBQVAsQ0FBWSxRQUFaLEVBQXFCO0FBQUNHLFlBQVUsQ0FBQ0QsQ0FBRCxFQUFHO0FBQUNDLGNBQVUsR0FBQ0QsQ0FBWDtBQUFhOztBQUE1QixDQUFyQixFQUFtRCxDQUFuRDtBQUFzRCxJQUFJRSxHQUFKO0FBQVFMLE1BQU0sQ0FBQ0MsSUFBUCxDQUFZLFdBQVosRUFBd0I7QUFBQ0MsU0FBTyxDQUFDQyxDQUFELEVBQUc7QUFBQ0UsT0FBRyxHQUFDRixDQUFKO0FBQU07O0FBQWxCLENBQXhCLEVB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U1NfcGx1Z2luLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHNvdXJjZW1hcCBmcm9tIFwic291cmNlLW1hcFwiO1xuaW1wb3J0IHsgY3JlYXRlSGFzaCB9IGZyb20gXCJjcnlwdG9cIjtcbmltcG9ydCBMUlUgZnJvbSBcImxydS1jYWNoZVwiO1xuXG5QbHVnaW4ucmVnaXN0ZXJNaW5pZmllcih7XG4gIGV4dGVuc2lvbnM6IFtcImNzc1wiXSxcbiAgYXJjaE1hdGNoaW5nOiBcIndlYlwiXG59LCBmdW5jdGlvbiAoKSB7XG4gIGNvbnN0IG1pbmlmaWVyID0gbmV3IENzc1Rvb2xzTWluaWZpZXIoKTtcbiAgcmV0dXJuIG1pbmlmaWVyO1xufSk7XG5cbmNsYXNzIENzc1Rvb2xzTWluaWZpZXIge1xuXG4gIGFzeW5jIHByb2Nlc3NGaWxlc0ZvckJ1bmRsZSAoZmlsZXMsIG9wdGlvbnMpIHtcbiAgICBjb25zdCBtb2RlID0gb3B0aW9ucy5taW5pZnlNb2RlO1xuICBcbiAgICBpZiAoISBmaWxlcy5sZW5ndGgpIHJldHVybjtcbiAgXG4gICAgY29uc3QgbWVyZ2VkID0gYXdhaXQgbWVyZ2VDc3MoZmlsZXMpO1xuXG4gICAgaWYgKG1vZGUgPT09ICdkZXZlbG9wbWVudCcpIHtcbiAgICAgIGZpbGVzWzBdLmFkZFN0eWxlc2hlZXQoe1xuICAgIFx0ZGF0YTogbWVyZ2VkLmNvZGUsXG4gICAgICBcdHNvdXJjZU1hcDogbWVyZ2VkLnNvdXJjZU1hcCxcbiAgICAgIFx0cGF0aDogJ21lcmdlZC1zdHlsZXNoZWV0cy5jc3MnXG4gICAgICB9KTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gIFxuICAgIGNvbnN0IG1pbmlmaWVkRmlsZXMgPSBDc3NUb29scy5taW5pZnlDc3MobWVyZ2VkLmNvZGUpO1xuICBcbiAgICBpZiAoZmlsZXMubGVuZ3RoKSB7XG4gICAgICBtaW5pZmllZEZpbGVzLmZvckVhY2goZnVuY3Rpb24gKG1pbmlmaWVkKSB7XG4gICAgICAgIGZpbGVzWzBdLmFkZFN0eWxlc2hlZXQoe1xuICAgICAgICAgIGRhdGE6IG1pbmlmaWVkXG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbn1cblxuXG5jb25zdCBtZXJnZUNhY2hlID0gbmV3IExSVSh7XG4gIG1heDogMTAwXG59KTtcblxuY29uc3QgaGFzaEZpbGVzID0gUHJvZmlsZShcImhhc2hGaWxlc1wiLCBmdW5jdGlvbiAoZmlsZXMpIHtcbiAgY29uc3QgaGFzaCA9IGNyZWF0ZUhhc2goXCJzaGExXCIpO1xuICBmaWxlcy5mb3JFYWNoKGYgPT4ge1xuICAgIGhhc2gudXBkYXRlKGYuZ2V0U291cmNlSGFzaCgpKS51cGRhdGUoXCJcXDBcIik7XG4gIH0pO1xuICByZXR1cm4gaGFzaC5kaWdlc3QoXCJoZXhcIik7XG59KTtcblxuZnVuY3Rpb24gZGlzYWJsZVNvdXJjZU1hcHBpbmdVUkxzKGNzcykge1xuICByZXR1cm4gY3NzLnJlcGxhY2UoLyMgc291cmNlTWFwcGluZ1VSTD0vZyxcbiAgICAgICAgICAgICAgICAgICAgIFwiIyBzb3VyY2VNYXBwaW5nVVJMX0RJU0FCTEVEPVwiKTtcbn1cblxuLy8gTGludHMgQ1NTIGZpbGVzIGFuZCBtZXJnZXMgdGhlbSBpbnRvIG9uZSBmaWxlLCBmaXhpbmcgdXAgc291cmNlIG1hcHMgYW5kXG4vLyBwdWxsaW5nIGFueSBAaW1wb3J0IGRpcmVjdGl2ZXMgdXAgdG8gdGhlIHRvcCBzaW5jZSB0aGUgQ1NTIHNwZWMgZG9lcyBub3Rcbi8vIGFsbG93IHRoZW0gdG8gYXBwZWFyIGluIHRoZSBtaWRkbGUgb2YgYSBmaWxlLlxuY29uc3QgbWVyZ2VDc3MgPSBQcm9maWxlKFwibWVyZ2VDc3NcIiwgYXN5bmMgZnVuY3Rpb24gKGNzcykge1xuICBjb25zdCBoYXNoT2ZGaWxlcyA9IGhhc2hGaWxlcyhjc3MpO1xuICBsZXQgbWVyZ2VkID0gbWVyZ2VDYWNoZS5nZXQoaGFzaE9mRmlsZXMpO1xuICBpZiAobWVyZ2VkKSB7XG4gICAgcmV0dXJuIG1lcmdlZDtcbiAgfVxuXG4gIC8vIEZpbGVuYW1lcyBwYXNzZWQgdG8gQVNUIG1hbmlwdWxhdG9yIG1hcHBlZCB0byB0aGVpciBvcmlnaW5hbCBmaWxlc1xuICBjb25zdCBvcmlnaW5hbHMgPSB7fTtcblxuICBjb25zdCBjc3NBc3RzID0gY3NzLm1hcChmdW5jdGlvbiAoZmlsZSkge1xuICAgIGNvbnN0IGZpbGVuYW1lID0gZmlsZS5nZXRQYXRoSW5CdW5kbGUoKTtcbiAgICBvcmlnaW5hbHNbZmlsZW5hbWVdID0gZmlsZTtcbiAgICBsZXQgYXN0O1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBwYXJzZU9wdGlvbnMgPSB7IHNvdXJjZTogZmlsZW5hbWUsIHBvc2l0aW9uOiB0cnVlIH07XG4gICAgICBjb25zdCBjc3MgPSBkaXNhYmxlU291cmNlTWFwcGluZ1VSTHMoZmlsZS5nZXRDb250ZW50c0FzU3RyaW5nKCkpO1xuICAgICAgYXN0ID0gQ3NzVG9vbHMucGFyc2VDc3MoY3NzLCBwYXJzZU9wdGlvbnMpO1xuICAgICAgYXN0LmZpbGVuYW1lID0gZmlsZW5hbWU7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgaWYgKGUucmVhc29uKSB7XG4gICAgICAgIGZpbGUuZXJyb3Ioe1xuICAgICAgICAgIG1lc3NhZ2U6IGUucmVhc29uLFxuICAgICAgICAgIGxpbmU6IGUubGluZSxcbiAgICAgICAgICBjb2x1bW46IGUuY29sdW1uXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gSnVzdCBpbiBjYXNlIGl0J3Mgbm90IHRoZSBub3JtYWwgZXJyb3IgdGhlIGxpYnJhcnkgbWFrZXMuXG4gICAgICAgIGZpbGUuZXJyb3Ioe21lc3NhZ2U6IGUubWVzc2FnZX0pO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4geyB0eXBlOiBcInN0eWxlc2hlZXRcIiwgc3R5bGVzaGVldDogeyBydWxlczogW10gfSwgZmlsZW5hbWUgfTtcbiAgICB9XG5cbiAgICByZXR1cm4gYXN0O1xuICB9KTtcblxuICBjb25zdCB3YXJuQ2IgPSAoZmlsZW5hbWUsIG1zZykgPT4ge1xuICAgIC8vIFhYWCBtYWtlIHRoaXMgYSBidWlsZG1lc3NhZ2Uud2FybmluZyBjYWxsIHJhdGhlciB0aGFuIGEgcmFuZG9tIGxvZy5cbiAgICAvLyAgICAgdGhpcyBBUEkgd291bGQgYmUgbGlrZSBidWlsZG1lc3NhZ2UuZXJyb3IsIGJ1dCB3b3VsZG4ndCBjYXVzZVxuICAgIC8vICAgICB0aGUgYnVpbGQgdG8gZmFpbC5cbiAgICBjb25zb2xlLmxvZyhgJHtmaWxlbmFtZX06IHdhcm46ICR7bXNnfWApO1xuICB9O1xuXG4gIGNvbnN0IG1lcmdlZENzc0FzdCA9IENzc1Rvb2xzLm1lcmdlQ3NzQXN0cyhjc3NBc3RzLCB3YXJuQ2IpO1xuXG4gIC8vIE92ZXJ3cml0ZSB0aGUgQ1NTIGZpbGVzIGxpc3Qgd2l0aCB0aGUgbmV3IGNvbmNhdGVuYXRlZCBmaWxlXG4gIGNvbnN0IHN0cmluZ2lmaWVkQ3NzID0gQ3NzVG9vbHMuc3RyaW5naWZ5Q3NzKG1lcmdlZENzc0FzdCwge1xuICAgIHNvdXJjZW1hcDogdHJ1ZSxcbiAgICAvLyBkb24ndCB0cnkgdG8gcmVhZCB0aGUgcmVmZXJlbmNlZCBzb3VyY2VtYXBzIGZyb20gdGhlIGlucHV0XG4gICAgaW5wdXRTb3VyY2VtYXBzOiBmYWxzZVxuICB9KTtcblxuICBpZiAoISBzdHJpbmdpZmllZENzcy5jb2RlKSB7XG4gICAgbWVyZ2VDYWNoZS5zZXQoaGFzaE9mRmlsZXMsIG1lcmdlZCA9IHsgY29kZTogJycgfSk7XG4gICAgcmV0dXJuIG1lcmdlZDtcbiAgfVxuXG4gIC8vIEFkZCB0aGUgY29udGVudHMgb2YgdGhlIGlucHV0IGZpbGVzIHRvIHRoZSBzb3VyY2UgbWFwIG9mIHRoZSBuZXcgZmlsZVxuICBzdHJpbmdpZmllZENzcy5tYXAuc291cmNlc0NvbnRlbnQgPVxuICAgIHN0cmluZ2lmaWVkQ3NzLm1hcC5zb3VyY2VzLm1hcChmdW5jdGlvbiAoZmlsZW5hbWUpIHtcbiAgICAgIGNvbnN0IGZpbGUgPSBvcmlnaW5hbHNbZmlsZW5hbWVdIHx8IG51bGw7XG4gICAgICByZXR1cm4gZmlsZSAmJiBmaWxlLmdldENvbnRlbnRzQXNTdHJpbmcoKTtcbiAgICB9KTtcblxuICAvLyBDb21wb3NlIHRoZSBjb25jYXRlbmF0ZWQgZmlsZSdzIHNvdXJjZSBtYXAgd2l0aCBzb3VyY2UgbWFwcyBmcm9tIHRoZVxuICAvLyBwcmV2aW91cyBidWlsZCBzdGVwIGlmIG5lY2Vzc2FyeS5cbiAgY29uc3QgbmV3TWFwID0gYXdhaXQgUHJvZmlsZS50aW1lKFwiY29tcG9zaW5nIHNvdXJjZSBtYXBzXCIsIGFzeW5jIGZ1bmN0aW9uICgpIHtcbiAgICBjb25zdCBuZXdNYXAgPSBuZXcgc291cmNlbWFwLlNvdXJjZU1hcEdlbmVyYXRvcigpO1xuICAgIGNvbnN0IGNvbmNhdENvbnN1bWVyID0gYXdhaXQgbmV3IHNvdXJjZW1hcC5Tb3VyY2VNYXBDb25zdW1lcihzdHJpbmdpZmllZENzcy5tYXApO1xuICAgIC8vIENyZWF0ZSBhIGRpY3Rpb25hcnkgb2Ygc291cmNlIG1hcCBjb25zdW1lcnMgZm9yIGZhc3QgYWNjZXNzXG4gICAgY29uc3QgY29uc3VtZXJzID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblxuICAgIGF3YWl0IFByb21pc2UuYWxsKE9iamVjdC5lbnRyaWVzKG9yaWdpbmFscykubWFwKGFzeW5jIChbbmFtZSwgZmlsZV0pID0+IHtcbiAgICAgIGNvbnN0IHNvdXJjZU1hcCA9IGZpbGUuZ2V0U291cmNlTWFwKCk7XG5cbiAgICAgIGlmIChzb3VyY2VNYXApIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdW1lcnNbbmFtZV0gPSBhd2FpdCBuZXcgc291cmNlbWFwLlNvdXJjZU1hcENvbnN1bWVyKHNvdXJjZU1hcCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgIC8vIElmIHdlIGNhbid0IGFwcGx5IHRoZSBzb3VyY2UgbWFwLCBzaWxlbnRseSBkcm9wIGl0LlxuICAgICAgICAgIC8vXG4gICAgICAgICAgLy8gWFhYIFRoaXMgaXMgaGVyZSBiZWNhdXNlIHRoZXJlIGFyZSBzb21lIGxlc3MgZmlsZXMgdGhhdFxuICAgICAgICAgIC8vIHByb2R1Y2Ugc291cmNlIG1hcHMgdGhhdCB0aHJvdyB3aGVuIGNvbnN1bWVkLiBXZSBzaG91bGRcbiAgICAgICAgICAvLyBmaWd1cmUgb3V0IGV4YWN0bHkgd2h5IGFuZCBmaXggaXQsIGJ1dCB0aGlzIHdpbGwgZG8gZm9yIG5vdy5cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pKTtcblxuICAgIC8vIE1hcHMgZWFjaCBvcmlnaW5hbCBzb3VyY2UgZmlsZSBuYW1lIHRvIHRoZSBTb3VyY2VNYXBDb25zdW1lciB0aGF0XG4gICAgLy8gY2FuIHByb3ZpZGUgaXRzIGNvbnRlbnQuXG4gICAgY29uc3Qgc291cmNlVG9Db25zdW1lck1hcCA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cbiAgICAvLyBGaW5kIG1hcHBpbmdzIGZyb20gdGhlIGNvbmNhdGVuYXRlZCBmaWxlIGJhY2sgdG8gdGhlIG9yaWdpbmFsIGZpbGVzXG4gICAgY29uY2F0Q29uc3VtZXIuZWFjaE1hcHBpbmcoKG1hcHBpbmcpID0+IHtcbiAgICAgIGxldCB7IHNvdXJjZSB9ID0gbWFwcGluZztcbiAgICAgIGNvbnN0IGNvbnN1bWVyID0gY29uc3VtZXJzW3NvdXJjZV07XG5cbiAgICAgIGxldCBvcmlnaW5hbCA9IHtcbiAgICAgICAgbGluZTogbWFwcGluZy5vcmlnaW5hbExpbmUsXG4gICAgICAgIGNvbHVtbjogbWFwcGluZy5vcmlnaW5hbENvbHVtblxuICAgICAgfTtcblxuICAgICAgLy8gSWYgdGhlcmUgaXMgYSBzb3VyY2UgbWFwIGZvciB0aGUgb3JpZ2luYWwgZmlsZSwgZS5nLiwgaWYgaXQgaGFzIGJlZW5cbiAgICAgIC8vIGNvbXBpbGVkIGZyb20gTGVzcyB0byBDU1MsIGZpbmQgdGhlIHNvdXJjZSBsb2NhdGlvbiBpbiB0aGUgb3JpZ2luYWwnc1xuICAgICAgLy8gb3JpZ2luYWwgZmlsZS4gT3RoZXJ3aXNlLCB1c2UgdGhlIG1hcHBpbmcgb2YgdGhlIGNvbmNhdGVuYXRlZCBmaWxlJ3NcbiAgICAgIC8vIHNvdXJjZSBtYXAuXG4gICAgICBpZiAoY29uc3VtZXIpIHtcbiAgICAgICAgY29uc3QgbmV3T3JpZ2luYWwgPSBjb25zdW1lci5vcmlnaW5hbFBvc2l0aW9uRm9yKG9yaWdpbmFsKTtcblxuICAgICAgICAvLyBGaW5kaW5nIHRoZSBvcmlnaW5hbCBwb3NpdGlvbiBzaG91bGQgYWx3YXlzIGJlIHBvc3NpYmxlIChvdGhlcndpc2UsXG4gICAgICAgIC8vIG9uZSBvZiB0aGUgc291cmNlIG1hcHMgd291bGQgaGF2ZSBpbmNvcnJlY3QgbWFwcGluZ3MpLiBIb3dldmVyLCBpblxuICAgICAgICAvLyBjYXNlIHRoZXJlIGlzIHNvbWV0aGluZyB3cm9uZywgdXNlIHRoZSBpbnRlcm1lZGlhdGUgbWFwcGluZy5cbiAgICAgICAgaWYgKG5ld09yaWdpbmFsLnNvdXJjZSAhPT0gbnVsbCkge1xuICAgICAgICAgIG9yaWdpbmFsID0gbmV3T3JpZ2luYWw7XG4gICAgICAgICAgc291cmNlID0gb3JpZ2luYWwuc291cmNlO1xuXG4gICAgICAgICAgaWYgKHNvdXJjZSkge1xuICAgICAgICAgICAgLy8gU2luY2UgdGhlIG5ldyBjb25zdW1lciBwcm92aWRlZCBhIGRpZmZlcmVudFxuICAgICAgICAgICAgLy8gb3JpZ2luYWwuc291cmNlLCB3ZSBzaG91bGQgYXNrIGl0IGZvciB0aGUgb3JpZ2luYWwgc291cmNlXG4gICAgICAgICAgICAvLyBjb250ZW50IGluc3RlYWQgb2YgYXNraW5nIHRoZSBjb25jYXRDb25zdW1lci5cbiAgICAgICAgICAgIHNvdXJjZVRvQ29uc3VtZXJNYXBbc291cmNlXSA9IGNvbnN1bWVyO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoc291cmNlICYmICEgc291cmNlVG9Db25zdW1lck1hcFtzb3VyY2VdKSB7XG4gICAgICAgIC8vIElmIHdlIGRpZG4ndCBzZXQgc291cmNlVG9Db25zdW1lck1hcFtzb3VyY2VdID0gY29uc3VtZXIgYWJvdmUsXG4gICAgICAgIC8vIHVzZSB0aGUgY29uY2F0Q29uc3VtZXIgdG8gZGV0ZXJtaW5lIHRoZSBvcmlnaW5hbCBjb250ZW50LlxuICAgICAgICBzb3VyY2VUb0NvbnN1bWVyTWFwW3NvdXJjZV0gPSBjb25jYXRDb25zdW1lcjtcbiAgICAgIH1cblxuICAgICAgLy8gQWRkIGEgbmV3IG1hcHBpbmcgdG8gdGhlIGZpbmFsIHNvdXJjZSBtYXBcbiAgICAgIG5ld01hcC5hZGRNYXBwaW5nKHtcbiAgICAgICAgZ2VuZXJhdGVkOiB7XG4gICAgICAgICAgbGluZTogbWFwcGluZy5nZW5lcmF0ZWRMaW5lLFxuICAgICAgICAgIGNvbHVtbjogbWFwcGluZy5nZW5lcmF0ZWRDb2x1bW5cbiAgICAgICAgfSxcbiAgICAgICAgb3JpZ2luYWwsXG4gICAgICAgIHNvdXJjZSxcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgLy8gVGhlIGNvbnN1bWVyLnNvdXJjZUNvbnRlbnRGb3IgYW5kIG5ld01hcC5zZXRTb3VyY2VDb250ZW50IG1ldGhvZHNcbiAgICAvLyBhcmUgcmVsYXRpdmVseSBmYXN0LCBidXQgbm90IGVudGlyZWx5IHRyaXZpYWwsIHNvIGl0J3MgYmV0dGVyIHRvXG4gICAgLy8gY2FsbCB0aGVtIG9ubHkgb25jZSBwZXIgc291cmNlLCByYXRoZXIgdGhhbiBjYWxsaW5nIHRoZW0gZXZlcnkgdGltZVxuICAgIC8vIHdlIGNhbGwgbmV3TWFwLmFkZE1hcHBpbmcgaW4gdGhlIGxvb3AgYWJvdmUuXG4gICAgT2JqZWN0LmVudHJpZXMoc291cmNlVG9Db25zdW1lck1hcCkuZm9yRWFjaCgoW3NvdXJjZSwgY29uc3VtZXJdKSA9PiB7XG4gICAgICBjb25zdCBjb250ZW50ID0gY29uc3VtZXIuc291cmNlQ29udGVudEZvcihzb3VyY2UpO1xuICAgICAgbmV3TWFwLnNldFNvdXJjZUNvbnRlbnQoc291cmNlLCBjb250ZW50KTtcbiAgICB9KTtcblxuICAgIGNvbmNhdENvbnN1bWVyLmRlc3Ryb3koKTtcbiAgICBPYmplY3QudmFsdWVzKGNvbnN1bWVycykuZm9yRWFjaChjb25zdW1lciA9PiBjb25zdW1lci5kZXN0cm95KCkpO1xuXG4gICAgcmV0dXJuIG5ld01hcDtcbiAgfSk7XG5cbiAgbWVyZ2VDYWNoZS5zZXQoaGFzaE9mRmlsZXMsIG1lcmdlZCA9IHtcbiAgICBjb2RlOiBzdHJpbmdpZmllZENzcy5jb2RlLFxuICAgIHNvdXJjZU1hcDogbmV3TWFwLnRvU3RyaW5nKClcbiAgfSk7XG5cbiAgcmV0dXJuIG1lcmdlZDtcbn0pO1xuIl19
