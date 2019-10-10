"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Promisify = Promisify;
exports.Endpoints$reflection = Endpoints$reflection;
exports.SentenceAPI$reflection = SentenceAPI$reflection;
exports.ClozableAPI$reflection = ClozableAPI$reflection;
exports.ClozeAPI$reflection = ClozeAPI$reflection;
exports.SRLVerb$reflection = SRLVerb$reflection;
exports.SRLResult$reflection = SRLResult$reflection;
exports.DependencyParseResult$reflection = DependencyParseResult$reflection;
exports.CoreferenceResult$reflection = CoreferenceResult$reflection;
exports.SentenceCoreference$reflection = SentenceCoreference$reflection;
exports.SentenceAnnotation$reflection = SentenceAnnotation$reflection;
exports.DocumentAnnotation$reflection = DocumentAnnotation$reflection;
exports.Clozable$reflection = Clozable$reflection;
exports.Clozable$$$get_Decoder = Clozable$$$get_Decoder;
exports.InternalAPI$reflection = InternalAPI$reflection;
exports.SentenceRequest$reflection = SentenceRequest$reflection;
exports.DocumentRequest$reflection = DocumentRequest$reflection;
exports.TextRequest$reflection = TextRequest$reflection;
exports.PostAPI = PostAPI;
exports.GetCoreference = GetCoreference;
exports.GetSRL = GetSRL;
exports.GetDependencyParse = GetDependencyParse;
exports.GetSentences = GetSentences;
exports.GetForSentences = GetForSentences;
exports.RegexReplace = RegexReplace;
exports.Split = Split;
exports.CleanText = CleanText;
exports.GetAcronymMap = GetAcronymMap;
exports.GetNLP = GetNLP;
exports.EstimateDesiredSentences = EstimateDesiredSentences;
exports.EstimateDesiredItems = EstimateDesiredItems;
exports.GetTotalWeight = GetTotalWeight;
exports.GetModifiedNPClozable = GetModifiedNPClozable;
exports.GetClozable = GetClozable;
exports.GetInternalAPI = GetInternalAPI;
exports.RemoveOverlappingClozables = RemoveOverlappingClozables;
exports.MakeItem = MakeItem;
exports.GetClozeAPI = GetClozeAPI;
exports.DoSimpleComputation = DoSimpleComputation;
exports.badSentenceRegex = exports.endpoints = exports.TextRequest = exports.DocumentRequest = exports.SentenceRequest = exports.InternalAPI = exports.Clozable = exports.DocumentAnnotation = exports.SentenceAnnotation = exports.SentenceCoreference = exports.CoreferenceResult = exports.DependencyParseResult = exports.SRLResult = exports.SRLVerb = exports.ClozeAPI = exports.ClozableAPI = exports.SentenceAPI = exports.Endpoints = void 0;

var _PromiseImpl = require("./Fable.Promise.2.0.0/PromiseImpl");

var _Promise = require("./Fable.Promise.2.0.0/Promise");

var _Types = require("./fable-library.2.3.11/Types");

var _Reflection = require("./fable-library.2.3.11/Reflection");

var _Decode = require("./Thoth.Json.3.3.0/Decode");

var _Encode = require("./Thoth.Json.3.3.0/Encode");

var _Http = require("./Fable.SimpleHttp.2.4.0/Http");

var _Types2 = require("./Fable.SimpleHttp.2.4.0/Types");

var _AsyncBuilder = require("./fable-library.2.3.11/AsyncBuilder");

var _Async = require("./fable-library.2.3.11/Async");

var _Seq = require("./fable-library.2.3.11/Seq");

var _RegExp = require("./fable-library.2.3.11/RegExp");

var transliteration = _interopRequireWildcard(require("transliteration"));

var _Array = require("./fable-library.2.3.11/Array");

var _String = require("./fable-library.2.3.11/String");

var _Util = require("./fable-library.2.3.11/Util");

var _Map = require("./fable-library.2.3.11/Map");

var _WordFrequency = require("./WordFrequency");

var _List = require("./fable-library.2.3.11/List");

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : {}; if (desc.get || desc.set) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } } newObj.default = obj; return newObj; } }

function Promisify(input) {
  return (0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
    return Promise.resolve([1, input]);
  }));
}

const Endpoints = (0, _Types.declare)(function Process_Endpoints(arg1, arg2, arg3, arg4) {
  this.SRL = arg1;
  this.Coreference = arg2;
  this.DependencyParser = arg3;
  this.SentenceSplitter = arg4;
}, _Types.Record);
exports.Endpoints = Endpoints;

function Endpoints$reflection() {
  return (0, _Reflection.record)("Process.Endpoints", [], Endpoints, () => [["SRL", _Reflection.string], ["Coreference", _Reflection.string], ["DependencyParser", _Reflection.string], ["SentenceSplitter", _Reflection.string]]);
}

const SentenceAPI = (0, _Types.declare)(function Process_SentenceAPI(arg1, arg2, arg3) {
  this.sentence = arg1;
  this.itemId = arg2 | 0;
  this.hasCloze = arg3;
}, _Types.Record);
exports.SentenceAPI = SentenceAPI;

function SentenceAPI$reflection() {
  return (0, _Reflection.record)("Process.SentenceAPI", [], SentenceAPI, () => [["sentence", _Reflection.string], ["itemId", _Reflection.int32], ["hasCloze", _Reflection.bool]]);
}

