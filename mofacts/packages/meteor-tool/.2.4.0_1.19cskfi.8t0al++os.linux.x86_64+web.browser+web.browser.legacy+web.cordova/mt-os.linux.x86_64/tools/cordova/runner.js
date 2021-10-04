module.export({
  CordovaRunner: () => CordovaRunner
});

let _;

module.link("underscore", {
  default(v) {
    _ = v;
  }

}, 0);
let buildmessage;
module.link("../utils/buildmessage.js", {
  default(v) {
    buildmessage = v;
  }

}, 1);
let runLog;
module.link("../runners/run-log.js", {
  default(v) {
    runLog = v;
  }

}, 2);
let Console;
module.link("../console/console.js", {
  Console(v) {
    Console = v;
  }

}, 3);
let main;
module.link("../cli/main.js", {
  default(v) {
    main = v;
  }

}, 4);
let displayNameForPlatform, prepareProjectForBuild;
module.link("./index.js", {
  displayNameForPlatform(v) {
    displayNameForPlatform = v;
  },

  prepareProjectForBuild(v) {
    prepareProjectForBuild = v;
  }

}, 5);

class CordovaRunner {
  constructor(cordovaProject, runTargets) {
    this.cordovaProject = cordovaProject;
    this.runTargets = runTargets;
    this.started = false;
  }

  get projectContext() {
    return this.cordovaProject.projectContext;
  }

  get platformsForRunTargets() {
    return _.uniq(this.runTargets.map(runTarget => runTarget.platform));
  }

  checkPlatformsForRunTargets() {
    this.cordovaProject.ensurePlatformsAreSynchronized();
    let satisfied = true;
    const messages = buildmessage.capture({
      title: "checking platform requirements"
    }, () => {
      for (const platform of this.platformsForRunTargets) {
        satisfied = this.cordovaProject.checkPlatformRequirements(platform) && satisfied;
      }
    });

    if (messages.hasMessages()) {
      Console.printMessages(messages);
      throw new main.ExitWithCode(1);
    } else if (!satisfied) {
      throw new main.ExitWithCode(1);
    }

    ;
  }

  printWarningsIfNeeded() {
    // OAuth2 packages don't work so well with any mobile platform except the
    // iOS Simulator. Print a warning and direct users to the wiki page for help.
    if (this.projectContext.packageMap.getInfo('oauth2')) {
      Console.warn();
      Console.labelWarn("It looks like you are using OAuth2 login in your app. " + "Meteor's OAuth2 implementation does not currently work with " + "mobile apps in local development mode, except in the iOS " + "simulator. You can run the iOS simulator with 'meteor run ios'. " + "For additional workarounds, see " + Console.url("https://github.com/meteor/meteor/wiki/" + "OAuth-for-mobile-Meteor-clients."));
    } // If we are targeting remote devices, warn about ports and same network.


    if (_.findWhere(this.runTargets, {
      isDevice: true
    })) {
      Console.warn();
      Console.labelWarn("You are testing your app on a remote device. " + "For the mobile app to be able to connect to the local server, make " + "sure your device is on the same network, and that the network " + "configuration allows clients to talk to each other " + "(no client isolation).");
    }
  }

  prepareProject(bundlePath, pluginVersions, options) {
    buildmessage.assertInCapture();
    buildmessage.enterJob({
      title: "preparing Cordova project"
    }, () => {
      this.cordovaProject.prepareFromAppBundle(bundlePath, pluginVersions, options);

      if (buildmessage.jobHasMessages()) {
        return;
      }

      for (let platform of this.platformsForRunTargets) {
        this.cordovaProject.prepareForPlatform(platform, options);
      }
    });
    this.pluginVersions = pluginVersions;
  }

  startRunTargets() {
    this.started = false;

    for (let runTarget of this.runTargets) {
      const messages = buildmessage.capture({
        title: "starting ".concat(runTarget.title)
      }, () => {
        Promise.await(runTarget.start(this.cordovaProject));
      });

      if (messages.hasMessages()) {
        Console.printMessages(messages);
      } else {
        runLog.log("Started ".concat(runTarget.title, "."), {
          arrow: true
        });
      }
    }

    this.started = true;
  }

  havePlatformsChangedSinceLastRun() {
    const platformsForRunTargets = this.platformsForRunTargets;

    if (!platformsForRunTargets) {
      return false;
    }

    const cordovaPlatformsInApp = this.cordovaProject.cordovaPlatformsInApp;
    return !_.isEqual(platformsForRunTargets, _.intersection(platformsForRunTargets, cordovaPlatformsInApp));
  }

  havePluginsChangedSinceLastRun(pluginVersions) {
    return this.pluginVersions && !_.isEqual(this.pluginVersions, pluginVersions);
  }

}
//# sourceMappingURL=runner.js.map