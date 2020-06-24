"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getRandomMove = getRandomMove;
exports.DialogueMove$reflection = DialogueMove$reflection;
exports.DialogueMove$$$GetRandom$$Z6391FD10 = DialogueMove$$$GetRandom$$Z6391FD10;
exports.DialogueMove$$$Create$$Z29C2FE95 = DialogueMove$$$Create$$Z29C2FE95;
exports.DialogueState$reflection = DialogueState$reflection;
exports.GetDialogue = GetDialogue;
exports.DialogueState = exports.DialogueMove = exports.random = exports.dialogueBags = void 0;

var _List = require("./fable-library.2.8.4/List");

var _Util = require("./fable-library.2.8.4/Util");

var _Map = require("./fable-library.2.8.4/Map");

var _Types = require("./fable-library.2.8.4/Types");

var _Reflection = require("./fable-library.2.8.4/Reflection");

var _QuestionGenerator = require("./QuestionGenerator");

var _RegExp = require("./fable-library.2.8.4/RegExp");

var _AllenNLP = require("./AllenNLP");

var _Option = require("./fable-library.2.8.4/Option");

var _Array = require("./fable-library.2.8.4/Array");

var _PromiseImpl = require("./Fable.Promise.2.1.0/PromiseImpl");

var _String = require("./fable-library.2.8.4/String");

var _Promise = require("./Fable.Promise.2.1.0/Promise");

const dialogueBags = (() => {
  const elements = (0, _List.ofArray)([["elaborationMarker", (0, _List.ofArray)(["Remember that", "It's important to remember that", "It is significant that", "We've established that"])], ["shiftMarker", (0, _List.ofArray)(["Moving on.", "Let's move on.", "Let's keep going.", "Let's continue."])], ["positiveFeedback", (0, _List.ofArray)(["Yes.", "Good.", "Yes!", "Yay!", "Wow!", "Right.", "Cool.", "Okay.", "Good!", "Yeah!", "Great!", "Right!", "Sweet!", "Super!", "Bingo!", "Perfect!", "Ok good.", "Got it.", "Correct.", "Awesome!", "Exactly!", "Ok, good.", "Good job!", "Very good!", "Excellent.", "That's it.", "Good call.", "Okay good.", "Yep, good.", "That's it!", "Ok, super!", "Yes siree.", "Absolutely.", "There we go.", "That's good.", "Super duper!", "That's right.", "You're right.", "Yeah exactly.", "There you go!", "Yeah, awesome!", "Exactly, yeah.", "Good, awesome.", "Perfect. good.", "Ok, very good.", "Alright, cool!", "That's perfect.", "That's awesome!", "Alright, sweet.", "Good! good job!", "That's correct.", "You're correct.", "Right, exactly.", "Yep, excellent.", "That's terrific.", "Good, very good.", "Good, that's it.", "That was perfect.", "Absolutely right.", "Good, you got it.", "That is fantastic.", "Yes, that's right.", "Yeah, you're right.", "There you go, you got it."])], ["neutralPositiveFeedback", (0, _List.ofArray)(["Close.", "Sort of.", "That's close.", "Almost.", "Kind of."])], ["neutralFeedback", (0, _List.ofArray)(["Oh. hmm.", "Um.", "Hmm.", "Huh.", "Umm.", "Well. um"])], ["neutralNegativeFeedback", (0, _List.ofArray)(["Not quite.", "Not exactly.", "Not really."])], ["negativeFeedback", (0, _List.ofArray)(["No.", "Nope.", "Oh, no.", "Uh, no.", "Well, no.", "Oh, no.", "Not good.", "Well, no.", "Um, nope.", "Hmm, nope.", "Actually no.", "That's not it.", "No, that's not it."])]]);
  return (0, _Map.ofList)(elements, {
    Compare: _Util.comparePrimitives
  });
})();

exports.dialogueBags = dialogueBags;
const random = {};
exports.random = random;

function getRandomMove(dm) {
  return (0, _List.item)((0, _Util.randomNext)(0, (0, _List.length)((0, _Map.FSharpMap$$get_Item$$2B595)(dialogueBags, dm)) - 1), (0, _Map.FSharpMap$$get_Item$$2B595)(dialogueBags, dm));
}

const DialogueMove = (0, _Types.declare)(function TutorialDialogue_DialogueMove(arg1, arg2) {
  this.Text = arg1;
  this.Type = arg2;
}, _Types.Record);
exports.DialogueMove = DialogueMove;

function DialogueMove$reflection() {
  return (0, _Reflection.record)("TutorialDialogue.DialogueMove", [], DialogueMove, () => [["Text", _Reflection.string], ["Type", _Reflection.string]]);
}

function DialogueMove$$$GetRandom$$Z6391FD10(aType) {
  return new DialogueMove((getRandomMove(aType)), aType);
}

function DialogueMove$$$Create$$Z29C2FE95(text, aType$$1) {
  return new DialogueMove(text, aType$$1);
}

