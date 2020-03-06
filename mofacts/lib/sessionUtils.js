//////////////////////////////////////////////////////////////////////////
// Session helpers

/* *****************************************************************
 * All of our currently known session variables
 * *****************************************************************
 * audioEnabled              - Did either the user or the tdf enable audio input for the current practice set?
 * audioEnabledView          - Did user enable audio input? Used to restore value on profile refresh after navigating away
 * audioInputSensitivity     - Value from ? to ? for tuning audio input sensitivity (how loud to talk to trigger voice start)
 * audioPromptFeedbackView   - Used to restore value on profile refresh after navigating away
 * audioPromptSpeakingRate   - Value from 0.1 to 2. Acts as percentage relative to 1, i.e. 2 is twice as fast as normal, 0.5 is half as fast
 * audioPromptSpeakingRateView - Used to restore value on profile refresh after navigating away
 * audioToggled              - var to hold audioEnabled toggle state when navigating back to profile, don't reset here as that defeats the purpose
 * buttonTrial
 * clusterIndex
 * clusterMapping            - For an entire experiment
 * currentAnswer
 * currentQuestion
 * currentRootTdfName
 * currentTdfName
 * currentScore
 * currentStimName
 * currentUnitNumber
 * currentUnitStartTime      - Mostly only for lock-outs
 * debugging                 - Generic debugging flag
 * enableAudioPromptAndFeedback
 * experimentPasswordRequired - If enabled we'll prompt for a password in the experiment page
 * experimentTarget          - untouched in sessionCleanUp
 * experimentXCond           - untouched in sessionCleanUp
 * filter                    - filter for user admin page
 * ignoreOutOfGrammarResponses - speech input, only transcribe if recognized word in answer set
 * lastTimestamp             - set only by resume logic in card
 * loginMode                 - untouched in sessionCleanUp
 * needResume
 * questionIndex
 * recording
 * runSimulation
 * sampleRate
 * showOverlearningText
 * speechAPIKeyIsSetup       - Indicates if we have a *user* provided speech api key (there may be one provided in the tdf file)
 * speechOutOfGrammarFeedback - If ignoring out of grammar responses, what should we display when transcription is ignored?
 * statsAnswerDetails        - Used by stats page template
 * statsCorrect              - Used by stats page template
 * statsPercentage           - Used by stats page template
 * statsRendered             - Used by stats page template
 * statsTotal                - Used by stats page template
 * statsUserTimeLogView      - User by stats page template
 * testType
 * VADInitialized            - Indicates whether we've already initialized the voice activity detection code which gives up our voice start/stop events
 * */

//Handle an entire session - note that we current don't limit this to the
//client... but maybe we should?
sessionCleanUp = function() {
    console.log("session cleanup!!!");
    Session.set("audioEnabled",undefined);
    Session.set("audioInputSensitivity",undefined);
    Session.set("audioPromptFeedbackView",undefined);
    Session.set("audioPromptSpeakingRate",undefined);
    Session.set("buttonTrial", false);
    Session.set("currentRootTdfName", undefined);
    Session.set("currentTdfName", undefined);
    Session.set("currentStimName", undefined);
    Session.set("curTeacher",undefined);
    Session.set("clusterIndex", undefined);
    Session.set("currentAnswer", undefined);
    Session.set("originalAnswer",undefined);
    Session.set("currentQuestion", undefined);
    Session.set("currentQuestionPart2",undefined);
    Session.set("originalQuestion",undefined);
    Session.set("originalQuestion2",undefined);
    Session.set("clozeQuestionParts",undefined);
    Session.set("currentUnitNumber", 0);
    Session.set("currentUnitStartTime", Date.now());
    Session.set("currentScore", 0);
    Session.set("enableAudioPromptAndFeedback",false);
    Session.set("errorReportStart",undefined);
    Session.set("mainCardTimeoutStart",undefined);
    Session.set("pausedLocks",0);
    Session.set("audioPromptMode",undefined);
    Session.set("experimentPasswordRequired",false);
    Session.set("filter","@gmail.com");
    Session.set("ignoreOutOfGrammarResponses",false);
    Session.set("lastTimestamp", 0);
    Session.set("needResume", false);
    Session.set("questionIndex", undefined);
    Session.set("recording",false);
    Session.set("sampleRate", undefined);
    Session.set("showOverlearningText", undefined);
    Session.set("speechOutOfGrammarFeedback",undefined);
    Session.set("statsAnswerDetails", undefined);
    Session.set("statsRendered", false);
    Session.set("statsCorrect", undefined);
    Session.set("statsTotal", undefined);
    Session.set("statsPercentage", undefined);
    Session.set("statsUserTimeLogView", undefined);
    Session.get("subTdfIndex",undefined);
    Session.set("testType", undefined);
    Session.set("VADInitialized",false);
    Session.set("studentReportingTdfs",[]);
    Session.set("curStudentPerformance",{});

    //Special: we reset card probs and user progress when we reset the session
    if (Meteor.isClient) {
        initUserProgress();
    }
};
