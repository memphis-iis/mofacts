"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.isOK = isOK;
exports.resultToTypeOption = resultToTypeOption;
exports.resultToErrorOption = resultToErrorOption;
exports.allOK = allOK;
exports.resultsToType = resultsToType;
exports.resultsToError = resultsToError;
exports.PromisifyOk = PromisifyOk;
exports.Tag$reflection = Tag$reflection;
exports.ElasticProcess$reflection = ElasticProcess$reflection;
exports.CoreferenceProcess$reflection = CoreferenceProcess$reflection;
exports.Definition$reflection = Definition$reflection;
exports.Definition$$$TextOption$$3EDC65C1 = Definition$$$TextOption$$3EDC65C1;
exports.DefinitionProcess$reflection = DefinitionProcess$reflection;
exports.ElaboratedFeedback$reflection = ElaboratedFeedback$reflection;
exports.EntailmentComparison$reflection = EntailmentComparison$reflection;
exports.lower = lower;
exports.lowContains = lowContains;
exports.Configuration$reflection = Configuration$reflection;
exports.Configuration$$$Default = Configuration$$$Default;
exports.getWikiDefinition = getWikiDefinition;
exports.getGlossaryDefinition = getGlossaryDefinition;
exports.getDefinitionProcess = getDefinitionProcess;
exports.getElasticProcess = getElasticProcess;
exports.getCoreferenceProcess = getCoreferenceProcess;
exports.GetElaboratedFeedback = GetElaboratedFeedback;
exports.HarnessElaboratedFeedbackRequest$reflection = HarnessElaboratedFeedbackRequest$reflection;
exports.HarnessElaboratedFeedbackRequest$$$InitializeTest = HarnessElaboratedFeedbackRequest$$$InitializeTest;
exports.HarnessGetElaboratedFeedback = HarnessGetElaboratedFeedback;
exports.ElaboratedFeedbackCondition = ElaboratedFeedbackCondition;
exports.HarnessElaboratedFeedbackRequest = exports.Configuration = exports.EntailmentComparison = exports.ElaboratedFeedback = exports.DefinitionProcess = exports.Definition = exports.CoreferenceProcess = exports.ElasticProcess = exports.Tag = void 0;

var _Option = require("./fable-library.2.10.2/Option");

var _Array = require("./fable-library.2.10.2/Array");

var _PromiseImpl = require("./Fable.Promise.2.1.0/PromiseImpl");

var _Promise = require("./Fable.Promise.2.1.0/Promise");

var _Types = require("./fable-library.2.10.2/Types");

var _Reflection = require("./fable-library.2.10.2/Reflection");

var _LongformQA = require("./LongformQA");

var _Wikifier = require("./Wikifier");

var _Util = require("./fable-library.2.10.2/Util");

var _Seq = require("./fable-library.2.10.2/Seq");

var _String = require("./fable-library.2.10.2/String");

var _DefinitionalFeedback = require("./DefinitionalFeedback");

var _AllenNLP = require("./AllenNLP");

var _Fetch = require("./Thoth.Fetch.2.0.0/Fetch");

var _Decode = require("./Thoth.Json.4.0.0/Decode");

function isOK(r) {
  if (r.tag === 1) {
    return false;
  } else {
    return true;
  }
}

function resultToTypeOption(r$$2) {
  if (r$$2.tag === 1) {
    return undefined;
  } else {
    return (0, _Option.some)(r$$2.fields[0]);
  }
}

function resultToErrorOption(r$$4) {
  if (r$$4.tag === 1) {
    return (0, _Option.some)(r$$4.fields[0]);
  } else {
    return undefined;
  }
}

function allOK(resultsArr) {
  return resultsArr.every(function predicate(r$$6) {
    if (r$$6.tag === 1) {
      return false;
    } else {
      return true;
    }
  });
}

function resultsToType(resultsArr$$1) {
  return (0, _Array.choose)(function chooser(r$$8) {
    if (r$$8.tag === 1) {
      return undefined;
    } else {
      return (0, _Option.some)(r$$8.fields[0]);
    }
  }, resultsArr$$1, Array);
}

function resultsToError(resultsArr$$2) {
  return (0, _Array.choose)(function chooser$$1(r$$10) {
    if (r$$10.tag === 1) {
      return (0, _Option.some)(r$$10.fields[0]);
    } else {
      return undefined;
    }
  }, resultsArr$$2, Array);
}

