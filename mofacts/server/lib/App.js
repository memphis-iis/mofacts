"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.randomFeature = randomFeature;
exports.Model$reflection = Model$reflection;
exports.Msg$reflection = Msg$reflection;
exports.init = init;
exports.ParseIntOption = ParseIntOption;
exports.makeCmd = makeCmd;
exports.update = update;
exports.simpleButton = simpleButton;
exports.simpleModeView = simpleModeView;
exports.expertModeView = expertModeView;
exports.view = view;
exports.Msg = exports.Model = void 0;

var _List = require("./fable-library.2.10.2/List");

var _Types = require("./fable-library.2.10.2/Types");

var _Reflection = require("./fable-library.2.10.2/Reflection");

var _Int = require("./fable-library.2.10.2/Int32");

var _cmd = require("./Fable.Elmish.3.0.6/cmd");

var _AllenNLP = require("./AllenNLP");

var _Encode = require("./Thoth.Json.4.0.0/Encode");

var _ClozeAPI = require("./ClozeAPI");

var _Double = require("./fable-library.2.10.2/Double");

var _Triples = require("./Triples");

var _DefinitionalFeedback = require("./DefinitionalFeedback");

var _ElaboratedFeedback = require("./ElaboratedFeedback");

var _CachedElaboratedFeedback = require("./CachedElaboratedFeedback");

var _LemmInflect = require("./LemmInflect");

var _Paraphrase = require("./Paraphrase");

var _QuestionGenerator = require("./QuestionGenerator");

var _LongformQA = require("./LongformQA");

var _Wikifier = require("./Wikifier");

var _SpellingCorrector = require("./SpellingCorrector");

var _TutorialDialogue = require("./TutorialDialogue");

var _Decode = require("./Thoth.Json.4.0.0/Decode");

var _Date = require("./fable-library.2.10.2/Date");

var _FableReact = require("./Fable.React.8.0.1/Fable.React.Props");

var _Util = require("./fable-library.2.10.2/Util");

var react = _interopRequireWildcard(require("react"));

var _Container = require("./Layouts/Container");

var _Heading = require("./Elements/Heading");

var _Content = require("./Elements/Content");

var _Column = require("./Layouts/Column");

var _Common = require("./Fulma.2.16.0/Common");

var _Label = require("./Form/Label");

var _Input = require("./Form/Input");

var _File = require("./Form/File");

var _FontAwesome = require("./Fable.FontAwesome.2.0.0/FontAwesome");

var _Icon = require("./Elements/Icon");

var _Seq = require("./fable-library.2.10.2/Seq");

var _Button = require("./Elements/Button");

var _Columns = require("./Layouts/Columns");

var _Section = require("./Layouts/Section");

var _FableReact2 = require("./Fable.React.8.0.1/Fable.React.Extensions");

var _Select = require("./Form/Select");

var _Control = require("./Form/Control");

var _Field = require("./Form/Field");

var _String = require("./fable-library.2.10.2/String");

var _program = require("./Fable.Elmish.3.0.6/program");

