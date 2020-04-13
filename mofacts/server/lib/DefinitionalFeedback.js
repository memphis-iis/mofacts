"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.EntryGloss$reflection = EntryGloss$reflection;
exports.firstLetterUpper = firstLetterUpper;
exports.lower = lower;
exports.Initialize = Initialize;
exports.HarnessInitialize = HarnessInitialize;
exports.isAcronym = isAcronym;
exports.trim = trim;
exports.tokensToString = tokensToString;
exports.getDeterminerPhraseFromTokens = getDeterminerPhraseFromTokens;
exports.getDeterminerPhrase = getDeterminerPhrase;
exports.getPredicate = getPredicate;
exports.FeedbackRequest$reflection = FeedbackRequest$reflection;
exports.GenerateFeedback = GenerateFeedback;
exports.HarnessGenerateFeedback = HarnessGenerateFeedback;
exports.FeedbackRequest = exports.wordSet = exports.determinerMap = exports.definitionMap = exports.EntryGloss = void 0;

var _Types = require("./fable-library.2.3.11/Types");

var _Reflection = require("./fable-library.2.3.11/Reflection");

var _Util = require("./fable-library.2.3.11/Util");

var _Map = require("./fable-library.2.3.11/Map");

var _Set = require("./fable-library.2.3.11/Set");

var _Decode = require("./Thoth.Json.3.3.0/Decode");

var _Array = require("./fable-library.2.3.11/Array");

var _Seq = require("./fable-library.2.3.11/Seq");

var _PromiseImpl = require("./Fable.Promise.2.0.0/PromiseImpl");

var _Promise = require("./Fable.Promise.2.0.0/Promise");

var _String = require("./fable-library.2.3.11/String");

var _RegExp = require("./fable-library.2.3.11/RegExp");

var _SpellingCorrector = require("./SpellingCorrector");

const EntryGloss = (0, _Types.declare)(function DefinitionalFeedback_EntryGloss(arg1, arg2, arg3, arg4) {
  this.entry = arg1;
  this.entryTag = arg2;
  this.gloss = arg3;
  this.glossTag = arg4;
}, _Types.Record);
exports.EntryGloss = EntryGloss;

function EntryGloss$reflection() {
  return (0, _Reflection.record)("DefinitionalFeedback.EntryGloss", [], EntryGloss, () => [["entry", (0, _Reflection.array)(_Reflection.string)], ["entryTag", (0, _Reflection.array)(_Reflection.string)], ["gloss", (0, _Reflection.array)(_Reflection.string)], ["glossTag", (0, _Reflection.array)(_Reflection.string)]]);
}

function firstLetterUpper(input) {
  return input.substr(0, 1).toLocaleUpperCase() + input.substr(1);
}

function lower(s) {
  return s.toLocaleLowerCase();
}

const definitionMap = (0, _Util.createAtom)((0, _Map.empty)({
  Compare: _Util.comparePrimitives
}));
exports.definitionMap = definitionMap;
const determinerMap = (0, _Util.createAtom)((0, _Map.empty)({
  Compare: _Util.comparePrimitives
}));
exports.determinerMap = determinerMap;
const wordSet = (0, _Util.createAtom)((0, _Set.empty)({
  Compare: _Util.comparePrimitives
}));
exports.wordSet = wordSet;