function PromisifyOk(input) {
  return (0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
    return Promise.resolve(new _Option.Result(0, "Ok", input));
  }));
}

const Tag = (0, _Types.declare)(function ElaboratedFeedback_Tag(tag, name, ...fields) {
  this.tag = tag | 0;
  this.name = name;
  this.fields = fields;
}, _Types.Union);
exports.Tag = Tag;

function Tag$reflection() {
  return (0, _Reflection.union_type)("ElaboratedFeedback.Tag", [], Tag, () => [["DefinitionsUsed", [["Item", _Reflection.int32_type]]], ["ClozeUsed", [["Item", _Reflection.bool_type]]], ["ElasticDocumentsFound", [["Item", _Reflection.int32_type]]], ["ElasticDocumentsContainBothKeys", [["Item", _Reflection.int32_type]]], ["ElasticDocumentsUsed", [["Item", _Reflection.int32_type]]], ["AnswerSentencesContainOneKey", [["Item", _Reflection.int32_type]]], ["CoreferenceFilteredSentences", [["Item", _Reflection.bool_type]]], ["SyntheticQuestion", [["Item", _Reflection.string_type]]], ["Trace", [["Item", _Reflection.string_type]]]]);
}

const ElasticProcess = (0, _Types.declare)(function ElaboratedFeedback_ElasticProcess(ElasticDocuments, MatchingElasticDocumentIndices, OutputContext) {
  this.ElasticDocuments = ElasticDocuments;
  this.MatchingElasticDocumentIndices = MatchingElasticDocumentIndices;
  this.OutputContext = OutputContext;
}, _Types.Record);
exports.ElasticProcess = ElasticProcess;

function ElasticProcess$reflection() {
  return (0, _Reflection.record_type)("ElaboratedFeedback.ElasticProcess", [], ElasticProcess, () => [["ElasticDocuments", (0, _Reflection.array_type)((0, _LongformQA.Document$$reflection)())], ["MatchingElasticDocumentIndices", (0, _Reflection.array_type)(_Reflection.int32_type)], ["OutputContext", (0, _Reflection.array_type)(_Reflection.string_type)]]);
}

const CoreferenceProcess = (0, _Types.declare)(function ElaboratedFeedback_CoreferenceProcess(CandidateAnswerSentences, CorefCandidateAnswerSentences, SelectedSentenceIndices, OutputAnswer) {
  this.CandidateAnswerSentences = CandidateAnswerSentences;
  this.CorefCandidateAnswerSentences = CorefCandidateAnswerSentences;
  this.SelectedSentenceIndices = SelectedSentenceIndices;
  this.OutputAnswer = OutputAnswer;
}, _Types.Record);
exports.CoreferenceProcess = CoreferenceProcess;

function CoreferenceProcess$reflection() {
  return (0, _Reflection.record_type)("ElaboratedFeedback.CoreferenceProcess", [], CoreferenceProcess, () => [["CandidateAnswerSentences", (0, _Reflection.array_type)(_Reflection.string_type)], ["CorefCandidateAnswerSentences", (0, _Reflection.array_type)(_Reflection.string_type)], ["SelectedSentenceIndices", (0, _Reflection.array_type)(_Reflection.int32_type)], ["OutputAnswer", _Reflection.string_type]]);
}

const Definition = (0, _Types.declare)(function ElaboratedFeedback_Definition(Text$, Source) {
  this.Text = Text$;
  this.Source = Source;
}, _Types.Record);
exports.Definition = Definition;

function Definition$reflection() {
  return (0, _Reflection.record_type)("ElaboratedFeedback.Definition", [], Definition, () => [["Text", _Reflection.string_type], ["Source", _Reflection.string_type]]);
}

function Definition$$$TextOption$$3EDC65C1(def) {
  if (def == null) {
    return undefined;
  } else {
    const d = def;
    return d.Text;
  }
}

const DefinitionProcess = (0, _Types.declare)(function ElaboratedFeedback_DefinitionProcess(CorrectAnswerDefinition, IncorrectAnswerDefinition, WikiExtracts, OutputContext) {
  this.CorrectAnswerDefinition = CorrectAnswerDefinition;
  this.IncorrectAnswerDefinition = IncorrectAnswerDefinition;
  this.WikiExtracts = WikiExtracts;
  this.OutputContext = OutputContext;
}, _Types.Record);
exports.DefinitionProcess = DefinitionProcess;

