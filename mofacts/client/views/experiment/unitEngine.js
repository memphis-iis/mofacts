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
  getAllCurrentStimAnswers,
  updateCurStudedentPracticeTime
} from '../../lib/currentTestingHelpers';
import {updateExperimentState, unitIsFinished} from './card';
import {MODEL_UNIT, SCHEDULE_UNIT} from '../../../common/Definitions';
import {meteorCallAsync, clientConsole} from '../../index';
import {displayify} from '../../../common/globalHelpers';
import {Answers} from './answerAssess';
import { AdaptiveQuestionLogic } from './adaptiveQuestionLogic';

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
  let stimClusters = [];
  const numQuestions = getStimCount();
  for (let i = 0; i < numQuestions; ++i) {
    stimClusters.push(getStimCluster(i));
  }
  const engine = {
    // Things actual engines must supply
    unitType: 'DEFAULT',
      //check if the unit is adaptive
    
    adaptiveQuestionLogic: new AdaptiveQuestionLogic(),
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
      clientConsole(1, 'Engine created for unit:', this.unitType);
      await this.initImpl();
    },

    replaceClozeWithSyllables: function(question, currentAnswerSyllables, origAnswer, hintLevel) {
      clientConsole(1, 'replaceClozeWithSyllables1: ', question, currentAnswerSyllables, origAnswer);
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
        clientConsole(2, part);
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

      clientConsole(1, 'replaceClozeWithSyllables2:', clozeQuestion, clozeMissingSyllables, clozeQuestionParts,
          clozeAnswerNoUnderscores, clozeAnswerOnlyUnderscores);
      return {clozeQuestion, clozeMissingSyllables, clozeQuestionParts, hintLevel, reconstructedAnswer};
    },

    setUpCardQuestionSyllables: function(currentQuestion, currentQuestionPart2,
        currentStimAnswer, probFunctionParameters, hintLevel, curQuestionSyllables) {
      clientConsole(1, 'setUpCardQuestionSyllables: ', currentQuestion, currentQuestionPart2,
          currentStimAnswer, probFunctionParameters);
      let currentAnswer = currentStimAnswer;
      let clozeQuestionParts = undefined;
      let currentAnswerSyllables = undefined;
      let currentStimAnswerWordCount = currentStimAnswer.split(' ').length;

      // For now this distinguishes model engine from schedule engine, which doesn't do syllable replacement
      if (probFunctionParameters && probFunctionParameters.hintLevel > 0) {
        clientConsole(1, 'getSubClozeAnswerSyllables, displaySyllableIndices/hintsylls: ', probFunctionParameters.hintsylls,
            ', this.cachedSyllables: ', this.cachedSyllables);
        const answer = currentStimAnswer.replace(/\./g, '_');
        if (!curQuestionSyllables) {
            //if(!this.cachedSyllables.data[answer]){
              clientConsole(1, 'no syllable data for that answer, throw error');
              const currentStimuliSetId = Session.get('currentStimuliSetId');
              Meteor.call('updateStimSyllables', currentStimuliSetId, function(){});
              alert('Something went wrong generating hints. Please report this error to the administrator and restart your trial');
          // } else {
          //   //We assume no hints were generated initially, meaning the tdf didn't have hints to start.
          //   clientConsole('no syllable index or cachedSyllables, defaulting to no subclozeanswer');
          //   clientConsole(typeof(probFunctionParameters.hintsylls),
          //       !this.cachedSyllables,
          //       (probFunctionParameters.hintsylls || []).length);
          // }
        } else {
          currentAnswerSyllables = {
            count: curQuestionSyllables.length,
            syllableArray: curQuestionSyllables,
          };
        }

        if (currentAnswerSyllables) {
          const {clozeQuestion, clozeMissingSyllables, clozeQuestionParts: cQuestionParts, reconstructedAnswer} =
              this.replaceClozeWithSyllables(currentQuestion, currentAnswerSyllables, currentStimAnswer,hintLevel);
          if (clozeQuestion) {
            currentQuestion = clozeQuestion;
            currentAnswer = reconstructedAnswer;
            clozeQuestionParts = cQuestionParts;
            clientConsole(1, 'clozeQuestionParts:', cQuestionParts);
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
        const regex = /([_])+/g
        currentQuestion = currentQuestion.replaceAll(regex, `<u>${blank + blank}</u>`)
      }

      clientConsole('setUpCardQuestionSyllables:', currentQuestion, currentQuestionPart2,
          currentAnswerSyllables, clozeQuestionParts, currentAnswer);
      return {currentQuestionPostSylls: currentQuestion, currentQuestionPart2PostSylls: currentQuestionPart2,
        currentAnswerSyllables, clozeQuestionParts, currentAnswer, hintLevel};
    },

    setUpCardQuestionAndAnswerGlobals: async function(cardIndex, whichStim, whichHintLevel = 0, probFunctionParameters) {
      const newExperimentState = {};
      Session.set('alternateDisplayIndex', undefined);
      const cluster = stimClusters[cardIndex];
      clientConsole(1, 'setUpCardQuestionAndAnswerGlobals', cardIndex, whichStim, probFunctionParameters,
          cluster, cluster.stims[whichStim], whichHintLevel);
      const curStim = cluster.stims[whichStim];
      let currentDisplay = JSON.parse(JSON.stringify({
        text: curStim.textStimulus,
        audioSrc: curStim.audioStimulus,
        imgSrc: curStim.imageStimulus,
        videoSrc: curStim.videoStimulus,
        clozeText: curStim.clozeStimulus || curStim.clozeText,
        hintsEnabled: curStim.hintsEnabled

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
            hintsEnabled: curAltDisplay.hintsEnabled
          }));
        }
      }
      const originalDisplay = JSON.parse(JSON.stringify(currentDisplay));
      newExperimentState.originalDisplay = originalDisplay;

      let currentQuestion = currentDisplay.clozeText || currentDisplay.text;
      let currentQuestionPart2 = undefined;
      let currentStimAnswer = getStimAnswer(cardIndex, whichStim);

      const correctAnswer = Answers.getDisplayAnswerText(currentStimAnswer);
      const cacheWords = await meteorCallAsync('getMatchingDialogueCacheWordsForAnswer', correctAnswer);
      Session.set('dialogueCacheHint', cacheWords.join(','));
      newExperimentState.originalAnswer = currentStimAnswer;
      currentStimAnswer = currentStimAnswer.toLowerCase();

      // If we have a dual prompt question populate the spare data field
      if (currentQuestion && currentQuestion.indexOf('|') != -1) {
        const prompts = currentQuestion.split('|');
        currentQuestion = prompts[0];
        currentQuestionPart2 = prompts[1];
      }
      Session.set('originalQuestion', currentQuestion);
      newExperimentState.originalQuestion = currentQuestion;
      newExperimentState.originalQuestion2 = currentQuestionPart2;

      const {
        currentQuestionPostSylls,
        currentQuestionPart2PostSylls,
        currentAnswerSyllables,
        clozeQuestionParts,
        currentAnswer,
      } = this.setUpCardQuestionSyllables(currentQuestion, currentQuestionPart2, currentStimAnswer,
          probFunctionParameters, whichHintLevel, cluster.stims[whichStim].syllables);
      
      clientConsole(1, 'HintLevel: setUpCardQuestionAndAnswerGlobals',whichHintLevel);  
      clientConsole(1, 'setUpCardQuestionAndAnswerGlobals2:', currentQuestionPostSylls, currentQuestionPart2PostSylls);
      clientConsole(1, 'setUpCardQuestionAndAnswerGlobals3:', currentAnswerSyllables, clozeQuestionParts, currentAnswer);

      if (currentAnswerSyllables) {
        curStim.answerSyllables = currentAnswerSyllables;
        curStim.hintLevel = 0;
        //check for tdf hints enabled
        const currentTdfFile = Tdfs.findOne({_id: Session.get('currentTdfId')});
        tdfHintsEnabled = currentTdfFile.content.tdfs.tutor.setspec.hintsEnabled == "true";
        //check for stim hints enabled
        stimHintsEnabled = currentDisplay.hintsEnabled;
        //if both are enabled, use hints
        if (tdfHintsEnabled && stimHintsEnabled) {
          curStim.hintLevel = whichHintLevel;
          clientConsole(2, 'HintLevel: setUpCardQuestionAndAnswerGlobals',whichHintLevel);
        }
        //if only tdf hints are enabled, use hints
        else if (tdfHintsEnabled && !stimHintsEnabled) {
          curStim.hintLevel = whichHintLevel;
          clientConsole(2, 'HintLevel: setUpCardQuestionAndAnswerGlobals',whichHintLevel);
        }
        //if only stim hints are enabled, use hints
        else if (!tdfHintsEnabled && stimHintsEnabled) {
          curStim.hintLevel = whichHintLevel;
          clientConsole(2, 'HintLevel: setUpCardQuestionAndAnswerGlobals',whichHintLevel);
        }
        //if neither are enabled, do not use hints
        else {
          curStim.hintLevel = 0;
          clientConsole(2, 'HintLevel: setUpCardQuestionAndAnswerGlobals, Hints Disabled',whichHintLevel);
        }
      }
      Session.set('currentAnswerSyllables', currentAnswerSyllables);
      Session.set('currentAnswer', currentAnswer);
      Session.set('clozeQuestionParts', clozeQuestionParts);
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
      newExperimentState.currentDisplayEngine = currentDisplay;

      return newExperimentState;
    },
  };
  engine.experimentState = curExperimentData.experimentState;
  engine.cachedSyllables = curExperimentData.cachedSyllables;
  clientConsole(1, 'curExperimentData:', curExperimentData);
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
  clientConsole(1, 'model unit engine created!!!');
  // Checked against practice seconds. Notice that we capture this on unit
  // creation, so if they leave in the middle of practice and come back to
  // the unit we'll start all over.
  const unitStartTimestamp = Date.now();



  function getStimParameterArray(clusterIndex, whichStim) {
    return getStimCluster(clusterIndex).stims[whichStim].params.split(',').map((x) => _.floatval(x));
  }

  function getStimParameterArrayFromCluster(cluster, whichStim) {
    return cluster.stims[whichStim].params.split(',').map((x) => _.floatval(x));
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
    clientConsole(1, 'MODEL UNIT card selection => ',
        'cluster-idx:', clusterIndex,
        'whichStim:', whichStim,
        'whichHintLevel:', whichHintLevel,
        'parameter', getStimParameterArray(clusterIndex, whichStim),
    );
  }

  // Initialize card probabilities, with optional initial data
  let cardProbabilities = [];
  let stimClusters = [];
  const numQuestions = getStimCount();
  for (let i = 0; i < numQuestions; ++i) {
    stimClusters.push(getStimCluster(i));
  }
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
  else if (unit.videosession) 
    probFunction = unit.videosession.calculateProbability ? unit.videosession.calculateProbability.trim() : undefined;
  const probFunctionHasHintSylls = typeof(probFunction) == 'undefined' ? false : probFunction.indexOf('hintsylls') > -1;
  clientConsole(2, 'probFunctionHasHintSylls: ' + probFunctionHasHintSylls, typeof(probFunction));
  if (probFunction) {
    probFunction = new Function('p', 'pFunc', '\'use strict\';\n' + probFunction); // jshint ignore:line
  } else {
    probFunction = defaultProbFunction;
  }

  function selectCardAndHintClosestToOptimalProbability(cards, hiddenItems, currentDeliveryParams) {
    clientConsole(1, 'selectCardAndHintClosestToOptimalProbability');
    let currentMin = 50.0;
    let clusterIndex=-1;
    let stimIndex=-1;
    let hintLevelIndex=-1;
    let optimalProb;
    let forceSpacing = currentDeliveryParams.forceSpacing;
    let minTrialDistance = forceSpacing ? 1 : -1;

    for (let i=0; i<cards.length; i++) {
      const card = cards[i];
      if (!card.canUse || !(card.trialsSinceLastSeen > minTrialDistance)) {
        continue;
      } else {
        const stimCluster = stimClusters[i];
        for (let j=0; j<card.stims.length; j++) {
          const stim = card.stims[j];
          if (hiddenItems.includes(stim.stimulusKC) || !stim.canUse) continue;
          const parameters = stim.parameter;
          const currentDeliveryParams = Session.get('currentDeliveryParams');
          optimalProb = Math.log(currentDeliveryParams.optimalThreshold/(1-currentDeliveryParams.optimalThreshold)) || false;
          if (!optimalProb) optimalProb = Math.log(parameters[1]/(1-parameters[1])) || false;
          if (!optimalProb) {
            clientConsole(2, "NO OPTIMAL PROBABILITY SPECIFIED IN STIM, THROWING ERROR");
            throw new Error("NO OPTIMAL PROBABILITY SPECIFIED IN STIM, THROWING ERROR");
          }
          const dist = Math.abs(Math.log(stim.probabilityEstimate/(1-stim.probabilityEstimate)) - optimalProb);
          if (dist < currentMin) {
            currentMin = dist;
            clusterIndex=i;
            stimIndex=j;
            hintLevelIndex = 0;
          }
          if (
            !stimCluster.stims[j] ||
            !stimCluster.stims[j].syllables ||
            stimCluster.stims[j].syllables.length < 3 ||
            !(stimCluster.stims[j].textStimulus || stimCluster.stims[j].clozeStimulus)
          ) {
            continue;
          }
          
          if(stim.hintLevelProbabilites) {
            for (let k = 1; k < Math.min(stim.hintLevelProbabilites.length, 3); k++) {
              // Check if hintLevelProbabilites array exists
              if (!stim.hintLevelProbabilites) {
                continue;
              }
            
              let hintDist = Math.abs(
                Math.log(stim.hintLevelProbabilites[k] / (1 - stim.hintLevelProbabilites[k])) - optimalProb
              );
            
              if (hintDist < currentMin) {
                currentMin = hintDist;
                clusterIndex = i;
                stimIndex = j;
                hintLevelIndex = k;
              }
            }
          }
        }
      }
    }

    return {clusterIndex, stimIndex, hintLevelIndex};
  }

  function selectCardAndHintBelowOptimalProbability(cards, hiddenItems, currentDeliveryParams) {
    clientConsole(1, 'selectCardAndHintBelowOptimalProbability');
    let currentMax = 0;
    let clusterIndex=-1;
    let stimIndex=-1;
    let hintLevelIndex=-1;
    let forceSpacing = currentDeliveryParams.forceSpacing;
    let minTrialDistance = forceSpacing ? 1 : -1;

    for (let i=0; i<cards.length; i++) {
      const card = cards[i];
      if (!card.canUse || !(card.trialsSinceLastSeen > minTrialDistance)) {
        continue;
      } else {
        const stimCluster = stimClusters[i];
        for (let j=0; j<card.stims.length; j++) {
          const stim = card.stims[j];
          if (hiddenItems.includes(stim.stimulusKC) || !stim.canUse) continue;
          const parameters = stim.parameter;
          let thresholdCeiling=parameters[1];
          if (!thresholdCeiling) {
            //  clientConsole(2, "NO THRESHOLD CEILING SPECIFIED IN STIM, DEFAULTING TO 0.90");
            thresholdCeiling = currentDeliveryParams.optimalThreshold || 0.90;
          }
          if (stim.probabilityEstimate > currentMax && stim.probabilityEstimate < thresholdCeiling) {
            currentMax = stim.probabilityEstimate;
            clusterIndex=i;
            stimIndex=j;
            hintLevelIndex=0;
          }
          if(stimCluster.stims[j].syllables.length < 3 || !(stimCluster.stims[j].textStimulus || stimCluster.stims[j].clozeStimulus)) continue;
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
      const unitNumber = Session.get('currentUnitNumber');
      const curTdf = Tdfs.findOne({_id: Session.get('currentTdfId')});
      const unitTypeParams = curTdf.content.tdfs.tutor.unit[unitNumber].assessmentsession || curTdf.content.tdfs.tutor.unit[unitNumber].learningsession;  
      unitTypeParams ? clusterList = unitTypeParams.clusterlist : clusterList = false;
      unitClusterList = [];
      if(!clusterList){ clientConsole(2, 'no clusterlist found for unit ' + unitNumber); }
      clusterList.split(' ').forEach(
        value => {
          if(value.includes('-')){
            const [start, end] = value.split('-').map(Number);
            for(let i = start; i <= end; i++){
              unitClusterList.push(i);
            }
          } else {
            unitClusterList.push(Number(value));
          }
        }
      );
      for (clusterIndex of unitClusterList) {
        const card = cardProbabilities.cards[clusterIndex];
        const stimCluster = stimClusters[clusterIndex];
        for (let stimIndex = 0; stimIndex < card.stims.length; stimIndex++) {
          const stim = card.stims[stimIndex];
          const hintLevelProbabilities = [];
          const currentStimuliSetId = Session.get('currentStimuliSetId');
          const stimAnswer = stimCluster.stims[stimIndex].correctResponse
          let answerText = Answers.getDisplayAnswerText(stimAnswer).toLowerCase();
          //Detect Hint Levels
          if (!stimCluster.stims[stimIndex].syllables) {
            hintLevelIndex = 1;
            clientConsole(2, 'no cached syllables for: ' + currentStimuliSetId + ' | ' + answerText + '. hintlevel index is 1.');
          } else {
            const stimSyllableData = stimCluster.stims[stimIndex].syllables;
            hintLevelIndex = stimSyllableData.length;
            clientConsole(2, 'syllables detected for: ' + currentStimuliSetId + ' | ' + answerText + '. hintlevel index is ' + hintLevelIndex);
          }
          parms = this.calculateSingleProb(clusterIndex, stimIndex, 0, count, stimCluster);
          tdfDebugLog.push(parms.debugLog);
          
          stim.available = parms.available;
          if(typeof stim.available == "string" && (stim.available == "true" || stim.available == "false")){
            //convert to bool
            stim.available = stim.available == "true";
          }
          if(stim.available || stim.available === undefined){
            stim.canUse = true;
            if((stimCluster.stims[stimIndex].textStimulus || stimCluster.stims[stimIndex].clozeStimulus) && hintLevelIndex > 2){ //hints can't be used if there are fewer than 3 syllables
              for(let hintLevel = 0; hintLevel < 3; hintLevel++){
                let hintLevelParms = this.calculateSingleProb(clusterIndex, stimIndex, hintLevel, count, stimCluster);
                hintLevelProbabilities.push(hintLevelParms.probability);
                clientConsole(2, 'cluster: ' + clusterIndex + ', card: ' + stimIndex + ', input hintlevel: ' + hintLevel + ', output hintLevel: ' + hintLevelParms.hintLevel + ', output probability: ' + hintLevelParms.probability) + ', debug message:' + hintLevelParms.debugLog;
              }
              stim.hintLevelProbabilites = hintLevelProbabilities;
              clientConsole(2, 'hintLevel probabilities', hintLevelProbabilities);
            }
          } else {
            stim.canUse = false;
          }
          stim.probabilityEstimate = parms.probability;
          stim.probFunctionParameters = parms;
          if(!typeof stim.probabilityEstimate == "number"){
            throw 'Error: Probability Estimate is undefined or NaN.';
          }
          ptemp[count]=Math.round(10000*parms.probability)/10000;
          count++;           
        }
      }
      clientConsole(2, 'calculateCardProbabilities', JSON.stringify(ptemp));
    },

    // Given a single item from the cardProbabilities, calculate the
    // current probability. IMPORTANT: this function only returns ALL parameters
    // used which include probability. The caller is responsible for storing it.
    calculateSingleProb: function calculateSingleProb(cardIndex, stimIndex, hintLevel, i, stimCluster) {
      const card = cardProbabilities.cards[cardIndex];
      const stim = card.stims[stimIndex];
      
      // Store parameters in an object for easy logging/debugging
      const p = {};
      
      // Probability Functions
      pFunc = {};
      pFunc.testFunction = function() {
        clientConsole(2, "testing probability function");
      }

      pFunc.mul = function(m1,m2){
        var result = 0;
        var len = m1.length;
        for (var i = 0; i < len; i++) {
          result += m1[i] * m2[i]
        }
        return result
      }
      pFunc.logitdec = function(outcomes, decay){
        if (outcomes) {
          var outcomessuc = JSON.parse(JSON.stringify(outcomes));
          var outcomesfail = outcomes.map(function(value) {
            return Math.abs(value - 1)
          });
          var w = outcomessuc.unshift(1);
          var v = outcomesfail.unshift(1);
          return Math.log(pFunc.mul(outcomessuc, [...Array(w).keys()].reverse().map(function(value, index) { 
            return Math.pow(decay, value) 
          }))  / pFunc.mul(outcomesfail, [...Array(w).keys()].reverse().map(function(value, index) {
            return Math.pow(decay, value) 
          })))
        }
        return 0
      }

      pFunc.recency = function(age,d){
        if (age==0) {
          return 0;
        } else {
          return Math.pow(1 + age, -d);
        }
      }

      pFunc.quaddiffcor = function(seq, probs){
        return pFunc.mul(seq, probs.map(function(value) {
          return value * value
        }))
      }

      pFunc.quaddiffincor = function(seq, probs){
        return pFunc.mul(Math.abs(seq-1), probs.map(function(value) {
          return value * value
        }))
      }

      pFunc.linediffcor = function(seq, probs) {
        return pFunc.mul(seq, probs)
      }

      pFunc.linediffincor = function(seq, probs) {
        return pFunc.mul(seq.map(function(value) {
          return Math.abs(value - 1)
        }), probs)
      }

      pFunc.arrSum = function(arr) {
        return arr.reduce(function(a,b){return a + b}, 0);
      }

      pFunc.errlist = function(seq) {  return seq.map(function(value) {return Math.abs(value - 1)})}

      p.i = i;

      // Current Indices
      p.clusterIndex = cardIndex;
      p.stimIndex = stimIndex;
      p.hintLevel = hintLevel;
      p.pFunc = pFunc

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
        if (!stimCluster.stims[stimIndex].syllables) {
          clientConsole(1, 'no cached syllables for: ' + currentStimuliSetId + '|' + answerText);
          throw new Error('can\'t find syllable data in database');
        } else {
          const stimSyllableData = stimCluster.stims[stimIndex].syllables;
          p.syllables = stimSyllableData.length;
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
      const currentDeliveryParams = Session.get('currentDeliveryParams');
      currentDeliveryParams.optimalThreshold ? p.stimParameters[1] = currentDeliveryParams.optimalThreshold : p.stimParameters[1] = p.stimParameters[1];

      p.clusterPreviousCalculatedProbabilities = JSON.parse(JSON.stringify(card.previousCalculatedProbabilities));
      p.clusterOutcomeHistory = JSON.parse(JSON.stringify(card.outcomeStack));

      p.stimPreviousCalculatedProbabilities = JSON.parse(JSON.stringify(stim.previousCalculatedProbabilities));
      p.stimOutcomeHistory = JSON.parse(JSON.stringify(stim.outcomeStack));
      //clientConsole('stimOutcomeHistory', typeof p.stimOutcomeHistory, p.stimOutcomeHistory)
      if(typeof p.stimOutcomeHistory === 'string') {
        p.stimOutcomeHistory = p.stimOutcomeHistory.split(',');
      }

      p.overallOutcomeHistory = Session.get('overallOutcomeHistory');
      p.overallStudyHistory = Session.get('overallStudyHistory');

      if (p.i<15) {
        clientConsole(1, 'cardProbability parameters:', JSON.parse(JSON.stringify(p)));
      }
      return probFunction(p, pFunc);
    },

    // TODO: do this function without side effects on cards
    setUpClusterList: function setUpClusterList(cards) {
      const currentTdfFile = Session.get('currentTdfFile');
      const isMultiTdf = currentTdfFile.isMultiTdf;
      const isVideoSession = Session.get('isVideoSession')
      const clusterList = [];

      if (isMultiTdf) {
        const curUnitNumber = Session.get('currentUnitNumber');

        // NOTE: We are currently assuming that multiTdfs will have only three units:
        // an instruction unit, an assessment session with exactly one question which is the last
        // item in the stim file, and a unit with all clusters specified in the generated subtdfs array
        if (curUnitNumber == 2) {
          const subTdfIndex = Session.get('subTdfIndex');
          if (typeof(subTdfIndex) == 'undefined') {
            clientConsole(1, 'assuming we are in studentReporting, therefore ignoring the clusterlists'); // TODO, make this an explicit argument and error when it happens if we don't pass in the argument
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
          clientConsole(1, 'setupclusterlist:', this.curUnit, sessCurUnit);
          let unitClusterList = "";
          // TODO: shouldn't need both
          if(isVideoSession) {
            if (this.curUnit && this.curUnit.videosession && this.curUnit.videosession.questions)
              unitClusterList = this.curUnit.videosession.questions;
          }
          else {
            if(this.curUnit && this.curUnit.learningsession && this.curUnit.learningsession.clusterlist)
              unitClusterList = this.curUnit.learningsession.clusterlist.trim()
          }
        extractDelimFields(unitClusterList, clusterList);
      }
      clientConsole(2, 'clusterList', clusterList);
      for (let i = 0; i < clusterList.length; ++i) {
        const nums = rangeVal(clusterList[i]);
        for (let j = 0; j < nums.length; ++j) {
          cards[_.intval(nums[j])].canUse = true;
        }
      }
      clientConsole(1, 'setupClusterList,cards:', cards);
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
      clientConsole(1, 'initializeActRModel', numQuestions, curKCBase);
      const responseKCMap = await meteorCallAsync('getResponseKCMap');
      Session.set('responseKCMap', responseKCMap)
      clientConsole(2, 'initializeActRModel,responseKCMap', responseKCMap);
      for (i = 0; i < numQuestions; ++i) {
        const card = {
          clusterKC: (curKCBase + i),
          hintLevel: null,
          priorCorrect: 0,
          allTimeCorrect: 0,
          allTimeIncorrect: 0,
          priorIncorrect: 0,
          curSessionPriorCorrect: 0,
          curSessionPriorIncorrect: 0,
          hasBeenIntroduced: false,
          outcomeStack: [],
          lastSeen: 0,
          firstSeen: 0,
          totalPracticeDuration: 0,
          allTimeTotalPracticeDuration: 0,
          otherPracticeTime: 0,
          previousCalculatedProbabilities: [],
          priorStudy: 0,
          trialsSinceLastSeen: 3, // We start at >2 for initial logic (see findMin/Max functions below)
          canUse: false,
          stims: [],
          instructionQuestionResult: null,
        };

        // We keep per-stim and re-response-text results as well
        const cluster = stimClusters[i];
        const numStims = cluster.stims.length;
        for (j = 0; j < numStims; ++j) {
          // Note this may be a single element array for older stims or a 3 digit array for newer ones
          const parameter = getStimParameterArrayFromCluster(cluster, j);
          // Per-stim counts
          card.stims.push({
            clusterKC: (curKCBase + i),
            stimIndex: j,
            stimulusKC,
            hintLevel: 0,
            priorCorrect: 0,
            allTimeCorrect: 0,
            allTimeIncorrect: 0,
            curSessionPriorCorrect: 0,
            priorIncorrect: 0,
            curSessionPriorIncorrect: 0,
            hasBeenIntroduced: false,
            outcomeStack: [],
            lastSeen: 0,
            firstSeen: 0,
            totalPracticeDuration: 0,
            allTimeTotalPracticeDuration: 0,
            otherPracticeTime: 0,
            previousCalculatedProbabilities: [],
            priorStudy: 0,
            parameter: parameter,
            instructionQuestionResult: null,
            timesSeen: 0,
            canUse: true,
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
              KCId: responseKCMap[response],
              hintLevel: null,
              priorCorrect: 0,
              allTimeCorrect: 0,
              allTimeIncorrect: 0,
              curSessionPriorCorrect: 0,
              priorIncorrect: 0,
              curSessionPriorIncorrect: 0,
              firstSeen: 0,
              lastSeen: 0,
              totalPracticeDuration: 0,
              allTimeTotalPracticeDuration: 0,
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

      clientConsole(2, 'initCards:', initCards, initProbs);

      // has to be done once ahead of time to give valid values for the beginning of the test.
      // calculateCardProbabilities();
    },

    saveSingleComponentState: function(stim, card, response) {
      const userId = Meteor.userId();
      const TDFId = Session.get('currentTdfId');
      const responseKCMap = Session.get('responseKCMap')
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
        allTimeCorrect: card.allTimeCorrect,
        allTimeIncorrect: card.allTimeIncorrect,
        curSessionPriorCorrect: 0,
        curSessionPriorIncorrect: 0,
        priorStudy: card.priorStudy,
        totalPracticeDuration: card.totalPracticeDuration,
        allTimeTotalPracticeDuration: card.allTimeTotalPracticeDuration,
        outcomeStack: card.outcomeStack,
        instructionQuestionResult: Session.get('instructionQuestionResult'),
      };
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
        allTimeCorrect: stim.allTimeCorrect,
        allTimeIncorrect: stim.allTimeIncorrect,
        curSessionPriorCorrect: stim.curSessionPriorCorrect,
        curSessionPriorIncorrect: stim.curSessionPriorIncorrect,
        priorStudy: stim.priorStudy,
        totalPracticeDuration: stim.totalPracticeDuration,
        allTimeTotalPracticeDuration: stim.allTimeTotalPracticeDuration,
        outcomeStack: stim.outcomeStack,
        instructionQuestionResult: null,
        timesSeen: stim.timesSeen,
      };
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
        allTimeCorrect: response.allTimeCorrect,
        allTimeIncorrect: response.allTimeIncorrect,
        curSessionPriorCorrect: 0,
        curSessionPriorIncorrect: 0,
        priorStudy: response.priorStudy,
        totalPracticeDuration: response.totalPracticeDuration,
        allTimeTotalPracticeDuration: response.allTimeTotalPracticeDuration,
        outcomeStack: response.outcomeStack,
        responseText: Object.entries(cardProbabilities.responses).find(r => r[1] == response)[0], // not actually in db, need to lookup/assign kcid when loading
        instructionQuestionResult: null,
      };
      const componentStates = ComponentStates.findOne({userId, TDFId});
      if(componentStates){
        let cardIndex = componentStates.cardStates.findIndex(function(item){
          return item.KCId === card.clusterKC
        });
        let stimIndex = componentStates.stimStates.findIndex(function(item){
          return item.KCId === stim.stimulusKC
        });
        let responseIndex = componentStates.responseStates.findIndex(function(item){
          return item.responseText === responseState.responseText
        });
        if (cardIndex == -1)
          componentStates.cardStates.push(cardState);
        else
          componentStates.cardStates[cardIndex] = cardState;
        if (stimIndex == -1)
          componentStates.stimStates.push(stimState);
        else
          componentStates.stimStates[stimIndex] = stimState;
        if (responseIndex == -1)
          componentStates.responseStates.push(responseState);
        else
          componentStates.responseStates[responseIndex] = responseState;
        ComponentStates.update(componentStates._id, {$set: {
          cardStates: componentStates.cardStates, 
          stimStates: componentStates.stimStates, 
          responseStates: componentStates.responseStates
        }});
      } else {
        ComponentStates.insert({
          userId: userId,
          TDFId: TDFId,
          cardStates: [cardState],
          stimStates: [stimState],
          responseStates: [responseState]
        });
      }
    },

    saveComponentStatesSync: function() {
      const userId = Meteor.userId();
      const TDFId = Session.get('currentTdfId');
      
      const cardStates = []
      const stimStates = []
      const responseStates = []
      for (let cardIndex=0; cardIndex<cardProbabilities.cards.length; cardIndex++) {
        const card = cardProbabilities.cards[cardIndex];
        const _id = card._id;
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
          allTimeCorrect: card.allTimeCorrect,
          priorIncorrect: card.priorIncorrect,
          allTimeIncorrect: card.allTimeIncorrect,
          curSessionPriorCorrect: 0,
          curSessionPriorIncorrect: 0,
          priorStudy: card.priorStudy,
          totalPracticeDuration: card.totalPracticeDuration,
          allTimeTotalPracticeDuration: card.allTimeTotalPracticeDuration,
          outcomeStack: typeof card.outcomeStack == 'string' ?  card.outcomeStack.split(','):  card.outcomeStack,
          instructionQuestionResult: Session.get('instructionQuestionResult'),
        };
        cardStates.push(cardState);
        for (let stimIndex=0; stimIndex<card.stims.length; stimIndex++) {
          const stim = card.stims[stimIndex];
          const _id = stim._id;
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
            allTimeCorrect: stim.allTimeCorrect,
            priorIncorrect: stim.priorIncorrect,
            allTimeIncorrect: stim.allTimeIncorrect,
            curSessionPriorCorrect: stim.curSessionPriorCorrect,
            curSessionPriorIncorrect: stim.curSessionPriorIncorrect,
            priorStudy: stim.priorStudy,
            totalPracticeDuration: stim.totalPracticeDuration,
            allTimeTotalPracticeDuration: stim.allTimeTotalPracticeDuration,
            outcomeStack: typeof stim.outcomeStack == 'string' ?  stim.outcomeStack.split(','):  stim.outcomeStack,
            instructionQuestionResult: null,
            timesSeen: stim.timesSeen,
          };
          stimStates.push(stimState);
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
          allTimeCorrect: response.allTimeCorrect,
          priorIncorrect: response.priorIncorrect,
          allTimeIncorrect: response.allTimeIncorrect,
          curSessionPriorCorrect: 0,
          curSessionPriorIncorrect: 0,
          priorStudy: response.priorStudy,
          totalPracticeDuration: response.totalPracticeDuration,
          allTimeTotalPracticeDuration: response.allTimeTotalPracticeDuration,
          outcomeStack: typeof response.outcomeStack == 'string' ?  response.outcomeStack.split(','):  response.outcomeStack,
          responseText, // not actually in db, need to lookup/assign kcid when loading
          instructionQuestionResult: null,
        };
        responseStates.push(responseState);
      }
      let cstate = ComponentStates.findOne({userId: userId, TDFId: TDFId});
      if (cstate) {
        ComponentStates.update({_id: cstate._id}, {$set: {cardStates, stimStates, responseStates}});
      } else {
        ComponentStates.insert({userId, TDFId, cardStates, stimStates, responseStates});
      }
    },
    loadComponentStates: async function() {// componentStates [{},{}]
      clientConsole(1, 'loadComponentStates start');

      let numQuestionsAnswered = 0;
      let numQuestionsAnsweredCurrentSession = 0;
      let numCorrectAnswers = 0;
      const probsMap = {};
      const cards = cardProbabilities.cards;
      let hiddenItems = Session.get('hiddenItems');
      if (hiddenItems === undefined) hiddenItems = []

      const componentStates = ComponentStates.findOne();
      clientConsole(2, 'loadComponentStates,componentStates:', componentStates);

      const clusterStimKCs = {};
      for (let i=0; i<cards.length; i++) {
        const stimKCs = [];
        for (let j=0; j<cards[i].stims.length; j++) {
          stimKCs.push(cards[i].stims[j].stimulusKC);
        }
        clusterStimKCs[i] = stimKCs;
      }

      const probabilityEstimates = await meteorCallAsync('getProbabilityEstimatesByKCId', Session.get('currentTdfId'), clusterStimKCs);
      const stimProbabilityEstimates = probabilityEstimates.individualStimProbs;
      const clusterProbabilityEstimates = probabilityEstimates.clusterProbs;

      // No prior history, we assume KCs could have been affected by other units using them
      if (!componentStates) {
        clientConsole(2, 'loadcomponentstates,length==0:', cardProbabilities);
        for (let cardIndex=0; cardIndex<cards.length; cardIndex++) {
          const card = cardProbabilities.cards[cardIndex];
          if (!probsMap[cardIndex]) probsMap[cardIndex] = {};
          for (const stim of card.stims) {
            const stimIndex = stim.stimIndex;
            probsMap[cardIndex][stimIndex] = 0;
          }
        }
        clientConsole(2, 'loadComponentStates1', cards, probsMap, componentStates, clusterStimKCs, stimProbabilityEstimates);
      } else {
        const curKCBase = getStimKCBaseForCurrentStimuliSet();
        const componentCards = componentStates.cardStates;
        const stims = componentStates.stimStates;
        const responses = componentStates.responseStates;

        clientConsole(2, 'loadcomponentstates,length!=0:', cards, stims, responses, cardProbabilities);
        for (const componentCard of componentCards) {
          const clusterKC = componentCard.KCId;
          const cardIndex = clusterKC % curKCBase;
          const componentData = _.pick(componentCard,
              ['_id', 'firstSeen', 'lastSeen', 'outcomeStack','hintLevel', 'priorCorrect', 'priorIncorrect', 'allTimeCorrect', 'allTimeIncorrect', 'priorStudy',
                'totalPracticeDuration', 'allTimeTotalPracticeDuration', 'trialsSinceLastSeen']);
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
                ['_id', 'firstSeen', 'lastSeen', 'outcomeStack','hintLevel', 'priorCorrect', 'priorIncorrect', 'allTimeCorrect', 'allTimeIncorrect', 'curSessionPriorCorrect', 'curSessionPriorIncorrect', 'priorStudy',
                'allTimeTotalPracticeDuration', 'totalPracticeDuration']);
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
        clientConsole(2, 'loadComponentStates2', cards, stims, probsMap, componentStates,
            clusterStimKCs, stimProbabilityEstimates);
      }

      const initProbs = [];
      const numQuestions = getStimCount();
      for (let i = 0; i < numQuestions; ++i) {
        const cluster = stimClusters[i];
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
      const cardIndex = Session.get('currentExperimentState').shufIndex || 0;
      const whichStim = Session.get('currentExperimentState').whichStim || 0;
      const whichHintLevel = Session.get('currentExperimentState').whichHintLevel || 0;
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
      if(unit.learningsession && unit.learningsession.unitMode)
        unitMode = unit.learningsession.unitMode.trim();
      else if (unit.videosession && unit.videosession.unitMode)
        unitMode = unit.videosession.unitMode.trim();
      clientConsole(1, 'UNIT MODE: ' + unitMode);
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
      const currentDeliveryParams = Session.get('currentDeliveryParams');
      switch (this.unitMode) {
        case 'thresholdCeiling':
          indices = selectCardAndHintBelowOptimalProbability(cards, hiddenItems, currentDeliveryParams);
          clientConsole(2, 'thresholdCeiling, indicies:', JSON.parse(JSON.stringify(indices)));
          if (indices.clusterIndex === -1) {
            clientConsole(2, 'thresholdCeiling failed, reverting to min prob dist');
            indices = selectCardAndHintClosestToOptimalProbability(cards, hiddenItems, currentDeliveryParams);
          }
          break;
        case 'distance':
          indices = selectCardAndHintClosestToOptimalProbability(cards, hiddenItems, currentDeliveryParams);
          break;
        default:
          indices = selectCardAndHintClosestToOptimalProbability(cards, hiddenItems, currentDeliveryParams);
          break;
      }
      return indices;
    },

    selectNextCard: async function(indices, curExperimentState) {
      // The cluster (card) index, the cluster version (stim index), and
      // whether or not we should show the overlearning text is determined
      // here. See calculateCardProbabilities for how prob.probability is
      // calculated
      let newClusterIndex = -1;
      let newStimIndex = -1;
      let newHintLevel = -1;

      clientConsole(1, 'selectNextCard unitMode: ' + this.unitMode);

      if(indices === undefined || indices === null){
        clientConsole(2, 'indices unset, calculating now')
        indices = await this.calculateIndices();
      }

      newClusterIndex = indices.clusterIndex;
      newStimIndex = indices.stimIndex;
      newHintLevel = indices.hintLevelIndex;

      if(newClusterIndex === -1 || newStimIndex === -1 || newHintLevel === -1){
        unitIsFinished('No more cards to show');
        return;
      }

      clientConsole(2, 'selectNextCard indices:', newClusterIndex, newStimIndex, newHintLevel, indices);
      // Found! Update everything and grab a reference to the card and stim
      const cardIndex = newClusterIndex;
      const card = cardProbabilities.cards[cardIndex];
      const whichStim = newStimIndex;
      const whichHintLevel = newHintLevel;
      const stim = card.stims[whichStim];

      stim.previousCalculatedProbabilities.push(stim.probabilityEstimate);
      card.previousCalculatedProbabilities.push(stim.probabilityEstimate);

      // Save the stim's probability function input parameters for display in the UI
      Session.set('currentStimProbFunctionParameters', stim.probFunctionParameters);

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
      clientConsole(2, 'select next card:', cardIndex, whichStim, whichHintLevel);
      clientConsole(2, 'currentCardInfo:', JSON.parse(JSON.stringify(this.findCurrentCardInfo())));


      const stateChanges = await this.setUpCardQuestionAndAnswerGlobals(cardIndex, whichStim, whichHintLevel,
          stim.probFunctionParameters);
      clientConsole(2, 'selectNextCard,', Session.get('clozeQuestionParts'), stateChanges);
      newExperimentState = Object.assign(newExperimentState, stateChanges);// Find objects we'll be touching

      let testType = 'd';
      if (Session.get('currentDeliveryParams').studyFirst && card.priorStudy == 0) {
        clientConsole(2, 'STUDY FOR FIRST TRIAL !!!');
        testType = 's';
      } else if (stim.available) {
        clientConsole(2, "Trial type set by probability function to: ", stim.available)
        if(stim.available == "drill")
          testType = 'd';
        else if(stim.available == "study")
          testType = 's';
        else if(stim.available == "test")
          testType = 't';
      }
      Session.set('testType', testType);
      newExperimentState.testType = testType;
      newExperimentState.questionIndex = 1;

      Session.set('questionIndex', 0); // questionIndex doesn't have any meaning for a model
      curExperimentState.showOverlearningText = false;

      updateCardAndStimData(cardIndex, whichStim);

      // only log this for teachers/admins
      if (Roles.userIsInRole(Meteor.user(), ['admin', 'teacher'])) {
        clientConsole(1, '>>>BEGIN METRICS>>>>>>>\n',
        'Overall user stats => ',
            'total responses:', cardProbabilities.numQuestionsAnswered,
            'total correct responses:', cardProbabilities.numCorrectAnswers,
        );

        // Log selections - note that the card output will also include the stim
        clientConsole(1, 'Model selected card:', displayify(card));
        clientConsole(1, 'Model selected stim:', displayify(stim));

        // Log time stats in human-readable form
        const elapsedStr = function(t) {
          return t < 1 ? 'Never Seen': secs(Date.now() - t);
        };
        clientConsole(1, 
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
          clientConsole(1, 'Response is', responseText, displayify(cardProbabilities.responses[responseText]));
        }

        clientConsole(1, '<<<END   METRICS<<<<<<<');
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
        updateExperimentState(newExperimentState, 'unitEngine.modelUnitEngine.selectNextCard', curExperimentState);
      } catch (e) {
        clientConsole(1, 'error in select next card server calls:', e);
        throw new Error('error in select next card server calls:', e);
      }
    },

    updatePracticeTime: function(practiceTime) {
      const card = cardProbabilities.cards[Session.get('clusterIndex')];
      const stim = card.stims[currentCardInfo.whichStim];
      card.totalPracticeDuration += practiceTime;
      stim.totalPracticeDuration += practiceTime;
      updateCurStudedentPracticeTime(practiceTime);
    },

    cardAnswered: async function(wasCorrect, practiceTime) {
      // Get info we need for updates and logic below
      const cards = cardProbabilities.cards;
      const cluster = stimClusters[Session.get('clusterIndex')];
      const card = _.prop(cards, cluster.shufIndex);
      const testType = getTestType();
      clientConsole(1, 'cardAnswered, card: ', card, 'cluster.shufIndex: ', cluster.shufIndex);

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
      stim.allTimeTotalPracticeDuration += practiceTime;
      stim.timesSeen += 1;
      const answerText = stripSpacesAndLowerCase(Answers.getDisplayAnswerText(
        cluster.stims[currentCardInfo.whichStim].correctResponse));

      updateCurStudentPerformance(wasCorrect, practiceTime, testType);

      // Study trials are a special case: we don't update any of the
      // metrics below. As a result, we just calculate probabilities and
      // leave. Note that the calculate call is important because this is
      // the only place we call it after init *and* something might have
      // changed during question selection
      if (testType === 's') {
        this.saveSingleComponentState(stim, card, cardProbabilities.responses[answerText]);
        return;
      }

      // "Global" stats
      cardProbabilities.numQuestionsAnswered += 1;
      cardProbabilities.numQuestionsAnsweredCurrentSession += 1;
      if (wasCorrect) {
        cardProbabilities.numCorrectAnswers += 1;
      }

      const currentStimProbability = stim.probabilityEstimate;

      clientConsole(2, 'cardAnswered, curTrialInfo:', currentStimProbability, card, stim);
      if (wasCorrect) {
        card.priorCorrect += 1;
        card.allTimeCorrect += 1;
        stim.priorCorrect += 1;
        stim.curSessionPriorCorrect += 1;
        stim.allTimeCorrect += 1;
      }
      else {
        card.priorIncorrect += 1;
        card.allTimeIncorrect += 1;
        stim.priorIncorrect += 1;
        stim.curSessionPriorIncorrect += 1;
        stim.allTimeIncorrect += 1;
      }

      // This is called from processUserTimesLog() so this both works in memory and restoring from userTimesLog
      card.outcomeStack.push(wasCorrect ? 1 : 0);
      stim.outcomeStack.push(wasCorrect ? 1 : 0);

      // "Response" stats
      let resp;
      if (answerText && answerText in cardProbabilities.responses) {
        resp = cardProbabilities.responses[answerText];
        if (wasCorrect) {
          resp.priorCorrect += 1;
          resp.allTimeCorrect += 1;
        }
        else {
          resp.priorIncorrect += 1;
          resp.allTimeIncorrect += 1;
        }

        resp.outcomeStack.push(wasCorrect ? 1 : 0);
      } else {
        clientConsole(1, 'COULD NOT STORE RESPONSE METRICS',
            answerText,
            currentCardInfo.whichStim,
            displayify(cluster.stims[currentCardInfo.whichStim].correctResponse),
            displayify(cardProbabilities.responses));
      }

      this.saveSingleComponentState(stim, card, resp);
    },

    unitFinished: function() {
      const session = this.curUnit.learningsession || this.curUnit.videosession;
      const minSecs = session.displayminseconds || 0;
      const maxSecs = session.displaymaxseconds || 0;
      const maxTrials = parseInt(session.maxTrials || 0);
      const numTrialsSoFar = cardProbabilities.numQuestionsAnsweredCurrentSession || 0;
      const practicetimer = Session.get('currentDeliveryParams').practicetimer;

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
        clientConsole(2, 'No Practice Time Found and display timer: user must quit with Continue button');
        return false;
      }

      let unitElapsedTime = 0;
      if(practicetimer === 'clock-based'){
        unitElapsedTime = Session.get('curStudentPerformance').totalTime / 1000.0;
      }
      else {
        unitElapsedTime = (Date.now() - unitStartTimestamp) / 1000.0;
      }
      clientConsole(2, 'Model practice check', unitElapsedTime, '>', practiceSeconds);
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
    clientConsole(2, 'ASSESSMENT SESSION LOADED FOR SCHEDULE CREATION');
    clientConsole(1, 'Assessment settings:', settings);

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
      mapping = createStimClusterMapping(finalQuests.length, shuffles || [], swaps || [], mapping)

      clientConsole(2, 'Question swap/shuffle mapping:', displayify(
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

    clientConsole(1, 'Created schedule for current unit:');
    clientConsole(2, schedule);

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
      adaptiveLogic: {},
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
        clientConsole(1, 'WARNING! Num group names doesn\'t match num groups', settings.groupNames, settings.groups);
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

    // Adaptive logic
    settings.adaptiveLogic = assess.adaptiveLogic || {};

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

      clientConsole(2, 'creating schedule with params:', setSpec, curUnitNum, currUnit);
      //load schedule from experiment state if in resume
      if (Session.get('currentExperimentState')?.schedule && !Session.get('resetSchedule')) {
        schedule = Session.get('currentExperimentState').schedule;
      } else {
        schedule = createSchedule(setSpec, curUnitNum, currUnit);
      }
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

    selectNextCard: async function(indices, curExperimentState) {
      const questionIndex = Session.get('questionIndex');
      const sched = this.getSchedule();
      const questInfo = sched.q[questionIndex];
      clientConsole(1, 'schedule selectNextCard', questionIndex, questInfo);
      const curClusterIndex = questInfo.clusterIndex;
      const curStimIndex = questInfo.whichStim;

      let newExperimentState = {
        shufIndex: curClusterIndex,
        clusterIndex: curClusterIndex,
        questionIndex: questionIndex + 1,
        whichStim: questInfo.whichStim,
        testType: questInfo.testType,
        lastAction: 'question',
      };

      // Set current Q/A info, type of test (drill, test, study), and then
      // increment the session's question index number
      Session.set('clusterIndex', curClusterIndex);

      const stateChanges = await this.setUpCardQuestionAndAnswerGlobals(curClusterIndex, curStimIndex, 0 ,undefined);
      newExperimentState = Object.assign(newExperimentState, stateChanges);

      Session.set('testType', questInfo.testType);
      Session.set('questionIndex', questionIndex + 1);
      curExperimentState.showOverlearningText = false;

      clientConsole(2, 'SCHEDULE UNIT card selection => ',
          'cluster-idx-unmapped:', curClusterIndex,
          'whichStim:', curStimIndex,
      );

      updateExperimentState(newExperimentState, 'question', curExperimentState);
    },

    findCurrentCardInfo: function() {
      // selectNextCard increments questionIndex after setting all card
      // info, so we need to use -1 for this info
      const questionIndex = Math.max(Session.get('questionIndex')-1, 0);
      return this.getSchedule().q[questionIndex];
    },

    updatePracticeTime: function() {
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
