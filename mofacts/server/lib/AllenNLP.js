"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Promisify = Promisify;
exports.Endpoints$reflection = Endpoints$reflection;
exports.SRLVerb$reflection = SRLVerb$reflection;
exports.SRL$reflection = SRL$reflection;
exports.DependencyParse$reflection = DependencyParse$reflection;
exports.Coreference$reflection = Coreference$reflection;
exports.SentenceCoreference$reflection = SentenceCoreference$reflection;
exports.SentenceAnnotation$reflection = SentenceAnnotation$reflection;
exports.DocumentAnnotation$reflection = DocumentAnnotation$reflection;
exports.DocumentAnnotation$$$CreateEmpty = DocumentAnnotation$$$CreateEmpty;
exports.Entailment$reflection = Entailment$reflection;
exports.Entailment$$$CreateEmpty = Entailment$$$CreateEmpty;
exports.SentenceRequest$reflection = SentenceRequest$reflection;
exports.DocumentRequest$reflection = DocumentRequest$reflection;
exports.TextRequest$reflection = TextRequest$reflection;
exports.EntailmentRequest$reflection = EntailmentRequest$reflection;
exports.GetCoreference = GetCoreference;
exports.GetSRL = GetSRL;
exports.GetDependencyParse = GetDependencyParse;
exports.GetSentences = GetSentences;
exports.GetForSentences = GetForSentences;
exports.GetTextualEntailment = GetTextualEntailment;
exports.RegexReplace = RegexReplace;
exports.Split = Split;
exports.CleanText = CleanText;
exports.GetNLP = GetNLP;
exports.removePrePunctuationSpaces = removePrePunctuationSpaces;
exports.collapseDependencies = collapseDependencies;
exports.getDependentIndices = getDependentIndices;
exports.srlArgToIndexMap = srlArgToIndexMap;
exports.srlArgToIndexMapWithCollapsedReferents = srlArgToIndexMapWithCollapsedReferents;
exports.getSubjectIndex = getSubjectIndex;
exports.getBeRootIndex = getBeRootIndex;
exports.getInvertAuxIndex = getInvertAuxIndex;
exports.getPredicateIndex = getPredicateIndex;
exports.getObjectIndices = getObjectIndices;
exports.getRootOfSpan = getRootOfSpan;
exports.resolveReferents = resolveReferents;
exports.ResolveTextReferents = ResolveTextReferents;
exports.prePunctuationSpaceRegex = exports.endpoints = exports.EntailmentRequest = exports.TextRequest = exports.DocumentRequest = exports.SentenceRequest = exports.Entailment = exports.DocumentAnnotation = exports.SentenceAnnotation = exports.SentenceCoreference = exports.Coreference = exports.DependencyParse = exports.SRL = exports.SRLVerb = exports.Endpoints = void 0;

require("isomorphic-fetch");

var _Option = require("./fable-library.2.10.2/Option");

var _PromiseImpl = require("./Fable.Promise.2.1.0/PromiseImpl");

var _Promise = require("./Fable.Promise.2.1.0/Promise");

var _Types = require("./fable-library.2.10.2/Types");

var _Reflection = require("./fable-library.2.10.2/Reflection");

var _Types2 = require("./Thoth.Json.4.0.0/Types");

var _Util = require("./fable-library.2.10.2/Util");

var _Fetch = require("./Thoth.Fetch.2.0.0/Fetch");

var _Seq = require("./fable-library.2.10.2/Seq");

var _RegExp = require("./fable-library.2.10.2/RegExp");

var transliteration = _interopRequireWildcard(require("transliteration"));

var _Decode = require("./Thoth.Json.4.0.0/Decode");

var _Array = require("./fable-library.2.10.2/Array");

var _String = require("./fable-library.2.10.2/String");

var _Map = require("./fable-library.2.10.2/Map");

var _DependencyCollapser = require("./DependencyCollapser");

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function () { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function Promisify(input) {
  return (0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
    return Promise.resolve(new _Option.Result(0, "Ok", input));
  }));
}

const Endpoints = (0, _Types.declare)(function AllenNLP_Endpoints(SRL, Coreference, DependencyParser, SentenceSplitter, TextualEntailment) {
  this.SRL = SRL;
  this.Coreference = Coreference;
  this.DependencyParser = DependencyParser;
  this.SentenceSplitter = SentenceSplitter;
  this.TextualEntailment = TextualEntailment;
}, _Types.Record);
exports.Endpoints = Endpoints;

function Endpoints$reflection() {
  return (0, _Reflection.record_type)("AllenNLP.Endpoints", [], Endpoints, () => [["SRL", _Reflection.string_type], ["Coreference", _Reflection.string_type], ["DependencyParser", _Reflection.string_type], ["SentenceSplitter", _Reflection.string_type], ["TextualEntailment", _Reflection.string_type]]);
}

const SRLVerb = (0, _Types.declare)(function AllenNLP_SRLVerb(verb, description, tags) {
  this.verb = verb;
  this.description = description;
  this.tags = tags;
}, _Types.Record);
exports.SRLVerb = SRLVerb;

