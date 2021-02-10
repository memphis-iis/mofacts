"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Feedback$reflection = Feedback$reflection;
exports.EntryGloss$reflection = EntryGloss$reflection;
exports.firstLetterUpper = firstLetterUpper;
exports.lower = lower;
exports.Initialize = Initialize;
exports.isAcronym = isAcronym;
exports.trim = trim;
exports.tokensToString = tokensToString;
exports.getDeterminerPhraseFromTokens = getDeterminerPhraseFromTokens;
exports.getDeterminerPhrase = getDeterminerPhrase;
exports.getPredicate = getPredicate;
exports.HarnessFeedbackRequest$reflection = HarnessFeedbackRequest$reflection;
exports.HarnessFeedbackRequest$$$InitializeTest = HarnessFeedbackRequest$$$InitializeTest;
exports.GenerateFeedback = GenerateFeedback;
exports.HarnessGenerateFeedback = HarnessGenerateFeedback;
exports.GetDefinitionFromGlossary = GetDefinitionFromGlossary;
exports.GetDefinitionFromGlossaryHighRecall = GetDefinitionFromGlossaryHighRecall;
exports.HarnessFeedbackRequest = exports.wordSet = exports.determinerMap = exports.definitionMap = exports.EntryGloss = exports.Feedback = void 0;

var _Types = require("./fable-library.2.10.2/Types");

var _Reflection = require("./fable-library.2.10.2/Reflection");

var _String = require("./fable-library.2.10.2/String");

var _Util = require("./fable-library.2.10.2/Util");

var _Map = require("./fable-library.2.10.2/Map");

var _Set = require("./fable-library.2.10.2/Set");

var _Option = require("./fable-library.2.10.2/Option");

var _PromiseImpl = require("./Fable.Promise.2.1.0/PromiseImpl");

var _Promise = require("./Fable.Promise.2.1.0/Promise");

var _Decode = require("./Thoth.Json.4.0.0/Decode");

var _Array = require("./fable-library.2.10.2/Array");

var _Seq = require("./fable-library.2.10.2/Seq");

var _RegExp = require("./fable-library.2.10.2/RegExp");

const Feedback = (0, _Types.declare)(function DefinitionalFeedback_Feedback(feedback) {
  this.feedback = feedback;
}, _Types.Record);
exports.Feedback = Feedback;

function Feedback$reflection() {
  return (0, _Reflection.record_type)("DefinitionalFeedback.Feedback", [], Feedback, () => [["feedback", _Reflection.string_type]]);
}

const EntryGloss = (0, _Types.declare)(function DefinitionalFeedback_EntryGloss(entry, entryTag, gloss, glossTag) {
  this.entry = entry;
  this.entryTag = entryTag;
  this.gloss = gloss;
  this.glossTag = glossTag;
}, _Types.Record);
exports.EntryGloss = EntryGloss;

function EntryGloss$reflection() {
  return (0, _Reflection.record_type)("DefinitionalFeedback.EntryGloss", [], EntryGloss, () => [["entry", (0, _Reflection.array_type)(_Reflection.string_type)], ["entryTag", (0, _Reflection.array_type)(_Reflection.string_type)], ["gloss", (0, _Reflection.array_type)(_Reflection.string_type)], ["glossTag", (0, _Reflection.array_type)(_Reflection.string_type)]]);
}

