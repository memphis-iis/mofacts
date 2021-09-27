module.export({
  ensureDependencies: () => ensureDependencies
});
let pathJoin, getDevBundle;
module.link("../fs/files", {
  pathJoin(v) {
    pathJoin = v;
  },

  getDevBundle(v) {
    getDevBundle = v;
  }

}, 0);
let installNpmModule, moduleDoesResolve;
module.link("../isobuild/meteor-npm.js", {
  installNpmModule(v) {
    installNpmModule = v;
  },

  moduleDoesResolve(v) {
    moduleDoesResolve = v;
  }

}, 1);

function ensureDependencies(deps) {
  // Check if each of the requested dependencies resolves, if not
  // mark them for installation.
  const needToInstall = Object.create(null);
  Object.keys(deps).forEach(dep => {
    if (!moduleDoesResolve(dep)) {
      const versionToInstall = deps[dep];
      needToInstall[dep] = versionToInstall;
    }
  });
  const devBundleLib = pathJoin(getDevBundle(), 'lib'); // Install each of the requested modules.

  Object.keys(needToInstall).forEach(dep => installNpmModule(dep, needToInstall[dep], devBundleLib));
}
//# sourceMappingURL=dev-bundle-helpers.js.map