function SRLVerb$reflection() {
  return (0, _Reflection.record_type)("AllenNLP.SRLVerb", [], SRLVerb, () => [["verb", _Reflection.string_type], ["description", _Reflection.string_type], ["tags", (0, _Reflection.array_type)(_Reflection.string_type)]]);
}

const SRL = (0, _Types.declare)(function AllenNLP_SRL(words, verbs) {
  this.words = words;
  this.verbs = verbs;
}, _Types.Record);
exports.SRL = SRL;

function SRL$reflection() {
  return (0, _Reflection.record_type)("AllenNLP.SRL", [], SRL, () => [["words", (0, _Reflection.array_type)(_Reflection.string_type)], ["verbs", (0, _Reflection.array_type)(SRLVerb$reflection())]]);
}

const DependencyParse = (0, _Types.declare)(function AllenNLP_DependencyParse(arc_loss, loss, pos, predicted_dependencies, predicted_heads, tag_loss, words) {
  this.arc_loss = arc_loss;
  this.loss = loss;
  this.pos = pos;
  this.predicted_dependencies = predicted_dependencies;
  this.predicted_heads = predicted_heads;
  this.tag_loss = tag_loss;
  this.words = words;
}, _Types.Record);
exports.DependencyParse = DependencyParse;

function DependencyParse$reflection() {
  return (0, _Reflection.record_type)("AllenNLP.DependencyParse", [], DependencyParse, () => [["arc_loss", _Reflection.float64_type], ["loss", _Reflection.float64_type], ["pos", (0, _Reflection.array_type)(_Reflection.string_type)], ["predicted_dependencies", (0, _Reflection.array_type)(_Reflection.string_type)], ["predicted_heads", (0, _Reflection.array_type)(_Reflection.int32_type)], ["tag_loss", _Reflection.float64_type], ["words", (0, _Reflection.array_type)(_Reflection.string_type)]]);
}

const Coreference = (0, _Types.declare)(function AllenNLP_Coreference(clusters, document$, predicted_antecedents, top_spans) {
  this.clusters = clusters;
  this.document = document$;
  this.predicted_antecedents = predicted_antecedents;
  this.top_spans = top_spans;
}, _Types.Record);
exports.Coreference = Coreference;

function Coreference$reflection() {
  return (0, _Reflection.record_type)("AllenNLP.Coreference", [], Coreference, () => [["clusters", (0, _Reflection.array_type)((0, _Reflection.array_type)((0, _Reflection.array_type)(_Reflection.int32_type)))], ["document", (0, _Reflection.array_type)(_Reflection.string_type)], ["predicted_antecedents", (0, _Reflection.array_type)(_Reflection.int32_type)], ["top_spans", (0, _Reflection.array_type)((0, _Reflection.array_type)(_Reflection.int32_type))]]);
}

const SentenceCoreference = (0, _Types.declare)(function AllenNLP_SentenceCoreference(offset, spans, clusters) {
  this.offset = offset | 0;
  this.spans = spans;
  this.clusters = clusters;
}, _Types.Record);
exports.SentenceCoreference = SentenceCoreference;

function SentenceCoreference$reflection() {
  return (0, _Reflection.record_type)("AllenNLP.SentenceCoreference", [], SentenceCoreference, () => [["offset", _Reflection.int32_type], ["spans", (0, _Reflection.array_type)((0, _Reflection.array_type)(_Reflection.int32_type))], ["clusters", (0, _Reflection.array_type)(_Reflection.int32_type)]]);
}

const SentenceAnnotation = (0, _Types.declare)(function AllenNLP_SentenceAnnotation(id, tags, sen, srl, dep, cor) {
  this.id = id | 0;
  this.tags = tags;
  this.sen = sen;
  this.srl = srl;
  this.dep = dep;
  this.cor = cor;
}, _Types.Record);
exports.SentenceAnnotation = SentenceAnnotation;

function SentenceAnnotation$reflection() {
  return (0, _Reflection.record_type)("AllenNLP.SentenceAnnotation", [], SentenceAnnotation, () => [["id", _Reflection.int32_type], ["tags", (0, _Reflection.array_type)(_Reflection.string_type)], ["sen", _Reflection.string_type], ["srl", SRL$reflection()], ["dep", DependencyParse$reflection()], ["cor", SentenceCoreference$reflection()]]);
}

const DocumentAnnotation = (0, _Types.declare)(function AllenNLP_DocumentAnnotation(sentences, coreference) {
  this.sentences = sentences;
  this.coreference = coreference;
}, _Types.Record);
exports.DocumentAnnotation = DocumentAnnotation;

function DocumentAnnotation$reflection() {
  return (0, _Reflection.record_type)("AllenNLP.DocumentAnnotation", [], DocumentAnnotation, () => [["sentences", (0, _Reflection.array_type)(SentenceAnnotation$reflection())], ["coreference", Coreference$reflection()]]);
}

function DocumentAnnotation$$$CreateEmpty() {
  return new DocumentAnnotation([], null);
}

