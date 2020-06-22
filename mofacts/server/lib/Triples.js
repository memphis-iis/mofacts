"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Tag$reflection = Tag$reflection;
exports.Triple$reflection = Triple$reflection;
exports.InternalAPI$reflection = InternalAPI$reflection;
exports.tripleIndicesFromSrlTags = tripleIndicesFromSrlTags;
exports.triplesFromSentence = triplesFromSentence;
exports.GetTriples = GetTriples;
exports.InternalAPI = exports.Triple = exports.Tag = void 0;

var _Types = require("./fable-library.2.8.4/Types");

var _Reflection = require("./fable-library.2.8.4/Reflection");

var _AllenNLP = require("./AllenNLP");

var _Map = require("./fable-library.2.8.4/Map");

var _Array = require("./fable-library.2.8.4/Array");

var _Util = require("./fable-library.2.8.4/Util");

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

function tripleIndicesFromSrlTags(srlTags) {
  let map;
  map = (0, _AllenNLP.srlArgToIndexMap)(srlTags);
  let sortedArgs;
  let array$$1;
  let array;
  array = (0, _Map.toArray)(map);
  array$$1 = (0, _Array.map)(function mapping(tuple) {
    return tuple[0];
  }, array, Array);
  sortedArgs = array$$1.filter(function predicate(a) {
    return a.indexOf("ARG") === 0;
  });

  if (sortedArgs.length >= 2) {
    return [(0, _Map.FSharpMap$$get_Item$$2B595)(map, sortedArgs[0]), (0, _Map.FSharpMap$$TryFind$$2B595)(map, "V"), (0, _Map.FSharpMap$$get_Item$$2B595)(map, sortedArgs[0])];
  } else {
    return [null, null, null];
  }
}

function triplesFromSentence(sa) {
  let copTuples;
  let array$$3;
  array$$3 = (0, _Array.indexed)(sa.dep.predicted_dependencies);
  copTuples = array$$3.filter(function predicate$$1(tupledArg) {
    return tupledArg[1] === "cop";
  });
  let candidateTriples;
  candidateTriples = (0, _Array.map)(function mapping$$1(v) {
    return tripleIndicesFromSrlTags(v.tags);
  }, sa.srl.verbs, Array);
  return (0, _Array.collect)(function mapping$$5(tupledArg$$1) {
    return (0, _Array.choose)(function chooser(tupledArg$$2) {
      var $target$$9, edge, start, stop;

      if (tupledArg$$2[0] != null) {
        if (tupledArg$$2[1] != null) {
          if (tupledArg$$2[2] != null) {
            $target$$9 = 0;
            edge = tupledArg$$2[1];
            start = tupledArg$$2[0];
            stop = tupledArg$$2[2];
          } else {
            $target$$9 = 1;
          }
        } else {
          $target$$9 = 1;
        }
      } else {
        $target$$9 = 1;
      }

      switch ($target$$9) {
        case 0:
          {
            if (edge.some(function predicate$$2(tupledArg$$3) {
              return tupledArg$$3[1] === tupledArg$$1[0];
            })) {
              let arg0;
              let start$$1;
              start$$1 = (0, _Array.map)(function mapping$$2(tuple$$1) {
                return tuple$$1[1];
              }, start, Int32Array);
              let edge$$1;
              edge$$1 = (0, _Array.map)(function mapping$$3(tuple$$2) {
                return tuple$$2[1];
              }, edge, Int32Array);
              let stop$$1;
              stop$$1 = (0, _Array.map)(function mapping$$4(tuple$$3) {
                return tuple$$3[1];
              }, stop, Int32Array);
              const trace = new _Types.List(new Tag(0, "Trace", "copIndex:" + (0, _Util.int32ToString)(tupledArg$$1[0])), new _Types.List());
              arg0 = new Triple(start$$1, edge$$1, stop$$1, false, trace);
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