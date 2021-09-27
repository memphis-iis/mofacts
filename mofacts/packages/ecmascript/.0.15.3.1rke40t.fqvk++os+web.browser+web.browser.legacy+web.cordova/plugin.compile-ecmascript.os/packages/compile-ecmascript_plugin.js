(function () {

/* Imports */
var Babel = Package['babel-compiler'].Babel;
var BabelCompiler = Package['babel-compiler'].BabelCompiler;
var ReactFastRefresh = Package['react-fast-refresh'].ReactFastRefresh;

(function(){

///////////////////////////////////////////////////////////////////////
//                                                                   //
// packages/compile-ecmascript/plugin.js                             //
//                                                                   //
///////////////////////////////////////////////////////////////////////
                                                                     //
Plugin.registerCompiler({
  extensions: ['js', 'jsx', 'mjs'],
}, function () {
  return new BabelCompiler({
    react: true
  }, (babelOptions, file) => {
    if (file.hmrAvailable() && ReactFastRefresh.babelPlugin) {
      babelOptions.plugins = babelOptions.plugins || [];
      babelOptions.plugins.push(ReactFastRefresh.babelPlugin);
    }
  });
});

///////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
Package._define("compile-ecmascript");

})();