const DialogueState = (0, _Types.declare)(function TutorialDialogue_DialogueState(arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9, arg10) {
  this.ClozeItem = arg1;
  this.ClozeAnswer = arg2;
  this.Questions = arg3;
  this.LastQuestion = arg4;
  this.LastStudentAnswer = arg5;
  this.CurrentFeedback = arg6;
  this.CurrentElaboration = arg7;
  this.CurrentQuestion = arg8;
  this.Display = arg9;
  this.Finished = arg10;
}, _Types.Record);
exports.DialogueState = DialogueState;

function DialogueState$reflection() {
  return (0, _Reflection.record)("TutorialDialogue.DialogueState", [], DialogueState, () => [["ClozeItem", _Reflection.string], ["ClozeAnswer", _Reflection.string], ["Questions", (0, _Reflection.option)((0, _Reflection.array)((0, _QuestionGenerator.Question$reflection)()))], ["LastQuestion", (0, _Reflection.option)((0, _QuestionGenerator.Question$reflection)())], ["LastStudentAnswer", (0, _Reflection.option)(_Reflection.string)], ["CurrentFeedback", (0, _Reflection.option)(DialogueMove$reflection())], ["CurrentElaboration", (0, _Reflection.option)((0, _Reflection.array)(DialogueMove$reflection()))], ["CurrentQuestion", (0, _Reflection.option)((0, _QuestionGenerator.Question$reflection)())], ["Display", (0, _Reflection.option)(_Reflection.string)], ["Finished", (0, _Reflection.option)(_Reflection.bool)]]);
}

