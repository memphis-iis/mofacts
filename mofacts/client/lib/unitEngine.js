/* unitEngine.js
 * Unit engines handle question/answer selection for a particular unit. This
 * abstraction let's us treat scheduled-based and module-based units the same
 * in card.js
 *
 * A unit engine is "created" by returning an object from a function - note
 * that this is slightly different from JavaScript prototype object creation,
 * so these engines aren't created with the "new" keyword.
 *
 * Also note that the engines may assume that they are added on to the object
 * from defaultUnitEngine via _.extend
*/

// Our "public" functions

function create(func) {
    var engine = _.extend(defaultUnitEngine(), func());
    engine.init();
    return engine();
}

createModelUnit = function() {
    return create(modelUnitEngine);
};

createScheduleUnit = function() {
    return create(scheduleUnitEngine);
};

// Return an instance of the "base" engine
function defaultUnitEngine() {
    return {
        // Things actual engines must supply
        unitType: "DEFAULT",
        cardSelected: function(cardIndex) { throw "Missing Implementation"; },
        createQuestionLogEntry: function() { throw "Missing Implementation"; },
        cardAnswered: function(wasCorrect) { throw "Missing Implementation"; },
        unitFinished: function() { throw "Missing Implementation"; },

        // Optional functions that engines can replace if they want
        initImpl: function() { },

        // Functions we supply
        init: function() {
            console.log("Engine created for unit:", this.unitType);
            initImpl();
        },

        writeQuestionEntry: function() {
            recordUserTimeQuestion(
                _.extend(
                    { selType: this.unitType },
                    this.createQuestionLogEntry()
                )
            );
        }
    };
}

//////////////////////////////////////////////////////////////////////////////
// Return an instance of the model-based unit engine
function modelUnitEngine() {
    var unitStartTimestamp = Date.now();

    //Initialize cards as we'll need them for the created engine (for current model)
    function initializeActRModel() {
        var numQuestions = getStimClusterCount();

        var initCards = [];
        for (var i = 0; i < numQuestions; ++i) {
            initCards.push({
                questionSuccessCount: 0,
                questionFailureCount: 0,
                trialsSinceLastSeen: 0,
                probability: 0.0,
                hasBeenIntroduced: false
            });
        }

        //Re-init the card probabilities
        initCardProbs({ cards: initCards });

        //has to be done once ahead of time to give valid values for the beginning of the test.
        calculateCardProbabilities();
    }

    //Calculate current card probabilities
    function calculateCardProbabilities() {
        var cardProbs = getCardProbs();
        var totalTrials = cardProbs.numQuestionsAnswered;
        var cards = cardProbs.cards;

        _.each(cards, function(card) {
            var questionSuccessCount = card.questionSuccessCount;
            var questionFailureCount = card.questionFailureCount;
            var totalQuestionStudies = questionSuccessCount + questionFailureCount;
            var trialsSinceLastSeen = card.trialsSinceLastSeen;

            var trialsSinceLastSeenOverTotalTrials = 0.0;
            if (totalTrials !== 0) {
                trialsSinceLastSeenOverTotalTrials = trialsSinceLastSeen / totalTrials;
            }

            var x = -3.0 +
                     (2.4 * questionSuccessCount) +
                     (0.8 * questionFailureCount) +
                     (1.0 * totalQuestionStudies) +
                    -(0.3 * trialsSinceLastSeenOverTotalTrials);

            var probability = 1.0 / (1.0 + Math.exp(-x));

            card.probability = probability;
        });
    }

    return {
        unitType: "model",

        initImpl: function() {
            initializeActRModel();
        },

        cardSelected: function(cardIndex) {
            var cardProbs = getCardProbs();
            cardProbs.numQuestionsIntroduced += 1;

            var cards = cardProbs.cards;
            //It has now been officially one more trial since all the other cards
            //have been seen
            _.each(cards, function(card, index) {
                if (index != indexForNewCard) {
                    card.trialsSinceLastSeen += 1;
                }
            });

            //Now card has been introduced/seen
            var card = cards[indexForNewCard];
            card.trialsSinceLastSeen = 0;
            card.hasBeenIntroduced = true;
        },

        createQuestionLogEntry: function() {
            var idx = getStimCluster(getCurrentClusterIndex()).clusterIndex;
            var card = getCardProbs().cards[idx];
            return {
                cardModelData: _.omit(card, ["question", "answer"]),
            };
        },

        cardAnswered: function(wasCorrect) {
            var cardProbs = getCardProbs();
            cardProbs.numQuestionsAnswered += 1;

            var card = null;
            try {
                var idx = getStimCluster(getCurrentClusterIndex()).clusterIndex;
                card = cardProbs.cards[idx];
            }
            catch(err) {
                console.log("Error getting card for update", err);
            }

            if (card) {
                if (wasCorrect) card.questionSuccessCount += 1;
                else            card.questionFailureCount += 1;
            }

            calculateCardProbabilities();
        },

        unitFinished: function() {
            var practiceSeconds = getCurrentDeliveryParams().practiceseconds;
            if (practiceTime < 1.0) {
                //Less than a second is an error or a missing values
                console.log("ERROR: no practice time found - will use 30 seconds");
                practiceTime = 30.0;
            }

            var unitElapsedTime = (Date.now() - unitStartTimestamp) / 1000.0;
            return (unitElapsedTime > practiceTime);
        }
    };
}

