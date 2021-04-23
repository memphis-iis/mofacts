"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.SentenceAPI$reflection = SentenceAPI$reflection;
exports.ClozableAPI$reflection = ClozableAPI$reflection;
exports.ClozeAPI$reflection = ClozeAPI$reflection;
exports.Tag$reflection = Tag$reflection;
exports.StringToTag = StringToTag;
exports.Clozable$reflection = Clozable$reflection;
exports.InternalAPI$reflection = InternalAPI$reflection;
exports.EstimateDesiredSentences = EstimateDesiredSentences;
exports.EstimateDesiredItems = EstimateDesiredItems;
exports.EstimateDesiredSentencesFromPercentage = EstimateDesiredSentencesFromPercentage;
exports.GetTotalWeight = GetTotalWeight;
exports.getFeatureDistanceFromRoot = getFeatureDistanceFromRoot;
exports.getFeatureDistanceFromStart = getFeatureDistanceFromStart;
exports.getFeatureCorefClusters = getFeatureCorefClusters;
exports.getFeatureCorefClusterTotalWeight = getFeatureCorefClusterTotalWeight;
exports.getFeatureCorefClusterBackwardWeight = getFeatureCorefClusterBackwardWeight;
exports.getFeatureCorefClusterForwardWeight = getFeatureCorefClusterForwardWeight;
exports.GetModifiedNPClozable = GetModifiedNPClozable;
exports.GetClozables = GetClozables;
exports.GetAllCloze = GetAllCloze;
exports.GetAllClozeLukeFormat20200714 = GetAllClozeLukeFormat20200714;
exports.GetAllClozeLukeFormat20201218 = GetAllClozeLukeFormat20201218;
exports.RemoveOverlappingClozables = RemoveOverlappingClozables;
exports.MakeItemWithTranformations = MakeItemWithTranformations;
exports.MakeItem = MakeItem;
exports.GetAcronymMap = GetAcronymMap;
exports.GetSelectCloze = GetSelectCloze;
exports.DoSimpleComputation = DoSimpleComputation;
exports.badSentenceRegex = exports.InternalAPI = exports.Clozable = exports.Tag = exports.ClozeAPI = exports.ClozableAPI = exports.SentenceAPI = void 0;

var _Types = require("./fable-library.2.10.2/Types");

var _Reflection = require("./fable-library.2.10.2/Reflection");

var _Int = require("./fable-library.2.10.2/Int32");

var _AllenNLP = require("./AllenNLP");

var _Seq = require("./fable-library.2.10.2/Seq");

var _Decode = require("./Thoth.Json.4.0.0/Decode");

var _Util = require("./fable-library.2.10.2/Util");

var _Array = require("./fable-library.2.10.2/Array");

var _Encode = require("./Thoth.Json.4.0.0/Encode");

var _List = require("./fable-library.2.10.2/List");

var _WordFrequency = require("./WordFrequency");

var _String = require("./fable-library.2.10.2/String");

var _Map = require("./fable-library.2.10.2/Map");

var _Paraphrase = require("./Paraphrase");

var _RegExp = require("./fable-library.2.10.2/RegExp");

var _Option = require("./fable-library.2.10.2/Option");

var _PromiseImpl = require("./Fable.Promise.2.1.0/PromiseImpl");

var _Promise = require("./Fable.Promise.2.1.0/Promise");