function Initialize(jsonDictionary) {
  definitionMap((0, _Decode.Auto$$$unsafeFromString$$Z33228D48)(jsonDictionary, null, null, {
    ResolveType() {
      return (0, _Reflection.type)("Microsoft.FSharp.Collections.FSharpMap`2", [_Reflection.string, EntryGloss$reflection()]);
    }

  }));
  wordSet((0, _Set.ofSeq)((0, _Seq.collect)(function mapping(tupledArg) {
    return (0, _Array.map)(lower, tupledArg[1].gloss, Array);
  }, (0, _Map.toSeq)(definitionMap())), {
    Compare: _Util.comparePrimitives
  }));
  const entryFirstWordSet = (0, _Set.ofSeq)((0, _Seq.map)(function mapping$$1(tupledArg$$1) {
    return tupledArg$$1[1].entry[0].toLocaleLowerCase();
  }, (0, _Map.toSeq)(definitionMap())), {
    Compare: _Util.comparePrimitives
  });
  determinerMap((0, _Map.ofSeq)((0, _Seq.map)(function mapping$$3(tupledArg$$4) {
    return [tupledArg$$4[0], (0, _Seq.maxBy)(function projection$$2(tuple$$2) {
      return tuple$$2[1];
    }, (0, _Map.countBy)(function projection$$1(tuple$$1) {
      return tuple$$1[1];
    }, tupledArg$$4[1], {
      Compare: _Util.comparePrimitives
    }), {
      Compare: _Util.comparePrimitives
    })[0]];
  }, (0, _Map.groupBy)(function projection(tuple) {
    return tuple[0];
  }, (0, _Seq.choose)(function chooser(tupledArg$$3) {
    const matchValue = [tupledArg$$3[0][1], (0, _Set.FSharpSet$$Contains$$2B595)(entryFirstWordSet, tupledArg$$3[1][0])];
    var $target$$19;

    if (matchValue[0] === "DT") {
      if (matchValue[1]) {
        $target$$19 = 0;
      } else {
        $target$$19 = 1;
      }
    } else {
      $target$$19 = 1;
    }

    switch ($target$$19) {
      case 0:
        {
          return [tupledArg$$3[1][0], tupledArg$$3[0][0]];
        }

      case 1:
        {
          return null;
        }
    }
  }, (0, _Seq.pairwise)((0, _Seq.collect)(function mapping$$2(tupledArg$$2) {
    return (0, _Seq.zip)((0, _Array.map)(lower, tupledArg$$2[1].gloss, Array), tupledArg$$2[1].glossTag);
  }, (0, _Map.toSeq)(definitionMap())))), {
    Compare: _Util.comparePrimitives
  })), {
    Compare: _Util.comparePrimitives
  }));
}

function HarnessInitialize(jsonOption, _arg1$$1) {
  return (0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
    if (jsonOption == null) {
      return Promise.resolve([0, "{\"message\":\"missing dictionary of EntryGloss\"}"]);
    } else {
      const json$$2 = jsonOption;
      Initialize(json$$2);
      return Promise.resolve([1, "{}"]);
    }
  }));
}

function isAcronym(word) {
  return word === word.toLocaleUpperCase();
}

function trim(s$$3) {
  return s$$3.trim();
}

function tokensToString(tokens) {
  return (0, _RegExp.replace)(trim((0, _String.join)(" ", ...tokens)), " ([^\\w])", "$1");
}

function getDeterminerPhraseFromTokens(tokens$$1) {
  const token0Lower = lower(tokens$$1[0]);
  let det$$1;
  const matchValue$$1 = (0, _Map.FSharpMap$$TryFind$$2B595)(determinerMap(), token0Lower);

  if (matchValue$$1 == null) {
    if (!(0, _Set.FSharpSet$$Contains$$2B595)(wordSet(), token0Lower) ? true : (0, _Set.FSharpSet$$Contains$$2B595)(wordSet(), token0Lower + "s")) {
      const matchValue$$2 = token0Lower.substr(0, 1);

      switch (matchValue$$2) {
        case "a":
        case "e":
        case "i":
        case "o":
        case "u":
          {
            det$$1 = "an";
            break;
          }

        default:
          {
            det$$1 = "a";
          }
      }
    } else {
      det$$1 = "";
    }
  } else {
    const det = matchValue$$1;
    det$$1 = det;
  }

  const correctCaseToken0 = isAcronym(tokens$$1[0]) ? tokens$$1[0] : token0Lower;
  return tokensToString((0, _Array.ofSeq)((0, _Seq.delay)(function () {
    return (0, _Seq.append)((0, _Seq.singleton)(det$$1), (0, _Seq.delay)(function () {
      return (0, _Seq.append)((0, _Seq.singleton)(correctCaseToken0), (0, _Seq.delay)(function () {
        return (0, _Seq.map)(function (i) {
          return tokens$$1[i];
        }, (0, _Seq.rangeNumber)(1, 1, tokens$$1.length - 1));
      }));
    }));
  }), Array));
}

