module.export({
  CordovaRunTarget: () => CordovaRunTarget,
  iOSRunTarget: () => iOSRunTarget,
  AndroidRunTarget: () => AndroidRunTarget
});

let _;

module.link("underscore", {
  default(v) {
    _ = v;
  }

}, 0);
let chalk;
module.link("chalk", {
  default(v) {
    chalk = v;
  }

}, 1);
let child_process;
module.link("child_process", {
  default(v) {
    child_process = v;
  }

}, 2);
let loadIsopackage;
module.link("../tool-env/isopackets.js", {
  loadIsopackage(v) {
    loadIsopackage = v;
  }

}, 3);
let runLog;
module.link("../runners/run-log.js", {
  default(v) {
    runLog = v;
  }

}, 4);
let Console;
module.link("../console/console.js", {
  Console(v) {
    Console = v;
  }

}, 5);
let files;
module.link("../fs/files", {
  default(v) {
    files = v;
  }

}, 6);
let execFileSync, execFileAsync;
module.link("../utils/processes", {
  execFileSync(v) {
    execFileSync = v;
  },

  execFileAsync(v) {
    execFileAsync = v;
  }

}, 7);

class CordovaRunTarget {
  get title() {
    return "app on ".concat(this.displayName);
  }

}

class iOSRunTarget extends CordovaRunTarget {
  constructor(isDevice) {
    super();
    this.platform = 'ios';
    this.isDevice = isDevice;
  }

  get displayName() {
    return this.isDevice ? "iOS Device" : "iOS Simulator";
  }

  start(cordovaProject) {
    return Promise.asyncApply(() => {
      // ios-deploy is super buggy, so we just open Xcode and let the user
      // start the app themselves.
      if (this.isDevice) {
        openXcodeProject(files.pathJoin(cordovaProject.projectRoot, 'platforms', 'ios'));
      } else {
        Promise.await(cordovaProject.run(this.platform, this.isDevice, undefined)); // Bring iOS Simulator to front (it is called Simulator in Xcode 7)

        execFileAsync('osascript', ['-e', "tell application \"System Events\"\n  set possibleSimulatorNames to {\"iOS Simulator\", \"Simulator\"}\n  repeat with possibleSimulatorName in possibleSimulatorNames\n    if application process possibleSimulatorName exists then\n      set frontmost of process possibleSimulatorName to true\n    end if\n  end repeat\nend tell"]);
      }
    });
  }

}

function openXcodeProject(projectDir) {
  const projectFilename = files.readdir(projectDir).filter(entry => {
    return entry.match(/\.xcodeproj$/i);
  })[0];

  if (!projectFilename) {
    printFailure("Couldn't find your Xcode project in directory '".concat(files.convertToOSPath(projectDir), "'"));
    return;
  }

  try {
    execFileSync('open', ['-a', 'Xcode', projectDir]);
    Console.info();
    Console.info(chalk.green("Your project has been opened in Xcode so that you can run your " + "app on an iOS device. For further instructions, visit this " + "wiki page: ") + Console.url("https://guide.meteor.com/cordova.html#running-on-ios"));
    Console.info();
  } catch (error) {
    printFailure("Failed to open your project in Xcode:\n".concat(error.message));
  }

  function printFailure(message) {
    Console.error();
    Console.error(message);
    Console.error(chalk.green("Instructions for running your app on an iOS device: ") + Console.url("https://guide.meteor.com/cordova.html#running-on-ios"));
    Console.error();
  }
}

class AndroidRunTarget extends CordovaRunTarget {
  constructor(isDevice) {
    super();
    this.platform = 'android';
    this.isDevice = isDevice;
  }

  get displayName() {
    return this.isDevice ? "Android Device" : "Android Emulator";
  }

  start(cordovaProject) {
    return Promise.asyncApply(() => {
      // XXX This only works if we have at most one device or one emulator
      // connected. We should find a way to get the target ID from run and use
      // it instead of -d or -e.
      let target = this.isDevice ? "-d" : "-e"; // Clear logs

      execFileAsync('adb', [target, 'logcat', '-c']);
      Promise.await(cordovaProject.run(this.platform, this.isDevice));
      this.tailLogs(cordovaProject, target).done();
    });
  }

