"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getParaphrases = getParaphrases;
exports.InitializeParaphraseCache = InitializeParaphraseCache;
exports.getCachedParaphrase = getCachedParaphrase;
exports.backtranslation = exports.paraphraseEndpoint = void 0;

require("isomorphic-fetch");

var _Types = require("./fable-library.2.10.2/Types");

var _Types2 = require("./Thoth.Json.4.0.0/Types");

var _Util = require("./fable-library.2.10.2/Util");

var _Reflection = require("./fable-library.2.10.2/Reflection");

var _Fetch = require("./Thoth.Fetch.2.0.0/Fetch");

var _PromiseImpl = require("./Fable.Promise.2.1.0/PromiseImpl");

var _Promise = require("./Fable.Promise.2.1.0/Promise");

var _Map = require("./fable-library.2.10.2/Map");

var _Option = require("./fable-library.2.10.2/Option");

var _Seq = require("./fable-library.2.10.2/Seq");

const paraphraseEndpoint = "https://paraphrase.olney.ai/api/";
exports.paraphraseEndpoint = paraphraseEndpoint;

function getParaphrases(sentence) {
  return (0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
    return (0, _Fetch.Fetch$$$tryPost$$5760677E)(paraphraseEndpoint + "getParaphrase", (0, _Types.anonRecord)({
      sentence: sentence
    }), undefined, undefined, new _Types2.CaseStrategy(2, "SnakeCase"), undefined, (0, _Util.uncurry)(2, undefined), {
      ResolveType() {
        return _Reflection.string_type;
      }

    }, {
      ResolveType() {
        return (0, _Reflection.anonRecord_type)(["sentence", _Reflection.string_type]);
      }

    });
  }));
}

const backtranslation = (0, _Util.createAtom)((0, _Map.empty)({
  Compare: _Util.comparePrimitives
}));
exports.backtranslation = backtranslation;

function InitializeParaphraseCache(text) {
  var elements, source;

  try {
    backtranslation((elements = (source = text.split("\n"), ((0, _Seq.map)(function mapping(l) {
      const s = l.split("\t");
      return [s[2], s[3]];
    }, source))), ((0, _Map.ofSeq)(elements, {
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

function getCachedParaphrase(sentence$$1) {
  const matchValue = (0, _Map.FSharpMap$$TryFind$$2B595)(backtranslation(), sentence$$1);

  if (matchValue == null) {
    return sentence$$1;
  } else {
    const paraphrase = matchValue;
    return paraphrase;
  }
}