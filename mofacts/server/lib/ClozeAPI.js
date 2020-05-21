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
exports.GetTotalWeight = GetTotalWeight;
exports.getFeatureDistanceFromRoot = getFeatureDistanceFromRoot;
exports.getFeatureDistanceFromStart = getFeatureDistanceFromStart;
exports.getFeatureCorefClusters = getFeatureCorefClusters;
exports.getFeatureCorefClusterTotalWeight = getFeatureCorefClusterTotalWeight;
exports.getFeatureCorefClusterBackwardWeight = getFeatureCorefClusterBackwardWeight;
exports.getFeatureCorefClusterForwardWeight = getFeatureCorefClusterForwardWeight;
exports.GetModifiedNPClozable = GetModifiedNPClozable;
exports.GetClozable = GetClozable;
exports.GetAllCloze = GetAllCloze;
exports.RemoveOverlappingClozables = RemoveOverlappingClozables;
exports.MakeItem = MakeItem;
exports.GetAcronymMap = GetAcronymMap;
exports.GetSelectCloze = GetSelectCloze;
exports.DoSimpleComputation = DoSimpleComputation;
exports.badSentenceRegex = exports.InternalAPI = exports.Clozable = exports.Tag = exports.ClozeAPI = exports.ClozableAPI = exports.SentenceAPI = void 0;

var _Types = require("./fable-library.2.8.4/Types");

var _Reflection = require("./fable-library.2.8.4/Reflection");

var _Int = require("./fable-library.2.8.4/Int32");

var _AllenNLP = require("./AllenNLP");

var _Seq = require("./fable-library.2.8.4/Seq");

var _Util = require("./fable-library.2.8.4/Util");

var _Array = require("./fable-library.2.8.4/Array");

var _Encode = require("./Thoth.Json.4.0.0/Encode");

var _List = require("./fable-library.2.8.4/List");

var _WordFrequency = require("./WordFrequency");

var _String = require("./fable-library.2.8.4/String");

var _Map = require("./fable-library.2.8.4/Map");

var _RegExp = require("./fable-library.2.8.4/RegExp");

var _Decode = require("./Thoth.Json.4.0.0/Decode");

var _Option = require("./fable-library.2.8.4/Option");

var _PromiseImpl = require("./Fable.Promise.2.1.0/PromiseImpl");

var _Promise = require("./Fable.Promise.2.1.0/Promise");

const SentenceAPI = (0, _Types.declare)(function ClozeAPI_SentenceAPI(arg1, arg2, arg3) {
  this.sentence = arg1;
  this.itemId = arg2 | 0;
  this.hasCloze = arg3;
}, _Types.Record);
exports.SentenceAPI = SentenceAPI;

function SentenceAPI$reflection() {
  return (0, _Reflection.record)("ClozeAPI.SentenceAPI", [], SentenceAPI, () => [["sentence", _Reflection.string], ["itemId", _Reflection.int32], ["hasCloze", _Reflection.bool]]);
}

const ClozableAPI = (0, _Types.declare)(function ClozeAPI_ClozableAPI(arg1, arg2, arg3, arg4, arg5) {
  this.cloze = arg1;
  this.itemId = arg2 | 0;
  this.clozeId = arg3 | 0;
  this.correctResponse = arg4;
  this.tags = arg5;
}, _Types.Record);
exports.ClozableAPI = ClozableAPI;

function ClozableAPI$reflection() {
  return (0, _Reflection.record)("ClozeAPI.ClozableAPI", [], ClozableAPI, () => [["cloze", _Reflection.string], ["itemId", _Reflection.int32], ["clozeId", _Reflection.int32], ["correctResponse", _Reflection.string], ["tags", _Reflection.obj]]);
}

const ClozeAPI = (0, _Types.declare)(function ClozeAPI_ClozeAPI(arg1, arg2) {
  this.sentences = arg1;
  this.clozes = arg2;
}, _Types.Record);
exports.ClozeAPI = ClozeAPI;

function ClozeAPI$reflection() {
  return (0, _Reflection.record)("ClozeAPI.ClozeAPI", [], ClozeAPI, () => [["sentences", (0, _Reflection.array)(SentenceAPI$reflection())], ["clozes", (0, _Reflection.array)(ClozableAPI$reflection())]]);
}