const Entailment = (0, _Types.declare)(function AllenNLP_Entailment(h2p_attention, hypothesis_tokens, label_logits, label_probs, p2h_attention, premise_tokens) {
  this.h2p_attention = h2p_attention;
  this.hypothesis_tokens = hypothesis_tokens;
  this.label_logits = label_logits;
  this.label_probs = label_probs;
  this.p2h_attention = p2h_attention;
  this.premise_tokens = premise_tokens;
}, _Types.Record);
exports.Entailment = Entailment;

function Entailment$reflection() {
  return (0, _Reflection.record_type)("AllenNLP.Entailment", [], Entailment, () => [["h2p_attention", (0, _Reflection.array_type)((0, _Reflection.array_type)(_Reflection.float64_type))], ["hypothesis_tokens", (0, _Reflection.array_type)(_Reflection.string_type)], ["label_logits", (0, _Reflection.array_type)(_Reflection.float64_type)], ["label_probs", (0, _Reflection.array_type)(_Reflection.float64_type)], ["p2h_attention", (0, _Reflection.array_type)((0, _Reflection.array_type)(_Reflection.float64_type))], ["premise_tokens", (0, _Reflection.array_type)(_Reflection.string_type)]]);
}

function Entailment$$$CreateEmpty() {
  return new Entailment([], [], new Float64Array([]), new Float64Array([]), [], []);
}

const SentenceRequest = (0, _Types.declare)(function AllenNLP_SentenceRequest(sentence) {
  this.sentence = sentence;
}, _Types.Record);
exports.SentenceRequest = SentenceRequest;

function SentenceRequest$reflection() {
  return (0, _Reflection.record_type)("AllenNLP.SentenceRequest", [], SentenceRequest, () => [["sentence", _Reflection.string_type]]);
}

const DocumentRequest = (0, _Types.declare)(function AllenNLP_DocumentRequest(document$) {
  this.document = document$;
}, _Types.Record);
exports.DocumentRequest = DocumentRequest;

function DocumentRequest$reflection() {
  return (0, _Reflection.record_type)("AllenNLP.DocumentRequest", [], DocumentRequest, () => [["document", _Reflection.string_type]]);
}

const TextRequest = (0, _Types.declare)(function AllenNLP_TextRequest(text, model) {
  this.text = text;
  this.model = model;
}, _Types.Record);
exports.TextRequest = TextRequest;

function TextRequest$reflection() {
  return (0, _Reflection.record_type)("AllenNLP.TextRequest", [], TextRequest, () => [["text", _Reflection.string_type], ["model", _Reflection.string_type]]);
}

const EntailmentRequest = (0, _Types.declare)(function AllenNLP_EntailmentRequest(hypothesis, premise) {
  this.hypothesis = hypothesis;
  this.premise = premise;
}, _Types.Record);
exports.EntailmentRequest = EntailmentRequest;

function EntailmentRequest$reflection() {
  return (0, _Reflection.record_type)("AllenNLP.EntailmentRequest", [], EntailmentRequest, () => [["hypothesis", _Reflection.string_type], ["premise", _Reflection.string_type]]);
}

const endpoints = new Endpoints("https://allennlp.olney.ai/predict/semantic-role-labeling", "https://allennlp.olney.ai/predict/coreference-resolution", "https://allennlp.olney.ai/predict/dependency-parsing", "https://spacy.olney.ai/sents", "https://allennlp.olney.ai/predict/textual-entailment");
exports.endpoints = endpoints;

function GetCoreference(input$$1) {
  return (0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
    return (0, _Fetch.Fetch$$$tryPost$$5760677E)(endpoints.Coreference, new DocumentRequest(input$$1), undefined, undefined, new _Types2.CaseStrategy(2, "SnakeCase"), undefined, (0, _Util.uncurry)(2, undefined), {
      ResolveType() {
        return Coreference$reflection();
      }

    }, {
      ResolveType() {
        return DocumentRequest$reflection();
      }

    });
  }));
}

function GetSRL(input$$2) {
  return (0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
    return (0, _Fetch.Fetch$$$tryPost$$5760677E)(endpoints.SRL, new SentenceRequest(input$$2), undefined, undefined, new _Types2.CaseStrategy(2, "SnakeCase"), undefined, (0, _Util.uncurry)(2, undefined), {
      ResolveType() {
        return SRL$reflection();
      }

    }, {
      ResolveType() {
        return SentenceRequest$reflection();
      }

    });
  }));
}

function GetDependencyParse(input$$3) {
  return (0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
    return (0, _Fetch.Fetch$$$tryPost$$5760677E)(endpoints.DependencyParser, new SentenceRequest(input$$3), undefined, undefined, new _Types2.CaseStrategy(2, "SnakeCase"), undefined, (0, _Util.uncurry)(2, undefined), {
      ResolveType() {
        return DependencyParse$reflection();
      }

    }, {
      ResolveType() {
        return SentenceRequest$reflection();
      }

    });
  }));
}