var diff = _interopRequireWildcard(require("diff"));

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function () { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

const SentenceAPI = (0, _Types.declare)(function ClozeAPI_SentenceAPI(sentence, itemId, hasCloze) {
  this.sentence = sentence;
  this.itemId = itemId | 0;
  this.hasCloze = hasCloze;
}, _Types.Record);
exports.SentenceAPI = SentenceAPI;

function SentenceAPI$reflection() {
  return (0, _Reflection.record_type)("ClozeAPI.SentenceAPI", [], SentenceAPI, () => [["sentence", _Reflection.string_type], ["itemId", _Reflection.int32_type], ["hasCloze", _Reflection.bool_type]]);
}

const ClozableAPI = (0, _Types.declare)(function ClozeAPI_ClozableAPI(cloze, itemId, clozeId, correctResponse, tags) {
  this.cloze = cloze;
  this.itemId = itemId | 0;
  this.clozeId = clozeId | 0;
  this.correctResponse = correctResponse;
  this.tags = tags;
}, _Types.Record);
exports.ClozableAPI = ClozableAPI;

function ClozableAPI$reflection() {
  return (0, _Reflection.record_type)("ClozeAPI.ClozableAPI", [], ClozableAPI, () => [["cloze", _Reflection.string_type], ["itemId", _Reflection.int32_type], ["clozeId", _Reflection.int32_type], ["correctResponse", _Reflection.string_type], ["tags", _Reflection.obj_type]]);
}

const ClozeAPI = (0, _Types.declare)(function ClozeAPI_ClozeAPI(sentences, clozes) {
  this.sentences = sentences;
  this.clozes = clozes;
}, _Types.Record);
exports.ClozeAPI = ClozeAPI;

function ClozeAPI$reflection() {
  return (0, _Reflection.record_type)("ClozeAPI.ClozeAPI", [], ClozeAPI, () => [["sentences", (0, _Reflection.array_type)(SentenceAPI$reflection())], ["clozes", (0, _Reflection.array_type)(ClozableAPI$reflection())]]);
}

const Tag = (0, _Types.declare)(function ClozeAPI_Tag(tag, name, ...fields) {
  this.tag = tag | 0;
  this.name = name;
  this.fields = fields;
}, _Types.Union);
exports.Tag = Tag;

function Tag$reflection() {
  return (0, _Reflection.union_type)("ClozeAPI.Tag", [], Tag, () => [["WeightGroup", [["Item", _Reflection.int32_type]]], ["OrderGroup", [["Item", _Reflection.int32_type]]], ["SyntacticRole", [["Item", _Reflection.string_type]]], ["SemanticRole", [["Item", _Reflection.string_type]]], ["RootDistance", [["Item", _Reflection.int32_type]]], ["StartDistance", [["Item", _Reflection.int32_type]]], ["CorefClusters", [["Item", _Reflection.int32_type]]], ["CorefClusterTotalWeight", [["Item", _Reflection.int32_type]]], ["CorefClusterBackwardWeight", [["Item", _Reflection.int32_type]]], ["CorefClusterForwardWeight", [["Item", _Reflection.int32_type]]], ["SentenceWeight", [["Item", _Reflection.int32_type]]], ["ClozeProbability", [["Item", _Reflection.float64_type]]], ["ClozeCorefTransformation", [["Item", _Reflection.string_type]]], ["CorrectResponseCorefTransformation", [["Item", _Reflection.string_type]]], ["ClozeParaphraseTransformation", [["Item", _Reflection.string_type]]], ["Transformations", [["Item", (0, _Reflection.list_type)(_Reflection.string_type)]]], ["Trace", [["Item", _Reflection.string_type]]], ["Deprecated", [["Item", _Reflection.string_type]]]]);
}

function StringToTag(keyValue) {
  const s = keyValue.split(":");
  const matchValue = s[0];

  switch (matchValue) {
    case "weightGroup":
      {
        let arg0;
        const value = s[1];
        arg0 = (0, _Int.parse)(value, 511, false, 32);
        return new Tag(0, "WeightGroup", arg0);
      }

    case "orderGroup":
      {
        let arg0$$1;
        const value$$1 = s[1];
        arg0$$1 = (0, _Int.parse)(value$$1, 511, false, 32);
        return new Tag(1, "OrderGroup", arg0$$1);
      }

    case "OrderGroup":
      {
        let arg0$$2;
        const value$$2 = s[1];
        arg0$$2 = (0, _Int.parse)(value$$2, 511, false, 32);
        return new Tag(1, "OrderGroup", arg0$$2);
      }

    case "chunk":
      {
        let arg0$$3;
        const value$$3 = s[1];
        arg0$$3 = (0, _Int.parse)(value$$3, 511, false, 32);
        return new Tag(1, "OrderGroup", arg0$$3);
      }

    case "default":
      {
        const arg0$$4 = s[1];
        return new Tag(17, "Deprecated", arg0$$4);
      }

    default:
      {
        const arg0$$5 = "Error:" + keyValue;
        return new Tag(16, "Trace", arg0$$5);
      }
  }
}

const Clozable = (0, _Types.declare)(function ClozeAPI_Clozable(words, start, stop, trace, prob, tags) {
  this.words = words;
  this.start = start | 0;
  this.stop = stop | 0;
  this.trace = trace;
  this.prob = prob;
  this.tags = tags;
}, _Types.Record);
exports.Clozable = Clozable;

function Clozable$reflection() {
  return (0, _Reflection.record_type)("ClozeAPI.Clozable", [], Clozable, () => [["words", (0, _Reflection.array_type)(_Reflection.string_type)], ["start", _Reflection.int32_type], ["stop", _Reflection.int32_type], ["trace", (0, _Reflection.list_type)(Tag$reflection())], ["prob", _Reflection.float64_type], ["tags", (0, _Reflection.list_type)(Tag$reflection())]]);
}

const InternalAPI = (0, _Types.declare)(function ClozeAPI_InternalAPI(sentences, coreference, clozables) {
  this.sentences = sentences;
  this.coreference = coreference;
  this.clozables = clozables;
}, _Types.Record);
exports.InternalAPI = InternalAPI;

function InternalAPI$reflection() {
  return (0, _Reflection.record_type)("ClozeAPI.InternalAPI", [], InternalAPI, () => [["sentences", (0, _Reflection.array_type)((0, _AllenNLP.SentenceAnnotation$reflection)())], ["coreference", (0, _AllenNLP.Coreference$reflection)()], ["clozables", (0, _Reflection.array_type)((0, _Reflection.array_type)(Clozable$reflection()))]]);
}

function EstimateDesiredSentences(sentences) {
  let wordCount;
  let value$$4;
  value$$4 = (0, _Seq.sumBy)(function projection(sentence) {
    return sentence.split(" ").length;
  }, sentences, {
    GetZero() {
      return 0;
    },

    Add($x$$1, $y$$2) {
      return $x$$1 + $y$$2;
    }

  });
  wordCount = value$$4;
  let desiredSentences;
  const value$$5 = wordCount / 1000 * 12;
  desiredSentences = ~~value$$5;
  return desiredSentences | 0;
}

function EstimateDesiredItems(desiredSentences$$1) {
  let desiredItems;
  const value$$7 = (desiredSentences$$1) * 1.3;
  desiredItems = ~~value$$7;
  return desiredItems | 0;
}

function EstimateDesiredSentencesFromPercentage(nlpJson, percentage) {
  var value$$8;
  let da;
  da = (0, _Decode.Auto$$$unsafeFromString$$Z5CB6BD)(nlpJson, undefined, undefined, {
    ResolveType() {
      return (0, _AllenNLP.DocumentAnnotation$reflection)();
    }

  });
  const desiredSentences$$2 = (value$$8 = da.sentences.length | 0, (value$$8)) * percentage;
  return ~~desiredSentences$$2 | 0;
}

function GetTotalWeight(coref, sen) {
  let totalWeight;
  let array$$1;
  array$$1 = (0, _Array.distinct)(sen.cor.clusters, {
    Equals($x$$3, $y$$4) {
      return $x$$3 === $y$$4;
    },

    GetHashCode: _Util.structuralHash
  });
  totalWeight = (0, _Array.sumBy)(function projection$$1(id) {
    return coref.clusters[id].length;
  }, array$$1, {
    GetZero() {
      return 0;
    },

    Add($x$$5, $y$$6) {
      return $x$$5 + $y$$6;
    }

  });
  return totalWeight | 0;
}

function getFeatureDistanceFromRoot(start, stop, sen$$1) {
  let maxDistance;
  let source$$2;
  const source$$1 = (0, _Array.ofSeq)((0, _Seq.rangeNumber)(start, 1, stop), Int32Array);
  source$$2 = (0, _Seq.map)(function mapping(i$$1) {
    let distance = 0;
    let i = i$$1 | 0;

    while ((i > -1 ? sen$$1.dep.predicted_heads[i] !== 0 : false) ? distance < sen$$1.dep.predicted_heads.length : false) {
      i = sen$$1.dep.predicted_heads[i] - 1;
      distance = distance + 1;
    }

    return distance | 0;
  }, source$$1);
  maxDistance = (0, _Seq.max)(source$$2, {
    Compare: _Util.comparePrimitives
  });
  return new Tag(4, "RootDistance", maxDistance);
}

function getFeatureDistanceFromStart(start$$1) {
  return new Tag(5, "StartDistance", start$$1);
}

function getFeatureCorefClusters(sen$$2) {
  let clusters;
  clusters = (0, _Array.distinct)(sen$$2.cor.clusters, {
    Equals($x$$9, $y$$10) {
      return $x$$9 === $y$$10;
    },

    GetHashCode: _Util.structuralHash
  });
  const arg0$$8 = clusters.length | 0;
  return new Tag(6, "CorefClusters", arg0$$8);
}

function getFeatureCorefClusterTotalWeight(sen$$3, da$$1) {
  const totalWeight$$1 = GetTotalWeight(da$$1.coreference, sen$$3) | 0;
  return new Tag(7, "CorefClusterTotalWeight", totalWeight$$1);
}

function getFeatureCorefClusterBackwardWeight(sen$$4, da$$2) {
  let weight;
  let array$$6;
  let array$$5;
  let array$$4;
  array$$4 = (0, _Array.distinct)(sen$$4.cor.clusters, {
    Equals($x$$11, $y$$12) {
      return $x$$11 === $y$$12;
    },

    GetHashCode: _Util.structuralHash
  });
  array$$5 = (0, _Array.collect)(function mapping$$1(id$$1) {
    return da$$2.coreference.clusters[id$$1];
  }, array$$4, Array);
  array$$6 = array$$5.filter(function predicate(c) {
    return c[1] < sen$$4.cor.offset;
  });
  weight = array$$6.length;
  return new Tag(8, "CorefClusterBackwardWeight", weight);
}

function getFeatureCorefClusterForwardWeight(sen$$5, da$$3) {
  let weight$$1;
  let array$$10;
  let array$$9;
  let array$$8;
  array$$8 = (0, _Array.distinct)(sen$$5.cor.clusters, {
    Equals($x$$13, $y$$14) {
      return $x$$13 === $y$$14;
    },

    GetHashCode: _Util.structuralHash
  });
  array$$9 = (0, _Array.collect)(function mapping$$2(id$$2) {
    return da$$3.coreference.clusters[id$$2];
  }, array$$8, Array);
  array$$10 = array$$9.filter(function predicate$$1(c$$1) {
    return c$$1[0] > sen$$5.cor.offset + sen$$5.srl.words.length;
  });
  weight$$1 = array$$10.length;
  return new Tag(9, "CorefClusterForwardWeight", weight$$1);
}

function GetModifiedNPClozable(sa, startInit, stopInit, head, traceInit) {
  var arg0$$12, array$$12, value$$10, array$$18, array$$20;
  const trace = [];
  (0, _Array.addRangeInPlace)(traceInit, trace);
  void trace.push(getFeatureDistanceFromRoot(startInit, stopInit, sa));
  void trace.push(getFeatureDistanceFromStart(startInit));

  if (startInit < 0 ? true : stopInit >= sa.srl.words.length) {
    void trace.push((arg0$$12 = "CRITICAL: invalid clozable parameters for " + ((0, _Encode.Auto$$$toString$$5A41365E)(4, sa, undefined, undefined, undefined, {
      ResolveType() {
        return (0, _AllenNLP.SentenceAnnotation$reflection)();
      }

    })), (new Tag(16, "Trace", arg0$$12))));
    return new Clozable(new Array(0), 0, 0, ((0, _List.ofSeq)(trace)), 1, (array$$12 = ((0, _Array.map)(StringToTag, sa.tags, Array)), ((0, _Array.toList)(array$$12))));
  } else {
    let h$$3;

    if (head == null) {
      let stanfordHead;
      let tuple;
      let source$$5;
      const source$$4 = (0, _Array.ofSeq)((0, _Seq.rangeNumber)(startInit, 1, stopInit), Int32Array);
      source$$5 = (0, _Seq.map)(function mapping$$3(i$$2) {
        return [i$$2, sa.dep.predicted_heads[i$$2]];
      }, source$$4);
      tuple = (0, _Seq.find)(function predicate$$2(tupledArg) {
        if (tupledArg[1] < startInit + 1) {
          return true;
        } else {
          return tupledArg[1] > stopInit + 1;
        }
      }, source$$5);
      stanfordHead = tuple[0];

      if (value$$10 = sa.dep.pos[stanfordHead].indexOf("NN") === 0, (!value$$10)) {
        void trace.push((new Tag(16, "Trace", "head is not nominal")));
        let argOption;
        let source$$7;
        const source$$6 = (0, _Array.ofSeq)((0, _Seq.rangeNumber)(startInit, 1, stopInit), Int32Array);
        source$$7 = (0, _Seq.map)(function mapping$$4(i$$3) {
          return [i$$3, sa.dep.predicted_dependencies[i$$3]];
        }, source$$6);
        argOption = (0, _Seq.tryFind)(function predicate$$3(tupledArg$$1) {
          if (tupledArg$$1[1].indexOf("subj") >= 0) {
            return true;
          } else {
            return tupledArg$$1[1].indexOf("obj") >= 0;
          }
        }, source$$7);
        let nnOption;
        let source$$10;
        let source$$9;
        const source$$8 = (0, _Array.ofSeq)((0, _Seq.rangeNumber)(startInit, 1, stopInit), Int32Array);
        source$$9 = (0, _Seq.map)(function mapping$$5(i$$4) {
          return [i$$4, sa.dep.pos[i$$4]];
        }, source$$8);
        source$$10 = (0, _Seq.reverse)(source$$9);
        nnOption = (0, _Seq.tryFind)(function predicate$$4(tupledArg$$2) {
          return tupledArg$$2[1].indexOf("NN") === 0;
        }, source$$10);

        if (argOption != null) {
          const arg = argOption;
          void trace.push((new Tag(16, "Trace", "WARNING: using first syntactic arg as pseudohead")));
          h$$3 = arg[0];
        } else if (nnOption != null) {
          const nn = nnOption;
          void trace.push((new Tag(16, "Trace", "WARNING: using last nominal as pseudohead")));
          h$$3 = nn[0];
        } else {
          void trace.push((new Tag(16, "Trace", "CRITICAL: clozable without nominal or arg, defaulting to given span")));
          h$$3 = stopInit;
        }
      } else {
        h$$3 = stanfordHead;
      }
    } else {
      const x$$2 = head | 0;
      h$$3 = x$$2;
    }

    let indices;
    let array$$15;
    let array$$14;
    const array$$13 = (0, _Array.ofSeq)((0, _Seq.rangeNumber)(startInit, 1, h$$3), Int32Array);
    array$$14 = (0, _Array.reverse)(array$$13, Int32Array);
    array$$15 = (0, _Array.takeWhile)(function predicate$$5(i$$5) {
      if (sa.dep.pos[i$$5].indexOf("N") === 0) {
        return true;
      } else {
        return sa.dep.pos[i$$5] === "JJ";
      }
    }, array$$14, Int32Array);
    indices = (0, _Array.reverse)(array$$15, Int32Array);
    let patternInput;

    if (indices.length !== 0) {
      const start$$2 = indices[0] | 0;
      let stop$$1;
      stop$$1 = (0, _Array.last)(indices);
      patternInput = [start$$2, stop$$1, sa.srl.words.slice(start$$2, stop$$1 + 1)];
    } else {
      void trace.push((new Tag(16, "Trace", "CRITICAL: stanford head yields empty span, defaulting to given span")));
      patternInput = [startInit, stopInit, sa.srl.words.slice(startInit, stopInit + 1)];
    }

    const clozable = new Clozable(patternInput[2], patternInput[0], patternInput[1], ((0, _List.ofSeq)(trace)), (array$$18 = ((0, _Array.map)(_WordFrequency.Get, patternInput[2], Float64Array)), ((0, _Array.min)(array$$18, {
      Compare: _Util.comparePrimitives
    }))), (array$$20 = ((0, _Array.map)(StringToTag, sa.tags, Array)), ((0, _Array.toList)(array$$20))));
    return clozable;
  }
}

function GetClozables(da$$4) {
  let corefresolvedSentences;
  corefresolvedSentences = (0, _AllenNLP.resolveReferents)(da$$4);
  return (0, _Array.map)(function mapping$$12(sa$$1) {
    var source$$16, source$$15, source$$14, arg0$$26, arg0$$27, arg0$$28, arg0$$29;
    const clozable$$1 = [];
    (0, _Array.addRangeInPlace)(((0, _Seq.mapIndexed)(function mapping$$6(i$$6, si) {
      return GetModifiedNPClozable(sa$$1, si[0], si[1], undefined, [(new Tag(16, "Trace", "coref")), getFeatureCorefClusters(sa$$1), getFeatureCorefClusterTotalWeight(sa$$1, da$$4), getFeatureCorefClusterBackwardWeight(sa$$1, da$$4), getFeatureCorefClusterForwardWeight(sa$$1, da$$4)]);
    }, sa$$1.cor.spans)), clozable$$1);
    (0, _Array.addRangeInPlace)((source$$16 = (source$$15 = (source$$14 = ((0, _Seq.mapIndexed)(function mapping$$7(i$$7, x$$3) {
      return [i$$7, x$$3];
    }, sa$$1.dep.predicted_dependencies)), ((0, _Seq.filter)(function predicate$$6(tupledArg$$3) {
      if (tupledArg$$3[1].indexOf("obj") >= 0 ? true : tupledArg$$3[1].indexOf("subj") >= 0) {
        return true;
      } else {
        return tupledArg$$3[1].indexOf("root") >= 0;
      }
    }, source$$14))), ((0, _Seq.filter)(function predicate$$7(tupledArg$$4) {
      return sa$$1.dep.pos[tupledArg$$4[0]].indexOf("N") === 0;
    }, source$$15))), ((0, _Seq.map)(function mapping$$8(tupledArg$$5) {
      return GetModifiedNPClozable(sa$$1, tupledArg$$5[0], tupledArg$$5[0], (tupledArg$$5[0]), [(new Tag(16, "Trace", "dep")), (new Tag(16, "Trace", tupledArg$$5[1])), (new Tag(2, "SyntacticRole", tupledArg$$5[1]))]);
    }, source$$16))), clozable$$1);
    (0, _Array.addRangeInPlace)(((0, _Seq.collect)(function mapping$$11(pred) {
      let source$$22;
      let source$$19;
      let source$$18;
      source$$18 = (0, _Seq.mapIndexed)(function mapping$$9(i$$11, t) {
        return [i$$11, t];
      }, pred.tags);
      source$$19 = (0, _Seq.filter)(function predicate$$8(tupledArg$$6) {
        return tupledArg$$6[1].indexOf("ARG") >= 0;
      }, source$$18);
      source$$22 = (0, _Map.groupBy)(function projection$$2(tupledArg$$7) {
        return (0, _String.substring)(tupledArg$$7[1], 2);
      }, source$$19, {
        Equals($x$$17, $y$$18) {
          return $x$$17 === $y$$18;
        },

        GetHashCode: _Util.structuralHash
      });
      return (0, _Seq.map)(function mapping$$10(tupledArg$$8) {
        let start$$4;
        let tuple$$4;
        tuple$$4 = (0, _Seq.minBy)(function projection$$3(tuple$$3) {
          return tuple$$3[0];
        }, tupledArg$$8[1], {
          Compare: _Util.comparePrimitives
        });
        start$$4 = tuple$$4[0];
        let stop$$3;
        let tuple$$6;
        tuple$$6 = (0, _Seq.maxBy)(function projection$$4(tuple$$5) {
          return tuple$$5[0];
        }, tupledArg$$8[1], {
          Compare: _Util.comparePrimitives
        });
        stop$$3 = tuple$$6[0];
        return GetModifiedNPClozable(sa$$1, start$$4, stop$$3, undefined, [(new Tag(16, "Trace", "srl")), (new Tag(16, "Trace", pred.description)), (new Tag(3, "SemanticRole", tupledArg$$8[0]))]);
      }, source$$22);
    }, sa$$1.srl.verbs)), clozable$$1);

    for (let i$$12 = 0; i$$12 <= clozable$$1.length - 1; i$$12++) {
      const tags = Array.from(clozable$$1[i$$12].tags);
      void tags.push((arg0$$26 = (GetTotalWeight(da$$4.coreference, sa$$1)) | 0, (new Tag(10, "SentenceWeight", arg0$$26))));
      void tags.push((arg0$$27 = clozable$$1[i$$12].prob, (new Tag(11, "ClozeProbability", arg0$$27))));
      void tags.push((arg0$$28 = corefresolvedSentences[sa$$1.id], (new Tag(12, "ClozeCorefTransformation", arg0$$28))));
      void tags.push((arg0$$29 = ((0, _Paraphrase.getCachedParaphrase)(sa$$1.sen)), (new Tag(14, "ClozeParaphraseTransformation", arg0$$29))));
      const inputRecord = clozable$$1[i$$12];
      let tags$$1;
      tags$$1 = (0, _List.ofSeq)(tags);
      clozable$$1[i$$12] = new Clozable(inputRecord.words, inputRecord.start, inputRecord.stop, inputRecord.trace, inputRecord.prob, tags$$1);
    }

    return clozable$$1;
  }, da$$4.sentences, Array);
}

const badSentenceRegex = (0, _RegExp.create)("(figure|table|section|clinical|application)\\s+[0-9]", 1);
exports.badSentenceRegex = badSentenceRegex;

function GetAllCloze(nlpJsonOption, stringArrayJsonOption, inputText) {
  return (0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
    var nlpJson$$1, input;
    return (nlpJsonOption == null ? (0, _AllenNLP.GetNLP)(stringArrayJsonOption, inputText) : (nlpJson$$1 = nlpJsonOption, (input = ((0, _Decode.Auto$$$unsafeFromString$$Z5CB6BD)(nlpJson$$1, undefined, undefined, {
      ResolveType() {
        return (0, _AllenNLP.DocumentAnnotation$reflection)();
      }

    })), ((0, _AllenNLP.Promisify)(input))))).then(function (_arg1$$2) {
      if (_arg1$$2.tag === 1) {
        return Promise.resolve(new _Option.Result(1, "Error", _arg1$$2.fields[0]));
      } else {
        let clozables;
        let array$$22;
        array$$22 = GetClozables(_arg1$$2.fields[0]);
        clozables = (0, _Array.map)(function mapping$$13(ra) {
          return ra.slice();
        }, array$$22, Array);
        return Promise.resolve(new _Option.Result(0, "Ok", new InternalAPI(_arg1$$2.fields[0].sentences, _arg1$$2.fields[0].coreference, clozables)));
      }
    });
  }));
}

