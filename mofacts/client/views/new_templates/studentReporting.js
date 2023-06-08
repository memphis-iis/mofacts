import {setStudentPerformance} from '../../lib/currentTestingHelpers';
import {INVALID} from '../../../common/Definitions';
import {meteorCallAsync} from '../..';
import gauge, {
  Gauge,
  Donut,
  BaseDonut,
  TextRenderer

} from '../../lib/gauge';
import { _ } from 'core-js';
import {sessionCleanUp} from '../../lib/sessionUtils';
import {getExperimentState, updateExperimentState} from '../experiment/card';


Session.set('studentReportingTdfs', []);
Session.set('studentReportingTdfs', undefined);

let gaugeOptionsSpeedOfLearning = {
  angle: 0,
  lineWidth: 0.22,
  radiusScale:0.9,
  pointer: {
    length: 0.5,
    strokeWidth: 0.05,
    color: '#000000'
  },
  staticZones: [
     {strokeStyle: "#a1fa73", min: 0, max: 50, height: 2},
     {strokeStyle: "#96fa59", min: 51, max: 100, height: 1.8},
     {strokeStyle: "#96fa59", min: 101, max: 150, height: 1.6},
     {strokeStyle: "#8dc346", min: 151, max: 200, height: 1.4},
     {strokeStyle: "#979336", min: 201, max: 250, height: 1.2},
     {strokeStyle: "#b36427", min: 251, max: 300, height: 1.2},
     {strokeStyle: "#dc201a", min: 301, max: 350, height: 1},

  ],
  renderTicks: {
    divisions: 5,
    divWidth: 1.1,
    divLength: 0.7,
    divColor: '#333333',
    subDivisions: 3,
    subLength: 0.5,
    subWidth: 0.6,
    subColor: '#666666'
  },

  limitMax: false,
  limitMin: false,
  highDpiSupport: true
};
let gaugeOptionsDifficulty = {
  angle: 0,
  lineWidth: 0.22,
  radiusScale:0.9,
  pointer: {
    length: 0.5,
    strokeWidth: 0.05,
    color: '#000000'
  },
  staticZones: [
     {strokeStyle: "#F03E3E", min: 0, max: 6, height: 1},
     {strokeStyle: "#FFDD00", min: 6, max: 12, height: 1},
     {strokeStyle: "#30B32D", min: 12, max: 48, height: 1},
     {strokeStyle: "#FFDD00", min: 48, max: 54, height: 1},
     {strokeStyle: "#F03E3E", min: 54, max: 60, height: 1},

  ],
  renderTicks: {
    divisions: 5,
    divWidth: 1.1,
    divLength: 0.7,
    divColor: '#333333',
    subDivisions: 3,
    subLength: 0.5,
    subWidth: 0.6,
    subColor: '#666666'
  },
  limitMax: false,
  limitMin: false,
  highDpiSupport: true
};
let donutOptionsMasteredItems = {
  lines: 12, // The number of lines to draw
  angle: .4, // The length of each line
  lineWidth: 0.13, // The line thickness
  pointer: {
    length: 0.9, // The radius of the inner circle
    strokeWidth: 0.035, // The rotation offset
    color: '#333' // Fill color
  },
  limitMax: 'true', // If true, the pointer will not go past the end of the gauge
  colorStart: '#008351', // Colors
  colorStop: '#008351', // just experiment with them
  strokeColor: '#EEEEEE', // to see which ones work best for you
  generateGradient: true
};


