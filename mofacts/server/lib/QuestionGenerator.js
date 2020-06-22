"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Substitution$reflection = Substitution$reflection;
exports.Substitution$$$Create$$6379541 = Substitution$$$Create$$6379541;
exports.Question$reflection = Question$reflection;
exports.Question$$$Create$$Z6ACE8F80 = Question$$$Create$$Z6ACE8F80;
exports.isPerson = isPerson;
exports.wh = wh;
exports.whDependencySubstitution = whDependencySubstitution;
exports.whSubjectSubstitution = whSubjectSubstitution;
exports.whObjectSubstitution = whObjectSubstitution;
exports.whAdjunctSubstitutions = whAdjunctSubstitutions;
exports.getSubstitutions = getSubstitutions;
exports.auxSubstitution = auxSubstitution;
exports.indicesToSubstring = indicesToSubstring;
exports.trimPunctuation = trimPunctuation;
exports.questionCase = questionCase;
exports.prompt = prompt;
exports.hint = hint;
exports.GetQuestions = GetQuestions;
exports.hintIndex = exports.Question = exports.Substitution = void 0;

var _Types = require("./fable-library.2.8.4/Types");

var _Reflection = require("./fable-library.2.8.4/Reflection");

var _AllenNLP = require("./AllenNLP");

var _Map = require("./fable-library.2.8.4/Map");

var _Array = require("./fable-library.2.8.4/Array");

var _List = require("./fable-library.2.8.4/List");

var _String = require("./fable-library.2.8.4/String");

var _Seq = require("./fable-library.2.8.4/Seq");

var _Util = require("./fable-library.2.8.4/Util");

var _Set = require("./fable-library.2.8.4/Set");

const Substitution = (0, _Types.declare)(function QuestionGenerator_Substitution(arg1, arg2) {
  this.SourceIndices = arg1;
  this.ReplacementString = arg2;
}, _Types.Record);
exports.Substitution = Substitution;

function Substitution$reflection() {
  return (0, _Reflection.record)("QuestionGenerator.Substitution", [], Substitution, () => [["SourceIndices", (0, _Reflection.array)(_Reflection.int32)], ["ReplacementString", _Reflection.string]]);
}

function Substitution$$$Create$$6379541(indices, aString) {
  return new Substitution(indices, aString);
}

const Question = (0, _Types.declare)(function QuestionGenerator_Question(arg1, arg2, arg3) {
  this.QuestionType = arg1;
  this.Text = arg2;
  this.Answer = arg3;
}, _Types.Record);
exports.Question = Question;

function Question$reflection() {
  return (0, _Reflection.record)("QuestionGenerator.Question", [], Question, () => [["QuestionType", _Reflection.string], ["Text", _Reflection.string], ["Answer", _Reflection.string]]);
}

function Question$$$Create$$Z6ACE8F80(qType, text, answer) {
  return new Question(qType, text, answer);
}

function isPerson(index, sa) {
  const matchValue = sa.dep.pos[index];

  switch (matchValue) {
    case "NNP":
      {
        return true;
      }

    case "PRP":
      {
        return true;
      }

    default:
      {
        return false;
      }
  }
}

function wh(index$$1, isNominative, sa$$1) {
  if (isPerson(index$$1, sa$$1)) {
    if (isNominative) {
      return "who";
    } else {
      return "whom";
    }
  } else if (sa$$1.dep.predicted_dependencies[index$$1] === "pobj") {
    return "where";
  } else {
    return "what";
  }
}

function whDependencySubstitution(getIndex, isNominative$$1, sa$$3) {
  const matchValue$$1 = getIndex(sa$$3);

  if (matchValue$$1 == null) {
    return null;
  } else {
    const index$$2 = matchValue$$1 | 0;
    let dependentIndices;
    dependentIndices = (0, _AllenNLP.getDependentIndices)(index$$2, sa$$3);
    let whString;
    whString = wh(index$$2, isNominative$$1, sa$$3);
    const arg0 = Substitution$$$Create$$6379541(dependentIndices, whString);
    return arg0;
  }
}

function whSubjectSubstitution(sa$$6) {
  return whDependencySubstitution(_AllenNLP.getSubjectIndex, true, sa$$6);
}

function whObjectSubstitution(sa$$9) {
  return whDependencySubstitution(_AllenNLP.getPredicateIndex, false, sa$$9);
}

function whAdjunctSubstitutions(sa$$12) {
  let array$$4;
  let array$$3;
  array$$3 = (0, _Array.map)(function mapping(verb) {
    let table;
    table = (0, _AllenNLP.srlArgToIndexMap)(verb.tags);
    return (0, _Map.toArray)(table);
  }, sa$$12.srl.verbs, Array);
  array$$4 = (0, _Array.collect)(function mapping$$3(map) {
    return (0, _Array.map)(function mapping$$2(tupledArg) {
      let indices$$1;
      indices$$1 = (0, _Array.map)(function mapping$$1(tuple) {
        return tuple[1];
      }, tupledArg[1], Int32Array);

      if (tupledArg[0] === "ARGM-CAU") {
        const arg0$$1 = Substitution$$$Create$$6379541(indices$$1, "why");
        return arg0$$1;
      } else if (tupledArg[0] === "ARGM-DIR") {
        const arg0$$2 = Substitution$$$Create$$6379541(indices$$1, "where");
        return arg0$$2;
      } else if (tupledArg[0] === "ARGM-LOC") {
        const arg0$$3 = Substitution$$$Create$$6379541(indices$$1, "where");
        return arg0$$3;
      } else if (tupledArg[0] === "ARGM-MNR") {
        const arg0$$4 = Substitution$$$Create$$6379541(indices$$1, "how");
        return arg0$$4;
      } else if (tupledArg[0] === "ARGM-TMP") {
        const arg0$$5 = Substitution$$$Create$$6379541(indices$$1, "when");
        return arg0$$5;
      } else {
        return null;
      }
    }, map, Array);
  }, array$$3, Array);
  return (0, _Array.toList)(array$$4);
}

