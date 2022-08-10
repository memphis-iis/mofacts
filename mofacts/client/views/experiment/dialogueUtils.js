import {speakMessageIfAudioPromptFeedbackEnabled, startRecording, stopRecording} from './card.js';
export {dialogueLoop, dialogueContinue, initiateDialogue};
export const DialogueUtils = {
  isUserInDialogueLoop: function() {
    return typeof(Session.get('dialogueLoopStage')) != 'undefined';
  },

  isUserInDialogueIntroExit: function() {
    return Session.get('dialogueLoopStage') == 'intro' || Session.get('dialogueLoopStage') == 'exit';
  },

  setDialogueUserAnswerValue: function(val) {
    $('#dialogueUserAnswer').val(val);
  },

  getDialogueUserAnswerValue: function() {
    return $('#dialogueUserAnswer').val();
  },

  updateDialogueState: function(answer) {
    dialogueUserAnswers.push(answer);
    dialogueContext.LastStudentAnswer = answer;
    return dialogueContext;
  },
};

let dialogueUserAnswers = [];
let dialogueContext = undefined;
let dialogueUserPrompts = [];
let closeQuestionPartsSaver = undefined;
let dialogueCurrentDisplaySaver = undefined;
let dialogueCallbackSaver = undefined;
const dialogueTransitionInstructions = '  Press the button to continue.';
const dialogueTransitionInstructionsVoiceTrigger = '  Press the button or say \'continue\' to continue.';
const endDialogueNotice = ' Press the button to continue practice.';
const dialogueTransitionStatements = [
  'That wasn’t right, so to help you build the knowledge let’s chat about it for a little.',
  'That wasn’t the answer we are looking for. To help you construct the understanding, let’s have a short discussion.',
  'Sorry, but that wasn’t quite right. Let’s talk through this item.',
  'Incorrect. Lets help you build that knowledge with a brief discussion.',
  'The right answer is different. To get you started learning it, let’s chat.',
  'Your answer was incorrect. Let’s talk about this some more.',
  'Not quite. I’m going to ask you some follow up questions.',
];

function updateDialogueDisplay(newDisplay) {
  Session.set('displayReady', false);
  // set prompt and feedback here
  const displayWrapper = {'text': newDisplay};
  Session.set('dialogueDisplay', displayWrapper);
  $('#dialogueUserAnswer').prop('disabled', false);
  $('#dialogueUserAnswer').val('');
  Session.set('displayReady', true);
  Tracker.afterFlush(function() {
    // $('#textQuestion').css({'color': '#383d41', 'background-color': '#e2e3e5', 'border-color': '#d6d8db'})
    console.log('dialogue after flush');
    $('#dialogueUserAnswer').focus();
  });
}

function dialogueLoop(err, res) {
  console.log('dialogue loop');
  stopRecording();
  if (typeof(err) != 'undefined') {
    console.log('error with dialogue loop, meteor call: ', err);
    console.log(res);
    dialogueCallbackSaver();
  } else if (res.tag != 0) {
    console.log('error with dialog loop, dialogue call: ' + res.name);
    console.log(res);
    dialogueCallbackSaver();
  } else if (res.tag == 0) {
    const result = res.fields[0];
    let newDisplay = result.Display;

    if (result.Finished) {
      newDisplay = result.Display + endDialogueNotice;
      Session.set('dialogueLoopStage', 'exit');
    }
    updateDialogueDisplay(newDisplay);
    speakMessageIfAudioPromptFeedbackEnabled(newDisplay, 'dialogue');

    if (Session.get('audioEnabled')) {
      startRecording();
    }
    dialogueContext = result;
    dialogueUserPrompts.push(newDisplay);
    // wait for user input
  }
  Meteor.setTimeout(() => {
    Session.set('enterKeyLock', false);
    console.log('releasing enterKeyLock in dialogueLoop');
  }, 2000);
}