function GetSentences(input$$4) {
  return (0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
    return (0, _Fetch.Fetch$$$tryPost$$5760677E)(endpoints.SentenceSplitter, new TextRequest(input$$4, "en"), undefined, undefined, new _Types2.CaseStrategy(2, "SnakeCase"), undefined, (0, _Util.uncurry)(2, undefined), {
      ResolveType() {
        return (0, _Reflection.array_type)(_Reflection.string_type);
      }

    }, {
      ResolveType() {
        return TextRequest$reflection();
      }

    });
  }));
}

function GetForSentences(service, sentences) {
  let pr;
  pr = (0, _Seq.map)(function mapping(sentence) {
    return service(sentence);
  }, sentences);
  return Promise.all(pr);
}

function GetTextualEntailment(premise, hypothesis) {
  return (0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
    return (0, _Fetch.Fetch$$$tryPost$$5760677E)(endpoints.TextualEntailment, new EntailmentRequest(hypothesis, premise), undefined, undefined, new _Types2.CaseStrategy(2, "SnakeCase"), undefined, (0, _Util.uncurry)(2, undefined), {
      ResolveType() {
        return Entailment$reflection();
      }

    }, {
      ResolveType() {
        return EntailmentRequest$reflection();
      }

    });
  }));
}

function RegexReplace(pattern, replacement, input$$5) {
  return (0, _RegExp.replace)(input$$5, pattern, replacement);
}

function Split(pattern$$1, input$$6) {
  return input$$6.split(pattern$$1);
}

function CleanText(input$$7) {
  let arg00;
  let input$$16;
  let input$$15;
  let input$$14;
  let input$$13;
  let input$$12;
  let input$$11;
  let input$$10;
  let input$$9;
  input$$9 = RegexReplace("Page[ 0-9]+", "", input$$7);
  input$$10 = RegexReplace("\\(fig[^\\)]+\\)", "", input$$9);
  input$$11 = RegexReplace("\\(see[^\\)]+\\)", "", input$$10);
  input$$12 = RegexReplace("\\(note[^\\)]+\\)", "", input$$11);
  input$$13 = RegexReplace("\\([^\\)]+\\)", "", input$$12);
  input$$14 = RegexReplace("\\[[^\\]]+\\]", "", input$$13);
  input$$15 = RegexReplace("\\{[^\\}]+\\}", "", input$$14);
  input$$16 = RegexReplace("\\s+", " ", input$$15);
  arg00 = RegexReplace(" \\.$", ".", input$$16);
  return transliteration.transliterate(arg00);
}

