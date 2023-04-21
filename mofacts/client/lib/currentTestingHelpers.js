import {meteorCallAsync} from '..';
import {KC_MULTIPLE, MODEL_UNIT} from '../../common/Definitions';
import {dialogueSelectState} from '../views/home/profileDialogueToggles';
import {isEmpty} from '../../common/globalHelpers';
import {getCurrentClusterAndStimIndices} from '../views/experiment/card';
import { _ } from 'core-js';

export {
  blankPassword,
  extractDelimFields,
  rangeVal,
  shuffle,
  randomChoice,
  search,
  haveMeteorUser,
  updateCurStudentPerformance,
  setStudentPerformance,
  getStimCount,
  getStimCluster,
  getStimKCBaseForCurrentStimuliSet,
  createStimClusterMapping,
  getAllCurrentStimAnswers,
  getTestType,
  getCurrentDeliveryParams,
};

// Given a user ID, return the "dummy" password that stands in for a blank
// password. This is because we REALLY do want to use blanks passwords for
// some users
function blankPassword(userName) {
  return (userName + 'BlankPassword').toUpperCase();
}

// Extract space-delimited fields from src and push them to dest. Note that
// dest is changed, but is NOT cleared before commencing. Also note that
// false-ish values and whitespace-only strings are silently discarded
function extractDelimFields(src, dest) {
  if (!src) {
    return;
  }
  const fields = _.trim(src).split(/\s/);
  for (let i = 0; i < fields.length; ++i) {
    const fld = _.trim(fields[i]);
    if (fld && fld.length > 0) {
      dest.push(fld);
    }
  }
}

// Given a string of format "a-b", return an array containing all
// numbers from a to b inclusive.  On errors, return an empty array
function rangeVal(src) {
  src = _.trim(src);
  const idx = src.indexOf('-');
  if (idx < 1) {
    return [];
  }

  const first = _.intval(src.substring(0, idx));
  const last = _.intval(src.substring(idx+1));
  if (last < first) {
    return [];
  }

  const range = [];
  for (let r = first; r <= last; ++r) {
    range.push(r);
  }

  return range;
}

// Given an array, shuffle IN PLACE and then return the array
function shuffle(array) {
  if (!array || !array.length) {
    return array;
  }

  let currentIndex = array.length;

  while (currentIndex > 0) {
    const randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    const tmp = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = tmp;
  }

  return array;
}

// Given an array, select and return one item at random. If the array is
// empty, then undefined is returned
function randomChoice(array) {
  let choice;
  if (array && array.length) {
    choice = array[Math.floor(Math.random() * array.length)];
  }
  return choice;
}

function search(key, prop, searchObj) {
  for (const item of searchObj) {
    if (item[prop] == key) {
      return item;
    }
  }
}

function haveMeteorUser() {
  return (!!Meteor.userId() && !!Meteor.user() && !!Meteor.user().username);
}

function updateCurStudentPerformance(isCorrect, practiceTime, testType) {
  // Update running user metrics total,
  // note this assumes curStudentPerformance has already been initialized on initial page entry
  const curUserPerformance = Session.get('curStudentPerformance');
  console.log('updateCurStudentPerformance', isCorrect, practiceTime,
      JSON.parse(JSON.stringify((Session.get('curStudentPerformance')))));
  if (testType !== 's') {
    if (isCorrect) curUserPerformance.numCorrect = curUserPerformance.numCorrect + 1;
    curUserPerformance.percentCorrect = ((curUserPerformance.numCorrect / curUserPerformance.count)*100).toFixed(2) + '%';
    curUserPerformance.stimsSeen = parseInt(curUserPerformance.stimsSeen);
    curUserPerformance.totalStimCount = parseInt(curUserPerformance.totalStimCount);
  }
  curUserPerformance.count = curUserPerformance.count + 1;
  curUserPerformance.totalTime = parseInt(curUserPerformance.totalTime) + practiceTime;
  curUserPerformance.totalTimeDisplay = (curUserPerformance.totalTime / (1000*60)).toFixed(1);
  Session.set('constantTotalTime',curUserPerformance.totalTimeDisplay);
  Session.set('curStudentPerformance', curUserPerformance);
}