function getSubstitutions(sa$$13) {
  const list = new _Types.List((whSubjectSubstitution(sa$$13)), new _Types.List((whObjectSubstitution(sa$$13)), (whAdjunctSubstitutions(sa$$13))));
  return (0, _List.choose)(function chooser(x) {
    return x;
  }, list);
}

function auxSubstitution(sa$$17) {
  let beIndex;
  beIndex = (0, _AllenNLP.getBeRootIndex)(sa$$17);
  let auxIndex;
  auxIndex = (0, _AllenNLP.getInvertAuxIndex)(sa$$17);

  if (auxIndex == null) {
    if (beIndex == null) {} else {
      const be = beIndex | 0;
    }
  } else {
    const aux = auxIndex | 0;
  }
}

function indicesToSubstring(sa$$20, indices$$2) {
  let strings;
  strings = (0, _Array.map)(function mapping$$4(i) {
    return sa$$20.dep.words[i];
  }, indices$$2, Array);
  return (0, _String.join)(" ", strings);
}

function trimPunctuation(text$$1) {
  return (0, _String.trim)(text$$1, ".", " ");
}

function questionCase(text$$2) {
  var text$$3;
  return (text$$3 = (Array.from((0, _Seq.mapIndexed)(function mapping$$5(i$$1, c) {
    if (i$$1 === 0) {
      return c.toLocaleUpperCase();
    } else {
      return c;
    }
  }, text$$2.split(""))).join("")), (trimPunctuation(text$$3))) + "?";
}

function prompt(sa$$21, sub) {
  const subIndiceSet = (0, _Set.ofSeq)(sub.SourceIndices, {
    Compare: _Util.comparePrimitives
  });
  let text$$4;
  let strings$$1;
  let array$$7;
  array$$7 = (0, _Array.mapIndexed)(function mapping$$6(i$$2, w) {
    return [i$$2, w];
  }, sa$$21.dep.words, Array);
  strings$$1 = (0, _Array.choose)(function chooser$$1(tupledArg$$1) {
    if (tupledArg$$1[0] === (0, _Set.FSharpSet$$get_MinimumElement)(subIndiceSet)) {
      return sub.ReplacementString;
    } else if ((0, _Set.FSharpSet$$Contains$$2B595)(subIndiceSet, tupledArg$$1[0])) {
      return null;
    } else {
      return tupledArg$$1[1];
    }
  }, array$$7, Array);
  text$$4 = (0, _String.join)(" ", strings$$1);
  return Question$$$Create$$Z6ACE8F80("prompt", (questionCase(text$$4)), (indicesToSubstring(sa$$21, sub.SourceIndices)));
}

const hintIndex = (0, _Util.createAtom)(0);
exports.hintIndex = hintIndex;

function hint(sa$$22, sub$$1) {
  var text$$8, indices$$4, array$$9;
  const hintTemplates = (0, _List.ofArray)(["And what do we know about #", "What can you say about #", "Tell me about #", "Tell me what you know about #", "Can you tell me about #", "What do you know about #"]);
  hintIndex(hintIndex() + 1);
  const template = (0, _List.item)(hintIndex() % ((0, _List.length)(hintTemplates) - 1), hintTemplates);
  let filler;
  let strings$$2;
  strings$$2 = (0, _Array.map)(function mapping$$7(i$$4) {
    return sa$$22.dep.words[i$$4];
  }, sub$$1.SourceIndices, Array);
  filler = (0, _String.join)(" ", strings$$2);
  const text$$6 = (0, _String.replace)(template, "#", filler);
  const subIndiceSet$$1 = (0, _Set.ofSeq)(sub$$1.SourceIndices, {
    Compare: _Util.comparePrimitives
  });
  return Question$$$Create$$Z6ACE8F80("hint", (questionCase(text$$6)), (text$$8 = (indices$$4 = (array$$9 = (0, _Array.ofSeq)((0, _Seq.rangeNumber)(0, 1, sa$$22.dep.words.length - 1), Int32Array), (array$$9.filter(function predicate($arg$$5) {
    let value;
    value = (0, _Set.FSharpSet$$Contains$$2B595)(subIndiceSet$$1, $arg$$5);
    return !value;
  }))), (indicesToSubstring(sa$$22, indices$$4))), (trimPunctuation(text$$8))));
}

function GetQuestions(sa$$23) {
  let plans;
  plans = getSubstitutions(sa$$23);
  const list$$3 = (0, _List.append)(((0, _List.map)(function mapping$$8(sub$$2) {
    return prompt(sa$$23, sub$$2);
  }, plans)), ((0, _List.map)(function mapping$$9(sub$$3) {
    return hint(sa$$23, sub$$3);
  }, plans)));
  return (0, _Array.ofList)(list$$3, Array);
}