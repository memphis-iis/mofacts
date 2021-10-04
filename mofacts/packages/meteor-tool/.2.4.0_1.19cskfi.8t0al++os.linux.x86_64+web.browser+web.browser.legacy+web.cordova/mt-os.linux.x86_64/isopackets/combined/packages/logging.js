(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var EJSON = Package.ejson.EJSON;
var ECMAScript = Package.ecmascript.ECMAScript;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var Log;

var require = meteorInstall({"node_modules":{"meteor":{"logging":{"logging.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                             //
// packages/logging/logging.js                                                                                 //
//                                                                                                             //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                               //
let _objectSpread;

module.link("@babel/runtime/helpers/objectSpread2", {
  default(v) {
    _objectSpread = v;
  }

}, 0);
module.export({
  Log: () => Log
});
let Meteor;
module.link("meteor/meteor", {
  Meteor(v) {
    Meteor = v;
  }

}, 0);
const hasOwn = Object.prototype.hasOwnProperty;

function Log() {
  Log.info(...arguments);
} /// FOR TESTING


let intercept = 0;
let interceptedLines = [];
let suppress = 0; // Intercept the next 'count' calls to a Log function. The actual
// lines printed to the console can be cleared and read by calling
// Log._intercepted().

Log._intercept = count => {
  intercept += count;
}; // Suppress the next 'count' calls to a Log function. Use this to stop
// tests from spamming the console, especially with red errors that
// might look like a failing test.


Log._suppress = count => {
  suppress += count;
}; // Returns intercepted lines and resets the intercept counter.


Log._intercepted = () => {
  const lines = interceptedLines;
  interceptedLines = [];
  intercept = 0;
  return lines;
}; // Either 'json' or 'colored-text'.
//
// When this is set to 'json', print JSON documents that are parsed by another
// process ('satellite' or 'meteor run'). This other process should call
// 'Log.format' for nice output.
//
// When this is set to 'colored-text', call 'Log.format' before printing.
// This should be used for logging from within satellite, since there is no
// other process that will be reading its standard output.


Log.outputFormat = 'json';
const LEVEL_COLORS = {
  debug: 'green',
  // leave info as the default color
  warn: 'magenta',
  error: 'red'
};
const META_COLOR = 'blue'; // Default colors cause readability problems on Windows Powershell,
// switch to bright variants. While still capable of millions of
// operations per second, the benchmark showed a 25%+ increase in
// ops per second (on Node 8) by caching "process.platform".

const isWin32 = typeof process === 'object' && process.platform === 'win32';

const platformColor = color => {
  if (isWin32 && typeof color === 'string' && !color.endsWith('Bright')) {
    return "".concat(color, "Bright");
  }

  return color;
}; // XXX package


const RESTRICTED_KEYS = ['time', 'timeInexact', 'level', 'file', 'line', 'program', 'originApp', 'satellite', 'stderr'];
const FORMATTED_KEYS = [...RESTRICTED_KEYS, 'app', 'message'];

const logInBrowser = obj => {
  const str = Log.format(obj); // XXX Some levels should be probably be sent to the server

  const level = obj.level;

  if (typeof console !== 'undefined' && console[level]) {
    console[level](str);
  } else {
    // IE doesn't have console.log.apply, it's not a real Object.
    // http://stackoverflow.com/questions/5538972/console-log-apply-not-working-in-ie9
    // http://patik.com/blog/complete-cross-browser-console-log/
    if (typeof console.log.apply === "function") {
      // Most browsers
      console.log.apply(console, [str]);
    } else if (typeof Function.prototype.bind === "function") {
      // IE9
      const log = Function.prototype.bind.call(console.log, console);
      log.apply(console, [str]);
    }
  }
}; // @returns {Object: { line: Number, file: String }}


Log._getCallerDetails = () => {
  const getStack = () => {
    // We do NOT use Error.prepareStackTrace here (a V8 extension that gets us a
    // pre-parsed stack) since it's impossible to compose it with the use of
    // Error.prepareStackTrace used on the server for source maps.
    const err = new Error();
    const stack = err.stack;
    return stack;
  };

  const stack = getStack();
  if (!stack) return {}; // looking for the first line outside the logging package (or an
  // eval if we find that first)

  let line;
  const lines = stack.split('\n').slice(1);

  for (line of lines) {
    if (line.match(/^\s*(at eval \(eval)|(eval:)/)) {
      return {
        file: "eval"
      };
    }

    if (!line.match(/packages\/(?:local-test[:_])?logging(?:\/|\.js)/)) {
      break;
    }
  }

  const details = {}; // The format for FF is 'functionName@filePath:lineNumber'
  // The format for V8 is 'functionName (packages/logging/logging.js:81)' or
  //                      'packages/logging/logging.js:81'

  const match = /(?:[@(]| at )([^(]+?):([0-9:]+)(?:\)|$)/.exec(line);

  if (!match) {
    return details;
  } // in case the matched block here is line:column


  details.line = match[2].split(':')[0]; // Possible format: https://foo.bar.com/scripts/file.js?random=foobar
  // XXX: if you can write the following in better way, please do it
  // XXX: what about evals?

  details.file = match[1].split('/').slice(-1)[0].split('?')[0];
  return details;
};

['debug', 'info', 'warn', 'error'].forEach(level => {
  // @param arg {String|Object}
  Log[level] = arg => {
    if (suppress) {
      suppress--;
      return;
    }

    let intercepted = false;

    if (intercept) {
      intercept--;
      intercepted = true;
    }

    let obj = arg === Object(arg) && !(arg instanceof RegExp) && !(arg instanceof Date) ? arg : {
      message: new String(arg).toString()
    };
    RESTRICTED_KEYS.forEach(key => {
      if (obj[key]) {
        throw new Error("Can't set '".concat(key, "' in log message"));
      }
    });

    if (hasOwn.call(obj, 'message') && typeof obj.message !== 'string') {
      throw new Error("The 'message' field in log objects must be a string");
    }

    if (!obj.omitCallerDetails) {
      obj = _objectSpread(_objectSpread({}, Log._getCallerDetails()), obj);
    }

    obj.time = new Date();
    obj.level = level; // If we are in production don't write out debug logs.

    if (level === 'debug' && Meteor.isProduction) {
      return;
    }

    if (intercepted) {
      interceptedLines.push(EJSON.stringify(obj));
    } else if (Meteor.isServer) {
      if (Log.outputFormat === 'colored-text') {
        console.log(Log.format(obj, {
          color: true
        }));
      } else if (Log.outputFormat === 'json') {
        console.log(EJSON.stringify(obj));
      } else {
        throw new Error("Unknown logging output format: ".concat(Log.outputFormat));
      }
    } else {
      logInBrowser(obj);
    }
  };
}); // tries to parse line as EJSON. returns object if parse is successful, or null if not

Log.parse = line => {
  let obj = null;

  if (line && line.startsWith('{')) {
    // might be json generated from calling 'Log'
    try {
      obj = EJSON.parse(line);
    } catch (e) {}
  } // XXX should probably check fields other than 'time'


  if (obj && obj.time && obj.time instanceof Date) {
    return obj;
  } else {
    return null;
  }
}; // formats a log object into colored human and machine-readable text


Log.format = function (obj) {
  let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  obj = _objectSpread({}, obj); // don't mutate the argument

  let {
    time,
    timeInexact,
    level = 'info',
    file,
    line: lineNumber,
    app: appName = '',
    originApp,
    message = '',
    program = '',
    satellite = '',
    stderr = ''
  } = obj;

  if (!(time instanceof Date)) {
    throw new Error("'time' must be a Date object");
  }

  FORMATTED_KEYS.forEach(key => {
    delete obj[key];
  });

  if (Object.keys(obj).length > 0) {
    if (message) {
      message += ' ';
    }

    message += EJSON.stringify(obj);
  }

  const pad2 = n => n.toString().padStart(2, '0');

  const pad3 = n => n.toString().padStart(3, '0');

  const dateStamp = time.getFullYear().toString() + pad2(time.getMonth() + 1
  /*0-based*/
  ) + pad2(time.getDate());
  const timeStamp = pad2(time.getHours()) + ':' + pad2(time.getMinutes()) + ':' + pad2(time.getSeconds()) + '.' + pad3(time.getMilliseconds()); // eg in San Francisco in June this will be '(-7)'

  const utcOffsetStr = "(".concat(-(new Date().getTimezoneOffset() / 60), ")");
  let appInfo = '';

  if (appName) {
    appInfo += appName;
  }

  if (originApp && originApp !== appName) {
    appInfo += " via ".concat(originApp);
  }

  if (appInfo) {
    appInfo = "[".concat(appInfo, "] ");
  }

  const sourceInfoParts = [];

  if (program) {
    sourceInfoParts.push(program);
  }

  if (file) {
    sourceInfoParts.push(file);
  }

  if (lineNumber) {
    sourceInfoParts.push(lineNumber);
  }

  let sourceInfo = !sourceInfoParts.length ? '' : "(".concat(sourceInfoParts.join(':'), ") ");
  if (satellite) sourceInfo += "[".concat(satellite, "]");
  const stderrIndicator = stderr ? '(STDERR) ' : '';
  const metaPrefix = [level.charAt(0).toUpperCase(), dateStamp, '-', timeStamp, utcOffsetStr, timeInexact ? '? ' : ' ', appInfo, sourceInfo, stderrIndicator].join('');

  const prettify = function (line, color) {
    return options.color && Meteor.isServer && color ? require('chalk')[color](line) : line;
  };

  return prettify(metaPrefix, platformColor(options.metaColor || META_COLOR)) + prettify(message, platformColor(LEVEL_COLORS[level]));
}; // Turn a line of text into a loggable object.
// @param line {String}
// @param override {Object}


Log.objFromText = (line, override) => {
  return _objectSpread({
    message: line,
    level: 'info',
    time: new Date(),
    timeInexact: true
  }, override);
};
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});

var exports = require("/node_modules/meteor/logging/logging.js");

/* Exports */
Package._define("logging", exports, {
  Log: Log
});

})();

//# sourceURL=meteor://💻app/packages/logging.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvbG9nZ2luZy9sb2dnaW5nLmpzIl0sIm5hbWVzIjpbIl9vYmplY3RTcHJlYWQiLCJtb2R1bGUiLCJsaW5rIiwiZGVmYXVsdCIsInYiLCJleHBvcnQiLCJMb2ciLCJNZXRlb3IiLCJoYXNPd24iLCJPYmplY3QiLCJwcm90b3R5cGUiLCJoYXNPd25Qcm9wZXJ0eSIsImluZm8iLCJpbnRlcmNlcHQiLCJpbnRlcmNlcHRlZExpbmVzIiwic3VwcHJlc3MiLCJfaW50ZXJjZXB0IiwiY291bnQiLCJfc3VwcHJlc3MiLCJfaW50ZXJjZXB0ZWQiLCJsaW5lcyIsIm91dHB1dEZvcm1hdCIsIkxFVkVMX0NPTE9SUyIsImRlYnVnIiwid2FybiIsImVycm9yIiwiTUVUQV9DT0xPUiIsImlzV2luMzIiLCJwcm9jZXNzIiwicGxhdGZvcm0iLCJwbGF0Zm9ybUNvbG9yIiwiY29sb3IiLCJlbmRzV2l0aCIsIlJFU1RSSUNURURfS0VZUyIsIkZPUk1BVFRFRF9LRVlTIiwibG9nSW5Ccm93c2VyIiwib2JqIiwic3RyIiwiZm9ybWF0IiwibGV2ZWwiLCJjb25zb2xlIiwibG9nIiwiYXBwbHkiLCJGdW5jdGlvbiIsImJpbmQiLCJjYWxsIiwiX2dldENhbGxlckRldGFpbHMiLCJnZXRTdGFjayIsImVyciIsIkVycm9yIiwic3RhY2siLCJsaW5lIiwic3BsaXQiLCJzbGljZSIsIm1hdGNoIiwiZmlsZSIsImRldGFpbHMiLCJleGVjIiwiZm9yRWFjaCIsImFyZyIsImludGVyY2VwdGVkIiwiUmVnRXhwIiwiRGF0ZSIsIm1lc3NhZ2UiLCJTdHJpbmciLCJ0b1N0cmluZyIsImtleSIsIm9taXRDYWxsZXJEZXRhaWxzIiwidGltZSIsImlzUHJvZHVjdGlvbiIsInB1c2giLCJFSlNPTiIsInN0cmluZ2lmeSIsImlzU2VydmVyIiwicGFyc2UiLCJzdGFydHNXaXRoIiwiZSIsIm9wdGlvbnMiLCJ0aW1lSW5leGFjdCIsImxpbmVOdW1iZXIiLCJhcHAiLCJhcHBOYW1lIiwib3JpZ2luQXBwIiwicHJvZ3JhbSIsInNhdGVsbGl0ZSIsInN0ZGVyciIsImtleXMiLCJsZW5ndGgiLCJwYWQyIiwibiIsInBhZFN0YXJ0IiwicGFkMyIsImRhdGVTdGFtcCIsImdldEZ1bGxZZWFyIiwiZ2V0TW9udGgiLCJnZXREYXRlIiwidGltZVN0YW1wIiwiZ2V0SG91cnMiLCJnZXRNaW51dGVzIiwiZ2V0U2Vjb25kcyIsImdldE1pbGxpc2Vjb25kcyIsInV0Y09mZnNldFN0ciIsImdldFRpbWV6b25lT2Zmc2V0IiwiYXBwSW5mbyIsInNvdXJjZUluZm9QYXJ0cyIsInNvdXJjZUluZm8iLCJqb2luIiwic3RkZXJySW5kaWNhdG9yIiwibWV0YVByZWZpeCIsImNoYXJBdCIsInRvVXBwZXJDYXNlIiwicHJldHRpZnkiLCJyZXF1aXJlIiwibWV0YUNvbG9yIiwib2JqRnJvbVRleHQiLCJvdmVycmlkZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLElBQUlBLGFBQUo7O0FBQWtCQyxNQUFNLENBQUNDLElBQVAsQ0FBWSxzQ0FBWixFQUFtRDtBQUFDQyxTQUFPLENBQUNDLENBQUQsRUFBRztBQUFDSixpQkFBYSxHQUFDSSxDQUFkO0FBQWdCOztBQUE1QixDQUFuRCxFQUFpRixDQUFqRjtBQUFsQkgsTUFBTSxDQUFDSSxNQUFQLENBQWM7QUFBQ0MsS0FBRyxFQUFDLE1BQUlBO0FBQVQsQ0FBZDtBQUE2QixJQUFJQyxNQUFKO0FBQVdOLE1BQU0sQ0FBQ0MsSUFBUCxDQUFZLGVBQVosRUFBNEI7QUFBQ0ssUUFBTSxDQUFDSCxDQUFELEVBQUc7QUFBQ0csVUFBTSxHQUFDSCxDQUFQO0FBQVM7O0FBQXBCLENBQTVCLEVBQWtELENBQWxEO0FBRXhDLE1BQU1JLE1BQU0sR0FBR0MsTUFBTSxDQUFDQyxTQUFQLENBQWlCQyxjQUFoQzs7QUFFQSxTQUFTTCxHQUFULEdBQXNCO0FBQ3BCQSxLQUFHLENBQUNNLElBQUosQ0FBUyxZQUFUO0FBQ0QsQyxDQUVEOzs7QUFD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QUFQLENBQWlCakYsS0FBakIsRUFBd0JvQixJQUF4QixDQURLLEdBQzJCQSxJQURsQztBQUVELEdBSEQ7O0FBS0EsU0FBTzRELFFBQVEsQ0FBQ0gsVUFBRCxFQUFhOUUsYUFBYSxDQUFDK0MsT0FBTyxDQUFDb0MsU0FBUixJQUFxQnZGLFVBQXRCLENBQTFCLENBQVIsR0FDTHFGLFFBQVEsQ0FBQ2hELE9BQUQsRUFBVWpDLGFBQWEsQ0FBQ1IsWUFBWSxDQUFDaUIsS0FBRCxDQUFiLENBQXZCLENBRFY7QUFFRCxDQTlGRCxDLENBZ0dBO0FBQ0E7QUFDQTs7O0FBQ0FqQyxHQUFHLENBQUM0RyxXQUFKLEdBQWtCLENBQUMvRCxJQUFELEVBQU9nRSxRQUFQLEtBQW9CO0FBQ3BDO0FBQ0VwRCxXQUFPLEVBQUVaLElBRFg7QUFFRVosU0FBSyxFQUFFLE1BRlQ7QUFHRTZCLFFBQUksRUFBRSxJQUFJTixJQUFKLEVBSFI7QUFJRWdCLGVBQVcsRUFBRTtBQUpmLEtBS0txQyxRQUxMO0FBT0QsQ0FSRCxDIiwiZmlsZSI6Ii9wYWNrYWdlcy9sb2dnaW5nLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgTWV0ZW9yIH0gZnJvbSAnbWV0ZW9yL21ldGVvcic7XG5cbmNvbnN0IGhhc093biA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG5cbmZ1bmN0aW9uIExvZyguLi5hcmdzKSB7XG4gIExvZy5pbmZvKC4uLmFyZ3MpO1xufVxuXG4vLy8gRk9SIFRFU1RJTkdcbmxldCBpbnRlcmNlcHQgPSAwO1xubGV0IGludGVyY2VwdGVkTGluZXMgPSBbXTtcbmxldCBzdXBwcmVzcyA9IDA7XG5cbi8vIEludGVyY2VwdCB0aGUgbmV4dCAnY291bnQnIGNhbGxzIHRvIGEgTG9nIGZ1bmN0aW9uLiBUaGUgYWN0dWFsXG4vLyBsaW5lcyBwcmludGVkIHRvIHRoZSBjb25zb2xlIGNhbiBiZSBjbGVhcmVkIGFuZCByZWFkIGJ5IGNhbGxpbmdcbi8vIExvZy5faW50ZXJjZXB0ZWQoKS5cbkxvZy5faW50ZXJjZXB0ID0gKGNvdW50KSA9PiB7XG4gIGludGVyY2VwdCArPSBjb3VudDtcbn07XG5cbi8vIFN1cHByZXNzIHRoZSBuZXh0ICdjb3VudCcgY2FsbHMgdG8gYSBMb2cgZnVuY3Rpb24uIFVzZSB0aGlzIHRvIHN0b3Bcbi8vIHRlc3RzIGZyb20gc3BhbW1pbmcgdGhlIGNvbnNvbGUsIGVzcGVjaWFsbHkgd2l0aCByZWQgZXJyb3JzIHRoYXRcbi8vIG1pZ2h0IGxvb2sgbGlrZSBhIGZhaWxpbmcgdGVzdC5cbkxvZy5fc3VwcHJlc3MgPSAoY291bnQpID0+IHtcbiAgc3VwcHJlc3MgKz0gY291bnQ7XG59O1xuXG4vLyBSZXR1cm5zIGludGVyY2VwdGVkIGxpbmVzIGFuZCByZXNldHMgdGhlIGludGVyY2VwdCBjb3VudGVyLlxuTG9nLl9pbnRlcmNlcHRlZCA9ICgpID0+IHtcbiAgY29uc3QgbGluZXMgPSBpbnRlcmNlcHRlZExpbmVzO1xuICBpbnRlcmNlcHRlZExpbmVzID0gW107XG4gIGludGVyY2VwdCA9IDA7XG4gIHJldHVybiBsaW5lcztcbn07XG5cbi8vIEVpdGhlciAnanNvbicgb3IgJ2NvbG9yZWQtdGV4dCcuXG4vL1xuLy8gV2hlbiB0aGlzIGlzIHNldCB0byAnanNvbicsIHByaW50IEpTT04gZG9jdW1lbnRzIHRoYXQgYXJlIHBhcnNlZCBieSBhbm90aGVyXG4vLyBwcm9jZXNzICgnc2F0ZWxsaXRlJyBvciAnbWV0ZW9yIHJ1bicpLiBUaGlzIG90aGVyIHByb2Nlc3Mgc2hvdWxkIGNhbGxcbi8vICdMb2cuZm9ybWF0JyBmb3IgbmljZSBvdXRwdXQuXG4vL1xuLy8gV2hlbiB0aGlzIGlzIHNldCB0byAnY29sb3JlZC10ZXh0JywgY2FsbCAnTG9nLmZvcm1hdCcgYmVmb3JlIHByaW50aW5nLlxuLy8gVGhpcyBzaG91bGQgYmUgdXNlZCBmb3IgbG9nZ2luZyBmcm9tIHdpdGhpbiBzYXRlbGxpdGUsIHNpbmNlIHRoZXJlIGlzIG5vXG4vLyBvdGhlciBwcm9jZXNzIHRoYXQgd2lsbCBiZSByZWFkaW5nIGl0cyBzdGFuZGFyZCBvdXRwdXQuXG5Mb2cub3V0cHV0Rm9ybWF0ID0gJ2pzb24nO1xuXG5jb25zdCBMRVZFTF9DT0xPUlMgPSB7XG4gIGRlYnVnOiAnZ3JlZW4nLFxuICAvLyBsZWF2ZSBpbmZvIGFzIHRoZSBkZWZhdWx0IGNvbG9yXG4gIHdhcm46ICdtYWdlbnRhJyxcbiAgZXJyb3I6ICdyZWQnXG59O1xuXG5jb25zdCBNRVRBX0NPTE9SID0gJ2JsdWUnO1xuXG4vLyBEZWZhdWx0IGNvbG9ycyBjYXVzZSByZWFkYWJpbGl0eSBwcm9ibGVtcyBvbiBXaW5kb3dzIFBvd2Vyc2hlbGwsXG4vLyBzd2l0Y2ggdG8gYnJpZ2h0IHZhcmlhbnRzLiBXaGlsZSBzdGlsbCBjYXBhYmxlIG9mIG1pbGxpb25zIG9mXG4vLyBvcGVyYXRpb25zIHBlciBzZWNvbmQsIHRoZSBiZW5jaG1hcmsgc2hvd2VkIGEgMjUlKyBpbmNyZWFzZSBpblxuLy8gb3BzIHBlciBzZWNvbmQgKG9uIE5vZGUgOCkgYnkgY2FjaGluZyBcInByb2Nlc3MucGxhdGZvcm1cIi5cbmNvbnN0IGlzV2luMzIgPSB0eXBlb2YgcHJvY2VzcyA9PT0gJ29iamVjdCcgJiYgcHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJztcbmNvbnN0IHBsYXRmb3JtQ29sb3IgPSAoY29sb3IpID0+IHtcbiAgaWYgKGlzV2luMzIgJiYgdHlwZW9mIGNvbG9yID09PSAnc3RyaW5nJyAmJiAhY29sb3IuZW5kc1dpdGgoJ0JyaWdodCcpKSB7XG4gICAgcmV0dXJuIGAke2NvbG9yfUJyaWdodGA7XG4gIH1cbiAgcmV0dXJuIGNvbG9yO1xufTtcblxuLy8gWFhYIHBhY2thZ2VcbmNvbnN0IFJFU1RSSUNURURfS0VZUyA9IFsndGltZScsICd0aW1lSW5leGFjdCcsICdsZXZlbCcsICdmaWxlJywgJ2xpbmUnLFxuICAgICAgICAgICAgICAgICAgICAgICAgJ3Byb2dyYW0nLCAnb3JpZ2luQXBwJywgJ3NhdGVsbGl0ZScsICdzdGRlcnInXTtcblxuY29uc3QgRk9STUFUVEVEX0tFWVMgPSBbLi4uUkVTVFJJQ1RFRF9LRVlTLCAnYXBwJywgJ21lc3NhZ2UnXTtcblxuY29uc3QgbG9nSW5Ccm93c2VyID0gb2JqID0+IHtcbiAgY29uc3Qgc3RyID0gTG9nLmZvcm1hdChvYmopO1xuXG4gIC8vIFhYWCBTb21lIGxldmVscyBzaG91bGQgYmUgcHJvYmFibHkgYmUgc2VudCB0byB0aGUgc2VydmVyXG4gIGNvbnN0IGxldmVsID0gb2JqLmxldmVsO1xuXG4gIGlmICgodHlwZW9mIGNvbnNvbGUgIT09ICd1bmRlZmluZWQnKSAmJiBjb25zb2xlW2xldmVsXSkge1xuICAgIGNvbnNvbGVbbGV2ZWxdKHN0cik7XG4gIH0gZWxzZSB7XG4gICAgLy8gSUUgZG9lc24ndCBoYXZlIGNvbnNvbGUubG9nLmFwcGx5LCBpdCdzIG5vdCBhIHJlYWwgT2JqZWN0LlxuICAgIC8vIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvNTUzODk3Mi9jb25zb2xlLWxvZy1hcHBseS1ub3Qtd29ya2luZy1pbi1pZTlcbiAgICAvLyBodHRwOi8vcGF0aWsuY29tL2Jsb2cvY29tcGxldGUtY3Jvc3MtYnJvd3Nlci1jb25zb2xlLWxvZy9cbiAgICBpZiAodHlwZW9mIGNvbnNvbGUubG9nLmFwcGx5ID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgIC8vIE1vc3QgYnJvd3NlcnNcbiAgICAgIGNvbnNvbGUubG9nLmFwcGx5KGNvbnNvbGUsIFtzdHJdKTtcblxuICAgIH0gZWxzZSBpZiAodHlwZW9mIEZ1bmN0aW9uLnByb3RvdHlwZS5iaW5kID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgIC8vIElFOVxuICAgICAgY29uc3QgbG9nID0gRnVuY3Rpb24ucHJvdG90eXBlLmJpbmQuY2FsbChjb25zb2xlLmxvZywgY29uc29sZSk7XG4gICAgICBsb2cuYXBwbHkoY29uc29sZSwgW3N0cl0pO1xuICAgIH1cbiAgfVxufTtcblxuLy8gQHJldHVybnMge09iamVjdDogeyBsaW5lOiBOdW1iZXIsIGZpbGU6IFN0cmluZyB9fVxuTG9nLl9nZXRDYWxsZXJEZXRhaWxzID0gKCkgPT4ge1xuICBjb25zdCBnZXRTdGFjayA9ICgpID0+IHtcbiAgICAvLyBXZSBkbyBOT1QgdXNlIEVycm9yLnByZXBhcmVTdGFja1RyYWNlIGhlcmUgKGEgVjggZXh0ZW5zaW9uIHRoYXQgZ2V0cyB1cyBhXG4gICAgLy8gcHJlLXBhcnNlZCBzdGFjaykgc2luY2UgaXQncyBpbXBvc3NpYmxlIHRvIGNvbXBvc2UgaXQgd2l0aCB0aGUgdXNlIG9mXG4gICAgLy8gRXJyb3IucHJlcGFyZVN0YWNrVHJhY2UgdXNlZCBvbiB0aGUgc2VydmVyIGZvciBzb3VyY2UgbWFwcy5cbiAgICBjb25zdCBlcnIgPSBuZXcgRXJyb3I7XG4gICAgY29uc3Qgc3RhY2sgPSBlcnIuc3RhY2s7XG4gICAgcmV0dXJuIHN0YWNrO1xuICB9O1xuXG4gIGNvbnN0IHN0YWNrID0gZ2V0U3RhY2soKTtcblxuICBpZiAoIXN0YWNrKSByZXR1cm4ge307XG5cbiAgLy8gbG9va2luZyBmb3IgdGhlIGZpcnN0IGxpbmUgb3V0c2lkZSB0aGUgbG9nZ2luZyBwYWNrYWdlIChvciBhblxuICAvLyBldmFsIGlmIHdlIGZpbmQgdGhhdCBmaXJzdClcbiAgbGV0IGxpbmU7XG4gIGNvbnN0IGxpbmVzID0gc3RhY2suc3BsaXQoJ1xcbicpLnNsaWNlKDEpO1xuICBmb3IgKGxpbmUgb2YgbGluZXMpIHtcbiAgICBpZiAobGluZS5tYXRjaCgvXlxccyooYXQgZXZhbCBcXChldmFsKXwoZXZhbDopLykpIHtcbiAgICAgIHJldHVybiB7ZmlsZTogXCJldmFsXCJ9O1xuICAgIH1cblxuICAgIGlmICghbGluZS5tYXRjaCgvcGFja2FnZXNcXC8oPzpsb2NhbC10ZXN0WzpfXSk/bG9nZ2luZyg/OlxcL3xcXC5qcykvKSkge1xuICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgY29uc3QgZGV0YWlscyA9IHt9O1xuXG4gIC8vIFRoZSBmb3JtYXQgZm9yIEZGIGlzICdmdW5jdGlvbk5hbWVAZmlsZVBhdGg6bGluZU51bWJlcidcbiAgLy8gVGhlIGZvcm1hdCBmb3IgVjggaXMgJ2Z1bmN0aW9uTmFtZSAocGFja2FnZXMvbG9nZ2luZy9sb2dnaW5nLmpzOjgxKScgb3JcbiAgLy8gICAgICAgICAgICAgICAgICAgICAgJ3BhY2thZ2VzL2xvZ2dpbmcvbG9nZ2luZy5qczo4MSdcbiAgY29uc3QgbWF0Y2ggPSAvKD86W0AoXXwgYXQgKShbXihdKz8pOihbMC05Ol0rKSg/OlxcKXwkKS8uZXhlYyhsaW5lKTtcbiAgaWYgKCFtYXRjaCkge1xuICAgIHJldHVybiBkZXRhaWxzO1xuICB9XG5cbiAgLy8gaW4gY2FzZSB0aGUgbWF0Y2hlZCBibG9jayBoZXJlIGlzIGxpbmU6Y29sdW1uXG4gIGRldGFpbHMubGluZSA9IG1hdGNoWzJdLnNwbGl0KCc6JylbMF07XG5cbiAgLy8gUG9zc2libGUgZm9ybWF0OiBodHRwczovL2Zvby5iYXIuY29tL3NjcmlwdHMvZmlsZS5qcz9yYW5kb209Zm9vYmFyXG4gIC8vIFhYWDogaWYgeW91IGNhbiB3cml0ZSB0aGUgZm9sbG93aW5nIGluIGJldHRlciB3YXksIHBsZWFzZSBkbyBpdFxuICAvLyBYWFg6IHdoYXQgYWJvdXQgZXZhbHM/XG4gIGRldGFpbHMuZmlsZSA9IG1hdGNoWzFdLnNwbGl0KCcvJykuc2xpY2UoLTEpWzBdLnNwbGl0KCc/JylbMF07XG5cbiAgcmV0dXJuIGRldGFpbHM7XG59O1xuXG5bJ2RlYnVnJywgJ2luZm8nLCAnd2FybicsICdlcnJvciddLmZvckVhY2goKGxldmVsKSA9PiB7XG4gLy8gQHBhcmFtIGFyZyB7U3RyaW5nfE9iamVjdH1cbiBMb2dbbGV2ZWxdID0gKGFyZykgPT4ge1xuICBpZiAoc3VwcHJlc3MpIHtcbiAgICBzdXBwcmVzcy0tO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGxldCBpbnRlcmNlcHRlZCA9IGZhbHNlO1xuICBpZiAoaW50ZXJjZXB0KSB7XG4gICAgaW50ZXJjZXB0LS07XG4gICAgaW50ZXJjZXB0ZWQgPSB0cnVlO1xuICB9XG5cbiAgbGV0IG9iaiA9IChhcmcgPT09IE9iamVjdChhcmcpXG4gICAgJiYgIShhcmcgaW5zdGFuY2VvZiBSZWdFeHApXG4gICAgJiYgIShhcmcgaW5zdGFuY2VvZiBEYXRlKSlcbiAgICA/IGFyZ1xuICAgIDogeyBtZXNzYWdlOiBuZXcgU3RyaW5nKGFyZykudG9TdHJpbmcoKSB9O1xuXG4gIFJFU1RSSUNURURfS0VZUy5mb3JFYWNoKGtleSA9PiB7XG4gICAgaWYgKG9ialtrZXldKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENhbid0IHNldCAnJHtrZXl9JyBpbiBsb2cgbWVzc2FnZWApO1xuICAgIH1cbiAgfSk7XG5cbiAgaWYgKGhhc093bi5jYWxsKG9iaiwgJ21lc3NhZ2UnKSAmJiB0eXBlb2Ygb2JqLm1lc3NhZ2UgIT09ICdzdHJpbmcnKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiVGhlICdtZXNzYWdlJyBmaWVsZCBpbiBsb2cgb2JqZWN0cyBtdXN0IGJlIGEgc3RyaW5nXCIpO1xuICB9XG5cbiAgaWYgKCFvYmoub21pdENhbGxlckRldGFpbHMpIHtcbiAgICBvYmogPSB7IC4uLkxvZy5fZ2V0Q2FsbGVyRGV0YWlscygpLCAuLi5vYmogfTtcbiAgfVxuXG4gIG9iai50aW1lID0gbmV3IERhdGUoKTtcbiAgb2JqLmxldmVsID0gbGV2ZWw7XG5cbiAgLy8gSWYgd2UgYXJlIGluIHByb2R1Y3Rpb24gZG9uJ3Qgd3JpdGUgb3V0IGRlYnVnIGxvZ3MuXG4gIGlmIChsZXZlbCA9PT0gJ2RlYnVnJyAmJiBNZXRlb3IuaXNQcm9kdWN0aW9uKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgaWYgKGludGVyY2VwdGVkKSB7XG4gICAgaW50ZXJjZXB0ZWRMaW5lcy5wdXNoKEVKU09OLnN0cmluZ2lmeShvYmopKTtcbiAgfSBlbHNlIGlmIChNZXRlb3IuaXNTZXJ2ZXIpIHtcbiAgICBpZiAoTG9nLm91dHB1dEZvcm1hdCA9PT0gJ2NvbG9yZWQtdGV4dCcpIHtcbiAgICAgIGNvbnNvbGUubG9nKExvZy5mb3JtYXQob2JqLCB7Y29sb3I6IHRydWV9KSk7XG4gICAgfSBlbHNlIGlmIChMb2cub3V0cHV0Rm9ybWF0ID09PSAnanNvbicpIHtcbiAgICAgIGNvbnNvbGUubG9nKEVKU09OLnN0cmluZ2lmeShvYmopKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmtub3duIGxvZ2dpbmcgb3V0cHV0IGZvcm1hdDogJHtMb2cub3V0cHV0Rm9ybWF0fWApO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBsb2dJbkJyb3dzZXIob2JqKTtcbiAgfVxufTtcbn0pO1xuXG5cbi8vIHRyaWVzIHRvIHBhcnNlIGxpbmUgYXMgRUpTT04uIHJldHVybnMgb2JqZWN0IGlmIHBhcnNlIGlzIHN1Y2Nlc3NmdWwsIG9yIG51bGwgaWYgbm90XG5Mb2cucGFyc2UgPSAobGluZSkgPT4ge1xuICBsZXQgb2JqID0gbnVsbDtcbiAgaWYgKGxpbmUgJiYgbGluZS5zdGFydHNXaXRoKCd7JykpIHsgLy8gbWlnaHQgYmUganNvbiBnZW5lcmF0ZWQgZnJvbSBjYWxsaW5nICdMb2cnXG4gICAgdHJ5IHsgb2JqID0gRUpTT04ucGFyc2UobGluZSk7IH0gY2F0Y2ggKGUpIHt9XG4gIH1cblxuICAvLyBYWFggc2hvdWxkIHByb2JhYmx5IGNoZWNrIGZpZWxkcyBvdGhlciB0aGFuICd0aW1lJ1xuICBpZiAob2JqICYmIG9iai50aW1lICYmIChvYmoudGltZSBpbnN0YW5jZW9mIERhdGUpKSB7XG4gICAgcmV0dXJuIG9iajtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufTtcblxuLy8gZm9ybWF0cyBhIGxvZyBvYmplY3QgaW50byBjb2xvcmVkIGh1bWFuIGFuZCBtYWNoaW5lLXJlYWRhYmxlIHRleHRcbkxvZy5mb3JtYXQgPSAob2JqLCBvcHRpb25zID0ge30pID0+IHtcbiAgb2JqID0geyAuLi5vYmogfTsgLy8gZG9uJ3QgbXV0YXRlIHRoZSBhcmd1bWVudFxuICBsZXQge1xuICAgIHRpbWUsXG4gICAgdGltZUluZXhhY3QsXG4gICAgbGV2ZWwgPSAnaW5mbycsXG4gICAgZmlsZSxcbiAgICBsaW5lOiBsaW5lTnVtYmVyLFxuICAgIGFwcDogYXBwTmFtZSA9ICcnLFxuICAgIG9yaWdpbkFwcCxcbiAgICBtZXNzYWdlID0gJycsXG4gICAgcHJvZ3JhbSA9ICcnLFxuICAgIHNhdGVsbGl0ZSA9ICcnLFxuICAgIHN0ZGVyciA9ICcnLFxuICB9ID0gb2JqO1xuXG4gIGlmICghKHRpbWUgaW5zdGFuY2VvZiBEYXRlKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIid0aW1lJyBtdXN0IGJlIGEgRGF0ZSBvYmplY3RcIik7XG4gIH1cblxuICBGT1JNQVRURURfS0VZUy5mb3JFYWNoKChrZXkpID0+IHsgZGVsZXRlIG9ialtrZXldOyB9KTtcblxuICBpZiAoT2JqZWN0LmtleXMob2JqKS5sZW5ndGggPiAwKSB7XG4gICAgaWYgKG1lc3NhZ2UpIHtcbiAgICAgIG1lc3NhZ2UgKz0gJyAnO1xuICAgIH1cbiAgICBtZXNzYWdlICs9IEVKU09OLnN0cmluZ2lmeShvYmopO1xuICB9XG5cbiAgY29uc3QgcGFkMiA9IG4gPT4gbi50b1N0cmluZygpLnBhZFN0YXJ0KDIsICcwJyk7XG4gIGNvbnN0IHBhZDMgPSBuID0+IG4udG9TdHJpbmcoKS5wYWRTdGFydCgzLCAnMCcpO1xuXG4gIGNvbnN0IGRhdGVTdGFtcCA9IHRpbWUuZ2V0RnVsbFllYXIoKS50b1N0cmluZygpICtcbiAgICBwYWQyKHRpbWUuZ2V0TW9udGgoKSArIDEgLyowLWJhc2VkKi8pICtcbiAgICBwYWQyKHRpbWUuZ2V0RGF0ZSgpKTtcbiAgY29uc3QgdGltZVN0YW1wID0gcGFkMih0aW1lLmdldEhvdXJzKCkpICtcbiAgICAgICAgJzonICtcbiAgICAgICAgcGFkMih0aW1lLmdldE1pbnV0ZXMoKSkgK1xuICAgICAgICAnOicgK1xuICAgICAgICBwYWQyKHRpbWUuZ2V0U2Vjb25kcygpKSArXG4gICAgICAgICcuJyArXG4gICAgICAgIHBhZDModGltZS5nZXRNaWxsaXNlY29uZHMoKSk7XG5cbiAgLy8gZWcgaW4gU2FuIEZyYW5jaXNjbyBpbiBKdW5lIHRoaXMgd2lsbCBiZSAnKC03KSdcbiAgY29uc3QgdXRjT2Zmc2V0U3RyID0gYCgkeygtKG5ldyBEYXRlKCkuZ2V0VGltZXpvbmVPZmZzZXQoKSAvIDYwKSl9KWA7XG5cbiAgbGV0IGFwcEluZm8gPSAnJztcbiAgaWYgKGFwcE5hbWUpIHtcbiAgICBhcHBJbmZvICs9IGFwcE5hbWU7XG4gIH1cbiAgaWYgKG9yaWdpbkFwcCAmJiBvcmlnaW5BcHAgIT09IGFwcE5hbWUpIHtcbiAgICBhcHBJbmZvICs9IGAgdmlhICR7b3JpZ2luQXBwfWA7XG4gIH1cbiAgaWYgKGFwcEluZm8pIHtcbiAgICBhcHBJbmZvID0gYFske2FwcEluZm99XSBgO1xuICB9XG5cbiAgY29uc3Qgc291cmNlSW5mb1BhcnRzID0gW107XG4gIGlmIChwcm9ncmFtKSB7XG4gICAgc291cmNlSW5mb1BhcnRzLnB1c2gocHJvZ3JhbSk7XG4gIH1cbiAgaWYgKGZpbGUpIHtcbiAgICBzb3VyY2VJbmZvUGFydHMucHVzaChmaWxlKTtcbiAgfVxuICBpZiAobGluZU51bWJlcikge1xuICAgIHNvdXJjZUluZm9QYXJ0cy5wdXNoKGxpbmVOdW1iZXIpO1xuICB9XG5cbiAgbGV0IHNvdXJjZUluZm8gPSAhc291cmNlSW5mb1BhcnRzLmxlbmd0aCA/XG4gICAgJycgOiBgKCR7c291cmNlSW5mb1BhcnRzLmpvaW4oJzonKX0pIGA7XG5cbiAgaWYgKHNhdGVsbGl0ZSlcbiAgICBzb3VyY2VJbmZvICs9IGBbJHtzYXRlbGxpdGV9XWA7XG5cbiAgY29uc3Qgc3RkZXJySW5kaWNhdG9yID0gc3RkZXJyID8gJyhTVERFUlIpICcgOiAnJztcblxuICBjb25zdCBtZXRhUHJlZml4ID0gW1xuICAgIGxldmVsLmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpLFxuICAgIGRhdGVTdGFtcCxcbiAgICAnLScsXG4gICAgdGltZVN0YW1wLFxuICAgIHV0Y09mZnNldFN0cixcbiAgICB0aW1lSW5leGFjdCA/ICc/ICcgOiAnICcsXG4gICAgYXBwSW5mbyxcbiAgICBzb3VyY2VJbmZvLFxuICAgIHN0ZGVyckluZGljYXRvcl0uam9pbignJyk7XG5cbiAgY29uc3QgcHJldHRpZnkgPSBmdW5jdGlvbiAobGluZSwgY29sb3IpIHtcbiAgICByZXR1cm4gKG9wdGlvbnMuY29sb3IgJiYgTWV0ZW9yLmlzU2VydmVyICYmIGNvbG9yKSA/XG4gICAgICByZXF1aXJlKCdjaGFsaycpW2NvbG9yXShsaW5lKSA6IGxpbmU7XG4gIH07XG5cbiAgcmV0dXJuIHByZXR0aWZ5KG1ldGFQcmVmaXgsIHBsYXRmb3JtQ29sb3Iob3B0aW9ucy5tZXRhQ29sb3IgfHwgTUVUQV9DT0xPUikpICtcbiAgICBwcmV0dGlmeShtZXNzYWdlLCBwbGF0Zm9ybUNvbG9yKExFVkVMX0NPTE9SU1tsZXZlbF0pKTtcbn07XG5cbi8vIFR1cm4gYSBsaW5lIG9mIHRleHQgaW50byBhIGxvZ2dhYmxlIG9iamVjdC5cbi8vIEBwYXJhbSBsaW5lIHtTdHJpbmd9XG4vLyBAcGFyYW0gb3ZlcnJpZGUge09iamVjdH1cbkxvZy5vYmpGcm9tVGV4dCA9IChsaW5lLCBvdmVycmlkZSkgPT4ge1xuICByZXR1cm4ge1xuICAgIG1lc3NhZ2U6IGxpbmUsXG4gICAgbGV2ZWw6ICdpbmZvJyxcbiAgICB0aW1lOiBuZXcgRGF0ZSgpLFxuICAgIHRpbWVJbmV4YWN0OiB0cnVlLFxuICAgIC4uLm92ZXJyaWRlXG4gIH07XG59O1xuXG5leHBvcnQgeyBMb2cgfTtcbiJdfQ==
