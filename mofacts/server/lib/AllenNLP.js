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
exports.SentenceRequest$reflection = SentenceRequest$reflection;
exports.DocumentRequest$reflection = DocumentRequest$reflection;
exports.TextRequest$reflection = TextRequest$reflection;
exports.GetCoreference = GetCoreference;
exports.GetSRL = GetSRL;
exports.GetDependencyParse = GetDependencyParse;
exports.GetSentences = GetSentences;
exports.GetForSentences = GetForSentences;
exports.RegexReplace = RegexReplace;
exports.Split = Split;
exports.CleanText = CleanText;
exports.GetNLP = GetNLP;
exports.endpoints = exports.TextRequest = exports.DocumentRequest = exports.SentenceRequest = exports.DocumentAnnotation = exports.SentenceAnnotation = exports.SentenceCoreference = exports.Coreference = exports.DependencyParse = exports.SRL = exports.SRLVerb = exports.Endpoints = void 0;

require("isomorphic-fetch");

var _Option = require("./fable-library.2.8.4/Option");

var _PromiseImpl = require("./Fable.Promise.2.1.0/PromiseImpl");

var _Promise = require("./Fable.Promise.2.1.0/Promise");

var _Types = require("./fable-library.2.8.4/Types");

var _Reflection = require("./fable-library.2.8.4/Reflection");

var _Types2 = require("./Thoth.Json.4.0.0/Types");

var _Util = require("./fable-library.2.8.4/Util");

var _Fetch = require("./Thoth.Fetch.2.0.0/Fetch");

var _Seq = require("./fable-library.2.8.4/Seq");

var _RegExp = require("./fable-library.2.8.4/RegExp");

var transliteration = _interopRequireWildcard(require("transliteration"));

var _Decode = require("./Thoth.Json.4.0.0/Decode");

var _Array = require("./fable-library.2.8.4/Array");

var _String = require("./fable-library.2.8.4/String");

var _Map = require("./fable-library.2.8.4/Map");

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : {}; if (desc.get || desc.set) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } } newObj.default = obj; return newObj; } }

function Promisify(input) {
  return (0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
    return Promise.resolve(new _Option.Result(0, "Ok", input));
  }));
}

const Endpoints = (0, _Types.declare)(function AllenNLP_Endpoints(arg1, arg2, arg3, arg4) {
  this.SRL = arg1;
  this.Coreference = arg2;
  this.DependencyParser = arg3;
  this.SentenceSplitter = arg4;
}, _Types.Record);
exports.Endpoints = Endpoints;

function Endpoints$reflection() {
  return (0, _Reflection.record)("AllenNLP.Endpoints", [], Endpoints, () => [["SRL", _Reflection.string], ["Coreference", _Reflection.string], ["DependencyParser", _Reflection.string], ["SentenceSplitter", _Reflection.string]]);
}

const SRLVerb = (0, _Types.declare)(function AllenNLP_SRLVerb(arg1, arg2, arg3) {
  this.verb = arg1;
  this.description = arg2;
  this.tags = arg3;
}, _Types.Record);
exports.SRLVerb = SRLVerb;

function SRLVerb$reflection() {
  return (0, _Reflection.record)("AllenNLP.SRLVerb", [], SRLVerb, () => [["verb", _Reflection.string], ["description", _Reflection.string], ["tags", (0, _Reflection.array)(_Reflection.string)]]);
}

const SRL = (0, _Types.declare)(function AllenNLP_SRL(arg1, arg2) {
  this.words = arg1;
  this.verbs = arg2;
}, _Types.Record);
exports.SRL = SRL;

function SRL$reflection() {
  return (0, _Reflection.record)("AllenNLP.SRL", [], SRL, () => [["words", (0, _Reflection.array)(_Reflection.string)], ["verbs", (0, _Reflection.array)(SRLVerb$reflection())]]);
}

const DependencyParse = (0, _Types.declare)(function AllenNLP_DependencyParse(arg1, arg2, arg3, arg4, arg5, arg6, arg7) {
  this.arc_loss = arg1;
  this.loss = arg2;
  this.pos = arg3;
  this.predicted_dependencies = arg4;
  this.predicted_heads = arg5;
  this.tag_loss = arg6;
  this.words = arg7;
}, _Types.Record);
exports.DependencyParse = DependencyParse;

