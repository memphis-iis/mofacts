//////////////////////////////////////////////////////////////////////////
// Global variable helpers
//
// Note that we put in this in the lib directory to insure it is loaded
// before code in other dirs, but currently we only defined these functions
// on the client

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
