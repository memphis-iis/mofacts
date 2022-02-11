import {setStudentPerformance} from '../../lib/currentTestingHelpers';
import {INVALID} from '../../../common/Definitions';
import {meteorCallAsync} from '../..';
import gauge, {
  Gauge,
  Donut,
  BaseDonut,
  TextRenderer

} from '../../lib/gauge.js';

Session.set('studentReportingTdfs', []);
Session.set('curStudentPerformance', {});

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

//Set Tooltips
// Select all elements with data-toggle="tooltips" in the document
$('[data-toggle="tooltip"]').tooltip();

Template.studentReporting.helpers({
  studentReportingTdfs: () => Session.get('studentReportingTdfs'),
  curClassPerformance: () => Session.get('curClassPerformance'),
  curClass: () => Session.get('curClass'),
  curTotalAttempts: function(){
    curTotalAttempts = Session.get('curTotalAttempts');
    if(curTotalAttempts.isNan()){
      return "0";
    } else {
      return curTotalAttempts;
    }
  },
  curStudentPerformance: () => Session.get('curStudentPerformance'),
  curTotalTime: () => Session.get('practiceDuration'),
  curStudentPerformanceCorrectInInteger: function() {
    var percentCorrectInteger = parseFloat(Session.get('stimsSeenPercentCorrect')).toFixed(0);
    return percentCorrectInteger;
  },
  studentUsername: () => Session.get('studentUsername'),
  stimsSeenPredictedProbability: () => Session.get('stimsSeenPredictedProbability'),
  stimsNotSeenPredictedProbability: () => Session.get('stimsNotSeenPredictedProbability'),
  stimCount: () => Session.get('stimCount'),
  stimsSeen: () => Session.get('stimsSeen'),
  itemMasteryRate: () => Session.get('itemMasteryRate'),
  itemMasteryTime: () => Session.get('itemMasteryTime'),
  displayItemsMasteredPerMinute: () => Session.get('displayItemMasteryRate'),
  displayEstimatedMasteryTime: () => Session.get('displayEstimatedMasteryTime'),
  INVALID: INVALID,
});

Template.studentReporting.rendered = async function() {
  window.onpopstate = function(event) {
    console.log('window popstate student reporting');
    if (document.location.pathname == '/studentReporting' && Session.get('loginMode') === 'southwest') {
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
});

async function updateDashboard(selectedTdfId){
  console.log('change tdf select', selectedTdfId);
  if (selectedTdfId!==INVALID) {
    $(`#tdf-select option[value='${INVALID}']`).prop('disabled', true);
    $(`#select option[value='${INVALID}']`).prop('disabled', true);
    const studentID = Session.get('curStudentID') || Meteor.userId();
    const studentUsername = Session.get('studentUsername') || Meteor.user().username;
    const studentData = await meteorCallAsync('getStudentReportingData', studentID, selectedTdfId, "0");
    console.log("studentData loaded...",studentData);
    setStudentPerformance(studentID, studentUsername, selectedTdfId);
    drawDashboard(studentID, selectedTdfId);
    $('#tdf-select').val(selectedTdfId);
  }
}

async function drawDashboard(studentId, selectedTdfId){
  // Get TDF Parameters
  selectedTdf = await meteorCallAsync('getTdfById',selectedTdfId);
  selectedTdfIdProgressReportParams = selectedTdf.content.tdfs.tutor.setspec.progressReporterParams;
  console.log('selectedTdfIdProgressReportParams',selectedTdfIdProgressReportParams);
  if(typeof selectedTdfIdProgressReportParams === "undefined"){
    selectedTdfIdProgressReportParams = [0.7,30,60,30,90,60];
  } 
  const [optimumDifficulty, difficultyHistory, masteryDisplay, masteryHistory, timeToMasterDisplay, timeToMasterHistory] = selectedTdfIdProgressReportParams;
  console.log('expanded params',  optimumDifficulty, difficultyHistory, masteryDisplay, masteryHistory, timeToMasterDisplay, timeToMasterHistory);
  //Get Student Data
  const curStudentGraphData = await meteorCallAsync('getStudentPerformanceByIdAndTDFId',studentId,selectedTdfId,null,null);
  const speedOfLearningData = await meteorCallAsync('getStudentPerformanceByIdAndTDFId',studentId,selectedTdfId,null,30);
  const masteryRateData = await meteorCallAsync('getStudentPerformanceByIdAndTDFId',studentId,selectedTdfId,null,masteryHistory);
  const masteryEstimateData = await meteorCallAsync('getStudentPerformanceByIdAndTDFId',studentId,selectedTdfId,null,timeToMasterHistory);
  const difficultyData = await meteorCallAsync('getStudentPerformanceByIdAndTDFId',studentId,selectedTdfId,null,difficultyHistory);
  console.log("difficultyData", masteryEstimateData)
  //Expand Data
  const {numCorrect, numIncorrect, totalStimCount, stimsSeen,  totalPracticeDuration, stimsIntroduced} = curStudentGraphData;
    // Perform calculated data
  totalAttempts = parseFloat(numCorrect) + parseFloat(numIncorrect)
  percentCorrect = (parseFloat(numCorrect) / totalAttempts) * 100;
  totalPracticeDurationMinutes = totalPracticeDuration / 60000;
  totalPracticeDurationMinutesDisplay = totalPracticeDurationMinutes.toFixed();
  percentStimsSeen = parseFloat(stimsSeen) / parseFloat(totalStimCount) * 100;
  speedOfLearning = Math.log(1+parseFloat(speedOfLearningData.stimsIntroduced)) * 100;
  difficultyCorrectProportion = parseFloat(difficultyData.numCorrect) / (parseFloat(difficultyData.numCorrect) + parseFloat(difficultyData.numIncorrect));
  displayDifficulty =  (Math.min(Math.max(difficultyCorrectProportion - optimumDifficulty, -0.3) , 0.3) + 0.3) * 100; //Add .3 and Multiply by 100 for graph scale
  totalPracticeDurationMasteryMinutes = masteryRateData.totalPracticeDuration / 60000;
  itemMasteryRate = parseFloat(masteryRateData.stimsIntroduced) / totalPracticeDurationMasteryMinutes;
  totalPracticeDurationMasteryEstMinutes = masteryEstimateData.totalPracticeDuration /60000;
  itemMasteryRateEstimated = parseFloat(masteryEstimateData.stimsIntroduced) / totalPracticeDurationMasteryEstMinutes
  estimatedTimeMastery = itemMasteryRateEstimated * (parseFloat(totalStimCount) - parseFloat(stimsIntroduced));
  Session.set('stimCount',parseFloat(totalStimCount));
  Session.set('stimsSeen',stimsSeen);
  Session.set('curTotalAttempts',totalAttempts);
  Session.set('practiceDuration', totalPracticeDurationMinutesDisplay);
  Session.set('itemMasteryRate', itemMasteryRate.toFixed(0));
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
  }
  else{
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