const Tag = (0, _Types.declare)(function ClozeAPI_Tag(tag, name, ...fields) {
  _Types.Union.call(this, tag, name, ...fields);
}, _Types.Union);
exports.Tag = Tag;

function Tag$reflection() {
  return (0, _Reflection.union)("ClozeAPI.Tag", [], Tag, () => [["WeightGroup", [["Item", _Reflection.int32]]], ["OrderGroup", [["Item", _Reflection.int32]]], ["SyntacticRole", [["Item", _Reflection.string]]], ["SemanticRole", [["Item", _Reflection.string]]], ["RootDistance", [["Item", _Reflection.int32]]], ["StartDistance", [["Item", _Reflection.int32]]], ["CorefClusters", [["Item", _Reflection.int32]]], ["CorefClusterTotalWeight", [["Item", _Reflection.int32]]], ["CorefClusterBackwardWeight", [["Item", _Reflection.int32]]], ["CorefClusterForwardWeight", [["Item", _Reflection.int32]]], ["Trace", [["Item", _Reflection.string]]], ["Deprecated", [["Item", _Reflection.string]]]]);
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

    case "chunk":
      {
        let arg0$$2;
        const value$$2 = s[1];
        arg0$$2 = (0, _Int.parse)(value$$2, 511, false, 32);
        return new Tag(1, "OrderGroup", arg0$$2);
      }

    case "default":
      {
        const arg0$$3 = s[1];
        return new Tag(11, "Deprecated", arg0$$3);
      }

    default:
      {
        const arg0$$4 = "Error:" + keyValue;
        return new Tag(10, "Trace", arg0$$4);
      }
  }
}

const Clozable = (0, _Types.declare)(function ClozeAPI_Clozable(arg1, arg2, arg3, arg4, arg5, arg6) {
  this.words = arg1;
  this.start = arg2 | 0;
  this.stop = arg3 | 0;
  this.trace = arg4;
  this.prob = arg5;
  this.tags = arg6;
}, _Types.Record);
exports.Clozable = Clozable;

function Clozable$reflection() {
  return (0, _Reflection.record)("ClozeAPI.Clozable", [], Clozable, () => [["words", (0, _Reflection.array)(_Reflection.string)], ["start", _Reflection.int32], ["stop", _Reflection.int32], ["trace", (0, _Reflection.list)(Tag$reflection())], ["prob", _Reflection.float64], ["tags", (0, _Reflection.list)(Tag$reflection())]]);
}

const InternalAPI = (0, _Types.declare)(function ClozeAPI_InternalAPI(arg1, arg2, arg3) {
  this.sentences = arg1;
  this.coreference = arg2;
  this.clozables = arg3;
}, _Types.Record);
exports.InternalAPI = InternalAPI;

function InternalAPI$reflection() {
  return (0, _Reflection.record)("ClozeAPI.InternalAPI", [], InternalAPI, () => [["sentences", (0, _Reflection.array)((0, _AllenNLP.SentenceAnnotation$reflection)())], ["coreference", (0, _AllenNLP.Coreference$reflection)()], ["clozables", (0, _Reflection.array)((0, _Reflection.array)(Clozable$reflection()))]]);
}

function EstimateDesiredSentences(sentences) {
  let wordCount;
  let value$$3;
  value$$3 = (0, _Seq.sumBy)(function projection(sentence) {
    return sentence.split(" ").length;
  }, sentences, {
    GetZero() {
      return 0;
    },

    Add($x$$1, $y$$2) {
      return $x$$1 + $y$$2;
    }

  });
  wordCount = value$$3;
  let desiredSentences;
  const value$$4 = wordCount / 1000 * 25;
  desiredSentences = ~~value$$4;
  return desiredSentences | 0;
}

function EstimateDesiredItems(desiredSentences$$1) {
  const desiredItems = desiredSentences$$1 * 2 | 0;
  return desiredItems | 0;
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
  const arg0$$7 = clusters.length | 0;
  return new Tag(6, "CorefClusters", arg0$$7);
}

