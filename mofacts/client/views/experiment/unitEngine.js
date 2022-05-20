import {
  extractDelimFields,
  rangeVal,
  getStimCount,
  getStimCluster,
  getStimKCBaseForCurrentStimuliSet,
  getTestType,
  shuffle,
  randomChoice,
  createStimClusterMapping,
  updateCurStudentPerformance,
  getAllCurrentStimAnswers
} from '../../lib/currentTestingHelpers';
import {updateExperimentState, updateExperimentStateSync} from './card';
import {MODEL_UNIT, SCHEDULE_UNIT} from '../../../common/Definitions';
import {meteorCallAsync} from '../../index';
import {displayify} from '../../../common/globalHelpers';
import {Answers} from './answerAssess';

export {createScheduleUnit, createModelUnit, createEmptyUnit};

const blank = '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;';

async function create(func, curExperimentData) {
  const engine = _.extend(defaultUnitEngine(curExperimentData), func());
  await engine.init();
  return engine;
}

// eslint-disable-next-line no-undef
getRandomInt = function(max) {
  return Math.floor(Math.random() * max);
};

function stripSpacesAndLowerCase(input) {
  return input.replace(/ /g, '').toLowerCase();
}

function getStimAnswer(clusterIndex, whichAnswer) {
  return getStimCluster(clusterIndex).stims[whichAnswer].correctResponse;
}

async function createEmptyUnit(curExperimentData) {
  return await create(emptyUnitEngine, curExperimentData);
}

async function createModelUnit(curExperimentData) {
  return await create(modelUnitEngine, curExperimentData);
}

async function createScheduleUnit(curExperimentData) {
  return await create(scheduleUnitEngine, curExperimentData);
}

// Return an instance of the "base" engine
function defaultUnitEngine(curExperimentData) {
  const engine = {
    // Things actual engines must supply
    unitType: 'DEFAULT',
    selectNextCard: function() {
      throw new Error('Missing Implementation');
    },
    cardAnswered: async function() {
      throw new Error('Missing Implementation');
    },
    unitFinished: function() {
      throw new Error('Missing Implementation');
    },
    calculateIndices: function() {
      throw new Error('Missing Implementation');
    },
    saveComponentStates: async function() { },
    loadComponentStates: async function() { },

    // Optional functions that engines can replace if they want
    initImpl: async function() { },
    // reinitializeClusterListsFromCurrentSessionData: function() { },

    // Functions we supply
    init: async function() {
      console.log('Engine created for unit:', this.unitType);
      await this.initImpl();
    },

    replaceClozeWithSyllables: function(question, currentAnswerSyllables, origAnswer, hintLevel) {
      console.log('replaceClozeWithSyllables1: ', question, currentAnswerSyllables, origAnswer);
      if (!question || question.indexOf('_') == -1) {
        return {
          clozeQuestion: undefined,
          clozeMissingSyllables: undefined,
        };
      }

      let clozeAnswer = '';
      let clozeMissingSyllables = '';
      const syllablesArray = currentAnswerSyllables.syllableArray;
      if(syllablesArray.length <= 2){
        hintLevel = 0;
      }
      Session.set('hintLevel', hintLevel);
      let reconstructedAnswer = '';
      let clozeAnswerOnlyUnderscores = '';
      let clozeAnswerNoUnderscores = '';
      let originalAnswerArray = origAnswer.split(' ');

      // eslint-disable-next-line guard-for-in
      for (let index in syllablesArray) {
        index = parseInt(index); 

        // Handle underscores for syllable array elements that contain whitespace
        
        if(index >= hintLevel){
          clozeMissingSyllables += syllablesArray[index];
          if (syllablesArray[index].indexOf(' ') >= 0) {
            clozeAnswer += `___ ______`;
            clozeAnswerOnlyUnderscores += `___ ______`;
          } else {
            clozeAnswer += `___`;
            clozeAnswerOnlyUnderscores += `___`;
          }
        } else {
          clozeAnswer += syllablesArray[index];
          clozeAnswerNoUnderscores += syllablesArray[index];
        }

        reconstructedAnswer += syllablesArray[index];
        let nextChar = reconstructedAnswer.length;
        while (origAnswer.charAt(nextChar) == ' ') {
          clozeAnswer += ' ';
          reconstructedAnswer += ' ';
          clozeMissingSyllables += ' ';
          clozeAnswerOnlyUnderscores += ' ';
          clozeAnswerNoUnderscores += ' ';
          nextChar = reconstructedAnswer.length;
        }
      }
      
      clozeAnswerParts = clozeAnswer.split(' ');
      for(let part of clozeAnswerParts.length){
        if(part == 0 && hintLevel > 0){
          clozeAnswerParts[part] = clozeAnswerParts[part].replace(/([_]+[ ]?)+/, `<u>${blank}</u>`);
        }
        else{
          clozeAnswerParts[part] = clozeAnswerParts[part].replace(/([_]+[ ]?)+/, `<u>${blank + blank}</u>`);
        }
        console.log(part);
      }
      clozeAnswer = clozeAnswerParts.join(' ');
      // eslint-disable-next-line prefer-const
      let clozeQuestionParts = question.split(/([_]+[ ]?)+/);

      // If our third cloze part begins with an underscore,
      // our second cloze part should be our syllables, so
      // if the answer sans underscores doesn't end in whitespace,
      // remove leading whitespace from part 3
      
      if (clozeQuestionParts[2].trim().charAt(0) === '_' &&
                clozeAnswerNoUnderscores.slice(-1) != ' ') {
        clozeQuestionParts[2] = clozeQuestionParts[2].trim();
      }
      var regex = /([_]+[ ]?)+/ig;
      const clozeQuestion = question.replace(regex, '<u>' + clozeAnswer.split(' ').join('</u> <u>') + '</u> ');
      clozeQuestionParts = clozeQuestion;

      console.log('replaceClozeWithSyllables2:', clozeQuestion, clozeMissingSyllables, clozeQuestionParts,
          clozeAnswerNoUnderscores, clozeAnswerOnlyUnderscores);
      return {clozeQuestion, clozeMissingSyllables, clozeQuestionParts, hintLevel, reconstructedAnswer};
    },

    setUpCardQuestionSyllables: function(currentQuestion, currentQuestionPart2,
        currentStimAnswer, probFunctionParameters, hintLevel) {
      console.log('setUpCardQuestionSyllables: ', currentQuestion, currentQuestionPart2,
          currentStimAnswer, probFunctionParameters);
      let currentAnswer = currentStimAnswer;
      let clozeQuestionParts = undefined;
      let currentAnswerSyllables = undefined;
      let currentStimAnswerWordCount = currentStimAnswer.split(' ').length;

      // For now this distinguishes model engine from schedule engine, which doesn't do syllable replacement
      if (probFunctionParameters) {
        console.log('getSubClozeAnswerSyllables, displaySyllableIndices/hintsylls: ', probFunctionParameters.hintsylls,
            ', this.cachedSyllables: ', this.cachedSyllables);
        const answer = currentStimAnswer.replace(/\./g, '_');
        if (!this.cachedSyllables || !this.cachedSyllables.data[answer]) {
            if(!this.cachedSyllables.data[answer]){
              console.log('no syllable data for that answer, throw error');
              const currentStimuliSetId = Session.get('currentStimuliSetId');
              const curAnswers = getAllCurrentStimAnswers();
              Meteor.call('updateStimSyllableCache', currentStimuliSetId, curAnswers, function(){});
              alert('Something went wrong generating hints. Please report this error to the administrator and restart your trial');
          } else {
            //We assume no hints were generated initially, meaning the tdf didn't have hints to start.
            console.log('no syllable index or cachedSyllables, defaulting to no subclozeanswer');
            console.log(typeof(probFunctionParameters.hintsylls),
                !this.cachedSyllables,
                (probFunctionParameters.hintsylls || []).length);
          }
        } else {
          currentAnswerSyllables = {
            count: this.cachedSyllables.data[answer].count,
            syllableArray: this.cachedSyllables.data[answer].syllables,
          };
        }

        if (currentAnswerSyllables) {
          const {clozeQuestion, clozeMissingSyllables, clozeQuestionParts: cQuestionParts, reconstructedAnswer} =
              this.replaceClozeWithSyllables(currentQuestion, currentAnswerSyllables, currentStimAnswer,hintLevel);
          if (clozeQuestion) {
            currentQuestion = clozeQuestion;
            currentAnswer = reconstructedAnswer;
            clozeQuestionParts = cQuestionParts;
            console.log('clozeQuestionParts:', cQuestionParts);
            const {clozeQuestion2, clozeMissingSyllables2, hintlevel2} =
                this.replaceClozeWithSyllables( currentQuestionPart2, currentAnswerSyllables, currentStimAnswer, hintLevel);
            if (clozeQuestion2) {
              currentQuestionPart2 = clozeQuestion2;
            }
            // TODO we should use clozeMissingSyllables2 probably,
            // doubtful that syllables will work with two part questions for now
          }
        } 
      }else{
        let answerLocation = currentQuestion.indexOf(' _');
        if(answerLocation != -1){
          var regex = regex = / _/gi, result, indecies = [];
          while ( (result = regex.exec(currentQuestion)) ) {
            indecies.push(result.index);
          }
          for(index in indecies){
            let answerBlanks = ""
            currentQuestion = currentQuestion.replaceAll("_","");
            for(i=0;i<currentStimAnswerWordCount;i++){
              answerBlanks += `&nbsp;<u>${blank + blank}</u>`;
            }
            currentQuestion = currentQuestion.slice(0,index) + answerBlanks + currentQuestion.slice(index);
          }
        }
      }

      console.log('setUpCardQuestionSyllables:', currentQuestion, currentQuestionPart2,
          currentAnswerSyllables, clozeQuestionParts, currentAnswer);
      return {currentQuestionPostSylls: currentQuestion, currentQuestionPart2PostSylls: currentQuestionPart2,
        currentAnswerSyllables, clozeQuestionParts, currentAnswer, hintLevel};
    },

    setUpCardQuestionAndAnswerGlobals: async function(cardIndex, whichStim, whichHintLevel = 0, probFunctionParameters) {
      const newExperimentState = {};
      Session.set('alternateDisplayIndex', undefined);
      const cluster = getStimCluster(cardIndex);
      console.log('setUpCardQuestionAndAnswerGlobals', cardIndex, whichStim, probFunctionParameters,
          cluster, cluster.stims[whichStim], whichHintLevel);
      const curStim = cluster.stims[whichStim];
      let currentDisplay = JSON.parse(JSON.stringify({
        text: curStim.textStimulus,
        audioSrc: curStim.audioStimulus,
        imgSrc: curStim.imageStimulus,
        videoSrc: curStim.videoStimulus,
        clozeText: curStim.clozeStimulus || curStim.clozeText,
      }));
      if (curStim.alternateDisplays) {
        const numPotentialDisplays = curStim.alternateDisplays.length + 1;
        const displayIndex = Math.floor(numPotentialDisplays * Math.random());
        if (displayIndex < curStim.alternateDisplays.length) {
          Session.set('alternateDisplayIndex', displayIndex);
          newExperimentState.alternateDisplayIndex = displayIndex;
          const curAltDisplay = curStim.alternateDisplays[displayIndex];
          currentDisplay = JSON.parse(JSON.stringify({
            text: curAltDisplay.textStimulus,
            audioSrc: curAltDisplay.audioStimulus,
            imgSrc: curAltDisplay.imageStimulus,
            videoSrc: curAltDisplay.videoStimulus,
            clozeText: curAltDisplay.clozeStimulus || curAltDisplay.clozeText,
          }));
        }
      }
      const originalDisplay = JSON.parse(JSON.stringify(currentDisplay));
      Session.set('originalDisplay', originalDisplay);
      newExperimentState.originalDisplay = originalDisplay;

      let currentQuestion = currentDisplay.clozeText || currentDisplay.text;
      let currentQuestionPart2 = undefined;
      let currentStimAnswer = getStimAnswer(cardIndex, whichStim);

      const correctAnswer = Answers.getDisplayAnswerText(currentStimAnswer);
      const cacheWords = await meteorCallAsync('getMatchingDialogueCacheWordsForAnswer', correctAnswer);
      Session.set('dialogueCacheHint', cacheWords.join(','));

      Session.set('originalAnswer', currentStimAnswer);
      newExperimentState.originalAnswer = currentStimAnswer;
      currentStimAnswer = currentStimAnswer.toLowerCase();

      // If we have a dual prompt question populate the spare data field
      if (currentQuestion && currentQuestion.indexOf('|') != -1) {
        const prompts = currentQuestion.split('|');
        currentQuestion = prompts[0];
        currentQuestionPart2 = prompts[1];
      }
      Session.set('originalQuestion', currentQuestion);
      Session.set('originalQuestion2', currentQuestionPart2);
      newExperimentState.originalQuestion = currentQuestion;
      newExperimentState.originalQuestion2 = currentQuestionPart2;

      const {
        currentQuestionPostSylls,
        currentQuestionPart2PostSylls,
        currentAnswerSyllables,
        clozeQuestionParts,
        currentAnswer,
      } = this.setUpCardQuestionSyllables(currentQuestion, currentQuestionPart2, currentStimAnswer,
          probFunctionParameters, whichHintLevel);
      
      console.log('HintLevel: setUpCardQuestionAndAnswerGlobals',whichHintLevel);  
      console.log('setUpCardQuestionAndAnswerGlobals2:', currentQuestionPostSylls, currentQuestionPart2PostSylls);
      console.log('setUpCardQuestionAndAnswerGlobals3:', currentAnswerSyllables, clozeQuestionParts, currentAnswer);

      if (currentAnswerSyllables) {
        curStim.answerSyllables = currentAnswerSyllables;
        curStim.hintLevel = whichHintLevel;
      }

      Session.set('currentAnswerSyllables', currentAnswerSyllables);
      Session.set('currentAnswer', currentAnswer);
      Session.set('clozeQuestionParts', clozeQuestionParts);
      Session.set('currentQuestionPart2', currentQuestionPart2PostSylls);
      newExperimentState.currentAnswerSyllables = currentAnswerSyllables;
      newExperimentState.currentAnswer = currentAnswer;
      newExperimentState.clozeQuestionParts = clozeQuestionParts || null;
      newExperimentState.currentQuestionPart2 = currentQuestionPart2PostSylls;
      newExperimentState.hintLevel = Session.get('hintLevel');

      if (currentDisplay.clozeText) {
        currentDisplay.clozeText = currentQuestionPostSylls;
      } else if (currentDisplay.text) {
        currentDisplay.text = currentQuestionPostSylls;
      }

      Session.set('currentDisplayEngine', currentDisplay);
      newExperimentState.currentDisplayEngine = currentDisplay;

      return newExperimentState;
    },
  };
  engine.experimentState = curExperimentData.experimentState;
  engine.cachedSyllables = curExperimentData.cachedSyllables;
  console.log('curExperimentData:', curExperimentData);
  return engine;
}

