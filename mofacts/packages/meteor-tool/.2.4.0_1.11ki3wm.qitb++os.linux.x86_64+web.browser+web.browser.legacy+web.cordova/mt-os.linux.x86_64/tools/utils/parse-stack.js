module.export({
  parse: () => parse,
  markBottom: () => markBottom,
  markTop: () => markTop
});

function parse(err) {
  const stack = err.stack;

  if (typeof stack !== "string") {
    return {};
  } // at least the first line is the exception


  const frames = stack.split("\n").slice(1) // longjohn adds lines of the form '---' (45 times) to separate
  // the trace across async boundaries. It's not clear if we need to
  // separate the trace in the same way we do for future boundaries below
  // (it's not clear that that code is still useful either)
  // so for now, we'll just remove such lines
  .filter(f => !f.match(/^\-{45}$/)); // "    - - - - -"
  // This is something added when you throw an Error through a Future. The
  // stack above the dashes is the stack of the 'wait' call; the stack below
  // is the stack inside the fiber where the Error is originally
  // constructed.
  // XXX This code assumes that the stack trace can only be split once. It's not
  // clear whether this can happen multiple times.

  const indexOfFiberSplit = frames.indexOf('    - - - - -');

  if (indexOfFiberSplit === -1) {
    // This is a normal stack trace, not a split fiber stack trace
    return {
      outsideFiber: parseStackFrames(frames)
    };
  } // If this is a split stack trace from a future, parse the frames above and
  // below the split separately.


  const outsideFiber = parseStackFrames(frames);
  const insideFiber = parseStackFrames(frames.slice(indexOfFiberSplit + 1));
  return {
    insideFiber,
    outsideFiber
  };
}

function markBottom(f, context) {
  /* eslint-disable camelcase */
  return function __bottom_mark__() {
    // @ts-ignore: Implicit this
    return f.apply(context || this, arguments);
  };
  /* eslint-enable camelcase */
}

function markTop(f, context) {
  /* eslint-disable camelcase */
  return function __top_mark__() {
    // @ts-ignore: Implicit this
    return f.apply(context || this, arguments);
  };
  /* eslint-enable camelcase */
}

function parseStackFrames(frames) {
  let stop = false;
  let parsedFrames = [];
  frames.some(frame => {
    if (stop) {
      return true;
    }

    let m;
    /* eslint-disable max-len */

    if (m = frame.match(/^\s*at\s*((new )?.+?)\s*(\[as\s*([^\]]*)\]\s*)?\((.*?)(:(\d+))?(:(\d+))?\)\s*$/)) {
      // https://code.google.com/p/v8/wiki/JavaScriptStackTraceApi
      // "    at My.Function (/path/to/myfile.js:532:39)"
      // "    at Array.forEach (native)"
      // "    at new My.Class (file.js:1:2)"
      // "    at [object Object].main.registerCommand.name [as func] (meteor/tools/commands.js:1225:19)"
      // "    at __top_mark__ [as matchErr] (meteor/tools/parse-stack.js:82:14)"
      //
      // In that last example, it is not at all clear to me what the
      // 'as' stanza refers to, but it is in m[3] if you find a use for it.
      if (m[1].match(/(?:^|\.)__top_mark__$/)) {
        // m[1] could be Object.__top_mark__ or something like that
        // depending on where exactly you put the function returned by
        // markTop
        parsedFrames = [];
        return;
      }

      if (m[1].match(/(?:^|\.)__bottom_mark__$/)) {
        return stop = true;
      }

      parsedFrames.push({
        func: m[1],
        file: m[5],
        line: m[7] ? +m[7] : null,
        column: m[9] ? +m[9] : null
      });
      return;
    }
    /* eslint-enable max-len */


    if (m = frame.match(/^\s*at\s+(.+?)(:(\d+))?(:(\d+))?\s*$/)) {
      // "    at /path/to/myfile.js:532:39"
      parsedFrames.push({
        file: m[1],
        line: m[3] ? +m[3] : null,
        column: m[5] ? +m[5] : null,
        func: null
      });
      return;
    }

    if (m = frame.match(/^\s*-\s*-\s*-\s*-\s*-\s*$/)) {
      // Stop parsing if we reach a stack split from a Future
      return stop = true;
    }

    if (frame.startsWith(" => awaited here:")) {
      // The meteor-promise library inserts " => awaited here:" lines to
      // indicate async boundaries.
      return stop = true;
    }

    if (parsedFrames.length === 0) {
      // We haven't found any stack frames, so probably we have newlines in the
      // error message. Just skip this line.
      return;
    }

    throw new Error("Couldn't parse stack frame: '".concat(frame, "'"));
  });
  return parsedFrames;
}
//# sourceMappingURL=parse-stack.js.map