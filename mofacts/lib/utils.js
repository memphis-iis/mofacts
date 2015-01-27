//User helpers

//Fairly safe function for insuring we have a valid, logged in Meteor user
haveMeteorUser = function() {
    return (!!Meteor.userId() && !!Meteor.user() && !!Meteor.user().username);
};

//Meteor sessions can be strange - this function allows us to pass in a 
//function to mutate a session variable
sessionEdit = function(varName, mutatorFunction) {
    Session.set(varName, mutatorFunction(Session.get(varName)));
};

//Session helpers

/* All of our currently known session variables:
 * cardProbabilities         - For ACT-R model - was once a collection
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
 * statsAnswerDetails        - Used by stats page template
 * statsRendered             - Used by stats page template
 * statsCorrect              - Used by stats page template
 * statsTotal                - Used by stats page template
 * statsPercentage           - Used by stats page template
 * statsUserTimeLogView      - User by stats page template
 * testType
 * usingACTRModel
 * */
 
//Card probabilities setup - used by ACT-R model
sessionCardProbsInit = function(overrideData) {
    var initVals = {
        numQuestionsAnswered: 0,
        numQuestionsIntroduced: 0,
        cards: []
    };
    
    if (!!overrideData) {
        initVals = _.extend(overrideData, initVals);
    }
    
    Session.set("cardProbabilities", initVals);
};
 
//Handle an entire session
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
    Session.set("statsAnswerDetails", undefined);
    Session.set("statsRendered", false);
    Session.set("statsCorrect", undefined);
    Session.set("statsTotal", undefined);
    Session.set("statsPercentage", undefined);
    Session.set("statsUserTimeLogView", undefined);
    Session.set("testType", undefined);
    Session.set("usingACTRModel", undefined);
    
    //Special: we reset card probs to a default good state
    sessionCardProbsInit();
};
