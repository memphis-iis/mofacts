"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.allOK = allOK;
exports.resultsToType = resultsToType;
exports.resultsToError = resultsToError;
exports.Candidate$reflection = Candidate$reflection;
exports.Entity$reflection = Entity$reflection;
exports.Wikification$reflection = Wikification$reflection;
exports.WikificationRequest$reflection = WikificationRequest$reflection;
exports.GetWikification = GetWikification;
exports.overlap = overlap;
exports.EntityMatch$reflection = EntityMatch$reflection;
exports.WikiTermEntityMatch$reflection = WikiTermEntityMatch$reflection;
exports.GetWikiEntitiesForTerms = GetWikiEntitiesForTerms;
exports.HarnessWikifyAlignRequest$reflection = HarnessWikifyAlignRequest$reflection;
exports.HarnessWikifyAlignRequest$$$InitializeTest = HarnessWikifyAlignRequest$$$InitializeTest;
exports.HarnessWikiAlign = HarnessWikiAlign;
exports.FromTo$reflection = FromTo$reflection;
exports.Page$reflection = Page$reflection;
exports.WikipediaQuery$reflection = WikipediaQuery$reflection;
exports.WikipediaExtractResult$reflection = WikipediaExtractResult$reflection;
exports.GetWikipediaPageFirstParagraph = GetWikipediaPageFirstParagraph;
exports.WikiTermEntityExtracts$reflection = WikiTermEntityExtracts$reflection;
exports.GetWikiExtractsForTerms = GetWikiExtractsForTerms;
exports.HarnessWikiExtracts = HarnessWikiExtracts;
exports.WikiTermEntityExtracts = exports.WikipediaExtractResult = exports.WikipediaQuery = exports.Page = exports.FromTo = exports.HarnessWikifyAlignRequest = exports.WikiTermEntityMatch = exports.EntityMatch = exports.WikificationRequest = exports.endpoint = exports.Wikification = exports.Entity = exports.Candidate = void 0;

require("isomorphic-fetch");

var _Option = require("./fable-library.2.10.2/Option");

var _Array = require("./fable-library.2.10.2/Array");

var _Types = require("./fable-library.2.10.2/Types");

var _Reflection = require("./fable-library.2.10.2/Reflection");

var _PromiseImpl = require("./Fable.Promise.2.1.0/PromiseImpl");

var _Util = require("./fable-library.2.10.2/Util");

var _Fetch = require("./Thoth.Fetch.2.0.0/Fetch");

var _Promise = require("./Fable.Promise.2.1.0/Promise");

var _Seq = require("./fable-library.2.10.2/Seq");

var _RegExp = require("./fable-library.2.10.2/RegExp");

var _Decode = require("./Thoth.Json.4.0.0/Decode");

var _Set = require("./fable-library.2.10.2/Set");

var _Map = require("./fable-library.2.10.2/Map");

function allOK(resultsArr) {
  return resultsArr.every(function predicate(r) {
    if (r.tag === 1) {
      return false;
    } else {
      return true;
    }
  });
}

function resultsToType(resultsArr$$1) {
  return (0, _Array.choose)(function chooser(r$$2) {
    if (r$$2.tag === 1) {
      return undefined;
    } else {
      return (0, _Option.some)(r$$2.fields[0]);
    }
  }, resultsArr$$1, Array);
}

function resultsToError(resultsArr$$2) {
  return (0, _Array.choose)(function chooser$$1(r$$4) {
    if (r$$4.tag === 1) {
      return (0, _Option.some)(r$$4.fields[0]);
    } else {
      return undefined;
    }
  }, resultsArr$$2, Array);
}

const Candidate = (0, _Types.declare)(function Wikifier_Candidate(score, wikiTitle, wikiId, attributes) {
  this.score = score;
  this.wikiTitle = wikiTitle;
  this.wikiId = wikiId | 0;
  this.attributes = attributes;
}, _Types.Record);
exports.Candidate = Candidate;

function Candidate$reflection() {
  return (0, _Reflection.record_type)("Wikifier.Candidate", [], Candidate, () => [["score", _Reflection.float64_type], ["wikiTitle", _Reflection.string_type], ["wikiId", _Reflection.int32_type], ["attributes", _Reflection.string_type]]);
}

const Entity = (0, _Types.declare)(function Wikifier_Entity(surfaceForm, start, stop, candidates) {
  this.surfaceForm = surfaceForm;
  this.start = start | 0;
  this.stop = stop | 0;
  this.candidates = candidates;
}, _Types.Record);
exports.Entity = Entity;

