"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.LemmaRequest$reflection = LemmaRequest$reflection;
exports.LemmaOovRequest$reflection = LemmaOovRequest$reflection;
exports.TagRequest$reflection = TagRequest$reflection;
exports.InflectionOovRequest$reflection = InflectionOovRequest$reflection;
exports.InflectionRequest$reflection = InflectionRequest$reflection;
exports.getLemma = getLemma;
exports.testGetLemma = testGetLemma;
exports.getAllLemmas = getAllLemmas;
exports.getAllLemmasOOV = getAllLemmasOOV;
exports.isTagBaseForm = isTagBaseForm;
exports.getInflection = getInflection;
exports.testGetInflection = testGetInflection;
exports.getAllInflections = getAllInflections;
exports.getAllInflectionsOOV = getAllInflectionsOOV;
exports.InflectionRequest = exports.InflectionOovRequest = exports.TagRequest = exports.LemmaOovRequest = exports.LemmaRequest = exports.lemmInflectEndpoint = void 0;

require("isomorphic-fetch");

var _Types = require("./fable-library.2.10.2/Types");

var _Reflection = require("./fable-library.2.10.2/Reflection");

var _Types2 = require("./Thoth.Json.4.0.0/Types");

var _Util = require("./fable-library.2.10.2/Util");

var _Fetch = require("./Thoth.Fetch.2.0.0/Fetch");

var _PromiseImpl = require("./Fable.Promise.2.1.0/PromiseImpl");

var _Promise = require("./Fable.Promise.2.1.0/Promise");

const lemmInflectEndpoint = "https://lemminflect.olney.ai/api/";
exports.lemmInflectEndpoint = lemmInflectEndpoint;
const LemmaRequest = (0, _Types.declare)(function LemmInflect_LemmaRequest(word, upos) {
  this.word = word;
  this.upos = upos;
}, _Types.Record);
exports.LemmaRequest = LemmaRequest;

function LemmaRequest$reflection() {
  return (0, _Reflection.record_type)("LemmInflect.LemmaRequest", [], LemmaRequest, () => [["word", _Reflection.string_type], ["upos", _Reflection.string_type]]);
}

const LemmaOovRequest = (0, _Types.declare)(function LemmInflect_LemmaOovRequest(word, upos, lemmatize_oov) {
  this.word = word;
  this.upos = upos;
  this.lemmatize_oov = lemmatize_oov;
}, _Types.Record);
exports.LemmaOovRequest = LemmaOovRequest;

function LemmaOovRequest$reflection() {
  return (0, _Reflection.record_type)("LemmInflect.LemmaOovRequest", [], LemmaOovRequest, () => [["word", _Reflection.string_type], ["upos", _Reflection.string_type], ["lemmatize_oov", _Reflection.bool_type]]);
}

const TagRequest = (0, _Types.declare)(function LemmInflect_TagRequest(tag) {
  this.tag = tag;
}, _Types.Record);
exports.TagRequest = TagRequest;

function TagRequest$reflection() {
  return (0, _Reflection.record_type)("LemmInflect.TagRequest", [], TagRequest, () => [["tag", _Reflection.string_type]]);
}

const InflectionOovRequest = (0, _Types.declare)(function LemmInflect_InflectionOovRequest(lemma, tag, inflect_oov) {
  this.lemma = lemma;
  this.tag = tag;
  this.inflect_oov = inflect_oov;
}, _Types.Record);
exports.InflectionOovRequest = InflectionOovRequest;

function InflectionOovRequest$reflection() {
  return (0, _Reflection.record_type)("LemmInflect.InflectionOovRequest", [], InflectionOovRequest, () => [["lemma", _Reflection.string_type], ["tag", _Reflection.string_type], ["inflect_oov", _Reflection.bool_type]]);
}

const InflectionRequest = (0, _Types.declare)(function LemmInflect_InflectionRequest(lemma, upos) {
  this.lemma = lemma;
  this.upos = upos;
}, _Types.Record);
exports.InflectionRequest = InflectionRequest;

function InflectionRequest$reflection() {
  return (0, _Reflection.record_type)("LemmInflect.InflectionRequest", [], InflectionRequest, () => [["lemma", _Reflection.string_type], ["upos", _Reflection.string_type]]);
}

function getLemma(word, upos, lemmatize_oov) {
  return (0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
    return (0, _Fetch.Fetch$$$tryPost$$5760677E)(lemmInflectEndpoint + "getLemma", new LemmaOovRequest(word, upos, lemmatize_oov), undefined, undefined, new _Types2.CaseStrategy(2, "SnakeCase"), undefined, (0, _Util.uncurry)(2, undefined), {
      ResolveType() {
        return (0, _Reflection.array_type)(_Reflection.string_type);
      }

    }, {
      ResolveType() {
        return LemmaOovRequest$reflection();
      }

    });
  }));
}

