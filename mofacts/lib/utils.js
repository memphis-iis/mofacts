//User helpers

haveMeteorUser = function() {
    return (!!Meteor.userId() && !!Meteor.user() && !!Meteor.user().username);
};


//Session helpers

/* All of our currently known session variables:
 * clusterIndex
 * currentAnswer
 * currentQuestion
 * currentTdfName
 * currentTest
 * currentUnitNumber
 * debugging                 - Generic debugging flag
 * isScheduledTest
 * questionIndex
 * showOverlearningText
 * statsRendered             - Used by stats page template
 * statsCorrect              - Used by stats page template
 * statsTotal                - Used by stats page template
 * statsPercentage           - Used by stats page template
 * testType
 * usingACTRModel
 * */
sessionCleanUp = function() {
    //Note that we assume that currentTest and currentTdfName are
    //already set (because getStimNameFromTdf should have already been
    //called).  We also ignore debugging (for obvious reasons)
    
    Session.set("clusterIndex", undefined);
    Session.set("currentAnswer", undefined);
    Session.set("currentQuestion", undefined);
    Session.set("currentUnitNumber", 0);
    Session.set("isScheduledTest", undefined);
    Session.set("questionIndex", undefined);
    Session.set("showOverlearningText", undefined);
    Session.set("statsRendered", false);
    Session.set("statsCorrect", undefined);
    Session.set("statsTotal", undefined);
    Session.set("statsPercentage", undefined);
    Session.set("testType", undefined);
    Session.set("usingACTRModel", undefined);
};