function GetNLP(stringArrayJsonOption, inputText) {
  return (0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
    var pr$$1;
    let chunks;

    if (stringArrayJsonOption == null) {
      chunks = [inputText];
    } else {
      const chunksJson = stringArrayJsonOption;
      chunks = (0, _Decode.Auto$$$unsafeFromString$$Z5CB6BD)(chunksJson, undefined, undefined, {
        ResolveType() {
          return (0, _Reflection.array_type)(_Reflection.string_type);
        }

      });
    }

    return (pr$$1 = ((0, _Array.map)(function mapping$$1(chunk) {
      let input$$18;
      input$$18 = CleanText(chunk);
      return GetSentences(input$$18);
    }, chunks, Array)), (Promise.all(pr$$1))).then(function (_arg1) {
      var input$$19;

      const allOK = function allOK(resultsArr) {
        return resultsArr.every(function predicate(r) {
          if (r.tag === 1) {
            return false;
          } else {
            return true;
          }
        });
      };

      const resultsToType = function resultsToType(resultsArr$$1) {
        return (0, _Array.choose)(function chooser(r$$2) {
          if (r$$2.tag === 1) {
            return undefined;
          } else {
            return (0, _Option.some)(r$$2.fields[0]);
          }
        }, resultsArr$$1, Array);
      };

      const resultsToError = function resultsToError(resultsArr$$2) {
        return (0, _Array.choose)(function chooser$$1(r$$4) {
          if (r$$4.tag === 1) {
            return (0, _Option.some)(r$$4.fields[0]);
          } else {
            return undefined;
          }
        }, resultsArr$$2, Array);
      };

      if (allOK(_arg1)) {
        let patternInput;
        let array$$7;
        let array$$6;
        const array$$5 = resultsToType(_arg1);
        array$$6 = (0, _Array.mapIndexed)(function mapping$$3(i, chunk$$1) {
          return (0, _Array.map)(function mapping$$2(sen) {
            return [["orderGroup:" + (0, _Util.int32ToString)(i)], sen];
          }, chunk$$1, Array);
        }, array$$5, Array);
        array$$7 = (0, _Array.collect)(function mapping$$4(x) {
          return x;
        }, array$$6, Array);
        patternInput = (0, _Array.unzip)(array$$7);
        return (input$$19 = ((0, _String.join)(" ", patternInput[1])), (GetCoreference(input$$19))).then(function (_arg2) {
          return (GetForSentences(GetSRL, patternInput[1])).then(function (_arg3) {
            return (GetForSentences(GetDependencyParse, patternInput[1])).then(function (_arg4) {
              var array$$10, array$$9, mapping$$8, clo1, array$$12, array$$11, mapping$$9, clo1$$1, array$$14, array$$13, mapping$$10, clo1$$2;

              if ((allOK([_arg2]) ? allOK(_arg3) : false) ? allOK(_arg4) : false) {
                let cor;
                const array$$8 = resultsToType([_arg2]);
                cor = (0, _Array.head)(array$$8);
                const srls = resultsToType(_arg3);
                const deps = resultsToType(_arg4);
                let tokenIdCorefMap;
                let elements;
                let source$$3;
                source$$3 = (0, _Seq.mapIndexed)(function mapping$$6(i$$1, c) {
                  return (0, _Seq.map)(function mapping$$5(span) {
                    return [span[0], [span, i$$1]];
                  }, c);
                }, cor.clusters);
                elements = (0, _Seq.collect)(function mapping$$7(x$$1) {
                  return x$$1;
                }, source$$3);
                tokenIdCorefMap = (0, _Map.ofSeq)(elements, {
                  Compare: _Util.comparePrimitives
                });
                let sentenceAnnotations;
                const source$$4 = (0, _Seq.delay)(function () {
                  let wordIndexOffset = 0;
                  return (0, _Seq.collect)(function (i$$2) {
                    const srl = srls[i$$2];
                    const dep = deps[i$$2];
                    const spans = [];
                    const clusters = [];
                    return (0, _Seq.append)((0, _Seq.collect)(function (j) {
                      const matchValue = (0, _Map.FSharpMap$$TryFind$$2B595)(tokenIdCorefMap, j + wordIndexOffset);

                      if (matchValue == null) {
                        void null;
                        return (0, _Seq.empty)();
                      } else {
                        const span$$1 = matchValue[0];
                        const clusterIndex = matchValue[1] | 0;
                        void spans.push(new Int32Array([span$$1[0] - wordIndexOffset, span$$1[1] - wordIndexOffset]));
                        void clusters.push(clusterIndex);
                        return (0, _Seq.empty)();
                      }
                    }, (0, _Seq.rangeNumber)(0, 1, srl.words.length - 1)), (0, _Seq.delay)(function () {
                      return (0, _Seq.append)((0, _Seq.singleton)(new SentenceAnnotation(i$$2, patternInput[0][i$$2], patternInput[1][i$$2], srl, dep, new SentenceCoreference(wordIndexOffset, spans.slice(), clusters.slice()))), (0, _Seq.delay)(function () {
                        wordIndexOffset = wordIndexOffset + srl.words.length;
                        return (0, _Seq.empty)();
                      }));
                    }));
                  }, (0, _Seq.rangeNumber)(0, 1, patternInput[1].length - 1));
                });
                sentenceAnnotations = (0, _Array.ofSeq)(source$$4, Array);
                const documentAnnotation = new DocumentAnnotation(sentenceAnnotations, cor);
                return Promise.resolve(new _Option.Result(0, "Ok", documentAnnotation));
              } else {
                const errorPayload = [];
                (0, _Array.addRangeInPlace)((array$$10 = (array$$9 = resultsToError([_arg2]), (mapping$$8 = (clo1 = (0, _String.toText)((0, _String.printf)("coreference error: %A")), function (arg10) {
                  return clo1(arg10);
                }), (0, _Array.map)(mapping$$8, array$$9, Array))), ((0, _Array.distinct)(array$$10, {
                  Equals($x$$3, $y$$4) {
                    return $x$$3 === $y$$4;
                  },

                  GetHashCode: _Util.structuralHash
                }))), errorPayload);
                (0, _Array.addRangeInPlace)((array$$12 = (array$$11 = resultsToError(_arg3), (mapping$$9 = (clo1$$1 = (0, _String.toText)((0, _String.printf)("srl error: %A")), function (arg10$$1) {
                  return clo1$$1(arg10$$1);
                }), (0, _Array.map)(mapping$$9, array$$11, Array))), ((0, _Array.distinct)(array$$12, {
                  Equals($x$$5, $y$$6) {
                    return $x$$5 === $y$$6;
                  },

                  GetHashCode: _Util.structuralHash
                }))), errorPayload);
                (0, _Array.addRangeInPlace)((array$$14 = (array$$13 = resultsToError(_arg4), (mapping$$10 = (clo1$$2 = (0, _String.toText)((0, _String.printf)("dependency parse error: %A")), function (arg10$$2) {
                  return clo1$$2(arg10$$2);
                }), (0, _Array.map)(mapping$$10, array$$13, Array))), ((0, _Array.distinct)(array$$14, {
                  Equals($x$$7, $y$$8) {
                    return $x$$7 === $y$$8;
                  },

                  GetHashCode: _Util.structuralHash
                }))), errorPayload);
                return Promise.resolve(new _Option.Result(1, "Error", ((0, _String.join)("\n", errorPayload))));
              }
            });
          });
        });
      } else {
        let errorPayload$$1;
        let array$$16;
        const array$$15 = resultsToError(_arg1);
        let mapping$$11;
        const clo1$$3 = (0, _String.toText)((0, _String.printf)("sentence split error: %A"));

        mapping$$11 = function (arg10$$3) {
          return clo1$$3(arg10$$3);
        };

        array$$16 = (0, _Array.map)(mapping$$11, array$$15, Array);
        errorPayload$$1 = (0, _Array.distinct)(array$$16, {
          Equals($x$$9, $y$$10) {
            return $x$$9 === $y$$10;
          },

          GetHashCode: _Util.structuralHash
        });
        return Promise.resolve(new _Option.Result(1, "Error", ((0, _String.join)("\n", errorPayload$$1))));
      }
    });
  }));
}