function DefinitionProcess$reflection() {
  return (0, _Reflection.record_type)("ElaboratedFeedback.DefinitionProcess", [], DefinitionProcess, () => [["CorrectAnswerDefinition", (0, _Reflection.option_type)(Definition$reflection())], ["IncorrectAnswerDefinition", (0, _Reflection.option_type)(Definition$reflection())], ["WikiExtracts", (0, _Reflection.option_type)((0, _Wikifier.WikiTermEntityExtracts$reflection)())], ["OutputContext", (0, _Reflection.array_type)(_Reflection.string_type)]]);
}

const ElaboratedFeedback = (0, _Types.declare)(function ElaboratedFeedback_ElaboratedFeedback(ElaboratedFeedback, IncorrectAnswer, CorrectAnswer, ClozeSentence, ElasticProcess, DefinitionProcess, ContextDocuments, CoreferenceProcess, SyntheticQuestion, Tags) {
  this.ElaboratedFeedback = ElaboratedFeedback;
  this.IncorrectAnswer = IncorrectAnswer;
  this.CorrectAnswer = CorrectAnswer;
  this.ClozeSentence = ClozeSentence;
  this.ElasticProcess = ElasticProcess;
  this.DefinitionProcess = DefinitionProcess;
  this.ContextDocuments = ContextDocuments;
  this.CoreferenceProcess = CoreferenceProcess;
  this.SyntheticQuestion = SyntheticQuestion;
  this.Tags = Tags;
}, _Types.Record);
exports.ElaboratedFeedback = ElaboratedFeedback;

function ElaboratedFeedback$reflection() {
  return (0, _Reflection.record_type)("ElaboratedFeedback.ElaboratedFeedback", [], ElaboratedFeedback, () => [["ElaboratedFeedback", _Reflection.string_type], ["IncorrectAnswer", _Reflection.string_type], ["CorrectAnswer", _Reflection.string_type], ["ClozeSentence", (0, _Reflection.option_type)(_Reflection.string_type)], ["ElasticProcess", ElasticProcess$reflection()], ["DefinitionProcess", (0, _Reflection.option_type)(DefinitionProcess$reflection())], ["ContextDocuments", (0, _Reflection.array_type)(_Reflection.string_type)], ["CoreferenceProcess", (0, _Reflection.option_type)(CoreferenceProcess$reflection())], ["SyntheticQuestion", _Reflection.string_type], ["Tags", (0, _Reflection.array_type)(Tag$reflection())]]);
}

const EntailmentComparison = (0, _Types.declare)(function ElaboratedFeedback_EntailmentComparison(Premise, Hypothesis, Entailment, Contradiction, Neutral) {
  this.Premise = Premise;
  this.Hypothesis = Hypothesis;
  this.Entailment = Entailment;
  this.Contradiction = Contradiction;
  this.Neutral = Neutral;
}, _Types.Record);
exports.EntailmentComparison = EntailmentComparison;

function EntailmentComparison$reflection() {
  return (0, _Reflection.record_type)("ElaboratedFeedback.EntailmentComparison", [], EntailmentComparison, () => [["Premise", ElaboratedFeedback$reflection()], ["Hypothesis", ElaboratedFeedback$reflection()], ["Entailment", _Reflection.float64_type], ["Contradiction", _Reflection.float64_type], ["Neutral", _Reflection.float64_type]]);
}

function lower(s) {
  return s.toLocaleLowerCase();
}

function lowContains(a, b) {
  return a.toLocaleLowerCase().indexOf(b.toLocaleLowerCase()) >= 0;
}

const Configuration = (0, _Types.declare)(function ElaboratedFeedback_Configuration(UseCloze, UseGlossaryDefinitions, UseWikipediaDefinitionsForMissingGlossaryDefinitions, ElasticDocsContainBothKeys, MaxElasticDocs, UseAnswerCoreferenceFilter, SyntheticQuestion) {
  this.UseCloze = UseCloze;
  this.UseGlossaryDefinitions = UseGlossaryDefinitions;
  this.UseWikipediaDefinitionsForMissingGlossaryDefinitions = UseWikipediaDefinitionsForMissingGlossaryDefinitions;
  this.ElasticDocsContainBothKeys = ElasticDocsContainBothKeys;
  this.MaxElasticDocs = MaxElasticDocs | 0;
  this.UseAnswerCoreferenceFilter = UseAnswerCoreferenceFilter;
  this.SyntheticQuestion = SyntheticQuestion;
}, _Types.Record);
exports.Configuration = Configuration;