function GetDialogue(state) {
  return (0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
    var chunksJsonOption, input;
    const errors = [];
    const text$$1 = (0, _RegExp.replace)(state.ClozeItem, "_+", state.ClozeAnswer);
    return (state.Questions == null ? (chunksJsonOption = null, (0, _AllenNLP.GetNLP)(chunksJsonOption, text$$1)) : (input = (0, _AllenNLP.DocumentAnnotation$$$CreateEmpty)(), ((0, _AllenNLP.Promisify)(input)))).then(function (_arg1) {
      var input$$1;
      return ((state.LastQuestion != null ? state.LastStudentAnswer != null : false) ? (0, _AllenNLP.GetTextualEntailment)(state.LastQuestion.Answer, state.LastStudentAnswer) : (input$$1 = (0, _AllenNLP.Entailment$$$CreateEmpty)(), ((0, _AllenNLP.Promisify)(input$$1)))).then(function (_arg2) {
        var p, lastQ, x, q$$5, list$$1, list, mapping$$1, clo1, list$$3, list$$2, mapping$$2, clo1$$1;

        const isOK = function isOK(r) {
          if (r.tag === 1) {
            return false;
          } else {
            return true;
          }
        };

        const resultToTypeOption = function resultToTypeOption(r$$2) {
          if (r$$2.tag === 1) {
            return null;
          } else {
            return (0, _Option.some)(r$$2.fields[0]);
          }
        };

        const resultToErrorOption = function resultToErrorOption(r$$4) {
          if (r$$4.tag === 1) {
            return (0, _Option.some)(r$$4.fields[0]);
          } else {
            return null;
          }
        };

        if (isOK(_arg1) ? isOK(_arg2) : false) {
          const daOption = resultToTypeOption(_arg1);
          const teOption = resultToTypeOption(_arg2);
          const display = [];
          let questions;

          if (state.Questions == null) {
            if (daOption != null) {
              const da = daOption;
              let sa;
              sa = (0, _Array.head)(da.sentences);
              questions = (0, _QuestionGenerator.GetQuestions)(sa);
            } else {
              questions = new Array(0);
            }
          } else {
            const q = state.Questions;
            questions = q;
          }

          let patternInput;
          let hintOption;
          hintOption = (0, _Array.tryFind)(function predicate(q$$1) {
            return q$$1.QuestionType === "hint";
          }, questions);
          let promptOption;
          promptOption = (0, _Array.tryFind)(function predicate$$1(q$$2) {
            return q$$2.QuestionType === "prompt";
          }, questions);
          var $target$$13, h, lastQ$$1, p$$1;

          if (state.LastQuestion != null) {
            if (promptOption != null) {
              if (p = promptOption, (lastQ = state.LastQuestion, lastQ.QuestionType === "hint")) {
                $target$$13 = 1;
                lastQ$$1 = state.LastQuestion;
                p$$1 = promptOption;
              } else {
                $target$$13 = 2;
              }
            } else {
              $target$$13 = 2;
            }
          } else if (hintOption != null) {
            $target$$13 = 0;
            h = hintOption;
          } else {
            $target$$13 = 2;
          }

          switch ($target$$13) {
            case 0:
              {
                patternInput = [(h), (questions.filter(function predicate$$2(q$$3) {
                  return !(0, _Util.equals)(q$$3, h);
                }))];
                break;
              }

            case 1:
              {
                patternInput = [(p$$1), (questions.filter(function predicate$$3(q$$4) {
                  return !(0, _Util.equals)(q$$4, p$$1);
                }))];
                break;
              }

            case 2:
              {
                patternInput = [null, questions];
                break;
              }
          }

          let feedbackOption;
          var $target$$16, lq, sa$$1, te;

          if (state.LastQuestion != null) {
            if (state.LastStudentAnswer != null) {
              if (teOption != null) {
                $target$$16 = 0;
                lq = state.LastQuestion;
                sa$$1 = state.LastStudentAnswer;
                te = teOption;
              } else {
                $target$$16 = 1;
              }
            } else {
              $target$$16 = 1;
            }
          } else {
            $target$$16 = 1;
          }

          switch ($target$$16) {
            case 0:
              {
                const polarity = (te.label_probs[0] > te.label_probs[1] ? 1 : -1) | 0;
                const strength = (te.label_probs[2] > 0.66 ? 1 : te.label_probs[2] > 0.33 ? 2 : 3) | 0;
                const feedback = sa$$1.trim() === "" ? DialogueMove$$$GetRandom$$Z6391FD10("neutralFeedback") : polarity === -1 ? strength === 2 ? DialogueMove$$$GetRandom$$Z6391FD10("neutralNegativeFeedback") : strength === 3 ? DialogueMove$$$GetRandom$$Z6391FD10("negativeFeedback") : DialogueMove$$$GetRandom$$Z6391FD10("neutralFeedback") : polarity === 1 ? strength === 2 ? DialogueMove$$$GetRandom$$Z6391FD10("neutralPositiveFeedback") : strength === 3 ? DialogueMove$$$GetRandom$$Z6391FD10("positiveFeedback") : DialogueMove$$$GetRandom$$Z6391FD10("neutralFeedback") : DialogueMove$$$GetRandom$$Z6391FD10("neutralFeedback");
                void display.push(feedback.Text);
                feedbackOption = feedback;
                break;
              }

            case 1:
              {
                feedbackOption = null;
                break;
              }
          }

          const makeElaboration = function makeElaboration() {
            const elaboration = [DialogueMove$$$GetRandom$$Z6391FD10("elaborationMarker"), DialogueMove$$$Create$$Z29C2FE95(text$$1, "elaboration"), DialogueMove$$$GetRandom$$Z6391FD10("shiftMarker")];
            (0, _Array.addRangeInPlace)(((0, _Array.map)(function mapping(e$$2) {
              return e$$2.Text;
            }, elaboration, Array)), display);
            return elaboration;
          };

          let elaborationOption;
          var $target$$18;

          if (feedbackOption != null) {
            if (x = feedbackOption, x.Type === "positiveFeedback") {
              $target$$18 = 0;
            } else {
              $target$$18 = 1;
            }
          } else {
            $target$$18 = 1;
          }

          switch ($target$$18) {
            case 0:
              {
                const arg0$$3 = makeElaboration();
                elaborationOption = arg0$$3;
                break;
              }

            case 1:
              {
                if (patternInput[0] == null) {
                  const arg0$$4 = makeElaboration();
                  elaborationOption = arg0$$4;
                } else {
                  elaborationOption = null;
                }

                break;
              }
          }

          return (patternInput[0] != null ? elaborationOption == null ? (q$$5 = patternInput[0], (void display.push(q$$5.Text), Promise.resolve())) : (null, Promise.resolve()) : (null, Promise.resolve())).then(() => (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
            var Questions, Display, arg0$$8;
            let finishedOption;

            if (elaborationOption == null) {
              finishedOption = false;
            } else {
              const x$$2 = elaborationOption;
              finishedOption = true;
            }

            return Promise.resolve(new _Option.Result(0, "Ok", (Questions = (patternInput[1]), (Display = (arg0$$8 = ((0, _String.join)(" ", display)), (arg0$$8)), new DialogueState(state.ClozeItem, state.ClozeAnswer, Questions, patternInput[0], state.LastStudentAnswer, feedbackOption, elaborationOption, patternInput[0], Display, finishedOption)))));
          }));
        } else {
          const errorPayload = [];
          (0, _Array.addRangeInPlace)((list$$1 = (list = new _Types.List(_arg1, new _Types.List()), ((0, _List.choose)(resultToErrorOption, list))), (mapping$$1 = (clo1 = (0, _String.toText)((0, _String.printf)("document annotation error: %A")), function (arg10) {
            return clo1(arg10);
          }), (0, _List.map)(mapping$$1, list$$1))), errorPayload);
          (0, _Array.addRangeInPlace)((list$$3 = (list$$2 = new _Types.List(_arg2, new _Types.List()), ((0, _List.choose)(resultToErrorOption, list$$2))), (mapping$$2 = (clo1$$1 = (0, _String.toText)((0, _String.printf)("textual entailment error: %A")), function (arg10$$1) {
            return clo1$$1(arg10$$1);
          }), (0, _List.map)(mapping$$2, list$$3))), errorPayload);
          return Promise.resolve(new _Option.Result(1, "Error", ((0, _String.join)("\n", errorPayload))));
        }
      });
    });
  }));
}