function DependencyParse$reflection() {
  return (0, _Reflection.record)("AllenNLP.DependencyParse", [], DependencyParse, () => [["arc_loss", _Reflection.float64], ["loss", _Reflection.float64], ["pos", (0, _Reflection.array)(_Reflection.string)], ["predicted_dependencies", (0, _Reflection.array)(_Reflection.string)], ["predicted_heads", (0, _Reflection.array)(_Reflection.int32)], ["tag_loss", _Reflection.float64], ["words", (0, _Reflection.array)(_Reflection.string)]]);
}

const Coreference = (0, _Types.declare)(function AllenNLP_Coreference(arg1, arg2, arg3, arg4) {
  this.clusters = arg1;
  this.document = arg2;
  this.predicted_antecedents = arg3;
  this.top_spans = arg4;
}, _Types.Record);
exports.Coreference = Coreference;

function Coreference$reflection() {
  return (0, _Reflection.record)("AllenNLP.Coreference", [], Coreference, () => [["clusters", (0, _Reflection.array)((0, _Reflection.array)((0, _Reflection.array)(_Reflection.int32)))], ["document", (0, _Reflection.array)(_Reflection.string)], ["predicted_antecedents", (0, _Reflection.array)(_Reflection.int32)], ["top_spans", (0, _Reflection.array)((0, _Reflection.array)(_Reflection.int32))]]);
}

const SentenceCoreference = (0, _Types.declare)(function AllenNLP_SentenceCoreference(arg1, arg2, arg3) {
  this.offset = arg1 | 0;
  this.spans = arg2;
  this.clusters = arg3;
}, _Types.Record);
exports.SentenceCoreference = SentenceCoreference;

function SentenceCoreference$reflection() {
  return (0, _Reflection.record)("AllenNLP.SentenceCoreference", [], SentenceCoreference, () => [["offset", _Reflection.int32], ["spans", (0, _Reflection.array)((0, _Reflection.array)(_Reflection.int32))], ["clusters", (0, _Reflection.array)(_Reflection.int32)]]);
}

const SentenceAnnotation = (0, _Types.declare)(function AllenNLP_SentenceAnnotation(arg1, arg2, arg3, arg4, arg5, arg6) {
  this.id = arg1 | 0;
  this.tags = arg2;
  this.sen = arg3;
  this.srl = arg4;
  this.dep = arg5;
  this.cor = arg6;
}, _Types.Record);
exports.SentenceAnnotation = SentenceAnnotation;

function SentenceAnnotation$reflection() {
  return (0, _Reflection.record)("AllenNLP.SentenceAnnotation", [], SentenceAnnotation, () => [["id", _Reflection.int32], ["tags", (0, _Reflection.array)(_Reflection.string)], ["sen", _Reflection.string], ["srl", SRL$reflection()], ["dep", DependencyParse$reflection()], ["cor", SentenceCoreference$reflection()]]);
}

const DocumentAnnotation = (0, _Types.declare)(function AllenNLP_DocumentAnnotation(arg1, arg2) {
  this.sentences = arg1;
  this.coreference = arg2;
}, _Types.Record);
exports.DocumentAnnotation = DocumentAnnotation;

function DocumentAnnotation$reflection() {
  return (0, _Reflection.record)("AllenNLP.DocumentAnnotation", [], DocumentAnnotation, () => [["sentences", (0, _Reflection.array)(SentenceAnnotation$reflection())], ["coreference", Coreference$reflection()]]);
}

const SentenceRequest = (0, _Types.declare)(function AllenNLP_SentenceRequest(arg1) {
  this.sentence = arg1;
}, _Types.Record);
exports.SentenceRequest = SentenceRequest;

function SentenceRequest$reflection() {
  return (0, _Reflection.record)("AllenNLP.SentenceRequest", [], SentenceRequest, () => [["sentence", _Reflection.string]]);
}

