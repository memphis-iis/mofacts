"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.reject = reject;
exports.result = result;
exports.mapResult = mapResult;
exports.bindResult = bindResult;
exports.mapResultError = mapResultError;
exports.tap = tap;
exports.PromiseBuilder$reflection = PromiseBuilder$reflection;
exports.PromiseBuilder$$$$002Ector = PromiseBuilder$$$$002Ector;
exports.PromiseBuilder$$For$$1565554B = PromiseBuilder$$For$$1565554B;
exports.PromiseBuilder$$While$$2044D34 = PromiseBuilder$$While$$2044D34;
exports.PromiseBuilder$$TryFinally$$7D49A2FD = PromiseBuilder$$TryFinally$$7D49A2FD;
exports.PromiseBuilder$$Delay$$62FBFDE1 = PromiseBuilder$$Delay$$62FBFDE1;
exports.PromiseBuilder$$Run$$212F1D4B = PromiseBuilder$$Run$$212F1D4B;
exports.PromiseBuilder$$Using$$74F7E79D = PromiseBuilder$$Using$$74F7E79D;
exports.PromiseBuilder = void 0;

var _Option = require("../fable-library.2.10.2/Option");

var _Types = require("../fable-library.2.10.2/Types");

var _Reflection = require("../fable-library.2.10.2/Reflection");

var _Seq = require("../fable-library.2.10.2/Seq");

var _Util = require("../fable-library.2.10.2/Util");

function reject(reason) {
  return Promise.reject(reason);
}

function result(a) {
  return a.then(function ($arg$$1) {
    let arg0;
    arg0 = new _Option.Result(0, "Ok", $arg$$1);
    return arg0;
  }, function ($arg$$2) {
    let arg0$$2;
    arg0$$2 = new _Option.Result(1, "Error", $arg$$2);
    return arg0$$2;
  });
}

function mapResult(fn, a$$1) {
  return a$$1.then(function a$$2(result$$1) {
    return (0, _Option.mapOk)(fn, result$$1);
  });
}

function bindResult(fn$$1, a$$3) {
  return a$$3.then(function a$$6(a$$4) {
    if (a$$4.tag === 1) {
      return Promise.resolve(new _Option.Result(1, "Error", a$$4.fields[0]));
    } else {
      return result(fn$$1(a$$4.fields[0]));
    }
  });
}

function mapResultError(fn$$2, a$$7) {
  return a$$7.then(function a$$8(result$$2) {
    return (0, _Option.mapError)(fn$$2, result$$2);
  });
}

function tap(fn$$3, a$$9) {
  return a$$9.then(function a$$10(x) {
    fn$$3(x);
    return x;
  });
}

const PromiseBuilder = (0, _Types.declare)(function Promise_PromiseBuilder() {
  void null;
});
exports.PromiseBuilder = PromiseBuilder;

function PromiseBuilder$reflection() {
  return (0, _Reflection.class_type)("Promise.PromiseBuilder", undefined, PromiseBuilder);
}

function PromiseBuilder$$$$002Ector() {
  return this instanceof PromiseBuilder ? PromiseBuilder.call(this) : new PromiseBuilder();
}

function PromiseBuilder$$For$$1565554B(x$$1, seq, body) {
  let p = Promise.resolve(null);
  (0, _Seq.iterate)(function (a$$11) {
    const x$$2 = p.then(function () {
      return body(a$$11);
    });
    p = x$$2;
  }, seq);
  return p;
}

function PromiseBuilder$$While$$2044D34(x$$3, guard, p$$1) {
  if (guard()) {
    return p$$1.then(function () {
      return PromiseBuilder$$While$$2044D34(x$$3, guard, p$$1);
    });
  } else {
    return Promise.resolve(null);
  }
}

function PromiseBuilder$$TryFinally$$7D49A2FD(x$$4, p$$2, compensation) {
  return p$$2.then(function (x$$5) {
    compensation();
    return x$$5;
  }, function (er) {
    compensation();
    throw er;
  });
}

function PromiseBuilder$$Delay$$62FBFDE1(x$$7, generator) {
  const x$$13 = {
    then(f1, f2) {
      try {
        return generator().then(f1, f2);
      } catch (er$$1) {
        if ((0, _Util.equals)(f2, null)) {
          const x$$8 = Promise.reject(er$$1);
          return x$$8;
        } else {
          try {
            const x$$9 = Promise.resolve(f2(er$$1));
            return x$$9;
          } catch (er$$2) {
            const x$$10 = Promise.reject(er$$2);
            return x$$10;
          }
        }
      }
    },

    catch(f) {
      try {
        return generator().catch(f);
      } catch (er$$3) {
        try {
          const x$$11 = Promise.resolve(f(er$$3));
          return x$$11;
        } catch (er$$4) {
          const x$$12 = Promise.reject(er$$4);
          return x$$12;
        }
      }
    }

  };
  return x$$13;
}

function PromiseBuilder$$Run$$212F1D4B(x$$14, p$$3) {
  return new Promise(function (success, fail) {
    try {
      let p$$4;
      const x$$15 = Promise.resolve(p$$3);
      p$$4 = x$$15;
      p$$4.then(success, fail);
    } catch (er$$5) {
      fail(er$$5);
    }
  });
}

function PromiseBuilder$$Using$$74F7E79D(x$$16, resource, binder) {
  return PromiseBuilder$$TryFinally$$7D49A2FD(x$$16, binder(resource), function () {
    let copyOfStruct = resource;
    copyOfStruct.Dispose();
  });
}