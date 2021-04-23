"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getRandomMove = getRandomMove;
exports.DialogueMove$reflection = DialogueMove$reflection;
exports.DialogueMove$$$GetRandom$$Z6391FD10 = DialogueMove$$$GetRandom$$Z6391FD10;
exports.DialogueMove$$$Create$$Z29C2FE95 = DialogueMove$$$Create$$Z29C2FE95;
exports.DialogueState$reflection = DialogueState$reflection;
exports.DialogueState$$$Initialize = DialogueState$$$Initialize;
exports.DialogueState$$$InitializeTest = DialogueState$$$InitializeTest;
exports.GetDialogue = GetDialogue;
exports.HarnessGetDialogue = HarnessGetDialogue;
exports.GetElaboratedDialogueState = GetElaboratedDialogueState;
exports.HarnessElaboratedDialogueState$reflection = HarnessElaboratedDialogueState$reflection;
exports.HarnessElaboratedDialogueState$$$InitializeTest = HarnessElaboratedDialogueState$$$InitializeTest;
exports.HarnessGetElaboratedDialogueState = HarnessGetElaboratedDialogueState;
exports.HarnessElaboratedDialogueState = exports.DialogueState = exports.DialogueMove = exports.random = exports.dialogueBags = void 0;

var _List = require("./fable-library.2.10.2/List");

var _Util = require("./fable-library.2.10.2/Util");

var _Map = require("./fable-library.2.10.2/Map");

var _Types = require("./fable-library.2.10.2/Types");

var _Reflection = require("./fable-library.2.10.2/Reflection");

var _QuestionGenerator = require("./QuestionGenerator");

var _RegExp = require("./fable-library.2.10.2/RegExp");

var _AllenNLP = require("./AllenNLP");

var _Option = require("./fable-library.2.10.2/Option");

var _Array = require("./fable-library.2.10.2/Array");

var _Set = require("./fable-library.2.10.2/Set");

var _PromiseImpl = require("./Fable.Promise.2.1.0/PromiseImpl");

var _String = require("./fable-library.2.10.2/String");

var _Promise = require("./Fable.Promise.2.1.0/Promise");

var _Decode = require("./Thoth.Json.4.0.0/Decode");

var _CachedElaboratedFeedback = require("./CachedElaboratedFeedback");

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

const DialogueMove = (0, _Types.declare)(function TutorialDialogue_DialogueMove(Text$, Type) {
  this.Text = Text$;
  this.Type = Type;
}, _Types.Record);
exports.DialogueMove = DialogueMove;

function DialogueMove$reflection() {
  return (0, _Reflection.record_type)("TutorialDialogue.DialogueMove", [], DialogueMove, () => [["Text", _Reflection.string_type], ["Type", _Reflection.string_type]]);
}

function DialogueMove$$$GetRandom$$Z6391FD10(aType) {
  return new DialogueMove((getRandomMove(aType)), aType);
}

function DialogueMove$$$Create$$Z29C2FE95(text, aType$$1) {
  return new DialogueMove(text, aType$$1);
}

const DialogueState = (0, _Types.declare)(function TutorialDialogue_DialogueState(ClozeItem, ClozeAnswer, Questions, LastQuestion, LastStudentAnswer, CurrentFeedback, CurrentElaboration, CurrentQuestion, Display, Finished) {
  this.ClozeItem = ClozeItem;
  this.ClozeAnswer = ClozeAnswer;
  this.Questions = Questions;
  this.LastQuestion = LastQuestion;
  this.LastStudentAnswer = LastStudentAnswer;
  this.CurrentFeedback = CurrentFeedback;
  this.CurrentElaboration = CurrentElaboration;
  this.CurrentQuestion = CurrentQuestion;
  this.Display = Display;
  this.Finished = Finished;
}, _Types.Record);
exports.DialogueState = DialogueState;