Template.studentReporting.helpers({
  studentReportingTdfs: () => Session.get('studentReportingTdfs'),
  curClassPerformance: () => Session.get('curClassPerformance'),
  curClass: () => Meteor.user().profile.curClass,
  selectedTdfDueDate: () => Session.get('selectedTdfDueDate'),
  curTotalAttempts: () => Session.get('curTotalAttempts') || 0,
  curStudentPerformance: () => Session.get('curStudentPerformance'),
  curTotalTime: () => Session.get('practiceDuration'),
  noTime: () => Session.get('practiceDuration') === 0,
  curStudentPerformanceCorrectInInteger: function() {
    var percentCorrectInteger = parseFloat(Session.get('stimsSeenPercentCorrect')).toFixed(0);
    return percentCorrectInteger;
  },
  studentUsername: () => Session.get('studentUsername'),
  stimsSeenPredictedProbability: () => Session.get('stimsSeenPredictedProbability'),
  stimsNotSeenPredictedProbability: () => Session.get('stimsNotSeenPredictedProbability'),
  stimCount: () => Session.get('stimCount'),
  stimsSeen: () => Session.get('stimsSeen'),
  tooFewStims: () => Session.get('stimsSeen'),
  itemMasteryRate: () => Session.get('itemMasteryRate'),
  itemMasteryTime: () => Session.get('itemMasteryTime'),
  displayItemsMasteredPerMinute: () => Session.get('displayItemMasteryRate'),
  displayEstimatedMasteryTime: () => Session.get('displayEstimatedMasteryTime'),
  exception: () => Session.get('exception'),
  selectedTdf: () => Session.get('selectedTdf'),
  lastTdf: async function() {
    const recentTdfs = await meteorCallAsync('getUserRecentTDFs', Meteor.userId());
    return recentTdfs[0];
  },
  INVALID: INVALID,
});

Template.studentReporting.rendered = async function() {
  console.log("toofewstims", Session.get('tooFewStims'));
  console.log("noTime", Session.get('practiceDuration') === 0);
  Session.set('curTotalAttempts', 0);
  Session.set('practiceDuration', 0);
  window.onpopstate = function(event) {
    console.log('window popstate student reporting');
    if (document.location.pathname == '/studentReporting' && Meteor.user().profile.loginMode === 'southwest') {
      Router.go('/profileSouthwest');
    } else {
      Router.go('/profile');
    }
  };
  console.log('studentReporting rendered!!!');

  const studentUsername = Session.get('studentUsername') || Meteor.user().username;
  const studentID = Session.get('curStudentID') || Meteor.userId();
  console.log('student,', studentUsername, studentID);

  const tdfsAttempted = await meteorCallAsync('getTdfIDsAndDisplaysAttemptedByUserId', studentID);
  Session.set('studentReportingTdfs', tdfsAttempted);
  console.log('studentReportingTdfs', tdfsAttempted);

  // let dataAlreadyInCache = false;
  if (Roles.userIsInRole(Meteor.user(), ['admin', 'teacher'])) {
    console.log('admin/teacher');
  } else {
    Session.set('curStudentID', studentID);
    Session.set('studentUsername', studentUsername);
  }
  if (Session.get('instructorSelectedTdf')) {
    Tracker.afterFlush(async function() {
      const tdfToSelect = Session.get('instructorSelectedTdf');
      $('#tdf-select').val(tdfToSelect);
      setStudentPerformance(studentID, studentUsername, tdfToSelect);
    });
  }
  updateDashboard(Session.get('currentTdfId'));
};

Template.studentReporting.events({
  'change #tdf-select': async function(event) {
    const selectedTdfId = $(event.currentTarget).val();
    updateDashboard(selectedTdfId)
  },
  'click #go-to-lesson-select': function(event) {
    event.preventDefault();
    Router.go('/lessonSelect');
  },
  'click #go-to-lesson-continue': function(event) {
    event.preventDefault();
    console.log(event);
    const target = $(event.currentTarget);
    selectTdf(
        target.data('tdfid'),
        target.data('lessonname'),
        target.data('currentstimulisetid'),
        target.data('ignoreoutofgrammarresponses'),
        target.data('speechoutofgrammarfeedback'),
        'User button click',
        target.data('ismultitdf'),
        false,
    );
  }
});

async function updateDashboard(selectedTdfId){
  console.log('change tdf select', selectedTdfId);
  if (selectedTdfId && selectedTdfId!==INVALID) {
    $(`#tdf-select option[value='${INVALID}']`).prop('disabled', true);
    $(`#select option[value='${INVALID}']`).prop('disabled', true);
    curTdf = selectedTdfId;
    tdfData = Session.get('allTdfs').find((x) => x._id == curTdf);
    tdfDate = tdfData.content.tdfs.tutor.setspec.duedate;
    console.log('tdfDate', tdfDate, tdfData);
    Session.set('selectedTdfDueDate', tdfDate);
    exception = await meteorCallAsync('checkForUserException',Meteor.userId(), curTdf);
    Session.set('exception', exception);
    console.log('exception', exception);
    const studentID = Session.get('curStudentID') || Meteor.userId();
    const studentUsername = Session.get('studentUsername') || Meteor.user().username;
    setStudentPerformance(studentID, studentUsername, selectedTdfId);
    drawDashboard(studentID, selectedTdfId);
    $('#tdf-select').val(selectedTdfId);
  } else {
    //make the selected tdf variable false
    Session.set('selectedTdf', false);
  }
}