function Configuration$reflection() {
  return (0, _Reflection.record_type)("ElaboratedFeedback.Configuration", [], Configuration, () => [["UseCloze", _Reflection.bool_type], ["UseGlossaryDefinitions", _Reflection.bool_type], ["UseWikipediaDefinitionsForMissingGlossaryDefinitions", _Reflection.bool_type], ["ElasticDocsContainBothKeys", _Reflection.bool_type], ["MaxElasticDocs", _Reflection.int32_type], ["UseAnswerCoreferenceFilter", _Reflection.bool_type], ["SyntheticQuestion", _Reflection.string_type]]);
}

function Configuration$$$Default() {
  return new Configuration(true, true, true, true, 3, true, "relationshipQuestion");
}

function getWikiDefinition(wikiExtracts, term) {
  let wtemOption;
  wtemOption = (0, _Array.tryFind)(function predicate$$1(wtem) {
    return wtem.Term === term;
  }, wikiExtracts.WikiTermEntityMatches);
  let pageIdsOption;

  if (wtemOption == null) {
    pageIdsOption = undefined;
  } else {
    const wtem$$1 = wtemOption;
    let arg0$$2;
    let array$$8;
    let array$$7;
    let array$$6;
    array$$6 = (0, _Array.choose)(function chooser$$2(em) {
      if (!(0, _Array.equalsWith)(function ($x$$1, $y$$2) {
        return $x$$1.CompareTo($y$$2);
      }, em.Entity.candidates, null) ? em.Entity.candidates.length > 0 : false) {
        let max;
        max = (0, _Array.maxBy)(function projection(c) {
          return c.score;
        }, em.Entity.candidates, {
          Compare: _Util.comparePrimitives
        });
        return [max.score, max.wikiId];
      } else {
        return undefined;
      }
    }, wtem$$1.EntityMatches, Array);
    array$$7 = (0, _Array.sortByDescending)(function projection$$1(tuple) {
      return tuple[0];
    }, array$$6, {
      Compare: _Util.comparePrimitives
    });
    array$$8 = (0, _Array.map)(function mapping(tuple$$1) {
      return tuple$$1[1];
    }, array$$7, Int32Array);
    arg0$$2 = (0, _Array.distinct)(array$$8, {
      Equals($x$$7, $y$$8) {
        return $x$$7 === $y$$8;
      },

      GetHashCode: _Util.structuralHash
    });
    pageIdsOption = arg0$$2;
  }

  if (pageIdsOption == null) {
    return undefined;
  } else {
    const pageIds = pageIdsOption;
    let definitions;
    const strings = (0, _Array.ofSeq)((0, _Seq.delay)(function () {
      return (0, _Seq.collect)(function (pageId) {
        return (0, _Seq.collect)(function (page) {
          return (pageId === page.pageid ? page.extract != null : false) ? (0, _Seq.singleton)(page.extract.split(".")[0]) : (0, _Seq.empty)();
        }, wikiExtracts.Pages);
      }, pageIds);
    }), Array);
    definitions = (0, _String.join)(". ", strings);

    if (definitions.length > 0) {
      const arg0$$3 = new Definition(definitions, "wikipedia");
      return arg0$$3;
    } else {
      return undefined;
    }
  }
}

function getGlossaryDefinition(term$$1) {
  let matchValue;
  matchValue = (0, _DefinitionalFeedback.GetDefinitionFromGlossaryHighRecall)(term$$1);

  if (matchValue == null) {
    return undefined;
  } else {
    const d$$1 = matchValue;
    const arg0$$4 = new Definition(d$$1, "glossary");
    return arg0$$4;
  }
}

