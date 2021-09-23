
import {setStudentPerformance} from '../../lib/currentTestingHelpers';
import {INVALID} from '../../../common/Definitions';
import {meteorCallAsync} from '../..';
import gauge, {
  Gauge,
  Donut,
  BaseDonut,
  TextRenderer

} from '../../lib/gauge.js';
import { Session } from 'meteor/session';

Session.set('studentReportingTdfs', []);
Session.set('curStudentPerformance', {});

let defaultGaugeOptions = {
  lines: 12, // The number of lines to draw
  angle: 0.22, // The length of each line
  lineWidth: 0.15, // The line thickness
  pointer: {
    length: 0.9, // The radius of the inner circle
    strokeWidth: 0.035, // The rotation offset
    color: '#111111' // Fill color
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
  curClass: () => Session.get('curClass'),
  curStudentPerformance: () => Session.get('curStudentPerformance'),
  studentUsername: () => Session.get('studentUsername'),
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
};

Template.studentReporting.events({
  'change #tdf-select': async function(event) {
    const selectedTdfId = $(event.currentTarget).val();
    console.log('change tdf select', selectedTdfId);
    if (selectedTdfId!==INVALID) {
      $(`#tdf-select option[value="${INVALID}"]`).prop('disabled', true);
      const studentID = Session.get('curStudentID') || Meteor.userId();
      const studentUsername = Session.get('studentUsername') || Meteor.user().username;

      const studentData = await meteorCallAsync('getStudentReportingData', studentID, selectedTdfId);
      const curStudentGraphData = await meteorCallAsync('getStudentPerformanceByIdAndTDFId',studentID,selectedTdfId);
      console.log('studentData', studentData);

      setStudentPerformance(studentID, studentUsername, selectedTdfId);
      drawCharts(studentData);
      drawDashboard(curStudentGraphData);
    }
  },
});

function drawCharts(studentData) {
  $('#correctnessChart').attr('data-x-axis-label', 'Repetition Number');
  $('#correctnessChart').attr('data-y-axis-label', 'Correctness (%)');
  const {correctnessAcrossRepetitions, probEstimates} = studentData;
  // if(!!drawWithoutData){
  //   drawCorrectnessLine('#correctnessChart', [], [], "repetition", {});

  //   drawProbBars('#cardProbsChart', [], [], "probabilities", {});
  // }
  // Get our series and populate a range array for chart labeling
  const correctSeries = correctnessAcrossRepetitions.map((x) => x.percentCorrect);
  const probSeries = probEstimates.map((x) => x.probabilityEstimate).reverse();

  const itemDataCorLabels = _.range(1, correctSeries.length+1); // from 1 to len
  const itemDataProbLabels = probEstimates.map((x) => x.stimulus);
  let cardProbsChartAxisYOffset;
  let showYAxisLabel = true;

  // "All" selected, so we should make room for labels bigger than just numbers
  if (Session.get('curSelectedTdf') === 'xml') {
    cardProbsChartAxisYOffset = 250;
    showYAxisLabel = true;
  } else {
    cardProbsChartAxisYOffset = 50;
    showYAxisLabel = false;//
  }
  const probBarsHeight = Math.max((probSeries.length * 10), 200);

  // Now actually create the charts - but only if we can find the proper
  // elements and there is data to display

  drawCorrectnessLine('#correctnessChart', itemDataCorLabels, correctSeries, 'repetition', {
    height: 300,
    axisY: {
      type: Chartist.FixedScaleAxis,
      ticks: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
      low: 0,
      high: 100,
    },
  });

  drawProbBars('#cardProbsChart', itemDataProbLabels, probSeries, 'probabilities', {
    seriesBarDistance: 0,
    height: probBarsHeight,
    horizontalBars: true,
    high: 100,
    axisX: {
      labelInterpolationFnc: function(value, index) {
        return value % 10 == 0 ? value : null;
      },
      position: 'start',
      onlyInteger: true,
      type: Chartist.AutoScaleAxis,
      scaleMinSpace: 10,
      low: 0,
    },
    axisY: {
      offset: cardProbsChartAxisYOffset,
      showLabel: showYAxisLabel,
    },
  });
}

function drawCorrectnessLine(targetSelector, labels, series, dataDescrip, chartConfig) {
  const target = $(targetSelector).get(0);
  if (!target) {
    console.log('no target');
    return;
  }
  if (series.length < 2) {
    $(target)
        .removeClass('show-axis-labels')
        .html('<div class=\'nodata\'>No ' + dataDescrip + ' data available</div>');
  } else {
    $(target).addClass('show-axis-labels').html('');
    // Note that we provide some default values that can be overridden
    const chartData = {
      'labels': labels,
      'series': [series],
    };

    const fullConfig = _.extend({
      low: 0,
      fullWidth: true,
      height: 300,
      lineSmooth: false,
    }, chartConfig);

    new Chartist.Line(target, chartData, fullConfig);
  }
}

function drawProbBars(targetSelector, labels, series, dataDescrip, chartConfig) {
  const target = $(targetSelector).get(0);
  if (!target) {
    return;
  }
  if (series.length < 1) {
    $(target)
        .removeClass('show-axis-labels')
        .html('<div class=\'nodata\'>No ' + dataDescrip + ' data available</div>');
  } else {
    $(target).addClass('show-axis-labels').html('');
    // Note that we provide some default values that can be overridden
    const chartData = {
      'labels': labels,
      'series': [series],
    };

    const fullConfig = _.extend({
      low: 0,
      fullWidth: true,
    }, chartConfig);

    new Chartist.Bar(target, chartData, fullConfig).on('draw', function(data) {
      if (data.type === 'bar') {
        data.element._node.setAttribute('title', 'Item: ' +
            lookUpLabelByDataValue(labels, series, data.value) + ' Value: ' + data.value.toFixed(2));
        data.element._node.setAttribute('data-chart-tooltip', target);
      }
    }).on('created', function() {
      // Initiate Tooltip
      $(target).tooltip({
        selector: '[data-chart-tooltip="'+target+'"]',
        container: target,
        html: true,
      });
    });
  }
}

function lookUpLabelByDataValue(labels, series, value) {
  return labels[series.findIndex(function(element) {
    return element == value;
  })];
}


async function drawDashboard(curStudentGraphData){
  //Get Data from session variableS
  const {numCorrect, numIncorrect, totalStimCount, stimsSeen,  totalPracticeDuration} = curStudentGraphData;
  percentCorrect = numCorrect / stimsSeen * 100;
  percentStimsSeen = stimsSeen / totalStimCount * 100;
  //Draw Dashboard
  let dashCluster = [];
  dashClusterCanvases = document.getElementsByClassName('gaugeCanvas');
    Array.prototype.forEach.call(dashClusterCanvases, function(element){
      let gaugeMeter = new progressGauge(element,0,100);
      dashCluster.push(gaugeMeter);
    });
    //Populate Dashboard values
    console.log('Testing dashCluster:',dashCluster);
    dashCluster[0].set(percentStimsSeen);
    dashCluster[1].set(percentCorrect);

  }
function progressGauge(target, currentValue,maxValue,options = defaultGaugeOptions){
    if(target != undefined){
      console.log('gauge canvas found and loaded.')
      gauge = new Donut(target).setOptions(options); // create sexy gauge!
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
