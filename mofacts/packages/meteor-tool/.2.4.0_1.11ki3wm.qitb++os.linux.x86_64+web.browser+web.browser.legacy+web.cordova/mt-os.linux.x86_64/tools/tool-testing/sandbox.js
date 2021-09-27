!function (module1) {
  module1.export({
    default: () => Sandbox
  });
  let files;
  module1.link("../fs/files", {
    "*"(v) {
      files = v;
    }

  }, 0);
  let PhantomClient;
  module1.link("./clients/phantom/index.js", {
    default(v) {
      PhantomClient = v;
    }

  }, 1);
  let PuppeteerClient;
  module1.link("./clients/puppeteer/index.js", {
    default(v) {
      PuppeteerClient = v;
    }

  }, 2);
  let BrowserStackClient;
  module1.link("./clients/browserstack/index.js", {
    default(v) {
      BrowserStackClient = v;
    }

  }, 3);
  let Builder;
  module1.link("../isobuild/builder.js", {
    default(v) {
      Builder = v;
    }

  }, 4);
  let Run;
  module1.link("./run.js", {
    default(v) {
      Run = v;
    }

  }, 5);
  let Console;
  module1.link("../console/console.js", {
    Console(v) {
      Console = v;
    }

  }, 6);
  let getPackagesDirectoryName, getPackageStorage;
  module1.link("../meteor-services/config.js", {
    getPackagesDirectoryName(v) {
      getPackagesDirectoryName = v;
    },

    getPackageStorage(v) {
      getPackageStorage = v;
    }

  }, 7);
  let archInfoHost;
  module1.link("../utils/archinfo", {
    host(v) {
      archInfoHost = v;
    }

  }, 8);
  let releaseCurrent;
  module1.link("../packaging/release.js", {
    current(v) {
      releaseCurrent = v;
    }

  }, 9);
  let FinishedUpgraders;
  module1.link("../project-context.js", {
    FinishedUpgraders(v) {
      FinishedUpgraders = v;
    }

  }, 10);
  let allUpgraders;
  module1.link("../upgraders.js", {
    allUpgraders(v) {
      allUpgraders = v;
    }

  }, 11);
  let DEFAULT_TRACK;
  module1.link("../packaging/catalog/catalog.js", {
    DEFAULT_TRACK(v) {
      DEFAULT_TRACK = v;
    }

  }, 12);
  let RemoteCatalog;
  module1.link("../packaging/catalog/catalog-remote.js", {
    RemoteCatalog(v) {
      RemoteCatalog = v;
    }

  }, 13);
  let IsopackCache;
  module1.link("../isobuild/isopack-cache.js", {
    IsopackCache(v) {
      IsopackCache = v;
    }

  }, 14);
  let randomToken;
  module1.link("../utils/utils.js", {
    randomToken(v) {
      randomToken = v;
    }

  }, 15);
  let Tropohouse;
  module1.link("../packaging/tropohouse.js", {
    Tropohouse(v) {
      Tropohouse = v;
    }

  }, 16);
  let PackageMap;
  module1.link("../packaging/package-map.js", {
    PackageMap(v) {
      PackageMap = v;
    }

  }, 17);
  let capture, enterJob;
  module1.link("../utils/buildmessage.js", {
    capture(v) {
      capture = v;
    },

    enterJob(v) {
      enterJob = v;
    }

  }, 18);
  const hasOwn = Object.prototype.hasOwnProperty;

  class Sandbox {
    constructor() {
      let options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      this.options = options;
      this.root = files.mkdtemp();
      this.warehouse = null;
      this.home = files.pathJoin(this.root, 'home');
      files.mkdir(this.home, 493);
      this.cwd = this.home;
      this.env = {};
      this.fakeMongo = this.options.fakeMongo;

      if (hasOwn.call(this.options, 'warehouse')) {
        if (!files.inCheckout()) {
          throw Error("Fake warehouses are only possible when running from a checkout");
        }

        this.warehouse = files.pathJoin(this.root, 'tropohouse');

        this._makeWarehouse(this.options.warehouse);
      }

      const meteorScript = process.platform === "win32" ? "meteor.bat" : "meteor"; // Figure out the 'meteor' to run

      if (this.warehouse) {
        this.execPath = files.pathJoin(this.warehouse, meteorScript);
      } else {
        this.execPath = files.pathJoin(files.getCurrentToolsDir(), meteorScript);
      }
    } // Create a new test run of the tool in this sandbox.


    run() {
      for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
      }

      return new Run(this.execPath, {
        sandbox: this,
        args,
        cwd: this.cwd,
        env: this._makeEnv(),
        fakeMongo: this.fakeMongo
      });
    } // Tests a set of clients with the argument function. Each call to f(run)
    // instantiates a Run with a different client.
    // Use:
    // sandbox.testWithAllClients(function (run) {
    //   // pre-connection checks
    //   run.connectClient();
    //   // post-connection checks
    // });


    testWithAllClients(f, options) {
      const {
        testName,
        testFile,
        args: argsParam
      } = options || {};
      const args = (argsParam || []).filter(arg => arg); // Lazy-populate the clients, only when this method is called.

      if (typeof this.clients === "undefined") {
        this.clients = [];
        const clientOptions = this.options.clients || {};
        const appConfig = {
          host: 'localhost',
          port: clientOptions.port || 3000
        };

        if (clientOptions.phantom) {
          PhantomClient.pushClients(this.clients, appConfig);
        }

        if (clientOptions.puppeteer) {
          PuppeteerClient.pushClients(this.clients, appConfig);
        }

        if (clientOptions.browserstack && BrowserStackClient.prerequisitesMet()) {
          BrowserStackClient.pushClients(this.clients, appConfig);
        }
      }

      const testNameAndFile = "".concat(testFile ? "".concat(testFile, ": ") : '').concat(testName ? "\"".concat(testName, "\" ") : '');
      console.log("Running test ".concat(testNameAndFile, "with ").concat(this.clients.length, " client(s)..."));
      Object.keys(this.clients).forEach((clientKey, index, array) => {
        const client = this.clients[clientKey];
        console.log("(".concat(index + 1, "/").concat(array.length, ") Testing ").concat(testNameAndFile, "with ").concat(client.name, "..."));
        const run = new Run(this.execPath, {
          sandbox: this,
          args,
          cwd: this.cwd,
          env: this._makeEnv(),
          fakeMongo: this.fakeMongo,
          client
        });
        run.baseTimeout = client.timeout;
        f(run);
      });
    } // Copy an app from a template into the current directory in the
    // sandbox. 'to' is the subdirectory to put the app in, and
    // 'template' is a subdirectory of tools/tests/apps to copy.
    //
    // Note that the arguments are the opposite order from 'cp'. That
    // seems more intuitive to me -- if you disagree, my apologies.
    //
    // For example:
    //   s.createApp('myapp', 'empty');
    //   s.cd('myapp');


    createApp(to, template, options) {
      options = options || {};
      const absoluteTo = files.pathJoin(this.cwd, to);
      const absoluteFrom = files.pathJoin(files.convertToStandardPath(__dirname), '..', 'tests', 'apps', template);
      files.cp_r(absoluteFrom, absoluteTo, {
        ignore: [/^local$/],
        preserveSymlinks: true
      }); // If the test isn't explicitly managing a mock warehouse, ensure that apps
      // run with our release by default.

      if (options.release) {
        this.write(files.pathJoin(to, '.meteor/release'), options.release);
      } else if (!this.warehouse && releaseCurrent.isProperRelease()) {
        this.write(files.pathJoin(to, '.meteor/release'), releaseCurrent.name);
      } // Make sure the apps don't run any upgraders, unless they intentionally
      // have a partial upgraders file


      const upgradersFile = new FinishedUpgraders({
        projectDir: absoluteTo
      });

      if (upgradersFile.readUpgraders().length === 0) {
        upgradersFile.appendUpgraders(allUpgraders());
      }

      require("../cli/default-npm-deps.js").install(absoluteTo);

      if (options.dontPrepareApp) {
        return;
      } // Prepare the app (ie, build or download packages). We give this a nice
      // long timeout, which allows the next command to not need a bloated
      // timeout. (meteor create does this anyway.)


      this.cd(to, () => {
        const run = this.run("--prepare-app"); // XXX Can we cache the output of running this once somewhere, so that
        // multiple calls to createApp with the same template get the same cache?
        // This is a little tricky because isopack-buildinfo.json uses absolute
        // paths.

        run.waitSecs(120);
        run.expectExit(0);
      });
    } // Same as createApp, but with a package.
    //
    // @param packageDir  {String} The directory in which to create the package
    // @param packageName {String} The package name to create. This string will
    //                             replace all appearances of ~package-name~
    //                             in any package*.js files in the template
    // @param template    {String} The package template to use. Found as a
    //                             subdirectory in tests/packages/
    //
    // For example:
    //   s.createPackage('me_mypack', me:mypack', 'empty');
    //   s.cd('me_mypack');


    createPackage(packageDir, packageName, template) {
      const packagePath = files.pathJoin(this.cwd, packageDir);
      const templatePackagePath = files.pathJoin(files.convertToStandardPath(__dirname), '..', 'tests', 'packages', template);
      files.cp_r(templatePackagePath, packagePath, {
        preserveSymlinks: true
      });
      files.readdir(packagePath).forEach(file => {
        if (file.match(/^package.*\.js$/)) {
          const packageJsFile = files.pathJoin(packagePath, file);
          files.writeFile(packageJsFile, files.readFile(packageJsFile, "utf8").replace("~package-name~", packageName));
        }
      });
    } // Change the cwd to be used for subsequent runs. For example:
    //   s.run('create', 'myapp').expectExit(0);
    //   s.cd('myapp');
    //   s.run('add', 'somepackage') ...
    // If you provide a callback, it will invoke the callback and then
    // change the cwd back to the previous value.  eg:
    //   s.cd('app1', function () {
    //     s.run('add', 'somepackage');
    //   });
    //   s.cd('app2', function () {
    //     s.run('add', 'somepackage');
    //   });


    cd(relativePath, callback) {
      const previous = this.cwd;
      this.cwd = files.pathResolve(this.cwd, relativePath);

      if (callback) {
        callback();
        this.cwd = previous;
      }
    } // Set an environment variable for subsequent runs.


    set(name, value) {
      this.env[name] = value;
    } // Undo set().


    unset(name) {
      delete this.env[name];
    } // Write to a file in the sandbox, overwriting its current contents
    // if any. 'filename' is a path intepreted relative to the Sandbox's
    // cwd. 'contents' is a string (utf8 is assumed).


    write(filename, contents) {
      files.writeFile(files.pathJoin(this.cwd, filename), contents, 'utf8');
    } // Like writeFile, but appends rather than writes.


    append(filename, contents) {
      files.appendFile(files.pathJoin(this.cwd, filename), contents, 'utf8');
    } // Reads a file in the sandbox as a utf8 string. 'filename' is a
    // path intepreted relative to the Sandbox's cwd.  Returns null if
    // file does not exist.


    read(filename) {
      const file = files.pathJoin(this.cwd, filename);

      if (!files.exists(file)) {
        return null;
      } else {
        return files.readFile(files.pathJoin(this.cwd, filename), 'utf8');
      }
    } // Copy the contents of one file to another.  In these series of tests, we often
    // want to switch contents of package.js files. It is more legible to copy in
    // the backup file rather than trying to write into it manually.


    cp(from, to) {
      const contents = this.read(from);

      if (!contents) {
        throw new Error("File " + from + " does not exist.");
      }

      ;
      this.write(to, contents);
    } // Delete a file in the sandbox. 'filename' is as in write().


    unlink(filename) {
      files.unlink(files.pathJoin(this.cwd, filename));
    } // Make a directory in the sandbox. 'filename' is as in write().


    mkdir(dirname) {
      const dirPath = files.pathJoin(this.cwd, dirname);

      if (!files.exists(dirPath)) {
        files.mkdir(dirPath);
      }
    } // Rename something in the sandbox. 'oldName' and 'newName' are as in write().


    rename(oldName, newName) {
      files.rename(files.pathJoin(this.cwd, oldName), files.pathJoin(this.cwd, newName));
    } // Return the current contents of .meteorsession in the sandbox.


    readSessionFile() {
      return files.readFile(files.pathJoin(this.root, '.meteorsession'), 'utf8');
    } // Overwrite .meteorsession in the sandbox with 'contents'. You
    // could use this in conjunction with readSessionFile to save and
    // restore authentication states.


    writeSessionFile(contents) {
      return files.writeFile(files.pathJoin(this.root, '.meteorsession'), contents, 'utf8');
    }

    _makeEnv() {
      const env = Object.assign(Object.create(null), this.env);
      env.METEOR_SESSION_FILE = files.convertToOSPath(files.pathJoin(this.root, '.meteorsession'));

      if (this.warehouse) {
        // Tell it where the warehouse lives.
        env.METEOR_WAREHOUSE_DIR = files.convertToOSPath(this.warehouse); // Don't ever try to refresh the stub catalog we made.

        env.METEOR_OFFLINE_CATALOG = "t";
      } // By default (ie, with no mock warehouse and no --release arg) we should be
      // testing the actual release this is built in, so we pretend that it is the
      // latest release.


      if (!this.warehouse && releaseCurrent.isProperRelease()) {
        env.METEOR_TEST_LATEST_RELEASE = releaseCurrent.name;
      } // Allow user to set TOOL_NODE_FLAGS for self-test app.


      if (process.env.TOOL_NODE_FLAGS && !process.env.SELF_TEST_TOOL_NODE_FLAGS) console.log('Consider setting SELF_TEST_TOOL_NODE_FLAGS to configure ' + 'self-test test application spawns');
      env.TOOL_NODE_FLAGS = process.env.SELF_TEST_TOOL_NODE_FLAGS || '';
      return env;
    } // Writes a stub warehouse (really a tropohouse) to the directory
    // this.warehouse. This warehouse only contains a meteor-tool package and some
    // releases containing that tool only (and no packages).
    //
    // packageServerUrl indicates which package server we think we are using. Use
    // the default, if we do not pass this in; you should pass it in any case that
    // you will be specifying $METEOR_PACKAGE_SERVER_URL in the environment of a
    // command you are running in this sandbox.


    _makeWarehouse(releases) {
      // Ensure we have a tropohouse to copy stuff out of.
      setUpBuiltPackageTropohouse();
      const serverUrl = this.env.METEOR_PACKAGE_SERVER_URL;
      const packagesDirectoryName = getPackagesDirectoryName(serverUrl);
      const builder = new Builder({
        outputPath: this.warehouse
      });
      builder.copyDirectory({
        from: files.pathJoin(builtPackageTropohouseDir, 'packages'),
        to: packagesDirectoryName,
        symlink: true
      });
      builder.complete();
      const stubCatalog = {
        syncToken: {},
        formatVersion: "1.0",
        collections: {
          packages: [],
          versions: [],
          builds: [],
          releaseTracks: [],
          releaseVersions: []
        }
      };
      const packageVersions = {};
      let toolPackageVersion = null;
      tropohouseIsopackCache.eachBuiltIsopack((packageName, isopack) => {
        const packageRec = tropohouseLocalCatalog.getPackage(packageName);

        if (!packageRec) {
          throw Error("no package record for " + packageName);
        }

        stubCatalog.collections.packages.push(packageRec);
        const versionRec = tropohouseLocalCatalog.getLatestVersion(packageName);

        if (!versionRec) {
          throw Error("no version record for " + packageName);
        }

        stubCatalog.collections.versions.push(versionRec);
        stubCatalog.collections.builds.push({
          buildArchitectures: isopack.buildArchitectures(),
          versionId: versionRec._id,
          _id: randomToken()
        });

        if (packageName === "meteor-tool") {
          toolPackageVersion = versionRec.version;
        } else {
          packageVersions[packageName] = versionRec.version;
        }
      });

      if (!toolPackageVersion) {
        throw Error("no meteor-tool?");
      }

      stubCatalog.collections.releaseTracks.push({
        name: DEFAULT_TRACK,
        _id: randomToken()
      }); // Now create each requested release.

      Object.keys(releases).forEach(releaseName => {
        const configuration = releases[releaseName]; // Release info

        stubCatalog.collections.releaseVersions.push({
          track: DEFAULT_TRACK,
          _id: Math.random().toString(),
          version: releaseName,
          orderKey: releaseName,
          description: "test release " + releaseName,
          recommended: !!configuration.recommended,
          tool: configuration.tool || "meteor-tool@" + toolPackageVersion,
          packages: packageVersions
        });
      });
      const dataFile = getPackageStorage({
        root: this.warehouse,
        serverUrl: serverUrl
      });
      this.warehouseOfficialCatalog = new RemoteCatalog();
      this.warehouseOfficialCatalog.initialize({
        packageStorage: dataFile
      });
      this.warehouseOfficialCatalog.insertData(stubCatalog); // And a cherry on top
      // XXX this is hacky

      files.linkToMeteorScript(files.pathJoin(this.warehouse, packagesDirectoryName, "meteor-tool", toolPackageVersion, 'mt-' + archInfoHost(), 'meteor'), files.pathJoin(this.warehouse, 'meteor'));
    }

  }

  function doOrThrow(f) {
    let ret;
    const messages = capture(function () {
      ret = f();
    });

    if (messages.hasMessages()) {
      throw Error(messages.formatMessages());
    }

    return ret;
  }

  function setUpBuiltPackageTropohouse() {
    if (builtPackageTropohouseDir) {
      return;
    }

    builtPackageTropohouseDir = files.mkdtemp('built-package-tropohouse');

    if (getPackagesDirectoryName() !== 'packages') {
      throw Error("running self-test with METEOR_PACKAGE_SERVER_URL set?");
    }

    const tropohouse = new Tropohouse(builtPackageTropohouseDir);
    tropohouseLocalCatalog = newSelfTestCatalog();
    const versions = {};
    tropohouseLocalCatalog.getAllNonTestPackageNames().forEach(packageName => {
      versions[packageName] = tropohouseLocalCatalog.getLatestVersion(packageName).version;
    });
    const packageMap = new PackageMap(versions, {
      localCatalog: tropohouseLocalCatalog
    }); // Make an isopack cache that doesn't automatically save isopacks to disk and
    // has no access to versioned packages.

    tropohouseIsopackCache = new IsopackCache({
      packageMap: packageMap,
      includeCordovaUnibuild: true
    });
    doOrThrow(function () {
      enterJob("building self-test packages", () => {
        // Build the packages into the in-memory IsopackCache.
        tropohouseIsopackCache.buildLocalPackages(ROOT_PACKAGES_TO_BUILD_IN_SANDBOX);
      });
    }); // Save all the isopacks into builtPackageTropohouseDir/packages.  (Note that
    // we are always putting them into the default 'packages' (assuming
    // $METEOR_PACKAGE_SERVER_URL is not set in the self-test process itself) even
    // though some tests will want them to be under
    // 'packages-for-server/test-packages'; we'll fix this in _makeWarehouse.

    tropohouseIsopackCache.eachBuiltIsopack((name, isopack) => {
      tropohouse._saveIsopack(isopack, name);
    });
  } // Our current strategy for running tests that need warehouses is to build all
  // packages from the checkout into this temporary tropohouse directory, and for
  // each test that need a fake warehouse, copy the built packages into the
  // test-specific warehouse directory.  This isn't particularly fast, but it'll
  // do for now. We build the packages during the first test that needs them.


  let builtPackageTropohouseDir = null;
  let tropohouseLocalCatalog = null;
  let tropohouseIsopackCache = null; // Let's build a minimal set of packages that's enough to get self-test
  // working.  (And that doesn't need us to download any Atmosphere packages.)

  const ROOT_PACKAGES_TO_BUILD_IN_SANDBOX = [// We need the tool in order to run from the fake warehouse at all.
  "meteor-tool", // We need the packages in the skeleton app in order to test 'meteor create'.
  'meteor-base', 'mobile-experience', 'mongo', 'blaze-html-templates', 'blaze-hot', 'hot-module-replacement', "jquery", // necessary when using Blaze
  'session', 'tracker', "autopublish", "insecure", "standard-minifier-css", "standard-minifier-js", "es5-shim", "shell-server", "modern-browsers", "ecmascript", "typescript"];

  function newSelfTestCatalog() {
    if (!files.inCheckout()) {
      throw Error("Only can build packages from a checkout");
    }

    const catalogLocal = require('../packaging/catalog/catalog-local.js');

    const selfTestCatalog = new catalogLocal.LocalCatalog();
    const messages = capture({
      title: "scanning local core packages"
    }, () => {
      const packagesDir = files.pathJoin(files.getCurrentToolsDir(), 'packages'); // When building a fake warehouse from a checkout, we use local packages,
      // but *ONLY THOSE FROM THE CHECKOUT*: not app packages or $PACKAGE_DIRS
      // packages.  One side effect of this: we really really expect them to all
      // build, and we're fine with dying if they don't (there's no worries
      // about needing to springboard).

      selfTestCatalog.initialize({
        localPackageSearchDirs: [packagesDir, files.pathJoin(packagesDir, "non-core"), files.pathJoin(packagesDir, "non-core", "*", "packages")]
      });
    });

    if (messages.hasMessages()) {
      Console.arrowError("Errors while scanning core packages:");
      Console.printMessages(messages);
      throw new Error("scan failed?");
    }

    return selfTestCatalog;
  }
}.call(this, module);
//# sourceMappingURL=sandbox.js.map