module.export({
  coalesce: () => coalesce
});

function coalesce(delayMs, callback, context) {
  let pending = false;
  let inProgress = 0;
  const actualDelayMs = delayMs || 100;

  function coalescingWrapper() {
    const self = context || this;

    if (inProgress) {
      // Indicate that coalescingWrapper should be called again after the
      // callback is no longer in progress.
      ++inProgress;
      return;
    }

    if (pending) {
      // Defer to the already-pending timer.
      return;
    }

    new Promise(resolve => setTimeout(resolve, actualDelayMs)).then(function thenCallback() {
      // Now that the timeout has fired, set inProgress to 1 so that
      // (until the callback is complete and we set inProgress to 0 again)
      // any calls to coalescingWrapper will increment inProgress to
      // indicate that at least one other caller wants fiberCallback to be
      // called again when the original callback is complete.
      pending = false;
      inProgress = 1;

      try {
        callback.call(self);
      } finally {
        if (inProgress > 1) {
          Promise.resolve().then(thenCallback);
          pending = true;
        }

        inProgress = 0;
      }
    });
  }

  return wrap(coalescingWrapper, callback);
}

;

function wrap(wrapper, wrapped) {
  // Allow the wrapper to be used as a constructor function, just in case
  // the wrapped function was meant to be used as a constructor.
  wrapper.prototype = wrapped.prototype; // https://medium.com/@cramforce/on-the-awesomeness-of-fn-displayname-9511933a714a

  const name = wrapped.displayName || wrapped.name;

  if (name) {
    wrapper.displayName = name;
  }

  return wrapper;
}
//# sourceMappingURL=func-utils.js.map