var _react2 = require("./Fable.Elmish.React.3.0.1/react");

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function () { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function randomFeature() {
  return (0, _List.ofArray)([1, 2, 3]);
}

const Model = (0, _Types.declare)(function App_Model(Mode, InputText, Service, Status, JsonResult, JsonInput, JsonFileName, DesiredSentences, DesiredItems, Percentage, ParseJson, ParseFileName, ParaphraseFileName) {
  this.Mode = Mode;
  this.InputText = InputText;
  this.Service = Service;
  this.Status = Status;
  this.JsonResult = JsonResult;
  this.JsonInput = JsonInput;
  this.JsonFileName = JsonFileName;
  this.DesiredSentences = DesiredSentences;
  this.DesiredItems = DesiredItems;
  this.Percentage = Percentage;
  this.ParseJson = ParseJson;
  this.ParseFileName = ParseFileName;
  this.ParaphraseFileName = ParaphraseFileName;
}, _Types.Record);
exports.Model = Model;

function Model$reflection() {
  return (0, _Reflection.record_type)("App.Model", [], Model, () => [["Mode", _Reflection.string_type], ["InputText", _Reflection.string_type], ["Service", _Reflection.string_type], ["Status", _Reflection.string_type], ["JsonResult", _Reflection.string_type], ["JsonInput", (0, _Reflection.option_type)(_Reflection.string_type)], ["JsonFileName", (0, _Reflection.option_type)(_Reflection.string_type)], ["DesiredSentences", _Reflection.string_type], ["DesiredItems", _Reflection.string_type], ["Percentage", _Reflection.string_type], ["ParseJson", (0, _Reflection.option_type)(_Reflection.string_type)], ["ParseFileName", (0, _Reflection.option_type)(_Reflection.string_type)], ["ParaphraseFileName", (0, _Reflection.option_type)(_Reflection.string_type)]]);
}

const Msg = (0, _Types.declare)(function App_Msg(tag, name, ...fields) {
  this.tag = tag | 0;
  this.name = name;
  this.fields = fields;
}, _Types.Union);
exports.Msg = Msg;

function Msg$reflection() {
  return (0, _Reflection.union_type)("App.Msg", [], Msg, () => [["UpdateText", [["Item", _Reflection.string_type]]], "CallService", ["ServiceResult", [["Item1", _Reflection.string_type], ["Item2", _Reflection.string_type]]], ["ServiceChange", [["Item", _Reflection.string_type]]], "DownloadJson", "JsonToInput", ["LoadJsonFile", [["Item", (0, _Reflection.class_type)("Browser.Types.FileList")]]], ["SetJson", [["Item", _Reflection.string_type]]], "ClearJson", ["UpdateSentences", [["Item", _Reflection.string_type]]], ["UpdateItems", [["Item", _Reflection.string_type]]], ["UpdatePercentage", [["Item", _Reflection.string_type]]], "ExpertMode", ["LoadJsonParseFile", [["Item", (0, _Reflection.class_type)("Browser.Types.FileList")]]], ["SetParseJson", [["Item", _Reflection.string_type]]], "ClearParseJson", ["LoadParaphraseFile", [["Item", (0, _Reflection.class_type)("Browser.Types.FileList")]]], ["SetParaphrases", [["Item", _Reflection.string_type]]]]);
}

function init() {
  return [new Model("simple", "Paste text here or leave blank and upload respective JSON files.", "selectClozePercentage", "", "", undefined, undefined, "", "", "0.05", undefined, undefined, undefined), new _Types.List()];
}

function ParseIntOption(s) {
  const matchValue = (0, _Int.tryParse)(s, 511, false, 32);

  if (matchValue[0]) {
    return matchValue[1];
  } else {
    return undefined;
  }
}

function makeCmd(serviceCall, input, resultWrapper) {
  return (0, _cmd.Cmd$002EOfPromise$$$perform)(serviceCall, input, function (result) {
    return resultWrapper(result);
  });
}

function update(msg, model) {
  var stringArrayJsonOption$$1, sentenceCountOption, itemCountOption, stringArrayJsonOption$$2, percentage, chunksJsonOption, json, copyOfStruct$$31, JsonFileName, JsonInput, JsonInput$$1, ParseFileName, ParseJson, ParseJson$$1, ParaphraseFileName;

  switch (msg.tag) {
    case 1:
      {
        const cmd = model.Service === "dependencyParser" ? makeCmd(_AllenNLP.GetDependencyParse, model.InputText, function (result$$3) {
          var copyOfStruct$$1;
          return result$$3.tag === 1 ? new Msg(2, "ServiceResult", "Error! ", (copyOfStruct$$1 = result$$3.fields[0], String(copyOfStruct$$1))) : new Msg(2, "ServiceResult", "Execution completed!", (0, _Encode.Auto$$$toString$$5A41365E)(4, result$$3.fields[0], undefined, undefined, undefined, {
            ResolveType() {
              return (0, _AllenNLP.DependencyParse$reflection)();
            }

          }));
        }) : model.Service === "coreference" ? makeCmd(_AllenNLP.GetCoreference, model.InputText, function (result$$5) {
          var copyOfStruct$$2;
          return result$$5.tag === 1 ? new Msg(2, "ServiceResult", "Error! ", (copyOfStruct$$2 = result$$5.fields[0], String(copyOfStruct$$2))) : new Msg(2, "ServiceResult", "Execution completed!", (0, _Encode.Auto$$$toString$$5A41365E)(4, result$$5.fields[0], undefined, undefined, undefined, {
            ResolveType() {
              return (0, _AllenNLP.Coreference$reflection)();
            }

          }));
        }) : model.Service === "sentenceSplitter" ? makeCmd(_AllenNLP.GetSentences, model.InputText, function (result$$7) {
          var copyOfStruct$$3;
          return result$$7.tag === 1 ? new Msg(2, "ServiceResult", "Error! ", (copyOfStruct$$3 = result$$7.fields[0], String(copyOfStruct$$3))) : new Msg(2, "ServiceResult", "Execution completed!", (0, _Encode.Auto$$$toString$$5A41365E)(4, result$$7.fields[0], undefined, undefined, undefined, {
            ResolveType() {
              return (0, _Reflection.array_type)(_Reflection.string_type);
            }

          }));
        }) : model.Service === "cleanText" ? makeCmd(function ($arg$$1) {
          let input$$7;
          input$$7 = (0, _AllenNLP.CleanText)($arg$$1);
          return (0, _AllenNLP.Promisify)(input$$7);
        }, model.InputText, function (result$$9) {
          var copyOfStruct$$4;
          return result$$9.tag === 1 ? new Msg(2, "ServiceResult", "Error! ", (copyOfStruct$$4 = result$$9.fields[0], String(copyOfStruct$$4))) : new Msg(2, "ServiceResult", "Execution completed!", (0, _Encode.Auto$$$toString$$5A41365E)(4, result$$9.fields[0], undefined, undefined, undefined, {
            ResolveType() {
              return _Reflection.string_type;
            }

          }));
        }) : model.Service === "nLP" ? makeCmd(function (inputText) {
          return (0, _AllenNLP.GetNLP)(model.JsonInput, inputText);
        }, model.InputText, function (result$$11) {
          var copyOfStruct$$5;
          return result$$11.tag === 1 ? new Msg(2, "ServiceResult", "Error! ", (copyOfStruct$$5 = result$$11.fields[0], copyOfStruct$$5)) : new Msg(2, "ServiceResult", "Execution completed!", (0, _Encode.Auto$$$toString$$5A41365E)(4, result$$11.fields[0], undefined, undefined, undefined, {
            ResolveType() {
              return (0, _AllenNLP.DocumentAnnotation$reflection)();
            }

          }));
        }) : model.Service === "acronym" ? makeCmd(function ($arg$$2) {
          let input$$9;
          input$$9 = (0, _ClozeAPI.GetAcronymMap)($arg$$2);
          return (0, _AllenNLP.Promisify)(input$$9);
        }, model.InputText, function (result$$13) {
          var copyOfStruct$$6;
          return result$$13.tag === 1 ? new Msg(2, "ServiceResult", "Error! ", (copyOfStruct$$6 = result$$13.fields[0], String(copyOfStruct$$6))) : new Msg(2, "ServiceResult", "Execution completed!", (0, _Encode.Auto$$$toString$$5A41365E)(4, result$$13.fields[0], undefined, undefined, undefined, {
            ResolveType() {
              return _Reflection.string_type;
            }

          }));
        }) : model.Service === "reverse" ? makeCmd(function ($arg$$3) {
          let input$$11;
          input$$11 = (0, _ClozeAPI.DoSimpleComputation)($arg$$3);
          return (0, _AllenNLP.Promisify)(input$$11);
        }, model.InputText, function (result$$15) {
          var copyOfStruct$$7;
          return result$$15.tag === 1 ? new Msg(2, "ServiceResult", "Error! ", (copyOfStruct$$7 = result$$15.fields[0], String(copyOfStruct$$7))) : new Msg(2, "ServiceResult", "Execution completed!", (0, _Encode.Auto$$$toString$$5A41365E)(4, result$$15.fields[0], undefined, undefined, undefined, {
            ResolveType() {
              return _Reflection.string_type;
            }

          }));
        }) : model.Service === "allCloze" ? makeCmd((stringArrayJsonOption$$1 = undefined, function (inputText$$1) {
          return (0, _ClozeAPI.GetAllCloze)(model.JsonInput, stringArrayJsonOption$$1, inputText$$1);
        }), model.InputText, function (result$$17) {
          var copyOfStruct$$8;
          return result$$17.tag === 1 ? new Msg(2, "ServiceResult", "Error! ", (copyOfStruct$$8 = result$$17.fields[0], copyOfStruct$$8)) : new Msg(2, "ServiceResult", "Execution completed!", (0, _Encode.Auto$$$toString$$5A41365E)(4, result$$17.fields[0], undefined, undefined, undefined, {
            ResolveType() {
              return (0, _ClozeAPI.InternalAPI$reflection)();
            }

          }));
        }) : model.Service === "selectCloze" ? makeCmd((sentenceCountOption = (ParseIntOption(model.DesiredSentences)), (itemCountOption = (ParseIntOption(model.DesiredItems)), (stringArrayJsonOption$$2 = undefined, function (inputText$$2) {
          return (0, _ClozeAPI.GetSelectCloze)(model.JsonInput, sentenceCountOption, itemCountOption, true, stringArrayJsonOption$$2, inputText$$2);
        }))), model.InputText, function (result$$19) {
          var copyOfStruct$$9;
          return result$$19.tag === 1 ? new Msg(2, "ServiceResult", "Error! ", (copyOfStruct$$9 = result$$19.fields[0], copyOfStruct$$9)) : new Msg(2, "ServiceResult", "Execution completed!", (0, _Encode.Auto$$$toString$$5A41365E)(4, result$$19.fields[0], undefined, undefined, undefined, {
            ResolveType() {
              return (0, _ClozeAPI.ClozeAPI$reflection)();
            }

          }));
        }) : model.Service === "selectClozePercentage" ? makeCmd((percentage = ((0, _Double.parse)(model.Percentage)), function (inputText$$3) {
          return (0, _ClozeAPI.GetSelectClozePercentage)(percentage, model.JsonInput, model.ParseJson, inputText$$3);
        }), model.InputText, function (result$$21) {
          var copyOfStruct$$10;
          return result$$21.tag === 1 ? new Msg(2, "ServiceResult", "Error! ", (copyOfStruct$$10 = result$$21.fields[0], copyOfStruct$$10)) : new Msg(2, "ServiceResult", "Execution completed!", (0, _Encode.Auto$$$toString$$5A41365E)(4, result$$21.fields[0], undefined, undefined, undefined, {
            ResolveType() {
              return (0, _ClozeAPI.MofactsStimFile0522$reflection)();
            }

          }));
        }) : model.Service === "triples" ? makeCmd((chunksJsonOption = undefined, function (inputText$$4) {
          return (0, _Triples.GetTriples)(model.JsonInput, chunksJsonOption, inputText$$4);
        }), model.InputText, function (result$$23) {
          var copyOfStruct$$11;
          return result$$23.tag === 1 ? new Msg(2, "ServiceResult", "Error! ", (copyOfStruct$$11 = result$$23.fields[0], copyOfStruct$$11)) : new Msg(2, "ServiceResult", "Execution completed!", (0, _Encode.Auto$$$toString$$5A41365E)(4, result$$23.fields[0], undefined, undefined, undefined, {
            ResolveType() {
              return (0, _Triples.InternalAPI$reflection)();
            }

          }));
        }) : model.Service === "definitionalFeedback" ? makeCmd(_DefinitionalFeedback.HarnessGenerateFeedback, model.InputText, function (result$$25) {
          var copyOfStruct$$12;
          return result$$25.tag === 1 ? new Msg(2, "ServiceResult", "Error! ", (copyOfStruct$$12 = result$$25.fields[0], copyOfStruct$$12)) : new Msg(2, "ServiceResult", "Execution completed!", (0, _Encode.Auto$$$toString$$5A41365E)(4, result$$25.fields[0], undefined, undefined, undefined, {
            ResolveType() {
              return (0, _DefinitionalFeedback.Feedback$reflection)();
            }

          }));
        }) : model.Service === "elaboratedFeedback" ? makeCmd(_ElaboratedFeedback.HarnessGetElaboratedFeedback, model.InputText, function (result$$27) {
          var copyOfStruct$$13;
          return result$$27.tag === 1 ? new Msg(2, "ServiceResult", "Error! ", (copyOfStruct$$13 = result$$27.fields[0], String(copyOfStruct$$13))) : new Msg(2, "ServiceResult", "Execution completed!", (0, _Encode.Auto$$$toString$$5A41365E)(4, result$$27.fields[0], undefined, undefined, undefined, {
            ResolveType() {
              return (0, _ElaboratedFeedback.ElaboratedFeedback$reflection)();
            }

          }));
        }) : model.Service === "cachedElaboratedFeedback" ? makeCmd(_CachedElaboratedFeedback.HarnessGenerateFeedback, model.InputText, function (result$$29) {
          var copyOfStruct$$14;
          return result$$29.tag === 1 ? new Msg(2, "ServiceResult", "Error! ", (copyOfStruct$$14 = result$$29.fields[0], copyOfStruct$$14)) : new Msg(2, "ServiceResult", "Execution completed!", (0, _Encode.Auto$$$toString$$5A41365E)(4, result$$29.fields[0], undefined, undefined, undefined, {
            ResolveType() {
              return (0, _CachedElaboratedFeedback.Feedback$reflection)();
            }

          }));
        }) : model.Service === "lemma" ? makeCmd(_LemmInflect.testGetLemma, model.InputText, function (result$$31) {
          var copyOfStruct$$15;
          return result$$31.tag === 1 ? new Msg(2, "ServiceResult", "Error! ", (copyOfStruct$$15 = result$$31.fields[0], String(copyOfStruct$$15))) : new Msg(2, "ServiceResult", "Execution completed!", (0, _Encode.Auto$$$toString$$5A41365E)(4, result$$31.fields[0], undefined, undefined, undefined, {
            ResolveType() {
              return (0, _Reflection.array_type)(_Reflection.string_type);
            }

          }));
        }) : model.Service === "inflection" ? makeCmd(_LemmInflect.testGetInflection, model.InputText, function (result$$33) {
          var copyOfStruct$$16;
          return result$$33.tag === 1 ? new Msg(2, "ServiceResult", "Error! ", (copyOfStruct$$16 = result$$33.fields[0], String(copyOfStruct$$16))) : new Msg(2, "ServiceResult", "Execution completed!", (0, _Encode.Auto$$$toString$$5A41365E)(4, result$$33.fields[0], undefined, undefined, undefined, {
            ResolveType() {
              return (0, _Reflection.array_type)(_Reflection.string_type);
            }

          }));
        }) : model.Service === "paraphrase" ? makeCmd(_Paraphrase.getParaphrases, model.InputText, function (result$$35) {
          var copyOfStruct$$17;
          return result$$35.tag === 1 ? new Msg(2, "ServiceResult", "Error! ", (copyOfStruct$$17 = result$$35.fields[0], String(copyOfStruct$$17))) : new Msg(2, "ServiceResult", "Execution completed!", (0, _Encode.Auto$$$toString$$5A41365E)(4, result$$35.fields[0], undefined, undefined, undefined, {
            ResolveType() {
              return _Reflection.string_type;
            }

          }));
        }) : model.Service === "resolveTextReferents" ? makeCmd(_AllenNLP.ResolveTextReferents, model.InputText, function (result$$37) {
          var copyOfStruct$$18;
          return result$$37.tag === 1 ? new Msg(2, "ServiceResult", "Error! ", (copyOfStruct$$18 = result$$37.fields[0], copyOfStruct$$18)) : new Msg(2, "ServiceResult", "Execution completed!", (0, _Encode.Auto$$$toString$$5A41365E)(4, result$$37.fields[0], undefined, undefined, undefined, {
            ResolveType() {
              return (0, _Reflection.anonRecord_type)(["documentAnnotation", (0, _AllenNLP.DocumentAnnotation$reflection)()], ["resolvedSentences", (0, _Reflection.array_type)(_Reflection.string_type)]);
            }

          }));
        }) : model.Service === "generateQuestions" ? makeCmd(_QuestionGenerator.HarnessGetQuestions, model.InputText, function (result$$39) {
          var copyOfStruct$$19;
          return result$$39.tag === 1 ? new Msg(2, "ServiceResult", "Error! ", (copyOfStruct$$19 = result$$39.fields[0], copyOfStruct$$19)) : new Msg(2, "ServiceResult", "Execution completed!", (0, _Encode.Auto$$$toString$$5A41365E)(4, result$$39.fields[0], undefined, undefined, undefined, {
            ResolveType() {
              return (0, _Reflection.array_type)((0, _QuestionGenerator.Question$reflection)());
            }

          }));
        }) : model.Service === "answerQuestion" ? makeCmd(_LongformQA.testAnswer, model.InputText, function (result$$41) {
          var copyOfStruct$$20;
          return result$$41.tag === 1 ? new Msg(2, "ServiceResult", "Error! ", (copyOfStruct$$20 = result$$41.fields[0], String(copyOfStruct$$20))) : new Msg(2, "ServiceResult", "Execution completed!", (0, _Encode.Auto$$$toString$$5A41365E)(4, result$$41.fields[0], undefined, undefined, undefined, {
            ResolveType() {
              return (0, _LongformQA.Answer$reflection)();
            }

          }));
        }) : model.Service === "wikify" ? makeCmd(_Wikifier.GetWikification, model.InputText, function (result$$43) {
          var copyOfStruct$$21;
          return result$$43.tag === 1 ? new Msg(2, "ServiceResult", "Error! ", (copyOfStruct$$21 = result$$43.fields[0], String(copyOfStruct$$21))) : new Msg(2, "ServiceResult", "Execution completed!", (0, _Encode.Auto$$$toString$$5A41365E)(4, result$$43.fields[0], undefined, undefined, undefined, {
            ResolveType() {
              return (0, _Wikifier.Wikification$reflection)();
            }

          }));
        }) : model.Service === "wikiAlign" ? makeCmd(_Wikifier.HarnessWikiAlign, model.InputText, function (result$$45) {
          var copyOfStruct$$22;
          return result$$45.tag === 1 ? new Msg(2, "ServiceResult", "Error! ", (copyOfStruct$$22 = result$$45.fields[0], String(copyOfStruct$$22))) : new Msg(2, "ServiceResult", "Execution completed!", (0, _Encode.Auto$$$toString$$5A41365E)(4, result$$45.fields[0], undefined, undefined, undefined, {
            ResolveType() {
              return (0, _Reflection.array_type)((0, _Wikifier.WikiTermEntityMatch$reflection)());
            }

          }));
        }) : model.Service === "wikiExtracts" ? makeCmd(_Wikifier.HarnessWikiExtracts, model.InputText, function (result$$47) {
          var copyOfStruct$$23;
          return result$$47.tag === 1 ? new Msg(2, "ServiceResult", "Error! ", (copyOfStruct$$23 = result$$47.fields[0], String(copyOfStruct$$23))) : new Msg(2, "ServiceResult", "Execution completed!", (0, _Encode.Auto$$$toString$$5A41365E)(4, result$$47.fields[0], undefined, undefined, undefined, {
            ResolveType() {
              return (0, _Wikifier.WikiTermEntityExtracts$reflection)();
            }

          }));
        }) : model.Service === "initializeCachedElaboratedFeedback" ? makeCmd(_CachedElaboratedFeedback.Initialize, model.JsonInput, function (result$$49) {
          var copyOfStruct$$24;
          return result$$49.tag === 1 ? new Msg(2, "ServiceResult", "Error! ", (copyOfStruct$$24 = result$$49.fields[0], copyOfStruct$$24)) : new Msg(2, "ServiceResult", "Execution completed!", (0, _Encode.Auto$$$toString$$5A41365E)(4, result$$49.fields[0], undefined, undefined, undefined, {
            ResolveType() {
              return _Reflection.obj_type;
            }

          }));
        }) : model.Service === "initializeDefinitionalFeedback" ? makeCmd(_DefinitionalFeedback.Initialize, model.JsonInput, function (result$$51) {
          var copyOfStruct$$25;
          return result$$51.tag === 1 ? new Msg(2, "ServiceResult", "Error! ", (copyOfStruct$$25 = result$$51.fields[0], copyOfStruct$$25)) : new Msg(2, "ServiceResult", "Execution completed!", (0, _Encode.Auto$$$toString$$5A41365E)(4, result$$51.fields[0], undefined, undefined, undefined, {
            ResolveType() {
              return _Reflection.obj_type;
            }

          }));
        }) : model.Service === "initializeSpellingCorrector" ? makeCmd(_SpellingCorrector.Initialize, model.JsonInput, function (result$$53) {
          var copyOfStruct$$26;
          return result$$53.tag === 1 ? new Msg(2, "ServiceResult", "Error! ", (copyOfStruct$$26 = result$$53.fields[0], copyOfStruct$$26)) : new Msg(2, "ServiceResult", "Execution completed!", (0, _Encode.Auto$$$toString$$5A41365E)(4, result$$53.fields[0], undefined, undefined, undefined, {
            ResolveType() {
              return _Reflection.obj_type;
            }

          }));
        }) : model.Service === "initializeParaphraseCache" ? makeCmd(_Paraphrase.InitializeParaphraseCache, model.JsonInput, function (result$$55) {
          var copyOfStruct$$27;
          return result$$55.tag === 1 ? new Msg(2, "ServiceResult", "Error! ", (copyOfStruct$$27 = result$$55.fields[0], copyOfStruct$$27)) : new Msg(2, "ServiceResult", "Execution completed!", (0, _Encode.Auto$$$toString$$5A41365E)(4, result$$55.fields[0], undefined, undefined, undefined, {
            ResolveType() {
              return _Reflection.obj_type;
            }

          }));
        }) : model.Service === "tutorialDialogue" ? makeCmd(_TutorialDialogue.HarnessGetDialogue, model.InputText, function (result$$57) {
          var copyOfStruct$$28;
          return result$$57.tag === 1 ? new Msg(2, "ServiceResult", "Error! ", (copyOfStruct$$28 = result$$57.fields[0], copyOfStruct$$28)) : new Msg(2, "ServiceResult", "Execution completed!", (0, _Encode.Auto$$$toString$$5A41365E)(4, result$$57.fields[0], undefined, undefined, undefined, {
            ResolveType() {
              return (0, _TutorialDialogue.DialogueState$reflection)();
            }

          }));
        }) : model.Service === "elaboratedTutorialDialogueState" ? makeCmd(_TutorialDialogue.HarnessGetElaboratedDialogueState, model.InputText, function (result$$59) {
          var copyOfStruct$$29;
          return result$$59.tag === 1 ? new Msg(2, "ServiceResult", "Error! ", (copyOfStruct$$29 = result$$59.fields[0], copyOfStruct$$29)) : new Msg(2, "ServiceResult", "Execution completed!", (0, _Encode.Auto$$$toString$$5A41365E)(4, result$$59.fields[0], undefined, undefined, undefined, {
            ResolveType() {
              return (0, _TutorialDialogue.DialogueState$reflection)();
            }

          }));
        }) : model.Service === "test" ? makeCmd(function ($arg$$4) {
          let input$$12;
          input$$12 = (0, _AllenNLP.resolveReferents)($arg$$4);
          return (0, _AllenNLP.Promisify)(input$$12);
        }, (json = model.JsonInput, ((0, _Decode.Auto$$$unsafeFromString$$Z5CB6BD)(json, undefined, undefined, {
          ResolveType() {
            return (0, _AllenNLP.DocumentAnnotation$reflection)();
          }

        }))), function (result$$61) {
          var copyOfStruct$$30;
          return result$$61.tag === 1 ? new Msg(2, "ServiceResult", "Error! ", (copyOfStruct$$30 = result$$61.fields[0], String(copyOfStruct$$30))) : new Msg(2, "ServiceResult", "Execution completed!", (0, _Encode.Auto$$$toString$$5A41365E)(4, result$$61.fields[0], undefined, undefined, undefined, {
            ResolveType() {
              return (0, _Reflection.array_type)(_Reflection.string_type);
            }

          }));
        }) : makeCmd(_AllenNLP.GetSRL, model.InputText, function (result$$1) {
          var copyOfStruct;
          return result$$1.tag === 1 ? new Msg(2, "ServiceResult", "Error! ", (copyOfStruct = result$$1.fields[0], String(copyOfStruct))) : new Msg(2, "ServiceResult", "Execution completed!", (0, _Encode.Auto$$$toString$$5A41365E)(4, result$$1.fields[0], undefined, undefined, undefined, {
            ResolveType() {
              return (0, _AllenNLP.SRL$reflection)();
            }

          }));
        });
        return [new Model(model.Mode, model.InputText, model.Service, "Executing, please wait...", model.JsonResult, model.JsonInput, model.JsonFileName, model.DesiredSentences, model.DesiredItems, model.Percentage, model.ParseJson, model.ParseFileName, model.ParaphraseFileName), cmd];
      }

    case 2:
      {
        if (msg.fields[1] !== "null") {
          new Audio("data:audio/wav;base64,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qJrx4KOQjahZxWbcZgztj2c49nKmkId44S71j0c8eV9yDK6uPRzx5X18eDvjvQ6yKo9ZSS6l//8elePK/Lf//IInrOF/FvDoADYAGBMGb7FtErm5MXMlmPAJQVgWta7Zx2go+8xJ0UiCb8LHHdftWyLJE0QIAIsI+UbXu67dZMjmgDGCGl1H+vpF4NSDckSIkk7Vd+sxEhBQMRU8j/12UIRhzSaUdQ+rQU5kGeFxm+hb1oh6pWWmv3uvmReDl0UnvtapVaIzo1jZbf/pD6ElLqSX+rUmOQNpJFa/r+sa4e/pBlAABoAAAAA3CUgShLdGIxsY7AUABPRrgCABdDuQ5GC7DqPQCgbbJUAoRSUj+NIEig0YfyWUho1VBBBA//uQZB4ABZx5zfMakeAAAAmwAAAAF5F3P0w9GtAAACfAAAAAwLhMDmAYWMgVEG1U0FIGCBgXBXAtfMH10000EEEEEECUBYln03TTTdNBDZopopYvrTTdNa325mImNg3TTPV9q3pmY0xoO6bv3r00y+IDGid/9aaaZTGMuj9mpu9Mpio1dXrr5HERTZSmqU36A3CumzN/9Robv/Xx4v9ijkSRSNLQhAWumap82WRSBUqXStV/YcS+XVLnSS+WLDroqArFkMEsAS+eWmrUzrO0oEmE40RlMZ5+ODIkAyKAGUwZ3mVKmcamcJnMW26MRPgUw6j+LkhyHGVGYjSUUKNpuJUQoOIAyDvEyG8S5yfK6dhZc0Tx1KI/gviKL6qvvFs1+bWtaz58uUNnryq6kt5RzOCkPWlVqVX2a/EEBUdU1KrXLf40GoiiFXK///qpoiDXrOgqDR38JB0bw7SoL+ZB9o1RCkQjQ2CBYZKd/+VJxZRRZlqSkKiws0WFxUyCwsKiMy7hUVFhIaCrNQsKkTIsLivwKKigsj8XYlwt/WKi2N4d//uQRCSAAjURNIHpMZBGYiaQPSYyAAABLAAAAAAAACWAAAAApUF/Mg+0aohSIRobBAsMlO//Kk4soosy1JSFRYWaLC4qZBYWFRGZdwqKiwkNBVmoWFSJkWFxX4FFRQWR+LsS4W/rFRb/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////VEFHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAU291bmRib3kuZGUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMjAwNGh0dHA6Ly93d3cuc291bmRib3kuZGUAAAAAAAAAACU=").play();
          new Audio("data:audio/wav;base64,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qJrx4KOQjahZxWbcZgztj2c49nKmkId44S71j0c8eV9yDK6uPRzx5X18eDvjvQ6yKo9ZSS6l//8elePK/Lf//IInrOF/FvDoADYAGBMGb7FtErm5MXMlmPAJQVgWta7Zx2go+8xJ0UiCb8LHHdftWyLJE0QIAIsI+UbXu67dZMjmgDGCGl1H+vpF4NSDckSIkk7Vd+sxEhBQMRU8j/12UIRhzSaUdQ+rQU5kGeFxm+hb1oh6pWWmv3uvmReDl0UnvtapVaIzo1jZbf/pD6ElLqSX+rUmOQNpJFa/r+sa4e/pBlAABoAAAAA3CUgShLdGIxsY7AUABPRrgCABdDuQ5GC7DqPQCgbbJUAoRSUj+NIEig0YfyWUho1VBBBA//uQZB4ABZx5zfMakeAAAAmwAAAAF5F3P0w9GtAAACfAAAAAwLhMDmAYWMgVEG1U0FIGCBgXBXAtfMH10000EEEEEECUBYln03TTTdNBDZopopYvrTTdNa325mImNg3TTPV9q3pmY0xoO6bv3r00y+IDGid/9aaaZTGMuj9mpu9Mpio1dXrr5HERTZSmqU36A3CumzN/9Robv/Xx4v9ijkSRSNLQhAWumap82WRSBUqXStV/YcS+XVLnSS+WLDroqArFkMEsAS+eWmrUzrO0oEmE40RlMZ5+ODIkAyKAGUwZ3mVKmcamcJnMW26MRPgUw6j+LkhyHGVGYjSUUKNpuJUQoOIAyDvEyG8S5yfK6dhZc0Tx1KI/gviKL6qvvFs1+bWtaz58uUNnryq6kt5RzOCkPWlVqVX2a/EEBUdU1KrXLf40GoiiFXK///qpoiDXrOgqDR38JB0bw7SoL+ZB9o1RCkQjQ2CBYZKd/+VJxZRRZlqSkKiws0WFxUyCwsKiMy7hUVFhIaCrNQsKkTIsLivwKKigsj8XYlwt/WKi2N4d//uQRCSAAjURNIHpMZBGYiaQPSYyAAABLAAAAAAAACWAAAAApUF/Mg+0aohSIRobBAsMlO//Kk4soosy1JSFRYWaLC4qZBYWFRGZdwqKiwkNBVmoWFSJkWFxX4FFRQWR+LsS4W/rFRb/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////VEFHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAU291bmRib3kuZGUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMjAwNGh0dHA6Ly93d3cuc291bmRib3kuZGUAAAAAAAAAACU=").play();
          new Audio("data:audio/wav;base64,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qJrx4KOQjahZxWbcZgztj2c49nKmkId44S71j0c8eV9yDK6uPRzx5X18eDvjvQ6yKo9ZSS6l//8elePK/Lf//IInrOF/FvDoADYAGBMGb7FtErm5MXMlmPAJQVgWta7Zx2go+8xJ0UiCb8LHHdftWyLJE0QIAIsI+UbXu67dZMjmgDGCGl1H+vpF4NSDckSIkk7Vd+sxEhBQMRU8j/12UIRhzSaUdQ+rQU5kGeFxm+hb1oh6pWWmv3uvmReDl0UnvtapVaIzo1jZbf/pD6ElLqSX+rUmOQNpJFa/r+sa4e/pBlAABoAAAAA3CUgShLdGIxsY7AUABPRrgCABdDuQ5GC7DqPQCgbbJUAoRSUj+NIEig0YfyWUho1VBBBA//uQZB4ABZx5zfMakeAAAAmwAAAAF5F3P0w9GtAAACfAAAAAwLhMDmAYWMgVEG1U0FIGCBgXBXAtfMH10000EEEEEECUBYln03TTTdNBDZopopYvrTTdNa325mImNg3TTPV9q3pmY0xoO6bv3r00y+IDGid/9aaaZTGMuj9mpu9Mpio1dXrr5HERTZSmqU36A3CumzN/9Robv/Xx4v9ijkSRSNLQhAWumap82WRSBUqXStV/YcS+XVLnSS+WLDroqArFkMEsAS+eWmrUzrO0oEmE40RlMZ5+ODIkAyKAGUwZ3mVKmcamcJnMW26MRPgUw6j+LkhyHGVGYjSUUKNpuJUQoOIAyDvEyG8S5yfK6dhZc0Tx1KI/gviKL6qvvFs1+bWtaz58uUNnryq6kt5RzOCkPWlVqVX2a/EEBUdU1KrXLf40GoiiFXK///qpoiDXrOgqDR38JB0bw7SoL+ZB9o1RCkQjQ2CBYZKd/+VJxZRRZlqSkKiws0WFxUyCwsKiMy7hUVFhIaCrNQsKkTIsLivwKKigsj8XYlwt/WKi2N4d//uQRCSAAjURNIHpMZBGYiaQPSYyAAABLAAAAAAAACWAAAAApUF/Mg+0aohSIRobBAsMlO//Kk4soosy1JSFRYWaLC4qZBYWFRGZdwqKiwkNBVmoWFSJkWFxX4FFRQWR+LsS4W/rFRb/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////VEFHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAU291bmRib3kuZGUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMjAwNGh0dHA6Ly93d3cuc291bmRib3kuZGUAAAAAAAAAACU=").play();
        } else {
          void null;
        }

        return [new Model(model.Mode, model.InputText, model.Service, msg.fields[0], msg.fields[1], model.JsonInput, model.JsonFileName, model.DesiredSentences, model.DesiredItems, model.Percentage, model.ParseJson, model.ParseFileName, model.ParaphraseFileName), new _Types.List()];
      }

    case 3:
      {
        let inputText$$6;
        var $target$$11;

        if (msg.fields[0] === "tutorialDialogue") {
          $target$$11 = 0;
        } else if (msg.fields[0] === "generateQuestions") {
          $target$$11 = 1;
        } else if (msg.fields[0] === "elaboratedTutorialDialogueState") {
          $target$$11 = 2;
        } else if (msg.fields[0] === "elaboratedFeedback") {
          $target$$11 = 3;
        } else if (msg.fields[0] === "cachedElaboratedFeedback") {
          $target$$11 = 4;
        } else if (msg.fields[0] === "definitionalFeedback") {
          $target$$11 = 5;
        } else if (msg.fields[0] === "wikiAlign") {
          $target$$11 = 6;
        } else if (msg.fields[0] === "wikiExtracts") {
          $target$$11 = 6;
        } else {
          $target$$11 = 7;
        }

        switch ($target$$11) {
          case 0:
            {
              const x = (0, _TutorialDialogue.DialogueState$$$InitializeTest)();
              inputText$$6 = (0, _Encode.Auto$$$toString$$5A41365E)(4, x, undefined, undefined, undefined, {
                ResolveType() {
                  return (0, _TutorialDialogue.DialogueState$reflection)();
                }

              });
              break;
            }

          case 1:
            {
              inputText$$6 = (0, _QuestionGenerator.InitializeTest)();
              break;
            }

          case 2:
            {
              const x$$2 = (0, _TutorialDialogue.HarnessElaboratedDialogueState$$$InitializeTest)();
              inputText$$6 = (0, _Encode.Auto$$$toString$$5A41365E)(4, x$$2, undefined, undefined, undefined, {
                ResolveType() {
                  return (0, _TutorialDialogue.HarnessElaboratedDialogueState$reflection)();
                }

              });
              break;
            }

          case 3:
            {
              const x$$4 = (0, _ElaboratedFeedback.HarnessElaboratedFeedbackRequest$$$InitializeTest)();
              inputText$$6 = (0, _Encode.Auto$$$toString$$5A41365E)(4, x$$4, undefined, undefined, undefined, {
                ResolveType() {
                  return (0, _ElaboratedFeedback.HarnessElaboratedFeedbackRequest$reflection)();
                }

              });
              break;
            }

          case 4:
            {
              const x$$6 = (0, _CachedElaboratedFeedback.HarnessFeedbackRequest$$$InitializeTest)();
              inputText$$6 = (0, _Encode.Auto$$$toString$$5A41365E)(4, x$$6, undefined, undefined, undefined, {
                ResolveType() {
                  return (0, _CachedElaboratedFeedback.HarnessFeedbackRequest$reflection)();
                }

              });
              break;
            }

          case 5:
            {
              const x$$8 = (0, _DefinitionalFeedback.HarnessFeedbackRequest$$$InitializeTest)();
              inputText$$6 = (0, _Encode.Auto$$$toString$$5A41365E)(4, x$$8, undefined, undefined, undefined, {
                ResolveType() {
                  return (0, _DefinitionalFeedback.HarnessFeedbackRequest$reflection)();
                }

              });
              break;
            }

          case 6:
            {
              const x$$10 = (0, _Wikifier.HarnessWikifyAlignRequest$$$InitializeTest)();
              inputText$$6 = (0, _Encode.Auto$$$toString$$5A41365E)(4, x$$10, undefined, undefined, undefined, {
                ResolveType() {
                  return (0, _Wikifier.HarnessWikifyAlignRequest$reflection)();
                }

              });
              break;
            }

          case 7:
            {
              inputText$$6 = "";
              break;
            }
        }

        return [new Model(model.Mode, inputText$$6, msg.fields[0], "", model.JsonResult, model.JsonInput, model.JsonFileName, model.DesiredSentences, model.DesiredItems, model.Percentage, model.ParseJson, model.ParseFileName, model.ParaphraseFileName), new _Types.List()];
      }

    case 5:
      {
        return [new Model(model.Mode, model.JsonResult, model.Service, model.Status, "", model.JsonInput, model.JsonFileName, model.DesiredSentences, model.DesiredItems, model.Percentage, model.ParseJson, model.ParseFileName, model.ParaphraseFileName), new _Types.List()];
      }

    case 4:
      {
        const a = document.createElement("a");
        const blob = new Blob([model.JsonResult], {
          type: "data:text/plain;charset=utf-8"
        });
        a.href = URL.createObjectURL(blob);
        const filename = (copyOfStruct$$31 = (0, _Date.now)(), (0, _Date.toString)(copyOfStruct$$31, "MM-dd-yy-HH-mm", {})) + ".json";
        a.setAttribute("download", filename);
        a.click();
        return [model, new _Types.List()];
      }

    case 6:
      {
        return [(JsonFileName = msg.fields[0][0].name, new Model(model.Mode, model.InputText, model.Service, model.Status, model.JsonResult, model.JsonInput, JsonFileName, model.DesiredSentences, model.DesiredItems, model.Percentage, model.ParseJson, model.ParseFileName, model.ParaphraseFileName)), new _Types.List(function fileReadCommand(dispatch) {
          const fileReader = new FileReader();

          fileReader.onload = function (_arg1) {
            var arg0, value$$1;
            dispatch((arg0 = (value$$1 = fileReader.result, (value$$1)), (new Msg(7, "SetJson", arg0))));
          };

          fileReader.readAsText(msg.fields[0][0]);
        }, new _Types.List())];
      }

    case 7:
      {
        return [(JsonInput = msg.fields[0], new Model(model.Mode, model.InputText, model.Service, model.Status, model.JsonResult, JsonInput, model.JsonFileName, model.DesiredSentences, model.DesiredItems, model.Percentage, model.ParseJson, model.ParseFileName, model.ParaphraseFileName)), new _Types.List()];
      }

    case 8:
      {
        return [(JsonInput$$1 = undefined, new Model(model.Mode, model.InputText, model.Service, model.Status, "", JsonInput$$1, model.JsonFileName, model.DesiredSentences, model.DesiredItems, model.Percentage, model.ParseJson, model.ParseFileName, model.ParaphraseFileName)), new _Types.List()];
      }

    case 9:
      {
        return [new Model(model.Mode, model.InputText, model.Service, model.Status, model.JsonResult, model.JsonInput, model.JsonFileName, msg.fields[0], model.DesiredItems, model.Percentage, model.ParseJson, model.ParseFileName, model.ParaphraseFileName), new _Types.List()];
      }

    case 10:
      {
        return [new Model(model.Mode, model.InputText, model.Service, model.Status, model.JsonResult, model.JsonInput, model.JsonFileName, model.DesiredSentences, msg.fields[0], model.Percentage, model.ParseJson, model.ParseFileName, model.ParaphraseFileName), new _Types.List()];
      }

    case 11:
      {
        return [new Model(model.Mode, model.InputText, model.Service, model.Status, model.JsonResult, model.JsonInput, model.JsonFileName, model.DesiredSentences, model.DesiredItems, msg.fields[0], model.ParseJson, model.ParseFileName, model.ParaphraseFileName), new _Types.List()];
      }

    case 12:
      {
        return [new Model("expert", model.InputText, model.Service, model.Status, model.JsonResult, model.JsonInput, model.JsonFileName, model.DesiredSentences, model.DesiredItems, model.Percentage, model.ParseJson, model.ParseFileName, model.ParaphraseFileName), new _Types.List()];
      }

    case 13:
      {
        return [(ParseFileName = msg.fields[0][0].name, new Model(model.Mode, model.InputText, model.Service, model.Status, model.JsonResult, model.JsonInput, model.JsonFileName, model.DesiredSentences, model.DesiredItems, model.Percentage, model.ParseJson, ParseFileName, model.ParaphraseFileName)), new _Types.List(function fileReadCommand$$1(dispatch$$1) {
          const fileReader$$1 = new FileReader();

          fileReader$$1.onload = function (_arg2) {
            var arg0$$1, value$$2;
            dispatch$$1((arg0$$1 = (value$$2 = fileReader$$1.result, (value$$2)), (new Msg(14, "SetParseJson", arg0$$1))));
          };

          fileReader$$1.readAsText(msg.fields[0][0]);
        }, new _Types.List())];
      }

    case 14:
      {
        return [(ParseJson = msg.fields[0], new Model(model.Mode, model.InputText, model.Service, model.Status, model.JsonResult, model.JsonInput, model.JsonFileName, model.DesiredSentences, model.DesiredItems, model.Percentage, ParseJson, model.ParseFileName, model.ParaphraseFileName)), new _Types.List()];
      }

    case 15:
      {
        return [(ParseJson$$1 = undefined, new Model(model.Mode, model.InputText, model.Service, model.Status, model.JsonResult, model.JsonInput, model.JsonFileName, model.DesiredSentences, model.DesiredItems, model.Percentage, ParseJson$$1, model.ParseFileName, model.ParaphraseFileName)), new _Types.List()];
      }

    case 16:
      {
        return [(ParaphraseFileName = msg.fields[0][0].name, new Model(model.Mode, model.InputText, model.Service, model.Status, model.JsonResult, model.JsonInput, model.JsonFileName, model.DesiredSentences, model.DesiredItems, model.Percentage, model.ParseJson, model.ParseFileName, ParaphraseFileName)), new _Types.List(function fileReadCommand$$2(dispatch$$2) {
          const fileReader$$2 = new FileReader();

          fileReader$$2.onload = function (_arg3) {
            var arg0$$2, value$$3;
            dispatch$$2((arg0$$2 = (value$$3 = fileReader$$2.result, (value$$3)), (new Msg(17, "SetParaphrases", arg0$$2))));
          };

          fileReader$$2.readAsText(msg.fields[0][0]);
        }, new _Types.List())];
      }

    case 17:
      {
        const loadParaphrases = makeCmd(_Paraphrase.InitializeParaphraseCache, msg.fields[0], function (result$$63) {
          var copyOfStruct$$32;
          return result$$63.tag === 1 ? new Msg(2, "ServiceResult", "Error! ", (copyOfStruct$$32 = result$$63.fields[0], copyOfStruct$$32)) : new Msg(2, "ServiceResult", "Execution completed!", (0, _Encode.Auto$$$toString$$5A41365E)(4, result$$63.fields[0], undefined, undefined, undefined, {
            ResolveType() {
              return _Reflection.obj_type;
            }

          }));
        });
        return [model, loadParaphrases];
      }

    default:
      {
        return [new Model(model.Mode, msg.fields[0], model.Service, model.Status, model.JsonResult, model.JsonInput, model.JsonFileName, model.DesiredSentences, model.DesiredItems, model.Percentage, model.ParseJson, model.ParseFileName, model.ParaphraseFileName), new _Types.List()];
      }
  }
}

function simpleButton(txt, action, dispatch$$3) {
  var props, children;
  const props$$2 = [new _FableReact.HTMLAttr(64, "ClassName", "column is-narrow")];
  const children$$2 = [(props = [new _FableReact.HTMLAttr(64, "ClassName", "button"), new _FableReact.DOMAttr(40, "OnClick", function (_arg1$$1) {
    dispatch$$3(action);
  })], (children = [txt], react.createElement("a", (0, _Util.createObj)(props, 1), ...children)))];
  return react.createElement("div", (0, _Util.createObj)(props$$2, 1), ...children$$2);
}

function simpleModeView(model$$1, dispatch$$4) {
  var props$$4, children$$4, props$$6, css, children$$6, props$$8, children$$8, options, props$$10, children$$10, s$$10, name, props$$12, children$$12, s$$13, name$$1, props$$14, children$$14, s$$16, name$$2;
  return (0, _Section.section)(new _Types.List(), new _Types.List((0, _Container.container)(new _Types.List(new _Container.Option(0, "is-fluid"), new _Types.List()), (0, _List.ofArray)([(0, _Heading.h2)(new _Types.List())(new _Types.List("MoFaCTS Automated Authoring", new _Types.List())), (0, _Content.content)(new _Types.List(), new _Types.List((props$$4 = [], (children$$4 = ["A simple app for creating MoFaCTS cloze items from text. Click on the cat in the corner for more information."], react.createElement("p", (0, _Util.createObj)(props$$4, 1), ...children$$4))), new _Types.List())), (0, _Columns.columns)(new _Types.List(), (0, _List.ofArray)([(0, _Column.column)(new _Types.List(new _Column.Option(0, "Width", new _Common.Screen(0, "All"), new _Column.ISize(1, "is-one-third")), new _Types.List()), (0, _List.ofArray)([(0, _Label.label)(new _Types.List(), new _Types.List("Input", new _Types.List())), (props$$6 = [new _FableReact.HTMLAttr(64, "ClassName", "input"), new _FableReact.HTMLAttr(161, "Value", model$$1.InputText), new _FableReact.HTMLAttr(145, "Size", 100), (css = (0, _List.ofArray)([new _FableReact.CSSProp(395, "Width", "100%"), new _FableReact.CSSProp(189, "Height", "150px")]), ["style", (0, _Util.createObj)(css, 1)]), new _FableReact.DOMAttr(9, "OnChange", function (ev) {
    var arg0$$3;
    dispatch$$4((arg0$$3 = ev.target.value, (new Msg(0, "UpdateText", arg0$$3))));
  })], (children$$6 = [], react.createElement("textarea", (0, _Util.createObj)(props$$6, 1), ...children$$6))), (props$$8 = [new _FableReact.HTMLAttr(64, "ClassName", "block")], (children$$8 = [(0, _Label.label)(new _Types.List(), new _Types.List("Proportion Sentences to Use [0,1]", new _Types.List())), (options = (0, _List.ofArray)([new _Input.Option(2, "Color", new _Common.Color$002EIColor(4, "is-primary")), new _Input.Option(7, "is-rounded"), new _Input.Option(8, "Value", model$$1.Percentage), new _Input.Option(15, "Props", new _Types.List(new _FableReact.DOMAttr(9, "OnChange", function (ev$$1) {
    var arg0$$4;
    dispatch$$4((arg0$$4 = ev$$1.target.value, (new Msg(11, "UpdatePercentage", arg0$$4))));
  }), new _Types.List()))]), (0, _Input.input)(new _Types.List(new _Input.Option(1, "Type", new _Input.IInputType(0, "Text")), options)))], react.createElement("div", (0, _Util.createObj)(props$$8, 1), ...children$$8))), (props$$10 = [new _FableReact.HTMLAttr(64, "ClassName", "block")], (children$$10 = [(0, _Label.label)(new _Types.List(), new _Types.List("Optional JSON list of sections (list of strings)", new _Types.List())), (0, _File.file)((0, _List.ofArray)([new _File.Option(10, "has-name"), new _File.Option(1, "Props", (0, _List.ofArray)([new _FableReact.Prop(0, "Key", model$$1.JsonInput != null ? "loaded" : "empty"), new _FableReact.DOMAttr(9, "OnChange", function (ev$$2) {
    dispatch$$4(new Msg(6, "LoadJsonFile", ev$$2.target.files));
  })]))]), new _Types.List((0, _File.Label$$$label)(new _Types.List(), (0, _List.ofArray)([(0, _File.input)(new _Types.List(new _Common.Common$002EGenericOption(1, "Props", new _Types.List(new _FableReact.HTMLAttr(2, "Accept", ".json"), new _Types.List())), new _Types.List())), (0, _File.cta)(new _Types.List(), (0, _List.ofArray)([(0, _File.icon)(new _Types.List(), new _Types.List((0, _Icon.icon)(new _Types.List(), new _Types.List((0, _FontAwesome.Fa$$$i)(new _Types.List(new _FontAwesome.Fa$002EIconOption(11, "Icon", "fas fa-upload"), new _Types.List()), []), new _Types.List())), new _Types.List())), (0, _File.Label$$$span)(new _Types.List(), new _Types.List("Choose a file...", new _Types.List()))])), (0, _File.name)(new _Types.List(), new _Types.List((s$$10 = model$$1.JsonFileName == null ? "" : (name = model$$1.JsonFileName, name), s$$10), new _Types.List()))])), new _Types.List()))], react.createElement("div", (0, _Util.createObj)(props$$10, 1), ...children$$10))), (props$$12 = [new _FableReact.HTMLAttr(64, "ClassName", "block")], (children$$12 = [(0, _Label.label)(new _Types.List(), new _Types.List("Optional parse JSON", new _Types.List())), (0, _File.file)((0, _List.ofArray)([new _File.Option(10, "has-name"), new _File.Option(1, "Props", (0, _List.ofArray)([new _FableReact.Prop(0, "Key", model$$1.ParseJson != null ? "loaded" : "empty"), new _FableReact.DOMAttr(9, "OnChange", function (ev$$3) {
    dispatch$$4(new Msg(13, "LoadJsonParseFile", ev$$3.target.files));
  })]))]), new _Types.List((0, _File.Label$$$label)(new _Types.List(), (0, _List.ofArray)([(0, _File.input)(new _Types.List(new _Common.Common$002EGenericOption(1, "Props", new _Types.List(new _FableReact.HTMLAttr(2, "Accept", ".json"), new _Types.List())), new _Types.List())), (0, _File.cta)(new _Types.List(), (0, _List.ofArray)([(0, _File.icon)(new _Types.List(), new _Types.List((0, _Icon.icon)(new _Types.List(), new _Types.List((0, _FontAwesome.Fa$$$i)(new _Types.List(new _FontAwesome.Fa$002EIconOption(11, "Icon", "fas fa-upload"), new _Types.List()), []), new _Types.List())), new _Types.List())), (0, _File.Label$$$span)(new _Types.List(), new _Types.List("Choose a file...", new _Types.List()))])), (0, _File.name)(new _Types.List(), new _Types.List((s$$13 = model$$1.ParseFileName == null ? "" : (name$$1 = model$$1.ParseFileName, name$$1), s$$13), new _Types.List()))])), new _Types.List()))], react.createElement("div", (0, _Util.createObj)(props$$12, 1), ...children$$12))), (props$$14 = [new _FableReact.HTMLAttr(64, "ClassName", "block")], (children$$14 = [(0, _Label.label)(new _Types.List(), new _Types.List("Optional paraphrases (tsv)", new _Types.List())), (0, _File.file)((0, _List.ofArray)([new _File.Option(10, "has-name"), new _File.Option(1, "Props", (0, _List.ofArray)([new _FableReact.Prop(0, "Key", model$$1.ParaphraseFileName != null ? "loaded" : "empty"), new _FableReact.DOMAttr(9, "OnChange", function (ev$$4) {
    dispatch$$4(new Msg(16, "LoadParaphraseFile", ev$$4.target.files));
  })]))]), new _Types.List((0, _File.Label$$$label)(new _Types.List(), (0, _List.ofArray)([(0, _File.input)(new _Types.List(new _Common.Common$002EGenericOption(1, "Props", new _Types.List(new _FableReact.HTMLAttr(2, "Accept", ".tsv"), new _Types.List())), new _Types.List())), (0, _File.cta)(new _Types.List(), (0, _List.ofArray)([(0, _File.icon)(new _Types.List(), new _Types.List((0, _Icon.icon)(new _Types.List(), new _Types.List((0, _FontAwesome.Fa$$$i)(new _Types.List(new _FontAwesome.Fa$002EIconOption(11, "Icon", "fas fa-upload"), new _Types.List()), []), new _Types.List())), new _Types.List())), (0, _File.Label$$$span)(new _Types.List(), new _Types.List("Choose a file...", new _Types.List()))])), (0, _File.name)(new _Types.List(), new _Types.List((s$$16 = model$$1.ParaphraseFileName == null ? "" : (name$$2 = model$$1.ParaphraseFileName, name$$2), s$$16), new _Types.List()))])), new _Types.List()))], react.createElement("div", (0, _Util.createObj)(props$$14, 1), ...children$$14)))])), (0, _Column.column)(new _Types.List(new _Column.Option(0, "Width", new _Common.Screen(0, "All"), new _Column.ISize(1, "is-one-third")), new _Types.List()), (0, _List.ofSeq)((0, _Seq.delay)(function () {
    return (0, _Seq.append)((0, _Seq.singleton)((0, _Label.label)(new _Types.List(), new _Types.List("Run", new _Types.List()))), (0, _Seq.delay)(function () {
      var props$$16, children$$16;
      return (0, _Seq.append)((0, _Seq.singleton)((props$$16 = [new _FableReact.HTMLAttr(64, "ClassName", "block")], (children$$16 = [(0, _Button.button)((0, _List.ofArray)([new _Button.Option(0, "Color", new _Common.Color$002EIColor(4, "is-primary")), new _Button.Option(18, "OnClick", function (_arg1$$2) {
        dispatch$$4(new Msg(1, "CallService"));
      })]), new _Types.List("Generate items", new _Types.List()))], react.createElement("div", (0, _Util.createObj)(props$$16, 1), ...children$$16)))), (0, _Seq.delay)(function () {
        var s$$19;
        return (0, _Seq.append)((0, _Seq.singleton)((0, _Common.Text$$$p)(new _Types.List(new _Common.Common$002EGenericOption(2, "Modifiers", new _Types.List(new _Common.Modifier$002EIModifier(5, "TextAlignment", new _Common.Screen(0, "All"), new _Common.TextAlignment$002EOption(2, "has-text-left")), new _Types.List())), new _Types.List()), new _Types.List((s$$19 = model$$1.JsonResult !== "null" ? model$$1.Status : "", s$$19), new _Types.List()))), (0, _Seq.delay)(function () {
          var props$$18, children$$18;
          return (model$$1.Status === "Execution completed!" ? model$$1.JsonResult !== "null" : false) ? (0, _Seq.singleton)((props$$18 = [new _FableReact.HTMLAttr(64, "ClassName", "block")], (children$$18 = [(0, _Button.button)((0, _List.ofArray)([new _Button.Option(0, "Color", new _Common.Color$002EIColor(4, "is-primary")), new _Button.Option(18, "OnClick", function (_arg2$$1) {
            dispatch$$4(new Msg(4, "DownloadJson"));
          })]), new _Types.List("Download JSON", new _Types.List()))], react.createElement("div", (0, _Util.createObj)(props$$18, 1), ...children$$18)))) : (0, _Seq.empty)();
        }));
      }));
    }));
  }))), (0, _Column.column)((0, _List.ofArray)([new _Column.Option(4, "Modifiers", new _Types.List(new _Common.Modifier$002EIModifier(32, "FlexJustifyContent", new _Common.FlexJustifyContent$002EOption(3, "is-justify-content-space-between")), new _Types.List())), new _Column.Option(0, "Width", new _Common.Screen(0, "All"), new _Column.ISize(1, "is-one-third"))]), new _Types.List((0, _Button.button)((0, _List.ofArray)([new _Button.Option(20, "Modifiers", new _Types.List(new _Common.Modifier$002EIModifier(29, "Spacing", new _Common.Spacing$002ETypeAndDirection(1, "mt"), new _Common.Spacing$002EAmount(0, "auto")), new _Types.List())), new _Button.Option(0, "Color", new _Common.Color$002EIColor(8, "is-danger")), new _Button.Option(18, "OnClick", function (_arg3$$1) {
    dispatch$$4(new Msg(12, "ExpertMode"));
  })]), new _Types.List("Expert mode", new _Types.List())), new _Types.List()))]))])), new _Types.List()));
}

function expertModeView(model$$2, dispatch$$5) {
  var props$$20, children$$20, props$$22, css$$1, children$$22, props$$84, children$$84, props$$24, children$$24, props$$26, children$$26, props$$28, children$$28, props$$30, children$$30, props$$32, children$$32, props$$34, children$$34, props$$36, children$$36, props$$38, children$$38, props$$40, children$$40, props$$42, children$$42, props$$44, children$$44, props$$46, children$$46, props$$48, children$$48, props$$50, children$$50, props$$52, children$$52, props$$54, children$$54, props$$56, children$$56, props$$58, children$$58, props$$60, children$$60, props$$62, children$$62, props$$64, children$$64, props$$66, children$$66, props$$68, children$$68, props$$70, children$$70, props$$72, children$$72, props$$74, children$$74, props$$76, children$$76, props$$78, children$$78, props$$80, children$$80, props$$82, children$$82, props$$88, children$$88, props$$86, children$$86, s$$58, name$$3, props$$90, children$$90, options$$1, options$$2, props$$92, css$$2, children$$92, s$$65;
  return (0, _Section.section)(new _Types.List(), new _Types.List((0, _Container.container)(new _Types.List(new _Container.Option(0, "is-fluid"), new _Types.List()), (0, _List.ofArray)([(0, _Heading.h2)(new _Types.List())(new _Types.List("MoFaCTS Automated Authoring", new _Types.List())), (0, _Content.content)(new _Types.List(), new _Types.List((props$$20 = [], (children$$20 = ["Expert mode is an interactive test suite for developing automated authoring components for MoFaCTS. It is not intended for general use. Click on the cat in the corner for more information."], react.createElement("p", (0, _Util.createObj)(props$$20, 1), ...children$$20))), new _Types.List())), (0, _Columns.columns)(new _Types.List(), (0, _List.ofArray)([(0, _Column.column)(new _Types.List(new _Column.Option(0, "Width", new _Common.Screen(0, "All"), new _Column.ISize(1, "is-one-third")), new _Types.List()), (0, _List.ofArray)([(0, _Label.label)(new _Types.List(), new _Types.List("Input", new _Types.List())), (props$$22 = [new _FableReact.HTMLAttr(64, "ClassName", "input"), new _FableReact.HTMLAttr(161, "Value", model$$2.InputText), new _FableReact.HTMLAttr(145, "Size", 100), (css$$1 = (0, _List.ofArray)([new _FableReact.CSSProp(395, "Width", "100%"), new _FableReact.CSSProp(189, "Height", "150px")]), ["style", (0, _Util.createObj)(css$$1, 1)]), new _FableReact.DOMAttr(9, "OnChange", function (ev$$5) {
    var arg0$$5;
    dispatch$$5((arg0$$5 = ev$$5.target.value, (new Msg(0, "UpdateText", arg0$$5))));
  })], (children$$22 = [], react.createElement("textarea", (0, _Util.createObj)(props$$22, 1), ...children$$22))), (0, _Field.div)(new _Types.List(), (0, _List.ofArray)([(0, _Label.label)(new _Types.List(), new _Types.List("Service", new _Types.List())), (0, _Control.div)(new _Types.List(), new _Types.List((0, _Select.select)(new _Types.List(), new _Types.List((props$$84 = [new _FableReact.HTMLAttr(1, "DefaultValue", model$$2.Service), new _FableReact.DOMAttr(9, "OnChange", function (ev$$6) {
    dispatch$$5(new Msg(3, "ServiceChange", (0, _FableReact2.Browser$002ETypes$002EEvent$$Event$002Eget_Value)(ev$$6)));
  })], (children$$84 = [(props$$24 = [new _FableReact.HTMLAttr(161, "Value", "selectCloze")], (children$$24 = ["Get Select Cloze"], react.createElement("option", (0, _Util.createObj)(props$$24, 1), ...children$$24))), (props$$26 = [new _FableReact.HTMLAttr(161, "Value", "allCloze")], (children$$26 = ["Get All Cloze"], react.createElement("option", (0, _Util.createObj)(props$$26, 1), ...children$$26))), (props$$28 = [new _FableReact.HTMLAttr(161, "Value", "tutorialDialogue")], (children$$28 = ["Tutorial Dialogue"], react.createElement("option", (0, _Util.createObj)(props$$28, 1), ...children$$28))), (props$$30 = [new _FableReact.HTMLAttr(161, "Value", "elaboratedTutorialDialogueState")], (children$$30 = ["Initialize Elaborated Tutorial Dialogue State"], react.createElement("option", (0, _Util.createObj)(props$$30, 1), ...children$$30))), (props$$32 = [new _FableReact.HTMLAttr(161, "Value", "elaboratedFeedback")], (children$$32 = ["Elaborated Feedback"], react.createElement("option", (0, _Util.createObj)(props$$32, 1), ...children$$32))), (props$$34 = [new _FableReact.HTMLAttr(161, "Value", "cachedElaboratedFeedback")], (children$$34 = ["Cached Elaborated Feedback"], react.createElement("option", (0, _Util.createObj)(props$$34, 1), ...children$$34))), (props$$36 = [new _FableReact.HTMLAttr(161, "Value", "definitionalFeedback")], (children$$36 = ["Definitional Feedback"], react.createElement("option", (0, _Util.createObj)(props$$36, 1), ...children$$36))), (props$$38 = [new _FableReact.HTMLAttr(161, "Value", "initializeCachedElaboratedFeedback")], (children$$38 = ["Initialize Cached Elaborated Feedback"], react.createElement("option", (0, _Util.createObj)(props$$38, 1), ...children$$38))), (props$$40 = [new _FableReact.HTMLAttr(161, "Value", "initializeDefinitionalFeedback")], (children$$40 = ["Initialize Definitional Feedback"], react.createElement("option", (0, _Util.createObj)(props$$40, 1), ...children$$40))), (props$$42 = [new _FableReact.HTMLAttr(161, "Value", "initializeSpellingCorrector")], (children$$42 = ["Initialize Spelling Corrector"], react.createElement("option", (0, _Util.createObj)(props$$42, 1), ...children$$42))), (props$$44 = [new _FableReact.HTMLAttr(161, "Value", "initializeParaphraseCache")], (children$$44 = ["Initialize Paraphrase"], react.createElement("option", (0, _Util.createObj)(props$$44, 1), ...children$$44))), (props$$46 = [new _FableReact.HTMLAttr(161, "Value", "triples")], (children$$46 = ["Triples"], react.createElement("option", (0, _Util.createObj)(props$$46, 1), ...children$$46))), (props$$48 = [new _FableReact.HTMLAttr(161, "Value", "nLP")], (children$$48 = ["Composite NLP"], react.createElement("option", (0, _Util.createObj)(props$$48, 1), ...children$$48))), (props$$50 = [new _FableReact.HTMLAttr(161, "Value", "lemma")], (children$$50 = ["Lemma (assumes noun)"], react.createElement("option", (0, _Util.createObj)(props$$50, 1), ...children$$50))), (props$$52 = [new _FableReact.HTMLAttr(161, "Value", "inflection")], (children$$52 = ["Inflection (assumes NNS)"], react.createElement("option", (0, _Util.createObj)(props$$52, 1), ...children$$52))), (props$$54 = [new _FableReact.HTMLAttr(161, "Value", "paraphrase")], (children$$54 = ["Paraphrase"], react.createElement("option", (0, _Util.createObj)(props$$54, 1), ...children$$54))), (props$$56 = [new _FableReact.HTMLAttr(161, "Value", "resolveTextReferents")], (children$$56 = ["Resolve Coreference"], react.createElement("option", (0, _Util.createObj)(props$$56, 1), ...children$$56))), (props$$58 = [new _FableReact.HTMLAttr(161, "Value", "answerQuestion")], (children$$58 = ["Answer Question"], react.createElement("option", (0, _Util.createObj)(props$$58, 1), ...children$$58))), (props$$60 = [new _FableReact.HTMLAttr(161, "Value", "generateQuestions")], (children$$60 = ["Generate Questions"], react.createElement("option", (0, _Util.createObj)(props$$60, 1), ...children$$60))), (props$$62 = [new _FableReact.HTMLAttr(161, "Value", "wikify")], (children$$62 = ["Wikify"], react.createElement("option", (0, _Util.createObj)(props$$62, 1), ...children$$62))), (props$$64 = [new _FableReact.HTMLAttr(161, "Value", "wikiAlign")], (children$$64 = ["Wikify Align"], react.createElement("option", (0, _Util.createObj)(props$$64, 1), ...children$$64))), (props$$66 = [new _FableReact.HTMLAttr(161, "Value", "wikiExtracts")], (children$$66 = ["Wiki Extracts"], react.createElement("option", (0, _Util.createObj)(props$$66, 1), ...children$$66))), (props$$68 = [new _FableReact.HTMLAttr(161, "Value", "sRL")], (children$$68 = ["SRL Parse"], react.createElement("option", (0, _Util.createObj)(props$$68, 1), ...children$$68))), (props$$70 = [new _FableReact.HTMLAttr(161, "Value", "dependencyParser")], (children$$70 = ["Dependency Parse"], react.createElement("option", (0, _Util.createObj)(props$$70, 1), ...children$$70))), (props$$72 = [new _FableReact.HTMLAttr(161, "Value", "coreference")], (children$$72 = ["Coreference Annotation"], react.createElement("option", (0, _Util.createObj)(props$$72, 1), ...children$$72))), (props$$74 = [new _FableReact.HTMLAttr(161, "Value", "sentenceSplitter")], (children$$74 = ["Sentence Splitter"], react.createElement("option", (0, _Util.createObj)(props$$74, 1), ...children$$74))), (props$$76 = [new _FableReact.HTMLAttr(161, "Value", "cleanText")], (children$$76 = ["Clean Text"], react.createElement("option", (0, _Util.createObj)(props$$76, 1), ...children$$76))), (props$$78 = [new _FableReact.HTMLAttr(161, "Value", "acronym")], (children$$78 = ["Acronym"], react.createElement("option", (0, _Util.createObj)(props$$78, 1), ...children$$78))), (props$$80 = [new _FableReact.HTMLAttr(161, "Value", "reverse")], (children$$80 = ["Reverse"], react.createElement("option", (0, _Util.createObj)(props$$80, 1), ...children$$80))), (props$$82 = [new _FableReact.HTMLAttr(161, "Value", "test")], (children$$82 = ["Test"], react.createElement("option", (0, _Util.createObj)(props$$82, 1), ...children$$82)))], react.createElement("select", (0, _Util.createObj)(props$$84, 1), ...children$$84))), new _Types.List())), new _Types.List()))])), (props$$88 = [new _FableReact.HTMLAttr(92, "Hidden", ((((((((model$$2.Service !== "nLP" ? model$$2.Service !== "selectCloze" : false) ? model$$2.Service !== "allCloze" : false) ? model$$2.Service !== "elaboratedFeedback" : false) ? model$$2.Service !== "definitionalFeedback" : false) ? model$$2.Service !== "initializeCachedElaboratedFeedback" : false) ? model$$2.Service !== "initializeDefinitionalFeedback" : false) ? model$$2.Service !== "initializeSpellingCorrector" : false) ? model$$2.Service !== "initializeParaphraseCache" : false) ? model$$2.Service !== "test" : false)], (children$$88 = [(props$$86 = [new _FableReact.HTMLAttr(64, "ClassName", "block")], (children$$86 = [(0, _Label.label)(new _Types.List(), new _Types.List("Optional JSON (e.g. parse)", new _Types.List())), (0, _File.file)((0, _List.ofArray)([new _File.Option(10, "has-name"), new _File.Option(1, "Props", (0, _List.ofArray)([new _FableReact.Prop(0, "Key", model$$2.JsonInput != null ? "loaded" : "empty"), new _FableReact.DOMAttr(9, "OnChange", function (ev$$7) {
    dispatch$$5(new Msg(6, "LoadJsonFile", ev$$7.target.files));
  })]))]), new _Types.List((0, _File.Label$$$label)(new _Types.List(), (0, _List.ofArray)([(0, _File.input)(new _Types.List(new _Common.Common$002EGenericOption(1, "Props", new _Types.List(new _FableReact.HTMLAttr(2, "Accept", ".json,.tsv"), new _Types.List())), new _Types.List())), (0, _File.cta)(new _Types.List(), (0, _List.ofArray)([(0, _File.icon)(new _Types.List(), new _Types.List((0, _Icon.icon)(new _Types.List(), new _Types.List((0, _FontAwesome.Fa$$$i)(new _Types.List(new _FontAwesome.Fa$002EIconOption(11, "Icon", "fas fa-upload"), new _Types.List()), []), new _Types.List())), new _Types.List())), (0, _File.Label$$$span)(new _Types.List(), new _Types.List("Choose a file...", new _Types.List()))])), (0, _File.name)(new _Types.List(), new _Types.List((s$$58 = model$$2.JsonFileName == null ? "" : (name$$3 = model$$2.JsonFileName, name$$3), s$$58), new _Types.List()))])), new _Types.List()))], react.createElement("div", (0, _Util.createObj)(props$$86, 1), ...children$$86)))], react.createElement("div", (0, _Util.createObj)(props$$88, 1), ...children$$88))), (props$$90 = [new _FableReact.HTMLAttr(92, "Hidden", model$$2.Service !== "selectCloze")], (children$$90 = [(0, _Label.label)(new _Types.List(), new _Types.List("Optional Desired Sentences", new _Types.List())), (options$$1 = (0, _List.ofArray)([new _Input.Option(2, "Color", new _Common.Color$002EIColor(4, "is-primary")), new _Input.Option(7, "is-rounded"), new _Input.Option(8, "Value", model$$2.DesiredSentences), new _Input.Option(15, "Props", new _Types.List(new _FableReact.DOMAttr(9, "OnChange", function (ev$$8) {
    var arg0$$6;
    dispatch$$5((arg0$$6 = ev$$8.target.value, (new Msg(9, "UpdateSentences", arg0$$6))));
  }), new _Types.List()))]), (0, _Input.input)(new _Types.List(new _Input.Option(1, "Type", new _Input.IInputType(0, "Text")), options$$1))), (0, _Label.label)(new _Types.List(), new _Types.List("Optional Desired Items", new _Types.List())), (options$$2 = (0, _List.ofArray)([new _Input.Option(2, "Color", new _Common.Color$002EIColor(4, "is-primary")), new _Input.Option(7, "is-rounded"), new _Input.Option(8, "Value", model$$2.DesiredItems), new _Input.Option(15, "Props", new _Types.List(new _FableReact.DOMAttr(9, "OnChange", function (ev$$9) {
    var arg0$$7;
    dispatch$$5((arg0$$7 = ev$$9.target.value, (new Msg(10, "UpdateItems", arg0$$7))));
  }), new _Types.List()))]), (0, _Input.input)(new _Types.List(new _Input.Option(1, "Type", new _Input.IInputType(0, "Text")), options$$2)))], react.createElement("div", (0, _Util.createObj)(props$$90, 1), ...children$$90))), (0, _Button.button)((0, _List.ofArray)([new _Button.Option(0, "Color", new _Common.Color$002EIColor(4, "is-primary")), new _Button.Option(18, "OnClick", function (_arg1$$3) {
    dispatch$$5(new Msg(1, "CallService"));
  })]), new _Types.List("Call Service", new _Types.List()))])), (0, _Column.column)(new _Types.List(new _Column.Option(0, "Width", new _Common.Screen(0, "All"), new _Column.ISize(3, "is-two-thirds")), new _Types.List()), (0, _List.ofArray)([(0, _Label.label)(new _Types.List(), new _Types.List("Model State", new _Types.List())), (0, _Columns.columns)(new _Types.List(), (0, _List.ofArray)([(0, _Column.column)(new _Types.List(), new _Types.List((0, _Button.button)((0, _List.ofArray)([new _Button.Option(0, "Color", new _Common.Color$002EIColor(4, "is-primary")), new _Button.Option(18, "OnClick", function (_arg2$$2) {
    dispatch$$5(new Msg(4, "DownloadJson"));
  })]), new _Types.List("Download JSON", new _Types.List())), new _Types.List())), (0, _Column.column)(new _Types.List(), new _Types.List((0, _Button.button)((0, _List.ofArray)([new _Button.Option(0, "Color", new _Common.Color$002EIColor(4, "is-primary")), new _Button.Option(18, "OnClick", function (_arg3$$2) {
    dispatch$$5(new Msg(5, "JsonToInput"));
  })]), new _Types.List("JSON to Input", new _Types.List())), new _Types.List())), (0, _Column.column)(new _Types.List(new _Column.Option(0, "Width", new _Common.Screen(0, "All"), new _Column.ISize(3, "is-two-thirds")), new _Types.List()), new _Types.List())])), (props$$92 = [(css$$2 = new _Types.List(new _FableReact.CSSProp(153, "FontSize", 10), new _Types.List()), ["style", (0, _Util.createObj)(css$$2, 1)])], (children$$92 = [(s$$65 = (0, _String.replace)((0, _String.replace)(((0, _Encode.Auto$$$toString$$5A41365E)(4, model$$2, undefined, undefined, undefined, {
    ResolveType() {
      return Model$reflection();
    }

  })), "\\n", "\n"), "\\\"", "\""), (s$$65))], react.createElement("pre", (0, _Util.createObj)(props$$92, 1), ...children$$92)))]))]))])), new _Types.List()));
}

function view(model$$3, dispatch$$6) {
  if (model$$3.Mode === "expert") {
    return expertModeView(model$$3, dispatch$$6);
  } else {
    return simpleModeView(model$$3, dispatch$$6);
  }
}

(function () {
  let program$$2;
  const program = (0, _program.ProgramModule$$$mkProgram)(function () {
    return init();
  }, update, view);
  program$$2 = (0, _react2.Program$$$withReactSynchronous)("elmish-app", program);
  (0, _program.ProgramModule$$$run)(program$$2);
})();