function GetAllClozeLukeFormat20200714(nlpJsonOption$$1, stringArrayJsonOption$$1, inputText$$1) {
  return (0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
    var nlpJson$$2, input$$1;
    return (nlpJsonOption$$1 == null ? (0, _AllenNLP.GetNLP)(stringArrayJsonOption$$1, inputText$$1) : (nlpJson$$2 = nlpJsonOption$$1, (input$$1 = ((0, _Decode.Auto$$$unsafeFromString$$Z5CB6BD)(nlpJson$$2, undefined, undefined, {
      ResolveType() {
        return (0, _AllenNLP.DocumentAnnotation$reflection)();
      }

    })), ((0, _AllenNLP.Promisify)(input$$1))))).then(function (_arg1$$3) {
      if (_arg1$$3.tag === 1) {
        return Promise.resolve(new _Option.Result(1, "Error", _arg1$$3.fields[0]));
      } else {
        let clozables$$1;
        let array$$23;
        array$$23 = GetClozables(_arg1$$3.fields[0]);
        clozables$$1 = (0, _Array.map)(function mapping$$14(ra$$1) {
          return ra$$1.slice();
        }, array$$23, Array);
        let output;
        output = (0, _Array.mapIndexed)(function mapping$$16(i$$13, sa$$2) {
          let totalWeight$$2;
          totalWeight$$2 = GetTotalWeight(_arg1$$3.fields[0].coreference, sa$$2);
          const array$$24 = clozables$$1[i$$13];
          return (0, _Array.map)(function mapping$$15(cl) {
            let cloze;
            cloze = (0, _String.join)(" ", cl.words);
            let sentence$$2;
            sentence$$2 = (0, _AllenNLP.removePrePunctuationSpaces)(sa$$2.sen);
            let crOption;
            let list$$1;
            list$$1 = (0, _List.choose)(function chooser(_arg2$$2) {
              if (_arg2$$2.tag === 12) {
                return _arg2$$2.fields[0];
              } else {
                return undefined;
              }
            }, cl.tags);
            crOption = (0, _List.tryHead)(list$$1);

            if (crOption != null) {
              const cr = crOption;
              const diffList = diff.diffWords(sa$$2.sen, cr, (0, _Types.anonRecord)({
                ignoreCase: true
              }));
              let diffMap;
              const elements = (0, _Array.ofSeq)((0, _Seq.delay)(function () {
                const removeList = [];
                const addList = [];
                return (0, _Seq.collect)(function (d$$3) {
                  if (d$$3.removed != null) {
                    void removeList.push(d$$3.value);
                    return (0, _Seq.empty)();
                  } else if (d$$3.added != null) {
                    void addList.push(d$$3.value);
                    return (0, _Seq.empty)();
                  } else if (d$$3.value.trim() === "") {
                    void null;
                    return (0, _Seq.empty)();
                  } else if (removeList.length > 0) {
                    return (0, _Seq.append)((0, _Seq.singleton)([((0, _String.join)(" ", removeList)), ((0, _String.join)(" ", addList)).trim()]), (0, _Seq.delay)(function () {
                      (0, _Util.clear)(removeList);
                      (0, _Util.clear)(addList);
                      return (0, _Seq.empty)();
                    }));
                  } else {
                    return (0, _Seq.empty)();
                  }
                }, diffList);
              }), Array);
              diffMap = (0, _Map.ofArray)(elements, {
                Compare: _Util.comparePrimitives
              });
              let crCloze;
              const matchValue$$2 = (0, _Map.FSharpMap$$TryFind$$2B595)(diffMap, cloze);

              if (matchValue$$2 == null) {
                crCloze = cloze;
              } else {
                const diffCloze = matchValue$$2;
                crCloze = diffCloze;
              }

              if (sentence$$2 !== cr) {
                return (0, _Types.anonRecord)({
                  Cloze: crCloze,
                  ClozeProbability: cl.prob,
                  Sentence: cr,
                  SentenceWeight: totalWeight$$2
                });
              } else {
                let Cloze;
                Cloze = (0, _String.join)(" ", cl.words);
                return (0, _Types.anonRecord)({
                  Cloze: Cloze,
                  ClozeProbability: cl.prob,
                  Sentence: sentence$$2,
                  SentenceWeight: totalWeight$$2
                });
              }
            } else {
              let Cloze$$1;
              Cloze$$1 = (0, _String.join)(" ", cl.words);
              return (0, _Types.anonRecord)({
                Cloze: Cloze$$1,
                ClozeProbability: cl.prob,
                Sentence: sentence$$2,
                SentenceWeight: totalWeight$$2
              });
            }
          }, array$$24, Array);
        }, _arg1$$3.fields[0].sentences, Array);
        return Promise.resolve(new _Option.Result(0, "Ok", output));
      }
    });
  }));
}