function getFeatureCorefClusterTotalWeight(sen$$3, da) {
  const totalWeight$$1 = GetTotalWeight(da.coreference, sen$$3) | 0;
  return new Tag(7, "CorefClusterTotalWeight", totalWeight$$1);
}

function getFeatureCorefClusterBackwardWeight(sen$$4, da$$1) {
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
    return da$$1.coreference.clusters[id$$1];
  }, array$$4, Array);
  array$$6 = array$$5.filter(function predicate(c) {
    return c[1] < sen$$4.cor.offset;
  });
  weight = array$$6.length;
  return new Tag(8, "CorefClusterBackwardWeight", weight);
}

function getFeatureCorefClusterForwardWeight(sen$$5, da$$2) {
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
    return da$$2.coreference.clusters[id$$2];
  }, array$$8, Array);
  array$$10 = array$$9.filter(function predicate$$1(c$$1) {
    return c$$1[0] > sen$$5.cor.offset + sen$$5.srl.words.length;
  });
  weight$$1 = array$$10.length;
  return new Tag(9, "CorefClusterForwardWeight", weight$$1);
}

function GetModifiedNPClozable(sen$$6, startInit, stopInit, head, traceInit) {
  var arg0$$11, array$$12, value$$5, array$$18, array$$20;
  const trace = [];
  (0, _Array.addRangeInPlace)(traceInit, trace);
  void trace.push(getFeatureDistanceFromRoot(startInit, stopInit, sen$$6));
  void trace.push(getFeatureDistanceFromStart(startInit));

  if (startInit < 0 ? true : stopInit >= sen$$6.srl.words.length) {
    void trace.push((arg0$$11 = "CRITICAL: invalid clozable parameters for " + ((0, _Encode.Auto$$$toString$$5A41365E)(4, sen$$6, null, null, null, {
      ResolveType() {
        return (0, _AllenNLP.SentenceAnnotation$reflection)();
      }

    })), (new Tag(10, "Trace", arg0$$11))));
    return new Clozable(new Array(0), 0, 0, ((0, _List.ofSeq)(trace)), 1, (array$$12 = ((0, _Array.map)(StringToTag, sen$$6.tags, Array)), ((0, _Array.toList)(array$$12))));
  } else {
    let h$$3;

    if (head == null) {
      let stanfordHead;
      let tuple;
      let source$$5;
      const source$$4 = (0, _Array.ofSeq)((0, _Seq.rangeNumber)(startInit, 1, stopInit), Int32Array);
      source$$5 = (0, _Seq.map)(function mapping$$3(i$$2) {
        return [i$$2, sen$$6.dep.predicted_heads[i$$2]];
      }, source$$4);
      tuple = (0, _Seq.find)(function predicate$$2(tupledArg) {
        if (tupledArg[1] < startInit + 1) {
          return true;
        } else {
          return tupledArg[1] > stopInit + 1;
        }
      }, source$$5);
      stanfordHead = tuple[0];

      if (value$$5 = sen$$6.dep.pos[stanfordHead].indexOf("NN") === 0, (!value$$5)) {
        void trace.push((new Tag(10, "Trace", "head is not nominal")));
        let argOption;
        let source$$7;
        const source$$6 = (0, _Array.ofSeq)((0, _Seq.rangeNumber)(startInit, 1, stopInit), Int32Array);
        source$$7 = (0, _Seq.map)(function mapping$$4(i$$3) {
          return [i$$3, sen$$6.dep.predicted_dependencies[i$$3]];
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
          return [i$$4, sen$$6.dep.pos[i$$4]];
        }, source$$8);
        source$$10 = (0, _Seq.reverse)(source$$9);
        nnOption = (0, _Seq.tryFind)(function predicate$$4(tupledArg$$2) {
          return tupledArg$$2[1].indexOf("NN") === 0;
        }, source$$10);

        if (argOption != null) {
          const arg = argOption;
          void trace.push((new Tag(10, "Trace", "WARNING: using first syntactic arg as pseudohead")));
          h$$3 = arg[0];
        } else if (nnOption != null) {
          const nn = nnOption;
          void trace.push((new Tag(10, "Trace", "WARNING: using last nominal as pseudohead")));
          h$$3 = nn[0];
        } else {
          void trace.push((new Tag(10, "Trace", "CRITICAL: clozable without nominal or arg, defaulting to given span")));
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
      if (sen$$6.dep.pos[i$$5].indexOf("N") === 0) {
        return true;
      } else {
        return sen$$6.dep.pos[i$$5] === "JJ";
      }
    }, array$$14, Int32Array);
    indices = (0, _Array.reverse)(array$$15, Int32Array);
    let patternInput;

    if (indices.length !== 0) {
      const start$$2 = indices[0] | 0;
      let stop$$1;
      stop$$1 = (0, _Array.last)(indices);
      patternInput = [start$$2, stop$$1, sen$$6.srl.words.slice(start$$2, stop$$1 + 1)];
    } else {
      void trace.push((new Tag(10, "Trace", "CRITICAL: stanford head yields empty span, defaulting to given span")));
      patternInput = [startInit, stopInit, sen$$6.srl.words.slice(startInit, stopInit + 1)];
    }

    const clozable = new Clozable(patternInput[2], patternInput[0], patternInput[1], ((0, _List.ofSeq)(trace)), (array$$18 = ((0, _Array.map)(_WordFrequency.Get, patternInput[2], Float64Array)), ((0, _Array.min)(array$$18, {
      Compare: _Util.comparePrimitives
    }))), (array$$20 = ((0, _Array.map)(StringToTag, sen$$6.tags, Array)), ((0, _Array.toList)(array$$20))));
    return clozable;
  }
}

function GetClozable(da$$3) {
  return (0, _Array.map)(function mapping$$12(sen$$7) {
    var source$$16, source$$15, source$$14;
    const clozable$$1 = [];
    (0, _Array.addRangeInPlace)(((0, _Seq.mapIndexed)(function mapping$$6(i$$6, si) {
      return GetModifiedNPClozable(sen$$7, si[0], si[1], null, [(new Tag(10, "Trace", "coref")), getFeatureCorefClusters(sen$$7), getFeatureCorefClusterTotalWeight(sen$$7, da$$3), getFeatureCorefClusterBackwardWeight(sen$$7, da$$3), getFeatureCorefClusterForwardWeight(sen$$7, da$$3)]);
    }, sen$$7.cor.spans)), clozable$$1);
    (0, _Array.addRangeInPlace)((source$$16 = (source$$15 = (source$$14 = ((0, _Seq.mapIndexed)(function mapping$$7(i$$7, x$$3) {
      return [i$$7, x$$3];
    }, sen$$7.dep.predicted_dependencies)), ((0, _Seq.filter)(function predicate$$6(tupledArg$$3) {
      if (tupledArg$$3[1].indexOf("obj") >= 0 ? true : tupledArg$$3[1].indexOf("subj") >= 0) {
        return true;
      } else {
        return tupledArg$$3[1].indexOf("root") >= 0;
      }
    }, source$$14))), ((0, _Seq.filter)(function predicate$$7(tupledArg$$4) {
      return sen$$7.dep.pos[tupledArg$$4[0]].indexOf("N") === 0;
    }, source$$15))), ((0, _Seq.map)(function mapping$$8(tupledArg$$5) {
      return GetModifiedNPClozable(sen$$7, tupledArg$$5[0], tupledArg$$5[0], (tupledArg$$5[0]), [(new Tag(10, "Trace", "dep")), (new Tag(10, "Trace", tupledArg$$5[1])), (new Tag(2, "SyntacticRole", tupledArg$$5[1]))]);
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
        return GetModifiedNPClozable(sen$$7, start$$4, stop$$3, null, [(new Tag(10, "Trace", "srl")), (new Tag(10, "Trace", pred.description)), (new Tag(3, "SemanticRole", tupledArg$$8[0]))]);
      }, source$$22);
    }, sen$$7.srl.verbs)), clozable$$1);
    return clozable$$1;
  }, da$$3.sentences, Array);
}

