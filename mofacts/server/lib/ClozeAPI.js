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
exports.MofactsResponse0522$reflection = MofactsResponse0522$reflection;
exports.MofactsDisplay0522$reflection = MofactsDisplay0522$reflection;
exports.MofactsStim0522$reflection = MofactsStim0522$reflection;
exports.MofactsCluster0522$reflection = MofactsCluster0522$reflection;
exports.MofactsSetspec0522$reflection = MofactsSetspec0522$reflection;
exports.MofactsStimFile0522$reflection = MofactsStimFile0522$reflection;
exports.PublicApiToStimFile = PublicApiToStimFile;
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
exports.GetAllClozeForHumanEvaluation2021061121 = GetAllClozeForHumanEvaluation2021061121;
exports.RemoveOverlappingClozables = RemoveOverlappingClozables;
exports.se = se;
exports.nse = nse;
exports.MakeItemWithTranformations = MakeItemWithTranformations;
exports.MakeItem = MakeItem;
exports.GetAcronymMap = GetAcronymMap;
exports.GetSelectCloze = GetSelectCloze;
exports.GetSelectClozePercentage = GetSelectClozePercentage;
exports.DoSimpleComputation = DoSimpleComputation;
exports.badSentenceRegex = exports.MofactsStimFile0522 = exports.MofactsSetspec0522 = exports.MofactsCluster0522 = exports.MofactsStim0522 = exports.MofactsDisplay0522 = exports.MofactsResponse0522 = exports.InternalAPI = exports.Clozable = exports.Tag = exports.ClozeAPI = exports.ClozableAPI = exports.SentenceAPI = void 0;

var _Types = require("./fable-library.2.10.2/Types");

var _Reflection = require("./fable-library.2.10.2/Reflection");

var _Int = require("./fable-library.2.10.2/Int32");

var _AllenNLP = require("./AllenNLP");

var _Util = require("./fable-library.2.10.2/Util");

var _Seq = require("./fable-library.2.10.2/Seq");

var _Array = require("./fable-library.2.10.2/Array");

var _Decode = require("./Thoth.Json.4.0.0/Decode");

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

const SentenceAPI = (0, _Types.declare)(function ClozeAPI_SentenceAPI(sentence, clusterId, hasCloze) {
  this.sentence = sentence;
  this.clusterId = clusterId | 0;
  this.hasCloze = hasCloze;
}, _Types.Record);
exports.SentenceAPI = SentenceAPI;

function SentenceAPI$reflection() {
  return (0, _Reflection.record_type)("ClozeAPI.SentenceAPI", [], SentenceAPI, () => [["sentence", _Reflection.string_type], ["clusterId", _Reflection.int32_type], ["hasCloze", _Reflection.bool_type]]);
}

const ClozableAPI = (0, _Types.declare)(function ClozeAPI_ClozableAPI(cloze, clusterId, itemId, correctResponse, tags) {
  this.cloze = cloze;
  this.clusterId = clusterId | 0;
  this.itemId = itemId | 0;
  this.correctResponse = correctResponse;
  this.tags = tags;
}, _Types.Record);
exports.ClozableAPI = ClozableAPI;