  checkPlatformRequirementsAndSetEnv(cordovaProject) {
    return Promise.asyncApply(() => {
      // Cordova Android is fairly good at applying various heuristics to find
      // suitable values for JAVA_HOME and ANDROID_HOME, and to augment the PATH
      // with those variables.
      // Unfortunately, this is intertwined with checking requirements, so the
      // only way to get access to this functionality is to run check_reqs and
      // let it modify process.env
      var check_reqs_path = files.pathJoin(cordovaProject.projectRoot, 'platforms', this.platform, 'cordova', 'lib', 'check_reqs');
      check_reqs_path = files.convertToOSPath(check_reqs_path);

      let check_reqs = require(check_reqs_path); // We can't use check_reqs.run() because that will print the values of
      // JAVA_HOME and ANDROID_HOME to stdout.


      Promise.await(Promise.all([check_reqs.check_java(), check_reqs.check_android().then(check_reqs.check_android_target)]));
    });
  }

  tailLogs(cordovaProject, target) {
    return Promise.asyncApply(() => {
      const {
        transform
      } = require("../utils/eachline");

      cordovaProject.runCommands("tailing logs for ".concat(this.displayName), () => Promise.asyncApply(() => {
        Promise.await(this.checkPlatformRequirementsAndSetEnv(cordovaProject));
        const logLevel = Console.verbose ? "V" : "I";
        const filterExpressions = ["MeteorWebApp:".concat(logLevel), "CordovaLog:".concat(logLevel), "chromium:".concat(logLevel), "SystemWebViewClient:".concat(logLevel), '*:F'];
        const {
          Log
        } = loadIsopackage('logging');
        const logStream = transform(line => {
          const logEntry = logFromAndroidLogcatLine(Log, line);

          if (logEntry) {
            return "".concat(logEntry, "\n");
          }
        });
        logStream.pipe(process.stdout); // Asynchronously start tailing logs to stdout

        execFileAsync('adb', [target, 'logcat', ...filterExpressions], {
          destination: logStream
        });
      }));
    });
  }

}

function logFromAndroidLogcatLine(Log, line) {
  // Ignore lines indicating beginning of logging
  if (line.match(/^--------- beginning of /)) {
    return null;
  } // Matches logcat brief format
  // "I/Tag(  PID): message"


  let match = line.match(/^([A-Z])\/([^\(]*?)\(\s*(\d+)\): (.*)$/);
  let priority, tag, pid, message, logLevel, filename, lineNumber;

  if (match) {
    [, priority, tag, pid, message] = match;

    if (tag === 'chromium') {
      // Matches Chromium log format
      // [INFO:CONSOLE(23)] "Bla!", source: http://meteor.local/app/mobileapp.js (23)
      match = message.match(/^\[(.*):(.*)\((\d+)\)\] (.*)$/);

      if (match) {
        [, logLevel, filename, lineNumber, message] = match;

        if (filename === 'CONSOLE') {
          match = message.match(/^\"(.*)\", source: (.*) \((\d+)\)$/);

          if (match) {
            [, message, filename, lineNumber] = match;
            return logFromConsoleOutput(Log, message, filename, lineNumber);
          }
        }
      }
    } else if (tag === 'CordovaLog') {
      // http://meteor.local/mobileappold.js?3c198a97a802ad2c6eab52da0244245e30b964ed: Line 15 : Clicked!
      match = message.match(/^(.*): Line (\d+) : (.*)$/);

      if (match) {
        [, filename, lineNumber, message] = match;
        return logFromConsoleOutput(Log, message, filename, lineNumber);
      }
    }
  }

  return Log.format(Log.objFromText(line), {
    metaColor: 'green',
    color: true
  });
}

;

function logFromConsoleOutput(Log, message, filename, lineNumber) {
  if (isDebugOutput(message) && !Console.verbose) {
    return null;
  }

  filename = filename.replace(/\?.*$/, '');
  return Log.format({
    time: new Date(),
    level: 'info',
    file: filename,
    line: lineNumber,
    message: message,
    program: 'android'
  }, {
    metaColor: 'green',
    color: true
  });
}

function isDebugOutput(message) {
  // Skip the debug output produced by Meteor components.
  return /^METEOR CORDOVA DEBUG /.test(message) || /^HTTPD DEBUG /.test(message);
}

;
//# sourceMappingURL=run-targets.js.map