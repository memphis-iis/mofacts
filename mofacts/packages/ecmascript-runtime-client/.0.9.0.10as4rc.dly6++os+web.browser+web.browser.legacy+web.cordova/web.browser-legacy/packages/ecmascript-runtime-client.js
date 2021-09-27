(function(){

///////////////////////////////////////////////////////////////////////////////////
//                                                                               //
// packages/ecmascript-runtime-client/modern.js                                  //
//                                                                               //
///////////////////////////////////////////////////////////////////////////////////
                                                                                 //
try {
  require("core-js/modules/es.object.get-own-property-descriptors");
} catch (e) {
  throw new Error([
    "The core-js npm package could not be found in your node_modules ",
    "directory. Please run the following command to install it:",
    "",
    "  meteor npm install --save core-js",
    ""
  ].join("\n"));
}

require("core-js/modules/es.object.is");
require("core-js/modules/es.function.name");
require("core-js/modules/es.number.is-finite");
require("core-js/modules/es.number.is-nan");
require("core-js/modules/es.array.flat");
require("core-js/modules/es.array.flat-map");
require("core-js/modules/es.object.values");
require("core-js/modules/es.object.entries");
require("core-js/modules/es.string.pad-start");
require("core-js/modules/es.string.pad-end");
require("core-js/modules/es.symbol.async-iterator");

///////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

///////////////////////////////////////////////////////////////////////////////////
//                                                                               //
// packages/ecmascript-runtime-client/legacy.js                                  //
//                                                                               //
///////////////////////////////////////////////////////////////////////////////////
                                                                                 //
try {
  Symbol = exports.Symbol = require("core-js/es/symbol");
  Map = exports.Map = require("core-js/es/map");
  Set = exports.Set = require("core-js/es/set");

} catch (e) {
  throw new Error([
    "The core-js npm package could not be found in your node_modules ",
    "directory. Please run the following command to install it:",
    "",
    "  meteor npm install --save core-js",
    ""
  ].join("\n"));
}

// ECMAScript 2015 polyfills.
require("core-js/es/array");
require("core-js/es/function");
require("core-js/es/math");
require("core-js/es/object");
require("core-js/es/regexp");
require("core-js/es/string");
require("core-js/es/weak-map");
require("core-js/es/weak-set");

// If the Reflect global namespace is missing or undefined, explicitly
// initialize it as undefined, so that expressions like _typeof(Reflect)
// won't throw in older browsers. Fixes #9598.
if (typeof Reflect === "undefined") {
  global.Reflect = void 0;
}

// We want everything from the core-js/es/number module except
// es.number.constructor.
require('core-js/modules/es.number.epsilon');
require('core-js/modules/es.number.is-finite');
require('core-js/modules/es.number.is-integer');
require('core-js/modules/es.number.is-nan');
require('core-js/modules/es.number.is-safe-integer');
require('core-js/modules/es.number.max-safe-integer');
require('core-js/modules/es.number.min-safe-integer');
require('core-js/modules/es.number.parse-float');
require('core-js/modules/es.number.parse-int');

// Typed Arrays
require('core-js/modules/es.typed-array.uint8-array');
require('core-js/modules/es.typed-array.uint32-array');

require("./modern.js");

///////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

///////////////////////////////////////////////////////////////////////////////////
//                                                                               //
// packages/ecmascript-runtime-client/versions.js                                //
//                                                                               //
///////////////////////////////////////////////////////////////////////////////////
                                                                                 //
const {
  setMinimumBrowserVersions,
} = require("meteor/modern-browsers");

setMinimumBrowserVersions({
  chrome: 49,
  edge: 12,
  // Since there is no IE12, this effectively excludes Internet Explorer
  // (pre-Edge) from the modern classification. #9818 #9839
  ie: 12,
  firefox: 45,
  mobileSafari: 10,
  opera: 38,
  safari: 10,
  // Electron 1.6.0+ matches Chromium 55, per
  // https://github.com/Kilian/electron-to-chromium/blob/master/full-versions.js
  electron: [1, 6],
}, module.id);

///////////////////////////////////////////////////////////////////////////////////

}).call(this);
