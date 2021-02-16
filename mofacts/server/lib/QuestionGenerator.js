"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Tag$reflection = Tag$reflection;
exports.Substitution$reflection = Substitution$reflection;
exports.Substitution$$$Create$$17EA372C = Substitution$$$Create$$17EA372C;
exports.Question$reflection = Question$reflection;
exports.Question$$$Create$$ZCEA50A7 = Question$$$Create$$ZCEA50A7;
exports.isPerson = isPerson;
exports.wh = wh;
exports.isRoot = isRoot;
exports.whSyntacticSubjectFilter = whSyntacticSubjectFilter;
exports.nominalSpanRootOption = nominalSpanRootOption;
exports.whSrlSubstitutions = whSrlSubstitutions;
exports.getSubstitutions = getSubstitutions;
exports.auxSubstitution = auxSubstitution;
exports.indicesToSubstring = indicesToSubstring;
exports.trimPunctuation = trimPunctuation;
exports.questionCase = questionCase;
exports.prompt = prompt;
exports.hint = hint;
exports.GetQuestions = GetQuestions;
exports.GetQuotedQuestions = GetQuotedQuestions;
exports.HarnessGetQuestions = HarnessGetQuestions;
exports.InitializeTest = InitializeTest;
exports.hintIndex = exports.Question = exports.Substitution = exports.Tag = void 0;

var _Types = require("./fable-library.2.10.2/Types");

var _Reflection = require("./fable-library.2.10.2/Reflection");

var _AllenNLP = require("./AllenNLP");

var _Array = require("./fable-library.2.10.2/Array");

var _String = require("./fable-library.2.10.2/String");

var _Util = require("./fable-library.2.10.2/Util");

var _Set = require("./fable-library.2.10.2/Set");

var _Map = require("./fable-library.2.10.2/Map");

var _Seq = require("./fable-library.2.10.2/Seq");

var _WordFrequency = require("./WordFrequency");

var _RegExp = require("./fable-library.2.10.2/RegExp");

var _Option = require("./fable-library.2.10.2/Option");

var _PromiseImpl = require("./Fable.Promise.2.1.0/PromiseImpl");

var _Promise = require("./Fable.Promise.2.1.0/Promise");

const Tag = (0, _Types.declare)(function QuestionGenerator_Tag(tag, name, ...fields) {
  this.tag = tag | 0;
  this.name = name;
  this.fields = fields;
}, _Types.Union);
exports.Tag = Tag;

function Tag$reflection() {
  return (0, _Reflection.union_type)("QuestionGenerator.Tag", [], Tag, () => ["IsPerson", ["WhDependency", [["Item", _Reflection.string_type]]], "IsLocation", ["WhTarget", [["Item1", _Reflection.int32_type], ["Item2", _Reflection.string_type]]], ["FocusTarget", [["Item1", _Reflection.int32_type], ["Item2", _Reflection.string_type]]], ["Adjunct", [["Item", _Reflection.string_type]]], ["WhArg", [["Item", _Reflection.string_type]]], "DisfluentArg", ["Trace", [["Item", _Reflection.string_type]]]]);
}

const Substitution = (0, _Types.declare)(function QuestionGenerator_Substitution(SentenceAnnotation, Start, Stop, ReplacementIndices, ReplacementString, FocusIndices, Tags) {
  this.SentenceAnnotation = SentenceAnnotation;
  this.Start = Start | 0;
  this.Stop = Stop | 0;
  this.ReplacementIndices = ReplacementIndices;
  this.ReplacementString = ReplacementString;
  this.FocusIndices = FocusIndices;
  this.Tags = Tags;
}, _Types.Record);
exports.Substitution = Substitution;

function Substitution$reflection() {
  return (0, _Reflection.record_type)("QuestionGenerator.Substitution", [], Substitution, () => [["SentenceAnnotation", (0, _AllenNLP.SentenceAnnotation$reflection)()], ["Start", _Reflection.int32_type], ["Stop", _Reflection.int32_type], ["ReplacementIndices", (0, _Reflection.array_type)(_Reflection.int32_type)], ["ReplacementString", _Reflection.string_type], ["FocusIndices", (0, _Reflection.array_type)(_Reflection.int32_type)], ["Tags", (0, _Reflection.array_type)(Tag$reflection())]]);
}

function Substitution$$$Create$$17EA372C(sa, start, stop, replacementIndices, replacementString, focusIndices, tags) {
  return new Substitution(sa, start, stop, replacementIndices, replacementString, focusIndices, tags);
}

