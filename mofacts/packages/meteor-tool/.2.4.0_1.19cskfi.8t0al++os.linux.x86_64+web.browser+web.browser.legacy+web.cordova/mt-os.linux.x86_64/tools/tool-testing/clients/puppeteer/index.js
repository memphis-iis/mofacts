module.export({
  default: () => PuppeteerClient
});
let Client;
module.link("../../client.js", {
  default(v) {
    Client = v;
  }

}, 0);
let enterJob;
module.link("../../../utils/buildmessage.js", {
  enterJob(v) {
    enterJob = v;
  }

}, 1);
let ensureDependencies;
module.link("../../../cli/dev-bundle-helpers.js", {
  ensureDependencies(v) {
    ensureDependencies = v;
  }

}, 2);
const NPM_DEPENDENCIES = {
  puppeteer: '8.0.0'
};

class PuppeteerClient extends Client {
  constructor(options) {
    super(options);
    enterJob({
      title: 'Installing Puppeteer in Meteor tool'
    }, () => {
      ensureDependencies(NPM_DEPENDENCIES);
    });
    this.npmPackageExports = require('puppeteer');
    this.name = 'Puppeteer';
  }

  connect() {
    return Promise.asyncApply(() => {
      // Note for Travis and CircleCI to run sandbox must be turned off.
      // From a security perspective this is not ideal, in the future would be worthwhile
      // to configure to include only for CI based setups
      this.browser = Promise.await(this.npmPackageExports.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }));
      this.page = Promise.await(this.browser.newPage());
      this.page.goto("http://".concat(this.host, ":").concat(this.port));
    });
  }

  stop() {
    return Promise.asyncApply(() => {
      this.page && Promise.await(this.page.close());
      this.page = null;
      this.browser && Promise.await(this.browser.close());
      this.browser = null;
    });
  }

  static pushClients(clients, appConfig) {
    clients.push(new PuppeteerClient(appConfig));
  }

}
//# sourceMappingURL=index.js.map