const badSentenceRegex = (0, _RegExp.create)("(figure|table|section|clinical|application)\\s+[0-9]", 1);
exports.badSentenceRegex = badSentenceRegex;

function GetAllCloze(nlpJsonOption, chunksJsonOption, inputText) {
  return (0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
    var nlpJson, input;
    return (nlpJsonOption == null ? (0, _AllenNLP.GetNLP)(chunksJsonOption, inputText) : (nlpJson = nlpJsonOption, (input = ((0, _Decode.Auto$$$unsafeFromString$$Z5CB6BD)(nlpJson, null, null, {
      ResolveType() {
        return (0, _AllenNLP.DocumentAnnotation$reflection)();
      }

    })), ((0, _AllenNLP.Promisify)(input))))).then(function (_arg1$$2) {
      if (_arg1$$2.tag === 1) {
        return Promise.resolve(new _Option.Result(1, "Error", _arg1$$2.fields[0]));
      } else {
        let clozables;
        let array$$22;
        array$$22 = GetClozable(_arg1$$2.fields[0]);
        clozables = (0, _Array.map)(function mapping$$13(ra) {
          return ra.slice();
        }, array$$22, Array);
        return Promise.resolve(new _Option.Result(0, "Ok", new InternalAPI(_arg1$$2.fields[0].sentences, _arg1$$2.fields[0].coreference, clozables)));
      }
    });
  }));
}