const Question = (0, _Types.declare)(function QuestionGenerator_Question(QuestionType, Text$, Focus, Answer, Tags) {
  this.QuestionType = QuestionType;
  this.Text = Text$;
  this.Focus = Focus;
  this.Answer = Answer;
  this.Tags = Tags;
}, _Types.Record);
exports.Question = Question;

function Question$reflection() {
  return (0, _Reflection.record_type)("QuestionGenerator.Question", [], Question, () => [["QuestionType", _Reflection.string_type], ["Text", _Reflection.string_type], ["Focus", _Reflection.string_type], ["Answer", _Reflection.string_type], ["Tags", (0, _Reflection.array_type)(Tag$reflection())]]);
}

function Question$$$Create$$ZCEA50A7(qType, text, focus, answer, tags$$1) {
  return new Question(qType, text, focus, answer, tags$$1);
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
  var arg0;
  const tags$$2 = [];
  void tags$$2.push((arg0 = sa$$2.dep.predicted_dependencies[index$$1], (new Tag(1, "WhDependency", arg0))));
  void tags$$2.push(new Tag(3, "WhTarget", index$$1, sa$$2.dep.words[index$$1]));
  let wh$$1;

  if (isPerson(index$$1, sa$$2)) {
    void tags$$2.push(new Tag(0, "IsPerson"));
    wh$$1 = isNominative ? "who" : "whom";
  } else if (sa$$2.dep.predicted_dependencies[index$$1] === "pobj") {
    void tags$$2.push(new Tag(2, "IsLocation"));
    wh$$1 = "where";
  } else {
    wh$$1 = "what";
  }

  return [wh$$1, tags$$2];
}

function isRoot(sa$$4, index$$2) {
  return sa$$4.dep.predicted_heads[index$$2 - 1] === 0;
}

function whSyntacticSubjectFilter(subOption) {
  if (subOption == null) {
    return undefined;
  } else {
    const sub = subOption;
    let filterOut = false;
    let array$$1;
    array$$1 = (0, _Array.mapIndexed)(function mapping(i, x) {
      return [i, x];
    }, sub.SentenceAnnotation.dep.predicted_dependencies, Array);
    filterOut = array$$1.some(function predicate(tupledArg) {
      if ((0, _String.endsWith)(tupledArg[1], "comp")) {
        const index$$3 = sub.SentenceAnnotation.dep.predicted_heads[tupledArg[0]] | 0;
        return isRoot(sub.SentenceAnnotation, index$$3);
      } else {
        return false;
      }
    });

    if (filterOut) {
      return undefined;
    } else {
      return subOption;
    }
  }
}

function nominalSpanRootOption(sa$$6, indices) {
  let spanWords;
  let strings;
  strings = (0, _Array.map)(function mapping$$1(i$$2) {
    return sa$$6.dep.words[i$$2];
  }, indices, Array);
  spanWords = (0, _String.join)(" ", strings);
  return (0, _Array.tryFind)(function predicate$$1(i$$3) {
    const d$$1 = sa$$6.dep.predicted_dependencies[i$$3];

    if ((d$$1.indexOf("nsubj") === 0 ? true : d$$1 === "dobj") ? true : d$$1 === "iobj") {
      let dependentIndices;
      dependentIndices = (0, _AllenNLP.getDependentIndices)(i$$3, sa$$6);
      return (0, _Set.FSharpSet$$IsSupersetOf$$6A20B1FF)((0, _Set.ofArray)(dependentIndices, {
        Compare: _Util.comparePrimitives
      }), (0, _Set.ofArray)(indices, {
        Compare: _Util.comparePrimitives
      }));
    } else {
      return false;
    }
  }, indices);
}