async function drawDashboard(studentId, selectedTdfId){
  // Get TDF Parameters
  selectedTdf = Tdfs.findOne({_id: selectedTdfId});
  //set tdf as selected tdf session variable
  const TDFId = selectedTdf._id;
  const tdfObject = selectedTdf.content;
  const isMultiTdf = tdfObject.isMultiTdf;
  const currentStimuliSetId = selectedTdf.stimuliSetId;
  const setspec = tdfObject.tdfs.tutor.setspec ? tdfObject.tdfs.tutor.setspec : null;
  const name = setspec.lessonname;
  const ignoreOutOfGrammarResponses = setspec.speechIgnoreOutOfGrammarResponses ?
      setspec.speechIgnoreOutOfGrammarResponses.toLowerCase() == 'true' : false;
  const speechOutOfGrammarFeedback = setspec.speechOutOfGrammarFeedback ?
      setspec.speechOutOfGrammarFeedback : 'Response not in answer set';
  const displayTdf = {
    tdfid: TDFId,
    lessonName: name,
    currentStimuliSetId: currentStimuliSetId,
    ignoreOutOfGrammarResponses: ignoreOutOfGrammarResponses,
    speechOutOfGrammarFeedback: speechOutOfGrammarFeedback,
    how: 'User button click',
    isMultiTdf: isMultiTdf,
  };
  Session.set('selectedTdf', displayTdf);
  selectedTdfIdProgressReportParams = selectedTdf.content.tdfs.tutor.setspec.progressReporterParams;
  let curStimSetId = selectedTdf.stimuliSetId;
  let clusterlist = [];
  for(let unit of selectedTdf.content.tdfs.tutor.unit){
    if(unit.learningsession){
      let list = unit.learningsession.clusterlist.split('-');
      for(let unitNumber of _.range(parseInt(list[0]), parseInt(list[1]) + 1))
        clusterlist.push(unitNumber + 10000 * curStimSetId)
    }
  }
  console.log('selectedTdfIdProgressReportParams',selectedTdfIdProgressReportParams);
  const [optimumDifficulty, difficultyHistory, masteryDisplay, masteryHistory, timeToMasterDisplay, timeToMasterHistory] = selectedTdfIdProgressReportParams;
  console.log('expanded params',  optimumDifficulty, difficultyHistory, masteryDisplay, masteryHistory, timeToMasterDisplay, timeToMasterHistory);
  //Get Student Data
  const stimids = await meteorCallAsync('getStimSetFromLearningSessionByClusterList', curStimSetId, clusterlist);
  const curStudentGraphData = await meteorCallAsync('getStudentPerformanceByIdAndTDFId', studentId, selectedTdfId, stimids);
  console.log("curStudentGraphData(all trials)", curStudentGraphData);
  //Expand Data
  if(curStudentGraphData){
    const curStudentTotalData = await meteorCallAsync('getStudentPerformanceByIdAndTDFId', studentId, selectedTdfId);
    const speedOfLearningData = await meteorCallAsync('getStudentPerformanceByIdAndTDFIdFromHistory', studentId, selectedTdfId, 30);
    const masteryRateData = await meteorCallAsync('getStudentPerformanceByIdAndTDFIdFromHistory', studentId, selectedTdfId, masteryHistory);
    const masteryEstimateData = await meteorCallAsync('getStudentPerformanceByIdAndTDFIdFromHistory', studentId, selectedTdfId, timeToMasterHistory);
    const difficultyData = await meteorCallAsync('getStudentPerformanceByIdAndTDFIdFromHistory', studentId, selectedTdfId, difficultyHistory);
    const numDroppedStims = await meteorCallAsync('getNumDroppedItemsByUserIDAndTDFId', studentId, selectedTdfId);
    console.log(`speedOfLearningData(${30} trials)`, speedOfLearningData);
    console.log(`masteryRateData(${masteryHistory} trials)`, masteryRateData);
    console.log(`masteryEstimateData(${timeToMasterHistory} trials)`, masteryEstimateData);
    console.log(`difficultyData(${difficultyHistory} trials)`, difficultyData);
    let {totalStimCount, stimsIntroduced} = curStudentGraphData;
    const {allTimeNumCorrect, allTimeNumIncorrect, allTimePracticeDuration} = curStudentTotalData;
    totalAttempts = parseFloat(allTimeNumCorrect) + parseFloat(allTimeNumIncorrect);
    console.log('totalAttempts', totalAttempts);
    percentCorrect = (parseFloat(allTimeNumCorrect) / totalAttempts) * 100;
    totalPracticeDurationInMinutes = allTimePracticeDuration / 60000;
    totalPracticeDurationMinutesDisplay = totalPracticeDurationInMinutes.toFixed();
    percentStimsSeen = parseFloat(stimsIntroduced - numDroppedStims) / parseFloat(totalStimCount - numDroppedStims) * 100;
    speedOfLearning = Math.log(1+parseFloat(speedOfLearningData.stimsIntroduced)) * 100;
    difficultyCorrectProportion = parseFloat(difficultyData.numCorrect) / (parseFloat(difficultyData.numCorrect) + parseFloat(difficultyData.numIncorrect));
    displayDifficulty =  (Math.min(Math.max(difficultyCorrectProportion - optimumDifficulty, -0.3) , 0.3) + 0.3) * 100; //Add .3 and Multiply by 100 for graph scale
    totalPracticeDurationMasteryMinutes = masteryRateData.practiceDuration / 60000;
    itemMasteryRate = parseFloat(masteryRateData.stimsIntroduced) / totalPracticeDurationMasteryMinutes;
    totalPracticeDurationMasteryEstMinutes = masteryEstimateData.practiceDuration /60000;
    itemMasteryRateEstimated = parseFloat(masteryEstimateData.stimsIntroduced) / totalPracticeDurationMasteryEstMinutes
    estimatedTimeMastery = itemMasteryRateEstimated * (parseFloat(totalStimCount) - parseFloat(stimsIntroduced));
    Session.set('stimCount',parseFloat(totalStimCount) - numDroppedStims);
    Session.set('stimsSeen',stimsIntroduced - numDroppedStims);
    Session.set('curTotalAttempts',totalAttempts);
    Session.set('practiceDuration', totalPracticeDurationMinutesDisplay);
    Session.set('itemMasteryRate', itemMasteryRate.toFixed(2));
    Session.set('itemMasteryTime',estimatedTimeMastery.toFixed(0));
    if(totalAttempts >= masteryDisplay){
      Session.set('displayItemMasteryRate',true);
    } else {
      Session.set('displayItemMasteryRate',false);
    }
    if(totalAttempts >= timeToMasterDisplay){
      Session.set('displayEstimatedMasteryTime', true);
    } else {
      Session.set('displayEstimatedMasteryTime', false);
    }
    
      
    //Draw Dashboard
    if(Session.get('curTotalAttempts') > 29){
      $('#dashboardGauges').show();
      $('#guagesUnavailableMsg').hide();
      let dashCluster = [];
      dashClusterCanvases = document.getElementsByClassName('dashCanvas');
      for(let dash of dashClusterCanvases){
        if(dash.classList.contains('masteredItems')){
          console.log(dash);
          let gaugeMeter = new progressGauge(dash,"donut",0,100,donutOptionsMasteredItems);
          dashCluster.push(gaugeMeter);
        }
        if(dash.classList.contains('learningSpeed')){
          console.log(dash);
          let gaugeMeter = new progressGauge(dash,"gauge",0,350,gaugeOptionsSpeedOfLearning);
          dashCluster.push(gaugeMeter);
        }
        if(dash.classList.contains('difficulty')){
          console.log(dash);
          let gaugeMeter = new progressGauge(dash,"gauge",0,60,gaugeOptionsDifficulty);
          dashCluster.push(gaugeMeter);
        }
      }
    
      //Populate Dashboard values
      console.log('Testing dashCluster:',dashCluster);
      dashCluster[0].set(percentStimsSeen);
      dashCluster[1].set(speedOfLearning);
      dashCluster[2].set(displayDifficulty);

    } else {
      $('#dashboardGauges').hide();
      $('#guagesUnavailableMsg').show();
    }
  } else {
    Session.set('practiceDuration', 0);
    Session.set('curTotalAttempts', 0);
    $('#dashboardGauges').hide();
    $('#guagesUnavailableMsg').show();
  }
}
function progressGauge(target, gaugeType, currentValue,maxValue,options = defaultGaugeOptions){
    if(target != undefined){
      console.log('gauge canvas found and loaded.')
      console.log('gaugeType',gaugeType);
      if(gaugeType == "gauge"){ gauge = new Gauge(target).setOptions(options);} 
      if(gaugeType == "donut"){ gauge = new Donut(target).setOptions(options);}
      gauge.maxValue = maxValue; // set max gauge value
      gauge.animationSpeed = 32; // set animation speed (32 is default value)
      gauge.set(currentValue); // set actual value
      gauge.setTextField(document.getElementById("preview-textfield"));
      return gauge;
  } else {
      console.log('canvas not found in DOM call.')
  }
 
}

