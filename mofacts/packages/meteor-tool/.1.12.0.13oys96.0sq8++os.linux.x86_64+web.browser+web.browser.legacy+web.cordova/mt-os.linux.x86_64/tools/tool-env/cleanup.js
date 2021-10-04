module.export({
  onExit: () => onExit
});
let noYieldsAllowed;
module.link("../utils/fiber-helpers.js", {
  noYieldsAllowed(v) {
    noYieldsAllowed = v;
  }

}, 0);
const exitHandlers = [];

function onExit(func) {
  exitHandlers.push(func);
}

function runHandlers() {
  noYieldsAllowed(() => {
    // Empty and execute all queued exit handlers.
    exitHandlers.splice(0).forEach(f => {
      f();
    });
  });
}

process.on('exit', runHandlers);
['SIGINT', 'SIGHUP', 'SIGTERM'].forEach(sig => {
  process.once(sig, () => {
    runHandlers();
    process.kill(process.pid, sig);
  });
});
//# sourceMappingURL=cleanup.js.map