const prePunctuationSpaceRegex = (0, _RegExp.create)(" ([^\\w\\s]+)");
exports.prePunctuationSpaceRegex = prePunctuationSpaceRegex;

function removePrePunctuationSpaces(input$$22) {
  return (0, _RegExp.replace)(prePunctuationSpaceRegex, input$$22, "$1");
}

function collapseDependencies(sa) {
  let ruleTokens;
  let array$$18;
  array$$18 = (0, _Array.mapIndexed)(function mapping$$12(i$$3, w) {
    return (0, _DependencyCollapser.Rules$002EToken$$$Create$$Z2BAB6A85)(i$$3, w, sa.dep.pos[i$$3], sa.dep.predicted_dependencies[i$$3], sa.dep.predicted_heads[i$$3]);
  }, sa.dep.words, Array);
  ruleTokens = (0, _Array.toList)(array$$18);
  const patternInput$$1 = (0, _DependencyCollapser.Collapser$$$CollapseTokens)(ruleTokens);
  return patternInput$$1[1];
}

function getDependentIndices(start, sa$$1) {
  var value, i$$7;
  const dependents = [];

  for (let i$$4 = 0; i$$4 <= sa$$1.dep.predicted_heads.length - 1; i$$4++) {
    let hbar = sa$$1.dep.predicted_heads[i$$4] - 1 | 0;

    while (hbar !== start ? hbar !== -1 : false) {
      hbar = sa$$1.dep.predicted_heads[hbar] - 1;
    }

    if (hbar === start ? true : i$$4 === start) {
      void dependents.push(i$$4);
    } else {
      void null;
    }
  }

  if (sa$$1.dep.predicted_heads[start] === 0 ? (value = sa$$1.dep.pos[start].indexOf("VB") === 0, (!value)) : false) {
    let copulaIndex;
    let source$$6;
    source$$6 = (0, _Seq.mapIndexed)(function mapping$$13(i$$5, d) {
      return [i$$5, d];
    }, dependents);
    copulaIndex = (0, _Seq.tryFindIndex)(function predicate$$1(tupledArg) {
      return sa$$1.dep.predicted_dependencies[tupledArg[0]] === "cop";
    }, source$$6);
    var $target$$71;

    if (copulaIndex != null) {
      if (i$$7 = copulaIndex | 0, i$$7 < dependents.length - 1) {
        $target$$71 = 0;
      } else {
        $target$$71 = 1;
      }
    } else {
      $target$$71 = 1;
    }

    switch ($target$$71) {
      case 0:
        {
          let source$$8;
          source$$8 = (0, _Seq.skip)(1, dependents);
          return (0, _Array.ofSeq)(source$$8, Int32Array);
        }

      case 1:
        {
          return new Int32Array(0);
        }
    }
  } else {
    return dependents.slice();
  }
}

function srlArgToIndexMap(srlTags) {
  let elements$$1;
  let array$$20;
  array$$20 = (0, _Array.mapIndexed)(function mapping$$14(i$$9, t) {
    return [(0, _String.substring)(t, t.indexOf("-") + 1), i$$9];
  }, srlTags, Array);
  elements$$1 = (0, _Array.groupBy)(function projection(tuple) {
    return tuple[0];
  }, array$$20, Array, {
    Equals($x$$11, $y$$12) {
      return $x$$11 === $y$$12;
    },

    GetHashCode: _Util.structuralHash
  });
  return (0, _Map.ofArray)(elements$$1, {
    Compare: _Util.comparePrimitives
  });
}

function srlArgToIndexMapWithCollapsedReferents(srlTags$$1) {
  let elements$$2;
  let array$$22;
  array$$22 = (0, _Array.mapIndexed)(function mapping$$15(i$$10, t$$1) {
    return [(0, _String.substring)(t$$1, t$$1.lastIndexOf("-") + 1), i$$10];
  }, srlTags$$1, Array);
  elements$$2 = (0, _Array.groupBy)(function projection$$1(tuple$$1) {
    return tuple$$1[0];
  }, array$$22, Array, {
    Equals($x$$15, $y$$16) {
      return $x$$15 === $y$$16;
    },

    GetHashCode: _Util.structuralHash
  });
  return (0, _Map.ofArray)(elements$$2, {
    Compare: _Util.comparePrimitives
  });
}