function lookUpLabelByDataValue(labels, series, value) {
  return labels[series.findIndex(function(element) {
    return element == value;
  })];
}

async function selectTdf(currentTdfId, lessonName, currentStimuliSetId, ignoreOutOfGrammarResponses, 
  speechOutOfGrammarFeedback, how, isMultiTdf, fromSouthwest, setspec, isExperiment = false) {
  console.log('Starting Lesson', lessonName, currentTdfId,
      'currentStimuliSetId:', currentStimuliSetId, 'isMultiTdf:', isMultiTdf);

  const audioPromptFeedbackView = Session.get('audioPromptFeedbackView');

  // make sure session variables are cleared from previous tests
  sessionCleanUp();

  // Set the session variables we know
  // Note that we assume the root and current TDF names are the same.
  // The resume logic in the the card template will determine if the
  // current TDF should be changed due to an experimental condition
  Session.set('currentRootTdfId', currentTdfId);
  Session.set('currentTdfId', currentTdfId);
  const tdfResponse = Tdfs.findOne({_id: currentTdfId});
  const curTdfContent = tdfResponse.content;
  const curTdfTips = tdfResponse.content.tdfs.tutor.setspec.tips;
  Session.set('currentTdfFile', curTdfContent);
  Session.set('currentTdfName', curTdfContent.fileName);
  Session.set('currentStimuliSetId', currentStimuliSetId);
  Session.set('ignoreOutOfGrammarResponses', ignoreOutOfGrammarResponses);
  Session.set('speechOutOfGrammarFeedback', speechOutOfGrammarFeedback);
  Session.set('curTdfTips', curTdfTips)

  // Record state to restore when we return to this page
  let audioPromptMode;
  let audioInputEnabled;
  let audioPromptFeedbackSpeakingRate;
  let audioPromptQuestionSpeakingRate;
  let audioPromptVoice;
  let audioInputSensitivity;
  let audioPromptQuestionVolume
  let audioPromptFeedbackVolume
  let feedbackType
  let audioPromptFeedbackVoice
  if(isExperiment) {
    audioPromptMode = setspec.audioPromptMode || 'silent';
    audioInputEnabled = setspec.audioInputEnabled || false;
    audioPromptFeedbackSpeakingRate = setspec.audioPromptFeedbackSpeakingRate || 1;
    audioPromptQuestionSpeakingRate = setspec.audioPromptQuestionSpeakingRate || 1;
    audioPromptVoice = setspec.audioPromptVoice || 'en-US-Standard-A';
    audioInputSensitivity = setspec.audioInputSensitivity || 20;
    audioPromptQuestionVolume = setspec.audioPromptQuestionVolume || 0;
    audioPromptFeedbackVolume = setspec.audioPromptFeedbackVolume || 0;
    feedbackType = setspec.feedbackType;
    audioPromptFeedbackVoice = setspec.audioPromptFeedbackVoice || 'en-US-Standard-A';
  }  
  else {
    audioPromptMode = getAudioPromptModeFromPage();
    audioInputEnabled = getAudioInputFromPage();
    audioPromptFeedbackSpeakingRate = document.getElementById('audioPromptFeedbackSpeakingRate').value;
    audioPromptQuestionSpeakingRate = document.getElementById('audioPromptQuestionSpeakingRate').value;
    audioPromptVoice = document.getElementById('audioPromptVoice').value;
    audioInputSensitivity = document.getElementById('audioInputSensitivity').value;
    audioPromptQuestionVolume = document.getElementById('audioPromptQuestionVolume').value;
    audioPromptFeedbackVolume = document.getElementById('audioPromptFeedbackVolume').value;
    feedbackType = await meteorCallAsync('getUserLastFeedbackTypeFromHistory', currentTdfId);
    audioPromptFeedbackVoice = document.getElementById('audioPromptFeedbackVoice').value;
    if(feedbackType)
      Session.set('feedbackTypeFromHistory', feedbackType.feedbacktype)
    else
      Session.set('feedbackTypeFromHistory', null);
  }
  Session.set('audioPromptMode', audioPromptMode);
  Session.set('audioPromptFeedbackView', audioPromptMode);
  Session.set('audioEnabledView', audioInputEnabled);
  Session.set('audioPromptFeedbackSpeakingRateView', audioPromptFeedbackSpeakingRate);
  Session.set('audioPromptQuestionSpeakingRateView', audioPromptQuestionSpeakingRate);
  Session.set('audioPromptVoiceView', audioPromptVoice)
  Session.set('audioInputSensitivityView', audioInputSensitivity);
  Session.set('audioPromptQuestionVolume', audioPromptQuestionVolume);
  Session.set('audioPromptFeedbackVolume', audioPromptFeedbackVolume);
  Session.set('audioPromptFeedbackVoiceView', audioPromptFeedbackVoice)
  if(feedbackType)
    Session.set('feedbackTypeFromHistory', feedbackType.feedbacktype)
  else
    Session.set('feedbackTypeFromHistory', null);

  // Set values for card.js to use later, in experiment mode we'll default to the values in the tdf
  Session.set('audioPromptFeedbackSpeakingRate', audioPromptFeedbackSpeakingRate);
  Session.set('audioPromptQuestionSpeakingRate', audioPromptQuestionSpeakingRate);
  Session.set('audioPromptVoice', audioPromptVoice);
  Session.set('audioPromptFeedbackVoice', audioPromptFeedbackVoice);
  Session.set('audioInputSensitivity', audioInputSensitivity);

  // Get some basic info about the current user's environment
  let userAgent = '[Could not read user agent string]';
  let prefLang = '[N/A]';
  try {
    userAgent = _.display(navigator.userAgent);
    prefLang = _.display(navigator.language);
  } catch (err) {
    console.log('Error getting browser info', err);
  }

  // Check to see if the user has turned on audio prompt.
  // If so and if the tdf has it enabled then turn on, otherwise we won't do anything
  const userAudioPromptFeedbackToggled = (audioPromptFeedbackView == 'feedback') || (audioPromptFeedbackView == 'all') || (audioPromptFeedbackView == 'question');
  console.log(curTdfContent);
  const tdfAudioPromptFeedbackEnabled = !!curTdfContent.tdfs.tutor.setspec.enableAudioPromptAndFeedback &&
      curTdfContent.tdfs.tutor.setspec.enableAudioPromptAndFeedback == 'true';
  const audioPromptTTSAPIKeyAvailable = !!curTdfContent.tdfs.tutor.setspec.textToSpeechAPIKey &&
      !!curTdfContent.tdfs.tutor.setspec.textToSpeechAPIKey;
  let audioPromptFeedbackEnabled = undefined;
  if (Session.get('experimentTarget')) {
    audioPromptFeedbackEnabled = tdfAudioPromptFeedbackEnabled;
  } else if (fromSouthwest) {
    audioPromptFeedbackEnabled = tdfAudioPromptFeedbackEnabled &&
        userAudioPromptFeedbackToggled && audioPromptTTSAPIKeyAvailable;
  } else {
    audioPromptFeedbackEnabled = tdfAudioPromptFeedbackEnabled && userAudioPromptFeedbackToggled;
  }
  Session.set('enableAudioPromptAndFeedback', audioPromptFeedbackEnabled);

  // If we're in experiment mode and the tdf file defines whether audio input is enabled
  // forcibly use that, otherwise go with whatever the user set the audio input toggle to
  const userAudioToggled = audioInputEnabled;
  const tdfAudioEnabled = curTdfContent.tdfs.tutor.setspec.audioInputEnabled ?
      curTdfContent.tdfs.tutor.setspec.audioInputEnabled == 'true' : false;
  const audioEnabled = !Session.get('experimentTarget') ? (tdfAudioEnabled && userAudioToggled) : tdfAudioEnabled;
  Session.set('audioEnabled', audioEnabled);

  let continueToCard = true;

  if (Session.get('audioEnabled')) {
    // Check if the tdf or user has a speech api key defined, if not show the modal form
    // for them to input one.  If so, actually continue initializing web audio
    // and going to the practice set
    Meteor.call('getUserSpeechAPIKey', function(error, key) {
      Session.set('speechAPIKey', key);
      const tdfKeyPresent = !!curTdfContent.tdfs.tutor.setspec.speechAPIKey &&
          !!curTdfContent.tdfs.tutor.setspec.speechAPIKey;
      if (!key && !tdfKeyPresent) {
        console.log('speech api key not found, showing modal for user to input');
        $('#speechAPIModal').modal('show');
        continueToCard = false;
      } else {
        console.log('audio input enabled and key present, navigating to card and initializing audio input');
      }
    });
  } else {
    console.log('audio toggle not checked, navigating to card');
  }

  // Go directly to the card session - which will decide whether or
  // not to show instruction
  if (continueToCard) {
    const newExperimentState = {
      userAgent: userAgent,
      browserLanguage: prefLang,
      selectedHow: how,
      isMultiTdf: isMultiTdf,
      currentTdfId,
      currentTdfName: curTdfContent.fileName,
      currentStimuliSetId: currentStimuliSetId,
    };
    updateExperimentState(newExperimentState, 'profile.selectTdf');

    Session.set('inResume', true);
    if (isMultiTdf) {
      navigateForMultiTdf();
    } else {
      Router.go('/card');
    }
  }
}

