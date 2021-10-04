let _objectSpread;

module.link("@babel/runtime/helpers/objectSpread2", {
  default(v) {
    _objectSpread = v;
  }

}, 0);
module.export({
  default: () => BrowserStackClient
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
let configuredClients;
module.link("./clients.js", {
  default(v) {
    configuredClients = v;
  }

}, 2);
let enterJob;
module.link("../../../utils/buildmessage.js", {
  enterJob(v) {
    enterJob = v;
  }

}, 3);
let getUrlWithResuming;
module.link("../../../utils/http-helpers.js", {
  getUrlWithResuming(v) {
    getUrlWithResuming = v;
  }

}, 4);
let execFileSync;
module.link("../../../utils/processes", {
  execFileSync(v) {
    execFileSync = v;
  }

}, 5);
let ensureDependencies;
module.link("../../../cli/dev-bundle-helpers.js", {
  ensureDependencies(v) {
    ensureDependencies = v;
  }

}, 6);
let mkdtemp, pathJoin, chmod, statOrNull, readFile, createWriteStream, getDevBundle;
module.link("../../../fs/files", {
  mkdtemp(v) {
    mkdtemp = v;
  },

  pathJoin(v) {
    pathJoin = v;
  },

  chmod(v) {
    chmod = v;
  },

  statOrNull(v) {
    statOrNull = v;
  },

  readFile(v) {
    readFile = v;
  },

  createWriteStream(v) {
    createWriteStream = v;
  },

  getDevBundle(v) {
    getDevBundle = v;
  }

}, 7);
const NPM_DEPENDENCIES = {
  'browserstack-webdriver': '2.41.1',
  'browserstack-local': '1.3.0'
};
const USER = 'dev1141'; // A memoized key from BrowserStackClient._getBrowserStackKey.

let browserStackKey;

class BrowserStackClient extends Client {
  constructor(options) {
    super(options);
    enterJob({
      title: 'Installing BrowserStack WebDriver in Meteor tool'
    }, () => {
      ensureDependencies(NPM_DEPENDENCIES);
    });
    this.npmPackageExports = require('browserstack-webdriver'); // Capabilities which are allowed by selenium.

    this.config.seleniumOptions = this.config.seleniumOptions || {}; // Additional capabilities which are unique to BrowserStack.

    this.config.browserStackOptions = this.config.browserStackOptions || {};

    this._setName();
  }

  _setName() {
    const name = this.config.seleniumOptions.browserName || "default";
    const version = this.config.seleniumOptions.version || "";
    const device = this.config.browserStackOptions.realMobile && this.config.browserStackOptions.device || "";
    this.name = "BrowserStack: " + name + (version && " Version ".concat(version)) + (device && " (Device: ".concat(device, ")"));
  }

  connect() {
    const key = BrowserStackClient._getBrowserStackKey();

    if (!key) {
      throw new Error("BrowserStack key not found. Ensure that s3cmd is setup with " + "S3 credentials, or set BROWSERSTACK_ACCESS_KEY in your environment.");
    }

    const capabilities = _objectSpread(_objectSpread({
      // Authentication
      'browserstack.user': USER,
      'browserstack.key': key,
      // Use the BrowserStackLocal tunnel, to allow BrowserStack to
      // tunnel to the machine this server is runninng on.
      'browserstack.local': true,
      // Enabled the capturing of "Visual Logs" (i.e. Screenshots).
      'browserstack.debug': true,
      // On browsers that support it, capture the console
      'browserstack.console': 'errors'
    }, this.config.seleniumOptions), this.config.browserStackOptions);

    const triggerRequest = () => {
      this.driver = new this.npmPackageExports.Builder().usingServer('https://hub-cloud.browserstack.com/wd/hub').withCapabilities(capabilities).build();
      this.driver.get(this.url);
    };

    this._launchBrowserStackTunnel().then(triggerRequest).catch(e => {
      // In the event of an error, shut down the daemon.
      this.stop();
      throw e;
    });
  }

  stop() {
    this.driver && this.driver.quit();
    this.driver = null;
    this.tunnelProcess && this.tunnelProcess.stop(() => {});
    this.tunnelProcess = null;
  }

  static _getBrowserStackKey() {
    // Use the memoized version, first and foremost.
    if (typeof browserStackKey !== "undefined") {
      return browserStackKey;
    }

    if (process.env.BROWSERSTACK_ACCESS_KEY) {
      return browserStackKey = process.env.BROWSERSTACK_ACCESS_KEY;
    } // Try to get the credentials from S3 with the s3cmd tool.


    const outputDir = pathJoin(mkdtemp(), "key");
    const browserstackKey = "s3://meteor-browserstack-keys/browserstack-key";

    try {
      execFileSync("s3cmd", ["get", browserstackKey, outputDir]);
      return browserStackKey = readFile(outputDir, "utf8").trim();
    } catch (e) {
      // A failure is acceptable here; it was just a try.
      console.warn("Failed to load browserstack key from \n        ".concat(browserstackKey), e);
    }

    return browserStackKey = null;
  }

  _launchBrowserStackTunnel() {
    this.tunnelProcess = new (require('browserstack-local').Local)();
    const options = {
      key: this.constructor._getBrowserStackKey(),
      onlyAutomate: true,
      verbose: true,
      // The ",0" means "SSL off".  It's localhost, after all.
      only: "".concat(this.host, ",").concat(this.port, ",0")
    };
    return new Promise((resolve, reject) => {
      this.tunnelProcess.start(options, err => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  static prerequisitesMet() {
    return !!this._getBrowserStackKey();
  }

  static pushClients(clients, appConfig) {
    configuredClients.forEach(client => {
      clients.push(new BrowserStackClient(_objectSpread(_objectSpread({}, appConfig), {}, {
        config: {
          seleniumOptions: client.selenium,
          browserStackOptions: client.browserstack
        }
      })));
    });
  }

}
//# sourceMappingURL=index.js.map