// ////////////////////////////////////////////////////////////////////////////
// Return an instance of a unit with NO question/answer's (instruction-only)
function emptyUnitEngine() {
  return {
    unitType: 'instruction-only',
    initImpl: function() { },
    unitFinished: function() {
      return true;
    },
    selectNextCard: function() { },
    findCurrentCardInfo: function() { },
    cardAnswered: async function() { },
  };
}

// ////////////////////////////////////////////////////////////////////////////
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

// TODO: pass in all session variables possible
function modelUnitEngine() {
  console.log('model unit engine created!!!');
  // Checked against practice seconds. Notice that we capture this on unit
  // creation, so if they leave in the middle of practice and come back to
  // the unit we'll start all over.
  const unitStartTimestamp = Date.now();

  function getStimParameterArray(clusterIndex, whichStim) {
    return getStimCluster(clusterIndex).stims[whichStim].params.split(',').map((x) => _.floatval(x));
  }

  const currentCardInfo = {
    testType: 'd',
    clusterIndex: -1,
    whichStim: -1,
    whichHintLevel: -1,
    forceButtonTrial: false,
    probabilityEstimate: -1,
  };

  function setCurrentCardInfo(clusterIndex, whichStim, whichHintLevel) {
    currentCardInfo.clusterIndex = clusterIndex;
    currentCardInfo.whichStim = whichStim;
    currentCardInfo.whichHintLevel = whichHintLevel;
    currentCardInfo.probabilityEstimate = cardProbabilities.cards[clusterIndex].stims[whichStim].probabilityEstimate;
    console.log('MODEL UNIT card selection => ',
        'cluster-idx:', clusterIndex,
        'whichStim:', whichStim,
        'whichHintLevel:', whichHintLevel,
        'parameter', getStimParameterArray(clusterIndex, whichStim),
    );
  }

  // Initialize card probabilities, with optional initial data
  let cardProbabilities = [];
  function initCardProbs(overrideData) {
    let initVals = {
      numQuestionsAnswered: 0,
      numQuestionsAnsweredCurrentSession: 0,
      numCorrectAnswers: 0,
      cards: [],
    };

    if (overrideData) {
      initVals = _.extend(initVals, overrideData);
    }
    cardProbabilities = initVals;
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
    p.baseLevel = 1 / Math.pow(1 + p.questionSecsPracticingOthers +
          ((p.questionSecsSinceFirstShown - p.questionSecsPracticingOthers) * 0.00785), 0.2514);

    p.meanSpacing = 0;

    if (p.questionStudyTrialCount + p.questionTotalTests == 1) {
      p.meanspacing = 1;
    } else {
      if (p.questionStudyTrialCount + p.questionTotalTests > 1) {
        p.meanSpacing = Math.max(
            1, Math.pow((p.questionSecsSinceFirstShown - p.questionSecsSinceLastShown) /
                (p.questionStudyTrialCount + p.questionTotalTests - 1), 0.0294),
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
    p.probability = 1.0 / (1.0 + Math.exp(-p.y)); // Actual probability

    return p;
  }

  // See if they specified a probability function
  const unit = Session.get('currentTdfUnit');
  let probFunction = undefined;
  if (unit.learningsession) 
    probFunction = unit.learningsession.calculateProbability ? unit.learningsession.calculateProbability.trim() : undefined;
  const probFunctionHasHintSylls = typeof(probFunction) == 'undefined' ? false : probFunction.indexOf('hintsylls') > -1;
  console.log('probFunctionHasHintSylls: ' + probFunctionHasHintSylls, typeof(probFunction));
  if (probFunction) {
    probFunction = new Function('p', '\'use strict\';\n' + probFunction); // jshint ignore:line
  } else {
    probFunction = defaultProbFunction;
  }

  function findMinProbCardAndHintLevel(cards, hiddenItems) {
    console.log('findMinProbCard');
    let currentMin = 1.00001;
    let clusterIndex=-1;
    let stimIndex=-1;
    let hintLevelIndex=-1;

    for (let i=0; i<cards.length; i++) {
      const card = cards[i];
      if (!card.canUse || !(card.trialsSinceLastSeen > 1)) {
        continue;
      } else {
        const stimCluster = getStimCluster(i);
        for (let j=0; j<card.stims.length; j++) {
          const stim = card.stims[j];
          if (hiddenItems.includes(stim.stimulusKC)) continue;
          if (stim.probabilityEstimate <= currentMin) {
            currentMin = stim.probabilityEstimate;
            clusterIndex=i;
            stimIndex=j;
            hintLevelIndex=0;
          }
          if(stimCluster.stims[j].textStimulus || stimCluster.stims[j].clozeStimulus){
            for(let k=0; k<stim.hintLevelProbabilites.length; k++){
              if(stim.hintLevelProbabilites[k] <= currentMin){
                currentMin = stim.hintLevelProbabilites[k];
                hintLevelIndex = k;
                stimIndex = j;
                clusterIndex=i;
              }
            }
          }
        }
      }
    }

    if (clusterIndex == -1) { // Fallback in case we run low on eligible cards
      for (let i=0; i<cards.length; i++) {
        const card = cards[i];
        if (!card.canUse) {
          continue;
        } else {
          const stimCluster = getStimCluster(i);
          for (let j=0; j<card.stims.length; j++) {
            const stim = card.stims[j];
            if (hiddenItems.includes(stim.stimulusKC)) continue;
            if (stim.probabilityEstimate <= currentMin) {
              currentMin = stim.probabilityEstimate;
              stimIndex = j;
              clusterIndex=i;
              hintLevelIndex=0;
            }
            if(stimCluster.stims[j].textStimulus || stimCluster.stims[j].clozeStimulus){
              for(let k=0; k<stim.hintLevelProbabilites.length; k++){
                if(stim.hintLevelProbabilites[k] <= currentMin){
                  currentMin = stim.hintLevelProbabilites[k];
                  hintLevelIndex = k;
                  stimIndex = j;
                  clusterIndex=i;
                }
              }
            }
          }
        }
      }
    }
    const stim = cards[clusterIndex].stims[stimIndex]


    return {clusterIndex, stimIndex, hintLevelIndex};
  }

  function findMaxProbCardAndHintLevel(cards, ceiling, hiddenItems) {
    console.log('findMaxProbCardAndHintLevel');
    let currentMax = 0;
    let clusterIndex=-1;
    let stimIndex=-1;
    let hintLevelIndex=-1;

    for (let i=0; i<cards.length; i++) {
      const card = cards[i];
      if (!card.canUse || !(card.trialsSinceLastSeen > 1)) {
        continue;
      } else {
        const stimCluster = getStimCluster(i);
        for (let j=0; j<card.stims.length; j++) {
          const stim = card.stims[j];
          if (hiddenItems.includes(stim.stimulusKC)) continue;
          if (stim.probabilityEstimate > currentMax && stim.probabilityEstimate < ceiling) {
            currentMax = stim.probabilityEstimate;
            clusterIndex=i;
            stimIndex=j;
            hintLevelIndex = 0;
          }
          if(stimCluster.stims[j].textStimulus || stimCluster.stims[j].clozeStimulus){
            for(let k=0; k<stim.hintLevelProbabilites.length; k++){
              if(stim.hintLevelProbabilites[k] > currentMax && stim.hintLevelProbabilites[k] < ceiling ){
                currentMax = stim.hintLevelProbabilites[k];
                clusterIndex=i;
                stimIndex=j;
                hintLevelIndex = k;
              }
            }
          }
        }
      }
    }
    const stim = cards[clusterIndex].stims[stimIndex];

    return {clusterIndex, stimIndex, hintLevelIndex};
  }

  function findMinProbDistCard(cards, hiddenItems) {
    console.log('findMinProbDistCard');
    let currentMin = 50.0;
    let clusterIndex=-1;
    let stimIndex=-1;
    let hintLevelIndex=-1;
    let optimalProb;

    for (let i=0; i<cards.length; i++) {
      const card = cards[i];
      if (!card.canUse || !(card.trialsSinceLastSeen > 1)) {
        continue;
      } else {
        const stimCluster = getStimCluster(i);
        for (let j=0; j<card.stims.length; j++) {
          const stim = card.stims[j];
          if (hiddenItems.includes(stim.stimulusKC)) continue;
          const parameters = stim.parameter;
          optimalProb = Math.log(parameters[1]/(1-parameters[1]));
          if (!optimalProb) {
            // console.log("NO OPTIMAL PROB SPECIFIED IN STIM, DEFAULTING TO 0.90");
            optimalProb = 0.90;
          }
          const dist = Math.abs(Math.log(stim.probabilityEstimate/(1-stim.probabilityEstimate)) - optimalProb);
          if (dist <= currentMin) {
            currentMin = dist;
            clusterIndex=i;
            stimIndex=j;
            hintLevelIndex = 0;
          }
          if(stimCluster.stims[j].textStimulus || stimCluster.stims[j].clozeStimulus){
            for(let k=0; k<Math.min(stim.hintLevelProbabilites.length, 3); k++){
              let hintDist = Math.abs(Math.log(stim.hintLevelProbabilites[k]/(1-stim.hintLevelProbabilites[k])) - optimalProb);
              if(hintDist < currentMin){
                currentMin = hintDist;
                clusterIndex=i;
                stimIndex=j;
                hintLevelIndex = k;
              }
            }
          }
        }
      }
    }
    const stim = cards[clusterIndex].stims[stimIndex];

    return {clusterIndex, stimIndex, hintLevelIndex};
  }

  function findMaxProbCardThresholdCeilingPerCard(cards, hiddenItems) {
    console.log('findMaxProbCardThresholdCeilingPerCard');
    let currentMax = 0;
    let clusterIndex=-1;
    let stimIndex=-1;
    let hintLevelIndex=-1;

    for (let i=0; i<cards.length; i++) {
      const card = cards[i];
      if (!card.canUse || !(card.trialsSinceLastSeen > 1)) {
        continue;
      } else {
        const stimCluster = getStimCluster(i);
        for (let j=0; j<card.stims.length; j++) {
          const stim = card.stims[j];
          if (hiddenItems.includes(stim.stimulusKC)) continue;
          const parameters = stim.parameter;
          let thresholdCeiling=parameters[1];
          if (!thresholdCeiling) {
            //  console.log("NO THRESHOLD CEILING SPECIFIED IN STIM, DEFAULTING TO 0.90");
            thresholdCeiling = 0.90;
          }
          if (stim.probabilityEstimate > currentMax && stim.probabilityEstimate < thresholdCeiling) {
            currentMax = stim.probabilityEstimate;
            clusterIndex=i;
            stimIndex=j;
            hintLevelIndex=0;
          }
          if(stimCluster.stims[j].textStimulus || stimCluster.stims[j].clozeStimulus){
            for(let k=0; k<stim.hintLevelProbabilites.length; k++){
              if(stim.hintLevelProbabilites[k] > currentMax && stim.hintLevelProbabilites[k] < thresholdCeiling ){
                currentMax = stim.hintLevelProbabilites[k];
                clusterIndex=i;
                stimIndex=j;
                hintLevelIndex = k;
              }
            }
          }
        }
      }
    }
    const stim = cards[clusterIndex].stims[stimIndex];

    return {clusterIndex, stimIndex, hintLevelIndex};
  }

  function updateCardAndStimData(cardIndex, whichStim) {
    const card = cardProbabilities.cards[cardIndex];
    const stim = card.stims[whichStim];
    const responseText = stripSpacesAndLowerCase(Answers.getDisplayAnswerText(getStimAnswer(cardIndex, whichStim)));

    // Record instructions answer to card
    cardProbabilities.instructionQuestionResult = Session.get('instructionQuestionResults');
    
    // About to show a card - record any times necessary
    card.lastSeen = Date.now();
    if (card.firstSeen < 1) {
      card.firstSeen = card.lastSeen;
    }

    stim.lastSeen = Date.now();
    if (stim.firstSeen < 1) {
      stim.firstSeen = stim.lastSeen;
    }

    if (responseText && responseText in cardProbabilities.responses) {
      const resp = cardProbabilities.responses[responseText];
      resp.lastSeen = Date.now();
      if (resp.firstSeen < 1) {
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

  // Our actual implementation
  return {


    // Calculate current card probabilities for every card - see selectNextCard
    // the actual card/stim (cluster/version) selection
    calculateCardProbabilities: function calculateCardProbabilities() {
      let count=0;
      let hintLevelIndex = 1;
      let parms;
      const ptemp=[];
      const tdfDebugLog=[];
      for (let i=0; i<cardProbabilities.cards.length; i++) {
        const card = cardProbabilities.cards[i];
        const stimCluster = getStimCluster(i);
        for (let j=0; j<card.stims.length; j++) {
          const stim = card.stims[j];
          const hintLevelProbabilities = [];
          const currentStimuliSetId = Session.get('currentStimuliSetId');
          const stimAnswer = stimCluster.stims[j].correctResponse
          let answerText = Answers.getDisplayAnswerText(stimAnswer).toLowerCase();
          //Detect Hint Levels
          if (!this.cachedSyllables.data || !this.cachedSyllables.data[answerText]) {
            hintLevelIndex = 1;
            console.log('no cached syllables for: ' + currentStimuliSetId + ' | ' + answerText + '. hintlevel index is 1.');
          } else {
            const stimSyllableData = this.cachedSyllables.data[answerText];
            hintLevelIndex = stimSyllableData.count;
            console.log('syllables detected for: ' + currentStimuliSetId + ' | ' + answerText + '. hintlevel index is ' + hintLevelIndex);
          }
          parms = this.calculateSingleProb(i, j, 0, count, stimCluster);
          tdfDebugLog.push(parms.debugLog);
          
          if(stimCluster.stims[j].textStimulus || stimCluster.stims[j].clozeStimulus){
            for(let k=0; k<Math.min(hintLevelIndex, 3); k++){
              let hintLevelParms = this.calculateSingleProb(i, j, k, count, stimCluster);
              hintLevelProbabilities.push(hintLevelParms.probability);
              console.log('cluster: ' + i + ', card: ' + j + ', input hintlevel: ' + k + ', output hintLevel: ' + hintLevelParms.hintLevel + ', output probability: ' + hintLevelParms.probability) + ', debug message:' + hintLevelParms.debugLog;
            }
            stim.hintLevelProbabilites = hintLevelProbabilities;
            console.log('hintLevel probabilities', hintLevelProbabilities);
          }
          stim.probFunctionParameters = parms;
          stim.probabilityEstimate = parms.probability;
          if(!typeof stim.probabilityEstimate == "number"){
            throw 'Error: Probability Estimate is undefined, NaN, or less than or equal to 0.';
          }
          ptemp[count]=Math.round(100*parms.probability)/100;
          count++;           
        }
      }
      console.log('calculateCardProbabilities', JSON.stringify(ptemp));
    },

    // Given a single item from the cardProbabilities, calculate the
    // current probability. IMPORTANT: this function only returns ALL parameters
    // used which include probability. The caller is responsible for storing it.
    calculateSingleProb: function calculateSingleProb(cardIndex, stimIndex, hintLevel, i, stimCluster) {
      const card = cardProbabilities.cards[cardIndex];
      const stim = card.stims[stimIndex];

      // Store parameters in an object for easy logging/debugging
      const p = {};

      p.i = i;

      // Current Indices
      p.clusterIndex = cardIndex;
      p.stimIndex = stimIndex;
      p.hintLevel = hintLevel;

      // Top-level metrics
      p.userTotalResponses = cardProbabilities.numQuestionsAnswered;
      p.userCorrectResponses = cardProbabilities.numCorrectAnswers;
      
      // Instruction metrics
      p.instructionQuestionResult = card.instructionQuestionResult;

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
      p.stim = stimCluster.stims[stimIndex];

      p.stimSuccessCount = stim.priorCorrect;
      p.stimFailureCount = stim.priorIncorrect;
      p.stimStudyTrialCount = stim.priorStudy;
      const stimAnswer = stimCluster.stims[stimIndex].correctResponse;
      let answerText = Answers.getDisplayAnswerText(stimAnswer).toLowerCase();
      p.stimResponseText = stripSpacesAndLowerCase(answerText); // Yes, lowercasing here is redundant. TODO: fix/cleanup
      const currentStimuliSetId = Session.get('currentStimuliSetId');
      answerText = answerText.replace(/\./g, '_');
      p.answerText = answerText;

      if (probFunctionHasHintSylls) {
        if (!this.cachedSyllables.data || !this.cachedSyllables.data[answerText]) {
          console.log('no cached syllables for: ' + currentStimuliSetId + '|' + answerText);
          throw new Error('can\'t find syllable data in database');
        } else {
          const stimSyllableData = this.cachedSyllables.data[answerText];
          p.syllables = stimSyllableData.count;
          p.syllablesArray = stimSyllableData.syllables;
        }
      }
     
      p.resp = cardProbabilities.responses[p.stimResponseText];
      p.responseSuccessCount = p.resp.priorCorrect;
      p.responseFailureCount = p.resp.priorIncorrect;
      p.responseOutcomeHistory = JSON.parse(JSON.stringify(p.resp.outcomeStack));
      p.responseSecsSinceLastShown = elapsed(p.resp.lastSeen);
      p.responseStudyTrialCount = p.resp.priorStudy;

      p.stimParameters = stimCluster.stims[stimIndex].params.split(',').map((x) => _.floatval(x));

      p.clusterPreviousCalculatedProbabilities = JSON.parse(JSON.stringify(card.previousCalculatedProbabilities));
      p.clusterOutcomeHistory = JSON.parse(JSON.stringify(card.outcomeStack));

      p.stimPreviousCalculatedProbabilities = JSON.parse(JSON.stringify(stim.previousCalculatedProbabilities));
      p.stimOutcomeHistory = JSON.parse(JSON.stringify(stim.outcomeStack));

      p.overallOutcomeHistory = Session.get('overallOutcomeHistory');

      if (p.i<15) {
        console.log('cardProbability parameters:', JSON.parse(JSON.stringify(p)));
      }
      return probFunction(p);
    },

    // TODO: do this function without side effects on cards
    setUpClusterList: function setUpClusterList(cards) {
      const currentTdfFile = Session.get('currentTdfFile');
      const isMultiTdf = currentTdfFile.isMultiTdf;
      const clusterList = [];

      if (isMultiTdf) {
        const curUnitNumber = Session.get('currentUnitNumber');

        // NOTE: We are currently assuming that multiTdfs will have only three units:
        // an instruction unit, an assessment session with exactly one question which is the last
        // item in the stim file, and a unit with all clusters specified in the generated subtdfs array
        if (curUnitNumber == 2) {
          const subTdfIndex = Session.get('subTdfIndex');
          if (typeof(subTdfIndex) == 'undefined') {
            console.log('assuming we are in studentReporting, therefore ignoring the clusterlists'); // TODO, make this an explicit argument and error when it happens if we don't pass in the argument
          } else {
            const unitClusterList = currentTdfFile.subTdfs[subTdfIndex].clusterList;
            extractDelimFields(unitClusterList, clusterList);
          }
        } else if (curUnitNumber > 2) {
          throw new Error('We shouldn\'t ever get here, dynamic tdf cluster list error');
        }
      } else {
          const sessCurUnit = JSON.parse(JSON.stringify(Session.get('currentTdfUnit')));
          // Figure out which cluster numbers that they want
          console.log('setupclusterlist:', this.curUnit, sessCurUnit);
          let unitClusterList = "";
          // TODO: shouldn't need both
          if(this.curUnit && this.curUnit.learningsession && this.curUnit.learningsession.clusterlist){
            unitClusterList = this.curUnit.learningsession.clusterlist.trim()
          }
          else if (sessCurUnit && sessCurUnit.learningsession && sessCurUnit.learningsession.clusterlist){
            unitClusterList = sessCurUnit.learningsession.clusterlist.trim();
        }
        extractDelimFields(unitClusterList, clusterList);
      }
      console.log('clusterList', clusterList);
      for (let i = 0; i < clusterList.length; ++i) {
        const nums = rangeVal(clusterList[i]);
        for (let j = 0; j < nums.length; ++j) {
          cards[_.intval(nums[j])].canUse = true;
        }
      }
      console.log('setupClusterList,cards:', cards);
    },

    // Initialize cards as we'll need them for the created engine (for current
    // model). Note that we assume TDF/Stimulus is set up and correct - AND
    // that we've already turned off cluster mapping. You'll note that although
    // we nest stims under cards, we maintain a "flat" list of probabilities -
    // this is to speed up calculations and make iteration below easier
    initializeActRModel: async function() {
      let i; let j;
      const numQuestions = getStimCount();
      const initCards = [];
      const initResponses = {};
      const initProbs = [];
      const curKCBase = getStimKCBaseForCurrentStimuliSet();
      let stimulusKC = curKCBase;
      console.log('initializeActRModel', numQuestions, curKCBase);
      const reponseKCMap = await meteorCallAsync('getReponseKCMap');
      console.log('initializeActRModel,reponseKCMap', reponseKCMap);
      for (i = 0; i < numQuestions; ++i) {
        const card = {
          clusterKC: (curKCBase + i),
          hintLevel: null,
          priorCorrect: 0,
          priorIncorrect: 0,
          curSessionPriorCorrect: 0,
          curSessionPriorIncorrect: 0,
          hasBeenIntroduced: false,
          outcomeStack: [],
          lastSeen: 0,
          firstSeen: 0,
          totalPracticeDuration: 0,
          otherPracticeTime: 0,
          previousCalculatedProbabilities: [],
          priorStudy: 0,
          trialsSinceLastSeen: 3, // We start at >2 for initial logic (see findMin/Max functions below)
          canUse: false,
          stims: [],
          instructionQuestionResult: null,
        };

        // We keep per-stim and re-response-text results as well
        const cluster = getStimCluster(i);
        const numStims = cluster.stims.length;
        for (j = 0; j < numStims; ++j) {
          // Note this may be a single element array for older stims or a 3 digit array for newer ones
          const parameter = getStimParameterArray(i, j);
          // Per-stim counts
          card.stims.push({
            clusterKC: (curKCBase + i),
            stimIndex: j,
            stimulusKC,
            hintLevel: 0,
            priorCorrect: 0,
            priorIncorrect: 0,
            curSessionPriorCorrect: 0,
            curSessionPriorIncorrect: 0,
            hasBeenIntroduced: false,
            outcomeStack: [],
            lastSeen: 0,
            firstSeen: 0,
            totalPracticeDuration: 0,
            otherPracticeTime: 0,
            previousCalculatedProbabilities: [],
            priorStudy: 0,
            parameter: parameter,
            instructionQuestionResult: null,
          });
          stimulusKC += 1;

          initProbs.push({
            cardIndex: i,
            stimIndex: j,
            probability: 0,
          });

          // Per-response counts
          const rawResponse = cluster.stims[j].correctResponse;
          const response = stripSpacesAndLowerCase(Answers.getDisplayAnswerText(rawResponse));
          if (!(response in initResponses)) {
            initResponses[response] = {
              KCId: reponseKCMap[response],
              hintLevel: null,
              priorCorrect: 0,
              priorIncorrect: 0,
              curSessionPriorCorrect: 0,
              curSessionPriorIncorrect: 0,
              firstSeen: 0,
              lastSeen: 0,
              totalPracticeDuration: 0,
              priorStudy: 0,
              outcomeStack: [],
              instructionQuestionResult: null,
            };
          }
        }

        initCards.push(card);
      }

      this.setUpClusterList(initCards);

      // Re-init the card probabilities
      initCardProbs({
        cards: initCards, // List of cards (each of which has stims)
        responses: initResponses, // Dictionary of text responses for
      });

      console.log('initCards:', initCards, initProbs);

      // has to be done once ahead of time to give valid values for the beginning of the test.
      // calculateCardProbabilities();
    },

    saveComponentStatesSync: function() {
      const userId = Meteor.userId();
      const TDFId = Session.get('currentTdfId');
      const componentStates = [];
      for (let cardIndex=0; cardIndex<cardProbabilities.cards.length; cardIndex++) {
        const card = cardProbabilities.cards[cardIndex];
        const cardState = {
          userId,
          TDFId,
          KCId: card.clusterKC,
          componentType: 'cluster',
          probabilityEstimate: null, // probabilityEstimates only exist for stimuli, not clusters or responses
          firstSeen: card.firstSeen,
          lastSeen: card.lastSeen,
          hintLevel: null,
          trialsSinceLastSeen: card.trialsSinceLastSeen,
          priorCorrect: card.priorCorrect,
          priorIncorrect: card.priorIncorrect,
          curSessionPriorCorrect: 0,
          curSessionPriorIncorrect: 0,
          priorStudy: card.priorStudy,
          totalPracticeDuration: card.totalPracticeDuration,
          outcomeStack: card.outcomeStack.join(','),
          instructionQuestionResult: Session.get('instructionQuestionResult'),
        };
        componentStates.push(cardState);
        for (let stimIndex=0; stimIndex<card.stims.length; stimIndex++) {
          const stim = card.stims[stimIndex];
          const stimState = {
            userId,
            TDFId,
            KCId: stim.stimulusKC,
            componentType: 'stimulus',
            probabilityEstimate: stim.probabilityEstimate, // : stimProb ? stimProb.probability : null,
            firstSeen: stim.firstSeen,
            lastSeen: stim.lastSeen,
            hintLevel: Session.get('hintLevel') || null,
            priorCorrect: stim.priorCorrect,
            priorIncorrect: stim.priorIncorrect,
            curSessionPriorCorrect: stim.curSessionPriorCorrect,
            curSessionPriorIncorrect: stim.curSessionPriorIncorrect,
            priorStudy: stim.priorStudy,
            totalPracticeDuration: stim.totalPracticeDuration,
            outcomeStack: stim.outcomeStack.join(','),
            instructionQuestionResult: null,
          };
          componentStates.push(stimState);
        }
      }

      for (const [responseText, response] of Object.entries(cardProbabilities.responses)) {
        const responseState = {
          userId,
          TDFId,
          hintLevel: null,
          componentType: 'response',
          probabilityEstimate: null, // probabilityEstimates only exist for stimuli, not clusters or responses
          firstSeen: response.firstSeen,
          lastSeen: response.lastSeen,
          priorCorrect: response.priorCorrect,
          priorIncorrect: response.priorIncorrect,
          curSessionPriorCorrect: 0,
          curSessionPriorIncorrect: 0,
          priorStudy: response.priorStudy,
          totalPracticeDuration: response.totalPracticeDuration,
          outcomeStack: response.outcomeStack.join(','),
          responseText, // not actually in db, need to lookup/assign kcid when loading
          instructionQuestionResult: null,
        };
        componentStates.push(responseState);
      }
      console.log('saveComponentStates', componentStates);
      try{
        if(!Meteor.user().profile.impersonating){
          Meteor.call('setComponentStatesByUserIdTDFIdAndUnitNum',
              Meteor.userId(), Session.get('currentTdfId'), componentStates);
        }
      }
      catch (error){
        console.error("Error saving componentstate.", error);
        console.log('Component state may not have saved. Ending the trial now.');
        alert('An unexpected error occured. Please check your internet connection and try again. The error has been reported to the administrators.');
        const curUser = Meteor.userId();
        const curPage = document.location.pathname;
        const sessionVars = Session.all();
        const userAgent = navigator.userAgent;
        const logs = console.logs;
        const currentExperimentState = Session.get('currentExperimentState');
        Meteor.call('sendUserErrorReport', curUser, error, curPage, sessionVars,
            userAgent, logs, currentExperimentState);
        Router.go('/profile');
      }
    },
    loadComponentStates: async function() {// componentStates [{},{}]
      console.log('loadComponentStates start');

      let numQuestionsAnswered = 0;
      let numQuestionsAnsweredCurrentSession = 0;
      let numCorrectAnswers = 0;
      const probsMap = {};
      const cards = cardProbabilities.cards;
      let hiddenItems = Session.get('hiddenItems');
      if (hiddenItems === undefined) hiddenItems = []

      const componentStates = await meteorCallAsync('getComponentStatesByUserIdTDFIdAndUnitNum',
          Meteor.userId(), Session.get('currentTdfId'));
      console.log('loadComponentStates,componentStates:', componentStates);

      const clusterStimKCs = {};
      for (let i=0; i<cards.length; i++) {
        const stimKCs = [];
        for (let j=0; j<cards[i].stims.length; j++) {
          stimKCs.push(cards[i].stims[j].stimulusKC);
        }
        clusterStimKCs[i] = stimKCs;
      }

      const probabilityEstimates = await meteorCallAsync('getProbabilityEstimatesByKCId', clusterStimKCs);
      const stimProbabilityEstimates = probabilityEstimates.individualStimProbs;
      const clusterProbabilityEstimates = probabilityEstimates.clusterProbs;

      // No prior history, we assume KCs could have been affected by other units using them
      if (componentStates.length == 0) {
        console.log('loadcomponentstates,length==0:', cardProbabilities);
        for (let cardIndex=0; cardIndex<cards.length; cardIndex++) {
          const card = cardProbabilities.cards[cardIndex];
          if (!probsMap[cardIndex]) probsMap[cardIndex] = {};
          for (const stim of card.stims) {
            const stimIndex = stim.stimIndex;
            probsMap[cardIndex][stimIndex] = 0;
          }
        }
        console.log('loadComponentStates1', cards, probsMap, componentStates, clusterStimKCs, stimProbabilityEstimates);
      } else {
        const curKCBase = getStimKCBaseForCurrentStimuliSet();
        const componentCards = componentStates.filter((x) => x.componentType == 'cluster');
        const stims = componentStates.filter((x) => x.componentType == 'stimulus');
        const responses = componentStates.filter((x) => x.componentType == 'response');

        console.log('loadcomponentstates,length!=0:', cards, stims, responses, cardProbabilities);
        for (const componentCard of componentCards) {
          const clusterKC = componentCard.KCId;
          const cardIndex = clusterKC % curKCBase;
          const componentData = _.pick(componentCard,
              ['firstSeen', 'lastSeen', 'outcomeStack','hintLevel', 'priorCorrect', 'priorIncorrect', 'priorStudy',
                'totalPracticeDuration', 'trialsSinceLastSeen']);
          componentData.clusterKC = clusterKC;
          Object.assign(cards[cardIndex], componentData);
          cards[cardIndex].hasBeenIntroduced = componentData.firstSeen > 0;
          if (clusterProbabilityEstimates[cardIndex] && clusterProbabilityEstimates[cardIndex].length > 0) {
            cards[cardIndex].previousCalculatedProbabilities = clusterProbabilityEstimates[cardIndex];
          }
        }
        for (let cardIndex=0; cardIndex<cards.length; cardIndex++) {
          if (!probsMap[cardIndex]) probsMap[cardIndex] = {};
          const clusterStimKCs = cards[cardIndex].stims.map((x) => x.stimulusKC);
          const curStims = stims.filter((x) => clusterStimKCs.findIndex((y) => y == x.KCId) != -1);
          for (const componentStim of curStims) {
            const stimulusKC = componentStim.KCId;
            const stimIndex = cards[cardIndex].stims.findIndex((x) => x.stimulusKC == stimulusKC);
            const componentStimData = _.pick(componentStim,
                ['firstSeen', 'lastSeen', 'outcomeStack','hintLevel', 'priorCorrect', 'priorIncorrect', 'curSessionPriorCorrect', 'curSessionPriorIncorrect', 'priorStudy',
                  'totalPracticeDuration']);
            Object.assign(cards[cardIndex].stims[stimIndex], componentStimData);
            cards[cardIndex].stims[stimIndex].hasBeenIntroduced = componentStim.firstSeen > 0;
            const stimProbs = stimProbabilityEstimates[stimulusKC] || [];
            if (stimProbs && stimProbs.length > 0) {
              cards[cardIndex].stims[stimIndex].previousCalculatedProbabilities = stimProbs;
            }
            if (!probsMap[cardIndex][stimIndex]) probsMap[cardIndex][stimIndex] = 0;
            probsMap[cardIndex][stimIndex] = componentStimData.probabilityEstimate;
            numCorrectAnswers += componentStimData.priorCorrect;
            numQuestionsAnswered += componentStimData.priorCorrect + componentStimData.priorIncorrect;
            numQuestionsAnsweredCurrentSession += componentStimData.curSessionPriorCorrect + componentStimData.curSessionPriorIncorrect;
          }
        }
        for (let cardIndex=0; cardIndex<cards.length; cardIndex++) {
          const clusterKC = cards[cardIndex].clusterKC;
          const filter1 = cards.filter((x) => x.clusterKC != clusterKC);
          cards[cardIndex].otherPracticeTime = filter1.reduce((acc, card) => acc + card.totalPracticeDuration, 0);
          for (let stimIndex=0; stimIndex<cards[cardIndex].stims.length; stimIndex++) {
            const stimulusKC = cards[cardIndex].stims[stimIndex].stimulusKC;
            cards[cardIndex].stims[stimIndex].otherPracticeTime = cards.reduce((acc, card) => acc +
                card.stims.filter((x) => x.stimulusKC != stimulusKC).reduce((acc, stim) => acc +
                    stim.totalPracticeDuration, 0), 0);
          }
        }

        for (const response of responses) {
          const modelResponse = Object.values(cardProbabilities.responses).find((x) => x.KCId == response.KCId);
          Object.assign(modelResponse, response);
        }
        console.log('loadComponentStates2', cards, stims, probsMap, componentStates,
            clusterStimKCs, stimProbabilityEstimates);
      }

      const initProbs = [];
      const numQuestions = getStimCount();
      for (let i = 0; i < numQuestions; ++i) {
        const cluster = getStimCluster(i);
        const numStims = cluster.stims.length;
        for (let j = 0; j < numStims; ++j) {
          initProbs.push({
            cardIndex: i, // clusterKC
            stimIndex: j, // whichstim/stimIndex
            probability: probsMap[i][j] || 0,
          });
        }
      }

      let numVisibleCards = 0;
      for (let i = 0; i < cardProbabilities.cards.length; i++){
        if(cardProbabilities.cards[i].canUse){
          numVisibleCards += cardProbabilities.cards[i].stims.length;
        }
      }
      Session.set('numVisibleCards', numVisibleCards - hiddenItems.length);

      Object.assign(cardProbabilities, {
        numQuestionsAnswered,
        numQuestionsAnsweredCurrentSession,
        numCorrectAnswers,
      });
      const cardIndex = Session.get('currentExperimentState').shufIndex;
      const whichStim = Session.get('currentExperimentState').whichStim;
      const whichHintLevel = Session.get('currentExperimentState').whichHintLevel;
      setCurrentCardInfo(cardIndex, whichStim, whichHintLevel);
    },
    getCardProbabilitiesNoCalc: function() {
      return cardProbabilities;
    },

    findCurrentCardInfo: function() {
      return currentCardInfo;
    },

    // reinitializeClusterListsFromCurrentSessionData: function(){
    //     setUpClusterList(cardProbabilities.cards);
    // },

    unitType: MODEL_UNIT,

    curUnit: (() => JSON.parse(JSON.stringify(Session.get('currentTdfUnit'))))(),

    unitMode: (function() {
      const unit = Session.get('currentTdfUnit');
      let unitMode = 'default';
      if(unit.learningsession && unit.learningsession.unitMode){
        unitMode = unit.learningsession.unitMode.trim();
      }
      console.log('UNIT MODE: ' + unitMode);
      return unitMode;
    })(),

    initImpl: async function() {
      Session.set('unitType', MODEL_UNIT);
      await this.initializeActRModel();
    },

    calculateIndices: async function() {
      this.calculateCardProbabilities();
      const hiddenItems = Session.get('hiddenItems');
      const cards = cardProbabilities.cards;
      switch (this.unitMode) {
        case 'thresholdCeiling':
          indices = findMaxProbCardThresholdCeilingPerCard(cards, hiddenItems);
          console.log('thresholdCeiling, indicies:', JSON.parse(JSON.stringify(indices)));
          if (indices.clusterIndex === -1) {
            console.log('thresholdCeiling failed, reverting to min prob');
            indices = findMinProbCardAndHintLevel(cards, hiddenItems);
          }
          break;
        case 'distance':
          indices = findMinProbDistCard(cards, hiddenItems);
          break;
        case 'highest':
          // Magic number to indicate there is no real ceiling (probs should max out at 1.0)
          indices = findMaxProbCardAndHintLevel(cards, 1.00001, hiddenItems);
          if (indices.clusterIndex === -1) {
            indices = findMinProbCardAndHintLevel(cards, hiddenItems);
          }
          break;
        default:
          indices = findMaxProbCardAndHintLevel(cards, 0.90, hiddenItems);
          if (indices.clusterIndex === -1) {
            indices = findMinProbCardAndHintLevel(cards, hiddenItems);
          }
          break;
      }
      return indices;
    },

    selectNextCard: async function(indices) {
      // The cluster (card) index, the cluster version (stim index), and
      // whether or not we should show the overlearning text is determined
      // here. See calculateCardProbabilities for how prob.probability is
      // calculated
      let newClusterIndex = -1;
      let newStimIndex = -1;
      let newHintLevel = -1;

      console.log('selectNextCard unitMode: ' + this.unitMode);

      if(indices === undefined || indices === null){
        console.log('indices unset, calculating now')
        indices = await this.calculateIndices();
      }

      newClusterIndex = indices.clusterIndex;
      newStimIndex = indices.stimIndex;
      newHintLevel = indices.hintLevelIndex;

      console.log('selectNextCard indices:', newClusterIndex, newStimIndex, newHintLevel, indices);
      // Found! Update everything and grab a reference to the card and stim
      const cardIndex = newClusterIndex;
      const card = cardProbabilities.cards[cardIndex];
      const whichStim = newStimIndex;
      const whichHintLevel = newHintLevel;
      const stim = card.stims[whichStim];

      // Save the card selection
      // Note that we always take the first stimulus and it's always a drill
      Session.set('clusterIndex', cardIndex);

      const clusterMapping = Session.get('clusterMapping');
      const unmappedIndex = clusterMapping.indexOf(cardIndex);
      let newExperimentState = {
        clusterIndex: cardIndex,
        shufIndex: unmappedIndex,
        lastAction: 'question',
        lastTimeStamp: Date.now(),
        whichStim: whichStim,
        whichHintLevel: whichHintLevel
      };

      // Save for returning the info later (since we don't have a schedule)
      setCurrentCardInfo(cardIndex, whichStim, whichHintLevel);
      console.log('select next card:', cardIndex, whichStim, whichHintLevel);
      console.log('currentCardInfo:', JSON.parse(JSON.stringify(this.findCurrentCardInfo())));


      const stateChanges = await this.setUpCardQuestionAndAnswerGlobals(cardIndex, whichStim, whichHintLevel,
          stim.probFunctionParameters);
      console.log('selectNextCard,', Session.get('clozeQuestionParts'), stateChanges);
      newExperimentState = Object.assign(newExperimentState, stateChanges);// Find objects we'll be touching

      let testType = 'd';
      if (Session.get('currentDeliveryParams').studyFirst && card.priorStudy == 0) {
        console.log('STUDY FOR FIRST TRIAL !!!');
        testType = 's';
      }
      Session.set('testType', testType);
      newExperimentState.testType = testType;
      newExperimentState.questionIndex = 1;

      Session.set('questionIndex', 0); // questionIndex doesn't have any meaning for a model
      Session.set('showOverlearningText', false);

      updateCardAndStimData(cardIndex, whichStim);

      // only log this for teachers/admins
      if (Roles.userIsInRole(Meteor.user(), ['admin', 'teacher'])) {
        console.log('>>>BEGIN METRICS>>>>>>>');

        console.log('Overall user stats => ',
            'total responses:', cardProbabilities.numQuestionsAnswered,
            'total correct responses:', cardProbabilities.numCorrectAnswers,
        );

        // Log selections - note that the card output will also include the stim
        console.log('Model selected card:', displayify(card));
        console.log('Model selected stim:', displayify(stim));

        // Log time stats in human-readable form
        const elapsedStr = function(t) {
          return t < 1 ? 'Never Seen': secs(Date.now() - t);
        };
        console.log(
            'Card First Seen:', elapsedStr(card.firstSeen),
            'Card Last Seen:', elapsedStr(card.lastSeen),
            'Total time in other practice:', secs(card.otherPracticeTime),
            'Stim First Seen:', elapsedStr(stim.firstSeen),
            'Stim Last Seen:', elapsedStr(stim.lastSeen),
            'Stim Total time in other practice:', secs(stim.otherPracticeTime),
        );

        // Display response and current response stats
        const responseText = stripSpacesAndLowerCase(Answers.getDisplayAnswerText(getStimAnswer(cardIndex, whichStim)));
        if (responseText && responseText in cardProbabilities.responses) {
          console.log('Response is', responseText, displayify(cardProbabilities.responses[responseText]));
        }

        console.log('<<<END   METRICS<<<<<<<');
      }

      // It has now been officially one more trial since all the other cards
      // have been seen - and we need to do this whether or NOT we are in
      // resume mode
      _.each(cardProbabilities.cards, function(card, index) {
        if (index != cardIndex && card.hasBeenIntroduced) {
          card.trialsSinceLastSeen += 1;
        }
      });

      try {
        this.saveComponentStatesSync();
        updateExperimentState(newExperimentState, 'unitEngine.modelUnitEngine.selectNextCard');
      } catch (e) {
        console.log('error in select next card server calls:', e);
        throw new Error('error in select next card server calls:', e);
      }
    },

    cardAnswered: async function(wasCorrect, practiceTime) {
      // Get info we need for updates and logic below
      const cards = cardProbabilities.cards;
      const cluster = getStimCluster(Session.get('clusterIndex'));
      const card = _.prop(cards, cluster.shufIndex);
      console.log('cardAnswered, card: ', card, 'cluster.shufIndex: ', cluster.shufIndex);

      _.each(cards, function(otherCard, index) {
        if (otherCard.firstSeen > 0) {
          if (index != cluster.shufIndex) {
            otherCard.otherPracticeTime += practiceTime;
            _.each(otherCard.stims, function(otherStim, index) {
              otherStim.otherPracticeTime += practiceTime;
            });
          } else {
            _.each(otherCard.stims, function(otherStim, index) {
              if (index != currentCardInfo.whichStim) {
                otherStim.otherPracticeTime += practiceTime;
              }
            });
          }
        }
      });

      const {whichStim} = this.findCurrentCardInfo();
      const stim = card.stims[whichStim];
      stim.totalPracticeDuration += practiceTime;

      updateCurStudentPerformance(wasCorrect, practiceTime);

      // Study trials are a special case: we don't update any of the
      // metrics below. As a result, we just calculate probabilities and
      // leave. Note that the calculate call is important because this is
      // the only place we call it after init *and* something might have
      // changed during question selection
      if (getTestType() === 's') {
        this.saveComponentStatesSync();
        return;
      }

      // "Global" stats
      cardProbabilities.numQuestionsAnswered += 1;
      cardProbabilities.numQuestionsAnsweredCurrentSession += 1;
      if (wasCorrect) {
        cardProbabilities.numCorrectAnswers += 1;
      }

      const currentStimProbability = stim.probabilityEstimate;
      stim.previousCalculatedProbabilities.push(currentStimProbability);
      card.previousCalculatedProbabilities.push(currentStimProbability);

      console.log('cardAnswered, curTrialInfo:', currentStimProbability, card, stim);
      if (wasCorrect) card.priorCorrect += 1;
      else card.priorIncorrect += 1;

      card.outcomeStack.push(wasCorrect ? 1 : 0);

      if (wasCorrect) {
        stim.priorCorrect += 1;
        stim.curSessionPriorCorrect += 1;
      }
      else {
        stim.priorIncorrect += 1;
        stim.curSessionPriorIncorrect += 1;
      }

      // This is called from processUserTimesLog() so this both works in memory and restoring from userTimesLog
      stim.outcomeStack.push(wasCorrect ? 1 : 0);

      // "Response" stats
      const answerText = stripSpacesAndLowerCase(Answers.getDisplayAnswerText(
          cluster.stims[currentCardInfo.whichStim].correctResponse));
      if (answerText && answerText in cardProbabilities.responses) {
        const resp = cardProbabilities.responses[answerText];
        if (wasCorrect) resp.priorCorrect += 1;
        else resp.priorIncorrect += 1;

        resp.outcomeStack.push(wasCorrect ? 1 : 0);
      } else {
        console.log('COULD NOT STORE RESPONSE METRICS',
            answerText,
            currentCardInfo.whichStim,
            displayify(cluster.stims[currentCardInfo.whichStim].correctResponse),
            displayify(cardProbabilities.responses));
      }

      this.saveComponentStatesSync();
    },

    unitFinished: function() {
      const session = this.curUnit.learningsession;
      const minSecs = session.displayminseconds || 0;
      const maxSecs = session.displaymaxseconds || 0;
      const maxTrials = parseInt(session.maxTrials || 0);
      const numTrialsSoFar = cardProbabilities.numQuestionsAnsweredCurrentSession || 0;

      if (maxTrials > 0 && numTrialsSoFar >= maxTrials) {
        Meteor.call('resetCurSessionTrialsCount', Meteor.userId(), Session.get('currentTdfId'))
        return true;
      }

      // TODO: why are we using side effects to handle the unit being finished? Fix this
      if (minSecs > 0.0 || maxSecs > 0.0) {
        // We ignore practice seconds if displayXXXseconds are specified:
        // that means the unit will be over when the timer is exceeded
        // or the user clicks a button. Either way, that's handled outside
        // the engine
        return false;
      }

      // TODO: we should probably remove this as it's been superceded by displayminseconds/displaymaxseconds
      // If we're still here, check practice seconds
      const practiceSeconds = Session.get('currentDeliveryParams').practiceseconds;
      if (practiceSeconds < 1.0) {
        // Less than a second is an error or a missing values
        console.log('No Practice Time Found and display timer: user must quit with Continue button');
        return false;
      }

      const unitElapsedTime = (Date.now() - unitStartTimestamp) / 1000.0;
      console.log('Model practice check', unitElapsedTime, '>', practiceSeconds);
      return (unitElapsedTime > practiceSeconds);
    },
  };
}

// Aka assessment session
function scheduleUnitEngine() {
  let schedule;
  function createSchedule(setspec, unitNumber, unit) {
    // First get the setting we'll use
    const settings = loadAssessmentSettings(setspec, unit);
    console.log('ASSESSMENT SESSION LOADED FOR SCHEDULE CREATION');
    console.log('settings:', settings);

    // Shuffle clusters at start
    if (settings.randomClusters) {
      shuffle(settings.clusterNumbers);
    }

    // Our question array should be pre-populated
    // Remember that addressing a javascript array index forces the
    // expansion of the array to that index
    const quests = [];
    quests[settings.scheduleSize-1] = {};

    // How you set a question
    const setQuest = function(qidx, type, clusterIndex, condition, whichStim, forceButtonTrial) {
      quests[qidx] = {
        testType: type.toLowerCase(),
        clusterIndex: clusterIndex,
        condition: condition,
        whichStim: whichStim,
        forceButtonTrial: forceButtonTrial,
      };
    };

    let i; let j; let k; let z; // Loop indices

    // For each group
    for (i = 0; i < settings.groupNames.length; ++i) {
      // Get initial info for this group
      const groupName = settings.groupNames[i];
      const group = settings.groups[i]; // group = array of strings
      const numTemplates = _.intval(settings.numTemplatesList[i]);
      const templateSize = _.intval(settings.templateSizes[i]);

      // Generate template indices
      const indices = [];
      for (z = 0; z < numTemplates; ++z) {
        indices.push(z);
      }
      if (settings.randomConditions) {
        shuffle(indices);
      }

      // For each template index
      for (j = 0; j < indices.length; ++j) {
        const index = indices[j];

        // Find in initial position
        let firstPos;
        for (firstPos = 0; firstPos < settings.initialPositions.length; ++firstPos) {
          const entry = settings.initialPositions[firstPos];
          // Note the 1-based assumption for initial position values
          if (groupName === entry[0] && _.intval(entry.substring(2)) == index + 1) {
            break; // FOUND
          }
        }

        // Remove and use first cluster no matter what
        const clusterNum = settings.clusterNumbers.shift();

        // If we didn't find the group, move to next group
        if (firstPos >= settings.initialPositions.length) {
          break;
        }

        // Work through the group elements
        for (k = 0; k < templateSize; ++k) {
          // "parts" is a comma-delimited entry with 4 components:
          // 0 - the offset (whichStim) - can be numeric or "r" for random
          // 1 - legacy was f/b, now "b" forces a button trial
          // 2 - trial type (t, d, s, m, n, i, f)
          // 3 - location (added to qidx)
          const groupEntry = group[index * templateSize + k];
          const parts = groupEntry.split(',');

          let forceButtonTrial = false;
          if (parts[1].toLowerCase()[0] === 'b') {
            forceButtonTrial = true;
          }

          let type = parts[2].toUpperCase()[0];
          if (type === 'Z') {
            const stud = Math.floor(Math.random() * 10);
            if (stud === 0) {
              type = 'S';
            } else {
              type = 'D';
            }
          }

          let showHint = false;
          if (parts[2].length > 1) {
            showHint = (parts[2].toUpperCase()[1] === 'H');
          }

          const location = _.intval(parts[3]);

          const offStr = parts[0].toLowerCase(); // Selects stim from cluster w/ multiple stims
          if (offStr === 'm') {
            // Trial from model
            setQuest(firstPos + location, type, 0, 'select_'+type, offStr, forceButtonTrial);
          } else {
            // Trial by other means
            let offset;
            if (offStr === 'r') {
              // See loadAssessmentSettings below - ranChoices should
              // be populated with the possible offsets already
              if (settings.ranChoices.length < 1) {
                throw new Error('Random offset, but randomcchoices isn\'t set');
              }
              offset = randomChoice(settings.ranChoices);
            } else {
              offset = _.intval(offStr);
            }
            let condition = groupName + '-' + index;

            const pairNum = clusterNum;
            setQuest(firstPos + location, type, pairNum, condition, offset, forceButtonTrial);
          } // offset is Model or something else?
        } // k (walk thru group elements)
      } // j (each template index)
    } // i (each group)

    // NOW we can create the final ordering of the questions - we start with
    // a default copy and then do any final permutation
    const finalQuests = [];
    _.each(quests, function(obj) {
      finalQuests.push(obj);
    });

    // Shuffle and swap final question mapping based on permutefinalresult
    // and swapfinalresults
    if (finalQuests.length > 0) {
      const shuffles = settings.finalPermute.split(' ');
      const swaps = settings.finalSwap.split(' ');
      let mapping = _.range(finalQuests.length);

      while (shuffles.length > 0 || swaps.length > 0) {
        mapping = createStimClusterMapping(
            finalQuests.length,
            shuffles.shift() || '',
            swaps.shift() || '',
            mapping,
        );
      }

      console.log('Question swap/shuffle mapping:', displayify(
          _.map(mapping, function(val, idx) {
            return 'q[' + idx + '].cluster==' + quests[idx].clusterIndex +
                      ' ==> q[' + val + '].cluster==' + quests[val].clusterIndex;
          }),
      ));
      for (j = 0; j < mapping.length; ++j) {
        finalQuests[j] = quests[mapping[j]];
      }
    }

    // Note that our card.js code has some fancy permutation
    // logic, but that we don't currently use it from the assessment
    // session
    const schedule = {
      unitNumber: unitNumber,
      created: new Date(),
      permute: null,
      q: finalQuests,
      isButtonTrial: settings.isButtonTrial,
    };

    console.log('Created schedule for current unit:');
    console.log(schedule);

    return schedule;
  }

  // Given a unit object loaded from a TDF, populate and return a settings
  // object with the parameters as specified by the Assessment Session
  function loadAssessmentSettings(setspec, unit) {
    const settings = {
      specType: 'unspecified',
      groupNames: [],
      templateSizes: [],
      numTemplatesList: [],
      initialPositions: [],
      groups: [],
      randomClusters: false,
      randomConditions: false,
      scheduleSize: 0,
      finalSwap: [''],
      finalPermute: [''],
      clusterNumbers: [],
      ranChoices: [],
      isButtonTrial: false,
    };

    if (!unit || !unit.assessmentsession) {
      return settings;
    }

    const assess = unit.assessmentsession;

    // Interpret TDF string booleans
    const boolVal = function(src) {
      return _.display(src).toLowerCase() === 'true';
    };

    // Get the setspec settings first
    settings.finalSwap = assess.swapfinalresult || '';
    settings.finalPermute = assess.permutefinalresult || '';

    // The "easy" "top-level" settings
    extractDelimFields(assess.initialpositions, settings.initialPositions);
    settings.randomClusters = boolVal(assess.assignrandomclusters);
    settings.randomConditions = boolVal(assess.randomizegroups);
    settings.isButtonTrial = boolVal(unit.buttontrial);

    // Unlike finalPermute, which is always a series of space-delimited
    // strings that represent rangeVals, ranChoices can be a single number N
    // (which is equivalent to [0,N) where N is that number) or a rangeVal
    // ([X,Y] where the string is X-Y). SO - we convert this into a list of
    // all possible random choices
    const randomChoicesParts = [];
    extractDelimFields(assess.randomchoices, randomChoicesParts);
    _.each(randomChoicesParts, function(item) {
      if (item.indexOf('-') < 0) {
        // Single number - convert to range
        const val = _.intval(item);
        if (!val) {
          throw new Error('Invalid randomchoices paramter: ' + assess.randomchoices);
        }
        item = '0-' + (val-1).toString();
      }

      _.each(rangeVal(item), function(subitem) {
        settings.ranChoices.push(subitem);
      });
    });

    // Condition by group, but remove the default single-val arrays
    // Note: since there could be 0-N group entries, we leave that as an array
    const byGroup = {};
    _.each(assess.conditiontemplatesbygroup, function(val, name) {
      byGroup[name] = val;
    });

    if (byGroup) {
      extractDelimFields(byGroup.groupnames, settings.groupNames);
      extractDelimFields(byGroup.clustersrepeated, settings.templateSizes);
      extractDelimFields(byGroup.templatesrepeated, settings.numTemplatesList);
      extractDelimFields(byGroup.initialpositions, settings.initialPositions);

      // Group can be either string or array. If its just a string then we need to pass it into settings as an array. 
      if(settings.groupNames.length > 1){
      _.each(byGroup.group, function(tdfGroup) {
        const newGroup = [];
        extractDelimFields(tdfGroup, newGroup);
        if (newGroup.length > 0) {
          settings.groups.push(newGroup);
        }
      });
    }
    else{
      const newGroup = []
      extractDelimFields(byGroup.group, newGroup);
      if (newGroup.length > 0) {
        settings.groups.push(newGroup);
      }
    }

//      extractDelimFields(byGroup.group, settings.groups);

      if (settings.groups.length != settings.groupNames.length) {
        console.log('WARNING! Num group names doesn\'t match num groups', settings.groupNames, settings.groups);
      }
    }

    // Now that all possible changes to initial positions have been
    // done, we know our schedule size
    settings.scheduleSize = settings.initialPositions.length;

    const currentTdfFile = Session.get('currentTdfFile');
    const isMultiTdf = currentTdfFile.isMultiTdf;
    let unitClusterList;

    if (isMultiTdf) {
      const curUnitNumber = Session.get('currentUnitNumber');

      // NOTE: We are currently assuming that multiTdfs will have only three units:
      // an instruction unit, an assessment session with exactly one question which is the last
      // item in the stim file, and a unit with all clusters specified in the generated subtdfs array
      if (curUnitNumber == 1) {
        const lastClusterIndex = getStimCount() - 1;
        unitClusterList = lastClusterIndex + '-' + lastClusterIndex;
      } else {
        const subTdfIndex = Session.get('subTdfIndex');
        unitClusterList = currentTdfFile.subTdfs[subTdfIndex].clusterList;
      }
    } else {
      unitClusterList = assess.clusterlist;
    }

    // Cluster Numbers
    const clusterList = [];
    extractDelimFields(unitClusterList, clusterList);
    for (let i = 0; i < clusterList.length; ++i) {
      const nums = rangeVal(clusterList[i]);
      for (let j = 0; j < nums.length; ++j) {
        settings.clusterNumbers.push(_.intval(nums[j]));
      }
    }

    return settings;
  }

  return {
    unitType: SCHEDULE_UNIT,

    initImpl: async function() {
      // Retrieve current schedule
      Session.set('unitType', SCHEDULE_UNIT);

      const curUnitNum = Session.get('currentUnitNumber');
      const file = Session.get('currentTdfFile');
      const setSpec = file.tdfs.tutor.setspec;
      const currUnit = file.tdfs.tutor.unit[curUnitNum];

      console.log('creating schedule with params:', setSpec, curUnitNum, currUnit);
      schedule = createSchedule(setSpec, curUnitNum, currUnit);
      if (!schedule) {
        alert('There is an issue with the TDF - experiment cannot continue');
        throw new Error('There is an issue with the TDF - experiment cannot continue');
      }

      // We save the current schedule and also log it to the UserTime collection
      Session.set('schedule', schedule);

      const newExperimentState = {schedule};
      await updateExperimentState(newExperimentState, 'unitEngine.getSchedule');
    },

    saveComponentStates: async function() {
      // No component data for assessments
    },

    loadComponentStates: async function() {
      // No component data for assessments
    },

    getSchedule: function() {
      return schedule;
    },

    selectNextCard: async function() {
      const questionIndex = Session.get('questionIndex');
      const sched = this.getSchedule();
      const questInfo = sched.q[questionIndex];
      console.log('schedule selectNextCard', questionIndex, questInfo);
      const curClusterIndex = questInfo.clusterIndex;
      const curStimIndex = questInfo.whichStim;

      let newExperimentState = {
        shufIndex: curClusterIndex,
        clusterIndex: curClusterIndex,
        questionIndex: questionIndex + 1,
        whichStim: questInfo.whichStim,
        testType: questInfo.testType,
        lastAction: 'question',
        lastActionTimeStamp: Date.now(),
      };

      // Set current Q/A info, type of test (drill, test, study), and then
      // increment the session's question index number
      Session.set('clusterIndex', curClusterIndex);

      const stateChanges = await this.setUpCardQuestionAndAnswerGlobals(curClusterIndex, curStimIndex, 0 ,undefined);
      newExperimentState = Object.assign(newExperimentState, stateChanges);

      Session.set('testType', questInfo.testType);
      Session.set('questionIndex', questionIndex + 1);
      Session.set('showOverlearningText', false); // No overlearning in a schedule

      console.log('SCHEDULE UNIT card selection => ',
          'cluster-idx-unmapped:', curClusterIndex,
          'whichStim:', curStimIndex,
      );

      updateExperimentStateSync(newExperimentState, 'question');
    },

    findCurrentCardInfo: function() {
      // selectNextCard increments questionIndex after setting all card
      // info, so we need to use -1 for this info
      const questionIndex = Math.max(Session.get('questionIndex')-1, 0);
      return this.getSchedule().q[questionIndex];
    },

    cardAnswered: async function() {
      // Nothing currently
    },

    unitFinished: function() {
      const questionIndex = Session.get('questionIndex');
      const curUnitNum = Session.get('currentUnitNumber');
      let schedule = null;
      if (curUnitNum < Session.get('currentTdfFile').tdfs.tutor.unit.length) {
        schedule = this.getSchedule();
      }

      if (schedule && questionIndex < schedule.q.length) {
        return false; // have more
      } else {
        return true; // nothing left
      }
    },
  };
}