function testGetLemma(word$$1) {
  return getLemma(word$$1, "NOUN", true);
}

function getAllLemmas(word$$2, upos$$1) {
  return (0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
    return (0, _Fetch.Fetch$$$tryPost$$5760677E)(lemmInflectEndpoint + "getAllLemmas", new LemmaRequest(word$$2, upos$$1), undefined, undefined, new _Types2.CaseStrategy(2, "SnakeCase"), undefined, (0, _Util.uncurry)(2, undefined), {
      ResolveType() {
        return (0, _Reflection.class_type)("Microsoft.FSharp.Collections.FSharpMap`2", [_Reflection.string_type, (0, _Reflection.array_type)(_Reflection.string_type)]);
      }

    }, {
      ResolveType() {
        return LemmaRequest$reflection();
      }

    });
  }));
}

function getAllLemmasOOV(word$$3, upos$$2) {
  return (0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
    return (0, _Fetch.Fetch$$$tryPost$$5760677E)(lemmInflectEndpoint + "getAllLemmasOOV", new LemmaRequest(word$$3, upos$$2), undefined, undefined, new _Types2.CaseStrategy(2, "SnakeCase"), undefined, (0, _Util.uncurry)(2, undefined), {
      ResolveType() {
        return (0, _Reflection.class_type)("Microsoft.FSharp.Collections.FSharpMap`2", [_Reflection.string_type, (0, _Reflection.array_type)(_Reflection.string_type)]);
      }

    }, {
      ResolveType() {
        return LemmaRequest$reflection();
      }

    });
  }));
}

function isTagBaseForm(tag) {
  return (0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
    return (0, _Fetch.Fetch$$$tryPost$$5760677E)(lemmInflectEndpoint + "isTagBaseForm", new TagRequest(tag), undefined, undefined, new _Types2.CaseStrategy(2, "SnakeCase"), undefined, (0, _Util.uncurry)(2, undefined), {
      ResolveType() {
        return _Reflection.bool_type;
      }

    }, {
      ResolveType() {
        return TagRequest$reflection();
      }

    });
  }));
}

function getInflection(lemma, tag$$1, inflect_oov) {
  return (0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
    return (0, _Fetch.Fetch$$$tryPost$$5760677E)(lemmInflectEndpoint + "getInflection", new InflectionOovRequest(lemma, tag$$1, inflect_oov), undefined, undefined, new _Types2.CaseStrategy(2, "SnakeCase"), undefined, (0, _Util.uncurry)(2, undefined), {
      ResolveType() {
        return (0, _Reflection.array_type)(_Reflection.string_type);
      }

    }, {
      ResolveType() {
        return InflectionOovRequest$reflection();
      }

    });
  }));
}

function testGetInflection(lemma$$1) {
  return getInflection(lemma$$1, "NNS", true);
}

function getAllInflections(lemma$$2, upos$$3) {
  return (0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
    return (0, _Fetch.Fetch$$$tryPost$$5760677E)(lemmInflectEndpoint + "getAllInflections", new InflectionRequest(lemma$$2, upos$$3), undefined, undefined, new _Types2.CaseStrategy(2, "SnakeCase"), undefined, (0, _Util.uncurry)(2, undefined), {
      ResolveType() {
        return (0, _Reflection.class_type)("Microsoft.FSharp.Collections.FSharpMap`2", [_Reflection.string_type, (0, _Reflection.array_type)(_Reflection.string_type)]);
      }

    }, {
      ResolveType() {
        return InflectionRequest$reflection();
      }

    });
  }));
}

function getAllInflectionsOOV(lemma$$3, upos$$4) {
  return (0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
    return (0, _Fetch.Fetch$$$tryPost$$5760677E)(lemmInflectEndpoint + "getAllInflectionsOOV", new InflectionRequest(lemma$$3, upos$$4), undefined, undefined, new _Types2.CaseStrategy(2, "SnakeCase"), undefined, (0, _Util.uncurry)(2, undefined), {
      ResolveType() {
        return (0, _Reflection.class_type)("Microsoft.FSharp.Collections.FSharpMap`2", [_Reflection.string_type, (0, _Reflection.array_type)(_Reflection.string_type)]);
      }

    }, {
      ResolveType() {
        return InflectionRequest$reflection();
      }

    });
  }));
}