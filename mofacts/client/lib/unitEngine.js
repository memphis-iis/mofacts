/* unitEngine.js
*******************************************************************************
Unit engines handle question/answer selection for a particular unit. This
abstraction let's us treat scheduled-based and module-based units the same in
card.js

A unit engine is "created" by returning an object from a function - note that
this is slightly different from JavaScript prototype object creation, so these
engines aren't created with the "new" keyword.

Also note that the engines may assume that they are added on to the object
from defaultUnitEngine via _.extend

The engine "API"
--------------------------

We provide creation functions for each of the "unit engines" defined here. A
unit engine extends the result of the defaultUnitEngine function call (via the
_.extend function). A unit engine is required to implement:

* field unitType - it should be a string identifying what kind of unit is
supported (note that this will be logged in the UserTimesLog)

* function selectNextCard - when called the engine will select the next card
for display _and_ set the appropriate Session variables. The function should
also return the cluster index identifying the card just selected.

* function cardSelected (accepts selectVal and resumeData) - this function is
called when a card is selected. It will also be called on resume. During "real
time" use the function is called with the return value of selectNextCard (see
above). During resume, seledctVal is set to the the cluster index in the user
log. resumeData is set if and only if resume is happening. It will be the user
log entry - note that this entry should be what was previously returned by
createQuestionLogEntry (see below) plus any additional fields added during the
server-side write.

* function findCurrentCardInfo - when called, then engine should return an
object with the currently selected card's information. See the model unit for
an explicit definition of these fields. Note that the schedule unit just
return an item from the current schedule's q array.

* function createQuestionLogEntry - when called, the engined should return an
object with all fields that should be written to the user log. This is used by
writeQuestionEntry (see below). Also note that this object is what will be in
the resumeData parameter in a call to cardSelected during resume logic (see
above).

* function cardAnswered (accepts wasCorrect and resumeData) - called after the
user provides a response. wasCorrect is a boolean value specifying whether the
user correctly answered or not. resumeData is specified if and only if resume
mode is active (just like cardSelected - see above). Note that this function
_IS_ called for study trials (even though no answer is given) - see the model
unit engine for an example if why this matters.

* function unitFinished - the unit engine should return true if the unit is
completed (nothing more to display)

* function initImpl - OPTIONAL! An engine may implement this function if it
needs special startup logic to be called before it is used.

* function writeQuestionEntry - Should _NOT_ be implemented by the engine.
This function is supplied by the default (base) engine


A note about the session variable "ignoreClusterMapping"
--------------------------------------------------------

Cluster mapping is created and maintained by resume logic in card.js. It is
honored by the utility functions in currentTestingHelpers.js. The mapping is
based on the top-level shuffle/swap-type cluster mapping. Generally this
mapping should be remembered per-user per-experiment after creation and
honored. However, some units (currently just model-based units) actually want
this functionality ignored (although the unit itself can select certain
clusters). As a result, you'll see that our default model sets
ignoreClusterMapping to False before calling the engine's initImpl method. If
you need to turn off ignoreClusterMapping, you MUST do it in the engine's
initImpl method (as we do in modelUnitEngine). We will also set it explicitly
on one-time startup.

******************************************************************************/

// First-time init of ignoreClusterMapping (see above)
Session.set("ignoreClusterMapping", false);

//Helper for our "public" functions
function create(func) {
    var engine = _.extend(defaultUnitEngine(), func());
    engine.init();
    return engine;
}

// Our "public" functions

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
        cardSelected: function(selectVal, resumeData) { throw "Missing Implementation"; },
        createQuestionLogEntry: function() { throw "Missing Implementation"; },
        cardAnswered: function(wasCorrect, resumeData) { throw "Missing Implementation"; },
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
        cardSelected: function(selectVal, resumeData) { },
        createQuestionLogEntry: function() { },
        cardAnswered: function(wasCorrect, resumeData) { }
    };
}

//////////////////////////////////////////////////////////////////////////////
// Return an instance of the model-based unit engine