function getDefinitionProcess(correctAnswer, incorrectAnswer, text, config) {
  const tags = [];

  if (config.UseGlossaryDefinitions) {
    let glossaryIncorrectDefinitionOption;
    glossaryIncorrectDefinitionOption = getGlossaryDefinition(incorrectAnswer);
    let glossaryCorrectDefinitionOption;
    glossaryCorrectDefinitionOption = getGlossaryDefinition(correctAnswer);

    if (config.UseWikipediaDefinitionsForMissingGlossaryDefinitions ? glossaryIncorrectDefinitionOption == null ? true : glossaryCorrectDefinitionOption == null : false) {
      return (0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
        const syntheticText = text + " " + (0, _String.replace)(text, correctAnswer, incorrectAnswer);
        return (0, _Wikifier.GetWikiExtractsForTerms)(syntheticText, [incorrectAnswer, correctAnswer]).then(function (_arg1) {
          if (_arg1.tag === 1) {
            return Promise.resolve(new _Option.Result(1, "Error", _arg1.fields[0]));
          } else {
            const wikiIncorrectDefinitionOption = getWikiDefinition(_arg1.fields[0], incorrectAnswer);
            const wikiCorrectDefinitionOption = getWikiDefinition(_arg1.fields[0], correctAnswer);
            const finalIncorrectDefinition = glossaryIncorrectDefinitionOption == null ? wikiIncorrectDefinitionOption == null ? undefined : wikiIncorrectDefinitionOption : glossaryIncorrectDefinitionOption;
            const finalCorrectDefinition = glossaryCorrectDefinitionOption == null ? wikiCorrectDefinitionOption == null ? undefined : wikiCorrectDefinitionOption : glossaryCorrectDefinitionOption;
            let definitionContext;
            const array$$9 = [finalIncorrectDefinition, finalCorrectDefinition];
            definitionContext = (0, _Array.choose)(Definition$$$TextOption$$3EDC65C1, array$$9, Array);
            void tags.push(new Tag(0, "DefinitionsUsed", definitionContext.length));
            const dp = new DefinitionProcess(finalCorrectDefinition, finalIncorrectDefinition, (_arg1.fields[0]), definitionContext);
            return Promise.resolve(new _Option.Result(0, "Ok", [(dp), tags]));
          }
        });
      }));
    } else {
      let definitionContext$$1;
      const array$$10 = [glossaryIncorrectDefinitionOption, glossaryCorrectDefinitionOption];
      definitionContext$$1 = (0, _Array.choose)(Definition$$$TextOption$$3EDC65C1, array$$10, Array);
      void tags.push(new Tag(0, "DefinitionsUsed", definitionContext$$1.length));
      const dp$$1 = new DefinitionProcess(glossaryCorrectDefinitionOption, glossaryIncorrectDefinitionOption, undefined, definitionContext$$1);
      return PromisifyOk([(dp$$1), tags]);
    }
  } else {
    void tags.push(new Tag(0, "DefinitionsUsed", 0));
    return PromisifyOk([undefined, tags]);
  }
}

function getElasticProcess(docs, correctAnswer$$1, incorrectAnswer$$1, config$$1) {
  const tags$$1 = [];
  void tags$$1.push(new Tag(2, "ElasticDocumentsFound", docs.length));
  let docTuples;
  let array$$12;
  array$$12 = (0, _Array.skip)(1, docs, Array);
  docTuples = (0, _Array.mapIndexed)(function mapping$$1(i, d$$2) {
    return [i, d$$2];
  }, array$$12, Array);
  let filteredDocuments;

  if (config$$1.ElasticDocsContainBothKeys) {
    let fd;
    fd = docTuples.filter(function predicate$$2(tupledArg) {
      if (lowContains(tupledArg[1].Text, incorrectAnswer$$1)) {
        return lowContains(tupledArg[1].Text, correctAnswer$$1);
      } else {
        return false;
      }
    });
    void tags$$1.push(new Tag(3, "ElasticDocumentsContainBothKeys", fd.length));
    filteredDocuments = fd;
  } else {
    filteredDocuments = docTuples;
  }

  let retainedDocIndices;
  retainedDocIndices = (0, _Array.map)(function mapping$$2(tuple$$2) {
    return tuple$$2[0];
  }, filteredDocuments, Int32Array);
  let finalElasticDocs;
  let arr;
  arr = (0, _Array.map)(function mapping$$3(tupledArg$$1) {
    return tupledArg$$1[1].Text;
  }, filteredDocuments, Array);
  finalElasticDocs = config$$1.MaxElasticDocs > arr.length ? arr : arr.slice(0, config$$1.MaxElasticDocs - 1 + 1);
  void tags$$1.push(new Tag(4, "ElasticDocumentsUsed", finalElasticDocs.length));
  return [new ElasticProcess(docs, retainedDocIndices, finalElasticDocs), tags$$1];
}