function ClozableAPI$reflection() {
  return (0, _Reflection.record_type)("ClozeAPI.ClozableAPI", [], ClozableAPI, () => [["cloze", _Reflection.string_type], ["clusterId", _Reflection.int32_type], ["itemId", _Reflection.int32_type], ["correctResponse", _Reflection.string_type], ["tags", _Reflection.obj_type]]);
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
  return (0, _Reflection.union_type)("ClozeAPI.Tag", [], Tag, () => [["WeightGroup", [["Item", _Reflection.int32_type]]], ["OrderGroup", [["Item", _Reflection.int32_type]]], ["SyntacticRole", [["Item", _Reflection.string_type]]], ["SemanticRole", [["Item", _Reflection.string_type]]], ["RootDistance", [["Item", _Reflection.int32_type]]], ["StartDistance", [["Item", _Reflection.int32_type]]], ["CorefClusters", [["Item", _Reflection.int32_type]]], ["CorefClusterTotalWeight", [["Item", _Reflection.int32_type]]], ["CorefClusterBackwardWeight", [["Item", _Reflection.int32_type]]], ["CorefClusterForwardWeight", [["Item", _Reflection.int32_type]]], ["SentenceWeight", [["Item", _Reflection.int32_type]]], ["ClozeProbability", [["Item", _Reflection.float64_type]]], ["ClozeCorefTransformation", [["Item", _Reflection.string_type]]], ["CorrectResponseCorefTransformation", [["Item", _Reflection.string_type]]], ["ClozeParaphraseTransformation", [["Item", _Reflection.string_type]]], ["Transformations", [["Item", (0, _Reflection.list_type)(_Reflection.string_type)]]], ["ClusterId", [["Item", _Reflection.int32_type]]], ["StimulusId", [["Item", _Reflection.int32_type]]], ["Trace", [["Item", _Reflection.string_type]]], ["Deprecated", [["Item", _Reflection.string_type]]]]);
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
        return new Tag(19, "Deprecated", arg0$$4);
      }

    default:
      {
        const arg0$$5 = "Error:" + keyValue;
        return new Tag(18, "Trace", arg0$$5);
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

const MofactsResponse0522 = (0, _Types.declare)(function ClozeAPI_MofactsResponse0522(correctResponse) {
  this.correctResponse = correctResponse;
}, _Types.Record);
exports.MofactsResponse0522 = MofactsResponse0522;

function MofactsResponse0522$reflection() {
  return (0, _Reflection.record_type)("ClozeAPI.MofactsResponse0522", [], MofactsResponse0522, () => [["correctResponse", _Reflection.string_type]]);
}

const MofactsDisplay0522 = (0, _Types.declare)(function ClozeAPI_MofactsDisplay0522(clozeStimulus) {
  this.clozeStimulus = clozeStimulus;
}, _Types.Record);
exports.MofactsDisplay0522 = MofactsDisplay0522;

function MofactsDisplay0522$reflection() {
  return (0, _Reflection.record_type)("ClozeAPI.MofactsDisplay0522", [], MofactsDisplay0522, () => [["clozeStimulus", _Reflection.string_type]]);
}

const MofactsStim0522 = (0, _Types.declare)(function ClozeAPI_MofactsStim0522(response, display, parameter, tags) {
  this.response = response;
  this.display = display;
  this.parameter = parameter;
  this.tags = tags;
}, _Types.Record);
exports.MofactsStim0522 = MofactsStim0522;

function MofactsStim0522$reflection() {
  return (0, _Reflection.record_type)("ClozeAPI.MofactsStim0522", [], MofactsStim0522, () => [["response", MofactsResponse0522$reflection()], ["display", MofactsDisplay0522$reflection()], ["parameter", _Reflection.string_type], ["tags", _Reflection.obj_type]]);
}

const MofactsCluster0522 = (0, _Types.declare)(function ClozeAPI_MofactsCluster0522(stims) {
  this.stims = stims;
}, _Types.Record);
exports.MofactsCluster0522 = MofactsCluster0522;

function MofactsCluster0522$reflection() {
  return (0, _Reflection.record_type)("ClozeAPI.MofactsCluster0522", [], MofactsCluster0522, () => [["stims", (0, _Reflection.array_type)(MofactsStim0522$reflection())]]);
}

const MofactsSetspec0522 = (0, _Types.declare)(function ClozeAPI_MofactsSetspec0522(clusters) {
  this.clusters = clusters;
}, _Types.Record);
exports.MofactsSetspec0522 = MofactsSetspec0522;

function MofactsSetspec0522$reflection() {
  return (0, _Reflection.record_type)("ClozeAPI.MofactsSetspec0522", [], MofactsSetspec0522, () => [["clusters", (0, _Reflection.array_type)(MofactsCluster0522$reflection())]]);
}

const MofactsStimFile0522 = (0, _Types.declare)(function ClozeAPI_MofactsStimFile0522(setspec) {
  this.setspec = setspec;
}, _Types.Record);
exports.MofactsStimFile0522 = MofactsStimFile0522;

function MofactsStimFile0522$reflection() {
  return (0, _Reflection.record_type)("ClozeAPI.MofactsStimFile0522", [], MofactsStimFile0522, () => [["setspec", MofactsSetspec0522$reflection()]]);
}

function PublicApiToStimFile(pa) {
  const stimFromClozableAPI = function stimFromClozableAPI(i, display, response, addTags, deleteTags) {
    var obj;
    const newTags = new Map(Object.entries(i.tags));
    (0, _Util.addToDict)(newTags, "stimulusId", (obj = display + ":" + response, ((0, _Util.structuralHash)(obj))));
    (0, _Util.addToDict)(newTags, "clusterId", i.clusterId);
    (0, _Seq.iterate)(function (forLoopVar) {
      if (newTags.has(forLoopVar[0])) {
        newTags.set(forLoopVar[0], forLoopVar[1]);
      } else {
        const value$$4 = (0, _Util.addToDict)(newTags, forLoopVar[0], forLoopVar[1]);
        void null;
      }
    }, addTags);

    for (let idx = 0; idx <= deleteTags.length - 1; idx++) {
      const k$$1 = deleteTags[idx];
      const value$$5 = newTags.delete(k$$1);
      void value$$5;
    }

    return new MofactsStim0522(new MofactsResponse0522(response), new MofactsDisplay0522(display), "0,.70", (Object.fromEntries(newTags)));
  };

  let clusters;
  clusters = (0, _Array.groupBy)(function projection(i$$1) {
    return i$$1.clusterId;
  }, pa.clozes, Array, {
    Equals($x$$1, $y$$2) {
      return $x$$1 === $y$$2;
    },

    GetHashCode: _Util.structuralHash
  });
  let clusterRecords;
  clusterRecords = (0, _Array.map)(function mapping$$1(tupledArg) {
    let stims;
    stims = (0, _Array.collect)(function mapping(i$$2) {
      const temp = [];

      if (!(0, _Util.equals)(i$$2.tags.clozeCorefTransformation, null)) {
        let coref;
        const arg10 = i$$2.tags.clozeCorefTransformation;
        const arg20 = i$$2.tags.correctResponseCorefTransformation;
        const arg30 = [["transformation", "coreference"]];
        const arg40 = ["clozeCorefTransformation", "clozeParaphraseTransformation", "correctResponseCorefTransformation"];
        const clo1 = (0, _Util.partialApply)(4, stimFromClozableAPI, [i$$2]);
        const clo2 = clo1(arg10);
        const clo3 = clo2(arg20);
        const clo4 = clo3(arg30);
        coref = clo4(arg40);
        void temp.push(coref);
      } else {
        let cloze;
        const arg30$$1 = [["transformation", "none"]];
        const arg40$$1 = ["clozeCorefTransformation", "clozeParaphraseTransformation", "correctResponseCorefTransformation"];
        const clo1$$1 = (0, _Util.partialApply)(4, stimFromClozableAPI, [i$$2]);
        const clo2$$1 = clo1$$1(i$$2.cloze);
        const clo3$$1 = clo2$$1(i$$2.correctResponse);
        const clo4$$1 = clo3$$1(arg30$$1);
        cloze = clo4$$1(arg40$$1);
        void temp.push(cloze);

        if (!(0, _Util.equals)(i$$2.tags.clozeParaphraseTransformation, null)) {
          let paraphrase;
          const arg10$$2 = i$$2.tags.clozeParaphraseTransformation;
          const arg30$$2 = [["transformation", "paraphrase"]];
          const arg40$$2 = ["clozeCorefTransformation", "clozeParaphraseTransformation", "correctResponseCorefTransformation"];
          const clo1$$2 = (0, _Util.partialApply)(4, stimFromClozableAPI, [i$$2]);
          const clo2$$2 = clo1$$2(arg10$$2);
          const clo3$$2 = clo2$$2(i$$2.correctResponse);
          const clo4$$2 = clo3$$2(arg30$$2);
          paraphrase = clo4$$2(arg40$$2);
          void temp.push(paraphrase);
        } else {
          void null;
        }
      }

      return temp.slice();
    }, tupledArg[1], Array);
    return new MofactsCluster0522(stims);
  }, clusters, Array);
  return new MofactsStimFile0522(new MofactsSetspec0522(clusterRecords));
}

function EstimateDesiredSentences(sentences) {
  let wordCount;
  let value$$6;
  value$$6 = (0, _Seq.sumBy)(function projection$$1(sentence) {
    return sentence.split(" ").length;
  }, sentences, {
    GetZero() {
      return 0;
    },

    Add($x$$3, $y$$4) {
      return $x$$3 + $y$$4;
    }

  });
  wordCount = value$$6;
  let desiredSentences;
  const value$$7 = wordCount / 1000 * 12;
  desiredSentences = ~~value$$7;
  return desiredSentences | 0;
}

function EstimateDesiredItems(desiredSentences$$1) {
  let desiredItems;
  const value$$9 = (desiredSentences$$1) * 1.3;
  desiredItems = ~~value$$9;
  return desiredItems | 0;
}

function EstimateDesiredSentencesFromPercentage(nlpJson, percentage) {
  var value$$10;
  let da;
  da = (0, _Decode.Auto$$$unsafeFromString$$Z5CB6BD)(nlpJson, undefined, undefined, {
    ResolveType() {
      return (0, _AllenNLP.DocumentAnnotation$reflection)();
    }

  });
  const desiredSentences$$2 = (value$$10 = da.sentences.length | 0, (value$$10)) * percentage;
  return ~~desiredSentences$$2 | 0;
}

function GetTotalWeight(coref$$1, sen) {
  let totalWeight;
  let array$$4;
  array$$4 = (0, _Array.distinct)(sen.cor.clusters, {
    Equals($x$$5, $y$$6) {
      return $x$$5 === $y$$6;
    },

    GetHashCode: _Util.structuralHash
  });
  totalWeight = (0, _Array.sumBy)(function projection$$2(id) {
    return coref$$1.clusters[id].length;
  }, array$$4, {
    GetZero() {
      return 0;
    },

    Add($x$$7, $y$$8) {
      return $x$$7 + $y$$8;
    }

  });
  return totalWeight | 0;
}

function getFeatureDistanceFromRoot(start, stop, sen$$1) {
  let maxDistance;
  let source$$2;
  const source$$1 = (0, _Array.ofSeq)((0, _Seq.rangeNumber)(start, 1, stop), Int32Array);
  source$$2 = (0, _Seq.map)(function mapping$$2(i$$4) {
    let distance = 0;
    let i$$3 = i$$4 | 0;

    while ((i$$3 > -1 ? sen$$1.dep.predicted_heads[i$$3] !== 0 : false) ? distance < sen$$1.dep.predicted_heads.length : false) {
      i$$3 = sen$$1.dep.predicted_heads[i$$3] - 1;
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
  let clusters$$1;
  clusters$$1 = (0, _Array.distinct)(sen$$2.cor.clusters, {
    Equals($x$$11, $y$$12) {
      return $x$$11 === $y$$12;
    },

    GetHashCode: _Util.structuralHash
  });
  const arg0$$8 = clusters$$1.length | 0;
  return new Tag(6, "CorefClusters", arg0$$8);
}

function getFeatureCorefClusterTotalWeight(sen$$3, da$$1) {
  const totalWeight$$1 = GetTotalWeight(da$$1.coreference, sen$$3) | 0;
  return new Tag(7, "CorefClusterTotalWeight", totalWeight$$1);
}

function getFeatureCorefClusterBackwardWeight(sen$$4, da$$2) {
  let weight;
  let array$$9;
  let array$$8;
  let array$$7;
  array$$7 = (0, _Array.distinct)(sen$$4.cor.clusters, {
    Equals($x$$13, $y$$14) {
      return $x$$13 === $y$$14;
    },

    GetHashCode: _Util.structuralHash
  });
  array$$8 = (0, _Array.collect)(function mapping$$3(id$$1) {
    return da$$2.coreference.clusters[id$$1];
  }, array$$7, Array);
  array$$9 = array$$8.filter(function predicate(c) {
    return c[1] < sen$$4.cor.offset;
  });
  weight = array$$9.length;
  return new Tag(8, "CorefClusterBackwardWeight", weight);
}

function getFeatureCorefClusterForwardWeight(sen$$5, da$$3) {
  let weight$$1;
  let array$$13;
  let array$$12;
  let array$$11;
  array$$11 = (0, _Array.distinct)(sen$$5.cor.clusters, {
    Equals($x$$15, $y$$16) {
      return $x$$15 === $y$$16;
    },

    GetHashCode: _Util.structuralHash
  });
  array$$12 = (0, _Array.collect)(function mapping$$4(id$$2) {
    return da$$3.coreference.clusters[id$$2];
  }, array$$11, Array);
  array$$13 = array$$12.filter(function predicate$$1(c$$1) {
    return c$$1[0] > sen$$5.cor.offset + sen$$5.srl.words.length;
  });
  weight$$1 = array$$13.length;
  return new Tag(9, "CorefClusterForwardWeight", weight$$1);
}

function GetModifiedNPClozable(sa, startInit, stopInit, head, traceInit) {
  var arg0$$12, array$$15, value$$12, array$$21, array$$23;
  const trace = [];
  (0, _Array.addRangeInPlace)(traceInit, trace);
  void trace.push(getFeatureDistanceFromRoot(startInit, stopInit, sa));
  void trace.push(getFeatureDistanceFromStart(startInit));

  if (startInit < 0 ? true : stopInit >= sa.srl.words.length) {
    void trace.push((arg0$$12 = "CRITICAL: invalid clozable parameters for " + ((0, _Encode.Auto$$$toString$$5A41365E)(4, sa, undefined, undefined, undefined, {
      ResolveType() {
        return (0, _AllenNLP.SentenceAnnotation$reflection)();
      }

    })), (new Tag(18, "Trace", arg0$$12))));
    return new Clozable(new Array(0), 0, 0, ((0, _List.ofSeq)(trace)), 1, (array$$15 = ((0, _Array.map)(StringToTag, sa.tags, Array)), ((0, _Array.toList)(array$$15))));
  } else {
    let h$$3;

    if (head == null) {
      let stanfordHead;
      let tuple;
      let source$$5;
      const source$$4 = (0, _Array.ofSeq)((0, _Seq.rangeNumber)(startInit, 1, stopInit), Int32Array);
      source$$5 = (0, _Seq.map)(function mapping$$5(i$$5) {
        return [i$$5, sa.dep.predicted_heads[i$$5]];
      }, source$$4);
      tuple = (0, _Seq.find)(function predicate$$2(tupledArg$$1) {
        if (tupledArg$$1[1] < startInit + 1) {
          return true;
        } else {
          return tupledArg$$1[1] > stopInit + 1;
        }
      }, source$$5);
      stanfordHead = tuple[0];

      if (value$$12 = sa.dep.pos[stanfordHead].indexOf("NN") === 0, (!value$$12)) {
        void trace.push((new Tag(18, "Trace", "head is not nominal")));
        let argOption;
        let source$$7;
        const source$$6 = (0, _Array.ofSeq)((0, _Seq.rangeNumber)(startInit, 1, stopInit), Int32Array);
        source$$7 = (0, _Seq.map)(function mapping$$6(i$$6) {
          return [i$$6, sa.dep.predicted_dependencies[i$$6]];
        }, source$$6);
        argOption = (0, _Seq.tryFind)(function predicate$$3(tupledArg$$2) {
          if (tupledArg$$2[1].indexOf("subj") >= 0) {
            return true;
          } else {
            return tupledArg$$2[1].indexOf("obj") >= 0;
          }
        }, source$$7);
        let nnOption;
        let source$$10;
        let source$$9;
        const source$$8 = (0, _Array.ofSeq)((0, _Seq.rangeNumber)(startInit, 1, stopInit), Int32Array);
        source$$9 = (0, _Seq.map)(function mapping$$7(i$$7) {
          return [i$$7, sa.dep.pos[i$$7]];
        }, source$$8);
        source$$10 = (0, _Seq.reverse)(source$$9);
        nnOption = (0, _Seq.tryFind)(function predicate$$4(tupledArg$$3) {
          return tupledArg$$3[1].indexOf("NN") === 0;
        }, source$$10);

        if (argOption != null) {
          const arg = argOption;
          void trace.push((new Tag(18, "Trace", "WARNING: using first syntactic arg as pseudohead")));
          h$$3 = arg[0];
        } else if (nnOption != null) {
          const nn = nnOption;
          void trace.push((new Tag(18, "Trace", "WARNING: using last nominal as pseudohead")));
          h$$3 = nn[0];
        } else {
          void trace.push((new Tag(18, "Trace", "CRITICAL: clozable without nominal or arg, defaulting to given span")));
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
    let array$$18;
    let array$$17;
    const array$$16 = (0, _Array.ofSeq)((0, _Seq.rangeNumber)(startInit, 1, h$$3), Int32Array);
    array$$17 = (0, _Array.reverse)(array$$16, Int32Array);
    array$$18 = (0, _Array.takeWhile)(function predicate$$5(i$$8) {
      if (sa.dep.pos[i$$8].indexOf("N") === 0) {
        return true;
      } else {
        return sa.dep.pos[i$$8] === "JJ";
      }
    }, array$$17, Int32Array);
    indices = (0, _Array.reverse)(array$$18, Int32Array);
    let patternInput;

    if (indices.length !== 0) {
      const start$$2 = indices[0] | 0;
      let stop$$1;
      stop$$1 = (0, _Array.last)(indices);
      patternInput = [start$$2, stop$$1, sa.srl.words.slice(start$$2, stop$$1 + 1)];
    } else {
      void trace.push((new Tag(18, "Trace", "CRITICAL: stanford head yields empty span, defaulting to given span")));
      patternInput = [startInit, stopInit, sa.srl.words.slice(startInit, stopInit + 1)];
    }

    const clozable = new Clozable(patternInput[2], patternInput[0], patternInput[1], ((0, _List.ofSeq)(trace)), (array$$21 = ((0, _Array.map)(_WordFrequency.Get, patternInput[2], Float64Array)), ((0, _Array.min)(array$$21, {
      Compare: _Util.comparePrimitives
    }))), (array$$23 = ((0, _Array.map)(StringToTag, sa.tags, Array)), ((0, _Array.toList)(array$$23))));
    return clozable;
  }
}

function GetClozables(da$$4) {
  let corefresolvedSentences;
  corefresolvedSentences = (0, _AllenNLP.resolveReferents)(da$$4);
  return (0, _Array.map)(function mapping$$14(sa$$1) {
    var source$$16, source$$15, source$$14, arg0$$26, arg0$$27, arg0$$28, arg0$$29;
    const clozable$$1 = [];
    (0, _Array.addRangeInPlace)(((0, _Seq.mapIndexed)(function mapping$$8(i$$9, si) {
      return GetModifiedNPClozable(sa$$1, si[0], si[1], undefined, [(new Tag(18, "Trace", "coref")), getFeatureCorefClusters(sa$$1), getFeatureCorefClusterTotalWeight(sa$$1, da$$4), getFeatureCorefClusterBackwardWeight(sa$$1, da$$4), getFeatureCorefClusterForwardWeight(sa$$1, da$$4)]);
    }, sa$$1.cor.spans)), clozable$$1);
    (0, _Array.addRangeInPlace)((source$$16 = (source$$15 = (source$$14 = ((0, _Seq.mapIndexed)(function mapping$$9(i$$10, x$$3) {
      return [i$$10, x$$3];
    }, sa$$1.dep.predicted_dependencies)), ((0, _Seq.filter)(function predicate$$6(tupledArg$$4) {
      if (tupledArg$$4[1].indexOf("obj") >= 0 ? true : tupledArg$$4[1].indexOf("subj") >= 0) {
        return true;
      } else {
        return tupledArg$$4[1].indexOf("root") >= 0;
      }
    }, source$$14))), ((0, _Seq.filter)(function predicate$$7(tupledArg$$5) {
      return sa$$1.dep.pos[tupledArg$$5[0]].indexOf("N") === 0;
    }, source$$15))), ((0, _Seq.map)(function mapping$$10(tupledArg$$6) {
      return GetModifiedNPClozable(sa$$1, tupledArg$$6[0], tupledArg$$6[0], (tupledArg$$6[0]), [(new Tag(18, "Trace", "dep")), (new Tag(18, "Trace", tupledArg$$6[1])), (new Tag(2, "SyntacticRole", tupledArg$$6[1]))]);
    }, source$$16))), clozable$$1);
    (0, _Array.addRangeInPlace)(((0, _Seq.collect)(function mapping$$13(pred) {
      let source$$22;
      let source$$19;
      let source$$18;
      source$$18 = (0, _Seq.mapIndexed)(function mapping$$11(i$$14, t) {
        return [i$$14, t];
      }, pred.tags);
      source$$19 = (0, _Seq.filter)(function predicate$$8(tupledArg$$7) {
        return tupledArg$$7[1].indexOf("ARG") >= 0;
      }, source$$18);
      source$$22 = (0, _Map.groupBy)(function projection$$3(tupledArg$$8) {
        return (0, _String.substring)(tupledArg$$8[1], 2);
      }, source$$19, {
        Equals($x$$19, $y$$20) {
          return $x$$19 === $y$$20;
        },

        GetHashCode: _Util.structuralHash
      });
      return (0, _Seq.map)(function mapping$$12(tupledArg$$9) {
        let start$$4;
        let tuple$$4;
        tuple$$4 = (0, _Seq.minBy)(function projection$$4(tuple$$3) {
          return tuple$$3[0];
        }, tupledArg$$9[1], {
          Compare: _Util.comparePrimitives
        });
        start$$4 = tuple$$4[0];
        let stop$$3;
        let tuple$$6;
        tuple$$6 = (0, _Seq.maxBy)(function projection$$5(tuple$$5) {
          return tuple$$5[0];
        }, tupledArg$$9[1], {
          Compare: _Util.comparePrimitives
        });
        stop$$3 = tuple$$6[0];
        return GetModifiedNPClozable(sa$$1, start$$4, stop$$3, undefined, [(new Tag(18, "Trace", "srl")), (new Tag(18, "Trace", pred.description)), (new Tag(3, "SemanticRole", tupledArg$$9[0]))]);
      }, source$$22);
    }, sa$$1.srl.verbs)), clozable$$1);

    for (let i$$15 = 0; i$$15 <= clozable$$1.length - 1; i$$15++) {
      const tags = Array.from(clozable$$1[i$$15].tags);
      void tags.push((arg0$$26 = (GetTotalWeight(da$$4.coreference, sa$$1)) | 0, (new Tag(10, "SentenceWeight", arg0$$26))));
      void tags.push((arg0$$27 = clozable$$1[i$$15].prob, (new Tag(11, "ClozeProbability", arg0$$27))));
      void tags.push((arg0$$28 = corefresolvedSentences[sa$$1.id], (new Tag(12, "ClozeCorefTransformation", arg0$$28))));
      void tags.push((arg0$$29 = ((0, _Paraphrase.getCachedParaphrase)(sa$$1.sen)), (new Tag(14, "ClozeParaphraseTransformation", arg0$$29))));
      const inputRecord = clozable$$1[i$$15];
      let tags$$1;
      tags$$1 = (0, _List.ofSeq)(tags);
      clozable$$1[i$$15] = new Clozable(inputRecord.words, inputRecord.start, inputRecord.stop, inputRecord.trace, inputRecord.prob, tags$$1);
    }

    let arg00$$3;
    arg00$$3 = (0, _Seq.filter)(function predicate$$9(c$$2) {
      return !(0, _Array.equalsWith)(_Util.comparePrimitives, c$$2.words, ["."]);
    }, clozable$$1);
    return Array.from(arg00$$3);
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

    })), ((0, _AllenNLP.Promisify)(input))))).then(function (_arg1$$3) {
      if (_arg1$$3.tag === 1) {
        return Promise.resolve(new _Option.Result(1, "Error", _arg1$$3.fields[0]));
      } else {
        let clozables;
        let array$$25;
        array$$25 = GetClozables(_arg1$$3.fields[0]);
        clozables = (0, _Array.map)(function mapping$$15(ra) {
          return ra.slice();
        }, array$$25, Array);
        return Promise.resolve(new _Option.Result(0, "Ok", new InternalAPI(_arg1$$3.fields[0].sentences, _arg1$$3.fields[0].coreference, clozables)));
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

    })), ((0, _AllenNLP.Promisify)(input$$1))))).then(function (_arg1$$4) {
      if (_arg1$$4.tag === 1) {
        return Promise.resolve(new _Option.Result(1, "Error", _arg1$$4.fields[0]));
      } else {
        let clozables$$1;
        let array$$26;
        array$$26 = GetClozables(_arg1$$4.fields[0]);
        clozables$$1 = (0, _Array.map)(function mapping$$16(ra$$1) {
          return ra$$1.slice();
        }, array$$26, Array);
        let output;
        output = (0, _Array.mapIndexed)(function mapping$$18(i$$16, sa$$2) {
          let totalWeight$$2;
          totalWeight$$2 = GetTotalWeight(_arg1$$4.fields[0].coreference, sa$$2);
          const array$$27 = clozables$$1[i$$16];
          return (0, _Array.map)(function mapping$$17(cl) {
            let cloze$$1;
            cloze$$1 = (0, _String.join)(" ", cl.words);
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
              const matchValue$$2 = (0, _Map.FSharpMap$$TryFind$$2B595)(diffMap, cloze$$1);

              if (matchValue$$2 == null) {
                crCloze = cloze$$1;
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
          }, array$$27, Array);
        }, _arg1$$4.fields[0].sentences, Array);
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

    })), ((0, _AllenNLP.Promisify)(input$$3))))).then(function (_arg1$$5) {
      if (_arg1$$5.tag === 1) {
        return Promise.resolve(new _Option.Result(1, "Error", _arg1$$5.fields[0]));
      } else {
        let clozables$$2;
        let array$$29;
        array$$29 = GetClozables(_arg1$$5.fields[0]);
        clozables$$2 = (0, _Array.map)(function mapping$$19(ra$$2) {
          return ra$$2.slice();
        }, array$$29, Array);
        let output$$1;
        output$$1 = (0, _Array.mapIndexed)(function mapping$$21(i$$17, sa$$3) {
          let totalWeight$$3;
          totalWeight$$3 = GetTotalWeight(_arg1$$5.fields[0].coreference, sa$$3);
          const array$$30 = clozables$$2[i$$17];
          return (0, _Array.map)(function mapping$$20(cl$$1) {
            let cloze$$2;
            cloze$$2 = (0, _String.join)(" ", cl$$1.words);
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
              const matchValue$$3 = (0, _Map.FSharpMap$$TryFind$$2B595)(diffMap$$1, cloze$$2);

              if (matchValue$$3 == null) {
                crCloze$$1 = cloze$$2;
              } else {
                const diffCloze$$1 = matchValue$$3;
                crCloze$$1 = diffCloze$$1;
              }

              if (sentence$$3 !== cr$$1) {
                const clusterId = (0, _Util.structuralHash)(sa$$3) | 0;
                const itemId = (0, _Util.structuralHash)(cloze$$2) | 0;
                return (0, _Types.anonRecord)({
                  Cloze: crCloze$$1,
                  OriginalSentence: sentence$$3,
                  Sentence: cr$$1,
                  Tags: (0, _List.append)(cl$$1.tags, cl$$1.trace),
                  clusterId: clusterId,
                  itemId: itemId
                });
              } else {
                let Cloze$$2;
                Cloze$$2 = (0, _String.join)(" ", cl$$1.words);
                const clusterId$$1 = (0, _Util.structuralHash)(sa$$3) | 0;
                const itemId$$1 = (0, _Util.structuralHash)(cloze$$2) | 0;
                return (0, _Types.anonRecord)({
                  Cloze: Cloze$$2,
                  OriginalSentence: sentence$$3,
                  Sentence: sentence$$3,
                  Tags: (0, _List.append)(cl$$1.tags, cl$$1.trace),
                  clusterId: clusterId$$1,
                  itemId: itemId$$1
                });
              }
            } else {
              let Cloze$$3;
              Cloze$$3 = (0, _String.join)(" ", cl$$1.words);
              const clusterId$$2 = (0, _Util.structuralHash)(sa$$3) | 0;
              const itemId$$2 = (0, _Util.structuralHash)(cloze$$2) | 0;
              return (0, _Types.anonRecord)({
                Cloze: Cloze$$3,
                OriginalSentence: sentence$$3,
                Sentence: sentence$$3,
                Tags: (0, _List.append)(cl$$1.tags, cl$$1.trace),
                clusterId: clusterId$$2,
                itemId: itemId$$2
              });
            }
          }, array$$30, Array);
        }, _arg1$$5.fields[0].sentences, Array);
        return Promise.resolve(new _Option.Result(0, "Ok", output$$1));
      }
    });
  }));
}