function RemoveOverlappingClozables(clozables$$1) {
  const clozablesOut = Array.from(clozables$$1);

  for (let ci = 0; ci <= clozables$$1.length - 1; ci++) {
    for (let cj = ci; cj <= clozables$$1.length - 1; cj++) {
      const overlap = (ci !== cj ? clozables$$1[ci].start <= clozables$$1[cj].stop : false) ? clozables$$1[cj].start <= clozables$$1[ci].stop : false;

      if (overlap ? clozables$$1[ci].stop - clozables$$1[ci].start >= clozables$$1[cj].stop - clozables$$1[cj].start : false) {
        const value$$6 = (0, _Array.removeInPlace)(clozables$$1[cj], clozablesOut);
        void value$$6;
      } else if (overlap) {
        const value$$7 = (0, _Array.removeInPlace)(clozables$$1[ci], clozablesOut);
        void value$$7;
      }
    }
  }

  return clozablesOut.slice();
}

function MakeItem(sa, cl) {
  const itemWords = (0, _Array.copy)(sa.srl.words, Array);

  for (let i$$12 = cl.start; i$$12 <= cl.stop; i$$12++) {
    itemWords[i$$12] = "__________";
  }

  return [((0, _String.join)(" ", itemWords)), ((0, _String.join)(" ", cl.words))];
}

function GetAcronymMap(input$$1) {
  const acronymRegex = (0, _RegExp.create)("\\(([A-Z]+)\\)");
  const matches = (0, _RegExp.matches)(acronymRegex, input$$1);
  let acronymMap;

  if (matches.length !== 0) {
    const elements = (0, _Seq.delay)(function () {
      return (0, _Seq.collect)(function (m) {
        const acronym = m[1] || "";
        const index$$1 = m.index | 0;
        const start$$5 = (index$$1 - 50 > 0 ? index$$1 - 50 : 0) | 0;
        let words$$1;
        const input$$2 = (0, _String.substring)(input$$1, start$$5, 50);
        const pattern = " ";
        words$$1 = (0, _AllenNLP.Split)(pattern, input$$2);
        let firstLetterString;
        let arg00;
        arg00 = (0, _Array.map)(function mapping$$14(w) {
          return w[0];
        }, words$$1, Array);
        firstLetterString = arg00.join("");
        const letterRegex = (0, _RegExp.create)(acronym);
        const lm = (0, _RegExp.match)(letterRegex, firstLetterString.toLocaleUpperCase());

        if (lm != null) {
          let phrase;
          const strings$$2 = words$$1.slice(lm.index, acronym.length + 1);
          phrase = (0, _String.join)(" ", strings$$2);
          return (0, _Seq.append)((0, _Seq.singleton)([phrase, acronym]), (0, _Seq.delay)(function () {
            return (0, _Seq.singleton)([acronym, phrase]);
          }));
        } else {
          return (0, _Seq.empty)();
        }
      }, (matches));
    });
    acronymMap = (0, _Map.ofSeq)(elements, {
      Compare: _Util.comparePrimitives
    });
  } else {
    acronymMap = (0, _Map.empty)({
      Compare: _Util.comparePrimitives
    });
  }

  return (0, _Encode.Auto$$$toString$$5A41365E)(4, acronymMap, null, null, null, {
    ResolveType() {
      return (0, _Reflection.type)("Microsoft.FSharp.Collections.FSharpMap`2", [_Reflection.string, _Reflection.string]);
    }

  });
}

