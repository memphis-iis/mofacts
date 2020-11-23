"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Substitution$reflection = Substitution$reflection;
exports.Substitution$$$Create$$42925214 = Substitution$$$Create$$42925214;
exports.Question$reflection = Question$reflection;
exports.Question$$$Create$$Z6ACE8F80 = Question$$$Create$$Z6ACE8F80;
exports.isPerson = isPerson;
exports.wh = wh;
exports.whDependencySubstitution = whDependencySubstitution;
exports.whSubjectSubstitution = whSubjectSubstitution;
exports.whObjectSubstitution = whObjectSubstitution;
exports.whAdjunctSubstitutions = whAdjunctSubstitutions;
exports.nominalSpanRootOption = nominalSpanRootOption;
exports.whSrlSubstitutions = whSrlSubstitutions;
exports.getSubstitutions = getSubstitutions;
exports.getSubstitutionsFailSafe = getSubstitutionsFailSafe;
exports.auxSubstitution = auxSubstitution;
exports.indicesToSubstring = indicesToSubstring;
exports.trimPunctuation = trimPunctuation;
exports.questionCase = questionCase;
exports.prompt = prompt;
exports.hint = hint;
exports.GetQuestions = GetQuestions;
exports.GetQuotedQuestions = GetQuotedQuestions;
exports.hintIndex = exports.Question = exports.Substitution = void 0;

var _Types = require("./fable-library.2.10.2/Types");

var _AllenNLP = require("./AllenNLP");

var _Reflection = require("./fable-library.2.10.2/Reflection");

var _Map = require("./fable-library.2.10.2/Map");

var _Array = require("./fable-library.2.10.2/Array");

var _Util = require("./fable-library.2.10.2/Util");

var _Set = require("./fable-library.2.10.2/Set");

var _String = require("./fable-library.2.10.2/String");

var _List = require("./fable-library.2.10.2/List");

var _Seq = require("./fable-library.2.10.2/Seq");

var _RegExp = require("./fable-library.2.10.2/RegExp");

const Substitution = (0, _Types.declare)(function QuestionGenerator_Substitution(SentenceAnnotation, Start, Stop, ReplacementIndices, ReplacementString) {
  this.SentenceAnnotation = SentenceAnnotation;
  this.Start = Start | 0;
  this.Stop = Stop | 0;
  this.ReplacementIndices = ReplacementIndices;
  this.ReplacementString = ReplacementString;
}, _Types.Record);
exports.Substitution = Substitution;

function Substitution$reflection() {
  return (0, _Reflection.record_type)("QuestionGenerator.Substitution", [], Substitution, () => [["SentenceAnnotation", (0, _AllenNLP.SentenceAnnotation$reflection)()], ["Start", _Reflection.int32_type], ["Stop", _Reflection.int32_type], ["ReplacementIndices", (0, _Reflection.array_type)(_Reflection.int32_type)], ["ReplacementString", _Reflection.string_type]]);
}

function Substitution$$$Create$$42925214(sa, start, stop, indices, aString) {
  return new Substitution(sa, start, stop, indices, aString);
}

const Question = (0, _Types.declare)(function QuestionGenerator_Question(QuestionType, Text$, Answer) {
  this.QuestionType = QuestionType;
  this.Text = Text$;
  this.Answer = Answer;
}, _Types.Record);
exports.Question = Question;

function Question$reflection() {
  return (0, _Reflection.record_type)("QuestionGenerator.Question", [], Question, () => [["QuestionType", _Reflection.string_type], ["Text", _Reflection.string_type], ["Answer", _Reflection.string_type]]);
}

function Question$$$Create$$Z6ACE8F80(qType, text, answer) {
  return new Question(qType, text, answer);
}

function isPerson(index, sa$$1) {
  const matchValue = sa$$1.dep.pos[index];

  switch (matchValue) {
    case "NNP":
      {
        return false;
      }

    case "PRP":
      {
        return false;
      }

    default:
      {
        return false;
      }
  }
}

function wh(index$$1, isNominative, sa$$2) {
  if (isPerson(index$$1, sa$$2)) {
    if (isNominative) {
      return "who";
    } else {
      return "whom";
    }
  } else if (sa$$2.dep.predicted_dependencies[index$$1] === "pobj") {
    return "where";
  } else {
    return "what";
  }
}

