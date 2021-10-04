module.export({
  getOauthUrl: () => getOauthUrl,
  getAccountsApiUrl: () => getAccountsApiUrl,
  getAuthDDPUrl: () => getAuthDDPUrl,
  getBuildFarmUrl: () => getBuildFarmUrl,
  getBuildFarmDomain: () => getBuildFarmDomain,
  getPackageServerUrl: () => getPackageServerUrl,
  getPackageServerDomain: () => getPackageServerDomain,
  getPackageStatsServerUrl: () => getPackageStatsServerUrl,
  getPackageStatsServerDomain: () => getPackageStatsServerDomain,
  getPackageServerFilePrefix: () => getPackageServerFilePrefix,
  getPackagesDirectoryName: () => getPackagesDirectoryName,
  getLocalPackageCacheFilename: () => getLocalPackageCacheFilename,
  getPackageStorage: () => getPackageStorage,
  getIsopacketRoot: () => getIsopacketRoot,
  getAccountsDomain: () => getAccountsDomain,
  getSessionFilePath: () => getSessionFilePath
});
let urlParse;
module.link("url", {
  parse(v) {
    urlParse = v;
  }

}, 0);
let pathJoin, getCurrentToolsDir, getHomeDir, inCheckout;
module.link("../fs/files", {
  pathJoin(v) {
    pathJoin = v;
  },

  getCurrentToolsDir(v) {
    getCurrentToolsDir = v;
  },

  getHomeDir(v) {
    getHomeDir = v;
  },

  inCheckout(v) {
    inCheckout = v;
  }

}, 1);
let tropohouse;
module.link("../packaging/tropohouse.js", {
  default(v) {
    tropohouse = v;
  }

}, 2);

function getOauthUrl() {
  return "https://www.meteor.com/oauth2";
}

function getAccountsApiUrl() {
  return "https://www.meteor.com/api/v1";
}

function getAuthDDPUrl() {
  return "https://www.meteor.com/auth";
}

function getBuildFarmUrl() {
  return process.env.METEOR_BUILD_FARM_URL || "https://build.meteor.com";
}

function getBuildFarmDomain() {
  return urlParse(getBuildFarmUrl()).host;
}

function getPackageServerUrl() {
  return process.env.METEOR_PACKAGE_SERVER_URL || "https://packages.meteor.com";
}

function getPackageServerDomain() {
  return urlParse(getPackageServerUrl()).host;
}

function getPackageStatsServerUrl() {
  return process.env.METEOR_PACKAGE_STATS_SERVER_URL || "https://activity.meteor.com";
}

function getPackageStatsServerDomain() {
  return urlParse(getPackageStatsServerUrl()).host;
}

function getPackageServerFilePrefix(serverUrl) {
  if (!serverUrl) {
    serverUrl = getPackageServerUrl();
  } // Chop off http:// and https:// and trailing slashes.


  serverUrl = serverUrl.replace(/^\https:\/\//, '');
  serverUrl = serverUrl.replace(/^\http:\/\//, '');
  serverUrl = serverUrl.replace(/\/+$/, ''); // Chop off meteor.com.

  serverUrl = serverUrl.replace(/\.meteor\.com$/, ''); // Replace other weird stuff with X.

  serverUrl = serverUrl.replace(/[^a-zA-Z0-9.-]/g, 'X');
  return serverUrl;
}

function getPackagesDirectoryName(serverUrl) {
  var prefix = getPackageServerFilePrefix(serverUrl);

  if (prefix !== 'packages') {
    prefix = pathJoin('packages-from-server', prefix);
  }

  return prefix;
}

function getLocalPackageCacheFilename(serverUrl) {
  var prefix = getPackageServerFilePrefix(serverUrl); // Should look like 'packages.data.db' in the default case
  // (packages.data.json before 0.9.4).

  return prefix + ".data.db";
}

function getPackageStorage(options) {
  options = options || {};
  var root = options.root || tropohouse.default.root;
  return pathJoin(root, "package-metadata", "v2.0.1", getLocalPackageCacheFilename(options.serverUrl));
}

function getIsopacketRoot() {
  if (inCheckout()) {
    return pathJoin(getCurrentToolsDir(), '.meteor', 'isopackets');
  } else {
    return pathJoin(getCurrentToolsDir(), 'isopackets');
  }
}

function getAccountsDomain() {
  return "www.meteor.com";
}

function getSessionFilePath() {
  // METEOR_SESSION_FILE is for automated testing purposes only.
  return process.env.METEOR_SESSION_FILE || pathJoin(getHomeDir(), '.meteorsession');
}
//# sourceMappingURL=config.js.map