function GetAllClozeLukeFormat20201218(nlpJsonOption$$2, stringArrayJsonOption$$2, inputText$$2) {
  return (0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
    var nlpJson$$3, input$$3;
    return (nlpJsonOption$$2 == null ? (0, _AllenNLP.GetNLP)(stringArrayJsonOption$$2, inputText$$2) : (nlpJson$$3 = nlpJsonOption$$2, (input$$3 = ((0, _Decode.Auto$$$unsafeFromString$$Z5CB6BD)(nlpJson$$3, undefined, undefined, {
      ResolveType() {
        return (0, _AllenNLP.DocumentAnnotation$reflection)();
      }

    })), ((0, _AllenNLP.Promisify)(input$$3))))).then(function (_arg1$$4) {
      if (_arg1$$4.tag === 1) {
        return Promise.resolve(new _Option.Result(1, "Error", _arg1$$4.fields[0]));
      } else {
        let clozables$$2;
        let array$$26;
        array$$26 = GetClozables(_arg1$$4.fields[0]);
        clozables$$2 = (0, _Array.map)(function mapping$$17(ra$$2) {
          return ra$$2.slice();
        }, array$$26, Array);
        let output$$1;
        output$$1 = (0, _Array.mapIndexed)(function mapping$$19(i$$14, sa$$3) {
          let totalWeight$$3;
          totalWeight$$3 = GetTotalWeight(_arg1$$4.fields[0].coreference, sa$$3);
          const array$$27 = clozables$$2[i$$14];
          return (0, _Array.map)(function mapping$$18(cl$$1) {
            let cloze$$1;
            cloze$$1 = (0, _String.join)(" ", cl$$1.words);
            let sentence$$3;
            sentence$$3 = (0, _AllenNLP.removePrePunctuationSpaces)(sa$$3.sen);
            let crOption$$1;
            let list$$3;
            list$$3 = (0, _List.choose)(function chooser$$1(_arg2$$3) {
              if (_arg2$$3.tag === 12) {
                return _arg2$$3.fields[0];
              } else {
                return undefined;
              }
            }, cl$$1.tags);
            crOption$$1 = (0, _List.tryHead)(list$$3);

            if (crOption$$1 != null) {
              const cr$$1 = crOption$$1;
              const diffList$$1 = diff.diffWords(sa$$3.sen, cr$$1, (0, _Types.anonRecord)({
                ignoreCase: true
              }));
              let diffMap$$1;
              const elements$$1 = (0, _Array.ofSeq)((0, _Seq.delay)(function () {
                const removeList$$1 = [];
                const addList$$1 = [];
                return (0, _Seq.collect)(function (d$$4) {
                  if (d$$4.removed != null) {
                    void removeList$$1.push(d$$4.value);
                    return (0, _Seq.empty)();
                  } else if (d$$4.added != null) {
                    void addList$$1.push(d$$4.value);
                    return (0, _Seq.empty)();
                  } else if (d$$4.value.trim() === "") {
                    void null;
                    return (0, _Seq.empty)();
                  } else if (removeList$$1.length > 0) {
                    return (0, _Seq.append)((0, _Seq.singleton)([((0, _String.join)(" ", removeList$$1)), ((0, _String.join)(" ", addList$$1)).trim()]), (0, _Seq.delay)(function () {
                      (0, _Util.clear)(removeList$$1);
                      (0, _Util.clear)(addList$$1);
                      return (0, _Seq.empty)();
                    }));
                  } else {
                    return (0, _Seq.empty)();
                  }
                }, diffList$$1);
              }), Array);
              diffMap$$1 = (0, _Map.ofArray)(elements$$1, {
                Compare: _Util.comparePrimitives
              });
              let crCloze$$1;
              const matchValue$$3 = (0, _Map.FSharpMap$$TryFind$$2B595)(diffMap$$1, cloze$$1);

              if (matchValue$$3 == null) {
                crCloze$$1 = cloze$$1;
              } else {
                const diffCloze$$1 = matchValue$$3;
                crCloze$$1 = diffCloze$$1;
              }

              if (sentence$$3 !== cr$$1) {
                const itemId = (0, _Util.structuralHash)(sa$$3) | 0;
                const clozeId = (0, _Util.structuralHash)(cloze$$1) | 0;
                return (0, _Types.anonRecord)({
                  Cloze: crCloze$$1,
                  OriginalSentence: sentence$$3,
                  Sentence: cr$$1,
                  Tags: (0, _List.append)(cl$$1.tags, cl$$1.trace),
                  clozeId: clozeId,
                  itemId: itemId
                });
              } else {
                let Cloze$$2;
                Cloze$$2 = (0, _String.join)(" ", cl$$1.words);
                const itemId$$1 = (0, _Util.structuralHash)(sa$$3) | 0;
                const clozeId$$1 = (0, _Util.structuralHash)(cloze$$1) | 0;
                return (0, _Types.anonRecord)({
                  Cloze: Cloze$$2,
                  OriginalSentence: sentence$$3,
                  Sentence: sentence$$3,
                  Tags: (0, _List.append)(cl$$1.tags, cl$$1.trace),
                  clozeId: clozeId$$1,
                  itemId: itemId$$1
                });
              }
            } else {
              let Cloze$$3;
              Cloze$$3 = (0, _String.join)(" ", cl$$1.words);
              const itemId$$2 = (0, _Util.structuralHash)(sa$$3) | 0;
              const clozeId$$2 = (0, _Util.structuralHash)(cloze$$1) | 0;
              return (0, _Types.anonRecord)({
                Cloze: Cloze$$3,
                OriginalSentence: sentence$$3,
                Sentence: sentence$$3,
                Tags: (0, _List.append)(cl$$1.tags, cl$$1.trace),
                clozeId: clozeId$$2,
                itemId: itemId$$2
              });
            }
          }, array$$27, Array);
        }, _arg1$$4.fields[0].sentences, Array);
        return Promise.resolve(new _Option.Result(0, "Ok", output$$1));
      }
    });
  }));
}