function whSrlSubstitutions(sa$$8) {
  let arg00$$1;
  let array$$24;
  let array$$23;
  array$$23 = (0, _Array.map)(function mapping$$2(verb) {
    let table;
    table = (0, _AllenNLP.srlArgToIndexMapWithCollapsedReferents)(verb.tags);
    return (0, _Map.toArray)(table);
  }, sa$$8.srl.verbs, Array);
  array$$24 = (0, _Array.choose)(function chooser(mapArr) {
    let hasArguments;
    hasArguments = mapArr.some(function predicate$$2(tupledArg$$1) {
      return tupledArg$$1[0].indexOf("A") === 0;
    });

    if (hasArguments) {
      try {
        const frameTags = [];
        let debugAlignment;
        let array$$8;
        let array$$7;
        array$$7 = (0, _Array.collect)(function mapping$$3(tuple) {
          return tuple[1];
        }, mapArr, Array);
        array$$8 = (0, _Array.sortBy)(function projection(tuple$$1) {
          return tuple$$1[1];
        }, array$$7, {
          Compare: _Util.comparePrimitives
        });
        debugAlignment = (0, _Array.map)(function mapping$$4(tupledArg$$2) {
          const word = sa$$8.dep.words[tupledArg$$2[1]];
          return (0, _Types.anonRecord)({
            arg: tupledArg$$2[0],
            pos: sa$$8.dep.pos[tupledArg$$2[1]],
            word: word
          });
        }, array$$8, Array);
        let argNs;
        let array$$10;
        array$$10 = mapArr.filter(function predicate$$3(tupledArg$$3) {
          if (tupledArg$$3[0].indexOf("ARG") === 0) {
            const value = tupledArg$$3[0].indexOf("ARGM") === 0;
            return !value;
          } else {
            return false;
          }
        });
        argNs = (0, _Array.distinctBy)(function projection$$1(tuple$$2) {
          return tuple$$2[0];
        }, array$$10, {
          Equals($x$$7, $y$$8) {
            return $x$$7 === $y$$8;
          },

          GetHashCode: _Util.structuralHash
        });
        let disfluentArgN;
        disfluentArgN = argNs.filter(function predicate$$4(tupledArg$$4) {
          let argNIndices;
          argNIndices = (0, _Array.map)(function mapping$$5(tuple$$3) {
            return tuple$$3[1];
          }, tupledArg$$4[1], Int32Array);
          const startPos = sa$$8.dep.pos[argNIndices[0]];
          const stopPos = sa$$8.dep.pos[((0, _Array.last)(argNIndices))];

          if ((startPos === "IN" ? true : startPos === "WDT") ? true : stopPos === "IN") {
            return true;
          } else {
            return stopPos === "WDT";
          }
        });
        let finalArgNs;
        const matchValue$$1 = disfluentArgN.length | 0;

        switch (matchValue$$1) {
          case 0:
            {
              finalArgNs = argNs;
              break;
            }

          case 1:
            {
              void frameTags.push(new Tag(7, "DisfluentArg"));
              finalArgNs = disfluentArgN;
              break;
            }

          default:
            {
              finalArgNs = [];
            }
        }

        let indices$$1;
        indices$$1 = (0, _Array.collect)(function mapping$$7(tupledArg$$5) {
          return (0, _Array.map)(function mapping$$6(tuple$$4) {
            return tuple$$4[1];
          }, tupledArg$$5[1], Int32Array);
        }, argNs, Int32Array);
        let start$$1;
        start$$1 = (0, _Array.min)(indices$$1, {
          Compare: _Util.comparePrimitives
        });
        let stop$$1;
        stop$$1 = (0, _Array.max)(indices$$1, {
          Compare: _Util.comparePrimitives
        });
        const replaceFocusTuples = (0, _Array.ofSeq)((0, _Seq.delay)(function () {
          return (0, _Seq.collect)(function (a$$1) {
            let argNsList;
            argNsList = Array.from(argNs);
            const value$$1 = (0, _Array.removeInPlace)(a$$1, argNsList);
            void value$$1;
            return (0, _Seq.singleton)([a$$1, argNsList]);
          }, finalArgNs);
        }), Array);
        let arg0$$3;
        arg0$$3 = (0, _Array.mapIndexed)(function mapping$$10(i$$5, tupledArg$$6) {
          const tags$$3 = [];
          (0, _Array.addRangeInPlace)(frameTags, tags$$3);
          void tags$$3.push((new Tag(6, "WhArg", tupledArg$$6[0][0])));
          let argNIndices$$1;
          argNIndices$$1 = (0, _Array.map)(function mapping$$8(tuple$$5) {
            return tuple$$5[1];
          }, tupledArg$$6[0][1], Int32Array);
          const argNRoot = (0, _AllenNLP.getRootOfSpan)(argNIndices$$1[0], ((0, _Array.last)(argNIndices$$1)), sa$$8) | 0;
          let patternInput;
          const isNominative$$1 = (0, _String.endsWith)(tupledArg$$6[0][0], "0");
          patternInput = wh(argNRoot, isNominative$$1, sa$$8);
          (0, _Array.addRangeInPlace)(patternInput[1], tags$$3);
          let focusIndices$$1;

          if (tupledArg$$6[1].length > 0) {
            let indices$$2;
            let array$$20;
            const tuple$$6 = tupledArg$$6[1][0];
            array$$20 = tuple$$6[1];
            indices$$2 = (0, _Array.map)(function mapping$$9(tuple$$7) {
              return tuple$$7[1];
            }, array$$20, Int32Array);
            const focusIndex = (0, _AllenNLP.getRootOfSpan)(indices$$2[0], ((0, _Array.last)(indices$$2)), sa$$8) | 0;
            const focusWord = sa$$8.dep.words[focusIndex];
            void tags$$3.push(new Tag(4, "FocusTarget", focusIndex, focusWord));
            focusIndices$$1 = indices$$2;
          } else {
            focusIndices$$1 = new Int32Array([]);
          }

          if (focusIndices$$1.length === 0) {
            return undefined;
          } else {
            const arg0$$2 = Substitution$$$Create$$17EA372C(sa$$8, start$$1, stop$$1, argNIndices$$1, patternInput[0], focusIndices$$1, tags$$3.slice());
            return arg0$$2;
          }
        }, replaceFocusTuples, Array);
        return arg0$$3;
      } catch (matchValue$$2) {
        return undefined;
      }
    } else {
      return undefined;
    }
  }, array$$23, Array);
  arg00$$1 = (0, _Array.collect)(function mapping$$11(x$$1) {
    return x$$1;
  }, array$$24, Array);
  return Array.from(arg00$$1);
}