const ClozableAPI = (0, _Types.declare)(function Process_ClozableAPI(arg1, arg2, arg3, arg4) {
  this.cloze = arg1;
  this.itemId = arg2 | 0;
  this.clozeId = arg3 | 0;
  this.correctResponse = arg4;
}, _Types.Record);
exports.ClozableAPI = ClozableAPI;

function ClozableAPI$reflection() {
  return (0, _Reflection.record)("Process.ClozableAPI", [], ClozableAPI, () => [["cloze", _Reflection.string], ["itemId", _Reflection.int32], ["clozeId", _Reflection.int32], ["correctResponse", _Reflection.string]]);
}

const ClozeAPI = (0, _Types.declare)(function Process_ClozeAPI(arg1, arg2) {
  this.sentences = arg1;
  this.clozes = arg2;
}, _Types.Record);
exports.ClozeAPI = ClozeAPI;

function ClozeAPI$reflection() {
  return (0, _Reflection.record)("Process.ClozeAPI", [], ClozeAPI, () => [["sentences", (0, _Reflection.array)(SentenceAPI$reflection())], ["clozes", (0, _Reflection.array)(ClozableAPI$reflection())]]);
}

const SRLVerb = (0, _Types.declare)(function Process_SRLVerb(arg1, arg2, arg3) {
  this.verb = arg1;
  this.description = arg2;
  this.tags = arg3;
}, _Types.Record);
exports.SRLVerb = SRLVerb;

function SRLVerb$reflection() {
  return (0, _Reflection.record)("Process.SRLVerb", [], SRLVerb, () => [["verb", _Reflection.string], ["description", _Reflection.string], ["tags", (0, _Reflection.array)(_Reflection.string)]]);
}

const SRLResult = (0, _Types.declare)(function Process_SRLResult(arg1, arg2) {
  this.words = arg1;
  this.verbs = arg2;
}, _Types.Record);
exports.SRLResult = SRLResult;

function SRLResult$reflection() {
  return (0, _Reflection.record)("Process.SRLResult", [], SRLResult, () => [["words", (0, _Reflection.array)(_Reflection.string)], ["verbs", (0, _Reflection.array)(SRLVerb$reflection())]]);
}

const DependencyParseResult = (0, _Types.declare)(function Process_DependencyParseResult(arg1, arg2, arg3, arg4, arg5, arg6, arg7) {
  this.arc_loss = arg1;
  this.loss = arg2;
  this.pos = arg3;
  this.predicted_dependencies = arg4;
  this.predicted_heads = arg5;
  this.tag_loss = arg6;
  this.words = arg7;
}, _Types.Record);
exports.DependencyParseResult = DependencyParseResult;

function DependencyParseResult$reflection() {
  return (0, _Reflection.record)("Process.DependencyParseResult", [], DependencyParseResult, () => [["arc_loss", _Reflection.float64], ["loss", _Reflection.float64], ["pos", (0, _Reflection.array)(_Reflection.string)], ["predicted_dependencies", (0, _Reflection.array)(_Reflection.string)], ["predicted_heads", (0, _Reflection.array)(_Reflection.int32)], ["tag_loss", _Reflection.float64], ["words", (0, _Reflection.array)(_Reflection.string)]]);
}

const CoreferenceResult = (0, _Types.declare)(function Process_CoreferenceResult(arg1, arg2, arg3, arg4) {
  this.clusters = arg1;
  this.document = arg2;
  this.predicted_antecedents = arg3;
  this.top_spans = arg4;
}, _Types.Record);
exports.CoreferenceResult = CoreferenceResult;

function CoreferenceResult$reflection() {
  return (0, _Reflection.record)("Process.CoreferenceResult", [], CoreferenceResult, () => [["clusters", (0, _Reflection.array)((0, _Reflection.array)((0, _Reflection.array)(_Reflection.int32)))], ["document", (0, _Reflection.array)(_Reflection.string)], ["predicted_antecedents", (0, _Reflection.array)(_Reflection.int32)], ["top_spans", (0, _Reflection.array)((0, _Reflection.array)(_Reflection.int32))]]);
}

const SentenceCoreference = (0, _Types.declare)(function Process_SentenceCoreference(arg1, arg2) {
  this.spans = arg1;
  this.clusters = arg2;
}, _Types.Record);
exports.SentenceCoreference = SentenceCoreference;

function SentenceCoreference$reflection() {
  return (0, _Reflection.record)("Process.SentenceCoreference", [], SentenceCoreference, () => [["spans", (0, _Reflection.array)((0, _Reflection.array)(_Reflection.int32))], ["clusters", (0, _Reflection.array)(_Reflection.int32)]]);
}

const SentenceAnnotation = (0, _Types.declare)(function Process_SentenceAnnotation(arg1, arg2, arg3, arg4, arg5) {
  this.id = arg1 | 0;
  this.sen = arg2;
  this.srl = arg3;
  this.dep = arg4;
  this.cor = arg5;
}, _Types.Record);
exports.SentenceAnnotation = SentenceAnnotation;

function SentenceAnnotation$reflection() {
  return (0, _Reflection.record)("Process.SentenceAnnotation", [], SentenceAnnotation, () => [["id", _Reflection.int32], ["sen", _Reflection.string], ["srl", SRLResult$reflection()], ["dep", DependencyParseResult$reflection()], ["cor", SentenceCoreference$reflection()]]);
}

