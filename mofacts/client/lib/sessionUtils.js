export {sessionCleanUp};

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
 * VADInitialized            - Is voice activity detection code for voice start/stop events initialized
 * */

// Handle an entire session - note that we current don't limit this to the
// client... but maybe we should?
const localMongo = new Mongo.Collection(null); // local-only - no database
function sessionCleanUp() {
  console.log('session cleanup!!!');

  data = localMongo.findOne({})  || {}; data.alternateDisplayIndex =  undefined; localMongo.update({},{$set:data});
  data = localMongo.findOne({})  || {}; data.audioEnabled =  undefined; localMongo.update({},{$set:data});
  data = localMongo.findOne({})  || {}; data.audioInputSensitivity =  undefined; localMongo.update({},{$set:data});
  data = localMongo.findOne({})  || {}; data.audioPromptFeedbackView =  undefined; localMongo.update({},{$set:data});
  data = localMongo.findOne({})  || {}; data.audioPromptFeedbackSpeakingRate =  undefined; localMongo.update({},{$set:data});
  data = localMongo.findOne({})  || {}; data.audioPromptFeedbackVolume =  undefined; localMongo.update({},{$set:data});
  data = localMongo.findOne({})  || {}; data.audioPromptQuestionVolume =  undefined; localMongo.update({},{$set:data});
  data = localMongo.findOne({})  || {}; data.audioPromptQuestionSpeakingRate =  undefined; localMongo.update({},{$set:data});
  data = localMongo.findOne({})  || {}; data.buttonTrial =  false; localMongo.update({},{$set:data});
  data = localMongo.findOne({})  || {}; data.currentAnswerSyllables =  undefined; localMongo.update({},{$set:data});

  data = localMongo.findOne({})  || {}; data.schedule =  undefined; localMongo.update({},{$set:data});

  data = localMongo.findOne({})  || {}; data.wasReportedForRemoval =  false; localMongo.update({},{$set:data});
  data = localMongo.findOne({})  || {}; data.hiddenItems =  []; localMongo.update({},{$set:data});
  data = localMongo.findOne({})  || {}; data.numVisibleCards =  0; localMongo.update({},{$set:data});

  data = localMongo.findOne({})  || {}; data.currentRootTdfId =  undefined; localMongo.update({},{$set:data});
  data = localMongo.findOne({})  || {}; data.currentTdfName =  undefined; localMongo.update({},{$set:data});
  data = localMongo.findOne({})  || {}; data.currentTdfId =  undefined; localMongo.update({},{$set:data});
  data = localMongo.findOne({})  || {}; data.currentUnitNumber =  undefined; localMongo.update({},{$set:data});
  data = localMongo.findOne({})  || {}; data.currentTdfUnit =  undefined; localMongo.update({},{$set:data});
  data = localMongo.findOne({})  || {}; data.currentStimuliSet =  undefined; localMongo.update({},{$set:data});
  data = localMongo.findOne({})  || {}; data.curStudentPerformance =  undefined; localMongo.update({},{$set:data});
  data = localMongo.findOne({})  || {}; data.currentDeliveryParams =  {}; localMongo.update({},{$set:data});
  data = localMongo.findOne({})  || {}; data.currentExperimentState =  undefined; localMongo.update({},{$set:data});
  data = localMongo.findOne({})  || {}; data.displayFeedback = undefined; localMongo.update({},{$set:data});
  data = localMongo.findOne({})  || {}; data.feedbackTypeFromHistory =  undefined; localMongo.update({},{$set:data});
  data = localMongo.findOne({})  || {}; data.resetFeedbackSettingsFromIndex =  false; localMongo.update({},{$set:data});

  data = localMongo.findOne({})  || {}; data.clusterIndex =  undefined; localMongo.update({},{$set:data});
  data = localMongo.findOne({})  || {}; data.currentAnswer =  undefined; localMongo.update({},{$set:data});
  data = localMongo.findOne({})  || {}; data.originalAnswer =  undefined; localMongo.update({},{$set:data});

  data = localMongo.findOne({})  || {}; data.dialogueCacheHint =  undefined; localMongo.update({},{$set:data});

  data = localMongo.findOne({})  || {}; data.displayReady =  undefined; localMongo.update({},{$set:data});
  data = localMongo.findOne({})  || {}; data.currentDisplay =  undefined; localMongo.update({},{$set:data});
  data = localMongo.findOne({})  || {}; data.currentDisplayEngine =  undefined; localMongo.update({},{$set:data});
  data = localMongo.findOne({})  || {}; data.originalDisplay =  undefined; localMongo.update({},{$set:data});
  data = localMongo.findOne({})  || {}; data.currentQuestionPart2 =  undefined; localMongo.update({},{$set:data});
  data = localMongo.findOne({})  || {}; data.originalQuestion =  undefined; localMongo.update({},{$set:data});
  data = localMongo.findOne({})  || {}; data.originalQuestion2 =  undefined; localMongo.update({},{$set:data});
  data = localMongo.findOne({})  || {}; data.clozeQuestionParts =  undefined; localMongo.update({},{$set:data});
  data = localMongo.findOne({})  || {}; data.engineIndices =  undefined; localMongo.update({},{$set:data});

  data = localMongo.findOne({})  || {}; data.currentUnitStartTime =  Date.now(); localMongo.update({},{$set:data});
  data = localMongo.findOne({})  || {}; data.currentScore =  0; localMongo.update({},{$set:data});
  data = localMongo.findOne({})  || {}; data.overallOutcomeHistory =  []; localMongo.update({},{$set:data});
  data = localMongo.findOne({})  || {}; data.dialogueLoopStage =  undefined; localMongo.update({},{$set:data});
  data = localMongo.findOne({})  || {}; data.dialogueHistory =  undefined; localMongo.update({},{$set:data});
  data = localMongo.findOne({})  || {}; data.enableAudioPromptAndFeedback =  false; localMongo.update({},{$set:data});
  data = localMongo.findOne({})  || {}; data.errorReportStart =  undefined; localMongo.update({},{$set:data});
  data = localMongo.findOne({})  || {}; data.mainCardTimeoutStart =  undefined; localMongo.update({},{$set:data});
  data = localMongo.findOne({})  || {}; data.pausedLocks =  0; localMongo.update({},{$set:data});
  data = localMongo.findOne({})  || {}; data.audioPromptMode =  undefined; localMongo.update({},{$set:data});
  data = localMongo.findOne({})  || {}; data.experimentPasswordRequired =  false; localMongo.update({},{$set:data});
  data = localMongo.findOne({})  || {}; data.filter =  '@gmail.com'; localMongo.update({},{$set:data});
  data = localMongo.findOne({})  || {}; data.ignoreOutOfGrammarResponses =  false; localMongo.update({},{$set:data});
  data = localMongo.findOne({})  || {}; data.inResume =  false; localMongo.update({},{$set:data});
  data = localMongo.findOne({})  || {}; data.questionIndex =  undefined; localMongo.update({},{$set:data});
  data = localMongo.findOne({})  || {}; data.recording =  false; localMongo.update({},{$set:data});
  data = localMongo.findOne({})  || {}; data.sampleRate =  undefined; localMongo.update({},{$set:data});
  data = localMongo.findOne({})  || {}; data.unitType =  undefined; localMongo.update({},{$set:data});
  data = localMongo.findOne({})  || {}; data.showOverlearningText =  undefined; localMongo.update({},{$set:data});
  data = localMongo.findOne({})  || {}; data.speechOutOfGrammarFeedback =  undefined; localMongo.update({},{$set:data});
  data = localMongo.findOne({})  || {}; data.subTdfIndex =  undefined; localMongo.update({},{$set:data});
  data = localMongo.findOne({})  || {}; data.testType =  undefined; localMongo.update({},{$set:data});
  data = localMongo.findOne({})  || {}; data.VADInitialized =  false; localMongo.update({},{$set:data});
  data = localMongo.findOne({})  || {}; data.scoringEnabled =  undefined; localMongo.update({},{$set:data});
  data = localMongo.findOne({})  || {}; data.feedbackParamsSet =  undefined; localMongo.update({},{$set:data});
  data = localMongo.findOne({})  || {}; data.instructionQuestionResult =  undefined; localMongo.update({},{$set:data});
  data = localMongo.findOne({})  || {}; data.hintLevel =  undefined; localMongo.update({},{$set:data});
}