function Entity$reflection() {
  return (0, _Reflection.record_type)("Wikifier.Entity", [], Entity, () => [["surfaceForm", _Reflection.string_type], ["start", _Reflection.int32_type], ["stop", _Reflection.int32_type], ["candidates", (0, _Reflection.array_type)(Candidate$reflection())]]);
}

const Wikification = (0, _Types.declare)(function Wikifier_Wikification(inputText, entities) {
  this.inputText = inputText;
  this.entities = entities;
}, _Types.Record);
exports.Wikification = Wikification;

function Wikification$reflection() {
  return (0, _Reflection.record_type)("Wikifier.Wikification", [], Wikification, () => [["inputText", _Reflection.string_type], ["entities", (0, _Reflection.array_type)(Entity$reflection())]]);
}

const endpoint = "http://127.0.0.1:8800/";
exports.endpoint = endpoint;
const WikificationRequest = (0, _Types.declare)(function Wikifier_WikificationRequest(text) {
  this.text = text;
}, _Types.Record);
exports.WikificationRequest = WikificationRequest;

function WikificationRequest$reflection() {
  return (0, _Reflection.record_type)("Wikifier.WikificationRequest", [], WikificationRequest, () => [["text", _Reflection.string_type]]);
}

function GetWikification(text) {
  return (0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
    return text.trim().length < 5 ? Promise.resolve(new _Option.Result(0, "Ok", new Wikification(text, new Array(0)))) : (0, _Fetch.Fetch$$$tryPost$$5760677E)(endpoint + "wikify", new WikificationRequest(text), undefined, undefined, undefined, undefined, (0, _Util.uncurry)(2, undefined), {
      ResolveType() {
        return Wikification$reflection();
      }

    }, {
      ResolveType() {
        return WikificationRequest$reflection();
      }

    });
  }));
}

function overlap(startA, stopA, startB, stopB) {
  if (startA < stopB ? startB < stopA : false) {
    const maxStart = (startA < startB ? startB : startA) | 0;
    const minStop = (stopA < stopB ? stopA : stopB) | 0;
    return (minStop - maxStart) / (stopA - startA);
  } else {
    return 0;
  }
}

const EntityMatch = (0, _Types.declare)(function Wikifier_EntityMatch(Coverage, Entity) {
  this.Coverage = Coverage;
  this.Entity = Entity;
}, _Types.Record);
exports.EntityMatch = EntityMatch;

function EntityMatch$reflection() {
  return (0, _Reflection.record_type)("Wikifier.EntityMatch", [], EntityMatch, () => [["Coverage", _Reflection.float64_type], ["Entity", Entity$reflection()]]);
}

const WikiTermEntityMatch = (0, _Types.declare)(function Wikifier_WikiTermEntityMatch(Term, Start, Stop, EntityMatches) {
  this.Term = Term;
  this.Start = Start | 0;
  this.Stop = Stop | 0;
  this.EntityMatches = EntityMatches;
}, _Types.Record);
exports.WikiTermEntityMatch = WikiTermEntityMatch;

function WikiTermEntityMatch$reflection() {
  return (0, _Reflection.record_type)("Wikifier.WikiTermEntityMatch", [], WikiTermEntityMatch, () => [["Term", _Reflection.string_type], ["Start", _Reflection.int32_type], ["Stop", _Reflection.int32_type], ["EntityMatches", (0, _Reflection.array_type)(EntityMatch$reflection())]]);
}

function GetWikiEntitiesForTerms(text$$1, terms) {
  return (0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
    return (GetWikification(text$$1)).then(function (_arg1) {
      if (_arg1.tag === 1) {
        return Promise.resolve(new _Option.Result(1, "Error", _arg1.fields[0]));
      } else {
        const wikiTermEntityMatches = (0, _Array.ofSeq)((0, _Seq.delay)(function () {
          return (0, _Seq.collect)(function (t) {
            var source;
            return (0, _Seq.collect)(function (m) {
              const startA$$1 = m.index | 0;
              const stopA$$1 = m.index + m[0].length | 0;
              const entityMatches = (0, _Array.ofSeq)((0, _Seq.delay)(function () {
                return (0, _Seq.collect)(function (e$$2) {
                  const coverage = overlap(startA$$1, stopA$$1, e$$2.start, e$$2.stop);
                  return coverage > 0 ? (0, _Seq.singleton)(new EntityMatch(coverage, e$$2)) : (0, _Seq.empty)();
                }, _arg1.fields[0].entities);
              }), Array);
              return entityMatches.length > 0 ? (0, _Seq.singleton)(new WikiTermEntityMatch(t, startA$$1, stopA$$1, entityMatches)) : (0, _Seq.empty)();
            }, (source = (0, _RegExp.matches)(text$$1, "\\b" + t + "\\b", 1), (source)));
          }, terms);
        }), Array);
        return Promise.resolve(new _Option.Result(0, "Ok", wikiTermEntityMatches));
      }
    });
  }));
}

