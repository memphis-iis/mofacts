module.export({
  TEST_FILENAME_REGEXPS: () => TEST_FILENAME_REGEXPS,
  APP_TEST_FILENAME_REGEXPS: () => APP_TEST_FILENAME_REGEXPS,
  isTestFilePath: () => isTestFilePath
});

let _;

module.link("underscore", {
  default(v) {
    _ = v;
  }

}, 0);
let pathSep;
module.link("../fs/files", {
  pathSep(v) {
    pathSep = v;
  }

}, 1);
const TEST_FILENAME_REGEXPS = [// "*.test[s].*" or "*.spec[s].*"
/\.test\./, /\.tests\./, /\.spec\./, /\.specs\./];
const APP_TEST_FILENAME_REGEXPS = [// "*.app-test[s].*" or "*.app-spec[s].*"
/\.app-test\./, /\.app-tests\./, /\.app-spec\./, /\.app-specs\./];

function isTestFilePath(path) {
  const splitPath = path.split(pathSep); // Does the filename match one of the test filename forms?

  return _.any([...TEST_FILENAME_REGEXPS, ...APP_TEST_FILENAME_REGEXPS], regexp => regexp.test(_.last(splitPath)));
}
//# sourceMappingURL=test-files.js.map