function GetAllClozeForHumanEvaluation2021061121(nlpJsonOption$$3, stringArrayJsonOption$$3, inputText$$3) {
  return (0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
    var nlpJson$$4, input$$5;
    return (nlpJsonOption$$3 == null ? (0, _AllenNLP.GetNLP)(stringArrayJsonOption$$3, inputText$$3) : (nlpJson$$4 = nlpJsonOption$$3, (input$$5 = ((0, _Decode.Auto$$$unsafeFromString$$Z5CB6BD)(nlpJson$$4, undefined, undefined, {
      ResolveType() {
        return (0, _AllenNLP.DocumentAnnotation$reflection)();
      }

    })), ((0, _AllenNLP.Promisify)(input$$5))))).then(function (_arg1$$6) {
      if (_arg1$$6.tag === 1) {
        return Promise.resolve(new _Option.Result(1, "Error", _arg1$$6.fields[0]));
      } else {
        let clozables$$3;
        let array$$32;
        array$$32 = GetClozables(_arg1$$6.fields[0]);
        clozables$$3 = (0, _Array.map)(function mapping$$22(ra$$3) {
          return ra$$3.slice();
        }, array$$32, Array);
        let output$$2;
        output$$2 = (0, _Array.mapIndexed)(function mapping$$25(i$$18, sa$$4) {
          let totalWeight$$4;
          totalWeight$$4 = GetTotalWeight(_arg1$$6.fields[0].coreference, sa$$4);
          let chainsLengthTwoOrMore;
          let array$$35;
          let array$$34;
          array$$34 = (0, _Array.map)(function mapping$$23(id$$3) {
            return _arg1$$6.fields[0].coreference.clusters[id$$3];
          }, sa$$4.cor.clusters, Array);
          array$$35 = array$$34.filter(function predicate$$10(c$$3) {
            return c$$3.length > 1;
          });
          chainsLengthTwoOrMore = array$$35.length;
          const array$$36 = clozables$$3[i$$18];
          return (0, _Array.map)(function mapping$$24(cl$$2) {
            let cloze$$3;
            cloze$$3 = (0, _String.join)(" ", cl$$2.words);
            let sentence$$4;
            sentence$$4 = (0, _AllenNLP.removePrePunctuationSpaces)(sa$$4.sen);
            const clusterId$$3 = (0, _Util.structuralHash)(sa$$4) | 0;
            const itemId$$3 = (0, _Util.structuralHash)(cloze$$3) | 0;
            return (0, _Types.anonRecord)({
              Chains: chainsLengthTwoOrMore,
              Cloze: cloze$$3,
              ClozeProbability: cl$$2.prob,
              ClozeStart: cl$$2.start,
              ClozeStop: cl$$2.stop,
              OriginalSentence: sentence$$4,
              Sentence: sentence$$4,
              SentenceIndex: i$$18,
              SentenceWeight: totalWeight$$4,
              Tags: (0, _List.append)(cl$$2.tags, cl$$2.trace),
              clusterId: clusterId$$3,
              itemId: itemId$$3
            });
          }, array$$36, Array);
        }, _arg1$$6.fields[0].sentences, Array);
        return Promise.resolve(new _Option.Result(0, "Ok", output$$2));
      }
    });
  }));
}