function getCoreferenceProcess(answer, correctAnswer$$2, incorrectAnswer$$2, config$$2) {
  return (0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
    const tags$$2 = [];
    return config$$2.UseAnswerCoreferenceFilter ? ((0, _AllenNLP.ResolveTextReferents)(answer)).then(function (_arg1$$2) {
      var arg0$$8;

      if (_arg1$$2.tag === 1) {
        return Promise.resolve(new _Option.Result(1, "Error", new _Fetch.FetchError(1, "DecodingFailed", _arg1$$2.fields[0])));
      } else {
        let sentenceTuples;
        let array$$16;
        array$$16 = (0, _Array.zip)(_arg1$$2.fields[0].resolvedSentences, _arg1$$2.fields[0].documentAnnotation.sentences);
        sentenceTuples = (0, _Array.mapIndexed)(function mapping$$4(i$$2, tupledArg$$2) {
          return [i$$2, tupledArg$$2[0], tupledArg$$2[1].sen];
        }, array$$16, Array);
        let candidateSentences;
        candidateSentences = (0, _Array.map)(function mapping$$5(tupledArg$$3) {
          return tupledArg$$3[2];
        }, sentenceTuples, Array);
        let filteredTuples;
        filteredTuples = sentenceTuples.filter(function predicate$$3(tupledArg$$4) {
          if (lowContains(tupledArg$$4[1], incorrectAnswer$$2)) {
            return true;
          } else {
            return lowContains(tupledArg$$4[1], correctAnswer$$2);
          }
        });
        let corefSentences;
        corefSentences = (0, _Array.map)(function mapping$$6(tupledArg$$5) {
          return tupledArg$$5[1];
        }, filteredTuples, Array);
        let answerSentences;
        answerSentences = (0, _Array.map)(function mapping$$7(tupledArg$$6) {
          return tupledArg$$6[2];
        }, filteredTuples, Array);
        let retainedSentenceIndices;
        retainedSentenceIndices = (0, _Array.map)(function mapping$$8(tupledArg$$7) {
          return tupledArg$$7[0];
        }, filteredTuples, Int32Array);
        void tags$$2.push(new Tag(5, "AnswerSentencesContainOneKey", answerSentences.length));
        void tags$$2.push(new Tag(6, "CoreferenceFilteredSentences", true));
        let finalAnswer;
        finalAnswer = (0, _String.join)(" ", answerSentences);
        return Promise.resolve(new _Option.Result(0, "Ok", [(arg0$$8 = new CoreferenceProcess(candidateSentences, corefSentences, retainedSentenceIndices, finalAnswer), (arg0$$8)), tags$$2]));
      }
    }) : Promise.resolve(new _Option.Result(0, "Ok", [undefined, tags$$2]));
  }));
}

