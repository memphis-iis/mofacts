export {sessionCleanUp};
import {curExperimentState} from "../views/experiment/card.js";

/* *****************************************************************
 * All of our currently known session variables
 * *****************************************************************
 * audioEnabled              - Did either the user or the tdf enable audio input for the current practice set?
 * audioEnabledView          - Did user enable audio input? Used to work around sessionCleanUp on card load
 * audioInputSensitivity     - Value from ? to ? for tuning audio input sensitivity
 * audioPromptFeedbackView   - Used to restore value on profile refresh after navigating away
 * audioPromptSpeakingRate   - Value from 0.1 to 2. Acts as percentage relative to 1, i.e. 2 is twice as fast as normal
 * audioPromptSpeakingRateView - Used to restore value on profile refresh after navigating away
 * audioToggled              - var to hold audioEnabled toggle state when navigating back to profile
 * buttonTrial
 * clusterIndex
 * clusterMapping            - For an entire experiment
 * currentAnswer
 * currentDisplay            - Entire display json structure with clozeText, text, imgSrc, audioSrc, videoSrc
 * currentRootTdfId
 * currentTdfName
 * currentTdfId
 * currentScore
 * currentUnitNumber
 * currentUnitStartTime      - Mostly only for lock-outs
 * debugging                 - Generic debugging flag
 * enableAudioPromptAndFeedback
 * experimentPasswordRequired - If enabled we'll prompt for a password in the experiment page
 * experimentTarget          - untouched in sessionCleanUp
 * experimentXCond           - untouched in sessionCleanUp
 * filter                    - filter for user admin page
 * ignoreOutOfGrammarResponses - speech input, only transcribe if recognized word in answer set
 * loginMode                 - untouched in sessionCleanUp
 * inResume
 * questionIndex
 * recording
 * runSimulation
 * sampleRate
 * showOverlearningText
 * speechAPIKeyIsSetup       - Indicates if we have a *user* provided speech api key (there may be one in the tdf file)
 * speechOutOfGrammarFeedback - What should we display when transcription is ignored when out of grammar
 * testType
 * */

// Handle an entire session - note that we current don't limit this to the
// client... but maybe we should?
function sessionCleanUp() {
  console.log('session cleanup!!!');

  Session.get('currentAnswer', undefined);
  Session.set('alternateDisplayIndex', undefined);
  Session.set('showDialogueText', false);
  Session.set('audioEnabled', undefined);
  Session.set('audioInputSensitivity', undefined);
  Session.set('audioPromptFeedbackView', undefined);
  Session.set('audioPromptFeedbackSpeakingRate', undefined);
  Session.set('audioPromptFeedbackVolume', undefined)
  Session.set('audioPromptQuestionVolume', undefined)
  Session.set('audioPromptQuestionSpeakingRate', undefined);
  Session.set('audioPromptVoice', undefined);
  Session.set('audioPromptFeedbackVoice', undefined);
  Session.set('buttonTrial', false);

  Session.set('schedule', undefined);

  Session.set('wasReportedForRemoval', false);
  Session.set('hiddenItems', []);
  Session.set('numVisibleCards', 0);

  Session.set('currentTdfName', undefined);
  Session.set('currentTdfId', undefined);
  Session.set('currentUnitNumber', undefined);
  Session.set('currentTdfUnit', undefined);
  Session.set('currentStimuliSet', undefined);
  Session.set('submmissionLock', false);
  Session.set('curStudentPerformance', undefined);
  Session.set('currentDeliveryParams', {});
  Session.set('currentExperimentState', undefined);
  Session.set('displayFeedback',undefined);
  Session.set('feedbackTypeFromHistory', undefined);
  Session.set('resetFeedbackSettingsFromIndex', false);
  Session.set('currentRootTdfId', undefined);
  Session.set('currentExperimentState', undefined);

  Session.set('clusterIndex', undefined);

  Session.set('dialogueCacheHint', undefined);

  Session.set('displayReady', undefined);
  Session.set('currentDisplay', undefined);
  Session.set('originalQuestion', undefined);
  Session.set('engineIndices', undefined);

  Session.set('currentUnitStartTime', Date.now());
  Session.set('currentScore', 0);
  Session.set('overallOutcomeHistory', []);
  Session.set('dialogueLoopStage', undefined);
  Session.set('dialogueHistory', undefined);
  Session.set('enableAudioPromptAndFeedback', false);
  Session.set('errorReportStart', undefined);
  Session.set('mainCardTimeoutStart', undefined);
  Session.set('pausedLocks', 0);
  Session.set('audioPromptMode', undefined);
  Session.set('experimentPasswordRequired', false);
  Session.set('filter', '@gmail.com');
  Session.set('ignoreOutOfGrammarResponses', false);
  Session.set('inResume', false);
  Session.set('questionIndex', undefined);
  Session.set('recording', false);
  Session.set('sampleRate', undefined);
  Session.set('unitType', undefined);
  Session.set('speechOutOfGrammarFeedback', undefined);
  Session.set('subTdfIndex', undefined);
  Session.set('testType', undefined);
  Session.set('scoringEnabled', undefined);
  Session.set('feedbackParamsSet', undefined);
  Session.set('instructionQuestionResult', undefined);
  Session.set('hintLevel', undefined);
  Session.set('curTdfTips', undefined)
  Meteor.clearInterval(Session.get('CurIntervalId'))
  Session.set('CurIntervalId', undefined)
  Meteor.clearTimeout(Session.get('CurTimeoutId'));
  Session.set('CurTimeoutId', undefined);
  Meteor.clearInterval(Session.get('varLenTimeoutName'));
  Session.set('varLenTimeoutName', null)
  Session.set('recordingLocked', false);
  Session.set('selectedTdfDueDate', undefined);
  Session.set('currentStimProbFunctionParameters', undefined);
  if (window.currentAudioObj) {
    window.currentAudioObj.pause();
    window.currentAudioObj = null;
  }
  if(window.audioContext && window.audioContext.state != "closed"){
    window.audioContext.close();
    window.audioContext = null;
  }
  if(curExperimentState){
    let globalExperimentState = GlobalExperimentStates.findOne({TDFId: Session.get('currentRootTdfId')})
    if(globalExperimentState){
      curExperimentState = Object.assign(globalExperimentState.experimentState, curExperimentState)
      GlobalExperimentStates.update({_id: globalExperimentState._id}, {$set: {experimentState: curExperimentState}});
    }
  }
  Session.set('currentRootTdfId', undefined);
  curExperimentState = null;
}

