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
  curTotalAttempts: () => Session.get('curTotalAttempts'),
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
  displayDashboard: function(){
    var totalAttempts = Session.get('curTotalAttempts');
    if(totalAttempts > 29){
      return true;
    } else {
      return false;
    }
  },
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
    const curStudentGraphData = await meteorCallAsync('getStudentPerformanceByIdAndTDFId',studentID,selectedTdfId,"0",30);

    console.log('studentData', studentData);
    console.log('curStudentGraphData',curStudentGraphData);
    
    setStudentPerformance(studentID, studentUsername, selectedTdfId);
    drawDashboard(curStudentGraphData, studentData);
    $('#tdf-select').val(selectedTdfId);
  }
}




async function drawDashboard(curStudentGraphData, studentData){
  //Get Data from session variableS
  const {numCorrect, numIncorrect, totalStimCount, stimsSeen,  totalPracticeDuration, stimsIntroduced} = curStudentGraphData;
    // Perform calculated data
  totalAttempts = parseFloat(numCorrect) + parseFloat(numIncorrect)
  percentCorrect = (parseFloat(numCorrect) / totalAttempts) * 100;
  optimumDifficulty = 0.7;
  totalPracticeDurationMinutes = totalPracticeDuration / 60000;
  totalPracticeDurationMinutesDisplay = Math.round(totalPracticeDurationMinutes);
  console.log('percentCorrect numCorrect totalAttempts',percentCorrect,numCorrect, totalAttempts);
  percentStimsSeen = stimsSeen / parseFloat(totalStimCount) * 100;
  speedOfLearning = Math.log(1+stimsIntroduced) * 100; //Multiply by 100 for graph scale
  displayDifficulty =  (Math.min(Math.max((parseFloat(numCorrect)/stimsSeen) - optimumDifficulty, -0.3) , 0.3) + 0.3) * 100; //Add .3 and Multiply by 100 for graph scale
  const stimsSeenProbabilties = [];
  const stimsNotSeenProbabilites = [];
  for(let i = 0; i < studentData.probEstimates.length; i++ ){
      if(studentData.probEstimates[i].lastSeen != 0){
        stimsSeenProbabilties.push(studentData.probEstimates[i].probabilityEstimate);
      } else {
        stimsNotSeenProbabilites.push(studentData.probEstimates[i].probabilityEstimate);
      }
    }
  stimsSeenPredictedProbability = stimsSeenProbabilties[stimsSeenProbabilties.length -1 ];
  stimsNotSeenPredictedProbability = stimsNotSeenProbabilites[stimsNotSeenProbabilites.length -1 ];
  itemMasteryRate = Math.round(stimsSeen / totalPracticeDurationMinutes);
  estimatedTimeMastery = Math.round(itemMasteryRate / totalStimCount);
  Session.set('stimsSeenPercentCorrect',percentCorrect);
  Session.set('stimsSeenPredictedProbability',stimsSeenPredictedProbability);
  Session.set('stimsNotSeenPredictedProbability', stimsNotSeenPredictedProbability);
  Session.set('stimCount',parseFloat(totalStimCount));
  Session.set('stimsSeen',stimsSeen);
  Session.set('curTotalAttempts',totalAttempts);
  Session.set('practiceDuration', totalPracticeDurationMinutesDisplay);
  Session.set('itemMasteryRate', itemMasteryRate);
  Session.set('itemMasteryTime',estimatedTimeMastery);
  

  
  //Draw Dashboard
  let dashCluster = [];
  dashClusterCanvases = document.getElementsByClassName('dashCanvas');
    Array.prototype.forEach.call(dashClusterCanvases, function(element){
      if(element.classList.contains('masteredItems')){
        console.log(element);
        let gaugeMeter = new progressGauge(element,"donut",0,100,donutOptionsMasteredItems);
        dashCluster.push(gaugeMeter);
      }
      if(element.classList.contains('learningSpeed')){
        console.log(element);
        let gaugeMeter = new progressGauge(element,"gauge",0,300,gaugeOptionsSpeedOfLearning);
        dashCluster.push(gaugeMeter);
      }
      if(element.classList.contains('difficulty')){
        console.log(element);
        let gaugeMeter = new progressGauge(element,"gauge",0,60,gaugeOptionsDifficulty);
        dashCluster.push(gaugeMeter);
      }

    });
    //Populate Dashboard values
    console.log('Testing dashCluster:',dashCluster);
    dashCluster[0].set(percentStimsSeen);
    dashCluster[1].set(speedOfLearning);
    dashCluster[2].set(displayDifficulty);

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