async function setStudentPerformance(studentID, studentUsername, tdfId) {
  console.log('setStudentPerformance:', studentID, studentUsername, tdfId);
  let studentPerformanceData;
  let studentPerformanceDataRet;
  let resetStudentPerformance = getCurrentDeliveryParams().resetStudentPerformance
  studentPerformanceDataRet = await meteorCallAsync('getStudentPerformanceByIdAndTDFId', studentID, tdfId, undefined ,resetStudentPerformance);
  if (isEmpty(studentPerformanceDataRet)) {
    studentPerformanceData = {
      numCorrect: 0,
      numIncorrect: 0,
      stimsSeen: 0,
      lastSeen: 0,
      totalStimCount: 0,
      totalPracticeDuration: 0,
      count: 0,
    };
  } else {
    studentPerformanceData = {
      numCorrect: parseInt(studentPerformanceDataRet.numCorrect) || 0,
      allTimeCorrect: parseInt(studentPerformanceDataRet.allTimeCorrect) || 0,
      allTimeIncorrect: parseInt(studentPerformanceDataRet.allTimeIncorrect) || 0,
      numIncorrect: parseInt(studentPerformanceDataRet.numIncorrect) || 0,
      lastSeen: parseInt(studentPerformanceDataRet.lastSeen) || 0,
      stimsSeen:  parseInt(studentPerformanceDataRet.stimsSeen)  || 0,
      totalStimCount: parseInt(studentPerformanceDataRet.totalStimCount) || 0,
      totalPracticeDuration: parseInt(studentPerformanceDataRet.totalPracticeDuration) || 0,
      allTimeTotalPracticeDuration: parseInt(studentPerformanceDataRet.allTimeTotalPracticeDuration) || 0,
      count: parseInt(studentPerformanceDataRet.count) || 0,
    };
  }
  const divisor = studentPerformanceData.numCorrect + studentPerformanceData.numIncorrect
  const percentCorrect = (divisor > 0) ? ((studentPerformanceData.numCorrect / divisor)*100).toFixed(2) + '%' : 'N/A';
  const studentPerformance = {
    'username': studentUsername,
    'count': studentPerformanceData.count,
    'percentCorrect': percentCorrect,
    'numCorrect': studentPerformanceData.numCorrect,
    'stimsSeen': studentPerformanceData.stimsSeen,
    'totalStimCount': studentPerformanceData.totalStimCount,
    'totalTime': studentPerformanceData.totalPracticeDuration,
    // convert from ms to min
    'totalTimeDisplay': (studentPerformanceData.totalPracticeDuration / (60 * 1000)).toFixed(1),
  };
  Session.set('curStudentPerformance', studentPerformance);
  console.log('setStudentPerformance,output:', studentPerformanceData, studentPerformance);
}

// Return the total number of stim clusters
function getStimCount() {
  const stimSet = Session.get('currentStimuliSet');
  let numClusters = 0;
  const seenClusters = {};
  for (const stim of stimSet) {
    if (!seenClusters[stim.clusterKC]) {
      seenClusters[stim.clusterKC] = true;
      numClusters += 1;
    }
  }
  return numClusters;
}

// Return the stim file cluster matching the index AFTER mapping it per the
// current sessions cluster mapping.
// Note that the cluster mapping goes from current session index to raw index in order of the stim file
function getStimCluster(clusterMappedIndex=0) {
  const clusterMapping = Session.get('clusterMapping');
  const rawIndex = clusterMapping ? clusterMapping[clusterMappedIndex] : clusterMappedIndex;
  const cluster = {
    shufIndex: clusterMappedIndex, // Tack these on for later logging purposes
    clusterIndex: rawIndex,
    stims: [],
  };
  for (const stim of Session.get('currentStimuliSet')) {
    if (stim.clusterKC % KC_MULTIPLE == rawIndex) {
      cluster.stims.push(stim);
    }
  }
  // let cluster = cachedStimu.stimu.setspec.clusters[mappedIndex];
  return cluster;
}

function getStimKCBaseForCurrentStimuliSet() {
  if (Session.get('currentStimuliSet')) {
    const oneOrderOfMagnitudeLess = (KC_MULTIPLE / 10);
    return Math.round((Session.get('currentStimuliSet')[0].clusterKC) / oneOrderOfMagnitudeLess) *
       oneOrderOfMagnitudeLess;
  }
}

