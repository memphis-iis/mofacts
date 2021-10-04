(function(){

////////////////////////////////////////////////////////////////////////////
//                                                                        //
// packages/es5-shim/client.js                                            //
//                                                                        //
////////////////////////////////////////////////////////////////////////////
                                                                          //
require("./import_globals.js");
require("es5-shim/es5-shim.js");
require("es5-shim/es5-sham.js");
require("./console.js");
require("./export_globals.js");

////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

////////////////////////////////////////////////////////////////////////////
//                                                                        //
// packages/es5-shim/console.js                                           //
//                                                                        //
////////////////////////////////////////////////////////////////////////////
                                                                          //
var hasOwn = Object.prototype.hasOwnProperty;

function wrap(method) {
  var original = console[method];
  if (original && typeof original === "object") {
    // Turn callable console method objects into actual functions.
    console[method] = function () {
      return Function.prototype.apply.call(
        original, console, arguments
      );
    };
  }
}

if (typeof console === "object" &&
    // In older Internet Explorers, methods like console.log are actually
    // callable objects rather than functions.
    typeof console.log === "object") {
  for (var method in console) {
    // In most browsers, this hasOwn check will fail for all console
    // methods anyway, but fortunately in IE8 the method objects we care
    // about are own properties.
    if (hasOwn.call(console, method)) {
      wrap(method);
    }
  }
}

////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

////////////////////////////////////////////////////////////////////////////
//                                                                        //
// packages/es5-shim/cordova.js                                           //
//                                                                        //
////////////////////////////////////////////////////////////////////////////
                                                                          //
// Since Cordova renders boilerplate HTML at build time, and doesn't use
// the server-render system through the webapp package, it's important
// that we include es5-shim (and sham) statically for Cordova clients.
require("./import_globals.js");
require("es5-shim/es5-shim.js");
require("es5-shim/es5-sham.js");
require("./export_globals.js");

////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

////////////////////////////////////////////////////////////////////////////
//                                                                        //
// packages/es5-shim/export_globals.js                                    //
//                                                                        //
////////////////////////////////////////////////////////////////////////////
                                                                          //
if (global.Date !== Date) {
  global.Date = Date;
}

if (global.parseInt !== parseInt) {
  global.parseInt = parseInt;
}

if (global.parseFloat !== parseFloat) {
  global.parseFloat = parseFloat;
}

var Sp = String.prototype;
if (Sp.replace !== originalStringReplace) {
  // Restore the original value of String#replace, because the es5-shim
  // reimplementation is buggy. See also import_globals.js.
  Sp.replace = originalStringReplace;
}

////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

////////////////////////////////////////////////////////////////////////////
//                                                                        //
// packages/es5-shim/import_globals.js                                    //
//                                                                        //
////////////////////////////////////////////////////////////////////////////
                                                                          //
// Because the es5-{shim,sham}.js code assigns to Date and parseInt,
// Meteor treats them as package variables, and so declares them as
// variables in package scope, which causes some references to Date and
// parseInt in the shim/sham code to refer to those undefined package
// variables. The simplest solution seems to be to initialize the package
// variables to their appropriate global values.
Date = global.Date;
parseInt = global.parseInt;
parseFloat = global.parseFloat;

// Save the original String#replace method, because es5-shim's
// reimplementation of it causes problems in markdown/showdown.js.
// This original method will be restored in export_globals.js.
originalStringReplace = String.prototype.replace;

////////////////////////////////////////////////////////////////////////////

}).call(this);