//////////////////////////////////////////////////////////////////////////////
// Return an instance of the schedule-based unit engine

function scheduleUnitEngine() {
    //Return the schedule for the current unit of the current lesson -
    //If it doesn't exist, then create and store it in User Progress
    function getSchedule() {
        //Retrieve current schedule
        var progress = getUserProgress();

        var unit = getCurrentUnitNumber();
        var schedule = null;
        if (progress.currentSchedule && progress.currentSchedule.unitNumber == unit) {
            schedule = progress.currentSchedule;
        }

        //Lazy create save if we don't have a correct schedule
        if (schedule === null) {
            console.log("CREATING SCHEDULE, showing progress");
            console.log(progress);

            var file = getCurrentTdfFile();
            var setSpec = file.tdfs.tutor.setspec[0];
            var currUnit = file.tdfs.tutor.unit[unit];

            schedule = AssessmentSession.createSchedule(setSpec, unit, currUnit);
            if (!schedule) {
                //There was an error creating the schedule - there's really nothing
                //left to do since the experiment is broken
                recordUserTime("FAILURE to create schedule", {
                    unitname: Helpers.display(currUnit.unitname),
                    unitindex: unit
                });
                alert("There is an issue with the TDF - experiment cannot continue");
                //TODO: these should be part of a "panic" function that is passed to our creator
                //clearCardTimeout();
                //leavePage("/profile");
                return;
            }

            //We save the current schedule and also log it to the UserTime collection
            progress.currentSchedule = schedule;

            recordUserTime("schedule", {
                unitname: Helpers.display(currUnit.unitname),
                unitindex: unit,
                schedule: schedule
            });
        }

        //Now they can have the schedule
        return schedule;
    }

    return {
        unitType: "schedule",

        cardSelected: function(cardIndex) {
            //TODO: update any stats we want to track for schedules on selected question cards
        },

        createQuestionLogEntry: function() {
            var unit = getCurrentUnitNumber();
            var questionIndex = Session.get("questionIndex");
            var questInfo = getSchedule().q[questionIndex];
            var whichStim = questInfo.whichStim;

            return {
                whichStim: whichStim
            };
        },

        cardAnswered: function(wasCorrect) {
            //Nothing currently
        },

        unitFinished: function() {
            var questionIndex = Session.get("questionIndex");
            var unit = getCurrentUnitNumber();
            var schedule = null;
            if (unit < file.tdfs.tutor.unit.length) {
                schedule = getSchedule();
            }

            if (schedule && questionIndex < schedule.q.length) {
                return false; // have more
            }
            else {
                return true; // nothing left
            }
        }
    };
}
