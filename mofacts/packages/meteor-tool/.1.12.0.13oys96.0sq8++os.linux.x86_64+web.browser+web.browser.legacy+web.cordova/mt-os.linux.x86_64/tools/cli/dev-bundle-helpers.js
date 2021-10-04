module.export({
  ensureDependencies: () => ensureDependencies
});
let pathJoin, getDevBundle, statOrNull;
module.link("../fs/files", {
  pathJoin(v) {
    pathJoin = v;
  },

  getDevBundle(v) {
    getDevBundle = v;
  },

  statOrNull(v) {
    statOrNull = v;
  }

}, 0);
let installNpmModule;
module.link("../isobuild/meteor-npm.js", {
  installNpmModule(v) {
    installNpmModule = v;
  }

}, 1);

function ensureDependencies(deps) {
  const devBundleLib = pathJoin(getDevBundle(), 'lib');
  const devBundleNodeModules = pathJoin(devBundleLib, 'node_modules'); // Check if each of the requested dependencies resolves, if not
  // mark them for installation.

  const needToInstall = Object.create(null);
  Object.keys(deps).forEach(dep => {
    const pkgDir = pathJoin(devBundleNodeModules, dep);
    const pkgStat = statOrNull(pkgDir);
    const alreadyInstalled = pkgStat && pkgStat.isDirectory();

    if (!alreadyInstalled) {
      const versionToInstall = deps[dep];
      needToInstall[dep] = versionToInstall;
    }
  }); // Install each of the requested modules.

  Object.keys(needToInstall).forEach(dep => {
    installNpmModule(dep, needToInstall[dep], devBundleLib);
  });
}
//# sourceMappingURL=dev-bundle-helpers.js.map