const DocumentAnnotation = (0, _Types.declare)(function Process_DocumentAnnotation(arg1, arg2) {
  this.sentences = arg1;
  this.coreference = arg2;
}, _Types.Record);
exports.DocumentAnnotation = DocumentAnnotation;

function DocumentAnnotation$reflection() {
  return (0, _Reflection.record)("Process.DocumentAnnotation", [], DocumentAnnotation, () => [["sentences", (0, _Reflection.array)(SentenceAnnotation$reflection())], ["coreference", CoreferenceResult$reflection()]]);
}

const Clozable = (0, _Types.declare)(function Process_Clozable(arg1, arg2, arg3, arg4, arg5) {
  this.words = arg1;
  this.start = arg2 | 0;
  this.stop = arg3 | 0;
  this.trace = arg4;
  this.prob = arg5;
}, _Types.Record);
exports.Clozable = Clozable;

function Clozable$reflection() {
  return (0, _Reflection.record)("Process.Clozable", [], Clozable, () => [["words", (0, _Reflection.array)(_Reflection.string)], ["start", _Reflection.int32], ["stop", _Reflection.int32], ["trace", (0, _Reflection.array)(_Reflection.string)], ["prob", _Reflection.float64]]);
}

function Clozable$$$get_Decoder() {
  return function (path$$7) {
    return function (v) {
      return (0, _Decode.object)(function builder(get) {
        return new Clozable(get.Required.Field("words", function (path$$1, value$$1) {
          return (0, _Decode.array)(_Decode.string, path$$1, value$$1);
        }), get.Required.Field("start", _Decode.int$), get.Required.Field("stop", _Decode.int$), get.Required.Field("trace", function (path$$5, value$$5) {
          return (0, _Decode.array)(_Decode.string, path$$5, value$$5);
        }), get.Required.Field("prob", _Decode.float$));
      }, path$$7, v);
    };
  };
}

const InternalAPI = (0, _Types.declare)(function Process_InternalAPI(arg1, arg2, arg3) {
  this.sentences = arg1;
  this.coreference = arg2;
  this.clozables = arg3;
}, _Types.Record);
exports.InternalAPI = InternalAPI;

function InternalAPI$reflection() {
  return (0, _Reflection.record)("Process.InternalAPI", [], InternalAPI, () => [["sentences", (0, _Reflection.array)(SentenceAnnotation$reflection())], ["coreference", CoreferenceResult$reflection()], ["clozables", (0, _Reflection.array)((0, _Reflection.array)(Clozable$reflection()))]]);
}

const SentenceRequest = (0, _Types.declare)(function Process_SentenceRequest(arg1) {
  this.sentence = arg1;
}, _Types.Record);
exports.SentenceRequest = SentenceRequest;

function SentenceRequest$reflection() {
  return (0, _Reflection.record)("Process.SentenceRequest", [], SentenceRequest, () => [["sentence", _Reflection.string]]);
}

const DocumentRequest = (0, _Types.declare)(function Process_DocumentRequest(arg1) {
  this.document = arg1;
}, _Types.Record);
exports.DocumentRequest = DocumentRequest;

function DocumentRequest$reflection() {
  return (0, _Reflection.record)("Process.DocumentRequest", [], DocumentRequest, () => [["document", _Reflection.string]]);
}

const TextRequest = (0, _Types.declare)(function Process_TextRequest(arg1, arg2) {
  this.text = arg1;
  this.model = arg2;
}, _Types.Record);
exports.TextRequest = TextRequest;

function TextRequest$reflection() {
  return (0, _Reflection.record)("Process.TextRequest", [], TextRequest, () => [["text", _Reflection.string], ["model", _Reflection.string]]);
}

const endpoints = new Endpoints("http://141.225.12.235:8000/predict/semantic-role-labeling", "http://141.225.12.235:8000/predict/coreference-resolution", "http://141.225.12.235:8000/predict/dependency-parsing", "http://141.225.12.235:8001/sents");
exports.endpoints = endpoints;

function PostAPI(input$$1, endpoint) {
  return (0, _Async.startAsPromise)(_AsyncBuilder.singleton.Delay(function () {
    var requestData = (0, _Encode.Auto$$$toString$$59982D9A)(4, input$$1, null, null, {
      ResolveType() {
        return _Reflection.obj;
      }

    });
    console.log("!!!requestData:" + JSON.stringify(requestData));
    var test3 = ((0, _Http.Http$$$header)((0, _Http.Headers$$$contentType)("application/json"), (0, _Http.Http$$$content)(new _Types2.BodyContent(1, "Text", requestData), (0, _Http.Http$$$method)(new _Types2.HttpMethod(1, "POST"), (0, _Http.Http$$$request)(endpoint)))));
    console.log("test3!!!:" + JSON.stringify(test3));
    return _AsyncBuilder.singleton.Bind((0, _Http.Http$$$send)((0, _Http.Http$$$header)((0, _Http.Headers$$$contentType)("application/json"), (0, _Http.Http$$$content)(new _Types2.BodyContent(1, "Text", requestData), (0, _Http.Http$$$method)(new _Types2.HttpMethod(1, "POST"), (0, _Http.Http$$$request)(endpoint))))), function (_arg1) {
      const response = _arg1;
      console.log("!!!response:" + JSON.stringify(response));
      return _AsyncBuilder.singleton.Return([response.statusCode, response.responseText]);
    });
  }));
}