async function navigateForMultiTdf() {
  function getUnitType(curUnit) {
    let unitType = 'other';
    if (curUnit.assessmentsession) {
      unitType = SCHEDULE_UNIT;
    } else if (curUnit.learningsession) {
      unitType = MODEL_UNIT;
    }
    return unitType;
  }

  const experimentState = await getExperimentState();
  const lastUnitCompleted = experimentState.lastUnitCompleted || -1;
  const lastUnitStarted = experimentState.lastUnitStarted || -1;
  let unitLocked = false;

  // If we haven't finished the unit yet, we may want to lock into the current unit
  // so the user can't mess up the data
  if (lastUnitStarted > lastUnitCompleted) {
    const curUnit = experimentState.currentTdfUnit; // Session.get("currentTdfUnit");
    const curUnitType = getUnitType(curUnit);
    // We always want to lock users in to an assessment session
    if (curUnitType === SCHEDULE_UNIT) {
      unitLocked = true;
    } else if (curUnitType === MODEL_UNIT) {
      if (!!curUnit.displayMinSeconds || !!curUnit.displayMaxSeconds) {
        unitLocked = true;
      }
    }
  }
  // Only show selection if we're in a unit where it doesn't matter (infinite learning sessions)
  if (unitLocked) {
    Router.go('/card');
  } else {
    Router.go('/multiTdfSelect');
  }
}

function getAudioInputFromPage() {
  return $('#audioInputOn').checked;
}

function getAudioPromptModeFromPage() {
if ($('#audioPromptFeedbackOn').checked && $('#audioPromptQuestionOn').checked) {
  return 'all';
} else if ($('#audioPromptFeedbackOn').checked){
  return 'feedback';
} else if ($('#audioPromptQuestionOn').checked) {
  return 'question';
} else {
  return 'silent';
}
}