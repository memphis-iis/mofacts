//////////////////////////////////////////////////////////////////////////
// Global variable helpers
//
// Note that we put in this in the lib directory to insure it is loaded
// before code in other dirs, but currently we only defined these functions
// on the client

//Poly-fills for missing functionality
if (!Date.now) {
    Date.now = function now() {
        return new Date().getTime();
    };
}

//Helper function for underscore that accesses a property by name but
//returns null either the object is "falsey" or the property is missing
// Given o = {a: {z: [1,2,3]}} then
// _.chain(o).prop('a').prop('z').value == [1,2,3]
// _.chain(o).prop('a').prop('z').first().intval().value == 1
// _.chain(o).prop('a').prop('z').first().floatval().value == 1.0
// _.chain(o).prop('a').prop('z').first().prop('nope') == null
// _.chain(o).prop('bad start').prop('z') == null
if (_ && _.mixin) {
    _.mixin({
        prop: function(obj, propname) {
            if ((!obj && obj !== "") || !propname || !_.has(obj, propname)) {
                return null;
            }
            else {
                return obj[propname];
            }
        },

        intval: function(src) {
            if (!src && src !== false) {
                src = "";
            }
            else {
                src = ("" + src).replace(/^\s+|\s+$/gm, '');
            }

            var val = parseInt(src);
            return isNaN(val) ? 0 : val;
        },

        floatval: function(src) {
            if (!src && src !== false) {
                src = "";
            }
            else {
                src = ("" + src).replace(/^\s+|\s+$/gm, '');
            }

            var val = parseFloat(src);
            return isFinite(val) ? val : 0.0;
        }
    });
}

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
            currentTestMode: "NONE",
            currentScore: 0,
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