function GetCoreference(input$$2) {
  return PostAPI(new DocumentRequest(input$$2), endpoints.Coreference);
}

function GetSRL(input$$3) {
  return PostAPI(new SentenceRequest(input$$3), endpoints.SRL);
}

function GetDependencyParse(input$$4) {
  return PostAPI(new SentenceRequest(input$$4), endpoints.DependencyParser);
}

function GetSentences(input$$5) {
  var test2 = PostAPI(new TextRequest(input$$5, "en"), endpoints.SentenceSplitter);
  console.log("endpoints.sentencesplitter!!!:" + JSON.stringify(endpoints.SentenceSplitter));
  console.log("text request:" + JSON.stringify(new TextRequest(input$$5, "en")));

  console.log("test2!!!:" + JSON.stringify(test2));
  return test2;
}

function GetForSentences(service, sentences) {
  return Promise.all((0, _Seq.map)(function mapping(sentence) {
    return service(sentence).then(function a(tuple) {
      return tuple[1];
    });
  }, sentences));
}

function RegexReplace(pattern, replacement, input$$6) {
  return (0, _RegExp.replace)(input$$6, pattern, replacement);
}

function Split(pattern$$1, input$$7) {
  return input$$7.split(pattern$$1);
}

function CleanText(input$$8) {
  console.log("input$$8!!!:" + JSON.stringify(input$$8));
  var test = transliteration.transliterate(RegexReplace(" \\.$", ".", RegexReplace("\\s+", " ", RegexReplace("\\([^\\)]+\\)", "", RegexReplace("\\(note[^\\)]+\\)", "", RegexReplace("\\(see[^\\)]+\\)", "", RegexReplace("\\(fig[^\\)]+\\)", "", RegexReplace("Page[ 0-9]+", "", input$$8))))))));
  console.log("test!!!:" + JSON.stringify(test));
  return test;
}

function GetAcronymMap(input$$16) {
  const acronymRegex = (0, _RegExp.create)("\\(([A-Z]+)\\)");
  const matches = (0, _RegExp.matches)(acronymRegex, input$$16);
  const acronymMap = matches.length !== 0 ? (0, _Map.ofSeq)((0, _Seq.delay)(function () {
    return (0, _Seq.collect)(function (m) {
      const acronym = m[1] || "";
      const index = m.index | 0;
      const start = (index - 50 > 0 ? index - 50 : 0) | 0;
      const words = Split(" ", input$$16.substr(start, 50));
      const firstLetterString = (0, _Array.map)(function mapping$$1(w) {
        return w[0];
      }, words, Array).join("");
      const letterRegex = (0, _RegExp.create)(acronym);
      const lm = (0, _RegExp.match)(letterRegex, firstLetterString.toLocaleUpperCase());

      if (lm != null) {
        const phrase = (0, _String.join)(" ", ...words.slice(lm.index, acronym.length + 1));
        return (0, _Seq.append)((0, _Seq.singleton)([phrase, acronym]), (0, _Seq.delay)(function () {
          return (0, _Seq.singleton)([acronym, phrase]);
        }));
      } else {
        return (0, _Seq.empty)();
      }
    }, matches);
  }), {
    Compare: _Util.comparePrimitives
  }) : (0, _Map.empty)({
    Compare: _Util.comparePrimitives
  });
  return (0, _Encode.Auto$$$toString$$59982D9A)(4, acronymMap, null, null, {
    ResolveType() {
      return (0, _Reflection.type)("Microsoft.FSharp.Collections.FSharpMap`2", [_Reflection.string, _Reflection.string]);
    }

  });
}