function getDeterminerPhrase(text) {
  return getDeterminerPhraseFromTokens(text.split(" "));
}

function getPredicate(entry) {
  const nounEntry = entry.glossTag[0] !== "Pertaining" ? (0, _Array.last)(entry.entryTag).indexOf("N") === 0 : false;
  const pluralEntry = nounEntry ? (0, _String.endsWith)((0, _Array.last)(entry.entryTag), "S") : false;
  const needsDeterminer = entry.entryTag[0].indexOf("N") === 0 ? true : entry.entryTag[0].indexOf("J") === 0;
  let verb;
  const matchValue$$3 = [nounEntry, pluralEntry, isAcronym(entry.entry[0])];
  verb = matchValue$$3[2] ? "is" : matchValue$$3[0] ? matchValue$$3[1] ? "are" : "is" : "means";
  const completion = needsDeterminer ? getDeterminerPhraseFromTokens(entry.gloss) : tokensToString(entry.gloss);
  return verb + " " + (0, _String.trim)(completion, " ", ".");
}

const FeedbackRequest = (0, _Types.declare)(function DefinitionalFeedback_FeedbackRequest(arg1, arg2) {
  this.CorrectAnswer = arg1;
  this.IncorrectAnswer = arg2;
}, _Types.Record);
exports.FeedbackRequest = FeedbackRequest;

function FeedbackRequest$reflection() {
  return (0, _Reflection.record)("DefinitionalFeedback.FeedbackRequest", [], FeedbackRequest, () => [["CorrectAnswer", _Reflection.string], ["IncorrectAnswer", _Reflection.string]]);
}

function GenerateFeedback(incorrectAnswer, correctAnswer) {
  const incorrectAnswerSpellingMatch = (0, _SpellingCorrector.CorrectSpelling)(incorrectAnswer);
  const matchValue$$4 = [(0, _Map.FSharpMap$$TryFind$$2B595)(definitionMap(), incorrectAnswerSpellingMatch), (0, _Map.FSharpMap$$TryFind$$2B595)(definitionMap(), correctAnswer)];
  var $target$$20, correctEntry, incorrectEntry;

  if (matchValue$$4[0] != null) {
    if (matchValue$$4[1] != null) {
      $target$$20 = 0;
      correctEntry = matchValue$$4[1];
      incorrectEntry = matchValue$$4[0];
    } else {
      $target$$20 = 1;
    }
  } else {
    $target$$20 = 1;
  }

  switch ($target$$20) {
    case 0:
      {
        return firstLetterUpper(incorrectAnswerSpellingMatch) + " is not right. The right answer is " + correctAnswer + ". " + "The difference is that " + getDeterminerPhrase(incorrectAnswerSpellingMatch) + " " + getPredicate(incorrectEntry) + ", and " + getDeterminerPhrase(correctAnswer) + " " + getPredicate(correctEntry) + ".";
      }

    case 1:
      {
        return null;
      }
  }
}

function HarnessGenerateFeedback(jsonFeedbackRequest) {
  return (0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
    const fr = (0, _Decode.Auto$$$unsafeFromString$$Z33228D48)(jsonFeedbackRequest, null, null, {
      ResolveType() {
        return FeedbackRequest$reflection();
      }

    });
    const feedback = GenerateFeedback(fr.IncorrectAnswer, fr.CorrectAnswer);
    return Promise.resolve([1, "{feedback:" + feedback + "}"]);
  }));
}