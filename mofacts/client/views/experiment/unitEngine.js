import { 
    extractDelimFields,
    rangeVal,
    getStimCount, 
    getStimCluster, 
    getStimKCBaseForCurrentStimuliSet,
    getTestType,
    shuffle,
    randomChoice,
    createStimClusterMapping
} from '../../lib/currentTestingHelpers';
import { updateExperimentState } from './card';
import { KC_MULTIPLE, MODEL_UNIT, SCHEDULE_UNIT } from '../../../common/Definitions';

async function create(func,curExperimentData) {
    var engine = _.extend(defaultUnitEngine(curExperimentData), func());
    await engine.init();
    return engine;
}

getRandomInt = function(max){
    return Math.floor(Math.random() * max);
}

stripSpacesAndLowerCase = function(input){
  return input.replace(/ /g,'').toLowerCase();
}

function getStimAnswer(clusterIndex, whichAnswer) {
    return getStimCluster(clusterIndex).stims[whichAnswer].correctResponse;
};

createEmptyUnit = async function(curExperimentData) { return await create(emptyUnitEngine,curExperimentData); };

createModelUnit = async function(curExperimentData) { return await create(modelUnitEngine,curExperimentData); };

createScheduleUnit = async function(curExperimentData) { return await create(scheduleUnitEngine,curExperimentData); };

// Return an instance of the "base" engine
function defaultUnitEngine(curExperimentData) {
    let engine = {
        // Things actual engines must supply
        unitType: "DEFAULT",
        selectNextCard: function() { throw "Missing Implementation"; },
        cardAnswered: function(wasCorrect) { throw "Missing Implementation"; },
        unitFinished: function() { throw "Missing Implementation"; },
        saveComponentStates: function() { },
        loadComponentStates: function() { },

        // Optional functions that engines can replace if they want
        initImpl: async function() { },
        reinitializeClusterListsFromCurrentSessionData: function() { },

        // Functions we supply
        init: async function() {
            console.log("Engine created for unit:", this.unitType);
            await this.initImpl();
        },

        getSubClozeAnswerSyllables: function(answer,displaySyllableIndices,cachedSyllables){
            console.log("!!!displaySyllableIndices: " + JSON.stringify(displaySyllableIndices) + ", this.cachedSyllables: " + JSON.stringify(cachedSyllables));
            if(typeof(displaySyllableIndices) === "undefined" || !cachedSyllables || displaySyllableIndices.length == 0){
                console.log("no syllable index or cachedSyllables, defaulting to no subclozeanswer");
                return undefined;
            }else{
                answer = answer.replace(/\./g,'_');
                let syllableArray = cachedSyllables.data[answer].syllables;
                return {syllableArray,displaySyllableIndices};
            }    
        },
    
        replaceClozeWithSyllables: function(question,currentAnswerSyllables, origAnswer){
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
            let clozeAnswerOnlyUnderscores = "";
            let clozeAnswerNoUnderscores = "";
    
            for(let index in syllablesArray){
                index = parseInt(index);
                if(syllableIndices.indexOf(index) != -1){
                    clozeAnswer += syllablesArray[index];
                    clozeAnswerNoUnderscores += syllablesArray[index];
                }else{
                    // Handle underscores for syllable array elements that contain whitespace
                    if (syllablesArray[index].indexOf(' ') >= 0) {
                        clozeAnswer += "__ __";
                        clozeAnswerOnlyUnderscores += "__ __"
                        clozeMissingSyllables += syllablesArray[index];
                    } else {
                        clozeAnswer += "____";
                        clozeAnswerOnlyUnderscores += "____";
                        clozeMissingSyllables += syllablesArray[index];
                    }
                }
    
                reconstructedAnswer += syllablesArray[index];
                let nextChar = reconstructedAnswer.length;
                while(origAnswer.charAt(nextChar) == " "){
                    clozeAnswer += " ";
                    reconstructedAnswer += " ";
                    clozeMissingSyllables += " ";
                    clozeAnswerOnlyUnderscores += " ";
                    clozeAnswerNoUnderscores += " ";
                    nextChar = reconstructedAnswer.length;
                }
            }
    
            let clozeQuestionParts = question.split(/([_]+[ ]?)+/);
            clozeQuestionParts.splice(1,1);
            clozeQuestionParts.splice(1,0,clozeAnswerNoUnderscores.trim());
            clozeQuestionParts[2] = clozeAnswerOnlyUnderscores + " " + clozeQuestionParts[2];
    
            // If our third cloze part begins with an underscore,
            // our second cloze part should be our syllables, so
            // if the answer sans underscores doesn't end in whitespace,
            // remove leading whitespace from part 3
            if (clozeQuestionParts[2].trim().charAt(0) === "_"
                && clozeAnswerNoUnderscores.slice(-1) != " ") {
                clozeQuestionParts[2] = clozeQuestionParts[2].trim();
            }

            let clozeQuestion = question.replace(/([_]+[ ]?)+/,clozeAnswer + " ");

            console.log("replaceClozeWithSyllables:",clozeQuestion,clozeMissingSyllables,clozeQuestionParts);
            
            return { clozeQuestion, clozeMissingSyllables, clozeQuestionParts };
        },

        setUpCardQuestionSyllables: function(currentQuestion, currentQuestionPart2, currentStimAnswer,prob){
            console.log("setUpCardQuestionSyllables: ",currentQuestion,currentQuestionPart2,currentStimAnswer,prob);
            let currentAnswer = currentStimAnswer;
            let clozeQuestionParts = undefined;
            let currentAnswerSyllables = undefined;

            //For now this distinguishes model engine from schedule engine, which doesn't do syllable replacement
            if(prob){
                currentAnswerSyllables = this.getSubClozeAnswerSyllables(currentStimAnswer,prob.probFunctionsParameters.hintsylls,this.cachedSyllables);
                if(currentAnswerSyllables){
                    let {clozeQuestion,clozeMissingSyllables,clozeQuestionParts:cQuestionParts} = this.replaceClozeWithSyllables(
                        currentQuestion,currentAnswerSyllables,currentStimAnswer);
                    currentQuestion = clozeQuestion;
                    currentAnswer = clozeMissingSyllables;
                    clozeQuestionParts = cQuestionParts;
                    console.log("clozeQuestionParts:",cQuestionParts);
                    let {clozeQuestion2,clozeMissingSyllables2,...rest} = this.replaceClozeWithSyllables(
                        currentQuestionPart2,currentAnswerSyllables,currentStimAnswer);
                    currentQuestionPart2 = clozeQuestion2; //TODO we should use clozeMissingSyllables2 probably, doubtful that syllables will work with two part questions for now
                }
            }          

            console.log("setUpCardQuestionSyllables:",currentQuestion,currentQuestionPart2,currentAnswerSyllables,clozeQuestionParts,currentAnswer);
            return {currentQuestion,currentQuestionPart2,currentAnswerSyllables,clozeQuestionParts,currentAnswer};
        },

        setUpCardQuestionAndAnswerGlobals: function(cardIndex, whichStim, prob){
            let newExperimentState = {};
            Session.set("alternateDisplayIndex",undefined);
            let cluster = getStimCluster(cardIndex);
            console.log('setUpCardQuestionAndAnswerGlobals',cardIndex,whichStim,prob,cluster,cluster.stims[whichStim]);
            let curStim = cluster.stims[whichStim];
            let currentDisplay = JSON.parse(JSON.stringify({
                text:curStim.textStimulus,
                audioSrc:curStim.audioStimulus,
                imgSrc:curStim.imageStimulus,
                videoSrc:curStim.videoStimulus,
                clozeText:curStim.clozeStimulus
            }));
            if(curStim.alternateDisplays){
                let numPotentialDisplays = curStim.alternateDisplays.length + 1;
                let displayIndex = Math.floor(numPotentialDisplays * Math.random());
                if(displayIndex < curStim.alternateDisplays.length){
                    Session.set("alternateDisplayIndex",displayIndex);
                    newExperimentState.alternateDisplayIndex = displayIndex;
                    currentDisplay = JSON.parse(JSON.stringify(curStim.alternateDisplays[displayIndex]));
                }
            }
            let originalDisplay = JSON.parse(JSON.stringify(currentDisplay));
            Session.set("originalDisplay", originalDisplay);
            newExperimentState.originalDisplay = originalDisplay;
    
            let currentQuestion = currentDisplay.text || currentDisplay.clozeText;
            let currentQuestionPart2 = undefined;
            let currentStimAnswer = getStimAnswer(cardIndex, whichStim);
            Session.set("originalAnswer",currentStimAnswer);
            newExperimentState.originalAnswer = currentStimAnswer;
            currentStimAnswer = currentStimAnswer.toLowerCase();
    
            //If we have a dual prompt question populate the spare data field
            if(currentQuestion && currentQuestion.indexOf("|") != -1){
                var prompts = currentQuestion.split("|");
                currentQuestion = prompts[0];
                currentQuestionPart2 = prompts[1];
            }
            Session.set("originalQuestion",currentQuestion);
            Session.set("originalQuestion2",currentQuestionPart2);
            newExperimentState.originalQuestion = currentQuestion;
            newExperimentState.originalQuestion2 = currentQuestionPart2;
            
            let currentAnswerSyllables, clozeQuestionParts, currentAnswer;
            ({currentQuestion,currentQuestionPart2,currentAnswerSyllables,clozeQuestionParts,currentAnswer} = this.setUpCardQuestionSyllables(currentQuestion,currentQuestionPart2,currentStimAnswer,prob));

            if(currentAnswerSyllables){
                curStim.answerSyllables = currentAnswerSyllables;
            }
            Session.set("currentAnswerSyllables",currentAnswerSyllables);
            Session.set("currentAnswer",currentAnswer);
            Session.set("clozeQuestionParts",clozeQuestionParts);
            Session.set("currentQuestionPart2",currentQuestionPart2);
            newExperimentState.currentAnswerSyllables = currentAnswerSyllables;
            newExperimentState.currentAnswer = currentAnswer;
            newExperimentState.clozeQuestionParts = clozeQuestionParts;
            newExperimentState.currentQuestionPart2 = currentQuestionPart2;
    
            if(!!(currentDisplay.text)){
                currentDisplay.text = currentQuestion;
            }else if(!!(currentDisplay.clozeText)){
                currentDisplay.clozeText = currentQuestion;
            }
    
            Session.set("currentDisplayEngine",currentDisplay);
            newExperimentState.currentDisplayEngine = currentDisplay;

            return newExperimentState;
        }
    };
    engine.experimentState = curExperimentData.experimentState;
    engine.cachedSyllables = curExperimentData.cachedSyllables;
    console.log("curExperimentData: " + curExperimentData);
    return engine;
}