function GetNLP(input$$18) {
  return (0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
    return GetSentences(CleanText(input$$18)).then(function a$$1($arg$$5) {
      console.log("$arg$$5!!!:" + JSON.stringify($arg$$5));
      return (0, _Decode.Auto$$$unsafeFromString$$Z33228D48)($arg$$5[1], null, null, {
        ResolveType() {
          return (0, _Reflection.array)(_Reflection.string);
        }

      });
    }).then(function (_arg1$$1) {
      const sentences$$1 = _arg1$$1;
      return GetCoreference((0, _String.join)(" ", ...sentences$$1)).then(function a$$2(tuple$$2) {
        return tuple$$2[1];
      }).then(function (_arg2) {
        const corJson = _arg2;
        const cor = (0, _Decode.Auto$$$unsafeFromString$$Z33228D48)(corJson, null, null, {
          ResolveType() {
            return CoreferenceResult$reflection();
          }

        });
        const tokenIdCorefMap = (0, _Map.ofSeq)((0, _Seq.collect)(function mapping$$4(x$$4) {
          return x$$4;
        }, (0, _Seq.mapIndexed)(function mapping$$3(i, c) {
          return (0, _Seq.map)(function mapping$$2(span) {
            return [span[0], [span, i]];
          }, c);
        }, cor.clusters)), {
          Compare: _Util.comparePrimitives
        });
        return GetForSentences(GetSRL, sentences$$1).then(function (_arg3) {
          const srlJsons = _arg3;
          return GetForSentences(GetDependencyParse, sentences$$1).then(function (_arg4) {
            const depJsons = _arg4;
            const sentenceAnnotations = (0, _Array.ofSeq)((0, _Seq.delay)(function () {
              let wordIndexOffset = 0;
              return (0, _Seq.collect)(function (i$$1) {
                const srl = (0, _Decode.Auto$$$unsafeFromString$$Z33228D48)(srlJsons[i$$1], null, null, {
                  ResolveType() {
                    return SRLResult$reflection();
                  }

                });
                const dep = (0, _Decode.Auto$$$unsafeFromString$$Z33228D48)(depJsons[i$$1], null, null, {
                  ResolveType() {
                    return DependencyParseResult$reflection();
                  }

                });
                const spans = [];
                const clusters = [];
                return (0, _Seq.append)((0, _Seq.collect)(function (j) {
                  const matchValue = (0, _Map.FSharpMap$$TryFind$$2B595)(tokenIdCorefMap, j + wordIndexOffset);

                  if (matchValue == null) {
                    return (0, _Seq.empty)();
                  } else {
                    const span$$1 = matchValue[0];
                    const clusterIndex = matchValue[1] | 0;
                    spans.push(new Int32Array([span$$1[0] - wordIndexOffset, span$$1[1] - wordIndexOffset]));
                    clusters.push(clusterIndex);
                    return (0, _Seq.empty)();
                  }
                }, (0, _Seq.rangeNumber)(0, 1, srl.words.length - 1)), (0, _Seq.delay)(function () {
                  wordIndexOffset = wordIndexOffset + srl.words.length;
                  return (0, _Seq.singleton)(new SentenceAnnotation(i$$1, sentences$$1[i$$1], srl, dep, new SentenceCoreference(spans.slice(), clusters.slice())));
                }));
              }, (0, _Seq.rangeNumber)(0, 1, sentences$$1.length - 1));
            }), Array);
            const documentAnnotation = new DocumentAnnotation(sentenceAnnotations, cor);
            return Promise.resolve([1, (0, _Encode.Auto$$$toString$$59982D9A)(4, documentAnnotation, null, null, {
              ResolveType() {
                return DocumentAnnotation$reflection();
              }

            })]);
          });
        });
      });
    });
  }));
}

function EstimateDesiredSentences(sentences$$4) {
  const wordCount = (0, _Seq.sumBy)(function projection(sentence$$1) {
    return sentence$$1.split(" ").length;
  }, sentences$$4, {
    GetZero() {
      return 0;
    },

    Add($x$$8, $y$$9) {
      return $x$$8 + $y$$9;
    }

  });
  const desiredSentences = ~~(wordCount / 1000 * 25) | 0;
  return desiredSentences | 0;
}

function EstimateDesiredItems(desiredSentences$$1) {
  const desiredItems = desiredSentences$$1 * 2 | 0;
  return desiredItems | 0;
}

function GetTotalWeight(da, sen) {
  return (0, _Array.sum)((0, _Array.collect)(function mapping$$6(id) {
    const cluster = da.coreference.clusters[id];
    return (0, _Array.map)(function mapping$$5(c$$1) {
      return c$$1.length;
    }, cluster, Int32Array);
  }, sen.cor.clusters, Int32Array), {
    GetZero() {
      return 0;
    },

    Add($x$$10, $y$$11) {
      return $x$$10 + $y$$11;
    }

  });
}

