"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.edits1 = edits1;
exports.Initialize = Initialize;
exports.knownEdits2 = knownEdits2;
exports.known = known;
exports.op_LessBarBarGreater = op_LessBarBarGreater;
exports.CorrectSpelling = CorrectSpelling;
exports.NWORDS = void 0;

var _Seq = require("./fable-library.2.10.2/Seq");

var _List = require("./fable-library.2.10.2/List");

var _Util = require("./fable-library.2.10.2/Util");

var _Set = require("./fable-library.2.10.2/Set");

var _Map = require("./fable-library.2.10.2/Map");

var _Option = require("./fable-library.2.10.2/Option");

var _PromiseImpl = require("./Fable.Promise.2.1.0/PromiseImpl");

var _Promise = require("./Fable.Promise.2.1.0/Promise");

var _RegExp = require("./fable-library.2.10.2/RegExp");

var _Int = require("./fable-library.2.10.2/Int32");

function edits1(word) {
  const splits = (0, _List.ofSeq)((0, _Seq.delay)(function () {
    return (0, _Seq.map)(function (i) {
      return [word.slice(0, i - 1 + 1), word.slice(i, word.length)];
    }, (0, _Seq.rangeNumber)(0, 1, word.length));
  }));
  const deletes = (0, _List.ofSeq)((0, _Seq.delay)(function () {
    return (0, _Seq.collect)(function (matchValue) {
      return matchValue[1] !== "" ? (0, _Seq.singleton)(matchValue[0] + matchValue[1].slice(1, matchValue[1].length)) : (0, _Seq.empty)();
    }, splits);
  }));
  const transposes = (0, _List.ofSeq)((0, _Seq.delay)(function () {
    return (0, _Seq.collect)(function (matchValue$$1) {
      return matchValue$$1[1].length > 1 ? (0, _Seq.singleton)(matchValue$$1[0] + matchValue$$1[1][1] + matchValue$$1[1][0] + matchValue$$1[1].slice(2, matchValue$$1[1].length)) : (0, _Seq.empty)();
    }, splits);
  }));
  const replaces = (0, _List.ofSeq)((0, _Seq.delay)(function () {
    return (0, _Seq.collect)(function (matchValue$$2) {
      return (0, _Seq.collect)(function (c) {
        return matchValue$$2[1] !== "" ? (0, _Seq.singleton)(matchValue$$2[0] + c + matchValue$$2[1].slice(1, matchValue$$2[1].length)) : (0, _Seq.empty)();
      }, (0, _Seq.rangeChar)("a", "z"));
    }, splits);
  }));
  const inserts = (0, _List.ofSeq)((0, _Seq.delay)(function () {
    return (0, _Seq.collect)(function (matchValue$$3) {
      return (0, _Seq.map)(function (c$$1) {
        return matchValue$$3[0] + c$$1 + matchValue$$3[1];
      }, (0, _Seq.rangeChar)("a", "z"));
    }, splits);
  }));
  const elements = (0, _List.append)(deletes, (0, _List.append)(transposes, (0, _List.append)(replaces, inserts)));
  return (0, _Set.ofList)(elements, {
    Compare: _Util.comparePrimitives
  });
}

const NWORDS = (0, _Util.createAtom)((0, _Map.empty)({
  Compare: _Util.comparePrimitives
}));
exports.NWORDS = NWORDS;

function Initialize(text) {
  var elements$$1, source$$2, source$$1, source, objectArg;

  try {
    NWORDS((elements$$1 = (source$$2 = (source$$1 = (source = (objectArg = (0, _RegExp.create)("[a-zA-Z]+"), (0, _RegExp.matches)(objectArg, text)), (source)), ((0, _Seq.map)(function mapping(m) {
      return m[0].toLocaleLowerCase();
    }, source$$1))), ((0, _Map.countBy)(function projection(x) {
      return x;
    }, source$$2, {
      Equals($x$$5, $y$$6) {
        return $x$$5 === $y$$6;
      },

      GetHashCode: _Util.structuralHash
    }))), ((0, _Map.ofSeq)(elements$$1, {
      Compare: _Util.comparePrimitives
    }))));
    return (0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
      return Promise.resolve(new _Option.Result(0, "Ok", null));
    }));
  } catch (e) {
    return (0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
      return Promise.resolve(new _Option.Result(1, "Error", e.message));
    }));
  }
}

function knownEdits2(word$$1) {
  const elements$$2 = (0, _List.ofSeq)((0, _Seq.delay)(function () {
    return (0, _Seq.collect)(function (e1) {
      return (0, _Seq.collect)(function (e2) {
        return (0, _Map.containsKey)(e2, NWORDS()) ? (0, _Seq.singleton)(e2) : (0, _Seq.empty)();
      }, edits1(e1));
    }, edits1(word$$1));
  }));
  return (0, _Set.ofList)(elements$$2, {
    Compare: _Util.comparePrimitives
  });
}

function known(words) {
  const elements$$3 = (0, _List.ofSeq)((0, _Seq.delay)(function () {
    return (0, _Seq.collect)(function (w) {
      return (0, _Map.containsKey)(w, NWORDS()) ? (0, _Seq.singleton)(w) : (0, _Seq.empty)();
    }, words);
  }));
  return (0, _Set.ofList)(elements$$3, {
    Compare: _Util.comparePrimitives
  });
}

function op_LessBarBarGreater(first, second) {
  return new _Util.Lazy(function () {
    return (0, _Set.isEmpty)(first.Value) ? second.Value : first.Value;
  });
}

function CorrectSpelling(word$$2) {
  let source$$4;
  const source$$3 = op_LessBarBarGreater(op_LessBarBarGreater(op_LessBarBarGreater(new _Util.Lazy(function () {
    return known([word$$2]);
  }), new _Util.Lazy(function () {
    return known(edits1(word$$2));
  })), new _Util.Lazy(function () {
    return knownEdits2(word$$2);
  })), new _Util.Lazy(function () {
    return (0, _Set.singleton)(word$$2, {
      Compare: _Util.comparePrimitives
    });
  })).Value;

  const projection$$1 = function projection$$1(w$$1) {
    return (0, _Int.op_UnaryNegation_Int32)((0, _Map.FSharpMap$$get_Item$$2B595)(NWORDS(), w$$1));
  };

  source$$4 = (0, _Seq.sortWith)(function ($x$$15, $y$$16) {
    return (0, _Util.comparePrimitives)(projection$$1($x$$15), projection$$1($y$$16));
  }, source$$3);
  return (0, _Seq.head)(source$$4);
}