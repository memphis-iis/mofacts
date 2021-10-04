(function () {

/* Imports */
var Babel = Package['babel-compiler'].Babel;
var BabelCompiler = Package['babel-compiler'].BabelCompiler;

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
  });
});

///////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
Package._define("compile-ecmascript");

})();