function GetModifiedNPClozable(sen$$1, startInit, stopInit, head, traceInit) {
  const trace = [];
  (0, _Array.addRangeInPlace)(traceInit, trace);

  if (startInit < 0 ? true : stopInit >= sen$$1.srl.words.length) {
    trace.push("CRITICAL: invalid clozable parameters for " + (0, _Encode.Auto$$$toString$$59982D9A)(4, sen$$1, null, null, {
      ResolveType() {
        return SentenceAnnotation$reflection();
      }

    }));
    return new Clozable(new Array(0), 0, 0, trace.slice(), 1);
  } else {
    let h$$3;

    if (head == null) {
      const stanfordHead = (0, _Seq.find)(function predicate(tupledArg) {
        if (tupledArg[1] < startInit + 1) {
          return true;
        } else {
          return tupledArg[1] > stopInit + 1;
        }
      }, (0, _Seq.map)(function mapping$$7(i$$2) {
        return [i$$2, sen$$1.dep.predicted_heads[i$$2]];
      }, (0, _Array.ofSeq)((0, _Seq.rangeNumber)(startInit, 1, stopInit), Int32Array)))[0] | 0;

      if (!(sen$$1.dep.pos[stanfordHead].indexOf("NN") === 0)) {
        trace.push("head is not nominal");
        const argOption = (0, _Seq.tryFind)(function predicate$$1(tupledArg$$1) {
          if (tupledArg$$1[1].indexOf("subj") >= 0) {
            return true;
          } else {
            return tupledArg$$1[1].indexOf("obj") >= 0;
          }
        }, (0, _Seq.map)(function mapping$$8(i$$3) {
          return [i$$3, sen$$1.dep.predicted_dependencies[i$$3]];
        }, (0, _Array.ofSeq)((0, _Seq.rangeNumber)(startInit, 1, stopInit), Int32Array)));
        const nnOption = (0, _Seq.tryFind)(function predicate$$2(tupledArg$$2) {
          return tupledArg$$2[1].indexOf("NN") === 0;
        }, (0, _Seq.reverse)((0, _Seq.map)(function mapping$$9(i$$4) {
          return [i$$4, sen$$1.dep.pos[i$$4]];
        }, (0, _Array.ofSeq)((0, _Seq.rangeNumber)(startInit, 1, stopInit), Int32Array))));
        const matchValue$$1 = [argOption, nnOption];

        if (matchValue$$1[0] != null) {
          const arg = matchValue$$1[0];
          trace.push("WARNING: using first syntactic arg as pseudohead");
          h$$3 = arg[0];
        } else if (matchValue$$1[1] != null) {
          const nn = matchValue$$1[1];
          trace.push("WARNING: using last nominal as pseudohead");
          h$$3 = nn[0];
        } else {
          trace.push("CRITICAL: clozable without nominal or arg, defaulting to given span");
          h$$3 = stopInit;
        }
      } else {
        h$$3 = stanfordHead;
      }
    } else {
      const x$$9 = head | 0;
      h$$3 = x$$9;
    }

    const indices = (0, _Array.reverse)((0, _Array.takeWhile)(function predicate$$3(i$$5) {
      if (sen$$1.dep.pos[i$$5].indexOf("N") === 0) {
        return true;
      } else {
        return sen$$1.dep.pos[i$$5] === "JJ";
      }
    }, (0, _Array.reverse)((0, _Array.ofSeq)((0, _Seq.rangeNumber)(startInit, 1, h$$3), Int32Array), Int32Array), Int32Array), Int32Array);
    let patternInput;

    if (indices.length !== 0) {
      const start$$1 = indices[0] | 0;
      const stop = (0, _Array.last)(indices) | 0;
      patternInput = [start$$1, stop, sen$$1.srl.words.slice(start$$1, stop + 1)];
    } else {
      trace.push("CRITICAL: stanford head yields empty span, defaulting to given span");
      patternInput = [startInit, stopInit, sen$$1.srl.words.slice(startInit, stopInit + 1)];
    }

    const clozable = new Clozable(patternInput[2], patternInput[0], patternInput[1], trace.slice(), (0, _Array.min)((0, _Array.map)(_WordFrequency.Get, patternInput[2], Float64Array), {
      Compare: _Util.comparePrimitives
    }));
    return clozable;
  }
}

function GetClozable(sen$$2) {
  const clozable$$1 = [];
  (0, _Array.addRangeInPlace)((0, _Seq.map)(function mapping$$10(si) {
    return GetModifiedNPClozable(sen$$2, si[0], si[1], null, ["coref"]);
  }, sen$$2.cor.spans), clozable$$1);
  (0, _Array.addRangeInPlace)((0, _Seq.map)(function mapping$$12(tupledArg$$5) {
    return GetModifiedNPClozable(sen$$2, tupledArg$$5[0], tupledArg$$5[0], tupledArg$$5[0], ["dep", tupledArg$$5[1]]);
  }, (0, _Seq.filter)(function predicate$$5(tupledArg$$4) {
    return sen$$2.dep.pos[tupledArg$$4[0]].indexOf("N") === 0;
  }, (0, _Seq.filter)(function predicate$$4(tupledArg$$3) {
    if (tupledArg$$3[1].indexOf("obj") >= 0 ? true : tupledArg$$3[1].indexOf("subj") >= 0) {
      return true;
    } else {
      return tupledArg$$3[1].indexOf("root") >= 0;
    }
  }, (0, _Seq.mapIndexed)(function mapping$$11(i$$6, x$$10) {
    return [i$$6, x$$10];
  }, sen$$2.dep.predicted_dependencies)))), clozable$$1);
  (0, _Array.addRangeInPlace)((0, _Seq.collect)(function mapping$$15(pred) {
    return (0, _Seq.map)(function mapping$$14(tupledArg$$8) {
      const start$$3 = (0, _Seq.minBy)(function projection$$2(tuple$$6) {
        return tuple$$6[0];
      }, tupledArg$$8[1], {
        Compare: _Util.comparePrimitives
      })[0] | 0;
      const stop$$2 = (0, _Seq.maxBy)(function projection$$3(tuple$$8) {
        return tuple$$8[0];
      }, tupledArg$$8[1], {
        Compare: _Util.comparePrimitives
      })[0] | 0;
      return GetModifiedNPClozable(sen$$2, start$$3, stop$$2, null, ["srl", pred.description]);
    }, (0, _Map.groupBy)(function projection$$1(tupledArg$$7) {
      return tupledArg$$7[1].substr(2);
    }, (0, _Seq.filter)(function predicate$$6(tupledArg$$6) {
      return tupledArg$$6[1].indexOf("ARG") >= 0;
    }, (0, _Seq.mapIndexed)(function mapping$$13(i$$10, t) {
      return [i$$10, t];
    }, pred.tags)), {
      Compare: _Util.comparePrimitives
    }));
  }, sen$$2.srl.verbs), clozable$$1);
  return clozable$$1;
}

const badSentenceRegex = (0, _RegExp.create)("(figure|table|section|clinical|application)\\s+[0-9]", 1);
exports.badSentenceRegex = badSentenceRegex;