function firstLetterUpper(input) {
  return (0, _String.substring)(input, 0, 1).toLocaleUpperCase() + (0, _String.substring)(input, 1);
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
  var elements, source, table, elements$$2, source$$8, source$$5, source$$4, source$$3, source$$2, table$$2;

  try {
    definitionMap(((0, _Decode.Auto$$$unsafeFromString$$Z5CB6BD)(jsonDictionary, undefined, undefined, {
      ResolveType() {
        return (0, _Reflection.class_type)("Microsoft.FSharp.Collections.FSharpMap`2", [_Reflection.string_type, EntryGloss$reflection()]);
      }

    })));
    wordSet((elements = (source = (table = definitionMap(), ((0, _Map.toSeq)(table))), ((0, _Seq.collect)(function mapping(tupledArg) {
      return (0, _Array.map)(lower, tupledArg[1].gloss, Array);
    }, source))), ((0, _Set.ofSeq)(elements, {
      Compare: _Util.comparePrimitives
    }))));
    let entryFirstWordSet;
    let elements$$1;
    let source$$1;
    const table$$1 = definitionMap();
    source$$1 = (0, _Map.toSeq)(table$$1);
    elements$$1 = (0, _Seq.map)(function mapping$$1(tupledArg$$1) {
      return tupledArg$$1[1].entry[0].toLocaleLowerCase();
    }, source$$1);
    entryFirstWordSet = (0, _Set.ofSeq)(elements$$1, {
      Compare: _Util.comparePrimitives
    });
    determinerMap((elements$$2 = (source$$8 = (source$$5 = (source$$4 = (source$$3 = (source$$2 = (table$$2 = definitionMap(), ((0, _Map.toSeq)(table$$2))), ((0, _Seq.collect)(function mapping$$2(tupledArg$$2) {
      return (0, _Seq.zip)(((0, _Array.map)(lower, tupledArg$$2[1].gloss, Array)), tupledArg$$2[1].glossTag);
    }, source$$2))), ((0, _Seq.pairwise)(source$$3))), ((0, _Seq.choose)(function chooser(tupledArg$$3) {
      const w1Lower = tupledArg$$3[0][0].toLocaleLowerCase();
      const matchValue = [tupledArg$$3[0][1], (0, _Set.FSharpSet$$Contains$$2B595)(entryFirstWordSet, tupledArg$$3[1][0])];
      var $target$$26;

      if (matchValue[0] === "DT") {
        if (matchValue[1]) {
          if ((w1Lower === "a" ? true : w1Lower === "an") ? true : w1Lower === "the") {
            $target$$26 = 0;
          } else {
            $target$$26 = 1;
          }
        } else {
          $target$$26 = 1;
        }
      } else {
        $target$$26 = 1;
      }

      switch ($target$$26) {
        case 0:
          {
            return [tupledArg$$3[1][0], tupledArg$$3[0][0]];
          }

        case 1:
          {
            return undefined;
          }
      }
    }, source$$4))), ((0, _Map.groupBy)(function projection(tuple) {
      return tuple[0];
    }, source$$5, {
      Equals($x$$11, $y$$12) {
        return $x$$11 === $y$$12;
      },

      GetHashCode: _Util.structuralHash
    }))), ((0, _Seq.map)(function mapping$$3(tupledArg$$4) {
      var tuple$$3, source$$7;
      return [tupledArg$$4[0], (tuple$$3 = (source$$7 = ((0, _Map.countBy)(function projection$$1(tuple$$1) {
        return tuple$$1[1];
      }, tupledArg$$4[1], {
        Equals($x$$13, $y$$14) {
          return $x$$13 === $y$$14;
        },

        GetHashCode: _Util.structuralHash
      })), ((0, _Seq.maxBy)(function projection$$2(tuple$$2) {
        return tuple$$2[1];
      }, source$$7, {
        Compare: _Util.comparePrimitives
      }))), (tuple$$3[0]))];
    }, source$$8))), ((0, _Map.ofSeq)(elements$$2, {
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

function isAcronym(word) {
  return word === word.toLocaleUpperCase();
}

function trim(s$$3) {
  return s$$3.trim();
}

function tokensToString(tokens) {
  var s$$4;
  return (0, _RegExp.replace)((s$$4 = ((0, _String.join)(" ", tokens)), (trim(s$$4))), " ([^\\w])", "$1");
}

function getDeterminerPhraseFromTokens(tokens$$1) {
  var value;
  let token0Lower;
  const s$$5 = tokens$$1[0];
  token0Lower = lower(s$$5);
  let det$$1;
  const matchValue$$1 = (0, _Map.FSharpMap$$TryFind$$2B595)(determinerMap(), token0Lower);

  if (matchValue$$1 == null) {
    if ((value = (0, _Set.FSharpSet$$Contains$$2B595)(wordSet(), token0Lower), (!value)) ? true : (0, _Set.FSharpSet$$Contains$$2B595)(wordSet(), token0Lower + "s")) {
      const matchValue$$2 = (0, _String.substring)(token0Lower, 0, 1);

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
  const tokens$$2 = (0, _Array.ofSeq)((0, _Seq.delay)(function () {
    return (0, _Seq.append)((0, _Seq.singleton)(det$$1), (0, _Seq.delay)(function () {
      return (0, _Seq.append)((0, _Seq.singleton)(correctCaseToken0), (0, _Seq.delay)(function () {
        return (0, _Seq.map)(function (i) {
          return tokens$$1[i];
        }, (0, _Seq.rangeNumber)(1, 1, tokens$$1.length - 1));
      }));
    }));
  }), Array);
  return tokensToString(tokens$$2);
}

function getDeterminerPhrase(text) {
  const tokens$$3 = text.split(" ");
  return getDeterminerPhraseFromTokens(tokens$$3);
}

function getPredicate(entry) {
  const nounEntry = entry.glossTag[0] !== "Pertaining" ? ((0, _Array.last)(entry.entryTag)).indexOf("N") === 0 : false;
  const pluralEntry = nounEntry ? (0, _String.endsWith)(((0, _Array.last)(entry.entryTag)), "S") : false;
  const needsDeterminer = entry.entryTag[0].indexOf("N") === 0 ? true : entry.entryTag[0].indexOf("J") === 0;
  let verb;
  const matchValue$$3 = [nounEntry, pluralEntry, isAcronym(entry.entry[0])];
  verb = matchValue$$3[2] ? "is" : matchValue$$3[0] ? matchValue$$3[1] ? "are" : "is" : "means";
  let completion;

  if (needsDeterminer) {
    completion = getDeterminerPhraseFromTokens(entry.gloss);
  } else {
    completion = tokensToString(entry.gloss);
  }

  return verb + " " + (0, _String.trim)(completion, " ", ".");
}

const HarnessFeedbackRequest = (0, _Types.declare)(function DefinitionalFeedback_HarnessFeedbackRequest(CorrectAnswer, IncorrectAnswer) {
  this.CorrectAnswer = CorrectAnswer;
  this.IncorrectAnswer = IncorrectAnswer;
}, _Types.Record);
exports.HarnessFeedbackRequest = HarnessFeedbackRequest;

function HarnessFeedbackRequest$reflection() {
  return (0, _Reflection.record_type)("DefinitionalFeedback.HarnessFeedbackRequest", [], HarnessFeedbackRequest, () => [["CorrectAnswer", _Reflection.string_type], ["IncorrectAnswer", _Reflection.string_type]]);
}

function HarnessFeedbackRequest$$$InitializeTest() {
  return new HarnessFeedbackRequest("ADH", "acetylcholine");
}

function GenerateFeedback(incorrectAnswer, correctAnswer) {
  return (0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
    let feedback;
    const matchValue$$4 = [(0, _Map.FSharpMap$$TryFind$$2B595)(definitionMap(), incorrectAnswer), (0, _Map.FSharpMap$$TryFind$$2B595)(definitionMap(), correctAnswer)];
    var $target$$39, correctEntry, incorrectEntry;

    if (matchValue$$4[0] != null) {
      if (matchValue$$4[1] != null) {
        $target$$39 = 0;
        correctEntry = matchValue$$4[1];
        incorrectEntry = matchValue$$4[0];
      } else {
        $target$$39 = 1;
      }
    } else {
      $target$$39 = 1;
    }

    switch ($target$$39) {
      case 0:
        {
          feedback = firstLetterUpper(incorrectAnswer) + " is not right. The right answer is " + correctAnswer + ". " + "The difference is that " + getDeterminerPhrase(incorrectAnswer) + " " + getPredicate(incorrectEntry) + ", and " + getDeterminerPhrase(correctAnswer) + " " + getPredicate(correctEntry) + ".";
          break;
        }

      case 1:
        {
          feedback = null;
          break;
        }
    }

    return feedback !== null ? Promise.resolve(new _Option.Result(0, "Ok", new Feedback(feedback))) : Promise.resolve(new _Option.Result(1, "Error", "Unable to generate definitional feedback. Definitional feedback cache is " + ((0, _Map.FSharpMap$$get_IsEmpty)(definitionMap()) ? "empty" : "full")));
  }));
}

function HarnessGenerateFeedback(jsonFeedbackRequest) {
  let fr;
  fr = (0, _Decode.Auto$$$unsafeFromString$$Z5CB6BD)(jsonFeedbackRequest, undefined, undefined, {
    ResolveType() {
      return HarnessFeedbackRequest$reflection();
    }

  });
  return GenerateFeedback(fr.IncorrectAnswer, fr.CorrectAnswer);
}

function GetDefinitionFromGlossary(term) {
  var input$$1;
  const matchValue$$5 = (0, _Map.FSharpMap$$TryFind$$2B595)(definitionMap(), term);

  if (matchValue$$5 == null) {
    return undefined;
  } else {
    const entry$$1 = matchValue$$5;
    const arg0 = (input$$1 = getDeterminerPhrase(term), (firstLetterUpper(input$$1))) + " " + getPredicate(entry$$1) + ".";
    return arg0;
  }
}

function GetDefinitionFromGlossaryHighRecall(term$$1) {
  let candidateTerms;
  const array$$4 = [term$$1, term$$1.split(" ")[0]];
  candidateTerms = array$$4.filter(function predicate(t) {
    return (0, _Map.FSharpMap$$ContainsKey$$2B595)(definitionMap(), t);
  });

  if (candidateTerms.length > 0) {
    return GetDefinitionFromGlossary(candidateTerms[0]);
  } else {
    return undefined;
  }
}