function GetElaboratedFeedback(incorrectAnswer$$3, correctAnswer$$3, clozeSentence, configurationOption) {
  return (0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
    let config$$3;

    if (configurationOption == null) {
      config$$3 = Configuration$$$Default();
    } else {
      const c$$1 = configurationOption;
      config$$3 = c$$1;
    }

    const tags$$3 = [];
    return getDefinitionProcess(correctAnswer$$3, incorrectAnswer$$3, clozeSentence, config$$3).then(function (_arg1$$3) {
      if (_arg1$$3.tag === 1) {
        return Promise.resolve(new _Option.Result(1, "Error", _arg1$$3.fields[0]));
      } else {
        (0, _Array.addRangeInPlace)(_arg1$$3.fields[0][1], tags$$3);
        const question = config$$3.SyntheticQuestion === "differenceQuestion" ? "What is the difference between the " + incorrectAnswer$$3 + " and the " + correctAnswer$$3 + "?" : "What is the relationship between the " + incorrectAnswer$$3 + " and the " + correctAnswer$$3 + "?";
        void tags$$3.push(new Tag(7, "SyntheticQuestion", config$$3.SyntheticQuestion));
        return ((0, _LongformQA.getDocuments)(question)).then(function (_arg2$$1) {
          if (_arg2$$1.tag === 1) {
            return Promise.resolve(new _Option.Result(1, "Error", _arg2$$1.fields[0]));
          } else {
            const patternInput = getElasticProcess(_arg2$$1.fields[0], correctAnswer$$3, incorrectAnswer$$3, config$$3);
            (0, _Array.addRangeInPlace)(patternInput[1], tags$$3);
            let definitionContext$$2;

            if (_arg1$$3.fields[0][0] == null) {
              definitionContext$$2 = [];
            } else {
              const dp$$2 = _arg1$$3.fields[0][0];
              definitionContext$$2 = dp$$2.OutputContext;
            }

            let clozeContext;

            if (config$$3.UseCloze) {
              void tags$$3.push(new Tag(1, "ClozeUsed", true));
              clozeContext = [clozeSentence];
            } else {
              clozeContext = new Array(0);
            }

            const context = (0, _Array.concat)([definitionContext$$2, clozeContext, patternInput[0].OutputContext], Array);
            return (0, _LongformQA.getAnswerWithContext)(question, context).then(function (_arg3) {
              return _arg3.tag === 1 ? Promise.resolve(new _Option.Result(1, "Error", _arg3.fields[0])) : getCoreferenceProcess(_arg3.fields[0].answer, correctAnswer$$3, incorrectAnswer$$3, config$$3).then(function (_arg4) {
                if (_arg4.tag === 1) {
                  return Promise.resolve(new _Option.Result(1, "Error", _arg4.fields[0]));
                } else {
                  (0, _Array.addRangeInPlace)(_arg4.fields[0][1], tags$$3);
                  let finalAnswer$$1;

                  if (_arg4.fields[0][0] == null) {
                    finalAnswer$$1 = _arg3.fields[0].answer;
                  } else {
                    const cp = _arg4.fields[0][0];
                    finalAnswer$$1 = cp.OutputAnswer;
                  }

                  const elaboratedFeedback = new ElaboratedFeedback(finalAnswer$$1, incorrectAnswer$$3, correctAnswer$$3, config$$3.UseCloze ? (clozeSentence) : undefined, patternInput[0], _arg1$$3.fields[0][0], context, _arg4.fields[0][0], question, tags$$3.slice());
                  return Promise.resolve(new _Option.Result(0, "Ok", elaboratedFeedback));
                }
              });
            });
          }
        });
      }
    });
  }));
}

const HarnessElaboratedFeedbackRequest = (0, _Types.declare)(function ElaboratedFeedback_HarnessElaboratedFeedbackRequest(CorrectAnswer, IncorrectAnswer, ClozeSentence) {
  this.CorrectAnswer = CorrectAnswer;
  this.IncorrectAnswer = IncorrectAnswer;
  this.ClozeSentence = ClozeSentence;
}, _Types.Record);
exports.HarnessElaboratedFeedbackRequest = HarnessElaboratedFeedbackRequest;

function HarnessElaboratedFeedbackRequest$reflection() {
  return (0, _Reflection.record_type)("ElaboratedFeedback.HarnessElaboratedFeedbackRequest", [], HarnessElaboratedFeedbackRequest, () => [["CorrectAnswer", _Reflection.string_type], ["IncorrectAnswer", _Reflection.string_type], ["ClozeSentence", _Reflection.string_type]]);
}

function HarnessElaboratedFeedbackRequest$$$InitializeTest() {
  return new HarnessElaboratedFeedbackRequest("digestive tract", "digestive system", "Other organs that produce hormones include the pineal gland; the thymus; reproductive organs; and certain cells of the digestive tract, the heart, and the kidneys.");
}

function HarnessGetElaboratedFeedback(jsonRequest) {
  let request;
  request = (0, _Decode.Auto$$$unsafeFromString$$Z5CB6BD)(jsonRequest, undefined, undefined, {
    ResolveType() {
      return HarnessElaboratedFeedbackRequest$reflection();
    }

  });
  const config$$4 = undefined;
  return GetElaboratedFeedback(request.IncorrectAnswer, request.CorrectAnswer, request.ClozeSentence, config$$4);
}