function GetInternalAPI(nlpJsonOption, input$$24) {
  return (0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
    var nlpJson;
    return (nlpJsonOption == null ? GetNLP(input$$24).then(function a$$4(tuple$$11) {
      return tuple$$11[1];
    }) : (nlpJson = nlpJsonOption, Promisify(nlpJson).then(function a$$3(tuple$$10) {
      return tuple$$10[1];
    }))).then(function (_arg1$$4) {
      const nlp = _arg1$$4;
      const da$$1 = (0, _Decode.Auto$$$unsafeFromString$$Z33228D48)(nlp, null, null, {
        ResolveType() {
          return DocumentAnnotation$reflection();
        }

      });
      const clozables = (0, _Array.map)(function mapping$$16(ra) {
        return ra.slice();
      }, (0, _Array.map)(GetClozable, da$$1.sentences, Array), Array);
      return Promise.resolve([1, (0, _Encode.Auto$$$toString$$59982D9A)(4, new InternalAPI(da$$1.sentences, da$$1.coreference, clozables), null, null, {
        ResolveType() {
          return InternalAPI$reflection();
        }

      })]);
    });
  }));
}

function RemoveOverlappingClozables(clozables$$1) {
  const clozablesOut = Array.from(clozables$$1);

  for (let ci = 0; ci <= clozables$$1.length - 1; ci++) {
    for (let cj = ci; cj <= clozables$$1.length - 1; cj++) {
      const overlap = (ci !== cj ? clozables$$1[ci].start <= clozables$$1[cj].stop : false) ? clozables$$1[cj].start <= clozables$$1[ci].stop : false;

      if (overlap ? clozables$$1[ci].stop - clozables$$1[ci].start >= clozables$$1[cj].stop - clozables$$1[cj].start : false) {
        (0, _Array.removeInPlace)(clozables$$1[cj], clozablesOut), null;
      } else if (overlap) {
        (0, _Array.removeInPlace)(clozables$$1[ci], clozablesOut), null;
      }
    }
  }

  return clozablesOut.slice();
}

function MakeItem(sa, cl) {
  const itemWords = (0, _Array.copy)(sa.srl.words, Array);

  for (let i$$11 = cl.start; i$$11 <= cl.stop; i$$11++) {
    itemWords[i$$11] = "__________";
  }

  return [(0, _String.join)(" ", ...itemWords), (0, _String.join)(" ", ...cl.words)];
}

