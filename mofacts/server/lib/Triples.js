"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Tag$reflection = Tag$reflection;
exports.Triple$reflection = Triple$reflection;
exports.InternalAPI$reflection = InternalAPI$reflection;
exports.collapseDependencies = collapseDependencies;
exports.GetDependentNodes = GetDependentNodes;
exports.srlArgToIndexMap = srlArgToIndexMap;
exports.tripleIndicesFromSrlTags = tripleIndicesFromSrlTags;
exports.triplesFromSentence = triplesFromSentence;
exports.GetTriples = GetTriples;
exports.InternalAPI = exports.Triple = exports.Tag = void 0;

var _Types = require("./fable-library.2.8.4/Types");

var _Reflection = require("./fable-library.2.8.4/Reflection");

var _AllenNLP = require("./AllenNLP");

var _DependencyCollapser = require("./DependencyCollapser");

var _Array = require("./fable-library.2.8.4/Array");

var _String = require("./fable-library.2.8.4/String");

var _Util = require("./fable-library.2.8.4/Util");

var _Map = require("./fable-library.2.8.4/Map");

var _Decode = require("./Thoth.Json.4.0.0/Decode");

var _Option = require("./fable-library.2.8.4/Option");

var _PromiseImpl = require("./Fable.Promise.2.1.0/PromiseImpl");

var _Promise = require("./Fable.Promise.2.1.0/Promise");

const Tag = (0, _Types.declare)(function Triples_Tag(tag, name, ...fields) {
  _Types.Union.call(this, tag, name, ...fields);
}, _Types.Union);
exports.Tag = Tag;

function Tag$reflection() {
  return (0, _Reflection.union)("Triples.Tag", [], Tag, () => [["Trace", [["Item", _Reflection.string]]]]);
}

const Triple = (0, _Types.declare)(function Triples_Triple(arg1, arg2, arg3, arg4, arg5) {
  this.start = arg1;
  this.edge = arg2;
  this.stop = arg3;
  this.negated = arg4;
  this.trace = arg5;
}, _Types.Record);
exports.Triple = Triple;

function Triple$reflection() {
  return (0, _Reflection.record)("Triples.Triple", [], Triple, () => [["start", (0, _Reflection.array)(_Reflection.int32)], ["edge", (0, _Reflection.array)(_Reflection.int32)], ["stop", (0, _Reflection.array)(_Reflection.int32)], ["negated", _Reflection.bool], ["trace", (0, _Reflection.list)(Tag$reflection())]]);
}

const InternalAPI = (0, _Types.declare)(function Triples_InternalAPI(arg1, arg2, arg3) {
  this.sentences = arg1;
  this.coreference = arg2;
  this.triples = arg3;
}, _Types.Record);
exports.InternalAPI = InternalAPI;

function InternalAPI$reflection() {
  return (0, _Reflection.record)("Triples.InternalAPI", [], InternalAPI, () => [["sentences", (0, _Reflection.array)((0, _AllenNLP.SentenceAnnotation$reflection)())], ["coreference", (0, _AllenNLP.Coreference$reflection)()], ["triples", (0, _Reflection.array)((0, _Reflection.array)(Triple$reflection()))]]);
}

function collapseDependencies(sa) {
  let ruleTokens;
  let array$$1;
  array$$1 = (0, _Array.mapIndexed)(function mapping(i, w) {
    return (0, _DependencyCollapser.Rules$002EToken$$$Create$$Z2BAB6A85)(i, w, sa.dep.pos[i], sa.dep.predicted_dependencies[i], sa.dep.predicted_heads[i]);
  }, sa.dep.words, Array);
  ruleTokens = (0, _Array.toList)(array$$1);
  const patternInput = (0, _DependencyCollapser.Collapser$$$CollapseTokens)(ruleTokens);
  return patternInput[1];
}

function GetDependentNodes(start, sa$$1) {
  const dependents = [];

  for (let idx = 0; idx <= sa$$1.dep.predicted_heads.length - 1; idx++) {
    const h = sa$$1.dep.predicted_heads[idx] | 0;
    let hbar = h | 0;

    while (hbar !== start ? hbar !== 0 : false) {
      hbar = sa$$1.dep.predicted_heads[hbar];
    }

    if (hbar === start) {
      void dependents.push(h);
    }
  }

  return dependents.slice();
}

function srlArgToIndexMap(srlTags) {
  let elements;
  let array$$3;
  array$$3 = (0, _Array.mapIndexed)(function mapping$$1(i$$1, t) {
    return [(0, _String.substring)(t, t.indexOf("-")), i$$1];
  }, srlTags, Array);
  elements = (0, _Array.groupBy)(function projection(tuple) {
    return tuple[0];
  }, array$$3, Array, {
    Equals($x$$1, $y$$2) {
      return $x$$1 === $y$$2;
    },

    GetHashCode: _Util.structuralHash
  });
  return (0, _Map.ofArray)(elements, {
    Compare: _Util.comparePrimitives
  });
}