const DocumentRequest = (0, _Types.declare)(function AllenNLP_DocumentRequest(arg1) {
  this.document = arg1;
}, _Types.Record);
exports.DocumentRequest = DocumentRequest;

function DocumentRequest$reflection() {
  return (0, _Reflection.record)("AllenNLP.DocumentRequest", [], DocumentRequest, () => [["document", _Reflection.string]]);
}

const TextRequest = (0, _Types.declare)(function AllenNLP_TextRequest(arg1, arg2) {
  this.text = arg1;
  this.model = arg2;
}, _Types.Record);
exports.TextRequest = TextRequest;

function TextRequest$reflection() {
  return (0, _Reflection.record)("AllenNLP.TextRequest", [], TextRequest, () => [["text", _Reflection.string], ["model", _Reflection.string]]);
}

const endpoints = new Endpoints("https://allennlp.olney.ai/predict/semantic-role-labeling", "https://allennlp.olney.ai/predict/coreference-resolution", "https://allennlp.olney.ai/predict/dependency-parsing", "https://spacy.olney.ai/sents");
exports.endpoints = endpoints;

function GetCoreference(input$$1) {
  return (0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
    return (0, _Fetch.Fetch$$$tryPost$$5760677E)(endpoints.Coreference, new DocumentRequest(input$$1), null, null, new _Types2.CaseStrategy(2, "SnakeCase"), null, (0, _Util.uncurry)(2, null), {
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
    return (0, _Fetch.Fetch$$$tryPost$$5760677E)(endpoints.SRL, new SentenceRequest(input$$2), null, null, new _Types2.CaseStrategy(2, "SnakeCase"), null, (0, _Util.uncurry)(2, null), {
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
    return (0, _Fetch.Fetch$$$tryPost$$5760677E)(endpoints.DependencyParser, new SentenceRequest(input$$3), null, null, new _Types2.CaseStrategy(2, "SnakeCase"), null, (0, _Util.uncurry)(2, null), {
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
    return (0, _Fetch.Fetch$$$tryPost$$5760677E)(endpoints.SentenceSplitter, new TextRequest(input$$4, "en"), null, null, new _Types2.CaseStrategy(2, "SnakeCase"), null, (0, _Util.uncurry)(2, null), {
      ResolveType() {
        return (0, _Reflection.array)(_Reflection.string);
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

function RegexReplace(pattern, replacement, input$$5) {
  return (0, _RegExp.replace)(input$$5, pattern, replacement);
}

function Split(pattern$$1, input$$6) {
  return input$$6.split(pattern$$1);
}

function CleanText(input$$7) {
  let arg00;
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
  input$$14 = RegexReplace("\\s+", " ", input$$13);
  arg00 = RegexReplace(" \\.$", ".", input$$14);
  return transliteration.transliterate(arg00);
}

function GetNLP(chunksJsonOption, inputText) {
  return (0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
    var pr$$1;
    let chunks;

    if (chunksJsonOption == null) {
      chunks = [inputText];
    } else {
      const chunksJson = chunksJsonOption;
      chunks = (0, _Decode.Auto$$$unsafeFromString$$Z5CB6BD)(chunksJson, null, null, {
        ResolveType() {
          return (0, _Reflection.array)(_Reflection.string);
        }

      });
    }

    return (pr$$1 = ((0, _Array.map)(function mapping$$1(chunk) {
      let input$$16;
      input$$16 = CleanText(chunk);
      return GetSentences(input$$16);
    }, chunks, Array)), (Promise.all(pr$$1))).then(function (_arg1) {
      var input$$17;

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
            return null;
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
            return null;
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
            return [["OrderGroup:" + (0, _Util.int32ToString)(i)], sen];
          }, chunk$$1, Array);
        }, array$$5, Array);
        array$$7 = (0, _Array.collect)(function mapping$$4(x) {
          return x;
        }, array$$6, Array);
        patternInput = (0, _Array.unzip)(array$$7);
        return (input$$17 = ((0, _String.join)(" ", patternInput[1])), (GetCoreference(input$$17))).then(function (_arg2) {
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