/* Stats information: we track the following stats in the card info structure.
   (All properties are relative to the object returned by getCardProbs())

- Total stimuli shown to user: numQuestionsIntroduced
- Total responses given by user: numQuestionsAnswered
- Total correct NON-STUDY responses given by user: numCorrectAnswers
- Cluster correct answer count - card.questionSuccessCount
- Cluster incorrect answer count - card.questionFailureCount
- Last time cluster was shown (in milliseconds since the epoch) - card.lastShownTimestamp
- First time cluster was shown (in milliseconds since the epoch) - card.firstShownTimestamp
- Trials since cluster seen - card.trialsSinceLastSeen
- If user has seen cluster - card.hasBeenIntroduced
- Correct answer count for stim (cluster version) - card.stims.stimSuccessCount
- Incorrect answer count for stim (cluster version) - card.stims.stimFailureCount
- Correct answer count for answer (correct response) text - responses.responseSuccessCount
- Incorrect answer count for answer (correct response) text - responses.responseFailureCount
- Count of times study trials shown per cluster - card.studyTrialCount
- Practice times for the trials per cluster - this ia an ordered list of times,
  each the number of milliseconds in practice - card.practiceTimes
*/


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

    // Initialize cards as we'll need them for the created engine (for current
    // model). Note that we assume TDF/Stimulus is set up and correct - AND
    // that we've already turned off cluster mapping
    function initializeActRModel() {
        var i, j;

        var numQuestions = getStimClusterCount();
        var initCards = [];
        var initResponses = {};
        for (i = 0; i < numQuestions; ++i) {
            var card = {
                questionSuccessCount: 0,
                questionFailureCount: 0,
                studyTrialCount: 0,
                trialsSinceLastSeen: 0,
                lastShownTimestamp: 0,
                firstShownTimestamp: 0,
                probability: 0.0,
                hasBeenIntroduced: false,
                canUse: false,
                stims: [],
                practiceTimes: [],
            };

            // We keep per-stim and re-response-text results as well
            var cluster = getStimCluster(i);
            var numStims = _.chain(cluster).prop("display").prop("length").intval().value();
            for (j = 0; j < numStims; ++j) {
                // Per-stim counts
                card.stims.push({
                    stimSuccessCount: 0,
                    stimFailureCount: 0,
                });

                // Per-response counts
                var response = Answers.getDisplayAnswerText(cluster.response[j]);
                if (!(response in initResponses)) {
                    initResponses[response] = {
                        responseSuccessCount: 0,
                        responseFailureCount: 0,
                    };
                }
            }

            initCards.push(card);
        }

        //Figure out which cluster numbers that they want
        var unitClusterList = _.chain(getCurrentTdfUnit())
            .prop("learningsession").first()
            .prop("clusterlist").trim().value();

        var clusterList = [];
        Helpers.extractDelimFields(unitClusterList, clusterList);
        for (i = 0; i < clusterList.length; ++i) {
            var nums = Helpers.rangeVal(clusterList[i]);
            for (j = 0; j < nums.length; ++j) {
                initCards[_.intval(nums[j])].canUse = true;
            }
        }

        //Re-init the card probabilities
        initCardProbs({ cards: initCards, responses: initResponses });

        //has to be done once ahead of time to give valid values for the beginning of the test.
        calculateCardProbabilities();
    }

    // Calculate current card probabilities for every card - see selectNextCard
    // the actual card/stim (cluster/version) selection
    function calculateCardProbabilities() {
        // Get objects we need
        var cardProbs = getCardProbs();
        var totalTrials = cardProbs.numQuestionsAnswered;
        var cards = cardProbs.cards;

        // A few helpers
        var secs = function(t) { return t / 1000.0; };
        var elapsed = function(t) { return t < 1 ? 0 : secs(Date.now() - t); };
        var log = Math.log;

        // Top-level metrics
        var userTotalTrials = cardProbs.numQuestionsIntroduced;
        var userTotalResponses = cardProbs.numQuestionsAnswered;
        var userCorrectResponses = cardProbs.numCorrectAnswers;
        var totalPracticeSecs = secs(
            _.chain(cards).pluck('practiceTimes').flatten().sum().value()
        );

        // Remember, a card is a cluster and a "stim" is a version of the cluster
        _.each(cards, function(card, cardIndex) {
            // NOTE: card.canUse is true if and only if it is in the clusterlist
            // for the current unit. You could just return here if these clusters
            // should be ignored (or do nothing if they should be included below)

            // Current available metrics
            var questionSuccessCount = card.questionSuccessCount;
            var questionFailureCount = card.questionFailureCount;
            var questionTotalTests = questionSuccessCount + questionFailureCount;
            var questionTrialsSinceLastSeen = card.trialsSinceLastSeen;
            var questionStudyTrialCount = card.studyTrialCount;
            var questionSecsSinceLastShown = elapsed(card.lastShownTimestamp);
            var questionSecsSinceFirstShown = elapsed(card.firstShownTimestamp);
            var questionHasBeenIntroduced = card.hasBeenIntroduced;
            var questionSecsInPractice = secs(_.sum(card.practiceTimes));
            // Total time in practie for all other cards
            var questionSecsPracticingOthers = totalPracticeSecs - questionSecsInPractice;

            // Optimization: use an "old" style loop so that we don't define
            // functions (closures) inside the card loop
            for (var i = 0; i < card.stims.length; ++i) {
                var stim = card.stims[i];
                var stimSuccessCount = card.stims[i].stimSuccessCount;
                var stimFailureCount = card.stims[i].stimFailureCount;
                var stimResponseText = Answers.getDisplayAnswerText(getStimAnswer(cardIndex, i));
                var resp = cardProbs.responses[stimResponseText];
                var responseSuccessCount = resp.responseSuccessCount;
                var responseFailureCount = resp.responseFailureCount;
                var stimParameter = getStimParameter(cardIndex, i);

                // NOTE: Anything we would do/change/store per stim (cluster
                // version) would go here

                // TODO: questionSecsInPractice should be the new time variable from email
                // TODO: y should be on stims (not cards - they don't have one)
                // TODO: card selection should be stim selection
                var baseLevel = 1 / ((1 + questionSecsInPractice + (questionSecsSinceFirstShown - questionSecsInPractice) * 0.0630) ^ 0.339);

                var meanSpacing = 0;
                if (questionStudyTrialCount + questionTotalTests !== 0) {
                    meanSpacing = log(
                        1 + (100 + questionSecsSinceLastShown - questionSecsSinceFirstShown) / (questionStudyTrialCount + questionTotalTests)
                    );
                }
                var intbs = meanSpacing * baseLevel;

                //Calculate and store probability for card (cluster)
                var y = stimParameter+
                0.866310634*((0.5 + stimSuccessCount)/(1 + stimSuccessCount+stimFailureCount) - 0.5)+
                0.270707611*((0.5 + questionSuccessCount)/(1 + questionSuccessCount + questionFailureCount) - 0.5)+
                0.869477261*((0.5 + responseSuccessCount)/(1 + responseSuccessCount + responseFailureCount) - 0.5)+
                3.642734384*((0.5 + userCorrectResponses)/(1 + userTotalResponses) - 0.5)+
                3.714113953*(1/((1 + questionSecsSinceLastShown)^0.339))+
                2.244795778*intbs*log(1+stimSuccessCount+stimFailureCount) +
                0.447943182*intbs*log(1+questionStudyTrialCount) +
                0.500901271*intbs*log(1+responseSuccessCount+responseFailureCount);
                card.probability = 1.0 / (1.0 + Math.exp(-y));
            }
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
            // The cluster (card) index, the cluster version (stim index), and
            // whether or not we should show the overlearning text is determined
            // here. See calculateCardProbabilities for how card.probability is
            // calculated
            var indexForNewCard;
            var whichStim = 0; // Currently no version selection in the model
            var showOverlearningText = false;

            var cardProbs = getCardProbs();
            var numItemsPracticed = cardProbs.numQuestionsAnswered;
            var cards = cardProbs.cards;

            if (numItemsPracticed === 0) {
                indexForNewCard = findNewCard(cards);
                if (indexForNewCard === -1) {
                    if (Session.get("debugging")) {
                        console.log("ERROR: All cards have been introduced, but numQuestionsAnswered === 0");
                    }
                    throw new Error("All cards have been introduced, but numQuestionsAnswered === 0");
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
            Session.set("currentQuestion", getStimQuestion(indexForNewCard, whichStim));
            Session.set("currentAnswer", getStimAnswer(indexForNewCard, whichStim));
            Session.set("testType", "d");
            Session.set("questionIndex", 1);  //questionIndex doesn't have any meaning for a model
            Session.set("showOverlearningText", showOverlearningText);

            // About to show a card - record any times necessary
            card.lastShownTimestamp = Date.now();
            if (card.firstShownTimestamp < 1 && card.lastShownTimestamp > 0) {
                card.firstShownTimestamp = card.lastShownTimestamp;
            }

            //Save for returning the info later (since we don't have a schedule)
            setCurrentCardInfo(indexForNewCard, whichStim);

            // only log this for teachers/admins
            if (Roles.userIsInRole(Meteor.user(), ["admin", "teacher"])) {
                console.log(">>>BEGIN METRICS>>>>>>>");

                console.log("Overall user stats => ",
                    "total trials:", cardProbs.numQuestionsIntroduced,
                    "total responses:", cardProbs.numQuestionsAnswered,
                    "total correct responses:", cardProbs.numCorrectAnswers
                );

                // Log the entire card, which includes most stats
                console.log("Model selected card:", displayify(card));

                // Log time stats in human-readable form
                var secs = function(t) { return (t / 1000.0) + ' secs'; };
                var elapsedStr = function(t) { return t < 1 ? 'Never Seen': secs(Date.now() - t); };
                console.log(
                    'Card First Seen:', elapsedStr(card.firstShownTimestamp),
                    'Card Last Seen:', elapsedStr(card.lastShownTimestamp),
                    'Total time in practice:', secs(_.sum(card.practiceTimes)),
                    'Previous Practice Times:', displayify(_.map(card.practiceTimes, secs))
                );

                // Display response and current response stats
                var responseText = Answers.getDisplayAnswerText(getStimCluster(indexForNewCard).response[whichStim]);
                console.log("Response is", responseText, displayify(cardProbs.responses[responseText]));

                console.log("<<<END   METRICS<<<<<<<");
            }

            return indexForNewCard; //Must return index for call to cardSelected
        },

        findCurrentCardInfo: function() {
            return currentCardInfo;
        },

        cardSelected: function(selectVal, resumeData) {
            // Find objects we'll be touching
            var indexForNewCard = _.intval(selectVal);  // See selectNextCard
            var cardProbs = getCardProbs();
            var cards = cardProbs.cards;
            var card = cards[indexForNewCard];

            // Update our top-level stats
            cardProbs.numQuestionsIntroduced += 1;

            // If this is a resume, we've been given originally logged data
            // that we need to grab
            if (!!resumeData) {
                _.extend(card, resumeData.cardModelData);
                _.extend(currentCardInfo, resumeData.currentCardInfo);
                if (currentCardInfo.clusterIndex != indexForNewCard) {
                    console.log("Resume cluster index mismatch", currentCardInfo.clusterIndex, indexForNewCard);
                }
                return;
            }

            // Update stats for the card
            card.trialsSinceLastSeen = 0;
            card.hasBeenIntroduced = true;
            if (getTestType() === 's') {
                card.studyTrialCount += 1;
            }

            // It has now been officially one more trial since all the other cards
            // have been seen
            _.each(cards, function(card, index) {
                if (index != indexForNewCard) {
                    card.trialsSinceLastSeen += 1;
                }
            });
        },

        createQuestionLogEntry: function() {
            var idx = getStimCluster(getCurrentClusterIndex()).clusterIndex;
            var card = getCardProbs().cards[idx];
            return {
                cardModelData: _.omit(card, ["question", "answer"]),
                'currentCardInfo': _.extend({}, currentCardInfo)
            };
        },

        cardAnswered: function(wasCorrect, resumeData) {
            // Get info we need for updates and logic below
            var cardProbs = getCardProbs();
            var cluster = getStimCluster(getCurrentClusterIndex());
            var card = null;
            try {
                card = cardProbs.cards[cluster.clusterIndex];
            }
            catch(err) {
                console.log("Error getting card for update", err);
            }

            // Before our study trial check, capture if this is NOT a resume
            // call (and we captured the time for the last question)
            if (!resumeData && card.lastShownTimestamp > 0) {
                var practice = Date.now() - card.lastShownTimestamp;
                // We assume more than 5 minutes is an artifact of resume logic
                if (practice < 5 * 60 * 1000) {
                    card.practiceTimes.push(practice);
                }
            }

            // Study trials are a special case: we don't update any of the
            // metrics below. As a result, we just calculate probabilities and
            // leave. Note that the calculate call is important because this is
            // the only place we call it after init *and* something might have
            // changed during question selection
            if (getTestType() === 's') {
                calculateCardProbabilities();
                return;
            }

            // "Global" stats
            cardProbs.numQuestionsAnswered += 1;
            if (wasCorrect) {
                cardProbs.numCorrectAnswers += 1;
            }

            // "Card-level" stats (and below - e.g. stim-level stats)
            if (card) {
                if (wasCorrect) card.questionSuccessCount += 1;
                else            card.questionFailureCount += 1;

                var stim = currentCardInfo.whichStim;
                if (stim >= 0 && stim < card.stims.length) {
                    if (wasCorrect) card.stims[stim].stimSuccessCount += 1;
                    else            card.stims[stim].stimFailureCount += 1;
                }
            }

            // "Response" stats
            var answerText = Answers.getDisplayAnswerText(cluster.response[currentCardInfo.whichStim]);
            if (answerText && answerText in cardProbs.responses) {
                if (wasCorrect) cardProbs.responses[answerText].responseSuccessCount += 1;
                else            cardProbs.responses[answerText].responseFailureCount += 1;
            }
            else {
                console.log("COULD NOT STORE RESPONSE METRICS",
                    answerText,
                    currentCardInfo.whichStim,
                    displayify(cluster.response),
                    displayify(cardProbs.responses));
            }

            // All stats gathered - calculate probabilities
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
                throw new Error("There is an issue with the TDF - experiment cannot continue");
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

        cardSelected: function(selectVal, resumeData) {
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

        cardAnswered: function(wasCorrect, resumeData) {
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