function GetClozeAPI(nlpOption, sentenceCountOption, itemCountOption, input$$27) {
  console.log("!!!nlpOPtion:" + JSON.stringify(nlpOption)+",sentenceCountOption:" + JSON.stringify(sentenceCountOption) +",itemCountOption:" + JSON.stringify(itemCountOption)+"input:" + JSON.stringify(input$$27));
  return (0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
    return GetInternalAPI(nlpOption, input$$27).then(function a$$5(tuple$$12) {
      return tuple$$12[1];
    }).then(function (_arg1$$5) {
      const internalAPIJson = _arg1$$5;
      console.log("internalAPIJson!!!:" + JSON.stringify(internalAPIJson));
      const internalAPI = (0, _Decode.Auto$$$unsafeFromString$$Z33228D48)(internalAPIJson, null, null, {
        ResolveType() {
          return InternalAPI$reflection();
        }

      });
      let sentenceCount$$1;

      if (sentenceCountOption == null) {
        sentenceCount$$1 = EstimateDesiredSentences((0, _Array.map)(function mapping$$17(x$$13) {
          return x$$13.sen;
        }, internalAPI.sentences, Array));
      } else {
        const sentenceCount = sentenceCountOption | 0;
        sentenceCount$$1 = sentenceCount;
      }

      let itemCount$$1;

      if (itemCountOption == null) {
        itemCount$$1 = EstimateDesiredItems(sentenceCount$$1);
      } else {
        const itemCount = itemCountOption | 0;
        itemCount$$1 = itemCount;
      }

      const patternInput$$1 = (0, _List.partition)(function predicate$$11(tupledArg$$13) {
        const chainsLengthTwoOrMore = (0, _Array.map)(function mapping$$21(id$$1) {
          return internalAPI.coreference.clusters[id$$1];
        }, tupledArg$$13[0].cor.clusters, Array).filter(function predicate$$10(c$$2) {
          return c$$2.length > 1;
        });
        return chainsLengthTwoOrMore.length > 2;
      }, (0, _Array.toList)((0, _Array.map)(function mapping$$20(tupledArg$$11) {
        return [tupledArg$$11[0], tupledArg$$11[1].filter(function predicate$$8(cl$$2) {
          return cl$$2.words.length < 4;
        })];
      }, (0, _Array.map)(function mapping$$19(tupledArg$$10) {
        return [tupledArg$$10[0], RemoveOverlappingClozables(tupledArg$$10[1])];
      }, (0, _Array.mapIndexed)(function mapping$$18(i$$12, s) {
        return [s, internalAPI.clozables[i$$12]];
      }, internalAPI.sentences, Array).filter(function predicate$$7(tupledArg$$9) {
        return !(0, _RegExp.isMatch)(badSentenceRegex, tupledArg$$9[0].sen);
      }), Array), Array).filter(function predicate$$9(tupledArg$$12) {
        return tupledArg$$12[1].length > 0;
      })));
      let clozeTuples;
      const hardFilterSentenceCount = (0, _List.length)(patternInput$$1[0]) | 0;
      clozeTuples = hardFilterSentenceCount > sentenceCount$$1 ? (0, _List.sortBy)(function projection$$5(tupledArg$$15) {
        return tupledArg$$15[0].id;
      }, (0, _List.take)(sentenceCount$$1, (0, _List.sortByDescending)(function projection$$4(tupledArg$$14) {
        return GetTotalWeight(internalAPI, tupledArg$$14[0]);
      }, patternInput$$1[0], {
        Compare: _Util.comparePrimitives
      })), {
        Compare: _Util.comparePrimitives
      }) : (0, _List.sortBy)(function projection$$7(tupledArg$$17) {
        return tupledArg$$17[0].id;
      }, (0, _List.append)(patternInput$$1[0], (0, _List.take)(sentenceCount$$1 - (0, _List.length)(patternInput$$1[0]), (0, _List.sortByDescending)(function projection$$6(tupledArg$$16) {
        return GetTotalWeight(internalAPI, tupledArg$$16[0]);
      }, patternInput$$1[1], {
        Compare: _Util.comparePrimitives
      }))), {
        Compare: _Util.comparePrimitives
      });
      const clozeProbTuples = (0, _List.map)(function mapping$$22(tupledArg$$18) {
        const sorted = (0, _Array.toList)((0, _Array.sortBy)(function projection$$8(cl$$4) {
          return cl$$4.prob;
        }, tupledArg$$18[1], {
          Compare: _Util.comparePrimitives
        }));
        return [tupledArg$$18[0], (0, _List.head)(sorted), (0, _List.tail)(sorted)];
      }, clozeTuples);
      const restClozableMap = (0, _Map.ofList)((0, _List.groupBy)(function projection$$10(tuple$$13) {
        return tuple$$13[0];
      }, (0, _List.take)(itemCount$$1 - sentenceCount$$1, (0, _List.sortBy)(function projection$$9(tupledArg$$20) {
        return tupledArg$$20[1].prob;
      }, (0, _List.collect)(function mapping$$24(tupledArg$$19) {
        return (0, _List.map)(function mapping$$23(c$$3) {
          return [tupledArg$$19[0], c$$3];
        }, tupledArg$$19[2]);
      }, clozeProbTuples), {
        Compare: _Util.comparePrimitives
      })), {
        Equals: _Util.equals,
        GetHashCode: _Util.structuralHash
      }), {
        Compare($x$$34, $y$$35) {
          return $x$$34.CompareTo($y$$35);
        }

      });
      const allClozableMap = (0, _Map.ofList)((0, _List.map)(function mapping$$26(tupledArg$$21) {
        let cl$$6;
        const matchValue$$2 = (0, _Map.FSharpMap$$TryFind$$2B595)(restClozableMap, tupledArg$$21[0]);

        if (matchValue$$2 == null) {
          cl$$6 = new _Types.List();
        } else {
          const t$$3 = matchValue$$2;
          cl$$6 = (0, _List.map)(function mapping$$25(tuple$$14) {
            return tuple$$14[1];
          }, t$$3);
        }

        return [tupledArg$$21[0], new _Types.List(tupledArg$$21[1], cl$$6)];
      }, clozeProbTuples), {
        Compare($x$$36, $y$$37) {
          return $x$$36.CompareTo($y$$37);
        }

      });
      const acronymMap$$1 = (0, _Decode.Auto$$$unsafeFromString$$Z33228D48)(GetAcronymMap(input$$27), null, null, {
        ResolveType() {
          return (0, _Reflection.type)("Microsoft.FSharp.Collections.FSharpMap`2", [_Reflection.string, _Reflection.string]);
        }

      });
      const sentences$$6 = [];
      const clozes = [];
      (0, _Seq.iterate)(function action$$1(sa$$10) {
        const matchValue$$3 = (0, _Map.FSharpMap$$TryFind$$2B595)(allClozableMap, sa$$10);

        if (matchValue$$3 != null) {
          const clozables$$3 = matchValue$$3;
          sentences$$6.push(new SentenceAPI(sa$$10.sen, (0, _Util.structuralHash)(sa$$10), true));
          (0, _Seq.iterate)(function action(cl$$7) {
            const patternInput$$2 = MakeItem(sa$$10, cl$$7);
            let correctResponses;
            const matchValue$$4 = (0, _Map.FSharpMap$$TryFind$$2B595)(acronymMap$$1, patternInput$$2[1]);

            if (matchValue$$4 == null) {
              correctResponses = patternInput$$2[1];
            } else {
              const acronym$$1 = matchValue$$4;
              correctResponses = patternInput$$2[1] + "|" + acronym$$1;
            }

            clozes.push(new ClozableAPI(patternInput$$2[0], (0, _Util.structuralHash)(sa$$10), (0, _Util.structuralHash)(clozables$$3), correctResponses));
          }, clozables$$3);
        } else {
          sentences$$6.push(new SentenceAPI(sa$$10.sen, (0, _Util.structuralHash)(sa$$10), false));
        }
      }, internalAPI.sentences);
      return Promise.resolve([1, (0, _Encode.Auto$$$toString$$59982D9A)(4, new ClozeAPI(sentences$$6.slice(), clozes.slice()), null, null, {
        ResolveType() {
          return ClozeAPI$reflection();
        }

      })]);
    });
  }));
}

function DoSimpleComputation(input$$30) {
  return (0, _String.join)("", ...(0, _Seq.reverse)(input$$30.split("")));
}
