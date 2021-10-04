(function(){

///////////////////////////////////////////////////////////////////////////////////
//                                                                               //
// packages/react-fast-refresh/server.js                                         //
//                                                                               //
///////////////////////////////////////////////////////////////////////////////////
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

///////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

///////////////////////////////////////////////////////////////////////////////////
//                                                                               //
// packages/react-fast-refresh/client-runtime.js                                 //
//                                                                               //
///////////////////////////////////////////////////////////////////////////////////
                                                                                 //
const enabled = __meteor_runtime_config__.reactFastRefreshEnabled;

if (enabled && process.env.NODE_ENV !== 'production' && module.hot) {
  const runtime = require('react-refresh/runtime');

  let timeout = null;
  function scheduleRefresh() {
    if (!timeout) {
      timeout = setTimeout(function() {
        timeout = null;
        runtime.performReactRefresh();
      }, 0);
    }
  }

  // The react refresh babel plugin only registers functions. For react
  // to update other types of exports (such as classes), we have to
  // register them
  function registerExportsForReactRefresh(moduleId, moduleExports) {
    runtime.register(moduleExports, moduleId + ' %exports%');

    if (moduleExports == null || typeof moduleExports !== 'object') {
      // Exit if we can't iterate over exports.
      return;
    }

    for (var key in moduleExports) {
      var desc = Object.getOwnPropertyDescriptor(moduleExports, key);
      if (desc && desc.get) {
        // Don't invoke getters as they may have side effects.
        continue;
      }

      var exportValue = moduleExports[key];
      var typeID = moduleId + ' %exports% ' + key;
      runtime.register(exportValue, typeID);
    }
  };

  // Modules that only export components become React Refresh boundaries.
  function isReactRefreshBoundary(moduleExports) {
    if (runtime.isLikelyComponentType(moduleExports)) {
      return true;
    }
    if (moduleExports == null || typeof moduleExports !== 'object') {
      // Exit if we can't iterate over exports.
      return false;
    }

    var hasExports = false;
    var onlyExportComponents = true;

    for (var key in moduleExports) {
      hasExports = true;

      var desc = Object.getOwnPropertyDescriptor(moduleExports, key);
      if (desc && desc.get) {
        // Don't invoke getters as they may have side effects.
        return false;
      }

      if (!runtime.isLikelyComponentType(moduleExports[key])) {
        onlyExportComponents = false;
      }
    }

    return hasExports && onlyExportComponents;
  };

  runtime.injectIntoGlobalHook(window);

  window.$RefreshReg$ = function() { };
  window.$RefreshSig$ = function() {
    return function(type) { return type; };
  };

  module.hot.onRequire({
    before: function(module) {
      if (module.loaded) {
        // The module was already executed
        return;
      }

      var prevRefreshReg = window.$RefreshReg$;
      var prevRefreshSig = window.$RefreshSig$;

      window.RefreshRuntime = runtime;
      window.$RefreshReg$ = function(type, _id) {
        const fullId = module.id + ' ' + _id;
        RefreshRuntime.register(type, fullId);
      }
      window.$RefreshSig$ = RefreshRuntime.createSignatureFunctionForTransform;

      return {
        prevRefreshReg: prevRefreshReg,
        prevRefreshSig: prevRefreshSig
      };
    },
    after: function(module, beforeData) {
      // TODO: handle modules with errors
      if (!beforeData) {
        return;
      }

      window.$RefreshReg$ = beforeData.prevRefreshReg;
      window.$RefreshSig$ = beforeData.prevRefreshSig;
      if (isReactRefreshBoundary(module.exports)) {
        registerExportsForReactRefresh(module.id, module.exports);
        module.hot.accept();

        scheduleRefresh();
      }
    }
  });
}

///////////////////////////////////////////////////////////////////////////////////

}).call(this);