function RemoveOverlappingClozables(clozables$$4) {
  const clozablesOut = Array.from((clozables$$4.filter(function predicate$$11(cl$$3) {
    return cl$$3.words.length < 4;
  })));

  for (let ci = 0; ci <= clozables$$4.length - 1; ci++) {
    for (let cj = ci; cj <= clozables$$4.length - 1; cj++) {
      const overlap = (ci !== cj ? clozables$$4[ci].start <= clozables$$4[cj].stop : false) ? clozables$$4[cj].start <= clozables$$4[ci].stop : false;

      if (overlap ? clozables$$4[ci].stop - clozables$$4[ci].start >= clozables$$4[cj].stop - clozables$$4[cj].start : false) {
        const value$$13 = (0, _Array.removeInPlace)(clozables$$4[cj], clozablesOut);
        void value$$13;
      } else if (overlap) {
        const value$$14 = (0, _Array.removeInPlace)(clozables$$4[ci], clozablesOut);
        void value$$14;
      } else {
        void null;
      }
    }
  }

  return clozablesOut.slice();
}

function se(text1, text2) {
  return (0, _String.replace)(text1, " ", "") === (0, _String.replace)(text2, " ", "");
}

function nse(text1$$1, text2$$1) {
  return (0, _String.replace)(text1$$1, " ", "") !== (0, _String.replace)(text2$$1, " ", "");
}

