"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Tag$reflection = Tag$reflection;
exports.Feedback$reflection = Feedback$reflection;
exports.Initialize = Initialize;
exports.firstLetterUpper = firstLetterUpper;
exports.correctnessStatement = correctnessStatement;
exports.GenerateFeedback = GenerateFeedback;
exports.HarnessFeedbackRequest$reflection = HarnessFeedbackRequest$reflection;
exports.HarnessFeedbackRequest$$$InitializeTest = HarnessFeedbackRequest$$$InitializeTest;
exports.HarnessGenerateFeedback = HarnessGenerateFeedback;
exports.HarnessFeedbackRequest = exports.cache = exports.Feedback = exports.Tag = void 0;

var _Types = require("./fable-library.2.10.2/Types");

var _Reflection = require("./fable-library.2.10.2/Reflection");

var _Util = require("./fable-library.2.10.2/Util");

var _Map = require("./fable-library.2.10.2/Map");

var _Option = require("./fable-library.2.10.2/Option");

var _PromiseImpl = require("./Fable.Promise.2.1.0/PromiseImpl");

var _Promise = require("./Fable.Promise.2.1.0/Promise");

var _Decode = require("./Thoth.Json.4.0.0/Decode");

var _Array = require("./fable-library.2.10.2/Array");

var _String = require("./fable-library.2.10.2/String");

var _DefinitionalFeedback = require("./DefinitionalFeedback");

const Tag = (0, _Types.declare)(function CachedElaboratedFeedback_Tag(tag, name, ...fields) {
  this.tag = tag | 0;
  this.name = name;
  this.fields = fields;
}, _Types.Union);
exports.Tag = Tag;

function Tag$reflection() {
  return (0, _Reflection.union_type)("CachedElaboratedFeedback.Tag", [], Tag, () => ["DefinitionalFeedback", "CachedElaboratedFeedback", ["Trace", [["Item", _Reflection.string_type]]]]);
}

const Feedback = (0, _Types.declare)(function CachedElaboratedFeedback_Feedback(Feedback, Tags) {
  this.Feedback = Feedback;
  this.Tags = Tags;
}, _Types.Record);
exports.Feedback = Feedback;

function Feedback$reflection() {
  return (0, _Reflection.record_type)("CachedElaboratedFeedback.Feedback", [], Feedback, () => [["Feedback", _Reflection.string_type], ["Tags", (0, _Reflection.array_type)(Tag$reflection())]]);
}

const cache = (0, _Util.createAtom)((0, _Map.empty)({
  Compare: _Util.compareArrays
}));
exports.cache = cache;

function Initialize(jsonDictionary) {
  var elements, array;

  try {
    cache((elements = (array = ((0, _Decode.Auto$$$unsafeFromString$$Z5CB6BD)(jsonDictionary, undefined, undefined, {
      ResolveType() {
        return (0, _Reflection.array_type)((0, _Reflection.array_type)(_Reflection.string_type));
      }

    })), ((0, _Array.choose)(function chooser(arr) {
      if (arr[2].trim() !== "") {
        return [[arr[0], arr[1]], arr[2]];
      } else {
        return undefined;
      }
    }, array, Array))), ((0, _Map.ofArray)(elements, {
      Compare: _Util.compareArrays
    }))));
    return (0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
      return Promise.resolve(new _Option.Result(0, "Ok", null));
    }));
  } catch (e) {
    return (0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
      return Promise.resolve(new _Option.Result(1, "Error", e.message));
    }));
  }
}

function firstLetterUpper(input) {
  return (0, _String.substring)(input, 0, 1).toLocaleUpperCase() + (0, _String.substring)(input, 1);
}

function correctnessStatement(incorrectAnswer, correctAnswer) {
  return firstLetterUpper(incorrectAnswer) + " is not right. The right answer is " + correctAnswer + ". ";
}

function GenerateFeedback(incorrectAnswer$$1, correctAnswer$$1) {
  return (0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
    const tags = [];
    let elaboratedFeedback;
    const matchValue = [(0, _Map.FSharpMap$$TryFind$$2B595)(cache(), [incorrectAnswer$$1, correctAnswer$$1]), (0, _Map.FSharpMap$$TryFind$$2B595)(cache(), [correctAnswer$$1, incorrectAnswer$$1])];

    if (matchValue[0] == null) {
      if (matchValue[1] == null) {
        elaboratedFeedback = undefined;
      } else {
        const ef$$1 = matchValue[1];
        elaboratedFeedback = ef$$1;
      }
    } else {
      const ef = matchValue[0];
      elaboratedFeedback = ef;
    }

    if (elaboratedFeedback != null) {
      void tags.push(new Tag(1, "CachedElaboratedFeedback"));
      const cs = correctnessStatement(incorrectAnswer$$1, correctAnswer$$1);
      return Promise.resolve(new _Option.Result(0, "Ok", new Feedback(cs + elaboratedFeedback, tags.slice())));
    } else {
      return (0, _DefinitionalFeedback.GenerateFeedback)(incorrectAnswer$$1, correctAnswer$$1).then(function (_arg1) {
        if (_arg1.tag === 1) {
          const message = "Unable to generate elaborated feedback. Elaborated feedback cache is " + ((0, _Map.FSharpMap$$get_IsEmpty)(cache()) ? "empty" : "full. " + _arg1.fields[0]);
          return Promise.resolve(new _Option.Result(1, "Error", message));
        } else {
          void tags.push(new Tag(0, "DefinitionalFeedback"));
          return Promise.resolve(new _Option.Result(0, "Ok", new Feedback(_arg1.fields[0].feedback, tags.slice())));
        }
      });
    }
  }));
}

const HarnessFeedbackRequest = (0, _Types.declare)(function CachedElaboratedFeedback_HarnessFeedbackRequest(CorrectAnswer, IncorrectAnswer) {
  this.CorrectAnswer = CorrectAnswer;
  this.IncorrectAnswer = IncorrectAnswer;
}, _Types.Record);
exports.HarnessFeedbackRequest = HarnessFeedbackRequest;

function HarnessFeedbackRequest$reflection() {
  return (0, _Reflection.record_type)("CachedElaboratedFeedback.HarnessFeedbackRequest", [], HarnessFeedbackRequest, () => [["CorrectAnswer", _Reflection.string_type], ["IncorrectAnswer", _Reflection.string_type]]);
}

function HarnessFeedbackRequest$$$InitializeTest() {
  return new HarnessFeedbackRequest("nervous system", "spinal cord");
}

function HarnessGenerateFeedback(jsonFeedbackRequest) {
  let fr;
  fr = (0, _Decode.Auto$$$unsafeFromString$$Z5CB6BD)(jsonFeedbackRequest, undefined, undefined, {
    ResolveType() {
      return HarnessFeedbackRequest$reflection();
    }

  });
  return GenerateFeedback(fr.IncorrectAnswer, fr.CorrectAnswer);
}