function DialogueState$reflection() {
  return (0, _Reflection.record_type)("TutorialDialogue.DialogueState", [], DialogueState, () => [["ClozeItem", _Reflection.string_type], ["ClozeAnswer", _Reflection.string_type], ["Questions", (0, _Reflection.option_type)((0, _Reflection.array_type)((0, _QuestionGenerator.Question$reflection)()))], ["LastQuestion", (0, _Reflection.option_type)((0, _QuestionGenerator.Question$reflection)())], ["LastStudentAnswer", (0, _Reflection.option_type)(_Reflection.string_type)], ["CurrentFeedback", (0, _Reflection.option_type)(DialogueMove$reflection())], ["CurrentElaboration", (0, _Reflection.option_type)((0, _Reflection.array_type)(DialogueMove$reflection()))], ["CurrentQuestion", (0, _Reflection.option_type)((0, _QuestionGenerator.Question$reflection)())], ["Display", (0, _Reflection.option_type)(_Reflection.string_type)], ["Finished", (0, _Reflection.option_type)(_Reflection.bool_type)]]);
}

function DialogueState$$$Initialize(clozeItem, clozeAnswer) {
  return new DialogueState(clozeItem, clozeAnswer, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined);
}

function DialogueState$$$InitializeTest() {
  return DialogueState$$$Initialize("The interstitial fluid, which bathes cells in the body, is the environment to which those cells are most directly exposed, but the composition of the interstitial fluid is in equilibrium with the composition of the blood plasma, so both contribute to the ______ ______", "internal environment");
}