function MakeItemWithTranformations(sa$$5, cl$$4) {
  let blank;
  const strings$$11 = (0, _Array.ofSeq)((0, _Seq.delay)(function () {
    return (0, _Seq.map)(function (_) {
      return "__________";
    }, (0, _Seq.rangeNumber)(cl$$4.start, 1, cl$$4.stop));
  }), Array);
  blank = (0, _String.join)(" ", strings$$11);
  let sentence$$5;
  const strings$$12 = (0, _Array.copy)(sa$$5.srl.words, Array);
  sentence$$5 = (0, _String.join)(" ", strings$$12);
  let cloze$$4;
  cloze$$4 = (0, _String.join)(" ", cl$$4.words);
  let item;
  const input$$7 = (0, _RegExp.replace)(sentence$$5, "\\b" + cloze$$4 + "\\b", blank);
  item = (0, _AllenNLP.removePrePunctuationSpaces)(input$$7);
  let crOption$$2;
  let list$$5;
  list$$5 = (0, _List.choose)(function chooser$$2(_arg1$$7) {
    if (_arg1$$7.tag === 12) {
      return _arg1$$7.fields[0];
    } else {
      return undefined;
    }
  }, cl$$4.tags);
  crOption$$2 = (0, _List.tryHead)(list$$5);
  let paOption;
  let list$$7;
  list$$7 = (0, _List.choose)(function chooser$$3(_arg2$$4) {
    if (_arg2$$4.tag === 14) {
      return _arg2$$4.fields[0];
    } else {
      return undefined;
    }
  }, cl$$4.tags);
  paOption = (0, _List.tryHead)(list$$7);
  let tags$$2;
  tags$$2 = (0, _List.filter)(function predicate$$12(_arg3$$1) {
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
  }, cl$$4.tags);
  var $target$$167, cr$$2, pa$$1;

  if (crOption$$2 != null) {
    if (paOption != null) {
      $target$$167 = 0;
      cr$$2 = crOption$$2;
      pa$$1 = paOption;
    } else {
      $target$$167 = 1;
    }
  } else {
    $target$$167 = 1;
  }

  switch ($target$$167) {
    case 0:
      {
        const paItem = (0, _RegExp.replace)(pa$$1, "\\b" + cloze$$4 + "\\b", blank);
        const diffList$$2 = diff.diffWords(sa$$5.sen, cr$$2, (0, _Types.anonRecord)({
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
        const matchValue$$5 = (0, _Map.FSharpMap$$TryFind$$2B595)(diffMap$$2, cloze$$4);

        if (matchValue$$5 == null) {
          crCloze$$2 = cloze$$4;
        } else {
          const diffCloze$$2 = matchValue$$5;
          crCloze$$2 = diffCloze$$2;
        }

        const crItem = (0, _RegExp.replace)(cr$$2, "\\b" + crCloze$$2 + "\\b", blank);
        let tempTags;
        tempTags = Array.from(tags$$2);

        if (nse(cr$$2, sa$$5.sen) ? nse(cr$$2, crItem) : false) {
          void tempTags.push(new Tag(12, "ClozeCorefTransformation", crItem));
          void tempTags.push(new Tag(13, "CorrectResponseCorefTransformation", crCloze$$2));
        } else {
          void null;
        }

        if (nse(pa$$1, sa$$5.sen) ? nse(pa$$1, paItem) : false) {
          void tempTags.push(new Tag(14, "ClozeParaphraseTransformation", paItem));
        } else {
          void null;
        }

        return [item, cloze$$4, ((0, _List.ofSeq)(tempTags))];
      }

    case 1:
      {
        return [item, cloze$$4, tags$$2];
      }
  }
}

function MakeItem(sa$$6, cl$$5) {
  let blank$$1;
  const strings$$16 = (0, _Array.ofSeq)((0, _Seq.delay)(function () {
    return (0, _Seq.map)(function (_$$1) {
      return "__________";
    }, (0, _Seq.rangeNumber)(cl$$5.start, 1, cl$$5.stop));
  }), Array);
  blank$$1 = (0, _String.join)(" ", strings$$16);
  let sentence$$6;
  const strings$$17 = (0, _Array.copy)(sa$$6.srl.words, Array);
  sentence$$6 = (0, _String.join)(" ", strings$$17);
  let cloze$$5;
  cloze$$5 = (0, _String.join)(" ", cl$$5.words);
  let item$$1;
  const input$$8 = (0, _RegExp.replace)(sentence$$6, "\\b" + cloze$$5 + "\\b", blank$$1);
  item$$1 = (0, _AllenNLP.removePrePunctuationSpaces)(input$$8);
  return [item$$1, cloze$$5];
}

function GetAcronymMap(input$$9) {
  const acronymRegex = (0, _RegExp.create)("\\(([A-Z]+)\\)");
  const matches = (0, _RegExp.matches)(acronymRegex, input$$9);
  let acronymMap;

  if (matches.length !== 0) {
    const elements$$3 = (0, _Seq.delay)(function () {
      return (0, _Seq.collect)(function (m) {
        const acronym = m[1] || "";
        const index$$1 = m.index | 0;
        const start$$5 = (index$$1 - 50 > 0 ? index$$1 - 50 : 0) | 0;
        let words$$1;
        const input$$10 = (0, _String.substring)(input$$9, start$$5, 50);
        const pattern = " ";
        words$$1 = (0, _AllenNLP.Split)(pattern, input$$10);
        let firstLetterString;
        let arg00$$5;
        arg00$$5 = (0, _Array.map)(function mapping$$26(w) {
          return w[0];
        }, words$$1, Array);
        firstLetterString = arg00$$5.join("");
        const letterRegex = (0, _RegExp.create)(acronym);
        const lm = (0, _RegExp.match)(letterRegex, firstLetterString.toLocaleUpperCase());

        if (lm != null) {
          let phrase;
          const strings$$19 = words$$1.slice(lm.index, acronym.length + 1);
          phrase = (0, _String.join)(" ", strings$$19);
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

function GetSelectCloze(nlpJsonOption$$4, sentenceCountOption, itemCountOption, doTrace, stringArrayJsonOption$$4, inputText$$4) {
  return (0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
    return GetAllCloze(nlpJsonOption$$4, stringArrayJsonOption$$4, inputText$$4).then(function (_arg1$$8) {
      var list$$14, count;

      if (_arg1$$8.tag === 1) {
        return Promise.resolve(new _Option.Result(1, "Error", _arg1$$8.fields[0]));
      } else {
        let sentenceCount$$1;

        if (sentenceCountOption == null) {
          let sentences$$1;
          sentences$$1 = (0, _Array.map)(function mapping$$27(x$$6) {
            return x$$6.sen;
          }, _arg1$$8.fields[0].sentences, Array);
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
        let array$$49;
        let array$$48;
        let array$$46;
        let array$$45;
        let array$$43;
        let array$$42;
        array$$42 = (0, _Array.mapIndexed)(function mapping$$28(i$$19, s$$1) {
          return [s$$1, _arg1$$8.fields[0].clozables[i$$19]];
        }, _arg1$$8.fields[0].sentences, Array);
        array$$43 = array$$42.filter(function predicate$$13(tupledArg$$10) {
          let value$$15;
          value$$15 = (0, _RegExp.isMatch)(badSentenceRegex, tupledArg$$10[0].sen);
          return !value$$15;
        });
        array$$45 = (0, _Array.map)(function mapping$$29(tupledArg$$11) {
          return [tupledArg$$11[0], (RemoveOverlappingClozables(tupledArg$$11[1]))];
        }, array$$43, Array);
        array$$46 = (0, _Array.map)(function mapping$$30(tupledArg$$12) {
          return [tupledArg$$12[0], (tupledArg$$12[1].filter(function predicate$$14(cl$$7) {
            return cl$$7.words.length < 4;
          }))];
        }, array$$45, Array);
        array$$48 = array$$46.filter(function predicate$$15(tupledArg$$13) {
          return tupledArg$$13[1].length > 0;
        });
        array$$49 = (0, _Array.map)(function mapping$$31(tupledArg$$14) {
          return [tupledArg$$14[0], ((0, _Array.distinctBy)(function projection$$6(cl$$9) {
            return cl$$9.words;
          }, tupledArg$$14[1], {
            Equals($x$$37, $y$$38) {
              return (0, _Array.equalsWith)(_Util.comparePrimitives, $x$$37, $y$$38);
            },

            GetHashCode: _Util.structuralHash
          }))];
        }, array$$48, Array);
        list$$9 = (0, _Array.toList)(array$$49);
        patternInput$$1 = (0, _List.partition)(function predicate$$17(tupledArg$$15) {
          let chainsLengthTwoOrMore$$1;
          let array$$51;
          array$$51 = (0, _Array.map)(function mapping$$32(id$$4) {
            return _arg1$$8.fields[0].coreference.clusters[id$$4];
          }, tupledArg$$15[0].cor.clusters, Array);
          chainsLengthTwoOrMore$$1 = array$$51.filter(function predicate$$16(c$$4) {
            return c$$4.length > 1;
          });
          return chainsLengthTwoOrMore$$1.length > 2;
        }, list$$9);
        let clozeTuples;
        const hardFilterSentenceCount = (0, _List.length)(patternInput$$1[0]) | 0;

        if (hardFilterSentenceCount > sentenceCount$$1) {
          let list$$12;
          let list$$11;
          list$$11 = (0, _List.sortByDescending)(function projection$$7(tupledArg$$16) {
            return GetTotalWeight(_arg1$$8.fields[0].coreference, tupledArg$$16[0]) | 0;
          }, patternInput$$1[0], {
            Compare: _Util.comparePrimitives
          });
          list$$12 = (0, _List.take)(sentenceCount$$1, list$$11);
          clozeTuples = (0, _List.sortBy)(function projection$$8(tupledArg$$17) {
            return tupledArg$$17[0].id;
          }, list$$12, {
            Compare: _Util.comparePrimitives
          });
        } else {
          const list$$15 = (0, _List.append)(patternInput$$1[0], (list$$14 = ((0, _List.sortByDescending)(function projection$$9(tupledArg$$18) {
            return GetTotalWeight(_arg1$$8.fields[0].coreference, tupledArg$$18[0]) | 0;
          }, patternInput$$1[1], {
            Compare: _Util.comparePrimitives
          })), (count = sentenceCount$$1 - (0, _List.length)(patternInput$$1[0]) | 0, (0, _List.take)(count, list$$14))));
          clozeTuples = (0, _List.sortBy)(function projection$$10(tupledArg$$19) {
            return tupledArg$$19[0].id;
          }, list$$15, {
            Compare: _Util.comparePrimitives
          });
        }

        let clozeProbTuples;
        clozeProbTuples = (0, _List.map)(function mapping$$33(tupledArg$$20) {
          let sorted;
          let array$$53;
          array$$53 = (0, _Array.sortBy)(function projection$$11(cl$$10) {
            return cl$$10.prob;
          }, tupledArg$$20[1], {
            Compare: _Util.comparePrimitives
          });
          sorted = (0, _Array.toList)(array$$53);
          return [tupledArg$$20[0], (0, _List.head)(sorted), (0, _List.tail)(sorted)];
        }, clozeTuples);
        let restClozableMap;
        let elements$$4;
        let list$$21;
        let list$$20;
        let list$$19;
        list$$19 = (0, _List.collect)(function mapping$$35(tupledArg$$21) {
          return (0, _List.map)(function mapping$$34(c$$5) {
            return [tupledArg$$21[0], c$$5];
          }, tupledArg$$21[2]);
        }, clozeProbTuples);
        list$$20 = (0, _List.sortBy)(function projection$$12(tupledArg$$22) {
          return tupledArg$$22[1].prob;
        }, list$$19, {
          Compare: _Util.comparePrimitives
        });
        const count$$1 = itemCount$$1 - sentenceCount$$1 | 0;
        list$$21 = (0, _List.take)(count$$1, list$$20);
        elements$$4 = (0, _List.groupBy)(function projection$$13(tuple$$7) {
          return tuple$$7[0];
        }, list$$21, {
          Equals: _Util.equals,
          GetHashCode: _Util.structuralHash
        });
        restClozableMap = (0, _Map.ofList)(elements$$4, {
          Compare($x$$55, $y$$56) {
            return $x$$55.CompareTo($y$$56);
          }

        });
        let allClozableMap;
        let elements$$5;
        elements$$5 = (0, _List.map)(function mapping$$37(tupledArg$$23) {
          let cl$$12;
          const matchValue$$6 = (0, _Map.FSharpMap$$TryFind$$2B595)(restClozableMap, tupledArg$$23[0]);

          if (matchValue$$6 == null) {
            cl$$12 = new _Types.List();
          } else {
            const t$$3 = matchValue$$6;
            cl$$12 = (0, _List.map)(function mapping$$36(tuple$$8) {
              return tuple$$8[1];
            }, t$$3);
          }

          return [tupledArg$$23[0], new _Types.List(tupledArg$$23[1], cl$$12)];
        }, clozeProbTuples);
        allClozableMap = (0, _Map.ofList)(elements$$5, {
          Compare($x$$57, $y$$58) {
            return $x$$57.CompareTo($y$$58);
          }

        });
        let importantClozeMap;
        let elements$$6;
        let array$$59;
        let array$$58;
        let array$$56;
        let array$$55;
        let array$$54;
        array$$54 = (0, _Map.toArray)(allClozableMap);
        array$$55 = (0, _Array.sortByDescending)(function projection$$14(tupledArg$$24) {
          return GetTotalWeight(_arg1$$8.fields[0].coreference, tupledArg$$24[0]) | 0;
        }, array$$54, {
          Compare: _Util.comparePrimitives
        });
        array$$56 = (0, _Array.collect)(function mapping$$38(tupledArg$$25) {
          return (0, _Array.ofList)(tupledArg$$25[1], Array);
        }, array$$55, Array);
        array$$58 = (0, _Array.chunkBySize)(30, array$$56);
        array$$59 = (0, _Array.mapIndexed)(function mapping$$40(i$$20, cl$$14) {
          return (0, _Array.map)(function mapping$$39(cl$$15) {
            return [cl$$15, i$$20];
          }, cl$$14, Array);
        }, array$$58, Array);
        elements$$6 = (0, _Array.collect)(function mapping$$41(x$$7) {
          return x$$7;
        }, array$$59, Array);
        importantClozeMap = (0, _Map.ofArray)(elements$$6, {
          Compare($x$$61, $y$$62) {
            return $x$$61.CompareTo($y$$62);
          }

        });
        let input$$11;

        if (stringArrayJsonOption$$4 == null) {
          input$$11 = [inputText$$4];
        } else {
          const chunksJson = stringArrayJsonOption$$4;
          input$$11 = (0, _Decode.Auto$$$unsafeFromString$$Z5CB6BD)(chunksJson, undefined, undefined, {
            ResolveType() {
              return (0, _Reflection.array_type)(_Reflection.string_type);
            }

          });
        }

        let acronymMap$$1;
        let json$$12;
        let input$$12;
        input$$12 = (0, _String.join)(" ", input$$11);
        json$$12 = GetAcronymMap(input$$12);
        acronymMap$$1 = (0, _Decode.Auto$$$unsafeFromString$$Z5CB6BD)(json$$12, undefined, undefined, {
          ResolveType() {
            return (0, _Reflection.class_type)("Microsoft.FSharp.Collections.FSharpMap`2", [_Reflection.string_type, _Reflection.string_type]);
          }

        });
        const sentences$$2 = [];
        const clozes = [];
        (0, _Seq.iterate)(function action$$1(sa$$19) {
          const matchValue$$7 = (0, _Map.FSharpMap$$TryFind$$2B595)(allClozableMap, sa$$19);

          if (matchValue$$7 != null) {
            const clozables$$6 = matchValue$$7;
            void sentences$$2.push(new SentenceAPI(sa$$19.sen, (0, _Util.structuralHash)(sa$$19), true));
            (0, _Seq.iterate)(function action(cl$$16) {
              var arg0$$30;
              const patternInput$$2 = MakeItemWithTranformations(sa$$19, cl$$16);
              let tags$$3;
              let li;
              const list$$25 = (0, _List.append)(new _Types.List((arg0$$30 = (0, _Map.FSharpMap$$get_Item$$2B595)(importantClozeMap, cl$$16) | 0, (new Tag(0, "WeightGroup", arg0$$30))), patternInput$$2[2]), cl$$16.trace);
              li = (0, _List.choose)(function chooser$$4(t$$4) {
                switch (t$$4.tag) {
                  case 19:
                    {
                      return undefined;
                    }

                  case 18:
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

              void clozes.push(new ClozableAPI(patternInput$$2[0], (0, _Util.structuralHash)(sa$$19), (0, _Util.structuralHash)(patternInput$$2[0]), correctResponses, tags$$3));
            }, clozables$$6);
          } else {
            void sentences$$2.push(new SentenceAPI(sa$$19.sen, (0, _Util.structuralHash)(sa$$19), false));
          }
        }, _arg1$$8.fields[0].sentences);
        return Promise.resolve(new _Option.Result(0, "Ok", new ClozeAPI(sentences$$2.slice(), clozes.slice())));
      }
    });
  }));
}

function GetSelectClozePercentage(percentage$$1, stringArrayJsonOption$$5, nlpJsonOption$$5, inputText$$5) {
  return (0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
    var nlpJson$$5, input$$13;
    return (nlpJsonOption$$5 == null ? (0, _AllenNLP.GetNLP)(stringArrayJsonOption$$5, inputText$$5) : (nlpJson$$5 = nlpJsonOption$$5, (input$$13 = ((0, _Decode.Auto$$$unsafeFromString$$Z5CB6BD)(nlpJson$$5, undefined, undefined, {
      ResolveType() {
        return (0, _AllenNLP.DocumentAnnotation$reflection)();
      }

    })), ((0, _AllenNLP.Promisify)(input$$13))))).then(function (_arg1$$10) {
      var value$$16, arg0$$31;

      if (_arg1$$10.tag === 1) {
        return Promise.resolve(new _Option.Result(1, "Error", _arg1$$10.fields[0]));
      } else {
        const sentenceCount$$2 = ~~((value$$16 = _arg1$$10.fields[0].sentences.length | 0, (value$$16)) * percentage$$1) | 0;
        const itemCount$$2 = sentenceCount$$2 * 2 | 0;
        return GetSelectCloze((arg0$$31 = ((0, _Encode.Auto$$$toString$$5A41365E)(4, _arg1$$10.fields[0], undefined, undefined, undefined, {
          ResolveType() {
            return (0, _AllenNLP.DocumentAnnotation$reflection)();
          }

        })), (arg0$$31)), (sentenceCount$$2), (itemCount$$2), true, stringArrayJsonOption$$5, inputText$$5).then(function (_arg2$$6) {
          if (_arg2$$6.tag === 1) {
            return Promise.resolve(new _Option.Result(1, "Error", _arg2$$6.fields[0]));
          } else {
            let stimFile;
            stimFile = PublicApiToStimFile(_arg2$$6.fields[0]);
            return Promise.resolve(new _Option.Result(0, "Ok", stimFile));
          }
        });
      }
    });
  }));
}

function DoSimpleComputation(input$$14) {
  let strings$$21;
  let source$$31;
  const source$$30 = input$$14.split("");
  source$$31 = (0, _Seq.reverse)(source$$30);
  strings$$21 = source$$31;
  return (0, _String.join)("", strings$$21);
}