const HarnessWikifyAlignRequest = (0, _Types.declare)(function Wikifier_HarnessWikifyAlignRequest(Text$, Terms) {
  this.Text = Text$;
  this.Terms = Terms;
}, _Types.Record);
exports.HarnessWikifyAlignRequest = HarnessWikifyAlignRequest;

function HarnessWikifyAlignRequest$reflection() {
  return (0, _Reflection.record_type)("Wikifier.HarnessWikifyAlignRequest", [], HarnessWikifyAlignRequest, () => [["Text", _Reflection.string_type], ["Terms", (0, _Reflection.array_type)(_Reflection.string_type)]]);
}

function HarnessWikifyAlignRequest$$$InitializeTest() {
  return new HarnessWikifyAlignRequest("Emotional stress can either increase or decrease TRH and TSH secretion, depending upon circumstances.", ["TSH secretion", "TRH", "emotional stress"]);
}

function HarnessWikiAlign(jsonRequest) {
  let request;
  request = (0, _Decode.Auto$$$unsafeFromString$$Z5CB6BD)(jsonRequest, undefined, undefined, {
    ResolveType() {
      return HarnessWikifyAlignRequest$reflection();
    }

  });
  return GetWikiEntitiesForTerms(request.Text, request.Terms);
}

const FromTo = (0, _Types.declare)(function Wikifier_FromTo(from, to) {
  this.from = from;
  this.to = to;
}, _Types.Record);
exports.FromTo = FromTo;

function FromTo$reflection() {
  return (0, _Reflection.record_type)("Wikifier.FromTo", [], FromTo, () => [["from", _Reflection.string_type], ["to", _Reflection.string_type]]);
}

const Page = (0, _Types.declare)(function Wikifier_Page(pageid, ns, title, extract, missing) {
  this.pageid = pageid | 0;
  this.ns = ns;
  this.title = title;
  this.extract = extract;
  this.missing = missing;
}, _Types.Record);
exports.Page = Page;

function Page$reflection() {
  return (0, _Reflection.record_type)("Wikifier.Page", [], Page, () => [["pageid", _Reflection.int32_type], ["ns", (0, _Reflection.option_type)(_Reflection.int32_type)], ["title", (0, _Reflection.option_type)(_Reflection.string_type)], ["extract", (0, _Reflection.option_type)(_Reflection.string_type)], ["missing", (0, _Reflection.option_type)(_Reflection.string_type)]]);
}

const WikipediaQuery = (0, _Types.declare)(function Wikifier_WikipediaQuery(normalized, redirects, pages) {
  this.normalized = normalized;
  this.redirects = redirects;
  this.pages = pages;
}, _Types.Record);
exports.WikipediaQuery = WikipediaQuery;

function WikipediaQuery$reflection() {
  return (0, _Reflection.record_type)("Wikifier.WikipediaQuery", [], WikipediaQuery, () => [["normalized", (0, _Reflection.option_type)((0, _Reflection.array_type)(FromTo$reflection()))], ["redirects", (0, _Reflection.option_type)((0, _Reflection.array_type)(FromTo$reflection()))], ["pages", (0, _Reflection.class_type)("Microsoft.FSharp.Collections.FSharpMap`2", [_Reflection.string_type, Page$reflection()])]]);
}

const WikipediaExtractResult = (0, _Types.declare)(function Wikifier_WikipediaExtractResult(batchcomplete, query) {
  this.batchcomplete = batchcomplete;
  this.query = query;
}, _Types.Record);
exports.WikipediaExtractResult = WikipediaExtractResult;

function WikipediaExtractResult$reflection() {
  return (0, _Reflection.record_type)("Wikifier.WikipediaExtractResult", [], WikipediaExtractResult, () => [["batchcomplete", _Reflection.string_type], ["query", WikipediaQuery$reflection()]]);
}

