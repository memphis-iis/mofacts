module.export({
  default: () => PhantomClient
});
let execFile;
module.link("child_process", {
  execFile(v) {
    execFile = v;
  }

}, 0);
let Client;
module.link("../../client.js", {
  default(v) {
    Client = v;
  }

}, 1);
let enterJob;
module.link("../../../utils/buildmessage.js", {
  enterJob(v) {
    enterJob = v;
  }

}, 2);
let ensureDependencies;
module.link("../../../cli/dev-bundle-helpers.js", {
  ensureDependencies(v) {
    ensureDependencies = v;
  }

}, 3);
let convertToOSPath, pathJoin, getCurrentToolsDir;
module.link("../../../fs/files", {
  convertToOSPath(v) {
    convertToOSPath = v;
  },

  pathJoin(v) {
    pathJoin = v;
  },

  getCurrentToolsDir(v) {
    getCurrentToolsDir = v;
  }

}, 4);
const NPM_DEPENDENCIES = {
  'phantomjs-prebuilt': '2.1.14'
};

class PhantomClient extends Client {
  constructor(options) {
    super(options);
    enterJob({
      title: 'Installing PhantomJS in Meteor tool'
    }, () => {
      ensureDependencies(NPM_DEPENDENCIES);
    });
    this.npmPackageExports = require("phantomjs-prebuilt");
    this.name = "phantomjs";
    this.process = null;
    this._logError = true;
  }

  connect() {
    const phantomPath = this.npmPackageExports.path;
    const scriptPath = pathJoin(getCurrentToolsDir(), "tools", "tool-testing", "phantom", "open-url.js");
    this.process = execFile(phantomPath, ["--load-images=no", convertToOSPath(scriptPath), this.url], {}, (error, stdout, stderr) => {
      if (this._logError && error) {
        console.log("PhantomJS exited with error ", error, "\nstdout:\n", stdout, "\nstderr:\n", stderr);
      } else if (stderr) {
        console.log("PhantomJS stderr:\n", stderr);
      }
    });
  }

  stop() {
    // Suppress the expected SIGTERM exit 'failure'
    this._logError = false;
    this.process && this.process.kill();
    this.process = null;
  }

  static pushClients(clients, appConfig) {
    clients.push(new PhantomClient(appConfig));
  }

}
//# sourceMappingURL=index.js.map