"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.edits1 = edits1;
exports.Initialize = Initialize;
exports.HarnessInitialize = HarnessInitialize;
exports.knownEdits2 = knownEdits2;
exports.known = known;
exports.op_LessBarBarGreater = op_LessBarBarGreater;
exports.CorrectSpelling = CorrectSpelling;
exports.NWORDS = void 0;

var _Seq = require("./fable-library.2.3.11/Seq");

var _List = require("./fable-library.2.3.11/List");

var _Util = require("./fable-library.2.3.11/Util");

var _Set = require("./fable-library.2.3.11/Set");

var _Map = require("./fable-library.2.3.11/Map");

var _RegExp = require("./fable-library.2.3.11/RegExp");

var _PromiseImpl = require("./Fable.Promise.2.0.0/PromiseImpl");

var _Promise = require("./Fable.Promise.2.0.0/Promise");

var _Int = require("./fable-library.2.3.11/Int32");

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
  return (0, _Set.ofList)((0, _List.append)(deletes, (0, _List.append)(transposes, (0, _List.append)(replaces, inserts))), {
    Compare: _Util.comparePrimitives
  });
}

const NWORDS = (0, _Util.createAtom)((0, _Map.empty)({
  Compare: _Util.comparePrimitives
}));
exports.NWORDS = NWORDS;

function Initialize(text) {
  NWORDS((0, _Map.ofSeq)((0, _Map.countBy)(function projection(x) {
    return x;
  }, (0, _Seq.map)(function mapping(m) {
    return m[0].toLocaleLowerCase();
  }, (0, _RegExp.matches)((0, _RegExp.create)("[a-zA-Z]+"), text)), {
    Compare: _Util.comparePrimitives
  }), {
    Compare: _Util.comparePrimitives
  }));
}

function HarnessInitialize(textOption, _arg1) {
  return (0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
    if (textOption == null) {
      return Promise.resolve([0, "{\"message\":\"missing raw text file defining correctly spelled words\"}"]);
    } else {
      const text$$1 = textOption;
      Initialize(text$$1);
      return Promise.resolve([1, "{}"]);
    }
  }));
}

function knownEdits2(word$$1) {
  return (0, _Set.ofList)((0, _List.ofSeq)((0, _Seq.delay)(function () {
    return (0, _Seq.collect)(function (e1) {
      return (0, _Seq.collect)(function (e2) {
        return (0, _Map.containsKey)(e2, NWORDS()) ? (0, _Seq.singleton)(e2) : (0, _Seq.empty)();
      }, edits1(e1));
    }, edits1(word$$1));
  })), {
    Compare: _Util.comparePrimitives
  });
}

function known(words) {
  return (0, _Set.ofList)((0, _List.ofSeq)((0, _Seq.delay)(function () {
    return (0, _Seq.collect)(function (w) {
      return (0, _Map.containsKey)(w, NWORDS()) ? (0, _Seq.singleton)(w) : (0, _Seq.empty)();
    }, words);
  })), {
    Compare: _Util.comparePrimitives
  });
}

function op_LessBarBarGreater(first, second) {
  return new _Util.Lazy(function () {
    return (0, _Set.isEmpty)(first.Value) ? second.Value : first.Value;
  });
}

function CorrectSpelling(word$$2) {
  return (0, _Seq.head)((0, _Seq.sortWith)(function ($x$$15, $y$$16) {
    return (0, _Util.comparePrimitives)(function (w$$1) {
      return (0, _Int.op_UnaryNegation_Int32)((0, _Map.FSharpMap$$get_Item$$2B595)(NWORDS(), w$$1));
    }($x$$15), function (w$$1) {
      return (0, _Int.op_UnaryNegation_Int32)((0, _Map.FSharpMap$$get_Item$$2B595)(NWORDS(), w$$1));
    }($y$$16));
  }, op_LessBarBarGreater(op_LessBarBarGreater(op_LessBarBarGreater(new _Util.Lazy(function () {
    return known([word$$2]);
  }), new _Util.Lazy(function () {
    return known(edits1(word$$2));
  })), new _Util.Lazy(function () {
    return knownEdits2(word$$2);
  })), new _Util.Lazy(function () {
    return (0, _Set.singleton)(word$$2, {
      Compare: _Util.comparePrimitives
    });
  })).Value));
}