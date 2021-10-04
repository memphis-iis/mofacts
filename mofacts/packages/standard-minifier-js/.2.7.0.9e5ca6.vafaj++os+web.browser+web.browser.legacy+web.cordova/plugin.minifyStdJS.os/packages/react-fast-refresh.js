(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var meteorInstall = Package.modules.meteorInstall;

/* Package-scope variables */
var ReactFastRefresh;

var require = meteorInstall({"node_modules":{"meteor":{"react-fast-refresh":{"server.js":function module(require){

///////////////////////////////////////////////////////////////////////////
//                                                                       //
// packages/react-fast-refresh/server.js                                 //
//                                                                       //
///////////////////////////////////////////////////////////////////////////
                                                                         //

let enabled = !process.env.DISABLE_REACT_FAST_REFRESH;

if (enabled) {
  try {
    // React fast refresh requires react 16.9.0 or newer
    const semver = require('semver');
    const pkg = require('react/package.json');

    enabled = pkg && pkg.version &&
      semver.gte(pkg.version, '16.9.0');
  } catch (e) {
    // If the app doesn't directly depend on react, leave react-refresh
    // enabled in case a package or indirect dependency uses react.
  }
}

if (typeof __meteor_runtime_config__ === 'object') {
  __meteor_runtime_config__.reactFastRefreshEnabled = enabled;
}

const babelPlugin = enabled ?
  require('react-refresh/babel') :
  null;

ReactFastRefresh = {
  babelPlugin,
};

///////////////////////////////////////////////////////////////////////////

},"node_modules":{"semver":{"package.json":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////////
//                                                                       //
// node_modules/meteor/react-fast-refresh/node_modules/semver/package.js //
//                                                                       //
///////////////////////////////////////////////////////////////////////////
                                                                         //
module.exports = {
  "name": "semver",
  "version": "7.3.4",
  "main": "index.js"
};

///////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////////
//                                                                       //
// node_modules/meteor/react-fast-refresh/node_modules/semver/index.js   //
//                                                                       //
///////////////////////////////////////////////////////////////////////////
                                                                         //
module.useNode();
///////////////////////////////////////////////////////////////////////////

}},"react-refresh":{"babel.js":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////////
//                                                                       //
// node_modules/meteor/react-fast-refresh/node_modules/react-refresh/bab //
//                                                                       //
///////////////////////////////////////////////////////////////////////////
                                                                         //
module.useNode();
///////////////////////////////////////////////////////////////////////////

}}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});

require("/node_modules/meteor/react-fast-refresh/server.js");

/* Exports */
Package._define("react-fast-refresh", {
  ReactFastRefresh: ReactFastRefresh
});

})();