function dialogueContinue() {
  console.log('dialogueContinue');
  const dialogueLoopStage = Session.get('dialogueLoopStage');
  switch (dialogueLoopStage) {
    case 'intro':
      // Enter dialogue loop
      Session.set('displayReady', false); // This will get flipped back after we update the display inside dialogueLoop
      Session.set('dialogueLoopStage', 'insideLoop');
      console.log('getDialogFeedbackForAnswer3', dialogueContext);
      Meteor.call('getDialogFeedbackForAnswer', dialogueContext, dialogueLoop);
      break;
    case 'exit':
      // Exit dialogue loop
      console.log('dialogue loop finished, restoring state');
      Session.set('dialogueTotalTime', Date.now() - Session.get('dialogueStart'));
      Session.set('dialogueStart', undefined);
      Session.set('displayReady', false);
      Session.set('dialogueLoopStage', undefined);
      Session.set('showDialogueText', false);
      // restore session state
      Session.set('currentDisplay', dialogueCurrentDisplaySaver);
      Session.set('closeQuestionParts', closeQuestionPartsSaver);
      console.log('finished, exiting dialogue loop');
      dialogueContext.UserPrompts = JSON.parse(JSON.stringify(dialogueUserPrompts));
      dialogueContext.UserAnswers = JSON.parse(JSON.stringify(dialogueUserAnswers));
      dialogueUserPrompts = [];
      dialogueUserAnswers = [];
      Session.set('dialogueHistory', dialogueContext);
      dialogueCallbackSaver();
    // eslint-disable-next-line no-fallthrough
    default:
      Session.set('enterKeyLock', false);
      console.log('releasing enterKeyLock in dialogueContinue');
  }
}

function initiateDialogue(incorrectUserAnswer, callback, lookupFailCallback) {
  Session.set('dialogueStart', Date.now());
  Session.set('showDialogueText', true);
  const clozeItem = Session.get('originalQuestion') || Session.get('currentDisplay').clozeText;
  const clozeAnswer = Session.get('originalAnswer') || Session.get('currentAnswer');
  // $('#textQuestion').css({'color': '#383d41', 'background-color': '#e2e3e5', 'border-color': '#d6d8db'})

  Meteor.call('initializeTutorialDialogue', clozeAnswer, incorrectUserAnswer, clozeItem, (err, res)=>{
    if (err) {
      console.log('ERROR initializing tutorial dialogue:', err);
    } else {
      console.log('initializeTutorialDialogue,res:', res);
      if (res.tag != 0) {
        console.log('cache miss, showing normal feedback:');
        Session.set('dialogueHistory', res);
        console.log('dialogueHistory', Session.get('dialogueHistory'));
        Session.set('dialogueLoopStage', undefined);
        Tracker.afterFlush(()=>$('#userAnswer').val(incorrectUserAnswer));
        lookupFailCallback();
      } else {
        dialogueContext = res.fields[0];
        if (!dialogueContext) {
          console.log('ERROR getting context during dialogue initialization');
        } else {
          closeQuestionPartsSaver = Session.get('clozeQuestionParts');
          Session.set('clozeQuestionParts', undefined);
          Session.set('dialogueLoopStage', 'intro');
          dialogueCurrentDisplaySaver = JSON.parse(JSON.stringify(Session.get('currentDisplay')));
          dialogueCallbackSaver = callback;

          if (Session.get('buttonTrial')) {
            const buttonEntries = _.map(Session.get('buttonList'), (val) => val.buttonValue).join(',');
            Session.set('buttonEntriesTemp', JSON.parse(JSON.stringify(buttonEntries)));
            Session.set('buttonList', []);
          }


          let transitionStatement = dialogueTransitionStatements[Math.floor(Math.random() * dialogueTransitionStatements.length)];

          if (Session.get('audioEnabled')) {
            startRecording();
            transitionStatement = transitionStatement + dialogueTransitionInstructionsVoiceTrigger;
          } else {
            transitionStatement = transitionStatement + dialogueTransitionInstructions;
          }
          updateDialogueDisplay(transitionStatement);
          speakMessageIfAudioPromptFeedbackEnabled(transitionStatement, 'dialogue');
          // wait for user to hit enter to make sure they read the transition statement
          // execution thread continues at keypress #dialogueUserAnswer in card.js
        }
      }
    }
  });
}