function RemoveOverlappingClozables(clozables$$3) {
  const clozablesOut = Array.from((clozables$$3.filter(function predicate$$9(cl$$2) {
    return cl$$2.words.length < 4;
  })));

  for (let ci = 0; ci <= clozables$$3.length - 1; ci++) {
    for (let cj = ci; cj <= clozables$$3.length - 1; cj++) {
      const overlap = (ci !== cj ? clozables$$3[ci].start <= clozables$$3[cj].stop : false) ? clozables$$3[cj].start <= clozables$$3[ci].stop : false;

      if (overlap ? clozables$$3[ci].stop - clozables$$3[ci].start >= clozables$$3[cj].stop - clozables$$3[cj].start : false) {
        const value$$11 = (0, _Array.removeInPlace)(clozables$$3[cj], clozablesOut);
        void value$$11;
      } else if (overlap) {
        const value$$12 = (0, _Array.removeInPlace)(clozables$$3[ci], clozablesOut);
        void value$$12;
      } else {
        void null;
      }
    }
  }

  return clozablesOut.slice();
}

function MakeItemWithTranformations(sa$$4, cl$$3) {
  let blank;
  const strings$$10 = (0, _Array.ofSeq)((0, _Seq.delay)(function () {
    return (0, _Seq.map)(function (_) {
      return "__________";
    }, (0, _Seq.rangeNumber)(cl$$3.start, 1, cl$$3.stop));
  }), Array);
  blank = (0, _String.join)(" ", strings$$10);
  let sentence$$4;
  const strings$$11 = (0, _Array.copy)(sa$$4.srl.words, Array);
  sentence$$4 = (0, _String.join)(" ", strings$$11);
  let cloze$$2;
  cloze$$2 = (0, _String.join)(" ", cl$$3.words);
  let item;
  const input$$5 = (0, _RegExp.replace)(sentence$$4, "\\b" + cloze$$2 + "\\b", blank);
  item = (0, _AllenNLP.removePrePunctuationSpaces)(input$$5);
  let crOption$$2;
  let list$$5;
  list$$5 = (0, _List.choose)(function chooser$$2(_arg1$$5) {
    if (_arg1$$5.tag === 12) {
      return _arg1$$5.fields[0];
    } else {
      return undefined;
    }
  }, cl$$3.tags);
  crOption$$2 = (0, _List.tryHead)(list$$5);
  let paOption;
  let list$$7;
  list$$7 = (0, _List.choose)(function chooser$$3(_arg2$$4) {
    if (_arg2$$4.tag === 14) {
      return _arg2$$4.fields[0];
    } else {
      return undefined;
    }
  }, cl$$3.tags);
  paOption = (0, _List.tryHead)(list$$7);
  let tags$$2;
  tags$$2 = (0, _List.filter)(function predicate$$10(_arg3$$1) {
    switch (_arg3$$1.tag) {
      case 12:
      case 14:
        {
          return false;
        }

      default:
        {
          return true;
        }
    }
  }, cl$$3.tags);
  var $target$$140, cr$$2, pa;

  if (crOption$$2 != null) {
    if (paOption != null) {
      $target$$140 = 0;
      cr$$2 = crOption$$2;
      pa = paOption;
    } else {
      $target$$140 = 1;
    }
  } else {
    $target$$140 = 1;
  }

  switch ($target$$140) {
    case 0:
      {
        const paItem = (0, _RegExp.replace)(pa, "\\b" + cloze$$2 + "\\b", blank);
        const diffList$$2 = diff.diffWords(sa$$4.sen, cr$$2, (0, _Types.anonRecord)({
          ignoreCase: true
        }));
        let diffMap$$2;
        const elements$$2 = (0, _Array.ofSeq)((0, _Seq.delay)(function () {
          const removeList$$2 = [];
          const addList$$2 = [];
          return (0, _Seq.collect)(function (d$$5) {
            if (d$$5.removed != null) {
              void removeList$$2.push(d$$5.value);
              return (0, _Seq.empty)();
            } else if (d$$5.added != null) {
              void addList$$2.push(d$$5.value);
              return (0, _Seq.empty)();
            } else if (d$$5.value.trim() === "") {
              void null;
              return (0, _Seq.empty)();
            } else if (removeList$$2.length > 0) {
              return (0, _Seq.append)((0, _Seq.singleton)([((0, _String.join)(" ", removeList$$2)), ((0, _String.join)(" ", addList$$2)).trim()]), (0, _Seq.delay)(function () {
                (0, _Util.clear)(removeList$$2);
                (0, _Util.clear)(addList$$2);
                return (0, _Seq.empty)();
              }));
            } else {
              return (0, _Seq.empty)();
            }
          }, diffList$$2);
        }), Array);
        diffMap$$2 = (0, _Map.ofArray)(elements$$2, {
          Compare: _Util.comparePrimitives
        });
        let crCloze$$2;
        const matchValue$$5 = (0, _Map.FSharpMap$$TryFind$$2B595)(diffMap$$2, cloze$$2);

        if (matchValue$$5 == null) {
          crCloze$$2 = cloze$$2;
        } else {
          const diffCloze$$2 = matchValue$$5;
          crCloze$$2 = diffCloze$$2;
        }

        const crItem = (0, _RegExp.replace)(cr$$2, "\\b" + crCloze$$2 + "\\b", blank);

        if (cr$$2 === sa$$4.sen ? pa === sa$$4.sen : false) {
          return [item, cloze$$2, tags$$2];
        } else if ((cr$$2 === sa$$4.sen ? pa !== sa$$4.sen : false) ? pa !== paItem : false) {
          return [item, cloze$$2, new _Types.List(new Tag(14, "ClozeParaphraseTransformation", paItem), tags$$2)];
        } else if ((cr$$2 !== sa$$4.sen ? pa === sa$$4.sen : false) ? cr$$2 !== crItem : false) {
          return [item, cloze$$2, new _Types.List(new Tag(12, "ClozeCorefTransformation", crItem), new _Types.List(new Tag(13, "CorrectResponseCorefTransformation", crCloze$$2), tags$$2))];
        } else if (cr$$2 !== sa$$4.sen ? pa !== sa$$4.sen : false) {
          let tempTags;
          tempTags = Array.from(tags$$2);

          if (pa !== paItem) {
            void tempTags.push(new Tag(14, "ClozeParaphraseTransformation", paItem));
          } else {
            void null;
          }

          if (cr$$2 !== crItem) {
            void tempTags.push(new Tag(12, "ClozeCorefTransformation", crItem));
            void tempTags.push(new Tag(13, "CorrectResponseCorefTransformation", crCloze$$2));
          } else {
            void null;
          }

          return [item, cloze$$2, ((0, _List.ofSeq)(tempTags))];
        } else {
          return [item, cloze$$2, tags$$2];
        }
      }

    case 1:
      {
        return [item, cloze$$2, tags$$2];
      }
  }
}