// Given a cluster count, a shuffleclusters string, and a swapclusters string,
// create a mapping vector. The idea is that for cluster x, mapping[x] returns
// a translated index. Note that the default mapping is identity, so that
// mapping[x] = x HOWEVER, the user may submit a different default mapping.
// This is mainly so that multiple shuffle/swap pairs can be run. ALSO important
// is the fact that additional elements will be added if
// mapping.length < stimCount
function createStimClusterMapping(stimCount, shuffleclusters, swapclusters, startMapping) {
  if (stimCount < 1) {
    return [];
  }

  let i;

  // Default mapping is identity - mapping[x] == x
  // We also need to make sure we have stimCount elements
  let mapping = (startMapping || []).slice(); // they get a copy back
  while (mapping.length < stimCount) {
    mapping.push(mapping.length);
  }

  // Shufle the given ranges of cards (like permutefinalresult)
  if (shuffleclusters) {
    const shuffleRanges = [];
    extractDelimFields(shuffleclusters, shuffleRanges);

    const shuffled = mapping.slice(); // work on a copy

    _.each(shuffleRanges, function(rng) {
      const targetIndexes = rangeVal(rng);
      const randPerm = targetIndexes.slice(); // clone
      shuffle(randPerm);

      for (let j = 0; j < targetIndexes.length; ++j) {
        shuffled[targetIndexes[j]] = mapping[randPerm[j]];
      }
    });

    mapping = shuffled.slice();
  }

  // Swap out sections of clusters (one step up from our shuffle above)
  if (swapclusters) {
    // Get the chunks that we'll be swapping. Each chunk is in the format
    // of an array of integral indexes (after the map). We actually get
    // TWO lists of chunks - one in order and one that is the actual swap
    const ranges = [];
    extractDelimFields(swapclusters, ranges);
    const swapChunks = _.map(ranges, rangeVal);
    const sortChunks = _.map(ranges, rangeVal);

    // Now insure our sorted chunks are actually in order - we sort
    // numerically by the first index
    sortChunks.sort(function(lhs, rhs) {
      const lv = lhs[0]; const rv = rhs[0];
      if (lv < rv) return -1;
      else if (lv > rv) return 1;
      else return 0;
    });

    // Now get a permuted copy of our chunks
    shuffle(swapChunks);

    const swapped = [];
    i = 0;
    while (i < mapping.length) {
      if (sortChunks.length > 0 && i == sortChunks[0][0]) {
        // Swap chunk - grab the permuted chunk and add the mapped numbers
        const chunk = swapChunks.shift();
        for (let chunkIdx = 0; chunkIdx < chunk.length; ++chunkIdx) {
          swapped.push(mapping[chunk[chunkIdx]]);
        }

        // advance to the next chunk
        i += sortChunks.shift().length;
      } else {
        // Not part of a swapped chunk - keep this number and just move
        // to the next number
        swapped.push(mapping[i]);
        i++;
      }
    }

    // All done
    mapping = swapped.slice();
  }

  return mapping;
}

function getAllCurrentStimAnswers(removeExcludedPhraseHints) {
  const {curClusterIndex, curStimIndex} = getCurrentClusterAndStimIndices();
  const stims = Session.get('currentStimuliSet');
  let allAnswers = new Set();

  console.log(stims);
  for (const stim of stims) {
    const responseParts = stim.correctResponse.toLowerCase().split(';');
    const answerArray = responseParts.filter(function(entry) {
      return entry.indexOf('incorrect') == -1;
    });
    if (answerArray.length > 0) {
      const singularAnswer = answerArray[0].split('~')[0];
      allAnswers.add(singularAnswer);
    }
  }

  allAnswers = Array.from(allAnswers);

  if (removeExcludedPhraseHints) {
    const curSpeechHintExclusionListText =
        getStimCluster(curClusterIndex).stims[curStimIndex].speechHintExclusionList || '';
    const exclusionList = curSpeechHintExclusionListText.split(',');
    // Remove the optional phrase hint exclusions
    allAnswers = allAnswers.filter((el)=>exclusionList.indexOf(el)==-1);
  }

  return allAnswers;
}

function getTestType() {
  return _.trim(Session.get('testType')).toLowerCase();
}