function GetDialogue(state) {
  return (0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
    var stringArrayJsonOption, input;
    const errors = [];
    const text$$1 = (0, _RegExp.replace)(state.ClozeItem, "(_ _|_)+", state.ClozeAnswer);
    return (state.Questions == null ? (stringArrayJsonOption = undefined, (0, _AllenNLP.GetNLP)(stringArrayJsonOption, text$$1)) : (input = (0, _AllenNLP.DocumentAnnotation$$$CreateEmpty)(), ((0, _AllenNLP.Promisify)(input)))).then(function (_arg1) {
      var input$$1;
      return ((state.LastQuestion != null ? state.LastStudentAnswer != null : false) ? (0, _AllenNLP.GetTextualEntailment)(state.LastQuestion.Answer, state.LastStudentAnswer) : (input$$1 = (0, _AllenNLP.Entailment$$$CreateEmpty)(), ((0, _AllenNLP.Promisify)(input$$1)))).then(function (_arg2) {
        var lastQ, x, q$$5, list$$1, list, mapping$$1, clo1, list$$3, list$$2, mapping$$2, clo1$$1;

        const isOK = function isOK(r) {
          if (r.tag === 1) {
            return false;
          } else {
            return true;
          }
        };

        const resultToTypeOption = function resultToTypeOption(r$$2) {
          if (r$$2.tag === 1) {
            return undefined;
          } else {
            return (0, _Option.some)(r$$2.fields[0]);
          }
        };

        const resultToErrorOption = function resultToErrorOption(r$$4) {
          if (r$$4.tag === 1) {
            return (0, _Option.some)(r$$4.fields[0]);
          } else {
            return undefined;
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
              questions = (0, _QuestionGenerator.GetQuotedQuestions)(state.ClozeAnswer, sa);
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
          let prompts;
          prompts = questions.filter(function predicate$$1(q$$2) {
            return q$$2.QuestionType === "prompt";
          });
          var $target$$21, h, lastQ$$1, ps$$1;

          if (state.LastQuestion != null) {
            if (lastQ = state.LastQuestion, lastQ.QuestionType === "hint" ? prompts.length > 0 : false) {
              $target$$21 = 1;
              lastQ$$1 = state.LastQuestion;
              ps$$1 = prompts;
            } else {
              $target$$21 = 2;
            }
          } else if (hintOption != null) {
            $target$$21 = 0;
            h = hintOption;
          } else {
            $target$$21 = 2;
          }

          switch ($target$$21) {
            case 0:
              {
                patternInput = [(h), (questions.filter(function predicate$$2(q$$3) {
                  return !(0, _Util.equals)(q$$3, h);
                }))];
                break;
              }

            case 1:
              {
                let lastSet;
                const array$$4 = lastQ$$1.Answer.split(" ");
                lastSet = (0, _Set.ofArray)(array$$4, {
                  Compare: _Util.comparePrimitives
                });
                let p;
                p = (0, _Array.maxBy)(function projection(ap) {
                  let candidateSet;
                  const array$$5 = ap.Focus.split(" ");
                  candidateSet = (0, _Set.ofArray)(array$$5, {
                    Compare: _Util.comparePrimitives
                  });
                  const intersection = (0, _Set.intersect)(candidateSet, lastSet);
                  return (0, _Set.FSharpSet$$get_Count)(intersection) | 0;
                }, ps$$1, {
                  Compare: _Util.comparePrimitives
                });
                patternInput = [(p), (questions.filter(function predicate$$3(q$$4) {
                  return !(0, _Util.equals)(q$$4, p);
                }))];
                break;
              }

            case 2:
              {
                patternInput = [undefined, questions];
                break;
              }
          }

          let feedbackOption;
          var $target$$25, lq, sa$$1, te;

          if (state.LastQuestion != null) {
            if (state.LastStudentAnswer != null) {
              if (teOption != null) {
                $target$$25 = 0;
                lq = state.LastQuestion;
                sa$$1 = state.LastStudentAnswer;
                te = teOption;
              } else {
                $target$$25 = 1;
              }
            } else {
              $target$$25 = 1;
            }
          } else {
            $target$$25 = 1;
          }

          switch ($target$$25) {
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
                feedbackOption = undefined;
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
          var $target$$27;

          if (feedbackOption != null) {
            if (x = feedbackOption, x.Type === "positiveFeedback") {
              $target$$27 = 0;
            } else {
              $target$$27 = 1;
            }
          } else {
            $target$$27 = 1;
          }

          switch ($target$$27) {
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
                  elaborationOption = undefined;
                }

                break;
              }
          }

          return (patternInput[0] != null ? elaborationOption == null ? (q$$5 = patternInput[0], (void display.push(q$$5.Text), Promise.resolve())) : (void null, Promise.resolve()) : (void null, Promise.resolve())).then(() => (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
            var Questions, Display, arg0$$8;
            let finishedOption;

            if (elaborationOption == null) {
              finishedOption = false;
            } else {
              const x$$2 = elaborationOption;
              finishedOption = true;
            }

            return (state.LastQuestion == null ? patternInput[0] == null : false) ? Promise.resolve(new _Option.Result(1, "Error", "Aborting dialogue: unable to generate questions")) : Promise.resolve(new _Option.Result(0, "Ok", (Questions = (patternInput[1]), (Display = (arg0$$8 = ((0, _String.join)(" ", display)), (arg0$$8)), new DialogueState(state.ClozeItem, state.ClozeAnswer, Questions, patternInput[0], state.LastStudentAnswer, feedbackOption, elaborationOption, patternInput[0], Display, finishedOption)))));
          }));
        } else {
          const errorPayload = [];
          (0, _Array.addRangeInPlace)((list$$1 = (list = new _Types.List(_arg1, new _Types.List()), ((0, _List.choose)(resultToErrorOption, list))), (mapping$$1 = (clo1 = (0, _String.toText)((0, _String.printf)("document annotation error: %A")), function (arg10$$1) {
            return clo1(arg10$$1);
          }), (0, _List.map)(mapping$$1, list$$1))), errorPayload);
          (0, _Array.addRangeInPlace)((list$$3 = (list$$2 = new _Types.List(_arg2, new _Types.List()), ((0, _List.choose)(resultToErrorOption, list$$2))), (mapping$$2 = (clo1$$1 = (0, _String.toText)((0, _String.printf)("textual entailment error: %A")), function (arg10$$2) {
            return clo1$$1(arg10$$2);
          }), (0, _List.map)(mapping$$2, list$$3))), errorPayload);
          return Promise.resolve(new _Option.Result(1, "Error", ((0, _String.join)("\n", errorPayload))));
        }
      });
    });
  }));
}

