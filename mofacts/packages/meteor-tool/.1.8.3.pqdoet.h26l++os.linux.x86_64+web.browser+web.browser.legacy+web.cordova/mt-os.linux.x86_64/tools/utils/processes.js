let _objectSpread;

module.link("@babel/runtime/helpers/objectSpread2", {
  default(v) {
    _objectSpread = v;
  }

}, 0);
module.export({
  execFileSync: () => execFileSync,
  execFileAsync: () => execFileAsync
});
let child_process;
module.link("child_process", {
  default(v) {
    child_process = v;
  }

}, 0);
let convertToOSPath;
module.link("../static-assets/server/mini-files", {
  convertToOSPath(v) {
    convertToOSPath = v;
  }

}, 1);

function execFileSync(command, args, options) {
  const meteorPromise = Promise; // TypeScript doesn't recognize "Promise.await"

  return meteorPromise.await(execFileAsync(command, args, options));
}

function execFileAsync(command, args) {
  let options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {
    waitForClose: true
  };

  // args is optional, so if it's not an array we interpret it as options
  if (!Array.isArray(args)) {
    options = _objectSpread({}, options, {}, args);
  }

  if (options.cwd) {
    options.cwd = convertToOSPath(options.cwd);
  } // The child process close event is emitted when the stdio streams
  // have all terminated. If those streams are shared with other
  // processes, that means we won't receive a 'close' until all processes
  // have exited, so we may want to respond to 'exit' instead.
  // (The downside of responding to 'exit' is that the streams may not be
  // fully flushed, so we could miss captured output. Only use this
  // option when needed.)


  const exitEvent = options.waitForClose ? 'close' : 'exit';
  return new Promise((resolve, reject) => {
    let child;
    const spawnArgs = Array.isArray(args) ? args : [];
    const {
      cwd,
      env,
      stdio
    } = options;

    if (process.platform !== 'win32') {
      child = child_process.spawn(command, spawnArgs, {
        cwd,
        env,
        stdio
      });
    } else {
      // https://github.com/nodejs/node-v0.x-archive/issues/2318
      spawnArgs.forEach(arg => {
        command += ' ' + arg;
      });
      child = child_process.exec(command, {
        cwd,
        env
      });
    }

    let capturedStdout = '';

    if (child.stdout) {
      if (options.destination) {
        child.stdout.pipe(options.destination);
      } else {
        child.stdout.setEncoding('utf8');
        child.stdout.on('data', data => {
          capturedStdout += data;
        });
      }
    }

    let capturedStderr = '';

    if (child.stderr) {
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', data => {
        capturedStderr += data;
      });
    }

    const errorCallback = error => {
      // Make sure we only receive one type of callback
      child.removeListener(exitEvent, exitCallback); // Trim captured output to get rid of excess whitespace

      capturedStdout = capturedStdout.trim();
      capturedStderr = capturedStderr.trim();
      Object.assign(error, {
        pid: child.pid,
        stdout: capturedStdout,
        stderr: capturedStderr
      }); // Set a more informative error message on ENOENT, that includes the
      // command we attempted to execute

      if (error.code === 'ENOENT') {
        error.message = "Could not find command '".concat(command, "'");
      }

      reject(error);
    };

    child.on('error', errorCallback);

    const exitCallback = (code, signal) => {
      // Make sure we only receive one type of callback
      child.removeListener('error', errorCallback); // Trim captured output to get rid of excess whitespace

      capturedStdout = capturedStdout.trim();
      capturedStderr = capturedStderr.trim();

      if (code === 0) {
        resolve(capturedStdout);
      } else {
        let errorMessage = "Command failed: ".concat(command);

        if (spawnArgs) {
          errorMessage += " ".concat(spawnArgs.join(' '));
        }

        errorMessage += "\n".concat(capturedStderr);
        const error = new Error(errorMessage);
        Object.assign(error, {
          pid: child.pid,
          stdout: capturedStdout,
          stderr: capturedStderr,
          status: code,
          signal: signal
        });
        reject(error);
      }
    };

    child.on(exitEvent, exitCallback);
  });
}
//# sourceMappingURL=processes.js.map