function MakeItem(sa$$5, cl$$4) {
  let blank$$1;
  const strings$$15 = (0, _Array.ofSeq)((0, _Seq.delay)(function () {
    return (0, _Seq.map)(function (_$$1) {
      return "__________";
    }, (0, _Seq.rangeNumber)(cl$$4.start, 1, cl$$4.stop));
  }), Array);
  blank$$1 = (0, _String.join)(" ", strings$$15);
  let sentence$$5;
  const strings$$16 = (0, _Array.copy)(sa$$5.srl.words, Array);
  sentence$$5 = (0, _String.join)(" ", strings$$16);
  let cloze$$3;
  cloze$$3 = (0, _String.join)(" ", cl$$4.words);
  let item$$1;
  const input$$6 = (0, _RegExp.replace)(sentence$$5, "\\b" + cloze$$3 + "\\b", blank$$1);
  item$$1 = (0, _AllenNLP.removePrePunctuationSpaces)(input$$6);
  return [item$$1, cloze$$3];
}

function GetAcronymMap(input$$7) {
  const acronymRegex = (0, _RegExp.create)("\\(([A-Z]+)\\)");
  const matches = (0, _RegExp.matches)(acronymRegex, input$$7);
  let acronymMap;

  if (matches.length !== 0) {
    const elements$$3 = (0, _Seq.delay)(function () {
      return (0, _Seq.collect)(function (m) {
        const acronym = m[1] || "";
        const index$$1 = m.index | 0;
        const start$$5 = (index$$1 - 50 > 0 ? index$$1 - 50 : 0) | 0;
        let words$$1;
        const input$$8 = (0, _String.substring)(input$$7, start$$5, 50);
        const pattern = " ";
        words$$1 = (0, _AllenNLP.Split)(pattern, input$$8);
        let firstLetterString;
        let arg00$$1;
        arg00$$1 = (0, _Array.map)(function mapping$$20(w) {
          return w[0];
        }, words$$1, Array);
        firstLetterString = arg00$$1.join("");
        const letterRegex = (0, _RegExp.create)(acronym);
        const lm = (0, _RegExp.match)(letterRegex, firstLetterString.toLocaleUpperCase());

        if (lm != null) {
          let phrase;
          const strings$$18 = words$$1.slice(lm.index, acronym.length + 1);
          phrase = (0, _String.join)(" ", strings$$18);
          return (0, _Seq.append)((0, _Seq.singleton)([phrase, acronym]), (0, _Seq.delay)(function () {
            return (0, _Seq.singleton)([acronym, phrase]);
          }));
        } else {
          return (0, _Seq.empty)();
        }
      }, (matches));
    });
    acronymMap = (0, _Map.ofSeq)(elements$$3, {
      Compare: _Util.comparePrimitives
    });
  } else {
    acronymMap = (0, _Map.empty)({
      Compare: _Util.comparePrimitives
    });
  }

  return (0, _Encode.Auto$$$toString$$5A41365E)(4, acronymMap, undefined, undefined, undefined, {
    ResolveType() {
      return (0, _Reflection.class_type)("Microsoft.FSharp.Collections.FSharpMap`2", [_Reflection.string_type, _Reflection.string_type]);
    }

  });
}