function whDependencySubstitution(getIndex, isNominative$$1, sa$$4) {
  const matchValue$$1 = getIndex(sa$$4);

  if (matchValue$$1 == null) {
    return undefined;
  } else {
    const index$$2 = matchValue$$1 | 0;
    let dependentIndices;
    dependentIndices = (0, _AllenNLP.getDependentIndices)(index$$2, sa$$4);
    let whString;
    whString = wh(index$$2, isNominative$$1, sa$$4);
    const arg0 = Substitution$$$Create$$42925214(sa$$4, 0, sa$$4.dep.words.length, dependentIndices, whString);
    return arg0;
  }
}

function whSubjectSubstitution(sa$$7) {
  return whDependencySubstitution(_AllenNLP.getSubjectIndex, true, sa$$7);
}

function whObjectSubstitution(sa$$10) {
  return whDependencySubstitution(_AllenNLP.getPredicateIndex, false, sa$$10);
}

function whAdjunctSubstitutions(sa$$13) {
  let array$$4;
  let array$$3;
  array$$3 = (0, _Array.map)(function mapping(verb) {
    let table;
    table = (0, _AllenNLP.srlArgToIndexMap)(verb.tags);
    return (0, _Map.toArray)(table);
  }, sa$$13.srl.verbs, Array);
  array$$4 = (0, _Array.collect)(function mapping$$3(map) {
    return (0, _Array.map)(function mapping$$2(tupledArg) {
      let indices$$1;
      indices$$1 = (0, _Array.map)(function mapping$$1(tuple) {
        return tuple[1];
      }, tupledArg[1], Int32Array);

      if (sa$$13.dep.pos[indices$$1[0]] !== "WRB") {
        if (tupledArg[0] === "ARGM-CAU") {
          const arg0$$1 = Substitution$$$Create$$42925214(sa$$13, 0, sa$$13.dep.words.length, indices$$1, "why");
          return arg0$$1;
        } else if (tupledArg[0] === "ARGM-DIR") {
          const arg0$$2 = Substitution$$$Create$$42925214(sa$$13, 0, sa$$13.dep.words.length, indices$$1, "where");
          return arg0$$2;
        } else if (tupledArg[0] === "ARGM-LOC") {
          const arg0$$3 = Substitution$$$Create$$42925214(sa$$13, 0, sa$$13.dep.words.length, indices$$1, "where");
          return arg0$$3;
        } else if (tupledArg[0] === "ARGM-MNR") {
          const arg0$$4 = Substitution$$$Create$$42925214(sa$$13, 0, sa$$13.dep.words.length, indices$$1, "how");
          return arg0$$4;
        } else if (tupledArg[0] === "ARGM-TMP") {
          const arg0$$5 = Substitution$$$Create$$42925214(sa$$13, 0, sa$$13.dep.words.length, indices$$1, "when");
          return arg0$$5;
        } else {
          return undefined;
        }
      } else {
        return undefined;
      }
    }, map, Array);
  }, array$$3, Array);
  return (0, _Array.toList)(array$$4);
}

function nominalSpanRootOption(sa$$14, indices$$2) {
  let rootIndexOption;
  rootIndexOption = (0, _Array.tryFind)(function predicate(i) {
    const d = sa$$14.dep.predicted_dependencies[i];

    if (d.indexOf("nsubj") === 0 ? true : d === "dobj") {
      return true;
    } else {
      return d === "iobj";
    }
  }, indices$$2);

  if (rootIndexOption == null) {
    return undefined;
  } else {
    const rootIndex = rootIndexOption | 0;
    let dependentIndices$$1;
    dependentIndices$$1 = (0, _AllenNLP.getDependentIndices)(rootIndex, sa$$14);

    if ((0, _Set.FSharpSet$$IsSupersetOf$$6A20B1FF)((0, _Set.ofArray)(dependentIndices$$1, {
      Compare: _Util.comparePrimitives
    }), (0, _Set.ofArray)(indices$$2, {
      Compare: _Util.comparePrimitives
    }))) {
      return rootIndex;
    } else {
      return undefined;
    }
  }
}