//////////////////////////////////////////////////////////////////////////////
// Return an instance of a unit with NO question/answer's (instruction-only)
function emptyUnitEngine() {
    return {
        unitType: "instruction-only",
        initImpl: function() { Session.set("unitType","instruction-only") },
        unitFinished: function() { return true; },
        selectNextCard: function() { },
        findCurrentCardInfo: function() { },
        cardAnswered: function(wasCorrect) { }
    };
}

//////////////////////////////////////////////////////////////////////////////
// Return an instance of the model-based unit engine

/* Stats information: we track the following stats in the card info structure.
   (All properties are relative to the object returned by getCardProbs())

- Total responses given by user: numQuestionsAnswered
- Total correct NON-STUDY responses given by user: numCorrectAnswers
- Cluster correct answer count - card.priorCorrect
- Cluster incorrect answer count - card.priorIncorrect
- Last time cluster was shown (in milliseconds since the epoch) - card.lastSeen
- First time cluster was shown (in milliseconds since the epoch) - card.firstSeen
- Trials since cluster seen - card.trialsSinceLastSeen
- If user has seen cluster - card.hasBeenIntroduced
- Correct answer count for stim (cluster version) - card.stims.priorCorrect
- Incorrect answer count for stim (cluster version) - card.stims.priorIncorrect
- If user has seen specific stimulus in a cluster - card.stims.hasBeenIntroduced
- Correct answer count for answer (correct response) text - responses.priorCorrect
- Incorrect answer count for answer (correct response) text - responses.priorIncorrect
- Count of times study trials shown per cluster - card.priorStudy
- Total time (in seconds) that other cards have been practiced since a card's
  FIRST practice - card.otherPracticeTime
*/