function HarnessGetDialogue(jsonState) {
  let state$$1;
  state$$1 = (0, _Decode.Auto$$$unsafeFromString$$Z5CB6BD)(jsonState, undefined, undefined, {
    ResolveType() {
      return DialogueState$reflection();
    }

  });
  return GetDialogue(state$$1);
}

function GetElaboratedDialogueState(correctAnswer, incorrectAnswer, clozeItem$$1) {
  return (0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
    return (0, _CachedElaboratedFeedback.GenerateFeedback)(incorrectAnswer, correctAnswer).then(function (_arg1$$1) {
      if (_arg1$$1.tag === 1) {
        return Promise.resolve(new _Option.Result(1, "Error", _arg1$$1.fields[0]));
      } else {
        const cs = (0, _CachedElaboratedFeedback.correctnessStatement)(incorrectAnswer, correctAnswer);
        const candidateSentences = (0, _String.replace)(_arg1$$1.fields[0].Feedback, cs, "").split(".");
        let jointOption;
        jointOption = (0, _Array.tryFind)(function predicate$$4(s) {
          if (s.toLocaleLowerCase().indexOf(incorrectAnswer.toLocaleLowerCase()) >= 0) {
            return s.toLocaleLowerCase().indexOf(correctAnswer.toLocaleLowerCase()) >= 0;
          } else {
            return false;
          }
        }, candidateSentences);
        let iaOption;
        iaOption = (0, _Array.tryFind)(function predicate$$5(s$$1) {
          return s$$1.toLocaleLowerCase().indexOf(incorrectAnswer.toLocaleLowerCase()) >= 0;
        }, candidateSentences);
        let caOption;
        caOption = (0, _Array.tryFind)(function predicate$$6(s$$2) {
          return s$$2.toLocaleLowerCase().indexOf(correctAnswer.toLocaleLowerCase()) >= 0;
        }, candidateSentences);
        let patternInput$$1;

        if (jointOption != null) {
          const j = jointOption;
          patternInput$$1 = [j + ".", incorrectAnswer];
        } else if (iaOption != null) {
          const i = iaOption;
          patternInput$$1 = [i + ".", incorrectAnswer];
        } else if (caOption != null) {
          const c = caOption;
          patternInput$$1 = [c + ".", correctAnswer];
        } else {
          patternInput$$1 = [clozeItem$$1, correctAnswer];
        }

        return Promise.resolve(new _Option.Result(0, "Ok", (DialogueState$$$Initialize(patternInput$$1[0], patternInput$$1[1]))));
      }
    });
  }));
}

const HarnessElaboratedDialogueState = (0, _Types.declare)(function TutorialDialogue_HarnessElaboratedDialogueState(CorrectAnswer, IncorrectAnswer, ClozeItem) {
  this.CorrectAnswer = CorrectAnswer;
  this.IncorrectAnswer = IncorrectAnswer;
  this.ClozeItem = ClozeItem;
}, _Types.Record);
exports.HarnessElaboratedDialogueState = HarnessElaboratedDialogueState;

function HarnessElaboratedDialogueState$reflection() {
  return (0, _Reflection.record_type)("TutorialDialogue.HarnessElaboratedDialogueState", [], HarnessElaboratedDialogueState, () => [["CorrectAnswer", _Reflection.string_type], ["IncorrectAnswer", _Reflection.string_type], ["ClozeItem", _Reflection.string_type]]);
}

function HarnessElaboratedDialogueState$$$InitializeTest() {
  return new HarnessElaboratedDialogueState("cerebellum", "cerebrum", "Small amounts enter the central canal of the spinal cord, but most CSF circulates through the subarachnoid space of both the brain and the spinal cord by passing through openings in the wall of the fourth ventricle near the cerebellum .");
}

function HarnessGetElaboratedDialogueState(jsonState$$1) {
  let state$$2;
  state$$2 = (0, _Decode.Auto$$$unsafeFromString$$Z5CB6BD)(jsonState$$1, undefined, undefined, {
    ResolveType() {
      return HarnessElaboratedDialogueState$reflection();
    }

  });
  return GetElaboratedDialogueState(state$$2.CorrectAnswer, state$$2.IncorrectAnswer, state$$2.ClozeItem);
}