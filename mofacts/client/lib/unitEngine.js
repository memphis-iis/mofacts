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
 *
 * A note about the session variable "ignoreClusterMapping"
 * --------------------------------------------------------
 * Cluster mapping is created and maintained by resume logic in card.js. It is
 * honored by the utility functions in currentTestingHelpers.js. The mapping is
 * based on the top-level shuffle/swap-type cluster mapping. Generally this mapping
 * should be remembered per-user per-experiment after creation and honored. However,
 * some units (currently just model-based units) actually want this functionality
 * ignored (although the unit itself can select certain clusters). As a result,
 * you'll see that our default model sets ignoreClusterMapping to False before
 * calling the engine's initImpl method. If you need to turn off ignoreClusterMapping,
 * you MUST do it in the engine's initImpl method (as we do in modelUnitEngine).
 * We will also set it explicitly on one-time startup.
*/

// First-time init of ignoreClusterMapping (see above)
Session.set("ignoreClusterMapping", false);

// Our "public" functions

function create(func) {
    var engine = _.extend(defaultUnitEngine(), func());
    engine.init();
    return engine;
}

createEmptyUnit = function() {
    return create(emptyUnitEngine);
};

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
        selectNextCard: function() { throw "Missing Implementation"; },
        cardSelected: function(selectVal) { throw "Missing Implementation"; },
        findCurrentCardInfo: function() { throw "Missing Implementation"; },
        createQuestionLogEntry: function() { throw "Missing Implementation"; },
        cardAnswered: function(wasCorrect) { throw "Missing Implementation"; },
        unitFinished: function() { throw "Missing Implementation"; },

        // Optional functions that engines can replace if they want
        initImpl: function() { },

        // Functions we supply
        init: function() {
            console.log("Engine created for unit:", this.unitType);
            Session.set("ignoreClusterMapping", false);
            this.initImpl();
            console.log("CLUSTER MAPPING USE (not ignore):", !Session.get("ignoreClusterMapping"));
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
// Return an instance of a unit with NO question/answer's (instruction-only)
function emptyUnitEngine() {
    return {
        unitType: "instruction-only",

        unitFinished: function() { return true; },

        selectNextCard: function() { },
        findCurrentCardInfo: function() { },
        cardSelected: function(selectVal) { },
        createQuestionLogEntry: function() { },
        cardAnswered: function(wasCorrect) { }
    };
}

//////////////////////////////////////////////////////////////////////////////
// Return an instance of the model-based unit engine
function modelUnitEngine() {
    //Checked against practice seconds. Notice that we capture this on unit
    //creation, so if they leave in the middle of practice and come back to
    //the unit we'll start all over.
    var unitStartTimestamp = Date.now();

    var currentCardInfo = {
        testType: 'd',
        clusterIndex: -1,
        condition: '',
        whichStim : -1,
        forceButtonTrial: false
    };
    function setCurrentCardInfo(clusterIndex, whichStim) {
        currentCardInfo.clusterIndex = clusterIndex;
        currentCardInfo.whichStim = whichStim;
        console.log("MODEL UNIT card selection => ",
            "cluster-idx:", clusterIndex,
            "whichStim:", 0,
            "parameter", getStimParameter(clusterIndex, whichStim)
        );
    }

    //Initialize cards as we'll need them for the created engine (for current model)
    function initializeActRModel() {
        var i;

        var numQuestions = getStimClusterCount();
        var initCards = [];
        for (i = 0; i < numQuestions; ++i) {
            initCards.push({
                questionSuccessCount: 0,
                questionFailureCount: 0,
                trialsSinceLastSeen: 0,
                probability: 0.0,
                hasBeenIntroduced: false,
                canUse: false
            });
        }

        //Figure out which cluster numbers that they want
        var unitClusterList = _.chain(getCurrentTdfUnit())
            .prop("learningsession").first()
            .prop("clusterlist").trim().value();

        var clusterList = [];
        Helpers.extractDelimFields(unitClusterList, clusterList);
        for (i = 0; i < clusterList.length; ++i) {
            var nums = Helpers.rangeVal(clusterList[i]);
            for (var j = 0; j < nums.length; ++j) {
                initCards[_.intval(nums[j])].canUse = true;
            }
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

        // Remember, a card is a cluster
        _.each(cards, function(card) {
            //Correct and incorrect responses for the cluster
            var questionSuccessCount = card.questionSuccessCount;
            var questionFailureCount = card.questionFailureCount;
            var totalQuestionTests = questionSuccessCount + questionFailureCount;

            //Correct and incorrect responses for the version of the clusters
            //Does not include study

            //Correct and incorrect responses for the learner with this tdf
            //Does not include study

            //Correct and incorrect responses for response (accounts for transfer betwen versions and clusters sharing responses)
            //This is exact match on correct (pre-tilde) section
            //Does not include study

            //Study trials for the cluster
            //Make sure that study trials do NOT increment correct/incorrect counts above

            //Time in seconds since cluster (not version) was last seen (true time)
            //Includes study, drill, and test

            //Time in seconds since cluster (not version) first seen (true time)
            //Includes study, drill, and test

            //(Note that diff of above 2 divided by trial count is = to spacing)

            //Time in seconds since cluster (not version) first seen (summed time in practice)
            //Includes study, drill, and test

            var trialsSinceLastSeen = card.trialsSinceLastSeen;

            var trialsSinceLastSeenOverTotalTrials = 0.0;
            if (totalTrials !== 0) {
                trialsSinceLastSeenOverTotalTrials = trialsSinceLastSeen / totalTrials;
            }

            var x = -3.0 +
                    (2.4 * questionSuccessCount) +
                    (0.8 * questionFailureCount) +
                    (1.0 * totalQuestionTests) +
                   -(0.3 * trialsSinceLastSeenOverTotalTrials);

            card.probability = 1.0 / (1.0 + Math.exp(-x));
        });
    }

    //Return index of card that hasn't been introduced (or -1 if we can't find
    //it). Note that we find in reverse order to mimic a bug in the original
    //code in case it was an intended side-effect
    function findNewCard(cards) {
        var idx = -1;

        for (var i = cards.length - 1; i >= 0; --i) {
            var card = cards[i];
            if (!card.hasBeenIntroduced && card.canUse) {
                idx = i;
                break;
            }
        }

        return idx;
    }

    //Return index of card with minimum probability that was last seen at least
    //2 trials ago. Default to index 0 in case no cards meet this criterion
    function findMinProbCard(cards) {
        var currentMin = 1;
        var indexToReturn = 0;

        _.each(cards, function(card, index) {
            if (card.canUse && card.hasBeenIntroduced && card.trialsSinceLastSeen > 2) {
                if (card.probability < currentMin) {
                    currentMin = card.probability;
                    indexToReturn = index;
                }
            }
        });

        return indexToReturn;
    }

    //Return index of card with max probability that is under ceiling. If no
    //card is found under ceiling then -1 is returned
    function findMaxProbCard(cards, ceiling) {
        var currentMax = 0;
        var indexToReturn = -1;

        _.each(cards, function(card, index) {
            if (card.canUse && card.hasBeenIntroduced && card.trialsSinceLastSeen > 2) {
                if (card.probability > currentMax && card.probability < ceiling) {
                    currentMax = card.probability;
                    indexToReturn = index;
                }
            }
        });

        return indexToReturn;
    }

    //Return count of cards whose probability under prob
    function countCardsUnderProb(cards, prob) {
        return _.filter(cards, function(card) {
            return card.canUse && card.probability < prob;
        }).length;
    }

    //Our actual implementation
    return {
        unitType: "model",

        initImpl: function() {
            //We don't want cluster mapping for model-based optmization
            Session.set("ignoreClusterMapping", true);
            initializeActRModel();
        },

        selectNextCard: function() {
            var cardProbs = getCardProbs();
            var numItemsPracticed = cardProbs.numQuestionsAnswered;
            var cards = cardProbs.cards;

            var indexForNewCard;
            var showOverlearningText = false;

            if (numItemsPracticed === 0) {
                indexForNewCard = findNewCard(cards);
                if (indexForNewCard === -1) {
                    if (Session.get("debugging")) {
                        console.log("ERROR: All cards have been introduced, but numQuestionsAnswered === 0");
                    }
                    return -1; //TODO: Need some kind of panic for this situation
                }
            }
            else {
                indexForNewCard = findMaxProbCard(cards, 0.85);
                if (indexForNewCard === -1) {
                    var numIntroduced = cardProbs.numQuestionsIntroduced;
                    if (countCardsUnderProb(cards, 0.85) === 0 && numIntroduced === cards.length) {
                        indexForNewCard = findMinProbCard(cards);
                        showOverlearningText = true;
                    }
                    else {
                        indexForNewCard = findNewCard(cards);
                        if (indexForNewCard === -1) {
                            //if we have introduced all of the cards.
                            indexForNewCard = findMinProbCard(cards);
                        }
                    }
                }
            }

            // Found! Update everything and grab a reference to the card
            var card = cards[indexForNewCard];

            // Save the card selection
            // Note that we always take the first stimulus and it's always a drill
            setCurrentClusterIndex(indexForNewCard);
            Session.set("currentQuestion", getStimQuestion(indexForNewCard, 0));
            Session.set("currentAnswer", getStimAnswer(indexForNewCard, 0));
            Session.set("testType", "d");
            Session.set("questionIndex", 1);  //questionIndex doesn't have any meaning for a model
            Session.set("showOverlearningText", showOverlearningText);

            //Save for returning the info later (since we don't have a schedule)
            setCurrentCardInfo(indexForNewCard, 0);

            return indexForNewCard; //Must return index for call to cardSelected
        },

        findCurrentCardInfo: function() {
            return currentCardInfo;
        },

        cardSelected: function(selectVal) {
            var indexForNewCard = _.intval(selectVal);  // See selectNextCard
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
            if (practiceSeconds < 1.0) {
                //Less than a second is an error or a missing values
                console.log("ERROR: no practice time found - will use 30 seconds");
                practiceSeconds = 30.0;
            }

            var unitElapsedTime = (Date.now() - unitStartTimestamp) / 1000.0;
            console.log("Model practice check", unitElapsedTime, ">", practiceSeconds);
            return (unitElapsedTime > practiceSeconds);
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

        initImpl: function() {
            //Nothing currently
        },

        selectNextCard: function() {
            var unit = getCurrentUnitNumber();
            var questionIndex = Session.get("questionIndex");
            var questInfo = getSchedule().q[questionIndex];
            var whichStim = questInfo.whichStim;

            //Set current Q/A info, type of test (drill, test, study), and then
            //increment the session's question index number
            setCurrentClusterIndex(questInfo.clusterIndex);
            Session.set("currentQuestion", getCurrentStimQuestion(whichStim));
            Session.set("currentAnswer", getCurrentStimAnswer(whichStim));
            Session.set("testType", questInfo.testType);
            Session.set("questionIndex", questionIndex + 1);
            Session.set("showOverlearningText", false);  //No overlearning in a schedule

            console.log("SCHEDULE UNIT card selection => ",
                "cluster-idx-unmapped:", questInfo.clusterIndex,
                "whichStim:", whichStim,
                "parameter", getCurrentStimParameter(whichStim)
            );

            return questInfo.clusterIndex;
        },

        findCurrentCardInfo: function() {
            //selectNextCard increments questionIndex after setting all card
            //info, so we need to use -1 for this info
            return getSchedule().q[Session.get("questionIndex") - 1];
        },

        cardSelected: function(selectVal) {
            //Nothing currently
        },

        createQuestionLogEntry: function() {
            var questInfo = this.findCurrentCardInfo();

            try {
                return {
                    'whichStim': questInfo.whichStim
                };
            }
            catch(e) {
                console.log(e);
                throw e;
            }

        },

        cardAnswered: function(wasCorrect) {
            //Nothing currently
        },

        unitFinished: function() {
            var questionIndex = Session.get("questionIndex");
            var unit = getCurrentUnitNumber();
            var schedule = null;
            if (unit < getCurrentTdfFile().tdfs.tutor.unit.length) {
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