function GetSelectCloze(nlpJsonOption$$3, sentenceCountOption, itemCountOption, doTrace, stringArrayJsonOption$$3, inputText$$3) {
  return (0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
    return GetAllCloze(nlpJsonOption$$3, stringArrayJsonOption$$3, inputText$$3).then(function (_arg1$$6) {
      var list$$14, count;

      if (_arg1$$6.tag === 1) {
        return Promise.resolve(new _Option.Result(1, "Error", _arg1$$6.fields[0]));
      } else {
        let sentenceCount$$1;

        if (sentenceCountOption == null) {
          let sentences$$1;
          sentences$$1 = (0, _Array.map)(function mapping$$21(x$$6) {
            return x$$6.sen;
          }, _arg1$$6.fields[0].sentences, Array);
          sentenceCount$$1 = EstimateDesiredSentences(sentences$$1);
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

        let patternInput$$1;
        let list$$9;
        let array$$40;
        let array$$39;
        let array$$37;
        let array$$36;
        let array$$34;
        let array$$33;
        array$$33 = (0, _Array.mapIndexed)(function mapping$$22(i$$15, s$$1) {
          return [s$$1, _arg1$$6.fields[0].clozables[i$$15]];
        }, _arg1$$6.fields[0].sentences, Array);
        array$$34 = array$$33.filter(function predicate$$11(tupledArg$$9) {
          let value$$13;
          value$$13 = (0, _RegExp.isMatch)(badSentenceRegex, tupledArg$$9[0].sen);
          return !value$$13;
        });
        array$$36 = (0, _Array.map)(function mapping$$23(tupledArg$$10) {
          return [tupledArg$$10[0], (RemoveOverlappingClozables(tupledArg$$10[1]))];
        }, array$$34, Array);
        array$$37 = (0, _Array.map)(function mapping$$24(tupledArg$$11) {
          return [tupledArg$$11[0], (tupledArg$$11[1].filter(function predicate$$12(cl$$6) {
            return cl$$6.words.length < 4;
          }))];
        }, array$$36, Array);
        array$$39 = array$$37.filter(function predicate$$13(tupledArg$$12) {
          return tupledArg$$12[1].length > 0;
        });
        array$$40 = (0, _Array.map)(function mapping$$25(tupledArg$$13) {
          return [tupledArg$$13[0], ((0, _Array.distinctBy)(function projection$$5(cl$$8) {
            return cl$$8.words;
          }, tupledArg$$13[1], {
            Equals($x$$33, $y$$34) {
              return (0, _Array.equalsWith)(_Util.comparePrimitives, $x$$33, $y$$34);
            },

            GetHashCode: _Util.structuralHash
          }))];
        }, array$$39, Array);
        list$$9 = (0, _Array.toList)(array$$40);
        patternInput$$1 = (0, _List.partition)(function predicate$$15(tupledArg$$14) {
          let chainsLengthTwoOrMore;
          let array$$42;
          array$$42 = (0, _Array.map)(function mapping$$26(id$$3) {
            return _arg1$$6.fields[0].coreference.clusters[id$$3];
          }, tupledArg$$14[0].cor.clusters, Array);
          chainsLengthTwoOrMore = array$$42.filter(function predicate$$14(c$$2) {
            return c$$2.length > 1;
          });
          return chainsLengthTwoOrMore.length > 2;
        }, list$$9);
        let clozeTuples;
        const hardFilterSentenceCount = (0, _List.length)(patternInput$$1[0]) | 0;

        if (hardFilterSentenceCount > sentenceCount$$1) {
          let list$$12;
          let list$$11;
          list$$11 = (0, _List.sortByDescending)(function projection$$6(tupledArg$$15) {
            return GetTotalWeight(_arg1$$6.fields[0].coreference, tupledArg$$15[0]) | 0;
          }, patternInput$$1[0], {
            Compare: _Util.comparePrimitives
          });
          list$$12 = (0, _List.take)(sentenceCount$$1, list$$11);
          clozeTuples = (0, _List.sortBy)(function projection$$7(tupledArg$$16) {
            return tupledArg$$16[0].id;
          }, list$$12, {
            Compare: _Util.comparePrimitives
          });
        } else {
          const list$$15 = (0, _List.append)(patternInput$$1[0], (list$$14 = ((0, _List.sortByDescending)(function projection$$8(tupledArg$$17) {
            return GetTotalWeight(_arg1$$6.fields[0].coreference, tupledArg$$17[0]) | 0;
          }, patternInput$$1[1], {
            Compare: _Util.comparePrimitives
          })), (count = sentenceCount$$1 - (0, _List.length)(patternInput$$1[0]) | 0, (0, _List.take)(count, list$$14))));
          clozeTuples = (0, _List.sortBy)(function projection$$9(tupledArg$$18) {
            return tupledArg$$18[0].id;
          }, list$$15, {
            Compare: _Util.comparePrimitives
          });
        }

        let clozeProbTuples;
        clozeProbTuples = (0, _List.map)(function mapping$$27(tupledArg$$19) {
          let sorted;
          let array$$44;
          array$$44 = (0, _Array.sortBy)(function projection$$10(cl$$9) {
            return cl$$9.prob;
          }, tupledArg$$19[1], {
            Compare: _Util.comparePrimitives
          });
          sorted = (0, _Array.toList)(array$$44);
          return [tupledArg$$19[0], (0, _List.head)(sorted), (0, _List.tail)(sorted)];
        }, clozeTuples);
        let restClozableMap;
        let elements$$4;
        let list$$21;
        let list$$20;
        let list$$19;
        list$$19 = (0, _List.collect)(function mapping$$29(tupledArg$$20) {
          return (0, _List.map)(function mapping$$28(c$$3) {
            return [tupledArg$$20[0], c$$3];
          }, tupledArg$$20[2]);
        }, clozeProbTuples);
        list$$20 = (0, _List.sortBy)(function projection$$11(tupledArg$$21) {
          return tupledArg$$21[1].prob;
        }, list$$19, {
          Compare: _Util.comparePrimitives
        });
        const count$$1 = itemCount$$1 - sentenceCount$$1 | 0;
        list$$21 = (0, _List.take)(count$$1, list$$20);
        elements$$4 = (0, _List.groupBy)(function projection$$12(tuple$$7) {
          return tuple$$7[0];
        }, list$$21, {
          Equals: _Util.equals,
          GetHashCode: _Util.structuralHash
        });
        restClozableMap = (0, _Map.ofList)(elements$$4, {
          Compare($x$$51, $y$$52) {
            return $x$$51.CompareTo($y$$52);
          }

        });
        let allClozableMap;
        let elements$$5;
        elements$$5 = (0, _List.map)(function mapping$$31(tupledArg$$22) {
          let cl$$11;
          const matchValue$$6 = (0, _Map.FSharpMap$$TryFind$$2B595)(restClozableMap, tupledArg$$22[0]);

          if (matchValue$$6 == null) {
            cl$$11 = new _Types.List();
          } else {
            const t$$3 = matchValue$$6;
            cl$$11 = (0, _List.map)(function mapping$$30(tuple$$8) {
              return tuple$$8[1];
            }, t$$3);
          }

          return [tupledArg$$22[0], new _Types.List(tupledArg$$22[1], cl$$11)];
        }, clozeProbTuples);
        allClozableMap = (0, _Map.ofList)(elements$$5, {
          Compare($x$$53, $y$$54) {
            return $x$$53.CompareTo($y$$54);
          }

        });
        let importantClozeMap;
        let elements$$6;
        let array$$50;
        let array$$49;
        let array$$47;
        let array$$46;
        let array$$45;
        array$$45 = (0, _Map.toArray)(allClozableMap);
        array$$46 = (0, _Array.sortByDescending)(function projection$$13(tupledArg$$23) {
          return GetTotalWeight(_arg1$$6.fields[0].coreference, tupledArg$$23[0]) | 0;
        }, array$$45, {
          Compare: _Util.comparePrimitives
        });
        array$$47 = (0, _Array.collect)(function mapping$$32(tupledArg$$24) {
          return (0, _Array.ofList)(tupledArg$$24[1], Array);
        }, array$$46, Array);
        array$$49 = (0, _Array.chunkBySize)(30, array$$47);
        array$$50 = (0, _Array.mapIndexed)(function mapping$$34(i$$16, cl$$13) {
          return (0, _Array.map)(function mapping$$33(cl$$14) {
            return [cl$$14, i$$16];
          }, cl$$13, Array);
        }, array$$49, Array);
        elements$$6 = (0, _Array.collect)(function mapping$$35(x$$7) {
          return x$$7;
        }, array$$50, Array);
        importantClozeMap = (0, _Map.ofArray)(elements$$6, {
          Compare($x$$57, $y$$58) {
            return $x$$57.CompareTo($y$$58);
          }

        });
        let input$$9;

        if (stringArrayJsonOption$$3 == null) {
          input$$9 = [inputText$$3];
        } else {
          const chunksJson = stringArrayJsonOption$$3;
          input$$9 = (0, _Decode.Auto$$$unsafeFromString$$Z5CB6BD)(chunksJson, undefined, undefined, {
            ResolveType() {
              return (0, _Reflection.array_type)(_Reflection.string_type);
            }

          });
        }

        let acronymMap$$1;
        let json$$10;
        let input$$10;
        input$$10 = (0, _String.join)(" ", input$$9);
        json$$10 = GetAcronymMap(input$$10);
        acronymMap$$1 = (0, _Decode.Auto$$$unsafeFromString$$Z5CB6BD)(json$$10, undefined, undefined, {
          ResolveType() {
            return (0, _Reflection.class_type)("Microsoft.FSharp.Collections.FSharpMap`2", [_Reflection.string_type, _Reflection.string_type]);
          }

        });
        const sentences$$2 = [];
        const clozes = [];
        (0, _Seq.iterate)(function action$$1(sa$$18) {
          const matchValue$$7 = (0, _Map.FSharpMap$$TryFind$$2B595)(allClozableMap, sa$$18);

          if (matchValue$$7 != null) {
            const clozables$$5 = matchValue$$7;
            void sentences$$2.push(new SentenceAPI(sa$$18.sen, (0, _Util.structuralHash)(sa$$18), true));
            (0, _Seq.iterate)(function action(cl$$15) {
              var arg0$$30;
              const patternInput$$2 = MakeItemWithTranformations(sa$$18, cl$$15);
              let tags$$3;
              let li;
              const list$$25 = (0, _List.append)(new _Types.List((arg0$$30 = (0, _Map.FSharpMap$$get_Item$$2B595)(importantClozeMap, cl$$15) | 0, (new Tag(0, "WeightGroup", arg0$$30))), patternInput$$2[2]), cl$$15.trace);
              li = (0, _List.choose)(function chooser$$4(t$$4) {
                switch (t$$4.tag) {
                  case 17:
                    {
                      return undefined;
                    }

                  case 16:
                    {
                      return undefined;
                    }

                  default:
                    {
                      return t$$4;
                    }
                }
              }, list$$25);
              tags$$3 = (0, _Util.createObj)(li, 1);
              let correctResponses;
              const matchValue$$8 = (0, _Map.FSharpMap$$TryFind$$2B595)(acronymMap$$1, patternInput$$2[1]);

              if (matchValue$$8 == null) {
                correctResponses = patternInput$$2[1];
              } else {
                const acronym$$1 = matchValue$$8;
                correctResponses = patternInput$$2[1] + "|" + acronym$$1;
              }

              void clozes.push(new ClozableAPI(patternInput$$2[0], (0, _Util.structuralHash)(sa$$18), (0, _Util.structuralHash)(patternInput$$2[0]), correctResponses, tags$$3));
            }, clozables$$5);
          } else {
            void sentences$$2.push(new SentenceAPI(sa$$18.sen, (0, _Util.structuralHash)(sa$$18), false));
          }
        }, _arg1$$6.fields[0].sentences);
        return Promise.resolve(new _Option.Result(0, "Ok", new ClozeAPI(sentences$$2.slice(), clozes.slice())));
      }
    });
  }));
}

function DoSimpleComputation(input$$11) {
  let strings$$20;
  let source$$30;
  const source$$29 = input$$11.split("");
  source$$30 = (0, _Seq.reverse)(source$$29);
  strings$$20 = source$$30;
  return (0, _String.join)("", strings$$20);
}