function tripleIndicesFromSrlTags(srlTags$$1) {
  let map;
  map = srlArgToIndexMap(srlTags$$1);
  let sortedArgs;
  let array$$5;
  let array$$4;
  array$$4 = (0, _Map.toArray)(map);
  array$$5 = (0, _Array.map)(function mapping$$2(tuple$$1) {
    return tuple$$1[0];
  }, array$$4, Array);
  sortedArgs = array$$5.filter(function predicate(a) {
    return a.indexOf("ARG") === 0;
  });

  if (sortedArgs.length >= 2) {
    return [(0, _Map.FSharpMap$$get_Item$$2B595)(map, sortedArgs[0]), (0, _Map.FSharpMap$$TryFind$$2B595)(map, "V"), (0, _Map.FSharpMap$$get_Item$$2B595)(map, sortedArgs[0])];
  } else {
    return [null, null, null];
  }
}

function triplesFromSentence(sa$$2) {
  let copTuples;
  let array$$7;
  array$$7 = (0, _Array.indexed)(sa$$2.dep.predicted_dependencies);
  copTuples = array$$7.filter(function predicate$$1(tupledArg) {
    return tupledArg[1] === "cop";
  });
  let candidateTriples;
  candidateTriples = (0, _Array.map)(function mapping$$3(v) {
    return tripleIndicesFromSrlTags(v.tags);
  }, sa$$2.srl.verbs, Array);
  return (0, _Array.collect)(function mapping$$7(tupledArg$$1) {
    return (0, _Array.choose)(function chooser(tupledArg$$2) {
      var $target$$22, edge, start$$1, stop;

      if (tupledArg$$2[0] != null) {
        if (tupledArg$$2[1] != null) {
          if (tupledArg$$2[2] != null) {
            $target$$22 = 0;
            edge = tupledArg$$2[1];
            start$$1 = tupledArg$$2[0];
            stop = tupledArg$$2[2];
          } else {
            $target$$22 = 1;
          }
        } else {
          $target$$22 = 1;
        }
      } else {
        $target$$22 = 1;
      }

      switch ($target$$22) {
        case 0:
          {
            if (edge.some(function predicate$$2(tupledArg$$3) {
              return tupledArg$$3[1] === tupledArg$$1[0];
            })) {
              let arg0;
              let start$$2;
              start$$2 = (0, _Array.map)(function mapping$$4(tuple$$2) {
                return tuple$$2[1];
              }, start$$1, Int32Array);
              let edge$$1;
              edge$$1 = (0, _Array.map)(function mapping$$5(tuple$$3) {
                return tuple$$3[1];
              }, edge, Int32Array);
              let stop$$1;
              stop$$1 = (0, _Array.map)(function mapping$$6(tuple$$4) {
                return tuple$$4[1];
              }, stop, Int32Array);
              const trace = new _Types.List(new Tag(0, "Trace", "copIndex:" + (0, _Util.int32ToString)(tupledArg$$1[0])), new _Types.List());
              arg0 = new Triple(start$$2, edge$$1, stop$$1, false, trace);
              return arg0;
            } else {
              return null;
            }
          }

        case 1:
          {
            return null;
          }
      }
    }, candidateTriples, Array);
  }, copTuples, Array);
}

function GetTriples(nlpJsonOption, chunksJsonOption, inputText) {
  return (0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
    var nlpJson, input;
    return (nlpJsonOption == null ? (0, _AllenNLP.GetNLP)(chunksJsonOption, inputText) : (nlpJson = nlpJsonOption, (input = ((0, _Decode.Auto$$$unsafeFromString$$Z5CB6BD)(nlpJson, null, null, {
      ResolveType() {
        return (0, _AllenNLP.DocumentAnnotation$reflection)();
      }

    })), ((0, _AllenNLP.Promisify)(input))))).then(function (_arg1$$1) {
      if (_arg1$$1.tag === 1) {
        return Promise.resolve(new _Option.Result(1, "Error", _arg1$$1.fields[0]));
      } else {
        let triples;
        triples = (0, _Array.map)(triplesFromSentence, _arg1$$1.fields[0].sentences, Array);
        const apiResponse = new InternalAPI(_arg1$$1.fields[0].sentences, _arg1$$1.fields[0].coreference, triples);
        return Promise.resolve(new _Option.Result(0, "Ok", apiResponse));
      }
    });
  }));
}