function whSrlSubstitutions(sa$$16) {
  let array$$19;
  let array$$18;
  let array$$17;
  array$$17 = (0, _Array.map)(function mapping$$4(verb$$1) {
    let table$$1;
    table$$1 = (0, _AllenNLP.srlArgToIndexMap)(verb$$1.tags);
    return (0, _Map.toArray)(table$$1);
  }, sa$$16.srl.verbs, Array);
  array$$18 = (0, _Array.choose)(function chooser$$1(map$$1) {
    let argNs;
    let array$$8;
    array$$8 = map$$1.filter(function predicate$$1(tupledArg$$1) {
      if (tupledArg$$1[0].indexOf("ARG") === 0) {
        const value = tupledArg$$1[0].indexOf("ARGM") === 0;
        return !value;
      } else {
        return false;
      }
    });
    argNs = (0, _Array.distinctBy)(function projection(tuple$$1) {
      return tuple$$1[0];
    }, array$$8, {
      Equals($x$$5, $y$$6) {
        return $x$$5 === $y$$6;
      },

      GetHashCode: _Util.structuralHash
    });

    if (argNs.length < 2) {
      return undefined;
    } else {
      let nominalSpanRoots;
      nominalSpanRoots = (0, _Array.choose)(function chooser(tupledArg$$2) {
        let indices$$3;
        indices$$3 = (0, _Array.map)(function mapping$$5(tuple$$2) {
          return tuple$$2[1];
        }, tupledArg$$2[1], Int32Array);
        return nominalSpanRootOption(sa$$16, indices$$3);
      }, argNs, Int32Array);

      if (argNs.length !== nominalSpanRoots.length) {
        return undefined;
      } else {
        let indices$$4;
        indices$$4 = (0, _Array.collect)(function mapping$$7(tupledArg$$3) {
          return (0, _Array.map)(function mapping$$6(tuple$$3) {
            return tuple$$3[1];
          }, tupledArg$$3[1], Int32Array);
        }, argNs, Int32Array);
        let start$$1;
        start$$1 = (0, _Array.min)(indices$$4, {
          Compare: _Util.comparePrimitives
        });
        let stop$$1;
        stop$$1 = (0, _Array.max)(indices$$4, {
          Compare: _Util.comparePrimitives
        });
        let arg0$$7;
        arg0$$7 = (0, _Array.mapIndexed)(function mapping$$9(i$$1, tupledArg$$4) {
          let argNIndices;
          argNIndices = (0, _Array.map)(function mapping$$8(tuple$$4) {
            return tuple$$4[1];
          }, tupledArg$$4[1], Int32Array);
          let whString$$1;
          const index$$3 = nominalSpanRoots[i$$1] | 0;
          const isNominative$$4 = (0, _String.endsWith)(tupledArg$$4[0], "0");
          whString$$1 = wh(index$$3, isNominative$$4, sa$$16);
          const arg0$$6 = Substitution$$$Create$$42925214(sa$$16, start$$1, stop$$1, argNIndices, whString$$1);
          return arg0$$6;
        }, argNs, Array);
        return arg0$$7;
      }
    }
  }, array$$17, Array);
  array$$19 = (0, _Array.collect)(function mapping$$10(x) {
    return x;
  }, array$$18, Array);
  return (0, _Array.toList)(array$$19);
}

function getSubstitutions(sa$$18) {
  let list;
  list = whSrlSubstitutions(sa$$18);
  return (0, _List.choose)(function chooser$$2(x$$1) {
    return x$$1;
  }, list);
}

function getSubstitutionsFailSafe(sa$$20) {
  const list$$1 = (0, _List.ofArray)([(whSubjectSubstitution(sa$$20)), (whObjectSubstitution(sa$$20))]);
  return (0, _List.choose)(function chooser$$3(x$$2) {
    return x$$2;
  }, list$$1);
}

function auxSubstitution(sa$$23) {
  let beIndex;
  beIndex = (0, _AllenNLP.getBeRootIndex)(sa$$23);
  let auxIndex;
  auxIndex = (0, _AllenNLP.getInvertAuxIndex)(sa$$23);

  if (auxIndex == null) {
    if (beIndex == null) {
      void null;
    } else {
      const be = beIndex | 0;
      void null;
    }
  } else {
    const aux = auxIndex | 0;
    void null;
  }
}

function indicesToSubstring(sa$$26, indices$$5) {
  let strings;
  strings = (0, _Array.map)(function mapping$$11(i$$2) {
    return sa$$26.dep.words[i$$2];
  }, indices$$5, Array);
  return (0, _String.join)(" ", strings);
}

function trimPunctuation(text$$1) {
  return (0, _String.trim)(text$$1, ".", " ");
}

function questionCase(text$$2) {
  var text$$3;
  return (text$$3 = (Array.from((0, _Seq.mapIndexed)(function mapping$$12(i$$3, c) {
    if (i$$3 === 0) {
      return c.toLocaleUpperCase();
    } else {
      return c;
    }
  }, text$$2.split(""))).join("")), (trimPunctuation(text$$3))) + "?";
}

