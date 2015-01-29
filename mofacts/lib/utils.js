//TODO: re-factor into mulitple files once editdist is merged with our
//      changes here

//////////////////////////////////////////////////////////////////////////
//User helpers

//Fairly safe function for insuring we have a valid, logged in Meteor user
haveMeteorUser = function() {
    return (!!Meteor.userId() && !!Meteor.user() && !!Meteor.user().username);
};


//////////////////////////////////////////////////////////////////////////
//Global variable helpers

//Card probabilities setup and retrieval - used by ACT-R model
//Note that this is only used on the client, but we want to make sure that
//setting the cardProbabilities data structure is always available (and
//thus is in the lib folder)

if (Meteor.isClient) {
    //Initialize card probabilities, with optional initial data
    initCardProbs = function(overrideData) {
        var initVals = {
            numQuestionsAnswered: 0,
            numQuestionsIntroduced: 0,
            cards: []
        };

        if (!!overrideData) {
            initVals = _.extend(initVals, overrideData);
        }

        cardProbabilities = initVals;
    };

    //Provide access to card probabilities. Note that this function provides
    //an always-created object with lazy init.
    getCardProbs = function() {
        if (!cardProbabilities) {
            initCardProbs();
        }
        return cardProbabilities;
    };

    //Initialize user progress storage, with optional initial data
    initUserProgress = function(overrideData) {
        var initVals = {
            currentStimuliTest: "NONE",
            currentTestMode: "NONE",
            progressDataArray: []
        };

        if (!!overrideData) {
            initVals = _.extend(initVals, overrideData);
        }

        userProgress = initVals;
    };

    //Provide access to user progress. Note that this function provides
    //an always-created object with lazy init.
    getUserProgress = function() {
        if (!userProgress) {
            initUserProgress();
        }
        return userProgress;
    };
}

//////////////////////////////////////////////////////////////////////////
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


//Handle an entire session - note that we current don't limit this to the
//client... but maybe we should?
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

    //Special: we reset card probs and user progress when we reset the session
    if (Meteor.isClient) {
        initCardProbs();
        initUserProgress();
    }
};