function getSubjectIndex(sa$$2) {
  let rootIndex;
  rootIndex = sa$$2.dep.predicted_heads.findIndex(function predicate$$2(h) {
    return h === 0;
  });
  const array$$24 = sa$$2.dep.predicted_dependencies.slice(0, rootIndex + 1);
  return (0, _Array.tryFindIndexBack)(function predicate$$3(h$$1) {
    return h$$1.indexOf("nsubj") === 0;
  }, array$$24);
}

function getBeRootIndex(sa$$3) {
  let rootIndex$$1;
  rootIndex$$1 = sa$$3.dep.predicted_heads.findIndex(function predicate$$4(h$$2) {
    return h$$2 === 0;
  });
  return (0, _Array.tryFindIndex)(function predicate$$5(h$$3) {
    if (h$$3 === rootIndex$$1) {
      return sa$$3.dep.predicted_dependencies[h$$3] === "cop";
    } else {
      return false;
    }
  }, sa$$3.dep.predicted_heads);
}

function getInvertAuxIndex(sa$$4) {
  let rootIndex$$2;
  rootIndex$$2 = sa$$4.dep.predicted_heads.findIndex(function predicate$$6(h$$4) {
    return h$$4 === 0;
  });
  return (0, _Array.tryFindIndex)(function predicate$$7(h$$5) {
    if (h$$5 === rootIndex$$2) {
      return sa$$4.dep.predicted_dependencies[h$$5] === "aux";
    } else {
      return false;
    }
  }, sa$$4.dep.predicted_heads);
}

function getPredicateIndex(sa$$5) {
  let rootIndex$$3;
  rootIndex$$3 = sa$$5.dep.predicted_heads.findIndex(function predicate$$8(h$$6) {
    return h$$6 === 0;
  });

  if (sa$$5.dep.pos[rootIndex$$3].indexOf("VB") === 0) {
    let array$$31;
    array$$31 = (0, _Array.mapIndexed)(function mapping$$16(i$$11, h$$7) {
      return [i$$11, h$$7 - 1];
    }, sa$$5.dep.predicted_heads, Array);
    return (0, _Array.tryFindIndex)(function predicate$$9(tupledArg$$1) {
      if (tupledArg$$1[1] === rootIndex$$3) {
        return tupledArg$$1[0] > rootIndex$$3;
      } else {
        return false;
      }
    }, array$$31);
  } else {
    return rootIndex$$3;
  }
}

function getObjectIndices(sa$$6) {
  let rootIndex$$4;
  rootIndex$$4 = sa$$6.dep.predicted_heads.findIndex(function predicate$$10(h$$9) {
    return h$$9 === 0;
  });

  if (sa$$6.dep.pos[rootIndex$$4].indexOf("VB") === 0) {
    let array$$35;
    let array$$34;
    array$$34 = (0, _Array.mapIndexed)(function mapping$$17(i$$13, h$$10) {
      return [i$$13, h$$10 - 1];
    }, sa$$6.dep.predicted_heads, Array);
    array$$35 = array$$34.filter(function predicate$$11(tupledArg$$2) {
      if (sa$$6.dep.predicted_dependencies[tupledArg$$2[0]] === "dobj") {
        return true;
      } else {
        return sa$$6.dep.predicted_dependencies[tupledArg$$2[0]] === "iobj";
      }
    });
    return (0, _Array.map)(function mapping$$18(tupledArg$$3) {
      return tupledArg$$3[0];
    }, array$$35, Array);
  } else {
    return new Array(0);
  }
}

function getRootOfSpan(start$$1, stop, sa$$7) {
  let spanHeads;
  const array$$36 = sa$$7.dep.predicted_heads.slice(start$$1, stop + 1);
  spanHeads = (0, _Array.map)(function mapping$$19(h$$13) {
    return h$$13 - 1;
  }, array$$36, Int32Array);
  let spanHeadIndex;
  spanHeadIndex = spanHeads.findIndex(function predicate$$12(h$$14) {
    if (h$$14 < start$$1) {
      return true;
    } else {
      return h$$14 > stop;
    }
  });
  return start$$1 + spanHeadIndex | 0;
}