function GetWikipediaPageFirstParagraph(pageId) {
  return (0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
    return new Promise(resolve => setTimeout(resolve, 100)).then(function () {
      const wikipediaQuery = "https://en.wikipedia.org/w/api.php?format=json&action=query&prop=extracts&exintro&explaintext&redirects=1&origin=*&pageids=" + (0, _Util.int32ToString)(pageId);
      return (0, _Fetch.Fetch$$$tryGet$$5760677E)(wikipediaQuery, undefined, undefined, undefined, undefined, undefined, (0, _Util.uncurry)(2, undefined), {
        ResolveType() {
          return WikipediaExtractResult$reflection();
        }

      }, {
        ResolveType() {
          return _Reflection.obj_type;
        }

      });
    });
  }));
}

const WikiTermEntityExtracts = (0, _Types.declare)(function Wikifier_WikiTermEntityExtracts(WikiTermEntityMatches, Pages) {
  this.WikiTermEntityMatches = WikiTermEntityMatches;
  this.Pages = Pages;
}, _Types.Record);
exports.WikiTermEntityExtracts = WikiTermEntityExtracts;

function WikiTermEntityExtracts$reflection() {
  return (0, _Reflection.record_type)("Wikifier.WikiTermEntityExtracts", [], WikiTermEntityExtracts, () => [["WikiTermEntityMatches", (0, _Reflection.array_type)(WikiTermEntityMatch$reflection())], ["Pages", (0, _Reflection.array_type)(Page$reflection())]]);
}

function GetWikiExtractsForTerms(text$$3, terms$$1) {
  return (0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
    return GetWikiEntitiesForTerms(text$$3, terms$$1).then(function (_arg1$$2) {
      var pr;
      return _arg1$$2.tag === 1 ? Promise.resolve(new _Option.Result(1, "Error", _arg1$$2.fields[0])) : (pr = ((0, _Seq.collect)(function mapping(wtem) {
        let source$$3;
        let source$$2;
        source$$2 = (0, _Seq.choose)(function chooser$$2(em) {
          if (!(0, _Array.equalsWith)(function ($x$$1, $y$$2) {
            return $x$$1.CompareTo($y$$2);
          }, em.Entity.candidates, null) ? em.Entity.candidates.length > 0 : false) {
            let max;
            max = (0, _Array.maxBy)(function projection(c) {
              return c.score;
            }, em.Entity.candidates, {
              Compare: _Util.comparePrimitives
            });
            return max.wikiId;
          } else {
            return undefined;
          }
        }, wtem.EntityMatches);
        source$$3 = (0, _Set.distinct)(source$$2, {
          Equals($x$$5, $y$$6) {
            return $x$$5 === $y$$6;
          },

          GetHashCode: _Util.structuralHash
        });
        return (0, _Seq.map)(GetWikipediaPageFirstParagraph, source$$3);
      }, _arg1$$2.fields[0])), (Promise.all(pr))).then(function (_arg2) {
        var array$$7;

        if (allOK(_arg2)) {
          let pages;
          let array$$6;
          let array$$5;
          array$$5 = resultsToType(_arg2);
          array$$6 = (0, _Array.collect)(function mapping$$2(wer) {
            let array$$4;
            array$$4 = (0, _Map.toArray)(wer.query.pages);
            return (0, _Array.map)(function mapping$$1(tuple) {
              return tuple[1];
            }, array$$4, Array);
          }, array$$5, Array);
          pages = (0, _Array.distinctBy)(function projection$$1(p) {
            return p.pageid;
          }, array$$6, {
            Equals($x$$7, $y$$8) {
              return $x$$7 === $y$$8;
            },

            GetHashCode: _Util.structuralHash
          });
          return Promise.resolve(new _Option.Result(0, "Ok", new WikiTermEntityExtracts(_arg1$$2.fields[0], pages)));
        } else {
          return Promise.resolve(new _Option.Result(1, "Error", (array$$7 = (resultsToError(_arg2)), ((0, _Array.head)(array$$7)))));
        }
      });
    });
  }));
}

function HarnessWikiExtracts(jsonRequest$$1) {
  let request$$1;
  request$$1 = (0, _Decode.Auto$$$unsafeFromString$$Z5CB6BD)(jsonRequest$$1, undefined, undefined, {
    ResolveType() {
      return HarnessWikifyAlignRequest$reflection();
    }

  });
  return GetWikiExtractsForTerms(request$$1.Text, request$$1.Terms);
}