function GetSelectCloze(nlpJsonOption$$1, sentenceCountOption, itemCountOption, doTrace, chunksJsonOption$$1, inputText$$1) {
  return (0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
    return GetAllCloze(nlpJsonOption$$1, chunksJsonOption$$1, inputText$$1).then(function (_arg1$$3) {
      var list$$5, count;

      if (_arg1$$3.tag === 1) {
        return Promise.resolve(new _Option.Result(1, "Error", _arg1$$3.fields[0]));
      } else {
        let sentenceCount$$1;

        if (sentenceCountOption == null) {
          let sentences$$1;
          sentences$$1 = (0, _Array.map)(function mapping$$15(x$$6) {
            return x$$6.sen;
          }, _arg1$$3.fields[0].sentences, Array);
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
        let list;
        let array$$31;
        let array$$30;
        let array$$29;
        let array$$27;
        let array$$26;
        array$$26 = (0, _Array.mapIndexed)(function mapping$$16(i$$13, s$$1) {
          return [s$$1, _arg1$$3.fields[0].clozables[i$$13]];
        }, _arg1$$3.fields[0].sentences, Array);
        array$$27 = array$$26.filter(function predicate$$9(tupledArg$$9) {
          let value$$8;
          value$$8 = (0, _RegExp.isMatch)(badSentenceRegex, tupledArg$$9[0].sen);
          return !value$$8;
        });
        array$$29 = (0, _Array.map)(function mapping$$17(tupledArg$$10) {
          return [tupledArg$$10[0], (RemoveOverlappingClozables(tupledArg$$10[1]))];
        }, array$$27, Array);
        array$$30 = (0, _Array.map)(function mapping$$18(tupledArg$$11) {
          return [tupledArg$$11[0], (tupledArg$$11[1].filter(function predicate$$10(cl$$2) {
            return cl$$2.words.length < 4;
          }))];
        }, array$$29, Array);
        array$$31 = array$$30.filter(function predicate$$11(tupledArg$$12) {
          return tupledArg$$12[1].length > 0;
        });
        list = (0, _Array.toList)(array$$31);
        patternInput$$1 = (0, _List.partition)(function predicate$$13(tupledArg$$13) {
          let chainsLengthTwoOrMore;
          let array$$33;
          array$$33 = (0, _Array.map)(function mapping$$19(id$$3) {
            return _arg1$$3.fields[0].coreference.clusters[id$$3];
          }, tupledArg$$13[0].cor.clusters, Array);
          chainsLengthTwoOrMore = array$$33.filter(function predicate$$12(c$$2) {
            return c$$2.length > 1;
          });
          return chainsLengthTwoOrMore.length > 2;
        }, list);
        let clozeTuples;
        const hardFilterSentenceCount = (0, _List.length)(patternInput$$1[0]) | 0;

        if (hardFilterSentenceCount > sentenceCount$$1) {
          let list$$3;
          let list$$2;
          list$$2 = (0, _List.sortByDescending)(function projection$$5(tupledArg$$14) {
            return GetTotalWeight(_arg1$$3.fields[0].coreference, tupledArg$$14[0]) | 0;
          }, patternInput$$1[0], {
            Compare: _Util.comparePrimitives
          });
          list$$3 = (0, _List.take)(sentenceCount$$1, list$$2);
          clozeTuples = (0, _List.sortBy)(function projection$$6(tupledArg$$15) {
            return tupledArg$$15[0].id;
          }, list$$3, {
            Compare: _Util.comparePrimitives
          });
        } else {
          const list$$6 = (0, _List.append)(patternInput$$1[0], (list$$5 = ((0, _List.sortByDescending)(function projection$$7(tupledArg$$16) {
            return GetTotalWeight(_arg1$$3.fields[0].coreference, tupledArg$$16[0]) | 0;
          }, patternInput$$1[1], {
            Compare: _Util.comparePrimitives
          })), (count = sentenceCount$$1 - (0, _List.length)(patternInput$$1[0]) | 0, (0, _List.take)(count, list$$5))));
          clozeTuples = (0, _List.sortBy)(function projection$$8(tupledArg$$17) {
            return tupledArg$$17[0].id;
          }, list$$6, {
            Compare: _Util.comparePrimitives
          });
        }

        let clozeProbTuples;
        clozeProbTuples = (0, _List.map)(function mapping$$20(tupledArg$$18) {
          let sorted;
          let array$$35;
          array$$35 = (0, _Array.sortBy)(function projection$$9(cl$$4) {
            return cl$$4.prob;
          }, tupledArg$$18[1], {
            Compare: _Util.comparePrimitives
          });
          sorted = (0, _Array.toList)(array$$35);
          return [tupledArg$$18[0], (0, _List.head)(sorted), (0, _List.tail)(sorted)];
        }, clozeTuples);
        let restClozableMap;
        let elements$$1;
        let list$$12;
        let list$$11;
        let list$$10;
        list$$10 = (0, _List.collect)(function mapping$$22(tupledArg$$19) {
          return (0, _List.map)(function mapping$$21(c$$3) {
            return [tupledArg$$19[0], c$$3];
          }, tupledArg$$19[2]);
        }, clozeProbTuples);
        list$$11 = (0, _List.sortBy)(function projection$$10(tupledArg$$20) {
          return tupledArg$$20[1].prob;
        }, list$$10, {
          Compare: _Util.comparePrimitives
        });
        const count$$1 = itemCount$$1 - sentenceCount$$1 | 0;
        list$$12 = (0, _List.take)(count$$1, list$$11);
        elements$$1 = (0, _List.groupBy)(function projection$$11(tuple$$7) {
          return tuple$$7[0];
        }, list$$12, {
          Equals: _Util.equals,
          GetHashCode: _Util.structuralHash
        });
        restClozableMap = (0, _Map.ofList)(elements$$1, {
          Compare($x$$41, $y$$42) {
            return $x$$41.CompareTo($y$$42);
          }

        });
        let allClozableMap;
        let elements$$2;
        elements$$2 = (0, _List.map)(function mapping$$24(tupledArg$$21) {
          let cl$$6;
          const matchValue$$2 = (0, _Map.FSharpMap$$TryFind$$2B595)(restClozableMap, tupledArg$$21[0]);

          if (matchValue$$2 == null) {
            cl$$6 = new _Types.List();
          } else {
            const t$$3 = matchValue$$2;
            cl$$6 = (0, _List.map)(function mapping$$23(tuple$$8) {
              return tuple$$8[1];
            }, t$$3);
          }

          return [tupledArg$$21[0], new _Types.List(tupledArg$$21[1], cl$$6)];
        }, clozeProbTuples);
        allClozableMap = (0, _Map.ofList)(elements$$2, {
          Compare($x$$43, $y$$44) {
            return $x$$43.CompareTo($y$$44);
          }

        });
        let importantClozeMap;
        let elements$$3;
        let array$$41;
        let array$$40;
        let array$$38;
        let array$$37;
        let array$$36;
        array$$36 = (0, _Map.toArray)(allClozableMap);
        array$$37 = (0, _Array.sortByDescending)(function projection$$12(tupledArg$$22) {
          return GetTotalWeight(_arg1$$3.fields[0].coreference, tupledArg$$22[0]) | 0;
        }, array$$36, {
          Compare: _Util.comparePrimitives
        });
        array$$38 = (0, _Array.collect)(function mapping$$25(tupledArg$$23) {
          return (0, _Array.ofList)(tupledArg$$23[1], Array);
        }, array$$37, Array);
        array$$40 = (0, _Array.chunkBySize)(30, array$$38);
        array$$41 = (0, _Array.mapIndexed)(function mapping$$27(i$$14, cl$$8) {
          return (0, _Array.map)(function mapping$$26(cl$$9) {
            return [cl$$9, i$$14];
          }, cl$$8, Array);
        }, array$$40, Array);
        elements$$3 = (0, _Array.collect)(function mapping$$28(x$$7) {
          return x$$7;
        }, array$$41, Array);
        importantClozeMap = (0, _Map.ofArray)(elements$$3, {
          Compare($x$$47, $y$$48) {
            return $x$$47.CompareTo($y$$48);
          }

        });
        let input$$3;

        if (chunksJsonOption$$1 == null) {
          input$$3 = [inputText$$1];
        } else {
          const chunksJson = chunksJsonOption$$1;
          input$$3 = (0, _Decode.Auto$$$unsafeFromString$$Z5CB6BD)(chunksJson, null, null, {
            ResolveType() {
              return (0, _Reflection.array)(_Reflection.string);
            }

          });
        }

        let acronymMap$$1;
        let json$$4;
        let input$$4;
        input$$4 = (0, _String.join)(" ", input$$3);
        json$$4 = GetAcronymMap(input$$4);
        acronymMap$$1 = (0, _Decode.Auto$$$unsafeFromString$$Z5CB6BD)(json$$4, null, null, {
          ResolveType() {
            return (0, _Reflection.type)("Microsoft.FSharp.Collections.FSharpMap`2", [_Reflection.string, _Reflection.string]);
          }

        });
        const sentences$$2 = [];
        const clozes = [];
        (0, _Seq.iterate)(function action$$1(sa$$12) {
          const matchValue$$3 = (0, _Map.FSharpMap$$TryFind$$2B595)(allClozableMap, sa$$12);

          if (matchValue$$3 != null) {
            const clozables$$3 = matchValue$$3;
            void sentences$$2.push(new SentenceAPI(sa$$12.sen, (0, _Util.structuralHash)(sa$$12), true));
            (0, _Seq.iterate)(function action(cl$$10) {
              var arg0$$25;
              let tags;
              let li;
              const list$$16 = (0, _List.append)(new _Types.List((arg0$$25 = (0, _Map.FSharpMap$$get_Item$$2B595)(importantClozeMap, cl$$10) | 0, (new Tag(0, "WeightGroup", arg0$$25))), cl$$10.tags), cl$$10.trace);
              li = (0, _List.choose)(function chooser(t$$4) {
                switch (t$$4.tag) {
                  case 11:
                    {
                      return null;
                    }

                  case 10:
                    {
                      return null;
                    }

                  default:
                    {
                      return t$$4;
                    }
                }
              }, list$$16);
              tags = (0, _Util.createObj)(li, 1);
              const patternInput$$2 = MakeItem(sa$$12, cl$$10);
              let correctResponses;
              const matchValue$$4 = (0, _Map.FSharpMap$$TryFind$$2B595)(acronymMap$$1, patternInput$$2[1]);

              if (matchValue$$4 == null) {
                correctResponses = patternInput$$2[1];
              } else {
                const acronym$$1 = matchValue$$4;
                correctResponses = patternInput$$2[1] + "|" + acronym$$1;
              }

              void clozes.push(new ClozableAPI(patternInput$$2[0], (0, _Util.structuralHash)(sa$$12), (0, _Util.structuralHash)(patternInput$$2[0]), correctResponses, tags));
            }, clozables$$3);
          } else {
            void sentences$$2.push(new SentenceAPI(sa$$12.sen, (0, _Util.structuralHash)(sa$$12), false));
          }
        }, _arg1$$3.fields[0].sentences);
        return Promise.resolve(new _Option.Result(0, "Ok", new ClozeAPI(sentences$$2.slice(), clozes.slice())));
      }
    });
  }));
}

function DoSimpleComputation(input$$5) {
  let strings$$4;
  let source$$28;
  const source$$27 = input$$5.split("");
  source$$28 = (0, _Seq.reverse)(source$$27);
  strings$$4 = source$$28;
  return (0, _String.join)("", strings$$4);
}