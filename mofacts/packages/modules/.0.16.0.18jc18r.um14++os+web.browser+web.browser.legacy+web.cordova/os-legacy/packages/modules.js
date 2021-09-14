(function(){

////////////////////////////////////////////////////////////////////////////
//                                                                        //
// packages/modules/server.js                                             //
//                                                                        //
////////////////////////////////////////////////////////////////////////////
                                                                          //
require("./install-packages.js");
require("./process.js");
require("./reify.js");

////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

////////////////////////////////////////////////////////////////////////////
//                                                                        //
// packages/modules/client.js                                             //
//                                                                        //
////////////////////////////////////////////////////////////////////////////
                                                                          //
require("./install-packages.js");
require("./stubs.js");
require("./process.js");
require("./reify.js");

exports.addStyles = require("./css").addStyles;

////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

////////////////////////////////////////////////////////////////////////////
//                                                                        //
// packages/modules/css.js                                                //
//                                                                        //
////////////////////////////////////////////////////////////////////////////
                                                                          //
var doc = document;
var head = doc.getElementsByTagName("head").item(0);

exports.addStyles = function (css) {
  var style = doc.createElement("style");

  style.setAttribute("type", "text/css");

  // https://msdn.microsoft.com/en-us/library/ms535871(v=vs.85).aspx
  var internetExplorerSheetObject =
    style.sheet || // Edge/IE11.
    style.styleSheet; // Older IEs.

  if (internetExplorerSheetObject) {
    internetExplorerSheetObject.cssText = css;
  } else {
    style.appendChild(doc.createTextNode(css));
  }

  return head.appendChild(style);
};

////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

////////////////////////////////////////////////////////////////////////////
//                                                                        //
// packages/modules/install-packages.js                                   //
//                                                                        //
////////////////////////////////////////////////////////////////////////////
                                                                          //
function install(name, mainModule) {
  var meteorDir = {};

  // Given a package name <name>, install a stub module in the
  // /node_modules/meteor directory called <name>.js, so that
  // require.resolve("meteor/<name>") will always return
  // /node_modules/meteor/<name>.js instead of something like
  // /node_modules/meteor/<name>/index.js, in the rare but possible event
  // that the package contains a file called index.js (#6590).

  if (typeof mainModule === "string") {
    // Set up an alias from /node_modules/meteor/<package>.js to the main
    // module, e.g. meteor/<package>/index.js.
    meteorDir[name + ".js"] = mainModule;
  } else {
    // back compat with old Meteor packages
    meteorDir[name + ".js"] = function (r, e, module) {
      module.exports = Package[name];
    };
  }

  meteorInstall({
    node_modules: {
      meteor: meteorDir
    }
  });
}

// This file will be modified during computeJsOutputFilesMap to include
// install(<name>) calls for every Meteor package.

////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

////////////////////////////////////////////////////////////////////////////
//                                                                        //
// packages/modules/legacy.js                                             //
//                                                                        //
////////////////////////////////////////////////////////////////////////////
                                                                          //
// The meteor-babel/plugins/sanitize-for-in-objects plugin generates code
// that uses meteorBabelHelpers.sanitizeForInObject, but only when
// compiling code for the web.browser.legacy bundle. See #10595.
meteorBabelHelpers = require("meteor-babel-helpers");

////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

////////////////////////////////////////////////////////////////////////////
//                                                                        //
// packages/modules/process.js                                            //
//                                                                        //
////////////////////////////////////////////////////////////////////////////
                                                                          //
if (! global.process) {
  try {
    // The application can run `npm install process` to provide its own
    // process stub; otherwise this module will provide a partial stub.
    global.process = require("process");
  } catch (missing) {
    global.process = {};
  }
}

var proc = global.process;

if (Meteor.isServer) {
  // Make require("process") work on the server in all versions of Node.
  meteorInstall({
    node_modules: {
      "process.js": function (r, e, module) {
        module.exports = proc;
      }
    }
  });
} else {
  proc.platform = "browser";
  proc.nextTick = proc.nextTick || Meteor._setImmediate;
}

if (typeof proc.env !== "object") {
  proc.env = {};
}

var hasOwn = Object.prototype.hasOwnProperty;
for (var key in meteorEnv) {
  if (hasOwn.call(meteorEnv, key)) {
    proc.env[key] = meteorEnv[key];
  }
}

////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

////////////////////////////////////////////////////////////////////////////
//                                                                        //
// packages/modules/reify.js                                              //
//                                                                        //
////////////////////////////////////////////////////////////////////////////
                                                                          //
require("reify/lib/runtime").enable(
  module.constructor.prototype
);

////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

////////////////////////////////////////////////////////////////////////////
//                                                                        //
// packages/modules/stubs.js                                              //
//                                                                        //
////////////////////////////////////////////////////////////////////////////
                                                                          //
var haveStubs = false;
try {
  require.resolve("meteor-node-stubs");
  haveStubs = true;
} catch (noStubs) {}

if (haveStubs) {
  // When meteor-node-stubs is installed in the application's root
  // node_modules directory, requiring it here installs aliases for stubs
  // for all Node built-in modules, such as fs, util, and http.
  require("meteor-node-stubs");
}

////////////////////////////////////////////////////////////////////////////

}).call(this);