function ElaboratedFeedbackCondition(row, condition) {
  let config$$5;

  switch (condition) {
    case "NoClozeGlossaryDefinitions":
      {
        const arg0$$11 = new Configuration(false, true, false, true, 3, true, "relationshipQuestion");
        config$$5 = arg0$$11;
        break;
      }

    case "Full011720":
      {
        const arg0$$12 = new Configuration(true, true, true, true, 3, true, "relationshipQuestion");
        config$$5 = arg0$$12;
        break;
      }

    case "Defi_Y__Cloz_Y__Keyf_Y__Corf_Y":
      {
        const arg0$$13 = new Configuration(true, true, true, true, 3, true, "relationshipQuestion");
        config$$5 = arg0$$13;
        break;
      }

    case "Defi_N__Cloz_Y__Keyf_Y__Corf_Y":
      {
        const arg0$$14 = new Configuration(true, false, false, true, 3, true, "relationshipQuestion");
        config$$5 = arg0$$14;
        break;
      }

    case "Defi_Y__Cloz_N__Keyf_Y__Corf_Y":
      {
        const arg0$$15 = new Configuration(false, true, true, true, 3, true, "relationshipQuestion");
        config$$5 = arg0$$15;
        break;
      }

    case "Defi_N__Cloz_N__Keyf_Y__Corf_Y":
      {
        const arg0$$16 = new Configuration(false, false, false, true, 3, true, "relationshipQuestion");
        config$$5 = arg0$$16;
        break;
      }

    case "Defi_Y__Cloz_Y__Keyf_N__Corf_Y":
      {
        const arg0$$17 = new Configuration(true, true, true, false, 3, true, "relationshipQuestion");
        config$$5 = arg0$$17;
        break;
      }

    case "Defi_N__Cloz_Y__Keyf_N__Corf_Y":
      {
        const arg0$$18 = new Configuration(true, false, false, false, 3, true, "relationshipQuestion");
        config$$5 = arg0$$18;
        break;
      }

    case "Defi_Y__Cloz_N__Keyf_N__Corf_Y":
      {
        const arg0$$19 = new Configuration(false, true, true, false, 3, true, "relationshipQuestion");
        config$$5 = arg0$$19;
        break;
      }

    case "Defi_N__Cloz_N__Keyf_N__Corf_Y":
      {
        const arg0$$20 = new Configuration(false, false, false, false, 3, true, "relationshipQuestion");
        config$$5 = arg0$$20;
        break;
      }

    case "Defi_Y__Cloz_Y__Keyf_Y__Corf_N":
      {
        const arg0$$21 = new Configuration(true, true, true, true, 3, false, "relationshipQuestion");
        config$$5 = arg0$$21;
        break;
      }

    case "Defi_N__Cloz_Y__Keyf_Y__Corf_N":
      {
        const arg0$$22 = new Configuration(true, false, false, true, 3, false, "relationshipQuestion");
        config$$5 = arg0$$22;
        break;
      }

    case "Defi_Y__Cloz_N__Keyf_Y__Corf_N":
      {
        const arg0$$23 = new Configuration(false, true, true, true, 3, false, "relationshipQuestion");
        config$$5 = arg0$$23;
        break;
      }

    case "Defi_N__Cloz_N__Keyf_Y__Corf_N":
      {
        const arg0$$24 = new Configuration(false, false, false, true, 3, false, "relationshipQuestion");
        config$$5 = arg0$$24;
        break;
      }

    case "Defi_Y__Cloz_Y__Keyf_N__Corf_N":
      {
        const arg0$$25 = new Configuration(true, true, true, false, 3, false, "relationshipQuestion");
        config$$5 = arg0$$25;
        break;
      }

    case "Defi_N__Cloz_Y__Keyf_N__Corf_N":
      {
        const arg0$$26 = new Configuration(true, false, false, false, 3, false, "relationshipQuestion");
        config$$5 = arg0$$26;
        break;
      }

    case "Defi_Y__Cloz_N__Keyf_N__Corf_N":
      {
        const arg0$$27 = new Configuration(false, true, true, false, 3, false, "relationshipQuestion");
        config$$5 = arg0$$27;
        break;
      }

    case "Defi_N__Cloz_N__Keyf_N__Corf_N":
      {
        const arg0$$28 = new Configuration(false, false, false, false, 3, false, "relationshipQuestion");
        config$$5 = arg0$$28;
        break;
      }

    default:
      {
        const arg0$$10 = new Configuration(false, false, false, true, 3, true, "relationshipQuestion");
        config$$5 = arg0$$10;
      }
  }

  const s$$7 = row.split("\t");
  return GetElaboratedFeedback(s$$7[0], s$$7[1], s$$7[2], config$$5);
}