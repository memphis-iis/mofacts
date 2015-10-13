//////////////////////////////////////////////////////////////////////////
// Session helpers

/* *****************************************************************
 * All of our currently known session variables
 * *****************************************************************
 * clusterIndex
 * clusterMapping            - For an entire experiment
 * currentAnswer
 * currentQuestion
 * currentRootTdfName
 * currentTdfName
 * currentScore
 * currentStimName
 * currentUnitNumber
 * debugging                 - Generic debugging flag
 * experimentTarget          - untouched in sessionCleanUp
 * experimentXCond           - untouched in sessionCleanUp
 * isScheduledTest
 * lastTimestamp             - set only by resume logic in card
 * loginMode                 - untouched in sessionCleanUp
 * needResume
 * questionIndex
 * showOverlearningText
 * statsAnswerDetails        - Used by stats page template
 * statsCorrect              - Used by stats page template
 * statsPercentage           - Used by stats page template
 * statsRendered             - Used by stats page template
 * statsTotal                - Used by stats page template
 * statsUserTimeLogView      - User by stats page template
 * testType
 * usingACTRModel
 * */

//Handle an entire session - note that we current don't limit this to the
//client... but maybe we should?
sessionCleanUp = function() {
    Session.set("buttonTrial", false);
    Session.set("currentRootTdfName", undefined);
    Session.set("currentTdfName", undefined);
    Session.set("currentStimName", undefined);
    Session.set("clusterIndex", undefined);
    Session.set("currentAnswer", undefined);
    Session.set("currentQuestion", undefined);
    Session.set("currentUnitNumber", 0);
    Session.set("currentScore", 0);
    Session.set("isScheduledTest", undefined);
    Session.set("lastTimestamp", 0);
    Session.set("needResume", false);
    Session.set("questionIndex", undefined);
    Session.set("showOverlearningText", undefined);
    Session.set("statsAnswerDetails", undefined);
    Session.set("statsRendered", false);
    Session.set("statsCorrect", undefined);
    Session.set("statsTotal", undefined);
    Session.set("statsPercentage", undefined);
    Session.set("statsUserTimeLogView", undefined);
    Session.set("turkApprovalSent", undefined);
    Session.set("turkBonusSent", undefined);
    Session.set("testType", undefined);
    Session.set("usingACTRModel", undefined);

    //Special: we reset card probs and user progress when we reset the session
    if (Meteor.isClient) {
        initCardProbs();
        initUserProgress();
    }
};