// Return the delivery parms for the current unit. Note that we provide default
// values AND eliminate the single-value array issue from our XML-2-JSON mapping
//
// Note that the default mode is to use the current unit (thus the name), but we
// allow callers to override the unit assumed to be current
//
// IMPORTANT: we also support selecting one of multiple delivery params via
// experimentXCond (which can be specified in the URL or system-assigned)
function getCurrentDeliveryParams() {
  const currUnit = Session.get('currentTdfUnit');

  const isLearningSession = Session.get('unitType') == MODEL_UNIT;

  console.log('getCurrentDeliveryParams:', currUnit, isLearningSession);

  // Note that we will only extract values that have a specified default
  // value here.
  const deliveryParams = {
    'showhistory': false,
    'forceCorrection': false,
    'scoringEnabled': isLearningSession,
    'purestudy': 0,
    'initialview': 0,
    'drill': 0,
    'reviewstudy': 0.001,
    'refutationstudy': 0.001,
    'correctprompt': 0,
    'skipstudy': false,
    'lockoutminutes': 0,
    'fontsize': 3,
    'numButtonListImageColumns': 2,
    'correctscore': 1,
    'incorrectscore': 0,
    'practiceseconds': 0,
    'autostopTimeoutThreshold': 0,
    'autostopTranscriptionAttemptLimit': 3,
    'timeuntilaudio': 0,
    'timeuntilaudiofeedback': 0,
    'prestimulusdisplaytime': 0,
    'forcecorrectprompt': '',
    'forcecorrecttimeout': 0,
    'studyFirst': false,
    'enhancedFeedback': false,
    'checkOtherAnswers': false,
    'feedbackType': '',
    'allowFeedbackTypeSelect': false,
    'falseAnswerLimit': undefined,
    'allowstimulusdropping': false,
    'intertrialmessage': "",
    'allowPhoneticMatching': false,
    'useSpellingCorrection': false,
    'editDistance': 1,
    'optimalThreshold': false,
    'resetStudentPerformance': false
  };

  // We've defined defaults - also define translatations for values
  function xlateBool(v) {
    return v ? _.trim(v).toLowerCase() === 'true' : false;
  }

  function randListItem(list) {
    if(Array.isArray(list)) {
      return list[Math.floor(Math.random() * list.length)];
    }
    return list;
  }

  const xlations = {
    'showhistory': xlateBool,
    'forceCorrection': xlateBool,
    'scoringEnabled': xlateBool,
    'purestudy': _.intval,
    'skipstudy': xlateBool,
    'reviewstudy': _.intval,
    'refutationstudy': _.intval,
    'correctprompt': _.intval,
    'lockoutminutes': _.intval,
    'fontsize': _.intval,
    'numButtonListImageColumns': _.intval,
    'correctscore': _.intval,
    'incorrectscore': _.intval,
    'practiceseconds': _.intval,
    'timeuntilaudio': _.intval,
    'timeuntilaudiofeedback': _.intval,
    'prestimulusdisplaytime': _.intval,
    'studyFirst': xlateBool,
    'enhancedFeedback': xlateBool,
    'checkOtherAnswers': xlateBool,
    'allowFeedbackTypeSelect': xlateBool,
    'falseAnswerLimit': _.intval,
    'allowstimulusdropping': xlateBool,
    'allowPhoneticMatching': xlateBool,
    'useSpellingCorrection': xlateBool,
    'editDistance': _.intval,
    'optimalThreshold': _.intval,
    'resetStudentPerformance': xlateBool
  };

  let modified = false;
  let fieldName; // Used in loops below

  // Use the current unit specified to get the deliveryparams array. If there
  // isn't a unit then we use the top-level deliveryparams (if there are)
  let sourceDelParams = null;
  if (currUnit) {
    // We have a unit
    if (currUnit.deliveryparams) {
      // We may have multiple delivery params - select one
      sourceDelParams = randListItem(currUnit.deliveryparams);
    }
  } else {
    // No unit - we look for the top-level deliveryparams
    const tdf = Session.get('currentTdfFile');
    if (tdf && typeof tdf.tdfs.tutor.deliveryparams !== 'undefined') {
      sourceDelParams = tdf.tdfs.tutor.deliveryparams;
    }
  }

  if (sourceDelParams) {
    // Note that if there is no XCond or if they specify something
    // wacky we'll just go with index 0
    let xcondIndex = _.intval(Session.get('experimentXCond'));
    if (xcondIndex < 0 || xcondIndex >= sourceDelParams.length) {
      xcondIndex = 0; // Incorrect index gets 0
    }

    // If found del params, then use any values we find
    if (sourceDelParams) {
      for (fieldName in deliveryParams) {
        const fieldVal = sourceDelParams[fieldName];
        if (fieldVal) {
          deliveryParams[fieldName] = fieldVal;
          modified = true;
        }
      }
    }
  }

  // If we changed anything from the default, we should make sure
  // everything is properly xlated
  if (modified) {
    for (fieldName in deliveryParams) {
      const currVal = deliveryParams[fieldName];
      const xlation = xlations[fieldName];
      if (xlation) {
        deliveryParams[fieldName] = xlation(currVal);
      }
    }
  }

  // If there's no feedback type defined by the TDF author
  // or if the user is allowed to select a feedback type,
  // type selected with the profile page toggle
  if (!deliveryParams['feedbackType'].length ||
      deliveryParams['allowFeedbackTypeSelect']) {
    deliveryParams['feedbackType'] =
        dialogueSelectState.get('selectedDialogueType');
  }

  return deliveryParams;
}