//TODO: pass in all session variables possible
function modelUnitEngine() {
    console.log('model unit engine created!!!');
    //Checked against practice seconds. Notice that we capture this on unit
    //creation, so if they leave in the middle of practice and come back to
    //the unit we'll start all over.
    var unitStartTimestamp = Date.now();

    function getStimParameterArray(clusterIndex,whichStim){
      return getStimCluster(clusterIndex).stims[whichStim].params.split(',').map(x => _.floatval(x));
    }

    var currentCardInfo = {
        testType: 'd',
        clusterIndex: -1,
        whichStim : -1,
        forceButtonTrial: false,
        probabilityEstimate: -1,
    };

    function setCurrentCardInfo(clusterIndex, whichStim) {
        currentCardInfo.clusterIndex = clusterIndex;
        currentCardInfo.whichStim = whichStim;
        currentCardInfo.probabilityEstimate = cardProbabilities.probs.find(x => x.cardIndex == clusterIndex && x.stimIndex == whichStim);
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
        const currentTdfFile = Session.get("currentTdfFile");
        const isMultiTdf = currentTdfFile.isMultiTdf;
        let clusterList = [];

        if(isMultiTdf){
            const curUnitNumber = Session.get("currentUnitNumber");

            //NOTE: We are currently assuming that multiTdfs will have only three units: an instruction unit, an assessment session with exactly one question which is the last
            //item in the stim file, and a unit with all clusters specified in the generated subtdfs array
            if(curUnitNumber == 2){
                const subTdfIndex = Session.get("subTdfIndex");
                if(typeof(subTdfIndex) == "undefined"){
                    console.log("assuming we are in studentReporting, therefore ignoring the clusterlists"); //TODO, make this an explicit argument and error when it happens if we don't pass in the argument
                }else{
                    const unitClusterList = currentTdfFile.subTdfs[subTdfIndex].clusterList;
                    extractDelimFields(unitClusterList, clusterList);
                }
            }else if(curUnitNumber > 2){
                throw new Error("We shouldn't ever get here, dynamic tdf cluster list error");
            }
        }else{
            let sessCurUnit = JSON.parse(JSON.stringify(Session.get("currentTdfUnit")));
            // Figure out which cluster numbers that they want
            console.log("setupclusterlist:",this.curUnit,sessCurUnit);
            const unitClusterList = _.chain(this.curUnit || sessCurUnit)
            .prop("learningsession").first()
            .prop("clusterlist").trim().value();
            extractDelimFields(unitClusterList, clusterList);
        }

        for (i = 0; i < clusterList.length; ++i) {
            var nums = rangeVal(clusterList[i]);
            for (j = 0; j < nums.length; ++j) {
                cards[_.intval(nums[j])].canUse = true;
            }
        }
        console.log("setupClusterList,cards:",cards);
    }

    // Initialize cards as we'll need them for the created engine (for current
    // model). Note that we assume TDF/Stimulus is set up and correct - AND
    // that we've already turned off cluster mapping. You'll note that although
    // we nest stims under cards, we maintain a "flat" list of probabilities -
    // this is to speed up calculations and make iteration below easier
    async function initializeActRModel() {
        var i, j;
        var numQuestions = getStimCount();
        var initCards = [];
        var initResponses = {};
        var initProbs = [];
        let curKCBase = getStimKCBaseForCurrentStimuliSet();
        let stimulusKC = curKCBase;
        console.log("initializeActRModel",numQuestions,curKCBase);
        const reponseKCMap = await meteorCallAsync('getReponseKCMap');
        console.log("initializeActRModel,reponseKCMap",reponseKCMap);
        for (i = 0; i < numQuestions; ++i) {
            var card = {
                clusterKC: (curKCBase + i),
                priorCorrect: 0,
                priorIncorrect: 0,
                hasBeenIntroduced: false,
                outcomeStack: [],
                lastSeen: 0,
                firstSeen: 0,
                totalPracticeDuration: 0,
                otherPracticeTime: 0,
                previousCalculatedProbabilities: [],
                priorStudy: 0,
                trialsSinceLastSeen: 3,  // We start at >2 for initial logic (see findMin/Max functions below)
                canUse: false,
                stims: [],
            };

            // We keep per-stim and re-response-text results as well
            var cluster = getStimCluster(i);
            var numStims = cluster.stims.length;
            for (j = 0; j < numStims; ++j) {
                var parameter = getStimParameterArray(i,j); //Note this may be a single element array for older stims or a 3 digit array for newer ones
                // Per-stim counts
                card.stims.push({
                    clusterKC: (curKCBase + i),
                    stimIndex: j,
                    stimulusKC,
                    priorCorrect: 0,
                    priorIncorrect: 0,
                    hasBeenIntroduced: false,
                    outcomeStack: [],
                    lastSeen: 0,
                    firstSeen: 0,
                    totalPracticeDuration: 0,
                    otherPracticeTime: 0,
                    previousCalculatedProbabilities: [],
                    priorStudy: 0,
                    parameter: parameter,
                });
                stimulusKC += 1;

                initProbs.push({
                    cardIndex: i,
                    stimIndex: j,
                    probability: 0
                });

                // Per-response counts
                let rawResponse = cluster.stims[j].correctResponse;
                var response = stripSpacesAndLowerCase(Answers.getDisplayAnswerText(rawResponse));
                if (!(response in initResponses)) {
                    initResponses[response] = {
                        KCId: reponseKCMap[response],
                        priorCorrect: 0,
                        priorIncorrect: 0,
                        firstSeen: 0,
                        lastSeen: 0,
                        totalPracticeDuration: 0,
                        priorStudy: 0,
                        outcomeStack: [],
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

        console.log("initCards:",initCards,initProbs);

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
    var probFunction = _.chain(this.curUnit)
        .prop("learningsession").first()
        .prop("calculateProbability").first().trim().value();
    var probFunctionHasHintSylls = typeof(probFunction) == "undefined" ? false : probFunction.indexOf("hintsylls") > -1;
    console.log("probFunctionHasHintSylls: " + probFunctionHasHintSylls);
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

        // Store parameters in an object for easy logging/debugging
        var p = {};

        //Current Indices
        p.clusterIndex = prob.cardIndex;
        p.stimIndex = prob.stimIndex;

        // Top-level metrics
        p.userTotalResponses = cardProbabilities.numQuestionsAnswered;
        p.userCorrectResponses = cardProbabilities.numCorrectAnswers;

        // Card/cluster metrics
        p.questionSuccessCount = card.priorCorrect;
        p.questionFailureCount = card.priorIncorrect;
        p.questionTotalTests = p.questionSuccessCount + p.questionFailureCount;
        p.questionStudyTrialCount = card.priorStudy;
        p.questionSecsSinceLastShown = elapsed(card.lastSeen);
        p.questionSecsSinceFirstShown = elapsed(card.firstSeen);
        p.questionSecsPracticingOthers = secs(card.otherPracticeTime);

        // Stimulus/cluster-version metrics
        p.stimSecsSinceLastShown = elapsed(stim.lastSeen);
        p.stimSecsSinceFirstShown = elapsed(stim.firstSeen);
        p.stimSecsPracticingOthers = secs(stim.otherPracticeTime);

        p.stimSuccessCount = stim.priorCorrect;
        p.stimFailureCount = stim.priorIncorrect;
        p.stimStudyTrialCount = stim.priorStudy;
        let answerText = Answers.getDisplayAnswerText(getStimAnswer(prob.cardIndex, prob.stimIndex)).toLowerCase();
        p.stimResponseText = stripSpacesAndLowerCase(answerText); //Yes, lowercasing here is redundant. TODO: fix/cleanup
        let currentStimuliSetId = Session.get("currentStimuliSetId");
        answerText = answerText.replace(/\./g,'_');
        
        if(probFunctionHasHintSylls){
            if(!this.cachedSyllables.data || !this.cachedSyllables.data[answerText]){
                console.log("no cached syllables for: " + currentStimuliSetId + "|" + answerText);
                throw new Error("can't find syllable data in database");
            }else{
                let stimSyllableData = this.cachedSyllables.data[answerText];
                p.syllables = stimSyllableData.count;
                p.syllablesArray = stimSyllableData.syllables;
            }
        }

        p.resp = cardProbabilities.responses[p.stimResponseText];
        p.responseSuccessCount = p.resp.priorCorrect;
        p.responseFailureCount = p.resp.priorIncorrect;
        p.responseOutcomeHistory = p.resp.outcomeStack;
        p.responseSecsSinceLastShown = elapsed(p.resp.lastSeen);
        p.responseStudyTrialCount = p.resp.priorStudy;

        p.stimParameters = getStimParameterArray(prob.cardIndex,prob.stimIndex);

        p.clusterPreviousCalculatedProbabilities = JSON.parse(JSON.stringify(card.previousCalculatedProbabilities));
        p.clusterOutcomeHistory = JSON.parse(JSON.stringify(card.outcomeStack));

        p.stimPreviousCalculatedProbabilities = JSON.parse(JSON.stringify(stim.previousCalculatedProbabilities));
        p.stimOutcomeHistory = stim.outcomeStack;
        //console.log("stimOutcomeHistory: " + p.stimOutcomeHistory);

        p.overallOutcomeHistory = getUserProgress().overallOutcomeHistory;

        //console.log("p.overallOutcomeHistory: " + p.overallOutcomeHistory);

        console.log("model user data:",p);
        return probFunction(p);
    }

    // Calculate current card probabilities for every card - see selectNextCard
    // the actual card/stim (cluster/version) selection
    calculateCardProbabilities = function(callback) {
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
        if(callback) callback();
    }

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

    function updateCardAndStimData(cardIndex, whichStim){
        let card = cardProbabilities.cards[cardIndex];
        let stim = card.stims[whichStim];
        let responseText = stripSpacesAndLowerCase(Answers.getDisplayAnswerText(getStimAnswer(cardIndex,whichStim)));

        // About to show a card - record any times necessary
        card.lastSeen = Date.now();
        if (card.firstSeen < 1) {
            card.firstSeen = card.lastSeen;
        }

        stim.lastSeen = Date.now();
        if(stim.firstSeen < 1) {
          stim.firstSeen = stim.lastSeen;
        }

        if (responseText && responseText in cardProbabilities.responses) {
            resp = cardProbabilities.responses[responseText];
            resp.lastSeen = Date.now();
            if(resp.firstSeen < 1) {
                resp.firstSeen = resp.lastSeen;
            }
            if (getTestType() === 's') {
                resp.priorStudy += 1;
            }
        }
        // If this is NOT a resume (and is just normal display mode for
        // a learner) then we need to update stats for the card
        card.trialsSinceLastSeen = 0;
        card.hasBeenIntroduced = true;
        stim.hasBeenIntroduced = true;
        if (getTestType() === 's') {
            card.priorStudy += 1;
            stim.priorStudy += 1;
        }
    }

    //Our actual implementation
    return {
        saveComponentStates: async function(){
            let userId = Meteor.userId();
            let TDFId = Session.get("currentTdfId");
            let componentStates = [];
            for(let cardIndex=0;cardIndex<cardProbabilities.cards.length;cardIndex++){
                let card = cardProbabilities.cards[cardIndex];
                let cardState = {
                    userId,
                    TDFId,
                    KCId:card.clusterKC,
                    componentType:'cluster',
                    probabilityEstimate: null, //probabilityEstimates only exist for stimuli, not clusters or responses
                    firstSeen:card.firstSeen,
                    lastSeen:card.lastSeen,
                    trialsSinceLastSeen:card.trialsSinceLastSeen,
                    priorCorrect:card.priorCorrect,
                    priorIncorrect:card.priorIncorrect,
                    priorStudy:card.priorStudy,
                    totalPracticeDuration: card.totalPracticeDuration,
                    outcomeStack: card.outcomeStack.join(',')
                };
                componentStates.push(cardState);
                for(let stimIndex=0;stimIndex<card.stims.length;stimIndex++){
                    let stim = card.stims[stimIndex];
                    let stimProb = cardProbabilities.probs.find(x => x.stimIndex==stimIndex && x.cardIndex==cardIndex);
                    let stimState = {
                        userId,
                        TDFId,
                        KCId:stim.stimulusKC,
                        componentType:'stimulus',
                        probabilityEstimate: stimProb ? stimProb.probability : null,
                        firstSeen:stim.firstSeen,
                        lastSeen:stim.lastSeen,
                        priorCorrect:stim.priorCorrect,
                        priorIncorrect:stim.priorIncorrect,
                        priorStudy:stim.priorStudy,
                        totalPracticeDuration: stim.totalPracticeDuration,
                        outcomeStack: stim.outcomeStack.join(',')
                    };
                    componentStates.push(stimState);
                }
            }

            for(let responseText in cardProbabilities.responses){
                let response = cardProbabilities.responses[responseText];
                let responseState = {
                    userId,
                    TDFId,
                    componentType:'response',
                    probabilityEstimate: null, //probabilityEstimates only exist for stimuli, not clusters or responses
                    firstSeen:response.firstSeen,
                    lastSeen:response.lastSeen,
                    priorCorrect:response.priorCorrect,
                    priorIncorrect:response.priorIncorrect,
                    priorStudy:response.priorStudy,
                    totalPracticeDuration: response.totalPracticeDuration,
                    outcomeStack: response.outcomeStack.join(','),
                    responseText //not actually in db, need to lookup/assign kcid when loading
                };
                componentStates.push(responseState);
            }
            console.log("saveComponentStates",JSON.parse(JSON.stringify(componentStates)));
            await meteorCallAsync('setComponentStatesByUserIdTDFIdAndUnitNum',Meteor.userId(),Session.get("currentTdfId"),componentStates);
        },
        loadComponentStates: async function(){//componentStates [{},{}]
            console.log("loadComponentStates start");

            //TODO: is this necessary?
            let overallOutcomeHistory = Session.get("currentExperimentState").overallOutcomeHistory || [];
            initUserProgress({ overallOutcomeHistory });

            let numQuestionsAnswered = 0;
            let numCorrectAnswers = 0;
            let probsMap = {};
            let cards = cardProbabilities.cards;

            let componentStates = await meteorCallAsync('getComponentStatesByUserIdTDFIdAndUnitNum',Meteor.userId(),Session.get("currentTdfId"));
            console.log("loadComponentStates,componentStates:",componentStates)
            if(componentStates.length == 0){  //No prior history, we assume KCs could have been affected by other units using them
                let stimulusKCs = [];
                for(let curCard of cards){
                    for(let curStim of curCard.stims){
                        stimulusKCs.push(curStim.stimulusKC);
                    }
                }
                const stimProbabilityEstimates = await meteorCallAsync('getProbabilityEstimatesByKCId',stimulusKCs);
                console.log("loadcomponentstates,length==0:",cardProbabilities);
                for(let cardIndex=0;cardIndex<cards.length;cardIndex++){
                    let card = cardProbabilities.cards[cardIndex];
                    if(!probsMap[cardIndex]) probsMap[cardIndex] = {};
                    for(let stim of card.stims){
                        let stimIndex = stim.stimIndex;
                        let stimProbs = stimProbabilityEstimates.filter(x => x.kcid == stim.stimulusKC) || {};
                        stim.previousCalculatedProbabilities = stimProbs.probabilityEstimates || [];
                        if(!probsMap[cardIndex][stimIndex]) probsMap[cardIndex][stimIndex] = 0;
                    }
                }
                console.log("loadComponentStates1",cards,probsMap,componentStates,stimulusKCs,stimProbabilityEstimates)
            }else{ 
                let curKCBase = getStimKCBaseForCurrentStimuliSet();
                let componentCards = componentStates.filter(x => x.componentType == 'cluster');
                let stims = componentStates.filter(x => x.componentType == 'stimulus');
                let responses = componentStates.filter(x => x.componentType == 'response');

                let stimulusKCs = stims.map(x => x.KCId);
                const stimProbabilityEstimates = await meteorCallAsync('getProbabilityEstimatesByKCId',stimulusKCs);
                console.log("loadcomponentstates,length!=0:",cards,stims,responses,cardProbabilities);
                for(let componentCard of componentCards){
                    let clusterKC = componentCard.KCId;
                    let cardIndex = clusterKC % curKCBase;
                    let modelCard = cards[cardIndex];
                    let componentData = _.pick(componentCard,['firstSeen','lastSeen','priorCorrect','priorIncorrect','priorStudy','totalPracticeDuration']);
                    componentData.clusterKC = clusterKC;
                    componentData.outcomeStack = componentCard.outcomeStack;
                    componentData.hasBeenIntroduced = true;
                    Object.assign(modelCard,componentData);
                    let clusterProbs = stimProbabilityEstimates.filter(x => x.kcid == clusterKC) || {};
                    modelCard.previousCalculatedProbabilities = clusterProbs.probabilityEstimates || [];
                }
                for(let cardIndex=0;cardIndex<cards.length;cardIndex++){
                    let modelCard = cards[cardIndex];

                    let clusterKC = modelCard.KCId;
                    if(!probsMap[cardIndex]) probsMap[cardIndex] = {};
                    let filter1 = cards.filter(x => x.clusterKC != clusterKC);
                    modelCard.otherPracticeTime = filter1.reduce((acc,card) => acc + card.totalPracticeDuration,0);
                    let curStims = stims.filter(x => x.clusterKC == cardIndex);
                    for(let componentStim of curStims){
                        let stimulusKC = componentStim.stimulusKC % KC_MULTIPLE;
                        let modelStim = modelCard.stims.find(x => x.stimulusKC == stimulusKC);
                        Object.assign(modelStim,componentStim);
                        let stimProbs = stimProbabilityEstimates.filter(x => x.kcid == componentStim.stimulusKC) || {};
                        modelStim.otherPracticeTime = cards.reduce((acc,card) => acc + card.stims.filter(x => x.stimulusKC != stimulusKC).reduce((acc,stim) => acc + stim.totalPracticeDuration,0),0);
                        modelStim.previousCalculatedProbabilities = stimProbs.probabilityEstimates || [];
                        let stimIndex = modelStim.stimIndex;
                        if(!probsMap[cardIndex][stimIndex]) probsMap[cardIndex][stimIndex] = 0;
                        probsMap[cardIndex][stimIndex] = componentStim.probabilityEstimate;
                        numCorrectAnswers += componentStim.priorCorrect;
                        numQuestionsAnswered += componentStim.priorCorrect + componentStim.priorIncorrect;
                    }
                }

                for(let response of responses){
                    let modelResponse = Object.values(cardProbabilities.responses).find(x => x.KCId == response.KCId);
                    Object.assign(modelResponse,response);
                }
                console.log("loadComponentStates2",cards,stims,probsMap,componentStates,stimulusKCs,stimProbabilityEstimates);
            }

            var initProbs = [];
            var numQuestions = getStimCount();
            for (i = 0; i < numQuestions; ++i) {
                var cluster = getStimCluster(i);
                var numStims = cluster.stims.length;
                for (j = 0; j < numStims; ++j) {
                    initProbs.push({
                        cardIndex: i,//clusterKC
                        stimIndex: j,//whichstim/stimIndex
                        probability: probsMap[i][j] || 0
                    });
                }
            }

            Object.assign(cardProbabilities,{
                probs:initProbs,
                numQuestionsAnswered,
                numCorrectAnswers              
            });
        },
        getCardProbabilitiesNoCalc: function(){
            return cardProbabilities;
        },

        getCardProbs: function(){
          calculateCardProbabilities();
          return cardProbabilities.probs;
        },

        findCurrentCardInfo: function() {
            return currentCardInfo;
        },

        reinitializeClusterListsFromCurrentSessionData: function(){
            setUpClusterList(cardProbabilities.cards);
        },

        unitType: MODEL_UNIT,

        curUnit: (() => JSON.parse(JSON.stringify(Session.get("currentTdfUnit"))))(),

        unitMode: (function(){
          var unitMode = _.chain(this.curUnit)
              .prop("learningsession").first()
              .prop("unitMode").trim().value() || "default";
          console.log("UNIT MODE: " + unitMode);
          return unitMode;
        })(),

        initImpl: async function() {
            console.log("!!!! initImpl, curUnit:",JSON.parse(JSON.stringify(this.curUnit || "blah")));
            Session.set("unitType",MODEL_UNIT);
            initializeActRModel();
        },

        selectNextCard: async function() {
            // The cluster (card) index, the cluster version (stim index), and
            // whether or not we should show the overlearning text is determined
            // here. See calculateCardProbabilities for how prob.probability is
            // calculated
            let newProbIndex;
            let cards = cardProbabilities.cards;
            let probs = cardProbabilities.probs;

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
            let prob = cardProbabilities.probs[newProbIndex];
            let cardIndex = prob.cardIndex;
            let card = cardProbabilities.cards[cardIndex];
            let whichStim = prob.stimIndex;
            let stim = card.stims[whichStim];

            // Store calculated probability for selected stim/cluster
            let currentStimProbability = prob.probability;
            stim.previousCalculatedProbabilities.push(currentStimProbability);
            card.previousCalculatedProbabilities.push(currentStimProbability);

            // Save the card selection
            // Note that we always take the first stimulus and it's always a drill
            Session.set("clusterIndex", cardIndex);

            let clusterMapping = Session.get("clusterMapping");
            let unmappedIndex = clusterMapping.indexOf(cardIndex);
            newExperimentState = {
                clusterIndex:cardIndex,
                shufIndex:unmappedIndex,
                lastAction:'question',
                lastTimeStamp: Date.now()
            };

            //Save for returning the info later (since we don't have a schedule)
            setCurrentCardInfo(cardIndex, whichStim);
            console.log("select next card:",newProbIndex,cardIndex,whichStim);


            let stateChanges = this.setUpCardQuestionAndAnswerGlobals(cardIndex, whichStim, prob);
            newExperimentState = Object.assign(newExperimentState,stateChanges);// Find objects we'll be touching

            let testType = "d";
            if(Session.get("currentDeliveryParams").studyFirst && card.priorStudy == 0){
              console.log("!!! STUDY FOR FIRST TRIAL");
              testType = 's';
            }
            Session.set("testType", testType);
            newExperimentState.testType = testType;
            newExperimentState.questionIndex = 1;
            
            Session.set("questionIndex", 0);  //questionIndex doesn't have any meaning for a model
            Session.set("showOverlearningText", false);

            updateCardAndStimData(cardIndex, whichStim);

            // only log this for teachers/admins
            if (Roles.userIsInRole(Meteor.user(), ["admin", "teacher"])) {
                console.log(">>>BEGIN METRICS>>>>>>>");

                console.log("Overall user stats => ",
                    "total responses:", cardProbabilities.numQuestionsAnswered,
                    "total correct responses:", cardProbabilities.numCorrectAnswers
                );

                // Log selections - note that the card output will also include the stim
                console.log("Model selected prob:", displayify(prob));
                console.log("Model selected card:", displayify(card));
                console.log("Model selected stim:", displayify(stim));

                // Log time stats in human-readable form
                var elapsedStr = function(t) { return t < 1 ? 'Never Seen': secs(Date.now() - t); };
                console.log(
                    'Card First Seen:', elapsedStr(card.firstSeen),
                    'Card Last Seen:', elapsedStr(card.lastSeen),
                    'Total time in other practice:', secs(card.otherPracticeTime),
                    'Stim First Seen:', elapsedStr(stim.firstSeen),
                    'Stim Last Seen:',elapsedStr(stim.lastSeen),
                    'Stim Total time in other practice:', secs(stim.otherPracticeTime)
                );

                // Display response and current response stats
                let responseText = stripSpacesAndLowerCase(Answers.getDisplayAnswerText(getStimAnswer(cardIndex,whichStim)));
                if(responseText && responseText in cardProbabilities.responses){
                    console.log("Response is", responseText, displayify(cardProbabilities.responses[responseText]));
                }
                
                console.log("<<<END   METRICS<<<<<<<");
            }

            // It has now been officially one more trial since all the other cards
            // have been seen - and we need to do this whether or NOT we are in
            // resume mode
            _.each(cardProbabilities.cards, function(card, index) {
                if (index != cardIndex) {
                    card.trialsSinceLastSeen += 1;
                }
            });
            
            await this.saveComponentStates();
            await updateExperimentState(newExperimentState,"unitEngine.modelUnitEngine.selectNextCard");
        },

        cardAnswered: function(wasCorrect) {
            // Get info we need for updates and logic below
            let cards = cardProbabilities.cards;
            let cluster = getStimCluster(Session.get("clusterIndex"));
            let card = _.prop(cards, cluster.shufIndex);
            console.log("cardAnswered, card: " + JSON.stringify(card) + "cluster.shufIndex: " + cluster.shufIndex);

            if (card.lastSeen > 0) {
                let practice = Date.now() - card.lastSeen;
                card.totalPracticeDuration += practice;
                _.each(cards, function(otherCard, index) {
                    if(otherCard.firstSeen > 0){
                        if (index != cluster.shufIndex) {
                            otherCard.otherPracticeTime += practice;
                            _.each(otherCard.stims, function(otherStim, index){
                                otherStim.otherPracticeTime += practice;
                            });
                        }else{
                            _.each(otherCard.stims, function(otherStim, index){
                                if(index != currentCardInfo.whichStim){
                                    otherStim.otherPracticeTime += practice;
                                }
                            });
                        }
                    }
                });
            }

            // Study trials are a special case: we don't update any of the
            // metrics below. As a result, we just calculate probabilities and
            // leave. Note that the calculate call is important because this is
            // the only place we call it after init *and* something might have
            // changed during question selection
            if (getTestType() === 's') {
                calculateCardProbabilities(this.saveComponentStates);
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
                if (wasCorrect) card.priorCorrect += 1;
                else            card.priorIncorrect += 1;

                card.outcomeStack.push(wasCorrect ? 1 : 0);
                let stim = currentCardInfo.whichStim;
                if (stim >= 0 && stim < card.stims.length) {
                    if (wasCorrect) card.stims[stim].priorCorrect += 1;
                    else            card.stims[stim].priorIncorrect += 1;

                    //This is called from processUserTimesLog() so this both works in memory and restoring from userTimesLog
                    card.stims[stim].outcomeStack.push(wasCorrect ? 1 : 0);
                }
            }

            // "Response" stats
            let answerText = stripSpacesAndLowerCase(Answers.getDisplayAnswerText(cluster.stims[currentCardInfo.whichStim].correctResponse));
            if (answerText && answerText in cardProbabilities.responses) {
                let resp = cardProbabilities.responses[answerText];
                if (wasCorrect) resp.priorCorrect += 1;
                else            resp.priorIncorrect += 1;

                resp.outcomeStack.push(wasCorrect ? 1 : 0);
            } else {
                console.log("COULD NOT STORE RESPONSE METRICS",
                    answerText,
                    currentCardInfo.whichStim,
                    displayify(cluster.stims[currentCardInfo.whichStim].correctResponse),
                    displayify(cardProbabilities.responses));
            }
            if(wasCorrect && getTestType() !== "i"){
                let prog = getUserProgress();
                prog.overallOutcomeHistory.push(wasCorrect ? 1 : 0);
                let newExperimentState = {overallOutcomeHistory:prog.overallOutcomeHistory};
                updateExperimentState(newExperimentState,"unitEngine.modelUnit.cardAnswered");
            }

            // All stats gathered - calculate probabilities
            //Need a delay so that the outcomeStack arrays can be properly updated
            //before we use them in calculateCardProbabilities
            //Meteor.setTimeout(calculateCardProbabilities,20); //TODO: why did we need this?  Make sure we are calculating correct values now
            calculateCardProbabilities(this.saveComponentStates);
        },

        unitFinished: function() {
            let session = this.curUnit.learningsession;
            let minSecs = session.displayminseconds || 0;
            let maxSecs = session.displaymaxseconds || 0;

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
            let practiceSeconds = Session.get("currentDeliveryParams").practiceseconds;
            if (practiceSeconds < 1.0) {
                //Less than a second is an error or a missing values
                console.log("No Practice Time Found and display timer: user must quit with Continue button");
                return false;
            }

            let unitElapsedTime = (Date.now() - unitStartTimestamp) / 1000.0;
            console.log("Model practice check", unitElapsedTime, ">", practiceSeconds);
            return (unitElapsedTime > practiceSeconds);
        }
    };
}

//Aka assessment session
function scheduleUnitEngine(){
    let schedule;
    function createSchedule(setspec, unitNumber, unit) {
        //First get the setting we'll use
        let settings = loadAssessmentSettings(setspec, unit);
        console.log("ASSESSMENT SESSION LOADED FOR SCHEDULE CREATION");
        console.log("settings:",JSON.parse(JSON.stringify(settings)));

        //Shuffle clusters at start
        if (settings.randomClusters) {
            shuffle(settings.clusterNumbers);
        }

        //Our question array should be pre-populated
        //Remember that addressing a javascript array index forces the
        //expansion of the array to that index
        let quests = [];
        quests[settings.scheduleSize-1] = {};

        //How you set a question
        let setQuest = function(qidx, type, clusterIndex, condition, whichStim, forceButtonTrial) {
            quests[qidx] = {
                testType: type.toLowerCase(),
                clusterIndex: clusterIndex,
                condition: condition,
                whichStim : whichStim,
                forceButtonTrial: forceButtonTrial
            };
        };

        let i, j, k, z; //Loop indices

        //For each group
        for (i = 0; i < settings.groupNames.length; ++i) {
            //Get initial info for this group
            let groupName = settings.groupNames[i];
            let group = settings.groups[i]; //group = array of strings
            let numTemplates = _.intval(settings.numTemplatesList[i]);
            let templateSize = _.intval(settings.templateSizes[i]);

            //Generate template indices
            let indices = [];
            for (z = 0; z < numTemplates; ++z) {
                indices.push(z);
            }
            if (settings.randomConditions) {
                shuffle(indices);
            }

            //For each template index
            for (j = 0; j < indices.length; ++j) {
                let index = indices[j];

                //Find in initial position
                let firstPos;
                for(firstPos = 0; firstPos < settings.initialPositions.length; ++firstPos) {
                    let entry = settings.initialPositions[firstPos];
                    //Note the 1-based assumption for initial position values
                    if (groupName === entry[0] && _.intval(entry.substring(2)) == index + 1) {
                        break; //FOUND
                    }
                }

                //Remove and use first cluster no matter what
                let clusterNum = settings.clusterNumbers.shift();

                //If we didn't find the group, move to next group
                if (firstPos >= settings.initialPositions.length) {
                    break;
                }

                //Work through the group elements
                for (k = 0; k < templateSize; ++k) {
                    //"parts" is a comma-delimited entry with 4 components:
                    // 0 - the offset (whichStim) - can be numeric or "r" for random
                    // 1 - legacy was f/b, now "b" forces a button trial
                    // 2 - trial type (t, d, s, m, n, i, f)
                    // 3 - location (added to qidx)
                    var groupEntry = group[index * templateSize + k];
                    var parts = groupEntry.split(",");

                    var forceButtonTrial = false;
                    if (parts[1].toLowerCase()[0] === "b") {
                        forceButtonTrial = true;
                    }

                    var type = parts[2].toUpperCase()[0];

                    if (type === "Z") {
                        var stud = Math.floor(Math.random() * 10);
                        if (stud === 0) {
                            type = "S";
                        } else
                        {
                            type = "D";
                        }
                    }

                    var showHint = false;
                    if (parts[2].length > 1) {
                        showHint = (parts[2].toUpperCase()[1] === "H");
                    }

                    var location = _.intval(parts[3]);

                    var offStr = parts[0].toLowerCase(); //Selects stim from cluster w/ multiple stims
                    if (offStr === "m") {
                        //Trial from model
                        setQuest(firstPos + location, type, 0, "select_"+type, offStr, forceButtonTrial);
                    }
                    else {
                        //Trial by other means
                        var offset;
                        if (offStr === "r") {
                            //See loadAssessmentSettings below - ranChoices should
                            //be populated with the possible offsets already
                            if (settings.ranChoices.length < 1)
                                throw "Random offset, but randomcchoices isn't set";
                            offset = randomChoice(settings.ranChoices);
                        }
                        else {
                            offset = _.intval(offStr);
                        }

                        var condition = groupName + "-" + index;

                        var st = settings.specType.toLowerCase();
                        if ( (st === "structuralpairs" || st === "structuralgroups") ) {
                            condition += "-" + offset + "-0";
                            offset = 0;
                        }

                        if (showHint) {
                            condition += "-" + "H";
                        }

                        var pairNum = clusterNum;
                        setQuest(firstPos + location, type, pairNum, condition, offset, forceButtonTrial);
                    } //offset is Model or something else?
                } //k (walk thru group elements)
            } //j (each template index)
        } //i (each group)

        //NOW we can create the final ordering of the questions - we start with
        //a default copy and then do any final permutation
        var finalQuests = [];
        _.each(quests, function(obj) {
            finalQuests.push(obj);
        });

        // Shuffle and swap final question mapping based on permutefinalresult
        // and swapfinalresults
        if (finalQuests.length > 0) {
            var shuffles = settings.finalPermute || [""];
            var swaps = settings.finalSwap || [""];
            var mapping = _.range(finalQuests.length);

            while(shuffles.length > 0 || swaps.length > 0) {
                mapping = createStimClusterMapping(
                    finalQuests.length,
                    shuffles.shift() || "",
                    swaps.shift() || "",
                    mapping
                );
            }

            console.log("Question swap/shuffle mapping:", displayify(
                _.map(mapping, function(val, idx) {
                    return "q[" + idx + "].cluster==" + quests[idx].clusterIndex +
                      " ==> q[" + val + "].cluster==" + quests[val].clusterIndex;
                })
            ));
            for (j = 0; j < mapping.length; ++j) {
                finalQuests[j] = quests[mapping[j]];
            }
        }

        //Note that our card.js code has some fancy permutation
        //logic, but that we don't currently use it from the assessment
        //session
        var schedule = {
            unitNumber: unitNumber,
            created: new Date(),
            permute: null,
            q: finalQuests,
            isButtonTrial: settings.isButtonTrial
        };

        console.log("Created schedule for current unit:");
        console.log(schedule);

        return schedule;
    }

    //Given a unit object loaded from a TDF, populate and return a settings
    //object with the parameters as specified by the Assessment Session
    function loadAssessmentSettings(setspec, unit) {
        let settings = {
            specType: "unspecified",
            groupNames: [],
            templateSizes: [],
            numTemplatesList: [],
            initialPositions: [],
            groups: [],
            randomClusters: false,
            randomConditions: false,
            scheduleSize: 0,
            finalSwap: [""],
            finalPermute: [""],
            clusterNumbers: [],
            ranChoices: [],
            isButtonTrial: false,
        };

        if (!unit || !unit.assessmentsession) {
            return settings;
        }

        var rawAssess = _.safefirst(unit.assessmentsession);
        if (!rawAssess) {
            return settings;
        }

        //Everything comes from the asessment session as a single-value array,
        //so just parse all that right now
        var assess = {};
        _.each(rawAssess, function(val, name) {
            assess[name] = _.safefirst(val);
        });

        //Interpret TDF string booleans
        var boolVal = function(src) {
            return _.display(src).toLowerCase() === "true";
        };

        //Get the setspec settings first
        settings.specType = _.display(setspec.clustermodel);

        //We have a few parameters that we need in their "raw" states (as arrays)
        settings.finalSwap = _.prop(rawAssess, "swapfinalresult") || [""];
        settings.finalPermute = _.prop(rawAssess, "permutefinalresult") || [""];

        //The "easy" "top-level" settings
        extractDelimFields(assess.initialpositions, settings.initialPositions);
        settings.randomClusters = boolVal(assess.assignrandomclusters);
        settings.randomConditions = boolVal(assess.randomizegroups);
        settings.isButtonTrial = boolVal(_.safefirst(unit.buttontrial));

        //Unlike finalPermute, which is always a series of space-delimited
        //strings that represent rangeVals, ranChoices can be a single number N
        //(which is equivalent to [0,N) where N is that number) or a rangeVal
        //([X,Y] where the string is X-Y). SO - we convert this into a list of
        //all possible random choices
        var randomChoicesParts = [];
        extractDelimFields(assess.randomchoices, randomChoicesParts);
        _.each(randomChoicesParts, function(item) {
            if (item.indexOf('-') < 0) {
                //Single number - convert to range
                var val = _.intval(item);
                if (!val) {
                    throw "Invalid randomchoices paramter: " + assess.randomchoices;
                }
                item = "0-" + (val-1).toString();
            }

            _.each(rangeVal(item), function(subitem) {
                settings.ranChoices.push(subitem);
            });
        });

        //Condition by group, but remove the default single-val arrays
        //Note: since there could be 0-N group entries, we leave that as an array
        var by_group = {};
        _.each(assess.conditiontemplatesbygroup, function(val, name) {
            by_group[name] = name === "group" ? val : _.safefirst(val);
        });

        if (by_group) {
            extractDelimFields(by_group.groupnames,        settings.groupNames);
            extractDelimFields(by_group.clustersrepeated,  settings.templateSizes);
            extractDelimFields(by_group.templatesrepeated, settings.numTemplatesList);
            extractDelimFields(by_group.initialpositions,  settings.initialPositions);

            _.each(by_group.group, function(tdf_group) {
                var new_group = [];
                extractDelimFields(tdf_group, new_group);
                if (new_group.length > 0) {
                    settings.groups.push(new_group);
                }
            });

            if (settings.groups.length != settings.groupNames.length) {
                console.log("WARNING! Num group names doesn't match num groups", settings.groupNames, settings.groups);
            }
        }

        //Now that all possible changes to initial positions have been
        //done, we know our schedule size
        settings.scheduleSize = settings.initialPositions.length;

        const currentTdfFile = Session.get("currentTdfFile");
        const isMultiTdf = currentTdfFile.isMultiTdf;
        let unitClusterList;

        if(isMultiTdf){
            const curUnitNumber = Session.get("currentUnitNumber");
    
            //NOTE: We are currently assuming that multiTdfs will have only three units: an instruction unit, an assessment session with exactly one question which is the last
            //item in the stim file, and a unit with all clusters specified in the generated subtdfs array
            if(curUnitNumber == 1){
                const lastClusterIndex = getStimCount() - 1;
                unitClusterList = lastClusterIndex + "-" + lastClusterIndex;
            }else{
                const subTdfIndex = Session.get("subTdfIndex");
                unitClusterList = currentTdfFile.subTdfs[subTdfIndex].clusterList;
            }
        }else{
            unitClusterList = assess.clusterlist
        }

        //Cluster Numbers
        let clusterList = [];
        extractDelimFields(unitClusterList, clusterList);
        for (let i = 0; i < clusterList.length; ++i) {
            let nums = rangeVal(clusterList[i]);
            for (let j = 0; j < nums.length; ++j) {
                settings.clusterNumbers.push(_.intval(nums[j]));
            }
        }

        return settings;
    }

    return {
        unitType: SCHEDULE_UNIT,
    
        initImpl: async function() {
            //Retrieve current schedule
            console.log("CREATING SCHEDULE, showing progress",getUserProgress());
            Session.set("unitType",SCHEDULE_UNIT);

            let curUnitNum = Session.get("currentUnitNumber");
            let file = Session.get("currentTdfFile");
            const setSpec = file.tdfs.tutor.setspec[0];
            let currUnit = file.tdfs.tutor.unit[curUnitNum];

            console.log('creating schedule with params:',setSpec, curUnitNum, currUnit);
            schedule = createSchedule(setSpec, curUnitNum, currUnit);
            if (!schedule) {
                alert("There is an issue with the TDF - experiment cannot continue");
                throw new Error("There is an issue with the TDF - experiment cannot continue");
            }

            //We save the current schedule and also log it to the UserTime collection
            Session.set("schedule",schedule);

            let newExperimentState = { schedule };
            await updateExperimentState(newExperimentState,"unitEngine.getSchedule");
        },

        saveComponentStates: function(){
            //No component data for assessments
        },

        loadComponentStates: function(){
            //No component data for assessments
        },
    
        getSchedule: function() {    
            return schedule;
        },
    
        selectNextCard: async function() {
            let questionIndex = Session.get("questionIndex");
            let sched = this.getSchedule();
            let questInfo = sched.q[questionIndex];
            console.log("schedule selectNextCard",questionIndex,questInfo);
            let curClusterIndex = questInfo.clusterIndex;
            let curStimIndex = questInfo.whichStim;

            let newExperimentState = { 
                shufIndex:curClusterIndex,
                clusterIndex:curClusterIndex,
                questionIndex: questionIndex + 1, 
                whichStim: questInfo.whichStim,
                testType: questInfo.testType,
                lastAction: "question",
                lastActionTimeStamp: Date.now()
            }
    
            //Set current Q/A info, type of test (drill, test, study), and then
            //increment the session's question index number
            Session.set("clusterIndex", curClusterIndex);
    
            newExperimentState = Object.assign(newExperimentState,this.setUpCardQuestionAndAnswerGlobals(curClusterIndex, curStimIndex, undefined));
    
            Session.set("testType", questInfo.testType);
            Session.set("questionIndex", questionIndex + 1);
            Session.set("showOverlearningText", false);  //No overlearning in a schedule
    
            console.log("SCHEDULE UNIT card selection => ",
                "cluster-idx-unmapped:", curClusterIndex,
                "whichStim:", curStimIndex
            );
            
            await updateExperimentState(newExperimentState,"question");
        },
    
        findCurrentCardInfo: function() {
            //selectNextCard increments questionIndex after setting all card
            //info, so we need to use -1 for this info
            let questionIndex = Math.max(Session.get("questionIndex")-1,0);
            return this.getSchedule().q[questionIndex];
        },
    
        cardAnswered: function(wasCorrect) {
            //Nothing currently
        },
    
        unitFinished: function() {
            let questionIndex = Session.get("questionIndex");
            let curUnitNum = Session.get("currentUnitNumber");
            let schedule = null;
            if (curUnitNum < Session.get("currentTdfFile").tdfs.tutor.unit.length) {
                schedule = this.getSchedule();
            }
    
            if (schedule && questionIndex < schedule.q.length) {
                return false; // have more
            }
            else {
                return true; // nothing left
            }
        }
    }
} 