function getSubstitutions(sa$$10) {
  let whSrl;
  whSrl = whSrlSubstitutions(sa$$10);
  const subs = [];
  (0, _Array.addRangeInPlace)(whSrl, subs);
  let source$$1;
  source$$1 = (0, _Seq.choose)(function chooser$$1(x$$2) {
    return x$$2;
  }, subs);
  return (0, _Array.ofSeq)(source$$1, Array);
}

function auxSubstitution(sa$$12) {
  let beIndex;
  beIndex = (0, _AllenNLP.getBeRootIndex)(sa$$12);
  let auxIndex;
  auxIndex = (0, _AllenNLP.getInvertAuxIndex)(sa$$12);

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

function indicesToSubstring(sa$$15, indices$$3) {
  let strings$$1;
  strings$$1 = (0, _Array.map)(function mapping$$12(i$$6) {
    if (i$$6 === 0) {
      return sa$$15.dep.words[i$$6].toLocaleLowerCase();
    } else {
      return sa$$15.dep.words[i$$6];
    }
  }, indices$$3, Array);
  return (0, _String.join)(" ", strings$$1);
}

function trimPunctuation(text$$1) {
  return (0, _String.trim)(text$$1, ".", " ", ",");
}

function questionCase(text$$2) {
  var text$$3;
  return (text$$3 = (Array.from((0, _Seq.mapIndexed)(function mapping$$13(i$$7, c) {
    if (i$$7 === 0) {
      return c.toLocaleUpperCase();
    } else {
      return c;
    }
  }, text$$2.split(""))).join("")), (trimPunctuation(text$$3))) + "?";
}

function prompt(sa$$16, sub$$1) {
  const tags$$4 = [];
  (0, _Array.addRangeInPlace)(sub$$1.Tags, tags$$4);
  const subIndiceSet = (0, _Set.ofSeq)(sub$$1.ReplacementIndices, {
    Compare: _Util.comparePrimitives
  });

  if ((0, _Set.FSharpSet$$get_IsEmpty)(subIndiceSet)) {
    return undefined;
  } else {
    let text$$4;
    let strings$$2;
    const array$$26 = (0, _Array.ofSeq)((0, _Seq.delay)(function () {
      return (0, _Seq.map)(function (i$$8) {
        return [i$$8, sa$$16.dep.words[i$$8]];
      }, (0, _Seq.rangeNumber)(sub$$1.Start, 1, sub$$1.Stop));
    }), Array);
    strings$$2 = (0, _Array.choose)(function chooser$$2(tupledArg$$7) {
      if (tupledArg$$7[0] === (0, _Set.FSharpSet$$get_MinimumElement)(subIndiceSet)) {
        return sub$$1.ReplacementString;
      } else if ((0, _Set.FSharpSet$$Contains$$2B595)(subIndiceSet, tupledArg$$7[0])) {
        return undefined;
      } else {
        return tupledArg$$7[1];
      }
    }, array$$26, Array);
    text$$4 = (0, _String.join)(" ", strings$$2);
    const arg0$$6 = Question$$$Create$$ZCEA50A7("prompt", (questionCase(text$$4)), (indicesToSubstring(sa$$16, sub$$1.FocusIndices)), (indicesToSubstring(sa$$16, sub$$1.ReplacementIndices)), tags$$4.slice());
    return arg0$$6;
  }
}

const hintIndex = (0, _Util.createAtom)(0);
exports.hintIndex = hintIndex;

function hint(sa$$17, sub$$2) {
  const tags$$5 = [];
  (0, _Array.addRangeInPlace)(sub$$2.Tags, tags$$5);
  const hintTemplates = ["And what do we know about #", "What can you say about #", "Tell me about #", "Tell me what you know about #", "Can you tell me about #", "What do you know about #"];
  hintIndex(hintIndex() + 1);
  const template = hintTemplates[hintIndex() % (hintTemplates.length - 1)];

  if (((0, _Array.equalsWith)(_Util.comparePrimitives, sub$$2.FocusIndices, new Int32Array(0)) ? true : sub$$2.FocusIndices.length > 15) ? true : sub$$2.ReplacementIndices.length === 1 ? sa$$17.dep.pos[sub$$2.ReplacementIndices[0]].indexOf("PRP") === 0 : false) {
    return undefined;
  } else {
    let focusString;
    focusString = indicesToSubstring(sa$$17, sub$$2.FocusIndices);
    const text$$6 = (0, _String.replace)(template, "#", focusString);
    const subIndiceSet$$1 = (0, _Set.ofSeq)(sub$$2.FocusIndices, {
      Compare: _Util.comparePrimitives
    });
    let answer$$1;
    let text$$7;
    text$$7 = indicesToSubstring(sa$$17, sub$$2.ReplacementIndices);
    answer$$1 = trimPunctuation(text$$7);
    const arg0$$7 = Question$$$Create$$ZCEA50A7("hint", (questionCase(text$$6)), focusString, answer$$1, tags$$5.slice());
    return arg0$$7;
  }
}

function GetQuestions(sa$$18) {
  let plans;
  let array$$29;
  array$$29 = getSubstitutions(sa$$18);
  plans = (0, _Array.sortBy)(function projection$$2(s) {
    if (s.FocusIndices.length > 0) {
      let array$$28;
      array$$28 = (0, _Array.map)(function mapping$$14(i$$10) {
        const word$$1 = sa$$18.dep.words[i$$10];
        return (0, _WordFrequency.Get)(word$$1);
      }, s.FocusIndices, Float64Array);
      return (0, _Array.min)(array$$28, {
        Compare: _Util.comparePrimitives
      });
    } else {
      return 1;
    }
  }, array$$29, {
    Compare: _Util.comparePrimitives
  });
  let prompts;
  let array$$31;
  array$$31 = (0, _Array.choose)(function chooser$$3(sub$$3) {
    return prompt(sa$$18, sub$$3);
  }, plans, Array);
  prompts = (0, _Array.distinctBy)(function projection$$3(p) {
    return p.Answer;
  }, array$$31, {
    Equals($x$$23, $y$$24) {
      return $x$$23 === $y$$24;
    },

    GetHashCode: _Util.structuralHash
  });
  let hints;
  let array$$33;
  array$$33 = (0, _Array.choose)(function chooser$$4(sub$$4) {
    return hint(sa$$18, sub$$4);
  }, plans, Array);
  hints = (0, _Array.distinctBy)(function projection$$4(h) {
    return h.Answer;
  }, array$$33, {
    Equals($x$$25, $y$$26) {
      return $x$$25 === $y$$26;
    },

    GetHashCode: _Util.structuralHash
  });
  const questions = [];
  (0, _Array.addRangeInPlace)(prompts, questions);
  (0, _Array.addRangeInPlace)(hints, questions);
  return (0, _Array.ofSeq)(questions, Array);
}

function GetQuotedQuestions(clozeAnswer, sa$$20) {
  let array$$34;
  array$$34 = GetQuestions(sa$$20);
  return (0, _Array.map)(function mapping$$15(q) {
    const Text$ = (0, _RegExp.replace)(q.Text, "\\b" + clozeAnswer + "\\b", "\"" + clozeAnswer + "\"");
    return new Question(q.QuestionType, Text$, q.Focus, q.Answer, q.Tags);
  }, array$$34, Array);
}

function HarnessGetQuestions(sentence) {
  return (0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
    return (0, _AllenNLP.GetNLP)(undefined, sentence).then(function (_arg1$$1) {
      if (_arg1$$1.tag === 1) {
        return Promise.resolve(new _Option.Result(1, "Error", _arg1$$1.fields[0]));
      } else {
        let questions$$1;
        let sa$$22;
        sa$$22 = (0, _Array.head)(_arg1$$1.fields[0].sentences);
        questions$$1 = GetQuestions(sa$$22);
        return Promise.resolve(new _Option.Result(0, "Ok", questions$$1));
      }
    });
  }));
}

function InitializeTest() {
  return "The difference is that the cerebrum is a part of the brain in the upper part of the cranial cavity that provides higher mental functions, and the cerebellum is a part of the brain that coordinates skeletal muscle movement.";
}