function resolveReferents(da) {
  let clusterSentenceMap;
  let elements$$3;
  let array$$41;
  let array$$40;
  array$$40 = (0, _Array.mapIndexed)(function mapping$$21(i$$16, s) {
    return (0, _Array.mapIndexed)(function mapping$$20(j$$1, c$$1) {
      return [c$$1, i$$16, j$$1];
    }, s.cor.clusters, Array);
  }, da.sentences, Array);
  array$$41 = (0, _Array.collect)(function mapping$$22(x$$2) {
    return x$$2;
  }, array$$40, Array);
  elements$$3 = (0, _Array.groupBy)(function projection$$2(tupledArg$$4) {
    return tupledArg$$4[0];
  }, array$$41, Array, {
    Equals($x$$19, $y$$20) {
      return $x$$19 === $y$$20;
    },

    GetHashCode: _Util.structuralHash
  });
  clusterSentenceMap = (0, _Map.ofArray)(elements$$3, {
    Compare: _Util.comparePrimitives
  });
  const demonstrativeRegex = (0, _RegExp.create)("(this|that|these|those)", 1);

  const spanIsPronominal = function spanIsPronominal(sa$$8, span$$2) {
    if (sa$$8.dep.pos[span$$2[0]].indexOf("PRP") === 0) {
      return true;
    } else {
      return (0, _RegExp.isMatch)(demonstrativeRegex, sa$$8.dep.words[span$$2[0]]);
    }
  };

  let resolvedSentences;
  resolvedSentences = (0, _Array.map)(function mapping$$26(sa$$9) {
    let clusterReferents;
    clusterReferents = (0, _Array.map)(function mapping$$24(clusterId) {
      let nominalReferents;
      let array$$44;
      let array$$43;
      const array$$42 = (0, _Map.FSharpMap$$get_Item$$2B595)(clusterSentenceMap, clusterId);
      array$$43 = (0, _Array.map)(function mapping$$23(tupledArg$$5) {
        return [tupledArg$$5[1], tupledArg$$5[2]];
      }, array$$42, Array);
      array$$44 = (0, _Array.sortBy)(function projection$$3(tuple$$2) {
        return tuple$$2[0];
      }, array$$43, {
        Compare: _Util.comparePrimitives
      });
      nominalReferents = (0, _Array.choose)(function chooser$$2(tupledArg$$6) {
        var strings$$3;
        const span$$3 = da.sentences[tupledArg$$6[0]].cor.spans[tupledArg$$6[1]];

        if (spanIsPronominal(da.sentences[tupledArg$$6[0]], span$$3)) {
          return undefined;
        } else {
          return [tupledArg$$6[0], (strings$$3 = da.sentences[tupledArg$$6[0]].dep.words.slice(span$$3[0], span$$3[1] + 1), ((0, _String.join)(" ", strings$$3)))];
        }
      }, array$$44, Array);

      if (!(0, _Array.equalsWith)(_Util.compareArrays, nominalReferents, null) ? nominalReferents.length === 0 : false) {
        return undefined;
      } else {
        let matchValue$$1;
        let array$$46;
        array$$46 = (0, _Array.sortBy)(function projection$$4(tuple$$3) {
          return tuple$$3[0];
        }, nominalReferents, {
          Compare: _Util.comparePrimitives
        });
        matchValue$$1 = (0, _Array.tryFindBack)(function predicate$$13(tupledArg$$7) {
          return tupledArg$$7[0] < sa$$9.id;
        }, array$$46);

        if (matchValue$$1 != null) {
          const w$$2 = matchValue$$1[1];
          return w$$2;
        } else {
          return undefined;
        }
      }
    }, sa$$9.cor.clusters, Array);
    let indexedWords;
    indexedWords = (0, _Array.copy)(sa$$9.dep.words, Array);

    for (let i$$18 = 0; i$$18 <= sa$$9.cor.spans.length - 1; i$$18++) {
      let originalWords;
      const strings$$4 = sa$$9.dep.words.slice(sa$$9.cor.spans[i$$18][0], sa$$9.cor.spans[i$$18][1] + 1);
      originalWords = (0, _String.join)(" ", strings$$4);

      if (spanIsPronominal(sa$$9, sa$$9.cor.spans[i$$18]) ? clusterReferents[i$$18] != null : false) {
        indexedWords[sa$$9.cor.spans[i$$18][0]] = clusterReferents[i$$18];

        for (let j$$2 = sa$$9.cor.spans[i$$18][0] + 1; j$$2 <= sa$$9.cor.spans[i$$18][1]; j$$2++) {
          indexedWords[j$$2] = "";
        }
      } else {
        void null;
      }
    }

    let str;
    let input$$23;
    let strings$$5;
    strings$$5 = indexedWords.filter(function predicate$$14(w$$3) {
      return w$$3.length > 0;
    });
    input$$23 = (0, _String.join)(" ", strings$$5);
    str = removePrePunctuationSpaces(input$$23);
    return Array.from((0, _Seq.mapIndexed)(function mapping$$25(i$$19, c$$3) {
      if (i$$19 === 0) {
        return c$$3.toLocaleUpperCase();
      } else {
        return c$$3;
      }
    }, str.split(""))).join("");
  }, da.sentences, Array);
  return resolvedSentences;
}

function ResolveTextReferents(inputText$$1) {
  return (0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
    return GetNLP(undefined, inputText$$1).then(function (_arg1$$2) {
      if (_arg1$$2.tag === 1) {
        return Promise.resolve(new _Option.Result(1, "Error", _arg1$$2.fields[0]));
      } else {
        let resolvedSentences$$1;
        resolvedSentences$$1 = resolveReferents(_arg1$$2.fields[0]);
        return Promise.resolve(new _Option.Result(0, "Ok", (0, _Types.anonRecord)({
          documentAnnotation: _arg1$$2.fields[0],
          resolvedSentences: resolvedSentences$$1
        })));
      }
    });
  }));
}