(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var ECMAScript = Package.ecmascript.ECMAScript;
var Babel = Package['babel-compiler'].Babel;
var BabelCompiler = Package['babel-compiler'].BabelCompiler;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var meteorJsMinify;

var require = meteorInstall({"node_modules":{"meteor":{"minifier-js":{"minifier.js":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                      //
// packages/minifier-js/minifier.js                                                                     //
//                                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                        //
module.export({
  meteorJsMinify: () => meteorJsMinify
});
let terser;

const meteorJsMinify = function (source) {
  const result = {};
  const NODE_ENV = process.env.NODE_ENV || "development";
  terser = terser || Npm.require("terser");
  const options = {
    compress: {
      drop_debugger: false,
      // remove debugger; statements
      unused: false,
      // drop unreferenced functions and variables
      dead_code: true,
      // remove unreachable code
      global_defs: {
        "process.env.NODE_ENV": NODE_ENV
      }
    },
    // Fix issue #9866, as explained in this comment:
    // https://github.com/mishoo/UglifyJS2/issues/1753#issuecomment-324814782
    // And fix terser issue #117: https://github.com/terser-js/terser/issues/117
    safari10: true // set this option to true to work around the Safari 10/11 await bug

  };
  const terserResult = terser.minify(source, options); // the terser api doesnt throw exceptions, so we throw one ourselves

  if (terserResult.error) throw terserResult.error; // this is kept to maintain backwards compatability

  result.code = terserResult.code;
  result.minifier = 'terser';
  return result;
};
//////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});

var exports = require("/node_modules/meteor/minifier-js/minifier.js");

/* Exports */
Package._define("minifier-js", exports, {
  meteorJsMinify: meteorJsMinify
});

})();




//# sourceURL=meteor://💻app/packages/minifier-js.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvbWluaWZpZXItanMvbWluaWZpZXIuanMiXSwibmFtZXMiOlsibW9kdWxlIiwiZXhwb3J0IiwibWV0ZW9ySnNNaW5pZnkiLCJ0ZXJzZXIiLCJzb3VyY2UiLCJyZXN1bHQiLCJOT0RFX0VOViIsInByb2Nlc3MiLCJlbnYiLCJOcG0iLCJyZXF1aXJlIiwib3B0aW9ucyIsImNvbXByZXNzIiwiZHJvcF9kZWJ1Z2dlciIsInVudXNlZCIsImRlYWRfY29kZSIsImdsb2JhbF9kZWZzIiwic2FmYXJpMTAiLCJ0ZXJzZXJSZXN1bHQiLCJtaW5pZnkiLCJlcnJvciIsImNvZGUiLCJtaW5pZmllciJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQUEsTUFBTSxDQUFDQyxNQUFQLENBQWM7QUFBQ0MsZ0JBQWMsRUFBQyxNQUFJQTtBQUFwQixDQUFkO0FBQUEsSUFBSUMsTUFBSjs7QUFFQSxNQUFNRCxjQUFjLEdBQUcsVUFBVUUsTUFBVixFQUFrQjtBQUN2QyxRQUFNQyxNQUFNLEdBQUcsRUFBZjtBQUNBLFFBQU1DLFFBQVEsR0FBR0MsT0FBTyxDQUFDQyxHQUFSLENBQVlGLFFBQVosSUFBd0IsYUFBekM7QUFDQUgsUUFBTSxHQUFHQSxNQUFNLElBQUlNLEdBQUcsQ0FBQ0MsT0FBSixDQUFZLFFBQVosQ0FBbkI7QUFFQSxRQUFNQyxPQUFPLEdBQUc7QUFDZEMsWUFBUSxFQUFFO0FBQ1JDLG1CQUFhLEVBQUUsS0FEUDtBQUNlO0FBQ3ZCQyxZQUFNLEVBQUUsS0FGQTtBQUVlO0FBQ3ZCQyxlQUFTLEVBQUUsSUFISDtBQUdlO0FBQ3ZCQyxpQkFBVyxFQUFFO0FBQ1gsZ0NBQXdCVjtBQURiO0FBSkwsS0FESTtBQVNkO0FBQ0E7QUFDQTtBQUNBVyxZQUFRLEVBQUUsSUFaSSxDQVlXOztBQVpYLEdBQWhCO0FBZUEsUUFBTUMsWUFBWSxHQUFHZixNQUFNLENBQUNnQixNQUFQLENBQWNmLE1BQWQsRUFBc0JPLE9BQXRCLENBQXJCLENBcEJ1QyxDQXNCdkM7O0FBQ0EsTUFBSU8sWUFBWSxDQUFDRSxLQUFqQixFQUF3QixNQUFNRixZQUFZLENBQUNFLEtBQW5CLENBdkJlLENBeUJ2Qzs7QUFDQWYsUUFBTSxDQUFDZ0IsSUFBUCxHQUFjSCxZQUFZLENBQUNHLElBQTNCO0FBQ0FoQixRQUFNLENBQUNpQixRQUFQLEdBQWtCLFFBQWxCO0FBRUEsU0FBT2pCLE1BQVA7QUFDRCxDQTlCRCxDIiwiZmlsZSI6Ii9wYWNrYWdlcy9taW5pZmllci1qcy5qcyIsInNvdXJjZXNDb250ZW50IjpbImxldCB0ZXJzZXI7XG5cbmNvbnN0IG1ldGVvckpzTWluaWZ5ID0gZnVuY3Rpb24gKHNvdXJjZSkge1xuICBjb25zdCByZXN1bHQgPSB7fTtcbiAgY29uc3QgTk9ERV9FTlYgPSBwcm9jZXNzLmVudi5OT0RFX0VOViB8fCBcImRldmVsb3BtZW50XCI7XG4gIHRlcnNlciA9IHRlcnNlciB8fCBOcG0ucmVxdWlyZShcInRlcnNlclwiKTtcblxuICBjb25zdCBvcHRpb25zID0ge1xuICAgIGNvbXByZXNzOiB7XG4gICAgICBkcm9wX2RlYnVnZ2VyOiBmYWxzZSwgIC8vIHJlbW92ZSBkZWJ1Z2dlcjsgc3RhdGVtZW50c1xuICAgICAgdW51c2VkOiBmYWxzZSwgICAgICAgICAvLyBkcm9wIHVucmVmZXJlbmNlZCBmdW5jdGlvbnMgYW5kIHZhcmlhYmxlc1xuICAgICAgZGVhZF9jb2RlOiB0cnVlLCAgICAgICAvLyByZW1vdmUgdW5yZWFjaGFibGUgY29kZVxuICAgICAgZ2xvYmFsX2RlZnM6IHtcbiAgICAgICAgXCJwcm9jZXNzLmVudi5OT0RFX0VOVlwiOiBOT0RFX0VOVlxuICAgICAgfVxuICAgIH0sXG4gICAgLy8gRml4IGlzc3VlICM5ODY2LCBhcyBleHBsYWluZWQgaW4gdGhpcyBjb21tZW50OlxuICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9taXNob28vVWdsaWZ5SlMyL2lzc3Vlcy8xNzUzI2lzc3VlY29tbWVudC0zMjQ4MTQ3ODJcbiAgICAvLyBBbmQgZml4IHRlcnNlciBpc3N1ZSAjMTE3OiBodHRwczovL2dpdGh1Yi5jb20vdGVyc2VyLWpzL3RlcnNlci9pc3N1ZXMvMTE3XG4gICAgc2FmYXJpMTA6IHRydWUsICAgICAgICAgIC8vIHNldCB0aGlzIG9wdGlvbiB0byB0cnVlIHRvIHdvcmsgYXJvdW5kIHRoZSBTYWZhcmkgMTAvMTEgYXdhaXQgYnVnXG4gIH07XG5cbiAgY29uc3QgdGVyc2VyUmVzdWx0ID0gdGVyc2VyLm1pbmlmeShzb3VyY2UsIG9wdGlvbnMpO1xuXG4gIC8vIHRoZSB0ZXJzZXIgYXBpIGRvZXNudCB0aHJvdyBleGNlcHRpb25zLCBzbyB3ZSB0aHJvdyBvbmUgb3Vyc2VsdmVzXG4gIGlmICh0ZXJzZXJSZXN1bHQuZXJyb3IpIHRocm93IHRlcnNlclJlc3VsdC5lcnJvcjtcblxuICAvLyB0aGlzIGlzIGtlcHQgdG8gbWFpbnRhaW4gYmFja3dhcmRzIGNvbXBhdGFiaWxpdHlcbiAgcmVzdWx0LmNvZGUgPSB0ZXJzZXJSZXN1bHQuY29kZTtcbiAgcmVzdWx0Lm1pbmlmaWVyID0gJ3RlcnNlcic7XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn07XG5cbmV4cG9ydCB7IG1ldGVvckpzTWluaWZ5IH07XG4iXX0=
