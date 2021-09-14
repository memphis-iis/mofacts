(function () {

/* Imports */
var ECMAScript = Package.ecmascript.ECMAScript;
var CachingHtmlCompiler = Package['caching-html-compiler'].CachingHtmlCompiler;
var TemplatingTools = Package['templating-tools'].TemplatingTools;
var meteorInstall = Package.modules.meteorInstall;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;
var Symbol = Package['ecmascript-runtime-server'].Symbol;
var Map = Package['ecmascript-runtime-server'].Map;
var Set = Package['ecmascript-runtime-server'].Set;

var require = meteorInstall({"node_modules":{"meteor":{"compileTemplatesBatch":{"compile-templates.js":function(){

///////////////////////////////////////////////////////////////////////
//                                                                   //
// packages/compileTemplatesBatch/compile-templates.js               //
//                                                                   //
///////////////////////////////////////////////////////////////////////
                                                                     //
Plugin.registerCompiler({                                            // 1
  extensions: ['html'],                                              // 2
  archMatching: 'web',                                               // 3
  isTemplate: true                                                   // 4
}, function () {                                                     // 1
  return new CachingHtmlCompiler("templating", TemplatingTools.scanHtmlForTags, TemplatingTools.compileTagsWithSpacebars);
});                                                                  // 5
///////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/compileTemplatesBatch/compile-templates.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package.compileTemplatesBatch = {};

})();





//# sourceURL=meteor://💻app/packages/compileTemplatesBatch_plugin.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvY29tcGlsZVRlbXBsYXRlc0JhdGNoL2NvbXBpbGUtdGVtcGxhdGVzLmpzIl0sIm5hbWVzIjpbIlBsdWdpbiIsInJlZ2lzdGVyQ29tcGlsZXIiLCJleHRlbnNpb25zIiwiYXJjaE1hdGNoaW5nIiwiaXNUZW1wbGF0ZSIsIkNhY2hpbmdIdG1sQ29tcGlsZXIiLCJUZW1wbGF0aW5nVG9vbHMiLCJzY2FuSHRtbEZvclRhZ3MiLCJjb21waWxlVGFnc1dpdGhTcGFjZWJhcnMiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBQSxPQUFPQyxnQkFBUCxDQUF3QjtBQUN0QkMsY0FBWSxDQUFDLE1BQUQsQ0FEVTtBQUV0QkMsZ0JBQWMsS0FGUTtBQUd0QkMsY0FBWTtBQUhVLENBQXhCLEVBSUc7QUFBQSxTQUFNLElBQUlDLG1CQUFKLENBQ1AsWUFETyxFQUVQQyxnQkFBZ0JDLGVBRlQsRUFHUEQsZ0JBQWdCRSx3QkFIVCxDQUFOO0FBQUEsQ0FKSCx3RSIsImZpbGUiOiIvcGFja2FnZXMvY29tcGlsZVRlbXBsYXRlc0JhdGNoX3BsdWdpbi5qcyIsInNvdXJjZXNDb250ZW50IjpbIlBsdWdpbi5yZWdpc3RlckNvbXBpbGVyKHtcbiAgZXh0ZW5zaW9uczogWydodG1sJ10sXG4gIGFyY2hNYXRjaGluZzogJ3dlYicsXG4gIGlzVGVtcGxhdGU6IHRydWVcbn0sICgpID0+IG5ldyBDYWNoaW5nSHRtbENvbXBpbGVyKFxuICBcInRlbXBsYXRpbmdcIixcbiAgVGVtcGxhdGluZ1Rvb2xzLnNjYW5IdG1sRm9yVGFncyxcbiAgVGVtcGxhdGluZ1Rvb2xzLmNvbXBpbGVUYWdzV2l0aFNwYWNlYmFyc1xuKSk7XG4iXX0=
