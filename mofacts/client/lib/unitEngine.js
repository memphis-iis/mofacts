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
This function is supplied by the default (base) engine and takes selectVal,
which should be the value returnen by selectNextCard

--------------------------------------------------------

Cluster mapping is created and maintained by resume logic in card.js. It is
honored by the utility functions in currentTestingHelpers.js. The mapping is
based on the top-level shuffle/swap-type cluster mapping. Generally this
mapping should be remembered per-user per-experiment after creation and
honored across all session types.

******************************************************************************/

//Helper for our "public" functions
function create(func,extensionData) {
    var engine = _.extend(defaultUnitEngine(extensionData), func());
    engine.init();
    return engine;
}

// Our "public" functions

getRandomInt = function(max){
    return Math.floor(Math.random() * max);
}

stripSpacesAndLowerCase = function(input){
  return input.replace(/ /g,'').toLowerCase();
}

createEmptyUnit = function(extensionData) {
    return create(emptyUnitEngine,extensionData);
};

createModelUnit = function(extensionData) {
    return create(modelUnitEngine,extensionData);
};

createScheduleUnit = function(extensionData) {
    return create(scheduleUnitEngine,extensionData);
};

// Return an instance of the "base" engine
function defaultUnitEngine(extensionData) {
    let engine = {
        // Things actual engines must supply
        unitType: "DEFAULT",
        selectNextCard: function() { throw "Missing Implementation"; },
        cardSelected: function(selectVal, resumeData) { throw "Missing Implementation"; },
        createQuestionLogEntry: function() { throw "Missing Implementation"; },
        cardAnswered: function(wasCorrect, resumeData) { throw "Missing Implementation"; },
        unitFinished: function() { throw "Missing Implementation"; },

        // Optional functions that engines can replace if they want
        initImpl: function() { },
        reinitializeClusterListsFromCurrentSessionData: function() { },

        // Functions we supply
        init: function() {
            console.log("Engine created for unit:", this.unitType);
            this.initImpl();
        },

        writeQuestionEntry: function(selectVal) {
            recordUserTimeQuestion(
                _.extend(
                    { selType: this.unitType, 'selectVal': selectVal },
                    this.createQuestionLogEntry()
                )
            );
        }
    };
    console.log("extension data: " + JSON.stringify(extensionData));
    return _.extend(engine,extensionData);
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
- If user has seen specific stimulus in a cluster - card.stims.hasBeenIntroduced
- Correct answer count for answer (correct response) text - responses.responseSuccessCount
- Incorrect answer count for answer (correct response) text - responses.responseFailureCount
- Count of times study trials shown per cluster - card.studyTrialCount
- Practice times for the trials per cluster - this ia an ordered list of times,
  each the number of milliseconds in practice - card.practiceTimes
- Total time (in seconds) that other cards have been practiced since a card's
  FIRST practice - card.otherPracticeTimeSinceFirst
- Total time (in seconds) that other cards have been practiced since a card's
  LAST practice - card.otherPracticeTimeSinceLast
*/


function modelUnitEngine() {
    console.log('model unit engine created!!!');
    //Checked against practice seconds. Notice that we capture this on unit
    //creation, so if they leave in the middle of practice and come back to
    //the unit we'll start all over.
    var unitStartTimestamp = Date.now();

    //We cache the stimuli found since it shouldn't change during the unit
    var cachedStimuli = null;
    fastGetStimCluster =function(index) {
        if (!cachedStimuli) {
            cachedStimuli = Stimuli.findOne({fileName: getCurrentStimName()});
        }
        return getStimCluster(index, cachedStimuli);
    }

    function getStimParameterArray(clusterIndex,whichParameter){
      return _.chain(fastGetStimCluster(clusterIndex))
            .prop("parameter")
            .prop(_.intval(whichParameter))
            .split(',')
            .map(x => _.floatval(x))
            .value();
    }

    fastGetStimQuestion = function(index, whichQuestion) {
        return fastGetStimCluster(index).display[whichQuestion];
    }
    function fastGetStimAnswer(index, whichAnswer) {
        return fastGetStimCluster(index).response[whichAnswer];
    }

    getSubClozeAnswerSyllables = function(answer,displaySyllableIndices,cachedSyllables){
        console.log("!!!displaySyllableIndices: " + JSON.stringify(displaySyllableIndices) + ", this.cachedSyllables: " + JSON.stringify(cachedSyllables));
        if(typeof(displaySyllableIndices) === "undefined" || !cachedSyllables || displaySyllableIndices.length == 0){
            console.log("no syllable index or cachedSyllables, defaulting to no subclozeanswer");
            return undefined;
        }else{
            answer = answer.replace(/\./g,'_');
            let syllableArray = cachedSyllables.data[answer].syllables;
            return {syllableArray,displaySyllableIndices};
        }    
    }

    replaceClozeWithSyllables = function(question,currentAnswerSyllables, origAnswer){
        console.log("replaceClozeWithSyllables: " + question);
        if(!question){
            return {
                clozeQuestion: undefined,
                clozeMissingSyllables: undefined
            }
        }

        let clozeAnswer = "";
        let clozeMissingSyllables = ""
        let syllablesArray = currentAnswerSyllables.syllableArray;
        let syllableIndices = currentAnswerSyllables.displaySyllableIndices;
        let reconstructedAnswer = "";

        for(let index in syllablesArray){
            index = parseInt(index);
            if(syllableIndices.indexOf(index) != -1){
                clozeAnswer += syllablesArray[index];
            }else{
                clozeAnswer += "____";
                clozeMissingSyllables += syllablesArray[index];
            }

            reconstructedAnswer += syllablesArray[index];
            let nextChar = reconstructedAnswer.length;
            while(origAnswer.charAt(nextChar) == " "){
                clozeAnswer += " ";
                reconstructedAnswer += " ";
                clozeMissingSyllables += " ";
                nextChar = reconstructedAnswer.length;
            }
        }
        
        return {
            clozeQuestion: question.replace(/([_]+[ ]?)+/,clozeAnswer + " "),
            clozeMissingSyllables: clozeMissingSyllables
        };
    }

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
            "whichStim:", whichStim,
            "parameter", getStimParameterArray(clusterIndex, whichStim)
        );
    }

    //Initialize card probabilities, with optional initial data
    cardProbabilities = [];
    function initCardProbs(overrideData) {
        var initVals = {
            numQuestionsAnswered: 0,
            numQuestionsIntroduced: 0,
            numCorrectAnswers: 0,
            cards: []
        };

        if (!!overrideData) {
            initVals = _.extend(initVals, overrideData);
        }
        cardProbabilities = initVals;
    }

    //TODO: do this function without side effects on cards
    function setUpClusterList(cards){
        const currentTdfFile = getCurrentTdfFile();
        const isMultiTdf = currentTdfFile.isMultiTdf;
        let clusterList = [];

        if(isMultiTdf){
            const curUnitNumber = Session.get("currentUnitNumber");

            //NOTE: We are currently assuming that multiTdfs will have only three units: an instruction unit, an assessment session with exactly one question which is the last
            //item in the stim file, and a unit with all clusters specified in the generated subtdfs array
            if(curUnitNumber == 2){
                const subTdfIndex = Session.get("subTdfIndex");
                if(!subTdfIndex){
                    console.log("assuming we are in studentReporting, therefore ignoring the clusterlists"); //TODO, make this an explicit argument and error when it happens if we don't pass in the argument
                }else{
                    const unitClusterList = currentTdfFile.subTdfs[subTdfIndex].clusterList;
                    Helpers.extractDelimFields(unitClusterList, clusterList);
                }
            }else if(curUnitNumber > 2){
                throw new Error("We shouldn't ever get here, dynamic tdf cluster list error");
            }
        }else{
            // Figure out which cluster numbers that they want
            const unitClusterList = _.chain(getCurrentTdfUnit())
            .prop("learningsession").first()
            .prop("clusterlist").trim().value();
            Helpers.extractDelimFields(unitClusterList, clusterList);
        }

        for (i = 0; i < clusterList.length; ++i) {
            var nums = Helpers.rangeVal(clusterList[i]);
            for (j = 0; j < nums.length; ++j) {
                cards[_.intval(nums[j])].canUse = true;
            }
        }
    }

    // Initialize cards as we'll need them for the created engine (for current
    // model). Note that we assume TDF/Stimulus is set up and correct - AND
    // that we've already turned off cluster mapping. You'll note that although
    // we nest stims under cards, we maintain a "flat" list of probabilities -
    // this is to speed up calculations and make iteration below easier
    function initializeActRModel() {
        var i, j;

        var numQuestions = getStimClusterCount();
        var initCards = [];
        var initResponses = {};
        var initProbs = [];
        for (i = 0; i < numQuestions; ++i) {
            var card = {
                questionSuccessCount: 0,
                questionFailureCount: 0,
                studyTrialCount: 0,
                trialsSinceLastSeen: 3,  // We start at >2 for initial logic (see findMin/Max functions below)
                lastShownTimestamp: 0,
                firstShownTimestamp: 0,
                hasBeenIntroduced: false,
                canUse: false,
                stims: [],
                practiceTimes: [],
                otherPracticeTimeSinceFirst: 0,
                otherPracticeTimeSinceLast: 0,
                outcomeHistory: [],
                previousCalculatedProbabilities: []
            };

            // We keep per-stim and re-response-text results as well
            var cluster = fastGetStimCluster(i);
            var numStims = _.chain(cluster).prop("display").prop("length").intval().value();
            for (j = 0; j < numStims; ++j) {
                var parameter = getStimParameterArray(i,j); //Note this may be a single element array for older stims or a 3 digit array for newer ones
                // Per-stim counts
                card.stims.push({
                    stimSuccessCount: 0,
                    stimFailureCount: 0,
                    hasBeenIntroduced: false,
                    parameter: parameter,
                    outcomeHistory: [],
                    previousCalculatedProbabilities: [],
                    lastShownTimestamp: 0,
                    firstShownTimestamp: 0,
                    otherPracticeTimeSinceFirst: 0,
                    otherPracticeTimeSinceLast: 0,
                });

                initProbs.push({
                    cardIndex: i,
                    stimIndex: j,
                    probability: 0
                });

                // Per-response counts
                var response = stripSpacesAndLowerCase(Answers.getDisplayAnswerText(cluster.response[j]));
                if (!(response in initResponses)) {
                    initResponses[response] = {
                        responseSuccessCount: 0,
                        responseFailureCount: 0,
                        lastShownTimestamp: 0,
                        outcomeHistory: [],
                    };
                }
            }

            initCards.push(card);
        }

        setUpClusterList(initCards);

        //Re-init the card probabilities
        initCardProbs({
            cards: initCards,                           // List of cards (each of which has stims)
            responses: initResponses,                   // Dictionary of text responses for
            probs: initProbs,                           // "Flat" list of probabilities
        });

        //has to be done once ahead of time to give valid values for the beginning of the test.
        calculateCardProbabilities();
    }

    // Helpers for time/display/calc below
    function secs(t) {
        return t / 1000.0;
    }
    function elapsed(t) {
        return t < 1 ? 0 : secs(Date.now() - t);
    }

    // This is the final probability calculation used below if one isn't given
    // in the unit's learningsession/calculateProbability tag
    function defaultProbFunction(p) {
        //        p.y = p.stimParameter+
        //        0.866310634* ((0.5 + p.stimSuccessCount)/(1 + p.stimSuccessCount + p.stimFailureCount) - 0.5)+
        //        0.270707611* ((0.5 + p.questionSuccessCount)/(1 + p.questionSuccessCount + p.questionFailureCount) - 0.5)+
        //        0.869477261* ((0.5 + p.responseSuccessCount)/(1 + p.responseSuccessCount + p.responseFailureCount) - 0.5)+
        //        3.642734384* ((0.5 + p.userCorrectResponses)/(1 + p.userTotalResponses) - 0.5)+
        //        3.714113953* (p.recency)+
        //        2.244795778* p.intbs * Math.log(1 + p.stimSuccessCount + p.stimFailureCount) +
        //        0.447943182* p.intbs * Math.log(1 + p.questionStudyTrialCount) +
        //        0.500901271* p.intbs * Math.log(1 + p.responseSuccessCount + p.responseFailureCount);

        // Calculated metrics
        p.baseLevel = 1 / Math.pow(1 + p.questionSecsPracticingOthers + ((p.questionSecsSinceFirstShown - p.questionSecsPracticingOthers) * 0.00785),  0.2514);

        p.meanSpacing = 0;

        if (p.questionStudyTrialCount + p.questionTotalTests == 1) {
            p.meanspacing = 1;
        } else {
            if (p.questionStudyTrialCount + p.questionTotalTests > 1) {
                p.meanSpacing = Math.max(
                        1, Math.pow((p.questionSecsSinceFirstShown - p.questionSecsSinceLastShown) / (p.questionStudyTrialCount + p.questionTotalTests - 1), 0.0294)
                        );
            }
        }

        p.intbs = p.meanSpacing * p.baseLevel;

        p.recency = p.questionSecsSinceLastShown === 0 ? 0 : 1 / Math.pow(1 + p.questionSecsSinceLastShown, 0.2514);

        p.y = p.stimParameters[0] +
        0.55033* Math.log((2+ p.stimSuccessCount)/(2+ p.stimFailureCount))+
        0.88648* Math.log((2 + p.responseSuccessCount)/(2 + p.responseFailureCount))+
        1.00719* Math.log((10 + p.userCorrectResponses)/(10 + p.userTotalResponses-p.userCorrectResponses))+
        3.20689* (p.recency)+
        4.57174* p.intbs * Math.log(1 + p.stimSuccessCount + p.stimFailureCount) +
        0.74734* p.intbs * Math.log(1 + p.responseSuccessCount + p.responseFailureCount);
        p.probability = 1.0 / (1.0 + Math.exp(-p.y));  // Actual probability
        
        return p;
    }

    // See if they specified a probability function
    var probFunction = _.chain(getCurrentTdfUnit())
        .prop("learningsession").first()
        .prop("calculateProbability").first().trim().value();
    if (!!probFunction) {
        probFunction = new Function("p", "'use strict';\n" + probFunction);  // jshint ignore:line
    }
    else {
        probFunction = defaultProbFunction;
    }


    // Given a single item from the cardProbabilities.probs array, calculate the
    // current probability. IMPORTANT: this function only returns ALL parameters
    // used which include probability. The caller is responsible for storing it.
    function calculateSingleProb(prob) {
        var card = cardProbabilities.cards[prob.cardIndex];
        var stim = card.stims[prob.stimIndex];

        // Possibly useful one day
        // var userTotalTrials = cardProbabilities.numQuestionsIntroduced;
        // var totalPracticeSecs = secs(
        //     _.chain(cards).pluck('practiceTimes').flatten().sum().value()
        // );
        // var questionTrialsSinceLastSeen = card.trialsSinceLastSeen;
        // var questionHasBeenIntroduced = card.hasBeenIntroduced;
        // var questionSecsInPractice = secs(_.sum(card.practiceTimes));
        // var stimHasBeenIntroduced = stim.hasBeenIntroduced;

        // Store parameters in an object for easy logging/debugging
        var p = {};

        // Top-level metrics
        p.userTotalResponses = cardProbabilities.numQuestionsAnswered;
        p.userCorrectResponses = cardProbabilities.numCorrectAnswers;

        // Card/cluster metrics
        p.questionSuccessCount = card.questionSuccessCount;
        p.questionFailureCount = card.questionFailureCount;
        p.questionTotalTests = p.questionSuccessCount + p.questionFailureCount;
        p.questionStudyTrialCount = card.studyTrialCount;
        p.questionSecsSinceLastShown = elapsed(card.lastShownTimestamp);
        p.questionSecsSinceFirstShown = elapsed(card.firstShownTimestamp);
        p.questionSecsPracticingOthers = secs(card.otherPracticeTimeSinceFirst);

        // Stimulus/cluster-version metrics
        p.stimSecsSinceLastShown = elapsed(stim.lastShownTimestamp);
        p.stimSecsSinceFirstShown = elapsed(stim.firstShownTimestamp);
        p.stimSecsPracticingOthers = secs(stim.otherPracticeTimeSinceFirst);

        p.stimSuccessCount = stim.stimSuccessCount;
        p.stimFailureCount = stim.stimFailureCount;
        let answerText = Answers.getDisplayAnswerText(fastGetStimAnswer(prob.cardIndex, prob.stimIndex)).toLowerCase();
        p.stimResponseText = stripSpacesAndLowerCase(answerText); //Yes, lowercasing here is redundant. TODO: fix/cleanup
        let curStimFile = getCurrentStimName().replace(/\./g,'_');
        answerText = answerText.replace(/\./g,'_')
        if(!this.cachedSyllables.data || !this.cachedSyllables.data[answerText]){
            console.log("no cached syllables for: " + curStimFile + "|" + answerText);
            throw new Error("can't find syllable data in database");
        } //Curedit
        
        let stimSyllableData = this.cachedSyllables.data[answerText];
        p.syllables = stimSyllableData.count;
        p.syllablesArray = stimSyllableData.syllables;

        p.resp = cardProbabilities.responses[p.stimResponseText];
        p.responseSuccessCount = p.resp.responseSuccessCount;
        p.responseFailureCount = p.resp.responseFailureCount;
        p.responseOutcomeHistory = p.resp.outcomeHistory;
        p.responseSecsSinceLastShown = elapsed(p.resp.lastShownTimestamp);

        p.stimParameters = getStimParameterArray(prob.cardIndex,prob.stimIndex);

        p.clusterPreviousCalculatedProbabilities = JSON.parse(JSON.stringify(card.previousCalculatedProbabilities));
        console.log("card.outcomeHistory: "+ JSON.stringify(card.outcomeHistory));
        if(card.outcomeHistory.length > 0){
            console.log("card with outcomehistory: " + JSON.stringify(card));
        }
        p.clusterOutcomeHistory = JSON.parse(JSON.stringify(card.outcomeHistory));

        p.stimPreviousCalculatedProbabilities = JSON.parse(JSON.stringify(stim.previousCalculatedProbabilities));
        p.stimOutcomeHistory = stim.outcomeHistory;
        //console.log("stimOutcomeHistory: " + p.stimOutcomeHistory);

        p.overallOutcomeHistory = getUserProgress().overallOutcomeHistory;

        //console.log("p.overallOutcomeHistory: " + p.overallOutcomeHistory);

        return probFunction(p);
    }

    // Calculate current card probabilities for every card - see selectNextCard
    // the actual card/stim (cluster/version) selection
    calculateCardProbabilities = function() {
        // We use a "flat" probability structure - this is faster than a loop
        // over our nested data structure, but it also gives us more readable
        // code when we're setting something per stimulus
        var probs = cardProbabilities.probs;
        var ptemp = [];
        for (var i = 0; i < probs.length; ++i) {
            // card.canUse is true if and only if it is in the clusterlist
            // for the current unit. You could just return here if these clusters
            // should be ignored (or do nothing if they should be included below)
            var parms = calculateSingleProb(probs[i]);
            probs[i].probFunctionsParameters = parms;
            probs[i].probability = parms.probability;
            ptemp[i]=Math.round(100*parms.probability)/100;

        }
        console.log(JSON.stringify(ptemp));
        return cardProbabilities.probs;
    }

    // Return index of PROB with minimum probability that was last seen at least
    // 2 trials ago. Default to index 0 in case no probs meet this criterion
    function findMinProbCard(cards, probs) {
        var currentMin = 1.00001;
        var indexToReturn = 0;

        for (var i = probs.length - 1; i >= 0; --i) {
            var prob = probs[i];
            var card = cards[prob.cardIndex];

            if (card.canUse && card.trialsSinceLastSeen > 1) {
                if (prob.probability <= currentMin) {   // Note that this is stim probability
                    currentMin = prob.probability;
                    indexToReturn = i;
                }
            }
        }

        return indexToReturn;
    }

    //Return index of PROB with max probability that is under ceiling. If no
    //card is found under ceiling then -1 is returned
    function findMaxProbCard(cards, probs, ceiling) {
        var currentMax = 0;
        var indexToReturn = -1;

        for (var i = probs.length - 1; i >= 0; --i) {
            var prob = probs[i];
            var card = cards[prob.cardIndex];

            if (card.canUse && card.trialsSinceLastSeen > 1) {
                // Note that we are checking stim probability
                if (prob.probability > currentMax && prob.probability < ceiling) {
                    currentMax = prob.probability;
                    indexToReturn = i;
                }
            }
        }

        return indexToReturn;
    }

    function findMinProbDistCard(cards,probs){
      var currentMin = 1.00001; //Magic number to indicate greater than highest possible distance to start
      var indexToReturn = 0;

      for (var i = probs.length - 1; i >= 0; --i) {
          var prob = probs[i];
          var card = cards[prob.cardIndex];
          var parameters = card.stims[prob.stimIndex].parameter;
          var optimalProb = parameters[1];
          if(!optimalProb){
            //console.log("NO OPTIMAL PROB SPECIFIED IN STIM, DEFAULTING TO 0.90");
            optimalProb = 0.90;
          }
          //console.log("!!!parameters: " + JSON.stringify(parameters) + ", optimalProb: " + optimalProb);

          if (card.canUse && card.trialsSinceLastSeen > 1) {
              var dist = Math.abs(prob.probability - optimalProb)

            //  console.log(dist)
              // Note that we are checking stim probability
              if (dist <= currentMin) {
                  currentMin = dist;
                  indexToReturn = i;
              }
          }
      }

      return indexToReturn;
    }

    function findMaxProbCardThresholdCeilingPerCard(cards,probs){

      var currentMax = 0;
      var indexToReturn = -1;

      for (var i = probs.length - 1; i >= 0; --i) {
          var prob = probs[i];
          var card = cards[prob.cardIndex];
          var parameters = card.stims[prob.stimIndex].parameter;

          var thresholdCeiling = parameters[1];
          if(!thresholdCeiling){
          //  console.log("NO THRESHOLD CEILING SPECIFIED IN STIM, DEFAULTING TO 0.90");
            thresholdCeiling = 0.90;
          }
          //console.log("!!!parameters: " + JSON.stringify(parameters) + ", thresholdCeiling: " + thresholdCeiling + ", card: " + JSON.stringify(card));

          if (card.canUse && card.trialsSinceLastSeen > 1) {
              // Note that we are checking stim probability
              if (prob.probability >= currentMax && prob.probability < thresholdCeiling) {
                  currentMax = prob.probability;
                  indexToReturn = i;
              }
          }
      }

      return indexToReturn;
    }

    //Our actual implementation
    return {
        getCardProbabilitiesNoCalc: function(){
            return cardProbabilities;
        },

        getCardProbs: function(){
          return calculateCardProbabilities();
        },

        reinitializeClusterListsFromCurrentSessionData: function(){
            setUpClusterList(cardProbabilities.cards);
        },

        unitType: "model",

        unitMode: (function(){
          var unitMode = _.chain(getCurrentTdfUnit())
              .prop("learningsession").first()
              .prop("unitMode").trim().value();
              //getCurrentDeliveryParams().unitMode;
          console.log("UNIT MODE: " + unitMode);
          return unitMode;
        })(),

        initImpl: function() {
            initializeActRModel();
        },

        selectNextCard: function() {
            // The cluster (card) index, the cluster version (stim index), and
            // whether or not we should show the overlearning text is determined
            // here. See calculateCardProbabilities for how prob.probability is
            // calculated
            var newProbIndex;
            var showOverlearningText = false;

            var numItemsPracticed = cardProbabilities.numQuestionsAnswered;
            var cards = cardProbabilities.cards;
            var probs = cardProbabilities.probs;

            console.log("selectNextCard unitMode: " + this.unitMode);

            switch(this.unitMode){
              case 'thresholdCeiling':
                newProbIndex = findMaxProbCardThresholdCeilingPerCard(cards, probs);
                if (newProbIndex === -1) {
                    newProbIndex = findMinProbCard(cards, probs);
                }
                break;
              case 'distance':
                newProbIndex = findMinProbDistCard(cards,probs);
                break;
              case 'highest':
                newProbIndex = findMaxProbCard(cards, probs, 1.00001); //Magic number to indicate there is no real ceiling (probs should max out at 1.0)
                if (newProbIndex === -1) {
                    newProbIndex = findMinProbCard(cards, probs);
                }
                break;
              default:
                newProbIndex = findMaxProbCard(cards, probs, 0.90);
                if (newProbIndex === -1) {
                    newProbIndex = findMinProbCard(cards, probs);
                }
                break;
            }

            // Found! Update everything and grab a reference to the card and stim
            var prob = probs[newProbIndex];
            var cardIndex = prob.cardIndex;
            var card = cards[cardIndex];
            var whichStim = prob.stimIndex;
            var stim = card.stims[whichStim];

            // Store calculated probability for selected stim/cluster
            var currentStimProbability = prob.probability;
            stim.previousCalculatedProbabilities.push(currentStimProbability);
            card.previousCalculatedProbabilities.push(currentStimProbability);

            // Save the card selection
            // Note that we always take the first stimulus and it's always a drill
            setCurrentClusterIndex(cardIndex);

            let currentQuestion = fastGetStimQuestion(cardIndex, whichStim);
            let currentQuestionPart2 = undefined;
            let currentStimAnswer = getCurrentStimAnswer(whichStim).toLowerCase();
            window.test = [];
            console.log("currentStimAnswer: " + currentStimAnswer);
            window.test.push("before: " + currentStimAnswer);
            let currentAnswerSyllables = getSubClozeAnswerSyllables(currentStimAnswer,prob.probFunctionsParameters.hintsylls,this.cachedSyllables);

            //If we have a dual prompt question populate the spare data field
            if(currentQuestion.indexOf("|") != -1){
                var prompts = currentQuestion.split("|");
                currentQuestion = prompts[0];
                currentQuestionPart2 = prompts[1];
            }
            Session.set("originalQuestion",currentQuestion);
            Session.set("originalQuestion2",currentQuestionPart2);
            
            if(!!currentAnswerSyllables){
                stim.answerSyllables = currentAnswerSyllables;
                let {clozeQuestion,clozeMissingSyllables} = replaceClozeWithSyllables(currentQuestion,currentAnswerSyllables,currentStimAnswer);
                currentQuestion = clozeQuestion;
                Session.set("currentAnswer",clozeMissingSyllables);
                console.log("setting original answer to: " + currentStimAnswer);
                window.test.push("after: " + currentStimAnswer);
                Session.set("originalAnswer",currentStimAnswer);
                let {clozeQuestion2,clozeMissingSyllables2} = replaceClozeWithSyllables(currentQuestionPart2,currentAnswerSyllables,currentStimAnswer);
                currentQuestionPart2 = clozeQuestion2; //TODO we should use clozeMissingSyllables2 probably, doubtful that syllables will work with two party questions for now
            }else{
                Session.set("currentAnswer",currentStimAnswer);
                Session.set("originalAnswer",undefined);
                window.test.push("undefined: " + currentStimAnswer);
            }

            Session.set("currentQuestion",currentQuestion);
            Session.set("currentQuestionPart2",currentQuestionPart2);

            if(getCurrentDeliveryParams().studyFirst){
              if(card.studyTrialCount == 0){
                console.log("!!! STUDY FOR FIRST TRIAL");
                Session.set("testType",'s');
              }else{
                Session.set("testType", "d");
              }
            }else{
              Session.set("testType", "d");
            }
            Session.set("questionIndex", 1);  //questionIndex doesn't have any meaning for a model
            Session.set("showOverlearningText", showOverlearningText);

            // About to show a card - record any times necessary
            card.lastShownTimestamp = Date.now();
            if (card.firstShownTimestamp < 1 && card.lastShownTimestamp > 0) {
                card.firstShownTimestamp = card.lastShownTimestamp;
            }

            stim.lastShownTimestamp = Date.now();
            if(stim.firstShownTimestamp < 1 && stim.lastTimestamp > 0) {
              stim.firstShownTimestamp = stim.lastShownTimestamp;
            }

            //Save for returning the info later (since we don't have a schedule)
            setCurrentCardInfo(cardIndex, whichStim);

            var responseText = stripSpacesAndLowerCase(Answers.getDisplayAnswerText(fastGetStimCluster(cardIndex).response[whichStim]));
            if (responseText && responseText in cardProbabilities.responses) {
                resp = cardProbabilities.responses[responseText];
                resp.lastShownTimestamp = Date.now();
            }

            // only log this for teachers/admins
            if (Roles.userIsInRole(Meteor.user(), ["admin", "teacher"]) || Meteor.user().username.startsWith('debug')) {
                console.log(">>>BEGIN METRICS>>>>>>>");

                console.log("Overall user stats => ",
                    "total trials:", cardProbabilities.numQuestionsIntroduced,
                    "total responses:", cardProbabilities.numQuestionsAnswered,
                    "total correct responses:", cardProbabilities.numCorrectAnswers
                );

                // Log selections - note that the card output will also include the stim
                console.log("Model selected prob:", displayify(prob));
                console.log("Model selected card:", displayify(card));
                console.log("Model selected stim:", displayify(card.stims[whichStim]));

                // Log time stats in human-readable form
                var secsStr = function(t) { return secs(t) + ' secs'; };
                var elapsedStr = function(t) { return t < 1 ? 'Never Seen': secs(Date.now() - t); };
                console.log(
                    'Card First Seen:', elapsedStr(card.firstShownTimestamp),
                    'Card Last Seen:', elapsedStr(card.lastShownTimestamp),
                    'Total time in practice:', secsStr(_.sum(card.practiceTimes)),
                    'Previous Practice Times:', displayify(_.map(card.practiceTimes, secsStr)),
                    'Total time in other practice:', secs(card.otherPracticeTimeSinceFirst),
                    'Stim First Seen:', elapsedStr(stim.firstShownTimestamp),
                    'Stim Last Seen:',elapsedStr(stim.lastShownTimestamp),
                    'Stim Total time in other practice:', secs(stim.otherPracticeTimeSinceFirst)
                );

                // Display response and current response stats
                console.log("Response is", responseText, displayify(cardProbabilities.responses[responseText]));

                console.log("<<<END   METRICS<<<<<<<");
            }

            return newProbIndex; //Must return index for call to cardSelected
        },

        findCurrentCardInfo: function() {
            return currentCardInfo;
        },

        cardSelected: function(selectVal, resumeData) {
            // Find objects we'll be touching
            var probIndex = _.intval(selectVal);  // See selectNextCard

            var prob = cardProbabilities.probs[probIndex];
            var indexForNewCard = prob.cardIndex;
            var cards = cardProbabilities.cards;
            var card = cards[indexForNewCard];
            var stim = card.stims[prob.stimIndex];
            var responseText = stripSpacesAndLowerCase(Answers.getDisplayAnswerText(fastGetStimCluster(indexForNewCard).response[prob.stimIndex]));
            var resp = {};
            if (responseText && responseText in cardProbabilities.responses) {
                resp = cardProbabilities.responses[responseText];
            }

            // Update our top-level stats
            cardProbabilities.numQuestionsIntroduced += 1;

            // If this is a resume, we've been given originally logged data
            // that we need to grab
            if (!!resumeData) {
                _.extend(card, resumeData.cardModelData);
                _.extend(currentCardInfo, resumeData.currentCardInfo);

                if(resumeData.responseData.responseText == responseText){
                  resp.lastShownTimestamp = Math.max(resumeData.responseData.lastShownTimestamp,resp.lastShownTimestamp);
                }

                if (currentCardInfo.clusterIndex != indexForNewCard) {
                    console.log("Resume cluster index mismatch", currentCardInfo.clusterIndex, indexForNewCard,
                        "selectVal=", selectVal,
                        "currentCardInfo=", displayify(currentCardInfo),
                        "card=", displayify(card),
                        "prob=", displayify(prob)
                    );
                }
            }
            else {
                // If this is NOT a resume (and is just normal display mode for
                // a learner) then we need to update stats for the card
                card.trialsSinceLastSeen = 0;
                card.hasBeenIntroduced = true;
                stim.hasBeenIntroduced = true;
                if (getTestType() === 's') {
                    card.studyTrialCount += 1;
                }
            }

            // It has now been officially one more trial since all the other cards
            // have been seen - and we need to do this whether or NOT we are in
            // resume mode
            _.each(cards, function(card, index) {
                if (index != indexForNewCard) {
                    card.trialsSinceLastSeen += 1;
                }
            });
        },

        createQuestionLogEntry: function() {
            var idx = getCurrentClusterIndex();
            var card = cardProbabilities.cards[idx];
            var cluster = fastGetStimCluster(getCurrentClusterIndex());
            var responseText = stripSpacesAndLowerCase(Answers.getDisplayAnswerText(cluster.response[currentCardInfo.whichStim]));
            var responseData = {
              responseText: responseText,
              lastShownTimestamp: Date.now()
            };
            return {
                'cardModelData':   _.omit(card, ["question", "answer"]),
                'currentCardInfo': _.extend({}, currentCardInfo),
                'responseData': responseData,
                'whichStim': currentCardInfo.whichStim
            };
        },

        cardAnswered: function(wasCorrect, resumeData) {
            // Get info we need for updates and logic below
            var cards = cardProbabilities.cards;
            var cluster = fastGetStimCluster(getCurrentClusterIndex());
            var card = _.prop(cards, cluster.shufIndex);
            console.log("cardAnswered, card: " + JSON.stringify(card) + "cluster.shufIndex: " + cluster.shufIndex);

            // Before our study trial check, capture if this is NOT a resume
            // call (and we captured the time for the last question)
            if (!resumeData && card.lastShownTimestamp > 0) {
                var practice = Date.now() - card.lastShownTimestamp;
                // We assume more than 5 minutes is an artifact of resume logic
                if (practice < 5 * 60 * 1000) {
                    // Capture the practice time. We also know that all the
                    // other cards' "other practice" times should increase
                    card.practiceTimes.push(practice);
                    card.otherPracticeTimeSinceLast = 0;
                    _.each(cards, function(otherCard, index) {
                      if(otherCard.firstShownTimestamp > 0){
                        if (index != cluster.shufIndex) {
                            otherCard.otherPracticeTimeSinceFirst += practice;
                            otherCard.otherPracticeTimeSinceLast += practice;
                            _.each(otherCard.stims, function(otherStim, index){
                              otherStim.otherPracticeTimeSinceFirst += practice;
                              otherStim.otherPracticeTimeSinceLast += practice;
                            });
                        }else{
                          _.each(otherCard.stims, function(otherStim, index){
                            if(index != currentCardInfo.whichStim){
                              otherStim.otherPracticeTimeSinceFirst += practice;
                              otherStim.otherPracticeTimeSinceLast += practice;
                            }
                          });
                        }
                      }
                    });
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
            cardProbabilities.numQuestionsAnswered += 1;
            if (wasCorrect) {
                cardProbabilities.numCorrectAnswers += 1;
            }

            // "Card-level" stats (and below - e.g. stim-level stats)
            if (card) {
                console.log("card exists");
                if (wasCorrect) card.questionSuccessCount += 1;
                else            card.questionFailureCount += 1;

                console.log("cardoutcomehistory before: " + JSON.stringify(card.outcomeHistory));
                card.outcomeHistory.push(wasCorrect ? 1 : 0);
                console.log("cardoutcomehistory after: " + JSON.stringify(card.outcomeHistory));
                var stim = currentCardInfo.whichStim;
                if (stim >= 0 && stim < card.stims.length) {
                    if (wasCorrect) card.stims[stim].stimSuccessCount += 1;
                    else            card.stims[stim].stimFailureCount += 1;

                    //This is called from processUserTimesLog() so this both works in memory and restoring from userTimesLog
                    card.stims[stim].outcomeHistory.push(wasCorrect ? 1 : 0);
                }
            }

            // "Response" stats
            var answerText = stripSpacesAndLowerCase(Answers.getDisplayAnswerText(cluster.response[currentCardInfo.whichStim]));
            if (answerText && answerText in cardProbabilities.responses) {
                var resp = cardProbabilities.responses[answerText];
                if (wasCorrect) resp.responseSuccessCount += 1;
                else            resp.responseFailureCount += 1;

                console.log("resp.outcomeHistory before: " + JSON.stringify(resp.outcomeHistory))
                resp.outcomeHistory.push(wasCorrect ? 1 : 0);
            }
            else {
                console.log("COULD NOT STORE RESPONSE METRICS",
                    answerText,
                    currentCardInfo.whichStim,
                    displayify(cluster.response),
                    displayify(cardProbabilities.responses));
            }

            // All stats gathered - calculate probabilities
            //Need a delay so that the outcomehistory arrays can be properly updated
            //before we use them in calculateCardProbabilities
            //Meteor.setTimeout(calculateCardProbabilities,20); //TODO: why did we need this?  Make sure we are calculating correct values now
            console.log("resp.outcomeHistory after: " + JSON.stringify(resp.outcomeHistory))
            calculateCardProbabilities();
        },

        unitFinished: function() {
            var session = _.chain(getCurrentTdfUnit()).prop("learningsession").first().value();
            var minSecs = _.chain(session).prop("displayminseconds").first().intval(0).value();
            var maxSecs = _.chain(session).prop("displaymaxseconds").first().intval(0).value();

            //TODO: why are we using side effects to handle the unit being finished? Fix this
            if (minSecs > 0.0 || maxSecs > 0.0) {
                // We ignore practice seconds if displayXXXseconds are specified:
                // that means the unit will be over when the timer is exceeded
                // or the user clicks a button. Either way, that's handled outside
                // the engine
                return false;
            }

            //TODO: we should probably remove this as it's been superceded by displayminseconds/displaymaxseconds
            // If we're still here, check practice seconds
            var practiceSeconds = getCurrentDeliveryParams().practiceseconds;
            if (practiceSeconds < 1.0) {
                //Less than a second is an error or a missing values
                console.log("No Practice Time Found and display timer: user must quit with Continue button");
                return false;
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
                    unitname: _.display(currUnit.unitname),
                    unitindex: unit
                });
                alert("There is an issue with the TDF - experiment cannot continue");
                throw new Error("There is an issue with the TDF - experiment cannot continue");
            }

            //We save the current schedule and also log it to the UserTime collection
            progress.currentSchedule = schedule;

            recordUserTime("schedule", {
                unitname: _.display(currUnit.unitname),
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
            var questionIndex = Session.get("questionIndex");
            var questInfo = getSchedule().q[questionIndex];
            var whichStim = questInfo.whichStim;

            //Set current Q/A info, type of test (drill, test, study), and then
            //increment the session's question index number
            setCurrentClusterIndex(questInfo.clusterIndex);
            Session.set("currentQuestion", getCurrentStimQuestion(whichStim));
            var currentQuestion = Session.get("currentQuestion");
            //If we have a dual prompt question populate the spare data field
            if(currentQuestion.indexOf("|") != -1){

              var prompts = currentQuestion.split("|");
              Session.set("currentQuestion",prompts[0]);
              Session.set("currentQuestionPart2",prompts[1]);
              console.log("two part question detected: " + prompts[0] + ",,," + prompts[1]);
            }else{
              console.log("one part question detected");
              Session.set("currentQuestionPart2",undefined);
            }
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