function prompt(sa$$27, sub) {
  const subIndiceSet = (0, _Set.ofSeq)(sub.ReplacementIndices, {
    Compare: _Util.comparePrimitives
  });

  if ((0, _Set.FSharpSet$$get_IsEmpty)(subIndiceSet)) {
    return undefined;
  } else {
    let text$$4;
    let strings$$1;
    const array$$21 = (0, _Array.ofSeq)((0, _Seq.delay)(function () {
      return (0, _Seq.map)(function (i$$4) {
        return [i$$4, sa$$27.dep.words[i$$4]];
      }, (0, _Seq.rangeNumber)(sub.Start, 1, sub.Stop));
    }), Array);
    strings$$1 = (0, _Array.choose)(function chooser$$4(tupledArg$$5) {
      if (tupledArg$$5[0] === (0, _Set.FSharpSet$$get_MinimumElement)(subIndiceSet)) {
        return sub.ReplacementString;
      } else if ((0, _Set.FSharpSet$$Contains$$2B595)(subIndiceSet, tupledArg$$5[0])) {
        return undefined;
      } else {
        return tupledArg$$5[1];
      }
    }, array$$21, Array);
    text$$4 = (0, _String.join)(" ", strings$$1);
    const arg0$$10 = Question$$$Create$$Z6ACE8F80("prompt", (questionCase(text$$4)), (indicesToSubstring(sa$$27, sub.ReplacementIndices)));
    return arg0$$10;
  }
}

const hintIndex = (0, _Util.createAtom)(0);
exports.hintIndex = hintIndex;

function hint(sa$$28, sub$$1) {
  var text$$8, indices$$7, array$$23;
  const hintTemplates = (0, _List.ofArray)(["And what do we know about #", "What can you say about #", "Tell me about #", "Tell me what you know about #", "Can you tell me about #", "What do you know about #"]);
  hintIndex(hintIndex() + 1);
  const template = (0, _List.item)(hintIndex() % ((0, _List.length)(hintTemplates) - 1), hintTemplates);

  if (sub$$1.ReplacementIndices.length === 1 ? sa$$28.dep.pos[sub$$1.ReplacementIndices[0]].indexOf("PRP") === 0 : false) {
    return undefined;
  } else {
    let filler;
    let strings$$2;
    strings$$2 = (0, _Array.map)(function mapping$$13(i$$6) {
      if (i$$6 > 0) {
        return sa$$28.dep.words[i$$6];
      } else {
        return sa$$28.dep.words[i$$6].toLocaleLowerCase();
      }
    }, sub$$1.ReplacementIndices, Array);
    filler = (0, _String.join)(" ", strings$$2);
    const text$$6 = (0, _String.replace)(template, "#", filler);
    const subIndiceSet$$1 = (0, _Set.ofSeq)(sub$$1.ReplacementIndices, {
      Compare: _Util.comparePrimitives
    });
    const arg0$$11 = Question$$$Create$$Z6ACE8F80("hint", (questionCase(text$$6)), (text$$8 = (indices$$7 = (array$$23 = (0, _Array.ofSeq)((0, _Seq.rangeNumber)(0, 1, sa$$28.dep.words.length - 1), Int32Array), (array$$23.filter(function predicate$$2($arg$$15) {
      let value$$1;
      value$$1 = (0, _Set.FSharpSet$$Contains$$2B595)(subIndiceSet$$1, $arg$$15);
      return !value$$1;
    }))), (indicesToSubstring(sa$$28, indices$$7))), (trimPunctuation(text$$8))));
    return arg0$$11;
  }
}

function GetQuestions(sa$$29) {
  let plans;
  let matchValue$$3;
  matchValue$$3 = getSubstitutions(sa$$29);

  if (matchValue$$3.tail == null) {
    plans = getSubstitutionsFailSafe(sa$$29);
  } else {
    plans = matchValue$$3;
  }

  const list$$4 = (0, _List.append)(((0, _List.choose)(function chooser$$5(sub$$2) {
    return prompt(sa$$29, sub$$2);
  }, plans)), ((0, _List.choose)(function chooser$$6(sub$$3) {
    return hint(sa$$29, sub$$3);
  }, plans)));
  return (0, _Array.ofList)(list$$4, Array);
}

function GetQuotedQuestions(clozeAnswer, sa$$32) {
  let array$$24;
  array$$24 = GetQuestions(sa$$32);
  return (0, _Array.map)(function mapping$$14(q) {
    const Text$ = (0, _RegExp.replace)(q.Text, "\\b" + clozeAnswer + "\\b", "\"" + clozeAnswer + "\"");
    return new Question(q.QuestionType, Text$, q.Answer);
  }, array$$24, Array);
}